// Features hand work to each other by these names instead of importing each other's code.
// Handlers are registered in app/api/worker/step-handlers.ts.

export const STEP_NAMES = {
  extractCapture: "extract_capture",
  prepareEmailApplication: "prepare_email_application",
  prepareListingApplication: "prepare_listing_application",
  advanceWriter: "advance_writer",
  createGmailDraft: "create_gmail_draft",
  readForm: "read_form",
  answerForm: "answer_form",
  checkFormAnswers: "check_form_answers",
  /** Queued by start_daily_run; each source queues the next. */
  fetchListings: "fetch_listings",
  scoreListing: "score_listing",
  selectTopListings: "select_top_listings",
  /** Queued every night by the board-check schedule; queues check_boards. */
  loadBoardLists: "load_board_lists",
  checkBoards: "check_boards",
} as const;
