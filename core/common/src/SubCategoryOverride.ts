/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { ColorDef } from "./ColorDef";
import { SubCategoryAppearance } from "./SubCategoryAppearance";

/** Overrides selected aspects of a [[SubCategoryAppearance]] in the context of a [[DisplayStyleState]].
 * When determining how geometry belonging to a [[SubCategory]] will appear when drawn within a view:
 *  1. The base [[SubCategoryAppearance]] associated with that subcategory is obtained.
 *  2. The [[SubCategoryOverride]] associated with that subcategory in the [[DisplayStyleState]] is obtained.
 *  3. Any aspects of the appearance overridden by the SubCategoryOverride are replaced with the values from the SubCategoryOverride.
 * An aspect is overridden by virtue of not being set to "undefined" in the SubCategoryOverride.
 * @see [[DisplayStyleState.overrideSubCategory]]
 * @public
 */
export class SubCategoryOverride {
  /** @see [[SubCategoryAppearance.color]] */
  public readonly color?: ColorDef;
  /** @see [[SubCategoryAppearance.invisible]] */
  public readonly invisible?: boolean;
  /** @see [[SubCategoryAppearance.weight]] */
  public readonly weight?: number;
  /** @internal Overriding with arbitrary custom line style is not supported - overriding with LinePixels enum could be. */
  public readonly style?: Id64String;
  /** @see [[SubCategoryAppearance.priority]] */
  public readonly priority?: number;
  /** @see [[SubCategoryAppearance.materialId]] */
  public readonly material?: Id64String;
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

  /** Convert this SubCategoryOverride to a JSON object
   * @internal
   */
  public toJSON(): SubCategoryAppearance.Props {
    const props: SubCategoryAppearance.Props = { };
    if (undefined !== this.invisible)
      props.invisible = this.invisible;

    if (undefined !== this.weight)
      props.weight = this.weight;

    if (undefined !== this.style)
      props.style = this.style;

    if (undefined !== this.material)
      props.material = this.material;

    if (undefined !== this.priority)
      props.priority = this.priority;

    if (undefined !== this.transparency)
      props.transp = this.transparency;

    if (undefined !== this.color)
      props.color = this.color.toJSON();

    return props;
  }

  /** Perform equality comparison against another SubCategoryOverride. */
  public equals(other: SubCategoryOverride): boolean {
    if (this.invisible !== other.invisible || this.weight !== other.weight || this.style !== other.style
      || this.priority !== other.priority || this.material !== other.material || this.transparency !== other.transparency)
      return false;

    if (undefined !== this.color && undefined !== other.color)
      return this.color.tbgr === other.color.tbgr;
    else
      return undefined === this.color && undefined === other.color;
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
