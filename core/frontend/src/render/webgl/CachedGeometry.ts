/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { QPoint3dList, QParams3d } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { AttributeHandle, BufferHandle, QBufferHandle3d } from "./Handle";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { LineCode } from "./EdgeOverrides";
import { GL } from "./GL";

export class PointCloudGeometryCreateParams {
  public readonly vertices = new QPoint3dList();
  public colors: number[] = [];
  public pointSize: number;
  public constructor(vertices: QPoint3dList, colors: number[], pointSize: number) { this.vertices = vertices.clone(); this.colors = colors; this.pointSize = pointSize; }
}

// Represents a geometric primitive ready to be submitted to the GPU for rendering.
export abstract class CachedGeometry {
  // Returns true if white portions of this geometry should render as black on white background
  protected abstract _wantWoWReversal(target: Target): boolean;
  // Returns the edge/line weight used to render this geometry
  protected abstract _getLineWeight(params: ShaderProgramParams): number;
  // Returns the edge/line pattern used to render this geometry
  protected abstract _getLineCode(params: ShaderProgramParams): number;

  // Returns the ID of the Technique used to render this geometry
  public abstract getTechniqueId(target: Target): TechniqueId;
  // Returns the pass in which to render this geometry. RenderPass.None indicates it should not be rendered.
  public abstract getRenderPass(target: Target): RenderPass;
  // Returns the 'order' of this geometry, which determines how z-fighting is resolved.
  public abstract get renderOrder(): RenderOrder;
  // Returns true if this is a lit surface
  public abstract get isLitSurface(): boolean;

  // Returns the origin of this geometry's quantization parameters.
  public abstract get qOrigin(): Float32Array;
  // Returns the scale of this geometry's quantization parameters.
  public abstract get qScale(): Float32Array;
  // Binds this geometry's vertex data to the vertex attribute.
  public abstract bindVertexArray(gl: WebGLRenderingContext, handle: AttributeHandle): void;
  // Draws this geometry
  public abstract draw(gl: WebGLRenderingContext): void;

  // Intended to be overridden by specific subclasses
  public get material(): MaterialData | undefined { return undefined; }
  public get polylineBuffers(): PolylineBuffers | undefined { return undefined; }
  public set uniformFeatureIndices(value: number) { assert(undefined !== value); } // silence 'unused variable' warning...
  public abstract get featuresInfo(): FeaturesInfo | undefined;

  public get isEdge(): boolean {
    switch (this.renderOrder) {
      case RenderOrder.Edge:
      case RenderOrder.Silhouette:
      case RenderOrder.PlanarEdge:
      case RenderOrder.PlanarSilhouette:
        return true;
      default:
        return false;
    }
  }
  public wantWoWReversal(params: ShaderProgramParams): boolean {
    return !params.isOverlayPass && this._wantWoWReversal(params.target);
  }
  public getLineCode(params: ShaderProgramParams): number {
    return params.target.currentViewFlags.showStyles ? this._getLineCode(params) : LineCode.solid;
  }
  public getLineWeight(params: ShaderProgramParams): number {
    if (!params.target.currentViewFlags.showWeights) {
      return 1.0;
    }

    let weight = this._getLineWeight(params);
    weight = Math.max(weight, 1.0);
    weight = Math.min(weight, 31.0);
    assert(Math.floor(weight) === weight);
    return weight;
  }

  // Convenience functions for down-casting
  public toEdge(): EdgeGeometry | undefined { return undefined; }
  public toSilhouette(): SilhouetteGeometry | undefined { return undefined; }
  public toPointString(): PointStringGeometry | undefined { return undefined; }
  public toViewportQuad(): ViewportQuadGeometry | undefined { return undefined; }
  public toTexturedViewportQuad(): TexturedViewportQuadGeometry | undefined { return undefined; }
  public toComposite(): CompositeGeometry | undefined { return undefined; }
}

// Parameters used to construct an IndexedGeometry
export class IndexedGeometryParams {
  public readonly positions: QBufferHandle3d;
  public readonly indices: BufferHandle;
  public readonly numIndices: number;

  protected constructor(positions: QBufferHandle3d, indices: BufferHandle, numIndices: number) {
    this.positions = positions;
    this.indices = indices;
    this.numIndices = numIndices;
  }

  public static create(gl: WebGLRenderingContext, positions: Float32Array, qparams: QParams3d, indices: Uint32Array) {
    const posBuf = QBufferHandle3d.create(gl, qparams, positions);
    const indBuf = BufferHandle.createBuffer(gl, GL.Buffer.Target.ElementArrayBuffer, indices);
    if (undefined === posBuf || undefined === indBuf) {
      assert(false);
      return undefined;
    }

    assert(posBuf.isValid && indBuf.isValid);
    return new IndexedGeometryParams(posBuf, indBuf, indices.length);
  }
  public static createFromList(gl: WebGLRenderingContext, positions: QPoint3dList, indices: Uint32Array) {
    return IndexedGeometryParams.create(gl, positions.toTypedArray(), positions.params, indices);
  }
}

// A geometric primitive which is rendered using gl.drawElements() with one or more vertex buffers indexed by an index buffer.
export abstract class IndexedGeometry extends CachedGeometry {
  protected readonly params: IndexedGeometryParams;

  protected constructor(params: IndexedGeometryParams) {
    super();
    this.params = params;
  }

  public bindVertexArray(gl: WebGLRenderingContext, attr: AttributeHandle): void {
    attr.enableArray(gl, this.params.positions, 3, GL.DataType.UnsignedShort, false, 0, 0);
  }
  public draw(gl: WebGLRenderingContext): void {
    this.params.indices.bind(gl, GL.Buffer.Target.ElementArrayBuffer);
    gl.drawElements(GL.PrimitiveType.Triangles, this.params.numIndices, GL.DataType.UnsignedInt, 0);
  }

  public get qOrigin() { return this.params.positions.origin; }
  public get qScale() { return this.params.positions.scale; }
}

export abstract class ViewportQuadGeometry extends IndexedGeometry { /* ###TODO */ }
export abstract class TexturedViewportQuadGeometry extends ViewportQuadGeometry { /* ###TODO */ }
export abstract class CompositeGeometry extends TexturedViewportQuadGeometry { /* ###TODO */ }
export abstract class EdgeGeometry { /* ###TODO */ }
export abstract class PointStringGeometry { /* ###TODO */ }
export abstract class SilhouetteGeometry { /* ###TODO */ }
export abstract class MaterialData { /* ###TODO */ }
export abstract class PolylineBuffers { /* ###TODO */ }
export abstract class FeaturesInfo { /* ###TODO */ }
