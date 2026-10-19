import "server-only";
import { requireOwner } from "@/server/auth/require-owner";
import { isGmailConnected } from "@/server/gmail/gmail";

// Data Access Layer for settings: the feature's reads, each starting with the owner check.

/** True once the owner has allowed Gmail drafts (X1). */
export async function getGmailConnected(): Promise<boolean> {
  await requireOwner();
  return isGmailConnected();
}
