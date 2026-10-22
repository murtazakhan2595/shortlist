import { createGmailDraft } from "@/features/applications/steps/gmail-draft";
import { advanceWriter, prepareEmailApplication, prepareNoteApplication } from "@/features/applications/steps/writer-steps";
import { extractCapture } from "@/features/captures/steps/extract-capture";
import { fetchListings } from "@/features/discovery/steps/fetch-listings";
import { scoreListing, scoringGaveUp, selectTopListings } from "@/features/discovery/steps/score-listings";
import { answerForm, checkFormAnswers } from "@/features/forms/steps/answer-form";
import { readForm } from "@/features/forms/steps/read-form";
import { QUEUE_CHECK_STEP, runQueueCheck } from "@/server/queue/queue-check";
import type { StepHandlers } from "@/server/queue/run-next-step";
import { STEP_NAMES } from "@/server/queue/step-names";

// Every step the worker can run, by name, with what to do if it fails every attempt.
// Features add their steps here as they are built.
export const STEP_HANDLERS: StepHandlers = {
  [QUEUE_CHECK_STEP]: { run: runQueueCheck },
  [STEP_NAMES.extractCapture]: { run: extractCapture },
  [STEP_NAMES.prepareEmailApplication]: { run: prepareEmailApplication },
  [STEP_NAMES.prepareNoteApplication]: { run: prepareNoteApplication },
  [STEP_NAMES.advanceWriter]: { run: advanceWriter },
  [STEP_NAMES.createGmailDraft]: { run: createGmailDraft },
  [STEP_NAMES.readForm]: { run: readForm },
  [STEP_NAMES.answerForm]: { run: answerForm },
  [STEP_NAMES.checkFormAnswers]: { run: checkFormAnswers },
  [STEP_NAMES.fetchListings]: { run: fetchListings },
  [STEP_NAMES.scoreListing]: { run: scoreListing, giveUp: scoringGaveUp },
  [STEP_NAMES.selectTopListings]: { run: selectTopListings },
};
