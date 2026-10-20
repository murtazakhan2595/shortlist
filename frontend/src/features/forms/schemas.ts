import { z } from "zod";
import { IMAGE_EXTENSIONS, storagePathSchema } from "@/lib/uploads";

// Contracts for the forms feature (PLAN.md item 1.3; F1, F3, F5).
//
// Server Actions:
//   createFormUploadUrl(ImageUploadRequest)   -> Result<SignedUpload>   (from @/lib/uploads)
//   addFormPages(AddFormPagesInput)           -> Result<FormPagesAdded>
//   answerFormQuestion(AnswerFormQuestionInput) -> Result<FormQuestionAnswered>

export const MAX_FORM_PAGES_PER_REQUEST = 10;
export const MAX_FORM_TEXT_LENGTH = 50_000;
export const MAX_ANSWER_LENGTH = 5_000;

export const FormImagePathSchema = storagePathSchema("forms", IMAGE_EXTENSIONS);

// Pages arrive as full-page screenshots or as pasted text. Screenshots may also show the job post or its
// description; the form's questions are read from them and the rest is kept as the job's details.
export const FormPagesSchema = z.discriminatedUnion("inputType", [
  z.object({
    inputType: z.literal("screenshot"),
    imagePaths: z.array(FormImagePathSchema).min(1).max(MAX_FORM_PAGES_PER_REQUEST),
  }),
  z.object({
    inputType: z.literal("text"),
    text: z.string().trim().min(1).max(MAX_FORM_TEXT_LENGTH),
  }),
]);
export type FormPages = z.infer<typeof FormPagesSchema>;

// Without an applicationId the pages start a new form; with one they are added to that form (F3).
export const AddFormPagesInputSchema = z.object({
  applicationId: z.uuid().optional(),
  pages: FormPagesSchema,
});
export type AddFormPagesInput = z.infer<typeof AddFormPagesInputSchema>;

// The owner answers a "needs your input" question, or corrects an answer; by default it is saved to the
// answer bank too, so the next form that asks gets it (F5).
export const AnswerFormQuestionInputSchema = z.object({
  formAnswerId: z.uuid(),
  answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
  saveToAnswerBank: z.boolean().default(true),
});
export type AnswerFormQuestionInput = z.infer<typeof AnswerFormQuestionInputSchema>;

export type FormPagesAdded = { applicationId: string };
export type FormQuestionAnswered = { formAnswerId: string; answerBankVersion: number | null };

// Types the forms feature's files share.

/** The payload of the steps that work on one form, after its pages are read. */
export const FormPayloadSchema = z.object({ applicationId: z.uuid() });

/** The payload of read_form: the pages just added, and the batch they are read as. */
export const ReadFormPayloadSchema = FormPayloadSchema.extend({ batchId: z.uuid(), pages: FormPagesSchema });
export type ReadFormPayload = z.infer<typeof ReadFormPayloadSchema>;

/** Where a question is: read, answered and checked one step at a time (see the form_answers migration). */
export const FORM_ANSWER_STATUSES = ["pending", "checking", "answered", "needs_input", "asset_needed"] as const;
export type FormAnswerStatus = (typeof FORM_ANSWER_STATUSES)[number];
