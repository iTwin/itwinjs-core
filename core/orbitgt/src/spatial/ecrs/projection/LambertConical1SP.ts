/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs.projection;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "../../geom/Coordinate";
import { CRS } from "../CRS";
import { OperationMethod } from "../OperationMethod";
import { ParameterValueList } from "../ParameterValueList";

/**
 * Class LambertConical1SP defines a Lambert Conical Conformal map projection with 1 standard parallel.
 *
 * The 'source' CRS is the geographic CRS.
 * The 'target' CRS is the projected CRS.
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised August 2006
 * Available at: http://www.epsg.org/
 *
 * Formulas: see 1.4.1.1 -> 1.4.1.4
 *
 * @version 1.0 January 2007
 */
/** @internal */
export class LambertConical1SP extends OperationMethod {
  /** The code of this method */
  public static readonly METHOD_CODE: int32 = 9801;

  /** Latitude of natural origin */
  private _latN: float64;
  /** Longitude of natural origin (the central meridian) */
  private _lonN: float64;
  /** Scale factor at natural origin */
  private _k0: float64;
  /** False easting */
  private _fE: float64;
  /** False northing */
  private _fN: float64;

  /**
   * Create a new projection.
   * @param parameters the values of the parameters.
   */
  public constructor(parameters: ParameterValueList) {
    super(LambertConical1SP.METHOD_CODE, "Lambert Conic Conformal (1SP)", parameters);
    /* Store the parameters */
    this._latN = parameters.getValue(8801);
    this._lonN = parameters.getValue(8802);
    this._k0 = parameters.getValue(8805);
    this._fE = parameters.getValue(8806);
    this._fN = parameters.getValue(8807);
  }

  /**
   * Get the sign of a number.
   */
  private static sign(v: float64): float64 {
    return v < 0.0 ? -1.0 : 1.0;
  }

  /**
   * Calculate M.
   */
  private static calcM(e: float64, lat: float64): float64 {
    return Math.cos(lat) / Math.pow(1.0 - Math.pow(e * Math.sin(lat), 2.0), 0.5);
  }

  /**
   * Calculate T.
   */
  private static calcT(e: float64, lat: float64): float64 {
    return (
      Math.tan(Math.PI * 0.25 - lat * 0.5) / Math.pow((1.0 - e * Math.sin(lat)) / (1.0 + e * Math.sin(lat)), e * 0.5)
    );
  }

  /**
   * Calculate R.
   */
  private static calcR(a: float64, F: float64, t: float64, n: float64, k0: float64): float64 {
    if (Math.abs(t) < 1.0e-6) return 0.0;
    return a * F * Math.pow(t, n) * k0;
  }

  /**
   * OperationMethod interface method.
   * @see OperationMethod#forward
   */
  public forward(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void {
    /* Get the parameters */
    let lon: float64 = source.getX();
    let lat: float64 = source.getY();
    /* Get the ellipsoid parameters */
    let e: float64 = sourceCRS.getEllipsoid().getE();
    let a: float64 = sourceCRS.getEllipsoid().getA();
    /* Make the calculation */
    let m0: float64 = LambertConical1SP.calcM(e, this._latN);
    let t0: float64 = LambertConical1SP.calcT(e, this._latN);
    let n: float64 = Math.sin(this._latN);
    let F: float64 = m0 / (n * Math.pow(t0, n));
    let r0: float64 = LambertConical1SP.calcR(a, F, t0, n, this._k0);
    let t: float64 = LambertConical1SP.calcT(e, lat);
    let r: float64 = LambertConical1SP.calcR(a, F, t, n, this._k0);
    let theta: float64 = n * (lon - this._lonN);
    let E: float64 = this._fE + r * Math.sin(theta);
    let N: float64 = this._fN + r0 - r * Math.cos(theta);
    /* Save the position */
    target.setX(E);
    target.setY(N);
    target.setZ(source.getZ()); // Keep the Z value
  }

  /**
   * OperationMethod interface method.
   * @see OperationMethod#reverse
   */
  public reverse(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void {
    /* Get the parameters */
    let E: float64 = target.getX();
    let N: float64 = target.getY();
    /* Get the ellipsoid parameters */
    let e: float64 = sourceCRS.getEllipsoid().getE();
    let a: float64 = sourceCRS.getEllipsoid().getA();
    /* Make the calculation */
    let m0: float64 = LambertConical1SP.calcM(e, this._latN);
    let t0: float64 = LambertConical1SP.calcT(e, this._latN);
    let n: float64 = Math.sin(this._latN);
    let F: float64 = m0 / (n * Math.pow(t0, n));
    let r0: float64 = LambertConical1SP.calcR(a, F, t0, n, this._k0);
    let r_: float64 =
      LambertConical1SP.sign(n) * Math.pow(Math.pow(E - this._fE, 2.0) + Math.pow(r0 - (N - this._fN), 2.0), 0.5);
    let t_: float64 = Math.pow(r_ / (a * this._k0 * F), 1.0 / n);
    let theta_: float64 = Math.atan((E - this._fE) / (r0 - (N - this._fN)));
    let lat: float64 = Math.PI * 0.5 - 2.0 * Math.atan(t_);
    for (let i: number = 0; i < 7; i++)
      lat =
        Math.PI * 0.5 - 2.0 * Math.atan(t_ * Math.pow((1.0 - e * Math.sin(lat)) / (1.0 + e * Math.sin(lat)), e * 0.5)); // recursive formula
    let lon: float64 = theta_ / n + this._lonN;
    /* Save the position */
    source.setX(lon);
    source.setY(lat);
    source.setZ(target.getZ()); // Keep the Z value
  }
}
