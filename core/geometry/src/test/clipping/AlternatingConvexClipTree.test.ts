/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { AlternatingCCTreeNode } from "../../clipping/AlternatingConvexClipTree";
import { Arc3d } from "../../curve/Arc3d";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { UsageSums } from "../../numerics/UsageSums";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker, SaveAndRestoreCheckTransform } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { GrowableXYZArrayCache } from "../../geometry3d/ReusableObjectCache";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Angle, Matrix3d, Point3dArray, Transform } from "../../core-geometry";

/* eslint-disable no-console */

// Globals
let clipEvalCount = 0;
const outDir = "AlternatingConvexClipTree";

Checker.noisy.clipTree = false;

function getEvaluationCount(clear: boolean = false) {
  const count = clipEvalCount;
  if (clear)
    clipEvalCount = 0;
  return count;
}

function saveTree(root: AlternatingCCTreeNode, shiftX: number = 0, shiftY: number = 0, scaleAroundCentroidFactor: number = 1.0) {
  if (scaleAroundCentroidFactor === 1.0)
      Checker.saveTransformedLineString(root.points);
  else {
    const centroid = Point3dArray.centroid(root.points);
    const transform = Transform.createFixedPointAndMatrix(centroid, Matrix3d.createScale(scaleAroundCentroidFactor, scaleAroundCentroidFactor, scaleAroundCentroidFactor));
    const scaledPoints = transform.multiplyPoint3dArray(root.points);
    scaledPoints.push(scaledPoints[0].clone());
    Checker.saveTransformedLineString(scaledPoints);
  }
  Checker.shift(shiftX, shiftY, 0);
  for (const child of root.children)
    saveTree(child, shiftX, shiftY, scaleAroundCentroidFactor);
}

function clipPathA(shift: Vector3d, scale: number, points: Point3d[]) {
  points.length = 0;
  const clipPath: Point3d[] = [
    Point3d.create(-1, -1),
    Point3d.create(0.5, -1),
    Point3d.create(0.5, 0.5),
    Point3d.create(0.6, 0.6),
    Point3d.create(1.3, 0.8),
    Point3d.create(0.9, 1.4),
  ];
  for (const xyz of clipPath)
    points.push(xyz.plusScaled(shift, scale));
}

function clipAndSave(root: AlternatingCCTreeNode, curve: CurvePrimitive) {
  const inside: CurveLocationDetailPair[] = [];
  const outside: CurveLocationDetailPair[] = [];
  root.appendCurvePrimitiveClipIntervals(curve, inside, outside);
  for (const pair of inside) {
    const r = curve.clonePartialCurve(pair.detailA.fraction, pair.detailB.fraction);
    if (r)
      Checker.saveTransformed(r);
  }
}

/**
 * Output levels:
 *  0 - none
 *  1 - diagonals & scatter samples
 *  2 - all
 */
function testClipper(points: Point3d[], root: AlternatingCCTreeNode, outputLevel: number = 1) {
  const fractions: number[] = [];
  const range = Range3d.createArray(points);
  const halfCount = 20;
  const df = 0.8 / halfCount;
  for (let i = -halfCount; i <= halfCount; i++)
    fractions.push(0.5 - i * df);
  const a = range.xLength() * 0.004;
  getEvaluationCount(true);
  const inSum = new UsageSums();
  const outSum = new UsageSums();
  let id = 0;
  const idPeriod = 29;
  for (const fx of fractions) {
    for (const fy of fractions) {
      id++;
      const xyz = range.fractionToPoint(fx, fy, 0);
      const doOutput = outputLevel === 2 || (outputLevel === 1 && Geometry.isAlmostEqualNumber(Math.abs(fx - 0.5), Math.abs(fy - 0.5))) ||
        (outputLevel === 1 && (id % idPeriod) === 0);
      if (root.isPointOnOrInside(xyz)) {
        if (doOutput)
          Checker.saveTransformedMarker(xyz, a);
        inSum.accumulate(getEvaluationCount(true));
      } else {
        if (doOutput)
          Checker.saveTransformedMarker(xyz, -a);
        outSum.accumulate(getEvaluationCount(true));
      }
    }
  }

  const numTest = fractions.length * fractions.length;
  if (Checker.noisy.clipTree === true) {
    console.log(`ClipperTest  (polygonPoints: ${points.length}) (TestPoint: ${numTest})`);
    console.log(`IN: ${inSum.count} avg: ${inSum.mean} max ${inSum.minMax}`);
    console.log(`OUT: ${outSum.count} avg: ${outSum.mean}  max: ${outSum.minMax}`);
  }
}

describe("RecursiveClipSets", () => {

  it("Test1", () => {
    const ck = new Checker();
    for (const numPoints of [5, 8, 12, 15, 23, 37, 67]) {
      const shifter = new SaveAndRestoreCheckTransform(10, 0, 0);
      const points = Sample.createUnitCircle(numPoints);
      points.pop();
      const f0 = 0.4;
      let f = 0.3;
      const af = 1.4;
      for (let i = 1; i < numPoints - 1;) {
        points[i].scaleInPlace(f0);
        if (numPoints > 10 && i + 2 < numPoints) {
          const vector = points[i].vectorTo(points[i + 1]);
          points[i + 1].plusScaled(vector, f, points[i + 1]);
          f *= af;
          if (i + 2 < numPoints - 1)
            points[i + 2].plusScaled(vector, f, points[i + 2]);
          if (f > 2.0)
            f = 0.1;
          i += 4;
        } else {
          i += 3;
        }
      }
      Checker.saveTransformedLineString(points);
      Checker.shift(0, 5, 0);
      const root = AlternatingCCTreeNode.createTreeForPolygon(points);
      Checker.shift(0, 5, 0);
      saveTree(root);
      testClipper(points, root, 1);
      shifter.doShift();
    }

    Checker.clearGeometry("RecursiveClipSets.test1", outDir);

    expect(ck.getNumErrors()).equals(0);
  });

  it("Test2", () => {
    const ck = new Checker();
    for (const perpendicularFactor of [-1.0, 1.0]) {
      for (const generatorFunction of [
        Sample.createFractalDiamondConvexPattern,
        Sample.createFractalSquareReversingPattern,
        Sample.createFractalLReversingPattern,
        Sample.createFractalLMildConcavePatter]) {
        const shifterA = new SaveAndRestoreCheckTransform(0, 20, 0);
        for (let numRecursion = 0; numRecursion < 4; numRecursion++) {
          const shifterB = new SaveAndRestoreCheckTransform(10, 0, 0);
          const points = generatorFunction(numRecursion, perpendicularFactor);
          Checker.saveTransformedLineString(points);
          Checker.shift(0, 5, 0);
          const root = AlternatingCCTreeNode.createTreeForPolygon(points);
          saveTree(root);
          testClipper(points, root);
          shifterB.doShift();
        }
        shifterA.doShift();
      }
    }

    Checker.clearGeometry("RecursiveClipSets.test2", outDir);

    expect(ck.getNumErrors()).equals(0);
  });

  it("Test3", () => {
    const ck = new Checker();
    // A diamond, but with the diagonals pushed inward so no full edge of the polygon is on the hull.
    const points: Point3d[] = [
      Point3d.create(5, 0, 0),
      Point3d.create(2, 1, 0),
      Point3d.create(1, 2, 0),

      Point3d.create(0, 5, 0),

      Point3d.create(-1, 2, 0),
      Point3d.create(-2, 1, 0),

      Point3d.create(-5, 0, 0),

      Point3d.create(-2, -1, 0),
      Point3d.create(-1, -2, 0),

      Point3d.create(0, -5, 0),

      Point3d.create(1, -2, 0),
      Point3d.create(2, -1, 0),

      // Point3d.create(5, 0, 0),
    ];

    Checker.saveTransformedLineString(points);
    Checker.shift(0, 25, 0);
    const root = AlternatingCCTreeNode.createTreeForPolygon(points);
    const rootClone = root.clone();
    saveTree(root);
    testClipper(points, root);
    testClipper(points, rootClone);
    Checker.clearGeometry("RecursiveClipSets.test3", outDir);

    expect(ck.getNumErrors()).equals(0);
  });

  it("HullAndInlets", () => {
    const ck = new Checker();
    let x0 = 0;

    const pointsA: Point3d[] = [
      Point3d.create(0, 0),
      Point3d.create(-2, -2),
      Point3d.create(4, 0),
      Point3d.create(-2, 2),
      Point3d.create(0, 0),
    ];
    testHullAndInlets(pointsA, x0, 10);
    x0 += 100;
    for (const degrees of [0, 45, 90, 180, 270]) {
      x0 += 100;
      const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0),
        Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
      const rotatedPoints = transform.multiplyPoint3dArray(pointsA);
      testHullAndInlets(rotatedPoints, x0, 10);
    }
    x0 += 100;

    // A diamond, but with some diagonals pushed inward and outward so there are inlets and multi-edge convex parts
    const points: Point3d[] = [
      Point3d.create(5, 0, 0),
      Point3d.create(0, 5, 0),
      Point3d.create(-1, 5, 0),
      Point3d.create(-4, 2, 0),
      Point3d.create(-5, 0, 0),
      Point3d.create(0, 1, 0),
      Point3d.create(2, 1, 0),
      Point3d.create(0, 0, 0),
      Point3d.create(-1, -2, 0),
      Point3d.create(0, -5, 0),
      Point3d.create(1, -2, 0),
      Point3d.create(2, -1, 0),
    ];
    testHullAndInlets(points, x0, 12.0);
    x0 += 100;

    Checker.clearGeometry("HullAndInlets", outDir);
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineClip0", () => {
    const ck = new Checker();
    const linesToClip: Point3d[] = [];
    const baseShift = Vector3d.create(-0.1, -0.1, 0);
    for (const perpendicularFactor of [-1.0, 1.0]) {
      for (const generatorFunction of [
        Sample.createFractalSquareReversingPattern,
        Sample.nonConvexQuadSimpleFractal,
        Sample.createFractalDiamondConvexPattern,
        Sample.createFractalSquareReversingPattern,
        Sample.createFractalLReversingPattern,
        Sample.createFractalLMildConcavePatter]) {
        const shifterA = new SaveAndRestoreCheckTransform(50, 0, 0);
        for (const depth of [0, 1, 2]) {
          const shifterB = new SaveAndRestoreCheckTransform(5, 0, 0);
          const polygon = generatorFunction(depth, perpendicularFactor);
          const root = AlternatingCCTreeNode.createTreeForPolygon(polygon);

          saveTree(root);

          clipPathA(baseShift, 0.0, linesToClip);
          Checker.saveTransformedLineString(linesToClip);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);

          for (const s of [0.0, 1.1, 2.3]) {
            clipPathA(baseShift, s, linesToClip);

            for (let i0 = 0; i0 + 1 < linesToClip.length; i0++) {
              const lineSegment = LineSegment3d.create(linesToClip[i0], linesToClip[i0 + 1]);
              clipAndSave(root, lineSegment);
            }
          }

          Checker.shift(0, 5, 0);
          Checker.saveTransformedLineString(polygon);
          clipPathA(baseShift, 0.0, linesToClip);
          Checker.saveTransformedLineString(linesToClip);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, LineString3d.createPoints(linesToClip));

          Checker.shift(0, 5, 0);
          Checker.saveTransformedLineString(polygon);
          const arc0 = Arc3d.create(
            Point3d.create(0.5, 0.5, 0),
            Vector3d.create(0.5, 1, 0),
            Vector3d.create(-0.2, 0.2, 0),
            AngleSweep.createStartEndDegrees(-120, 240),
          );
          ck.testFalse(arc0 === undefined, "Created arc is not undefined");
          Checker.saveTransformed(arc0);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, arc0);

          Checker.shift(0, 5, 0);
          Checker.saveTransformedLineString(polygon);
          const bcurve = BSplineCurve3d.createUniformKnots(
            [
              Point3d.create(0, -0.2),
              Point3d.create(1, 0.3),
              Point3d.create(1.2, 0.8),
              Point3d.create(0.5, 1.0),
              // Point3d.create(-0.1, 0.1)   // some plane cuts missed with sharp cusp?
              Point3d.create(-0.3, 0.1),
              // Point3d.create(0, 0.5),
              Point3d.create(0, 0.8),
              Point3d.create(0.5, 1.3),
            ],
            4,
          );
          ck.testFalse(bcurve === undefined, "Created bspline curve is not undefined");
          Checker.saveTransformed(bcurve!);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, bcurve!);

          Checker.shift(0, 5, 0);
          Checker.saveTransformedLineString(polygon);
          const linestring = LineString3d.create(
            [
              Point3d.create(0, -0.2),
              Point3d.create(1, 0.3),
              Point3d.create(1.2, 0.8),
              Point3d.create(0.5, 1.0),
              Point3d.create(-0.3, 0.1),
              Point3d.create(0, 0.8),
              Point3d.create(0.5, 1.3),
            ]);
          Checker.saveTransformed(linestring);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, linestring);
          // This fragment is not clipped properly within in the linestring ... small outside hanger.
          Checker.shift(0, 5, 0);
          Checker.saveTransformedLineString(polygon);
          const segmentB = LineSegment3d.create(
            Point3d.create(1, 0.3),
            Point3d.create(1.2, 0.8));
          Checker.saveTransformed(segmentB);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, segmentB);
          clipAndSave(root, segmentB);
          clipAndSave(root, segmentB);

          shifterB.doShift();
        }
        shifterA.doShift();
      }
    }

    Checker.clearGeometry("RecursiveClipSets.LineClip0", outDir);
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolygonClipA", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const polygon = [Point3d.create(0, 0), Point3d.create(4, 0), Point3d.create(4, 2), Point3d.create(2, 2), Point3d.create(2, 3), Point3d.create(0, 4)];
    const root = AlternatingCCTreeNode.createTreeForPolygon(polygon);
    let x0 = 0;
    const dx = 10.0;
    const dy = 10.0;
    for (const yA of [1, -1.5, 2]) {
      let y0 = 0;
      for (const dyAB of [2, 1, 3]) {
        const cache = new GrowableXYZArrayCache();
        const rectangle = GrowableXYZArray.create(Sample.createRectangleXY(1, yA, 5, dyAB));
        const insideFragments: GrowableXYZArray[] = [];
        const outsideFragments: GrowableXYZArray[] = [];
        root.appendPolygonClip(rectangle, insideFragments, outsideFragments, cache);
        GeometryCoreTestIO.createAndCaptureLoop(allGeometry, rectangle, x0, y0);
        GeometryCoreTestIO.createAndCaptureLoop(allGeometry, polygon, x0, y0);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(polygon), x0, y0 + dy);
        GeometryCoreTestIO.createAndCaptureLoops(allGeometry, insideFragments, x0, y0 + dy);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(polygon), x0, y0 + 2 * dy);
        GeometryCoreTestIO.createAndCaptureLoops(allGeometry, outsideFragments, x0, y0 + 2 * dy);
        y0 += 4 * dy;
      }
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, outDir, "PolygonClipA");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolygonClipB", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cache = new GrowableXYZArrayCache();
    const polygonUVA = [];
    polygonUVA.push(Point3d.create(0.2, 0.2));
    polygonUVA.push(Point3d.create(1.1, 0.3));
    polygonUVA.push(Point3d.create(0.9, 0.75));
    polygonUVA.push(Point3d.create(0.5, 0.5));
    polygonUVA.push(Point3d.create(0.1, 0.5));
    let x0 = 0;
    const polygonUVB = Sample.createRectangleXY(-0.1, -0.1, 1.2, 1.2, 0);
    for (const polygonUV of [polygonUVB, polygonUVA]) {
      for (const perpendicularFactor of [-1.0, 1.0]) {
        const y0 = 0;
        for (const generatorFunction of [
          Sample.createFractalSquareReversingPattern,
          Sample.nonConvexQuadSimpleFractal,
          Sample.createFractalDiamondConvexPattern,
          Sample.createFractalSquareReversingPattern,
          Sample.createFractalLReversingPattern,
          Sample.createFractalLMildConcavePatter]) {
          for (const depth of [0, 1, 2]) {
            const polygon = generatorFunction(depth, perpendicularFactor);
            const range = Range3d.createArray(polygon);
            const dy = 1.25 * range.yLength();
            const root = AlternatingCCTreeNode.createTreeForPolygon(polygon);
            const input = new GrowableXYZArray();
            for (const p of polygonUV)
              input.push(range.localToWorld(p)!);
            const inputArea = PolygonOps.area(input.getPoint3dArray());

            const insideFragments: GrowableXYZArray[] = [];
            const outsideFragments: GrowableXYZArray[] = [];
            root.appendPolygonClip(input, insideFragments, outsideFragments, cache);
            GeometryCoreTestIO.createAndCaptureLoop(allGeometry, input, x0, y0);
            GeometryCoreTestIO.createAndCaptureLoop(allGeometry, polygon, x0, y0);
            GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(polygon), x0, y0 + dy);
            GeometryCoreTestIO.createAndCaptureLoops(allGeometry, insideFragments, x0, y0 + dy);
            GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(polygon), x0, y0 + 2 * dy);
            GeometryCoreTestIO.createAndCaptureLoops(allGeometry, outsideFragments, x0, y0 + 2 * dy);
            const insideArea = summedAreas(insideFragments);
            const outsideArea = summedAreas(outsideFragments);
            ck.testCoordinate(inputArea, insideArea + outsideArea, " clipped area sums");

            x0 += 4 * range.xLength();
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, outDir, "PolygonClipB");
    expect(ck.getNumErrors()).equals(0);
  });
});

function summedAreas(loops: GrowableXYZArray[]): number {
  let s = 0;
  for (const loop of loops) {
    s += PolygonOps.area(loop.getPoint3dArray());
  }
  return s;
}

function testHullAndInlets(points: Point3d[], x0: number, ay: number) {
  Checker.moveTo(x0, 0);
  Checker.saveTransformedLineString(points);
  const root0 = AlternatingCCTreeNode.createTreeForPolygon(points);
  Checker.shift(0, ay, 0);
  saveTree(root0, 0, 0, 0.98);
  for (let i = 1; i < 3; i++){
    Checker.moveTo(x0 + i * 20, 0, 0);
    Checker.saveTransformedLineString(points);
    Checker.shift(0, ay, 0);
    const root = AlternatingCCTreeNode.createHullAndInletsForPolygon(points);
    saveTree(root, 0, 0, 0.98);
    points.reverse ();
  }
}
