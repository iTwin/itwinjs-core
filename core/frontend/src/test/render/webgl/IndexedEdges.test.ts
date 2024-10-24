/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ByteStream } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, MeshEdge, OctEncodedNormal, OctEncodedNormalPair, QPoint3dList } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { MeshArgsEdges } from "../../../common/internal/render/MeshPrimitives";
import { VertexIndices } from "../../../common/internal/render/VertexIndices";
import { createEdgeParams, EdgeParams, EdgeTable } from "../../../common/internal/render/EdgeParams";
import { MeshArgs } from "../../../render/MeshArgs";

function makeNormalPair(n0: number, n1: number): OctEncodedNormalPair {
  return new OctEncodedNormalPair(new OctEncodedNormal(n0), new OctEncodedNormal(n1));
}

/*  1   3
 *   ____
 *  /\  /\
 * /__\/__\
 * 0   2   4
 */
function createMeshArgs(opts?: { is2d?: boolean }): MeshArgs {
  const edges = new MeshArgsEdges();
  edges.edges.edges = [new MeshEdge(0, 1), new MeshEdge(1, 3), new MeshEdge(3, 4)];
  edges.silhouettes.edges = [new MeshEdge(1, 2), new MeshEdge(2, 3)];
  edges.silhouettes.normals = [makeNormalPair(0, 0xffff), makeNormalPair(0x1234, 0xfedc)];
  edges.polylines.lines = [[0, 2, 4], [2, 4, 3, 1], [1, 0]];

  return {
    points: QPoint3dList.fromPoints([new Point3d(0, 0, 0), new Point3d(1, 1, 0), new Point3d(2, 0, 0), new Point3d(3, 1, 0), new Point3d(4, 0, 0)]),
    vertIndices: [0, 1, 2, 2, 1, 3, 2, 3, 4],
    edges,
    fillFlags: FillFlags.None,
    is2d: true === opts?.is2d,
    colors: new ColorIndex(),
    features: new FeatureIndex(),
  };
}

function expectIndices(indices: VertexIndices, expected: number[]): void {
  expect(indices.data.length).toEqual(expected.length * 3);
  const stream = ByteStream.fromUint8Array(indices.data);
  for (const expectedIndex of expected)
    expect(stream.readUint24()).toEqual(expectedIndex);
}

function makeEdgeParams(meshArgs: MeshArgs, maxWidth?: number): EdgeParams | undefined {
  return createEdgeParams({
    meshArgs,
    maxWidth: maxWidth ?? IModelApp.renderSystem.maxTextureSize,
    createIndexed: "non-indexed" !== IModelApp.tileAdmin.edgeOptions.type,
  });
}

// expectedSegments = 2 indices per segment edge.
// expectedSilhouettes = 2 indices and 2 oct-encoded normals per silhouette edge.
function expectEdgeTable(edges: EdgeTable, expectedSegments: number[], expectedSilhouettes: number[], expectedPaddingBytes = 0): void {
  expect(expectedSegments.length % 2).toEqual(0);
  expect(edges.numSegments).toEqual(expectedSegments.length / 2);
  expect(edges.silhouettePadding).toEqual(expectedPaddingBytes);

  const stream = ByteStream.fromUint8Array(edges.data);
  const actualSegments: number[] = [];
  for (let i = 0; i < expectedSegments.length; i += 2) {
    actualSegments.push(stream.readUint24());
    actualSegments.push(stream.readUint24());
  }

  expect(expectedSilhouettes.length % 4).toEqual(0);
  const actualSilhouettes: number[] = [];

  for (let i = 0; i < expectedPaddingBytes; i++)
    expect(stream.readUint8()).toEqual(0);

  for (let i = 0; i < expectedSilhouettes.length; i += 4) {
    actualSilhouettes.push(stream.readUint24());
    actualSilhouettes.push(stream.readUint24());
    actualSilhouettes.push(stream.readUint16());
    actualSilhouettes.push(stream.readUint16());
  }

  expect(actualSegments).toEqual(expectedSegments);
  expect(actualSilhouettes).toEqual(expectedSilhouettes);
}

describe("IndexedEdgeParams", () => {
  describe("when disabled", () => {
    afterEach(async () => {
      await IModelApp.shutdown();
    });

    it("are not produced if explicitly disabled by TileAdmin", async () => {
      await IModelApp.startup({
        tileAdmin: { enableIndexedEdges: false },
        localization: new EmptyLocalization(),
      });
      expect(IModelApp.tileAdmin.edgeOptions.type).toEqual("non-indexed");

      const args = createMeshArgs();
      const edges = makeEdgeParams(args)!;
      expect(edges).toBeDefined();
      expect(edges.segments).toBeDefined();
      expect(edges.silhouettes).toBeDefined();
      expect(edges.polylines).toBeUndefined(); // converted to segments
      expect(edges.indexed).toBeUndefined();
    });
  });

  describe("when enabled", () => {
    beforeAll(async () => {
      await IModelApp.startup({ localization: new EmptyLocalization() });
      expect(IModelApp.tileAdmin.edgeOptions.type).toEqual("compact");
    });

    afterAll(async () => {
      await IModelApp.shutdown();
    });

    it("are not produced if MeshArgs supplies no edges", () => {
      const args = createMeshArgs();
      args.edges?.clear();
      expect(makeEdgeParams(args)).toBeUndefined();
    });

    it("are not produced for polylines in 2d", () => {
      const args = createMeshArgs({ is2d: true });

      const edges = makeEdgeParams(args)!;
      expect(edges).toBeDefined();
      expect(edges.polylines).toBeDefined();
      expect(edges.indexed).toBeDefined();
      expect(edges.silhouettes).toBeUndefined();
      expect(edges.segments).toBeUndefined();
    });

    it("are not produced for polylines if width > 3", () => {
      const args = createMeshArgs();
      expect(args.edges).toBeDefined();
      args.edges!.width = 4;

      const edges = makeEdgeParams(args)!;
      expect(edges).toBeDefined();
      expect(edges.polylines).toBeDefined();
      expect(edges.indexed).toBeDefined();
      expect(edges.silhouettes).toBeUndefined();
      expect(edges.segments).toBeUndefined();
    });

    it("are created from MeshArgs", () => {
      const args = createMeshArgs();
      const edges = makeEdgeParams(args)!;
      expect(edges).toBeDefined();
      expect(edges.indexed).toBeDefined();
      expect(edges.polylines).toBeUndefined();
      expect(edges.silhouettes).toBeUndefined();
      expect(edges.segments).toBeUndefined();

      expectIndices(edges.indexed!.indices, [
        0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1,
        2, 2, 2, 2, 2, 2,
        3, 3, 3, 3, 3, 3,
        4, 4, 4, 4, 4, 4,
        5, 5, 5, 5, 5, 5,
        6, 6, 6, 6, 6, 6,
        7, 7, 7, 7, 7, 7,
        8, 8, 8, 8, 8, 8,
        9, 9, 9, 9, 9, 9,
        10, 10, 10, 10, 10, 10,
      ]);
      expectEdgeTable(edges.indexed!.edges, [
        // visible
        0, 1, 1, 3, 3, 4,
        // polylines
        0, 2, 2, 4, 2, 4, 3, 4, 1, 3, 0, 1,
      ], [
        // silhouettes
        1, 2, 0, 0xffff,
        2, 3, 0x1234, 0xfedc,
      ]);
    });

    it("inserts padding between segments and silhouettes when required", () => {
      const args = createMeshArgs();
      const edges = makeEdgeParams(args, 15)!;
      expect(edges).not.to.be.undefined;
      expect(edges.indexed).not.to.be.undefined;
      expectIndices(edges.indexed!.indices, [
        0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1,
        2, 2, 2, 2, 2, 2,
        3, 3, 3, 3, 3, 3,
        4, 4, 4, 4, 4, 4,
        5, 5, 5, 5, 5, 5,
        6, 6, 6, 6, 6, 6,
        7, 7, 7, 7, 7, 7,
        8, 8, 8, 8, 8, 8,
        9, 9, 9, 9, 9, 9,
        10, 10, 10, 10, 10, 10,
      ]);
      expectEdgeTable(edges.indexed!.edges, [
        // visible
        0, 1, 1, 3, 3, 4,
        // polylines
        0, 2, 2, 4, 2, 4, 3, 4, 1, 3, 0, 1,
      ], [
        // silhouettes
        1, 2, 0, 0xffff,
        2, 3, 0x1234, 0xfedc,
      ],
      6);

      function makeEdgeTable(nSegs: number, nSils: number): EdgeTable {
        const meshargs = createMeshArgs();
        const edgs = meshargs.edges!;
        expect(edgs).toBeDefined();
        edgs.polylines.clear();
        edgs.silhouettes.clear();

        edgs.edges.edges = [];
        for (let i = 0; i < nSegs; i++)
          edgs.edges.edges.push(new MeshEdge(0, 1));

        edgs.silhouettes.edges = [];
        edgs.silhouettes.normals = [];
        for (let i = 0; i < nSils; i++) {
          edgs.silhouettes.edges.push(new MeshEdge(2 + i, 3));
          edgs.silhouettes.normals.push(makeNormalPair(4, 5));
        }

        const edgeParams = makeEdgeParams(meshargs, 15)!;
        expect(edgeParams).toBeDefined();
        expect(edgeParams.indexed).toBeDefined();
        return edgeParams.indexed!.edges;
      }

      // Num segments, num silhouettes, expected padding, expected width, expected height
      const testCases = [
        // bad
        [330, 101, 0, 30, 25],
        [64, 32, 6, 15, 12],
        [126, 63, 4, 30, 12],
        [288, 80, 2, 30, 22],
        [102, 51, 8, 30, 10],
        // good
        [80, 40, 0, 15, 15],
        [100, 50, 0, 30, 10],
        [258, 65, 2, 30, 19],
        [74, 37, 6, 15, 14],
      ];

      for (const test of testCases) {
        const table = makeEdgeTable(test[0], test[1]);
        // console.log(JSON.stringify({ index: curIndex++, segs: test[0], sils: test[1], pad: test[2] }));
        expect(table.numSegments).toEqual(test[0]);
        expect(table.silhouettePadding).toEqual(test[2]);
        expect(table.width).toEqual(test[3]);
        expect(table.height).toEqual(test[4]);

        const bytes = Array.from(table.data);
        for (let i = table.numSegments; i < test[1]; i++) {
          const texelIndex = table.numSegments * 1.5 + test[2] * 0.25 + (i - table.numSegments) * 2.5;
          const byteIndex = texelIndex * 4;
          expect(byteIndex).toEqual(Math.floor(byteIndex));
          expect(bytes[byteIndex]).toEqual(2 + i);

          let isEven = 0 === (i & 1);
          if (0 !== test[2] % 4)
            isEven = !isEven;

          const byteIndex2 = Math.floor(texelIndex) * 4 + (isEven ? 0 : 2);
          expect(byteIndex2).toEqual(byteIndex);
        }

        // for (let i = 0; i < table.height * byteWidth; i += byteWidth)
        //   console.log(bytes.slice(i, i + byteWidth).join(" "));
      }
    });
  });
});
