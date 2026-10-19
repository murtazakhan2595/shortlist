"use server";

import { redirect } from "next/navigation";
import { fail } from "@/lib/result";
import { isOwner } from "@/server/auth/require-owner";
import { getServerClient } from "@/server/supabase/server";
import { SignInInputSchema, type SignInState } from "./schemas";

// The same message for every failure, so the form does not reveal which accounts exist.
const WRONG_DETAILS = "Wrong email or password";

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const input = SignInInputSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const db = await getServerClient();
  const { error } = await db.auth.signInWithPassword(input.data);
  if (error) return fail("unauthorized", WRONG_DETAILS);

  // Sign-ups are switched off, but an account that is not the owner's is never left signed in.
  if (!(await isOwner(db))) {
    await db.auth.signOut();
    return fail("unauthorized", WRONG_DETAILS);
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const db = await getServerClient();
  await db.auth.signOut();
  redirect("/sign-in");
}
