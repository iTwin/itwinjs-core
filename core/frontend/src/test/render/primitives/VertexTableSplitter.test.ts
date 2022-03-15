/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2d } from "@itwin/core-geometry";
import {
  ColorDef, ColorIndex, Feature, FeatureIndex, FeatureTable, FillFlags, LinePixels, OctEncodedNormal, PackedFeatureTable, PolylineData, PolylineFlags, QPoint3d, QPoint3dList,
  RenderMaterial, RenderTexture,
} from "@itwin/core-common";
import {
  MockRender,
} from "../../../core-frontend";
import {
  MeshArgs, MeshParams, PointStringParams, PolylineArgs, splitPointStringParams, SurfaceType,
} from "../../../render-primitives";

interface Point {
  x: number; // quantized x coordinate - y will be x+1 and z will be x+5.
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

function makePointStringParams(points: Point[], colors: ColorDef | ColorDef[]): PointStringParams {
  const colorIndex = makeColorIndex(points, colors);
  const featureIndex = makeFeatureIndex(points);

  const qpoints = new QPoint3dList();
  for (const point of points)
    qpoints.push(QPoint3d.fromScalars(point.x, point.x + 1, point.x + 5));

  const args: PolylineArgs = {
    colors: colorIndex,
    features: featureIndex,
    width: 1,
    linePixels: LinePixels.Solid,
    flags: new PolylineFlags(false, true, true),
    points: qpoints,
    polylines: [ new PolylineData([...new Array<number>(points.length).keys()], points.length) ],
  };

  const params = PointStringParams.create(args)!;
  expect(params).not.to.be.undefined;
  return params;
}

function expectPointStrings(params: PointStringParams, expectedColors: ColorDef | ColorDef[], expectedPts: Point[]): void {
  const vertexTable = params.vertices;
  expect(vertexTable.numRgbaPerVertex).to.equal(3);
  expect(vertexTable.numVertices).to.equal(expectedPts.length);
  if (expectedColors instanceof ColorDef) {
    expect(vertexTable.uniformColor).not.to.be.undefined;
    expect(vertexTable.uniformColor!.equals(expectedColors)).to.be.true;
  } else {
    expect(vertexTable.uniformColor).to.be.undefined;
  }

  let curIndex = 0;
  for (const index of params.indices)
    expect(index).to.equal(curIndex++);

  const numColors = expectedColors instanceof ColorDef ? 0 : expectedColors.length;
  const data = new Uint32Array(vertexTable.data.buffer, vertexTable.data.byteOffset, vertexTable.numVertices * vertexTable.numRgbaPerVertex + numColors);
  if (Array.isArray(expectedColors)) {
    const colorTableStart = vertexTable.numVertices * vertexTable.numRgbaPerVertex;
    for (let i = 0; i < expectedColors.length; i++) {
      const color = ColorDef.fromAbgr(data[colorTableStart + i]);
      expect(color.equals(expectedColors[i])).to.be.true;
    }
  }

  for (let i = 0; i < vertexTable.numVertices; i++) {
    const idx = i * vertexTable.numRgbaPerVertex;
    const x = data[idx] & 0xffff;
    const y = (data[idx] & 0xffff0000) >>> 16;
    const z = data[idx + 1] & 0xffff;
    const colorIndex = (data[idx + 1] & 0xffff0000) >>> 16;
    const featureIndex = data[idx + 2] & 0x00ffffff;

    const pt = expectedPts[i];
    expect(x).to.equal(pt.x);
    expect(y).to.equal(pt.x + 1);
    expect(z).to.equal(pt.x + 5);
    expect(colorIndex).to.equal(pt.color);
    expect(featureIndex).to.equal(pt.feature);
  }
}

interface TriMeshPoint extends Point {
  material?: number; // material index for material atlas
  normal?: number; // oct-encoded normal
  uv?: number; // x component of uv param in [0..1]; y will be x / 2
}

interface TriMesh {
  points: TriMeshPoint[];
  indices: number[];
  colors: ColorDef | ColorDef[];
  materials: RenderMaterial | RenderMaterial[];
  texture?: RenderTexture;
}

function getSurfaceType(mesh: TriMesh): SurfaceType {
  const expectConsistent = (fn: (point :TriMeshPoint) => boolean) => expect(mesh.points.some(fn)).to.equal(mesh.points.every(fn));

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
      uvParams: mesh.points.map((pt) => new Point2d(pt.uv!, pt.uv! * 0.5)),
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

  return MeshParams.create(args);
}

describe.only("VertexTableSplitter", () => {
  class MockSystem extends MockRender.System {
    public static maxTextureSize = 2048;
    public override get maxTextureSize() { return MockSystem.maxTextureSize; }
  }

  before(async () => {
    MockRender.App.systemFactory = () => new MockSystem();
    await MockRender.App.startup();
  });

  beforeEach(() => setMaxTextureSize(2048));
  after(() => MockRender.App.shutdown());

  function setMaxTextureSize(max: number) {
    MockSystem.maxTextureSize = max;
  }

  it("splits point string params based on node Id", () => {
    const featureTable = makePackedFeatureTable("0x1", "0x2", "0x10000000002");

    const points: Point[] = [
      { x: 1, color: 0, feature: 0 },
      { x: 0, color: 0, feature: 1 },
      { x: 5, color: 0, feature: 2 },
      { x: 4, color: 0, feature: 1 },
      { x: 2, color: 0, feature: 2 },
    ];

    const params = makePointStringParams(points, ColorDef.red);
    expectPointStrings(params, ColorDef.red, points);

    const split = splitPointStringParams({ params, featureTable, maxDimension: 2048, computeNodeId: (id) => id.upper > 0 ? 1 : 0 });
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

  it("collapses color tables and remaps color indices", () => {
    const featureTable = makePackedFeatureTable("0x1", "0x2");

    const colors = [ ColorDef.red, ColorDef.green, ColorDef.blue ];

    const points = [
      { x: 1, color: 2, feature: 0 },
      { x: 2, color: 0, feature: 0 },
      { x: 3, color: 1, feature: 1 },
      { x: 4, color: 1, feature: 1 },
    ];

    const params = makePointStringParams(points, colors);
    expectPointStrings(params, colors, points);

    const split = splitPointStringParams({ params, featureTable, maxDimension: 2048, computeNodeId: (id) => id.lower });
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

    const params = makePointStringParams(points, colors);
    expectPointStrings(params, colors, points);

    const split = splitPointStringParams({ params, featureTable, maxDimension: 6, computeNodeId: (id) => id.lower });
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

  it("splits polyline params based on node Id", () => {
  });

  it("splits surface params based on node Id", () => {
  });

  it("splits edge params based on node Ids", () => {
  });

  it("collapses material atlases and remaps material indices", () => {
  });
});
