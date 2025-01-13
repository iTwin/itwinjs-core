/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { FeatureIndexType, QParams3d } from "@itwin/core-common";
import { PointStringParams } from "../../common/internal/render/PointStringParams";
import { RenderMemory } from "../RenderMemory";
import { AttributeMap } from "./AttributeMap";
import { LUTGeometry } from "./CachedGeometry";
import { ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { Pass, RenderOrder } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import { VertexLUT } from "./VertexLUT";
import { RenderGeometry } from "../../internal/render/RenderGeometry";

/** @internal */
export class PointStringGeometry extends LUTGeometry implements RenderGeometry {
  public readonly renderGeometryType: "point-string" = "point-string" as const;
  public readonly isInstanceable: boolean;
  public noDispose = false;
  public readonly buffers: BuffersContainer;
  public readonly vertexParams: QParams3d;
  private readonly _hasFeatures: boolean;
  public readonly weight: number;
  public readonly lut: VertexLUT;
  public readonly indices: BufferHandle;
  public readonly numIndices: number;

  public get lutBuffers() { return this.buffers; }

  private constructor(indices: BufferHandle, numIndices: number, lut: VertexLUT, qparams: QParams3d, weight: number, hasFeatures: boolean, viOrigin: Point3d | undefined) {
    super(viOrigin);
    this.isInstanceable = undefined === viOrigin;
    this.buffers = BuffersContainer.create();
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.PointString, false);
    assert(undefined !== attrPos);
    this.buffers.addBuffer(indices, [BufferParameters.create(attrPos.location, 3, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this.numIndices = numIndices;
    this.indices = indices;
    this.lut = lut;
    this.vertexParams = qparams;
    this.weight = weight;
    this._hasFeatures = hasFeatures;
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }

  public get techniqueId(): TechniqueId { return TechniqueId.PointString; }
  public override getPass(): Pass { return "opaque-linear"; }
  public override get hasFeatures() { return this._hasFeatures; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  protected override _getLineWeight(_params: ShaderProgramParams): number { return this.weight; }

  protected _draw(numInstances: number, instanceBuffersContainer?: BuffersContainer): void {
    const gl = System.instance;
    const bufs = instanceBuffersContainer !== undefined ? instanceBuffersContainer : this.buffers;

    bufs.bind();
    gl.drawArrays(GL.PrimitiveType.Points, 0, this.numIndices, numInstances);
    bufs.unbind();
  }

  public static create(params: PointStringParams, viOrigin: Point3d | undefined): PointStringGeometry | undefined {
    const indices = BufferHandle.createArrayBuffer(params.indices.data);
    if (undefined === indices)
      return undefined;

    const lut = VertexLUT.createFromVertexTable(params.vertices);
    if (undefined === lut)
      return undefined;

    const hasFeatures = FeatureIndexType.Empty !== params.vertices.featureIndexType;
    return new PointStringGeometry(indices, params.indices.length, lut, params.vertices.qparams, params.weight, hasFeatures, viOrigin);
  }

  public get isDisposed(): boolean {
    return this.buffers.isDisposed
      && this.lut.isDisposed
      && this.indices.isDisposed;
  }

  public dispose() {
    if (!this.noDispose) {
      dispose(this.buffers);
      dispose(this.lut);
      dispose(this.indices);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVertexTable(this.lut.bytesUsed);
    stats.addPointString(this.indices.bytesUsed);
  }
}
