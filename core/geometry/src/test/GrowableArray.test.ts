/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Checker } from "./Checker";
import { expect } from "chai";
import { GrowableFloat64Array, GrowableXYZArray } from "../GrowableArray";
import { ClusterableArray } from "../numerics/ClusterableArray";
import { prettyPrint } from "./testFunctions";
import { PolyfaceQuery } from "../polyface/PolyfaceQuery";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { Point2d, Point3d, Vector2d, Vector3d } from "../PointVector";
import { Point3dArrayCarrier, Point3dArray } from "../PointHelpers";
import { Transform } from "../Transform";
import { Matrix3d } from "../Transform";
import { Sample } from "../serialization/GeometrySamples";
import { Angle } from "../Geometry";

/* tslint:disable: no-console */

describe("GrowableFloat64Array.HelloWorld", () => {
  it("SizeChanges", () => {
    const ck = new Checker();
    const arr = new GrowableFloat64Array();
    arr.ensureCapacity(16);
    const b = 5.4;
    const c = 12.9;
    ck.testExactNumber(arr.capacity(), 16);
    arr.push(1);
    arr.push(c);
    const l = arr.length;
    ck.testExactNumber(c, arr.at(l - 1));
    arr.setAt(l - 1, b);
    ck.testExactNumber(arr.at(l - 1), b);

    arr.resize(1);
    ck.testExactNumber(arr.length, 1);
    arr.resize(5);
    ck.testExactNumber(arr.length, 5);
    ck.testExactNumber(arr.front(), 1);
    ck.testExactNumber(arr.at(1), 0);
    ck.testExactNumber(arr.back(), 0);
    const capacityB = 100;
    const lB = arr.length;
    arr.ensureCapacity(capacityB);
    ck.testLE (capacityB, arr.capacity(), "adequate ensure capacity");
    ck.testExactNumber (lB, arr.length, "length after expanding capacity");
    ck.checkpoint("GrowableArray.float64");
    expect(ck.getNumErrors()).equals(0);
  });
  it("FilterToInterval", () => {
    const ck = new Checker();
    const arr = new GrowableFloat64Array();
    arr.ensureCapacity(16);
    const data = Sample.createGrowableArrayCountedSteps(0, 1, 101);
    const numRemaining = 3;
    data.restrictToInterval(9.5, 9.5 + numRemaining);
    ck.testExactNumber(numRemaining, data.length, "restrictToInterval");
    ck.checkpoint("GrowableArray.FilterToInterval");
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("BlockedArray", () => {
  it("Cluster", () => {
    const ck = new Checker();
    Checker.noisy.cluster = false;

    const blocks = new ClusterableArray(2, 1, 20);
    ck.testExactNumber(blocks.numPerBlock, 4);
    const e = 0.00001;
    const tolerance = 0.1;
    // This is the vector perpendicular to the sort direction.
    // points on these lines get considered for clusters.
    const perp = Vector2d.create(
      ClusterableArray.sortVectorComponent(1),
      -ClusterableArray.sortVectorComponent(0));

    // these points are distinct ...
    const xy0 = Point2d.create(1, 2);
    const xy1 = Point2d.create(3, 2);
    const xy2 = xy1.plusScaled(perp, 1.0);
    const xy3 = Point2d.create(3, 4.35);
    const xy4 = xy3.plusScaled(perp, 1.2);
    const xy5 = xy4.plusScaled(perp, -3.2);
    const points = [xy0, xy1, xy2, xy3, xy4, xy5];
    // add points, not in order, some shifted be vectors of size around e.
    // But the shifted things are marked as known to be with the same base point.
    blocks.addPoint2d(xy0, 0);
    blocks.addPoint2d(xy0.plusXY(e, 0), 0);

    blocks.addPoint2d(xy3.plusXY(-e, 0.5 * e), 3);

    blocks.addPoint2d(xy1, 1);
    blocks.addPoint2d(xy1.plusXY(e, 0), 1);

    blocks.addPoint2d(xy2, 2);
    blocks.addPoint2d(xy4.plusXY(e, -e), 4);

    blocks.addPoint2d(xy5, 5);

    blocks.addPoint2d(xy3, 3);
    blocks.addPoint2d(xy3.plusXY(e, e), 3);
    blocks.addPoint2d(xy1.plusXY(-e, 0), 1);

    blocks.addPoint2d(xy4.plusXY(0, -e), 4);
    blocks.addPoint2d(xy4.plusXY(0, -0.2 * e), 4);

    blocks.addPoint2d(xy4.plusXY(0.3 * e, -0.2 * e), 4);

    // get clusters !!!!
    // note that the order the clusters appear has no relationship to 012345 above.
    if (Checker.noisy.cluster) console.log(blocks.ToJSON());
    const clusterIndices = blocks.clusterIndicesLexical(tolerance);
    if (Checker.noisy.cluster) console.log(blocks.ToJSON());
    if (Checker.noisy.cluster) console.log(JSON.stringify(clusterIndices));
    for (let i = 0; i < clusterIndices.length; i++) {
      const k0 = clusterIndices[i];
      if (!ClusterableArray.isClusterTerminator(k0)) {
        const clusterIndex0 = blocks.getExtraData(k0, 0);
        const uv0 = blocks.getPoint2d(k0);
        if (Checker.noisy.cluster) console.log("cluster seed ", k0, uv0);
        for (; i < clusterIndices.length; i++) {
          const k1 = clusterIndices[i];
          if (ClusterableArray.isClusterTerminator(k1)) break;
          const uv1 = blocks.getPoint2d(k1);
          if (Checker.noisy.cluster) console.log("    cluster member", k1, uv1);
          const clusterIndex1 = blocks.getExtraData(k1, 0);
          ck.testExactNumber(clusterIndex0, clusterIndex1);
          ck.testLE(
            blocks.distanceBetweenBlocks(k0, k1), tolerance,
            "confirm cluster tolerance");
          // k0, k1 should match each other and the original cluster point
          ck.testLE(uv0.distance(uv1), tolerance, "query cluster", k0, k1);
          ck.testLE(uv1.distance(points[clusterIndex1]), tolerance, "original cluster");
        }
      }
    }
    // verify the various forms of index . ..
    const clusterToClusterStart = blocks.createIndex_clusterToClusterStart(clusterIndices);
    const blockToClusterStart = blocks.createIndex_blockToClusterStart(clusterIndices);
    const blockToClusterIndex = blocks.createIndex_blockToClusterIndex(clusterIndices);
    const n = clusterIndices.length;
    ck.testExactNumber(blockToClusterStart.length, blocks.numBlocks);
    ck.testExactNumber(blockToClusterIndex.length, blocks.numBlocks);
    for (let clusterIndex = 0; clusterIndex < clusterToClusterStart.length; clusterIndex++) {
      const clusterStart = clusterToClusterStart[clusterIndex];
      for (let i = clusterStart; i < n && !ClusterableArray.isClusterTerminator(clusterIndices[i]); i++) {
        const b = clusterIndices[i];
        ck.testExactNumber(blockToClusterStart[b], clusterStart, "blockToClusterStart");
        ck.testExactNumber(clusterIndex, blockToClusterIndex[b], blockToClusterIndex);
      }
    }

    blocks.clear();
    ck.testExactNumber(blocks.numBlocks, 0);
    blocks.addBlock([3, 2, 1]);
    blocks.addDirect(5, 6, 7, 8, 9);
    blocks.addBlock([1, 2, 3]);
    const sortedView = blocks.sortIndicesLexical();
    ck.testPoint2d(blocks.getPoint2d(sortedView[0]), Point2d.create(1, 2));

    const blocks2 = new ClusterableArray(2, 3, 5);
    blocks2.addPoint2d(Point2d.create(1, 2), 5, 6, 7);
    blocks2.addPoint3d(Point3d.create(1, 2, 3), 5, 6, 7);
    ck.testPoint3d(blocks2.getPoint3d(1), Point3d.create(1, 2, 3));
    const obj = blocks2.ToJSON();
    ck.testTrue(obj[0][2][0] === 1 && obj[0][2][1] === 2);
    ck.testTrue(obj[1][2][0] === 1 && obj[1][2][1] === 2);
    blocks2.popBlock();
    ck.testExactNumber(blocks2.numBlocks, 1);
    ck.testExactNumber(blocks2.checkedComponent(0, 1)!, 1);
    ck.testUndefined(blocks2.checkedComponent(1, 2));

    ck.checkpoint("GrowableArray.annotateClusters");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("GrowablePoint3dArray", () => {
  it("PointMoments", () => {
    const ck = new Checker();
    for (let n = 3; n < 100; n *= 2) {
      const pointA = new GrowableXYZArray();
      const pointB = [];
      ck.testExactNumber(pointA.length, 0);
      // load pointB
      for (let i = 0; i < n; i++) {
        pointB.push(Point3d.create(Math.cos(i * i), i + 0.25, i + 0.5));
        // pointB.push(Point3d.create(i, i + 0.25, i + 0.5));
        // pointB.push(Point3d.create(-i, i + 0.25, i + 0.5));
      }

      // verify undefined returns from empty array
      ck.testUndefined(pointA.front());
      ck.testUndefined(pointA.back());
      ck.testFalse(pointA.isIndexValid(4));
      for (const p of pointB) {
        pointA.push(p);
        ck.testPoint3d(p, pointA.back() as Point3d);
        ck.testPoint3d(pointB[0], pointA.front() as Point3d);
      }
      for (let i = 0; i < n; i++)
        ck.testPoint3d(pointB[i], pointA.getPoint3dAt(i) as Point3d);
      ck.testExactNumber(pointA.length, pointB.length, "array lengths");

      let lengthA = 0;
      for (let i = 0; i + 1 < n; i++) {
        lengthA += pointA.getPoint3dAt(i).distance(pointA.getPoint3dAt(i + 1));
      }
      const lengthA1 = pointA.sumLengths();
      ck.testCoordinate(lengthA, lengthA1, "polyline length");
      ck.testExactNumber(pointA.length, n);

      // we are confident that all x coordinates are distinct ...
      const sortOrder = pointA.sortIndicesLexical();
      for (let i = 1; i < sortOrder.length; i++) {
        const a = sortOrder[i - 1];
        const b = sortOrder[i];
        ck.testTrue(pointA.compareLexicalBlock(a, b) < 0, " confirm lexical sort order");
        ck.testTrue(pointA.component(a, 0) <= pointA.component(b, 0), "confirm sort order x");
      }
    }
    ck.checkpoint("GrowablePoint3dArray.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Wrap", () => {
    const ck = new Checker();
    const numWrap = 3;
    for (let n = 5; n < 100; n *= 2) {
      const pointA = Sample.createGrowableArrayCirclePoints(1.0, n, false);
      pointA.pushWrap(numWrap);
      ck.testExactNumber(n + numWrap, pointA.length, "pushWrap increases length");
      for (let i = 0; i < numWrap; i++) {
        ck.testPoint3d(pointA.getPoint3dAt(i), pointA.getPoint3dAt(n + i), "wrapped point");
      }
      let numDup = 0;
      const sortOrder = pointA.sortIndicesLexical();
      for (let i = 0; i + 1 < pointA.length; i++) {
        const k0 = sortOrder[i];
        const k1 = sortOrder[i + 1];
        if (pointA.getPoint3dAt(k0).isAlmostEqual(pointA.getPoint3dAt(k1))) {
          ck.testLT(k0, k1, "lexical sort preserves order for duplicates");
          numDup++;
        } else {
          const s = pointA.compareLexicalBlock(k0, k1);
          ck.testExactNumber(-1, s);
          const s1 = pointA.compareLexicalBlock(k1, k0);
          ck.testExactNumber(1, s1);
        }
      }
      ck.testExactNumber(numWrap, numDup, "confirm numWrap duplicates");
    }
    ck.checkpoint("GrowablePoint3dArray.Wrap");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolyfaceMoments", () => {
    const ck = new Checker();
    ck.checkpoint("Solids.PointMoments");
    // https://en.wikipedia.org/wiki/List_of_second_moments_of_area
    // https://en.wikipedia.org/wiki/List_of_moments_of_inertia
    // Filled rectngular area with x size b, y size h, centered at origin.
    const b = 6.0;
    const h = 2.0;
    const IX = b * h * h * h / 12.0;
    const IY = b * b * b * h / 12.0;
    for (const origin of [Point3d.create(-b / 2, -h / 2, 0), Point3d.create(1, 1, 0)]) {
      const polyface = Sample.createTriangularUnitGridPolyface(
        origin,
        Vector3d.create(b, 0, 0), Vector3d.create(0, h, 0), 2, 2, false, false, false);
      const moments = PolyfaceQuery.computePrincipalAreaMoments(polyface);
      if (Checker.noisy.rectangleMoments) {
        console.log("Rectangle lower left", origin);
        console.log(prettyPrint(polyface));
        console.log(prettyPrint(moments!));
        console.log("expected IX", IX);
        console.log("expected IY", IY);
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
  /** Basic output testing on appendages, sorting, transforming of a known inverse, and testing recognition of plane proximity within correct tolerance */
  it("BlackBoxTests", () => {
    const ck = new Checker();
    const arr = new GrowableXYZArray();
    arr.ensureCapacity(9);
    arr.push(Point3d.create(1, 2, 3));
    arr.push(Point3d.create(4, 5, 6));
    arr.push(Point3d.create(7, 8, 9));
    arr.resize(2);
    ck.testExactNumber(arr.length, 2);
    ck.testTrue(arr.compareLexicalBlock(0, 1) < 0 && arr.compareLexicalBlock(1, 0) > 0);
    const point = Point3d.create();
    arr.atPoint3dIndex(1, point);
    const vector = arr.atVector3dIndex(1)!;
    ck.testTrue(point.isAlmostEqual(vector));
    ck.testPoint3d(point, Point3d.create(4, 5, 6));

    const transform = Transform.createOriginAndMatrix(Point3d.create(0, 0, 0), Matrix3d.createRowValues(
      2, 1, 0,
      2, 0, 0,
      2, 0, 1,
    ));
    const noInverseTransform = Transform.createOriginAndMatrix(Point3d.create(0, 0, 0), Matrix3d.createRowValues(
      1, 6, 4,
      2, 4, -1,
      -1, 2, 5,
    ));

    ck.testTrue(arr.tryTransformInverseInPlace(transform));
    ck.testFalse(arr.tryTransformInverseInPlace(noInverseTransform));
    ck.testPoint3d(arr.getPoint3dAt(0), Point3d.create(1, -1, 1));

    arr.resize(1);

    const closePlane = Plane3dByOriginAndUnitNormal.create(Point3d.create(1, -1 + 1.0e-10, 1), Vector3d.create(1, 1, 1));
    const nonClosePlane = Plane3dByOriginAndUnitNormal.create(Point3d.create(1, -1 + 1.0e-4, 1), Vector3d.create(1, 1, 1));
    ck.testTrue(arr.isCloseToPlane(closePlane!));
    ck.testFalse(arr.isCloseToPlane(nonClosePlane!));

    expect(ck.getNumErrors()).equals(0);
  });

  it("IndexedXYZCollection", () => {
    const ck = new Checker();
    const points = Sample.createFractalDiamonConvexPattern(1, -0.5);
    const frame = Transform.createFixedPointAndMatrix(Point3d.create(1, 2, 3),
      Matrix3d.createRotationAroundVector(Vector3d.create(0.3, -0.2, 1.2), Angle.createDegrees(15.7))!);
    frame.multiplyPoint3dArrayInPlace(points);

    const gPoints = new GrowableXYZArray();
    gPoints.pushAll(points);
    const iPoints = new Point3dArrayCarrier(points);
    const iOrigin = iPoints.atPoint3dIndex(0)!;
    const gOrigin = gPoints.atPoint3dIndex(0)!;
    ck.testPoint3d(iOrigin, gOrigin, "point 0 access");
    for (let i = 1; i + 1 < points.length; i++) {
      const j = i + 1;
      const pointIA = iPoints.atPoint3dIndex(i)!;
      const pointGA = gPoints.atPoint3dIndex(i)!;
      const pointIB = iPoints.atPoint3dIndex(j)!;
      const pointGB = gPoints.atPoint3dIndex(j)!;
      const vectorIA = iPoints.vectorIndexIndex(i, j)!;
      const vectorGA = gPoints.vectorIndexIndex(i, j)!;

      const vectorIA1 = iPoints.vectorXYAndZIndex(pointIA, j)!;
      const vectorGA1 = gPoints.vectorXYAndZIndex(pointIA, j)!;

      ck.testVector3d(vectorIA1, vectorGA1, "vectorXYAndZIndex");
      ck.testPoint3d(pointIA, pointGA, "atPoint3dIndex");
      ck.testVector3d(vectorIA, pointIA.vectorTo(pointIB));
      ck.testVector3d(vectorGA, pointIA.vectorTo(pointGB));
      ck.testVector3d(
        iPoints.crossProductIndexIndexIndex(0, i, j)!,
        gPoints.crossProductIndexIndexIndex(0, i, j)!);
      ck.testVector3d(
        iPoints.crossProductXYAndZIndexIndex(iOrigin, i, j)!,
        gPoints.crossProductXYAndZIndexIndex(gOrigin, i, j)!);

      ck.testVector3d(
        iPoints.atVector3dIndex(i)!,
        gPoints.atVector3dIndex(i)!,
        "atVector3dIndex");

      ck.testPoint3d(Point3dArray.centroid(iPoints), Point3dArray.centroid(gPoints), "centroid");
    }
    expect(ck.getNumErrors()).equals(0);
  });

});
