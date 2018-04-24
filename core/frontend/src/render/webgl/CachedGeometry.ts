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

  // Returns true if white portions of this geometry should render as black on white background
  protected abstract wantWoWReversal(target: Target): boolean;
  // Returns the edge/line weight used to render this geometry
  protected abstract getLineWeight(params: ShaderProgramParams): number;
  // Returns the edge/line pattern used to render this geometry
  protected abstract getLineCode(params: ShaderProgramParams): number;

  // Returns the ID of the Technique used to render this geometry
  public abstract getTechniqueId(target: Target): TechniqueId;
  // Returns the pass in which to render this geometry. RenderPass.None indicates it should not be rendered.
  public abstract getRenderPass(target: Target): RenderPass;
  // Returns the 'order' of this geometry, which determines how z-fighting is resolved.
  public abstract getRenderOrder(): RenderOrder;
  // Binds this geometry's vertex data to the vertex attribute.
  public abstract bindVertexArray(gl: WebGLRenderingContext, handle: AttributeHandle): void;
  // Returns the origin of this geometry's quantization parameters.
  public abstract get qOrigin(): Float32Array;
  // Returns the scale of this geometry's quantization parameters.
  public abstract get qScale(): Float32Array;

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
