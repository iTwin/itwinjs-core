/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TileIO, IModelTileIO } from "@bentley/imodeljs-frontend/lib/tile";
import { Mesh, DisplayParams, System, Batch, MeshGraphic, GraphicsList, SurfaceType, PolylinePrimitive, PolylineGeometry } from "@bentley/imodeljs-frontend/lib/rendering";
import { LinePixels, GeometryClass, ModelProps, RelatedElementProps, FeatureIndexType } from "@bentley/imodeljs-common";
import { Id64, Id64Props } from "@bentley/bentleyjs-core";
import { TileData } from "./TileIO.data";
import { Point3d, Vector3d } from "@bentley/geometry-core";
import * as path from "path";
import { CONSTANTS } from "../common/Testbed";
import { IModelConnection, GeometricModelState } from "@bentley/imodeljs-frontend";
import { WebGLTestContext } from "./WebGLTestContext";

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
  public id: Id64Props;
  public constructor() { this.id = Id64.invalidId; }
}

function delta(a: number, b: number): number { return Math.abs(a - b); }

describe("TileIO", () => {
  let imodel: IModelConnection;
  const rectangle = TileData.rectangle.buffer;
  const triangles = TileData.triangles.buffer;
  const lineString = TileData.lineString.buffer;
  const lineStrings = TileData.lineStrings.buffer;
  const cylinder = TileData.cylinder.buffer;

  before(async () => {   // Create a ViewState to load into a Viewport
    imodel = await IModelConnection.openStandalone(iModelLocation);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("should read tile headers", () => {
    const stream = new TileIO.StreamBuffer(rectangle);
    stream.reset();
    const header = new IModelTileIO.Header(stream);
    expect(header.isValid).to.be.true;
    expect(header.format).to.equal(TileIO.Format.IModel);
    expect(header.version).to.equal(0);
    expect(header.flags).to.equal(IModelTileIO.Flags.IsLeaf);
    expect(header.length).to.equal(2392);

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

  it("should read an iModel tile containing a single rectangle", () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(rectangle);
      const reader = IModelTileIO.Reader.create(stream, model, System.instance);
      expect(reader).not.to.be.undefined;

      if (undefined !== reader) {
        const result = reader.read();
        expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
        expect(result.isLeaf).to.be.true;
        expect(result.contentRange).not.to.be.undefined;
        expect(result.geometry).not.to.be.undefined;

        // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
        const low = result.contentRange!.low;
        expect(delta(low.x, -2.5)).to.be.lessThan(0.0005);
        expect(delta(low.y, -5.0)).to.be.lessThan(0.0005);
        expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

        const high = result.contentRange!.high;
        expect(delta(high.x, 2.5)).to.be.lessThan(0.0005);
        expect(delta(high.y, 5.0)).to.be.lessThan(0.0005);
        expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

        // Confirm GeometryCollection
        const geom = result.geometry!;
        expect(geom.isEmpty).to.be.false;
        expect(geom.isComplete).to.be.true;
        expect(geom.isCurved).to.be.false;

        const meshes = geom.meshes;
        expect(meshes.length).to.equal(1);

        // Validate feature table (uniform - one element)
        const features = meshes.features!;
        expect(meshes.features).not.to.be.undefined;
        expect(features.length).to.equal(1);
        expect(features.isUniform).to.be.true;
        const feature = features.findFeature(0);
        expect(feature).not.to.be.undefined;
        expect(feature!.geometryClass).to.equal(GeometryClass.Primary);
        expect(feature!.elementId.value).to.equal("0x4e");
        expect(feature!.subCategoryId.value).to.equal("0x18");

        // Validate mesh data
        const mesh = meshes[0];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Mesh);
        expect(mesh.points.length).to.equal(4);
        expect(mesh.isPlanar).to.be.true;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(4);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(0);

        // Validate mesh triangles
        expect(mesh.triangles).not.to.be.undefined;
        expect(mesh.triangles!.length).to.equal(2);
        const indices = mesh.triangles!.indices;
        const expectedIndices = [0, 1, 2, 0, 2, 3];
        expect(indices.length).to.equal(6);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices[i]);

        // Validate color table (uniform - green)
        expect(mesh.colorMap.length).to.equal(1);
        expect(mesh.colorMap.isUniform).to.be.true;
        expect(mesh.colorMap.indexOf(0x0000ff00)).to.equal(0); // green is first and only color in color table
        expect(mesh.colors.length).to.equal(0);

        // Validate display params
        const displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Mesh);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(0x0000ff00);
        expect(displayParams.fillColor.tbgr).to.equal(0x0000ff00);
        expect(displayParams.width).to.equal(1);
        expect(displayParams.linePixels).to.equal(LinePixels.Solid);
        expect(displayParams.ignoreLighting).to.be.false;
        expect(displayParams.hasFillTransparency).to.be.false;
        expect(displayParams.hasLineTransparency).to.be.false;

        // Validate RenderGraphic
        const graphic = result.renderGraphic!;
        expect(graphic).not.to.be.undefined;
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
      }
    }
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(triangles);
      const reader = IModelTileIO.Reader.create(stream, model, System.instance);
      expect(reader).not.to.be.undefined;

      if (undefined !== reader) {
        const result = reader.read();
        expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
        expect(result.isLeaf).to.be.true;
        expect(result.contentRange).not.to.be.undefined;
        expect(result.geometry).not.to.be.undefined;

        // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
        const low = result.contentRange!.low;
        expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
        expect(delta(low.y, -10.0)).to.be.lessThan(0.00051);
        expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

        const high = result.contentRange!.high;
        expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
        expect(delta(high.y, 10.0)).to.be.lessThan(0.00051);
        expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

        // Confirm GeometryCollection
        const geom = result.geometry!;
        expect(geom.isEmpty).to.be.false;
        expect(geom.isComplete).to.be.true;
        expect(geom.isCurved).to.be.false;

        const meshes = geom.meshes;
        expect(meshes.length).to.equal(2);

        // Validate feature table (uniform - one element)
        const features = meshes.features!;
        expect(meshes.features).not.to.be.undefined;
        expect(features.length).to.equal(6);
        expect(features.isUniform).to.be.false;
        const expectedElementId = ["0x50", "0x53", "0x4f", "0x52", "0x4e", "0x51"];
        for (let i = 0; i < features.length; ++i) {
          const feature = features.findFeature(i);
          expect(feature).not.to.be.undefined;
          expect(feature!.geometryClass).to.equal(GeometryClass.Primary);
          expect(feature!.elementId.value).to.equal(expectedElementId[i]);
          expect(feature!.subCategoryId.value).to.equal("0x18");
        }

        // Validate mesh data for first mesh (3 triangles).
        let mesh = meshes[0];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Mesh);
        expect(mesh.points.length).to.equal(9);
        expect(mesh.isPlanar).to.be.true;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(9);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(9);
        const expectedFeatureIndices0 = [0, 0, 0, 2, 2, 2, 4, 4, 4];
        for (let i = 0; i < mesh.features!._indices.length; i++)
          expect(mesh.features!._indices[i]).to.equal(expectedFeatureIndices0[i]);

        // Validate mesh triangles
        expect(mesh.triangles).not.to.be.undefined;
        expect(mesh.triangles!.length).to.equal(3);
        let indices = mesh.triangles!.indices;
        const expectedIndices0 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        expect(indices.length).to.equal(9);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices0[i]);

        // Validate vertices and normals
        const pos0 = [
          Point3d.create(2.5, 0, 0), Point3d.create(2.5, 10, 0), Point3d.create(7.5, 0, 0),
          Point3d.create(-2.5, 0, 0), Point3d.create(-2.5, 10, 0), Point3d.create(2.5, 0, 0),
          Point3d.create(-7.5, 0, 0), Point3d.create(-7.5, 10, 0), Point3d.create(-2.5, 0, 0)];
        const norms = Vector3d.create(0, 0, -1);
        for (let i = 0; i < mesh.points.length; ++i) {
          const pnt = mesh.points.unquantize(i);
          const vec = mesh.normals[i].decode();
          expect(vec).to.not.be.undefined;
          expect(delta(pnt.x, pos0[i].x)).to.be.lessThan(0.00065);
          expect(delta(pnt.y, pos0[i].y)).to.be.lessThan(0.00065);
          expect(delta(pnt.z, pos0[i].z)).to.be.lessThan(0.00065);
          expect(delta(vec!.x, norms.x)).to.be.lessThan(0.00065);
          expect(delta(vec!.y, norms.y)).to.be.lessThan(0.00065);
          expect(delta(vec!.z, norms.z)).to.be.lessThan(0.00065);
        }

        // Validate color table (3 colors, red, green, blue - no alpha)
        expect(mesh.colorMap.length).to.equal(3);
        expect(mesh.colorMap.isUniform).to.be.false;
        expect(mesh.colorMap.hasTransparency).to.be.false;
        expect(mesh.colorMap.indexOf(0x00ff0000)).to.equal(0); // red is first color in color table
        expect(mesh.colorMap.indexOf(0x0000ff00)).to.equal(1); // green is 2nd color in color table
        expect(mesh.colorMap.indexOf(0x000000ff)).to.equal(2); // blue is 3rd color in color table
        expect(mesh.colors.length).to.equal(9);
        const expectedColors0 = [0, 0, 0, 1, 1, 1, 2, 2, 2];
        for (let i = 0; i < mesh.colors.length; i++)
          expect(mesh.colors[i]).to.equal(expectedColors0[i]);

        // Validate display params
        let displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Mesh);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(255);
        expect(displayParams.fillColor.tbgr).to.equal(255);
        expect(displayParams.width).to.equal(1);
        expect(displayParams.linePixels).to.equal(LinePixels.Solid);
        expect(displayParams.ignoreLighting).to.be.false;
        expect(displayParams.hasFillTransparency).to.be.false;
        expect(displayParams.hasLineTransparency).to.be.false;

        // Validate mesh data for second mesh (3 triangles)
        mesh = meshes[1];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Mesh);
        expect(mesh.points.length).to.equal(9);
        expect(mesh.isPlanar).to.be.true;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(9);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(9);
        const expectedFeatureIndices1 = [1, 1, 1, 3, 3, 3, 5, 5, 5];
        for (let i = 0; i < mesh.features!._indices.length; i++)
          expect(mesh.features!._indices[i]).to.equal(expectedFeatureIndices1[i]);

        // Validate mesh triangles
        expect(mesh.triangles).not.to.be.undefined;
        expect(mesh.triangles!.length).to.equal(3);
        indices = mesh.triangles!.indices;
        const expectedIndices1 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        expect(indices.length).to.equal(9);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices1[i]);

        // Validate vertices and normals
        const pos1 = [
          Point3d.create(2.5, -10, 0), Point3d.create(2.5, 0, 0), Point3d.create(7.5, -10, 0),
          Point3d.create(-2.5, -10, 0), Point3d.create(-2.5, 0, 0), Point3d.create(2.5, -10, 0),
          Point3d.create(-7.5, -10, 0), Point3d.create(-7.5, 0, 0), Point3d.create(-2.5, -10, 0)];
        for (let i = 0; i < mesh.points.length; ++i) {
          const pnt = mesh.points.unquantize(i);
          const vec = mesh.normals[i].decode();
          expect(vec).to.not.be.undefined;
          expect(delta(pnt.x, pos1[i].x)).to.be.lessThan(0.00065);
          expect(delta(pnt.y, pos1[i].y)).to.be.lessThan(0.00065);
          expect(delta(pnt.z, pos1[i].z)).to.be.lessThan(0.00065);
          expect(delta(vec!.x, norms.x)).to.be.lessThan(0.00065);
          expect(delta(vec!.y, norms.y)).to.be.lessThan(0.00065);
          expect(delta(vec!.z, norms.z)).to.be.lessThan(0.00065);
        }

        // Validate color table (uniform - green)
        expect(mesh.colorMap.length).to.equal(3);
        expect(mesh.colorMap.isUniform).to.be.false;
        expect(mesh.colorMap.hasTransparency).to.be.true;
        expect(mesh.colorMap.indexOf(0x7fff0000)).to.equal(0); // red is first color in color table
        expect(mesh.colorMap.indexOf(0x7f00ff00)).to.equal(1); // green is 2nd color in color table
        expect(mesh.colorMap.indexOf(0x7f0000ff)).to.equal(2); // blue is 3rd color in color table
        expect(mesh.colors.length).to.equal(9);
        const expectedColors1 = [0, 0, 0, 1, 1, 1, 2, 2, 2];
        for (let i = 0; i < mesh.colors.length; i++)
          expect(mesh.colors[i]).to.equal(expectedColors1[i]);

        // Validate display params
        displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Mesh);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(0x7f0000ff);
        expect(displayParams.fillColor.tbgr).to.equal(0x7f0000ff);
        expect(displayParams.width).to.equal(1);
        expect(displayParams.linePixels).to.equal(LinePixels.Solid);
        expect(displayParams.ignoreLighting).to.be.false;
        expect(displayParams.hasFillTransparency).to.be.true;
        expect(displayParams.hasLineTransparency).to.be.true;

        // Validate RenderGraphic
        const graphic = result.renderGraphic!;
        expect(graphic).not.to.be.undefined;
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.length).to.equal(6);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsList);
        const list = batch.graphic as GraphicsList;
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
      }
    }
  });

  it("should read an iModel tile containing single open yellow line string", () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(lineString);
      const reader = IModelTileIO.Reader.create(stream, model, System.instance);
      expect(reader).not.to.be.undefined;

      if (undefined !== reader) {
        const result = reader.read();
        expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
        expect(result.isLeaf).to.be.true;
        expect(result.contentRange).not.to.be.undefined;
        expect(result.geometry).not.to.be.undefined;

        // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
        const low = result.contentRange!.low;
        expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
        expect(delta(low.y, -10.0)).to.be.lessThan(0.00051);
        expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

        const high = result.contentRange!.high;
        expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
        expect(delta(high.y, 10.0)).to.be.lessThan(0.00051);
        expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

        // Confirm GeometryCollection
        const geom = result.geometry!;
        expect(geom.isEmpty).to.be.false;
        expect(geom.isComplete).to.be.true;
        expect(geom.isCurved).to.be.false;

        const meshes = geom.meshes;
        expect(meshes.length).to.equal(1);

        // Validate feature table (uniform - one element)
        const features = meshes.features!;
        expect(features).not.to.be.undefined;
        expect(features.length).to.equal(1);
        expect(features.isUniform).to.be.true;
        const feature = features.findFeature(0);
        expect(feature).not.to.be.undefined;
        expect(feature!.geometryClass).to.equal(GeometryClass.Primary);
        expect(feature!.elementId.value).to.equal("0x4e");
        expect(feature!.subCategoryId.value).to.equal("0x18");

        // Validate mesh data for first mesh (1 polyline).
        const mesh = meshes[0];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Polyline);
        expect(mesh.points.length).to.equal(6);
        expect(mesh.isPlanar).to.be.false;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(0);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(0);

        // Validate mesh polylines
        expect(mesh.triangles).to.be.undefined;
        expect(mesh.polylines).to.not.be.undefined;
        expect(mesh.polylines!.length).to.equal(1);
        const indices = mesh.polylines![0].indices;
        const expectedIndices0 = [0, 1, 2, 3, 4, 5];
        expect(indices.length).to.equal(6);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices0[i]);

        // Validate vertices and normals
        const pos = [
          Point3d.create(-7.5, 10, 0), Point3d.create(-7.5, -10, 0), Point3d.create(-2.5, 0, 0),
          Point3d.create(-2.5, 10, 0), Point3d.create(7.5, -10, 0), Point3d.create(7.5, 0, 0)];
        for (let i = 0; i < mesh.points.length; ++i) {
          const pnt = mesh.points.unquantize(i);
          expect(delta(pnt.x, pos[i].x)).to.be.lessThan(0.00065);
          expect(delta(pnt.y, pos[i].y)).to.be.lessThan(0.00065);
          expect(delta(pnt.z, pos[i].z)).to.be.lessThan(0.00065);
        }

        // Validate color table (uniform - yellow)
        expect(mesh.colorMap.isUniform).to.be.true;
        expect(mesh.colorMap.indexOf(0x0000ffff)).to.equal(0); // yellow is first and only color in color table
        expect(mesh.colors.length).to.equal(0);

        // Validate display params
        const displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Linear);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(0x0000ffff);
        expect(displayParams.fillColor.tbgr).to.equal(0x0000ffff);
        expect(displayParams.width).to.equal(9);
        expect(displayParams.linePixels).to.equal(LinePixels.Solid);
        expect(displayParams.hasFillTransparency).to.be.false;
        expect(displayParams.hasLineTransparency).to.be.false;

        // Validate RenderGraphic
        const graphic = result.renderGraphic!;
        expect(graphic).not.to.be.undefined;
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.featureTable.length).to.equal(1);
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
        expect(plGeom.numIndices).to.equal(60);
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.polyline.lineCode).to.equal(0);
        expect(plGeom.polyline.lineWeight).to.equal(9);
      }
    }
  });

  it("should read an iModel tile containing multiple line strings", () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(lineStrings);
      const reader = IModelTileIO.Reader.create(stream, model, System.instance);
      expect(reader).not.to.be.undefined;

      if (undefined !== reader) {
        const result = reader.read();
        expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
        expect(result.isLeaf).to.be.true;
        expect(result.contentRange).not.to.be.undefined;
        expect(result.geometry).not.to.be.undefined;

        // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
        const low = result.contentRange!.low;
        expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
        expect(delta(low.y, -30.0)).to.be.lessThan(0.0016);
        expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

        const high = result.contentRange!.high;
        expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
        expect(delta(high.y, 30.0)).to.be.lessThan(0.0016);
        expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

        // Confirm GeometryCollection
        const geom = result.geometry!;
        expect(geom.isEmpty).to.be.false;
        expect(geom.isComplete).to.be.true;
        expect(geom.isCurved).to.be.false;

        const meshes = geom.meshes;
        expect(meshes.length).to.equal(2);

        // Validate feature table (uniform - one element)
        const features = meshes.features!;
        expect(features).not.to.be.undefined;
        expect(features.length).to.equal(3);
        expect(features.isUniform).to.be.false;
        const expectedElementId = ["0x4e", "0x50", "0x4f"];
        for (let i = 0; i < features.length; ++i) {
          const feature = features.findFeature(i);
          expect(feature).not.to.be.undefined;
          expect(feature!.geometryClass).to.equal(GeometryClass.Primary);
          expect(feature!.elementId.value).to.equal(expectedElementId[i]);
          expect(feature!.subCategoryId.value).to.equal("0x18");
        }

        // Validate mesh data for first mesh (1 polyline).
        let mesh = meshes[0];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Polyline);
        expect(mesh.points.length).to.equal(6);
        expect(mesh.isPlanar).to.be.false;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(0);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(0);

        // Validate mesh polylines
        expect(mesh.triangles).to.be.undefined;
        expect(mesh.polylines).to.not.be.undefined;
        expect(mesh.polylines!.length).to.equal(1);
        let indices = mesh.polylines![0].indices;
        const expectedIndices0 = [0, 1, 2, 3, 4, 5];
        expect(indices.length).to.equal(6);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices0[i]);

        // Validate vertices and normals
        const pos0 = [
          Point3d.create(-7.5, -10, 0), Point3d.create(-7.5, -30, 0), Point3d.create(-2.5, -20, 0),
          Point3d.create(-2.5, -10, 0), Point3d.create(7.5, -30, 0), Point3d.create(7.5, -20, 0)];
        for (let i = 0; i < mesh.points.length; ++i) {
          const pnt = mesh.points.unquantize(i);
          expect(delta(pnt.x, pos0[i].x)).to.be.lessThan(0.00065);
          expect(delta(pnt.y, pos0[i].y)).to.be.lessThan(0.0018);
          expect(delta(pnt.z, pos0[i].z)).to.be.lessThan(0.00065);
        }

        // Validate color table (uniform - purple)
        expect(mesh.colorMap.isUniform).to.be.true;
        expect(mesh.colorMap.indexOf(0x00ff00ff)).to.equal(0);
        expect(mesh.colors.length).to.equal(0);

        // Validate display params
        let displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Linear);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(0x00ff00ff);
        expect(displayParams.fillColor.tbgr).to.equal(0x00ff00ff);
        expect(displayParams.width).to.equal(9);
        expect(displayParams.linePixels).to.equal(LinePixels.Solid);
        expect(displayParams.hasFillTransparency).to.be.false;
        expect(displayParams.hasLineTransparency).to.be.false;

        // Validate mesh data for second mesh (2 polylines).
        mesh = meshes[1];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Polyline);
        expect(mesh.points.length).to.equal(12);
        expect(mesh.isPlanar).to.be.false;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(0);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(12);
        const expectedFeatureIndices1 = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2];
        for (let i = 0; i < mesh.features!._indices.length; i++)
          expect(mesh.features!._indices[i]).to.equal(expectedFeatureIndices1[i]);

        // Validate mesh polylines
        expect(mesh.triangles).to.be.undefined;
        expect(mesh.polylines).to.not.be.undefined;
        expect(mesh.polylines!.length).to.equal(2);
        indices = mesh.polylines![0].indices;
        const expectedIndices1 = [0, 1, 2, 3, 4, 5];
        expect(indices.length).to.equal(6);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices1[i]);
        indices = mesh.polylines![1].indices;
        const expectedIndices2 = [6, 7, 8, 9, 10, 11];
        expect(indices.length).to.equal(6);
        for (let i = 0; i < indices.length; i++)
          expect(indices[i]).to.equal(expectedIndices2[i]);

        // Validate vertices and normals
        const pos1 = [
          Point3d.create(-7.5, 10, 0), Point3d.create(-7.5, -10, 0), Point3d.create(-2.5, 0, 0),
          Point3d.create(-2.5, 10, 0), Point3d.create(7.5, -10, 0), Point3d.create(7.5, 0, 0),
          Point3d.create(-7.5, 30, 0), Point3d.create(-7.5, 10, 0), Point3d.create(-2.5, 20, 0),
          Point3d.create(-2.5, 30, 0), Point3d.create(7.5, 10, 0), Point3d.create(7.5, 20, 0)];
        for (let i = 0; i < mesh.points.length; ++i) {
          const pnt = mesh.points.unquantize(i);
          expect(delta(pnt.x, pos1[i].x)).to.be.lessThan(0.0005);
          expect(delta(pnt.y, pos1[i].y)).to.be.lessThan(0.002);
          expect(delta(pnt.z, pos1[i].z)).to.be.lessThan(0.0005);
        }

        // Validate color table (nonuniform - yellow and cyan)
        expect(mesh.colorMap.isUniform).to.be.false;
        expect(mesh.colorMap.indexOf(0x0000ffff)).to.equal(1);
        expect(mesh.colorMap.indexOf(0x00f0f000)).to.equal(0);
        expect(mesh.colors.length).to.equal(12);
        const expectedColors = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
        for (let i = 0; i < mesh.colors.length; i++)
          expect(mesh.colors[i]).to.equal(expectedColors[i]);

        // Validate display params
        displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Linear);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(0x00f0f000);
        expect(displayParams.fillColor.tbgr).to.equal(0x00f0f000);
        expect(displayParams.width).to.equal(9);
        expect(displayParams.linePixels).to.equal(LinePixels.Code2);
        expect(displayParams.hasFillTransparency).to.be.false;
        expect(displayParams.hasLineTransparency).to.be.false;

        // Validate RenderGraphic
        const graphic = result.renderGraphic!;
        expect(graphic).not.to.be.undefined;
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.length).to.equal(3);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsList);
        const list = batch.graphic as GraphicsList;
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
        expect(plGeom.numIndices).to.equal(60);
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.polyline.lineCode).to.equal(0);
        expect(plGeom.polyline.lineWeight).to.equal(9);

        expect(list.graphics[1]).to.be.instanceOf(PolylinePrimitive);
        plinePrim = list.graphics[1] as PolylinePrimitive;
        expect(plinePrim.featureIndexType).to.equal(FeatureIndexType.NonUniform);
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.isPlanar).to.be.false;
        expect(plinePrim.renderOrder).to.equal(3);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(120);
        expect(plGeom.lut.numVertices).to.equal(12);
        expect(plGeom.polyline.lineCode).to.equal(2);
        expect(plGeom.polyline.lineWeight).to.equal(9);
      }
    }
  });

  it("should read an iModel tile containing edges and silhouettes", () => {
    if (WebGLTestContext.isInitialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new TileIO.StreamBuffer(cylinder);
      const reader = IModelTileIO.Reader.create(stream, model, System.instance);
      expect(reader).not.to.be.undefined;

      if (undefined !== reader) {
        const result = reader.read();
        expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
        expect(result.isLeaf).to.be.true;
        expect(result.contentRange).not.to.be.undefined;
        expect(result.geometry).not.to.be.undefined;

        // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
        const low = result.contentRange!.low;
        expect(delta(low.x, -2.0)).to.be.lessThan(0.0005);
        expect(delta(low.y, -2.0)).to.be.lessThan(0.0005);
        expect(delta(low.z, -3.0)).to.be.lessThan(0.0005);

        const high = result.contentRange!.high;
        expect(delta(high.x, 2.0)).to.be.lessThan(0.0005);
        expect(delta(high.y, 2.0)).to.be.lessThan(0.0005);
        expect(delta(high.z, 3.0)).to.be.lessThan(0.0005);

        // Confirm GeometryCollection
        const geom = result.geometry!;
        expect(geom.isEmpty).to.be.false;
        expect(geom.isComplete).to.be.true;
        expect(geom.isCurved).to.be.true;

        const meshes = geom.meshes;
        expect(meshes.length).to.equal(1);

        // Validate feature table (uniform - one element)
        const features = meshes.features!;
        expect(meshes.features).not.to.be.undefined;
        expect(features.length).to.equal(1);
        expect(features.isUniform).to.be.true;
        const feature = features.findFeature(0);
        expect(feature).not.to.be.undefined;
        expect(feature!.geometryClass).to.equal(GeometryClass.Primary);
        expect(feature!.elementId.value).to.equal("0x4e");
        expect(feature!.subCategoryId.value).to.equal("0x18");

        // Validate mesh data
        const mesh = meshes[0];
        expect(mesh.type).to.equal(Mesh.PrimitiveType.Mesh);
        expect(mesh.points.length).to.equal(146);
        expect(mesh.isPlanar).to.be.false;
        expect(mesh.is2d).to.be.false;
        expect(mesh.normals.length).to.equal(146);
        expect(mesh.uvParams.length).to.equal(0);
        expect(mesh.features).not.to.be.undefined;
        expect(mesh.features!._indices.length).to.equal(0);

        // Validate mesh triangles
        expect(mesh.triangles).not.to.be.undefined;
        expect(mesh.triangles!.length).to.equal(144);
        const indices = mesh.triangles!.indices;
        const expectedfirstIndices = [0, 1, 2, 2, 1, 3, 3, 1, 4, 4, 1, 5, 5, 1, 6, 6, 1, 7, 7, 1, 8, 8, 1, 9];
        expect(indices.length).to.equal(432);
        for (let i = 0; i < expectedfirstIndices.length; i++)
          expect(indices[i]).to.equal(expectedfirstIndices[i]);
        const expectedlastIndices = [141, 140, 142, 141, 142, 143, 143, 142, 144, 143, 144, 145, 145, 144, 75, 145, 75, 74];
        expect(indices.length).to.equal(432);
        const offset = indices.length - expectedlastIndices.length;
        for (let i = expectedlastIndices.length; i >= 0; i--)
          expect(indices[offset + i]).to.equal(expectedlastIndices[i]);

        // Validate mesh edges
        expect(mesh.edges).not.to.be.undefined;
        const edges = mesh.edges!;
        expect(edges.polylines).not.to.be.undefined;
        expect(edges.polylines.length).to.equal(2);
        expect(edges.polylines[0].indices.length).to.equal(37);
        expect(edges.polylines[1].indices.length).to.equal(37);
        expect(edges.visible).not.to.be.undefined;
        expect(edges.visible.length).to.equal(72);
        expect(edges.silhouette).not.to.be.undefined;
        expect(edges.silhouetteNormals).not.to.be.undefined;
        expect(edges.silhouette.length).to.equal(edges.silhouetteNormals.length);

        // Validate color table (uniform - green)
        expect(mesh.colorMap.length).to.equal(1);
        expect(mesh.colorMap.isUniform).to.be.true;
        expect(mesh.colorMap.indexOf(0x0000ff00)).to.equal(0); // green is first and only color in color table
        expect(mesh.colors.length).to.equal(0);

        // Validate display params
        const displayParams = mesh.displayParams;
        expect(displayParams.type).to.equal(DisplayParams.Type.Mesh);
        expect(displayParams.material).to.be.undefined;
        expect(displayParams.lineColor.tbgr).to.equal(0x0000ff00);
        expect(displayParams.fillColor.tbgr).to.equal(0x0000ff00);
        expect(displayParams.width).to.equal(1);
        expect(displayParams.linePixels).to.equal(LinePixels.Solid);
        expect(displayParams.ignoreLighting).to.be.false;
        expect(displayParams.hasFillTransparency).to.be.false;
        expect(displayParams.hasLineTransparency).to.be.false;

        // Validate RenderGraphic
        const graphic = result.renderGraphic!;
        expect(graphic).not.to.be.undefined;
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
      }
    }
  });

  it("should obtain tiles from backend", async () => {
    // This data set contains 4 physical models: 0x1c (empty), 0x22, 0x23, and 0x24. The latter 3 collectively contain 4 spheres.
    const modelProps = await imodel.models.getProps("0x22");
    expect(modelProps.length).to.equal(1);

    const treeIds = Id64.toIdSet(modelProps[0].id!);
    const tileTreeProps = await imodel.tiles.getTileTreeProps(treeIds);
    expect(tileTreeProps.length).to.equal(1);

    const tree = tileTreeProps[0];
    expect(tree.id).to.equal(modelProps[0].id);
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    const rootTile = tree.rootTile;
    expect(rootTile.id.treeId).to.equal(tree.id);
    expect(rootTile.id.tileId).to.equal("0/0/0/0:1.000000");

    if (undefined === rootTile.geometry || undefined === rootTile.contentRange)
      return; // ###TODO: The add-on doesn't wait for tile geometry to be saved to the cache, so it may be undefined...

    expect(rootTile.geometry).not.to.be.undefined;
    expect(rootTile.contentRange).not.to.be.undefined;

    expect(rootTile.childIds).not.to.be.undefined;

    expect(rootTile.childIds.length).to.equal(1); // this tile has one higher-resolution child because it contains only 1 elements (a sphere)
  });
});
