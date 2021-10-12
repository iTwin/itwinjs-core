/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Vector3d } from "../../geometry3d/Point3dVector3d";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { Point4d } from "../../geometry4d/Point4d";
import * as bsiChecker from "../Checker";

/* eslint-disable no-console */

function rotatexyzw(xyzw: Point4d): Point4d {
  return Point4d.create(xyzw.y, xyzw.z, xyzw.w, xyzw.x);
}
describe("MatrixQuatMatrix", () => {
  it("hello", () => {
    const ck = new bsiChecker.Checker();

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
      Vector3d.create(0, 0, 90),
      Vector3d.create(89, 0, 0),
      Vector3d.create(0, 89, 0),
      Vector3d.create(0, 0, 89)]) {
      const ypr = YawPitchRollAngles.createDegrees(degrees.x, degrees.y, degrees.z);
      const matrix = ypr.toMatrix3d();
      const quaternion = matrix.toQuaternion();
      const roundTrip = Matrix3d.createFromQuaternion(quaternion);
      ck.testTrue(matrix.isAlmostEqual(roundTrip));
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("QuatMatrixQuat", () => {
    const ck = new bsiChecker.Checker();

    for (const xyzw of [
      Point4d.create(1, 0, 0, 0),
      Point4d.create(10, 1, 1, 1),
      Point4d.create(10, 4, 5, 1)]) {
      let quat = xyzw.clone().normalizeXYZW()!;
      for (let i = 0; i < 4; i++) {
        quat = rotatexyzw(quat);
        const matrix = Matrix3d.createFromQuaternion(quat);
        const quat1 = matrix.toQuaternion();
        ck.testPoint4d(quat, quat1, "quat round trip");
      }
    }

    const matrixA = Matrix3d.createFromQuaternion(Point4d.create(0, 0, 0, 0));
    ck.testTrue(matrixA.isIdentity, "0000 quat is identity");
    expect(ck.getNumErrors()).equals(0);
  });

});
