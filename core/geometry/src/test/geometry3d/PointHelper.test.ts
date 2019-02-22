/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Geometry, AxisScaleSelect } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { LineString3d } from "../../curve/LineString3d";
import { Arc3d } from "../../curve/Arc3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { PolygonOps, Point3dArray, Point2dArray, Vector3dArray, Point4dArray, NumberArray, Point3dArrayCarrier } from "../../geometry3d/PointHelpers";
import { FrameBuilder } from "../../geometry3d/FrameBuilder";
import { MatrixTests } from "./Point3dVector3d.test";
import { Checker } from "../Checker";
import { expect } from "chai";
import { Sample } from "../../serialization/GeometrySamples";
import { MomentData } from "../../geometry4d/MomentData";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point4d } from "../../geometry4d/Point4d";
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
          MatrixTests.checkProperties(ck,
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

    const axes122 = Matrix3d.createScale(2, 1, 2);
    const momentsXYZ = Vector3d.create(2, 1, 2);
    MomentData.sortColumnsForIncreasingMoments(axes122, momentsXYZ);
    ck.checkpoint("MomentData.HelloWorld");

    ck.testExactNumber(1, momentsXYZ.at(0));
    ck.testExactNumber(2, momentsXYZ.at(1));
    ck.testExactNumber(2, momentsXYZ.at(2));
    ck.testCoordinate(1, axes122.columnXMagnitude());
    ck.testCoordinate(2, axes122.columnYMagnitude());
    ck.testCoordinate(2, axes122.columnZMagnitude());
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
      Point2d.create(ax, ay),
      Point2d.create(ax, 8),
      Point2d.create(0, 8),
      Point2d.create(0, 0)];
    const q = 0.1;
    const onEdge = Point2d.create(0, 1);
    const tol = 1.0e-8;
    ck.testExactNumber(0, PolygonOps.parityVectorTest(onEdge, 1.5, points, tol)!);
    const easyIn = Point2d.create(1, 1);
    const easyOut = Point2d.create(20, 20);
    const xHit = Point2d.create(2, ay);
    const yHit = Point2d.create(ax, 2);
    const xyHit = Point2d.create(ax, ay);
    ck.testExactNumber(1, PolygonOps.parity(easyIn, points), " IN with no vertex hits");
    ck.testExactNumber(-1, PolygonOps.parity(easyOut, points), "OUT with no vertex hits");
    ck.testExactNumber(-1, PolygonOps.parityXTest(Point2d.create(-1, 0.5), points, tol)!, "OUT by simple X");
    ck.testExactNumber(-1, PolygonOps.parityXTest(Point2d.create(20, 0.5), points, tol)!, "OUT by simple X");
    ck.testExactNumber(-1, PolygonOps.parityXTest(Point2d.create(1, -0.5), points, tol)!, "OUT by simple Y");
    ck.testExactNumber(-1, PolygonOps.parityXTest(Point2d.create(1, 14.5), points, tol)!, "OUT by simple Y");

    ck.testExactNumber(1, PolygonOps.parity(xHit, points), "IN with horizontal vertex hits");
    ck.testExactNumber(1, PolygonOps.parity(yHit, points), "IN with vertical vertex hits");
    ck.testExactNumber(0, PolygonOps.parity(xyHit, points), "ON with xy vertex hits");
    ck.testExactNumber(-1, PolygonOps.parityVectorTest(easyOut, 1.5, points, tol)!);
    // This should have 4 crossings
    ck.testExactNumber(-1, PolygonOps.parityVectorTest(Point2d.create(ax + q, ay + q), Math.atan(-1.0), points, tol)!);

    ck.testExactNumber(0, PolygonOps.testXYPolygonTurningDirections([]));
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
    const spacePoint = Point3d.create(3, 2, 5);
    const spaceVector = Vector3d.create(-1, 2, 4);
    const resultVector = Vector3d.create();
    ck.testUndefined(Point3dArray.indexOfMostDistantPoint([], spacePoint, resultVector));
    ck.testUndefined(Point3dArray.indexOfPointWithMaxCrossProductMagnitude([], spacePoint, spaceVector, resultVector));

    if (ck.testPointer(frame, "frame to points") && frame) {
      const origin = frame.origin;
      const longVector = Vector3d.create();
      Point3dArray.indexOfMostDistantPoint(pointsB, origin, longVector);

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

    const point4dC = Point4dArray.unpackToPoint4dArray(xyzw);
    point4dC.pop();
    ck.testFalse(Point4dArray.isAlmostEqual(point4dB, point4dC));
    ck.testTrue(Point4dArray.isAlmostEqual(point4dB, point4dB));
    ck.testTrue(Point4dArray.isAlmostEqual(undefined, undefined));

    const xyzwB = Point4dArray.packToFloat64Array(point4dB);
    ck.testTrue(NumberArray.isExactEqual(xyzw, xyzwB), "packed point4d variants");
    xyzwB[3] += 1.0;
    ck.testFalse(NumberArray.isExactEqual(xyzw, xyzwB), "packed point4d variants");

    const pointsB: Point3d[] = [];
    const weightB: number[] = [];
    Point4dArray.unpackFloat64ArrayToPointsAndWeights(xyzw, pointsB, weightB);
    ck.testTrue(Point3dArray.isAlmostEqual(pointsA, pointsB), "point3d from point4d trips");
    ck.testTrue(NumberArray.isExactEqual(weights, weightB), "weights from point4d trips");

    const point4dBChanged = point4dB!.map((x: Point4d) => x.clone());
    point4dBChanged[1].x = 0.213213;
    ck.testFalse(Point4dArray.isAlmostEqual(point4dB, point4dBChanged));
    expect(ck.getNumErrors()).equals(0);
  });

  it("Point4dArrayPlane", () => {
    const ck = new Checker();
    const center = Point4d.create(1, 2, 3, 1);
    const vector0 = Point4d.create(0, 3, 4, 6);
    const vector90 = Point4d.create(4, 2, -3, 2);
    const allPoints = [];
    const plane4d = Point4d.perpendicularPoint4dPlane(center, vector0, vector90);
    // confirm plane contains all 3 of the basis points . . .
    ck.testCoordinate(plane4d.dotProduct(center), 0);
    ck.testCoordinate(plane4d.dotProduct(vector0), 0);
    ck.testCoordinate(plane4d.dotProduct(vector90), 0);
    for (const degrees of [0, 30, 69, 123]) {
      const theta = Angle.createDegrees(degrees);
      const c = theta.cos();
      const s = theta.sin();
      allPoints.push(center.plus2Scaled(vector0, c, vector90, s));
    }
    const plane3d = plane4d.toPlane3dByOriginAndUnitNormal();
    if (ck.testPointer(plane3d) && plane3d) {
      ck.testCoordinate(plane3d.altitudeXYZW(center.x, center.y, center.z, center.w), 0);
      ck.testCoordinate(plane3d.altitudeXYZW(vector0.x, vector0.y, vector0.z, vector0.w), 0);
      ck.testCoordinate(plane3d.altitudeXYZW(vector90.x, vector90.y, vector90.z, vector90.w), 0);
      ck.testTrue(Point4dArray.isCloseToPlane(allPoints, plane3d));
      // throw on another point sure to be off plane:
      allPoints.push(center.plusScaled(plane4d, 0.1));
      ck.testFalse(Point4dArray.isCloseToPlane(allPoints, plane3d));
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("ParityTests", () => {
    const ck = new Checker();
    const a = 5;
    const b = 2;
    const polygon = [
      Point2d.create(0, 0),
      Point2d.create(8, 0),
      Point2d.create(8, b),
      Point2d.create(a, b),
      Point2d.create(a, 6),
      Point2d.create(0, 6)];
    const tol = 0.01;
    const theta = Angle.createDegrees(45);
    for (const p of polygon) {
      ck.testUndefined(PolygonOps.parityYTest(p, polygon, tol));
      ck.testUndefined(PolygonOps.parityXTest(p, polygon, tol));
      ck.testUndefined(PolygonOps.parityVectorTest(p, theta.radians, polygon, tol));
      ck.testExactNumber(0, PolygonOps.parity(p, polygon, tol));
    }
    ck.testUndefined(PolygonOps.parityYTest(Point2d.create(1, b), polygon, tol));
    ck.testUndefined(PolygonOps.parityXTest(Point2d.create(a, 1), polygon, tol));

    const pointA = Point2d.create(1, 2);
    const pointB = Point2d.create(1.5, 0.2);
    ck.testExactNumber(0, PolygonOps.parity(pointA, [pointA]));
    ck.testExactNumber(-1, PolygonOps.parity(pointA, [pointB]));
    const radiansQ = 0.276234342921378;
    const vectorQ = Vector2d.create(Math.cos(radiansQ), Math.sin(radiansQ));
    const pointQ = polygon[3].plusScaled(vectorQ, -0.2);
    // make a polygon with exact pointQ hits for x,y, and the ("secret") special angle for secondary testing
    const polygonQ = [
      polygon[0],
      Point2d.create(pointQ.x, 0),
      polygon[1],
      Point2d.create(8, pointQ.y),
      polygon[2],
      polygon[3],
      polygon[4],
      polygon[5]];
    ck.testExactNumber(1, PolygonOps.parity(pointQ, polygonQ, tol));
    ck.testExactNumber(1, PolygonOps.parity(pointQ, polygonQ, tol));
    expect(ck.getNumErrors()).equals(0);
  });

  it("PolylineLength", () => {
    const ck = new Checker();
    const packedPoints = [
      0, 0, 0,
      2, 0, 0,
      2, 2, 0,
      2, 2, 2,
      0, 2, 2,
      0, 2, 0,
      0, 0, 0];

    const packed64 = new Float64Array(packedPoints);
    const points = Point3dArray.unpackNumbersToPoint3dArray(packed64);

    for (const addClosureEdge of [false, true]) {
      const a0 = Point3dArray.sumEdgeLengths(points, addClosureEdge);
      const a64 = Point3dArray.sumEdgeLengths(packed64, addClosureEdge);
      const transform = Sample.createMessyRigidTransform(Point3d.create(2, 5, 9));
      transform.multiplyPoint3dArrayInPlace(points);
      const a1 = Point3dArray.sumEdgeLengths(points, addClosureEdge);
      ck.testCoordinate(a1, a0, "rigid transform does not change distances");
      ck.testExactNumber(a0, a64);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Point3dArrayCarrierBadIndex", () => {
    const ck = new Checker();
    const carrier = new Point3dArrayCarrier([Point3d.create(1, 2, 3), Point3d.create(6, 2, 9), Point3d.create(6, 2, 0), Point3d.create(-4, 2, 8)]);
    const a = carrier.length;
    // These methdos should return undefined if any index is bad.
    // (we know the index tests happen in a single validation function -- "some" calls need to test both extremes of out-of-bounds, but any pariticular arg only has to be tested in one direction)
    ck.testUndefined(carrier.getPoint3dAtCheckedPointIndex(-1));
    ck.testUndefined(carrier.getPoint3dAtCheckedPointIndex(a));
    ck.testUndefined(carrier.getVector3dAtCheckedVectorIndex(-1));
    ck.testUndefined(carrier.getVector3dAtCheckedVectorIndex(a));

    const cross = Vector3d.create();
    ck.testUndefined(carrier.accumulateCrossProductIndexIndexIndex(-1, 1, 3, cross));
    ck.testUndefined(carrier.accumulateCrossProductIndexIndexIndex(1, 21, 3, cross));
    ck.testUndefined(carrier.accumulateCrossProductIndexIndexIndex(1, 3, -1, cross));

    const origin = Point3d.create(1, 4, 2);

    ck.testUndefined(carrier.crossProductIndexIndexIndex(-1, 1, 3, cross));
    ck.testUndefined(carrier.crossProductIndexIndexIndex(1, 21, 3, cross));
    ck.testUndefined(carrier.crossProductIndexIndexIndex(1, 3, -1, cross));

    ck.testUndefined(carrier.crossProductXYAndZIndexIndex(origin, -1, 3, cross));
    ck.testUndefined(carrier.crossProductXYAndZIndexIndex(origin, 21, a, cross));

    ck.testUndefined(carrier.vectorIndexIndex(-1, 3));
    ck.testUndefined(carrier.vectorIndexIndex(1, 30));
    ck.testUndefined(carrier.vectorXYAndZIndex(origin, -1));
    ck.testPointer(carrier.vectorXYAndZIndex(origin, 1));
    expect(ck.getNumErrors()).equals(0);
  });

  it("Point2dArray", () => {
    const ck = new Checker();
    const pointsA = Sample.createFractalDiamonConvexPattern(1, -0.5);
    const numA = pointsA.length;
    const numB = Point2dArray.pointCountExcludingTrailingWraparound(pointsA);
    ck.testExactNumber(0, Point2dArray.pointCountExcludingTrailingWraparound([]));
    ck.testExactNumber(numA, numB + 1);
    const centroid = Point2d.create();
    const pointsOnLine = [];
    for (const xRight of [1, 2, 4, 6]) {
      ck.testUndefined(PolygonOps.centroidAndAreaXY(pointsOnLine, centroid));
      pointsOnLine.push(Point2d.create(xRight, 0));
    }

    expect(ck.getNumErrors()).equals(0);
  });

  it("Vector3dArray", () => {
    const ck = new Checker();
    const arrayA = [];
    const arrayB = [];
    for (const i of [1, 2, 4, 3]) {
      const vector = Vector3d.create(i, i * i, i - 1);
      arrayA.push(vector);
      arrayB.push(vector.clone());
    }
    ck.testTrue(Vector3dArray.isAlmostEqual(arrayA, arrayB));
    arrayB.pop();
    ck.testFalse(Vector3dArray.isAlmostEqual(arrayA, arrayB));
    expect(ck.getNumErrors()).equals(0);
  });
  it("NumberArrayComparison", () => {
    const ck = new Checker();
    const dataA0 = [1, 2, 3, 4, 5];
    const dataA1 = new Float64Array([1, 2, 3, 4, 5]);
    const dataB0 = dataA0.map((x) => x);
    dataB0.pop();
    ck.testTrue(NumberArray.isAlmostEqual(dataA0, dataA1, 0.1));
    ck.testFalse(NumberArray.isAlmostEqual(dataA0, dataB0, 0.01));
    ck.testFalse(NumberArray.isExactEqual(dataA0, dataB0));
    ck.testFalse(NumberArray.isAlmostEqual(dataA0, [], 0.01));
    ck.testFalse(NumberArray.isAlmostEqual([], dataA0, 0.01));
    ck.testFalse(NumberArray.isAlmostEqual(dataA0, undefined, 0.01));
    ck.testFalse(NumberArray.isAlmostEqual(undefined, dataA0, 0.01));
    ck.testExactNumber(0, NumberArray.preciseSum([]));
    const e = 0.01;
    dataA1[3] += e;
    ck.testTrue(NumberArray.isAlmostEqual(dataA0, dataA1, 2 * e));
    ck.testFalse(NumberArray.isAlmostEqual(dataA0, dataA1, 0.5 * e));
    ck.testFalse(NumberArray.isCoordinateInArray(1, []));
    for (const x of dataA0) {
      ck.testTrue(NumberArray.isCoordinateInArray(x, dataA0));
      ck.testFalse(NumberArray.isCoordinateInArray(x + 0.1231897897, dataA0));
    }
    ck.testExactNumber(0, NumberArray.maxAbsArray([]));
    expect(ck.getNumErrors()).equals(0);
  });

  it("CentroidBranches", () => {
    const ck = new Checker();
    const pointsA = [Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(0, 4, 0)];
    const pointsC = pointsA.map((xyz: Point3d) => xyz.clone());
    pointsC.push(Point3d.create(0, 2, 0));    // more points, same normal and area!!!
    pointsC.push(Point3d.create(0, 1, 0));    // more points, same normal and area!!!

    const pointsB = Point3dArray.clonePoint3dArray(pointsA);
    pointsB.push(pointsB[0].clone());   // degenerate quad !!!!

    ck.testExactNumber(3, Point2dArray.pointCountExcludingTrailingWraparound(pointsA));
    // single point ...
    const point0 = Point3d.create(1, 2, 3);
    const point1 = Point3d.create(3, 2, 9);
    ck.testExactNumber(1, Point2dArray.pointCountExcludingTrailingWraparound([point0, point0, point0, point0]));
    ck.testExactNumber(3, Point2dArray.pointCountExcludingTrailingWraparound(pointsB));
    ck.testExactNumber(0.0, PolygonOps.sumTriangleAreas([]));
    ck.testExactNumber(0.0, PolygonOps.sumTriangleAreas([point0]));
    ck.testExactNumber(0.0, PolygonOps.sumTriangleAreas([point0, point1]));
    const carrierA = new Point3dArrayCarrier(pointsA);
    const carrierB = new Point3dArrayCarrier(pointsB);
    const carrierC = new Point3dArrayCarrier(pointsC);

    const rayA = PolygonOps.centroidAreaNormal(pointsA)!;
    const rayB = PolygonOps.centroidAreaNormal(pointsB)!;

    const unitA = Vector3d.create();
    const unitB = Vector3d.create();
    const unitC = Vector3d.create();

    ck.testTrue(PolygonOps.unitNormal(carrierA, unitA));
    ck.testTrue(PolygonOps.unitNormal(carrierB, unitB));
    ck.testTrue(PolygonOps.unitNormal(carrierC, unitC));

    ck.testVector3d(unitA, unitB);
    ck.testVector3d(unitA, unitC);

    ck.testPoint3d(rayA.origin, rayB.origin);
    ck.testVector3d(rayA.direction, rayB.direction);
    // degenerate -- points on a line . . .
    const pointsOnLine = [];
    for (let i = 0; i < 6; i++) {
      pointsOnLine.push(Point3d.create(i, i, i));
      ck.testUndefined(PolygonOps.centroidAreaNormal(pointsOnLine));
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

function compareAreaData(ck: Checker, polygonA: Point3d[], polygonB: Point3d[] | GrowableXYZArray) {
  const areaA = PolygonOps.area(polygonA);
  // const rayA = PolygonOps.centroidAreaNormal(polygonA);
  let areaB = -10203213;
  // let rayB = Ray3d.create();
  if (polygonB instanceof GrowableXYZArray) {
    const normalB = Vector3d.create();
    PolygonOps.areaNormalGo(polygonB, normalB);
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
