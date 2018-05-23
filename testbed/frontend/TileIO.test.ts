/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TileIO, IModelTileIO } from "@bentley/imodeljs-frontend/lib/tile";
import { Mesh, DisplayParams } from "@bentley/imodeljs-frontend/lib/rendering";
import { LinePixels, GeometryClass } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { TileData } from "./TileIO.data";
import { Point3d, Vector3d } from "@bentley/geometry-core";

function delta(a: number, b: number): number { return Math.abs(a - b); }

describe("TileIO", () => {
  const rectangle = TileData.rectangle.buffer;
  const triangles = TileData.triangles.buffer;
  const model = { id: Id64.invalidId, is2d: false };
  const system = { dummy: false };

  it("should read tile headers", () => {
    const stream = new TileIO.StreamBuffer(rectangle);
    const tileHeader = new TileIO.Header(stream);
    expect(tileHeader.isValid).to.be.true;
    expect(tileHeader.format).to.equal(TileIO.Format.IModel);
    expect(tileHeader.version).to.equal(0);

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
    const stream = new TileIO.StreamBuffer(rectangle);
    const reader = IModelTileIO.Reader.create(stream, model, system);
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

      // Validate feature table (uniform - one element)
      const features = meshes.features!;
      expect(meshes.features).not.to.be.undefined;
      expect(features.length).to.equal(1);
      expect(features.isUniform).to.be.true;
      expect(mesh.features!.uniform).to.equal(0);
      const feature = features.findFeature(0);
      expect(feature).not.to.be.undefined;
      expect(feature!.geometryClass).to.equal(GeometryClass.Primary);
      expect(feature!.elementId.value).to.equal("0x4e");
      expect(feature!.subCategoryId.value).to.equal("0x18");
    }
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", () => {
    const stream = new TileIO.StreamBuffer(triangles);
    const reader = IModelTileIO.Reader.create(stream, model, system);
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

      // Validate mesh data for first mesh (3 triangles).
      let mesh = meshes[0];
      expect(mesh.type).to.equal(Mesh.PrimitiveType.Mesh);
      expect(mesh.points.length).to.equal(9);
      expect(mesh.isPlanar).to.be.true;
      expect(mesh.is2d).to.be.false;
      expect(mesh.normals.length).to.equal(9);
      expect(mesh.uvParams.length).to.equal(0, "----- 1");
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

      // Validate vertex positions
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
      // expect(mesh.colorMap.hasTransparency).to.be.false;
      expect(mesh.colorMap.indexOf(0x00ff0000)).to.equal(0); // red is first color in color table
      expect(mesh.colorMap.indexOf(0x0000ff00)).to.equal(1); // green is 2nd color in color table
      expect(mesh.colorMap.indexOf(0x000000ff)).to.equal(2); // blue is 3rd color in color table
      expect(mesh.colors.length).to.equal(9);
      const expectedColors0 = [0, 0, 0, 1, 1, 1, 2, 2, 2];
      for (let i = 0; i < mesh.colors.length; i++)
        expect(mesh.colors[i]).to.equal(expectedColors0[i]);

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

      // Validate vertex positions
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
      const displayParams = mesh.displayParams;
      expect(displayParams.type).to.equal(DisplayParams.Type.Mesh);
      expect(displayParams.material).to.be.undefined;
      expect(displayParams.lineColor.tbgr).to.equal(0x7f0000ff);
      expect(displayParams.fillColor.tbgr).to.equal(0x7f0000ff);
      expect(displayParams.width).to.equal(1);
      expect(displayParams.linePixels).to.equal(LinePixels.Solid);
      expect(displayParams.ignoreLighting).to.be.false;

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
    }
  });
});
