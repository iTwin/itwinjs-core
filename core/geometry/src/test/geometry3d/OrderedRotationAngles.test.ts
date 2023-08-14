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
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

function multiplyMatricesByAxisOrder(xMatrix: Matrix3d, yMatrix: Matrix3d, zMatrix: Matrix3d, axisOrder: AxisOrder): Matrix3d {
  switch (axisOrder) {
    case AxisOrder.XYZ: return zMatrix.multiplyMatrixMatrix(yMatrix.multiplyMatrixMatrix(xMatrix));
    case AxisOrder.XZY: return yMatrix.multiplyMatrixMatrix(zMatrix.multiplyMatrixMatrix(xMatrix));
    case AxisOrder.YXZ: return zMatrix.multiplyMatrixMatrix(xMatrix.multiplyMatrixMatrix(yMatrix));
    case AxisOrder.YZX: return xMatrix.multiplyMatrixMatrix(zMatrix.multiplyMatrixMatrix(yMatrix));
    case AxisOrder.ZXY: return yMatrix.multiplyMatrixMatrix(xMatrix.multiplyMatrixMatrix(zMatrix));
    case AxisOrder.ZYX: return xMatrix.multiplyMatrixMatrix(yMatrix.multiplyMatrixMatrix(zMatrix));
  }
}

function multipleDegreeRotationsByAxisOrder(xDegrees: number, yDegrees: number, zDegrees: number, axisOrder: AxisOrder): Matrix3d {
  return multiplyMatricesByAxisOrder(
    Matrix3d.createRotationAroundVector(Vector3d.unitX(), Angle.createDegrees(xDegrees))!,
    Matrix3d.createRotationAroundVector(Vector3d.unitY(), Angle.createDegrees(yDegrees))!,
    Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(zDegrees))!,
    axisOrder,
  );
}

/** Compare the matrix images of two ordered rotations. */
function testEqualOrderedRotationAngles(ck: Checker, a: OrderedRotationAngles, b: OrderedRotationAngles) {
  const matrixA = a.toMatrix3d();
  const matrixB = b.toMatrix3d();
  if (!ck.testMatrix3d(matrixA, matrixB, "matrix images of OrderedRotationAngle pair")) {
    GeometryCoreTestIO.consoleLog("*********************");
    GeometryCoreTestIO.consoleLog("");
    const a1 = OrderedRotationAngles.createFromMatrix3d(matrixA, a.order);
    const b1 = OrderedRotationAngles.createFromMatrix3d(matrixB, b.order);
    GeometryCoreTestIO.consoleLog("A:", a, matrixA, a1);
    GeometryCoreTestIO.consoleLog("B:", b, matrixB, b1);
  }
}

function testMultiAngleEquivalence(ck: Checker, xDegrees: number, yDegrees: number, zDegrees: number, treatVectorsAsColumns: boolean) {
  OrderedRotationAngles.treatVectorsAsColumns = treatVectorsAsColumns;
  for (const orderPair of [
    [AxisOrder.XYZ, AxisOrder.ZYX],
    [AxisOrder.XZY, AxisOrder.YZX],
    [AxisOrder.YXZ, AxisOrder.ZXY],
    [AxisOrder.YZX, AxisOrder.XZY],
    [AxisOrder.ZXY, AxisOrder.YXZ],
    [AxisOrder.ZYX, AxisOrder.XYZ]]) {
    const angles = OrderedRotationAngles.createDegrees(xDegrees, yDegrees, zDegrees, orderPair[0]);
    const angles1 = OrderedRotationAngles.createDegrees(0, 0, 0, orderPair[0]);
    const angles2 = OrderedRotationAngles.createDegrees(xDegrees, yDegrees, zDegrees, orderPair[0], undefined, angles1);
    testEqualOrderedRotationAngles(ck, angles, angles2);
    ck.testTrue(angles1 === angles2, "reuse prior object");
    ck.testTightNumber(xDegrees, angles.xDegrees, " x degrees");
    ck.testTightNumber(yDegrees, angles.yDegrees, " y degrees");
    ck.testTightNumber(zDegrees, angles.zDegrees, " z degrees");

    ck.testTightNumber(Angle.degreesToRadians(xDegrees), angles.xRadians, "x radians");
    ck.testTightNumber(Angle.degreesToRadians(yDegrees), angles.yRadians, "y radians");
    ck.testTightNumber(Angle.degreesToRadians(zDegrees), angles.zRadians, "Z radians");

    // rotation matrix calculated by classic base rotation matrixes (column-based)
    const matrixA = angles.toMatrix3d();
    // rotation matrix calculated by Rodriguez formula (matrix form)
    const matrixB = multipleDegreeRotationsByAxisOrder(xDegrees, yDegrees, zDegrees, orderPair[0]);
    if (!treatVectorsAsColumns) {
      matrixB.transpose(matrixB);
    }
    ck.testMatrix3d(
      matrixA,
      matrixB,
      "classic base rotation matrixes (column-based) and Rodriguez formula (matrix form)",
    );

    // rotation matrix calculated by row-based base rotation matrixes (negative angles) and reversed axis order
    const matrixC = multipleDegreeRotationsByAxisOrder(-xDegrees, -yDegrees, -zDegrees, orderPair[1]);
    if (!treatVectorsAsColumns) {
      matrixC.transpose(matrixC);
    }
    ck.testMatrix3d(
      matrixA,
      matrixC.transpose(matrixC), // transpose has to be applied
      "classic base rotation matrixes (column-based) and row-based base rotation matrixes and reversed axis order",
    );
  }
}

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.SingleRotationColumnBased", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 0, 0, true);
    testMultiAngleEquivalence(ck, 0, 10, 0, true);
    testMultiAngleEquivalence(ck, 0, 0, 10, true);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.TwoRotationsColumnBased", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 0, true);
    testMultiAngleEquivalence(ck, 0, 10, 20, true);
    testMultiAngleEquivalence(ck, 20, 0, 10, true);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.ThreeRotationsColumnBased", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 30, true);
    testMultiAngleEquivalence(ck, 50, 10, 20, true);
    testMultiAngleEquivalence(ck, 20, 40, 10, true);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.SingleRotationRowBased", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 0, 0, false);
    testMultiAngleEquivalence(ck, 0, 10, 0, false);
    testMultiAngleEquivalence(ck, 0, 0, 10, false);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.TwoRotationsRowBased", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 0, false);
    testMultiAngleEquivalence(ck, 0, 10, 20, false);
    testMultiAngleEquivalence(ck, 20, 0, 10, false);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.ThreeRotationsRowBased", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 30, false);
    testMultiAngleEquivalence(ck, 50, 10, 20, false);
    testMultiAngleEquivalence(ck, 20, 40, 10, false);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.toMatrix3dFromMatrix3d", () => {
    const ck = new Checker();
    const primaryRadians = 1.0;
    for (const axisOrder of [AxisOrder.XYZ, AxisOrder.YXZ, AxisOrder.ZYX, AxisOrder.ZXY, AxisOrder.YZX, AxisOrder.XZY]) {
      for (const treatVectorsAsColumns of [true, false]) {
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
            OrderedRotationAngles.createRadians(r, 0, q, axisOrder),
            OrderedRotationAngles.createRadians(q, 0, r, axisOrder),
            OrderedRotationAngles.createRadians(r, q1, 0, axisOrder),
            OrderedRotationAngles.createRadians(q1, r, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, q1, axisOrder),
            OrderedRotationAngles.createRadians(0, q1, r, axisOrder),
            OrderedRotationAngles.createRadians(q1, 0, r, axisOrder),
            OrderedRotationAngles.createRadians(r, 0, q1, axisOrder),
            OrderedRotationAngles.createDegrees(0.001, 89.999, 0, axisOrder),
            OrderedRotationAngles.createDegrees(89.999, 0.001, 0, axisOrder),
            OrderedRotationAngles.createDegrees(0, 0.001, 89.999, axisOrder),
            OrderedRotationAngles.createDegrees(0, 89.999, 0.001, axisOrder),
            OrderedRotationAngles.createDegrees(0.001, 0, 89.999, axisOrder),
            OrderedRotationAngles.createDegrees(89.999, 0, 0.001, axisOrder),
            // three angles
            OrderedRotationAngles.createRadians(r, q1, q2, axisOrder),
            OrderedRotationAngles.createRadians(r, q2, q1, axisOrder),
            OrderedRotationAngles.createRadians(q1, r, q2, axisOrder),
            OrderedRotationAngles.createRadians(q1, q2, r, axisOrder),
            OrderedRotationAngles.createRadians(q2, r, q1, axisOrder),
            OrderedRotationAngles.createRadians(q2, q1, r, axisOrder),
          ]) {
            const matrixA = anglesA.toMatrix3d();
            const anglesB = OrderedRotationAngles.createFromMatrix3d(matrixA, axisOrder);
            if (ck.testDefined(anglesB) && anglesB)
              testEqualOrderedRotationAngles(ck, anglesA, anglesB);

            expect(ck.getNumErrors()).equals(0);
          }
        }
      }
    }
  });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.toMatrix3dColumnBased", () => {
    const ck = new Checker();
    let x = 0, y = 0, z = 0;
    OrderedRotationAngles.treatVectorsAsColumns = true;

    // No Rotation
    const angles = OrderedRotationAngles.createDegrees(x, y, z, AxisOrder.XYZ);
    const matrix = angles.toMatrix3d();
    ck.testTrue(matrix.isIdentity);

    // One Rotation (45 degrees around X axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(45),
      Angle.createDegrees(0),
      Angle.createDegrees(0),
      AxisOrder.YXZ, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    let expectedMatrix = Matrix3d.createRowValues(
      1, 0, 0,
      0, angles.xAngle.cos(), -angles.xAngle.sin(),
      0, angles.xAngle.sin(), angles.xAngle.cos(),
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // One Rotation (45 degrees around Y axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(0),
      Angle.createDegrees(45),
      Angle.createDegrees(0),
      AxisOrder.XYZ, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    expectedMatrix = Matrix3d.createRowValues(
      angles.yAngle.cos(), 0, angles.yAngle.sin(),
      0, 1, 0,
      -angles.yAngle.sin(), 0, angles.yAngle.cos(),
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // One Rotation (45 degrees around Z axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(0),
      Angle.createDegrees(0),
      Angle.createDegrees(45),
      AxisOrder.ZXY, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    expectedMatrix = Matrix3d.createRowValues(
      angles.zAngle.cos(), -angles.zAngle.sin(), 0,
      angles.zAngle.sin(), angles.zAngle.cos(), 0,
      0, 0, 1,
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // Three Rotations
    x = Math.PI / 2, y = 1.16937, z = 0.0349066;  // 90, 67, and 2 degrees
    // The three classic "base rotation matrixes" (columns-based from)
    const rX = Matrix3d.createRowValues(
      1, 0, 0,
      0, Math.cos(x), -Math.sin(x),
      0, Math.sin(x), Math.cos(x),
    );
    const rY = Matrix3d.createRowValues(
      Math.cos(y), 0, Math.sin(y),
      0, 1, 0,
      -Math.sin(y), 0, Math.cos(y),
    );
    const rZ = Matrix3d.createRowValues(
      Math.cos(z), -Math.sin(z), 0,
      Math.sin(z), Math.cos(z), 0,
      0, 0, 1,
    );

    /**
    * Note: for the following checks the AxisOrder is the reverse
    * of matrix multiplication because we used columns-based from
    */
    // Rotation using XYZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using YXZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YXZ, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rX, expectedMatrix).multiplyMatrixMatrix(rY, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using ZXY ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZXY, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rY.multiplyMatrixMatrix(rX, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using ZYX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using YZX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YZX, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rZ, expectedMatrix).multiplyMatrixMatrix(rY, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using XZY ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XZY, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rY.multiplyMatrixMatrix(rZ, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.toMatrix3dRowBasedUsingClassicBaseMatrixes", () => {
    const ck = new Checker();
    let x = 0, y = 0, z = 0;
    // we don't need the following line because default is false. It's added just for clarity.
    OrderedRotationAngles.treatVectorsAsColumns = false;

    // No Rotation
    const angles = OrderedRotationAngles.createDegrees(x, y, z, AxisOrder.XYZ);
    const matrix = angles.toMatrix3d();
    ck.testTrue(matrix.isIdentity);

    // One Rotation (45 degrees around X axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(45),
      Angle.createDegrees(0),
      Angle.createDegrees(0),
      AxisOrder.YXZ, // order does not matter because we only rotate around one axis,
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    let expectedMatrix = Matrix3d.createRowValues(
      1, 0, 0,
      0, angles.xAngle.cos(), -angles.xAngle.sin(),
      0, angles.xAngle.sin(), angles.xAngle.cos(),
    ).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // One Rotation (45 degrees around Y axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(0),
      Angle.createDegrees(45),
      Angle.createDegrees(0),
      AxisOrder.XYZ, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    expectedMatrix = Matrix3d.createRowValues(
      angles.yAngle.cos(), 0, angles.yAngle.sin(),
      0, 1, 0,
      -angles.yAngle.sin(), 0, angles.yAngle.cos(),
    ).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // One Rotation (45 degrees around Z axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(0),
      Angle.createDegrees(0),
      Angle.createDegrees(45),
      AxisOrder.ZXY, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    expectedMatrix = Matrix3d.createRowValues(
      angles.zAngle.cos(), -angles.zAngle.sin(), 0,
      angles.zAngle.sin(), angles.zAngle.cos(), 0,
      0, 0, 1,
    ).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // Three Rotations
    x = Math.PI / 4, y = 0.20944, z = 0.436332;  // 45, 12, and 25 degrees
    // The three classic "base rotation matrixes" (column-based from)
    const rX = Matrix3d.createRowValues(
      1, 0, 0,
      0, Math.cos(x), -Math.sin(x),
      0, Math.sin(x), Math.cos(x),
    );
    const rY = Matrix3d.createRowValues(
      Math.cos(y), 0, Math.sin(y),
      0, 1, 0,
      -Math.sin(y), 0, Math.cos(y),
    );
    const rZ = Matrix3d.createRowValues(
      Math.cos(z), -Math.sin(z), 0,
      Math.sin(z), Math.cos(z), 0,
      0, 0, 1,
    );

    /**
    * Note: for the following checks the AxisOrder is the reverse
    * of matrix multiplication because we used columns-based from
    */
    // Rotation using XYZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using YXZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YXZ, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rX, expectedMatrix).multiplyMatrixMatrix(rY, expectedMatrix).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using ZXY ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZXY, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rY.multiplyMatrixMatrix(rX, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using ZYX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using YZX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YZX, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rZ, expectedMatrix).multiplyMatrixMatrix(rY, expectedMatrix).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using XZY ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XZY, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rY.multiplyMatrixMatrix(rZ, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix).transpose();
    ck.testMatrix3d(matrix, expectedMatrix);

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.toMatrix3dRowBasedUsingTransposeOfClassicBaseMatrixes", () => {
    const ck = new Checker();
    let x = 0, y = 0, z = 0;
    // we don't need the following line because default is false. It's added just for clarity.
    OrderedRotationAngles.treatVectorsAsColumns = false;

    // No Rotation
    const angles = OrderedRotationAngles.createDegrees(x, y, z, AxisOrder.XYZ);
    const matrix = angles.toMatrix3d();
    ck.testTrue(matrix.isIdentity);

    // One Rotation (45 degrees around X axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(45),
      Angle.createDegrees(0),
      Angle.createDegrees(0),
      AxisOrder.YXZ, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    let expectedMatrix = Matrix3d.createRowValues(
      1, 0, 0,
      0, angles.xAngle.cos(), angles.xAngle.sin(),
      0, -angles.xAngle.sin(), angles.xAngle.cos(),
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // One Rotation (45 degrees around Y axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(0),
      Angle.createDegrees(45),
      Angle.createDegrees(0),
      AxisOrder.XYZ, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    expectedMatrix = Matrix3d.createRowValues(
      angles.yAngle.cos(), 0, -angles.yAngle.sin(),
      0, 1, 0,
      angles.yAngle.sin(), 0, angles.yAngle.cos(),
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // One Rotation (45 degrees around Z axis)
    OrderedRotationAngles.createAngles(
      Angle.createDegrees(0),
      Angle.createDegrees(0),
      Angle.createDegrees(45),
      AxisOrder.ZXY, // order does not matter because we only rotate around one axis
      undefined,
      angles,
    );
    angles.toMatrix3d(matrix);
    expectedMatrix = Matrix3d.createRowValues(
      angles.zAngle.cos(), angles.zAngle.sin(), 0,
      -angles.zAngle.sin(), angles.zAngle.cos(), 0,
      0, 0, 1,
    );
    ck.testMatrix3d(matrix, expectedMatrix);

    // Three Rotations
    x = Math.PI / 3, y = Math.PI, z = 1.91986;  // 60, 180, and 110 degrees
    // Transpose of the three classic "base rotation matrixes" (row-based from)
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

    /**
    * Note: for the following checks the AxisOrder is same as
    * matrix multiplication because we used columns-based from
    */
    // Rotation using XYZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using YXZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YXZ, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rY.multiplyMatrixMatrix(rX, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using ZXY ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZXY, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rX, expectedMatrix).multiplyMatrixMatrix(rY, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using ZYX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using YZX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YZX, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rY.multiplyMatrixMatrix(rZ, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    // Rotation using XZY ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XZY, undefined, angles);
    angles.toMatrix3d(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rZ, expectedMatrix).multiplyMatrixMatrix(rY, expectedMatrix);
    ck.testMatrix3d(matrix, expectedMatrix);

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAnglesVersusYawPitchRollWithDefaultRotation", () => {
    const ck = new Checker();
    const degreesChoices = [Angle.createDegrees(0.0), Angle.createDegrees(10.0), Angle.createDegrees(5.0), Angle.createDegrees(15.0)];
    const unitX = Vector3d.unitX();
    const unitY = Vector3d.unitY();
    const unitZ = Vector3d.unitZ();
    /**
    * Confirm that ypr matrix matches OrientedRotationAngles matrix for
    * AxisOrder.XYZ
    * treatVectorsAsColumns = true
    * X = roll, Y = negated pitch, Z = yaw
    * xyzRotationIsClockwise = [false, false, false]
    */
    OrderedRotationAngles.treatVectorsAsColumns = true;
    for (const rollAngle of degreesChoices) {
      // this is ROLL
      const matrixX = Matrix3d.createRotationAroundVector(unitX, rollAngle)!;
      for (const pitchAngle of degreesChoices) {
        // this is PITCH
        const matrixY = Matrix3d.createRotationAroundVector(unitY, pitchAngle)!;
        matrixY.transposeInPlace();   // PITCH is NEGATIVE Y
        for (const yawAngle of degreesChoices) {
          // this is YAW
          const matrixZ = Matrix3d.createRotationAroundVector(unitZ, yawAngle)!;

          const matrixZYX = matrixZ.multiplyMatrixMatrix(matrixY.multiplyMatrixMatrix(matrixX));
          const ypr = YawPitchRollAngles.createRadians(yawAngle.radians, pitchAngle.radians, rollAngle.radians);
          const yprMatrix = ypr.toMatrix3d();
          if (!ck.testCoordinate(0, yprMatrix.maxDiff(matrixZYX))) {
            GeometryCoreTestIO.consoleLog(`${JSON.stringify(ypr.toJSON())} maxDiff ypr:(Z)(-Y)(X)   ${yprMatrix.maxDiff(matrixZYX)}`);
            GeometryCoreTestIO.consoleLog("ypr matrix", yprMatrix);
            GeometryCoreTestIO.consoleLog("matrixZYX", matrixZYX);
          }

          const orderedAngles = OrderedRotationAngles.createDegrees(
            rollAngle.degrees,
            -pitchAngle.degrees,
            yawAngle.degrees,
            AxisOrder.XYZ,
          );
          const orderedMatrix = orderedAngles.toMatrix3d();
          if (!ck.testMatrix3d(yprMatrix, orderedMatrix)) {
            GeometryCoreTestIO.consoleLog(`${JSON.stringify(ypr.toJSON())} maxDiff ypr:(Z)(-Y)(X)   ${yprMatrix.maxDiff(orderedMatrix)}`);
            GeometryCoreTestIO.consoleLog("ypr matrix", yprMatrix);
            GeometryCoreTestIO.consoleLog("orderedMatrix", orderedMatrix);
          }
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  }),
    it("OrderedRotationAnglesVersusYawPitchRollWithNonDefaultRotation", () => {
      const ck = new Checker();
      const degreesChoices = [Angle.createDegrees(0.0), Angle.createDegrees(10.0), Angle.createDegrees(5.0), Angle.createDegrees(15.0)];
      const unitX = Vector3d.unitX();
      const unitY = Vector3d.unitY();
      const unitZ = Vector3d.unitZ();
      /**
      * Confirm that ypr matrix matches OrientedRotationAngles matrix for
      * AxisOrder.XYZ
      * treatVectorsAsColumns = true
      * X = roll, Y = pitch, Z = yaw
      * xyzRotationIsClockwise = [false, true, false]
      */
      OrderedRotationAngles.treatVectorsAsColumns = true;
      for (const rollAngle of degreesChoices) {
        // this is ROLL
        const matrixX = Matrix3d.createRotationAroundVector(unitX, rollAngle)!;
        for (const pitchAngle of degreesChoices) {
          // this is PITCH
          const matrixY = Matrix3d.createRotationAroundVector(unitY, pitchAngle)!;
          matrixY.transposeInPlace();   // PITCH is NEGATIVE Y
          for (const yawAngle of degreesChoices) {
            // this is YAW
            const matrixZ = Matrix3d.createRotationAroundVector(unitZ, yawAngle)!;

            const matrixZYX = matrixZ.multiplyMatrixMatrix(matrixY.multiplyMatrixMatrix(matrixX));
            const ypr = YawPitchRollAngles.createRadians(yawAngle.radians, pitchAngle.radians, rollAngle.radians);
            const yprMatrix = ypr.toMatrix3d();
            if (!ck.testCoordinate(0, yprMatrix.maxDiff(matrixZYX))) {
              GeometryCoreTestIO.consoleLog(`${JSON.stringify(ypr.toJSON())} maxDiff ypr:(Z)(-Y)(X)   ${yprMatrix.maxDiff(matrixZYX)}`);
              GeometryCoreTestIO.consoleLog("ypr matrix", yprMatrix);
              GeometryCoreTestIO.consoleLog("matrixZYX", matrixZYX);
            }

            const xyzRotationIsClockwise: [boolean, boolean, boolean] = [false, true, false];
            const orderedAngles = OrderedRotationAngles.createDegrees(
              rollAngle.degrees,
              pitchAngle.degrees,
              yawAngle.degrees,
              AxisOrder.XYZ,
              xyzRotationIsClockwise,
            );
            const orderedMatrix = orderedAngles.toMatrix3d();
            if (!ck.testMatrix3d(yprMatrix, orderedMatrix)) {
              GeometryCoreTestIO.consoleLog(`${JSON.stringify(ypr.toJSON())} maxDiff ypr:(Z)(-Y)(X)   ${yprMatrix.maxDiff(orderedMatrix)}`);
              GeometryCoreTestIO.consoleLog("ypr matrix", yprMatrix);
              GeometryCoreTestIO.consoleLog("orderedMatrix", orderedMatrix);
            }
          }
        }
      }
      expect(ck.getNumErrors()).equals(0);
    });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.createFromMatrix3dColumnBased", () => {
    const ck = new Checker();
    const x = 0.0174533, y = 0.698132, z = Math.PI / 2; // 1, 40, and 90 degrees
    OrderedRotationAngles.treatVectorsAsColumns = true;

    // No Rotation
    const matrix = Matrix3d.createIdentity();
    const angles = OrderedRotationAngles.createFromMatrix3d(matrix, AxisOrder.XYZ); // order doesn't matter
    const expectedAngles = OrderedRotationAngles.createRadians(0, 0, 0, AxisOrder.XYZ);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // The three classic "base rotation matrixes" (column-based from)
    const rX = Matrix3d.createRowValues(
      1, 0, 0,
      0, Math.cos(x), -Math.sin(x),
      0, Math.sin(x), Math.cos(x),
    );
    const rY = Matrix3d.createRowValues(
      Math.cos(y), 0, Math.sin(y),
      0, 1, 0,
      -Math.sin(y), 0, Math.cos(y),
    );
    const rZ = Matrix3d.createRowValues(
      Math.cos(z), -Math.sin(z), 0,
      Math.sin(z), Math.cos(z), 0,
      0, 0, 1,
    );

    // One Rotation (order doesn't matter)
    OrderedRotationAngles.createFromMatrix3d(rX, AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(x, 0, 0, AxisOrder.XYZ, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);
    OrderedRotationAngles.createFromMatrix3d(rY, AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(0, y, 0, AxisOrder.XYZ, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);
    OrderedRotationAngles.createFromMatrix3d(rZ, AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(0, 0, z, AxisOrder.XYZ, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // Three Rotations
    const rZrYrX = rZ.multiplyMatrixMatrix(rY).multiplyMatrixMatrix(rX);
    OrderedRotationAngles.createFromMatrix3d(rZrYrX, AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rZrXrY = rZ.multiplyMatrixMatrix(rX).multiplyMatrixMatrix(rY);
    OrderedRotationAngles.createFromMatrix3d(rZrXrY, AxisOrder.YXZ, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YXZ, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rYrXrZ = rY.multiplyMatrixMatrix(rX).multiplyMatrixMatrix(rZ);
    OrderedRotationAngles.createFromMatrix3d(rYrXrZ, AxisOrder.ZXY, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZXY, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rXrYrZ = rX.multiplyMatrixMatrix(rY).multiplyMatrixMatrix(rZ);
    OrderedRotationAngles.createFromMatrix3d(rXrYrZ, AxisOrder.ZYX, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rXrZrY = rX.multiplyMatrixMatrix(rZ).multiplyMatrixMatrix(rY);
    OrderedRotationAngles.createFromMatrix3d(rXrZrY, AxisOrder.YZX, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YZX, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rYrZrX = rY.multiplyMatrixMatrix(rZ).multiplyMatrixMatrix(rX);
    OrderedRotationAngles.createFromMatrix3d(rYrZrX, AxisOrder.XZY, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XZY, undefined, expectedAngles);
    if (ck.testDefined(angles) && angles)
      testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("OrderedRotationAngles", () => {
  it("OrderedRotationAngles.createFromMatrix3dRowBased", () => {
    const ck = new Checker();
    const x = 0.0174533, y = 0.698132, z = Math.PI / 2; // 1, 40, and 90 degrees
    OrderedRotationAngles.treatVectorsAsColumns = false;

    // No Rotation
    const matrix = Matrix3d.createIdentity();
    const angles = OrderedRotationAngles.createFromMatrix3d(matrix, AxisOrder.XYZ)!; // order doesn't matter
    const expectedAngles = OrderedRotationAngles.createRadians(0, 0, 0, AxisOrder.XYZ);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // The three classic "base rotation matrixes" (column-based from)
    const rX = Matrix3d.createRowValues(
      1, 0, 0,
      0, Math.cos(x), -Math.sin(x),
      0, Math.sin(x), Math.cos(x),
    );
    const rY = Matrix3d.createRowValues(
      Math.cos(y), 0, Math.sin(y),
      0, 1, 0,
      -Math.sin(y), 0, Math.cos(y),
    );
    const rZ = Matrix3d.createRowValues(
      Math.cos(z), -Math.sin(z), 0,
      Math.sin(z), Math.cos(z), 0,
      0, 0, 1,
    );

    // One Rotation (order doesn't matter)
    OrderedRotationAngles.createFromMatrix3d(rX.transpose(), AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(x, 0, 0, AxisOrder.XYZ, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);
    OrderedRotationAngles.createFromMatrix3d(rY.transpose(), AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(0, y, 0, AxisOrder.XYZ, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);
    OrderedRotationAngles.createFromMatrix3d(rZ.transpose(), AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(0, 0, z, AxisOrder.XYZ, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // Three Rotations
    const rZrYrX = rZ.multiplyMatrixMatrix(rY).multiplyMatrixMatrix(rX).transpose();
    OrderedRotationAngles.createFromMatrix3d(rZrYrX, AxisOrder.XYZ, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rZrXrY = rZ.multiplyMatrixMatrix(rX).multiplyMatrixMatrix(rY).transpose();
    OrderedRotationAngles.createFromMatrix3d(rZrXrY, AxisOrder.YXZ, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YXZ, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rYrXrZ = rY.multiplyMatrixMatrix(rX).multiplyMatrixMatrix(rZ).transpose();
    OrderedRotationAngles.createFromMatrix3d(rYrXrZ, AxisOrder.ZXY, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZXY, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rXrYrZ = rX.multiplyMatrixMatrix(rY).multiplyMatrixMatrix(rZ).transpose();
    OrderedRotationAngles.createFromMatrix3d(rXrYrZ, AxisOrder.ZYX, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rXrZrY = rX.multiplyMatrixMatrix(rZ).multiplyMatrixMatrix(rY).transpose();
    OrderedRotationAngles.createFromMatrix3d(rXrZrY, AxisOrder.YZX, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.YZX, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    const rYrZrX = rY.multiplyMatrixMatrix(rZ).multiplyMatrixMatrix(rX).transpose();
    OrderedRotationAngles.createFromMatrix3d(rYrZrX, AxisOrder.XZY, angles);
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XZY, undefined, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    expect(ck.getNumErrors()).equals(0);
  });
});
