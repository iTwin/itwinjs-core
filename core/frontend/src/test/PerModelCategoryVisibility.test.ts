/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { Viewport } from "../Viewport";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { IModelConnection } from "../core-frontend";

function createMockViewport(subCategoriesMap?: Map<string, Set<string>>) {
  return {
    setViewedCategoriesPerModelChanged: vi.fn(),
    iModel: {
      subcategories: {
        getSubCategories: (categoryId: string) => subCategoriesMap?.get(categoryId),
      },
    },
    subcategories: {
      push: vi.fn(),
    },
  } as unknown as Viewport;
}

function createOverrides(subCategoriesMap?: Map<string, Set<string>>) {
  const vp = createMockViewport(subCategoriesMap);
  return { ovrs: PerModelCategoryVisibility.createOverrides(vp), vp };
}

/** Collect all entries from the iterator into a Set of "modelId:categoryId:visible" strings. */
function collectEntries(ovrs: PerModelCategoryVisibility.Overrides): Set<string> {
  const result = new Set<string>();
  for (const e of ovrs)
    result.add(`${e.modelId}:${e.categoryId}:${e.visible}`);
  return result;
}

/** Collect all entries from the iterator in yield order as "modelId:categoryId:visible" strings. */
function collectEntriesOrdered(ovrs: PerModelCategoryVisibility.Overrides): string[] {
  const result: string[] = [];
  for (const e of ovrs)
    result.push(`${e.modelId}:${e.categoryId}:${e.visible}`);
  return result;
}

describe("PerModelCategoryVisibility", () => {
  describe("getOverride", () => {
    it("returns None when no overrides are set", () => {
      const { ovrs } = createOverrides();
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
    });

    it("returns None when model has no overrides", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x999", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
    });

    it("returns None when category has no override in an existing model", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x1", "0x999")).toBe(PerModelCategoryVisibility.Override.None);
    });

    it("returns Show when override is set to Show", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.Show);
    });

    it("returns Hide when override is set to Hide", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Hide);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.Hide);
    });

    it("returns None when override is set to None", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.None);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
    });
  });

  describe("setOverride", () => {
    it("sets override when given a single model and single category as strings", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.Show);
      expect(collectEntries(ovrs).size).toBe(1);
    });

    it("sets override for all categories when given a single model and a category array", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", ["0x10", "0x11", "0x12"], PerModelCategoryVisibility.Override.Show);
      for (const categoryId of ["0x10", "0x11", "0x12"])
        expect(ovrs.getOverride("0x1", categoryId)).toBe(PerModelCategoryVisibility.Override.Show);
      expect(collectEntries(ovrs).size).toBe(3);
    });

    it("sets override for all combinations when given model and category arrays", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11"], PerModelCategoryVisibility.Override.Hide);
      for (const m of ["0x1", "0x2", "0x3"])
        for (const c of ["0x10", "0x11"])
          expect(ovrs.getOverride(m, c)).toBe(PerModelCategoryVisibility.Override.Hide);
      expect(collectEntries(ovrs).size).toBe(6);
    });

    it("sets override for all combinations when given Set args for models and categories", () => {
      const { ovrs } = createOverrides();
      const models = new Set(["0x1", "0x2"]);
      const cats = new Set(["0x10", "0x20"]);
      ovrs.setOverride(models, cats, PerModelCategoryVisibility.Override.Show);
      expect(collectEntries(ovrs).size).toBe(4);
    });

    it("updates override to Hide when changed from Show", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Hide);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.Hide);
    });

    it("updates override to Show when changed from Hide", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Hide);
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.Show);
    });

    it("removes the entry when override is set to None", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.None);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
      expect(collectEntries(ovrs).size).toBe(0);
    });

    it("does not fire notification when setting None on a non-existent entry", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.None);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    });

    it("does not fire notification when setting override with an empty category array", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride("0x1", [], PerModelCategoryVisibility.Override.Show);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
      expect(collectEntries(ovrs).size).toBe(0);
    });

    it("does not fire notification when setting override with an empty category Set", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride("0x1", new Set<string>(), PerModelCategoryVisibility.Override.Hide);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
      expect(collectEntries(ovrs).size).toBe(0);
    });

    it("does not fire notification when setting override with multiple models but empty categories", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride(["0x1", "0x2", "0x3"], [], PerModelCategoryVisibility.Override.Show);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
      expect(collectEntries(ovrs).size).toBe(0);
    });

    it("does not fire additional notification when duplicate `setOverride` calls are made", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      const countBefore = (vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show); // same value — no change
      const countAfter = (vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(countAfter).toBe(countBefore);
    });

    it("fires exactly one notification when the override value changes", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      const countBefore = (vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Hide);
      const countAfter = (vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(countAfter - countBefore).toBe(1);
    });

    it("calls subcategories.push when override is Show or Hide but not when None", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect((vp.subcategories.push as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.None);
      // push should not be called again for None
      expect((vp.subcategories.push as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
  });

  describe("setOverrides", () => {
    it("applies all overrides when given an array of Props with mixed override values", async () => {
      const { ovrs } = createOverrides();
      const props: PerModelCategoryVisibility.Props[] = [
        { modelId: "0x1", categoryIds: ["0x10", "0x11"], visOverride: PerModelCategoryVisibility.Override.Show },
        { modelId: "0x2", categoryIds: ["0x20"], visOverride: PerModelCategoryVisibility.Override.Hide },
      ];
      await ovrs.setOverrides(props);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x1", "0x11")).toBe(PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x2", "0x20")).toBe(PerModelCategoryVisibility.Override.Hide);
      expect(collectEntries(ovrs).size).toBe(3);
    });

    it("applies overrides when given a single category", async () => {
      const { ovrs } = createOverrides();
      const props = [{ modelId: "0x1", categoryIds: "0x10", visOverride: PerModelCategoryVisibility.Override.Show }] as PerModelCategoryVisibility.Props[];
      await ovrs.setOverrides(props);
      // Exactly one entry, not one per character
      expect(collectEntries(ovrs).size).toBe(1);
    });

    it("passes explicit iModel to subcategories.push when iModel is provided", async () => {
      const { ovrs, vp } = createOverrides();
      const explicitIModel = {
        subcategories: { getSubCategories: vi.fn() },
      } as unknown as IModelConnection;

      const props: PerModelCategoryVisibility.Props[] = [{ modelId: "0x1", categoryIds: ["0x10"], visOverride: PerModelCategoryVisibility.Override.Show }];
      await ovrs.setOverrides(props, explicitIModel);

      // The explicit iModel's subcategories should be passed to push, not the viewport's iModel.subcategories
      const pushCalls = (vp.subcategories.push as ReturnType<typeof vi.fn>).mock.calls;
      expect(pushCalls.length).toBe(1);
      expect(pushCalls[0][0]).toBe(explicitIModel.subcategories);
    });

    it("uses viewport iModel for subcategories.push when no iModel is provided", async () => {
      const { ovrs, vp } = createOverrides();
      const props: PerModelCategoryVisibility.Props[] = [{ modelId: "0x1", categoryIds: ["0x10"], visOverride: PerModelCategoryVisibility.Override.Show }];
      await ovrs.setOverrides(props);

      const pushCalls = (vp.subcategories.push as ReturnType<typeof vi.fn>).mock.calls;
      expect(pushCalls.length).toBe(1);
      // First arg should be viewport's iModel.subcategories
      expect(pushCalls[0][0]).toBe((vp as any).iModel.subcategories);
    });

    it("does not fire additional notification when duplicate `setOverrides` calls are made", async () => {
      const { ovrs, vp } = createOverrides();
      const props: PerModelCategoryVisibility.Props[] = [{ modelId: "0x1", categoryIds: ["0x10"], visOverride: PerModelCategoryVisibility.Override.Show }];
      await ovrs.setOverrides(props);
      const countBefore = (vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

      await ovrs.setOverrides(props);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(countBefore);
    });

    it("does not fire notification when setOverrides is called with empty categoryIds", async () => {
      const { ovrs, vp } = createOverrides();
      const props: PerModelCategoryVisibility.Props[] = [{ modelId: "0x1", categoryIds: [], visOverride: PerModelCategoryVisibility.Override.Show }];
      await ovrs.setOverrides(props);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
      expect(collectEntries(ovrs).size).toBe(0);
    });
  });

  describe("clearOverrides", () => {
    it("clears all entries and fires one notification when called without arguments", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.setOverride(["0x1", "0x2"], ["0x10", "0x11"], PerModelCategoryVisibility.Override.Show);
      const before = (vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length;

      ovrs.clearOverrides();
      expect(collectEntries(ovrs).size).toBe(0);
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length - before).toBe(1);
    });

    it("does not fire notification when called on empty overrides", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.clearOverrides();
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    });

    it("clears only the specified model when given a single model id", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride(["0x1", "0x2"], "0x10", PerModelCategoryVisibility.Override.Show);
      ovrs.clearOverrides("0x1");
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
      expect(ovrs.getOverride("0x2", "0x10")).toBe(PerModelCategoryVisibility.Override.Show);
    });

    it("clears only the specified models and leaves others when given an array of model ids", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride(["0x1", "0x2", "0x3"], "0x10", PerModelCategoryVisibility.Override.Show);
      ovrs.clearOverrides(["0x1", "0x3"]);
      expect(ovrs.getOverride("0x1", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
      expect(ovrs.getOverride("0x2", "0x10")).toBe(PerModelCategoryVisibility.Override.Show);
      expect(ovrs.getOverride("0x3", "0x10")).toBe(PerModelCategoryVisibility.Override.None);
    });

    it("does not fire notification when the specified model does not exist", () => {
      const { ovrs, vp } = createOverrides();
      ovrs.clearOverrides("0x999");
      expect((vp.setViewedCategoriesPerModelChanged as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    });
  });

  describe("[Symbol.iterator]", () => {
    it("yields nothing when overrides are empty", () => {
      const { ovrs } = createOverrides();
      expect(collectEntries(ovrs).size).toBe(0);
    });

    it("yields one entry when one override is set", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      expect(collectEntriesOrdered(ovrs)).toEqual(["0x1:0x10:true"]);
    });

    it("yields all entries in insertion order when multiple overrides are set", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x3", "0x30", PerModelCategoryVisibility.Override.Show);
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
      ovrs.setOverride("0x2", "0x20", PerModelCategoryVisibility.Override.Hide);

      expect(collectEntriesOrdered(ovrs)).toEqual([
        "0x3:0x30:true",
        "0x1:0x10:true",
        "0x2:0x20:false",
      ]);
    });

    it("yields all category entries when multiple categories are set for the same model", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride("0x1", ["0x12", "0x10", "0x11"], PerModelCategoryVisibility.Override.Show);

      expect(collectEntries(ovrs)).toEqual(new Set([
        "0x1:0x10:true",
        "0x1:0x11:true",
        "0x1:0x12:true",
      ]));
    });

    it("reflects the current state when entries are removed or updated", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride(["0x1", "0x2"], "0x10", PerModelCategoryVisibility.Override.Show);
      ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.None);
      ovrs.setOverride("0x2", "0x10", PerModelCategoryVisibility.Override.Hide);
      expect(collectEntriesOrdered(ovrs)).toEqual(["0x2:0x10:false"]);
    });

    it("yields the correct number of entries when multiple overrides are set", () => {
      const { ovrs } = createOverrides();
      ovrs.setOverride(["0x1", "0x2", "0x3"], ["0x10", "0x11", "0x12"], PerModelCategoryVisibility.Override.Hide);
      expect(collectEntries(ovrs).size).toBe(9);
    });
  });

  describe("addOverrides", () => {
    /** Build a subCategoriesMap for use in the mock viewport. */
    function makeSubCategoriesMap(entries: [string, string[]][]): Map<string, Set<string>> {
      const m = new Map<string, Set<string>>();
      for (const [categoryId, subcategoryIds] of entries)
        m.set(categoryId, new Set(subcategoryIds));
      return m;
    }

    /** Collect entries from a Uint32Map<Uint32Set>. */
    function collectOvrs(m: Id64.Uint32Map<Id64.Uint32Set>): Set<string> {
      const result = new Set<string>();
      m.forEach((modelLo, modelHi, subcatSet) => {
        subcatSet.forEach((subLo, subHi) => {
          result.add(`${modelLo}:${modelHi}:${subLo}:${subHi}`);
        });
      });
      return result;
    }

    function runAddOverrides(
      subCategoriesMap: Map<string, Set<string>>,
      setupFn: (ovrs: PerModelCategoryVisibility.Overrides) => void,
      subCategoryVisible: boolean,
    ): Set<string> {
      const { ovrs } = createOverrides(subCategoriesMap);
      setupFn(ovrs);

      const fsOverrides = {
        isSubCategoryVisible: vi.fn((_lo: number, _hi: number) => subCategoryVisible),
      } as unknown as FeatureSymbology.Overrides;

      const resultOvrs = new Id64.Uint32Map<Id64.Uint32Set>();
      ovrs.addOverrides(fsOverrides, resultOvrs);
      return collectOvrs(resultOvrs);
    }

    it("adds no entries when Show override and all subcategories are already visible", () => {
      const subCategoriesMap = makeSubCategoriesMap([["0x10", ["0xa0", "0xa1"]]]);
      const result = runAddOverrides(subCategoriesMap, (ovrs) => ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show), true);
      expect(result.size).toBe(0);
    });

    it("adds entries when Show override and all subcategories are invisible", () => {
      const subCategoriesMap = makeSubCategoriesMap([["0x10", ["0xa0", "0xa1"]]]);
      const result = runAddOverrides(subCategoriesMap, (ovrs) => ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show), false);
      expect(result.size).toBe(2);
    });

    it("adds entries when Hide override and all subcategories are visible", () => {
      const subCategoriesMap = makeSubCategoriesMap([["0x10", ["0xa0", "0xa1"]]]);
      const result = runAddOverrides(subCategoriesMap, (ovrs) => ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Hide), true);
      expect(result.size).toBe(2);
    });

    it("adds no entries when Hide override and all subcategories are already invisible", () => {
      const subCategoriesMap = makeSubCategoriesMap([["0x10", ["0xa0", "0xa1"]]]);
      const result = runAddOverrides(subCategoriesMap, (ovrs) => ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Hide), false);
      expect(result.size).toBe(0);
    });

    it("skips a category when it has no subcategories", () => {
      const subCategoriesMap = new Map<string, Set<string>>();
      const result = runAddOverrides(subCategoriesMap, (ovrs) => ovrs.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show), true);
      expect(result.size).toBe(0);
    });

    it("adds correct entries when overrides span multiple models and categories", () => {
      const subCategoriesMap = makeSubCategoriesMap([
        ["0x10", ["0xa0"]],
        ["0x11", ["0xb0", "0xb1"]],
      ]);
      const result = runAddOverrides(
        subCategoriesMap,
        (ovrs) => {
          ovrs.setOverride(["0x1", "0x2"], "0x10", PerModelCategoryVisibility.Override.Show);
          ovrs.setOverride("0x3", "0x11", PerModelCategoryVisibility.Override.Hide);
        },
        true,
      );
      // Show+visible → no override for 0x10; Hide+visible → entries for 0x11 subcats (2) × 1 model
      expect(result.size).toBe(2);
    });
  });
});