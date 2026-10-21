import { z } from "zod";
import type { Tables } from "@/server/supabase/database.types";

// Contracts for the discovery feature (PLAN.md item 1.3; D1, U7).
//
// Server Actions:
//   labelListing(LabelListingInput) -> Result<ListingLabelled>
//
// Route handler (called by Supabase Cron, see AGENTS.md "Contracts"):
//   POST /api/daily-run -> Result<DailyRunSummary>

export const LabelListingInputSchema = z.object({
  listingId: z.uuid(),
  label: z.enum(["apply", "skip"]),
});
export type LabelListingInput = z.infer<typeof LabelListingInputSchema>;

export type ListingLabelled = LabelListingInput;

export type DailyRunSummary = {
  runId: string;
  listingsFetched: number;
  listingsKept: number;
  scoringStepsQueued: number;
};

// Types the discovery feature's files share.

/**
 * A job in the one format every source is converted to (D2): a listings row without the columns the
 * database fills, the owner's mark, and the filter's decision.
 */
export type Listing = Omit<
  Tables<"listings">,
  "id" | "created_at" | "label" | "labelled_at" | "eligibility" | "eligibility_reason"
>;

/** What the filter decides about a listing before any model call (D3, D4). */
export type Eligibility = Pick<Tables<"listings">, "eligibility" | "eligibility_reason">;
