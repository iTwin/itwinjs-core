/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// import { Sample } from "../serialization/GeometrySamples";
import { CurveLocationDetail, CurveLocationDetailPair } from "../curve/CurvePrimitive";
import { LineSegment3d } from "../curve/LineSegment3d";
// import { Point3d, Transform } from "../PointVector";
import { Checker } from "./Checker";
import { expect } from "chai";
/* tslint:disable:no-console */
describe("CurveLocationDetail", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const segmentA = LineSegment3d.createXYXY(1, 2, 5, 2);
    const f0 = 0.10;
    const f1 = 0.83;
    const detailA0 = CurveLocationDetail.createCurveFractionPoint(segmentA, f0, segmentA.fractionToPoint(f0));
    const detailA1 = CurveLocationDetail.createCurveFractionPoint(segmentA, f1, segmentA.fractionToPoint(f1));
    detailA0.setCurve(segmentA);
    detailA0.setCurve(segmentA);
    ck.testTrue(detailA0.isIsolated);
    const pairA = CurveLocationDetailPair.createDetailRef(detailA0, detailA1);
    const pairAClone = pairA.clone();
    ck.testPointer(pairAClone);
    ck.checkpoint("CurveLocationDetail.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
