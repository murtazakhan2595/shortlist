import "server-only";
import { z } from "zod";
import { requireOwner } from "@/server/auth/require-owner";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";
import { screenshotLinks } from "@/server/screenshots";
import type { Tables } from "@/server/supabase/database.types";

export type FormQuestion = Pick<Tables<"form_answers">, "id" | "position" | "question" | "options" | "answer" | "status" | "note">;

export type FormView = {
  id: string;
  /** More pages can be added once "ready". */
  status: string;
  role: string | null;
  company: string | null;
  screenshots: number;
  hasPastedText: boolean;
  /** The job post or description, as read from the pages. */
  jobText: string | null;
  /** The pages the owner added, the job post among them, as links that work for an hour. */
  screenshotUrls: string[];
  questions: FormQuestion[];
  /** The latest step that failed every attempt, until retried. */
  failure: OpenFailure | null;
  costUsd: number;
  modelCalls: number;
};

// The id comes from the URL, so it may be anything.
export async function getForm(id: string): Promise<FormView | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const { db } = await requireOwner();
  const [form, calls, failures] = await Promise.all([
    db
      .from("applications")
      .select(
        "id, status, job_role, job_company, job_text, form_image_paths, form_text, form_answers (id, position, question, options, answer, status, note)",
      )
      .eq("id", id)
      .eq("route", "form")
      .order("position", { referencedTable: "form_answers" })
      .maybeSingle(),
    db.from("model_calls").select("cost_usd").eq("application_id", id),
    findOpenFailures(db, [id]),
  ]);
  if (form.error) throw new Error(`Could not load form ${id}: ${form.error.message}`);
  if (calls.error) throw new Error(`Could not load the cost of form ${id}: ${calls.error.message}`);
  if (!form.data) return null;

  const screenshotUrls = await screenshotLinks(db, form.data.form_image_paths);
  return {
    id: form.data.id,
    status: form.data.status,
    role: form.data.job_role,
    company: form.data.job_company,
    screenshots: form.data.form_image_paths.length,
    hasPastedText: form.data.form_text !== null,
    jobText: form.data.job_text,
    screenshotUrls,
    questions: form.data.form_answers,
    failure: failures[0] ?? null,
    costUsd: calls.data.reduce((total, call) => total + call.cost_usd, 0),
    modelCalls: calls.data.length,
  };
}

export type FormSummary = {
  id: string;
  role: string | null;
  company: string | null;
  questions: number;
  needsInput: number;
  createdAt: string;
};

const RECENT_FORMS = 10;

export async function getRecentForms(): Promise<FormSummary[]> {
  const { db } = await requireOwner();
  const { data, error } = await db
    .from("applications")
    .select("id, job_role, job_company, created_at, form_answers (status)")
    .eq("route", "form")
    .order("created_at", { ascending: false })
    .limit(RECENT_FORMS);
  if (error) throw new Error(`Could not load recent forms: ${error.message}`);

  return data.map((form) => ({
    id: form.id,
    role: form.job_role,
    company: form.job_company,
    questions: form.form_answers.length,
    needsInput: form.form_answers.filter((answer) => answer.status === "needs_input").length,
    createdAt: form.created_at,
  }));
}
