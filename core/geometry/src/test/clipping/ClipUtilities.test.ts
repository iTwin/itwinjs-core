/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { ClipUtilities } from "../../clipping/ClipUtils";

describe("ParityRegionSweep", () => {
it("triangleClip", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const pointA = Point3d.create (-10,4);
  const pointB = Point3d.create (6,1);
  const pointC = Point3d.create (2,5);
  const vector01 = Vector3d.create(1, 7);
  const dxA = 1.5;
  const intervals = [
    Range1d.createXX(0, 1), Range1d.createXX(0.3, 1.0),
    Range1d.createXX(0.6, 1.0), Range1d.createXX(0, 0.5),
    Range1d.createXX(0.5, 1.0), Range1d.createXX(0.2, 0.8)];
  const xOut = 0;
  const yOut0 = 0;
  const yOut1 = 10.0;
  const yOut2 = 20.0;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], xOut, yOut0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], xOut, yOut1);
  for (let x0 = -3; x0 <= 5.0; x0 += dxA){
    const segment0 = Point3d.create(x0, 0, 0);
    const segment1 = segment0.plus(vector01);
    let dx = 0.0;
    for (const interval of intervals) {
      segment0.x += dx;
      segment1.x += dx;
      dx += 0.02;
      const segment2 = segment0.interpolate(interval.low, segment1);
      const segment3 = segment0.interpolate(interval.high, segment1);
      const resultABC = Range1d.createXX(0, 1);
      ClipUtilities.clipSegmentToCCWTriangleXY(pointA, pointB, pointC, segment2, segment3, resultABC);
      const resultBCA = Range1d.createXX(0, 1);
      ClipUtilities.clipSegmentToCCWTriangleXY(pointB, pointC, pointA, segment2, segment3, resultBCA);
      ck.testTightNumber(resultABC.length(), resultBCA.length(), "clip fraction length with rotated triangle order");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment2, segment3], xOut, yOut0);
      if (!resultABC.isNull) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry,
          [segment2.interpolate(resultABC.low, segment3), segment2.interpolate(resultABC.high, segment3)],
          xOut, yOut1);
        }
      if (!resultBCA.isNull) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry,
          [segment2.interpolate(resultABC.low, segment3), segment2.interpolate(resultABC.high, segment3)],
          xOut, yOut2);
        }
      }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "triangleClip");
  expect(ck.getNumErrors()).equals(0);
});

});
