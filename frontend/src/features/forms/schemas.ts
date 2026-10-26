import { z } from "zod";
import { IMAGE_EXTENSIONS, storagePathSchema } from "@/lib/uploads";

// Server Actions:
//   createFormUploadUrl(ImageUploadRequest)   -> Result<SignedUpload>   (from @/lib/uploads)
//   addFormPages(AddFormPagesInput)           -> Result<FormPagesAdded>
//   answerFormQuestion(AnswerFormQuestionInput) -> Result<FormQuestionAnswered>
//   draftListingAnswers(DraftListingAnswersInput) -> Result<FormStarted>

export const MAX_FORM_PAGES_PER_REQUEST = 10;
export const MAX_FORM_TEXT_LENGTH = 50_000;
export const MAX_ANSWER_LENGTH = 5_000;

export const FormImagePathSchema = storagePathSchema("forms", IMAGE_EXTENSIONS);

// Screenshots may also show the job post; whatever is not a question is kept as the job's details.
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

// Without an applicationId the pages start a new form.
export const AddFormPagesInputSchema = z.object({
  applicationId: z.uuid().optional(),
  pages: FormPagesSchema,
});
export type AddFormPagesInput = z.infer<typeof AddFormPagesInputSchema>;

// A [bracketed] guess left in a draft would end up in the answer bank, so it is refused.
// A Markdown link, [text](url), is not a guess.
export const AnswerFormQuestionInputSchema = z.object({
  formAnswerId: z.uuid(),
  answer: z
    .string()
    .trim()
    .min(1)
    .max(MAX_ANSWER_LENGTH)
    .refine((answer) => !/\[[^\]]+\](?!\()/.test(answer), "Replace the guesses in [brackets] with your own answer first"),
  saveToAnswerBank: z.boolean().default(true),
});
export type AnswerFormQuestionInput = z.infer<typeof AnswerFormQuestionInputSchema>;

// Only a Greenhouse job publishes its questions; any other is refused.
export const DraftListingAnswersInputSchema = z.object({ listingId: z.uuid() });
export type DraftListingAnswersInput = z.infer<typeof DraftListingAnswersInputSchema>;

export type FormPagesAdded = { applicationId: string };
export type FormStarted = { applicationId: string };
export type FormQuestionAnswered = { formAnswerId: string; answerBankVersion: number | null };

export const FormPayloadSchema = z.object({ applicationId: z.uuid() });

/** Its id is listed on the form once read, so a retry skips it. */
export const FormPageSchema = z.discriminatedUnion("inputType", [
  z.object({ inputType: z.literal("screenshot"), pageId: z.uuid(), imagePath: FormImagePathSchema }),
  z.object({ inputType: z.literal("text"), pageId: z.uuid(), text: z.string().min(1).max(MAX_FORM_TEXT_LENGTH) }),
]);
export type FormPage = z.infer<typeof FormPageSchema>;

/** Each read_form step reads the first page and queues the rest. */
export const ReadFormPayloadSchema = FormPayloadSchema.extend({ pages: z.array(FormPageSchema).min(1) });

export const FORM_ANSWER_STATUSES = ["pending", "checking", "answered", "needs_input", "asset_needed"] as const;
export type FormAnswerStatus = (typeof FORM_ANSWER_STATUSES)[number];
