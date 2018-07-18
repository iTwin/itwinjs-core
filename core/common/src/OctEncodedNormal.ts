/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Vector3d } from "@bentley/geometry-core";
import { assert } from "@bentley/bentleyjs-core";

export class OctEncodedNormal {
  private _value = 0;
  private static isNaN(val: any): boolean { return Number.isNaN(Number.parseFloat(val)); }
  private static toUint16(val: number): number { return new Uint16Array([val])[0]; }
  private static isNumber(val: any): val is number { return !OctEncodedNormal.isNaN(val); }
  public get value(): number { return OctEncodedNormal.toUint16(this._value); }
  constructor(val: number | Vector3d) { this.init(val); }
  public init(val: number | Vector3d) { this._value = OctEncodedNormal.isNumber(val) ? val : OctEncodedNormal.encode(val); }
  public decode(): Vector3d | undefined { return OctEncodedNormal.decode(this.value); }
  public static clamp(val: number, minVal: number, maxVal: number): number {
    return val < minVal ? minVal : (val > maxVal ? maxVal : val);
  }
  public static signNotZero(val: number): number {
    return val < 0.0 ? -1.0 : 1.0;
  }
  public static toUInt16(val: number): number {
    return OctEncodedNormal.toUint16(0.5 + (OctEncodedNormal.clamp(val, -1, 1) * 0.5 + 0.5) * 255);
  }
  public static decode(val: number): Vector3d | undefined {
    let ex = val & 0xff;
    let ey = val >> 8;
    ex = ex / 255.0 * 2.0 - 1.0;
    ey = ey / 255.0 * 2.0 - 1.0;
    const n = new Vector3d(ex, ey, 1 - (Math.abs(ex) + Math.abs(ey)));
    if (n.z < 0) {
      const x = n.x;
      const y = n.y;
      n.x = (1 - Math.abs(y)) * OctEncodedNormal.signNotZero(x);
      n.y = (1 - Math.abs(x)) * OctEncodedNormal.signNotZero(y);
    }
    return n.normalize();
  }
  public static encode(vec: Vector3d): number {
    OctEncodedNormal.verifyNormalized(vec);
    const denom = Math.abs(vec.x) + Math.abs(vec.y) + Math.abs(vec.z);
    let rx = vec.x / denom;
    let ry = vec.y / denom;
    if (vec.z < 0) {
      const x = rx;
      const y = ry;
      rx = (1 - Math.abs(y)) * OctEncodedNormal.signNotZero(x);
      ry = (1 - Math.abs(x)) * OctEncodedNormal.signNotZero(y);
    }
    const value = OctEncodedNormal.toUInt16(ry) << 8 | OctEncodedNormal.toUInt16(rx);
    OctEncodedNormal.verifyEncoded(value, vec);
    return value;
  }
  public static verifyNormalized(vec: Vector3d): void {
    const magSq = vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
    assert(Math.abs(magSq - 1) < 0.001);
  }
  public static verifyEncoded(val: number, inVal: Vector3d): void {
    const enc = new OctEncodedNormal(val);
    const out = enc.decode();
    assert(typeof out !== "undefined" && inVal.isAlmostEqual(out, 0.05));
  }
}

export class Pair<T1, T2> { constructor(public first: T1, public second: T2) { } }

export class OctEncodedNormalPair extends Pair<OctEncodedNormal, OctEncodedNormal> {
  constructor(first: OctEncodedNormal | number | Vector3d, second: OctEncodedNormal | number | Vector3d) {
    super(first instanceof OctEncodedNormal ? first : new OctEncodedNormal(first), second instanceof OctEncodedNormal ? second : new OctEncodedNormal(second));
  }
}
