/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, IDisposable } from "@bentley/bentleyjs-core";
import { FillFlags, ViewFlags, RenderMode } from "@bentley/imodeljs-common";
import { MeshArgs } from "../primitives/mesh/MeshPrimitives";
import { SurfaceType, SurfaceFlags, RenderPass, RenderOrder } from "./RenderFlags";
import { MeshData, MeshGeometry, MeshPrimitive, MeshGraphic } from "./Mesh";
import { VertexLUT } from "./VertexLUT";
import { System } from "./System";
import { BufferHandle, AttributeHandle } from "./Handle";
import { GL } from "./GL";
import { TechniqueId } from "./TechniqueId";
import { Target } from "./Target";
import { ColorInfo } from "./ColorInfo";
import { FloatPreMulRgba } from "./FloatRGBA";
import { ShaderProgramParams } from "./DrawCommand";
import { Material } from "./Material";

function wantMaterials(vf: ViewFlags) { return vf.showMaterials() && RenderMode.SmoothShade === vf.renderMode; }
function wantLighting(vf: ViewFlags) {
  return RenderMode.SmoothShade === vf.renderMode && (vf.showSourceLights() || vf.showCameraLights() || vf.showSolarLight());
}

export class SurfaceGeometry extends MeshGeometry implements IDisposable {
  private readonly _indices: BufferHandle;

  public static create(mesh: MeshData, indices: number[]): SurfaceGeometry | undefined {
    const indexBytes = VertexLUT.convertIndicesToTriplets(indices);
    const indexBuffer = BufferHandle.createArrayBuffer(indexBytes);
    return undefined !== indexBuffer ? new SurfaceGeometry(indexBuffer, indices.length, mesh) : undefined;
  }

  public dispose() {
    if (!this._isDisposed) {
      this._indices.dispose();
      super.dispose();
    }
  }

  public get isLit() { return SurfaceType.Lit === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isTextured() { return SurfaceType.Textured === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isGlyph() { return undefined !== this.texture && this.texture.isGlyph; }
  public get isTileSection() { return undefined !== this.texture && this.texture.isTileSection; }

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
    const tex = this.texture;
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

    if (undefined !== tex && this.wantTextures(target)) {
      if (tex.hasTranslucency)
        return RenderPass.Translucent;

      // material may have texture weight < 1 - if so must account for material or element alpha below
      if (undefined === mat || (mat.textureMapping !== undefined && mat.textureMapping.params.weight >= 1))
        return opaquePass;
    }

    const hasAlpha = (undefined !== mat && wantMaterials(vf) && mat.hasTranslucency) || this.getColor(target).hasTranslucency;
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
  public get material(): Material | undefined { return this.mesh.material; }

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
    this._isDisposed = false;
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

export class SurfacePrimitive extends MeshPrimitive implements IDisposable {
  public static create(args: MeshArgs, mesh: MeshGraphic): SurfacePrimitive | undefined {
    if (undefined === args.vertIndices) {
      assert(false);
      return undefined;
    }

    const geom = SurfaceGeometry.create(mesh.meshData, args.vertIndices);
    return undefined !== geom ? new SurfacePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: SurfaceGeometry, mesh: MeshGraphic) {
    super(cachedGeom, mesh);
  }

  public dispose() {
    if (!this._isDisposed)
      super.dispose();
    this._isDisposed = true;
  }

  public get renderOrder(): RenderOrder {
    if (FillFlags.Behind === (this.meshData.fillFlags & FillFlags.Behind))
      return RenderOrder.BlankingRegion;
    else
      return this.meshData.isPlanar ? RenderOrder.PlanarSurface : RenderOrder.Surface;
  }
}
