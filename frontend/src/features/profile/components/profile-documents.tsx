import type { OwnerMaterialView } from "../data";
import { DOCUMENT_KINDS, type DocumentKind } from "../schemas";
import { CvFiles } from "./cv-files";
import { DocumentEditor } from "./document-editor";

const SECTIONS: Record<DocumentKind, { title: string; description: string }> = {
  profile: { title: "Profile", description: "Your jobs, projects, courses and recommendations." },
  answer_bank: {
    title: "Answer bank",
    description: "Your standard answers to form and email questions. Answers you save from a form are added at the end.",
  },
  email_pattern: { title: "Email patterns", description: "How application emails are structured and written." },
  voice_example: { title: "Voice examples", description: "Emails you wrote, so drafts sound like you." },
};

const SAVED_ON = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ProfileDocuments({ material }: { material: OwnerMaterialView }) {
  return (
    <div className="flex flex-col gap-10">
      {DOCUMENT_KINDS.map((kind) => {
        const documents = material.documents.filter((document) => document.kind === kind);
        return (
          <section key={kind} aria-labelledby={`${kind}-heading`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id={`${kind}-heading`} className="text-lg font-semibold">
                {SECTIONS[kind].title}
              </h2>
              <p className="text-sm text-ink-muted">{SECTIONS[kind].description}</p>
            </div>
            {documents.length === 0 ? (
              <p className="text-ink-muted">Nothing stored yet.</p>
            ) : (
              <ul className="flex flex-col">
                {documents.map((document) => (
                  <li key={document.name} className="border-t border-rule">
                    <details className="group">
                      <summary className="flex cursor-pointer items-baseline justify-between gap-3 py-3 hover:underline">
                        <span className="font-medium break-all">{document.name}</span>
                        <span className="shrink-0 text-sm text-ink-muted">
                          Version {document.version}, {SAVED_ON.format(new Date(document.savedAt))}
                        </span>
                      </summary>
                      <div className="pb-5">
                        <DocumentEditor
                          kind={document.kind}
                          name={document.name}
                          content={document.content}
                          version={document.version}
                        />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section aria-labelledby="cvs-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="cvs-heading" className="text-lg font-semibold">
            CVs
          </h2>
          <p className="text-sm text-ink-muted">
            The CV for each kind of role. Each email and note uses the one that fits the job. A new one is used from the
            next draft; drafts already made keep theirs.
          </p>
        </div>
        <CvFiles cvs={material.cvs} />
      </section>
    </div>
  );
}
