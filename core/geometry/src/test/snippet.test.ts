/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as geometry from "../geometry-core";
import { Vector3d, Point3d } from "../geometry3d/Point3dVector3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Ray3d } from "../geometry3d/Ray3d";
import { YawPitchRollAngles } from "../geometry-core";
import { Matrix3d } from "../geometry-core";
// import { LineSegment3d } from "../curve/LineSegment3d";
// import { GeometryQuery } from "../curve/CurvePrimitive";
// import { LineString3d } from "../curve/LineString3d";
// import { Arc3d } from "../curve/Arc3d";
// import { BSplineCurve3d } from "../bspline/BSplineCurve";
// import { AngleSweep } from "../Geometry";
// import { Loop, Path, ParityRegion } from "../curve/CurveChain";

/* tslint:disable:no-console */

// In geometry source tests, convert to string and emit to console.
// In browser or other playpen, implement this function appropriately.
function emit(...data: any[]) {
  const stringData = [];
  // Catch known types for special formatting.  Dispatch others unchanged.
  for (const d of data) {
    if (d === undefined) {
      stringData.push("undefined");
    } else {
      const imjs = geometry.IModelJson.Writer.toIModelJson(d);
      if (imjs !== undefined) {
        stringData.push(JSON.stringify(imjs));
      } else if (d.toJSON) {
        stringData.push(d.toJSON());
      } else {
        stringData.push(d);
      }
    }
  }
  console.log(stringData);
}
// Typical snippets for sandbox windows . . . . These assume that
// the window alwyas has
// 1) the "import * as geometry" directive
// 2) An additional "import" directive to obtain an appropriate implemetation of "emit".

describe("Snippets", () => {
  it("Point3d", () => {
    const myPoint = geometry.Point3d.create(1, 2, 3);
    const myVector = geometry.Vector3d.create(3, 1, 0);
    emit(" Here is a point ", myPoint);
    emit(" Here is a vector ", myVector);
    emit(" Here is the point reached by moving 3 times the vector ", myPoint.plusScaled(myVector, 3));
  });

  it("LineSegment3d", () => {
    const mySegment = geometry.LineSegment3d.createXYXY(1, 2, 5, 1);
    emit("Here is a LineSegment3d ", mySegment);
    emit("Its quarter point is ", mySegment.fractionToPoint(0.25));
    emit("Its midpoint is ", mySegment.fractionToPoint(0.5));
    emit("Its threequarter point is ", mySegment.fractionToPoint(0.75));
  });

  it("Arc3d", () => {
    const myArc = geometry.Arc3d.createXY(geometry.Point3d.create(1, 2, 5), 1);
    emit("Here is an Arc3d ", myArc);
    emit("QuarterPoint of myArc is ", myArc.fractionToPoint(0.25));
  });

  it("LineString3d", () => {
    const myLineString = geometry.LineString3d.createPoints([
      geometry.Point3d.create(1, 0, 0),
      geometry.Point3d.create(2, 1, 0),
      geometry.Point3d.create(1, 3, 0),
      geometry.Point3d.create(1, 4, 0),
    ]);
    emit("Here is a LineString3d ", myLineString);
    emit("The length of myLineString is ", myLineString.curveLength());
  });

  it("Angle", () => {
    // The create methods for a strongly typed Angle make it clear whether the caller is providing
    // radians or degrees:
    const angleA = geometry.Angle.createDegrees(10);
    const angleB = geometry.Angle.createRadians(0.3);
    // subsequent accesseses specify degrees or radians :
    emit("AngleA in degree is " + angleA.degrees + "    and in radians is " + angleA.radians);
    emit("AngleB in degree is " + angleB.degrees + "    and in radians is " + angleB.radians);
  });

  it("YawPitchRollAngles", () => {
    emit("This is how YawPitchRollAngles are defined:");
    emit("  X axis is FORWARD.");
    emit("  Z axis is UP.");
    emit("  Given those X and Z axes, the right hand rule says that Y must be to the left.");
    emit(" Rotations around each single axis are then named as in a plane or ship by");
    emit("  positive ROLL is the head tipping to the right, Y rotates towards Z, i.e. positive rotation around X");
    emit(" positive YAW is rotation turns the head to the left, i.e. X towards Y, i.e. positive rotation of Z");
    emit("  PITCH is a rotation that tips the nose up, i.e. X rotates towards Z, i.e. _negative_ rotation around Y");
    const yawDegrees = 15.0;
    const pitchDegrees = 5.0;
    const rollDegrees = 10.0;
    // build rotation matrices via the YawPitchRollAngles class and then via direct multiplication of matrices with the fussy sign and direction rules
    const ypr = YawPitchRollAngles.createDegrees(yawDegrees, pitchDegrees, rollDegrees);
    const yprMatrix = ypr.toMatrix3d();

    const yawMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), geometry.Angle.createDegrees(yawDegrees))!;
    const pitchMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitY(), geometry.Angle.createDegrees(-pitchDegrees))!;
    const rollMatrix = Matrix3d.createRotationAroundVector(Vector3d.unitX(), geometry.Angle.createDegrees(rollDegrees))!;

    const directMatrix = yawMatrix.multiplyMatrixMatrix(pitchMatrix.multiplyMatrixMatrix(rollMatrix));

    emit(" ypr object (this reports degrees)", ypr);
    emit(" matrix constructed by YawPitchRollAngles object ", yprMatrix);
    emit(" matrix constructed from matrix products ", directMatrix);
    emit(" Largest difference between matrices is " + yprMatrix.maxDiff(directMatrix));
  });

  it("Ray3d", () => {
    emit(" A Ray3d is an (infinite) line in space, defined by origin and direction vector");
    emit("    Any point on the ray can be its origin.");
    emit("    Any vector in the ray dreiction can be its direction vector.");
    emit("    The direction vector is NOT assumed normalized.");
    const myRay = Ray3d.create(Point3d.create(2, 1, 0), Vector3d.create(3, 2, 5));
    emit(" Each point on the ray is reachable by mutliplying the direction vector by a number");
    emit("   Fraction 0 is at the origin.", myRay.fractionToPoint(0));
    emit("   Fraction 1 is at the end of the direction vector placed at the origin.", myRay.fractionToPoint(1.0));
    emit("   This point is beyond the end", myRay.fractionToPoint(1.25));
    emit("  This point is before the origin", myRay.fractionToPoint(-0.5));
    const pointA = Point3d.create(5, 2, -3);
    emit("  Here's some point in space, probably not on the ray:", pointA);
    const fractionA = myRay.pointToFraction(pointA);
    emit("  The closest point on the ray is at fractional position", fractionA);
    const pointB = myRay.fractionToPoint(fractionA);
    emit(" The ray point at fractionA is ", fractionA);
    const vectorBtoA = Vector3d.createStartEnd(pointB, pointA);
    emit(" Since it is the closest ray point to pointA, ray.direction and vectorBtoA are perpendicular",
      vectorBtoA.angleTo(myRay.direction).degrees);
    emit(" and the distance from pointA to the ray is ", pointA.distance(pointB));
  });

  it("Plane3dByOriginAndUnitNormal", () => {
    emit(" A Plane3dByOriginAndUnitNormal is an (infinite) plane, defined by an origin and a unit normal vector.");
    emit("    Any point on the plane can be its origin.");
    emit("    The normal vector is forced to be length 1 (normalized, unit vector) when the plane is created.");
    emit("    Having a unit normal means that the dot product of the unit normal with the vector from origin to any space point");
    emit("        is a true (and signed) physical distance (i.e. altitude) from the plane to the space point.");
    const myPlane = Plane3dByOriginAndUnitNormal.create(Point3d.create(2, 1, 0), Vector3d.create(3, 2, 5))!;
    emit("  myPlane is ", myPlane);
    const pointA = Point3d.create(5, 2, -3);
    emit(" Here's a point in space", pointA);
    const altitudeA = myPlane.altitude(pointA);
    emit(" The distance from the plane to pointA is ", altitudeA);
    const pointB = myPlane.projectPointToPlane(pointA);
    emit("  And that altitude matches the distance to the closest point of the plane", Math.abs(altitudeA), pointA.distance(pointB));
  });

  it("Intersecting a plane and ray", () => {
    const myRay = Ray3d.create(Point3d.create(5, 2, 1), Vector3d.create(-2, 4, -1));
    const myPlane = Plane3dByOriginAndUnitNormal.create(Point3d.create(4, 5, -4), Vector3d.create(4, 0, 1))!;
    const intersectionPoint = Point3d.create();
    const fractionOnRayForIntersection = myRay.intersectionWithPlane(myPlane, intersectionPoint);
    if (fractionOnRayForIntersection === undefined) {
      emit(" oops -- myRay is parallel to myPlane");
    } else {
      emit("  The intersection of ", myRay, " with ", myPlane, " is point ", intersectionPoint, " which is at fraction ",
        fractionOnRayForIntersection, "along the ray");
      emit("The altitude of the intersection point from the plane is 0: ", myPlane.altitude(intersectionPoint));
      emit("  And the intersection point matches the ray at that fraction ",
        myRay.fractionToPoint(fractionOnRayForIntersection));
    }

    const inPlaneVector = myRay.direction.crossProduct(myPlane.getNormalRef());
    emit(" This vector ", inPlaneVector, "is parallel to the plane");
    const parallelRay = Ray3d.create(myRay.origin, inPlaneVector);
    const fractionOnParallelRay = parallelRay.intersectionWithPlane(myPlane);
    emit("   so the fractionOnParallelRay is undefined", fractionOnParallelRay);
  });

});
