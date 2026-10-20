import "server-only";
import { z } from "zod";
import { requireOwner } from "@/server/auth/require-owner";
import type { Tables } from "@/server/supabase/database.types";

// Data Access Layer for forms: the feature's reads, each starting with the owner check.

export type FormQuestion = Pick<Tables<"form_answers">, "id" | "position" | "question" | "options" | "answer" | "status" | "note">;

/** What the form page shows: the job, the questions in order, and what answering them cost (B1). */
export type FormView = {
  id: string;
  /** "preparing" while pages are read or questions answered; then "ready". */
  status: string;
  role: string | null;
  company: string | null;
  screenshots: number;
  hasPastedText: boolean;
  questions: FormQuestion[];
  costUsd: number;
  modelCalls: number;
};

/** The form with this id, or null if there is none (the id comes from the URL, so it may be anything). */
export async function getForm(id: string): Promise<FormView | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const { db } = await requireOwner();
  const [form, calls] = await Promise.all([
    db
      .from("applications")
      .select(
        "id, status, job_role, job_company, form_image_paths, form_text, form_answers (id, position, question, options, answer, status, note)",
      )
      .eq("id", id)
      .eq("route", "form")
      .order("position", { referencedTable: "form_answers" })
      .maybeSingle(),
    db.from("model_calls").select("cost_usd").eq("application_id", id),
  ]);
  if (form.error) throw new Error(`Could not load form ${id}: ${form.error.message}`);
  if (calls.error) throw new Error(`Could not load the cost of form ${id}: ${calls.error.message}`);
  if (!form.data) return null;

  return {
    id: form.data.id,
    status: form.data.status,
    role: form.data.job_role,
    company: form.data.job_company,
    screenshots: form.data.form_image_paths.length,
    hasPastedText: form.data.form_text !== null,
    questions: form.data.form_answers,
    costUsd: calls.data.reduce((total, call) => total + call.cost_usd, 0),
    modelCalls: calls.data.length,
  };
}

/** A line in the list of recent forms. */
export type FormSummary = {
  id: string;
  role: string | null;
  company: string | null;
  questions: number;
  needsInput: number;
  createdAt: string;
};

const RECENT_FORMS = 10;

/** The latest forms, newest first, so the owner can go back to one to finish it. */
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
