// Integration tests share the one database with the running app, so a nightly run a test adds must never
// look like the latest one: the Jobs page would show the test's empty run, and the next real run could read
// back only to the test's start. Test runs are dated in the past instead.
export const TEST_RUN_STARTED_AT = "2000-01-01T00:00:00Z";
