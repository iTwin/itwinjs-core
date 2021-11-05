/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Numerics
 */
import { BeJSONFunctions, Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";

/**
 * OPerations on a "complex number" class with real part `x` and complex part `y`
 * @internal
 */
export class Complex implements BeJSONFunctions {
  private _x: number;
  /** Real part */
  public get x(): number { return this._x; }
  public set x(value: number) { this._x = value; }

  private _y: number;
  /** Imaginary part */
  public get y(): number { return this._y; }
  public set y(value: number) { this._y = value; }

  public constructor(x: number = 0, y: number = 0) { this._x = x; this._y = y; }
  /** set x and y parts from args. */
  public set(x: number = 0, y: number = 0): void { this.x = x; this.y = y; }
  /** set `this.x` and `this.y` from `other.x` and `other.y` */
  public setFrom(other: Complex) { this.x = other.x; this.y = other.y; }
  /** clone the complex x,y */
  public clone(): Complex { return new Complex(this.x, this.y); }
  /** test for near equality using coordinate tolerances */
  public isAlmostEqual(other: Complex): boolean { return Geometry.isAlmostEqualNumber(this.x, other.x) && Geometry.isAlmostEqualNumber(this.x, other.x); }
  /** Create a new Complex instance from given x and y. */
  public static create(x: number = 0, y: number = 0, result?: Complex): Complex {
    if (result) {
      result.x = x;
      result.y = y;
      return result;
    }
    return new Complex(x, y);
  }
  /** Return the complex sum `this+other` */
  public plus(other: Complex, result?: Complex): Complex { return Complex.create(this.x + other.x, this.y + other.y, result); }
  /** Return the complex difference  `this-other` */
  public minus(other: Complex, result?: Complex): Complex { return Complex.create(this.x - other.x, this.y - other.y, result); }
  /** Return the complex product  `this * other` */
  public times(other: Complex, result?: Complex): Complex {
    return Complex.create(
      this.x * other.x - this.y * other.y,
      this.x * other.y + this.y * other.x,
      result);
  }
  /** Return the complex product `this * x+i*y`. That is, the second Complex value exists via the args without being formally created as an instance. */
  public timesXY(x: number, y: number, result?: Complex): Complex {
    return Complex.create(
      this.x * x - this.y * y,
      this.x * y + this.y * x,
      result);
  }
  /** Return the mangitude of the complex number */
  public magnitude(): number { return Geometry.hypotenuseXY(this.x, this.y); }
  /** Return the angle from x axis to the vector (x,y) */
  public angle(): Angle { return Angle.createAtan2(this.y, this.x); }
  /** Return the xy plane distance between this and other */
  public distance(other: Complex) {
    return Geometry.hypotenuseXY(this.x - other.x, this.y - other.y);
  }
  /** Return the squared xy plane distance between this and other. */
  public magnitudeSquared(): number { return this.x * this.x + this.y * this.y; }
  /** Return the complex division `this / other` */
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
  /** Return the complex square root of this. */
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
  /** set the complex x,y from a json object of the form like
   * * x,y key value pairs:   `{x:1,y:2}`
   * * array of numbers:  `[1,2]`
   */
  public setFromJSON(json?: any): void {
    if (Array.isArray(json) && json.length > 1) {
      this.set(json[0], json[1]);
    } else if (json && json.x && json.y) {
      this.set(json.x, json.y);
    } else {
      this.set(0, 0);
    }
  }
  /** Create a `Complex` instance from a json object. */
  public static fromJSON(json?: any): Complex { const result = new Complex(); result.setFromJSON(json); return result; }

  /**
   * Convert an Complex to a JSON object.
   * @return {*} [x,y]
   */
  public toJSON(): any { return [this.x, this.y]; }

}
