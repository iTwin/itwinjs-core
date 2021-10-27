/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Angle } from "../../geometry3d/Angle";
import { BarycentricTriangle } from "../../geometry3d/BarycentricTriangle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";

/* eslint-disable no-console */
// cspell:word subtriangle
function verifyTriangle(ck: Checker, triangle: BarycentricTriangle) {
  const centroid = triangle.centroid();
  const centroid1 = triangle.fractionToPoint(1 / 3, 1 / 3, 1 / 3);
  ck.testPoint3d(centroid, centroid1, "Variant centroid evaluations");
  ck.testPoint3d(triangle.points[0], triangle.fractionToPoint(1, 0, 0));
  ck.testPoint3d(triangle.points[1], triangle.fractionToPoint(0, 1, 0));
  ck.testPoint3d(triangle.points[2], triangle.fractionToPoint(0, 0, 1));
  const subTriangle0 = BarycentricTriangle.create(centroid, triangle.points[1], triangle.points[2]);
  const subTriangle1 = BarycentricTriangle.create(centroid, triangle.points[2], triangle.points[0]);
  const subTriangle2 = BarycentricTriangle.create(centroid, triangle.points[0], triangle.points[1]);
  ck.testTrue(subTriangle0.aspectRatio < triangle.aspectRatio, "subtriangle aspect ratio smaller than full");
  ck.testCoordinate(triangle.area, subTriangle0.area + subTriangle1.area + subTriangle2.area, "subtriangle areas add to total");

  const cloneA = triangle.clone();
  const cloneB = BarycentricTriangle.create(triangle.points[0], triangle.points[1], triangle.points[2]);
  const cloneC = cloneB.clone();
  const transform = Transform.createFixedPointAndMatrix(Point3d.create(-1, 0.4, 0.2), Matrix3d.createRotationAroundVector(Vector3d.create(0.2, 3.1, -0.3), Angle.createDegrees(22))!);
  transform.multiplyPoint3dArray(cloneB.points, cloneB.points);

  cloneC.setFrom(cloneB);
  ck.testTrue(cloneC.isAlmostEqual(cloneB));

  ck.testTrue(cloneA.isAlmostEqual(triangle), "clone equal");
  ck.testFalse(cloneB.isAlmostEqual(triangle), "clone equal");
  BarycentricTriangle.create(cloneA.points[0], cloneA.points[1], cloneA.points[2], cloneB);
  ck.testTrue(cloneB.isAlmostEqual(triangle), "set equal");

  const a = 2.0;
  const x0 = 1.0;
  const y0 = 1;
  const z = 2.0;
  const cloneC1 = BarycentricTriangle.createXYZXYZXYZ(
    x0, y0, z,
    x0 + 2 * a, y0, z,
    x0 + a, y0 + a, z, cloneC);
  ck.testCoordinate(a * a, cloneC1.area);
  ck.testTrue(cloneC === cloneC1, "create into result");
  // clone with reversed
  const cloneC1Reverse = BarycentricTriangle.create(cloneC1.points[0], cloneC1.points[2], cloneC1.points[1]);
  const dotSelf = cloneC1Reverse.dotProductOfCrossProductsFromOrigin(cloneC1Reverse);
  const dotReverse = cloneC1.dotProductOfCrossProductsFromOrigin(cloneC1Reverse);
  ck.testCoordinate(dotSelf, -dotReverse, "reversed triangle dots.");

}

describe("BarycentricTriangle", () => {
  it("Create", () => {
    const ck = new Checker();
    verifyTriangle(ck, BarycentricTriangle.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0));
    verifyTriangle(ck, BarycentricTriangle.createXYZXYZXYZ(1, 4, 2, 7, -2, 1.5, 2.2, 9.0, 10));
    ck.checkpoint("BarycentricTriangle.Create");
    expect(ck.getNumErrors()).equals(0);
  });

});
