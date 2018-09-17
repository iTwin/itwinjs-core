/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "../PointVector";
import { Geometry, Angle, AngleSweep } from "../Geometry";
import { Checker } from "./Checker";
import { expect } from "chai";
import { KnotVector } from "../bspline/KnotVector";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { BezierCurve3d } from "../bspline/BezierCurve";
import { GeometryQuery, CurvePrimitive } from "../curve/CurvePrimitive";
import { GeometryCoreTestIO } from "./IModelJson.test";
import { LineString3d } from "../curve/LineString3d";
import { Transform } from "../Transform";
import { StrokeOptions } from "../curve/StrokeOptions";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";

function translateAndPush(allGeometry: GeometryQuery[], g: GeometryQuery | undefined, dx: number, dy: number) {
  if (g) {
    g.tryTranslateInPlace(dx, dy, 0);
    allGeometry.push(g);
  }
}
function ellipsePoints(a: number, b: number, sweep: AngleSweep, numStep: number): Point3d[] {
  const points = [];
  for (let f = 0.0; f <= 1.00001; f += 1.0 / numStep) {
    const radians = sweep.fractionToRadians(f);
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    points.push(Point3d.create(a * c, b * s, 0.0));
  }
  return points;
}
/* tslint:disable:no-console */
describe("BsplineCurve", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    for (const rational of [false, true]) {
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
        let curve: BSplineCurve3d | BSplineCurve3dH;
        if (rational)
          curve = BSplineCurve3dH.createUniformKnots(points, order) as BSplineCurve3dH;
        else
          curve = BSplineCurve3d.createUniformKnots(points, order) as BSplineCurve3d;
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

  it("SaturateBezier", () => {
    const ck = new Checker();
    const geometry: GeometryQuery[] = [];
    const allPoints: Point3d[] = [
      Point3d.create(0, 0, 0),
      Point3d.create(0, 10, 0),
      Point3d.create(10, 10, 0),
      Point3d.create(10, 0, 0),
      Point3d.create(20, 0, 0),
      Point3d.create(20, 10, 0)];
    const livePoints = [];
    const uniformKnots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const yShift = 20.0;
    let currYShift = 0;
    const xShift1 = 50.0;
    const xShift2 = 100.0;
    for (const p of allPoints) {
      livePoints.push(p);
      if (livePoints.length > 2) {
        const bezier = BezierCurve3d.create(livePoints)!;
        const bezier1 = bezier.clone();
        const knotVector = KnotVector.create(uniformKnots, livePoints.length - 1, false);
        geometry.push(bezier.copyPointsAsLineString());
        geometry[geometry.length - 1].tryTranslateInPlace(0, currYShift, 0);
        bezier.saturateInPlace(knotVector, 0);
        bezier1.saturateInPlace(knotVector, 1);
        // Because the knot vector is uniform, the two saturations are identical.
        ck.testTrue(bezier.isAlmostEqual(bezier1));
        geometry.push(bezier.copyPointsAsLineString());
        geometry[geometry.length - 1].tryTranslateInPlace(0, currYShift, 0);
        const degree = livePoints.length - 1;
        const leftSaturated = [];
        const rightSaturated = [];
        for (let i = 0; i < degree; i++) leftSaturated.push(0);
        for (let i = 0; i < degree; i++) leftSaturated.push(i + 1);

        for (let i = 0; i < degree; i++) rightSaturated.push(i);
        const right = rightSaturated[rightSaturated.length - 1] + 1;
        for (let i = 0; i < degree; i++) rightSaturated.push(right);

        const bezier2 = BezierCurve3d.create(livePoints)!;
        const bezier3 = BezierCurve3d.create(livePoints)!;
        bezier2.saturateInPlace(KnotVector.create(leftSaturated, degree, false), 0);
        bezier3.saturateInPlace(KnotVector.create(rightSaturated, degree, false), 0);
        geometry.push(bezier2.copyPointsAsLineString());
        geometry[geometry.length - 1].tryTranslateInPlace(xShift1, currYShift, 0);
        geometry.push(bezier3.copyPointsAsLineString());
        geometry[geometry.length - 1].tryTranslateInPlace(xShift2, currYShift, 0);

        currYShift += yShift;
      }
    }
    GeometryCoreTestIO.saveGeometry(geometry, "BezierCurve3d", "SingleBezierSaturation");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SaturateBspline", () => {
    const ck = new Checker();
    const xStep = 120;
    let xShift = 0;
    const yShift = 60.0;
    const allGeometry: GeometryQuery[] = [];
    for (const factor of [0.5, 1, 3]) {
      const transform = Transform.createScaleAboutPoint(Point3d.create(0, 0, 0), factor);
      for (const allPoints of [
        [Point3d.create(0, 0, 0),
        Point3d.create(0, 10, 0),
        Point3d.create(10, 10, 0),
        Point3d.create(10, 0, 0),
        Point3d.create(20, 0, 0),
        Point3d.create(20, 10, 0),
        Point3d.create(25, 5, 0),
        Point3d.create(30, 5, 0),
        Point3d.create(35, 10, 0)],
        ellipsePoints(35, 20, AngleSweep.createStartEndDegrees(-45, 110), 9)]) {
        transform.multiplyPoint3dArrayInPlace(allPoints);
        for (let degree = 1; degree < 6; degree++) {
          const bcurve = BSplineCurve3d.createUniformKnots(allPoints, degree + 1)!;
          let cp: CurvePrimitive | undefined;
          for (let spanIndex = 0; ; spanIndex++) {
            cp = bcurve.getSaturagedBezierSpan3d(spanIndex, cp);
            if (!cp) break;
            const bezier = cp as BezierCurve3d;
            const poles = bezier.copyPointsAsLineString();
            translateAndPush(allGeometry, poles, xShift, yShift);
            let shiftCount = 2;
            for (const degrees of [24, 12, 6]) {
              const options = StrokeOptions.createForCurves();
              options.angleTol = Angle.createDegrees(degrees);
              const strokes = LineString3d.create();
              bezier.emitStrokes(strokes, options);
              translateAndPush(allGeometry, strokes, xShift, (shiftCount++) * yShift);
            }
            translateAndPush(allGeometry, bezier.clone(), xShift, (shiftCount++) * yShift);
          }
          translateAndPush(allGeometry, bcurve, xShift, 0);
          xShift += xStep;
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BezierCurve3d", "BsplineSaturation");
    expect(ck.getNumErrors()).equals(0);
  });

});
