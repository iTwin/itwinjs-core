/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineString3d } from "../../curve/LineString3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { RegionOps } from "../../curve/RegionOps";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Loop, SignedLoops } from "../../curve/Loop";
import { Arc3d } from "../../curve/Arc3d";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { AnyCurve } from "../../curve/CurveChain";
import { CurveFactory } from "../../curve/CurveFactory";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Angle } from "../../geometry3d/Angle";
import { LinearSweep } from "../../solid/LinearSweep";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { ParityRegion } from "../../curve/ParityRegion";
import { GraphChecker } from "../topology/Graph.test";
import { HalfEdgeGraph } from "../../topology/Graph";
import { PolyfaceQuery, DuplicateFacetClusterSelector } from "../../polyface/PolyfaceQuery";
/* tslint:disable:no-console */

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
  if (Checker.noisy.ParityRegionAnalysis) {
    RegionOps.setCheckPointFunction(
      (name: string, graph: HalfEdgeGraph, _properties: string, _extraData?: any) => {
        GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y1 += 15);
        const euler = graph.countVertexLoops() - graph.countNodes() / 2.0 + graph.countFaceLoops();
        console.log(" Checkpoint " + name + "." + _properties,
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
