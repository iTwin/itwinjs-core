/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceData } from "../../polyface/PolyfaceData";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";

describe("PolyfaceData", () => {
  it("PolyfaceData.isValidFacetStartIndexArray", () => {
    const ck = new Checker();
    ck.testFalse(PolyfaceData.isValidFacetStartIndexArray([]), "Facet start minimal index must have leading 0");
    ck.testFalse(PolyfaceData.isValidFacetStartIndexArray([2, 1]), "Facet start index must have leading 0");
    ck.testFalse(PolyfaceData.isValidFacetStartIndexArray([0, 4, 7, 6]), "Facet start index must be sorted");
    ck.testTrue(PolyfaceData.isValidFacetStartIndexArray([0, 4, 6, 12]), "Facet start index is valid");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfaceData.Compress", () => {
    const ck = new Checker();
    const pf = IndexedPolyface.create();
    ck.testFalse(pf.data.requireNormals);
    // add first facet
    pf.addPointXYZ(0, 0, 0);
    pf.addPointXYZ(1, 0, 0);
    pf.addPointXYZ(1, 1, 0);
    pf.addPointXYZ(0, 1, 0);
    pf.addPointIndex(0);
    pf.addPointIndex(1);
    pf.addPointIndex(2);
    pf.addPointIndex(3);
    const m0 = pf.terminateFacet(true);
    ck.testUndefined(m0, m0);
    // add second facet
    pf.addPointXYZ(1, 0, 0);
    pf.addPointXYZ(2, 0, 0);
    pf.addPointXYZ(2, 1, 0);
    pf.addPointXYZ(1, 1, 0);
    pf.addPointIndex(4);
    pf.addPointIndex(5);
    pf.addPointIndex(6);
    pf.addPointIndex(7);
    const m1 = pf.terminateFacet(true);
    ck.testUndefined(m1, m1);
    ck.testExactNumber(0, pf.faceCount); // "face" is "cluster of facets"; no clustering has been defined
    ck.testExactNumber(2, pf.facetCount);
    ck.testExactNumber(8, pf.pointCount);
    pf.data.compress();
    ck.testExactNumber(0, pf.faceCount);
    ck.testExactNumber(2, pf.facetCount);
    ck.testExactNumber(6, pf.pointCount);
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfaceData.reverseIndices", () => {
    const ck = new Checker();
    const origin = Point3d.create(1, 2, 3);
    const numX = 3;
    const numY = 2;
    const polyface0 = Sample.createTriangularUnitGridPolyface(
      origin, Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0),
      numX, numY,
      true, true, true, // params, normals, and colors
    );
    ck.testExactNumber(polyface0.data.pointIndex[0], 0);
    ck.testExactNumber(polyface0.data.pointIndex[1], 1);
    ck.testExactNumber(polyface0.data.pointIndex[2], 4);
    ck.testExactNumber(polyface0.data.pointIndex[3], 4);
    ck.testExactNumber(polyface0.data.pointIndex[4], 3);
    ck.testExactNumber(polyface0.data.pointIndex[5], 0);
    ck.testExactNumber(polyface0.data.pointIndex[6], 1);
    ck.testExactNumber(polyface0.data.pointIndex[7], 2);
    ck.testExactNumber(polyface0.data.pointIndex[8], 5);
    ck.testExactNumber(polyface0.data.pointIndex[9], 5);
    ck.testExactNumber(polyface0.data.pointIndex[10], 4);
    ck.testExactNumber(polyface0.data.pointIndex[11], 1);
    // reverse with preserveStart = true
    const facetStartIndex = [0, 3, 6, 9, 12];
    let preserveStart = true;
    let ret = PolyfaceData.reverseIndices(facetStartIndex, polyface0.data.pointIndex, preserveStart);
    ck.testTrue(ret);
    ck.testExactNumber(polyface0.data.pointIndex[0], 0);
    ck.testExactNumber(polyface0.data.pointIndex[1], 4);
    ck.testExactNumber(polyface0.data.pointIndex[2], 1);
    ck.testExactNumber(polyface0.data.pointIndex[3], 4);
    ck.testExactNumber(polyface0.data.pointIndex[4], 0);
    ck.testExactNumber(polyface0.data.pointIndex[5], 3);
    ck.testExactNumber(polyface0.data.pointIndex[6], 1);
    ck.testExactNumber(polyface0.data.pointIndex[7], 5);
    ck.testExactNumber(polyface0.data.pointIndex[8], 2);
    ck.testExactNumber(polyface0.data.pointIndex[9], 5);
    ck.testExactNumber(polyface0.data.pointIndex[10], 1);
    ck.testExactNumber(polyface0.data.pointIndex[11], 4);
    // reverse back
    ret = PolyfaceData.reverseIndices(facetStartIndex, polyface0.data.pointIndex, preserveStart);
    ck.testTrue(ret);
    // reverse with preserveStart = false
    preserveStart = false;
    ret = PolyfaceData.reverseIndices(facetStartIndex, polyface0.data.pointIndex, preserveStart);
    ck.testTrue(ret);
    ck.testExactNumber(polyface0.data.pointIndex[0], 4);
    ck.testExactNumber(polyface0.data.pointIndex[1], 1);
    ck.testExactNumber(polyface0.data.pointIndex[2], 0);
    ck.testExactNumber(polyface0.data.pointIndex[3], 0);
    ck.testExactNumber(polyface0.data.pointIndex[4], 3);
    ck.testExactNumber(polyface0.data.pointIndex[5], 4);
    ck.testExactNumber(polyface0.data.pointIndex[6], 5);
    ck.testExactNumber(polyface0.data.pointIndex[7], 2);
    ck.testExactNumber(polyface0.data.pointIndex[8], 1);
    ck.testExactNumber(polyface0.data.pointIndex[9], 1);
    ck.testExactNumber(polyface0.data.pointIndex[10], 4);
    ck.testExactNumber(polyface0.data.pointIndex[11], 5);
    expect(ck.getNumErrors()).equals(0);
  });
  it("PolyfaceData.reverseIndicesSingleFacet", () => {
    const ck = new Checker();
    const origin = Point3d.create(1, 2, 3);
    const numX = 3;
    const numY = 2;
    const polyface0 = Sample.createTriangularUnitGridPolyface(
      origin, Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0),
      numX, numY,
      true, true, true, // params, normals, and colors
    );
    ck.testExactNumber(polyface0.data.pointIndex[0], 0);
    ck.testExactNumber(polyface0.data.pointIndex[1], 1);
    ck.testExactNumber(polyface0.data.pointIndex[2], 4);
    ck.testExactNumber(polyface0.data.pointIndex[3], 4);
    ck.testExactNumber(polyface0.data.pointIndex[4], 3);
    ck.testExactNumber(polyface0.data.pointIndex[5], 0);
    ck.testExactNumber(polyface0.data.pointIndex[6], 1);
    ck.testExactNumber(polyface0.data.pointIndex[7], 2);
    ck.testExactNumber(polyface0.data.pointIndex[8], 5);
    ck.testExactNumber(polyface0.data.pointIndex[9], 5);
    ck.testExactNumber(polyface0.data.pointIndex[10], 4);
    ck.testExactNumber(polyface0.data.pointIndex[11], 1);
    // reverse first facet
    const facetStartIndex = [0, 3, 6, 9, 12];
    const preserveStart = true;
    let facetId = 0;
    let ret = PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, polyface0.data.pointIndex, preserveStart);
    ck.testTrue(ret);
    ck.testExactNumber(polyface0.data.pointIndex[0], 0);
    ck.testExactNumber(polyface0.data.pointIndex[1], 4);
    ck.testExactNumber(polyface0.data.pointIndex[2], 1);
    ck.testExactNumber(polyface0.data.pointIndex[3], 4);
    ck.testExactNumber(polyface0.data.pointIndex[4], 3);
    ck.testExactNumber(polyface0.data.pointIndex[5], 0);
    ck.testExactNumber(polyface0.data.pointIndex[6], 1);
    ck.testExactNumber(polyface0.data.pointIndex[7], 2);
    ck.testExactNumber(polyface0.data.pointIndex[8], 5);
    ck.testExactNumber(polyface0.data.pointIndex[9], 5);
    ck.testExactNumber(polyface0.data.pointIndex[10], 4);
    ck.testExactNumber(polyface0.data.pointIndex[11], 1);
    // reverse second facet
    facetId = 1;
    ret = PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, polyface0.data.pointIndex, preserveStart);
    ck.testTrue(ret);
    ck.testExactNumber(polyface0.data.pointIndex[0], 0);
    ck.testExactNumber(polyface0.data.pointIndex[1], 4);
    ck.testExactNumber(polyface0.data.pointIndex[2], 1);
    ck.testExactNumber(polyface0.data.pointIndex[3], 4);
    ck.testExactNumber(polyface0.data.pointIndex[4], 0);
    ck.testExactNumber(polyface0.data.pointIndex[5], 3);
    ck.testExactNumber(polyface0.data.pointIndex[6], 1);
    ck.testExactNumber(polyface0.data.pointIndex[7], 2);
    ck.testExactNumber(polyface0.data.pointIndex[8], 5);
    ck.testExactNumber(polyface0.data.pointIndex[9], 5);
    ck.testExactNumber(polyface0.data.pointIndex[10], 4);
    ck.testExactNumber(polyface0.data.pointIndex[11], 1);
    // reverse last facet
    facetId = 3;
    ret = PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, polyface0.data.pointIndex, preserveStart);
    ck.testTrue(ret);
    ck.testExactNumber(polyface0.data.pointIndex[0], 0);
    ck.testExactNumber(polyface0.data.pointIndex[1], 4);
    ck.testExactNumber(polyface0.data.pointIndex[2], 1);
    ck.testExactNumber(polyface0.data.pointIndex[3], 4);
    ck.testExactNumber(polyface0.data.pointIndex[4], 0);
    ck.testExactNumber(polyface0.data.pointIndex[5], 3);
    ck.testExactNumber(polyface0.data.pointIndex[6], 1);
    ck.testExactNumber(polyface0.data.pointIndex[7], 2);
    ck.testExactNumber(polyface0.data.pointIndex[8], 5);
    ck.testExactNumber(polyface0.data.pointIndex[9], 5);
    ck.testExactNumber(polyface0.data.pointIndex[10], 1);
    ck.testExactNumber(polyface0.data.pointIndex[11], 4);
    expect(ck.getNumErrors()).equals(0);
  });
});
