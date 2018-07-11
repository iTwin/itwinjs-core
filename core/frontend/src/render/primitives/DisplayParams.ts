/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { GraphicParams, ColorDef, LinePixels, FillFlags, Gradient, RenderMaterial, TextureMapping, RenderTexture } from "@bentley/imodeljs-common";
import { compareNumbers, compareBooleans, compareStringsOrUndefined, comparePossiblyUndefined, assert } from "@bentley/bentleyjs-core";

function compareMaterials(lhs?: RenderMaterial, rhs?: RenderMaterial): number {
  return comparePossiblyUndefined((lhMat: RenderMaterial, rhMat: RenderMaterial) => lhMat === rhMat ? 0 : compareStringsOrUndefined(lhMat.key, rhMat.key), lhs, rhs);
}
function compareTextureMappings(lhs?: TextureMapping, rhs?: TextureMapping): number {
  return comparePossiblyUndefined((lhTex: TextureMapping, rhTex: TextureMapping) => lhTex === rhTex ? 0 : compareStringsOrUndefined(lhTex.texture.key, rhTex.texture.key), lhs, rhs);
}

/** This class is used to determine if things can be batched together for display. */
export class DisplayParams {
  public static readonly minTransparency: number = 15;  // Threshold below which we consider a color fully opaque
  public readonly type: DisplayParams.Type = DisplayParams.Type.Mesh;
  public readonly material?: RenderMaterial; // meshes only
  public readonly gradient?: Gradient.Symb;
  private readonly _textureMapping?: TextureMapping; // only if material is undefined - e.g. glyphs, gradients
  public readonly lineColor: ColorDef; // all types of geometry (edge color for meshes)
  public readonly fillColor: ColorDef; // meshes only
  public readonly width: number; // linear and mesh (edges)
  public readonly linePixels: LinePixels; // linear and mesh (edges)
  public readonly fillFlags: FillFlags; // meshes only
  public readonly ignoreLighting: boolean; // always true for text and linear geometry; true for meshes only if normals not desired

  public constructor(type: DisplayParams.Type, lineColor: ColorDef, fillColor: ColorDef, width: number = 0, linePixels: LinePixels = LinePixels.Solid,
    fillFlags: FillFlags = FillFlags.None, material?: RenderMaterial, gradient?: Gradient.Symb, ignoreLighting: boolean = false, textureMapping?: TextureMapping) {
    this.type = type;
    this.material = material;
    this.gradient = gradient;
    this.lineColor = DisplayParams.adjustTransparencyInPlace(lineColor);
    this.fillColor = DisplayParams.adjustTransparencyInPlace(fillColor);
    this.width = width;
    this.linePixels = linePixels;
    this.fillFlags = fillFlags;
    this.ignoreLighting = ignoreLighting;
    this._textureMapping = textureMapping;

    assert(undefined === material || undefined === textureMapping);
  }

  /** Creates a DisplayParams object for a particular type (mesh, linear, text) based on the specified GraphicParams. */
  public static createForType(type: DisplayParams.Type, gf: GraphicParams, resolveGradient?: (grad: Gradient.Symb) => RenderTexture | undefined): DisplayParams {
    const lineColor = DisplayParams.adjustTransparencyInPlace(gf.lineColor.clone());
    switch (type) {
      case DisplayParams.Type.Mesh: {
        let gradientMapping: TextureMapping | undefined;
        if (undefined !== gf.gradient && undefined !== resolveGradient) {
          const gradientTexture = resolveGradient(gf.gradient);
          if (undefined !== gradientTexture)
            gradientMapping = new TextureMapping(gradientTexture, new TextureMapping.Params());
        }
        return new DisplayParams(type, lineColor, DisplayParams.adjustTransparencyInPlace(gf.fillColor.clone()), gf.rasterWidth, gf.linePixels, gf.fillFlags, gf.material, gf.gradient, false, gradientMapping);
      }
      case DisplayParams.Type.Linear:
        return new DisplayParams(type, lineColor, lineColor, gf.rasterWidth, gf.linePixels);
      default: // DisplayParams.Type.Text
        return new DisplayParams(type, lineColor, lineColor, 0, LinePixels.Solid, FillFlags.Always, undefined, undefined, true);
    }
  }

  /** Creates a DisplayParams object that describes mesh geometry based on the specified GraphicParams. */
  public static createForMesh(gf: GraphicParams, resolveGradient?: (grad: Gradient.Symb) => RenderTexture | undefined): DisplayParams {
    return DisplayParams.createForType(DisplayParams.Type.Mesh, gf, resolveGradient);
  }

  /** Creates a DisplayParams object that describes linear geometry based on the specified GraphicParams. */
  public static createForLinear(gf: GraphicParams): DisplayParams {
    return DisplayParams.createForType(DisplayParams.Type.Linear, gf);
  }

  /** Creates a DisplayParams object that describes text geometry based on the specified GraphicParams. */
  public static createForText(gf: GraphicParams): DisplayParams {
    return DisplayParams.createForType(DisplayParams.Type.Text, gf);
  }

  public get regionEdgeType(): DisplayParams.RegionEdgeType {
    if (this.hasBlankingFill)
      return DisplayParams.RegionEdgeType.None;

    if (this.gradient !== undefined && undefined !== this.gradient.flags) {
      // Even if the gradient is not outlined, produce an outline to be displayed as the region's edges when fill ViewFlag is off.
      const gradFlags: Gradient.Flags = this.gradient.flags;
      if (0 !== (gradFlags & Gradient.Flags.Outline) || FillFlags.None === (this.fillFlags & FillFlags.Always))
        return DisplayParams.RegionEdgeType.Outline;
      return DisplayParams.RegionEdgeType.None;
    }
    return (!this.fillColor.equals(this.lineColor)) ? DisplayParams.RegionEdgeType.Outline : DisplayParams.RegionEdgeType.Default;
  }

  public get wantRegionOutline(): boolean {
    return DisplayParams.RegionEdgeType.Outline === this.regionEdgeType;
  }

  public get hasBlankingFill(): boolean { return FillFlags.Blanking === (this.fillFlags & FillFlags.Blanking); }
  public get hasFillTransparency(): boolean { return 255 !== this.fillColor.getAlpha(); }
  public get hasLineTransparency(): boolean { return 255 !== this.lineColor.getAlpha(); }
  public get textureMapping(): TextureMapping | undefined { return undefined !== this.material ? this.material.textureMapping : this._textureMapping; }
  public get isTextured(): boolean { return undefined !== this.textureMapping; }

  /** Determines if the properties of this DisplayParams object are equal to those of another DisplayParams object.  */
  public equals(rhs: DisplayParams, purpose: DisplayParams.ComparePurpose = DisplayParams.ComparePurpose.Strict): boolean {
    if (DisplayParams.ComparePurpose.Merge === purpose)
      return 0 === this.compareForMerge(rhs);
    else if (rhs === this)
      return true;

    if (this.type !== rhs.type) return false;
    if (this.ignoreLighting !== rhs.ignoreLighting) return false;
    if (this.width !== rhs.width) return false;
    if (this.linePixels !== rhs.linePixels) return false;
    if (this.fillFlags !== rhs.fillFlags) return false;
    if (this.wantRegionOutline !== rhs.wantRegionOutline) return false;
    if (this.material !== rhs.material) return false;
    if (this.textureMapping !== rhs.textureMapping) return false;

    if (!this.fillColor.equals(rhs.fillColor)) return false;
    if (!this.lineColor.equals(rhs.lineColor)) return false;
    return true;
  }

  public compareForMerge(rhs: DisplayParams): number {
    if (rhs === this)
      return 0;

    let diff = compareNumbers(this.type, rhs.type);
    if (0 === diff) {
      diff = compareBooleans(this.ignoreLighting, rhs.ignoreLighting);
      if (0 === diff) {
        diff = compareNumbers(this.width, rhs.width);
        if (0 === diff) {
          diff = compareNumbers(this.linePixels, rhs.linePixels);
          if (0 === diff) {
            diff = compareNumbers(this.fillFlags, rhs.fillFlags);
            if (0 === diff) {
              diff = compareBooleans(this.wantRegionOutline, rhs.wantRegionOutline);
              if (0 === diff) {
                diff = compareBooleans(this.hasFillTransparency, rhs.hasFillTransparency);
                if (0 === diff) {
                  diff = compareBooleans(this.hasLineTransparency, rhs.hasLineTransparency);
                  if (0 === diff) {
                    diff = compareMaterials(this.material, rhs.material);
                    if (0 === diff && undefined === this.material && this.isTextured) {
                      diff = compareTextureMappings(this.textureMapping, rhs.textureMapping);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return diff;
  }

  /**
   * Given a ColorDef object, check its transparency and if it falls below the minimum, mark the color as fully opaque.
   * @return The original reference to the color provided, which has possibly been modified.
   */
  public static adjustTransparencyInPlace(color: ColorDef): ColorDef {
    if (color.colors.t < DisplayParams.minTransparency)
      color.setTransparency(0);
    return color;
  }
}

export namespace DisplayParams {
  export enum Type {
    Mesh,
    Linear,
    Text,
  }

  export enum RegionEdgeType {
    None,
    Default,
    Outline,
  }

  export enum ComparePurpose {
    Merge,  // considers colors equivalent if both have or both lack transparency
    Strict, // compares all members
  }
}
