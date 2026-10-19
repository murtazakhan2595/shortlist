import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { fail, ok } from "@/lib/result";
import { createCaptureUploadUrl, submitCapture } from "../actions";
import { CaptureForm } from "./capture-form";
import type { SharedForm } from "./use-shared-post";

vi.mock("../actions", () => ({ submitCapture: vi.fn(), createCaptureUploadUrl: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// What the share menu handed over, if anything; the real hook reads it from the service worker's cache.
const shared = vi.hoisted((): { form?: SharedForm } => ({}));
vi.mock("./use-shared-post", async () => {
  const { useEffect } = await import("react");
  return {
    useSharedPost: (onShared: (form: SharedForm) => void) =>
      useEffect(() => {
        if (shared.form) onShared(shared.form);
      }, [onShared]),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  shared.form = undefined;
});

test("submits a pasted post with its link and opens the captured post", async () => {
  vi.mocked(submitCapture).mockResolvedValue(ok({ captureId: "abc" }));
  const user = userEvent.setup();
  render(<CaptureForm />);

  await user.type(screen.getByLabelText("The post"), "We are hiring. Email jobs@acme.example");
  await user.type(screen.getByLabelText("Link to the post (optional)"), "https://www.linkedin.com/posts/1");
  await user.click(screen.getByRole("button", { name: "Read the post" }));

  expect(submitCapture).toHaveBeenCalledWith({
    inputType: "text",
    text: "We are hiring. Email jobs@acme.example",
    postUrl: "https://www.linkedin.com/posts/1",
  });
  expect(push).toHaveBeenCalledWith("/captures/abc");
});

test("shows why a capture was refused", async () => {
  vi.mocked(submitCapture).mockResolvedValue(fail("invalid_input", "Too small: expected string to have >=1 characters"));
  const user = userEvent.setup();
  render(<CaptureForm />);

  await user.type(screen.getByLabelText("The post"), " ");
  await user.click(screen.getByRole("button", { name: "Read the post" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Too small");
  expect(push).not.toHaveBeenCalled();
});

test("uploads each screenshot through its one-time link, then submits their paths", async () => {
  vi.mocked(createCaptureUploadUrl).mockResolvedValue(
    ok({ path: "captures/0f8fad5b-d9cb-469f-a165-70867728950e.png", signedUrl: "https://storage.example/upload" }),
  );
  vi.mocked(submitCapture).mockResolvedValue(ok({ captureId: "abc" }));
  const upload = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  const user = userEvent.setup();
  render(<CaptureForm />);

  await user.click(screen.getByLabelText("Screenshots"));
  const screenshot = new File(["png"], "post.png", { type: "image/png" });
  await user.upload(screen.getByLabelText("Screenshots of the post"), screenshot);
  await user.click(screen.getByRole("button", { name: "Read the post" }));

  // Uploading takes several steps after the click, so wait for the last one: opening the captured post.
  await waitFor(() => expect(push).toHaveBeenCalledWith("/captures/abc"));
  expect(upload).toHaveBeenCalledWith("https://storage.example/upload", expect.objectContaining({ method: "PUT", body: screenshot }));
  expect(submitCapture).toHaveBeenCalledWith({
    inputType: "screenshot",
    imagePaths: ["captures/0f8fad5b-d9cb-469f-a165-70867728950e.png"],
    postUrl: undefined,
  });
});

test("asks for a screenshot when none is chosen", async () => {
  const user = userEvent.setup();
  render(<CaptureForm />);

  await user.click(screen.getByLabelText("Screenshots"));
  await user.click(screen.getByRole("button", { name: "Read the post" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Choose at least one screenshot");
  expect(createCaptureUploadUrl).not.toHaveBeenCalled();
});

test("a screenshot shared from the phone fills the form and is uploaded on submit (item 2.5)", async () => {
  const screenshot = new File(["png"], "post.png", { type: "image/png" });
  shared.form = { mode: "screenshot", text: "", postUrl: "https://lnkd.in/abc", screenshots: [screenshot] };
  vi.mocked(createCaptureUploadUrl).mockResolvedValue(ok({ path: "captures/a.png", signedUrl: "https://storage.example/upload" }));
  vi.mocked(submitCapture).mockResolvedValue(ok({ captureId: "abc" }));
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  const user = userEvent.setup();
  render(<CaptureForm />);

  expect(await screen.findByText("Ready to send: post.png")).toBeInTheDocument();
  expect(screen.getByLabelText("Link to the post (optional)")).toHaveValue("https://lnkd.in/abc");
  await user.click(screen.getByRole("button", { name: "Read the post" }));

  expect(submitCapture).toHaveBeenCalledWith({ inputType: "screenshot", imagePaths: ["captures/a.png"], postUrl: "https://lnkd.in/abc" });
});

test("a shared link alone says why it cannot be used", async () => {
  shared.form = { mode: "screenshot", text: "", postUrl: "https://lnkd.in/abc", screenshots: [], notice: "Only a link was shared." };
  render(<CaptureForm />);

  expect(await screen.findByRole("status")).toHaveTextContent("Only a link was shared.");
});
