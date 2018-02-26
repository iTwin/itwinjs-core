/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { LUTParams, getFeatureName, FeatureDimension, FeatureDimensions, FeatureDimensionsIterator } from "../../frontend/render/webgl/FeatureDimensions";
import { FeatureIndexType } from "../../frontend/render/webgl/FeatureIndex";

describe("LUTParams", () => {
  it("should create and store LUTParams", () => {
    const a = new LUTParams();
    a.init (640, 480);
    const b = new LUTParams();
    b.init (640, 480);
    assert.isTrue (a.equals(b), "same 2d LUTParams should compare as equal");
    assert.isTrue (b.equals(a), "2d LUTParams equality should be symetric");

    b.init (1024, 1024);
    assert.isFalse (a.equals(b), "different 2d LUTParams should compare as !equal");

    a.init (128, 1);
    b.init (128, 1);
    assert.isTrue (a.equals(b), "same 1d LUTParams should compare as equal");
    assert.isTrue (b.equals(a), "1d LUTParams equality should be symetric");

    b.init (512, 1);
    assert.isFalse (a.equals(b), "different 1d LUTParams should compare as !equal");
  });
});

describe("FeatureDimension getFeatureName", () => {
  it("should return correct string name for corresponding FeatureDimension type", () => {
    assert.isTrue(getFeatureName(FeatureDimension.kEmpty) === "Empty", "Empty");
    assert.isTrue(getFeatureName(FeatureDimension.kSingleUniform) === "Single/Uniform", "Single/Uniform");
    assert.isTrue(getFeatureName(FeatureDimension.kSingleNonUniform) === "Single/Non-uniform", "Single/Non-uniform");
    assert.isTrue(getFeatureName(FeatureDimension.kMultiple) === "Multiple", "Multiple");
    assert.isUndefined(getFeatureName(FeatureDimension.kCOUNT), "COUNT shouldn't return a feature name");
  });
});

describe("FeatureDimensions", () => {
  it("should create and store FeatureDimensions", () => {
    let a = new FeatureDimensions();
    let b = new FeatureDimensions();
    assert.isTrue (a.equals(b), "default constructed FeatureDimensions should be equal");
    assert.isTrue (b.equals(a), "default constructed FeatureDimensions equality should be symetric");
    assert.isFalse (a.lessThan(b), "equal FeatureDimensions should not be lessThan");

    b = new FeatureDimensions(FeatureDimension.kEmpty);
    assert.isTrue (a.equals(b), "default constructed FeatureDimensions should be equal to Empty FeatureDimensions");
    b = FeatureDimensions.empty();
    assert.isTrue (a.equals(b), "FeatureDimensions.empty() should be equal to an Empty FeatureDimensions");
    assert.isTrue (0 === b.getValue(), "value of Empty FeatureDimensions should be 0");
    assert.isTrue (b.isEmpty(), "isEmpty on Empty FestureDimension should be true");
    assert.isFalse (b.isSingle(), "isSingle on Empty FestureDimension should be false");
    assert.isFalse (b.isMultiple(), "isMultiple on Empty FestureDimension should be false");
    assert.isFalse (b.isUniform(), "isUniform on Empty FestureDimension should be false");
    assert.isFalse (b.isNonUniform(), "isNonUniform on Empty FestureDimension should be false");
    assert.isTrue (b.getFeatureIndexType() === FeatureIndexType.kEmpty, "FeatureIndexType of Empty FeatureDimensions should be Empty");

    b = new FeatureDimensions(FeatureDimension.kSingleUniform);
    assert.isFalse (a.equals(b), "SingleUniform FeatureDimensions should not be equal to Empty FeatureDimensions");
    assert.isTrue (a.lessThan(b), "Empty FestureDimensions should be less than SingleUniform FeatureDimensions");
    a = FeatureDimensions.singleUniform();
    assert.isTrue (a.equals(b), "FeatureDimensions.singleUniform() should be equal to a SingleUniform FeatureDimensions");
    assert.isTrue (1 === b.getValue(), "value of SingleUniform FeatureDimensions should be 1");
    assert.isFalse (b.isEmpty(), "isEmpty on SingleUniform FestureDimension should be false");
    assert.isTrue (b.isSingle(), "isSingle on SingleUniform FestureDimension should be true");
    assert.isFalse (b.isMultiple(), "isMultiple on SingleUniform FestureDimension should be false");
    assert.isTrue (b.isUniform(), "isUniform on SingleUniform FestureDimension should be true");
    assert.isFalse (b.isNonUniform(), "isNonUniform on SingleUniform FestureDimension should be false");
    assert.isTrue (b.getFeatureIndexType() === FeatureIndexType.kUniform, "FeatureIndexType of SingleUniform FeatureDimensions should be Uniform");

    b = new FeatureDimensions(FeatureDimension.kSingleNonUniform);
    assert.isFalse (a.equals(b), "SingleNonUniform FeatureDimensions should not be equal to SingleNonUniform FeatureDimensions");
    assert.isTrue (a.lessThan(b), "SingleUniform FestureDimensions should be less than SingleNonUniform FeatureDimensions");
    a = FeatureDimensions.singleNonUniform();
    assert.isTrue (a.equals(b), "FeatureDimensions.singleNonUniform() should be equal to a SingleNonUniform FeatureDimensions");
    assert.isTrue (2 === b.getValue(), "value of SingleNonUniform FeatureDimensions should be 2");
    assert.isFalse (b.isEmpty(), "isEmpty on SingleNonUniform FestureDimension should be false");
    assert.isTrue (b.isSingle(), "isSingle on SingleNonUniform FestureDimension should be true");
    assert.isFalse (b.isMultiple(), "isMultiple on SingleNonUniform FestureDimension should be false");
    assert.isFalse (b.isUniform(), "isUniform on SingleNonUniform FestureDimension should be false");
    assert.isTrue (b.isNonUniform(), "isNonUniform on SingleNonUniform FestureDimension should be true");
    assert.isTrue (b.getFeatureIndexType() === FeatureIndexType.kUniform, "FeatureIndexType of SingleNonUniform FeatureDimensions should be Uniform");

    b = new FeatureDimensions(FeatureDimension.kMultiple);
    assert.isFalse (a.equals(b), "SingleNonUniform FeatureDimensions should not be equal to SingleNonUniform FeatureDimensions");
    assert.isTrue (a.lessThan(b), "SingleNonUniform FestureDimensions should be less than Multiple FeatureDimensions");
    a = FeatureDimensions.multiple();
    assert.isTrue (a.equals(b), "FeatureDimensions.multiple() should be equal to a Multiple FeatureDimensions");
    assert.isTrue (3 === b.getValue(), "value of Multiple FeatureDimensions should be 3");
    assert.isFalse (b.isEmpty(), "isEmpty on Multiple FestureDimension should be false");
    assert.isFalse (b.isSingle(), "isSingle on Multiple FestureDimension should be false");
    assert.isTrue (b.isMultiple(), "isMultiple on Multiple FestureDimension should be true");
    assert.isFalse (b.isUniform(), "isUniform on Multiple FestureDimension should be false");
    assert.isTrue (b.isNonUniform(), "isNonUniform on Multiple FestureDimension should be true");
    assert.isTrue (b.getFeatureIndexType() === FeatureIndexType.kNonUniform, "FeatureIndexType of Multiple FeatureDimensions should be NonUniform");
  });

  it("should be able to iterate through FeatureDimensions", () => {
    let i: number = 0;
    for (const fdIt = FeatureDimensionsIterator.begin(); !fdIt.equals(FeatureDimensionsIterator.end()); fdIt.next()) {
      const fd: FeatureDimensions = fdIt.get();
      assert.isTrue (fd.getValue() === i, i + "th iteration of FeatureDimensions should have value of " + getFeatureName(i as FeatureDimension));
      i = i + 1;
    }
    assert.isTrue (i === FeatureDimension.kCOUNT as number, "did not iterate through FeatureDimensions properly last iteration was " + i);
  });
});
