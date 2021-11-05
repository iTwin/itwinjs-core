/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */

describe("StrokeOptions", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const strokeOptions = new StrokeOptions();
    const maxEdgeLength = 1.3;
    const chordOptions = new StrokeOptions();
    const chordTol = 0.02;
    chordOptions.chordTol = chordTol;
    const startRadians = 0;
    const center = Point3d.create(0, 0, 0);
    for (const arcRadians of [Math.PI * 2, 1.0, 2.5]) {
      for (const radius of [1, 2, 3, 5, 10]) {
        const arc = Arc3d.createXY(center, radius, AngleSweep.createStartSweepRadians(startRadians, arcRadians));
        strokeOptions.maxEdgeLength = maxEdgeLength;
        const numEdge1 = strokeOptions.applyTolerancesToArc(radius, arc.sweep.sweepRadians);
        // counts from arg and options should match ...
        const point0 = arc.fractionToPoint(0.0);
        const point1 = arc.fractionToPoint(1.0 / numEdge1);
        const d = point0.distance(point1);
        ck.testLE(d, maxEdgeLength, "maxEdgelength stroke test");

        const numC = chordOptions.applyChordTol(1, radius, arcRadians);
        const pointC0 = arc.fractionToPoint(0.5);
        const pointC1 = arc.fractionToPoint(0.5 + 1.0 / numC);
        const dC = radius - center.distance(pointC0.interpolate(0.5, pointC1));
        ck.testLE(dC, chordTol, "chordTol stroke test");
      }
    }
    const num2 = StrokeOptions.applyMaxEdgeLength(strokeOptions, 0, 2.0);
    const length = 10.0;
    const num10 = StrokeOptions.applyMaxEdgeLength(strokeOptions, 2, length);
    const num10A = StrokeOptions.applyMaxEdgeLength(strokeOptions, 2, -length);
    const num10B = StrokeOptions.applyMaxEdgeLength(strokeOptions, 10, length);
    ck.testExactNumber(2, num2);
    const edgeLength = length / num10;
    ck.testLE(edgeLength, maxEdgeLength);
    ck.testExactNumber(10, num10B, "maxEdgeLength with min count");
    ck.testExactNumber(num10, num10A, "max edge length with negative length");
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddPolyface");
    expect(ck.getNumErrors()).equals(0);
  });
});
