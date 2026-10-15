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

// A form arrives as full-page screenshots or pasted text, and more can be added later (F3).
export const AddFormPagesInputSchema = z.object({
  applicationId: z.uuid(),
  pages: z.discriminatedUnion("inputType", [
    z.object({
      inputType: z.literal("screenshot"),
      imagePaths: z.array(FormImagePathSchema).min(1).max(MAX_FORM_PAGES_PER_REQUEST),
    }),
    z.object({
      inputType: z.literal("text"),
      text: z.string().trim().min(1).max(MAX_FORM_TEXT_LENGTH),
    }),
  ]),
});
export type AddFormPagesInput = z.infer<typeof AddFormPagesInputSchema>;

// The owner answers a "needs your input" question; by default it is saved to the answer bank too (F5).
export const AnswerFormQuestionInputSchema = z.object({
  formAnswerId: z.uuid(),
  answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
  saveToAnswerBank: z.boolean().default(true),
});
export type AnswerFormQuestionInput = z.infer<typeof AnswerFormQuestionInputSchema>;

export type FormPagesAdded = { applicationId: string };
export type FormQuestionAnswered = { formAnswerId: string; answerBankVersion: number | null };
