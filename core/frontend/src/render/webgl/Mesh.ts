/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { IDisposable, dispose } from "@bentley/bentleyjs-core";
import { SurfaceFlags, RenderPass, RenderOrder } from "./RenderFlags";
import { LUTGeometry, PolylineBuffers, CachedGeometry } from "./CachedGeometry";
import { VertexIndices, SurfaceType, MeshParams, SegmentEdgeParams, SilhouetteParams, TesselatedPolyline } from "../primitives/VertexTable";
import { LineCode } from "./EdgeOverrides";
import { ColorInfo } from "./ColorInfo";
import { Graphic, Batch } from "./Graphic";
import { FeaturesInfo } from "./FeaturesInfo";
import { VertexLUT } from "./VertexLUT";
import { Primitive } from "./Primitive";
import { FloatPreMulRgba } from "./FloatRGBA";
import { ShaderProgramParams, RenderCommands } from "./DrawCommand";
import { Target } from "./Target";
import { Material } from "./Material";
import { Texture } from "./Texture";
import { FillFlags, RenderMode, LinePixels, ViewFlags } from "@bentley/imodeljs-common";
import { System } from "./System";
import { BufferHandle, AttributeHandle } from "./Handle";
import { GL } from "./GL";
import { TechniqueId } from "./TechniqueId";
import { InstancedGraphicParams, RenderMemory } from "../System";

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
    const lut = VertexLUT.createFromVertexTable(params.vertices, params.auxChannels);
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
  private readonly _primitives: Primitive[] = [];

  public static create(params: MeshParams, instances?: InstancedGraphicParams): MeshGraphic | undefined {
    const data = MeshData.create(params);
    return undefined !== data ? new MeshGraphic(data, params, instances) : undefined;
  }

  private addPrimitive(createGeom: () => CachedGeometry | undefined, instances?: InstancedGraphicParams) {
    const primitive = Primitive.create(createGeom, instances);
    if (undefined !== primitive)
      this._primitives.push(primitive);
  }

  private constructor(data: MeshData, params: MeshParams, instances?: InstancedGraphicParams) {
    super();
    this.meshData = data;

    this.addPrimitive(() => SurfaceGeometry.create(this.meshData, params.surface.indices), instances);

    // Classifiers are surfaces only...no edges.
    if (this.surfaceType === SurfaceType.Classifier || undefined === params.edges)
      return;

    const edges = params.edges;
    if (undefined !== edges.silhouettes)
      this.addPrimitive(() => SilhouetteEdgeGeometry.createSilhouettes(this.meshData, edges.silhouettes!), instances);

    if (undefined !== edges.segments)
      this.addPrimitive(() => EdgeGeometry.create(this.meshData, edges.segments!), instances);

    if (undefined !== edges.polylines)
      this.addPrimitive(() => PolylineEdgeGeometry.create(this.meshData, edges.polylines!), instances);
  }

  public dispose() {
    dispose(this.meshData);
    for (const primitive of this._primitives)
      dispose(primitive);

    this._primitives.length = 0;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVertexTable(this.meshData.lut.bytesUsed);
    this._primitives.forEach((prim) => prim.collectStatistics(stats));
  }

  public addCommands(cmds: RenderCommands): void { this._primitives.forEach((prim) => prim.addCommands(cmds)); }
  public addHiliteCommands(cmds: RenderCommands, batch: Batch, pass: RenderPass): void { this._primitives.forEach((prim) => prim.addHiliteCommands(cmds, batch, pass)); }

  public setUniformFeatureIndices(id: number): void {
    this.meshData.features = FeaturesInfo.createUniform(id);
  }
  public get surfaceType(): SurfaceType { return this.meshData.type; }
}

// Defines one aspect of the geometry of a mesh (surface or edges)
export abstract class MeshGeometry extends LUTGeometry {
  public readonly mesh: MeshData;
  protected readonly _numIndices: number;

  public get asMesh() { return this; }
  protected _getLineWeight(params: ShaderProgramParams): number { return this.computeEdgeWeight(params); }

  // Convenience accessors...
  public get edgeWidth() { return this.mesh.edgeWidth; }
  public get edgeLineCode() { return this.mesh.edgeLineCode; }
  public get featuresInfo(): FeaturesInfo | undefined { return this.mesh.features; }
  public get surfaceType() { return this.mesh.type; }
  public get fillFlags() { return this.mesh.fillFlags; }
  public get isPlanar() { return this.mesh.isPlanar; }
  public get colorInfo(): ColorInfo { return this.mesh.lut.colorInfo; }
  public get uniformColor(): FloatPreMulRgba | undefined { return this.colorInfo.isUniform ? this.colorInfo.uniform : undefined; }
  public get texture() { return this.mesh.texture; }
  public get hasBakedLighting() { return this.mesh.hasBakedLighting; }
  public get lut() { return this.mesh.lut; }
  public get hasScalarAnimation() { return this.mesh.lut.hasScalarAnimation; }

  protected constructor(mesh: MeshData, numIndices: number) {
    super();
    this._numIndices = numIndices;
    this.mesh = mesh;
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

export class EdgeGeometry extends MeshGeometry {
  protected readonly _indices: BufferHandle;
  protected readonly _endPointAndQuadIndices: BufferHandle;

  public get asSurface() { return undefined; }
  public get asEdge() { return this; }
  public get asSilhouette(): SilhouetteEdgeGeometry | undefined { return undefined; }

  public static create(mesh: MeshData, edges: SegmentEdgeParams): EdgeGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(edges.indices.data);
    const endPointBuffer = BufferHandle.createArrayBuffer(edges.endPointAndQuadIndices);
    return undefined !== indexBuffer && undefined !== endPointBuffer ? new EdgeGeometry(indexBuffer, endPointBuffer, edges.indices.length, mesh) : undefined;
  }

  public dispose() {
    dispose(this._indices);
    dispose(this._endPointAndQuadIndices);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVisibleEdges(this._indices.bytesUsed + this._endPointAndQuadIndices.bytesUsed);
  }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  protected _draw(numInstances: number): void {
    this._indices.bind(GL.Buffer.Target.ArrayBuffer);
    System.instance.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }
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

export class SilhouetteEdgeGeometry extends EdgeGeometry {
  private readonly _normalPairs: BufferHandle;

  public get asSilhouette() { return this; }

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

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addSilhouetteEdges(this._indices.bytesUsed + this._endPointAndQuadIndices.bytesUsed + this._normalPairs.bytesUsed);
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.SilhouetteEdge; }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarSilhouette : RenderOrder.Silhouette; }
  public get normalPairs(): BufferHandle { return this._normalPairs; }

  private constructor(indices: BufferHandle, endPointAndQuadsIndices: BufferHandle, normalPairs: BufferHandle, numIndices: number, mesh: MeshData) {
    super(indices, endPointAndQuadsIndices, numIndices, mesh);
    this._normalPairs = normalPairs;
  }
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

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._buffers.collectStatistics(stats, RenderMemory.BufferType.PolylineEdges);
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

  protected _draw(numInstances: number): void {
    const gl = System.instance;
    this._buffers.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);
  }

  private constructor(numIndices: number, buffers: PolylineBuffers, mesh: MeshData) {
    super(mesh, numIndices);
    this._buffers = buffers;
  }
}

function wantMaterials(vf: ViewFlags) { return vf.materials && RenderMode.SmoothShade === vf.renderMode; }
function wantLighting(vf: ViewFlags) {
  return RenderMode.SmoothShade === vf.renderMode && (vf.sourceLights || vf.cameraLights || vf.solarLight);
}

export class SurfaceGeometry extends MeshGeometry {
  private readonly _indices: BufferHandle;

  public static create(mesh: MeshData, indices: VertexIndices): SurfaceGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(indices.data);
    return undefined !== indexBuffer ? new SurfaceGeometry(indexBuffer, indices.length, mesh) : undefined;
  }

  public dispose() {
    dispose(this._indices);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addSurface(this._indices.bytesUsed);
  }

  public get isLit() { return SurfaceType.Lit === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isTextured() { return SurfaceType.Textured === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isGlyph() { return undefined !== this.texture && this.texture.isGlyph; }
  public get isTileSection() { return undefined !== this.texture && this.texture.isTileSection; }
  public get isClassifier() { return SurfaceType.Classifier === this.surfaceType; }

  public get asSurface() { return this; }
  public get asEdge() { return undefined; }
  public get asSilhouette() { return undefined; }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  protected _draw(numInstances: number): void {
    const system = System.instance;
    const gl = system.context;
    const offset = RenderOrder.BlankingRegion === this.renderOrder;
    if (offset) {
      gl.enable(GL.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.0, 1.0);
    }

    this._indices.bind(GL.Buffer.Target.ArrayBuffer);
    system.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);

    if (offset) {
      gl.disable(GL.POLYGON_OFFSET_FILL);
    }
  }

  public getTechniqueId(_target: Target) { return TechniqueId.Surface; }
  public get isLitSurface() { return this.isLit; }
  public get hasBakedLighting() { return this.mesh.hasBakedLighting; }
  public get renderOrder(): RenderOrder {
    if (FillFlags.Behind === (this.fillFlags & FillFlags.Behind))
      return RenderOrder.BlankingRegion;
    else
      return this.isPlanar ? RenderOrder.PlanarSurface : RenderOrder.Surface;
  }

  public getColor(target: Target) {
    if (FillFlags.Background === (this.fillFlags & FillFlags.Background))
      return ColorInfo.createFromColorDef(target.bgColor);
    else
      return this.colorInfo;
  }

  public getRenderPass(target: Target): RenderPass {
    if (this.isClassifier)
      return RenderPass.Classification;

    const mat = this.isLit ? this.mesh.material : undefined;
    const opaquePass = this.isPlanar ? RenderPass.OpaquePlanar : RenderPass.OpaqueGeneral;
    const fillFlags = this.fillFlags;

    if (this.isGlyph && target.isReadPixelsInProgress)
      return opaquePass;

    const vf = target.currentViewFlags;
    if (RenderMode.Wireframe === vf.renderMode) {
      const showFill = FillFlags.Always === (fillFlags & FillFlags.Always) || (vf.fill && FillFlags.ByView === (fillFlags & FillFlags.ByView));
      if (!showFill) {
        return RenderPass.None;
      }
    }
    if (!this.isGlyph) {
      if (!vf.transparency || RenderMode.SolidFill === vf.renderMode || RenderMode.HiddenLine === vf.renderMode) {
        return opaquePass;
      }
    }
    if (undefined !== this.texture && this.wantTextures(target, true)) {
      if (this.texture.hasTranslucency)
        return RenderPass.Translucent;

      // material may have texture weight < 1 - if so must account for material or element alpha below
      if (undefined === mat || (mat.textureMapping !== undefined && mat.textureMapping.params.weight >= 1))
        return opaquePass;
    }

    const hasAlpha = (undefined !== mat && wantMaterials(vf) && mat.hasTranslucency) || this.getColor(target).hasTranslucency;
    return hasAlpha ? RenderPass.Translucent : opaquePass;
  }

  protected _wantWoWReversal(target: Target): boolean {
    const fillFlags = this.fillFlags;
    if (FillFlags.None !== (fillFlags & FillFlags.Background))
      return false; // fill color explicitly from background

    if (FillFlags.None !== (fillFlags & FillFlags.Always))
      return true; // fill displayed even in wireframe

    const vf = target.currentViewFlags;
    if (RenderMode.Wireframe === vf.renderMode || vf.visibleEdges)
      return false; // never invert surfaces when edges are displayed

    if (this.isLit && wantLighting(vf))
      return false;

    // Don't invert white pixels of textures...
    return !this.wantTextures(target, this.isTextured);
  }
  public get material(): Material | undefined { return this.mesh.material; }

  public computeSurfaceFlags(params: ShaderProgramParams): SurfaceFlags {
    const target = params.target;
    const vf = target.currentViewFlags;

    let flags = wantMaterials(vf) ? SurfaceFlags.None : SurfaceFlags.IgnoreMaterial;
    if (this.isLit) {
      flags |= SurfaceFlags.HasNormals;
      if (wantLighting(vf)) {
        flags |= SurfaceFlags.ApplyLighting;
      }

      // Textured meshes store normal in place of color index.
      // Untextured lit meshes store normal where textured meshes would store UV coords.
      // Tell shader where to find normal.
      if (!this.isTextured) {
        flags |= SurfaceFlags.HasColorAndNormal;
      }
    }

    if (this.wantTextures(target, this.isTextured)) {
      flags |= SurfaceFlags.HasTexture;
    }

    switch (params.renderPass) {
      // NB: We need this for opaque pass due to SolidFill (must compute transparency, discard below threshold, render opaque at or above threshold)
      case RenderPass.OpaqueLinear:
      case RenderPass.OpaquePlanar:
      case RenderPass.OpaqueGeneral:
      case RenderPass.Translucent: {
        const mode = vf.renderMode;
        if (!this.isGlyph && (RenderMode.HiddenLine === mode || RenderMode.SolidFill === mode)) {
          flags |= SurfaceFlags.TransparencyThreshold;
          if (RenderMode.HiddenLine === mode && FillFlags.Always !== (this.fillFlags & FillFlags.Always)) {
            // fill flags test for text - doesn't render with bg fill in hidden line mode.
            flags |= SurfaceFlags.BackgroundFill;
          }
          break;
        }
      }
    }

    return flags;
  }

  private constructor(indices: BufferHandle, numIndices: number, mesh: MeshData) {
    super(mesh, numIndices);
    this._indices = indices;
  }

  private wantTextures(target: Target, surfaceTextureExists: boolean): boolean {
    if (this.hasScalarAnimation && undefined !== target.analysisTexture)
      return true;

    if (!surfaceTextureExists)
      return false;

    if (this.isGlyph) {
      return true;
    }
    const fill = this.fillFlags;
    const flags = target.currentViewFlags;

    // ###TODO need to distinguish between gradient fill and actual textures...
    switch (flags.renderMode) {
      case RenderMode.SmoothShade: return flags.textures;
      case RenderMode.Wireframe: return FillFlags.Always === (fill & FillFlags.Always) || (flags.fill && FillFlags.ByView === (fill & FillFlags.ByView));
      default: return FillFlags.Always === (fill & FillFlags.Always);
    }
  }
}
