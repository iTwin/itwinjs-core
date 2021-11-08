/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { ColorByName } from "./ColorByName";
import { ColorDef, ColorDefProps } from "./ColorDef";

/** JSON representation of a [[GroundPlane]].
 * @see [[EnvironmentProps.ground]].
 * @public
 */
export interface GroundPlaneProps {
  /** Whether the ground plane should be displayed. Defaults to false. */
  display?: boolean;
  /** The Z height at which to draw the ground plane. */
  elevation?: number;
  /** The color in which to draw the ground plane when viewed from above. */
  aboveColor?: ColorDefProps;
  /** The color in which to draw the ground plane when viewed from below. */
  belowColor?: ColorDefProps;
}

/** A type containing all of the properties and none of the methods of [[GroundPlane]], with `readonly` modifiers removed.
 * @see [[GroundPlane.create]] and [[GroundPlane.clone]].
 * @public
 */
export type GroundPlaneProperties = NonFunctionPropertiesOf<GroundPlane>;

const defaultAboveColor = ColorDef.fromTbgr(ColorByName.darkGreen);
const defaultBelowColor = ColorDef.fromTbgr(ColorByName.darkBrown);

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents, used to represent the ground as a reference point within a spatial view.
 * @see [[Environment.ground]].
 * @public
 */
export class GroundPlane {
  /** The Z height in meters at which to draw the plane. */
  public readonly elevation: number;
  /** The color in which to draw the ground plane when viewed from above. */
  public readonly aboveColor: ColorDef;
  /** The color in which to draw the ground plane when viewed from below. */
  public readonly belowColor: ColorDef;

  protected constructor(props: Partial<GroundPlaneProperties>) {
    this.elevation = props.elevation ?? -0.01;
    this.aboveColor = props.aboveColor ?? defaultAboveColor;
    this.belowColor = props.belowColor ?? defaultBelowColor;
  }

  /** Default settings with a dark green "above" color, dark brown "below" color, and elevation of -0.01 meters. */
  public static readonly defaults = new GroundPlane({ });

  /** Create a new GroundPlane. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<GroundPlaneProperties>) {
    return props ? new this(props) : this.defaults;
  }

  /** Create a copy of this ground plane, identical except for any properties explicitly specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be initialized to their default values.
   */
  public clone(changedProps?: Partial<GroundPlaneProperties>): GroundPlane {
    if (!changedProps)
      return this;

    return GroundPlane.create({ ...this, ...changedProps });
  }

  /** Create from JSON representation. */
  public static fromJSON(props?: GroundPlaneProps): GroundPlane {
    if (!props)
      return this.defaults;

    return new this({
      elevation: props.elevation,
      aboveColor: undefined !== props.aboveColor ? ColorDef.fromJSON(props.aboveColor) : undefined,
      belowColor: undefined !== props.belowColor ? ColorDef.fromJSON(props.belowColor) : undefined,
    });
  }

  /** Convert to JSON representation.
   * @param display If defined, the value to use for [[GroundPlaneProps.display]]; otherwise, that property will be left undefined.
   */
  public toJSON(display?: boolean): GroundPlaneProps {
    const props: GroundPlaneProps = {
      elevation: this.elevation,
      aboveColor: this.aboveColor.toJSON(),
      belowColor: this.belowColor.toJSON(),
    };

    if (undefined !== display)
      props.display = display;

    return props;
  }
}
