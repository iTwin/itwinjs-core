/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ByteStream, Id64, Id64String, ProcessDetector } from "@itwin/core-bentley";
import {
  BatchType, CurrentImdlVersion, EdgeOptions, EmptyLocalization, ImdlFlags, ImdlHeader, IModelReadRpcInterface, IModelRpcProps, IModelTileRpcInterface, IModelTileTreeId, iModelTileTreeIdToString,
  ModelProps, PackedFeatureTable, RelatedElementProps, RenderMode, TileContentSource, TileFormat, TileReadStatus, ViewFlags,
} from "@itwin/core-common";
import {
  GeometricModelState, ImdlReader, IModelApp, IModelConnection, IModelTileContent, IModelTileTree, iModelTileTreeParamsFromJSON, MockRender,
  RenderGraphic, TileAdmin, TileRequest, TileTreeLoadStatus, ViewState,
} from "@itwin/core-frontend";
import { ImdlModel } from "@itwin/core-frontend/lib/cjs/common/imdl/ImdlModel";
import { parseImdlDocument } from "@itwin/core-frontend/lib/cjs/common/imdl/ParseImdlDocument";
import { SurfaceType } from "@itwin/core-frontend/lib/cjs/common/internal/render/SurfaceParams";
import { Batch, GraphicsArray, MeshGraphic, PolylineGeometry, Primitive, RenderOrder } from "@itwin/core-frontend/lib/cjs/webgl";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { TestRpcInterface } from "../../../common/RpcInterfaces";
import { TestUtility } from "../../TestUtility";
import { TestSnapshotConnection } from "../../TestSnapshotConnection";
import { TileTestCase, TileTestData } from "./data/TileIO.data";
import { TILE_DATA_1_1 } from "./data/TileIO.data.1.1";
import { TILE_DATA_1_2 } from "./data/TileIO.data.1.2";
import { TILE_DATA_1_3 } from "./data/TileIO.data.1.3";
import { TILE_DATA_1_4 } from "./data/TileIO.data.1.4";
import { TILE_DATA_2_0 } from "./data/TileIO.data.2.0";
import { changeHeaderLength, changeMajorVersion, changeMinorVersion } from "./data/TileIO.data.fake";

/* eslint-disable @typescript-eslint/unbound-method */

const testCases = [
  TILE_DATA_1_1,
  TILE_DATA_1_2,
  TILE_DATA_1_3,
  TILE_DATA_1_4,
  TILE_DATA_2_0,
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
  public override get is2d(): boolean { return !this.is3d; }
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

export function fakeViewState(iModel: IModelConnection, options?: { visibleEdges?: boolean, renderMode?: RenderMode, is2d?: boolean, animationId?: Id64String }): ViewState {
  return {
    iModel,
    is3d: () => true !== options?.is2d,
    viewFlags: new ViewFlags({
      renderMode: options?.renderMode ?? RenderMode.SmoothShade,
      visibleEdges: options?.visibleEdges ?? false,
    }),
    displayStyle: { },
  } as unknown as ViewState;
}

function delta(a: number, b: number): number {
  return Math.abs(a - b);
}
type ProcessGraphic = (graphic: RenderGraphic) => void;

function processHeader(data: TileTestData, test: TileTestCase, numElements: number) {
  const stream = ByteStream.fromUint8Array(test.bytes);
  stream.reset();
  const header = new ImdlHeader(stream);
  expect(header.isValid).to.be.true;
  expect(header.format).to.equal(TileFormat.IModel);
  expect(header.versionMajor).to.equal(data.versionMajor);
  expect(header.versionMinor).to.equal(data.versionMinor);
  expect(header.headerLength).to.equal(data.headerLength);
  expect(header.tileLength).to.equal(test.bytes.byteLength);
  expect(header.flags).to.equal(test.flags);
  expect(header.numElementsIncluded).to.equal(numElements);
  expect(header.numElementsExcluded).to.equal(0);
  expect(header.isReadableVersion).to.equal(!data.unreadable);
}

async function readTile(imodel: IModelConnection, data: TileTestData, test: TileTestCase): Promise<IModelTileContent | undefined> {
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = ByteStream.fromUint8Array(test.bytes);
  const reader = ImdlReader.create({
    stream,
    iModel: imodel,
    modelId: model.id,
    is3d: model.is3d,
    system: IModelApp.renderSystem,
  });

  const result = await reader.read();
  if (result.readStatus === TileReadStatus.Success)
    return result;

  expect(data.unreadable).to.be.true;
  return undefined;
}

async function processRectangle(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.rectangle, 1);
  const result = await readTile(imodel, data, data.rectangle);
  if (undefined !== result) {
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
  const result = await readTile(imodel, data, data.triangles);
  if (result) {
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
  const result = await readTile(imodel, data, data.lineString);
  if (result) {
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
  const result = await readTile(imodel, data, data.lineStrings);
  if (result) {
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
  const result = await readTile(imodel, data, data.cylinder);
  if (result) {
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
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  function getFeatureTable(batch: Batch): PackedFeatureTable {
    expect(batch.featureTable).instanceof(PackedFeatureTable);
    return batch.featureTable as PackedFeatureTable;
  }

  function expectNumFeatures(batch: Batch, expected: number): void {
    const table = getFeatureTable(batch);
    expect(table.numFeatures).to.equal(expected);
    expect(table.isUniform).to.equal(expected === 1);
  }

  it("should read an iModel tile containing a single rectangle", async () => {
    if (IModelApp.initialized) {
      await processEachRectangle(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expectNumFeatures(batch, 1);
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
    if (IModelApp.initialized) {
      await processEachTriangles(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expectNumFeatures(batch, 6);
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
    if (IModelApp.initialized) {
      await processEachLineString(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expectNumFeatures(batch, 1);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(Primitive);
        const plinePrim = batch.graphic as Primitive;
        expect(plinePrim.hasFeatures).to.be.true;
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(RenderOrder.Linear);
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
    if (IModelApp.initialized) {
      await processEachLineStrings(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expectNumFeatures(batch, 3);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsArray);
        const list = batch.graphic as GraphicsArray;
        expect(list.graphics.length).to.equal(2);

        expect(list.graphics[0]).to.be.instanceOf(Primitive);
        let plinePrim = list.graphics[0] as Primitive;
        expect(plinePrim.hasFeatures).to.be.true;
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(RenderOrder.Linear);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        let plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;

        expect(list.graphics[1]).to.be.instanceOf(Primitive);
        plinePrim = list.graphics[1] as Primitive;
        expect(plinePrim.hasFeatures).to.be.true;
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(RenderOrder.Linear);
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
    if (IModelApp.initialized) {
      await processEachCylinder(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expectNumFeatures(batch, 1);
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
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  function getFeatureTable(batch: MockRender.Batch): PackedFeatureTable {
    expect(batch.featureTable).instanceof(PackedFeatureTable);
    return batch.featureTable as PackedFeatureTable;
  }

  function expectNumFeatures(batch: MockRender.Batch, expected: number): void {
    const table = getFeatureTable(batch);
    expect(table.numFeatures).to.equal(expected);
    expect(table.isUniform).to.equal(expected === 1);
  }

  it("should support canceling operation", async () => {
    if (IModelApp.initialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = ByteStream.fromUint8Array(currentTestCase.rectangle.bytes);
      const reader = ImdlReader.create({
        stream,
        iModel: model.iModel,
        modelId: model.id,
        is3d: model.is3d,
        system: IModelApp.renderSystem,
        type: BatchType.Primary,
        loadEdges: true,
        isCanceled: () => true,
      });

      expect(reader).not.to.be.undefined;

      const result = await reader.read();
      expect(result.readStatus).to.equal(TileReadStatus.Canceled);
    }
  });

  it("should obtain tiles from backend", async () => {
    // This data set contains 4 physical models: 0x1c (empty), 0x22, 0x23, and 0x24. The latter 3 collectively contain 4 spheres.
    const modelProps = await imodel.models.getProps("0x22");
    expect(modelProps.length).to.equal(1);

    const tree = await IModelApp.tileAdmin.requestTileTreeProps(imodel, modelProps[0].id!.toString());

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
      expectNumFeatures(batch, 1);
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).instanceof(MockRender.Graphic);
    });
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", async () => {
    await processEachTriangles(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expectNumFeatures(batch, 6);
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
      expectNumFeatures(batch, 1);
      expect(batch.graphic).not.to.be.undefined;
    });
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    await processEachLineStrings(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expectNumFeatures(batch, 3);
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
      expectNumFeatures(batch, 1);
      expect(batch.graphic).not.to.be.undefined;
    });
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  if (condition())
    return;

  await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
  return waitUntil(condition);
}

async function getGeometricModel(imodel: IModelConnection, modelId: Id64String): Promise<GeometricModelState> {
  await imodel.models.load(modelId);
  const baseModel = imodel.models.getLoaded(modelId)!;
  expect(baseModel).not.to.be.undefined;
  const model = baseModel.asGeometricModel!;
  expect(model).not.to.be.undefined;
  return model;
}

async function getTileTree(imodel: IModelConnection, modelId: Id64String, edgesRequired = true, animationId?: Id64String): Promise<IModelTileTree> {
  const model = await getGeometricModel(imodel, modelId);
  return getPrimaryTileTree(model, edgesRequired, animationId);
}

async function getPrimaryTileTree(model: GeometricModelState, edgesRequired = true, animationId?: Id64String): Promise<IModelTileTree> {
  // tile tree reference wants a ViewState so it can check viewFlags.edgesRequired() and for access to its IModelConnection.
  // ###TODO Make that an interface instead of requiring a ViewState.
  const view = fakeViewState(model.iModel, { animationId, visibleEdges: edgesRequired });
  const ref = model.createTileTreeReference(view);
  const owner = ref.treeOwner;
  owner.load();
  await waitUntil(() => {
    return TileTreeLoadStatus.Loaded === owner.loadStatus;
  });

  const tree = owner.tileTree;
  expect(tree).not.to.be.undefined;
  return tree! as IModelTileTree;
}

describe("mirukuru TileTree", () => {
  let imodel: IModelConnection;

  class TestTarget extends MockRender.OnScreenTarget {
    public override setRenderToScreen(toScreen: boolean): HTMLCanvasElement | undefined {
      return toScreen ? document.createElement("canvas") : undefined;
    }
  }

  class TestSystem extends MockRender.System {
    public override createTarget(canvas: HTMLCanvasElement): TestTarget { return new TestTarget(this, canvas); }
  }

  before(async () => {
    MockRender.App.systemFactory = () => new TestSystem();

    // electron version of certa doesn't serve worker scripts.
    const isElectron = ProcessDetector.isElectronAppFrontend;
    const tileAdmin = isElectron ? { decodeImdlInWorker: false } : undefined;

    await MockRender.App.startup({ tileAdmin });
    if (ProcessDetector.isElectronAppFrontend) {
      await ElectronApp.startup({
        iModelApp: {
          localization: new EmptyLocalization(),
          rpcInterfaces: [IModelReadRpcInterface, IModelTileRpcInterface, TestRpcInterface],
          tileAdmin,
        },
      });
    }

    imodel = await TestSnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  afterEach(() => {
    if (imodel) {
      // Ensure tiles are not in memory...
      // NB: purge() does not suffice - we have to discard the suppliers and their TreeOwners too, because geometryGuid.
      // NB: dispose() is not right either - that permanently sets a flag that TileRequests check to determine if they should be cancelled.
      // reset() is like dispose() except it does not set that flag.
      imodel.tiles.reset();

      // Reset statistics...
      IModelApp.tileAdmin.resetStatistics();
    }
  });

  after(async () => {
    await imodel?.close();
    await MockRender.App.shutdown();
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.shutdown();
  });

  // mirukuru contains a model (ID 0x1C) containing a single rectangle.
  // confirm we can obtain and deserialize contents of that tile, and that it is a leaf tile.
  it("should obtain a single leaf tile", async () => {
    const modelProps = await imodel.models.getProps("0x1c");
    expect(modelProps.length).to.equal(1);

    const treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, modelProps[0].id!);
    expect(treeProps.id).to.equal(modelProps[0].id);
    expect(treeProps.rootTile).not.to.be.undefined;

    const rootTile = treeProps.rootTile;
    expect(rootTile.isLeaf).not.to.be.true; // the backend will only set this to true if the tile range contains no elements.

    const edges = { smooth: false, type: "non-indexed" as const };
    const options = { is3d: true, batchType: BatchType.Primary, edges, allowInstancing: true, timeline: undefined };
    const params = iModelTileTreeParamsFromJSON(treeProps, imodel, "0x1c", options);
    const tree = new IModelTileTree(params, { edges, type: BatchType.Primary });

    const response: TileRequest.Response = await tree.staticBranch.requestContent();
    expect(response).not.to.be.undefined;
    expect(response).instanceof(Uint8Array);

    const isCanceled = () => false; // Our tile has no Request, therefore not considered in "loading" state, so would be immediately treated as "canceled" during loading...
    const gfx = await tree.staticBranch.readContent(response as Uint8Array, IModelApp.renderSystem, isCanceled);
    expect(gfx).not.to.be.undefined;
    expect(gfx.graphic).not.to.be.undefined;
    expect(gfx.isLeaf).to.be.true;
    expect(gfx.contentRange).not.to.be.undefined;
    expect(gfx.contentRange!.isNull).to.be.false;

    const projExt = imodel.projectExtents;
    expect(projExt.maxLength()).to.equal(gfx.contentRange!.maxLength());
  });

  it("should load model's tile tree asynchronously", async () => {
    const tree = getTileTree(imodel, "0x1c");
    expect(tree).not.to.be.undefined;
  });

  it("should have expected metadata for root tile", async () => {
    const test = async (tree: IModelTileTree, expectedVersion: number, expectedRootContentId: string) => {
      expect(tree).not.to.be.undefined;
      expect(tree.staticBranch.contentId).to.equal(expectedRootContentId);
      const response = await tree.staticBranch.requestContent();
      expect(response).instanceof(Uint8Array);

      // The model contains a single rectangular element.
      const stream = ByteStream.fromUint8Array(response as Uint8Array);
      const header = new ImdlHeader(stream);
      expect(header.isValid).to.be.true;
      expect(header.format).to.equal(TileFormat.IModel);
      expect(header.version).to.equal(expectedVersion);
      expect(header.versionMajor).to.equal(expectedVersion >> 0x10);
      expect(header.versionMinor).to.equal(expectedVersion & 0xffff);
      expect(header.flags).to.equal(ImdlFlags.None);
      expect(header.numElementsIncluded).to.equal(1);
      expect(header.numElementsExcluded).to.equal(0);

      const projExt = imodel.projectExtents;
      expect(projExt.xLength()).to.equal(header.contentRange.xLength());
      expect(projExt.yLength()).to.equal(header.contentRange.yLength());
      expect(header.contentRange.zLength()).to.deep.equalWithFpTolerance(0); // project extents are chubbed up; content range is tight.
    };

    // Test current version of tile tree by asking model to load it
    const modelTree = await getTileTree(imodel, "0x1c");
    await test(modelTree, CurrentImdlVersion.Combined, "-b-0-0-0-0-1");

    // Test directly loading a tile tree of version 3.0
    const v3Props = await IModelApp.tileAdmin.requestTileTreeProps(imodel, "0x1c");
    expect(v3Props).not.to.be.undefined;

    const edges = false as const;
    const options = { is3d: true, batchType: BatchType.Primary, edges, allowInstancing: false, timeline: undefined };
    const params = iModelTileTreeParamsFromJSON(v3Props, imodel, "0x1c", options);

    const v3Tree = new IModelTileTree(params, { edges: false, type: BatchType.Primary });
    await test(v3Tree, 0x00030000, "_3_0_0_0_0_0_1");
  });

  it("should use a different tile tree when view flags change", async () => {
    const modelId = "0x1c";
    await imodel.models.load(modelId);
    const model = imodel.models.getLoaded(modelId) as GeometricModelState;

    const viewState = fakeViewState(imodel);
    const treeRef = model.createTileTreeReference(viewState);
    const noEdges = treeRef.treeOwner;

    viewState.viewFlags = viewState.viewFlags.with("visibleEdges", true);
    const edges = treeRef.treeOwner;
    expect(edges).not.to.equal(noEdges);

    const edges2 = treeRef.treeOwner;
    expect(edges2).to.equal(edges);

    viewState.viewFlags = viewState.viewFlags.with("visibleEdges", false);
    const noEdges2 = treeRef.treeOwner;
    expect(noEdges2).to.equal(noEdges);
  });
});

// Temporarily skipped while we investigate sporadic apparent crash during Linux CI jobs. Occurs in Electron only, not Chrome.
describe("TileAdmin", () => {
  let theIModel: IModelConnection | undefined;

  const cleanup = async () => {
    if (theIModel) {
      await theIModel.close();
      theIModel = undefined;
    }

    if (IModelApp.initialized)
      await TestUtility.shutdownFrontend();
  };

  after(async () => {
    await cleanup();
  });

  class TileAdminApp extends MockRender.App {
    public static async start(props: TileAdmin.Props): Promise<IModelConnection> {
      await cleanup();

      // The default is true which changes the expected tile tree Ids. Not relevant to these tests.
      props.expandProjectExtents = false;

      if (ProcessDetector.isElectronAppFrontend) {
        // certa doesn't serve worker script.
        props.decodeImdlInWorker = false;
      }

      await super.startup({
        tileAdmin: props,
        localization: new EmptyLocalization(),
        rpcInterfaces: [IModelReadRpcInterface, IModelTileRpcInterface, TestRpcInterface],
      });

      if (ProcessDetector.isElectronAppFrontend) {
        await ElectronApp.startup({
          iModelApp: {
            tileAdmin: props,
            localization: new EmptyLocalization(),
            rpcInterfaces: [IModelReadRpcInterface, IModelTileRpcInterface, TestRpcInterface],
          },
        });
      }

      theIModel = await TestSnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
      return theIModel;
    }

    public static async restart(props: TileAdmin.Props): Promise<IModelConnection> {
      await this.stop();
      return this.start(props);
    }

    public static async stop() {
      if (undefined !== theIModel) {
        await theIModel.close();
        theIModel = undefined;
      }

      await TestUtility.shutdownFrontend();
    }
  }

  it("should omit or load edges based on configuration and view flags", async () => {
    class App extends TileAdminApp {
      private static async rootTileHasEdges(tree: IModelTileTree): Promise<boolean> {
        const response = await tree.staticBranch.requestContent() as Uint8Array;
        expect(response).not.to.be.undefined;
        expect(response).instanceof(Uint8Array);

        const document = parseImdlDocument({
          data: response,
          batchModelId: "0x1c",
          is3d: true,
          maxVertexTableSize: IModelApp.renderSystem.maxTextureSize,
          timeline: undefined,
        }) as ImdlModel.Document;

        expect(typeof document).to.equal("object");
        return document.nodes.some((node) => node.primitives && node.primitives.some((primitive) => primitive.type === "mesh" && undefined !== primitive.params.edges));
      }

      public static async test(imodel: IModelConnection) {
        const expectTreeId = async (edges: EdgeOptions | false, expectedTreeIdStr: string) => {
          const treeId: IModelTileTreeId = { type: BatchType.Primary, edges };
          const actualTreeIdStr = iModelTileTreeIdToString("0x1c", treeId, IModelApp.tileAdmin);
          expect(actualTreeIdStr).to.equal(expectedTreeIdStr);

          const treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, actualTreeIdStr);
          expect(treeProps.id).to.equal(actualTreeIdStr);

          const tree = await getTileTree(imodel, "0x1c", false !== edges);
          expect(tree.id).to.equal(actualTreeIdStr);

          const tree2 = await getTileTree(imodel, "0x1c", false !== edges);
          expect(tree2).to.equal(tree);

          expect(await this.rootTileHasEdges(tree)).to.equal(false !== edges);
        };

        const version = CurrentImdlVersion.Major.toString(16);
        await expectTreeId(false, `${version}_d-E:0_0x1c`);
        await expectTreeId({ type: "compact" as const, smooth: true }, `${version}_d-E:6_0x1c`);
      }
    }

    // NB: We used to be able to configure TileAdmin to omit (or not omit) edges from requested tiles. That option was removed when we were satisfied with the feature.
    const myImodel = await App.start({});
    await App.test(myImodel);
    await App.stop();
  });

  it("should honor maximum major tile format version", async () => {
    class App extends TileAdminApp {
      public static async testMajorVersion(maximumMajorTileFormatVersion: number | undefined, expectedMajorVersion: number): Promise<void> {
        const imodel = await App.start({ maximumMajorTileFormatVersion });
        let treeId = "0x1c";
        if (undefined === maximumMajorTileFormatVersion || maximumMajorTileFormatVersion >= 4) {
          const v = undefined !== maximumMajorTileFormatVersion ? maximumMajorTileFormatVersion : CurrentImdlVersion.Major;
          treeId = `${v.toString(16)}_1-0x1c`;
        }

        const tree = await IModelApp.tileAdmin.requestTileTreeProps(imodel, treeId);

        expect(tree).not.to.be.undefined;
        expect(tree.id).to.equal(treeId);
        expect(tree.formatVersion).not.to.be.undefined;

        const majorVersion = (tree.formatVersion!) >>> 0x10;
        expect(majorVersion).to.equal(expectedMajorVersion);

        // Old root content Id supplied strictly for very old front-ends - newer front-ends compute root content Id based on major version + flags
        expect(tree.rootTile.contentId).to.equal("0/0/0/0/1");

        await App.stop();
      }
    }

    // Versions prior to 3 use old (un-versioned) Id format
    await App.testMajorVersion(3, 3);
    // Because of above, requesting a max version < 4 produces version 3
    await App.testMajorVersion(1, 3);
    // Request a specifc major version > 3
    await App.testMajorVersion(4, 4);
    // Request whatever the current major version is.
    // If the below test fails, we probably bumped current major version in native code and did not do so in typescript.
    await App.testMajorVersion(undefined, CurrentImdlVersion.Major);
  });

  it("should form expected content request", async () => {
    class App extends TileAdminApp {
      public static async test(useProjectExtents: boolean): Promise<void> {
        const imodel = await App.start({ useProjectExtents });

        const flags = useProjectExtents ? "1" : "0";
        const treeId = `8_${flags}-0x1c`;

        const treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, treeId);
        const qualifier = treeProps.contentIdQualifier;
        expect(qualifier !== undefined).to.equal(useProjectExtents);
        if (undefined !== qualifier)
          expect(qualifier.length > 0).to.be.true;

        const edges = { type: "non-indexed" as const, smooth: false };
        const options = { is3d: true, batchType: BatchType.Primary, edges, allowInstancing: true, timeline: undefined };
        const params = iModelTileTreeParamsFromJSON(treeProps, imodel, "0x1c", options);
        const tree = new IModelTileTree(params, { edges, type: BatchType.Primary });

        const intfc = IModelTileRpcInterface.getClient();
        const generateTileContent = intfc.generateTileContent;
        intfc.generateTileContent = async (_token: IModelRpcProps, tileTreeId: string, _contentId: string, guid: string | undefined) => {
          expect(tileTreeId).to.equal(treeId);

          expect(guid).not.to.be.undefined;
          if (!useProjectExtents)
            expect(guid).to.equal("first");
          else
            expect(guid).to.equal(`first_${qualifier!}`);

          return TileContentSource.Backend;
        };

        await tree.staticBranch.requestContent();

        intfc.generateTileContent = generateTileContent;

        await App.stop();
      }
    }

    await App.test(false);
    await App.test(true);
  });
});
