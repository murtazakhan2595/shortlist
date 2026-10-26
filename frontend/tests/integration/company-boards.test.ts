import { randomUUID } from "node:crypto";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { addBoardsFromListings, checkBoards, loadBoardLists } from "@/features/discovery/steps/check-boards";
import { fetchGreenhouseBoard } from "@/server/greenhouse";
import { getAdminClient } from "@/server/supabase/admin";

// The SQL rules are tested in supabase/tests/database/company-boards.test.sql.
vi.mock("@/server/greenhouse", () => ({ fetchGreenhouseBoard: vi.fn() }));
const readBoard = vi.mocked(fetchGreenhouseBoard);

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
}));

const database = getAdminClient();
const prefix = `test-${randomUUID()}`;

afterEach(() => {
  vi.restoreAllMocks();
  readBoard.mockReset();
  queued.length = 0;
});

afterAll(async () => {
  await database.from("company_boards").delete().like("slug", `${prefix}%`);
});

// The real boards waiting to be checked are never touched: the step is handed the test boards instead.
function checkOnly(slugs: string[]) {
  const testBoards = slugs.map((slug) => ({ provider: "greenhouse", slug, status: "unchecked", company: null, matched_at: null }));
  const realRpc = database.rpc.bind(database);
  const rpc = (name: string, args: unknown) =>
    name === "boards_to_check" ? Promise.resolve({ data: testBoards, error: null }) : realRpc(name as never, args as never);
  vi.spyOn(database, "rpc").mockImplementation(rpc as never);
}

async function boards(slugs: string[], provider = "greenhouse") {
  const { data } = await database
    .from("company_boards")
    .select("slug, status, company, next_check_at")
    .eq("provider", provider)
    .in("slug", slugs)
    .order("slug");
  return data;
}

test("sorts each board, and is safe to run twice", async () => {
  const [watched, idle, gone] = ["a-watched", "b-idle", "c-gone"].map((name) => `${prefix}-${name}`);
  checkOnly([watched, idle, gone]);
  readBoard.mockImplementation(async (slug) => {
    if (slug === gone) return null;
    const location = slug === watched ? "Remote" : "Remote - US";
    return [{ id: 1, title: "Backend Engineer", company_name: "Acme", location: { name: location } }];
  });

  await checkBoards({});
  await checkBoards({});

  expect(await boards([watched, idle, gone])).toMatchObject([
    { slug: watched, status: "watched", company: "Acme", next_check_at: null },
    { slug: idle, status: "idle", company: "Acme" },
    { slug: gone, status: "gone", next_check_at: null },
  ]);
  // Fewer than a full step's boards: nothing was left for another step.
  expect(queued).toEqual([]);
});

test("a full step queues the next one, counting the boards checked so far", async () => {
  checkOnly(Array.from({ length: 100 }, (_, index) => `${prefix}-full-${index}`));
  readBoard.mockResolvedValue([]);

  await checkBoards({ checked: 200 });

  expect(queued).toEqual([{ step: "check_boards", payload: { checked: 300 } }]);
});

test("adds new boards from the lists without changing those already checked", async () => {
  const listed = `${prefix}-listed`;
  const known = `${prefix}-known`;
  await database.from("company_boards").insert({ provider: "lever", slug: known, status: "idle", next_check_at: null });
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) =>
    String(input).includes("Feashliaa") ? Response.json([listed.toUpperCase(), known]) : realFetch(input, init),
  );

  await loadBoardLists();

  expect(await boards([listed, known], "lever")).toMatchObject([
    { slug: known, status: "idle", next_check_at: null },
    { slug: listed, status: "unchecked" },
  ]);
  expect(queued).toEqual([{ step: "check_boards", payload: {} }]);
});

test("adds the boards that kept listings link to", async () => {
  const linked = `${prefix}-linked`;

  await addBoardsFromListings([
    { url: "https://news.ycombinator.com/item?id=1", description: `Apply at https://jobs.ashbyhq.com/${linked}/123` },
  ]);

  expect(await boards([linked], "ashby")).toMatchObject([{ slug: linked, status: "unchecked" }]);
});
