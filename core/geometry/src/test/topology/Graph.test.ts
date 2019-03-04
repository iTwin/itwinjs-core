/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";
import { LineString3d } from "../../curve/LineString3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphSearch } from "../../topology/HalfEdgeGraphSearch";
import { HalfEdgeMaskValidation, HalfEdgePointerInspector } from "../../topology/HalfEdgeGraphValidation";
import { HalfEdgeGraphMerge } from "../../topology/Merging";

import { Angle } from "../../geometry3d/Angle";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Geometry } from "../../Geometry";

export class GraphChecker {
  public static captureAnnotatedGraph(data: GeometryQuery[], graph: HalfEdgeGraph, dx: number = 0, dy: number = 0) {
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
    const count0 = data.length;

    for (const nodeA of allNodes) {
      const nodeB = nodeA.faceSuccessor;
      const nodeC = nodeA.vertexSuccessor;
      Point3d.create(nodeA.x, nodeA.y, 0, xyzA);
      Point3d.create(nodeB.x, nodeB.y, 0, xyzB);
      nodeA.vectorToFaceSuccessor(vectorAB);
      nodeC.vectorToFaceSuccessor(vectorAC);
      vectorAB.unitPerpendicularXY(perpAB);
      vectorAC.unitPerpendicularXY(perpAC);
      const dAB = xyzA.distanceXY(xyzB);
      const dTick = Math.min(dAB / numTick, maxTick);
      const tickFraction = Geometry.safeDivideFraction(dTick, dAB, 0.0);
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
    const transform = Transform.createTranslationXYZ(dx, dy, 0);
    for (let i = count0; i < data.length; i++)
      data[i].tryTransformInPlace(transform);
  }
  public static printToConsole = false;
  public static dumpGraph(graph: HalfEdgeGraph) {
    const faces = graph.collectFaceLoops();
    const vertices = graph.collectVertexLoops();
    const faceData = [];
    for (const f of faces) {
      faceData.push(f.collectAroundFace(HalfEdge.nodeToIdXYString));
    }
    if (this.printToConsole) {
      console.log("**FACE LOOPS " + faces.length);
      console.log(faceData);
    }
    const vdata = [];
    for (const v of vertices) {
      const totalDistance = v.sumAroundVertex((node: HalfEdge) => node.distanceXY(v));
      if (totalDistance !== 0) { // output full coordinates all the way around.
        vdata.push("INCONSISTENT VERTEX XY");
        vdata.push(JSON.stringify(v.collectAroundVertex(HalfEdge.nodeToIdMaskXY)));
      } else
        vdata.push([HalfEdge.nodeToIdXYString(v), v.collectAroundVertex(HalfEdge.nodeToId)]);
    }
    if (this.printToConsole) {
      console.log("**VERTEX LOOPS " + vertices.length);
      console.log(vdata);
    }
  }
  /**
   * * call various "fast" mask methods at every node.
   * * call expesnive methods (those requiring full graph search) for a few nodes.
   */
  public static exerciseMaskMethods(ck: Checker, graph: HalfEdgeGraph) {
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

  public static validateCleanLoopsAndCoordinates(ck: Checker, graph: HalfEdgeGraph) {
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
  public static verifyMaskAroundFaces(ck: Checker,
    graph: HalfEdgeGraph,
    mask: HalfEdgeMask): boolean {
    // is EXTERIOR_MASK consistent around all faces?
    let maskErrors = 0;
    for (const node of graph.allHalfEdges) {
      if (node.isMaskSet(mask) !== node.faceSuccessor.isMaskSet(mask))
        maskErrors++;
    }
    if (maskErrors !== 0)
      ck.announceError("EXTERIOR_MASK inconsistent at " + maskErrors + " nodes");
    return maskErrors === 0;
  }
  /**
   *
   * @param ck checker for error reports
   * @param graph graph to inspect
   * @param checkConsistentExteriorMask if true, verify that HalfEdgemask.EXTERIOR is consistent within each face (entirely on or entirely off)
   * @param numFace (optional) precise expected face count
   * @param numVertex (optional) precise expected vertex count
   * @param positiveFaceAreaSum  (optional) precise expected positive area face sum
   */
  public static verifyGraphCounts(ck: Checker,
    graph: HalfEdgeGraph,
    checkConsistentExteriorMask: boolean,
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
    if (checkConsistentExteriorMask)
      this.verifyMaskAroundFaces(ck, graph, HalfEdgeMask.EXTERIOR);
    if (positiveFaceAreaSum) {
      let sum = 0.0;
      for (const face of faces) {
        const faceArea = face.signedFaceArea();
        if (faceArea > 0.0) sum += faceArea;
      }
      ck.testCoordinate(positiveFaceAreaSum, sum, "area sum");
    }

    if (ck.getNumErrors() > error0) GraphChecker.dumpGraph(graph);
  }
  /**
   * Return arrays with faces, distributed by sign of face area.
   * @param graph
   */
  public static collectFacesByArea(graph: HalfEdgeGraph): any {
    const faces = graph.collectFaceLoops();
    const result: any = {};
    result.absAreaSum = 0;
    result.zeroAreaTolerance = 0;
    result.positiveFaces = [];
    result.negativeFaces = [];
    result.nearZeroFaces = [];

    for (const face of faces) {
      result.absAreaSum += Math.abs(face.signedFaceArea());
      result.zeroAreaTolerance = 1.0e-12 * result.absAreaSum;
    }
    for (const face of faces) {
      const a = face.signedFaceArea();
      if (Math.abs(a) <= result.zeroAreaTolerance)
        result.nearZeroFaces.push(face);
      else if (a > 0.0) result.positiveFaces.push(face);
      else /* strict negative */
        result.negativeFaces.push(face);

    }
    return result;
  }
  public static verifySignedFaceCounts(ck: Checker, graph: HalfEdgeGraph, numPositive: number | undefined, numNegative: number | undefined, numNearZero: number | undefined): boolean {
    const faceData = this.collectFacesByArea(graph);
    const okPositive = numPositive === undefined || faceData.positiveFaces.length === numPositive;
    const okNegative = numNegative === undefined || faceData.negativeFaces.length === numNegative;
    const okNearZero = numNearZero === undefined || faceData.nearZeroFaces.length === numNearZero;
    ck.testTrue(okPositive, "PositiveAreaFaceCount ", numPositive);
    ck.testTrue(okNegative, "NegativeAreaFaceCount ", numNegative);
    ck.testTrue(okPositive, "PositiveAreaFaceCount ", numNearZero);
    return okPositive && okNegative && okNearZero;
  }
}

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
    GraphChecker.verifyGraphCounts(ck, graph, true,
      numEdge, 2 * numEdge, undefined);
    ck.testExactNumber(2 * numEdge, graph.countNodes(), "dangling nodes");
    const geometry: GeometryQuery[] = [];
    GraphChecker.captureAnnotatedGraph(geometry, graph, 0, 0);

    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
    // after merge, there are interior faces and a single exterior face . .
    const numInteriorFaces = (numX - 1) * (numY - 1);
    const numFaces = numInteriorFaces + 1;
    GraphChecker.verifyGraphCounts(ck, graph, true, numFaces, (numX + 1) * (numY + 1) - 1, undefined);
    GraphChecker.dumpGraph(graph);
    GraphChecker.captureAnnotatedGraph(geometry, graph, 0, 10);
    const segments = graph.collectSegments();
    ck.testExactNumber(numEdge, segments.length, "segmentCount");
    GeometryCoreTestIO.saveGeometry(geometry, "Graph", "GridFixup");
    const componentsB = HalfEdgeGraphSearch.collectConnectedComponents(graph, HalfEdgeMask.EXTERIOR);
    ck.testTrue(HalfEdgeMaskValidation.isMaskConsistentAroundAllFaces(graph, HalfEdgeMask.EXTERIOR), "ParitySearch makes valid exterior Masks");
    if (ck.testExactNumber(1, componentsB.length, "Expect single component")) {
      ck.testExactNumber(numFaces, componentsB[0].length, "face count from search");
    }
    ck.testExactNumber(1, graph.countFaceLoopsWithMaskFilter(HalfEdge.filterIsMaskOn, HalfEdgeMask.EXTERIOR), "Single exterior after parity");
    ck.testExactNumber(numInteriorFaces, graph.countFaceLoopsWithMaskFilter(HalfEdge.filterIsMaskOff, HalfEdgeMask.EXTERIOR), "Single exterior after parity");
    GraphChecker.validateCleanLoopsAndCoordinates(ck, graph);
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
    GraphChecker.exerciseMaskMethods(ck, graph);
    graph.decommission();
    expect(ck.getNumErrors()).equals(0);
  });

  it("SimpleQueries", () => {
    const graph = new HalfEdgeGraph();
    const node = graph.addEdgeXY(1, 2, 3, 4);
    const node1 = node.facePredecessor;
    if (GraphChecker.printToConsole) {
      console.log("NodeToId:", HalfEdge.nodeToId(node1));
      console.log("nodeToIdString:", HalfEdge.nodeToIdString(node1));
      console.log("nodeToXY:", HalfEdge.nodeToXY(node1));
      console.log("nodeToIdXYString:", HalfEdge.nodeToIdXYString(node1));
      console.log("nodeToIdMaskXY:", HalfEdge.nodeToIdMaskXY(node1));
      console.log("nodeToMaskString:", HalfEdge.nodeToMaskString(node1));
    }
  });

  it("CoordinatesOnEdges", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const edgeA = graph.addEdgeXY(1, 2, 4, 3);
    const edgeB = graph.addEdgeXY(2, -1, 3, 4);
    const uvAB = HalfEdge.transverseIntersectionFractions(edgeA, edgeB);
    if (ck.testPointer(uvAB, "intersection of edges exists") && uvAB) {
      const pointA = edgeA.fractionToPoint2d(uvAB.x);
      const pointB = edgeB.fractionToPoint2d(uvAB.y);
      ck.testPoint2d(pointA, pointB, "intersection xy");
    }
    ck.testUndefined(HalfEdge.transverseIntersectionFractions(edgeA, edgeA), "identical edges");
    expect(ck.getNumErrors()).equals(0);
  });

});
