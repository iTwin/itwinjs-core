/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { FeatureIndex, FeatureIndexType } from "@bentley/imodeljs-common";
import { FeaturesInfo } from "@bentley/imodeljs-frontend/lib/rendering";

describe("FeaturesInfo", () => {
  it("should create, store and retrieve from FeaturesInfo", () => {
    /** Testing the static create function */
    const fIndex = new FeatureIndex();
    let fi = FeaturesInfo.create(fIndex);
    assert.isTrue(undefined === fi, "testing create() - newly created FeaturesInfo should be undefined - test 1");
    fIndex.type = FeatureIndexType.Empty;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(undefined === fi, "testing create() - newly created FeaturesInfo should be undefined - test 2");
    fIndex.type = FeatureIndexType.Uniform;
    fIndex.featureID = 55;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(FeatureIndexType.Uniform === fi!.type, "testing create() - newly created FeaturesInfo should be of type Uniform - test 1");
    assert.isTrue(55 === fi!.uniform, "testing create() - newly created FeaturesInfo should have a uniform value of 55 - test 2");
    fIndex.type = FeatureIndexType.NonUniform;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(FeatureIndexType.NonUniform === fi!.type, "testing create() - newly created FeaturesInfo should be of type NonUniform - test 1");
    assert.isTrue(undefined === fi!.uniform, "testing create() - newly created FeaturesInfo should have a uniform value of undefined - test 2");
    const fIndex2 = new FeatureIndex();
    fIndex2.type = FeatureIndexType.NonUniform;
    const fi2 = FeaturesInfo.create(fIndex2);
    assert.isTrue(fi2 === fi, "testing create() - newly created FeaturesInfo should have a reference to the same FeaturesInfo object - test 3");

    /** Testing the static createUniform function */
    fi = FeaturesInfo.createUniform(42);
    assert.isTrue(FeatureIndexType.Uniform === fi!.type, "testing createUniform() - newly created FeaturesInfo should be of type Uniform - test 1");
    assert.isTrue(42 === fi!.uniform, "testing createUniform() - newly created FeaturesInfo should have a uniform value of 42 - test 2");

    /** Testing the get type function */
    fIndex.type = FeatureIndexType.Uniform;
    fIndex.featureID = 55;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(FeatureIndexType.Uniform === fi!.type, "testing get type - newly created FeaturesInfo should be of type Uniform - test 1");
    fIndex.type = FeatureIndexType.NonUniform;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(FeatureIndexType.NonUniform === fi!.type, "testing get type - newly created FeaturesInfo should be of type NonUniform - test 2");

    /** Testing the get isUniform function */
    fIndex.type = FeatureIndexType.Uniform;
    fIndex.featureID = 55;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(fi!.isUniform, "testing get isUniform - new Uniform FeaturesInfo should have isUniform value of true - test 1");
    fIndex.type = FeatureIndexType.NonUniform;
    fi = FeaturesInfo.create(fIndex);
    assert.isFalse(fi!.isUniform, "testing get isUniform - new Uniform FeaturesInfo should have isUniform value of false - test 2");

    /** Testing the get isNonUniform function */
    fIndex.type = FeatureIndexType.Uniform;
    fIndex.featureID = 55;
    fi = FeaturesInfo.create(fIndex);
    assert.isFalse(fi!.isNonUniform, "testing get isNonUniform - new Uniform FeaturesInfo should have isNonUniform value of false - test 1");
    fIndex.type = FeatureIndexType.NonUniform;
    fi = FeaturesInfo.create(fIndex);
    assert.isTrue(fi!.isNonUniform, "testing get isNonUniform - new Uniform FeaturesInfo should have isNonUniform value of true - test 2");
  });
});
