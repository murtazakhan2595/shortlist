import { describe, expect, test } from "vitest";
import { codeFiles, filesMatching } from "./repo";

// X5: the Gmail permission that creates drafts can also send, so the code must contain no send call.
const SEND_CALLS = ["messages.send", "drafts.send", "sendMail", "createTransport"];

describe("nothing is ever sent (X5)", () => {
  const files = codeFiles();

  test.each(SEND_CALLS)("no code calls %s", (call) => {
    const pattern = new RegExp(`\\b${call.replace(".", "\\.")}\\b`);

    expect(filesMatching(files, pattern)).toEqual([]);
  });
});
