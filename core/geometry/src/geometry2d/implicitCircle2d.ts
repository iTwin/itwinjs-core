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
}
