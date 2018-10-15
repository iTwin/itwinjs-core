/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Numerics */
import { BeJSONFunctions, Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
export class Complex implements BeJSONFunctions {
  private _myX: number;
  set x(value) { this._myX = value; }
  get x() { return this._myX; }

  private _myY: number;
  set y(value) { this._myY = value; }
  get y() { return this._myY; }

  public constructor(x: number = 0, y: number = 0) { this._myX = x; this._myY = y; }
  public set(x: number = 0, y: number = 0): void { this.x = x; this.y = y; }
  public setFrom(other: Complex) { this.x = other.x; this.y = other.y; }
  public clone(): Complex { return new Complex(this.x, this.y); }

  public isAlmostEqual(other: Complex): boolean { return Geometry.isAlmostEqualNumber(this.x, other.x) && Geometry.isAlmostEqualNumber(this.x, other.x); }
  public static create(x: number = 0, y: number = 0, result?: Complex): Complex {
    if (result) {
      result.x = x;
      result.y = y;
      return result;
    }
    return new Complex(x, y);
  }
  public plus(other: Complex, result?: Complex): Complex { return Complex.create(this.x + other.x, this.y + other.y, result); }
  public minus(other: Complex, result?: Complex): Complex { return Complex.create(this.x - other.x, this.y - other.y, result); }
  public times(other: Complex, result?: Complex): Complex {
    return Complex.create(
      this.x * other.x - this.y * other.y,
      this.x * other.y + this.y * other.x,
      result);
  }
  /** multiply {this * x+i*y}. That is, the second Complex value exists via the args without being formally created as an instance. */
  public timesXY(x: number, y: number, result?: Complex): Complex {
    return Complex.create(
      this.x * x - this.y * y,
      this.x * y + this.y * x,
      result);
  }

  public magnitude(): number { return Math.hypot(this.x, this.y); }
  public angle(): Angle { return Angle.createAtan2(this.y, this.x); }
  public distance(other: Complex) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }
  public magnitudeSquared(): number { return this.x * this.x + this.y * this.y; }
  public divide(other: Complex, result?: Complex): Complex | undefined {
    const bb = other.magnitudeSquared();
    if (bb === 0.0)
      return undefined;
    const divbb = 1.0 / bb;
    return Complex.create(
      (this.x * other.x + this.y * other.y) * divbb,
      (this.y * other.x - this.x * other.y) * divbb,
      result);
  }
  public sqrt(result?: Complex): Complex {
    if ((this.x === 0.0) && (this.y === 0.0))
      return Complex.create(0, 0, result);

    const x = Math.abs(this.x);
    const y = Math.abs(this.y);
    let r = 0;
    let w = 0;
    if (x >= y) {
      r = y / x;
      w = Math.sqrt(x) * Math.sqrt(0.5 * (1.0 + Math.sqrt(1.0 + r * r)));
    } else {
      r = x / y;
      w = Math.sqrt(y) * Math.sqrt(0.5 * (r + Math.sqrt(1.0 + r * r)));
    }

    if (this.x >= 0.0) {
      return Complex.create(w, this.y / (2.0 * w), result);
    } else {
      const y1 = (this.y >= 0) ? w : -w;
      return Complex.create(this.y / (2.0 * y1), y1, result);
    }
  }
  public setFromJSON(json?: any): void {
    if (Array.isArray(json) && json.length > 1) {
      this.set(json[0], json[1]);
    } else if (json && json.x && json.y) {
      this.set(json.x, json.y);
    } else {
      this.set(0, 0);
    }
  }
  public static fromJSON(json?: any): Complex { const result = new Complex(); result.setFromJSON(json); return result; }

  /**
   * Convert an Complex to a JSON object.
   * @return {*} [x,y]
   */
  public toJSON(): any { return [this.x, this.y]; }

}
