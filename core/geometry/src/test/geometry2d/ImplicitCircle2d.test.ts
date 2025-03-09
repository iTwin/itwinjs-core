/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { ImplicitLine2d } from "../../geometry2d/implicitLine2d";
import { ConstrainedConstruction, UnboundedCircle2dByCenterAndRadius } from "../../geometry2d/implicitCircle2d";
import { Arc3d } from "../../curve/Arc3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../core-geometry";

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
function implicitLine2dToLineSegment3d (line: ImplicitLine2d, z: number = 0.0,
  a0: number,
  a1: number
):LineSegment3d | undefined{
  const direction = Vector3d.create (line.normal.y, -line.normal.x, 0);
  const origin = Point3d.create (line.point.x, line.point.y, z);
    return LineSegment3d.create (
    origin. plusScaled (direction, a0),
    origin.plusScaled (direction, a1));
  }
  describe("ImplicitCircle2d", () => {

  it("CircleTangentLLL", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const lineXAxis = ImplicitLine2d.createPointXYNormalXY(0, 0, 0, 1);
    const lineYAxis = ImplicitLine2d.createPointXYNormalXY(0, 0, 1, 0);
    const a = 1;
    const b = 0.8;
    const lineA0 = -4.0;
    const lineA1 = 4.0;
    const lineDiagonal11 = ImplicitLine2d.createPointXYNormalXY(1, 1, a, a);
    const lineY1 = ImplicitLine2d.createPointXYNormalXY(0, 1, 0, 1);
    const lineQ11 = ImplicitLine2d.createPointXYNormalXY(1, 1, a, b);
    const lineR = ImplicitLine2d.createPointXYNormalXY(5, 4, a, -b);
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
      console.log ("==================================");
      const circles = ConstrainedConstruction.circlesTangentLLL(lines[0], lines[1], lines[2]);
      if (ck.testDefined(circles)) {
        // ck.testExactNumber(circles!.length, 4, "Circles in triangle 00,10,01");
        console.log(circles.length);


        for (const c of circles) {
          GeometryCoreTestIO.captureCloneGeometry (allGeometry,
            implicitCircle2dToArc3d(c.curve), x0, 0);
          const r = c.curve.radius;
          console.log(c.curve);
          for (const d of c.data){
            ck.testCoordinate (Math.abs(r), c.curve.center.distance(d.point), "distance to tangency matches radius");
            ck.testCoordinate (0, d.curve.functionValue(d.point), "tangency point is on its line");
            console.log(d);
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
    };

    for (const circles of allCirclePairs) {
      for (const c of circles)
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitCircle2dToArc3d (c),
          x0, 0);
      console.log ("==================================");
      const lines = ConstrainedConstruction.linesTangentCC(circles[0], circles[1]);
      if (lines !== undefined) {
        console.log(lines.length);
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
  });
  it("CircleTangentLLC", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius (0,0,2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius (3,3,2);
    const pointY4 = UnboundedCircle2dByCenterAndRadius.createXYRadius (3,4,0);
    const axisX = ImplicitLine2d.createPointXYNormalXY (1,0, 0,1);
    const axisX4 = ImplicitLine2d.createPointXYNormalXY (2,4, 0,1);
    const axisY = ImplicitLine2d.createPointXYNormalXY (0,1,1,0);
    const line3 = ImplicitLine2d.createPointXYNormalXY (1,0,-1,4);
    const line4 = ImplicitLine2d.createPointXYNormalXY (-3,1,3,3);

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
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitCircle2dToArc3d (circle), x0, y0);
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitLine2dToLineSegment3d (lines[0], 0, -2, 6), x0, y0);
        GeometryCoreTestIO.captureCloneGeometry (allGeometry,
          implicitLine2dToLineSegment3d (lines[1], 0, -2, 6), x0, y0);
        const circles = ConstrainedConstruction.circlesTangentLLC(lines[0], lines[1], circle);
        if (circles){
          for(const c of circles){
            GeometryCoreTestIO.captureCloneGeometry (allGeometry,
              implicitCircle2dToArc3d (c.curve), x0, y0);
          }
        }
        y0 += 200;
      }
      x0 += 200;
    }
    GeometryCoreTestIO.saveGeometry (allGeometry, "geometry2d", "circleTangentLLC");
    expect(ck.getNumErrors()).toBe(0);
  });

});

