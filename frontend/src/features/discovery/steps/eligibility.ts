import "server-only";
import { getAdminClient } from "@/server/supabase/admin";
import type { Eligibility, Listing } from "../schemas";

// The filter (PLAN.md item 4.3; D3, D3a, D4, Q2 to Q4): plain code that runs before any model call.
// A listing is "excluded" only when it clearly does not fit the owner; then it is dropped and never scored.
// A listing that might not fit is "unclear": it is kept and scored, and ranked lower. Everything else is
// "eligible". When in doubt, a rule keeps the listing: judging fit is the scoring step's job (D5).

/** The owner's filter settings, which the owner can change in the app (U4). */
export type FilterSettings = { payFloorUsdMonth: number; excludedCountries: string[] };

/** Where the owner lives and works from. */
const OWNER_COUNTRY = "Pakistan";

export async function loadFilterSettings(): Promise<FilterSettings> {
  const { data, error } = await getAdminClient().from("settings").select("pay_floor_usd_month, excluded_countries").single();
  if (error) throw new Error(`Could not load the filter settings: ${error.message}`);
  return { payFloorUsdMonth: data.pay_floor_usd_month, excludedCountries: data.excluded_countries };
}

/** The first rule a listing clearly fails, else what makes it unclear, else eligible. */
export function eligibilityOf(listing: Listing, settings: FilterSettings): Eligibility {
  const excludedBecause = exclusionReason(listing, settings);
  if (excludedBecause) return { eligibility: "excluded", eligibility_reason: excludedBecause };

  const doubts = doubtsAbout(listing);
  if (doubts.length > 0) return { eligibility: "unclear", eligibility_reason: doubts.join("; ") };
  return { eligibility: "eligible", eligibility_reason: null };
}

function exclusionReason(listing: Listing, settings: FilterSettings): string | null {
  if (isNonTechnical(listing)) return "Not a technical role";
  if (isAboveSeniorityRange(listing)) return "Above the seniority range (lead, staff, principal or management)";

  const yearsRequired = minimumYearsRequired(listing.description);
  if (yearsRequired !== null && yearsRequired > MAX_YEARS_REQUIRED) return `Asks for ${yearsRequired}+ years of experience`;

  const pay = monthlyPayUsd(listing);
  if (pay !== null && pay < settings.payFloorUsdMonth) return `Pays about ${Math.round(pay)} USD a month, below the floor`;

  if (CLEARANCE_OR_CITIZENSHIP.test(listing.description)) return "Asks for a security clearance or citizenship";
  return countryReason(listing, settings.excludedCountries);
}

// ---------------------------------------------------------------------------
// Technical roles
// ---------------------------------------------------------------------------

// Categories that are clearly not engineering. A listing is dropped only when every category it has is one
// of these and its title has no technical word, so a "DevOps Engineer" filed under Operations is kept.
const NON_TECHNICAL_CATEGORIES = [
  "Sales",
  "Marketing",
  "Growth",
  "Human Resources",
  "Customer Service",
  "Finance",
  "Legal",
  "Logistics",
  "Operations",
  "Content Creator",
  "Design",
  "Product",
  "Education",
];
const TECHNICAL_TITLE =
  /engineer|developer|programmer|software|full[- ]?stack|front[- ]?end|back[- ]?end|web|mobile|\bios\b|android|\bai\b|\bml\b|machine learning|\bllm|data|devops|cloud|platform|architect|automation|integration|technical|technology|\bit\b|\bqa\b|\bsre\b|python|java|react|node|typescript|javascript|\.net|php|laravel/i;

function isNonTechnical(listing: Listing): boolean {
  const onlyNonTechnical =
    listing.categories.length > 0 && listing.categories.every((category) => NON_TECHNICAL_CATEGORIES.includes(category));
  return onlyNonTechnical && !TECHNICAL_TITLE.test(listing.title);
}

// ---------------------------------------------------------------------------
// Seniority and experience (Q2: mid-level and senior, up to five years required)
// ---------------------------------------------------------------------------

const LEVELS_ABOVE_RANGE = ["Manager", "Director", "Executive"];
const TITLE_ABOVE_RANGE = /\b(lead|staff|principal|head of|director|vp|vice president|chief|cto)\b/i;
const MAX_YEARS_REQUIRED = 5;

function isAboveSeniorityRange(listing: Listing): boolean {
  const labelledAbove = listing.seniority.length > 0 && listing.seniority.every((level) => LEVELS_ABOVE_RANGE.includes(level));
  return labelledAbove || TITLE_ABOVE_RANGE.test(listing.title);
}

// "5+ years of experience", "3-5 years of professional backend experience", "7 years' experience". Only a
// number of years followed by "experience" counts, so "10 years in business" about the company does not.
const YEARS_OF_EXPERIENCE = /(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?years?['’]?\s+(?:of\s+)?(?:[\w./-]+\s+){0,4}?experience/gi;

/**
 * The fewest years of experience the description asks for, or null if it names none. Where it names several
 * ("6+ years of backend experience, 2+ years with React"), the fewest counts, so a listing is dropped only
 * when every requirement is above the range.
 */
export function minimumYearsRequired(description: string): number | null {
  const years = [...description.matchAll(YEARS_OF_EXPERIENCE)].map((match) => Number(match[1])).filter((value) => value > 0);
  return years.length > 0 ? Math.min(...years) : null;
}

// ---------------------------------------------------------------------------
// Pay (Q3: dropped only when stated below the floor)
// ---------------------------------------------------------------------------

// Rough rates: a few percent either way does not matter for a floor. Pay in another currency counts as unstated.
const USD_PER_UNIT: Record<string, number> = { USD: 1, EUR: 1.1, GBP: 1.3, CAD: 0.73, AUD: 0.66 };
const MONTHS_PER_PERIOD: Record<string, number> = { hour: 1 / 160, month: 1, year: 12 };

/** The most the listing says it pays, in US dollars a month, or null when it does not say in a known currency. */
export function monthlyPayUsd(listing: Listing): number | null {
  const pay = listing.salary_max ?? listing.salary_min;
  const rate = USD_PER_UNIT[listing.salary_currency ?? ""];
  const months = MONTHS_PER_PERIOD[listing.salary_period ?? ""];
  if (!pay || rate === undefined || months === undefined) return null;
  return (pay * rate) / months;
}

// ---------------------------------------------------------------------------
// Where candidates may be (D3, D3a)
// ---------------------------------------------------------------------------

const CLEARANCE_OR_CITIZENSHIP =
  /security clearance|clearance (is )?required|active (secret|top secret|ts\/sci)|must be an? (u\.?s\.?|us|united states|eu|uk|canadian|australian) citizen|(u\.?s\.?|us) citizens? only|citizenship (is )?required/i;

/** An excluded country (D3a): the listing is open only there, or says the employer is based there. */
function countryReason(listing: Listing, excludedCountries: string[]): string | null {
  const openOnlyToExcluded =
    listing.countries.length > 0 && listing.countries.every((country) => excludedCountries.includes(country));
  if (openOnlyToExcluded) return `Open only to ${listing.countries.join(", ")}`;

  for (const country of excludedCountries) {
    if (new RegExp(`\\b(based|headquartered|located) in ${country}\\b`, "i").test(listing.description)) {
      return `The employer is based in ${country}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Doubts: kept, scored, ranked lower (D4)
// ---------------------------------------------------------------------------

const WORK_AUTHORISATION =
  /authori[sz]ed to work in|right to work in|work authori[sz]ation|(no|not able to|unable to|cannot|can't|will not|won't) (offer |provide )?(visa )?sponsor|must (reside|live|be located|be based) in/i;

function doubtsAbout(listing: Listing): string[] {
  const doubts: string[] = [];
  // Not dropped: a list can name a region, such as "Asia", that includes the owner's country.
  if (listing.countries.length > 0 && !listing.countries.includes(OWNER_COUNTRY)) {
    doubts.push(`Lists ${listing.countries.join(", ")}, not ${OWNER_COUNTRY}`);
  }
  if (WORK_AUTHORISATION.test(listing.description)) doubts.push("Mentions work authorisation or where you must live");
  if (listing.seniority.length > 0 && listing.seniority.every((level) => level === "Entry-level")) doubts.push("Listed as entry level");
  return doubts;
}
