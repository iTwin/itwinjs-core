/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { Point3dArray, PolyfaceQuery, PolylineOps} from "../../core-geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { SweepContour } from "../../solid/SweepContour";
import { HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphSearch } from "../../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge, HalfEdgeGraphOps } from "../../topology/Merging";
import { Triangulator } from "../../topology/Triangulation";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { GraphChecker } from "./Graph.test";

function rotateArray(data: Point3d[], index0: number) {
  const out = [];
  for (let i = 0; i < data.length; i++) out.push(data[(index0 + i) % data.length].clone());
  return out;
}

/* eslint-disable no-console */
describe("Triangulation", () => {
  it("NullTriangulations", () => {
    const ck = new Checker();
    ck.testUndefined(Triangulator.createTriangulatedGraphFromPoints([Point3d.create(0, 0, 0)]));
    ck.testUndefined(Triangulator.createTriangulatedGraphFromLoops([]));

    expect(ck.getNumErrors()).equals(0);
  });
  it("TriangulateLoops", () => {
    const ck = new Checker();
    let yShift = 0;
    const dx = 40.0;
    const dy = 30.0;
    const allGeometry: GeometryQuery[] = [];
    for (const myLoops of [
      [[Point3d.create(1, -1, 0), Point3d.create(2, -1, 0), Point3d.create(2, 1, 0)]],
      // outer
      [[Point3d.create(0, 0, 0), Point3d.create(3, -2, 0), Point3d.create(6, 2, 0), Point3d.create(5, 5, 0), Point3d.create(4, 2, 0), Point3d.create(1, 3, 0)],
      // hole
      [Point3d.create(1, 1, 0), Point3d.create(2, 2, 0), Point3d.create(3, 1, 0)]],
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
        GeometryCoreTestIO.captureGeometry(allGeometry, g, xShift, yShift);
      }
      xShift += dx;
      // triangulate and flip in the outer loop only . . .
      const graph1 = Triangulator.createTriangulatedGraphFromSingleLoop(myLoops[0]);
      if (graph1) {
        const unflippedOuter = PolyfaceBuilder.graphToPolyface(graph1);
        unflippedOuter.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(unflippedOuter);
        xShift += dx;

        Triangulator.flipTriangles(graph1);
        const flippedOuter = PolyfaceBuilder.graphToPolyface(graph1);
        flippedOuter.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(flippedOuter);
        xShift += 2 * dx;
      } else
        xShift += 3 * dx;
      // triangulate with the hole
      const graph2 = Triangulator.createTriangulatedGraphFromLoops(myLoops)!;
      if (graph2) {
        const unflipped2 = PolyfaceBuilder.graphToPolyface(graph2);
        unflipped2.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(unflipped2);
        xShift += dx;

        Triangulator.flipTriangles(graph2);
        const flipped2 = PolyfaceBuilder.graphToPolyface(graph2);
        flipped2.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(flipped2);
        xShift += dx;
      } else
        xShift += 3 * dx;

      yShift += dy;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "TriangulateAndFlip");
    ck.checkpoint("TriangulateAndFlip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("TriangulateBadLoops", () => {
    const ck = new Checker();

    let yShift = 0;
    const dx = 40.0;
    const dy = 30.0;
    const allGeometry: GeometryQuery[] = [];
    for (const myLoops of [
      // rectangle with hole not fully contained
      [[Point3d.create(0, 0, 0), Point3d.create(5, 0, 0), Point3d.create(5, 5, 0), Point3d.create(0, 5, 0)],
      [Point3d.create(1, -1, 0), Point3d.create(2, -1, 0), Point3d.create(2, 1, 0)]],
      // Edge-Edge contact from hole to parent along lower edge.
      [[Point3d.create(0, 0, 0), Point3d.create(4, 0, 0), Point3d.create(8, 0, 0), Point3d.create(10, 0, 0), Point3d.create(10, 5, 0), Point3d.create(0, 5, 0)],
      [Point3d.create(4, 0, 0), Point3d.create(8, 0, 0), Point3d.create(8, 2, 0), Point3d.create(4, 2, 0)]],
      // Edge-Edge contact from hole to parent along right edge.
      [[Point3d.create(10, 0, 0), Point3d.create(10, 4), Point3d.create(10, 8), Point3d.create(10, 10, 0), Point3d.create(0, 10, 0), Point3d.create(0, 0, 0)],
      [Point3d.create(10, 4), Point3d.create(10, 8), Point3d.create(6, 8)]],
    ]) {

      let xShift = 0;
      for (const loop of myLoops) {
        const g = LineString3d.create(loop);
        GeometryCoreTestIO.captureGeometry(allGeometry, g, xShift, yShift);
      }
      xShift += dx;
      // triangulate with the hole
      const graph2 = Triangulator.createTriangulatedGraphFromLoops(myLoops)!;
      if (graph2) {
        const unflipped2 = PolyfaceBuilder.graphToPolyface(graph2);
        unflipped2.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(unflipped2);
        xShift += dx;

        Triangulator.flipTriangles(graph2);
        const flipped2 = PolyfaceBuilder.graphToPolyface(graph2);
        flipped2.tryTranslateInPlace(xShift, yShift, 0);
        allGeometry.push(flipped2);
        xShift += dx;
      } else
        xShift += 3 * dx;

      yShift += dy;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "TriangulateBadLoops");
    ck.checkpoint("TriangulateAndFlip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SquareWaves", () => {
    const ck = new Checker();
    let degreeCount = 0;
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    for (const degrees of [0, 10, 30, 95, -20]) {
      let y0 = 0.0;
      for (const numPhase of [1, 3, 7, 15]) {
        const name = `SquareWave ${degreeCount}.${numPhase}`;
        degreeCount++;
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
        if (ck.testType(graph, HalfEdgeGraph)) {
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
          GeometryCoreTestIO.captureGeometry(allGeometry, [ls1, ls, pfA, pfB], x0, y0);
        }
        y0 += 3 + 4 * numPhase;
      }
      x0 += 100.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "SquareWaves");
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
      testGraphFromSegments(ck, id * 30, segmentA, true, `LoopA${id++}`, false);
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
  it("TriangulateFractals", () => {
    const baseVectorA = Vector3d.create(0, 0, 0);
    const allGeometry = [];
    // REMARK
    // EDL Feb 20 2019
    // Triangulation introduces a search z heap (not understood by me at this time) for very large polygons.
    // With original trigger of 80 edges, some invalid triangulations occur for numRecursion = 2 (the original limit)
    // Raise the trigger to 200 and all is fine.
    // But the statement coverage drops significantly -- 94% to 93.37
    // numRecursion = 3 generates larger polygons (around 400) and again there are some failures.
    // so we conclude the z heap is large chunk of code with some bugs.
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
          Sample.createFractalDiamondConvexPattern,
          Sample.createFractalLReversingPattern,
          Sample.createFractalHatReversingPattern,
          Sample.createFractalLMildConcavePatter]) {
          for (const degrees of [0, 10, 79]) {
            const points = generatorFunction(numRecursion, perpendicularFactor);
            const transform0 = Transform.createFixedPointAndMatrix(points[0], Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
            transform0.multiplyPoint3dArrayInPlace(points);
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
      }
      baseVectorA.x += 100;
      baseVectorA.y = 0.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "TriangulateFractals");
  });
  /* These cases had problems -- but maybe only due to bad input?
    it("ProblemTriangulation", () => {
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
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "TriangulationWithColinearVertices");
  });
  // public static createCutPie(x0: number, y0: number, radius: number, sweep: AngleSweep, numRadialEdges: number, numArcEdges: number, addClosure = false) {
  it("PieCuts", () => {
    const ck = new Checker();

    const numThetaSkip = 3;
    const allGeometry: GeometryQuery[] = [];
    const r = 1.0;
    let x0 = 0.0;
    // promise: all x above x0 is free space.
    for (const points of [
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 2, 2, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 2, 3, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 2, 4, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 2, 6, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 1, 4, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 5, 12, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 1, 4, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 90), 2, 5, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 3, 9, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 90), 3, 4, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(0, 180), 5, 12, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(-10, 270), 2, 8, false),
      Sample.createCutPie(0, 0, r, AngleSweep.createStartEndDegrees(-30, 200), 5, 12, false),
      Sample.createCutPie(0, 0, 100 * r, AngleSweep.createStartEndDegrees(0, 180), 5, 12, false),
    ]) {
      // run the triangulator with the array rotated to each x-axis point, and one of every numThetaSkip points around the arc.
      let y0 = 0.0;
      const range = Range3d.createArray(points);
      const expectedTriangleCount = points.length - 2;   // we know that the point array is unclosed !!!
      const dx = range.xLength();
      const dy = range.yLength();
      const ex = x0 - range.low.x;
      const polygonArea = PolygonOps.areaXY(points);
      x0 += r;
      for (let rotation = 0; rotation < points.length; rotation += (rotation < 4 ? 1 : numThetaSkip)) {
        const pointsB = rotateArray(points, rotation);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsB, x0, y0);
        Triangulator.clearAndEnableDebugGraphCapture(true);
        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(pointsB)!;
        if (ck.testDefined(graph, "unexpected empty graph from triangulation") && graph) {
          const faceSummary = HalfEdgeGraphSearch.collectFaceAreaSummary(graph, false);
          ck.testExactNumber(1, faceSummary.numNegative, "Exactly one outer loop after triangulation");
          ck.testExactNumber(0, faceSummary.numZero, " no slivers");
          ck.testExactNumber(expectedTriangleCount, faceSummary.numPositive, "triangle count");
          ck.testCoordinate(polygonArea, faceSummary.positiveSum, "positive area sum");
          const pfA = PolyfaceBuilder.graphToPolyface(graph);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, pfA, ex, y0 + 1.5 * dy, 0);
          Triangulator.flipTriangles(graph);
          const pfB = PolyfaceBuilder.graphToPolyface(graph);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, pfB, ex, y0 + 3.0 * dy, 0);
        } else {
          const badGraph = Triangulator.claimDebugGraph();
          GraphChecker.captureAnnotatedGraph(allGeometry, badGraph, ex, y0 + 2.0 * dy);
        }
        y0 += 8.0 * dy;
      }
      x0 += 2.0 * dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "PieCuts");
    expect(ck.getNumErrors()).equals(0);
  });

  it("FacetsInCircle", () => {
    const ck = new Checker();
    const savedMeshes: GeometryQuery[] = [];
    let x0 = 0;
    for (const r of [1.0, 3.234242342]) {
      let y0 = 0;
      for (const n of [4, 7, 16, 19]) {
        const points = [];
        for (let i = 0; i < n; i++) {
          const angle = Angle.createDegrees(i * 360 / n);
          points.push(Point3d.create(r * angle.cos(), r * angle.sin()));
        }
        points.push(points[0].clone());
        x0 += 2.0 * r;
        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points)!;
        ck.testExactNumber(n - 1, graph.countFaceLoops());
        if (graph)
          GeometryCoreTestIO.captureGeometry(savedMeshes, PolyfaceBuilder.graphToPolyface(graph), x0, y0, 0);
        y0 += 2.0 * r;
      }
    }

    GeometryCoreTestIO.saveGeometry(savedMeshes, "Triangulation", "Circles");
    expect(ck.getNumErrors()).equals(0);
  });
  it("DegeneratePolygons", () => {
    const ck = new Checker();
    for (const points of [
      [{ x: 5.36, y: 8.85, z: 23.78 },
      { x: 8.822141987513945, y: 6.843546977282015, z: 23.78 },
      { x: 8.822141987513945, y: 6.843546977282015, z: 23.78 },
      { x: 5.36, y: 8.85, z: 23.78 },
      { x: 5.36, y: 8.85, z: 23.78 }],
      [{ x: 0, y: 0, z: 0 },
      { x: 3.4621419875139443, y: -2.0064530227179844, z: 0 },
      { x: 0, y: 0, z: 0 }],
      [{ x: 0, y: 0, z: 0 },
      { x: 2.9577539019415324, y: -0.8576720613542541, z: 0 },
      { x: 8.881784197001252e-16, y: 0, z: 0 }],
    ]) {
      const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points);
      if (graph) {
        const polyface = PolyfaceBuilder.graphToPolyface(graph);
        ck.testExactNumber(polyface.facetCount, 0, "degenerate triangle produced no facets.");
      }
    }
  });
  it("facets for ACS", () => {
    const ck = new Checker();
    const savedMeshes = [];
    let counter0 = 0;
    for (const a of [4.5]) { // , 4.1, 3.5, 3]) {
      // sawtooth. Triangulate leading portions that are valid polygons (edge from origin does not cross)
      const basePoints = [
        Point3d.create(0, 1, 0),
        Point3d.create(4, 1, 0),
        Point3d.create(a, 0, 0),
        Point3d.create(6, 2, 0),
        Point3d.create(a, 4, 0),
        Point3d.create(4, 3, 0),
        Point3d.create(0, 3, 0)];
      let counter1 = 0;
      const needParams = true;
      for (let startIndex = 0; startIndex < basePoints.length; startIndex++) {
        const arrowPoints = [];
        for (let j = 0; j < basePoints.length; j++)
          arrowPoints.push(basePoints[(startIndex + j) % basePoints.length]);
        const loop = Loop.createPolygon(arrowPoints);
        const sweepContour = SweepContour.createForLinearSweep(loop);

        const options = new StrokeOptions();
        options.needParams = false;
        options.needParams = needParams;
        const builder = PolyfaceBuilder.create(options);

        sweepContour!.emitFacets(builder, false);
        const polyface = builder.claimPolyface(true);
        if (!ck.testExactNumber(arrowPoints.length - 2, polyface.facetCount, `Triangle count in arrow ${counter0}.${counter1}   needParams${needParams}`)
          || Checker.noisy.acsArrows) {
          console.log(` Triangulation From Start index ${startIndex} needParams ${needParams} `);
          console.log(`   arrow parameter ${a}`);
          console.log(`    Facet Count ${polyface.facetCount} counter0 ${counter0}   counter1 ${counter1}`);
          console.log(prettyPrint(arrowPoints));
          const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
          console.log(prettyPrint(jsPolyface));
        }
        polyface.tryTranslateInPlace(counter1 * 10, counter0 * 10, 0);
        savedMeshes.push(polyface);
        counter1++;
      }
      counter0++;
    }
    GeometryCoreTestIO.saveGeometry(savedMeshes, "Triangulation", "ACSArrows");
    expect(ck.getNumErrors()).equals(0);
  });
  it("BowTies", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const step = 10.0;
    let dx = 0.;
    for (const a of [4.5]) { // , 4.1, 3.5, 3]) {
      // Create bow ties.   Start triangulation at each vertex.
      const basePoints = [
        Point3d.create(0, 0, 0),
        Point3d.create(4, 0, 0),
        Point3d.create(0, a, 0),
        Point3d.create(4, a, 0)];
      for (let startIndex = 0; startIndex < basePoints.length; startIndex++) {
        let dy = 0.0;
        const shiftedPoints = [];
        for (let j = 0; j < basePoints.length; j++)
          shiftedPoints.push(basePoints[(startIndex + j) % basePoints.length]);

        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(shiftedPoints)!;
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(shiftedPoints), dx, dy += step);
        GraphChecker.captureAnnotatedGraph(allGeometry, graph, dx, dy += step);
        dx += step;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "BowTies");
    expect(ck.getNumErrors()).equals(0);
  });

  it("FlexQuad", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const step = 10.0;
    let dx = 0.;
    for (const a of [4.5]) { // , 4.1, 3.5, 3]) {
      // Create bow ties.   Start triangulation at each vertex.
      const basePoints = [
        Point3d.create(0, 0, 0),
        Point3d.create(4, 0, 0),
        Point3d.create(4, a, 0),
        Point3d.create(3, 1, 0)];
      for (let startIndex = 0; startIndex < basePoints.length; startIndex++) {
        let dy = 0.0;
        const shiftedPoints = [];
        for (let j = 0; j < basePoints.length; j++)
          shiftedPoints.push(basePoints[(startIndex + j) % basePoints.length]);

        const graph = Triangulator.createTriangulatedGraphFromSingleLoop(shiftedPoints)!;
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(shiftedPoints), dx, dy += step);
        GraphChecker.captureAnnotatedGraph(allGeometry, graph, dx, dy += step);
        dx += step;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "FlexQuad");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PinchedTriangulation", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = -960;
    const dy = -3616;
    const loops = [];
    // A single pinch point:
    for (const dy14 of [0, 1, -1]) {
      loops.push([
        { x: 960, y: 3616 },
        // { x: 961, y: 3616 },
        { x: 968, y: 3612 + dy14 },
        // { x: 969, y: 3612 + dy14 },
        { x: 972, y: 3608 },
        { x: 968, y: 3608 },
        { x: 968, y: 3612 + dy14 },
        { x: 960, y: 3612 },
        { x: 960, y: 3616 },
        { x: 960, y: 3616 }]);
    }
    // multiple pinch points:
    const x0 = 960;
    const y0 = 3616;
    for (const touchAllPointsOnReturn of [true, false]) {
      for (const numPinch of [2, 3, 5]) {
        const points = [];
        points.push({ x: x0, y: y0 });
        let x1 = x0;
        const y1 = y0 - 2;
        // walk out in sawtooth steps
        for (let i = 0; i < numPinch; i++) {
          points.push({ x: x1 + 1, y: y1 });
          points.push({ x: x1 + 2, y: y0 });
          x1 += 2;
        }
        if (touchAllPointsOnReturn) {
          // walk back in each interval
          for (let i = 0; i < numPinch; i++) {
            points.push({ x: x1, y: y0 });
            x1 -= 2;
          }
        }
        loops.push(points);
      }
    }
    for (const points of loops) {
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), dx, dy);
      const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points)!;
      if (graph) {
        GraphChecker.captureAnnotatedGraph(allGeometry, graph, dx, dy + 10);
        GraphChecker.verifyMaskAroundFaces(ck, graph, HalfEdgeMask.EXTERIOR);
        const polyface = PolyfaceBuilder.graphToPolyface(graph);
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface, dx, dy + 20);
      }

      const graph1 = Triangulator.createTriangulatedGraphFromLoops([points]);
      if (graph1) {
        const polyface1 = PolyfaceBuilder.graphToPolyface(graph1);
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface1, dx, dy + 30);
      }
      dx += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "PinchedTriangulation");
    expect(ck.getNumErrors()).equals(0);
  });

  const dartInTriangleOuter = [
    Point3d.create (1,-4), Point3d.create (13,0), Point3d.create (1,4), Point3d.create (1,-4),
  ];
  const dartInTriangleInner = [
    Point3d.create (5,0), Point3d.create (3,-2), Point3d.create (9,0), Point3d.create (3,2),Point3d.create (5,0),
  ];

  it("DartInTriangle", () => {
    // This simple dart-inside-triangle showed an error in a special case test in the earcut triangulator.
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0;
    let dy = 0;
    const outerArea = PolygonOps.areaXY(dartInTriangleOuter);
    const innerArea = PolygonOps.areaXY(dartInTriangleInner);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, dartInTriangleOuter, dx, dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, dartInTriangleInner, dx, dy);
    dy += 10;
    const graph1 = Triangulator.createTriangulatedGraphFromLoops([dartInTriangleOuter, dartInTriangleInner]);
      if (graph1) {
        const polyface1 = PolyfaceBuilder.graphToPolyface(graph1);
        ck.testCoordinate(Math.abs(outerArea) - Math.abs(innerArea), PolyfaceQuery.sumFacetAreas(polyface1), "area of dart in triangle");
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface1, dx, dy);
    }
    dx += 20;
    dy = 0;
    const innerReversed = dartInTriangleInner.slice().reverse();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, dartInTriangleOuter, dx, dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, innerReversed, dx, dy);
    dy += 10;
    const graph2 = Triangulator.createTriangulatedGraphFromLoops([dartInTriangleOuter, innerReversed]);
      if (graph2) {
        const polyface2 = PolyfaceBuilder.graphToPolyface(graph2);
        ck.testCoordinate(Math.abs(outerArea) - Math.abs(innerArea), PolyfaceQuery.sumFacetAreas(polyface2), "area of reversed dart in triangle");
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface2, dx, dy);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "DartInTriangle");
    expect(ck.getNumErrors()).equals(0);
  });
  function messyShapePointsJson(ex0: number = 0, ey0: number = 0, ex1: number = 0, ey1: number = 0): any {
    return [
      [0, 0],
      [0.654709, 0.03484],
      [1.302022, 0.138965],
      [1.93463, 0.311201],
      [2.545385, 0.549601],
      [3.925434, 0.248946],
      [4.226089, 1.628994],
      [4.676643, 2.095353],
      [5.076021, 2.606223],
      [5.419851, 3.156015],
      [5.704372, 3.738714],
      [4.911329, 0.012742],
      [9.180947, -0.896012],
      [10.026788, 2.986512],
      [5.77525, 3.912745],
      [5.979092, 4.528871],
      [6.117235, 5.162968],
      [6.188159, 5.808051],
      [15.071005, 3.872848],
      [15.149952, 4.234942],
      [17.675663, 3.684497],
      [16.263188, -2.797961],
      [16.064641, -2.754699],
      [15.959866, -3.235548],
      [13.473343, -2.693754],
      [13.578118, -2.212905],
      [12.585406, -1.996601],
      [12.484111, -2.468461],
      [9.996137, -1.926351],
      [10.09889, -1.454772],
      [9.782465, -1.385825],
      [9.659434, -1.950464],
      [8.666728, -1.734157],
      [8.412537, -2.900748],
      [8.348474, -2.936379],
      [8.409278, -3.049394],
      [6.537996, -3.910283],
      [4.596704, -4.522471],
      [3.073072, -4.777725],
      [2.406422, -4.878351],
      [1.159118, -4.928844],
      [0.507533, -4.944266],
      [0.044633, -4.952745],
      [-4.559386, -3.941573],
      [-5.084428, -3.72601],
      [-6.937781, -2.781619],
      [-8.410058, -1.803001],
      [-8.88581, -1.41257],
      [-10.198609, -0.20053],
      [-11.487166, 1.280115],
      [-11.379811, 1.362224],
      [-11.423276, 1.421324],
      [-11.169085, 2.587913],
      [-12.161793, 2.804211],
      [-12.05118, 3.371515],
      [-12.355197, 3.437758],
      [-12.459969, 2.956911],
      [-14.946492, 3.498704],
      [-14.841721, 3.979552],
      [-15.834432, 4.195856],
      [-15.939202, 3.715008],
      [-18.425726, 4.256801],
      [-18.32095, 4.737653],
      [-19.313664, 4.953956],
      [-19.418435, 4.473105],
      [-21.904958, 5.014898],
      [-21.800185, 5.495752],
      [-22.792897, 5.712056],
      [-22.89767, 5.231202],
      [-25.384193, 5.772996],
      [-25.279418, 6.253847],
      [-27.642639, 6.768779],
      [-26.961521, 9.894707],
      [-25.373773, 9.548751],
      [-25.513633, 8.906874],
      [-24.714594, 8.726444],
      [-25.180075, 6.589819],
      [-22.71835, 6.053513],
      [-22.252868, 8.190138],
      [-22.031532, 8.148114],
      [-21.06162, 8.765842],
      [-21.700817, 5.83184],
      [-19.239094, 5.295533],
      [-18.393224, 9.178193],
      [-19.906289, 9.507827],
      [-17.59824, 10.990118],
      [-5.777575, 8.414887],
      [-5.768427, 8.411331],
      [-5.971378, 7.795457],
      [-6.108774, 7.161728],
      [-6.179107, 6.517102],
      [-10.44429, 7.446451],
      [-11.290253, 3.563954],
      [-7.02507, 2.634605],
      [-6.194445, 6.442253],
      [-6.195142, 5.901328],
      [-6.148684, 5.362402],
      [-6.055425, 4.829577],
      [-5.916075, 4.30691],
      [-5.731695, 3.798379],
      [-6.032348, 2.418332],
      [-4.709612, 2.129385],
      [-4.245829, 1.644422],
      [-3.732387, 1.212379],
      [-3.175292, 0.838308],
      [-2.581059, 0.526585],
      [-3.387468, -3.174972],
      [-2.539054, -3.414636],
      [-1.677653, -3.602342],
      [-0.806443, -3.737396],
      // The zinger
      [-0.801128 + ex0, -3.712995 + ey0],
      [-5.820766e-11 + ex1, -0.035721 + ey1],
      [-0.801128 + ex0, -3.712995 + ey0],
      [-0.806443, -3.737396],

      [0, 1.593037e-11]];
  }
const _messyShape = [
      {
        shape: {
          points: messyShapePointsJson () ,
          trans: [
            [0.998765, 0.049683, -1.032365e-16, 532612.092389],
            [-0.049683, 0.998765, -5.489607e-20, 212337.746743],
            [1.031063e-16, 5.183973e-18, 1, 7.41464]],
        },
      },
    ];

  function tryTriangulation(allGeometry: GeometryQuery[], points: Point3d[], x0: number, y0: number) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, points, x0, y0);
    const range = Range3d.createArray(points);
    y0 += range.yLength();
    Triangulator.clearAndEnableDebugGraphCapture(true);
    const graph1 = Triangulator.createTriangulatedGraphFromSingleLoop(points);
      if (graph1) {
        const polyface1 = PolyfaceBuilder.graphToPolyface(graph1);
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface1, x0, y0);
      } else {
        const graph2 = Triangulator.claimDebugGraph();
        if (graph2) {
          const polyface2 = PolyfaceBuilder.graphToPolyface(graph2);
          GeometryCoreTestIO.captureGeometry(allGeometry, polyface2, x0 + range.xLength (), y0);
        }
    }
  }
  it("MessyPolygon", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const points = Point3dArray.cloneDeepXYZPoint3dArrays(messyShapePointsJson());
    const range = Range3d.createFromVariantData(points);
    tryTriangulation(allGeometry, points, x0, y0);
    const cleanerPoints = PolylineOps.compressDanglers(points, true);
    x0 += 3.0 * range.xLength();
    tryTriangulation(allGeometry, cleanerPoints, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "MessyPolygon");
    expect(ck.getNumErrors()).equals(0);
  });

  /**
   * @return number of removed edges
   */
  function tryExpandConvex(ck: Checker, allGeometry: GeometryQuery[], graph: HalfEdgeGraph, method: number, position: Point2d): number {
    ck.testTrue(HalfEdgeGraphOps.isEveryFaceConvex(graph), "graph has non-convex face on input");
    const polyface = PolyfaceBuilder.graphToPolyface(graph);
    const range = polyface.range();
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, position.x, position.y);
    let numRemovedEdges = 0;
    let succeeded = false;
    switch (method) {
      case 1: { // mask, yank and delete edges
        numRemovedEdges = HalfEdgeGraphOps.expandConvexFaces(graph);
        const polyface2 = PolyfaceBuilder.graphToPolyface(graph);
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface2, position.x, position.y + range.yLength());
        succeeded = ck.testLT(0, numRemovedEdges, "expandConvexFaces did not remove any edges.");
        break;
      }
      case 2: { // collect, isolate and delete edges
        const removableEdges = HalfEdgeGraphOps.collectRemovableEdgesToExpandConvexFaces(graph);
        if ((succeeded = ck.testDefined(removableEdges, "expandConvexFaces did not return any removable edges.")) && removableEdges) {
          for (const node of removableEdges) node.isolateEdge();
          numRemovedEdges = graph.deleteIsolatedEdges() / 2;
          const polyface2 = PolyfaceBuilder.graphToPolyface(graph);
          GeometryCoreTestIO.captureGeometry(allGeometry, polyface2, position.x, position.y + range.yLength());
          ck.testExactNumber(numRemovedEdges, removableEdges.length, "deleted unexpected number of removable edges.");
        }
        break;
      }
    }
    if (succeeded)
      ck.testTrue(HalfEdgeGraphOps.isEveryFaceConvex(graph), "expandConvexFaces yielded non-convex face.");
    return numRemovedEdges;
  }

  /**
   * @return whether tests succeeded
   * @remarks Caller should precede with Triangulator.clearAndEnableDebugGraphCapture(true);
   */
  function tryExpandConvex2(ck: Checker, allGeometry: GeometryQuery[], graph1: HalfEdgeGraph | undefined, graph2: HalfEdgeGraph | undefined, position: Point2d): boolean {
    if (ck.testDefined(graph1, "Triangulation failed") && graph1) {
      const range = HalfEdgeGraphOps.graphRange(graph1);
      const numRemovedEdges1 = tryExpandConvex(ck, allGeometry, graph1, 1, position);
      position.x += range.xLength();
      if (graph2) {
        const numRemovedEdges2 = tryExpandConvex(ck, allGeometry, graph2, 2, position);
        ck.testExactNumber(numRemovedEdges1, numRemovedEdges2, "expandConvexFaces methods removed different numbers of edges.");
        position.x += range.xLength();
      }
      for (const node of graph1.allHalfEdges) {
        if (!node.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE)) {
          node.isolateEdge();
          break;
        }
      }
      ck.testFalse(HalfEdgeGraphOps.isEveryFaceConvex(graph1), "isFaceConvex failed to detect non-convex face.");
      return true;
    }
    const debugGraph = Triangulator.claimDebugGraph();
    if (debugGraph) {
      const debugPolyface = PolyfaceBuilder.graphToPolyface(debugGraph);
      const range = debugPolyface.range();
      GeometryCoreTestIO.captureGeometry(allGeometry, debugPolyface, position.x, position.y);
      position.x += range.xLength();
    }
    return false;
  }

  it("ExpandConvexFaces-DartInTriangle", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const position = Point2d.createZero();
    Triangulator.clearAndEnableDebugGraphCapture(true);
    const graph1 = Triangulator.createTriangulatedGraphFromLoops([dartInTriangleOuter, dartInTriangleInner]);
    const graph2 = Triangulator.createTriangulatedGraphFromLoops([dartInTriangleOuter, dartInTriangleInner]);
    ck.testTrue(tryExpandConvex2(ck, allGeometry, graph1, graph2, position), "tryExpandConvex2 failed on DartInTriangle.");
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "ExpandConvexFaces-DartInTriangle");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ExpandConvexFaces-MessyPolygon", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const position = Point2d.createZero();
    const points = PolylineOps.compressDanglers(Point3dArray.cloneDeepXYZPoint3dArrays(messyShapePointsJson()), true);
    Triangulator.clearAndEnableDebugGraphCapture(true);
    const graph1 = Triangulator.createTriangulatedGraphFromSingleLoop(points);
    const graph2 = Triangulator.createTriangulatedGraphFromSingleLoop(points);
    ck.testTrue(tryExpandConvex2(ck, allGeometry, graph1, graph2, position), "tryExpandConvex2 failed on MessyPolygon.");
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "ExpandConvexFaces-MessyPolygon");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ExpandConvexFaces-Fractals", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const position = Point2d.createZero();
    for (const numRecursion of [1, 2, 3]) {
      for (const perpendicularFactor of [0.85, -1.0, -0.5]) {
        for (const generatorFunction of [
          Sample.createFractalSquareReversingPattern,
          Sample.createFractalDiamondConvexPattern,
          Sample.createFractalLReversingPattern,
          Sample.createFractalHatReversingPattern,
          Sample.createFractalLMildConcavePatter]) {
          for (const degrees of [0, 10, 79]) {
            const points = generatorFunction(numRecursion, perpendicularFactor);
            let range = Range3d.createArray(points);
            const transform = Transform.createFixedPointAndMatrix(range.center, Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
            transform.multiplyPoint3dArrayInPlace(points);
            range = Range3d.createArray(points);
            Triangulator.clearAndEnableDebugGraphCapture(true);
            const graph1 = Triangulator.createTriangulatedGraphFromSingleLoop(points);
            const graph2 = Triangulator.createTriangulatedGraphFromSingleLoop(points);
            position.x += range.xLength() / 2;
            ck.testTrue(tryExpandConvex2(ck, allGeometry, graph1, graph2, position), "tryExpandConvex2 failed on Fractals.");
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "ExpandConvexFaces-Fractals");
    expect(ck.getNumErrors()).equals(0);
  });

});
