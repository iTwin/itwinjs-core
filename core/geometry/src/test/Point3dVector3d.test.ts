/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform, Range3d, RotMatrix, Angle, AxisOrder, Point3d, Vector3d } from "../geometry-core";
import * as bsiChecker from "./Checker";
import { Sample } from "../serialization/GeometrySamples";
import { expect } from "chai";
/* tslint:disable:no-console */
export class MatrixTests {

  public static TestCreateProperties(ck: bsiChecker.Checker) {
    const matrix = RotMatrix.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(45.0));
    if (matrix) {
      const vectorA = Vector3d.create(10, 1, 1);
      const vectorB = Vector3d.create(2, 5, 4);
      ck.testVector3d(matrix.multiplyVector(vectorA),
        Vector3d.create(0, 0, 0).plus3Scaled(
          matrix.columnX(), vectorA.x,
          matrix.columnY(), vectorA.y,
          matrix.columnZ(), vectorA.z),
        "matrix * vector versus");

      ck.testVector3d(
        matrix.multiplyVector(vectorA),
        Vector3d.create(0, 0, 0).plus2Scaled(
          matrix.columnY(), vectorA.y,
          matrix.columnZ(), vectorA.z).plusScaled(matrix.columnX(), vectorA.x),
        "matrix * vector versus");

      const frame = RotMatrix.createRigidFromColumns(vectorA, vectorB, AxisOrder.XYZ);

      if (ck.testPointer(frame, "createPerpendicularColumns") && frame
        && ck.testBoolean(true, frame.testPerpendicularUnitRowsAndColumns(), "UnitPerpendicularColumns")) {

        const matrixT = matrix.transpose();
        const frameT = frame.transpose();
        for (let i = 0; i < 6; i++)
          ck.testVector3d(matrix.getRow(i), matrixT.getColumn(i), "row, column match in matrix, transpose");

        ck.testRotMatrix(matrixT.multiplyMatrixMatrix(frame), matrix.multiplyMatrixTransposeMatrix(frame), "multiplyMatrixTransposeMatrix");
        ck.testRotMatrix(matrix.multiplyMatrixMatrix(frameT), matrix.multiplyMatrixMatrixTranspose(frame), "multiplyMatrixMatrixTranspose");

        ck.testPerpendicular(vectorA, frame.columnZ(), "input X perp frame.Z");
        ck.testPerpendicular(vectorB, frame.columnZ(), "input Y perp frame.Z");
        ck.testParallel(vectorA, frame.columnX(), "input X parallel frame.X");
        ck.testCoordinateOrder(0, vectorB.dotProduct(frame.columnY()), "vectorB in positive XY half plane");
        MatrixTests.CheckProperties(ck, frame, false, true, true, true, undefined);

        const frame1 = frame.multiplyMatrixMatrix(RotMatrix.createScale(1, 1, 2));
        MatrixTests.CheckProperties(ck, frame1, false, false, false, true, false);

        const frame2 = frame.multiplyMatrixMatrix(RotMatrix.createScale(1, 1, -1));
        MatrixTests.CheckProperties(ck, frame2, false, true, false, true, false);
        let vector;
        const e = 1.0 / 64.0;
        for (vector of [
          Vector3d.create(1, 2, 3),
          Vector3d.create(0, 0, 1),
          Vector3d.create(1, 0, 0),
          Vector3d.create(0, 1, 0),
          Vector3d.create(e, e, 0.5),
          Vector3d.create(e, e, 3.0), // triggers near-z logic !!!
          Vector3d.create(e, e, 3.0),
        ]) {
          const triad = RotMatrix.createRigidHeadsUp(vector);
          if (ck.testPointer(triad) && triad) {
            MatrixTests.CheckProperties(ck, triad, undefined, true, true, true,
              vector.isAlmostEqual(Vector3d.unitZ()));
            ck.testParallel(vector, triad.columnZ());
          }
        }
      }
    }
  }
  public static CheckInverse(ck: bsiChecker.Checker, matrixA: RotMatrix) {
    const matrixB = matrixA.inverse();
    ck.testPointer(matrixB, "inverse");
    // console.log("matrixA", matrixA);
    // console.log("inverse", matrixB);
    if (matrixB) {
      const AB = matrixA.multiplyMatrixMatrix(matrixB);
      ck.testBoolean(true, AB.isIdentity, "A * Ainverse = I");
    }
  }
  public static CheckProperties(
    ck: bsiChecker.Checker,
    matrix: RotMatrix,
    isIdentity: boolean | undefined,
    isUnitPerpendicular: boolean,
    isRigid: boolean,
    isInvertible: boolean,
    isDiagonal: boolean | undefined) {
    if (isIdentity !== undefined)
      ck.testBoolean(isIdentity, matrix.isIdentity, "isIdentity");
    ck.testBoolean(isRigid, matrix.isRigid(), "isRigid");
    ck.testBoolean(isUnitPerpendicular, matrix.testPerpendicularUnitRowsAndColumns(), "unitPerpendicularMatrix");
    const inverse = matrix.inverse();
    if (isInvertible) {
      if (ck.testPointer(inverse, "inverse () completed as expected")
        && inverse !== undefined) {
        const product = matrix.multiplyMatrixMatrix(inverse);
        const a = product.maxDiff(RotMatrix.createIdentity());
        ck.testSmallRelative(a, "inverse*matrix == identity");
      }
    } else {
      ck.testBoolean(true, undefined === inverse, "inverse () failed as expected");
    }

    if (isDiagonal !== undefined)
      ck.testBoolean(isDiagonal, matrix.isDiagonal, "isDiagonal");
  }
  public static CheckPointArrays(
    ck: bsiChecker.Checker, pointA: Point3d[]) {
    const transform = Transform.createScaleAboutPoint(Point3d.create(3, 3, 3), 2);
    const pointB = transform.multiplyPoint3dArray(pointA);
    ck.testExactNumber(pointA.length, pointB.length, "mutliplyPoint3dArray simple create");

    pointB.pop();
    transform.multiplyPoint3dArray(pointA, pointB);  // pointB goes in too small !!!
    ck.testExactNumber(pointA.length, pointB.length, "mutliplyPoint3dArray needs push");

    pointB.push(Point3d.create(1, 1, 1)); // now it is bigger !!!
    transform.multiplyPoint3dArray(pointA, pointB);
    ck.testExactNumber(pointA.length, pointB.length, "mutliplyPoint3dArray needs push");

    const rangeA = Range3d.createArray(pointA);
    const rangeB = Range3d.createArray(pointB);
    const rangeC = transform.multiplyRange(rangeA);
    // simple scale applied to points or range has same range ...
    ck.testPoint3d(rangeB.low, rangeC.low, "transformed array, range");
    ck.testPoint3d(rangeB.high, rangeC.high, "transformed array, range");
  }

}

describe("RotMatrix.Construction", () => {
  it("Verify properties of RotMatrix.create", () => {
    const ck = new bsiChecker.Checker();
    MatrixTests.TestCreateProperties(ck);
    ck.checkpoint("End RotMatrix.Construction");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("RotMatrix.Inverse", () => {
  it("RotMatrix.Inverse", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = RotMatrix.createRowValues(4, 2, 1,
      -1, 5, 3,
      0.5, 0.75, 9);
    MatrixTests.CheckInverse(ck, matrixA);
    ck.checkpoint("End RotMatrix.Inverse");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Point3dArray.HelloWorld", () => {
  it("Point3dArray.HelloWorld", () => {
    const ck = new bsiChecker.Checker();
    const pointA = [Point3d.create(1, 2, 3), Point3d.create(4, 5, 2)];
    MatrixTests.CheckPointArrays(ck, pointA);
    ck.checkpoint("Point3dArray.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("RotMatrix.factorPerpendicularColumns", () => {
  it("RotMatrix.factorPerpendicularColumns", () => {
    const ck = new bsiChecker.Checker();
    for (const scale of [1, 10, 1000, 68234]) {
      for (const ef of [[0, 0, 0],
      [0.1, 0, 0],
      [0.1, 0.5, -0.3],
      [0.1, 0.5, 0.54],
      [-0.2, 0.8, 1.1],
      [0.01, 0, 0]]) {
        const e = ef[0];
        const f = ef[1];
        const g = ef[2];
        const matrixA = RotMatrix.createRowValues(
          2, 0, 2,
          e, f, -e,
          g, 1, 0);
        matrixA.scaleColumns(scale, scale, scale);
        const matrixB = RotMatrix.createZero();
        const matrixU = RotMatrix.createZero();
        matrixA.factorPerpendicularColumns(matrixB, matrixU);
        const matrixBU = matrixB.multiplyMatrixMatrix(matrixU);
        const matrixBTB = matrixB.multiplyMatrixTransposeMatrix(matrixB);
        if (bsiChecker.Checker.noisy.factorPerpendicularColumns) {
          console.log("A", matrixA);
          console.log("diagBTB", matrixBTB.at(0, 0), matrixBTB.at(1, 1), matrixBTB.at(1, 1), " error",
            matrixBTB.sumSquares() - matrixBTB.sumDiagonalSquares());
          console.log("B", matrixB);
          console.log("U", matrixU);
          console.log("BTB", matrixBTB);
        }
        ck.testBoolean(true, matrixBTB.isDiagonal, "BTB diagonal");
        ck.testCoordinate(0, matrixA.maxDiff(matrixBU), "factorPerpendicularColumns");
        ck.testBoolean(true, matrixU.isRigid());
      }
    }
    ck.checkpoint("RotMatrix.Columns");
    expect(ck.getNumErrors()).equals(0);
  });
});
describe("RotMatrix.symmetricEigenvalues", () => {
  it("RotMatrix.symmetricEigenvalues", () => {
    const ck = new bsiChecker.Checker();
    let caseCounter = 0;
    for (const lambda0 of [
      Vector3d.create(2, 1, 4),
      Vector3d.create(3, 2, -1)]) {
      for (const eigen0 of Sample.createRotMatrixArray()) {
        if (eigen0.isRigid()) {
          const matrixA = eigen0.scaleColumns(lambda0.x, lambda0.y, lambda0.z);
          const matrixB = matrixA.multiplyMatrixMatrixTranspose(eigen0);
          if (bsiChecker.Checker.noisy.symmetricEigenvalues) {
            console.log("*** SYMMETRIC EIGENVALUE CASE ", caseCounter++);
            console.log("GeneratorVectors", eigen0);
            console.log("symmetric matrix", matrixB);
            console.log("EXPECTED Eigenvalues", lambda0);
          }

          const eigen1 = RotMatrix.createIdentity();
          const lambda1 = Vector3d.create();
          matrixB.symmetricEigenvalues(eigen1, lambda1);

          const eigenF = RotMatrix.createIdentity();
          const lambdaF = Vector3d.create();
          matrixB.fastSymmetricEigenvalues(eigenF, lambdaF);
          const matrixAF = eigenF.scaleColumns(lambdaF.x, lambdaF.y, lambdaF.z);
          const matrixBF = matrixAF.multiplyMatrixMatrixTranspose(eigenF);
          ck.testBoolean(true, eigenF.isRigid(), "Eigenvector matrix is rigid");
          ck.testRotMatrix(matrixB, matrixBF, "Symmetric Eigenvalue reconstruction");

          // um .. order can change. Only the reconstruction has to match ..
          const matrixA1 = eigen1.scaleColumns(lambda1.x, lambda1.y, lambda1.z);
          const matrixB1 = matrixA1.multiplyMatrixMatrixTranspose(eigen1);
          ck.testBoolean(true, eigen1.isRigid(), "Eigenvector matrix is rigid");
          ck.testRotMatrix(matrixB, matrixB1, "Symmetric Eigenvalue reconstruction");
          if (bsiChecker.Checker.noisy.symmetricEigenvalues) {
            console.log(" FAST Eigenvalues ", lambdaF);
            console.log(" FAST product", matrixBF);
            console.log(" COMPUTED Eigenvalues ", lambda1);
            console.log(" product", matrixB1);
            console.log("   product error", matrixB.maxDiff(matrixB1));
          }
        }
      }
    }
    ck.checkpoint("RotMatrix.symmetricEigenvalues");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("RotMatrix.directDots", () => {
  it("RotMatrix.RotMatrix.directDots", () => {
    const ck = new bsiChecker.Checker();
    const matrix = RotMatrix.createRowValues(
      1, 2, 3,
      0.3, 0.77, 4.2,
      -0.02, 5, 9);
    const uu = matrix.columnXMagnitudeSquared();
    const uv = matrix.columnXDotColumnY();
    const vv = matrix.columnYMagnitudeSquared();
    const product = matrix.multiplyMatrixTransposeMatrix(matrix);
    ck.testExactNumber(uu, product.at(0, 0));
    ck.testExactNumber(vv, product.at(1, 1));
    ck.testExactNumber(uv, product.at(0, 1));
    ck.testExactNumber(matrix.columnXMagnitudeSquared(), product.at(0, 0));
    ck.testExactNumber(matrix.columnYMagnitudeSquared(), product.at(1, 1));
    ck.testExactNumber(matrix.columnZMagnitudeSquared(), product.at(2, 2));
    ck.checkpoint("RotMatrix.directDots");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("RotMatrix.cachedInverse", () => {
  it("cachedInverse", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = RotMatrix.createRowValues(
      1, 2, 3,
      0.3, 0.77, 4.2,
      -0.02, 5, 9);
    RotMatrix.numUseCache = 0;
    RotMatrix.numComputeCache = 0;
    RotMatrix.useCachedInverse = true;
    // first inverssion should do the calculation
    const inverseA1 = matrixA.inverse() as RotMatrix;
    ck.testTrue(matrixA.multiplyMatrixMatrix(inverseA1).isIdentity, "first inverse");
    // second inversion should reuse.
    const inverseA2 = matrixA.inverse() as RotMatrix;
    ck.testTrue(matrixA.multiplyMatrixMatrix(inverseA2).isIdentity, "first inverse");

    ck.testExactNumber(1, RotMatrix.numUseCache);
    ck.testExactNumber(1, RotMatrix.numComputeCache);
    const matrixB = matrixA.clone();
    const inverseB = RotMatrix.createIdentity();
    RotMatrix.numUseCache = 0;
    RotMatrix.numComputeCache = 0;
    const numInvert = 10;
    for (let i = 0; i < numInvert; i++) {
      matrixB.inverse(inverseB);
      const product = matrixB.multiplyMatrixMatrix(inverseB);
      ck.testTrue(product.isIdentity);
    }

    ck.testExactNumber(1, RotMatrix.numComputeCache);
    ck.testExactNumber(numInvert - 1, RotMatrix.numUseCache);
    ck.checkpoint("RotMatrix.cachedInverse");
    expect(ck.getNumErrors()).equals(0);
  });
});
