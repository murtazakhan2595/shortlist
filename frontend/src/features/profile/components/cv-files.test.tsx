import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CvFiles } from "./cv-files";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createCvUploadUrl = vi.fn();
const saveCvFile = vi.fn();
vi.mock("../actions", () => ({
  createCvUploadUrl: (input: unknown) => createCvUploadUrl(input),
  saveCvFile: (input: unknown) => saveCvFile(input),
}));

const path = "cvs/0f8fad5b-d9cb-469f-a165-70867728950e.pdf";

beforeEach(() => {
  createCvUploadUrl.mockResolvedValue({ ok: true, data: { path, signedUrl: "https://storage.example/upload" } });
  saveCvFile.mockResolvedValue({ ok: true, data: { cvFileId: "cv-1" } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("lists each kind of CV with its current file", () => {
  render(<CvFiles cvs={[{ variant: "full_stack", fileName: "Owner-CV-Full-Stack.pdf" }]} />);

  expect(screen.getByText("Owner-CV-Full-Stack.pdf")).toBeInTheDocument();
  expect(screen.getAllByText("None yet")).toHaveLength(2);
});

test("a new PDF goes straight to storage, then becomes the current CV of its kind", async () => {
  render(<CvFiles cvs={[]} />);
  const file = new File(["%PDF-1.7"], "New-CV.pdf", { type: "application/pdf" });

  await userEvent.upload(screen.getByLabelText("New ai engineer CV"), file);

  expect(createCvUploadUrl).toHaveBeenCalledWith({ fileName: "New-CV.pdf", contentType: "application/pdf", sizeBytes: file.size });
  expect(fetch).toHaveBeenCalledWith("https://storage.example/upload", expect.objectContaining({ method: "PUT", body: file }));
  expect(saveCvFile).toHaveBeenCalledWith({ variant: "ai_engineer", fileName: "New-CV.pdf", storagePath: path });
  expect(await screen.findByRole("status")).toHaveTextContent("New-CV.pdf is now your ai engineer CV.");
  expect(refresh).toHaveBeenCalled();
});

test("a file that is not a PDF is refused before anything is uploaded", async () => {
  render(<CvFiles cvs={[]} />);
  const user = userEvent.setup({ applyAccept: false });

  await user.upload(screen.getByLabelText("New full-stack CV"), new File(["x"], "cv.docx", { type: "application/msword" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a PDF file");
  expect(createCvUploadUrl).not.toHaveBeenCalled();
});
