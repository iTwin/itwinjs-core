/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { HalfEdge, HalfEdgeGraph } from "../../topology/Graph";
import { HalfEdgeGraphFromIndexedLoopsContext } from "../../topology/HalfEdgeGraphFromIndexedLoopsContext";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GraphChecker } from "./Graph.test";

function formatNodeForDump(he: HalfEdge): string {
  const o = { id: he.id, psm: [he.facePredecessor.id, he.faceSuccessor.id, he.edgeMate.id, HalfEdge.nodeToMaskString(he)] };
  // return prettyPrint (o);
  return JSON.stringify(o);
}
function checkCounts(ck: Checker, graph: HalfEdgeGraph, message: string, numVertices: number, numEdges: number, numFaces: number) {
  const numVerticesA = graph.countVertexLoops();
  const numNodesA = graph.countNodes();
  const numFacesA = graph.countFaceLoops();
  if (!ck.testExactNumber(numVertices, numVerticesA, "numVertices")
    || !ck.testExactNumber(2 * numEdges, numNodesA, "numEdges") // (There are two nodes per edge)
    || !ck.testExactNumber(numFaces, numFacesA, "numFaces")) {
    GeometryCoreTestIO.consoleLog(message);
    GeometryCoreTestIO.consoleLog({ numVerticesA, numNodesA, numFacesA });
    GraphChecker.dumpGraph(graph);
  }
}
describe("HalfEdgeGraphFromIndexedLoopsContext", () => {
  it("HalfEdgeGraphFromIndexedLoopsContext", () => {
    const ck = new Checker();
    const builder = new HalfEdgeGraphFromIndexedLoopsContext();
    let expectedFaces = 0;
    let expectedEdges = 0;
    let expectedVertices = 0;
    builder.insertLoop([1, 2, 3]); expectedFaces += 2; expectedEdges += 3; expectedVertices += 3;
    checkCounts(ck, builder.graph, "After first insertLoop", expectedVertices, expectedEdges, expectedFaces);
    builder.insertLoop([3, 2, 5]); expectedFaces++; expectedEdges += 2; expectedVertices += 1;
    checkCounts(ck, builder.graph, "After second insertLoop", expectedVertices, expectedEdges, expectedFaces);
    builder.insertLoop([5, 2, 1, 6, 7]); expectedFaces++; expectedEdges += 3; expectedVertices += 2;
    if (Checker.noisy.halfEdgeGraphFromIndexedLoops)
      GraphChecker.dumpGraph(builder.graph, formatNodeForDump);
    checkCounts(ck, builder.graph, "After third insertLoop", expectedVertices, expectedEdges, expectedFaces);
    expect(ck.getNumErrors()).equals(0);
  });

});
