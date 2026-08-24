/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64, Id64String } from "@itwin/core-bentley";
import { ColorDef, Feature, FeatureAppearance, SubCategoryOverride } from "@itwin/core-common";
import {
  FeatureSymbology, PerModelCategoryVisibility, ScreenViewport, SpatialViewState, StandardViewId,
  Viewport,
} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

class Overrides extends FeatureSymbology.Overrides {
  public constructor(vp: Viewport) {
    super(vp);
  }

  public get modelSubCategoryOverrides() { return this._modelSubCategoryOverrides; }

  public getOverride(modelId: Id64String): Id64.Uint32Set | undefined {
    return this.modelSubCategoryOverrides.get(Id64.getLowerUint32(modelId), Id64.getUpperUint32(modelId));
  }

  public expectOverridden(modelId: Id64String, subcategoryId: Id64String): void {
    const set = this.getOverride(modelId);
    expect(set).not.toBeUndefined();
    expect(set!.hasId(subcategoryId)).toBe(true);
  }

  public expectNotOverridden(modelId: Id64String, subcategoryId: Id64String): void {
    const set = this.getOverride(modelId);
    if (undefined !== set)
      expect(set.hasId(subcategoryId)).toBe(false);
  }

  public expectSubCategoryAppearance(modelId: Id64String, subcatId: Id64String, visible: boolean, color?: ColorDef): void {
    const app = this.getElementAppearance(modelId, subcatId);
    expect(undefined !== app).toBe(visible);
    if (undefined !== app) {
      expect(app.overridesRgb).toBe(undefined !== color);
      if (undefined !== color && undefined !== app.rgb) {
        const c = color.colors;
        expect(app.rgb.r).toBe(c.r);
        expect(app.rgb.g).toBe(c.g);
        expect(app.rgb.b).toBe(c.b);
      }
    }
  }

  public getElementAppearance(modelId: Id64String, subcatId: Id64String, elemId: Id64String = "0xabcdef"): FeatureAppearance | undefined {
    return this.getFeatureAppearance(new Feature(elemId, subcatId), modelId);
  }

  public hasSubCategoryAppearanceOverride(subcatId: Id64String): boolean {
    return undefined !== this._subCategoryOverrides.getById(subcatId);
  }
}

describe("Per-model category visibility overrides", () => {
  let imodel: TestSnapshotConnection;
  let spatialView: SpatialViewState;
  let vp: ScreenViewport;

  const viewDiv = document.createElement("div");
  viewDiv.style.width = viewDiv.style.height = "1000px";
  document.body.appendChild(viewDiv);

  const show = PerModelCategoryVisibility.Override.Show;
  const hide = PerModelCategoryVisibility.Override.Hide;
  const usedCatIds = ["0x17", "0x2d", "0x2f", "0x31"];

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);

    // Make sure all subcategories we need are loaded ahead of time.
    const req = imodel.subcategories.load(usedCatIds);
    if (undefined !== req)
      await req.promise;

    for (const usedCatId of usedCatIds)
      expect(imodel.subcategories.getSubCategories(usedCatId)).not.toBeUndefined();
  });

  beforeEach(() => {
    vp = ScreenViewport.create(viewDiv, spatialView.clone());
  });

  afterEach(() => {
    vp[Symbol.dispose]();
  });

  afterAll(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("overrides category selector", async () => {
    // Turn off all categories
    vp.changeCategoryDisplay(usedCatIds, false);
    for (const catId of usedCatIds)
      expect(vp.view.viewsCategory(catId)).toBe(false);

    expect(vp.view.viewsModel("0x1c")).toBe(true);
    expect(vp.view.viewsModel("0x1f")).toBe(true);

    // Turn on category 2f for model 1c, and turn off category 17 for model 1f (latter is no-op because already off).
    const pmcv = vp.perModelCategoryVisibility;
    pmcv.setOverride("0x1c", "0x2f", show);
    pmcv.setOverride("0x1f", "0x17", hide);

    expect(pmcv.getOverride("0x1c", "0x2f")).toBe(show);
    expect(pmcv.getOverride("0x1f", "0x17")).toBe(hide);

    const ovrs = new Overrides(vp);

    // Only the per-model overrides which actually override visibility are recorded.
    expect(ovrs.modelSubCategoryOverrides.size).toBe(1);
    ovrs.expectOverridden("0x1c", "0x30");
    ovrs.expectOverridden("0x1c", "0x33");
    ovrs.expectNotOverridden("0x1f", "0x17");

    for (const modelId of spatialView.modelSelector.models) {
      // Subcategories 0x30 and 0x33 belong to category 0x3f which is only enabled for model 0x1c.
      const expectVisible = modelId === "0x1c";
      const lo = Id64.getLowerUint32(modelId);
      const hi = Id64.getUpperUint32(modelId);

      expect(ovrs.isSubCategoryVisibleInModel(0x30, 0, lo, hi)).toBe(expectVisible);
      expect(ovrs.isSubCategoryVisibleInModel(0x33, 0, lo, hi)).toBe(expectVisible);
      expect(ovrs.isSubCategoryVisibleInModel(0x18, 0, lo, hi)).toBe(false);
      expect(ovrs.isSubCategoryVisibleInModel(0x2e, 0, lo, hi)).toBe(false);

      expect(ovrs.getElementAppearance(modelId, "0x30") !== undefined).toBe(expectVisible);
      expect(ovrs.getElementAppearance(modelId, "0x33") !== undefined).toBe(expectVisible);
    }
  });

  it("does not override always/never-drawn elements", () => {
    // Category selector contains only 0x31 and 0x2d
    vp.changeCategoryDisplay(usedCatIds, false);
    vp.changeCategoryDisplay(["0x31", "0x2d"], true);

    // Model 1c turns category 31 off. Model 1f turns category 17 on and category 2d off.
    const pmcv = vp.perModelCategoryVisibility;
    pmcv.setOverride("0x1c", "0x31", hide);
    pmcv.setOverride("0x1f", "0x17", show);
    pmcv.setOverride("0x1f", "0x2d", hide);
    expect(pmcv.getOverride("0x1c", "0x31")).toBe(hide);
    expect(pmcv.getOverride("0x1f", "0x17")).toBe(show);
    expect(pmcv.getOverride("0x1f", "0x2d")).toBe(hide);

    vp.setAlwaysDrawn(new Set<string>(["0xabc"]));
    vp.setNeverDrawn(new Set<string>(["0xdef"]));

    const ovrs = new Overrides(vp);

    expect(ovrs.modelSubCategoryOverrides.size).toBe(2);
    ovrs.expectOverridden("0x1c", "0x32");
    ovrs.expectOverridden("0x1f", "0x18");

    for (const modelId of spatialView.modelSelector.models) {
      expect(ovrs.getElementAppearance(modelId, "0x18", "0xabc")).not.toBeUndefined();
      expect(ovrs.getElementAppearance(modelId, "0x32", "0xabc")).not.toBeUndefined();
      expect(ovrs.getElementAppearance(modelId, "0x18", "0xdef")).toBeUndefined();
      expect(ovrs.getElementAppearance(modelId, "0x32", "0xdef")).toBeUndefined();

      expect(ovrs.getElementAppearance(modelId, "0x32") !== undefined).toBe(modelId !== "0x1c");
      expect(ovrs.getElementAppearance(modelId, "0x18") !== undefined).toBe(modelId === "0x1f");
      expect(ovrs.getElementAppearance(modelId, "0x2e") !== undefined).toBe(modelId !== "0x1f");
    }
  });

  it("preserves subcategory appearance overrides", () => {
    // Enable all categories and subcategories except category 2d
    vp.changeCategoryDisplay(usedCatIds, true, true);
    vp.changeCategoryDisplay("0x2d", false);

    // Override 30, 32, and 33 to be invisible. Override color of 30, 33, 18, and 2e. (2e's category is turned off).
    vp.overrideSubCategory("0x30", SubCategoryOverride.fromJSON({ color: ColorDef.green.tbgr, invisible: true }));
    vp.overrideSubCategory("0x18", SubCategoryOverride.fromJSON({ color: ColorDef.red.tbgr }));
    vp.overrideSubCategory("0x2e", SubCategoryOverride.fromJSON({ color: ColorDef.blue.tbgr }));
    vp.overrideSubCategory("0x33", SubCategoryOverride.fromJSON({ color: ColorDef.white.tbgr, invisible: true }));
    vp.changeSubCategoryDisplay("0x32", false); // adds an override of { invisible: true }

    // With no per-model overrides, expect subcategory appearance overrides for invisible subcategories not to be loaded.
    let ovrs = new Overrides(vp);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x18")).toBe(true); // because visible and overridden
    expect(ovrs.hasSubCategoryAppearanceOverride("0x30")).toBe(false); // because overridden to be invisible
    expect(ovrs.hasSubCategoryAppearanceOverride("0x32")).toBe(false); // because overridden to be invisible
    expect(ovrs.hasSubCategoryAppearanceOverride("0x2e")).toBe(false); // because overridden but category turned off
    expect(ovrs.hasSubCategoryAppearanceOverride("0x33")).toBe(false); // because overridden to be invisible

    // Turning a category on for a specific model turns on all subcategories.
    // If any of those subcategories have appearance overrides they must be loaded.
    // Cat 31 already enabled, but its subcat is invisible. Cat 2f is enabled; its subcat 30 is invisible and green; its subcat 18 is visible and red.
    // Cat 2d is disabled; its subcat 2e is blue.
    vp.perModelCategoryVisibility.setOverride("0x1c", ["0x2f", "0x31", "0x2d"], show);
    vp.perModelCategoryVisibility.setOverride("0x1c", "0x17", hide);

    ovrs = new Overrides(vp);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x18")).toBe(true);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x30")).toBe(true); // because model overrode visibility and viewport override color
    expect(ovrs.hasSubCategoryAppearanceOverride("0x32")).toBe(false); // model overrode visibility but no other appearance overrides
    expect(ovrs.hasSubCategoryAppearanceOverride("0x2e")).toBe(true); // category is off in selector but on for model and viewport overrode color
    expect(ovrs.hasSubCategoryAppearanceOverride("0x33")).toBe(true); // because model overrode visibility and viewport override color

    ovrs.expectSubCategoryAppearance("0x1f", "0x18", true, ColorDef.red);
    ovrs.expectSubCategoryAppearance("0x1f", "0x30", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x32", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x2e", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x33", false);

    ovrs.expectSubCategoryAppearance("0x1c", "0x18", false);
    ovrs.expectSubCategoryAppearance("0x1c", "0x30", true, ColorDef.green);
    ovrs.expectSubCategoryAppearance("0x1c", "0x32", true);
    ovrs.expectSubCategoryAppearance("0x1c", "0x2e", true, ColorDef.blue);
    ovrs.expectSubCategoryAppearance("0x1c", "0x33", true, ColorDef.white);
  });

  it("supports iteration", () => {
    const pmcv = vp.perModelCategoryVisibility;
    pmcv.setOverride("0x1c", ["0x2f", "0x31"], show);
    pmcv.setOverride("0x1c", ["0x2d"], hide);
    pmcv.setOverride("0x1d", ["0x2d"], show);
    pmcv.setOverride("0x1d", ["0x2f", "0x2e"], hide);

    let nIterations = 0;
    const cats1c = [new Set<string>(), new Set<string>()];
    const cats1d = [new Set<string>(), new Set<string>()];

    for (const entry of pmcv) {
      const modelId = entry.modelId;
      const catId = entry.categoryId;
      const vis = entry.visible;

      expect(modelId === "0x1c" || modelId === "0x1d").toBe(true);
      const arr = modelId === "0x1c" ? cats1c : cats1d;
      const set = vis ? arr[0] : arr[1];
      set.add(catId);
      ++nIterations;
    }

    expect(nIterations).toBe(6);

    expect(cats1c[0].size).toBe(2);
    expect(cats1c[1].size).toBe(1);
    expect(cats1d[0].size).toBe(1);
    expect(cats1d[1].size).toBe(2);

    expect(Array.from(cats1c[0]).join()).toBe("0x2f,0x31");
    expect(Array.from(cats1c[1]).join()).toBe("0x2d");
    expect(Array.from(cats1d[0]).join()).toBe("0x2d");
    expect(Array.from(cats1d[1]).join()).toBe("0x2f,0x2e");
  });
});
describe("Per-model category visibility overrides with setOverrides function", () => {
  let imodel: TestSnapshotConnection;
  let spatialView: SpatialViewState;
  let vp: ScreenViewport;

  const viewDiv = document.createElement("div");
  viewDiv.style.width = viewDiv.style.height = "1000px";
  document.body.appendChild(viewDiv);

  const show = PerModelCategoryVisibility.Override.Show;
  const hide = PerModelCategoryVisibility.Override.Hide;
  const usedCatIds = ["0x17", "0x2d", "0x2f", "0x31"];

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);

  });

  beforeEach(() => {
    vp = ScreenViewport.create(viewDiv, spatialView.clone());
  });

  afterEach(() => {
    vp[Symbol.dispose]();
  });

  afterAll(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("overrides category selector", async () => {
    // Turn off all categories
    vp.changeCategoryDisplay(usedCatIds, false);
    for (const catId of usedCatIds)
      expect(vp.view.viewsCategory(catId)).toBe(false);

    expect(vp.view.viewsModel("0x1c")).toBe(true);
    expect(vp.view.viewsModel("0x1f")).toBe(true);

    // Turn on category 2f for model 1c, and turn off category 17 for model 1f (latter is no-op because already off).
    const pmcv = vp.perModelCategoryVisibility;
    const overrides: PerModelCategoryVisibility.Props[] = [];
    overrides.push({ modelId: "0x1c", categoryIds: "0x2f", visOverride: show });
    overrides.push({ modelId: "0x1f", categoryIds: "0x17", visOverride: hide });
    await pmcv.setOverrides(overrides);

    expect(pmcv.getOverride("0x1c", "0x2f")).toBe(show);
    expect(pmcv.getOverride("0x1f", "0x17")).toBe(hide);

    const ovrs = new Overrides(vp);

    // Only the per-model overrides which actually override visibility are recorded.
    expect(ovrs.modelSubCategoryOverrides.size).toBe(1);
    ovrs.expectOverridden("0x1c", "0x30");
    ovrs.expectOverridden("0x1c", "0x33");
    ovrs.expectNotOverridden("0x1f", "0x17");

    for (const modelId of spatialView.modelSelector.models) {
      // Subcategories 0x30 and 0x33 belong to category 0x3f which is only enabled for model 0x1c.
      const expectVisible = modelId === "0x1c";
      const lo = Id64.getLowerUint32(modelId);
      const hi = Id64.getUpperUint32(modelId);

      expect(ovrs.isSubCategoryVisibleInModel(0x30, 0, lo, hi)).toBe(expectVisible);
      expect(ovrs.isSubCategoryVisibleInModel(0x33, 0, lo, hi)).toBe(expectVisible);
      expect(ovrs.isSubCategoryVisibleInModel(0x18, 0, lo, hi)).toBe(false);
      expect(ovrs.isSubCategoryVisibleInModel(0x2e, 0, lo, hi)).toBe(false);

      expect(ovrs.getElementAppearance(modelId, "0x30") !== undefined).toBe(expectVisible);
      expect(ovrs.getElementAppearance(modelId, "0x33") !== undefined).toBe(expectVisible);
    }
  });

  it("does not override always/never-drawn elements", async () => {
    // Category selector contains only 0x31 and 0x2d
    vp.changeCategoryDisplay(usedCatIds, false);
    vp.changeCategoryDisplay(["0x31", "0x2d"], true);

    // Model 1c turns category 31 off. Model 1f turns category 17 on and category 2d off.
    const pmcv = vp.perModelCategoryVisibility;
    const overrides: PerModelCategoryVisibility.Props[] = [];
    overrides.push({ modelId: "0x1c", categoryIds: ["0x31"], visOverride: hide });
    overrides.push({ modelId: "0x1f", categoryIds: ["0x17"], visOverride: show });
    overrides.push({ modelId: "0x1f", categoryIds: "0x2d", visOverride: hide });
    await pmcv.setOverrides(overrides);
    expect(pmcv.getOverride("0x1c", "0x31")).toBe(hide);
    expect(pmcv.getOverride("0x1f", "0x17")).toBe(show);
    expect(pmcv.getOverride("0x1f", "0x2d")).toBe(hide);

    vp.setAlwaysDrawn(new Set<string>(["0xabc"]));
    vp.setNeverDrawn(new Set<string>(["0xdef"]));

    const ovrs = new Overrides(vp);

    expect(ovrs.modelSubCategoryOverrides.size).toBe(2);
    ovrs.expectOverridden("0x1c", "0x32");
    ovrs.expectOverridden("0x1f", "0x18");

    for (const modelId of spatialView.modelSelector.models) {
      expect(ovrs.getElementAppearance(modelId, "0x18", "0xabc")).not.toBeUndefined();
      expect(ovrs.getElementAppearance(modelId, "0x32", "0xabc")).not.toBeUndefined();
      expect(ovrs.getElementAppearance(modelId, "0x18", "0xdef")).toBeUndefined();
      expect(ovrs.getElementAppearance(modelId, "0x32", "0xdef")).toBeUndefined();

      expect(ovrs.getElementAppearance(modelId, "0x32") !== undefined).toBe(modelId !== "0x1c");
      expect(ovrs.getElementAppearance(modelId, "0x18") !== undefined).toBe(modelId === "0x1f");
      expect(ovrs.getElementAppearance(modelId, "0x2e") !== undefined).toBe(modelId !== "0x1f");
    }
  });

  it("preserves subcategory appearance overrides", async () => {
    // Enable all categories and subcategories except category 2d
    vp.changeCategoryDisplay(usedCatIds, true, true);
    vp.changeCategoryDisplay("0x2d", false);

    // Override 30, 32, and 33 to be invisible. Override color of 30, 33, 18, and 2e. (2e's category is turned off).
    vp.overrideSubCategory("0x30", SubCategoryOverride.fromJSON({ color: ColorDef.green.tbgr, invisible: true }));
    vp.overrideSubCategory("0x18", SubCategoryOverride.fromJSON({ color: ColorDef.red.tbgr }));
    vp.overrideSubCategory("0x2e", SubCategoryOverride.fromJSON({ color: ColorDef.blue.tbgr }));
    vp.overrideSubCategory("0x33", SubCategoryOverride.fromJSON({ color: ColorDef.white.tbgr, invisible: true }));
    vp.changeSubCategoryDisplay("0x32", false); // adds an override of { invisible: true }

    // With no per-model overrides, expect subcategory appearance overrides for invisible subcategories not to be loaded.
    let ovrs = new Overrides(vp);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x18")).toBe(true); // because visible and overridden
    expect(ovrs.hasSubCategoryAppearanceOverride("0x30")).toBe(false); // because overridden to be invisible
    expect(ovrs.hasSubCategoryAppearanceOverride("0x32")).toBe(false); // because overridden to be invisible
    expect(ovrs.hasSubCategoryAppearanceOverride("0x2e")).toBe(false); // because overridden but category turned off
    expect(ovrs.hasSubCategoryAppearanceOverride("0x33")).toBe(false); // because overridden to be invisible

    // Turning a category on for a specific model turns on all subcategories.
    // If any of those subcategories have appearance overrides they must be loaded.
    // Cat 31 already enabled, but its subcat is invisible. Cat 2f is enabled; its subcat 30 is invisible and green; its subcat 18 is visible and red.
    // Cat 2d is disabled; its subcat 2e is blue.
    // vp.perModelCategoryVisibility.setOverride("0x1c", ["0x2f", "0x31", "0x2d"], show);
    // vp.perModelCategoryVisibility.setOverride("0x1c", "0x17", hide);
    const overrides: PerModelCategoryVisibility.Props[] = [];
    overrides.push({ modelId: "0x1c", categoryIds: ["0x2f", "0x31", "0x2d"], visOverride: show });
    overrides.push({ modelId: "0x1c", categoryIds: ["0x17"], visOverride: hide });
    await vp.perModelCategoryVisibility.setOverrides(overrides);

    ovrs = new Overrides(vp);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x18")).toBe(true);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x30")).toBe(true); // because model overrode visibility and viewport override color
    expect(ovrs.hasSubCategoryAppearanceOverride("0x32")).toBe(false); // model overrode visibility but no other appearance overrides
    expect(ovrs.hasSubCategoryAppearanceOverride("0x2e")).toBe(true); // category is off in selector but on for model and viewport overrode color
    expect(ovrs.hasSubCategoryAppearanceOverride("0x33")).toBe(true); // because model overrode visibility and viewport override color

    ovrs.expectSubCategoryAppearance("0x1f", "0x18", true, ColorDef.red);
    ovrs.expectSubCategoryAppearance("0x1f", "0x30", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x32", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x2e", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x33", false);

    ovrs.expectSubCategoryAppearance("0x1c", "0x18", false);
    ovrs.expectSubCategoryAppearance("0x1c", "0x30", true, ColorDef.green);
    ovrs.expectSubCategoryAppearance("0x1c", "0x32", true);
    ovrs.expectSubCategoryAppearance("0x1c", "0x2e", true, ColorDef.blue);
    ovrs.expectSubCategoryAppearance("0x1c", "0x33", true, ColorDef.white);
  });

  it("supports iteration", async () => {
    const pmcv = vp.perModelCategoryVisibility;
    const overrides: PerModelCategoryVisibility.Props[] = [];
    overrides.push({ modelId: "0x1c", categoryIds: ["0x2f", "0x31"], visOverride: show });
    overrides.push({ modelId: "0x1c", categoryIds: ["0x2d"], visOverride: hide });
    overrides.push({ modelId: "0x1d", categoryIds: "0x2d", visOverride: show });
    overrides.push({ modelId: "0x1d", categoryIds: ["0x2f", "0x2e"], visOverride: hide });
    await pmcv.setOverrides(overrides);

    let nIterations = 0;
    const cats1c = [new Set<string>(), new Set<string>()];
    const cats1d = [new Set<string>(), new Set<string>()];

    for (const entry of pmcv) {
      const modelId = entry.modelId;
      const catId = entry.categoryId;
      const vis = entry.visible;

      expect(modelId === "0x1c" || modelId === "0x1d").toBe(true);
      const arr = modelId === "0x1c" ? cats1c : cats1d;
      const set = vis ? arr[0] : arr[1];
      set.add(catId);
      ++nIterations;
    }

    expect(nIterations).toBe(6);

    expect(cats1c[0].size).toBe(2);
    expect(cats1c[1].size).toBe(1);
    expect(cats1d[0].size).toBe(1);
    expect(cats1d[1].size).toBe(2);

    expect(Array.from(cats1c[0]).join()).toBe("0x2f,0x31");
    expect(Array.from(cats1c[1]).join()).toBe("0x2d");
    expect(Array.from(cats1d[0]).join()).toBe("0x2d");
    expect(Array.from(cats1d[1]).join()).toBe("0x2f,0x2e");
  });
});
