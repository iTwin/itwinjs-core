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
 * Class Mercator1SP defines the Mercator method with one standard parallel.
 *
 * The 'source' CRS is the geographic CRS.
 * The 'target' CRS is the projected CRS.
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised January 2009
 * Available at: http://www.epsg.org/
 *
 * Formulas: see 1.3.3.1 -> 1.3.3.2
 *
 * Note that in these formulas common to both 1SP and 2SP cases, the parameter latitude of natural origin (latN)
 * is not used. However for the Merctor (1SP) method the EPSG dataset includes this parameter, which must
 * have a value of zero, for completeness in CRS labelling.

 * @version 1.0 April 2009
 */
/** @internal */
export class Mercator1SP extends OperationMethod {
  /** The code of this method */
  public static readonly METHOD_CODE: int32 = 9804;

  /** The value of PI/4 */
  private static readonly QPI: float64 = Math.PI / 4.0;

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
    super(Mercator1SP.METHOD_CODE, "Mercator (1SP)", parameters);
    /* Store the parameters */
    this._latN = parameters != null ? parameters.getValue2(8801, 0.0) : 0.0;
    this._lonN = parameters != null ? parameters.getValue2(8802, 0.0) : 0.0;
    this._k0 = parameters != null ? parameters.getValue2(8805, 1.0) : 1.0;
    this._fE = parameters != null ? parameters.getValue2(8806, 0.0) : 0.0;
    this._fN = parameters != null ? parameters.getValue2(8807, 0.0) : 0.0;
  }

  /**
   * Create a new projection.
   * @param latN latitude of natural origin.
   * @param lonN longitude of natural origin (the central meridian).
   * @param k0 scale factor at natural origin.
   * @param fE false easting.
   * @param fN false northing.
   * @return the projection.
   */
  public static create(latN: float64, lonN: float64, k0: float64, fE: float64, fN: float64): Mercator1SP {
    let projection: Mercator1SP = new Mercator1SP(null);
    projection._latN = latN;
    projection._lonN = lonN;
    projection._k0 = k0;
    projection._fE = fE;
    projection._fN = fN;
    return projection;
  }

  /**
   * OperationMethod interface method.
   * @see OperationMethod#forward
   */
  public forward(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void {
    /* Get the geographic parameters (radians) */
    let lon: float64 = source.getX();
    let lat: float64 = source.getY();
    /* Get the radius of the sphere */
    let R: float64 = sourceCRS.getEllipsoid().getA();
    /* Calculate easting */
    let E: float64 = this._fE + R * (lon - this._lonN);
    /* Calculate northing */
    let sin: float64 = Math.sin(lat);
    let N: float64 = this._fN + 0.5 * R * Math.log((1.0 + sin) / (1.0 - sin));
    //        double N = this._fN+R*Math.log(Math.tan(QPI+0.5*lat));
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
    /* Get the radius of the sphere */
    let R: float64 = sourceCRS.getEllipsoid().getA();
    /* Calculate longitude */
    let lon: float64 = (E - this._fE) / R + this._lonN;
    /* Calculate latitude */
    let D: float64 = (this._fN - N) / R;
    let lat: float64 = 2.0 * (Mercator1SP.QPI - Math.atan(Math.exp(D)));
    /* Save the position */
    source.setX(lon);
    source.setY(lat);
    source.setZ(target.getZ()); // Keep the Z value
  }
}
