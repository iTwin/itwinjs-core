/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { NumberArray } from "../../geometry3d/PointHelpers";
import { IndexedPolyfaceWalker } from "../../polyface/IndexedPolyfaceWalker";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Checker } from "../Checker";

function verifyStrictlyIncreasingArraySearch(ck: Checker, data: number[], name: string) {
  for (let i0 = 0; i0 + 1 < data.length; i0++) {
    for (let k = data[i0]; k < data[i0 + 1]; k++) {
      const i = NumberArray.searchStrictlyIncreasingNumbers(data, k);
      if (ck.testDefined(i, "expect searchStrictlyIncreasingNumbers to return defined"))
        ck.testExactNumber(i0, i, `searchStrictlyIncreasingNumbers(${k}) on ${name} indices returns the floor index`);
    }
  }
}
function verifyEdgeMates(ck: Checker, polyface: IndexedPolyface) {
  const numFacets = polyface.facetCount;
  let facetIndex;
  for (facetIndex = 0; polyface.isValidFacetIndex(facetIndex); facetIndex++) {
    const k0 = polyface.facetIndex0(facetIndex);
    const k1 = polyface.facetIndex1(facetIndex);
    for (let k = k0; k < k1; k++) {
      const offsetWithinFacet = k - k0;
      const walker = IndexedPolyfaceWalker.createAtEdgeIndex(polyface, k);
      const walkerF = IndexedPolyfaceWalker.createAtFacetIndex(polyface, facetIndex, offsetWithinFacet);
      ck.testTrue(walker.isSameEdge(walkerF), `createAtEdgeIndex(k) === createAtFacetIndex(f,k-k0) for f=${facetIndex}, k=${k}, k0=${k0}`);
      const fNext = walker.nextAroundFacet();
      const fNextPrev = fNext.previousAroundFacet();
      checkWalkerPair(ck, "face steps", walker, fNext, false, fNextPrev);
      const vNext = walker.nextAroundVertex();
      const vNextPrev = vNext.previousAroundVertex();
      checkWalkerPair(ck, "vertex steps", walker, vNext, true, vNextPrev);
    }
  }
  ck.testExactNumber(numFacets, facetIndex, "confirm facet count");
}
function checkWalkerPair(ck: Checker, action: string, w: IndexedPolyfaceWalker, wNext: IndexedPolyfaceWalker, wNextMayBeUndefined: boolean, wNextPrev: IndexedPolyfaceWalker) {
  if (ck.testTrue(w.isValid, "expect walker to be valid")) {
    ck.testTrue(wNext.isValid || wNextMayBeUndefined, "expect next walker to be valid");
    if (wNext.isValid) {
      ck.testTrue(w.isDifferentEdgeInSamePolyface(wNext), `Expected ${action} action to move to a different edge`);
      ck.testTrue(w.isSameEdge(wNextPrev), `Expected ${action} action to return to start`);
    }
  }
}
describe("IndexedPolyfaceWalker", () => {
  it("edgeIndexToFacetIndex", () => {
    const ck = new Checker();
    const triIndices = [0, 3, 6, 9, 12, 15, 18];
    verifyStrictlyIncreasingArraySearch(ck, triIndices, "triangle");
    const quadIndices = [0, 4, 8, 12, 16];
    verifyStrictlyIncreasingArraySearch(ck, quadIndices, "quad");
    const mixedIndices = [0, 4, 12, 14, 20, 23, 30, 40, 43, 46, 49];
    verifyStrictlyIncreasingArraySearch(ck, mixedIndices, "mixed");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("edgeMates", () => {
    const ck = new Checker();
    // Vertex layout (by index)
    //    5   2   4
    //    0   1   3
    const builder = PolyfaceBuilder.create();
    const points: Point3d[] = [
      Point3d.create(0, 0, 0),
      Point3d.create(1, 0, 0),
      Point3d.create(1, 1, 0),
      Point3d.create(2, 0, 0),
      Point3d.create(2, 1, 0),
      Point3d.create(0, 1, 0),
    ];
    let numInteriorEdges = 0;
    builder.addPolygon([points[0], points[1], points[2]]);
    builder.addPolygon([points[1], points[4], points[2]]); numInteriorEdges++;
    builder.addPolygon([points[1], points[3], points[4]]); numInteriorEdges++;
    builder.addPolygon([points[0], points[2], points[5]]); numInteriorEdges++;

    const polyface = builder.claimPolyface();
    IndexedPolyfaceWalker.buildEdgeMateIndices(polyface);
    verifyEdgeMates(ck, polyface);
    let numMatched = 0;
    for (let k = 0; k < polyface.data.pointIndex.length; k++) {
      const walker = IndexedPolyfaceWalker.createAtEdgeIndex(polyface, k);
      const walker1 = walker.edgeMate();
      checkWalkerPair(ck, "edgeMate", walker, walker1, true, walker1.edgeMate());
      if (walker1.isValid)
        numMatched++;
    }
    ck.testExactNumber(numMatched, 2 * numInteriorEdges, "# edgeMates is twice # interior edges");
    expect(ck.getNumErrors()).toBe(0);
  });
});
