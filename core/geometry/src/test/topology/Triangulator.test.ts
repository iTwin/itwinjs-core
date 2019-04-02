/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Checker } from "../Checker";
import { LineString3d } from "../../curve/LineString3d";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";

import { HalfEdgeGraphMerge, HalfEdgeGraphOps } from "../../topology/Merging";
import { Triangulator } from "../../topology/Triangulation";

import { Angle } from "../../geometry3d/Angle";
import { Sample } from "../../serialization/GeometrySamples";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Loop } from "../../curve/Loop";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GraphChecker } from "./Graph.test";
import { HalfEdgeMask } from "../../topology/Graph";

function rotateArray(data: Point3d[], index0: number) {
  const out = [];
  for (let i = 0; i < data.length; i++) out.push(data[(index0 + i) % data.length].clone());
  return out;
}

/* tslint:disable: no-console */
describe("Triangulation", () => {
  const ck = new Checker();

  it("TriangulateLoops", () => {
    let yShift = 0;
    const dx = 40.0;
    const dy = 30.0;
    const allGeometry: GeometryQuery[] = [];
    for (const myLoops of [
      [[
        // Outer
        Point3d.create(0, 0, 0),
        Point3d.create(3, -2, 0),
        Point3d.create(6, 2, 0),
        Point3d.create(5, 5, 0),
        Point3d.create(4, 2, 0),
        Point3d.create(1, 3, 0)],
      [
        // Hole
        Point3d.create(1, 1, 0),
        Point3d.create(2, 2, 0),
        Point3d.create(3, 1, 0)]],
      // triangle with one hole
      [[Point3d.create(0, 0, 0), Point3d.create(5, -5, 0), Point3d.create(5, 5, 0)],
      [Point3d.create(2, 1, 0), Point3d.create(3, 1, 0), Point3d.create(3, 0, 0)]],
      // triangle with one hole, CCW orientation on the hole (expect it to be corrected)
      [[Point3d.create(0, 0, 0), Point3d.create(5, -5, 0), Point3d.create(5, 5, 0)],
      [Point3d.create(2, 1, 0), Point3d.create(3, 0, 0), Point3d.create(3, 1, 0)]],
      // rectangle with 2 holes
      [[Point3d.create(0, 0, 0), Point3d.create(5, 0, 0), Point3d.create(5, 5, 0), Point3d.create(0, 5, 0)],
      [Point3d.create(1, 1, 0), Point3d.create(2, 2, 0), Point3d.create(2, 1, 0)],
      [Point3d.create(3, 1.5, 0), Point3d.create(4, 3, 0), Point3d.create(4, 1.5, 0)]],
      // rectangle with 2 holes, duplicate points here and there
      [[Point3d.create(0, 0, 0), Point3d.create(5, 0, 0), Point3d.create(5, 0, 0), Point3d.create(5, 5, 0), Point3d.create(0, 5, 0)],
      [Point3d.create(1, 1, 0), Point3d.create(2, 2, 0), Point3d.create(2, 1, 0), Point3d.create(2, 1, 0)],
      [Point3d.create(3, 1.5, 0), Point3d.create(4, 3, 0), Point3d.create(4, 1.5, 0), Point3d.create(3, 1.5, 0)]],
      Sample.createStarsInStars(11, 8, 5, 2, 1, 4, 3, 3, false),
      Sample.createStarsInStars(10, 10, 2, 2, 2, 4, 3, 3, false),
      Sample.createStarsInStars(14, 8, 6, 2, 0.4, 5, 3, 4, false)]) {

      let xShift = 0;
      for (const loop of myLoops) {
        const g = LineString3d.create(loop);
        g.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(g);
      }
      xShift += dx;
      // triangulate and flip in the outer loop only . . .
      const graph1 = Triangulator.createTriangulatedGraphFromSingleLoop(myLoops[0]);
      const unflippedOuter = PolyfaceBuilder.graphToPolyface(graph1);
      unflippedOuter.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(unflippedOuter);
      xShift += dx;

      Triangulator.flipTriangles(graph1);
      const flippedOuter = PolyfaceBuilder.graphToPolyface(graph1);
      flippedOuter.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(flippedOuter);
      xShift += 2 * dx;

      // triangulate with the hole
      const graph2 = Triangulator.createTriangulatedGraphFromLoops(myLoops)!;
      const unflipped2 = PolyfaceBuilder.graphToPolyface(graph2);
      unflipped2.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(unflipped2);
      xShift += dx;

      Triangulator.flipTriangles(graph2);
      const flipped2 = PolyfaceBuilder.graphToPolyface(graph2);
      flipped2.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(flipped2);
      xShift += dx;

      yShift += dy;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "TriangulateAndFlip");
    ck.checkpoint("TriangulateAndFlip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SquareWaves", () => {
    let degreeCount = 0;
    for (const degrees of [0, 10, 30, 95, -20]) {
      let y0 = 0.0;
      for (const numPhase of [1, 3, 7, 15]) {
        const x0 = 4.0 + 6.0 * numPhase * degreeCount;
        const name = "SquareWave" + degreeCount + "." + numPhase;
        const pointA = Point3d.create(1.5 * numPhase, 0, 0);
        const yShiftVector = Vector3d.create(0, 2, 0);
        const rotation = Transform.createFixedPointAndMatrix(
          Point3d.create(1.5 * numPhase, 0, 0),
          Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(degrees)) as Matrix3d);
        const points = Sample.createSquareWave(Point3d.create(0, 0, 0), 1, 0.5, 2, numPhase, 1);
        rotation.multiplyVector(yShiftVector, yShiftVector);
        if (degrees !== 0.0)
          rotation.multiplyPoint3dArrayInPlace(points);
        if (Checker.noisy.squareWaves)
          console.log(name, "Rotation angle ", degrees, " numPhase", numPhase);
        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points);
        const pfA = PolyfaceBuilder.graphToPolyface(graph);
        Triangulator.flipTriangles(graph);

        GraphChecker.verifyMaskAroundFaces(ck, graph, HalfEdgeMask.EXTERIOR);
        const pfB = PolyfaceBuilder.graphToPolyface(graph);
        // const pfC = PolyfaceBuilder.graphToPolyface(graph);
        const ls = LineString3d.create(points);
        const ls1 = LineString3d.create(Point3d.create(), pointA);
        ls.tryTranslateInPlace(x0, y0);
        pfA.tryTranslateInPlace(x0 + yShiftVector.x, y0 + yShiftVector.y, 0);
        pfB.tryTranslateInPlace(x0 + 2 * yShiftVector.x, y0 + 2 * yShiftVector.y, 0);
        // pfC.tryTranslateInPlace(x0 + 4 * yShiftVector.x, y0 + 4 * yShiftVector.y, 0);

        ls1.tryTranslateInPlace(x0, y0);
        y0 += 3 + 4 * numPhase;
        GeometryCoreTestIO.saveGeometry([ls1, ls, pfA, pfB], "Graph", name);
      }
      degreeCount++;
    }
    ck.checkpoint("SquareWaves");
    expect(ck.getNumErrors()).equals(0);
  });
});

function testGraphFromSegments(ck: Checker, x0: number, segments: LineSegment3d[], expectSingleLoop: boolean, fileName: string, outputAnnotatedGeometry: boolean = true) {
  const theGraph = HalfEdgeGraphMerge.formGraphFromSegments(segments);
  GraphChecker.verifySignedFaceCounts(ck, theGraph, undefined, 1, undefined);
  const dx = x0;
  const yStep = 25;
  let dy = -yStep;
  const allGeometry: GeometryQuery[] = [];
  GeometryCoreTestIO.captureGeometry(allGeometry, segments, dx, dy += yStep);
  if (outputAnnotatedGeometry)
    GraphChecker.captureAnnotatedGraph(allGeometry, theGraph, dx, dy += yStep);
  if (expectSingleLoop)
    GraphChecker.verifyGraphCounts(ck, theGraph, true, 2, undefined, undefined);
  HalfEdgeGraphOps.formMonotoneFaces(theGraph);
  GraphChecker.verifySignedFaceCounts(ck, theGraph, undefined, 1, undefined);
  GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(theGraph), dx, dy += yStep);
  if (outputAnnotatedGeometry)
    GraphChecker.captureAnnotatedGraph(allGeometry, theGraph, dx, dy += yStep);

  // console.log("Total Faces: ", theGraph.collectFaceLoops().length);
  // for (const face of faces) {
  //   Triangulator.earcutFromSingleFaceLoop(face);
  // }
  // exportGraph(theGraph, "AfterTriangulation");
  GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", fileName);

}
describe("MonotoneFaces", () => {
  // 5 sides -- tall rectangle with upward V at bottom edge.

  // somewhat nasty polygon ....
  const loopB: LineSegment3d[] = [
    LineSegment3d.create(Point3d.create(0, 20), Point3d.create(0, 0)),
    LineSegment3d.create(Point3d.create(0, 0), Point3d.create(3, 3)),
    LineSegment3d.create(Point3d.create(3, 3), Point3d.create(6, 0)),
    LineSegment3d.create(Point3d.create(6, 0), Point3d.create(6, 8)),
    LineSegment3d.create(Point3d.create(6, 8), Point3d.create(9, 5)),
    LineSegment3d.create(Point3d.create(9, 5), Point3d.create(10, 2)),
    LineSegment3d.create(Point3d.create(10, 2), Point3d.create(12, 7)),
    LineSegment3d.create(Point3d.create(12, 7), Point3d.create(14, 5)),
    LineSegment3d.create(Point3d.create(14, 5), Point3d.create(18, 15)),
    LineSegment3d.create(Point3d.create(18, 15), Point3d.create(16, 17)),
    LineSegment3d.create(Point3d.create(16, 17), Point3d.create(16.5, 20)),
    LineSegment3d.create(Point3d.create(16.5, 20), Point3d.create(14, 18)),
    LineSegment3d.create(Point3d.create(14, 18), Point3d.create(15, 22)),
    LineSegment3d.create(Point3d.create(15, 22), Point3d.create(12, 21)),
    LineSegment3d.create(Point3d.create(12, 21), Point3d.create(10, 20)),
    LineSegment3d.create(Point3d.create(10, 20), Point3d.create(9, 17)),
    LineSegment3d.create(Point3d.create(9, 17), Point3d.create(6, 15)),
    LineSegment3d.create(Point3d.create(6, 15), Point3d.create(0, 20)),
  ];

  it("loopA", () => {
    const ck = new Checker();
    let id = 0;
    const ax = 5.0;
    const ay = 10.0;
    // const e = 0.1;
    for (const loopA of [
      Sample.creatVerticalStaggerPolygon(-1, -2, 4, 3, ax, ay, 0, 0),
      Sample.creatVerticalStaggerPolygon(3, 0, 0, 4, ax, ay, 0, 0),
      // Sample.creatVerticalStaggerPolygon(3, e, e, 3, ax, ay, 0, 0),
      // Sample.creatVerticalStaggerPolygon(3, 0, 0, 3, ax, ay, 0, 0),
      // Sample.creatVerticalStaggerPolygon(-3, 2, 1, 2, ax, ay, 0, 0),
      // Sample.creatVerticalStaggerPolygon(3, 0, 0, 3, ax, ay, 0, 0),
      // Sample.creatVerticalStaggerPolygon(3, 0, 0, -3, ax, ay, 0, 0),
      // Sample.creatVerticalStaggerPolygon(3, 0, 0, -5, ax, ay, -1, 0),
      // Sample.creatVerticalStaggerPolygon(7, 0, 0, -6, ax, ay, -0.5, 0),
    ]) {
      const segmentA = Sample.convertPointsToSegments(loopA);
      testGraphFromSegments(ck, id * 30, segmentA, true, "LoopA" + id++, false);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("loopB", () => {
    const ck = new Checker();
    testGraphFromSegments(ck, 0, loopB, true, "LoopB");
    expect(ck.getNumErrors()).equals(0);
  });

  it("HashMerge", () => {
    const ck = new Checker();
    const a = 1.0;
    const b = 2.0;
    const allGeometry: GeometryQuery[] = [];
    let dx = 0.0;
    let dy = 0.0;
    for (const numLine of [2]) {
      const lines = [];
      const xMin = 0;
      const xMax = (numLine + 1) * a;
      const yMin = 0;
      const yMax = (numLine + 1) * b;
      const yStep = yMax + b;
      // horizontal lines ...
      for (let i = 1; i <= numLine; i++) {
        lines.push(LineSegment3d.createXYXY(xMin, i * b, xMax, i * b));
      }
      // vertical lines
      for (let i = 1; i <= numLine; i++) {
        lines.push(LineSegment3d.createXYXY(i * a, yMin, i * a, yMax));
      }
      const theGraph = HalfEdgeGraphMerge.formGraphFromSegments(lines);

      GeometryCoreTestIO.captureGeometry(allGeometry, lines, dx, dy);
      dy += yStep;

      GraphChecker.captureAnnotatedGraph(allGeometry, theGraph, dx, dy);
      dy += yStep;

      const numFace = (numLine - 1) * (numLine - 2);
      GraphChecker.verifyGraphCounts(ck, theGraph, true, numFace, (numLine + 2) * (numLine + 2) - 4, a * b * numFace);

      HalfEdgeGraphOps.formMonotoneFaces(theGraph);
      GraphChecker.captureAnnotatedGraph(allGeometry, theGraph, dx, dy);
      dy += yStep;
      // console.log("Total Faces: ", theGraph.collectFaceLoops().length);
      // for (const face of faces) {
      //   Triangulator.earcutFromSingleFaceLoop(face);
      // }
      // exportGraph(theGraph, "AfterTriangulation");
      dx += a * (numLine + 4);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "HashMerge");
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("Triangulation", () => {
  it("LargeCountTriangulation", () => {
    const baseVectorA = Vector3d.create(0, 0, 0);
    const allGeometry = [];
    // REMARK
    // EDL Feb 20 2019
    // Triangulation introduces a search zheap (not understood by me at this time) for very large polygons.
    // With original trigger of 80 edges, some invalid triangulations occur for numRecursion = 2 (the original limit)
    // Raise the trigger to 200 and all is fine.
    // But the statement coverage drops significantly -- 94% to 93.37
    // numRecursion = 3 generates larger polygons (around 400) and again there are some failures.
    // so we conclude the zheap is large chunk of code with some bugs.
    // This is an unlikely use case at this time.  So
    //   1) the heap trigger is left at 200 (see Triangulation.ts)
    //   2) add a method `Triangulation.setAndReturnHeapTrigger (number): number`
    // Someday debug that ....
    for (const numRecursion of [1, 2, 3]) {
      for (const perpendicularFactor of [0.85, -1.0, -0.5]) {
        let yMax = 0.0;
        const baseVectorB = baseVectorA.clone();
        for (const generatorFunction of [
          Sample.createFractalSquareReversingPattern,
          Sample.createFractalDiamonConvexPattern,
          Sample.createFractalLReversingPatterh,
          Sample.createFractalHatReversingPattern,
          Sample.createFractalLMildConcavePatter]) {
          const points = generatorFunction(numRecursion, perpendicularFactor);
          const range = Range3d.createArray(points);
          const dy = range.yLength();
          yMax = Math.max(yMax, dy);
          const transform = Transform.createTranslation(baseVectorB);
          transform.multiplyPoint3dArray(points, points);
          baseVectorB.addInPlace(Vector3d.create(2 * range.xLength(), 0, 0));
          allGeometry.push(Loop.create(LineString3d.create(points)));
          const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points);
          if (graph) {
            const pfA = PolyfaceBuilder.graphToPolyface(graph);
            pfA.tryTranslateInPlace(0, 2.0 * dy, 0);
            allGeometry.push(pfA);
            Triangulator.flipTriangles(graph);
            const pfB = PolyfaceBuilder.graphToPolyface(graph);
            pfB.tryTranslateInPlace(0, 4.0 * dy, 0);
            allGeometry.push(pfB);
          }
        }
        baseVectorA.addInPlace(Vector3d.create(0, 8.0 * yMax, 0));
      }
      baseVectorA.x += 100;
      baseVectorA.y = 0.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "LargeCountTriangulation");
  });
  /* These cases had problems -- but maybe only due to bad input?
    it.only("ProblemTriangulation", () => {
      Triangulator.setAndReturnHeapTrigger(80);
      const baseVectorA = Vector3d.create(0, 0, 0);
      const allGeometry = [];
      for (let maxCut = 50; maxCut < 91; maxCut++) {
        const numRecursion = 2;
        const perpendicularFactor = 0.8;
        let yMax = 0.0;
        let xStep = 0.0;
        const baseVectorB = baseVectorA.clone();
        for (const generatorFunction of [
          Sample.createFractalLMildConcavePatter,
        ]) {
          const points = generatorFunction(numRecursion, perpendicularFactor);
          const range = Range3d.createArray(points);
          const dy = range.yLength();
          yMax = Math.max(yMax, dy);
          xStep += 2.0 * range.xLength();
          const transform = Transform.createTranslation(baseVectorB);
          transform.multiplyPoint3dArray(points, points);
          baseVectorB.addInPlace(Vector3d.create(2 * range.xLength(), 0, 0));
          allGeometry.push(Loop.create(LineString3d.create(points)));
          const graph = Triangulator.earcutSingleLoop(points);
          if (graph) {
            const pfA = PolyfaceBuilder.graphToPolyface(graph);
            pfA.tryTranslateInPlace(0, 2.0 * dy, 0);
            allGeometry.push(pfA);
            Triangulator.cleanupTriangulation(graph);
            const pfB = PolyfaceBuilder.graphToPolyface(graph);
            pfB.tryTranslateInPlace(0, 4.0 * dy, 0);
            allGeometry.push(pfB);
          }
        }
        baseVectorA.x += 2.0 * xStep;
      }
      Triangulator.setAndReturnHeapTrigger(undefined);
      GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "ProblemTriangulation");
    });
    it("ProblemTriangulationB", () => {
      Triangulator.setAndReturnHeapTrigger(5);

      const baseVectorA = Vector3d.create(0, 0, 0);
      const allGeometry = [];
      let yMax = 0.0;
      let xStep = 0.0;
      const basePoints = [
        Point3d.create(0.250, -0.100, 0.000),
        Point3d.create(0.750, -0.100, 0.000),
        Point3d.create(1.000, 1.000, 0.000),
        Point3d.create(1.350, 1.150, 0.000),
        Point3d.create(2.000, 2.000, 0.000),
        Point3d.create(2.100, 2.250, 0.000),
        Point3d.create(2.100, 2.750, 0.000)];
      for (const rotateIndex of [0, 1, 2, 3, 4, 5, 6]) {
        const points = rotateArray(basePoints, rotateIndex);
        const range = Range3d.createArray(points);
        const dy = range.yLength();
        yMax = Math.max(yMax, dy);
        xStep = 2.0 * range.xLength();
        const transform = Transform.createTranslation(baseVectorA);
        transform.multiplyPoint3dArray(points, points);
        allGeometry.push(Loop.create(LineString3d.create(points)));
        const graph = Triangulator.earcutSingleLoop(points);
        if (graph) {
          const pfA = PolyfaceBuilder.graphToPolyface(graph);
          pfA.tryTranslateInPlace(0, 2.0 * dy, 0);
          allGeometry.push(pfA);
          Triangulator.cleanupTriangulation(graph);
          const pfB = PolyfaceBuilder.graphToPolyface(graph);
          pfB.tryTranslateInPlace(0, 4.0 * dy, 0);
          allGeometry.push(pfB);
        }
        baseVectorA.x += xStep;
      }
      // get back to base heap trigger ...
      Triangulator.setAndReturnHeapTrigger(undefined);

      GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "ProblemTriangulationB");
    });
  */
  it("TriangulationWithColinearVertices", () => {
    const numTheta = 5;
    const numThetaSkip = 1;
    const allGeometry = [];
    const r = 1.0;
    let x0 = 0.0;
    const dy = 2.0;
    for (const numColinear of [1, 3, 7]) {
      const points = [Point3d.create(-r, 0, 0)];
      for (let i = 0; i <= numColinear; i++)
        points.push(Point3d.create(Geometry.interpolate(-r, i / numColinear, r), 0, 0));
      for (let i = 1; i < numTheta; i++) {
        const theta = Angle.createDegrees(i * 180 / numTheta);
        points.push(Point3d.create(r * theta.cos(), r * theta.sin(), 0));
      }
      // run the triangulator with the array rotated to each x-axis point, and one of every numThetaSkip points around the arc.
      let y0 = 0.0;
      for (let rotation = 0; rotation < points.length; rotation += (rotation < numColinear ? 1 : numThetaSkip)) {
        const pointsB = rotateArray(points, rotation);
        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(pointsB);
        if (graph) {
          const pfA = PolyfaceBuilder.graphToPolyface(graph);
          pfA.tryTranslateInPlace(x0, y0 + 2.0 * dy, 0);
          allGeometry.push(pfA);
          Triangulator.flipTriangles(graph);
          const pfB = PolyfaceBuilder.graphToPolyface(graph);
          pfB.tryTranslateInPlace(x0, y0 + 4.0 * dy, 0);
          allGeometry.push(pfB);
          y0 += 10.0;
        }
      }
      x0 += 4.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "TriangulationWithColinearVertices");
  });
  // public static createCutPie(x0: number, y0: number, radius: number, sweep: AngleSweep, numRadialEdges: number, numArcEdges: number, addClosure = false) {
  it("PieCuts", () => {

    const numThetaSkip = 3;
    const allGeometry = [];
    const r = 1.0;
    let x0 = 0.0;
    // proimise: all x above x0 is free space.
    for (const points of [
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 1, 4, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 5, 12, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 90), 2, 5, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 3, 9, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 90), 3, 4, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 5, 12, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 270), 2, 8, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 270), 5, 12, false),
      Sample.createCutPie(0, 0, 100 * r, AngleSweep.createStartEndDegrees(0, 180), 5, 12, false),
    ]) {
      // run the triangulator with the array rotated to each x-axis point, and one of every numThetaSkip points around the arc.
      let y0 = 0.0;
      const range = Range3d.createArray(points);
      const dx = range.xLength();
      const dy = range.yLength();
      const ex = x0 - range.low.x;
      x0 += r;
      for (let rotation = 0; rotation < points.length; rotation += (rotation < 4 ? 1 : numThetaSkip)) {
        const pointsB = rotateArray(points, rotation);
        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(pointsB);
        const ls = LineString3d.create(points);
        ls.tryTranslateInPlace(ex, 0);
        allGeometry.push(ls);
        if (graph) {
          const pfA = PolyfaceBuilder.graphToPolyface(graph);
          pfA.tryTranslateInPlace(ex, y0 + 1.5 * dy, 0);
          allGeometry.push(pfA);
          Triangulator.flipTriangles(graph);
          const pfB = PolyfaceBuilder.graphToPolyface(graph);
          pfB.tryTranslateInPlace(ex, y0 + 3.0 * dy, 0);
          allGeometry.push(pfB);
          y0 += 8.0 * dy;
        }
      }
      x0 += 2.0 * dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "PieCuts");
  });
});
