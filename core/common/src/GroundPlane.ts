/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils, NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { ColorByName } from "./ColorByName";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { Gradient } from "./Gradient";

/** JSON representation of a [[GroundPlane]].
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

export type GroundPlaneProperties = NonFunctionPropertiesOf<GroundPlane>;

const defaultAboveColor = ColorDef.fromTbgr(ColorByName.darkGreen);
const defaultBelowColor = ColorDef.fromTbgr(ColorByName.darkBrown);

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents, used to represent the ground as a reference point within a spatial view.
 * @public
 */
export class GroundPlane {
  public readonly elevation: number;
  public readonly aboveColor: ColorDef;
  public readonly belowColor: ColorDef;

  protected constructor(props: Partial<GroundPlaneProperties>) {
    this.elevation = props.elevation ?? -0.01;
    this.aboveColor = props.aboveColor ?? defaultAboveColor;
    this.belowColor = props.belowColor ?? defaultBelowColor;
  }

  public static readonly defaults = new GroundPlane({ });

  public static create(props?: GroundPlaneProperties) {
    return props ? new this(props) : this.defaults;
  }

  public static fromJSON(props?: GroundPlaneProps): GroundPlane {
    if (!props)
      return this.defaults;

    return new this({
      elevation: props.elevation,
      aboveColor: undefined !== props.aboveColor ? ColorDef.fromJSON(props.aboveColor) : undefined,
      belowColor: undefined !== props.belowColor ? ColorDef.fromJSON(props.belowColor) : undefined,
    });
  }

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
