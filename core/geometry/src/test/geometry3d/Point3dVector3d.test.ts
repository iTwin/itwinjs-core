/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AxisOrder, PerpParallelOptions } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { XYZProps } from "../../geometry3d/XYZProps";
import * as bsiChecker from "../Checker";

/* eslint-disable no-console */
export class MatrixTests {

  public static testCreateProperties(ck: bsiChecker.Checker) {
    const matrix = Matrix3d.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(45.0));
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

      const frame = Matrix3d.createRigidFromColumns(vectorA, vectorB, AxisOrder.XYZ);

      if (ck.testPointer(frame, "createPerpendicularColumns") && frame
        && ck.testBoolean(true, frame.testPerpendicularUnitRowsAndColumns(), "UnitPerpendicularColumns")) {

        const matrixT = matrix.transpose();
        const frameT = frame.transpose();
        for (let i = 0; i < 6; i++)
          ck.testVector3d(matrix.getRow(i), matrixT.getColumn(i), "row, column match in matrix, transpose");

        ck.testMatrix3d(matrixT.multiplyMatrixMatrix(frame), matrix.multiplyMatrixTransposeMatrix(frame), "multiplyMatrixTransposeMatrix");
        ck.testMatrix3d(matrix.multiplyMatrixMatrix(frameT), matrix.multiplyMatrixMatrixTranspose(frame), "multiplyMatrixMatrixTranspose");

        ck.testPerpendicular(vectorA, frame.columnZ(), "input X perp frame.Z");
        ck.testPerpendicular(vectorB, frame.columnZ(), "input Y perp frame.Z");
        ck.testParallel(vectorA, frame.columnX(), "input X parallel frame.X");
        ck.testCoordinateOrder(0, vectorB.dotProduct(frame.columnY()), "vectorB in positive XY half plane");
        MatrixTests.checkProperties(ck, frame, false, true, true, true, undefined);

        const frame1 = frame.multiplyMatrixMatrix(Matrix3d.createScale(1, 1, 2));
        MatrixTests.checkProperties(ck, frame1, false, false, false, true, false);

        const frame2 = frame.multiplyMatrixMatrix(Matrix3d.createScale(1, 1, -1));
        MatrixTests.checkProperties(ck, frame2, false, true, false, true, false);
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
          const triad = Matrix3d.createRigidHeadsUp(vector);
          if (ck.testPointer(triad)) {
            MatrixTests.checkProperties(ck, triad, undefined, true, true, true,
              vector.isAlmostEqual(Vector3d.unitZ()));
            ck.testParallel(vector, triad.columnZ());
          }
        }
      }
    }
  }
  public static checkInverse(ck: bsiChecker.Checker, matrixA: Matrix3d) {
    const matrixB = matrixA.inverse();
    ck.testPointer(matrixB, "inverse");
    // console.log("matrixA", matrixA);
    // console.log("inverse", matrixB);
    if (matrixB) {
      const AB = matrixA.multiplyMatrixMatrix(matrixB);
      ck.testBoolean(true, AB.isIdentity, "A * AInverse = I");
    }
  }
  public static checkProperties(
    ck: bsiChecker.Checker,
    matrix: Matrix3d,
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
        const a = product.maxDiff(Matrix3d.createIdentity());
        ck.testSmallRelative(a, "inverse*matrix == identity");
      }
    } else {
      ck.testBoolean(true, undefined === inverse, "inverse () failed as expected");
    }

    if (isDiagonal !== undefined)
      ck.testBoolean(isDiagonal, matrix.isDiagonal, "isDiagonal");
  }
  public static checkPointArrays(
    ck: bsiChecker.Checker, pointA: Point3d[]) {
    const transform = Transform.createScaleAboutPoint(Point3d.create(3, 3, 3), 2);
    const pointB = transform.multiplyPoint3dArray(pointA);
    ck.testExactNumber(pointA.length, pointB.length, "multiplyPoint3dArray simple create");

    pointB.pop();
    transform.multiplyPoint3dArray(pointA, pointB);  // pointB goes in too small !!!
    ck.testExactNumber(pointA.length, pointB.length, "multiplyPoint3dArray needs push");

    pointB.push(Point3d.create(1, 1, 1)); // now it is bigger !!!
    transform.multiplyPoint3dArray(pointA, pointB);
    ck.testExactNumber(pointA.length, pointB.length, "multiplyPoint3dArray needs push");

    const rangeA = Range3d.createArray(pointA);
    const rangeB = Range3d.createArray(pointB);
    const rangeC = transform.multiplyRange(rangeA);
    // simple scale applied to points or range has same range ...
    ck.testPoint3d(rangeB.low, rangeC.low, "transformed array, range");
    ck.testPoint3d(rangeB.high, rangeC.high, "transformed array, range");
  }

}

describe("Point3d.setFrom", () => {
  it("Point3d.setFrom", () => {
    const other: any = undefined;
    const thisPoint: Point3d = Point3d.create(1, 2, 3);
    const pointZero: Point3d = Point3d.create(0, 0, 0);
    thisPoint.setFrom(other);
    expect(thisPoint).to.deep.equal(pointZero);
  });
});

describe("Point3d.setFromPoint3d", () => {
  it("Point3d.setFromPoint3d", () => {
    const thisPoint: Point3d = Point3d.create(1, 2, 3);
    const pointZero: Point3d = Point3d.create(0, 0, 0);
    thisPoint.setFromPoint3d();
    expect(thisPoint).to.deep.equal(pointZero);
  });
});

describe("Point3d.Point3dToJson", () => {
  it("Point3d.Point3dToJsonPositive", () => {
    const point: Point3d = Point3d.create(1, 2, 3);
    const expectedJson: XYZProps = { x: 1, y: 2, z: 3 };
    const outputJson: XYZProps = point.toJSONXYZ();
    expect(outputJson).to.deep.equal(expectedJson);
  }),
    it("Point3d.Point3dToJsonNegative", () => {
      const point: Point3d = Point3d.create(1, 2, 3);
      const expectedJson: XYZProps = { x: 1, y: 3, z: 2 };
      const outputJson: any = point.toJSONXYZ();
      expect(outputJson.x).equal(expectedJson.x);
      expect(outputJson.y).not.equal(expectedJson.y);
      expect(outputJson.z).not.equal(expectedJson.z);
    });
});

describe("Point3d.accessX", () => {
  it("Point3d.accessX", () => {
    const args: any = "args";
    const x: any = Point3d.accessX(args);
    expect(x).equal(undefined);
  });
});

describe("Point3d.accessY", () => {
  it("Point3d.accessY", () => {
    const args: any = "args";
    const y: any = Point3d.accessY(args);
    expect(y).equal(undefined);
  });
});

describe("Point3d.accessZ", () => {
  it("Point3d.accessZ", () => {
    const args: any = "args";
    const z: any = Point3d.accessZ(args);
    expect(z).equal(undefined);
  });
});

describe("Point3d.x", () => {
  it("Point3d.xNotGiven", () => {
    const xyz: XYZProps = { y: 2, z: 3 };
    const x: number = Point3d.x(xyz);
    expect(x).equal(0);
  }),
    it("Point3d.xDefined", () => {
      const xyz: XYZProps = { x: 1, y: 2, z: 3 };
      const x: number = Point3d.x(xyz);
      expect(x).equal(1);
    }),
    it("Point3d.xUndefinedDefaultNotGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 0;
      const x: number = Point3d.x(xyz);
      expect(x).equal(defaultValue);
    }),
    it("Point3d.xUndefinedDefaultGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 5;
      const x: number = Point3d.x(xyz, defaultValue);
      expect(x).equal(defaultValue);
    });
});

describe("Point3d.y", () => {
  it("Point3d.yNotGiven", () => {
    const xyz: XYZProps = { x: 1, z: 3 };
    const y: number = Point3d.y(xyz);
    expect(y).equal(0);
  }),
    it("Point3d.yDefined", () => {
      const xyz: XYZProps = { x: 1, y: 2, z: 3 };
      const y: number = Point3d.y(xyz);
      expect(y).equal(2);
    }),
    it("Point3d.yUndefinedDefaultNotGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 0;
      const y: number = Point3d.y(xyz);
      expect(y).equal(defaultValue);
    }),
    it("Point3d.yUndefinedDefaultGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 5;
      const y: number = Point3d.y(xyz, defaultValue);
      expect(y).equal(defaultValue);
    });
});

describe("Point3d.z", () => {
  it("Point3d.zNotGiven", () => {
    const xyz: XYZProps = { x: 1, y: 2 };
    const z: number = Point3d.z(xyz);
    expect(z).equal(0);
  }),
    it("Point3d.zDefined", () => {
      const xyz: XYZProps = { x: 1, y: 2, z: 3 };
      const z: number = Point3d.z(xyz);
      expect(z).equal(3);
    }),
    it("Point3d.zUndefinedDefaultNotGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 0;
      const z: number = Point3d.z(xyz);
      expect(z).equal(defaultValue);
    }),
    it("Point3d.zUndefinedDefaultGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 5;
      const z: number = Point3d.z(xyz, defaultValue);
      expect(z).equal(defaultValue);
    });
});

describe("Point3d.createFromPacked", () => {
  it("Point3d.createFromPacked", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20]);
    const pointIndex: number = 100;
    const output: any = Point3d.createFromPacked(xyz, pointIndex);
    expect(output).to.deep.equal(undefined);
  });
});

describe("Point3d.createFromPackedXYZW", () => {
  it("Point3d.createFromPackedXYZW", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20]);
    const pointIndex: number = 100;
    const output: any = Point3d.createFromPackedXYZW(xyz, pointIndex);
    expect(output).to.deep.equal(undefined);
  });
});

describe("Point3d.createArrayFromPackedXYZ", () => {
  it("Point3d.createArrayFromPackedXYZ", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20, 50]);
    const point1: Point3d = Point3d.create(1, 2, 3);
    const point2: Point3d = Point3d.create(10, 15, 20);
    const arr: Point3d[] = Point3d.createArrayFromPackedXYZ(xyz);
    expect(arr[0]).to.deep.equal(point1);
    expect(arr[1]).to.deep.equal(point2);
  });
});

describe("Vector3d.setFromVector3d", () => {
  it("Vector3d.setFromVector3d", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const vectorZero: Vector3d = Vector3d.create(0, 0, 0);
    thisVector.setFromVector3d();
    expect(thisVector).to.deep.equal(vectorZero);
  });
});

describe("Vector3d.createArrayFromPackedXYZ", () => {
  it("Vector3d.createArrayFromPackedXYZ", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20, 50]);
    const vector1: Vector3d = Vector3d.create(1, 2, 3);
    const vector2: Vector3d = Vector3d.create(10, 15, 20);
    const arr: Vector3d[] = Vector3d.createArrayFromPackedXYZ(xyz);
    expect(arr[0]).to.deep.equal(vector1);
    expect(arr[1]).to.deep.equal(vector2);
  });
});

describe("Vector3d.createVectorFromArray", () => {
  it("Vector3d.createVectorFromArrayNonDefaultZ", () => {
    const nums: any = [1, 2, 3];
    const expectedVector: Vector3d = Vector3d.create(1, 2, 3);
    const outputVector: Vector3d = Vector3d.createFrom(nums);
    expect(outputVector).to.deep.equal(expectedVector);
  }),
    it("Vector3d.createVectorFromArrayDefaultZ", () => {
      const nums: any = [1, 2];
      const expectedVector: Vector3d = Vector3d.create(1, 2, 0);
      const outputVector: Vector3d = Vector3d.createFrom(nums);
      expect(outputVector).to.deep.equal(expectedVector);
    });
});

describe("Vector3d.fractionOfProjectionToVector", () => {
  it("Vector3d.fractionOfProjectionToVector", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const targetVector: Vector3d = Vector3d.create(0, 0, 0);
    const fraction: number = thisVector.fractionOfProjectionToVector(targetVector);
    expect(fraction).equal(0);
  });
});

describe("Vector3d.scaleToLength", () => {
  it("Vector3d.scaleToLength", () => {
    const thisVector: Vector3d = Vector3d.create(0, 0, 0);
    const length: number = 10;
    const output: any = thisVector.scaleToLength(length);
    expect(output).equal(undefined);
  });
});

describe("Vector3d.normalizeWithDefault", () => {
  it("Vector3d.normalizeWithDefault", () => {
    const thisVector: Vector3d = Vector3d.create(0, 0, 0);
    const expectedVector: Vector3d = Vector3d.create(1, 0, 0);
    const output: Vector3d = thisVector.normalizeWithDefault(0, 0, 0);
    expect(output).to.deep.equal(expectedVector);
  });
});

describe("Vector3d.dotProductStartEndXYZW", () => {
  it("Vector3d.dotProductStartEndXYZW", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const pointA: Point3d = Point3d.create(4, 5, 6);
    const weight: number = 0;
    const output: number = thisVector.dotProductStartEndXYZW(pointA, 10, 15, 20, weight);
    expect(output).equal(0);
  });
});

describe("Vector3d.angleFromPerpendicular", () => {
  it("Vector3d.angleFromPerpendicularPositiveDotProduct", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const planeNormal: Vector3d = Vector3d.create(1, 1, 1);
    const output: Angle = thisVector.angleFromPerpendicular(planeNormal);
    expect(output.radians).greaterThan(0);
    expect(output.radians).lessThan(Angle.piRadians);
  }),
    it("Vector3d.angleFromPerpendicularNegativeDotProduct", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const planeNormal: Vector3d = Vector3d.create(-1, -1, -1);
      const output: Angle = thisVector.angleFromPerpendicular(planeNormal);
      expect(output.radians).greaterThan(-Angle.piRadians);
      expect(output.radians).lessThan(0);
    });
});

describe("Vector3d.planarRadiansTo", () => {
  it("Vector3d.planarRadiansTo", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const vectorB: Vector3d = Vector3d.create(4, 5, 6);
    const planeNormal: Vector3d = Vector3d.create(0, 0, 0);
    const output: number = thisVector.planarRadiansTo(vectorB, planeNormal);
    expect(output).equal(0);
  });
});

describe("Vector3d.isParallelTo", () => {
  it("Vector3d.isParallelToWithZeroVector", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const other: Vector3d = Vector3d.create(0, 0, 0);
    const output: boolean = thisVector.isParallelTo(other);
    expect(output).equal(false);
  }),
    it("Vector3d.isParallelToTrueWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(1.01, 2.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1, distanceSquaredTol: 1 };
      const output: boolean = thisVector.isParallelTo(other, undefined, undefined, options);
      expect(output).equal(true);
    }),
    it("Vector3d.isParallelToFalseWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(1.01, 2.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1e-10, distanceSquaredTol: 1e-10 };
      const output: boolean = thisVector.isParallelTo(other, undefined, undefined, options);
      expect(output).equal(false);
    });
});

describe("Vector3d.isPerpendicularTo", () => {
  it("Vector3d.isPerpendicularToWithZeroVector", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const other: Vector3d = Vector3d.create(0, 0, 0);
    const output: boolean = thisVector.isPerpendicularTo(other);
    expect(output).equal(false);
  }),
    it("Vector3d.isPerpendicularToTrueWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(-2.01, 1.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1, distanceSquaredTol: 1 };
      const output: boolean = thisVector.isPerpendicularTo(other, undefined, options);
      expect(output).equal(true);
    }),
    it("Vector3d.isPerpendicularToFalseWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(-2.01, 1.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1e-10, distanceSquaredTol: 1e-10 };
      const output: boolean = thisVector.isPerpendicularTo(other, undefined, options);
      expect(output).equal(false);
    });
});

describe("Matrix3d.Construction", () => {
  it("Verify properties of Matrix3d.create", () => {
    const ck = new bsiChecker.Checker();
    MatrixTests.testCreateProperties(ck);
    ck.checkpoint("End Matrix3d.Construction");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.Inverse", () => {
  it("Matrix3d.Inverse", () => {
    const ck = new bsiChecker.Checker();
    const matrixA = Matrix3d.createRowValues(4, 2, 1,
      -1, 5, 3,
      0.5, 0.75, 9);
    MatrixTests.checkInverse(ck, matrixA);
    ck.checkpoint("End Matrix3d.Inverse");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Point3dArray.HelloWorld", () => {
  it("Point3dArray.HelloWorld", () => {
    const ck = new bsiChecker.Checker();
    const pointA = [Point3d.create(1, 2, 3), Point3d.create(4, 5, 2)];
    MatrixTests.checkPointArrays(ck, pointA);
    ck.checkpoint("Point3dArray.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Matrix3d.factorPerpendicularColumns", () => {
  it("Matrix3d.factorPerpendicularColumns", () => {
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
        const matrixA = Matrix3d.createRowValues(
          2, 0, 2,
          e, f, -e,
          g, 1, 0);
        matrixA.scaleColumns(scale, scale, scale);
        const matrixB = Matrix3d.createZero();
        const matrixU = Matrix3d.createZero();
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
    ck.checkpoint("Matrix3d.Columns");
    expect(ck.getNumErrors()).equals(0);
  });
});
// cspell:word eigen
describe("Matrix3d.symmetricEigenvalues", () => {
  it("Matrix3d.symmetricEigenvalues", () => {
    const ck = new bsiChecker.Checker();
    let caseCounter = 0;
    for (const lambda0 of [
      Vector3d.create(2, 1, 4),
      Vector3d.create(3, 2, -1)]) {
      for (const eigen0 of Sample.createMatrix3dArray()) {
        if (eigen0.isRigid()) {
          const matrixA = eigen0.scaleColumns(lambda0.x, lambda0.y, lambda0.z);
          const matrixB = matrixA.multiplyMatrixMatrixTranspose(eigen0);
          if (bsiChecker.Checker.noisy.symmetricEigenvalues) {
            console.log("*** SYMMETRIC EIGENVALUE CASE ", caseCounter++);
            console.log("GeneratorVectors", eigen0);
            console.log("symmetric matrix", matrixB);
            console.log("EXPECTED Eigenvalues", lambda0);
          }

          const eigen1 = Matrix3d.createIdentity();
          const lambda1 = Vector3d.create();
          matrixB.symmetricEigenvalues(eigen1, lambda1);

          const eigenF = Matrix3d.createIdentity();
          const lambdaF = Vector3d.create();
          matrixB.fastSymmetricEigenvalues(eigenF, lambdaF);
          const matrixAF = eigenF.scaleColumns(lambdaF.x, lambdaF.y, lambdaF.z);
          const matrixBF = matrixAF.multiplyMatrixMatrixTranspose(eigenF);
          ck.testBoolean(true, eigenF.isRigid(), "Eigenvector matrix is rigid");
          ck.testMatrix3d(matrixB, matrixBF, "Symmetric Eigenvalue reconstruction");

          // um .. order can change. Only the reconstruction has to match ..
          const matrixA1 = eigen1.scaleColumns(lambda1.x, lambda1.y, lambda1.z);
          const matrixB1 = matrixA1.multiplyMatrixMatrixTranspose(eigen1);
          ck.testBoolean(true, eigen1.isRigid(), "Eigenvector matrix is rigid");
          ck.testMatrix3d(matrixB, matrixB1, "Symmetric Eigenvalue reconstruction");
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
      -0.02, 5, 9);
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

    ck.testExactNumber(0, Matrix3d.numComputeCache, "B numComputeCache");
    ck.testExactNumber(numInvert, Matrix3d.numUseCache, "B numUseCache");
    expect(ck.getNumErrors()).equals(0);
  });
});
