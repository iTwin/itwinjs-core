/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point2d, Vector3d, Point3d } from "../PointVector";
import { RotMatrix } from "../Transform";
import { Transform } from "../Transform";
import { Angle, AxisOrder, Geometry, AxisIndex } from "../Geometry";
import { Sample } from "../serialization/GeometrySamples";
import { Checker } from "./Checker";
// import { prettyPrint } from "./testFunctions";
import { expect } from "chai";
/* tslint:disable:no-console */

function verifyInverseGo(ck: Checker, matrixA: RotMatrix) {
  const vectorY = Vector3d.create(1, 2, 3);
  const vectorX = matrixA.multiplyInverse(vectorY);
  if (vectorX) {
    const vectorAX = matrixA.multiplyVector(vectorX);
    ck.testVector3d(vectorY, vectorAX, "AX=B solution");
    const matrixB = matrixA.inverse();
    if (ck.testPointer(matrixB, "matrix has inverse") && matrixB) {
      const matrixAB = matrixA.multiplyMatrixMatrix(matrixB);
      ck.testTrue(matrixAB.isIdentity(), "verify A*Ainv is identity");
    }

  }
}
// input a newly created rotmatrix.
function verifyRotMatrixInverseProperties(ck: Checker, matrixA: RotMatrix) {

  verifyInverseGo(ck, matrixA);
  verifyInverseGo(ck, matrixA.clone());
  const matrixB = RotMatrix.createIdentity();
  matrixB.setFrom(matrixA);
  verifyInverseGo(ck, matrixB);

  // make changes -- if not properly marked, inverseGo will get caught with old inverse ...
  matrixA.setRow(0, Vector3d.create(1, 2, 3));
  verifyInverseGo(ck, matrixA);
}
describe("RotMatrix", () => {
  it("CachedInverse", () => {
    const ck = new Checker();

    verifyRotMatrixInverseProperties(ck, RotMatrix.createIdentity());
    verifyRotMatrixInverseProperties(ck, RotMatrix.createScale(2, 3, 4));
    verifyRotMatrixInverseProperties(ck, RotMatrix.createRotationAroundVector(Vector3d.create(1, 2, 3), Angle.createDegrees(32))!);
    verifyRotMatrixInverseProperties(ck, RotMatrix.createRowValues(
      10, 1, 2,
      3, 20, 1,
      4, 2, 15));
    ck.checkpoint("RotMatrix.CachedInverse");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ColumnAccess", () => {
    const ck = new Checker();
    const vectorQ = Vector3d.create(1.789, 2.9, -0.33);
    for (const matrix of Sample.createRotMatrixArray()) {
      const columnX = matrix.columnX();
      const columnY = matrix.columnY();
      const columnZ = matrix.columnZ();

      ck.testCoordinate(columnX.magnitude(), matrix.columnXMagnitude());
      ck.testCoordinate(columnY.magnitude(), matrix.columnYMagnitude());
      ck.testCoordinate(columnZ.magnitude(), matrix.columnZMagnitude());

      ck.testCoordinate(columnX.dotProduct(vectorQ), matrix.dotColumnX(vectorQ));
      ck.testCoordinate(columnY.dotProduct(vectorQ), matrix.dotColumnY(vectorQ));
      ck.testCoordinate(columnZ.dotProduct(vectorQ), matrix.dotColumnZ(vectorQ));
    }
    ck.checkpoint("RotMatrix.ColumnAccess");
    expect(ck.getNumErrors()).equals(0);
  });

  it("RowAccess", () => {
    const ck = new Checker();
    const vectorQ = Vector3d.create(1.789, 2.9, -0.33);
    for (const matrix of Sample.createRotMatrixArray()) {
      const rowX = matrix.rowX();
      const rowY = matrix.rowY();
      const rowZ = matrix.rowZ();

      ck.testCoordinate(rowX.magnitude(), matrix.rowXMagnitude());
      ck.testCoordinate(rowY.magnitude(), matrix.rowYMagnitude());
      ck.testCoordinate(rowZ.magnitude(), matrix.rowZMagnitude());

      ck.testCoordinate(rowX.dotProduct(vectorQ), matrix.dotRowX(vectorQ));
      ck.testCoordinate(rowY.dotProduct(vectorQ), matrix.dotRowY(vectorQ));
      ck.testCoordinate(rowZ.dotProduct(vectorQ), matrix.dotRowZ(vectorQ));
    }
    ck.checkpoint("RotMatrix.RowAccess");
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("AxisOrder.Verify", () => {
  it("Test1", () => {
    const ck = new Checker();
    for (const axisOrder of [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX]) {
      if (Checker.noisy.axisOrderVerify)
        console.log("AxisOrder", axisOrder,
          Geometry.axisOrderToAxis(axisOrder, 0),
          Geometry.axisOrderToAxis(axisOrder, 1),
          Geometry.axisOrderToAxis(axisOrder, 2));

      const axis0 = Geometry.axisOrderToAxis(axisOrder, 0);
      const axis1 = Geometry.axisOrderToAxis(axisOrder, 1);
      const axis2 = Geometry.axisOrderToAxis(axisOrder, 2);
      const shift = axisOrder as number <= 2 ? 1 : 2;
      // axisOrder 0,1,2 are cyclic forms of 012.
      // axis order 3,4,5 are cyclic forms of 021
      ck.testExactNumber(axis1, Geometry.cyclic3dAxis(axis0 + shift));
      ck.testExactNumber(axis2, Geometry.cyclic3dAxis(axis1 + shift));
      ck.testExactNumber(axis0, Geometry.cyclic3dAxis(axis2 + shift));

      ck.checkpoint("AxisOrder.Verify");
      expect(ck.getNumErrors()).equals(0);
    }
  });
});

function verifyRigidScale(ck: Checker, candidate: RotMatrix, expectedScale: number, expectRigid: boolean) {
  // console.log ("VerifyRigid " + prettyPrint (candidate) + "expect" + expectedScale);
  const data = candidate.factorRigidWithSignedScale();
  if (!expectRigid) {
    ck.testUndefined(data, "confirm not rigid with scale");
    return;
  }
  if (ck.testPointer(data, "Expect factorRigidScale") && data) {
    ck.testCoordinate(expectedScale, data.scale);
    candidate.factorRigidWithSignedScale();
    ck.testTrue(data.rigidAxes.isRigid(), "confirm rigid axes");
    const matrixB = data.rigidAxes.scale(data.scale);
    ck.testRotMatrix(candidate, matrixB);
  }
}

describe("RotMatrix.Factors", () => {
  it("FactorRigidScale", () => {
    const ck = new Checker();
    const rotations = Sample.createRigidAxes();
    for (const rigid of rotations) {
      ck.testTrue(rigid.isRigid(), "verify rigid");
      for (const scale of [2, -1, -2]) {
        verifyRigidScale(ck, rigid.scale(scale), scale, true);
        verifyRigidScale(ck, rigid.scaleColumns(scale, scale, scale * 1.3), 1.0, false);
        verifyRigidScale(ck, rigid.scaleColumns(scale, -1.0 * scale, scale), -scale, true);
      }
    }
    ck.checkpoint("RotMatrix.FactorRigidScale");
    expect(ck.getNumErrors()).equals(0);
  });

  it("AxisAndAngleOfRotationA", () => {
    const ck = new Checker();
    const rotations = Sample.createRigidAxes();
    for (const rigid of rotations) {
      ck.testTrue(rigid.isRigid(), "verify rigid");
      const data = rigid.getAxisAndAngleOfRotation();
      if (ck.testTrue(data.ok, "Extract axis and angle")) {
        const rigid1 = RotMatrix.createRotationAroundVector(data.axis, data.angle);
        if (ck.testPointer(rigid1) && rigid1)
          ck.testRotMatrix(rigid, rigid1, "round trip roation around vector");
      }
    }
    ck.checkpoint("RotMatrix.AxisAndAngleOfRotationA");
    expect(ck.getNumErrors()).equals(0);
  });

  it("AxisAndAngleOfRotationB", () => {
    const ck = new Checker();
    const rotationVectors = Sample.createNonZeroVectors();
    let maxDiff12 = 0;
    for (const axis of rotationVectors) {
      if (Checker.noisy.rotMatrixAxisAndAngle)
        console.log("*************************************************axis ", axis);
      for (const degrees of [0.01, 10, -14, 78, 128, 0.01, 0.328]) {
        if (Checker.noisy.rotMatrixAxisAndAngle)
          console.log("            ****degrees " + degrees);
        const matrix1 = RotMatrix.createRotationAroundVector(axis, Angle.createDegrees(degrees))!;
        /*
        const data3 = getAxisAndAngleOfRotationByDirectFactors(matrix1);
        // remark: don't directly compare data.axis and axis -- they might be negated !!!
        // instead check that data generates the same matrix.
        const matrix3 = RotMatrix.createRotationAroundVector(data3.axis, data3.angle);
        if (ck.testFalse(data3.error, "data3 ok" + degrees)) {
          if (ck.testPointer(matrix3, "good data for createRotation") && matrix3)
            ck.testRotMatrix(matrix1, matrix3, "AxisAngle3 maps to same RotMatrix");
        }
*/
        const data2 = matrix1.getAxisAndAngleOfRotation();
        // remark: don't directly compare data.axis and axis -- they might be negated !!!
        // instead check that data generates the same matrix.
        const matrix2 = RotMatrix.createRotationAroundVector(data2.axis, data2.angle);
        if (ck.testTrue(data2.ok, "data2 ok" + degrees)) {
          if (ck.testPointer(matrix2, "good data for createRotation") && matrix2)
            ck.testRotMatrix(matrix1, matrix2, "AxisAngle2 maps to same RotMatrix");
        }

        if (matrix2) {
          const a12 = matrix2.maxDiff(matrix1);

          if (Checker.noisy.rotMatrixAxisAndAngle)
            console.log("matrix1.maxDiff (matrix2) ", a12);
          maxDiff12 = Math.max(maxDiff12, a12);
        }
      }
    }
    console.log(" matrix reconstruction max deviation: a12 " + maxDiff12);
    ck.checkpoint("RotMatrix.AxisAndAngleOfRotationB");
    expect(ck.getNumErrors()).equals(0);
  });
});

function modifyPitchAngleToPreventInversion(radians: number): number { return radians; }
// matrix construction to duplicate native dgnplatform method NavigateMotion::GenerateRotationTransform
// the matrix product expands to:
// yawMatrix * invViewRotation * pitchMatrix * viewRotation
function GenerateRotationTransform(eyePoint: Point3d, viewRotation: RotMatrix, yawRadiansPerTime: number, pitchRateRadiansPerTime: number, time: number): Transform {
  const yawAngle = Angle.createRadians(yawRadiansPerTime * time);
  const pitchAngle = Angle.createRadians(modifyPitchAngleToPreventInversion(pitchRateRadiansPerTime * time));

  let invViewRotation = viewRotation.inverse(); // m_viewport->GetRotMatrix());
  if (!invViewRotation)
    invViewRotation = RotMatrix.createIdentity();

  const pitchMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitX(), pitchAngle)!;

  const pitchTimesView = pitchMatrix.multiplyMatrixMatrix(viewRotation);
  const inverseViewTimesPitchTimesView = invViewRotation.multiplyMatrixMatrix(pitchTimesView);

  const yawMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), yawAngle)!;

  const yawTimesInverseViewTimesPitchTimesView = yawMatrix.multiplyMatrixMatrix(inverseViewTimesPitchTimesView);
  const transform = Transform.createFixedPointAndMatrix(eyePoint, yawTimesInverseViewTimesPitchTimesView); /// m_viewport->GetCamera().GetEyePoint());
  return transform;
}

function testRotateVectorAroundVector(vector: Vector3d, axis: Vector3d, angle: Angle, ck: Checker) {
  const result = Vector3d.createRotateVectorAroundVector(vector, axis, angle);
  const isParallel = vector.isParallelTo(axis);
  ck.testTrue(!isParallel, "Vector parallel to axis");
  if (isParallel && result) {   // Result could be undefined
    const vector1 = result.clone();
    const radians1 = vector.planarRadiansTo(vector1, axis);
    ck.testTrue(Angle.isAlmostEqualRadiansAllowPeriodShift(angle.radians, radians1), "rotation angle in plane perp to axis");
    ck.testAngleAllowShift(axis.angleTo(vector), axis.angleTo(vector1), "angle from rotation axis");
    ck.testCoordinate(vector.magnitude(), vector1.magnitude(), "rotation does not change magnitude");
  }
}

function testRotateVectorToVector(vectorA: Vector3d, vectorB: Vector3d, ck: Checker) {
  const matrix = RotMatrix.createRotationVectorToVector(vectorA, vectorB);
  const fraction = 0.2;

  ck.testPointer(matrix);
  if (matrix) {
    const matrix0 = RotMatrix.createPartialRotationVectorToVector(vectorA, fraction, vectorB)!;
    const matrix1 = RotMatrix.createPartialRotationVectorToVector(vectorA, 1.0 - fraction, vectorB)!;
    ck.testTrue(matrix.isRigid(), "Rigid rotation");
    const vectorB1 = matrix.multiplyVector(vectorA);
    ck.testParallel(vectorB, vectorB1);
    ck.testRotMatrix(matrix, matrix0.multiplyMatrixMatrix(matrix1), "partial rotations accumulate");
  }
}

describe("RotMatrix.ViewConstructions", () => {
  it("FactorRigidScale", () => {
    const ck = new Checker();
    const eyePoint = Point3d.create(10, 15, 23);
    const viewRotation = RotMatrix.createRotationAroundVector(Vector3d.create(1, 2, 3), Angle.createRadians(0.23))!;
    const yawRateRadiansPerTime = 0.5;
    const pitchRateRadiansPerTime = 0.25;
    const time = 0.1;
    const nativeTransform = Transform.createRefs(
      Vector3d.create(
        0.88610832476555645,
        0.060080207464391355,
        -0.40375557735756828),
      RotMatrix.createRowValues(
        0.99857861707557882, -0.053201794397914448, -0.0032116338935924771,
        0.053107143509079233, 0.99828614780495017, -0.024584515636062437,
        0.004514069974036361, 0.024379010923246527, 0.99969259625080453,
      ));
    const transform = GenerateRotationTransform(eyePoint, viewRotation, yawRateRadiansPerTime, pitchRateRadiansPerTime, time);
    ck.testRotMatrix(nativeTransform.matrix, transform.matrix);
    ck.testXYZ(nativeTransform.origin, transform.origin);

  });

  it("RotateVectorAroundVector", () => {
    const ck = new Checker();
    testRotateVectorAroundVector(Vector3d.create(1, 0, 0), Vector3d.create(0, 0, 1), Angle.createDegrees(25.0), ck);
    testRotateVectorAroundVector(Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), Angle.createDegrees(-49.0), ck);
    testRotateVectorAroundVector(Vector3d.create(1, 2, 4), Vector3d.create(5, -2, 1), Angle.createDegrees(25.2), ck);
    ck.checkpoint("RotateVectorAroundVector");
    expect(ck.getNumErrors()).equals(0);
  });

  it("RotateVectorToVector", () => {
    const ck = new Checker();
    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(0, 0, 1), ck);
    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), ck);
    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(1, 0, 0), ck);
    const vectorA = Vector3d.create(1, 2, 3);
    const vectorB = Vector3d.create(4, 2, 9);
    const vectorANeg = vectorA.scale(-2);
    testRotateVectorToVector(vectorA, vectorB, ck);
    testRotateVectorToVector(vectorA, vectorANeg, ck);
    ck.checkpoint("RotateVectorToVector");
    expect(ck.getNumErrors()).equals(0);
  });

  it("RotateAroundAxis", () => {
    const ck = new Checker();
    ck.testRotMatrix(
      RotMatrix.create90DegreeRotationAroundAxis(0),
      RotMatrix.createRotationAroundVector(Vector3d.unitX(), Angle.createDegrees(90))!, "Rotate 90 X");
    ck.testRotMatrix(
      RotMatrix.create90DegreeRotationAroundAxis(1),
      RotMatrix.createRotationAroundVector(Vector3d.unitY(), Angle.createDegrees(90))!, "Rotate 90 Y");
    ck.testRotMatrix(
      RotMatrix.create90DegreeRotationAroundAxis(2),
      RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(90))!, "Rotate 90 Z");
    ck.checkpoint("RotateAroundAxis");
    expect(ck.getNumErrors()).equals(0);

    for (const degrees of [0.0, 10.0, -40.0]) {
      const theta = Angle.createDegrees(degrees);
      ck.testRotMatrix(
        RotMatrix.createRotationAroundAxisIndex(AxisIndex.X, theta),
        RotMatrix.createRotationAroundVector(Vector3d.unitX(), theta)!, "Rotate theta X");
      ck.testRotMatrix(
        RotMatrix.createRotationAroundAxisIndex(AxisIndex.Y, theta),
        RotMatrix.createRotationAroundVector(Vector3d.unitY(), theta)!, "Rotate 90 Y");
      ck.testRotMatrix(
        RotMatrix.createRotationAroundAxisIndex(AxisIndex.Z, theta),
        RotMatrix.createRotationAroundVector(Vector3d.unitZ(), theta)!, "Rotate 90 Z");
      ck.checkpoint("RotateAroundAxis");
    }
    expect(ck.getNumErrors()).equals(0);

  });

  it("RowColumn", () => {
    const ck = new Checker();
    const vectorX = Vector3d.create(1, 2, 4);
    const vectorY = Vector3d.create(3, 9, 27);
    const vectorZ = Vector3d.create(5, 25, 125);
    const byRow = RotMatrix.createRows(vectorX, vectorY, vectorZ);
    const byRow1 = byRow.clone();
    byRow1.normalizeRowsInPlace();
    for (const i of [0, 1, 2]) {
      const v0 = byRow.getRow(i);
      const v1 = byRow1.getRow(i);
      ck.testCoordinate(v1.magnitude(), 1, "normalized row" + i);
      ck.testCoordinate(v0.magnitude(), v0.dotProduct(v1), "scaling" + i);
    }

    const byColumn = RotMatrix.createColumns(vectorX, vectorY, vectorZ);
    const fillByIndex = RotMatrix.createZero();
    let qMax = 0;
    for (const i of [0, 1, 2]) {
      ck.testVector3d(byColumn.getColumn(i), byRow.getRow(i), "row, column vector access");
      for (const j of [0, 1, 2]) {
        ck.testExactNumber(byRow.at(i, j), byColumn.at(j, i), "ij" + i + " " + j);
        const q = byRow.at(i, j);
        qMax = Geometry.maxAbsXYZ(q, qMax, 0);
        fillByIndex.setAt(i, j, byRow.at(i, j));
        ck.testExactNumber(qMax, fillByIndex.maxAbs(), "evolving maxabs");
      }
    }
    ck.testRotMatrix(byRow, fillByIndex, "clone by setAt");
    ck.testRotMatrix(byRow, byColumn.transpose(), "Row, column create and transpose");

    const transposeDiff = byRow.clone();
    transposeDiff.addScaledInPlace(byColumn, -1.0);
    ck.testCoordinate(transposeDiff.sumSquares(), 2.0 * byColumn.sumSkewSquares(), "skew squares");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SgnedPerumtation", () => {
    const ck = new Checker();
    const unitX = Vector3d.unitX();
    const unitY = Vector3d.unitY();

    const orderList = [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX];
    const signList = [1, 1, 1, -1, -1, -1];
    const shiftValue = 0.02;
    for (let i = 0; i < orderList.length; i++) {
      const axisOrder = orderList[i];
      const sign = signList[i];
      const matrix = RotMatrix.createRigidFromColumns(unitX, unitY, axisOrder)!;
      ck.testCoordinate(sign, matrix.determinant(), "determinant of permutation");
      ck.testTrue(matrix.isSignedPermutation(), "confirm signed permutation");
      // muddy up one indexed entry at a time . . .
      for (let k = 0; k < 9; k++) {
        const matrixA = matrix.clone();
        const ak = matrixA.coffs[k];
        matrixA.coffs[k] += shiftValue;
        ck.testFalse(matrixA.isSignedPermutation(), "confirm not signed permutation");
        if (ak !== 1.0) {
          matrixA.coffs[k] = 1;
          ck.testFalse(matrixA.isSignedPermutation(), "confirm not signed permutation");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("ScaleAlongVector", () => {
    const ck = new Checker();
    for (const perpVector of [Vector3d.create(0, 0, 1), Vector3d.create(1, 2, 4)]) {
      perpVector.normalizeInPlace();
      const vectors = Sample.createNonZeroVectors();
      const projector = RotMatrix.createDirectionalScale(perpVector, 0.0);
      for (const scale of [2, 1, -1, -5]) {
        const matrix = RotMatrix.createDirectionalScale(perpVector, scale);
        for (const vectorA of vectors) {
          const vector0 = projector.multiplyVector(vectorA);
          const vectorB = matrix.multiplyVector(vectorA);
          const vector0A = Vector3d.createStartEnd(vector0, vectorA);
          const vector0B = Vector3d.createStartEnd(vector0, vectorB);
          const vector0AScaled = vector0A.scale(scale);
          ck.testTrue(vector0.isPerpendicularTo(vector0A, true), "projector");
          ck.testTrue(vector0.isPerpendicularTo(vector0B, true), "projector");
          ck.testVector3d(vector0B, vector0AScaled, "scale projection");
        }
      }
      // in place !!!
      projector.multiplyVectorArrayInPlace(vectors);
      for (const v of vectors) {
        ck.testTrue(v.isPerpendicularTo(perpVector, true), "perpendicular projection");
        ck.testTrue(v.isPerpendicularTo(perpVector, true), "perpendicular projection");
      }

    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("MultiplyXY", () => {
    const ck = new Checker();
    const perpVector = Vector3d.create(1, 2, 4);
    perpVector.normalizeInPlace();
    const vectors = Sample.createNonZeroVectors();
    const projector = RotMatrix.createDirectionalScale(perpVector, -1.0);
    const columnX = projector.columnX();
    const columnY = projector.columnY();
    const origin = Point2d.create(4, 3);
    columnX.z = columnY.z = 0.0;
    for (const v of vectors) {
      const xy1 = RotMatrix.XYPlusMatrixTimesXY(origin, projector, v);
      const xy2 = origin.plus2Scaled(columnX, v.x, columnY, v.y);
      ck.testPoint2d(xy1, xy2);

      const v2 = projector.multiplyTransposeVector(v);
      const v3 = projector.multiplyTransposeXYZ(v.x, v.y, v.z);
      ck.testVector3d(v2, v3);

      const v4 = v.clone();
      const v5 = v.clone();
      projector.multiplyVectorInPlace(v4);
      projector.multiplyTransposeVectorInPlace(v5);
      ck.testVector3d(v4, projector.multiplyVector(v));
      ck.testVector3d(v5, projector.multiplyTransposeVector(v));

      const v4a = projector.multiplyInverseXYZAsVector3d(v4.x, v4.y, v4.z)!;
      ck.testVector3d(v4a, v, "multiply, multiplyInverseXYZAsVector");
      ck.testXYZ(v4a, projector.multiplyInverseXYZAsPoint3d(v4.x, v4.y, v4.z)!);

    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("AxisOrderConstructions", () => {
    const ck = new Checker();
    const perpVector = Vector3d.create(1, 2, 4);
    perpVector.normalizeInPlace();
    const scale = -2.9;
    const projector = RotMatrix.createDirectionalScale(perpVector, scale);
    const orderList = [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX];
    const signList = [1, 1, 1, -1, -1, -1];
    for (let i = 0; i < orderList.length; i++) {
      const axisOrder = orderList[i];
      const sign = signList[i];
      const frame = projector.clone();
      frame.axisOrderCrossProductsInPlace(axisOrder);
      ck.testTrue(sign * frame.determinant() > 0.0);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Misc", () => {
    const ck = new Checker();
    let epsilon = 0.0001;
    const matrixA = RotMatrix.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const matrixA1 = matrixA.clone();
    ck.testTrue(matrixA.isExactEqual(matrixA1));
    for (let i = 0; i < 9; i++) {
      matrixA.clone(matrixA1);
      ck.testTrue(matrixA.isExactEqual(matrixA1));
      matrixA1.coffs[i] += epsilon;
      epsilon = - epsilon;
      ck.testFalse(matrixA1.isAlmostEqual(matrixA), "exact equal after perturrb");
    }

    const matrixXY = RotMatrix.createRowValues(1, 2, 0, 3, 4, 0, 0, 0, 1); // all effects are xy
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        matrixXY.clone(matrixA1);
        ck.testTrue(matrixA1.isXY(), "xy matrix");
        if (i === 2 || j === 2) {
          matrixA1.setAt(i, j, matrixA1.at(i, j) + epsilon);
          ck.testFalse(matrixA1.isXY(), "xy matrix perturbed");

        }
      }
    }

    expect(ck.getNumErrors()).equals(0);
  });

  it("JSON", () => {
    const ck = new Checker();
    const epsilon = 1.0e-15;
    const matrixA = RotMatrix.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const jsonA = matrixA.toJSON();
    const matrixB = RotMatrix.fromJSON(jsonA);
    ck.testTrue(matrixA.isAlmostEqual(matrixB, epsilon));
    const matrixZ = RotMatrix.fromJSON([4, 3, 2, 1]);
    const matrixZ1 = RotMatrix.createRowValues(4, 3, 0, 2, 1, 0, 0, 0, 1);
    ck.testTrue(matrixZ.isAlmostEqual(matrixZ1, epsilon), "2d matrix");
    expect(ck.getNumErrors()).equals(0);
  });

  it("transpose", () => {
    const ck = new Checker();
    const vector = Vector3d.create(2.9123, -0.23423, 4.0029);
    for (const matrixA of Sample.createScaleSkewRotMatrix()) {
      const matrixAT = matrixA.transpose();
      const vectorAV = matrixA.multiplyVector(vector);
      // const vectorATV = matrixA.multiplyTransposeVector(vector);
      const vectorVTAT = matrixAT.multiplyTransposeVector(vector);
      ck.testVector3d(vectorVTAT, vectorAV, "matrix*vector transpose");

      const matrixATT = matrixAT.clone();
      matrixATT.transpose(matrixATT);
      ck.testRotMatrix(matrixATT, matrixA, "inplace transpose of transpose is original");
    }
    expect(ck.getNumErrors()).equals(0);
  });

});

function skewFactors(matrixA: RotMatrix): { rigidFactor: RotMatrix, skewFactor: RotMatrix } | undefined {
  const rigid = RotMatrix.createRigidFromRotMatrix(matrixA, AxisOrder.XYZ);
  if (rigid) {
    const skew = rigid.multiplyMatrixTransposeMatrix(matrixA);
    return { rigidFactor: rigid, skewFactor: skew };
  }
  return undefined;
}
describe("SkewFactorization", () => {
  it("XY", () => {
    const ck = new Checker();
    for (const matrix of Sample.createScaleSkewRotMatrix()) {
      const factors = skewFactors(matrix);
      if (ck.testPointer(factors) && factors !== undefined) {
        const product = factors.rigidFactor.multiplyMatrixMatrix(factors.skewFactor);
        ck.testRotMatrix(matrix, product, "rigid*skew=matrix");
        ck.testTrue(factors.skewFactor.isUpperTriangular(), "upper triangular skew factors");
      }
      const scaleX = 3, scaleY = 2, scaleZ = 7;
      // inverse first, then scale:
      const matrixA = matrix.clone();
      matrixA.computeCachedInverse(true);
      matrixA.scaleColumnsInPlace(scaleX, scaleY, scaleZ);

      // scale, then inverse
      const matrixB = matrix.clone();
      matrixB.scaleColumnsInPlace(scaleX, scaleY, scaleZ);
      matrixB.computeCachedInverse(true);
      ck.testNumberArray(matrixA.inverseCoffs, matrixB.inverseCoffs);
    }
    expect(ck.getNumErrors()).equals(0);
  });

});
