/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { BSpline2dNd } from "../bspline/BSplineSurface";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Polyface } from "../polyface/Polyface";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { CoordinateXYZ } from "./CoordinateXYZ";
import { CurveCollection } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { PointString3d } from "./PointString3d";

/** Describes the category of a [[GeometryQuery]], enabling type-switching like:
 * ```ts
 *   function processGeometryQuery(q: GeometryQuery): void {
 *     if ("solid" === q.geometryCategory)
 *       alert("Solid type = " + q.solidPrimitiveType; // compiler knows q is an instance of SolidPrimitive
 *    // ...etc...
 * ```
 *
 * Each string maps to a particular subclass of [[GeometryQuery]]:
 *  - "polyface" => [[Polyface]]
 *  - "curvePrimitive" => [[CurvePrimitive]]
 *  - "curveCollection" => [[CurveCollection]]
 *  - "solid" => [[SolidPrimitive]]
 *  - "point" => [[CoordinateXYZ]]
 *  - "pointCollection" => [[PointString3d]]
 *  - "bsurf" => [[BSpline2dNd]]  (which is an intermediate class shared by [[BSplineSurface3d]] and [[BSplineSurface3dH]])
 *
 *  @see [[AnyGeometryQuery]]
 * @public
 */
export type GeometryQueryCategory = "polyface" | "curvePrimitive" | "curveCollection" | "solid" | "point" | "pointCollection" | "bsurf";

/** Union type for subclasses of [[GeometryQuery]]. Specific subclasses can be discriminated at compile- or run-time using [[GeometryQuery.geometryCategory]].
 * @public
 */
export type AnyGeometryQuery = Polyface | CurvePrimitive | CurveCollection | SolidPrimitive | CoordinateXYZ | PointString3d | BSpline2dNd;

/** Queries to be supported by Curve, Surface, and Solid objects */
/**
 * * `GeometryQuery` is an abstract base class with (abstract) methods for querying curve, solid primitive, mesh, and bspline surfaces
 * @public
 */
export abstract class GeometryQuery {
  /** Type discriminator. */
  public abstract readonly geometryCategory: GeometryQueryCategory;

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
      } else if (childrenA || childrenB) {  // CurveCollections start with empty arrays for children.  So these null pointer cases are never reached.
        return false;   // plainly different .
      } else {
        // both children null. call it equal?   This class should probably have implemented.
        return true;
      }
    }
    return false;
  }
  /** apply instance method isAlmostEqual if both are defined.
   * * both undefined returns true
   * * single defined returns false
   */
  public static areAlmostEqual(a: GeometryQuery | undefined, b: GeometryQuery | undefined): boolean {
    if (a instanceof GeometryQuery && b instanceof GeometryQuery)
      return a.isAlmostEqual(b);
    if ((a === undefined) && (b === undefined))
      return true;
    return false;
  }
  /**
   * * "double dispatch" call pattern.
   * * User code implements a `GeometryHandler` with specialized methods to handle `LineSegment3d`, `Arc3d` etc as relevant to its use case.
   * * Each such `GeometryQuery` class implements this method as a one-line method containing the appropriate call such as `handler.handleLineSegment3d ()`
   * * This allows each type-specific method to be called without a switch or `instanceof` test.
   * @param handler handler to be called by the particular geometry class
   */
  public abstract dispatchToGeometryHandler(handler: GeometryHandler): any;
}
