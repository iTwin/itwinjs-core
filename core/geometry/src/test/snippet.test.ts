/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import * as geometry from "../geometry-core";
import { Vector3d } from "../PointVector";
import { YawPitchRollAngles } from "../geometry-core";
import { RotMatrix } from "../geometry-core";

/* tslint:disable:no-console */

// In geometry source tests, convert to string and emit to console.
// In browser or other playpen, implement this function appropriately.
function emit(...data: any[]) {
  const stringData = [];
  // Catch known types for special formatting.  Dispatch others unchanged.
  for (const d of data) {
    const imjs = geometry.IModelJson.Writer.toIModelJson(d);
    if (imjs !== undefined) {
      stringData.push(imjs);
    } else if (d.toJSON) {
      stringData.push(d.toJSON());
    } else {
      stringData.push(d);
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
    emit(mySegment);
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
    const yprMatrix = ypr.toRotMatrix();

    const yawMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), geometry.Angle.createDegrees(yawDegrees))!;
    const pitchMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitY(), geometry.Angle.createDegrees(-pitchDegrees))!;
    const rollMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitX(), geometry.Angle.createDegrees(rollDegrees))!;

    const directMatrix = yawMatrix.multiplyMatrixMatrix(pitchMatrix.multiplyMatrixMatrix(rollMatrix));

    emit (" ypr object (this reports degrees)", ypr);
    emit (" matrix constructed by YawPitchRollAngles object ", yprMatrix);
    emit (" matrix constructed from matrix products ", directMatrix);
    emit (" Largest difference between matrices is " + yprMatrix.maxDiff (directMatrix));
  });

});
