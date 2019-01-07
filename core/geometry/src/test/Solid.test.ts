/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Sample } from "../serialization/GeometrySamples";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { Checker } from "./Checker";
import { expect } from "chai";
import * as fs from "fs";
import { Cone } from "../solid/Cone";
import { LineSegment3d } from "../curve/LineSegment3d";
import { StrokeOptions } from "../curve/StrokeOptions";

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
  it("Cones", () => {
    const ck = new Checker();
    const cones = Sample.createCones();
    exerciseSolids(ck, cones, "Cones");
    for (const c of cones) {
      const rA = c.getRadiusA();
      const rB = c.getRadiusB();
      const rMax = c.getMaxRadius();
      ck.testLE(rA, rMax);
      ck.testLE(rB, rMax);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("ConeUVToPoint", () => {
    // create true cones to allow simple checks ...
    const ck = new Checker();

    for (const cone of [
      Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 1), 1, 0, false)!,
      Cone.createAxisPoints(Point3d.create(1, 3, 2), Point3d.create(3, 9, 2), 4, 2, false)!]) {
      for (const u of [0.0, 0.25, 1.0]) {
        const plane0 = cone.UVFractionToPointAndTangents(u, 0.0);
        const plane1 = cone.UVFractionToPointAndTangents(u, 1.0);
        const vector01 = Vector3d.createStartEnd(plane0.origin, plane1.origin);
        for (const v of [0.0, 0.40, 0.80]) {
          const pointV = cone.UVFractionToPoint(u, v);
          ck.testPoint3d(pointV, plane0.origin.interpolate(v, plane1.origin));
          const planeV = cone.UVFractionToPointAndTangents(u, v);
          ck.testVector3d(vector01, planeV.vectorV, "V derivative is side stroke");
          ck.testVector3d(planeV.vectorU, plane0.vectorU.interpolate(v, plane1.vectorU), "U derivative interpolates");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("ConeConstructionErrors", () => {
    const ck = new Checker();
    const centerA = Point3d.create(1, 2, 3);
    const centerB = Point3d.create(4, -1, 2);
    const centerC = Point3d.create(0, 3, 5);
    ck.testUndefined(Cone.createAxisPoints(centerA, centerA, 1, 1, false), "no duplicated center for cone");
    ck.testUndefined(Cone.createAxisPoints(centerA, centerB, 1, -3, false), "0 radius point may not be interior");
    ck.testUndefined(Cone.createAxisPoints(centerA, centerB, 0, 0, false), "must have at least one nonzero radius");

    const coneABCapped = Cone.createAxisPoints(centerA, centerB, 1, 1, true)!;
    const coneABCapped22 = Cone.createAxisPoints(centerA, centerB, 2, 2, true)!;
    const coneABOpen = Cone.createAxisPoints(centerA, centerB, 1, 1, false)!;
    const coneACCapped = Cone.createAxisPoints(centerA, centerC, 1, 1, true)!;

    ck.testFalse(coneABCapped.isAlmostEqual(coneABOpen), "capping difference detected");
    ck.testFalse(coneACCapped.isAlmostEqual(coneABCapped), "cones with different axis");
    ck.testFalse(coneABCapped22.isAlmostEqual(coneABCapped), "cones with different radii");
    ck.testFalse(coneABCapped.isAlmostEqual(LineSegment3d.createXYXY(1, 2, 3, 4)), "noncone other");
    // hm .. just make sure these default cases come back.
    ck.testPointer(coneABCapped.strokeConstantVSection(0.2, undefined, undefined));
    ck.testPointer(coneABCapped.strokeConstantVSection(0.2, undefined, StrokeOptions.createForFacets()));
    expect(ck.getNumErrors()).equals(0);
  });

  it("Spheres", () => {
    const ck = new Checker();
    exerciseSolids(ck, Sample.createSpheres(), "Spheres");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Boxes", () => {
    const ck = new Checker();
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
    expect(ck.getNumErrors()).equals(0);
  });
  it("TorusPipes", () => {
    const ck = new Checker();
    exerciseSolids(ck, Sample.createTorusPipes(), "TorusPipes");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LinearSweeps", () => {
    const ck = new Checker();
    exerciseSolids(ck, Sample.createSimpleLinearSweeps(), "LinearSweeps");
    expect(ck.getNumErrors()).equals(0);
  });

  it("RotationalSweeps", () => {
    const ck = new Checker();
    exerciseSolids(ck, Sample.createSimpleRotationalSweeps(), "RotationalSweeps");
    expect(ck.getNumErrors()).equals(0);
  });
  it("RuledSweeps", () => {
    const ck = new Checker();
    exerciseSolids(ck, Sample.createRuledSweeps(), "RuledSweeps");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Ellipsoides", () => {
    const ck = new Checker();
    const ellipsoids = Sample.createEllipsoids();
    exerciseSolids(ck, ellipsoids, "Ellipsoids");
    for (const e of ellipsoids) {
      const radius = e.trueSphereRadius();
      ck.testUndefined(radius, "Ellipsoid is nonsphereical");
      const localToWorld = e.cloneLocalToWorld();
      ck.testPoint3d(localToWorld.getOrigin(), e.cloneCenter());
      expect(ck.getNumErrors()).equals(0);
    }
  });

});
