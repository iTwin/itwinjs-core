/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect} from "chai";
import { TileIO, IModelTileIO } from "@bentley/imodeljs-frontend/lib/tile";
import { ModelState } from "@bentley/imodeljs-frontend";
import { RenderSystem, Mesh, DisplayParams } from "@bentley/imodeljs-frontend/lib/rendering";
import { LinePixels, GeometryClass } from "@bentley/imodeljs-common";
import { TileData } from "./TileIO.data";

function delta(a: number, b: number): number { return Math.abs(a - b); }

describe("TileIO", () => {
  const rectangle = TileData.rectangle.buffer;

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

  it("should read an iModel tile", () => {
    // ###TODO: ModelState, RenderSystem...
    const model: ModelState | undefined = undefined;
    const system: RenderSystem | undefined = undefined;
    const stream = new TileIO.StreamBuffer(rectangle);
    const reader = IModelTileIO.Reader.create(stream, model!, system!);
    expect(reader).not.to.be.undefined;

    if (undefined !== reader) {
      const result = reader.read();
      expect(result.readStatus).to.equal(TileIO.ReadStatus.Success);
      expect(result.isLeaf).to.be.true;
      expect(result.contentRange).not.to.be.undefined;
      expect(result.geometry).not.to.be.undefined;

      const low = result.contentRange!.low;
      expect(delta(low.x, -2.5)).to.be.lessThan(0.0005);
      expect(delta(low.y, -5.0)).to.be.lessThan(0.0005);
      expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

      const high = result.contentRange!.high;
      expect(delta(high.x, 2.5)).to.be.lessThan(0.0005);
      expect(delta(high.y, 5.0)).to.be.lessThan(0.0005);
      expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

      const geom = result.geometry!;
      expect(geom.isEmpty).to.be.false;
      expect(geom.isComplete).to.be.true;
      expect(geom.isCurved).to.be.false;

      const meshes = geom.meshes;
      expect(meshes.length).to.equal(1);

      const mesh = meshes[0];
      expect(mesh.type).to.equal(Mesh.PrimitiveType.Mesh);
      expect(mesh.points.length).to.equal(4);
      expect(mesh.isPlanar).to.be.true;
      expect(mesh.is2d).to.be.false;
      expect(mesh.colorMap.length).to.equal(1);
      expect(mesh.colorMap.isUniform).to.be.true;
      expect(mesh.colorMap.getIndex(0x0000ff00)).to.equal(0); // green is first and only color in color table
      expect(mesh.colors.length).to.equal(0);
      expect(mesh.features).not.to.be.undefined;
      expect(mesh.features!._indices.length).to.equal(0);

      const displayParams = mesh.displayParams;
      expect(displayParams.type).to.equal(DisplayParams.Type.Mesh);
      expect(displayParams.material).to.be.undefined;
      expect(displayParams.lineColor.tbgr).to.equal(0x0000ff00);
      expect(displayParams.fillColor.tbgr).to.equal(0x0000ff00);
      expect(displayParams.width).to.equal(1);
      expect(displayParams.linePixels).to.equal(LinePixels.Solid);
      expect(displayParams.ignoreLighting).to.be.false;

      expect(mesh.normals.length).to.equal(4);
      expect(mesh.uvParams.length).to.equal(0);

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

      expect(mesh.triangles).not.to.be.undefined;
      expect(mesh.triangles!.length).to.equal(2);

      const indices = mesh.triangles!.indices;
      const expectedIndices = [ 0, 1, 2, 0, 2, 3 ];
      expect(indices.length).to.equal(6);
      for (let i = 0; i < indices.length; i++)
        expect(indices[i]).to.equal(expectedIndices[i]);
    }
  });
});
