/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "./Checker";
import { expect } from "chai";
import { BilinearPatch } from "../geometry3d/BilinearPatch";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Angle } from "../geometry3d/Angle";
import { Vector3d, Point3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Geometry } from "../Geometry";

function verifyPatch(ck: Checker, patch: BilinearPatch) {
  const transform = Transform.createOriginAndMatrix(Point3d.create(10, 20, 10), Matrix3d.createRotationAroundVector(Vector3d.create(1, 4, 2), Angle.createDegrees(20)));
  const patch1 = patch.cloneTransformed(transform)!;
  const range = Range3d.createNull();
  patch.extendRange(range);
  const range1 = Range3d.createNull();
  patch1.extendRange(range1);
  const range1A = Range3d.create();
  patch.extendRange(range1A, transform);
  ck.testRange3d(range1, range1A);
  ck.testTrue(patch.isAlmostEqual(patch), "compare to self");
  ck.testFalse(patch.isAlmostEqual(patch1), "compare to transformed");
  ck.testTrue(patch1.isAlmostEqual(patch1), "compare to self");

  for (const uv of [Point2d.create(0.0, 0.0), Point2d.create(1, 0), Point2d.create(0, 1), Point2d.create(1, 1), Point2d.create(0.3, 0.5)]) {
    const xyz = patch.uvFractionToPoint(uv.x, uv.y);
    const plane = patch.uvFractionToPointAndTangents(uv.x, uv.y);
    ck.testPoint3d(xyz, plane.origin);
    const xyz1 = patch1.uvFractionToPoint(uv.x, uv.y);
    const plane1 = patch1.uvFractionToPointAndTangents(uv.x, uv.y);
    ck.testPoint3d(xyz1, plane1.origin);
    ck.testPoint3d(xyz1, transform.multiplyPoint3d(xyz), "rigid transform commutes with evaluation");
    ck.testVector3d(plane1.vectorU, transform.multiplyVector(plane.vectorU), "rigid transform commutes with evaluation");
    ck.testVector3d(plane1.vectorV, transform.multiplyVector(plane.vectorV), "rigid transform commutes with evaluation");
  }

  const plane00 = patch1.uvFractionToPointAndTangents(0, 0);
  const plane11 = patch1.uvFractionToPointAndTangents(1, 1);
  ck.testCoordinate(patch1.maxUEdgeLength(), Geometry.maxXY(plane00.vectorU.magnitude(), plane11.vectorU.magnitude()));
  ck.testCoordinate(patch1.maxVEdgeLength(), Geometry.maxXY(plane00.vectorV.magnitude(), plane11.vectorV.magnitude()));
}

describe("BilinearPatch", () => {
  it("Create", () => {
    const ck = new Checker();
    verifyPatch(ck, BilinearPatch.createXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0));
    verifyPatch(ck, BilinearPatch.createXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1));
    verifyPatch(ck, BilinearPatch.createXYZ(1, 2, 3, 5, 2, -1, 6, 7, 10, -4, 2, 1));
    ck.checkpoint("BilinearPatch.Create");
    expect(ck.getNumErrors()).equals(0);
  });

});
