/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { assert } from "@bentley/bentleyjs-core";
import {
  Angle,
  AngleProps,
  Range1d,
} from "@bentley/geometry-core";
import {
  ImageBuffer,
  ImageBufferFormat,
} from "./Image";
import {
  ColorDef,
  ColorDefProps,
} from "./ColorDef";

/** @beta */
export namespace Gradient {
  /** Flags applied to a [[Gradient.Symb]]. */
  export enum Flags {
    /** No flags. */
    None = 0,
    /** Reverse the order of the gradient keys. */
    Invert = 1,
    /** Draw an outline around the surface to which the gradient is applied. */
    Outline = 2,
  }

  /** Enumerates the modes by which a [[Gradient.Symb]]'s keys are applied to create an image. */
  export enum Mode {
    None = 0,
    Linear = 1,
    Curved = 2,
    Cylindrical = 3,
    Spherical = 4,
    Hemispherical = 5,
    /** @beta */
    Thematic = 6,
  }

  /** @beta */
  export enum ThematicMode {
    Smooth = 0,
    Stepped = 1,
    SteppedWithDelimiter = 2,
    IsoLines = 3,
  }

  /** @beta */
  export enum ThematicColorScheme {
    BlueRed = 0,
    RedBlue = 1,
    Monochrome = 2,
    Topographic = 3,
    SeaMountain = 4,
    Custom = 5,
  }

  /** @beta */
  export interface ThematicSettingsProps {
    mode: ThematicMode;
    stepCount: number;
    marginColor: ColorDefProps;
    colorScheme: ThematicColorScheme;
    rangeLow: number;
    rangeHigh: number;
  }

  /** Gradient settings specific to thematic mesh display
   * @beta
   */
  export class ThematicSettings implements ThematicSettingsProps {
    public mode: ThematicMode = ThematicMode.Smooth;
    public stepCount: number = 10;
    public marginColor: ColorDef = ColorDef.from(0x3f, 0x3f, 0x3f);
    public colorScheme: ThematicColorScheme = ThematicColorScheme.BlueRed;
    public rangeLow: number = 1.0E200;
    public rangeHigh: number = -1.0E200;
    public get range() { return (this.rangeLow > this.rangeHigh) ? Range1d.createNull() : Range1d.createXX(this.rangeLow, this.rangeHigh); }
    public set range(range: Range1d) { this.rangeLow = range.low; this.rangeHigh = range.high; }
    public static defaults = new ThematicSettings();
    public static get margin(): number { return .001; }    // A fixed portion of the gradient for out of range values.
    public static get contentRange(): number { return 1.0 - 2.0 * ThematicSettings.margin; }
    public static get contentMax(): number { return 1.0 - ThematicSettings.margin; }

    public static fromJSON(json: ThematicSettingsProps) {
      const result = new ThematicSettings();
      result.mode = json.mode;
      result.stepCount = json.stepCount;
      result.marginColor = new ColorDef(json.marginColor);
      result.colorScheme = json.colorScheme;
      result.rangeLow = json.rangeLow;
      result.rangeHigh = json.rangeHigh;
      return result;
    }

    public toJSON(): ThematicSettingsProps {
      return {
        mode: this.mode,
        stepCount: this.stepCount,
        marginColor: this.marginColor.toJSON(),
        colorScheme: this.colorScheme,
        rangeLow: this.rangeLow,
        rangeHigh: this.rangeHigh,
      };
    }

    public clone(out?: ThematicSettings): ThematicSettings {
      const result = undefined !== out ? out : new ThematicSettings();
      result.copyFrom(this);
      return result;
    }

    public copyFrom(other: ThematicSettingsProps): void {
      this.mode = other.mode;
      this.stepCount = other.stepCount;
      this.marginColor = new ColorDef(other.marginColor);
      this.colorScheme = other.colorScheme;
      this.rangeLow = other.rangeLow;
      this.rangeHigh = other.rangeHigh;
    }
  }

  /** Gradient fraction value to [[ColorDef]] pair */
  export interface KeyColorProps {
    /** Fraction from 0.0 to 1.0 to denote position along gradient */
    value: number;
    /** Color value for given fraction */
    color: ColorDefProps;
  }

  /** Gradient fraction value to [[ColorDef]] pair
   * @see [[Gradient.KeyColorProps]]
   */
  export class KeyColor implements KeyColorProps {
    public value: number;
    public color: ColorDef;
    public constructor(json: KeyColorProps) {
      this.value = json.value;
      this.color = new ColorDef(json.color);
    }
  }

  /** Multi-color area fill defined by a range of colors that vary by position */
  export interface SymbProps {
    /** Gradient type, must be set to something other than [[Gradient.Mode.None]] to display fill */
    mode: Mode;
    /** Gradient flags to enable outline display and invert color fractions, Flags.None if undefined */
    flags?: Flags;
    /** Gradient rotation angle, 0.0 if undefined */
    angle?: AngleProps;
    /** Gradient tint value from 0.0 to 1.0, only used when [[Gradient.KeyColorProps]] size is 1, 0.0 if undefined */
    tint?: number;
    /** Gradient shift value from 0.0 to 1.0, 0.0 if undefined */
    shift?: number;
    /** Gradient fraction value/color pairs, 1 minimum (uses tint for 2nd color), 8 maximum */
    keys: KeyColorProps[];
    /** Settings applicable to meshes and Gradient.Mode.Thematic only
     * @beta
     */
    thematicSettings?: ThematicSettingsProps;
  }

  /** Multi-color area fill defined by a range of colors that vary by position.
   * Gradient fill can be applied to planar regions.
   * @see [[Gradient.SymbProps]]
   */
  export class Symb implements SymbProps {
    public mode = Mode.None;
    public flags: Flags = Flags.None;
    public angle?: Angle;
    public tint?: number;
    public shift: number = 0;
    /** @beta */
    public thematicSettings?: ThematicSettings;
    public keys: KeyColor[] = [];

    /** create a GradientSymb from a json object. */
    public static fromJSON(json?: SymbProps) {
      const result = new Symb();
      if (!json)
        return result;
      result.mode = json.mode;
      result.flags = (json.flags === undefined) ? Flags.None : json.flags;
      result.angle = json.angle ? Angle.fromJSON(json.angle) : undefined;
      result.tint = json.tint;
      result.shift = json.shift ? json.shift : 0;
      json.keys.forEach((key) => result.keys.push(new KeyColor(key)));
      result.thematicSettings = (json.thematicSettings === undefined) ? undefined : ThematicSettings.fromJSON(json.thematicSettings);

      return result;
    }

    /** @beta */
    public static createThematic(settings: ThematicSettings) {
      const result = new Symb();
      result.mode = Mode.Thematic;
      result.thematicSettings = settings;

      if (settings.colorScheme < ThematicColorScheme.Custom) {
        const fixedSchemeKeys = [[[0.0, 0, 255, 0], [0.25, 0, 255, 255], [0.5, 0, 0, 255], [0.75, 255, 0, 255], [1.0, 255, 0, 0]],  // Blue Red.
        [[0.0, 255, 0, 0], [0.25, 255, 0, 255], [0.5, 0, 0, 255], [0.75, 0, 255, 255], [1.0, 0, 255, 0]], // Red blue.
        [[0.0, 0, 0, 0], [1.0, 255, 255, 255]], // Monochrome.
        [[0.0, 152, 148, 188], [0.5, 204, 160, 204], [1.0, 152, 72, 128]], // Based off of the topographic gradients in Point Clouds.
        [[0.0, 0, 255, 0], [0.2, 72, 96, 160], [0.4, 152, 96, 160], [0.6, 128, 32, 104], [0.7, 148, 180, 128], [1.0, 240, 240, 240]]]; // Based off of the sea-mountain gradient in Point Clouds.

        for (const keyValue of fixedSchemeKeys[settings.colorScheme])
          result.keys.push(new KeyColor({ value: keyValue[0], color: ColorDef.from(keyValue[1], keyValue[3], keyValue[2]) }));
      }
      return result;
    }
    public clone(): Symb {
      return Symb.fromJSON(this);
    }

    /** Returns true if this symbology is equal to another, false otherwise. */
    public equals(other: Symb): boolean {
      return Symb.compareSymb(this, other) === 0;
    }

    /** Compares two gradient symbologies. Used for ordering Gradient.Symb objects.
     * @param lhs First gradient to compare
     * @param rhs Second gradient to compare
     * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
     */
    public static compareSymb(lhs: Gradient.Symb, rhs: Gradient.Symb): number {
      if (lhs === rhs)
        return 0; // Same pointer
      if (lhs.mode !== rhs.mode)
        return lhs.mode - rhs.mode;
      if (lhs.flags !== rhs.flags)
        if (lhs.flags === undefined)
          return -1;
        else if (rhs.flags === undefined)
          return 1;
        else
          return lhs.flags - rhs.flags;
      if (lhs.tint !== rhs.tint)
        if (lhs.tint === undefined)
          return -1;
        else if (rhs.tint === undefined)
          return 1;
        else
          return lhs.tint - rhs.tint;
      if (lhs.shift !== rhs.shift)
        if (lhs.shift === undefined)
          return -1;
        else if (rhs.shift === undefined)
          return 1;
        else
          return lhs.shift - rhs.shift;
      if ((lhs.angle === undefined) !== (rhs.angle === undefined))
        if (lhs.angle === undefined)
          return -1;
        else
          return 1;
      if (lhs.angle && !lhs.angle.isAlmostEqualNoPeriodShift(rhs.angle!))
        return lhs.angle.radians - rhs.angle!.radians;
      if (lhs.keys.length !== rhs.keys.length)
        return lhs.keys.length - rhs.keys.length;
      for (let i = 0; i < lhs.keys.length; i++) {
        if (lhs.keys[i].value !== rhs.keys[i].value)
          return lhs.keys[i].value - rhs.keys[i].value;
        if (!lhs.keys[i].color.equals(rhs.keys[i].color))
          return lhs.keys[i].color.tbgr - rhs.keys[i].color.tbgr;
      }
      return 0;
    }

    /** Compare this symbology to another.
     * @see [[Gradient.Symb.compareSymb]]
     */
    public compare(other: Symb): number {
      return Gradient.Symb.compareSymb(this, other);
    }

    /**
     * Ensure the value given is within the range of 0 to 255,
     * and truncate the value to only the 8 least significant bits.
     */
    private roundToByte(num: number): number {
      return Math.min(num + .5, 255.0) & 0xFF;
    }

    /** Maps a value to an RGBA value adjusted from a color present in this symbology's array. */
    public mapColor(value: number) {
      if (value < 0)
        value = 0;
      else if (value > 1)
        value = 1;

      if ((this.flags & Flags.Invert) !== 0)
        value = 1 - value;

      let idx = 0;
      let d;
      let w0;
      let w1;
      if (this.keys.length <= 2) {
        w0 = 1.0 - value;
        w1 = value;
      } else {  // locate value in map, blend corresponding colors
        while (idx < (this.keys.length - 2) && value > this.keys[idx + 1].value)
          idx++;

        d = this.keys[idx + 1].value - this.keys[idx].value;
        w1 = d < 0.0001 ? 0.0 : (value - this.keys[idx].value) / d;
        w0 = 1.0 - w1;
      }

      const color0 = this.keys[idx].color;
      const color1 = this.keys[idx + 1].color;
      const colors0 = color0.colors;
      const colors1 = color1.colors;
      const red = w0 * colors0.r + w1 * colors1.r;
      const green = w0 * colors0.g + w1 * colors1.g;
      const blue = w0 * colors0.b + w1 * colors1.b;
      const transparency = w0 * colors0.t + w1 * colors1.t;

      return ColorDef.from(this.roundToByte(red), this.roundToByte(green), this.roundToByte(blue), this.roundToByte(transparency));
    }

    public get hasTranslucency(): boolean {
      for (const key of this.keys) {
        if (!key.color.isOpaque)
          return true;
      }

      return false;
    }

    /** Returns true if the [[Gradient.Flags.Outline]] flag is set. */
    public get isOutlined(): boolean { return 0 !== (this.flags & Flags.Outline); }

    /** Applies this gradient's settings to produce a bitmap image. */
    public getImage(width: number, height: number): ImageBuffer {
      if (this.mode === Mode.Thematic) {
        width = 1;
        height = 8192;    // Thematic image height
      }

      const hasAlpha = this.hasTranslucency;
      const thisAngle = (this.angle === undefined) ? 0 : this.angle.radians;
      const cosA = Math.cos(thisAngle);
      const sinA = Math.sin(thisAngle);
      const image = new Uint8Array(width * height * (hasAlpha ? 4 : 3));
      let currentIdx = image.length - 1;
      const shift = Math.min(1.0, Math.abs(this.shift));

      switch (this.mode) {
        case Mode.Linear:
        case Mode.Cylindrical: {
          const xs = 0.5 - 0.25 * shift * cosA;
          const ys = 0.5 - 0.25 * shift * sinA;
          let dMax;
          let dMin = dMax = 0.0;
          let d;
          for (let j = 0; j < 2; j++) {
            for (let i = 0; i < 2; i++) {
              d = (i - xs) * cosA + (j - ys) * sinA;
              if (d < dMin)
                dMin = d;
              if (d > dMax)
                dMax = d;
            }
          }
          for (let j = 0; j < height; j++) {
            const y = j / height - ys;
            for (let i = 0; i < width; i++) {
              const x = i / width - xs;
              d = x * cosA + y * sinA;
              let f;
              if (this.mode === Mode.Linear) {
                if (d > 0)
                  f = 0.5 + 0.5 * d / dMax;
                else
                  f = 0.5 - 0.5 * d / dMin;
              } else {
                if (d > 0)
                  f = Math.sin(Math.PI / 2 * (1.0 - d / dMax));
                else
                  f = Math.sin(Math.PI / 2 * (1.0 - d / dMin));
              }
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Curved: {
          const xs = 0.5 + 0.5 * sinA - 0.25 * shift * cosA;
          const ys = 0.5 - 0.5 * cosA - 0.25 * shift * sinA;
          for (let j = 0; j < height; j++) {
            const y = j / height - ys;
            for (let i = 0; i < width; i++) {
              const x = i / width - xs;
              const xr = 0.8 * (x * cosA + y * sinA);
              const yr = y * cosA - x * sinA;
              const f = Math.sin(Math.PI / 2 * (1 - Math.sqrt(xr * xr + yr * yr)));
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Spherical: {
          const r = 0.5 + 0.125 * Math.sin(2.0 * thisAngle);
          const xs = 0.5 * shift * (cosA + sinA) * r;
          const ys = 0.5 * shift * (sinA - cosA) * r;
          for (let j = 0; j < height; j++) {
            const y = ys + j / height - 0.5;
            for (let i = 0; i < width; i++) {
              const x = xs + i / width - 0.5;
              const f = Math.sin(Math.PI / 2 * (1.0 - Math.sqrt(x * x + y * y) / r));
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Hemispherical: {
          const xs = 0.5 + 0.5 * sinA - 0.5 * shift * cosA;
          const ys = 0.5 - 0.5 * cosA - 0.5 * shift * sinA;
          for (let j = 0; j < height; j++) {
            const y = j / height - ys;
            for (let i = 0; i < width; i++) {
              const x = i / width - xs;
              const f = Math.sin(Math.PI / 2 * (1.0 - Math.sqrt(x * x + y * y)));
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Thematic: {
          let settings = this.thematicSettings;
          if (settings === undefined) {
            settings = ThematicSettings.defaults;
          }

          // TBD - Stepped and isolines...
          for (let j = 0; j < height; j++) {
            let f = 1 - j / height;
            let color: ColorDef;

            if (f < ThematicSettings.margin || f > ThematicSettings.contentMax) {
              color = settings.marginColor;
            } else {
              f = (f - ThematicSettings.margin) / (ThematicSettings.contentRange);
              switch (settings.mode) {
                case ThematicMode.SteppedWithDelimiter:
                case ThematicMode.Stepped: {
                  if (settings.stepCount !== 0) {
                    const fStep = Math.floor(f * settings.stepCount + .99999) / settings.stepCount;
                    const delimitFraction = 1 / 1024;
                    if (settings.mode === ThematicMode.SteppedWithDelimiter && Math.abs(fStep - f) < delimitFraction)
                      color = new ColorDef(0xff000000);
                    else
                      color = this.mapColor(fStep);
                  }
                  break;
                }
                case ThematicMode.Smooth:
                  color = this.mapColor(f);
                  break;
              }
            }
            for (let i = 0; i < width; i++) {
              if (hasAlpha)
                image[currentIdx--] = color!.getAlpha();

              image[currentIdx--] = color!.colors.b;
              image[currentIdx--] = color!.colors.g;
              image[currentIdx--] = color!.colors.r;
            }
          }
        }
      }

      assert(-1 === currentIdx);
      const imageBuffer = ImageBuffer.create(image, hasAlpha ? ImageBufferFormat.Rgba : ImageBufferFormat.Rgb, width);
      assert(undefined !== imageBuffer);
      return imageBuffer!;
    }
  }
}
