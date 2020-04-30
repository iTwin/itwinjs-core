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
import { Sample, SteppedIndexFunctionFactory } from "../../serialization/GeometrySamples";
import { LineSegment3d } from "../../curve/LineSegment3d";

const chainCollectorInputDirectory = "./src/test/testInputs/ChainCollector/";

it("Diego", () => {
  const ck = new Checker();
  let xOut = 0;
  let y0 = 0;
  for (const filename of ["linestring01", "boomerang.incompleteOffset", "boomerang.noOffsetsWithThisOrder", "boomerang", "rectangle00", "linestrings"]) {
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

it("PrimitiveOrder", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0;
  const xShift = 20.0;
  const yShift = 20.0;
  const offsetDistance = 0.5;
  const reversePhase = [8, 5];    // reverse primitives if their index modulo anything here is reverseShift
  const reverseShift = 3;
  for (const numPrimitive of [5, 6, 30, 60]) {
    let y0 = 0;
    const shuffledPrimitives = [];
    const circlePoints = Sample.createPointsByIndexFunctions(numPrimitive,
      SteppedIndexFunctionFactory.createCosine(6.0), SteppedIndexFunctionFactory.createSine(8.0));
    // make primitives in simple order around the ellipse ..
    const sequentialPrimitives = [];
    for (let i = 0; i + 1 < circlePoints.length; i++)
      sequentialPrimitives.push(LineSegment3d.create(circlePoints[i], circlePoints[i + 1]));
    // step through the primitives at various intervals to get them out non-sequentially
    for (const step of [2, 3, 7, 5, 1]) {
      for (let i = 0; i < sequentialPrimitives.length; i += step) {
        if (sequentialPrimitives[i] !== undefined) {
          const p = sequentialPrimitives[i]!;
          for (const m of reversePhase) {
            if ((i % m) === reverseShift) {
              p.reverseInPlace();
              break;
            }
          }
          shuffledPrimitives.push(p);
          sequentialPrimitives[i] = undefined;
        }
      }
    }
    // sort them all back together
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, shuffledPrimitives, x0, y0);
    y0 += yShift;
    const offsets = OffsetHelpers.collectInsideAndOutsideOffsets(shuffledPrimitives, offsetDistance, offsetDistance * 0.1);
    y0 += yShift;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, shuffledPrimitives, x0, y0);
    y0 += yShift;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.chains, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.insideOffsets, x0, y0, 0.1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.outsideOffsets, x0, y0, -0.1);
    x0 += xShift;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "ChainCollector", "PrimitiveOrder");
  expect(ck.getNumErrors()).equals(0);
});
