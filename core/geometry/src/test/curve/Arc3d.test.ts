/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Plane3dByOriginAndUnitNormal } from "../../core-geometry";
import { Arc3d } from "../../curve/Arc3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { AxisOrder, Geometry } from "../../Geometry";
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
import { BuildingCodeOffsetOps } from "./BuildingCodeOffsetOps";

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

  const arcXY = Arc3d.createXY(Point3d.create(2, 7, 1), 8, AngleSweep.createStartEndRadians(2, 8));
  const arcE = arcXY.cloneAtZ();
  ck.testTrue(arcE.isAlmostEqual(arcXY), "cloneAtZ of xy-arc with undefined param is just clone");
  ck.testFalse(arcC.isInPlane(Plane3dByOriginAndUnitNormal.createXYPlane(arcC.center)), "arcC is a non-xy-arc");
  const arcF = arcC.cloneAtZ();
  ck.testFalse(arcF.isAlmostEqual(arcC), "cloneAtZ of non-xy-arc is not the same arc");
  ck.testPoint3d(arcF.center, arcC.center, "cloneAtZ of non-xy-arc with undefined param doesn't change center");
  ck.testTrue(arcF.isInPlane(Plane3dByOriginAndUnitNormal.createXYPlane(arcF.center)), "cloneAtZ of non-xy-arc with undefined param is in the horizontal plane at its center");
  const arcG = arcC.cloneAtZ(100);
  ck.testExactNumber(arcG.center.z, 100, "cloneAtZ sets new center to param");
  ck.testTrue(arcG.isInPlane(Plane3dByOriginAndUnitNormal.createXYPlane(Point3d.create(arcC.center.x, arcC.center.y, 100))), "cloneAtZ of non-xy-arc is in the horizontal plane at the new center");
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
  const arc1 = arc.cloneTransformed(scaleTransform);
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
  const arc3A = arc.clonePartialCurve(fA, fB);
  const arc3B = arc.clonePartialCurve(fB, fA);
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
        Vector3d.create(0, 2, 0), AngleSweep.createStartEndDegrees(0, 90)));

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
            GeometryCoreTestIO.consoleLog(prettyPrint(arc));
          }
        }
      }
      // GeometryCoreTestIO.consoleLog(prettyPrint(sweep) + prettyPrint(factorRange1));
    }
    // GeometryCoreTestIO.consoleLog("Arc3d QuickLength FactorRange" + prettyPrint(factorRange));
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
        GeometryCoreTestIO.consoleLog(`\n\n  ******************* numGauss ${numGauss}`);
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
          GeometryCoreTestIO.consoleLog("---");
          GeometryCoreTestIO.consoleLog(` eccentricity ${e} ${lengths.toString()}(n ${lastNumInterval})(n / (fe) ${factor}`);
          GeometryCoreTestIO.consoleLog(` deltas                             ${deltas.toString()}`);
        }
        maxFactor = Math.max(factor, maxFactor);
      }
      if (noisy)
        GeometryCoreTestIO.consoleLog(`Eccentric ellipse integration  (numGauss ${numGauss})   (maxFactor  {maxFactor})`);
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
        if (ck.testDefined(arcData, "Fillet Arc exists") && arcData.arc) {
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
    GeometryCoreTestIO.consoleLog(`chord error range ${JSON.stringify(rangeE.toJSON())}`);
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
    if (ck.testDefined(r)) {
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
  // compare arc properties as CurvePrimitive and in equivalent 2-arc CurveChainWithDistanceIndex
  it("CurvatureTest", () => {
    const ck = new Checker();
    const radius = 100.0;
    const curvature = 1.0 / radius;
    const circle = Arc3d.createXY(Point3d.createZero(), 100.0);
    // two arcs of unequal sweep that join to cover the full circle
    const arc1 = Arc3d.createXY(Point3d.createZero(), 100.0, AngleSweep.createStartEndDegrees(0, 90));
    const arc2 = Arc3d.createXY(Point3d.createZero(), 100.0, AngleSweep.createStartEndDegrees(90, 360));
    const path = new Path();
    path.children.push(arc1);
    path.children.push(arc2);
    const indexed = CurveChainWithDistanceIndex.createCapture(path);

    for (const fraction of [0.0, 0.125]) {
      const circleCurvature = circle.fractionToCurvature(fraction)!;
      const circleDerivatives = circle.fractionToPointAnd2Derivatives(0.0);
      ck.testCoordinate(circleCurvature, curvature, "curvature from full circle");
      assert.isTrue(Geometry.isAlmostEqualNumber(circleCurvature, curvature));

      const pathCurvature = indexed.fractionToCurvature(fraction)!;
      ck.testCoordinate(pathCurvature, curvature, "curvature from arcs in path");
      const pathDerivatives = indexed.fractionToPointAnd2Derivatives(0.0)!;
      ck.testPoint3d(circleDerivatives.origin, pathDerivatives.origin, "point");
      ck.testVector3d(circleDerivatives.vectorU, pathDerivatives.vectorU, "vectorU");
      ck.testVector3d(circleDerivatives.vectorV, pathDerivatives.vectorV, "vectorV");
    }
    expect(ck.getNumErrors()).equals(0);
  });
  // Test 3-point elliptical arc constructor
  it("CreateThreePointEllipse", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;

    const p0 = Point3d.create(1, 0, 0);
    const p1 = Point3d.create(0, 1, 0);
    const p2 = Point3d.create(-1, 0, 0);
    const unitCircle = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unitCircle, x0);
    if (ck.testDefined(unitCircle, "created the arc")) {
      ck.testTrue(unitCircle.sweep.isFullCircle, "ellipse is full sweep");
      ck.testPoint3d(unitCircle.center, Point3d.createZero(), "ellipse centered at origin");
      ck.testVector3d(unitCircle.vector0, Vector3d.create(p0.x, p0.y, p0.z), "ellipse vector0 along x-axis");
      ck.testVector3d(unitCircle.vector90, Vector3d.create(p1.x, p1.y, p1.z), "ellipse vector90 along y-axis");
      if (ck.testTrue(unitCircle.isCircular, "ellipse is circular"))
        ck.testExactNumber(unitCircle.circularRadius()!, 1, "circle has radius 1");
    }
    x0 += 5;
    p1.y = 2;
    const ellipse1 = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse1, x0);
    if (ck.testDefined(ellipse1, "created the arc")) {
      ck.testTrue(ellipse1.sweep.isFullCircle, "ellipse is full sweep");
      ck.testPoint3d(ellipse1.center, Point3d.createZero(), "ellipse centered at origin");
      ck.testVector3d(ellipse1.vector0, Vector3d.create(p0.x, p0.y, p0.z), "ellipse vector0 along x-axis");
      ck.testVector3d(ellipse1.vector90, Vector3d.create(p1.x, p1.y, p1.z), "ellipse vector90 along y-axis");
      ck.testFalse(ellipse1.isCircular, "ellipse is not circular");
    }
    x0 += 5;
    p0.y = 1;
    p2.y = -1;
    const ellipse2 = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse2, x0);
    ck.testUndefined(ellipse2, "arc construction not possible");
    x0 += 5;
    p1.y = 1.95;
    const ellipse3 = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse3, x0);
    if (ck.testDefined(ellipse3, "created the arc")) {
      ck.testTrue(ellipse3.sweep.isFullCircle, "ellipse is full sweep");
      ck.testPoint3d(ellipse3.center, Point3d.createZero(), "ellipse centered at origin");
      ck.testVector3d(ellipse3.vector0, Vector3d.create(p0.x, p0.y, p0.z), "ellipse vector0 along x-axis");
      ck.testFalse(ellipse3.isCircular, "ellipse is not circular");
    }
    x0 += 5;
    p1.y = -1.95;
    const ellipse4 = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse4, x0);
    if (ck.testDefined(ellipse4, "created the arc")) {
      ck.testTrue(ellipse4.sweep.isFullCircle, "ellipse is full sweep");
      ck.testPoint3d(ellipse4.center, Point3d.createZero(), "ellipse centered at origin");
      ck.testVector3d(ellipse4.vector0, Vector3d.create(p0.x, p0.y, p0.z), "ellipse vector0 along x-axis");
      ck.testFalse(ellipse4.isCircular, "ellipse is not circular");
    }
    x0 += 5;
    p1.y = -2;
    const ellipse5 = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse5, x0);
    ck.testUndefined(ellipse5, "arc construction not possible");
    x0 += 5;
    p1.y = 1;
    const ellipse6 = Arc3d.createStartMiddleEnd(p0, p1, p2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse6, x0);
    if (ck.testDefined(ellipse6, "created the arc")) {
      ck.testTrue(ellipse6.sweep.isFullCircle, "ellipse is full sweep");
      ck.testPoint3d(ellipse6.center, Point3d.createZero(), "ellipse centered at origin");
      ck.testVector3d(ellipse6.vector0, Vector3d.create(p0.x, p0.y, p0.z), "ellipse vector0 along x-axis");
      ck.testFalse(ellipse6.isCircular, "ellipse is not circular");
      ck.testCoordinate(0, ellipse6.closestPoint(p1, false).a, "middle point is on the ellipse");
    }
    x0 += 5;
    p1.y = -1;
    const ellipse7 = Arc3d.createStartMiddleEnd(p0, p1, p2, AngleSweep.createStartEndDegrees(0, 200));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p0, p1, p2], x0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipse7, x0);
    if (ck.testDefined(ellipse7, "created the arc")) {
      ck.testFalse(ellipse7.sweep.isFullCircle, "ellipse is not full sweep");
      ck.testPoint3d(ellipse7.center, Point3d.createZero(), "ellipse centered at origin");
      ck.testVector3d(ellipse7.vector0, Vector3d.create(p0.x, p0.y, p0.z), "ellipse vector0 along x-axis");
      ck.testFalse(ellipse7.isCircular, "ellipse is not circular");
      ck.testCoordinate(0, ellipse7.closestPoint(p1, false).a, "middle point is on the ellipse");
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "CreateThreePointEllipse");
    expect(ck.getNumErrors()).equals(0);
  });

  it.only("ParameterizationSpeed", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    // Return theta in first quadrant
    const curvatureToRadians = (ellipticalArc: Arc3d, curvature: number): number | undefined => {
      if (ellipticalArc.isCircular)
        return undefined;
      if (curvature <= 0)
        return undefined;
      if (!ellipticalArc.vector0.isPerpendicularTo(ellipticalArc.vector90))
        return undefined;
      const uLengthSquared = ellipticalArc.vector0.magnitudeSquared();
      const vLengthSquared = ellipticalArc.vector90.magnitudeSquared();
      const scaledNormalLengthSquared = (uLengthSquared * vLengthSquared) / (curvature * curvature);
      const numerator = Math.cbrt(scaledNormalLengthSquared) - uLengthSquared;
      const denominator = vLengthSquared - uLengthSquared;
      const cosTheta = Math.sqrt(Math.abs(numerator / denominator));
      return Math.acos(cosTheta);
    };

    const curvatureToFractions = (ellipticalArc: Arc3d, curvature: number): number[] => {
      const fractions: number[] = [];
      const angle0 = curvatureToRadians(ellipticalArc, curvature);
      if (angle0 !== undefined) {
        for (const theta of [angle0 /* 1Q */, Math.PI - angle0  /* 2Q */, Math.PI + angle0  /* 3Q */, -angle0 /* 4Q */]) {
          const fraction = ellipticalArc.sweep.radiansToSignedPeriodicFraction(theta);
          if (Geometry.isIn01WithTolerance(fraction, Geometry.smallFraction)) {
            fractions.push(fraction);
          }
        }
      }
      return fractions;
    };

    const a = 10;
    const b = 3;
    let x0 = 0;
    const xDelta = 2 * a + 1;
    let y0 = 0;
    const yDelta = 2 * b + 1;
    let z0 = 0;
    const zDelta = 2 * Math.max(a, b) + 1;

    // lambda f [0,1]->[0,1] is bijective
    const testArc = (ellipticalArc: Arc3d, numPointsInQuadrant: number, f: (x: number) => number): void => {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipticalArc, x0, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [ellipticalArc.center.plus(ellipticalArc.vector0), ellipticalArc.center, ellipticalArc.center.plus(ellipticalArc.vector90)], x0, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [ellipticalArc.center, ellipticalArc.startPoint()], x0, y0, z0);
      const fractions = new Set<number>();
      // add quadrant points
      for (const quadrantAngle of [0, Angle.piOver2Radians, Math.PI, Math.PI + Angle.piOver2Radians])
        if (ellipticalArc.sweep.isRadiansInSweep(quadrantAngle))
          fractions.add(ellipticalArc.sweep.radiansToSignedPeriodicFraction(quadrantAngle));
      // add end points
      fractions.add(0);
      fractions.add(1);
      // find the points in 1st quadrant, then use symmetry to populate
      const curvature0 = ellipticalArc.matrixRef.columnYMagnitude() / ellipticalArc.matrixRef.columnXMagnitudeSquared();
      const curvature1 = ellipticalArc.matrixRef.columnXMagnitude() / ellipticalArc.matrixRef.columnYMagnitudeSquared();
      const tDelta = 1.0 / (numPointsInQuadrant - 1);
      for (let i = 1; i < numPointsInQuadrant - 1; ++i) {
        const j = f(i * tDelta);
        const curvature = (1 - j) * curvature0 + j * curvature1;
        for (const fraction of curvatureToFractions(ellipticalArc, curvature))
          fractions.add(fraction);
      }
      for (const fraction of [...fractions].sort())
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, ellipticalArc.fractionToPoint(fraction), 0.1, x0, y0, z0);
    };

    const arcs: Arc3d[] = [];

    // xy-plane, perp-axis arcs
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b));
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(0, 90)));
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(-100, 32)));
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(147, -100)));

    // general arcs need their axes squared first
    const scaleData = Arc3d.create(Point3d.create(1, 3, 2), Vector3d.create(2, 4, -1), Vector3d.create(3, 2, -3)).toScaledMatrix3d();
    arcs.push(Arc3d.createScaledXYColumns(scaleData.center, scaleData.axes, scaleData.r0, scaleData.r90, scaleData.sweep));
    arcs.push(Arc3d.createScaledXYColumns(scaleData.center, scaleData.axes, scaleData.r0, scaleData.r90));
    arcs.push(Arc3d.createScaledXYColumns(scaleData.center, scaleData.axes, scaleData.r0, scaleData.r90, AngleSweep.createStartEndDegrees(100, 120)));

    const fLinear = (x: number): number => { return x; };
    const fPiecewiseLinearUnder = (x: number): number => {
      const breakFraction = 0.6;
      const slope = (1 - breakFraction) / breakFraction;
      return (x <= breakFraction) ? slope * x : slope * breakFraction + ((1 - slope * breakFraction) / (1 - breakFraction)) * (x - breakFraction);
      };
    const fSqrtCubed = (x: number): number => { return Math.pow(x, 1.5); };
    const fQuadratic = (x: number): number => { return x * x; };
    const fCubic = (x: number): number => { return x * x * x; };
    const fQuartic = (x: number): number => { return x * x * x * x;};
    const fSqrt = (x: number): number => { return Math.sqrt(x); };
    const fLinearWave = (x: number): number => {
      if (x === 0) return 0;
      if (x === 1) return 1;
      const scale = (b < a) ? b / a : a / b;
      return 0.5 + 1 / Math.PI * Math.atan(scale * Math.tan(Math.PI * (x - 0.5)));
    };
    const fLinearWaveInverse = (x: number): number => {
      if (x === 0) return 0;
      if (x === 1) return 1;
      const scale = (a < b) ? b / a : a / b;
      return 0.5 + 1 / Math.PI * Math.atan(scale * Math.tan(Math.PI * (x - 0.5)));
    };

    // plot curvature->pointHeight and arc with same y-scale in the first quadrant of the ellipse
    const plotCurvatureDistribution = (arc: Arc3d, numPts: number, f: (x: number) => number): void => {
      const yMag = arc.matrixRef.columnYMagnitude();
      const c0 = yMag / arc.matrixRef.columnXMagnitudeSquared();    // curvature at y-axis point
      const c1 = arc.matrixRef.columnXMagnitude() / (yMag * yMag);  // curvature at x-axis point
      const mapPts: Point3d[] = [];
      const blendPts: Point3d[] = [];
      const arcPts: Point3d[] = [];
      const numSamples = 1 + numPts * 10;
      const tDelta = 1 / (numSamples - 1);
      mapPts.push(Point3d.create(c0, Angle.piOver2Radians)); // nail the first point
      blendPts.push(Point3d.createZero());
      for (let i = 1; i < numSamples - 1; ++i) {
        const t = i * tDelta;
        const j = f(t);
        const c = (1 - j) * c0 + j * c1;  // interpolate between c0 and c1
        const theta = curvatureToRadians(arc, c)!;
        mapPts.push(Point3d.create(c, theta));
        blendPts.push(Point3d.create(t, j));
      }
      mapPts.push(Point3d.create(c1, 0)); // nail the last point
      blendPts.push(Point3d.create(1, 1));
      const localArc = arc.cloneTransformed(Transform.createRigidFromOriginAndColumns(arc.center, arc.vector0, arc.vector90, AxisOrder.XYZ)!.inverse()!);
      for (let i = 0; i < numSamples; ++i) {
        const theta = mapPts[i].y;
        const arcPt = localArc.radiansToPoint(theta);
        mapPts[i].y = arcPt.y;  // equate map and arc y-scale
        if (i % numPts === 0)
          arcPts.push(arcPt);
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mapPts, x0, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, blendPts, x0 + 2, y0, z0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcPts, x0 + 1 ,y0, z0);
    };

    for (const arc of arcs) {
      for (const f of [fLinear, fPiecewiseLinearUnder, fSqrtCubed, fQuadratic, fCubic, fQuartic, fSqrt, fLinearWave, fLinearWaveInverse]) {
        plotCurvatureDistribution(arc, 10, f);
        y0 += yDelta;
        for (const numQuadrantPoints of [3, 4, 5, 6, 10, 20]) {
          testArc(arc, numQuadrantPoints, f);
          z0 += zDelta;
        }
        x0 += xDelta;
        z0 = y0 = 0;
      }
      x0 += 3 * xDelta;
      z0 = 0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "ParameterizationSpeed");
    expect(ck.getNumErrors()).equals(0);
  });
});
