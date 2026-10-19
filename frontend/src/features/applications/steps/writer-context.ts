import "server-only";
import { getAdminClient } from "@/server/supabase/admin";

// What the writer works from (PLAN.md item 2.2): the post, and the owner's material from Supabase.
// Loaded at the start of every stage instead of being kept in the graph's saved state, so the saved
// state stays small and every stage uses the latest version of the profile.

/** The email patterns that fit a captured post with an email address (P7). Their names come from
 * the headings in private/email-patterns.md; the other patterns are for referrals and job-board notes. */
export const CAPTURE_EMAIL_PATTERNS = ["post-reply", "proof-first-cold-email"] as const;

const WRITING_GUIDE = "writing-guide";

export type EmailPattern = { id: string; name: string; content: string };

/** The owner's material, the same for every application. */
export type OwnerMaterial = {
  profile: string;
  answerBank: string;
  writingGuide: string;
  voiceExamples: string[];
  patterns: EmailPattern[];
  /** The CV variants with a current file, to choose from (P2). */
  cvVariants: string[];
};

export type PostDetails = { text: string; role: string | null; company: string | null; posterName: string | null };

export type WriterContext = OwnerMaterial & {
  /** Model calls are linked to these, so each draft can be explained afterwards (B1). */
  link: { runId?: string; applicationId?: string };
  post: PostDetails;
  /** Always the address from the capture, never one a model wrote (principle 4). */
  recipientEmail: string;
};

export async function loadWriterContext(applicationId: string): Promise<WriterContext> {
  const application = await getAdminClient()
    .from("applications")
    .select("recipient_email, captures (run_id, raw_text, role, company, poster_name)")
    .eq("id", applicationId)
    .single();
  if (application.error) throw new Error(`Could not load application ${applicationId}: ${application.error.message}`);

  const capture = application.data.captures;
  if (!capture?.raw_text || !application.data.recipient_email) {
    throw new Error(`Application ${applicationId} has no post text or recipient`);
  }

  return {
    ...(await loadOwnerMaterial()),
    link: { runId: capture.run_id ?? undefined, applicationId },
    post: { text: capture.raw_text, role: capture.role, company: capture.company, posterName: capture.poster_name },
    recipientEmail: application.data.recipient_email,
  };
}

export async function loadOwnerMaterial(): Promise<OwnerMaterial> {
  const db = getAdminClient();
  const [documents, cvFiles] = await Promise.all([
    db.from("current_documents").select("id, kind, name, content").order("name"),
    db.from("cv_files").select("variant").eq("is_current", true).order("variant"),
  ]);
  if (documents.error) throw new Error(`Could not load the owner's documents: ${documents.error.message}`);
  if (cvFiles.error) throw new Error(`Could not load the CV list: ${cvFiles.error.message}`);

  const ofKind = (kind: string) => documents.data.filter((document) => document.kind === kind);
  const contentOf = (kind: string, name: string) => ofKind(kind).find((document) => document.name === name)?.content;

  const patterns = ofKind("email_pattern").flatMap((document) =>
    document.id && document.name && document.content && isCapturePattern(document.name)
      ? [{ id: document.id, name: document.name, content: document.content }]
      : [],
  );
  const profile = ofKind("profile").map((document) => `## ${document.name}\n\n${document.content}`);
  const answerBank = contentOf("answer_bank", "main");
  const writingGuide = contentOf("email_pattern", WRITING_GUIDE);

  if (profile.length === 0 || !answerBank || !writingGuide || patterns.length === 0 || cvFiles.data.length === 0) {
    throw new Error("The owner's material is incomplete: run pnpm profile:load");
  }

  return {
    profile: profile.join("\n\n"),
    answerBank,
    writingGuide,
    voiceExamples: ofKind("voice_example").flatMap((document) => (document.content ? [document.content] : [])),
    patterns,
    cvVariants: cvFiles.data.map((file) => file.variant),
  };
}

function isCapturePattern(name: string): boolean {
  return (CAPTURE_EMAIL_PATTERNS as readonly string[]).includes(name);
}
