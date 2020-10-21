/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream, Id64String, utf8ToString } from "@bentley/bentleyjs-core";
import { Angle, Matrix3d, Point3d, Transform, Vector3d } from "@bentley/geometry-core";
import {
  BatchType, ElementAlignedBox3d, Feature, FeatureTable, PackedFeatureTable, PntsHeader, QParams3d, Quantization,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { GraphicBranch } from "../render/GraphicBranch";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { extractFlashedVolumeClassifierCommands } from "../render/webgl/DrawCommand";
import { DracoDecoder } from "./DracoDecoder";

/** Deserialize a point cloud tile and return it as a RenderGraphic.
 * @internal
 */
export function readPointCloudTileContent(stream: ByteStream, iModel: IModelConnection, modelId: Id64String, _is3d: boolean,
  range: ElementAlignedBox3d, system: RenderSystem, yAxisUp: boolean): RenderGraphic | undefined {
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
  let dracoPointExtension = featureValue.extensions ? featureValue.extensions["3DTILES_draco_point_compression"] : undefined;
  const dataOffset = featureTableJsonOffset + header.featureTableJsonLength;
  if (dracoPointExtension && dracoPointExtension.byteLength !== undefined && dracoPointExtension.byteOffset !== undefined && dracoPointExtension.properties?.POSITION !== undefined) {
    const bufferData = new Uint8Array(stream.arrayBuffer, dataOffset + dracoPointExtension.byteOffset, dracoPointExtension.byteLength);
    const qParamsAndPoints = DracoDecoder.readDracoPointCloud(bufferData, dracoPointExtension.properties?.POSITION);
    if (qParamsAndPoints) {
      qPoints = qParamsAndPoints.qPoints;
      qParams = qParamsAndPoints.qParams;
    }
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
  }
  let colors: Uint8Array | undefined;

  if (undefined !== featureValue.RGB) {
    colors = new Uint8Array(stream.arrayBuffer, dataOffset + featureValue.RGB.byteOffset, 3 * featureValue.POINTS_LENGTH);
  } else {
    colors = new Uint8Array(3 * featureValue.POINTS_LENGTH);
    colors.fill(0xff, 0, colors.length);    // TBD... Default color?
  }
  if (!qPoints || !qParams)
    return undefined;

  if (featureValue.RTC_CENTER)
    qParams = QParams3d.fromOriginAndScale(qParams.origin.plus(Vector3d.fromJSON(featureValue.RTC_CENTER)), qParams.scale);

  // ###TODO? Do we expect a batch table? not currently handled...
  const featureTable = new FeatureTable(1, modelId, BatchType.Primary);
  const features = new Mesh.Features(featureTable);
  features.add(new Feature(modelId), 1);
  const voxelSize = qParams.rangeDiagonal.magnitude() / 256;

  let renderGraphic = system.createPointCloud(new PointCloudArgs(qPoints, qParams, colors, features, voxelSize), iModel);
  renderGraphic = system.createBatch(renderGraphic!, PackedFeatureTable.pack(featureTable), range);

  if (yAxisUp) {
    const branch = new GraphicBranch();
    branch.add(renderGraphic);
    const transform = Transform.createOriginAndMatrix(undefined, Matrix3d.createRotationAroundVector(Vector3d.create(1.0, 0.0, 0.0), Angle.createRadians(Angle.piOver2Radians)));

    renderGraphic = system.createBranch(branch, transform);
  }

  return renderGraphic;
}
