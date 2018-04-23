/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { QPoint3dList } from "@bentley/imodeljs-common";
import { AttributeHandle } from "./Handle";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder } from "./RenderFlags";

export class PointCloudGeometryCreateParams {
  public readonly vertices = new QPoint3dList();
  public colors: number[] = [];
  public pointSize: number;
  public constructor(vertices: QPoint3dList, colors: number[], pointSize: number) { this.vertices = vertices.clone(); this.colors = colors; this.pointSize = pointSize; }
}

export abstract class CachedGeometry {
  //// public static BufferHandle generateBuffer(gl: WebGLRenderingContext, glTarget: number, glSize: number, glData: any) {
  //// }

  protected abstract wantWoWReversal(target: Target): boolean;
  protected abstract getLineWeight(params: ShaderProgramParams): number;
  protected abstract getLineCode(params: ShaderProgramParams): number;

  public abstract getTechniqueId(target: Target): TechniqueId;
  public abstract getRenderPass(target: Target): RenderPass;
  public abstract getRenderOrder(): RenderOrder;
  public abstract bindVertexArray(gl: WebGLRenderingContext, handle: AttributeHandle): void;
  //// public abstract get vertexParams(): QParams3d;

  public toIndexedGeometry(): IndexedGeometry | undefined { return undefined; }
  public toViewportQuad(): ViewportQuadGeometry | undefined { return undefined; }
}

export abstract class IndexedGeometry extends CachedGeometry { /* ###TODO */ }
export abstract class ViewportQuadGeometry extends IndexedGeometry { /* ###TODO */ }
//// export abstract class IndexedGeometry extends CachedGeometry {
////   private readonly _vertexBuffer: QBufferHandle3d;
////   private readonly _indexBuffer: BufferHandle;
////   private readonly _indicesCount: number;
////
////   protected constructor(
//// }
