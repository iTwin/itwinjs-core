/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ColorDef } from "../Render";
import { DgnFB } from "./ElementGraphicsSchema";

export const enum GradientSymbFlags {
  None = 0,
  Invert = 1,
  Outline = (1 << 1),
  Deprecated = (1 << 2),    // < Was AlwaysFilled, now controlled by FillDisplay...
}

/** Parameters defining a gradient */
export class GradientSymb {
  public static readonly MAX_GRADIENT_KEYS: number = 8;
  private _mode: DgnFB.GradientMode = DgnFB.GradientMode.None;
  private _flags: GradientSymbFlags = GradientSymbFlags.None;
  private _nKeys: number = 0;
  private _angle: number = 0.0;
  private _tint: number = 0.0;
  private _shift: number = 0.0;
  private _colors: ColorDef[];
  private _values: number[];

  /** Stores the color definition at that index in the variable given, and returns the value at that index. */
  public getKey(idx: number, color: ColorDef): number { color.fromRgb(this._colors[idx].getRgb()); return this._values[idx]; }
  public get nKeys() { return this._nKeys; }
  public get mode() { return this._mode; }
  public get flags() { return this._flags; }
  public get shift() { return this._shift; }
  public get tint() { return this._tint; }
  public get angle() { return this._angle; }

  public setMode(mode: DgnFB.GradientMode) { this._mode = mode; }
  public setFlags(flags: number) { this._flags = flags; }
  public setShift(shift: number) { this._shift = shift; }
  public setTint(tint: number) { this._tint = tint; }
  public setAngle(angle: number) { this._angle = angle; }
  public setKeys(nKeys: number, colors: ColorDef[], values: number[]) {
    this._nKeys = nKeys > GradientSymb.MAX_GRADIENT_KEYS ? GradientSymb.MAX_GRADIENT_KEYS : nKeys;
    this._colors.length = 0;
    this._values.length = 0;
    for (let i = 0; i < nKeys; i++) {
      this._colors.push(colors[i]);
      this._values.push(values[i]);
    }
  }

  private constructor() {
    this._colors = [];
    this._values = [];
  }

  public static createDefaults() {
    return new GradientSymb();
  }

  public clone(): GradientSymb {
    const retVal = new GradientSymb();
    retVal._mode = this._mode;
    retVal._flags = this._flags;
    retVal._nKeys = this._nKeys;
    retVal._angle = this._angle;
    retVal._tint = this._tint;
    retVal._shift = this._shift;
    for (let i = 0; i < this._colors.length; i++)
      retVal._colors[i] = new ColorDef(this._colors[i]);
    for (let i = 0; i < this._values.length; i++)
      retVal._values[i] = this._values[i];
    return retVal;
  }

  public isEqualTo(other: GradientSymb): boolean {
    if (this === other)
      return true;     // Same pointer
    if (this._mode !== other._mode)
      return false;
    if (this._flags !== other._flags)
      return false;
    if (this._nKeys !== other._nKeys)
      return false;
    if (this._angle !== other._angle)
      return false;
    if (this._tint !== other._tint)
      return false;
    if (this._shift !== other._shift)
      return false;

    const nKeys = this._nKeys > GradientSymb.MAX_GRADIENT_KEYS ? GradientSymb.MAX_GRADIENT_KEYS : this._nKeys;
    for (let i = 0; i < nKeys; ++i) {
      if (other._values[i] !== this._values[i])
        return false;
      if (!other._colors[i].equals(this._colors[i]))
        return false;
    }
    return true;
  }
}
