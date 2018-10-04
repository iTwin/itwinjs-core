/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// import { Sample } from "../serialization/GeometrySamples";
import { UnivariateBezier, BezierCoffs, Order2Bezier, Order3Bezier, Order4Bezier, Order5Bezier } from "../numerics/BezierPolynomials";
import { Geometry } from "../Geometry";
import { PascalCoefficients } from "../numerics/PascalCoefficients";
import { LineString3d } from "../curve/LineString3d";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Checker } from "./Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "./GeometryCoreTestIO";
/* tslint:disable:no-console */
describe("Bezier", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const b0 = new UnivariateBezier(4);
    b0.coffs[0] = 1;
    b0.coffs[1] = 21;
    b0.coffs[2] = 41;
    b0.coffs[3] = 61;

    const b2 = new Order2Bezier(1, 61);
    const b3 = new Order3Bezier(1, 31, 61);
    const b4 = new Order4Bezier(1, 21, 41, 61);
    const b5 = new Order5Bezier(1, 16, 31, 46, 61);
    const scale = 3.4;
    const a = 7.0;
    const b2A = b2.clone(); b2A.scaleInPlace(scale); b2A.addInPlace(a);
    const b3A = b3.clone(); b3A.scaleInPlace(scale); b3A.addInPlace(a);
    const b4A = b4.clone(); b4A.scaleInPlace(scale); b4A.addInPlace(a);
    const b5A = b5.clone(); b5A.scaleInPlace(scale); b5A.addInPlace(a);
    const b0A = b0.clone(); b0A.scaleInPlace(scale); b0A.addInPlace(a);
    for (const f of [0.1, 0.4]) {
      ck.testCoordinate(b2.evaluate(f), b3.evaluate(f));
      ck.testCoordinate(b4.evaluate(f), b5.evaluate(f));
      ck.testCoordinate(b2.evaluate(f), b5.evaluate(f));
      ck.testCoordinate(b2.evaluate(f), b0.evaluate(f));
      ck.testCoordinate(a + scale * b2.evaluate(f), b2A.evaluate(f));
      ck.testCoordinate(a + scale * b3.evaluate(f), b3A.evaluate(f));
      ck.testCoordinate(a + scale * b4.evaluate(f), b4A.evaluate(f));
      ck.testCoordinate(a + scale * b5.evaluate(f), b5A.evaluate(f));
      ck.testCoordinate(a + scale * b2.evaluate(f), b0A.evaluate(f));
    }

    const b0B = b0.clone();
    b0B.zero();
    for (const f of [0.1, 0.4, 1, 1.2]) {
      ck.testCoordinate(b0B.evaluate(f), 0.0);
    }
    ck.checkpoint("Bezier.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Products", () => {
    const ck = new Checker();

    const b2 = new Order2Bezier(-1, 4);
    const b3 = new Order3Bezier(1, -2, 5);
    const b2b3 = Order4Bezier.createProductOrder3Order2(b3, b2);

    const c2 = new Order3Bezier(0, 0, 0);
    const c2A = new Order2Bezier(1, 3);
    const c2B = new Order2Bezier(5, 4);
    const scaleA = 2.3;
    const scaleB = -1.2;
    c2.addSquareLinear(c2A.coffs[0], c2A.coffs[1], scaleA);
    c2.addSquareLinear(c2B.coffs[0], c2B.coffs[1], scaleB);

    const e5 = new Order5Bezier(0, 0, 0, 0, 0);
    const e3A = new Order3Bezier(2, 4, 3);
    const e3B = new Order3Bezier(2, -4, 1);
    e5.addProduct(e3A, e3B, scaleB);

    for (const f of [0.0, 0.1, 0.4, 1.0, 1.1]) {
      ck.testCoordinate(b2.evaluate(f) * b3.evaluate(f), b2b3.evaluate(f));
      const y2A = c2A.evaluate(f);
      const y2B = c2B.evaluate(f);
      ck.testCoordinate(c2.evaluate(f), y2A * y2A * scaleA + y2B * y2B * scaleB);
      ck.testCoordinate(e5.evaluate(f), e3A.evaluate(f) * e3B.evaluate(f) * scaleB);
    }

    ck.checkpoint("CurveLocationDetail.Products");
    expect(ck.getNumErrors()).equals(0);
  });
});
describe("BezierRoots", () => {

  it("Products", () => {
    const ck = new Checker();
    const factors: BezierCoffs[] = [
      new Order2Bezier(1, 2),
      new Order2Bezier(-2, -3),
      new Order3Bezier(0.1, 0.5, -0.3)];
    for (let i1 = 0; i1 < factors.length; i1++) {
      let bezier = factors[0].clone();
      for (let i = 1; i <= i1; i++)
        bezier = UnivariateBezier.createProduct(bezier, factors[i]);
      const dx = 0.1;
      for (let x = 0; x <= 1; x += dx) {
        const a = bezier.evaluate(x);
        let b = 1.0;
        for (let i = 0; i <= i1; i++) {
          const c = factors[i].evaluate(x);
          b *= c;
        }
        ck.testCoordinate(a, b);
      }
    }
  });
  it("Deflation", () => {
    const ck = new Checker();
    for (const numRoots of [2, 2, 3, 5, 6]) {
      // baes roots at odd integer multiples of 1/(numRoots+1)
      const baseRoots = [];
      for (let i = 0; i < numRoots; i++)
        baseRoots.push((1 + 2 * i) / (2 * numRoots));
      // console.log(prettyPrint(baseRoots));
      for (const scale of [1, 0.5, 0.1]) {
        const rootsA = [];
        for (const r of baseRoots) rootsA.push(r * scale);
        let bezier = new UnivariateBezier(2);
        bezier.coffs[0] = -rootsA[0];
        bezier.coffs[1] = 1 - rootsA[0];
        for (let i = 1; i < numRoots; i++) {
          const a = rootsA[i];
          const bezierA = bezier.clone();
          bezier = UnivariateBezier.createProduct(bezier, new Order2Bezier(-a, 1.0 - a));
          const bezierB = bezier.clone();
          const remainder = bezierB.deflateRoot(rootsA[i]);
          ck.testCoordinate(remainder, 0, "deflation remainder");
          const absdiff = BezierCoffs.maxAbsDiff(bezierA, bezierB);
          if (ck.testTrue(absdiff !== undefined))
            ck.testCoordinate(absdiff!, 0, "inflate deflate match");
        }
        for (const r of rootsA) {
          const bezier0 = bezier.clone();
          const bezier10 = bezier.clone();
          const remainder = (bezier as UnivariateBezier).deflateRoot(r);
          ck.testCoordinate(0, remainder, "remainder after deflation");
          const bezier1 = UnivariateBezier.createProduct(bezier, new Order2Bezier(-r, 1 - r));
          const delta = BezierCoffs.maxAbsDiff(bezier0, bezier1);
          if (ck.testTrue(delta !== undefined))
            ck.testCoordinate(0, delta!, "deflate and remultiply round trip.");
          // another time around for debug convenience.  . .
          const remainder1 = (bezier10 as UnivariateBezier).deflateRoot(r);
          ck.testExactNumber(remainder, remainder1);
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("VerifyRoots", () => {
    const ck = new Checker();
    const a = 0.25;
    // This creates beziers with various coefficients, and solves by deflation.
    // It verifies that the deflate-based roots are roots.
    // It does NOT verify that all roots were found -- other tests start with known roots and do full verification.
    for (const coffs of [
      [-a, -a, 1.0 - a],
      [1, -4, 1],
      [1, 1, -4, -3, 2],
      [1, -4, 0.01, -2],
      [1, 0.1, 0.1, -0.1, -5, 2]]) {
      const bezier = UnivariateBezier.createCoffs(coffs);
      const bezier1 = bezier.clone();
      const deflationRoots = UnivariateBezier.deflateRoots01(bezier);
      if (ck.testPointer(deflationRoots, "deflation produces roots", coffs))
        for (const r of deflationRoots!) {
          const fOfR = bezier1.evaluate(r);
          ck.testCoordinate(0, fOfR, "bezier root", r, coffs);
        }
      // partial check for some other targets . . .
      for (let target = -0.4; target < 2; target += 0.1054) {
        const targetRoots = bezier1.roots(target, true);
        if (targetRoots) {
          for (const r of targetRoots) {
            ck.testCoordinate(target, bezier1.evaluate(r), "target root");
          }
        }
      }
      // console.log("deflation roots", deflationRoots);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("DistributedRoots", () => {
    const ck = new Checker();
    for (const numRoots of [2, 2, 3, 5, 6]) {
      // baes roots at odd integer multiples of 1/(numRoots+1)
      const baseRoots = [];
      for (let i = 0; i < numRoots; i++)
        baseRoots.push((1 + 2 * i) / (2 * numRoots));
      // console.log(prettyPrint(baseRoots));
      for (const distributionFunction of [
        (x: number) => x,
        (x: number) => Math.cos(x),
        (x: number) => (0.1 * x),
        (x: number) => (x + 0.001),
        (x: number) => (Math.tan(x))]) {
        const rootsA = [];
        for (const r of baseRoots) rootsA.push(distributionFunction(r));
        let bezier = UnivariateBezier.createCoffs([-rootsA[0], 1 - rootsA[0]]);
        for (let i = 1; i < numRoots; i++) {
          const a = rootsA[i];
          bezier = UnivariateBezier.createProduct(bezier, UnivariateBezier.createCoffs([-a, 1.0 - a]));
        }
        const bezier0 = bezier.clone();
        const roots = UnivariateBezier.deflateRoots01(bezier);
        if (ck.testPointer(roots, "root solver ok") && roots) {
          for (const u of rootsA)
            ck.testCoordinate(0, bezier0.evaluate(u));
          for (const r of rootsA) {
            if (Geometry.isIn01(r))
              ck.testArrayContainsCoordinate(roots, r);
          }
          // console.log("roots", roots);
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("DeflateRight", () => {
    const ck = new Checker();
    for (const numZero of [1, 2, 3, 5, 6]) {
      const coffs = [];
      for (let i = 0; i < numZero; i++)
        coffs.push(0);

      for (const numOther of [1, 2, 3, 5]) {
        for (let i = 0; i < numOther; i++)
          coffs.push(2 * i + i * i);
        const bezierA = UnivariateBezier.createCoffs(coffs);
        const bezierB = bezierA.clone() as UnivariateBezier;
        for (let numDeflate = 1; numDeflate <= numZero; numDeflate++) {
          bezierB.deflateLeft();
          for (const u of [0, 0.1, 0.35, 0.5, 0.75, 1]) {
            let factor = 1;
            for (let i = 0; i < numDeflate; i++)
              factor *= u;
            ck.testCoordinate(bezierA.evaluate(u), factor * bezierB.evaluate(u), "left deflated bezier evaluation");
          }
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("DeflateRight", () => {
    const ck = new Checker();
    for (const numZero of [1, 2, 3, 5, 6]) {

      for (const numOther of [1, 2, 3, 5]) {
        const coffs = [];
        for (let i = 0; i < numOther; i++)
          coffs.push(2 * i + i * i);
        for (let i = 0; i < numZero; i++)
          coffs.push(0);

        const bezierA = UnivariateBezier.createCoffs(coffs);
        const bezierB = bezierA.clone() as UnivariateBezier;
        for (let numDeflate = 1; numDeflate <= numZero; numDeflate++) {
          bezierB.deflateRight();
          for (const u of [0, 0.1, 0.35, 0.5, 0.75, 1]) {
            let factor = 1;
            for (let i = 0; i < numDeflate; i++)
              factor *= (1 - u);
            ck.testCoordinate(bezierA.evaluate(u), factor * bezierB.evaluate(u), "right deflated bezier evaluation");
          }
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("PascalCoefficients", () => {
  it("Triangle", () => {
    const ck = new Checker();
    // tickle 1..7 in order, then jump out to stress the high-row construction
    for (const row of [1, 2, 3, 4, 5, 6, 7, 10, 9, 8, 12]) {
      const row0 = PascalCoefficients.getRow(row - 1);
      const row1 = PascalCoefficients.getRow(row);
      if (ck.testExactNumber(row + 1, row1.length, "row1 length")
        && ck.testExactNumber(row, row0.length, "row0 length")) {
        ck.testExactNumber(1, row1[0], row);
        ck.testExactNumber(1, row1[row], row);
        for (let i = 0; i + 1 < row; i++) {
          ck.testExactNumber(row0[i], row1[i + 1] - row0[i + 1], row, i);
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("BasisFuncs", () => {
    const ck = new Checker();
    const epsilon = 1.0e-14;
    // tickle 1..7 in order, then jump out to stress the high-row construction
    let basisA = new Float64Array(2); // This will get reallocated as order grows . . .
    for (const order of [1, 2, 3, 4, 5, 6, 7, 10, 9, 8, 12]) {
      for (const u of [0.0, 0.1, .08, 1.0]) {
        basisA = PascalCoefficients.getBezierBasisValues(order, u, basisA);
        const basisB = PascalCoefficients.getBezierBasisValues(order, u);
        let sA = 0.0;
        for (let i = 0; i < order; i++) {
          ck.testLE(Math.abs(basisA[i] - basisB[i]), epsilon * (1.0 + Math.abs(basisA[i])));
          sA += basisA[i];
        }
        ck.testLE(Math.abs(sA - 1.0), epsilon);
      }
      // confirm that basis function k has its peak at k/(order - 1)
      const du = 1 / (order - 1);
      const fMax = new Float64Array(order);
      for (let k = 0; k < order; k++) {
        const u = k * du;
        basisA = PascalCoefficients.getBezierBasisValues(order, u, basisA);
        const f = basisA[k];
        fMax[k] = f;
        // EXPECT ... basisA[k] is larger than any other basis function . . .
        for (let j = 0; j < order; j++) {
          if (j !== k)
            ck.testLE(basisA[j], f, "local max basis function exceeds others");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("BasisFuncPlots", () => {
    let basisA = new Float64Array(2); // This will get reallocated as order grows . . .
    let y0 = 0.0;
    const dy = 2.0;
    const allData = [];
    for (const order of [1, 2, 3, 4, 5, 9]) {
      const lineStrings = [];
      const subdivisionFactor = 5.0;  // number of points between peaks
      const numValues = subdivisionFactor * 1 + subdivisionFactor * (order - 1);
      for (let i = 0; i < order; i++)
        lineStrings.push(LineString3d.create());
      for (let k = 0; k < numValues; k++) {
        const u = k / (numValues - 1);
        basisA = PascalCoefficients.getBezierBasisValues(order, u, basisA);
        for (let i = 0; i < order; i++) {
          lineStrings[i].addPoint(Point3d.create(u, y0 + basisA[i], 0));
        }
      }
      for (const ls of lineStrings)
        allData.push(ls);
      const y1 = y0 + 1;
      const tic = 0.04;
      allData.push(LineString3d.createXY(
        [Point2d.create(-tic, y1),
        Point2d.create(0, y1), Point2d.create(0, y0),
        Point2d.create(1, y0), Point2d.create(1, y1),
        Point2d.create(1 + tic, y1)],
        0.0));
      y0 += dy;
    }
    GeometryCoreTestIO.saveGeometry(allData, "Bezier", "BasisFunctions");
  });

});
