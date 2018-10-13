/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Vector3d, Point3d } from "../geometry3d/Point3dVector3d";
import { YawPitchRollAngles } from "../geometry3d/YawPitchRollAngles";
import { Transform } from "../geometry3d/Transform";

import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import * as bsiChecker from "./Checker";
// import { Sample } from "../serialization/GeometrySamples";
import { expect, assert } from "chai";
/* tslint:disable:no-console */
describe("YPR", () => {
  it("hello", () => {
    const ck = new bsiChecker.Checker();
    const ypr000 = YawPitchRollAngles.createRadians(0, 0, 0);
    ck.testTrue(ypr000.isIdentity(), "isIdentity");
    ck.testTrue(YawPitchRollAngles.createDegrees(360, -720, 3 * 360).isIdentity(), "isIdentity with wrap");

    for (const degrees of [
      Vector3d.create(3, 2, 9),
      Vector3d.create(6, 2, -40),
      Vector3d.create(-9, 14, -2),
      Vector3d.create(-25, 8, 2),
      Vector3d.create(1, 40, 3),
      Vector3d.create(1, -40, 2),
      Vector3d.create(10, 0, 0),
      Vector3d.create(0, 10, 0),
      Vector3d.create(0, 0, 10),
      Vector3d.create(90, 0, 0),
      Vector3d.create(0, 90, 0),
      Vector3d.create(0, 0, 90)]) {
      const yprA = YawPitchRollAngles.createDegrees(degrees.x, degrees.y, degrees.z);
      const yprB = yprA.clone();
      ck.testTrue(yprA.isAlmostEqual(yprB), "clone match");
      ck.testCoordinate(degrees.magnitudeSquared(), yprA.sumSquaredDegrees(), "YPR sumSquaredDegrees");
      ck.testCoordinate(degrees.magnitudeSquared() * Geometry.square(Angle.degreesToRadians(1)), yprA.sumSquaredRadians(), "YPR sumSquaredRadians");
      ck.testFalse(yprA.isIdentity(), "!isIdentity");

      const maxDegrees = yprA.maxAbsDegrees();
      ck.testCoordinate(maxDegrees, degrees.maxAbs());
      ck.testCoordinate(yprA.maxAbsRadians(), Angle.degreesToRadians(maxDegrees), "maxAbsRadians");

      const matrixA = yprA.toMatrix3d();
      const yprAI = YawPitchRollAngles.createFromMatrix3d(matrixA);
      if (ck.testPointer(yprAI, "matrix to YPR") && yprAI) {
        ck.testTrue(yprA.isAlmostEqual(yprAI), "YPR-matrix-YPR round trip.");
      }
      const origin = Point3d.create(4, 3, 2);
      const transformA = Transform.createOriginAndMatrix(origin, matrixA);
      const data = YawPitchRollAngles.tryFromTransform(transformA);
      if (ck.testPointer(data, "YPR data from transform") && data) {
        ck.testPoint3d(origin, data.origin);
        ck.testTrue(yprA.isAlmostEqual(data.angles!), "YPR Transform R/T");
      }

    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("json", () => {
    const ck = new bsiChecker.Checker();
    const ypr0 = YawPitchRollAngles.createDegrees(10, 20, 30);
    const json0 = ypr0.toJSON() as any;
    assert.approximately(json0.yaw, 10, .0001);
    assert.approximately(json0.pitch, 20, .0001);
    assert.approximately(json0.roll, 30, .0001);
    assert.isUndefined(json0.yaw.radians);
    assert.isUndefined(json0.pitch.radians);
    assert.isUndefined(json0.roll.radians);

    const ypr1 = YawPitchRollAngles.fromJSON(json0);
    const ypr2 = YawPitchRollAngles.createDegrees(0, 0, 0);
    ypr2.setFromJSON(json0);
    ck.testTrue(ypr0.isAlmostEqual(ypr1));
    ck.testTrue(ypr0.isAlmostEqual(ypr2));
    expect(ck.getNumErrors()).equals(0);
  });
});
