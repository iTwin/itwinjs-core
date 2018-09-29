/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
import { FeaturesInfo } from "./FeaturesInfo";
import { RenderCommands } from "./DrawCommand";
import { Primitive } from "./Primitive";
import { CachedGeometry } from "./CachedGeometry";
import { AttributeHandle, QBufferHandle3d, BufferHandle } from "./Handle";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target } from "./Target";
import { GL } from "./GL";
import { System } from "./System";
import { dispose } from "@bentley/bentleyjs-core";

export class PointCloudPrimitive extends Primitive {
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  public addCommands(commands: RenderCommands): void { commands.addPrimitive(this); }
  public dispose(): void {
  }
  public static create(args: PointCloudArgs) {
    return new PointCloudPrimitive(args);
  }

  private constructor(args: PointCloudArgs) {
    super(new PointCloudGeometry(args));
  }
}
export class PointCloudGeometry extends CachedGeometry {
  private _vertices: QBufferHandle3d;
  private _vertexCount: number;
  private _colorHandle: BufferHandle | undefined = undefined;
  public features: FeaturesInfo | undefined;

  public dispose() { dispose(this._vertices); }

  constructor(pointCloud: PointCloudArgs) {
    super();
    this._vertices = QBufferHandle3d.create(pointCloud.pointParams, pointCloud.points) as QBufferHandle3d;
    this._vertexCount = pointCloud.points.length / 3;
    this.features = FeaturesInfo.create(pointCloud.features);
    if (undefined !== pointCloud.colors)
      this._colorHandle = BufferHandle.createArrayBuffer(pointCloud.colors);
  }

  protected _wantWoWReversal(_target: Target): boolean { return false; }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointCloud; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueGeneral; }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  public get qOrigin(): Float32Array { return this._vertices.origin; }
  public get qScale(): Float32Array { return this._vertices.scale; }
  public get colors(): BufferHandle | undefined { return this._colorHandle; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.features; }
  public get hasBakedLighting() { return true; }

  public bindVertexArray(attr: AttributeHandle): void { attr.enableArray(this._vertices, 3, GL.DataType.UnsignedShort, false, 0, 0); }
  public draw(): void {
    const gl = System.instance.context;
    gl.drawArrays(GL.PrimitiveType.Points, 0, this._vertexCount);
  }
}
