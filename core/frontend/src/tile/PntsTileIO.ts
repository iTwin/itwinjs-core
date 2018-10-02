/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";
import { ElementAlignedBox3d, QParams3d, Quantization, Feature, FeatureTable, BatchType } from "@bentley/imodeljs-common";
import { Id64, assert } from "@bentley/bentleyjs-core";
import { RenderSystem, RenderGraphic, GraphicBranch, PackedFeatureTable } from "../render/System";
import { utf8ToString } from "@bentley/bentleyjs-core";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { Transform, Point3d, Matrix3d, Angle, Vector3d } from "@bentley/geometry-core";
import { IModelConnection } from "../IModelConnection";

/** Deserializes a Pnts tile. */
export namespace PntsTileIO {
  /** @hidden */
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

  /** Deserialize a point cloud tile and return it as a RenderGraphic */
  export function readPointCloud(stream: TileIO.StreamBuffer, iModel: IModelConnection, modelId: Id64, _is3d: boolean, range: ElementAlignedBox3d, system: RenderSystem, yAxisUp: boolean): RenderGraphic | undefined {
    const header: Header = new Header(stream);

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
}
