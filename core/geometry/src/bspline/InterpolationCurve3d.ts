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
 * * This is a "json compatible" version of the serializer-friendly [[InterpolationCurve3dOptions]]
 * @public
 */
 export interface InterpolationCurve3dProps {
  /** Order of the computed bspline.   (one more than degree) */
 order?: number;
 /** true if the bspline construction should be periodic */
 closed?: boolean;
 isChordLenKnots?: number;
 isColinearTangents?: number;
 isChordLenTangent?: number;
 isNaturalTangents?: number;
 /** optional start tangent.  Use of the tangent magnitude may be indicated by other flags. */
 startTangent?: XYZProps;
 /** optional end tangent.  Use of the tangent magnitude may be indicated by other flags. */
 endTangent?: XYZProps;
 /** Points that the curve must pass through */
 fitPoints: XYZProps[];
 /** knots for curve fitting */
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
   *
   * @param fitPoints points to CAPTURE
   * @param knots array to CAPTURE
   */
  public constructor(fitPoints?: Point3d[], knots?: number[]) {
    this.fitPoints = fitPoints  ? fitPoints : [];
    this.knots = knots;
  }

  /** Order of the computed bspline.   (one more than degree) */
 order?: number;
 /** true if the bspline construction should be periodic */
 closed?: boolean;
 isChordLenKnots?: number;
 isColinearTangents?: number;
 isChordLenTangent?: number;
 isNaturalTangents?: number;
 /** optional start tangent.  Use of the tangent magnitude may be indicated by other flags. */
 startTangent?: Vector3d;
 /** optional end tangent.  Use of the tangent magnitude may be indicated by other flags. */
 endTangent?: Vector3d;
 /** Points that the curve must pass through */
 fitPoints: Point3d[];
 /** knots for curve fitting */
  knots?: number[];

/** Clone with strongly typed members reduced to simple json. */
  public cloneAsInterpolationCurve3dProps(): InterpolationCurve3dProps {
    const props : InterpolationCurve3dProps = {
      fitPoints: Point3dArray.cloneDeepJSONNumberArrays(this.fitPoints),
      knots: this.knots?.slice(),
    };
    if (this.order !== undefined)
      props.order = this.order;
      if (this.closed !== undefined)
      props.closed = this.closed;
    if (this.isChordLenKnots !== undefined)
      props.isChordLenKnots = this.isChordLenKnots;
    if (this.isColinearTangents)
      props.isColinearTangents = this.isColinearTangents;
    if (this.isChordLenTangent !== undefined)
      props.isChordLenTangent = this.isChordLenTangent;
    if (this.isNaturalTangents)
      props.isNaturalTangents = this.isNaturalTangents;
    if (this.startTangent)
      props.startTangent = this.startTangent?.toArray();
    if (this.endTangent !== undefined)
      props.endTangent = this.endTangent?.toArray();
    return props;
  }
/** Clone with strongly typed members reduced to simple json. */
  public clone(): InterpolationCurve3dOptions {
    const clone = new InterpolationCurve3dOptions(Point3dArray.clonePoint3dArray(this.fitPoints), this.knots?.slice());
    clone.order = this.order;
    clone.closed = this.closed;
    clone.isChordLenKnots = this.isChordLenKnots;
    clone.isColinearTangents = this.isColinearTangents;
    clone.isChordLenTangent = this.isChordLenTangent;
    clone.isNaturalTangents = this.isNaturalTangents;
    clone.startTangent = this.startTangent?.clone();
    clone.endTangent = this.endTangent?.clone();
    return clone;
  }

/** Clone with strongly typed members reduced to simple json. */
public static create(source: InterpolationCurve3dProps): InterpolationCurve3dOptions {
  const result = new InterpolationCurve3dOptions(Point3dArray.clonePoint3dArray(source.fitPoints), source.knots?.slice());
  result.order = source.order;
  result.closed = source.closed;
  result.isChordLenKnots = source.isChordLenKnots;
  result.isColinearTangents = source.isColinearTangents;
  result.isChordLenTangent = source.isChordLenTangent;
  result.isNaturalTangents = source.isNaturalTangents;
  result.startTangent = source.startTangent ? Vector3d.fromJSON(source.startTangent) : undefined;
  result.endTangent = source.endTangent? Vector3d.fromJSON(source.endTangent) : undefined;
  return result;
}

  public static areAlmostEqual(dataA: InterpolationCurve3dOptions | undefined, dataB: InterpolationCurve3dOptions | undefined): boolean {
    if (dataA === undefined && dataB === undefined)
      return true;
    if (dataA !== undefined && dataB !== undefined) {
      return Geometry.areEqualAllowUndefined(dataA.closed, dataB.closed)
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
}

/**
 * Interpolating curve.
 * * Derive from [[ProxyCurve]]
 * * Use a [[BSplineCurve3d]] as the proxy
 * *
 * @public
 */
export class InterpolationCurve3d extends ProxyCurve  {
  public readonly curvePrimitiveType = "interpolationCurve";
  private _options: InterpolationCurve3dOptions;
  /**
   * CAPTURE properties and proxy curve.
   */
private constructor(properties: InterpolationCurve3dOptions, proxyCurve: CurvePrimitive) {
    super(proxyCurve);
  this._options = properties;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler) {
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
public static createCapture (options: InterpolationCurve3dOptions) : InterpolationCurve3d | undefined{
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
  /** Clone the [[InterpolationCurve3dProps]] object in this [[InterpolationCurve3dProps]] */
  public cloneProps(): InterpolationCurve3dProps {
    return this._options.cloneAsInterpolationCurve3dProps();
  }

  /**
   * Reverse the curve direction.
   * * This updates both the defining properties and the proxy bspline.
   */
  public reverseInPlace(): void {
    this._proxyCurve.reverseInPlace();
    this._options.fitPoints.reverse();
    if (this._options.knots)
      this._options.knots.reverse();
    const oldStart = this._options.startTangent;
    this._options.startTangent = this._options.endTangent;
    this._options.endTangent = oldStart;
  }
  /**
   * Transform this [[InterpolationCurve3d]] and its defining data in place
   */
  public tryTransformInPlace(transform: Transform): boolean {
    const proxyOk = this._proxyCurve.tryTransformInPlace(transform);
    if (proxyOk) {
      transform.multiplyPoint3dArray(this._options.fitPoints);
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
      return new InterpolationCurve3d(this.toJSON(), proxyClone as CurvePrimitive);
    }
    return undefined;
  }
  public isAlmostEqual(other: GeometryQuery): boolean{
    if (other instanceof InterpolationCurve3d) {
    return InterpolationCurve3dOptions.areAlmostEqual (this._options, other._options)
    }
    return false;
  }
/** Test if `other` is also an [[InterpolationCurve3d]] */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof InterpolationCurve3d; }

}
