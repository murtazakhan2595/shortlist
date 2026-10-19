import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { expect, test } from "vitest";
import { toLangChainMessages } from "./messages";

test("turns system and user messages into LangChain messages", () => {
  const [system, user] = toLangChainMessages([
    { role: "system", content: "You read job posts." },
    { role: "user", content: "We are hiring." },
  ]);

  expect(system).toBeInstanceOf(SystemMessage);
  expect(user).toBeInstanceOf(HumanMessage);
  expect(user.content).toBe("We are hiring.");
});

test("sends images as image URLs beside the text", () => {
  const [user] = toLangChainMessages([
    {
      role: "user",
      content: [
        { type: "text", text: "Read this post." },
        { type: "image", url: "data:image/png;base64,iVBORw0KGgo=" },
      ],
    },
  ]);

  expect(user.content).toEqual([
    { type: "text", text: "Read this post." },
    { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } },
  ]);
});

test("marks a part that ends with a prompt cache breakpoint", () => {
  const [user] = toLangChainMessages([{ role: "user", content: [{ type: "text", text: "The profile.", cache: true }] }]);

  expect(user.content).toEqual([
    { type: "text", text: "The profile.", prompt_cache_breakpoint: { mode: "explicit" } },
  ]);
});
