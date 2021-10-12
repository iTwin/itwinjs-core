/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { Geometry } from "../../Geometry";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Quadrature } from "../../numerics/Quadrature";
import { SimpleNewton } from "../../numerics/Newton";
/**
 * XYCurveEvaluator is an abstract with methods for evaluating X and Y parts of a curve parameterized by a fraction.
 * * The required methods call for independent X and Y evaluation.
 * * Base class methods package those (multiple) calls into point, ray, and plane structures.
 *    * A implementation that has evaluation substantial cost that can be shared among x,y parts or between
 *       primary functions and derivatives might choose to implement the point and derivative methods directly.
 * @internal
 */
export abstract class XYCurveEvaluator {
  /** return a deep copy of the evaluator */
  public abstract clone(): XYCurveEvaluator;
  /** test for near identical evaluator */
  public abstract isAlmostEqual(other: any): boolean;
  /** Evaluate X at fractional position. */
  public abstract fractionToX(fraction: number): number;
  /** Evaluate Y at fractional position. */
  public abstract fractionToY(fraction: number): number;
  /** Evaluate derivative of X with respect to fraction at fractional position. */
  public abstract fractionToDX(fraction: number): number;
  /** Evaluate derivative of Y with respect to fraction at fractional position. */
  public abstract fractionToDY(fraction: number): number;
  /** Evaluate second derivative of X with respect to fraction at fractional position. */
  public abstract fractionToDDX(fraction: number): number;
  /** Evaluate second derivative of Y with respect to fraction at fractional position. */
  public abstract fractionToDDY(fraction: number): number;
  /** Evaluate both X and Y at fractional coordinate, return bundled as a point. */
  /** Evaluate second derivative of X with respect to fraction at fractional position. */
  public abstract fractionToD3X(fraction: number): number;
  /** Evaluate second derivative of Y with respect to fraction at fractional position. */
  public abstract fractionToD3Y(fraction: number): number;
  /** Evaluate both X and Y at fractional coordinate, return bundled as a point. */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    return Point3d.create(this.fractionToX(fraction), this.fractionToY(fraction), 0.0, result);
  }
  /** Evaluate both X and Y and their first derivatives at fractional coordinate, return bundled as origin and (non-unit) direction vector. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    return Ray3d.createXYZUVW(this.fractionToX(fraction), this.fractionToY(fraction), 0.0,
      this.fractionToDX(fraction), this.fractionToDY(fraction), 0,
      result);
  }
  /** Evaluate both X and Y and their second derivatives at fractional coordinate, return bundled as origin and (non-unit) vectorU an vectorV. */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      this.fractionToX(fraction), this.fractionToY(fraction), 0.0,
      this.fractionToDX(fraction), this.fractionToDY(fraction), 0,
      this.fractionToDDX(fraction), this.fractionToDDY(fraction), 0,
      result);
  }
  /**
   * Return the magnitude of the tangent vector at fraction.
   * @param fraction fractional position along the curve
   */
  public fractionToTangentMagnitude(fraction: number): number {
    const u = this.fractionToDX(fraction);
    const v = this.fractionToDY(fraction);
    return Geometry.hypotenuseXY(u, v);
  }

  /** Invert the fractionToX function for given X. */

  public abstract xToFraction(x: number): number | undefined;
  /** Initialize class level work arrays for 5 point Gaussian Quadrature. */
  // Class resources for integration . . .
  // These static variables are reused on calls to integrateFromStartFraction
  protected static _gaussX: Float64Array;
  protected static _gaussWeight: Float64Array;
  protected static _gaussMapper: (xA: number, xB: number, arrayX: Float64Array, arrayW: Float64Array) => number;
  public static initWorkSpace() {
    XYCurveEvaluator._gaussX = new Float64Array(5);
    XYCurveEvaluator._gaussWeight = new Float64Array(5);
    XYCurveEvaluator._gaussMapper = Quadrature.setupGauss5;
  }
  /**
   * Integrate between nominal fractions with default gauss rule.
   * * The caller is expected to choose nearby fractions so that the single gauss interval accuracy is good.
   * @param fraction0
   * @param fraction1
   */
  public integrateDistanceBetweenFractions(fraction0: number, fraction1: number): number {
    const gaussX = XYCurveEvaluator._gaussX;
    const gaussWeight = XYCurveEvaluator._gaussWeight;
    const numEval = XYCurveEvaluator._gaussMapper(fraction0, fraction1, gaussX, gaussWeight);
    let sum = 0;
    for (let k = 0; k < numEval; k++) {
      sum += gaussWeight[k] * this.fractionToTangentMagnitude(gaussX[k]);
    }
    return sum;
  }
  /**
   * Inverse integrated distance
   * @param fraction0 start of fraction interval
   * @param fraction1 end of fraction interval
   * @param distance0 distance at start
   * @param distance1 distance at end
   * @param targetDistance intermediate distance.
   */
  public inverseDistanceFraction(fraction0: number, fraction1: number, distance0: number, distance1: number, targetDistance: number): number | undefined {
    const startFraction = Geometry.inverseInterpolate(fraction0, distance0, fraction1, distance1, targetDistance);
    if (startFraction !== undefined) {
      return SimpleNewton.runNewton1D(startFraction,
        (fraction: number) => {
          const d = this.integrateDistanceBetweenFractions(fraction0, fraction);
          return distance0 + d - targetDistance;
        },
        (fraction: number) => this.fractionToTangentMagnitude(fraction));
    }
    return undefined;
  }

  /**
   *
   * @param fraction fractional position along x axis
   * @param xy xy coordinates of point on the curve
   * @param d1xy
   * @param d2xy
   * @param d3xy
   */
  public fractionToPointAnd3Derivatives(fraction: number, xy: Point3d, d1xy?: Vector3d, d2xy?: Vector3d, d3xy?: Vector3d) {
    xy.set(this.fractionToX(fraction), this.fractionToY(fraction), 0);
    if (d1xy)
      d1xy.set(this.fractionToDX(fraction), this.fractionToDY(fraction), 0);
    if (d2xy)
      d2xy.set(this.fractionToDDX(fraction), this.fractionToDDY(fraction), 0);
    if (d3xy)
      d3xy.set(this.fractionToD3X(fraction), this.fractionToD3Y(fraction), 0);
  }
  /** Apply a uniform scale around the origin. */
  public abstract scaleInPlace(scaleFactor: number): void;
}
// at load time, initialize gauss quadrature workspace
XYCurveEvaluator.initWorkSpace();
