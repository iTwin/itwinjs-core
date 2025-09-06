/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Matrix3d } from "../../../geometry3d/Matrix3d";
import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { Vector3d } from "../../../geometry3d/Point3dVector3d";
import { SmallSystem } from "../../../numerics/SmallSystem";
import { Geometry } from "../../../Geometry";
import { Degree2PowerPolynomial } from "../../../numerics/Polynomials";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "./implicitCurve2d";
import { Point2dImplicitCurve2d, UnboundedCircle2dByCenterAndRadius } from "./UnboundedCircle2d";
import { UnboundedLine2dByPointAndNormal } from "./UnboundedLine2d";
import { XAndY } from "../../../geometry3d/XYZProps";
import { UnboundedHyperbola2d } from "./UnboundedHyperbola2d";
import { UnboundedEllipse2d } from "./UnboundedEllipse2d";
import { UnboundedParabola2d } from "./UnboundedParabola";

/**
 * Static methods for special case circle and line tangent constructions.
 */
export class TangentConstruction {
  /**
   * Return all (i.e., up to 4) circles that are tangent to 3 given lines.
   * @param lineA first line
   * @param lineB second line
   * @param lineC third line
   */
  public static circlesTangentLLL(
    lineA: UnboundedLine2dByPointAndNormal,
    lineB: UnboundedLine2dByPointAndNormal,
    lineC: UnboundedLine2dByPointAndNormal,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    /*--------------------------------------------------------------------------------------
    (X-A).normalA = a*r
    (X-B).normalB = b*r
    (X-C).normalC = c*r
    Typical expansion is
    x*mx + y*my - a*r = A.normalA
    Where a,b,c are combinations of {+1,-1}
    Need to consider 4 combinations of signs: (+++) (++-) (+-+) (+--) The other 4 generate negated r as solution.
    ----------------------------------------------------------------------------------------*/
    // make lines with normal vectors and nearby origin
    const origin = lineA.point;
    const lineA1 = lineA.cloneNormalizedFromOrigin(origin);
    const lineB1 = lineB.cloneNormalizedFromOrigin(origin);
    const lineC1 = lineC.cloneNormalizedFromOrigin(origin);
    if (lineA1 === undefined || lineB1 === undefined || lineC1 === undefined)
      return undefined;
    const result = [];
    const a = lineA1.normal.dotProduct(lineA1.point);
    const b = lineB1.normal.dotProduct(lineB1.point);
    const c = lineC1.normal.dotProduct(lineC1.point);
    const signA = 1;
    for (const signB of [-1, 1]) {
      for (const signC of [-1, 1]) {
        const matrix = Matrix3d.createRowValues(
          lineA1.normal.x, lineA1.normal.y, signA,
          lineB1.normal.x, lineB1.normal.y, signB,
          lineC1.normal.x, lineC1.normal.y, signC,
        );
        const rhs = Vector3d.create(a, b, c);
        const xyr = matrix.multiplyInverse(rhs);
        if (xyr !== undefined) {
          const circle = UnboundedCircle2dByCenterAndRadius.createXYRadius(
            origin.x + xyr.x, origin.y + xyr.y, Math.abs(xyr.z),
          );
          const markup = ImplicitGeometryMarkup.createCapture(circle);
          markup.appendClosePoint(circle.center, lineA, circle.center, circle.radius);
          markup.appendClosePoint(circle.center, lineB, circle.center, circle.radius);
          markup.appendClosePoint(circle.center, lineC, circle.center, circle.radius);
          result.push(markup);
        }
      }
    }
    return result;
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and tangent to a circle.
   * @param line the line
   * @param circle the circle
   */
  public static linesPerpLTangentC(
    line: UnboundedLine2dByPointAndNormal, circle: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    // Project the circle center to the line.
    // The endpoints of the perpendicular line are the circle center and that line point shifted
    // by positive and negative radius in the direction of the line.
    const lineTangent = line.unitVectorAlongLine();
    const unitNormal = line.unitNormal();
    const linePoint = line.closestPoint(circle.center);
    if (linePoint === undefined || lineTangent === undefined || unitNormal === undefined)
      return undefined;
    const unitPerp = unitNormal.rotate90CCWXY()
    const result = [];
    for (const r of signedValues(circle.radius)) {
      const pointA = linePoint.plusScaled(lineTangent, r);
      const pointB = circle.center.plusScaled(lineTangent, r);
      const lineC = UnboundedLine2dByPointAndNormal.createPointNormal(pointA, unitPerp);
      const taggedLine = new ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>(lineC);
      taggedLine.data.push(new Point2dImplicitCurve2d(pointA, line)); // CLONE
      taggedLine.data.push(new Point2dImplicitCurve2d(pointB, circle)); // CLONE
      result.push(taggedLine);
    }
    return result;
  }
  /**
   * Return all (i.e., 4) variants of the line perpendicular to 2 circles (line between centers, with ends at crossing
   * points on respective circles).
   * @param circleA first circle
   * @param circleB second circle
   */
  public static linesPerpCPerpC(
    circleA: UnboundedCircle2dByCenterAndRadius, circleB: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    // There infinite line containing the circle centers is the only line perp to both circles.
    // The endpoints for the 4 line segments are the centers shifted by the respective radii along the infinite line.
    const centerToCenter = Vector2d.createStartEnd(circleA.center, circleB.center);
    const unitCenterToCenter = centerToCenter.normalize();
    if (unitCenterToCenter === undefined)
      return undefined;
    const unitNormal = unitCenterToCenter.rotate90CCWXY();
    const result = [];
    for (const rA of signedValues(circleA.radius)) {
      for (const rB of signedValues(circleB.radius)) {
        const pointA = circleA.center.plusScaled(unitCenterToCenter, rA);
        const pointB = circleB.center.plusScaled(unitCenterToCenter, rB);
        const lineC = UnboundedLine2dByPointAndNormal.createPointNormal(pointA, unitNormal);
        const taggedLine = new ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>(lineC);
        taggedLine.data.push(new Point2dImplicitCurve2d(pointA, circleA)); // CLONE
        taggedLine.data.push(new Point2dImplicitCurve2d(pointB, circleB)); // CLONE
        result.push(taggedLine);
      }
    }
    return result;
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and a circle.
   * @param line the line
   * @param circle the circle
   */
  public static linesPerpLPerpC(
    line: UnboundedLine2dByPointAndNormal, circle: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    // The infinite line through the circle center and in the direction of the line normal is the containing line.
    // Make segments from its intersection with the line to the near and far intersections with the circle.
    // (these are the centers shifted by radius along the line)
    const lineTangent = line.unitVectorAlongLine();
    const unitNormal = line.unitNormal();
    const linePoint = line.closestPoint(circle.center);
    if (linePoint === undefined || lineTangent === undefined || unitNormal === undefined)
      return undefined;
    const unitPerp = unitNormal.rotate90CCWXY()
    const result = [];
    for (const r of signedValues(circle.radius)) {
      const pointA = linePoint.clone()
      const pointB = circle.center.plusScaled(unitNormal, r);
      const lineC = UnboundedLine2dByPointAndNormal.createPointNormal(pointA, unitPerp);
      const taggedLine = new ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>(lineC);
      taggedLine.data.push(new Point2dImplicitCurve2d(pointA, line)); // CLONE!
      taggedLine.data.push(new Point2dImplicitCurve2d(pointB, circle)); // CLONE!
      result.push(taggedLine);
    }
    return result;
  }
  /**
   * Return all (i.e., up to 4) unbounded lines perpendicular to a circle and tangent to a circle.
   * Note that multiple colinear lines are returned tagged with diametrically opposing points of circleA.
   * @param circleA first circle (for perpendicular constraint)
   * @param circleB second circle (for tangent constraint)
   */
  public static linesPerpCTangentC(
    circleA: UnboundedCircle2dByCenterAndRadius, circleB: UnboundedCircle2dByCenterAndRadius
  ): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    // The solution lines are through the perp circle center and tangent to the tangent circle.
    // Hence this is the two infinite lines "through first circle center, tangent to second circle",
    // Bounded line segments go from the tangent circle points to the near and far intersections with the perp circle.
    const centerToCenter = Vector2d.createStartEnd(circleA.center, circleB.center);
    const centerToCenterDistance = centerToCenter.magnitude();
    const unitCenterToCenter = centerToCenter.normalize();
    if (unitCenterToCenter === undefined)
      return undefined;
    const centerToCenterNormal = unitCenterToCenter.rotate90CCWXY();
    const sine = Geometry.safeDivideFraction(circleB.radius, centerToCenterDistance, 0.0);
    if (sine > 1.0)
      return undefined;
    const absoluteCosine = Math.sqrt(1.0 - sine * sine);
    const result = [];
    for (const rA of signedValues(circleA.radius)) {
      for (const rB of signedValues(circleB.radius)) {
        const cosine = rB > 0 ? absoluteCosine : -absoluteCosine;
        const lineNormal = Vector2d.createAdd2Scaled(unitCenterToCenter, -sine, centerToCenterNormal, cosine);
        const lineDirection = Vector2d.createAdd2Scaled(unitCenterToCenter, cosine, centerToCenterNormal, sine);
        const pointA = circleA.center.plusScaled(lineDirection, rA);
        const pointB = circleB.center.plusScaled(lineNormal, Math.abs(rB));
        const lineC = UnboundedLine2dByPointAndNormal.createPointNormal(pointA, lineNormal);
        const taggedLine = new ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>(lineC);
        taggedLine.data.push(new Point2dImplicitCurve2d(pointA, circleA)); // CLONE
        taggedLine.data.push(new Point2dImplicitCurve2d(pointB, circleB)); // CLONE
        result.push(taggedLine);
      }
    }
    return result;
  }
  /**
   * Return all (i.e., up to 4) unbounded lines tangent to 2 circles.
   * * There are 4 lines if there is neither intersection nor containment between the circles
   * * There are 2 lines if the circles intersect
   * * THere are no lines if the one circle is entirely inside the other.
   * @param circleA first circle
   * @param circleB second circle
   */
  public static linesTangentCC(
    circleA: UnboundedCircle2dByCenterAndRadius, circleB: UnboundedCircle2dByCenterAndRadius
  ): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    // draw a line tangent to both circles.   This may have both circles on the same side,
    // or one circle on each side.
    // draw radii from both centers to the tangencies.   (These are parallel to each other)
    // the (sum or difference  of the radii) and the (distance between centers) are side and hypotenuse of
    // // a right triangle, with the tangent-to-tangent segment as the other side.
    // The lengths give sine and cosine of angles in the triangle, and those give vectors
    // from center to tangency points.
    const distanceAB = circleA.center.distance(circleB.center);
    if (distanceAB + Math.abs(circleB.radius) <= Math.abs(circleA.radius))
      return undefined;
    if (distanceAB + Math.abs(circleA.radius) <= Math.abs(circleB.radius))
      return undefined;
    const unitAB = Vector2d.createStartEnd(circleA.center, circleB.center);
    unitAB.normalize(unitAB);
    const result = [];
    if (unitAB !== undefined) {
      const radiusA = circleA.radius;
      const radiusB = circleB.radius;
      for (const signQ of [-1, 1]) {
        const q = radiusB + signQ * radiusA;
        const sine = q / distanceAB;
        if (Math.abs(sine) < 1.0) {
          const cosine = Math.sqrt(1.0 - sine * sine);
          for (const sign of [-1, 1]) {
            let pointA, pointB;
            if (signQ < 0) {
              pointA = circleA.center.addForwardLeft(radiusA * -sine, radiusA * sign * cosine, unitAB);
              pointB = circleB.center.addForwardLeft(radiusB * -sine, radiusB * sign * cosine, unitAB);
            } else {
              pointA = circleA.center.addForwardLeft(radiusA * sine, radiusA * sign * cosine, unitAB);
              pointB = circleB.center.addForwardLeft(-radiusB * sine, -radiusB * sign * cosine, unitAB);
            }
            const lineA = UnboundedLine2dByPointAndNormal.createPointPoint(pointA, pointB);
            const taggedLine = new ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>(lineA);
            taggedLine.data.push(new Point2dImplicitCurve2d(pointA, circleA)); // CLONE
            taggedLine.data.push(new Point2dImplicitCurve2d(pointB, circleB)); // CLONE
            result.push(taggedLine);
          }
        }
      }
    }
    return result;
  }
    /**
    * Return all (i.e., up to 8) circles tangent to two lines and a circle.
    * * There are 8 circles if the circle contains the intersection of the lines.
    * * There are 2 circles if the circle is completely contained in one quadrant bounded by the two lines.
    * * There are 2 circles if the circle intersects one ray outward from the intersection.
    * * There are 4 circles if the circle intersects two of the outward rays.
    */ public static circlesTangentLLC(
    lineA: UnboundedLine2dByPointAndNormal,
    lineB: UnboundedLine2dByPointAndNormal,
    circle: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    /*--------------------------------------------------------------------------------------
    Put origin at circle center.
    A,B are line points.
    M,N are line normals.
    (X).(X) = (a +- r)^2 = 0
    (X-A).M = +-r
    (X-B).N = +-r
    Need to consider 4 combinations of signs: (+++) (++-) (-++) (-+-) The other 4 are negations.
    Write the linear part as
    [M N]^ * X = [M.A N.B]^ + r Ei
    where Ei is one of E0=[1 1]^   or  E1=[1 -1]^
    Multiply by inverse of matrix X = F + r G
    The quadratic part is
    (F + rG).(F + rG) = (a +- r)^2
    (F + rG).(F + rG) = a^2 +- 2ar + r^2
    F.F + 2r G.F + r^2 G.G = a^2 +- 2ar + r^2
    r^2 (1-G.G) + 2(+-a - G.F)r + a^2-F.F = 0.
    Solve with positive, negative branch.  Each generates 2 solutions to go back through Ei.
    ----------------------------------------------------------------------------------------*/
    // lines with unit vector and point coordinates from circle center
    const lineA1 = lineA.cloneNormalizedFromOrigin(circle.center);
    const lineB1 = lineB.cloneNormalizedFromOrigin(circle.center);
    if (lineA1 === undefined || lineB1 === undefined)
      return undefined;
    // perpendicular distance from each line to center of circle
    const dotMA = lineA1.normal.dotProduct(lineA1.point);
    const dotMB = lineB1.normal.dotProduct(lineB1.point);

    const a = circle.radius;
    const vectorF = Vector2d.create(); // vector from circle center to intersection of the lines
    if (lineA1.normal.isParallelTo(lineB1.normal)
      || !SmallSystem.linearSystem2d(
        lineA1.normal.x, lineA1.normal.y,
        lineB1.normal.x, lineB1.normal.y,
        dotMA, dotMB, vectorF)) {
      // SPECIAL CASE: PARALLEL LINES
      // Lines are parallel
      // Make a midline. Half of line separation is the tangent circle radius.
      const midLinePoint = lineA1.point.interpolate(0.5, lineB1.point);
      const lineDirection = lineA1.normal.rotate90CCWXY();
      const a1 = lineA1.functionValue(midLinePoint);
      // vector from centerC to midline point midline point is vectorCP + s * lineDirectionA
      const coffSine2 = lineDirection.dotProduct(lineDirection);
      const coffSine = 2.0 * lineDirection.dotProduct(midLinePoint);
      const coffConstant = Geometry.hypotenuseSquaredXY(midLinePoint.x, midLinePoint.y);
      const targetRadius = [];
      // special case zero radius
      if (!Geometry.isSmallMetricDistance(circle.radius)) {
        targetRadius.push(circle.radius + a1);
        targetRadius.push(circle.radius - a1);
      } else {
        // circle is just a point -- the quadratic solver only has to happen once
        targetRadius.push(circle.radius + a1);
        // But if the center is ON one of the lines, construct by projecting to the other.
        // REMARK: In C++ code this pointOnLine test was done with messy
        // tolerance relative to the various line points' distance to origin.
        // Here we trust metric distance condition.
        let center;
        if (Geometry.isSmallMetricDistance(dotMA)) // tangency is on lineA; move towards line B
          center = circle.center.plusScaled(lineA1.normal, dotMB > 0.0 ? -a1 : a1);
        else if (Geometry.isSmallMetricDistance(dotMB)) // tangency is on lineB; move towards line A
          center = circle.center.plusScaled(lineB1.normal, dotMA > 0.0 ? a1 : -a1);
        if (center !== undefined) {
          const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(center, a1);
          const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
          markup.closePointsOfGeometry(newCircle.center, newCircle.center, newCircle.radius, [lineA, lineB, circle]);
          return [markup];
        }
      }
      const resultA = [];
      for (const radius of targetRadius) {
        const roots = Degree2PowerPolynomial.solveQuadratic(coffSine2, coffSine, coffConstant - radius * radius);
        if (roots) {
          for (const alpha of roots) {
            const center = circle.center.plus2Scaled(midLinePoint, 1.0, lineDirection, alpha);
            const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(center, a1);
            const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
            markup.closePointsOfGeometry(newCircle.center, newCircle.center, newCircle.radius, [lineA, lineB, circle]);
            resultA.push(markup);
          }
        }
      }
      return resultA;
    }
    const result = [];
    for (const sign1 of [-1, 1]) {
      const vectorG = Vector2d.create();
      if (SmallSystem.linearSystem2d(
        lineA1.normal.x, lineA1.normal.y,
        lineB1.normal.x, lineB1.normal.y, 1.0, sign1, vectorG)) {
        for (const sign2 of [-1, 1]) {
          const coffA = 1.0 - vectorG.dotProduct(vectorG);
          const coffB = 2.0 * (sign2 * a - vectorG.dotProduct(vectorF));
          const coffC = a * a - vectorF.dotProduct(vectorF);
          const roots = Degree2PowerPolynomial.solveQuadratic(coffA, coffB, coffC);
          if (roots !== undefined) {
            for (const r of roots) {
              const center = circle.center.plus2Scaled(vectorF, 1.0, vectorG, r);
              const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(center, r);
              if (!isThisCirclePresent(result, newCircle)) {
                const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
                markup.appendClosePoint(newCircle.center, lineA, newCircle.center, newCircle.radius);
                markup.appendClosePoint(newCircle.center, lineB, newCircle.center, newCircle.radius);
                markup.appendClosePoint(newCircle.center, circle, newCircle.center, newCircle.radius);
                result.push(markup);
              }
            }
          }
        }
      }
    }
    return result;
  }
  /**
   * Return all (i.e., up to 4) circles tangent to 2 circles and a line.
   * @param circleA first circle
   * @param circleB second circle
   * @param line the line
   */
  public static circlesTangentCCL(
    circleA: UnboundedCircle2dByCenterAndRadius,
    circleB: UnboundedCircle2dByCenterAndRadius,
    line: UnboundedLine2dByPointAndNormal,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    /*--------------------------------------------------------------------------------------
    (x-xA)^2 + (y-y0)^2 - (r + r0)^2 = 0
    (x-xB)^2 + (y-y1)^2 - (r + r1)^2 = 0
        y = r       NOTE: Cannot arbitrarily change sign of r as is done in 3-circle case.
    -------------------------------------------
    x^2 -2 xA x + xA^2 -2 y0 y + y0^2 - 2 r0 y - r0^2 = 0
    x^2 -2 xB x + xB^2 -2 y1 y + y1^2 - 2 r1 y - r1^2 = 0
    -------------------------------------------
    x^2 -2 xA x + -2 (y0 + r0) y + a0= 0          a0 = xA^2 + y0^2 - r0^2
    x^2 -2 xB x + -2 (y1 + r1) y + a1= 0          a1 = xB^2 + y1^2 - r1^2
    -------------------------------------------
    (A0) x^2 + b0 x + c0 y + a0= 0          b0 = -2x0    c0 = -2 (y0 + r0)
    (A1) x^2 + b1 x + c1 y + a1= 0          b1 = -2x1    c1 = -2 (y1 + r1)
    -------------------------------------------
    c1 x^2             c1 c0 y + c1 a0= 0
    c0 x^2 + c0 b1 x + c0 c1 y + c0 a1= 0
    ---------------------------------------
    Subtract first from second.
    (c0 - c1) x^2 + (c0 b1 - c1 b0) x + (c0 a1 - c1 a0) = 0.
    Solve for two x values.  Substitute in with largest c0, c1.
    ---------------------------------------
    Repeat with signed combinations of the circle radii.
    ----------------------------------------------------------------------------------------*/
    const lineUnitNormal = line.normal.normalize();
    if (lineUnitNormal === undefined)
      return undefined;
    const lineUnitAlong = lineUnitNormal.rotate90CCWXY();
    const circleGlobalOffsets = [
      Vector2d.createStartEnd(line.point, circleA.center),
      Vector2d.createStartEnd(line.point, circleB.center),
    ];
    const circleLocalOffset = [];
    for (const i of [0, 1]) {
      circleLocalOffset.push(
        Vector2d.create(
          circleGlobalOffsets[i].dotProduct(lineUnitAlong),
          circleGlobalOffsets[i].dotProduct(lineUnitNormal),
        ));
    }
    const coffA = [0, 0];
    const coffB = [0, 0];
    const coffC = [0, 0];
    const circleRadius = [0, 0];
    const result = [];
    const radiiFromA = signedValues(circleA.radius, circleA.radius);
    const radiiFromB = signedValues(circleB.radius, circleB.radius);
    for (const radiusA of radiiFromA) {
      circleRadius[0] = radiusA;
      for (const radiusB of radiiFromB) {
        circleRadius[1] = radiusB;
        for (const i of [0, 1]) {
          const r = circleRadius[i];
          coffA[i] = circleLocalOffset[i].magnitudeSquared() - r * r;
          coffB[i] = -2.0 * circleLocalOffset[i].x;
          coffC[i] = -2.0 * (circleLocalOffset[i].y + r);
        }
        const k = Math.abs(circleRadius[0]) > Math.abs(circleRadius[1])
          ? 0 : 1;
        const qa = coffC[0] - coffC[1];
        const qb = coffC[0] * coffB[1] - coffC[1] * coffB[0];
        const qc = coffC[0] * coffA[1] - coffC[1] * coffA[0];
        const xRoot = Degree2PowerPolynomial.solveQuadratic(qa, qb, qc);
        if (xRoot !== undefined) {
          for (const x of xRoot) {
            const y = Geometry.conditionalDivideCoordinate(x * x + coffB[k] * x + coffA[k], -coffC[k]);
            if (y !== undefined) {
              const r = Math.abs(y);
              const center = line.point.plus2Scaled(lineUnitAlong, x, lineUnitNormal, y);
              const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(center, r);
              if (!isThisCirclePresent(result, newCircle)) {
                const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
                markup.appendClosePoint(newCircle.center, circleA, newCircle.center, r);
                markup.appendClosePoint(newCircle.center, circleB, newCircle.center, r);
                markup.appendClosePoint(newCircle.center, line, newCircle.center, r);
                result.push(markup);
              }
            }
          }
        }
      }
    }
    return result;
  }
  /**
   * Special case CCC tangent construction when inputs are colinear.
   * @param circleA first input circle
   * @param circleB second input circle
   * @param circleC third input circle
   * @param rA signed radius for circleA
   * @param rB signed radius for circleB
   * @param rC signed radius for circleC
   * @param result pre-initialized array to which tangent circle markup will be added.
   */
  private static solveColinearCCCTangents(
    circleA: UnboundedCircle2dByCenterAndRadius,
    circleB: UnboundedCircle2dByCenterAndRadius,
    circleC: UnboundedCircle2dByCenterAndRadius,
    rA: number,
    rB: number,
    rC: number,
    result: ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[],
  ): void {
    const vectorAB = Vector2d.createStartEnd(circleA.center, circleB.center);
    const vectorAC = Vector2d.createStartEnd(circleA.center, circleC.center);
    const xB = vectorAB.magnitude();
    let xC = vectorAC.magnitude();
    if (vectorAB.dotProduct(vectorAC) < 0)
      xC = -xC;
    const unitAB = vectorAB.normalize();
    if (unitAB === undefined)
      return; // there are circle-in-circle cases with common centers
    const unitPerp = unitAB.rotate90CCWXY();
    /*
    Measuring from center A in rotated system:
    x^2 + y^2  = (r+rA)^2
    (x-xB)^2 + y^2 = (r+rB)^2
    (x-xC)^2 + y^2 = (r+rC)^2
    -------------------------
    x^2 + y^2  = (r+rA)^2
    -2xB x + xB^2 = (r+rB)^2 - (r+rA)^2
    -2xC x + xC^2 = (r+rC)^2 - (r+rA)^2
    -------------------------
    x^2 + y^2  = (r+rA)^2
    -2xB x = 2 (rB-rA) r + rB^2 - rA^2 - xB^2
    -2x2 x = 2 (rC-rA) r + rC^2 - rA^2 - xC^2
    -------------------------
    Solve
    -2xB x - 2 (rB-rA) r = rB^2 - rA^2 - xB^2
    -2xC x - 2 (rC-rA) r = rC^2 - rA^2 - xC^2
    */
    const ax = -2.0 * xB;
    const ar = -2.0 * (rB - rA);
    const a = rB * rB - rA * rA - xB * xB;
    const bx = -2.0 * xC;
    const br = -2.0 * (rC - rA);
    const b = rC * rC - rA * rA - xC * xC;
    const sRelTol = 1.0e-14;
    const origin = Point2d.create(circleA.center.x, circleA.center.y);
    const solutionVector = Vector2d.create();
    if (SmallSystem.linearSystem2d(ax, ar, bx, br, a, b, solutionVector)) {
      const x = solutionVector.x;
      const r = solutionVector.y;
      let dd = (r + rA) * (r + rA) - x * x;
      const tol = sRelTol * x * x;
      if (Math.abs(dd) < tol)
        dd = 0.0;
      if (dd >= 0.0) {
        const y = Math.sqrt(dd);
        const xy0 = origin.plus2Scaled(unitAB, x, unitPerp, y);
        const xy1 = origin.plus2Scaled(unitAB, x, unitPerp, -y);
        for (const newCenter of [xy0, xy1]) {
          const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(newCenter, r);
          if (!isThisCirclePresent(result, newCircle)) {
            const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
            markup.appendClosePoint(newCircle.center, circleA, newCircle.center, r);
            markup.appendClosePoint(newCircle.center, circleB, newCircle.center, r);
            markup.appendClosePoint(newCircle.center, circleC, newCircle.center, r);
            result.push(markup);
          }
        }
      }
    }
  }
  /**
   * Return all (i.e., up to 8) circles tangent to 3 circles.
   * @param circles the three input circles
   */
  private static circlesTangentCCCThisOrder(
    circles: UnboundedCircle2dByCenterAndRadius[],
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    // Call the circle centers and radii
    //    (ax, ay, ar)
    //    (bx, by, br)
    //    (cx, cy, cr)
    // For a tangent circle with center (x,y) and radius r,
    //   (x-ax)^2 + (y-ay)^2 = (r+ar)^2
    //   (x-bx)^2 + (y-by)^2 = (r+br)^2
    //   (x-cx)^2 + (y-cy)^2 = (r+cr)^2
    // This has squares of all the unknowns x,y,r
    // BUT !!! all coefficients of squares are 1.
    // Subtract the first from the second and third equations.
    // All the squares go away in the shifted equations.
    // What's left is 2 linear equations with x,y,r as unknowns.
    // Move the r and constant parts to the right side.
    // Solve for x and y as a linear function of r.
    // Substitute those linear forms back into the x and y of the first equation.
    // A quadratic in r is left!
    // Solve it for r, and then the linear forms give x and  y.
    // Do the whole process with every combination of signed br and cr.
    // (No need to treat negated ar because negating all of them is redundant)
    const result: ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] = [];
    const vector01 = Vector2d.createStartEnd(circles[0].center, circles[1].center);
    const vector02 = Vector2d.createStartEnd(circles[0].center, circles[2].center);
    const dot12 = vector01.dotProduct(vector02);
    const determinant = vector01.crossProduct(vector02);
    const determinantTol = 1.0e-8;
    const oneOverDeterminant = Geometry.conditionalDivideFraction(1.0, determinant);
    // messy tolerance test ported. Why not just a parallel test on the vectors?
    // maybe having 1/determinant is worth it?
    if (oneOverDeterminant === undefined
      || Math.abs(determinant) <= determinantTol * Math.abs(dot12)
      || oneOverDeterminant === undefined) {
      const signedR0 = circles[0].radius;
      for (const signedR1 of signedValues(circles[1].radius)) {
        for (const signedR2 of signedValues(circles[2].radius)) {
          this.solveColinearCCCTangents(
            circles[0], circles[1], circles[2],
            signedR0, signedR1, signedR2,
            result,
          );
        }
      }
      return result.length > 0 ? result : undefined;
    }
    const r0 = circles[0].radius;
    const inverseMatrix = Matrix3d.createRowValues(
      vector02.y * oneOverDeterminant, -vector01.y * oneOverDeterminant, 0.0,
      -vector02.x * oneOverDeterminant, vector01.x * oneOverDeterminant, 0.0,
      0.0, 0.0, 1.0,
    );
    for (const r1 of signedValues(circles[1].radius)) {
      for (const r2 of signedValues(circles[2].radius)) {
        const vectorA = Vector3d.create(
          -0.5 * (Geometry.square(r1) - Geometry.square(vector01.x) - Geometry.square(vector01.y) - Geometry.square(r0)),
          -0.5 * (Geometry.square(r2) - Geometry.square(vector02.x) - Geometry.square(vector02.y) - Geometry.square(r0)),
          0.0,
        );
        const vectorB = Vector3d.create(-(r1 - r0), -(r2 - r0), 0.0);
        const vectorA1 = inverseMatrix.multiplyVector(vectorA);
        const vectorB1 = inverseMatrix.multiplyVector(vectorB);
        const qa = vectorB1.magnitudeSquared() - 1.0;
        const qb = 2 * (vectorA1.dotProduct(vectorB1) - r0);
        const qc = vectorA1.magnitudeSquared() - Geometry.square(r0);
        const roots = Degree2PowerPolynomial.solveQuadratic(qa, qb, qc);
        if (roots !== undefined) {
          if (roots.length === 2
            && Geometry.isSmallMetricDistance(Math.abs(roots[0]) - Math.abs(roots[1])))
            roots.pop();
          for (const newRadius of roots) {
            const newCenter = circles[0].center.plus2Scaled(vectorA1, 1.0, vectorB1, newRadius);
            const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(newCenter, newRadius);
            if (!isThisCirclePresent(result, newCircle)) {
              const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
              markup.appendClosePoint(newCircle.center, circles[0], newCircle.center, newRadius);
              markup.appendClosePoint(newCircle.center, circles[1], newCircle.center, newRadius);
              markup.appendClosePoint(newCircle.center, circles[2], newCircle.center, newRadius);
              result.push(markup);
            }
          }
        }
      }
    }
    return result;
  }
  /**
   * Return all (i.e., up to 8) circles tangent to 3 circles.
   * @param circleA first circle
   * @param circleB second circle
   * @param circleC third circle
   */
  public static circlesTangentCCC(
    circleA: UnboundedCircle2dByCenterAndRadius,
    circleB: UnboundedCircle2dByCenterAndRadius,
    circleC: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    const circlesInOrder = [circleA, circleB, circleC];
    return this.circlesTangentCCCThisOrder(circlesInOrder);
  }
  /**
   * Return an unbounded line with the midpoint between pointA and pointB as its reference point
   * and the unit vector from pointA towards pointB as its normal.
   * @param pointA first point
   * @param pointB second point
   * @returns unbounded line, or undefined if pointA and pointB are coincident.
   */
  public static bisector(pointA: XAndY, pointB: XAndY): UnboundedLine2dByPointAndNormal | undefined {
    const vectorAB = Vector2d.createStartEnd(pointA, pointB);
    const midPoint = Point2d.createInterpolated(pointA, 0.5, pointB);
    const unitAB = vectorAB.normalize();
    if (unitAB === undefined)
      return undefined;
    return UnboundedLine2dByPointAndNormal.createPointNormal(midPoint, unitAB);
  }
  /**
   * Compute circles of specified radius tangent to each of the lines
   * * There are normally 4 circles
   * * The undefined case occurs when the lines are parallel.
   * @param lineA first line
   * @param lineB second line
   * @param radius radius of tangent circles
   * @returns array of circles with annotated tangencies. returns undefined if lines are parallel.
   */
  public static circlesTangentLLR(
    lineA: UnboundedLine2dByPointAndNormal,
    lineB: UnboundedLine2dByPointAndNormal,
    radius: number,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    // Construct lines offset by (positive and negative) radii.
    // For each of the 4 combinations of offset lines, the intersection of offsets is the
    // center of the tangent circle.
    if (Geometry.isSmallMetricDistance(radius))
      return undefined;
    const offsetsA = [
      lineA.cloneShifted(radius)!,
      lineA.cloneShifted(-radius)!
    ];
    const offsetsB = [
      lineB.cloneShifted(radius)!,
      lineB.cloneShifted(-radius)!
    ];
    const result = [];
    for (const offsetA of offsetsA) {
      for (const offsetB of offsetsB) {
        const p = offsetA?.intersectUnboundedLine2dByPointAndNormalWithOffsets(offsetB);
        if (p !== undefined) {
          const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(p, radius);
          if (!isThisCirclePresent(result, newCircle)) {
            const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
            markup.appendClosePoint(newCircle.center, lineA, newCircle.center, newCircle.radius);
            markup.appendClosePoint(newCircle.center, lineB, newCircle.center, newCircle.radius);
            result.push(markup);
          }
        }
      }
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Compute circles of specified radius tangent to both a line and an arc
   * * There can be 0 to 8 circles
   * * The undefined case occurs when the smallest distance from circle to line exceeds radius.
   * @param circleA the circle
   * @param lineB the line
   * @param radius radius of tangent circles
   * @returns array of circles with annotated tangencies
   */
  public static circlesTangentCLR(
    circleA: UnboundedCircle2dByCenterAndRadius, lineB: UnboundedLine2dByPointAndNormal, radius: number,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    // From circleA, construct circles offset by positive and negative radii.
    // From lineB, construct lines offset by positive and negative radii.
    // Each combination of [offsetCircle, offsetLine] can have 2 intersections.
    // Each such intersection is the center of a tangent circle.
    if (Geometry.isSmallMetricDistance(radius))
      return undefined;
    const offsetsA = [
      UnboundedCircle2dByCenterAndRadius.createPointRadius(circleA.center, circleA.radius + radius),
      UnboundedCircle2dByCenterAndRadius.createPointRadius(circleA.center, circleA.radius - radius),
    ];
    const offsetsB = [
      lineB.cloneShifted(radius)!,
      lineB.cloneShifted(-radius)!,
    ];
    const result = [];
    for (const offsetA of offsetsA) {
      for (const offsetB of offsetsB) {
        const points = offsetA.intersectLine(offsetB);
        for (const p of points) {
          const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(p, radius);
          if (!isThisCirclePresent(result, newCircle)) {
            const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
            markup.appendClosePoint(newCircle.center, circleA, newCircle.center, newCircle.radius);
            markup.appendClosePoint(newCircle.center, lineB, newCircle.center, newCircle.radius);
            result.push(markup);
          }
        }
      }
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Compute circles of specified radius tangent to both circles
   * * There can be 0 to 8 circles
   * * The undefined case is when the smallest distance between the circles exceeds the requested radius.
   * @param circleA the first circle
   * @param circleB the second circle
   * @param radius radius of tangent circles
   * @returns array of circles with annotated tangencies
   */
  public static circlesTangentCCR(
    circleA: UnboundedCircle2dByCenterAndRadius, circleB: UnboundedCircle2dByCenterAndRadius, radius: number,
  ): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    // From circleA, construct circles offset by positive and negative radii.
    // From circleB, construct circles offset by positive and negative radii.
    // Each combination of [offsetA, offsetsB] can have 2 intersections.
    // Each such intersection is the center of a tangent circle.
    if (Geometry.isSmallMetricDistance(radius))
      return undefined;
    const offsetsA = [
      UnboundedCircle2dByCenterAndRadius.createPointRadius(circleA.center, circleA.radius + radius),
      UnboundedCircle2dByCenterAndRadius.createPointRadius(circleA.center, circleA.radius - radius),
    ];
    const offsetsB = [
      UnboundedCircle2dByCenterAndRadius.createPointRadius(circleB.center, circleB.radius + radius),
      UnboundedCircle2dByCenterAndRadius.createPointRadius(circleB.center, circleB.radius - radius),
    ];
    const result = [];
    for (const offsetA of offsetsA) {
      for (const offsetB of offsetsB) {
        const points = offsetA.intersectCircle(offsetB);
        for (const p of points) {
          const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius(p, radius);
          if (!isThisCirclePresent(result, newCircle)) {
            const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
            markup.appendClosePoint(newCircle.center, circleA, newCircle.center, newCircle.radius);
            markup.appendClosePoint(newCircle.center, circleB, newCircle.center, newCircle.radius);
            result.push(markup);
          }
        }
      }
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Construct basis vectors for hyperbola or ellipse whose points are equidistant from tangencies with
   * circleA and circleB.
   * * If the curve is a hyperbola, the equation is
   *            X = center + vectorU * sec(theta) + vectorV * tan(theta)
   * * If the curve is an ellipse, the equation is
   *            X = center + vectorU * cos(theta) + vectorV * sin(theta)
   * @param circleA first circle
   * @param circleB second circle
   */
  public static medialCurveCircleCircle(
    circleA: UnboundedCircle2dByCenterAndRadius, circleB: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitCurve2d | undefined {
    const d = circleA.center.distance(circleB.center);
    const origin = circleA.center.interpolate(0.5, circleB.center);
    const h = circleA.radius + circleB.radius;
    const discriminant = d * d - h * h;
    const hy = Math.sqrt(Math.abs(discriminant));
    const xAxis = Vector2d.createStartEnd(origin, circleB.center).normalize();
    if (xAxis === undefined)
      return undefined;
    const yAxis = xAxis.rotate90CCWXY();
    const ax = 0.5 * h;
    const ay = 0.5 * hy;
    const vectorU = xAxis.scale(ax);
    const vectorV = yAxis.scale(ay);
    if (discriminant > 0.0) {
      return UnboundedHyperbola2d.createCenterAndAxisVectors(origin, vectorU, vectorV);
    } else if (discriminant < 0.0) {
      return UnboundedEllipse2d.createCenterAndAxisVectors(origin, vectorU, vectorV);
    }
    return undefined;
  }
  /**
   * Construct parabolas whose points are equidistant from tangencies with
   * circleA and circleB.
   * * Note that if th e circle has non-zero radius there are two parabolas based on
   *     tangencies on near or far side of the circle.
   * @param line the line
   * @param circle the circle
   */
  public static medialCurveLineCircle(
    line: UnboundedLine2dByPointAndNormal, circle: UnboundedCircle2dByCenterAndRadius,
  ): ImplicitCurve2d[] | undefined {
    const linePoint = line.closestPoint(circle.center);
    if (linePoint === undefined)
      return undefined;
    const lineA = line.cloneNormalizedWithOrigin(linePoint);
    if (lineA === undefined)
      return undefined;
    const b = linePoint.distance(circle.center);
    const side = lineA.functionValue(circle.center) > 0 ? 1 : -1;
    const signedB = b * side;
    const signedRadii = [];
    if (Geometry.isSameCoordinate(circle.radius, -circle.radius))
      signedRadii.push(0);
    else {
      signedRadii.push(circle.radius);
      signedRadii.push(-circle.radius);
    }
    const result = [];
    for (const r of signedRadii) {
      const vertexDistance = (signedB - r) * 0.5;
      const vertex = lineA.point.plusScaled(lineA.normal, vertexDistance);
      const c = 2 * (signedB + r);
      const oneOverC = Geometry.conditionalDivideCoordinate(1, c);
      if (oneOverC !== undefined) {
        const vectorV = lineA.normal.clone().scale(oneOverC);
        const vectorU = lineA.normal.unitPerpendicularXY();
        const parabola = UnboundedParabola2d.createCenterAndAxisVectors(vertex, vectorU, vectorV);
        result.push(parabola);
      }
    }
    return result;
  }
}
/**
 * If distance is near zero metric, return an array containing only value.
 * If not near zero, return an array with both value and its negative (in that order).
 * @param distance the distance
 * @param value the value
 */
function signedValues(distance: number, value?: number): number[] {
  if (value === undefined)
    value = distance;
  const values = [value];
  if (!Geometry.isSmallMetricDistance(distance))
    values.push(-value);
  return values;
}
/** Search an array of circles to see if a particular new circle is already present. */
function isThisCirclePresent(
  circles: ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[], circle: UnboundedCircle2dByCenterAndRadius,
): boolean {
  for (const c of circles) {
    if (circle.isSameCircle(c.curve, true))
      return true;
  }
  return false;
}
