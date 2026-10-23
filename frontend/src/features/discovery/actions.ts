"use server";

import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import {
  type BlockCompanyInput,
  BlockCompanyInputSchema,
  type CompanyBlocked,
  type LabelListingInput,
  LabelListingInputSchema,
} from "./schemas";
import { BLOCKED_COMPANY_REASON, isBlockedCompany } from "./steps/eligibility";

// Server Actions for discovery (contracts in ./schemas.ts). Writes use the owner's client, so the access
// rules apply too.

/** Marks a listing apply or skip (U7). The marks are the test set for match quality (check E2). */
export async function labelListing(request: LabelListingInput): Promise<Result<LabelListingInput>> {
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

/**
 * Blocks the listing's company: it is added to the blocked companies in Settings, so the nightly filter
 * drops its jobs from now on, and its listings in the same night's list move to the dropped ones at once.
 * One the owner marked apply stays. A note already written is kept with its application.
 */
export async function blockCompany(request: BlockCompanyInput): Promise<Result<CompanyBlocked>> {
  const input = BlockCompanyInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const listing = await db.from("listings").select("company, run_id").eq("id", input.data.listingId).maybeSingle();
  if (listing.error) return fail("internal", `Could not load the job: ${listing.error.message}`);
  if (!listing.data) return fail("not_found", "This job is no longer listed");
  const { company, run_id: runId } = listing.data;

  const settings = await db.from("settings").select("blocked_companies").single();
  if (settings.error) return fail("internal", `Could not load the blocked companies: ${settings.error.message}`);
  const blocked = settings.data.blocked_companies;
  if (!isBlockedCompany(company, blocked)) {
    // The table has one row, whose id is always true.
    const saved = await db.from("settings").update({ blocked_companies: [...blocked, company] }).eq("id", true);
    if (saved.error) return fail("internal", `Could not block ${company}: ${saved.error.message}`);
  }

  const sameNight = runId
    ? await db.from("listings").select("id, company, label").eq("run_id", runId)
    : await db.from("listings").select("id, company, label").eq("id", input.data.listingId);
  if (sameNight.error) return fail("internal", `Could not load the night's jobs: ${sameNight.error.message}`);
  const toDrop = sameNight.data
    .filter((job) => job.label !== "apply" && isBlockedCompany(job.company, [company]))
    .map((job) => job.id);

  const dropped = await db
    .from("listings")
    .update({ eligibility: "excluded", eligibility_reason: BLOCKED_COMPANY_REASON })
    .in("id", toDrop);
  if (dropped.error) return fail("internal", `${company} is blocked, but its jobs are still listed: ${dropped.error.message}`);
  return ok({ company, listingsDropped: toDrop.length });
}
