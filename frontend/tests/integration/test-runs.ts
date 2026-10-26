// Tests share the database with the running app, so a test's nightly run must never look like the latest
// one (the Jobs page and the next real run would read it). Test runs are dated in the past instead.
export const TEST_RUN_STARTED_AT = "2000-01-01T00:00:00Z";
