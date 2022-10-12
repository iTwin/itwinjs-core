/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */
/** Functions useful for modifying test data. */
export class RFunctions {
  /** Return cos(theta), where theta is 0 at x0, 2Pi at x2Pi.
   * @param x position to be mapped
   * @param x0 x value for angle 0
   * @param x2Pi x value for angle 2*PI
   */
  public static cosineOfMappedAngle(x: number, x0: number, x2Pi: number): number {
    return Math.cos((x - x0) * Math.PI * 2.0 / (x2Pi - x0));
  }
  /** Return a function that is 1 in the (closed) interval `[x0,x1]` and 0 everywhere else.
   * * "inside" is determined by `(x-x0)*(x-x1)` so that the order of x0 and x1 is not important.
   */
  public static hat(x: number, x0: number, x1: number): number {
    return (x - x0) * (x - x1) <= 0.0 ? 1.0 : 0.0;
  }
}

it("DrapeLinestringAsPanels", async () => {
  const ck = new Checker();
  let _dy = 0.0;
  const allGeometry: GeometryQuery[] = [];
  const wanderingPoints = [[-1, 1, 1], [1.5, 1, 1], [2, 3, -1], [3.5, 3, -2], [3.5, 6, 1], [4, 8, -2], [6, 3, 5], [8, 3, -2]];
  const packedWanderingPoints = new GrowableXYZArray();
  packedWanderingPoints.pushFrom(wanderingPoints);
  const wandering = BSplineCurve3d.createUniformKnots(packedWanderingPoints, 3)!;
  const strokes = LineString3d.create();
  wandering.emitStrokes(strokes);
  for (const linestring of [
    LineString3d.create([[4.2, 3, -2], [6, 3, 1]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 3]]),
    LineString3d.create(wanderingPoints),
    strokes]) {
    const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1.0324, 0, 0.1), Vector3d.create(0, 1.123, 0.5), 8, 8);
    mesh.data.point.mapComponent(2,
      (x: number, y: number, _z: number) => {
        return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
      });

    const _panels = PolyfaceQuery.sweepLinestringToFacetsXYreturnSweptFacets(linestring.packedPoints, mesh);
    // GeometryCoreTestIO.captureGeometry(allGeometry, [mesh, linestring, panels], 0, dy, 0);
    _dy += 20.0;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "DrapeLinestringAsPanels");
  expect(ck.getNumErrors()).equals(0);
});

it("DrapeLinestringAsLines", async () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];

  const wanderingPoints = [[-1, 1, 1],
  [1.5, 1, 1],
  [2, 3, -1],
  [3.5, 3, -2],
  [3.5, 6, 1],
  [4, 8, -2],
  [6, 3, 5],
  [8, 3, -2]];
  const packedWanderingPoints = new GrowableXYZArray();
  packedWanderingPoints.pushFrom(wanderingPoints);

  const loopWithHandle = [
    [3, 1, 5],
    [5, 3, 5],
    [3, 6, 5],
    [1, 3, 5],
    [3, 1, 5],
    [0, -1, 5]];

  const wandering = BSplineCurve3d.createUniformKnots(packedWanderingPoints, 3)!;
  const strokes = LineString3d.create();
  wandering.emitStrokes(strokes);
  let dx = 0.0;
  const dy = 20.0;
  let numTest = 0;
  for (const linestring of [
    LineString3d.create([[4.2, 3, 0], [4.9, 3, 0]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 1]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 3]]),
    LineString3d.create(loopWithHandle),
    LineString3d.create(wanderingPoints),
    strokes]) {
    for (const meshMultiplier of [1, 4]) {
      numTest++;
      const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1, 0, 0.1), Vector3d.create(0, 2, 0.5),
        8 * meshMultiplier, 4 * meshMultiplier);
      if (numTest > 3)
        mesh.data.point.mapComponent(2,
          (x: number, y: number, _z: number) => {
            return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
          });
      const lines = await Promise.resolve(PolyfaceQuery.sweepLinestringToFacetsXYReturnLines(linestring.packedPoints, mesh));
      // console.log({ awaitBlocks: PolyfaceQuery.awaitBlockCount });
      const chains = PolyfaceQuery.sweepLinestringToFacetsXYReturnChains(linestring.packedPoints, mesh);
      let lineSum = 0;
      let chainSum = 0;
      for (const g of lines) lineSum += g.curveLength();
      for (const g of chains) chainSum += g.curveLength();
      ck.testCoordinate(lineSum, chainSum, "Line and chain sums match");
      GeometryCoreTestIO.captureGeometry(allGeometry, [mesh, linestring], dx, 0, 0);
      GeometryCoreTestIO.captureGeometry(allGeometry, lines, dx, dy, 0);
      GeometryCoreTestIO.captureGeometry(allGeometry, chains, dx, 2 * dy, 0);
      dx += 50.0;
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "DrapeLinestringAsLines");
  expect(ck.getNumErrors()).equals(0);
});

it("DrapeLinestringLargeMesh", async () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const w0 = 4.0;
  const wanderingPoints = [[-0.01, 0, 1],
  [1.5, 1, 1],
  [2, 3, -1],
  [3.5, 3, -2],
  [3.5, 4, 1],
  [4, 5, -2],
  [6, 3, 5],
  [8, 3, -2]];
  for (const p of wanderingPoints)
    p[2] += w0;
  const packedWanderingPoints = new GrowableXYZArray();
  packedWanderingPoints.pushFrom(wanderingPoints);

  const _loopWithHandle = [
    [3, 1, 5],
    [5, 3, 5],
    [3, 6, 5],
    [1, 3, 5],
    [3, 1, 5],
    [0, -1, 5]];

  const wandering = BSplineCurve3d.createUniformKnots(packedWanderingPoints, 3)!;
  const strokes = LineString3d.create();
  wandering.emitStrokes(strokes);
  let x0 = 0.0;
  let y0 = 0.0;
  const yShift = 20.0;
  const xShift = 40.0;
  let numTest = 0;
  const numX0 = 4;
  const numY0 = 6;
  // DTM side lengths
  const ax = 12.0;
  const ay = 10.0;
  const az = 1.0;
  const zShift = 0.05;
  for (const linestring of [
    // LineString3d.create([[4.2, 3, 0], [4.9, 3, 0]]),
    // LineString3d.create([[4.2, 3, -2], [6, 3, 1]]),
    // LineString3d.create([[4.2, 3, -2], [6, 3, 3]]),
    // LineString3d.create(loopWithHandle),
    LineString3d.create(wanderingPoints),
    strokes]) {
    for (const densityMultiplier of /* [1, 2, 4, 8] */[1, 3, 6]) {
      const numX = numX0 * densityMultiplier;
      const numY = numY0 * densityMultiplier;
      numTest++;
      const dx = ax / numX;
      const dy = ay / numY;
      const _dZdX = az / numX;
      const _dZdY = az / numY;
      const mesh = Sample.createTriangularUnitGridPolyface(
        Point3d.create(0, 0, 0), Vector3d.create(dx, 0, _dZdX), Vector3d.create(0, dy, _dZdY), numX, numY);
      if (numTest > 0)
        mesh.data.point.mapComponent(2,
          (x: number, y: number, _z: number) => {
            return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
          });
      const lines = PolyfaceQuery.sweepLinestringToFacetsXYReturnLines(linestring.packedPoints, mesh);
      const name = `sweptLineString ${numX * numY} ${linestring.packedPoints.length}`;
      console.time(name);
      const _chains = Promise.resolve(PolyfaceQuery.asyncSweepLinestringToFacetsXYReturnChains(linestring.packedPoints, mesh));
      ck.testLT(0, (await _chains).length);
      console.timeEnd(name);
      // console.log({ awaitBlocks: PolyfaceQuery.awaitBlockCount });
      // let lineSum = 0;
      // let chainSum = 0;
      // for (const g of lines) lineSum += g.curveLength();
      // for (const g of chains) chainSum += g.curveLength();
      // ck.testCoordinate(lineSum, chainSum, "Line and chain sums match");
      if (densityMultiplier < 7) {
        y0 = 0.0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [mesh, linestring], x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, (await _chains), x0, y0, zShift);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines, x0, y0 += yShift, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, (await _chains), x0, y0 += yShift, 0);
      }
      x0 += xShift;
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "DrapeLinestringLargeMesh");
  expect(ck.getNumErrors()).equals(0);
});

