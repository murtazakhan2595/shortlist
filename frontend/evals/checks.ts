import type { EvalCheck } from "./check";
import { E1_SCREENSHOT, E1_TEXT } from "./extraction";
import { E4_WRITER } from "./writer";

// Every quality check that runs as code, by id (REQUIREMENTS.md section 7): E1 for extraction (item 2.1)
// and E4 for the writer (2.2). The others are checked by hand: E3 on a sample of drafts, E2 from the owner's
// Apply and Skip marks on the Jobs page (4.7), and E5 by the owner testing forms live (decided 20 October 2026).
export const EVAL_CHECKS: Record<string, EvalCheck<unknown, unknown>> = {
  [E1_TEXT.id]: E1_TEXT as EvalCheck<unknown, unknown>,
  [E1_SCREENSHOT.id]: E1_SCREENSHOT as EvalCheck<unknown, unknown>,
  [E4_WRITER.id]: E4_WRITER as EvalCheck<unknown, unknown>,
};
