/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { dispose } from "@bentley/bentleyjs-core";
import { QParams3d } from "@bentley/imodeljs-common";
import { Primitive } from "./Primitive";
import { Target } from "./Target";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { PointStringParams } from "../primitives/VertexTable";
import { VertexLUT } from "./VertexLUT";
import { FeaturesInfo } from "./FeaturesInfo";
import { AttributeHandle, BufferHandle } from "./Handle";
import { GL } from "./GL";
import { System } from "./System";
import { ShaderProgramParams } from "./DrawCommand";

export class PointStringGeometry extends LUTGeometry {
  public readonly vertexParams: QParams3d;
  public readonly features: FeaturesInfo | undefined;
  public readonly weight: number;
  public readonly lut: VertexLUT;
  public readonly indices: BufferHandle;
  public readonly numIndices: number;

  private constructor(indices: BufferHandle, numIndices: number, lut: VertexLUT, qparams: QParams3d, weight: number, features?: FeaturesInfo) {
    super();
    this.numIndices = numIndices;
    this.indices = indices;
    this.lut = lut;
    this.vertexParams = qparams;
    this.weight = weight;
    this.features = features;
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointString; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueLinear; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.features; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this.indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  protected _getLineWeight(_params: ShaderProgramParams): number { return this.weight; }

  public draw(): void {
    const gl = System.instance.context;
    this.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Points, 0, this.numIndices);
  }

  public static create(params: PointStringParams): PointStringGeometry | undefined {
    const indices = BufferHandle.createArrayBuffer(params.indices.data);
    if (undefined === indices)
      return undefined;

    const lut = VertexLUT.createFromVertexTable(params.vertices);
    if (undefined === lut)
      return undefined;

    return new PointStringGeometry(indices, params.indices.length, lut, params.vertices.qparams, params.weight, FeaturesInfo.createFromVertexTable(params.vertices));
  }

  public dispose() {
    dispose(this.lut);
    dispose(this.indices);
  }
}

export class PointStringPrimitive extends Primitive {
  public static create(params: PointStringParams): PointStringPrimitive | undefined {
    const geom = PointStringGeometry.create(params);
    return undefined !== geom ? new PointStringPrimitive(geom) : undefined;
  }

  private constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }

  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
}
