/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import {
  Feature, FeatureTable, ModelFeature, MultiModelPackedFeatureTable, PackedFeature, PackedFeatureModelTable, PackedFeatureTable,
} from "../FeatureTable";
import { GeometryClass } from "../GeometryParams";

function makeFeatureTable(numFeatures: number): FeatureTable {
  const table = new FeatureTable(numFeatures);
  for (let i = 1; i <= numFeatures; i++)
    table.insertWithIndex(new Feature(`0x${i.toString(16)}`), i - 1);

  return table;
}

function makePackedFeatureTable(numFeatures: number): PackedFeatureTable {
  return PackedFeatureTable.pack(makeFeatureTable(numFeatures));
}

describe("PackedFeatureTable", () => {
  describe("animation node Ids", () => {
    it("can be populated after construction", () => {
      const table = makePackedFeatureTable(3);
      expect(table.animationNodeIds).to.be.undefined;
      table.populateAnimationNodeIds((f) => (2 - f.index) * 4 + 1, 9);

      const ids = table.animationNodeIds!;
      expect(ids).not.to.be.undefined;
      expect(ids.length).to.equal(3);

      expect(table.getAnimationNodeId(0)).to.equal(9);
      expect(table.getAnimationNodeId(1)).to.equal(5);
      expect(table.getAnimationNodeId(2)).to.equal(1);
      expect(table.getAnimationNodeId(123)).to.equal(0);
    });

    it("minimizes allocation", () => {
      function expectType(maxNodeId: number, type: typeof Uint8Array | typeof Uint16Array | typeof Uint32Array) {
        const table = makePackedFeatureTable(1);
        const nodeId = Math.ceil(maxNodeId / 2);
        table.populateAnimationNodeIds(() => nodeId, maxNodeId);
        expect(table.animationNodeIds).instanceof(type);
        expect(table.animationNodeIds!.length).to.equal(1);
        expect(table.animationNodeIds![0]).to.equal(nodeId);
      }

      expectType(1, Uint8Array);
      expectType(0xff, Uint8Array);
      expectType(0x100, Uint16Array);
      expectType(0xffff, Uint16Array);
      expectType(0x10000, Uint32Array);
    });

    it("discards Ids if all are zero", () => {
      const table = makePackedFeatureTable(3);
      table.populateAnimationNodeIds(() => 0, 1);
      expect(table.animationNodeIds).to.be.undefined;
    });
  });
});

// models is [modelId, indexOfLastFeatureInModel] where modelId and indexOfLastFeatureInModel are both strictly increasing.
function makeModelTable(models: Array<[string, number]>): PackedFeatureModelTable {
  const data = new Uint32Array(3 * models.length);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const pair = Id64.getUint32Pair(model[0]);
    const offset = 3 * i;
    data[offset + 0] = model[1];
    data[offset + 1] = pair.lower;
    data[offset + 2] = pair.upper;
  }

  return new PackedFeatureModelTable(data);
}

describe("PackedFeatureModelTable", () => {
  it("computes model Id from feature index", () => {
    const table = makeModelTable([
      [Id64.invalid, 2],
      ["0x2", 3],
      ["0x321", 6],
      ["0x20000000123", 8],
      ["0x555555555555", 9],
      ["0xffffffffffff", 13],
    ]);

    const modelByFeatureIndex = [
      Id64.invalid, Id64.invalid, Id64.invalid,
      "0x2",
      "0x321", "0x321", "0x321",
      "0x20000000123", "0x20000000123",
      "0x555555555555",
      "0xffffffffffff", "0xffffffffffff", "0xffffffffffff", "0xffffffffffff",
    ];

    for (let i = 0; i < modelByFeatureIndex.length; i++) {
      const pair = table.getModelIdPair(i);
      const id = Id64.fromUint32Pair(pair.lower, pair.upper);
      expect(id).to.equal(modelByFeatureIndex[i]);
    }
  });

  it("returns invalid model Id if feature index greater than the index of the last feature in the last model", () => {
    const table = makeModelTable([
      ["0x2", 3],
      ["0x321", 6],
      ["0x20000000123", 8],
      ["0x555555555555", 9],
      ["0xffffffffffff", 13],
    ]);

    expect(Id64.fromUint32PairObject(table.getModelIdPair(13))).to.equal("0xffffffffffff");
    for (let i = 14; i < 20; i++) {
      const pair = table.getModelIdPair(i);
      expect(pair.lower).to.equal(0);
      expect(pair.upper).to.equal(0);
    }
  });
});

describe("MultiModelPackedFeatureTable", () => {
  function makeTable(numFeatures: number, models: Array<[string, number]>): MultiModelPackedFeatureTable {
    const featureTable = makeFeatureTable(numFeatures);
    const modelTable = makeModelTable(models);
    return new MultiModelPackedFeatureTable(PackedFeatureTable.pack(featureTable), modelTable);
  }

  it("accesses features by index", () => {
    const table = makeTable(6, [
      ["0xa", 0],
      ["0xb", 3],
      ["0xc", 5],
    ]);

    const expectedFeatures = [
      [ "0x1", "0xa" ],
      [ "0x2", "0xb" ],
      [ "0x3", "0xb" ],
      [ "0x4", "0xb" ],
      [ "0x5", "0xc" ],
      [ "0x6", "0xc" ],
    ];

    for (let i = 0; i < expectedFeatures.length; i++) {
      const feature = table.getFeature(i, ModelFeature.create());
      const expected = expectedFeatures[i];
      expect(feature.elementId).to.equal(expected[0]);
      expect(feature.modelId).to.equal(expected[1]);
      expect(feature.subCategoryId).to.equal("0");
      expect(feature.geometryClass).to.equal(GeometryClass.Primary);
    }
  });

  it("iterates over features", () => {
    const table = makeTable(6, [
      ["0xa", 0],
      ["0xb", 3],
      ["0xc", 5],
    ]);

    const expectedFeatures = [
      [ "0x1", "0xa" ],
      [ "0x2", "0xb" ],
      [ "0x3", "0xb" ],
      [ "0x4", "0xb" ],
      [ "0x5", "0xc" ],
      [ "0x6", "0xc" ],
    ];

    let i = 0;
    for (const packed of table.iterable(PackedFeature.createWithIndex())) {
      const expected = expectedFeatures[i++];
      const feature = ModelFeature.unpack(packed, ModelFeature.create());
      expect(feature.elementId).to.equal(expected[0]);
      expect(feature.modelId).to.equal(expected[1]);
      expect(feature.subCategoryId).to.equal("0");
      expect(feature.geometryClass).to.equal(GeometryClass.Primary);
    }
  });

  it("produces invalid model Id during iteration if feature index is greater than maximum", () => {
    const table = makeTable(4, [ ["0xa", 1] ]);
    const expectedFeatures = [
      [ "0x1", "0xa" ],
      [ "0x2", "0xa" ],
      [ "0x3", "0" ],
      [ "0x4", "0" ],
    ];

    let i = 0;
    for (const packed of table.iterable(PackedFeature.createWithIndex())) {
      const expected = expectedFeatures[i++];
      const feature = ModelFeature.unpack(packed, ModelFeature.create());
      expect(feature.elementId).to.equal(expected[0]);
      expect(feature.modelId).to.equal(expected[1]);
      expect(feature.subCategoryId).to.equal("0");
      expect(feature.geometryClass).to.equal(GeometryClass.Primary);
    }
  });
});
