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

/** Describes what kind of comparison a DisplayParams comparison routine will perform. */
export const enum DisplayParamsComparePurpose {
  Merge,  // considers colors equivalent if both have or both lack transparency
  Strict  // compares all members
}

/** This class is used to determine if things can be batched together for display. */
export class DisplayParams {
  readonly type: DisplayParamsType = DisplayParamsType.Mesh;
  readonly material: Material | undefined = undefined; // meshes only
  readonly gradient: Gradient.Symb | undefined = undefined;
  // ###TODO: public textureMapping: TextureMapping; // only if m_material is null (e.g. gradients, glyph bitmaps) // TextureMapping doesn't exist yet!!!
  readonly lineColor: ColorDef = ColorDef.white; // all types of geometry (edge color for meshes)
  readonly fillColor: ColorDef = ColorDef.white; // meshes only
  readonly width: number = 0; // linear and mesh (edges)
  readonly linePixels: LinePixels = LinePixels.Solid; // linear and mesh (edges)
  readonly fillFlags: FillFlags = FillFlags.None; // meshes only
  readonly ignoreLighting: boolean = false; // always true for text and linear geometry; true for meshes only if normals not desired
  readonly hasRegionOutline: boolean = false;

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
        this.hasRegionOutline = this.computeHasRegionOutline();
        break;

      case DisplayParamsType.Linear:
        this.fillColor = this.lineColor.clone();
        this.width = gf.rasterWidth;
        this.linePixels = gf.linePixels;
        break;

      case DisplayParamsType.Text:
        this.fillColor = this.lineColor.clone();
        this.ignoreLighting = true;
        this.fillFlags = FillFlags.Always;
        break;
    }
    // otherwise, generic DisplayParams; keep default property values.
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

  public computeHasRegionOutline(): boolean {
    if (undefined !== this.gradient && undefined !== this.gradient.flags) {
      let gradFlags: Gradient.Flags = this.gradient.flags;
      return 0 !== (gradFlags & Gradient.Flags.Outline) ? true : false;
    }
    return !this.neverRegionOutline && !this.fillColor.equals(this.lineColor);
  }

  public get neverRegionOutline(): boolean {
    if (this.hasBlankingFill)
      return true;
    if (undefined !== this.gradient && undefined !== this.gradient.flags) {
      let gradFlags: Gradient.Flags = this.gradient.flags;
      return 0 !== (gradFlags & Gradient.Flags.Outline) ? false : true;
    }
    return false;
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
    if (this.material !== rhs.material) return false; // comparing objects ok?  Need equals() method / cloning?
    if (this.linePixels !== rhs.linePixels) return false;
    if (this.fillFlags !== rhs.fillFlags) return false;
    // ###TODO: if (this.textureMapping.texture !== rhs.textureMapping.texture) return false;
    if (this.hasRegionOutline !== rhs.hasRegionOutline) return false;

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
