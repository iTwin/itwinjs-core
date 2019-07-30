/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "../Checker";
import { expect } from "chai";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { Range3d } from "../../geometry3d/Range";
import { Sample } from "../../serialization/GeometrySamples";
import { PolylineOps } from "../../geometry3d/PolylineOps";
import { Point3dArray } from "../../geometry3d/PointHelpers";

class PolylineCompressionChecker {
  public ck = new Checker();
  public x0 = 0;
  public y0 = 0;
  public allGeometry: GeometryQuery[] = [];
  public shift(dx: number, dy: number) { this.x0 += dx; this.y0 += dy; }

  public verifyGlobalChordErrorCompression(numExpected: number, points: Point3d[],
    globalEdgeTolerance: number,
    areaTolerance = 0.0,
    perpendicularDistanceTolerance: number = 0.0) {
    const result = PolylineOps.compressByChordError(points, globalEdgeTolerance);
    const y0 = this.y0;
    this.x0 += 2.0 * globalEdgeTolerance;
    if (numExpected > 0)
      this.ck.testExactNumber(numExpected, result.length);
    const range = Range3d.createArray(points);
    const yStep = 1.5 * range.diagonal().magnitude();

    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(points), this.x0, this.y0);
    GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, points[0], globalEdgeTolerance, this.x0, this.y0);
    this.y0 += yStep;
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(result), this.x0, this.y0);
    GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, result[0], globalEdgeTolerance, this.x0, this.y0);
    this.y0 += yStep;

    const edgeCompress = PolylineOps.compressShortEdges(points, globalEdgeTolerance);
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(edgeCompress), this.x0, this.y0);
    GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, points[0], globalEdgeTolerance, this.x0, this.y0);
    this.y0 += yStep;

    if (areaTolerance > 0) {
      const areaCompress = PolylineOps.compressSmallTriangles(points, areaTolerance);
      GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(areaCompress), this.x0, this.y0);
      GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, points[0], Math.sqrt(areaTolerance), this.x0, this.y0);
      this.y0 += yStep;
    }

    if (perpendicularDistanceTolerance > 0) {
      this.y0 += 2.0 * yStep;
      let num0 = points.length;
      const edgeLengthRange0 = PolylineOps.edgeLengthRange(points);
      for (const numPass of [1, 2, 3, 4, 5, 6, 7, 8]) {
        for (let i = 0; i < 25 && i < points.length; i++)
          GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, points[i], perpendicularDistanceTolerance, this.x0, this.y0);
        const perpCompress = PolylineOps.compressByPerpendicularDistance(points, perpendicularDistanceTolerance, numPass);
        const edgeLengthRange1 = PolylineOps.edgeLengthRange(perpCompress);
        if (perpCompress.length > 3)
          this.ck.testLE(edgeLengthRange0.high, edgeLengthRange1.high, "Compression does not reduce max edge length");
        const num1 = perpCompress.length;
        GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(perpCompress), this.x0, this.y0);
        if (num1 === num0)
          break;
        this.y0 += yStep;
        num0 = num1;
      }
    }

    this.y0 = y0;
    this.x0 += 10.0 * range.xLength();
  }

  /** Save the collected geometry to given fileName. */
  public close(fileName: string) {
    GeometryCoreTestIO.saveGeometry(this.allGeometry, "PolylineCompression", fileName);
    expect(this.ck.getNumErrors()).equals(0);
  }
}
describe("GlobalCompression", () => {
  it("HelloWorld", () => {
    const context = new PolylineCompressionChecker();

    context.verifyGlobalChordErrorCompression(2, [Point3d.create(0, 0, 0), Point3d.create(10, 0, 0)], 1.0);
    const point3 = [Point3d.create(0, 0, 0), Point3d.create(5, 1, 0), Point3d.create(10, 0, 0)];
    context.verifyGlobalChordErrorCompression(3, point3, 0.5);
    context.verifyGlobalChordErrorCompression(2, point3, 2.0);
    for (const depth of [1, 2, 3]) {
      for (const fractal of [
        Sample.createFractalHatReversingPattern(depth, 0.25),
        Sample.createFractalLReversingPattern(depth, 1.0),
        Sample.createFractalHatReversingPattern(depth, 0.05)]) {

        const dataRange = Point3dArray.createRange(fractal);
        const qBase = 0.001 * dataRange.diagonal().magnitude();
        for (const factor of [1.0, 5.0, 10.0, 50.0, 100.0, 200.0]) {
          const q = factor * qBase;
          const qArea = q * q;
          context.verifyGlobalChordErrorCompression(0, fractal, q, qArea, q);
        }
      }
    }
    context.close("HelloWorld");
  });

  it("IsolateSmallPattern", () => {
    const context = new PolylineCompressionChecker();

    for (const depth of [3, 1, 2, 3]) {
      for (const fractal of [
        Sample.createFractalHatReversingPattern(depth, 0.05)]) {

        const dataRange = Point3dArray.createRange(fractal);
        const qBase = 0.001 * dataRange.diagonal().magnitude();
        for (const factor of [1.0, 5.0, 10.0, 50.0, 100.0, 200.0]) {
          const q = factor * qBase;
          const qArea = q * q;
          context.verifyGlobalChordErrorCompression(0, fractal, q, qArea, q);
        }
        context.x0 += dataRange.xLength() * 10.0;
      }
    }
    context.close("IsolateSmallPattern");
  });
  it("SmallArrays", () => {
    const ck = new Checker();
    const points = [];
    let yy = 0.0;
    for (let i = 0; i < 3; i++) {
      points.push(Point3d.create(i, yy, 0));
      yy = 2.0 - yy;    // toggle to sharp corner
      const pointsA = PolylineOps.compressShortEdges(points, 1.0);
      ck.testExactNumber(points.length, pointsA.length, "No Change chord error case");

      const pointsB = PolylineOps.compressSmallTriangles(points, 0.5);
      ck.testExactNumber(points.length, pointsB.length, "No Change triangle case");

      const pointsC = PolylineOps.compressByPerpendicularDistance(points, 0.1, 1);
      ck.testExactNumber(points.length, pointsC.length, "No Change perp case");

      const pointsD = PolylineOps.compressByPerpendicularDistance(points, 0.1, 2);
      ck.testExactNumber(points.length, pointsD.length, "No Change perp case");

      const pointsE = PolylineOps.compressByChordError(points, 0.1);
      ck.testExactNumber(points.length, pointsE.length, "No Change global chord error case");
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("ColinearThroughStart", () => {
    const context = new PolylineCompressionChecker();
    const pointsWithColinearThroughStart = [
      Point3d.createFrom({ x: 0, y: 0, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 0, y: 0, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 1746.2903617595616, y: 0, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 1746.2903617595616, y: -1151.9060537233227, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 4102.778912210693, y: -1151.9060537233227, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 4196.968933325803, y: -1151.9060537233227, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 4196.968933325803, y: -2189.4980628055105, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: -611.3604034049928, y: -2189.4980628055105, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: -611.3604034049928, y: 0, z: -3538.3128322623243 })!,
      Point3d.createFrom({ x: 0, y: 0, z: -3538.3128322623243 })!,
    ];
    context.verifyGlobalChordErrorCompression(0, pointsWithColinearThroughStart, 0.001);
    context.close("ColinearThroughStart");
  });

});
