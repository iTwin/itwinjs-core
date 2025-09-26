/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../../../Geometry";
import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { XAndY } from "../../../geometry3d/XYZProps";
import { Degree2PowerPolynomial } from "../../../numerics/Polynomials";
import { ImplicitCurve2d } from "./implicitCurve2d";
import { UnboundedLine2dByPointAndNormal } from "./UnboundedLine2d";

/**
 * Internal class for a complete circle in the xy plane, with center and radius stored.
 */
export class UnboundedCircle2dByCenterAndRadius extends ImplicitCurve2d {
  /** The Cartesian coordinates of any center on the line. */
  public center: Point2d;
  /** The circle radius */
  public radius: number;
  /* Constructor - CAPTURE given center and normal */
  private constructor(center: Point2d, radius: number) {
    super();
    this.center = center;
    this.radius = radius;
  }
  /** Return a clone of this circle. */
  public clone(): UnboundedCircle2dByCenterAndRadius {
    // the create method clones the inputs
    return UnboundedCircle2dByCenterAndRadius.createPointRadius(this.center, this.radius);
  }
  /** Return a clone of this circle, with radius negated. */
  public cloneNegateRadius(): UnboundedCircle2dByCenterAndRadius {
    // the create method clones the inputs
    return UnboundedCircle2dByCenterAndRadius.createPointRadius(this.center, -this.radius);
  }
  /**
   * Create an ImplicitCircle2d from XY parts of its center and its radius.
   * @param centerX x coordinate of center
   * @param centerY y coordinate of center
   * @param radius circle radius
   * @returns newly created circle object
   */
  public static createXYRadius(centerX: number, centerY: number, radius: number): UnboundedCircle2dByCenterAndRadius {
    return new UnboundedCircle2dByCenterAndRadius(Point2d.create(centerX, centerY), radius);
  }
  /**
   * Create an ImplicitCircle2d from an xy object and a radius.
   * * Zero radius is valid.
   * * The input coordinates are copied -- the center is NOT captured.
   * @param center xy coordinates of center
   * @param radius circle radius
   * @returns newly created circle object
   */
  public static createPointRadius(center: XAndY, radius: number): UnboundedCircle2dByCenterAndRadius {
    return new UnboundedCircle2dByCenterAndRadius(Point2d.create(center.x, center.y), radius);
  }
  /**
   * Returns gradient of the implicit function.
   * @param xy space point
   * @returns squared distance to center minus squared radius.
   */
  public override functionValue(xy: XAndY): number {
    return Geometry.distanceSquaredXYXY(xy.x, xy.y, this.center.x, this.center.y) - this.radius * this.radius;
  }
  /**
   * Returns gradient of the implicit function.
   * @param xy space point
   */
  public override gradient(xy: XAndY): Vector2d {
    return Vector2d.create(2 * (xy.x - this.center.x), 2 * (xy.y - this.center.y));
  }
  /**
   * Emit circle points for which a vector to the space point is perpendicular to the circle.
   * * For a non-zero radius circle, there are two perpendiculars. The one on the side of the space point is emitted first.
   * * For a zero radius circle, the vector from center to the space point is the only perpendicular.
   * @param spacePoint the space point.
   * @handler the handler to receive all the points on the curve and radians where perpendicular happens.
   */
  public override emitPerpendiculars(
    spacePoint: Point2d, handler: (curvePoint: Point2d, radians: number | undefined) => any,
  ) {
    // Make a vector from center to space point, scaled so length equals radius.
    // Add and subtract it to/from center to get to circumference point.
    const radialVector = Vector2d.createStartEnd(this.center, spacePoint).scaleToLength(this.radius);
    if (radialVector !== undefined) {
      handler(this.center.plus(radialVector), undefined);
      handler(this.center.minus(radialVector), undefined);
    }
  }
  /** Returns true if the circle radius is near zero. */
  // eslint-disable-next-line @itwin/prefer-get
  public override isDegenerate(): boolean {
    return Geometry.isSameCoordinate(this.radius, 0);
  }
  /**
   * Test if the centers and radii of two circles are close.
   * @param other second circle
   * @returns true if identical to tolerance.
   */
  public isSameCircle(other: UnboundedCircle2dByCenterAndRadius, negatedRadiiAreEqual: boolean): boolean {
    if (negatedRadiiAreEqual)
      return Geometry.isSameCoordinate(Math.abs(this.radius), Math.abs(other.radius))
        && Geometry.isSamePoint2d(this.center, other.center);
    return Geometry.isSameCoordinate(this.radius, other.radius)
      && Geometry.isSamePoint2d(this.center, other.center);
  }
  /**
   * Compute intersections with another circle.
   * @param other second circle
   * @return array of 0, 1, or 2 points of intersection
   */
  public intersectCircle(other: UnboundedCircle2dByCenterAndRadius): Point2d[] {
    const vectorAB = Vector2d.createStartEnd(this.center, other.center);
    const unitAB = vectorAB.normalize();
    if (unitAB === undefined)
      return [];
    const d = vectorAB.magnitude();
    const rA2 = Geometry.square(this.radius);
    const rB2 = Geometry.square(other.radius);
    // if intersection points are called i1 and i2 and the mid point of the line connecting i1 and i2 is called m
    // then we can form 2 triangles:  <this.center, m, i1> and <other.center, m, i2>
    // now if a is distance from this.center to m and h is distance from m to i1, we get rA2 = a^2 + h^2
    // similarly we get rB2 = (d-a)^2 + h^2 and from those 2 equations we can solve for a and h
    const a = Geometry.conditionalDivideCoordinate(rA2 - rB2 + d * d, 2 * d);
    const points = [];
    if (a !== undefined) {
      const h2 = rA2 - a * a;
      if (Math.abs(h2) < Geometry.smallMetricDistanceSquared)
        points.push(this.center.plusScaled(unitAB, a));
      else if (h2 > 0) {
        const h = Math.sqrt(h2);
        points.push(this.center.addForwardLeft(a, h, unitAB));
        points.push(this.center.addForwardLeft(a, -h, unitAB));
      }
    }
    return points;
  }
  /**
   * Compute intersections with a line
   * @param line the line.
   * @return array of 0, 1, or 2 points of intersection
   */
  public intersectLine(line: UnboundedLine2dByPointAndNormal): Point2d[] {
    // a point on line is X = P + frac*U where P is line.point and U is the vector along line
    // vector from X to center is X-C = (P-C) + frac*U
    // now defined P-C = V to get X-C = V + frac*U
    // when distance squared from X to center is equal to this.radius squared, we have intersection:
    // (V + frac*U) dot (V + frac*U) = r^2
    // (U.U)*frac^2 + (2U.V)*frac + (V.V-r^2) = 0
    // now solve for frac
    const vectorU = line.vectorAlongLine();
    const vectorV = Vector2d.createStartEnd(this.center, line.point);
    const uDotV = vectorU.dotProduct(vectorV);
    const vDotV = vectorV.dotProduct(vectorV);
    const uDotU = vectorU.dotProduct(vectorU);
    const fractions = Degree2PowerPolynomial.solveQuadratic(uDotU, 2 * uDotV, vDotV - this.radius * this.radius);
    const points = [];
    if (fractions !== undefined)
      for (const f of fractions) {
        points.push(line.point.plusScaled(vectorU, f));
      }
    return points;
  }
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
