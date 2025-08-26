/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, it } from "vitest";
import { CurveFactory } from "../../curve/CurveFactory";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { TangentConstruction } from "../../curve/internalContexts/geometry2d/TangentConstruction";
import { UnboundedCircle2dByCenterAndRadius } from "../../curve/internalContexts/geometry2d/UnboundedCircle2d";
import { UnboundedHyperbola2d } from "../../curve/internalContexts/geometry2d/UnboundedHyperbola2d";
import { UnboundedLine2dByPointAndNormal } from "../../curve/internalContexts/geometry2d/UnboundedLine2d";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

it("MedialCurveCC", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];

  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 0, 1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 4, -2);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 1, 0.8);
  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(2, 3, 4);
  const allCircles = [circleA, circleB, circleC, circleD];
  let x0 = 0;
  const xStepA = 20;
  const xStepB = 40;
  for (let i = 0; i < allCircles.length; i++) {
    const circle0 = allCircles[i];
    const circle1 = circle0.cloneNegateRadius();
    for (let j = i + 1; j < allCircles.length; j++) {
      for (const circle of [circle0, circle1]) {
        const curve = TangentConstruction.medialCurveCircleCircle(circle, allCircles[j]);
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(allCircles[i]), x0,
        );
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(allCircles[j]), x0,
        );
        if (curve)
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(curve), x0,
          );
        x0 += xStepA;
      }
    }
    x0 += xStepB;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "MedialCurveCC");
  expect(ck.getNumErrors()).toBe(0);
});

it("MedialCurveCL", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];

  const lineA = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(0, 0, 1, 0);
  const lineB = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(0, 0, -1, 0);
  const lineC = UnboundedLine2dByPointAndNormal.createPointXYDirectionXY(2, 2, 1, 3);
  const circleA = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, 2, 1);
  const circleB = UnboundedCircle2dByCenterAndRadius.createXYRadius(-2, 0.5, 0.75);
  const circleC = UnboundedCircle2dByCenterAndRadius.createXYRadius(0, -2, 1);
  const circleD = UnboundedCircle2dByCenterAndRadius.createXYRadius(3, -2, 2);
  const allLines = [lineA, lineB, lineC];
  const allCircles = [circleA, circleB, circleC, circleD];
  let y0 = 0;
  const xStepA = 50;
  const xStepB = 100;
  for (const line of allLines) {
    let x0 = 0;
    for (const circle of allCircles) {
      const curves = TangentConstruction.medialCurveLineCircle(line, circle);
      GeometryCoreTestIO.captureCloneGeometry(
        allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(line, 10), x0, y0,
      );
      GeometryCoreTestIO.captureCloneGeometry(
        allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(circle), x0, y0,
      );
      if (curves)
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(curves), x0, y0
        );
      x0 += xStepA;
    }
    y0 += xStepB;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "MedialCurveCL");
  expect(ck.getNumErrors()).toBe(0);
});

it("UnboundedHyperbola2d", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];

  const curveA = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 0), Vector2d.create(1, 0), Vector2d.create(0, 1),
  );
  const curveA1 = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 1), Vector2d.create(1, 0), Vector2d.create(0, 1),
  );
  const curveB = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(1, 2), Vector2d.create(2, 1), Vector2d.create(-1, 3),
  );
  const curveCX = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 0), Vector2d.create(2, 0), Vector2d.create(0, 1),
  );
  const curveCY = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(1, 2), Vector2d.create(0, 2), Vector2d.create(2, 0),
  );
  const curveD = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 0), Vector2d.create(1, 0), Vector2d.create(1, 1),
  );
  const curveE = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 0), Vector2d.create(1, 0), Vector2d.create(0, -1),
  );
  const curveF = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 0), Vector2d.create(1, -1), Vector2d.create(1, 1),
  );
  let x0 = 0;
  for (const curve of [curveA, curveCX, curveCY, curveA1, curveB, curveD, curveE, curveF]) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(curve), x0);
    // GeometryCoreTestIO.consoleLog("curve", { a: curve.center, u: curve.vectorU, v: curve.vectorV });
    for (const radians of [0.0, 0.1, 0.5]) {
      const xy = curve.radiansToPoint2d(radians);
      if (xy !== undefined) {
        const xy1 = curve.closestPoint(xy);
        if (ck.testDefined(xy1, "closestPoint"))
          ck.testPoint2d(xy, xy1);
        const f = curve.functionValue(xy);
        ck.testCoordinate(0, f);
      }
    }
    // off-curve tests
    for (const xy of [
      Point2d.create(3, 5),
      Point2d.create(13, 0.1),
      Point2d.create(4, 5),
      Point2d.create(8, 5),
      Point2d.create(8, -1),
      Point2d.create(2, 0.01),
    ]) {
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, xy, 0.05, x0);
      curve.emitPerpendiculars(
        xy,
        (curvePoint: Point2d, _radians: number | undefined) => {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.createXYXY(xy.x, xy.y, curvePoint.x, curvePoint.y), x0);
          ck.testCoordinate(0, curve.functionValue(curvePoint), "point projects to the curve");
          const gradF = curve.gradient(curvePoint);
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry,
            [Point3d.createFrom(curvePoint), Point3d.createFrom(curvePoint.plusScaled(gradF, 0.2))],
            x0,
          );
          const vectorW = Vector2d.createStartEnd(xy, curvePoint);
          const cross = gradF.crossProduct(vectorW);
          ck.testCoordinate(0, cross, "point to hyperbola is perpendicular");
        }
      );
    }
    x0 += 50;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "UnboundedHyperbola2d");
  expect(ck.getNumErrors()).toBe(0);
});
