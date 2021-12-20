/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { ByteStream, Id64String, JsonUtils, utf8ToString } from "@itwin/core-bentley";
import { AxisOrder, Matrix3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { BatchType, ElementAlignedBox3d, Feature, FeatureTable, I3dmHeader, TileReadStatus } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { RenderSystem } from "../render/RenderSystem";
import { BatchedTileIdMap, GltfReader, GltfReaderProps, GltfReaderResult, ShouldAbortReadGltf } from "./internal";

function setTransform(transforms: Float32Array, index: number, rotation: Matrix3d, origin: Point3d): void {
  const i = index * 12;
  let rot = rotation.coffs;

  const ignoreRotation = false;
  if (ignoreRotation)
    rot = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

  const ignoreOrigin = false;
  if (ignoreOrigin)
    origin.x = origin.y = origin.z = 0;

  transforms[i + 0] = rot[0];
  transforms[i + 1] = rot[1];
  transforms[i + 2] = rot[2];
  transforms[i + 3] = origin.x;

  transforms[i + 4] = rot[3];
  transforms[i + 5] = rot[4];
  transforms[i + 6] = rot[5];
  transforms[i + 7] = origin.y;

  transforms[i + 8] = rot[6];
  transforms[i + 9] = rot[7];
  transforms[i + 10] = rot[8];
  transforms[i + 11] = origin.z;
}

/**
 * Deserializes a tile in [i3dm](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/Instanced3DModel) format.
 * @internal
 */
export class I3dmReader extends GltfReader {
  private _instanceCount = 0;
  private _featureTable?: FeatureTable;
  private readonly _modelId: Id64String;

  public static create(stream: ByteStream, iModel: IModelConnection, modelId: Id64String, is3d: boolean, range: ElementAlignedBox3d,
    system: RenderSystem, yAxisUp: boolean, isLeaf: boolean, isCanceled?: ShouldAbortReadGltf, idMap?: BatchedTileIdMap, deduplicateVertices=false): I3dmReader | undefined {
    const header = new I3dmHeader(stream);
    if (!header.isValid)
      return undefined;

    const props = GltfReaderProps.create(stream, yAxisUp);
    if (undefined === props)
      return undefined;

    stream.curPos = header.featureTableJsonPosition;
    const featureStr = utf8ToString(stream.nextBytes(header.featureTableJsonLength));
    if (undefined === featureStr)
      return undefined;

    const featureBinary = new Uint8Array(stream.arrayBuffer, header.featureTableJsonPosition + header.featureTableJsonLength, header.featureTableBinaryLength);
    return new I3dmReader(featureBinary, JSON.parse(featureStr), header.batchTableJson, props, iModel, modelId, is3d, system,
      range, isLeaf, isCanceled, idMap, deduplicateVertices);
  }

  private constructor(private _featureBinary: Uint8Array, private _featureJson: any, private _batchTableJson: any, props: GltfReaderProps,
    iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, private _range: ElementAlignedBox3d,
    private _isLeaf: boolean, shouldAbort?: ShouldAbortReadGltf, private _idMap?: BatchedTileIdMap, deduplicateVertices=false) {
    super({
      props, iModel, system, shouldAbort, deduplicateVertices,
      is2d: !is3d,
    });
    this._modelId = modelId;
  }

  public async read(): Promise<GltfReaderResult> {
    this._instanceCount = JsonUtils.asInt(this._featureJson.INSTANCES_LENGTH, 0);

    // NB: For reality models with no batch table, we want the model ID in the feature table
    this._featureTable = new FeatureTable(undefined === this._batchTableJson ? this._instanceCount : 1, this._modelId, this._type);
    if (this._idMap !== undefined && this._batchTableJson !== undefined) {
      for (let i = 0; i < this._instanceCount; i++) {
        const feature: any = {};
        for (const key in this._batchTableJson) // eslint-disable-line guard-for-in
          feature[key] = this._batchTableJson[key][i];

        this._featureTable.insert(new Feature(this._idMap.getBatchId(feature)));
      }
    } else {
      // NB: For reality models with no batch table, we want the model ID in the feature table
      const feature = new Feature(this._modelId);
      this._featureTable.insert(feature);
    }

    await this.loadTextures();
    if (this._isCanceled)
      return { readStatus: TileReadStatus.Canceled, isLeaf: this._isLeaf };

    const instances = this.readInstances();
    if (undefined === instances)
      return { readStatus: TileReadStatus.InvalidTileData, isLeaf: this._isLeaf };

    return this.readGltfAndCreateGraphics(this._isLeaf, this._featureTable, this._range, undefined, undefined, instances);
  }

  protected readFeatures(_features: Mesh.Features, _json: any): boolean {
    return false;
  }

  private readInstances(): InstancedGraphicParams | undefined {
    const count = JsonUtils.asInt(this._featureJson.INSTANCES_LENGTH, 0);
    if (count <= 0)
      return undefined;

    const json = this._featureJson;
    const binary = this._featureBinary;

    const batchIds = json.BATCH_ID ? new Int32Array(binary.buffer, binary.byteOffset + json.BATCH_ID.byteOffset, count) : undefined;
    const positions = json.POSITION ? new Float32Array(binary.buffer, binary.byteOffset + json.POSITION.byteOffset, count * 3) : undefined;
    const upNormals = json.NORMAL_UP ? new Float32Array(binary.buffer, binary.byteOffset + json.NORMAL_UP.byteOffset, count * 3) : undefined;
    const rightNormals = json.NORMAL_RIGHT ? new Float32Array(binary.buffer, binary.byteOffset + json.NORMAL_RIGHT.byteOffset, count * 3) : undefined;
    const scales = json.SCALE ? new Float32Array(binary.buffer, binary.byteOffset + json.SCALE.byteOffset, count) : undefined;
    const nonUniformScales = json.SCALE_NON_UNIFORM ? new Float32Array(binary.buffer, binary.byteOffset + json.SCALE_NON_UNIFORM.byteOffset, count * 3) : undefined;

    const matrix = Matrix3d.createIdentity();
    const position = Point3d.createZero();
    const upNormal = Vector3d.create(0, 0, 1);
    const rightNormal = Vector3d.create(1, 0, 0);
    const scale = Vector3d.create(1, 1, 1);

    const transformCenter = this._range.center;
    const transforms = new Float32Array(12 * count);
    for (let i = 0; i < count; i++) {
      const index = i * 3;
      if (positions)
        position.set(positions[index] - transformCenter.x, positions[index + 1] - transformCenter.y, positions[index + 2] - transformCenter.z);

      if (upNormals || rightNormals) {
        if (upNormals)
          upNormal.set(upNormals[index], upNormals[index + 1], upNormals[index + 2]);

        if (rightNormals)
          rightNormal.set(rightNormals[index], rightNormals[index + 1], rightNormals[index + 2]);

        if (scales)
          scale.x = scale.y = scale.z = scales[i];

        if (nonUniformScales) {
          scale.x *= nonUniformScales[index + 0];
          scale.y *= nonUniformScales[index + 1];
          scale.z *= nonUniformScales[index + 2];
        }

        Matrix3d.createRigidFromColumns(rightNormal, upNormal, AxisOrder.XYZ, matrix);
        if (scales || nonUniformScales)
          matrix.scaleColumnsInPlace(scale.x, scale.y, scale.z);

        setTransform(transforms, i, matrix, position);
      }
    }

    let featureIds;
    if (undefined !== batchIds) {
      featureIds = new Uint8Array(3 * batchIds.length);
      for (let i = 0, j = 0; i < batchIds.length; i++) {
        const batchId = batchIds[i];
        featureIds[j++] = batchId & 0x000000ff;
        featureIds[j++] = (batchId & 0x0000ff00) >> 8;
        featureIds[j++] = (batchId & 0x00ff0000) >> 16;
      }
    }
    const symbologyOverrides = undefined;

    return { count, transforms, symbologyOverrides, featureIds, transformCenter };
  }
}
