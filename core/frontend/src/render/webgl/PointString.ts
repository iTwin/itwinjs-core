/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { dispose, assert } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { FeatureIndexType, QParams3d } from "@bentley/imodeljs-common";
import { Target } from "./Target";
import { LUTGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { PointStringParams } from "../primitives/VertexTable";
import { VertexLUT } from "./VertexLUT";
import { BufferHandle, BuffersContainer, BufferParameters } from "./Handle";
import { GL } from "./GL";
import { System } from "./System";
import { ShaderProgramParams } from "./DrawCommand";
import { RenderMemory } from "../System";
import { AttributeMap } from "./AttributeMap";

/** @internal */
export class PointStringGeometry extends LUTGeometry {
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
    this.buffers = BuffersContainer.create();
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.PointString, false);
    assert(undefined !== attrPos);
    this.buffers.addBuffer(indices, [BufferParameters.create(attrPos!.location, 3, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this.numIndices = numIndices;
    this.indices = indices;
    this.lut = lut;
    this.vertexParams = qparams;
    this.weight = weight;
    this._hasFeatures = hasFeatures;
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }

  public get techniqueId(): TechniqueId { return TechniqueId.PointString; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueLinear; }
  public get hasFeatures() { return this._hasFeatures; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  protected _getLineWeight(_params: ShaderProgramParams): number { return this.weight; }

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

  public dispose() {
    dispose(this.buffers);
    dispose(this.lut);
    dispose(this.indices);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVertexTable(this.lut.bytesUsed);
    stats.addPointString(this.indices.bytesUsed);
  }
}
