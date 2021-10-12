/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils } from "@itwin/core-bentley";
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

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents, used to represent the ground as a reference point within a spatial view.
 * @public
 */
export class GroundPlane {
  /** Whether the ground plane should be displayed. */
  public display: boolean = false;
  /** The Z height at which to draw the plane. */
  public elevation: number = 0.0;
  /** The color in which to draw the ground plane when viewed from above. */
  public aboveColor: ColorDef;
  /** The color in which to draw the ground plane when viewed from below. */
  public belowColor: ColorDef;
  private _aboveSymb?: Gradient.Symb;
  private _belowSymb?: Gradient.Symb;

  public constructor(ground?: GroundPlaneProps) {
    ground = ground ? ground : {};
    this.display = JsonUtils.asBool(ground.display, false);
    this.elevation = JsonUtils.asDouble(ground.elevation, -.01);
    this.aboveColor = (undefined !== ground.aboveColor) ? ColorDef.fromJSON(ground.aboveColor) : ColorDef.fromTbgr(ColorByName.darkGreen);
    this.belowColor = (undefined !== ground.belowColor) ? ColorDef.fromJSON(ground.belowColor) : ColorDef.fromTbgr(ColorByName.darkBrown);
  }

  public toJSON(): GroundPlaneProps {
    return {
      display: this.display,
      elevation: this.elevation,
      aboveColor: this.aboveColor.toJSON(),
      belowColor: this.belowColor.toJSON(),
    };
  }

  /** Returns and locally stores gradient symbology for the ground plane texture depending on whether we are looking from above or below.
   * Will store the ground colors used in the optional ColorDef array provided.
   * @internal
   */
  public getGroundPlaneGradient(aboveGround: boolean): Gradient.Symb {
    let gradient = aboveGround ? this._aboveSymb : this._belowSymb;
    if (undefined !== gradient)
      return gradient;

    const values = [0, .25, .5];   // gradient goes from edge of rectangle (0.0) to center (1.0)...
    const color = aboveGround ? this.aboveColor : this.belowColor;
    const alpha = aboveGround ? 0x80 : 0x85;
    const groundColors = [color.withTransparency(0xff), color, color];
    groundColors[1] = groundColors[2] = color.withTransparency(alpha);

    // Get the possibly cached gradient from the system, specific to whether or not we want ground from above or below.
    gradient = new Gradient.Symb();
    gradient.mode = Gradient.Mode.Spherical;
    gradient.keys = [{ color: groundColors[0], value: values[0] }, { color: groundColors[1], value: values[1] }, { color: groundColors[2], value: values[2] }];

    // Store the gradient for possible future use
    if (aboveGround)
      this._aboveSymb = gradient;
    else
      this._belowSymb = gradient;

    return gradient;
  }
}
