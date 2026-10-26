import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileDocuments } from "@/features/profile/components/profile-documents";
import { getOwnerMaterial } from "@/features/profile/data";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-ink-muted">
          What your emails and form answers are written from. Nothing is claimed about you unless it is here. Saving a
          change keeps the old version.
        </p>
      </div>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Material />
      </Suspense>
    </main>
  );
}

async function Material() {
  return <ProfileDocuments material={await getOwnerMaterial()} />;
}
