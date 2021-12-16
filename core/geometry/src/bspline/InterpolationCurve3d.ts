/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Geometry } from "../Geometry";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { ProxyCurve } from "../curve/ProxyCurve";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { BSplineCurveOps } from "../bspline/BSplineCurveOps";
import { BSplineCurve3d } from "./BSplineCurve";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Transform } from "../geometry3d/Transform";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { XYZProps } from "../geometry3d/XYZProps";

/**
 * fitPoints and end condition data for [[InterpolationCurve3d]]
 * * This is a "json compatible" version of [[InterpolationCurve3dOptions]]
 * @public
 */
export interface InterpolationCurve3dProps {
  /** order of the computed bspline (one more than degree) */
  order?: number;
  /** true if the B-spline construction should be periodic */
  closed?: boolean;
  /** if closed and no knots, compute chord length knots (1) or uniform knots (0). Chord length knots give best fit. */
  isChordLenKnots?: number;
  /** if !closed but first and last fitPoints are equal, pivot computed start/end tangent(s) so that they are colinear (1) or leave them be (0). */
  isColinearTangents?: number;
  /** if !closed and start/endTangent is given, set its magnitude to the first/last fit point chord length (1) or to the magnitude of the Bessel tangent (0). Bessel gives best fit. */
  isChordLenTangents?: number;
  /** if !closed and start/endTangent is absent, compute it using the natural end condition (1) or Bessel (0). Bessel gives best fit. */
  isNaturalTangents?: number;
  /** optional start tangent, pointing into curve. Magnitude is ignored. */
  startTangent?: XYZProps;
  /** optional end tangent, pointing into curve. Magnitude is ignored. */
  endTangent?: XYZProps;
  /** points that the curve must pass through */
  fitPoints: XYZProps[];
  /** parameters for curve fitting, one per fit point */
  knots?: number[];
}

/**
 * fitPoints and end condition data for [[InterpolationCurve3d]]
 * * This is a "typed object" version of the serializer-friendly [[InterpolationCurve3dProps]]
 * * Typical use cases rarely require all parameters, so the constructor does not itemize them as parameters.
 * @public
 */
export class InterpolationCurve3dOptions {
  /**
   * Constructor.
   * @param fitPoints points to CAPTURE
   * @param knots array to CAPTURE
   */
  public constructor(fitPoints?: Point3d[], knots?: number[]) {
    this._fitPoints = fitPoints ? fitPoints : [];
    this._knots = knots;
  }

  private _order?: number;
  private _closed?: boolean;
  private _isChordLenKnots?: number;
  private _isColinearTangents?: number;
  private _isChordLenTangents?: number;
  private _isNaturalTangents?: number;
  private _startTangent?: Vector3d;
  private _endTangent?: Vector3d;
  private _fitPoints: Point3d[];
  private _knots?: number[];

  /** `order` as property */
  public get order(): number { return Geometry.resolveNumber(this._order, 4); }
  public set order(val: number) { this._order = val; }
  /** `closed` as property */
  public get closed(): boolean { return Geometry.resolveValue(this._closed, false); }
  public set closed(val: boolean) { this._closed = val; }
  /** `isChordLenKnots` as property */
  public get isChordLenKnots(): number { return Geometry.resolveNumber(this._isChordLenKnots, 0); }
  public set isChordLenKnots(val: number) { this._isChordLenKnots = val; }
  /** `isColinearTangents` as property */
  public get isColinearTangents(): number { return Geometry.resolveNumber(this._isColinearTangents, 0); }
  public set isColinearTangents(val: number) { this._isColinearTangents = val; }
  /** `isChordLenTangents` as property */
  public get isChordLenTangents(): number { return Geometry.resolveNumber(this._isChordLenTangents, 0); }
  public set isChordLenTangents(val: number) { this._isChordLenTangents = val; }
  /** `isNaturalTangents` as property */
  public get isNaturalTangents(): number { return Geometry.resolveNumber(this._isNaturalTangents, 0); }
  public set isNaturalTangents(val: number) { this._isNaturalTangents = val; }
  /** access POSSIBLY UNDEFINED start tangent. Setter CAPTURES. */
  public get startTangent(): Vector3d | undefined { return this._startTangent; }
  public set startTangent(val: Vector3d | undefined) { this._startTangent = val; }
  /** access POSSIBLY UNDEFINED end tangent. Setter CAPTURES. */
  public get endTangent(): Vector3d | undefined { return this._endTangent; }
  public set endTangent(val: Vector3d | undefined) { this._endTangent = val; }
  /** access POINTER TO fit points. Setter CAPTURES. */
  public get fitPoints(): Point3d[] { return this._fitPoints; }
  public set fitPoints(val: Point3d[]) { this._fitPoints = val; }
  /** access POSSIBLY UNDEFINED knots array. Setter CAPTURES. */
  public get knots(): number[] | undefined { return this._knots; }
  public set knots(val: number[] | undefined) { this._knots = val; }

  /** One step setup of properties not named in constructor.
   * * CAPTURE pointers to tangents.
   * * OPTIONALLY downgrade "0" values to undefined.
   */
  public captureOptionalProps(
    order: number | undefined,
    closed: boolean | undefined,
    isChordLenKnots: number | undefined,
    isColinearTangents: number | undefined,
    isChordLenTangent: number | undefined,
    isNaturalTangents: number | undefined,
    startTangent: Vector3d | undefined,
    endTangent: Vector3d | undefined
  ) {
    this._order = Geometry.resolveToUndefined(order, 0);
    this._closed = Geometry.resolveToUndefined(closed, false);
    this._isChordLenKnots = Geometry.resolveToUndefined(isChordLenKnots, 0);
    this._isColinearTangents = Geometry.resolveToUndefined(isColinearTangents, 0);
    this._isChordLenTangents = Geometry.resolveToUndefined(isChordLenTangent, 0);
    this._isNaturalTangents = Geometry.resolveToUndefined(isNaturalTangents, 0);
    this._startTangent = startTangent;
    this._endTangent = endTangent;

  }
  /** Clone with strongly typed members reduced to simple json, with "undefined" members omitted */
  public cloneAsInterpolationCurve3dProps(): InterpolationCurve3dProps {
    const props: InterpolationCurve3dProps = {
      fitPoints: Point3dArray.cloneDeepJSONNumberArrays(this.fitPoints),
      knots: this._knots?.slice(),
    };
    if (this._order !== undefined)
      props.order = this._order;
    if (this._closed !== undefined)
      props.closed = this._closed;
    if (this._isChordLenKnots !== undefined)
      props.isChordLenKnots = this._isChordLenKnots;
    if (this._isColinearTangents !== undefined)
      props.isColinearTangents = this._isColinearTangents;
    if (this._isChordLenTangents !== undefined)
      props.isChordLenTangents = this._isChordLenTangents;
    if (this._isNaturalTangents !== undefined)
      props.isNaturalTangents = this._isNaturalTangents;
    if (this._startTangent !== undefined)
      props.startTangent = this._startTangent?.toArray();
    if (this._endTangent !== undefined)
      props.endTangent = this._endTangent?.toArray();
    return props;
  }
  /** Clone with strongly typed members reduced to simple json. */
  public clone(): InterpolationCurve3dOptions {
    const clone = new InterpolationCurve3dOptions(Point3dArray.clonePoint3dArray(this.fitPoints), this.knots?.slice());
    clone._order = this.order;
    clone._closed = this.closed;
    clone._isChordLenKnots = this.isChordLenKnots;
    clone._isColinearTangents = this.isColinearTangents;
    clone._isChordLenTangents = this.isChordLenTangents;
    clone._isNaturalTangents = this.isNaturalTangents;
    clone._startTangent = this._startTangent?.clone();
    clone._endTangent = this._endTangent?.clone();
    return clone;
  }

  /** Clone with strongly typed members reduced to simple json. */
  public static create(source: InterpolationCurve3dProps): InterpolationCurve3dOptions {
    const result = new InterpolationCurve3dOptions(Point3dArray.clonePoint3dArray(source.fitPoints), source.knots?.slice());
    result._order = source.order;
    result._closed = source.closed;
    result._isChordLenKnots = source.isChordLenKnots;
    result._isColinearTangents = source.isColinearTangents;
    result._isChordLenTangents = source.isChordLenTangents;
    result._isNaturalTangents = source.isNaturalTangents;
    result._startTangent = source.startTangent ? Vector3d.fromJSON(source.startTangent) : undefined;
    result._endTangent = source.endTangent ? Vector3d.fromJSON(source.endTangent) : undefined;
    return result;
  }
  // ugh.
  // vector equality test with awkward rule that 000 matches undefined.
  private static areAlmostEqualAllow000AsUndefined(a: Vector3d | undefined, b: Vector3d | undefined): boolean {
    if (a !== undefined && a.maxAbs() === 0)
      a = undefined;
    if (b !== undefined && b.maxAbs() === 0)
      b = undefined;
    if (a !== undefined && b !== undefined)
      return a.isAlmostEqual(b);
    return a === undefined && b === undefined;
  }
  public static areAlmostEqual(dataA: InterpolationCurve3dOptions | undefined, dataB: InterpolationCurve3dOptions | undefined): boolean {
    if (dataA === undefined && dataB === undefined)
      return true;
    if (dataA !== undefined && dataB !== undefined) {
      if (Geometry.areEqualAllowUndefined(dataA.order, dataB.order)
        && Geometry.areEqualAllowUndefined(dataA.closed, dataB.closed)
        && Geometry.areEqualAllowUndefined(dataA.isChordLenKnots, dataB.isChordLenKnots)
        && Geometry.areEqualAllowUndefined(dataA.isColinearTangents, dataB.isColinearTangents)
        && Geometry.areEqualAllowUndefined(dataA.isNaturalTangents, dataB.isNaturalTangents)
        && this.areAlmostEqualAllow000AsUndefined(dataA.startTangent, dataB.startTangent)
        && this.areAlmostEqualAllow000AsUndefined(dataA.endTangent, dataB.endTangent)
        && Geometry.almostEqualArrays(dataA.fitPoints, dataB.fitPoints, (a: Point3d, b: Point3d) => a.isAlmostEqual(b))) {
        if (Geometry.almostEqualNumberArrays(dataA.knots, dataB.knots, (a: number, b: number) => a === b))
          return true;
        if (dataA.knots === undefined && dataB.knots === undefined)
          return true;
        /* alas .. need to allow tricky mismatch of end replication */
        let knotsA = dataA.knots, knotsB = dataB.knots;
        if (dataA.knots === undefined)  // construct undefined knots to compare against defined knots
          knotsA = BSplineCurveOps.C2CubicFit.constructFitParametersFromPoints(dataA.fitPoints, dataA.isChordLenKnots, dataA.closed);
        else if (dataB.knots === undefined)
          knotsB = BSplineCurveOps.C2CubicFit.constructFitParametersFromPoints(dataB.fitPoints, dataB.isChordLenKnots, dataB.closed);
        knotsA = BSplineCurveOps.C2CubicFit.convertCubicKnotVectorToFitParams(knotsA, dataA.fitPoints.length, false);
        knotsB = BSplineCurveOps.C2CubicFit.convertCubicKnotVectorToFitParams(knotsB, dataB.fitPoints.length, false);
        return Geometry.almostEqualNumberArrays(knotsA, knotsB, (a: number, b: number) => Geometry.isAlmostEqualNumber(a, b));
      }
    }
    return false;
  }
  /** reverse the order or sense of all start-to-end related properties. */
  public reverseInPlace() {
    this.fitPoints.reverse();
    if (this.knots)
      this.knots.reverse();
    // Swap pointers to tangents. They don't need to be negated because they point into the curve.
    const oldStart = this._startTangent;
    this._startTangent = this.endTangent;
    this._endTangent = oldStart;
  }
}

/**
 * Interpolating curve.
 * * Derive from [[ProxyCurve]]
 * * Use a [[BSplineCurve3d]] as the proxy
 * *
 * @public
 */
export class InterpolationCurve3d extends ProxyCurve {
  public readonly curvePrimitiveType = "interpolationCurve";
  private _options: InterpolationCurve3dOptions;
  /**
   * CAPTURE properties and proxy curve.
   */
  private constructor(properties: InterpolationCurve3dOptions, proxyCurve: CurvePrimitive) {
    super(proxyCurve);
    this._options = properties;
  }
  public override dispatchToGeometryHandler(handler: GeometryHandler) {
    return handler.handleInterpolationCurve3d(this);
  }
  /**
   * Create an [[InterpolationCurve3d]] based on points, knots, and other properties in the [[InterpolationCurve3dProps]] or [[InterpolationCurve3dOptions]].
   * * This saves a COPY OF the options or props.
   * * Use createCapture () if the options or props can be used without copy
   */
  public static create(options: InterpolationCurve3dOptions | InterpolationCurve3dProps): InterpolationCurve3d | undefined {
    let optionsCopy;
    if (options instanceof InterpolationCurve3dOptions) {
      optionsCopy = options.clone();
    } else {
      optionsCopy = InterpolationCurve3dOptions.create(options);
    }
    return InterpolationCurve3d.createCapture(optionsCopy);
  }
  /** Create an [[InterpolationCurve3d]]
   * * The options object is captured into the new curve object (not copied)
   */
  public static createCapture(options: InterpolationCurve3dOptions): InterpolationCurve3d | undefined {
    const proxyCurve = BSplineCurve3d.createFromInterpolationCurve3dOptions(options);
    if (proxyCurve)
      return new InterpolationCurve3d(options, proxyCurve);
    return undefined;
  }
  /** Return a (copy of) the defining points, packed as a Float64Array */
  public copyFitPointsFloat64Array(): Float64Array {
    return Point3dArray.cloneXYZPropsAsFloat64Array(this._options.fitPoints);
  }

  /**
   * Return json key-value pairs for for this [[InterpolationCurve3d]].
   * @returns
   */
  public toJSON(): any {
    return this._options.cloneAsInterpolationCurve3dProps();
  }
  /** Clone the [[InterpolationCurve3dProps]] object in this [[InterpolationCurve3d]] */
  public cloneProps(): InterpolationCurve3dProps {
    return this._options.cloneAsInterpolationCurve3dProps();
  }

  /** return the options pointer */
  public get options(): InterpolationCurve3dOptions { return this._options; }

  /**
   * Reverse the curve direction.
   * * This updates both the defining properties and the proxy bspline.
   */
  public reverseInPlace(): void {
    this._proxyCurve.reverseInPlace();
    this._options.reverseInPlace();
  }
  /**
   * Transform this [[InterpolationCurve3d]] and its defining data in place
   */
  public tryTransformInPlace(transform: Transform): boolean {
    const proxyOk = this._proxyCurve.tryTransformInPlace(transform);
    if (proxyOk) {
      transform.multiplyPoint3dArrayInPlace(this._options.fitPoints);
      if (this._options.startTangent)
        transform.multiplyVectorInPlace(this._options.startTangent);
      if (this._options.endTangent)
        transform.multiplyVectorInPlace(this._options.endTangent);
    }
    return proxyOk;
  }
  /**
   * Return a transformed clone.
   */
  public cloneTransformed(transform: Transform): GeometryQuery | undefined {
    const myClone = this.clone();
    if (myClone && myClone?.tryTransformInPlace(transform))
      return myClone;
    return undefined;
  }
  /**
   * Return a clone.
   */
  public clone(): GeometryQuery | undefined {
    const proxyClone = this._proxyCurve.clone();
    if (proxyClone) {
      return new InterpolationCurve3d(this._options.clone(), proxyClone as CurvePrimitive);
    }
    return undefined;
  }
  public override isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof InterpolationCurve3d) {
      return InterpolationCurve3dOptions.areAlmostEqual(this._options, other._options);
    }
    return false;
  }
  /** Test if `other` is also an [[InterpolationCurve3d]] */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof InterpolationCurve3d; }

}
