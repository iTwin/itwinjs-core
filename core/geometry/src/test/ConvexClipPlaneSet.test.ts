/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "./Checker";
import { Geometry, Angle } from "../Geometry";
import { Point3d, Vector3d } from "../PointVector";
import { Matrix3d } from "../Transform";
import { Transform } from "../Transform";
import { LineSegment3d } from "../curve/LineSegment3d";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
/* tslint:disable:no-console */

describe("ConvexClipPlaneSet", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const ax = -1;
    const ay = -2;
    const bx = 1;
    const by = 4;
    const boxA = ConvexClipPlaneSet.createXYPolyLine([
      Point3d.create(ax, ay, 0),
      Point3d.create(bx, ay, 0),
      Point3d.create(bx, by, 0),
      Point3d.create(ax, by, 0),
      Point3d.create(ax, ay, 0)],
      [true, true, true, true, true], true);
    const boxB = ConvexClipPlaneSet.createXYBox(ax, ay, bx, by);
    const boxC = boxB.clone();
    const segmentM = LineSegment3d.createXYXY(
      Geometry.interpolate(ax, 0.3, bx), ay,
      bx, Geometry.interpolate(ay, 0.9, by), 0);

    for (const transform of [
      Transform.createTranslationXYZ(10, 0, 0),
      Transform.createFixedPointAndMatrix(
        Point3d.create(ax, ay, 0),
        Matrix3d.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(90))!),
      Transform.createFixedPointAndMatrix(
        Point3d.create(3, 2, 5),
        Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 9), Angle.createDegrees(23))!)]) {

      const segmentN = segmentM.cloneTransformed(transform);
      const boxD = boxA.clone();
      boxD.transformInPlace(transform);

      for (const f of [-2, -0.2, 0.001, 0.3, 0.998, 1.0002, 3]) {
        const pointM = segmentM.fractionToPoint(f);
        const inout = boxA.isPointInside(pointM);
        ck.testBoolean(boxA.isPointInside(pointM), boxB.isPointInside(pointM), "point inside", f, pointM);
        ck.testBoolean(boxA.isPointInside(pointM), boxC.isPointInside(pointM), "point inside clone", f, pointM);
        ck.testBoolean(boxA.isPointInside(pointM), Geometry.isIn01(f), "point inside versus segment fractionf, ", pointM);

        const pointN = segmentN.fractionToPoint(f);
        ck.testBoolean(inout, boxD.isPointInside(pointN), "inout for transformed", f, pointN);
      }
    }
    ck.checkpoint("ConvexClipPlaneSet.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

});
