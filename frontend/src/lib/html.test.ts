import { expect, test } from "vitest";
import { htmlToText } from "./html";

test("turns HTML into plain text, with line breaks and list items kept", () => {
  expect(htmlToText("<h2>About</h2><p>Line one<br>Line   two</p><p></p><p>It&#39;s &quot;great&quot;&nbsp;here</p>")).toBe(
    'About\nLine one\nLine two\n\nIt\'s "great" here',
  );
});

test("reads hexadecimal entities, as Hacker News writes them", () => {
  expect(htmlToText("https:&#x2F;&#x2F;acme.com&#x2F;jobs &#x27;here&#x27;")).toBe("https://acme.com/jobs 'here'");
});
