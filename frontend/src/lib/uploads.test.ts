import { describe, expect, test } from "vitest";
import { IMAGE_EXTENSIONS, ImageUploadRequestSchema, imageContentType, MAX_UPLOAD_BYTES, storagePathSchema } from "./uploads";

describe("ImageUploadRequestSchema", () => {
  test("accepts a PNG screenshot", () => {
    const request = { fileName: "post.png", contentType: "image/png", sizeBytes: 300_000 };

    expect(ImageUploadRequestSchema.safeParse(request).success).toBe(true);
  });

  test("rejects files over the size limit and other file types", () => {
    const tooBig = { fileName: "post.png", contentType: "image/png", sizeBytes: MAX_UPLOAD_BYTES + 1 };
    const notAnImage = { fileName: "post.gif", contentType: "image/gif", sizeBytes: 1_000 };

    expect(ImageUploadRequestSchema.safeParse(tooBig).success).toBe(false);
    expect(ImageUploadRequestSchema.safeParse(notAnImage).success).toBe(false);
  });
});

describe("storagePathSchema", () => {
  const capturePath = storagePathSchema("captures", IMAGE_EXTENSIONS);

  test("accepts a path the server created", () => {
    expect(capturePath.safeParse("captures/0f8fad5b-d9cb-469f-a165-70867728950e.png").success).toBe(true);
  });

  test("rejects a path in another folder or with a traversal", () => {
    expect(capturePath.safeParse("cvs/0f8fad5b-d9cb-469f-a165-70867728950e.png").success).toBe(false);
    expect(capturePath.safeParse("captures/../cvs/my-cv.pdf").success).toBe(false);
  });
});

test("knows the content type of an allowed image from its name", () => {
  expect(imageContentType("captures/0f8fad5b-d9cb-469f-a165-70867728950e.jpg")).toBe("image/jpeg");
  expect(imageContentType("post.PNG")).toBe("image/png");
  expect(imageContentType("cv.pdf")).toBeUndefined();
});
