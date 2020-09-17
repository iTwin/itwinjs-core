/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import { Arc3d } from "../../curve/Arc3d";
import { AnyCurve, AnyRegion } from "../../curve/CurveChain";
import { CurveFactory } from "../../curve/CurveFactory";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop, SignedLoops } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { DuplicateFacetClusterSelector, PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { LinearSweep } from "../../solid/LinearSweep";
import { HalfEdgeGraph } from "../../topology/Graph";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GraphChecker } from "../topology/Graph.test";
import { Sample } from "../../serialization/GeometrySamples";

/* eslint-disable no-console */

describe("RegionBoolean", () => {
  it("SimpleSplits", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const candidates: CurvePrimitive[] = [];
    let x0 = 0;
    let y0 = 0;
    candidates.push(LineSegment3d.createXYXY(0, 0, 1, 0));
    candidates.push(LineSegment3d.createXYXY(1, 0, 1, 1));
    candidates.push(Arc3d.createCircularStartMiddleEnd(Point3d.create(0.1, -0.1), Point3d.create(0.5, 0.6), Point3d.create(1.1, 0.8))!);
    for (const c of candidates)
      console.log(" geometry: ", IModelJson.Writer.toIModelJson(c));
    const linestringStartY = 0.5;   // making this 0.5 creates partial overlap -- problem?
    for (const stepData of [
      { geometry: LineSegment3d.createXYXY(0, 0.5, 1, 0.5), expectedFaces: 3 },
      { geometry: LineSegment3d.createXYXY(0.8, -0.1, 1.1, 0.2), expectedFaces: 4 },
      { geometry: LineSegment3d.createXYXY(0.5, 0, 0.4, -0.2), expectedFaces: 4 },
      { geometry: LineSegment3d.createXYXY(0.4, 0.0, 0.4, -0.2), expectedFaces: 5 },
      { geometry: LineSegment3d.createXYXY(0.4, 0.0, 1.6, 1), expectedFaces: 6 },
      { geometry: LineString3d.create([0, linestringStartY], [0.2, 0.5], [0.8, 0.3], [1.2, 0.4]), expectedFaces: -1, expectedIntersections: -1 },
    ]) {
      candidates.push(stepData.geometry);
      console.log(" add geometry: ", IModelJson.Writer.toIModelJson(stepData.geometry));
      for (const c of candidates)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, c, x0, y0);
      const loops = RegionOps.constructAllXYRegionLoops(candidates);
      y0 += 5.0;
      saveShiftedLoops(allGeometry, loops, x0, y0, 5.0);
      if (stepData.expectedFaces >= 0 && loops.length === 1)
        ck.testExactNumber(stepData.expectedFaces, loops[0].positiveAreaLoops.length + loops[0].negativeAreaLoops.length + loops[0].slivers.length, "Face loop count");
      x0 += 5.0;
      y0 = 0.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "SimpleSplits");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Holes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const delta = 15.0;
    let y0 = 0;
    for (const filletRadius of [undefined, 0.5]) {
      for (const numHole of [1, 3]) {
        const candidates: AnyCurve[] = [];
        const holeStep = 0.5;
        candidates.push(CurveFactory.createRectangleXY(0, 0, 10, 10, 0, filletRadius));
        candidates.push(CurveFactory.createRectangleXY(5, 8, 12, 12, 0, filletRadius));
        candidates.push(LineSegment3d.createXYXY(6, 5, 10, 11));
        for (let holeIndex = 0; holeIndex < numHole; holeIndex++) {
          const ex = holeIndex * holeStep;
          const ey = holeIndex * holeStep * 0.5;
          candidates.push(CurveFactory.createRectangleXY(1 + ex, 1 + ey, 2 + ex, 2 + ey, 0));
        }
        for (const c of candidates)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, c, x0, y0);
        const loops = RegionOps.constructAllXYRegionLoops(candidates);
        y0 += delta;
        saveShiftedLoops(allGeometry, loops, x0, y0, delta);
        if (loops.length > 1) {
          const negativeAreas = [];
          for (const loopSet of loops) {
            for (const loop of loopSet.negativeAreaLoops)
              negativeAreas.push(loop);
          }
          const regions = RegionOps.sortOuterAndHoleLoopsXY(negativeAreas);
          x0 += delta;
          y0 = 0;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, regions, x0, y0);
        }
        x0 += delta * (loops.length + 1);
        y0 = 0.0;
      }
      x0 += 4 * delta;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "Holes");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Overlaps", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const badGeometry: GeometryQuery[] = [];
    const xMax = 10.0;
    const da = 1.0;
    let x0 = 0.0;
    let y0 = 0;
    const c = 1.0;
    const c1 = 2.5;
    for (const degrees of [0, 180, 0.012123389324234, 42.123213]) {
      const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0),
        Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
      x0 = 0.0;
      for (const ab of [0.6 /* , 1.1, 3.1 */]) {
        for (const numCut of [1, 4, 7, 9]) {
          const candidates: AnyCurve[] = [];
          candidates.push(Loop.createPolygon([
            Point3d.create(0, 0),
            Point3d.create(xMax, 0),
            Point3d.create(xMax, 2),
            Point3d.create(0, 2),
            Point3d.create(0, 0)]));

          const a0 = 0.5;
          const b0 = a0 + ab;
          for (let i = 0; i < numCut; i++) {
            const a = a0 + i * da;
            const b = b0 + i * da;
            // alternate direction of overlap bits ... maybe it will cause problems in graph sort . .
            if ((i & 0x01) === 0)
              candidates.push(LineSegment3d.createXYXY(a, 0, b, 0));
            else
              candidates.push(LineSegment3d.createXYXY(a, 0, b, 0));
            candidates.push(LineSegment3d.createXYXY(a, 0, a, c));
            candidates.push(LineSegment3d.createXYXY(b, 0, b, c));
            candidates.push(LineSegment3d.createXYXY(a, c, b, c));
            // spread around some X geometry  . . .
            if ((i & 0x02) !== 0 && ab > 2.0) {
              candidates.push(LineSegment3d.createXYXY(a, c, b, c1));
              candidates.push(LineSegment3d.createXYXY(a, c1, b, c));
            }
          }
          let testIndex = 0;
          for (const candidate of candidates) {
            (candidate as any).testIndex = testIndex++;
            candidate.tryTransformInPlace(transform);
          }
          const loops = RegionOps.constructAllXYRegionLoops(candidates);
          const dy = 3.0;
          saveShiftedLoops(allGeometry, loops, x0, y0 + dy, dy);
          const stepData = { rotateDegrees: degrees, numCutout: numCut, cutoutStep: ab };
          if (!ck.testExactNumber(1, loops.length, stepData)
            || !ck.testExactNumber(1, loops[0].negativeAreaLoops.length, stepData)) {
            saveShiftedLoops(badGeometry, loops, x0, y0 + dy, dy);
          }

          GeometryCoreTestIO.captureCloneGeometry(allGeometry, candidates, x0, y0);
          x0 += 2 * xMax;
        }
        x0 += 4 * xMax;
      }
      y0 += 100.0;
    }
    GeometryCoreTestIO.saveGeometry(badGeometry, "RegionBoolean", "Overlaps.BAD");
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "Overlaps");
    expect(ck.getNumErrors()).equals(0);

  });
  it("ParityRegionWithCoincidentEdges", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let xBase = 0.0;
    const yBase = 0;
    for (const q of [0, 1, -1]) {
      const a0 = -q;
      const a1 = 12 + q;
      const b0 = 4 - q;
      const b1 = 8 + q;
      for (const q1 of [0, -1, 1]) {
        const pointArrayA = [[8, +q1], [4, 0], [a0, a0], [0, 4], [0, 8], [a0, 12],
        [4, 11], [8, 11], [a1, 12], [12, 8], [12, 4], [a1, a0], [8, 0]];
        const pointArrayB = [[8, 0], [4, 0], [b0, 4], [4, 8], [8, 8], [b1, 4], [8, 0]];
        // loopB.reverseChildrenInPlace();
        runRegionTest(allGeometry, pointArrayA, pointArrayB, xBase, yBase);
        xBase += 100;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Solids", "ParityRegionWithCoincidentEdges");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ParityRegionWithBadBoundary", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let xBase = 0.0;
    let yBase = 0.0;
    // q is an offset applied to corners to affect whether contiguous segments are colinear.
    //  q=0 makes lots of colinear edges.
    //  q=1 spreads corners to make all angles nonzero.
    // q1,q2 is an offset applied to a single point of the interior shape to change it from
    //   0,0 full edge touch
    //   1,0 single point touch from inside.
    //   1,1 full hole
    // -1,-1 partly out.
    for (const skewFactor of [0, 0.01, 0.072312]) {
      for (const q1q2 of [[-1, -1], [0, 0], [0, 1], [1, 1], [-1, -1]]) {
        for (const q of [1, 0]) {
          const a0 = -q;
          const a1 = 12 + q;
          const b0 = 4 - q;
          const b1 = 8 + q;
          const q1 = q1q2[0];
          const q2 = q1q2[1];
          const pointArrayA = [[8, 0], [4, 0], [a0, a0], [0, 4], [0, 8], [a0, 12],
          [4, 11], [8, 11], [a1, 12], [12, 8], [12, 4], [a1, a0], [8, 0]];
          const pointArrayB = [[8, q2], [4, q1], [b0, 4], [4, 7], [8, 7], [b1, 4], [8, q2]];
          for (const data of [pointArrayA, pointArrayB]) {
            for (const xy of data) {
              xy[1] += skewFactor * xy[0];
            }
          }
          runRegionTest(allGeometry, pointArrayA, pointArrayB, xBase, yBase);
          xBase += 100;
        }
        xBase += 200;
      }
      xBase = 0;
      yBase += 100;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Solids", "ParityRegionWithBadBoundary");
    expect(ck.getNumErrors()).equals(0);
  });
});
/**
 *
 * @param allGeometry array to receive (cloned) geometry
 * @param loops geometry to output
 * @param x0 x shift for positive area loops
 * @param y0 y shift for positive area loops
 * @param dy additional y shift for (1 step) negative loops, (2 steps) non-loop geometry, (3 step) inward offsets of positive area geometry.
 * @param y1 y shift for negative loops and stray geometry
 */
function saveShiftedLoops(allGeometry: GeometryQuery[], loops: SignedLoops | SignedLoops[], x0: number, y0: number, dy: number, positiveLoopOffset: number = 0.02) {
  if (Array.isArray(loops)) {
    for (const member of loops) {
      saveShiftedLoops(allGeometry, member, x0, y0, dy, positiveLoopOffset);
      x0 += dy;
    }
  } else {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops.positiveAreaLoops, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops.negativeAreaLoops, x0, y0 + dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops.slivers, x0, y0 + 2 * dy);
    if (positiveLoopOffset !== 0.0) {
      for (const loop of loops.positiveAreaLoops) {
        const offsetLoop = RegionOps.constructCurveXYOffset(loop, positiveLoopOffset);
        GeometryCoreTestIO.captureGeometry(allGeometry, offsetLoop, x0, y0 + 3 * dy);

      }
    }
  }
}
function runRegionTest(allGeometry: GeometryQuery[], pointArrayA: number[][], pointArrayB: number[][], xBase: number, yBase: number) {
  let x0 = xBase;
  let y0 = yBase;
  const loopA = Loop.createPolygon(GrowableXYZArray.create(pointArrayA));
  // loopA.reverseChildrenInPlace();
  const loopB = Loop.createPolygon(GrowableXYZArray.create(pointArrayB));
  // loopB.reverseChildrenInPlace();
  const region = ParityRegion.create();
  region.tryAddChild(loopA);
  region.tryAddChild(loopB);
  // Output geometry:
  //                    polygonXYAreaDifferenceLoopsToPolyface OffsetsOfPositives
  //    Mesh            polygonXYAreaUnionLoopsToPolyface      SliverAreas
  //    SweptSolid                                             NegativeAreas
  //    ParityRegionA   ParityRegionB                          PositiveAreas      <repeat stack per connected component>
  // Where ParityRegionA is by direct assembly of loops, let downstream sort.
  //       ParityRegionB is assembled by sortOuterAndHoleLoopsXY
  //
  const solid = LinearSweep.create(region, Vector3d.create(0, 0, 1), true)!;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0, y0);
  y0 += 15;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, solid, x0, y0);
  const builder = PolyfaceBuilder.create();
  builder.addLinearSweep(solid);
  const mesh = builder.claimPolyface();
  const mesh1 = PolyfaceQuery.cloneByFacetDuplication(mesh, true, DuplicateFacetClusterSelector.SelectOneByParity);
  y0 += 15;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);
  y0 += 15;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, x0, y0);

  const sortedLoops = RegionOps.sortOuterAndHoleLoopsXY([loopA, loopB]);
  x0 += 20;
  y0 = yBase;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, sortedLoops, x0, y0);
  y0 += 40;
  let y1 = y0 + 100;
  if (Checker.noisy.parityRegionAnalysis) {
    RegionOps.setCheckPointFunction(
      (name: string, graph: HalfEdgeGraph, _properties: string, _extraData?: any) => {
        GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y1 += 15);
        const euler = graph.countVertexLoops() - graph.countNodes() / 2.0 + graph.countFaceLoops();
        console.log(` Checkpoint ${name}.${_properties}`,
          { v: graph.countVertexLoops(), e: graph.countNodes(), f: graph.countFaceLoops(), eulerCharacteristic: euler });
        GraphChecker.dumpGraph(graph);
      });
  }
  const unionRegion = RegionOps.polygonXYAreaUnionLoopsToPolyface(pointArrayA, pointArrayB);
  RegionOps.setCheckPointFunction();
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionRegion, x0, y0);
  y0 += 20;
  const diffRegion = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(pointArrayA, pointArrayB);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, diffRegion, x0, y0);

  x0 += 15;
  y0 = yBase;
  const fixedRegions = RegionOps.constructAllXYRegionLoops(region);
  saveShiftedLoops(allGeometry, fixedRegions, x0, y0, 15.0);
}
/*
 * Intersect a plane with each primitive of a loop.
 * If any intersection is coincident, or at an endpoint, return undefined.
 * Otherwise (the good case!) return the intersection sorted as in-out pairs.
function findSimpleLoopPlaneCuts(loop: Loop, plane: Plane3dByOriginAndUnitNormal, fractionTol: number = 0.001): CurveLocationDetail[] | undefined {
  const cuts: CurveLocationDetail[] = [];
  let farDetail: CurveLocationDetail | undefined;
  const origin = plane.getOriginRef();
  for (const p of loop.children) {
    const num0 = cuts.length;
    p.appendPlaneIntersectionPoints(plane, cuts);
    for (let i = num0; i < cuts.length; i++) {
      const f = cuts[i].fraction;
      if (f < fractionTol || f + fractionTol > 1.0)
        return undefined;
      const tangentRay = cuts[i].curve?.fractionToPointAndDerivative(f)!;
      if (plane.getNormalRef().isPerpendicularTo(tangentRay.direction))
        return undefined;
      cuts[i].a = origin.distance(cuts[i].point);
      if (farDetail === undefined || cuts[i].a > farDetail.a)
        farDetail = cuts[i];
    }
  }
  if (cuts.length >= 2 && !Geometry.isOdd(cuts.length) && farDetail) {
    const sortVector = Vector3d.createStartEnd(plane.getOriginRef(), farDetail.point);
    for (const cut of cuts)
      cut.a = sortVector.dotProductStartEnd(origin, cut.point);
    cuts.sort((cutA: CurveLocationDetail, cutB: CurveLocationDetail) => (cutB.a - cutA.a));
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      if (Geometry.isSameCoordinate(cuts[i].a, cuts[i + 1].a))
        return undefined;
    }
    // ah, the cuts have been poked an prodded and appear to be simple pairs . .
    return cuts;
  }
  return undefined;
}
*/
/*
 * * Construct (by some unspecified means) a point that is inside the loop.
 * * Pass that point to the `accept` function.
 * * If the function returns a value (other than undefined) return that value.
 * * If the function returns undefined, try further points.
 * * The point selection process is unspecified.   For instance,
 * @param loop
 * @param accept
function classifyLoopByAnyInternalPoint<T>(loop: Loop, accept: (loop: Loop, testPoint: Point3d) => T | undefined): T | undefined {
  const testFractions = [0.321345, 0.921341276, 0.5, 0.25];
  for (const f of testFractions) {
    for (let primitiveIndex = 0; primitiveIndex < loop.children.length; primitiveIndex++) {
      const detail = loop.primitiveIndexAndFractionToCurveLocationDetailPointAndDerivative(primitiveIndex, f, false);
      if (detail) {
        const cutPlane = Plane3dByOriginAndUnitNormal.create(detail.point, detail.vectorInCurveLocationDetail!);
        if (cutPlane) {
          const cuts = findSimpleLoopPlaneCuts(loop, cutPlane);
          if (cuts && cuts.length >= 2) {
            const q = accept(loop, cuts[0].point.interpolate(0.5, cuts[1].point));
            if (q !== undefined)
              return q;
          }
        }
      }
    }
  }
  return undefined;
}
/*
/*
function classifyAreasByAnyInternalPoint(candidates: Loop[], accept: (loop: Loop, testPoint: Point3d) => boolean): Loop[] {
  const acceptedLoops: Loop[] = [];
  const testFractions = [0.321345, 0.921341276, 0.5, 0.25];
  for (const loop of candidates) {
    if (classifyLoopByAnyInternalPoint(loop, accept) !== undefined)
      acceptedLoops.push(loop);
  }
  return acceptedLoops;
}
*/
describe("GeneralSweepBooleans", () => {
  it("Rectangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 5, 7, 0, true)));
    const rectangle1B = Loop.create(LineString3d.create(Sample.createRectangle(-2, -2, 8, 7, 0, true)));
    const rectangle2 = Loop.create(LineString3d.create(Sample.createRectangle(1, 1, 6, 2, 0, true)));
    const area3 = Loop.create(
      LineSegment3d.createXYXY(2, 1.5, 5, 2.5), LineSegment3d.createXYXY(5, 2.5, 5, 3),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(5, 3, 0), Point3d.create(4, 4, 0), Point3d.create(2, 3, 0))!,
      LineSegment3d.createXYXY(2, 3, 2, 1.5));
    const area4 = Loop.create(
      LineSegment3d.createXYXY(-1, -1, -1, 9),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(-1, 9), Point3d.create(4, 4, 0), Point3d.create(-1, -1))!);
    const area5 = Loop.create(
      LineSegment3d.createXYXY(-1, 1, -1, 6),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(-1, 6), Point3d.create(1, 3.5), Point3d.create(-1, 1))!);
    const xStep = 20.0;
    let y0 = 0;
    for (const rectangle1 of [rectangle1B, rectangle1A, rectangle1B]) {
      let x0 = -xStep;
      exerciseAreaBooleans([rectangle1], [area5], ck, allGeometry, x0 += xStep, y0);
      exerciseAreaBooleans([rectangle1], [area5], ck, allGeometry, x0 += xStep, y0);
      exerciseAreaBooleans([rectangle1], [area5], ck, allGeometry, x0 += xStep, y0);
      exerciseAreaBooleans([rectangle1], [rectangle2], ck, allGeometry, x0 += xStep, y0);
      exerciseAreaBooleans([rectangle1], [rectangle2, area3], ck, allGeometry, x0 += xStep, y0);
      exerciseAreaBooleans([rectangle1], [area4], ck, allGeometry, x0 += xStep, y0);
      y0 += 100;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "Rectangles");
    expect(ck.getNumErrors()).equals(0);
  });
  it("HighParityRectangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const outerLoop = [[0, 0, 1], [0, 4, 1], [0, 4, 1], [0, 8, 1], [0, 8, 1], [0, 12, 1], [0, 12, 1], [0, 16, 1], [0, 16, 1], [0, 20, 1], [0, 20, 1], [0, 24, 1], [0, 24, 1], [4, 24, 1], [4, 24, 1], [4, 20, 1], [4, 20, 1], [4, 16, 1], [4, 16, 1], [4, 12, 1], [4, 12, 1], [4, 8, 1], [4, 8, 1], [4, 4, 1], [4, 4, 1], [4, 0, 1], [4, 0, 1], [0, 0, 1]];
    const inner1 = [[0, 4, 1], [4, 4, 1], [4, 4, 1], [4, 8, 1], [4, 8, 1], [4, 12, 1], [4, 12, 1], [4, 16, 1], [4, 16, 1], [4, 20, 1], [4, 20, 1], [0, 20, 1], [0, 20, 1], [0, 16, 1], [0, 16, 1], [0, 12, 1], [0, 12, 1], [0, 8, 1], [0, 8, 1], [0, 4, 1]];
    const inner2 = [[0, 8, 1], [4, 8, 1], [4, 8, 1], [4, 12, 1], [4, 12, 1], [0, 12, 1], [0, 12, 1], [0, 8, 1]];
    //   const inner3 = [[0, 12, 1], [4, 12, 1], [4, 12, 1], [4, 16, 1], [4, 16, 1], [0, 16, 1], [0, 16, 1], [0, 12, 1]];
    const inner3 = [[0, 12, 1], [3, 12, 1], [3, 12, 1], [3, 16, 1], [3, 16, 1], [0, 16, 1], [0, 16, 1], [0, 12, 1]];
    let x0 = 0;
    for (const innerLoops of [[inner1], [inner2], [inner3], [inner1, inner2], [inner1, inner3], [inner1, inner2, inner3]]) {
      const x1 = x0 + 10;
      const x2 = x0 + 20;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(outerLoop), x0, 0);
      for (const inner of innerLoops)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(inner), x0, 0);

      const regionDiff = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(outerLoop, innerLoops);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, regionDiff, x1, 0);
      const regionParity = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(outerLoop, innerLoops);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, regionParity, x2, 0);
      x0 += 50;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "HighParityRectangles");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Disjoints", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lowRectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 3, 1, 0, true)));
    const highRectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 3, 2, 4, 0, true)));
    const tallRectangleA = Loop.create(LineString3d.create(Sample.createRectangle(1, -1, 2, 5, 0, true)));
    const tallRectangleB = Loop.create(LineString3d.create(Sample.createRectangle(1, -1, 1.5, 5, 0, true)));
    exerciseAreaBooleans([lowRectangle], [highRectangle], ck, allGeometry, 0, 0);
    exerciseAreaBooleans([tallRectangleA], [lowRectangle, highRectangle], ck, allGeometry, 10, 0);
    exerciseAreaBooleans([tallRectangleB], [lowRectangle, highRectangle], ck, allGeometry, 20, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "Disjoints");
    expect(ck.getNumErrors()).equals(0);
  });

  it("MBDisjointCover", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const outer = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/outer.imjs", "utf8"))) as AnyRegion[];
    const inner = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/inner.imjs", "utf8"))) as AnyRegion[];
    let x0 = 0;
    const dy = 50;
    // for (const entry of outer) {
    //   RegionOps.consolidateAdjacentPrimitives(entry);
    // }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, outer, x0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, inner, x0, 50);
    const dx = 100.0;
    exerciseAreaBooleans(outer, inner, ck, allGeometry, (x0 += dx), -dy);
    for (const a of outer) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, a, x0 += 2 * dx, 0);
      for (const b of inner) {
        exerciseAreaBooleans([a], [b], ck, allGeometry, x0 += dx, 0);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "MBDisjointCover");
    expect(ck.getNumErrors()).equals(0);
  });
  it("HoleInA", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    const rectangle1B = Loop.create(LineString3d.create(Sample.createRectangle(1, 1, 9, 7, 0, true)));
    const region = ParityRegion.create(rectangle1A, rectangle1B);
    const dx = 20.0;
    let x0 = 0;
    for (const yB of [-0.5, 0.5, 6.5, 7.5, 3.0]) {
      const rectangle2 = Loop.create(LineString3d.create(Sample.createRectangle(5, yB, 6, yB + 1, 0, true)));
      exerciseAreaBooleans([region], [rectangle2], ck, allGeometry, x0 += dx, 0);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "HoleInA");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SharedEdgeElimination", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let y0 = 0;
    let x0 = 0;
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    const rectangle1B = Loop.create(LineString3d.create(Sample.createRectangle(10, 0, 15, 8, 0, true)));
    const rectangle1C = Loop.create(LineString3d.create(Sample.createRectangle(5, 5, 12, 10, 0, true)));

    y0 = 0;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1A, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1B, x0, y0);
    y0 += 10;
    const rectangleArray = [rectangle1A.getPackedStrokes()!, rectangle1B.getPackedStrokes()!];
    const fixup2 = RegionOps.polygonBooleanXYToLoops(rectangleArray, RegionBinaryOpType.Union, []);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixup2, x0, y0, 0);

    x0 += 30;
    y0 = 0;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1A, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1B, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1C, x0, y0);
    y0 += 15;
    rectangleArray.push(rectangle1C.getPackedStrokes()!);
    const fixup3 = RegionOps.polygonBooleanXYToLoops(rectangleArray, RegionBinaryOpType.Union, []);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixup3, x0, y0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "SharedEdgeElimination");
    expect(ck.getNumErrors()).equals(0);
  });

  it("DocDemo", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const filletedRectangle = CurveFactory.createRectangleXY(0, 0, 5, 4, 0, 1);
    const splitter = CurveFactory.createRectangleXY(1, -1, 6, 2);
    const union = RegionOps.regionBooleanXY(filletedRectangle, splitter, RegionBinaryOpType.Union);
    const intersection = RegionOps.regionBooleanXY(filletedRectangle, splitter, RegionBinaryOpType.Intersection);
    const diff = RegionOps.regionBooleanXY(filletedRectangle, splitter, RegionBinaryOpType.AMinusB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, filletedRectangle, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, splitter, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, union, 0, 10);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, intersection, 0, 20);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, diff, 0, 30);

    const manyRoundedRectangles = [];
    for (let a = 0; a < 5; a += 1) {
      manyRoundedRectangles.push(CurveFactory.createRectangleXY(a, a, a + 4, a + 1.75, 0, 0.5));
    }
    const splitterB0 = CurveFactory.createRectangleXY(0.5, 0.4, 6, 2.1, 0, 0);
    const splitterB1 = splitterB0.cloneTransformed(Transform.createFixedPointAndMatrix({ x: 1, y: 2, z: 0 }, Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(40)))) as Loop;
    const splitterB = [splitterB0, splitterB1];
    const unionB = RegionOps.regionBooleanXY(manyRoundedRectangles, splitterB, RegionBinaryOpType.Union);
    const intersectionB = RegionOps.regionBooleanXY(manyRoundedRectangles, splitterB, RegionBinaryOpType.Intersection);
    const diffB = RegionOps.regionBooleanXY(manyRoundedRectangles, splitterB, RegionBinaryOpType.AMinusB);
    const xB = 10;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, manyRoundedRectangles, xB, -20);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, splitterB, xB, -10);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, manyRoundedRectangles, xB, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, splitterB, xB, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionB, xB, 10);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, intersectionB, xB, 20);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, diffB, xB, 30);

    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "DocDemo");
    expect(ck.getNumErrors()).equals(0);
  });
});

function exerciseAreaBooleans(dataA: AnyRegion[], dataB: AnyRegion[],
  ck: Checker, allGeometry: GeometryQuery[], x0: number, y0Start: number) {
  const areas = [];
  const range = RegionOps.curveArrayRange(dataA.concat(dataB));
  const yStep = Math.max(15.0, 2.0 * range.yLength());
  let y0 = y0Start;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, dataA, x0, y0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, dataB, x0, y0);
  for (const opType of [RegionBinaryOpType.Union, RegionBinaryOpType.Intersection, RegionBinaryOpType.AMinusB, RegionBinaryOpType.BMinusA]) {
    y0 += yStep;
    const result = RegionOps.regionBooleanXY(dataA, dataB, opType);
    areas.push(RegionOps.computeXYArea(result!)!);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, result, x0, y0);
  }
  const area0 = areas[0]; // union
  const area123 = areas[1] + areas[2] + areas[3];
  ck.testCoordinate(area0, area123, " UnionArea = sum of parts");
}
