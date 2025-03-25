/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { XAndY } from "../../../geometry3d/XYZProps";

export abstract class ImplicitCurve2d {
    /**
     * Return the implicit function value at xy
     * @param xy point for evaluation
     */
   public abstract functionValue (xy: XAndY):number;
    /**
     * Return the implicit function gradiant at xy
     * @param xy point for evaluation
     */
    public abstract gradiant (xy: XAndY):Vector2d;

   /**
    * Find all perpendiculars from space point to the curve.
    * Pass each in turn to the handler.
    * @param spacePoint
    */
   public abstract emitPerpendiculars (spacePoint: Point2d,  handler :(curvePoint: Point2d)=>any):any;
    /**
    * Return true if the item has degenerate defining data.
    */
    public abstract isDegenerate ():boolean;

}

export class Point2dImplicitCurve2d {
  public point: Point2d;
  public curve: ImplicitCurve2d;
  /**
   * CAPTURE a point and curve.
   * @param point point member
   * @param curve curve member
   */
  public constructor(point: Point2d, curve: ImplicitCurve2d) {
    this.point = point;
    this.curve = curve;
  }
}

export class ImplicitGeometryMarkup<GeometryType extends ImplicitCurve2d> {
    public curve: GeometryType;
    public data: Point2dImplicitCurve2d[];
    /**
     * Construct a new carrier.  The data array is created empty.
     * @param curve curve to CAPTURE
     */
    public constructor(curve: GeometryType) {
      this.curve = curve;
      this.data = [];

    }

    public static createCapture<GeometryTypeA extends ImplicitCurve2d> (circle: GeometryTypeA): ImplicitGeometryMarkup<GeometryTypeA> {
      return new ImplicitGeometryMarkup<GeometryTypeA>(circle);
    }

/**
 * * Use the curve's emitPerpendiculars method to examine all perpendiculars from spacePoint to the curve.
 * * For each such point, compute distane from bias point.
 * * Choose the one whose distance is closest to biasDistance.
 * * push the chosen point on the data array.
 * @param spacePoint
 * @param curve
 * @param biasPoint
 * @param biasDistance
 * @returns
 */
  public appendClosePoint (spacePoint: Point2d,
    curve:ImplicitCurve2d,
    biasPoint: XAndY,
    biasDistance: number,
  ):boolean{
    let dMin : undefined | number;
    let closestPoint;
    curve.emitPerpendiculars (spacePoint,
       (curvePoint: Point2d) =>{
        const d = Math.abs(curvePoint.distance (biasPoint) - Math.abs (biasDistance));
          if (dMin === undefined || d < dMin){
            dMin = d;
            closestPoint = curvePoint.clone();
            }
      });
      if (closestPoint !== undefined)
        this.data.push (new Point2dImplicitCurve2d (closestPoint, curve));
    return true;
  }
  public closePointsOfGeometry (
      center: Point2d, biasPoint: Point2d, biasRadius: number,
      curves: ImplicitCurve2d[]){
        for (const c of curves){
        this.appendClosePoint (center, c, biasPoint, biasRadius);
        }
      }

    }
