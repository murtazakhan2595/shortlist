import "server-only";
import { z } from "zod";
import { requireOwner } from "@/server/auth/require-owner";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";
import type { Tables } from "@/server/supabase/database.types";

/** Never the raw post or file paths. */
export type CaptureView = {
  id: string;
  inputType: Tables<"captures">["input_type"];
  status: Tables<"captures">["status"];
  role: string | null;
  company: string | null;
  posterName: string | null;
  contactEmail: string | null;
  formUrl: string | null;
  postUrl: string | null;
  createdAt: string;
  failure: OpenFailure | null;
};

/** The id comes from the URL, so it may be anything. */
export async function getCapture(id: string): Promise<CaptureView | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const { db } = await requireOwner();
  const [{ data, error }, failures] = await Promise.all([
    db
      .from("captures")
      .select("id, input_type, status, role, company, poster_name, contact_email, form_url, post_url, created_at")
      .eq("id", id)
      .maybeSingle(),
    findOpenFailures(db, [id]),
  ]);
  if (error) throw new Error(`Could not load capture ${id}: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    inputType: data.input_type,
    status: data.status,
    role: data.role,
    company: data.company,
    posterName: data.poster_name,
    contactEmail: data.contact_email,
    formUrl: data.form_url,
    postUrl: data.post_url,
    createdAt: data.created_at,
    failure: failures[0] ?? null,
  };
}
