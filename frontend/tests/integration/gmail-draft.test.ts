import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createGmailDraft, queueMissingDrafts } from "@/features/applications/steps/gmail-draft";
import { claimLease, whileLeased } from "@/features/applications/steps/writer-steps";
import type { DraftEmail } from "@/server/gmail/schemas";
import { getAdminClient } from "@/server/supabase/admin";

// Gmail is an in-memory mailbox, so no real draft is made; queued steps never reach the real queue.
const gmail = vi.hoisted(() => ({
  connected: true,
  drafts: new Map<string, { id: string; email: DraftEmail }>(),
  created: 0,
}));
vi.mock("@/server/gmail/gmail", () => ({
  getGmailAccessToken: async () => (gmail.connected ? "access-token" : null),
  findDraft: async (_token: string, to: string, subject: string) => gmail.drafts.get(`${to}|${subject}`)?.id ?? null,
  createDraft: async (_token: string, email: DraftEmail) => {
    gmail.created++;
    const id = `draft-${gmail.created}`;
    gmail.drafts.set(`${email.to}|${email.subject}`, { id, email });
    return id;
  },
}));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => {
    queued.push({ step, payload });
    return queued.length;
  },
}));

describe("create_gmail_draft", () => {
  const database = getAdminClient();
  const applicationIds: string[] = [];

  beforeEach(() => {
    gmail.connected = true;
    gmail.drafts.clear();
    gmail.created = 0;
    queued.length = 0;
  });

  afterAll(async () => {
    await database.from("applications").delete().in("id", applicationIds);
  });

  async function createReadyApplication() {
    const cv = await database.from("cv_files").select("id, file_name").eq("is_current", true).limit(1).single();
    if (cv.error) throw cv.error;
    const application = await database
      .from("applications")
      .insert({
        route: "email",
        status: "ready",
        recipient_email: "jobs@acme.example",
        subject: "Application for the Engineer role",
        body: "Hi team,\n\nMy CV is attached.\n\nRegards,\nThe Owner",
        cv_file_id: cv.data.id,
        fingerprint: `gmail-draft-test-${randomUUID()}`,
      })
      .select("id")
      .single();
    if (application.error) throw application.error;
    applicationIds.push(application.data.id);
    return { applicationId: application.data.id, cvFileName: cv.data.file_name };
  }

  async function savedDraftId(applicationId: string) {
    const { data } = await database.from("applications").select("gmail_draft_id").eq("id", applicationId).single();
    return data?.gmail_draft_id;
  }

  test("saves a ready application as one Gmail draft with its CV, also when run twice", async () => {
    const { applicationId, cvFileName } = await createReadyApplication();

    await createGmailDraft({ applicationId });
    await createGmailDraft({ applicationId });

    expect(gmail.created).toBe(1);
    expect(await savedDraftId(applicationId)).toBe("draft-1");
    const [{ email }] = gmail.drafts.values();
    expect(email).toMatchObject({ to: "jobs@acme.example", subject: "Application for the Engineer role" });
    expect(email.attachment.fileName).toBe(cvFileName);
    expect(email.attachment.content.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("two copies at once make one draft: a copy that finds the application busy fails, to be retried", async () => {
    const { applicationId } = await createReadyApplication();

    const results = await Promise.allSettled([createGmailDraft({ applicationId }), createGmailDraft({ applicationId })]);
    await createGmailDraft({ applicationId });

    expect(gmail.created).toBe(1);
    for (const result of results) {
      if (result.status === "rejected") expect(String(result.reason)).toMatch(/is busy/);
    }
    const { data } = await database.from("applications").select("writer_lease_until").eq("id", applicationId).single();
    expect(data?.writer_lease_until).toBeNull();
  });

  test("releasing a lease leaves alone one another worker claimed after it ran out", async () => {
    const { applicationId } = await createReadyApplication();
    const lease = await claimLease(applicationId);
    if (!lease) throw new Error("The lease should be free");
    const theirs = new Date(Date.now() + 60_000).toISOString();

    await whileLeased(applicationId, lease, async () => {
      await database.from("applications").update({ writer_lease_until: theirs }).eq("id", applicationId);
    });

    const { data } = await database.from("applications").select("writer_lease_until").eq("id", applicationId).single();
    expect(new Date(data?.writer_lease_until ?? 0).getTime()).toBe(new Date(theirs).getTime());
    expect(await claimLease(applicationId)).toBeNull();
  });

  test("a retry after Gmail made the draft, but before its id was saved, finds that draft instead of making another", async () => {
    const { applicationId } = await createReadyApplication();
    await createGmailDraft({ applicationId });
    await database.from("applications").update({ gmail_draft_id: null }).eq("id", applicationId);

    await createGmailDraft({ applicationId });

    expect(gmail.created).toBe(1);
    expect(await savedDraftId(applicationId)).toBe("draft-1");
  });

  test("before Gmail is connected, the application waits; connecting queues it", async () => {
    gmail.connected = false;
    const { applicationId } = await createReadyApplication();

    await createGmailDraft({ applicationId });
    expect(await savedDraftId(applicationId)).toBeNull();

    await queueMissingDrafts();
    expect(queued).toContainEqual({ step: "create_gmail_draft", payload: { applicationId } });
  });

  test("a blocked application gets no draft", async () => {
    const { applicationId } = await createReadyApplication();
    await database.from("applications").update({ status: "blocked" }).eq("id", applicationId);

    await createGmailDraft({ applicationId });

    expect(gmail.created).toBe(0);
  });
});
