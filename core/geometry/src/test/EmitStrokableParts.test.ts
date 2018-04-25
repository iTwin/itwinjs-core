/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// import { Point3d, Vector3d, Transform, RotMatrix, Range1d } from "../PointVector";
import { Sample } from "../serialization/GeometrySamples";
import { Point3d, Vector3d } from "../PointVector";
import { LineString3d } from "../curve/LineString3d";
import { StrokeOptions } from "../curve/StrokeOptions";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { IStrokeHandler } from "../GeometryHandler";
import { FrameBuilder } from "../FrameBuilder";
// import { Geometry } from "../Geometry";

import { Checker } from "./Checker";
import { expect } from "chai";
function maxSegmentLength(linestring: LineString3d): number {
  let aMax = 0;
  for (let i = 0; i + 1 < linestring.numPoints(); i++) {
    aMax = Math.max(linestring.pointAt(i)!.distance(linestring.pointAt(i + 1)!), aMax);
  }
  return aMax;
}

class StrokeVerifier implements IStrokeHandler {
  private myCP: CurvePrimitive | undefined;
  private myParent: CurvePrimitive | undefined;
  private ck: Checker;
  public frameBuilder: FrameBuilder;
  public constructor(ck: Checker) {
    this.ck = ck;
    this.myParent = undefined;
    this.myCP = undefined;
    this.frameBuilder = new FrameBuilder();
  }
  public startCurvePrimitive(cp: CurvePrimitive): void { this.myCP = cp; }
  public announcePointTangent(xyz: Point3d, fraction: number, tangent: Vector3d): void {
    this.frameBuilder.announcePoint(xyz);
    this.ck.testTrue(this.frameBuilder.hasOrigin(), "frameBuilder.hasOrigin after a point is announced");
    this.frameBuilder.announceVector(tangent);
    if (this.ck.testPointer(this.myCP) && this.myCP) {
      const ray = this.myCP.fractionToPointAndDerivative(fraction);
      this.ck.testPoint3d(xyz, ray.origin, "Stroke validator point");
      this.ck.testVector3d(tangent, ray.direction, "Stroke validator point");
    }
  }

  /** Announce that curve primitive cp should be evaluated in the specified fraction interval. */
  public announceIntervalForUniformStepStrokes(
    _cp: CurvePrimitive,
    _numStrokes: number,
    _fraction0: number,
    _fraction1: number): void {
    //
  }
  /** Announce numPoints interpolated between point0 and point1, with associated fractions */
  public announceSegmentInterval(
    _cp: CurvePrimitive,
    _point0: Point3d,
    _point1: Point3d,
    _numStrokes: number,
    _fraction0: number,
    _fraction1: number): void {
    //
  }
  public endCurvePrimitive(_cp: CurvePrimitive): void { this.myCP = undefined; }
  public startParentCurvePrimitive(_cp: CurvePrimitive): void {
    this.ck.testUndefined(this.myParent, "Stroker parentCurve cannot be recursive");
    this.myParent = _cp;
  }
  public endParentCurvePrimitive(_cp: CurvePrimitive): void { this.myParent = undefined; }

}

describe("EmitStrokableParts", () => {
  it("MaxEdgeLength", () => {
    const ck = new Checker();
    const curves = Sample.createSmoothCurvePrimitives();
    curves.push(LineString3d.createRectangleXY(Point3d.create(0, 0), 4, 2, true));
    for (const c of curves) {
      const ls1 = LineString3d.create();
      // const aTotal = c.curveLength();
      const options = StrokeOptions.createForCurves();
      options.maxEdgeLength = undefined;
      c.emitStrokes(ls1, options);
      const aMax = maxSegmentLength(ls1);
      options.maxEdgeLength = 0.25 * aMax;
      const ls2 = LineString3d.create();
      c.emitStrokes(ls2, options);
      const aMax2 = maxSegmentLength(ls2);
      ck.testLE(aMax2, options.maxEdgeLength!, "maxEdgeLength effective for strokes", c);
      const handler = new StrokeVerifier(ck);
      c.emitStrokableParts(handler, options);
    }
    ck.checkpoint("EmitStrokableParts.MaxEdgeLength", { curves: curves.length });
    expect(ck.getNumErrors()).equals(0);
  });
});
