/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point2d} from "../../geometry3d/Point2dVector2d";
import { Transform } from "../../geometry3d/Transform";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphSearch } from "../../topology/HalfEdgeGraphSearch";
import { HalfEdgeMaskValidation, HalfEdgePointerInspector } from "../../topology/HalfEdgeGraphValidation";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { NodeXYZUV } from "../../topology/HalfEdgeNodeXYZUV";
import { HalfEdgePositionDetail, HalfEdgeTopo } from "../../topology/HalfEdgePositionDetail";
import { InsertAndRetriangulateContext } from "../../topology/InsertAndRetriangulateContext";
import { OutputManager } from "../clipping/ClipPlanes.test";

function logGraph(graph: HalfEdgeGraph, title: any) {
  console.log(` == begin == ${title}`);
  for (const he of graph.allHalfEdges) {
    console.log(HalfEdge.nodeToIdXYString(he));
  }
  console.log(` ==end== ${title}`);
}
export class GraphChecker {
  public static captureAnnotatedGraph(data: GeometryQuery[], graph: HalfEdgeGraph | undefined, dx: number = 0, dy: number = 0) {
    if (graph === undefined)
      return;
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
      // if both ends are trivial, just put out the stroke . ..
      if (nodeA.countEdgesAroundVertex() <= 1 && nodeB.countEdgesAroundVertex() <= 1) {
        data.push(LineSegment3d.create(xyzA, xyzB));
      } else {
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
    }
    const transform = Transform.createTranslationXYZ(dx, dy, 0);
    for (let i = count0; i < data.length; i++)
      data[i].tryTransformInPlace(transform);
  }
  public static printToConsole = true;
  public static dumpGraph(graph: HalfEdgeGraph) {
    const faces = graph.collectFaceLoops();
    const vertices = graph.collectVertexLoops();
    const faceData = [];
    for (const f of faces) {
      faceData.push(f.collectAroundFace(HalfEdge.nodeToIdXYString));
    }
    if (this.printToConsole) {
      console.log(`"**FACE LOOPS ${faces.length}`);
      console.log(faceData);
    }
    const vData = [];
    for (const v of vertices) {
      const totalDistance = v.sumAroundVertex((node: HalfEdge) => node.distanceXY(v));
      if (totalDistance !== 0) { // output full coordinates all the way around.
        vData.push("INCONSISTENT VERTEX XY");
        vData.push(JSON.stringify(v.collectAroundVertex(HalfEdge.nodeToIdMaskXY)));
      } else
        vData.push([HalfEdge.nodeToIdXYString(v), v.collectAroundVertex(HalfEdge.nodeToId)]);
    }
    if (this.printToConsole) {
      console.log(`"**VERTEX LOOPS ${vertices.length}`);
      console.log(vData);
    }
  }
  /**
   * * call various "fast" mask methods at every node.
   * * call expensive methods (those requiring full graph search) for a few nodes.
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
    // do some tedious stuff at "a few" nodes .. 0,3,9,21....
    const mask1 = graph.grabMask();
    const mask2 = graph.grabMask();
    let numMask2InSet = 0;
    graph.clearMask(mask1);
    ck.testExactNumber(0, graph.countMask(mask1), `clear mask ${mask1}`);
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
      ck.testExactNumber(nodesAroundVertex.length, graph.countMask(mask1), "confirm count for setMaskAroundVertex");
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
    graph.dropMask(mask1);
    graph.dropMask(mask2);
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
      ck.testExactNumber(he.faceStepY(0), he.y);
      ck.testExactNumber(he.faceStepY(1), he.faceSuccessor.y);
      ck.testExactNumber(he.faceStepY(2), he.faceSuccessor.faceSuccessor.y);
      ck.testExactNumber(he.faceStepY(-1), he.facePredecessor.y);
      ck.testExactNumber(he.faceStepY(-2), he.facePredecessor.facePredecessor.y);
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
      ck.announceError(`EXTERIOR_MASK inconsistent at ${maskErrors} nodes`);
    return maskErrors === 0;
  }
  /**
   *
   * @param ck checker for error reports
   * @param graph graph to inspect
   * @param checkConsistentExteriorMask if true, verify that HalfEdgeMask.EXTERIOR is consistent within each face (entirely on or entirely off)
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
    const componentsB = HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(graph,
      undefined, HalfEdgeMask.EXTERIOR);
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

  it("NullFaceGraph", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const inside0 = graph.addEdgeXY(0, 0, 10, 0);
    const inside1 = graph.addEdgeXY(10, 0, 5, 5);
    const inside2 = graph.addEdgeXY(5, 5, 0, 0);
    const null0 = graph.addEdgeXY(3, 4, 3, 5);
    const outside0 = inside2.faceSuccessor;
    const outside1 = inside0.faceSuccessor;
    const outside2 = inside1.faceSuccessor;
    const null1 = null0.faceSuccessor;
    HalfEdge.pinch(inside0, outside0);
    HalfEdge.pinch(inside1, outside1);
    HalfEdge.pinch(inside2, outside2);

    inside0.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE | HalfEdgeMask.PRIMARY_EDGE);
    outside0.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE);
    outside0.setMaskAroundFace(HalfEdgeMask.PRIMARY_EDGE);

    HalfEdge.pinch(null0, inside0);
    HalfEdge.pinch(null1, inside1);

    const summary = HalfEdgeGraphSearch.collectFaceAreaSummary(graph, true);
    ck.testExactNumber(summary.numZero, summary.zeroItemArray!.length);
    ck.testExactNumber(1, summary.numPositive);
    ck.testExactNumber(1, summary.numNegative);
    ck.testExactNumber(1, summary.numZero);

    ck.testTrue(HalfEdgeMaskValidation.isMaskConsistentAroundAllFaces(graph, HalfEdgeMask.EXTERIOR));
    outside2.setMask(HalfEdgeMask.EXTERIOR);
    ck.testFalse(HalfEdgeMaskValidation.isMaskConsistentAroundAllFaces(graph, HalfEdgeMask.EXTERIOR));
    outside2.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    ck.testTrue(HalfEdgeMaskValidation.isMaskConsistentAroundAllFaces(graph, HalfEdgeMask.EXTERIOR));

    const xy2 = HalfEdge.nodeToXY(inside2);
    ck.testExactNumber(xy2[0], inside2.x);
    ck.testExactNumber(xy2[1], inside2.y);
    const maskBP = HalfEdge.nodeToMaskString(inside0);
    const maskBPX = HalfEdge.nodeToMaskString(outside2);
    ck.testTrue(maskBP === "BP" || maskBP === "PB");
    ck.testTrue(maskBPX === "BPX");

    const mask1 = HalfEdge.nodeToIdXYString(outside2);
    const jNode = HalfEdge.nodeToIdMaskXY(outside2);
    ck.testTrue(jNode.id.toString() === HalfEdge.nodeToIdString(outside2));
    ck.testTrue(jNode.xy[0] === outside2.x);
    ck.testTrue(jNode.xy[1] === outside2.y);
    const ii = mask1.lastIndexOf("]");

    ck.testExactNumber(ii + 1, mask1.length, "IdXYString");
    if (ck.getNumErrors() !== 0)
      logGraph(graph, "NullFace and mask string tests");
    expect(ck.getNumErrors()).equals(0);
  });

  it("HorizontalScanFraction", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const y0 = 2;
    const y1 = 5;
    const f = 0.4;
    const ym = Geometry.interpolate(y0, f, y1);
    const y0Edge = graph.addEdgeXY(0, y0, 10, y0);
    const y01Edge = graph.addEdgeXY(1, y0, 10, y1);
    const q = HalfEdge.horizontalScanFraction(y0Edge, y0);
    const q1 = HalfEdge.horizontalScanFraction(y0Edge, y1);
    ck.testUndefined(q1);
    ck.testTrue(q instanceof HalfEdge && q === y0Edge);
    const fm = HalfEdge.horizontalScanFraction(y01Edge, ym);
    ck.testTrue(Number.isFinite(fm as number) && Geometry.isSameCoordinate(f, fm as number));
    const f0 = HalfEdge.horizontalScanFraction(y01Edge, y0);
    ck.testTrue(Number.isFinite(f0 as number) && Geometry.isSameCoordinate(0, f0 as number));
    expect(ck.getNumErrors()).equals(0);
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

  it("InSector", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();

    const originEdges = [];
    const edge0 = graph.addEdgeXY(0, 0, 1, 0);
    const edge90 = graph.addEdgeXY(0, 0, 0, 1);
    const edge180 = graph.addEdgeXY(0, 0, -1, 0);
    const edge270 = graph.addEdgeXY(0, 0, 0, -1);
    originEdges.push(edge0, edge90, edge180, edge270);
    HalfEdge.pinch(edge0, edge90);
    HalfEdge.pinch(edge90, edge180);
    HalfEdge.pinch(edge180, edge270);

    const danglers = [];
    for (const e of originEdges) {
      const outerNode = e.faceSuccessor;
      const edgeVector = e.vectorToFaceSuccessor();
      const perpEdge = graph.addEdgeXY(outerNode.x, outerNode.y, outerNode.x - edgeVector.y, outerNode.y + outerNode.x);
      HalfEdge.pinch(outerNode, perpEdge);
      danglers.push(perpEdge.faceSuccessor);
    }

    const aroundOrigin = edge0.collectAroundVertex();
    const aroundSpider = edge0.collectAroundFace();
    ck.testExactNumber(4, aroundOrigin.length);
    ck.testExactNumber(16, aroundSpider.length);

    for (const sectorAtOrigin of originEdges) {
      const nodeA = sectorAtOrigin.faceSuccessor;   // That's on an axis
      const nodeB = nodeA.faceSuccessor;    // That's rotated into the sector containing originEdge
      // const nodeC = nodeB.vertexSuccessor;  // That's on the axis but strictly on the other side of the sector.  Nebulous containment status !!
      // nodeB is "in" sectorAtOrigin but NOT in any of the other sectors around the origin.
      for (const nodeE of originEdges) {
        ck.testBoolean(nodeE === sectorAtOrigin, HalfEdge.isNodeVisibleInSector(nodeB, nodeE));
      }
      ck.testTrue(HalfEdge.isNodeVisibleInSector(sectorAtOrigin, nodeB));
    }

    // build a degenerate face !!!
    const edgeQ0 = graph.addEdgeXY(2, 0, 3, 0);
    const edgeQ1 = graph.addEdgeXY(2, 0, 3, 0);
    HalfEdge.pinch(edgeQ0, edgeQ1);
    HalfEdge.pinch(edgeQ0.faceSuccessor, edgeQ1.faceSuccessor);
    ck.testTrue(HalfEdge.isNodeVisibleInSector(edgeQ0, edgeQ0.faceSuccessor), "null face inside");
    ck.testTrue(HalfEdge.isNodeVisibleInSector(edgeQ1, edgeQ1.faceSuccessor), " null face inside");
    ck.testFalse(HalfEdge.isNodeVisibleInSector(edgeQ1, edgeQ0), "null face outside");
    ck.testFalse(HalfEdge.isNodeVisibleInSector(edgeQ0, edgeQ1), "null face outside");
    ck.testFalse(HalfEdge.isNodeVisibleInSector(edge0, edgeQ0), "null face outside");

    // edgeR1 is a 180 degree sector ....
    const edgeR0 = graph.addEdgeXY(-1, 3, 1, 3);
    const edgeR1 = graph.addEdgeXY(1, 3, 3, 3);
    HalfEdge.pinch(edgeR0.faceSuccessor, edgeR1);
    ck.testFalse(HalfEdge.isNodeVisibleInSector(edge0, edgeR1), "back side of line");
    ck.testTrue(HalfEdge.isNodeVisibleInSector(edge0, edgeR1.vertexSuccessor), "front side side of line");
    // these edges have origins on the extended graph edges ...  only the one beyond R1 is considered in ...
    const edgeS0 = graph.addEdgeXY(-3, 3, 0, 5);
    const edgeS1 = graph.addEdgeXY(5, 3, 0, 5);
    ck.testFalse(HalfEdge.isNodeVisibleInSector(edgeS0, edgeR1), "on line before");
    ck.testTrue(HalfEdge.isNodeVisibleInSector(edgeS1, edgeR1), "on line after");
    const otherSide = edgeR1.vertexSuccessor;
    ck.testFalse(HalfEdge.isNodeVisibleInSector(edgeS1, otherSide), "on line before");
    ck.testTrue(HalfEdge.isNodeVisibleInSector(edgeS0, otherSide), "on line after");

    edgeQ0.setMask(HalfEdgeMask.NULL_FACE);
    // this exercises an obscure branch ...
    ck.testTrue(HalfEdge.nodeToMaskString(edgeQ0) === "N");

    ck.testUndefined(HalfEdge.horizontalScanFraction01(edgeQ0, 20.0), " No crossing of horizontal edge");
    ck.testExactNumber(0.5, HalfEdge.horizontalScanFraction01(edge90, 0.5)!, "scan crossing on simple vertical edge");
    expect(ck.getNumErrors()).equals(0);
  });
  it("isMaskedAroundFace", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const pointA0 = Point2d.create(1, 2);
    const pointA1 = Point2d.create(4, 3);
    const edgeA = graph.addEdgeXY(pointA0.x, pointA0.y, pointA1.x, pointA1.y);
    const edgeB = graph.addEdgeXY(pointA0.x, pointA0.y, 3, 4);
    ck.testFalse(edgeA.findAroundFace(edgeB));
    const pointB0 = edgeA.getPoint2d();
    const pointB1 = edgeA.faceSuccessor.getPoint2d();
    ck.testPoint2d(pointA0, pointB0);
    ck.testPoint2d(pointA1, pointB1);
    const vectorB01 = edgeA.getVector3dAlongEdge();
    const vectorA01 = Vector3d.createStartEnd(pointA0, pointA1);
    ck.testVector3d(vectorA01, vectorB01);
    HalfEdge.pinch(edgeA, edgeB);
    ck.testTrue(edgeA.findAroundFace(edgeB.faceSuccessor));
    // There are 4 edges around the face.
    ck.testFalse(edgeA.isMaskedAroundFace(HalfEdgeMask.BOUNDARY_EDGE, true));
    ck.testTrue(edgeA.isMaskedAroundFace(HalfEdgeMask.BOUNDARY_EDGE, false));
    edgeA.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    ck.testFalse(edgeA.isMaskedAroundFace(HalfEdgeMask.BOUNDARY_EDGE, true));
    ck.testFalse(edgeA.isMaskedAroundFace(HalfEdgeMask.BOUNDARY_EDGE, false));
    edgeA.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE);
    ck.testTrue(edgeA.isMaskedAroundFace(HalfEdgeMask.BOUNDARY_EDGE, true));
    ck.testFalse(edgeA.isMaskedAroundFace(HalfEdgeMask.BOUNDARY_EDGE, false));

    let numNodes = 0;
    graph.announceNodes(
      (_g: HalfEdgeGraph, _node: HalfEdge) => {
        numNodes++; return true;
  }
    );
    ck.testExactNumber(4, numNodes);

    // coverage for early exit from full-graph node, face, and vertex loops
    numNodes = 0;
    numNodes = 0;
    graph.announceNodes((_g: HalfEdgeGraph, node: HalfEdge) => {
      if (node === edgeA) return false;
      numNodes++; return true;
    });
    ck.testLT (numNodes, 4);

    numNodes = 0;
    graph.announceVertexLoops(
      (_g: HalfEdgeGraph, node: HalfEdge) => {
        return !node.findAroundVertex(edgeB);
      }
    );
    ck.testLT (numNodes, 3);

    numNodes = 0;
    graph.announceFaceLoops(
      (_g: HalfEdgeGraph, node: HalfEdge) => {
        return !node.findAroundFace(edgeB);
      }
    );
    ck.testExactNumber (numNodes, 0, "Graph's only face contains all nodes");

    expect(ck.getNumErrors()).equals(0);
  });
  it("NodeXYZUV", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const pointA0 = Point3d.create(1, 2);
    const pointA1 = Point3d.create(4, 3);
    const edgeA = graph.addEdgeXY(pointA0.x, pointA0.y, pointA1.x, pointA1.y);
    const _edgeB = graph.addEdgeXY(pointA0.x, pointA0.y, 3, 4);
    const pointQ = Point3d.create(10, 20, 30);
    const pointU0 = Point2d.create(5, 12);
    const markupA = NodeXYZUV.create(edgeA, 10, 20, 30, pointU0.x, pointU0.y);
    const pointR = markupA.getXYZAsPoint3d();
    ck.testPoint3d(pointQ, pointR);
    const pointU1 = markupA.getUVAsPoint2d();
    ck.testTrue(pointU0.isAlmostEqual(pointU1));
    ck.testPoint3d(pointQ, pointR);
    ck.testExactNumber(0, markupA.classifyU(pointU0.x, 0));
    ck.testExactNumber(1, markupA.classifyU(pointU0.x-3, 0));
    ck.testExactNumber(-1, markupA.classifyU(pointU0.x + 2, 0));
    const tol = 1.0e-5;
    const epsilon = 0.9 * tol;
    ck.testExactNumber(0, markupA.classifyU(pointU0.x + epsilon, tol));
    ck.testExactNumber(0, markupA.classifyU(pointU0.x - epsilon, tol));
    ck.testExactNumber(1, markupA.classifyU(pointU0.x-3 * epsilon, tol));
    ck.testExactNumber(-1, markupA.classifyU(pointU0.x + 2 * epsilon, tol));

    expect(ck.getNumErrors()).equals(0);
  });

  it("MovingPosition", () => {
    const ck = new Checker();
    const outputManager = new OutputManager();
    const graph = new HalfEdgeGraph();
    // 5 A              D
    // 4       Q
    // 3    P
    // 2 B     C
    //   1 2 3 4 5 6 7 8
    const pointA = Point3d.create(1, 5);
    const pointB = Point3d.create(1, 2);
    const pointC = Point3d.create(4, 2);
    const pointD = Point3d.create(8, 5);
    const pointP = Point3d.create(2, 3);
    const pointQ = Point3d.create(4, 4);
    const edgeA = graph.addEdgeXY(pointA.x, pointA.y, pointB.x, pointB.y);
    const edgeB = graph.addEdgeXY(pointB.x, pointB.y, pointC.x, pointC.y);
    const edgeC = graph.addEdgeXY(pointC.x, pointC.y, pointA.x, pointA.y);
    const edgeCD = graph.addEdgeXY(pointC.x, pointC.y, pointD.x, pointD.y);
    const edgeDA = graph.addEdgeXY(pointD.x, pointD.y, pointA.x, pointA.y);

    HalfEdge.pinch(edgeA.faceSuccessor, edgeB);
    HalfEdge.pinch(edgeB.faceSuccessor, edgeC);
    HalfEdge.pinch(edgeC.faceSuccessor, edgeA);
    HalfEdge.pinch(edgeCD, edgeC.vertexPredecessor);
    HalfEdge.pinch(edgeDA.faceSuccessor, edgeA.vertexSuccessor);
    HalfEdge.pinch(edgeCD.faceSuccessor, edgeDA);
    outputManager.z0 = -0.001;
    outputManager.drawGraph(graph);
    outputManager.z0 = 0.0;
    ck.testExactNumber(3, graph.countFaceLoops());
    ck.testExactNumber(4, graph.countVertexLoops());
    const walker = HalfEdgePositionDetail.createEdgeAtFraction(edgeA, 0.4);
    const context = InsertAndRetriangulateContext.create(graph);
    markPosition(outputManager, walker);
    ck.testTrue(walker.isEdge, "start on edge");
    moveAndMark(ck, outputManager, context, walker, pointP, HalfEdgeTopo.Face);
    moveAndMark(ck, outputManager, context, walker, pointQ, HalfEdgeTopo.Face);
    moveAndMark(ck, outputManager, context, walker, pointA, HalfEdgeTopo.Vertex);
    {
      // move sideways along an edge ...
      const pointE1 = pointA.interpolate(0.4, pointC);
      const pointE2 = pointA.interpolate(0.6, pointC);
      moveAndMark(ck, outputManager, context, walker, pointE1, HalfEdgeTopo.Edge);
      moveAndMark(ck, outputManager, context, walker, pointE2, HalfEdgeTopo.Edge);
      moveAndMark(ck, outputManager, context, walker, pointA, HalfEdgeTopo.Vertex);
      moveAndMark(ck, outputManager, context, walker, pointE2, HalfEdgeTopo.Edge);
      moveAndMark(ck, outputManager, context, walker, pointC, HalfEdgeTopo.Vertex);
      moveAndMark(ck, outputManager, context, walker, pointE2, HalfEdgeTopo.Edge);
      const pointAC2 = pointA.interpolate(2.0, pointC);
      moveAndMark(ck, outputManager, context, walker, pointAC2, HalfEdgeTopo.Vertex);
      moveAndMark(ck, outputManager, context, walker, pointE2, HalfEdgeTopo.Edge);
      const pointACNeg = pointA.interpolate(-1.0, pointC);
      moveAndMark(ck, outputManager, context, walker, pointACNeg, HalfEdgeTopo.Vertex);
    }
    moveAndMark(ck, outputManager, context, walker,
      pointA.interpolate (0.5, pointB), HalfEdgeTopo.Edge);

    // Exterior !!!!
    // moveTo does not identify this clearly.
    const pointZ1 = Point3d.create(5, 0, 0);
    moveAndMark(ck, outputManager, context, walker, pointZ1, undefined);
    const pointZ2 = Point3d.create(0.5, 0, 0);
    moveAndMark(ck, outputManager, context, walker, pointZ2, undefined);
    outputManager.saveToFile("Graph", "MovingPosition");
    expect(ck.getNumErrors()).equals(0);
  });
});
const markerSize = 0.04;
function markPosition(out: OutputManager, p: HalfEdgePositionDetail | undefined) {
  if (p) {
    if (p.isFace)
      out.drawPlus(p.clonePoint(), markerSize);
    else if (p.isEdge) {
      const nodeA = p.node!;
      const edgeVector = nodeA.getVector3dAlongEdge();
      const perpVector = edgeVector.unitPerpendicularXY();
      const edgePoint = p.clonePoint();
      out.drawLines([edgePoint, edgePoint.plusXYZ(markerSize * perpVector.x, markerSize * perpVector.y)]);
    } else if (p.isVertex) {
      const nodeA = p.node!;
      const xyz = p.clonePoint();
      const edgeVectorA = nodeA.getVector3dAlongEdge();
      const edgeVectorB = nodeA.facePredecessor.getVector3dAlongEdge();
      edgeVectorA.normalizeInPlace();
      edgeVectorB.normalizeInPlace();
      const xyz1 = xyz.plus2Scaled(edgeVectorA, markerSize, edgeVectorB, -markerSize);
      out.drawLines([xyz, xyz1]);
    }
  }
}
function moveAndMark(ck: Checker, out: OutputManager, context: InsertAndRetriangulateContext, position: HalfEdgePositionDetail, targetPoint: Point3d,
expectedTopo: HalfEdgeTopo | undefined) {
  const xyz0 = position.clonePoint();
  context.moveToPoint(position, targetPoint);
  out.drawLines([xyz0, position.clonePoint()]);
  markPosition(out, position);
  if (expectedTopo !== undefined) {
    ck.testExactNumber(expectedTopo as number, position.getTopo());
  } else {
    ck.testTrue(position.isExteriorTarget, "Expect exterior target setting");
  }

}
