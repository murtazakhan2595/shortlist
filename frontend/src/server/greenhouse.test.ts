import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fetchGreenhouseBoard } from "./greenhouse";

const fetchMock = vi.fn();

beforeEach(() => vi.stubGlobal("fetch", fetchMock));

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

test("reads a board's list of jobs, titles only, and says who is asking", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      jobs: [{ id: 1, title: "Backend Engineer", company_name: "Acme", location: { name: "Remote" }, absolute_url: "https://x" }],
      meta: { total: 1 },
    }),
  );

  expect(await fetchGreenhouseBoard("acme")).toEqual([
    { id: 1, title: "Backend Engineer", company_name: "Acme", location: { name: "Remote" } },
  ]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs");
  expect(init.headers["User-Agent"]).toContain("shortlist");
});

test("a board that no longer exists reads as null", async () => {
  fetchMock.mockResolvedValue(new Response("Not found", { status: 404 }));

  expect(await fetchGreenhouseBoard("gone")).toBeNull();
});

test("any other error fails, so the board is tried again", async () => {
  fetchMock.mockResolvedValue(new Response("Busy", { status: 503 }));

  await expect(fetchGreenhouseBoard("acme")).rejects.toThrow("Greenhouse answered 503 for board acme");
});
