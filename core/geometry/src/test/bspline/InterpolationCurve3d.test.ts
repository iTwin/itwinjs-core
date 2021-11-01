/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "../Checker";
import { Sample } from "../../serialization/GeometrySamples";
import { InterpolationCurve3d, InterpolationCurve3dOptions } from "../../bspline/InterpolationCurve3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { testGeometryQueryRoundTrip } from "../serialization/FlatBuffer.test";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Angle } from "../../geometry3d/Angle";
import { LineString3d } from "../../curve/LineString3d";

/* eslint-disable no-console */

describe("InterpolationCurve3d", () => {
  it("HelloWorld", () => {
    const noisy = false;
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const circleRadius = 1.0;
    const circlePoints = Sample.createUnitCircle(8);
    for (const pt of circlePoints) { pt.y *= 1.4; } // perturb
    const arcPoints = Sample.createArcStrokes(3, Point3d.create(0, 0, 0), 1.0, Angle.createDegrees(-20.0), Angle.createDegrees(200.0), false);
    for (const pt of arcPoints) { pt.y *= 1.5; }  // perturb
    const startTan = Vector3d.create(1, 1, 0);
    const endTan = Vector3d.create(1, -1, 0);
    let x0 = 0;
    const delta = 3.0 * circleRadius;
    const y0 = 0;
    let count = 0;
    for (const options of [ // we don't test input fitParams since they are not preserved in roundtrip: DGN ignores them!
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, isColinearTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, isColinearTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, isColinearTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, isColinearTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, endTangent: endTan, isChordLenTangents: 0 }),
      InterpolationCurve3dOptions.create({ fitPoints: arcPoints, startTangent: startTan, endTangent: endTan, isChordLenTangents: 1 }),
      InterpolationCurve3dOptions.create({ fitPoints: circlePoints, closed: true, isChordLenKnots: 0 }),  // the only interpolant with uniform knots
      InterpolationCurve3dOptions.create({ fitPoints: circlePoints, closed: true, isChordLenKnots: 1 }),
    ]) {
      if (noisy)
        console.log(`InterpolationCurve index ${count}`);
      count++;
      x0 += delta;
      testInterpolationCurveConstruction (ck, allGeometry, options, x0, y0, delta);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "InterpolationCurve3d", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ExercisePointSpacing", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0.0;
    const deltaX = 5.0;
    const deltaY = 5.0;
    const point0 = Point3d.create(0, 0);
    const point1 = Point3d.create(0, 2);
    const point2 = Point3d.create(1, 3);
    const point3 = Point3d.create(2, 0);
    for (const isChordLenKnots of [0,1]){
      // counts are EDGE counts
      for (const count0 of [1, 3]) {
        x0 = 0.0;
        for (const count1 of [1, 5]) {
          for (const count2 of [1, 2]) {
            const points: Point3d[] = [];
            pushInterpolatedInteriorPoints(points, point0, point1, 0, count0, count0);
            pushInterpolatedInteriorPoints(points, point1, point2, 1, count1, count1);
            pushInterpolatedInteriorPoints(points, point2, point3, 1, count2, count2);
            const options = InterpolationCurve3dOptions.create({fitPoints: points, isChordLenKnots});
            x0 += deltaX;
            testInterpolationCurveConstruction (ck, allGeometry, options, x0, y0, deltaY);
          }
          x0 += 2.0 * deltaX;
        }
      y0 += 4.0 * deltaY;
      }
      y0 += 10.0 * deltaY;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "InterpolationCurve3d", "ExercisePointSpacing");
    expect(ck.getNumErrors()).equals(0);
  });

});

function testInterpolationCurveConstruction(ck: Checker, allGeometry: GeometryQuery[], options: InterpolationCurve3dOptions, x0: number, y0: number, delta: number) {
  const curve = InterpolationCurve3d.create(options);
  if (ck.testType(curve, InterpolationCurve3d, `Expect interpolation curve for options ${options}`)) {
    if (ck.testType(curve.options, InterpolationCurve3dOptions)) {
      for (const fitPoint of curve.options.fitPoints) {
        const detail = curve.closestPoint(fitPoint, false);
        if (ck.testPointer(detail)) {
          if (!ck.testPoint3d(fitPoint, detail.point, "fit point interpolated"))
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, fitPoint, 0.04, x0, y0);
        }
      }
    }
    const point0 = curve.options.fitPoints[0];
    const point1 = curve.options.fitPoints[curve.options.fitPoints.length - 1];
    const tangentScale = 0.25;
    const y1 = y0 + delta;
    const y2 = y1 + delta;
    if (curve.options.startTangent && !curve.options.startTangent.isAlmostZero) {
      ck.testVector3d(curve.options.startTangent.normalize()!, curve.fractionToPointAndUnitTangent(0.0).direction, "start tangent interpolated");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point0, point0.plusScaled(curve.options.startTangent, tangentScale)], x0, y0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point0, point0.plusScaled(curve.options.startTangent, tangentScale)], x0, y1, 0);
    }
    if (curve.options.endTangent && !curve.options.endTangent.isAlmostZero) { // points into curve
      ck.testVector3d(curve.options.endTangent.normalize()!, curve.fractionToPointAndUnitTangent(1.0).direction.negate(), "end tangent interpolated");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point1, point1.plusScaled(curve.options.endTangent, tangentScale)], x0, y0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point1, point1.plusScaled(curve.options.endTangent, tangentScale)], x0, y1, 0);
    }
    const ls = LineString3d.create();
    curve.proxyCurve.emitStrokes(ls);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, x0, y2, 0);                      // top row is stroked proxy curve
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve.proxyCurve, x0, y1, 0);        // middle row is MSBsplineCurve proxy
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve.options.fitPoints, x0, y1, 0); // ... and fit points
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve, x0, y0, 0);                   // bottom row is MSInterpolationCurve
    testGeometryQueryRoundTrip(ck, curve);
  }
}

/** push points interpolated at fractions (index0/count)<= i <= (index1/count)
 * Note that the range is INCLUSIVE
*/
function pushInterpolatedInteriorPoints(points: Point3d[], point0: Point3d, point1: Point3d,
  index0: number, index1: number, count: number) {
  for (let i = index0; i <= index1; i++){
    points.push(point0.interpolate(i / count, point1));
  }
}
