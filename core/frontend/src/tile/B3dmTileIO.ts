/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { ElementAlignedBox3d, ColorDef, LinePixels, FillFlags, FeatureTable, Feature, TextureMapping } from "@bentley/imodeljs-common";
import { JsonUtils } from "@bentley/bentleyjs-core";
import { RenderSystem } from "../render/System";
import { GeometricModelState } from "../ModelState";
import { ColorMap } from "../render/primitives/ColorMap";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";

/** Provides facilities for deserializing Batched 3D Model (B3dm) tiles.  */
export namespace B3dmTileIO {
  export class Header extends TileIO.Header {
    public readonly length: number;
    public readonly featureTableJsonLength: number;
    public readonly featureTableBinaryLength: number;
    public readonly batchTableJsonLength: number;
    public readonly batchTableBinaryLength: number;
    public get isValid(): boolean { return TileIO.Format.B3dm === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.length = stream.nextUint32;
      this.featureTableJsonLength = stream.nextUint32;
      this.featureTableBinaryLength = stream.nextUint32;
      this.batchTableJsonLength = stream.nextUint32;
      this.batchTableBinaryLength = stream.nextUint32;
      stream.advance(this.featureTableJsonLength);
      stream.advance(this.featureTableBinaryLength);
      stream.advance(this.batchTableJsonLength);
      stream.advance(this.batchTableBinaryLength);

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }

  /** Deserializes an B3DM tile. */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, model: GeometricModelState, range: ElementAlignedBox3d, system: RenderSystem, yAxisUp: boolean, isCanceled?: GltfTileIO.IsCanceled): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      const props = GltfTileIO.ReaderProps.create(stream, yAxisUp);
      return undefined !== props ? new Reader(props, model, system, range, isCanceled) : undefined;
    }
    private constructor(props: GltfTileIO.ReaderProps, model: GeometricModelState, system: RenderSystem, private range: ElementAlignedBox3d, isCanceled?: GltfTileIO.IsCanceled) {
      super(props, model, system, isCanceled);
    }
    public async read(): Promise<GltfTileIO.ReaderResult> {
      const isLeaf = true;    // TBD...

      // TBD... Create an actual feature table if one exists.  For now we are only reading tiles from scalable mesh which have no features.
      // NB: For reality models with no batch table, we want the model ID in the feature table
      const featureTable: FeatureTable = new FeatureTable(1, this.model.id);
      const feature = new Feature(this.model.id);
      featureTable.insert(feature);

      await this.loadTextures();
      if (this.isCanceled)
        return Promise.resolve({ readStatus: TileIO.ReadStatus.Canceled, isLeaf });

      return Promise.resolve(this.readGltfAndCreateGraphics(isLeaf, false, true, featureTable, this.range));
    }
    protected readFeatures(features: Mesh.Features, _json: any): boolean {
      const feature = new Feature(this.model.id);

      features.add(feature, 1);
      return true;
    }
    protected readColorTable(colorTable: ColorMap, _json: any): boolean | undefined {
      colorTable.insert(0x777777);
      return true;
    }
    protected createDisplayParams(materialJson: any): DisplayParams | undefined {
      let textureMapping: TextureMapping | undefined;
      if (undefined !== materialJson &&
        undefined !== materialJson.values.tex) {
        textureMapping = this.findTextureMapping(materialJson.values.tex);
      }
      const grey: ColorDef = new ColorDef(0x77777777);
      return new DisplayParams(DisplayParams.Type.Mesh, grey, grey, 1, LinePixels.Solid, FillFlags.Always, undefined, undefined, true, textureMapping);
    }
    protected extractReturnToCenter(extensions: any): number[] | undefined {
      if (extensions === undefined) { return undefined; }
      const cesiumRtc = JsonUtils.asObject(extensions.CESIUM_RTC);
      return (cesiumRtc === undefined) ? undefined : JsonUtils.asArray(cesiumRtc.center);
    }

    protected get hasBakedLighting(): boolean { return true; } // ###TODO? currently always desired (3mx, 3sm) - may change in future.
  }
}
