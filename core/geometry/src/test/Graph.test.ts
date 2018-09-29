/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "./Checker";
import { LineString3d } from "../curve/LineString3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Point3d, Vector3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { Matrix3d } from "../Transform";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../topology/Graph";
import { HalfEdgeGraphSearch } from "../topology/HalfEdgeGraphSearch";
import { HalfEdgeMaskValidation, HalfEdgePointerInspector } from "../topology/HalfEdgeGraphValidation";
import { Merger, GraphMerge } from "../topology/Merging";
import { Triangulator } from "../topology/Triangulation";

import { Angle } from "../Geometry";
import { Sample } from "../serialization/GeometrySamples";
import { GeometryCoreTestIO } from "./IModelJson.test";
import { Loop } from "../curve/CurveChain";
import { GeometryQuery } from "../curve/CurvePrimitive";

function exportGraph(graph: HalfEdgeGraph, filename: string) {
  const toExport = PolyfaceBuilder.graphToPolyface(graph);
  GeometryCoreTestIO.saveGeometry([toExport], "Graph", filename);
}

function exportAnnotatedGraph(graph: HalfEdgeGraph, filename: string) {
  const maxTick = 0.01;
  const numTick = 20;
  const allNodes = graph.allHalfEdges;
  const xyzA = Point3d.create();
  const xyz = Point3d.create(); // work point
  const xyzB = Point3d.create();
  const vectorAB = Vector3d.create();
  const perpAB = Vector3d.create();
  const perpAC = Vector3d.create();
  const vectorAC = Vector3d.create();
  const data = [];
  for (const nodeA of allNodes) {
    const nodeB = nodeA.faceSuccessor;
    const nodeC = nodeA.vertexSuccessor;
    Point3d.create(nodeA.x, nodeA.y, nodeA.z, xyzA);
    Point3d.create(nodeB.x, nodeB.y, nodeB.z, xyzB);
    nodeA.vectorToFaceSuccessor(vectorAB);
    nodeC.vectorToFaceSuccessor(vectorAC);
    vectorAB.unitPerpendicularXY(perpAB);
    vectorAC.unitPerpendicularXY(perpAC);
    const dAB = xyzA.distanceXY(xyzB);
    const dTick = Math.min(dAB / numTick, maxTick);
    const tickFraction = dTick / dAB;
    perpAB.scaleInPlace(dTick);

    const linestring = LineString3d.create();
    linestring.clear();
    linestring.addPoint(xyzA);
    xyzA.plusScaled(vectorAB, 2 * tickFraction, xyz);
    if (nodeC === nodeA)
      linestring.addPoint(xyz);
    linestring.addPoint(xyz.plus(perpAB, xyz));
    linestring.addPoint(xyzB);
    data.push(linestring);

    if (!vectorAB.isParallelTo(vectorAC)) {
      let theta = vectorAB.angleToXY(vectorAC);
      if (theta.radians < 0.0)
        theta = Angle.createDegrees(theta.degrees + 360);
      if (vectorAB.tryNormalizeInPlace() && vectorAC.tryNormalizeInPlace()) {
        const linestringV = LineString3d.create();
        linestringV.clear();
        linestringV.addPoint(xyzA.plusScaled(vectorAB, dTick));
        if (theta.degrees > 90) {
          let numStep = 3;
          if (theta.degrees > 180) numStep = 5;
          if (theta.degrees > 270) numStep = 7;
          const stepRadians = theta.radians / numStep;
          for (let i = 1; i <= numStep; i++) {
            vectorAB.rotateXY(Angle.createRadians(stepRadians), vectorAB);
            linestringV.addPoint(xyzA.plusScaled(vectorAB, dTick));
          }
        }
        linestringV.addPoint(xyzA.plusScaled(vectorAC, dTick));
        data.push(linestringV);
      }
    }
  }
  GeometryCoreTestIO.saveGeometry(data, "Graph", filename);
}

function dumpGraph(graph: HalfEdgeGraph) {
  const faces = graph.collectFaceLoops();
  const vertices = graph.collectVertexLoops();
  const faceData = [];
  for (const f of faces) {
    faceData.push(f.collectAroundFace(HalfEdge.nodeToIdXYString));
  }
  console.log("**FACE LOOPS " + faces.length);
  console.log(faceData);
  const vdata = [];
  for (const v of vertices) {
    const totalDistance = v.sumAroundVertex((node: HalfEdge) => node.distanceXY(v));
    if (totalDistance !== 0) { // output full coordinates all the way around.
      vdata.push("INCONSISTENT VERTEX XY");
      vdata.push(JSON.stringify(v.collectAroundVertex(HalfEdge.nodeToIdMaskXY)));
    } else
      vdata.push([HalfEdge.nodeToIdXYString(v), v.collectAroundVertex(HalfEdge.nodeToId)]);
  }
  console.log("**VERTEX LOOPS " + vertices.length);
  console.log(vdata);
}
/**
 * * call various "fast" mask methods at every node.
 * * call expesnive methods (those requiring full graph search) for a few nodes.
 */
function exerciseMaskMethods(ck: Checker, graph: HalfEdgeGraph) {
  const myMask = HalfEdgeMask.PRIMARY_EDGE;
  graph.clearMask(myMask);
  const numNode = graph.allHalfEdges.length;
  ck.testExactNumber(0, graph.countMask(myMask), "graph.setMask");
  graph.clearMask(HalfEdgeMask.VISITED);
  graph.setMask(myMask);
  ck.testExactNumber(numNode, graph.countMask(myMask), "graph.clearMask");
  graph.clearMask(myMask);
  let numSet = 0;
  // do some tedius stuff at "a few" nodes .. 0,3,9,21....
  const mask1 = HalfEdgeMask.PRIMARY_VERTEX_MASK; // ignore the name -- it is a mask to work with
  const mask2 = HalfEdgeMask.POLAR_LOOP_MASK; // ignore the name -- it is a mask to work with.
  let numMask2InSet = 0;
  graph.clearMask(mask1);
  ck.testExactNumber(0, graph.countMask(mask1), "clear mask " + mask1);
  for (let i = 0; i < numNode; i += 3 + i) {
    const node = graph.allHalfEdges[i];
    ck.testFalse(node.isMaskSet(myMask), "0 mask");
    ck.testTrue(node.testAndSetMask(myMask) === 0, "testAndSet from 0");
    ck.testTrue(node.isMaskSet(myMask), "after testAndSet");
    numSet++;
    // confirm "around vertex ops" -- some tests are full-graph sweeps.
    graph.clearMask(mask1);
    const numNodesAroundVertex = node.countEdgesAroundVertex();
    const numNodesAroundFace = node.countEdgesAroundFace();

    ck.testExactNumber(numNodesAroundVertex, node.countMaskAroundVertex(mask1, false), "count unmasked around vertex");
    ck.testExactNumber(numNodesAroundFace, node.countMaskAroundFace(mask1, false), "count unmasked around face");

    node.setMaskAroundVertex(mask1);
    ck.testExactNumber(numNodesAroundFace - 1, node.countMaskAroundFace(mask1, false), "count unmasked around face after vertex set");

    const nodesAroundVertex = node.collectAroundVertex();
    ck.testExactNumber(numNodesAroundVertex, nodesAroundVertex.length, "count nodes == collected array length");
    const masksAroundVertex = node.countMaskAroundVertex(mask1);
    ck.testExactNumber(nodesAroundVertex.length, masksAroundVertex);
    ck.testExactNumber(nodesAroundVertex.length, graph.countMask(mask1), "confirm count for setmaskAroundvertex");
    node.clearMaskAroundVertex(mask1);
    ck.testExactNumber(0, graph.countMask(mask1), "clear around vertex");
    const numMask2ThisFace = node.countMaskAroundFace(mask2);
    node.setMaskAroundFace(mask2);
    ck.testExactNumber(numNodesAroundFace, node.countMaskAroundFace(mask2));
    numMask2InSet += node.countMaskAroundFace(mask2) - numMask2ThisFace;
    ck.testExactNumber(numMask2InSet, graph.countMask(mask2), "global mask count versus per-face update");

  }
  ck.testExactNumber(numSet, graph.countMask(myMask), " count mask after various testAndSet");
  graph.reverseMask(myMask);
  ck.testExactNumber(numNode - numSet, graph.countMask(myMask), "count mask after reverse");
}

function validateCleanLoopsAndCoordinates(ck: Checker, graph: HalfEdgeGraph) {
  for (const he of graph.allHalfEdges) {
    ck.testTrue(he === he.vertexSuccessor.vertexPredecessor, "vertex successor/predecessor relation");
    ck.testTrue(he === he.faceSuccessor.facePredecessor, "face successor/predecessor relation");
    const vs = he.vertexSuccessor;
    const faceSuccessor = he.faceSuccessor;
    ck.testTrue(he.isEqualXY(vs), "Exact xy around vertex loop");
    ck.testFalse(he.isEqualXY(faceSuccessor), "different xy around face loop");
    ck.testTrue(he === HalfEdge.nodeToSelf(he), "HalfEdge.nodeToSelf");
  }
}

function verifyGraphCounts(ck: Checker,
  graph: HalfEdgeGraph,
  numFace: number | undefined,
  numVertex: number | undefined,
  positiveFaceAreaSum: undefined | number) {
  const error0 = ck.getNumErrors();
  const faces = graph.collectFaceLoops();
  const vertices = graph.collectVertexLoops();

  if (numFace) ck.testExactNumber(numFace, faces.length, "face count");
  if (numFace) ck.testExactNumber(numFace, graph.countFaceLoops(), "face count");
  if (numVertex) ck.testExactNumber(numVertex, vertices.length, "vertex count");
  if (numVertex) ck.testExactNumber(numVertex, graph.countVertexLoops(), "vertex count");
  // is EXTERIOR_MASK consistent around all faces?
  let maskErrors = 0;
  for (const node of graph.allHalfEdges) {
    if (node.isMaskSet(HalfEdgeMask.EXTERIOR) !== node.faceSuccessor.isMaskSet(HalfEdgeMask.EXTERIOR))
      maskErrors++;
  }
  if (maskErrors !== 0)
    ck.announceError("EXTERIOR_MASK inconsistent at " + maskErrors + " nodes");
  if (positiveFaceAreaSum) {
    let sum = 0.0;
    for (const face of faces) {
      const faceArea = face.signedFaceArea();
      if (faceArea > 0.0) sum += faceArea;
    }
    ck.testCoordinate(positiveFaceAreaSum, sum, "area sum");
  }

  if (ck.getNumErrors() > error0) dumpGraph(graph);
}

describe("Triangulation", () => {
  const ck = new Checker();

  it("TriangulateLoops", () => {
    let yShift = 0;
    const dx = 20.0;
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
      [Point3d.create(3, 1.5, 0), Point3d.create(4, 3, 0), Point3d.create(4, 1.5, 0), Point3d.create(3, 1.5, 0)]]]) {
      let xShift = 0;
      // triangulate and flip in the outer loop only . . .
      const graph1 = Triangulator.earcutSingleLoop(myLoops[0]);
      const unflippedOuter = PolyfaceBuilder.graphToPolyface(graph1);
      unflippedOuter.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(unflippedOuter);
      xShift += dx;

      Triangulator.cleanupTriangulation(graph1);
      const flippedOuter = PolyfaceBuilder.graphToPolyface(graph1);
      flippedOuter.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(flippedOuter);
      xShift += 2 * dx;

      // triangulate with the hole
      const graph2 = Triangulator.earcutOuterAndInnerLoops(myLoops);
      const unflipped2 = PolyfaceBuilder.graphToPolyface(graph2);
      unflipped2.tryTranslateInPlace(xShift, yShift, 0);
      allGeometry.push(unflipped2);
      xShift += dx;

      Triangulator.cleanupTriangulation(graph2);
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
        const graph = Triangulator.earcutSingleLoop(points);
        const pfA = PolyfaceBuilder.graphToPolyface(graph);
        Triangulator.cleanupTriangulation(graph);

        if (Checker.noisy.squareWaves)
          dumpGraph(graph);
        verifyGraphCounts(ck, graph, undefined, undefined, undefined);
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

describe("MonotoneFaces", () => {
  const ck = new Checker();
  const testSegs: LineSegment3d[] = [
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

  it("SpecificCase", () => {
    const theGraph = Merger.formGraphFromSegments(testSegs);
    exportGraph(theGraph, "BeforeSweep");
    Merger.formMonotoneFaces(theGraph);
    exportGraph(theGraph, "AfterSweep");
    console.log("Total Faces: ", theGraph.collectFaceLoops().length);
    // for (const face of faces) {
    //   Triangulator.earcutFromSingleFaceLoop(face);
    // }
    exportGraph(theGraph, "AfterTriangulation");

    ck.checkpoint("MonotoneFaces");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("VUGraph", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const numX = 2;
    const numY = 2;
    ck.checkpoint("HelloWorld");

    // make horizontal edges
    for (let j = 0; j < numY; j++) {
      for (let i = 0; i < numX; i++)
        graph.addEdgeXY(i, j, i + 1, j);
    }
    // make horizontal edges
    for (let i = 0; i < numX; i++) {
      for (let j = 0; j < numY; j++)
        graph.addEdgeXY(i, j, i, j + 1);
    }

    ck.testTrue(HalfEdgePointerInspector.inspectGraph(graph, true), "Isolated edge graph HalfEdgeGraph pointer properties");

    // The edges form squares with danglers on the right and type .  .
    //
    //
    //        |     |     |     |
    //        |     |     |     |
    //        +-----+-----+-----+-----
    //        |     |     |     |
    //        |     |     |     |
    //        +-----+-----+-----+-----
    //        |     |     |     |
    //        |     |     |     |
    //        +-----+-----+-----+-----
    //
    // before merging, each edge hangs alone in space and creates a face and two vertices . .
    const numEdge = 2 * numX * numY;
    verifyGraphCounts(ck, graph,
      numEdge, 2 * numEdge, undefined);
    ck.testExactNumber(2 * numEdge, graph.countNodes(), "dangling nodes");
    exportAnnotatedGraph(graph, "VUGrid.1");

    GraphMerge.clusterAndMergeXYTheta(graph);
    // after merge, there are interior faces and a single exterior face . .
    const numInteriorFaces = (numX - 1) * (numY - 1);
    const numFaces = numInteriorFaces + 1;
    verifyGraphCounts(ck, graph, numFaces, (numX + 1) * (numY + 1) - 1, undefined);
    dumpGraph(graph);
    exportAnnotatedGraph(graph, "VUGrid.2");
    const segments = graph.collectSegments();
    ck.testExactNumber(numEdge, segments.length, "segmentCount");

    const componentsB = HalfEdgeGraphSearch.collectConnectedComponents(graph, HalfEdgeMask.EXTERIOR);
    ck.testTrue(HalfEdgeMaskValidation.isMaskConsistentAroundAllFaces(graph, HalfEdgeMask.EXTERIOR), "ParitySearch makes valid exterior Masks");
    if (ck.testExactNumber(1, componentsB.length, "Expect single component")) {
      ck.testExactNumber(numFaces, componentsB[0].length, "face count from search");
    }
    ck.testExactNumber(1, graph.countFaceLoopsWithMaskFilter(HalfEdge.filterIsMaskOn, HalfEdgeMask.EXTERIOR), "Single exterior after parity");
    ck.testExactNumber(numInteriorFaces, graph.countFaceLoopsWithMaskFilter(HalfEdge.filterIsMaskOff, HalfEdgeMask.EXTERIOR), "Single exterior after parity");
    validateCleanLoopsAndCoordinates(ck, graph);
    ck.testTrue(HalfEdgePointerInspector.inspectGraph(graph, true), "Merged Graph HalfEdgeGraph pointer properties");
    ck.testTrue(HalfEdgePointerInspector.inspectGraph(graph, false), "Merged Graph HalfEdgeGraph pointer properties");

    // interior faces should have area 1 and perimeter 4 ..
    for (const component of componentsB) {
      for (const faceSeed of component) {
        const area1 = faceSeed.signedFaceArea();
        if (faceSeed.isMaskSet(HalfEdgeMask.EXTERIOR)) {
          ck.testLT(area1, 0, "exterior loop has negative area");
        } else {
          // We know the interior loops are all unit squares . .
          ck.testCoordinate(1.0, area1, "unit face area");
          const lengthSum = faceSeed.sumAroundFace(
            (node: HalfEdge) => node.vectorToFaceSuccessorXY().magnitude());
          ck.testCoordinate(4.0, lengthSum);
        }
      }
    }
    exerciseMaskMethods(ck, graph);
    graph.decommission();
    expect(ck.getNumErrors()).equals(0);
  });

  it("SimpleQueries", () => {
    const graph = new HalfEdgeGraph();
    const node = graph.addEdgeXY(1, 2, 3, 4);
    const node1 = node.facePredecessor;
    console.log("NodeToId:", HalfEdge.nodeToId(node1));
    console.log("nodeToIdString:", HalfEdge.nodeToIdString(node1));
    console.log("nodeToXY:", HalfEdge.nodeToXY(node1));
    console.log("nodeToIdXYString:", HalfEdge.nodeToIdXYString(node1));
    console.log("nodeToIdMaskXY:", HalfEdge.nodeToIdMaskXY(node1));
    console.log("nodeToMaskString:", HalfEdge.nodeToMaskString(node1));
  });

  it("LargeCountTriangulation", () => {
    const numRecursion = 2;
    const baseVectorA = Vector3d.create(0, 0, 0);
    const allGeometry = [];
    for (const perpendicularFactor of [1.0, -1.0, -0.5]) {
      let yMax = 0.0;
      const baseVectorB = baseVectorA.clone();
      for (const generatorFunction of [
        Sample.createFractalDiamonConvexPattern,
        Sample.createFractalSquareReversingPattern,
        Sample.createFractalLReversingPatterh,
        Sample.createFractalLMildConcavePatter]) {
        const points = generatorFunction(numRecursion, perpendicularFactor);
        const range = Range3d.createArray(points);
        const dy = range.yLength();
        yMax = Math.max(yMax, dy);
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
      baseVectorA.addInPlace(Vector3d.create(0, 8.0 * yMax, 0));
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "LargeCountTriangulation");
  });
});
