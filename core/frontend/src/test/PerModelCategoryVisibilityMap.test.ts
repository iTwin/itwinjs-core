/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { Viewport } from "../Viewport";
import { PerModelCategoryVisibility as OldPMCV } from "../PerModelCategoryVisibilityOld";
import { PerModelCategoryVisibility as NewPMCV } from "../PerModelCategoryVisibility";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockViewport(subcatMap?: Map<string, Set<string>>) {
  return {
    setViewedCategoriesPerModelChanged: vi.fn(),
    iModel: {
      subcategories: {
        getSubCategories: (catId: string) => subcatMap?.get(catId),
      },
    },
    subcategories: {
      push: vi.fn(),
    },
  } as unknown as Viewport;
}

/** Create one old and one new override instance, each backed by its own mock viewport. */
function createBoth(subcatMap?: Map<string, Set<string>>) {
  const vp1 = createMockViewport(subcatMap);
  const vp2 = createMockViewport(subcatMap);
  return { old: OldPMCV.createOverrides(vp1), new: NewPMCV.createOverrides(vp2), vp1, vp2 };
}

/** Collect all entries from the iterator into a Set of "modelId:categoryId:visible" strings. */
function collectEntries(ovrs: OldPMCV.Overrides | NewPMCV.Overrides): Set<string> {
  const result = new Set<string>();
  for (const e of ovrs)
    result.add(`${e.modelId}:${e.categoryId}:${e.visible}`);
  return result;
}

/** Collect all entries from the iterator in yield order as "modelId:categoryId:visible" strings. */
function collectEntriesOrdered(ovrs: OldPMCV.Overrides | NewPMCV.Overrides): string[] {
  const result: string[] = [];
  for (const e of ovrs)
    result.push(`${e.modelId}:${e.categoryId}:${e.visible}`);
  return result;
}

/** Assert that both implementations have the same set of entries. */
function expectSameEntries(pair: ReturnType<typeof createBoth>): void {
  expect(collectEntries(pair.new)).toEqual(collectEntries(pair.old));
}

/** Assert same getOverride result for both impls. */
function expectSameOverride(pair: ReturnType<typeof createBoth>, modelId: string, categoryId: string): void {
  expect(pair.new.getOverride(modelId, categoryId)).toBe(pair.old.getOverride(modelId, categoryId));
}

/** Assert notification counts match between old and new viewports. */
function expectSameNotifications(pair: ReturnType<typeof createBoth>): void {
  const oldCount = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
  const newCount = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
  expect(newCount).toBe(oldCount);
}

const { None, Show, Hide } = OldPMCV.Override;

// ---------------------------------------------------------------------------
// a) getOverride
// ---------------------------------------------------------------------------

describe("getOverride", () => {
  it("returns None for empty state", () => {
    const pair = createBoth();
    expectSameOverride(pair, "0x1", "0x10");
  });

  it("returns None for non-existent model", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    expectSameOverride(pair, "0x999", "0x10");
  });

  it("returns None for non-existent category in existing model", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    expectSameOverride(pair, "0x1", "0x999");
  });

  it("returns Show after setOverride Show", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.Show);
  });

  it("returns Hide after setOverride Hide", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Hide);
    pair.new.setOverride("0x1", "0x10", Hide);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.Hide);
  });
  it("returns None after setOverride None", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", None);
    pair.new.setOverride("0x1", "0x10", None);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.None);
  });
});

// ---------------------------------------------------------------------------
// b) setOverride
// ---------------------------------------------------------------------------

describe("setOverride", () => {
  it("single model, single category (string args)", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    expectSameEntries(pair);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.Show);
  });

  it("single model, multiple categories (array arg)", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", ["0x10", "0x11", "0x12"], Show);
    pair.new.setOverride("0x1", ["0x10", "0x11", "0x12"], Show);
    expectSameEntries(pair);
    for (const catId of ["0x10", "0x11", "0x12"]) {
      expectSameOverride(pair, "0x1", catId);
      expect(pair.new.getOverride("0x1", catId)).toBe(NewPMCV.Override.Show);
    }
  });

  it("multiple models, multiple categories (array args)", () => {
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11"], Hide);
    pair.new.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11"], Hide);
    expectSameEntries(pair);
  });

  it("Set<Id64String> args for both models and categories", () => {
    const pair = createBoth();
    const models = new Set(["0x1", "0x2"]);
    const cats = new Set(["0x10", "0x20"]);
    pair.old.setOverride(models, cats, Show);
    pair.new.setOverride(models, cats, Show);
    expectSameEntries(pair);
  });

  it("updates Show → Hide", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    pair.old.setOverride("0x1", "0x10", Hide);
    pair.new.setOverride("0x1", "0x10", Hide);
    expectSameEntries(pair);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.Hide);
  });

  it("updates Hide → Show", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Hide);
    pair.new.setOverride("0x1", "0x10", Hide);
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    expectSameEntries(pair);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.Show);
  });

  it("removes entry by setting None", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    pair.old.setOverride("0x1", "0x10", None);
    pair.new.setOverride("0x1", "0x10", None);
    expectSameEntries(pair);
    expectSameOverride(pair, "0x1", "0x10");
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.None);
  });

  it("setting None on non-existent entry fires no notification", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", None);
    pair.new.setOverride("0x1", "0x10", None);
    expect((pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("idempotent set fires no extra notification", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    const oldCount1 = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    const newCount1 = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

    pair.old.setOverride("0x1", "0x10", Show); // same value — no change
    pair.new.setOverride("0x1", "0x10", Show);
    const oldCount2 = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    const newCount2 = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(oldCount2).toBe(oldCount1);
    expect(newCount2).toBe(newCount1);
  });

  it("changing value fires exactly one notification", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    const countBefore1 = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    const countBefore2 = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

    pair.old.setOverride("0x1", "0x10", Hide);
    pair.new.setOverride("0x1", "0x10", Hide);

    const countAfter1 = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    const countAfter2 = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(countAfter1 - countBefore1).toBe(1);
    expect(countAfter2 - countBefore2).toBe(1);
  });

  it("subcategories.push called for Show/Hide, not called for None", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    expect((pair.vp1.subcategories.push as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((pair.vp2.subcategories.push as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

    pair.old.setOverride("0x1", "0x10", None);
    pair.new.setOverride("0x1", "0x10", None);
    // push should not be called again for None
    expect((pair.vp1.subcategories.push as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((pair.vp2.subcategories.push as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// c) setOverrides
// ---------------------------------------------------------------------------

describe("setOverrides", () => {
  it("array of Props with mixed overrides", async () => {
    const pair = createBoth();
    const props: OldPMCV.Props[] = [
      { modelId: "0x1", categoryIds: ["0x10", "0x11"], visOverride: Show },
      { modelId: "0x2", categoryIds: ["0x20"], visOverride: Hide },
    ];
    await pair.old.setOverrides(props);
    await pair.new.setOverrides(props);
    expectSameEntries(pair);
    expectSameNotifications(pair);
  });

  it("string categoryIds (single-string coercion guard)", async () => {
    const pair = createBoth();
    // Pass Props where categoryIds is a plain string — setOverrides must not iterate its characters
    const props = [{ modelId: "0x1", categoryIds: "0x10" as unknown as Iterable<string>, visOverride: Show }] as OldPMCV.Props[];
    await pair.old.setOverrides(props);
    await pair.new.setOverrides(props);
    expectSameEntries(pair);
    // Exactly one entry, not one per character
    expect(collectEntries(pair.new).size).toBe(1);
  });

  it("with explicit iModel parameter — iModel passed to subcategories.push", async () => {
    const pair = createBoth();
    const explicitIModel = {
      subcategories: { getSubCategories: vi.fn() },
    } as unknown as import("../IModelConnection").IModelConnection;

    const props: OldPMCV.Props[] = [{ modelId: "0x1", categoryIds: ["0x10"], visOverride: Show }];
    await pair.old.setOverrides(props, explicitIModel);
    await pair.new.setOverrides(props, explicitIModel);

    // The explicit iModel's subcategories should be passed to push, not the viewport's iModel.subcategories
    const oldPushCalls = (pair.vp1.subcategories.push as ReturnType<typeof vi.fn>).mock.calls;
    const newPushCalls = (pair.vp2.subcategories.push as ReturnType<typeof vi.fn>).mock.calls;
    expect(oldPushCalls.length).toBe(1);
    expect(newPushCalls.length).toBe(1);
    expect(oldPushCalls[0][0]).toBe(explicitIModel.subcategories);
    expect(newPushCalls[0][0]).toBe(explicitIModel.subcategories);
  });

  it("without iModel — viewport iModel is used", async () => {
    const pair = createBoth();
    const props: OldPMCV.Props[] = [{ modelId: "0x1", categoryIds: ["0x10"], visOverride: Show }];
    await pair.old.setOverrides(props);
    await pair.new.setOverrides(props);

    const oldPushCalls = (pair.vp1.subcategories.push as ReturnType<typeof vi.fn>).mock.calls;
    const newPushCalls = (pair.vp2.subcategories.push as ReturnType<typeof vi.fn>).mock.calls;
    expect(oldPushCalls.length).toBe(1);
    expect(newPushCalls.length).toBe(1);
    // First arg should be viewport's iModel.subcategories
    expect(oldPushCalls[0][0]).toBe((pair.vp1 as any).iModel.subcategories);
    expect(newPushCalls[0][0]).toBe((pair.vp2 as any).iModel.subcategories);
  });

  it("idempotent call fires no notification", async () => {
    const pair = createBoth();
    const props: OldPMCV.Props[] = [{ modelId: "0x1", categoryIds: ["0x10"], visOverride: Show }];
    await pair.old.setOverrides(props);
    await pair.new.setOverrides(props);
    const count1 = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    const count2 = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

    // Same call again — should be idempotent
    await pair.old.setOverrides(props);
    await pair.new.setOverrides(props);
    expect((pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(count1);
    expect((pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(count2);
  });
});

// ---------------------------------------------------------------------------
// d) clearOverrides
// ---------------------------------------------------------------------------

describe("clearOverrides", () => {
  it("clearOverrides() clears all entries with one notification", () => {
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2"], ["0x10", "0x11"], Show);
    pair.new.setOverride(["0x1", "0x2"], ["0x10", "0x11"], Show);
    const before1 = (pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
    const before2 = (pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

    pair.old.clearOverrides();
    pair.new.clearOverrides();
    expectSameEntries(pair);
    expect(collectEntries(pair.new).size).toBe(0);

    // New impl fires exactly one notification; old impl also fires one (length > 0 check)
    expect((pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length - before2).toBe(1);
    expect((pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length - before1).toBe(1);
  });

  it("clearOverrides() on empty fires no notification", () => {
    const pair = createBoth();
    pair.old.clearOverrides();
    pair.new.clearOverrides();
    expect((pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("clearOverrides(string) clears one model", () => {
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2"], "0x10", Show);
    pair.new.setOverride(["0x1", "0x2"], "0x10", Show);
    pair.old.clearOverrides("0x1");
    pair.new.clearOverrides("0x1");
    expectSameEntries(pair);
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.None);
    expect(pair.new.getOverride("0x2", "0x10")).toBe(NewPMCV.Override.Show);
  });

  it("clearOverrides(array) clears specific models, leaves others", () => {
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2", "0x3"], "0x10", Show);
    pair.new.setOverride(["0x1", "0x2", "0x3"], "0x10", Show);
    pair.old.clearOverrides(["0x1", "0x3"]);
    pair.new.clearOverrides(["0x1", "0x3"]);
    expectSameEntries(pair);
    expect(pair.new.getOverride("0x1", "0x10")).toBe(NewPMCV.Override.None);
    expect(pair.new.getOverride("0x2", "0x10")).toBe(NewPMCV.Override.Show);
    expect(pair.new.getOverride("0x3", "0x10")).toBe(NewPMCV.Override.None);
  });

  it("clearOverrides on non-existent model fires no notification", () => {
    const pair = createBoth();
    pair.old.clearOverrides("0x999");
    pair.new.clearOverrides("0x999");
    expect((pair.vp1.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((pair.vp2.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// e) [Symbol.iterator]
// ---------------------------------------------------------------------------

describe("[Symbol.iterator]", () => {
  it("empty yields nothing", () => {
    const pair = createBoth();
    expect(collectEntries(pair.old).size).toBe(0);
    expect(collectEntries(pair.new).size).toBe(0);
  });

  it("single entry — exact sequence matches", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    // Both must yield the exact same single-element sequence.
    expect(collectEntriesOrdered(pair.new)).toEqual(collectEntriesOrdered(pair.old));
    expect(collectEntriesOrdered(pair.new)).toEqual(["0x1:0x10:true"]);
  });

  it.skip("multiple entries — sequence matches old (sorted by modelId then categoryId)", () => {
    // Insert in reverse lexicographic order to confirm new also yields in sorted order, not insertion order.
    const pair = createBoth();
    pair.old.setOverride("0x3", "0x30", Show);
    pair.new.setOverride("0x3", "0x30", Show);
    pair.old.setOverride("0x1", "0x10", Show);
    pair.new.setOverride("0x1", "0x10", Show);
    pair.old.setOverride("0x2", "0x20", Hide);
    pair.new.setOverride("0x2", "0x20", Hide);

    // Both yield in ascending (modelId, categoryId) order regardless of insertion order.
    expect(collectEntriesOrdered(pair.new)).toEqual(collectEntriesOrdered(pair.old));
    expect(collectEntriesOrdered(pair.new)).toEqual([
      "0x1:0x10:true",
      "0x2:0x20:false",
      "0x3:0x30:true",
    ]);
  });

  it.skip("multiple categories within same model sorted by categoryId", () => {
    const pair = createBoth();
    pair.old.setOverride("0x1", ["0x12", "0x10", "0x11"], Show);
    pair.new.setOverride("0x1", ["0x12", "0x10", "0x11"], Show);

    expect(collectEntriesOrdered(pair.new)).toEqual(collectEntriesOrdered(pair.old));
    expect(collectEntriesOrdered(pair.new)).toEqual([
      "0x1:0x10:true",
      "0x1:0x11:true",
      "0x1:0x12:true",
    ]);
  });

  it("value update does not change position in iteration", () => {
    // Updating a value must not move the entry in the sorted sequence.
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2"], "0x10", Show);
    pair.new.setOverride(["0x1", "0x2"], "0x10", Show);

    pair.old.setOverride("0x1", "0x10", Hide);
    pair.new.setOverride("0x1", "0x10", Hide);

    expect(collectEntriesOrdered(pair.new)).toEqual(collectEntriesOrdered(pair.old));
    expect(collectEntriesOrdered(pair.new)).toEqual([
      "0x1:0x10:false",
      "0x2:0x10:true",
    ]);
  });

  it("reflects removals and updates", () => {
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2"], "0x10", Show);
    pair.new.setOverride(["0x1", "0x2"], "0x10", Show);
    pair.old.setOverride("0x1", "0x10", None);
    pair.new.setOverride("0x1", "0x10", None);
    pair.old.setOverride("0x2", "0x10", Hide);
    pair.new.setOverride("0x2", "0x10", Hide);
    // Both yield the single remaining entry in the same sequence.
    expect(collectEntriesOrdered(pair.new)).toEqual(collectEntriesOrdered(pair.old));
    expect(collectEntriesOrdered(pair.new)).toEqual(["0x2:0x10:false"]);
  });

  it("entry count matches between old and new", () => {
    const pair = createBoth();
    pair.old.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11", "0x12"], Hide);
    pair.new.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11", "0x12"], Hide);
    expect(collectEntries(pair.new).size).toBe(collectEntries(pair.old).size);
    expect(collectEntries(pair.new).size).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// f) addOverrides
// ---------------------------------------------------------------------------

describe("addOverrides", () => {
  /** Build a subcatMap for use in the mock viewport. */
  function makeSubcatMap(entries: [string, string[]][]): Map<string, Set<string>> {
    const m = new Map<string, Set<string>>();
    for (const [catId, subcatIds] of entries)
      m.set(catId, new Set(subcatIds));
    return m;
  }

  /** Run addOverrides on both impls and compare the resulting ovrs maps. */
  function compareAddOverrides(
    subcatMap: Map<string, Set<string>>,
    setupFn: (ovrs: OldPMCV.Overrides | NewPMCV.Overrides) => void,
    subcatVisible: boolean,
  ) {
    const pair = createBoth(subcatMap);
    setupFn(pair.old);
    setupFn(pair.new);

    const fsOverrides = {
      isSubCategoryVisible: vi.fn((_lo: number, _hi: number) => subcatVisible),
    } as unknown as FeatureSymbology.Overrides;

    const oldOvrs = new Id64.Uint32Map<Id64.Uint32Set>();
    const newOvrs = new Id64.Uint32Map<Id64.Uint32Set>();

    pair.old.addOverrides(fsOverrides, oldOvrs);
    pair.new.addOverrides(fsOverrides, newOvrs);

    // Collect entries from both maps for comparison
    function collectOvrs(m: Id64.Uint32Map<Id64.Uint32Set>): Set<string> {
      const result = new Set<string>();
      m.forEach((modelLo, modelHi, subcatSet) => {
        subcatSet.forEach((subLo, subHi) => {
          result.add(`${modelLo}:${modelHi}:${subLo}:${subHi}`);
        });
      });
      return result;
    }

    expect(collectOvrs(newOvrs)).toEqual(collectOvrs(oldOvrs));
  }

  it("Show override with all-visible subcategories → no entries added", () => {
    const subcatMap = makeSubcatMap([["0x10", ["0xa0", "0xa1"]]]);
    compareAddOverrides(subcatMap, (ovrs) => ovrs.setOverride("0x1", "0x10", Show), /* subcatVisible */ true);
  });

  it("Show override with all-invisible subcategories → entries added", () => {
    const subcatMap = makeSubcatMap([["0x10", ["0xa0", "0xa1"]]]);
    compareAddOverrides(subcatMap, (ovrs) => ovrs.setOverride("0x1", "0x10", Show), /* subcatVisible */ false);
  });

  it("Hide override with all-visible subcategories → entries added", () => {
    const subcatMap = makeSubcatMap([["0x10", ["0xa0", "0xa1"]]]);
    compareAddOverrides(subcatMap, (ovrs) => ovrs.setOverride("0x1", "0x10", Hide), /* subcatVisible */ true);
  });

  it("Hide override with all-invisible subcategories → no entries added", () => {
    const subcatMap = makeSubcatMap([["0x10", ["0xa0", "0xa1"]]]);
    compareAddOverrides(subcatMap, (ovrs) => ovrs.setOverride("0x1", "0x10", Hide), /* subcatVisible */ false);
  });

  it("category with no subcategories is skipped", () => {
    // subcatMap has no entry for category 0x10
    const subcatMap = new Map<string, Set<string>>();
    compareAddOverrides(subcatMap, (ovrs) => ovrs.setOverride("0x1", "0x10", Show), true);
  });

  it("multiple models, multiple categories", () => {
    const subcatMap = makeSubcatMap([
      ["0x10", ["0xa0"]],
      ["0x11", ["0xb0", "0xb1"]],
    ]);
    compareAddOverrides(
      subcatMap,
      (ovrs) => {
        ovrs.setOverride(["0x1", "0x2"], "0x10", Show);
        ovrs.setOverride("0x3", "0x11", Hide);
      },
      /* subcatVisible */ true,
    );
  });
});

// ---------------------------------------------------------------------------
// g) Complex / mixed sequences
// ---------------------------------------------------------------------------

describe("complex / mixed sequences", () => {
  it("interleaved setOverride, setOverrides, clearOverrides produces same state", async () => {
    const pair = createBoth();

    pair.old.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11"], Show);
    pair.new.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11"], Show);
    expectSameEntries(pair);

    await pair.old.setOverrides([{ modelId: "0x4", categoryIds: ["0x20", "0x21"], visOverride: Hide }]);
    await pair.new.setOverrides([{ modelId: "0x4", categoryIds: ["0x20", "0x21"], visOverride: Hide }]);
    expectSameEntries(pair);

    pair.old.setOverride("0x2", "0x10", None);
    pair.new.setOverride("0x2", "0x10", None);
    expectSameEntries(pair);

    pair.old.clearOverrides("0x1");
    pair.new.clearOverrides("0x1");
    expectSameEntries(pair);

    pair.old.setOverride("0x3", "0x11", Hide);
    pair.new.setOverride("0x3", "0x11", Hide);
    expectSameEntries(pair);

    expectSameOverride(pair, "0x2", "0x10");  // removed
    expectSameOverride(pair, "0x1", "0x10");  // cleared
    expectSameOverride(pair, "0x3", "0x11");  // updated to Hide
    expectSameOverride(pair, "0x4", "0x20");  // Hide
  });

  it("bulk: 10 models × 20 categories — set, update, remove, clear", () => {
    const pair = createBoth();
    const models = Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`);
    const cats = Array.from({ length: 20 }, (_, i) => `0x${(i + 0x10).toString(16)}`);

    // Set all Show
    pair.old.setOverride(models, cats, Show);
    pair.new.setOverride(models, cats, Show);
    expectSameEntries(pair);
    expect(collectEntries(pair.new).size).toBe(200);

    // Change half to Hide
    const hideCats = cats.slice(0, 10);
    pair.old.setOverride(models, hideCats, Hide);
    pair.new.setOverride(models, hideCats, Hide);
    expectSameEntries(pair);

    // Remove some via None
    const removeCats = cats.slice(15);
    pair.old.setOverride(models, removeCats, None);
    pair.new.setOverride(models, removeCats, None);
    expectSameEntries(pair);

    // Clear specific models
    const clearModels = models.slice(0, 3);
    pair.old.clearOverrides(clearModels);
    pair.new.clearOverrides(clearModels);
    expectSameEntries(pair);

    // Verify final entry count: 7 models × 15 cats remaining = 105
    expect(collectEntries(pair.new).size).toBe(7 * 15);
    expect(collectEntries(pair.new).size).toBe(collectEntries(pair.old).size);
  });
});
