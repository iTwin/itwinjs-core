/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { expect } from "chai";
import { LineString3d } from "../../curve/LineString3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { CurveFactory } from "../../curve/CurveFactory";
/* tslint:disable:no-console */

describe("CurveFactory", () => {
  it("CreateFilletsOnLineString", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();

    const points0 = [
      Point3d.create(1, 1),
      Point3d.create(5, 1),
      Point3d.create(3, 7),
    ];

    const points1 = [
      Point3d.create(1, 1),
      Point3d.create(5, 1),
      Point3d.create(8, 3),
      Point3d.create(13, 5),
      Point3d.create(12, 8),
      Point3d.create(5, 8)];

    const points2 = [
      Point3d.create(1, 1),
      Point3d.create(5, 1),
      Point3d.create(14, 3),
      Point3d.create(14, 11),
      Point3d.create(5, 11),
      Point3d.create(-1, 1),
      Point3d.create(-1, 8),
      Point3d.create(4, 12),
      Point3d.create(8, 14)];
    let x0 = 0.0;
    const xStep = 30;
    const yStep = 20;
    for (const points of [points0, points1, points2]) {
      for (const allowBackup of [true, false]) {
        let y0 = 0.0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(points), x0, y0);
        for (const radius of [0.5, 1.0, 2.0, 4.0, 6.0]) {
          y0 += yStep;
          const path = CurveFactory.createFilletsInLineString(points, radius, allowBackup);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
        }
        x0 += xStep;
      }
      x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "FilletsOnLineString");

    expect(ck.getNumErrors()).equals(0);
  });

});
