/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common/lib/ColorDef";

/** An RGB color. */
export class FloatRgb {
  public red = 0;
  public green = 0;
  public blue = 0;

  /** Create a FloatRgb using a ColorDef.
   * @param def A ColorDef used to create a new FloatRgb.
   * @returns Returns the newly created FloatRgb
   */
  public static fromColorDef(def: ColorDef): FloatRgb {
    const rgb: FloatRgb = new FloatRgb();
    rgb.initFromColorDef(def);
    return rgb;
  }

  /** Initialize a FloatRgb using a ColorDef.
   * @param def A ColorDef used to create a new FloatRgb.
   */
  public initFromColorDef(def: ColorDef): void {
    const colors = def.getColors();
    this.red = colors.r / 255.0;
    this.green = colors.g / 255.0;
    this.blue = colors.b / 255.0;
  }
}

/** An RGBA color. */
export class FloatRgba {
  public red = 0;
  public green = 0;
  public blue = 0;
  public alpha = 0;

  /** Return whether or not the FloatRgba is translucent.
   * @returns if the FloatRgba has translucency.
   */
  public hasTranslucency(): boolean {
    return 1.0 === this.alpha;
  }

  /** Create a FloatRgba using a FloatPreMulRgba.
   * @param src A FloatPreMulRgba used to create a new FloatRgba.
   * @returns Returns the newly created FloatRgba
   */
  public static fromPreMulRgba(src: FloatPreMulRgba): FloatRgba {
    const rgba: FloatRgba = new FloatRgba();
    rgba.initFromPreMulRgba(src);
    return rgba;
  }

  /** Create a FloatRgba using a FloatPreMulRgba.
   * @param r A Number used to set the red variable in the new FloatRgba.
   * @param g A Number used to set the green variable in the new FloatRgba.
   * @param b A Number used to set the blue variable in the new FloatRgba.
   * @param a A Number used to set the alpha variable in the new FloatRgba.
   * @returns Returns the newly created FloatRgba
   */
  public static from(r: number, g: number, b: number, a: number): FloatRgba {
    const rgba: FloatRgba = new FloatRgba();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;
    return rgba;
  }

  /** Initialize a FloatRgba using a FloatPreMulRgba.
   * @param preMulRgba A FloatPreMulRgba used to create a new FloatRgba.
   */
  public initFromPreMulRgba(preMulRgba: FloatPreMulRgba): void {
    // !defined(DEBUG_PREMUL_RGBA)
    if (preMulRgba.alpha !== 0.0 && preMulRgba.alpha !== 1.0) {
      this.red = preMulRgba.red / preMulRgba.alpha;
      this.green = preMulRgba.green / preMulRgba.alpha;
      this.blue = preMulRgba.blue / preMulRgba.alpha;
      this.alpha = preMulRgba.alpha;
    } else {
      this.red = preMulRgba.red;
      this.green = preMulRgba.green;
      this.blue = preMulRgba.blue;
      this.alpha = preMulRgba.alpha;
    }
  }

  /** Create a FloatRgba using a FloatRgb.
   * @param rgb A FloatRgb used to set the red, green, and blue variables in the new FloatRgba.
   * @param alpha A Number used to set the alpha variable in the new FloatRgba.
   * @returns Returns the newly created FloatRgba
   */
  public static fromRgb(rgb: FloatRgb, alpha: number = 1.0): FloatRgba {
    return this.from(rgb.red, rgb.green, rgb.blue, alpha);
  }

  /** Initialize a FloatRgba using a ColorDef.
   * @param preMulRgba A ColorDef used to create a new FloatRgba.
   */
  public initFromColorDef(def: ColorDef): void {
    const colors = def.getColors();
    this.red = colors.r / 255.0;
    this.green = colors.g / 255.0;
    this.blue = colors.b / 255.0;
  }

  /** Create a FloatRgba using a ColorDef.
   * @param def A ColorDef used to create a new FloatRgba.
   * @returns Returns the newly created FloatRgba
   */
  public static fromColorDef(def: ColorDef): FloatRgba {
    const rgb: FloatRgba = new FloatRgba();
    rgb.initFromColorDef(def);
    return rgb;
  }

  /** Return whether or not the two FloatRgbas are equal.
   * @returns a boolean indicating if the two FloatRgbas are equal.
   */
  public equals(rhs: FloatRgba): boolean {
    return this.red === rhs.red && this.green === rhs.green && this.blue === rhs.blue && this.alpha === rhs.alpha;
  }
}

/** An RGBA color with pre-multiplied alpha applied. */
export class FloatPreMulRgba {
  public red = 0;
  public green = 0;
  public blue = 0;
  public alpha = 0;

  /** Return whether or not the FloatPreMulRgba is translucent.
   * @returns if the FloatPreMulRgba has translucency.
   */
  public hasTranslucency(): boolean {
    return 1.0 === this.alpha;
  }

  /** Create a FloatPreMulRgba using a ColorDef.
   * @param src A FloatRgba used to create a new FloatPreMulRgba.
   * @returns Returns the newly created FloatPreMulRgba
   */
  public static fromRgba(src: FloatRgba): FloatPreMulRgba {
    const rgba: FloatPreMulRgba = new FloatPreMulRgba();
    rgba.initFromRgba(src);
    return rgba;
  }

  /** Initialize a FloatPreMulRgba using a FloatRgba.
   * @param rgba A FloatRgba used to create a new FloatPreMulRgba.
   */
  public initFromRgba(rgba: FloatRgba): void {
    this.red = rgba.red * rgba.alpha;
    this.green = rgba.green * rgba.alpha;
    this.blue = rgba.blue * rgba.alpha;
    this.alpha = rgba.alpha;

    // if defined DEBUG_PREMUL_RGBA
    // this.red = rgba.red;
    // this.green = rgba.green;
    // this.blue = rgba.blue;
    // this.alpha = rgba.alpha;
  }

  /** Create a FloatPreMulRgba using a ColorDef.
   * @param src A ColorDef used to create a new FloatPreMulRgba.
   * @returns Returns the newly created FloatPreMulRgba
   */
  public static fromColorDef(src: ColorDef): FloatPreMulRgba {
    const rgba: FloatPreMulRgba = new FloatPreMulRgba();
    rgba.initFromColorDef(src);
    return rgba;
  }

  /** Initialize a FloatPreMulRgba using a ColorDef.
   * @param colorDef A FloatRgba used to create a new ColorDef.
   */
  public initFromColorDef(colorDef: ColorDef): void {
    // alpha is actually inverted in ColorDef. 0 means opaque, where in RGBA format 0 means fully transparent.
    const a: number = (255 - colorDef.getAlpha()) / 255.0;

    // if !defined(DEBUG_PREMUL_RGBA)
    const colors = colorDef.getColors();
    this.red = colors.r / 255.0;
    this.green = colors.g / 255.0;
    this.blue = colors.b / 255.0;
    this.alpha = a;

    // if defined(DEBUG_PREMUL_RGBA)
    // const colors = colorDef.getColors();
    // this.red = colors.r;
    // this.green = colors.g;
    // this.blue = colors.b;
    // this.alpha = colorDef.getAlpha();
  }

  /** Return whether or not the two FloatPreMulRgbas are equal.
   * @returns a boolean indicating if the two FloatPreMulRgbas are equal.
   */
  public equals(rhs: FloatPreMulRgba): boolean {
    return this.red === rhs.red && this.green === rhs.green && this.blue === rhs.blue && this.alpha === rhs.alpha;
  }
}
