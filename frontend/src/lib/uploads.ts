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

const IMAGE_CONTENT_TYPES: Record<(typeof IMAGE_EXTENSIONS)[number], ImageUploadRequest["contentType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** The content type of an image file from its name, or undefined if it is not an allowed image. */
export function imageContentType(fileName: string): ImageUploadRequest["contentType"] | undefined {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return IMAGE_CONTENT_TYPES[extension as (typeof IMAGE_EXTENSIONS)[number]];
}

/** The extension an uploaded image is stored under, from its content type. */
export function imageExtension(contentType: ImageUploadRequest["contentType"]): (typeof IMAGE_EXTENSIONS)[number] {
  const extension = IMAGE_EXTENSIONS.find((candidate) => IMAGE_CONTENT_TYPES[candidate] === contentType);
  if (!extension) throw new Error(`No extension for ${contentType}`);
  return extension;
}
