import { EXTRACT_CAPTURE_STEP, extractCapture } from "@/features/captures/steps/extract-capture";
import { QUEUE_CHECK_STEP, runQueueCheck } from "@/server/queue/queue-check";
import type { StepHandlers } from "@/server/queue/run-next-step";

// Every step the worker can run, by name. Features add their steps here as they are built.
export const STEP_HANDLERS: StepHandlers = {
  [QUEUE_CHECK_STEP]: runQueueCheck,
  [EXTRACT_CAPTURE_STEP]: extractCapture,
};
