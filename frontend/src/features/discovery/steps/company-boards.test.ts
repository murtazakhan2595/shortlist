import { afterEach, describe, expect, test, vi } from "vitest";
import type { AshbyJob } from "@/server/ashby";
import { fetchGreenhouseBoard, type GreenhouseBoardJob, type GreenhouseJob } from "@/server/greenhouse";
import { fetchLeverBoard, type LeverPosting } from "@/server/lever";
import {
  ashbyListing,
  boardAfterRead,
  boardLinksIn,
  checkBoard,
  companyFromSlug,
  greenhouseListing,
  isWatchable,
  leverListing,
} from "./company-boards";

vi.mock("@/server/greenhouse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/greenhouse")>()),
  fetchGreenhouseBoard: vi.fn(),
}));
vi.mock("@/server/lever", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/lever")>()),
  fetchLeverBoard: vi.fn(),
}));
const readBoard = vi.mocked(fetchGreenhouseBoard);
const readLeverBoard = vi.mocked(fetchLeverBoard);

afterEach(() => {
  readBoard.mockReset();
  readLeverBoard.mockReset();
});

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

  test("a Lever board is read the same way, its work model counting as a place", async () => {
    readLeverBoard.mockResolvedValue([{ ...POSTING, workplaceType: "remote", categories: { allLocations: ["Remote"] } }]);

    expect(await checkBoard({ ...BOARD, provider: "lever" }, NOW)).toMatchObject({ status: "watched" });
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
  expect(isWatchable({ title: "Full Stack Developer", location: "Remote" })).toBe(true);
  expect(isWatchable({ title: "Staff Engineer", location: "Remote" })).toBe(false);
  expect(isWatchable({ title: "Account Executive", location: "Remote" })).toBe(false);
  expect(isWatchable({ title: "Frontend Engineer", location: "Remote - Canada" })).toBe(false);
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

test("Lever and Ashby name no company, so it is made from the board's name", () => {
  expect(companyFromSlug("acme-labs")).toBe("Acme Labs");
  expect(companyFromSlug("globex")).toBe("Globex");
});

test("converts a Greenhouse job, with its offices as places and no email, whatever the post gives", () => {
  const job: GreenhouseJob = {
    id: 7,
    title: " Backend Engineer ",
    company_name: "Acme Inc",
    location: { name: "Remote" },
    first_published: "2026-10-20T10:00:00Z",
    absolute_url: "https://job-boards.greenhouse.io/acme/jobs/7",
    content: "&lt;p&gt;Build things &amp;amp; ship.&lt;/p&gt;&lt;p&gt;Questions: access@acme.com. We sponsor visas.&lt;/p&gt;",
    offices: [{ name: "Remote" }, { name: "Remote US" }],
  };

  expect(greenhouseListing(job, "Acme", "run-1")).toMatchObject({
    source: "greenhouse",
    source_id: "7",
    url: "https://job-boards.greenhouse.io/acme/jobs/7",
    title: "Backend Engineer",
    company: "Acme",
    location: "Remote; Remote US",
    tags: ["remote", "visa"],
    description: "Build things & ship.\nQuestions: access@acme.com. We sponsor visas.",
    fingerprint: "acme_backend-engineer",
    posted_at: "2026-10-20T10:00:00.000Z",
    expires_at: "2026-12-04T10:00:00.000Z",
    contact_email: null,
  });
});

const POSTING: LeverPosting = {
  id: "abc-123",
  text: "Full Stack Engineer",
  hostedUrl: "https://jobs.lever.co/acme/abc-123",
  createdAt: Date.parse("2026-10-20T10:00:00Z"),
  workplaceType: "remote",
  country: "US",
  categories: { location: "Remote", allLocations: ["Remote", "Toronto"], commitment: "Contract" },
  descriptionPlain: "Build our app.",
  lists: [{ text: "You have", content: "<li>React</li><li>Node</li>" }],
  additionalPlain: "Apply soon.",
  salaryRange: { min: 4000, max: 6000, currency: "USD", interval: "per-month-salary" },
};

test("converts a Lever posting, with its pay, its places and its country", () => {
  expect(leverListing(POSTING, "Acme", "run-1")).toMatchObject({
    source: "lever",
    source_id: "abc-123",
    url: "https://jobs.lever.co/acme/abc-123",
    location: "Remote; Toronto",
    countries: ["United States"],
    employment_type: "Contract",
    tags: ["remote", "contractor"],
    salary_min: 4000,
    salary_max: 6000,
    salary_currency: "USD",
    salary_period: "month",
    description: "Build our app.\n\nYou have\n- React\n- Node\n\nApply soon.",
    contact_email: null,
  });
});

const ASHBY_JOB: AshbyJob = {
  id: "job-9",
  title: "Backend Engineer",
  jobUrl: "https://jobs.ashbyhq.com/acme/job-9",
  publishedAt: "2026-10-20T10:00:00Z",
  isListed: true,
  workplaceType: "Hybrid",
  isRemote: true,
  location: "Berlin",
  secondaryLocations: [{ location: "Remote" }],
  address: { postalAddress: { addressCountry: "Germany" } },
  employmentType: "FullTime",
  descriptionPlain: "Build our API.",
  descriptionHtml: null,
  compensation: {
    compensationTiers: [
      {
        components: [
          { compensationType: "EquityPercentage", interval: "NONE", currencyCode: null, minValue: null, maxValue: null },
          { compensationType: "Salary", interval: "1 YEAR", currencyCode: "EUR", minValue: 60000, maxValue: 70000 },
          { compensationType: "Salary", interval: "1 YEAR", currencyCode: "EUR", minValue: 55000, maxValue: 80000 },
        ],
      },
    ],
  },
};

test("converts an Ashby job: its work model wins over isRemote, and the widest salary range is its pay", () => {
  expect(ashbyListing(ASHBY_JOB, "Acme", "run-1")).toMatchObject({
    source: "ashby",
    location: "Hybrid; Berlin; Remote",
    countries: ["Germany"],
    salary_min: 55000,
    salary_max: 80000,
    salary_currency: "EUR",
    salary_period: "year",
    description: "Build our API.",
  });
});

test("an Ashby job with no salary component has no pay", () => {
  expect(ashbyListing({ ...ASHBY_JOB, compensation: null }, "Acme", "run-1")).toMatchObject({
    salary_min: null,
    salary_period: null,
  });
});
