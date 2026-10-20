import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { advanceWriter, prepareEmailApplication } from "@/features/applications/steps/writer-steps";
import { getCheckpointer } from "@/server/queue/checkpointer";
import { getAdminClient } from "@/server/supabase/admin";

// The writer's queued steps against the real database, its LangGraph checkpoints in Postgres and the
// owner's real material, with a fake model. Queued steps are collected here instead of going to the
// real queue, and run one by one, as the worker would.
const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({ createStructuredModel: () => ({ invoke: invokeModel }) }));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => {
    queued.push({ step, payload });
    return queued.length;
  },
}));

const WHOLE_LOOP_TIMEOUT_MS = 60_000;

function modelAnswer(parsed: unknown) {
  const raw = new AIMessage({
    content: JSON.stringify(parsed),
    usage_metadata: { input_tokens: 20_000, output_tokens: 500, total_tokens: 20_500 },
  });
  return { raw, parsed };
}

// Plain words only: no number, link or technology, so the code check passes on any profile.
const SUPPORTED_DRAFT = {
  cvVariant: "full_stack",
  presentedTitle: "Software Engineer",
  emailPattern: "post-reply",
  subject: "Application for the Engineer role",
  body: [
    "Hi team,",
    "I am applying for the Engineer role you posted on LinkedIn, and my CV is attached.",
    "I build web products from the database up to the screens people use, and I write the tests that keep them working.",
    "In my current work I plan features with the team, ship them in small steps, and stay with them after release until they work well for the people who use them every day.",
    "I can start soon and work fully remote.",
  ].join("\n\n"),
  signature: "Regards,\nThe Owner",
};

describe("the writer's queued steps", () => {
  const database = getAdminClient();
  const runIds: string[] = [];
  const captureIds: string[] = [];
  const applicationIds: string[] = [];

  const gmailDraftsQueued: unknown[] = [];

  beforeEach(() => {
    invokeModel.mockReset();
    queued.length = 0;
    gmailDraftsQueued.length = 0;
  });

  afterAll(async () => {
    await database.from("model_calls").delete().in("run_id", runIds);
    await database.from("applications").delete().in("capture_id", captureIds);
    await database.from("captures").delete().in("id", captureIds);
    await database.from("runs").delete().in("id", runIds);
    for (const id of applicationIds) await getCheckpointer().deleteThread(id);
  });

  async function createCapture(contactEmail: string) {
    const run = await database.from("runs").insert({ kind: "capture" }).select("id").single();
    if (run.error) throw run.error;
    runIds.push(run.data.id);

    const capture = await database
      .from("captures")
      .insert({
        input_type: "text",
        raw_text: `We are hiring an Engineer. Send your CV to ${contactEmail}.`,
        role: "Engineer",
        contact_email: contactEmail,
        status: "processing",
        run_id: run.data.id,
      })
      .select("id")
      .single();
    if (capture.error) throw capture.error;
    captureIds.push(capture.data.id);
    return { captureId: capture.data.id, runId: run.data.id };
  }

  /** Runs queued steps in order, as the worker would, until none are left. */
  async function runQueuedSteps(maxSteps = 10) {
    for (let count = 0; queued.length > 0 && count < maxSteps; count++) {
      const next = queued.shift();
      // The Gmail draft step has its own test (gmail-draft.test.ts); here it is only collected.
      if (next?.step === "create_gmail_draft") {
        gmailDraftsQueued.push(next.payload);
        continue;
      }
      if (next?.step !== "advance_writer") throw new Error(`Unexpected step ${next?.step}`);
      await advanceWriter(next.payload as { applicationId: string });
    }
  }

  // Every stage saves a LangGraph checkpoint over the network, so the whole loop takes about 25 seconds from CI.
  test("writes, checks and saves an application, one stage per queued step", async () => {
    const email = `jobs-${randomUUID()}@acme.example`;
    const { captureId, runId } = await createCapture(email);
    invokeModel.mockResolvedValueOnce(modelAnswer(SUPPORTED_DRAFT)).mockResolvedValueOnce(modelAnswer({ problems: [] }));

    await prepareEmailApplication({ captureId });
    const [{ payload }] = queued;
    const { applicationId } = payload as { applicationId: string };
    applicationIds.push(applicationId);
    await runQueuedSteps();

    const { data: application } = await database
      .from("applications")
      .select("status, recipient_email, subject, body, presented_title, cv_file_id, email_pattern_id, writer_lease_until")
      .eq("id", applicationId)
      .single();
    expect(application).toMatchObject({
      status: "ready",
      recipient_email: email,
      subject: SUPPORTED_DRAFT.subject,
      body: `${SUPPORTED_DRAFT.body}\n\n${SUPPORTED_DRAFT.signature}`,
      presented_title: "Software Engineer",
      writer_lease_until: null,
    });
    expect(application?.cv_file_id).not.toBeNull();
    expect(application?.email_pattern_id).not.toBeNull();

    const { data: capture } = await database.from("captures").select("status").eq("id", captureId).single();
    const { data: run } = await database.from("runs").select("status").eq("id", runId).single();
    const { data: calls } = await database.from("model_calls").select("step, application_id").eq("run_id", runId);
    expect(capture?.status).toBe("done");
    expect(run?.status).toBe("succeeded");
    expect(calls?.map((call) => call.step).sort()).toEqual(["check_email", "write_email"]);
    expect(calls?.every((call) => call.application_id === applicationId)).toBe(true);
    expect(gmailDraftsQueued).toEqual([{ applicationId }]);

    // Run again, both steps change nothing and call no model.
    await prepareEmailApplication({ captureId });
    await runQueuedSteps();
    expect(invokeModel).toHaveBeenCalledTimes(2);
  }, WHOLE_LOOP_TIMEOUT_MS);

  test("a retry that finds the outcome already saved still closes the capture and queues the draft", async () => {
    const { captureId, runId } = await createCapture(`jobs-${randomUUID()}@acme.example`);
    invokeModel.mockResolvedValueOnce(modelAnswer(SUPPORTED_DRAFT)).mockResolvedValueOnce(modelAnswer({ problems: [] }));
    await prepareEmailApplication({ captureId });
    const { applicationId } = queued[0].payload as { applicationId: string };
    applicationIds.push(applicationId);
    await runQueuedSteps();

    // As if the call that saved the outcome died before closing the capture and its run.
    await database.from("captures").update({ status: "processing" }).eq("id", captureId);
    await database.from("runs").update({ status: "running", finished_at: null }).eq("id", runId);
    gmailDraftsQueued.length = 0;
    await advanceWriter({ applicationId });
    await runQueuedSteps();

    const { data: capture } = await database.from("captures").select("status").eq("id", captureId).single();
    const { data: run } = await database.from("runs").select("status").eq("id", runId).single();
    expect(capture?.status).toBe("done");
    expect(run?.status).toBe("succeeded");
    expect(gmailDraftsQueued).toEqual([{ applicationId }]);
    expect(invokeModel).toHaveBeenCalledTimes(2);
  });

  test("a second capture of the same job, to the same address, is marked a duplicate (C5, X6)", async () => {
    const email = `jobs-${randomUUID()}@acme.example`;
    const first = await createCapture(email);
    await prepareEmailApplication({ captureId: first.captureId });
    applicationIds.push((queued[0].payload as { applicationId: string }).applicationId);

    const second = await createCapture(email);
    await prepareEmailApplication({ captureId: second.captureId });

    const { data } = await database.from("captures").select("status").eq("id", second.captureId).single();
    expect(data?.status).toBe("duplicate");
    expect(queued).toHaveLength(1);
  });

  test("a step that finds another worker's lease does nothing", async () => {
    const { captureId } = await createCapture(`jobs-${randomUUID()}@acme.example`);
    await prepareEmailApplication({ captureId });
    const { applicationId } = queued[0].payload as { applicationId: string };
    applicationIds.push(applicationId);
    const leased = new Date(Date.now() + 30_000).toISOString();
    await database.from("applications").update({ writer_lease_until: leased }).eq("id", applicationId);
    queued.length = 0;

    await advanceWriter({ applicationId });

    expect(invokeModel).not.toHaveBeenCalled();
    expect(queued).toHaveLength(0);
  });
});
