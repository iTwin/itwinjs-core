/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
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

export class PointCloudGraphic extends Primitive {
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  public addCommands(commands: RenderCommands): void { commands.addPrimitive(this); }
  public dispose(): void {
  }
  public static create(args: PointCloudArgs) {
    return new PointCloudGraphic(args);
  }

  private constructor(args: PointCloudArgs) {
    super(new PointCloudGeometry(args));
  }
}
export class PointCloudGeometry extends CachedGeometry {
  private vertices: QBufferHandle3d;
  private vertexCount: number;
  private colorHandle: BufferHandle | undefined = undefined;

  public dispose() { dispose(this.vertices); }

  constructor(pointCloud: PointCloudArgs) {
    super();
    this.vertices = QBufferHandle3d.create(pointCloud.pointParams, pointCloud.points) as QBufferHandle3d;
    this.vertexCount = pointCloud.points.length / 3;
    if (undefined !== pointCloud.colors)
      this.colorHandle = BufferHandle.createArrayBuffer(pointCloud.colors);
  }

  protected _wantWoWReversal(_target: Target): boolean { return false; }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointCloud; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueGeneral; }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  public get qOrigin(): Float32Array { return this.vertices.origin; }
  public get qScale(): Float32Array { return this.vertices.scale; }
  public get colors(): BufferHandle | undefined { return this.colorHandle; }
  public bindVertexArray(attr: AttributeHandle): void { attr.enableArray(this.vertices, 3, GL.DataType.UnsignedShort, false, 0, 0); }
  public draw(): void {
    const gl = System.instance.context;
    gl.drawArrays(GL.PrimitiveType.Points, 0, this.vertexCount);
  }
}

export class PointCloudPrimitive extends Primitive {

  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  protected constructor(cachedGeom: PointCloudGeometry, _pointCloud: PointCloudGraphic) {
    super(cachedGeom);
  }
}
