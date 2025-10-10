/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, it } from "vitest";
import { CurveFactory } from "../../curve/CurveFactory";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { UnboundedEllipse2d } from "../../curve/internalContexts/geometry2d/UnboundedEllipse2d";
import { UnboundedHyperbola2d } from "../../curve/internalContexts/geometry2d/UnboundedHyperbola2d";
import { UnboundedParabola2d } from "../../curve/internalContexts/geometry2d/UnboundedParabola";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

it("ImplicitCurve2d", () => {
  const ck = new Checker(true, true);
  const allGeometry: GeometryQuery[] = [];

  const ellipse = UnboundedEllipse2d.createCenterAndAxisVectors(
    Point2d.create(1, 3), Vector2d.create(2, 1), Vector2d.create(1, 4),
  );
  const unitEllipse = UnboundedEllipse2d.createCenterAndAxisVectors(
    Point2d.create(1, 2), Vector2d.create(1, 0), Vector2d.create(0, 1),
  );
  const hyperbola = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(1, 2), Vector2d.create(2, 1), Vector2d.create(1, 4),
  );
  const unitHyperbola = UnboundedHyperbola2d.createCenterAndAxisVectors(
    Point2d.create(0, 0), Vector2d.create(1, 0), Vector2d.create(0, 1),
  );
  const parabola = UnboundedParabola2d.createCenterAndAxisVectors(
    Point2d.create(-2, 1), Vector2d.create(2, 1), Vector2d.create(1, 4),
  );
  const unitParabola = UnboundedParabola2d.createCenterAndAxisVectors(
    Point2d.create(1, 2), Vector2d.create(1, 0), Vector2d.create(0, 1),
  );

  let x0 = 0;
  for (const curve of [ellipse, unitEllipse, hyperbola, unitHyperbola, parabola, unitParabola]) {
    // GeometryCoreTestIO.consoleLog(curve);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, CurveFactory.createCurvePrimitiveFromImplicitCurve(curve), x0);
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
        (curvePoint: Point2d, radians: number | undefined) => {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.createXYXY(xy.x, xy.y, curvePoint.x, curvePoint.y), x0);
          ck.testCoordinate(0, curve.functionValue(curvePoint), "point projects to the curve");
          const gradF = curve.gradient(curvePoint);
          GeometryCoreTestIO.captureCloneGeometry(
            allGeometry,
            [curvePoint, curvePoint.plusScaled(gradF, 0.2)],
            x0,
          );
          const vectorW = Vector2d.createStartEnd(xy, curvePoint);
          ck.testParallelOrAntiParallel2d(gradF, vectorW, "grad parallel space vector");
          if (radians !== undefined) {
            const tangent = curve.radiansToTangentVector2d(radians);
            if (tangent !== undefined) {
              GeometryCoreTestIO.captureCloneGeometry(
                allGeometry,
                [curvePoint, curvePoint.plusScaled(tangent, 0.2)],
                x0,
              );
              ck.testPerpendicular2d(gradF, tangent, "grad perp tangent");
            }
          }
        }
      );
    }
    x0 += 30;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "geometry2d", "ImplicitCurve2d");
  expect(ck.getNumErrors()).toBe(0);
});

