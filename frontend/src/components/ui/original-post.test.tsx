import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { OriginalPost } from "./original-post";

test("shows each screenshot as a link to its full size, and the text folded away", async () => {
  render(<OriginalPost text={"We are hiring.\n<b>Apply</b> at jobs@acme.example"} screenshotUrls={["https://storage.example/1?token=a", "https://storage.example/2?token=b"]} />);

  expect(screen.getByRole("heading", { name: "The job post" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Screenshot 2, opens full size" })).toHaveAttribute("href", "https://storage.example/2?token=b");

  await userEvent.click(screen.getByText("The post's text, word for word"));
  // Post text is untrusted, so markup in it shows as typed.
  expect(screen.getByText(/<b>Apply<\/b> at jobs@acme.example/)).toBeVisible();
});

test("shows nothing when there is neither text nor a screenshot", () => {
  const { container } = render(<OriginalPost text={null} screenshotUrls={[]} />);

  expect(container).toBeEmptyDOMElement();
});
