/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker, UsageSums, SaveAndRestoreCheckTransform } from "./Checker";
import { Point3d, Vector3d } from "../geometry3d/PointVector";
import { Range3d } from "../geometry3d/Range";
import { Geometry } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { AlternatingCCTreeNode } from "../clipping/AlternatingConvexClipTree";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Arc3d } from "../curve/Arc3d";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { Sample } from "../serialization/GeometrySamples";

/* tslint:disable: no-console */

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

function saveTree(root: AlternatingCCTreeNode) {
  Checker.saveTransformedLineString(root.points);
  for (const child of root.children)
    saveTree(child);
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
    console.log("ClipperTest  (polygonPoints: " + points.length + ") (TestPoint: " + numTest + ")");
    console.log("IN: " + inSum.count + " avg: " + inSum.mean + " max: " + inSum.max);
    console.log("OUT: " + outSum.count + " avg: " + outSum.mean + " max: " + outSum.max);
  }
}

describe("RecursiveClipSets", () => {
  const ck = new Checker();

  it("Test1", () => {
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

    ck.checkpoint("Test1");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Test2", () => {
    for (const perpendicularFactor of [-1.0, 1.0]) {
      for (const generatorFunction of [
        Sample.createFractalDiamonConvexPattern,
        Sample.createFractalSquareReversingPattern,
        Sample.createFractalLReversingPatterh,
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

    ck.checkpoint("Test2");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Test3", () => {
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

    ck.checkpoint("Test3");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineClip0", () => {
    const linesToClip: Point3d[] = [];
    const baseShift = Vector3d.create(-0.1, -0.1, 0);
    for (const perpendicularFactor of [-1.0, 1.0]) {
      for (const generatorFunction of [
        Sample.createFractalSquareReversingPattern,
        Sample.nonConvexQuadSimpleFractal,
        Sample.createFractalDiamonConvexPattern,
        Sample.createFractalSquareReversingPattern,
        Sample.createFractalLReversingPatterh,
        Sample.createFractalLMildConcavePatter]) {
        const shifterA = new SaveAndRestoreCheckTransform(50, 0, 0);
        for (const depth of [2, 0, 1, 2]) {
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
          Checker.saveTransformed(arc0!);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, arc0!);

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
          Checker.saveTransformed(linestring!);
          Checker.shift(0, 4, 0);
          Checker.saveTransformedLineString(polygon);
          clipAndSave(root, linestring);
          // This fragment is not clipped properly within in the linestring ... small outside hanger.
          Checker.shift(0, 5, 0);
          Checker.saveTransformedLineString(polygon);
          const segmentB = LineSegment3d.create(
            Point3d.create(1, 0.3),
            Point3d.create(1.2, 0.8));
          Checker.saveTransformed(segmentB!);
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
    ck.checkpoint("LineClip0");
    expect(ck.getNumErrors()).equals(0);
  });
});
