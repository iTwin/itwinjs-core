/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ByteStream } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { MeshEdge, OctEncodedNormal, OctEncodedNormalPair, PolylineData, QPoint3dList } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { MeshArgs } from "../../../render/primitives/mesh/MeshPrimitives";
import { VertexIndices } from "../../../render/primitives/VertexTable";
import { EdgeParams, EdgeTable } from "../../../render/primitives/EdgeParams";

function makeNormalPair(n0: number, n1: number): OctEncodedNormalPair {
  return new OctEncodedNormalPair(new OctEncodedNormal(n0), new OctEncodedNormal(n1));
}

/*  1   3
 *   ____
 *  /\  /\
 * /__\/__\
 * 0   2   4
 */
function createMeshArgs(opts?: {
  is2d?: boolean;
}): MeshArgs {
  const args = new MeshArgs();
  args.points = QPoint3dList.fromPoints([new Point3d(0, 0, 0), new Point3d(1, 1, 0), new Point3d(2, 0, 0), new Point3d(3, 1, 0), new Point3d(4, 0, 0)]);
  args.vertIndices = [0, 1, 2, 2, 1, 3, 2, 3, 4];

  args.edges.edges.edges = [new MeshEdge(0, 1), new MeshEdge(1, 3), new MeshEdge(3, 4)];
  args.edges.silhouettes.edges = [new MeshEdge(1, 2), new MeshEdge(2, 3)];
  args.edges.silhouettes.normals = [makeNormalPair(0, 0xffff), makeNormalPair(0x1234, 0xfedc)];
  args.edges.polylines.lines = [new PolylineData([0, 2, 4]), new PolylineData([2, 4, 3, 1]), new PolylineData([1, 0])];

  args.is2d = true === opts?.is2d;
  return args;
}

function expectIndices(indices: VertexIndices, expected: number[]): void {
  expect(indices.data.length).to.equal(expected.length * 3);
  const stream = new ByteStream(indices.data.buffer);
  for (const expectedIndex of expected)
    expect(stream.nextUint24).to.equal(expectedIndex);
}

// expectedSegments = 2 indices per segment edge.
// expectedSilhouettes = 2 indices and 2 oct-encoded normals per silhouette edge.
function expectEdgeTable(edges: EdgeTable, expectedSegments: number[], expectedSilhouettes: number[], expectedPaddingBytes = 0): void {
  expect(expectedSegments.length % 2).to.equal(0);
  expect(edges.numSegments).to.equal(expectedSegments.length / 2);
  expect(edges.silhouettePadding).to.equal(expectedPaddingBytes);

  const stream = new ByteStream(edges.data.buffer);
  const actualSegments: number[] = [];
  for (let i = 0; i < expectedSegments.length; i += 2) {
    actualSegments.push(stream.nextUint24);
    actualSegments.push(stream.nextUint24);
  }

  expect(expectedSilhouettes.length % 4).to.equal(0);
  const actualSilhouettes: number[] = [];

  for (let i = 0; i < expectedPaddingBytes; i++)
    expect(stream.nextUint8).to.equal(0);

  for (let i = 0; i < expectedSilhouettes.length; i += 4) {
    actualSilhouettes.push(stream.nextUint24);
    actualSilhouettes.push(stream.nextUint24);
    actualSilhouettes.push(stream.nextUint16);
    actualSilhouettes.push(stream.nextUint16);
  }

  expect(actualSegments).to.deep.equal(expectedSegments);
  expect(actualSilhouettes).to.deep.equal(expectedSilhouettes);
}

describe("IndexedEdgeParams", () => {
  describe("when disabled", () => {
    afterEach(async () => {
      await IModelApp.shutdown();
    });

    it("are not produced if unsupported by client device", async () => {
      await IModelApp.startup({ renderSys: { useWebGL2: false } });
      expect(IModelApp.renderSystem.supportsIndexedEdges).to.be.false;
      expect(IModelApp.tileAdmin.enableIndexedEdges).to.be.false;

      const args = createMeshArgs();
      const edges = EdgeParams.fromMeshArgs(args)!;
      expect(edges).not.to.be.undefined;
      expect(edges.segments).not.to.be.undefined;
      expect(edges.silhouettes).not.to.be.undefined;
      expect(edges.polylines).to.be.undefined; // converted to segments
      expect(edges.indexed).to.be.undefined;
    });

    it("are not produced if explicitly disabled by TileAdmin", async () => {
      await IModelApp.startup({ tileAdmin: { enableIndexedEdges: false } });
      expect(IModelApp.renderSystem.supportsIndexedEdges).to.be.true;
      expect(IModelApp.tileAdmin.enableIndexedEdges).to.be.false;

      const args = createMeshArgs();
      const edges = EdgeParams.fromMeshArgs(args)!;
      expect(edges).not.to.be.undefined;
      expect(edges.segments).not.to.be.undefined;
      expect(edges.silhouettes).not.to.be.undefined;
      expect(edges.polylines).to.be.undefined; // converted to segments
      expect(edges.indexed).to.be.undefined;
    });
  });

  describe("when enabled", () => {
    before(async () => {
      await IModelApp.startup();
    });

    after(async () => {
      await IModelApp.shutdown();
    });

    it("are not produced if MeshArgs supplies no edges", () => {
      const args = createMeshArgs();
      args.edges.clear();
      expect(EdgeParams.fromMeshArgs(args)).to.be.undefined;
    });

    it("are not produced for polylines in 2d", () => {
      const args = createMeshArgs({ is2d: true });

      const edges = EdgeParams.fromMeshArgs(args)!;
      expect(edges).not.to.be.undefined;
      expect(edges.polylines).not.to.be.undefined;
      expect(edges.indexed).not.to.be.undefined;
      expect(edges.silhouettes).to.be.undefined;
      expect(edges.segments).to.be.undefined;
    });

    it("are not produced for polylines if width > 3", () => {
      const args = createMeshArgs();
      args.edges.width = 4;

      const edges = EdgeParams.fromMeshArgs(args)!;
      expect(edges).not.to.be.undefined;
      expect(edges.polylines).not.to.be.undefined;
      expect(edges.indexed).not.to.be.undefined;
      expect(edges.silhouettes).to.be.undefined;
      expect(edges.segments).to.be.undefined;
    });

    it("are created from MeshArgs", () => {
      const args = createMeshArgs();
      const edges = EdgeParams.fromMeshArgs(args)!;
      expect(edges).not.to.be.undefined;
      expect(edges.indexed).not.to.be.undefined;
      expect(edges.polylines).to.be.undefined;
      expect(edges.silhouettes).to.be.undefined;
      expect(edges.segments).to.be.undefined;

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
      const edges = EdgeParams.fromMeshArgs(args, 15)!;
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
        meshargs.edges.polylines.clear();
        meshargs.edges.silhouettes.clear();

        meshargs.edges.edges.edges = [];
        for (let i = 0; i < nSegs; i++)
          meshargs.edges.edges.edges.push(new MeshEdge(0, 1));

        meshargs.edges.silhouettes.edges = [];
        meshargs.edges.silhouettes.normals = [];
        for (let i = 0; i < nSils; i++) {
          meshargs.edges.silhouettes.edges.push(new MeshEdge(2 + i, 3));
          meshargs.edges.silhouettes.normals.push(makeNormalPair(4, 5));
        }

        const edgeParams = EdgeParams.fromMeshArgs(meshargs, 15)!;
        expect(edgeParams).not.to.be.undefined;
        expect(edgeParams.indexed).not.to.be.undefined;
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
        expect(table.numSegments).to.equal(test[0]);
        expect(table.silhouettePadding).to.equal(test[2]);
        expect(table.width).to.equal(test[3]);
        expect(table.height).to.equal(test[4]);

        const bytes = Array.from(table.data);
        for (let i = table.numSegments; i < test[1]; i++) {
          const texelIndex = table.numSegments * 1.5 + test[2] * 0.25 + (i - table.numSegments) * 2.5;
          const byteIndex = texelIndex * 4;
          expect(byteIndex).to.equal(Math.floor(byteIndex));
          expect(bytes[byteIndex]).to.equal(2 + i);

          let isEven = 0 === (i & 1);
          if (0 !== test[2] % 4)
            isEven = !isEven;

          const byteIndex2 = Math.floor(texelIndex) * 4 + (isEven ? 0 : 2);
          expect(byteIndex2).to.equal(byteIndex);
        }

        // for (let i = 0; i < table.height * byteWidth; i += byteWidth)
        //   console.log(bytes.slice(i, i + byteWidth).join(" "));
      }
    });
  });
});
