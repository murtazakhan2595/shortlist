import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/server/env";

/**
 * True when the request carries the internal API secret, as Supabase's calls to the worker do.
 * Compared in constant time, so the secret cannot be guessed from response times.
 */
export function isInternalCaller(request: Request): boolean {
  const secret = getServerEnv().INTERNAL_API_SECRET;
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
