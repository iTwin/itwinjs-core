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
  /** Order of the computed bspline.   (one more than degree) */
  order?: number;
  /** true if the bspline construction should be periodic */
  closed?: boolean;
  /** if closed and no knots: true = compute chord length knots, false = uniform */
  isChordLenKnots?: number;
  /** if !closed but first and last fitPoints are equal, pivot computed start/end tangent(s) so that they are colinear */
  isColinearTangents?: number;
  /** if !closed and start/endTangent is given, set its magnitude to the chord length (true) or Bessel (false) end condition */
  isChordLenTangents?: number;
  /** if !closed and start/endTangent is absent, compute it by natural (true) or Bessel (false) end condition */
  isNaturalTangents?: number;
  /** optional start tangent.  Use of the tangent magnitude may be indicated by other flags. */
  startTangent?: XYZProps;
  /** optional end tangent.  Use of the tangent magnitude may be indicated by other flags. */
  endTangent?: XYZProps;
  /** Points that the curve must pass through */
  fitPoints: XYZProps[];
  /** parameters for curve fitting, one per fitPoint */
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
   * Constructor. Supplies default values for flags.
   * @param fitPoints points to CAPTURE
   * @param knots array to CAPTURE
   */
  public constructor(fitPoints?: Point3d[], knots?: number[]) {
    this._fitPoints = fitPoints ? fitPoints : [];
    this._knots = knots;
    this._order = 4;
    this._isChordLenKnots = 1;
    this._isColinearTangents = 0;
    this._isChordLenTangents = 1;
    this._isNaturalTangents = 1;
  }

  /** Order of the computed bspline.   (one more than degree) */
  private _order?: number;
  /** true if the bspline construction should be periodic */
  private _closed?: boolean;
  private _isChordLenKnots?: number;
  private _isColinearTangents?: number;
  private _isChordLenTangents?: number;
  private _isNaturalTangents?: number;
  /** optional start tangent, pointing into the curve. Tangent magnitude ignored. */
  private _startTangent?: Vector3d;
  /** optional end tangent, pointing into the curve. Tangent magnitude ignored. */
  private _endTangent?: Vector3d;
  /** Points that the curve must pass through */
  private _fitPoints: Point3d[];
  /** knots for curve fitting */
  private _knots?: number[];

  /** `order` as property. Currently always 4. */
  public get order(): number { return Geometry.resolveNumber(this._order, 4); }
  public set order(val: number) { this._order = val; }
  /** `closed` as property with default false */
  public get closed(): boolean { return Geometry.resolveValue(this._closed, false); }
  public set closed(val: boolean) { this._closed = val; }
  /** `isChordLenKnots` as property with default 0 */
  public get isChordLenKnots(): number { return Geometry.resolveNumber(this._isChordLenKnots, 1); }
  public set isChordLenKnots(val: number) { this._isChordLenKnots = val; }
  /** `isColinearTangents` as property with default 0 */
  public get isColinearTangents(): number { return Geometry.resolveNumber(this._isColinearTangents, 0); }
  public set isColinearTangents(val: number) { this._isColinearTangents = val; }
  /** `isChordLenTangent` as property with default 0 */
  public get isChordLenTangents(): number { return Geometry.resolveNumber(this._isChordLenTangents, 1); }
  public set isChordLenTangents(val: number) { this._isChordLenTangents = val; }
  /** `isNaturalTangents` as property with default 0 */
  public get isNaturalTangents(): number { return Geometry.resolveNumber(this._isNaturalTangents, 1); }
  public set isNaturalTangents(val: number) { this._isNaturalTangents = val; }
  /** access POSSIBLY UNDEFINED normalized start tangent pointing into curve. Setter CAPTURES. */
  public get startTangent(): Vector3d | undefined { return this._startTangent; }
  public set startTangent(val: Vector3d | undefined) { this._startTangent = val; }
  /** access POSSIBLY UNDEFINED normalized end tangent pointing into curve. Setter CAPTURES. */
  public get endTangent(): Vector3d | undefined { return this._endTangent; }
  public set endTangent(val: Vector3d | undefined) { this._endTangent = val; }
  /** access POINTER TO fitPoints. Setter CAPTURES. */
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

  public static areAlmostEqual(dataA: InterpolationCurve3dOptions | undefined, dataB: InterpolationCurve3dOptions | undefined): boolean {
    if (dataA === undefined && dataB === undefined)
      return true;
    if (dataA !== undefined && dataB !== undefined) {
      return Geometry.areEqualAllowUndefined(dataA.order, dataB.order)
        && Geometry.areEqualAllowUndefined(dataA.closed, dataB.closed)
        && Geometry.areEqualAllowUndefined(dataA.isChordLenKnots, dataB.isChordLenKnots)
        && Geometry.areEqualAllowUndefined(dataA.isColinearTangents, dataB.isColinearTangents)
        && Geometry.areEqualAllowUndefined(dataA.isNaturalTangents, dataB.isNaturalTangents)
        && Geometry.areEqualAllowUndefined(dataA.startTangent, dataB.startTangent)
        && Geometry.areEqualAllowUndefined(dataA.endTangent, dataB.endTangent)
        && Geometry.almostEqualArrays(dataA.fitPoints, dataB.fitPoints, (a: Point3d, b: Point3d) => a.isAlmostEqual(b))
        && Geometry.almostEqualNumberArrays(dataA.knots, dataB.knots, (a: number, b: number) => a === b);
    }
    return false;
  }
  /** reverse the order or sense of all start-to-end related properties. */
  public reverseInPlace() {
    this.fitPoints.reverse();
    if (this.knots)
      this.knots.reverse();
    // Swap pointers to tangents.
    // NEEDS WORK: Do the vector coordinates need to be negated?
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
      // START HERE: transform start/endTangent
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
