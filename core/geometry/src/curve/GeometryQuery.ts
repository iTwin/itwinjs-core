/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { BSpline2dNd } from "../bspline/BSplineSurface";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Polyface } from "../polyface/Polyface";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { CoordinateXYZ } from "./CoordinateXYZ";
import { CurveCollection } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { PointString3d } from "./PointString3d";

/**
 * Describes the category of a [[GeometryQuery]], enabling type-switching like:
 * ```ts
 *   function processGeometryQuery(q: GeometryQuery): void {
 *     if ("solid" === q.geometryCategory)
 *       alert("Solid type = " + q.solidPrimitiveType); // compiler knows q is an instance of SolidPrimitive
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
 *  - "bsurf" => [[BSpline2dNd]] (which is an intermediate class shared by [[BSplineSurface3d]] and [[BSplineSurface3dH]])
 *
 *  @see [[AnyGeometryQuery]]
 * @public
 */
export type GeometryQueryCategory = "polyface" | "curvePrimitive" | "curveCollection" | "solid" | "point" | "pointCollection" | "bsurf";

/**
 * Union type for subclasses of [[GeometryQuery]]. Specific subclasses can be discriminated at compile- or run-time
 * using [[GeometryQuery.geometryCategory]].
 * @public
 */
export type AnyGeometryQuery = Polyface | CurvePrimitive | CurveCollection | SolidPrimitive | CoordinateXYZ | PointString3d | BSpline2dNd;

/**
 * Options bundle for [[GeometryQuery.computeScaledTolerance]] and [[GeometryQuery.scaleToleranceForGeometry]].
 * @public
 */
export interface ScaledToleranceOptions {
  /** Optional transform to apply to geometry before computing its size. */
  transform?: Transform;
  /** Relative tolerance by which to scale the computed geometry size. Default is [[Geometry.smallMetricDistance]]. */
  relativeTolerance?: number;
  /** Smallest tolerance to return. Default is [[Geometry.smallMetricDistanceSquared]]. */
  minimumTolerance?: number;
  /** Whether to ignore z-coordinates when computing the geometry size. */
  xyOnly?: boolean;
}

/**
 * Queries to be supported by Curve, Surface, and Solid objects.
 * * `GeometryQuery` is an abstract base class with (abstract) methods for querying curve, solid primitive, mesh,
 * and bspline surfaces.
 * @public
 */
export abstract class GeometryQuery {
  /** Type discriminator. */
  public abstract readonly geometryCategory: GeometryQueryCategory;
  /** Return the range of the entire GeometryQuery tree. */
  public range(transform?: Transform, result?: Range3d): Range3d {
    if (result)
      result.setNull();
    const range = result ? result : Range3d.createNull();
    this.extendRange(range, transform);
    return range;
  }
  /** Extend `rangeToExtend` by the range of this geometry multiplied by the `transform`. */
  public abstract extendRange(rangeToExtend: Range3d, transform?: Transform): void;
  /**
   * Attempt to transform in place.
   * * LineSegment3d, Arc3d, LineString3d, BsplineCurve3d always succeed.
   * * Some geometry types may fail if scaling is non-uniform.
   */
  public abstract tryTransformInPlace(transform: Transform): boolean;
  /** Try to move the geometry by dx,dy,dz. */
  public tryTranslateInPlace(dx: number, dy: number = 0.0, dz: number = 0.0): boolean {
    return this.tryTransformInPlace(Transform.createTranslationXYZ(dx, dy, dz));
  }
  /** Return a transformed clone. */
  public abstract cloneTransformed(transform: Transform): GeometryQuery | undefined;
  /** Return a clone */
  public abstract clone(): GeometryQuery | undefined;
  /**
   * Return GeometryQuery children for recursive queries.
   * * leaf classes do not need to implement.
   */
  public get children(): GeometryQuery[] | undefined {
    return undefined;
  }
  /** Test `if (other instanceof this.Type)`. REQUIRED IN ALL CONCRETE CLASSES. */
  public abstract isSameGeometryClass(other: GeometryQuery): boolean;
  /**
   * Test for exact structure and nearly identical geometry.
   * *  Leaf classes must implement.
   * *  Base class implementation recurses through children.
   * *  Base implementation is complete for classes with children and no properties.
   * *  Classes with both children and properties must implement for properties, call super for children.
   */
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (this.isSameGeometryClass(other)) {
      const childrenA = this.children;
      const childrenB = other.children;
      if (childrenA && childrenB) {
        if (childrenA.length !== childrenB.length)
          return false;
        for (let i = 0; i < childrenA.length; i++) {
          if (!childrenA[i].isAlmostEqual(childrenB[i]))
            return false;
        }
        return true;
      } else if (childrenA || childrenB) { // CurveCollections start with empty arrays for children so these null pointer cases are never reached.
        return false; // plainly different
      } else {
        return true; // both children null; call it equal
      }
    }
    return false;
  }
  /**
   * Apply instance method [[isAlmostEqual]] if both are defined.
   * * Both undefined returns true.
   * * Single defined returns false.
   */
  public static areAlmostEqual(a: GeometryQuery | undefined, b: GeometryQuery | undefined): boolean {
    if (a instanceof GeometryQuery && b instanceof GeometryQuery)
      return a.isAlmostEqual(b);
    if ((a === undefined) && (b === undefined))
      return true;
    return false;
  }
  /**
   * Double Dispatch call pattern.
   * * User code implements a `GeometryHandler` with specialized methods to handle `LineSegment3d`, `Arc3d`, etc as
   * relevant to its use case.
   * * Each such `GeometryQuery` class implements this method as a one-line method containing the appropriate call
   * such as `handler.handleLineSegment3d())`
   * * This allows each type-specific method to be called without a switch or `instanceof` test.
   * @param handler handler to be called by the particular geometry class
   */
  public abstract dispatchToGeometryHandler(handler: GeometryHandler): any;

  /**
   * Compute a distance tolerance appropriate for comparing the coordinates of `geom`.
   * * The formula is `absTol = minTol + relTol * geomSize`, where `geomSize` is the largest absolute coordinate of
   * the geometry range.
   * * Scaling tolerances by geometry size helps account for the decreased floating point resolution between large
   * coordinates. While using such scaled tolerances can enable more tolerance-sensitive constructions to succeed on
   * far-flung geometries, on extremely small geometries at extremely large coordinate magnitudes, geometric
   * constructions are generally more accurate when applied to the geometry temporarily translated to the origin.
   * @param geom geometry to measure
   * @param options bundle of options
   * @returns the computed absolute tolerance
   * @see [[scaleToleranceForGeometry]]
   */
  public static computeScaledTolerance(geom: GeometryQuery | GeometryQuery[], options?: ScaledToleranceOptions): number {
    const relTol = Math.abs(options?.relativeTolerance ?? Geometry.smallMetricDistance);
    const minTol = Math.abs(options?.minimumTolerance ?? Geometry.smallMetricDistanceSquared);
    const geomRange = Range3d.createNull();
    (Array.isArray(geom) ? geom : [geom]).forEach((g: GeometryQuery) => g.extendRange(geomRange, options?.transform));
    const geomSize = geomRange.isNull ? 0 : options?.xyOnly ? geomRange.maxAbsXY() : geomRange.maxAbs();
    return minTol + relTol * geomSize;
  }

  /**
   * Scale the given distance tolerance as appropriate for comparing the coordinates of `geom`.
   * * Scaling tolerances by geometry size helps account for the decreased floating point resolution between large
   * coordinates. While using such scaled tolerances can enable more tolerance-sensitive constructions to succeed on
   * far-flung geometries, on extremely small geometries at extremely large coordinate magnitudes, geometric
   * constructions are generally more accurate when applied to the geometry temporarily translated to the origin.
   * @param geom geometry to measure
   * @param distanceTolerance positive input distance tolerance to examine
   * @param options bundle of options (`minimumTolerance` and `relativeTolerance` are ignored)
   * @return a distance tolerance >= `distanceTolerance`
   * @see [[computeScaledTolerance]]
   */
  public static scaleToleranceForGeometry(geom: GeometryQuery | GeometryQuery[], distanceTolerance: number, options?: ScaledToleranceOptions): number {
    if (distanceTolerance > 0) {
      const geomRange = Range3d.createNull();
      (Array.isArray(geom) ? geom : [geom]).forEach((g: GeometryQuery) => g.extendRange(geomRange, options?.transform));
      if (!geomRange.isNull) {
        const geomSize = options?.xyOnly ? geomRange.maxAbsXY() : geomRange.maxAbs();
        if (geomSize > 0) {
          // HEURISTIC: truncate the fractional part of a coordinate's base-10 significand to maxDigits digits.
          // Adding the tolerance to this number should change the significand; otherwise, it's too small.
          const maxDigits = 10; // comfortably far from IEEE double's 15 guaranteed fractional digits
          const requiredDigitsForTol = Math.floor(Math.log10(geomSize / distanceTolerance));
          if (requiredDigitsForTol > maxDigits)
            distanceTolerance *= Math.pow(10, requiredDigitsForTol - maxDigits);
        }
      }
    }
    return distanceTolerance;
  }
}
