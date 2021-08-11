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
import { Vector3d } from "../../geometry3d/Point3dVector3d";

/* eslint-disable no-console */

describe("InterpolationCurve3d", () => {
  it.only("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const circlePoints = Sample.createUnitCircle(8);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, circlePoints, 0, 0, 0);
    const fitParams = [0, 0.03, 0.1, 0.17, 0.3, 0.44, 0.72, 1.0];
    const startTan = Vector3d.create(1,1,0);
    const endTan = Vector3d.create(1,-1,0);
    for (const curve of [
      InterpolationCurve3d.create({ fitPoints: circlePoints, isColinearTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, isColinearTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, isColinearTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, isColinearTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, endTangent: endTan, isChordLenTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, startTangent: startTan, endTangent: endTan, isChordLenTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, closed: true, isChordLenKnots: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, closed: true, isChordLenKnots: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, isColinearTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, isColinearTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, isColinearTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, isColinearTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 0, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 0, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, endTangent: endTan, isColinearTangents: 1, isChordLenTangents: 1, isNaturalTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, endTangent: endTan, isChordLenTangents: 0 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, startTangent: startTan, endTangent: endTan, isChordLenTangents: 1 }),
      InterpolationCurve3d.create({ fitPoints: circlePoints, knots: fitParams, closed: true}),
      ]) {
      if (ck.testType(curve, InterpolationCurve3d)) {
        if (ck.testType(curve.options, InterpolationCurve3dOptions)) {
          for (const fitPt of curve.options.fitPoints) {
            const detail = curve.closestPoint(fitPt, false);
            if (ck.testPointer(detail)) {
              ck.testPoint3d(fitPt, detail.point, "fit point interpolated");
            }
          }
        }
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve, 0, 0, 0);
        testGeometryQueryRoundTrip(ck, curve);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "InterpolationCurve3d", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
