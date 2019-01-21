/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { ElementAlignedBox3d, FeatureTable, Feature, BatchType } from "@bentley/imodeljs-common";
import { Id64String, utf8ToString, JsonUtils } from "@bentley/bentleyjs-core";
import { RenderSystem, GraphicBranch } from "../render/System";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { IModelConnection } from "../IModelConnection";
import { Point3d, Vector3d, Matrix3d, Transform, AxisOrder } from "@bentley/geometry-core";

/**
 * Provides facilities for deserializing Batched 3D Model (B3dm) tiles.
 * @hidden
 */
export namespace I3dmTileIO {
  export class Header extends TileIO.Header {
    public readonly length: number;
    public readonly featureTableJsonPosition: number;
    public readonly featureTableJsonLength: number;
    public readonly featureTableBinaryLength: number;
    public readonly batchTableJsonLength: number;
    public readonly batchTableBinaryLength: number;
    public readonly gltfVersion: number;
    public get isValid(): boolean { return TileIO.Format.I3dm === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.length = stream.nextUint32;
      this.featureTableJsonLength = stream.nextUint32;
      this.featureTableBinaryLength = stream.nextUint32;
      this.batchTableJsonLength = stream.nextUint32;
      this.batchTableBinaryLength = stream.nextUint32;
      this.gltfVersion = stream.nextUint32;
      this.featureTableJsonPosition = stream.curPos;
      stream.advance(this.featureTableJsonLength);
      stream.advance(this.featureTableBinaryLength);
      stream.advance(this.batchTableJsonLength);
      stream.advance(this.batchTableBinaryLength);

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }

  /**
   * Deserializes a I3DM tile.
   * @hidden
   */
  export class Reader extends GltfTileIO.Reader {
    public static create(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64String, is3d: boolean, range: ElementAlignedBox3d, system: RenderSystem, yAxisUp: boolean, isLeaf: boolean, isCanceled?: GltfTileIO.IsCanceled): Reader | undefined {
      const header = new Header(stream);
      if (!header.isValid)
        return undefined;

      const props = GltfTileIO.ReaderProps.create(stream, yAxisUp);
      stream.curPos = header.featureTableJsonPosition;
      const featureStr = utf8ToString(stream.nextBytes(header.featureTableJsonLength));
      if (undefined === featureStr)
        return undefined;
      const featureBinary = new Uint8Array(stream.arrayBuffer, header.featureTableJsonPosition + header.featureTableJsonLength, header.featureTableBinaryLength);
      return undefined !== props ? new Reader(featureBinary, JSON.parse(featureStr), props, iModel, modelId, is3d, system, range, isLeaf, isCanceled) : undefined;
    }
    private constructor(private _featureBinary: Uint8Array, private _featureJson: any, props: GltfTileIO.ReaderProps, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, private _range: ElementAlignedBox3d, private _isLeaf: boolean, isCanceled?: GltfTileIO.IsCanceled) {
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

      const graphic = this.readGltfAndCreateGraphics(this._isLeaf, false, true, featureTable, this._range);
      if (graphic.readStatus !== TileIO.ReadStatus.Success || undefined === graphic.renderGraphic)
        return graphic;

      const instanceCount = JsonUtils.asInt(this._featureJson.INSTANCES_LENGTH, 0);
      if (0 === instanceCount)
        return { readStatus: TileIO.ReadStatus.InvalidTileData, isLeaf: this._isLeaf };

      const positions = this._featureJson.POSITION ? new Float32Array(this._featureBinary.buffer, this._featureBinary.byteOffset + this._featureJson.POSITION.byteOffset, instanceCount * 3) : undefined;
      const upNormals = this._featureJson.NORMAL_UP ? new Float32Array(this._featureBinary.buffer, this._featureBinary.byteOffset + this._featureJson.NORMAL_UP.byteOffset, instanceCount * 3) : undefined;
      const rightNormals = this._featureJson.NORMAL_RIGHT ? new Float32Array(this._featureBinary.buffer, this._featureBinary.byteOffset + this._featureJson.NORMAL_RIGHT.byteOffset, instanceCount * 3) : undefined;
      const matrix = Matrix3d.createIdentity();
      const position = Point3d.createZero();
      const upNormal = Vector3d.create(0, 0, 1);
      const rightNormal = Vector3d.create(1, 0, 0);
      const transform = Transform.createRefs(position, matrix);
      const instanceBranch = new GraphicBranch();

      instanceBranch.add(graphic.renderGraphic);
      const instancedBranch = new GraphicBranch();
      for (let i = 0; i < instanceCount; i++) {
        const index = i * 3;
        if (positions)
          position.set(positions[index], positions[index + 1], positions[index + 2]);
        if (upNormals || rightNormals) {
          if (upNormals)
            upNormal.set(upNormals[index], upNormals[index + 1], upNormals[index + 2]);
          if (rightNormals)
            rightNormal.set(rightNormals[index], rightNormals[index + 1], rightNormals[index + 2]);
          Matrix3d.createRigidFromColumns(rightNormal, upNormal, AxisOrder.XYZ, matrix);
        }
        instancedBranch.add(this._system.createBranch(instanceBranch, transform.clone()));
      }
      graphic.renderGraphic = this._system.createBranch(instancedBranch, Transform.createIdentity());

      return graphic;
    }
    protected readFeatures(features: Mesh.Features, _json: any): boolean {
      const feature = new Feature(this._modelId);

      features.add(feature, 1);
      return true;
    }
  }
}
