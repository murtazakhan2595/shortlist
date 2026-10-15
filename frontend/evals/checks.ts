import type { EvalCheck } from "./check";

// Every quality check, by id (REQUIREMENTS.md section 7). Each is added with the step it measures:
// E1 with extraction (item 2.1), E3 and E4 with the writer (2.2), E5 with form answers (3.2), E2 with scoring (4.4).
export const EVAL_CHECKS: Record<string, EvalCheck<unknown, unknown>> = {};
