import { z } from "zod";
import type { Tables } from "@/server/supabase/database.types";

// Contracts for the discovery feature (PLAN.md item 1.3; D1, U7).
//
// Server Actions:
//   labelListing(LabelListingInput) -> Result<ListingLabelled>
//   blockCompany(BlockCompanyInput) -> Result<CompanyBlocked>
//
// The daily run has no route: Supabase Cron calls start_daily_run in the database, which queues the
// fetch_listings step (steps/fetch-listings.ts).

export const LabelListingInputSchema = z.object({
  listingId: z.uuid(),
  label: z.enum(["apply", "skip"]),
});
export type LabelListingInput = z.infer<typeof LabelListingInputSchema>;

export type ListingLabelled = LabelListingInput;

// The company is read from the listing on the server, never sent by the browser.
export const BlockCompanyInputSchema = z.object({ listingId: z.uuid() });
export type BlockCompanyInput = z.infer<typeof BlockCompanyInputSchema>;

/** The company now blocked, and how many of its listings left the current list. */
export type CompanyBlocked = { company: string; listingsDropped: number };

// Types the discovery feature's files share.

/**
 * A job in the one format every source is converted to (D2): a listings row without the columns the
 * database fills, the owner's mark, the filter's decision and the rank scoring gives it.
 */
export type Listing = Omit<
  Tables<"listings">,
  "id" | "created_at" | "label" | "labelled_at" | "eligibility" | "eligibility_reason" | "top_rank"
>;

/** What the filter decides about a listing before any model call (D3, D4). */
export type Eligibility = Pick<Tables<"listings">, "eligibility" | "eligibility_reason">;
