import { advanceWriter, prepareEmailApplication } from "@/features/applications/steps/writer-steps";
import { extractCapture } from "@/features/captures/steps/extract-capture";
import { QUEUE_CHECK_STEP, runQueueCheck } from "@/server/queue/queue-check";
import type { StepHandlers } from "@/server/queue/run-next-step";
import { STEP_NAMES } from "@/server/queue/step-names";

// Every step the worker can run, by name. Features add their steps here as they are built.
export const STEP_HANDLERS: StepHandlers = {
  [QUEUE_CHECK_STEP]: runQueueCheck,
  [STEP_NAMES.extractCapture]: extractCapture,
  [STEP_NAMES.prepareEmailApplication]: prepareEmailApplication,
  [STEP_NAMES.advanceWriter]: advanceWriter,
};
