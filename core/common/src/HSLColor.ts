/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { ColorDef } from "./ColorDef";

/** An immutable color defined by Hue, Saturation, and Lightness.
 * @see [here](https://en.wikipedia.org/wiki/HSL_and_HSV) for difference between HSL and HSV
 * @public
 */
export class HSLColor {
  /** Hue */
  public readonly h: number;
  /** Saturation */
  public readonly s: number;
  /** Lightness */
  public readonly l: number;

  public constructor(hue = 0, saturation = 0, lightness = 0) {
    this.h = hue;
    this.s = saturation;
    this.l = lightness;
  }

  public clone(hue?: number, saturation?: number, lightness?: number): HSLColor {
    return new HSLColor(hue ?? this.h, saturation ?? this.s, lightness ?? this.l);
  }

  public toColorDef(transparency = 0): ColorDef {
    return ColorDef.fromHSL(this.h, this.s, this.l, transparency);
  }

  public static fromColorDef(val: ColorDef) {
    return val.toHSL();
  }
}
