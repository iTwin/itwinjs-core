/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { ColorDef } from "@bentley/imodeljs-common";
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

/**
 * An RGB color with components in the range [0, 1].
 * @internal
 */
export class FloatRgb {
  private readonly _value = new Float32Array(3);
  private _colorDefValue?: number;

  /** Set from red, green, and blue components, or colorDefValue. */
  protected setValues(red: number, green: number, blue: number, colorDefValue?: number) {
    this._value[0] = red;
    this._value[1] = green;
    this._value[2] = blue;
    this._colorDefValue = colorDefValue;
    assertRgb(this);
  }

  protected constructor() { }

  public setFromColorDef(def: ColorDef) {
    if (this._colorDefValue === def.tbgr)
      return;

    const c = def.colors;
    this.setValues(c.r / 255.0, c.g / 255.0, c.b / 255.0, def.tbgr);
  }

  /** Create a FloatRgb using a ColorDef. */
  public static fromColorDef(def: ColorDef) {
    const rgb = new FloatRgb();
    rgb.setFromColorDef(def);
    return rgb;
  }

  public get red() { return this._value[0]; }
  public get green() { return this._value[1]; }
  public get blue() { return this._value[2]; }
  public get colorDefValue() { return this._colorDefValue; }

  public bind(uniform: UniformHandle): void { uniform.setUniform3fv(this._value); }
}

/** @internal */
export class Rgba {
  private readonly _value = new Float32Array(4);
  protected _colorDefValue?: number;

  protected setValues(r: number, g: number, b: number, a: number, colorDefValue?: number) {
    this._value[0] = r;
    this._value[1] = g;
    this._value[2] = b;
    this._value[3] = a;
    this._colorDefValue = colorDefValue;
    assertRgba(this);
  }

  protected constructor() { }

  public get red() { return this._value[0]; }
  public get green() { return this._value[1]; }
  public get blue() { return this._value[2]; }
  public get alpha() { return this._value[3]; }
  public get colorDefValue() { return this._colorDefValue; }

  public get hasTranslucency(): boolean { return 1.0 !== this.alpha; }

  public equals(rhs: Rgba): boolean {
    return this.colorDefValue === rhs.colorDefValue || (this.red === rhs.red && this.green === rhs.green && this.blue === rhs.blue && this.alpha === rhs.alpha);
  }

  public get isWhite(): boolean {
    return this.red === 1.0 && this.green === 1.0 && this.blue === 1.0;
  }

  public bind(uniform: UniformHandle): void { uniform.setUniform4fv(this._value); }
}

/** @internal */
export class FloatRgba extends Rgba {
  public setFromColorDef(def: ColorDef, transparency?: number) {
    const c = def.colors;
    if (undefined !== transparency) {
      c.t = transparency;
      def = ColorDef.from(c.r, c.g, c.b, c.t);
    }

    if (this._colorDefValue === def.tbgr)
      return;

    this.setValues(c.r / 255.0, c.g / 255.0, c.b / 255.0, (255.0 - c.t) / 255.0, def.tbgr);
  }

  public setFromFloatRgba(rgba: FloatRgba) {
    this.setValues(rgba.red, rgba.green, rgba.blue, rgba.alpha, rgba.colorDefValue);
  }

  /** Create a FloatRgba using a ColorDef. */
  public static fromColorDef(def: ColorDef, transparency?: number) {
    const rgba = new FloatRgba();
    rgba.setFromColorDef(def, transparency);
    return rgba;
  }
}

/**
 * An RGBA color with components in the range [0, 1], wherein the red, green, and blue components are pre-multiplied by the alpha component.
 * @internal
 */
export class FloatPreMulRgba extends Rgba {
  /** Set a FloatPreMulRgba using a ColorDef (premultiplied by alpha).
   * @param def A ColorDef used to create a new FloatPreMulRgba.
   */
  public setFromColorDef(def: ColorDef) {
    if (this._colorDefValue === def.tbgr)
      return;

    const c = def.colors;
    const a = (255.0 - c.t) / 255.0;
    this.setValues(c.r * a / 255.0, c.g * a / 255.0, c.b * a / 255.0, a, def.tbgr);
  }

  /** Create a FloatPreMulRgba using a ColorDef. */
  public static fromColorDef(def: ColorDef) {
    const rgba = new FloatPreMulRgba();
    rgba.setFromColorDef(def);
    return rgba;
  }
}

/**
 * A mutable implementation of a FloatRgb for internal use where changing of values is desirable without requiring allocating a new instance.
 * @internal
 */
export class MutableFloatRgb extends FloatRgb {
  public setRgbValues(red: number, green: number, blue: number) {
    this.setValues(red, green, blue);
  }
  public static fromColorDef(def: ColorDef) {
    const rgb = new MutableFloatRgb();
    rgb.setFromColorDef(def);
    return rgb;
  }
}

/**
 * A mutable implementation of a FloatRgba for internal use where changing of values is desirable without requiring allocating a new instance.
 * @internal
 */
export class MutableFloatRgba extends FloatRgba {
  public setRgbaValues(red: number, green: number, blue: number, alpha: number) {
    this.setValues(red, green, blue, alpha);
  }
  public static fromColorDef(def: ColorDef) {
    const rgb = new MutableFloatRgba();
    rgb.setFromColorDef(def);
    return rgb;
  }
}
