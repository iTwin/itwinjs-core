/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { Graphic } from "./Graphic";
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
import { RenderCommands } from "./DrawCommand";
import { Primitive } from "./Primitive";
import { CachedGeometry } from "./CachedGeometry";
import { AttributeHandle, QBufferHandle3d } from "./Handle";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target } from "./Target";
import { GL } from "./GL";
import { System } from "./System";

export class PointCloudGraphic extends Graphic {
  public readonly args: PointCloudArgs;
  public addCommands(_commands: RenderCommands): void {
  }
  public dispose(): void {
  }
  public static create(args: PointCloudArgs) {
    return new PointCloudGraphic(args);
  }

  private constructor(args: PointCloudArgs) {
    super();
    this.args = args;
  }
}
export class PointCloudGeometry extends CachedGeometry {
  private vertices: QBufferHandle3d;
  private vertexCount: number;

  constructor(pointCloud: PointCloudArgs) {
    super();
    this.vertices = QBufferHandle3d.create(pointCloud.points.params, pointCloud.points.toTypedArray()) as QBufferHandle3d;
    this.vertexCount = pointCloud.points.length;
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointCloud; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueGeneral; }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
  public get qOrigin(): Float32Array { return this.vertices.origin; }
  public get qScale(): Float32Array { return this.vertices.scale; }
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
