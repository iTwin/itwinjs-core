/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AxisIndex, AxisOrder, Geometry, StandardViewIndex } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { InverseMatrixState, Matrix3d, PackedMatrix3dOps } from "../../geometry3d/Matrix3d";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { XYAndZ } from "../../geometry3d/XYZProps";
import { Sample } from "../../serialization/GeometrySamples";
import * as bsiChecker from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// cSpell:words XXYZ YXYZ ZXYZ XYZAs Eigen dgnplatform VTAT rigids ATTV

export class MatrixTests {
  public static checkProperties(ck: bsiChecker.Checker, matrix: Matrix3d, isIdentity: boolean | undefined,
    isUnitPerpendicular: boolean, isRigid: boolean, isInvertible: boolean, isDiagonal: boolean | undefined) {
    if (isIdentity !== undefined)
      ck.testBoolean(isIdentity, matrix.isIdentity, "isIdentity");
    ck.testBoolean(isUnitPerpendicular, matrix.testPerpendicularUnitRowsAndColumns(), "unitPerpendicularMatrix");
    ck.testBoolean(isRigid, matrix.isRigid(), "isRigid");
    const inverse = matrix.inverse();
    if (isInvertible) {
      if (ck.testPointer(inverse, "inverse() completed as expected") && inverse !== undefined) {
        const product = matrix.multiplyMatrixMatrix(inverse);
        const maxDiff = product.maxDiff(Matrix3d.createIdentity());
        ck.testSmallRelative(maxDiff, "inverse*matrix == identity");
      }
    } else {
      ck.testBoolean(true, undefined === inverse, "inverse() failed as expected");
    }
    if (isDiagonal !== undefined)
      ck.testBoolean(isDiagonal, matrix.isDiagonal, "isDiagonal");
  }
}

function testCreateProperties(ck: bsiChecker.Checker) {
  const matrix = Matrix3d.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(45.0));
  if (matrix) {
    const vectorA = Vector3d.create(10, 1, 1);
    const vectorB = Vector3d.create(2, 5, 4);
    ck.testVector3d(
      matrix.multiplyVector(vectorA),
      Vector3d.create(0, 0, 0).plus3Scaled(
        matrix.columnX(), vectorA.x,
        matrix.columnY(), vectorA.y,
        matrix.columnZ(), vectorA.z,
      ),
      "matrix * vector versus column * scalar",
    );
    ck.testVector3d(
      matrix.multiplyVector(vectorA),
      Vector3d.create(0, 0, 0).plus2Scaled(
        matrix.columnY(), vectorA.y,
        matrix.columnZ(), vectorA.z,
      ).plusScaled(matrix.columnX(), vectorA.x),
      "matrix * vector versus column * scalar",
    );

    const frame = Matrix3d.createRigidFromColumns(vectorA, vectorB, AxisOrder.XYZ);
    if (ck.testPointer(frame, "PerpendicularColumns") && frame
      && ck.testBoolean(true, frame.testPerpendicularUnitRowsAndColumns(), "UnitPerpendicularColumns")) {
      const matrixT = matrix.transpose();
      const frameT = frame.transpose();
      for (let i = 0; i < 6; i++) {
        ck.testVector3d(
          matrix.getRow(i),
          matrixT.getColumn(i),
          "row and column match in matrix and its transpose",
        );
      }
      ck.testMatrix3d(
        matrixT.multiplyMatrixMatrix(frame),
        matrix.multiplyMatrixTransposeMatrix(frame),
        "multiplyMatrixTransposeMatrix",
      );
      ck.testMatrix3d(
        matrix.multiplyMatrixMatrix(frameT),
        matrix.multiplyMatrixMatrixTranspose(frame),
        "multiplyMatrixMatrixTranspose",
      );
      ck.testPerpendicular(vectorA, frame.columnZ(), "vectorA perp frame.Z");
      ck.testPerpendicular(vectorB, frame.columnZ(), "vectorB perp frame.Z");
      ck.testParallel(vectorA, frame.columnX(), "vectorA parallel frame.X");
      ck.testCoordinateOrder(
        0,
        vectorB.dotProduct(frame.columnY()),
        "vectorB in positive XY half plane (halved by X toward Y)",
      );
      MatrixTests.checkProperties(ck, frame, false, true, true, true, undefined);

      const frame1 = frame.multiplyMatrixMatrix(Matrix3d.createScale(1, 1, 2));
      // frame1 still has perpendicular columns but not unit. Also its determinant is not +1 so it's not rigid.
      MatrixTests.checkProperties(ck, frame1, false, false, false, true, false);
      // frame2 still has unit perpendicular columns but its determinant is not +1 so it's not rigid.
      const frame2 = frame.multiplyMatrixMatrix(Matrix3d.createScale(1, 1, -1));
      MatrixTests.checkProperties(ck, frame2, false, true, false, true, false);

      let vector;
      const e = 1.0 / 64.0;
      for (vector of [
        Vector3d.create(1, 2, 3),
        Vector3d.create(1, 0, 0),
        Vector3d.create(0, 1, 0),
        Vector3d.create(0, 0, 1),
        Vector3d.create(e, e, 3.0), // triggers near-z logic
      ]) {
        const triad = Matrix3d.createRigidHeadsUp(vector);
        if (ck.testPointer(triad)) {
          MatrixTests.checkProperties(
            ck, triad, undefined, true, true, true,
            // default axis order for createRigidHeadsUp is ZXY so vector goes to the
            // third column of triad so triad is diagonal only when vector = [0,0,1]
            vector.isAlmostEqual(Vector3d.unitZ()),
          );
          ck.testParallel(vector, triad.columnZ());
        }
      }
    }
  }
}
describe("Matrix3d.Construction", () => {
  it("Verify properties of Matrix3d.create", () => {
    const ck = new bsiChecker.Checker();
    testCreateProperties(ck);
    ck.checkpoint("Matrix3d.Construction");
    expect(ck.getNumErrors()).equals(0);
  });
});

function checkInverse(ck: bsiChecker.Checker, matrixA: Matrix3d) {
  const matrixAInverse = matrixA.inverse();
  ck.testPointer(matrixAInverse, "inverse");
  // GeometryCoreTestIO.consoleLog("matrixA", matrixA);
  // GeometryCoreTestIO.consoleLog("matrixAInverse", matrixAInverse);
  if (matrixAInverse) {
    const AB = matrixA.multiplyMatrixMatrix(matrixAInverse);
    ck.testBoolean(true, AB.isIdentity, "A * AInverse = I");
  }
}
describe("Matrix3d.Inverse", () => {
  it("Verify matrix is invertible and matrix times inverse is identity", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = Matrix3d.createRowValues(
      4, 2, 1,
      -1, 5, 3,
      0.5, 0.75, 9,
    );
    checkInverse(ck, matrixA);
    ck.checkpoint("Matrix3d.Inverse");
    expect(ck.getNumErrors()).equals(0);
  });
});

function checkPointArrays(ck: bsiChecker.Checker, pointsA: Point3d[]) {
  const transform = Transform.createScaleAboutPoint(Point3d.create(3, 3, 3), 2);
  const pointsB = transform.multiplyPoint3dArray(pointsA);
  ck.testExactNumber(
    pointsA.length,
    pointsB.length,
    "multiplyPoint3dArray same size for input and output",
  );

  pointsB.pop(); // remove the last element of pointsB
  transform.multiplyPoint3dArray(pointsA, pointsB);
  ck.testExactNumber(
    pointsA.length,
    pointsB.length,
    "multiplyPoint3dArray pushes one element to the end of pointsB",
  );

  pointsB.push(Point3d.create(1, 1, 1)); // add one element to the end of pointsB
  transform.multiplyPoint3dArray(pointsA, pointsB);
  ck.testExactNumber(
    pointsA.length,
    pointsB.length,
    "multiplyPoint3dArray removes one element from the end of pointsB",
  );

  const rangeA = Range3d.createArray(pointsA);
  const rangeB = Range3d.createArray(pointsB);
  const rangeC = transform.multiplyRange(rangeA);
  ck.testPoint3d(
    rangeB.low,
    rangeC.low,
    "`scale array and then create a range on the scaled array` is same as " +
    "`create range on the array and then scale the range`",
  );
  ck.testPoint3d(
    rangeB.high,
    rangeC.high,
    "`scale array and then create a range on the scaled array` is same as " +
    "`create range on the array and then scale the range`",
  );
}

describe("Matrix3d.checkPointArrays", () => {
  it("Matrix3d.checkPointArrays", () => {
    const ck = new bsiChecker.Checker();
    const pointsA = [Point3d.create(1, 2, 3), Point3d.create(4, 5, 2)];
    checkPointArrays(ck, pointsA);
    ck.checkpoint("Point3dArray.checkPointArrays");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.isAlmostEqualAllowZRotation", () => {
  it("Matrix3d.isAlmostEqualAllowZRotation", () => {
    const thisMatrix = Matrix3d.createRowValues(
      1, 1, 0,
      0, 1, 0,
      0, 0, 1,
    );
    const otherMatrix = Matrix3d.createRowValues(
      -1, -1, 0,
      0, -1, 0,
      0, 0, 1,
    );
    // thisMatrix and otherMatrix have the same column Z. Also their column X
    // and Y are differing only by a rotation of 180 degrees around column Z.
    const output: boolean = thisMatrix.isAlmostEqualAllowZRotation(otherMatrix);
    expect(output).equal(true);
  });
});

describe("Matrix3d.factorPerpendicularColumns", () => {
  it("Matrix3d.factorPerpendicularColumns", () => {
    const ck = new bsiChecker.Checker();
    for (const scale of [1, 10, 1000, 68234]) {
      for (const efg of [[0, 0, 0], [0.1, 0, 0], [0.1, 0.5, -0.3], [0.1, 0.5, 0.54], [-0.2, 0.8, 1.1], [0.01, 0, 0]]) {
        const e = efg[0];
        const f = efg[1];
        const g = efg[2];
        const matrixA = Matrix3d.createRowValues(
          2, 0, 2,
          e, f, -e,
          g, 1, 0,
        );
        matrixA.scaleColumns(scale, scale, scale);
        const matrixB = Matrix3d.createZero();
        const matrixC = Matrix3d.createZero();
        matrixA.factorPerpendicularColumns(matrixB, matrixC);
        const matrixBU = matrixB.multiplyMatrixMatrix(matrixC);
        const matrixBTB = matrixB.multiplyMatrixTransposeMatrix(matrixB);
        if (bsiChecker.Checker.noisy.factorPerpendicularColumns) {
          GeometryCoreTestIO.consoleLog("A", matrixA);
          GeometryCoreTestIO.consoleLog("diagonal elements of BTB: ",
            matrixBTB.at(0, 0), " - ", matrixBTB.at(1, 1), " - ", matrixBTB.at(1, 1),
            ". error: ", matrixBTB.sumSquares() - matrixBTB.sumDiagonalSquares(),
          );
          GeometryCoreTestIO.consoleLog("B", matrixB);
          GeometryCoreTestIO.consoleLog("C", matrixC);
          GeometryCoreTestIO.consoleLog("BTB", matrixBTB);
        }
        ck.testCoordinate(0, matrixA.maxDiff(matrixBU), "A = B*C");
        ck.testBoolean(true, matrixBTB.isDiagonal, "BT*B is diagonal");
        ck.testBoolean(true, matrixC.isRigid(), "C is rigid");

        // test full SVD
        const matrixV = Matrix3d.createZero();
        const matrixU = Matrix3d.createZero();
        const scaleFactors = Point3d.createZero();
        if (ck.testTrue(matrixA.factorOrthogonalScaleOrthogonal(matrixV, scaleFactors, matrixU), "SVD = V*D*U succeeds")) {
          ck.testTrue(
            scaleFactors.x >= scaleFactors.y && scaleFactors.y >= scaleFactors.z,
            "Singular values are decreasing",
          );
          const matrixD = Matrix3d.createScale(scaleFactors.x, scaleFactors.y, scaleFactors.z);
          const matrixVD = matrixV.multiplyMatrixMatrix(matrixD);
          ck.testCoordinate(0, matrixC.maxDiff(matrixU), "C = U");
          if (ck.testCoordinate(0, matrixA.maxDiff(matrixVD.multiplyMatrixMatrix(matrixU)), "A = V*D*U"))
            ck.testCoordinate(0, matrixB.maxDiff(matrixVD), "B = V*D");
          else  // recompute for debugging
            matrixA.maxDiff(matrixVD.multiplyMatrixMatrix(matrixU));
          if (ck.testTrue(matrixV.isRigid(true), "V is orthogonal")) {
            const matrixVU = matrixV.multiplyMatrixMatrix(matrixU);
            ck.testTrue(matrixVU.isRigid(true), "VU is orthogonal");
          } else  // recompute for debugging
            matrixV.isRigid(true);
        }
      }
    }
    ck.checkpoint("Matrix3d.factorPerpendicularColumns");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.symmetricEigenvalues", () => {
  it("Matrix3d.symmetricEigenvalues", () => {
    const ck = new bsiChecker.Checker();
    for (const lambda0 of [
      Vector3d.create(2, 1, 4),
      Vector3d.create(3, 2, -1),
    ]) {
      for (const matrixM of Sample.createMatrix3dArray()) {
        if (matrixM.isRigid()) {
          // matrixA is symmetric because columns of matrixM are perpendicular
          const matrixA = matrixM.scaleColumns(lambda0.x, lambda0.y, lambda0.z).multiplyMatrixMatrixTranspose(matrixM);
          if (ck.testTrue(matrixA.isSymmetric())) {
            const eigen1 = Matrix3d.createIdentity();
            const lambda1 = Vector3d.create();
            matrixA.symmetricEigenvalues(eigen1, lambda1);
            // matrixA1 = eigen1 * lambda1 * eigen1Transpose
            const matrixA1 = eigen1.scaleColumns(lambda1.x, lambda1.y, lambda1.z).multiplyMatrixMatrixTranspose(eigen1);
            ck.testMatrix3d(matrixA, matrixA1, "A = eigen1*lambda1*eigen1Transpose");
            ck.testBoolean(true, eigen1.isRigid(), "Eigenvector matrix is rigid");

            const eigenF = Matrix3d.createIdentity();
            const lambdaF = Vector3d.create();
            matrixA.fastSymmetricEigenvalues(eigenF, lambdaF);
            // matrixAF = eigenF * lambdaF * eigenFTranspose
            const matrixAF = eigenF.scaleColumns(lambdaF.x, lambdaF.y, lambdaF.z).multiplyMatrixMatrixTranspose(eigenF);
            ck.testMatrix3d(matrixA, matrixAF, "A = eigenF*lambdaF*eigenFTranspose");
            ck.testBoolean(true, eigenF.isRigid(), "Eigenvector matrix is rigid");
          }
        }
      }
    }
    ck.checkpoint("Matrix3d.symmetricEigenvalues");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.directDots", () => {
  it("Matrix3d.Matrix3d.directDots", () => {
    const ck = new bsiChecker.Checker();
    const matrix = Matrix3d.createRowValues(
      1, 2, 3,
      0.3, 0.77, 4.2,
      -0.02, 5, 9,
    );
    const uv = matrix.columnXDotColumnY();
    const uw = matrix.columnXDotColumnZ();
    const vw = matrix.columnYDotColumnZ();
    const product = matrix.multiplyMatrixTransposeMatrix(matrix);
    ck.testExactNumber(uv, product.at(0, 1));
    ck.testExactNumber(uw, product.at(0, 2));
    ck.testExactNumber(vw, product.at(1, 2));
    ck.testExactNumber(matrix.columnXMagnitudeSquared(), product.at(0, 0));
    ck.testExactNumber(matrix.columnYMagnitudeSquared(), product.at(1, 1));
    ck.testExactNumber(matrix.columnZMagnitudeSquared(), product.at(2, 2));
    ck.checkpoint("Matrix3d.directDots");
    expect(ck.getNumErrors()).equals(0);
  });
});

function testCacheUse(ck: bsiChecker.Checker, name: string, numCompute: number, numUse: number) {
  ck.testExactNumber(numCompute, Matrix3d.numComputeCache, `${name} + numCompute`);
  ck.testExactNumber(numUse, Matrix3d.numUseCache, `${name} + numUse`);
  Matrix3d.numComputeCache = 0;
  Matrix3d.numUseCache = 0;
}
describe("Matrix3d.cachedInverse", () => {
  it("cachedInverse", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = Matrix3d.createRowValues(
      1, 2, 3,
      0.3, 0.77, 4.2,
      -0.02, 5, 9,
    );
    Matrix3d.numUseCache = 0;
    Matrix3d.numComputeCache = 0;
    Matrix3d.useCachedInverse = true;
    // first inversion should do the calculation
    const inverseA1 = matrixA.inverse() as Matrix3d;
    testCacheUse(ck, "first inverse", 1, 0);
    ck.testTrue(matrixA.multiplyMatrixMatrix(inverseA1).isIdentity, "first inverse");
    // second inversion should reuse.
    const inverseA2 = matrixA.inverse() as Matrix3d;
    testCacheUse(ck, "second inverse", 0, 1);
    ck.testTrue(matrixA.multiplyMatrixMatrix(inverseA2).isIdentity, "first inverse");

    const matrixB = matrixA.clone();
    const inverseB = Matrix3d.createIdentity();
    Matrix3d.numUseCache = 0;
    Matrix3d.numComputeCache = 0;
    const numInvert = 10;
    for (let i = 0; i < numInvert; i++) {
      matrixB.inverse(inverseB);
      const product = matrixB.multiplyMatrixMatrix(inverseB);
      ck.testTrue(product.isIdentity);
    }
    // when you clone a matrix, its inverse is also copied.
    ck.testExactNumber(0, Matrix3d.numComputeCache, "B numComputeCache");
    ck.testExactNumber(numInvert, Matrix3d.numUseCache, "B numUseCache");
    expect(ck.getNumErrors()).equals(0);
  });
});

function verifyInverseGo(ck: bsiChecker.Checker, matrixA: Matrix3d) {
  const vectorY = Vector3d.create(1, 2, 3);
  const vectorX = matrixA.multiplyInverse(vectorY);
  if (vectorX) {
    const vectorAX = matrixA.multiplyVector(vectorX);
    ck.testVector3d(vectorY, vectorAX, "AX=Y solution");
    const matrixB = matrixA.inverse();
    if (ck.testPointer(matrixB, "matrix has inverse") && matrixB) {
      const matrixAB = matrixA.multiplyMatrixMatrix(matrixB);
      ck.testTrue(matrixAB.isIdentity, "verify A * AInverse is identity");
      let matrixE = matrixA.clone();
      matrixE.inverse(matrixE);
      if (!ck.testMatrix3d(matrixB, matrixE, "in-place inverse")) {
        // following lines are repeating the logic for debug purposes
        // in case testMatrix3d assertion fails (matrixB != matrixE)
        matrixE = matrixA.clone();
        matrixE.inverse(matrixE);
      }
    }
  }
}
function verifyMatrix3dInverseProperties(ck: bsiChecker.Checker, matrixA: Matrix3d) {
  verifyInverseGo(ck, matrixA);
  verifyInverseGo(ck, matrixA.clone());
  const matrixB = Matrix3d.createIdentity();
  matrixB.setFrom(matrixA);
  verifyInverseGo(ck, matrixB);
  matrixA.setRow(0, Vector3d.create(1, 2, 3));
  verifyInverseGo(ck, matrixA);
}
describe("Matrix3d.CachedInverse", () => {
  it("Matrix3d.CachedInverse", () => {
    const ck = new bsiChecker.Checker();
    verifyMatrix3dInverseProperties(ck, Matrix3d.createIdentity());
    verifyMatrix3dInverseProperties(ck, Matrix3d.createScale(2, 3, 4));
    verifyMatrix3dInverseProperties(
      ck,
      Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 3), Angle.createDegrees(32))!,
    );
    verifyMatrix3dInverseProperties(
      ck,
      Matrix3d.createRowValues(
        10, 1, 2,
        3, 20, 1,
        4, 2, 15,
      ),
    );
    ck.checkpoint("Matrix3d.CachedInverse");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.SingularMatrix", () => {
  it("Matrix3d.SingularMatrix", () => {
    const ck = new bsiChecker.Checker();
    const singularX = Matrix3d.createScale(0, 1, 1);
    const singularY = Matrix3d.createScale(1, 0, 1);
    const singularZ = Matrix3d.createScale(1, 1, 0);
    const vector = Vector3d.create(4, 2.324324, 9.21);

    for (const matrix of [singularX, singularY, singularZ]) {
      ck.testUndefined(matrix.inverseCoffs);
      ck.testExactNumber(InverseMatrixState.singular, matrix.inverseState);
      ck.testUndefined(singularX.multiplyInverse(vector));
      ck.testUndefined(singularX.multiplyInverseTranspose(vector));
      ck.testUndefined(singularX.multiplyInverseXYZAsVector3d(vector.x, vector.y, vector.z));
      ck.testUndefined(singularX.multiplyInverseXYZAsPoint3d(vector.x, vector.y, vector.z));

      const matrix1 = matrix.clone();
      ck.testFalse(matrix1.normalizeColumnsInPlace());
      ck.testMatrix3d(matrix, matrix1, "failed normalize leaves matrix alone");
      ck.testFalse(matrix1.normalizeRowsInPlace());
      ck.testMatrix3d(matrix, matrix1, "failed normalize leaves matrix alone");
    }

    for (const matrix of Sample.createScaleSkewMatrix3d()) {
      const vectorQ = matrix.multiplyInverseXYZAsVector3d(4, 7, 11);
      if (vectorQ) {
        ck.testPointer(matrix.inverseCoffs);
        matrix.scaleColumnsInPlace(0, 3, 8);
        // scaling columns with a zero scale clears inverse
        ck.testExactNumber(matrix.inverseState, InverseMatrixState.singular);
      }
    }
    ck.checkpoint("Matrix3d.SingularMatrix");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.ColumnAccess", () => {
  it("Matrix3d.ColumnAccess", () => {
    const ck = new bsiChecker.Checker();
    const vectorQ = Vector3d.create(1.789, 2.9, -0.33);
    for (const matrix of Sample.createMatrix3dArray()) {
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
    ck.checkpoint("Matrix3d.ColumnAccess");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.RowAccess", () => {
  it("Matrix3d.RowAccess", () => {
    const ck = new bsiChecker.Checker();
    const vectorQ = Vector3d.create(1.789, 2.9, -0.33);
    for (const matrix of Sample.createMatrix3dArray()) {
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
    ck.checkpoint("Matrix3d.RowAccess");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("AxisOrder.ShiftAxis", () => {
  it("AxisOrder.ShiftAxis", () => {
    const ck = new bsiChecker.Checker();
    for (const axisOrder of
      [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX]
    ) {
      if (bsiChecker.Checker.noisy.axisOrderVerify) {
        GeometryCoreTestIO.consoleLog(
          "AxisOrder", axisOrder,
          Geometry.axisOrderToAxis(axisOrder, 0),
          Geometry.axisOrderToAxis(axisOrder, 1),
          Geometry.axisOrderToAxis(axisOrder, 2),
        );
      }
      const axis0 = Geometry.axisOrderToAxis(axisOrder, 0);
      const axis1 = Geometry.axisOrderToAxis(axisOrder, 1);
      const axis2 = Geometry.axisOrderToAxis(axisOrder, 2);
      // shift = 1 for AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY
      // shift = 2 for AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX
      const shift = axisOrder as number <= 2 ? 1 : 2;
      ck.testExactNumber(axis1, Geometry.cyclic3dAxis(axis0 + shift));
      ck.testExactNumber(axis2, Geometry.cyclic3dAxis(axis1 + shift));
      ck.testExactNumber(axis0, Geometry.cyclic3dAxis(axis2 + shift));
    }
    ck.checkpoint("AxisOrder.ShiftAxis");
    expect(ck.getNumErrors()).equals(0);
  });
  it("AxisOrder.AssembleColumns", () => {
    const vector0 = Vector3d.create(1000, 2, 5);
    const vector1 = Vector3d.create(1, 1001, -2);
    const vector2 = Vector3d.create(-3, 1.234, 1002);
    const ck = new bsiChecker.Checker();
    for (const axisOrder of
      [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX]
    ) {
      const axis0 = Geometry.axisOrderToAxis(axisOrder, 0);
      const axis1 = Geometry.axisOrderToAxis(axisOrder, 1);
      const axis2 = Geometry.axisOrderToAxis(axisOrder, 2);
      const matrix = Matrix3d.createColumnsInAxisOrder(axisOrder, vector0, vector1, vector2);
      const retVector0 = matrix.getColumn(axis0);
      const retVector1 = matrix.getColumn(axis1);
      const retVector2 = matrix.getColumn(axis2);
      ck.testVector3d(vector0, retVector0);
      ck.testVector3d(vector1, retVector1);
      ck.testVector3d(vector2, retVector2);
    }
    ck.checkpoint("AxisOrder.AssembleColumns");
    expect(ck.getNumErrors()).equals(0);
  });
});

function verifyRigidScale(ck: bsiChecker.Checker, matrixA: Matrix3d, expectedScale: number, expectRigid: boolean) {
  // console.log ("VerifyRigid " + prettyPrint(matrixA) + " expect " + expectedScale);
  const data = matrixA.factorRigidWithSignedScale();
  if (!expectRigid) {
    ck.testUndefined(data, "confirm matrix is not rigid with scale");
    return;
  }
  if (ck.testPointer(data, "expect rigid matrix with scale")) {
    ck.testCoordinate(expectedScale, data.scale);
    ck.testTrue(data.rigidAxes.isRigid(), "confirm rigid axes");
    const matrixB = data.rigidAxes.scale(data.scale);
    ck.testMatrix3d(matrixA, matrixB);
  }
}
describe("Matrix3d.Factors", () => {
  it("Matrix3d.RigidScale", () => {
    const ck = new bsiChecker.Checker();
    const rigids = Sample.createRigidAxes();
    for (const rigid of rigids) {
      ck.testTrue(rigid.isRigid(), "verify rigid");
      for (const scale of [2, -1, -2]) {
        verifyRigidScale(ck, rigid.scale(scale), scale, true);
        verifyRigidScale(ck, rigid.scaleColumns(scale, scale, scale * 1.3), 1.0, false);
        // if you scale one column of a rigid matrix by -1, the result matrix is not rigid.
        // if you scale two columns of a rigid matrix by -1, the result matrix is rigid.
        verifyRigidScale(ck, rigid.scaleColumns(scale, -1.0 * scale, scale), -scale, true);
      }
    }
    ck.checkpoint("Matrix3d.RigidScale");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Matrix3d.Quaternion", () => {
    const ck = new bsiChecker.Checker();
    const rigidScale = Matrix3d.createRowValues(
      0.019908485552297163, -0.0040687348173572974, 0,
      0.0040687348173572974, 0.019908485552297163, 0,
      0, 0, 0.020320000000000008,
    );
    const result = Matrix3d.createZero();
    const data = rigidScale.factorRigidWithSignedScale(result);
    if (ck.testPointer(data)) {
      ck.testTrue(data.rigidAxes === result, "pre-allocated result object is returned");
      const rotationMatrix = data.rigidAxes;
      const quat = rotationMatrix.toQuaternion();
      const quatMatrix = Matrix3d.createFromQuaternion(quat);
      ck.testMatrix3d(rotationMatrix, quatMatrix, "quat matrix is same as rotation matrix");
    }
    ck.checkpoint("Matrix3d.Quaternion");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Matrix3d.AxisAndAngleOfRotation", () => {
    const ck = new bsiChecker.Checker();
    const rigids = Sample.createRigidAxes();
    for (const rigid of rigids) {
      ck.testTrue(rigid.isRigid(), "verify rigid");
      const data = rigid.getAxisAndAngleOfRotation();
      if (ck.testTrue(data.ok, "extract axis and angle")) {
        const newRigid = Matrix3d.createRotationAroundVector(data.axis, data.angle);
        if (ck.testPointer(newRigid))
          ck.testMatrix3d(rigid, newRigid, "round trip rotation around vector");
      }
    }
    ck.checkpoint("Matrix3d.AxisAndAngleOfRotation");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.BadInputCases", () => {
  it("Matrix3d.BadInputCases", () => {
    const ck = new bsiChecker.Checker();
    const failure1 = Matrix3d.createViewedAxes(Vector3d.unitX(), Vector3d.unitX());
    ck.testUndefined(failure1, "createViewedAxes fails with equal inputs");

    const failure2 = Matrix3d.createRotationAroundVector(Vector3d.createZero(), Angle.createDegrees(40));
    ck.testUndefined(failure2, "createRotationAroundVector fails with 000 input");

    const failure3 = Matrix3d.createDirectionalScale(Vector3d.createZero(), 2.0);
    ck.testTrue(failure3.isDiagonal, "createDirectionalScale fails with 000 direction");

    ck.checkpoint("Matrix3d.BadInputCases");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.AxisAndAngleOfRotation", () => {
  it("Matrix3d.AxisAndAngleOfRotationMaxDiff", () => {
    const ck = new bsiChecker.Checker();
    const vectors = Sample.createNonZeroVectors();
    let maxDiff12 = 0;
    for (const vector of vectors) {
      if (bsiChecker.Checker.noisy.rotMatrixAxisAndAngle)
        GeometryCoreTestIO.consoleLog("*** vector *** ", vector);
      for (const degrees of [0.01, 10, -14, 78, 128, 0.01, 0.328]) {
        if (bsiChecker.Checker.noisy.rotMatrixAxisAndAngle)
          GeometryCoreTestIO.consoleLog("*** degrees *** ", degrees);
        const matrix1 = Matrix3d.createRotationAroundVector(vector, Angle.createDegrees(degrees))!;
        const data = matrix1.getAxisAndAngleOfRotation();
        // We do not directly compare data.axis and axis because they might be negated.
        // We do not directly compare data.angle and angle because they might be shifted.
        // Instead we check that the data generates the same rotation matrix.
        const matrix2 = Matrix3d.createRotationAroundVector(data.axis, data.angle);
        if (ck.testTrue(data.ok, "data ok")) {
          if (ck.testPointer(matrix2, "good data for createRotationAroundVector"))
            ck.testMatrix3d(matrix1, matrix2, "matrix1 = matrix2");
        }
        if (matrix2) {
          const diff12 = matrix2.maxDiff(matrix1);
          if (bsiChecker.Checker.noisy.rotMatrixAxisAndAngle)
            GeometryCoreTestIO.consoleLog("matrix1.maxDiff(matrix2) ", diff12);
          maxDiff12 = Math.max(maxDiff12, diff12);
        }
      }
    }
    ck.testLT(maxDiff12, 1.0e-15);
    ck.checkpoint("Matrix3d.AxisAndAngleOfRotationMaxDiff");
    expect(ck.getNumErrors()).equals(0);
  });

  // rotation by 180 degrees is a special case to invert.
  it("Matrix3d.AxisAndAngleOfRotationPI", () => {
    const ck = new bsiChecker.Checker();
    for (const vector of [
      Vector3d.unitX(),
      Vector3d.unitY(),
      Vector3d.unitZ(),
      Vector3d.create(1, 1, 0),
      Vector3d.create(-1, 1, 0),
      Vector3d.create(0, 1, 1),
      Vector3d.create(0, -1, 1),
      Vector3d.create(1, 0, 1),
      Vector3d.create(-1, 0, 1),
      Vector3d.create(-1, 2, 0),
      Vector3d.create(1, 2, 3),
      Vector3d.create(-1, 2, 3),
      Vector3d.create(1, -2, 3),
      Vector3d.create(-1, -2, 3)]
    ) {
      for (const scale of [1, -1]) {
        const vectorA = vector.scale(scale);
        const angleA = Angle.createDegrees(180);
        const matrixA = Matrix3d.createRotationAroundVector(vectorA, angleA)!;
        const vectorAndAngle = matrixA.getAxisAndAngleOfRotation();
        ck.testAngleAllowShift(angleA, vectorAndAngle.angle);
        ck.testTrue(vectorA.isParallelTo(vectorAndAngle.axis, true));
      }
    }
    ck.checkpoint("Matrix3d.AxisAndAngleOfRotationPI");
    expect(ck.getNumErrors()).equals(0);
  });
});

function generateRotationTransform(eyePoint: Point3d, viewRotation: Matrix3d, yawRateRadiansPerTime: number,
  pitchRateRadiansPerTime: number, time: number): Transform {
  const yawAngle = Angle.createRadians(yawRateRadiansPerTime * time);
  const pitchAngle = Angle.createRadians(pitchRateRadiansPerTime * time);

  let invViewRotation = viewRotation.inverse();
  if (!invViewRotation)
    invViewRotation = Matrix3d.createIdentity();

  const pitchMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitX(), pitchAngle)!;
  const pitchTimesView = pitchMatrix.multiplyMatrixMatrix(viewRotation);
  // inverseViewTimesPitchTimesView = invViewRotation * pitchMatrix * viewRotation
  const inverseViewTimesPitchTimesView = invViewRotation.multiplyMatrixMatrix(pitchTimesView);

  const yawMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), yawAngle)!;
  // yawTimesInverseViewTimesPitchTimesView = yawMatrix * invViewRotation * pitchMatrix * viewRotation
  const yawTimesInverseViewTimesPitchTimesView = yawMatrix.multiplyMatrixMatrix(inverseViewTimesPitchTimesView);

  const transform = Transform.createFixedPointAndMatrix(eyePoint, yawTimesInverseViewTimesPitchTimesView);
  return transform;
}

function testRotateVectorAroundAxis(vector: Vector3d, axis: Vector3d, angle: Angle, ck: bsiChecker.Checker): void {
  const result = Vector3d.createRotateVectorAroundVector(vector, axis, angle);
  const isParallel = vector.isParallelTo(axis);
  ck.testTrue(!isParallel, "vector is not parallel to axis");
  if (!isParallel && result) {
    const radians = vector.planarRadiansTo(result, axis);
    ck.testTrue(
      Angle.isAlmostEqualRadiansAllowPeriodShift(angle.radians, radians),
      "rotation angle in the plane (perp to axis)",
    );
    ck.testAngleAllowShift(axis.angleTo(vector), axis.angleTo(result), "angle from rotation axis");
    ck.testCoordinate(vector.magnitude(), result.magnitude(), "rotation does not change magnitude");
  }
}

function testRotateVectorToVector(vectorA: Vector3d, vectorB: Vector3d, ck: bsiChecker.Checker) {
  const matrix = Matrix3d.createRotationVectorToVector(vectorA, vectorB);
  const fraction = 0.2;
  ck.testPointer(matrix, "rotation matrix");
  if (matrix) {
    ck.testTrue(matrix.isRigid(), "rigid rotation");
    const vectorB1 = matrix.multiplyVector(vectorA);
    ck.testParallel(vectorB, vectorB1);
    const matrix0 = Matrix3d.createPartialRotationVectorToVector(vectorA, fraction, vectorB)!;
    const matrix1 = Matrix3d.createPartialRotationVectorToVector(vectorA, 1.0 - fraction, vectorB)!;
    ck.testMatrix3d(matrix, matrix0.multiplyMatrixMatrix(matrix1), "partial rotations accumulate");
  }
}

describe("Matrix3d.RotateVector", () => {
  it("Matrix3d.createRotationAroundVector", () => {
    const ck = new bsiChecker.Checker();
    const eyePoint = Point3d.create(10, 15, 23);
    const viewRotation = Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 3), Angle.createRadians(0.23))!;
    const yawRateRadiansPerTime = 0.5;
    const pitchRateRadiansPerTime = 0.25;
    const time = 0.1;
    const expectedTransform = Transform.createRefs(
      Vector3d.create(
        0.88610832476555645,
        0.060080207464391355,
        -0.40375557735756828,
      ),
      Matrix3d.createRowValues(
        0.99857861707557882, -0.053201794397914448, -0.0032116338935924771,
        0.053107143509079233, 0.99828614780495017, -0.024584515636062437,
        0.004514069974036361, 0.024379010923246527, 0.99969259625080453,
      ),
    );
    const transform = generateRotationTransform(
      eyePoint, viewRotation, yawRateRadiansPerTime, pitchRateRadiansPerTime, time,
    );
    ck.testMatrix3d(expectedTransform.matrix, transform.matrix);
    ck.testXYZ(expectedTransform.origin, transform.origin);
  });

  it("Matrix3d.testRotateVectorAroundAxis", () => {
    const ck = new bsiChecker.Checker();
    testRotateVectorAroundAxis(Vector3d.create(1, 0, 0), Vector3d.create(0, 0, 1), Angle.createDegrees(25.0), ck);
    testRotateVectorAroundAxis(Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), Angle.createDegrees(-49.0), ck);
    testRotateVectorAroundAxis(Vector3d.create(1, 2, 4), Vector3d.create(5, -2, 1), Angle.createDegrees(25.2), ck);
    ck.checkpoint("testRotateVectorAroundAxis");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Matrix3d.testRotateVectorToVector", () => {
    const ck = new bsiChecker.Checker();
    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(0, 0, 1), ck);
    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), ck);
    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(1, 0, 0), ck);

    testRotateVectorToVector(Vector3d.create(1, 0, 0), Vector3d.create(-1, 0, 0), ck);
    testRotateVectorToVector(Vector3d.create(0, -1, 0), Vector3d.create(0, 1, 0), ck);
    testRotateVectorToVector(Vector3d.create(0, 0, 1), Vector3d.create(0, 0, -1), ck);

    ck.testUndefined(
      Matrix3d.createPartialRotationVectorToVector(
        Vector3d.createZero(),
        0.3,
        Vector3d.unitX(),
      ), "rotation with zero vector",
    );
    ck.testUndefined(
      Matrix3d.createPartialRotationVectorToVector(
        Vector3d.unitX(),
        0.2,
        Vector3d.createZero(),
      ), "rotation with zero axis",
    );

    const vectorA = Vector3d.create(1, 2, 3);
    const vectorB = Vector3d.create(4, 2, 9);
    const negativeScaledVectorA = vectorA.scale(-2);
    testRotateVectorToVector(vectorA, vectorB, ck);
    testRotateVectorToVector(vectorA, negativeScaledVectorA, ck);

    ck.checkpoint("Matrix3d.testRotateVectorToVector");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Matrix3d.RotateAroundAxis", () => {
    const ck = new bsiChecker.Checker();
    ck.testMatrix3d(
      Matrix3d.create90DegreeRotationAroundAxis(0),
      Matrix3d.createRotationAroundVector(Vector3d.unitX(), Angle.createDegrees(90))!,
      "Rotate 90 X",
    );
    ck.testMatrix3d(
      Matrix3d.create90DegreeRotationAroundAxis(1),
      Matrix3d.createRotationAroundVector(Vector3d.unitY(), Angle.createDegrees(90))!,
      "Rotate 90 Y",
    );
    ck.testMatrix3d(
      Matrix3d.create90DegreeRotationAroundAxis(2),
      Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(90))!,
      "Rotate 90 Z",
    );

    for (const degrees of [0.0, 10.0, -40.0]) {
      const theta = Angle.createDegrees(degrees);
      ck.testMatrix3d(
        Matrix3d.createRotationAroundAxisIndex(AxisIndex.X, theta),
        Matrix3d.createRotationAroundVector(Vector3d.unitX(), theta)!,
        "Rotate theta X",
      );
      ck.testMatrix3d(
        Matrix3d.createRotationAroundAxisIndex(AxisIndex.Y, theta),
        Matrix3d.createRotationAroundVector(Vector3d.unitY(), theta)!,
        "Rotate theta Y",
      );
      ck.testMatrix3d(
        Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, theta),
        Matrix3d.createRotationAroundVector(Vector3d.unitZ(), theta)!,
        "Rotate theta Z",
      );
    }
    ck.checkpoint("Matrix3d.RotateAroundAxis");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.RowColumn", () => {
  it("Matrix3d.RowColumn", () => {
    const ck = new bsiChecker.Checker();
    const vectorX = Vector3d.create(1, 2, 4);
    const vectorY = Vector3d.create(3, 9, 27);
    const vectorZ = Vector3d.create(5, 25, 125);
    const matrixByRow = Matrix3d.createRows(vectorX, vectorY, vectorZ);
    const normalizedMatrixByRow = matrixByRow.clone();
    normalizedMatrixByRow.normalizeRowsInPlace();
    for (const i of [0, 1, 2]) {
      const row = matrixByRow.getRow(i);
      const normalizedRow = normalizedMatrixByRow.getRow(i);
      ck.testCoordinate(normalizedRow.magnitude(), 1, `normalized row ${i} magnitude`);
      ck.testCoordinate(row.magnitude(), row.dotProduct(normalizedRow), `row ${i} magnitude`);
    }

    const matrixByColumn = Matrix3d.createColumns(vectorX, vectorY, vectorZ);
    const newMatrixByRow = Matrix3d.createZero();
    let maxAbs = 0;
    for (const i of [0, 1, 2]) {
      ck.testVector3d(matrixByColumn.getColumn(i), matrixByRow.getRow(i), "row and column vectors are equal");
      for (const j of [0, 1, 2]) {
        ck.testExactNumber(matrixByRow.at(i, j), matrixByColumn.at(j, i), "transposed elements are equal");
        const q = matrixByRow.at(i, j);
        maxAbs = Geometry.maxAbsXYZ(q, maxAbs, 0);
        newMatrixByRow.setAt(i, j, matrixByRow.at(i, j));
        ck.testExactNumber(maxAbs, newMatrixByRow.maxAbs(), "evolving maxAbs");
      }
    }
    ck.testMatrix3d(matrixByRow, newMatrixByRow, "cloned by setAt");
    ck.testMatrix3d(matrixByRow, matrixByColumn.transpose(), "matrixByRow is transpose of matrixByColumn");

    const matrixMinusTranspose = matrixByRow.clone();
    matrixMinusTranspose.addScaledInPlace(matrixByColumn, -1.0);
    ck.testCoordinate(
      matrixMinusTranspose.sumSquares(),
      2.0 * matrixByColumn.sumSkewSquares(),
      "sum square of `matrix - matrixTranspose` is equal to sum skew squares of matrix",
    );
    ck.checkpoint("Matrix3d.RowColumn");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.DotRows", () => {
  it("Matrix3d.DotRows", () => {
    const ck = new bsiChecker.Checker();
    const vector = Vector3d.create(-3.12321, 0.28, 1.249);
    const vectorX = Vector3d.create(1, 2, 4);
    const vectorY = Vector3d.create(3, 9, 27);
    const vectorZ = Vector3d.create(5, 25, 125);
    const matrix = Matrix3d.createRows(vectorX, vectorY, vectorZ);

    ck.testCoordinate(vector.dotProduct(vectorX), matrix.dotRowXXYZ(vector.x, vector.y, vector.z));
    ck.testCoordinate(vector.dotProduct(vectorY), matrix.dotRowYXYZ(vector.x, vector.y, vector.z));
    ck.testCoordinate(vector.dotProduct(vectorZ), matrix.dotRowZXYZ(vector.x, vector.y, vector.z));

    ck.checkpoint("Matrix3d.DotRows");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.SignedPermutation", () => {
  it("Matrix3d.SignedPermutation", () => {
    const ck = new bsiChecker.Checker();
    const unitX = Vector3d.unitX();
    const unitY = Vector3d.unitY();
    const orderList = [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX];
    const signList = [1, 1, 1, -1, -1, -1];
    const shiftValue = 0.02;
    for (let i = 0; i < orderList.length; i++) {
      const axisOrder = orderList[i];
      const sign = signList[i];
      const matrix = Matrix3d.createRigidFromColumns(unitX, unitY, axisOrder)!;
      ck.testTrue(matrix.isSignedPermutation, "matrix is the signed permutation of identity matrix");
      ck.testCoordinate(sign, matrix.determinant(), "determinant of the matrix");

      // change one entry at a time to destroy signed permutation property
      for (let k = 0; k < 9; k++) {
        const matrixA = matrix.clone();
        const ak = matrixA.coffs[k];
        matrixA.coffs[k] += shiftValue;
        ck.testFalse(matrixA.isSignedPermutation, "matrix is not the signed permutation of identity matrix");
        if (ak !== 1.0) {
          matrixA.coffs[k] = 1;
          ck.testFalse(matrixA.isSignedPermutation, "matrix is not the signed permutation of identity matrix");
        }
      }
    }
    ck.checkpoint("Matrix3d.SignedPermutation");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.StandardViewedAxes", () => {
  it("StandardView", () => {
    const ck = new bsiChecker.Checker();
    for (let viewIndex = 0; viewIndex < 8; viewIndex++) {
      const matrix = Matrix3d.createStandardWorldToView(viewIndex);
      ck.testTrue(matrix.isRigid());
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardTopViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Top, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitX(), Vector3d.unitY(), 0, 0)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardBottomViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Bottom, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitX(), Vector3d.unitY(-1), 0, 0)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardFrontViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Front, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitX(), Vector3d.unitZ(), 0, 0)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardBackViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Back, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitX(-1), Vector3d.unitZ(), 0, 0)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardRightViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Right, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitY(), Vector3d.unitZ(), 0, 0)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardLeftViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Left, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitY(-1), Vector3d.unitZ(), 0, 0)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardIsoViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Iso, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitX(), Vector3d.unitZ(), -1, 1)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardRightIsoViewedAxes", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.RightIso, true);
    const matrix2 = Matrix3d.createViewedAxes(Vector3d.unitX(), Vector3d.unitZ(), 1, 1)!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardTopRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Top, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.unitZ())!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  /**
   * BOTTOM matrix cannot be generated by createRigidHeadsUp. The fact that other 5 standard views
   * matrixes match the cross product constructions is just a surprise coincidence.
   */
  // it("StandardBottomRigidHeadsUp", () => {
  //   const ck = new bsiChecker.Checker();
  //   const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Bottom, true);
  //   const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.unitZ(-1))!;
  //   ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
  //   expect(ck.getNumErrors()).equals(0);
  // });

  it("StandardFrontRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Front, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.unitY(-1))!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardBackRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Back, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.unitY())!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardRightRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Right, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.unitX())!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardLeftRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Left, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.unitX(-1))!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardIsoRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Iso, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.create(-1 / Math.sqrt(3), -1 / Math.sqrt(3), 1 / Math.sqrt(3)))!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardRightIsoRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.RightIso, true);
    const matrix2 = Matrix3d.createRigidHeadsUp(Vector3d.create(1 / Math.sqrt(3), -1 / Math.sqrt(3), 1 / Math.sqrt(3)))!;
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardTopRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Top, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(0, 0, 1);
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardBottomRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Bottom, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(0, 0, -1);
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardFrontRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Front, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(0, -1, 0);
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardBackRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Back, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(0, 1, 0);
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardRightRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Right, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(1, 0, 0);
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardLeftRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Left, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(-1, 0, 0);
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardIsoRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.Iso, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(-1 / Math.sqrt(3), -1 / Math.sqrt(3), 1 / Math.sqrt(3));
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });

  it("StandardRightIsoRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix1 = Matrix3d.createStandardWorldToView(StandardViewIndex.RightIso, true);
    const matrix2 = Matrix3d.createRigidViewAxesZTowardsEye(1 / Math.sqrt(3), -1 / Math.sqrt(3), 1 / Math.sqrt(3));
    ck.testMatrix3d(matrix1, matrix2, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.DirectionalScale", () => {
  it("Matrix3d.DirectionalScale", () => {
    const ck = new bsiChecker.Checker();
    for (const planeNormal of [Vector3d.create(0, 0, 1), Vector3d.create(1, 2, 4)]) {
      planeNormal.normalizeInPlace();
      const vectors = Sample.createNonZeroVectors();
      const projector = Matrix3d.createDirectionalScale(planeNormal, 0.0);
      for (const scale of [2, 1, -1, -5]) {
        const matrix = Matrix3d.createDirectionalScale(planeNormal, scale);
        for (const vectorA of vectors) {
          const vector0 = projector.multiplyVector(vectorA); // projection of vectorA on plane
          const vectorB = matrix.multiplyVector(vectorA); // directional scale of vectorA
          const vector0A = Vector3d.createStartEnd(vector0, vectorA);
          const vector0B = Vector3d.createStartEnd(vector0, vectorB);
          const vector0AScaled = vector0A.scale(scale);
          ck.testTrue(vector0.isPerpendicularTo(vector0A, true), "vector0 perp tp vector0A");
          ck.testTrue(vector0.isPerpendicularTo(vector0B, true), "vector0 perp tp vector0B");
          ck.testVector3d(vector0B, vector0AScaled, "scale * vector0A = vector0B");
        }
      }
      projector.multiplyVectorArrayInPlace(vectors);
      for (const vector of vectors) {
        ck.testTrue(vector.isPerpendicularTo(planeNormal, true), "vector perp to planeNormal");
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.Multiply", () => {
  it("Matrix3d.MultiplyXY", () => {
    const ck = new bsiChecker.Checker();
    const planeNormal = Vector3d.create(1, 2, 4);
    planeNormal.normalizeInPlace();
    const vectors = Sample.createNonZeroVectors();
    // matrix does not have to be generated by createDirectionalScale and can be any matrix.
    const matrix = Matrix3d.createDirectionalScale(planeNormal, -1.0);
    const columnX = matrix.columnX();
    const columnY = matrix.columnY();
    const origin = Point2d.create(4, 3);
    columnX.z = columnY.z = 0.0;

    for (const v of vectors) {
      const xy1 = Matrix3d.xyPlusMatrixTimesXY(origin, matrix, v);
      const xy2 = origin.plus2Scaled(columnX, v.x, columnY, v.y);
      ck.testPoint2d(xy1, xy2);

      const v2 = matrix.multiplyTransposeVector(v);
      const v3 = matrix.multiplyTransposeXYZ(v.x, v.y, v.z);
      ck.testVector3d(v2, v3);

      const v4 = v.clone();
      const v5 = v.clone();
      matrix.multiplyVectorInPlace(v4); // v4 = matrix * v
      matrix.multiplyTransposeVectorInPlace(v5); // v5 = matrixTranspose * v
      ck.testVector3d(v4, matrix.multiplyVector(v));
      ck.testVector3d(v5, matrix.multiplyTransposeVector(v));

      const v6 = matrix.multiplyInverseXYZAsVector3d(v4.x, v4.y, v4.z)!; // v6 = matrixInverse * v4 = v
      ck.testVector3d(v6, v);
      ck.testXYZ(v6, matrix.multiplyInverseXYZAsPoint3d(v4.x, v4.y, v4.z)!);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Matrix3d.MultiplyXYZToFloat64Array", () => {
    const ck = new bsiChecker.Checker();
    const vectors = Sample.createNonZeroVectors();
    for (const planeNormal of [
      Vector3d.unitX(),
      Vector3d.unitY(),
      Vector3d.unitZ(),
      Vector3d.create(1, 2, 4),
    ]) {
      planeNormal.normalizeInPlace();
      // matrix does not have to be generated by createDirectionalScale and can be any matrix.
      const matrix = Matrix3d.createDirectionalScale(planeNormal, -1.0);
      const columnX = matrix.columnX();
      const columnY = matrix.columnY();
      const columnZ = matrix.columnZ();
      const origin = Point3d.create(4, 3, 0.1231);
      const w = 0.921312367868769;
      for (const v of vectors) {
        const resultAW = Point3d.createScale(origin, w).plus3Scaled(columnX, v.x, columnY, v.y, columnZ, v.z);
        const resultBW = Matrix3d.xyzPlusMatrixTimesWeightedCoordinatesToFloat64Array(origin, matrix, v.x, v.y, v.z, w);
        const resultA = origin.plus3Scaled(columnX, v.x, columnY, v.y, columnZ, v.z);
        const resultB = Matrix3d.xyzPlusMatrixTimesCoordinatesToFloat64Array(origin, matrix, v.x, v.y, v.z);
        ck.testXYZ(resultA, Vector3d.createFrom(resultB), "XYZPlusMatrixTimesWeightedCoordinatesToFloat64Array");
        ck.testXYZ(resultAW, Vector3d.createFrom(resultBW), "XYZPlusMatrixTimesCoordinatesToFloat64Array");
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.AxisOrderConstructions", () => {
  it("Matrix3d.AxisOrderConstructions", () => {
    const ck = new bsiChecker.Checker();
    const planeNormal = Vector3d.create(1, 2, 4);
    planeNormal.normalizeInPlace();
    // matrix does not have to be generated by createDirectionalScale and can be any matrix.
    const matrix = Matrix3d.createDirectionalScale(planeNormal, -2.9);
    const orderList = [AxisOrder.XYZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.ZYX];
    const signList = [1, 1, 1, -1, -1, -1];
    for (let i = 0; i < orderList.length; i++) {
      const axisOrder = orderList[i];
      const sign = signList[i];
      const frame = matrix.clone();
      frame.axisOrderCrossProductsInPlace(axisOrder);
      ck.testTrue(sign * frame.determinant() > 0.0);
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.CloneAndPerturbation", () => {
  it("Matrix3d.CloneAndPerturbation", () => {
    const ck = new bsiChecker.Checker();
    const epsilon = 0.0001;
    const matrixA = Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const matrixB = matrixA.clone();
    ck.testTrue(matrixA.isExactEqual(matrixB), "matrixA = matrixB");
    for (let i = 0; i < 9; i++) {
      matrixA.clone(matrixB);
      ck.testTrue(matrixA.isExactEqual(matrixB), "matrixA = matrixB");
      matrixB.coffs[i] += epsilon;
      ck.testFalse(matrixB.isAlmostEqual(matrixA), "matrixA != matrixB after perturbation");
    }

    const matrixXY = Matrix3d.createRowValues(1, 2, 0, 3, 4, 0, 0, 0, 1);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        matrixXY.clone(matrixB);
        ck.testTrue(matrixB.isXY, "matrix is XY");
        if (i === 2 || j === 2) {
          matrixB.setAt(i, j, matrixB.at(i, j) + epsilon);
          ck.testFalse(matrixB.isXY, "matrix is not XY after perturbation");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.JSON", () => {
  it("Matrix3d.JSON", () => {
    const ck = new bsiChecker.Checker();
    const epsilon = 1.0e-15;
    const matrixA = Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const jsonA = matrixA.toJSON();
    const matrixAA = Matrix3d.fromJSON(jsonA);
    ck.testTrue(matrixA.isAlmostEqual(matrixAA, epsilon));

    const matrixB = Matrix3d.fromJSON([4, 3, 2, 1]);
    const matrixBB = Matrix3d.createRowValues(4, 3, 0, 2, 1, 0, 0, 0, 1);
    ck.testTrue(matrixB.isAlmostEqual(matrixBB, epsilon));

    const matrixC = Matrix3d.fromJSON();
    ck.testMatrix3d(matrixC, Matrix3d.createZero());

    const matrixD = Matrix3d.fromJSON(jsonA);
    ck.testMatrix3d(matrixA, matrixD);

    const matrixE = Matrix3d.fromJSON([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    ck.testMatrix3d(matrixA, matrixE);

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.Transpose", () => {
  it("Matrix3d.Transpose", () => {
    const ck = new bsiChecker.Checker();
    const vector = Vector3d.create(2.9123, -0.23423, 4.0029);
    for (const matrixA of Sample.createScaleSkewMatrix3d()) {
      const matrixAT = matrixA.transpose();
      const vectorAV = matrixA.multiplyVector(vector);
      const vectorATTV = matrixAT.multiplyTransposeVector(vector);
      ck.testVector3d(vectorATTV, vectorAV, "A*V = ATT*V");

      const matrixATT = matrixAT.clone();
      matrixATT.transpose(matrixATT);
      ck.testMatrix3d(matrixATT, matrixA, "ATT = A");
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

function skewFactors(matrix: Matrix3d): { rigidFactor: Matrix3d, skewFactor: Matrix3d } | undefined {
  const rigid = Matrix3d.createRigidFromMatrix3d(matrix, AxisOrder.XYZ);
  if (rigid) {
    const skew = rigid.multiplyMatrixTransposeMatrix(matrix); // skew = rigidTranspose * matrix
    return { rigidFactor: rigid, skewFactor: skew };
  }
  return undefined;
}
describe("Matrix3d.SkewFactorization", () => {
  it("Matrix3d.SkewFactorization", () => {
    const ck = new bsiChecker.Checker();
    for (const matrix of Sample.createScaleSkewMatrix3d()) {
      const factors = skewFactors(matrix);
      if (ck.testPointer(factors)) {
        const product = factors.rigidFactor.multiplyMatrixMatrix(factors.skewFactor);
        // skew = rigidTranspose * matrix ==> rigid * skew = rigid * rigidTranspose * matrix = matrix
        // because rigid * rigidTranspose = identity because rigid is orthogonal
        ck.testMatrix3d(matrix, product, "rigid * skew = matrix");
        ck.testTrue(factors.skewFactor.isUpperTriangular, "skew factor is upper triangular");
        ck.testTrue(factors.skewFactor.transpose().isLowerTriangular, "transpose of skew factor os lower triangular");
      }
      const scaleX = 3, scaleY = 2, scaleZ = 7;
      // inverse first, then scale columns
      const matrixA = matrix.clone();
      matrixA.computeCachedInverse(true);
      matrixA.scaleColumnsInPlace(scaleX, scaleY, scaleZ);
      // scale columns, then inverse
      const matrixB = matrix.clone();
      matrixB.scaleColumnsInPlace(scaleX, scaleY, scaleZ);
      matrixB.computeCachedInverse(true);
      ck.testNumberArray(matrixA.inverseCoffs, matrixB.inverseCoffs, "matrixA inverse = matrixB inverse");

      // inverse first, then scale rows
      const matrixC = matrix.clone();
      matrixC.computeCachedInverse(true);
      matrixC.scaleRowsInPlace(scaleX, scaleY, scaleZ);
      // scale rows first, then inverse
      const matrixD = matrix.clone();
      matrixD.scaleRowsInPlace(scaleX, scaleY, scaleZ);
      matrixD.computeCachedInverse(true);
      ck.testNumberArray(matrixC.inverseCoffs, matrixD.inverseCoffs, "matrixC inverse = matrixD inverse");
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.InverseVariants", () => {
  it("Matrix3d.CreateCapture", () => {
    const ck = new bsiChecker.Checker();
    for (const matrix of Sample.createScaleSkewMatrix3d()) {
      const coffs = new Float64Array(matrix.coffs);
      matrix.computeCachedInverse(true);
      const inverseCoffs = new Float64Array(matrix.inverseCoffs!);
      const matrix1 = Matrix3d.createCapture(coffs);
      const matrix2 = Matrix3d.createCapture(coffs, inverseCoffs);
      const matrix3 = Matrix3d.createCapture(new Float64Array(coffs), inverseCoffs);
      ck.testMatrix3d(matrix, matrix1);
      expect(matrix1.inverseState).equals(InverseMatrixState.unknown);
      ck.testMatrix3d(matrix, matrix2);
      expect(matrix2.inverseState).equals(InverseMatrixState.inverseStored);
      ck.testMatrix3d(matrix, matrix3);
      expect(matrix3.inverseState).equals(InverseMatrixState.inverseStored);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Matrix3d.Singular", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 3), Angle.createDegrees(13))!;
    const matrixB = Matrix3d.createZero();
    ck.testUndefined(matrixA.multiplyMatrixMatrixInverse(matrixB), "singular matrix trapped at multiplication");
    expect(ck.getNumErrors()).equals(0);
  });
});

function correctSmallNumber(value: number, tolerance: number): number {
  return Math.abs(value) < tolerance ? 0 : value;
}
function snapVectorToCubeFeatures(vec: XYAndZ, tolerance: number = 1.0e-6): Vector3d {
  const x = correctSmallNumber(vec.x, tolerance);
  let y = correctSmallNumber(vec.y, tolerance);
  let z = correctSmallNumber(vec.z, tolerance);

  const xx = Math.abs(x);
  const yy = Math.abs(y);
  const zz = Math.abs(z);

  // adjust any adjacent pair of near equal values to the first.
  if (Geometry.isSameCoordinate(xx, yy, tolerance)) {
    y = Geometry.split3WaySign(y, -xx, xx, xx);
  }
  if (Geometry.isSameCoordinate(yy, zz, tolerance)) {
    z = Geometry.split3WaySign(z, -yy, yy, yy);
  }
  if (Geometry.isSameCoordinate(xx, zz, tolerance)) {
    z = Geometry.split3WaySign(z, -xx, xx, xx);
  }
  return Vector3d.create(x, y, z);
}
describe("Matrix3d.SnapToCube", () => {
  it("Matrix3d.SnapToCube", () => {
    const ck = new bsiChecker.Checker();
    const points = Sample.createPoint3dLattice(-1, 1, 1);
    ck.testExactNumber(points.length, 27, "Expect 27 lattice points");
    const a = 1.0e-8;
    const fuzz = [
      Vector3d.create(a, 0, 0),
      Vector3d.create(0, a, 0),
      Vector3d.create(0, 0, a),
      Vector3d.create(a, a, 0),
      Vector3d.create(0, a, a),
      Vector3d.create(a, 0, a),
      Vector3d.create(a, a, a),
    ];
    const bigShift = Vector3d.create(0.1, 0.2, -0.3);
    const smallTol = 1.0e-14;
    const bigTol = 1.0e-6;
    // all lattice points
    for (const point of points) {
      const p = Vector3d.create(point.x, point.y, point.z);
      if (p.magnitude() !== 0.0) {
        // no shift
        const q = snapVectorToCubeFeatures(p, bigTol);
        ck.testLE(p.distance(q), smallTol, "no snap on lattice points");
        // small shift
        for (const s of [1, -1]) {
          for (const shiftVector of fuzz) {
            const p1 = p.plusScaled(shiftVector, s);
            const q1 = snapVectorToCubeFeatures(p1);
            if (!ck.testLE(q1.angleTo(p).radians, smallTol, "snap on lattice points with small shift"))
              // never should reach this line
              snapVectorToCubeFeatures(p1);
            else {
              const matrix3 = Matrix3d.createRigidViewAxesZTowardsEye(q1.x, q1.y, q1.z);
              const z3 = matrix3.columnZ();
              ck.testLE(z3.angleTo(p).radians, bigTol, "column Z is parallel tp q1");
            }
          }
        }
        // big shift
        const p2 = p.plus(bigShift);
        const q2 = snapVectorToCubeFeatures(p2);
        if (!ck.testLE(q2.angleTo(p2).radians, smallTol, "snap on lattice points with big shift"))
          // never should reach this line
          snapVectorToCubeFeatures(p2);
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

function checkInverseRelationship(ck: bsiChecker.Checker, name: string, matrix: Matrix3d | undefined,
  expectedInverseState: InverseMatrixState | undefined) {
  if (matrix !== undefined) {
    if (bsiChecker.Checker.noisy.matrixMultiplyAliasing) {
      GeometryCoreTestIO.consoleLog("-------------------------------");
      GeometryCoreTestIO.consoleLog(`${name}    ${matrix.coffs}`, ` inverse state ${matrix.inverseState}        `);
      GeometryCoreTestIO.consoleLog(`cached inverse    ${matrix.inverseCoffs}`);
    }
    if (expectedInverseState !== undefined)
      ck.testExactNumber(expectedInverseState, matrix.inverseState, `${name} inverse state`);
    if (matrix.inverseState === InverseMatrixState.inverseStored) {
      const product = Matrix3d.createScale(1, 2, 3);
      PackedMatrix3dOps.multiplyMatrixMatrix(matrix.coffs, matrix.inverseCoffs!, product.coffs);
      ck.testTrue(product.isIdentity, "confirm inverseCoffs", product);
    }
  }
}
function testProductCombinations(
  ck: bsiChecker.Checker,
  matrixA0: Matrix3d,
  matrixB0: Matrix3d,
  expectInvertible: boolean,
  f: (matrixA: Matrix3d, matrixB: Matrix3d, result?: Matrix3d) => Matrix3d | undefined,
  expectedInverseState: InverseMatrixState | undefined,
) {
  const matrixA = matrixA0.clone();
  const matrixB = matrixB0.clone();
  const masterResult = f(matrixA, matrixB);
  if (masterResult !== undefined) {
    checkInverseRelationship(ck, "AB", masterResult, expectedInverseState);
    const matrixAInverse = matrixA.inverse();
    const matrixBInverse = matrixB.inverse();
    if (expectedInverseState !== undefined)
      ck.testExactNumber(expectedInverseState, masterResult.inverseState, "master state");
    if (expectInvertible) {
      ck.testDefined(matrixAInverse, "expect invertible A");
      ck.testDefined(matrixBInverse, "expect invertible B");
      const masterResultInverse = masterResult.inverse();
      if (ck.testPointer(masterResultInverse)) {
        const inverseTest = masterResultInverse.multiplyMatrixMatrix(masterResult);
        ck.testDefined(inverseTest);
        ck.testTrue(inverseTest.isIdentity, "confirm masterResultInverse", inverseTest);
      }
    }
    const expectMasterResultInverseCoffs = expectInvertible && matrixA.hasCachedInverse && matrixB.hasCachedInverse;
    ck.testBoolean(expectMasterResultInverseCoffs, masterResult.hasCachedInverse);

    if (masterResult) {
      // pre-allocate result:
      const matrixA1 = matrixA.clone();
      const matrixB1 = matrixB.clone();
      const matrixC1 = Matrix3d.createZero(); // pre-allocated result
      const result1 = f(matrixA1, matrixB1, matrixC1);
      checkInverseRelationship(ck, "AB 1", result1, expectedInverseState);
      if (ck.testPointer(result1)) {
        ck.testMatrix3d(masterResult, result1, "f(A,B) vs f(A,B,result)");
        ck.testMatrix3d(masterResult, matrixC1, "f(A,B) vs f(A,B,result)");
        ck.testBoolean(expectMasterResultInverseCoffs, result1.hasCachedInverse);
      }
      // reuse A:
      const matrixA2 = matrixA.clone();
      const matrixB2 = matrixB.clone();
      const result2 = f(matrixA2, matrixB2, matrixA2);
      checkInverseRelationship(ck, "AB 2", result2, expectedInverseState);

      if (ck.testPointer(result2)) {
        ck.testMatrix3d(masterResult, result2, "f(A,B) vs f(A,B,A)");
        ck.testMatrix3d(masterResult, matrixA2, "f(A,B) vs f(A,B,A)");
        ck.testBoolean(expectMasterResultInverseCoffs, result2.hasCachedInverse);
      }
      // reuse B:
      const matrixA3 = matrixA.clone();
      const matrixB3 = matrixB.clone();
      const result3 = f(matrixA3, matrixB3, matrixB3);
      checkInverseRelationship(ck, "AB 3", result3, expectedInverseState);
      if (ck.testPointer(result3)) {
        ck.testMatrix3d(masterResult, result3, "f(A,B) vs f(A,B,B)");
        ck.testMatrix3d(masterResult, matrixB3, "f(A,B) vs f(A,B,B)");
        ck.testBoolean(expectMasterResultInverseCoffs, result3.hasCachedInverse);
      }
    }
  }
}
describe("Matrix3d.MatrixProduct", () => {
  it("Matrix3d.MatrixProduct", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = Matrix3d.createRowValues(
      10, 1, 2,
      -3, 12, 4,
      3, 5, 15,
    );
    const matrixB = Matrix3d.createRowValues(
      9, 0.2, 2.2,
      -3.5, 12.5, 4.1,
      3.9, -2.1, 17.8,
    );
    const matrixAB = matrixA.multiplyMatrixMatrix(matrixB);
    const matrixABT = matrixA.multiplyMatrixMatrixTranspose(matrixB);
    const matrixATB = matrixA.multiplyMatrixTransposeMatrix(matrixB);
    ck.testExactNumber(InverseMatrixState.unknown, matrixAB.inverseState);
    ck.testExactNumber(InverseMatrixState.unknown, matrixABT.inverseState);
    ck.testExactNumber(InverseMatrixState.unknown, matrixATB.inverseState);
    // confirm that multiplies without inversion did not introduce inverse
    ck.testExactNumber(InverseMatrixState.unknown, matrixA.inverseState);
    ck.testExactNumber(InverseMatrixState.unknown, matrixB.inverseState);

    const vectorU = Vector3d.create(1.4, 2.3, 9.1);
    ck.testUndefined(matrixA.inverseCoffs);
    ck.testUndefined(matrixB.inverseCoffs);
    matrixA.multiplyInverse(vectorU);
    matrixB.multiplyInverse(vectorU);
    // confirm that multiplies with inversion did introduce inverse
    ck.testDefined(matrixA.inverseCoffs);
    ck.testDefined(matrixB.inverseCoffs);

    testProductCombinations(
      ck, matrixA, matrixB, true,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d =>
        matrixA1.multiplyMatrixMatrix(matrixB1, result1),
      InverseMatrixState.inverseStored,
    );
    testProductCombinations(
      ck, matrixA, matrixB, true,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d | undefined =>
        matrixA1.multiplyMatrixInverseMatrix(matrixB1, result1),
      InverseMatrixState.inverseStored,
    );
    testProductCombinations(
      ck, matrixA, matrixB, true,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d | undefined =>
        matrixA1.multiplyMatrixMatrixInverse(matrixB1, result1),
      InverseMatrixState.inverseStored,
    );

    testProductCombinations(
      ck, matrixA, matrixB, true,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d | undefined =>
        matrixA1.multiplyMatrixTransposeMatrix(matrixB1, result1),
      InverseMatrixState.inverseStored,
    );
    testProductCombinations(
      ck, matrixA, matrixB, true,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d | undefined =>
        matrixA1.multiplyMatrixMatrixTranspose(matrixB1, result1),
      InverseMatrixState.inverseStored,
    );
    const singularMatrix = Matrix3d.createScale(1, 0, 1);
    testProductCombinations(
      ck, matrixA, singularMatrix, false,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d =>
        matrixA1.multiplyMatrixMatrix(matrixB1, result1),
      InverseMatrixState.singular,
    );
    testProductCombinations(
      ck, matrixA, singularMatrix, false,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d | undefined =>
        matrixA1.multiplyMatrixTransposeMatrix(matrixB1, result1),
      InverseMatrixState.singular,
    );
    testProductCombinations(
      ck, matrixA, singularMatrix, false,
      (matrixA1: Matrix3d, matrixB1: Matrix3d, result1?: Matrix3d): Matrix3d | undefined =>
        matrixA1.multiplyMatrixMatrixTranspose(matrixB1, result1),
      InverseMatrixState.singular,
    );
    ck.testUndefined(matrixA.multiplyMatrixMatrixInverse(singularMatrix), "singular product");
    ck.testUndefined(singularMatrix.multiplyMatrixInverseMatrix(matrixA), "singular product");

    const matrix = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(20))!;
    for (const result of [undefined, Matrix3d.createIdentity()]) {
      checkInverseRelationship(
        ck,
        "inverse",
        matrix.inverse(result),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      const angle = Angle.createRadians(Math.atan2(0.027550936532400754, 0.9996204009003555));
      checkInverseRelationship(
        ck,
        "zRotation",
        Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, angle),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      checkInverseRelationship(
        ck,
        "zRotation",
        Matrix3d.createRotationAroundVector(Vector3d.unitZ(), angle),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      checkInverseRelationship(
        ck,
        "AB",
        matrix.multiplyMatrixMatrix(matrixB, result),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      checkInverseRelationship(
        ck,
        "ABInverse",
        matrix.multiplyMatrixMatrixInverse(matrixB, result),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      checkInverseRelationship(
        ck,
        "AInverseB",
        matrix.multiplyMatrixInverseMatrix(matrixB, result),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      checkInverseRelationship(
        ck,
        "ABTranspose",
        matrix.multiplyMatrixMatrixTranspose(matrixB, result),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();

      checkInverseRelationship(
        ck,
        "ATransposeB",
        matrix.multiplyMatrixMatrixTranspose(matrixB, result),
        InverseMatrixState.inverseStored,
      );
      if (result)
        result.setZero();
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.CloneRigid", () => {
  it("Matrix3d.CloneRigid", () => {
    const ck = new bsiChecker.Checker();
    const matrix = Matrix3d.createRowValues(
      -6.438509378433656e-18, -1.0840344784091856e-18, -0.008851813267008355,
      7.88489990157899e-34, -0.008851813267008355, 1.0840344784091856e-18,
      -0.008851813267008355, 0, 6.438509378433656e-18,
    );
    const origin = Point3d.create(1, 2, 3);
    const transform = Transform.createOriginAndMatrix(origin, matrix);
    const rigidTransform = transform.cloneRigid(AxisOrder.XYZ);
    ck.testType(rigidTransform, Transform, "confirm cloneRigid returned a Transform.");

    for (const scale of [1.0 / matrix.maxAbs(), 10, 100, 1000]) {
      const matrix1 = matrix.scale(scale);
      const transform1 = Transform.createOriginAndMatrix(origin, matrix1);
      const rigidTransform1 = transform1.cloneRigid(AxisOrder.XYZ);
      ck.testType(rigidTransform1, Transform, "confirm cloneRigid returned a Transform.");
    }

    for (const scale of [1.0e-5, 1.0e-4, 1.0e-2, 1, 1.0e3, 1.0e6]) {
      const scaleMatrix = Matrix3d.createScale(scale, scale, scale);
      const rigidScaleMatrix = Matrix3d.createRigidFromMatrix3d(scaleMatrix);
      ck.testTrue(rigidScaleMatrix !== undefined && rigidScaleMatrix.isIdentity, "normalize of uniform scale");
    }

    const epsMatrix = Matrix3d.createScale(1.0e-10, 1.0e-10, 1.0e-10);
    const eps = 1.0e-10;
    ck.testUndefined(Matrix3d.createRigidFromMatrix3d(epsMatrix), "expect no rigid from epsilon matrix");
    const matrixD = Matrix3d.createRowValues(
      1, 1, 0,
      0, eps, 0,
      0, eps, 1,
    );
    ck.testUndefined(Matrix3d.createRigidFromMatrix3d(matrixD), "expect no rigid from matrix with near-parallel columns");

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.SetColumns", () => {
  it("Matrix3d.SetColumns", () => {
    const ck = new bsiChecker.Checker();
    const vectorX: Vector3d = Vector3d.create(1, 2, 3);
    const vectorY: Vector3d = Vector3d.create(4, 5, 6);
    const expectedMatrix: Matrix3d = Matrix3d.createRowValues(
      1, 4, 0,
      2, 5, 0,
      3, 6, 0,
    );
    const theMatrix = Matrix3d.createIdentity();
    theMatrix.setColumns(vectorX, vectorY);
    ck.testMatrix3d(theMatrix, expectedMatrix, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.SetRow", () => {
  it("Matrix3d.SetRow", () => {
    const ck = new bsiChecker.Checker();
    const vector: Vector3d = Vector3d.create(1, 2, 3);
    const expectedMatrix: Matrix3d = Matrix3d.createRowValues(
      1, 2, 3,
      0, 1, 0,
      0, 0, 1,
    );
    const theMatrix = Matrix3d.createIdentity();
    theMatrix.setRow(0, vector);
    ck.testMatrix3d(theMatrix, expectedMatrix, "matrixes are equal");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.CreateDirectionalScale", () => {
  it("Matrix3d.CreateDirectionalScale", () => {
    const scale = -1;
    const vector = Vector3d.create(1, 0, 1);
    const direction = Vector3d.create(0, 0, 1);
    const expectedDirectionScale = Vector3d.create(1, 0, -1);
    const matrix = Matrix3d.createDirectionalScale(direction, scale);
    const returnedDirectionScale = matrix.multiplyVector(vector);
    expect(expectedDirectionScale).to.deep.equal(returnedDirectionScale);
  });
});

describe("Matrix3d.createRigidHeadsUp", () => {
  it("Matrix3d.createRigidHeadsUp", () => {
    const ck = new bsiChecker.Checker();
    const normal = Vector3d.create(1, 2, 3);
    const matrix = Matrix3d.createRigidHeadsUp(normal);
    // equation of plane with the given normal passing through (0,0,0): x + 2y + 3z = 0
    const pointOnPlane = Vector3d.create(-5, 1, 1);
    const point = matrix.multiplyTransposeVector(pointOnPlane);
    ck.testCoordinate(point.z, 0);
  });
});

describe("Matrix3d.createRigidViewAxesZTowardsEye", () => {
  it("Matrix3d.createRigidViewAxesZTowardsEye", () => {
    const ck = new bsiChecker.Checker();
    const matrix = Matrix3d.createRigidViewAxesZTowardsEye(1, 2, 3); // plane normal is (1,2,3)
    // equation of plane with the given normal passing through (0,0,0): x + 2y + 3z = 0
    const pointOnPlane = Vector3d.create(-5, 1, 1);
    const point = matrix.multiplyTransposeVector(pointOnPlane);
    ck.testCoordinate(point.z, 0);
  });
});

