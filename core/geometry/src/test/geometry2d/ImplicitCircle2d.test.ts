

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CurveFactory, CurvePrimitive } from "../../core-geometry";
import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "../../curve/internalContexts/geometry2d/implicitCurve2d";
import { TangentConstruction } from "../../curve/internalContexts/geometry2d/TangentConstruction";
import { UnboundedCircle2dByCenterAndRadius } from "../../curve/internalContexts/geometry2d/UnboundedCircle2d";
import { UnboundedLine2dByPointAndNormal } from "../../curve/internalContexts/geometry2d/UnboundedLine2d";
import { PointToCurveTangentHandler } from "../../curve/internalContexts/PointToCurveTangentHandler";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("ImplicitCircle2d", () => {
  it("CircleTangentLLL", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const lineXAxis = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 0, 0, 1)!;
    const lineYAxis = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 0, 1, 0)!;
    const a = 1;
    const b = 0.8;
    const lineDiagonal11 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 1, a, a)!;
    const lineY1 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 1, 0, 1)!;
    const lineQ11 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 1, a, b)!;
    const lineR = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(5, 4, a, -b)!;
    let x0 = 0;
    for (const lines of [
      [lineXAxis, lineYAxis, lineY1],
      [lineXAxis, lineYAxis, lineDiagonal11],
      [lineY1, lineYAxis, lineDiagonal11],
      [lineDiagonal11, lineQ11, lineR],
    ]) {
      for (const l of lines)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(l), x0);
      const circles = TangentConstruction.circlesTangentLLL(lines[0], lines[1], lines[2]);
      if (ck.testDefined(circles)) {
        for (const c of circles) {
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(c.curve), x0,
          );
          const r = c.curve.radius;
          for (const d of c.data) {
            ck.testCoordinate(Math.abs(r), c.curve.center.distance(d.point), "distance to tangency matches radius");
            ck.testCoordinate(0, d.curve.functionValue(d.point), "tangency point is on its line");
            // GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(c.curve.center, d.point), x0);
          }
        }
        x0 += 20;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "CircleTangentLLL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LineTangentCC", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 0, 1);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(4, 1, 3);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 5, 2);
    let x0 = 0;
    const allCirclePairs = [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleD],
      [circleA, circleC],
      [circleB, circleC],
    ];
    const e = Math.sqrt(2);
    for (const x1 of [3, 4, 8]) {
      const circleE0 = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, e);
      const circleE1 = UnboundedCircle2dByCenterAndRadius.createXYRadius(x1, 0, e);
      const pointAsCircle = UnboundedCircle2dByCenterAndRadius.createXYRadius(4, 6, 0);
      allCirclePairs.push([circleE0, circleE1]);
      allCirclePairs.push([circleB, pointAsCircle]);
    }
    for (const circles of allCirclePairs) {
      for (const c of circles)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(c), x0);
      const lines = TangentConstruction.linesTangentCC(circles[0], circles[1]);
      if (lines !== undefined) {
        for (const l of lines) {
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry,
            LineSegment3d.create(
              Point3d.create(l.data[0].point.x, l.data[0].point.y, 0),
              Point3d.create(l.data[1].point.x, l.data[1].point.y, 0),
            ),
            x0
          );
        }
      }
      x0 += 20;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "LineTangentCC");
    expect(ck.getNumErrors()).toBe(0);
  }
  );
  it("LinePerpLinePerpTanC", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const lineM = UnboundedLine2dByPointAndNormal.createPointXYPointXY(3, 1, 1, 5);
    const lineN = UnboundedLine2dByPointAndNormal.createPointXYPointXY(3, 1, 5, 6);
    const lineP = UnboundedLine2dByPointAndNormal.createPointXYPointXY(-2, 1, 3, -2);
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 5, 2);
    let x0 = 0;
    for (const circle of [circleA, circleB]) {
      for (const line of [lineM, lineN, lineP]) {
        let y0 = 0;
        const allLines = [
          TangentConstruction.linesPerpLTangentC(line, circle),
          TangentConstruction.linesPerpLPerpC(line, circle),
        ];
        const targetDistances = [circle.radius, 0];
        for (const i of [0, 1]) {
          const lines = allLines[i];
          const targetDistance = targetDistances[i];
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(line, 5), x0, y0,
          );
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(circle), x0, y0,
          );
          if (lines !== undefined) {
            for (const l of lines) {
              GeometryCoreTestIO.captureCloneGeometry(
                allGeometry,
                LineSegment3d.create(
                  Point3d.create(l.data[0].point.x, l.data[0].point.y, 0),
                  Point3d.create(l.data[1].point.x, l.data[1].point.y, 0),
                ),
                x0, y0,
              );
              GeometryCoreTestIO.captureCloneGeometry(
                allGeometry,
                CurveFactory.createCurvePrimitiveFromImplicitCurve(l.curve, 3),
                x0, y0,
              );
              const centerProjectedToLine = l.curve.closestPoint(circle.center)!;
              const distance = circle.center.distance(centerProjectedToLine);
              ck.testCoordinate(distance, targetDistance, { line: l.curve, center: circle.center, centerProjectedToLine });
            }
          }
          y0 += 40;
        }
        x0 += 40;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "LinePerpLinePerpTanC");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("CircleTangentCCLSimpleExample", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const x0 = 0;
    const y0 = 0;

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 5, 2);
    const line = UnboundedLine2dByPointAndNormal.createPointXYPointXY(-1, 0, 5, 3);
    const circles = TangentConstruction.circlesTangentCCL(circleA, circleB, line);
    ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, [circleA, circleB, line], 0, 4);

    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 5, 6);
    const circlesAC = TangentConstruction.circlesTangentCCL(circleA, circleC, line);
    ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0 + 100, y0, circlesAC, [circleA, circleC, line], 0, 4);


    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "CircleTangentCCLSimpleExample");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentLLC", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 3, 2);
    const point = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 4, 0);
    const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, 0, 1)!;
    const axisX4 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(2, 4, 0, 1)!;
    const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 1, 1, 0)!;
    const line1 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, -1, 4)!;
    const line2 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(-3, 1, 3, 3)!;
    const allCircles = [point, circleA, circleB];
    const allLinePairs = [
      [axisX, axisY],
      [axisX, axisX4],
      [axisY, line1],
      [line2, axisX],
      [line1, line2],
    ];
    let x0 = 0;
    let y0 = 0;
    for (const circle of allCircles) {
      y0 = 0;
      for (const lines of allLinePairs) {
        const circles = TangentConstruction.circlesTangentLLC(lines[0], lines[1], circle);
        ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, [lines[0], lines[1], circle], 100);
        x0 += 300;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentLLC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentCCL", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 2);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, 8, 2);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(-7, 5, 0);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(8, 3, 0);
    const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, 0, 1)!;
    const axisX10 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(2, 10, 0, 1)!;
    const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 1, 1, 0)!;
    const line1 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, -1, 4)!;
    const line2 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(-3, 1, 3, 3)!;
    const allCirclePairs = [
      [circleA, circleB],
      [circleA, circleC],
      [circleC, circleB],
      [circleC, circleD],
    ];
    const allLines = [axisX, axisX10, axisY, line1, line2];
    let x0 = 0;
    let y0 = 0;
    for (const inputCircles of allCirclePairs) {
      for (const line of allLines) {
        y0 = 0;
        const circle0 = inputCircles[0];
        const circle1 = inputCircles[1];
        const circles = TangentConstruction.circlesTangentCCL(circle0, circle1, line);
        y0 = ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, [circle0, circle1, line], 200);
        x0 += 250;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentCCL");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentCCC", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    // A,B,C
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 0, 2);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 5, 3);
    // D,E,F
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 5, 1);
    const circleE = UnboundedCircle2dByCenterAndRadius.createXYRadius(-4, 2, 2);
    const circleF = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, -2, 3);
    // 3 points
    const circleG0 = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 5, 0);
    const circleG1 = UnboundedCircle2dByCenterAndRadius.createXYRadius(8, 5, 0);
    const circleG2 = UnboundedCircle2dByCenterAndRadius.createXYRadius(4, -2, 0);
    const allCircleTriples = [
      [circleA, circleB, circleC],
      [circleD, circleE, circleF],
      [circleG0, circleG1, circleG2],
      [circleG1, circleA, circleB]
    ];
    let x0 = 0;
    let y0 = 0;
    const yStep = 100;
    for (const inputCircles of allCircleTriples) {
      y0 = 0;
      const circle0 = inputCircles[0];
      const circle1 = inputCircles[1];
      const circle2 = inputCircles[2];
      const circles = TangentConstruction.circlesTangentCCC(circle0, circle1, circle2);
      ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, inputCircles, yStep);
      y0 += yStep;
      x0 += 200;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentCCC");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LineTangentPointCircle", () => {
    const _ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = Arc3d.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 2, 0);
    const circleB = Arc3d.createXYZXYZXYZ(1, 2, 0, 3, 1, 0, 0.5, 4, 0);
    const circleC = Arc3d.createXYZXYZXYZ(1, 2, 0, 3, 1, 2, 0.5, 4, 2);
    const vectorToEye = Vector3d.create(1, -1, 1); // right-isometric view
    const isoViewToWorld = Matrix3d.createRigidViewAxesZTowardsEye(vectorToEye.x, vectorToEye.y, vectorToEye.z);
    const worldToIsoView = isoViewToWorld.transpose();
    const zP = 5.0;
    const pointP1 = Point3d.create(4, 0, zP);
    const pointP2 = Point3d.create(6, 4, zP);
    const pointP3 = Point3d.create(8, 0, zP);
    const pointQ1 = pointP1.clone();
    pointQ1.z = 0;
    const pointQ2 = pointP2.clone();
    pointQ2.z = 0;
    const pointQ3 = pointP3.clone();
    pointQ3.z = 0;
    let x0 = 0;
    let y0 = 0;
    const a = 4.0;
    const handler = (spacePoint: Point3d, g: CurvePrimitive, f: number) => {
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 4, spacePoint, 0.25, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, g.fractionToPoint(f)], x0, y0);
    };
    const collector0 = new PointToCurveTangentHandler(Point3d.create(), handler, true, undefined);
    const collector1 = new PointToCurveTangentHandler(Point3d.create(), handler, true, worldToIsoView);
    for (const collector of [collector0, collector1]) {
      y0 = 0;
      for (const g of [circleA, circleB, circleC]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, g, x0, y0);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, Range3d.createXYZXYZ(-a, -a, -a, a, a, a), x0, y0);
        for (const point of [pointP1, pointQ1, pointP2, pointQ2, pointP3, pointQ3]) {
          collector0.spacePoint = point.clone();
          collector1.spacePoint = point.clone();
          // GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point, point.plus(vectorToEye)], x0, y0);
          g.dispatchToGeometryHandler(collector);
        }
        y0 += 20;
      }
      x0 += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "LineTangentPointCircle");
  });

  it("LineTangentPointArc", () => {
    const _ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const sweep0 = AngleSweep.createStartEndDegrees();
    const sweep1 = AngleSweep.createStartEndDegrees(215, 400);
    const sweep2 = AngleSweep.createStartEndDegrees(185, 20);
    const sweep3 = AngleSweep.createStartEndDegrees(125, 210);
    const sweep4 = AngleSweep.createStartEndDegrees(-40, 90);
    const arc0 = Arc3d.createXYZXYZXYZ(1, 2, 0, 3, 1, 0, 0.5, 4, 0);
    const arcs = [];
    for (const sweep of [sweep0, sweep1, sweep2, sweep3, sweep4]) {
      const arc = arc0.clone();
      arc.sweep = sweep;
      arcs.push(arc);
    }
    let x0 = 0;
    const handler = (spacePoint: Point3d, g: CurvePrimitive, f: number) => {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, g.fractionToPoint(f)], x0, y0);
    };
    const y0 = 0;
    const arc1 = Arc3d.createXYZXYZXYZ(0, 0, 0, 15, 0, 0, 0, 8, 0);
    const collector = new PointToCurveTangentHandler(Point3d.create(0, 0, 0), handler, false, undefined);
    for (const g of arcs) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, g, x0, y0);
      for (let fraction = 0; fraction < 1; fraction += 0.067) {
        collector.spacePoint = arc1.fractionToPoint(fraction);
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 4, collector.spacePoint, 0.05, x0, y0);
        g.dispatchToGeometryHandler(collector);
      }
      x0 += 40;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "LineTangentPointArc");
  });

  it("CircleTangentCCCColinear", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    // A,B,C
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(-1, 2, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 2, 2);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(9, 2, 1);
    // D,E,F
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 5, 1);
    const circleE = UnboundedCircle2dByCenterAndRadius.createXYRadius(-1, 1, 2);
    const circleF = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 13, 1.5);
    // G,H,I
    const circleG = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 5, 1);
    const circleH = UnboundedCircle2dByCenterAndRadius.createXYRadius(-1, 1, 2);
    const circleI = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 13, 5.5);
    // two points and a circle between
    const circleK = UnboundedCircle2dByCenterAndRadius.createXYRadius(1, 5, 0);
    const circleL = UnboundedCircle2dByCenterAndRadius.createXYRadius(-1, 1, 2);
    const circleM = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 13, 0);
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
    for (const inputCircles of allCircleTriples) {
      y0 = 0;
      const circle0 = inputCircles[0];
      const circle1 = inputCircles[1];
      const circle2 = inputCircles[2];
      const circles = TangentConstruction.circlesTangentCCC(circle0, circle1, circle2);
      ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, inputCircles, 100);
      x0 += 200;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentCCCColinear");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleCircleIntersection", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, 0, 2);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(4, 5, 4);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(5, 7, 3);
    const circleE = UnboundedCircle2dByCenterAndRadius.createXYRadius(14, 5, 4);
    for (const circles of [[circleA, circleB], [circleB, circleC], [circleC, circleD]]) {
      const points = circles[0].intersectCircle(circles[1]);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(circles[0]));
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(circles[1]));
      for (const p of points)
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, p, 0.1);
      ck.testExactNumber(points.length, 2);
    }
    const pointsAE = circleA.intersectCircle(circleE);
    ck.testExactNumber(pointsAE.length, 0);
    const pointsBE = circleB.intersectCircle(circleE);
    ck.testExactNumber(pointsBE.length, 0);
    const pointsCE = circleC.intersectCircle(circleE);
    ck.testExactNumber(pointsCE.length, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "CircleCircleIntersection");
    expect(ck.getNumErrors()).toBe(0);
  });


  it("LineLineIntersection", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const lineX = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(0, 0, 1, 0);
    const lineY = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(0, 0, 0, 1);
    const lineQ = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(1, 1, 1, -2);
    const lineR = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(-1, 1, 2, 2);
    lineQ.normal.normalize(lineQ.normal);
    lineR.normal.normalize(lineR.normal);
    let x0 = 0;
    const sizeHint = 10;
    for (const linePair of [[lineX, lineY], [lineY, lineQ], [lineQ, lineX], [lineQ, lineR], [lineR, lineX]]) {
      GeometryCoreTestIO.captureCloneGeometry(
        allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(linePair[0], sizeHint), x0,
      );
      GeometryCoreTestIO.captureCloneGeometry(
        allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(linePair[1], sizeHint), x0,
      );
      const point = linePair[0].intersectUnboundedLine2dByPointAndNormalWithOffsets(linePair[1]);
      if (ck.testType(point, Point2d, "expect intersection")) {
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, point, 0.1, x0);
        ck.testCoordinate(0, linePair[0].functionValue(point), "on linePair[0]", point);
        ck.testCoordinate(0, linePair[1].functionValue(point), "on linePair[1]", point);
      }
      x0 += 20;
    }
    x0 = 0;
    const y0 = 20;
    GeometryCoreTestIO.captureCloneGeometry(
      allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(lineQ, sizeHint), x0, y0,
    );
    GeometryCoreTestIO.captureCloneGeometry(
      allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(lineR, sizeHint), x0, y0,
    );
    for (const offsetA of [1, 2, 3, 0, -1, -2, -3]) {
      for (const offsetB of [1, 2, 3, 0, -1, -2, -3]) {
        const p = lineQ.intersectUnboundedLine2dByPointAndNormalWithOffsets(lineR, offsetA, offsetB);
        if (ck.testType(p, Point2d, "expect intersection")) {
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, p, 0.1, x0, y0);
          // functionValue returns dot product of 2 vectors: the line normal and the vector from the line's point
          // to the intersection. These 2 vectors are parallel so dot product would be the product of their lengths.
          // length of line normal is 1 and length of second vector is equal to the offset.
          ck.testCoordinate(offsetA, lineQ.functionValue(p), "on offset lineQ", p);
          ck.testCoordinate(offsetB, lineR.functionValue(p), "on offset lineR", p);
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "LineLineIntersection");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LineCircleIntersection", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const lineX = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(0, 0, 1, 0);
    const lineY = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(0, 0, 0, 1);
    const lineQ = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(1, 1, 1, -2);
    const lineR = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(-1, 1, 2, 2);
    const circleU = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 1.0);
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, 3, 2.5);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, 3, 3);
    let x0 = 0;
    const sizeHint = 10;
    for (const line of [lineX, lineY, lineQ, lineR]) {
      for (const circle of [circleU, circleA, circleB]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(line, sizeHint), x0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(circle, sizeHint), x0);
        const points = circle.intersectLine(line);
        for (const p of points) {
          ck.testCoordinate(0, circle.functionValue(p), "on circle", p);
          ck.testCoordinate(0, line.functionValue(p), "on line", p);
        }
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, points, 0.1, x0);
        x0 += 22;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "LineCircleIntersection");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentLLR", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, 0, 1)!;
    const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 1, 1, 0)!;
    const axisX10 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(2, 10, 0, 1)!;
    const line1 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, -1, 4)!;
    const line2 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(-3, 1, 3, 3)!;
    const allLines = [axisX, axisY, axisX10, line1, line2];
    let x0 = 0;
    let y0 = 0;
    const xStep = 250;
    const yStep = 250;
    for (let i = 0; i < allLines.length; i++) {
      y0 = 0;
      for (let j = i + 1; j < allLines.length; j++) {
        for (const radius of [1, 5]) {
          const circles = TangentConstruction.circlesTangentLLR(allLines[i], allLines[j], radius);
          ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, [allLines[i], allLines[j]], 0);
          if (circles !== undefined)
            ck.testCoordinate(4, circles.length, "Expect 4 circles");
        }
        y0 += yStep;
      }
      x0 += xStep;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentLLR");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentCLR", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const axisX = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, 0, 1)!;
    const axisY = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(0, 1, 1, 0)!;
    const axisX10 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(2, 10, 0, 1)!;
    const line1 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(1, 0, -1, 4)!;
    const line2 = UnboundedLine2dByPointAndNormal.createPointXYNormalXY(-3, 1, 3, 3)!;
    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, 3, 1);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, -1, 0.2);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, -1, 4);
    const allLines = [axisX, axisY, axisX10, line1, line2];
    const allCircles = [circleA, circleB, circleC, circleD];
    let x0 = 0;
    let y0 = 0;
    const xStep = 250;
    const yStep = 250;
    for (const circle of allCircles) {
      y0 = 0;
      for (const line of allLines) {
        for (const radius of [1, 2]) {
          const circles = TangentConstruction.circlesTangentCLR(circle, line, radius);
          ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, [circle, line], 0);
        }
        y0 += yStep;
      }
      x0 += xStep;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentCLR");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleTangentCCR", () => {
    const ck = new Checker(false, false);
    const allGeometry: GeometryQuery[] = [];

    const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 1);
    const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, 3, 1);
    const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, -1, 0.2);
    const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, -1, 4);
    const allCircles = [circleA, circleB, circleC, circleD];
    let x0 = 0;
    let y0 = 0;
    const xStep = 40;
    const yStep = 40;
    for (let i = 0; i < allCircles.length; i++) {
      y0 = 0;
      for (let j = i + 1; j < allCircles.length; j++) {
        for (const radius of [1, 6]) {
          const circles = TangentConstruction.circlesTangentCCR(allCircles[i], allCircles[j], radius);
          ImplicitGeometryHelpers.outputCircleMarkup(ck, allGeometry, x0, y0, circles, [allCircles[i], allCircles[j]], 0);
          y0 += yStep;
        }
      }
      x0 += xStep;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "circleTangentCCR");
    expect(ck.getNumErrors()).toBe(0);
  });
});

export class ImplicitGeometryHelpers {
  public static testParallelGradients(ck: Checker, vectorA: Vector2d, vectorB: Vector2d) {
    if (Geometry.isSmallMetricDistance(vectorA.magnitude()) || Geometry.isSmallMetricDistance(vectorB.magnitude()))
      return;
    ck.testParallelOrAntiParallel2d(vectorA, vectorB, "expect parallel gradients");
  }
  /**
   * Draw visuals of input geometry and circle markup.
   * * If input is a point (circle with radius 0), draw a small triangle.
   * @param ck checker4
   * @param allGeometry output capture array
   * @param x0 output x shift
   * @param y0 output y shift
   * @param markup circles to output with lines to tangency
   * @param inputGeometry additional input geometry to output with each markup batch
   * @param yStep step to apply to y0 for each output circle and markup batch
   * @returns updated y0
   */
  public static outputCircleMarkup(
    ck: Checker,
    allGeometry: GeometryQuery[],
    x0: number,
    y0: number,
    markup: ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined,
    inputGeometry: ImplicitCurve2d[] | undefined = undefined,
    yStep: number = 0,
    sizeHint: number = 10
  ): number {
    if (markup === undefined || markup.length === 0) {
      if (inputGeometry) {
        for (const g1 of inputGeometry) {
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(g1), x0, y0,
          );
        }
      }
      return y0;
    }
    for (const m of markup) {
      if (m.curve instanceof UnboundedCircle2dByCenterAndRadius)
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(m.curve), x0, y0,
        );
      for (const g of m.data) {
        if (inputGeometry) {
          for (const g1 of inputGeometry) {
            if (g1 instanceof UnboundedCircle2dByCenterAndRadius && g1.radius === 0)
              GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, g1.center, 0.1, x0, y0);
            else
              GeometryCoreTestIO.captureCloneGeometry(
                allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(g1), x0, y0, sizeHint
              );
          }
        }
        // GeometryCoreTestIO.captureCloneGeometry(
        //   allGeometry,
        //   LineSegment3d.create(Point3d.create(m.curve.center.x, m.curve.center.y), Point3d.create(g.point.x, g.point.y)),
        //   x0, y0,
        // );
        const fM = m.curve.functionValue(g.point);
        const fG = g.curve.functionValue(g.point);
        const gradM = m.curve.gradient(g.point);
        const gradG = g.curve.gradient(g.point);
        ck.testCoordinate(fM, 0.0, "function value fM at tangency", m.curve, g.curve);
        ck.testCoordinate(fG, 0.0, "function value fG at tangency", m.curve, g.curve);
        ImplicitGeometryHelpers.testParallelGradients(ck, gradM, gradG);
      }
      y0 += yStep;
    }
    return y0;
  }
  /**
   * Draw visuals of input geometry and line markup.
   * @param ck checker4
   * @param allGeometry output capture array
   * @param x0 output x shift
   * @param y0 output y shift
   * @param markup circles to output with lines to tangency
   * @param inputGeometry additional input geometry to output with each markup batch
   * @param yStep step to apply to y0 for each output circle and markup batch
   * @returns updated y0
   */
  public static outputLineMarkup(ck: Checker, allGeometry: GeometryQuery[], x0: number, y0: number,
    markup: ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined,
    inputGeometry: ImplicitCurve2d[] | undefined = undefined, yStep: number = 0): number {
    if (markup === undefined) {
      if (inputGeometry) {
        for (const g1 of inputGeometry) {
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(g1, 8), x0, y0,
          );
        }
      }
      return y0;
    }
    for (const m of markup) {
      if (m.curve instanceof UnboundedLine2dByPointAndNormal)
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(m.curve, 5), x0, y0,
        );
      for (const g of m.data) {
        if (inputGeometry) {
          for (const g1 of inputGeometry) {
            GeometryCoreTestIO.captureCloneGeometry(
              allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(g1, 5), x0, y0,
            );
          }
        }
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, g.point, 0.1, x0, y0);
        const fM = m.curve.functionValue(g.point);
        const fG = g.curve.functionValue(g.point);
        // const gradM = m.curve.gradient(g.point);
        // const gradG = g.curve.gradient(g.point);
        ck.testCoordinate(fM, 0.0, "function value fM at tangency", m.curve, g.curve);
        ck.testCoordinate(fG, 0.0, "function value fG at tangency", m.curve, g.curve);
        // ImplicitGeometryHelpers.testParallelGradients(ck, gradM, gradG);
      }
      y0 += yStep;
    }
    return y0;
  }
}
