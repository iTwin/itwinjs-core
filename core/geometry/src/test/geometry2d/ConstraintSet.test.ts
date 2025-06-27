

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, it } from "vitest";
import { Geometry } from "../../Geometry";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { UnboundedCircle2dByCenterAndRadius } from "../../curve/internalContexts/geometry2d/UnboundedCircle2d";
import { Arc3d } from "../../curve/Arc3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Vector2d } from "../../geometry3d/Point2dVector2d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { CurvePrimitive, LineString3d } from "../../core-geometry";
import { UnboundedLine2dByPointAndNormal } from "../../curve/internalContexts/geometry2d/UnboundedLine2d.";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "../../curve/internalContexts/geometry2d/implicitCurve2d";
import { ConstraintSet, ConstructionConstraint } from "../../curve/internalContexts/geometry2d/ConstraintSet";


function implicitCircle2dToArc3d (circle: UnboundedCircle2dByCenterAndRadius, z: number = 0.0 ):Arc3d | LineString3d|undefined{
  if (circle.radius !== 0.0)
  return Arc3d.createCenterNormalRadius (Point3d.create (circle.center.x, circle.center.y, z),
    Vector3d.create (0,0,1), circle.radius);
  const size = 0.1;
  const x0 = circle.center.x - size;
  const x1 = circle.center.x + size;
  const y0 = circle.center.y - size;
  const y1 = circle.center.y + size;
  return LineString3d.create ([[x0,y0,z],[x1,y1,z],[x1,y0,z],[x0,y1,z]]);
}
function implicitLine2dToLineSegment3d (line: UnboundedLine2dByPointAndNormal, z: number = 0.0,
  a0: number,
  a1: number
):LineSegment3d | undefined{
  const direction = Vector3d.create (line.normal.y, -line.normal.x, 0);
  const origin = Point3d.create (line.point.x, line.point.y, z);
    return LineSegment3d.create (
    origin. plusScaled (direction, a0),
    origin.plusScaled (direction, a1));
  }
  function implicitCurve2dToGeometry (curve: ImplicitCurve2d):CurvePrimitive | undefined{
    if (curve instanceof UnboundedCircle2dByCenterAndRadius){
      return implicitCircle2dToArc3d (curve);
    } else if (curve instanceof UnboundedLine2dByPointAndNormal){
      return implicitLine2dToLineSegment3d (curve, 0, -10, 10);
    }
return undefined;
  }
  function testParallelGradiants (ck: Checker, vectorA:Vector2d, vectorB: Vector2d){
    if (Geometry.isSmallMetricDistance (vectorA.magnitude ()) || Geometry.isSmallMetricDistance (vectorB.magnitude ()))
      return;
    ck.testParallelOrAntiParllel2d (vectorA, vectorB, "expect parallelGradiants");
  }

/**
 *
 * @param ck checker4
 * @param allGeometry output capture array
 * @param x0 output x shift
 * @param y0 output y shift
 * @param markup circles to output with lines to tangency
 * @param inputGeometry additional input geometry to output with each markup batch
 * @param yStep step to apply to y0 for each output circle and markup batch
 * @returns updated y0
 */
function outputCircleMarkup (ck: Checker, allGeometry: GeometryQuery[], x0: number, y0: number,
  markup: ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined,
  inputGeometry: ImplicitCurve2d [] | undefined = undefined, yStep: number = 0) : number{
    if (markup === undefined){
      if (inputGeometry){
        for (const g1 of inputGeometry){
          GeometryCoreTestIO.captureCloneGeometry (allGeometry,
            implicitCurve2dToGeometry (g1), x0, y0);
          }
        }
        return y0;
      }
    for (const m of markup){
    if (m.curve instanceof UnboundedCircle2dByCenterAndRadius)
      GeometryCoreTestIO.captureCloneGeometry (allGeometry,
        implicitCircle2dToArc3d (m.curve), x0, y0);
        for (const g of m.data){
             if (inputGeometry){
                for (const g1 of inputGeometry){
                  GeometryCoreTestIO.captureCloneGeometry (allGeometry,
                    implicitCurve2dToGeometry (g1), x0, y0);
                  }
             }
            GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              LineSegment3d.create (
                Point3d.create (m.curve.center.x, m.curve.center.y),
                Point3d.create (g.point.x, g.point.y)),
                x0, y0);
            const fM = m.curve.functionValue (g.point);
            const fG = g.curve.functionValue(g.point);
            const gradM = m.curve.gradiant (g.point);
            const gradG = g.curve.gradiant (g.point);
            ck.testCoordinate (fM, 0.0, "function value fM at tangency", m.curve, g.curve);
            ck.testCoordinate (fG, 0.0, "function value fG at tangency", m.curve, g.curve);
            testParallelGradiants (ck, gradM, gradG);
            }
        y0 += yStep;
        }
      return y0;
      }



function transferCurve (source: ConstructionConstraint, dest: ImplicitCurve2d[]){
    if (source.curve)
        dest.push (source.curve);
}

it("ConstraintSetCirclesAndLines", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 0, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 8, 1);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(0.5, 2, 0.2);
    const lineL = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(1, 1, 1, 0.2);
    const lineM = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(10, 2, 0.2, -0.9);
    const lineN = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(5, 10, 4, 2);

       // Note that allConstraintss has 3 contiguous circles, then 3 contguous lines, then a radius.
    // cycling through blocks (includingwraparound) of 3 will touch all the cases in the construction set branching.
    // juggling the order within each block of 3 exercises the sort logic.
    const allConstraints = [ConstructionConstraint.createTangentTo(circleA),
    ConstructionConstraint.createTangentTo(circleB),
    ConstructionConstraint.createTangentTo(circleC),
    ConstructionConstraint.createTangentTo(lineL),
    ConstructionConstraint.createTangentTo(lineM),
    ConstructionConstraint.createTangentTo(lineN),
    ConstructionConstraint.createRadius (25),
    ];

    let x0 = 0;
    const y0 = 0;
    const xStep = 200;
    // const yStep = 40;
    for (let i0 = 0; i0 < allConstraints.length; i0++) {
    //for (const i0 of [4,4,4,5]){
        // y0 = 0;
        const i1 = (i0 + 1) % allConstraints.length;
        const i2 = (i1 + 1) % allConstraints.length;
        const constraintSet = ConstraintSet.create ();
        const curvesToDisplay:ImplicitCurve2d[] = [];
        for (const c of [allConstraints[i0], allConstraints[i1], allConstraints[i2]]){
            constraintSet.addConstraint (c);
            transferCurve(c, curvesToDisplay);
        }

        const result = constraintSet.constructTangentCircles ();

        outputCircleMarkup(ck, allGeometry, x0, y0,
            result, curvesToDisplay, 0);
        
        x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "ConstraintSetCirclesAndLines");
    expect(ck.getNumErrors()).toBe(0);
});
