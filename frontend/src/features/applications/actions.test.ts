import { beforeEach, expect, test, vi } from "vitest";
import { updateApplicationStatus } from "./actions";

// The action with the owner check and database replaced; it never writes a real application.
const db = vi.hoisted(() => ({
  calls: [] as string[],
  row: { sent_at: null as string | null } as { sent_at: string | null } | null,
}));
vi.mock("@/server/auth/require-owner", () => {
  function query(table: string, values: Record<string, unknown>) {
    const filters: string[] = [];
    const chain = {
      eq: (column: string, value: unknown) => (filters.push(`${column}=${value}`), chain),
      neq: (column: string, value: unknown) => (filters.push(`${column}!=${value}`), chain),
      is: (column: string, value: unknown) => (filters.push(`${column} is ${value}`), chain),
      select: () => chain,
      maybeSingle: async () => ({ data: db.row, error: null }),
      then: (resolve: (result: { error: null }) => void) => resolve({ error: null }),
    };
    db.calls.push(`${table} ${JSON.stringify(values)}`);
    return Object.assign(chain, { filters });
  }
  return { requireOwner: async () => ({ db: { from: (table: string) => ({ update: (values: Record<string, unknown>) => query(table, values) }) } }) };
});

const applicationId = "0f8fad5b-d9cb-469f-a165-70867728950e";

beforeEach(() => {
  db.calls.length = 0;
  db.row = { sent_at: null };
});

test("marking sent saves the status and, the first time, when it was sent", async () => {
  expect(await updateApplicationStatus({ applicationId, status: "sent" })).toEqual({ ok: true, data: { applicationId, status: "sent" } });

  expect(db.calls).toHaveLength(2);
  expect(db.calls[0]).toBe('applications {"status":"sent"}');
  expect(db.calls[1]).toMatch(/^applications \{"sent_at":"\d{4}-/);
});

test("skipping never records a send, and a send already recorded is kept", async () => {
  await updateApplicationStatus({ applicationId, status: "skipped" });
  db.row = { sent_at: "2026-10-20T10:00:00Z" };
  await updateApplicationStatus({ applicationId, status: "interview" });

  expect(db.calls).toEqual(['applications {"status":"skipped"}', 'applications {"status":"interview"}']);
});

test("an application still being prepared, or gone, is refused", async () => {
  db.row = null;

  expect(await updateApplicationStatus({ applicationId, status: "replied" })).toMatchObject({ ok: false, error: { code: "conflict" } });
});

test("only the four owner statuses are accepted", async () => {
  expect((await updateApplicationStatus({ applicationId, status: "ready" as "sent" })).ok).toBe(false);
  expect(db.calls).toEqual([]);
});
