export type ErrorCode = "unauthorized" | "invalid_input" | "not_found" | "conflict" | "internal";

export type ResultError = { code: ErrorCode; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: ResultError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}
