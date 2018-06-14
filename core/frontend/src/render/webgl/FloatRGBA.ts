/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ColorDef } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { UniformHandle } from "./Handle";

function assertComponent(c: number) { assert(1.0 >= c && 0.0 <= c); }
function assertRgb(rgb: FloatRgb) {
  assertComponent(rgb.red);
  assertComponent(rgb.green);
  assertComponent(rgb.blue);
}
function assertRgba(rgba: Rgba) {
  assertComponent(rgba.red);
  assertComponent(rgba.green);
  assertComponent(rgba.blue);
  assertComponent(rgba.alpha);
}

/** An RGB color with components in the range [0, 1]. */
export class FloatRgb {
  private readonly _value = new Float32Array(3);

  /** Construct from red, green, and blue components. */
  public constructor(red: number, green: number, blue: number) {
    this._value[0] = red;
    this._value[1] = green;
    this._value[2] = blue;

    assertRgb(this);
  }

  /** Create a FloatRgb using a ColorDef. */
  public static fromColorDef(def: ColorDef) {
    const c = def.colors;
    return new FloatRgb(c.r / 255.0, c.g / 255.0, c.b / 255.0);
  }

  public get red() { return this._value[0]; }
  public get green() { return this._value[1]; }
  public get blue() { return this._value[2]; }

  public bind(uniform: UniformHandle): void { uniform.setUniform3fv(this._value); }
}

export class Rgba {
  private readonly _value = new Float32Array(4);

  public get red() { return this._value[0]; }
  public get green() { return this._value[1]; }
  public get blue() { return this._value[2]; }
  public get alpha() { return this._value[3]; }

  public get hasTranslucency(): boolean { return 1.0 !== this.alpha; }

  public equals(rhs: Rgba): boolean {
    return this.red === rhs.red && this.green === rhs.green && this.blue === rhs.blue && this.alpha === rhs.alpha;
  }

  public bind(uniform: UniformHandle): void { uniform.setUniform4fv(this._value); }

  protected constructor(r: number, g: number, b: number, a: number) {
    this._value[0] = r;
    this._value[1] = g;
    this._value[2] = b;
    this._value[3] = a;

    assertRgba(this);
  }
}

/** An RGBA color with components in the range [0, 1]. */
export class FloatRgba extends Rgba {
  /** Construct a FloatRgba from red, green, blue, and alpha components */
  public constructor(red: number, green: number, blue: number, alpha: number) {
    super(red, green, blue, alpha);
  }

  /** Produce a FloatRgba from a FloatPreMulRgba by reversing the pre-multiplication */
  public static fromPreMulRgba(src: FloatPreMulRgba): FloatRgba {
    const f = 0.0 !== src.alpha ? 1.0 / src.alpha : 0.0;
    return new FloatRgba(src.red * f, src.green * f, src.blue * f, src.alpha);
  }

  /** Create a FloatRgba using a FloatRgb.
   * @param rgb A FloatRgb used to set the red, green, and blue variables in the new FloatRgba.
   * @param alpha A Number used to set the alpha variable in the new FloatRgba.
   * @returns Returns the newly created FloatRgba
   */
  public static fromRgb(rgb: FloatRgb, alpha: number = 1.0): FloatRgba {
    return new FloatRgba(rgb.red, rgb.green, rgb.blue, alpha);
  }

  /** Create a FloatRgba using a ColorDef.
   * @param def A ColorDef used to create a new FloatRgba.
   * @param transparency Optionally overrides the transparency value (0-255) specified by the ColorDef.
   * @returns Returns the newly created FloatRgba
   */
  public static fromColorDef(def: ColorDef, transparency?: number): FloatRgba {
    const c = def.colors;
    if (undefined !== transparency) {
      c.t = transparency;
    }

    return new FloatRgba(c.r / 255.0, c.g / 255.0, c.b / 255.0, (255.0 - c.t) / 255.0);
  }

  /** Create a FloatRgba using a ColorDef and an alpha value..
   * @param def A ColorDef used to create a new FloatRgba. Its transparency value is ignored.
   * @param alpha Alpha value from 0.0 (transparent) to 1.0 (opaque)
   * @returns Returns the newly created FloatRgba
   */
  public static fromColorDefAndAlpha(def: ColorDef, alpha: number): FloatRgba {
    const c = def.colors;
    return new FloatRgba(c.r / 255.0, c.g / 255.0, c.b / 255.0, alpha);
  }
}

/** An RGBA color with  with components in the range [0, 1], wherein the red, green, and blue components are pre-multiplied by the alpha component. */
export class FloatPreMulRgba extends Rgba {
  /** Create a FloatPreMulRgba using a ColorDef.
   * @param src A FloatRgba used to create a new FloatPreMulRgba.
   * @returns Returns the newly created FloatPreMulRgba
   */
  public static fromRgba(src: FloatRgba): FloatPreMulRgba {
    return new FloatPreMulRgba(src.red * src.alpha, src.green * src.alpha, src.blue * src.alpha, src.alpha);
  }

  /** Create a FloatPreMulRgba using a ColorDef.
   * @param src A ColorDef used to create a new FloatPreMulRgba.
   * @returns Returns the newly created FloatPreMulRgba
   */
  public static fromColorDef(src: ColorDef): FloatPreMulRgba {
    const c = src.colors;
    const a = (255.0 - c.t) / 255.0;
    return new FloatPreMulRgba(c.r * a / 255.0, c.g * a / 255.0, c.b * a / 255.0, a);
  }

  private constructor(r: number, g: number, b: number, a: number) {
    super(r, g, b, a);
  }
}
