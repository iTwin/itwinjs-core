/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from "vitest";
import { compareNumbers, OrderedSet } from "@itwin/core-bentley";
import { Constant } from "../../Constant";
import { Arc3d, EllipticalArcApproximationOptions, EllipticalArcSampleMethod, FractionMapper } from "../../curve/Arc3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { CurveChain } from "../../curve/CurveCollection";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { EllipticalArcApproximationContext, QuadrantFractions } from "../../curve/internalContexts/EllipticalArcApproximationContext";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { BuildingCodeOffsetOps } from "./BuildingCodeOffsetOps";

describe("Arc3d", () => {
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
  it("createCircularStartTangentEnd", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let dx = 0;
    const start1 = Point3d.create(1, 3, 0);
    const end1 = Point3d.create(5, 3, 0);
    const tangent1 = Vector3d.create(-1, 1, 0);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start1, 0.1, dx);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, end1, 0.1, dx);
    const circularArc1 = Arc3d.createCircularStartTangentEnd(start1, tangent1, end1) as Arc3d;
    const circle1 = Arc3d.create(
      circularArc1.center, circularArc1.vector0, circularArc1.vector90, AngleSweep.createStartEndDegrees(0, 360),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circularArc1, dx);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle1, dx);
    ck.testPoint3d(circularArc1.startPoint(), start1);
    ck.testPoint3d(circularArc1.endPoint(), end1);
    ck.testPoint3d(circularArc1.center, Point3d.create(3, 5, 0));

    dx += 10;
    const start2 = Point3d.create(1, 4, 0);
    const end2 = Point3d.create(5, 4, 0);
    const tangent2 = Vector3d.create(1, 0, 0);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start2, 0.1, dx);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, end2, 0.1, dx);
    const tangentLineSeg = LineSegment3d.create(start2, start2.plusScaled(tangent2, 1));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, tangentLineSeg, dx);
    const lineSeg = Arc3d.createCircularStartTangentEnd(start2, tangent2, end2) as LineSegment3d;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineSeg, dx);
    ck.testPoint3d(lineSeg.startPoint(), start2);
    ck.testPoint3d(lineSeg.endPoint(), end2);

    dx += 10;
    const start3 = Point3d.create(2, 0, 0);
    const end3 = Point3d.create(0, 2, 0);
    const tangent3 = Vector3d.create(0, 1, 0);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start3, 0.1, dx);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, end3, 0.1, dx);
    const circularArc3 = Arc3d.createCircularStartTangentEnd(start3, tangent3, end3) as Arc3d;
    const circle3 = Arc3d.create(
      circularArc3.center, circularArc3.vector0, circularArc3.vector90, AngleSweep.createStartEndDegrees(0, 360),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circularArc3, dx);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle3, dx);
    ck.testPoint3d(circularArc3.startPoint(), start3);
    ck.testPoint3d(circularArc3.endPoint(), end3);
    ck.testPoint3d(circularArc3.center, Point3d.create());

    dx += 10;
    const start4 = Point3d.create(0, 0, 0);
    const end4 = Point3d.create(1, 1, 1);
    const tangent4 = Vector3d.create(0, -1, 0);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start4, 0.1, dx);
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, end4, 0.1, dx);
    const circularArc4 = Arc3d.createCircularStartTangentEnd(start4, tangent4, end4) as Arc3d;
    const circle4 = Arc3d.create(
      circularArc4.center, circularArc4.vector0, circularArc4.vector90, AngleSweep.createStartEndDegrees(0, 360),
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circularArc4, dx);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circle4, dx);
    ck.testPoint3d(circularArc4.startPoint(), start4);
    ck.testPoint3d(circularArc4.endPoint(), end4);
    ck.testPoint3d(circularArc4.center, Point3d.create(0.75, 0, 0.75));

    GeometryCoreTestIO.saveGeometry(allGeometry, "Arc3d", "createCircularStartTangentEnd");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("ApproximateArc3d", () => {
  const remaps: FractionMapper[] = [];
  remaps.push((x: number) => x);                // identity
  remaps.push((x: number) => {                  // piecewise linear (under)
    const f = 0.6; // could be improved by dependence on eccentricity
    const slope = (1 - f) / f;
    return (x <= f) ? slope * x : slope * f + ((1 - slope * f) / (1 - f)) * (x - f);
  });
  remaps.push((x: number) => Math.pow(x, 1.5)); // sqrt cubed
  remaps.push((x: number) => x * x);            // quadratic
  remaps.push((x: number) => x * x * x);        // cubic
  remaps.push((x: number) => x * x * x * x);    // quartic
  remaps.push((x: number) => Math.sqrt(x));     // sqrt
  function iMethodToString(iMethod: number | undefined): string {
    switch (iMethod) {
      case -1: return "Naive";
      case 0: return "Identity";
      case 1: return "PwLinear";
      case 2: return "SqrtCubed";
      case 3: return "Quadratic";
      case 4: return "Cubic";
      case 5: return "Quartic";
      case 6: return "Sqrt";
      case 7: return "Subdivision";
      case undefined:
      default: return "Undefined";
    }
  }
  function displaySamples(
    allGeometry: GeometryQuery[],
    arc: Arc3d,
    samples: QuadrantFractions[] | number[],
    x?: number, y?: number, z?: number,
  ): void {
    if (!GeometryCoreTestIO.enableSave)
      return;
    if (samples[0] instanceof QuadrantFractions) {
      for (let i = 0; i < samples.length; ++i) {
        const quadrant = samples[i] as QuadrantFractions;
        for (let j = 0; j < quadrant.fractions.length - 1; ++j) // skip last fraction...
          GeometryCoreTestIO.createAndCaptureXYCircle(
            allGeometry, arc.fractionToPoint(quadrant.fractions[j]), 0.1, x, y, z,
          );
        if (i === samples.length - 1 && !arc.sweep.isFullCircle) // ...unless last fraction of last quadrant of open arc
          GeometryCoreTestIO.createAndCaptureXYCircle(
            allGeometry, arc.fractionToPoint(quadrant.fractions[quadrant.fractions.length - 1]), 0.1, x, y, z,
          );
      }
    } else {
      for (const fraction of samples as number[])
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, arc.fractionToPoint(fraction), 0.1, x, y, z);
    }
  }

  it("Defaults", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0;

    const computeDefaultChainError = (ellipticalArc: Arc3d): number => {
      const defaultContext = EllipticalArcApproximationContext.create(ellipticalArc);
      const defaultOptions = EllipticalArcApproximationOptions.create();
      const samples = defaultContext.computeSampleFractions(defaultOptions, true) as QuadrantFractions[];
      if (GeometryCoreTestIO.enableSave) {
        const defaultChain = ellipticalArc.constructCircularArcChainApproximation(defaultOptions);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, defaultChain, dx);
        displaySamples(allGeometry, defaultContext.ellipticalArc, samples, dx);
      }
      const defaultChainErrorDetail = defaultContext.computeApproximationError(samples);
      let error = -1;
      if (ck.testDefined(defaultChainErrorDetail, "cover arc chain approximation error computation"))
        error = defaultChainErrorDetail.detailA.a;
      return error;
    };

    // test default approximation error for arcs of various sweeps
    let arc = Arc3d.createUnitCircle();
    let error0 = 0;
    for (let endAngle = 360; endAngle > -360; endAngle -= 83) {
      const sweep = AngleSweep.createStartEndDegrees(0, endAngle);
      arc = Arc3d.create(Point3d.createZero(), Vector3d.create(5, 0), Vector3d.create(0, 8), sweep);
      error0 = computeDefaultChainError(arc);
      ck.testLT(Geometry.smallFraction, error0, "computed a nonzero arc chain approximation error");
      ck.testLE(error0, Constant.oneCentimeter, "computed arc chain approximation error less than default tolerance");
      dx += 20;
    }

    const arc0 = arc.clone();
    const rotationAxis: Vector3d = Vector3d.createNormalized(47, 73, -112)!;
    const rotationMatrix = Matrix3d.createRotationAroundVector(rotationAxis, Angle.createDegrees(32))!;
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotationMatrix);
    arc0.tryTransformInPlace(rotationTransform);
    const error1 = computeDefaultChainError(arc0);
    ck.testCoordinate(error0, error1, "approximation error is invariant under arc rotation");

    GeometryCoreTestIO.saveGeometry(allGeometry, "ApproximateArc3d", "Defaults");
    expect(ck.getNumErrors()).equals(0);
  });

  it("EllipseSampler", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const a = 10;
    const b = 3;
    let x0 = 0;
    const xDelta = (arcWidth: number) => 2 * arcWidth + 1;
    let y0 = 0;
    const yDelta = (arcHeight: number) => 2 * arcHeight + 1;
    const arcs: Arc3d[] = [];

    // xy-plane, perp-axis arcs
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b));                                               // ccw full
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(0, 90)));      // ccw Q1
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(-100, 32)));   // ccw contains seam
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(147, -100)));  // cw contains seam
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, b, AngleSweep.createStartEndDegrees(100, 120)));   // ccw tiny sweep in one quadrant
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, a - 2, AngleSweep.createStartEndDegrees(90, 0)));  // cw Q1
    arcs.push(Arc3d.createXYEllipse(Point3d.createZero(), a, 1, AngleSweep.createStartEndDegrees(90, 270)));    // ccw Q2+Q3
    if (GeometryCoreTestIO.enableLongTests) { // general arcs
      const arc0 = Arc3d.create(Point3d.createZero(), Vector3d.create(2, 4, -1), Vector3d.create(3, 2, -3));
      arcs.push(arc0);  // random #1
      const perpData0 = arc0.toScaledMatrix3d();
      const arc1 = Arc3d.createScaledXYColumns(perpData0.center, perpData0.axes, perpData0.r0, perpData0.r90);
      arcs.push(arc1);  // different start
      const arc2 = arc0.clone();
      arc2.sweep = AngleSweep.createStartEndDegrees(345, -15);
      arcs.push(arc2);  // cw full, different start
      const arc3 = arc0.clone();
      arc3.sweep = AngleSweep.createStartEndDegrees(100, 80);
      arcs.push(arc3);  // cw tiny sweep across 2 quadrants
      const arc4 = Arc3d.createStartMiddleEnd(Point3d.create(-1, -1, -2), Point3d.create(0.5, 0.5, 1.7), Point3d.create(1, 1, 2));
      if (ck.testDefined(arc4, "use 3pt elliptical arc ctor"))
        arcs.push(arc4);  // random #2
    }

    const convertToFlatArray = (array: QuadrantFractions[] | number[]): number[] => {
      if (0 === array.length)
        return [];
      if (Number.isFinite(array[0]))
        return array as number[];
      const set = new OrderedSet<number>(compareNumbers);
      for (const q of array as QuadrantFractions[]) {
        for (const f of q.fractions)
          set.add(f);
      }
      return [...set];
    };
    const testAndCompareSamples = (arc: Arc3d, flat: number[], structured: QuadrantFractions[]): void => {
      ck.testTrue(flat.length > 0, "flat output format has samples");
      ck.testTrue(structured.length > 0, "structured output format has quadrants");
      const flat2 = convertToFlatArray(structured);
      for (const q of structured) {
        ck.testLE(3, q.fractions.length, "at least 3 samples per quadrant");
        if (q.averageAdded) {
          flat.push(q.fractions[1]); // flat doesn't contain this extra sample
          flat.sort();
        }
      }
      ck.testFractionArray(flat, flat2, "flat output equivalent to structured output");
      // verify symmetry of full-ellipse samples
      if (arc.sweep.isFullCircle && arc.sweep.startDegrees === 0 && arc.sweep.isCCW) {
        ck.testExactNumber(4, structured.length, "full ellipse samples consist of 4 quadrants");
        const ptsQ1: Point3d[] = [];
        for (const q of structured) { // sample first quadrant
          if (q.quadrant === 1) {
            ck.testExactNumber(0, q.fractions[0], "full ellipse first quadrant samples start at 0");
            for (const f of q.fractions)
              ptsQ1.push(arc.fractionToPoint(f));
            break;
          }
        }
        const rotateY180 = Transform.createOriginAndMatrix(undefined, Matrix3d.createRotationAroundVector(arc.matrixRef.columnY(), Angle.createDegrees(180)));
        const rotateX180 = Transform.createOriginAndMatrix(undefined, Matrix3d.createRotationAroundVector(arc.matrixRef.columnX(), Angle.createDegrees(180)));
        for (const q of structured) { // compare to reflections of other quadrants
          if (q.quadrant > 1) {
            const pts: Point3d[] = [];
            for (const f of q.fractions)
              pts.push(arc.fractionToPoint(f));
            switch (q.quadrant) {
              case 2: {
                pts.reverse();
                rotateY180.multiplyPoint3dArrayInPlace(pts);
                break;
              }
              case 3: {
                rotateY180.multiplyPoint3dArrayInPlace(pts);
                rotateX180.multiplyPoint3dArrayInPlace(pts);
                break;
              }
              case 4: {
                pts.reverse();
                rotateX180.multiplyPoint3dArrayInPlace(pts);
                break;
              }
            }
            ck.testPoint3dArray(ptsQ1, pts, `test symmetry of Q1 and ${q.quadrant}`);
          }
        }
      }
    };
    const testArc = (arc: Arc3d, options: EllipticalArcApproximationOptions, x?: number, y?: number) => {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x, y);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc.center, arc.startPoint()], x, y);

      const context = EllipticalArcApproximationContext.create(arc);
      if (!ck.testTrue(context.isValidEllipticalArc, "context accepted arc"))
        return { err: undefined, nSeg: 0 };

      const squaredAxes = [arc.center.plus(context.ellipticalArc.vector0), arc.center, arc.center.plus(context.ellipticalArc.vector90)];
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, squaredAxes, x, y);

      // test sampler. NOTE: samples correspond to the context's squared arc
      const flatSamples = context.computeSampleFractions(options, false) as number[];
      const samples = context.computeSampleFractions(options, true) as QuadrantFractions[];
      displaySamples(allGeometry, context.ellipticalArc, flatSamples, x, y);
      testAndCompareSamples(context.ellipticalArc, flatSamples, samples);

      // test construction
      const chain = context.constructCircularArcChainApproximation(options);
      if (ck.testDefined(chain, "constructed arc chain approximation"))
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x, y);

      // test error computation
      const chainError = context.computeApproximationError(samples);
      if (ck.testDefined(chainError, "cover arc chain approximation error computation") &&
        ck.testTrue(chainError.detailA.a > Geometry.smallFraction, "computed a nonzero arc chain approximation error")) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [chainError.detailA.point, chainError.detailB.point], x, y);
      }
      return { err: chainError ? chainError.detailA.a : undefined, nSeg: chain ? chain.children.length : 0 };
    };

    const numSamples = [3, 4, 5];
    if (GeometryCoreTestIO.enableLongTests)
      numSamples.push(...[6, 10, 20]);
    const methodWins = new Map<number, number>(); // <iMethod, winCount>

    for (let iArc = 0; iArc < arcs.length; ++iArc) {
      const arc = arcs[iArc];
      const perpData = arc.toScaledMatrix3d();
      const xWidth = perpData.r0;
      const yWidth = perpData.r90;
      let iMin: number | undefined; // id of the minimum error approximation
      let eMin: number | undefined; // error of the minimum error approximation
      let nMin: number | undefined; // segment count of the minimum error approximation
      for (const n of numSamples) {
        // the naive method
        let method = EllipticalArcSampleMethod.UniformParameter;
        let options = EllipticalArcApproximationOptions.create(method, n);
        let results = testArc(arc, options, x0, y0);
        if (undefined !== results.err) {
          iMin = -1;
          eMin = results.err;
          nMin = results.nSeg;
        }
        y0 += yDelta(yWidth);

        // the curvature interpolation methods (including uniform)
        method = EllipticalArcSampleMethod.NonUniformCurvature;
        for (let iRemap = 0; iRemap < remaps.length; ++iRemap) {
          options = EllipticalArcApproximationOptions.create(method, n, undefined, remaps[iRemap]);
          results = testArc(arc, options, x0, y0);
          const firstError = undefined === eMin && undefined !== results.err;
          const updateError = undefined !== eMin && undefined !== results.err && eMin > results.err;
          if (firstError || updateError) {
            iMin = iRemap;
            eMin = results.err;
            nMin = results.nSeg;
          }
          y0 += yDelta(yWidth);
        }

        // the subdivision method (wins if doesn't increase eMin and nSeg)
        const iSub = remaps.length;
        if (ck.testDefined(eMin, "Have a min error to beat") && ck.testDefined(nMin, "Have #segments to beat")) {
          method = EllipticalArcSampleMethod.AdaptiveSubdivision;
          options = EllipticalArcApproximationOptions.create(method, undefined, eMin);
          results = testArc(arc, options, x0, y0);
          if (ck.testDefined(results.err, `Method ${iMethodToString(iSub)} approximation error computed`)) {
            if (ck.testLE(results.err, eMin, `Method ${iMethodToString(iSub)} achieved desired max error`)) {
              if (results.nSeg <= nMin) {
                iMin = iSub;
                eMin = results.err;
                nMin = results.nSeg;
              }
            }
          }
          y0 += yDelta(yWidth);
        }

        if (
          ck.testDefined(eMin, "Have best approx error") &&
          ck.testDefined(iMin, "Have best approx method id") &&
          ck.testDefined(nMin, "Have best approx segment count")
        ) {
          GeometryCoreTestIO.consoleLog(`Arc ${iArc} min error is ${eMin} using ${iMethodToString(iMin)} on ${n} Q1 samples with chain count ${nMin}.`);
          const numWins = methodWins.get(iMin) ?? 0;
          methodWins.set(iMin, numWins + 1);
        }
        x0 += xDelta(xWidth);
        y0 = 0;
      }
      x0 += 2 * xDelta(xWidth);
    }
    let maxWins = 0;
    let iWinner = -2;
    const nTrials = numSamples.length * arcs.length;
    methodWins.forEach((winCount: number, iMethod: number) => {
      if (winCount > maxWins) {
        maxWins = winCount;
        iWinner = iMethod;
      }
      GeometryCoreTestIO.consoleLog(`Method ${iMethodToString(iMethod)} won ${winCount} times (${Math.round(100 * winCount / nTrials)}%).`);
    });
    // Observed: subdivision is most accurate method in 57% of ellipses tested (69% with enableLongTests)
    if (ck.testExactNumber(iWinner, 7, `expect ${iMethodToString(7)} method to have best approximation more often than other methods`)) {
      const targetPct = GeometryCoreTestIO.enableLongTests ? 65 : 50;
      ck.testLE(targetPct, 100 * maxWins / nTrials, `expect ${iMethodToString(7)} to have best approximation most of the time`);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ApproximateArc3d", "EllipseSampler");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SubdivisionSampler", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const center = Point3d.createZero();
    const a = 10;
    const delta = 1.2 * a;
    let x = 0;
    let y = 0;
    let nSubdivisionLosses = 0;
    let nSubdivisionComparisonWins = 0;
    let nComparisons = 0;
    let nEllipses = 0;

    interface Approximation {
      approx: CurveChain | Arc3d | undefined;
      error: number;
      errorSegment: Point3d[];
      nSamplesQ1: number;
      isValidArc: boolean;
    }

    const analyzeQ1Approximation = (ellipticalArc: Arc3d, options: EllipticalArcApproximationOptions): Approximation => {
      const context = EllipticalArcApproximationContext.create(ellipticalArc);
      const approx = ellipticalArc.constructCircularArcChainApproximation(options);
      ck.testDefined(approx, "computed an approximation");
      let error = 0;
      const errorSegment: Point3d[] = [];
      let nSamplesQ1 = 0;
      if (context.isValidEllipticalArc) {
        const samples = context.computeSampleFractions(options, true) as QuadrantFractions[];
        ck.testTrue(samples.length > 0 && samples[0].fractions.length > 0, "computed samples");
        const samplesQ1 = new OrderedSet<number>(compareNumbers);
        for (const q of samples) {
          if (q.quadrant === 1) {
            for (const f of q.fractions)
              samplesQ1.add(f);
          }
        }
        nSamplesQ1 = samplesQ1.size; // assume ellipticalArc sweep is Q1
        const perp = context.computeApproximationError(samples);
        if (ck.testDefined(perp, "computed approx error")) {
          error = perp.detailA.a;
          errorSegment.push(perp.detailA.point);
          errorSegment.push(perp.detailB.point);
        }
      } else if (ellipticalArc.isCircular) {
        if (options.forcePath && ellipticalArc.sweep.isFullCircle) {
          if (ck.testType(approx, Path, "nearly circular full elliptical arc approximation with forcePath is a Path"))
            ck.testTrue(approx.children.length === 1 && ellipticalArc === approx.children[0], "nearly circular elliptical arc Path approximation has the input arc as only child");
        } else {
          if (ck.testType(approx, Arc3d, "nearly circular elliptical arc approximation with !forcePath is an Arc3d"))
            ck.testTrue(ellipticalArc === approx, "nearly circular elliptical arc Arc3d approximation is the input arc");
        }
      }
      return { approx, error, errorSegment, nSamplesQ1, isValidArc: context.isValidEllipticalArc };
    };

    const compareToSubdivision = (ellipticalArc: Arc3d, e: number, swapped: boolean, iMethod: number, options: EllipticalArcApproximationOptions, subdivisionResult: Approximation): boolean => {
      const result = analyzeQ1Approximation(ellipticalArc, options);
      ck.testTrue(result.isValidArc, `${iMethodToString(iMethod)} approximation is valid`);
      ck.testExactNumber(subdivisionResult.nSamplesQ1, result.nSamplesQ1, `${iMethodToString(iMethod)} approximation has expected sample count`);
      const subdivisionWins = subdivisionResult.error <= result.error + Geometry.smallMetricDistance;
      if (subdivisionWins) {
        ++nSubdivisionComparisonWins;
      } else { // subdivision has worse error; we expect this to happen some of the time. Report only unexpectedly large error. Observed as much as 68% overshoot.
        const overshootPct = 100 * (subdivisionResult.error - result.error) / result.error;
        ck.testLE(overshootPct, 70, `subdivision came within 70% of beating ${iMethodToString(iMethod)} on ${subdivisionResult.nSamplesQ1} samples of eccentricity ${e} ellipse ${swapped ? "(swapped)" : ""}`);
        if (!swapped) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, ellipticalArc, x, y, -delta);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, result.approx, x, y);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, result.errorSegment, x, y);
        }
      }
      ++nComparisons;
      return subdivisionWins;
    };

    // test default-maxError subdivision against other methods on ellipses of various eccentricities
    const eccentricities: number[] = [];
    if (GeometryCoreTestIO.enableLongTests) {
      eccentricities.push(...[0.000001, 0.00001, 0.0001]); // these are essentially circular thus invalid for approximating (not drawn below)
      eccentricities.push(...[0.001, 0.01, 0.05, 0.1, 0.15, 0.2, 0.25]);
    }
    eccentricities.push(...[0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
    if (GeometryCoreTestIO.enableLongTests) {
      eccentricities.push(...[0.85, 0.9, 0.95, 0.99, 0.999]);
      eccentricities.push(...[0.9999, 0.99999, 0.999999]); // these are essentially flat
    }

    const optionsA = EllipticalArcApproximationOptions.create(EllipticalArcSampleMethod.AdaptiveSubdivision); // default maxError
    const optionsC = EllipticalArcApproximationOptions.create();
    for (const e of eccentricities) {
      const b = a * Math.sqrt((1 - e) * (1 + e));
      let prevError: number | undefined;
      for (const swappedAxes of [false, true]) {
        const arc = Arc3d.createXYEllipse(center, swappedAxes ? b : a, swappedAxes ? a : b, AngleSweep.createStartEndDegrees(0, 90));
        ++nEllipses;

        const resultA = analyzeQ1Approximation(arc, optionsA);
        if (!resultA.isValidArc)
          continue; // elliptical arc is essentially circular; no approximation to compare
        if (!swappedAxes) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x, y, -delta);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, resultA.approx, x, y);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, resultA.errorSegment, x, y);
        }
        ck.testLE(resultA.error, optionsA.maxError, "approx error as per options");
        if (undefined === prevError)
          prevError = resultA.error;
        else
          ck.testSmallRelative(prevError - resultA.error, "swapping axes doesn't affect approx error");
        y += delta;

        // compare to naive method
        let subdivisionLost = false;
        optionsC.numSamplesInQuadrant = resultA.nSamplesQ1;
        optionsC.sampleMethod = EllipticalArcSampleMethod.UniformParameter;
        if (!compareToSubdivision(arc, e, swappedAxes, -1, optionsC, resultA)) {
          subdivisionLost = true;
          y += delta;
        }
        // compare to curvature interpolation methods
        optionsC.sampleMethod = EllipticalArcSampleMethod.NonUniformCurvature;
        for (let iRemap = 0; iRemap < remaps.length; ++iRemap) {
          optionsC.remapFunction = remaps[iRemap];
          if (!compareToSubdivision(arc, e, swappedAxes, iRemap, optionsC, resultA)) {
            subdivisionLost = true;
            y += delta;
          }
        }
        if (subdivisionLost)
          ++nSubdivisionLosses;
        x += delta;
        y = 0;
      }
      x += delta;
    }

    // Observed: subdivision wins 90.9% of comparisons to n-sample methods (95.67% with enableLongTests)
    const winPct = 100 * Geometry.safeDivideFraction(nSubdivisionComparisonWins, nComparisons, 0);
    GeometryCoreTestIO.consoleLog(`Subdivision wins ${nSubdivisionComparisonWins} of ${nComparisons} comparisons (${winPct}%).`);
    const targetWinPct = GeometryCoreTestIO.enableLongTests ? 90 : 85;
    ck.testLE(targetWinPct, winPct, `Subdivision is more accurate than another n-sample method over ${targetWinPct}% of the time.`);

    // Observed: subdivision is most accurate method in 64% of ellipses tested (82.76% with enableLongTests)
    const winOverallPct = 100 * Geometry.safeDivideFraction(nEllipses - nSubdivisionLosses, nEllipses, 0);
    GeometryCoreTestIO.consoleLog(`Subdivision wins overall for ${nEllipses - nSubdivisionLosses} of ${nEllipses} ellipses (${winOverallPct}%).`);
    const targetNSampleWinPct = GeometryCoreTestIO.enableLongTests ? 80: 60;
    ck.testLE(targetNSampleWinPct, winOverallPct, `Subdivision is more accurate than all other n-sample methods over ${targetNSampleWinPct}% of the time.`);

    // test forcePath behavior on closed input
    const fullEllipse = Arc3d.createXYEllipse(center, a, a / 2);
    const fullCircle = Arc3d.createXY(center, a);
    analyzeQ1Approximation(fullEllipse, optionsA);
    analyzeQ1Approximation(fullCircle, optionsA);
    optionsA.forcePath = true;
    analyzeQ1Approximation(fullEllipse, optionsA);
    analyzeQ1Approximation(fullCircle, optionsA);

    // previously, these arcs' approximations exceeded the desired max error
    interface AnomalousArc { arc: Arc3d, maxError: number };
    const anomalousArcs: AnomalousArc[] = [];
    anomalousArcs.push({ arc: Arc3d.create(Point3d.createZero(), Vector3d.create(5, 0), Vector3d.create(0, 8), AngleSweep.createStartEndDegrees(0, -63)), maxError: 0.01 });
    anomalousArcs.push({ arc: Arc3d.createXYEllipse(Point3d.createZero(), 10, 8, AngleSweep.createStartEndDegrees(90, 0)), maxError: 0.001836772806889095 });
    anomalousArcs.push({ arc: Arc3d.create(Point3d.createZero(), Vector3d.create(2, 4, -1), Vector3d.create(3, 2, -3)), maxError: 0.004891996419172132 });
    anomalousArcs.push({ arc: Arc3d.create(Point3d.createZero(), Vector3d.create(2, 4, -1), Vector3d.create(3, 2, -3), AngleSweep.createStartEndDegrees(-15, 345)), maxError: 0.0005076837030701749 });
    const optionsB = EllipticalArcApproximationOptions.create(EllipticalArcSampleMethod.AdaptiveSubdivision);
    for (const anomalousArc of anomalousArcs) {
      optionsB.maxError = anomalousArc.maxError;
      const resultB = analyzeQ1Approximation(anomalousArc.arc, optionsB);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, anomalousArc.arc, x, y);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, resultB.approx, x, y);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, resultB.errorSegment, x, y);
      ck.testDefined(resultB, "anomalous arc approximation is defined");
      ck.testLE(resultB.error, optionsB.maxError, "anomalous arc approx error as per options");
      x += delta;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "ApproximateArc3d", "SubdivisionSampler");
    expect(ck.getNumErrors()).equals(0);
  });
});
