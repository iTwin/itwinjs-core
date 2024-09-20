/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { FeatureIndexType } from "@itwin/core-common";
import { PointCloudArgs } from "../../common/internal/render/PointCloudPrimitive";
import { RenderMemory } from "../RenderMemory";
import { AttributeMap } from "./AttributeMap";
import { CachedGeometry } from "./CachedGeometry";
import { ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { BufferHandle, BufferParameters, BuffersContainer, QBufferHandle3d } from "./AttributeBuffers";
import { Pass, RenderOrder } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import { RenderGeometry } from "../../internal/render/RenderGeometry";

/** @internal */
export class PointCloudGeometry extends CachedGeometry implements RenderGeometry {
  public readonly renderGeometryType: "point-cloud" = "point-cloud" as const;
  public readonly isInstanceable = false;
  public noDispose = false;
  public readonly buffers: BuffersContainer;
  private readonly _vertices: QBufferHandle3d;
  private readonly _vertexCount: number;
  private readonly _colorHandle: BufferHandle | undefined = undefined;
  private readonly _hasFeatures: boolean;

  public readonly voxelSize: number;
  public readonly colorIsBgr: boolean;

  public get isDisposed(): boolean { return this.buffers.isDisposed && this._vertices.isDisposed; }
  public override get asPointCloud(): PointCloudGeometry | undefined { return this; }
  public override get supportsThematicDisplay() { return true; }
  public get overrideColorMix() { return .5; }     // This could be a setting from either the mesh or the override if required.

  public dispose() {
    if (!this.noDispose) {
      dispose(this.buffers);
      dispose(this._vertices);
    }
  }

  constructor(pointCloud: PointCloudArgs) {
    super();
    this.buffers = BuffersContainer.create();
    this._vertices = QBufferHandle3d.create(pointCloud.qparams, pointCloud.positions) as QBufferHandle3d;
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.PointCloud, false);
    assert(undefined !== attrPos);
    const vertexDataType = (pointCloud.positions instanceof Float32Array) ? GL.DataType.Float : ((pointCloud.positions instanceof Uint8Array) ? GL.DataType.UnsignedByte : GL.DataType.UnsignedShort);
    this.buffers.addBuffer(this._vertices, [BufferParameters.create(attrPos.location, 3, vertexDataType, false, 0, 0, false)]);
    this._vertexCount = pointCloud.positions.length / 3;
    this._hasFeatures = FeatureIndexType.Empty !== pointCloud.features.type;
    this.voxelSize = pointCloud.voxelSize;
    this.colorIsBgr = "bgr" === pointCloud.colorFormat;

    if (undefined !== pointCloud.colors) {
      this._colorHandle = BufferHandle.createArrayBuffer(pointCloud.colors);
      const attrColor = AttributeMap.findAttribute("a_color", TechniqueId.PointCloud, false);
      assert(undefined !== attrColor);
      this.buffers.addBuffer(this._colorHandle!, [BufferParameters.create(attrColor.location, 3, GL.DataType.UnsignedByte, true, 0, 0, false)]);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const bytesUsed = this._vertices.bytesUsed + (undefined !== this._colorHandle ? this._colorHandle.bytesUsed : 0);
    stats.addPointCloud(bytesUsed);
  }

  protected _wantWoWReversal(_target: Target): boolean { return false; }

  public get techniqueId(): TechniqueId { return TechniqueId.PointCloud; }
  public override getPass(target: Target): Pass {
    // Point clouds don't cast shadows.
    return target.isDrawingShadowMap ? "none" : "point-clouds";
  }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
  public get qOrigin(): Float32Array { return this._vertices.origin; }
  public get qScale(): Float32Array { return this._vertices.scale; }
  public get colors(): BufferHandle | undefined { return this._colorHandle; }
  public override get hasFeatures() { return this._hasFeatures; }
  public override get hasBakedLighting() { return true; }

  public draw(): void {
    this.buffers.bind();
    System.instance.context.drawArrays(GL.PrimitiveType.Points, 0, this._vertexCount);
    this.buffers.unbind();
  }

  // ###TODO delete this.
  public override getLineWeight(_params: ShaderProgramParams): number {
    // If line weight < 0 it is real size in meters (voxel size).
    return (this.voxelSize > 0) ? - this.voxelSize : 1;
  }
}
