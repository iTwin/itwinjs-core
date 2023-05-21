/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ByteStream, Id64String, Logger, utf8ToString } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { BatchType, Feature, FeatureTable, PackedFeatureTable, PntsHeader, QParams3d, QPoint3d, Quantization } from "@itwin/core-common";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import { IModelConnection } from "../IModelConnection";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { RealityTile } from "./internal";

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
  points: Uint16Array | Float32Array;
  colors?: Uint8Array;
}

interface BinaryBodyReference {
  byteOffset: number;
}

/** [3D tiles specification section 10.3](https://docs.opengeospatial.org/cs/18-053r2/18-053r2.html#199).
 * [JSON schema](https://github.com/CesiumGS/3d-tiles/blob/main/specification/schema/pnts.featureTable.schema.json).
 */
interface CommonPntsProps {
  POINTS_LENGTH: number; // eslint-disable-line @typescript-eslint/naming-convention
  RTC_CENTER?: number[]; // eslint-disable-line @typescript-eslint/naming-convention
  CONSTANT_RGBA?: number[]; // eslint-disable-line @typescript-eslint/naming-convention
  RGB?: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention
  RGBA?: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention
  RGB565?: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention

  extensions?: {
    "3DTILES_draco_point_compression"?: DracoPointCloud; // eslint-disable-line @typescript-eslint/naming-convention
  };

  // The following are currently ignored.
  NORMAL?: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention
  NORMAL_OCT16P?: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention
  BATCH_ID?: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention
  BATCH_LENGTH?: number; // eslint-disable-line @typescript-eslint/naming-convention
}

type QuantizedPntsProps = CommonPntsProps & {
  POSITION_QUANTIZED: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention
  QUANTIZED_VOLUME_OFFSET: number[]; // eslint-disable-line @typescript-eslint/naming-convention
  QUANTIZED_VOLUME_SCALE: number[]; // eslint-disable-line @typescript-eslint/naming-convention

  POSITION?: never; // eslint-disable-line @typescript-eslint/naming-convention
};

type UnquantizedPntsProps = CommonPntsProps & {
  POSITION: BinaryBodyReference; // eslint-disable-line @typescript-eslint/naming-convention

  POSITION_QUANTIZED?: never; // eslint-disable-line @typescript-eslint/naming-convention
  QUANTIZED_VOLUME_OFFSET?: never; // eslint-disable-line @typescript-eslint/naming-convention
  QUANTIZED_VOLUME_SCALE?: never; // eslint-disable-line @typescript-eslint/naming-convention
};

type PntsProps = QuantizedPntsProps | UnquantizedPntsProps;

function readPntsColors(stream: ByteStream, dataOffset: number, pnts: PntsProps): Uint8Array | undefined {
  const nPts = pnts.POINTS_LENGTH;
  const nComponents = 3 * nPts;
  if (pnts.RGB)
    return new Uint8Array(stream.arrayBuffer, dataOffset + pnts.RGB.byteOffset, nComponents);

  if (pnts.RGBA) {
    // ###TODO support point cloud transparency.
    const rgb = new Uint8Array(nComponents);
    const rgba = new Uint8Array(stream.arrayBuffer, dataOffset + pnts.RGBA.byteOffset, nComponents);
    for (let i = 0; i < nComponents; i += 4) {
      rgb[i + 0] = rgba[i + 0];
      rgb[i + 1] = rgba[i + 1];
      rgb[i + 2] = rgba[i + 2];
    }

    return rgb;
  } else if (pnts.RGB565) {
    // Each color is 16 bits: 5 red, 6 green, 5 blue.
    const crgb = new Uint16Array(stream.arrayBuffer, dataOffset + pnts.RGB565.byteOffset, nPts);
    const rgb = new Uint8Array(nComponents);
    for (let i = 0; i < nPts; i++) {
      const c = crgb[i];
      rgb[i + 0] = (c >> 11) & 0x1f;
      rgb[i + 1] = (c >> 5) & 0x3f;
      rgb[i + 2] = c & 0x1f;
    }

    return rgb;
  }

  return undefined;
}

function readPnts(stream: ByteStream, dataOffset: number, pnts: PntsProps): PointCloudProps | undefined {
  const nPts = pnts.POINTS_LENGTH;
  let params: QParams3d;
  let points: Uint16Array | Float32Array;

  if (pnts.POSITION_QUANTIZED) {
    const qpos = pnts.POSITION_QUANTIZED;
    const offset = pnts.QUANTIZED_VOLUME_OFFSET;
    const scale = pnts.QUANTIZED_VOLUME_SCALE;

    const qOrigin = new Point3d(offset[0], offset[1], offset[2]);
    const qScale = new Point3d(Quantization.computeScale(scale[0]), Quantization.computeScale(scale[1]), Quantization.computeScale(scale[2]));

    params = QParams3d.fromOriginAndScale(qOrigin, qScale);
    points = new Uint16Array(stream.arrayBuffer, dataOffset + qpos.byteOffset, 3 * nPts);
  } else {
    const qOrigin = new Point3d(0, 0, 0);
    const qScale = new Point3d(1, 1, 1);
    params = QParams3d.fromOriginAndScale(qOrigin, qScale);
    points = new Float32Array(stream.arrayBuffer, dataOffset + pnts.POSITION.byteOffset, 3 * nPts);
  }

  const colors = readPntsColors(stream, dataOffset, pnts);
  return { params, points, colors };
}

async function decodeDracoPointCloud(buf: Uint8Array): Promise<PointCloudProps | undefined> {
  try {
    const dracoLoader = (await import("@loaders.gl/draco")).DracoLoader;
    const mesh = await dracoLoader.parse(buf, {});
    if (mesh.topology !== "point-list")
      return undefined;

    const pos = mesh.attributes.POSITION?.value;
    if (!pos || (pos.length % 3) !== 0)
      return undefined;

    let colors = mesh.attributes.RGB?.value ?? mesh.attributes.COLOR_0?.value;
    if (!colors) {
      // ###TODO support point cloud transparency.
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

/** Deserialize a point cloud tile and return it as a RenderGraphic.
 * @internal
 */
export async function readPointCloudTileContent(stream: ByteStream, iModel: IModelConnection, modelId: Id64String, _is3d: boolean, tile: RealityTile, system: RenderSystem): Promise<{ graphic: RenderGraphic | undefined, rtcCenter: Point3d | undefined }> {
  let graphic;
  let rtcCenter;
  const header = new PntsHeader(stream);
  if (!header.isValid)
    return { graphic, rtcCenter };

  const range = tile.contentRange;
  const featureTableJsonOffset = stream.curPos;
  const featureStrData = stream.nextBytes(header.featureTableJsonLength);
  const featureStr = utf8ToString(featureStrData);
  const featureValue = JSON.parse(featureStr as string) as PntsProps;

  if (undefined === featureValue)
    return { graphic, rtcCenter };

  let props: PointCloudProps | undefined;
  const dataOffset = featureTableJsonOffset + header.featureTableJsonLength;
  const draco = featureValue.extensions ? featureValue.extensions["3DTILES_draco_point_compression"] : undefined;
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
    return { graphic, rtcCenter };

  let batchRange = range;
  if (featureValue.RTC_CENTER) {
    rtcCenter = Point3d.fromJSON(featureValue.RTC_CENTER);
    batchRange = range.clone();
    batchRange.low.minus(rtcCenter, batchRange.low);
    batchRange.high.minus(rtcCenter, batchRange.high);
  }

  if (!props.colors) {
    // ###TODO we really should support uniform color instead of allocating an RGB value per point...
    props.colors = new Uint8Array(3 * featureValue.POINTS_LENGTH);
    const rgba = featureValue.CONSTANT_RGBA;
    if (rgba) {
      // ###TODO support point cloud transparency.
      for (let i = 0; i < featureValue.POINTS_LENGTH * 3; i += 3) {
        props.colors[i] = rgba[0];
        props.colors[i + 1] = rgba[1];
        props.colors[i + 2] = rgba[2];
      }
    } else {
      // Default to white.
      props.colors.fill(0xff, 0, props.colors.length);
    }
  }

  const featureTable = new FeatureTable(1, modelId, BatchType.Primary);
  const features = new Mesh.Features(featureTable);
  features.add(new Feature(modelId), 1);
  let params = props.params;
  if (props.points instanceof Float32Array) {
    // we don't have a true range for unquantized points, so calc one here for voxelSize
    const rng = Range3d.createNull();
    for (let i = 0; i < props.points.length; i += 3)
      rng.extendXYZ(props.points[i], props.points[i + 1], props.points[i + 2]);
    params = QParams3d.fromRange(rng);
  }
  // 256 here is tile.maximumSize (on non-additive refinement tiles)
  // If additiveRefinement, set voxelSize to 0 which will cause it draw to with minPixelsPerVoxel, which defaults to 2
  // That way, it will draw as if in pixel mode, and voxelScale will still function
  // Checking across a variety of 10 point clouds, 2 to 4 seems to work well for pixel settings (depending on the
  // cloud), so 2 is a decent default
  // (If voxelSize is used normally in this case, it draws different size pixels for different tiles, and since
  // they can overlap ranges, no good way found to calculate a voxelSize)
  const voxelSize = tile.additiveRefinement ? 0 : params.rangeDiagonal.maxAbs() / 256;

  graphic = system.createPointCloud({
    positions: props.points,
    qparams: props.params,
    colors: props.colors,
    features: features.toFeatureIndex(),
    voxelSize,
    colorFormat: "rgb",
  }, iModel);

  graphic = system.createBatch(graphic!, PackedFeatureTable.pack(featureTable), batchRange);
  return { graphic, rtcCenter };
}
