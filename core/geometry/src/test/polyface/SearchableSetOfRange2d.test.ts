/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BagOfCurves } from "../../curve/CurveCollection";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range2d, Range3d } from "../../geometry3d/Range";
import { GriddedRaggedRange2dSet } from "../../polyface/multiclip/GriddedRaggedRange2dSet";
import { GriddedRaggedRange2dSetWithOverflow } from "../../polyface/multiclip/GriddedRaggedRange2dSetWithOverflow";
import { LinearSearchRange2dArray } from "../../polyface/multiclip/LinearSearchRange2dArray";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Checker } from "../Checker";
import { lisajouePoint3d } from "../geometry3d/PointHelper.test";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

function saveRange(allGeometry: GeometryQuery[], ticFraction: number | undefined, range: Range2d | Range3d, xOrigin: number, yOrigin: number, zOrigin: number = 0) {
  const x0 = range.low.x;
  const y0 = range.low.y;
  const x1 = range.high.x;
  const y1 = range.high.y;
  const points = [
    Point3d.create(x0, y0), Point3d.create(x1, y0),
    Point3d.create(x1, y1), Point3d.create(x0, y1),
    Point3d.create(x0, y0),
  ];

  if (ticFraction !== undefined && ticFraction > 0) {
    const allLines = BagOfCurves.create();
    points.push(points[1]);   // 2nd wrap .
    for (const i of [1, 2, 3, 4]) {
      const ticPoints = [
        points[i].interpolate(ticFraction, points[i - 1]),
        points[i],
        points[i].interpolate(ticFraction, points[i + 1])];
      allLines.tryAddChild(LineString3d.create(ticPoints));
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, allLines, xOrigin, yOrigin, zOrigin);

  } else
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), xOrigin, yOrigin, zOrigin);
}
/* eslint-disable no-console */
// cspell::word lisajoue
describe("LinearSearchRange2dArray", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const ranges = new LinearSearchRange2dArray<number>();
    const dTheta = 0.73423;
    const numRange = 22;
    const a = 3.29;
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

    GeometryCoreTestIO.saveGeometry(allGeometry, "LinearSearchRange2dArray", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("GriddedRaggedRange2dSet", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;

    for (const sizeMultiplier of [1, 5, 10]) {
      const boxHalfSize = 10;
      const fullRange = Range2d.createXYXY(-boxHalfSize, -2 * boxHalfSize, boxHalfSize, 2 * boxHalfSize);
      const numX = 4;
      const numY = 5;
      const rangeSize = 0.75 / numX;
      const circleRadius = 0.2;
      const rangesInGrid = GriddedRaggedRange2dSet.create<number>(fullRange, numX, numY)!;
      const allRanges = GriddedRaggedRange2dSetWithOverflow.create<number>(fullRange, numX, numY)!;
      const numRange = 10 * sizeMultiplier * sizeMultiplier;
      const a = 1.0;
      const y0 = 0;
      const rangeArray = [];
      const totalTurns = numX / 8.234;
      const amplitude = 0.51;

      // collect a pile of ranges ...
      for (let i = 0; i < numRange; i++) {
        const fraction = i / numRange;
        const theta = totalTurns * Math.PI * 2 * i;
        const uvC = Point3d.create(
          Geometry.interpolate(-0.01, fraction, 0.99), 0.5 + amplitude * Math.sin(theta));
        const deltaUV = lisajouePoint3d(2.14 * theta * theta, a);
        deltaUV.x = Geometry.maxXY(0.01, deltaUV.x);
        deltaUV.y = Geometry.maxXY(0.01, deltaUV.y);
        const uv0 = uvC.plusScaled(deltaUV, -rangeSize);
        const uv1 = uvC.plusScaled(deltaUV, rangeSize);
        const point0 = fullRange.fractionToPoint(uv0.x, uv0.y);
        const point1 = fullRange.fractionToPoint(uv1.x, uv1.y);
        const range = Range2d.createXYXY(point0.x, point0.y, point1.x, point1.y);
        let isInGrid;
        if (rangesInGrid.conditionalInsert(range, i)) {
          isInGrid = true;
          saveRange(allGeometry, undefined, range, x0, y0);
        } else {
          // console.log("Range rejected", range.toJSON());
          isInGrid = false;
          saveRange(allGeometry, 0.25, range, x0, y0);
        }
        allRanges.addRange(range, i);
        (range as any).isInGrid = isInGrid;
        rangeArray.push(range);
      }

      const dy = 2.0 * fullRange.yLength();
      let y1 = y0;
      const b = 0.5;
      // for each testPoint ...
      // 1) display all candidates on a single-point search.
      // 2) display up to 2 candidates on a truncated single point search.
      // 3) display all candidates on a complete range search.
      const xStep = 2.0 * fullRange.xLength();
      const x1 = x0 + xStep;
      const x2 = x1 + 2.0 * xStep;

      const totalRange = fullRange.clone();
      saveRange(allGeometry, 0.1, fullRange, x0, y0, -0.0001);

      saveRange(allGeometry, 0.1, fullRange, x1, y0);
      rangesInGrid.visitChildren(0, (depth: number, child: LinearSearchRange2dArray<number>) => {
        saveRange(allGeometry, undefined, child.totalRange(), x1 + depth * xStep, y0);
      });
      const testStep = Math.max(1, Math.floor(numRange / 10));

      // const testUV = Point3d.create(0.3, 0.2);
      for (let i = 0; i < rangeArray.length; i += testStep) {
        const testPoint = Point3d.createFrom(rangeArray[i].fractionToPoint(0.0001, 0.0001));
        const isInGrid = (rangeArray[i] as any).isInGrid;
        const targetTag = i;
        y1 += dy;
        saveRange(allGeometry, 0.05, totalRange, x0, y1, -0.0001);  // point search in grid only
        saveRange(allGeometry, 0.05, totalRange, x1, y1, -0.0001);  // point search in two-layer
        saveRange(allGeometry, 0.05, totalRange, x2, y1, -0.0001);  // range search in two-layer
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, testPoint, circleRadius, x0, y1);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, testPoint, circleRadius, x1, y1);
        let numHit = 0;
        let numHitAllRanges = 0;
        let primaryRangeHits = 0;
        let primaryAllRangeHits = 0;
        rangesInGrid.searchXY(testPoint.x, testPoint.y,
          (candidate: Range2d, tag: number) => {
            numHit++;
            saveRange(allGeometry, 0.45, candidate, x0, y1);
            ck.testTrue(candidate.containsPoint(testPoint));
            if (tag === targetTag)
              primaryRangeHits++;
            return true;
          });
        allRanges.searchXY(testPoint.x, testPoint.y,
          (candidate: Range2d, tag: number) => {
            numHitAllRanges++;
            saveRange(allGeometry, 0.45, candidate, x1, y1);
            ck.testTrue(candidate.containsPoint(testPoint));
            if (tag === targetTag)
              primaryAllRangeHits++;
            return true;
          });
        ck.testExactNumber(isInGrid ? 1 : 0, primaryRangeHits, "primary range hits", i);
        ck.testExactNumber(1, primaryAllRangeHits, "gridded primary range hits", i);
        ck.testLE(1, numHitAllRanges, "allRange hits", i);

        // search again, but quit after 2nd hit.
        let numHit1 = 0;
        rangesInGrid.searchXY(testPoint.x, testPoint.y,
          (candidate: Range2d, _tag: number) => {
            numHit1++;
            saveRange(allGeometry, 0.45, candidate, x1, y1);
            return numHit1 < 2;
          });
        const numHit1A = numHit <= 2 ? numHit : 2;
        ck.testExactNumber(numHit1A, numHit1, "Quick Exit Count");

        // search in range
        let numHit2 = 0;
        const testRange = Range2d.createXY(testPoint.x, testPoint.y);
        testRange.expandInPlace(b);
        saveRange(allGeometry, undefined, testRange, x2, y1);
        allRanges.searchRange2d(testRange,
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
      rangesInGrid.searchXY(outsidePoint.x, outsidePoint.y,
        (_candidate: Range2d, _tag: number) => {
          numHitOut++;
          return true;
        });
      ck.testExactNumber(0, numHitOut, "no candidates for outside point");
      numHitOut = 0;
      const outsideRange = Range2d.createXY(outsidePoint.x, outsidePoint.y);
      outsideRange.expandInPlace(0.01 * totalRange.xLength());
      rangesInGrid.searchRange2d(outsideRange,
        (_candidate: Range2d, _tag: number) => {
          numHitOut++;
          return true;
        });
      x0 += 40 * totalRange.xLength();
      const xLine = -2 * boxHalfSize;
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYXY(xLine, 0, xLine, y1), x0, y0);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "GriddedRaggedRange2dSet", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
  it("FacetGrid", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;

    for (const sizeMultiplier of [1, 5, 10]) {
      const boxHalfSize = 10;
      const fullRange = Range2d.createXYXY(-boxHalfSize, -2 * boxHalfSize, boxHalfSize, 2 * boxHalfSize);
      const numX = 4;
      const numY = 5;
      const allRanges = GriddedRaggedRange2dSetWithOverflow.create<number>(fullRange, numX, numY)!;
      const numPoints = 10 * sizeMultiplier * sizeMultiplier;
      const y0 = 0;
      const yStep = 2 * fullRange.yLength();
      const y1 = yStep;
      const y2 = y1 + yStep;
      const xStep = 2 * fullRange.xLength();
      const x1 = x0 + xStep;
      const totalTurns = numX / 8.234;

      const points = createSinSamplePoints(fullRange, numPoints, totalTurns);
      const facets = PolyfaceBuilder.pointsToTriangulatedPolyface(points)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, facets, x0, y0);

      const visitor = facets.createVisitor(0);
      let numFacets = 0;
      for (visitor.reset(); visitor.moveToNextFacet();) {
        allRanges.addRange(visitor.point.getRange(), visitor.currentReadIndex());
        numFacets++;
      }

      saveRange(allGeometry, 0.1, fullRange, x1, y0);
      allRanges.visitChildren(0, (depth: number, child: LinearSearchRange2dArray<number>) => {
        saveRange(allGeometry, undefined, child.totalRange(), x1 + depth * xStep, y0);
      });

      if (numFacets > 10) {
        visitor.setNumWrap(1);
        const sampleStep = Math.max(1, Math.ceil(numFacets / 5));
        saveRange(allGeometry, undefined, fullRange, x0, y1);
        for (let facetIndex = 0; facetIndex < numFacets; facetIndex += sampleStep) {
          visitor.moveToReadIndex(facetIndex);
          const point0 = visitor.point.getPoint3dAtUncheckedPointIndex(0);

          const facetRange = visitor.point.getRange();
          saveRange(allGeometry, undefined, facetRange, x0, y1);
          allRanges.searchRange2d(facetRange, (_candidateRange: Range2d, index: number) => {
            if (visitor.moveToReadIndex(index)) {
              const shape = Loop.createPolygon(visitor.point);
              GeometryCoreTestIO.captureGeometry(allGeometry, shape, x0, y1);
            }
            return true;
          });

          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, point0, 0.04, x0, y2, 0.01);
          allRanges.searchXY(point0.x, point0.y, (_candidateRange: Range2d, index: number) => {
            if (visitor.moveToReadIndex(index)) {
              const shape = Loop.createPolygon(visitor.point);
              GeometryCoreTestIO.captureGeometry(allGeometry, shape, x0, y2);
            }
            return true;
          });
        }
      }
      x0 += 10 * xStep;
      const xLine = -2 * boxHalfSize;
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYXY(xLine, -y1, xLine, y1), x0, y0);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "GriddedRaggedRange2dSet", "FacetGrid");
    expect(ck.getNumErrors()).equals(0);
  });

});
function createSinSamplePoints(range: Range2d, numPoint: number, totalTurns: number): Point3d[] {
  const points = [];
  for (let i = 0; i < numPoint; i++) {
    const fraction = i / numPoint;
    const theta = totalTurns * Math.PI * 2 * i;
    const uv = Point3d.create(fraction, 0.5 * (1.0 + Math.sin(theta)));
    points.push(Point3d.createFrom(range.fractionToPoint(uv.x, uv.y)));
  }
  return points;
}
