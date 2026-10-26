import { z } from "zod";
import { fail, ok, type Result } from "./result";

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

export type SignedUpload = { path: string; signedUrl: string };

// Checking the shape `<folder>/<uuid>.<extension>` stops a request from pointing at any other file.
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

export function imageContentType(fileName: string): ImageUploadRequest["contentType"] | undefined {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return IMAGE_CONTENT_TYPES[extension as (typeof IMAGE_EXTENSIONS)[number]];
}

export function imageExtension(contentType: ImageUploadRequest["contentType"]): (typeof IMAGE_EXTENSIONS)[number] {
  const extension = IMAGE_EXTENSIONS.find((candidate) => IMAGE_CONTENT_TYPES[candidate] === contentType);
  if (!extension) throw new Error(`No extension for ${contentType}`);
  return extension;
}

/** Runs in the browser. Returns the storage paths in the same order as the files. */
export async function uploadImages(
  files: File[],
  createUploadUrl: (request: ImageUploadRequest) => Promise<Result<SignedUpload>>,
): Promise<Result<string[]>> {
  if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) return fail("invalid_input", "Each screenshot must be under 10 MB");

  const paths: string[] = [];
  for (const file of files) {
    const upload = await createUploadUrl({
      fileName: file.name,
      // Checked on the server: any other type gets a clear "not allowed" message back.
      contentType: file.type as ImageUploadRequest["contentType"],
      sizeBytes: file.size,
    });
    if (!upload.ok) return upload;

    const response = await fetch(upload.data.signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
    if (!response.ok) return fail("internal", `Could not upload ${file.name}`);
    paths.push(upload.data.path);
  }
  return ok(paths);
}
