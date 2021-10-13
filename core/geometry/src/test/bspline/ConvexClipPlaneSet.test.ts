/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BooleanClipFactory } from "../../clipping/BooleanClipFactory";
import { BooleanClipNode } from "../../clipping/BooleanClipNode";
import { Clipper } from "../../clipping/ClipUtils";
import { ConvexClipPlaneSet, ConvexClipPlaneSetProps } from "../../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets, UnionOfConvexClipPlaneSetsProps } from "../../clipping/UnionOfConvexClipPlaneSets";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";

/* eslint-disable no-console */

describe("ConvexClipPlaneSet", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const errorSet1 = ConvexClipPlaneSet.fromJSON(1 as unknown as ConvexClipPlaneSetProps);
    ck.testExactNumber(0, errorSet1.planes.length);
    const ax = -1;
    const ay = -2;
    const bx = 1;
    const by = 4;
    const boxA = ConvexClipPlaneSet.createXYPolyLine([
      Point3d.create(ax, ay, 0),
      Point3d.create(bx, ay, 0),
      Point3d.create(bx, by, 0),
      Point3d.create(ax, by, 0),
      Point3d.create(ax, ay, 0)],
      [true, true, true, true, true], true);
    const boxA1 = boxA.clone();
    ck.testFalse(errorSet1.isAlmostEqual(boxA));
    ConvexClipPlaneSet.createEmpty(boxA1);
    ck.testExactNumber(0, boxA1.planes.length);
    const boxB = ConvexClipPlaneSet.createXYBox(ax, ay, bx, by);
    const boxC = boxB.clone();
    const segmentM = LineSegment3d.createXYXY(
      Geometry.interpolate(ax, 0.3, bx), ay,
      bx, Geometry.interpolate(ay, 0.9, by), 0);

    for (const transform of [
      Transform.createTranslationXYZ(10, 0, 0),
      Transform.createFixedPointAndMatrix(
        Point3d.create(ax, ay, 0),
        Matrix3d.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(90))!),
      Transform.createFixedPointAndMatrix(
        Point3d.create(3, 2, 5),
        Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 9), Angle.createDegrees(23))!)]) {

      const segmentN = segmentM.cloneTransformed(transform);
      const boxD = boxA.clone();
      boxD.transformInPlace(transform);

      for (const f of [-2, -0.2, 0.001, 0.3, 0.998, 1.0002, 3]) {
        const pointM = segmentM.fractionToPoint(f);
        const inOut = boxA.isPointInside(pointM);
        ck.testBoolean(boxA.isPointInside(pointM), boxB.isPointInside(pointM), "point inside", f, pointM);
        ck.testBoolean(boxA.isPointInside(pointM), boxC.isPointInside(pointM), "point inside clone", f, pointM);
        ck.testBoolean(boxA.isPointInside(pointM), Geometry.isIn01(f), "point inside versus segment fraction, ", pointM);

        const pointN = segmentN.fractionToPoint(f);
        ck.testBoolean(inOut, boxD.isPointInside(pointN), "inOut for transformed", f, pointN);
      }
    }
    ck.checkpoint("ConvexClipPlaneSet.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
  it("UnionOfConvexSets", () => {
    const ck = new Checker();
    const setA = UnionOfConvexClipPlaneSets.fromJSON(1 as unknown as UnionOfConvexClipPlaneSetsProps);
    const setB = UnionOfConvexClipPlaneSets.createEmpty(setA);
    const box01 = ConvexClipPlaneSet.createRange3dPlanes(Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1));
    const box12 = ConvexClipPlaneSet.createRange3dPlanes(Range3d.createXYZXYZ(1, 0, 0, 2, 1, 1));
    const box23 = ConvexClipPlaneSet.createRange3dPlanes(Range3d.createXYZXYZ(2, 0, 0, 3, 1, 1));
    const setC = UnionOfConvexClipPlaneSets.createConvexSets([box01, box12]);
    const setD = UnionOfConvexClipPlaneSets.createConvexSets([box01, box12, box23]);
    const setCReversed = UnionOfConvexClipPlaneSets.createConvexSets([box12, box01]);
    ck.testTrue(setC.isAlmostEqual(setC), "almostEqual to self");
    ck.testFalse(setC.isAlmostEqual(setD), "almostEqual different count");
    ck.testFalse(setC.isAlmostEqual(setCReversed), "almostEqual different order");
    ck.testDefined(setB);
    const points: Point3d[] = [];
    const range = Range3d.createNull();
    setC.computePlanePlanePlaneIntersectionsInAllConvexSets(points, range, undefined, false);
    ck.testExactNumber(16, points.length, "intersection points in 2 boxes");
    setC.setInvisible(true);
    expect(ck.getNumErrors()).equals(0);
  });
  // allow XOR etc as property names
  /* eslint-disable @typescript-eslint/naming-convention */
  it("parser", () => {
    const ck = new Checker();
    const boxA = ConvexClipPlaneSet.createXYBox(1, 2, 3, 5);
    const boxB = ConvexClipPlaneSet.createXYBox(0, 0, 1, 10);
    const boxAB = UnionOfConvexClipPlaneSets.createConvexSets([boxA, boxB]);
    const outBoxB = BooleanClipFactory.createCaptureClipOutside(boxB) as BooleanClipNode;
    // const outsideAB = BooleanClipFactory.createCaptureClipOutside(boxAB);
    const jsonA = BooleanClipFactory.anyClipperToJSON(boxA);
    const jsonB = BooleanClipFactory.anyClipperToJSON(boxB);
    const jsonAB = BooleanClipFactory.anyClipperToJSON(boxAB);
    const jsonOutB = BooleanClipFactory.anyClipperToJSON(outBoxB);
    const boxA1 = BooleanClipFactory.parseToClipper(jsonA);
    const boxB1 = BooleanClipFactory.parseToClipper(jsonB);
    const boxAB1 = BooleanClipFactory.parseToClipper(jsonAB);
    ck.testDefined(boxA1);
    ck.testDefined(boxB1);
    ck.testDefined(boxAB1);
    ck.testDefined(BooleanClipFactory.parseToClipperArray(jsonAB));
    ck.testDefined(BooleanClipFactory.parseToClipperArray(jsonB));
    ck.testUndefined(BooleanClipFactory.parseToClipper(undefined));
    ck.testUndefined(BooleanClipFactory.parseToClipper([]));
    ck.testUndefined(BooleanClipFactory.parseToClipper([1]));
    ck.testUndefined(BooleanClipFactory.parseToClipper([jsonA, jsonOutB]));
    ck.testDefined(BooleanClipFactory.parseToClipper(jsonOutB));
    ck.testDefined(BooleanClipFactory.parseToClipperArray(jsonOutB));

    ck.testUndefined(BooleanClipFactory.parseToClipperArray([]));
    ck.testUndefined(BooleanClipFactory.parseToClipperArray(1));
    ck.testUndefined(BooleanClipFactory.parseToClipperArray([1]));

    ck.testUndefined(BooleanClipFactory.parseToClipper({ XOR: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ NXOR: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ AND: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ NAND: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ OR: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ NOR: [1] }));
    ck.testUndefined(BooleanClipFactory.anyClipperToJSON(jsonA as Clipper));

    expect(ck.getNumErrors()).equals(0);
  });
});
