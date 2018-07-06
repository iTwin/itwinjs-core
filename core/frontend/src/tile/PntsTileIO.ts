/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";
import { ElementAlignedBox3d, QPoint3dList, QParams3d, QPoint3d } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { RenderSystem, RenderGraphic } from "../render/System";
import { GeometricModelState } from "../ModelState";
import { StringUtils } from "@bentley/bentleyjs-core";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";

/** Deserializes an Pnts tile. */
export namespace PntsTileIO {
  class Header extends TileIO.Header {
    public readonly length: number;
    public readonly featureTableJsonLength: number;
    public readonly featureTableBinaryLength: number;
    public readonly batchTableJsonLength: number;
    public readonly batchTableBinaryLength: number;
    public get isValid(): boolean { return TileIO.Format.Pnts === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.length = stream.nextUint32;
      this.featureTableJsonLength = stream.nextUint32;
      this.featureTableBinaryLength = stream.nextUint32;
      this.batchTableJsonLength = stream.nextUint32;
      this.batchTableBinaryLength = stream.nextUint32;
    }
  }
  export function readPointCloud(stream: TileIO.StreamBuffer, model: GeometricModelState, _range: ElementAlignedBox3d, system: RenderSystem, _yAxisUp: boolean): RenderGraphic | undefined {
    const header: Header = new Header(stream);

    if (!header.isValid)
      return undefined;

    const featureTableJsonOffset = stream.curPos;
    const featureStrData = stream.nextBytes(header.featureTableJsonLength);
    const featureStr = StringUtils.utf8ToString(featureStrData);
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
    const qScale = new Point3d(featureValue.QUANTIZED_VOLUME_SCALE[0], featureValue.QUANTIZED_VOLUME_SCALE[1], featureValue.QUANTIZED_VOLUME_SCALE[2]);
    const qParams = QParams3d.fromOriginAndScale(qOrigin, qScale);
    const qPoints = new QPoint3dList(qParams);

    stream.curPos = featureTableJsonOffset + header.featureTableJsonLength + featureValue.POSITION_QUANTIZED.byteOffset;
    const qPoint = QPoint3d.fromScalars(0, 0, 0);
    for (let i = 0; i < featureValue.POINTS_LENGTH; i++)
      qPoints.push(QPoint3d.fromScalars(stream.nextUint16, stream.nextUint16, stream.nextUint16, qPoint));

    return system.createPointCloud(new PointCloudArgs(qPoints), model.iModel);
  }

}
