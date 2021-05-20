/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Arc3d } from "../../curve/Arc3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { TaggedNumericData } from "../../polyface/TaggedNumericData";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Box } from "../../solid/Box";
import { Cone } from "../../solid/Cone";
import { LinearSweep } from "../../solid/LinearSweep";
import { RotationalSweep } from "../../solid/RotationalSweep";
import { Sphere } from "../../solid/Sphere";
import { TorusPipe } from "../../solid/TorusPipe";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */
// This file emits (to console.log) text suitable for use as markdown content for examples of constructor call and json of results
// The output is suppressed by emitToLog.

const emitToLog = true;
function emitCategoryHeader(name: string) {
  if (emitToLog) {
    console.log(`## ${name}`);
    console.log("|constructor | remarks | json |");
    console.log("|----|----|---|");
  }
}
// emit a single geometry fragment in bare json form ...
function emitIModelJson(className: string, description: string, g: any) {
  if (emitToLog) {
    const imjs = IModelJson.Writer.toIModelJson(g);
    console.log(`| ${className} | ${description} | ${JSON.stringify(imjs)}|`);
  }
}
// Typical snippets for sandbox windows . . . . These assume that
// the window always has
// 1) the "import * as geometry" directive
// 2) An additional "import" directive to obtain an appropriate implementation of "emit".

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

  it("constructorsAndIModelJson.CurveCollections", () => {
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
    emitIModelJson("ParityRegion.create", "rectangle with semicircular hole", parityRegionWith1Hole);
  });
  it("constructorsAndImodelJson.SolidPrimitives", () => {
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
        "90 degree elbows",
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
      const sweepAngle = Angle.createDegrees(135);
      const capped = true;
      emitIModelJson("RotationalSweep.create(contour, axisOfRotation, sweepAngle, capped)",
        "hexagon rotated",
        RotationalSweep.create(contour, axisOfRotation, sweepAngle, capped)!);
    }

  });
  it("constructorsAndImodelJson.Other", () => {
    emitCategoryHeader("CurveCollections");
    emitIModelJson("CoordinateXYZ.create", "isolated point", CoordinateXYZ.create(Point3d.create(2, 3, 4)));
  });
  it("taggedNumericData.methods", () => {
    const ck = new Checker();
    const objA = new TaggedNumericData(1, 2);
    const objB = new TaggedNumericData(1, 2, [1, 2], [2.3, 1.5]);
    ck.testTrue(objA.isAlmostEqual(objA));
    ck.testTrue(objB.isAlmostEqual(objB));
    ck.testFalse(objA.isAlmostEqual(objB));
    for (const obj of [objA, objB]) {
      const obj1 = obj.clone();
      const obj2 = obj.clone();
      ck.testTrue(obj.isAlmostEqual(obj1));
      // cause various length and content mismatches
      if (obj1.intData) {
        obj1.intData.push(1);
        ck.testFalse(obj1.isAlmostEqual(obj2));
        obj2.intData!.push(7);
        ck.testFalse(obj1.isAlmostEqual(obj2));
        obj1.intData = undefined;
        ck.testFalse(obj1.isAlmostEqual(obj2));
        obj2.intData = undefined;
        ck.testTrue(obj1.isAlmostEqual(obj2));
      }
      if (obj1.doubleData) {
        obj1.doubleData.push(1);
        ck.testFalse(obj1.isAlmostEqual(obj2));
        obj2.doubleData!.push(3);
        ck.testFalse(obj1.isAlmostEqual(obj2));
        obj1.doubleData = undefined;
        ck.testFalse(obj1.isAlmostEqual(obj2));
        obj2.doubleData = undefined;
        ck.testTrue(obj1.isAlmostEqual(obj2));
      }
    }
    expect(ck.getNumErrors()).equals(0);
    });
    it("taggedNumericData.json", () => {
      const ck = new Checker();
      const objA = new TaggedNumericData(1, 2);
      const objB = new TaggedNumericData(1, 2, [1, 2], [2.3, 1.5]);
      for (const obj of [objA, objB]) {
        const json = IModelJson.Writer.toIModelJson(obj);
        if (ck.testDefined(json, "to json")) {
          const obj1 = IModelJson.Reader.parseTaggedNumericProps(json);
          if (ck.testDefined (obj1) && obj1)
            ck.testTrue(obj.isAlmostEqual(obj1), "json round trip");
          }
        }
        expect(ck.getNumErrors()).equals(0);
      });
      it("MeshWithTag", () => {
        const ck = new Checker();
        const allGeometry: GeometryQuery [] = [];
        const tagA = new TaggedNumericData(-1000, 0);
        const surface = TorusPipe.createDgnTorusPipe(Point3d.create(0, 0, 0), Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), 4, 1, Angle.createDegrees(90), true)!;
        const options = StrokeOptions.createForFacets();
        options.angleTol = Angle.createDegrees(90);
        const builder = PolyfaceBuilder.create(options);
        builder.addTorusPipe(surface, 12, 6);
        const mesh = builder.claimPolyface();
        let y0 = 0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, 0, y0, 0);
        y0 += 5.0;
        mesh.data.taggedNumericData = tagA;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, 0, y0, 0);
        GeometryCoreTestIO.saveGeometry(allGeometry, "TaggedNumericData", "TorusPipe");
        expect(ck.getNumErrors()).equals(0);
        });
        it("TagLookup", () => {
          const ck = new Checker();
          const data = new TaggedNumericData(-1000, 0);

          const dataZ = new TaggedNumericData(-1000, 0, [], []);
          ck.testTrue(dataZ.isAlmostEqual(data), "isAlmostEqual with empty arrays?");
          const dataB = data.clone();
          const intTags = [4, 2, 9, -30];
          const doubleTags = [100, 3, 5];
          const intShift = 8;
          const doubleShift = 1.5;
          ck.testExactNumber(105, data.tagToIndexedDouble(29, -10000, -5000, 105), "search empty array");
          ck.testExactNumber(105, data.tagToInt(10, -10000, -5000, 105), "search empty array");
          for (const t of intTags) {
            data.pushIntPair(t, t + intShift);
            ck.testExactNumber(data.tagToInt(t, -100, 1000, 1000), t + intShift, "(int,int)");
            ck.testExactNumber(data.tagToInt(t, 10000, 20000, 1000), 10000, "clamp int at min");
            ck.testExactNumber(data.tagToInt(t, -10000, -5000, 1000), -5000, "clamp int at max");
          }
          for (const t of doubleTags) {
            data.pushIndexedDouble(t, t + doubleShift);
            ck.testExactNumber(data.tagToIndexedDouble(t, -20000, 20000, 1000), t + doubleShift);
            ck.testExactNumber(data.tagToIndexedDouble(t, 10000, 20000, 1000), 10000);
            ck.testExactNumber(data.tagToIndexedDouble(t, -10000, -5000, 1000), -5000);
          }
          ck.testTrue(data.isAlmostEqual(data), "identity");
          ck.testFalse(data.isAlmostEqual(dataB));
          dataB.pushIndexedDouble(100, 0.5);
          ck.testExactNumber(0.5, dataB.getDoubleData(0, 20));
          ck.testExactNumber(20, dataB.getDoubleData(1, 20));
          const dataC = data.clone();
          ck.testTrue(data.isAlmostEqual(dataC));
          ck.testFalse(data.isAlmostEqual((undefined as unknown) as TaggedNumericData));
          const data21 = new TaggedNumericData(2, 1);
          const data12 = new TaggedNumericData(1, 2);
          const data13 = new TaggedNumericData(1, 3);
          ck.testFalse(data12.isAlmostEqual(data13));
          ck.testFalse(data12.isAlmostEqual(data21));
          ck.testExactNumber(new TaggedNumericData().tagA, 0);
          ck.testExactNumber(new TaggedNumericData().tagB, 0);
        });
      });
