/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { ColorDef, ColorDefProps } from "./ColorDef";

/** Parameters that define the way geometry on a [[SubCategory]] appears.
 * SubCategoryAppearance describes the intrinstic appearance of geometry belonging to that SubCategory, independent of a particular [[ViewState]].
 * Aspects of a SubCategory's appearance can be overridden in the context of a particular [[ViewState]] through the use of [[SubCategoryOverride]s.
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
   * @note This property has no effect in 3D views.
   */
  public readonly priority: number;
  /** A value in the range [0, 1] indicating the transparency of the geometry where 0.0 means "fully opaque" and 1.0 means "fully transparent". */
  public readonly transparency: number;
  /** If true, geometry belonging to this SubCategory is not drawn. */
  public readonly invisible: boolean;
  /** @hidden */
  public readonly dontPlot: boolean;
  /** @hidden */
  public readonly dontSnap: boolean;
  /** @hidden */
  public readonly dontLocate: boolean;
  /** The element ID of the line style used to draw curves, or an invalid ID if no line style is specified. */
  public readonly styleId: Id64;
  /** The element ID of the material applied to surfaces, or an invalid ID if no material is specified. */
  public readonly materialId: Id64;

  constructor(props?: SubCategoryAppearance.Props) {
    if (!props) {
      this.color = ColorDef.black;
      this.weight = 0;
      this.priority = 0;
      this.transparency = 0;
      this.invisible = this.dontPlot = this.dontSnap = this.dontLocate = false;
      this.styleId = new Id64();
      this.materialId = new Id64();
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
    this.transparency = JsonUtils.asInt(props.transp);
  }

  public equals(other: SubCategoryAppearance): boolean {
    return this.invisible === other.invisible &&
      this.dontPlot === other.dontPlot &&
      this.dontSnap === other.dontSnap &&
      this.dontLocate === other.dontLocate &&
      this.color.equals(other.color) &&
      this.weight === other.weight &&
      this.priority === other.priority &&
      this.styleId.equals(other.styleId) &&
      this.materialId.equals(other.materialId) &&
      this.transparency === other.transparency;
  }

  public toJSON(): SubCategoryAppearance.Props {
    const val = { color: this.color.toJSON() } as SubCategoryAppearance.Props;
    if (this.invisible) val.invisible = true;
    if (this.dontPlot) val.dontPlot = true;
    if (this.dontSnap) val.dontSnap = true;
    if (this.dontLocate) val.dontLocate = true;
    if (0 !== this.weight) val.weight = this.weight;
    if (this.styleId.isValid) val.style = this.styleId;
    if (0 !== this.priority) val.priority = this.priority;
    if (this.materialId.isValid) val.material = this.materialId;
    if (0.0 !== this.transparency) val.transp = this.transparency;
    return val;
  }

  public clone(): SubCategoryAppearance { return new SubCategoryAppearance(this.toJSON()); }

  public static defaults = new SubCategoryAppearance();
}

export namespace SubCategoryAppearance {
  /** Properties used to create a SubCategoryAppearance
   * @see [[SubCategoryAppearance]]
   */
  export interface Props {
    /** @see [[SubCategoryAppearance.color]]. Defaults to black. */
    color?: ColorDefProps;
    /** @see [[SubCategoryAppearance.invisible]]. Defaults to false. */
    invisible?: boolean;
    /** @hidden */
    dontPlot?: boolean;
    /** @hidden */
    dontSnap?: boolean;
    /** @hidden */
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
  }
}

/** Overrides selected aspects of a [[SubCategoryAppearance]] in the context of a [[ViewState]].
 * When determining how geometry belonging to a [[SubCategory]] will appear when drawn within a view:
 *  1. The base [[SubCategoryAppearance]] associated with that subcategory is obtained.
 *  2. The [[SubCategoryOverride]] associated with that subcategory in the [[ViewState]] is obtained.
 *  3. Any aspects of the appearance overridden by the SubCategoryOverride are replaced with the values from the SubCategoryOverride.
 * An aspect is overridden by virtue of not being set to "undefined" in the SubCategoryOverride.
 * @see [[ViewState.overrideSubCategory]]
 */
export class SubCategoryOverride {
  /** @see [[SubCategoryAppearance.color]] */
  public readonly color?: ColorDef;
  /** @see [[SubCategoryAppearance.invisible]] */
  public readonly invisible?: boolean;
  /** @see [[SubCategoryAppearance.weight]] */
  public readonly weight?: number;
  /** @hidden Overriding with arbitrary custom line style is not supported - overriding with LinePixels enum could be. */
  public readonly style?: Id64;
  /** @see [[SubCategoryAppearance.priority]] */
  public readonly priority?: number;
  /** @see [[SubCategoryAppearance.materialId]] */
  public readonly material?: Id64;
  /** @see [[SubCategoryAppearance.transparency]] */
  public readonly transparency?: number;

  /** Returns true if any aspect of the appearance is overridden (i.e., if any member is not undefined). */
  public get anyOverridden(): boolean {
    return undefined !== this.invisible || undefined !== this.color || undefined !== this.weight || undefined !== this.style || undefined !== this.priority || undefined !== this.material || undefined !== this.transparency;
  }

  /** Returns a SubCategoryAppearance overridden to match the properties defined by this SubCategoryOverride. */
  public override(appearance: SubCategoryAppearance): SubCategoryAppearance {
    if (!this.anyOverridden)
      return appearance;

    const props = appearance.toJSON();
    const ovrProps = this.toJSON();
    if (undefined !== ovrProps.invisible) props.invisible = ovrProps.invisible;
    if (undefined !== ovrProps.weight) props.weight = ovrProps.weight;
    if (undefined !== ovrProps.style) props.style = ovrProps.style;
    if (undefined !== ovrProps.material) props.material = ovrProps.material;
    if (undefined !== ovrProps.priority) props.priority = ovrProps.priority;
    if (undefined !== ovrProps.transp) props.transp = ovrProps.transp;
    if (undefined !== ovrProps.color) props.color = ovrProps.color;

    return new SubCategoryAppearance(props);
  }

  /** Convert this SubCategoryOverride to a JSON object */
  public toJSON(): SubCategoryAppearance.Props {
    const val: SubCategoryAppearance.Props = {
      invisible: this.invisible,
      weight: this.weight,
      style: this.style,
      material: this.material,
      priority: this.priority,
      transp: this.transparency,
    };

    if (undefined !== this.color)
      val.color = this.color.toJSON();

    return val;
  }

  /** Create a new SubCategoryOverride from a JSON object */
  public static fromJSON(json?: SubCategoryAppearance.Props): SubCategoryOverride {
    return undefined !== json ? new SubCategoryOverride(json) : this.defaults;
  }

  private constructor(props: SubCategoryAppearance.Props) {
    if (undefined !== props.invisible) this.invisible = JsonUtils.asBool(props.invisible);
    if (undefined !== props.color) this.color = ColorDef.fromJSON(props.color);
    if (undefined !== props.weight) this.weight = JsonUtils.asInt(props.weight);
    if (undefined !== props.style) this.style = Id64.fromJSON(props.style);
    if (undefined !== props.material) this.material = Id64.fromJSON(props.material);
    if (undefined !== props.priority) this.priority = JsonUtils.asInt(props.priority);
    if (undefined !== props.transp) this.transparency = JsonUtils.asDouble(props.transp);
  }

  /** A default SubCategoryOverride which overrides nothing. */
  public static defaults = new SubCategoryOverride({});
}

/** The *rank* for a Category */
export const enum Rank {
  /** This category is predefined by the system */
  System = 0,
  /** This category is defined by a schema. Elements in this category are not recognized by system classes. */
  Domain = 1,
  /** This category is defined by an application. Elements in this category are not recognized by system and schema classes. */
  Application = 2,
  /** This category is defined by a user. Elements in this category are not recognized by system, schema, and application classes. */
  User = 3,
}
