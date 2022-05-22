/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { Id64, Id64String, JsonUtils } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "./ColorDef";

/** Parameters that define the way geometry on a [[SubCategory]] appears.
 * SubCategoryAppearance describes the intrinsic appearance of geometry belonging to that SubCategory, independent of a particular [[ViewState]].
 * Aspects of a SubCategory's appearance can be overridden in the context of a particular [[ViewState]] through the use of [[SubCategoryOverride]]s.
 * @public
 */
export class SubCategoryAppearance {
  /** The color of the geometry.
   * @note The transparency component of the color is ignored.
   * @see [[SubCategoryAppearance.transparency]].
   */
  public readonly color: ColorDef;
  /** The line width, in pixels.
   * @note The renderer will clamp values to the integer range [1, 32].
   */
  public readonly weight: number;
  /** The display priority used to control which geometry draws in front of other geometry within a 2D view.
   * The priority is a number in the range [-8388576,8388576].
   * Where two pieces of geometry overlap, the one with the larger priority value draws on top of the one with the smaller priority.
   * If they have equal priorities, the order in which they draw is undefined, and z-fighting may result.
   * @note This property has no effect in 3D views unless [[PlanProjectionSettings]] are in effect.
   */
  public readonly priority: number;
  /** A value in the range [0, 1] indicating the transparency of the geometry where 0.0 means "fully opaque" and 1.0 means "fully transparent". */
  public readonly transparency: number;
  /** If true, geometry belonging to this SubCategory is not drawn. */
  public readonly invisible: boolean;
  /** @internal */
  public readonly dontPlot: boolean;
  /** @internal */
  public readonly dontSnap: boolean;
  /** @internal */
  public readonly dontLocate: boolean;
  /** The element ID of the line style used to draw curves, or an invalid ID if no line style is specified. */
  public readonly styleId: Id64String;
  /** The element ID of the material applied to surfaces, or an invalid ID if no material is specified. */
  public readonly materialId: Id64String;
  /** @internal */
  protected readonly _fillColor?: ColorDef;
  /** @internal */
  protected readonly _fillTransparency?: number;

  /** The fill color of geometry marked as being filled.
   * @note The transparency component of the fill color is ignored.
   * @see [[SubCategoryAppearance.fillTransparency]].
   */
  public get fillColor(): ColorDef { return (undefined !== this._fillColor ? this._fillColor : this.color); }
  /** A value in the range [0, 1] indicating the fill transparency of the geometry where 0.0 means "fully opaque" and 1.0 means "fully transparent". */
  public get fillTransparency(): number { return (undefined !== this._fillTransparency ? this._fillTransparency : this.transparency); }

  constructor(props?: SubCategoryAppearance.Props) {
    if (!props) {
      this.color = ColorDef.black;
      this.weight = 0;
      this.priority = 0;
      this.transparency = 0;
      this.invisible = this.dontPlot = this.dontSnap = this.dontLocate = false;
      this.styleId = Id64.invalid;
      this.materialId = Id64.invalid;
      return;
    }

    this.invisible = JsonUtils.asBool(props.invisible);
    this.dontSnap = JsonUtils.asBool(props.dontSnap);
    this.dontLocate = JsonUtils.asBool(props.dontLocate);
    this.dontPlot = JsonUtils.asBool(props.dontPlot);
    this.color = ColorDef.fromJSON(props.color);
    this.weight = JsonUtils.asInt(props.weight);
    this.styleId = Id64.fromJSON(props.style);
    this.priority = JsonUtils.asInt(props.priority);
    this.materialId = Id64.fromJSON(props.material);
    this.transparency = JsonUtils.asDouble(props.transp);
    if (props.fill)
      this._fillColor = ColorDef.fromJSON(props.fill);
    if (props.transpFill)
      this._fillTransparency = JsonUtils.asDouble(props.transpFill);
  }

  public equals(other: SubCategoryAppearance): boolean {
    return this.invisible === other.invisible &&
      this.dontPlot === other.dontPlot &&
      this.dontSnap === other.dontSnap &&
      this.dontLocate === other.dontLocate &&
      this.color.equals(other.color) &&
      this.weight === other.weight &&
      this.priority === other.priority &&
      this.styleId === other.styleId &&
      this.materialId === other.materialId &&
      this.transparency === other.transparency &&
      this.fillColor.equals(other.fillColor) &&
      this.fillTransparency === other.fillTransparency;
  }

  /** @internal */
  public toJSON(): SubCategoryAppearance.Props {
    const val: SubCategoryAppearance.Props = { color: this.color.toJSON() };
    if (this.invisible)
      val.invisible = true;

    if (this.dontPlot)
      val.dontPlot = true;

    if (this.dontSnap)
      val.dontSnap = true;

    if (this.dontLocate)
      val.dontLocate = true;

    if (0 !== this.weight)
      val.weight = this.weight;

    if (0 !== this.priority)
      val.priority = this.priority;

    if (Id64.isValid(this.styleId))
      val.style = this.styleId;

    if (Id64.isValid(this.materialId))
      val.material = this.materialId;

    if (0.0 !== this.transparency)
      val.transp = this.transparency;

    if (this._fillColor)
      val.fill = this._fillColor.toJSON();

    if (this._fillTransparency)
      val.transpFill = this._fillTransparency;

    return val;
  }

  public clone(): SubCategoryAppearance { return new SubCategoryAppearance(this.toJSON()); }

  public static defaults = new SubCategoryAppearance();
}

/** @public */
export namespace SubCategoryAppearance { // eslint-disable-line no-redeclare
  /** Properties used to create a SubCategoryAppearance
   * @see [[SubCategoryAppearance]]
   */
  export interface Props {
    /** @see [[SubCategoryAppearance.color]]. Defaults to black. */
    color?: ColorDefProps;
    /** @see [[SubCategoryAppearance.fillColor]]. Defaults to [[SubCategoryAppearance.color]]. */
    fill?: ColorDefProps;
    /** @see [[SubCategoryAppearance.invisible]]. Defaults to false. */
    invisible?: boolean;
    /** @internal */
    dontPlot?: boolean;
    /** @internal */
    dontSnap?: boolean;
    /** @internal */
    dontLocate?: boolean;
    /** @see [[SubCategoryAppearance.weight]]. Defaults to 0. */
    weight?: number;
    /** @see [[SubCategoryAppearance.styleId]]. Defaults to an invalid ID indicating "no line style". */
    style?: Id64String;
    /** @see [[SubCategoryAppearance.priority]]. Defaults to 0. */
    priority?: number;
    /** @see [[SubCategoryAppearance.materialId]]. Defaults to an invalid ID indicating "no material". */
    material?: Id64String;
    /** @see [[SubCategoryAppearance.transparency]]. Defaults to 0. */
    transp?: number;
    /** @see [[SubCategoryAppearance.fillTransparency]]. Defaults to [[SubCategoryAppearance.transparency]]. */
    transpFill?: number;
  }
}
