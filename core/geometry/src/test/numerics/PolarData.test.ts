/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Angle } from "../../geometry3d/Angle";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { ConstraintState, PolarData } from "../../numerics/PolarData";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";

/* eslint-disable no-console */

function verifyCompletePolarSinglePoint(ck: Checker, partialData: PolarData, data: PolarData | PolarData[] | undefined, expectGeometry: boolean) {
  if (data === undefined) {
    ck.testPointer(data, "Polar data should not be undefined.");
  } else if (Array.isArray(data)) {
    for (const d of data)
      verifyCompletePolarSinglePoint(ck, partialData, d, expectGeometry);
  } else if (partialData.numberOfConstrainedScalars === 2 && expectGeometry) {
    if (ck.testTrue(data.state === ConstraintState.singlePoint)
      && ck.testTrue(data.x !== undefined, "x defined", prettyPrint(data))
      && ck.testTrue(data.y !== undefined, "y defined", prettyPrint(data))
      && ck.testTrue(data.r !== undefined, "r defined", prettyPrint(data))
      && ck.testTrue(data.theta !== undefined, "theta defined", prettyPrint(data))) {
      ck.testCoordinate(data.x!, data.r! * data.theta!.cos(), "x = r cos(theta)");
      ck.testCoordinate(data.y!, data.r! * data.theta!.sin(), "y = r sin (theta)");
    } else {
      // don't check ill-defined data
    }
  }
}

function verifyPolarConversion(ck: Checker, allGeometry: GeometryQuery[], partialData: PolarData, x: number, y: number, z: number, expectGeometry: boolean = true) {
  const result = PolarData.solveFromScalars(partialData);
  const n0 = ck.getNumErrors();
  verifyCompletePolarSinglePoint(ck, partialData, result, expectGeometry);
  const a = 1.1;
  const ez = -0.001;
  const markerRadius = 0.02;
  GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.createRectangleXY(Point3d.create(-a, -a, ez), 2 * a, 2 * a), x, y, z);
  GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYZXYZ(-a, 0, ez, a, 0, ez), x, y, z);
  GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYZXYZ(0, -a, ez, 0, a, ez), x, y, z);
  if (partialData.x !== undefined)
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYZXYZ(partialData.x, -a, ez, partialData.x, a, ez), x, y, z);
  if (partialData.y !== undefined)
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYZXYZ(-a, partialData.y, ez, a, partialData.y, ez), x, y, z);
  if (partialData.r !== undefined)
    GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(Point3d.create(0, 0, ez), partialData.r), x, y, z);
  if (partialData.theta !== undefined)
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYZXYZ(0, 0, ez, a * partialData.theta.cos(), a * partialData.theta.sin(), ez), x, y, z);
  for (const r of result) {
    if (r.state = ConstraintState.singlePoint)
      GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(Point3d.create(r.x, r.y, 0), markerRadius), x, y, z);
  }
  const n1 = ck.getNumErrors();
  if (n1 !== n0)
    console.log("   *** While processing partialData ", prettyPrint(partialData));
}

describe("PolarData", () => {
  it("SinglePoint", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0.55;
    const y0 = 0.77;
    const polarXY = PolarData.createMixedScalars(ConstraintState.unknown, x0, y0, undefined, undefined);
    const polarXYArray = PolarData.solveFromScalars(polarXY);
    verifyCompletePolarSinglePoint(ck, polarXY, polarXYArray, true);
    if (polarXYArray.length === 1) {
      const q = polarXYArray[0];
      let dy = 0.0;
      // Having confirmed on x,y,r,theta combination, we can proceed with all subsets ...
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, q.x, q.y, undefined, undefined), 0, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, q.x, undefined, q.r, undefined), 0, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, q.x, undefined, undefined, q.theta), 0, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, q.y, q.r, undefined), 0, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, q.y, undefined, q.theta), 0, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, undefined, q.r, q.theta), 0, dy += 3, 0);
      // ill-constrained cases . . .
      const dx = 5.0;
      dy = 0.0;
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, q.x, undefined, undefined, undefined), dx, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, q.y, undefined, undefined), dx, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, undefined, q.r, undefined), dx, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, undefined, undefined, q.theta), dx, dy += 3, 0);
      // divide by zero cases ...
      dy = 0.0;
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, q.x, undefined, undefined, Angle.createDegrees(90.0)), dx, dy += 3, 0);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, q.y, undefined, Angle.createDegrees(0.0)), dx, dy += 3, 0);

      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, q.x, undefined, q.x! * 0.5, undefined), dx, dy += 3, 0, false);
      verifyPolarConversion(ck, allGeometry, PolarData.createMixedScalars(ConstraintState.unknown, undefined, q.y, q.y! * 0.5, undefined), dx, dy += 3, 0, false);

      const nullCase = PolarData.solveFromScalars(PolarData.createMixedScalars(ConstraintState.unknown, undefined, undefined, undefined, undefined));
      ck.testExactNumber(0, nullCase.length, "PartialData with 4 undefined returns empty array");

    }

    ck.testLE(0.00001, PolarData.defaultRadius, "PolarData static defined");
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolarData", "ConstraintSolver");
    expect(ck.getNumErrors()).equals(0);
  });

});
