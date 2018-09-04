/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { LUTGeometry, PolylineBuffers } from "./CachedGeometry";
import { SurfaceType, MeshParams, SegmentEdgeParams, SilhouetteParams, TesselatedPolyline } from "../primitives/VertexTable";
import { LineCode } from "./EdgeOverrides";
import { ColorInfo } from "./ColorInfo";
import { Graphic, Batch } from "./Graphic";
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
  FillFlags,
  RenderMode,
  LinePixels,
} from "@bentley/imodeljs-common";
import { System } from "./System";
import { BufferHandle, AttributeHandle } from "./Handle";
import { GL } from "./GL";
import { TechniqueId } from "./TechniqueId";

export class MeshData implements IDisposable {
  public readonly edgeWidth: number;
  public features?: FeaturesInfo;
  public readonly texture?: Texture;
  public readonly material?: Material;
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly lut: VertexLUT;

  private constructor(lut: VertexLUT, params: MeshParams) {
    this.lut = lut;
    this.features = FeaturesInfo.createFromVertexTable(params.vertices);
    this.texture = params.surface.texture as Texture;
    this.material = params.surface.material as Material;
    this.type = params.surface.type;
    this.fillFlags = params.surface.fillFlags;
    this.isPlanar = params.isPlanar;
    this.hasBakedLighting = params.surface.hasBakedLighting;

    const edges = params.edges;
    this.edgeWidth = undefined !== edges ? edges.weight : 1;
    this.edgeLineCode = LineCode.valueFromLinePixels(undefined !== edges ? edges.linePixels : LinePixels.Solid);
  }

  public static create(params: MeshParams): MeshData | undefined {
    const lut = VertexLUT.createFromVertexTable(params.vertices);
    return undefined !== lut ? new MeshData(lut, params) : undefined;
  }

  public dispose() {
    dispose(this.lut);
    if (undefined !== this.texture && undefined === this.texture.key && !this.texture.isOwned)
      this.texture.dispose();
  }
}

export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: MeshPrimitive[] = [];

  public static create(params: MeshParams): MeshGraphic | undefined {
    const data = MeshData.create(params);
    return undefined !== data ? new MeshGraphic(data, params) : undefined;
  }

  private addPrimitive(primitive?: MeshPrimitive) {
    if (undefined !== primitive)
      this._primitives.push(primitive);
  }

  private constructor(data: MeshData, params: MeshParams) {
    super();
    this.meshData = data;

    this.addPrimitive(SurfacePrimitive.create(params.surface, this));

    // Classifiers are surfaces only...no edges.
    if (this.surfaceType === SurfaceType.Classifier || undefined === params.edges)
      return;

    if (undefined !== params.edges.silhouettes)
      this.addPrimitive(SilhouetteEdgePrimitive.create(params.edges.silhouettes, this));

    if (undefined !== params.edges.segments)
      this.addPrimitive(EdgePrimitive.create(params.edges.segments, this));

    if (undefined !== params.edges.polylines)
      this.addPrimitive(PolylineEdgePrimitive.create(params.edges.polylines, this));
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

export class EdgeGeometry extends MeshGeometry {
  private readonly _indices: BufferHandle;
  private readonly _endPointAndQuadIndices: BufferHandle;

  public static create(mesh: MeshData, edges: SegmentEdgeParams): EdgeGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(edges.indices.data);
    const endPointBuffer = BufferHandle.createArrayBuffer(edges.endPointAndQuadIndices);
    return undefined !== indexBuffer && undefined !== endPointBuffer ? new EdgeGeometry(indexBuffer, endPointBuffer, edges.indices.length, mesh) : undefined;
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
  public static create(params: SegmentEdgeParams, mesh: MeshGraphic): EdgePrimitive | undefined {
    const geom = EdgeGeometry.create(mesh.meshData, params);
    return undefined !== geom ? new EdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: EdgeGeometry, mesh: MeshGraphic) { super(cachedGeom, mesh); }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public get isEdge(): boolean { return true; }
}

export class SilhouetteEdgeGeometry extends EdgeGeometry {
  private readonly _normalPairs: BufferHandle;

  public static createSilhouettes(mesh: MeshData, params: SilhouetteParams): SilhouetteEdgeGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(params.indices.data);
    const endPointBuffer = BufferHandle.createArrayBuffer(params.endPointAndQuadIndices);
    const normalsBuffer = BufferHandle.createArrayBuffer(params.normalPairs);
    return undefined !== indexBuffer && undefined !== endPointBuffer && undefined !== normalsBuffer ? new SilhouetteEdgeGeometry(indexBuffer, endPointBuffer, normalsBuffer, params.indices.length, mesh) : undefined;
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
  public static create(params: SilhouetteParams, mesh: MeshGraphic): SilhouetteEdgePrimitive | undefined {
    const geom = SilhouetteEdgeGeometry.createSilhouettes(mesh.meshData, params);
    return undefined !== geom ? new SilhouetteEdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: SilhouetteEdgeGeometry, mesh: MeshGraphic) { super(cachedGeom, mesh); }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarSilhouette : RenderOrder.Silhouette; }
  public get isEdge(): boolean { return true; }
}

export class PolylineEdgeGeometry extends MeshGeometry {
  private _buffers: PolylineBuffers;

  public static create(mesh: MeshData, polyline: TesselatedPolyline): PolylineEdgeGeometry | undefined {
    const buffers = PolylineBuffers.create(polyline);
    return undefined !== buffers ? new PolylineEdgeGeometry(polyline.indices.length, buffers, mesh) : undefined;
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
  public static create(polyline: TesselatedPolyline, mesh: MeshGraphic): PolylineEdgePrimitive | undefined {
    const geom = PolylineEdgeGeometry.create(mesh.meshData, polyline);
    return undefined !== geom ? new PolylineEdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: PolylineEdgeGeometry, mesh: MeshGraphic) { super(cachedGeom, mesh); }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public get isEdge(): boolean { return true; }
}
