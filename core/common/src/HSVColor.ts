/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { ColorDef } from "./ColorDef";

/** @public */
export enum HSVConstants {
  VISIBILITY_GOAL = 40,
  HSV_SATURATION_WEIGHT = 4,
  HSV_VALUE_WEIGHT = 2,
}

/** An immutable color defined by Hue, Saturation, and Value
 * @see [here](https://en.wikipedia.org/wiki/HSL_and_HSV) for difference between HSL and HSV
 * @public
 */
export class HSVColor {
  /** Hue */
  public readonly h: number;
  /** Saturation */
  public readonly s: number;
  /** Value */
  public readonly v: number;

  public constructor(hue = 0, saturation = 0, value = 0) {
    this.h = hue;
    this.s = saturation;
    this.v = value;
  }

  public clone(hue?: number, saturation?: number, value?: number): HSVColor {
    return new HSVColor(hue ?? this.h, saturation ?? this.s, value ?? this.v);
  }

  public toColorDef(transparency = 0): ColorDef {
    return ColorDef.fromHSV(this, transparency);
  }

  public static fromColorDef(val: ColorDef): HSVColor {
    return val.toHSV();
  }

  public adjusted(darkenColor: boolean, delta: number): HSVColor {
    let weightedDelta;
    if (darkenColor) {
      weightedDelta = delta * HSVConstants.HSV_VALUE_WEIGHT;
      if (this.v >= weightedDelta)
        return new HSVColor(this.h, this.s, this.v - weightedDelta);

      weightedDelta -= this.v;
      const s = Math.min(this.s + weightedDelta, 100);
      return new HSVColor(this.h, s, 0);
    }

    weightedDelta = delta * HSVConstants.HSV_SATURATION_WEIGHT;
    if (this.s >= weightedDelta)
      return new HSVColor(this.h, this.s - weightedDelta, this.v);

    weightedDelta -= this.s;
    const v = Math.min(this.v + weightedDelta, 100);
    return new HSVColor(this.h, 0, v);
  }
}
