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

/* eslint-disable no-console */
describe("ParityRegionSweep", () => {
  it.only("Hello", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const regionA = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionA.imjs", "utf8")));
    const regionB = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionB.imjs", "utf8")));
    let x0 = 0;
    const y0 = 0;
    for (const region of [regionA, regionB]) {
      if (region instanceof GeometryQuery) {
        const range = region.range();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0 - range.low.x, y0);
        x0 += range.xLength();
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "ParityRegionSweep");
    expect(ck.getNumErrors()).equals(0);
  });

});
