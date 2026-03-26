/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, describe, expect, it } from "vitest";
import { Id64, Id64String } from "@itwin/core-bentley";
import { ColorDef } from "../ColorDef";
import { RgbColor } from "../RgbColor";
import { BatchType, Feature } from "../FeatureTable";
import { GeometryClass } from "../GeometryParams";
import { LinePixels } from "../LinePixels";
import { SubCategoryAppearance } from "../SubCategoryAppearance";
import { SubCategoryOverride } from "../SubCategoryOverride";
import {
  FeatureAppearance, FeatureAppearanceProps, FeatureAppearanceProvider, FeatureAppearanceSource, FeatureOverrides,
} from "../FeatureSymbology";

describe("FeatureAppearance", () => {
  it("default constructor works as expected", () => {
    const app = FeatureAppearance.fromJSON();
    assert.isUndefined(app.rgb);
    assert.isUndefined(app.weight);
    assert.isUndefined(app.transparency);
    assert.isUndefined(app.linePixels);
    assert.isUndefined(app.ignoresMaterial);
  });

  it("AppearanceProps passed in constructor works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureAppearanceProps;
    const props2 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code2 } as FeatureAppearanceProps;
    let app = FeatureAppearance.fromJSON(props1);
    assert.isTrue(app.overridesRgb);
    assert.isTrue(app.overridesWeight);
    assert.isTrue(app.overridesTransparency);
    assert.isTrue(app.overridesLinePixels);
    assert.isTrue(app.ignoresMaterial);

    app = FeatureAppearance.fromJSON(props2);
    assert.isUndefined(app.ignoresMaterial);
  });

  it("extend works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureAppearanceProps;
    const props2 = { rgb: new RgbColor(250, 180, 150), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code3 } as FeatureAppearanceProps;
    const expectedProps = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true, weight: 1, transparency: 200 / 255 } as FeatureAppearanceProps;
    let app1 = FeatureAppearance.fromJSON(props1);
    const app2 = FeatureAppearance.fromJSON(props2);
    app1 = app2.extendAppearance(app1);
    const expected = FeatureAppearance.fromJSON(expectedProps);
    assert.isTrue(expected.equals(app1));
  });

  it("clones with overrides", () => {
    const base = FeatureAppearance.fromRgba(ColorDef.white);
    const clone = base.clone({ transparency: undefined, weight: 5 });
    expect(clone.transparency).to.be.undefined;
    expect(clone.weight).to.equal(5);
    expect(clone.rgb).not.to.be.undefined;
    expect(clone.rgb!.r).to.equal(0xff);
    expect(clone.rgb!.g).to.equal(0xff);
    expect(clone.rgb!.b).to.equal(0xff);
  });

  it("creates for subcategory overrides", () => {
    function test(ovrProps: SubCategoryAppearance.Props, appProps: FeatureAppearanceProps): void {
      const ovr = SubCategoryOverride.fromJSON(ovrProps);
      expect(ovr.toJSON()).to.deep.equal(ovrProps);
      const app = FeatureAppearance.fromJSON(appProps);
      expect(app.toJSON()).to.deep.equal(appProps);

      expect(app.rgb?.toColorDef().toJSON()).to.equal(ovrProps.color);
      expect(app.transparency).to.equal(ovrProps.transp);
      expect(app.weight).to.equal(ovrProps.weight);
      // NB: Not testing material because unclear that it's implemented properly...
    }

    test({}, {});
    test({ color: ColorDef.from(0, 127, 255).toJSON() }, { rgb: { r: 0, g: 127, b: 255 } });
    test({ invisible: true }, {});
    test({ invisible: false }, {});
    test({ weight: 12 }, { weight: 12 });
    test({ transp: 0 }, { transparency: 0 });
    test({ transp: 0.5 }, { transparency: 0.5 });
    test({ transp: 1.0 }, { transparency: 1.0 });
  });

  it("view-dependent transparency serialization", () => {
    function test(appProps: FeatureAppearanceProps, expectViewDependent: boolean): void {
      const expected = expectViewDependent ? true : undefined;
      const app = FeatureAppearance.fromJSON(appProps);
      expect(app.viewDependentTransparency).to.equal(expected);
      expect(app.toJSON().viewDependentTransparency).to.equal(expected);
    }

    test({ }, false);
    test({ transparency: undefined }, false);
    test({ transparency: 1 }, false);
    test({ transparency: 0 }, false );

    test({ transparency: 1, viewDependentTransparency: true }, true);
    test({ transparency: 0, viewDependentTransparency: true }, true);

    test({ viewDependentTransparency: true }, false);
    test({ transparency: undefined, viewDependentTransparency: true }, false);
  });
  it("view-dependent transparency from subcategory override", () => {
    function test(ovrProps: SubCategoryAppearance.Props, expectViewDependent: boolean): void {
      const expected = expectViewDependent ? true : undefined;
      const ovr = SubCategoryOverride.fromJSON(ovrProps);
      const app = FeatureAppearance.fromSubCategoryOverride(ovr);
      expect(app.viewDependentTransparency).to.equal(expected);
      expect(app.toJSON().viewDependentTransparency).to.equal(expected);
    }

    test({ transp: 0.5 }, true);
    test({ transp: 0 }, true);
    test({ transp: undefined }, false);
    test({ }, false);
    test({ color: ColorDef.blue.toJSON() }, false);
  });

  it("compares for equality", () => {
    const apprA = FeatureAppearance.defaults;
    const apprB = FeatureAppearance.fromJSON({ lineRgb: RgbColor.fromColorDef(ColorDef.white) });
    expect(apprA.equals(apprB)).to.be.false;
    expect(apprA.equals(apprA)).to.be.true;
    expect(apprB.equals(apprB)).to.be.true;
    expect(apprB.equals(apprA)).to.be.false;
  });
});

describe("FeatureOverrides", () => {
  class Overrides extends FeatureOverrides {
    public constructor() { super(); }
    public get elementOverrides() { return this._elementOverrides; }
    public get modelSubCategoryOverrides() { return this._modelSubCategoryOverrides; }
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
  });

  it("isSubCategoryVisible works as expected", () => {
    const overrides = new Overrides();
    const subCategoryId = Id64.fromString("0x124");
    assert.isFalse(overrides.isSubCategoryIdVisible(subCategoryId));

    overrides.setVisibleSubCategory(subCategoryId);
    assert.isTrue(overrides.isSubCategoryIdVisible(subCategoryId));
  });

  it("override Model works as expected", () => {
    const overrides = new Overrides();
    const modelId = Id64.fromString("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureAppearanceProps;
    const props2 = { ...props1, transparency: 200 / 255 } as FeatureAppearanceProps;
    const modelApp1 = FeatureAppearance.fromJSON(props1);
    const modelApp2 = FeatureAppearance.fromJSON(props2);
    overrides.override({modelId, appearance: modelApp1});
    assert.exists(overrides.getModelOverridesById(modelId));

    overrides.override({modelId, appearance: modelApp2});
    assert.isTrue(overrides.getModelOverridesById(modelId)!.equals(modelApp2), "overrideModel will override prexisting model associated with given id if replaceExisting is not set to false explicitly");

    overrides.override({modelId, appearance: modelApp1, onConflict: "skip"});
    assert.isTrue(overrides.getModelOverridesById(modelId)!.equals(modelApp2), "overrides will not replace model if replace existing is set to false");

    overrides.override({modelId, appearance: modelApp1});
    assert.isTrue(overrides.getModelOverridesById(modelId)!.equals(modelApp1), "overrides will replace model if replace existing isn't set to false (test 2)");
  });

  it("override SubCategory works as expected", () => {
    const overrides = new Overrides();
    const subCategoryId = Id64.fromString("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureAppearanceProps;
    const props2 = { ...props1, transparency: 200 / 255 } as FeatureAppearanceProps;
    const subCatApp1 = FeatureAppearance.fromJSON(props1);
    const subCatApp2 = FeatureAppearance.fromJSON(props2);

    // Even though the subcategory is invisible, it's possible a model will override it to be visible.
    // So override() will record the appearance override anyway.
    expect(overrides.getSubCategoryOverridesById(subCategoryId)).to.be.undefined;
    overrides.override({subCategoryId, appearance: subCatApp1});
    expect(overrides.getSubCategoryOverridesById(subCategoryId)).not.to.be.undefined;

    overrides.setVisibleSubCategory(subCategoryId);
    overrides.override({subCategoryId, appearance: subCatApp2});
    assert.exists(overrides.getSubCategoryOverridesById(subCategoryId), "if subCategoryId is in subCategoryVisible set, then subCategoryApp set");

    overrides.override({subCategoryId, appearance: subCatApp1, onConflict: "skip"});
    assert.isTrue(overrides.getSubCategoryOverridesById(subCategoryId)!.equals(subCatApp2), "overrides will not replace subCatApp if replace existing is set to false");

    overrides.override({subCategoryId, appearance: subCatApp1});
    assert.isTrue(overrides.getSubCategoryOverridesById(subCategoryId)!.equals(subCatApp1), "overrides will replace subCatApp if replace existing isn't set to false");
  });

  it("override Element works as expected", () => {
    let overrides = new Overrides();
    const elementId = Id64.fromString("0x111");
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureAppearanceProps;
    const props2 = { ...props1, transparency: 200 / 255 } as FeatureAppearanceProps;
    const elemApp1 = FeatureAppearance.fromJSON(props1);
    const elemApp2 = FeatureAppearance.fromJSON(props2);

    overrides.setNeverDrawn(elementId);
    overrides.override({elementId, appearance: elemApp1});
    assert.isUndefined(overrides.getElementOverridesById(elementId), "if elementId is in never drawn set, then nothing is set");

    overrides = new Overrides();
    overrides.override({elementId, appearance: elemApp1});
    assert.exists(overrides.getElementOverridesById(elementId), "if elementId is not in never drawn set, then elemApp is set");

    overrides.override({elementId, appearance: elemApp2, onConflict: "skip"});
    assert.isTrue(overrides.getElementOverridesById(elementId)!.equals(elemApp1), "overrides will not replace elemApp if replace existing is set to false");

    overrides.override({elementId, appearance: elemApp2});
    assert.isTrue(overrides.getElementOverridesById(elementId)!.equals(elemApp2), "overrides will replace elemApp if replace existing isn't set to false");
  });

  it("setDefaultOverrides works as expected", () => {
    const overrides = new Overrides();
    assert.isTrue(overrides.defaultOverrides.equals(FeatureAppearance.fromJSON()), "initial default overrides are equivalent to default appearance instance");

    const props = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 100 / 255, linePixels: LinePixels.Solid, ignoresMaterial: true } as FeatureAppearanceProps;
    const app = FeatureAppearance.fromJSON(props);
    overrides.setDefaultOverrides(app);
    assert.isTrue(overrides.defaultOverrides.equals(app), "default overrides can be overriden");
  });

  it("should not apply default overrides if appearance explicitly specified", () => {
    // 1: Register an Appearance which overrides color.
    // 2: Register an Appearance which overrides nothing.
    // 3: Do not register an Appearance.
    const cat1 = "0x1", cat2 = "0x2", cat3 = "0x3";
    const mod1 = "0x4", mod2 = "0x5", mod3 = "0x6";
    const el1 = "0x7", el2 = "0x8", el3 = "0x9";

    const ovrs = new Overrides();
    ovrs.setVisibleSubCategory(cat1);
    ovrs.setVisibleSubCategory(cat2);
    ovrs.setVisibleSubCategory(cat3);

    const app = FeatureAppearance.fromRgb(ColorDef.green);
    const noApp = FeatureAppearance.fromJSON();
    const defApp = FeatureAppearance.fromRgb(ColorDef.red);
    ovrs.setDefaultOverrides(defApp);

    ovrs.override({elementId: el1, appearance: app});
    ovrs.override({modelId: mod1, appearance: app});
    ovrs.override({subCategoryId: cat1, appearance: app});
    ovrs.override({elementId: el2, appearance: noApp});
    ovrs.override({modelId: mod2, appearance: noApp});
    ovrs.override({subCategoryId: cat2, appearance: noApp});

    const expectAppearance = (elem: Id64String, model: Id64String, subcat: Id64String, expectedAppearance: FeatureAppearance) => {
      const feature = new Feature(elem, subcat, GeometryClass.Primary);
      const appearance = ovrs.getFeatureAppearance(feature, model);
      expect(JSON.stringify(appearance)).to.equal(JSON.stringify(expectedAppearance));
    };

    expectAppearance(el1, mod3, cat3, app);
    expectAppearance(el2, mod3, cat3, noApp);
    expectAppearance(el3, mod3, cat3, defApp);

    expectAppearance(el3, mod1, cat3, app);
    expectAppearance(el3, mod2, cat3, noApp);

    expectAppearance(el3, mod3, cat1, app);
    expectAppearance(el3, mod3, cat2, noApp);
  });

  it("overrides subcategory visibility per model", () => {
    // Subcategories 1 and 2 are visible
    const ovrs = new Overrides();
    ovrs.setVisibleSubCategory("0x1");
    ovrs.setVisibleSubCategory("0x2");

    expect(ovrs.isSubCategoryVisible(1, 0)).to.be.true;
    expect(ovrs.isSubCategoryVisible(2, 0)).to.be.true;
    expect(ovrs.isSubCategoryVisible(3, 0)).to.be.false;
    expect(ovrs.isSubCategoryVisible(4, 0)).to.be.false;

    // In model a, subcat 3 is visible and subcat 1 is invisible
    ovrs.modelSubCategoryOverrides.set(0xa, 0, new Id64.Uint32Set(["0x3", "0x1"]));
    expect(ovrs.isSubCategoryVisibleInModel(1, 0, 0xa, 0)).to.be.false;
    expect(ovrs.isSubCategoryVisibleInModel(2, 0, 0xa, 0)).to.be.true;
    expect(ovrs.isSubCategoryVisibleInModel(3, 0, 0xa, 0)).to.be.true;
    expect(ovrs.isSubCategoryVisibleInModel(4, 0, 0xa, 0)).to.be.false;

    // In model b, subcats 1 and 2 are invisible
    ovrs.modelSubCategoryOverrides.set(0xb, 0, new Id64.Uint32Set(["0x1", "0x2"]));
    for (let i = 1; i < 5; i++)
      expect(ovrs.isSubCategoryVisibleInModel(i, 0, 0xb, 0)).to.be.false;

    // In model c, subcats 3 and 4 are visible
    ovrs.modelSubCategoryOverrides.set(0xc, 0, new Id64.Uint32Set(["0x3", "0x4"]));
    for (let i = 1; i < 5; i++)
      expect(ovrs.isSubCategoryVisibleInModel(i, 0, 0xc, 0)).to.be.true;

    expect(ovrs.isSubCategoryVisible(1, 0)).to.be.true;
    expect(ovrs.isSubCategoryVisible(2, 0)).to.be.true;
    expect(ovrs.isSubCategoryVisible(3, 0)).to.be.false;
    expect(ovrs.isSubCategoryVisible(4, 0)).to.be.false;
  });

  it("hides animation nodes", () => {
    const feature = new Feature("0x123");
    const modelId = "0x456";
    const ovrs = new Overrides();

    ovrs.neverDrawnAnimationNodes.add(1);
    ovrs.neverDrawnAnimationNodes.add(0);
    expect(ovrs.getFeatureAppearance(feature, modelId, undefined, 1)).to.be.undefined;
    expect(ovrs.getFeatureAppearance(feature, modelId, undefined, 2)).not.to.be.undefined;
    expect(ovrs.getFeatureAppearance(feature, modelId, undefined, 0)).to.be.undefined;
  });

  it("overrides animation nodes", () => {
    const ovrs = new Overrides();

    const expectAppearance = (nodeId: number, expected: FeatureAppearance) => {
      const actual = ovrs.getFeatureAppearance(new Feature("0x123"), "0x456", undefined, nodeId)!;
      expect(actual).not.to.be.undefined;
      expect(JSON.stringify(actual)).to.equal(JSON.stringify(expected));
    };

    const green = FeatureAppearance.fromRgb(ColorDef.green);
    const blue = FeatureAppearance.fromRgb(ColorDef.blue);
    ovrs.animationNodeOverrides.set(0, green);
    ovrs.animationNodeOverrides.set(1, blue);
    expectAppearance(1, blue);
    expectAppearance(2, FeatureAppearance.defaults);
    expectAppearance(0, green);
  });

  it("animation overrides extend element overrides", () => {
    const ovrs = new Overrides();

    const expectAppearance = (elementId: string, nodeId: number, expected: FeatureAppearance) => {
      const actual = ovrs.getFeatureAppearance(new Feature(elementId), "0x1", undefined, nodeId);
      expect(actual).not.to.be.undefined;
      expect(JSON.stringify(actual)).to.equal(JSON.stringify(expected));
    };

    const merge = (src: FeatureAppearance, plus: FeatureAppearanceProps): FeatureAppearance => {
      return FeatureAppearance.fromJSON({
        ...src.toJSON(),
        ...plus,
      });
    };

    const blue = FeatureAppearance.fromRgb(ColorDef.blue);
    const red = FeatureAppearance.fromRgb(ColorDef.red);
    const halfTransp = FeatureAppearance.fromTransparency(0.5);
    const halfTranspWeight5 = merge(halfTransp, { weight: 5 });

    ovrs.overrideAnimationNode(1, red);
    ovrs.overrideAnimationNode(2, halfTransp);
    ovrs.overrideAnimationNode(3, halfTranspWeight5);

    expectAppearance("0xa", 1, red);
    expectAppearance("0xa", 2, halfTransp);
    expectAppearance("0xa", 3, halfTranspWeight5);

    ovrs.override({elementId: "0xc", appearance: FeatureAppearance.defaults});
    expectAppearance("0xc", 1, red);
    expectAppearance("0xc", 2, halfTransp);
    expectAppearance("0xc", 3, halfTranspWeight5);

    ovrs.override({elementId: "0xa", appearance: blue});
    expectAppearance("0xa", 1, blue);
    expectAppearance("0xa", 2, merge(blue, { transparency: 0.5 }));
    expectAppearance("0xa", 3, merge(blue, { transparency: 0.5, weight: 5 }));

    const greenWeight3 = FeatureAppearance.fromJSON({ rgb: { r: 0, g: 255, b: 0 }, weight: 3 });
    ovrs.override({elementId: "0xb", appearance: greenWeight3});
    expectAppearance("0xb", 1, greenWeight3);
    expectAppearance("0xb", 2, merge(greenWeight3, { transparency: 0.5 }));
    expectAppearance("0xb", 3, merge(greenWeight3, { transparency: 0.5 }));
  });

  it("ignores animation color/transparency overrides if specified", () => {
    const ovrs = new Overrides();

    const red = FeatureAppearance.fromRgb(ColorDef.red);
    const green = FeatureAppearance.fromRgb(ColorDef.green);
    const blue = FeatureAppearance.fromRgb(ColorDef.blue);
    ovrs.overrideAnimationNode(1, red);
    ovrs.overrideAnimationNode(5, green);
    ovrs.overrideAnimationNode(10, blue);

    ovrs.ignoreAnimationOverrides((args) => args.elementId.lower > 5);
    ovrs.ignoreAnimationOverrides((args) => args.animationNodeId < 5);

    const expectAppearance = (elemId: string, nodeId: number, expected: FeatureAppearance) => {
      const actual = ovrs.getFeatureAppearance(new Feature(elemId), "0x1", undefined, nodeId);
      expect(actual).not.to.be.undefined;
      expect(JSON.stringify(actual)).to.equal(JSON.stringify(expected));
    };

    expectAppearance("0x1", 10, blue);
    expectAppearance("0x1", 5, green);

    expectAppearance("0x10", 10, FeatureAppearance.defaults);
    expectAppearance("0x1", 1, FeatureAppearance.defaults);
    expectAppearance("0x6", 5, FeatureAppearance.defaults);

    const black = FeatureAppearance.fromRgb(ColorDef.black);
    ovrs.setDefaultOverrides(black);
    expectAppearance("0x10", 10, black);
    expectAppearance("0x1", 1, black);
    expectAppearance("0x6", 5, black);
  });

  it("applies conflict strategy", () => {
    const elementId = "0x1";
    const ovrs = new Overrides();

    const test = (appearance: FeatureAppearance, onConflict: "subsume" | "extend" | "replace" | "skip" = "extend", expected: FeatureAppearance | undefined) => {
      ovrs.override({ elementId, appearance, onConflict });
      const actual = ovrs.getElementOverridesById(elementId);
      if (!expected) {
        expect(actual).to.be.undefined;
      } else {
        expect(actual).not.to.be.undefined;
        expect(actual!.equals(expected)).to.be.true;
      }
    };

    const green = FeatureAppearance.fromRgb(ColorDef.green);
    for (const onConflict of ["extend", "replace", "skip", undefined]) {
      ovrs.elementOverrides.clear();
      expect(ovrs.getElementOverridesById(elementId)).to.be.undefined;
      test(green, onConflict as "subsume" | "extend" | "replace" | "skip" | undefined, green);
    }

    test(FeatureAppearance.fromTransparency(0.5), "skip", green);
    test(FeatureAppearance.fromRgb(ColorDef.blue), "extend", green);

    const blue = FeatureAppearance.fromRgb(ColorDef.blue);
    test(blue, "replace", blue);
    test(FeatureAppearance.fromRgba(ColorDef.red.withTransparency(0x7f)), "skip", blue);
    test(FeatureAppearance.fromRgba(ColorDef.red.withTransparency(0x7f)), "extend", FeatureAppearance.fromRgba(ColorDef.blue.withTransparency(0x7f)));

    test(FeatureAppearance.fromTransparency(0.25), "subsume", FeatureAppearance.fromRgba(ColorDef.blue.withTransparency(0x3f)));
    test(FeatureAppearance.fromRgb(ColorDef.red), "subsume", FeatureAppearance.fromRgba(ColorDef.red.withTransparency(0x3f)));
  });

  it("subsumes by default", () => {
    const elementId = "0x1";
    const ovrs = new Overrides();
    ovrs.override({ elementId, appearance: FeatureAppearance.fromRgba(ColorDef.blue.withTransparency(0x7f)) });
    ovrs.override({ elementId, appearance: FeatureAppearance.fromRgb(ColorDef.red) });

    const app = ovrs.getElementOverridesById(elementId)!;
    expect(app.equals(FeatureAppearance.fromRgba(ColorDef.red.withTransparency(0x7f)))).to.be.true;
  });
});

describe("FeatureAppearanceProvider", () => {
  class Source implements FeatureAppearanceSource {
    public constructor(public readonly appearance: FeatureAppearance | undefined) { }

    public getAppearance(_elemLo: number, _elemHi: number, _subcatLo: number, _subcatHi: number, _geomClass: GeometryClass, _modelLo: number, _modelHi: number, _type: BatchType, _animationNodeId: number) {
      return this.appearance;
    }
  }

  class Provider implements FeatureAppearanceProvider {
    public constructor(public readonly modifyAppearance: (app: FeatureAppearance) => FeatureAppearance) { }

    public getFeatureAppearance(source: FeatureAppearanceSource, elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, geomClass: GeometryClass, modelLo: number, modelHi: number, type: BatchType, animationNodeId: number) {
      const app = source.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
      return app ? this.modifyAppearance(app) : undefined;
    }
  }

  function getAppearance(source: FeatureAppearanceSource, provider: FeatureAppearanceProvider): FeatureAppearance | undefined {
    return provider.getFeatureAppearance(source, 0, 0, 0, 0, GeometryClass.Primary, 0, 0, BatchType.Primary, 0);
  }

  it("Chains providers in expected order", () => {
    const materialProvider = new Provider((appearance) => {
      return FeatureAppearance.fromJSON({
        ...appearance.toJSON(),
        ignoresMaterial: true,
        transparency: 0.25,
      });
    });

    const emphasisProvider = new Provider((appearance) => {
      return FeatureAppearance.fromJSON({
        ...appearance.toJSON(),
        emphasized: true,
        transparency: 0.75,
      });
    });

    const source = new Source(FeatureAppearance.fromJSON({ weight: 5 }));

    let chained = FeatureAppearanceProvider.chain(materialProvider, emphasisProvider);
    let app = getAppearance(source, chained)!;
    expect(app.weight).to.equal(5);
    expect(app.transparency).to.equal(0.75);
    expect(app.emphasized).to.be.true;
    expect(app.ignoresMaterial).to.be.true;

    chained = FeatureAppearanceProvider.chain(emphasisProvider, materialProvider);
    app = getAppearance(source, chained)!;
    expect(app.weight).to.equal(5);
    expect(app.transparency).to.equal(0.25);
    expect(app.emphasized).to.be.true;
    expect(app.ignoresMaterial).to.be.true;
  });

  it("creates supplemental provider", () => {
    const provider = FeatureAppearanceProvider.supplement((app: FeatureAppearance) => {
      return FeatureAppearance.fromJSON({
        ...app.toJSON(),
        transparency: 0.5,
      });
    });

    let appearance = getAppearance(new Source(FeatureAppearance.fromJSON({ weight: 5 })), provider);
    expect(appearance!.weight).to.equal(5);
    expect(appearance!.transparency).to.equal(0.5);

    appearance = getAppearance(new Source(undefined), provider);
    expect(appearance).to.be.undefined;
  });

  it("does not introduce infinite recursion", () => {
    const provider = new Provider((app) => app);
    const chained = FeatureAppearanceProvider.chain(provider, provider);
    expect(chained).to.equal(provider);
  });
});
