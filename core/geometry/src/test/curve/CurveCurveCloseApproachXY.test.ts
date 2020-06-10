/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveCurve } from "../../curve/CurveCurve";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { CurvePrimitive } from "../../curve/CurvePrimitive";

function testVaryingLineSegments(_ck: Checker, allGeometry: GeometryQuery[], geometryA: CurvePrimitive) {
  const path0 = Arc3d.createXY(geometryA.fractionToPoint(0.5), 4)!;
  const path1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, 9), Point3d.create(6, 3), Point3d.create(3, -3))!;
  const fractions = [0.6, 0.0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 0.9, 1.0];
  let x0 = 0;
  const maxDistance = 2.5;
  for (const f0 of fractions) {
    let y0 = 0;
    for (const f1 of fractions) {
      const lineB = LineSegment3d.create(path0.fractionToPoint(f0), path1.fractionToPoint(f1));
      const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, lineB, 2.5);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineB, x0, y0);
      if (approaches.length > 0) {
        for (const p of approaches)
          if (p.detailA.point.isAlmostEqual(p.detailB.point))
            GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, p.detailA.point, 0.25, x0, y0);
          else
            GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(p.detailA.point, p.detailB.point), x0, y0);
      } else {
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, geometryA.startPoint(), maxDistance, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, geometryA.endPoint(), maxDistance, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, lineB.startPoint(), maxDistance, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, lineB.endPoint(), maxDistance, x0, y0);
      }
      y0 += 20;
    }
    x0 += 20;
  }
}
describe("CurveCurveCloseApproachXY", () => {

  it("LineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    testVaryingLineSegments(ck, allGeometry, LineSegment3d.createXYXY(1, 2, 5, 2));
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    testVaryingLineSegments(ck, allGeometry,
      Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 2.5), Point3d.create(5, 2))!);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineArc");
    expect(ck.getNumErrors()).equals(0);
  });
});
