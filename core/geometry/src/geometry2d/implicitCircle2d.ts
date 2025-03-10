/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */


import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { XAndY } from "../geometry3d/XYZProps";
import { ImplicitCurve2d } from "./implicitCurve2d";
import { ImplicitLine2d as UnboundedLine2dByPointAndNormal } from "./implicitLine2d";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Vector3d } from "../geometry3d/Point3dVector3d";
import { SmallSystem } from "../numerics/SmallSystem";
import { Degree2PowerPolynomial } from "../numerics/Polynomials";

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

  /**
   * Create an ImplicitCircle2d from XY parts of its center and its radius
   * @param centerX
   * @param centerY
   * @param radius
   * @returns
   */
  public static createXYRadius(centerX: number, centerY: number, radius: number): UnboundedCircle2dByCenterAndRadius {
    return new UnboundedCircle2dByCenterAndRadius(Point2d.create(centerX, centerY), radius);
  }

  /**
   * Create an ImplicitCircle2d from an xy object and a radius.
   * @param center
   * @param radius
   * @returns
   */
  public static createPointRadius(center: XAndY, radius: number): UnboundedCircle2dByCenterAndRadius {
    return new UnboundedCircle2dByCenterAndRadius(Point2d.create(center.x, center.y), radius);
  }
public override functionValue (xy: XAndY) : number {
  return Geometry.distanceXYXY (xy.x, xy.y, this.center.x, this.center.y) - this.radius;
}
public override closestPoint(xy: XAndY, _bias?: XAndY | number): Point2d {
  const d = Geometry.distanceXYXY (this.center.x, this.center.y, xy.x, xy.y);
  if (Geometry.isSameCoordinate (d, 0))
    return Point2d.create (this.center.x + this.radius, this.center.y);
  const fraction = this.radius / d;
  return this.center.interpolate (fraction, xy);
}
// eslint-disable-next-line @itwin/prefer-get
public override isDegenerate ():boolean{
  return Geometry.isSameCoordinate (this.radius, 0);
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
export class TaggedArray<TagType,MemberType> {
  public tag: TagType;
  public data: MemberType[];
  /** CAPTURE tag and (optional) array.
   * * If he data array is not given, an empty array is created.
  */
  public constructor  (tag: TagType, data?: MemberType[]){
this.tag = tag;
this.data = data !== undefined ? data : [];

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

  public appendClosePoint (spacePoint: Point2d, curve:ImplicitCurve2d):boolean{
    const closestPoint = curve.closestPoint (spacePoint);
    this.data.push(new Point2dImplicitCurve2d(closestPoint, curve));
    return true;
  }
}

export class ConstrainedConstruction {
  /*--------------------------------------------------------------------------------------
  (X-A).normalA     = a*r
  (X-B).normalB     = b*r
  (X-B).normalC     = c*r
  Typical expansion is
  x*mx + y*my - a*r = A.normalA
  Where a,b,c are combinations of {+1,-1}
  Need to consider 4 combinations of signs: (+++) (++-) (+-+) (+--) The other 4 generate negated r as solution.
  ----------------------------------------------------------------------------------------*/
  public static circlesTangentLLL(
    lineA: UnboundedLine2dByPointAndNormal,
    lineB: UnboundedLine2dByPointAndNormal,
    lineC: UnboundedLine2dByPointAndNormal): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    // Make lines with normal vectors and nearby origin . ..
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
          const circle = UnboundedCircle2dByCenterAndRadius.createXYRadius(origin.x + xyr.x, origin.y + xyr.y, xyr.z);
          const markup = ImplicitGeometryMarkup.createCapture (circle);
          markup.appendClosePoint (circle.center, lineA);
          markup.appendClosePoint (circle.center, lineB);
          markup.appendClosePoint (circle.center, lineC);
          result.push (markup);
        }
      }
    }
    return result;
  }
  public static linesTangentCC(
    circleA: UnboundedCircle2dByCenterAndRadius,
    circleB: UnboundedCircle2dByCenterAndRadius
  ): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    const distanceAB = circleA.center.distance (circleB.center);
    if (distanceAB + Math.abs (circleB.radius) <= Math.abs (circleA.radius))
      return undefined;
    if (distanceAB + Math.abs (circleA.radius) <= Math.abs (circleB.radius))
      return undefined;
    const unitAB = Vector2d.createStartEnd (circleA.center, circleB.center);
    unitAB.normalize (unitAB);
    const result = [];
    if (unitAB !== undefined){
      const radiusA = circleA.radius;
      const radiusB = circleB.radius;
      for (const signQ of [-1, 1]){
        const q = radiusB + signQ * radiusA;
        const sine = q/ distanceAB;
        if (Math.abs (sine) < 1.0){
          const cosine = Math.sqrt (1.0 - sine * sine);
          for (const sign of [-1,1]){
            let pointA, pointB;
            if (signQ < 0){
            pointA = circleA.center.addForwardLeft (radiusA * -sine, radiusA * sign *cosine, unitAB);
            pointB = circleB.center.addForwardLeft (radiusB * -sine, radiusB * sign *cosine, unitAB);
          } else{
            pointA = circleA.center.addForwardLeft (radiusA * sine, radiusA * sign *cosine, unitAB);
            pointB = circleB.center.addForwardLeft (-radiusB * sine, - radiusB * sign *cosine, unitAB);
          }
            const lineA = UnboundedLine2dByPointAndNormal.createPointPoint (pointA, pointB);
            const taggedLine = new ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal> (lineA);
              taggedLine.data.push(new Point2dImplicitCurve2d (pointA, circleA));  // CLONE!
              taggedLine.data.push(new Point2dImplicitCurve2d (pointB, circleB));  // CLONE!
              result.push(taggedLine);
            }
          }
        }
      }
    return result;
  }
/*--------------------------------------------------------------------------------------
Put origin at circle center.
A,B are line points.
M,N are line normals.
(X).(X) = (a +- r)^2 = 0
(X-A).M     = +-r
(X-B).N     = +-r
Need to consider 4 combinations of signs: (+++) (++-) (-++) (-+-) The other 4 are negations.
Write the linear part as
[M N]^ * X = [M.A N.B]^ + r Ei       where Ei is one of E0=[1 1]^   or  E1=[1 -1]^
Mutliply by inverse of matrix
   X = F + r G
The quadratic part is
(F + rG).(F + rG) = (a +- r)^2
(F + rG).(F + rG) = a^2 +- 2ar + r^2
F.F + 2r G.F + r^2 G.G = a^2 +- 2ar + r^2
r^2 (1-G.G) + 2(+-a - G.F)r + a^2-F.F = 0.
Solve with positive, negative branch.  Each generates 2 solutions to go back through Ei.
----------------------------------------------------------------------------------------*/
public static circlesTangentLLC(
  lineA: UnboundedLine2dByPointAndNormal,
  lineB: UnboundedLine2dByPointAndNormal,
  circleC: UnboundedCircle2dByCenterAndRadius):
      ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    // lines with unit vector and point coordinates from circle center.
    const lineA1 = lineA.cloneNormalizedFromOrigin (circleC.center);
    const lineB1 = lineB.cloneNormalizedFromOrigin(circleC.center);

    if (lineA1 === undefined || lineB1 === undefined)
        return undefined;
    // perpendicular distance from each line to center of circle.
    const dotMA = lineA1.normal.dotProduct (lineA1.point);
    const dotMB = lineB1.normal.dotProduct (lineB1.point);

    const a = circleC.radius;
    const vectorF = Vector2d.create ();  // vector from circle center to intersection of the lines !
    if (lineA1.normal.isParallelTo (lineB1.normal)
      || !SmallSystem.linearSystem2d (
        lineA1.normal.x, lineA1.normal.y,
        lineB1.normal.x, lineB1.normal.y,
        dotMA, dotMB, vectorF)){
        // SPECIAL CASE:  PARALLEL LINES
        // Lines are parallel.
        // Make a midline.  Half of line separation is the tangent circle radius.
        const  midLinePoint =  lineA1.point.interpolate (0.5, lineB1.point);
        const lineDirection = lineA1.normal.rotate90CCWXY();
        const a1 = lineA1.functionValue (midLinePoint);
        // vector from centerC to midline point midline point is vectorCP + s * lineDirectionA
        const coffSine2 = lineDirection.dotProduct(lineDirection);
        const coffSine  = 2.0 * lineDirection.dotProduct(midLinePoint);
        const coffConstant  = Geometry.hypotenuseSquaredXY (midLinePoint.x, midLinePoint.y);
        const targetRadius = [];
        // special case zero radius.
        if (!Geometry.isSmallMetricDistance (circleC.radius)){
          targetRadius.push (circleC.radius + a1);
          targetRadius.push (circleC.radius - a1);
        } else {
            // circle is just a point -- the quadratic solver only has to happen once.
            targetRadius.push (circleC.radius + a1);
            //  But if the center is ON one of the lines, construct by projecting to the other.
            // REMARK: In C++ code this pointOnLine test was done with messy
            // tolerance relative to the various line points' distance to origin.
            // Here we trust metric distance condition . . .
            let center;
            if (Geometry.isSmallMetricDistance (dotMA))
                {
                // Tangency is on lineA.  Move towards line B...
                center = circleC.center.plusScaled (lineA1.normal, dotMB > 0.0 ? -a1 : a1);
                }
            else if (Geometry.isSmallMetricDistance (dotMB))
                {
                // Tangency is on lineB.  Move towards line A
                center = circleC.center.plusScaled (lineB1.normal, dotMA > 0.0 ? a1 : -a1);
                }
            if (center !== undefined)
                {
                const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius (center, a1);
                const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
                return [markup];
                }
            }

        const resultA = [];
        for (const radius of targetRadius)
            {
            const roots = Degree2PowerPolynomial.solveQuadratic (coffSine2, coffSine, coffConstant - radius * radius);
            if (roots){
              for (const alpha of roots)
                {
                  const center = circleC.center.plus2Scaled (midLinePoint, 1.0, lineDirection, alpha);
                  const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius (center, a1);
                  const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
                  resultA.push (markup);
                }
              }
            }
        return resultA;
        }

    const result = [];

    for (const sign1 of [-1,1])
      {
        const vectorG = Vector2d.create ();
        if (SmallSystem.linearSystem2d (
            lineA1.normal.x, lineA1.normal.y,
            lineB1.normal.x, lineB1.normal.y, 1.0, sign1, vectorG)){

          for (const sign2 of [-1,1])
              {
              const coffA = 1.0 - vectorG.dotProduct(vectorG);
              const coffB = 2.0 * (sign2 * a - vectorG.dotProduct(vectorF));
              const coffC = a * a - vectorF.dotProduct(vectorF);
              const roots = Degree2PowerPolynomial.solveQuadratic (coffA, coffB, coffC);
              if (roots !== undefined){
               for (const r of roots)
                  {
                  const center = circleC.center.plus2Scaled (vectorF, 1.0, vectorG, r);
                  const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius (center, r);
                  const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
                  result.push (markup);
                  }
                }
              }
          }
      }
      return result;
  }
public static circlesTangentCCL(
  circleA: UnboundedCircle2dByCenterAndRadius,
  circleB: UnboundedCircle2dByCenterAndRadius,
  lineC: UnboundedLine2dByPointAndNormal,
):ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
  /*--------------------------------------------------------------------------------------

(x-x0)^2 + (y-y0)^2 - (r + r0)^2 = 0

(x-x1)^2 + (y-y1)^2 - (r + r1)^2 = 0
    y = r       NOTE: Cannot arbitrarily change sign of r as is done in 3-circle case.
-------------------------------------------
x^2 -2 x0 x + x0^2 -2 y0 y + y0^2 - 2 r0 y - r0^2 = 0
x^2 -2 x1 x + x1^2 -2 y1 y + y1^2 - 2 r1 y - r1^2 = 0
-------------------------------------------
x^2 -2 x0 x + -2 (y0 + r0) y + a0= 0          a0 = x0^2 + y0^2 - r0^2
x^2 -2 x1 x + -2 (y1 + r1) y + a1= 0          a1 = x1^2 + y1^2 - r1^2
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
----------------------------------------------------------------------------------------*/
  const lineUnitNormal = lineC.normal.normalize();
  if (lineUnitNormal === undefined)
    return undefined;
  const lineUnitAlong = lineUnitNormal.rotate90CCWXY();
  const circleGlobalOffets = [
    Vector2d.createStartEnd (lineC.point, circleA.center),
    Vector2d.createStartEnd (lineC.point, circleB.center)];
  const circleLocalOffset = [];
  for (const i of [0,1]){
    circleLocalOffset.push(
      Vector2d.create (
        circleGlobalOffets[i].dotProduct (lineUnitAlong),
        circleGlobalOffets[i].dotProduct (lineUnitNormal)
      ));
    }
  const coffA = [0,0];
  const coffB = [0,0];
  const coffC = [0,0];
  const circleRadius = [0,0];
  const result = [];
  for (const signA of [1,-1]){
    circleRadius[0] = signA * circleA.radius;
    for (const signB of [1,-1]){
      circleRadius[1] = signB * circleB.radius;
      for (const i of [0,1]){
        const r = circleRadius[i];
        coffA[i] = circleLocalOffset[i].magnitudeSquared() - r * r;
        coffB[i] = -2.0 * circleLocalOffset[i].x;
        coffC[i] = -2.0 * (circleLocalOffset[i].y + r);
        }
        const k = Math.abs (circleRadius[0]) > Math.abs (circleRadius[1])
                    ? 0 : 1;
        const qa = coffC[0] - coffC[1];
        const qb = coffC[0] * coffB[1] - coffC[1] * coffB[0];
        const qc = coffC[0] * coffA[1] - coffC[1] * coffA[0];

        const xRoot = Degree2PowerPolynomial.solveQuadratic (qa, qb, qc);
        if (xRoot !== undefined){
          for (const x of xRoot){
            const y = Geometry.conditionalDivideCoordinate (
              x * x + coffB[k] * x + coffA[k],
              -coffC[k]);
              if (y !== undefined){
                const r = Math.abs (y);
                const center = lineC.point.plus2Scaled (lineUnitAlong, x, lineUnitNormal, y);
                const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius (center, r);
                const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
                result.push (markup);
              }
            }
          }
        }
    }
    return result;
  }
  private static circlesTangentCCCThisOrder(
    circles: UnboundedCircle2dByCenterAndRadius [],
  ):ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
  const result = [];
  const r0 = circles[0].radius;
  const vector01 = Vector2d.createStartEnd (circles[0].center, circles[1].center);
  const vector02 = Vector2d.createStartEnd (circles[0].center, circles[2].center);
  const dot12 = vector01.dotProduct (vector02);
  const determinant = vector01.crossProduct (vector02);
  const determinantTol = 1.0e-8;
  const oneOverDeterminant = Geometry.conditionalDivideFraction (1.0, determinant);
  // Messy tolerance test ported.  Why not just a parallel test on the vectors?
  // Maybe having 1/determinant is worth it?
  if (Math.abs (determinant) <= determinantTol * Math.abs (dot12) || oneOverDeterminant === undefined){
    return undefined;
    }
    const inverseMatrix = Matrix3d.createRowValues(
      vector02.y * oneOverDeterminant,  -vector01.y * oneOverDeterminant, 0.0,
     -vector02.x * oneOverDeterminant,   vector01.x * oneOverDeterminant, 0.0,
      0.0,          0.0,        1.0);

  for (const r1 of [circles[1].radius, -circles[1].radius]){
    for (const r2 of [circles[2].radius, -circles[2].radius]){
      const vectorA = Vector3d.create (
        -0.5 * (square(r1) - square(vector01.x) - square(vector01.y)- square(r0)),
        -0.5 * (square(r2) - square(vector02.x) - square(vector02.y) - square(r0)),
        0.0);

      const vectorB = Vector3d.create ( -(r1-r0), -(r2-r0), 0.0);
      const vectorA1 = inverseMatrix.multiplyVector (vectorA);
      const vectorB1 = inverseMatrix.multiplyVector (vectorB);

      const qa = vectorB1.magnitudeSquared() - 1.0;
      const qb = 2 * (vectorA1.dotProduct(vectorB1) - r0);
      const qc = vectorA1.magnitudeSquared () - square(r0);
      const roots = Degree2PowerPolynomial.solveQuadratic (qa, qb, qc);
      if (roots !== undefined){
        // TODO: filter equal or negated root cases.
        for (const newRadius of roots){
          const newCenter = circles[0].center.plus2Scaled (vectorA1, 1.0, vectorB1, newRadius);
          const newCircle = UnboundedCircle2dByCenterAndRadius.createPointRadius (newCenter, newRadius);
          const markup = new ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>(newCircle);
          result.push (markup);
          }
      }
    }
  }
  return result;
  }
  public static circlesTangentCCC(
    circleA: UnboundedCircle2dByCenterAndRadius,
    circleB: UnboundedCircle2dByCenterAndRadius,
    circleC: UnboundedCircle2dByCenterAndRadius
  ):ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    const circlesInOrder = [circleA, circleB, circleC];
    return this.circlesTangentCCCThisOrder (circlesInOrder);
    }

}
function square(x:number): number { return x * x;}