/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import type { Id64String } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import type { ColorDef } from "./ColorDef";
import type { AreaPattern } from "./geometry/AreaPattern";
import type { LineStyle } from "./geometry/LineStyle";
import type { Gradient } from "./Gradient";
import { IModel } from "./IModel";

/** Whether a closed region should be drawn for wireframe display with its internal area filled or not.
 * @public
 */
export enum FillDisplay {
  /** don't fill, even if fill attribute is on for the viewport */
  Never = 0,
  /** fill if the fill attribute is on for the viewport */
  ByView = 1,
  /** always fill, even if the fill attribute is off for the viewport */
  Always = 2,
  /** always fill, fill will always be behind other geometry */
  Blanking = 3,
}

/** Describes how a view's background color affects the interior area of a closed region.
 * @public
 */
export enum BackgroundFill {
  /** single color fill uses the fill color and line color to draw either a solid or outline fill */
  None = 0,
  /** single color fill uses the view's background color to draw a solid fill */
  Solid = 1,
  /** single color fill uses the view's background color and line color to draw an outline fill */
  Outline = 2,
}

/** Categorizes a piece of geometry within a GeometryStream. Visibility of classes of geometry can be toggled
 * within a view using [[ViewFlags]].
 * @see [[GeometryStreamProps]].
 * @see [[Feature]].
 * @public
 */
export enum GeometryClass {
  /** Used to classify the "real" geometry within a model. Most geometry falls within this class. */
  Primary = 0,
  /** Used to classify geometry used as a drawing aid in constructing the Primary geometry. For example, grid lines. */
  Construction = 1,
  /** Used to classify annotations which dimension (measure) the Primary geometry. */
  Dimension = 2,
  /** Used to classify geometry used to fill planar regions with a 2d pattern (e.g., hatch lines). */
  Pattern = 3,
}

/** Describes the display properties of graphics in a persistent element's GeometryStream that aren't inherited from [[SubCategoryAppearance]].
 * @see [[GeometryStreamProps]].
 * @public
 */
export class GeometryParams {
  /** Optional render material to override [[SubCategoryAppearance.materialId]].
   * Specify an invalid [[Id64]] to override [[SubCategoryAppearance.materialId]] with no material.
   */
  public materialId?: Id64String;
  /** Optional display priority added to [[SubCategoryAppearance.priority]].
   * The net display priority value is used to control z ordering when drawing to 2d views.
   */
  public elmPriority?: number;
  /** Optional line weight to override [[SubCategoryAppearance.weight]].
   * The weight is an integer in the range of [0,31] that by default corresponds to a pixel width of weight+1.
   */
  public weight?: number;
  /** Optional line color to override [[SubCategoryAppearance.color]].
   * The transparency component is ignored and should instead be specified using [[elmTransparency]].
   */
  public lineColor?: ColorDef;
  /** Optional fill color for region interiors. Set the same as [[lineColor]] for an opaque fill.
   * Valid when [[fillDisplay]] is not [[FillDisplay.Never]], [[gradient]] is undefined, and [[backgroundFill]] is [[BackgroundFill.None]].
   * The transparency component is ignored and should instead be specified using [[fillTransparency]].
   */
  public fillColor?: ColorDef;
  /** Optional fill using the current view background color for region interiors.
   * Valid when [[fillDisplay]] is not [[FillDisplay.Never]] and [[gradient]] is undefined. Default is [[BackgroundFill.None]].
   */
  public backgroundFill?: BackgroundFill;
  /** Optional fill specification that determines when and if a region interior will display using [[gradient]], [[backgroundFill]], or [[fillColor]] in that order of preference.
   * Fill only applies to [[RenderMode.Wireframe]] views. In a [[RenderMode.SmoothShade]] or [[RenderMode.SolidFill]] view, regions will always display as surfaces preferring [[fillColor]] when present over [[lineColor]].
   * Default is [[FillDisplay.Never]].
   */
  public fillDisplay?: FillDisplay;
  /** Optional line color transparency to combine with [[SubCategoryAppearance.transparency]].
   * Transparency values are combined by multiplying the opaqueness. A 50% transparent element on a 50% transparent sub-category creates a 75% transparent result (1 - ((1 - .5) * (1 - .5)) = 0.75).
   * Value range is [0.0,1.0]. Pass 0.0 for completely opaque and 1.0 for completely transparent.
   */
  public elmTransparency?: number;
  /** Optional fill color transparency to combine with [[SubCategoryAppearance.transparency]].
   * Transparency values are combined by multiplying the opaqueness. A 50% transparent fill on a 50% transparent sub-category creates a 75% transparent result (1 - ((1 - .5) * (1 - .5)) = 0.75).
   * Value range is [0.0,1.0]. Pass 0.0 for completely opaque, 1.0 for completely transparent, or leave undefined to use [[elmTransparency]].
   */
  public fillTransparency?: number;
  /** Optional geometry classification that can be toggled off with a [[ViewFlags]] independent of [[SubCategoryAppearance.invisible]].
   * Default is [[GeometryClass.Primary]].
   */
  public geometryClass?: GeometryClass;
  /** Optional line style to override [[SubCategoryAppearance.styleId]] plus modifiers to override the line style definition.
   * Specify an invalid [[Id64]] to override [[SubCategoryAppearance.styleId]] with a solid line.
   */
  public styleInfo?: LineStyle.Info;
  /** Optional gradient fill settings for region interiors.
   * Valid when [[fillDisplay]] is not [[FillDisplay.Never]].
   */
  public gradient?: Gradient.Symb;
  /** Optional area pattern settings for region interiors.
   * Independent of fill, a region can have both fill and pattern.
   */
  public pattern?: AreaPattern.Params;

  /** Create a GeometryParams given a [[Category]] Id for a [[GeometricElement]] and optional [[SubCategory]] Id. The [[SubCategory.appearance]] establishes the non-overriden display properties of
   * graphics in a GeometricElement's [[GeometryStreamProps]]. A GeometricElement refers to a single Category through [[GeometricElement.category]], while it's graphics can appear on multiple SubCategories
   * by adding a [[GeometryAppearanceProps]] with a SubCategory change to the GeometryStream.
   * @note If a valid SubCategory Id is not supplied, the default SubCategory for the parent Category is used. To be considered valid, [[SubCategory.getCategoryId]] must refer to the specified Category Id.
   */
  constructor(public categoryId: Id64String, public subCategoryId = Id64.invalid) {
    if (!Id64.isValid(subCategoryId))
      this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId);
  }

  public clone(): GeometryParams {
    const retVal = new GeometryParams(this.categoryId, this.subCategoryId);
    retVal.materialId = this.materialId;
    retVal.elmPriority = this.elmPriority;
    retVal.weight = this.weight;
    retVal.lineColor = this.lineColor;
    retVal.fillColor = this.fillColor;
    retVal.backgroundFill = this.backgroundFill;
    retVal.fillDisplay = this.fillDisplay;
    retVal.elmTransparency = this.elmTransparency;
    retVal.fillTransparency = this.fillTransparency;
    retVal.geometryClass = this.geometryClass;
    retVal.styleInfo = this.styleInfo ? this.styleInfo.clone() : undefined;
    retVal.gradient = this.gradient ? this.gradient.clone() : undefined;
    retVal.pattern = this.pattern ? this.pattern.clone() : undefined;
    return retVal;
  }

  /** Clears [[SubCategoryAppearance]] overrides while preserving [[categoryId]] and [[subCategoryId]]. */
  public resetAppearance() {
    this.materialId = undefined;
    this.elmPriority = undefined;
    this.weight = undefined;
    this.lineColor = undefined;
    this.fillColor = undefined;
    this.backgroundFill = undefined;
    this.fillDisplay = undefined;
    this.elmTransparency = undefined;
    this.fillTransparency = undefined;
    this.geometryClass = undefined;
    this.styleInfo = undefined;
    this.gradient = undefined;
    this.pattern = undefined;
  }

  /** Compare two [[GeometryParams]] for equivalence, i.e. both values are undefined and inherited from [[SubCategoryAppearance]] or have the same override. */
  public isEquivalent(other: GeometryParams): boolean {
    if (this === other)
      return true; // Same pointer

    if (this.categoryId !== other.categoryId)
      return false;
    if (this.subCategoryId !== other.subCategoryId)
      return false;
    if (this.geometryClass !== other.geometryClass)
      return false;

    if (this.elmPriority !== other.elmPriority)
      return false;
    if (this.elmTransparency !== other.elmTransparency)
      return false;
    if (this.fillTransparency !== other.fillTransparency)
      return false;

    if ((this.lineColor === undefined) !== (other.lineColor === undefined))
      return false;
    if (this.lineColor && !this.lineColor.equals(other.lineColor!))
      return false;

    if (this.weight !== other.weight)
      return false;

    if ((this.materialId === undefined) !== (other.materialId === undefined))
      return false;
    if (this.materialId && this.materialId !== other.materialId!)
      return false;

    if ((this.styleInfo === undefined) !== (other.styleInfo === undefined))
      return false;
    if (this.styleInfo && !this.styleInfo.equals(other.styleInfo!))
      return false;

    if (this.fillDisplay !== other.fillDisplay)
      return false;

    if (this.fillDisplay !== undefined && this.fillDisplay !== FillDisplay.Never) {
      if ((this.gradient === undefined) !== (other.gradient === undefined))
        return false;
      if (this.gradient && !this.gradient.equals(other.gradient!))
        return false;
      if (this.backgroundFill !== other.backgroundFill)
        return false;
      if (this.backgroundFill === undefined || this.backgroundFill === BackgroundFill.None) {
        if ((this.fillColor === undefined) !== (other.fillColor === undefined))
          return false;
        if (this.fillColor && !this.fillColor.equals(other.fillColor!))
          return false;
      }
    }

    if ((this.pattern === undefined) !== (other.pattern === undefined))
      return false;
    if (this.pattern && !this.pattern.equals(other.pattern!))
      return false;

    return true;
  }

  /** Change [[categoryId]] to the supplied id, [[subCategoryId]] to the supplied category's the default subCategory, and optionally clear any [[SubCategoryAppearance]] overrides. */
  public setCategoryId(categoryId: Id64String, clearAppearanceOverrides = true) {
    this.categoryId = categoryId;
    this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId);
    if (clearAppearanceOverrides)
      this.resetAppearance();
  }

  /** Change [[subCategoryId]] to the supplied id and optionally clear any [[SubCategoryAppearance]] overrides. */
  public setSubCategoryId(subCategoryId: Id64String, clearAppearanceOverrides = true) {
    this.subCategoryId = subCategoryId;
    if (clearAppearanceOverrides)
      this.resetAppearance();
  }
}
