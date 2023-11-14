/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { LineString3dRangeTreeContext } from "../../polyface/RangeTree/LineString3dRangeTreeContext";
import { Point3dArrayRangeTreeContext } from "../../polyface/RangeTree/Point3dArrayRangeTreeContext";
import { PolyfaceRangeTreeContext } from "../../polyface/RangeTree/PolyfaceRangeTreeContext";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeSearchHandler } from "../../polyface/RangeTree/RangeTreeNode";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

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

    // eslint-disable-next-line no-console
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
              -uz, 0, 2, 3 + 1.3 * uz,
            ),
            pointBFactor * 5, pointBFactor * 7,
            AngleSweep.createStartEndDegrees(-75, 120),
            AngleSweep.createStartEndDegrees(-40, 80),
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
    const y0 = 0;
    const z0 = 0;

    const pointsA = Sample.createGridPointsOnEllipsoid(
      Transform.createRowValues(
        5, 0, 0, 0,
        0, 2, 0, 0,
        0, 0, 3, 0,
      ),
      36, 52,
      AngleSweep.createStartEndDegrees(-30, 195),
      AngleSweep.createStartEndDegrees(-40, 60),
    );

    const path = BezierCurve3d.create([Point3d.create(6, 0, 0), Point3d.create(3, 3, 1), Point3d.create(0, 8, 5), Point3d.create(-1, -6, -2)])!;

    for (const treeWidth of [2, 4, 8]) {
      const searcher = Point3dArrayRangeTreeContext.createCapture(pointsA, treeWidth, treeWidth);
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointsA, 0.02, x0, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z0);
      if (ck.testType(searcher, Point3dArrayRangeTreeContext)) {
        for (let u = 0; u <= 0.999999999; u += 0.025) {
          const xyz = path.fractionToPoint(u);
          const cld = searcher.searchForClosestPoint(xyz);
          if (ck.testType(cld, CurveLocationDetail)) {
            const xyz1 = cld.point;
            if (ck.testType(xyz1, Point3d)) {
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, xyz1], x0, y0, z0);
            }
          }
        }
        ck.show({
          treeWidth,
          numRangeTestTrue: searcher.numRangeTestTrue, numRangeTestFalse: searcher.numRangeTestFalse, numPointTest: searcher.numPointTest,
          searches: searcher.numSearch,
          searchesTimesPoints: searcher.numSearch * pointsA.length,
          fraction: searcher.numPointTest / (searcher.numSearch * pointsA.length),
        });
      }
      x0 += 100;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointPointSearch");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolylineMultiSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const z0 = 0;

    const wavePoints = Sample.createSquareWave(Point3d.create(0, 0, 0), 0.8, 1.1, 0.4, 95, 0);
    const path = BezierCurve3d.create([Point3d.create(-1, 5, 0), Point3d.create(10, 3, 8), Point3d.create(80, 12, 5), Point3d.create(120, -6, -2)])!;
    for (const treeWidth of [2]) {
      const linestring = LineString3d.create(wavePoints);
      const searcher = LineString3dRangeTreeContext.createCapture(linestring, treeWidth, treeWidth);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, wavePoints, x0, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z0);
      if (ck.testType(searcher, LineString3dRangeTreeContext)) {
        for (let u = 0; u <= 1.00001; u += 0.010) {
          const xyz = path.fractionToPoint(u);
          searcher.searchForClosestPoint(xyz);
          const cld = searcher.closestPoint;
          if (ck.testType(cld, CurveLocationDetail)) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, cld.point], x0, y0, z0);
            const distance = xyz.distance(cld.point);
            const indexAndFraction = linestring.globalFractionToSegmentIndexAndLocalFraction(cld.fraction);
            const segmentIndex = indexAndFraction.index;
            // const segmentFraction = indexAndFraction.fraction;

            const i1 = Math.min(segmentIndex + 4, wavePoints.length);
            for (let i = Math.max(segmentIndex - 4, 0); i < i1; i++) {
              ck.testLE(distance, xyz.distance(wavePoints[i]));
            }
          }
        }
        ck.show({
          numPoints: wavePoints.length,
          treeWidth,
          numRangeTestTrue: searcher.numRangeTestTrue, numRangeTestFalse: searcher.numRangeTestFalse, numPointTest: searcher.numPointTest,
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

  it("PolyfaceMultiSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
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
    for (const treeWidth of [2, 4, 8]) {
      // Franke surface is ..
      // range [0,1] in both directions
      // very non-planar quads -- definitely need to triangulate!!
      // frankelSize 5 is pretty minimal
      //             10 looks good for lots of tests.
      const frankelSize = 20;
      const polyface = Sample.createMeshFromFrankeSurface(frankelSize, strokeOptions)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0, z0);
      const path = BezierCurve3d.create([Point3d.create(0, 0, 1), Point3d.create(1.6, 0, 0.2), Point3d.create(1, 0.5, 0.5), Point3d.create(0, 1, 0.5)])!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z0);
      const visitor = polyface.createVisitor(0);
      const searcher = PolyfaceRangeTreeContext.createCapture(visitor, treeWidth, treeWidth);
      if (ck.testType(searcher, PolyfaceRangeTreeContext)) {
        for (let u = 0; u <= 1.00001; u += 0.010) {
          const xyz = path.fractionToPoint(u);
          const facetLocationDetail = searcher.searchForClosestPoint(xyz);
          if (ck.testDefined(facetLocationDetail) && facetLocationDetail !== undefined) {
            const closestPoint = facetLocationDetail.point;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [xyz, closestPoint], x0, y0, z0);
            // const segmentFraction = cld.fraction;
            const distance = xyz.distance(closestPoint);
            for (let i = 0; i < polyface.data.point.length; i += 7) {
              const di = polyface.data.point.distanceIndexToPoint(i, xyz)!;
              ck.testLE(distance, di);
            }
          }
        }
        const numFacets = polyface.facetCount;
        const searchesTimesFacets = searcher.numSearch * numFacets;
        ck.show({
          frankelSize,
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
  it("PolyfacePolyfaceSearch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    const y0 = 0;
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
    //    const treeWidth = 3;
    // Franke surface is ..
    // range [0,1] in both directions
    // very non-planar quads -- definitely need to triangulate!!
    // frankelSize 5 is pretty minimal
    //             10 looks good for lots of tests.
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

    const contextA = PolyfaceRangeTreeContext.createCapture(polyfaceA.createVisitor(), 3, 3)!;
    const contextB = PolyfaceRangeTreeContext.createCapture(polyfaceB.createVisitor(), 3, 3)!;
    const approach = PolyfaceRangeTreeContext.searchForClosestApproach(contextA, contextB);
    if (approach !== undefined) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry,
        [approach.dataA.point, approach.dataB.point], x0, y0, z0);
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
    /*
    for (const multipliers of [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]) {
      x0 += 2;
      const polyface = Sample.createMeshFromFrankeSurface(frankelSize, strokeOptions, multipliers)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0, z0);
    }
    */
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolyfacePolyfaceSearch");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolylinePolylineSearcher", () => {
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

    if (ck.testDefined(polylineApproach) && polylineApproach !== undefined) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [polylineApproach.detailA.point, polylineApproach.detailB.point], x0, y0, z0);
    }

    x0 += 20;
    const shiftB = Transform.createTranslationXYZ(0, 3, 4);
    shiftB.multiplyPoint3dArrayInPlace(pointsB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, x0, y0, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsB, x0, y0, z0);

    const contextA1 = Point3dArrayRangeTreeContext.createCapture(pointsA, treeWidth, treeWidth)!;
    const contextB1 = Point3dArrayRangeTreeContext.createCapture(pointsB, treeWidth, treeWidth)!;
    const approach1 = Point3dArrayRangeTreeContext.searchForClosestApproach(contextA1, contextB1);
    if (ck.testDefined(approach1) && approach1 !== undefined) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approach1.dataA, approach1.dataB], x0, y0, z0);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PolylinePolylineSearcher");
    expect(ck.getNumErrors()).equals(0);
  });

});
