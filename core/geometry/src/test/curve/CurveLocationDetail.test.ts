/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
// import { Sample } from "../serialization/GeometrySamples";
import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
// import { Point3d, Transform } from "../PointVector";
import { Checker } from "../Checker";

/* eslint-disable no-console */
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

});
