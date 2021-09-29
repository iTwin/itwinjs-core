/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream, Id64String, utf8ToString } from "@itwin/core-bentley";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { BatchType, ElementAlignedBox3d, Feature, FeatureTable, PackedFeatureTable, PntsHeader, QParams3d, Quantization } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";

/** Deserialize a point cloud tile and return it as a RenderGraphic.
 * @internal
 */
export function readPointCloudTileContent(stream: ByteStream, iModel: IModelConnection, modelId: Id64String, _is3d: boolean, range: ElementAlignedBox3d, system: RenderSystem): RenderGraphic | undefined {
  const header = new PntsHeader(stream);

  if (!header.isValid)
    return undefined;

  const featureTableJsonOffset = stream.curPos;
  const featureStrData = stream.nextBytes(header.featureTableJsonLength);
  const featureStr = utf8ToString(featureStrData);
  const featureValue = JSON.parse(featureStr as string);

  if (undefined === featureValue)
    return undefined;

  let qParams, qPoints;
  let colors: Uint8Array | undefined;
  const dracoPointExtension = featureValue.extensions ? featureValue.extensions["3DTILES_draco_point_compression"] : undefined;
  const dataOffset = featureTableJsonOffset + header.featureTableJsonLength;
  if (dracoPointExtension && dracoPointExtension.byteLength !== undefined && dracoPointExtension.byteOffset !== undefined && dracoPointExtension.properties?.POSITION !== undefined) {
    return undefined; // Defer Draco decompression until web workers implementation.
    /*
    const bufferData = new Uint8Array(stream.arrayBuffer, dataOffset + dracoPointExtension.byteOffset, dracoPointExtension.byteLength);
    const decoded = DracoDecoder.readDracoPointCloud(bufferData, dracoPointExtension.properties?.POSITION, dracoPointExtension.properties?.RGB);
    if (decoded) {
      qPoints = decoded.qPoints;
      qParams = decoded.qParams;
      colors = decoded.colors; */
  } else {
    if (undefined === featureValue.POSITION_QUANTIZED ||
      undefined === featureValue.QUANTIZED_VOLUME_OFFSET ||
      undefined === featureValue.QUANTIZED_VOLUME_SCALE ||
      undefined === featureValue.POINTS_LENGTH ||
      undefined === featureValue.POSITION_QUANTIZED) {
      assert(false, "quantized point cloud points not found");
      return undefined;
    }

    const qOrigin = new Point3d(featureValue.QUANTIZED_VOLUME_OFFSET[0], featureValue.QUANTIZED_VOLUME_OFFSET[1], featureValue.QUANTIZED_VOLUME_OFFSET[2]);
    const qScale = new Point3d(Quantization.computeScale(featureValue.QUANTIZED_VOLUME_SCALE[0]), Quantization.computeScale(featureValue.QUANTIZED_VOLUME_SCALE[1]), Quantization.computeScale(featureValue.QUANTIZED_VOLUME_SCALE[2]));
    qParams = QParams3d.fromOriginAndScale(qOrigin, qScale);
    qPoints = new Uint16Array(stream.arrayBuffer, dataOffset + featureValue.POSITION_QUANTIZED.byteOffset, 3 * featureValue.POINTS_LENGTH);
    if (undefined !== featureValue.RGB)
      colors = new Uint8Array(stream.arrayBuffer, dataOffset + featureValue.RGB.byteOffset, 3 * featureValue.POINTS_LENGTH);
  }
  if (!qPoints || !qParams)
    return undefined;

  if (featureValue.RTC_CENTER)
    qParams = QParams3d.fromOriginAndScale(qParams.origin.plus(Vector3d.fromJSON(featureValue.RTC_CENTER)), qParams.scale);

  if (undefined === colors) {
    colors = new Uint8Array(3 * featureValue.POINTS_LENGTH);
    colors.fill(0xff, 0, colors.length);    // TBD... Default color?
  }

  // ###TODO? Do we expect a batch table? not currently handled...
  const featureTable = new FeatureTable(1, modelId, BatchType.Primary);
  const features = new Mesh.Features(featureTable);
  features.add(new Feature(modelId), 1);
  const voxelSize = qParams.rangeDiagonal.maxAbs() / 256;

  let renderGraphic = system.createPointCloud(new PointCloudArgs(qPoints, qParams, colors, features, voxelSize), iModel);
  renderGraphic = system.createBatch(renderGraphic!, PackedFeatureTable.pack(featureTable), range);
  return renderGraphic;
}
