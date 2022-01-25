/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveFactory } from "../../curve/CurveFactory";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { TorusPipe } from "../../solid/TorusPipe";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("PipePath", () => {
  it("TorusPipeAlongArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const minorRadius = 0.5;
    let y0 = 0;
    for (const startDegrees of [0, 45, -135]) {
      let x0 = 0;

      for (const sweepDegrees of [45, 190, -105]) {
        const arc = Arc3d.create(Point3d.create(1, 0, 0), Vector3d.create(0, 2, 0), Vector3d.create(-2, 0, 0), AngleSweep.createStartSweepDegrees(startDegrees, sweepDegrees));
        const pipe = TorusPipe.createAlongArc(arc, minorRadius, false);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, pipe, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y0);
        x0 += 10.0;
      }
      y0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PipePath", "TorusPipeAlongArc");
    expect(ck.getNumErrors()).equals(0);
  });

  it("KeyPointPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pipeRadius = 0.25;
    const x0 = 0;
    let y0 = 0;
    const dy = 20.0;
    const keyPoints = [[0, 0, 0], [5, 0, 0], [5, 5, 0], [10, 5, 4], [10, 0, 4], [14, -2, 0]];
    const bendRadii = [0, 1, 2, 0.5, 1];
    const ls = LineString3d.create(keyPoints);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, x0, y0);
    y0 += dy;
    const path = CurveFactory.createFilletsInLineString(ls, bendRadii)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
    y0 += dy;
    const pipe = CurveFactory.createPipeSegments(path, pipeRadius);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pipe, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PipePath", "KeyPointPath");
    expect(ck.getNumErrors()).equals(0);
  });
});
