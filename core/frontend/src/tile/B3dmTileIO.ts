/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { ElementAlignedBox3d, FeatureTable, Feature, BatchType } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";
import { RenderSystem } from "../render/System";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { IModelConnection } from "../IModelConnection";
import { Transform } from "@bentley/geometry-core";

/**
 * Provides facilities for deserializing Batched 3D Model (B3dm) tiles.
 * @hidden
 */
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

      // Keep this legacy check in for now since a lot of tilesets are still using the old header.
      // Legacy header #1: [batchLength] [batchTableByteLength]
      // Legacy header #2: [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]
      // Current header: [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength]
      // If the header is in the first legacy format 'batchTableJsonByteLength' will be the start of the JSON string (a quotation mark) or the glTF magic.
      // Accordingly its first byte will be either 0x22 or 0x67, and so the minimum uint32 expected is 0x22000000 = 570425344 = 570MB. It is unlikely that the feature table Json will exceed this length.
      // The check for the second legacy format is similar, except it checks 'batchTableBinaryByteLength' instead
      if (this.batchTableJsonLength >= 570425344) {
        // First legacy check
        stream.curPos = 20;
        // batchLength = this.featureTableJsonLength;
        this.batchTableJsonLength = this.featureTableBinaryLength;
        this.batchTableBinaryLength = 0;
        this.featureTableJsonLength = 0;
        this.featureTableBinaryLength = 0;
      } else if (this.batchTableBinaryLength >= 570425344) {
        // Second legacy check
        stream.curPos = 24;
        this.batchTableJsonLength = this.featureTableJsonLength;
        this.batchTableBinaryLength = this.featureTableBinaryLength;
        this.featureTableJsonLength = 0;
        this.featureTableBinaryLength = 0;
      }
      stream.advance(this.featureTableJsonLength);
      stream.advance(this.featureTableBinaryLength);
      stream.advance(this.batchTableJsonLength);
      stream.advance(this.batchTableBinaryLength);

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }

  /**
   * Deserializes a B3DM tile.
   * @hidden
   */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64String, is3d: boolean, range: ElementAlignedBox3d, system: RenderSystem, yAxisUp: boolean, isLeaf: boolean, transformToRoot?: Transform, isCanceled?: GltfTileIO.IsCanceled): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      const props = GltfTileIO.ReaderProps.create(stream, yAxisUp);
      return undefined !== props ? new Reader(props, iModel, modelId, is3d, system, range, isLeaf, transformToRoot, isCanceled) : undefined;
    }
    private constructor(props: GltfTileIO.ReaderProps, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, private _range: ElementAlignedBox3d, private _isLeaf: boolean, private _transformToRoot?: Transform, isCanceled?: GltfTileIO.IsCanceled) {
      super(props, iModel, modelId, is3d, system, BatchType.Primary, isCanceled);
    }
    public async read(): Promise<GltfTileIO.ReaderResult> {

      // TBD... Create an actual feature table if one exists.  For now we are only reading tiles from scalable mesh which have no features.
      // NB: For reality models with no batch table, we want the model ID in the feature table
      const featureTable: FeatureTable = new FeatureTable(1, this._modelId, this._type);
      const feature = new Feature(this._modelId);
      featureTable.insert(feature);

      await this.loadTextures();
      if (this._isCanceled)
        return Promise.resolve({ readStatus: TileIO.ReadStatus.Canceled, isLeaf: this._isLeaf });

      return Promise.resolve(this.readGltfAndCreateGraphics(this._isLeaf, false, true, featureTable, this._range, this._transformToRoot));
    }
    protected readFeatures(features: Mesh.Features, _json: any): boolean {
      const feature = new Feature(this._modelId);

      features.add(feature, 1);
      return true;
    }
  }
}
