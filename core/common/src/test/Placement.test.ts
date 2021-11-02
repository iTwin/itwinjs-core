/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Angle, Matrix3d, Point2d, Point3d, Range2d, Range3d, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { Placement2d, Placement3d } from "../core-common";

describe("Placement", () => {
  it("Placement3d", () => {
    const invalidPlacement: Placement3d = new Placement3d(new Point3d(0, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), new Range3d());
    assert.isFalse(invalidPlacement.isValid, "Expect isValid to be false since no bbox provided");
    const placement: Placement3d = new Placement3d(new Point3d(0, 1, 0), YawPitchRollAngles.createDegrees(0, 0, 0), new Range3d(-5, -5, -2, 5, 5, 2));
    assert.isTrue(placement.isValid, "Expect isValid to be true");
    assert.deepEqual(placement.calculateRange(), new Range3d(-5, -4, -2, 5, 6, 2));
    const translation: Transform = Transform.createTranslationXYZ(1, 2, 0);
    placement.multiplyTransform(translation);
    assert.deepEqual(placement.origin, new Point3d(1, 3, 0));
    assert.deepEqual(placement.calculateRange(), new Range3d(-4, -2, -2, 6, 8, 2));
    const invalidTransform: Transform = Transform.createOriginAndMatrixColumns(Point3d.createZero(), Vector3d.unitX(2), Vector3d.unitY(1), Vector3d.unitZ(1));
    assert.exists(invalidTransform);
    assert.throws(() => placement.multiplyTransform(invalidTransform));
  });

  it("Placement2d", () => {
    const invalidPlacement: Placement2d = new Placement2d(new Point2d(0, 0), Angle.createDegrees(0), new Range2d());
    assert.isFalse(invalidPlacement.isValid, "Expect isValid to be false since no bbox provided");
    const placement: Placement2d = new Placement2d(new Point2d(0, 1), Angle.createDegrees(0), new Range2d(-5, -5, 5, 5));
    assert.isTrue(placement.isValid, "Expect isValid to be true");
    assert.deepEqual(placement.calculateRange(), new Range3d(-5, -4, -1, 5, 6, 1));
    const translation: Transform = Transform.createTranslationXYZ(1, 2, 0);
    placement.multiplyTransform(translation);
    assert.deepEqual(placement.origin, new Point2d(1, 3));
    assert.deepEqual(placement.calculateRange(), new Range3d(-4, -2, -1, 6, 8, 1));
    const invalidTransform: Transform = Transform.createOriginAndMatrixColumns(Point3d.createZero(), Vector3d.unitX(2), Vector3d.unitY(1), Vector3d.unitZ(1));
    assert.exists(invalidTransform);
    assert.throws(() => placement.multiplyTransform(invalidTransform));
    const invalidRotation: Transform = Transform.createOriginAndMatrix(undefined, Matrix3d.create90DegreeRotationAroundAxis(1));
    assert.exists(invalidRotation);
    assert.throws(() => placement.multiplyTransform(invalidRotation));
  });
});
