/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ByteStream, Id64String, Logger, utf8ToString } from "@itwin/core-bentley";
import { Point3d, Range3d, Vector3d } from "@itwin/core-geometry";
import { BatchType, ElementAlignedBox3d, Feature, FeatureTable, PackedFeatureTable, PntsHeader, QParams3d, QPoint3d, Quantization } from "@itwin/core-common";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import { IModelConnection } from "../IModelConnection";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";

/** Schema for the [3DTILES_draco_point_compression](https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_draco_point_compression) extension. */
interface DracoPointCloud {
  byteLength: number;
  byteOffset: number;
  /** Each specifies the Id of a compressed attribute. */
  properties: {
    POSITION?: number; // eslint-disable-line @typescript-eslint/naming-convention
    RGB?: number; // eslint-disable-line @typescript-eslint/naming-convention
    RGBA?: number; // eslint-disable-line @typescript-eslint/naming-convention
    NORMAL?: number; // eslint-disable-line @typescript-eslint/naming-convention
    BATCH_ID?: number; // eslint-disable-line @typescript-eslint/naming-convention
    /** This is not in the spec but is present in sample data in Cesium's git repository. */
    COLOR_0?: number; // eslint-disable-line @typescript-eslint/naming-convention
  };
}

interface PointCloudProps {
  params: QParams3d;
  points: Uint16Array;
  colors?: Uint8Array;
}

async function decodeDracoPointCloud(buf: Uint8Array): Promise<PointCloudProps | undefined> {
  try {
    const dracoLoader = (await import("@loaders.gl/draco")).DracoLoader;
    const mesh = await dracoLoader.parse(buf, { });
    if (mesh.topology !== "point-list")
      return undefined;

    const pos = mesh.attributes.POSITION?.value;
    if (!pos || (pos.length % 3) !== 0)
      return undefined;

    let colors = mesh.attributes.RGB?.value ?? mesh.attributes.COLOR_0?.value;
    if (!colors) {
      const rgba = mesh.attributes.RGBA?.value;
      if (rgba && (rgba.length % 4) === 0) {
        // We currently don't support alpha channel for point clouds - strip it.
        colors = new Uint8Array(3 * rgba.length / 4);
        let j = 0;
        for (let i = 0; i < rgba.length; i += 4) {
          colors[j++] = rgba[i];
          colors[j++] = rgba[i + 1];
          colors[j++] = rgba[i + 2];
        }
      }
    }

    let posRange: Range3d;
    const bbox = mesh.header?.boundingBox;
    if (bbox) {
      posRange = Range3d.createXYZXYZ(bbox[0][0], bbox[0][1], bbox[0][2], bbox[1][0], bbox[1][1], bbox[1][2]);
    } else {
      posRange = Range3d.createNull();
      for (let i = 0; i < pos.length; i += 3)
        posRange.extendXYZ(pos[i], pos[i + 1], pos[i + 2]);
    }

    const params = QParams3d.fromRange(posRange);
    const pt = Point3d.createZero();
    const qpt = QPoint3d.create(pt, params);
    const points = new Uint16Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      pt.set(pos[i], pos[i + 1], pos[i + 2]);
      qpt.init(pt, params);
      points[i] = qpt.x;
      points[i + 1] = qpt.y;
      points[i + 2] = qpt.z;
    }

    return { points, params, colors: colors instanceof Uint8Array ? colors : undefined };
  } catch (err) {
    Logger.logWarning(FrontendLoggerCategory.Render, "Failed to decode draco-encoded point cloud");
    Logger.logException(FrontendLoggerCategory.Render, err);
    return undefined;
  }
}

interface PntsProps {
  POSITION_QUANTIZED?: { byteOffset: number }; // eslint-disable-line @typescript-eslint/naming-convention
  QUANTIZED_VOLUME_OFFSET?: number[]; // eslint-disable-line @typescript-eslint/naming-convention
  QUANTIZED_VOLUME_SCALE?: number[]; // eslint-disable-line @typescript-eslint/naming-convention
  POINTS_LENGTH?: number; // eslint-disable-line @typescript-eslint/naming-convention
  RGB?: { byteOffset: number }; // eslint-disable-line @typescript-eslint/naming-convention
}

function readPnts(stream: ByteStream, dataOffset: number, pnts: PntsProps): PointCloudProps | undefined {
  const offset = pnts.QUANTIZED_VOLUME_OFFSET;
  const scale = pnts.QUANTIZED_VOLUME_SCALE;
  const qpos = pnts.POSITION_QUANTIZED;
  const nPts = pnts.POINTS_LENGTH;
  if (!offset || !scale || !qpos || !nPts)
    return undefined;

  const qOrigin = new Point3d(offset[0], offset[1], offset[2]);
  const qScale = new Point3d(Quantization.computeScale(scale[0]), Quantization.computeScale(scale[1]), Quantization.computeScale(scale[2]));

  return {
    params: QParams3d.fromOriginAndScale(qOrigin, qScale),
    points: new Uint16Array(stream.arrayBuffer, dataOffset + qpos.byteOffset, 3 * nPts),
    colors: pnts.RGB ? new Uint8Array(stream.arrayBuffer, dataOffset + pnts.RGB.byteOffset, 3 * nPts) : undefined,
  };
}

/** Deserialize a point cloud tile and return it as a RenderGraphic.
 * @internal
 */
export async function readPointCloudTileContent(stream: ByteStream, iModel: IModelConnection, modelId: Id64String, _is3d: boolean, range: ElementAlignedBox3d, system: RenderSystem): Promise<RenderGraphic | undefined> {
  const header = new PntsHeader(stream);
  if (!header.isValid)
    return undefined;

  const featureTableJsonOffset = stream.curPos;
  const featureStrData = stream.nextBytes(header.featureTableJsonLength);
  const featureStr = utf8ToString(featureStrData);
  const featureValue = JSON.parse(featureStr as string);

  if (undefined === featureValue)
    return undefined;

  let props: PointCloudProps | undefined;
  const dataOffset = featureTableJsonOffset + header.featureTableJsonLength;
  const draco: DracoPointCloud | undefined = featureValue.extensions ? featureValue.extensions["3DTILES_draco_point_compression"] : undefined;
  if (draco) {
    try {
      const buf = new Uint8Array(stream.arrayBuffer, dataOffset + draco.byteOffset, draco.byteLength);
      props = await decodeDracoPointCloud(buf);
    } catch (_) {
      //
    }
  } else {
    props = readPnts(stream, dataOffset, featureValue);
  }

  if (!props)
    return undefined;

  if (featureValue.RTC_CENTER)
    props.params = QParams3d.fromOriginAndScale(props.params.origin.plus(Vector3d.fromJSON(featureValue.RTC_CENTER)), props.params.scale);

  if (!props.colors) {
    props.colors = new Uint8Array(3 * featureValue.POINTS_LENGTH);
    props.colors.fill(0xff, 0, props.colors.length);    // TBD... Default color?
  }

  // ###TODO? Do we expect a batch table? not currently handled...
  const featureTable = new FeatureTable(1, modelId, BatchType.Primary);
  const features = new Mesh.Features(featureTable);
  features.add(new Feature(modelId), 1);
  const voxelSize = props.params.rangeDiagonal.maxAbs() / 256;

  let renderGraphic = system.createPointCloud(new PointCloudArgs(props.points, props.params, props.colors, features, voxelSize), iModel);
  renderGraphic = system.createBatch(renderGraphic!, PackedFeatureTable.pack(featureTable), range);
  return renderGraphic;
}
