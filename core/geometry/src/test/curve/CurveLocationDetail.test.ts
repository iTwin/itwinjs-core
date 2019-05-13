/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// import { Sample } from "../serialization/GeometrySamples";
import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { LineSegment3d } from "../../curve/LineSegment3d";
// import { Point3d, Transform } from "../PointVector";
import { Checker } from "../Checker";
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
});
