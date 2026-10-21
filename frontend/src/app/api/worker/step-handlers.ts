import { createGmailDraft } from "@/features/applications/steps/gmail-draft";
import { advanceWriter, prepareEmailApplication, prepareNoteApplication } from "@/features/applications/steps/writer-steps";
import { extractCapture } from "@/features/captures/steps/extract-capture";
import { fetchListings } from "@/features/discovery/steps/fetch-listings";
import { scoreListing, selectTopListings } from "@/features/discovery/steps/score-listings";
import { answerForm, checkFormAnswers } from "@/features/forms/steps/answer-form";
import { readForm } from "@/features/forms/steps/read-form";
import { QUEUE_CHECK_STEP, runQueueCheck } from "@/server/queue/queue-check";
import type { StepHandlers } from "@/server/queue/run-next-step";
import { STEP_NAMES } from "@/server/queue/step-names";

// Every step the worker can run, by name. Features add their steps here as they are built.
export const STEP_HANDLERS: StepHandlers = {
  [QUEUE_CHECK_STEP]: runQueueCheck,
  [STEP_NAMES.extractCapture]: extractCapture,
  [STEP_NAMES.prepareEmailApplication]: prepareEmailApplication,
  [STEP_NAMES.prepareNoteApplication]: prepareNoteApplication,
  [STEP_NAMES.advanceWriter]: advanceWriter,
  [STEP_NAMES.createGmailDraft]: createGmailDraft,
  [STEP_NAMES.readForm]: readForm,
  [STEP_NAMES.answerForm]: answerForm,
  [STEP_NAMES.checkFormAnswers]: checkFormAnswers,
  [STEP_NAMES.fetchListings]: fetchListings,
  [STEP_NAMES.scoreListing]: scoreListing,
  [STEP_NAMES.selectTopListings]: selectTopListings,
};
