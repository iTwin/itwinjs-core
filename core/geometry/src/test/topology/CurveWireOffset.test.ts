/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";

import { Sample } from "../../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";

import { JointOptions } from "../../curve/internalContexts/PolygonOffsetContext";
import { Loop } from "../../curve/Loop";
import { AnyCurve } from "../../curve/CurveChain";
import { Path } from "../../curve/Path";
import { LineString3d } from "../../curve/LineString3d";
import { RegionOps } from "../../curve/RegionOps";

/**
 * Exercise PolygonWireOffset and output to a file.
 * @param polygons polygons to offset
 * @param caseName name to use for output file
 * @param distances offset distances
 * @param distanceFactor factor to apply to distances.
 */
function testCurveOffset(allPaths: AnyCurve[],
  caseName: string,
  distances: number[],
  distanceFactor: number) {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0;
  let y0 = 0;

  for (const path of allPaths) {
    if (path instanceof Path || path instanceof Loop) {
      const range = path.range();
      // const yStep = 2.0 * range.yLength();
      const xStep = 2.0 * range.xLength() + 1;
      const yStep = 2.0 * range.yLength() + 1;
      y0 = 0.0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, 0);
      for (const options of [
        JointOptions.create(1),
        new JointOptions(1.0, 180, 30.0),
        new JointOptions(1.0, 1.0, 30.0),
      ]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, 0);
        for (const offsetDistance of distances) {
          options.leftOffsetDistance = offsetDistance * distanceFactor;
          const stickA = RegionOps.constructCurveXYOffset(path, options);
          if (stickA)
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA!, x0, y0, 0);
        }
        y0 += yStep;
      }
      x0 += xStep;
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "CurveOffset", caseName);
  expect(ck.getNumErrors()).equals(0);
}

describe("CurveOffset", () => {

  it("SimplePaths", () => {
    let counter = 0;
    for (const paths of [
      Sample.createSimplePaths(false),
      Sample.createLineArcPaths(),
    ]) {
      const a = paths[0].range().xLength() * 0.02;
      const offsetDistances = [2 * a, a, -a, -2 * a];
      testCurveOffset(paths, "CurveOffsets" + counter++, offsetDistances, 1.0);
    }
  });

  it("SimpleLoops", () => {
    let counter = 0;
    for (const paths of [
      Sample.createSimpleLoops(),
    ]) {
      const a = paths[0].range().xLength() * 0.02;
      const offsetDistances = [2 * a, a, -a, -2 * a];
      testCurveOffset(paths, "SimpleLoops" + counter++, offsetDistances, 1.0);
    }
  });

  it("SawtoothPaths", () => {
    let counter = 0;
    const paths = [];
    for (const pointPath of [
      Sample.appendVariableSawTooth([], 1, 0, 1, 2, 4, 0.8),
      Sample.appendVariableSawTooth([], 1, 0.5, 1, 2, 4, 0.8),
      Sample.appendVariableSawTooth([], 3, -0.5, 1, 2, 4, 0.8)]) {
      paths.push(Path.create(LineString3d.create(pointPath)));
    }

    const a = paths[0].range().xLength() * 0.02;
    const offsetDistances = [2 * a, a, -a, -2 * a];
    // const offsetDistances = [a];
    testCurveOffset(paths, "SawtoothPaths" + counter++, offsetDistances, 1.0);

  });

  it("FractalPaths", () => {
    let counter = 0;
    const paths = [];
    for (const pointPath of [
      Sample.createFractalDiamondConvexPattern(1, -0.5),
      Sample.createFractalHatReversingPattern(1, 0.25)]) {
      paths.push(Path.create(LineString3d.create(pointPath)));
    }

    const a = paths[0].range().xLength() * 0.01;
    const offsetDistances = [2 * a, a, -a, -2 * a];
    // const offsetDistances = [a];
    testCurveOffset(paths, "FractalPaths" + counter++, offsetDistances, 1.0);

  });
  // cspell:word Daumantas
  it("Daumantas", () => {
    let counter = 0;
    const y0 = 6.7;
    const x0 = -5.0;
    const x3 = 2.0;
    const y3 = 1.078;
    const x4 = 8.0;
    const y4 = 8.0;
    const path0 = Path.create(LineString3d.create([[x0, y0], [0, y0], [0, 0], [x3, y3], [x4, y4]]));
    const a = 0.56;
    const offsetDistances = [a, -a];
    // const offsetDistances = [a];
    testCurveOffset([path0], "Daumantas" + counter++, offsetDistances, 1.0);

  });

});
