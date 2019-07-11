/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { UniformHandle } from "./Handle";

function assertComponent(c: number) { assert(1.0 >= c && 0.0 <= c); }
function assertRgba(rgba: Rgba) {
  assertComponent(rgba.red);
  assertComponent(rgba.green);
  assertComponent(rgba.blue);
  assertComponent(rgba.alpha);
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

const floatPreMulRgbaColorDef = ColorDef.white.clone();

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

  public static fromFloatRgba(rgba: FloatRgba): FloatPreMulRgba {
    const premul = new FloatPreMulRgba();
    premul.setFromFloatRgba(rgba);
    return premul;
  }

  public setFromFloatRgba(rgba: FloatRgba) {
    const def = rgba.toColorDef(floatPreMulRgbaColorDef);
    this.setFromColorDef(def);
  }
}

function scale(norm: number): number {
  assertComponent(norm);
  return Math.floor(norm * 255 + 0.5);
}

function computeTbgr(r: number, g: number, b: number, a: number): number {
  r = scale(r);
  g = scale(g);
  b = scale(b);
  const t = scale(1.0 - a);

  const tbgr = r | (g << 8) | (b << 16) | (t << 24);
  return tbgr >>> 0; // triple shift removes sign
}

const floatColorDef = ColorDef.white.clone();
export abstract class FloatColor {
  protected readonly _components: Float32Array;
  private _tbgr: number;

  protected constructor(numComponents: number) {
    this._components = new Float32Array(numComponents);
    this._tbgr = 0;
  }

  protected abstract maskTbgr(tbgr: number): number;
  protected abstract setComponents(r: number, g: number, b: number, a: number): void;

  public get red() { return this._components[0]; }
  public get green() { return this._components[1]; }
  public get blue() { return this._components[2]; }
  public get tbgr() { return this._tbgr; }
  public get isWhite() { return 1.0 === this.red && 1.0 === this.green && 1.0 === this.blue; }

  public setColorDef(def: ColorDef) {
    this.setTbgr(def.tbgr);
  }

  public setTbgr(tbgr: number) {
    tbgr = this.maskTbgr(tbgr);
    if (tbgr === this.tbgr)
      return;

    floatColorDef.tbgr = tbgr;
    const c = floatColorDef.colors;
    this.setComponents(c.r / 255, c.g / 255, c.b / 255, 1.0 - c.t / 255);
    this._tbgr = tbgr;
  }

  protected setRgbComponents(r: number, g: number, b: number): void {
    this._components[0] = r;
    this._components[1] = g;
    this._components[2] = b;
  }

  protected setRgbaComponents(r: number, g: number, b: number, a: number): void {
    this._tbgr = this.maskTbgr(computeTbgr(r, g, b, a));
    this.setComponents(r, g, b, a);
  }

  public toColorDef(out?: ColorDef): ColorDef {
    if (undefined === out)
      out = new ColorDef(this.tbgr);
    else
      out.tbgr = this.tbgr;

    return out;
  }
}

export class FloatRgb extends FloatColor {
  public constructor() {
    super(3);
  }

  protected maskTbgr(tbgr: number) {
    return (tbgr & 0x00ffffff) >>> 0;
  }

  protected setComponents(r: number, g: number, b: number, _a: number) {
    this.setRgbComponents(r, g, b);
  }

  public set(r: number, g: number, b: number) {
    this.setRgbaComponents(r, g, b, 1);
  }

  public bind(uniform: UniformHandle): void {
    uniform.setUniform3fv(this._components);
  }

  public static fromColorDef(def: ColorDef): FloatRgb {
    return FloatRgb.fromTbgr(def.tbgr);
  }

  public static from(r: number, g: number, b: number): FloatRgb {
    const rgb = new FloatRgb();
    rgb.set(r, g, b);
    return rgb;
  }

  public static fromTbgr(tbgr: number): FloatRgb {
    const rgb = new FloatRgb();
    rgb.setTbgr(tbgr);
    return rgb;
  }
}

export class FloatRgba extends FloatColor {
  public constructor() {
    super(4);
    this._components[3] = 1.0;
  }

  protected maskTbgr(tbgr: number) {
    return tbgr;
  }

  protected setComponents(r: number, g: number, b: number, a: number) {
    this.setRgbComponents(r, g, b);
    this._components[3] = a;
  }

  public set(r: number, g: number, b: number, a: number) {
    this.setRgbaComponents(r, g, b, a);
  }

  public get alpha(): number { return this._components[3]; }
  public get hasTranslucency(): boolean { return 1.0 !== this.alpha; }

  public bind(uniform: UniformHandle): void {
    uniform.setUniform4fv(this._components);
  }

  public static fromColorDef(def: ColorDef): FloatRgba {
    return FloatRgba.fromTbgr(def.tbgr);
  }

  public static fromTbgr(tbgr: number): FloatRgba {
    const rgba = new FloatRgba();
    rgba.setTbgr(tbgr);
    return rgba;
  }

  public static from(r: number, g: number, b: number, a: number): FloatRgba {
    const rgba = new FloatRgba();
    rgba.set(r, g, b, a);
    return rgba;
  }
}
