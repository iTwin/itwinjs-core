/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { ColorDef, ColorDefProps } from "./ColorDef";

/** Parameters that define the way geometry on a SubCategory appears. */
export class SubCategoryAppearance {
  public readonly color: ColorDef;
  public readonly weight: number;
  public readonly priority: number;
  public readonly transparency: number;
  public readonly invisible: boolean;
  public readonly dontPlot: boolean;
  public readonly dontSnap: boolean;
  public readonly dontLocate: boolean;
  public readonly styleId: Id64;
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
  /** Properties to create a SubCategoryAppearance */
  export interface Props {
    color?: ColorDefProps;
    invisible?: boolean;
    dontPlot?: boolean;
    dontSnap?: boolean;
    dontLocate?: boolean;
    weight?: number;
    style?: Id64String;
    priority?: number;
    material?: Id64String;
    transp?: number;
  }
}

/** Overrides selected aspects of a SubCategoryAppearance. */
export class SubCategoryOverride {
  public readonly color?: ColorDef;
  public readonly invisible?: boolean;
  public readonly weight?: number;
  public readonly style?: Id64;
  public readonly priority?: number;
  public readonly material?: Id64;
  public readonly transparency?: number;

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
