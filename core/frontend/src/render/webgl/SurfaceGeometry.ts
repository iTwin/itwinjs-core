/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { FillFlags, RenderMode, TextureTransparency, ThematicGradientTransparencyMode, ViewFlags } from "@itwin/core-common";
import { SurfaceType } from "../../common/internal/render/SurfaceParams";
import { VertexIndices } from "../../common/internal/render/VertexIndices";
import { RenderMemory } from "../RenderMemory";
import { AttributeMap } from "./AttributeMap";
import { ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { MaterialInfo } from "./Material";
import { Pass, RenderOrder, RenderPass, SurfaceBitIndex } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import { MeshData } from "./MeshData";
import { MeshGeometry } from "./MeshGeometry";

/** @internal */
export function wantMaterials(vf: ViewFlags): boolean {
  return vf.materials && RenderMode.SmoothShade === vf.renderMode;
}

function wantLighting(vf: ViewFlags) {
  return RenderMode.SmoothShade === vf.renderMode && vf.lighting;
}

/** @internal */
export class SurfaceGeometry extends MeshGeometry {
  private readonly _buffers: BuffersContainer;
  private readonly _indices: BufferHandle;

  public get lutBuffers() { return this._buffers; }

  public static create(mesh: MeshData, indices: VertexIndices): SurfaceGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(indices.data);
    return undefined !== indexBuffer ? new SurfaceGeometry(indexBuffer, indices.length, mesh) : undefined;
  }

  public get isDisposed(): boolean {
    return this._buffers.isDisposed
      && this._indices.isDisposed;
  }

  public dispose() {
    dispose(this._buffers);
    dispose(this._indices);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addSurface(this._indices.bytesUsed);
  }

  public get isLit() { return SurfaceType.Lit === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get isTexturedType() { return SurfaceType.Textured === this.surfaceType || SurfaceType.TexturedLit === this.surfaceType; }
  public get hasTexture() { return this.isTexturedType && undefined !== this.texture; }
  public get hasNormalMap() { return this.isLit && this.isTexturedType && undefined !== this.normalMap; }
  public get isGlyph() { return this.mesh.isGlyph; }
  public override get alwaysRenderTranslucent() { return this.isGlyph; }
  public get isTileSection() { return undefined !== this.texture && this.texture.isTileSection; }
  public get isClassifier() { return SurfaceType.VolumeClassifier === this.surfaceType; }
  public override get supportsThematicDisplay() {
    return !this.isGlyph;
  }

  public override get allowColorOverride() {
    // Text background color should not be overridden by feature symbology overrides - otherwise it becomes unreadable...
    // We don't actually know if we have text.
    // We do know that text background color uses blanking fill. So do ImageGraphics, so they're also going to forbid overriding their color.
    return FillFlags.Blanking !== (this.fillFlags & FillFlags.Blanking);
  }

  public override get asSurface() { return this; }
  public override get asEdge() { return undefined; }
  public override get asSilhouette() { return undefined; }

  protected _draw(numInstances: number, instanceBuffersContainer?: BuffersContainer): void {
    const system = System.instance;

    // If we can't write depth in the fragment shader, use polygonOffset to force blanking regions to draw behind.
    const offset = RenderOrder.BlankingRegion === this.renderOrder && !system.supportsLogZBuffer;
    if (offset) {
      system.context.enable(GL.POLYGON_OFFSET_FILL);
      system.context.polygonOffset(1.0, 1.0);
    }

    const bufs = instanceBuffersContainer !== undefined ? instanceBuffersContainer : this._buffers;
    bufs.bind();
    system.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);
    bufs.unbind();

    if (offset)
      system.context.disable(GL.POLYGON_OFFSET_FILL);
  }

  public override wantMixMonochromeColor(target: Target): boolean {
    // Text relies on white-on-white reversal.
    return !this.isGlyph && (this.isLitSurface || this.wantTextures(target, this.hasTexture));
  }

  public get techniqueId(): TechniqueId { return TechniqueId.Surface; }
  public override get isLitSurface() { return this.isLit; }
  public override get hasBakedLighting() { return this.mesh.hasBakedLighting; }
  public get renderOrder(): RenderOrder {
    if (FillFlags.Behind === (this.fillFlags & FillFlags.Behind))
      return RenderOrder.BlankingRegion;

    let order = this.isLit ? RenderOrder.LitSurface : RenderOrder.UnlitSurface;
    if (this.isPlanar)
      order = order | RenderOrder.PlanarBit;

    return order;
  }

  public override getColor(target: Target) {
    if (FillFlags.Background === (this.fillFlags & FillFlags.Background))
      return target.uniforms.style.backgroundColorInfo;
    else
      return this.colorInfo;
  }

  public override getPass(target: Target): Pass {
    // Classifiers have a dedicated pass
    if (this.isClassifier)
      return "classification";

    let opaquePass: Pass = this.isPlanar ? "opaque-planar" : "opaque";

    // When reading pixels, glyphs are always opaque. Otherwise always transparent (for anti-aliasing).
    if (this.isGlyph)
      return target.isReadPixelsInProgress ? opaquePass : "translucent";

    const vf = target.currentViewFlags;

    // When rendering thematic isolines, we need translucency because they have anti-aliasing.
    const thematic = target.wantThematicDisplay && this.supportsThematicDisplay ? target.uniforms.thematic.thematicDisplay : undefined;
    if (thematic && target.uniforms.thematic.wantIsoLines)
      return "translucent";

    // In wireframe, unless fill is explicitly enabled for planar region, surface does not draw
    if (RenderMode.Wireframe === vf.renderMode && !this.mesh.isTextureAlwaysDisplayed) {
      const fillFlags = this.fillFlags;
      const showFill = FillFlags.Always === (fillFlags & FillFlags.Always) || (vf.fill && FillFlags.ByView === (fillFlags & FillFlags.ByView));
      if (!showFill)
        return "none";
    }

    // If transparency disabled by render mode or view flag, always draw opaque.
    if (!vf.transparency || RenderMode.SolidFill === vf.renderMode || RenderMode.HiddenLine === vf.renderMode)
      return opaquePass;

    // A gradient texture applied by analysis style always fully determines the transparency of the surface.
    if (this.hasScalarAnimation && undefined !== target.analysisTexture) {
      assert(undefined !== target.analysisStyle?.thematic);
      switch (target.analysisStyle.thematic.thematicSettings.textureTransparency) {
        case TextureTransparency.Translucent:
          return "translucent";
        case TextureTransparency.Opaque:
          return opaquePass;
        case TextureTransparency.Mixed:
          return `${opaquePass}-translucent`;
      }
    }

    // We have 3 sources of alpha: the material, the texture, and the color.
    // Base alpha comes from the material if it overrides it; otherwise from the color.
    // The texture's alpha is multiplied by the base alpha.
    // So we must draw in the translucent pass if the texture has transparency OR the base alpha is less than 1.
    let hasAlpha = false;
    const mat = wantMaterials(vf) ? this.mesh.materialInfo : undefined;
    if (undefined !== mat && mat.overridesAlpha)
      hasAlpha = mat.hasTranslucency;
    else
      hasAlpha = this.getColor(target).hasTranslucency;

    // Thematic gradient can optionally multiply gradient alpha with surface alpha.
    if (thematic && thematic.gradientSettings.transparencyMode === ThematicGradientTransparencyMode.MultiplySurfaceAndGradient) {
      switch (thematic.gradientSettings.textureTransparency) {
        case TextureTransparency.Opaque:
          // This surface's alpha gets multiplied by 1 - gradient colors are all opaque.
          return hasAlpha ? "translucent" : opaquePass;
        case TextureTransparency.Translucent:
          // This surface's alpha gets multiplied by < 1 - gradient colors are all translucent.
          return "translucent";
        case TextureTransparency.Mixed:
          // The gradient contains a mix of translucent and opaque colors.
          return hasAlpha ? "translucent" : `${opaquePass}-translucent`;
      }
    }

    if (!hasAlpha) {
      const tex = this.wantTextures(target, true) ? this.texture : undefined;
      switch (tex?.transparency) {
        case TextureTransparency.Translucent:
          hasAlpha = true;
          break;
        case TextureTransparency.Mixed:
          opaquePass = `${opaquePass}-translucent`;
          break;
      }
    }

    return hasAlpha ? "translucent" : opaquePass;
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
    return !this.wantTextures(target, this.hasTexture);
  }

  public override get materialInfo(): MaterialInfo | undefined { return this.mesh.materialInfo; }

  public useTexture(params: ShaderProgramParams): boolean {
    return this.wantTextures(params.target, this.hasTexture);
  }

  public useNormalMap(params: ShaderProgramParams): boolean {
    return this.wantNormalMaps(params.target, this.hasNormalMap);
  }

  public computeSurfaceFlags(params: ShaderProgramParams, flags: Int32Array): void {
    const target = params.target;
    const vf = target.currentViewFlags;

    const useMaterial = wantMaterials(vf);
    flags[SurfaceBitIndex.IgnoreMaterial] = useMaterial ? 0 : 1;
    flags[SurfaceBitIndex.HasMaterialAtlas] = useMaterial && this.hasMaterialAtlas ? 1 : 0;

    flags[SurfaceBitIndex.ApplyLighting] = 0;
    flags[SurfaceBitIndex.HasColorAndNormal] = 0;
    if (this.isLit) {
      flags[SurfaceBitIndex.HasNormals] = 1;
      if (wantLighting(vf))
        flags[SurfaceBitIndex.ApplyLighting] = 1;

      // Textured meshes store normal in place of color index.
      // Untextured lit meshes store normal where textured meshes would store UV coords.
      // Tell shader where to find normal.
      if (!this.isTexturedType) {
        flags[SurfaceBitIndex.HasColorAndNormal] = 1;
      }
    } else {
      flags[SurfaceBitIndex.HasNormals] = 0;
    }

    flags[SurfaceBitIndex.HasTexture] = this.useTexture(params) ? 1 : 0;
    flags[SurfaceBitIndex.HasNormalMap] = this.useNormalMap(params) ? 1 : 0;
    flags[SurfaceBitIndex.UseConstantLodTextureMapping] = this.mesh.textureUsesConstantLod ? 1 : 0;
    flags[SurfaceBitIndex.UseConstantLodNormalMapMapping] = this.mesh.normalMapUsesConstantLod ? 1 : 0;

    // The transparency threshold controls how transparent a surface must be to allow light to pass through; more opaque surfaces cast shadows.
    flags[SurfaceBitIndex.TransparencyThreshold] = params.target.isDrawingShadowMap ? 1 : 0;
    flags[SurfaceBitIndex.BackgroundFill] = 0;
    switch (params.renderPass) {
      // NB: We need this for opaque pass due to SolidFill (must compute transparency, discard below threshold, render opaque at or above threshold)
      case RenderPass.OpaqueLinear:
      case RenderPass.OpaquePlanar:
      case RenderPass.OpaqueGeneral:
      case RenderPass.Translucent:
      case RenderPass.WorldOverlay:
      case RenderPass.OpaqueLayers:
      case RenderPass.TranslucentLayers:
      case RenderPass.OverlayLayers: {
        const mode = vf.renderMode;
        if (!this.isGlyph && (RenderMode.HiddenLine === mode || RenderMode.SolidFill === mode)) {
          flags[SurfaceBitIndex.TransparencyThreshold] = 1;
          if (RenderMode.HiddenLine === mode && FillFlags.Always !== (this.fillFlags & FillFlags.Always)) {
            // fill flags test for text - doesn't render with bg fill in hidden line mode.
            flags[SurfaceBitIndex.BackgroundFill] = 1;
          }
          break;
        }
      }
    }
  }

  private constructor(indices: BufferHandle, numIndices: number, mesh: MeshData) {
    super(mesh, numIndices);
    this._buffers = BuffersContainer.create();
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.Surface, false);
    assert(undefined !== attrPos);
    this._buffers.addBuffer(indices, [BufferParameters.create(attrPos.location, 3, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this._indices = indices;
  }

  private wantTextures(target: Target, surfaceTextureExists: boolean): boolean {
    if (this.hasScalarAnimation && undefined !== target.analysisTexture)
      return true;

    if (!surfaceTextureExists)
      return false;

    if (this.mesh.isTextureAlwaysDisplayed)
      return true;

    if (this.supportsThematicDisplay && target.wantThematicDisplay)
      return false;

    const fill = this.fillFlags;
    const flags = target.currentViewFlags;

    // ###TODO need to distinguish between gradient fill and actual textures...
    switch (flags.renderMode) {
      case RenderMode.SmoothShade:
        return flags.textures;
      case RenderMode.Wireframe:
        return FillFlags.Always === (fill & FillFlags.Always) || (flags.fill && FillFlags.ByView === (fill & FillFlags.ByView));
      default:
        return FillFlags.Always === (fill & FillFlags.Always);
    }
  }

  private wantNormalMaps(target: Target, normalMapExists: boolean): boolean {
    if (!normalMapExists || !target.displayNormalMaps)
      return false;

    const flags = target.currentViewFlags;

    switch (flags.renderMode) {
      case RenderMode.SmoothShade:
        return flags.textures;
      default:
        return false;
    }
  }
}
