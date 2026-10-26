import "server-only";
import { z } from "zod";
import { mapConcurrently } from "@/lib/concurrency";
import { fetchGreenhouseBoard } from "@/server/greenhouse";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json, Tables, TablesInsert } from "@/server/supabase/database.types";
import type { Listing } from "../schemas";
import { isOpenRemoteLocation, isTitleAboveRange, TECHNICAL_TITLE } from "./eligibility";

// The company watchlist, kept by code with no model call. Every night load_board_lists adds new boards from
// Feashliaa's lists, then check_boards reads the boards that are due, titles only, and marks each one watched
// (a remote developer job open to the owner's country), idle (none, so read again in a month) or gone.

export const BOARD_PROVIDERS = ["greenhouse", "lever", "ashby"] as const;
export type BoardProvider = (typeof BOARD_PROVIDERS)[number];

type Board = Pick<Tables<"company_boards">, "provider" | "slug" | "status" | "company" | "matched_at">;
type BoardJob = { title: string; location: string; company: string | null };

// Lever and Ashby boards stay unchecked until they have a reader.
const BOARD_READERS: Partial<Record<BoardProvider, (slug: string) => Promise<BoardJob[] | null>>> = {
  greenhouse: async (slug) => {
    const jobs = await fetchGreenhouseBoard(slug);
    return jobs?.map((job) => ({ title: job.title, location: job.location?.name ?? "", company: job.company_name ?? null })) ?? null;
  },
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
  const results = await mapConcurrently(boards, CONCURRENT_REQUESTS, (board) => checkBoard(board, now));
  if (results.length > 0) {
    const saved = await getAdminClient().from("company_boards").upsert(results, { onConflict: "provider,slug" });
    if (saved.error) throw new Error(`Could not save the board checks: ${saved.error.message}`);
  }

  const total = checked + boards.length;
  if (boards.length === BOARDS_PER_STEP && total < MAX_CHECKS_PER_NIGHT) {
    await enqueueStep(STEP_NAMES.checkBoards, { checked: total });
  }
}

// Every result has the same columns, as one upsert saves them all.
export async function checkBoard(board: Board, now: Date): Promise<TablesInsert<"company_boards">> {
  const checked = { ...board, checked_at: now.toISOString() };
  try {
    const read = BOARD_READERS[board.provider as BoardProvider];
    if (!read) throw new Error(`No reader for ${board.provider} boards`);
    const jobs = await read(board.slug);
    if (!jobs) return { ...checked, status: "gone", next_check_at: null };

    const company = jobs.find((job) => job.company)?.company ?? board.company;
    if (jobs.some(isWatchable)) return { ...checked, company, status: "watched", next_check_at: null, matched_at: checked.checked_at };
    return { ...checked, company, status: "idle", next_check_at: daysFrom(now, IDLE_RECHECK_DAYS) };
  } catch {
    // A timeout or an error from the provider: the board keeps its status and is tried again tomorrow.
    return { ...checked, next_check_at: daysFrom(now, 1) };
  }
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
