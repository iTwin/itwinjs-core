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

class PolylineCompressionChecker {
  public ck = new Checker();
  public x0 = 0;
  public y0 = 0;
  public allGeometry: GeometryQuery[] = [];
  public shift(dx: number, dy: number) { this.x0 += dx; this.y0 += dy; }

  public verifyCompression(numExpected: number, points: Point3d[], tolerance: number) {
    const result = PolylineOps.compressByChordError(points, tolerance);
    const y0 = this.y0;
    this.x0 += 2.0 * tolerance;
    if (numExpected > 0)
      this.ck.testExactNumber(numExpected, result.length);
    const range = Range3d.createArray(points);
    if (points.length < 5)
      GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, points, tolerance, this.x0, this.y0);
    else
      GeometryCoreTestIO.createAndCaptureXYCircle(this.allGeometry, points[0], tolerance, this.x0, this.y0);
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(points), this.x0, this.y0);
    this.y0 += (tolerance + range.yLength());
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, LineString3d.create(result), this.x0, this.y0);
    this.y0 += (tolerance + range.yLength());
    this.y0 = y0;
    this.x0 += range.xLength() + 2.0 * tolerance;
  }
  public close(fileName: string) {
    GeometryCoreTestIO.saveGeometry(this.allGeometry, "PolylineCompression", fileName);
    expect(this.ck.getNumErrors()).equals(0);
  }
}
describe("PolylineCompression", () => {
  it("HelloWorld", () => {
    const context = new PolylineCompressionChecker();

    context.verifyCompression(2, [Point3d.create(0, 0, 0), Point3d.create(10, 0, 0)], 1.0);
    const point3 = [Point3d.create(0, 0, 0), Point3d.create(5, 1, 0), Point3d.create(10, 0, 0)];
    context.verifyCompression(3, point3, 0.5);
    context.verifyCompression(2, point3, 2.0);
    for (const depth of [1, 2, 3]) {
      for (const fractal of [Sample.createFractalHatReversingPattern(depth, 0.25),
      Sample.createFractalLReversingPattern(depth, 1.0)]) {

        const lengthRange = PolylineOps.edgeLengthRange(fractal);
        const q = Math.sqrt(lengthRange.low * lengthRange.high);
        for (const factor of [0.5, 1.0, 2.0, 4.0]) {
          context.verifyCompression(0, fractal, factor * q);
        }
      }
    }
    context.close("HelloWorld");
  });

});
