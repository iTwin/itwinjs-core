/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TileIO, IModelTileIO, IModelTile, TileTree, TileRequest } from "@bentley/imodeljs-frontend/lib/tile";
import { SurfaceType } from "@bentley/imodeljs-frontend/lib/rendering";
import { Batch, MeshGraphic, GraphicsArray, Primitive, PolylineGeometry } from "@bentley/imodeljs-frontend/lib/webgl";
import { ModelProps, RelatedElementProps, FeatureIndexType, BatchType, ServerTimeoutError } from "@bentley/imodeljs-common";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import * as path from "path";
import { MockRender, RenderGraphic, IModelApp, IModelConnection, GeometricModelState } from "@bentley/imodeljs-frontend";
import { WebGLTestContext } from "../WebGLTestContext";
import { TileTestCase, TileTestData } from "./TileIO.data";
import { TILE_DATA_1_1 } from "./TileIO.data.1.1";
import { TILE_DATA_1_2 } from "./TileIO.data.1.2";
import { TILE_DATA_1_3 } from "./TileIO.data.1.3";
import { TILE_DATA_1_4 } from "./TileIO.data.1.4";
import { changeMinorVersion, changeMajorVersion, changeHeaderLength } from "./TileIO.data.fake";
import { testOnScreenViewport } from "../TestViewport";

const iModelLocation = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");

const testCases = [
  TILE_DATA_1_1,
  TILE_DATA_1_2,
  TILE_DATA_1_3,
  TILE_DATA_1_4,
];

const currentTestCase = testCases[testCases.length - 1];

// Make fake versions of each real version
const numBaseTestCases = testCases.length;
for (let i = 0; i < numBaseTestCases; i++) {
  const testCase = testCases[i];
  testCases.push(changeMinorVersion(testCase, 5000 + i));
  testCases.push(changeMajorVersion(testCase, 6000 + i));
  testCases.push(changeHeaderLength(testCase, 7000 + i, 8));
}

export class FakeGMState extends GeometricModelState {
  public get is3d(): boolean { return true; }
  public get is2d(): boolean { return !this.is3d; }
  public constructor(props: ModelProps, iModel: IModelConnection) { super(props, iModel); }
}

export class FakeModelProps implements ModelProps {
  public modeledElement: RelatedElementProps;
  public classFullName: string = "fake";
  public constructor(props: RelatedElementProps) { this.modeledElement = props; }
}

export class FakeREProps implements RelatedElementProps {
  public id: Id64String;
  public constructor() { this.id = Id64.invalid; }
}

function delta(a: number, b: number): number { return Math.abs(a - b); }
type ProcessGraphic = (graphic: RenderGraphic) => void;

function processHeader(data: TileTestData, test: TileTestCase, numElements: number) {
  const stream = new TileIO.StreamBuffer(test.bytes.buffer);
  stream.reset();
  const header = new IModelTileIO.Header(stream);
  expect(header.isValid).to.be.true;
  expect(header.format).to.equal(TileIO.Format.IModel);
  expect(header.versionMajor).to.equal(data.versionMajor);
  expect(header.versionMinor).to.equal(data.versionMinor);
  expect(header.headerLength).to.equal(data.headerLength);
  expect(header.tileLength).to.equal(test.bytes.byteLength);
  expect(header.flags).to.equal(test.flags);
  expect(header.numElementsIncluded).to.equal(numElements);
  expect(header.numElementsExcluded).to.equal(0);
  expect(header.isReadableVersion).to.equal(!data.unreadable);
}

function createReader(imodel: IModelConnection, data: TileTestData, test: TileTestCase): IModelTileIO.Reader | undefined {
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new TileIO.StreamBuffer(test.bytes.buffer);
  const reader = IModelTileIO.Reader.create(stream, imodel, model.id, model.is3d, IModelApp.renderSystem);
  expect(undefined === reader).to.equal(!!data.unreadable);
  return reader;
}

async function processRectangle(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.rectangle, 1);
  const reader = createReader(imodel, data, data.rectangle);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -2.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -5.0)).to.be.lessThan(0.0005);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 2.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 5.0)).to.be.lessThan(0.0005);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachRectangle(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processRectangle(data, imodel, processGraphic);
}

async function processTriangles(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.triangles, 6);
  const reader = createReader(imodel, data, data.triangles);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -10.0)).to.be.lessThan(0.00051);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 10.0)).to.be.lessThan(0.00051);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachTriangles(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processTriangles(data, imodel, processGraphic);
}

async function processLineString(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.lineString, 1);
  const reader = createReader(imodel, data, data.lineString);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -10.0)).to.be.lessThan(0.00051);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 10.0)).to.be.lessThan(0.00051);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachLineString(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processLineString(data, imodel, processGraphic);
}

async function processLineStrings(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.lineStrings, 3);
  const reader = createReader(imodel, data, data.lineStrings);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -30.0)).to.be.lessThan(0.0016);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 30.0)).to.be.lessThan(0.0016);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachLineStrings(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processLineStrings(data, imodel, processGraphic);
}

async function processCylinder(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.cylinder, 1);
  const reader = createReader(imodel, data, data.cylinder);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
    expect(result.isLeaf).to.be.false; // cylinder contains curves - not a leaf - can be refined to higher-resolution single child.
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -2.0)).to.be.lessThan(0.0005);
    expect(delta(low.y, -2.0)).to.be.lessThan(0.0005);
    expect(delta(low.z, -3.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 2.0)).to.be.lessThan(0.0005);
    expect(delta(high.y, 2.0)).to.be.lessThan(0.0005);
    expect(delta(high.z, 3.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachCylinder(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processCylinder(data, imodel, processGraphic);
}

// These tests require the real (webgl-based) RenderSystem.
describe("TileIO (WebGL)", () => {
  let imodel: IModelConnection;

  before(async () => {
    imodel = await IModelConnection.openSnapshot(iModelLocation);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeSnapshot();
  });

  it("should read an iModel tile containing a single rectangle", async () => {
    if (WebGLTestContext.isInitialized) {
      await processEachRectangle(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(MeshGraphic);
        const mg = batch.graphic as MeshGraphic;
        expect(mg.surfaceType).to.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.true;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(4);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.false;
      });
    }
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", async () => {
    if (WebGLTestContext.isInitialized) {
      await processEachTriangles(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.numFeatures).to.equal(6);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsArray);
        const list = batch.graphic as GraphicsArray;
        expect(list.graphics.length).to.equal(2);

        expect(list.graphics[0]).to.be.instanceOf(MeshGraphic);
        let mg = list.graphics[0] as MeshGraphic;
        expect(mg.surfaceType).to.be.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.true;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(9);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.false;

        expect(list.graphics[1]).to.be.instanceOf(MeshGraphic);
        mg = list.graphics[1] as MeshGraphic;
        expect(mg.surfaceType).to.be.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.true;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(9);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.true;
      });
    }
  });

  it("should read an iModel tile containing single open yellow line string", async () => {
    if (WebGLTestContext.isInitialized) {
      await processEachLineString(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.featureTable.numFeatures).to.equal(1);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(Primitive);
        const plinePrim = batch.graphic as Primitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.Uniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        const plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;
      });
    }
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    if (WebGLTestContext.isInitialized) {
      await processEachLineStrings(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.numFeatures).to.equal(3);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsArray);
        const list = batch.graphic as GraphicsArray;
        expect(list.graphics.length).to.equal(2);

        expect(list.graphics[0]).to.be.instanceOf(Primitive);
        let plinePrim = list.graphics[0] as Primitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.Uniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        let plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;

        expect(list.graphics[1]).to.be.instanceOf(Primitive);
        plinePrim = list.graphics[1] as Primitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.NonUniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(228); // 120 pre-tesselation...
        expect(plGeom.lut.numVertices).to.equal(12);
        expect(plGeom.lineCode).to.equal(2);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;
      });
    }
  });

  it("should read an iModel tile containing edges and silhouettes", async () => {
    if (WebGLTestContext.isInitialized) {
      await processEachCylinder(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(MeshGraphic);
        const mg = batch.graphic as MeshGraphic;
        expect(mg.surfaceType).to.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.false;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(146);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.false;
      });
    }
  });
});

// These tests use the mock RenderSystem (do not require WebGL) so will execute in Windows CI job.
describe("TileIO (mock render)", () => {
  let imodel: IModelConnection;

  before(async () => {
    imodel = await IModelConnection.openSnapshot(iModelLocation);
    MockRender.App.startup();
  });

  after(async () => {
    MockRender.App.shutdown();
    if (imodel) await imodel.closeSnapshot();
  });

  it("should support canceling operation", async () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(currentTestCase.rectangle.bytes.buffer);
      const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem, BatchType.Primary, true, (_) => true);
      expect(reader).not.to.be.undefined;

      const result = await reader!.read();
      expect(result.readStatus).to.equal(TileIO.ReadStatus.Canceled);
    }
  });

  it("should obtain tiles from backend", async () => {
    // This data set contains 4 physical models: 0x1c (empty), 0x22, 0x23, and 0x24. The latter 3 collectively contain 4 spheres.
    const modelProps = await imodel.models.getProps("0x22");
    expect(modelProps.length).to.equal(1);

    const tree = await imodel.tiles.getTileTreeProps(modelProps[0].id!.toString());

    expect(tree.id).to.equal(modelProps[0].id);
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    const rootTile = tree.rootTile;
    expect(rootTile.contentId).to.equal("0/0/0/0/1");
    expect(rootTile.isLeaf).to.be.false; // this tile has one higher-resolution child because it contains only 1 elements (a sphere)
  });

  it("should read an iModel tile containing a single rectangle", async () => {
    await processEachRectangle(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).instanceof(MockRender.Graphic);
    });
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", async () => {
    await processEachTriangles(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.false;
      expect(batch.featureTable.numFeatures).to.equal(6);
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).instanceof(MockRender.List);
      const list = batch.graphic as MockRender.List;
      expect(list.graphics.length).to.equal(2);
    });
  });

  it("should read an iModel tile containing single open yellow line string", async () => {
    await processEachLineString(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.featureTable.numFeatures).to.equal(1);
      expect(batch.graphic).not.to.be.undefined;
    });
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    await processEachLineStrings(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.false;
      expect(batch.featureTable.numFeatures).to.equal(3);
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).to.be.instanceOf(MockRender.List);
      const list = batch.graphic as MockRender.List;
      expect(list.graphics.length).to.equal(2);
    });
  });

  it("should read an iModel tile containing edges and silhouettes", async () => {
    await processEachCylinder(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.graphic).not.to.be.undefined;
    });
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  if (condition())
    return Promise.resolve();

  await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
  return waitUntil(condition);
}

async function getTileTree(imodel: IModelConnection, modelId: Id64String): Promise<TileTree> {
  await imodel.models.load(modelId)!;
  const baseModel = imodel.models.getLoaded(modelId)!;
  expect(baseModel).not.to.be.undefined;
  const model = baseModel.asGeometricModel!;

  let tree: TileTree | undefined;
  await waitUntil(() => {
    tree = model.getOrLoadTileTree(true);
    return undefined !== tree;
  });

  expect(tree).not.to.be.undefined;
  return tree!;
}

describe("mirukuru TileTree", () => {
  let imodel: IModelConnection;

  before(async () => {
    imodel = await IModelConnection.openSnapshot(path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/mirukuru.ibim"));
    MockRender.App.startup();
  });

  after(async () => {
    MockRender.App.shutdown();
    if (imodel) await imodel.closeSnapshot();
  });

  // mirukuru contains a model (ID 0x1C) containing a single rectangle.
  // confirm we can obtain and deserialize contents of that tile, and that it is a leaf tile.
  it("should obtain a single leaf tile", async () => {
    const modelProps = await imodel.models.getProps("0x1c");
    expect(modelProps.length).to.equal(1);

    const treeProps = await imodel.tiles.getTileTreeProps(modelProps[0].id!);
    expect(treeProps.id).to.equal(modelProps[0].id);
    expect(treeProps.rootTile).not.to.be.undefined;

    const rootTile = treeProps.rootTile;
    expect(rootTile.isLeaf).not.to.be.true; // the backend will only set this to true if the tile range contains no elements.

    const loader = new IModelTile.Loader(imodel, treeProps.formatVersion, BatchType.Primary);
    const tree = new TileTree(TileTree.Params.fromJSON(treeProps, imodel, true, loader, "0x1c"));

    const response: TileRequest.Response = await loader.requestTileContent(tree.rootTile);
    expect(response).not.to.be.undefined;
    expect(response).instanceof(Uint8Array);

    const isCanceled = () => false; // Our tile has no Request, therefore not considered in "loading" state, so would be immediately treated as "canceled" during loading...
    const gfx = await loader.loadTileContent(tree.rootTile, response as Uint8Array, isCanceled);
    expect(gfx).not.to.be.undefined;
    expect(gfx.graphic).not.to.be.undefined;
    expect(gfx.isLeaf).to.be.true;
    expect(gfx.contentRange).not.to.be.undefined;
    expect(gfx.contentRange!.isNull).to.be.false;

    const projExt = imodel.projectExtents;
    expect(projExt.maxLength()).to.equal(gfx.contentRange!.maxLength());
  });

  it("should load model's tile tree asynchronously", async () => {
    const tree = getTileTree(imodel, "0x1c")!;
    expect(tree).not.to.be.undefined;
  });

  it("should have expected metadata for root tile", async () => {
    const tree = await getTileTree(imodel, "0x1c")!;
    expect(tree).not.to.be.undefined;
    const response = await tree.loader.requestTileContent(tree.rootTile);
    expect(response).instanceof(Uint8Array);

    // The model contains a single rectangular element.
    const stream = new TileIO.StreamBuffer((response as Uint8Array).buffer);
    const header = new IModelTileIO.Header(stream);
    expect(header.isValid).to.be.true;
    expect(header.format).to.equal(TileIO.Format.IModel);
    expect(header.version).to.equal(IModelTileIO.CurrentVersion.Combined);
    expect(header.versionMajor).to.equal(IModelTileIO.CurrentVersion.Major);
    expect(header.versionMinor).to.equal(IModelTileIO.CurrentVersion.Minor);
    expect(header.flags).to.equal(IModelTileIO.Flags.None);
    expect(header.numElementsIncluded).to.equal(1);
    expect(header.numElementsExcluded).to.equal(0);

    const projExt = imodel.projectExtents;
    expect(projExt.xLength()).to.equal(header.contentRange.xLength());
    expect(projExt.yLength()).to.equal(header.contentRange.yLength());
    expect(header.contentRange.zLength()).to.equal(0); // project extents are chubbed up; content range is tight.
  });

  it("should retry tile requests on server timeout error", async () => {
    let treeCounter = 0;
    let tileCounter = 0;
    const numRetries = 3;

    const getTileTreeProps = imodel.tiles.getTileTreeProps;
    imodel.tiles.getTileTreeProps = async () => {
      ++treeCounter;
      if (treeCounter >= numRetries)
        imodel.tiles.getTileTreeProps = getTileTreeProps;

      throw new ServerTimeoutError(504, "fake timeout");
    };

    const getTileContent = imodel.tiles.getTileContent;
    imodel.tiles.getTileContent = async () => {
      ++tileCounter;
      if (tileCounter >= numRetries)
        imodel.tiles.getTileContent = getTileContent;

      throw new ServerTimeoutError(504, "fake timeout");
    };

    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      await vp.waitForAllTilesToRender();
      expect(tileCounter).to.equal(numRetries);
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);
      expect(treeCounter).to.equal(numRetries);
    });
  });
});
