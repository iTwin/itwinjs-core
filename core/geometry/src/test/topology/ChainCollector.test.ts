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
import { CurveCollection, BagOfCurves } from "../../curve/CurveCollection";
import { Loop } from "../../curve/Loop";
import { RegionOps } from "../../curve/RegionOps";
import { ChainCollectorContext } from "../../curve/ChainCollectorContext";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { Path } from "../../curve/Path";
import { AnyCurve } from "../../curve/CurveChain";
const chainCollectorInputDirectory = "./src/test/iModelJsonSamples/ChainCollector/";

it("ChainCollector", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const x0 = 0;
  const y0 = 0;
  const y1 = y0 + 40;
  for (const filename of ["boomerang"]) {
    const stringData = fs.readFileSync(chainCollectorInputDirectory + filename + ".imjs", "utf8");
    if (stringData) {
      const jsonData = JSON.parse(stringData);
      const fragments = IModelJson.Reader.parse(jsonData);
      const collector = new ChainCollectorContext(false);
      if (fragments) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragments, x0, 0);
        if (Array.isArray(fragments)) {
          for (const s of fragments) {
            collector.announceCurvePrimitive(s, true);
          }
        } else if (fragments instanceof CurveCollection) {
          for (const s of fragments.children!) {
            if (s instanceof CurvePrimitive)
              collector.announceCurvePrimitive(s, true);
          }
        }
        const loopA = collector.grabResult(true);
        ck.testDefined(loopA);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopA, x0, y1 , 0);
        const result: GeometryQuery[] = [];
        appendOffsets(loopA, 0.5, result);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, result, x0, y1, 0);
        GeometryCoreTestIO.saveGeometry(allGeometry, "ChainCollector", filename);
      }
    }
  }
  expect(ck.getNumErrors()).equals(0);
});

function appendOffsets(data: AnyCurve | undefined, offset: number, result: GeometryQuery[]) {
  if (data instanceof CurvePrimitive) {
    const resultA = RegionOps.constructCurveXYOffset(Path.create(data), 0.5);
    if (resultA)
      result.push(resultA);
  } else if ((data instanceof Loop) || (data instanceof Path)) {
    const resultA = RegionOps.constructCurveXYOffset(data, 0.5);
    if (resultA)
      result.push(resultA);
  } else if (data instanceof BagOfCurves) {
    for (const q of data.children)
      appendOffsets(q, offset, result);
  } else if (Array.isArray(data)) {
    for (const q of data)
      appendOffsets(q, offset, result);
  }
}
