/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Newton1dUnbounded, Newton1dUnboundedApproximateDerivative, Newton2dUnboundedWithDerivative, NewtonEvaluatorRRtoRRD, NewtonEvaluatorRtoR, NewtonEvaluatorRtoRD, SimpleNewton } from "../../numerics/Newton";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// cspell:word currentdFdX
export class HornerEvaluator extends NewtonEvaluatorRtoRD {
  private _coefficients: number[];
  // Constructor CAPTURES the caller's array.
  public constructor(coefficients: number[]) {
    super();
    this._coefficients = coefficients;
  }
  public evaluate(x: number): boolean {
    let k = this._coefficients.length - 1;
    let p = this._coefficients[k];
    let q = 0.0;
    while (k > 0) {
      k--;
      q = p + x * q;
      p = x * p + this._coefficients[k];
      this.currentF = p;
      this.currentdFdX = q;
    }
    return true;
  }
}
export class ClothoidCosineEvaluator extends NewtonEvaluatorRtoRD {
  private _exitRadius: number;
  private _exitLength: number;
  private _alpha: number;
  private _gamma: number;
  public constructor(alpha: number, exitRadius: number, exitLength: number) {
    super();
    this._exitRadius = exitRadius;
    this._exitLength = exitLength;
    this._alpha = alpha;
    this._gamma = this._alpha / (40.0 * this._exitRadius * this._exitRadius * this._exitLength * this._exitLength);
  }
  public evaluate(x: number): boolean {
    const x2 = x * x;
    const x4 = x2 * x2;
    this.currentF = x * (1.0 + x4 * this._gamma);
    this.currentdFdX = 1.0 + 5.0 * x4 * this._gamma;
    return true;
  }
}

describe("Newton", () => {
  it("Hello World", () => {
    const ck = new Checker();
    // use coefficients for typical spiral.
    const r1 = 10.0;
    const l1 = 1.0;
    const gamma = 1.0 / (40.0 * r1 * r1 * l1 * l1);
    for (const f of [
      new HornerEvaluator([0, 1, 0, 0, 0, gamma]),
      new ClothoidCosineEvaluator(1.0, r1, l1),
    ]) {
      const iterator = new Newton1dUnbounded(f);
      for (const fraction of [0.2, 0.8]) {
        const x = fraction * l1;
        // find f(x) as target value for iterator.
        f.evaluate(x);
        iterator.setTarget(f.currentF);
        if (Checker.noisy.newtonRtoRD)
          GeometryCoreTestIO.consoleLog({ x, f: f.currentF, dF: f.currentdFdX });
        // start iterator x_0 away from the root.
        iterator.setX(x + 1);
        if (ck.testTrue(iterator.runIterations())) {
          const x1 = iterator.getX();
          ck.testCoordinate(x, iterator.getX(), "Newton converted to correct value");
          ck.testLE(iterator.numIterations, 5, "Expect low newton iteration count for gentle function");
          if (Checker.noisy.newtonRtoRD)
            GeometryCoreTestIO.consoleLog("   ", { x, x1, n: iterator.numIterations });
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

export class Simple1DFunctionEvaluator1 extends NewtonEvaluatorRtoRD {
  public evaluate(x: number): boolean {
    this.currentF = x * x;
    this.currentdFdX = 2 * x;
    return true;
  }
}

export class Simple1DFunctionEvaluator2 extends NewtonEvaluatorRtoR {
  public evaluate(x: number): boolean {
    this.currentF = x * x - 2;
    return true;
  }
}

export class Simple2DFunctionEvaluator1 extends NewtonEvaluatorRRtoRRD {
  public evaluate(x: number, y: number): boolean {
    this.currentF.setOriginAndVectorsXYZ(
      x - y + 1, x * x - y + 1, 0.0, // [ f(x,y), g(x,y), 0 ]
      1, 2 * x, 0.0,                 // [ df/dx,  dg/dx,  0 ]
      -1, -1, 0.0,                   // [ df/dy,  dg/dy,  0 ]
    );
    return true;
  }
}

export class Simple2DFunctionEvaluator2 extends NewtonEvaluatorRRtoRRD {
  public evaluate(x: number, y: number): boolean {
    this.currentF.setOriginAndVectorsXYZ(
      x * x + y * y - 5, 3 * x - y - 5, 0.0, // [ f(x,y), g(x,y), 0 ]
      2 * x, 3, 0.0,                         // [ df/dx,  dg/dx,  0 ]
      2 * y, -1, 0.0,                        // [ df/dy,  dg/dy,  0 ]
    );
    return true;
  }
}

describe("Newton", () => {
  it("Newton1dUnbounded", () => {
    const ck = new Checker();
    const f = new Simple1DFunctionEvaluator1();
    const iterator = new Newton1dUnbounded(f);
    iterator.setTarget(2); // f(x) = 2
    iterator.setX(1); // initial condition x_0 = 1
    const expectedSolution1 = Math.sqrt(2);
    // find sqrt(2) solution of f(x) = x^2 = 2
    if (ck.testTrue(iterator.runIterations())) {
      const solution = iterator.getX(); // x_n
      ck.testCoordinate(solution, expectedSolution1, "Newton converted to correct value");
      GeometryCoreTestIO.consoleLog({ solution, expectedSolution: expectedSolution1, n: iterator.numIterations });
    }
    iterator.setX(-1); // initial condition x_0 = -1
    const expectedSolution2 = -Math.sqrt(2);
    // find -sqrt(2) solution of f(x) = x^2 = 2
    if (ck.testTrue(iterator.runIterations())) {
      const solution = iterator.getX(); // x_n
      ck.testCoordinate(solution, expectedSolution2, "Newton converted to correct value");
      GeometryCoreTestIO.consoleLog({ solution, expectedSolution: expectedSolution2, n: iterator.numIterations });
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("Newton1dUnboundedApproximateDerivative", () => {
    const ck = new Checker();
    const f = new Simple1DFunctionEvaluator2();
    const iterator = new Newton1dUnboundedApproximateDerivative(f);
    iterator.setX(1); // initial condition x_0 = 1
    const expectedSolution1 = Math.sqrt(2);
    // find sqrt(2) solution of f(x) = x^2 = 2
    if (ck.testTrue(iterator.runIterations())) {
      const solution = iterator.getX(); // x_n
      ck.testCoordinate(solution, expectedSolution1, "Newton converted to correct value");
      GeometryCoreTestIO.consoleLog({ solution, expectedSolution: expectedSolution1, n: iterator.numIterations });
    }
    iterator.setX(-1); // initial condition x_0 = -1
    const expectedSolution2 = -Math.sqrt(2);
    // find -sqrt(2) solution of f(x) = x^2 = 2
    if (ck.testTrue(iterator.runIterations())) {
      const solution = iterator.getX(); // x_n
      ck.testCoordinate(solution, expectedSolution2, "Newton converted to correct value");
      GeometryCoreTestIO.consoleLog({ solution, expectedSolution: expectedSolution2, n: iterator.numIterations });
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("Newton2dUnboundedWithDerivativeExample1", () => {
    const ck = new Checker();
    const f = new Simple2DFunctionEvaluator1();
    const iterator = new Newton2dUnboundedWithDerivative(f);
    iterator.setUV(2, 3); // initial condition (x_0,y_0) = (2,3)
    const expectedSolution1X = 1;
    const expectedSolution1Y = 2;
    // find (1,2) solution of f(x,y) = x - y + 1 = 0 and g(x,y) = x^2 - y + 1 = 0
    if (ck.testTrue(iterator.runIterations())) {
      const solutionX = iterator.getU(); // x_n
      const solutionY = iterator.getV(); // y_n
      ck.testCoordinate(solutionX, expectedSolution1X, "Newton converted to correct X value");
      ck.testCoordinate(solutionY, expectedSolution1Y, "Newton converted to correct Y value");
      GeometryCoreTestIO.consoleLog({
        solutionX,
        expectedSolutionX: expectedSolution1X,
        solutionY,
        expectedSolutionY: expectedSolution1Y,
        n: iterator.numIterations,
      });
    }
    iterator.setUV(-1, 0); // initial condition (x_0,y_0) = (-1,0)
    const expectedSolution2X = 0;
    const expectedSolution2Y = 1;
    // find (0,1) solution of f(x,y) = x - y + 1 = 0 and g(x,y) = x^2 - y + 1 = 0
    if (ck.testTrue(iterator.runIterations())) {
      const solutionX = iterator.getU(); // x_n
      const solutionY = iterator.getV(); // y_n
      ck.testCoordinate(solutionX, expectedSolution2X, "Newton converted to correct X value");
      ck.testCoordinate(solutionY, expectedSolution2Y, "Newton converted to correct Y value");
      GeometryCoreTestIO.consoleLog({
        solutionX,
        expectedSolutionX: expectedSolution2X,
        solutionY,
        expectedSolutionY: expectedSolution2Y,
        n: iterator.numIterations,
      });
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("Newton2dUnboundedWithDerivativeExample2", () => {
    const ck = new Checker();
    const f = new Simple2DFunctionEvaluator2();
    const iterator = new Newton2dUnboundedWithDerivative(f);
    iterator.setUV(3, 2); // initial condition (x_0,y_0) = (3,2)
    const expectedSolution1X = 2;
    const expectedSolution1Y = 1;
    // find (2,1) solution of f(x,y) = x^2 + y^2 - 5 = 0 and g(x,y) = 3*x - y - 5 = 0
    if (ck.testTrue(iterator.runIterations())) {
      const solutionX = iterator.getU(); // x_n
      const solutionY = iterator.getV(); // y_n
      ck.testCoordinate(solutionX, expectedSolution1X, "Newton converted to correct X value");
      ck.testCoordinate(solutionY, expectedSolution1Y, "Newton converted to correct Y value");
      GeometryCoreTestIO.consoleLog({
        solutionX,
        expectedSolutionX: expectedSolution1X,
        solutionY,
        expectedSolutionY: expectedSolution1Y,
        n: iterator.numIterations,
      });
    }
    iterator.setUV(0, -1); // initial condition (x_0,y_0) = (0,-1)
    const expectedSolution2X = 1;
    const expectedSolution2Y = -2;
    // find (1,-2) solution of f(x,y) = x^2 + y^2 - 5 = 0 and g(x,y) = 3*x - y - 5 = 0
    if (ck.testTrue(iterator.runIterations())) {
      const solutionX = iterator.getU(); // x_n
      const solutionY = iterator.getV(); // y_n
      ck.testCoordinate(solutionX, expectedSolution2X, "Newton converted to correct X value");
      ck.testCoordinate(solutionY, expectedSolution2Y, "Newton converted to correct Y value");
      GeometryCoreTestIO.consoleLog({
        solutionX,
        expectedSolutionX: expectedSolution2X,
        solutionY,
        expectedSolutionY: expectedSolution2Y,
        n: iterator.numIterations,
      });
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("SimpleNewton", () => {
    const ck = new Checker();
    const func = (x: number): number => { return x * x - 2; };
    const derivative = (x: number): number => { return 2 * x; };
    const initialCondition1 = 1;
    let solution = SimpleNewton.runNewton1D(initialCondition1, func, derivative)!;
    const expectedSolution1 = Math.sqrt(2);
    ck.testCoordinate(solution, expectedSolution1, "Newton converted to correct value");
    GeometryCoreTestIO.consoleLog({ solution, expectedSolution: expectedSolution1 });
    const initialCondition2 = -1;
    solution = SimpleNewton.runNewton1D(initialCondition2, func, derivative)!;
    const expectedSolution2 = -Math.sqrt(2);
    ck.testCoordinate(solution, expectedSolution2, "Newton converted to correct value");
    GeometryCoreTestIO.consoleLog({ solution, expectedSolution: expectedSolution2 });

    expect(ck.getNumErrors()).equals(0);
  });
});
