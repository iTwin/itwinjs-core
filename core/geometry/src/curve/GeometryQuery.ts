/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { Range3d } from "../geometry3d/Range";
import { Transform} from "../geometry3d/Transform";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
/** Queries to be supported by Curve, Surface, and Solid objects */
export abstract class GeometryQuery {

  /** return the range of the entire (tree) GeometryQuery */
  public range(transform?: Transform, result?: Range3d): Range3d {
    if (result) result.setNull();
    const range = result ? result : Range3d.createNull();
    this.extendRange(range, transform);
    return range;
  }

  /** extend rangeToExtend by the range of this geometry multiplied by the transform */
  public abstract extendRange(rangeToExtend: Range3d, transform?: Transform): void;

  /** Attempt to transform in place.
   *
   * * LineSegment3d, Arc3d, LineString3d, BsplineCurve3d always succeed.
   * * Some geometry types may fail if scaling is non-uniform.
   */
  public abstract tryTransformInPlace(transform: Transform): boolean;

  /** try to move the geometry by dx,dy,dz */
  public tryTranslateInPlace(dx: number, dy: number = 0.0, dz: number = 0.0): boolean {
    return this.tryTransformInPlace(Transform.createTranslationXYZ(dx, dy, dz));
  }
  /** return a transformed clone.
   */
  public abstract cloneTransformed(transform: Transform): GeometryQuery | undefined;
  /** return a clone */
  public abstract clone(): GeometryQuery | undefined;
  /** return GeometryQuery children for recursive queries.
   *
   * * leaf classes do not need to implement.
   */
  public get children(): GeometryQuery[] | undefined { return undefined; }
  /** test if (other instanceof this.Type).  REQUIRED IN ALL CONCRETE CLASSES */
  public abstract isSameGeometryClass(other: GeometryQuery): boolean;
  /** test for exact structure and nearly identical geometry.
   *
   * *  Leaf classes must implement !!!
   * *  base class implementation recurses through children.
   * *  base implementation is complete for classes with children and no properties.
   * *  classes with both children and properties must implement for properties, call super for children.
   */
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (this.isSameGeometryClass(other)) {
      const childrenA = this.children;
      const childrenB = other.children;
      if (childrenA && childrenB) {
        if (childrenA.length !== childrenB.length)
          return false;
        for (let i = 0; i < childrenA.length; i++) {
          if (!childrenA[i].isAlmostEqual(childrenB[i])) return false;
        }
        return true;
      } else if (childrenA || childrenB) {
        return false;   // plainly different .
      } else {
        // both children null. call it equal?   This class should probably have implemented.
        return true;
      }
    }
    return false;
  }

  // Every class provides its own handler for dgnjs writing, querying, etc...
  public abstract dispatchToGeometryHandler(handler: GeometryHandler): any;
}
