/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Sample } from "../../serialization/GeometrySamples";
import { HalfEdge, HalfEdgeGraph } from "../../topology/Graph";
import { HalfEdgeGraphSearch } from "../../topology/HalfEdgeGraphSearch";
import { HalfEdgePriorityQueueWithPartnerArray } from "../../topology/HalfEdgePriorityQueue";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { Triangulator } from "../../topology/Triangulation";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { GraphChecker } from "./Graph.test";

describe("GraphMerge", () => {

  it("HalfEdgePriorityQueueWithPartnerArray", () => {
    const ck = new Checker();
    const edges = new HalfEdgePriorityQueueWithPartnerArray();
    const graph = new HalfEdgeGraph();
    const a = 0.31;
    const n = 20;
    for (let i = 0; i < n; i++) {
      const y0 = a * i;
      const e = graph.addEdgeXY(i, y0, i + 0.5, y0 + 1);
      edges.priorityQueue.push(e);
    }
    ck.testExactNumber(n, edges.priorityQueue.length);
    ck.testExactNumber(0, edges.activeEdges.length);

    for (let k = 1; k < 4; k++) {
      edges.popQueueToArray();
      ck.testExactNumber(n - k, edges.priorityQueue.length);
      ck.testExactNumber(k, edges.activeEdges.length);
    }
    // shuffle the array ...
    edges.popArrayToArrayIndex(1);
    let q;
    while ((q = edges.popQueueToArray()) !== undefined) {
      for (const p of edges.activeEdges) {
        if (p !== q)
          ck.testTrue(p.y < q.y, "low y moved to active edges first");
      }
      edges.removeArrayMembersWithY1Below(q.faceSuccessor.y);

    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("MergeQuadQuad", () => {
    const ck = new Checker();
    const dy = 20.0;
    let y0 = 0.0;
    let x0 = 0.0;
    const allGeometry: GeometryQuery[] = [];
    const loop0 = Sample.createRectangleXY(0, 0, 4, 5);
    const loop1 = Sample.createRectangleXY(1, 2, 6, 12);

    for (const degrees of [10, 0, 1.2, 55]) {
      const graph = new HalfEdgeGraph();
      const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
      Triangulator.createFaceLoopFromCoordinates(graph, loop0, true, false);
      Triangulator.createFaceLoopFromCoordinates(graph, loop1, true, false);
      graph.transformInPlace(transform);
      const splits = HalfEdgeGraphMerge.splitIntersectingEdges(graph);
      //
      console.log(`SPLITS = ${prettyPrint(splits)}`);
      // There are 8 edges.  2 pairs intersect, each generating 2 individual splits, creating 4 more.  (Each split counts as )
      ck.testExactNumber(4, splits.numSplit, "splits");
      ck.testExactNumber(12, splits.numUpEdge, "up edge");
      // ck.testExactNumber(8, splits.numPopOut, "pop out");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [LineString3d.create(loop0), LineString3d.create(loop1)], x0, y0 += dy, 0);
      GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0 += dy);

      HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
      GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0 += dy);

      GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph, undefined, HalfEdge.testFacePositiveAreaXY), x0, y0 += dy, 0);

      Triangulator.triangulateAllPositiveAreaFaces(graph);
      GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph, undefined, HalfEdge.testFacePositiveAreaXY), x0, y0 += dy, 0);

      const summary1 = HalfEdgeGraphSearch.collectFaceAreaSummary(graph, true);
      ck.testExactNumber(summary1.numNegative, summary1.negativeItemArray!.length, " negative face counts");
      ck.testExactNumber(summary1.numPositive, summary1.positiveItemArray!.length, " positive face counts");
      ck.testExactNumber(summary1.numZero, summary1.zeroItemArray!.length, " zero face counts");
      GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "MergeQuadQuad");
      x0 += dy;
      y0 = 0.0;
    }
    expect(ck.getNumErrors()).equals(0);
  });
});
