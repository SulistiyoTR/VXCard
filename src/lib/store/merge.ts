import type { UserCard } from "@/lib/types";

export interface MergeDecision {
  /** Overwrite the local row with the remote one. */
  take: boolean;
  /** Clear the local dirty flag (remote superseded our pending edit). */
  dropDirty: boolean;
}

/**
 * Last-write-wins for one `user_cards` row (SPEC 6.4). Shared `words` content is
 * server-authoritative and simply overwritten on pull — only per-user cards can
 * conflict.
 *
 * - no local copy → take remote
 * - local is clean → take remote when it is at least as new
 * - local is dirty (unpushed edit) → keep it unless remote is strictly newer,
 *   in which case remote wins and the pending edit is dropped
 */
export function mergeCard(
  local: UserCard | undefined,
  remote: Pick<UserCard, "updated_at">,
  localIsDirty: boolean,
): MergeDecision {
  if (!local) return { take: true, dropDirty: false };
  if (!localIsDirty) {
    return { take: remote.updated_at >= local.updated_at, dropDirty: false };
  }
  if (remote.updated_at > local.updated_at) {
    return { take: true, dropDirty: true };
  }
  return { take: false, dropDirty: false };
}
