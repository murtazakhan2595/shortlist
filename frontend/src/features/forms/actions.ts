"use server";

import { randomUUID } from "node:crypto";
import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { type ImageUploadRequest, ImageUploadRequestSchema, type SignedUpload } from "@/lib/uploads";
import { requireOwner } from "@/server/auth/require-owner";
import { addToAnswerBank } from "@/server/documents";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { createScreenshotUploadUrl } from "@/server/screenshots";
import type { ServerClient } from "@/server/supabase/server";
import {
  type AddFormPagesInput,
  AddFormPagesInputSchema,
  type AnswerFormQuestionInput,
  AnswerFormQuestionInputSchema,
  type FormPage,
  type FormPages,
  type FormPagesAdded,
  type FormQuestionAnswered,
} from "./schemas";

// Writes use the owner's client, so the database access rules apply too.

export async function createFormUploadUrl(request: ImageUploadRequest): Promise<Result<SignedUpload>> {
  const input = ImageUploadRequestSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    return ok(await createScreenshotUploadUrl(db, "forms", input.data.contentType));
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

export async function addFormPages(request: AddFormPagesInput): Promise<Result<FormPagesAdded>> {
  const input = AddFormPagesInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { applicationId, pages } = input.data;
  try {
    return applicationId ? await addToForm(db, applicationId, pages) : await startForm(db, pages);
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

export async function answerFormQuestion(request: AnswerFormQuestionInput): Promise<Result<FormQuestionAnswered>> {
  const input = AnswerFormQuestionInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { formAnswerId, answer, saveToAnswerBank } = input.data;
  const { data, error } = await db
    .from("form_answers")
    .update({ answer, status: "answered", note: null })
    .eq("id", formAnswerId)
    // Not one still being answered or checked: that step would overwrite this answer.
    .in("status", ["answered", "needs_input", "asset_needed"])
    .select("question")
    .maybeSingle();
  if (error) return fail("internal", `Could not save the answer: ${error.message}`);
  if (!data) return fail("conflict", "This question is still being answered. Try again in a moment.");

  try {
    const answerBankVersion = saveToAnswerBank ? await addToAnswerBank(db, data.question, answer) : null;
    return ok({ formAnswerId, answerBankVersion });
  } catch (error) {
    return fail("internal", `The answer was saved, but not to the answer bank: ${describeError(error)}`);
  }
}

// The job is unknown until the pages are read, so the duplicate key is the form's own id.
async function startForm(db: ServerClient, pages: FormPages): Promise<Result<FormPagesAdded>> {
  const id = randomUUID();
  const { error } = await db
    .from("applications")
    .insert({ id, route: "form", fingerprint: `form:${id}`, ...pageColumns(pages, { imagePaths: [], text: null }) });
  if (error) throw new Error(`Could not start the form: ${error.message}`);

  try {
    await enqueueStep(STEP_NAMES.readForm, { applicationId: id, pages: pagesToRead(pages) });
  } catch (error) {
    // Nothing would ever read this form, so remove it; the pages can be sent again.
    await db.from("applications").delete().eq("id", id);
    throw error;
  }
  return ok({ applicationId: id });
}

const NOT_READY = "Shortlist is still working on this form. Add more pages once it is done.";

// Only a ready form: two chains of steps on one form would overwrite each other, and a failed form is
// retried from failed-steps instead, so its waiting pages are not lost.
async function addToForm(db: ServerClient, applicationId: string, pages: FormPages): Promise<Result<FormPagesAdded>> {
  const { data: form, error: readError } = await db
    .from("applications")
    .select("status, form_image_paths, form_text")
    .eq("id", applicationId)
    .eq("route", "form")
    .maybeSingle();
  if (readError) throw new Error(`Could not load the form: ${readError.message}`);
  if (!form) return fail("not_found", "This form no longer exists");
  if (form.status !== "ready") return fail("conflict", NOT_READY);

  const { data: updated, error } = await db
    .from("applications")
    .update({ ...pageColumns(pages, { imagePaths: form.form_image_paths, text: form.form_text }), status: "preparing" })
    .eq("id", applicationId)
    // Of two requests at once, one wins and starts one chain.
    .eq("status", "ready")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not add the pages: ${error.message}`);
  if (!updated) return fail("conflict", NOT_READY);

  try {
    await enqueueStep(STEP_NAMES.readForm, { applicationId, pages: pagesToRead(pages) });
  } catch (error) {
    // Nothing would read the new pages, so put the form back as it was.
    await db
      .from("applications")
      .update({ status: "ready", form_image_paths: form.form_image_paths, form_text: form.form_text })
      .eq("id", applicationId);
    throw error;
  }
  return ok({ applicationId });
}

// One screenshot per page keeps each model call short; the id lets a retry skip a page already read.
function pagesToRead(pages: FormPages): FormPage[] {
  if (pages.inputType === "text") return [{ inputType: "text", pageId: randomUUID(), text: pages.text }];
  return pages.imagePaths.map((imagePath) => ({ inputType: "screenshot", pageId: randomUUID(), imagePath }));
}

function pageColumns(pages: FormPages, stored: { imagePaths: string[]; text: string | null }) {
  if (pages.inputType === "screenshot") return { form_image_paths: [...stored.imagePaths, ...pages.imagePaths] };
  return { form_text: stored.text ? `${stored.text}\n\n${pages.text}` : pages.text };
}
