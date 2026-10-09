/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import {
  ColorDef, Feature, FeatureAppearance, FeatureAppearanceProps, GeometryClass, LinePixels, RgbColor, SubCategoryOverride,
  ViewFlags,
} from "@itwin/core-common";
import { FeatureSymbology, IModelConnection, SpatialViewState, ViewState } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

class Overrides extends FeatureSymbology.Overrides {
  public constructor(view?: ViewState) { super(view); }

  public get elementOverrides() { return this._elementOverrides; }
  public get subCategoryOverrides() { return this._subCategoryOverrides; }
  public get visibleSubCategories() { return this._visibleSubCategories; }

  public expectSubCategory(id: string, expectVisible: boolean): void {
    expect(this.visibleSubCategories.hasId(id)).toBe(expectVisible);
    const feature = new Feature("0xabc", id);
    expect(this.isFeatureVisible(feature)).toBe(expectVisible);
  }
}

describe("FeatureSymbology.Overrides", () => {
  let imodel: IModelConnection;
  let viewId: string;
  let viewState: SpatialViewState;

  beforeAll(async () => {
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    const viewRows = await imodel.views.getViewList({ from: SpatialViewState.classFullName, limit: 1 });
    expect(viewRows).toEqual(expect.anything());
    viewId = viewRows[0].id!;
  });

  beforeEach(async () => {
    viewState = await imodel.views.load(viewId) as SpatialViewState;
    expect(viewState).toBeInstanceOf(SpatialViewState);
  });

  afterAll(async () => {
    if (imodel)
      await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  it("constructor with ViewState parameter works as expected", () => {
    // init overrides from ViewState
    const overrides = new Overrides(viewState);

    expect(overrides.isClassVisible(GeometryClass.Construction)).toBe(viewState.viewFlags.constructions);
    expect(overrides.isClassVisible(GeometryClass.Dimension)).toBe(viewState.viewFlags.dimensions);
    expect(overrides.isClassVisible(GeometryClass.Pattern)).toBe(viewState.viewFlags.patterns);
    expect(overrides.lineWeights).toBe(viewState.viewFlags.weights);
  });

  it("isClassVisible works as expected", () => {
    let overrides = new Overrides();
    viewState.displayStyle.viewFlags = new ViewFlags({ constructions: false, dimensions: false, patterns: false });

    expect(overrides.isClassVisible(GeometryClass.Construction)).toBe(false);
    expect(overrides.isClassVisible(GeometryClass.Dimension)).toBe(false);
    expect(overrides.isClassVisible(GeometryClass.Pattern)).toBe(false);

    viewState.displayStyle.viewFlags = viewState.displayStyle.viewFlags.with("constructions", true);
    overrides = new Overrides(viewState);

    expect(overrides.isClassVisible(GeometryClass.Construction)).toBe(true);

    viewState.displayStyle.viewFlags = viewState.displayStyle.viewFlags.with("dimensions", true);
    overrides = new Overrides(viewState);

    expect(overrides.isClassVisible(GeometryClass.Dimension)).toBe(true);

    viewState.displayStyle.viewFlags = viewState.displayStyle.viewFlags.with("patterns", true);
    overrides = new Overrides(viewState);

    expect(overrides.isClassVisible(GeometryClass.Pattern)).toBe(true);

    expect(overrides.isClassVisible(GeometryClass.Primary)).toBe(true);
  });

  it("isFeatureVisible works as expected", () => {
    let overrides = new Overrides();
    const elementId = Id64.fromString("0x123");
    const subCategoryId = Id64.fromString("0x124");
    const geometryClass = GeometryClass.Construction;
    const feature = new Feature(elementId, subCategoryId, geometryClass);

    overrides = new Overrides();
    expect(overrides.isFeatureVisible(feature)).toBe(false);

    overrides.setNeverDrawn(elementId);
    expect(overrides.isFeatureVisible(feature)).toBe(false);

    overrides = new Overrides();
    overrides.setAlwaysDrawn(elementId);

    expect(overrides.isFeatureVisible(feature)).toBe(true);

    overrides = new Overrides();
    overrides.isAlwaysDrawnExclusive = true;

    // doesn't sound right... but this is how it works in the native code
    expect(overrides.isFeatureVisible(feature)).toBe(false);

    overrides = new Overrides();
    overrides.setVisibleSubCategory(subCategoryId);
    expect(overrides.isFeatureVisible(feature)).toBe(false);

    viewState.displayStyle.viewFlags = new ViewFlags({ constructions: true });
    overrides = new Overrides(viewState);
    overrides.setVisibleSubCategory(subCategoryId);
    expect(overrides.isFeatureVisible(feature)).toBe(true);
  });

  it("getFeatureAppearance works as expected", () => {
    let overrides = new Overrides();
    const id = Id64.fromString("0x111");
    const elementId = Id64.fromString("0x128");
    const subCategoryId = Id64.fromString("0x129");
    const geometryClass = GeometryClass.Construction;
    const feature = new Feature(elementId, subCategoryId, geometryClass);
    const props = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureAppearanceProps;
    const modelProps = { ...props, transparency: 200 / 255 } as FeatureAppearanceProps;
    const badModelProps = { ...props, transparency: 356 / 255 } as FeatureAppearanceProps;
    const elemProps = { transparency: 200 / 255, linePixels: LinePixels.HiddenLine } as FeatureAppearanceProps;
    const subCatProps = { linePixels: LinePixels.Code3, transparency: 90 / 255 } as FeatureAppearanceProps;
    let modelApp = FeatureAppearance.fromJSON(modelProps);
    const elemApp = FeatureAppearance.fromJSON(elemProps);
    const subCatApp = FeatureAppearance.fromJSON(subCatProps);
    let appearance: FeatureAppearance | undefined;

    overrides.setNeverDrawn(elementId);

    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeUndefined();

    overrides = new Overrides();
    overrides.isAlwaysDrawnExclusive = true;

    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeUndefined();

    overrides = new Overrides();
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeUndefined();

    overrides = new Overrides();
    overrides.setAlwaysDrawn(elementId);
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeDefined();

    viewState.displayStyle.viewFlags = new ViewFlags({ constructions: true });
    overrides = new Overrides(viewState);
    overrides.setVisibleSubCategory(subCategoryId);
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeDefined();

    overrides = new Overrides();
    appearance = FeatureAppearance.fromJSON(props);
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeUndefined();

    overrides = new Overrides();
    appearance = FeatureAppearance.fromJSON(props);
    overrides.setAlwaysDrawn(elementId);
    appearance = overrides.getFeatureAppearance(feature, id);
    const msg = "if elementId in alwaysDrawn set, but id not in ModelOverrides map, nor elementId in elementOverrides map, nor subCategoryId in subCategoryOverrides, then app will be set to default overrides";
    expect(appearance!.equals(overrides.defaultOverrides), msg).toBe(true);

    overrides = new Overrides();
    appearance = FeatureAppearance.fromJSON(props);
    overrides.setAlwaysDrawn(elementId);
    overrides.override({ modelId: id, appearance: modelApp });
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance!.equals(modelApp)).toBe(true);

    overrides = new Overrides();
    appearance = FeatureAppearance.fromJSON(props);
    modelApp = FeatureAppearance.fromJSON(badModelProps);
    overrides.setAlwaysDrawn(elementId);
    overrides.override({ modelId: id, appearance: modelApp });
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance).toBeUndefined();
    // NOTE: The above assertion appears to have assumed that getFeatureAppearance() returns undefined because it rejects the "invalid" transparency value.
    // In reality it detects that transparency is above the threshold considered "fully transparent" and therefore not visible.

    overrides = new Overrides();
    appearance = FeatureAppearance.fromJSON(props);
    overrides.override({ elementId, appearance: elemApp });
    overrides.setAlwaysDrawn(elementId);
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance!.equals(elemApp)).toBe(true);

    overrides = new Overrides(viewState);
    appearance = FeatureAppearance.fromJSON(props);
    overrides.setVisibleSubCategory(subCategoryId);
    overrides.override({ subCategoryId, appearance: subCatApp });
    appearance = overrides.getFeatureAppearance(feature, id);
    expect(appearance!.equals(subCatApp)).toBe(true);

    overrides = new Overrides(viewState);
    appearance = FeatureAppearance.fromJSON(props);
    modelApp = FeatureAppearance.fromJSON(modelProps);
    overrides.override({ modelId: id, appearance: modelApp });
    overrides.setVisibleSubCategory(subCategoryId);
    overrides.override({ subCategoryId, appearance: subCatApp });
    appearance = overrides.getFeatureAppearance(feature, id);
    let expected = subCatApp.extendAppearance(modelApp);
    expect(appearance!.equals(expected)).toBe(true);
    overrides = new Overrides(viewState);
    appearance = FeatureAppearance.fromJSON(props);
    modelApp = FeatureAppearance.fromJSON(modelProps);
    overrides.override({ modelId: id, appearance: modelApp });
    overrides.override({ elementId, appearance: elemApp });
    overrides.setVisibleSubCategory(subCategoryId);
    overrides.override({ subCategoryId, appearance: subCatApp });
    appearance = overrides.getFeatureAppearance(feature, id);
    expected = elemApp.extendAppearance(modelApp);
    expected = subCatApp.extendAppearance(expected);
    expect(appearance!.equals(expected)).toBe(true);
  });

  it("excludedElements works as expected", () => {
    viewState.displayStyle.settings.addExcludedElements(Id64.fromString("0x123"));

    const elementId = Id64.fromString("0x123");
    const elementId2 = Id64.fromString("0x128");
    const subCategoryId = Id64.fromString("0x124");
    const geometryClass = GeometryClass.Construction;
    const feature = new Feature(elementId, subCategoryId, geometryClass);
    const feature2 = new Feature(elementId2, subCategoryId, geometryClass);

    let overrides = new Overrides(viewState);
    expect(overrides.isFeatureVisible(feature)).toBe(false);
    expect(overrides.isFeatureVisible(feature2)).toBe(false);
    overrides = new Overrides(viewState);
    overrides.setAlwaysDrawn(elementId);
    overrides.setAlwaysDrawn(elementId2);

    expect(overrides.isFeatureVisible(feature)).toBe(false);
    expect(overrides.isFeatureVisible(feature2)).toBe(true);

    viewState.displayStyle.viewFlags = new ViewFlags({ constructions: true });
    overrides = new Overrides(viewState);
    overrides.setVisibleSubCategory(subCategoryId);
    expect(overrides.isFeatureVisible(feature)).toBe(false);
    expect(overrides.isFeatureVisible(feature2)).toBe(true);
  });

  it("model appearance overrides work as expected", () => {
    const modelId1 = Id64.fromString("0x111");
    const modelId2 = Id64.fromString("0x112");
    const modelId3 = Id64.fromString("0x0113");
    const elementId = Id64.fromString("0x128");
    const subCategoryId = Id64.fromString("0x129");
    const geometryClass = GeometryClass.Construction;
    const feature = new Feature(elementId, subCategoryId, geometryClass);
    const modelOverride1 = FeatureAppearance.fromJSON({ rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true });
    const modelOverride2 = FeatureAppearance.fromJSON({ ...modelOverride1, transparency: 200 / 255 });

    const displayStyle = viewState.displayStyle;
    displayStyle.settings.overrideModelAppearance(modelId1, modelOverride1);
    expect(displayStyle.settings.hasModelAppearanceOverride).toBeTruthy();
    expect(displayStyle.settings.getModelAppearanceOverride(modelId1)!.equals(modelOverride1)).toBeTruthy();

    displayStyle.settings.dropModelAppearanceOverride(modelId1);
    expect(!displayStyle.settings.hasModelAppearanceOverride).toBeTruthy();

    displayStyle.settings.overrideModelAppearance(modelId1, modelOverride1);
    displayStyle.settings.overrideModelAppearance(modelId2, modelOverride2);
    expect(displayStyle.settings.getModelAppearanceOverride(modelId1)!.equals(modelOverride1)).toBeTruthy();
    expect(displayStyle.settings.getModelAppearanceOverride(modelId2)!.equals(modelOverride2)).toBeTruthy();
    expect(displayStyle.settings.getModelAppearanceOverride(modelId3)).toBeUndefined();

    const overrides = new Overrides(viewState);
    overrides.setAlwaysDrawn(elementId);
    const appearance1 = overrides.getFeatureAppearance(feature, modelId1);
    const appearance2 = overrides.getFeatureAppearance(feature, modelId2);
    const appearance3 = overrides.getFeatureAppearance(feature, modelId3);

    expect(appearance1!.equals(modelOverride1)).toBeTruthy();
    expect(appearance2!.equals(modelOverride2)).toBeTruthy();
    expect(!appearance3?.overridesRgb).toBeTruthy();
  });

  it("overrides subcategory visibility", () => {
    // Initial view has categories 17, 2d, 2f, 31 enabled.
    // Each has one subcategory, except 31 which has 2 (32 and 33).
    // Subcategory 33 is overridden to be invisible.
    let ovrs = new Overrides(viewState);
    for (const id of ["0x18", "0x2e", "0x30", "0x32"])
      ovrs.expectSubCategory(id, true);

    ovrs.expectSubCategory("0x33", false);

    viewState.categorySelector.categories.delete("0x17");
    ovrs = new Overrides(viewState);
    for (const id of ["0x18", "0x33"])
      ovrs.expectSubCategory(id, false);

    for (const id of ["0x2e", "0x30", "0x32"])
      ovrs.expectSubCategory(id, true);

    viewState.displayStyle.dropSubCategoryOverride("0x33");
    viewState.displayStyle.overrideSubCategory("0x2e", SubCategoryOverride.fromJSON({ invisible: true }));
    viewState.displayStyle.overrideSubCategory("ox32", SubCategoryOverride.fromJSON({ invisible: false }));
    ovrs = new Overrides(viewState);
    for (const id of ["0x18", "0x2e"])
      ovrs.expectSubCategory(id, false);

    for (const id of ["0x30", "0x32", "0x33"])
      ovrs.expectSubCategory(id, true);

    viewState.displayStyle.overrideSubCategory("0x30", SubCategoryOverride.fromJSON({ color: ColorDef.green.tbgr }));
    ovrs = new Overrides(viewState);
    ovrs.expectSubCategory("0x30", true);

    viewState.displayStyle.overrideSubCategory("0x30", SubCategoryOverride.fromJSON({ color: ColorDef.green.tbgr, invisible: true }));
    ovrs = new Overrides(viewState);
    ovrs.expectSubCategory("0x30", false);
  });
});
