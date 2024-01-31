/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { IndexedPolyface } from "../../polyface/Polyface";
import { IndexedPolyfaceWalker } from "../../polyface/PolyfaceWalker";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";

function verifyMonotoneArraySearch(ck: Checker, data: number[], name: String) {
  for (let i0 = 0; i0 + 1 < data.length; i0++) {
    for (let k = data[i0]; k < data[i0 + 1]; k++) {
      const i = IndexedPolyface.searchMonotoneNumbers(data, k);
      if (ck.testDefined(i, "undefined from searchMonotone") && i !== undefined)
        ck.testExactNumber(i0, i, { name, i0, k, i });
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
      const walkerZ = IndexedPolyfaceWalker.createAtFacetIndex(polyface, facetIndex, offsetWithinFacet);

      const walker = IndexedPolyfaceWalker.createAtEdgeIndex(polyface, k);
      const kZ = walkerZ.edgeIndex;
      ck.testTrue(walker.isSameEdge(walkerZ), { error: "createAtFacetIndex", facetIndex, k, k0, k1, kZ });
      const walker1 = walker.nextAroundFacet();
      const walker2 = walker1.previousAroundFacet();
      checkWalkerPair(ck, "face steps", walker, walker1, false, walker2);
      const walker3 = walker.nextAroundVertex();
      const walker4 = walker3.previousAroundVertex();
      checkWalkerPair(ck, "vertex steps", walker, walker3, true, walker4);
    }
  }
  ck.testExactNumber(numFacets, facetIndex, "confirm facet count");
}
function checkWalkerPair(ck: Checker, action: String, walker0: IndexedPolyfaceWalker, walker1: IndexedPolyfaceWalker, walker1MayBeUndefined: boolean, walker2: IndexedPolyfaceWalker) {
  if (walker0.isValid) {
    if (!walker1.isValid) {
      if (!walker1MayBeUndefined)
        ck.announceError({ action, error: "walker1 must be defined" });
    } else {
      ck.testTrue(walker0.isDifferentEdgeInSamePolyface(walker1), { action, error: "Expect move to different edge" });
      ck.testTrue(walker0.isSameEdge(walker2), { action, error: "Expected return to start" });
    }
  }
}

it("edgeIndexToFacetIndex", () => {
  const ck = new Checker();
  const triIndices = [0, 3, 6, 9, 12, 15, 18];
  verifyMonotoneArraySearch(ck, triIndices, "triangles");
  const quadIndices = [];
  for (let q = 0; q < 5; q++)
    quadIndices.push(4 * q);
  verifyMonotoneArraySearch(ck, triIndices, "triangles");
  verifyMonotoneArraySearch(ck, quadIndices, "quads");
  const mixedIndices = [0, 4, 12, 14, 20, 23, 30, 40, 43, 46, 49];
  verifyMonotoneArraySearch(ck, mixedIndices, "mixed");
  expect(ck.getNumErrors()).equals(0);

});

it("edgeMatesI", () => {
  const ck = new Checker();
  //
  //    5     2   4
  //    0    1   3
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
    const walker = IndexedPolyfaceWalker.createAtEdgeIndex(polyface, k)!;
    const walker1 = walker.edgeMate();
    checkWalkerPair(ck, "edgeMate", walker, walker1, true, walker1.edgeMate());
    if (walker1.isValid)
      numMatched++;
  }
  ck.testExactNumber(numMatched, 2 * numInteriorEdges);
  expect(ck.getNumErrors()).equals(0);

});
