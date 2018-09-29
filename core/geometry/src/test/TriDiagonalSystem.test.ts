/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "./Checker";
import { TriDiagonalSystem } from "../numerics/TriDiagonalSystem";
import { Point3d } from "../PointVector";
/* tslint:disable:variable-name no-console*/

class TestFixture {
  public ck: Checker;
  public constructor() { this.ck = new Checker(); }

  // Tester Methods -------------------------------------------------------------------
  public CheckX(A: TriDiagonalSystem, B: TriDiagonalSystem) {
    const n = A.Order();
    for (let i = 0; i < n; i++) {
      // TODO: Implement correct method of comparing two Float64Array's
      this.ck.testCoordinate(A.GetX(i), B.GetX(i), "Solution vectors of A and B");
    }
  }
  public CheckB(A: TriDiagonalSystem, B: TriDiagonalSystem) {
    const n = A.Order();
    for (let i = 0; i < n; i++) {
      this.ck.testCoordinate(A.GetB(i), B.GetB(i), "Right side vectors of A and B");
    }
  }
  // Setup Methods --------------------------------------------------------------------
  public testOrder3() {
    const A = new TriDiagonalSystem(3);
    let B: TriDiagonalSystem;

    A.SetRow(0, 1, 2, 1);
    A.SetRow(1, 1, 2, 1);
    A.SetRow(2, 1, 2, 1);
    A.SetX(0, 2);
    A.SetX(1, 3);
    A.SetX(2, 4);
    A.MultiplyAX();
    // Checker.noisy.tridiagonalsolver = true;
    if (Checker.noisy.tridiagonalsolver) {
      console.log("(1) A X AX");
      console.log(A);

      // console.logxyzB("A,B dummy points", xyz);
    }
    B = A.Copy();
    this.ck.testTrue(A.FactorAndBackSubstitute(), "FactorAndBackSubstitute");
    this.ck.testTrue(A.Factor(), "repeat factor");
    if (Checker.noisy.tridiagonalsolver) {
      console.log("(2) LU, X?, AX");
      console.log(A);
    }
    A.MultiplyAX();
    if (Checker.noisy.tridiagonalsolver) {
      console.log("(3) LU, X?, LU(X?)");
      console.log(A);
    }
    this.CheckX(A, B);
    this.CheckB(A, B);
    const pointX0 = [];
    for (let i = 0; i < 3; i++) {
      const x = A.GetX(i);
      pointX0.push(Point3d.create(x, 2.0 * x, x + 1.0));
    }
    const pointB: Point3d[] = [];
    const pointX: Point3d[] = [];
    const pointB1: Point3d[] = [];
    B.MultiplyAXPoints(pointX0, pointB);
    const pointBX = [];
    for (const b of pointB) pointBX.push(b.clone ());
    // console.log ("B*pointX0", pointB);
    this.ck.testFalse(A.FactorAndBackSubstitutePointArrays([], []), "FactorAndBackSubstitute fails with empty inputs");
    this.ck.testTrue (B.FactorAndBackSubstitutePointArrays(pointB, pointX), "FactorAndBackSubstitutePointArrays");
    this.ck.testTrue (B.FactorAndBackSubstitutePointArrays (pointBX, pointBX), "factorAndBackSubstitutePointArrays with aliased B, X");
    // console.log (B);
    // console.log ("solved points", pointX);
    this.ck.testPoint3dArray(pointX0, pointX, "tridiagonal point solution");
    this.ck.testPoint3dArray (pointX, pointBX, "aliased B,X");
    B.MultiplyAXPoints(pointX0, pointB1);
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
      A.SetRow(0, 0, 2, 0.1);
      A.SetRow(1, 1.1, 3, 0.1);
      A.SetRow(2, 1.2, 4, 0.1);
      A.SetRow(3, 1.3, 5, 0);

      for (let i = 0; i < 4; i++) {
        A.SetX(i, 0.0);
      }
      A.SetX(k, 2.0);
      A.MultiplyAX();
      B = A.Copy();

      if (Checker.noisy.tridiagonalsolver) {
        console.log("A, X, AX");
        console.log(A.flatten());
      }
      A.FactorAndBackSubstitute();
      if (Checker.noisy.tridiagonalsolver) {
        console.log("LU, X?, AX");
        console.log(A.flatten());
      }
      A.MultiplyAX();
      if (Checker.noisy.tridiagonalsolver) {
        console.log("LU, X?, LU(X?)");
        console.log(A.flatten());
      }
      this.CheckX(A, B);
      this.CheckB(A, B);
    }
  }
  public testOrder4() {
    const A = new TriDiagonalSystem(4);
    let B: TriDiagonalSystem;
    A.SetRow(0, 0, -3.2, 0.3);
    A.SetRow(1, 1.1, -3.4, 0.78);
    A.SetRow(2, 0.3, -3.1, 0.98);
    A.SetRow(3, 0.43, -3.04, 0);
    for (let i = 0; i < 4; i++) {
      A.SetX(i, (1 + i * i));
    }
    A.MultiplyAX();
    B = A.Copy();
    if (Checker.noisy.tridiagonalsolver) {
      console.log("A, X, AX");
      console.log(A.flatten());
    }
    A.FactorAndBackSubstitute();
    if (Checker.noisy.tridiagonalsolver) {
      console.log("LU, X?, AX");
      console.log(A.flatten());
    }
    A.MultiplyAX();
    if (Checker.noisy.tridiagonalsolver) {
      console.log("LU, X?, LU(X?)");
      console.log(A.flatten());
    }
    this.CheckX(A, B);
    this.CheckB(A, B);
  }
  public testLargeSystem() {
    // Larger system.   Diagonals between 3 and 4, off diagonals between 0 and 2
    const n = 20;
    const A = new TriDiagonalSystem(n);
    let B: TriDiagonalSystem;
    const noisy = 0;
    A.SetRow(0, 0, 4, 0.4);
    for (let i = 1; i < (n - 1); i++) {
      const u = i / n;
      const v = u * 0.5;
      A.AddToRow(i, (1 - v * v), (3.0 + u), (1 + v * v));
    }
    A.SetRow(n - 1, 1.235, 3.99, 0);
    for (let i = 0; i < n; i++) {
      A.SetX(i, i + 1);
    }
    A.MultiplyAX();
    B = A.Copy();

    if (noisy) {
      console.log("A, X, AX");
      console.log(A.flatten());
    }
    A.FactorAndBackSubstitute();
    if (noisy) {
      console.log("LU, X?, AX");
      console.log(A.flatten());
    }
    A.MultiplyAX();
    if (noisy) {
      console.log("LU, X?, LU(X?)");
      console.log(A.flatten());
    }
    A.Defactor();
    if (noisy) {
      console.log("Defatored");
      console.log(A.flatten());
    }
    this.CheckX(A, B);
    this.CheckB(A, B);
  }
  public testRareConditions() {
    const n = 4;
    const A = new TriDiagonalSystem(4);
    // set each b entry by combination of set and addTo ...
    const f0 = (value: number) => (value + 0.5);
    const f1 = (value: number) => ((value + 1) * (value + 1));
    for (let i = 0; i < n; i++) {
      A.SetB(i, f0(i));
      A.AddToB(i, f1(i));
    }
    for (let i = 0; i < n; i++) {
      this.ck.testCoordinate(f0(i) + f1(i), A.GetB(i));
    }
    this.ck.testTrue(A.Defactor(), "Defactor noop for raw matrix");
    this.ck.testFalse(A.Factor(), "Expect factor failure on unpopulated matrix");
    this.ck.testFalse(A.MultiplyAX(), "multiplyAX called for incomplete matrix.");
    const pointX: Point3d[] = [];
    let pointB: Point3d[] = [Point3d.create (), Point3d.create (), Point3d.create (), Point3d.create ()];
    this.ck.testFalse(A.MultiplyAXPoints(pointX, pointB), "multiplyAXPoints after factor failure.");
    this.ck.testFalse(A.Defactor(), "Defactor fails after factor fail");
    this.ck.testFalse(A.FactorAndBackSubstitute(), "FactorAndBackSubstitute fails after factor fail");
    pointB = [Point3d.create (), Point3d.create (), Point3d.create (), Point3d.create ()];
    this.ck.testFalse(A.FactorAndBackSubstitutePointArrays(pointB, pointX), "FactorAndBackSubstitutePointArrays after factor fail");
    this.ck.testFalse(A.FactorAndBackSubstitutePointArrays([], pointX), "FactorAndBackSubstitutePointArrays with incomplete input array");
  }
}

describe("TriDiagonalSystem", () => {
  it("TriDiagonalSystem.testorder3", () => {
    const tf = new TestFixture();
    tf.testOrder3();
    tf.testOrder3();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.testorder4onex", () => {
    const tf = new TestFixture();
    tf.testOrder4OneX();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.testorder4", () => {
    const tf = new TestFixture();
    tf.testOrder4();
    expect(tf.ck.getNumErrors()).equals(0);
  });
  it("TriDiagonalSystem.testlargesystem", () => {
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
