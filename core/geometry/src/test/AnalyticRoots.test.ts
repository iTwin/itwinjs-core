/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "./Checker";
import { NumberArray } from "../PointHelpers";
import { GrowableFloat64Array } from "../GrowableArray";
import { AnalyticRoots, Degree2PowerPolynomial } from "../numerics/Polynomials";

/* tslint:disable:no-console no-trailing-whitespace */

// Toggle for printing in cubic & quartic testers
const printAll = false;

// Linear and Quadric simple tests -----------------------------------------------

describe("AnalyticRoots.SolveLinear", () => {
  const ck = new Checker();
  it("SolveLinear.OneSolution", () => {
    const powerCoffs = new Float64Array(2);
    for (const slope of [1, 1000, -52, 0]) {
      for (const a of [0, 2, 5e7]) {
        const s = new GrowableFloat64Array();
        AnalyticRoots.appendLinearRoot(-slope * a, slope, s);
        if (slope !== 0) {
          if (ck.testPointer(s) && s) {
            ck.testExactNumber(s.length, 1, "SolveLinear (root a, slope)", a, slope);
            ck.testCoordinate(s.at(0), a, "SolveLinear", powerCoffs);
          }
        } else {
          ck.testExactNumber(s.length, 0, " Expect no roots for linear equation with zero slope.");
        }
      }
    }
    ck.checkpoint("SolveLinear");
    expect(ck.getNumErrors()).equals(0);
  });
});
describe("AnalyticRoots.SolveQuadric", () => {

  it("SolveQuadric.DoubleRoot", () => {
    const ck = new Checker();
    for (let i = 3; i < 8; i += 2) {
      const quadric = Degree2PowerPolynomial.fromRootsAndC2(i, i);
      const roots = new GrowableFloat64Array();
      AnalyticRoots.appendQuadraticRoots(Float64Array.from(quadric.coffs), roots);
      if (ck.testPointer(roots) && roots) {
        roots.sort(compare);
        ck.testExactNumber(roots.length, 1, "SolveQuadric s = [" + i + ", " + i + "]");
        ck.testCoordinate(roots.at(0), i, "Quadratic double root");
      }
    }
    ck.checkpoint("DoubleRoot");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SolveQuadric.NoSolution", () => {
    const ck = new Checker();
    const c = 3.5;
    for (const a of [3, 2, 9]) {
      const roots = new GrowableFloat64Array();
      AnalyticRoots.appendQuadraticRoots(Float64Array.from([c, Math.sqrt(4.0 * a * c / 7), a]), roots);
      ck.testExactNumber(roots.length, 0, "Expect no roots from quadratic");
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("SolveQuadric.TwoSolutions", () => {
    const ck = new Checker();
    for (const root0 of [1, - 3, 100]) {
      for (const root1 of [5.4, 2.3]) {
        const quadric = Degree2PowerPolynomial.fromRootsAndC2(root0, root1);
        const roots = new GrowableFloat64Array();
        AnalyticRoots.appendQuadraticRoots(Float64Array.from(quadric.coffs), roots);
        if (ck.testPointer(roots) && roots) {
          roots.sort(compare);
          ck.testExactNumber(roots.length, 2, "appendQuadraticSolutions ", roots, root0, root1);
          ck.testCoordinate(roots.at(0), Math.min(root0, root1), "Quadratic two roots");
          ck.testCoordinate(roots.at(1), Math.max(root0, root1), "Quadratic two roots");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

// Cubic and Quartic tests (taken from t_analyticRoots.cpp) --------------------------------

// Functions used by the cubic and quartic solver tests
function compare(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  } else {
    return 0;
  }
}

function matchRoots(target: number[], actual: GrowableFloat64Array) {
  let eMax = Number.MAX_VALUE;

  if (target.length === actual.length) {
    target.sort(compare);
    actual.sort(compare);

    eMax = 0.0;

    for (let i = 0; i < target.length; i++) {
      const e = target[i] - actual.at(i);
      eMax = NumberArray.MaxAbsTwo(e, eMax);
    }
  }
  return eMax;
}

function maxDiffMatchedArrays(target: number[], actual: GrowableFloat64Array) {
  if (target.length !== actual.length)
    return Number.MAX_VALUE;
  const tempArray: number[] = [];
  for (let i = 0; i < actual.length; i++) { tempArray.push(actual.at(i)); }
  return NumberArray.maxAbsDiff(target, tempArray);
}

function NewtonStep(coffs: Float64Array, u: number) {
  const f = coffs[0] + u * (coffs[1] + u * (coffs[2] + u * coffs[3]));
  const df = coffs[1] + u * (2.0 * coffs[2] + u * 3.0 * coffs[3]);
  return (f / df);
}

function NewtonStep4(coffs: Float64Array, u: number) {
  const f = coffs[0] + u * (coffs[1] + u * (coffs[2] + u * (coffs[3] + u * coffs[4])));
  const df = coffs[1] + u * (2.0 * coffs[2] + u * (3.0 * coffs[3] + u * 4.0 * coffs[4]));
  return f / df;

}

// check solutions of (x-a) (x^2 + b^2)
describe("AnalyticRoots.SolveCubic", () => {

  it("SolveCubic.Cubic1", () => {
    const ck = new Checker();
    const b = 100.0;
    for (let a = 0.0; a < 1000; a = 10.0 * (a + 1.0)) {
      const coffs = new Float64Array(4);
      coffs[3] = 1.0;
      coffs[2] = - a;
      coffs[1] = b * b;
      coffs[0] = - b * b * a;
      const target: number[] = [a];
      const actual = new GrowableFloat64Array();
      AnalyticRoots.appendCubicRoots(coffs, actual);
      if (ck.testPointer(actual) && actual) {
        ck.testCoordinate(actual.length, 1, "simple root count");

        const eMax = matchRoots(target, actual);
        ck.testTrue(eMax < (1.0e-14 * (1.0 + NumberArray.MaxAbsArray(target))), "root error");

        if (Checker.noisy.cubicRoots) {
          console.log("  (target " + a + ") (b " + b + ")");
          console.log("  (actual " + a + ") (eMax " + eMax + ")");
        }
      }
    }
    ck.checkpoint("SolveCubic");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SolveCubic.Cubic3", () => {
    const rangeScale = 1.0e6;
    const ck = new Checker();

    for (let e = 1.0; e > 2.0e-8; e *= 0.1) {
      for (let x0 = 0.0; x0 < Math.max(rangeScale * e, 20.0); x0 = 10.0 * (x0 + 1.0)) {
        const u0 = x0 - e;
        const u1 = x0;
        const u2 = x0 + 1;
        if (Checker.noisy.cubicRoots)
          console.log("\n\n Cubic Roots for ", [u0, u1, u2], { ee: e, x00: x0 });

        const coffs = new Float64Array(4);
        coffs[3] = 1.0;
        coffs[2] = - NumberArray.PreciseSum([u0, u1, u2]);
        coffs[1] = NumberArray.PreciseSum([u0 * u1, u1 * u2, u0 * u2]);
        coffs[0] = - u0 * u1 * u2;

        const target = [u0, u1, u2];
        target.sort(compare);
        const actual = new GrowableFloat64Array();
        AnalyticRoots.appendCubicRoots(coffs, actual);

        if (ck.testPointer(actual) && actual && ck.testExactNumber(3, actual.length, "3 root cubic")) {
          const uMax = NumberArray.MaxAbsArray(target);
          const eMax = matchRoots(target, actual) / uMax;
          const eSafe = maxDiffMatchedArrays(target, actual) / uMax;
          const printTrigger = 1.0e-12;

          if (printAll || (eSafe >= (printTrigger * uMax * uMax / e))) {
            // Check::True (eMax < 1.0e-14 * DoubleOps::MaxAbs (target), "root error");
            console.log("Cubic root variances.  These may be expected behavior under extreme origin conditions");
            console.log("   (known roots " + target[0] + " " + target[1] + " " + target[2] +
              ") (emax " + eMax + ") (eSafe " + eSafe + ")");
            console.log("   (computed roots " + actual.at(0) + " " + actual.at(1) + " " + actual.at(2) + ")");
            console.log("   (correction by newton from computed root  " + NewtonStep(coffs, actual.at(0)) +
              " " + NewtonStep(coffs, actual.at(1)) + " " + NewtonStep(coffs, actual.at(2)) + ")");
            console.log("   (correction by newton from known root  " + NewtonStep(coffs, target[0]) +
              " " + NewtonStep(coffs, target[1]) + " " + NewtonStep(coffs, target[2]) + ")");
          }
        }

        ck.checkpoint("SolveCubic");
        expect(ck.getNumErrors()).equals(0);
      }
    }
  });
  /*
    it("SolveCubic.Cubic3X", () => {
      // root e = small positive -- e.g. in range 01 for sure,like the one interesting root for a cubic bezier
      // x0, x0+1 = two roots "somewhere else" -- not interesting in bezier case.

      for (let e = 1.0; e > 1.0e-10; e *= 0.1) {
        if (printAll) {
          console.log("\n\n e: " + e);
        }
        for (let x0 = 0.0; x0 < 1100; x0 = 10.0 * (x0 + 1.0)) {
          const u0 = e;
          const u1 = x0;
          const u2 = x0 + 1;

          const coffs = new Float64Array(4);
          coffs[3] = 1.0;
          coffs[2] = - NumberArray.PreciseSum([u0, u1, u2]);
          coffs[1] = NumberArray.PreciseSum([u0 * u1, u1 * u2, u0 * u2]);
          coffs[0] = - u0 * u1 * u2;
          const roots = new Float64Array(3);
          const target: number[] = [];
          const actual: number[] = [];
          target.push(u0);
          target.push(u1);
          target.push(u2);
          const xSafe: number[] = [];
          let numRoots = AnalyticRoots.SolveCubicHelper(coffs, roots, xSafe);
          if (numRoots === 2) {
            numRoots = 3;
          }
          for (let i = 0; i < numRoots; i++) {
            actual.push(roots[i]);
          }

          ck.testCoordinate(3, numRoots, "cubic root count");

          if (numRoots === 3) {
            const uMax = NumberArray.MaxAbsArray(target);
            const eMax = matchRoots(target, actual) / uMax;
            const eSafe = ErrorAtClosestRoot(target, actual, xSafe[0]) / uMax;
            const printTrigger = 1.0e-12;

            if (printAll || (eSafe >= (printTrigger * uMax))) {
              ck.testTrue(eMax < (1.0e-14 * NumberArray.MaxAbsArray(target)), "root error");
              console.log("Cubic root variances.  These may be expected behavior under extreme origin conditions");
              console.log("   (known roots " + target[0] + " " + target[1] + " " + target[2] +
                ") (emax " + eMax + ") (eSafe " + eSafe + ")");
              console.log("   (computed roots " + actual[0] + " " + actual[1] + " " + actual[2] + ")");
              console.log("   (correction by newton from computed root  " + NewtonStep(coffs, actual[0]) +
                " " + NewtonStep(coffs, actual[1]) + " " + NewtonStep(coffs, actual[2]) + ")");
              console.log("   (correction by newton from known root  " + NewtonStep(coffs, target[0]) +
                " " + NewtonStep(coffs, target[1]) + " " + NewtonStep(coffs, target[2]) + ")");
            }
          } else if (numRoots === 1) {
            console.log(" ** SINGLETON *** (u target " + u0 + " " + u1 + " " + u2 + ") (u " + actual[0] +
              ") (spread factor " + ((u1 - u0) / u2) + ")");
            console.log("    NewtonDX " + NewtonStep(coffs, actual[0]));
          }
          ck.checkpoint("SolveCubic");
          expect(ck.getNumErrors()).equals(0);
        }
      }
    });
    */
});

function CheckQuartic(u0: number, u1: number, u2: number, u3: number, tolerance: number, ck: Checker) {
  const coffs = new Float64Array(5);
  coffs[4] = 1.0;
  coffs[3] = - NumberArray.PreciseSum([u0, u1, u2, u3]);
  const xx: number[] = [];
  xx[0] = u0 * u1;
  xx[1] = u0 * u2;
  xx[2] = u0 * u3;
  xx[3] = u1 * u2;
  xx[4] = u1 * u3;
  xx[5] = u2 * u3;
  coffs[2] = NumberArray.PreciseSum(xx);
  coffs[1] = -NumberArray.PreciseSum([u0 * u1 * u2, u0 * u1 * u3, u0 * u2 * u3, u1 * u2 * u3]);
  coffs[0] = u0 * u1 * u2 * u3;

  const target = [u0, u1, u2, u3];

  const actual = new GrowableFloat64Array();
  AnalyticRoots.appendQuarticRoots(coffs, actual);
  if (!ck.testPointer(actual, "?No roots for quartic") || !actual)
    return;

  ck.testExactNumber(4, actual.length, "quartic root count");

  const uMax = NumberArray.MaxAbsArray(target);
  let eMax = matchRoots(target, actual) / uMax;
  const ok: boolean = ck.testTrue(eMax < tolerance, "quartic root tolerance", eMax, tolerance);
  // Accurate when compared to multiple of 1.0e-8... any higher negative power likely to fail
  if (Checker.noisy.quarticRoots) {
    console.log("   (actual " + actual.at(0) + " " + actual.at(1) + " " + actual.at(2) + " " + actual.at(3) + ")");
    console.log("   (target " + target[0] + " " + target[1] + " " + target[2] + " " + target[3] + ")");

  }

  // Additional testing based on NewtonStep
  for (let step = 0; (step < 10) && (eMax > 1.0e-14); step++) {
    if (!ok || printAll) {
      console.log("   (actualDX   " + NewtonStep4(coffs, actual.at(0)) + " " + NewtonStep4(coffs, actual.at(1)) + " " +
        NewtonStep4(coffs, actual.at(2)) + " " + NewtonStep4(coffs, actual.at(3)) + ")");
      for (let k = 0; k < actual.length; k++) {
        actual.reassign(k, actual.at(k) - NewtonStep4(coffs, actual.at(k)));
      }
      eMax = matchRoots(target, actual) / uMax;
      if (!ok || printAll) {
        console.log("   (actual " + actual.at(0) + " " + actual.at(1) + " " + actual.at(2) + " " + actual.at(3) + "   (emax " +
          eMax + ")");
      }
    }
  }
}

describe("AnalyticRoots.CheckQuartic", () => {
  const ck = new Checker();

  it("CheckQuartic.TightTol", () => {
    const tightTol = 1.0e-15;
    CheckQuartic(0, 1, 2, 3, tightTol, ck);
    ck.checkpoint("SolveQuartic");
    expect(ck.getNumErrors()).equals(0);
  });

  it("CheckQuartic.MediumTol", () => {
    const mediumTol = 1.0e-10;
    for (const delta of [1, 3, 7, 10]) {
      CheckQuartic(-11, -10, 10, 10 + delta, mediumTol, ck);
    }
    // Symmetry with varying speed
    for (const delta of [0.1, 1, 5, 10]) {
      CheckQuartic(-100, -100 + delta, 100 - delta, 100, mediumTol, ck);
      CheckQuartic(-100, -100 + delta, 100 - delta, 100, mediumTol, ck);
      CheckQuartic(-100, -100 + delta, 100 - delta, 100, mediumTol, ck);
    }
    ck.checkpoint("SolveQuartic");
    expect(ck.getNumErrors()).equals(0);
  });

  it("CheckQuartic.LooseTol", () => {
    const looseTol = 1.0e-5;
    const a = 100.0;
    const b = 1000.0;
    const e = 1.0;
    for (const factor of [1, 0.1, 3, 6, 100]) {
      CheckQuartic(a, a + e, b, b + e / factor, looseTol, ck);
      // This has a bad failure for factor ==3 when factor1 is applied.
      // const factor1 = 1.0 / 64;
      // CheckQuartic (a * factor1, (a + e) * factor1, b * factor1, (b + e / factor) * factor1, looseTol, ck);
    }
    ck.checkpoint("SolveQuartic");
    expect(ck.getNumErrors()).equals(0);
  });

  function testRoots4(coff: Float64Array, roots: GrowableFloat64Array): boolean {
    let maxF = 0.0;
    const ff: number[] = [];
    const numRoots = roots.length;
    for (let i = 0; i < numRoots; i++) {
      const r = roots.at(i);
      const f = coff[0] + r * (coff[1] + r * (coff[2] + r * (coff[3] + r * coff[4])));
      maxF = Math.max(f, Math.abs(maxF));
      ff.push(f);
    }
    if (maxF > 1.0e-8) {
      const roots1 = new GrowableFloat64Array();
      AnalyticRoots.appendQuarticRoots(coff, roots1);
      console.log({ expectedRoots: roots, computedRoots: roots1, fofx: ff });
      return false;
    }
    return true;
  }

  it("CheckQuartic.TwoRoots", () => {
    const coff = new Float64Array(5);
    coff[0] = 7.5;
    coff[1] = -67.5;
    coff[2] = 157.5;
    coff[3] = -153;
    coff[4] = 48;
    const roots = new GrowableFloat64Array();
    AnalyticRoots.appendQuarticRoots(coff, roots);
    if (ck.testPointer(roots, "expect two roots") && roots) {
      ck.testTrue(testRoots4(coff, roots), "Verify quartic roots");
    }
    expect(ck.getNumErrors()).equals(0);

  });
});

// Bezier root solver tests (taken from t_bezroot.cpp) ---------------------------------------
// Functions used by the bezier tests
/*
function CheckCubicBezier(a0: number, a1: number, a2: number, numStep: number, ck: Checker) {
  const rootA = new Float64Array(4);
  const rootB = new Float64Array(4);
  const bezCoffs = new Float64Array(3);
  const bez = new Order3Bezier(a0, a1, a2);
  const rangeA = Range1d.createArray([a0, a1, a2]);

  for (let i = 0; i <= numStep; i++) {
    if (rangeA.isNull()) {
      continue;
    }
    const u = i / numStep;
    const target = rangeA.fractionToPoint(u);
    let numA;
    bezCoffs[0] = a0 - target;
    bezCoffs[1] = a1 - target;
    bezCoffs[2] = a2 - target;

  }
}

describe("AnalyticRoots.CheckOrder3Bezier", () => {
  const ck = new Checker();

  it ("CheckOrder3Bezier.RootsIn01", () => {

  });
});
*/
/* Test Earlin's formulation of the resultant for quartic roots.  This only proceeds far enough to see roots of the resultant -- not quartic roots. */
export class AnalyticRoots1 extends AnalyticRoots {
  public static appendQuarticRoots1(c: Float64Array, roots: GrowableFloat64Array) {
    const coffScale = 1.0 / c[4];
    const A = c[3] * coffScale;
    const B = c[2] * coffScale;
    const C = c[1] * coffScale;
    const D = c[0] * coffScale;
    // const origin = -0.25 * A;
    /*  substitute x = y - A/4 to eliminate cubic term:
        x^4 + px^2 + qx + r = 0 */
    const squareA = A * A;
    const p = -3.0 / 8 * squareA + B;
    const q = 0.125 * squareA * A - 0.5 * A * B + C;
    const r = -3.0 / 256 * squareA * squareA + 1.0 / 16 * squareA * B - 1.0 / 4 * A * C + D;
    const cubicCoffs = new Float64Array([-q * q, p * p - 4 * r, 2.0 * p, 1.0]);
    // const cubicRoots = new GrowableFloat64Array (3);
    AnalyticRoots.appendCubicRoots(cubicCoffs, roots);
  }
}

describe("AnalyticRoots", () => {
  it("EDLResultant", () => {
    const noisy = false;
    for (const x0 of [-1, -2]) {
      for (const x1 of [-1, -0.6, -0.98]) {
        for (const x2 of [0, 0.5, 0.10]) {
          if (noisy)
            console.log("*****************");
          const x3 = - (x0 + x1 + x2);
          const quarticCoffs = new Float64Array([
            x0 * x1 * x2 * x3,
            -(x0 * x1 * x2 + x0 * x1 * x3 + x0 * x2 * x3 + x1 * x2 * x3),
            x0 * x1 + x0 * x2 + x0 * x3 + x1 * x2 + x1 * x3 + x2 * x3,
            - (x0 + x1 + x2 + x3),
            1.0]);
          const quarticRoots0 = new GrowableFloat64Array(4);
          AnalyticRoots.appendQuarticRoots(quarticCoffs, quarticRoots0);
          if (noisy) {
            console.log("[xi]", [x0, x1, x2, x3]);
            console.log("quarticCoffs", quarticCoffs);
          }
          const b23 = x2 + x3;
          const b13 = x1 + x3;
          const b12 = x1 + x2;
          const bSquared = new GrowableFloat64Array(3);
          if (noisy) {
            console.log("[roots0]", quarticRoots0);
            AnalyticRoots1.appendQuarticRoots1(quarticCoffs, bSquared);
            console.log("real bsquared", [b12 * b12, b13 * b13, b23 * b23]);
            console.log("appx bSquared", bSquared);
          }
        }
      }
    }
  });

});
