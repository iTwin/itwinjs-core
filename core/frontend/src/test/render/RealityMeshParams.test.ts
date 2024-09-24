/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
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
      expect(params.indices).toBeInstanceOf(expectedType);
      expect(params.indices.length).toEqual(numIndices);
      expect(params.positions.points.length).toEqual(numIndices * 3);

      const pt = new Point3d();
      for (let i = 0; i < lastIndex; i++) {
        expect(params.indices[i]).toEqual(i);
        QPoint3dBuffer.unquantizePoint(params.positions, i, pt);
        expect(pt.x).toEqual(-1);
        expect(pt.y).toEqual(-2);
        expect(pt.z).toEqual(-3);
      }

      expect(params.indices[lastIndex]).toEqual(lastIndex);
      QPoint3dBuffer.unquantizePoint(params.positions, lastIndex, pt);
      expect(pt.x).toEqual(1);
      expect(pt.y).toEqual(2);
      expect(pt.z).toEqual(3);
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

      const uv = { x: 0, y: 0 };
      builder.addQuantizedVertex({ x: 0, y: 0, z: 0 }, uv);
      builder.addQuantizedVertex({ x: 100, y: 0, z: 0 }, uv);
      builder.addQuantizedVertex({ x: 100, y: 200, z: 0 }, uv);
      builder.addIndices([0, 1, 2]);

      expect(builder.finish().indices).toBeInstanceOf(expectedType);
    }

    expectIndices(0, Uint8Array);
    expectIndices(255, Uint8Array);
    expectIndices(256, Uint16Array);
    expectIndices(65535, Uint16Array);
    expectIndices(65536, Uint32Array);
    expectIndices(12345678, Uint32Array);
  });

  it("finish throws if mesh is empty", () => {
    function test(addVerts: boolean, addIndices: boolean): void {
      const builder = new RealityMeshParamsBuilder({ positionRange: Range3d.createNull() });
      if (addVerts) {
        const uv = { x: 0, y: 0 };
        builder.addQuantizedVertex({ x: 0, y: 0, z: 0 }, uv);
        builder.addQuantizedVertex({ x: 100, y: 0, z: 0 }, uv);
        builder.addQuantizedVertex({ x: 100, y: 200, z: 0 }, uv);
      }

      if (addIndices)
        builder.addIndices([0, 1, 2]);

      if (!addVerts || !addIndices)
        expect(() => builder.finish()).toThrow("Logic Error");
      else
        expect(() => builder.finish()).not.toThrow();
    }

    test(true, true);
    test(false, true);
    test(true, false);
    test(false, false);
  });

  it("throws on inconsistent normals", () => {
    function test(wantNormals: boolean, supplyNormals: boolean, expectThrow: boolean): void {
      const builder = new RealityMeshParamsBuilder({
        positionRange: Range3d.createNull(),
        wantNormals,
      });

      const addVertex = () => builder.addQuantizedVertex({ x: 0, y: 0, z: 0 }, { x: 0, y: 0 }, supplyNormals ? 100 : undefined);
      if (expectThrow)
        expect(addVertex).toThrow("Logic Error");
      else
        expect(addVertex).not.toThrow();
    }

    test(false, false, false);
    test(true, false, true);
    test(false, true, true);
    test(true, true, false);
  });
});
