/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { compareNumbers } from "@itwin/core-bentley";
import { ColorDef } from "./ColorDef";

/** JSON representation of an [[RgbColor]], with each component an integer in the range [0, 255].
 * @public
 * @extensions
 */
export interface RgbColorProps {
  r: number;
  g: number;
  b: number;
}

/** An immutable representation of a color with red, green, and blue components each in the integer range [0, 255].
 * @public
 */
export class RgbColor {
  /** Constructs from red, green, and blue components.
   * @param r Red
   * @param g Green
   * @param b Blue
   */
  public constructor(public readonly r: number, public readonly g: number, public readonly b: number) {
    this.r = Math.max(0, Math.min(this.r, 0xff));
    this.g = Math.max(0, Math.min(this.g, 0xff));
    this.b = Math.max(0, Math.min(this.b, 0xff));
  }

  /** Constructs from the red, green, and blue components of a ColorDef. The transparency component is ignored. */
  public static fromColorDef(colorDef: ColorDef): RgbColor {
    const colors = colorDef.colors;
    return new RgbColor(colors.r, colors.g, colors.b);
  }

  /** Converts this RgbColor to a ColorDef.
   * @param transparency Value to use for the transparency component of the ColorDef.
   * @param out If defined, this ColorDef will be modified in-place and returned; otherwise a new ColorDef will be allocated.
   * @returns A ColorDef with RGB components equivalent to those of this RgbColor and transparency component as specified.
   */
  public toColorDef(transparency = 0): ColorDef {
    return ColorDef.from(this.r, this.g, this.b, transparency);
  }

  /** Convert this color to its JSON representation. */
  public toJSON(): RgbColorProps {
    return { r: this.r, g: this.g, b: this.b };
  }

  /** Create an RgbColor from its JSON representation.
   * If `json` is `undefined`, the result is pure white.
   */
  public static fromJSON(json: RgbColorProps | undefined): RgbColor {
    let r = 0xff;
    let g = 0xff;
    let b = 0xff;
    if (undefined !== json) {
      if (typeof json.r === "number")
        r = json.r;
      if (typeof json.g === "number")
        g = json.g;
      if (typeof json.b === "number")
        b = json.b;
    }

    return new RgbColor(r, g, b);
  }

  /** Returns true if this color's red, green, and blue components are identical to those of `other`. */
  public equals(other: RgbColor): boolean {
    return this.r === other.r && this.g === other.g && this.b === other.b;
  }

  /** Compare this color to another color using the rules of an [OrderedComparator]($bentley). */
  public compareTo(other: RgbColor): number {
    return compareNumbers(this.r, other.r) || compareNumbers(this.g, other.g) || compareNumbers(this.b, other.b);
  }

  /** Convert this color to a string in the form "#rrggbb" where the values are the hex digits of the respective color components. */
  public toHexString(): string {
    return this.toColorDef().toHexString();
  }
}
