import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerClient, type ServerClient } from "@/server/supabase/server";

/** db acts as the signed-in owner. */
export type Owner = { userId: string; db: ServerClient };

export class NotOwnerError extends Error {
  constructor() {
    super("Signed in, but not as the owner");
    this.name = "NotOwnerError";
  }
}

// The only way owner code gets a database client, so no read or write can skip the check.
// cache() runs it once per page render; each Server Action call runs it afresh.
export const requireOwner = cache(async (): Promise<Owner> => {
  const db = await getServerClient();
  const userId = await signedInUserId(db);
  if (!userId) redirect("/sign-in");

  if (!(await isOwner(db))) throw new NotOwnerError();
  return { userId, db };
});

// getClaims() verifies the session's signature, unlike getSession().
export async function signedInUserId(db: ServerClient): Promise<string | undefined> {
  const { data } = await db.auth.getClaims();
  return data?.claims.sub;
}

// The settings row is visible only to settings.owner_user_id, so this uses the rule that guards every table.
export async function isOwner(db: ServerClient): Promise<boolean> {
  const { data, error } = await db.from("settings").select("id").maybeSingle();
  if (error) throw new Error(`Could not check the owner: ${error.message}`);
  return data !== null;
}
