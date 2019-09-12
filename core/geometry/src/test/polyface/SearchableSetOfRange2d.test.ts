/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { SearchableSetOfRange2d } from "../../polyface/multiclip/SearchableSetOfRange2d";
import { lisajouePoint3d } from "../geometry3d/PointHelper.test";
import { Range2d } from "../../geometry3d/Range";
import { LineString3d } from "../../curve/LineString3d";

function saveRange(allGeometry: GeometryQuery[], ticFraction: number | undefined, range: Range2d, xOrigin: number, yOrigin: number, zOrigin: number = 0) {
  const x0 = range.low.x;
  const y0 = range.low.y;
  const x1 = range.high.x;
  const y1 = range.high.y;
  const points = [Point3d.create(x0, y0), Point3d.create(x1, y0),
  Point3d.create(x1, y1), Point3d.create(x0, y1),
  Point3d.create(x0, y0)];

  if (ticFraction !== undefined && ticFraction > 0) {
    points.push(points[1]);   // 2nd wrap .
    for (const i of [1, 2, 3, 4]) {
      const ticPoints = [
        points[i].interpolate(ticFraction, points[i - 1]),
        points[i],
        points[i].interpolate(ticFraction, points[i + 1])];
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(ticPoints), xOrigin, yOrigin, zOrigin);
    }

  } else
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), xOrigin, yOrigin, zOrigin);
}
/* tslint:disable:no-console */
// cspell::word lisajoue
describe("SearchableSetOfRange2d", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const ranges = new SearchableSetOfRange2d<number>();
    const dTheta = 0.73423;
    const numRange = 22;
    const a = 2.0;
    const x0 = 0;
    const y0 = 0;
    // collect a pile of ranges ...
    for (let i = 0; i < numRange; i++) {
      const theta = (i + 2) * dTheta;
      const point0 = lisajouePoint3d(theta, a);
      const point1 = lisajouePoint3d(2.14 * theta, a);
      const range = Range2d.createXYXY(point0.x, point0.y, point1.x, point1.y);
      ranges.addRange(range, i);
      saveRange(allGeometry, undefined, range, x0, y0);
    }
    const totalRange = ranges.totalRange();
    totalRange.expandInPlace(0.01);
    saveRange(allGeometry, 0.1, totalRange, x0, y0, -0.0001);
    const dy = 2.0 * totalRange.yLength();
    let y1 = y0;
    const b = 0.1;
    // for each testPoint ...
    // 1) display all candidates on a single-point search.
    // 2) display up to 2 candidates on a truncated single point search.
    // 3) display all candidates on a complete range search.
    const x1 = x0 + 2.0 * totalRange.xLength();
    const x2 = x1 + 2.0 * totalRange.xLength();
    for (const testPoint of [Point3d.create(0.01, -0.2), Point3d.create(-0.3, 0.5), Point3d.create(-0.4, -0.2)]) {
      y1 += dy;
      saveRange(allGeometry, 0.05, totalRange, x0, y1, -0.0001);
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, testPoint, 0.02, x0, y0);
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, testPoint, 0.02, x1, y1);
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, testPoint, 0.02, x0, y1);
      let numHit = 0;
      ranges.searchXY(testPoint.x, testPoint.y,
        (candidate: Range2d, _tag: number) => {
          numHit++;
          saveRange(allGeometry, 0.45, candidate, x0, y1);
          ck.testTrue(candidate.containsPoint(testPoint));
          return true;
        });
      // search again, but quit after 2nd hit.
      let numHit1 = 0;
      ranges.searchXY(testPoint.x, testPoint.y,
        (candidate: Range2d, _tag: number) => {
          numHit1++;
          saveRange(allGeometry, 0.45, candidate, x1, y1);
          return numHit1 < 2;
        });
      const numHit1A = numHit <= 2 ? numHit : 2;
      ck.testExactNumber(numHit1A, numHit1, "Quick Exit Count");

      // search again, but quit after 2nd hit.
      let numHit2 = 0;
      const testRange = Range2d.createXY(testPoint.x, testPoint.y);
      testRange.expandInPlace(b);
      saveRange(allGeometry, undefined, testRange, x2, y1);
      ranges.searchRange2d(testRange,
        (candidate: Range2d, _tag: number) => {
          numHit2++;
          saveRange(allGeometry, 0.30, candidate, x2, y1);
          ck.testTrue(candidate.intersectsRange(testRange));
          return true;
        });
      ck.testLE(numHit, numHit2, "range search count can be larger than point hit");
    }

    // confirm trivial rejects ..
    const outsidePoint = totalRange.fractionToPoint(1.3, 0.3);     // safely to the right of everything !!
    let numHitOut = 0;
    ranges.searchXY(outsidePoint.x, outsidePoint.y,
      (_candidate: Range2d, _tag: number) => {
        numHitOut++;
        return true;
      });
    ck.testExactNumber(0, numHitOut, "no candidates for outside point");
    numHitOut = 0;
    const outsideRange = Range2d.createXY(outsidePoint.x, outsidePoint.y);
    outsideRange.expandInPlace(0.01 * totalRange.xLength());
    ranges.searchRange2d(outsideRange,
      (_candidate: Range2d, _tag: number) => {
        numHitOut++;
        return true;
      });

    GeometryCoreTestIO.saveGeometry(allGeometry, "SearchableSetOfRange2d", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
