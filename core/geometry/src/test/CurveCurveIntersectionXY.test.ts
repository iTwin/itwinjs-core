/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "../PointVector";
import { CurveCurve, CurveLocationDetailArrayPair } from "../curve/CurveCurveIntersectXY";
import { LineString3d } from "../curve/LineString3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Checker } from "./Checker";
import { expect } from "chai";

/* tslint:disable:no-console */
function testIntersectionsXY(
  ck: Checker,
  intersections: CurveLocationDetailArrayPair, minExpected: number, maxExpected: number) {
  if (ck.testExactNumber(intersections.dataA.length, intersections.dataB.length, "intersections A B match")) {
    const n = intersections.dataA.length;
    if (n < minExpected || n > maxExpected) {
      ck.announceError("intersction count out of range", n, minExpected, maxExpected);
      return;
    }

    for (let i = 0; i < n; i++) {
      ck.testPoint3dXY(intersections.dataA[i].point, intersections.dataB[i].point, "CLD coordinate match");
      const fA = intersections.dataA[i].fraction;
      const fB = intersections.dataB[i].fraction;
      const cpA = intersections.dataA[i].curve;
      const cpB = intersections.dataB[i].curve;
      if (ck.testPointer(cpA) && cpA
        && ck.testPointer(cpB) && cpB) {
        ck.testPoint3d(cpA.fractionToPoint(fA), intersections.dataA[i].point);
        ck.testPoint3d(cpB.fractionToPoint(fB), intersections.dataB[i].point);
      }
    }
  }
}

describe("CurveCurve", () => {
  it("LineLine", () => {
    const ck = new Checker();
    const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
    const segment1 = LineSegment3d.createXYXY(4, 1, 2, 3);
    const intersections = CurveCurve.IntersectionXY(segment0, false, segment1, false);
    testIntersectionsXY(ck, intersections, 1, 1);
    ck.checkpoint("CurveCurve.LineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineLineString", () => {
    const ck = new Checker();
    const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
    const linestring0 = LineString3d.create(Point3d.create(1, 1), Point3d.create(3, 0), Point3d.create(3, 5));
    const linestring1 = LineString3d.create(Point3d.create(2, 4), Point3d.create(4, 1), Point3d.create(2, 5));
    const intersections = CurveCurve.IntersectionXY(segment0, false, linestring0, false);
    testIntersectionsXY(ck, intersections, 1, 1);
    const intersections1 = CurveCurve.IntersectionXY(linestring0, false, segment0, false);
    testIntersectionsXY(ck, intersections1, 1, 1);

    const intersections2 = CurveCurve.IntersectionXY(linestring0, false, linestring1, false);
    testIntersectionsXY(ck, intersections2, 2, 2);

    const intersectionsX = CurveCurve.IntersectionXY(segment0, true, linestring0, true);
    testIntersectionsXY(ck, intersectionsX, 2, 2);
    expect(ck.getNumErrors()).equals(0);
  });
});
