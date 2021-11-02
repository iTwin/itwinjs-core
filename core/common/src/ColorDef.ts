/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { Geometry } from "@itwin/core-geometry";
import { ColorByName } from "./ColorByName";
import { HSLColor } from "./HSLColor";
import { HSVColor, HSVConstants } from "./HSVColor";

// cspell: ignore ttbbggrr bbggrr rrggbb aabbggrr abgr rrggbb hsla lerp torgb dhue dsaturation dvalue intpart fractpart cyanish

// portions adapted from Three.js Copyright © 2010-2017 three.js authors

const scratchBytes = new Uint8Array(4);
const scratchUInt32 = new Uint32Array(scratchBytes.buffer);

/** An unsigned 32-bit integer in 0xTTBBGGRR format
 * @public
 */
export type ColorDefProps = number;

/** An immutable integer representation of a color.
 *
 * Colors are stored as 4 components: Red, Blue, Green, and Transparency (0=fully opaque). Each is an 8-bit integer between 0-255.
 *
 * Much confusion results from attempting to interpret those 4 one-byte values as a 4 byte integer. There are generally two sources
 * of confusion:
 *  1. The ordering of the Red, Green, Blue bytes; and
 *  2. Whether to specify transparency or opacity (sometimes referred to as "alpha").
 *
 * ColorDef uses `0xTTBBGGRR` (red in the low byte. 0==fully opaque in high byte) internally, but it also provides methods
 * to convert to `0xRRGGBB` (see [[getRgb]]) and `0xAABBGGRR` (red in the low byte, 0==fully transparent in high byte. see [[getAbgr]]).
 *
 * The [[create]] method also accepts strings in the common HTML formats.
 *
 * ColorDef is immutable. To obtain a modified copy of a ColorDef, use methods like [[adjustedForContrast]], [[inverse]], or [[withTransparency]]. For example:
 * ```ts
 *  const semiTransparentBlue = ColorDef.blue.withTransparency(100);
 * ```
 * @public
 */
export class ColorDef {
  private readonly _tbgr: number;

  private constructor(tbgr: number) {
    scratchUInt32[0] = tbgr;   // Force to be a 32-bit unsigned integer
    this._tbgr = scratchUInt32[0];
  }

  /**
   * Create a new ColorDef.
   * @param val value to use.
   * If a number, it is interpreted as a 0xTTBBGGRR (Red in the low byte, high byte is transparency 0==fully opaque) value.
   *
   * If a string, must be in one of the following forms:
   * *"rgb(255,0,0)"*
   * *"rgba(255,0,0,.2)"*
   * *"rgb(100%,0%,0%)"*
   * *"hsl(120,50%,50%)"*
   * *"#rrggbb"*
   * *"blanchedAlmond"* (see possible values from [[ColorByName]]). Case insensitive.
   */
  public static create(val?: string | ColorDefProps) {
    return this.fromTbgr(this.computeTbgr(val));
  }

  /** @internal */
  public static computeTbgr(val?: string | ColorDefProps): number {
    switch (typeof val) {
      case "number":
        return val;
      case "string":
        return this.computeTbgrFromString(val);
      default:
        return 0;
    }
  }

  /** Convert this ColorDef to a 32 bit number representing the 0xTTBBGGRR value */
  public toJSON(): ColorDefProps { return this._tbgr; }

  /** Create a new ColorDef from a json object. If the json object is a number, it is assumed to be a 0xTTBBGGRR value. */
  public static fromJSON(json?: ColorDefProps): ColorDef {
    return this.create(json);
  }

  /** Create a ColorDef from Red, Green, Blue, Transparency values. All inputs should be integers between 0-255. */
  public static from(red: number, green: number, blue: number, transparency?: number): ColorDef {
    return this.fromTbgr(this.computeTbgrFromComponents(red, green, blue, transparency));
  }

  /** Compute the 0xTTBBGGRR value corresponding to the specified Red, Green, Blue, Transparency components. All inputs should be integers between 0-255. */
  public static computeTbgrFromComponents(red: number, green: number, blue: number, transparency?: number): number {
    scratchBytes[0] = red;
    scratchBytes[1] = green;
    scratchBytes[2] = blue;
    scratchBytes[3] = transparency || 0;
    return scratchUInt32[0];
  }

  /** Create a ColorDef from its 0xTTBBGGRR representation. */
  public static fromTbgr(tbgr: number): ColorDef {
    switch (tbgr) {
      case ColorByName.black:
        return this.black;
      case ColorByName.white:
        return this.white;
      case ColorByName.red:
        return this.red;
      case ColorByName.green:
        return this.green;
      case ColorByName.blue:
        return this.blue;
      default:
        return new ColorDef(tbgr);
    }
  }

  /** Create a ColorDef from a string representation. The following representations are supported:
   * *"rgb(255,0,0)"*
   * *"rgba(255,0,0,.2)"*
   * *"rgb(100%,0%,0%)"*
   * *"hsl(120,50%,50%)"*
   * *"#rrbbgg"*
   * *"blanchedAlmond"* (see possible values from [[ColorByName]]). Case-insensitive.
   */
  public static fromString(val: string): ColorDef {
    return this.fromTbgr(this.computeTbgrFromString(val));
  }

  /** Compute the 0xTTBBGGRR value corresponding to a string representation of a color. The following representations are supported:
   * *"rgb(255,0,0)"*
   * *"rgba(255,0,0,.2)"*
   * *"rgb(100%,0%,0%)"*
   * *"hsl(120,50%,50%)"*
   * *"#rrbbgg"*
   * *"blanchedAlmond"* (see possible values from [[ColorByName]]). Case-insensitive.
   */
  public static computeTbgrFromString(val: string): number {
    if (typeof val !== "string")
      return 0;

    val = val.toLowerCase();
    let m = /^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/.exec(val);
    if (m) { // rgb / hsl
      let color;
      const name = m[1];
      const components = m[2];

      const hasPercent = (str: string) => str[str.length - 1] === "%";
      const floatOrPercent = (str: string) => {
        const v = parseFloat(str);
        return 255 * Geometry.clamp(hasPercent(str) ? v / 100. : v, 0, 1);
      };
      const intOrPercent = (str: string) => {
        const v = hasPercent(str) ? (parseFloat(str) / 100.) * 255 : parseInt(str, 10);
        return Geometry.clamp(v, 0, 255);
      };

      switch (name) {
        case "rgb":
        case "rgba":
          color = /^(\d+%*)\s*[, ]\s*(\d+%*)\s*[, ]\s*(\d+%*)\s*([,\/]\s*([0-9]*\.?[0-9]+%*)\s*)?$/.exec(components);
          if (color) { // rgb(255,0,0) rgba(255,0,0,0.5)
            return this.computeTbgrFromComponents(
              intOrPercent(color[1]),
              intOrPercent(color[2]),
              intOrPercent(color[3]),
              typeof color[5] === "string" ? 255 - floatOrPercent(color[5]) : 0);
          }

          break;
        case "hsl":
        case "hsla":
          color = /^([0-9]*\.?[0-9]+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components);
          if (color) { // hsl(120,50%,50%) hsla(120,50%,50%,0.5)
            const h = parseFloat(color[1]) / 360;
            const s = parseInt(color[2], 10) / 100;
            const l = parseInt(color[3], 10) / 100;
            const t = typeof color[5] === "string" ? 255 - floatOrPercent(color[5]) : 0;
            return this.computeTbgrFromHSL(h, s, l, t);
          }

          break;
      }
      // eslint-disable-next-line no-cond-assign
    } else if (m = /^\#([a-f0-9]+)$/.exec(val)) {  // hex color
      const hex = m[1];
      const size = hex.length;

      if (size === 3) { // #ff0
        return this.computeTbgrFromComponents(
          parseInt(hex.charAt(0) + hex.charAt(0), 16),
          parseInt(hex.charAt(1) + hex.charAt(1), 16),
          parseInt(hex.charAt(2) + hex.charAt(2), 16), 0);
      }
      if (size === 6) {  // #ff0000
        return this.computeTbgrFromComponents(
          parseInt(hex.charAt(0) + hex.charAt(1), 16),
          parseInt(hex.charAt(2) + hex.charAt(3), 16),
          parseInt(hex.charAt(4) + hex.charAt(5), 16), 0);
      }
    }

    if (val && val.length > 0) {   // ColorRgb value
      const colorByName = Object.entries(ColorByName).find((entry) => typeof entry[1] === "string" && entry[1].toLowerCase() === val);
      if (colorByName)
        return Number(colorByName[0]);
    }

    return 0;
  }

  /** Get the r,g,b,t values from this ColorDef. Values will be integers between 0-255. */
  public get colors(): { r: number, g: number, b: number, t: number } {
    return ColorDef.getColors(this._tbgr);
  }

  /** Get the r,g,b,t values encoded in an 0xTTBBGGRR value. Values will be integers between 0-255. */
  public static getColors(tbgr: number) {
    scratchUInt32[0] = tbgr;
    return {
      b: scratchBytes[2],
      g: scratchBytes[1],
      r: scratchBytes[0],
      t: scratchBytes[3],
    };
  }

  /** The color value of this ColorDef as an integer in the form 0xTTBBGGRR (red in the low byte) */
  public get tbgr(): number { return this._tbgr; }

  /** Get the value of the color as a number in 0xAABBGGRR format (i.e. red is in low byte). Transparency (0==fully opaque) converted to alpha (0==fully transparent).  */
  public getAbgr(): number {
    return ColorDef.getAbgr(this._tbgr);
  }

  /** Get the value of a 0xTTBBGGRR color as a number in 0xAABBGGRR format (i.e. red is in low byte). Transparency (0==fully opaque) converted to alpha (0==fully transparent).  */
  public static getAbgr(tbgr: number): number {
    scratchUInt32[0] = tbgr;
    scratchBytes[3] = 255 - scratchBytes[3];
    return scratchUInt32[0];
  }

  /** Get the RGB value of the color as a number in 0xRRGGBB format (i.e blue is in the low byte). Transparency is ignored. Value will be from 0 to 2^24 */
  public getRgb(): number {
    return ColorDef.getRgb(this._tbgr);
  }

  /** Get the RGB value of the 0xTTBBGGRR color as a number in 0xRRGGBB format (i.e blue is in the low byte). Transparency is ignored. Value will be from 0 to 2^24 */
  public static getRgb(tbgr: number): number {
    scratchUInt32[0] = tbgr;
    return (scratchBytes[0] << 16) + (scratchBytes[1] << 8) + scratchBytes[2];
  }

  /** Return a copy of this ColorDef with the specified alpha component.
   * @param alpha the new alpha value as an integer between 0-255.
   * @returns A ColorDef with equivalent red, green, and blue components to this one but with the specified alpha.
   */
  public withAlpha(alpha: number): ColorDef {
    const tbgr = ColorDef.withAlpha(this._tbgr, alpha);
    return tbgr === this._tbgr ? this : ColorDef.fromTbgr(tbgr);
  }

  /** Return a color equivalent to the specified 0xTTBBGGRR but with modified alpha component.
   * @param alpha the new alpha value as an integer between 0-255.
   * @returns The 0xTTBBGGRR value equivalent to `tbgr` but with the specified alpha.
   */
  public static withAlpha(tbgr: number, alpha: number): number {
    scratchUInt32[0] = tbgr;
    scratchBytes[3] = 255 - (alpha | 0);
    return scratchUInt32[0];
  }

  /** Get the alpha value for this ColorDef. Will be between 0-255 */
  public getAlpha(): number {
    return ColorDef.getAlpha(this._tbgr);
  }

  /** Extract the alpha value from a 0xTTBBGGRR color. */
  public static getAlpha(tbgr: number): number {
    scratchUInt32[0] = tbgr;
    return 255 - scratchBytes[3];
  }

  /** True if this ColorDef is fully opaque. */
  public get isOpaque(): boolean {
    return ColorDef.isOpaque(this._tbgr);
  }

  /** True if the specified 0xTTBBGGRR color is fully opaque. */
  public static isOpaque(tbgr: number): boolean {
    return 255 === this.getAlpha(tbgr);
  }

  /** Get the transparency value for this ColorDef (inverse of alpha). Will be between 0-255. */
  public getTransparency(): number {
    return ColorDef.getTransparency(this._tbgr);
  }

  /** Extract the transparency component from a 0xTTBBGGRR color as an integer between 0-255.. */
  public static getTransparency(tbgr: number): number {
    scratchUInt32[0] = tbgr;
    return scratchBytes[3];
  }

  /** Create a copy of this ColorDef with the specified transparency.
   * @param transparency the new transparency value. Must be between 0-255, where 0 means 'fully opaque' and 255 means 'fully transparent'.
   * @returns a new ColorDef with the same color as this one and the specified transparency.
   */
  public withTransparency(transparency: number): ColorDef {
    const tbgr = ColorDef.withTransparency(this._tbgr, transparency);
    return tbgr === this._tbgr ? this : ColorDef.fromTbgr(tbgr);
  }

  /** Compute the 0xTTBBGGRR value of the specified color and transparency.
   * @param transparency the new transparency as an integer between 0-255.
   * @returns The 0xTTBBGGRR value equivalent to `tbgr` but with the specified transparency.
   */
  public static withTransparency(tbgr: number, transparency: number): number {
    return this.withAlpha(tbgr, 255 - transparency);
  }

  /** The "known name" for this ColorDef. Will be undefined if color value is not in [[ColorByName]] list */
  public get name(): string | undefined {
    return ColorDef.getName(this.tbgr);
  }

  /** Obtain the name of the color in the [[ColorByName]] list associated with the specified 0xTTBBGGRR value, or undefined if no such named color exists. */
  public static getName(tbgr: number): string | undefined {
    return ColorByName[tbgr];
  }

  /** Convert this ColorDef to a string in the form "#rrggbb" where values are hex digits of the respective colors */
  public toHexString(): string {
    return ColorDef.toHexString(this.tbgr);
  }

  /** Convert the 0xTTBBGGRR value to a string in the form "#rrggbb". */
  public static toHexString(tbgr: number): string {
    return `#${(`000000${this.getRgb(tbgr).toString(16)}`).slice(-6)}`;
  }

  private static getColorsString(tbgr: number) {
    const c = this.getColors(tbgr);
    return `${c.r},${c.g},${c.b}`;
  }

  /** Convert this ColorDef to a string in the form "rgb(r,g,b)" where values are decimal digits of the respective colors. */
  public toRgbString(): string {
    return ColorDef.toRgbString(this.tbgr);
  }

  /** Convert the 0xTTBBGGRR color to a string in the form "rgb(r,g,b)" where each component is specified in decimal. */
  public static toRgbString(tbgr: number): string {
    return `rgb(${this.getColorsString(tbgr)})`;
  }

  /** Convert this ColorDef to a string in the form "rgba(r,g,b,a)" where color values are decimal digits and a is a fraction */
  public toRgbaString(): string {
    return ColorDef.toRgbaString(this.tbgr);
  }

  /** Convert the 0xTTBBGGRR color to a string of the form "rgba(r,g,b,a)" where the color components are specified in decimal and the alpha component is a fraction. */
  public static toRgbaString(tbgr: number): string {
    return `rgba(${this.getColorsString(tbgr)},${this.getAlpha(tbgr) / 255.})`;
  }

  /** Create a ColorDef that is the linear interpolation of this ColorDef and another ColorDef, using a weighting factor.
   * @param color2 The other color
   * @param weight The weighting factor for color2. 0.0 = this color, 1.0 = color2.
   * @param result Optional ColorDef to hold result. If undefined, a new ColorDef is created.
   */
  public lerp(color2: ColorDef, weight: number): ColorDef {
    return ColorDef.fromTbgr(ColorDef.lerp(this.tbgr, color2.tbgr, weight));
  }

  /** Interpolate between two 0xTTBBGGRR colors using a weighting factor.
   * @param tbgr1 The first color
   * @param tbgr2 The other color
   * @param weight The weighting factor in [0..1]. A value of 0.0 selects `tbgr1`; 1.0 selects `tbgr2`; 0.5 mixes them evenly; etc.
   * @returns The linear interpolation between `tbgr1` and `tbgr2` using the specified weight.
   */
  public static lerp(tbgr1: number, tbgr2: number, weight: number): number {
    const c = this.getColors(tbgr1);
    const color = this.getColors(tbgr2);
    c.r += (color.r - c.r) * weight;
    c.g += (color.g - c.g) * weight;
    c.b += (color.b - c.b) * weight;
    return this.computeTbgrFromComponents(c.r, c.g, c.b, c.t);
  }

  /** Create a new ColorDef that is the inverse (all colors set to 255 - this) of this color. Ignores transparency - result has 0 transparency. */
  public inverse(): ColorDef {
    return ColorDef.fromTbgr(ColorDef.inverse(this.tbgr));
  }

  /** Return a 0xTTBBGGRR color whose color components are the inverse of the input color. The result has 0 transparency. */
  public static inverse(tbgr: number): number {
    const colors = this.getColors(tbgr);
    return this.computeTbgrFromComponents(255 - colors.r, 255 - colors.g, 255 - colors.b);
  }

  /** Create a ColorDef from hue, saturation, lightness values */
  public static fromHSL(h: number, s: number, l: number, transparency = 0): ColorDef {
    return this.fromTbgr(this.computeTbgrFromHSL(h, s, l, transparency));
  }

  /** Compute the 0xTTBBGGRR color corresponding to the specified hue, saturation, lightness values. */
  public static computeTbgrFromHSL(h: number, s: number, l: number, transparency = 0): number {
    const torgb = (p1: number, q1: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p1 + (q1 - p1) * 6 * t;
      if (t < 1 / 2) return q1;
      if (t < 2 / 3) return p1 + (q1 - p1) * 6 * (2 / 3 - t);
      return p1;
    };

    const hue2rgb = (p1: number, q1: number, t: number) => Math.round(torgb(p1, q1, t) * 255);
    const modulo = (n: number, m: number) => ((n % m) + m) % m;

    // h,s,l ranges are in 0.0 - 1.0
    h = modulo(h, 1);
    s = Geometry.clamp(s, 0, 1);
    l = Geometry.clamp(l, 0, 1);

    if (s === 0) {
      l *= 255;
      return this.computeTbgrFromComponents(l, l, l, transparency);
    }

    const p = l <= 0.5 ? l * (1 + s) : l + s - (l * s);
    const q = (2 * l) - p;
    return this.computeTbgrFromComponents(
      hue2rgb(q, p, h + 1 / 3),
      hue2rgb(q, p, h),
      hue2rgb(q, p, h - 1 / 3),
      transparency);
  }

  /** Create an [[HSLColor]] from this ColorDef */
  public toHSL(): HSLColor {
    // h,s,l ranges are in 0.0 - 1.0
    const col = this.colors;
    col.r /= 255;
    col.g /= 255;
    col.b /= 255;
    const max = Math.max(col.r, col.g, col.b);
    const min = Math.min(col.r, col.g, col.b);

    let hue = 0;
    let saturation;
    const lightness = (min + max) / 2.0;

    if (min === max) {
      saturation = 0;
    } else {
      const delta = max - min;
      saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
      switch (max) {
        case col.r: hue = (col.g - col.b) / delta + (col.g < col.b ? 6 : 0); break;
        case col.g: hue = (col.b - col.r) / delta + 2; break;
        case col.b: hue = (col.r - col.g) / delta + 4; break;
      }
      hue /= 6;
    }

    return new HSLColor(hue, saturation, lightness);
  }

  /** Create an [[HSVColor]] from this ColorDef */
  public toHSV(): HSVColor {
    const { r, g, b } = this.colors;
    let min = (r < g) ? r : g;
    if (b < min)
      min = b;

    let max = (r > g) ? r : g;
    if (b > max)
      max = b;

    /* amount of "blackness" present */
    const v = Math.floor((max / 255.0 * 100) + 0.5);
    const deltaRgb = max - min;
    const s = (max !== 0.0) ? Math.floor((deltaRgb / max * 100) + 0.5) : 0;
    let h = 0;

    if (s) {
      const redDistance = (max - r) / deltaRgb;
      const greenDistance = (max - g) / deltaRgb;
      const blueDistance = (max - b) / deltaRgb;

      let intermediateHue: number;
      if (r === max)           /* color between yellow & magenta */
        intermediateHue = blueDistance - greenDistance;
      else if (g === max)      /* color between cyan & yellow */
        intermediateHue = 2.0 + redDistance - blueDistance;
      else                    /* color between magenta & cyan */
        intermediateHue = 4.0 + greenDistance - redDistance;

      /* intermediate hue is [0..6] */
      intermediateHue *= 60;

      if (intermediateHue < 0.0)
        intermediateHue += 360;

      h = Math.floor(intermediateHue + 0.5);

      if (h >= 360)
        h = 0;
    } else {
      h = 0;
    }

    return new HSVColor(h, s, v);
  }

  /** Create a ColorDef from an HSVColor */
  public static fromHSV(hsv: HSVColor, transparency = 0): ColorDef {
    // Check for simple case first.
    if ((!hsv.s) || (hsv.h === -1)) {
      // hue must be undefined, have no color only white
      const white = 0xff & Math.floor(((255.0 * hsv.v) / 100.0) + 0.5 + 3.0e-14);
      return ColorDef.from(white, white, white, 0);
    }

    let dhue = hsv.h, dsaturation = hsv.s, dvalue = hsv.v;
    if (dhue === 360)
      dhue = 0.0;

    dhue /= 60; // hue is now [0..6]
    const hueIntpart = Math.floor(dhue); // convert double -> int
    const hueFractpart = dhue - hueIntpart;
    dvalue /= 100;
    dsaturation /= 100;

    const p = 0xff & Math.floor((dvalue * (1.0 - dsaturation) * 255.0) + 0.5);
    const q = 0xff & Math.floor((dvalue * (1.0 - (dsaturation * hueFractpart)) * 255.0) + 0.5);
    const t = 0xff & Math.floor((dvalue * (1.0 - (dsaturation * (1.0 - hueFractpart))) * 255.0) + 0.5);
    const v = 0xff & Math.floor(dvalue * 255 + 0.5);

    let r = 0, b = 0, g = 0;
    switch (hueIntpart) {
      case 0: r = v; g = t; b = p; break; // reddish
      case 1: r = q, g = v; b = p; break; // yellowish
      case 2: r = p, g = v; b = t; break; // greenish
      case 3: r = p, g = q; b = v; break; // cyanish
      case 4: r = t, g = p; b = v; break; // bluish
      case 5: r = v, g = p; b = q; break; // magenta-ish
    }

    return ColorDef.from(r, g, b, transparency);
  }

  private visibilityCheck(other: ColorDef): number {
    const fg = this.colors;
    const bg = other.colors;
    // Compute luminosity
    const red = Math.abs(fg.r - bg.r);
    const green = Math.abs(fg.g - bg.g);
    const blue = Math.abs(fg.b - bg.b);
    return (0.30 * red) + (0.59 * green) + (0.11 * blue);
  }

  /**
   * Create a new ColorDef that is adjusted from this ColorDef for maximum contrast against another color. The color will either be lighter
   * or darker, depending on which has more visibility against the other color.
   * @param other the color to contrast with
   * @param alpha optional alpha value for the adjusted color. If not supplied alpha from this color is used.
   */
  public adjustedForContrast(other: ColorDef, alpha?: number): ColorDef {
    const visibility = this.visibilityCheck(other);
    if (HSVConstants.VISIBILITY_GOAL <= visibility) {
      return undefined !== alpha ? this.withAlpha(alpha) : this;
    }

    const adjPercent = Math.floor(((HSVConstants.VISIBILITY_GOAL - visibility) / 255.0) * 100.0);
    let darkerHSV = this.toHSV();
    let brightHSV = darkerHSV.clone();

    darkerHSV = darkerHSV.adjusted(true, adjPercent);
    brightHSV = brightHSV.adjusted(false, adjPercent);

    if (undefined === alpha)
      alpha = this.getAlpha();

    const darker = ColorDef.fromHSV(darkerHSV).withAlpha(alpha);
    const bright = ColorDef.fromHSV(brightHSV).withAlpha(alpha);

    if (bright.getRgb() === other.getRgb()) // Couldn't adjust brighter...
      return darker;

    if (darker.getRgb() === other.getRgb()) // Couldn't adjust darker...
      return bright;

    // NOTE: Best choice is the one most visible against the other color...
    return (bright.visibilityCheck(other) >= darker.visibilityCheck(other)) ? bright : darker;
  }

  /** True if the value of this ColorDef is the same as another ColorDef. */
  public equals(other: ColorDef): boolean {
    return this._tbgr === other._tbgr;
  }

  /** pure black */
  public static readonly black = new ColorDef(ColorByName.black);
  /** pure white */
  public static readonly white = new ColorDef(ColorByName.white);
  /** pure red */
  public static readonly red = new ColorDef(ColorByName.red);
  /** pure green */
  public static readonly green = new ColorDef(ColorByName.green);
  /** pure blue */
  public static readonly blue = new ColorDef(ColorByName.blue);
}
