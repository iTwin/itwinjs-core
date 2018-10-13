/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { GeometryHandler } from "../geometry3d/GeometryHandler";

import { GeometryQuery } from "./GeometryQuery";

/** A Coordinate is a persistable Point3d */
export class CoordinateXYZ extends GeometryQuery {
  private _xyz: Point3d;
  public get point() { return this._xyz; }
  /**
   * @param xyz point to be CAPTURED.
   */
  private constructor(xyz: Point3d) {
    super();
    this._xyz = xyz;
  }
  public static create(point: Point3d): CoordinateXYZ {
    return new CoordinateXYZ(point.clone());
  }
  /** return the range of the point */
  public range(): Range3d { return Range3d.create(this._xyz); }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    if (transform)
      rangeToExtend.extendTransformedXYZ(transform, this._xyz.x, this._xyz.y, this._xyz.z);
    else
      rangeToExtend.extend(this._xyz);
  }
  /** Apply transform to the Coordinate's point. */
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyPoint3d(this._xyz, this._xyz);
    return true;
  }
  /** return a transformed clone.
   */
  public cloneTransformed(transform: Transform): GeometryQuery | undefined {
    const result = new CoordinateXYZ(this._xyz.clone());
    result.tryTransformInPlace(transform);
    return result;
  }
  /** return a clone */
  public clone(): GeometryQuery | undefined {
    return new CoordinateXYZ(this._xyz.clone());
  }
  /** return GeometryQuery children for recursive queries.
   *
   * * leaf classes do not need to implement.
   */

  /** test if (other instanceof Coordinate).  */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof CoordinateXYZ;
  }
  /** test for exact structure and nearly identical geometry.
   *
   * *  Leaf classes must implement !!!
   * *  base class implementation recurses through children.
   * *  base implementation is complete for classes with children and no properties.
   * *  classes with both children and properties must implement for properties, call super for children.
   */
  public isAlmostEqual(other: GeometryQuery): boolean {
    return (other instanceof CoordinateXYZ) && this._xyz.isAlmostEqual(other._xyz);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleCoordinateXYZ(this);
  }
}
