import type { Word } from "@/lib/types";

export interface MergeDecision {
  /** Overwrite the local row with the remote one. */
  take: boolean;
  /** Clear the local dirty flag (remote superseded our pending edit). */
  dropDirty: boolean;
}

/**
 * Last-write-wins for one word row (SPEC 6.4).
 *
 * - no local copy → take remote
 * - local is clean → take remote when it is at least as new
 * - local is dirty (unpushed edit) → keep it unless remote is strictly newer,
 *   in which case remote wins and the pending edit is dropped
 */
export function mergeWord(
  local: Word | undefined,
  remote: Pick<Word, "updated_at">,
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
