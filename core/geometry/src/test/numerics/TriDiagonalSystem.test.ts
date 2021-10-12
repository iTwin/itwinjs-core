/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { TriDiagonalSystem } from "../../numerics/TriDiagonalSystem";
import { Checker } from "../Checker";

/* eslint-disable @typescript-eslint/naming-convention, no-console */

class TestFixture {
  public ck: Checker;
  public constructor() { this.ck = new Checker(); }

  // Tester Methods -------------------------------------------------------------------
  public checkX(A: TriDiagonalSystem, B: TriDiagonalSystem) {
    const n = A.order();
    for (let i = 0; i < n; i++) {
      // TODO: Implement correct method of comparing two Float64Array's
      this.ck.testCoordinate(A.getX(i), B.getX(i), "Solution vectors of A and B");
    }
  }
  public checkB(A: TriDiagonalSystem, B: TriDiagonalSystem) {
    const n = A.order();
    for (let i = 0; i < n; i++) {
      this.ck.testCoordinate(A.getB(i), B.getB(i), "Right side vectors of A and B");
    }
  }
  // Setup Methods --------------------------------------------------------------------
  public testOrder3() {
    const A = new TriDiagonalSystem(3);

    A.setRow(0, 1, 2, 1);
    A.setRow(1, 1, 2, 1);
    A.setRow(2, 1, 2, 1);
    A.setX(0, 2);
    A.setX(1, 3);
    A.setX(2, 4);
    A.multiplyAX();
    // Checker.noisy.tridiagonalSolver = true;
    if (Checker.noisy.tridiagonalSolver) {
      console.log("(1) A X AX");
      console.log(A);

    }
    const B: TriDiagonalSystem = A.copy();
    this.ck.testTrue(A.factorAndBackSubstitute(), "FactorAndBackSubstitute");
    this.ck.testTrue(A.factor(), "repeat factor");
    if (Checker.noisy.tridiagonalSolver) {
      console.log("(2) LU, X?, AX");
      console.log(A);
    }
    A.multiplyAX();
    if (Checker.noisy.tridiagonalSolver) {
      console.log("(3) LU, X?, LU(X?)");
      console.log(A);
    }
    this.checkX(A, B);
    this.checkB(A, B);
    const pointX0 = [];
    for (let i = 0; i < 3; i++) {
      const x = A.getX(i);
      pointX0.push(Point3d.create(x, 2.0 * x, x + 1.0));
    }
    const pointB: Point3d[] = [];
    const pointX: Point3d[] = [];
    const pointB1: Point3d[] = [];
    B.multiplyAXPoints(pointX0, pointB);
    const pointBX = [];
    for (const b of pointB) pointBX.push(b.clone());
    // console.log ("B*pointX0", pointB);
    this.ck.testFalse(A.factorAndBackSubstitutePointArrays([], []), "FactorAndBackSubstitute fails with empty inputs");
    this.ck.testTrue(B.factorAndBackSubstitutePointArrays(pointB, pointX), "FactorAndBackSubstitutePointArrays");
    this.ck.testTrue(B.factorAndBackSubstitutePointArrays(pointBX, pointBX), "factorAndBackSubstitutePointArrays with aliased B, X");
    // console.log (B);
    // console.log ("solved points", pointX);
    this.ck.testPoint3dArray(pointX0, pointX, "tridiagonal point solution");
    this.ck.testPoint3dArray(pointX, pointBX, "aliased B,X");
    B.multiplyAXPoints(pointX0, pointB1);
    this.ck.testPoint3dArray(pointB, pointB1, "tridiagonal point multiply");

    const flatten = A.flatten();
    const flattenPoints = A.flattenWithPoints(pointB1);
    this.ck.testPointer(flatten, "flatten nonnull");
    this.ck.testPointer(flattenPoints, "flattenPoints nonnull");
  }
  public testOrder4OneX() {
    let A: TriDiagonalSystem;
    let B: TriDiagonalSystem;
    // Order 4 systems with only 1 nonzero in X ...
    for (let k = 0; k < 4; k++) {
      A = new TriDiagonalSystem(4);
      A.setRow(0, 0, 2, 0.1);
      A.setRow(1, 1.1, 3, 0.1);
      A.setRow(2, 1.2, 4, 0.1);
      A.setRow(3, 1.3, 5, 0);

      for (let i = 0; i < 4; i++) {
        A.setX(i, 0.0);
      }
      A.setX(k, 2.0);
      A.multiplyAX();
      B = A.copy();

      if (Checker.noisy.tridiagonalSolver) {
        console.log("A, X, AX");
        console.log(A.flatten());
      }
      A.factorAndBackSubstitute();
      if (Checker.noisy.tridiagonalSolver) {
        console.log("LU, X?, AX");
        console.log(A.flatten());
      }
      A.multiplyAX();
      if (Checker.noisy.tridiagonalSolver) {
        console.log("LU, X?, LU(X?)");
        console.log(A.flatten());
      }
      this.checkX(A, B);
      this.checkB(A, B);
    }
  }
  public testOrder4() {
    const A = new TriDiagonalSystem(4);

    A.setRow(0, 0, -3.2, 0.3);
    A.setRow(1, 1.1, -3.4, 0.78);
    A.setRow(2, 0.3, -3.1, 0.98);
    A.setRow(3, 0.43, -3.04, 0);
    for (let i = 0; i < 4; i++) {
      A.setX(i, (1 + i * i));
    }
    A.multiplyAX();
    const B: TriDiagonalSystem = A.copy();
    if (Checker.noisy.tridiagonalSolver) {
      console.log("A, X, AX");
      console.log(A.flatten());
    }
    A.factorAndBackSubstitute();
    if (Checker.noisy.tridiagonalSolver) {
      console.log("LU, X?, AX");
      console.log(A.flatten());
    }
    A.multiplyAX();
    if (Checker.noisy.tridiagonalSolver) {
      console.log("LU, X?, LU(X?)");
      console.log(A.flatten());
    }
    this.checkX(A, B);
    this.checkB(A, B);
  }
  public testLargeSystem() {
    // Larger system.   Diagonals between 3 and 4, off diagonals between 0 and 2
    const n = 20;
    const A = new TriDiagonalSystem(n);

    const noisy = 0;
    A.setRow(0, 0, 4, 0.4);
    for (let i = 1; i < (n - 1); i++) {
      const u = i / n;
      const v = u * 0.5;
      A.addToRow(i, (1 - v * v), (3.0 + u), (1 + v * v));
    }
    A.setRow(n - 1, 1.235, 3.99, 0);
    for (let i = 0; i < n; i++) {
      A.setX(i, i + 1);
    }
    A.multiplyAX();
    const B: TriDiagonalSystem = A.copy();

    if (noisy) {
      console.log("A, X, AX");
      console.log(A.flatten());
    }
    A.factorAndBackSubstitute();
    if (noisy) {
      console.log("LU, X?, AX");
      console.log(A.flatten());
    }
    A.multiplyAX();
    if (noisy) {
      console.log("LU, X?, LU(X?)");
      console.log(A.flatten());
    }
    A.defactor();
    if (noisy) {
      console.log("Defactor");
      console.log(A.flatten());
    }
    this.checkX(A, B);
    this.checkB(A, B);
  }
  public testRareConditions() {
    const n = 4;
    const A = new TriDiagonalSystem(4);
    // set each b entry by combination of set and addTo ...
    const f0 = (value: number) => (value + 0.5);
    const f1 = (value: number) => ((value + 1) * (value + 1));
    for (let i = 0; i < n; i++) {
      A.setB(i, f0(i));
      A.addToB(i, f1(i));
    }
    for (let i = 0; i < n; i++) {
      this.ck.testCoordinate(f0(i) + f1(i), A.getB(i));
    }
    this.ck.testTrue(A.defactor(), "Defactor noop for raw matrix");
    this.ck.testFalse(A.factor(), "Expect factor failure on unpopulated matrix");
    this.ck.testFalse(A.multiplyAX(), "multiplyAX called for incomplete matrix.");
    const pointX: Point3d[] = [];
    let pointB: Point3d[] = [Point3d.create(), Point3d.create(), Point3d.create(), Point3d.create()];
    this.ck.testFalse(A.multiplyAXPoints(pointX, pointB), "multiplyAXPoints after factor failure.");
    this.ck.testFalse(A.defactor(), "Defactor fails after factor fail");
    this.ck.testFalse(A.factorAndBackSubstitute(), "FactorAndBackSubstitute fails after factor fail");
    pointB = [Point3d.create(), Point3d.create(), Point3d.create(), Point3d.create()];
    this.ck.testFalse(A.factorAndBackSubstitutePointArrays(pointB, pointX), "FactorAndBackSubstitutePointArrays after factor fail");
    this.ck.testFalse(A.factorAndBackSubstitutePointArrays([], pointX), "FactorAndBackSubstitutePointArrays with incomplete input array");
  }
}

describe("TriDiagonalSystem", () => {
  it("TriDiagonalSystem.testOrder3", () => {
    const tf = new TestFixture();
    tf.testOrder3();
    tf.testOrder3();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.testOrder4onex", () => {
    const tf = new TestFixture();
    tf.testOrder4OneX();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.testOrder4", () => {
    const tf = new TestFixture();
    tf.testOrder4();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.testLargeSystem", () => {
    const tf = new TestFixture();
    tf.testLargeSystem();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.rareConditions", () => {
    const tf = new TestFixture();
    tf.testRareConditions();
    expect(tf.ck.getNumErrors()).equals(0);
  });

});
