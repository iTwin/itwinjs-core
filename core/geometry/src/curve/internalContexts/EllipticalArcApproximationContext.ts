/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { OrderedComparator, OrderedSet } from "@itwin/core-bentley";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Range1d } from "../../geometry3d/Range";
import { Arc3d } from "../Arc3d";
import { CurveChain } from "../CurveCollection";
import { LineString3d } from "../LineString3d";

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
 * Options for [[EllipticalArcApproximationContext.sampleFractions]]
 * @internal
 */
export class EllipticalArcApproximationOptions {
  private _sampleMethod: EllipticalArcSampleMethod;
  private _structuredOutput: boolean;
  private _numSamplesInQuadrant: number;
  private _maxError: number;
  private _remapFunction: FractionMapper;

  private constructor(method: EllipticalArcSampleMethod, structuredOutput: boolean, numSamplesInQuadrant: number, maxError: number, remapFunction: FractionMapper) {
    this._sampleMethod = method;
    this._structuredOutput = structuredOutput;
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
   * @param remapFunction optional callback to remap fraction space for [[EllipticalArcSampleMethod.NonUniformCurvature]], default identity.
   */
  public static create(
    method: EllipticalArcSampleMethod = EllipticalArcSampleMethod.UniformParameter,
    structuredOutput: boolean = false,
    numSamplesInQuadrant: number = 4,
    maxError: number = 0.01,
    remapFunction: FractionMapper = (f: number) => f,
  ) {
    if (numSamplesInQuadrant < 2)
      numSamplesInQuadrant = 2;
    return new EllipticalArcApproximationOptions(method, structuredOutput, numSamplesInQuadrant, maxError, remapFunction);
  }
  /** Clone the options. */
  public clone(): EllipticalArcApproximationOptions {
    return new EllipticalArcApproximationOptions(this.sampleMethod, this.structuredOutput, this.numSamplesInQuadrant, this.maxError, this.remapFunction);
  }

  /** Method used to sample the elliptical arc. */
  public get sampleMethod(): EllipticalArcSampleMethod {
    return this._sampleMethod;
  }
  public set sampleMethod(method: EllipticalArcSampleMethod) {
    this._sampleMethod = method;
  }
  /**
   * Whether to return sample fractions grouped by quadrant.
   * * If false (default), return all fractions in one sorted, deduplicated array. Full ellipse includes both 0 and 1.
   * * If true, fractions are assembled by quadrants:
   * * * Each [[QuadrantFractions]] object holds sorted fractions in a specified quadrant of the arc.
   * * * The `QuadrantFractions` objects themselves are sorted by increasing fraction order.
   * * * If the arc sweep spans adjacent quadrants, the fraction bordering the quadrants appears in both `QuadrantFractions`.
   * * * If the arc starts and ends in the same quadrant, two `QuadrantFractions` objects can be returned.
   * * * This means there are between 1 and 5 objects in the `QuadrantFractions` array.
   */
  public get structuredOutput(): boolean {
    return this._structuredOutput;
  }
  public set structuredOutput(flag: boolean) {
    this._structuredOutput = flag;
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
 * Data carrier used by the sampler.
 * @internal
*/
export class QuadrantFractions {
  private _quadrant: 1|2|3|4;
  private _fractions: number[];
  private _axisAtStart: boolean;
  private _axisAtEnd: boolean;
  private constructor(quadrant: 1|2|3|4, fractions: number[], axisAtStart: boolean, axisAtEnd: boolean) {
    this._quadrant = quadrant;
    this._fractions = fractions;
    this._axisAtStart = axisAtStart;
    this._axisAtEnd = axisAtEnd;
  }
  /** Constructor, captures the array. */
  public static create(quadrant: 1|2|3|4, fractions: number[] = [], axisAtStart: boolean = false, axisAtEnd: boolean = false): QuadrantFractions {
    return new QuadrantFractions(quadrant, fractions, axisAtStart, axisAtEnd);
  }
  /**
   * Quadrant of the full ellipse containing the samples.
   * * Quadrants are labeled proceeding in counterclockwise angular sweeps of length pi/2 starting at vector0.
   * * For example, Quadrant 1 starts at vector0 and ends at vector90, and Quadrant 4 ends at vector0.
   * * For purposes of angle classification, quadrants are half-open intervals, closed at their start angle,
   * as determined by the ellipse's sweep direction.
   */
  public get quadrant(): 1|2|3|4 {
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
   * Compute quadrant data for the given angles.
   * @param radians0 first radian angle
   * @param radians1 second radian angle
   * @return quadrant number and start/end radian angles for the quadrant that contains both input angles, or undefined if no such quadrant.
   * * The returned sweep is always counterclockwise: angle0 < angle1.
   */
  public static getQuadrantRadians(radians0: number, radians1: number): { quadrant: 1|2|3|4, angle0: number, angle1: number} | undefined {
    if (AngleSweep.isRadiansInStartEnd(radians0, 0, Angle.piOver2Radians) && AngleSweep.isRadiansInStartEnd(radians1, 0, Angle.piOver2Radians))
      return { quadrant: 1, angle0: 0, angle1: Angle.piOver2Radians};
    if (AngleSweep.isRadiansInStartEnd(radians0, Angle.piOver2Radians, Angle.piRadians) && AngleSweep.isRadiansInStartEnd(radians1, Angle.piOver2Radians, Angle.piRadians))
      return { quadrant: 2, angle0: Angle.piOver2Radians, angle1: Angle.piRadians };
    if (AngleSweep.isRadiansInStartEnd(radians0, Angle.piRadians, Angle.pi3Over2Radians) && AngleSweep.isRadiansInStartEnd(radians1, Angle.piRadians, Angle.pi3Over2Radians))
      return { quadrant: 3, angle0: Angle.piRadians, angle1: Angle.pi3Over2Radians };
    if (AngleSweep.isRadiansInStartEnd(radians0, Angle.pi3Over2Radians, Angle.pi2Radians) && AngleSweep.isRadiansInStartEnd(radians1, Angle.pi3Over2Radians, Angle.pi2Radians))
      return { quadrant: 4, angle0: Angle.pi3Over2Radians, angle1: Angle.pi2Radians };
    return undefined;
  }
};

/**
 * Context for sampling a non-circular Arc3d, e.g., to construct an approximation.
 * @internal
 */
export class EllipticalArcApproximationContext {
  private _arc: Arc3d;
  private _axx: number;
  private _ayy: number;
  private _curvatureRange: Range1d;
  private _isValidArc: boolean;
  /** captures input */
  private constructor(arc: Arc3d) {
    const scaledData = arc.toScaledMatrix3d();
    this._arc = Arc3d.createScaledXYColumns(scaledData.center, scaledData.axes, scaledData.r0, scaledData.r90, scaledData.sweep);
    this._axx = arc.matrixRef.columnXMagnitudeSquared();
    this._ayy = arc.matrixRef.columnYMagnitudeSquared();
    this._curvatureRange = Range1d.createNull();
    this._isValidArc = !this._arc.sweep.isEmpty;  // ellipse must have a nonzero sweep
    if (Geometry.isSmallMetricDistanceSquared(this._axx) || Geometry.isSmallMetricDistanceSquared(this._ayy))
      this._isValidArc = false; // ellipse must have positive radii
    else if (Geometry.isSameCoordinateSquared(this._axx, this._ayy))
      this._isValidArc = false; // ellipse must not be circular
    else {
      // extreme curvatures are at the axis points
      this._curvatureRange.extendX(Math.sqrt(this._axx) / this._ayy);
      this._curvatureRange.extendX(Math.sqrt(this._ayy) / this._axx);
    }
  }
  /** Constructor, clones input. */
  public static create(arc: Arc3d) {
    return new EllipticalArcApproximationContext(arc);
  }
  /** The arc to be sampled. Its axes are forced to be perpendicular. */
  public get arc(): Arc3d {
    return this._arc;
  }
  /** The squared length of the arc axis at angle 0 degrees. */
  public get vector0LengthSquared(): number {
    return this._axx;
  }
  /** The squared length of the arc axis at angle 90 degrees. */
  public get vector90LengthSquared(): number {
    return this._ayy;
  }
  /** The curvature range of the arc. These extrema occur at its axis points. */
  public get curvatureRange(): Range1d {
    return this._curvatureRange;
  }
  /** Whether the arc is amenable to sampling. */
  public get isValidArc(): boolean {
    return this._isValidArc;
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
    if (!this.isValidArc)
      return undefined;
    if (!this.curvatureRange.containsX(curvature))
      return undefined; // ellipse does not attain this curvature
    const lambda = Math.cbrt((this._axx * this._ayy) / (curvature * curvature));
    const cosTheta = Math.sqrt(Math.abs((lambda - this._axx) / (this._ayy - this._axx)));
    return Math.acos(cosTheta);
  }

  /** Compute the maximum distance between a full/partial approximation to this ellipse and the elliptical arc. */
  public computeError(approximation: Arc3d | LineString3d | CurveChain): number {
    let maxError = Geometry.largeCoordinateResult;
    if (approximation instanceof CurveChain) {
      for (const child of approximation.children) {
        if (child instanceof Arc3d) {
          const error = this.computeError(child);
          if (error < Geometry.largeCoordinateResult && maxError < error)
            maxError = error;
        }
      }
    } else if (approximation instanceof Arc3d && approximation.isCircular) {
      // TODO: can we do this directly without invoking CurveCurve stuff?
    } else {
      // TODO: compute max of segment errors
    }
    return maxError;
  }

  /** Compute samples for the elliptical arc as fraction parameters. */
  public sampleFractions(options: EllipticalArcApproximationOptions): QuadrantFractions[] | number[] {
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
    const compareQuadrantFractions: OrderedComparator<QuadrantFractions> = (q0: QuadrantFractions, q1: QuadrantFractions): number => {
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
    const convertQ1RadiansInSweepToQuadrantFractions = (anglesInQuadrant1: number[], angle0: number, angle1: number): QuadrantFractions | undefined => {
      if (angle0 > angle1)
        return convertQ1RadiansInSweepToQuadrantFractions(anglesInQuadrant1, angle1, angle0);
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
      for (const a0 of anglesInQuadrant1) {
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
      const qFrac0 = this.arc.sweep.radiansToSignedPeriodicFraction(qData.angle0);
      const qFrac1 = this.arc.sweep.radiansToSignedPeriodicFraction(qData.angle1);
      qf.axisAtStart = Geometry.isAlmostEqualEitherNumber(qf.fractions[0], qFrac0, qFrac1, Geometry.smallFraction);
      qf.axisAtEnd = Geometry.isAlmostEqualEitherNumber(qf.fractions[qf.fractions.length - 1], qFrac0, qFrac1, Geometry.smallFraction);
      return qf;
    };

    // Sample the ellipse in strict interior of Quadrant 1
    const radiansQ1: number[] = []; // unordered
    switch (options.sampleMethod) {
      case EllipticalArcSampleMethod.UniformParameter: {
        const aDelta = Angle.piOver2Radians / (options.numSamplesInQuadrant - 1);
        for (let i = 1; i < options.numSamplesInQuadrant - 1; ++i)
          radiansQ1.push(i * aDelta);
        break;
      }
      case EllipticalArcSampleMethod.UniformCurvature:
      case EllipticalArcSampleMethod.NonUniformCurvature: {
        const f = (options.sampleMethod === EllipticalArcSampleMethod.UniformCurvature) ? (x: number) => x : options.remapFunction;
        const tDelta = 1.0 / (options.numSamplesInQuadrant - 1);
        for (let i = 1; i < options.numSamplesInQuadrant - 1; ++i) {
          const j = f(i * tDelta);
          const curvature = (1 - j) * this.curvatureRange.low + j * this.curvatureRange.high;
          const angle = this.curvatureToRadians(curvature);
          if (undefined !== angle)
            radiansQ1.push(angle);
        }
        break;
      }
      default: {
        // TODO: subdivision methods. Refactor to factory pattern using a 1-method interface for each method to implement sampleQ1InteriorRadians.
        break;
      }
    }
    if (options.structuredOutput) {
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
        const quadrant = convertQ1RadiansInSweepToQuadrantFractions(radiansQ1, a0, a1);
        if (quadrant)
          quadrants.add(quadrant);
        a0 = a1;
      }
      return [...quadrants];
    }
    // Flat array output: first add quadrant fractions so the set prefers them over nearby interior fractions
    const fractions = new OrderedSet<number>(compareFractions);
    fractions.add(0);
    fractions.add(1);
    for (const angle of [0, Angle.piOver2Radians, Angle.piRadians, Angle.pi3Over2Radians])
      convertAndAddRadiansToFractionInRange(fractions, angle, this.arc.sweep);
    // Add interior Q1 fractions, reflect to the other quadrants, filter by sweep and extant entry
    for (const angle0 of radiansQ1) {
      for (const angle of [angle0, Angle.piRadians - angle0, Angle.piRadians + angle0, Angle.pi2Radians - angle0])
        convertAndAddRadiansToFractionInRange(fractions, angle, this.arc.sweep);
    }
    return [...fractions];
  }

  /** Construct a circular arc chain approximation to the elliptical arc. */
  public constructCircularArcChain(_options: EllipticalArcApproximationOptions): CurveChain | undefined {
    // TODO: call sampleFractions, generate Path/Loop
    return undefined;
  }
}
