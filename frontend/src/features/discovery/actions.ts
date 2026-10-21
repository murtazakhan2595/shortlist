"use server";

import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import { type LabelListingInput, LabelListingInputSchema, type ListingLabelled } from "./schemas";

// Server Actions for discovery (contracts in ./schemas.ts). Writes use the owner's client, so the access
// rules apply too.

/** Marks a listing apply or skip (U7). The marks are the test set for match quality (check E2). */
export async function labelListing(request: LabelListingInput): Promise<Result<ListingLabelled>> {
  const input = LabelListingInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { listingId, label } = input.data;
  const { data, error } = await db
    .from("listings")
    .update({ label, labelled_at: new Date().toISOString() })
    .eq("id", listingId)
    .select("id")
    .maybeSingle();
  if (error) return fail("internal", `Could not save the mark: ${error.message}`);
  if (!data) return fail("not_found", "This job is no longer listed");
  return ok({ listingId, label });
}
