/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "../PointVector";
import { Geometry } from "../Geometry";
import { Checker } from "./Checker";
import { expect } from "chai";
import { KnotVector } from "../bspline/KnotVector";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
/* tslint:disable:no-console */
describe("BsplineCurve", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    for (const order of [2, 3, 4, 5]) {
      if (Checker.noisy.bsplineEvaluation) console.log("\n\n ************* order ", order);
      // const a = 1.0;
      const b = 2.0;
      const points = [];
      const degree = order - 1;
      const numPoles = 5;
      const knots = KnotVector.createUniformClamped(numPoles, degree, 0.0, 1.0);
      // x should exactly match the knot value (even for high order)
      for (let i = 0; i < numPoles; i++) {
        const x = knots.grevilleKnot(i);
        points.push(Point3d.create(x, b, 0));
      }
      const curve = BSplineCurve3d.createUniformKnots(points, order) as BSplineCurve3d;
      const arcLength = curve.curveLength();
      ck.testLE(arcLength, curve.quickLength() + Geometry.smallMetricDistance, "order", order);
      if (Checker.noisy.bsplineEvaluation) {
        console.log("BsplineCurve", curve);
        console.log({ numPoles: curve.numPoles, numSpan: curve.numSpan });
        console.log("length", arcLength);
      }
      for (let span = 0; span < curve.numSpan; span++) {
        const p0 = curve.evaluatePointInSpan(span, 0.0);
        const p1 = curve.evaluatePointInSpan(span, 0.5);
        const p2 = curve.evaluatePointInSpan(span, 1.0);

        for (const spanFraction of [0.2, 0.3, 0.9]) {
          const knot = curve.spanFractionToKnot(span, spanFraction);
          const spanPoint = curve.evaluatePointInSpan(span, spanFraction);
          const spanTangent = curve.evaluatePointAndTangentInSpan(span, spanFraction);
          const spanTangent2 = curve.knotToPointAnd2Derivatives(knot);
          ck.testPoint3d(spanPoint, spanTangent2.origin, "evaluate == 2 derivative origin");
          ck.testVector3d(spanTangent.direction, spanTangent2.vectorU, "evaluate == 2 derivative origin");
          ck.testPoint3d(spanPoint, spanTangent.origin, "point and tangent evaluate");
          const knotPoint = curve.knotToPoint(knot);
          ck.testCoordinate(knot, knotPoint.x, "x == knot");
          ck.testPoint3d(spanPoint, knotPoint, "spanPoint, knotPoint", order, span, spanFraction);

        }
        ck.testCoordinate(b, p1.y, "constant bspline y");
        if (Checker.noisy.bsplineEvaluation) console.log("span", span, p0, p1, p2);
        if (span + 1 < curve.numSpan) {
          const q2 = curve.evaluatePointInSpan(span + 1, 0.0);
          ck.testPoint3d(p2, q2, "span match");
        }
      }
    }
    ck.checkpoint("End BsplineCurve.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("KnotVector", () => {
    const ck = new Checker();
    const numPoles = 10;
    const degree = 3;
    const a0 = 1;
    const a1 = 22;
    const knots = KnotVector.createUniformClamped(numPoles, degree, a0, a1);
    const basisValues = knots.createBasisArray();
    ck.testExactNumber(basisValues.length, degree + 1);
    ck.testExactNumber(knots.knotLength01, a1 - a0, "knot range");
    for (let spanIndex = 0; spanIndex < knots.numSpans; spanIndex++) {
      const leftKnotFromSpan = knots.spanFractionToKnot(spanIndex, 0);
      const rightKnotFromSpan = knots.spanFractionToKnot(spanIndex, 1);
      const leftKnotFromArray = knots.knots[spanIndex + knots.leftKnotIndex];
      ck.testCoordinate(leftKnotFromArray, leftKnotFromSpan, "left of span reproduces knots");
      ck.testCoordinate(knots.spanIndexToSpanLength(spanIndex), rightKnotFromSpan - leftKnotFromSpan, "span length");

    }
    expect(ck.getNumErrors()).equals(0);
  });
});
