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

/* eslint-disable no-console */

describe("InterpolationCurve3d", () => {
  it.only("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const circleRadius = 1.0;
    const circlePoints = Sample.createUnitCircle(8);
    const arcPoints = Sample.createArcStrokes(3, Point3d.create(0, 0, 0), 1.0,
      Angle.createDegrees(-20.0), Angle.createDegrees(200.0), false); // This comes back with 9 points.  Cut it to 8 so same fit params can be used.
    arcPoints.length = 8;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circlePoints, 0, 0, 0);
    const fitParams = [0, 0.03, 0.1, 0.17, 0.3, 0.44, 0.72, 1.0];
    const startTan = Vector3d.create(1,1,0);
    const endTan = Vector3d.create(1, -1, 0);
    let x0 = 0;
    const delta = 3.0 * circleRadius;
    const y0 = 0;
    let  count = 0;
    for (const curve of [
      InterpolationCurve3d.create({ fitPoints: arcPoints, isColinearTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, isColinearTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, isColinearTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, isColinearTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, endTangent: endTan, isChordLenTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, startTangent: startTan, endTangent: endTan, isChordLenTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, closed: true, isChordLenKnots: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, closed: true, isChordLenKnots: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, isColinearTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, isColinearTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, isColinearTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, isColinearTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, endTangent: endTan, isChordLenTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: arcPoints, knots: fitParams, startTangent: startTan, endTangent: endTan, isChordLenTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, closed: true}),
    ]) {
      console.log(`InterpolationCurve index ${count}`);
      count++;
      // if not closed, get rid of the final point so display of start and end tangent is clear ...
      if (ck.testType(curve, InterpolationCurve3d, `Expect interpolation curve from ctor of curve ${  count}`)) {
        if (ck.testType(curve.options, InterpolationCurve3dOptions)) {
          for (const fitPoint of curve.options.fitPoints) {
            const detail = curve.closestPoint(fitPoint, false);
            if (ck.testPointer(detail)) {
              if (!ck.testPoint3d(fitPoint, detail.point, "fit point interpolated"))
                GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, fitPoint, 0.04, x0, y0);
            }
          }
        }
        x0 += delta;
        const point0 = curve.options.fitPoints[0];
        const point1 = curve.options.fitPoints[curve.options.fitPoints.length - 1];
        const tangentScale = 0.25;    // tangents were defined with length less than 2?
        const y1 = y0 + delta;
        if (curve.options.startTangent){
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point0, point0.plusScaled(curve.options.startTangent, tangentScale)], x0, y0, 0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point0, point0.plusScaled(curve.options.startTangent, tangentScale)], x0, y1, 0);
        }
        if (curve.options.endTangent){
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point1, point1.plusScaled(curve.options.endTangent, -tangentScale)], x0, y0, 0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [point1, point1.plusScaled(curve.options.endTangent, -tangentScale)], x0, y1, 0);
        }
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve, x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve.proxyCurve, x0, y1, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve.options.fitPoints, x0, y1, 0);
        testGeometryQueryRoundTrip(ck, curve);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "InterpolationCurve3d", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
