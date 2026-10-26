import "server-only";
import { z } from "zod";
import { mapConcurrently } from "@/lib/concurrency";
import { fetchGreenhouseBoard, fetchGreenhouseJob, type GreenhouseBoardJob, type GreenhouseJob } from "@/server/greenhouse";
import { jobKey } from "@/server/job-key";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json, Tables, TablesInsert } from "@/server/supabase/database.types";
import type { Listing } from "../schemas";
import { type FilterSettings, isBlockedCompany, isOpenRemoteLocation, isTitleAboveRange, TECHNICAL_TITLE } from "./eligibility";

// Company job boards, kept by code with no model call. Every night load_board_lists adds new boards from
// Feashliaa's lists, then check_boards reads the boards that are due, titles only, and marks each one watched
// (a remote developer job open to the owner's country), idle (none, so read again in a month) or gone.
// The nightly run then reads the watched boards for new jobs (readWatchedGreenhouseBoards).

export const BOARD_PROVIDERS = ["greenhouse", "lever", "ashby"] as const;
export type BoardProvider = (typeof BOARD_PROVIDERS)[number];

type Board = Pick<Tables<"company_boards">, "provider" | "slug" | "status" | "company" | "matched_at">;
type BoardRow = TablesInsert<"company_boards">;
type BoardJob = { title: string; location: string; company: string | null };

function greenhouseBoardJob(job: GreenhouseBoardJob): BoardJob {
  return { title: job.title, location: job.location?.name ?? "", company: job.company_name ?? null };
}

// Lever and Ashby boards stay unchecked until they have a reader.
const BOARD_READERS: Partial<Record<BoardProvider, (slug: string) => Promise<BoardJob[] | null>>> = {
  greenhouse: async (slug) => (await fetchGreenhouseBoard(slug))?.map(greenhouseBoardJob) ?? null,
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
    providers: Object.keys(BOARD_READERS),
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
    if (!read) throw new Error(`No reader for ${board.provider} boards`);
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
export function isWatchable(job: BoardJob): boolean {
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
/** Older jobs are left out: a board newly watched brings only its recent ones. */
const MAX_JOB_AGE_DAYS = 30;
// Some boards have hundreds of recent jobs: the newest are read first, the rest on later nights.
const MAX_NEW_JOBS_PER_BOARD = 20;
const FINGERPRINTS_PER_QUERY = 200;

/**
 * The new jobs on the next watched Greenhouse boards after `after`, in slug order, with their full posts, and
 * the slug to go on from while boards are left. Boards of blocked companies are skipped; each board read is
 * saved, so a board that no longer has such a job goes back to idle in time.
 */
export async function readWatchedGreenhouseBoards(
  after: string | undefined,
  settings: FilterSettings,
): Promise<{ jobs: { job: GreenhouseJob; company: string }[]; after?: string }> {
  let query = getAdminClient()
    .from("company_boards")
    .select("provider, slug, status, company, matched_at")
    .eq("provider", "greenhouse")
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
      return { board, jobs: await fetchGreenhouseBoard(board.slug) };
    } catch {
      // Read again tomorrow.
      return { board, jobs: undefined };
    }
  });
  await saveBoards(
    reads.flatMap(({ board, jobs }) => (jobs === undefined ? [] : [boardAfterRead(board, jobs?.map(greenhouseBoardJob) ?? null, now)])),
  );

  const candidates = reads.flatMap(({ board, jobs }) => {
    const byKey = new Map<string, { slug: string; job: GreenhouseBoardJob; company: string; posted: number }>();
    for (const job of jobs ?? []) {
      const company = job.company_name ?? board.company ?? board.slug;
      const posted = job.first_published ? Date.parse(job.first_published) : now.getTime();
      const recent = now.getTime() - posted < MAX_JOB_AGE_DAYS * DAY_MS;
      // Boards often post one role many times, once per place: it is read once.
      if (recent && isWatchable(greenhouseBoardJob(job))) byKey.set(jobKey(company, job.title), { slug: board.slug, job, company, posted });
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

  const full = await mapConcurrently(unsaved, CONCURRENT_REQUESTS, async ({ slug, job, company }) => {
    try {
      const post = await fetchGreenhouseJob(slug, job.id);
      return post ? [{ job: post, company }] : [];
    } catch {
      // Not saved, so tried again tomorrow.
      return [];
    }
  });

  return { jobs: full.flat(), after: boards.length === BOARDS_READ_PER_STEP ? boards[boards.length - 1].slug : undefined };
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
