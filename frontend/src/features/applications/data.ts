import "server-only";
import { z } from "zod";
import { requireOwner } from "@/server/auth/require-owner";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";
import { DAILY_LIST_DAYS } from "./schemas";

// Data Access Layer for applications: the feature's reads, each starting with the owner check.

/** What the owner sees of a prepared application. */
export type ApplicationView = {
  status: string;
  recipientEmail: string | null;
  subject: string | null;
  body: string | null;
  presentedTitle: string | null;
  cvFileName: string | null;
  emailPattern: string | null;
  /** The problems that stopped a draft, one per line (X4). */
  blockedReason: string | null;
  /** True once the email is saved as a draft in the owner's Gmail (X1). */
  inGmail: boolean;
  /** What every model call for this application cost, from reading the post to the last check (B1). */
  costUsd: number;
  modelCalls: number;
  /** A step writing the draft or saving it to Gmail that failed every attempt, until tried again. */
  failure: OpenFailure | null;
};

/** The application prepared from a capture, or null if there is none yet. */
export async function getApplicationForCapture(captureId: string): Promise<ApplicationView | null> {
  if (!z.uuid().safeParse(captureId).success) return null;

  const { db } = await requireOwner();
  const { data, error } = await db
    .from("applications")
    .select(
      "id, status, recipient_email, subject, body, presented_title, blocked_reason, gmail_draft_id, cv_files (file_name), documents (name), captures (run_id)",
    )
    .eq("capture_id", captureId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the application for capture ${captureId}: ${error.message}`);
  if (!data) return null;

  // The capture's run holds every call, reading the post included; application_id covers calls made without a run.
  const runId = data.captures?.run_id;
  const [calls, failures] = await Promise.all([
    db
      .from("model_calls")
      .select("cost_usd")
      .or(runId ? `application_id.eq.${data.id},run_id.eq.${runId}` : `application_id.eq.${data.id}`),
    findOpenFailures(db, [data.id]),
  ]);
  if (calls.error) throw new Error(`Could not load the cost of application ${data.id}: ${calls.error.message}`);

  return {
    status: data.status,
    recipientEmail: data.recipient_email,
    subject: data.subject,
    body: data.body,
    presentedTitle: data.presented_title,
    cvFileName: data.cv_files?.file_name ?? null,
    emailPattern: data.documents?.name ?? null,
    blockedReason: data.blocked_reason,
    inGmail: data.gmail_draft_id !== null,
    costUsd: calls.data.reduce((total, call) => total + call.cost_usd, 0),
    modelCalls: calls.data.length,
    failure: failures[0] ?? null,
  };
}

/** One application on the daily list (U1): what the job is, where it came from, and what was prepared. */
export type ApplicationSummary = {
  id: string;
  route: "email" | "note" | "form";
  status: string;
  createdAt: string;
  role: string | null;
  company: string | null;
  /** Where the job was found: "LinkedIn" for a captured post, the job board's name for a listing, null for a form. */
  source: string | null;
  /** The listing's score and tags, for a note. */
  score: number | null;
  tags: string[];
  /** True once an email is a draft in the owner's Gmail. */
  inGmail: boolean;
  /** Where to see it in full: the captured post, the Jobs page, or the form. */
  href: string;
};

const SOURCE_NAMES: Record<string, string> = { himalayas: "Himalayas" };

/** The applications of the last DAILY_LIST_DAYS days, newest first. */
export async function getRecentApplications(): Promise<ApplicationSummary[]> {
  const { db } = await requireOwner();
  // Read after the owner check: the time is only known per request (Cache Components).
  const since = new Date(Date.now() - DAILY_LIST_DAYS * 24 * 3_600_000).toISOString();
  const { data, error } = await db
    .from("applications")
    .select(
      "id, route, status, created_at, gmail_draft_id, job_role, job_company, capture_id, captures (role, company), listings (title, company, source, tags, scores (score))",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load recent applications: ${error.message}`);

  return data.flatMap((row) => {
    const route = row.route === "email" || row.route === "note" || row.route === "form" ? row.route : null;
    if (!route) return [];
    const { captures: capture, listings: listing } = row;
    return [
      {
        id: row.id,
        route,
        status: row.status,
        createdAt: row.created_at,
        role: capture?.role ?? listing?.title ?? row.job_role,
        company: capture?.company ?? listing?.company ?? row.job_company,
        source: capture ? "LinkedIn" : listing ? (SOURCE_NAMES[listing.source] ?? listing.source) : null,
        score: listing?.scores?.score ?? null,
        tags: listing?.tags ?? [],
        inGmail: row.gmail_draft_id !== null,
        href: route === "form" ? `/forms/${row.id}` : route === "email" && row.capture_id ? `/captures/${row.capture_id}` : "/jobs",
      },
    ];
  });
}
