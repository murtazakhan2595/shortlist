"use server";

import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import { type ApplicationStatusUpdated, type UpdateApplicationStatusInput, UpdateApplicationStatusInputSchema } from "./schemas";

// Server Actions for applications (contracts in ./schemas.ts). Writes use the owner's client, so the access
// rules apply too.

/**
 * Marks an application sent, skipped, replied or interview, with one tap (U2, Q7). Not one still being
 * prepared: the writer would overwrite the mark. The first time it is marked sent is kept, for the reports.
 */
export async function updateApplicationStatus(request: UpdateApplicationStatusInput): Promise<Result<ApplicationStatusUpdated>> {
  const input = UpdateApplicationStatusInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { applicationId, status } = input.data;
  const { data, error } = await db
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .neq("status", "preparing")
    .select("sent_at")
    .maybeSingle();
  if (error) return fail("internal", `Could not save the status: ${error.message}`);
  if (!data) return fail("conflict", "This application is still being prepared, or no longer exists.");

  if (status !== "skipped" && !data.sent_at) {
    // Replied or interview means it was sent, even if Sent was never tapped.
    const sent = await db.from("applications").update({ sent_at: new Date().toISOString() }).eq("id", applicationId).is("sent_at", null);
    if (sent.error) return fail("internal", `The status was saved, but not when it was sent: ${sent.error.message}`);
  }
  return ok(input.data);
}
