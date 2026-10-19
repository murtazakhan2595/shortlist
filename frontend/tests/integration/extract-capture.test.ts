import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { extractCapture } from "@/features/captures/steps/extract-capture";
import type { ExtractedPost } from "@/features/captures/steps/read-post";
import { getAdminClient } from "@/server/supabase/admin";

// The extract_capture step against the real database and storage, with a fake model.
const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({
  createStructuredModel: () => ({ invoke: invokeModel }),
}));

function modelAnswer(fields: Partial<ExtractedPost>) {
  const parsed = { role: null, company: null, posterName: null, contactEmail: null, formUrl: null, ...fields };
  const raw = new AIMessage({
    content: JSON.stringify(parsed),
    usage_metadata: { input_tokens: 800, output_tokens: 60, total_tokens: 860 },
  });
  return { raw, parsed };
}

// The smallest valid PNG: one transparent pixel.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("extractCapture", () => {
  const database = getAdminClient();
  const runIds: string[] = [];
  const imagePaths: string[] = [];

  beforeEach(() => {
    invokeModel.mockReset();
  });

  afterAll(async () => {
    await database.from("model_calls").delete().in("run_id", runIds);
    await database.from("captures").delete().in("run_id", runIds);
    await database.from("runs").delete().in("id", runIds);
    if (imagePaths.length > 0) await database.storage.from("screenshots").remove(imagePaths);
  });

  async function createCapture(fields: { input_type: "text"; raw_text: string } | { input_type: "screenshot"; image_paths: string[] }) {
    const run = await database.from("runs").insert({ kind: "capture" }).select("id").single();
    if (run.error) throw run.error;
    runIds.push(run.data.id);

    const capture = await database
      .from("captures")
      .insert({ ...fields, run_id: run.data.id })
      .select("id")
      .single();
    if (capture.error) throw capture.error;
    return { captureId: capture.data.id, runId: run.data.id };
  }

  async function loadCapture(captureId: string) {
    const { data, error } = await database.from("captures").select("*").eq("id", captureId).single();
    if (error) throw error;
    return data;
  }

  async function modelCallCount(runId: string) {
    const { count, error } = await database
      .from("model_calls")
      .select("*", { count: "exact", head: true })
      .eq("run_id", runId);
    if (error) throw error;
    return count;
  }

  test("saves what a pasted post says, and running twice reads it only once", async () => {
    const { captureId, runId } = await createCapture({
      input_type: "text",
      raw_text: "Acme is hiring a Full-Stack Engineer. Email jobs@acme.example. Posted by Sara Khan.",
    });
    invokeModel.mockResolvedValue(
      modelAnswer({ role: "Full-Stack Engineer", company: "Acme", posterName: "Sara Khan", contactEmail: "jobs@acme.example" }),
    );

    await extractCapture({ captureId });
    await extractCapture({ captureId });

    expect(await loadCapture(captureId)).toMatchObject({
      role: "Full-Stack Engineer",
      company: "Acme",
      poster_name: "Sara Khan",
      contact_email: "jobs@acme.example",
      form_url: null,
      status: "processing",
    });
    expect(invokeModel).toHaveBeenCalledTimes(1);
    expect(await modelCallCount(runId)).toBe(1);
  });

  test("sends screenshots to the model inside the request and waits for the owner to confirm the email", async () => {
    const imagePath = `captures/${randomUUID()}.png`;
    const upload = await database.storage.from("screenshots").upload(imagePath, ONE_PIXEL_PNG, { contentType: "image/png" });
    if (upload.error) throw upload.error;
    imagePaths.push(imagePath);

    const { captureId } = await createCapture({ input_type: "screenshot", image_paths: [imagePath] });
    invokeModel.mockResolvedValue(modelAnswer({ contactEmail: "hr@acme.example" }));

    await extractCapture({ captureId });

    const [messages] = invokeModel.mock.calls[0];
    expect(JSON.stringify(messages)).toContain(`data:image/png;base64,${ONE_PIXEL_PNG.toString("base64")}`);
    expect(await loadCapture(captureId)).toMatchObject({ contact_email: "hr@acme.example", status: "awaiting_confirmation" });
  });

  test("a post with no way to apply ends its run", async () => {
    const { captureId, runId } = await createCapture({ input_type: "text", raw_text: "Great news: our team is growing!" });
    invokeModel.mockResolvedValue(modelAnswer({ contactEmail: "invented@acme.example" }));

    await extractCapture({ captureId });

    expect((await loadCapture(captureId)).status).toBe("no_contact");
    const { data: run } = await database.from("runs").select("status, finished_at").eq("id", runId).single();
    expect(run?.status).toBe("succeeded");
    expect(run?.finished_at).not.toBeNull();
  });
});
