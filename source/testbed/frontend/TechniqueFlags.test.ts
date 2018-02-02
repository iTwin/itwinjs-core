/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { FeatureDimension, FeatureDimensions, LUTDimension, FeatureIndexType } from "../../frontend/render/FeatureDimensions";
import { TechniqueFlags, Mode, WithClipVolume } from "../../frontend/render/TechniqueFlags";

describe.only("TechniqueFlags", () => {
  it("constructor should correctly set member variables", () => {
    let techFlags = new TechniqueFlags();
    assert.isFalse(techFlags.monochrome, "default constructor sets monochrome to false");
    assert.isFalse(techFlags.clipVolume, "default constructor sets clipVolume to false");
    assert.isFalse(techFlags.translucent, "default constructor sets translucent to false");
    assert.isFalse(techFlags.featureOverrides, "default constructor sets featureOverrides to false");
    assert.isTrue(techFlags.featureDimensions.getValue() === FeatureDimension.kEmpty, "default constructor sets featureDimensions to be empty");
    assert.isTrue(techFlags.mode === Mode.kMode_Normal, "default constructor sets mode to kMode_Normal");
    const colorDimension = LUTDimension.NonUniform;
    techFlags = new TechniqueFlags(colorDimension, true);
    assert.isTrue(techFlags.colorDimension === colorDimension, "constructor can set colorDimension");
    assert.isTrue(techFlags.translucent, "constructor can set translucent");
  });
  it("getters work as expected", () => {
    const techFlags = new TechniqueFlags();
    assert.isTrue(techFlags.isMonochrome === techFlags.monochrome, "isMonochrome");
    assert.isTrue(techFlags.featureDimensionType === techFlags.featureDimensions.getValue(), "featureDimensionType");
    assert.isTrue(techFlags.isTranslucent === techFlags.translucent, "isTranslucent");
    assert.isTrue(techFlags.hasClipVolume === techFlags.clipVolume, "hasClipVolume");
    assert.isTrue(techFlags.isUniformColor === (techFlags.colorDimension === LUTDimension.Uniform), "default isUniformColor");
    assert.isFalse(techFlags.isHilite, "default isHilite");
    assert.isFalse(techFlags.hasFeatureDimensions, "default hasFeatureDimensions");
    assert.isTrue(techFlags.colorStr === "Uniform color", "default colorStr");
    assert.isTrue(techFlags.featureOverrideStr === "Empty feature overrides", "default featureOverrideStr");
    assert.isUndefined(techFlags.monochromeStr, "default monochromeStr");
    assert.isUndefined(techFlags.translucentStr, "default translucentStr");
    assert.isUndefined(techFlags.hiliteStr, "default hiliteStr");
    assert.isUndefined(techFlags.clipVolumeStr, "default isMonochrome");
    expect(techFlags.descriptors).to.deep.equal(["Uniform color", "Empty feature overrides"]);
    assert.isTrue(techFlags.description === "Uniform color; Empty feature overrides", "default description");
    // modifying colorDimension works as expected
    techFlags.colorDimension = LUTDimension.NonUniform;
    assert.isFalse(techFlags.isUniformColor, "isUniformColor updates correctly when colorDimension changed");
    assert.isTrue(techFlags.colorStr === "Non-uniform color", "colorStr updates correctly when colorDimension changed");
    expect(techFlags.descriptors).to.deep.equal(["Non-uniform color", "Empty feature overrides"]);
    assert.isTrue(techFlags.description === "Non-uniform color; Empty feature overrides", "description updates correctly when colorDimension changed");
    // modifying translucent works as expected
    techFlags.translucent = true;
    assert.isTrue(techFlags.isTranslucent, "isTranslucent updates correctly when translucent changes");
    assert.isTrue(techFlags.translucentStr === "translucent", "translucentStr updates correctly when translucent changes");
    expect(techFlags.descriptors).to.deep.equal(["Non-uniform color", "translucent", "Empty feature overrides"]);
    assert.isTrue(techFlags.description === "Non-uniform color; translucent; Empty feature overrides", "description updates correctly when translucent changed");
    // modifying clipVolume works as expected
    techFlags.clipVolume = true;
    assert.isTrue(techFlags.hasClipVolume, "hasClipVolume updates correctly when clipVolume changes");
    assert.isTrue(techFlags.clipVolumeStr === "clip", "clipVolumeStr updates correctly when clipVolume changes");
    expect(techFlags.descriptors).to.deep.equal(["Non-uniform color", "translucent", "clip", "Empty feature overrides"]);
    assert.isTrue(techFlags.description === "Non-uniform color; translucent; clip; Empty feature overrides", "description updates correctly when clipVolume changed");
    // modifying monochrome works as expected
    techFlags.monochrome = true;
    assert.isTrue(techFlags.isMonochrome, "isMonochrome updates correctly when monochrome changes");
    assert.isTrue(techFlags.monochromeStr === "monochrome", "monochromeStr updates correctly when monochrome changes");
    expect(techFlags.descriptors).to.deep.equal(["Non-uniform color", "translucent", "monochrome", "clip", "Empty feature overrides"]);
    assert.isTrue(techFlags.description === "Non-uniform color; translucent; monochrome; clip; Empty feature overrides", "description updates correctly when monochrome changed");
    // modifying mode works as expected
    techFlags.mode = Mode.kMode_Hilite;
    assert.isTrue(techFlags.isHilite, "isHilite updates correctly when mode changes");
    assert.isTrue(techFlags.hiliteStr === "hilite", "hiliteStr updates correctly when mode changes");
    expect(techFlags.descriptors).to.deep.equal(["Non-uniform color", "translucent", "monochrome", "hilite", "clip", "Empty feature overrides"]);
    assert.isTrue(techFlags.description === "Non-uniform color; translucent; monochrome; hilite; clip; Empty feature overrides", "description updates correctly when mode changed");
    // modifying featureDimensions works as expected
    techFlags.featureDimensions = FeatureDimensions.singleUniform();
    assert.isTrue(techFlags.featureDimensionType === FeatureDimension.kSingleUniform, "featureDimensionType updates correctly when featureDimensions changes");
    assert.isTrue(techFlags.featureOverrideStr === "Single/Uniform feature overrides", "featureOverrideStr updates correctly when featureDimensions changes");
    assert.isTrue(techFlags.hasFeatureDimensions, "hasFeatureDimensions updates correctly when featureDimensions changes");
    expect(techFlags.descriptors).to.deep.equal(["Non-uniform color", "translucent", "monochrome", "hilite", "clip", "Single/Uniform feature overrides"]);
    assert.isTrue(techFlags.description === "Non-uniform color; translucent; monochrome; hilite; clip; Single/Uniform feature overrides", "description updates correctly when featureDimensions changed");
  });
  it("setFeatureDimensions works as expected", () => {
    const techFlags = new TechniqueFlags();
    techFlags.setFeatureDimensions(FeatureIndexType.kUniform, LUTDimension.Uniform);
    assert.isTrue(techFlags.featureDimensionType === FeatureDimension.kSingleUniform);
    techFlags.setFeatureDimensions(FeatureIndexType.kNonUniform, LUTDimension.NonUniform);
    assert.isTrue(techFlags.featureDimensionType === FeatureDimension.kMultiple);
    techFlags.setFeatureDimensions(FeatureIndexType.kEmpty, LUTDimension.NonUniform);
    assert.isTrue(techFlags.featureDimensionType === FeatureDimension.kEmpty);
    techFlags.setFeatureDimensions(FeatureIndexType.kUniform, LUTDimension.NonUniform);
    assert.isTrue(techFlags.featureDimensionType === FeatureDimension.kSingleNonUniform);
  });
  it("setHilite works as expected", () => {
    const techFlags = new TechniqueFlags();

    // mix up member values to ensure they reset properly
    techFlags.monochrome = true;
    techFlags.translucent = true;
    techFlags.colorDimension = LUTDimension.NonUniform;

    techFlags.setHilite();
    assert.isTrue(techFlags.isHilite);
    assert.isFalse(techFlags.isTranslucent);
    assert.isFalse(techFlags.isMonochrome);
    assert.isTrue(techFlags.isHilite);
    assert.isTrue(techFlags.isUniformColor);
  });
  it("forHilite works as expected", () => {
    const techFlags = TechniqueFlags.forHilite(FeatureDimensions.singleUniform(), WithClipVolume.Yes);
    assert.isTrue(techFlags.featureDimensionType === FeatureDimension.kSingleUniform);
    assert.isTrue(techFlags.hasClipVolume);
    assert.isTrue(techFlags.isHilite);
  });
});
