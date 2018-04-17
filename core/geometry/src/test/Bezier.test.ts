/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// import { Sample } from "../serialization/GeometrySamples";
import { Bezier, Order2Bezier, Order3Bezier, Order4Bezier, Order5Bezier } from "../numerics/Polynomials";
import { BezierRoots, PascalCoefficients } from "./BezierRoots";
import { LineString3d } from "../curve/LineString3d";
import { Point2d, Point3d } from "../PointVector";
import { Checker } from "./Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "./IModelJson.test";
/* tslint:disable:no-console */
describe("Bezier", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const b0 = new Bezier(4);
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
    ck.checkpoint("CurveLocationDetail.HelloWorld");
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
  it("Splits", () => {
    const ck = new Checker();
    const coffs = [1, 3, 4, -5];
    const bezier = new Order4Bezier(coffs[0], coffs[1], coffs[2], coffs[3]);

    for (let i = 0; i < coffs.length; i++)
      bezier.coffs[i] = coffs[i];
    const solver = BezierRoots.create(coffs, 100, 200);
    // no-side-effects evaluation:
    for (const u of [0, 0.25, 0.6, 1.0]) {
      const f = solver.evaluateLocal(u);
      const g = bezier.evaluate(u);
      const h = solver.evaluateTopBezierAtLocalFraction(u);
      ck.testCoordinate(f, g, "Bezier evaluations", u);
      ck.testCoordinate(f, h, "Solver bezier evaluations", u);
      ck.testExactNumber(1, solver.numBezier, "Evaluate preserves blocks");
    }
    // push and pop effects:
    const u0 = solver.topInterpolatedParam(0.0);
    const u1 = solver.topInterpolatedParam(1.0);
    for (const fraction of [0, 0.25, 0.6, 1.0]) {
      solver.pushCopyOfTopBezier();
      ck.testCoordinate(u0, solver.topInterpolatedParam(0));
      ck.testCoordinate(u1, solver.topInterpolatedParam(1.0));
      const midU = solver.topInterpolatedParam(fraction);
      solver.pushSubdivide(fraction);
      ck.testCoordinate(midU, solver.topU0);
      ck.testCoordinate(u1, solver.topU1);
      solver.popBezier();
      ck.testCoordinate(u0, solver.topU0);
      ck.testCoordinate(midU, solver.topU1);
      solver.popBezier();
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
