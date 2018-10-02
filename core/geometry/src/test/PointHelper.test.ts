/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Geometry, AxisScaleSelect } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point2d, Point3d, Vector3d } from "../geometry3d/PointVector";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Transform";
import { LineString3d } from "../curve/LineString3d";
import { Arc3d } from "../curve/Arc3d";
import { StrokeOptions } from "../curve/StrokeOptions";
import { PolygonOps, Point3dArray, Point2dArray, Vector3dArray, Point4dArray, NumberArray } from "../geometry3d/PointHelpers";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { MatrixTests } from "./Point3dVector3d.test";
import { Checker } from "./Checker";
import { expect } from "chai";
import { Sample } from "../serialization/GeometrySamples";
import { MomentData } from "../geometry4d/MomentData";
import { GrowableXYZArray } from "../geometry3d/GrowableArray";
/* tslint:disable:no-console */

describe("FrameBuilder.HelloWorld", () => {
  it("FrameBuilder.HellowWorld", () => {
    const ck = new Checker();
    const builder = new FrameBuilder();
    ck.testFalse(builder.hasOrigin, "frameBuilder.hasOrigin at start");

    for (const points of [
      [Point3d.create(0, 0, 0),
      Point3d.create(1, 0, 0),
      Point3d.create(0, 1, 0)],
      [Point3d.create(0, 0, 0),
      Point3d.create(1, 0, 0),
      Point3d.create(1, 1, 0)],
      [Point3d.create(1, 2, -1),
      Point3d.create(1, 3, 5),
      Point3d.create(-2, 1, 7)],
    ]) {
      builder.clear();
      const point0 = points[0];
      const point1 = points[1];
      const point2 = points[2];
      ck.testUndefined(builder.getValidatedFrame(), "frame in progress");
      const count0 = builder.announcePoint(point0);
      const count1 = builder.announcePoint(point0); // exercise the quick out.
      ck.testExactNumber(count0, count1, "repeat point ignored");
      ck.testTrue(builder.hasOrigin, "frameBuilder.hasOrigin with point");
      ck.testUndefined(builder.getValidatedFrame(), "no frame for minimal data");
      ck.testUndefined(builder.getValidatedFrame(), "frame in progress");

      builder.announcePoint(point1);
      ck.testUndefined(builder.getValidatedFrame(), "frame in progress");
      ck.testCoordinate(1, builder.savedVectorCount(), "expect 1 good vector");
      ck.testUndefined(builder.getValidatedFrame(), "frame in progress");

      builder.announcePoint(point2);
      ck.testUndefined(builder.getValidatedFrame(true), "frame in progress");
      const rFrame = builder.getValidatedFrame(false);
      if (ck.testPointer(rFrame, "expect righ handed frame") && rFrame
        && ck.testBoolean(true, rFrame.matrix.isRigid(), "good frame")) {
        const inverse = rFrame.inverse();
        if (ck.testPointer(inverse, "invertible frame") && inverse) {
          const product = rFrame.multiplyTransformTransform(inverse);
          ck.testBoolean(true, product.isIdentity, "correct inverse");
          const q0 = inverse.multiplyPoint3d(point0);
          const q1 = inverse.multiplyPoint3d(point1);
          const q2 = inverse.multiplyPoint3d(point2);
          ck.testCoordinate(0.0, q0.x, "point0 is origin");
          ck.testCoordinate(0.0, q0.y, "point0 is origin");
          ck.testCoordinate(0.0, q0.z, "point0 is origin");
          ck.testCoordinate(0.0, q1.y, "point1 on x axis");
          ck.testCoordinate(0.0, q1.z, "point1 on x axis");
          ck.testCoordinate(0.0, q2.z, "point2 on xy plane");
          ck.testCoordinateOrder(0.0, q2.y, "point1 in positive y plane");
        }
      }
    }
    ck.checkpoint("FrameBuilder");
    expect(ck.getNumErrors()).equals(0);
  });

  it("FrameBuilder.HelloVectors", () => {
    const ck = new Checker();
    const builder = new FrameBuilder();
    ck.testFalse(builder.hasOrigin, "frameBuilder.hasOrigin at start");
    builder.announcePoint(Point3d.create(0, 1, 1));
    ck.testExactNumber(0, builder.savedVectorCount());
    ck.testExactNumber(0, builder.savedVectorCount());
    builder.announceVector(Vector3d.create(0, 0, 0));
    ck.testExactNumber(0, builder.savedVectorCount());

    // loop body assumes each set of points has 3 leading independent vectors
    for (const vectors of [
      [Vector3d.create(1, 0, 0),
      Vector3d.create(0, 1, 0),
      Vector3d.create(0, 0, 1)],
    ]) {
      builder.clear();
      const vector0 = vectors[0];
      const vector1 = vectors[1];
      const vector2 = vectors[2];
      builder.announce(Point3d.create(1, 2, 3));
      ck.testUndefined(builder.getValidatedFrame(), "frame in progress");
      builder.announce(vector0);
      ck.testExactNumber(1, builder.savedVectorCount());
      builder.announce(vector0);
      ck.testExactNumber(1, builder.savedVectorCount());

      ck.testExactNumber(2, builder.announceVector(vector1));
      ck.testExactNumber(2, builder.announceVector(vector1.plusScaled(vector0, 2.0)));

      ck.testExactNumber(3, builder.announceVector(vector2));

    }
    ck.checkpoint("FrameBuilder");
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("FrameBuilder.HelloWorldB", () => {
  it("FrameBuilder.HellowWorld", () => {
    const ck = new Checker();

    const nullRangeLocalToWorld = FrameBuilder.createLocalToWorldTransformInRange(Range3d.createNull(), AxisScaleSelect.Unit, 0, 0, 0, 2.0);
    ck.testTransform(Transform.createIdentity(), nullRangeLocalToWorld, "frame in null range");

    for (const range of [Range3d.createXYZXYZ(1, 2, 3, 5, 7, 9)]
    ) {
      for (const select of [
        AxisScaleSelect.Unit,
        AxisScaleSelect.LongestRangeDirection,
        AxisScaleSelect.NonUniformRangeContainment]) {
        const localToWorld = FrameBuilder.createLocalToWorldTransformInRange(range, select, 0, 0, 0, 2.0);
        if (ck.testPointer(localToWorld) && localToWorld) {
          MatrixTests.CheckProperties(ck,
            localToWorld.matrix,
            select === AxisScaleSelect.Unit,  // unit axes in range are identity
            select === AxisScaleSelect.Unit,  // and of course unitPerpendicular
            select === AxisScaleSelect.Unit,  // and of course rigid.
            true, // always invertible
            true);  // always diagonal
          const worldCorners = range.corners();
          worldCorners.push(range.fractionToPoint(0.5, 0.5, 0.5));
        }
      }
    }

    ck.checkpoint("FrameBuilder.HelloWorldB");
    expect(ck.getNumErrors()).equals(0);
  });
});
// ASSUME pointsA is planar with at least 3 points, and first turn is left.
// (Therefore first cross product is its normal)
function testCentroidNormal(ck: Checker, pointsA: Point3d[], expectedArea: number) {
  // console.log ("\n\n testCentroidNormal", pointsA);
  const normalA = pointsA[0].crossProductToPoints(pointsA[1], pointsA[2]);
  for (const transform of Sample.createRigidTransforms()) {
    const normalB = transform.multiplyVector(normalA);
    const pointsB = transform.multiplyPoint3dArray(pointsA);
    const pointsQ = GrowableXYZArray.create(pointsB);
    // console.log (" transform", transform);
    // console.log (" pointsB", pointsB);
    ck.testCoordinate(normalA.magnitude(), normalB.magnitude(), "rigid transform");
    const normalC = PolygonOps.areaNormal(pointsB);
    const areaC = PolygonOps.area(pointsB);
    ck.testCoordinate(areaC, normalC.magnitude(), "area normal magnitude matches area");
    const normalQ = PolygonOps.areaNormalGo(pointsQ)!;
    PolygonOps.areaNormalGo(pointsQ, normalQ);
    ck.testVector3d(normalC, normalQ);
    const ray = PolygonOps.centroidAreaNormal(pointsB);
    if (ck.testParallel(normalB, normalC, "polygon normal", transform)
      && ck.testCoordinate(expectedArea, normalC.magnitude())
      && ck.testPointer(ray, "area computed") && ray && ray.a)
      ck.testCoordinate(expectedArea, ray.a);
  }
}
describe("PointHelper.centroid", () => {
  it("PointHelper.centroid", () => {
    const ck = new Checker();
    for (const pointsA of Sample.createSimpleXYPointLoops()) {
      const areaXY = PolygonOps.areaXY(pointsA);
      testCentroidNormal(ck, pointsA, areaXY);
    }

    ck.checkpoint("PointHelper.centroid");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("MomentData.HelloWorld", () => {
  it("PointHelper.annotateClusters", () => {
    const ck = new Checker();
    // Checker.noisy.momentData = true;

    // Test undefined/empty returns
    const mData = MomentData.pointsToPrincipalAxes([]);
    ck.testTrue(mData.origin.isAlmostZero);
    const tempMatrix = Matrix4d.createRowValues(1, 1, 1, 0,
      1, 1, 1, 0,
      1, 1, 1, 0,
      1, 1, 1, 0);
    ck.testUndefined(MomentData.inertiaProductsToPrincipalAxes(Point3d.create(1, 2, 3), tempMatrix));
    mData.origin = Point3d.create(1, 2, 3);
    mData.clearSums();
    ck.testTrue(mData.origin.x === 0 && mData.origin.y === 0 && mData.origin.z === 0);

    // make an ellipse.
    // stroke it with a multiple of 4 chords so points are symmetric and major/minor axis points are there.
    // compute principal moments and axes of the points.
    const radiusB = 1.0;
    for (const radiusA of [1, 2, 3.5]) {
      for (const degreesY of [0, 10, 78]) {
        for (const degreesZ of [0, -5, 20]) {
          const rotateZ = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(degreesZ)) as Matrix3d;
          const rotateY = Matrix3d.createRotationAroundVector(Vector3d.unitY(), Angle.createDegrees(degreesY)) as Matrix3d;
          const axes0 = rotateY.multiplyMatrixMatrix(rotateZ);

          const arc = Arc3d.createXYEllipse(Point3d.create(0, 0), radiusA, radiusB);
          arc.tryTransformInPlace(Transform.createFixedPointAndMatrix(Point3d.create(1, 0, 0), axes0));

          if (Checker.noisy.momentData) {
            console.log("******************************");
            console.log("   Data rotation degrees Y*Z*data", degreesY, degreesZ);
            console.log("            X", axes0.columnX());
            console.log("            Y", axes0.columnY());
            console.log("            Z", axes0.columnZ());
            console.log("   Radius ratio", radiusA);
            console.log("Arc center", arc.center);
          }
          const ls = LineString3d.create();
          const options = StrokeOptions.createForCurves();
          options.minStrokesPerPrimitive = 16;
          arc.emitStrokes(ls, options);
          ls.popPoint(); // eliminate the closure point -- now the center really is the centroid
          const moments = MomentData.pointsToPrincipalAxes(ls.points);
          if (Checker.noisy.momentData) {
            console.log("RawMoments Diagonal", moments.sums.diagonal().toJSON());
            console.log("origin", moments.localToWorldMap.origin);
            console.log("X", moments.localToWorldMap.matrix.columnX());
            console.log("Y", moments.localToWorldMap.matrix.columnY());
            console.log("Z", moments.localToWorldMap.matrix.columnZ());
            console.log("radius", moments.radiusOfGyration.toJSON());
          }
          ck.testPoint3d(arc.center, moments.origin, "Moment centroid matches ellipse");
          ck.testTrue(moments.radiusOfGyration.x <= moments.radiusOfGyration.y, "Moment.x <= moment.y");
          ck.testTrue(moments.radiusOfGyration.y <= moments.radiusOfGyration.z, "Moment.y <= moment.z");
          const principalZ = moments.localToWorldMap.matrix.columnZ();
          ck.testTrue(principalZ.isPerpendicularTo(axes0.columnX()), "principal Z perp X");
          ck.testTrue(principalZ.isPerpendicularTo(axes0.columnY()), "principal Z perp Z");
          ck.testCoordinate(Math.max(radiusA, radiusB) / Math.min(radiusA, radiusB),
            moments.radiusOfGyration.y / moments.radiusOfGyration.x,
            "Radii for Symmetric points on ellipse scale as axis lengths");
          if (Geometry.isAlmostEqualNumber(radiusA, radiusB)) {
            ck.testCoordinate(radiusA, moments.radiusOfGyration.z, "Circle radius Of gyration is radius");
          }
        }
      }
    }
    ck.checkpoint("MomentData.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("PolygonOps", () => {
  it("PolygonClip", () => {
    const ck = new Checker();
    // Coordinates rigged to make it easy to have "exact" hits of x,y lines at 0, 1, or 2 vertices
    const ay = 5;
    const ax = 8;
    const points = [
      Point2d.create(0, 0),
      Point2d.create(10, 0),
      Point2d.create(10, ay),
      Point2d.create(ax, 8),
      Point2d.create(0, 8),
      Point2d.create(0, 0)];
    const easyIn = Point2d.create(1, 1);
    const easyOut = Point2d.create(20, 20);
    const xHit = Point2d.create(2, ay);
    const yHit = Point2d.create(ax, 2);
    const xyHit = Point2d.create(ax, ay);
    ck.testExactNumber(1, PolygonOps.parity(easyIn, points), " IN with no vertex hits");
    ck.testExactNumber(-1, PolygonOps.parity(easyOut, points), "OUT with no vertex hits");
    ck.testExactNumber(1, PolygonOps.parity(xHit, points), "IN with horizontal vertex hits");
    ck.testExactNumber(1, PolygonOps.parity(yHit, points), "IN with vertical vertex hits");
    ck.testExactNumber(1, PolygonOps.parity(xyHit, points), "IN with xy vertex hits");
    ck.checkpoint("FrameBuilder");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Point3dArray", () => {
  it("DistantPoints", () => {
    const ck = new Checker();
    ck.checkpoint("FrameBuilder");
    const pointsA = Sample.createGrowableArrayCirclePoints(1.0, 7, false, 0, 0);
    Sample.createGrowableArrayCirclePoints(3.5, 37, false, 1.2, 2.8, pointsA);
    const pointsB = pointsA.getPoint3dArray();
    const frame = FrameBuilder.createFrameToDistantPoints(pointsB);
    const noFrame = FrameBuilder.createFrameToDistantPoints([Point3d.create(0, 0, 0)]);
    ck.testUndefined(noFrame, "Expect undefined frame from 1 point");

    if (ck.testPointer(frame, "frame to points") && frame) {
      const origin = frame.origin;
      const longVector = Vector3d.create();
      Point3dArray.vectorToMostDistantPoint(pointsB, origin, longVector);

      // We expect the frame encloses sll points with uv coordinates in [-1,1]
      const range = Range3d.createInverseTransformedArray(frame, pointsB);
      const e = 1.0e-14;
      const a = longVector.magnitude();
      const range1 = Range3d.createXYZXYZ(-a, -a, -e, a, a, e);
      ck.testTrue(range1.containsRange(range), "frame maps to -1,1");
    }

    expect(ck.getNumErrors()).equals(0);
  });

  it("MiscArrayOps", () => {
    const ck = new Checker();
    const pointsA = Sample.createFractalDiamonConvexPattern(1, -0.5);
    const frame = Transform.createFixedPointAndMatrix(Point3d.create(1, 2, 3),
      Matrix3d.createRotationAroundVector(Vector3d.create(0.3, -0.2, 1.2), Angle.createDegrees(15.7))!);
    frame.multiplyPoint3dArrayInPlace(pointsA);

    const map = FrameBuilder.createRightHandedLocalToWorld(pointsA);
    if (ck.testPointer(map, "Right Handed Map") && map) {
      const plane = Plane3dByOriginAndUnitNormal.create(
        map.getOrigin(), map.matrix.columnZ())!;
      ck.testTrue(Point3dArray.isCloseToPlane(pointsA, plane), "points in plane of frame");
    }

    const pointsB = Point3dArray.clonePoint3dArray(pointsA);
    ck.testTrue(Point3dArray.isAlmostEqual(pointsA, pointsB), "Point3dArray isAlmostEqual");
    frame.multiplyPoint3dArrayInPlace(pointsB);
    ck.testFalse(Point3dArray.isAlmostEqual(pointsA, pointsB), "Point3dArray isAlmostEqual after change to B");

    const xyzA = Point3dArray.packToFloat64Array(pointsA);
    const pointsA1 = Point3dArray.unpackNumbersToPoint3dArray(xyzA);
    ck.testTrue(Point3dArray.isAlmostEqual(pointsA, pointsA1), "pack and unpack");

    const points2dA = Point3dArray.clonePoint2dArray(pointsA);
    const points2dB = Point2dArray.clonePoint2dArray(points2dA);
    ck.testTrue(Point2dArray.isAlmostEqual(points2dA, points2dB), "Point2d array isAlmostEqual");
    const a = points2dB[0].clone();
    points2dB[0].x += 1;
    ck.testFalse(Point2dArray.isAlmostEqual(points2dA, points2dB), "Point2d array isAlmostEqual after coordinate change");
    points2dB[0] = a;
    ck.testTrue(Point2dArray.isAlmostEqual(points2dA, points2dB), "Point2d array isAlmostEqual");
    points2dB.pop();
    ck.testFalse(Point2dArray.isAlmostEqual(points2dA, points2dB), "Point2d array isAlmostEqual after pop");

    const vector3dA = Vector3dArray.cloneVector3dArray(pointsA);
    const vector3dB = Vector3dArray.cloneVector3dArray(vector3dA);
    ck.testTrue(Vector3dArray.isAlmostEqual(vector3dA, vector3dB), "Vector3dArray isAlmostEqual");
    vector3dA[Math.floor(vector3dA.length / 2)].x += 1.0;
    ck.testFalse(Vector3dArray.isAlmostEqual(vector3dA, vector3dB), "Vector3dArray isAlmostEqual after x change");

    expect(ck.getNumErrors()).equals(0);
  });

  it("Point4dArray", () => {
    const ck = new Checker();
    const pointsA = Sample.createFractalDiamonConvexPattern(1, -0.5);
    const frame = Transform.createFixedPointAndMatrix(Point3d.create(1, 2, 3),
      Matrix3d.createRotationAroundVector(Vector3d.create(0.3, -0.2, 1.2), Angle.createDegrees(15.7))!);
    frame.multiplyPoint3dArrayInPlace(pointsA);
    const weights = [];
    const amplitude = 0.25;
    const dtheta = 0.1;
    for (let i = 0; i < pointsA.length; i++)
      weights.push(1.0 + amplitude * Math.cos(i * dtheta));
    const xyzw = Point4dArray.packPointsAndWeightsToFloat64Array(pointsA, weights);
    ck.testExactNumber(4.0 * weights.length, xyzw.length, "Point4dArray.packToFloat64Array length");
    const point4dB = Point4dArray.unpackToPoint4dArray(xyzw);
    const xyzwB = Point4dArray.packToFloat64Array(point4dB);
    ck.testTrue(NumberArray.isExactEqual(xyzw, xyzwB), "packed point4d variants");
    xyzwB[3] += 1.0;
    ck.testFalse(NumberArray.isExactEqual(xyzw, xyzwB), "packed point4d variants");

    const pointsB: Point3d[] = [];
    const weightB: number[] = [];
    Point4dArray.unpackFloat64ArrayToPointsAndWeights(xyzw, pointsB, weightB);
    ck.testTrue(Point3dArray.isAlmostEqual(pointsA, pointsB), "point3d from point4d trips");
    ck.testTrue(NumberArray.isExactEqual(weights, weightB), "weights from point4d trips");
    expect(ck.getNumErrors()).equals(0);
  });
});
/*
function compareAreaData(ck: Checker, polygonA: Point3d[], polygonB: Point3d[] | GrowableXYZArray) {
  const areaA = PolygonOps.area(polygonA);
  const rayA = PolygonOps.centroidAreaNormal (polygonA);
  let areaB = -10203213;
  let rayB = Ray3d.create ();
  if (polygonB instanceof GrowableXYZArray) {
    const normalB = Vector3d.create();
    PolygonOps.areaNormalGrowablePoint3dArrayGo(polygonB, normalB);
    areaB = normalB.magnitude();
  } else {
    areaB = PolygonOps.area(polygonB);
  }
  ck.testCoordinate(areaA, areaB);
}

describe("PolygonAreas", () => {

  it("TriangleVariants", () => {
    const ck = new Checker();
    const triangle000 = Sample.createTriangleWithSplitEdges(0, 0, 0);
    const triangle010 = Sample.createTriangleWithSplitEdges(0, 1, 0);
    const triangle123 = Sample.createTriangleWithSplitEdges(1, 2, 3);
    const triangle000G = GrowableXYZArray.create(triangle000);
    const triangle010G = GrowableXYZArray.create(triangle010);
    const triangle123G = GrowableXYZArray.create(triangle123);
    compareAreaData(ck, triangle000, triangle010);
    compareAreaData(ck, triangle000, triangle123);
    compareAreaData(ck, triangle000, triangle000G);
    compareAreaData(ck, triangle000, triangle010G);
    compareAreaData(ck, triangle000, triangle123G);

    ck.checkpoint("PolygonAreas.TriangleVariants");
    expect(ck.getNumErrors()).equals(0);
  });
});
*/
