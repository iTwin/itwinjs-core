/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineString3d } from "../../curve/LineString3d";
import { SmoothTransformBetweenFrusta } from "../../geometry3d/FrustumAnimation";

import { Angle } from "../../geometry3d/Angle";
import { GeometryQuery } from "../../curve/GeometryQuery";
/* tslint:disable:no-console */
/**
 * create a linestring that walks around all the edges (and some decoration) for a frustum defined by corners.
 * @param corners
 */
function cornersToLineString(corners: Point3d[]): LineString3d {
  return LineString3d.create(
    [corners[0], corners[1], corners[3], corners[2], corners[0],  // back retangle
    corners[4],         // move to front
    corners[5], corners[1], corners[5], // front edge plus move to same back point and double back to front
    corners[7], corners[3], corners[7],
    corners[6], corners[2], corners[6],
    corners[4],
    corners[0],
    corners[4].interpolate(0.5, corners[5]),
    corners[0].interpolate(0.5, corners[1]), // some asymetric decoration on lower face
    corners[0].interpolate(0.5, corners[2])]);
}
/**
 * Within the given coordinate frame (usually rigid) make the 8 corners of a frustum
 * @param frame frame with center on back plane, xy plane is back plane, z is dowards eye
 * @param ax x axis half width
 * @param ay y axis half width
 * @param az z axis distance to front plane
 * @param fz frustum contraction frmo back to front.
 */
function createFrustumPoints(frame: Transform, ax: number, ay: number, az: number, fz: number): Point3d[] {
  return [
    frame.multiplyXYZ(-ax, -ay, 0.0),
    frame.multiplyXYZ(ax, -ay, 0.0),
    frame.multiplyXYZ(-ax, ay, 0.0),
    frame.multiplyXYZ(ax, ay, 0.0),
    frame.multiplyXYZ(-fz * ax, -fz * ay, az),
    frame.multiplyXYZ(fz * ax, -fz * ay, az),
    frame.multiplyXYZ(-fz * ax, fz * ay, az),
    frame.multiplyXYZ(fz * ax, fz * ay, az)];
}

describe("FrustumAnimationTest", () => {
  it("A", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const c20 = Math.cos(Angle.degreesToRadians(20));
    const s20 = Math.sin(Angle.degreesToRadians(20));
    let dy = 0.0;
    for (const frame0 of [
      Transform.createIdentity(),
      Transform.createOriginAndMatrix(Point3d.create(-2, 2, -1),
        YawPitchRollAngles.createDegrees(10, 5, 30).toMatrix3d())]
    ) {
      let dx = 0.0;
      for (const frame1 of [
        Transform.createTranslationXYZ(1, 2, 15),
        // rotate 90 degrees while shifting along the x axis.
        Transform.createRowValues(
          c20, -s20, 0, 40,
          s20, c20, 0, 0,
          0, 0, 1, 0),
        // rotate 90 degrees while shifting along the x axis.
        Transform.createRowValues(
          0, -1, 0, 40,
          1, 0, 0, 0,
          0, 0, 1, 0),
        // rotate 180 degrees z and around center
        Transform.createRowValues(
          -1, 0, 0, 0,
          0, -1, 0, 0,
          0, 0, 1, 0),
        // rotate 180 degrees around z while shifting y
        Transform.createRowValues(
          -1, 0, 0, 0,
          0, -1, 0, 80,
          0, 0, 1, 0),
        // translate the back plane, but repoint the eye vector (SKEW)
        Transform.createRowValues(
          1, 0, 1, 0,
          0, 1, 2, 30,
          0, 0, 3, 0)]) {
        const cornerA = createFrustumPoints(frame0, 4, 3, 2, 1);
        const cornerB = createFrustumPoints(frame1, 2, 4, 3, 0.5);
        GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerA).clone(), dx, dy, 0);
        GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerB).clone(), dx, dy, 0);
        const context = SmoothTransformBetweenFrusta.create(cornerA, cornerB);
        if (ck.testPointer(context) && context) {
          const g = 0.05;
          const dy1 = dy + 100;
          for (const fraction of [0.0, g, 2.0 * g, 0.25, 0.5, 0.75, 1.0 - 2.0 * g, 1.0 - g, 1.0]) {
            const cornerF = context.fractionToWorldCorners(fraction);
            GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerF), dx, dy1, 0);

          }
        }
        dx += 100.0;
      }
      dy += 400.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Geoemtry3d", "FrustumAnimationA");
    expect(ck.getNumErrors()).equals(0);
  });

});
