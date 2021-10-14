/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PointString3d } from "../../curve/PointString3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Point3dArray } from "../../geometry3d/PointHelpers";
import { Range3d } from "../../geometry3d/Range";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";

function exercisePointString3d(ck: Checker, lsA: PointString3d) {
  const numPoints = lsA.numPoints();
  const planeA = Plane3dByOriginAndUnitNormal.createXYPlane();
  const inXYPlane = lsA.isInPlane(planeA);
  const transform = Sample.createMessyRigidTransform();
  const lsB = lsA.clone();
  lsB.reverseInPlace();
  const lsC = lsA.clone()!;
  ck.testTrue(lsC.tryTransformInPlace(transform));
  const planeC = planeA.cloneTransformed(transform)!;
  ck.testBoolean(inXYPlane, lsC.isInPlane(planeC), "in plane preserved by transform");
  const rangeC = Range3d.create();
  lsC.extendRange(rangeC);

  ck.testUndefined(lsA.pointAt(-1), "verify out of range pointstring index");
  const pointC = Point3d.create();
  for (let i = 0; i < numPoints; i++) {
    const pointA = lsA.pointAt(i)!;
    lsC.pointAt(i, pointC)!;
    transform.multiplyPoint3d(pointA, pointA);
    ck.testPoint3d(pointA, pointC, "transform commutes");
    ck.testTrue(rangeC.containsPoint(pointC), "confirm range");

    const closestPoint = lsC.closestPoint(pointC);
    ck.testExactNumber(i, closestPoint.index);
  }
  const lsD = lsA.cloneTransformed(transform);
  ck.testTrue(lsC.isAlmostEqual(lsD));
  lsD.popPoint();
  if (lsA.numPoints() > 1) {
    ck.testFalse(lsC.isAlmostEqual(lsD), "!isAlmostEqual after pop");
    ck.testFalse(lsA.isAlmostEqual(lsB), " reversed is not equal");
  }
  lsD.clear();
  ck.testExactNumber(0, lsD.numPoints(), "empty after clear");

  const jsonA = lsA.toJSON();
  const lsE = PointString3d.fromJSON(jsonA);
  ck.testTrue(lsA.isAlmostEqual(lsE), "JSON round trip");
  ck.testFalse(lsA.isAlmostEqual(jsonA), "isAlmostEqual with bad arg");
}

describe("PointString3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const ls0 = PointString3d.create();
    exercisePointString3d(ck, ls0);
    ls0.addPoint(Point3d.create(4, 3, 2));
    exercisePointString3d(ck, ls0);
    // create directly from point array
    const lsA = PointString3d.createPoints([
      Point3d.create(1, 0, 0),
      Point3d.create(4, 2, 0),
      Point3d.create(4, 5, 0),
      Point3d.create(1, 5, 0)]);
    exercisePointString3d(ck, lsA);
    // create with varargs point array.
    const lsB = PointString3d.create(Point3d.create(1, 0, 0),
      Point3d.create(4, 2, 0),
      Point3d.create(4, 5, 0),
      Point3d.create(1, 5, 0));
    ck.testTrue(lsA.isAlmostEqual(lsB), "create variant");
    const xyz = Point3dArray.packToFloat64Array(lsA.points);
    const lsC = PointString3d.createFloat64Array(xyz);
    ck.testTrue(lsA.isAlmostEqual(lsC), "createFloat64Array");
    ck.checkpoint("PointString3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
