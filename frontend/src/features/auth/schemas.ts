import { z } from "zod";
import type { Result } from "@/lib/result";

// Email and password only: a magic link would open in the browser instead of the installed app.
//
// Server Actions:
//   signIn(SignInState, FormData) -> SignInState   (redirects home on success)
//   signOut()                     -> redirects to the sign-in page

export const SignInInputSchema = z.object({
  email: z.email("Enter your email address"),
  password: z.string().min(1, "Enter your password").max(200),
});
export type SignInInput = z.infer<typeof SignInInputSchema>;

/** The form's state: null before the first attempt, then the failure. Success redirects instead. */
export type SignInState = Result<never> | null;
