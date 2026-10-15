import { z } from "zod";

// Files go from the browser straight to Supabase Storage, through a one-time signed upload URL
// that a Server Action creates. These checks run before the URL is created.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const FileNameSchema = z.string().trim().min(1).max(200);
const FileSizeSchema = z.int().positive().max(MAX_UPLOAD_BYTES);

export const ImageUploadRequestSchema = z.object({
  fileName: FileNameSchema,
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: FileSizeSchema,
});
export type ImageUploadRequest = z.infer<typeof ImageUploadRequestSchema>;

export const PdfUploadRequestSchema = z.object({
  fileName: FileNameSchema,
  contentType: z.literal("application/pdf"),
  sizeBytes: FileSizeSchema,
});
export type PdfUploadRequest = z.infer<typeof PdfUploadRequestSchema>;

/** Where the browser uploads the file, and the storage path to send back once it has. */
export type SignedUpload = { path: string; signedUrl: string };

/**
 * A storage path the server created for an upload: `<folder>/<uuid>.<extension>`.
 * Checking the shape stops a request from pointing at any other file.
 */
export function storagePathSchema(folder: string, extensions: readonly string[]) {
  const pattern = new RegExp(`^${folder}/[0-9a-f-]{36}\\.(${extensions.join("|")})$`);
  return z.string().regex(pattern, `Expected a ${folder} upload path`);
}

export const IMAGE_EXTENSIONS = ["png", "jpg", "webp"] as const;
