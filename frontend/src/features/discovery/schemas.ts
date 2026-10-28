import { z } from "zod";
import type { Tables } from "@/server/supabase/database.types";

// Server Actions:
//   labelListing(LabelListingInput) -> Result<LabelListingInput>
//   blockCompany(BlockCompanyInput) -> Result<CompanyBlocked>

export const LabelListingInputSchema = z.object({
  listingId: z.uuid(),
  label: z.enum(["apply", "skip"]),
});
export type LabelListingInput = z.infer<typeof LabelListingInputSchema>;

// From the Jobs page address, so anything unknown falls back to the latest night and every job.
export const JOB_FILTERS = ["all", "undecided", "apply", "skip"] as const;
export const JobsFiltersSchema = z.object({
  night: z.uuid().optional().catch(undefined),
  show: z.enum(JOB_FILTERS).catch("all"),
});
export type JobsFilters = z.infer<typeof JobsFiltersSchema>;

// The company is read from the listing on the server, never sent by the browser.
export const BlockCompanyInputSchema = z.object({ listingId: z.uuid() });
export type BlockCompanyInput = z.infer<typeof BlockCompanyInputSchema>;

export type CompanyBlocked = { company: string; listingsDropped: number };

/** The one format every source is converted to, before the filter and scoring add their columns. */
export type Listing = Omit<
  Tables<"listings">,
  "id" | "created_at" | "label" | "labelled_at" | "eligibility" | "eligibility_reason" | "top_rank"
>;

export type Eligibility = Pick<Tables<"listings">, "eligibility" | "eligibility_reason">;
