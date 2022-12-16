/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { QPoint3dBuffer } from "@itwin/core-common";
import { RealityMeshParamsBuilder } from "../../render/RealityMeshParams";

describe("RealityMeshParamsBuilder", () => {
  it("supports 8-, 16-, and 32-bit indices", () => {
    function test(numIndices: number, expectedType: typeof Uint8Array | typeof Uint16Array | typeof Uint32Array): void {
      const lastIndex = numIndices - 1;
      const builder = new RealityMeshParamsBuilder({ positionRange: new Range3d(-1, -2, -3, 1, 2, 3) });
      for (let i = 0; i < lastIndex; i++) {
        builder.addUnquantizedVertex({ x: -1, y: -2, z: -3 }, { x: 0, y: 0 });
        builder.addIndices([i]);
      }

      builder.addUnquantizedVertex({ x: 1, y: 2, z: 3 }, { x: 1, y: 1 });
      builder.addIndices([lastIndex]);

      const params = builder.finish();
      expect(params.indices).instanceof(expectedType);
      expect(params.indices.length).to.equal(numIndices);
      expect(params.positions.points.length).to.equal(numIndices * 3);

      const pt = new Point3d();
      for (let i = 0; i < lastIndex; i++) {
        expect(params.indices[i]).to.equal(i);
        QPoint3dBuffer.unquantizePoint(params.positions, i, pt);
        expect(pt.x).to.equal(-1);
        expect(pt.y).to.equal(-2);
        expect(pt.z).to.equal(-3);
      }

      expect(params.indices[lastIndex]).to.equal(lastIndex);
      QPoint3dBuffer.unquantizePoint(params.positions, lastIndex, pt);
      expect(pt.x).to.equal(1);
      expect(pt.y).to.equal(2);
      expect(pt.z).to.equal(3);
    }

    test(3, Uint8Array);
    test(255, Uint8Array);
    test(258, Uint16Array);
    test(65535, Uint16Array);
    test(65538, Uint32Array);
  });

  it("defines initial index buffer type based on number of initial vertices", () => {
    function expectIndices(initialVertexCapacity: number, expectedType: typeof Uint8Array | typeof Uint16Array | typeof Uint32Array): void {
      const builder = new RealityMeshParamsBuilder({
        positionRange: Range3d.createNull(),
        initialVertexCapacity,
      });

      expect(builder.finish().indices).instanceof(expectedType);
    }

    expectIndices(0, Uint8Array);
    expectIndices(255, Uint8Array);
    expectIndices(256, Uint16Array);
    expectIndices(65535, Uint16Array);
    expectIndices(65536, Uint32Array);
    expectIndices(12345678, Uint32Array);
  });
});
