/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Transform } from "@bentley/geometry-core/lib/PointVector";
import { LineStyleInfo } from "./LineStyle";
import { GradientSymb } from "./GradientPattern";
import { PatternParams } from "./AreaPattern";
import { DgnFB } from "./ElementGraphicsSchema";
import { ColorDef, ColorRgb } from "../ColorDef";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Appearance } from "../SubCategoryAppearance";

export const enum BackgroundFill {
  None = 0,     // single color fill uses the fill color and line color to draw either a solid or outline fill
  Solid = 1,    // single color fill uses the view's background color to draw a solid fill
  Outline = 2,  // single color fill uses the view's background color and line color to draw an outline fill
}

/** Structure to hold the displayable parameters of a GeometrySource */
export class GeometryParams {
  // Flags for parameters that override SubCategory:Appearance
  private _colorOverride: boolean = false;
  private _weightOverride: boolean = false;
  private _styleOverride: boolean = false;
  private _materialOverride: boolean = false;
  private _fillOverride: boolean = false;

  private _resolved: boolean = false;             // !< whether Resolve has established SubCategory::Appearance/effective values.
  private _categoryId: Id64;                     // !< the Category Id on which the geometry is drawn.
  private _subCategoryId: Id64;                  // !< the SubCategory Id that controls the appearance of subsequent geometry.
  private _materialId?: Id64 | undefined;                     // !< render material Id.
  private _elmPriority: number = 0;                  // !< display priority (applies to 2d only)
  private _netPriority: number = 0;                  // !< net display priority for element/category (applies to 2d only)
  private _weight: number = 0;
  private _lineColor?: ColorDef;
  private _fillColor?: ColorDef;                  // !< fill color (applicable only if filled)
  private _backgroundFill: BackgroundFill = BackgroundFill.None;       // !< support for fill using the view's background color.
  private _fillDisplay: DgnFB.FillDisplay = DgnFB.FillDisplay.None;             // !< whether or not the element should be displayed filled
  private _elmTransparency: number = 0;              // !< transparency, 1.0 == completely transparent.
  private _netElmTransparency: number = 0;           // !< net transparency for element/category.
  private _fillTransparency: number = 0;             // !< fill transparency, 1.0 == completely transparent.
  private _netFillTransparency: number = 0;          // !< net transparency for fill/category.
  private _geometryClass: DgnFB.GeometryClass = DgnFB.GeometryClass.Primary;      // !< geometry class
  private _styleInfo?: LineStyleInfo;             // !< line style id plus modifiers.
  private _gradient?: GradientSymb;               // !< gradient fill settings.
  private _pattern?: PatternParams;               // !< area pattern settings.

  private constructor() {
  }

  public static createDefaults(): GeometryParams {
    return new GeometryParams();
  }

  public static createId(categoryId: Id64, subCategoryId: Id64 = new Id64()): GeometryParams {
    const retVal = new GeometryParams();
    retVal._categoryId = categoryId;
    if (subCategoryId.isValid())
      retVal._subCategoryId = subCategoryId;
    else {
      const high = categoryId.getHigh();
      const low = categoryId.getLow() + 1;
      retVal._subCategoryId = new Id64([low, high]);
    }
    return retVal;
  }

  public clone(): GeometryParams {
    const retVal = new GeometryParams();
    retVal._colorOverride = this._colorOverride;
    retVal._weightOverride = this._weightOverride;
    retVal._styleOverride = this._styleOverride;
    retVal._materialOverride = this._materialOverride;
    retVal._fillOverride = this._fillOverride;
    retVal._resolved = this._resolved;
    retVal._categoryId = this._categoryId;
    retVal._subCategoryId = this._subCategoryId;
    retVal._materialId = this._materialId;
    retVal._elmPriority = this._elmPriority;
    retVal._netPriority = this._netPriority;
    retVal._weight = this._weight;
    retVal._lineColor = this._lineColor ? new ColorDef(this._lineColor) : undefined;
    retVal._fillColor = this._fillColor ? new ColorDef(this._fillColor) : undefined;
    retVal._backgroundFill = this._backgroundFill;
    retVal._fillDisplay = this._fillDisplay;
    retVal._elmTransparency = this._elmTransparency;
    retVal._netElmTransparency = this._netElmTransparency;
    retVal._fillTransparency = this._fillTransparency;
    retVal._netFillTransparency = this._netFillTransparency;
    retVal._geometryClass = this._geometryClass;
    retVal._styleInfo = this._styleInfo ? this._styleInfo.clone() : undefined;
    retVal._gradient = this._gradient ? this._gradient.clone() : undefined;
    retVal._pattern = this._pattern ? this._pattern.clone() : undefined;
    return retVal;
  }

  /**
   *  Like createDefaults... but preserves category and sub-category around the call to create. Is particularly useful when a single element
   *  draws objects of different symbology, but its draw code does not have easy access to reset the category
   */
  public resetAppearance() {
    this._colorOverride = false;
    this._weightOverride = false;
    this._styleOverride = false;
    this._materialOverride = false;
    this._fillOverride = false;
    this._resolved = false;
    this._materialId = undefined;
    this._elmPriority = 0;
    this._netPriority = 0;
    this._weight = 0;
    this._lineColor = undefined;
    this._fillColor = undefined;
    this._backgroundFill = BackgroundFill.None;
    this._fillDisplay = DgnFB.FillDisplay.None;
    this._elmTransparency = 0;
    this._netElmTransparency = 0;
    this._fillTransparency = 0;
    this._netFillTransparency = 0;
    this._geometryClass = DgnFB.GeometryClass.Primary;
    this._styleInfo = undefined;
    this._gradient = undefined;
    this._pattern = undefined;
  }

  /** Resolve effective values using the supplied imodel and optional Viewport (for view bg fill and view sub-category overrides)... */
  public resolve(appearance: Appearance) {
    if (this._resolved)
      return;

    if (!this._colorOverride)
      this._lineColor = new ColorDef(appearance.color);
    if (!this._fillOverride)
      this._fillColor = new ColorDef(appearance.color);
    else if (this._backgroundFill !== BackgroundFill.None)
      this._fillColor = new ColorDef(ColorRgb.black);

    if (!this._weightOverride)
      this._weight = appearance.weight;
    if (!this._styleOverride)
      this._styleInfo = LineStyleInfo.create(Id64.fromJSON(appearance.styleId), undefined);  // No LineStyleParams held in appearance
    if (!this._materialOverride)
      this._materialId = Id64.fromJSON(appearance.materialId);

    // SubCategory transparency is combined with element transparency to compute net transparency
    if (appearance.transparency !== 0.0) {
      // combine transparencies by multiplying the opaqueness.
      // A 50% transparent element on a 50% transparent category should give a 75% transparent result.
      // (1 - ((1 - .5) * (1 - .5))
      const elementOpaque = 1.0 - (this._elmTransparency ? this._elmTransparency : 0);
      const fillOpaque = 1.0 - (this._fillTransparency ? this._fillTransparency : 0);
      const categoryOpaque = 1.0 - appearance.transparency;

      this._netElmTransparency = (1.0 - (elementOpaque * categoryOpaque));
      this._netFillTransparency = (1.0 - (fillOpaque * categoryOpaque));
    }

    // SubCategory display priority is combined with element priority to compute net display priority
    this._netPriority = (this._elmPriority ? this._elmPriority : 0) + appearance.priority;
    /*
    if (this._styleInfo && this._styleInfo.lStyleSymb.lStyle !== undefined)
      this._styleInfo.resolve();
    */
    this._resolved = true;
  }

  // public resolve(ViewContext)

  // Getter methods (there is a layer of checks for whether this object has been resolved, or that an override is set) -----------------
  public get isResolved() { return this._resolved; }
  public get netTransparency(): number | undefined {
    if (!this._resolved)
      return undefined;
    return this._netElmTransparency;
  }
  public get netFillTransparency(): number | undefined {
    if (!this._resolved)
      return undefined;
    return this._netFillTransparency;
  }
  /** Get net display priority (2d only) */
  public get netDisplayPriority() { return this._netPriority; }
  public get categoryId() { return this._categoryId; }
  public get subCategoryId() { return this._subCategoryId; }
  public get lineColor(): ColorDef | undefined {
    if (!(this._colorOverride || this._resolved))
      return undefined;
    return this._lineColor;
  }
  public get fillColor(): ColorDef | undefined {
    if (!((this._fillOverride && this._backgroundFill === BackgroundFill.None) || this._resolved))
      return undefined;
    return this._fillColor;
  }
  public get fillDisplay() { return this._fillDisplay; }
  public get gradient() { return this._gradient; }
  public get patternParams() { return this._pattern; }
  public get geometryClass() { return this._geometryClass; }
  public get lineStyle(): LineStyleInfo | undefined {
    if (!(this._styleOverride || this._resolved))
      return undefined;
    return this._styleInfo;
  }
  public get weight(): number | undefined {
    if (!(this._weightOverride || this._resolved))
      return undefined;
    return this._weight;
  }
  public get transparency() { return this._elmTransparency; }
  public get fillTransparency() { return this._fillTransparency; }
  public get materialId(): Id64 | undefined {
    if (!(this._materialOverride || this._resolved))
      return undefined;
    return this._materialId;
  }
  public get displayPriority() { return this._elmPriority; }

  // Setter methods
  public setCategoryId(categoryId: Id64, clearAppearanceOverrides: boolean = true) {
    this._categoryId = categoryId;
    const high = categoryId.getHigh();
    const low = categoryId.getLow() + 1;
    this._subCategoryId = new Id64([low, high]);
    if (clearAppearanceOverrides) {
      this._colorOverride = false;
      this._fillOverride = false;
      this._materialOverride = false;
      this._styleOverride = false;
      this._weightOverride = false;
    }
    this._resolved = false;
  }
  public setSubCategoryId(subCategoryId: Id64, clearAppearanceOverrides: boolean = true) {
    this._subCategoryId = subCategoryId;
    if (clearAppearanceOverrides) {
      this._colorOverride = false;
      this._fillOverride = false;
      this._materialOverride = false;
      this._styleOverride = false;
      this._weightOverride = false;
    }
    this._resolved = false;
  }
  public setWeight(weight: number) {
    this._weightOverride = true;
    this._weight = weight;
  }
  public setLineStyle(styleInfo: LineStyleInfo | undefined) {
    this._styleOverride = true;
    this._styleInfo = styleInfo;
    if (styleInfo)
      this._resolved = false;
  }
  public setLineColor(color: ColorDef) {
    this._colorOverride = true;
    this._lineColor = color;
  }
  public setFillDisplay(display: DgnFB.FillDisplay) { this._fillDisplay = display; }
  public setFillTransparency(transparency: number) { this._fillTransparency = this._netElmTransparency = transparency; this._resolved = false; }
  public setFillColor(color: ColorDef) {
    this._fillOverride = true;
    this._fillColor = color;
    this._backgroundFill = BackgroundFill.None;
  }
  public setFillColorFromViewBackground(outline: boolean = false) {
    this._fillOverride = true;
    this._backgroundFill = outline ? BackgroundFill.Outline : BackgroundFill.Solid;
    this._resolved = false;
  }
  public setGradient(gradient: GradientSymb | undefined) { this._gradient = gradient; }
  public setGeometryClass(geomClass: DgnFB.GeometryClass) { this._geometryClass = geomClass; }
  public setTransparency(transparency: number) {    // Sets BOTH element and fill transparency...
    this._elmTransparency = this._netElmTransparency = this._fillTransparency = this._netFillTransparency = transparency;
    this._resolved = false;
  }
  /** Set display priority (2d only) */
  public setDisplayPriority(priority: number) {
    this._elmPriority = this._netPriority = priority;
    this._resolved = false;
  }
  public setMaterialId(materialId: Id64) {
    this._materialOverride = true;
    this._materialId = materialId;
  }
  public setPatternParams(patternParams: PatternParams | undefined) { this._pattern = patternParams; }
  /** RASTER USE ONLY */
  public setNetDisplayPriority(priority: number) { this._netPriority = priority; }
  public setLineColorToSubCategoryAppearance() { this._resolved = this._colorOverride = false; }
  public setWeightToSubCategoryAppearance() { this._resolved = this._weightOverride = false; }
  public setLineStyleToSubCategoryAppearance() { this._resolved = this._styleOverride = false; }
  public setMaterialToSubCategoryAppearance() { this._resolved = this._materialOverride = false; }
  public setFillColorToSubCategoryAppearance() { this._resolved = this._fillOverride = false; }
  public isLineColorFromSubCategoryAppearance(): boolean { return !this._colorOverride; }
  public isWeightFromSubCategoryAppearance(): boolean { return !this._weightOverride; }
  public isLineStyleFromSubCategoryAppearance(): boolean { return !this._styleOverride; }
  public isMaterialFromSubCategoryAppearance(): boolean { return !this._materialOverride; }
  public isFillColorFromSubCategoryAppearance(): boolean { return !this._fillOverride; }
  public isFillColorFromViewBackground(): boolean { return this._backgroundFill !== BackgroundFill.None; }
  public isBackgroundFillOfTypeOutline(): boolean { return this._backgroundFill === BackgroundFill.Outline; }
  public hasStrokedLineStyle(): boolean | undefined {
    if (!(this._styleOverride || this._resolved))
      return undefined;
    return this._styleInfo ? (this._styleInfo.lStyleSymb.lStyle !== undefined && this._styleInfo.lStyleSymb.useStroker) : false;
  }
  public isTransformable() { return (this._pattern !== undefined) || (this._styleInfo !== undefined); }
  public applyTransform(transform: Transform, options: number = 0) {
    if (this._pattern !== undefined)
      this._pattern.applyTransform(transform);
    if (this._styleInfo !== undefined)
      this._styleInfo.styleParams.applyTransform(transform, options);
  }

  public isEqualTo(other: GeometryParams): boolean {
    if (this === other)
      return true;    // Same pointer
    if (!this._categoryId.equals(other._categoryId))
      return false;
    if (!this._subCategoryId.equals(other._subCategoryId))
      return false;
    if (this._geometryClass !== other._geometryClass)
      return false;
    if (this._elmPriority !== other._elmPriority)
      return false;
    if (this._elmTransparency !== other._elmTransparency)
      return false;
    if (this._colorOverride !== other._colorOverride)
      return false;
    if (this._colorOverride && (!this._lineColor!.equals(other._lineColor!)))
      return false;
    if (this._weightOverride !== other._weightOverride)
      return false;
    if (this._weightOverride && (this._weight !== other._weight))
      return false;
    if (this._materialOverride !== other._materialOverride)
      return false;
    if (this._materialOverride && (!this._materialId!.equals(other._materialId!)))
      return false;
    if (this._styleOverride !== other._styleOverride)
      return false;
    if (this._styleOverride) {
      if ((this._styleInfo === undefined) !== (other._styleInfo === undefined))
        return false;
      if (this._styleInfo) {
        if (!this._styleInfo.styleId.equals(other._styleInfo!.styleId))
          return false;
        if (!this._styleInfo.lStyleSymb.isEqualTo(other._styleInfo!.lStyleSymb))
          return false;
      }
    }
    if (this._fillDisplay !== other._fillDisplay)
      return false;
    if (this._fillDisplay !== DgnFB.FillDisplay.None) {
      if (this._fillOverride !== other._fillOverride)
        return false;
      if (this._fillOverride) {
        if ((this._gradient === undefined) !== (other._gradient === undefined))
          return false;
        if (this._gradient && !this._gradient.isEqualTo(other._gradient!))
          return false;
        if (this._backgroundFill !== other._backgroundFill)
          return false;
        if (this._backgroundFill !== BackgroundFill.None && !this._fillColor!.equals(other.fillColor!))
          return false;
      }
    }
    if ((this._pattern === undefined) !== (other._pattern === undefined))
      return false;
    if (this._pattern && !this._pattern.isEqualTo(other._pattern!))
      return false;

    return true;
  }
}
