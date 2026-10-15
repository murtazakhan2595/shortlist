import { z } from "zod";

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
