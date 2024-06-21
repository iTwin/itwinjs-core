/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, OrderedComparator, OrderedSet } from "@itwin/core-bentley";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { Arc3d } from "../Arc3d";
import { CurveChain } from "../CurveCollection";
import { CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurveOps } from "../CurveOps";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop } from "../Loop";
import { Path } from "../Path";
import { CurveCurveCloseApproachXY } from "./CurveCurveCloseApproachXY";

/** @packageDocumentation
 * @module Curve
 */

/**
 * Enumeration of methods used by [[EllipticalArcApproximationContext.sampleFractions]] to return locations along each
 * quadrant of the elliptical arc.
 * * Because ellipses have two axes of symmetry, samples are computed for one quadrant and reflected across each
 * axis to the other quadrants. Any samples that fall outside the arc sweep are filtered out.
 * @internal
 */
export enum EllipticalArcSampleMethod {
  /** Generate n samples uniformly interpolated between the min and max parameters of a full ellipse quadrant. */
  UniformParameter = 0,
  /** Generate n samples uniformly interpolated between the min and max curvatures of a full ellipse quadrant. */
  UniformCurvature = 1,
  /**
   * Generate n samples interpolated between the min and max curvatures of a full ellipse quadrant, using a monotone
   * callback function from [0,1]->[0,1] to generate the interpolation weights.
   */
  NonUniformCurvature = 2,
  /**
   * Generate samples by subdividing parameter space until the interpolating linestring has less than a given max
   * distance to the elliptical arc.
   */
  SubdivideForChords = 3,
  /**
   * Generate samples by subdividing parameter space until the interpolating arc chain has less than a given max
   * distance to the elliptical arc.
   */
  SubdivideForArcs = 4,
};

/**
 * A monotone function that maps [0,1] onto [0,1].
 * @internal
 */
export type FractionMapper = (f: number) => number;

/**
 * Options for approximating an elliptical arc.
 * @internal
 */
export class EllipticalArcApproximationOptions {
  private _sampleMethod: EllipticalArcSampleMethod;
  private _numSamplesInQuadrant: number;
  private _maxError: number;
  private _remapFunction: FractionMapper;

  private constructor(
    method: EllipticalArcSampleMethod,
    numSamplesInQuadrant: number,
    maxError: number,
    remapFunction: FractionMapper,
  ) {
    this._sampleMethod = method;
    this._numSamplesInQuadrant = numSamplesInQuadrant;
    this._maxError = maxError;
    this._remapFunction = remapFunction;
  }
  /**
   * Construct options with optional defaults.
   * @param method sample method, default [[EllipticalArcSampleMethod.UniformParameter]].
   * @param structuredOutput output format, default false.
   * @param numSamplesInQuadrant samples in each full quadrant for interpolation methods, default 4.
   * @param maxError max distance to ellipse for subdivision methods, default 1cm.
   * @param remapFunction optional callback to remap fraction space for [[EllipticalArcSampleMethod.NonUniformCurvature]],
   * default identity.
   */
  public static create(
    method: EllipticalArcSampleMethod = EllipticalArcSampleMethod.UniformParameter,
    numSamplesInQuadrant: number = 4,
    maxError: number = 0.01,
    remapFunction: FractionMapper = (f: number) => f,
  ) {
    if (numSamplesInQuadrant < 2)
      numSamplesInQuadrant = 2;
    if (maxError < 0)
      maxError = 0.01;
    return new EllipticalArcApproximationOptions(method, numSamplesInQuadrant, maxError, remapFunction);
  }
  /** Clone the options. */
  public clone(): EllipticalArcApproximationOptions {
    return new EllipticalArcApproximationOptions(
      this.sampleMethod, this.numSamplesInQuadrant, this.maxError, this.remapFunction,
    );
  }

  /** Method used to sample the elliptical arc. */
  public get sampleMethod(): EllipticalArcSampleMethod {
    return this._sampleMethod;
  }
  public set sampleMethod(method: EllipticalArcSampleMethod) {
    this._sampleMethod = method;
  }
  /**
   * Number of samples to return in each full quadrant, including endpoint(s).
   * * Used by interpolation sample methods.
   * * For n samples of an elliptical arc, one can construct an approximating chain consisting of n-1 chords or arcs.
   * * Minimum value is 2.
   */
  public get numSamplesInQuadrant(): number {
    return this._numSamplesInQuadrant;
  }
  public set numSamplesInQuadrant(numSamples: number) {
    this._numSamplesInQuadrant = numSamples;
  }
  /**
   * Maximum distance of an approximation based on the sample points to the elliptical arc.
   * * Used by subdivision sample methods.
   */
  public get maxError(): number {
    return this._maxError;
  }
  public set maxError(error: number) {
    this._maxError = error;
  }
  /**
   * Callback function to remap fraction space to fraction space.
   * * Used by [[EllipticalArcSampleMethod.NonUniformCurvature]].
   */
  public get remapFunction(): FractionMapper {
    return this._remapFunction;
  }
  public set remapFunction(f: FractionMapper) {
    this._remapFunction = f;
  }
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
  private constructor(quadrant: 1 | 2 | 3 | 4, fractions: number[]) {
    this._quadrant = quadrant;
    this._fractions = fractions;
    this._axisAtStart = false;
    this._axisAtEnd = false;
    this._averageAdded = false;
  }
  /** Constructor, captures the array. */
  public static create(quadrant: 1 | 2 | 3 | 4, fractions: number[] = []): QuadrantFractions {
    return new QuadrantFractions(quadrant, fractions);
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
   * Whether the average fraction was added to produce a fractions array of length 3.
   * * Some sample methods and elliptical arcs may not yield enough samples in a quadrant. A minimum of three samples
   * ensures that [[EllipticalArcApproximationContext.constructCircularArcChainApproximation]] has enough data to
   * interpolate both axis/endpoints in the quadrant.
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
 * Interface implemented by sampler classes.
 * * Implementation constructors are assumed to supply the sampler with the ellipse and relevant parameters.
 * @internal
 */
interface EllipticalArcSampler {
  /**
   * Return samples interior to the first quadrant of the (full) ellipse.
   * * Samples are returned as an unordered array of radian angles in the open interval (0, pi/2).
   * @param result optional preallocated array to populate and return
   * @return array of radian angles
   */
  computeSamplesStrictlyInsideQuadrant1(result?: number[]): number[];
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
  public computeSamplesStrictlyInsideQuadrant1(result?: number[]): number[] {
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
    // extreme curvatures occur at the axis points
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
      K(t) := ||f'(t) x f"(t)||/||f'(t)||^3
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
  public computeSamplesStrictlyInsideQuadrant1(result?: number[]): number[] {
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
 * Implementation for method `EllipticalArcSampleMethod.UniformCurvature`
 * @internal
 */
class UniformCurvatureSampler extends NonUniformCurvatureSampler implements EllipticalArcSampler {
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    super(c, o.clone());
    this._options.remapFunction = (f: number) => f;
  }
  public static override create(
    context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions,
  ): UniformCurvatureSampler {
    return new UniformCurvatureSampler(context, options);
  }
};
/**
 * Implementation for method `EllipticalArcSampleMethod.SubdivideForChords`
 * @internal
 */
class SubdivideForChordsSampler implements EllipticalArcSampler {
  private _context: EllipticalArcApproximationContext;
  private _options: EllipticalArcApproximationOptions;
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    this._context = c;
    this._options = o;
  }
  public static create(
    context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions,
  ): SubdivideForChordsSampler {
    return new SubdivideForChordsSampler(context, options);
  }
  public computeSamplesStrictlyInsideQuadrant1(result?: number[]): number[] {
    if (!result)
      result = [];
    if (this._context.isValidArc) {
      // TODO:
    }
    return result;
  }
}
/**
 * Implementation for method `EllipticalArcSampleMethod.SubdivideForArcs`
 * @internal
 */
class SubdivideForArcsSampler implements EllipticalArcSampler {
  private _context: EllipticalArcApproximationContext;
  private _options: EllipticalArcApproximationOptions;
  private constructor(c: EllipticalArcApproximationContext, o: EllipticalArcApproximationOptions) {
    this._context = c;
    this._options = o;
  }
  public static create(
    context: EllipticalArcApproximationContext, options: EllipticalArcApproximationOptions,
  ): SubdivideForArcsSampler {
    return new SubdivideForArcsSampler(context, options);
  }
  public computeSamplesStrictlyInsideQuadrant1(result?: number[]): number[] {
    if (!result)
      result = [];
    if (this._context.isValidArc) {
      // TODO:
    }
    return result;
  }
}

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
   * Optionally announce a chord of the elliptical arc between the given fractions.
   * @param pt0 start point of the chord segment
   * @param pt1 end point of the chord segment
   * @param f0 elliptical arc parameter in [0,1] of pt0
   * @param f1 elliptical arc parameter in [0,1] of pt1
   */
  public announceChord?(pt0: Point3d, pt1: Point3d, f0: number, f1: number): void;
  /**
   * Optionally announce a circular arc approximating the elliptical arc between the given fractions.
   * @param arc circular arc interpolating the ellipse at the given fractions.
   * * The processor is allowed to capture `arc`, e.g., to add it to a growing chain approximation.
   * @param f0 elliptical arc parameter in [0,1], unordered with respect to f1
   * @param f1 elliptical arc parameter in [0,1], unordered with respect to f0
   */
  public announceArc?(arc: Arc3d, f0: number, f1: number): void;
  /**
   * Announce the end of processing of the samples in a given quadrant.
   * @param _wasReversed whether this quadrant's samples were processed in reverse
  */
  public announceQuadrantEnd(_wasReversed: boolean): void {}
};

/**
 * Intermediate class for computing the error of a sample-based approximation.
 * @internal
 */
class ErrorProcessor extends QuadrantFractionsProcessor {
  private _ellipticalArc: Arc3d;
  private _maxError: CurveLocationDetailPair | undefined;
  protected constructor(ellipticalArc: Arc3d) {
    super();
    this._ellipticalArc = ellipticalArc;
    this._maxError = undefined;
  }
  protected get ellipticalArc(): Arc3d {
    return this._ellipticalArc;
  }
  public get maxError(): CurveLocationDetailPair | undefined {
    return this._maxError;
  }
  protected set maxError(newMaxError: CurveLocationDetailPair) {
    this._maxError = newMaxError;
  }
  /**
   * Compute the maximum xy-distance between an elliptical arc, and its segment or circular arc approximation.
   * * Inputs should be in horizontal plane(s), as z-coordinates are ignored.
   * @param arc elliptical arc being approximated. Sweep outside the extents of the approximation is ignored.
   * @param approximation circular arc, or segment, assumed to start and end on the elliptical arc.
   * @return details of the perpendicular measuring the max approximation error, or undefined if no such perpendicular.
   * For each of `detailA` (corresponding to `arc`) and `detailB` (corresponding to `approximation`):
   * * `point` is the end of the perpendicular on each curve
   * * `fraction` is the curve parameter of the point
   * * `a` is the distance between the points.
   */
  private static computePrimitiveErrorXY(arc: Arc3d, approximation: Arc3d | LineSegment3d): CurveLocationDetailPair | undefined {
    const handler = new CurveCurveCloseApproachXY();
    handler.maxDistanceToAccept = approximation.quickLength() / 2;
    // we expect only one perpendicular, not near an endpoint
    // TODO: if performance is a problem, refactor to send fewer seeds into Newton (they should be near 0.5)
    if (approximation instanceof Arc3d)
      handler.allPerpendicularsArcArcBounded(arc, approximation);
    else
      handler.allPerpendicularsSegmentArcBounded(approximation, approximation.point0Ref, 0, approximation.point1Ref, 1, arc, true);
    let maxPerp: CurveLocationDetailPair | undefined;
    for (const approach of handler.grabPairedResults()) {
      if (Geometry.isAlmostEqualEitherNumber(approach.detailA.fraction, 0, 1, Geometry.smallFraction))
        continue; // rule out perpendiculars on arc ends
      if (Geometry.isAlmostEqualEitherNumber(approach.detailB.fraction, 0, 1, Geometry.smallFraction))
        continue; // rule out perpendiculars on approx ends
      const error = approach.detailA.a = approach.detailB.a = approach.detailA.point.distanceXY(approach.detailB.point);
      if (!maxPerp || maxPerp.detailA.a < error)
        maxPerp = approach;
    }
    return maxPerp;
  }
  /**
   * Update the chain approximation error for a given chain child that approximates the instance arc between the given fractions.
   * * Fractional sweep of the arc is the smaller of the cyclic sweeps.
  */
  protected updateMaxError(approximation: Arc3d | LineSegment3d, f0: number, f1: number): void {
    const maxPerp = ErrorProcessor.computePrimitiveErrorXY(this.ellipticalArc.clonePartialCurve(f0, f1), approximation);
    if (maxPerp && (!this.maxError || this.maxError.detailA.a < maxPerp.detailA.a))
      this.maxError = maxPerp;
  };
};
/**
 * Processor for computing the error of a sample-based arc chain approximation.
 * @internal
 */
class ArcChainErrorProcessor extends ErrorProcessor {
  public constructor(ellipticalArc: Arc3d) {
    super(ellipticalArc);
  }
  public override announceArc(arc: Arc3d, f0: number, f1: number): void {
    this.updateMaxError(arc, f0, f1);
  }
}
/**
 * Processor for computing the error of a sample-based linestring approximation.
 * @internal
 */
class LineStringErrorProcessor extends ErrorProcessor {
  public constructor(ellipticalArc: Arc3d) {
    super(ellipticalArc);
  }
  public override announceChord(pt0: Point3d, pt1: Point3d, f0: number, f1: number): void {
    this.updateMaxError(LineSegment3d.create(pt0, pt1), f0, f1);
  }
}

/**
 * Intermediate class for constructing a sample-based approximation.
 * @internal
 */
class ConstructionProcessor extends QuadrantFractionsProcessor {
  protected _chain: CurveChain;
  protected _quadrantChain?: CurveChain;
  public constructor(ellipticalArc: Arc3d) {
    super();
    this._chain = ellipticalArc.sweep.isFullCircle ? Loop.create() : Path.create();
  }
  public get chain(): CurveChain | undefined {
    return this._chain.children.length > 0 ? this._chain : undefined;
  }
  public override announceQuadrantBegin(_q: QuadrantFractions): boolean {
    this._quadrantChain = undefined;
    return true;
  }
  public override announceQuadrantEnd(wasReversed: boolean): void {
    if (this._quadrantChain) {
      if (wasReversed)
        this._quadrantChain.reverseChildrenInPlace();
      for (const child of this._quadrantChain.children)
        this._chain.tryAddChild(child); // captured!
    }
  }
};
/**
 * Processor for constructing a sample-based arc chain approximation.
 * @internal
 */
class ArcChainConstructionProcessor extends ConstructionProcessor {
  public constructor(ellipticalArc: Arc3d) {
    super(ellipticalArc);
  }
  public override announceArc(arc: Arc3d, _f0: number, _f1: number): void {
    if (!this._quadrantChain)
      this._quadrantChain = Path.create();
    this._quadrantChain.tryAddChild(arc); // captured!
  }
};
/**
 * Processor for constructing a sample-based linestring approximation.
 * @internal
 */
class LineStringConstructionProcessor extends ConstructionProcessor {
  public constructor(ellipticalArc: Arc3d) {
    super(ellipticalArc);
    this._chain = ellipticalArc.sweep.isFullCircle ? Loop.create() : Path.create();
  }
  public override get chain(): CurveChain | undefined {
    const myLineString: LineString3d[] = [];
    CurveOps.collectChainsAsLineString3d(this._chain.children, (ls: LineString3d) => { myLineString.push(ls); });
    if (myLineString.length < 1)
      return undefined;
    assert(myLineString.length === 1);
    this._chain.children.length = 0;
    this._chain.children.push(myLineString[0]);
    return this._chain;
  }
  public override announceChord(pt0: Point3d, pt1: Point3d, _f0: number, _f1: number): void {
    if (!this._quadrantChain)
      this._quadrantChain = Path.create();
    this._quadrantChain.tryAddChild(LineSegment3d.create(pt0, pt1));
  }
};

/**
 * Context for sampling a non-circular Arc3d, e.g., to construct an approximation.
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

  /** captures input */
  private constructor(arc: Arc3d) {
    const scaledData = arc.toScaledMatrix3d();
    this._arc = Arc3d.createScaledXYColumns(
      scaledData.center, scaledData.axes, scaledData.r0, scaledData.r90, scaledData.sweep,
    );
    this._localToWorld = Transform.createRefs(scaledData.center, scaledData.axes);
    this._isValidArc = false;
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
  /** The arc to be sampled. Its axes are forced to be perpendicular. */
  public get arc(): Arc3d {
    return this._arc;
  }
  /** The rigid transformation that rotates and translates the arc into the xy-plane at the origin. */
  public get localToWorld(): Transform {
    return this._localToWorld;
  }
  /** Whether the arc is amenable to sampling. */
  public get isValidArc(): boolean {
    return this._isValidArc;
  }
  /** Process structured sample data for the given elliptical arc. */
  private static processQuadrantFractions(ellipticalArc: Arc3d, samples: QuadrantFractions[], processor: QuadrantFractionsProcessor): void {
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
    const createFirstArc = (f0: number, f1: number, reverse: boolean) => {
      ellipticalArc.fractionToPointAndDerivative(f0, ray);
      pt0.setFrom(ray.origin);
      pt2.setFrom(ellipticalArc.fractionToPoint(f1, pt1)); // set pt2 in case no inner arcs
      if (processor.announceArc) {
        if (reverse)
          ray.direction.scaleInPlace(-1);
        processor.announceArc(arcBetween2Samples(ray, pt1, false), f0, f1);
      }
      if (processor.announceChord)
        processor.announceChord(pt0, pt1, f0, f1);
      return { p0: pt0, p1: pt1, p2: pt2 };
    };
    const arcBetweenLast2Of3Samples = (firstPt: Point3d, arcStart: Point3d, arcEnd: Point3d): Arc3d => {
      // assume non-colinear inputs
      const arc = Arc3d.createCircularStartMiddleEnd(firstPt, arcStart, arcEnd) as Arc3d;
      const startAngle = arc.vector0.signedAngleTo(Vector3d.createStartEnd(arc.center, arcStart), arc.matrixRef.columnZ());
      arc.sweep.setStartEndRadians(startAngle.radians, arc.sweep.endRadians);
      return arc;
    };
    const createInnerArc = (p0: Point3d, p1: Point3d, f1: number, f2: number) => {
      const p2 = ellipticalArc.fractionToPoint(f2, pt2);
      if (processor.announceArc)
        processor.announceArc(arcBetweenLast2Of3Samples(p0, p1, p2), f1, f2);
      if (processor.announceChord)
        processor.announceChord(p1, p2, f1, f2);
      p0.setFrom(p1);
      p1.setFrom(p2);
      return { p0, p1, p2 };
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
      if (processor.announceChord)
        processor.announceChord(p0, ray.origin, f0, f1);
    };
    const reverseFractionsForSymmetry = (q: QuadrantFractions): boolean => {
      // for symmetry, start at major axis so the approximation exhibits axial symmetry
      const reverse = xAxisIsMajor ? (q.quadrant === 2 || q.quadrant === 4) : (q.quadrant === 1 || q.quadrant === 3);
      if (reverse)
        q.fractions.reverse();
      return reverse;
    };

    const xAxisIsMajor = ellipticalArc.vector0.magnitudeSquared() > ellipticalArc.vector90.magnitudeSquared();
    for (const q of samples) {
      const n = q.fractions.length;
      if (n < 2 || !processor.announceQuadrantBegin(q))
        continue;
      const reverse = reverseFractionsForSymmetry(q);
      let pts = createFirstArc(q.fractions[0], q.fractions[1], reverse);
      for (let i = 2; i < n - 1; ++i) // need at least 4 samples to make inner arcs
        pts = createInnerArc(pts.p0, pts.p1, q.fractions[i - 1], q.fractions[i]);
      if (n > 2)
        createLastArc(pts.p2, q.fractions[n - 2], q.fractions[n - 1], reverse);
      if (reverse)
        q.fractions.reverse();  // restore original order just to be safe
      processor.announceQuadrantEnd(reverse);
    }
  }
  /**
   * Compute the maximum error of the given approximation.
   * * This is measured by the longest perpendicular between the elliptical arc and its approximation.
   * @param samples structured sample data for the instance's elliptical arc.
   * @param arcChain whether to compute approximation error of a circular arc chain (true) or linestring (false)
   * @return details of the perpendicular measuring the max approximation error, or undefined if no such perpendicular.
   * For each of `detailA` and `detailB`:
   * * `point` is the end of the perpendicular on each curve
   * * `fraction` is the curve parameter of the point
   * * `a` is the distance between the points.
   */
  public computeApproximationError(samples: QuadrantFractions[], arcChain: boolean): CurveLocationDetailPair | undefined {
    if (!this.isValidArc)
      return undefined;
    if (this.localToWorld.matrix.isSingular())
      return undefined;
    const worldToLocal = this.localToWorld.inverse()!;
    const arcXY = this.arc.cloneTransformed(worldToLocal);
    const processor = arcChain ? new ArcChainErrorProcessor(arcXY) : new LineStringErrorProcessor(arcXY);
    EllipticalArcApproximationContext.processQuadrantFractions(arcXY, samples, processor);
    const maxError = processor.maxError;
    return (maxError && maxError.tryTransformInPlace(this.localToWorld)) ? maxError : undefined;
  }
  /**
   * Compute samples for the elliptical arc as fraction parameters.
   * @param options approximation options
   * @param structuredOutput
   * * If false (default), return all fractions in one sorted (increasing), deduplicated array (a full ellipse includes both 0 and 1).
   * * If true, fractions are assembled by quadrants:
   *   * Each [[QuadrantFractions]] object holds at least three sorted (increasing), deduplicated fractions in a
   * specified quadrant of the arc.
   *   * If only two fractions would be computed in a given `QuadrantFractions`, their midpoint is inserted to enable
   * tangent interpolation at both ends. Such a quadrant is marked
   *   * The `QuadrantFractions` objects themselves are sorted by increasing order of the fractions they contain.
   *   * If the arc sweep spans adjacent quadrants, the fraction bordering the quadrants appears in both `QuadrantFractions`.
   *   * If the arc starts and ends in the same quadrant, two `QuadrantFractions` objects can be returned.
   *   * This means there are between 1 and 5 objects in the `QuadrantFractions` array.
   */
  public sampleFractions(options: EllipticalArcApproximationOptions, structuredOutput: boolean = false): QuadrantFractions[] | number[] {
    if (!this.isValidArc)
      return [];
    const compareFractions: OrderedComparator<number> = (f0: number, f1: number): number => {
      if (Geometry.isAlmostEqualNumber(f0, f1, Geometry.smallFraction))
        return 0;
      return f0 < f1 ? -1 : 1;
    };
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
    const convertAndAddRadiansToFractionInRange = (dest: OrderedSet<number>, radians: number, sweep: AngleSweep, f0?: number, f1?: number): number | undefined => {
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
    const convertQ1RadiansInSweepToQuadrantFractions = (anglesInQ1: number[], angle0: number, angle1: number): QuadrantFractions | undefined => {
      if (angle0 > angle1)
        return convertQ1RadiansInSweepToQuadrantFractions(anglesInQ1, angle1, angle0);
      if (Angle.isAlmostEqualRadiansNoPeriodShift(angle0, angle1))
        return undefined; // empty sweep
      const qData = QuadrantFractions.getQuadrantRadians(angle0, angle1);
      if (undefined === qData)
        return undefined; // no containing quadrant
      const qFractions = new OrderedSet<number>(compareFractions);
      const f0 = convertAndAddRadiansToFractionInRange(qFractions, angle0, this.arc.sweep);
      const f1 = convertAndAddRadiansToFractionInRange(qFractions, angle1, this.arc.sweep);
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
        convertAndAddRadiansToFractionInRange(qFractions, angle, this.arc.sweep, f0, f1);
      }
      const qf = QuadrantFractions.create(qData.quadrant, [...qFractions]);
      const n = qf.fractions.length;
      const qFrac0 = this.arc.sweep.radiansToSignedPeriodicFraction(qData.angle0);
      const qFrac1 = this.arc.sweep.radiansToSignedPeriodicFraction(qData.angle1);
      qf.axisAtStart = Geometry.isAlmostEqualEitherNumber(qf.fractions[0], qFrac0, qFrac1, Geometry.smallFraction);
      qf.axisAtEnd = Geometry.isAlmostEqualEitherNumber(qf.fractions[n - 1], qFrac0, qFrac1, Geometry.smallFraction);
      if (2 === n) {
        qf.fractions.splice(1, 0, Geometry.interpolate(qf.fractions[0], 0.5, qf.fractions[1]));
        qf.averageAdded = true;
      }
      return qf;
    };
    const computeStructuredOutput = (anglesInQ1: number[]): QuadrantFractions[] => {
      const qEndAngles = new OrderedSet<number>(this.arc.sweep.isCCW ? compareRadiansIncreasing : compareRadiansDecreasing);
      qEndAngles.add(this.arc.sweep.endRadians);
      for (const qAngle of [0, Angle.piOver2Radians, Angle.piRadians, Angle.pi3Over2Radians, Angle.pi2Radians]) {
        const shifted = shiftRadiansToSweep(qAngle, this.arc.sweep);
        if (shifted.inSweep)
          qEndAngles.add(shifted.angle);
      }
      const quadrants = new OrderedSet<QuadrantFractions>(compareQuadrantFractions);
      let a0 = this.arc.sweep.startRadians;
      for (const a1 of qEndAngles) {
        const quadrant = convertQ1RadiansInSweepToQuadrantFractions(anglesInQ1, a0, a1);
        if (quadrant)
          quadrants.add(quadrant);
        a0 = a1;
      }
      return [...quadrants];
    };
    const computeFlatOutput = (anglesInQ1: number[]): number[] => {
      // Flat array output: first add quadrant fractions so the set prefers them over nearby interior fractions
      const fractions = new OrderedSet<number>(compareFractions);
      fractions.add(0);
      fractions.add(1);
      for (const angle of [0, Angle.piOver2Radians, Angle.piRadians, Angle.pi3Over2Radians])
        convertAndAddRadiansToFractionInRange(fractions, angle, this.arc.sweep);
      // Add interior Q1 fractions, reflect to the other quadrants, filter by sweep and extant entry
      for (const angle0 of anglesInQ1) {
        for (const angle of [angle0, Angle.piRadians - angle0, Angle.piRadians + angle0, Angle.pi2Radians - angle0])
          convertAndAddRadiansToFractionInRange(fractions, angle, this.arc.sweep);
      }
      return [...fractions];
    };
    // Sample the (full) ellipse as angles in strict interior of Quadrant 1
    const radiansQ1: number[] = []; // unordered
    switch (options.sampleMethod) {
      case EllipticalArcSampleMethod.UniformParameter: {
        UniformParameterSampler.create(this, options).computeSamplesStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.UniformCurvature: {
        UniformCurvatureSampler.create(this, options).computeSamplesStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.NonUniformCurvature: {
        NonUniformCurvatureSampler.create(this, options).computeSamplesStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.SubdivideForChords: {
        SubdivideForChordsSampler.create(this, options).computeSamplesStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      case EllipticalArcSampleMethod.SubdivideForArcs: {
        SubdivideForArcsSampler.create(this, options).computeSamplesStrictlyInsideQuadrant1(radiansQ1);
        break;
      }
      default:
        break;
    }
    return structuredOutput ? computeStructuredOutput(radiansQ1) : computeFlatOutput(radiansQ1);
  }
  /** Construct a linestring approximation to the elliptical arc. */
  public constructLineStringApproximation(options: EllipticalArcApproximationOptions): CurveChain | undefined {
    if (!this.isValidArc)
      return undefined;
    const processor = new LineStringConstructionProcessor(this.arc);
    const samples = this.sampleFractions(options, true) as QuadrantFractions[];
    EllipticalArcApproximationContext.processQuadrantFractions(this.arc, samples, processor);
    return processor.chain;
  }
  /** Construct a circular arc chain approximation to the elliptical arc. */
  public constructCircularArcChainApproximation(options: EllipticalArcApproximationOptions): CurveChain | undefined {
    if (!this.isValidArc)
      return undefined;
    const processor = new ArcChainConstructionProcessor(this.arc);
    const samples = this.sampleFractions(options, true) as QuadrantFractions[];
    EllipticalArcApproximationContext.processQuadrantFractions(this.arc, samples, processor);
    return processor.chain;
  }
}
