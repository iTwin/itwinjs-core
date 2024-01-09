/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { Point2d, Point3d, Range2d, Range3d } from "@itwin/core-geometry";
import {
  ColorDef, ColorIndex, Feature, FeatureIndex, FeatureTable, FillFlags, LinePixels, OctEncodedNormal, PackedFeatureTable,
  QParams2d, QPoint3d, QPoint3dList, RenderMaterial, RenderTexture,
} from "@itwin/core-common";
import {
  IModelApp,
  MockRender,
} from "../../../core-frontend";
import { EdgeParams, SegmentEdgeParams } from "../../../common/render/primitives/EdgeParams";
import { MeshParams } from "../../../common/render/primitives/MeshParams";
import { PointStringParams } from "../../../common/render/primitives/PointStringParams";
import { TesselatedPolyline } from "../../../common/render/primitives/PolylineParams";
import { VertexTable } from "../../../common/render/primitives/VertexTable";
import { SurfaceType } from "../../../common/render/primitives/SurfaceParams";
import {
  ComputeAnimationNodeId, IndexBuffer, splitMeshParams, splitPointStringParams,
} from "../../../common/render/primitives/VertexTableSplitter";
import { createMeshParams } from "../../../render/primitives/VertexTableBuilder";
import { createPointStringParams } from "../../../render/primitives/PointStringParams";
import { MeshArgs, PolylineArgs } from "../../../render/primitives/mesh/MeshPrimitives";

interface Point {
  x: number; // quantized or unquantized x coordinate - y will be x+1 and z will be x+5.
  color: number; // color index
  feature: number; // feature index
}

function makePackedFeatureTable(...elementIds: string[]): PackedFeatureTable {
  const featureTable = new FeatureTable(100);
  for (const elementId of elementIds)
    featureTable.insert(new Feature(elementId));

  return PackedFeatureTable.pack(featureTable);
}

function makeColorIndex(points: Point[], colors: ColorDef | ColorDef[]): ColorIndex {
  const colorIndex = new ColorIndex();
  if (colors instanceof ColorDef) {
    colorIndex.initUniform(colors);
  } else {
    const tbgr = new Uint32Array(colors.map((x) => x.tbgr));
    colorIndex.initNonUniform(tbgr, points.map((x) => x.color), false);
  }

  return colorIndex;
}

function makeFeatureIndex(points: Point[]): FeatureIndex {
  const featureIds = new Set<number>(points.map((x) => x.feature));
  const featureIndex = new FeatureIndex();
  expect(featureIds.size).least(1);
  switch (featureIds.size) {
    case 1:
      featureIndex.featureID = points[0].feature;
      break;
    default:
      featureIndex.featureIDs = new Uint32Array(points.map((x) => x.feature));
      break;
  }

  return featureIndex;
}

function makePointList(pts: Point[], quantized: boolean): QPoint3dList | (Array<Point3d> & { range: Range3d }) {
  if (quantized) {
    const qpts = new QPoint3dList();
    for (const point of pts)
      qpts.push(QPoint3d.fromScalars(point.x, point.x + 1, point.x + 5));

    return qpts;
  }

  const points = [] as unknown as Array<Point3d> & { range: Range3d };
  points.range = new Range3d();
  for (const pt of pts) {
    const point = new Point3d(pt.x, pt.x + 1, pt.x + 5);
    points.push(point);
    points.range.extend(point);
  }

  return points;
}

function makePointStringParams(pts: Point[], colors: ColorDef | ColorDef[], unquantized: boolean): PointStringParams {
  const colorIndex = makeColorIndex(pts, colors);
  const featureIndex = makeFeatureIndex(pts);

  const points = makePointList(pts, !unquantized);
  const args: PolylineArgs = {
    colors: colorIndex,
    features: featureIndex,
    width: 1,
    linePixels: LinePixels.Solid,
    flags: { isPlanar: true, isDisjoint: true },
    points,
    polylines: [[...new Array<number>(points.length).keys()] ],
  };

  const params = createPointStringParams(args)!;
  expect(params).not.to.be.undefined;
  expect(params.vertices.usesUnquantizedPositions).to.equal(unquantized);
  expectBaseVertices(params.vertices, pts);

  return params;
}

function getVertexTableData(vertexTable: VertexTable, numExtraRgba: number): Uint32Array {
  let data = new Uint32Array(vertexTable.data.buffer, vertexTable.data.byteOffset, vertexTable.numVertices * vertexTable.numRgbaPerVertex + numExtraRgba);
  if (!vertexTable.usesUnquantizedPositions)
    return data;

  // Unquantized data is transposed for more efficient access on GPU.
  data = data.slice();
  const bytes = new Uint8Array(data.buffer);
  const swapBytes = (u32Idx: number, i0: number, i1: number) => {
    const u8Idx = u32Idx * 4;
    const tmp = bytes[u8Idx + i0];
    bytes[u8Idx + i0] = bytes[u8Idx + i1];
    bytes[u8Idx + i1] = tmp;
  };

  for (let i = 0; i < vertexTable.numVertices; i++) {
    const idx = i * vertexTable.numRgbaPerVertex;

    swapBytes(idx, 1, 4);
    swapBytes(idx, 2, 8);
    swapBytes(idx, 3, 12);
    swapBytes(idx, 6, 9);
    swapBytes(idx, 7, 13);
    swapBytes(idx, 11, 14);
  }

  return data;
}

function expectColors(vertexTable: VertexTable, expected: ColorDef | ColorDef[]): void {
  if (expected instanceof ColorDef) {
    expect(vertexTable.uniformColor).not.to.be.undefined;
    expect(vertexTable.uniformColor!.equals(expected)).to.be.true;
  } else {
    expect(vertexTable.uniformColor).to.be.undefined;
  }

  if (Array.isArray(expected)) {
    const data = getVertexTableData(vertexTable, expected.length);
    const colorTableStart = vertexTable.numVertices * vertexTable.numRgbaPerVertex;
    for (let i = 0; i < expected.length; i++) {
      const color = ColorDef.fromAbgr(data[colorTableStart + i]);
      expect(color.equals(expected[i])).to.be.true;
    }
  }
}

function expectBaseVertices(vertexTable: VertexTable, expectedPts: Point[], hasColorIndex = true): void {
  const data = getVertexTableData(vertexTable, 0);

  const fpts = new Float32Array(data.buffer);
  const getVertex = vertexTable.usesUnquantizedPositions ? (idx: number) => {
    const x = fpts[idx];
    return {
      x,
      y: fpts[idx + 1],
      z: fpts[idx + 2],
      featureIndex: data[idx + 3],
      colorIndex: (data[idx + 4] & 0x0000ffff),
    };
  } : (idx: number) => {
    const x = data[idx] & 0xffff;
    return {
      x,
      y: (data[idx] & 0xffff0000) >>> 16,
      z: data[idx + 1] & 0xffff,
      colorIndex: (data[idx + 1] & 0xffff0000) >>> 16,
      featureIndex: data[idx + 2] & 0x00ffffff,
    };
  };

  for (let i = 0; i < vertexTable.numVertices; i++) {
    const idx = i * vertexTable.numRgbaPerVertex;
    const vert = getVertex(idx);

    const pt = expectedPts[i];
    expect(vert.x).to.equal(pt.x);
    expect(vert.y).to.equal(pt.x + 1);
    expect(vert.z).to.equal(pt.x + 5);

    // Textured meshes don't use color tables and may reuse the color index for other purposes like normal.
    if (hasColorIndex)
      expect(vert.colorIndex).to.equal(pt.color);

    expect(vert.featureIndex).to.equal(pt.feature);
  }
}

function expectPointStrings(params: PointStringParams, expectedColors: ColorDef | ColorDef[], expectedPts: Point[]): void {
  const vertexTable = params.vertices;
  expect(vertexTable.numRgbaPerVertex).to.equal(vertexTable.usesUnquantizedPositions ? 5 : 3);
  expect(vertexTable.numVertices).to.equal(expectedPts.length);
  expectColors(vertexTable, expectedColors);

  let curIndex = 0;
  for (const index of params.indices)
    expect(index).to.equal(curIndex++);

  expectBaseVertices(vertexTable, expectedPts);
}

interface TriMeshPoint extends Point {
  material?: number; // material index for material atlas
  normal?: number; // oct-encoded normal
  uv?: 0 | 0.5 | 1; // u component of uv param; v will be -u
}

function makeTriangleStrip(firstPoint: TriMeshPoint, numTriangles: number, adjustPt?: (pt: TriMeshPoint) => TriMeshPoint): TriMeshPoint[] {
  adjustPt = adjustPt ?? ((pt: TriMeshPoint) => pt);
  const strip = [ adjustPt(firstPoint) ];
  const pointCount = numTriangles + 2;
  for (let i = 1; i < pointCount; i++)
    strip.push(adjustPt({ ...firstPoint, x: firstPoint.x + i }));

  return strip;
}

interface TriMesh {
  points: TriMeshPoint[];
  indices: number[];
  colors: ColorDef | ColorDef[];
  materials?: RenderMaterial | RenderMaterial[];
  texture?: RenderTexture;
}

function getSurfaceType(mesh: TriMesh): SurfaceType {
  const expectConsistent = (fn: (point: TriMeshPoint) => boolean) => expect(mesh.points.some(fn)).to.equal(mesh.points.every(fn));

  expectConsistent((x) => undefined === x.material);
  expectConsistent((x) => undefined === x.normal);
  expectConsistent((x) => undefined === x.uv);

  const hasUv = undefined !== mesh.points[0].uv;
  const hasNormal = undefined !== mesh.points[0].normal;
  expect(hasUv).to.equal(undefined !== mesh.texture);

  return hasUv ? (hasNormal ? SurfaceType.TexturedLit : SurfaceType.Textured) : (hasNormal ? SurfaceType.Lit : SurfaceType.Unlit);
}

function makeMeshParams(mesh: TriMesh): MeshParams {
  const type = getSurfaceType(mesh);

  const qpoints = new QPoint3dList();
  for (const point of mesh.points)
    qpoints.push(QPoint3d.fromScalars(point.x, point.x + 1, point.x + 5));

  const normals = SurfaceType.Lit === type || SurfaceType.TexturedLit === type ? mesh.points.map((pt) => new OctEncodedNormal(pt.normal!)) : undefined;
  let textureMapping;
  if (mesh.texture) {
    textureMapping = {
      texture: mesh.texture,
      uvParams: mesh.points.map((pt) => new Point2d(pt.uv, -pt.uv!)),
    };
  }

  const args: MeshArgs = {
    points: qpoints,
    vertIndices: mesh.indices,
    normals,
    fillFlags: FillFlags.None,
    material: mesh.materials instanceof RenderMaterial ? mesh.materials : undefined,
    textureMapping,
    colors: makeColorIndex(mesh.points, mesh.colors),
    features: makeFeatureIndex(mesh.points),
  };

  return createMeshParams(args, IModelApp.renderSystem.maxTextureSize);
}

function expectMesh(params: MeshParams, mesh: TriMesh): void {
  const vertexTable = params.vertices;
  const type = getSurfaceType(mesh);
  expect(vertexTable.numRgbaPerVertex).to.equal(SurfaceType.Unlit === type ? 3 : 4);
  expect(vertexTable.numVertices).to.equal(mesh.points.length);

  expectColors(vertexTable, mesh.colors);
  expectBaseVertices(vertexTable, mesh.points, SurfaceType.Textured !== type && SurfaceType.TexturedLit !== type);

  const surface = params.surface;
  let curIndex = 0;
  for (const index of surface.indices)
    expect(index).to.equal(mesh.indices[curIndex++]);

  expect(surface.textureMapping?.texture).to.equal(mesh.texture);
  if (Array.isArray(mesh.materials)) {
    expect(surface.material).to.be.undefined;
  } else {
    expect(surface.material).to.equal(mesh.materials);
  }

  if (SurfaceType.Unlit === type)
    return;

  const data = getVertexTableData(vertexTable, 0);
  if (SurfaceType.Textured === type || SurfaceType.TexturedLit === type) {
    const uvs = mesh.points.map((p) => new Point2d(p.uv, -p.uv!));
    const qparams = QParams2d.fromRange(Range2d.createArray(uvs));
    for (const vertIndex of surface.indices) {
      const dataIndex = vertIndex * vertexTable.numRgbaPerVertex;
      const u = data[dataIndex + 3] & 0xffff;
      const v = (data[dataIndex + 3] & 0xffff0000) >>> 16;
      const uv = qparams.unquantize(u, v);
      expect(uv.x).to.equal(mesh.points[vertIndex].uv);
      expect(uv.y).to.equal(-(mesh.points[vertIndex].uv!));
    }
  }

  if (SurfaceType.Lit === type || SurfaceType.TexturedLit === type) {
    const getNormal = (i: number) => {
      if (SurfaceType.Lit === type)
        return data[i + 3] & 0xffff;
      else
        return (data[i + 1] & 0xffff0000) >>> 16;
    };

    for (const vertIndex of surface.indices) {
      const dataIndex = vertIndex * vertexTable.numRgbaPerVertex;
      const normal = getNormal(dataIndex);
      expect(normal).to.equal(mesh.points[vertIndex].normal);
    }
  }
}

// index, prev index, next index, param
type PolylineIndices = [number, number, number, number];

function makePolyline(verts: PolylineIndices[]): TesselatedPolyline {
  const indices = new IndexBuffer();
  const prev = new IndexBuffer();
  const nextAndParam = new Uint32Array(verts.length);

  for (let i = 0; i < verts.length; i++) {
    const vert = verts[i];
    indices.push(vert[0]);
    prev.push(vert[1]);
    nextAndParam[i] = (vert[2] | (vert[3] << 24)) >>> 0;
  }

  return {
    indices: indices.toVertexIndices(),
    prevIndices: prev.toVertexIndices(),
    nextIndicesAndParams: new Uint8Array(nextAndParam.buffer),
  };
}

function expectPolyline(polyline: TesselatedPolyline, expected: PolylineIndices[]): void {
  expect(polyline.indices.length).to.equal(expected.length);
  expect(polyline.prevIndices.length).to.equal(expected.length);
  expect(polyline.nextIndicesAndParams.length).to.equal(4 * expected.length);

  let i = 0;
  const niap = new Uint32Array(polyline.nextIndicesAndParams.buffer, polyline.nextIndicesAndParams.byteOffset, polyline.nextIndicesAndParams.length / 4);
  const prevIter = polyline.prevIndices[Symbol.iterator]();
  for (const index of polyline.indices) {
    const pt = expected[i];
    expect(index).to.equal(pt[0]);
    expect(prevIter.next().value).to.equal(pt[1]);

    const nextAndParam = niap[i];
    expect(nextAndParam & 0x00ffffff).to.equal(pt[2]);
    expect((nextAndParam & 0xff000000) >>> 24).to.equal(pt[3]);
    ++i;
  }
}

interface Edges {
  // index, other index, quad index
  segments?: Array<[ number, number, number ]>;
  // segments plus oct-encoded normal pair
  silhouettes?: Array<[ number, number, number, number ]>;
  polylines?: PolylineIndices[];
}

function makeEdgeParams(edges: Edges): EdgeParams {
  let segments, silhouettes, indexed;
  if (edges.segments) {
    const indices = new IndexBuffer();
    const endPointAndQuadIndices = new Uint32Array(edges.segments.length);
    for (let i = 0; i < edges.segments.length; i++) {
      indices.push(edges.segments[i][0]);
      const endPoint = edges.segments[i][1];
      const quad = edges.segments[i][2];
      endPointAndQuadIndices[i] = (endPoint | (quad << 24)) >>> 0;
    }

    segments = {
      indices: indices.toVertexIndices(),
      endPointAndQuadIndices: new Uint8Array(endPointAndQuadIndices.buffer),
    };
  }

  if (edges.silhouettes) {
    const indices = new IndexBuffer();
    const endPointAndQuadIndices = new Uint32Array(edges.silhouettes.length);
    const normalPairs = new Uint32Array(edges.silhouettes.length);
    for (let i = 0; i < edges.silhouettes.length; i++) {
      indices.push(edges.silhouettes[i][0]);
      const endPoint = edges.silhouettes[i][1];
      const quad = edges.silhouettes[i][2];
      endPointAndQuadIndices[i] = (endPoint | (quad << 24)) >>> 0;
      normalPairs[i] = edges.silhouettes[i][3];
    }

    silhouettes = {
      indices: indices.toVertexIndices(),
      endPointAndQuadIndices: new Uint8Array(endPointAndQuadIndices.buffer),
      normalPairs: new Uint8Array(normalPairs.buffer),
    };
  }

  return {
    segments, silhouettes, indexed,
    polylines: edges.polylines ? makePolyline(edges.polylines) : undefined,
    weight: 12,
    linePixels: LinePixels.Invisible,
  };
}

function expectSegments(params: SegmentEdgeParams, expected: Array<[number, number, number]> | Array<[number, number, number, number]>): void {
  let i = 0;
  expect(params.indices.length).to.equal(expected.length);
  expect(params.endPointAndQuadIndices.length).to.equal(4 * expected.length);
  expect(params.endPointAndQuadIndices.length % 4).to.equal(0);
  const epaq = new Uint32Array(params.endPointAndQuadIndices.buffer, params.endPointAndQuadIndices.byteOffset, params.endPointAndQuadIndices.length / 4);
  for (const index of params.indices) {
    expect(index).to.equal(expected[i][0]);
    const endPointAndQuad = epaq[i];
    expect(endPointAndQuad & 0x00ffffff).to.equal(expected[i][1]);
    expect((endPointAndQuad & 0xff000000) >>> 24).to.equal(expected[i][2]);
    ++i;
  }
}

function expectEdges(params: EdgeParams | undefined, expected: Edges | undefined): void {
  expect(undefined === params).to.equal(undefined === expected);
  if (!params || !expected)
    return;

  expect(undefined === params.segments).to.equal(undefined === expected.segments);
  if (params.segments)
    expectSegments(params.segments, expected.segments!);

  expect(undefined === params.silhouettes).to.equal(undefined === expected.silhouettes);
  if (params.silhouettes) {
    expectSegments(params.silhouettes, expected.silhouettes!);
    expect(params.silhouettes.normalPairs.length).to.equal(expected.silhouettes!.length * 4);
    expect(params.silhouettes.normalPairs.length % 4).to.equal(0);
    const normals = new Uint32Array(params.silhouettes.normalPairs.buffer, params.silhouettes.normalPairs.byteOffset, params.silhouettes.normalPairs.length / 4);
    for (let i = 0; i < expected.silhouettes!.length; i++)
      expect(normals[i]).to.equal(expected.silhouettes![i][3]);
  }

  expect(undefined === params.polylines).to.equal(undefined === expected.polylines);
  if (params.polylines)
    expectPolyline(params.polylines, expected.polylines!);
}

describe("VertexTableSplitter", () => {
  class MockSystem extends MockRender.System {
    public static maxTextureSize = 2048;
    public override get maxTextureSize() { return MockSystem.maxTextureSize; }

    public static makeTexture(): RenderTexture {
      class Texture extends RenderTexture {
        public constructor() { super(RenderTexture.Type.Normal); }
        public dispose() { }
        public get bytesUsed() { return 4; }
      }

      return new Texture();
    }
  }

  before(async () => {
    MockRender.App.systemFactory = () => new MockSystem();
    await MockRender.App.startup();
  });

  beforeEach(() => setMaxTextureSize(2048));
  after(async () => MockRender.App.shutdown());

  function setMaxTextureSize(max: number) {
    MockSystem.maxTextureSize = max;
  }

  function makeComputeNodeId(featureTable: PackedFeatureTable, computeFromElementId: (id: Id64.Uint32Pair) => number): ComputeAnimationNodeId {
    const elemIdPair = { lower: 0, upper: 0 };
    return (featureIndex: number) => {
      featureTable.getElementIdPair(featureIndex, elemIdPair);
      return computeFromElementId(elemIdPair);
    };
  }

  for (let iUnquantized = 0; iUnquantized < 2; iUnquantized++) {
    const unquantized = iUnquantized > 0;
    describe(unquantized ? "Unquantized" : "Quantized", () => {
      it("splits point string params based on node Id", () => {
        const featureTable = makePackedFeatureTable("0x1", "0x2", "0x10000000002");

        const points: Point[] = [
          { x: 1, color: 0, feature: 0 },
          { x: 0, color: 0, feature: 1 },
          { x: 5, color: 0, feature: 2 },
          { x: 4, color: 0, feature: 1 },
          { x: 2, color: 0, feature: 2 },
        ];

        const params = makePointStringParams(points, ColorDef.red, unquantized);
        expectPointStrings(params, ColorDef.red, points);

        const split = splitPointStringParams({
          params, featureTable, maxDimension: 2048,
          computeNodeId: makeComputeNodeId(featureTable, (id) => id.upper > 0 ? 1 : 0),
        });
        expect(split.size).to.equal(2);

        expectPointStrings(split.get(0)!, ColorDef.red, [
          { x: 1, color: 0, feature: 0 },
          { x: 0, color: 0, feature: 1 },
          { x: 4, color: 0, feature: 1 },
        ]);

        expectPointStrings(split.get(1)!, ColorDef.red, [
          { x: 5, color: 0, feature: 2 },
          { x: 2, color: 0, feature: 2 },
        ]);
      });

      it("reconstructs or collapses color tables and remaps color indices", () => {
        const featureTable = makePackedFeatureTable("0x1", "0x2");

        const colors = [ ColorDef.red, ColorDef.green, ColorDef.blue ];

        const points = [
          { x: 1, color: 2, feature: 0 },
          { x: 2, color: 0, feature: 0 },
          { x: 3, color: 1, feature: 1 },
          { x: 4, color: 1, feature: 1 },
        ];

        const params = makePointStringParams(points, colors, unquantized);
        expectPointStrings(params, colors, points);

        const split = splitPointStringParams({
          params, featureTable, maxDimension: 2048,
          computeNodeId: makeComputeNodeId(featureTable, (id) => id.lower),
        });
        expect(split.size).to.equal(2);

        expectPointStrings(split.get(1)!, [ ColorDef.blue, ColorDef.red ], [
          { x: 1, color: 0, feature: 0 },
          { x: 2, color: 1, feature: 0 },
        ]);

        expectPointStrings(split.get(2)!, ColorDef.green, [
          { x: 3, color: 0, feature: 1 },
          { x: 4, color: 0, feature: 1 },
        ]);
      });
    });
  }

  it("produces rectangular vertex tables", () => {
    setMaxTextureSize(6);

    const expectDimensions = (p: PointStringParams, w: number, h: number) => {
      expect(p.vertices.width).to.equal(w);
      expect(p.vertices.height).to.equal(h);
    };

    const colors = [ ColorDef.red, ColorDef.green, ColorDef.blue ];
    const featureTable = makePackedFeatureTable("0x2", "0x20", "0x200", "0x2000");
    const points = [
      { x: 0, color: 0, feature: 0 },
      { x: 1, color: 1, feature: 0 },

      { x: 2, color: 2, feature: 1 },

      { x: 3, color: 1, feature: 2 },
      { x: 4, color: 1, feature: 2 },
      { x: 5, color: 1, feature: 2 },

      { x: 6, color: 2, feature: 3 },
      { x: 7, color: 0, feature: 3 },
      { x: 8, color: 2, feature: 3 },
    ];

    const params = makePointStringParams(points, colors, false);
    expectPointStrings(params, colors, points);

    const split = splitPointStringParams({
      params, featureTable, maxDimension: 6,
      computeNodeId: makeComputeNodeId(featureTable, (id) => id.lower),
    });
    expect(split.size).to.equal(4);

    const p1 = split.get(0x2)!;
    expectDimensions(p1, 3, 3);
    expectPointStrings(p1, [ ColorDef.red, ColorDef.green ], [
      { x: 0, color: 0, feature: 0 },
      { x: 1, color: 1, feature: 0 },
    ]);

    const p2 = split.get(0x20)!;
    expectDimensions(p2, 3, 1);
    expectPointStrings(p2, ColorDef.blue, [{ x: 2, color: 0, feature: 1 }]);

    const p3 = split.get(0x200)!;
    expectDimensions(p3, 3, 3);
    expectPointStrings(p3, ColorDef.green, [
      { x: 3, color: 0, feature: 2 },
      { x: 4, color: 0, feature: 2 },
      { x: 5, color: 0, feature: 2 },
    ]);

    const p4 = split.get(0x2000)!;
    expectDimensions(p4, 6, 2);
    expectPointStrings(p4, [ColorDef.blue, ColorDef.red], [
      { x: 6, color: 0, feature: 3 },
      { x: 7, color: 1, feature: 3 },
      { x: 8, color: 0, feature: 3 },
    ]);
  });
  function makeSurface(adjustPt?: (pt: TriMeshPoint) => TriMeshPoint): { params: MeshParams, colors: ColorDef | ColorDef[], featureTable: PackedFeatureTable, mesh: TriMesh } {
    let colors: ColorDef | ColorDef[] = [ ColorDef.red, ColorDef.green, ColorDef.blue ];
    const featureTable = makePackedFeatureTable("0x1", "0x2", "0x3");
    const mesh: TriMesh = {
      points: [
        ...makeTriangleStrip({ x: 0, color: 2, feature: 0 }, 2, adjustPt),
        ...makeTriangleStrip({ x: 10, color: 0, feature: 0 }, 1, adjustPt),
        ...makeTriangleStrip({ x: 20, color: 1, feature: 1 }, 1, adjustPt),
        ...makeTriangleStrip({ x: 30, color: 1, feature: 1 }, 2, adjustPt),
        ...makeTriangleStrip({ x: 40, color: 0, feature: 2 }, 3, adjustPt),
      ],
      indices: [
        // feature 0
        0, 1, 2,
        1, 2, 3,
        4, 5, 6,

        // feature 1
        7, 8, 9,
        10, 11, 12,
        10, 11, 13,

        // feature 2
        14, 15, 16,
        16, 15, 17,
        14, 18, 17,
      ],
      colors,
    };

    if (undefined !== mesh.points[0].uv) {
      mesh.colors = colors = ColorDef.from(1, 2, 3);
      mesh.texture = MockSystem.makeTexture();
    }

    const params = makeMeshParams(mesh);
    expectMesh(params, mesh);
    return { params, colors, featureTable, mesh };
  }

  function testMeshParams(adjustPt?: (pt: TriMeshPoint) => TriMeshPoint): void {
    const { params, featureTable } = makeSurface(adjustPt);
    const texture = params.surface.textureMapping?.texture;

    const split = splitMeshParams({
      params, featureTable, maxDimension: 2048,
      computeNodeId: makeComputeNodeId(featureTable, (id) => id.lower),
      createMaterial: (args) => IModelApp.renderSystem.createRenderMaterial(args),
    });
    expect(split.size).to.equal(3);

    expectMesh(split.get(1)!, {
      texture,
      colors: texture ? ColorDef.from(1, 2, 3) : [ ColorDef.blue, ColorDef.red ],
      points: [
        ...makeTriangleStrip({ x: 0, color: 0, feature: 0 }, 2, adjustPt),
        ...makeTriangleStrip({ x: 10, color: 1, feature: 0 }, 1, adjustPt),
      ], indices: [
        0, 1, 2,
        1, 2, 3,
        4, 5, 6,
      ],
    });

    expectMesh(split.get(2)!, {
      texture,
      colors: texture ? ColorDef.from(1, 2, 3) : ColorDef.green,
      points: [
        ...makeTriangleStrip({ x: 20, color: 0, feature: 1 }, 1, adjustPt),
        ...makeTriangleStrip({ x: 30, color: 0, feature: 1 }, 2, adjustPt),
      ], indices: [
        0, 1, 2,
        3, 4, 5,
        3, 4, 6,
      ],
    });

    expectMesh(split.get(3)!, {
      texture,
      colors: texture ? ColorDef.from(1, 2, 3) : ColorDef.red,
      points: makeTriangleStrip({ x: 40, color: 0, feature: 2 }, 3, adjustPt),
      indices: [
        0, 1, 2,
        2, 1, 3,
        0, 4, 3,
      ],
    });
  }

  it("splits unlit surface params based on node Id", () => {
    testMeshParams();
  });

  function setNormal(pt: TriMeshPoint): TriMeshPoint {
    pt.normal = pt.x + 5;
    return pt;
  }

  it("splits lit surface params based on node Id", () => {
    testMeshParams(setNormal);
  });

  function setUv(pt: TriMeshPoint): TriMeshPoint {
    pt.uv = (pt.x % 2) / 2 as 0 | 0.5 | 1;
    expect(pt.uv === 0 || pt.uv === 0.5 || pt.uv === 1).to.be.true;
    return pt;
  }

  it("splits textured surface params based on node Id", () => {
    testMeshParams(setUv);
  });

  it("splits textured lit surface params based on node Id", () => {
    testMeshParams((pt) => setUv(setNormal(pt)));
  });

  it("splits edge params based on node Ids", () => {
    const surface = makeSurface(setNormal);
    const edges: Edges = {
      segments: [
        [0, 1, 0],
        [1, 2, 1],
        [0, 2, 2],

        [10, 12, 3],
        [10, 11, 0],

        [14, 16, 1],
        [15, 17, 2],
        [16, 18, 3],
      ], silhouettes: [
        [2, 3, 0, 123],
        [4, 6, 1, 987],

        [7, 8, 2, 0xfedcba98],
        [8, 9, 3, 0xffffffff],

        [15, 16, 0, 0],
        [16, 17, 1, 789],
        [15, 18, 2, 0xdeadbeef],
      ], polylines: [
        [0, 0, 1, 0],
        [1, 0, 5, 1],
        [5, 1, 5, 2],

        [9, 9, 11, 3],
        [11, 9, 11, 0],

        [14, 14, 15, 1],
        [15, 14, 16, 2],
        [16, 15, 17, 3],
        [17, 16, 18, 0],
        [18, 17, 18, 1],
      ],
    };

    surface.params.edges = makeEdgeParams(edges);
    expectEdges(surface.params.edges, edges);

    const { params, featureTable } = surface;
    const split = splitMeshParams({
      params, featureTable, maxDimension: 2048,
      computeNodeId: makeComputeNodeId(featureTable, (id) => id.lower),
      createMaterial: (args) => IModelApp.renderSystem.createRenderMaterial(args),
    });
    expect(split.size).to.equal(3);

    expectEdges(split.get(1)!.edges, {
      segments: edges.segments!.slice(0, 3),
      silhouettes: edges.silhouettes!.slice(0, 2),
      polylines: edges.polylines!.slice(0, 3),
    });

    expectEdges(split.get(2)!.edges, {
      segments: [
        [3, 5, 3],
        [3, 4, 0],
      ], silhouettes: [
        [0, 1, 2, 0xfedcba98],
        [1, 2, 3, 0xffffffff],
      ],
      polylines: edges.polylines!.slice(3, 5).map((p) => [ p[0] - 7, p[1] - 7, p[2] - 7, p[3] ]),
    });

    expectEdges(split.get(3)!.edges, {
      segments: [
        [0, 2, 1],
        [1, 3, 2],
        [2, 4, 3],
      ], silhouettes: [
        [1, 2, 0, 0],
        [2, 3, 1, 789],
        [1, 4, 2, 0xdeadbeef],
      ],
      polylines: edges.polylines!.slice(5, 10).map((p) => [ p[0] - 14, p[1] - 14, p[2] - 14, p[3] ]),
    });
  });

  it("omits edges for nodes that lack them", () => {
  });

  it("creates rectangular edge tables", () => {
  });

  it("reconstructs or collapses material atlases and remaps material indices", () => {
  });
});
