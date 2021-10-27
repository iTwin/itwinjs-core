/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IndexedEdgeMatcher, SortableEdge, SortableEdgeCluster } from "../../polyface/IndexedEdgeMatcher";
import { Checker } from "../Checker";

describe("SortableEdgeCluster", () => {
  it("hello", () => {
    const ck = new Checker();
    const edgeArray = new IndexedEdgeMatcher();
    //
    //                4 <<<<<<<< 3
    //                v          ^
    //                v  F0      ^
    //                1 >>>>>>>> 2
    //     0<<<<<<<<< 1 <<<<<<<< 2<<<<<<<<10
    //     V         ^V          ^ V  F5  ^
    //     V   F2    ^V   F1     ^ V      ^
    //     5 >>>>>>>> 6 >>>>>>>> 7>>>>>>>>10    degenerate 10 to 10  !!
    //       >>>>>>>>
    //     ^          V
    //     ^   F3     V
    //     8 <<<<<<<  9
    //     8 <<<<<<<  9
    //     8 >>F4>>>  9   // nul face F4!!!!
    //
    edgeArray.addPath([1, 2, 3, 4], 0);
    ck.testTrue(edgeArray.edges[0].isLowHigh, "low to high");
    ck.testFalse(edgeArray.edges[3].isLowHigh, "high to low");
    ck.testExactNumber(edgeArray.edges[0].vertexIndexA, edgeArray.edges[3].vertexIndexB, "confirm facet closure");
    edgeArray.addPath([1, 6, 7, 2], 1);
    ck.testExactNumber(1, edgeArray.edges[4].facetIndex, "confirm facet index");
    const n1 = edgeArray.edges.length;
    edgeArray.addPath([], 20);  // force null return.
    ck.testExactNumber(n1, edgeArray.edges.length, "confirm no edges added with empty input");
    edgeArray.addPath([5, 6, 1, 0], 2);
    edgeArray.addPath([6, 9, 8, 5], 3);    // Clockwise == creates error case 5>>>6 !!!
    edgeArray.addPath([8, 9], 4);
    edgeArray.addPath([2, 7, 10, 10, 2], 5, false);    // null edge, with explicit closure

    const manifold: SortableEdgeCluster[] = [];
    const boundary: SortableEdgeCluster[] = [];
    const compound: SortableEdgeCluster[] = [];
    const nullEdges: SortableEdgeCluster[] = [];
    edgeArray.sortAndCollectClusters(manifold, boundary, nullEdges, compound);
    ck.testExactNumber(3, manifold.length, "edge pairs", SortableEdge.clusterArrayToJSON(manifold));
    ck.testExactNumber(10, boundary.length, "boundary edges", SortableEdge.clusterArrayToJSON(boundary));
    ck.testExactNumber(2, compound.length, "clusters", JSON.stringify(SortableEdge.clusterArrayToJSON(compound)));
    ck.testExactNumber(1, nullEdges.length, "null", JSON.stringify(SortableEdge.clusterArrayToJSON(nullEdges)));

    edgeArray.sortAndCollectClusters(undefined, undefined, undefined, undefined);
    if (nullEdges.length === 1) {
      const edge = nullEdges[0] as SortableEdge;
      ck.testExactNumber(5, edge.facetIndex, "confirm facet of null edge");
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("singleFaceCube", () => {
    const ck = new Checker();
    // Cube vertex numbers ......
    //
    //           0-------------------1
    //           | \               / |
    //           |   2-----------3   |
    //           |   |           |   |
    //           |   |           |   |
    //           |   4-----------5   |
    //           | /              \  |
    //           6------------------7

    const edgeArray = new IndexedEdgeMatcher();
    // wander around and catch both sides of all the edges in one path !!
    edgeArray.addPath(
      [5, 3,
        5, 7, 1, 3,
        1, 0, 2, 3,
        2, 4, 2,
        0, 6, 0, 1, 7,
        6, 4, 6, 7, 5, 4, 5], 0, false);
    const manifold: SortableEdgeCluster[] = [];
    const boundary: SortableEdgeCluster[] = [];
    const compound: SortableEdgeCluster[] = [];
    const nullEdges: SortableEdgeCluster[] = [];
    edgeArray.sortAndCollectClusters(manifold, boundary, nullEdges, compound);
    ck.testExactNumber(12, manifold.length, "edge pairs", SortableEdge.clusterArrayToJSON(manifold));
    ck.testExactNumber(0, boundary.length, "boundary edges", SortableEdge.clusterArrayToJSON(boundary));
    ck.testExactNumber(0, compound.length, "clusters", JSON.stringify(SortableEdge.clusterArrayToJSON(compound)));
    ck.testExactNumber(0, nullEdges.length, "null", JSON.stringify(SortableEdge.clusterArrayToJSON(nullEdges)));
    expect(ck.getNumErrors()).equals(0);
  });
});
