/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "../../Geometry";
import { Range1d } from "../../geometry3d/Range";
import { Arc3d } from "../Arc3d";

/** @packageDocumentation
 * @module Curve
 */

/** Data carrier used by the sampler.
 * @internal
*/
export class QuadrantFractions {
  private _quadrant: 0|1|2|3;
  private _fractions: number[];
  private constructor(quadrant: 0|1|2|3, fractions?: number[]) {
    this._quadrant = quadrant;
    this._fractions = fractions ? fractions : [];
  }
  public create(quadrant: number, fractions?: number[]): QuadrantFractions {
    return new QuadrantFractions(Math.abs(quadrant) % 4 as 0|1|2|3, fractions);
  }
  public get quadrant(): number {
    return this._quadrant + 1;
  }
  public get fractions(): number[] {
    return this._fractions;
  }
};

/**
 * Context for sampling an elliptical Arc3d, e.g., for approximations.
 * @internal
 */
export class EllipticalArcApproximationContext {
  private _arc: Arc3d;
  private _axx: number;
  private _ayy: number;
  private _curvatureRange: Range1d;
  private _isValidArc: boolean;

  public constructor(arc: Arc3d) {
    const scaleData = arc.toScaledMatrix3d();
    this._arc = Arc3d.createScaledXYColumns(scaleData.center, scaleData.axes, scaleData.r0, scaleData.r90, scaleData.sweep);
    this._axx = arc.matrixRef.columnXMagnitudeSquared();
    this._ayy = arc.matrixRef.columnYMagnitudeSquared();
    this._curvatureRange = Range1d.createNull();
    this._isValidArc = true;

    if (Geometry.isSmallMetricDistanceSquared(this._axx) || Geometry.isSmallMetricDistanceSquared(this._ayy))
      this._isValidArc = false; // ellipse must have positive radii
    else if (Geometry.isSameCoordinateSquared(this._axx, this._ayy))
      this._isValidArc = false; // ellipse must not be circular
    else {
      // extreme curvatures are at the semi-axis points
      this._curvatureRange.extendX(Math.sqrt(this._axx) / this._ayy);
      this._curvatureRange.extendX(Math.sqrt(this._ayy) / this._axx);
    }
  }

  public get arc(): Arc3d {
    return this._arc;
  }
  public get vector0LengthSquared(): number {
    return this._axx;
  }
  public get vector90LengthSquared(): number {
    return this._ayy;
  }
  public get curvatureRange(): Range1d {
    return this._curvatureRange;
  }
  public get isValidArc(): boolean {
    return this._isValidArc;
  }

  /**
   * Compute the angle corresponding to the point in the ellipse's first quadrant with the given curvature.
   * * The instance sweep is ignored.
   * * Arc is assumed to be non-circular and have perpendicular axes of positive length.
   * * This is a scaled inverse of [[Arc3d.fractionToCurvature]] restricted to fractions in [0,1/4].
   * @return radian angle in [0,pi/2] or undefined if the ellipse is invalid, or does not attain the given curvature.
  */
  private curvatureToAngle(curvature: number): number | undefined {
    if (!this.isValidArc)
      return undefined;
    if (!this.curvatureRange.containsX(curvature))
      return undefined; // ellipse does not attain this curvature
    const scaledNormalLengthSquared = this._axx * this._ayy / curvature * curvature;
    const numerator = Math.cbrt(scaledNormalLengthSquared) - this._axx;
    const denominator = this._ayy - this._axx;
    const cosTheta = Math.sqrt(Math.abs(numerator / denominator));
    return Math.acos(cosTheta);
  }

  /**
   * Sample the instance arc by interpolating curvature, and return the fractions of the sample points.
   * @param numPointsInQuadrant number of samples in each ellipse quadrant.
   * @param structuredOutput false to return a flat array of fractions (default). If true, structured objects are returned:
   * * Fractions are sorted and assembled by ellipse quadrant into a [[QuadrantFractions]] object.
   * * If the arc sweep spans adjacent quadrants, `QuadrantFractions`representing those quadrants share the fraction at the quadrant boundary.
   * * `QuadrantFractions` objects are sorted in increasing fraction order.
   * * Note that if the arc starts and ends in the same ellipse quadrant, two `QuadrantFractions` objects can be returned.
   */
  private sampleFractions(numPointsInQuadrant: number = 4, _structuredOutput: boolean = false): QuadrantFractions[] | number[] {
    if (numPointsInQuadrant < 2)
      return [];
    const result: QuadrantFractions[] = [];

/*    const f = (x: number): number => { return x; }; // TODO

  // don't add interior fraction if near quadrant fraction

    const cMin = this.curvatureRange.low;
    const cMax = this.curvatureRange.high;
    const tDelta = 1.0 / (numPointsInQuadrant - 1);
    for (let i = 1; i < numPointsInQuadrant; ++i) {
      const j = f(i * tDelta);
      const curvature = (1 - j) * cMin + j * cMax;
      for (const fraction of curvatureToFractions(ellipticalArc, curvature))
        fractions.add(fraction);
    }
    for (const fraction of [...fractions].sort())
*/
    return result;
  }
}
