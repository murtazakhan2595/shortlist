import "server-only";
import { type BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

// The messages a step sends to a model. Our own small type, so steps do not depend on LangChain.

export type ModelContentPart = { type: "text"; text: string } | { type: "image"; url: string };

export type ModelMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ModelContentPart[] };

function toLangChainContent(part: ModelContentPart) {
  return part.type === "text"
    ? { type: "text" as const, text: part.text }
    : { type: "image_url" as const, image_url: { url: part.url } };
}

export function toLangChainMessages(messages: ModelMessage[]): BaseMessage[] {
  return messages.map((message) => {
    if (message.role === "system") return new SystemMessage(message.content);

    const content = typeof message.content === "string" ? message.content : message.content.map(toLangChainContent);
    return new HumanMessage({ content });
  });
}
