import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchGreenhouseBoard, type GreenhouseBoardJob } from "@/server/greenhouse";
import { boardAfterRead, boardLinksIn, checkBoard, isWatchable } from "./company-boards";

vi.mock("@/server/greenhouse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/greenhouse")>()),
  fetchGreenhouseBoard: vi.fn(),
}));
const readBoard = vi.mocked(fetchGreenhouseBoard);

afterEach(() => readBoard.mockReset());

const NOW = new Date("2026-10-26T20:00:00Z");
const BOARD = { provider: "greenhouse", slug: "acme", status: "unchecked", company: null, matched_at: null };

function job(title: string, location: string): GreenhouseBoardJob {
  return { id: 1, title, company_name: "Acme", location: { name: location } };
}

describe("a board is watched when it has a remote developer job open to Pakistan", () => {
  test("watched", async () => {
    readBoard.mockResolvedValue([job("Sales Manager", "Remote"), job("Senior Backend Engineer", "Remote")]);

    expect(await checkBoard(BOARD, NOW)).toEqual({
      ...BOARD,
      company: "Acme",
      status: "watched",
      checked_at: NOW.toISOString(),
      matched_at: NOW.toISOString(),
      next_check_at: null,
    });
  });

  test("idle, and read again in a month, when its remote jobs are limited to a region", async () => {
    readBoard.mockResolvedValue([job("Software Engineer", "Remote - United States"), job("Engineer", "London")]);

    expect(await checkBoard(BOARD, NOW)).toMatchObject({ status: "idle", next_check_at: "2026-11-25T20:00:00.000Z" });
  });

  test("gone when the board no longer exists", async () => {
    readBoard.mockResolvedValue(null);

    expect(await checkBoard(BOARD, NOW)).toMatchObject({ status: "gone", next_check_at: null });
  });

  test("an error keeps its status and tries again tomorrow", async () => {
    readBoard.mockRejectedValue(new Error("Greenhouse answered 503 for board acme"));

    expect(await checkBoard({ ...BOARD, status: "idle", company: "Acme" }, NOW)).toEqual({
      ...BOARD,
      status: "idle",
      company: "Acme",
      checked_at: NOW.toISOString(),
      next_check_at: "2026-10-27T20:00:00.000Z",
    });
  });

  test("a provider with no reader yet is left for later", async () => {
    expect(await checkBoard({ ...BOARD, provider: "lever" }, NOW)).toMatchObject({ status: "unchecked" });
  });
});

describe("a watched board read at night with no such job", () => {
  const watched = { ...BOARD, status: "watched", matched_at: "2026-10-10T20:00:00Z" };

  test("stays watched within 30 days of its last match", () => {
    expect(boardAfterRead(watched, [], NOW)).toMatchObject({ status: "watched", next_check_at: null, matched_at: watched.matched_at });
  });

  test("goes back to idle after 30 days", () => {
    expect(boardAfterRead({ ...watched, matched_at: "2026-09-20T20:00:00Z" }, [], NOW)).toMatchObject({
      status: "idle",
      next_check_at: "2026-11-25T20:00:00.000Z",
    });
  });
});

test("a watchable job is a developer role, below lead, remote and open to Pakistan", () => {
  expect(isWatchable({ title: "Full Stack Developer", location: "Remote", company: null })).toBe(true);
  expect(isWatchable({ title: "Staff Engineer", location: "Remote", company: null })).toBe(false);
  expect(isWatchable({ title: "Account Executive", location: "Remote", company: null })).toBe(false);
  expect(isWatchable({ title: "Frontend Engineer", location: "Remote - Canada", company: null })).toBe(false);
});

test("finds the boards a post links to, once each", () => {
  const post = `Apply: https://jobs.ashbyhq.com/Northwind?utm_source=hn or https://jobs.ashbyhq.com/northwind/123.
    Also https://job-boards.greenhouse.io/globex/jobs/55, https://boards.greenhouse.io/embed/job_board?for=umbrella
    and https://jobs.lever.co/initech/46e0dd2f. See https://example.com/careers.`;

  expect(boardLinksIn(post)).toEqual([
    { provider: "greenhouse", slug: "globex" },
    { provider: "greenhouse", slug: "umbrella" },
    { provider: "lever", slug: "initech" },
    { provider: "ashby", slug: "northwind" },
  ]);
});
