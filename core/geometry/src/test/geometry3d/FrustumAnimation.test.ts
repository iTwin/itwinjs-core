/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineString3d } from "../../curve/LineString3d";
import { SmoothTransformBetweenFrusta } from "../../geometry3d/FrustumAnimation";

import { Angle } from "../../geometry3d/Angle";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Ray3d } from "../../geometry3d/Ray3d";
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
    corners[0].interpolate(4.0, corners[4]),   // Show z direction
    corners[0],
    corners[0].interpolate(1.2, corners[1]), // some asymetric decoration on xy face
    corners[0].interpolate(0.5, corners[1]), // some asymetric decoration on xy face
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

describe("FrustumAnimation", () => {
  it("General", () => {
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

    GeometryCoreTestIO.saveGeometry(allGeometry, "Geoemtry3d", "FrustumAnimation.General");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PureRotation", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const axisA = Vector3d.create(1, -2, 5);
    const axisB = Vector3d.create(1, 10, 1);
    const primaryOrigin = Point3d.create(15, 3, 4);
    const axisLineScale = 10.0;
    let dy = 0.0;
    let dx = 0.0;
    for (const frame0 of [
      Transform.createIdentity(),
      Transform.createOriginAndMatrix(Point3d.create(-2, 2, -1),
        YawPitchRollAngles.createDegrees(10, 5, 30).toMatrix3d()),
      Transform.createOriginAndMatrix(Point3d.create(5, 2, 0),
        YawPitchRollAngles.createDegrees(2, 5, 5).toMatrix3d())]
    ) {
      dy = 0.0;
      for (const degrees of [10, 50, 80, 110]) {
        for (const axis of [Vector3d.unitZ(), axisA, axisB]) {
          const ray = Ray3d.create(primaryOrigin, axis);
          const e = 25.0;
          const rotation = Transform.createFixedPointAndMatrix(primaryOrigin, Matrix3d.createRotationAroundVector(axis, Angle.createDegrees(degrees))!);
          for (const frustumScale of [1, 3, 8]) {   // large scale should get rotation axis inside frustum !!!
            const cornerA = createFrustumPoints(frame0, frustumScale * 4, frustumScale * 3, frustumScale * 2, 1);
            const cornerB = rotation.multiplyPoint3dArray(cornerA);
            GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(primaryOrigin, primaryOrigin.plusScaled(axis, axisLineScale)), dx, dy, 0);
            GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerA).clone(), dx, dy, 0);
            GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerB).clone(), dx, dy, 0);
            // we expect that rotationalContext is the true rotation
            const rotationalContext = SmoothTransformBetweenFrusta.create(cornerA, cornerB, true)!;
            // this context slides the midpoint on a line (instead of on the simple rotation path)
            const contextB = SmoothTransformBetweenFrusta.create(cornerA, cornerB, false)!;
            if (ck.testPointer(rotationalContext) && rotationalContext) {
              const originA = rotationalContext.localToWorldA.getOrigin();
              const originB = rotationalContext.localToWorldB.getOrigin();
              const projectionA = ray.projectPointToRay(originA);
              const projectionB = ray.projectPointToRay(originB);
              ck.testPoint3d(originA, projectionA, "animation start is on true axis");
              ck.testPoint3d(originB, projectionB, "animation end is on true axis");
              const dy1 = dy + 500;
              GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(primaryOrigin, primaryOrigin.plusScaled(axis, axisLineScale)), dx, dy1, 0);
              for (const fraction of [0.0, 0.25, 0.50, 0.75, 1.0]) {
                const cornerFA = rotationalContext.fractionToWorldCorners(fraction);
                GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerFA), dx, dy1, 0);
                const cornerFB = contextB.fractionToWorldCorners(fraction);
                GeometryCoreTestIO.captureGeometry(allGeometry, cornersToLineString(cornerFB), dx + e * axis.x, dy1 + axis.y, e * axis.z);
              }
            }
            dy += 1000.0;
          }
        }
      }
      dx += 2000.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Geoemtry3d", "FrustumAnimation.PureRotation");
    expect(ck.getNumErrors()).equals(0);
  });
});
