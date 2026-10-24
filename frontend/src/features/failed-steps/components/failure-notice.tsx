import type { OpenFailure } from "@/server/queue/failed-steps";
import { STEP_NAMES } from "@/server/queue/step-names";
import { FailureActions } from "./failure-actions";

// What each step was doing, in the owner's words.
const DOING: Record<string, string> = {
  [STEP_NAMES.extractCapture]: "Reading the post",
  [STEP_NAMES.prepareEmailApplication]: "Starting the email",
  [STEP_NAMES.advanceWriter]: "Writing the draft",
  [STEP_NAMES.createGmailDraft]: "Saving the draft to Gmail",
  [STEP_NAMES.prepareListingApplication]: "Starting the application",
  [STEP_NAMES.readForm]: "Reading the form's pages",
  [STEP_NAMES.answerForm]: "Answering the questions",
  [STEP_NAMES.checkFormAnswers]: "Checking the answers",
  [STEP_NAMES.fetchListings]: "Fetching new jobs",
  [STEP_NAMES.scoreListing]: "Scoring a job",
  [STEP_NAMES.selectTopListings]: "Choosing the night's list",
};

const FAILED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});

/**
 * A step that failed every attempt: what it was doing, why it failed, and buttons to try it again or
 * dismiss it. With href, also a link to the page of what it was working on.
 */
export function FailureNotice({ failure, href }: { failure: OpenFailure; href?: string }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-danger p-4">
      <p className="font-semibold text-danger">{DOING[failure.step] ?? failure.step} failed</p>
      <p className="text-sm text-ink-muted">
        Stopped after its last retry, at {FAILED_AT.format(new Date(failure.failedAt))}:{" "}
        <span className="break-words">{failure.error}</span>
      </p>
      <FailureActions failedStepId={failure.id} href={href} />
    </div>
  );
}
