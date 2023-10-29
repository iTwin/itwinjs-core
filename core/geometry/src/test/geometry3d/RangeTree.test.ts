/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "../Checker";
import { Sample } from "../../serialization/GeometrySamples";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Range3d } from "../../geometry3d/Range";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeSearchHandler } from "../../geometry3d/RangeTree";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Geometry } from "../../Geometry";

// Clone and shift the range ...
// shift by dx
// both low and high z are at dz (ignores input range z)
function makeRangeForOutput(range: Range3d, dx: number, dy: number, dz: number): Range3d {
  const x0 = range.xLow + dx;
  const y0 = range.yLow + dy;
  const x1 = range.xHigh + dx;
  const y1 = range.yHigh + dy;
  return Range3d.createXYZXYZ(x0, y0, dz, x1, y1, dz);

}
class ClosestPointOnCurvesHandler extends SingleTreeSearchHandler<CurvePrimitive>{
  public spacePoint: Point3d;
  public minDistance: number;
  public closestPointData?: CurveLocationDetail;
  public activeRanges?: Range3d[];
  public rejectedRanges?: Range3d[];
  private _lastZ: number;

  public numRangeTest;
  public numCurveTest;
  public numCases;

  private constructor(spacePoint: Point3d, saveRanges: boolean) {
    super();
    this.spacePoint = spacePoint.clone();
    this.minDistance = Number.MAX_VALUE;
    if (saveRanges) {
      this.activeRanges = [];
      this.rejectedRanges = [];
    } else {
      this.activeRanges = undefined;
      this.rejectedRanges = undefined;
    }
    this._lastZ = 0.0;
    this.numCases = 0;
    this.numCurveTest = 0;
    this.numRangeTest = 0;
  }
  public resetSearch(spacePoint: Point3d) {
    if (this.activeRanges !== undefined)
      this.activeRanges.length = 0;
    if (this.rejectedRanges !== undefined)
      this.rejectedRanges.length = 0;
    this.spacePoint = spacePoint.clone();
    this.minDistance = Number.MAX_VALUE;
    this.closestPointData = undefined;
    this._lastZ = 0.0;
    this.numCases++;
  }
  public static create(spacePoint: Point3d = Point3d.create(0, 0, 0), saveRanges: boolean = false): ClosestPointOnCurvesHandler {
    return new ClosestPointOnCurvesHandler(spacePoint.clone(), saveRanges);
  }
  public isRangeActive(range: Range3d): boolean {
    this.numRangeTest++;
    const b = range.distanceToPoint(this.spacePoint) < this.minDistance;
    if (b)
      this.activeRanges?.push(makeRangeForOutput(range, 0, 0, this._lastZ));
    else
      this.rejectedRanges?.push(makeRangeForOutput(range, 0, 0, this._lastZ));
    this._lastZ += 0.25;
    return b;
  }
  public override processAppData(item: CurvePrimitive): void {
    this.numCurveTest++;
    const cld = item.closestPoint(this.spacePoint, false);
    if (cld !== undefined && cld.a < this.minDistance) {
      this.minDistance = cld.a;
      this.closestPointData = cld;
    }
  }
}

class ClosestApproachBetweenPointClustersHandler extends TwoTreeSearchHandler<Point3d>{
  public minDistance: number;
  public closestPointInA?: Point3d;
  public closestPointInB?: Point3d;
  public acceptedPairs?: Point3d[][];
  public rejectedPairs?: Point3d[][];

  public numRangeTest;
  public numCurveTest;
  public numCases;

  private constructor(saveRanges: boolean) {
    super();
    this.minDistance = Number.MAX_VALUE;
    if (saveRanges) {
      this.acceptedPairs = [];
      this.rejectedPairs = [];
    } else {
      this.acceptedPairs = undefined;
      this.rejectedPairs = undefined;
    }
    this.numCases = 0;
    this.numCurveTest = 0;
    this.numRangeTest = 0;
  }
  public resetSearch() {
    if (this.acceptedPairs !== undefined)
      this.acceptedPairs.length = 0;
    if (this.rejectedPairs !== undefined)
      this.rejectedPairs.length = 0;
    this.minDistance = Number.MAX_VALUE;
    this.closestPointInA = undefined;
    this.closestPointInB = undefined;
    this.numCases++;
  }
  public static create(saveRanges: boolean = false): ClosestApproachBetweenPointClustersHandler {
    return new ClosestApproachBetweenPointClustersHandler(saveRanges);
  }
  public isRangePairActive(rangeA: Range3d, rangeB: Range3d): boolean {
    // const jRangeA = rangeA.toJSON();
    // const jRangeB = rangeB.toJSON();
    this.numRangeTest++;
    const b = rangeA.distanceToRange(rangeB) < this.minDistance;
    // eslint-disable-next-line no-console
    // console.log({ b, jRangeA, jRangeB });
    return b;
  }
  public override processAppDataPair(pointA: Point3d, pointB: Point3d): void {

    this.numCurveTest++;
    const d = pointA.distance(pointB);
    // eslint-disable-next-line no-console
    // console.log({ pointA, pointB, d });
    if (d < this.minDistance) {
      this.minDistance = d;
      this.closestPointInA = pointA.clone();
      this.closestPointInB = pointB.clone();
      if (this.acceptedPairs !== undefined)
        this.acceptedPairs.push([pointA.clone(), pointB.clone()]);
      // eslint-disable-next-line no-console
      // console.log({ minDistance: d });
    } else {
      if (this.rejectedPairs !== undefined)
        this.rejectedPairs.push([pointA.clone(), pointB.clone()]);
    }
  }
}

describe("IndexedRangeHeap", () => {
  it("PointSearchInGrid", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const points = Sample.createPoint2dLattice(0, 5, 100);
    const ranges: Range3d[] = [];
    const lines: CurvePrimitive[] = [];
    const x0 = 0;
    let y0 = 0;
    // vectors along edges.
    let dx = 0.35;
    let dy = 0.6;
    const bigStep = 200.0;
    for (let i = 0; i < points.length; i += 2) {
      const line = LineSegment3d.createXYXY(points[i].x, points[i].y, points[i].x + dx, points[i].y + dy);
      lines.push(line);
      ranges.push(line.range());
      const t = dx;
      dx = -dy;
      dy = t;
    }
    const rangeHeap = RangeTreeOps.createByIndexSplits<CurvePrimitive>(ranges, lines, 3, 2)!;
    for (const spacePoint of [Point3d.create(3.8, 2.5), Point3d.create(27.3, 9.5), Point3d.create(-8, bigStep * 0.45)]) {
      const handler = ClosestPointOnCurvesHandler.create(spacePoint, true)!;
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, spacePoint, 0.2, x0 + bigStep, y0);
      rangeHeap.searchTopDown(handler);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, handler.activeRanges, x0, y0);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, handler.rejectedRanges, x0 + bigStep, y0);
      if (handler.closestPointData !== undefined)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, handler.closestPointData.point], x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines, x0, y0);
      y0 += bigStep;
    }

    const path = BezierCurve3d.create([Point3d.create(3, 4), Point3d.create(4, 25), Point3d.create(20, 20), Point3d.create(40, 80)])!;
    const handlerB = ClosestPointOnCurvesHandler.create()!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
    for (let fraction = 0.0; fraction <= 1.0; fraction += 0.04) {
      const spacePoint = path.fractionToPoint(fraction);
      handlerB.resetSearch(spacePoint);
      rangeHeap.searchTopDown(handlerB);
      if (handlerB.closestPointData !== undefined) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, handlerB.closestPointData.point], x0, y0);
      }
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, spacePoint, 0.2, x0, y0);
    }
    const numQuadraticTests = lines.length * handlerB.numCases;

    // eslint-disable-next-line no-console
    console.log({
      numCases: handlerB.numCases,
      numRangeTest: handlerB.numRangeTest,
      numCurveTest: handlerB.numCurveTest,
      numQuadraticTests,
      testFraction: handlerB.numCurveTest / numQuadraticTests,
    });

    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointSearchInGrid");
    expect(ck.getNumErrors()).equals(0);
  });

  it.only("PointPointSearch", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let numCase = 0;
    for (const pointBFactor of [1, 4]) {
      for (const uz of [0, -3]) {
        // This array collects min-distance during a sequence of searches with differing tree structures.  They should all produce the same result!
        const distanceSequence: number[] = [];
        for (const treeFlare of [2, 4, 6]) {
          // a patch of a sphere, facing along the x axis
          const pointsA = Sample.createGridPointsOnEllipsoid(
            Transform.createRowValues(
              5, 0, 0, 0,
              0, 2, 0, 0,
              0, 0, 3, 0,
            ),
            6, 8,
            AngleSweep.createStartEndDegrees(-30, 30),
            AngleSweep.createStartEndDegrees(-40, 60),
          );
          // some
          // uz = 0 makes a patch of sphere somewhat above, to the right, and facing back at the one for pointsA.
          //    (close approach is near bottom of pointsB patch)
          // uz > 0 is moved downward and has its x axis tipped downward
          //    (close approach is nearer to middle of pointsB patch)

          const pointsB = Sample.createGridPointsOnEllipsoid(
            Transform.createRowValues(
              -1, -1, 0, 8,
              0, 2, 0.5, 1,
              -uz, 0, 2, 3 - 2 * uz,
            ),
            pointBFactor * 5, pointBFactor * 7,
            AngleSweep.createStartEndDegrees(-75, 120),
            AngleSweep.createStartEndDegrees(-40, 80),
          );

          const treeA = RangeTreeOps.createByIndexSplits<Point3d>(
            (xyz: Point3d): Range3d => { return Range3d.create(xyz); },
            pointsA,
            treeFlare, treeFlare)!;
          const treeB = RangeTreeOps.createByIndexSplits<Point3d>(
            (xyz: Point3d): Range3d => { return Range3d.create(xyz); },
            pointsB,
            treeFlare, treeFlare)!;
          ck.testExactNumber(pointsA.length, RangeTreeOps.getRecursiveAppDataCount<Point3d>(treeA), "point count in range tree");
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointsA, 0.05, x0, 0);

          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointsB, 0.05, x0, 0);
          const allRanges: Range3d[] = [];
          const rangeAccumulatorFunction = (node: RangeTreeNode<Point3d>): boolean => { allRanges.push(node.getRange()); return true; };
          treeA?.recurseIntoTree(rangeAccumulatorFunction);
          treeB?.recurseIntoTree(rangeAccumulatorFunction);
          if (numCase === 0) {
            GeometryCoreTestIO.captureRangeEdges(allGeometry, allRanges, x0, 10);
          }

          const handler = ClosestApproachBetweenPointClustersHandler.create(uz === 0);
          RangeTreeNode.searchTwoTreesTopDown(treeA, treeB, handler);
          if (handler.closestPointInA && handler.closestPointInB) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [handler.closestPointInA, handler.closestPointInB], x0, 0);
          }
          if (numCase === 0) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, handler.acceptedPairs, x0, 40);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, handler.rejectedPairs, x0, 80);
          }
          x0 += 20;
          //          const numQuadratic = pointsA.length * pointsB.length;
          //          console.log({ treeFlare, pointACount: pointsA.length, pointBCount: pointsB.length, quadraticCount: numQuadratic, treeTests: handler.numCurveTest, fraction: handler.numCurveTest / numQuadratic });
          numCase++;

          // compute a non-optimal minimum distance among a modest sample ...
          let dMin = Geometry.largeCoordinateResult;
          const stepA = 7;
          const stepB = 13;
          for (let i = 0; i < 20; i++) {
            const kA = Math.floor((i * stepA) % pointsA.length);
            const kB = Math.floor((i * stepB) % pointsB.length);
            dMin = Math.min(dMin, pointsA[kA].distance(pointsB[kB]));
          }
          const dMinAB = handler.minDistance;
          ck.testLE(dMinAB, dMin, "Full search min distance should be less than or equal to sampled min distance");
        }
        for (let i = 1; i < distanceSequence.length; i++)
          ck.testCoordinate(distanceSequence[0], distanceSequence[i], { distance0: distanceSequence[0], treeCase: i, distance: distanceSequence[i] });
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointPointSearch");
    expect(ck.getNumErrors()).equals(0);
  });

});
