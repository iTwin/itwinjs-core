/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { Checker } from "../Checker";
import { Point3d } from "../../geometry3d/Point3dVector3d";

describe("CurveLocationDetail", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const segmentA = LineSegment3d.createXYXY(1, 2, 5, 2);
    const f0 = 0.10;
    const f1 = 0.83;
    const detailA0 = CurveLocationDetail.createCurveFractionPoint(segmentA, f0, segmentA.fractionToPoint(f0));
    const detailA1 = CurveLocationDetail.createCurveFractionPoint(segmentA, f1, segmentA.fractionToPoint(f1));
    detailA0.setCurve(segmentA);
    detailA1.setCurve(segmentA);
    ck.testTrue(detailA0.isIsolated);
    const pairA = CurveLocationDetailPair.createCapture(detailA0, detailA1);
    const pairAClone = pairA.clone();
    ck.testPointer(pairAClone);

    const detailB0 = detailA0.clone();
    detailA0.fraction += 0.5;
    const detailB1 = detailB0.clone(detailB0);    // nothing happens, but a return gets reached.
    ck.testPointer(detailB0, detailB1);

    ck.checkpoint("CurveLocationDetail.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
  it("InverseFraction", () => {
    const ck = new Checker();
    const segmentA = LineSegment3d.createXYXY(1, 2, 5, 2);
    const f0 = 0.10;
    const f1 = 0.83;
    // a normal two-point detail ...
    const detailA0 = CurveLocationDetail.createCurveEvaluatedFractionFraction(segmentA, f0, f1);
    const g0 = 1000.0;
    const g = 0.34;
    const f = Geometry.interpolate(detailA0.fraction, g, detailA0.fraction1!);
    const g1 = detailA0.inverseInterpolateFraction(f, g0);
    ck.testExactNumber(g, g1, "inverse interpolation in simple interval.");
    // a degenerate two-point detail
    const detailA2 = CurveLocationDetail.createCurveEvaluatedFractionFraction(segmentA, f0, f0);  // degenerate !
    const g2 = detailA2.inverseInterpolateFraction(f0, g0);
    ck.testExactNumber(g0, g2, "inverse interpolate in degenerate interval");

    ck.checkpoint("CurveLocationDetail.InverseFraction");
    expect(ck.getNumErrors()).equals(0);
  });
  it("CollapseToPoint", () => {
    const ck = new Checker();
    const detail = CurveLocationDetail.createCurveFractionPoint(undefined, 0.1, Point3d.create(1, 1, 1));
    detail.captureFraction1Point1(0.2, Point3d.create(2, 2, 2));
    let copy = detail.clone();
    copy.collapseToStart();
    ck.testExactNumber(copy.fraction, detail.fraction, "CurveLocationDetail.collapseToStart preserves fraction");
    ck.testPoint3d(copy.point, detail.point, "CurveLocationDetail.collapseToStart preserves point");
    ck.testUndefined(copy.fraction1, "CurveLocationDetail.collapseToStart nullifies fraction1");
    ck.testUndefined(copy.point1, "CurveLocationDetail.collapseToStart nullifies point1");
    copy = detail.clone();
    copy.collapseToEnd();
    ck.testExactNumber(copy.fraction, detail.fraction1!, "CurveLocationDetail.collapseToEnd moves fraction1 to fraction");
    ck.testPoint3d(copy.point, detail.point1!, "CurveLocationDetail.collapseToEnd moves point1 to point");
    if (ck.testUndefined(copy.fraction1, "CurveLocationDetail.collapseToEnd nullifies fraction1") &&
        ck.testUndefined(copy.point1, "CurveLocationDetail.collapseToEnd nullifies point1")) {
      const copy1 = copy.clone();
      copy1.collapseToEnd();
      ck.testExactNumber(copy1.fraction, copy.fraction, "CurveLocationDetail.collapseToEnd preserves fraction if fraction1 undefined");
      ck.testPoint3d(copy1.point, copy.point, "CurveLocationDetail.collapseToEnd preserves point if point1 undefined");
      ck.testUndefined(copy1.fraction1, "CurveLocationDetail.collapseToEnd preserves undefined fraction1");
      ck.testUndefined(copy1.point1, "CurveLocationDetail.collapseToEnd preserves undefined point1");
    }
    expect(ck.getNumErrors()).equals(0);
  });
});
