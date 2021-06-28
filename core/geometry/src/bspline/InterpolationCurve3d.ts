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

/**
 * fitPoints and end condition data for [[InterpolationCurve3d]]
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
  startTangent?: Vector3d;
  /** optional end tangent.  Use of the tangent magnitude may be indicated by other flags. */
  endTangent?: Vector3d;
  /** Points that the curve must pass through */
  fitPoints: Point3d[];
  /** knots for curve fitting */
  knots?: number[] | Float64Array;
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
  private _properties: InterpolationCurve3dProps;
  /**
   * CAPTURE properties and proxy curve.
   */
private constructor(properties: InterpolationCurve3dProps, proxyCurve: CurvePrimitive) {
    super(proxyCurve);
  this._properties = properties;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler) {
    return handler.handleInterpolationCurve3d(this);
  }
/**
 * Create an [[InterpolationCurve3d]] based on points, knots, and other properties in the [[InterpolationCurve3dProps]]
 */
  public static create(properties: InterpolationCurve3dProps): InterpolationCurve3d | undefined {
    // points are required ...
    if (properties.fitPoints === undefined)
      return undefined;
    const proxyCurve = BSplineCurve3d.createFromInterpolationCurve3dProps(properties);
    if (proxyCurve)
      return new InterpolationCurve3d(InterpolationCurve3d.cloneProperties (properties), proxyCurve);
    return undefined;
  }
  /** Return a (copy of) the defining points, packed as a Float64Array */
  public copyFitPointsFloat64Array(): Float64Array {
    const result = new Float64Array(this._properties.fitPoints.length * 3);
    let i = 0;
    for (const p of this._properties.fitPoints){
      result[i++] = p.x;
      result[i++] = p.y;
      result[i++] = p.y;
    }
    return result;
  }

  /**
   * Return json key-value pairs for for this [[InterpolationCurve3d]].
   * @returns
   */
  public toJSON(): any {
    const result = {
      fitPoints: Point3dArray.cloneDeepJSONNumberArrays(this._properties.fitPoints),
      order: this._properties.order,
      isChordLenKnots: this._properties.isChordLenKnots,
      knots: this._properties.knots?.slice(),
      closed: this._properties.closed,
      isColinearTangents: this._properties.isColinearTangents,
      isChordLenTangent: this._properties.isChordLenTangent,
      isNaturalTangents: this._properties.isNaturalTangents,
      startTangent: this._properties.startTangent?.clone(),
      endTangent: this._properties.endTangent?.clone(),
        };
    return result;
  }
  /**
   * Return a clone of the given [[InterpolationCurve3dProps]]
   * @param properties
   * @returns
   */
  public static cloneProperties(properties: InterpolationCurve3dProps): InterpolationCurve3dProps{
    return  {
      fitPoints: Point3dArray.clonePoint3dArray(properties.fitPoints),
      order: properties.order,
      isChordLenKnots: properties.isChordLenKnots,
      knots: properties.knots?.slice(),
      closed: properties.closed,
      isColinearTangents: properties.isColinearTangents,
      isChordLenTangent: properties.isChordLenTangent,
      isNaturalTangents: properties.isNaturalTangents,
      startTangent: properties.startTangent?.clone(),
      endTangent: properties.endTangent?.clone(),
      };

  }
  /** Clone the [[InterpolationCurve3dProps]] object in this [[InterpolationCurve3dProps]] */
  public cloneProperties(): InterpolationCurve3dProps {
    return InterpolationCurve3d.cloneProperties(this._properties);
  }

  /**
 * Field by field equality tests.
 * * pairs of undefined fields (or the structs themselves) are considered equal.
 */
  public static areAlmostEqualProperties(dataA: InterpolationCurve3dProps | undefined, dataB: InterpolationCurve3dProps | undefined): boolean {
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
  /**
   * Reverse the curve direction.
   * * This updates both the defining properties and the proxy bspline.
   */
  public reverseInPlace(): void {
    this._proxyCurve.reverseInPlace();
    this._properties.fitPoints.reverse();
    if (this._properties.knots)
      this._properties.knots.reverse();
    const oldStart = this._properties.startTangent;
    this._properties.startTangent = this._properties.endTangent;
    this._properties.endTangent = oldStart;
  }
  /**
   * Transform this [[InterpolationCurve3d]] and its defining data in place
   */
  public tryTransformInPlace(transform: Transform): boolean {
    const proxyOk = this._proxyCurve.tryTransformInPlace(transform);
    if (proxyOk) {
      transform.multiplyPoint3dArray(this._properties.fitPoints);
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
/** Test if `other` is also an [[InterpolationCurve3d]] */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof InterpolationCurve3d; }

}
