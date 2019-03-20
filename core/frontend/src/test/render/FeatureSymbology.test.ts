/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { RgbColor, LinePixels, GeometryClass } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../../render/FeatureSymbology";
import { Id64 } from "@bentley/bentleyjs-core";

describe("FeatureSymbology.Appearance", () => {
  it("default constructor works as expected", () => {
    const app = FeatureSymbology.Appearance.fromJSON();
    assert.isUndefined(app.rgb);
    assert.isUndefined(app.weight);
    assert.isUndefined(app.transparency);
    assert.isUndefined(app.linePixels);
    assert.isUndefined(app.ignoresMaterial);
  });

  it("AppearanceProps passed in constructor works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code2 } as FeatureSymbology.AppearanceProps;
    let app = FeatureSymbology.Appearance.fromJSON(props1);
    assert.isTrue(app.overridesRgb);
    assert.isTrue(app.overridesWeight);
    assert.isTrue(app.overridesTransparency);
    assert.isTrue(app.overridesLinePixels);
    assert.isTrue(app.ignoresMaterial);

    app = FeatureSymbology.Appearance.fromJSON(props2);
    assert.isUndefined(app.ignoresMaterial);
  });

  it("extend works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { rgb: new RgbColor(250, 180, 150), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code3 } as FeatureSymbology.AppearanceProps;
    const expectedProps = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true, weight: 1, transparency: 200 / 255 } as FeatureSymbology.AppearanceProps;
    let app1 = FeatureSymbology.Appearance.fromJSON(props1);
    const app2 = FeatureSymbology.Appearance.fromJSON(props2);
    app1 = app2.extendAppearance(app1);
    const expected = FeatureSymbology.Appearance.fromJSON(expectedProps);
    assert.isTrue(expected.equals(app1));
  });
});

describe("FeatureSymbology.Overrides", () => {
  class Overrides extends FeatureSymbology.Overrides {
    public constructor() { super(); }
    public get neverDrawn() { return this._neverDrawn; }
    public get alwaysDrawn() { return this._alwaysDrawn; }
    public get modelOverrides() { return this._modelOverrides; }
    public get elementOverrides() { return this._elementOverrides; }
    public get subCategoryOverrides() { return this._subCategoryOverrides; }
    public get visibleSubCategories() { return this._visibleSubCategories; }
  }

  it("default constructor works as expected", () => {
    const overrides = new Overrides();
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

  it("isSubCategoryVisible works as expected", () => {
    const overrides = new Overrides();
    const subCategoryId = Id64.fromString("0x124");
    assert.isFalse(overrides.isSubCategoryIdVisible(subCategoryId));

    overrides.setVisibleSubCategory(subCategoryId);
    assert.isTrue(overrides.isSubCategoryIdVisible(subCategoryId));
  });

  it("overrideModel works as expected", () => {
    const overrides = new Overrides();
    const id = Id64.fromString("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { ...props1, transparency: 200 / 255 } as FeatureSymbology.AppearanceProps;
    const modelApp1 = FeatureSymbology.Appearance.fromJSON(props1);
    const modelApp2 = FeatureSymbology.Appearance.fromJSON(props2);
    overrides.overrideModel(id, modelApp1);
    assert.exists(overrides.getModelOverridesById(id));

    overrides.overrideModel(id, modelApp2);
    assert.isTrue(overrides.getModelOverridesById(id)!.equals(modelApp2), "overrideModel will override prexisting model associated with given id if replaceExisting is not set to false explicitly");

    overrides.overrideModel(id, modelApp1, false);
    assert.isTrue(overrides.getModelOverridesById(id)!.equals(modelApp2), "overrides will not replace model if replace existing is set to false");

    overrides.overrideModel(id, modelApp1);
    assert.isTrue(overrides.getModelOverridesById(id)!.equals(modelApp1), "overrides will replace model if replace existing isn't set to false (test 2)");
  });

  it("overrideSubCategory works as expected", () => {
    const overrides = new Overrides();
    const id = Id64.fromString("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { ...props1, transparency: 200 / 255 } as FeatureSymbology.AppearanceProps;
    const subCatApp1 = FeatureSymbology.Appearance.fromJSON(props1);
    const subCatApp2 = FeatureSymbology.Appearance.fromJSON(props2);

    overrides.overrideSubCategory(id, subCatApp1);
    assert.isUndefined(overrides.getSubCategoryOverridesById(id), "if subCategoryId not in subCategoryVisible set, then nothing is set");

    overrides.setVisibleSubCategory(id);
    overrides.overrideSubCategory(id, subCatApp2);
    assert.exists(overrides.getSubCategoryOverridesById(id), "if subCategoryId is in subCategoryVisible set, then subCategoryApp set");

    overrides.overrideSubCategory(id, subCatApp1, false);
    assert.isTrue(overrides.getSubCategoryOverridesById(id)!.equals(subCatApp2), "overrides will not replace subCatApp if replace existing is set to false");

    overrides.overrideSubCategory(id, subCatApp1);
    assert.isTrue(overrides.getSubCategoryOverridesById(id)!.equals(subCatApp1), "overrides will replace subCatApp if replace existing isn't set to false");
  });

  it("overrideElement works as expected", () => {
    let overrides = new Overrides();
    const id = Id64.fromString("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { ...props1, transparency: 200 / 255 } as FeatureSymbology.AppearanceProps;
    const elemApp1 = FeatureSymbology.Appearance.fromJSON(props1);
    const elemApp2 = FeatureSymbology.Appearance.fromJSON(props2);

    overrides.setNeverDrawn(id);
    overrides.overrideElement(id, elemApp1);
    assert.isUndefined(overrides.getElementOverridesById(id), "if elementId is in never drawn set, then nothing is set");

    overrides = new Overrides();
    overrides.overrideElement(id, elemApp1);
    assert.exists(overrides.getElementOverridesById(id), "if elementId is not in never drawn set, then elemApp is set");

    overrides.overrideElement(id, elemApp2, false);
    assert.isTrue(overrides.getElementOverridesById(id)!.equals(elemApp1), "overrides will not replace elemApp if replace existing is set to false");

    overrides.overrideElement(id, elemApp2);
    assert.isTrue(overrides.getElementOverridesById(id)!.equals(elemApp2), "overrides will replace elemApp if replace existing isn't set to false");
  });

  it("setDefaultOverrides works as expected", () => {
    const overrides = new Overrides();
    assert.isTrue(overrides.defaultOverrides.equals(FeatureSymbology.Appearance.fromJSON()), "initial default overrides are equivalent to default appearance instance");

    const props = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const app = FeatureSymbology.Appearance.fromJSON(props);
    overrides.setDefaultOverrides(app);
    assert.isTrue(overrides.defaultOverrides.equals(app), "default overrides can be overriden");
  });
});
