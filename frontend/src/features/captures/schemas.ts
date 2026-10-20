import { z } from "zod";
import { IMAGE_EXTENSIONS, storagePathSchema } from "@/lib/uploads";

// Contracts for the captures feature (PLAN.md item 1.3; C1, C8).
//
// Server Actions:
//   createCaptureUploadUrl(ImageUploadRequest) -> Result<SignedUpload>   (from @/lib/uploads)
//   submitCapture(SubmitCaptureInput)          -> Result<CaptureSubmitted>

export const MAX_SCREENSHOTS_PER_CAPTURE = 5;
export const MAX_POST_TEXT_LENGTH = 20_000;

export const CaptureImagePathSchema = storagePathSchema("captures", IMAGE_EXTENSIONS);

// Kept for reference only; the system never opens it (C8).
const PostUrlSchema = z.url().optional();

export const SubmitCaptureInputSchema = z.discriminatedUnion("inputType", [
  z.object({
    inputType: z.literal("text"),
    text: z.string().trim().min(1).max(MAX_POST_TEXT_LENGTH),
    postUrl: PostUrlSchema,
  }),
  z.object({
    inputType: z.literal("screenshot"),
    imagePaths: z.array(CaptureImagePathSchema).min(1).max(MAX_SCREENSHOTS_PER_CAPTURE),
    postUrl: PostUrlSchema,
  }),
]);
export type SubmitCaptureInput = z.infer<typeof SubmitCaptureInputSchema>;

export type CaptureSubmitted = { captureId: string };
