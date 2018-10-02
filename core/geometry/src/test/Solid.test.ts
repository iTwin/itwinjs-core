/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Sample } from "../serialization/GeometrySamples";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Point3d } from "../geometry3d/PointVector";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Transform";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { Checker } from "./Checker";
import { expect } from "chai";
import * as fs from "fs";

let outputFolderPath = "./src/test/output";
// Output folder typically not tracked by git... make directory if not there
if (!fs.existsSync(outputFolderPath))
  fs.mkdirSync(outputFolderPath);
outputFolderPath = outputFolderPath + "/";

function verifyUnitPerpendicularFrame(ck: Checker, frame: Transform, source: any) {
  ck.testTrue(frame.matrix.isRigid(), "perpendicular frame", source);
}
function exerciseSolids(ck: Checker, solids: GeometryQuery[], _name: string) {
  const scaleTransform = Transform.createFixedPointAndMatrix(Point3d.create(1, 2, 2), Matrix3d.createUniformScale(2));
  for (const s of solids) {
    if (s instanceof SolidPrimitive) {
      const s1 = s.clone();
      if (ck.testPointer(s1, "solid clone") && s1) {
        ck.testTrue(s1.isSameGeometryClass(s), "Clone class match");
        ck.testTrue(s1.isAlmostEqual(s), "solid clone matches original");
        const s2 = s.cloneTransformed(scaleTransform);
        if (ck.testPointer(s2) && s2 && s1.tryTransformInPlace(scaleTransform)) {
          ck.testFalse(s2.isAlmostEqual(s), "scaled is different from original");
          ck.testTrue(s1.isAlmostEqual(s2), "clone transform commute");
        }
      }
      const frame = s.getConstructiveFrame();
      if (ck.testPointer(frame, "getConstructiveFrame") && frame) {
        verifyUnitPerpendicularFrame(ck, frame, s);
      }
    }
  }
}
describe("Solids", () => {
  const ck = new Checker();
  it("Cones", () => {
    const cones = Sample.createCones();
    exerciseSolids(ck, cones, "Cones");
    for (const c of cones) {
      const rA = c.getRadiusA();
      const rB = c.getRadiusB();
      const rMax = c.getMaxRadius();
      ck.testLE(rA, rMax);
      ck.testLE(rB, rMax);
    }
  });
  it("Spheres", () => {
    exerciseSolids(ck, Sample.createSpheres(), "Spheres");
  });
  it("Boxes", () => {
    const boxes = Sample.createBoxes();
    exerciseSolids(ck, boxes, "Boxes");
    for (const b of boxes) {
      const vectorX = b.getVectorX();
      const vectorY = b.getVectorY();
      const vectorZ = b.getVectorZ();
      // well defined box will have independent vectors .
      const matrix = Matrix3d.createColumns(vectorX, vectorY, vectorZ);
      ck.testTrue(matrix.inverse() !== undefined, "Expect smaple box to have good coordinate frame.");

    }
  });
  it("TorusPipes", () => {
    exerciseSolids(ck, Sample.createTorusPipes(), "TorusPipes");
  });
  it("LinearSweeps", () => {
    exerciseSolids(ck, Sample.createSimpleLinearSweeps(), "LinearSweeps");
  });

  it("RotationalSweeps", () => {
    exerciseSolids(ck, Sample.createSimpleRotationalSweeps(), "RotationalSweeps");
  });
  it("RuledSweeps", () => {
    exerciseSolids(ck, Sample.createRuledSweeps(), "RuledSweeps");
  });

  it("Ellipsoides", () => {
    const ellipsoids = Sample.createEllipsoids();
    exerciseSolids(ck, ellipsoids, "Ellipsoids");
    for (const e of ellipsoids) {
      const radius = e.trueSphereRadius();
      ck.testUndefined(radius, "Ellipsoid is nonsphereical");
      const localToWorld = e.cloneLocalToWorld();
      ck.testPoint3d(localToWorld.getOrigin(), e.cloneCenter());
    }
  });

  ck.checkpoint("Solids");
  expect(ck.getNumErrors()).equals(0);
});
