/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { YawPitchRollAngles, YawPitchRollProps } from "../../geometry3d/YawPitchRollAngles";
import * as bsiChecker from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("YPR", () => {
  it("hello", () => {
    const ck = new bsiChecker.Checker();
    const ypr000 = YawPitchRollAngles.createRadians(0, 0, 0);
    ck.testTrue(ypr000.isIdentity(), "isIdentity");
    ck.testTrue(YawPitchRollAngles.createDegrees(360, -720, 3 * 360).isIdentity(), "isIdentity with wrap");
    ck.testFalse(
      YawPitchRollAngles.createDegrees(360, -720, 3 * 360).isIdentity(false),
      "is not Identity if we don't allow period shift",
    );
    for (const degrees of [
      Vector3d.create(10, 0, 0),
      Vector3d.create(0, 10, 0),
      Vector3d.create(0, 0, 10),
      Vector3d.create(0, 20, 10),
      Vector3d.create(10, 20, 0),
      Vector3d.create(10, 0, 20),
      Vector3d.create(3, 2, 9),
      Vector3d.create(6, 2, -40),
      Vector3d.create(-9, 14, -2),
      Vector3d.create(-25, 8, 2),
      Vector3d.create(1, 40, 3),
      Vector3d.create(1, -40, 2),
      Vector3d.create(90, 0, 0),
      Vector3d.create(0, 90, 0),
      Vector3d.create(0, 0, 90)]) {
      const yprA = YawPitchRollAngles.createDegrees(degrees.z, degrees.y, degrees.x);
      const yawMatrix = Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees.z));
      const pitchMatrix = Matrix3d.createRotationAroundAxisIndex(1, Angle.createDegrees(-degrees.y));
      const rollMatrix = Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(degrees.x));
      const product = yawMatrix.multiplyMatrixMatrix(pitchMatrix.multiplyMatrixMatrix(rollMatrix));

      const yprB = yprA.clone();
      ck.testTrue(yprA.isAlmostEqual(yprB), "clone match");
      ck.testCoordinate(degrees.magnitudeSquared(), yprA.sumSquaredDegrees(), "YPR sumSquaredDegrees");
      ck.testCoordinate(degrees.magnitudeSquared() * Geometry.square(Angle.degreesToRadians(1)), yprA.sumSquaredRadians(), "YPR sumSquaredRadians");
      ck.testFalse(yprA.isIdentity(), "!isIdentity");

      const maxDegrees = yprA.maxAbsDegrees();
      ck.testCoordinate(maxDegrees, degrees.maxAbs());
      ck.testCoordinate(yprA.maxAbsRadians(), Angle.degreesToRadians(maxDegrees), "maxAbsRadians");

      const matrixA = yprA.toMatrix3d();
      ck.testMatrix3d(matrixA, product, "degrees ", degrees.toJSON());

      const yprC = YawPitchRollAngles.createFromMatrix3d(matrixA);
      if (ck.testPointer(yprC, "matrix to YPR")) {
        ck.testTrue(yprA.isAlmostEqual(yprC), "YPR-matrix-YPR round trip.");
      }
      const origin = Point3d.create(4, 3, 2);
      const transformA = Transform.createOriginAndMatrix(origin, matrixA);
      const data = YawPitchRollAngles.tryFromTransform(transformA);
      if (ck.testPointer(data, "YPR data from transform")) {
        ck.testPoint3d(origin, data.origin);
        ck.testTrue(yprA.isAlmostEqual(data.angles!), "YPR Transform R/T");
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("GenerateRegression", () => {
    const ck = new bsiChecker.Checker();
    for (const degreesYaw of [1.0, 10.0, 20.0]) {
      for (const degreesPitch of [1.0, 15.0, 28.0]) {
        for (const degreesRoll of [-20.0, 15.0, 12.0]) {
          const yprA = YawPitchRollAngles.createDegrees(degreesYaw, degreesPitch, degreesRoll);
          const matrixA = yprA.toMatrix3d();
          const yprB = YawPitchRollAngles.createFromMatrix3d(matrixA);
          if (ck.testType(yprB, YawPitchRollAngles, "ypr inverted"))
            ck.testTrue(yprA.isAlmostEqual(yprB), "yprRoundTrip");
          GeometryCoreTestIO.consoleLog({ yprA, matrixA });
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("freeze", () => {
    const ypr = YawPitchRollAngles.createDegrees(1, 2, 3);
    ypr.freeze();
    assert.throws(() => ypr.yaw.setDegrees(20));
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

  it("createFromMatrix3d", () => {
    const ck = new bsiChecker.Checker();
    const matrix = Matrix3d.createRowValues(0, 1, 0, 1, 0, 0, 0, 0, -1);
    const ypr = YawPitchRollAngles.createFromMatrix3d(matrix);
    if (ck.testPointer(ypr, "confirm ypr created from mirror xy")) {
      ck.testAngleNoShift(Angle.createDegrees(90), ypr.yaw);
      ck.testAngleNoShift(Angle.createDegrees(0), ypr.pitch);
      ck.testAngleNoShift(Angle.createDegrees(180), ypr.roll);
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("YawPitchRollAngles", () => {
  it("createFromMatrix3d", () => {
    const ck = new bsiChecker.Checker();
    const ypr0 = YawPitchRollAngles.createDegrees(10, 20, 30);
    const matrix0: Matrix3d = ypr0.toMatrix3d();
    const ypr1 = YawPitchRollAngles.createFromMatrix3d(matrix0);
    if (ypr1)
      expect(ypr0.maxDiffRadians(ypr1)).lessThan(Geometry.smallAngleRadians);
    ck.checkpoint("YawPitchRollAngles.createFromMatrix3d");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("YawPitchRollAngles", () => {
  it("ZeroYPR", () => {
    const ypr = YawPitchRollAngles.createDegrees(0, 0, 0);
    const expectedJson: any = {};
    const outputJson: YawPitchRollProps = ypr.toJSON();
    expect(outputJson).to.deep.equal(expectedJson);
  }),
    it("NonZeroYPR", () => {
      const ypr = YawPitchRollAngles.createDegrees(10, 20, 30);
      const expectedJson: any = { pitch: 20, roll: 30, yaw: 10 };
      const outputJson: YawPitchRollProps = ypr.toJSON();
      expect(outputJson).to.deep.equal(expectedJson);
    });
});

describe("YawPitchRollAngles", () => {
  it("maxDiffDegrees", () => {
    const ypr1 = YawPitchRollAngles.createDegrees(10, 20, 30);
    const ypr2 = YawPitchRollAngles.createDegrees(20, 50, 100);
    const expectedMax: number = 70; // which is 100 - 30
    const outputMax: number = ypr2.maxDiffDegrees(ypr1);
    expect(expectedMax).equal(outputMax);
  });
});
