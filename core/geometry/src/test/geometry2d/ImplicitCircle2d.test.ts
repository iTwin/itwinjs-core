
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Geometry } from "../../Geometry";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { UnboundedCircle2dByCenterAndRadius } from "../../curve/internalContexts/geometry2d/UnboundedCircle2d";
import { ConstrainedConstruction } from "../../curve/internalContexts/geometry2d/ConstrainedConstruction";
import { Arc3d } from "../../curve/Arc3d";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Range3d } from "../../geometry3d/Range";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { CurvePrimitive, LineString3d } from "../../core-geometry";
import { UnboundedLine2dByPointAndNormal } from "../../curve/internalContexts/geometry2d/UnboundedLine2d.";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "../../curve/internalContexts/geometry2d/implicitCurve2d";
import { PointToCurveTangentHandler } from "../../curve/internalContexts/PointToCurveTangentHandler";

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

  describe("ImplicitCircle2d", () => {

  it("CircleTangentLLL", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const lineXAxis = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 0, 0, 1)!;
    const lineYAxis = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 0, 1, 0)!;
    const a = 1;
    const b = 0.8;
    const lineA0 = -4.0;
    const lineA1 = 4.0;
    const lineDiagonal11 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 1, a, a)!;
    const lineY1 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 1, 0, 1)!;
    const lineQ11 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 1, a, b)!;
    const lineR = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(5, 4, a, -b)!;
    let x0 = 0;
    for (const lines of [
      [lineXAxis,lineYAxis,lineY1],
      [lineXAxis,lineYAxis,lineDiagonal11],
      [lineY1,lineYAxis,lineDiagonal11],
      [lineDiagonal11,lineQ11,lineR],
    ]) {
      for (const l of lines)
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitLine2dToLineSegment3d (l, 0.0, lineA0, lineA1),
          x0, 0);
      const circles = ConstrainedConstruction.circlesTangentLLL(lines[0], lines[1], lines[2]);
      if (ck.testDefined(circles)) {
        // ck.testExactNumber(circles!.length, 4, "Circles in triangle 00,10,01");

        for (const c of circles) {
          GeometryCoreTestIO.captureCloneGeometry (allGeometry,
            implicitCircle2dToArc3d(c.curve), x0, 0);
          const r = c.curve.radius;
          for (const d of c.data){
            ck.testCoordinate (Math.abs(r), c.curve.center.distance(d.point), "distance to tangency matches radius");
            ck.testCoordinate (0, d.curve.functionValue(d.point), "tangency point is on its line");
            GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              LineString3d.create(c.curve.center, d.point), x0, 0);
          }
        }
      x0 += 20;
      }
    }
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "CircleTangentLLL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LineTangentCCC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,0,1);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (4,1,3);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,5,2);
    let x0 = 0;
    const allCirclePairs = [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleD],
      [circleA, circleC],
      [circleB, circleC],
    ];
    const e = Math.sqrt (2);
    for (const x1 of [3,4,8]){
      const circleE0 = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,e);
      const circleE1 = UnboundedCircle2dByCenterAndRadius.createXYRadius (x1,0,e);

      const pointAsCircleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (4,6,0);
      allCirclePairs.push([circleE0, circleE1]);
      allCirclePairs.push([circleB, pointAsCircleA]);
      }

    for (const circles of allCirclePairs) {
      for (const c of circles)
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitCircle2dToArc3d (c),
          x0, 0);

      const lines = ConstrainedConstruction.linesTangentCC(circles[0], circles[1]);
      if (lines !== undefined) {
        for (const l of lines) {
          GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              LineSegment3d.create (Point3d.create(l.data[0].point.x, l.data[0].point.y, 0),
                      Point3d.create (l.data[1].point.x, l.data[1].point.y, 0)), x0, 0);
          }
      }
      x0 += 20;
    }
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "LineTangentCC");
    expect(ck.getNumErrors()).toBe(0);
    }
  );
  it("CircleTangentLLC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (3,3,2);
    const pointY4 = UnboundedCircle2dByCenterAndRadius.createXYRadius (3,4,0);
    const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0, 0,1)!;
    const axisX4 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (2,4, 0,1)!;
    const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (0,1,1,0)!;
    const line3 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0,-1,4)!;
    const line4 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (-3,1,3,3)!;

    const allLinePairs = [
      [axisX, axisY],
      [axisX, axisX4],
      [axisX4, axisX],
      [axisY, line3],
      [line4, axisX]
    ];
  const allCircles = [circleA, circleB, pointY4];

    let x0 = 0;
    let y0 = 0;
    for (const circle of allCircles){
      y0 = 0;
      for (const lines of allLinePairs){
        const circles = ConstrainedConstruction.circlesTangentLLC(lines[0], lines[1], circle);
        outputCircleMarkup (ck, allGeometry, x0, y0, circles, [lines[0], lines[1], circle], 100);
        x0 += 200;
        }
      }
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentLLC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentCCL", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (3,8,2);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (-7,5,0);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (8,3,0);

    const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0, 0,1)!;
    const axisX10 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (2,10, 0,1)!;
    const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (0,1,1,0)!;
    const line3 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0,-1,4)!;
    const line4 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (-3,1,3,3)!;

    const allCirclePairs = [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleB],
      [circleC, circleD]
    ];
    const allLines = [axisX, axisX10, axisY, line3, line4];


    let x0 = 0;
    let y0 = 0;
    for (const inputCircles of allCirclePairs){
      for (const line of allLines){
        y0 = 0;
        const circle0 = inputCircles[0];
        const circle1 = inputCircles[1];
        const circles = ConstrainedConstruction.circlesTangentCCL(circle0, circle1, line);
        y0 = outputCircleMarkup (ck, allGeometry, x0, y0, circles, [circle0, circle1, line], 200);
        x0 += 200;
      }
    }
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentCCL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentCCC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,0,2);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,5,3);

    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (1,5,1);
    const circleE = UnboundedCircle2dByCenterAndRadius.createXYRadius (-4,2,2);
    const circleF = UnboundedCircle2dByCenterAndRadius.createXYRadius (3,-2,3);

    // 3 points  !!!
    const circleG0 = UnboundedCircle2dByCenterAndRadius.createXYRadius (1,5,0);
    const circleG1 = UnboundedCircle2dByCenterAndRadius.createXYRadius (8,5,0);
    const circleG2 = UnboundedCircle2dByCenterAndRadius.createXYRadius (4,-2,0);
    const allCircleTriples = [
      [circleA, circleB, circleC],
      [circleD, circleE, circleF],
      [circleG0, circleG1, circleG2],
      [circleG1, circleA, circleB]
    ];


    let x0 = 0;
    let y0 = 0;
    const yStep = 100;
    for (const inputCircles of allCircleTriples){
      y0 = 0;
      const circle0 = inputCircles[0];
      const circle1 = inputCircles[1];
      const circle2 = inputCircles[2];
      for (const circle of inputCircles){
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitCircle2dToArc3d (circle), x0, y0);
        }
      y0 += yStep;
      const circles = ConstrainedConstruction.circlesTangentCCC(circle0, circle1, circle2);
      outputCircleMarkup (ck, allGeometry, x0, y0, circles, inputCircles, yStep);
/*
      if (circles){
        for(const c of circles){
          GeometryCoreTestIO.captureCloneGeometry (allGeometry,
            implicitCircle2dToArc3d (c.curve), x0, y0);
        }
      }
*/
      x0 += 200;
    }
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentCCC");
    expect(ck.getNumErrors()).toBe(0);
  });
});

it("LineTangentPointCircle", () => {
  const _ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const circleA = Arc3d.createXYZXYZXYZ (0,0,0,  1,0,0,  0,2,0);
  // const arcB = Arc3d.createXYZXYZXYZ (1,2,0, 3,1,0, 0.5,4,0);
  const _arcC = Arc3d.createXYZXYZXYZ (1,2,0, 3,1,2, 0.5,4,2);
  const vectorToEye = Vector3d.create (1,-1,1);
  const isoViewToWorld = Matrix3d.createRigidViewAxesZTowardsEye (vectorToEye.x, vectorToEye.y, vectorToEye.z);
  const worldToIsoView = isoViewToWorld.transpose ();
  const zP = 5.0;
  const pointP1 = Point3d.create (4,0, zP);
  const pointP2 = Point3d.create (6,4, zP);
  const pointP3 = Point3d.create (8,0, zP);
  const pointQ1 = pointP1.clone ();pointQ1.z = 0;
  const pointQ2 = pointP2.clone ();pointQ2.z = 0;
  const pointQ3 = pointP3.clone ();pointQ3.z = 0;
  let x0 = 0;
  let y0 = 0;
  const a = 4.0;

  const handler = (spacePoint: Point3d, g: CurvePrimitive, f: number)=>{
    GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 4, spacePoint, 0.25, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, [spacePoint, g.fractionToPoint (f)], x0, y0);
  };

  const collector1 = new PointToCurveTangentHandler (Point3d.create(), handler, true, worldToIsoView);
  const collector0 = new PointToCurveTangentHandler (Point3d.create (), handler, true, undefined);
  for (const collector of [collector1, collector0]){
    for (const g of [circleA]){
      y0 = 0;
      GeometryCoreTestIO.captureCloneGeometry (allGeometry, g, x0, y0);
      GeometryCoreTestIO.captureRangeEdges (allGeometry,
        Range3d.createXYZXYZ (-a,-a,-a,a,a,a), x0, y0);
        GeometryCoreTestIO.captureCloneGeometry (allGeometry, [
        g.center.plus (g.matrixRef.multiplyXYZ(0,0,4)),
        g.center, g.fractionToPoint (0), g.fractionToPoint(0.25), g.center], x0, y0);
      for (const point of [pointP1, pointQ1, pointP2, pointQ2, pointP3, pointQ3]){
        collector0.spacePoint = point.clone ();
        collector1.spacePoint = point.clone();
        GeometryCoreTestIO.captureCloneGeometry (allGeometry, [point, point.plus(vectorToEye)], x0, y0);
        g.dispatchToGeometryHandler (collector);
      }
    x0 += 20;
    }
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "LineTangentPointCircle");
});

it("LineTangentPointArc", () => {
  const _ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const sweep1 = AngleSweep.createStartEndDegrees (-40,90);
  const sweep2 = AngleSweep.createStartEndDegrees (125, 210);
  const sweep3 = AngleSweep.createStartEndDegrees (215, 400);
  const sweep4 = AngleSweep.createStartEndDegrees (185,20);

  const arc0 = Arc3d.createXYZXYZXYZ (1,2,0, 3,1,0, 0.5,4,0);
  const arcs = [];
  for (const sweep of  [sweep1, sweep2, sweep3, sweep4]){
    const arc = arc0.clone();
    arc.sweep = sweep;
    arcs.push (arc);
  }
  let x0 = 0;

  const handler = (spacePoint: Point3d, g: CurvePrimitive, f: number)=>{
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, [spacePoint, g.fractionToPoint (f)], x0, y0);
  };


  const y0 = 0;
  const arc1 = Arc3d.createXYZXYZXYZ (0,0,0, 15,0,0, 0,8,0);
  const collector = new PointToCurveTangentHandler (Point3d.create (0,0,0), handler, false, undefined);
  for (const g of arcs){
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, g,x0, y0);
      for (let fraction = 0; fraction < 1; fraction += 0.067){
        collector.spacePoint = arc1.fractionToPoint (fraction);
        GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 4, collector.spacePoint, 0.05, x0, y0);
        g.dispatchToGeometryHandler (collector);
      }
    x0 += 40;
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "LineTangentPointArc");
});

it("CircleTangentCCCColinear", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (-1,2,1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,2,2);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (9,2,1);

  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (1,5,1);
  const circleE = UnboundedCircle2dByCenterAndRadius.createXYRadius (-1,1,2);
  const circleF = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,13,1.5);

  const circleG = UnboundedCircle2dByCenterAndRadius.createXYRadius (1,5,1);
  const circleH = UnboundedCircle2dByCenterAndRadius.createXYRadius (-1,1,2);
  const circleI = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,13,5.5);

  // two points and a circle between ..
  const circleK = UnboundedCircle2dByCenterAndRadius.createXYRadius (1,5,0);
  const circleL = UnboundedCircle2dByCenterAndRadius.createXYRadius (-1,1,2);
  const circleM = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,13,0);

  const allCircleTriples = [
    [circleA, circleB, circleC],
    [circleD, circleE, circleF],
    [circleG, circleH, circleI],
    [circleK, circleL, circleM],
    [circleM, circleK, circleL],
    [circleL, circleM, circleK]
  ];


  let x0 = 0;
  let y0 = 0;
  for (const inputCircles of allCircleTriples){
    y0 = 0;
    const circle0 = inputCircles[0];
    const circle1 = inputCircles[1];
    const circle2 = inputCircles[2];
    const circles = ConstrainedConstruction.circlesTangentCCC(circle0, circle1, circle2);
    outputCircleMarkup (ck, allGeometry, x0, y0, circles, inputCircles, 100);
/*
    if (circles){
      for(const c of circles){
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitCircle2dToArc3d (c.curve), x0, y0);
      }
    }
*/
    x0 += 200;
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentCCCColinear");
  expect(ck.getNumErrors()).toBe(0);
});

it("CircleCircleIntersection", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,0,2);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (4,5,4);
  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (5,7,3);
  const circleZ = UnboundedCircle2dByCenterAndRadius.createXYRadius (14,5,4);

  const pointsAB = circleA.intersectCircle (circleB);
  ck.testExactNumber (pointsAB.length, 2);

  const pointsCZ = circleC.intersectCircle (circleZ);
  ck.testExactNumber (pointsCZ.length, 0);

  const x0 = 0;
  const y0 = 0;
  for (const circles of [
    [circleA, circleB], [circleB, circleC],
    [circleC, circleD]]){
    const points = circles[0].intersectCircle (circles[1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, implicitCircle2dToArc3d (circles[0]), x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, implicitCircle2dToArc3d (circles[1]), x0, y0);
    if (points.length === 2)
      GeometryCoreTestIO.captureCloneGeometry (allGeometry,
        [Point3d.createFrom (points[0]), Point3d.createFrom (points[1])],
        x0, y0);
    else
    for (const p of points)
      GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 4, p, 0.08, x0, y0);
    }

  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "CircleCircleIntersection");
  expect(ck.getNumErrors()).toBe(0);
});


it("LineLIneIntersection", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const lineX = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (0,0, 1,0);
  const lineY = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (0,0, 0,1);
  const lineQ = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (1,1, 1,-2);
  const lineR = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (-1,1, 2,2);
  lineQ.normal.normalize (lineQ.normal);
  lineR.normal.normalize (lineR.normal);


  let x0 = 0;
  const y0 = 0;

  for (const line of [lineX, lineY, lineQ, lineR]){
    GeometryCoreTestIO.captureCloneGeometry(allGeometry,
      implicitLine2dToLineSegment3d (line, 0, -5, 5), x0, y0);
  }

  for (const linePair of [[lineX, lineY], [lineY, lineQ], [lineQ, lineX], [lineQ,lineR], [lineR,lineX]]){
    const point = linePair[0].interesectUnboundedLine2dByPointAndNormalWithOffsets (linePair[1]);
    if (ck.testType (point, Point2d, "expect intersectioni")){
      GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 3, point, 0.08, x0, y0);
      }
  }
  x0 += 10;
  for (const line of [lineQ, lineR]){
    GeometryCoreTestIO.captureCloneGeometry(allGeometry,
      implicitLine2dToLineSegment3d (line, 0, -5, 5), x0, y0);
  }

  for (const offsetA of [1,2,3,0,-1,-2,-3]){
    for (const offsetB of [1,2,3,0,-1,-2,-3]){
      const p = lineQ.interesectUnboundedLine2dByPointAndNormalWithOffsets (lineR, offsetA, offsetB);
      if (ck.testType (p, Point2d, "expect intersectioni")){
        GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 3, p, 0.04, x0, y0);
        ck.testCoordinate (offsetA, lineQ.functionValue (p), "on offset lineQ", p);
        ck.testCoordinate (offsetB, lineR.functionValue (p), "on offset lineR", p);
      }
    }
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "LineLineIntersection");
  expect(ck.getNumErrors()).toBe(0);
});

it("LineCircleIntersection", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const lineX = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (0,0, 1,0);
  const lineY = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (0,0, 0,1);
  const lineQ = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (1,1, 1,-2);
  const lineR = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY (-1,1, 2,2);
  const circleU = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0, 1.0);
  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,3, 2.5);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,3,3);


  let x0 = 0;
  const y0 = 0;

  for (const line of [lineX, lineY, lineQ, lineR]){
    for (const circle of [circleU, circleA, circleB]){
      GeometryCoreTestIO.captureCloneGeometry(allGeometry,
        implicitLine2dToLineSegment3d (line, 0, -4, 4), x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry,
          implicitCircle2dToArc3d (circle), x0, y0);
        const points = circle.intersectLine (line);
        for (const p of points){
          ck.testCoordinate (0, circle.functionValue (p), "on circle", p);
          ck.testCoordinate (0, line.functionValue (p), "on line", p);
        }
        GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 3, points, 0.08, x0, y0);

      x0 += 10;
    }
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "LineCircleIntersection");
  expect(ck.getNumErrors()).toBe(0);
});

it("CircleTangentLLR", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0, 0,1)!;
  const axisX10 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (2,10, 0,1)!;
  const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (0,1,1,0)!;
  const line3 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0,-1,4)!;
  const line4 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (-3,1,3,3)!;

  const allLines = [axisX, axisY, axisX10, line3, line4];

  let x0 = 0;
  let y0 = 0;
  const xStep = 100;
  const yStep = 100;
  for (let i = 0; i < allLines.length; i++){
    y0 = 0;
    for (let j = i+1; j < allLines.length; j++){
      for (const radius of [1,5]){
        const circles = ConstrainedConstruction.circlesTangentLLR (allLines[i], allLines[j], radius);
        outputCircleMarkup (ck, allGeometry, x0, y0, circles, [allLines[i], allLines[j]], 0);
      }
      y0 += yStep;
    }
    x0 += xStep;
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentLLR");
  expect(ck.getNumErrors()).toBe(0);
});

it("CircleTangentCLR", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];
  const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0, 0,1)!;
  const axisX10 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (2,10, 0,1)!;
  const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (0,1,1,0)!;
  const line3 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (1,0,-1,4)!;
  const line4 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY (-3,1,3,3)!;

  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,3,1);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,-1,0.2);
  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,-1,4);

  const allLines = [axisX, axisY, axisX10, line3, line4];
  const allCircles = [circleA, circleB, circleC, circleD];

  let x0 = 0;
  let y0 = 0;
  const xStep = 100;
  const yStep = 100;
  for (const circle of allCircles){
    y0 = 0;
    for (const line of allLines){
      for (const radius of [1]){
        const circles = ConstrainedConstruction.circlesTangentCLR (circle, line, radius);
        outputCircleMarkup (ck, allGeometry, x0, y0, circles, [circle, line], 0);
      }
      y0 += yStep;
    }
    x0 += xStep;
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentCLR");
  expect(ck.getNumErrors()).toBe(0);
});

it("CircleTangentCCR", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];

  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,3,1);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,-1,0.2);
  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius (2,-1,4);

  const allCircles = [circleA, circleB, circleC, circleD];

  let x0 = 0;
  let y0 = 0;
  const xStep = 40;
  const yStep = 40;
  for (let i = 0; i < allCircles.length; i++){
    y0 = 0;
    for (let j = i+1; j < allCircles.length; j++){
      for (const radius of [1,6]){
        const circles = ConstrainedConstruction.circlesTangentCCR (allCircles[i], allCircles[j], radius);
        outputCircleMarkup (ck, allGeometry, x0, y0, circles, [allCircles[i], allCircles[j]], 0);
        y0 += yStep;
      }
    }
    x0 += xStep;
  }
  GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentCCR");
  expect(ck.getNumErrors()).toBe(0);
});
