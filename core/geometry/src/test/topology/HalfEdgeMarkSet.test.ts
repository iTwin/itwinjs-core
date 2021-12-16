/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import { HalfEdge, HalfEdgeGraph } from "../../topology/Graph";
import { AbstractHalfEdgeGraphMarkSet, MarkedEdgeSet, MarkedFaceSet, MarkedHalfEdgeSt, MarkedVertexSet } from "../../topology/HalfEdgeMarkSet";
import { Checker } from "../Checker";

describe("HalfEdgeMarkSet", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const halfEdgeSet = MarkedHalfEdgeSt.create(graph);
    const edgeSet = MarkedEdgeSet.create(graph);
    const faceSet = MarkedFaceSet.create(graph);
    const vertexSet = MarkedVertexSet.create(graph);
    ck.testDefined(halfEdgeSet);
    if (halfEdgeSet && edgeSet && faceSet && vertexSet) {
      ck.testFalse(halfEdgeSet.mask === edgeSet.mask, "Distinct grabbed masks");
      ck.testFalse(faceSet.mask === edgeSet.mask, "Distinct grabbed masks");
      ck.testFalse(vertexSet.mask === edgeSet.mask, "Distinct grabbed masks");
      ck.testExactNumber(0, faceSet.getLength());

      halfEdgeSet.teardown();
      edgeSet.teardown();
      vertexSet.teardown();
      faceSet.teardown();
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("SmallGraph", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const halfEdgeSet = MarkedHalfEdgeSt.create(graph);
    const edgeSet = MarkedEdgeSet.create(graph);
    const faceSet = MarkedFaceSet.create(graph);
    const vertexSet = MarkedVertexSet.create(graph);
    ck.testDefined(halfEdgeSet);
    if (halfEdgeSet && edgeSet && faceSet && vertexSet) {
      // These nodes are inside a square sharing an edge with a triangle.
      const nodeQ0 = graph.createEdgeXYZXYZ(0, 0, 0, 0, 1, 0, 0, 0);
      const nodeQ1 = graph.createEdgeXYZXYZ(1, 0, 0, 0, 1, 1, 0, 0);
      const nodeQ2 = graph.createEdgeXYZXYZ(1, 1, 0, 0, 0, 1, 0, 0);
      const nodeQ3 = graph.createEdgeXYZXYZ(0, 1, 0, 0, 0, 0, 0, 0);
      HalfEdge.pinch(nodeQ0.faceSuccessor, nodeQ1);
      HalfEdge.pinch(nodeQ1.faceSuccessor, nodeQ2);
      HalfEdge.pinch(nodeQ2.faceSuccessor, nodeQ3);
      HalfEdge.pinch(nodeQ3.faceSuccessor, nodeQ0);

      const nodeT0 = graph.createEdgeXYZXYZ(0, 0, 0, 0, 1, 0, 0, 0);
      const nodeT1 = graph.createEdgeXYZXYZ(0, 0, 0, 0, 1, 0, 0, 0);

      HalfEdge.pinch(nodeQ1.vertexPredecessor, nodeT0);
      HalfEdge.pinch(nodeT0.faceSuccessor, nodeT1);
      HalfEdge.pinch(nodeT1.faceSuccessor, nodeQ2.vertexPredecessor);
      // confirm rudimentary graph structure ...
      ck.testExactNumber(3, graph.countFaceLoops());
      ck.testExactNumber(5, graph.countVertexLoops());

      for (let pass = 0; pass < 3; pass++) {
        halfEdgeSet.addToSet(nodeQ0);
        edgeSet.addToSet(nodeQ0);
        faceSet.addToSet(nodeQ1);
        vertexSet.addToSet(nodeQ1);
        ck.testExactNumber(1, graph.countMask(halfEdgeSet.mask), `halfEdgeSet singleton  ${pass}`);
        ck.testExactNumber(2, graph.countMask(edgeSet.mask), `edgeSet singleton  ${pass}`);
        ck.testExactNumber(4, graph.countMask(faceSet.mask), `faceSet singleton  ${pass}`);
        ck.testExactNumber(3, graph.countMask(vertexSet.mask), `vertexSet singleton  ${pass}`);
        // add everything around the quad face
        let node = nodeQ0;
        do {
          halfEdgeSet.addToSet(node);
          edgeSet.addToSet(node);
          faceSet.addToSet(node);
          vertexSet.addToSet(node);
          node = node.faceSuccessor;
        } while (node !== nodeQ0);

        verifyMarkSetState(ck, `HalfEdge MarkSet on pass (  ${pass} )`, halfEdgeSet, 4, 4);
        verifyMarkSetState(ck, `edge MarkSet on pass (  ${pass} )`, edgeSet, 8, 4);
        verifyMarkSetState(ck, `face MarkSet on pass (  ${pass} )`, faceSet, 4, 1);
        verifyMarkSetState(ck, `vertex MarkSet on pass (  ${pass} )`, vertexSet, 10, 4);

        halfEdgeSet.addAroundFace(nodeT1);
        edgeSet.addAroundFace(nodeT1);
        faceSet.addAroundFace(nodeT1);
        vertexSet.addAroundFace(nodeT1);

        verifyMarkSetState(ck, `HalfEdge MarkSet addAroundFace on pass (  ${pass} )`, halfEdgeSet, 7, 7);
        verifyMarkSetState(ck, `edge MarkSet addAroundFace on pass (  ${pass} )`, edgeSet, 12, 6);
        verifyMarkSetState(ck, `face MarkSet addAroundFace on pass (  ${pass} )`, faceSet, 7, 2);
        verifyMarkSetState(ck, `vertex MarkSet addAroundFace on pass (  ${pass} )`, vertexSet, 12, 5);

        verifyMarkSetRemoval(ck, halfEdgeSet, nodeQ2);
        verifyMarkSetRemoval(ck, edgeSet, nodeQ2);
        verifyMarkSetRemoval(ck, faceSet, nodeQ2);
        verifyMarkSetRemoval(ck, vertexSet, nodeQ2);

        verifyMarkSetRemoval(ck, halfEdgeSet, nodeQ2);
        verifyMarkSetRemoval(ck, edgeSet, nodeQ2);
        verifyMarkSetRemoval(ck, faceSet, nodeQ2);
        verifyMarkSetRemoval(ck, vertexSet, nodeQ2);

        // clear all sets for next pass
        halfEdgeSet.clear();
        edgeSet.clear();
        vertexSet.clear();
        faceSet.clear();

        halfEdgeSet.addAroundVertex(nodeT1);
        edgeSet.addAroundVertex(nodeT1);
        faceSet.addAroundVertex(nodeT1);
        vertexSet.addAroundVertex(nodeT1);

        verifyMarkSetState(ck, `HalfEdge MarkSet addAroundVertex on pass (  ${pass} )`, halfEdgeSet, 2, 2);
        verifyMarkSetState(ck, `edge MarkSet addAroundVertex on pass (  ${pass} )`, edgeSet, 4, 2);
        verifyMarkSetState(ck, `face MarkSet addAroundVertex on pass (  ${pass} )`, faceSet, 8, 2);
        verifyMarkSetState(ck, `vertex MarkSet addAroundVertex on pass (  ${pass} )`, vertexSet, 2, 1);
        // clear all sets for next pass
        halfEdgeSet.clear();
        edgeSet.clear();
        vertexSet.clear();
        faceSet.clear();

      }
      halfEdgeSet.teardown();
      edgeSet.teardown();
      vertexSet.teardown();
      faceSet.teardown();
    }

    // Hard to reach lines ..
    // drain the mask pool in the graph ...
    while (graph.grabMask() !== 0) { }
    // and all the mark set creations will fail ...
    ck.testUndefined(MarkedHalfEdgeSt.create(graph));
    ck.testUndefined(MarkedEdgeSet.create(graph));
    ck.testUndefined(MarkedFaceSet.create(graph));
    ck.testUndefined(MarkedVertexSet.create(graph));
    expect(ck.getNumErrors()).equals(0);
  });

});

function verifyMarkSetState(ck: Checker, title: string, markSet: AbstractHalfEdgeGraphMarkSet, expectedMaskCount: number, expectedLength: number) {
  const graph = markSet.graph;
  ck.testExactNumber(expectedMaskCount, graph.countMask(markSet.mask), `${title} mask count`);
  ck.testExactNumber(expectedLength, markSet.getLength(), `${title} member count by method query`);
  let myLength = 0;
  let numNull = 0;
  for (const he of markSet) {
    if (he)
      myLength++;
    else
      numNull++;
  }
  ck.testExactNumber(expectedLength, myLength, `${title} member count by iterator`);
  ck.testExactNumber(0, numNull, "check no nulls");
}

function verifyMarkSetRemoval(ck: Checker, markSet: AbstractHalfEdgeGraphMarkSet, candidate: HalfEdge) {
  ck.testUndefined(markSet.getAtIndex(-1), "negative index access");
  ck.testExactNumber(0, markSet.countHalfEdgesAroundCandidate(undefined), "countHalfEdges around undefined");
  const graph = markSet.graph;
  const mask = markSet.mask;
  const totalMasks = graph.countMask(mask);
  const candidateMasks = markSet.countHalfEdgesAroundCandidate(candidate);
  const numNullCandidates = countNullCandidates(markSet);
  if (markSet.isCandidateInSet(candidate)) {
    markSet.removeFromSet(candidate);
    ck.testExactNumber(totalMasks - candidateMasks, graph.countMask(mask), " mark set removal mask count");
    ck.testExactNumber(numNullCandidates + 1, countNullCandidates(markSet), "confirm placeholder left in array");
  } else {
    markSet.removeFromSet(candidate);
    ck.testExactNumber(totalMasks, graph.countMask(mask), " mark set removal mask count (noop case)");
    ck.testExactNumber(numNullCandidates, countNullCandidates(markSet), "confirm no array change on noop removal");
  }
  // count live candidates manually to exercise some branches
  let numMembers = 0;
  let numNull = 0;
  for (const c of markSet) {
    if (c)
      numMembers++;
    else
      numNull++;
  }
  ck.testExactNumber(numMembers, markSet.getLength(), "check length versus iterator");
  ck.testExactNumber(0, numNull, "check no nulls");
}

function countNullCandidates(markSet: AbstractHalfEdgeGraphMarkSet): number {
  return markSet.getNumCandidates() - markSet.getLength();
}
