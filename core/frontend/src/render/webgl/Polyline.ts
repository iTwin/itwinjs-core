/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { QParams3d, RenderMode, PolylineTypeFlags } from "@bentley/imodeljs-common";
import { PolylineParams } from "../primitives/VertexTable";
import { Primitive } from "./Primitive";
import { Target } from "./Target";
import { CachedGeometry, LUTGeometry, PolylineBuffers } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { AttributeHandle } from "./Handle";
import { FeaturesInfo } from "./FeaturesInfo";
import { LineCode } from "./EdgeOverrides";
import { VertexLUT } from "./VertexLUT";
import { ColorInfo } from "./ColorInfo";
import { GL } from "./GL";
import { System } from "./System";
import { ShaderProgramParams } from "./DrawCommand";
import { dispose } from "@bentley/bentleyjs-core";

export class PolylineGeometry extends LUTGeometry {
  public vertexParams: QParams3d;
  public features?: FeaturesInfo;
  public lineWeight: number;
  public lineCode: number;
  public type: PolylineTypeFlags;
  private _isPlanar: boolean;
  public lut: VertexLUT;
  public numIndices: number;
  private _buffers: PolylineBuffers;

  private constructor(lut: VertexLUT, buffers: PolylineBuffers, params: PolylineParams) {
    super();
    this.vertexParams = params.vertices.qparams;
    this.features = FeaturesInfo.createFromVertexTable(params.vertices);
    this.lineWeight = params.weight;
    this.lineCode = LineCode.valueFromLinePixels(params.linePixels);
    this.type = params.type;
    this._isPlanar = params.isPlanar;
    this.lut = lut;
    this.numIndices = params.polyline.indices.length;
    this._buffers = buffers;
  }

  public dispose() {
    dispose(this.lut);
    dispose(this._buffers);
  }

  public get isAnyEdge(): boolean { return PolylineTypeFlags.Normal !== this.type; }
  public get isNormalEdge(): boolean { return PolylineTypeFlags.Edge === this.type; }
  public get isOutlineEdge(): boolean { return PolylineTypeFlags.Outline === this.type; }

  public get renderOrder(): RenderOrder {
    if (this.isAnyEdge)
      return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge;
    else
      return this.isPlanar ? RenderOrder.PlanarLinear : RenderOrder.Linear;
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }

  public get polylineBuffers(): PolylineBuffers | undefined { return this._buffers; }

  private _computeEdgePass(target: Target, colorInfo: ColorInfo): RenderPass {
    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.visibleEdges)
      return RenderPass.None;

    // Only want to return Translucent for edges if rendering in Wireframe mode TODO: what about overrides?
    const isTranslucent: boolean = RenderMode.Wireframe === vf.renderMode && vf.transparency && colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }

  public getRenderPass(target: Target): RenderPass {
    const vf = target.currentViewFlags;
    if (this.isEdge) {
      let pass = this._computeEdgePass(target, this.lut.colorInfo);
      // Only display the outline in wireframe if Fill is off...
      if (RenderPass.None !== pass && this.isOutlineEdge && RenderMode.Wireframe === vf.renderMode && vf.fill)
        pass = RenderPass.None;
      return pass;
    }
    const isTranslucent: boolean = vf.transparency && this.lut.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.Polyline; }
  public get isPlanar(): boolean { return this._isPlanar; }
  public get isEdge(): boolean { return this.isAnyEdge; }
  public get qOrigin(): Float32Array { return this.lut.qOrigin; }
  public get qScale(): Float32Array { return this.lut.qScale; }
  public get numRgbaPerVertex(): number { return this.lut.numRgbaPerVertex; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.features; }

  protected _getLineWeight(params: ShaderProgramParams): number {
    return this.isEdge ? params.target.getEdgeWeight(params, this.lineWeight) : this.lineWeight;
  }
  protected _getLineCode(params: ShaderProgramParams): number {
    return this.isEdge ? params.target.getEdgeLineCode(params, this.lineCode) : this.lineCode;
  }
  public getColor(target: Target): ColorInfo { return this.isEdge && target.isEdgeColorOverridden ? target.edgeColor : this.lut.colorInfo; }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._buffers!.indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    this._buffers!.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this.numIndices);
  }

  public static create(params: PolylineParams): PolylineGeometry | undefined {
    const lut = VertexLUT.createFromVertexTable(params.vertices);
    if (undefined === lut)
      return undefined;

    const buffers = PolylineBuffers.create(params.polyline);
    if (undefined === buffers)
      return undefined;

    return new PolylineGeometry(lut, buffers, params);
  }
}

export class PolylinePrimitive extends Primitive {
  private constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }

  public static create(params: PolylineParams): PolylinePrimitive | undefined {
    const geom = PolylineGeometry.create(params);
    return undefined !== geom ? new PolylinePrimitive(geom) : undefined;
  }

  public get renderOrder(): RenderOrder { return (this.cachedGeometry as PolylineGeometry).renderOrder; }
  public get isPlanar(): boolean { return (this.cachedGeometry as PolylineGeometry).isPlanar; }
  public get isEdge(): boolean { return (this.cachedGeometry as PolylineGeometry).isEdge; }
}
