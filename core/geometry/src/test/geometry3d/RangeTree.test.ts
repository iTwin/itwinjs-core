/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "../Checker";
import { Sample } from "../../serialization/GeometrySamples";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Range3d } from "../../geometry3d/Range";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { LineSegment3d } from "../../core-geometry";
import { RangeNode, SingleTreeSearchHandler } from "../../geometry3d/RangeTree";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// Clone and shift the range ...
// shift by dx
// both low and high z are at dz (ignores input range z)
function makeRangeForOutput(range: Range3d, dx: number, dy: number, dz: number): Range3d {
  const x0 = range.xLow + dx;
  const y0 = range.yLow + dy;
  const x1 = range.xHigh + dx;
  const y1 = range.yHigh + dy;
  return Range3d.createXYZXYZ(x0, y0, dz, x1, y1, dz);

}
class ClosestPointHandler extends SingleTreeSearchHandler<CurvePrimitive>{
  public spacePoint: Point3d;
  public minDistance: number;
  public closestPointData?: CurveLocationDetail;
  public activeRanges?: Range3d[];
  public rejectedRanges?: Range3d[];
  private _lastZ: number;

  public numRangeTest;
  public numCurveTest;
  public numCases;

  private constructor(spacePoint: Point3d, saveRanges: boolean) {
    super();
    this.spacePoint = spacePoint.clone();
    this.minDistance = Number.MAX_VALUE;
    if (saveRanges) {
      this.activeRanges = [];
      this.rejectedRanges = [];
    } else {
      this.activeRanges = undefined;
      this.rejectedRanges = undefined;
    }
    this._lastZ = 0.0;
    this.numCases = 0;
    this.numCurveTest = 0;
    this.numRangeTest = 0;
  }
  public resetSearch(spacePoint: Point3d) {
    if (this.activeRanges !== undefined)
      this.activeRanges.length = 0;
    if (this.rejectedRanges !== undefined)
      this.rejectedRanges.length = 0;
    this.spacePoint = spacePoint.clone();
    this.minDistance = Number.MAX_VALUE;
    this.closestPointData = undefined;
    this._lastZ = 0.0;
    this.numCases++;
  }
  public static create(spacePoint: Point3d = Point3d.create(0, 0, 0), saveRanges: boolean = false): ClosestPointHandler {
    return new ClosestPointHandler(spacePoint.clone(), saveRanges);
  }
  public isRangeActive(range: Range3d): boolean {
    this.numRangeTest++;
    const b = range.distanceToPoint(this.spacePoint) < this.minDistance;
    if (b)
      this.activeRanges?.push(makeRangeForOutput(range, 0, 0, this._lastZ));
    else
      this.rejectedRanges?.push(makeRangeForOutput(range, 0, 0, this._lastZ));
    this._lastZ += 0.25;
    return b;
  }
  public override processAppData(item: CurvePrimitive): void {
    this.numCurveTest++;
    const cld = item.closestPoint(this.spacePoint, false);
    if (cld !== undefined && cld.a < this.minDistance) {
      this.minDistance = cld.a;
      this.closestPointData = cld;
    }
  }
}
describe.only("IndexedRangeHeap", () => {
  it("PointSearchInGrid", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const points = Sample.createPoint2dLattice(0, 5, 100);
    const ranges: Range3d[] = [];
    const lines: CurvePrimitive[] = [];
    const x0 = 0;
    let y0 = 0;
    // vectors along edges.
    let dx = 0.35;
    let dy = 0.6;
    const bigStep = 200.0;
    for (let i = 0; i < points.length; i += 2) {
      const line = LineSegment3d.createXYXY(points[i].x, points[i].y, points[i].x + dx, points[i].y + dy);
      lines.push(line);
      ranges.push(line.range());
      const t = dx;
      dx = -dy;
      dy = t;
    }
    const rangeHeap = RangeNode.createByIndexSplits<CurvePrimitive>(ranges, lines, 3, 2)!;
    for (const spacePoint of [Point3d.create(3.8, 2.5), Point3d.create(27.3, 9.5), Point3d.create(-8, bigStep * 0.45)]) {
      const handler = ClosestPointHandler.create(spacePoint, true)!;
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, spacePoint, 0.2, x0 + bigStep, y0);
      rangeHeap.searchTopDown(handler);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, handler.activeRanges, x0, y0);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, handler.rejectedRanges, x0 + bigStep, y0);
      if (handler.closestPointData !== undefined)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, handler.closestPointData.point], x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines, x0, y0);
      y0 += bigStep;
    }

    const path = BezierCurve3d.create([Point3d.create(3, 4), Point3d.create(4, 25), Point3d.create(20, 20), Point3d.create(40, 80)])!;
    const handlerB = ClosestPointHandler.create()!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, lines, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
    for (let fraction = 0.0; fraction <= 1.0; fraction += 0.04) {
      const spacePoint = path.fractionToPoint(fraction);
      handlerB.resetSearch(spacePoint);
      rangeHeap.searchTopDown(handlerB);
      if (handlerB.closestPointData !== undefined) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, handlerB.closestPointData.point], x0, y0);
      }
      GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, spacePoint, 0.2, x0, y0);
    }
    const numQuadraticTests = lines.length * handlerB.numCases;

    // eslint-disable-next-line no-console
    console.log({
      numCases: handlerB.numCases,
      numRangeTest: handlerB.numRangeTest,
      numCurveTest: handlerB.numCurveTest,
      numQuadraticTests,
      testFraction: handlerB.numCurveTest / numQuadraticTests,
    });
    GeometryCoreTestIO.saveGeometry(allGeometry, "IndexedRangeTree", "PointSearchInGrid");
    expect(ck.getNumErrors()).equals(0);
  });

});
