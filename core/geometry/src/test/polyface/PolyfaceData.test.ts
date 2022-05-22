/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceData } from "../../polyface/PolyfaceData";
import { Checker } from "../Checker";

/* eslint-disable no-console */

describe("PolyfaceData", () => {

  it("IndexArrays", () => {
    const ck = new Checker();
    ck.testFalse(PolyfaceData.isValidFacetStartIndexArray([]), "Facet Start minimal index must have leading 0");
    ck.testFalse(PolyfaceData.isValidFacetStartIndexArray([2, 1]), "Facet Start index must be sorted");
    ck.testFalse(PolyfaceData.isValidFacetStartIndexArray([0, 4, 7, 6]), "Facet Start index must be sorted");
    ck.testTrue(PolyfaceData.isValidFacetStartIndexArray([0, 4, 6, 12]), "Facet Start index must have trailing 0");
    expect(ck.getNumErrors()).equals(0);

  });

  it("HelloWorld", () => {
    const ck = new Checker();
    const pf = IndexedPolyface.create(false, false, false);
    ck.testFalse(pf.data.requireNormals);
    pf.addPointXYZ(0, 0, 0);
    pf.addPointXYZ(1, 0, 0);
    pf.addPointXYZ(1, 1, 0);
    pf.addPointXYZ(0, 1, 0);

    pf.addPointXYZ(1, 0, 0);
    pf.addPointXYZ(1, 1, 0);
    pf.addPointXYZ(2, 0, 1);
    pf.addPointXYZ(2, 1, 1);

    pf.addPointIndex(0); pf.addPointIndex(1); pf.addPointIndex(2); pf.addPointIndex(3);
    const m0 = pf.terminateFacet(true);
    ck.testUndefined(m0, m0);
    pf.addPointIndex(4); pf.addPointIndex(5); pf.addPointIndex(6); pf.addPointIndex(7);
    const m1 = pf.terminateFacet(true);
    ck.testUndefined(m1, m1);
    ck.testExactNumber(0, pf.faceCount);    // "face" is "cluster of facets" -- no clustering has been defined.

    ck.testExactNumber(2, pf.facetCount);
    pf.reverseIndices();
    ck.testExactNumber(8, pf.pointCount);
    pf.data.compress();
    ck.testExactNumber(2, pf.facetCount);
    ck.testExactNumber(6, pf.pointCount);
    ck.testExactNumber(2, pf.facetCount);
    expect(ck.getNumErrors()).equals(0);

  });
});
