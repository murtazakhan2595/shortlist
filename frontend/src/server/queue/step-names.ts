// The name of every queued step. Shared, because features hand work to each other through the queue
// by step name and never import each other's code (AGENTS.md, Architecture rule 5).
// Each name's handler is registered in app/api/worker/step-handlers.ts.

export const STEP_NAMES = {
  /** captures: read a captured post (item 2.1). */
  extractCapture: "extract_capture",
  /** applications: start the application for a capture with an email (item 2.2). */
  prepareEmailApplication: "prepare_email_application",
  /** applications: start the email or note for a listing in its night's top N (items 4.6, 7.4). */
  prepareListingApplication: "prepare_listing_application",
  /** applications: run the next stage of the writer's loop (item 2.2). */
  advanceWriter: "advance_writer",
  /** applications: save a ready application as a Gmail draft with its CV (item 2.3). */
  createGmailDraft: "create_gmail_draft",
  /** forms: list the questions on pages the owner added (item 3.1). */
  readForm: "read_form",
  /** forms: answer the questions not answered yet (items 3.2, 3.3). */
  answerForm: "answer_form",
  /** forms: check the new answers against the profile (item 3.2). */
  checkFormAnswers: "check_form_answers",
  /** discovery: fetch, filter and save one source's new listings, then queue the next source; queued by start_daily_run (items 4.1 to 4.5). */
  fetchListings: "fetch_listings",
  /** discovery: score one kept listing against the profile (item 4.4). */
  scoreListing: "score_listing",
  /** discovery: keep the run's top listings once all are scored, and finish the run (item 4.4). */
  selectTopListings: "select_top_listings",
} as const;
