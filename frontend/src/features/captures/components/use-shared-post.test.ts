import { expect, test } from "vitest";
import { formFromSharedPost, LINK_ONLY_NOTICE } from "./use-shared-post";

const POST = `We are hiring a Full-Stack Engineer to build our hiring platform with React and Node.
Send your CV to jobs@acme.example with the role in the subject line.`;

test("shared screenshots start the form in screenshot mode, keeping any link", () => {
  const screenshot = new File(["png"], "post.png", { type: "image/png" });

  expect(formFromSharedPost({ screenshots: [screenshot], text: "https://www.linkedin.com/posts/1" })).toEqual({
    mode: "screenshot",
    text: "",
    postUrl: "https://www.linkedin.com/posts/1",
    screenshots: [screenshot],
  });
});

test("shared text that holds the whole post starts the form in text mode", () => {
  expect(formFromSharedPost({ screenshots: [], text: `${POST}\nhttps://lnkd.in/abc` })).toEqual({
    mode: "text",
    text: `${POST}\nhttps://lnkd.in/abc`,
    postUrl: "https://lnkd.in/abc",
    screenshots: [],
  });
});

test("a caption with only a link, as the LinkedIn app shares, asks for a screenshot (hard rule 3)", () => {
  const form = formFromSharedPost({ screenshots: [], text: "Check out this post on LinkedIn https://lnkd.in/abc" });

  expect(form).toMatchObject({ mode: "screenshot", postUrl: "https://lnkd.in/abc", notice: LINK_ONLY_NOTICE });
});
