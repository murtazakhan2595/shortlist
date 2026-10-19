import { describe, expect, test } from "vitest";
import { countWords, type DraftSources, type EmailDraft, findDraftProblems } from "./draft-checks";

const sources: DraftSources = {
  profile: "Full-stack developer. 3+ years with React, Next.js and TypeScript. Built a queue on PostgreSQL. 2,500 users.",
  answerBank: "Notice period: immediately. LinkedIn: linkedin.com/in/example-owner. Phone: +92 300 1234567.",
  postText: "We are hiring a React Developer with 2 years of experience. Email hr@acme.example.",
  postRole: "React Developer",
  patternContent: "### Pattern A\n**Length:** 10–40 words in the body.",
};

const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");

function draft(fields: Partial<EmailDraft> = {}): EmailDraft {
  return {
    cvVariant: "full_stack",
    presentedTitle: "Full-Stack Developer",
    emailPattern: "post-reply",
    subject: "Application for React Developer",
    body: `Hi team, I have 3+ years with React and TypeScript. ${words(10)}`,
    signature: "Regards,\nThe Owner\n+92 300 1234567\nlinkedin.com/in/example-owner",
    ...fields,
  };
}

describe("findDraftProblems", () => {
  test("passes a draft whose every number, link and technology is in the sources", () => {
    expect(findDraftProblems(draft(), sources)).toEqual([]);
  });

  test("finds a number the profile does not give, but not one that is part of a bigger one", () => {
    const problems = findDraftProblems(draft({ body: `I have 5 years with React. I served 2,500 users. ${words(10)}` }), sources);

    expect(problems).toEqual(["The number 5 does not appear in the profile, the answer bank or the post."]);
  });

  test("finds a technology the owner has not used, even when the post asks for it", () => {
    const problems = findDraftProblems(draft({ body: `I use React and Kubernetes daily. ${words(10)}` }), sources);

    expect(problems).toEqual(['"Kubernetes" is not in the profile or the answer bank, so the draft cannot claim it.']);
  });

  test("does not mistake ordinary words or longer names for technologies", () => {
    const body = `I can express ideas clearly and go through JavaScript code. ${words(10)}`;

    expect(findDraftProblems(draft({ body }), { ...sources, profile: `${sources.profile} JavaScript.` })).toEqual([]);
  });

  test("allows a technology that is part of the post's role, but not one the draft's own title brings in", () => {
    const vueRole = { ...sources, postRole: "Vue Developer" };
    const naming = draft({ body: `I am applying for your Vue Developer role. ${words(10)}` });
    const claiming = draft({ presentedTitle: "Vue Developer", body: `I have built with Vue. ${words(10)}` });

    expect(findDraftProblems(naming, vueRole)).toEqual([]);
    expect(findDraftProblems(claiming, sources)).toEqual([
      '"Vue" is not in the profile or the answer bank, so the draft cannot claim it.',
    ]);
  });

  test("finds a link that is not in the sources", () => {
    const problems = findDraftProblems(draft({ body: `See https://evil.example/apply now. ${words(10)}` }), sources);

    expect(problems).toEqual(["The link evil.example/apply does not appear in the profile, the answer bank or the post."]);
  });

  test("finds banned phrases, filler openers and em dashes", () => {
    const body = `I am passionate about React. Additionally, I leveraged TypeScript — a lot. ${words(8)}`;

    expect(findDraftProblems(draft({ body }), sources)).toEqual([
      'Remove the banned phrase "passionate about".',
      'Remove the banned phrase "leverage".',
      'Remove a sentence opening with "Additionally", "Furthermore" or "Moreover".',
      "Remove an em dash (use a comma, period or colon).",
    ]);
  });

  test("checks the body's length against the chosen pattern", () => {
    const problems = findDraftProblems(draft({ body: words(50) }), sources);

    expect(problems).toEqual(["The body has 50 words; the post-reply pattern needs 10 to 40."]);
  });

  test("needs a subject line", () => {
    expect(findDraftProblems(draft({ subject: " " }), sources)).toEqual(["The subject line is empty."]);
  });
});

test("counts words separated by any white space", () => {
  expect(countWords("Hi team,\n\nI am  applying.")).toBe(5);
});
