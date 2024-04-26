/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { InterpolationCurve3d, InterpolationCurve3dOptions } from "../../bspline/InterpolationCurve3d";
import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry, PolygonLocation } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import {
  ConvexFacetLocationDetail, FacetLocationDetail, FacetLocationDetailPair, NonConvexFacetLocationDetail,
} from "../../polyface/FacetLocationDetail";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { LineString3dRangeTreeContext } from "../../polyface/RangeTree/LineString3dRangeTreeContext";
import { Point3dArrayRangeTreeContext } from "../../polyface/RangeTree/Point3dArrayRangeTreeContext";
import { PolyfaceRangeTreeContext } from "../../polyface/RangeTree/PolyfaceRangeTreeContext";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeSearchHandler } from "../../polyface/RangeTree/RangeTreeNode";
import { Sample } from "../../serialization/GeometrySamples";
import { LinearSweep } from "../../solid/LinearSweep";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// Clone and shift the range ...
// shift by dx and dy
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
    this.numRangeTest++;
    const b = rangeA.distanceToRange(rangeB) < this.minDistance;
    // const jRangeA = rangeA.toJSON();
    // const jRangeB = rangeB.toJSON();
    // GeometryCoreTestIO.consoleLog({ b, jRangeA, jRangeB });
    return b;
  }
  public override processAppDataPair(pointA: Point3d, pointB: Point3d): void {
    this.numCurveTest++;
    const d = pointA.distance(pointB);
    // GeometryCoreTestIO.consoleLog({ pointA, pointB, d });
    if (d < this.minDistance) {
      this.minDistance = d;
      this.closestPointInA = pointA.clone();
      this.closestPointInB = pointB.clone();
      if (this.acceptedPairs !== undefined)
        this.acceptedPairs.push([pointA.clone(), pointB.clone()]);
      // GeometryCoreTestIO.consoleLog({ minDistance: d });
    } else {
      if (this.rejectedPairs !== undefined)
        this.rejectedPairs.push([pointA.clone(), pointB.clone()]);
    }
  }
}

describe("IndexedRangeHeap", () => {
  it("ClosestLineStringSearch", () => {
    const ck = new Checker();
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
    const rangeHeap = RangeTreeOps.createByIndexSplits<CurvePrimitive>(ranges, lines, lines.length, 3, 2)!;
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

    ck.show({
      numCases: handlerB.numCases,
      numRangeTest: handlerB.numRangeTest,
      numCurveTest: handlerB.numCurveTest,
      numQuadraticTests,
      testFraction: handlerB.numCurveTest / numQuadraticTests,
    });

    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "ClosestLineStringSearch");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PointPointSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let numCase = 0;
    for (const pointBFactor of [1, 4]) {
      for (const uz of [0, -3]) {
        const distanceSequence: number[] = [];  // min-distance for a sequence of searches with differing tree structures. They should all produce the same result!
        for (const treeFlare of [2, 4, 6]) {
          // a patch of a sphere, facing along the x axis
          const pointsA = Sample.createGridPointsOnEllipsoid(
            Transform.createRowValues(
              5, 0, 0, 0,
              0, 2, 0, 0,
              0, 0, 3, 0,
            ),
            6, 8,
            AngleSweep.createStartEndDegrees(-40, 60),
            AngleSweep.createStartEndDegrees(-30, 30),
          );
          // uz = 0 makes a patch of sphere somewhat above, to the right, and facing back at the one for pointsA.
          //    (close approach is near bottom of pointsB patch)
          // uz > 0 is moved downward and has its x axis tipped downward
          //    (close approach is nearer to middle of pointsB patch)

          const pointsB = Sample.createGridPointsOnEllipsoid(
            Transform.createRowValues(
              -1, -1, 0, 8,
              0, 2, 0.5, 1,
              -uz, 0, 2, 3 + 1.3 * uz,
            ),
            pointBFactor * 5, pointBFactor * 7,
            AngleSweep.createStartEndDegrees(-40, 80),
            AngleSweep.createStartEndDegrees(-75, 120),
          );

          const treeA = RangeTreeOps.createByIndexSplits<Point3d>(
            ((index: number): Range3d => { return Range3d.create(pointsA[index]); }),
            pointsA,
            pointsA.length,
            treeFlare, treeFlare)!;
          const treeB = RangeTreeOps.createByIndexSplits<Point3d>(
            ((index: number): Range3d => { return Range3d.create(pointsB[index]); }),
            pointsB,
            pointsB.length,
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
          distanceSequence.push(dMinAB);
        }
        for (let i = 1; i < distanceSequence.length; i++)
          ck.testCoordinate(distanceSequence[0], distanceSequence[i], { distance0: distanceSequence[0], treeCase: i, distance: distanceSequence[i] });
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointPointSearch");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PointCloudMultiSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const z0 = 0;

    const pointsA = Sample.createGridPointsOnEllipsoid(
      Transform.createRowValues(
        5, 0, 0, 0,
        0, 2, 0, 0,
        0, 0, 3, 0,
      ),
      36, 52,
      AngleSweep.createStartEndDegrees(-40, 60),
      AngleSweep.createStartEndDegrees(-30, 195),
    );

    const path = BezierCurve3d.create([Point3d.create(6, 0, 0), Point3d.create(3, 3, 1), Point3d.create(0, 8, 5), Point3d.create(-1, -6, -2)])!;
    const distanceSequence: number[][] = [];  // min-distance for a sequence of searches with differing tree structures. They should all produce the same result!
    let numCase = 0;

    for (const treeWidth of [2, 4, 8]) {
      y0 = 0;
      for (const numResultsPerLeaf of [treeWidth, 1]) {
        distanceSequence.push([]);
        const searcher = Point3dArrayRangeTreeContext.createCapture(pointsA, treeWidth, numResultsPerLeaf);
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointsA, 0.02, x0, y0, z0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z0);
        if (ck.testType(searcher, Point3dArrayRangeTreeContext)) {
          for (let u = 0; u <= 0.999999999; u += 0.025) {
            const xyz = path.fractionToPoint(u);
            const cld = searcher.searchForClosestPoint(xyz);
            if (ck.testType(cld, CurveLocationDetail)) {
              const xyz1 = cld.point;
              if (ck.testType(xyz1, Point3d))
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, xyz1], x0, y0, z0);
              if (ck.testCoordinate(xyz1.distance(xyz), cld.a, "cld.a corresponds to distance from cld.point"))
                distanceSequence[numCase].push(cld.a);
            }
          }
          ck.show({
            treeWidth,
            numResultsPerLeaf,
            numRangeTestTrue: searcher.numRangeTestTrue,
            numRangeTestFalse: searcher.numRangeTestFalse,
            numPointTest: searcher.numPointTest,
            searches: searcher.numSearch,
            searchesTimesPoints: searcher.numSearch * pointsA.length,
            fraction: searcher.numPointTest / (searcher.numSearch * pointsA.length),
          });
        }
        y0 += 15;
        numCase++;
      }
      x0 += 15;
    }
    const numSearchesPerCase = distanceSequence[0].length;
    for (let i = 1; i < distanceSequence.length; i++)
      for (let j = 0; j < numSearchesPerCase; j++)
        if (ck.testExactNumber(numSearchesPerCase, distanceSequence[i].length, "same number of searches per test case"))
          ck.testExactNumber(distanceSequence[0][j], distanceSequence[i][j], { distance0J: distanceSequence[0][j], i, j, distanceIJ: distanceSequence[i][j] });

    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointCloudMultiSearch");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PointCloudMultiSearch1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const z0 = 0;

    const pointsA = Sample.createGridPointsOnEllipsoid(
      Transform.createRowValues(
        5, 0, 0, 0,
        0, 2, 0, 0,
        0, 0, 3, 0,
      ),
      36, 52,
      AngleSweep.createStartEndDegrees(-40, 60),
      AngleSweep.createStartEndDegrees(-30, 195),
    );

    const path = BezierCurve3d.create([Point3d.create(6, 0, 0), Point3d.create(3, 3, 1), Point3d.create(0, 8, 5), Point3d.create(-1, -6, -2)])!;

    // test and cover the trigger arrays
    const context = Point3dArrayRangeTreeContext.createCapture(pointsA);
    if (ck.testType(context, Point3dArrayRangeTreeContext)) {
      y0 = 0;
      for (const maxDist of [5.6, 3, 1]) { // largest min dist is 5.51
        let numSingleton = 0;
        let numArray = 0;
        for (let u = 0; u <= 0.999999999; u += 0.025) {
          const xyz = path.fractionToPoint(u);
          const result = context.searchForClosestPoint(xyz, maxDist);
          if (ck.testDefined(result, "search with maxDist found closest point or close points")) {
            if (Array.isArray(result)) {
              ck.testTrue(result.length > 1, "array is only returned when > 1 points are found within trigger distance");
              ++numArray;
              const minCld = context.searchForClosestPoint(xyz)! as CurveLocationDetail;
              let minArrayDist = maxDist;
              const closestArrayPt = Point3d.createZero();
              for (const cld of result) {
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, cld.point], x0, y0, z0);
                ck.testLE(cld.a, maxDist, "values in saved array do not exceed the trigger");
                ck.testLE(minCld.a, cld.a, "values in saved array are not closer than closest point");
                if (cld.a < minArrayDist) {
                  minArrayDist = cld.a;
                  closestArrayPt.setFrom(cld.point);
                }
              }
              ck.testPoint3d(minCld.point, closestArrayPt, "closest point found in saved array");
            } else if (ck.testType(result, CurveLocationDetail)) {
              GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, xyz, 0.1, x0, y0, z0);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, result.point], x0, y0, z0);
              ++numSingleton;
            }
          }
        }
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointsA, 0.02, x0, y0, z0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z0);
        ck.show({ numArray, numSingleton });
        y0 += 10;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointCloudMultiSearch1");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolylineMultiSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const z0 = 0;

    const wavePoints = Sample.createSquareWave(Point3d.create(0, 0, 0), 0.8, 1.1, 0.4, 95, 0);
    const linestring = LineString3d.create(wavePoints);
    const path = BezierCurve3d.create([Point3d.create(-1, 5, 0), Point3d.create(10, 3, 8), Point3d.create(80, 12, 5), Point3d.create(120, -6, -2)])!;

    for (const treeWidth of [2]) {
      const searcher = LineString3dRangeTreeContext.createCapture(linestring, treeWidth, treeWidth);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, wavePoints, x0, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z0);
      if (ck.testType(searcher, LineString3dRangeTreeContext)) {
        for (let u = 0; u <= 1.00001; u += 0.010) {
          const xyz = path.fractionToPoint(u);
          const cld = searcher.searchForClosestPoint(xyz);
          if (ck.testType(cld, CurveLocationDetail)) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, cld.point], x0, y0, z0);
            ck.testCoordinate(cld.a, xyz.distance(cld.point), "cld.a corresponds to distance from cld.point");
            if (ck.testType(cld.childDetail, CurveLocationDetail, "child detail recorded") && cld.childDetail) {
              const segmentIndex = cld.childDetail.a;
              const localFraction = cld.childDetail.fraction;
              if (ck.testType(cld.curve, LineString3d, "cld.curve defined") && cld.curve) {
                ck.testPoint3d(cld.point, cld.curve.fractionToPoint(cld.fraction), "cld.fraction is global linestring param");
                ck.testCoordinate(cld.fraction, cld.curve.segmentIndexAndLocalFractionToGlobalFraction(segmentIndex, localFraction), "cld.childDetail has segment index and param");
              }
              const i1 = Math.min(segmentIndex + 4, wavePoints.length);
              for (let i = Math.max(segmentIndex - 4, 0); i < i1; i++)
                ck.testLE(cld.a, xyz.distance(wavePoints[i]), "computed point is at minimum distance locally");
            }
          }
        }
        ck.show({
          numPoints: wavePoints.length,
          treeWidth,
          numRangeTestTrue: searcher.numRangeTestTrue,
          numRangeTestFalse: searcher.numRangeTestFalse,
          numPointTest: searcher.numPointTest,
          searches: searcher.numSearch,
          searchesTimesPoints: searcher.numSearch * wavePoints.length,
          fraction: searcher.numPointTest / (searcher.numSearch * wavePoints.length),
        });
        y0 += 10;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolylineMultiSearch");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolylineMultiSearch1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const z0 = 0;

    const wavePoints = Sample.createSquareWave(Point3d.create(0, 0, 0), 0.8, 1.1, 0.4, 95, 0);
    const linestring = LineString3d.create(wavePoints);
    const path = BezierCurve3d.create([Point3d.create(-1, 5, 0), Point3d.create(10, 3, 8), Point3d.create(80, 12, 5), Point3d.create(120, -6, -2)])!;

    // test and cover the trigger arrays
    const context = LineString3dRangeTreeContext.createCapture(linestring);
    if (ck.testType(context, LineString3dRangeTreeContext)) {
      for (const maxDist of [8.5, 7, 5.5]) { // largest min dist is 8
        let numSingleton = 0;
        let numArray = 0;
        for (let u = 0; u <= 1.00001; u += 0.010) {
          const xyz = path.fractionToPoint(u);
          const result = context.searchForClosestPoint(xyz, maxDist);
          if (ck.testDefined(result, "search with maxDist found closest point or close points")) {
            if (Array.isArray(result)) {
              ck.testTrue(result.length > 1, "array is only returned when > 1 points are found within trigger distance");
              ++numArray;
              const minCld = context.searchForClosestPoint(xyz)! as CurveLocationDetail;
              let minArrayDist = maxDist;
              const closestArrayPt = Point3d.createZero();
              for (const cld of result) {
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, cld.point], x0, y0, z0);
                ck.testLE(cld.a, maxDist, "values in saved array do not exceed the trigger");
                ck.testLE(minCld.a, cld.a, "values in saved array are not closer than closest point");
                if (cld.a < minArrayDist) {
                  minArrayDist = cld.a;
                  closestArrayPt.setFrom(cld.point);
                }
              }
              ck.testPoint3d(minCld.point, closestArrayPt, "closest point found in saved array");
            } else if (ck.testType(result, CurveLocationDetail)) {
              GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, xyz, 0.3, x0, y0, z0);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, result.point], x0, y0, z0);
              ++numSingleton;
            }
          }
        }
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [linestring, path], x0, y0, z0);
        ck.show({ numArray, numSingleton });
        y0 += 10;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolylineMultiSearch1");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolyfaceMultiSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const z0 = 0;
    const strokeOptions = StrokeOptions.createForFacets();
    strokeOptions.shouldTriangulate = true;
    /*
    // output the 4 distinct components of the Franke surface . . .
    for (const termSelect of [0x01, 0x02, 0x04, 0x08]) {
      const surface = Sample.createMeshFromFrankeSurface(25, strokeOptions, termSelect);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, surface, x0, y0, z0);
      x0 += 2;
    }
    */
    // Franke surface is ..
    // range [0,1] in both directions
    // very non-planar quads -- definitely need to triangulate!!
    // frankeSize 5 is pretty minimal
    //             10 looks good for lots of tests.
    const frankeSize = 20;
    const polyface = Sample.createMeshFromFrankeSurface(frankeSize, strokeOptions)!;
    const path = BezierCurve3d.create([Point3d.create(0, 0, 1), Point3d.create(1.6, 0, 0.2), Point3d.create(1, 0.5, 0.5), Point3d.create(0, 1, 0.5)])!;

    for (const treeWidth of [2, 4, 8]) {
      const visitor = polyface.createVisitor(0);
      const searcher = PolyfaceRangeTreeContext.createCapture(visitor, treeWidth, treeWidth, true);
      if (ck.testType(searcher, PolyfaceRangeTreeContext)) {
        x0 = 0;
        for (const searchInterior of [false, true]) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polyface, path], x0, y0, z0);
          for (let u = 0; u <= 1.00001; u += 0.010) {
            const xyz = path.fractionToPoint(u);
            const fld = searcher.searchForClosestPoint(xyz, undefined, searchInterior);
            if (ck.testType(fld, ConvexFacetLocationDetail)) {
              const closestPoint = fld.point;
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, closestPoint], x0, y0, z0);
              const distance = fld.a;
              for (let i = 0; i < polyface.data.point.length; i += 7) {
                const di = polyface.data.point.distanceIndexToPoint(i, xyz)!;
                ck.testLE(distance, di);
              }
            }
          }
          x0 += 2;
        }
        const numFacets = polyface.facetCount;
        const searchesTimesFacets = searcher.numSearch * numFacets;
        ck.show({
          frankeSize,
          numFacets: polyface.facetCount,
          treeWidth,
          numRangeTestTrue: searcher.numRangeTestTrue, numRangeTestFalse: searcher.numRangeTestFalse, numPointTest: searcher.numFacetTest,
          searches: searcher.numSearch,
          searchesTimesPoints: searchesTimesFacets,
          fraction: searcher.numFacetTest / searchesTimesFacets,
        });
        y0 += 2;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfaceMultiSearch");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfaceMultiSearch1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const strokeOptions = StrokeOptions.createForFacets();
    strokeOptions.shouldTriangulate = true;
    const frankeSize = 20;
    const polyface = Sample.createMeshFromFrankeSurface(frankeSize, strokeOptions)!;
    const path = BezierCurve3d.create([Point3d.create(0, 0, 1), Point3d.create(1.6, 0, 0.2), Point3d.create(1, 0.5, 0.5), Point3d.create(0, 1, 0.5)])!;

    // test and cover the trigger arrays
    const context = PolyfaceRangeTreeContext.createCapture(polyface, undefined, undefined, true);
    if (ck.testType(context, PolyfaceRangeTreeContext)) {
      for (const maxDist of [.27, 0.2, 0.05] ) { // largest min dist is 0.2574
        let numSingleton = 0;
        let numArray = 0;
        for (let u = 0; u <= 1.00001; u += 0.05) {
          const xyz = path.fractionToPoint(u);
          const result = context.searchForClosestPoint(xyz, maxDist, true);
          if (ck.testDefined(result, "search with maxDist found closest point or close points") && result) {
            if (Array.isArray(result)) {
              ck.testTrue(result.length > 1, "array is only returned when > 1 points are found within trigger distance");
              ++numArray;
              const minFld = context.searchForClosestPoint(xyz, undefined, true)! as FacetLocationDetail;
              let minArrayDist = maxDist;
              const closestArrayPt = Point3d.createZero();
              for (const fld of result) {
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, fld.point], x0, y0, z0);
                ck.testLE(fld.a, maxDist, "values in saved array do not exceed the trigger");
                ck.testLE(minFld.a, fld.a, "values in saved array are not closer than closest point");
                if (fld.a < minArrayDist) {
                  minArrayDist = fld.a;
                  closestArrayPt.setFrom(fld.point);
                }
              }
              ck.testPoint3d(minFld.point, closestArrayPt, "closest point found in saved array");
            } else {
              GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, xyz, 0.03, x0, y0, z0);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, result.point], x0, y0, z0);
              ++numSingleton;
            }
          }
        }
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polyface, path], x0, y0, z0);
        ck.show({numArray, numSingleton});
        x0 += 2;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfaceMultiSearch1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfaceMultiSearch2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const z0 = 0;

    // test and cover convex/nonconvex facets
    const dartPoints = [Point3d.createZero(), Point3d.create(2, 1), Point3d.create(0.5, 0.5), Point3d.create(1, 2)];
    const sweepHeight = 3;
    const sweptDart = LinearSweep.createZSweep(dartPoints, 0, sweepHeight, true);
    if (ck.testType(sweptDart, LinearSweep, "created swept dart solid")) {
      const builder = PolyfaceBuilder.create();
      builder.addLinearSweep(sweptDart);
      let polyface1 = builder.claimPolyface();
      if (ck.testType(polyface1, IndexedPolyface)) {
        const xyScale = 1.5;
        const translation = Point3d.create(0.75, 0.75, -1);
        let helixPts = Sample.createHelixPoints(5, 60, Transform.createRowValues(xyScale, 0, 0, translation.x, 0, xyScale, 0, translation.y, 0, 0, 1, translation.z));
        helixPts = [Point3d.create(0.25, 0.25, -1), ...helixPts, Point3d.create(0.45, 0.45, sweepHeight + 1)];
        const curveOptions = InterpolationCurve3dOptions.create({ fitPoints: helixPts });
        const helix = InterpolationCurve3d.create(curveOptions);
        if (ck.testType(helix, InterpolationCurve3d, "created helical interpolation curve")) {
          let convexHits = 0;
          let nonConvexHits = 0;
          for (const convexFacets of [true, false]) {
            if (!convexFacets)
              polyface1 = PolyfaceQuery.cloneWithMaximalPlanarFacets(polyface1)!;  // non-convex top and bottom facets!
            const context1 = PolyfaceRangeTreeContext.createCapture(polyface1, undefined, undefined, convexFacets);
            if (ck.testType(context1, PolyfaceRangeTreeContext)) {
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polyface1, helix], x0, y0, z0);
              let insideToEdge = 0;
              let insideToVertex = 0;
              let onEdge = 0;
              let onVertex = 0;
              let numAttempts = 0;
              for (let u = 0; u <= 1.00001; u += 0.05) {
                ++numAttempts;
                const xyz = helix.fractionToPoint(u);
                const fld = context1.searchForClosestPoint(xyz, undefined, true);
                if (ck.testDefined(fld, "search found closest point") && fld && !Array.isArray(fld)) {
                  if (fld.isConvex)
                    ++convexHits;
                  else
                    ++nonConvexHits;
                  if (fld.classify === PolygonLocation.InsidePolygonProjectsToEdgeInterior)
                    ++insideToEdge;
                  else if (fld.classify === PolygonLocation.InsidePolygonProjectsToVertex)
                    ++insideToVertex;
                  else if (fld.classify === PolygonLocation.OnPolygonEdgeInterior)
                    ++onEdge;
                  else if (fld.classify === PolygonLocation.OnPolygonVertex)
                    ++onVertex;
                  GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, fld.point], x0, y0, z0);
                }
              }
              if (convexFacets) {
                ck.testExactNumber(numAttempts, convexHits, "all hits convex");
                ck.testExactNumber(6, insideToEdge);
                ck.testExactNumber(0, insideToVertex);
                ck.testExactNumber(11, onEdge);
                ck.testExactNumber(4, onVertex);
              } else {
                ck.testExactNumber(numAttempts, nonConvexHits, "all hits nonconvex");
                ck.testExactNumber(7, insideToEdge);
                ck.testExactNumber(1, insideToVertex, "helix end projects just inside top face concave sector");
                ck.testExactNumber(9, onEdge);
                ck.testExactNumber(4, onVertex);
              }
            }
            x0 += 5;
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfaceMultiSearch2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfacePolyfaceSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const strokeOptions = StrokeOptions.createForFacets();
    strokeOptions.shouldTriangulate = true;
    const frankeSizeA = 12;
    const frankeSizeB = 6;
    const polyfaceA = Sample.createMeshFromFrankeSurface(frankeSizeA, strokeOptions, [0.5, 0.5, 0.5, 1])!;
    const polyfaceB = Sample.createMeshFromFrankeSurface(frankeSizeB, strokeOptions, [0, 0, 0, 4])!;
    const transform = Transform.createRowValues(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 1.5,
    );
    polyfaceB.tryTransformInPlace(transform);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x0, y0, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceB, x0, y0, z0);

    const contextA = PolyfaceRangeTreeContext.createCapture(polyfaceA.createVisitor(), 3, 3, true)!;
    const contextB = PolyfaceRangeTreeContext.createCapture(polyfaceB.createVisitor(), 3, 3, true)!;
    const approach = PolyfaceRangeTreeContext.searchForClosestApproach(contextA, contextB);
    if (ck.testType(approach, FacetLocationDetailPair)) {
      ck.testType(approach.detailA, ConvexFacetLocationDetail);
      ck.testType(approach.detailB, ConvexFacetLocationDetail);
      ck.testExactNumber(approach.detailA.a, approach.detailB.a, "recorded min dist is the same in both details");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approach.detailA.point, approach.detailB.point], x0, y0, z0);
    }
    const numFacetA = polyfaceA.facetCount;
    const numFacetB = polyfaceB.facetCount;
    ck.show({
      numRangeTestFalse: contextA.numRangeTestFalse,
      numRangeTestTrue: contextA.numRangeTestTrue,
      numLeafTest: contextA.numFacetTest,
      numFacetTimeNumFacet: numFacetA * numFacetB,
      testFraction: contextA.numFacetTest / (numFacetA * numFacetB),
    });
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfacePolyfaceSearch");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfacePolyfaceSearch1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const frankeSizeA = 30;
    const frankeSizeB = 60;
    const polyfaceA = Sample.createMeshFromFrankeSurface(frankeSizeA, undefined, [0.5, 0.5, 0.5, 1])!;
    const polyfaceB = Sample.createMeshFromFrankeSurface(frankeSizeB, undefined, [0, 0, 0, 4])!;
    const transform = Transform.createRowValues(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 1.5,
    );
    polyfaceB.tryTransformInPlace(transform);
    const contextA = PolyfaceRangeTreeContext.createCapture(polyfaceA.createVisitor(), 3, 3)!;
    const contextB = PolyfaceRangeTreeContext.createCapture(polyfaceB.createVisitor(), 3, 3)!;

    let numSingleton = 0;
    let numArray = 0;
    for (const maxDist of [0.6, 0.53, 0.4] ) { // min dist is ~0.52
      const result = PolyfaceRangeTreeContext.searchForClosestApproach(contextA, contextB, maxDist);
      if (ck.testDefined(result, "two-tree search with maxDist succeeded") && result) {
        if (Array.isArray(result)) {
          ck.testTrue(result.length > 1, "array is only returned when > 1 points are found within trigger distance");
          ++numArray;
          const minFld = PolyfaceRangeTreeContext.searchForClosestApproach(contextA, contextB)! as FacetLocationDetailPair;
          let minArrayDist = maxDist;
          const closestArrayPtA = Point3d.createZero();
          const closestArrayPtB = Point3d.createZero();
          for (const fld of result) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [fld.detailA.point, fld.detailB.point], x0);
            ck.testExactNumber(fld.detailA.a, fld.detailB.a, "recorded min dist is the same in both details");
            ck.testType(fld.detailA, NonConvexFacetLocationDetail);
            ck.testType(fld.detailB, NonConvexFacetLocationDetail);
            ck.testLE(fld.detailA.a, maxDist, "values in saved array do not exceed the trigger");
            ck.testLE(minFld.detailA.a, fld.detailA.a, "values in saved array are not closer than closest point");
            if (fld.detailA.a < minArrayDist) {
              minArrayDist = fld.detailA.a;
              closestArrayPtA.setFrom(fld.detailA.point);
              closestArrayPtB.setFrom(fld.detailB.point);
            }
          }
          ck.testPoint3d(minFld.detailA.point, closestArrayPtA, "closest point found in saved array for input A");
          ck.testPoint3d(minFld.detailB.point, closestArrayPtB, "closest point found in saved array for input B");
        } else {
          ck.testLE(maxDist, result.detailA.a, "singleton result expected when maxDist doesn't exceed min dist");
          ck.testType(result.detailA, NonConvexFacetLocationDetail);
          ck.testType(result.detailB, NonConvexFacetLocationDetail);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [result.detailA.point, result.detailB.point], x0);
          ++numSingleton;
        }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polyfaceA, polyfaceB], x0);
      x0 += 3;
      }
    }
    ck.show({numArray, numSingleton});
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfacePolyfaceSearch1");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolylinePolylineSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const pointsA = Sample.createHelixPoints(5.0, 129,
      Transform.createRowValues(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 3, 0,
      ));
    const pointsB = Sample.createHelixPoints(9.0, 257,
      Transform.createRowValues(
        2, 0, -2, 5,
        0, 2, 0, 0,
        1, 0.1, 1, 0,
      ));
    const treeWidth = 3;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, x0, y0, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsB, x0, y0, z0);

    const contextA = LineString3dRangeTreeContext.createCapture(pointsA, treeWidth, treeWidth)!;
    const contextB = LineString3dRangeTreeContext.createCapture(pointsB, treeWidth, treeWidth)!;
    const polylineApproach = LineString3dRangeTreeContext.searchForClosestApproach(contextA, contextB);
    if (ck.testType(polylineApproach, CurveLocationDetailPair))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polylineApproach.detailA.point, polylineApproach.detailB.point], x0, y0, z0);

    // test and cover the trigger arrays
    let numSingleton = 0;
    let numArray = 0;
    for (const maxDist of [0.5, 0.1, 0.02] ) { // min dist is ~0.025
      x0 += 20;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointsA, pointsB], x0);
      const result = LineString3dRangeTreeContext.searchForClosestApproach(contextA, contextB, maxDist);
      if (ck.testDefined(result, "two-tree search with maxDist succeeded") && result) {
        if (Array.isArray(result)) {
          ck.testTrue(result.length > 1, "array is only returned when > 1 points are found within trigger distance");
          ++numArray;
          const minCld = polylineApproach as CurveLocationDetailPair;
          let minArrayDist = maxDist;
          const closestArrayPtA = Point3d.createZero();
          const closestArrayPtB = Point3d.createZero();
          for (const cld of result) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [cld.detailA.point, cld.detailB.point], x0);
            ck.testExactNumber(cld.detailA.a, cld.detailB.a, "recorded min dist is the same in both details");
            ck.testLE(cld.detailA.a, maxDist, "values in saved array do not exceed the trigger");
            ck.testLE(minCld.detailA.a, cld.detailA.a, "values in saved array are not closer than closest point");
            if (cld.detailA.a < minArrayDist) {
              minArrayDist = cld.detailA.a;
              closestArrayPtA.setFrom(cld.detailA.point);
              closestArrayPtB.setFrom(cld.detailB.point);
            }
          }
          ck.testPoint3d(minCld.detailA.point, closestArrayPtA, "closest point found in saved array for input A");
          ck.testPoint3d(minCld.detailB.point, closestArrayPtB, "closest point found in saved array for input B");
        } else {
          ck.testLE(maxDist, result.detailA.a, "singleton result expected when maxDist doesn't exceed min dist");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [result.detailA.point, result.detailB.point], x0);
          ++numSingleton;
        }
      }
    }
    ck.show({numArray, numSingleton});

    x0 += 20;
    const shiftB = Transform.createTranslationXYZ(0, 3, 4);
    shiftB.multiplyPoint3dArrayInPlace(pointsB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, x0, y0, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsB, x0, y0, z0);

    const contextA1 = Point3dArrayRangeTreeContext.createCapture(pointsA, treeWidth, treeWidth)!;
    const contextB1 = Point3dArrayRangeTreeContext.createCapture(pointsB, treeWidth, treeWidth)!;
    const approach1 = Point3dArrayRangeTreeContext.searchForClosestApproach(contextA1, contextB1);
    if (ck.testType(approach1, CurveLocationDetailPair))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approach1.detailA.point, approach1.detailB.point], x0, y0, z0);

    // test and cover the trigger arrays
    numSingleton = 0;
    numArray = 0;
    for (const maxDist of [0.5, 0.2, 0.02] ) { // min dist is ~0.13
      x0 += 20;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointsA, pointsB], x0);
      const result = Point3dArrayRangeTreeContext.searchForClosestApproach(contextA1, contextB1, maxDist);
      if (ck.testDefined(result, "two-tree search with maxDist succeeded") && result) {
        if (Array.isArray(result)) {
          ck.testTrue(result.length > 1, "array is only returned when > 1 points are found within trigger distance");
          ++numArray;
          const minCld = approach1 as CurveLocationDetailPair;
          let minArrayDist = maxDist;
          const closestArrayPtA = Point3d.createZero();
          const closestArrayPtB = Point3d.createZero();
          for (const cld of result) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [cld.detailA.point, cld.detailB.point], x0);
            ck.testExactNumber(cld.detailA.a, cld.detailB.a, "recorded min dist is the same in both details");
            ck.testLE(cld.detailA.a, maxDist, "values in saved array do not exceed the trigger");
            ck.testLE(minCld.detailA.a, cld.detailA.a, "values in saved array are not closer than closest point");
            if (cld.detailA.a < minArrayDist) {
              minArrayDist = cld.detailA.a;
              closestArrayPtA.setFrom(cld.detailA.point);
              closestArrayPtB.setFrom(cld.detailB.point);
            }
          }
          ck.testPoint3d(minCld.detailA.point, closestArrayPtA, "closest point found in saved array for input A");
          ck.testPoint3d(minCld.detailB.point, closestArrayPtB, "closest point found in saved array for input B");
        } else {
          ck.testLE(maxDist, result.detailA.a, "singleton result expected when maxDist doesn't exceed min dist");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [result.detailA.point, result.detailB.point], x0);
          ++numSingleton;
        }
      }
    }
    ck.show({numArray, numSingleton});

    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolylinePolylineSearch");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolyfaceRoundtrip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const polyface = Sample.createMeshFromFrankeSurface(50)!;
    const graph = PolyfaceQuery.convertToHalfEdgeGraph(polyface); // coverage
    const builder = PolyfaceBuilder.create();
    builder.addGraph(graph);
    const polyface1 = builder.claimPolyface();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polyface, polyface1]);
    ck.testExactNumber(polyface.facetCount, 2500, "expected number facets");
    ck.testExactNumber(polyface.facetCount, polyface1.facetCount, "roundtrip thru graph preserves facets");

    const contextA = PolyfaceRangeTreeContext.createCapture(polyface.createVisitor())!;
    const contextB = PolyfaceRangeTreeContext.createCapture(polyface1.createVisitor())!;
    const approach = PolyfaceRangeTreeContext.searchForClosestApproach(contextA, contextB);
    if (ck.testType(approach, FacetLocationDetailPair)) {
      ck.testType(approach.detailA, NonConvexFacetLocationDetail);
      ck.testType(approach.detailB, NonConvexFacetLocationDetail);
      ck.testCoordinate(approach.detailA.a, 0, "expect no gap between mesh and its roundtrip");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approach.detailA.point, approach.detailB.point]);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfaceRoundTrip");
    expect(ck.getNumErrors()).equals(0);
  });
});
