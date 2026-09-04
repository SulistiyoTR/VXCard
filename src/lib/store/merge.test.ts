import { describe, expect, it } from "vitest";
import { mergeCard } from "./merge";
import { makeCard } from "@/lib/testutil";

const at = (iso: string) => makeCard({ updated_at: iso });

describe("mergeCard (last-write-wins, SPEC 6.4)", () => {
  it("takes remote when there is no local copy", () => {
    expect(mergeCard(undefined, { updated_at: "2026-09-02T00:00:00Z" }, false)).toEqual({
      take: true,
      dropDirty: false,
    });
  });

  it("clean local: newer remote wins", () => {
    const d = mergeCard(at("2026-09-01T00:00:00Z"), { updated_at: "2026-09-02T00:00:00Z" }, false);
    expect(d.take).toBe(true);
  });

  it("clean local: older remote is ignored", () => {
    const d = mergeCard(at("2026-09-03T00:00:00Z"), { updated_at: "2026-09-02T00:00:00Z" }, false);
    expect(d.take).toBe(false);
  });

  it("dirty local: kept unless remote is strictly newer", () => {
    expect(
      mergeCard(at("2026-09-02T00:00:00Z"), { updated_at: "2026-09-02T00:00:00Z" }, true),
    ).toEqual({ take: false, dropDirty: false });
  });

  it("dirty local: strictly newer remote wins and drops the pending edit", () => {
    expect(
      mergeCard(at("2026-09-02T00:00:00Z"), { updated_at: "2026-09-02T09:00:00Z" }, true),
    ).toEqual({ take: true, dropDirty: true });
  });
});
