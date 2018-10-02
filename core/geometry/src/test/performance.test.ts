/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { } from "../geometry3d/PointVector";
import { Matrix3d } from "../geometry3d/Transform";
import { Geometry } from "../Geometry";
import { GrowableFloat64Array, GrowableXYZArray } from "../geometry3d/GrowableArray";
import { Point3d } from "../geometry3d/PointVector";
/* tslint:disable:no-console no-unused-variable */

function inverseCalculationLoop(numTest: number, usingCache: boolean, usingResult: boolean) {
  const savedFlag = Matrix3d.useCachedInverse;
  const matrix = Matrix3dOps.createRowValues(
    5, 1, 2,
    3, 8, 2,
    1, -2, 8) as Matrix3d;
  // Give result storage a temporary value
  let inverse: Matrix3d = Matrix3d.createIdentity();

  if (usingCache)
    Matrix3d.useCachedInverse = true;
  else
    Matrix3d.useCachedInverse = false;
  const name: string = "Matrix3d inverse "
    + (usingCache ? "Cache" : "NoCache") + " " + (usingResult ? "preallocate" : "new");

  if (usingResult) {
    console.time(name);
    for (let k = 0; k < numTest; k++) {
      inverse = matrix.inverse(inverse) as Matrix3d;
    }
    console.timeEnd(name);
  } else {
    console.time(name);
    for (let k = 0; k < numTest; k++) {
      inverse = matrix.inverse() as Matrix3d;
    }
    console.timeEnd(name);
  }
  Matrix3d.useCachedInverse = savedFlag;
}

function hypotenuseCalculationLoop(numTest: number, funcIdentifier: number) {
  let name: string;

  // funcIdentifiers 0, 2, 4 are geometry lib functions, while 1, 3, 5 are Math lib equivalent functions
  switch (funcIdentifier) {
    case 0:
      Geometry.hypotenuseXY(10, -5);
      name = "Geometry_HypotenuseXY";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseXY(10, -5);
      }
      console.timeEnd(name);
      break;

    case 1:
      name = "Math_HypotenuseXY";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Math.hypot(10, -5);
      }
      console.timeEnd(name);
      break;

    case 2:
      name = "Geometry_HypotenuseXYZ: ";
      Geometry.hypotenuseXYZ(10, -5, 2);
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseXYZ(10, -5, 2);
      }
      console.timeEnd(name);
      break;

    case 3:
      name = "Math_HypotenuseXYZ";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Math.hypot(10, -5, 2);
      }
      console.timeEnd(name);
      break;

    case 4:
      name = "Geometry_HypotenuseXYZW: ";
      Geometry.hypotenuseXYZW(10, -5, 2, 7);
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseXYZW(10, -5, 2, 7);
      }
      console.timeEnd(name);
      break;

    case 5:
      name = "Math_HypotenuseXYZW";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Math.hypot(10, -5, 2, 7);
      }
      console.timeEnd(name);
      break;

    /*     case 6:
          name = "Geometry_HypotenuseVariableXYZW";
          console.time(name);
          for (let i = 0; i < numTest; i++) {
            Geometry.tempHypot(10, -5, 2, 7);
          }
          console.timeEnd(name);
          break;
    */
    case 7:
      name = "Geometry_HypotenuseSquaredXY";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseSquaredXY(10, -5);
      }
      console.timeEnd(name);
      break;

    case 8:
      name = "Geometry_HypotenuseSquaredXYZ";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseSquaredXYZ(10, -5, 2);
      }
      console.timeEnd(name);
      break;

    case 9:
      name = "Geometry_HypotenuseWSquaredXYZW";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseSquaredXYZW(10, -5, 2, 7);
      }
      console.timeEnd(name);
      break;
    default:
      console.log("ERROR - Incorrect function identifier in hypotenuse performance test");
      return;
  }
}

function hypotenuseSquaredCalculationLoop(numTest: number, funcIdentifier: number) {
  let name: string;

  // funcIdentifiers 0, 1, 2 are geometry lib functions for XY, XYZ, and XYZW
  switch (funcIdentifier) {
    case 0:
      name = "Geometry_HypotenuseSquaredXY";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseSquaredXY(10, -5);
      }
      console.timeEnd(name);
      break;

    case 1:
      name = "Geometry_HypotenuseSquaredXYZ";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseSquaredXYZ(10, -5, 2);
      }
      console.timeEnd(name);
      break;

    case 2:
      name = "Geometry_HypotenuseWSquaredXYZW";
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        Geometry.hypotenuseSquaredXYZW(10, -5, 2, 7);
      }
      console.timeEnd(name);
      break;

    default:
      console.log("ERROR - Incorrect function identifier in hypotenuse performance test");
      return;
  }
}

function arrayCheck(numTest: number, type: number) {
  let name: string;
  let arr: any;
  const toPush = Point3d.create(1, 2, 3);

  switch (type) {
    case 1:   // Normal Javascript array (float)
      name = "Javascript_Float_Array";
      arr = [10, 1, 9, 2];
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        // Fetch items
        arr[0];
        arr[1];
        arr[2];
        // Push items
        arr.push(1);
        arr.push(2);
        arr.push(3);
        // Pop items
        arr.pop();
        arr.pop();
        arr.pop();
        // Get length
        arr.length;
        arr.length;
        arr.length;
        // Reassignment
        arr[1] = 5;
        arr[0] = 3;
        arr[2] = 1;
      }
      console.timeEnd(name);
      break;

    case 2:   // Growable array (float)
      name = "Growable_Float_Array";
      arr = new GrowableFloat64Array();
      arr.push(10); arr.push(1); arr.push(9); arr.push(2);
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        // Fetch items
        arr.at(0);
        arr.at(1);
        arr.at(2);
        // Push items
        arr.push(1);
        arr.push(2);
        arr.push(3);
        // Pop items
        arr.pop();
        arr.pop();
        arr.pop();
        // Get length
        arr.length();
        arr.length();
        arr.length();
        // Reassignment
        arr.reassign(1, 5);
        arr.reassign(0, 3);
        arr.reassign(2, 1);
      }
      console.timeEnd(name);
      break;

    case 3:   // Javascript array (point)
      name = "Javascript_Point_Array";
      arr = [Point3d.create(0, 0, 0), Point3d.create(1, 1, 1), Point3d.create(2, 2, 2)];
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        // Fetch items
        arr[0];
        arr[1];
        arr[2];
        // Push items
        arr.push(toPush.clone());
        arr.push(toPush.clone());
        arr.push(toPush.clone());
        // Pop items
        arr.pop();
        arr.pop();
        arr.pop();
        // Get length
        arr.length;
        arr.length;
        arr.length;
        // Reassignment
        arr[1] = Point3d.create(1, 3, 5);
        arr[0] = Point3d.create(0, 3, 5);
        arr[2] = Point3d.create(-1, 3, 5);
      }
      console.timeEnd(name);
      break;

    case 4:   // Growable array (Point)
      name = "Growable_Point_Array";
      arr = new GrowableXYZArray();
      const result = Point3d.create();
      arr.push(Point3d.create(0, 0, 0)); arr.push(Point3d.create(1, 1, 1)); arr.push(Point3d.create(2, 2, 2));
      console.time(name);
      for (let i = 0; i < numTest; i++) {
        // Fetch items
        arr.atPoint3dIndex(0, result);
        arr.atPoint3dIndex(1, result);
        arr.atPoint3dIndex(2, result);
        // Push items
        arr.push(toPush);
        arr.push(toPush);
        arr.push(toPush);
        // Pop items
        arr.pop();
        arr.pop();
        arr.pop();
        // Get length
        arr.length;
        arr.length;
        arr.length;
        // Reassignment
        arr.setCoordinates(1, 1, 3, 5);
        arr.setCoordinates(0, 0, 3, 5);
        arr.setCoordinates(2, 1, 3, 5);
      }
      console.timeEnd(name);
      break;
  }
}

export class Matrix3dOps extends Matrix3d {
  /** Multiply two matrices.* */
  public static multiplyMatrixMatrix_directAssignment(matrixA: Matrix3d, matrixB: Matrix3d, result?: Matrix3d): Matrix3d {
    // WARNING -- matrixA does not allow result to be the same as one of the inputs . . .
    result = result ? result : new Matrix3d();
    result.coffs[0] = (matrixA.coffs[0] * matrixB.coffs[0] + matrixA.coffs[1] * matrixB.coffs[3] + matrixA.coffs[2] * matrixB.coffs[6]);
    result.coffs[1] = (matrixA.coffs[0] * matrixB.coffs[1] + matrixA.coffs[1] * matrixB.coffs[4] + matrixA.coffs[2] * matrixB.coffs[7]);
    result.coffs[2] = (matrixA.coffs[0] * matrixB.coffs[2] + matrixA.coffs[1] * matrixB.coffs[5] + matrixA.coffs[2] * matrixB.coffs[8]);
    result.coffs[3] = (matrixA.coffs[3] * matrixB.coffs[0] + matrixA.coffs[4] * matrixB.coffs[3] + matrixA.coffs[5] * matrixB.coffs[6]);
    result.coffs[4] = (matrixA.coffs[3] * matrixB.coffs[1] + matrixA.coffs[4] * matrixB.coffs[4] + matrixA.coffs[5] * matrixB.coffs[7]);
    result.coffs[5] = (matrixA.coffs[3] * matrixB.coffs[2] + matrixA.coffs[4] * matrixB.coffs[5] + matrixA.coffs[5] * matrixB.coffs[8]);
    result.coffs[6] = (matrixA.coffs[6] * matrixB.coffs[0] + matrixA.coffs[7] * matrixB.coffs[3] + matrixA.coffs[8] * matrixB.coffs[6]);
    result.coffs[7] = (matrixA.coffs[6] * matrixB.coffs[1] + matrixA.coffs[7] * matrixB.coffs[4] + matrixA.coffs[8] * matrixB.coffs[7]);
    result.coffs[8] = (matrixA.coffs[6] * matrixB.coffs[2] + matrixA.coffs[7] * matrixB.coffs[5] + matrixA.coffs[8] * matrixB.coffs[8]);
    return result;
  }
  public static multiplyMatrixMatrix_directAssignmentN(numReps: number, matrixA: Matrix3d, matrixB: Matrix3d, result?: Matrix3d): Matrix3d {
    // WARNING -- matrixA does not allow result to be the same as one of the inputs . . .
    result = result ? result : new Matrix3d();
    for (let i = 0; i < numReps; i++) {
      result.coffs[0] = (matrixA.coffs[0] * matrixB.coffs[0] + matrixA.coffs[1] * matrixB.coffs[3] + matrixA.coffs[2] * matrixB.coffs[6]);
      result.coffs[1] = (matrixA.coffs[0] * matrixB.coffs[1] + matrixA.coffs[1] * matrixB.coffs[4] + matrixA.coffs[2] * matrixB.coffs[7]);
      result.coffs[2] = (matrixA.coffs[0] * matrixB.coffs[2] + matrixA.coffs[1] * matrixB.coffs[5] + matrixA.coffs[2] * matrixB.coffs[8]);
      result.coffs[3] = (matrixA.coffs[3] * matrixB.coffs[0] + matrixA.coffs[4] * matrixB.coffs[3] + matrixA.coffs[5] * matrixB.coffs[6]);
      result.coffs[4] = (matrixA.coffs[3] * matrixB.coffs[1] + matrixA.coffs[4] * matrixB.coffs[4] + matrixA.coffs[5] * matrixB.coffs[7]);
      result.coffs[5] = (matrixA.coffs[3] * matrixB.coffs[2] + matrixA.coffs[4] * matrixB.coffs[5] + matrixA.coffs[5] * matrixB.coffs[8]);
      result.coffs[6] = (matrixA.coffs[6] * matrixB.coffs[0] + matrixA.coffs[7] * matrixB.coffs[3] + matrixA.coffs[8] * matrixB.coffs[6]);
      result.coffs[7] = (matrixA.coffs[6] * matrixB.coffs[1] + matrixA.coffs[7] * matrixB.coffs[4] + matrixA.coffs[8] * matrixB.coffs[7]);
      result.coffs[8] = (matrixA.coffs[6] * matrixB.coffs[2] + matrixA.coffs[7] * matrixB.coffs[5] + matrixA.coffs[8] * matrixB.coffs[8]);
    }

    return result;
  }

  /** Multiply two matrices */
  public static multiplyMatrixMatrix(matrixA: Matrix3d, matrixB: Matrix3d, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues(
      (matrixA.coffs[0] * matrixB.coffs[0] + matrixA.coffs[1] * matrixB.coffs[3] + matrixA.coffs[2] * matrixB.coffs[6]),
      (matrixA.coffs[0] * matrixB.coffs[1] + matrixA.coffs[1] * matrixB.coffs[4] + matrixA.coffs[2] * matrixB.coffs[7]),
      (matrixA.coffs[0] * matrixB.coffs[2] + matrixA.coffs[1] * matrixB.coffs[5] + matrixA.coffs[2] * matrixB.coffs[8]),
      (matrixA.coffs[3] * matrixB.coffs[0] + matrixA.coffs[4] * matrixB.coffs[3] + matrixA.coffs[5] * matrixB.coffs[6]),
      (matrixA.coffs[3] * matrixB.coffs[1] + matrixA.coffs[4] * matrixB.coffs[4] + matrixA.coffs[5] * matrixB.coffs[7]),
      (matrixA.coffs[3] * matrixB.coffs[2] + matrixA.coffs[4] * matrixB.coffs[5] + matrixA.coffs[5] * matrixB.coffs[8]),
      (matrixA.coffs[6] * matrixB.coffs[0] + matrixA.coffs[7] * matrixB.coffs[3] + matrixA.coffs[8] * matrixB.coffs[6]),
      (matrixA.coffs[6] * matrixB.coffs[1] + matrixA.coffs[7] * matrixB.coffs[4] + matrixA.coffs[8] * matrixB.coffs[7]),
      (matrixA.coffs[6] * matrixB.coffs[2] + matrixA.coffs[7] * matrixB.coffs[5] + matrixA.coffs[8] * matrixB.coffs[8]),
      result);
  }
}
class TimingTests {

  public static RunTestA(numTest: number) {
    console.log("\n performance reps ", numTest);
    const matrixA = Matrix3d.createScale(1, 2, 3);
    const matrixB = Matrix3d.createScale(2, -1, 2);

    // Non direct assignment with no pre-allocated result. let defined inside loop
    console.time("multiplyMatrixMatrix");
    for (let k = 0; k < numTest; k++)
      matrixA.multiplyMatrixMatrix(matrixB);
    console.timeEnd("multiplyMatrixMatrix");

    // Non direct assignment with pre-allocated result. let defined inside loop
    let matrixD = Matrix3d.createIdentity();
    console.time("multiplyMatrixMatrix(result)");
    for (let k = 0; k < numTest; k++)
      matrixD = matrixA.multiplyMatrixMatrix(matrixB, matrixD);
    console.timeEnd("multiplyMatrixMatrix(result)");

  }
  public static RunTestB(numTest: number) {
    const matrixA = Matrix3dOps.createScale(1, 2, 3);
    const matrixB = Matrix3dOps.createScale(2, -1, 2);

    let matrixD = Matrix3dOps.createIdentity();

    // Non direct assignment with no pre-allocated result
    console.log("\n performance reps ", numTest);
    console.time("Test_1_static_Outside");
    for (let k = 0; k < numTest; k++)
      matrixD = matrixA.multiplyMatrixMatrix(matrixB);
    console.timeEnd("Test_1_static_Outside");

    console.time("Test_pre-allocated_result_static_Outside");
    for (let k = 0; k < numTest; k++)
      matrixD = matrixA.multiplyMatrixMatrix(matrixB, matrixD);
    console.timeEnd("Test_pre-allocated_result_static_Outside");

    console.time("Matrix3dOps.multiplyMatrixMatrix_directAssignment");
    for (let k = 0; k < numTest; k++)
      matrixD = Matrix3dOps.multiplyMatrixMatrix_directAssignment(matrixA, matrixB, matrixD);
    console.timeEnd("Matrix3dOps.multiplyMatrixMatrix_directAssignment");

    for (let numReps = 0; numReps < 20; numReps = 3 * numReps + 1) {
      const name = "Matrix3dOps.multiplyMatrixMatrix_directAssignment (numReps " + numReps + ")";
      console.time(name);
      for (let k = 0; k < numTest; k++)
        matrixD = Matrix3dOps.multiplyMatrixMatrix_directAssignmentN(numReps, matrixA, matrixB, matrixD);
      console.timeEnd(name);
    }
  }
  public static RunTestC(numTest: number) {
    console.log("==================");
    inverseCalculationLoop(numTest, true, true);
    inverseCalculationLoop(numTest, false, true);
    inverseCalculationLoop(numTest, true, false);
    inverseCalculationLoop(numTest, false, false);
  }
  public static RunTestD(numTest: number) {
    console.log("==================");
    hypotenuseCalculationLoop(numTest, 1);
    hypotenuseCalculationLoop(numTest, 3);
    hypotenuseCalculationLoop(numTest, 5);
    // hypotenuseCalculationLoop(numTest, 6);

    hypotenuseCalculationLoop(numTest, 0);
    hypotenuseCalculationLoop(numTest, 0);
    hypotenuseCalculationLoop(numTest, 7);

    hypotenuseCalculationLoop(numTest, 2);
    hypotenuseCalculationLoop(numTest, 2);
    hypotenuseCalculationLoop(numTest, 8);

    hypotenuseCalculationLoop(numTest, 4);
    hypotenuseCalculationLoop(numTest, 4);
    hypotenuseCalculationLoop(numTest, 9);
  }
  public static RunTestE(numTest: number) {
    console.log("==================");
    hypotenuseSquaredCalculationLoop(numTest, 0);
    hypotenuseSquaredCalculationLoop(numTest, 1);
    hypotenuseSquaredCalculationLoop(numTest, 2);
  }
  public static RunTestG(numTest: number) {
    console.log("==================");
    // arrayCheck(numTest, 1);
    // arrayCheck(numTest, 2);
    arrayCheck(numTest, 3);
    arrayCheck(numTest, 4);
  }
}

const numTestGlobal = 200000;
describe("Geometry.Allocations", () => {
  it("Expect caller-supplied result to be faster than constructor", () => {
    TimingTests.RunTestA(numTestGlobal);
  });
});

describe("Geometry.ComputeBreakdown", () => {
  it("Expect increased time for shift to compute intensive", () => {
    TimingTests.RunTestB(numTestGlobal / 10); // too many tests times out if there are background processes !!!!
  });
});

describe("Geometry.RotInverseCalculations", () => {
  it("RotmatrixInverse with (Cache*New) variants", () => {
    const myCount = numTestGlobal / 2;
    TimingTests.RunTestC(myCount);
    TimingTests.RunTestC(myCount);
    TimingTests.RunTestC(myCount);
  });
});

describe("Geometry.Hypotenuse", () => {
  it("Math.hypotenuse against the Geometry's hypotenuse functions", () => {
    TimingTests.RunTestD(numTestGlobal);
  });
});

describe("Geometry.HypotenuseSquared", () => {
  it("Various runtimes of Geometry's hypotenuse squared functions", () => {
    TimingTests.RunTestE(numTestGlobal);
  });
});

describe("Array_Vs_Growable", () => {
  it("Use of indexing, pushing, popping, length, and reassignment of array types", () => {
    console.log({ numTest: numTestGlobal });
    TimingTests.RunTestG(numTestGlobal * 2);
  });
});
