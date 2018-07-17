/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { QParams3d, QPoint3dList, PolylineFlags, PolylineData, RenderMode } from "@bentley/imodeljs-common";
import { Point3d, Vector3d } from "@bentley/geometry-core";
import { PolylineArgs, MeshArgs } from "../primitives/mesh/MeshPrimitives";
import { Primitive } from "./Primitive";
import { wantJointTriangles } from "./Graphic";
import { Target } from "./Target";
import { CachedGeometry, LUTGeometry, PolylineBuffers } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { AttributeHandle, BufferHandle } from "./Handle";
import { FeaturesInfo } from "./FeaturesInfo";
import { LineCode } from "./EdgeOverrides";
import { VertexLUT } from "./VertexLUT";
import { ColorInfo } from "./ColorInfo";
import { GL } from "./GL";
import { System } from "./System";
import { ShaderProgramParams } from "./DrawCommand";
import { dispose } from "@bentley/bentleyjs-core";

export class PolylineInfo {
  public vertexParams: QParams3d;
  public features: FeaturesInfo | undefined;
  public lineWeight: number;
  public lineCode: number;
  public flags: PolylineFlags;

  public constructor(args: PolylineArgs) {
    this.vertexParams = args.pointParams;
    this.features = FeaturesInfo.create(args.features);
    this.lineWeight = args.width;
    this.lineCode = LineCode.valueFromLinePixels(args.linePixels);
    this.flags = args.flags;
  }

  public get isPlanar(): boolean { return this.flags.isPlanar; }
  public get isAnyEdge(): boolean { return this.flags.isAnyEdge; }
  public get isNormalEdge(): boolean { return this.flags.isNormalEdge; }
  public get isOutlineEdge(): boolean { return this.flags.isOutlineEdge; }
  public get renderOrder(): RenderOrder {
    if (this.isAnyEdge)
      return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge;
    else
      return this.isPlanar ? RenderOrder.PlanarLinear : RenderOrder.Linear;
  }
}

export declare const enum TesselatedPolylineParam {
  kNone = 0,
  kSquare = 1 * 3,
  kMiter = 2 * 3,
  kMiterInsideOnly = 3 * 3,
  kJointBase = 4 * 3,
  kNegatePerp = 8 * 3,
  kNegateAlong = 16 * 3,
  kNoneAdjWt = 32 * 3,
}

export class TesselatedPolyline {
  public vertIndex: Uint8Array;
  public prevIndex: Uint8Array;
  public nextIndexAndParam: Uint8Array;
  public distance: Float32Array;
  public constructor(vertIndex: Uint8Array, prevIndex: Uint8Array, nextIndexAndParam: Uint8Array, distance: Float32Array) {
    this.vertIndex = vertIndex;
    this.prevIndex = prevIndex;
    this.nextIndexAndParam = nextIndexAndParam;
    this.distance = distance;
  }
  public get numIndices(): number { return this.distance.length; }
}

class PolylineTesselatorVertex {
  public isSegmentStart: boolean;
  public isPolylineStartOrEnd: boolean;
  public vertexIndex: number;
  public prevIndex: number;
  public nextIndex: number;
  public distance: number;

  public constructor(isSegmentStart: boolean, isPolylineStartOrEnd: boolean, vertexIndex: number, prevIndex: number, nextIndex: number, distance: number) {
    this.isSegmentStart = isSegmentStart;
    this.isPolylineStartOrEnd = isPolylineStartOrEnd;
    this.vertexIndex = vertexIndex;
    this.prevIndex = prevIndex;
    this.nextIndex = nextIndex;
    this.distance = distance;
    this.prevIndex = prevIndex;
    this.prevIndex = prevIndex;
  }

  public computeParam(negatePerp: boolean, adjacentToJoint: boolean = false, joint: boolean = false, noDisplacement: boolean = false): number {
    if (joint)
      return TesselatedPolylineParam.kJointBase;

    let param: TesselatedPolylineParam = TesselatedPolylineParam.kNone;
    if (noDisplacement)
      param = TesselatedPolylineParam.kNoneAdjWt; // prevent getting tossed before width adjustment
    else if (adjacentToJoint)
      param = TesselatedPolylineParam.kMiterInsideOnly;
    else
      param = this.isPolylineStartOrEnd ? TesselatedPolylineParam.kSquare : TesselatedPolylineParam.kMiter;

    let adjust = 0;
    if (negatePerp)
      adjust = TesselatedPolylineParam.kNegatePerp;
    if (!this.isSegmentStart)
      adjust += TesselatedPolylineParam.kNegateAlong;

    return param + adjust;
  }
}

export class PolylineTesselator {
  private polylines: PolylineData[];
  private points: QPoint3dList;
  private doJoints: boolean;
  private numIndices = 0;
  private vertIndex: number[] = [];
  private prevIndex: number[] = [];
  private nextIndex: number[] = [];
  private nextParam: number[] = [];
  private distance: number[] = [];
  private position: Point3d[] = [];

  private constructor(polylines: PolylineData[], points: QPoint3dList, doJointTriangles: boolean) {
    this.polylines = polylines;
    this.points = points;
    this.doJoints = doJointTriangles;
  }

  public static fromPolyline(args: PolylineArgs): PolylineTesselator {
    return new PolylineTesselator(args.polylines, args.points, wantJointTriangles(args.width, args.flags.is2d));
  }

  public static fromMesh(args: MeshArgs): PolylineTesselator | undefined {
    if (undefined !== args.edges.polylines.lines && undefined !== args.points)
      return new PolylineTesselator(args.edges.polylines.lines, args.points, wantJointTriangles(args.edges.width, args.is2d));
    return undefined;
  }

  public tesselate(): TesselatedPolyline {
    for (const p of this.points.list)
      this.position.push(p.unquantize(this.points.params));
    this._tesselate();
    const vertIndex = VertexLUT.convertIndicesToTriplets(this.vertIndex);
    const prevIndex = VertexLUT.convertIndicesToTriplets(this.prevIndex);
    const nextIndexAndParam = new Uint8Array(this.numIndices * 4);
    for (let i = 0; i < this.numIndices; i++) {
      const index = this.nextIndex[i];
      const j = i * 4;
      nextIndexAndParam[j + 0] = index & 0x000000ff;
      nextIndexAndParam[j + 1] = (index & 0x0000ff00) >> 8;
      nextIndexAndParam[j + 2] = (index & 0x00ff0000) >> 16;
      nextIndexAndParam[j + 3] = this.nextParam[i] & 0x000000ff;
    }
    const distance = new Float32Array(this.numIndices);
    for (let i = 0; i < this.numIndices; ++i)
      distance[i] = this.distance[i];
    return new TesselatedPolyline(vertIndex, prevIndex, nextIndexAndParam, distance);
  }

  private _tesselate() {
    for (const line of this.polylines) {
      if (line.numIndices < 2)
        continue;
      let cumulativeDist = line.startDistance;
      const last = line.numIndices - 1;
      const isClosed: boolean = line.vertIndices[0] === line.vertIndices[last];
      for (let i = 0; i < last; ++i) {
        const idx0 = line.vertIndices[i];
        const idx1 = line.vertIndices[i + 1];
        const pos0 = this.position[idx0];
        const pos1 = this.position[idx1];
        const dist = pos0.distance(pos1);
        const isStart: boolean = (0 === i);
        const isEnd: boolean = (last - 1 === i);
        const prevIdx0 = isStart ? (isClosed ? line.vertIndices[last - 1] : idx0) : line.vertIndices[i - 1];
        const nextIdx1 = isEnd ? (isClosed ? line.vertIndices[1] : idx1) : line.vertIndices[i + 2];
        const v0 = new PolylineTesselatorVertex(true, isStart && !isClosed, idx0, prevIdx0, idx1, cumulativeDist);
        const v1 = new PolylineTesselatorVertex(false, isEnd && !isClosed, idx1, nextIdx1, idx0, cumulativeDist += dist);
        const maxJointDot = -0.7;
        const jointAt0: boolean = this.doJoints && (isClosed || !isStart) && this._dotProduct(v0) > maxJointDot;
        const jointAt1: boolean = this.doJoints && (isClosed || !isEnd) && this._dotProduct(v1) > maxJointDot;
        if (jointAt0 || jointAt1) {
          this._addVertex(v0, v0.computeParam(true, jointAt0, false, false));
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, false));
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, true));
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, true));
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, false));
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, true));
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, true));
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, true));
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, false));
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, false));
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, true));
          this._addVertex(v1, v1.computeParam(true, jointAt1, false, false));
        } else {
          this._addVertex(v0, v0.computeParam(true));
          this._addVertex(v1, v1.computeParam(false));
          this._addVertex(v0, v0.computeParam(false));
          this._addVertex(v0, v0.computeParam(false));
          this._addVertex(v1, v1.computeParam(false));
          this._addVertex(v1, v1.computeParam(true));
        }
      }
    }
  }

  private _dotProduct(v: PolylineTesselatorVertex): number {
    const pos: Point3d = this.position[v.vertexIndex];
    const prevDir: Vector3d = Vector3d.createStartEnd(this.position[v.prevIndex], pos);
    const nextDir: Vector3d = Vector3d.createStartEnd(this.position[v.nextIndex], pos);
    return prevDir.dotProduct(nextDir);
  }

  private _addVertex(vertex: PolylineTesselatorVertex, param: number): void {
    this.vertIndex[this.numIndices] = vertex.vertexIndex;
    this.prevIndex[this.numIndices] = vertex.prevIndex;
    this.nextIndex[this.numIndices] = vertex.nextIndex;
    this.nextParam[this.numIndices] = param;
    this.distance[this.numIndices] = vertex.distance;
    this.numIndices++;
  }
}

export class PolylineGeometry extends LUTGeometry {
  public polyline: PolylineInfo;
  public lut: VertexLUT.Data;
  public numIndices: number;
  private buffers: PolylineBuffers;

  private constructor(buffers: PolylineBuffers, numIndices: number, lut: VertexLUT.Data, info: PolylineInfo) {
    super();
    this.polyline = info;
    this.lut = lut;
    this.numIndices = numIndices;
    this.buffers = buffers;
  }

  public dispose() {
    dispose(this.lut);
    dispose(this.buffers);
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }

  public get polylineBuffers(): PolylineBuffers | undefined { return this.buffers; }

  private _computeEdgePass(target: Target, colorInfo: ColorInfo): RenderPass {
    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.showVisibleEdges())
      return RenderPass.None;

    // Only want to return Translucent for edges if rendering in Wireframe mode TODO: what about overrides?
    const isTranslucent: boolean = RenderMode.Wireframe === vf.renderMode && vf.showTransparency() && colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }

  public getRenderPass(target: Target): RenderPass {
    const vf = target.currentViewFlags;
    if (this.isEdge) {
      let pass = this._computeEdgePass(target, this.lut.colorInfo);
      // Only display the outline in wireframe if Fill is off...
      if (RenderPass.None !== pass && this.polyline.isOutlineEdge && RenderMode.Wireframe === vf.renderMode && vf.showFill())
        pass = RenderPass.None;
      return pass;
    }
    const isTranslucent: boolean = vf.showTransparency() && this.lut.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.Polyline; }
  public get renderOrder(): RenderOrder { return this.polyline.renderOrder; }
  public get isPlanar(): boolean { return this.polyline.isPlanar; }
  public get isEdge(): boolean { return this.polyline.isAnyEdge; }
  public get qOrigin(): Float32Array { return this.lut.qOrigin; }
  public get qScale(): Float32Array { return this.lut.qScale; }
  public get numRgbaPerVertex(): number { return this.lut.numRgbaPerVertex; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.polyline.features; }

  protected _getLineWeight(params: ShaderProgramParams): number {
    return this.isEdge ? params.target.getEdgeWeight(params, this.polyline.lineWeight) : this.polyline.lineWeight;
  }
  protected _getLineCode(params: ShaderProgramParams): number {
    return this.isEdge ? params.target.getEdgeLineCode(params, this.polyline.lineCode) : this.polyline.lineCode;
  }
  public getColor(target: Target): ColorInfo { return this.isEdge && target.isEdgeColorOverridden ? target.edgeColor : this.lut.colorInfo; }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this.buffers!.indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    this.buffers!.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this.numIndices);
  }

  public static create(args: PolylineArgs): PolylineGeometry | undefined {
    const lutParams: VertexLUT.Params = new VertexLUT.Params(new VertexLUT.SimpleBuilder(args), args.colors);
    const info = new PolylineInfo(args);
    const lut = lutParams.toData(info.vertexParams);
    if (undefined !== lut) {
      const tess: PolylineTesselator = PolylineTesselator.fromPolyline(args);
      const tp: TesselatedPolyline = tess.tesselate();
      const vBuff = BufferHandle.createArrayBuffer(tp.vertIndex);
      const pBuff = BufferHandle.createArrayBuffer(tp.prevIndex);
      const npBuff = BufferHandle.createArrayBuffer(tp.nextIndexAndParam);
      const dBuff = BufferHandle.createArrayBuffer(tp.distance);
      if (undefined !== vBuff && undefined !== pBuff && undefined !== npBuff && undefined !== dBuff) {
        const pb: PolylineBuffers = new PolylineBuffers(vBuff, pBuff, npBuff, dBuff);
        return new PolylineGeometry(pb, tp.distance.length, lut, info);
      }
    }
    return undefined;
  }
}

export class PolylinePrimitive extends Primitive {
  private constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }
  public static create(args: PolylineArgs): PolylinePrimitive | undefined {
    const geom = PolylineGeometry.create(args);
    return undefined !== geom ? new PolylinePrimitive(geom) : undefined;
  }
  public get renderOrder(): RenderOrder { return (this.cachedGeometry as PolylineGeometry).renderOrder; }
  public get isPlanar(): boolean { return (this.cachedGeometry as PolylineGeometry).isPlanar; }
  public get isEdge(): boolean { return (this.cachedGeometry as PolylineGeometry).isEdge; }
}
