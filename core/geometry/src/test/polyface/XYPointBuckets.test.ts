/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range2d } from "../../geometry3d/Range";
import { XYIndexGrid, XYPointBuckets } from "../../polyface/multiclip/XYPointBuckets";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */

describe("XYPointBuckets", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    ck.testUndefined(XYIndexGrid.createWithEstimatedCounts(Range2d.createNull(), 100, 10), "expect null grid");
    ck.testUndefined(XYPointBuckets.create(new GrowableXYZArray(), 10), "no buckets for no points");
    const numX = 10;
    for (const yDiff of [-4, 0, 5]) {
      const numY = numX + yDiff;
      const points = GrowableXYZArray.create(Sample.createXYGrid(numX, numY, 1, 1));
      const searcher = XYPointBuckets.create(points, 10)!;
      const x0Test = 0.5;
      const y0Test = 1.8;
      const dx = 2.0; // must be integer to be good point count!
      const dy = 3.0; // must be integer to be good point count!
      const range = Range2d.createXYXY(x0Test, y0Test, x0Test + dx, y0Test + dy);
      let numHit = 0;
      searcher.announcePointsInRange(range,
        (i: number, x: number, y: number, z: number) => {
          ck.testExactNumber(x, points.getXAtUncheckedPointIndex(i));
          ck.testExactNumber(y, points.getYAtUncheckedPointIndex(i));
          ck.testExactNumber(z, points.getZAtUncheckedPointIndex(i));
          ck.testTrue(range.containsXY(x, y));
          numHit++;
          return true;
        });
      ck.testExactNumber(dx * dy, numHit, "hits in box in grid");
      const numXEdge = searcher.indexGrid.numXEdge;
      const numYEdge = searcher.indexGrid.numYEdge;
      ck.testExactNumber(0, searcher.indexGrid.xIndex(-1000));
      ck.testExactNumber(0, searcher.indexGrid.yIndex(-1000));
      ck.testExactNumber(numXEdge - 1, searcher.indexGrid.xIndex(1000));
      ck.testExactNumber(numYEdge - 1, searcher.indexGrid.yIndex(1000));
      const xyzA = points.getPoint3dAtCheckedPointIndex(4)!;
      const indexArrayA = searcher.indexGrid.getDataAtXY(xyzA.x, xyzA.y);
      const xIndexA = searcher.indexGrid.xIndex(xyzA.x);
      const yIndexA = searcher.indexGrid.xIndex(xyzA.y);
      const indexArrayA1 = searcher.indexGrid.getDataAtIndex(xIndexA, yIndexA);
      if (ck.testDefined(indexArrayA) && ck.testDefined(indexArrayA1) && indexArrayA && indexArrayA1)
        ck.testExactNumber(indexArrayA.length, indexArrayA1.length, "same index arrays");
      ck.testTrue(searcher.indexGrid.isValidIndex(xIndexA, yIndexA));

      ck.testFalse(searcher.indexGrid.isValidIndex(-1, yIndexA));
      ck.testFalse(searcher.indexGrid.isValidIndex(1000, yIndexA));
      ck.testFalse(searcher.indexGrid.isValidIndex(xIndexA, -1));
      ck.testFalse(searcher.indexGrid.isValidIndex(xIndexA, 1000));

      ck.testUndefined(searcher.indexGrid.getDataAtIndex(-1, yIndexA));
      ck.testUndefined(searcher.indexGrid.getDataAtIndex(1000, yIndexA));
      ck.testUndefined(searcher.indexGrid.getDataAtIndex(xIndexA, -1));
      ck.testUndefined(searcher.indexGrid.getDataAtIndex(xIndexA, 1000));
    }

    expect(ck.getNumErrors()).equals(0);
  });
  it("MessyGrid", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    ck.testUndefined(XYPointBuckets.create(new GrowableXYZArray(), 10), "no buckets for no points");
    let x0 = 0;
    const y0 = 0;
    for (const numY of [6, 10]) {
      const numX = numY + 8;
      const points = GrowableXYZArray.create(Sample.createXYGrid(numX, numY, 1, 1));
      if (numY > 8) {
        const num0 = points.length;
        for (let i = 0; i < num0; i++) {
          const extraPoints = Sample.createStar(points.getXAtUncheckedPointIndex(i), points.getYAtUncheckedPointIndex(i), points.getZAtUncheckedPointIndex(i),
            0.4, undefined, 3 + (i % 3), false, Angle.createDegrees(5 * i));
          for (const p of extraPoints)
            points.push(p);
        }
      }
      const searcher = XYPointBuckets.create(points, 10)!;
      const x0Test = 0.5;
      const y0Test = 1.8;
      const dx = 2.0; // must be integer to be good point count!
      const dy = 3.0; // must be integer to be good point count!
      const range = Range2d.createXYXY(x0Test, y0Test, x0Test + dx, y0Test + dy);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, x0, y0);
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, -3, points.getPoint3dArray(), 0.05, x0, y0);
      searcher.announcePointsInRange(range,
        (_i: number, x: number, y: number, z: number) => {
          ck.testTrue(range.containsXY(x, y));
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, Point3d.create(x, y, z), 0.1, x0, y0);
          return true;
        });
      x0 += numX + 5.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "XYPointBuckets", "MessyGrid");
    expect(ck.getNumErrors()).equals(0);
  });

});
