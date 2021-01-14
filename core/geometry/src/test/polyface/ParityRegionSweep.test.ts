/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import * as fs from "fs";
import { ParityRegion } from "../../curve/ParityRegion";
import { RegionOps } from "../../curve/RegionOps";
import { CurveCollection } from "../../curve/CurveCollection";
import { MomentData } from "../../geometry4d/MomentData";
import { LinearSweep } from "../../solid/LinearSweep";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { DuplicateFacetClusterSelector, PolyfaceQuery } from "../../polyface/PolyfaceQuery";

/* eslint-disable no-console */
describe("ParityRegionSweep", () => {
  it.only("Hello", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const regionA = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionA.imjs", "utf8")));
    let regionB = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionB.imjs", "utf8")));
    if (Array.isArray(regionB)) {
      const regionB1 = ParityRegion.create();
      for (const loop of regionB) {
        regionB1.tryAddChild(loop);
      }
      regionB = regionB1;
    }
    let x0 = 0;
    const y0 = 0;
    for (const region of [regionA, regionB]) {
      if (region instanceof CurveCollection) {
        const range = region.range();
        const y1 = y0 - range.low.y;
        let x1 = x0 - range.low.x;
        const diagonal = range.low.distance(range.high);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x1, y1);
        const rawMomentData = RegionOps.computeXYZWireMomentSums(region)!;
        const principalMomentData = MomentData.inertiaProductsToPrincipalAxes(rawMomentData.origin, rawMomentData.sums)!;
        // GeometryCoreTestIO.showMomentData(allGeometry, rawMomentData, false, x1, y1);
        const zColumn = principalMomentData.localToWorldMap.matrix.columnZ();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [rawMomentData.origin, rawMomentData.origin.plusScaled(zColumn, 4.0)], x1, y1);
        for (const sweepDirection of [zColumn, zColumn.negate()]) {
          const slab = LinearSweep.create(region, sweepDirection, true);
          let y2 = y1 + diagonal;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, slab, x1, y2);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [rawMomentData.origin, rawMomentData.origin.plusScaled(sweepDirection, 4.0)], x1, y2);
          const builder = PolyfaceBuilder.create();
          builder.addGeometryQuery(slab!);
          const polyfaceA = builder.claimPolyface();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x1, y2 += diagonal);
          const polyfaceB = PolyfaceQuery.cloneByFacetDuplication(polyfaceA, true, DuplicateFacetClusterSelector.SelectOneByParity);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceB, x1, y2 += diagonal);
          // console.log({ rawMoments: principalMomentData });
          // console.log({ principalMoments: principalMomentData });
          x1 += diagonal;
        }
        x0 += 3.0 * diagonal;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "ParityRegionSweep");
    expect(ck.getNumErrors()).equals(0);
  });

});
