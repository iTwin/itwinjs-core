/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Matrix3d } from "../geometry3d/Matrix3d";
import { expect } from "chai";
import { Vector3d } from "../geometry3d/Point3dVector3d";
import { YawPitchRollAngles } from "../geometry3d/YawPitchRollAngles";
import * as bsiChecker from "./Checker";
/* tslint:disable:no-console */

describe("Quaternion", () => {
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
      Vector3d.create(0, 0, 90)]) {
      const ypr = YawPitchRollAngles.createDegrees(degrees.x, degrees.y, degrees.z);
      const matrix = ypr.toMatrix3d();
      const quaternion = matrix.toQuaternion();
      const roundTrip = Matrix3d.createFromQuaternion(quaternion);
      ck.testTrue(matrix.isAlmostEqual(roundTrip));
    }
    expect(ck.getNumErrors()).equals(0);
  });
});
