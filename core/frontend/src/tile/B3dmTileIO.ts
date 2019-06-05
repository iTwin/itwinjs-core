/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { ElementAlignedBox3d, FeatureTable, Feature, BatchType } from "@bentley/imodeljs-common";
import { Id64String, utf8ToString, JsonUtils } from "@bentley/bentleyjs-core";
import { RenderSystem } from "../render/System";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { IModelConnection } from "../IModelConnection";
import { Transform } from "@bentley/geometry-core";
import { BatchedTileIdMap } from "./TileTree";

/**
 * Provides facilities for deserializing Batched 3D Model (B3dm) tiles.
 * @internal
 */
export namespace B3dmTileIO {
  /** @internal */
  export class Header extends TileIO.Header {
    public readonly length: number;
    public readonly featureTableJsonLength: number;
    public readonly featureTableBinaryLength: number;
    public readonly batchTableJsonLength: number;
    public readonly batchTableBinaryLength: number;
    public readonly featureTableJson: any;
    public readonly batchTableJson: any;
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
      if (0 !== this.featureTableJsonLength) {
        const sceneStrData = stream.nextBytes(this.featureTableJsonLength);
        const sceneStr = utf8ToString(sceneStrData);
        if (sceneStr) this.featureTableJson = JSON.parse(sceneStr);
      }
      stream.advance(this.featureTableBinaryLength);
      if (0 !== this.batchTableJsonLength) {
        const batchStrData = stream.nextBytes(this.batchTableJsonLength);
        const batchStr = utf8ToString(batchStrData);
        if (batchStr) this.batchTableJson = JSON.parse(batchStr);
      }
      stream.advance(this.batchTableBinaryLength);

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }

  /**
   * Deserializes a B3DM tile.
   * @internal
   */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64String, is3d: boolean, range: ElementAlignedBox3d, system: RenderSystem, yAxisUp: boolean, isLeaf: boolean, transformToRoot?: Transform, isCanceled?: GltfTileIO.IsCanceled, idMap?: BatchedTileIdMap): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      if (header.featureTableJson && Array.isArray(header.featureTableJson.RTC_CENTER)) {
        const returnToCenterTransform = Transform.createTranslationXYZ(header.featureTableJson.RTC_CENTER[0], header.featureTableJson.RTC_CENTER[1], header.featureTableJson.RTC_CENTER[2]);
        transformToRoot = transformToRoot ? transformToRoot.multiplyTransformTransform(returnToCenterTransform) : returnToCenterTransform;
      }

      const props = GltfTileIO.ReaderProps.create(stream, yAxisUp);
      const batchTableLength = header.featureTableJson ? JsonUtils.asInt(header.featureTableJson.BATCH_LENGTH, 0) : 0;
      return undefined !== props ? new Reader(props, iModel, modelId, is3d, system, range, isLeaf, batchTableLength, transformToRoot, header.batchTableJson, isCanceled, idMap) : undefined;
    }
    private constructor(props: GltfTileIO.ReaderProps, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, private _range: ElementAlignedBox3d, private _isLeaf: boolean, private _batchTableLength: number, private _transformToRoot?: Transform, private _batchTableJson?: any, isCanceled?: GltfTileIO.IsCanceled, private _idMap?: BatchedTileIdMap) {
      super(props, iModel, modelId, is3d, system, BatchType.Primary, isCanceled);
    }
    public async read(): Promise<GltfTileIO.ReaderResult> {

      // NB: For reality models with no batch table, we want the model ID in the feature table
      const featureTable: FeatureTable = new FeatureTable(this._batchTableLength ? this._batchTableLength : 1, this._modelId, this._type);
      if (this._batchTableLength > 0 && this._idMap !== undefined && this._batchTableJson !== undefined) {
        for (let i = 0; i < this._batchTableLength; i++) {
          const feature: any = {};
          for (const key in this._batchTableJson)
            feature[key] = this._batchTableJson[key][i];
          featureTable.insert(new Feature(this._idMap.getBatchId(feature, this._iModel)));
        }
      } else {
        const feature = new Feature(this._modelId);
        featureTable.insert(feature);
      }

      await this.loadTextures();
      if (this._isCanceled)
        return Promise.resolve({ readStatus: TileIO.ReadStatus.Canceled, isLeaf: this._isLeaf });

      return Promise.resolve(this.readGltfAndCreateGraphics(this._isLeaf, featureTable, this._range, this._transformToRoot));
    }
    protected readFeatures(features: Mesh.Features, json: any): boolean {
      let batchIds: any;
      if (this._batchTableLength > 0 && undefined !== this._batchTableJson && undefined !== json.attributes && undefined !== (batchIds = super.readBufferData32(json.attributes, "_BATCHID"))) {
        const indices = [];
        for (let i = 0; i < batchIds.count; i++)
          indices.push(batchIds.buffer[i]);

        features.setIndices(indices);
        return true;
      }
      const feature = new Feature(this._modelId);

      features.add(feature, 1);
      return true;
    }
  }
}
