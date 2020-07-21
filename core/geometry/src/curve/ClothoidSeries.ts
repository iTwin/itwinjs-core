/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { LineString3d } from "./LineString3d";
import { StrokeOptions } from "./StrokeOptions";
import { TransitionConditionalProperties } from "./TransitionSpiral";
import { Quadrature } from "../numerics/Quadrature";
/* tslint:disable: no-console */
/**
 * Methods to evaluate caller-specified number of terms of the x and y series for a clothoid.
 * Each instance has
 * * Number of x and y terms to use.
 * * constant for theta=c * x * x
 *    * This value is c=1/(2 R L)  for curve length L measured from inflection to point with radius R.
 */
export class ClothoidSeriesRLEvaluator {
  public numXTerms: number;
  public numYTerms: number;
  public constantDiv2LR: number;

  public constructor(constantDiv2LR: number, numXTerms: number = 4, numYTerms: number = 4) {
    this.constantDiv2LR = constantDiv2LR;
    this.numXTerms = numXTerms;
    this.numYTerms = numYTerms;
  }
  /** Return a deep clone. */
  public clone(): ClothoidSeriesRLEvaluator {
    return new ClothoidSeriesRLEvaluator(this.numXTerms, this.numYTerms, this.constantDiv2LR);
  }
  /**
   * Evaluate the series at a nominal distance along the curve.
   * @param s nominal distance along the curve.
   * @param numTerms
   */
  public pseudoDistanceToX(s: number, numTerms = this.numXTerms): number {
    // Write the series for cos (theta)
    // replace theta by s*s*c
    // integrate wrt s
    //  x = s - s^5 c^4/ 2 + s^9 c^8/(4!) - s^13 c^12 / 6!
    //  x = s(1 - (s^4 c^2/2) ( 1/5 -s^4 c^2 / (3*4)  ( 1/9 - ....) ) )
    let result = s;
    if (numTerms < 2)
      return result;
    const q1 = s * s * this.constantDiv2LR;
    const beta = - q1 * q1;
    let alpha = s;
    let m = 1;
    let n = 5;
    for (let i = 1; i <= numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha / n;
      m += 2;
      n += 4;
    }
    return result;
  }
  public pseudoDistanceToY(s: number, numTerms = this.numYTerms): number {
    // Write the series for sin (theta)
    // replace theta by s*s*c
    // integrate wrt s
    //  x = s^3 c^2/ 3( (1/3)) - s^7 c^6/(3!) ((1/7)) - s^11 c^10 / 5! ((1/9) - ...)
    const q1 = s * s * this.constantDiv2LR;
    let result = q1 * s / 3;
    if (numTerms < 2)
      return result;
    const beta = - q1 * q1;
    let alpha = q1 * s;
    let m = 2;
    let n = 7;
    for (let i = 1; i <= numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha / n;
      m += 2;
      n += 4;
    }
    return result;
  }
  public pseudoDistanceToDX(s: number, numTerms = this.numXTerms): number {
    // dX = 1 - s^4c^2/2 + s^8 c^4 / 4! -
    // new Term = old Term * beta / (m(m+1))
    let result = 1;
    if (this.numXTerms < 2)
      return result;
    const q1 = s * s * this.constantDiv2LR;
    const beta = - q1 * q1;
    let alpha = 1.0;
    let m = 1;
    for (let i = 1; i <= numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha;
      m += 2;
    }
    return result;
  }
  public pseudoDistanceToDY(s: number, numTerms = this.numYTerms): number {
    // dY = q - q^3/3!
    // q = s^2 c
    // dY = s^2 c - s^6 c^3/3! + s^10 c^5/ 5!
    // recurrence  advancing m by 2  alpha *= -(s^4 c^2) / (m(m+1))
    const q1 = s * s * this.constantDiv2LR;
    let result = q1;
    if (numTerms < 2)
      return result;
    const beta = - q1 * q1;
    let alpha = q1;
    let m = 2;
    for (let i = 1; i <= numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha;
      m += 2;
    }
    return result;
  }

  public pseudoDistanceToDDX(s: number): number {
    // DX is "cosine"
    // DDX is "- sine" series times chain rule dTheta/ds = 2 * s * this.constantDivLR
    const sine = this.pseudoDistanceToDY(s, this.numXTerms);
    return -2 * sine * s * this.constantDiv2LR;
  }
  public pseudoDistanceToDDY(s: number): number {
    // DY is "sine"
    // DDY is "cosine" series times chain rule dTheta/ds = 2 * s * this.constantDivLR
    const cosine = this.pseudoDistanceToDX(s, this.numYTerms);
    return cosine * 2 * s * this.constantDiv2LR;
  }

  public pseudoDistanceToPoint(s: number, result?: Point3d): Point3d {
    return Point3d.create(this.pseudoDistanceToX(s), this.pseudoDistanceToY(s), 0.0, result);
  }
  public pseudoDistanceToPointAndDerivative(s: number, result?: Ray3d): Ray3d {
    return Ray3d.createXYZUVW(this.pseudoDistanceToX(s), this.pseudoDistanceToY(s), 0.0,
      this.pseudoDistanceToDX(s), this.pseudoDistanceToDY(s), 0,
      result);
  }
  public pseudoDistanceToPointAnd2Derivatives(s: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      this.pseudoDistanceToX(s), this.pseudoDistanceToY(s), 0.0,
      this.pseudoDistanceToDX(s), this.pseudoDistanceToDY(s), 0,
      this.pseudoDistanceToDDX(s), this.pseudoDistanceToDDY(s), 0,
      result);
  }
  /**
   * Return the magnitude of the tangent vector at nominal distance s.
   * * This magnitude is always very close to 1.
   * @param s nominal distance along the curve
   */
  public pseudoDistanceToTangentMagnitude(s: number): number {
    const u = this.pseudoDistanceToDX(s);
    const v = this.pseudoDistanceToDY(s);
    return Geometry.hypotenuseSquaredXY(u, v);
  }
  // Class resources for integration . . .
  // These static variables are reused on calls to integrateFromStartFraction
  private static _gaussX: Float64Array;
  private static _gaussWeight: Float64Array;
  private static _gaussMapper: (xA: number, xB: number, arrayX: Float64Array, arrayW: Float64Array) => number;
  /** Initialize class level work arrays. */
  public static initWorkSpace() {
    ClothoidSeriesRLEvaluator._gaussX = new Float64Array(5);
    ClothoidSeriesRLEvaluator._gaussWeight = new Float64Array(5);
    ClothoidSeriesRLEvaluator._gaussMapper = Quadrature.setupGauss5;
  }
  /**
   * Integrate between nominal distances with default gauss rule.
   * @param pseudoDistance0
   * @param pseudoDistance1
   */
  public gaussIntegralLength(pseudoDistance0: number, pseudoDistance1: number): number {
    const gaussX = ClothoidSeriesRLEvaluator._gaussX;
    const gaussWeight = ClothoidSeriesRLEvaluator._gaussWeight;
    const numEval = ClothoidSeriesRLEvaluator._gaussMapper(pseudoDistance0, pseudoDistance1, gaussX, gaussWeight);
    let sum = 0;
    for (let k = 0; k < numEval; k++) {
      sum += gaussWeight[k] * this.pseudoDistanceToTangentMagnitude(gaussX[k]);
    }
    return sum;
  }
}
// at load time, initialize gauss quadrature workspace
ClothoidSeriesRLEvaluator.initWorkSpace();
/**
 * A transition spiral is a curve defined by its curvature, with the curvature function symmetric about midpoint.
 * * `TransitionConditionalProperties` implements the computations of the interrelationship of radii, bearing, and length.
 * @alpha
 */
export class ClothoidSeriesSpiral3d extends CurvePrimitive {

  /** String name for schema properties */
  public readonly curvePrimitiveType = "transitionSpiral";

  /** Fractional interval for the "active" part of a containing spiral.
   * (The radius, angle, and length conditions define a complete spiral, and some portion of it is "active")
   */

  /** Placement transform */
  public localToWorld: Transform;
  /** stroked approximation of entire spiral. */
  private _globalStrokes: LineString3d;
  /** stroked approximation of active spiral.
   * * Same count as global -- possibly overly fine, but it gives some consistency between same clothoid constructed as partial versus complete.
   * * If no trimming, this points to the same place as the _globalStrokes !!!  Don't double transform!!!
   */
  private _activeStrokes?: LineString3d;
  /** Return the internal stroked form of the (possibly partial) spiral   */
  public get activeStrokes(): LineString3d { return this._activeStrokes !== undefined ? this._activeStrokes : this._globalStrokes; }

  /** string name of spiral type */
  private _spiralType: string;
  private _originalProperties: TransitionConditionalProperties | undefined;
  private _activeFractionInterval: Segment1d;
  private _nominalL1: number;
  private _nominalR1: number;
  private _evaluator: ClothoidSeriesRLEvaluator;
  /** Return the number of terms being used for evaluation of X. */
  public get numXTerms(): number { return this._evaluator.numXTerms; }
  /** Return the number of terms being used for evaluation of Y. */
  public get numYTerms(): number { return this._evaluator.numYTerms; }
  /** Return the nominal end radius. */
  public get nominalR1(): number { return this._nominalR1; }
  /** Return the nominal distance from inflection to endpoint. */
  public get nominalL1(): number { return this._nominalL1; }
  /** Return (a reference to) the active fraction interval. */
  public get activeFractionIntervalRef(): Segment1d { return this._activeFractionInterval; }
  /** Return (a reference to) the local to world coordinate frame. */
  public get localToWorldRef(): Segment1d { return this._activeFractionInterval; }
  /** Return (a reference to) the string name of the spiral type. */
  public get spiralType(): string { return this._spiralType; }

  // constructor demands radius1 and distance1 for nominal construction.
  // caller is responsible for managing intervals of partial spiral
  constructor(
    localToWorld: Transform,
    spiralType: string,
    originalProperties: TransitionConditionalProperties | undefined,
    nominalL1: number,
    nominalR1: number,
    activeFractionInterval: Segment1d,
    evaluator: ClothoidSeriesRLEvaluator) {
    super();
    this._spiralType = spiralType;
    this.localToWorld = localToWorld;
    this._nominalL1 = nominalL1;
    this._nominalR1 = nominalR1;
    this._evaluator = evaluator;
    this._activeFractionInterval = activeFractionInterval;
    this._originalProperties = originalProperties;
    this._globalStrokes = LineString3d.create();
    // initialize for compiler -- but this will be recomputed in refreshComputeProperties ...
    this.refreshComputedProperties();
  }
  /** Return the original defining properties (if any) saved by the constructor. */
  public get originalProperties(): TransitionConditionalProperties | undefined { return this._originalProperties; }
  /** return the spiral type as a string */
  public getSpiralType(): string {
    return this._spiralType;
  }
  /** Recompute strokes */
  public refreshComputedProperties() {
    this._globalStrokes.clear();
    const sweepRadians = this.nominalL1 / (2.0 * this.nominalR1);
    const radiansStep = 0.02;
    const numInterval = StrokeOptions.applyAngleTol(undefined, 4, sweepRadians, radiansStep);
    this._globalStrokes.ensureEmptyUVParams();
    this._globalStrokes.ensureEmptyFractions();
    const distances = this._globalStrokes.packedUVParams!;
    for (let i = 0; i <= numInterval; i++) {
      const fraction = i / numInterval;
      const nominalDistanceAlong = fraction * this._nominalL1;
      this._globalStrokes.packedPoints.pushXYZ(this._evaluator.pseudoDistanceToX(nominalDistanceAlong),
        this._evaluator.pseudoDistanceToY(nominalDistanceAlong), 0);
      distances.pushXY(nominalDistanceAlong, nominalDistanceAlong); // the second distance will be updated below
    }

    let trueDistance0 = distances.getYAtUncheckedPointIndex(0);
    let nominalDistance0 = distances.getYAtUncheckedPointIndex(0);
    let trueDistance1, nominalDistance1;
    for (let i = 1; i <= numInterval; i++) {
      nominalDistance1 = distances.getXAtUncheckedPointIndex(i);
      trueDistance1 = trueDistance0 + this._evaluator.gaussIntegralLength(nominalDistance0, nominalDistance1);
      distances.setXYZAtCheckedPointIndex(i, nominalDistance1, trueDistance1);
      nominalDistance0 = nominalDistance1;
      trueDistance0 = trueDistance1;
    }
  }
  /**
   * Create a spiral object which uses numXTerm terms from the clothoid X series and numYTerm from the clothoid Y series.
   * @param numXTerm  number of terms to use from X series
   * @param numYTerm number of terms to use from Y series
   * @param localToWorld placement frame.  Inflection point is at origin, initial direction is along x axis.
   * @param nominalL1 design distance from inflection to end point.
   * @param nominalR1 design radius at end point.
   * @param activeInterval active interval (as fractions of nominalL1 !!!)
   */
  public static create(
    spiralType: string,
    localToWorld: Transform,
    numXTerm: number, numYTerm: number,
    originalProperties: TransitionConditionalProperties | undefined,
    nominalL1: number, nominalR1: number,
    activeInterval: Segment1d | undefined): ClothoidSeriesSpiral3d | undefined {
    const evaluator = new ClothoidSeriesRLEvaluator(1.0 / (2.0 * nominalL1 * nominalR1), numXTerm, numYTerm);
    if (numXTerm < 1)
      numXTerm = 1;
    if (numYTerm < 1)
      numYTerm = 1;
    return new ClothoidSeriesSpiral3d(
      localToWorld.clone(),
      spiralType,
      originalProperties,
      nominalL1, nominalR1,
      activeInterval ? activeInterval.clone() : Segment1d.create(0, 1), evaluator);
  }
  public static createCubicY(
    localToWorld: Transform,
    nominalL1: number,
    nominalR1: number): ClothoidSeriesSpiral3d | undefined {
    return this.create("RLCubic", localToWorld, 1, 1, undefined, nominalL1, nominalR1, undefined);
  }
  public static createArema(
    localToWorld: Transform,
    nominalL1: number,
    nominalR1: number): ClothoidSeriesSpiral3d | undefined {
    return this.create("Arema", localToWorld, 2, 2, undefined, nominalL1, nominalR1, undefined);
  }
  /** Deep clone of this spiral */
  public clone(): ClothoidSeriesSpiral3d {
    return new ClothoidSeriesSpiral3d(
      this.localToWorld.clone(),
      this._spiralType,
      this._originalProperties?.clone(),
      this._nominalL1,
      this._nominalR1,
      this._activeFractionInterval?.clone(),
      this._evaluator.clone());
  }
  /** apply `transform` to this spiral's local to world transform. */
  public tryTransformInPlace(transformA: Transform): boolean {
    const rigidData = transformA.matrix.factorRigidWithSignedScale();
    if (rigidData !== undefined) {
      // [sQ a][R b] = [sQ*R sQb+a]
      // but we save it as [Q*R sQb+a] with spiral data scaled by s.
      const transformC0 = transformA.multiplyTransformTransform(this.localToWorld);
      // BUT pull the scale part out of the matrix ...
      const matrixC = (rigidData.rigidAxes as Matrix3d).multiplyMatrixMatrix(this.localToWorld.matrix);
      this.localToWorld = Transform.createOriginAndMatrix(transformC0.origin, matrixC);
      this._nominalL1 /= rigidData.scale;
      this._nominalR1 /= rigidData.scale;
      if (this.originalProperties)
        this.originalProperties.applyScaleFactor(rigidData.scale);
    }
    this.refreshComputedProperties();
    return true;
  }
  /** Clone with a transform applied  */
  public cloneTransformed(transform: Transform): ClothoidSeriesSpiral3d {
    const result = this.clone();
    result.tryTransformInPlace(transform);  // ok, we're confident it will always work.
    return result;
  }
  /** Return the spiral start point. */
  public startPoint(): Point3d { return this.activeStrokes.startPoint(); }
  /** return the spiral end point. */
  public endPoint(): Point3d { return this.activeStrokes.endPoint(); }
  /** test if the local to world transform places the spiral xy plane into `plane` */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return plane.isPointInPlane(this.localToWorld.origin as Point3d)
      && Geometry.isSameCoordinate(0.0, this.localToWorld.matrix.dotColumnX(plane.getNormalRef()))
      && Geometry.isSameCoordinate(0.0, this.localToWorld.matrix.dotColumnY(plane.getNormalRef()));
  }
  /** Return quick length of the spiral.
   * The tangent vector of a true clothoid is length 1 everywhere, so simple proportion of nominalL1 is a good approximation.
   */
  public quickLength() { return this._activeFractionInterval.absoluteDelta() * this._nominalL1; }
  /** Return length of the spiral.
   * * NEEDS WORK
   */
  public curveLength() { return this.quickLength(); }
  /** Test if `other` is an instance of `TransitionSpiral3d` */
  public isSameGeometryClass(other: any): boolean { return other instanceof ClothoidSeriesSpiral3d; }
  /** Add strokes from this spiral to `dest`.
   * * Linestrings will usually stroke as just their points.
   * * If maxEdgeLength is given, this will sub-stroke within the linestring -- not what we want.
   */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void { this.activeStrokes.emitStrokes(dest, options); }
  /** emit stroke fragments to `dest` handler. */
  public emitStrokableParts(dest: IStrokeHandler, options?: StrokeOptions): void {
    const n = this.computeStrokeCountForOptions(options);
    const activeStrokes = this.activeStrokes;
    dest.startParentCurvePrimitive(this);
    if (n <= activeStrokes.numPoints()) {
      console.log(" emit strokable parts ===> active " + n);
      // this.activeStrokes.emitStrokableParts(dest, options);
      dest.announceIntervalForUniformStepStrokes(this, 2 * activeStrokes.numPoints(), 0.0, 1.0);
    } else {
      console.log(" emit strokable parts ===> uniform " + n);
      dest.announceIntervalForUniformStepStrokes(this, n, 0.0, 1.0);
    }
    dest.endParentCurvePrimitive(this);
  }

  /**
   * return the stroke count required for given options.
   * @param options StrokeOptions that determine count
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    let numStroke;
    const nominalRadians = this._nominalL1 / (2.0 * this._nominalR1);
    if (options) {
      const rMin = Math.abs(this._nominalR1);
      numStroke = options.applyTolerancesToArc(rMin, nominalRadians);
      numStroke = options.applyMaxEdgeLength(numStroke, this.quickLength());
      numStroke = options.applyMinStrokesPerPrimitive(numStroke);
    } else {
      numStroke = StrokeOptions.applyAngleTol(undefined, 4, nominalRadians);
    }
    numStroke = Math.ceil(this._activeFractionInterval.absoluteDelta() * numStroke);
    return numStroke;
  }

  /** Reverse the active interval and active strokes.
   * * Primary defining data remains unchanged !!!
   */
  public reverseInPlace(): void {
    this._activeFractionInterval.reverseInPlace();
    if (this._activeStrokes === undefined)
      this._activeStrokes = this._globalStrokes.clone();
    this._activeStrokes.reverseInPlace();
  }
  /** Evaluate curve point with respect to fraction. */
  public fractionToPoint(activeFraction: number, result?: Point3d): Point3d {
    const globalFraction = this._activeFractionInterval.fractionToPoint(activeFraction);
    const designDistanceAlong = globalFraction * this._nominalL1;
    result = this._evaluator.pseudoDistanceToPoint(designDistanceAlong, result);
    this.localToWorld.multiplyPoint3d(result, result);
    return result;
  }
  /** Evaluate curve point and derivative with respect to fraction. */
  public fractionToPointAndDerivative(activeFraction: number, result?: Ray3d): Ray3d {
    const globalFraction = this._activeFractionInterval.fractionToPoint(activeFraction);
    const designDistanceAlong = globalFraction * this._nominalL1;
    result = this._evaluator.pseudoDistanceToPointAndDerivative(designDistanceAlong, result);
    result.direction.scaleInPlace(this._activeFractionInterval.signedDelta() * this.nominalL1);
    result.transformInPlace(this.localToWorld);
    return result;
  }

  /** Return a plane with
   *
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to the fraction.
   * * vectorV is the second derivative, i.e.derivative of vectorU.
   */
  public fractionToPointAnd2Derivatives(activeFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined {
    const globalFraction = this._activeFractionInterval.fractionToPoint(activeFraction);
    const designDistanceAlong = globalFraction * this._nominalL1;
    result = this._evaluator.pseudoDistanceToPointAnd2Derivatives(designDistanceAlong, result);
    const a = this._activeFractionInterval.signedDelta() * this.nominalL1;
    result.vectorU.scaleInPlace(a);
    result.vectorV.scaleInPlace(a * this.nominalL1);
    result.transformInPlace(this.localToWorld);
    return result;
  }
  /** Second step of double dispatch:  call `handler.handleTransitionSpiral(this)` */
  public dispatchToGeometryHandler(_handler: GeometryHandler): any {
    // return handler.handleTransitionSpiral(this);
  }
  /** extend the range by the strokes of the spiral */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this.activeStrokes.extendRange(rangeToExtend, transform);
  }
  /** compare various coordinate quantities */
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof ClothoidSeriesSpiral3d) {
      return Geometry.isSameCoordinate(this._nominalL1, other._nominalL1)
        && Geometry.isSameCoordinate(this._nominalR1, other._nominalR1)
        && this.localToWorld.isAlmostEqual(other.localToWorld)
        && this._activeFractionInterval.isAlmostEqual(other._activeFractionInterval)
        && TransitionConditionalProperties.areAlmostEqual(this._originalProperties, other._originalProperties)
        && this._evaluator.numXTerms === other._evaluator.numXTerms
        && this._evaluator.numYTerms === other._evaluator.numYTerms;
    }
    return false;
  }

}
