const MAX_ERROR_LENGTH = 1_000;

/** A short, storable description of any thrown value, e.g. "TimeoutError: The operation timed out." */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}
