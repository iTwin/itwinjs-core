/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import * as fs from "fs";
import { OffsetHelpers } from "./ChainCollectorContextA";
import { Range3d } from "../../geometry3d/Range";

const chainCollectorInputDirectory = "./src/test/testInputs/ChainCollector/";

it("Diego", () => {
  const ck = new Checker();
  let xOut = 0;
  let y0 = 0;
  for (const filename of ["boomerang.incompleteOffset", "boomerang.noOffsetsWithThisOrder", "boomerang", "rectangle00", "linestrings"]) {
    const allGeometry: GeometryQuery[] = [];
    const stringData = fs.readFileSync(chainCollectorInputDirectory + filename + ".imjs", "utf8");
    if (stringData) {
      const jsonData = JSON.parse(stringData);
      const fragments = IModelJson.Reader.parse(jsonData);
      if (Array.isArray(fragments)) {
        const range = OffsetHelpers.extendRange(Range3d.create(), fragments);
        const x0 = xOut - range.low.x;
        y0 = -range.low.y;

        const offsetDistance = 0.1 * range.xLength();
        const yShift = 2 * range.yLength();
        const offsets = OffsetHelpers.collectInsideAndOutsideOffsets(fragments, offsetDistance, offsetDistance * 0.1);
        y0 += yShift;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragments, x0, y0);
        y0 += yShift;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.chains, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.insideOffsets, x0, y0, 0.01);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.outsideOffsets, x0, y0, -0.01);

        console.log("output to " + filename);
        GeometryCoreTestIO.saveGeometry(allGeometry, "ChainCollector", filename);
        xOut += 2 * range.xLength();
      }
    }
  }
  expect(ck.getNumErrors()).equals(0);
});
