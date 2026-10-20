import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { ok } from "@/lib/result";
import { addFormPages, createFormUploadUrl } from "../actions";
import { FormPagesForm } from "./form-pages-form";

vi.mock("../actions", () => ({ addFormPages: vi.fn(), createFormUploadUrl: vi.fn() }));
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

const screenshot = (name: string) => new File(["x"], name, { type: "image/png" });

test("uploads the post and the form together as a new form, then opens it", async () => {
  vi.mocked(createFormUploadUrl)
    .mockResolvedValueOnce(ok({ path: "forms/a.png", signedUrl: "https://storage.example/a" }))
    .mockResolvedValueOnce(ok({ path: "forms/b.png", signedUrl: "https://storage.example/b" }));
  vi.mocked(addFormPages).mockResolvedValue(ok({ applicationId: "form-1" }));
  const user = userEvent.setup();
  render(<FormPagesForm />);

  await user.upload(screen.getByLabelText("Screenshots of the form and the job"), [screenshot("post.png"), screenshot("form.png")]);
  await user.click(screen.getByRole("button", { name: "Answer the form" }));

  expect(addFormPages).toHaveBeenCalledWith({
    applicationId: undefined,
    pages: { inputType: "screenshot", imagePaths: ["forms/a.png", "forms/b.png"] },
  });
  expect(push).toHaveBeenCalledWith("/forms/form-1");
});

test("adds pasted pages to an existing form and stays on it", async () => {
  vi.mocked(addFormPages).mockResolvedValue(ok({ applicationId: "form-1" }));
  const user = userEvent.setup();
  render(<FormPagesForm applicationId="form-1" />);

  await user.click(screen.getByLabelText("Pasted text"));
  await user.type(screen.getByLabelText("The next pages"), "Q: Notice period?");
  await user.click(screen.getByRole("button", { name: "Add these pages" }));

  expect(addFormPages).toHaveBeenCalledWith({ applicationId: "form-1", pages: { inputType: "text", text: "Q: Notice period?" } });
  expect(refresh).toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test("asks for a screenshot when none is chosen", async () => {
  const user = userEvent.setup();
  render(<FormPagesForm />);

  await user.click(screen.getByRole("button", { name: "Answer the form" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Choose at least one screenshot");
  expect(addFormPages).not.toHaveBeenCalled();
});
