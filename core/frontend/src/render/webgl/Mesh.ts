/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { System } from "./System";
import { Point2d, Range2d } from "@bentley/geometry-core";
import { CachedGeometry, MaterialData, LUTGeometry } from "./CachedGeometry";
import { MeshArgs } from "../primitives/Mesh";
import { IModelConnection } from "../../IModelConnection";
import { LineCode } from "./EdgeOverrides";
import { ColorInfo } from "./ColorInfo";
import { SurfaceType, SurfaceFlags, RenderPass, RenderOrder } from "./RenderFlags";
import { Graphic, wantJointTriangles/*, Batch*/ } from "./Graphic";
import { FeaturesInfo } from "./FeaturesInfo";
import { VertexLUT } from "./VertexLUT";
import { Primitive } from "./Primitive";
import { FloatPreMulRgba } from "./FloatRGBA";
import { ShaderProgramParams } from "./DrawCommand";
import { Target } from "./Target";
import { BufferHandle, AttributeHandle } from "./Handle";
import { GL } from "./GL";
import { TechniqueId } from "./TechniqueId";
// import { SurfacePrimitive } from "./Surface";
// import { RenderCommands, DrawCommands } from "./DrawCommand";
import {
  QParams3d,
  QParams2d,
  Material,
  FillFlags,
  Texture,
  RenderMode,
  ViewFlags,
} from "@bentley/imodeljs-common";

export class MeshInfo {
  public readonly edgeWidth: number;
  public features?: FeaturesInfo;
  public readonly texture?: Texture; // ###TODO...
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;

  protected constructor(type: SurfaceType, edgeWidth: number, lineCode: number, fillFlags: FillFlags, isPlanar: boolean, features?: FeaturesInfo, texture?: Texture) {
    this.edgeWidth = edgeWidth;
    this.features = features;
    this.texture = texture;
    this.type = type;
    this.fillFlags = fillFlags;
    this.edgeLineCode = lineCode;
    this.isPlanar = isPlanar;
  }
}

export class MeshData extends MeshInfo {
  public readonly lut: VertexLUT.Data;
  public readonly material: MaterialData;
  public readonly animation: any; // should be a AnimationLookupTexture;

  public static create(params: MeshParams): MeshData | undefined {
    const lut = params.lutParams.toData(params.vertexParams, params.uvParams);
    return undefined !== lut ? new MeshData(lut, params) : undefined;
  }

  private constructor(lut: VertexLUT.Data, params: MeshParams) {
    super(params.type, params.edgeWidth, params.edgeLineCode, params.fillFlags, params.isPlanar, params.features, params.texture);
    this.lut = lut;
    this.material = params.material;
    this.animation = undefined;
  }
}

export class MeshParams extends MeshInfo {
  public readonly vertexParams: QParams3d;
  public readonly uvParams?: QParams2d;
  public readonly lutParams: VertexLUT.Params;
  public readonly material: Material;
  public readonly animationLUTParams: any; // TODO: should be a AnimationLUTParams;

  public constructor(args: MeshArgs) {
    // ###TODO: MeshArgs.normals should be undefined unless it's non-empty
    const isLit = undefined !== args.normals && 0 < args.normals.length;
    const isTextured = undefined !== args.texture;
    const surfaceType = isTextured ? (isLit ? SurfaceType.TexturedLit : SurfaceType.Textured) : isLit ? SurfaceType.Lit : SurfaceType.Unlit;

    super(surfaceType, args.edges.width, LineCode.valueFromLinePixels(args.edges.linePixels), args.fillFlags, args.isPlanar, FeaturesInfo.create(args.features), args.texture);

    // ###TODO: MeshArgs should quantize texture UV for us...
    // ###TODO: MeshArgs.textureUV should be undefined unless it's non-empty
    const uvRange = Range2d.createNull();
    const fpts = args.textureUv;
    if (fpts.length !== 0) {
      for (let i = 0; i < args.points.length; i++) {
        uvRange.extendPoint(Point2d.createFrom({ x: fpts[i].x, y: fpts[i].y }));
      }
    }

    this.uvParams = uvRange.isNull() ? undefined : QParams2d.fromRange(uvRange);
    this.vertexParams = args.points.params;
    this.material = args.material;
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

export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: Primitive[] = [];

  public static create(args: MeshArgs, iModel: IModelConnection) {
    const data = MeshData.create(new MeshParams(args));
    return undefined !== data ? new MeshGraphic(data, args, iModel) : undefined;
  }

  private constructor(data: MeshData, args: MeshArgs, iModel: IModelConnection) {
    super(iModel);
    this.meshData = data;

    assert(undefined !== this._primitives); // silence unused variable warnings...

    // this._primitives[0] = new SurfacePrimitive(new SurfaceGeometry(....), args, this);

    // if (args.edges.silhouettes.isValid()) { this.primitives[MeshGraphicType.kSilhouette] = new SilhouettePrimitive(args.edges.silhouettes, this); }
    const convertPolylineEdges = args.edges.polylines.isValid() && !wantJointTriangles(args.edges.width, args.is2d);
    if (convertPolylineEdges) {
      // const simpleEdges = new SimplePolylineEdgeArgs(args.edges.polylines, args.edges.edges);
      // this.primitives[MeshGraphicType.kEdge] = new EdgePrimitive(simpleEdges, this);
    } else {
      // if (args.edges.edges.isValid()) { this.primitives[MeshGraphicType.kEdge] = new EdgePrimitive(args.edges.edges, this); }
      // if (args.edges.polylines.isValid()) { this.primitives[MeshGraphicType.kPolyline] = new PolylineEdgePrimitive.create(args, this); }
    }
  }

  // public addCommands(cmds: RenderCommands): void {
  //   this.primitives.forEach((prim) => {
  //     if (true /*prim.isValid()*/) { prim.addCommands(cmds); }
  //   });
  // }
  // public addHiliteCommands(cmds: DrawCommands, batch: Batch): void {
  //   this.primitives.forEach((prim) => {
  //     if (true /*prim.isValid()*/) { prim.addHiliteCommands(cmds, batch); }
  //   });
  // }
  public setUniformFeatureIndices(id: number): void {
    this.meshData.features = FeaturesInfo.createUniform(id);
  }
  public setIsPixelMode(): void {
    // this.primitives.forEach((prim) => {
    //   if (true /*prim.isValid()*/) { prim.setIsPixelMode(); } // TODO: setIsPixelMode() has not been implemented yet
    // });
  }
  public get meshInfo(): MeshInfo { return this.meshData; }
  public get surfaceType(): SurfaceType { return this.meshInfo.type; }
}

// Defines one aspect of the geometry of a mesh (surface or edges)
export abstract class MeshGeometry extends LUTGeometry {
  protected readonly mesh: MeshData;

  // Convenience accessors...
  public get edgeWidth() { return this.mesh.edgeWidth; }
  public get edgeLineCode() { return this.mesh.edgeLineCode; }
  public get features() { return this.mesh.features; }
  public get surfaceType() { return this.mesh.type; }
  public get fillFlags() { return this.mesh.fillFlags; }
  public get isPlanar() { return this.mesh.isPlanar; }
  public get colorInfo(): ColorInfo { return this.mesh.lut.colorInfo; }
  public get uniformColor(): FloatPreMulRgba | undefined { return this.colorInfo.isUniform ? this.colorInfo.uniform : undefined; }
  public get materialData() { return this.mesh.material; }
  public get texture() { return this.mesh.texture; }

  public get lut() { return this.mesh.lut; }

  protected constructor(mesh: MeshData, numIndices: number) {
    super(numIndices);
    this.mesh = mesh;
  }

  protected computeEdgeWeight(params: ShaderProgramParams): number { return params.target.getEdgeWeight(params, this.edgeWidth); }
  protected computeEdgeLineCode(params: ShaderProgramParams): number { return params.target.getEdgeLineCode(params, this.edgeLineCode); }
  protected computeEdgeColor(target: Target): ColorInfo { return target.isEdgeColorOverridden ? target.edgeColor : this.colorInfo; }
  protected computeEdgePass(target: Target): RenderPass {
    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.showVisibleEdges()) {
      return RenderPass.None;
    }

    // Only want translucent edges in wireframe mode.
    const isTranslucent = RenderMode.Wireframe === vf.renderMode && vf.showTransparency() && this.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }
}

function wantMaterials(vf: ViewFlags) { return vf.showMaterials() && RenderMode.SmoothShade === vf.renderMode; }
function wantLighting(vf: ViewFlags) {
  return RenderMode.SmoothShade === vf.renderMode && (vf.showSourceLights() || vf.showCameraLights() || vf.showSolarLight());
}

export class SurfaceGeometry extends MeshGeometry {
  private readonly _indices: BufferHandle;

  public get isLit() { return SurfaceType.Lit === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isTextured() { return SurfaceType.Textured === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isGlyph() { return false; } // ###TODO: Need implementation of Texture...
  public isTileSection() { return false; } // ###TODO: Need implementation of Texture...

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    const offset = RenderOrder.BlankingRegion === this.renderOrder;
    if (offset) {
      gl.enable(GL.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.0, 1.0);
    }

    this._indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this.numIndices);

    if (offset) {
      gl.disable(GL.POLYGON_OFFSET_FILL);
    }
  }

  public getTechniqueId(_target: Target) { return TechniqueId.Surface; }
  public get isLitSurface() { return this.isLit; }
  public get renderOrder(): RenderOrder {
    if (FillFlags.Behind === (this.fillFlags & FillFlags.Behind))
      return RenderOrder.BlankingRegion;
    else
      return this.isPlanar ? RenderOrder.PlanarSurface : RenderOrder.Surface;
  }

  public getColor(target: Target) {
    if (FillFlags.Background === (this.fillFlags & FillFlags.Background))
      return new ColorInfo(FloatPreMulRgba.fromColorDef(target.bgColor));
    else
      return this.colorInfo;
  }

  public getRenderPass(target: Target): RenderPass {
    const mat = this.isLit ? this.mesh.material : undefined;
    // ###TODO const tex = this.texture;
    const opaquePass = this.isPlanar ? RenderPass.OpaquePlanar : RenderPass.OpaqueGeneral;
    const fillFlags = this.fillFlags;

    const vf = target.currentViewFlags;
    if (RenderMode.Wireframe === vf.renderMode) {
      const showFill = FillFlags.Always === (fillFlags & FillFlags.Always) || (vf.showFill() && FillFlags.ByView === (fillFlags & FillFlags.ByView));
      if (!showFill) {
        return RenderPass.None;
      }
    }

    if (!this.isGlyph) {
      if (!vf.showTransparency() || RenderMode.SolidFill === vf.renderMode || RenderMode.HiddenLine === vf.renderMode) {
        return opaquePass;
      }
    }

    // ###TODO if (undefined !== tex && this.wantTextures(target)) {
    // ###TODO if (tex.hasTranslucency) {
    // ###TODO   return RenderPass.Translucent;
    // ###TODO }

    // material may have texture weight < 1 - if so must account for material or element alpha below
    // ###TODO if (undefined === mat || mat.textureWeight >= 1) {
    // ###TODO   return opaquePass;
    // ###TODO }
    // ###TODO }

    let hasAlpha = false;
    if (undefined !== mat && wantMaterials(vf) /* && ###TODO material stuff */)
      hasAlpha = false; // ###TODO material stuff
    else
      hasAlpha = this.getColor(target).hasTranslucency;

    return hasAlpha ? RenderPass.Translucent : opaquePass;
  }
  public _wantWoWReversal(target: Target): boolean {
    const fillFlags = this.fillFlags;
    if (FillFlags.None !== (fillFlags & FillFlags.Background))
      return false; // fill color explicitly from background

    if (FillFlags.None !== (fillFlags & FillFlags.Always))
      return true; // fill displayed even in wireframe

    const vf = target.currentViewFlags;
    if (RenderMode.Wireframe === vf.renderMode || vf.showVisibleEdges())
      return false; // never invert surfaces when edges are displayed

    if (this.isLit && wantLighting(vf))
      return false;

    // Don't invert white pixels of textures...
    return !this.isTextured || !this.wantTextures(target);
  }
  public get material(): MaterialData { return this.materialData; }

  public computeSurfaceFlags(params: ShaderProgramParams): SurfaceFlags {
    const target = params.target;
    const vf = target.currentViewFlags;

    let flags = wantMaterials(vf) ? SurfaceFlags.None : SurfaceFlags.IgnoreMaterial;
    if (this.isLit) {
      flags |= SurfaceFlags.HasNormals;
      if (wantLighting(vf)) {
        flags |= SurfaceFlags.ApplyLighting;
        if (undefined !== target.environmentMap) {
          flags |= SurfaceFlags.EnvironmentMap;
        }
      }

      // Textured meshes store normal in place of color index.
      // Untextured lit meshes store normal where textured meshes would store UV coords.
      // Tell shader where to find normal.
      if (!this.isTextured) {
        flags |= SurfaceFlags.HasColorAndNormal;
      }
    }

    if (this.isTextured && this.wantTextures(target)) {
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

  private wantTextures(target: Target): boolean {
    if (this.isGlyph) {
      return true;
    }

    const fill = this.fillFlags;
    const flags = target.currentViewFlags;

    // ###TODO need to distinguish between gradient fill and actual textures...
    switch (flags.renderMode) {
      case RenderMode.SmoothShade: return flags.showTextures();
      case RenderMode.Wireframe: return FillFlags.Always === (fill & FillFlags.Always) || (flags.showFill() && FillFlags.ByView === (fill & FillFlags.ByView));
      default: return FillFlags.Always === (fill & FillFlags.Always);
    }
  }
}

export abstract class MeshPrimitive<Params> extends Primitive {
  public readonly mesh: MeshGraphic;
  public readonly params: Params;

  public constructor(cachedGeom: CachedGeometry, mesh: MeshGraphic, params: Params) {
    super(cachedGeom, mesh.iModel);
    this.mesh = mesh;
    this.params = params;
  }

  public assignUniformFeatureIndices(_index: number) { assert(false); } // handled by MeshGraphic...
  public get meshData(): MeshData { return this.mesh.meshData; }
  public get meshInfo(): MeshInfo { return this.mesh.meshInfo; }
}
