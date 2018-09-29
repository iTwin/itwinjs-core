/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// spell-checker: disable

/** @module Symbology */

/**
 * A set of known colors by name, as a 32-bit integer in the form 0xBBGGRR (red is the low byte).
 * This is different than color values in #RRGGBB format for HTML pages (red and blue are swapped).
 * If your colors don't look right, likely you're using 0xRRGGBB where ColorDef expects 0xBBGGRR.
 */
export enum ColorByName {
  aliceBlue = 0xFFF8F0,
  amber = 0x00BFFF,
  antiqueWhite = 0xD7EBFA,
  aqua = 0xFFFF00,
  aquamarine = 0xD4FF7F,
  azure = 0xFFFFF0,
  beige = 0xDCF5F5,
  bisque = 0xC4E4FF,
  black = 0x000000,
  blanchedAlmond = 0xCDEBFF,
  blue = 0xFF0000,
  blueViolet = 0xE22B8A,
  brown = 0x2A2AA5,
  burlyWood = 0x87B8DE,
  cadetBlue = 0xA09E5F,
  chartreuse = 0x00FF7F,
  chocolate = 0x1E69D2,
  coral = 0x507FFF,
  cornflowerBlue = 0xED9564,
  cornSilk = 0xDCF8FF,
  crimson = 0x3C14DC,
  cyan = 0xFFFF00,
  darkBlue = 0x8B0000,
  darkBrown = 0x214365,
  darkCyan = 0x8B8B00,
  darkGoldenrod = 0x0B86B8,
  darkGray = 0xA9A9A9,
  darkGreen = 0x006400,
  darkGrey = 0xA9A9A9,
  darkKhaki = 0x6BB7BD,
  darkMagenta = 0x8B008B,
  darkOliveGreen = 0x2F6B55,
  darkOrange = 0x008CFF,
  darkOrchid = 0xCC3299,
  darkRed = 0x00008B,
  darkSalmon = 0x7A96E9,
  darkSeagreen = 0x8FBC8F,
  darkSlateBlue = 0x8B3D48,
  darkSlateGray = 0x4F4F2F,
  darkSlateGrey = 0x4F4F2F,
  darkTurquoise = 0xD1CE00,
  darkViolet = 0xD30094,
  deepPink = 0x9314FF,
  deepSkyBlue = 0xFFBF00,
  dimGray = 0x696969,
  dimGrey = 0x696969,
  dodgerBlue = 0xFF901E,
  fireBrick = 0x2222B2,
  floralWhite = 0xF0FAFF,
  forestGreen = 0x228B22,
  fuchsia = 0xFF00FF,
  gainsboro = 0xDCDCDC,
  ghostWhite = 0xFFF8F8,
  gold = 0x00D7FF,
  goldenrod = 0x20A5DA,
  gray = 0x808080,
  green = 0x008000,
  greenYellow = 0x2FFFAD,
  grey = 0x808080,
  honeydew = 0xF0FFF0,
  hotPink = 0xB469FF,
  indianRed = 0x5C5CCD,
  indigo = 0x82004B,
  ivory = 0xF0FFFF,
  khaki = 0x8CE6F0,
  lavender = 0xFAE6E6,
  lavenderBlush = 0xF5F0FF,
  lawnGreen = 0x00FC7C,
  lemonChiffon = 0xCDFAFF,
  lightBlue = 0xE6D8AD,
  lightCoral = 0x8080F0,
  lightCyan = 0xFFFFE0,
  lightGoldenrodYellow = 0xD2FAFA,
  lightGray = 0xD3D3D3,
  lightGreen = 0x90EE90,
  lightGrey = 0xD3D3D3,
  lightPink = 0xC1B6FF,
  lightSalmon = 0x7AA0FF,
  lightSeagreen = 0xAAB220,
  lightSkyBlue = 0xFACE87,
  lightSlateGray = 0x998877,
  lightSlateGrey = 0x998877,
  lightSteelBlue = 0xDEC4B0,
  lightyellow = 0xE0FFFF,
  lime = 0x00FF00,
  limeGreen = 0x32CD32,
  linen = 0xE6F0FA,
  magenta = 0xFF00FF,
  maroon = 0x000080,
  mediumAquamarine = 0xAACD66,
  mediumBlue = 0xCD0000,
  mediumOrchid = 0xD355BA,
  mediumPurple = 0xDB7093,
  mediumSeaGreen = 0x71B33C,
  mediumSlateBlue = 0xEE687B,
  mediumSpringGreen = 0x9AFA00,
  mediumTurquoise = 0xCCD148,
  mediumVioletRed = 0x8515C7,
  midnightBlue = 0x701919,
  mintCream = 0xFAFFF5,
  mistyRose = 0xE1E4FF,
  moccasin = 0xB5E4FF,
  navajoWhite = 0xADDEFF,
  navy = 0x800000,
  oldLace = 0xE6F5FD,
  olive = 0x008080,
  oliveDrab = 0x238E6B,
  orange = 0x00A5FF,
  orangeRed = 0x0045FF,
  orchid = 0xD670DA,
  paleGoldenrod = 0xAAE8EE,
  paleGreen = 0x98FB98,
  paleTurquoise = 0xEEEEAF,
  paleVioletRed = 0x9370DB,
  papayaWhip = 0xD5EFFF,
  peachPuff = 0xB9DAFF,
  peru = 0x3F85CD,
  pink = 0xCBC0FF,
  plum = 0xDDA0DD,
  powderBlue = 0xE6E0B0,
  purple = 0x800080,
  rebeccaPurple = 0x993366,
  red = 0x0000FF,
  rosyBrown = 0x8F8FBC,
  royalBlue = 0xE16941,
  saddleBrown = 0x13458B,
  salmon = 0x7280FA,
  sandyBrown = 0x60A4F4,
  seaGreen = 0x578B2E,
  seaShell = 0xEEF5FF,
  sienna = 0x2D52A0,
  silver = 0xC0C0C0,
  skyBlue = 0xEBCE87,
  slateBlue = 0xCD5A6A,
  slateGray = 0x908070,
  slateGrey = 0x908070,
  snow = 0xFAFAFF,
  springGreen = 0x7FFF00,
  steelBlue = 0xB48246,
  tan = 0x8CB4D2,
  teal = 0x808000,
  thistle = 0xD8BFD8,
  tomato = 0x4763FF,
  turquoise = 0xD0E040,
  violet = 0xEE82EE,
  wheat = 0xB3DEF5,
  white = 0xFFFFFF,
  whiteSmoke = 0xF5F5F5,
  yellow = 0x00FFFF,
  yellowGreen = 0x32CD9A,
}

const enum HsvConstants {
  VISIBILITY_GOAL = 40,
  HSV_SATURATION_WEIGHT = 4,
  HSV_VALUE_WEIGHT = 2,
}

/** A color defined by Hue, Saturation, and Lightness.
 * @see [here](https://en.wikipedia.org/wiki/HSL_and_HSV) for difference between HSL and HSV
 */
export class HSLColor {
  /** Hue */
  public h = 0;
  /** Saturation */
  public s = 0;
  /** Lightness */
  public l = 0;
  public clone(): HSLColor { const out = new HSLColor(); out.h = this.h; out.s = this.s; out.l = this.l; return out; }
  public toColorDef(out?: ColorDef): ColorDef { return ColorDef.fromHSL(this.h, this.s, this.l, out); }
  public static fromColorDef(val: ColorDef, out?: HSLColor) { return val.toHSL(out); }
}

/**
 * A color defined by Hue, Saturation, and Value
 * @see [here](https://en.wikipedia.org/wiki/HSL_and_HSV) for difference between HSL and HSV
 */
export class HSVColor {
  /** Hue */
  public h = 0;
  /** Saturation */
  public s = 0;
  /** Value */
  public v = 0;
  public clone(): HSVColor { const out = new HSVColor(); out.h = this.h; out.s = this.s; out.v = this.v; return out; }
  public toColorDef(out?: ColorDef): ColorDef { return ColorDef.fromHSV(this, out); }
  public static fromColorDef(val: ColorDef, out?: HSVColor) { return val.toHSV(out); }

  public adjustColor(darkenColor: boolean, delta: number): void {
    if (darkenColor) {
      let weightedDelta = delta * HsvConstants.HSV_VALUE_WEIGHT;

      if (this.v >= weightedDelta) {
        this.v -= weightedDelta;
      } else {
        weightedDelta -= this.v;

        this.v = 0;
        this.s = this.s + weightedDelta < 100 ? this.s + weightedDelta : 100;
      }
    } else {
      let weightedDelta = delta * HsvConstants.HSV_SATURATION_WEIGHT;

      if (this.s >= weightedDelta) {
        this.s -= weightedDelta;
      } else {
        weightedDelta -= this.s;
        this.s = 0;
        this.v = this.v + weightedDelta < 100 ? this.v + weightedDelta : 100;
      }
    }
  }
}

const scratchBytes = new Uint8Array(4);
const scratchUInt32 = new Uint32Array(scratchBytes.buffer);

/** A number in 0xTTBBGGRR format */
export type ColorDefProps = number | ColorDef;

/**
 * An integer representation of a color.
 *
 * Colors are stored as 4 components: Red, Blue, Green, and Transparency (0=fully opaque). Each is an 8-bit integer between 0-255.
 *
 * Much confusion results from attempting to interpret those 4 one-byte values as a 4 byte integer. There are generally two sources
 * of confusion:
 *  1. The order the Red, Green, Blue bytes
 *  2. Whether to specify transparency or opacity (sometimes referred to as "alpha")
 *
 * Generally, iModel.js prefers to use `0xTTBBGGRR` (red in the low byte. 0==fully opaque in high byte), but this class provides methods
 * to convert to `0xRRGGBB` (see [[getRgb]]) and `0xAABBGGRR` (red in the low byte, 0==fully transparent in high byte. see [[getAbgr]]).
 *
 * The constructor also accepts strings in the common HTML formats.
 */
export class ColorDef {
  private _tbgr: number;

  /** Swap the red and blue values of a 32-bit integer representing a color. Transparency and green are unchanged. */
  public static rgb2bgr(val: number): number { scratchUInt32[0] = val; return scratchBytes[3] << 24 + scratchBytes[0] << 16 + scratchBytes[1] << 8 + scratchBytes[2]; }

  /**
   * Create a new ColorDef.
   * @param val value to use.
   * If a number, it is interpreted as a 0xTTBBGGRR (Red in the low byte, high byte is transparency 0==fully opaque) value.
   *
   * If a string, must be in one of the following forms:
   * *"rgb(255,0,0)"*
   * *"rgba(255,0,0,255)"*
   * *"rgb(100%,0%,0%)"*
   * *"hsl(120,50%,50%)"*
   * *"#rrbbgg"*
   * *"blanchedAlmond"* (see possible values from [[ColorByName]]). Case insensitve.
   */
  public constructor(val?: string | ColorDefProps) {
    this._tbgr = 0;
    if (!val) return;
    if (typeof val === "number") { this.tbgr = val; return; }
    if (val instanceof ColorDef) { this._tbgr = val._tbgr; return; }
    this.fromString(val);
  }

  /** Make a copy of this ColorDef */
  public clone(): ColorDef { return new ColorDef(this._tbgr); }

  /** Set the color of this ColorDef from another ColorDef */
  public setFrom(other: ColorDef) { this._tbgr = other._tbgr; }

  /** Convert this ColorDef to a 32 bit number representing the 0xTTBBGGRR value */
  public toJSON(): ColorDefProps { return this._tbgr; }

  /** Create a new ColorDef from a json object. If the json object is a number, it is assumed to be a 0xTTBBGGRR value. */
  public static fromJSON(json?: any): ColorDef { return new ColorDef(json); }

  /** Initialize or create a ColorDef fromn Red,Green,Blue,Transparency values. All values should be between 0-255 */
  public static from(red: number, green: number, blue: number, transparency?: number, result?: ColorDef): ColorDef {
    result = result ? result : new ColorDef();
    scratchBytes[0] = red;
    scratchBytes[1] = green;
    scratchBytes[2] = blue;
    scratchBytes[3] = transparency || 0;
    result._tbgr = scratchUInt32[0];
    return result;
  }

  /** Get the r,g,b,t values from this ColorDef. Returned as an object with {r, g, b, t} members. Values will be integers between 0-255. */
  public get colors() { scratchUInt32[0] = this._tbgr; return { b: scratchBytes[2], g: scratchBytes[1], r: scratchBytes[0], t: scratchBytes[3] }; }

  /** The color value of this ColorDef as an integer in the form 0xTTBBGGRR (red in the low byte) */
  public get tbgr(): number { return this._tbgr; }
  public set tbgr(tbgr: number) { scratchUInt32[0] = tbgr; this._tbgr = scratchUInt32[0]; } // force to be a 32 bit unsigned integer

  /** Get the value of the color as a number in 0xAABBGGRR format (i.e. red is in low byte). Transparency (0==fully opaque) converted to alpha (0==fully transparent).  */
  public getAbgr(): number { scratchUInt32[0] = this._tbgr; scratchBytes[3] = 255 - scratchBytes[3]; return scratchUInt32[0]; }

  /** Get the RGB value of the color as a number in 0xRRGGBB format (i.e blue is in the low byte). Transparency is ignored. Value will be from 0 to 2^24 */
  public getRgb(): number { scratchUInt32[0] = this._tbgr; return (scratchBytes[0] << 16) + (scratchBytes[1] << 8) + scratchBytes[2]; }

  /** Change the alpha value for this ColorDef.
   * @param alpha the new alpha value. Must be between 0-255.
   */
  public setAlpha(alpha: number): void { scratchUInt32[0] = this._tbgr; scratchBytes[3] = 255 - (alpha | 0); this._tbgr = scratchUInt32[0]; }
  /** Get the alpha value for this ColorDef. Will be between 0-255 */
  public getAlpha(): number { scratchUInt32[0] = this._tbgr; return 255 - scratchBytes[3]; }
  /** True if this ColorDef is fully opaque */
  public get isOpaque(): boolean { return 255 === this.getAlpha(); }
  /** Change the transparency value for this ColorDef
   * @param transparency the new transparency value. Must be between 0-255, where 0 means 'fully opaque' and 255 means 'fully transparent'.
   */
  public setTransparency(transparency: number): void { this.setAlpha(255 - transparency); }

  /** The "known name" for this ColorDef. Will be undefined if color value is not in [[ColorByName]] list */
  public get name(): string | undefined { return ColorByName[this._tbgr]; }

  /** Convert this ColorDef to a string in the form "#rrggbb" where values are hex digits of the respective colors */
  public toHexString(): string { return "#" + ("000000" + this.getRgb().toString(16)).slice(-6); }

  /** Convert this ColorDef to a string in the form "rgb(r,g,b)" where values are decimal digits of the respective colors */
  public toRgbString(): string { const c = this.colors; return "rgb(" + (c.r | 0) + "," + (c.g | 0) + "," + (c.b | 0) + ")"; }
  private fromString(val: string): ColorDef {
    if (typeof val !== "string")
      return this;

    val = val.toLowerCase();
    let m = /^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/.exec(val);
    if (m) { // rgb / hsl

      let color;
      const name = m[1];
      const components = m[2];

      switch (name) {
        case "rgb":
        case "rgba":
          color = /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components);
          if (color) { // rgb(255,0,0) rgba(255,0,0,0.5)
            return ColorDef.from(
              Math.min(255, parseInt(color[1], 10)),
              Math.min(255, parseInt(color[2], 10)),
              Math.min(255, parseInt(color[3], 10)),
              color[5] != null ? 255 - Math.min(255, parseInt(color[5], 10)) : 0, this);
          }

          color = /^(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components);
          if (color) { // rgb(100%,0%,0%) rgba(100%,0%,0%,0.5)
            return ColorDef.from(
              (Math.min(100, parseInt(color[1], 10)) / 100) * 255,
              (Math.min(100, parseInt(color[2], 10)) / 100) * 255,
              (Math.min(100, parseInt(color[3], 10)) / 100) * 255,
              color[5] != null ? 255 - ((Math.min(100, parseInt(color[5], 10)) / 100) * 255) : 0, this);
          }

          break;

        case "hsl":
        case "hsla":
          color = /^([0-9]*\.?[0-9]+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components);
          if (color) {        // hsl(120,50%,50%) hsla(120,50%,50%,0.5)
            const h = parseFloat(color[1]) / 360;
            const s = parseInt(color[2], 10) / 100;
            const l = parseInt(color[3], 10) / 100;
            return ColorDef.fromHSL(h, s, l, this);
          }
          break;
      }

      // tslint:disable-next-line:no-conditional-assignment
    } else if (m = /^\#([a-f0-9]+)$/.exec(val)) {  // hex color
      const hex = m[1];
      const size = hex.length;

      if (size === 3) { // #ff0
        return ColorDef.from(
          parseInt(hex.charAt(0) + hex.charAt(0), 16),
          parseInt(hex.charAt(1) + hex.charAt(1), 16),
          parseInt(hex.charAt(2) + hex.charAt(2), 16), 0, this);
      }
      if (size === 6) {  // #ff0000
        return ColorDef.from(
          parseInt(hex.charAt(0) + hex.charAt(1), 16),
          parseInt(hex.charAt(2) + hex.charAt(3), 16),
          parseInt(hex.charAt(4) + hex.charAt(5), 16), 0, this);
      }
    }

    if (val && val.length > 0) {   // ColorRgb value
      Object.entries(ColorByName).some((v) => {
        if (v[1].toLowerCase() !== val)
          return false;
        this._tbgr = Number(v[0]);
        return true;
      });
    }
    return this;
  }

  /** Create a ColorDef that is the linear interpolation of this ColorDef and another ColorDef, using a weighting factor.
   * @param color2 The other color
   * @param weight The weighting factor for color2. 0.0 = this color, 1.0 = color2.
   * @param result Optional ColorDef to hold result. If undefined, a new ColorDef is created.
   */
  public lerp(color2: ColorDef, weight: number, result?: ColorDef): ColorDef {
    const color = color2.colors;
    const c = this.colors;
    c.r += (color.r - c.r) * weight;
    c.g += (color.g - c.g) * weight;
    c.b += (color.b - c.b) * weight;
    return ColorDef.from(c.r, c.g, c.b, c.t, result);
  }

  /** Create a new ColorDef that is the inverse (all colors set to 255 - this) of this color. */
  public invert(): ColorDef { const colors = this.colors; return ColorDef.from(255 - colors.r, 255 - colors.g, 255 - colors.b); }

  /** Create a ColorDef from hue, saturation, lightness values */
  public static fromHSL(h: number, s: number, l: number, out?: ColorDef): ColorDef {
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
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    // h,s,l ranges are in 0.0 - 1.0
    h = modulo(h, 1);
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);

    if (s === 0)
      return ColorDef.from(l, l, l, 0, out);

    const p = l <= 0.5 ? l * (1 + s) : l + s - (l * s);
    const q = (2 * l) - p;
    return ColorDef.from(
      hue2rgb(q, p, h + 1 / 3),
      hue2rgb(q, p, h),
      hue2rgb(q, p, h - 1 / 3), 0, out);
  }

  /** Create an [[HSLColor]] from this ColorDef */
  public toHSL(opt?: HSLColor): HSLColor {
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

    const hsl = opt ? opt : new HSLColor();
    hsl.h = hue;
    hsl.s = saturation;
    hsl.l = lightness;
    return hsl;
  }

  /** Create an [[HSVColor]] from this ColorDef */
  public toHSV(out?: HSVColor): HSVColor {
    const hsv = out ? out : new HSVColor();
    const { r, g, b } = this.colors;
    let min = (r < g) ? r : g;
    if (b < min)
      min = b;

    let max = (r > g) ? r : g;
    if (b > max)
      max = b;

    /* amount of "blackness" present */
    hsv.v = Math.floor((max / 255.0 * 100) + 0.5);
    const deltaRgb = max - min;
    hsv.s = (max !== 0.0) ? Math.floor((deltaRgb / max * 100) + 0.5) : 0;

    if (hsv.s) {
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

      hsv.h = Math.floor(intermediateHue + 0.5);

      if (hsv.h >= 360)
        hsv.h = 0;
    } else {
      hsv.h = 0;
    }
    return hsv;
  }

  /** Create a ColorDef from an HSVColor */
  public static fromHSV(hsv: HSVColor, out?: ColorDef): ColorDef {
    // Check for simple case first.
    if ((!hsv.s) || (hsv.h === -1)) {
      // hue must be undefined, have no color only white
      const white = 0xff & Math.floor(((255.0 * hsv.v) / 100.0) + 0.5 + 3.0e-14);
      return ColorDef.from(white, white, white, 0, out);
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
    return ColorDef.from(r, g, b, 0, out);
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
  public adjustForContrast(other: ColorDef, alpha?: number): ColorDef {
    const visibility = this.visibilityCheck(other);
    if (HsvConstants.VISIBILITY_GOAL <= visibility) {
      const color = this.clone();

      if (undefined !== alpha)
        color.setAlpha(alpha);

      return color;
    }

    const adjPercent = Math.floor(((HsvConstants.VISIBILITY_GOAL - visibility) / 255.0) * 100.0);
    const darkerHSV = this.toHSV();
    const brightHSV = darkerHSV.clone();

    darkerHSV.adjustColor(true, adjPercent);
    brightHSV.adjustColor(false, adjPercent);

    if (undefined === alpha)
      alpha = this.getAlpha();

    const darker = ColorDef.fromHSV(darkerHSV); darker.setAlpha(alpha);
    const bright = ColorDef.fromHSV(brightHSV); bright.setAlpha(alpha);

    if (bright.getRgb() === other.getRgb()) // Couldn't adjust brighter...
      return darker;

    if (darker.getRgb() === other.getRgb()) // Couldn't adjust darker...
      return bright;

    // NOTE: Best choice is the one most visible against the other color...
    return (bright.visibilityCheck(other) >= darker.visibilityCheck(other)) ? bright : darker;
  }

  /** True if the value of this ColorDef is the same as another ColorDef. */
  public equals(other: ColorDef): boolean { return this._tbgr === other._tbgr; }
  /** A black frozen ColorDef. */
  public static readonly black = new ColorDef(ColorByName.black);
  /** A white frozen ColorDef. */
  public static readonly white = new ColorDef(ColorByName.white);
  /** A red frozen ColorDef. */
  public static readonly red = new ColorDef(ColorByName.red);
  /** A green frozen ColorDef. */
  public static readonly green = new ColorDef(ColorByName.green);
  /** A blue frozen ColorDef. */
  public static readonly blue = new ColorDef(ColorByName.blue);
}
Object.freeze(ColorDef.black);
Object.freeze(ColorDef.white);
Object.freeze(ColorDef.red);
Object.freeze(ColorDef.green);
Object.freeze(ColorDef.blue);

/** An immutable representation of a color with red, green, and blue components each in the integer range [0, 255]. */
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
  public equals(other: RgbColor): boolean { return this.r === other.r && this.g === other.g && this.b === other.b; }
  /** Constructs from the red, green, and blue components of a ColorDef. The alpha component is ignored. */
  public static fromColorDef(colorDef: ColorDef): RgbColor {
    const colors = colorDef.colors;
    return new RgbColor(colors.r, colors.g, colors.b);
  }
}
