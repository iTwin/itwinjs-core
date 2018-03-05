/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { Feature, FeatureTable, GeometryClass } from "@bentley/imodeljs-common";

describe("Feature", () => {
  it("constructor works as expected", () => {
    const a = new Feature(new Id64(), new Id64());
    assert.isTrue(a.elementId.value === "0", "elementId is correct - 1");
    assert.isTrue(a.subCategoryId.value === "0", "subCategoryId is correct - 1");
    assert.isTrue(a.geometryClass === GeometryClass.Primary, "geometryClass is correct - 1");

    const b = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    assert.isTrue(b.elementId.value === "0x800", "elementId is correct - 2");
    assert.isTrue(b.subCategoryId.value === "0x800", "subCategoryId is correct - 2");
    assert.isTrue(b.geometryClass === GeometryClass.Dimension, "geometryClass is correct - 2");
  });
  it("isDefined/isUndefined works as expected", () => {
    const a = new Feature(new Id64(), new Id64());
    const b = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    const c = new Feature(new Id64(), new Id64(), GeometryClass.Dimension);
    assert.isTrue(a.isDefined === false, "invalid elementId/subcategoryId result in isDefined returning false if GeometryClass is Primary");
    assert.isTrue(b.isDefined === true, "valid elementId/subcategoryId result in isDefined returning false");
    assert.isTrue(c.isDefined === true, "invalid elementId/subcategoryId but geometryclass that isn't Primary returns true for isDefined");
  });
  it("equals works as expected", () => {
    const a = new Feature(new Id64(), new Id64());
    const b = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    const c = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    assert.isFalse(a.equals(b), "a - b");
    assert.isTrue(b.equals(c), "b - c");
  });
});

describe("FeatureTable", () => {
  it("constructor works as expected", () => {
    const a = new FeatureTable(10);
    assert.isTrue(a.maxFeatures === 10, "maxFeatures is correct");
    assert.isTrue(a.modelId.value === "0", "modelId is correct");
    assert.isTrue(a.map.size === 0, "map is correct");

    const b = new FeatureTable(10, new Id64("0x800"));
    assert.isTrue(b.maxFeatures === 10, "maxFeatures is correct - 2");
    assert.isTrue(b.modelId.value === "0x800", "modelId is correct - 2");
    assert.isTrue(b.map.size === 0, "map is correct - 2");

    const map: Map<number, Feature> = new Map<number, Feature>();
    map.set(1, new Feature(new Id64(), new Id64()));
    const c = new FeatureTable(10, new Id64("0x800"), map);
    assert.isTrue(c.maxFeatures === 10, "maxFeatures is correct - 3");
    assert.isTrue(c.modelId.value === "0x800", "modelId is correct - 3");
    assert.isTrue(c.map.size === 1, "map is correct - 3");
  });
  it("isFull works as expected", () => {
    const map: Map<number, Feature> = new Map<number, Feature>();
    map.set(1, new Feature(new Id64(), new Id64()));
    map.set(2, new Feature(new Id64(), new Id64()));
    const c = new FeatureTable(1, new Id64("0x800"), map);
    assert.throws(() => { c.isFull; });

    const map2: Map<number, Feature> = new Map<number, Feature>();
    map2.set(1, new Feature(new Id64(), new Id64()));
    const d = new FeatureTable(10, new Id64("0x800"), map2);
    assert.isFalse(d.isFull, "isFull is correct");
  });
  it("isUniform works as expected", () => {
    const map: Map<number, Feature> = new Map<number, Feature>();
    map.set(1, new Feature(new Id64(), new Id64()));
    const c = new FeatureTable(10, new Id64("0x800"), map);
    assert.isTrue(c.isUniform, "isUniform is correct");
  });
  it("anyDefined works as expected", () => {
    const map: Map<number, Feature> = new Map<number, Feature>();
    map.set(1, new Feature(new Id64("0x800"), new Id64("0x800")));
    const c = new FeatureTable(10, new Id64("0x800"), map);
    assert.isTrue(c.anyDefined, "anyDefined is correct - 1");

    const map2: Map<number, Feature> = new Map<number, Feature>();
    map2.set(1, new Feature(new Id64(), new Id64()));
    const d = new FeatureTable(10, new Id64("0x800"), map2);
    assert.isFalse(d.anyDefined, "anyDefined is correct - 2");

    const map3: Map<number, Feature> = new Map<number, Feature>();
    map3.set(1, new Feature(new Id64(), new Id64()));
    map3.set(2, new Feature(new Id64(), new Id64()));
    const e = new FeatureTable(10, new Id64("0x800"), map3);
    assert.isTrue(e.anyDefined, "anyDefined is correct - 3");
  });
  it("getIndex works as expected", () => {
    const map: Map<number, Feature> = new Map<number, Feature>();
    const feature = new Feature(new Id64(), new Id64());
    map.set(2, feature);
    const c = new FeatureTable(10, new Id64("0x800"), map);
    assert.isTrue(c.getIndex(feature) === 2, "getIndex is correct - 1");

    const map2: Map<number, Feature> = new Map<number, Feature>();
    const feature2 = new Feature(new Id64(), new Id64());
    const d = new FeatureTable(10, new Id64("0x800"), map2);
    assert.isTrue(d.getIndex(feature2) === 0, "getIndex is correct - 2");
  });
  it("findIndex works as expected", () => {
    const map: Map<number, Feature> = new Map<number, Feature>();
    const feature = new Feature(new Id64(), new Id64());
    map.set(1, feature);
    const c = new FeatureTable(10, new Id64("0x800"), map);
    assert.isTrue(c.findIndex(feature) === 1, "findIndex is correct - 1");
    assert.isTrue(c.findIndex(new Feature(new Id64("0x800"), new Id64("0x800"))) === -1, "findIndex is correct - 2");
  });
  it("findFeature works as expected", () => {
    const map: Map<number, Feature> = new Map<number, Feature>();
    const feature = new Feature(new Id64(), new Id64());
    map.set(1, feature);
    const c = new FeatureTable(10, new Id64("0x800"), map);
    assert.isTrue(c.findFeature(1)!.equals(feature), "findFeature is correct - 1");
    assert.isUndefined(c.findFeature(10), "findFeature is correct - 2");
  });
  it("clear works as expected", () => {
    const map3: Map<number, Feature> = new Map<number, Feature>();
    map3.set(1, new Feature(new Id64(), new Id64()));
    map3.set(2, new Feature(new Id64(), new Id64()));
    const c = new FeatureTable(10, new Id64("0x800"), map3);
    assert.isTrue(c.size === 2, "clear is correct - 1");
    c.clear();
    assert.isTrue(c.size === 0, "clear is correct - 2");
  });
  it("fromFeatureTable works as expected", () => {
    const map3: Map<number, Feature> = new Map<number, Feature>();
    map3.set(1, new Feature(new Id64(), new Id64()));
    map3.set(2, new Feature(new Id64(), new Id64()));
    const c = new FeatureTable(10, new Id64("0x800"), map3);
    const a = FeatureTable.fromFeatureTable(c);
    assert.isTrue(a.maxFeatures === c.maxFeatures, "fromFeatureTable maxFeatures is correct");
    assert.isTrue(a.modelId.value === c.modelId.value, "fromFeatureTable modelId is correct");
    assert.isTrue(a.map.size === c.map.size, "fromFeatureTable map is correct");
  });
});
