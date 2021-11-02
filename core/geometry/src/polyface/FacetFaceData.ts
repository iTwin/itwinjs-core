/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range2d } from "../geometry3d/Range";
import { IndexedPolyface } from "./Polyface";
import { IndexedPolyfaceVisitor } from "./IndexedPolyfaceVisitor";

/**
 * Data for a face in a polyface containing facets.
 * This is built up cooperatively by the PolyfaceBuilder and its
 * callers, and stored as a FaceData array in PolyfaceData.
 * @public
 */
export class FacetFaceData {
  private _paramDistanceRange: Range2d;
  private _paramRange: Range2d;
  /** (property accessor) Return a reference to the distance-scaled parameter range. */
  public get paramDistanceRange(): Range2d { return this._paramDistanceRange; }
  /** (property accessor) Return a reference to the parameter range. */
  public get paramRange(): Range2d { return this._paramRange; }
  private constructor(distanceRange: Range2d, paramRange: Range2d) {
    this._paramDistanceRange = distanceRange;
    this._paramRange = paramRange;
  }
  /** Create a FacetFaceData with null ranges. */
  public static createNull(): FacetFaceData {
    return new FacetFaceData(Range2d.createNull(), Range2d.createNull());
  }
  /** Create a deep copy of this FacetFaceData object. */
  public clone(result?: FacetFaceData): FacetFaceData {
    if (result) {
      this._paramDistanceRange.clone(result._paramDistanceRange);
      this._paramRange.clone(result._paramRange);
      return result;
    }
    return new FacetFaceData(this._paramDistanceRange.clone(), this._paramRange.clone());
  }
  /** Restore this FacetFaceData to its null constructor state. */
  public setNull() {
    this._paramDistanceRange.setNull();
    this._paramRange.setNull();
  }
  /** Return distance-based parameter from stored parameter value. */
  public convertParamXYToDistance(x: number, y: number, result?: Point2d): Point2d {
    result = result ? result : Point2d.create();
    const paramDelta = this._paramRange.high.minus(this._paramRange.low);
    result.x = (0 === paramDelta.x) ? x : (this._paramDistanceRange.low.x + (x - this._paramRange.low.x)
      * (this._paramDistanceRange.high.x - this._paramDistanceRange.low.x) / paramDelta.x);
    result.y = (0.0 === paramDelta.y) ? y : (this.paramDistanceRange.low.y + (y - this._paramRange.low.y)
      * (this._paramDistanceRange.high.y - this._paramDistanceRange.low.y) / paramDelta.y);
    return result;
  }
  /** Return normalized (0-1) parameter from stored parameter value. */
  public convertParamXYToNormalized(x: number, y: number, result?: Point2d): Point2d {
    result = result ? result : Point2d.create();
    const paramDelta = this._paramRange.high.minus(this._paramRange.low);
    result.x = (0.0 === paramDelta.x) ? x : ((x - this._paramRange.low.x) / paramDelta.x);
    result.y = (0.0 === paramDelta.y) ? y : ((y - this._paramRange.low.y) / paramDelta.y);
    return result;
  }
  /** Return distance-based parameter from stored parameter value. */
  public convertParamToDistance(param: Point2d, result?: Point2d): Point2d {
    return this.convertParamXYToDistance(param.x, param.y, result);
  }
  /** Return normalized (0-1) parameter from stored parameter value. */
  public convertParamToNormalized(param: Point2d, result?: Point2d): Point2d {
    return this.convertParamXYToNormalized(param.x, param.y, result);
  }
  /** Scale distance parameters. */
  public scaleDistances(distanceScale: number) {
    this._paramDistanceRange.low.x *= distanceScale;
    this._paramDistanceRange.low.y *= distanceScale;
    this._paramDistanceRange.high.x *= distanceScale;
    this._paramDistanceRange.high.y *= distanceScale;
  }
  /**
   * Sets the param and paramDistance range of this FacetFaceData based on the newly terminated facets that make it up.
   * Takes the polyface itself, the first and last indexes of the facets to be included in the face.
   * Returns true on success, false otherwise.
   */
  public setParamDistanceRangeFromNewFaceData(polyface: IndexedPolyface, facetStart: number, facetEnd: number): boolean {
    const dSTotal = Point2d.create();
    const dSSquaredTotal = Point2d.create();
    this.setNull();
    let aveTotal = 0;
    const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
    if (!visitor.moveToReadIndex(facetStart) || facetEnd <= facetStart)
      return false;
    do {
      const numPointsInFacet = visitor.numEdgesThisFacet;
      const visitorPoints = visitor.point;
      const trianglePointIndexes: number[] = [];
      const visitorParams = visitor.param;
      const triangleParamIndexes: number[] = [];
      if (!visitorParams)
        return false;
      visitorParams.extendRange(this._paramRange);
      const dUV0 = Vector2d.create();
      const dUV1 = Vector2d.create();
      for (let k = 0; k < numPointsInFacet; k++) {
        trianglePointIndexes[2] = k;
        triangleParamIndexes[2] = k;
        if (k > 1) {
          visitorParams.vectorIndexIndex(triangleParamIndexes[1], triangleParamIndexes[0], dUV0);
          visitorParams.vectorIndexIndex(triangleParamIndexes[1], triangleParamIndexes[2], dUV1);
          const delta0 = visitorPoints.getPoint3dAtUncheckedPointIndex(trianglePointIndexes[0]).minus(visitorPoints.getPoint3dAtUncheckedPointIndex(trianglePointIndexes[1]));
          const delta1 = visitorPoints.getPoint3dAtUncheckedPointIndex(trianglePointIndexes[1]).minus(visitorPoints.getPoint3dAtUncheckedPointIndex(trianglePointIndexes[2]));
          const uvCross = Math.abs(dUV0.x * dUV1.y - dUV1.x * dUV0.y);
          if (uvCross) {
            const dwDu = Point3d.createFrom(delta0);
            dwDu.scaleInPlace(dUV1.y);
            dwDu.addScaledInPlace(delta1, -dUV0.y);
            const dwDv = Point3d.createFrom(delta1);
            dwDv.scaleInPlace(dUV0.x);
            dwDv.addScaledInPlace(delta0, -dUV1.x);
            const dS = Point2d.create(dwDu.magnitude() / uvCross, dwDv.magnitude() / uvCross);
            dSTotal.x += dS.x;
            dSTotal.y += dS.y;
            dSSquaredTotal.x += dS.x * dS.x;
            dSSquaredTotal.y += dS.y * dS.y;
            aveTotal++;
          }
        }
        triangleParamIndexes[0] = triangleParamIndexes[1];
        triangleParamIndexes[1] = triangleParamIndexes[2];
        trianglePointIndexes[0] = trianglePointIndexes[1];
        trianglePointIndexes[1] = trianglePointIndexes[2];
      }
    } while (visitor.moveToNextFacet() && visitor.currentReadIndex() < facetEnd);
    if (aveTotal !== 0) {
      const dS = Point2d.create(dSTotal.x / aveTotal, dSTotal.y / aveTotal);
      const standardDeviation = Point2d.create(Math.sqrt(Math.abs((dSSquaredTotal.x / aveTotal) - dS.x * dS.x)), Math.sqrt(Math.abs((dSSquaredTotal.y / aveTotal) - dS.y * dS.y)));
      // TR# 268980 - Add standard deviation to match QV....
      this._paramDistanceRange.low.set(0, 0);
      this._paramDistanceRange.high.set((dS.x + standardDeviation.x) * (this._paramRange.high.x - this._paramRange.low.x), (dS.y + standardDeviation.y) * (this._paramRange.high.y - this._paramRange.low.y));
    }
    return true;
  }
}
