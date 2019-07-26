/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
import { FeaturesInfo } from "./FeaturesInfo";
import { CachedGeometry } from "./CachedGeometry";
import { QBufferHandle3d, BufferHandle, BufferParameters, BuffersContainer } from "./Handle";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target } from "./Target";
import { GL } from "./GL";
import { System } from "./System";
import { dispose, assert } from "@bentley/bentleyjs-core";
import { RenderMemory } from "../System";
import { AttributeMap } from "./AttributeMap";

/** @internal */
export class PointCloudGeometry extends CachedGeometry {
  public readonly buffers: BuffersContainer;
  private _vertices: QBufferHandle3d;
  private _vertexCount: number;
  private _colorHandle: BufferHandle | undefined = undefined;
  public features: FeaturesInfo | undefined;

  public dispose() {
    dispose(this.buffers);
    dispose(this._vertices);
  }

  constructor(pointCloud: PointCloudArgs) {
    super();
    this.buffers = BuffersContainer.create();
    this._vertices = QBufferHandle3d.create(pointCloud.pointParams, pointCloud.points) as QBufferHandle3d;
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.PointCloud, false);
    assert(undefined !== attrPos);
    this.buffers.addBuffer(this._vertices, [BufferParameters.create(attrPos!.location, 3, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this._vertexCount = pointCloud.points.length / 3;
    this.features = FeaturesInfo.create(pointCloud.features);
    if (undefined !== pointCloud.colors) {
      this._colorHandle = BufferHandle.createArrayBuffer(pointCloud.colors);
      const attrColor = AttributeMap.findAttribute("a_color", TechniqueId.PointCloud, false);
      assert(undefined !== attrColor);
      this.buffers.addBuffer(this._colorHandle!, [BufferParameters.create(attrColor!.location, 3, GL.DataType.UnsignedByte, true, 0, 0, false)]);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const bytesUsed = this._vertices.bytesUsed + (undefined !== this._colorHandle ? this._colorHandle.bytesUsed : 0);
    stats.addPointCloud(bytesUsed);
  }

  protected _wantWoWReversal(_target: Target): boolean { return false; }

  public get techniqueId(): TechniqueId { return TechniqueId.PointCloud; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueGeneral; }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  public get qOrigin(): Float32Array { return this._vertices.origin; }
  public get qScale(): Float32Array { return this._vertices.scale; }
  public get colors(): BufferHandle | undefined { return this._colorHandle; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.features; }
  public get hasBakedLighting() { return true; }

  public draw(): void {
    this.buffers.bind();
    System.instance.context.drawArrays(GL.PrimitiveType.Points, 0, this._vertexCount);
    this.buffers.unbind();
  }
}
