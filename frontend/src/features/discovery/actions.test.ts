import { beforeEach, expect, test, vi } from "vitest";
import { blockCompany } from "./actions";

// The database is faked, so tests never write the owner's real settings and listings.
const db = vi.hoisted(() => ({
  listing: { company: "KDCI", run_id: "run-1" } as { company: string; run_id: string | null } | null,
  blocked: ["micro1"],
  night: [] as { id: string; company: string; label: string | null }[],
  writes: [] as { table: string; values: unknown; filter: unknown }[],
}));
vi.mock("@/server/auth/require-owner", () => ({
  requireOwner: async () => ({
    db: {
      from: (table: string) => ({
        select: () => ({
          single: async () => ({ data: { blocked_companies: db.blocked }, error: null }),
          eq: (column: string) => {
            // The night's listings are read by run; the one listing by its id.
            if (column === "run_id") return Promise.resolve({ data: db.night, error: null });
            return { maybeSingle: async () => ({ data: db.listing, error: null }) };
          },
        }),
        update: (values: unknown) => ({
          eq: async (column: string, value: unknown) => {
            db.writes.push({ table, values, filter: [column, value] });
            return { error: null };
          },
          in: async (column: string, ids: string[]) => {
            db.writes.push({ table, values, filter: [column, ids] });
            return { error: null };
          },
        }),
      }),
    },
  }),
}));

const LISTING_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  db.listing = { company: "KDCI", run_id: "run-1" };
  db.blocked = ["micro1"];
  db.night = [
    { id: "kdci-1", company: "KDCI", label: null },
    { id: "kdci-2", company: "kdci.", label: "skip" },
    { id: "kdci-applied", company: "KDCI", label: "apply" },
    { id: "acme", company: "Acme", label: null },
  ];
  db.writes.length = 0;
});

test("adds the company to the blocked ones, and drops its other jobs from the night's list except one marked apply", async () => {
  const result = await blockCompany({ listingId: LISTING_ID });

  expect(result).toEqual({ ok: true, data: { company: "KDCI", listingsDropped: 2 } });
  expect(db.writes).toEqual([
    { table: "settings", values: { blocked_companies: ["micro1", "KDCI"] }, filter: ["id", true] },
    {
      table: "listings",
      values: { eligibility: "excluded", eligibility_reason: "A company you blocked" },
      filter: ["id", ["kdci-1", "kdci-2"]],
    },
  ]);
});

test("a company already blocked is not added twice", async () => {
  db.blocked = ["micro1", "kdci"];

  await blockCompany({ listingId: LISTING_ID });

  expect(db.writes.map((write) => write.table)).toEqual(["listings"]);
});

test("a job no longer listed blocks nothing", async () => {
  db.listing = null;

  const result = await blockCompany({ listingId: LISTING_ID });

  expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
  expect(db.writes).toEqual([]);
});
