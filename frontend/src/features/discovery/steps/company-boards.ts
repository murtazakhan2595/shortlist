import "server-only";
import { z } from "zod";
import { mapConcurrently } from "@/lib/concurrency";
import { htmlToText } from "@/lib/html";
import { type AshbyCompensationComponent, type AshbyJob, ASHBY_SOURCE, fetchAshbyBoard } from "@/server/ashby";
import { fetchGreenhouseBoard, fetchGreenhouseJob, GREENHOUSE_SOURCE, type GreenhouseJob, greenhouseSourceId } from "@/server/greenhouse";
import { jobKey } from "@/server/job-key";
import { fetchLeverBoard, LEVER_SOURCE, type LeverPosting } from "@/server/lever";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json, Tables, TablesInsert } from "@/server/supabase/database.types";
import type { Listing } from "../schemas";
import {
  type FilterSettings,
  isBlockedCompany,
  isOpenRemoteLocation,
  isTitleAboveRange,
  offersVisa,
  TECHNICAL_TITLE,
} from "./eligibility";

// Company job boards, kept by code with no model call. Every night load_board_lists adds new boards from
// Feashliaa's lists, then check_boards reads the boards that are due, titles only, and marks each one watched
// (a remote developer job open to the owner's country), idle (none, so read again in a month) or gone.
// The nightly run then reads the watched boards for new jobs (readWatchedBoards).

export const BOARD_PROVIDERS = ["greenhouse", "lever", "ashby"] as const;
export type BoardProvider = (typeof BOARD_PROVIDERS)[number];

type Board = Pick<Tables<"company_boards">, "provider" | "slug" | "status" | "company" | "matched_at">;
type BoardRow = TablesInsert<"company_boards">;
/** One job as its board lists it, and how to make it a listing. */
type BoardJob = {
  title: string;
  /** Every place the board names for it, with its work model: "Remote", "Remote; United States". */
  location: string;
  company: string | null;
  /** Unix milliseconds. */
  postedAt: number | null;
  toListing: (company: string, runId: string) => Promise<Listing | null>;
};

const BOARD_READERS: Record<BoardProvider, (slug: string) => Promise<BoardJob[] | null>> = {
  greenhouse: async (slug) =>
    (await fetchGreenhouseBoard(slug))?.map((job) => ({
      title: job.title,
      location: job.location?.name ?? "",
      company: job.company_name ?? null,
      postedAt: job.first_published ? Date.parse(job.first_published) : null,
      // The list has no posts, so a post is read only for a job worth it.
      toListing: async (company, runId) => {
        const post = await fetchGreenhouseJob(slug, job.id);
        return post && greenhouseListing(post, slug, company, runId);
      },
    })) ?? null,
  lever: async (slug) =>
    (await fetchLeverBoard(slug))?.map((posting) => ({
      title: posting.text,
      location: leverPlaces(posting).join("; "),
      company: null,
      postedAt: posting.createdAt,
      toListing: async (company, runId) => leverListing(posting, company, runId),
    })) ?? null,
  ashby: async (slug) =>
    (await fetchAshbyBoard(slug))
      ?.filter((job) => job.isListed)
      .map((job) => ({
        title: job.title,
        location: ashbyPlaces(job).join("; "),
        company: null,
        postedAt: Date.parse(job.publishedAt),
        toListing: async (company, runId) => ashbyListing(job, company, runId),
      })) ?? null,
};

// Feashliaa/job-board-aggregator (MIT) refreshes these lists of boards every day.
const BOARD_LIST_URL = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";
const BoardListSchema = z.array(z.string().min(1));
const ROWS_PER_INSERT = 5_000;

const BOARDS_PER_STEP = 100;
const CONCURRENT_REQUESTS = 10;
// The first pass over all 16,000 boards takes about a week.
const MAX_CHECKS_PER_NIGHT = 2_500;
const IDLE_RECHECK_DAYS = 30;
// A watched board with no such job for this long goes back to idle.
const WATCH_WITHOUT_MATCH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const CheckBoardsPayloadSchema = z.object({ checked: z.number().int().min(0).default(0) });

export async function loadBoardLists(): Promise<void> {
  for (const provider of BOARD_PROVIDERS) {
    const response = await fetch(`${BOARD_LIST_URL}/${provider}_companies.json`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Could not download the ${provider} board list: ${response.status}`);
    const slugs = BoardListSchema.parse(await response.json());
    await addListedBoards(slugs.map((slug) => ({ provider, slug: slug.toLowerCase() })));
  }
  await enqueueStep(STEP_NAMES.checkBoards, {});
}

/** After the lists failed to load every attempt: the boards already listed are still checked. */
export async function checkWithoutNewLists(): Promise<void> {
  await enqueueStep(STEP_NAMES.checkBoards, {});
}

// Boards already listed keep their status.
async function addListedBoards(boards: { provider: BoardProvider; slug: string }[]): Promise<void> {
  for (let start = 0; start < boards.length; start += ROWS_PER_INSERT) {
    const { error } = await getAdminClient()
      .from("company_boards")
      .upsert(boards.slice(start, start + ROWS_PER_INSERT), { onConflict: "provider,slug", ignoreDuplicates: true });
    if (error) throw new Error(`Could not add the listed boards: ${error.message}`);
  }
}

export async function checkBoards(payload: Json): Promise<void> {
  const { checked } = CheckBoardsPayloadSchema.parse(payload);
  const { data: boards, error } = await getAdminClient().rpc("boards_to_check", {
    providers: [...BOARD_PROVIDERS],
    how_many: BOARDS_PER_STEP,
  });
  if (error) throw new Error(`Could not find the boards to check: ${error.message}`);

  const now = new Date();
  await saveBoards(await mapConcurrently(boards, CONCURRENT_REQUESTS, (board) => checkBoard(board, now)));

  const total = checked + boards.length;
  if (boards.length === BOARDS_PER_STEP && total < MAX_CHECKS_PER_NIGHT) {
    await enqueueStep(STEP_NAMES.checkBoards, { checked: total });
  }
}

export async function checkBoard(board: Board, now: Date): Promise<BoardRow> {
  try {
    const read = BOARD_READERS[board.provider as BoardProvider];
    return boardAfterRead(board, await read(board.slug), now);
  } catch {
    // A timeout or an error from the provider: the board keeps its status and is tried again tomorrow.
    return { ...board, checked_at: now.toISOString(), next_check_at: daysFrom(now, 1) };
  }
}

// Every row has the same columns, as one upsert saves them all.
export function boardAfterRead(board: Board, jobs: BoardJob[] | null, now: Date): BoardRow {
  const checked = { ...board, checked_at: now.toISOString() };
  if (!jobs) return { ...checked, status: "gone", next_check_at: null };

  const company = jobs.find((job) => job.company)?.company ?? board.company;
  if (jobs.some(isWatchable)) return { ...checked, company, status: "watched", next_check_at: null, matched_at: checked.checked_at };
  const matchedLately =
    board.status === "watched" && board.matched_at !== null && now.getTime() - Date.parse(board.matched_at) < WATCH_WITHOUT_MATCH_DAYS * DAY_MS;
  if (matchedLately) return { ...checked, company, next_check_at: null };
  return { ...checked, company, status: "idle", next_check_at: daysFrom(now, IDLE_RECHECK_DAYS) };
}

async function saveBoards(rows: BoardRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getAdminClient().from("company_boards").upsert(rows, { onConflict: "provider,slug" });
  if (error) throw new Error(`Could not save the boards: ${error.message}`);
}

function daysFrom(date: Date, days: number): string {
  return new Date(date.getTime() + days * DAY_MS).toISOString();
}

/** Generous on purpose: the nightly filter reads the full post and decides for each job. */
export function isWatchable(job: Pick<BoardJob, "title" | "location">): boolean {
  return TECHNICAL_TITLE.test(job.title) && !isTitleAboveRange(job.title) && isOpenRemoteLocation(job.location);
}

// --- Boards linked from jobs that passed the filter ---

const BOARD_LINKS: { provider: BoardProvider; pattern: RegExp }[] = [
  { provider: "greenhouse", pattern: /\b(?:job-)?boards(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/gi },
  { provider: "lever", pattern: /\bjobs(?:\.eu)?\.lever\.co\/([\w.-]+)/gi },
  { provider: "ashby", pattern: /\bjobs\.ashbyhq\.com\/([\w.-]+)/gi },
];

export function boardLinksIn(text: string): { provider: BoardProvider; slug: string }[] {
  const found = new Map<string, { provider: BoardProvider; slug: string }>();
  for (const { provider, pattern } of BOARD_LINKS) {
    for (const [, slug] of text.matchAll(pattern)) {
      const board = { provider, slug: slug.toLowerCase().replace(/\.+$/, "") };
      if (board.slug !== "" && board.slug !== "embed") found.set(`${provider}/${board.slug}`, board);
    }
  }
  return [...found.values()];
}

/** A company hiring through a post that passed the filter is worth a look, whatever its board said before. */
export async function addBoardsFromListings(listings: Pick<Listing, "url" | "description">[]): Promise<void> {
  // Read as one text, so a board linked from two posts is added once.
  const boards = boardLinksIn(listings.map((listing) => `${listing.url}\n${listing.description}`).join("\n"));
  if (boards.length === 0) return;
  const { error } = await getAdminClient().rpc("add_boards_to_check", { boards });
  if (error) throw new Error(`Could not add the boards linked from listings: ${error.message}`);
}

// --- The nightly read of watched boards ---

// With up to 20 full posts each, a step stays well inside its 60 seconds.
const BOARDS_READ_PER_STEP = 25;
const MAX_JOB_AGE_DAYS = 30;
// Some boards have hundreds of recent jobs: the newest are read first, the rest on later nights.
const MAX_NEW_JOBS_PER_BOARD = 20;
const FINGERPRINTS_PER_QUERY = 200;

/**
 * The new jobs on the provider's next watched boards after `after`, in slug order, as listings, and the slug to
 * go on from while boards are left. Boards of blocked companies are skipped; each board read is saved, so a
 * board that no longer has such a job goes back to idle in time.
 */
export async function readWatchedBoards(
  provider: BoardProvider,
  after: string | undefined,
  settings: FilterSettings,
  runId: string,
): Promise<{ listings: Listing[]; after?: string }> {
  let query = getAdminClient()
    .from("company_boards")
    .select("provider, slug, status, company, matched_at")
    .eq("provider", provider)
    .eq("status", "watched")
    .order("slug")
    .limit(BOARDS_READ_PER_STEP);
  if (after) query = query.gt("slug", after);
  const { data: boards, error } = await query;
  if (error) throw new Error(`Could not load the watched boards: ${error.message}`);

  const now = new Date();
  const toRead = boards.filter((board) => !isBlockedCompany(board.company ?? "", settings.blockedCompanies));
  const reads = await mapConcurrently(toRead, CONCURRENT_REQUESTS, async (board) => {
    try {
      return { board, jobs: await BOARD_READERS[provider](board.slug) };
    } catch {
      // Read again tomorrow.
      return { board, jobs: undefined };
    }
  });
  await saveBoards(reads.flatMap(({ board, jobs }) => (jobs === undefined ? [] : [boardAfterRead(board, jobs, now)])));

  const candidates = reads.flatMap(({ board, jobs }) => {
    const byKey = new Map<string, { slug: string; job: BoardJob; company: string; posted: number }>();
    for (const job of jobs ?? []) {
      const company = job.company ?? board.company ?? companyFromSlug(board.slug);
      const posted = job.postedAt ?? now.getTime();
      const recent = now.getTime() - posted < MAX_JOB_AGE_DAYS * DAY_MS;
      // Boards often post one role many times, once per place: it is read once.
      if (recent && isWatchable(job)) byKey.set(jobKey(company, job.title), { slug: board.slug, job, company, posted });
    }
    return [...byKey.entries()];
  });
  const saved = await savedFingerprints(candidates.map(([key]) => key));
  const perBoard = new Map<string, number>();
  const unsaved = candidates
    .filter(([key]) => !saved.has(key))
    .map(([, candidate]) => candidate)
    .sort((a, b) => b.posted - a.posted)
    .filter(({ slug }) => {
      perBoard.set(slug, (perBoard.get(slug) ?? 0) + 1);
      return (perBoard.get(slug) ?? 0) <= MAX_NEW_JOBS_PER_BOARD;
    });

  const listings = await mapConcurrently(unsaved, CONCURRENT_REQUESTS, async ({ job, company }) => {
    try {
      return await job.toListing(company, runId);
    } catch {
      // Not saved, so tried again tomorrow.
      return null;
    }
  });

  return {
    listings: listings.filter((listing): listing is Listing => listing !== null),
    after: boards.length === BOARDS_READ_PER_STEP ? boards[boards.length - 1].slug : undefined,
  };
}

/** Lever and Ashby do not name the company, so "acme-labs" is shown as "Acme Labs". */
export function companyFromSlug(slug: string): string {
  return slug
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** Checked by the duplicate key, so a job already saved from any source is not read again. */
async function savedFingerprints(fingerprints: string[]): Promise<Set<string>> {
  const saved = new Set<string>();
  for (let start = 0; start < fingerprints.length; start += FINGERPRINTS_PER_QUERY) {
    const { data, error } = await getAdminClient()
      .from("listings")
      .select("fingerprint")
      .in("fingerprint", fingerprints.slice(start, start + FINGERPRINTS_PER_QUERY));
    if (error) throw new Error(`Could not check which jobs are saved: ${error.message}`);
    for (const row of data) saved.add(row.fingerprint);
  }
  return saved;
}

// --- One format for board jobs ---

/** Longer than the 30 days jobs are read back, so a job is never saved twice. */
const BOARD_LISTING_DAYS = 45;
const NO_PAY = { salary_min: null, salary_max: null, salary_currency: null, salary_period: null };
const WORKPLACE_LABELS: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", "on-site": "On-site" };
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

type BoardListingFields = Pick<Listing, "source" | "source_id" | "url" | "title" | "company" | "countries" | "employment_type"> &
  Pick<Listing, "salary_min" | "salary_max" | "salary_currency" | "salary_period"> & {
    places: (string | null | undefined)[];
    description: string;
    postedAt: number;
  };

// These jobs are applied to on their board, and an address in a post is usually for something else
// (accessibility requests, privacy), so no email is written for them.
function boardListing({ places, description, postedAt, ...fields }: BoardListingFields, runId: string): Listing {
  const location = uniquePlaces(places).join("; ");
  const tags: string[] = [];
  if (/\bremote\b/i.test(location)) tags.push("remote");
  if (/contract/i.test(fields.employment_type ?? "")) tags.push("contractor");
  if (offersVisa(description)) tags.push("visa");
  return {
    ...fields,
    title: fields.title.trim(),
    location: location || null,
    seniority: [],
    categories: [],
    tags,
    description,
    fingerprint: jobKey(fields.company, fields.title),
    posted_at: new Date(postedAt).toISOString(),
    expires_at: new Date(postedAt + BOARD_LISTING_DAYS * DAY_MS).toISOString(),
    run_id: runId,
    contact_email: null,
  };
}

/** Each place once, whatever its capitals: "Home based" and "Home Based" are one. */
function uniquePlaces(places: (string | null | undefined)[]): string[] {
  const byKey = new Map<string, string>();
  for (const place of places) {
    const trimmed = place?.trim();
    if (trimmed && !byKey.has(trimmed.toLowerCase())) byKey.set(trimmed.toLowerCase(), trimmed);
  }
  return [...byKey.values()];
}

function workplaceLabel(type: string | null | undefined): string | null {
  return WORKPLACE_LABELS[(type ?? "").toLowerCase()] ?? null;
}

/** "US" becomes "United States", as Himalayas names countries. */
function countryName(country: string | null | undefined): string[] {
  if (!country) return [];
  return [/^[A-Z]{2}$/.test(country) ? (REGION_NAMES.of(country) ?? country) : country];
}

export function greenhouseListing(job: GreenhouseJob, slug: string, company: string, runId: string): Listing {
  return boardListing(
    {
      source: GREENHOUSE_SOURCE,
      source_id: greenhouseSourceId(slug, job.id),
      url: job.absolute_url,
      title: job.title,
      company,
      // The offices can name the region a location of just "Remote" hides: "Remote US".
      places: [job.location?.name, ...job.offices.map((office) => office.name)],
      countries: [],
      employment_type: null,
      ...NO_PAY,
      // The post's tags arrive entity-encoded, so it is decoded twice.
      description: htmlToText(htmlToText(job.content)),
      postedAt: job.first_published ? Date.parse(job.first_published) : Date.now(),
    },
    runId,
  );
}

function leverPlaces(posting: LeverPosting): string[] {
  const { location, allLocations } = posting.categories;
  return uniquePlaces([workplaceLabel(posting.workplaceType), ...(allLocations?.length ? allLocations : [location])]);
}

const LEVER_PAY_PERIODS: Record<string, Listing["salary_period"]> = {
  "per-year-salary": "year",
  "per-month-salary": "month",
  "per-hour-wage": "hour",
};

export function leverListing(posting: LeverPosting, company: string, runId: string): Listing {
  const pay = posting.salaryRange;
  const sections = [posting.descriptionPlain, ...posting.lists.map((list) => `${list.text}\n${htmlToText(list.content)}`), posting.additionalPlain];
  return boardListing(
    {
      source: LEVER_SOURCE,
      source_id: posting.id,
      url: posting.hostedUrl,
      title: posting.text,
      company,
      places: leverPlaces(posting),
      countries: countryName(posting.country),
      employment_type: posting.categories.commitment ?? null,
      salary_min: pay?.min ?? null,
      salary_max: pay?.max ?? null,
      salary_currency: pay?.currency ?? null,
      salary_period: LEVER_PAY_PERIODS[pay?.interval ?? ""] ?? null,
      description: sections.map((section) => section.trim()).filter(Boolean).join("\n\n"),
      postedAt: posting.createdAt,
    },
    runId,
  );
}

// workplaceType wins over isRemote, which is true for hybrid jobs too.
function ashbyPlaces(job: AshbyJob): string[] {
  const workModel = job.workplaceType ?? (job.isRemote ? "remote" : null);
  return uniquePlaces([workplaceLabel(workModel), job.location, ...job.secondaryLocations.map((place) => place.location)]);
}

// Ported from: https://github.com/career-ops-hq/career-ops/blob/6caf821f1b852f27a63b297484617784c47b8b2a/providers/ashby.mjs (MIT)
// Taken: pay is read from the tiers' Salary components, the widest range first. Left out: equity and bonus
// components, intervals a listing's pay cannot hold, and turning pay into a yearly figure.
const ASHBY_PAY_PERIODS: Record<string, Listing["salary_period"]> = { "1 YEAR": "year", "1 MONTH": "month", "1 HOUR": "hour" };

export function ashbyPay(job: AshbyJob): Pick<Listing, "salary_min" | "salary_max" | "salary_currency" | "salary_period"> {
  const span = (component: AshbyCompensationComponent) =>
    (component.maxValue ?? component.minValue ?? 0) - (component.minValue ?? component.maxValue ?? 0);
  const widest = (job.compensation?.compensationTiers ?? [])
    .flatMap((tier) => tier.components)
    .filter((component) => component.compensationType === "Salary" && ASHBY_PAY_PERIODS[component.interval ?? ""])
    .filter((component) => component.minValue != null || component.maxValue != null)
    .sort((a, b) => span(b) - span(a))[0];
  if (!widest) return NO_PAY;
  return {
    salary_min: widest.minValue ?? null,
    salary_max: widest.maxValue ?? null,
    salary_currency: widest.currencyCode ?? null,
    salary_period: ASHBY_PAY_PERIODS[widest.interval ?? ""],
  };
}

export function ashbyListing(job: AshbyJob, company: string, runId: string): Listing {
  return boardListing(
    {
      source: ASHBY_SOURCE,
      source_id: job.id,
      url: job.jobUrl,
      title: job.title,
      company,
      places: ashbyPlaces(job),
      countries: countryName(job.address?.postalAddress?.addressCountry),
      employment_type: job.employmentType ?? null,
      ...ashbyPay(job),
      description: job.descriptionPlain ?? htmlToText(job.descriptionHtml ?? ""),
      postedAt: Date.parse(job.publishedAt),
    },
    runId,
  );
}
