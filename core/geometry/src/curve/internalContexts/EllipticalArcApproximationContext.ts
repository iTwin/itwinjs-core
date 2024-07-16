/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, OrderedComparator, OrderedSet, SortedArray } from "@itwin/core-bentley";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { Arc3d, EllipticalArcApproximationOptions, EllipticalArcSampleMethod } from "../Arc3d";
import { CurveChain } from "../CurveCollection";
import { CurveLocationDetailPair } from "../CurveLocationDetail";
import { Loop } from "../Loop";
import { Path } from "../Path";
import { CurveCurveCloseApproachXY } from "./CurveCurveCloseApproachXY";

/** @packageDocumentation
 * @module Curve
 */

function compareFractionsIncreasing(f0: number, f1: number): number {
  if (Geometry.isAlmostEqualNumber(f0, f1, Geometry.smallFraction))
    return 0;
  return f0 < f1 ? -1 : 1;
};
function compareFractionsDecreasing(f0: number, f1: number): number {
  if (Geometry.isAlmostEqualNumber(f0, f1, Geometry.smallFraction))
    return 0;
  return f0 < f1 ? 1 : -1;
};

/**
 * Structured data carrier used by the elliptical arc sampler.
 * @internal
*/
export class QuadrantFractions {
  private _quadrant: 1 | 2 | 3 | 4;
  private _fractions: number[];
  private _axisAtStart: boolean;
  private _axisAtEnd: boolean;
  private _averageAdded: boolean;
  private constructor(
    quadrant: 1 | 2 | 3 | 4, fractions: number[], axisAtStart: boolean = false, axisAtEnd: boolean = false,
  ) {
    this._quadrant = quadrant;
    this._fractions = fractions;
    this._axisAtStart = axisAtStart;
    this._axisAtEnd = axisAtEnd;
    this._averageAdded = false;
  }
  /** Constructor, captures the array. */
  public static create(
    quadrant: 1 | 2 | 3 | 4, fractions: number[] = [], axisAtStart: boolean = false, axisAtEnd: boolean = false,
  ): QuadrantFractions {
    return new QuadrantFractions(quadrant, fractions, axisAtStart, axisAtEnd);
  }
  /**
   * Quadrant of the full ellipse containing the samples.
   * * Quadrants are labeled proceeding in counterclockwise angular sweeps of length pi/2 starting at vector0.
   * * For example, Quadrant 1 starts at vector0 and ends at vector90, and Quadrant 4 ends at vector0.
   * * For purposes of angle classification, quadrants are half-open intervals, closed at their start angle,
   * as determined by the ellipse's sweep direction.
   */
  public get quadrant(): 1 | 2 | 3 | 4 {
    return this._quadrant;
  }
  /** Sample locations in this quadrant of the elliptical arc, as fractions of its sweep. */
  public get fractions(): number[] {
    return this._fractions;
  }
  public set fractions(f: number[]) {
    this._fractions = f;
  }
  /**
   * Whether the first fraction is the location of an ellipse axis point.
   * * Only valid if `this.fractions.length > 0`.
   */
  public get axisAtStart(): boolean {
    return this._fractions.length > 0 ? this._axisAtStart : false;
  }
  public set axisAtStart(onAxis: boolean) {
    this._axisAtStart = onAxis;
  }
  /**
   * Whether the last fraction is the location of an ellipse axis point.
   * * Only valid if `this.fractions.length > 1`.
   */
  public get axisAtEnd(): boolean {
    return this._fractions.length > 1 ? this._axisAtEnd : false;
  }
  public set axisAtEnd(onAxis: boolean) {
    this._axisAtEnd = onAxis;
  }
  /**
   * Whether the average of the first and last fractions was added to satisfy a minimum fractions array length of three.
   * * There are always at least two fractions per quadrant, but three are needed to interpolate both end tangents
   * with circular arcs.
   * * This flag is set if a given sample method/arc yielded only two fractions, so their average was inserted in the
   * fractions array to meet this minimum three-sample requirement.
  */
  public get averageAdded(): boolean {
    return this._fractions.length === 3 ? this._averageAdded : false;
  }
  public set averageAdded(added: boolean) {
    this._averageAdded = added;
  }
  /**
   * Compute quadrant data for the given angles.
   * @param radians0 first radian angle
   * @param radians1 second radian angle
   * @return quadrant number and start/end radian angles for the quadrant that contains both input angles, or
   * undefined if no such quadrant.
   * * The returned sweep is always counterclockwise: angle0 < angle1.
   */
  public static getQuadrantRadians(
    radians0: number, radians1: number,
  ): { quadrant: 1 | 2 | 3 | 4, angle0: number, angle1: number } | undefined {
    if (AngleSweep.isRadiansInStartEnd(radians0, 0, Angle.piOver2Radians)
      && AngleSweep.isRadiansInStartEnd(radians1, 0, Angle.piOver2Radians))
      return { quadrant: 1, angle0: 0, angle1: Angle.piOver2Radians };
    if (AngleSweep.isRadiansInStartEnd(radians0, Angle.piOver2Radians, Angle.piRadians)
      && AngleSweep.isRadiansInStartEnd(radians1, Angle.piOver2Radians, Angle.piRadians))
      return { quadrant: 2, angle0: Angle.piOver2Radians, angle1: Angle.piRadians };
    if (AngleSweep.isRadiansInStartEnd(radians0, Angle.piRadians, Angle.pi3Over2Radians)
      && AngleSweep.isRadiansInStartEnd(radians1, Angle.piRadians, Angle.pi3Over2Radians))
      return { quadrant: 3, angle0: Angle.piRadians, angle1: Angle.pi3Over2Radians };
    if (AngleSweep.isRadiansInStartEnd(radians0, Angle.pi3Over2Radians, Angle.pi2Radians)
      && AngleSweep.isRadiansInStartEnd(radians1, Angle.pi3Over2Radians, Angle.pi2Radians))
      return { quadrant: 4, angle0: Angle.pi3Over2Radians, angle1: Angle.pi2Radians };
    return undefined;
  }
};

/**
 * Base class for processing samples of an elliptical arc.
 * @internal
 */
class QuadrantFractionsProcessor {
  /**
   * Announce the beginning of processing for quadrant `q`.
   * @param _reversed if true, `q.fractions` was reversed before this call for symmetry reasons: arcs will be
   * announced in the opposite order and with the opposite orientation. If false, `q.fractions` is untouched.
   * @return whether to process `q`
  */
  public announceQuadrantBegin(_q: QuadrantFractions, _reversed: boolean): boolean { return true; }
  /**
   * Announce a circular arc approximating the elliptical arc E between the given fractions.
   * * The given fractions are different. If `announceQuadrantBegin` was invoked with `reversed === false` then
   * `f0 < f1`; otherwise, `f0 > f1`.
   * @param _arc circular arc that interpolates E at f0 and f1. Processor can capture `arc`; it is unused afterwards.
   * @param _fPrev optional fractional parameter of E used to define the 3-point parent circle through the ordered
   * points at `fPrev`, `f0`, and `f1` from which `arc` was constructed. If undefined, `arc` was generated from the
   * circle defined by the points at `f0` and `f1` and one of their tangents.
   * @param _f0 fractional parameter of E at which point `arc` starts
   * @param _f1 fractional parameter of E at which point `arc` ends
   */
  public announceArc(_arc: Arc3d, _fPrev: number | undefined, _f0: number, _f1: number): void { }
  /**
   * Announce the end of processing for quadrant `q`.
   * @param _reversed if true, `q.fractions` was reversed for processing (see [[announceQuadrantBegin]]); the
   * original order of `q.fractions` will be restored after this call. If false, `q.fractions` is untouched.
  */
  public announceQuadrantEnd(_q: QuadrantFractions, _reversed: boolean): void { }
};

/**
 * Processor for computing the error of a sample-based arc chain approximation.
 * @internal
 */
class ArcChainErrorProcessor extends QuadrantFractionsProcessor {
  private _ellipticalArc: Arc3d;
  private _maxPerpendicular: CurveLocationDetailPair | undefined;
  protected constructor(ellipticalArc: Arc3d) {
    super();
    this._ellipticalArc = ellipticalArc;
    this._maxPerpendicular = undefined;
  }
  public static create(ellipticalArc: Arc3d): ArcChainErrorProcessor {
    return new ArcChainErrorProcessor(ellipticalArc);
  }
  public get ellipticalArc(): Arc3d {
    return this._ellipticalArc;
  }
  /**
   * Compute the maximum xy-distance between an elliptical arc and its approximation.
   * * Inputs should be in horizontal plane(s), as z-coordinates are ignored.
   * @param circularArc circular arc approximant. Assumed to start and end on the elliptical arc.
   * @param ellipticalArc elliptical arc being approximated.
   * For best results, `f0` and `f1` should correspond to the start/end of `circularArc`
   * @param f0 optional `ellipticalArc` start fraction to restrict its sweep
   * @param f1 optional `ellipticalArc` end fraction to restrict its sweep
   * @return details of the perpendicular measuring the max approximation error, or undefined if no such perpendicular.
   * For each of `detailA` (refers to `circularArc`) and `detailB` (refers to unrestricted `ellipticalArc`):
   * * `point` is the end of the perpendicular on each curve
   * * `fraction` is the curve parameter of the point
   * * `a` is the distance between the points
   */
  public static computePrimitiveErrorXY(circularArc: Arc3d, ellipticalArc: Arc3d, f0?: number, f1?: number): CurveLocationDetailPair | undefined {
    const handler = new CurveCurveCloseApproachXY();
    handler.maxDistanceToAccept = circularArc.quickLength() / 2;
    const trimEllipse = undefined !== f0 && undefined !== f1;
    const trimmedEllipticalArc = trimEllipse ? ellipticalArc.clonePartialCurve(f0, f1) : ellipticalArc;
    // We expect only one perpendicular, not near an endpoint.
    handler.allPerpendicularsArcArcBounded(circularArc, trimmedEllipticalArc);
    let maxPerp: CurveLocationDetailPair | undefined;
    for (const perp of handler.grabPairedResults()) {
      if (Geometry.isAlmostEqualEitherNumber(perp.detailA.fraction, 0, 1, Geometry.smallFraction))
        continue; // rule out perpendiculars on circular arc ends
      if (Geometry.isAlmostEqualEitherNumber(perp.detailB.fraction, 0, 1, Geometry.smallFraction))
        continue; // rule out perpendiculars on elliptical arc ends
      const error = perp.detailA.point.distanceXY(perp.detailB.point);
      if (!maxPerp || maxPerp.detailA.a < error) {
        if (trimEllipse) { // reset ellipticalArc fraction to unrestricted range
          perp.detailB.fraction = Geometry.interpolate(f0, perp.detailB.fraction, f1);
          perp.detailB.setCurve(ellipticalArc);
        }
        perp.detailA.a = perp.detailB.a = error;
        maxPerp = perp;
      }
    }
    return maxPerp;
  }

  public get maxPerpendicular(): CurveLocationDetailPair | undefined {
    return this._maxPerpendicular;
  }
  public set maxPerpendicular(newMaxPerp: CurveLocationDetailPair) {
    this._maxPerpendicular = newMaxPerp;
  }
  /**
   * Update the chain approximation error for a given chain child that approximates the elliptical arc between the
   * given fractions.
   * * Fractional sweep [f0, f1] of the elliptical arc is the smaller of the cyclic sweeps.
   */
  public updateMaxPerpendicular(childApproximation: Arc3d, f0: number, f1: number): void {
    const childPerp = ArcChainErrorProcessor.computePrimitiveErrorXY(childApproximation, this.ellipticalArc, f0, f1);
    if (childPerp && (!this.maxPerpendicular || this.maxPerpendicular.detailA.a < childPerp.detailA.a))
      this.maxPerpendicular = childPerp;
  };
  public override announceArc(arc: Arc3d, _fPrev: number | undefined, f0: number, f1: number): void {
    this.updateMaxPerpendicular(arc, f0, f1);
  }
}

/**
 * Processor for refining a single Q1 interval between fractions f0 and f1 by perturbing an interior fraction f.
 * * This processor expects to repeatedly process a QuadrantFractions `q` wth `q.quadrant` = 1 and fractions array
 * [fPrev, f0, f, f1], where fPrev is from the previously processed (possibly refined) adjacent interval. If
 * `q.axisAtStart`, then no fPrev is necessary and the processor expects [f0, f, f1].
 * * This is enough info to compute the two circular arcs spanning [f0,f] and [f,f1] and compare their approximation
 * errors.
 * * The basic idea is to perturb f so that the difference in the two arcs' errors is minimized.
 * * This processor keeps track of a bracket containing f so that when the caller repeatedly processes `q` via
 * [[EllipticalArcApproximationContext.processQuadrantFractions]], a bisection algorithm plays out, informed by the
 * heuristic that moving f toward one end of its bracket decreases the approx error of the arc on that side of f.
 * @internal
 */
class AdaptiveSubdivisionQ1IntervalErrorProcessor extends QuadrantFractionsProcessor {
  private _ellipticalArc: Arc3d;
  private _f: number;
  private _bracket0: number;
  private _bracket1: number;
  private _error0: number;
  private _error1: number;
  private constructor(ellipticalArc: Arc3d, f0: number, f: number, f1: number) {
    super();
    this._ellipticalArc = ellipticalArc;
    this._bracket0 = f0;
    this._f = f;
    this._bracket1 = f1;
    this._error0 = this._error1 = Geometry.largeCoordinateResult;
  }
  public static create(ellipticalArc: Arc3d, f0: number, f: number, f1: number): AdaptiveSubdivisionQ1IntervalErrorProcessor {
    return new AdaptiveSubdivisionQ1IntervalErrorProcessor(ellipticalArc, f0, f, f1);
  }
  public get f(): number {
    return this._f;
  }
  public get isConverged(): boolean {
    if (Geometry.isSmallMetricDistance(this._error0 - this._error1))
      return true;
    if (Geometry.isSmallRelative(this._bracket0 - this._bracket1))
      return true;
    return false;
  }
  /** Remember the initial value of the fraction f to be perturbed. */
  public override announceQuadrantBegin(q: QuadrantFractions, reversed: boolean): boolean {
    assert(q.quadrant === 1);
    assert(!reversed); // ASSUME bracket and q.fractions have same ordering
    // the first fraction might be an extra point for computing the first 3-pt arc.
    assert(q.fractions.length === 4 || (q.fractions.length === 3 && q.axisAtStart));
    this._error0 = this._error1 = Geometry.largeCoordinateResult;
    return true;
  }
  /** Compute approximation error over the interval if it is adjacent to f. */
  public override announceArc(arc: Arc3d, _fPrev: number | undefined, f0: number, f1: number): void {
    if (Geometry.isAlmostEqualEitherNumber(this.f, f0, f1, 0)) {
      const perp = ArcChainErrorProcessor.computePrimitiveErrorXY(arc, this._ellipticalArc, f0, f1);
      if (perp) {
        if (this.f === f1)
          this._error0 = perp.detailA.a; // first arc error
        else  // f === f0
          this._error1 = perp.detailA.a; // second arc error
      }
    }
  }
  /** Update `q.fractions` with a perturbed value of f that is expected to decrease error delta. */
  public override announceQuadrantEnd(q: QuadrantFractions, _reversed: boolean): void {
    if (Geometry.isLargeCoordinateResult(this._error0) || Geometry.isLargeCoordinateResult(this._error1))
      return;
    if (this.isConverged)
      return;
    // set up for next call to processQuadrantFractions
    const n = q.fractions.length;
    if (this._error0 < this._error1)
      this._bracket0 = this._f; // HEURISTIC: move f toward f1 to decrease e1
    else
      this._bracket1 = this._f; // HEURISTIC: move f toward f0 to decrease e0
    this._f = q.fractions[n - 2] = Geometry.interpolate(this._bracket0, 0.5, this._bracket1);
  }
}
/**
 * Processor for computing samples in Q1 for a subdivision-based arc chain approximation.
 * * The basic idea is to build a refinement of `q.fractions` for a QuadrantFractions q with q.quadrant = 1.
 *   * Start off the refinement with a copy of `q.fractions`.
 *   * When an announced arc exceeds a given maximum approximation error, compute a fraction f in the span
 * such that the error of arcs on either side of f would be almost equal, then add f to the refinement.
 *   * If the announced arc does not exceed the maxError, its associated fraction span remains as-is---no
 * additional samples are needed to decrease approximation error.
 *   * After `q` processing completes, `q.fractions` is updated in place with the computed refinement.
 *   * The caller typically re-processes `q` until `isRefined` returns false, at which point construction of an
 * approximation that is guaranteed not to exceed the desired error can commence.
 * @internal
 */
class AdaptiveSubdivisionQ1ErrorProcessor extends QuadrantFractionsProcessor {
  private _ellipticalArc: Arc3d;
  private _refinement?: SortedArray<number>;
  private _maxError: number;
  private _originalRefinementCount: number;
  private static _maxIters = 50;
  private constructor(ellipticalArc: Arc3d, maxError: number) {
    super();
    this._ellipticalArc = ellipticalArc;
    this._maxError = maxError > 0 ? maxError : EllipticalArcApproximationOptions.defaultMaxError;
    this._originalRefinementCount = 0;
  }
  public static create(ellipticalArc: Arc3d, maxError: number): AdaptiveSubdivisionQ1ErrorProcessor {
    return new AdaptiveSubdivisionQ1ErrorProcessor(ellipticalArc, maxError);
  }
  /** Whether the processor refined the current `QuadrantFractions` fractions array to decrease approximation error. */
  public get isRefined(): boolean {
    if (undefined === this._refinement || 0 === this._refinement.length)
      return false;
    return this._originalRefinementCount < this._refinement.length;
  }
  /** Initialize the refinement from the quadrant fractions array. */
  public override announceQuadrantBegin(q: QuadrantFractions, reversed: boolean): boolean {
    assert(q.quadrant === 1);
    this._refinement = new SortedArray<number>(reversed ? compareFractionsDecreasing : compareFractionsIncreasing, false);
    for (const f of q.fractions)
      this._refinement.insert(f);
    return 2 <= (this._originalRefinementCount = this._refinement.length);
  }
  /** If this arc needs to be refined, add a refinement point. */
  public override announceArc(arc: Arc3d, fPrev: number | undefined, f0: number, f1: number): void {
    if (undefined === this._refinement)
      return;
    if (this._originalRefinementCount > 2) { // no early out for a single interval; it gets refined below
      const perp = ArcChainErrorProcessor.computePrimitiveErrorXY(arc, this._ellipticalArc, f0, f1);
      if (!perp || perp.detailA.a <= this._maxError)
        return;
    }
    // note in the following that f0 and f1 may be in either order
    const f = Geometry.interpolate(f0, 0.5, f1);
    const fractions = (undefined === fPrev) ? [f0, f, f1] : [fPrev, f0, f, f1];
    const axisAtF0 = Geometry.isAlmostEqualEitherNumber(f0, 0, 0.25, 0);
    const axisAtF1 = Geometry.isAlmostEqualEitherNumber(f1, 0, 0.25, 0);
    const q1 = [QuadrantFractions.create(1, fractions, axisAtF0, axisAtF1)];
    const processor = AdaptiveSubdivisionQ1IntervalErrorProcessor.create(this._ellipticalArc, f0, f, f1);
    let iter = 0;
    do {
      EllipticalArcApproximationContext.processQuadrantFractions(this._ellipticalArc, q1, processor);
    } while (iter++ < AdaptiveSubdivisionQ1ErrorProcessor._maxIters && !processor.isConverged);
    this._refinement.insert(processor.f);
  }
  /** Update the quadrant fractions array with the current refinement. */
  public override announceQuadrantEnd(q: QuadrantFractions, _reversed: boolean): void {
    if (this._refinement)
      q.fractions = [...this._refinement];
  }
  /**
   * Compute radian angles for the fractions in the current refinement that are strictly inside Q1.
   * @param result optional preallocated array to clear and populate
   * @return angles suitable for output from [[EllipticalArcSampler.computeRadiansStrictlyInsideQuadrant1]].
   */
  public getRefinedInteriorQ1Angles(result?: number[]): number[] {
    if (!result)
      result = [];
    else
      result.length = 0;
    if (this._refinement) {
      const f0 = 0;
      const f1 = 0.25;
      for (const f of this._refinement) {
        if (f0 < f && f < f1)
          result.push(this._ellipticalArc.sweep.fractionToRadians(f));
      }
    }
    return result;
  }
}

/**
 * Interface implemented by sampler classes.
 * * Implementation constructors are assumed to supply the sampler with the elliptical arc to be approximated,
 * as well as relevant options for computing the samples.
 * @internal
 */
interface EllipticalArcSampler {
  /**
   * Return samples interior to the first quadrant of the (full) ellipse.
   * * Samples are returned as an unordered array of radian angles in the open interval (0, pi/2).
   * @param result optional preallocated array to populate and return
   * @return array of radian angles
   */
  computeRadiansStrictlyInsideQuadrant1(result?: number[]): number[];
};

/**
 * Implementation for method `EllipticalArcSampleMethod.UniformParameter`
 * @internal
 */
class UniformParameterSampler implements EllipticalArcSampler {
  private _context: EllipticalArcApproximationContext;
  private _options: EllipticalArcApproximationOptions;
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    this._context = c;
    this._options = o;
  }
  public static create(
    context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions,
  ): UniformParameterSampler {
    return new UniformParameterSampler(context, options);
  }
  public computeRadiansStrictlyInsideQuadrant1(result?: number[]): number[] {
    if (!result)
      result = [];
    if (this._context.isValidEllipticalArc) {
      const aDelta = Angle.piOver2Radians / (this._options.numSamplesInQuadrant - 1);
      for (let i = 1; i < this._options.numSamplesInQuadrant - 1; ++i)
        result.push(i * aDelta);
    }
    return result;
  }
};

/**
 * Implementation for method `EllipticalArcSampleMethod.NonUniformCurvature`
 * @internal
 */
class NonUniformCurvatureSampler implements EllipticalArcSampler {
  protected _context: EllipticalArcApproximationContext;
  protected _options: EllipticalArcApproximationOptions;
  private _xMag2: number;
  private _yMag2: number;
  private _curvatureRange: Range1d;
  protected constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    this._context = c;
    this._options = o;
    this._xMag2 = c.ellipticalArc.matrixRef.columnXMagnitudeSquared();
    this._yMag2 = c.ellipticalArc.matrixRef.columnYMagnitudeSquared();
    // extreme curvatures occur at the ellipse's axis points because its axes are perpendicular
    this._curvatureRange = Range1d.createXX(Math.sqrt(this._xMag2) / this._yMag2, Math.sqrt(this._yMag2) / this._xMag2);
  }
  public static create(
    context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions,
  ): NonUniformCurvatureSampler {
    return new NonUniformCurvatureSampler(context, options);
  }
  /**
   * Compute the angle corresponding to the point in the ellipse's first quadrant with the given curvature.
   * * The elliptical arc is assumed to be non-circular and have perpendicular axes of positive length; its sweep is ignored.
   * * This is a scaled inverse of [[Arc3d.fractionToCurvature]] restricted to fractions in [0, 1/4].
   * @return radian angle in [0, pi/2] or undefined if the ellipse is invalid, or does not attain the given curvature.
   */
  private curvatureToRadians(curvature: number): number | undefined {
    /*
    Let the elliptical arc be parameterized with axes u,v of different length and u.v = 0:
      f(t) = c + u cos(t) + v sin(t),
      f'(t) = -u sin(t) + v cos(t),
      f"(t) = -u cos(t) - v sin(t)
    We seek a formula for t(K), the inverse of the standard curvature formula
      K(t) := ||f'(t) x f"(t)|| / ||f'(t)||^3
    for a parametric function f(t):R->R^3. We'll restrict K to Q1 (i.e., t in [0, pi/2]), where K is monotonic.
    By linearity of the cross product and the above formulas, the numerator of K(t) reduces to ||u x v||, and so:
      cbrt(||u x v||/K) = ||f'(t)|| = sqrt(f'(t).f'(t))
    Leveraging u,v perpendicularity we can define:
      lambda(K) := (||u x v||/K)^(2/3) = (||u|| ||v|| / K)^(2/3) = cbrt(u.u v.v / K^2)
    Then substituting and using perpendicularity again:
      lambda(K) = f'(t).f'(t)
        = sin^2(t)u.u + cos^2(t)v.v - 2sin(t)cos(t)u.v
        = u.u + cos^2(t)(v.v - u.u)
    Taking the positive root because cos(t)>=0 in Q1, and relying on u,v having different lengths:
      cos(t) = sqrt((lambda(K) - u.u)/(v.v - u.u))
    Solving for t yields the formula for t(K).
    */
    if (!this._curvatureRange.containsX(curvature))
      return undefined; // ellipse does not attain this curvature
    const lambda = Math.cbrt((this._xMag2 * this._yMag2) / (curvature * curvature));
    const cosTheta = Math.sqrt(Math.abs((lambda - this._xMag2) / (this._yMag2 - this._xMag2)));
    return Math.acos(cosTheta);
  }
  public computeRadiansStrictlyInsideQuadrant1(result?: number[]): number[] {
    if (!result)
      result = [];
    if (this._context.isValidEllipticalArc) {
      const tDelta = 1.0 / (this._options.numSamplesInQuadrant - 1);
      for (let i = 1; i < this._options.numSamplesInQuadrant - 1; ++i) {
        const j = this._options.remapFunction(i * tDelta);
        const curvature = (1 - j) * this._curvatureRange.low + j * this._curvatureRange.high;
        const angle = this.curvatureToRadians(curvature);
        if (undefined !== angle)
          result.push(angle);
      }
    }
    return result;
  }
};

/**
 * Implementation for method `EllipticalArcSampleMethod.UniformCurvature`.
 * * Basically this is just `NonUniformCurvature` method with uniformity preserved via identity remap function.
 * @internal
 */
class UniformCurvatureSampler extends NonUniformCurvatureSampler implements EllipticalArcSampler {
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    super(c, o.clone());
    this._options.remapFunction = (x: number) => x; // identity map
  }
  public static override create(
    context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions,
  ): UniformCurvatureSampler {
    return new UniformCurvatureSampler(context, options);
  }
};

/**
 * Implementation for method `EllipticalArcSampleMethod.AdaptiveSubdivision`
 * @internal
 */
class AdaptiveSubdivisionSampler implements EllipticalArcSampler {
  private _context: EllipticalArcApproximationContext;
  private _options: EllipticalArcApproximationOptions;
  private _fullEllipticalArcXY: Arc3d;
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    this._context = c;
    this._options = o;
    this._fullEllipticalArcXY = c.isValidEllipticalArc ? c.cloneLocalArc(true) : Arc3d.createUnitCircle();
  }
  public get fullEllipticalArcXY(): Arc3d {
    return this._fullEllipticalArcXY;
  }
  public static create(context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions): AdaptiveSubdivisionSampler {
    return new AdaptiveSubdivisionSampler(context, options);
  }
  public computeRadiansStrictlyInsideQuadrant1(result?: number[]): number[] {
    if (!this._context.isValidEllipticalArc)
      return [];
    const f0 = 0;
    const f1 = 0.25;
    const q1 = [QuadrantFractions.create(1, [f0, f1], true, true)];
    const processor = AdaptiveSubdivisionQ1ErrorProcessor.create(this.fullEllipticalArcXY, this._options.maxError);
    do {
      EllipticalArcApproximationContext.processQuadrantFractions(this.fullEllipticalArcXY, q1, processor);
    } while (processor.isRefined);
    return processor.getRefinedInteriorQ1Angles(result);
  }
};

/**
 * Processor for constructing a sample-based circular arc chain approximation.
 * @internal
 */
class ArcChainConstructionProcessor extends QuadrantFractionsProcessor {
  private _chain: CurveChain;
  private _quadrantChain?: CurveChain;
  private constructor(ellipticalArc: Arc3d, forcePath: boolean) {
    super();
    this._chain = (ellipticalArc.sweep.isFullCircle && !forcePath) ? Loop.create() : Path.create();
  }
  public static create(ellipticalArc: Arc3d, forcePath: boolean = false): ArcChainConstructionProcessor {
    return new ArcChainConstructionProcessor(ellipticalArc, forcePath);
  }
  public get chain(): CurveChain | undefined {
    return this._chain.children.length > 0 ? this._chain : undefined;
  }
  public override announceQuadrantBegin(_q: QuadrantFractions, _reversed: boolean): boolean {
    this._quadrantChain = undefined;
    return true;
  }
  public override announceArc(arc: Arc3d, _fPrev: number | undefined, _f0: number, _f1: number): void {
    if (!this._quadrantChain)
      this._quadrantChain = Path.create(); // the arc chain in a quadrant is always open
    this._quadrantChain.tryAddChild(arc); // captured!
  }
  public override announceQuadrantEnd(_q: QuadrantFractions, reversed: boolean): void {
    if (this._quadrantChain) {
      if (reversed)
        this._quadrantChain.reverseChildrenInPlace();
      for (const child of this._quadrantChain.children)
        this._chain.tryAddChild(child); // captured!
    }
  }
};

/**
 * Context for sampling a non-circular Arc3d and for constructing an approximation to it based on interpolation
 * of the samples.
 * * [[EllipticalArcApproximationContext.constructCircularArcChainApproximation]] constructs a `CurveChain`
 * approximation consisting of circular arcs.
 * * Various sample methods are supported, cf. [[EllipticalArcApproximationOptions]].
 * @internal
 */
export class EllipticalArcApproximationContext {
  private _ellipticalArc: Arc3d;
  private _localToWorld: Transform;
  private _isValidEllipticalArc: boolean;
  private static workPt0 = Point3d.createZero();
  private static workPt1 = Point3d.createZero();
  private static workPt2 = Point3d.createZero();
  private static workRay = Ray3d.createZero();

  /** Constructor, captures input */
  private constructor(ellipticalArc: Arc3d) {
    this._isValidEllipticalArc = false;
    const data = ellipticalArc.toScaledMatrix3d();
    this._ellipticalArc = Arc3d.createScaledXYColumns(data.center, data.axes, data.r0, data.r90, data.sweep);
    this._localToWorld = Transform.createRefs(data.center, data.axes);
    if (this._localToWorld.matrix.isSingular())
      return;
    if (this._ellipticalArc.sweep.isEmpty)
      return; // ellipse must have a nonzero sweep
    const xMag2 = ellipticalArc.matrixRef.columnXMagnitudeSquared();
    const yMag2 = ellipticalArc.matrixRef.columnYMagnitudeSquared();
    if (Geometry.isSmallMetricDistanceSquared(xMag2) || Geometry.isSmallMetricDistanceSquared(yMag2))
      return; // ellipse must have positive radii
    if (Geometry.isSameCoordinateSquared(xMag2, yMag2))
      return; // ellipse must not be circular
    this._isValidEllipticalArc = true;
  }
  /** Constructor, clones input. */
  public static create(ellipticalArc: Arc3d) {
    return new EllipticalArcApproximationContext(ellipticalArc);
  }
  /**
   * The arc to be sampled.
   * * Its axes are forced to be perpendicular.
   * * It is stored in world coordinates.
   */
  public get ellipticalArc(): Arc3d {
    return this._ellipticalArc;
  }
  /** The rigid transformation that rotates and translates the arc into the xy-plane at the origin. */
  public get localToWorld(): Transform {
    return this._localToWorld;
  }
  /**
   * Whether the elliptical arc is amenable to sampling.
   * * The arc is valid if it is non-circular, has nonzero sweep, and has positive radii (nonsingular matrix).
   */
  public get isValidEllipticalArc(): boolean {
    return this._isValidEllipticalArc;
  }
  /**
   * Create a clone of the context's arc in local coordinates.
   * * The arc is assumed to be valid.
   * @param fullSweep Optionally set full sweep on the returned local arc.
   */
  public cloneLocalArc(fullSweep?: boolean): Arc3d {
    const worldToLocal = this.localToWorld.inverse()!;
    const arcXY = this.ellipticalArc.cloneTransformed(worldToLocal);
    if (fullSweep)
      arcXY.sweep.setStartEndRadians();
    return arcXY;
  }
  /**
   * Process structured sample data for the given elliptical arc.
   * * Circular arcs are announced to the processor for each sample interval in each quadrant.
   * * Each quadrant is processed separately to allow the elliptical arc's axis points and tangents to be interpolated.
   * * A 2-point plus tangent construction is used to create the first and last circular arc in each quadrant.
   * * Symmetry of the announced circular arcs matching that of a multi-quadrant spanning elliptical arc is ensured by
   * processing the samples consistently, starting along the elliptical arc's major axis in each quadrant.
   * @internal
  */
  public static processQuadrantFractions(
    ellipticalArc: Arc3d, quadrants: QuadrantFractions[], processor: QuadrantFractionsProcessor,
  ): void {
    const pt0 = this.workPt0;
    const pt1 = this.workPt1;
    const pt2 = this.workPt2;
    const ray = this.workRay;
    const arcBetween2Samples = (arcStart: Ray3d, arcEnd: Point3d, reverse: boolean): Arc3d | undefined => {
      // assume non-colinear inputs
      const myArc = Arc3d.createCircularStartTangentEnd(arcStart.origin, arcStart.direction, arcEnd);
      if (!(myArc instanceof Arc3d))
        return undefined;
      if (reverse)
        myArc.reverseInPlace();
      return myArc;
    };
    const arcBetweenLast2Of3Samples = (p0: Point3d, arcStart: Point3d, arcEnd: Point3d): Arc3d | undefined => {
      // assume non-colinear inputs; initial arc starts at p0, ends at arcEnd
      const arc = Arc3d.createCircularStartMiddleEnd(p0, arcStart, arcEnd);
      if (!(arc instanceof Arc3d))
        return undefined; // colinear?
      const startAngle = arc.vector0.signedAngleTo(Vector3d.createStartEnd(arc.center, arcStart), arc.matrixRef.columnZ());
      arc.sweep.setStartEndRadians(startAngle.radians, arc.sweep.endRadians);
      return arc; // returned arc starts at arcStart, ends at arcEnd
    };
    const createFirstArc = (f0: number, f1: number, reverse: boolean): void => {
      // This arc starts at the first sample f0 and ends at f1.
      ellipticalArc.fractionToPointAndDerivative(f0, ray);
      ellipticalArc.fractionToPoint(f1, pt1);
      if (reverse)
        ray.direction.scaleInPlace(-1);
      const arc = arcBetween2Samples(ray, pt1, false);
      if (arc)
        processor.announceArc(arc, undefined, f0, f1);
    };
    const createInnerArc = (f0: number, f1: number, f2: number) => {
      ellipticalArc.fractionToPoint(f0, pt0);
      ellipticalArc.fractionToPoint(f1, pt1);
      ellipticalArc.fractionToPoint(f2, pt2);
      const arc = arcBetweenLast2Of3Samples(pt0, pt1, pt2);
      if (arc)
        processor.announceArc(arc, f0, f1, f2);
    };
    const createLastArc = (f0: number, f1: number, reverse: boolean): void => {
      // This arc starts at f0 and ends at the last sample f1. It is the only arc to use f1.
      ellipticalArc.fractionToPoint(f0, pt0);
      ellipticalArc.fractionToPointAndDerivative(f1, ray);
      if (!reverse)
        ray.direction.scaleInPlace(-1);
      const arc = arcBetween2Samples(ray, pt0, true);
      if (arc)
        processor.announceArc(arc, undefined, f0, f1);
    };
    const reverseFractionsForSymmetry = (q: QuadrantFractions): boolean => {
      // If we touch an axis, we process q.fractions in a consistent direction (forward or reverse) so that the
      // approximating arc chain exhibits fourfold axial symmetry. We do this by ensuring q.fractions starts along the
      // major axis (or ends along the minor axis). This choice is arbitrary, but consistently made across all quadrants.
      if (!q.axisAtStart && !q.axisAtEnd)
        return false;
      const n = q.fractions.length;
      if (n < 2)
        return false;
      const xAxisIsMajor = ellipticalArc.vector0.magnitudeSquared() > ellipticalArc.vector90.magnitudeSquared();
      const ccwQuadrantNeedsReverse = xAxisIsMajor ? (q.quadrant === 2 || q.quadrant === 4) : (q.quadrant === 1 || q.quadrant === 3);
      const isCCW = q.fractions[0] < q.fractions[n - 1]; // we ASSUME monotonicity
      const reverse = ccwQuadrantNeedsReverse && isCCW;
      if (reverse)
        q.fractions.reverse();
      return reverse;
    };

    for (const q of quadrants) {
      const n = q.fractions.length;
      if (n < 2)
        continue;
      const reversed = reverseFractionsForSymmetry(q);
      if (!processor.announceQuadrantBegin(q, reversed))
        continue;
      if (q.axisAtStart)
        createFirstArc(q.fractions[0], q.fractions[1], reversed);
      else
        ; // ASSUME the first fraction is extra, for defining the first inner arc
      for (let i = 0; i + 2 < n - 1; ++i)
        createInnerArc(q.fractions[i], q.fractions[i + 1], q.fractions[i + 2]);
      if (n > 2) { // for n === 2, we only announce the first arc
        if (q.axisAtEnd)
          createLastArc(q.fractions[n - 2], q.fractions[n - 1], reversed);
        else
          createInnerArc(q.fractions[n - 3], q.fractions[n - 2], q.fractions[n - 1]);
      }
      processor.announceQuadrantEnd(q, reversed);
      if (reversed)
        q.fractions.reverse();
    }
  }
  /**
   * Compute the maximum error of the circular arc chain approximation determined by the given samples.
   * * This is measured by the longest perpendicular between the elliptical arc and its approximation.
   * @param samples structured sample data from the instance's elliptical arc.
   * @return details of the perpendicular measuring the max approximation error, or undefined if no such perpendicular.
   * For each of `detailA` and `detailB`:
   * * `point` is the end of the perpendicular on each curve
   * * `fraction` is the curve parameter of the point
   * * `a` is the distance between the points.
   * @internal
   */
  public computeApproximationError(samples: QuadrantFractions[]): CurveLocationDetailPair | undefined {
    if (!this.isValidEllipticalArc)
      return undefined;
    const arcXY = this.cloneLocalArc();
    const processor = ArcChainErrorProcessor.create(arcXY);
    EllipticalArcApproximationContext.processQuadrantFractions(arcXY, samples, processor);
    const maxError = processor.maxPerpendicular;
    return (maxError && maxError.tryTransformInPlace(this.localToWorld)) ? maxError : undefined;
  }
  /**
   * Compute samples for the elliptical arc as fraction parameters.
   * * This method houses the sampling framework for all sampling methods, which are customized via implementations
   * of the [[EllipticalArcSampler]] interface.
   * * Note that the returned samples are fractions in the parameterization of the context's arc (whose axes have been
   * forced to be perpendicular), not the input arc passed into the context's constructor.
   * @param options options that determine how the elliptical arc is sampled.
   * @param structuredOutput flag indicating output format as follows:
   * * If false (default), return all fractions in one sorted (increasing), deduplicated array (a full ellipse includes
   * both 0 and 1).
   * * If true, fractions are assembled by quadrants:
   *   * Each [[QuadrantFractions]] object holds at least three sorted (increasing), deduplicated fractions in a
   * specified quadrant of the arc.
   *   * If only two fractions would be computed for a given `QuadrantFractions`, their midpoint is inserted to enable
   * tangent interpolation at both ends. Such a quadrant `q` is marked with `q.averageAdded = true`.
   *   * The `QuadrantFractions` objects themselves are sorted by increasing order of the fractions they contain.
   *   * If the arc sweep spans adjacent quadrants, the fraction bordering the quadrants appears in both `QuadrantFractions`.
   *   * If the arc starts and ends in the same quadrant, two `QuadrantFractions` objects can be returned.
   *   * This means there are between 1 and 5 objects in the `QuadrantFractions` array.
   * @internal
   */
  public computeSampleFractions(
    options: EllipticalArcApproximationOptions, structuredOutput: boolean = false,
  ): QuadrantFractions[] | number[] {
    if (!this.isValidEllipticalArc)
      return [];
    const compareRadiansIncreasing: OrderedComparator<number> = (a0: number, a1: number): number => {
      if (Geometry.isAlmostEqualNumber(a0, a1, Geometry.smallAngleRadians))
        return 0;
      return a0 < a1 ? -1 : 1;
    };
    const compareRadiansDecreasing: OrderedComparator<number> = (a0: number, a1: number): number => {
      if (Geometry.isAlmostEqualNumber(a0, a1, Geometry.smallAngleRadians))
        return 0;
      return a0 < a1 ? 1 : -1;
    };
    const compareQuadrantFractions: OrderedComparator<QuadrantFractions> = (
      q0: QuadrantFractions, q1: QuadrantFractions,
    ): number => {
      // ASSUME QuadrantFractions.fractions arrays are sorted (increasing) and have only trivial overlap
      if (compareFractionsIncreasing(q0.fractions[q0.fractions.length - 1], q1.fractions[0]) <= 0)
        return -1;
      if (compareFractionsIncreasing(q1.fractions[q1.fractions.length - 1], q0.fractions[0]) <= 0)
        return 1;
      return 0;
    };
    const shiftRadiansToSweep = (angle: number, sweep: AngleSweep): { angle: number, inSweep: boolean } => {
      const inSweep = sweep.isRadiansInSweep(angle, true);
      if (inSweep) {
        const fraction = sweep.radiansToSignedPeriodicFraction(angle);
        if (Geometry.isIn01(fraction))
          angle = sweep.fractionToRadians(fraction);
      }
      return { angle, inSweep };
    };
    const convertAndAddRadiansToFractionInRange = (
      dest: OrderedSet<number>, radians: number, sweep: AngleSweep, f0?: number, f1?: number,
    ): number | undefined => {
      if (undefined === f0)
        f0 = 0;
      if (undefined === f1)
        f1 = 1;
      if (f0 > f1)
        return convertAndAddRadiansToFractionInRange(dest, radians, sweep, f1, f0);
      const fraction = sweep.radiansToSignedPeriodicFraction(radians);
      if (fraction < (f0 - Geometry.smallFraction) || (f1 + Geometry.smallFraction) < fraction)
        return undefined; // angle is outside sweep
      Geometry.restrictToInterval(fraction, 0, 1);
      dest.add(fraction);
      return fraction;
    };
    const convertQ1RadiansInSweepToQuadrantFractions = (
      anglesInQ1: number[], angle0: number, angle1: number, sweep: AngleSweep,
    ): QuadrantFractions | undefined => {
      if (angle0 > angle1)
        return convertQ1RadiansInSweepToQuadrantFractions(anglesInQ1, angle1, angle0, sweep);
      if (Angle.isAlmostEqualRadiansNoPeriodShift(angle0, angle1))
        return undefined; // empty sweep
      const qData = QuadrantFractions.getQuadrantRadians(angle0, angle1);
      if (undefined === qData)
        return undefined; // no containing quadrant
      const qFractions = new OrderedSet<number>(compareFractionsIncreasing);
      const f0 = convertAndAddRadiansToFractionInRange(qFractions, angle0, sweep);
      const f1 = convertAndAddRadiansToFractionInRange(qFractions, angle1, sweep);
      if (undefined === f0 || undefined === f1)
        return undefined;
      for (const a0 of anglesInQ1) {
        let angle = a0;
        if (2 === qData.quadrant)
          angle = Angle.piRadians - angle;
        else if (3 === qData.quadrant)
          angle = Angle.piRadians + angle;
        else if (4 === qData.quadrant)
          angle = Angle.pi2Radians - angle;
        convertAndAddRadiansToFractionInRange(qFractions, angle, sweep, f0, f1);
      }
      const qf = QuadrantFractions.create(qData.quadrant, [...qFractions]);
      const n = qf.fractions.length;
      const qFrac0 = sweep.radiansToSignedPeriodicFraction(qData.angle0);
      const qFrac1 = sweep.radiansToSignedPeriodicFraction(qData.angle1);
      qf.axisAtStart = Geometry.isAlmostEqualEitherNumber(qf.fractions[0], qFrac0, qFrac1, Geometry.smallFraction);
      qf.axisAtEnd = Geometry.isAlmostEqualEitherNumber(qf.fractions[n - 1], qFrac0, qFrac1, Geometry.smallFraction);
      if (2 === n) { // e.g. elliptical arc is so small it contains no interior samples in this quadrant
        qf.fractions.splice(1, 0, Geometry.interpolate(qf.fractions[0], 0.5, qf.fractions[1]));
        qf.averageAdded = true;
      }
      return qf;
    };
    const computeStructuredOutput = (anglesInQ1: number[], arcSweep: AngleSweep): QuadrantFractions[] => {
      const qEndAngles = new OrderedSet<number>(arcSweep.isCCW ? compareRadiansIncreasing : compareRadiansDecreasing);
      qEndAngles.add(arcSweep.endRadians);
      for (const qAngle of [0, Angle.piOver2Radians, Angle.piRadians, Angle.pi3Over2Radians, Angle.pi2Radians]) {
        const shifted = shiftRadiansToSweep(qAngle, arcSweep);
        if (shifted.inSweep)
          qEndAngles.add(shifted.angle);
      }
      const quadrants = new OrderedSet<QuadrantFractions>(compareQuadrantFractions);
      let a0 = arcSweep.startRadians;
      for (const a1 of qEndAngles) {
        const quadrant = convertQ1RadiansInSweepToQuadrantFractions(anglesInQ1, a0, a1, arcSweep);
        if (quadrant)
          quadrants.add(quadrant);
        a0 = a1;
      }
      return [...quadrants];
    };
    const computeFlatOutput = (anglesInQ1: number[], arcSweep: AngleSweep): number[] => {
      // first add the quadrant fractions so the set prefers them over nearby interior fractions
      const fractions = new OrderedSet<number>(compareFractionsIncreasing);
      fractions.add(0);
      fractions.add(1);
      for (const angle of [0, Angle.piOver2Radians, Angle.piRadians, Angle.pi3Over2Radians])
        convertAndAddRadiansToFractionInRange(fractions, angle, arcSweep);
      // add interior Q1 fractions, reflect to the other quadrants, filter by sweep and extant entry
      for (const angle0 of anglesInQ1) {
        for (const angle of [angle0, Angle.piRadians - angle0, Angle.piRadians + angle0, Angle.pi2Radians - angle0])
          convertAndAddRadiansToFractionInRange(fractions, angle, arcSweep);
      }
      return [...fractions];
    };
    // sample the (full) ellipse as angles in strict interior of Quadrant 1
    const radiansQ1: number[] = []; // unordered
    switch (options.sampleMethod) {
      case EllipticalArcSampleMethod.UniformParameter: {
        UniformParameterSampler.create(this, options).computeRadiansStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.UniformCurvature: {
        UniformCurvatureSampler.create(this, options).computeRadiansStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.NonUniformCurvature: {
        NonUniformCurvatureSampler.create(this, options).computeRadiansStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.AdaptiveSubdivision: {
        AdaptiveSubdivisionSampler.create(this, options).computeRadiansStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      default:
        break;
    }
    return structuredOutput ?
      computeStructuredOutput(radiansQ1, this.ellipticalArc.sweep) :
      computeFlatOutput(radiansQ1, this.ellipticalArc.sweep);
  }
  /** Construct a circular arc chain approximation to the elliptical arc. */
  public constructCircularArcChainApproximation(options?: EllipticalArcApproximationOptions): CurveChain | undefined {
    if (!this.isValidEllipticalArc)
      return undefined;
    if (!options)
      options = EllipticalArcApproximationOptions.create();
    const processor = ArcChainConstructionProcessor.create(this.ellipticalArc, options.forcePath);
    const samples = this.computeSampleFractions(options, true) as QuadrantFractions[];
    EllipticalArcApproximationContext.processQuadrantFractions(this.ellipticalArc, samples, processor);
    return processor.chain;
  }
}
