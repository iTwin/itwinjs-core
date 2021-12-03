/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { FeatureIndexType, FillFlags, LinePixels, RenderMode } from "@itwin/core-common";
import { InstancedGraphicParams } from "../InstancedGraphicParams";
import { MeshParams } from "../primitives/VertexTable";
import { SurfaceType } from "../primitives/SurfaceParams";
import { RenderMemory } from "../RenderMemory";
import { RenderGeometry } from "../RenderSystem";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { ColorInfo } from "./ColorInfo";
import { WebGLDisposable } from "./Disposable";
import { ShaderProgramParams } from "./DrawCommand";
import { LineCode } from "./LineCode";
import { FloatRgba } from "./FloatRGBA";
import { Graphic } from "./Graphic";
import { InstanceBuffers, PatternBuffers } from "./InstancedGeometry";
import { createMaterialInfo, MaterialInfo } from "./Material";
import { Primitive } from "./Primitive";
import { RenderCommands } from "./RenderCommands";
import { RenderPass } from "./RenderFlags";
import { Target } from "./Target";
import { Texture } from "./Texture";
import { VertexLUT } from "./VertexLUT";
import { EdgeGeometry, PolylineEdgeGeometry, SilhouetteEdgeGeometry } from "./EdgeGeometry";
import { SurfaceGeometry } from "./SurfaceGeometry";

/** @internal */
export class MeshData implements WebGLDisposable {
  public readonly edgeWidth: number;
  public readonly hasFeatures: boolean;
  public readonly uniformFeatureId?: number; // Used strictly by BatchPrimitiveCommand.computeIsFlashed for flashing volume classification primitives.
  public readonly texture?: Texture;
  public readonly materialInfo?: MaterialInfo;
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly hasFixedNormals: boolean;   // Fixed normals will not be flipped to face front (Terrain skirts).
  public readonly lut: VertexLUT;
  public readonly viewIndependentOrigin?: Point3d;
  private readonly _textureAlwaysDisplayed: boolean;

  private constructor(lut: VertexLUT, params: MeshParams, viOrigin: Point3d | undefined) {
    this.lut = lut;
    this.viewIndependentOrigin = viOrigin;

    this.hasFeatures = FeatureIndexType.Empty !== params.vertices.featureIndexType;
    if (FeatureIndexType.Uniform === params.vertices.featureIndexType)
      this.uniformFeatureId = params.vertices.uniformFeatureID;

    if (undefined !== params.surface.textureMapping) {
      this.texture = params.surface.textureMapping.texture as Texture;
      this._textureAlwaysDisplayed = params.surface.textureMapping.alwaysDisplayed;
    } else {
      this.texture = undefined;
      this._textureAlwaysDisplayed = false;
    }

    this.materialInfo = createMaterialInfo(params.surface.material);

    this.type = params.surface.type;
    this.fillFlags = params.surface.fillFlags;
    this.isPlanar = params.isPlanar;
    this.hasBakedLighting = params.surface.hasBakedLighting;
    this.hasFixedNormals = params.surface.hasFixedNormals;
    const edges = params.edges;
    this.edgeWidth = undefined !== edges ? edges.weight : 1;
    this.edgeLineCode = LineCode.valueFromLinePixels(undefined !== edges ? edges.linePixels : LinePixels.Solid);
  }

  public static create(params: MeshParams, viOrigin: Point3d | undefined): MeshData | undefined {
    const lut = VertexLUT.createFromVertexTable(params.vertices, params.auxChannels);
    return undefined !== lut ? new MeshData(lut, params, viOrigin) : undefined;
  }

  public get isDisposed(): boolean { return undefined === this.texture && this.lut.isDisposed; }

  public dispose() {
    dispose(this.lut);
    if (this._ownsTexture)
      this.texture!.dispose();
  }

  public get isGlyph() { return undefined !== this.texture && this.texture.isGlyph; }
  public get isTextureAlwaysDisplayed() { return this.isGlyph || this._textureAlwaysDisplayed; }

  // Returns true if no one else owns this texture. Implies that the texture should be disposed when this object is disposed, and the texture's memory should be tracked as belonging to this object.
  private get _ownsTexture(): boolean {
    return undefined !== this.texture && !this.texture?.hasOwner;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVertexTable(this.lut.bytesUsed);
    if (this._ownsTexture)
      stats.addTexture(this.texture!.bytesUsed);
  }
}

/** @internal */
export class MeshRenderGeometry {
  public readonly data: MeshData;
  public readonly surface?: SurfaceGeometry;
  public readonly segmentEdges?: EdgeGeometry;
  public readonly silhouetteEdges?: SilhouetteEdgeGeometry;
  public readonly polylineEdges?: PolylineEdgeGeometry;
  public readonly range: Range3d;

  private constructor(data: MeshData, params: MeshParams) {
    this.data = data;
    this.range = params.vertices.qparams.computeRange();
    this.surface = SurfaceGeometry.create(data, params.surface.indices);
    const edges = params.edges;
    if (!edges || data.type === SurfaceType.VolumeClassifier)
      return;

    if (edges.silhouettes)
      this.silhouetteEdges = SilhouetteEdgeGeometry.createSilhouettes(data, edges.silhouettes);

    if (edges.segments)
      this.segmentEdges = EdgeGeometry.create(data, edges.segments);

    if (edges.polylines)
      this.polylineEdges = PolylineEdgeGeometry.create(data, edges.polylines);
  }

  public static create(params: MeshParams, viewIndependentOrigin: Point3d | undefined): MeshRenderGeometry | undefined {
    const data = MeshData.create(params, viewIndependentOrigin);
    return data ? new this(data, params) : undefined;
  }

  public dispose() {
    dispose(this.data);
    dispose(this.surface);
    dispose(this.segmentEdges);
    dispose(this.silhouetteEdges);
    dispose(this.polylineEdges);
  }

  public collectStatistics(stats: RenderMemory.Statistics) {
    this.data.collectStatistics(stats);
    this.surface?.collectStatistics(stats);
    this.segmentEdges?.collectStatistics(stats);
    this.silhouetteEdges?.collectStatistics(stats);
    this.polylineEdges?.collectStatistics(stats);
  }
}

/** @internal */
export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: Primitive[] = [];
  private readonly _instances?: InstanceBuffers | PatternBuffers;

  public static create(geometry: MeshRenderGeometry, instances?: InstancedGraphicParams | PatternBuffers): MeshGraphic | undefined {
    let buffers;
    if (instances) {
      if (instances instanceof PatternBuffers) {
        buffers = instances;
      } else {
        const instancesRange = instances.range ?? InstanceBuffers.computeRange(geometry.range, instances.transforms, instances.transformCenter);
        buffers = InstanceBuffers.create(instances, instancesRange);
        if (!buffers)
          return undefined;
      }
    }

    return new MeshGraphic(geometry, buffers);
  }

  private addPrimitive(geometry: RenderGeometry | undefined) {
    if (!geometry)
      return;

    assert(geometry instanceof CachedGeometry);
    const primitive = Primitive.createShared(geometry, this._instances);
    if (primitive)
      this._primitives.push(primitive);
  }

  private constructor(geometry: MeshRenderGeometry, instances?: InstanceBuffers | PatternBuffers) {
    super();
    this.meshData = geometry.data;
    this._instances = instances;

    this.addPrimitive(geometry.surface);
    this.addPrimitive(geometry.segmentEdges);
    this.addPrimitive(geometry.silhouetteEdges);
    this.addPrimitive(geometry.polylineEdges);
  }

  public get isDisposed(): boolean { return this.meshData.isDisposed && 0 === this._primitives.length; }
  public get isPickable() { return false; }

  public dispose() {
    for (const primitive of this._primitives)
      dispose(primitive);

    dispose(this.meshData);
    dispose(this._instances);
    this._primitives.length = 0;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.meshData.collectStatistics(stats);
    this._primitives.forEach((prim) => prim.collectStatistics(stats));
    this._instances?.collectStatistics(stats);
  }

  public addCommands(cmds: RenderCommands): void { this._primitives.forEach((prim) => prim.addCommands(cmds)); }
  public override addHiliteCommands(cmds: RenderCommands, pass: RenderPass): void { this._primitives.forEach((prim) => prim.addHiliteCommands(cmds, pass)); }

  public get surfaceType(): SurfaceType { return this.meshData.type; }
}

/** Defines one aspect of the geometry of a mesh (surface or edges)
 * @internal
 */
export abstract class MeshGeometry extends LUTGeometry {
  public readonly mesh: MeshData;
  protected readonly _numIndices: number;

  public override get asMesh() { return this; }
  protected override _getLineWeight(params: ShaderProgramParams): number { return this.computeEdgeWeight(params); }

  // Convenience accessors...
  public get edgeWidth() { return this.mesh.edgeWidth; }
  public get edgeLineCode() { return this.mesh.edgeLineCode; }
  public override get hasFeatures() { return this.mesh.hasFeatures; }
  public get surfaceType() { return this.mesh.type; }
  public get fillFlags() { return this.mesh.fillFlags; }
  public get isPlanar() { return this.mesh.isPlanar; }
  public get colorInfo(): ColorInfo { return this.mesh.lut.colorInfo; }
  public get uniformColor(): FloatRgba | undefined { return this.colorInfo.isUniform ? this.colorInfo.uniform : undefined; }
  public get texture() { return this.mesh.texture; }
  public override get hasBakedLighting() { return this.mesh.hasBakedLighting; }
  public get hasFixedNormals() { return this.mesh.hasFixedNormals; }
  public get lut() { return this.mesh.lut; }
  public get hasScalarAnimation() { return this.mesh.lut.hasScalarAnimation; }

  protected constructor(mesh: MeshData, numIndices: number) {
    super(mesh.viewIndependentOrigin);
    this._numIndices = numIndices;
    this.mesh = mesh;
  }

  protected computeEdgeWeight(params: ShaderProgramParams): number {
    return params.target.computeEdgeWeight(params.renderPass, this.edgeWidth);
  }
  protected computeEdgeLineCode(params: ShaderProgramParams): number {
    return params.target.computeEdgeLineCode(params.renderPass, this.edgeLineCode);
  }
  protected computeEdgeColor(target: Target): ColorInfo {
    return target.computeEdgeColor(this.colorInfo);
  }
  protected computeEdgePass(target: Target): RenderPass {
    if (target.isDrawingShadowMap)
      return RenderPass.None;

    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.visibleEdges) {
      return RenderPass.None;
    }

    // Only want translucent edges in wireframe mode.
    const isTranslucent = RenderMode.Wireframe === vf.renderMode && vf.transparency && this.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }
}
