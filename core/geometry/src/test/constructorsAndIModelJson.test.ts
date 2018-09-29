/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as geometry from "../geometry-core";
import { Point3d, Vector3d } from "../PointVector";
import { LineSegment3d } from "../curve/LineSegment3d";
import { GeometryQuery, CoordinateXYZ } from "../curve/CurvePrimitive";
import { LineString3d } from "../curve/LineString3d";
import { Arc3d } from "../curve/Arc3d";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { AngleSweep, Angle } from "../Geometry";
import { Loop, Path, ParityRegion } from "../curve/CurveChain";
import { Sphere } from "../solid/Sphere";
import { Cone } from "../solid/Cone";
import { Box } from "../solid/Box";
import { Transform, Matrix3d } from "../Transform";
import { TorusPipe } from "../solid/TorusPipe";
import { LinearSweep } from "../solid/LinearSweep";
import { RotationalSweep } from "../solid/RotationalSweep";
import { Ray3d } from "../AnalyticGeometry";

/* tslint:disable:no-console */

function emitCategoryHeader(name: string) {
  console.log("## " + name);
  console.log("|constructor | remarks | json |");
  console.log("|----|----|---|");
}
// emit a single geometry fragment in bare json form ...
function emitIModelJson(classname: string, description: string, g: GeometryQuery) {
  const imjs = geometry.IModelJson.Writer.toIModelJson(g);
  console.log("| " + classname + " | " + description + " | `", JSON.stringify(imjs) + "`|");
}
// Typical snippets for sandbox windows . . . . These assume that
// the window alwyas has
// 1) the "import * as geometry" directive
// 2) An additional "import" directive to obtain an appropriate implemetation of "emit".

describe("constructorsAndImodelJson", () => {

  it("CurvePrimitives", () => {
    emitCategoryHeader("CurvePrimitive");
    const pointA = Point3d.create(0, 0, 0);
    const pointB = Point3d.create(4, 0, 0);
    const vectorAB = pointA.vectorTo(pointB);
    const pointC = Point3d.create(4, 4, 0);
    const pointD = Point3d.create(0, 4, 0);
    const vectorAD = pointA.vectorTo(pointD);

    // A line segment on the x axis
    emitIModelJson("LineSegment3d.create", "Simple line segment", LineSegment3d.create(pointA, pointB));

    // A linestring along the x axis, up and back above the origin
    emitIModelJson("LineString3d.create", "linestring by points", LineString3d.create(pointA, pointB, pointC, pointD));
    // circular arc with 3-point construction
    emitIModelJson("Arc3d.createCircularStartMiddleEnd", "arc passing through 3 points", Arc3d.createCircularStartMiddleEnd(pointA, pointB, pointC)!);

    emitIModelJson("Arc3d.create", "circular arc", Arc3d.create(pointA, vectorAB, vectorAD, AngleSweep.createStartEndDegrees(-45, 90))!);
    // elliptic arc -- larger vector90 . . .
    emitIModelJson("Arc3d.create", "elliptic arc", Arc3d.create(pointA, vectorAB, vectorAD.scale(2.0), AngleSweep.createStartEndDegrees(-45, 190))!);

    emitIModelJson("BSplineCurve3d.create", "curve by poles", BSplineCurve3d.create(
      [pointA, pointB, pointC, pointD],
      [0, 0, 0, 1, 1, 1], 4)!);

  });

  it("constructorsAndImodleJson.CurveCollections", () => {
    emitCategoryHeader("CurveCollections");
    const pointA = Point3d.create(0, 0, 0);
    const pointB = Point3d.create(4, 0, 0);
    const vectorAB = pointA.vectorTo(pointB);
    const pointC = Point3d.create(4, 4, 0);
    const pointD = Point3d.create(0, 4, 0);
    const vectorAD = pointA.vectorTo(pointD);

    const upperSemiCircle = Arc3d.create(pointA, vectorAB, vectorAD, AngleSweep.createStartEndDegrees(0, 180));
    emitIModelJson("Path.create", "path with line, arc, line",
      Path.create(
        LineSegment3d.create(pointC, upperSemiCircle.fractionToPoint(0)),
        upperSemiCircle, LineSegment3d.create(upperSemiCircle.fractionToPoint(1), pointA)));

    const closureSegment = LineSegment3d.create(upperSemiCircle.fractionToPoint(1), upperSemiCircle.fractionToPoint(0));
    const semiCircleRegion = Loop.create(upperSemiCircle, closureSegment);
    emitIModelJson("Loop.create", "loop with semicircle and diameter segment", semiCircleRegion);

    const a = -4.5;
    const b = 9;
    const outerRectangle = Loop.create(LineString3d.createRectangleXY(Point3d.create(a, a, 0), b, b));
    const parityRegionWith1Hole = ParityRegion.create(outerRectangle, semiCircleRegion);
    emitIModelJson("ParityRegion.create", "rectangle with semicirular hole", parityRegionWith1Hole);
  });
  it("constructorsAndImodleJson.SolidPrimitives", () => {
    emitCategoryHeader("SolidPrimitives");
    // REMARK:  These braces are to wall off the local variables of each create step
    {
      const center = Point3d.create(1, 1, 0);
      const radius = 3;
      emitIModelJson("Sphere.createCenterRadius(center, radius)", "full sphere", Sphere.createCenterRadius(center, radius));
    }
    {
      const centerA = Point3d.create(-1, 1, 0);
      const centerB = Point3d.create(3, 2, 0);
      const radiusA = 1.5;
      const radiusB = 2.0;
      const capped = true;
      emitIModelJson("Cone.createAxisPoints(centerA, centerB, radiusA, radiusB, capped)", "full sphere", Cone.createAxisPoints(centerA, centerB, radiusA, radiusB, capped)!);
    }

    {
      const cornerA = Point3d.create(-1, 1, 0);
      const cornerB = Point3d.create(-1, 2, 4);
      const ax = 4.0;
      const ay = 3.0;
      const bx = 4.0;
      const by = 2.0;
      emitIModelJson("Box.createDgnBox(cornerA, xVector, yVector, baseX, baseY, topX, topY, capped)",
        "box with sides slanting inward",
        Box.createDgnBox(cornerA, Vector3d.unitX(), Vector3d.unitY(),
          cornerB, ax, ay, bx, by, true) as Box);
    }
    {
      const frame = Transform.createOriginAndMatrix(Point3d.create(1, 1, 1), Matrix3d.createRigidViewAxesZTowardsEye(2, 0, 3));
      const majorRadius = 3.0;
      const minorRadius = 1.0;
      const sweep = Angle.createDegrees(90);
      const capped = true;
      emitIModelJson("TorusPipe.createInFrame(frame, majorRadius, minorRadius, sweep, capped)",
        "90 degree elbos",
        TorusPipe.createInFrame(frame, majorRadius, minorRadius, sweep, capped)!);
    }
    {
      const contour = Loop.create(LineString3d.createRegularPolygonXY(Point3d.create(1, 1, 0), 6, 1.0, true));
      const sweepVector = Vector3d.create(0, 0, 4);
      const capped = true;
      emitIModelJson("LinearSweep.create(contour, sweepVector, capped)",
        "swept hexagon",
        LinearSweep.create(contour, sweepVector, capped)!);
    }
    {
      const contour = Loop.create(LineString3d.createRegularPolygonXY(Point3d.create(1, 1, 0), 6, 1.0, true));
      const axisOfRotation = Ray3d.create(Point3d.create(-1, 0, 0), Vector3d.create(0, 1, 0));
      const sweepAngle = Angle.createDegrees (135);
      const capped = true;
      emitIModelJson("RotationalSweep.create(contour, axisOfRotation, sweepAngle, capped)",
        "hexagon rotated",
        RotationalSweep.create(contour, axisOfRotation, sweepAngle, capped)!);
    }

  });
  it("constructorsAndImodleJson.Other", () => {
    emitCategoryHeader("CurveCollections");
    emitIModelJson("CoordinateXYZ.create", "isolated point", CoordinateXYZ.create(Point3d.create(2, 3, 4)));
  });
});
