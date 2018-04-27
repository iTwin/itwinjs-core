/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";

function assertComponent(c: number) { assert(1.0 >= c && 0.0 <= c); }
function assertRgb(rgb: FloatRgb) {
  assertComponent(rgb.red);
  assertComponent(rgb.green);
  assertComponent(rgb.blue);
}
function assertRgba(rgba: FloatRgba) {
  assertRgb(rgba);
  assertComponent(rgba.alpha);
}

/** An RGB color with components in the range [0, 1]. */
export class FloatRgb {
  public readonly red: number;
  public readonly green: number;
  public readonly blue: number;

  /** Construct from red, green, and blue components. */
  public constructor(red: number, green: number, blue: number) {
    this.red = red;
    this.green = green;
    this.blue = blue;

    assertRgb(this);
  }

  /** Create a FloatRgb using a ColorDef. */
  public static fromColorDef(def: ColorDef) {
    const c = def.colors;
    return new FloatRgb(c.r / 255.0, c.g / 255.0, c.b / 255.0);
  }
}

/** An RGBA color with components in the range [0, 1]. */
export class FloatRgba {
  public readonly red: number;
  public readonly green: number;
  public readonly blue: number;
  public readonly alpha: number;

  /** Construct a FloatRgba from red, green, blue, and alpha components */
  public constructor(red: number, green: number, blue: number, alpha: number) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;

    assertRgba(this);
  }

  /** Return whether or not the FloatRgba is translucent.
   * @returns if the FloatRgba has translucency.
   */
  public get hasTranslucency(): boolean { return 1.0 !== this.alpha; }

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
   * @returns Returns the newly created FloatRgba
   */
  public static fromColorDef(def: ColorDef): FloatRgba {
    const c = def.colors;
    return new FloatRgba(c.r / 255.0, c.g / 255.0, c.b / 255.0, (255.0 - c.t) / 255.0);
  }

  /** Return whether or not the two FloatRgbas are equal.
   * @returns a boolean indicating if the two FloatRgbas are equal.
   */
  public equals(rhs: FloatRgba): boolean {
    return this.red === rhs.red && this.green === rhs.green && this.blue === rhs.blue && this.alpha === rhs.alpha;
  }
}

/** An RGBA color with  with components in the range [0, 1], wherein the red, green, and blue components are pre-multiplied by the alpha component. */
export class FloatPreMulRgba {
  public readonly red: number;
  public readonly green: number;
  public readonly blue: number;
  public readonly alpha: number;

  /** Return whether or not the FloatPreMulRgba is translucent.
   * @returns if the FloatPreMulRgba has translucency.
   */
  public get hasTranslucency(): boolean { return 1.0 !== this.alpha; }

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

  /** Return whether or not the two FloatPreMulRgbas are equal.
   * @returns a boolean indicating if the two FloatPreMulRgbas are equal.
   */
  public equals(rhs: FloatPreMulRgba): boolean {
    return this.red === rhs.red && this.green === rhs.green && this.blue === rhs.blue && this.alpha === rhs.alpha;
  }

  private constructor(r: number, g: number, b: number, a: number) {
    this.red = r;
    this.green = g;
    this.blue = b;
    this.alpha = a;

    assertRgba(this);
  }
}
