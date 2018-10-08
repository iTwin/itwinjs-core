/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
// import { Point3d, Vector3d, YawPitchRollAngles, Range3d, Angle, Matrix3d } from "@bentley/geometry-core";
import { ViewDefinitionProps, GeometryClass, Feature, RgbColor, LinePixels, ViewFlags } from "@bentley/imodeljs-common";
import * as path from "path";
// import { DeepCompare } from "@bentley/geometry-core/lib/serialization/DeepCompare";
import { Id64 } from "@bentley/bentleyjs-core";
import { SpatialViewState, IModelConnection } from "@bentley/imodeljs-frontend";
import { FeatureSymbology } from "@bentley/imodeljs-frontend/lib/rendering";
import { CONSTANTS } from "../common/Testbed";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("FeatureSymbology.Appearance", () => {
  it("default constructor works as expected", () => {
    const app = FeatureSymbology.Appearance.fromJSON();
    assert.isUndefined(app.rgb);
    assert.isUndefined(app.weight);
    assert.isUndefined(app.alpha);
    assert.isUndefined(app.linePixels);
    assert.isFalse(app.ignoresMaterial);
  });

  it("AppearanceProps passed in constructor works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 200, linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 200, linePixels: LinePixels.Code2 } as FeatureSymbology.AppearanceProps;
    let app = FeatureSymbology.Appearance.fromJSON(props1);
    assert.isTrue(app.overridesRgb);
    assert.isTrue(app.overridesWeight);
    assert.isTrue(app.overridesAlpha);
    assert.isTrue(app.overridesLinePixels);
    assert.isTrue(app.ignoresMaterial);

    // keep ignoresMaterial defined as false by default not undfined
    app = FeatureSymbology.Appearance.fromJSON(props2);
    assert.isFalse(app.ignoresMaterial);
    assert.exists(app.ignoresMaterial);
  });

  it("extend works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { rgb: new RgbColor(250, 180, 150), weight: 1, alpha: 200, linePixels: LinePixels.Code3 } as FeatureSymbology.AppearanceProps;
    const expectedProps = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true, weight: 1, alpha: 200 } as FeatureSymbology.AppearanceProps;
    let app1 = FeatureSymbology.Appearance.fromJSON(props1);
    const app2 = FeatureSymbology.Appearance.fromJSON(props2);
    app1 = app2.extendAppearance(app1);
    const expected = FeatureSymbology.Appearance.fromJSON(expectedProps);
    assert.isTrue(expected.equals(app1));
  });
});

describe("FeatureSymbology.Overrides", () => {
  let imodel: IModelConnection,
    viewState: SpatialViewState,
    overrides: FeatureSymbology.Overrides;

  before(async () => {
    imodel = await IModelConnection.openStandalone(iModelLocation);
    const viewRows: ViewDefinitionProps[] = await imodel.views.queryProps({ from: SpatialViewState.sqlName });
    assert.exists(viewRows, "Should find some views");
    viewState = await imodel.views.load(viewRows[0].id!) as SpatialViewState;
  });

  after(async () => { if (imodel) imodel.closeStandalone(); });

  it("default constructor works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    assert.isFalse(overrides.isClassVisible(GeometryClass.Construction), "constructions");
    assert.isFalse(overrides.isClassVisible(GeometryClass.Dimension), "dimensions");
    assert.isFalse(overrides.isClassVisible(GeometryClass.Pattern), "patterns");
    assert.isTrue(overrides.lineWeights, "line weights");
    assert.isFalse(overrides.isAlwaysDrawnExclusive, "drawn exclusive");
    assert.exists(overrides.neverDrawn, "never");
    assert.exists(overrides.alwaysDrawn, "always");
    assert.exists(overrides.modelOverrides, "model overrides");
    assert.exists(overrides.elementOverrides, "element overrides");
    assert.exists(overrides.visibleSubCategories, "visible sub-categories");
    assert.exists(overrides.subCategoryOverrides, "sub-category overrides");
  });

  it("constructor with ViewState parameter works as expected", () => {
    // load viewState Special Elements
    const neverDrawn = new Set<string>();
    const alwaysDrawn = new Set<string>();
    neverDrawn.add("0x123");
    alwaysDrawn.add("0x124");
    viewState.setNeverDrawn(neverDrawn);
    viewState.setAlwaysDrawn(alwaysDrawn);

    // init overrides from ViewState
    overrides = new FeatureSymbology.Overrides(viewState);

    expect(overrides.isClassVisible(GeometryClass.Construction)).to.equal(viewState.viewFlags.constructions);
    expect(overrides.isClassVisible(GeometryClass.Dimension)).to.equal(viewState.viewFlags.dimensions);
    expect(overrides.isClassVisible(GeometryClass.Pattern)).to.equal(viewState.viewFlags.patterns);
    expect(overrides.lineWeights).to.equal(viewState.viewFlags.weights);
    expect(Array.from(overrides.neverDrawn)).to.deep.equals(Array.from(viewState.neverDrawn!));
    expect(Array.from(overrides.alwaysDrawn)).to.deep.equals(Array.from(viewState.alwaysDrawn!));
  });

  it("isClassVisible works as expected", () => {
    const vf = new ViewFlags();
    vf.constructions = false;
    vf.dimensions = false;
    vf.patterns = false;
    viewState.displayStyle.viewFlags = vf;

    assert.isFalse(overrides.isClassVisible(GeometryClass.Construction), "constructions 1");
    assert.isFalse(overrides.isClassVisible(GeometryClass.Dimension), "dimensions 1");
    assert.isFalse(overrides.isClassVisible(GeometryClass.Pattern), "patterns 1");

    vf.constructions = true;
    viewState.displayStyle.viewFlags = vf;
    overrides = new FeatureSymbology.Overrides(viewState);

    assert.isTrue(overrides.isClassVisible(GeometryClass.Construction), "constructions 2");

    vf.dimensions = true;
    viewState.displayStyle.viewFlags = vf;
    overrides = new FeatureSymbology.Overrides(viewState);

    assert.isTrue(overrides.isClassVisible(GeometryClass.Dimension), "dimensions 2");

    vf.patterns = true;
    viewState.displayStyle.viewFlags = vf;
    overrides = new FeatureSymbology.Overrides(viewState);

    assert.isTrue(overrides.isClassVisible(GeometryClass.Pattern), "patterns 2");

    assert.isTrue(overrides.isClassVisible(GeometryClass.Primary), "default");
  });

  it("isSubCategoryVisible works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    const subCategoryId = new Id64("0x124");
    assert.isFalse(overrides.isSubCategoryVisible(subCategoryId));

    overrides.setVisibleSubCategory(subCategoryId);
    assert.isTrue(overrides.isSubCategoryVisible(subCategoryId));
  });

  it("isFeatureVisible works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    const elementId = new Id64("0x123");
    const subCategoryId = new Id64("0x124");
    const geometryClass = GeometryClass.Construction;
    const feature = new Feature(elementId, subCategoryId, geometryClass);

    overrides = new FeatureSymbology.Overrides();
    assert.isFalse(overrides.isFeatureVisible(feature), "if subCategoryId isn't included in visibleSubCategories set, feature isn't visible");

    overrides.setNeverDrawn(elementId);
    assert.isFalse(overrides.isFeatureVisible(feature), "if elementId is in never drawn set, feature isn't visible");

    overrides = new FeatureSymbology.Overrides();
    overrides.setAlwaysDrawn(elementId);

    assert.isTrue(overrides.isFeatureVisible(feature), "if elementId is in always drawn set, feature is visible");

    overrides = new FeatureSymbology.Overrides();
    overrides.isAlwaysDrawnExclusive = true;

    // doesn't sound right... but this is how it works in the native code
    assert.isFalse(overrides.isFeatureVisible(feature), "if alwaysDrawnExclusive flag is set, but element not in always drawn set, feature isn't visible");

    overrides = new FeatureSymbology.Overrides();
    overrides.setVisibleSubCategory(subCategoryId);
    assert.isFalse(overrides.isFeatureVisible(feature), "if geometryClass isn't visible, feature isn't visible");

    const vf = new ViewFlags();
    vf.constructions = true;
    viewState.displayStyle.viewFlags = vf;
    overrides = new FeatureSymbology.Overrides(viewState);
    overrides.setVisibleSubCategory(subCategoryId);
    assert.isFalse(overrides.isFeatureVisible(feature), "if geometryClass and subCategory are visible, feature is visible");
  });

  it("getAppearance works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    const id = new Id64("0x111");
    const elementId = new Id64("0x128");
    const subCategoryId = new Id64("0x129");
    const geometryClass = GeometryClass.Construction;
    const feature = new Feature(elementId, subCategoryId, geometryClass);
    const props = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 100, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const modelProps = { ...props, alpha: 200 } as FeatureSymbology.AppearanceProps;
    const badModelProps = { ...props, alpha: 356 } as FeatureSymbology.AppearanceProps;
    const elemProps = { alpha: 200, linePixels: LinePixels.HiddenLine } as FeatureSymbology.AppearanceProps;
    const subCatProps = { linePixels: LinePixels.Code3, alpha: 90 } as FeatureSymbology.AppearanceProps;
    let modelApp = FeatureSymbology.Appearance.fromJSON(modelProps);
    const elemApp = FeatureSymbology.Appearance.fromJSON(elemProps);
    const subCatApp = FeatureSymbology.Appearance.fromJSON(subCatProps);
    let appearance: FeatureSymbology.Appearance | undefined;

    overrides.setNeverDrawn(elementId);

    appearance = overrides.getAppearance(feature, id);
    assert.isUndefined(appearance, "returns undefined if feature id is in the never drawn set");

    overrides = new FeatureSymbology.Overrides();
    overrides.isAlwaysDrawnExclusive = true;

    appearance = overrides.getAppearance(feature, id);
    assert.isUndefined(appearance, "returns false if feature isn't in always drawn set, but alwaysDrawnExclusive flag is set");

    overrides = new FeatureSymbology.Overrides();
    appearance = overrides.getAppearance(feature, id);
    assert.isUndefined(appearance, "returns false if feature isn't in always drawn set nor subCategoryId in visibleSubCategories set");

    overrides = new FeatureSymbology.Overrides();
    overrides.setAlwaysDrawn(elementId);
    appearance = overrides.getAppearance(feature, id);
    assert.isDefined(appearance, "return true if elementId is in always drawn set");

    const vf = new ViewFlags();
    vf.constructions = true;
    viewState.displayStyle.viewFlags = vf;
    overrides = new FeatureSymbology.Overrides(viewState);
    overrides.setVisibleSubCategory(subCategoryId);
    appearance = overrides.getAppearance(feature, id);
    assert.isDefined(appearance, "return true if either elementId is in always drawn set or subCategoryId is visible as well as geometryClass is visible");

    overrides = new FeatureSymbology.Overrides();
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    appearance = overrides.getAppearance(feature, id);
    assert.isUndefined(appearance, "if neither elementId is in alwaysDrawn set nor subCategoryId in visibleSubCategory set nor id in modelOverrides map, then app is reset");

    overrides = new FeatureSymbology.Overrides();
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    overrides.setAlwaysDrawn(elementId);
    appearance = overrides.getAppearance(feature, id);
    const msg = "if elementId in alwaysDrawn set, but id not in ModelOverrides map, nor elementId in elementOverrides map, nor subCategoryId in subCategoryOverrides, then app will be set to default overrides";
    assert.isTrue(appearance!.equals(overrides.defaultOverrides), msg);

    overrides = new FeatureSymbology.Overrides();
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    overrides.setAlwaysDrawn(elementId);
    overrides.overrideModel(id, modelApp);
    appearance = overrides.getAppearance(feature, id);
    assert.isTrue(appearance!.equals(modelApp), "if elementId in alwaysDrawn set and overrides has Model corresponding to id, then appearance will be set to the ModelApp");

    overrides = new FeatureSymbology.Overrides();
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    modelApp = FeatureSymbology.Appearance.fromJSON(badModelProps);
    overrides.setAlwaysDrawn(elementId);
    overrides.overrideModel(id, modelApp);
    appearance = overrides.getAppearance(feature, id);
    assert.isUndefined(appearance, "if appearance is set from model app and that app has an invalid alpha value, then getAppearance returns false");

    overrides = new FeatureSymbology.Overrides();
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    overrides.overrideElement(elementId, elemApp);
    overrides.setAlwaysDrawn(elementId);
    appearance = overrides.getAppearance(feature, id);
    assert.isTrue(appearance!.equals(elemApp), "if elementId in alwaysDrawn set and overrides has Element corresponding to id but not Model nor SubCategory, then the app is set to the elemApp");

    overrides = new FeatureSymbology.Overrides(viewState);
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    overrides.setVisibleSubCategory(subCategoryId);
    overrides.overrideSubCategory(subCategoryId, subCatApp);
    appearance = overrides.getAppearance(feature, id);
    assert.isTrue(appearance!.equals(subCatApp), "if subCategoryId is in visible set and SubCategoryApp is found, absent element or model apps, the result app is equal to the app extended by the subCategoryApp");

    overrides = new FeatureSymbology.Overrides(viewState);
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    modelApp = FeatureSymbology.Appearance.fromJSON(modelProps);
    overrides.overrideModel(id, modelApp);
    overrides.setVisibleSubCategory(subCategoryId);
    overrides.overrideSubCategory(subCategoryId, subCatApp);
    appearance = overrides.getAppearance(feature, id);
    let expected = subCatApp.extendAppearance(modelApp);
    assert.isTrue(appearance!.equals(expected), "if subCat and modelApp are found then the appearance is the extension of the subCatApp with the ModelApp");
    overrides = new FeatureSymbology.Overrides(viewState);
    appearance = FeatureSymbology.Appearance.fromJSON(props);
    modelApp = FeatureSymbology.Appearance.fromJSON(modelProps);
    overrides.overrideModel(id, modelApp);
    overrides.overrideElement(elementId, elemApp);
    overrides.setVisibleSubCategory(subCategoryId);
    overrides.overrideSubCategory(subCategoryId, subCatApp);
    appearance = overrides.getAppearance(feature, id);
    expected = elemApp.extendAppearance(modelApp);
    expected = subCatApp.extendAppearance(expected);
    assert.isTrue(appearance!.equals(expected), "if subCat, elemApp, and modelApp are found then the appearance is the extension of all three");
  });

  it("overrideModel works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    const id = new Id64("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 100, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { ...props1, alpha: 200 } as FeatureSymbology.AppearanceProps;
    const modelApp1 = FeatureSymbology.Appearance.fromJSON(props1);
    const modelApp2 = FeatureSymbology.Appearance.fromJSON(props2);
    overrides.overrideModel(id, modelApp1);
    assert.exists(overrides.getModelOverrides(id));

    overrides.overrideModel(id, modelApp2);
    assert.isTrue(overrides.getModelOverrides(id)!.equals(modelApp2), "overrideModel will override prexisting model associated with given id if replaceExisting is not set to false explicitly");

    overrides.overrideModel(id, modelApp1, false);
    assert.isTrue(overrides.getModelOverrides(id)!.equals(modelApp2), "overrides will not replace model if replace existing is set to false");

    overrides.overrideModel(id, modelApp1);
    assert.isTrue(overrides.getModelOverrides(id)!.equals(modelApp1), "overrides will replace model if replace existing isn't set to false (test 2)");
  });

  it("overrideSubCategory works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    const id = new Id64("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 100, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { ...props1, alpha: 200 } as FeatureSymbology.AppearanceProps;
    const subCatApp1 = FeatureSymbology.Appearance.fromJSON(props1);
    const subCatApp2 = FeatureSymbology.Appearance.fromJSON(props2);

    overrides.overrideSubCategory(id, subCatApp1);
    assert.isUndefined(overrides.getSubCategoryOverrides(id), "if subCategoryId not in subCategoryVisible set, then nothing is set");

    overrides.setVisibleSubCategory(id);
    overrides.overrideSubCategory(id, subCatApp2);
    assert.exists(overrides.getSubCategoryOverrides(id), "if subCategoryId is in subCategoryVisible set, then subCategoryApp set");

    overrides.overrideSubCategory(id, subCatApp1, false);
    assert.isTrue(overrides.getSubCategoryOverrides(id)!.equals(subCatApp2), "overrides will not replace subCatApp if replace existing is set to false");

    overrides.overrideSubCategory(id, subCatApp1);
    assert.isTrue(overrides.getSubCategoryOverrides(id)!.equals(subCatApp1), "overrides will replace subCatApp if replace existing isn't set to false");
  });

  it("overrideElement works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    const id = new Id64("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 100, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { ...props1, alpha: 200 } as FeatureSymbology.AppearanceProps;
    const elemApp1 = FeatureSymbology.Appearance.fromJSON(props1);
    const elemApp2 = FeatureSymbology.Appearance.fromJSON(props2);

    overrides.setNeverDrawn(id);
    overrides.overrideElement(id, elemApp1);
    assert.isUndefined(overrides.getElementOverrides(id), "if elementId is in never drawn set, then nothing is set");

    overrides = new FeatureSymbology.Overrides();
    overrides.overrideElement(id, elemApp1);
    assert.exists(overrides.getElementOverrides(id), "if elementId is not in never drawn set, then elemApp is set");

    overrides.overrideElement(id, elemApp2, false);
    assert.isTrue(overrides.getElementOverrides(id)!.equals(elemApp1), "overrides will not replace elemApp if replace existing is set to false");

    overrides.overrideElement(id, elemApp2);
    assert.isTrue(overrides.getElementOverrides(id)!.equals(elemApp2), "overrides will replace elemApp if replace existing isn't set to false");
  });

  it("setDefaultOverrides works as expected", () => {
    overrides = new FeatureSymbology.Overrides();
    assert.isTrue(overrides.defaultOverrides.equals(FeatureSymbology.Appearance.fromJSON()), "initial default overrides are equivalent to default appearance instance");

    const props = { rgb: new RgbColor(100, 100, 100), weight: 1, alpha: 100, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const app = FeatureSymbology.Appearance.fromJSON(props);
    overrides.setDefaultOverrides(app);
    assert.isTrue(overrides.defaultOverrides.equals(app), "default overrides can be overriden");
  });
});
