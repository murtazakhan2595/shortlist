import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ok } from "@/lib/result";
import { saveDocument } from "../actions";
import { DocumentEditor } from "./document-editor";

vi.mock("../actions", () => ({ saveDocument: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

test("saves an edit as a new version, and says which", async () => {
  vi.mocked(saveDocument).mockResolvedValue(ok({ documentId: "d1", version: 3 }));
  const user = userEvent.setup();
  render(<DocumentEditor kind="answer_bank" name="main" content="Notice period: one month" />);

  const save = screen.getByRole("button", { name: "Save changes" });
  expect(save).toBeDisabled();

  await user.type(screen.getByLabelText("main"), ", negotiable");
  await user.click(save);

  expect(saveDocument).toHaveBeenCalledWith({ kind: "answer_bank", name: "main", content: "Notice period: one month, negotiable" });
  expect(await screen.findByRole("status")).toHaveTextContent("Saved as version 3.");
});
