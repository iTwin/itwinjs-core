/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Newton1dUnbounded, NewtonEvaluatorRtoRD } from "../numerics/Newton";
import { Checker } from "./Checker";
import { expect } from "chai";
/* tslint:disable:no-console */

export class HornerEvaluator extends NewtonEvaluatorRtoRD {
  private _coefficients: number[];
  // Constructor CAPTURES the caller's array . .
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
  it("Newton1dUnbounded", () => {
    const ck = new Checker();
    // use coefficients for typical spiral ...
    const r1 = 10.0;
    const l1 = 1.0;
    const gamma = 1.0 / (40.0 * r1 * r1 * l1 * l1);
    for (const f of [
      new ClothoidCosineEvaluator(1.0, r1, l1),
      new HornerEvaluator([0, 1, 0, 0, 0, gamma])]) {
      const iterator = new Newton1dUnbounded(f);
      for (const fraction of [0.2, 0.8]) {
        const x = fraction * l1;
        // find f(x) as target value for iterator.
        f.evaluate(x);
        iterator.setTarget(f.currentF);
        if (Checker.noisy.newtonRtoRD)
          console.log({ X: x, F: f.currentF, dF: f.currentdFdX });
        // start iterator away from the root.
        iterator.setX(x + 1);
        if (ck.testTrue(iterator.runIterations())) {
          const x1 = iterator.getX();
          ck.testCoordinate(x, iterator.getX(), "newton converted to correct value");
          ck.testLE(iterator.numIterations, 5, "Expect low newton iteration count for gentle function");
          if (Checker.noisy.newtonRtoRD)
            console.log("   ", { X: x, X1: x1, n: iterator.numIterations });
        }
      }
    }
    ck.checkpoint("End Newton.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

});
