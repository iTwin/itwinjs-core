/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { GraphicParams, ColorDef, LinePixels, FillFlags, Gradient, Material } from "@bentley/imodeljs-common";

/** This class says what type of geometry is described by a particular DisplayParams instance. */
export const enum DisplayParamsType {
  Mesh,
  Linear,
  Text,
}

export const enum DisplayParamsRegionEdgeType {
  None,
  Default,
  Outline,
}

/** Describes what kind of comparison a DisplayParams comparison routine will perform. */
export const enum DisplayParamsComparePurpose {
  Merge,  // considers colors equivalent if both have or both lack transparency
  Strict, // compares all members
}

/** This class is used to determine if things can be batched together for display. */
export class DisplayParams {
  public readonly type: DisplayParamsType = DisplayParamsType.Mesh;
  public readonly material?: Material; // meshes only
  public readonly gradient?: Gradient.Symb;
  // ###TODO: public textureMapping: TextureMapping; // only if m_material is null (e.g. gradients, glyph bitmaps) // TextureMapping doesn't exist yet!!!
  public readonly lineColor: ColorDef; // all types of geometry (edge color for meshes)
  public readonly fillColor: ColorDef; // meshes only
  public readonly width: number = 0; // linear and mesh (edges)
  public readonly linePixels: LinePixels = LinePixels.Solid; // linear and mesh (edges)
  public readonly fillFlags: FillFlags = FillFlags.None; // meshes only
  public readonly ignoreLighting: boolean = false; // always true for text and linear geometry; true for meshes only if normals not desired

  /** Instantiates the class based on DisplayParamsType and GraphicParams. */
  private constructor(type: DisplayParamsType, gf: GraphicParams) {
    this.type = type;
    this.lineColor = gf.lineColor.clone();
    switch (type) {
      case DisplayParamsType.Mesh:
        this.material = gf.material;
        this.gradient = gf.gradient;
        // ###TODO: set texturemapping if m_material is undefined, and base it on gradient
        this.fillColor = gf.fillColor.clone();
        this.fillFlags = gf.fillFlags;
        this.width = gf.rasterWidth;
        this.linePixels = gf.linePixels;
        break;

      case DisplayParamsType.Linear:
        this.fillColor = this.lineColor;
        this.width = gf.rasterWidth;
        this.linePixels = gf.linePixels;
        break;

      default: // DisplayParamsType.Text
        this.fillColor = this.lineColor;
        this.ignoreLighting = true;
        this.fillFlags = FillFlags.Always;
        break;
    }
  }

  /** Creates a DisplayParams object for a particular type (mesh, linear, text) based on the specified GraphicParams. */
  public static createForType(type: DisplayParamsType, gf: GraphicParams): DisplayParams {
    switch (type) {
      case DisplayParamsType.Mesh:
        return this.createForMesh(gf);

      case DisplayParamsType.Linear:
        return this.createForLinear(gf);

      case DisplayParamsType.Text:
        return this.createForText(gf);
    }
  }

  /** Creates a DisplayParams object that describes mesh geometry based on the specified GraphicParams. */
  public static createForMesh(gf: GraphicParams): DisplayParams {
    return new DisplayParams(DisplayParamsType.Mesh, gf);
  }

  /** Creates a DisplayParams object that describes linear geometry based on the specified GraphicParams. */
  public static createForLinear(gf: GraphicParams): DisplayParams {
    return new DisplayParams(DisplayParamsType.Linear, gf);
  }

  /** Creates a DisplayParams object that describes text geometry based on the specified GraphicParams. */
  public static createForText(gf: GraphicParams): DisplayParams {
    return new DisplayParams(DisplayParamsType.Text, gf);
  }

  public get regionEdgeType(): DisplayParamsRegionEdgeType {
    if (this.hasBlankingFill)
      return DisplayParamsRegionEdgeType.None;

    if (this.gradient !== undefined && undefined !== this.gradient.flags) {
      // Even if the gradient is not outlined, produce an outline to be displayed as the region's edges when fill ViewFlag is off.
      const gradFlags: Gradient.Flags = this.gradient.flags;
      if (0 !== (gradFlags & Gradient.Flags.Outline) || FillFlags.None === (this.fillFlags & FillFlags.Always))
        return DisplayParamsRegionEdgeType.Outline;
      return DisplayParamsRegionEdgeType.None;
    }
    return (!this.fillColor.equals(this.lineColor)) ? DisplayParamsRegionEdgeType.Outline : DisplayParamsRegionEdgeType.Default;
  }

  public get wantRegionOutline(): boolean {
    return DisplayParamsRegionEdgeType.Outline === this.regionEdgeType;
  }

  public get hasBlankingFill(): boolean { return FillFlags.Blanking === (this.fillFlags & FillFlags.Blanking); }
  public get hasFillTransparency(): boolean { return 0 !== this.fillColor.getAlpha(); }
  public get hasLineTransparency(): boolean { return 0 !== this.lineColor.getAlpha(); }
  public get isTextured(): boolean { return false; } // return this.textureMapping.isValid(); }

  /** Determines if the properties of this DisplayParams object are equal to those of another DisplayParams object.  */
  public equals(rhs: DisplayParams, purpose: DisplayParamsComparePurpose = DisplayParamsComparePurpose.Strict): boolean {
    if (rhs === this)
      return true;

    if (this.type !== rhs.type) return false;
    if (this.ignoreLighting !== rhs.ignoreLighting) return false;
    if (this.width !== rhs.width) return false;
    if (this.material !== rhs.material) return false;
    if (this.linePixels !== rhs.linePixels) return false;
    if (this.fillFlags !== rhs.fillFlags) return false;
    // ###TODO: if (this.textureMapping.texture !== rhs.textureMapping.texture) return false;
    if (this.wantRegionOutline !== rhs.wantRegionOutline) return false;

    if (DisplayParamsComparePurpose.Merge === purpose) {
      if (this.hasFillTransparency !== rhs.hasFillTransparency) return false;
      if (this.hasLineTransparency !== rhs.hasLineTransparency) return false;
      // ###TODO: if texture mapping, test fillColor to match // Textures may use color so they can't be merged. (could test if texture actually uses color).
      return true;
    }

    if (!this.fillColor.equals(rhs.fillColor)) return false;
    if (!this.lineColor.equals(rhs.lineColor)) return false;
    return true;
  }
}
