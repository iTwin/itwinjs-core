/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { OrderedComparator, OrderedSet } from "@itwin/core-bentley";
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

function compareFractions(f0: number, f1: number): number {
  if (Geometry.isAlmostEqualNumber(f0, f1, Geometry.smallFraction))
    return 0;
  return f0 < f1 ? -1 : 1;
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
abstract class QuadrantFractionsProcessor {
  /**
   * Announce the beginning of processing of the samples in a given quadrant.
   * @return whether to process this quadrant
  */
  public announceQuadrantBegin(_q: QuadrantFractions): boolean { return true; }
  /**
   * Optionally announce a circular arc approximating the elliptical arc between the given fractions.
   * @param arc circular arc interpolating the ellipse at the given fractions.
   * * The processor is allowed to capture `arc`, e.g., to add it to a growing chain approximation.
   * @param f0 elliptical arc parameter in [0,1], unordered with respect to f1
   * @param f1 elliptical arc parameter in [0,1], unordered with respect to f0
   */
  public announceArc?(arc: Arc3d, f0: number, f1: number): void;
  /**
   * Announce the end of processing of the samples in the given quadrant.
   * @param _wasReversed whether the given quadrant's samples were processed in reverse
  */
  public announceQuadrantEnd(_q: QuadrantFractions, _wasReversed: boolean): void { }
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
  public static create(ellipticalArc: Arc3d, _maxError: number = 0): ArcChainErrorProcessor {
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
  public override announceArc(arc: Arc3d, f0: number, f1: number): void {
    this.updateMaxPerpendicular(arc, f0, f1);
  }
};

/**
 * Processor for computing samples for a subdivision-based arc chain approximation.
 * * The basic idea is to build a refinement of `q.fractions` during the processing of QuadrantFractions `q`.
 *   * Start off the refinement with a copy of `q.fractions`.
 *   * When an announced arc exceeds a given maximum approximation error, the midpoint of its associated
 * fraction span is added to the refinement.
 *   * If the announced arc does not exceed the maxError, its associated fraction span remains as-is---no
 * additional samples are needed to decrease approximation error.
 *   * After `q` processing completes, `q.fractions` is updated in place with the computed refinement.
 *   * The caller typically re-processes `q` until `isRefined` returns false, at which point construction of an
 * approximation that is guaranteed not to exceed the desired error can commence.
 * @internal
 */
class AdaptiveSubdivisionErrorProcessor extends ArcChainErrorProcessor {
  private _refinement: OrderedSet<number>;
  private _maxError: number;
  private _originalRefinementCount: number;
  private constructor(ellipticalArc: Arc3d, maxError: number) {
    super(ellipticalArc);
    this._refinement = new OrderedSet<number>(compareFractions);
    this._maxError = maxError > 0 ? maxError : EllipticalArcApproximationOptions.defaultMaxError;
    this._originalRefinementCount = 0;
  }
  public static override create(ellipticalArc: Arc3d, maxError: number): AdaptiveSubdivisionErrorProcessor {
    return new AdaptiveSubdivisionErrorProcessor(ellipticalArc, maxError);
  }
  public override announceQuadrantBegin(q: QuadrantFractions): boolean {
    this._refinement.clear();
    for (const f of q.fractions)
      this._refinement.add(f);
    this._originalRefinementCount = this._refinement.size;
    return true;
  }
  public updateFractionSet(childApproximation: Arc3d, f0: number, f1: number): void {
    const childPerp = ArcChainErrorProcessor.computePrimitiveErrorXY(childApproximation, this.ellipticalArc, f0, f1);
    if (childPerp && (childPerp.detailA.a > this._maxError))
      this._refinement.add(Geometry.interpolate(f0, 0.5, f1));
  }
  public override announceArc(arc: Arc3d, f0: number, f1: number): void {
    this.updateFractionSet(arc, f0, f1);
  }
  public override announceQuadrantEnd(q: QuadrantFractions, _wasReversed: boolean): void {
    q.fractions = [...this._refinement];
  }
  /** Whether the processor refined the current `QuadrantFractions` fractions array to decrease approximation error. */
  public get isRefined(): boolean {
    return this._originalRefinementCount < this._refinement.size;
  }
  /**
   * Return the refinement of the current `QuadrantFractions` fractions array, as radians, sans start/end angles.
   * * Output is suitable to return from an implementation of [[EllipticalArcSampler.computeRadiansStrictlyInsideQuadrant1]].
   */
  public getRefinedInteriorAngles(result?: number[]): number[] {
    if (!result)
      result = [];
    else
      result.length = 0;
    for (const fraction of this._refinement) {
      if (0.0 < fraction && fraction < 1.0) // skip start/end angle
        result.push(this.ellipticalArc.sweep.fractionToRadians(fraction));
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
    if (this._context.isValidArc) {
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
    this._xMag2 = c.arc.matrixRef.columnXMagnitudeSquared();
    this._yMag2 = c.arc.matrixRef.columnYMagnitudeSquared();
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
    if (this._context.isValidArc) {
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
  private _fullArcXY: Arc3d;
  private static maxIters = 10;
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    this._context = c;
    this._options = o;
    this._fullArcXY = c.isValidArc ? c.cloneLocalArc(true) : Arc3d.createUnitCircle();
  }
  public get fullArcXY(): Arc3d {
    return this._fullArcXY;
  }
  public static create(context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions): AdaptiveSubdivisionSampler {
    return new AdaptiveSubdivisionSampler(context, options);
  }
  private computeFirstInteriorFraction(f0: number, f1: number): number {
    if (f0 === f1)
      return f0;
    if (f0 > f1)
      return this.computeFirstInteriorFraction(f1, f0);
    const flatterAtF0 = this.fullArcXY.fractionToCurvature(f0)! < this.fullArcXY.fractionToCurvature(f1)!;
    let ellipse = this.fullArcXY;
    if (!flatterAtF0) {
      ellipse = this.fullArcXY.clone();
      const xScale = ellipse.matrixRef.columnXMagnitude();
      const yScale = ellipse.matrixRef.columnYMagnitude();
      ellipse.matrixRef.scaleColumnsInPlace(yScale / xScale, xScale / yScale, 1);
    }
    const ray0 = ellipse.fractionToPointAndDerivative(f0);
    const pt = Point3d.createZero();
    const arc0 = Arc3d.createXY(pt, 0);
    let f = Geometry.interpolate(f0, 0.5, f1);
    let bracket0 = f0;
    let bracket1 = f1;
    // ellipse is flatter at f0, so decreasing f -> f0 decreases the approximation error of arc0
    let iters = 0;
    let arc0Error: number;
    do {
      if (!(Arc3d.createCircularStartTangentEnd(ray0.origin, ray0.direction, ellipse.fractionToPoint(f, pt), arc0) instanceof Arc3d))
        break;
      const perp = ArcChainErrorProcessor.computePrimitiveErrorXY(arc0, ellipse, bracket0, bracket1);
      if (!perp)
        break;
      arc0Error = perp.detailA.a;
      if (arc0Error < this._options.maxError) {
        if (Geometry.isAlmostEqualNumber(arc0Error, this._options.maxError, Geometry.smallFraction))
          break;
        f = Geometry.interpolate(bracket0 = f, 0.5, bracket1);
      } else
        f = Geometry.interpolate(bracket0, 0.5, bracket1 = f);
    } while (++iters <= AdaptiveSubdivisionSampler.maxIters);
    return flatterAtF0 ? f : f1 - (f - f0);
  }
  public computeRadiansStrictlyInsideQuadrant1(result?: number[]): number[] {
    if (!result)
      result = [];
    if (this._context.isValidArc) {
      const f0 = 0;
      const f1 = 0.25;
      const f = this.computeFirstInteriorFraction(f0, f1);
      const q = [QuadrantFractions.create(1, [f0, f, f1], true, true)];
      const processor = AdaptiveSubdivisionErrorProcessor.create(this.fullArcXY, this._options.maxError);
      let iters = 0;
      do {
        EllipticalArcApproximationContext.processQuadrantFractions(this.fullArcXY, q, processor);
      } while (processor.isRefined && ++iters <= AdaptiveSubdivisionSampler.maxIters);
      processor.getRefinedInteriorAngles(result);
    }
    return result;
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
  public override announceQuadrantBegin(_q: QuadrantFractions): boolean {
    this._quadrantChain = undefined;
    return true;
  }
  public override announceArc(arc: Arc3d, _f0: number, _f1: number): void {
    if (!this._quadrantChain)
      this._quadrantChain = Path.create(); // the arc chain in a quadrant is always open
    this._quadrantChain.tryAddChild(arc); // captured!
  }
  public override announceQuadrantEnd(_q: QuadrantFractions, wasReversed: boolean): void {
    if (this._quadrantChain) {
      if (wasReversed)
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
  private _arc: Arc3d;
  private _localToWorld: Transform;
  private _isValidArc: boolean;
  private static workPt0 = Point3d.createZero();
  private static workPt1 = Point3d.createZero();
  private static workPt2 = Point3d.createZero();
  private static workRay = Ray3d.createZero();

  /** Constructor, captures input */
  private constructor(arc: Arc3d) {
    this._isValidArc = false;
    const data = arc.toScaledMatrix3d();
    this._arc = Arc3d.createScaledXYColumns(data.center, data.axes, data.r0, data.r90, data.sweep);
    this._localToWorld = Transform.createRefs(data.center, data.axes);
    if (this._localToWorld.matrix.isSingular())
      return;
    if (this._arc.sweep.isEmpty)
      return; // ellipse must have a nonzero sweep
    const xMag2 = arc.matrixRef.columnXMagnitudeSquared();
    const yMag2 = arc.matrixRef.columnYMagnitudeSquared();
    if (Geometry.isSmallMetricDistanceSquared(xMag2) || Geometry.isSmallMetricDistanceSquared(yMag2))
      return; // ellipse must have positive radii
    if (Geometry.isSameCoordinateSquared(xMag2, yMag2))
      return; // ellipse must not be circular
    this._isValidArc = true;
  }
  /** Constructor, clones input. */
  public static create(arc: Arc3d) {
    return new EllipticalArcApproximationContext(arc);
  }
  /**
   * The arc to be sampled.
   * * Its axes are forced to be perpendicular.
   * * It is stored in world coordinates.
   */
  public get arc(): Arc3d {
    return this._arc;
  }
  /** The rigid transformation that rotates and translates the arc into the xy-plane at the origin. */
  public get localToWorld(): Transform {
    return this._localToWorld;
  }
  /**
   * Whether the arc is amenable to sampling.
   * * The arc is valid if it is non-circular, has nonzero sweep, and has positive radii (nonsingular matrix).
   */
  public get isValidArc(): boolean {
    return this._isValidArc;
  }
  /**
   * Create a clone of the context's arc in local coordinates.
   * * The arc is assumed to be valid.
   * @param fullSweep Optionally set full sweep on the returned local arc.
   */
  public cloneLocalArc(fullSweep?: boolean): Arc3d {
    const worldToLocal = this.localToWorld.inverse()!;
    const arcXY = this.arc.cloneTransformed(worldToLocal);
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
    ellipticalArc: Arc3d, samples: QuadrantFractions[], processor: QuadrantFractionsProcessor,
  ): void {
    const pt0 = this.workPt0;
    const pt1 = this.workPt1;
    const pt2 = this.workPt2;
    const ray = this.workRay;
    const arcBetween2Samples = (arcStart: Ray3d, arcEnd: Point3d, reverse: boolean): Arc3d => {
      // assume non-colinear inputs
      const myArc = Arc3d.createCircularStartTangentEnd(arcStart.origin, arcStart.direction, arcEnd) as Arc3d;
      if (reverse)
        myArc.reverseInPlace();
      return myArc;
    };
    const createFirstArc = (f0: number, f1: number, reverse: boolean): Point3d[] => {
      ellipticalArc.fractionToPointAndDerivative(f0, ray);
      pt0.setFrom(ray.origin);
      pt2.setFrom(ellipticalArc.fractionToPoint(f1, pt1)); // set pt2 in case there are no inner arcs to set it
      if (processor.announceArc) {
        if (reverse)
          ray.direction.scaleInPlace(-1);
        processor.announceArc(arcBetween2Samples(ray, pt1, false), f0, f1);
      }
      return [pt0, pt1, pt2];
    };
    const arcBetweenLast2Of3Samples = (p0: Point3d, arcStart: Point3d, arcEnd: Point3d): Arc3d => {
      // assume non-colinear inputs; initial arc starts at p0, ends at arcEnd
      const arc = Arc3d.createCircularStartMiddleEnd(p0, arcStart, arcEnd) as Arc3d;
      const startAngle = arc.vector0.signedAngleTo(Vector3d.createStartEnd(arc.center, arcStart), arc.matrixRef.columnZ());
      arc.sweep.setStartEndRadians(startAngle.radians, arc.sweep.endRadians);
      return arc; // returned arc starts at arcStart, ends at arcEnd
    };
    const createInnerArc = (p0: Point3d, p1: Point3d, f1: number, f2: number): Point3d[] => {
      ellipticalArc.fractionToPoint(f2, pt2);
      if (processor.announceArc)
        processor.announceArc(arcBetweenLast2Of3Samples(p0, p1, pt2), f1, f2);
      p0.setFrom(p1);
      p1.setFrom(pt2);
      return [p0, p1, pt2];
    };
    const createLastArc = (p0: Point3d, f0: number, f1: number, reverse: boolean): void => {
      // p0 is at the penultimate sample, f0, where this arc starts
      // this arc is the only one to use the last sample f1, where this arc ends
      ellipticalArc.fractionToPointAndDerivative(f1, ray);
      if (processor.announceArc) {
        if (!reverse)
          ray.direction.scaleInPlace(-1);
        processor.announceArc(arcBetween2Samples(ray, p0, true), f0, f1);
      }
    };
    const reverseFractionsForSymmetry = (q: QuadrantFractions): boolean => {
      // if we touch an axis, start at the major axis so the approximation exhibits axial symmetry
      if (!q.axisAtStart && !q.axisAtEnd)
        return false;
      const xAxisIsMajor = ellipticalArc.vector0.magnitudeSquared() > ellipticalArc.vector90.magnitudeSquared();
      const reverse = xAxisIsMajor ? (q.quadrant === 2 || q.quadrant === 4) : (q.quadrant === 1 || q.quadrant === 3);
      if (reverse)
        q.fractions.reverse();
      return reverse;
    };

    for (const q of samples) {
      const n = q.fractions.length;
      if (n < 2 || !processor.announceQuadrantBegin(q))
        continue;
      const reverse = reverseFractionsForSymmetry(q);
      let pts = createFirstArc(q.fractions[0], q.fractions[1], reverse);
      for (let i = 2; i < n - 1; ++i) // need at least 4 samples to make inner arcs
        pts = createInnerArc(pts[0], pts[1], q.fractions[i - 1], q.fractions[i]);
      if (n > 2)
        createLastArc(pts[2], q.fractions[n - 2], q.fractions[n - 1], reverse);
      if (reverse)
        q.fractions.reverse();  // restore original order just to be safe
      processor.announceQuadrantEnd(q, reverse);
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
    if (!this.isValidArc)
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
  public sampleFractions(
    options: EllipticalArcApproximationOptions, structuredOutput: boolean = false,
  ): QuadrantFractions[] | number[] {
    if (!this.isValidArc)
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
      if (compareFractions(q0.fractions[q0.fractions.length - 1], q1.fractions[0]) <= 0)
        return -1;
      if (compareFractions(q1.fractions[q1.fractions.length - 1], q0.fractions[0]) <= 0)
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
      const qFractions = new OrderedSet<number>(compareFractions);
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
      if (2 === n) {
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
      const fractions = new OrderedSet<number>(compareFractions);
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
      computeStructuredOutput(radiansQ1, this.arc.sweep) :
      computeFlatOutput(radiansQ1, this.arc.sweep);
  }
  /** Construct a circular arc chain approximation to the elliptical arc. */
  public constructCircularArcChainApproximation(options?: EllipticalArcApproximationOptions): CurveChain | undefined {
    if (!this.isValidArc)
      return undefined;
    if (!options)
      options = EllipticalArcApproximationOptions.create();
    const processor = ArcChainConstructionProcessor.create(this.arc, options.forcePath);
    const samples = this.sampleFractions(options, true) as QuadrantFractions[];
    EllipticalArcApproximationContext.processQuadrantFractions(this.arc, samples, processor);
    return processor.chain;
  }
}
