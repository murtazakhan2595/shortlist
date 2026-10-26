import { z } from "zod";
import { storagePathSchema } from "@/lib/uploads";

// Server Actions:
//   saveDocument(SaveDocumentInput)       -> Result<DocumentSaved>
//   createCvUploadUrl(PdfUploadRequest)   -> Result<SignedUpload>   (from @/lib/uploads)
//   saveCvFile(SaveCvFileInput)           -> Result<CvFileSaved>

export const MAX_DOCUMENT_LENGTH = 100_000;

export const DOCUMENT_KINDS = ["profile", "answer_bank", "voice_example", "email_pattern"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const CV_VARIANTS = ["full_stack", "ai_engineer", "ai_full_stack"] as const;
export type CvVariant = (typeof CV_VARIANTS)[number];

// Saving never overwrites: it adds a new version of the document. baseVersion is the version the edit
// started from; if a newer one was saved meanwhile, the save is refused with "conflict".
export const SaveDocumentInputSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  name: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(MAX_DOCUMENT_LENGTH),
  baseVersion: z.int().min(1),
});
export type SaveDocumentInput = z.infer<typeof SaveDocumentInputSchema>;

export const SaveCvFileInputSchema = z.object({
  variant: z.enum(CV_VARIANTS),
  fileName: z.string().trim().min(1).max(200),
  storagePath: storagePathSchema("cvs", ["pdf"]),
});
export type SaveCvFileInput = z.infer<typeof SaveCvFileInputSchema>;

export type DocumentSaved = { documentId: string; version: number };
export type CvFileSaved = { cvFileId: string };
