import { describe, expect, it } from "vitest";
import { mergeWord } from "./merge";
import { makeWord } from "@/lib/testutil";

const at = (iso: string) => makeWord({ updated_at: iso });

describe("mergeWord (last-write-wins, SPEC 6.4)", () => {
  it("takes remote when there is no local copy", () => {
    expect(mergeWord(undefined, { updated_at: "2026-09-02T00:00:00Z" }, false)).toEqual({
      take: true,
      dropDirty: false,
    });
  });

  it("clean local: newer remote wins", () => {
    const d = mergeWord(at("2026-09-01T00:00:00Z"), { updated_at: "2026-09-02T00:00:00Z" }, false);
    expect(d.take).toBe(true);
  });

  it("clean local: older remote is ignored", () => {
    const d = mergeWord(at("2026-09-03T00:00:00Z"), { updated_at: "2026-09-02T00:00:00Z" }, false);
    expect(d.take).toBe(false);
  });

  it("dirty local: kept unless remote is strictly newer", () => {
    expect(
      mergeWord(at("2026-09-02T00:00:00Z"), { updated_at: "2026-09-02T00:00:00Z" }, true),
    ).toEqual({ take: false, dropDirty: false });
  });

  it("dirty local: strictly newer remote wins and drops the pending edit", () => {
    expect(
      mergeWord(at("2026-09-02T00:00:00Z"), { updated_at: "2026-09-02T09:00:00Z" }, true),
    ).toEqual({ take: true, dropDirty: true });
  });
});
