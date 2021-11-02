/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import { AnyCurve } from "../../curve/CurveChain";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { JointOptions } from "../../curve/internalContexts/PolygonOffsetContext";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { RegionOps } from "../../curve/RegionOps";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import * as fs from "fs";
import { CurveChain } from "../../curve/CurveCollection";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Arc3d } from "../../curve/Arc3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";

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
        let dMax = 0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, 0);
        for (const offsetDistance of distances) {
          dMax = Math.max(dMax, offsetDistance);
          options.leftOffsetDistance = offsetDistance * distanceFactor;
          const stickA = RegionOps.constructCurveXYOffset(path, options);
          if (stickA)
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA, x0, y0, 0);
        }
        y0 += yStep + 4 * dMax + 2;
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
      testCurveOffset(paths, `SimplePaths ${counter++}`, offsetDistances, 1.0);
    }
  });

  it("SimpleLoops", () => {
    let counter = 0;
    for (const paths of [
      Sample.createSimpleLoops(),
    ]) {
      const a = paths[0].range().xLength() * 0.02;
      const offsetDistances = [2 * a, a, -a, -2 * a];
      testCurveOffset(paths, `SimpleLoops ${counter++}`, offsetDistances, 1.0);
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
    testCurveOffset(paths, `SawtoothPaths ${counter++}`, offsetDistances, 1.0);

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
    testCurveOffset(paths, `FractalPaths ${counter++}`, offsetDistances, 1.0);

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
    testCurveOffset([path0], `Daumantas ${counter++}`, offsetDistances, 1.0);

  });
  it("OffsetGap10", () => {
    let counter = 10;
    for (const e of [0, 0.1, 0.3, -0.1, -0.3]) {
      const path0 = Path.create(LineString3d.create([[0, 0], [10, 0], [10 + e, -1], [18, -1]]));
      const offsetDistances = [0.5, -0.5, 1.5, -1.5, 2, -2];
      // const offsetDistances = [a];
      testCurveOffset([path0], `OffsetGap ${counter++}`, offsetDistances, 1.0);
    }

  });
  it("OffsetGap", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const path = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/ChainCollector/gapAtSmallShift.imjs", "utf8")))!;
    if (ck.testDefined(path) && path instanceof CurveChain) {
      const x0 = 0;
      const y0 = 0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, 0.1);
      for (const offset of [1, 2, 2.4]) {
        const options = new JointOptions(offset, 80, 135);
        const offsetCurves = RegionOps.constructCurveXYOffset(path as Path, options);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetCurves, x0, y0);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveOffset", "OffsetGap");
  });

  it("TrivialPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const offset = 0.5;
    let x0 = 0;
    const z1 = 0.04;  // to place center geometry above filled loops.
    const pointA = Point3d.create(0, 0);
    const pointB = Point3d.create(4, 0);
    const e = 0.1;
    const f = 0.02;
    const sC = 0.98;
    const path1 = Loop.create(LineString3d.create(pointA, pointB, [2, -e], pointA));
    const arcA = Arc3d.createCircularStartMiddleEnd(pointA, Point3d.create(2, 0.5), pointB) as Arc3d;
    const arcB = Arc3d.createCircularStartMiddleEnd(pointB, Point3d.create(2, 0.25), pointA) as Arc3d;
    const arcC = arcA.clonePartialCurve(1.0, 0.0)!;
    arcC.tryTransformInPlace(Transform.createFixedPointAndMatrix(arcA.center, Matrix3d.createScale(sC, sC, sC)));
    const path2 = Loop.create(arcA, arcB);
    const path3 = Loop.create(LineString3d.create(pointA, pointB, pointA.interpolatePerpendicularXY(1.0, pointB, -f),
      pointA.interpolatePerpendicularXY(0, pointB, -f), pointA));
    const path4 = Loop.create(arcA,
      LineSegment3d.create(arcA.endPoint(), arcC.startPoint()),
      arcC,
      LineSegment3d.create(arcC.endPoint(), arcA.startPoint()));
    // construct offset for ...
    // a) primitive (one way only)
    // b) primitive + reversed primitive
    for (const path of [path1, path2, path3, path4]) {
      let y0 = 0;
      for (const minArcDegrees of [80, 200]) {
        const options = new JointOptions(offset, minArcDegrees, 135);
        const offsetCurves = RegionOps.constructCurveXYOffset(path, options);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, z1);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetCurves, x0, y0);
        y0 += 5;
      }
      x0 += 10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveOffset", "TrivialPath");
    expect(ck.getNumErrors()).equals(0);
  });

});
