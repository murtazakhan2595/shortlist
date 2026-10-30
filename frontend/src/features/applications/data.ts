import "server-only";
import { z } from "zod";
import { sourceName } from "@/lib/source-names";
import { requireOwner } from "@/server/auth/require-owner";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";
import { DAILY_LIST_DAYS } from "./schemas";

export type ApplicationView = {
  status: string;
  recipientEmail: string | null;
  subject: string | null;
  body: string | null;
  presentedTitle: string | null;
  cvFileName: string | null;
  emailPattern: string | null;
  /** One problem per line. */
  blockedReason: string | null;
  inGmail: boolean;
  /** Every model call for this application, reading the post included. */
  costUsd: number;
  modelCalls: number;
  /** A writer or Gmail step that failed every attempt, until retried. */
  failure: OpenFailure | null;
};

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

export type ApplicationSummary = {
  id: string;
  route: "email" | "note" | "form";
  status: string;
  createdAt: string;
  role: string | null;
  company: string | null;
  source: string | null;
  score: number | null;
  tags: string[];
  inGmail: boolean;
  href: string;
};


export function applicationHref(route: ApplicationSummary["route"], row: { id: string; capture_id: string | null; listing_id: string | null }): string {
  if (route === "form") return `/forms/${row.id}`;
  if (row.capture_id) return `/captures/${row.capture_id}`;
  return row.listing_id ? `/jobs/${row.listing_id}` : "/jobs";
}

export async function getRecentApplications(): Promise<ApplicationSummary[]> {
  const { db } = await requireOwner();
  // Read after the owner check: the time is only known per request (Cache Components).
  const since = new Date(Date.now() - DAILY_LIST_DAYS * 24 * 3_600_000).toISOString();
  const { data, error } = await db
    .from("applications")
    .select(
      "id, route, status, created_at, gmail_draft_id, job_role, job_company, capture_id, listing_id, captures (role, company), listings (title, company, source, tags, scores (score))",
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
        source: capture ? "LinkedIn" : listing ? sourceName(listing.source) : null,
        score: listing?.scores?.score ?? null,
        tags: listing?.tags ?? [],
        inGmail: row.gmail_draft_id !== null,
        href: applicationHref(route, row),
      },
    ];
  });
}
