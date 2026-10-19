import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { isOwner, signedInUserId } from "@/server/auth/require-owner";
import { getAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/server/supabase/database.types";
import { getServerEnv } from "@/server/env";

// Who counts as the owner (U6, principle 5), against the real Supabase project.
// The owner's own account is never used here; the owner case is covered by supabase/tests/database/access.test.sql.

function browserLikeClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("owner access", () => {
  const stranger = { email: `stranger-${randomUUID()}@example.test`, password: randomUUID() };
  let strangerId: string;

  beforeAll(async () => {
    const { data, error } = await getAdminClient().auth.admin.createUser({ ...stranger, email_confirm: true });
    if (error) throw error;
    strangerId = data.user.id;
  });

  afterAll(async () => {
    await getAdminClient().auth.admin.deleteUser(strangerId);
  });

  test("nobody can sign up: the owner's is the only account (principle 5)", async () => {
    const { error } = await browserLikeClient().auth.signUp({
      email: `sign-up-${randomUUID()}@example.test`,
      password: randomUUID(),
    });

    expect(error?.message).toMatch(/signups not allowed/i);
  });

  test("a visitor who is not signed in is not the owner", async () => {
    const visitor = browserLikeClient();

    expect(await signedInUserId(visitor)).toBeUndefined();
    expect(await isOwner(visitor)).toBe(false);
  });

  test("a signed-in account that is not the owner's is not the owner", async () => {
    const client = browserLikeClient();
    const { error } = await client.auth.signInWithPassword(stranger);
    if (error) throw error;

    expect(await signedInUserId(client)).toBe(strangerId);
    expect(await isOwner(client)).toBe(false);
  });
});
