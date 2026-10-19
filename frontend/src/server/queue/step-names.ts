// The name of every queued step. Shared, because features hand work to each other through the queue
// by step name and never import each other's code (AGENTS.md, Architecture rule 5).
// Each name's handler is registered in app/api/worker/step-handlers.ts.

export const STEP_NAMES = {
  /** captures: read a captured post (item 2.1). */
  extractCapture: "extract_capture",
  /** applications: start the application for a capture with an email (item 2.2). */
  prepareEmailApplication: "prepare_email_application",
  /** applications: run the next stage of the writer's loop (item 2.2). */
  advanceWriter: "advance_writer",
  /** applications: save a ready application as a Gmail draft with its CV (item 2.3). */
  createGmailDraft: "create_gmail_draft",
} as const;
