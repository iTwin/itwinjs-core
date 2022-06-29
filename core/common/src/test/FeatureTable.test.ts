/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Feature, FeatureTable, PackedFeatureTable } from "../FeatureTable";

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
      table.populateAnimationNodeIds((_, i) => (2 - i) * 4 + 1, 9);

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
