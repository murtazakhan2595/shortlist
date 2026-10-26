import "server-only";
import { type BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

// Our own small type, so steps do not depend on LangChain.

/** cache: true ends the part with a prompt cache breakpoint; a later call that starts the same way reads it cheaply. */
export type ModelContentPart = { type: "text"; text: string; cache?: boolean } | { type: "image"; url: string };

export type ModelMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ModelContentPart[] };

function toLangChainContent(part: ModelContentPart) {
  if (part.type === "image") return { type: "image_url" as const, image_url: { url: part.url } };
  if (part.cache) return { type: "text" as const, text: part.text, prompt_cache_breakpoint: { mode: "explicit" } };
  return { type: "text" as const, text: part.text };
}

export function toLangChainMessages(messages: ModelMessage[]): BaseMessage[] {
  return messages.map((message) => {
    if (message.role === "system") return new SystemMessage(message.content);

    const content = typeof message.content === "string" ? message.content : message.content.map(toLangChainContent);
    return new HumanMessage({ content });
  });
}
