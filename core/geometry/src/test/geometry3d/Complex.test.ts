/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";

import { Complex } from "../../numerics/Complex";
import { Checker } from "../Checker";

class ComplexTests {
  public ck: Checker;
  constructor(public noisy: boolean = false) {
    this.ck = new Checker();
  }
  public getNumErrors(): number {
    this.ck.checkpoint(" ComplexTests");
    return this.ck.getNumErrors();
  }
  public exerciseComplexMethods(z0: Complex, z1: Complex) {
    const z2 = z0.plus(z1);
    const z3 = z2.times(z2);
    const z3root = z3.sqrt();
    const z4 = z3.divide(z2);
    this.ck.testComplex(z2, z3root, "complex root");
    if (this.ck.testPointer(z4, "Complex divide") && z4 !== undefined)
      this.ck.testComplex(z2, z4, "complex divide");
  }
}

describe("Complex.HelloWorld", () => {
  const ck = new Checker();
  it("Complex arithmetic", () => {
    const tester = new ComplexTests();
    const z0 = Complex.create(2, 4);
    const z1 = Complex.create(3, 1);
    tester.exerciseComplexMethods(z0, z1);
    tester.exerciseComplexMethods(z1, z0);
    expect(tester.getNumErrors()).toBe(0);
    z0.setFrom(z1);
    ck.testComplex(z0, z1, "Complex setFrom");
    const z2 = z0.clone();
    ck.testComplex(z0, z2, "Complex clone");
    z0.minus(z0, z0);
    z0.timesXY(1000, 1000);
    ck.testTrue(z0.x === 0 && z0.y === 0, "Complex minus itself");
    ck.testUndefined(z1.divide(z0), "Complex Divide is undefined");
    ck.testComplex(z0, z0.sqrt(), "Zero complex sqrt is still zero");

    const z3 = z1.sqrt();
    ck.testFalse(z3.x === 0 || z3.y === 0, "Non-zero complex sqrt is not zero");
    z3.set(-z3.x, z3.y);
    z3.sqrt(z3);
    ck.testFalse(z3.x === 0 || z3.y === 0, "Non-zero complex sqrt is not zero");
    const json: any = { x: 1, y: 2 };
    z0.setFromJSON(json);
    ck.testTrue(z0.x === 1 && z0.y === 2);
    z0.setFromJSON({ incorrectJson: true });
    ck.testTrue(z0.x === 0 && z0.y === 0);
    for (let i = 1; i < 20; i++) {
      z0.set(1, i);
      ck.testCoordinate(z0.angle().radians, Math.atan(z0.y / z0.x), "Complex angle check");
      ck.testCoordinate(z0.magnitude(), Math.sqrt(z0.x * z0.x + z0.y * z0.y), "Complex magnitude check");
    }
    const values = [-1.0, -0.9, -0.7, -0.5, 0.0, -0.1, 0.1, 0.3, 0.8, 1.0];
    for (const x of values) {
      for (const y of values) {
        const c0 = Complex.create(x, y);
        const c1 = c0.sqrt();
        const c2 = c1.times(c1);
        ck.testComplex(c0, c2, "Complex sqrt");
      }
    }
    const d0 = Complex.create();
    const d1 = Complex.create(1, 1);
    d1.set();
    ck.testComplex(d0, d1, "Complex arg defaults");
    ck.checkpoint("Complex.HelloWorld");
    expect(ck.getNumErrors()).toBe(0);
  });
});
