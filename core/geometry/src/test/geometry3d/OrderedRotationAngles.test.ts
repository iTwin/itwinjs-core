/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import { AxisOrder } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { OrderedRotationAngles } from "../../geometry3d/OrderedRotationAngles";
import { Vector3d } from "../../geometry3d/Point3dVector3d";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { Checker } from "../Checker";

/* eslint-disable no-console */

function multiplyMatricesByAxisOrder(xMatrix: Matrix3d, yMatrix: Matrix3d, zMatrix: Matrix3d, axisOrder: AxisOrder): Matrix3d {
  switch (axisOrder) {
    case AxisOrder.XYZ: return xMatrix.multiplyMatrixMatrix(yMatrix.multiplyMatrixMatrix(zMatrix));
    case AxisOrder.XZY: return xMatrix.multiplyMatrixMatrix(zMatrix.multiplyMatrixMatrix(yMatrix));
    case AxisOrder.YXZ: return yMatrix.multiplyMatrixMatrix(xMatrix.multiplyMatrixMatrix(zMatrix));
    case AxisOrder.YZX: return yMatrix.multiplyMatrixMatrix(zMatrix.multiplyMatrixMatrix(xMatrix));
    case AxisOrder.ZXY: return zMatrix.multiplyMatrixMatrix(xMatrix.multiplyMatrixMatrix(yMatrix));
    case AxisOrder.ZYX: return zMatrix.multiplyMatrixMatrix(yMatrix.multiplyMatrixMatrix(xMatrix));
  }
}

function multipleDegreeRotationsByAxisOrder(xDegrees: number, yDegrees: number, zDegrees: number, axisOrder: AxisOrder): Matrix3d {
  return multiplyMatricesByAxisOrder(
    Matrix3d.createRotationAroundVector(Vector3d.unitX(), Angle.createDegrees(xDegrees))!,
    Matrix3d.createRotationAroundVector(Vector3d.unitY(), Angle.createDegrees(yDegrees))!,
    Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(zDegrees))!,
    axisOrder);
}

/** Compare the matrix images of two ordered rotations. */
function testEqualOrderedRotationAngles(ck: Checker, a: OrderedRotationAngles, b: OrderedRotationAngles) {
  const matrixA = a.toMatrix3d();
  const matrixB = b.toMatrix3d();
  if (!ck.testMatrix3d(matrixA, matrixB, "matrix images of OrderedRotationAngle pair")) {
    console.log("*********************");
    console.log("");
    const a1 = OrderedRotationAngles.createFromMatrix3d(matrixA, a.order);
    const b1 = OrderedRotationAngles.createFromMatrix3d(matrixB, b.order);
    console.log("A:", a, matrixA, a1);
    console.log("B:", b, matrixB, b1);
  }
}

function testMultiAngleEquivalence(ck: Checker, xDegrees: number, yDegrees: number, zDegrees: number) {
  // WE EXPECT -- OrderedRotationAngles constructs TRANSPOSED matrices and multiplies them together in REVERSE ORDER
  // So ...
  // consider each axis order paired with its reverse order ...
  // and compare matrices constructed by
  //   (1) the (very compact) formulas in OrderedRotationAngles with
  //   (2) full matrix products
  for (const orderPair of [
    [AxisOrder.XYZ, AxisOrder.ZYX],
    [AxisOrder.XZY, AxisOrder.YZX],
    [AxisOrder.YXZ, AxisOrder.ZXY],
    [AxisOrder.YZX, AxisOrder.XZY],
    [AxisOrder.ZXY, AxisOrder.YXZ],
    [AxisOrder.ZYX, AxisOrder.XYZ]]) {
    const angles = OrderedRotationAngles.createDegrees(xDegrees, yDegrees, zDegrees, orderPair[0]);
    const angles1 = OrderedRotationAngles.createDegrees(0, 0, 0, orderPair[0]);
    const angles2 = OrderedRotationAngles.createDegrees(xDegrees, yDegrees, zDegrees, orderPair[0], angles1);
    testEqualOrderedRotationAngles(ck, angles, angles2);
    ck.testTrue(angles1 === angles2, "reuse prior object");
    ck.testTightNumber(xDegrees, angles.xDegrees, " x degrees");
    ck.testTightNumber(yDegrees, angles.yDegrees, " y degrees");
    ck.testTightNumber(zDegrees, angles.zDegrees, " z degrees");

    ck.testTightNumber(Angle.degreesToRadians(xDegrees), angles.xRadians, "x radians");
    ck.testTightNumber(Angle.degreesToRadians(yDegrees), angles.yRadians, "y radians");
    ck.testTightNumber(Angle.degreesToRadians(zDegrees), angles.zRadians, "Z radians");

    const matrixA = angles.toMatrix3d();
    const matrixB = multipleDegreeRotationsByAxisOrder(-xDegrees, -yDegrees, -zDegrees, orderPair[1]);
    ck.testMatrix3d(matrixA, matrixB, "Compound rotation pair with order and sign reversal");

  }
}
describe("OrderedRotationAngles", () => {

  it("OrderedRotationAngles.SingleRotation", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 0, 0);
    testMultiAngleEquivalence(ck, 0, 10, 0);
    testMultiAngleEquivalence(ck, 0, 0, 10);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.TwoRotations", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 0);
    testMultiAngleEquivalence(ck, 0, 10, 20);
    testMultiAngleEquivalence(ck, 20, 0, 10);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.ThreeRotations", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 30);
    testMultiAngleEquivalence(ck, 50, 10, 20);
    testMultiAngleEquivalence(ck, 20, 40, 10);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.RoundTrip", () => {
    const ck = new Checker();

    const primaryRadians = 1.0;
    for (const axisOrder of [AxisOrder.YXZ, AxisOrder.ZYX, AxisOrder.XYZ, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.ZYX]) {
      // console.log("  AXIS ORDER " + axisOrder);
      for (const treatVectorsAsColumns of [true, false]) {
        const savedFlag = OrderedRotationAngles.treatVectorsAsColumns;
        OrderedRotationAngles.treatVectorsAsColumns = treatVectorsAsColumns;
        for (const factor of [1.0, 0.05, 2.0, 4.2343, 0.001, 0.0001, 0.00001, -1.0, -0.4]) {
          const r = primaryRadians * factor;
          const q = 0.25;
          const q1 = Math.PI - r;
          const q2 = primaryRadians * Math.abs(0.7 - factor);
          for (const anglesA of [
            // one angle
            OrderedRotationAngles.createRadians(r, 0, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, 0, r, axisOrder),
            // two angles
            OrderedRotationAngles.createRadians(r, q, 0, axisOrder),
            OrderedRotationAngles.createRadians(q, r, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, q, axisOrder),
            OrderedRotationAngles.createRadians(0, q, r, axisOrder),
            OrderedRotationAngles.createRadians(q, 0, r, axisOrder),
            OrderedRotationAngles.createRadians(r, 0, q, axisOrder),
            // odd cases that failed earlier . . .
            OrderedRotationAngles.createRadians(r, q1, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, q1, axisOrder),
            OrderedRotationAngles.createRadians(q1, 0, r, axisOrder),
            OrderedRotationAngles.createDegrees(0.001, 89.999, 0, axisOrder),
            OrderedRotationAngles.createDegrees(89.999, 0.001, 0, axisOrder),
            OrderedRotationAngles.createDegrees(0.001, 0, 89.999, axisOrder),
            OrderedRotationAngles.createDegrees(89.999, 0, 0.001, axisOrder),
            OrderedRotationAngles.createDegrees(0, 0.001, 89.999, axisOrder),
            OrderedRotationAngles.createDegrees(0, 89.999, 0.001, axisOrder),
            // three angles
            OrderedRotationAngles.createRadians(r, q1, q2, axisOrder),
            OrderedRotationAngles.createRadians(q2, r, q1, axisOrder),
            OrderedRotationAngles.createRadians(q2, q1, r, axisOrder),
          ]) {
            const matrixA = anglesA.toMatrix3d();
            const anglesB = OrderedRotationAngles.createFromMatrix3d(matrixA, axisOrder);
            testEqualOrderedRotationAngles(ck, anglesA, anglesB);
            expect(ck.getNumErrors()).equals(0);
          }
        }
        OrderedRotationAngles.treatVectorsAsColumns = savedFlag;
      }
    }
  });

  it("OrderedRotationAngles.toMatrix3d", () => {
    const ck = new Checker();
    let x = 0, y = 0, z = 0;

    // No Rotation
    const angles = OrderedRotationAngles.createDegrees(x, y, z, AxisOrder.XYZ);
    const matrix = angles.toMatrix3d();
    ck.testTrue(matrix.isIdentity);

    // One Rotation (IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    OrderedRotationAngles.createAngles(Angle.createDegrees(0), Angle.createDegrees(45), Angle.createDegrees(0), AxisOrder.YXZ, angles);
    angles.toMatrix3d(matrix);
    let expectedMatrix = Matrix3d.createRowValues(
      angles.yAngle.cos(), 0, -angles.yAngle.sin(),
      0, 1, 0,
      angles.yAngle.sin(), 0, angles.yAngle.cos(),
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // Three Rotations (EACH IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    x = Math.PI / 2, y = 1.16937061629, z = 0.0349066;  // 45, 67.000001, and 2 degrees
    const rX = Matrix3d.createRowValues(
      1, 0, 0,
      0, Math.cos(x), Math.sin(x),
      0, -Math.sin(x), Math.cos(x),
    );
    const rY = Matrix3d.createRowValues(
      Math.cos(y), 0, -Math.sin(y),
      0, 1, 0,
      Math.sin(y), 0, Math.cos(y),
    );
    const rZ = Matrix3d.createRowValues(
      Math.cos(z), Math.sin(z), 0,
      -Math.sin(z), Math.cos(z), 0,
      0, 0, 1,
    );

    // Rotation using XYZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using reverse ZYX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAnglesVersusYawPitchRoll", () => {
    const ck = new Checker();
    const degreesChoices = [Angle.createDegrees(0.0), Angle.createDegrees(10.0), Angle.createDegrees(5.0), Angle.createDegrees(15.0)];
    const unitX = Vector3d.unitX();
    const unitY = Vector3d.unitY();
    const unitZ = Vector3d.unitZ();
    // Confirm that ypr matrix matches transpose of OrientedRotationAngles matrix for XYZ order and (X=roll, Y= negated pitch, Z = yaw)
    OrderedRotationAngles.treatVectorsAsColumns = true;
    for (const rollAngle of degreesChoices) {
      // this is ROLL
      const matrixX = Matrix3d.createRotationAroundVector(unitX, rollAngle)!;
      for (const pitchAngle of degreesChoices) {
        // this is PITCH
        const matrixY = Matrix3d.createRotationAroundVector(unitY, pitchAngle)!;
        matrixY.transposeInPlace();   // PITCH IS NEGATIVE Y !!!!!
        for (const yawAngle of degreesChoices) {
          // this is YAW
          const matrixZ = Matrix3d.createRotationAroundVector(unitZ, yawAngle)!;
          const matrixZYX = matrixZ.multiplyMatrixMatrix(matrixY.multiplyMatrixMatrix(matrixX));
          const ypr = YawPitchRollAngles.createRadians(yawAngle.radians, pitchAngle.radians, rollAngle.radians);
          const yprMatrix = ypr.toMatrix3d();
          if (!ck.testCoordinate(0, yprMatrix.maxDiff(matrixZYX))) {
            console.log(`${JSON.stringify(ypr.toJSON())} maxDiff ypr:(Z)(-Y)(X)   ${yprMatrix.maxDiff(matrixZYX)}`);
            console.log("ypr matrix", yprMatrix);
            console.log("matrixZYX", matrixZYX);
          }
          const orderedAngles = OrderedRotationAngles.createDegrees(rollAngle.degrees, -pitchAngle.degrees, yawAngle.degrees, AxisOrder.XYZ);
          const orderedMatrix = orderedAngles.toMatrix3d();
          //          const orderedAnglesB = OrderedRotationAngles.createDegrees(-rollAngle.degrees, pitchAngle.degrees, -yawAngle.degrees, AxisOrder.ZYX);
          //          const orderedMatrixB = orderedAngles.toMatrix3d ();
          //         console.log ("B diff", orderedMatrixB.maxDiff (yprMatrix), orderedAnglesB);
          orderedMatrix.transposeInPlace();
          if (!ck.testMatrix3d(yprMatrix, orderedMatrix)) {
            const orderedMatrix1 = orderedAngles.toMatrix3d();
            ck.testMatrix3d(yprMatrix, orderedMatrix1);

          }
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("OrderedRotationAngles.fromMatrix3d", () => {
    const ck = new Checker();
    const /* x = .0192, y = .7564, */ z = Math.PI / 2;

    // No Rotation
    const matrix = Matrix3d.createIdentity();
    const angles = OrderedRotationAngles.createFromMatrix3d(matrix, AxisOrder.YZX); // order doesn't matter
    const expectedAngles = OrderedRotationAngles.createRadians(0, 0, 0, AxisOrder.ZXY);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // One Rotation (IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    Matrix3d.createRowValues(
      Math.cos(z), Math.sin(z), 0,
      -Math.sin(z), Math.cos(z), 0,
      0, 0, 1, matrix,
    );

    OrderedRotationAngles.createFromMatrix3d(matrix, AxisOrder.YXZ, angles);
    OrderedRotationAngles.createRadians(0, 0, Math.PI / 2, AxisOrder.XYZ, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);
    OrderedRotationAngles.createFromMatrix3d(matrix, AxisOrder.ZXY, angles);  // order doesn't matter
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // Three Rotations (EACH IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    /*
    const rX = Matrix3d.createRowValues(

    );
    const rY = Matrix3d.createRowValues(

    );
    const rZ = matrix.clone();

    */
    // ###TODO
  });
});
