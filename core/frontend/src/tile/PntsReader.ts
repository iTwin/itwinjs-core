/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import {
  assert,
  ByteStream,
  Id64String,
  utf8ToString,
} from "@bentley/bentleyjs-core";
import {
  Angle,
  Matrix3d,
  Point3d,
  Transform,
  Vector3d,
} from "@bentley/geometry-core";
import {
  BatchType,
  ElementAlignedBox3d,
  Feature,
  FeatureTable,
  PackedFeatureTable,
  PntsHeader,
  QParams3d,
  Quantization,
} from "@bentley/imodeljs-common";
import {
  GraphicBranch,
  RenderGraphic,
  RenderSystem,
} from "../render/System";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { IModelConnection } from "../IModelConnection";

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

  if (undefined === featureValue) { }
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
  const qParams = QParams3d.fromOriginAndScale(qOrigin, qScale);
  const qPoints = new Uint16Array(stream.arrayBuffer, featureTableJsonOffset + header.featureTableJsonLength + featureValue.POSITION_QUANTIZED.byteOffset, 3 * featureValue.POINTS_LENGTH);
  let colors: Uint8Array | undefined;

  if (undefined !== featureValue.RGB) {
    colors = new Uint8Array(stream.arrayBuffer, featureTableJsonOffset + header.featureTableJsonLength + featureValue.RGB.byteOffset, 3 * featureValue.POINTS_LENGTH);
  } else {
    colors = new Uint8Array(3 * featureValue.POINTS_LENGTH);
    colors.fill(0xff, 0, colors.length);    // TBD... Default color?
  }

  // ###TODO? Do we expect a batch table? not currently handled...
  const featureTable = new FeatureTable(1, modelId, BatchType.Primary);
  const features = new Mesh.Features(featureTable);
  features.add(new Feature(modelId), 1);

  let renderGraphic = system.createPointCloud(new PointCloudArgs(qPoints, qParams, colors, features), iModel);
  renderGraphic = system.createBatch(renderGraphic!, PackedFeatureTable.pack(featureTable), range);

  if (yAxisUp) {
    const branch = new GraphicBranch();
    branch.add(renderGraphic!);
    const transform = Transform.createOriginAndMatrix(undefined, Matrix3d.createRotationAroundVector(Vector3d.create(1.0, 0.0, 0.0), Angle.createRadians(Angle.piOver2Radians)) as Matrix3d);

    renderGraphic = system.createBranch(branch, transform);
  }

  return renderGraphic;
}
