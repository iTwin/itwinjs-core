/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { SurfaceType, RenderPass, RenderOrder } from "./RenderFlags";
import { Point2d, Range2d } from "@bentley/geometry-core";
import { LUTGeometry, PolylineBuffers } from "./CachedGeometry";
import { MeshArgs } from "../primitives/mesh/MeshPrimitives";
import { LineCode } from "./EdgeOverrides";
import { ColorInfo } from "./ColorInfo";
import { Graphic, wantJointTriangles, Batch } from "./Graphic";
import { FeaturesInfo } from "./FeaturesInfo";
import { VertexLUT } from "./VertexLUT";
import { Primitive } from "./Primitive";
import { FloatPreMulRgba } from "./FloatRGBA";
import { ShaderProgramParams } from "./DrawCommand";
import { Target } from "./Target";
import { SurfacePrimitive } from "./Surface";
import { RenderCommands, DrawCommands } from "./DrawCommand";
import { Material } from "./Material";
import { Texture } from "./Texture";
import {
  QParams3d,
  QParams2d,
  FillFlags,
  RenderTexture,
  RenderMode,
  SilhouetteEdgeArgs,
  OctEncodedNormalPair,
  EdgeArgs, MeshEdge, PolylineEdgeArgs, PolylineData,
} from "@bentley/imodeljs-common";
import { System } from "./System";
import { BufferHandle, AttributeHandle } from "./Handle";
import { GL } from "./GL";
import { TechniqueId } from "./TechniqueId";
import { PolylineTesselator, TesselatedPolyline } from "./Polyline";

export class MeshInfo {
  public readonly edgeWidth: number;
  public features?: FeaturesInfo;
  public readonly texture?: Texture;
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;

  protected constructor(type: SurfaceType, edgeWidth: number, lineCode: number, fillFlags: FillFlags, isPlanar: boolean, features?: FeaturesInfo, texture?: RenderTexture, hasBakedLighting: boolean = false) {
    this.edgeWidth = edgeWidth;
    this.features = features;
    this.texture = texture as Texture;
    this.type = type;
    this.fillFlags = fillFlags;
    this.edgeLineCode = lineCode;
    this.isPlanar = isPlanar;
    this.hasBakedLighting = hasBakedLighting;
  }
}

export class MeshData extends MeshInfo implements IDisposable {
  public readonly lut: VertexLUT.Data;
  public readonly material?: Material;
  public readonly animation: any; // should be a AnimationLookupTexture;

  public static create(params: MeshParams): MeshData | undefined {
    const lut = params.lutParams.toData(params.vertexParams, params.uvParams);
    return undefined !== lut ? new MeshData(lut, params) : undefined;
  }

  private constructor(lut: VertexLUT.Data, params: MeshParams) {
    super(params.type, params.edgeWidth, params.edgeLineCode, params.fillFlags, params.isPlanar, params.features, params.texture, params.hasBakedLighting);
    this.lut = lut;
    this.material = params.material;
    this.animation = undefined;
  }

  public dispose() {
    dispose(this.lut);
    if (this.texture !== undefined && this.texture.key === undefined)
      this.texture.dispose();
  }
}

export class MeshParams extends MeshInfo {
  public readonly vertexParams: QParams3d;
  public readonly uvParams?: QParams2d;
  public readonly lutParams: VertexLUT.Params;
  public readonly material?: Material;
  public readonly animationLUTParams: any; // TODO: should be a AnimationLUTParams;

  public constructor(args: MeshArgs) {
    // ###TODO: MeshArgs.normals should be undefined unless it is non-empty
    const isLit = undefined !== args.normals && 0 < args.normals.length;
    const isTextured = undefined !== args.texture;
    const surfaceType = isTextured ? (isLit ? SurfaceType.TexturedLit : SurfaceType.Textured) : isLit ? SurfaceType.Lit : SurfaceType.Unlit;

    super(surfaceType, args.edges.width, LineCode.valueFromLinePixels(args.edges.linePixels), args.fillFlags, args.isPlanar, FeaturesInfo.create(args.features), args.texture, args.hasBakedLighting);

    // ###TODO: MeshArgs should quantize texture UV for us...
    // ###TODO: MeshArgs.textureUV should be undefined unless it is non-empty
    const uvRange = Range2d.createNull();
    const fpts = args.textureUv;
    if (undefined !== fpts && fpts.length !== 0) {
      for (let i = 0; i < args.points!.length; i++) {
        uvRange.extendPoint(Point2d.createFrom({ x: fpts[i].x, y: fpts[i].y }));
      }
    }

    this.uvParams = uvRange.isNull ? undefined : QParams2d.fromRange(uvRange);
    this.vertexParams = args.points!.params;
    this.material = args.material as Material;
    switch (this.type) {
      case SurfaceType.Lit:
        this.lutParams = new VertexLUT.Params(new VertexLUT.LitMeshBuilder(args), args.colors);
        break;
      case SurfaceType.Textured:
        this.lutParams = new VertexLUT.Params(new VertexLUT.TexturedMeshBuilder(args, this.uvParams!), args.colors);
        break;
      case SurfaceType.TexturedLit:
        this.lutParams = new VertexLUT.Params(new VertexLUT.TexturedLitMeshBuilder(args, this.uvParams!), args.colors);
        break;
      case SurfaceType.Unlit:
      default:
        this.lutParams = new VertexLUT.Params(new VertexLUT.MeshBuilder(args), args.colors);
        break;
    }
    // if (args.auxData.isAnimatable()) { this.animationLUTParams = new AnimationLUTParams(args); }
  }
}

export enum MeshGraphicType {
  kSurface,
  kEdge,
  kSilhouette,
  kPolyline,
  kCOUNT,
}

export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: MeshPrimitive[] = [];

  public static create(args: MeshArgs): MeshGraphic | undefined {
    const data = MeshData.create(new MeshParams(args));
    return undefined !== data ? new MeshGraphic(data, args) : undefined;
  }

  private constructor(data: MeshData, args: MeshArgs) {
    super();
    this.meshData = data;

    const surface = SurfacePrimitive.create(args, this);
    if (undefined !== surface)
      this._primitives.push(surface);

    if (args.edges.silhouettes.isValid) {
      const silPrim = SilhouetteEdgePrimitive.create(args.edges.silhouettes, this);
      if (undefined !== silPrim)
        this._primitives[MeshGraphicType.kSilhouette] = silPrim;
    }
    const convertPolylineEdges = args.edges.polylines.isValid && !wantJointTriangles(args.edges.width, args.is2d);
    if (convertPolylineEdges) {
      const edgePrim = EdgePrimitive.createSimple(args.edges.polylines, args.edges.edges, this);
      if (undefined !== edgePrim)
        this._primitives[MeshGraphicType.kEdge] = edgePrim;
    } else {
      if (args.edges.edges.isValid) {
        const edgePrim = EdgePrimitive.create(args.edges.edges, this);
        if (undefined !== edgePrim)
          this._primitives[MeshGraphicType.kEdge] = edgePrim;
      }
      if (args.edges.polylines.isValid) {
        const pePrim = PolylineEdgePrimitive.create(args, this);
        if (undefined !== pePrim)
          this._primitives[MeshGraphicType.kPolyline] = pePrim;
      }
    }
  }

  public dispose() {
    dispose(this.meshData);
    for (const primitive of this._primitives)
      dispose(primitive);
    this._primitives.length = 0;
  }

  public addCommands(cmds: RenderCommands): void { this._primitives.forEach((prim) => prim.addCommands(cmds)); }
  public addHiliteCommands(cmds: DrawCommands, batch: Batch): void { this._primitives.forEach((prim) => prim.addHiliteCommands(cmds, batch)); }

  public setUniformFeatureIndices(id: number): void {
    this.meshData.features = FeaturesInfo.createUniform(id);
  }
  public setIsPixelMode(): void {
    // this.primitives.forEach((prim) => {
    //   if (true /*prim.isValid()*/) { prim.setIsPixelMode(); } // TODO: setIsPixelMode() has not been implemented yet
    // });
  }
  public get surfaceType(): SurfaceType { return this.meshData.type; }
}

// Defines one aspect of the geometry of a mesh (surface or edges)
export abstract class MeshGeometry extends LUTGeometry {
  protected readonly _mesh: MeshData;
  protected readonly _numIndices: number;

  // Convenience accessors...
  public get edgeWidth() { return this._mesh.edgeWidth; }
  public get edgeLineCode() { return this._mesh.edgeLineCode; }
  public get featuresInfo(): FeaturesInfo | undefined { return this._mesh.features; }
  public get surfaceType() { return this._mesh.type; }
  public get fillFlags() { return this._mesh.fillFlags; }
  public get isPlanar() { return this._mesh.isPlanar; }
  public get colorInfo(): ColorInfo { return this._mesh.lut.colorInfo; }
  public get uniformColor(): FloatPreMulRgba | undefined { return this.colorInfo.isUniform ? this.colorInfo.uniform : undefined; }
  public get texture() { return this._mesh.texture; }
  public get hasBakedLighting() { return this._mesh.hasBakedLighting; }

  public get lut() { return this._mesh.lut; }

  protected constructor(mesh: MeshData, numIndices: number) {
    super();
    this._numIndices = numIndices;
    this._mesh = mesh;
  }

  protected computeEdgeWeight(params: ShaderProgramParams): number { return params.target.getEdgeWeight(params, this.edgeWidth); }
  protected computeEdgeLineCode(params: ShaderProgramParams): number { return params.target.getEdgeLineCode(params, this.edgeLineCode); }
  protected computeEdgeColor(target: Target): ColorInfo { return target.isEdgeColorOverridden ? target.edgeColor : this.colorInfo; }
  protected computeEdgePass(target: Target): RenderPass {
    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.visibleEdges) {
      return RenderPass.None;
    }

    // Only want translucent edges in wireframe mode.
    const isTranslucent = RenderMode.Wireframe === vf.renderMode && vf.transparency && this.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }
}

export abstract class MeshPrimitive extends Primitive {
  public readonly mesh: MeshGraphic;  // is not owned (mesh is the owner of THIS MeshPrimitive)

  public get meshData(): MeshData { return this.mesh.meshData; }

  protected constructor(cachedGeom: MeshGeometry, mesh: MeshGraphic) {
    super(cachedGeom);
    this.mesh = mesh;
  }

  public assignUniformFeatureIndices(_index: number) { assert(false); } // handled by MeshGraphic...
}

export class EdgeBytes {
  public numIndices: number;
  public indexBytes: Uint8Array;
  public endPointAndQuadIndexBytes: Uint8Array;
  constructor(numIndices: number) {
    this.numIndices = numIndices;
    // Each primary vertex identified by vec3-encoded index into LUT
    this.indexBytes = new Uint8Array(numIndices * 3);
    // Each 'other endpoint' vertex identified by vec3-encoded index into LUT plus a quad index in [0,3]
    this.endPointAndQuadIndexBytes = new Uint8Array(numIndices * 4);
  }
}

export class EdgeGeometry extends MeshGeometry {
  private readonly _indices: BufferHandle;
  private readonly _endPointAndQuadIndices: BufferHandle;

  protected static convertPolylinesAndEdges(polylines?: PolylineData[], edges?: MeshEdge[]): EdgeBytes | undefined {
    // Each adjacent pair of polyline indices and each mesh edge becomes 2 triangles with 6 vertices.
    let numIndices = 0;
    if (undefined !== edges)
      numIndices += edges.length;
    if (undefined !== polylines) {
      for (const pd of polylines)
        numIndices += (pd.vertIndices.length - 1);
    }
    if (0 === numIndices)
      return undefined;
    numIndices *= 6;

    // Allocate bytes for edge data.
    const data = new EdgeBytes(numIndices);

    let ndx: number = 0;
    let ndx2: number = 0;

    const addPoint = (p0: number, p1: number, quadIndex: number) => {
      data.indexBytes[ndx++] = p0 & 0x000000ff;
      data.indexBytes[ndx++] = (p0 & 0x0000ff00) >> 8;
      data.indexBytes[ndx++] = (p0 & 0x00ff0000) >> 16;
      data.endPointAndQuadIndexBytes[ndx2++] = p1 & 0x000000ff;
      data.endPointAndQuadIndexBytes[ndx2++] = (p1 & 0x0000ff00) >> 8;
      data.endPointAndQuadIndexBytes[ndx2++] = (p1 & 0x00ff0000) >> 16;
      data.endPointAndQuadIndexBytes[ndx2++] = quadIndex;
    };

    if (undefined !== polylines) {
      for (const pd of polylines) {
        const num = pd.vertIndices.length - 1;
        for (let i = 0; i < num; ++i) {
          let p0 = pd.vertIndices[i];
          let p1 = pd.vertIndices[i + 1];
          if (p1 < p0) { // swap so that lower index is first.
            p0 = p1;
            p1 = pd.vertIndices[i];
          }
          addPoint(p0, p1, 0);
          addPoint(p1, p0, 2);
          addPoint(p0, p1, 1);
          addPoint(p0, p1, 1);
          addPoint(p1, p0, 2);
          addPoint(p1, p0, 3);
        }
      }
    }

    if (undefined !== edges) {
      for (const meshEdge of edges) {
        const p0 = meshEdge.indices[0];
        const p1 = meshEdge.indices[1];
        addPoint(p0, p1, 0);
        addPoint(p1, p0, 2);
        addPoint(p0, p1, 1);
        addPoint(p0, p1, 1);
        addPoint(p1, p0, 2);
        addPoint(p1, p0, 3);
      }
    }

    return data;
  }

  public static create(mesh: MeshData, polylines?: PolylineData[], edges?: MeshEdge[]): EdgeGeometry | undefined {
    const data = this.convertPolylinesAndEdges(polylines, edges);
    if (undefined !== data) {
      const indexBuffer = BufferHandle.createArrayBuffer(data.indexBytes);
      if (undefined !== indexBuffer) {
        const endPointAndQuadIndexBuffer = BufferHandle.createArrayBuffer(data.endPointAndQuadIndexBytes);
        if (undefined !== endPointAndQuadIndexBuffer)
          return new EdgeGeometry(indexBuffer, endPointAndQuadIndexBuffer, data.numIndices, mesh);
      }
    }
    return undefined;
  }

  public dispose() {
    dispose(this._indices);
    dispose(this._endPointAndQuadIndices);
  }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    this._indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices);
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }
  protected _getLineWeight(params: ShaderProgramParams): number { return this.computeEdgeWeight(params); }
  protected _getLineCode(params: ShaderProgramParams): number { return this.computeEdgeLineCode(params); }
  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.Edge; }
  public getRenderPass(target: Target): RenderPass { return this.computeEdgePass(target); }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public getColor(target: Target): ColorInfo { return this.computeEdgeColor(target); }
  public get endPointAndQuadIndices(): BufferHandle { return this._endPointAndQuadIndices; }

  protected constructor(indices: BufferHandle, endPointAndQuadsIndices: BufferHandle, numIndices: number, mesh: MeshData) {
    super(mesh, numIndices);
    this._indices = indices;
    this._endPointAndQuadIndices = endPointAndQuadsIndices;
  }
}

export class EdgePrimitive extends MeshPrimitive {
  public static create(args: EdgeArgs, mesh: MeshGraphic): EdgePrimitive | undefined {
    if (undefined === args.edges) {
      assert(false);
      return undefined;
    }
    const geom = EdgeGeometry.create(mesh.meshData, undefined, args.edges);
    return undefined !== geom ? new EdgePrimitive(geom, mesh) : undefined;
  }

  public static createSimple(pArgs: PolylineEdgeArgs, eArgs: EdgeArgs, mesh: MeshGraphic): EdgePrimitive | undefined {
    if (undefined === eArgs.edges && undefined === pArgs.lines) {
      assert(false);
      return undefined;
    }
    const geom = EdgeGeometry.create(mesh.meshData, pArgs.lines, eArgs.edges);
    return undefined !== geom ? new EdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: EdgeGeometry, mesh: MeshGraphic) { super(cachedGeom, mesh); }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public get isEdge(): boolean { return true; }
}

export class SilhouetteEdgeGeometry extends EdgeGeometry {
  private readonly _normalPairs: BufferHandle;

  private static convertNormalPairs(normalPairs: OctEncodedNormalPair[]): Uint8Array {
    // The indices for the edges get expanded to 6 triangle indices, so we must also expand the normal pairs by 6.
    // Each pair of oct encoded normals is 4 byts (2 for each normal).
    const normalPairBytes = new Uint8Array(normalPairs.length * 6 * 4);
    const normalPair16 = new Uint16Array(normalPairBytes.buffer);
    let ndx = 0;
    for (const pair of normalPairs) {
      for (let i = 0; i < 6; ++i) {
        pair.first.value;
        normalPair16[ndx++] = pair.first.value;
        normalPair16[ndx++] = pair.second.value;
      }
    }
    return normalPairBytes;
  }

  public static createSilhouettes(mesh: MeshData, edges: MeshEdge[], normalPairs: OctEncodedNormalPair[]): SilhouetteEdgeGeometry | undefined {
    const data = EdgeGeometry.convertPolylinesAndEdges(undefined, edges);
    if (undefined !== data) {
      const normalPairBytes = this.convertNormalPairs(normalPairs);
      if (undefined !== normalPairBytes) {
        const indexBuffer = BufferHandle.createArrayBuffer(data.indexBytes);
        if (undefined !== indexBuffer) {
          const endPointAndQuadIndexBuffer = BufferHandle.createArrayBuffer(data.endPointAndQuadIndexBytes);
          if (undefined !== endPointAndQuadIndexBuffer) {
            const normalPairsBuffer = BufferHandle.createArrayBuffer(normalPairBytes);
            if (undefined !== normalPairsBuffer) {
              return new SilhouetteEdgeGeometry(indexBuffer, endPointAndQuadIndexBuffer, normalPairsBuffer, data.numIndices, mesh);
            }
          }
        }
      }
    }
    return undefined;
  }

  public dispose() {
    dispose(this._normalPairs);
    super.dispose();
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.SilhouetteEdge; }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarSilhouette : RenderOrder.Silhouette; }
  public get normalPairs(): BufferHandle { return this._normalPairs; }

  private constructor(indices: BufferHandle, endPointAndQuadsIndices: BufferHandle, normalPairs: BufferHandle, numIndices: number, mesh: MeshData) {
    super(indices, endPointAndQuadsIndices, numIndices, mesh);
    this._normalPairs = normalPairs;
  }
}

export class SilhouetteEdgePrimitive extends MeshPrimitive {
  public static create(args: SilhouetteEdgeArgs, mesh: MeshGraphic): EdgePrimitive | undefined {
    if (undefined === args.edges || undefined === args.normals) {
      assert(false);
      return undefined;
    }
    const geom = SilhouetteEdgeGeometry.createSilhouettes(mesh.meshData, args.edges, args.normals);
    return undefined !== geom ? new SilhouetteEdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: EdgeGeometry, mesh: MeshGraphic) { super(cachedGeom, mesh); }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarSilhouette : RenderOrder.Silhouette; }
  public get isEdge(): boolean { return true; }
}

export class PolylineEdgeGeometry extends MeshGeometry {
  private _buffers: PolylineBuffers;

  public static create(mesh: MeshData, args: MeshArgs): PolylineEdgeGeometry | undefined {
    const tess = PolylineTesselator.fromMesh(args);
    if (undefined !== tess) {
      const tp: TesselatedPolyline = tess.tesselate();
      const vBuff = BufferHandle.createArrayBuffer(tp.vertIndex);
      const pBuff = BufferHandle.createArrayBuffer(tp.prevIndex);
      const npBuff = BufferHandle.createArrayBuffer(tp.nextIndexAndParam);
      const dBuff = BufferHandle.createArrayBuffer(tp.distance);
      if (undefined !== vBuff && undefined !== pBuff && undefined !== npBuff && undefined !== dBuff) {
        const pb: PolylineBuffers = new PolylineBuffers(vBuff, pBuff, npBuff, dBuff);
        return new PolylineEdgeGeometry(tp.numIndices, pb, mesh);
      }
    }
    return undefined;
  }

  public dispose() {
    dispose(this._buffers);
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }
  protected _getLineWeight(params: ShaderProgramParams): number { return this.computeEdgeWeight(params); }
  protected _getLineCode(params: ShaderProgramParams): number { return this.computeEdgeLineCode(params); }
  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.Polyline; }
  public getRenderPass(target: Target): RenderPass { return this.computeEdgePass(target); }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public get polylineBuffers(): PolylineBuffers { return this._buffers; }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._buffers.indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    this._buffers.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices);
  }

  private constructor(numIndices: number, buffers: PolylineBuffers, mesh: MeshData) {
    super(mesh, numIndices);
    this._buffers = buffers;
  }
}

export class PolylineEdgePrimitive extends MeshPrimitive {
  public static create(args: MeshArgs, mesh: MeshGraphic): EdgePrimitive | undefined {
    if (undefined === args.edges) {
      assert(false);
      return undefined;
    }
    const geom = PolylineEdgeGeometry.create(mesh.meshData, args);
    return undefined !== geom ? new PolylineEdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: PolylineEdgeGeometry, mesh: MeshGraphic) { super(cachedGeom, mesh); }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public get isEdge(): boolean { return true; }
}
