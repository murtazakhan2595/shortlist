import type { EvalCheck } from "./check";
import { E1_SCREENSHOT, E1_TEXT } from "./extraction";
import { E4_WRITER } from "./writer";

// Quality checks that run as code: E1 for extraction and E4 for the writer. The others are checked by hand:
// E3 on a sample of drafts, E2 from Apply and Skip marks on the Jobs page, and E5 by testing forms live.
export const EVAL_CHECKS: Record<string, EvalCheck<unknown, unknown>> = {
  [E1_TEXT.id]: E1_TEXT as EvalCheck<unknown, unknown>,
  [E1_SCREENSHOT.id]: E1_SCREENSHOT as EvalCheck<unknown, unknown>,
  [E4_WRITER.id]: E4_WRITER as EvalCheck<unknown, unknown>,
};
