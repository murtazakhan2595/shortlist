import "server-only";
import { requireOwner } from "@/server/auth/require-owner";
import { findAllOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";

export type FailureWithPage = OpenFailure & { href: string };

export async function getOpenFailures(): Promise<FailureWithPage[]> {
  const { db } = await requireOwner();
  const failures = await findAllOpenFailures(db);
  const ids = failures.flatMap((failure) => failure.targetIds);
  if (ids.length === 0) return [];

  const [captures, applications] = await Promise.all([
    db.from("captures").select("id").in("id", ids),
    db.from("applications").select("id, route, capture_id").in("id", ids),
  ]);
  if (captures.error) throw new Error(`Could not find the failed steps' captures: ${captures.error.message}`);
  if (applications.error) throw new Error(`Could not find the failed steps' applications: ${applications.error.message}`);

  const pages = new Map<string, string>();
  for (const capture of captures.data) pages.set(capture.id, `/captures/${capture.id}`);
  for (const application of applications.data) {
    if (application.route === "form") pages.set(application.id, `/forms/${application.id}`);
    else if (application.capture_id) pages.set(application.id, `/captures/${application.capture_id}`);
  }
  // Anything else is a run, a listing or a listing's note.
  return failures.map((failure) => ({
    ...failure,
    href: failure.targetIds.map((id) => pages.get(id)).find(Boolean) ?? "/jobs",
  }));
}
