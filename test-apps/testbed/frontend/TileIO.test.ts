/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TileIO, IModelTileIO, IModelTileLoader, TileTree, TileRequest } from "@bentley/imodeljs-frontend/lib/tile";
import { SurfaceType } from "@bentley/imodeljs-frontend/lib/rendering";
import { Batch, MeshGraphic, GraphicsArray, PolylinePrimitive, PolylineGeometry } from "@bentley/imodeljs-frontend/lib/webgl";
import { ModelProps, RelatedElementProps, FeatureIndexType, BatchType } from "@bentley/imodeljs-common";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { TileData } from "./TileIO.data";
import * as path from "path";
import { CONSTANTS } from "../common/Testbed";
import { RenderGraphic, IModelApp, IModelConnection, GeometricModelState } from "@bentley/imodeljs-frontend";
import { WebGLTestContext } from "./WebGLTestContext";
import { MockRender } from "./MockRender";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

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

const rectangle = TileData.rectangle.buffer;

async function processRectangle(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new TileIO.StreamBuffer(rectangle);
  const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem);
  expect(reader).not.to.be.undefined;

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

    expect(result.renderGraphic).not.to.be.undefined;
    processGraphic(result.renderGraphic!);
  }
}

async function processTriangles(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  const triangles = TileData.triangles.buffer;
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new TileIO.StreamBuffer(triangles);
  const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem);
  expect(reader).not.to.be.undefined;

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

    expect(result.renderGraphic).not.to.be.undefined;
    processGraphic(result.renderGraphic!);
  }
}

async function processLineString(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  const lineString = TileData.lineString.buffer;
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new TileIO.StreamBuffer(lineString);
  const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem);
  expect(reader).not.to.be.undefined;

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

    expect(result.renderGraphic).not.to.be.undefined;
    processGraphic(result.renderGraphic!);
  }
}

async function processLineStrings(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  const lineStrings = TileData.lineStrings.buffer;
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new TileIO.StreamBuffer(lineStrings);
  const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem);
  expect(reader).not.to.be.undefined;

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

    expect(result.renderGraphic).not.to.be.undefined;
    processGraphic(result.renderGraphic!);
  }
}

async function processCylinder(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  const cylinder = TileData.cylinder.buffer;
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new TileIO.StreamBuffer(cylinder);
  const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem);
  expect(reader).not.to.be.undefined;

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

    expect(result.renderGraphic).not.to.be.undefined;
    processGraphic(result.renderGraphic!);
  }
}

// ###TODO: TileIO.data.ts contains tiles in old format. Update it. (The tests below continue to pass, but could exercise more of the tile contents).
// These tests require the real (webgl-based) RenderSystem. Won't execute in Windows CI job due to electron bug.
describe("TileIO (WebGL)", () => {
  let imodel: IModelConnection;

  before(async () => {
    imodel = await IModelConnection.openStandalone(iModelLocation);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("should read an iModel tile containing a single rectangle", async () => {
    if (WebGLTestContext.isInitialized) {
      await processRectangle(imodel, (graphic) => {
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
      await processTriangles(imodel, (graphic) => {
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
      await processLineString(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.featureTable.numFeatures).to.equal(1);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(PolylinePrimitive);
        const plinePrim = batch.graphic as PolylinePrimitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.Uniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.isPlanar).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        const plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);
      });
    }
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    if (WebGLTestContext.isInitialized) {
      await processLineStrings(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.numFeatures).to.equal(3);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsArray);
        const list = batch.graphic as GraphicsArray;
        expect(list.graphics.length).to.equal(2);

        expect(list.graphics[0]).to.be.instanceOf(PolylinePrimitive);
        let plinePrim = list.graphics[0] as PolylinePrimitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.Uniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.isPlanar).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        let plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);

        expect(list.graphics[1]).to.be.instanceOf(PolylinePrimitive);
        plinePrim = list.graphics[1] as PolylinePrimitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.NonUniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.isPlanar).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(228); // 120 pre-tesselation...
        expect(plGeom.lut.numVertices).to.equal(12);
        expect(plGeom.lineCode).to.equal(2);
        expect(plGeom.lineWeight).to.equal(9);
      });
    }
  });

  it("should read an iModel tile containing edges and silhouettes", async () => {
    if (WebGLTestContext.isInitialized) {
      await processCylinder(imodel, (graphic) => {
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
    imodel = await IModelConnection.openStandalone(iModelLocation);
    MockRender.App.startup();
  });

  after(async () => {
    MockRender.App.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("should read tile headers", () => {
    const stream = new TileIO.StreamBuffer(rectangle);
    stream.reset();
    const header = new IModelTileIO.Header(stream);
    expect(header.isValid).to.be.true;
    expect(header.format).to.equal(TileIO.Format.IModel);
    expect(header.version).to.equal(0);
    expect(header.flags).to.equal(IModelTileIO.Flags.None);
    expect(header.length).to.equal(TileData.rectangle.length);

    // content range is relative to tileset origin at (0, 0, 0)
    const low = header.contentRange.low;
    expect(delta(low.x, -2.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -5.0)).to.be.lessThan(0.0005);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = header.contentRange.high;
    expect(delta(high.x, 2.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 5.0)).to.be.lessThan(0.0005);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);
  });

  it("should support canceling operation", async () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(rectangle);
      const reader = IModelTileIO.Reader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem, BatchType.Primary, (_) => true);
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
    await processRectangle(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).instanceof(MockRender.Graphic);
    });
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", async () => {
    await processTriangles(imodel, (graphic) => {
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
    await processLineString(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.featureTable.numFeatures).to.equal(1);
      expect(batch.graphic).not.to.be.undefined;
    });
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    await processLineStrings(imodel, (graphic) => {
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
    await processCylinder(imodel, (graphic) => {
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
    tree = model.getOrLoadTileTree();
    return undefined !== tree;
  });

  expect(tree).not.to.be.undefined;
  return tree!;
}

describe("mirukuru TileTree", () => {
  let imodel: IModelConnection;

  before(async () => {
    imodel = await IModelConnection.openStandalone(path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/mirukuru.ibim"));
    MockRender.App.startup();
  });

  after(async () => {
    MockRender.App.shutdown();
    if (imodel) await imodel.closeStandalone();
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

    const loader = new IModelTileLoader(imodel, BatchType.Primary);
    const tree = new TileTree(TileTree.Params.fromJSON(treeProps, imodel, true, loader, "0x1c"));

    const response: TileRequest.Response = await loader.requestTileContent(tree.rootTile);
    expect(response).not.to.be.undefined;
    expect(response).instanceof(Uint8Array);

    const isCanceled = () => false; // Our tile has no Request, therefore not considered in "loading" state, so would be immediately treated as "canceled" during loading...
    const gfx = await loader.loadTileGraphic(tree.rootTile, response as Uint8Array, isCanceled);
    expect(gfx).not.to.be.undefined;
    expect(gfx.renderGraphic).not.to.be.undefined;
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
    expect(header.version).to.equal(0);
    expect(header.flags).to.equal(IModelTileIO.Flags.None);
    expect(header.numElementsIncluded).to.equal(1);
    expect(header.numElementsExcluded).to.equal(0);

    const projExt = imodel.projectExtents;
    expect(projExt.xLength()).to.equal(header.contentRange.xLength());
    expect(projExt.yLength()).to.equal(header.contentRange.yLength());
    expect(header.contentRange.zLength()).to.equal(0); // project extents are chubbed up; content range is tight.
  });
});
