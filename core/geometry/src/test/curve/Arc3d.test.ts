/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { BuildingCodeOffsetOps } from "./BuildingCodeOffsetOps";

/* eslint-disable no-console */

function sampleSweeps(): AngleSweep[] {
  return [AngleSweep.create360(), AngleSweep.createStartEndDegrees(0, 40), AngleSweep.createStartEndDegrees(0, 2), AngleSweep.createStartEndDegrees(-1, 3), AngleSweep.createStartEndDegrees(88, 91),
    /* */ AngleSweep.createStartEndDegrees(0, 18), AngleSweep.createStartEndDegrees(-10, 10), AngleSweep.createStartEndDegrees(80, 100), AngleSweep.createStartEndDegrees(90, 108), AngleSweep.createStartEndDegrees(30, 45),
    /* */ AngleSweep.createStartEndDegrees(80, 110), AngleSweep.createStartEndDegrees(-10, 110), AngleSweep.createStartEndDegrees(-10, 320), AngleSweep.createStartEndDegrees(0, 88), AngleSweep.createStartEndDegrees(45, 132),
    /* */ AngleSweep.createStartEndDegrees(-10, 278), AngleSweep.createStartEndDegrees(30, 80),
    /* */ AngleSweep.createStartEndDegrees(0, -18), AngleSweep.createStartEndDegrees(-10, -20), AngleSweep.createStartEndDegrees(80, -100), AngleSweep.createStartEndDegrees(90, -108), AngleSweep.createStartEndDegrees(30, -45),
    /* */ AngleSweep.createStartEndDegrees(80, -110), AngleSweep.createStartEndDegrees(-10, -110), AngleSweep.createStartEndDegrees(-10, -320), AngleSweep.createStartEndDegrees(0, -88), AngleSweep.createStartEndDegrees(45, -132),
    /* */ AngleSweep.createStartEndDegrees(-10, -278), AngleSweep.createStartEndDegrees(30, -80)];
}
function exerciseArcSet(ck: Checker, arcA: Arc3d) {
  const arcB = Arc3d.createXY(Point3d.create(6, 5, 4), 1232.9, AngleSweep.createStartEndDegrees(1, 92));
  const arcC = arcB.clone();
  ck.testFalse(arcA.isAlmostEqual(arcC), "Verify distinct arcs before using set to match.");
  ck.testTrue(arcB.isAlmostEqual(arcC), "same arc after clone");
  arcC.setFrom(arcA);
  ck.testTrue(arcC.isAlmostEqual(arcA), "same after setFrom");    // but still not to confirm members where cloned.
  const transform = Transform.createOriginAndMatrix(Point3d.create(4, 23, 2),
    Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 2), Angle.createDegrees(12)));
  arcC.tryTransformInPlace(transform);
  ck.testFalse(arcC.isAlmostEqual(arcA), "confirm cloned arc does not share pointers.");

  const myPoint = Point3d.create(4, 2, 1);
  const myMatrix = Matrix3d.createUniformScale(8.0);
  const mySweep = AngleSweep.createStartEndDegrees(9, 20);
  arcB.setRefs(myPoint, myMatrix, mySweep);

  const arcD = arcB.clone();
  arcD.set(myPoint, myMatrix, mySweep);
  ck.testTrue(arcD.isAlmostEqual(arcB));
  transform.multiplyPoint3d(myPoint, myPoint); // this indirectly modifies arcB, but not arcD
  ck.testFalse(arcD.isAlmostEqual(arcB));
}
function exerciseArc3d(ck: Checker, arc: Arc3d) {
  const vector0 = arc.vector0;
  const vector90 = arc.vector90;
  const vectorData = arc.toVectors();
  ck.testVector3d(vector0, vectorData.vector0);
  ck.testVector3d(vector90, vectorData.vector90);
  const a = 4.2;
  const scaleTransform = Transform.createFixedPointAndMatrix(Point3d.create(4, 3),
    Matrix3d.createScale(a, a, a));
  const arc1 = arc.cloneTransformed(scaleTransform) as Arc3d;
  ck.testFalse(arc.isAlmostEqual(arc1), "scale changes arc");
  ck.testPointer(arc1);
  ck.testBoolean(arc1.isCircular, arc.isCircular, "scaled clone retains circular");
  ck.testBoolean(
    arc.sweep.isFullCircle,
    arc.startPoint().isAlmostEqual(arc.endPoint()),
    "full circle start, end condition");

  const json = arc1.toJSON();
  const arc2 = Arc3d.createUnitCircle();
  arc2.setFromJSON(json);
  ck.testTrue(arc1.isAlmostEqual(arc2), "Tight json round trip");
  ck.testLE(arc.curveLength(),
    arc.sweep.sweepRadians * arc.maxVectorLength(),
    "arc length smaller than circle on max radius");
  const fA = 0.35;
  const fB = 0.51;
  const arc3A = arc.clonePartialCurve(fA, fB)!;
  const arc3B = arc.clonePartialCurve(fB, fA)!;
  ck.testCoordinate(arc3A.curveLength(), arc3B.curveLength(), "Reversed partials match length");
  const length1 = arc1.curveLength();
  const fuzzyLengthRange = Range1d.createXX(0.5 * length1, 2.0 * length1);
  ck.testTrue(fuzzyLengthRange.containsX(arc1.quickLength()), "Quick length within factor of 2");

  exerciseArcSet(ck, arc1);
}
describe("Arc3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const arcA = Arc3d.createUnitCircle();
    ck.testTrue(arcA.isCircular);
    exerciseArc3d(ck, arcA);
    exerciseArc3d(ck,
      Arc3d.create(
        Point3d.create(1, 2, 5),
        Vector3d.create(1, 0, 0),
        Vector3d.create(0, 2, 0), AngleSweep.createStartEndDegrees(0, 90))!);

    ck.testTrue(Arc3d.createCircularStartMiddleEnd(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(4, 0, 0)) instanceof LineString3d);

    ck.checkpoint("Arc3d.HelloWorld");
    const arcB = Arc3d.createUnitCircle();
    arcB.setFromJSON(undefined);
    ck.testFalse(arcA.isAlmostEqual(CoordinateXYZ.create(Point3d.create(1, 2, 3))));
    // high eccentricity arc .. make sure the length is bounded by rectangle and diagonal of quadrant ...
    const a = 1000.0;
    const b = a / 1.e6;
    const arcC = Arc3d.createXYEllipse(Point3d.create(0, 0, 0), a, b);
    const lengthC = arcC.curveLengthBetweenFractions(0, 1);
    ck.testLE(lengthC, 4.0 * (a + b));
    ck.testLE(4.0 * Geometry.hypotenuseXY(a, b), lengthC);
    // in-place construction -- easy arc length
    const sweepRadians = 0.3423423;
    Arc3d.create(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), AngleSweep.createStartSweepRadians(0.2, sweepRadians), arcC);
    ck.testCoordinate(arcC.curveLength(), sweepRadians);
    expect(ck.getNumErrors()).equals(0);
  });
  it("QuickLength", () => {
    const ck = new Checker();
    const origin = Point3d.create();
    const factorRange = Range1d.createNull();
    for (const sweep of sampleSweeps()) {
      const factorRange1 = Range1d.createNull();
      for (const arc of [
        Arc3d.createXY(origin, 4.0, sweep),
        Arc3d.createXYEllipse(origin, 4, 2, sweep),
        Arc3d.createXYEllipse(origin, 8, 2, sweep),
        Arc3d.createXYEllipse(origin, 5, 4, sweep),
        Arc3d.createXYEllipse(origin, 20, 2, sweep),
        Arc3d.create(origin,
          Vector3d.create(4, 0, 0), Vector3d.create(1, 2, 0), sweep),
        Arc3d.create(origin,
          Vector3d.create(8, 7, 0), Vector3d.create(7, 8, 0), sweep)]) {
        const arcLength = arc.curveLength();
        const quickLength = arc.quickLength();
        if (arc.isCircular) {
          ck.testCoordinate(quickLength, arcLength);
        } else {
          const factor = quickLength / arcLength;
          factorRange.extendX(factor);
          factorRange1.extendX(factor);
          //        const scale = arc.getFractionToDistanceScale();
          if (!ck.testLE(arcLength, 1.1 * quickLength, "arc length .LE.  1.1 * quickLength")) {
            console.log(prettyPrint(arc));
          }
        }
      }
      // console.log(prettyPrint(sweep) + prettyPrint(factorRange1));
    }
    // console.log("Arc3d QuickLength FactorRange" + prettyPrint(factorRange));
    ck.testLT(0.95, factorRange.low, "QuickLength FactorRange Low");
    ck.testLT(factorRange.high, 1.06, "QuickLength FactorRange Low");

    ck.checkpoint("Arc3d.QuickLength");
    expect(ck.getNumErrors()).equals(0);
  });
  it("EccentricEllipseLengthAccuracyTable", () => {
    const noisy = false;
    const ck = new Checker();
    // Construct 90 degree elliptic arcs of varying eccentricity.
    // Integrate with 4,8,16... gauss intervals until the results settle.
    // record factor = N/e
    // By trial and error, we observe the factor is 8 or less.
    for (const numGauss of [1, 2, 3, 4, 5]) {
      let maxFactor = 0;
      if (noisy)
        console.log(`\n\n  ******************* numGauss ${numGauss}`);
      for (let e2 = 1.0; e2 < 1000.0; e2 *= 2.0) {
        const e = Math.sqrt(e2);
        const arc = Arc3d.create(Point3d.createZero(),
          Vector3d.create(e, 0, 0),
          Vector3d.create(0, 1, 0), AngleSweep.createStartEndDegrees(0, 90));
        const lengths = [];
        const deltas = [];
        const counts = [];
        let lastNumInterval = 0;
        let done = false;
        for (let baseNumInterval = 4; baseNumInterval < 600; baseNumInterval *= 2) {
          for (const numInterval of [baseNumInterval, 1.25 * baseNumInterval, 1.5 * baseNumInterval, 1.75 * baseNumInterval]) {
            lengths.push(arc.curveLengthWithFixedIntervalCountQuadrature(0.0, 1.0, numInterval, numGauss));
            counts.push(numInterval);
            lastNumInterval = numInterval;
            const k = lengths.length - 1;
            if (k >= 1) {
              const q = (lengths[k] - lengths[k - 1]) / lengths[k];
              deltas.push(q);
              if (Math.abs(q) < 4.0e-15) { done = true; break; }
            }
          }
          if (done)
            break;
        }
        const factor = lastNumInterval / e;
        if (noisy) {
          console.log("---");
          console.log(` eccentricity ${e} ${lengths.toString()}(n ${lastNumInterval})(n / (fe) ${factor}`);
          console.log(` deltas                             ${deltas.toString()}`);
        }
        maxFactor = Math.max(factor, maxFactor);
      }
      if (noisy)
        console.log(`Eccentric ellipse integration  (numGauss ${numGauss})   (maxFactor  {maxFactor})`);
      if (numGauss === 5)
        ck.testLE(maxFactor, 20.0, "Eccentric Ellipse integration factor");
    }
    ck.checkpoint("Arc3d.EccentricEllipseLengthAccuracyTable");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ValidateEllipseIntegrationHeuristic", () => {
    const ck = new Checker();
    const degreesInterval = 10.0;
    const numGauss = 5;
    // Construct elliptic arcs of varying eccentricity and angles
    // Integrate with 5 gauss points in intervals of 10 degrees.
    // By trial and error, we have concluded that this should be accurate.
    // Compare to integral with twice as many points.
    for (const sweepDegrees of [30, 90, 135, 180, 239, 360]) {
      for (let e2 = 1.0; e2 < 1000.0; e2 *= 2.0) {
        const e = Math.sqrt(e2);
        const arc = Arc3d.create(Point3d.createZero(),
          Vector3d.create(e, 0, 0),
          Vector3d.create(0, 1, 0), AngleSweep.createStartEndDegrees(0, sweepDegrees));
        const numA = Math.ceil(arc.sweep.sweepDegrees * e / degreesInterval);
        const lengthA = arc.curveLengthWithFixedIntervalCountQuadrature(0.0, 1.0, numA, numGauss);
        const lengthB = arc.curveLengthWithFixedIntervalCountQuadrature(0.0, 1.0, 2 * numA, numGauss);
        const lengthC = arc.curveLength();
        ck.testLE(Math.abs(lengthB - lengthA) / lengthA, 5.0e-15, "direct quadrature", e, numA);
        ck.testLE(Math.abs(lengthB - lengthC) / lengthA, 5.0e-15, "compare to method", e, numA);
      }
    }
    ck.checkpoint("Arc3d.ValidateEllipseIntegrationHeuristic");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ScaledForm", () => {
    const ck = new Checker();
    const arcs = Sample.createManyArcs([0.2, -0.25]);
    for (const arc of arcs) {
      const scaledForm = arc.toScaledMatrix3d();
      const arc1 = Arc3d.createScaledXYColumns(
        scaledForm.center,
        scaledForm.axes,
        scaledForm.r0,
        scaledForm.r90,
        scaledForm.sweep);
      for (const fraction of [0.0, 0.2, 0.4, 0.6, 0.8]) {
        ck.testPoint3d(arc.fractionToPoint(fraction), arc1.fractionToPoint(fraction));
      }
    }
    ck.checkpoint("Arc3d.ScaledForm");
    expect(ck.getNumErrors()).equals(0);
  });

  it("FilletArc", () => {
    const ck = new Checker();

    const allGeometry: GeometryQuery[] = [];
    const radius = 0.5;
    const markerRadius = 0.04;
    const outputStep = 10.0;
    let x0;
    let y0 = 0;
    for (const qz of [0, -1, 3]) {
      x0 = 0;
      for (const qy of [2, 4, -4]) {
        const point0 = Point3d.create(2, qy);
        const point1 = Point3d.create(0, 1, qz);
        const point2 = Point3d.create(3, 0);
        const arcData = Arc3d.createFilletArc(point0, point1, point2, radius);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(point0, point1, point2), x0, y0);
        if (ck.testDefined(arcData, "Fillet Arc exists") && arcData && arcData.arc) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcData.arc, x0, y0);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, point1.interpolate(arcData.fraction10, point0), markerRadius, x0, y0);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, point1.interpolate(arcData.fraction12, point2), markerRadius, x0, y0);
        }
        x0 += outputStep;
      }
      y0 += outputStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "FilletArc");
    expect(ck.getNumErrors()).equals(0);
  });
  // cspell:word Arnoldas
  it("PreciseRange", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const dx = 10.0;
    const options = StrokeOptions.createForCurves();
    const chordTol = 0.001;
    options.chordTol = chordTol;
    const chordTol2 = 2.5 * chordTol;
    const tolerancePullBack = -1.0e-12;
    const linestring = LineString3d.create();
    const rangeE = Range1d.createNull();
    for (const transform of Sample.createInvertibleTransforms()) {
      for (const sweep of sampleSweeps()) {
        const arc = Arc3d.createXYZXYZXYZ(3, 2, 1, 2.5, 2.8, 1.2, -0.2, 0.6, 2.9, AngleSweep.create360());
        arc.sweep.setFrom(sweep);
        const range = arc.range(transform);
        x0 += dx;
        linestring.packedPoints.length = 0;
        arc.emitStrokes(linestring, options);
        linestring.tryTransformInPlace(transform);
        const range1 = linestring.range();
        const e1 = range.low.distance(range1.low) + range.high.distance(range1.high);
        rangeE.extendX(e1);
        arc.tryTransformInPlace(transform);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y0);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, range, x0, y0);
        range1.expandInPlace(tolerancePullBack);
        if (!ck.testTrue(range.containsRange(range1), "precise range contains stroke range", prettyPrint(arc.sweep), prettyPrint(range.toJSON()), prettyPrint(range1.toJSON())))
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, linestring, x0, y0);
        range1.expandInPlace(chordTol2);
        ck.testTrue(range1.containsRange(range), "stroking is close to true range", prettyPrint(arc.sweep), prettyPrint(range.toJSON()), prettyPrint(range1.toJSON()));
      }
      x0 = 0;
      y0 += dx;
    }
    console.log(`chord error range ${rangeE.toJSON()}`);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "PreciseRange");
    expect(ck.getNumErrors()).equals(0);
  });
  // cspell:word Arnoldas
  it("ArnoldasFailureLinearSys3d", () => {
    const ck = new Checker();

    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    const y0 = 0;
    const point0 = Point3d.create(0, 0, 0);
    const point1 = Point3d.create(0, 0, 1);
    const point2 = Point3d.create(1, 0, 1);
    GeometryCoreTestIO.captureGeometry(allGeometry,
      LineString3d.create(point0, point1, point2),
      x0, y0);
    const arc = Arc3d.createCircularStartMiddleEnd(point0, point1, point2) as Arc3d;
    GeometryCoreTestIO.captureGeometry(allGeometry, arc, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "ArnoldasFailureLinearSys3d");
    const r = arc.circularRadius();
    if (ck.testDefined(r) && r !== undefined) {
      ck.testCoordinate(r, point0.distance(arc.center));
      ck.testCoordinate(r, point1.distance(arc.center));
      ck.testCoordinate(r, point2.distance(arc.center));
    }
    expect(ck.getNumErrors()).equals(0);
  });
  // Test near-rectangular offset transitions
  it("CodeCheckerArcTransitionA", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let y0 = 0;
    for (const outerSign of [1.0, -0.4]) {
      let x0 = 0;
      for (const offsetFactor of [0.33, 0.75, 1.0, 1.5]) {
        for (const e of [0.0, 0.1, -0.1]) {
          const b = outerSign;
          const a = offsetFactor * b;
          const offset = [a, b, a, b];
          const points = [
            Point3d.create(0, 0, 0),
            Point3d.create(2, e, 0),
            Point3d.create(2, 2 - e, 0),
            Point3d.create(-e, 2, 0)];
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(points[points.length - 1], points[0]), x0, y0);
          let point0: Point3d | undefined;
          let point1: Point3d | undefined;
          for (let i = 0; i <= points.length; i++) {
            const i0 = (i % points.length);
            const i1 = (i + 1) % points.length;
            const i2 = (i + 2) % points.length;
            const joint = BuildingCodeOffsetOps.createJointWithRadiusChange(points[i0], points[i1], points[i2], offset[i0], offset[i1]);
            if (joint instanceof Arc3d) {
              point1 = joint.startPoint();
              if (point0)
                GeometryCoreTestIO.captureGeometry(allGeometry,
                  LineSegment3d.create(point0, point1), x0, y0);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, joint, x0, y0);
              point0 = joint.endPoint(point0);
            } else if (joint instanceof Point3d) {
              if (point0)
                GeometryCoreTestIO.captureGeometry(allGeometry,
                  LineSegment3d.create(point0, joint), x0, y0);
              point0?.setFromPoint3d(joint);
            } else {
              point0 = undefined;
            }
          }

          const fullOffsetA = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offset, false);
          const fullOffsetB = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offset, true);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetA, x0 + 10, y0);
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0 + 10, y0);

          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetB, x0 + 20, y0);
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0 + 20, y0);
          x0 += 40.0;
        }
        y0 += 10.0;
        x0 = 0.0;
      }
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "CodeCheckerArcTransitionA");
  });
  it("CodeCheckerArcTransitionB", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const points = Sample.createBidirectionalSawtooth(Point3d.create(-1, 0.5, 0), 3, 2, 5, 3, 3, 7, 1, 2, -1, 2);
    const offsets = [];
    for (let i = 0; i + 3 < points.length; i++) {
      offsets.push(0.1);
      offsets.push(0.5);
      offsets.push(0.3);
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
    const fullOffsetA = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offsets, false);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetA, x0, y0);
    y0 += 20.0;
    points.reverse();
    const fullOffsetB = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offsets, false);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetB, x0, y0);

    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "CodeCheckerArcTransitionB");
  });
  it("CodeCheckerArcTransitionC", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const a = 0.0;
    const b = 2.0;
    const c = 2.0;
    const baseOffset = 0.25;
    const dy = 4.0;
    for (const offsetFactor of [4, 1, 2, 4]) {
      let y0 = 0;
      for (const degrees of [90, 80, 70, 50, 30, 10, 100, 120, 135]) {
        const offsets = [baseOffset, baseOffset * offsetFactor, baseOffset];
        const reverseOffsets = [];
        for (const x of offsets)
          reverseOffsets.push(-x);
        const theta = Angle.createDegrees(degrees);
        const points = [Point3d.create(a - c * theta.cos(), c * theta.sin()), Point3d.create(a, 0, 0), Point3d.create(b, 0, 0), Point3d.create(b + c * theta.cos(), c * theta.sin())];
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
        const fullOffsetA = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offsets, false);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetA, x0, y0);
        const fullOffsetA1 = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, reverseOffsets, false);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetA1, x0, y0);
        points.reverse();
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0 + dy);
        const fullOffsetB = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offsets, false);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetB, x0, y0 + dy);
        const fullOffsetB1 = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, reverseOffsets, false);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetB1, x0, y0 + dy);
        y0 += 15.0;
      }
      x0 += 15.0;
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "CodeCheckerArcTransitionC");
  });
  it("CodeCheckerArcTransitionD", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    for (const offsets of [[1, 0.8], [0.8, 1]]) {
      x0 = 0;
      const points = [Point3d.create(0, 0, 0), Point3d.create(0, 1, 0), Point3d.create(-1, 1.1, 0)];
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
      const fullOffsetA = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offsets, false);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetA, x0, y0);
      x0 += 3.0;
      points[2].x *= -1.0;
      offsets[0] *= -1.0;
      offsets[1] *= -1.0;
      const fullOffsetB = BuildingCodeOffsetOps.edgeByEdgeOffsetFromPoints(points, offsets, false);
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullOffsetB, x0, y0);
      y0 += 5.0;
    }

    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "CodeCheckerArcTransitionD");
  });
  it("CreateCenterNormalRadius", () => {
    const ck = new Checker();

    for (const normal of [Vector3d.unitX(), Vector3d.unitY(-2), Vector3d.unitZ(3), new Vector3d(1, 2, 3)]) {
      const arc = Arc3d.createCenterNormalRadius(undefined, normal, 10);
      ck.testVector3d(normal.normalize()!, arc.perpendicularVector, `for normal ${prettyPrint(normal)}`);
    }

    ck.checkpoint("Arc3d.CreateCenterNormalRadius");
    expect(ck.getNumErrors()).equals(0);
  });
});
