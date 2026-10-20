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
  type FormPages,
  type FormPagesAdded,
  type FormQuestionAnswered,
} from "./schemas";

// Server Actions for forms (contracts in ./schemas.ts). Each checks its input, checks the owner, and does
// one thing. Database writes use the owner's client, so the access rules apply too.

/** A one-time link the browser uploads a page's screenshot to, straight into private storage. */
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

/** Saves pages as a new form, or adds them to a form (F3), and queues them to be read. */
export async function addFormPages(request: AddFormPagesInput): Promise<Result<FormPagesAdded>> {
  const input = AddFormPagesInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { applicationId, pages } = input.data;
  try {
    const formId = applicationId ? await addToForm(db, applicationId, pages) : await startForm(db, pages);
    if (!formId) return fail("not_found", "This form no longer exists");

    // Each addition is its own batch, so reading it twice can be spotted (read-form.ts).
    await enqueueStep(STEP_NAMES.readForm, { applicationId: formId, batchId: randomUUID(), pages });
    return ok({ applicationId: formId });
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

/**
 * The owner answers a question, or corrects an answer. By default the answer is also saved to the answer
 * bank, so the next form that asks gets it (F5).
 */
export async function answerFormQuestion(request: AnswerFormQuestionInput): Promise<Result<FormQuestionAnswered>> {
  const input = AnswerFormQuestionInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { formAnswerId, answer, saveToAnswerBank } = input.data;
  const { data, error } = await db
    .from("form_answers")
    .update({ answer, status: "answered", note: null })
    .eq("id", formAnswerId)
    // Not a question still being answered or checked: that step would overwrite the owner's answer.
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

/**
 * A new form is an application on the form route. Its job is known only once its pages are read, so its
 * duplicate key is its own id: a form is not matched against other applications.
 */
async function startForm(db: ServerClient, pages: FormPages): Promise<string> {
  const id = randomUUID();
  const { error } = await db
    .from("applications")
    .insert({ id, route: "form", fingerprint: `form:${id}`, ...pageColumns(pages, { imagePaths: [], text: null }) });
  if (error) throw new Error(`Could not start the form: ${error.message}`);
  return id;
}

/** Adds the pages to the form and sets it preparing again; null when there is no such form. */
async function addToForm(db: ServerClient, applicationId: string, pages: FormPages): Promise<string | null> {
  const { data: form, error: readError } = await db
    .from("applications")
    .select("status, form_image_paths, form_text")
    .eq("id", applicationId)
    .eq("route", "form")
    .maybeSingle();
  if (readError) throw new Error(`Could not load the form: ${readError.message}`);
  if (!form) return null;

  const { error } = await db
    .from("applications")
    .update({
      ...pageColumns(pages, { imagePaths: form.form_image_paths, text: form.form_text }),
      // A status the owner set (sent, skipped) stays; a ready form has new questions to answer.
      status: form.status === "ready" ? "preparing" : form.status,
    })
    .eq("id", applicationId);
  if (error) throw new Error(`Could not add the pages: ${error.message}`);
  return applicationId;
}

/** The form's stored pages with the new ones added after them. */
function pageColumns(pages: FormPages, stored: { imagePaths: string[]; text: string | null }) {
  if (pages.inputType === "screenshot") return { form_image_paths: [...stored.imagePaths, ...pages.imagePaths] };
  return { form_text: stored.text ? `${stored.text}\n\n${pages.text}` : pages.text };
}
