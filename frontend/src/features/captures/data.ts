import "server-only";
import { z } from "zod";
import { requireOwner } from "@/server/auth/require-owner";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";
import { screenshotLinks } from "@/server/screenshots";
import type { Tables } from "@/server/supabase/database.types";

/** Never storage paths: screenshots come as links that work for an hour. */
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
  /** The pasted text, or the text read from the screenshots. */
  postText: string | null;
  screenshotUrls: string[];
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
      .select("id, input_type, status, role, company, poster_name, contact_email, form_url, post_url, raw_text, image_paths, created_at")
      .eq("id", id)
      .maybeSingle(),
    findOpenFailures(db, [id]),
  ]);
  if (error) throw new Error(`Could not load capture ${id}: ${error.message}`);
  if (!data) return null;

  const screenshotUrls = await screenshotLinks(db, data.image_paths);
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
    postText: data.raw_text,
    screenshotUrls,
    createdAt: data.created_at,
    failure: failures[0] ?? null,
  };
}
