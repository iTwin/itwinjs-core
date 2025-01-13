/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";

import { CurveFactory } from "../../curve/CurveFactory";
import { CurveCurveApproachType } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { AxisOrder, Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { BarycentricTriangle, TriangleLocationDetail } from "../../geometry3d/BarycentricTriangle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";

/** create rays, using optional result (which may be undefined) */
function createRays(ck: Checker, target?: Ray3d) {
  const pointA = Point3d.create(1, 2, 3);
  const directionA = Vector3d.create(4, 5, 6);
  const pointB = pointA.plus(directionA);
  const ray = Ray3d.create(pointA, directionA, target);

  ck.testFalse(pointA === ray.origin, "confirm inputs cloned");
  ck.testFalse(directionA === ray.direction, "confirm inputs cloned");
  const ray1 = Ray3d.createXYZUVW(pointA.x, pointA.y, pointA.z, directionA.x, directionA.y, directionA.z, target);
  ck.testPoint3d(pointA, ray1.origin);
  ck.testVector3d(directionA, ray1.direction);

  const transform = Transform.createOriginAndMatrix(Point3d.create(4, 2, -1), Matrix3d.createScale(-3, -2, 5));
  const ray3 = ray.clone();
  const ray3A = ray.clone(Ray3d.createZero());
  const ray4 = ray.cloneTransformed(transform);
  ck.testTrue(ray3.isAlmostEqual(ray), "clone");
  ck.testTrue(ray3A.isAlmostEqual(ray), "clone");
  ck.testFalse(ray4.isAlmostEqual(ray), "clone Transformed");

  for (const f of [0.5, 1, -1]) {
    const pointF = ray1.fractionToPoint(f);
    const fractionOut = ray1.pointToFraction(pointF);
    ck.testCoordinate(f, fractionOut);
    const pointF4 = ray4.fractionToPoint(f);
    ck.testPoint3d(pointF4, transform.multiplyPoint3d(pointF), "transform*ray");

    const pointF1 = ray1.projectPointToRay(pointF);
    ck.testPoint3d(pointF, pointF1, "fraction to point re projects to same point");
    const frame = ray.toRigidZFrame();
    if (ck.testPointer(frame)) {
      const localPoint = Point3d.create(0.3, 0.8, 5.7);
      const globalPoint = frame.multiplyPoint3d(localPoint);
      const distanceToRay = ray.distance(globalPoint);
      ck.testCoordinate(distanceToRay, localPoint.magnitudeXY(), " projection distance is in plane part");
    }

    const ray5 = Ray3d.createPointVectorNumber(pointA, directionA, 4.0, target);
    ck.testPoint3d(ray5.origin, pointA);
    ck.testVector3d(ray5.direction, directionA);
  }

  const ray2 = Ray3d.createStartEnd(pointA, pointB);
  const ray2A = Ray3d.createStartEnd(pointA, pointB, Ray3d.createZero());
  ck.testTrue(ray2.isAlmostEqual(ray));
  ck.testTrue(ray2A.isAlmostEqual(ray));

  const json2 = ray2.toJSON();
  const ray2B = Ray3d.fromJSON(json2);
  const ray2C = Ray3d.fromJSON();
  ck.testTrue(ray2.isAlmostEqual(ray2B), "json round trip");
  ck.testPointer(ray2C, "expect some default fromJSON");

}

describe("Ray3d", () => {
  it("Ray3d.HelloWorld", () => {
    const ck = new Checker();
    const rayX = Ray3d.createXAxis();
    const rayY = Ray3d.createYAxis();
    const rayZ = Ray3d.createZAxis();
    ck.testPerpendicular(rayX.direction, rayY.direction);
    ck.testPerpendicular(rayX.direction, rayZ.direction);
    ck.testPerpendicular(rayY.direction, rayZ.direction);
    const ray0 = Ray3d.createZero();
    const rayQ = Ray3d.createXYZUVW(1, 2, 3, 4, 5, 6);
    const rayQ0 = Ray3d.createZero(rayQ);
    ck.testTrue(ray0.isAlmostEqual(rayQ0));
    ck.testTrue(ray0.isAlmostEqual(rayQ));

    const rayU = Ray3d.createXYZUVW(1, 2, 3, 4, 5, 6);
    ck.testTrue(rayU.trySetDirectionMagnitudeInPlace(2.0));
    ck.testCoordinate(2.0, rayU.direction.magnitude(), "ray direction with imposed magnitude");
    createRays(ck, undefined);
    createRays(ck, rayQ0);

    const nullRay = Ray3d.createXYZUVW(1, 2, 3, 0, 0, 0);  // general origin, zero vector to trigger else branches ..
    nullRay.toRigidZFrame();
    nullRay.tryNormalizeInPlaceWithAreaWeight(0.0);
    nullRay.tryNormalizeInPlaceWithAreaWeight(1.0);
    const spacePoint = Point3d.create(8, 10, 1);
    ck.testCoordinate(spacePoint.distance(nullRay.origin), nullRay.distance(spacePoint), "distance to null ray");

    ck.testFalse(nullRay.trySetDirectionMagnitudeInPlace(), "trySetMagnitude of null ray");

    ck.testUndefined(
      Ray3d.createWeightedDerivative(
        new Float64Array([1, 2, 3, 0]),
        new Float64Array([2, 1, 4, 0])));
    expect(ck.getNumErrors()).toBe(0);
  });
  it("Ray3d.ClosestApproach", () => {
    const ck = new Checker();
    // we expect that there are no parallel pairs or intersecting pairs here . . .
    const raySample = [
      Ray3d.createXYZUVW(0, 1, 0, 1, 0, 0),
      Ray3d.createXYZUVW(0, 0, 1, 0, 1, 0),
      Ray3d.createXYZUVW(1, 0, 0, 0, 0, 1),
      Ray3d.createXYZUVW(1, 2, 3, 5, 2, -1),
      Ray3d.createXYZUVW(-3, 2, 4, -1, 3, 4),
    ];
    /* fractions for contrived intersections  */
    const f1 = 0.13123;
    const f2 = -0.1232;
    for (let indexA = 0; indexA < raySample.length; indexA++) {
      const rayA = raySample[indexA];
      const frame = Matrix3d.createRigidHeadsUp(rayA.direction, AxisOrder.ZXY);
      for (let indexB = 0; indexB < raySample.length; indexB++) {
        const rayB = raySample[indexB];
        const approach = Ray3d.closestApproachRay3dRay3d(rayA, rayB);
        if (indexA === indexB) {
          ck.testExactNumber(approach.approachType!, CurveCurveApproachType.CoincidentGeometry, indexA);
          const rayC = rayA.clone();
          const shiftDistance = 34.2 + indexA;
          rayC.origin.addScaledInPlace(frame.columnY(), shiftDistance);
          const approachC = Ray3d.closestApproachRay3dRay3d(rayA, rayC);
          ck.testExactNumber(approachC.approachType!, CurveCurveApproachType.ParallelGeometry, indexA);
          ck.testCoordinate(shiftDistance, approachC.detailA.point.distance(approachC.detailB.point));

        } else {
          ck.testExactNumber(approach.approachType!, CurveCurveApproachType.PerpendicularChord, [indexA, indexB]);
          const vector = Vector3d.createStartEnd(approach.detailA.point, approach.detailB.point);
          ck.testPerpendicular(vector, rayA.direction);
          ck.testPerpendicular(vector, rayB.direction);
          const rayE1 = rayA.clone();
          const rayE2 = rayB.clone();
          const point1 = rayE1.fractionToPoint(f1);
          const point2 = rayE2.fractionToPoint(f2);
          const vector12 = Vector3d.createStartEnd(point1, point2);
          rayE1.origin.addInPlace(vector12);
          // rayE2 at fraction f2 has been moved to rayE1 at fraction f1.  Confirm intersection there . .
          const approachE = Ray3d.closestApproachRay3dRay3d(rayE1, rayE2);
          ck.testExactNumber(
            approachE.approachType!, CurveCurveApproachType.Intersection, "forced intersection", [indexA, indexB],
          );
          ck.testCoordinate(f1, approachE.detailA.fraction);
          ck.testCoordinate(f2, approachE.detailB.fraction);
        }
      }
    }

    expect(ck.getNumErrors()).toBe(0);
  });

  it("Ray3d.ClipToRange", () => {
    const ck = new Checker();
    // we expect that there are no parallel pairs or intersecting pairs here . . .
    const raySample = [
      Ray3d.createXYZUVW(0, 1, 0, 1, 0, 0),
      Ray3d.createXYZUVW(0, 0, 1, 0, 1, 0),
      Ray3d.createXYZUVW(1, 0, 0, 0, 0, 1),
      Ray3d.createXYZUVW(0, 2, 0, 1, 0, 0),
      Ray3d.createXYZUVW(0, 0, 2, 0, 1, 0),
      Ray3d.createXYZUVW(2, 0, 0, 0, 0, 1),
      Ray3d.createXYZUVW(0, -1, 0, 1, 0, 0),
      Ray3d.createXYZUVW(0, 0, -1, 0, 1, 0),
      Ray3d.createXYZUVW(-1, 0, 0, 0, 0, 1),
      Ray3d.createXYZUVW(0.5, 0.6, 0.7, 1, 2, 3),
      Ray3d.createXYZUVW(1, 2, 3, 5, 2, -1),
      Ray3d.createXYZUVW(-3, 2, 4, -1, 3, 4),
    ];
    const rangeSample = [
      Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1),
      Range3d.createXYZXYZ(-100, -200, -300, 500, 600, 700),
      Range3d.createXYZXYZ(100, -200, -300, 500, 600, 700),
      Range3d.createXYZXYZ(200, 300, 400, 500, 600, 700),
    ];
    let numOutside = 0;
    for (const ray of raySample) {
      // ray.fractionToPoint(f) === ray1.fractionToPoint (-f)
      const ray1 = Ray3d.create(ray.origin, ray.direction.scale(-1));
      for (const range of rangeSample) {
        const interval = ray.intersectionWithRange3d(range);

        if (!interval.isNull) {
          for (const intervalFraction of [0.999999, 0.5, 0.000001, -0.001, 1.001]) {
            const point = ray.fractionToPoint(interval.fractionToPoint(intervalFraction));
            if (
              !ck.testBoolean(
                Geometry.isIn01(intervalFraction), range.containsPoint(point), "fractional point vs range",
                intervalFraction, point, prettyPrint(ray), prettyPrint(range),
              )
            )
              ray.intersectionWithRange3d(range);
          }
          const interval1 = ray1.intersectionWithRange3d(range);
          if (ck.testDefined(interval1, "Expected reversed ray to have related intersection")) {
            ck.testCoordinate(interval.low, - interval1.high, "reversed ray");
            ck.testCoordinate(interval.high, - interval1.low, "reversed ray");
          }
        } else {
          numOutside++;
          for (let intervalFraction = -0.5; intervalFraction < 1.7; intervalFraction += 0.25) {
            const point = ray.fractionToPoint(interval.fractionToPoint(intervalFraction));
            ck.testFalse(range.containsPoint(point), "expect point outside", intervalFraction, point, ray, range);
          }
        }
      }
    }
    /** known inside to outside rays .. */
    for (const range of rangeSample) {
      const q = range.fractionToPoint(0.4, 0.2, 0.1);
      const interval0 = Range1d.createNull();
      for (const ray of raySample) {
        const ray3 = Ray3d.create(q, ray.direction);   // we know this starts inside
        const interval = ray3.intersectionWithRange3d(range, interval0);
        ck.testTrue(interval0 === interval, "Verify reuse result)");
        if (ck.testFalse(interval.isNull, "expect real intersection from inside start")) {
          ck.testTrue(interval.containsX(0.0));
          for (const intervalFraction of [0.999999, 0.5, 0.000001, -0.001, 1.001]) {
            const point = ray3.fractionToPoint(interval.fractionToPoint(intervalFraction));
            if (!ck.testBoolean(Geometry.isIn01(intervalFraction), range.containsPoint(point), "fractional point vs range", intervalFraction, point,
              prettyPrint(ray3), prettyPrint(range)))
              ray.intersectionWithRange3d(range);
          }
        }
      }
    }
    ck.testLE(0, numOutside, "Confirm some outside rays were vetted");
    const ray2 = raySample[0];
    const null3d = Range3d.createNull();
    const range1d = Range1d.createXX(0, 1);
    ck.testTrue(ray2.intersectionWithRange3d(null3d).isNull, "ray intersect null range");
    ck.testFalse(range1d.clipLinearMapToInterval(0, 1, 3, 1), "range1d clipLinearMapToInterval with null interval");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("Ray3d.IntersectWithPlane", () => {
    const ck = new Checker();
    const plane = Plane3dByOriginAndUnitNormal.createXYZUVW(1, 3, 2, 5, 2, 9)!;
    const rayA = Ray3d.createXYZUVW(5, 4, 2, 1, 3, 2);
    const rayB = Ray3d.createXYZUVW(5, 4, 1, -2, 5, 0);
    const fractionA = rayA.intersectionWithPlane(plane);
    if (fractionA !== undefined && ck.testIsFinite(fractionA)) {
      const point = rayA.fractionToPoint(fractionA);
      ck.testCoordinate(0, plane.altitude(point));
    }
    const fractionB = rayB.intersectionWithPlane(plane);
    ck.testUndefined(fractionB, "Detect ray parallel to plane");
    // This pair generates aDotN and UDotN both near zero
    const planeQ = Plane3dByOriginAndUnitNormal.createXYZUVW(
      101.38054428331306, -7.136947376249823, 14.575798896766162,
      1.4069516995683865e-17, 1.0468826690441132e-32, 1)!;
    const rayQ = Ray3d.createXYZUVW(95.87780347429201, -7.1369473762498234, 14.575798896766187,
      - 1, -4.61132646190051e-31, 4.567684502237405e-15);
    ck.testUndefined(rayQ.intersectionWithPlane(planeQ));
    expect(ck.getNumErrors()).toBe(0);
  });
  it("Ray3d.PlanePlaneIntersection", () => {
    const ck = new Checker();
    const planeB = Plane3dByOriginAndUnitNormal.createXYZUVW(1, 3, 2, 5, 2, 9)!;
    const planeA = Plane3dByOriginAndUnitNormal.createXYZUVW(5, 9, 3, -2, 4, 1)!;
    ck.testUndefined(CurveFactory.planePlaneIntersectionRay(planeA, planeA), "Self intersection should fail");
    const ray = CurveFactory.planePlaneIntersectionRay(planeA, planeB);
    if (ck.testType(ray, Ray3d, "plane plane intersection")) {
      for (const f of [0, 1, 125]) {
        const xyz = ray.fractionToPoint(f);
        ck.testCoordinate(0, planeA.altitude(xyz), "point on intersection is on planeA");
        ck.testCoordinate(0, planeB.altitude(xyz), "point on intersection is on planeB");
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("Ray3d.isAlmostEqualPointSet", () => {
  it("Ray3d.isAlmostEqualPointSet", () => {
    const ck = new Checker();
    const origin1 = Point3d.create(0, 0, 0);
    const direction1 = Vector3d.create(1, 2, 3);
    const ray1 = Ray3d.create(origin1, direction1);
    let origin2 = Point3d.create(1, 2, 3);
    let direction2 = Vector3d.create(0, 0, 0);
    let ray2 = Ray3d.create(origin2, direction2);
    ck.testFalse(ray1.isAlmostEqualPointSet(ray2), "ray1 is not equal to ray2");

    origin2 = Point3d.create(0, 0, 0);
    direction2 = Vector3d.create(1, 2, 3);
    ray2 = Ray3d.create(origin2, direction2);
    ck.testTrue(ray1.isAlmostEqualPointSet(ray2), "ray1 is equal to ray2");

    origin2 = Point3d.create(-1, -2, -3); // a different point on ray1
    direction2 = Vector3d.create(1, 2, 3);
    ray2 = Ray3d.create(origin2, direction2);
    ck.testTrue(ray1.isAlmostEqualPointSet(ray2), "ray1 is parallel to ray2");

    expect(ck.getNumErrors()).toBe(0);
  });
});

/** Return a random number between -100 and 100 */
function getRandomNumber() {
  return 200 * Math.random() - 100;
}
function captureRay(allGeometry: GeometryQuery[], ray: Ray3d, rotatedRay: Ray3d) {
  GeometryCoreTestIO.captureGeometry(
    allGeometry,
    LineSegment3d.create(ray.origin, ray.origin.plusScaled(ray.direction, 5)),
  );
  GeometryCoreTestIO.captureGeometry(
    allGeometry,
    LineSegment3d.create(rotatedRay.origin, rotatedRay.origin.plusScaled(rotatedRay.direction, 5)),
  );
}
function captureTriangle(allGeometry: GeometryQuery[], triangle: BarycentricTriangle, rotatedTriangle: BarycentricTriangle) {
  GeometryCoreTestIO.captureGeometry(
    allGeometry,
    LineString3d.create(triangle.points[0], triangle.points[1], triangle.points[2], triangle.points[0]),
  );
  GeometryCoreTestIO.captureGeometry(
    allGeometry,
    LineString3d.create(
      rotatedTriangle.points[0], rotatedTriangle.points[1], rotatedTriangle.points[2], rotatedTriangle.points[0],
    ),
  );
}

describe("Ray3d.IntersectionWithTriangle", () => {
  it("Ray3d.IntersectionWithTriangleAccuracy", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let origin: Point3d;
    let direction: Vector3d;
    let ray: Ray3d;
    let triangle: BarycentricTriangle;
    let intersectionPoint: Point3d | undefined;
    let expectedIntersectionPoint: Point3d | undefined;

    const rotatedRay = Ray3d.createZero();
    const rotatedTriangle = BarycentricTriangle.create(new Point3d(0, 0, 0), new Point3d(0, 0, 0), new Point3d(0, 0, 0));
    let rotatedIntersectionPoint: Point3d | undefined; // rotate ray and triangle and then find intersection
    let rotatedOriginalIntersectionPoint = Point3d.createZero(); // find intersection and then rotate the intersection
    let rotationMatrix: Matrix3d;
    const angle: Angle = Angle.createDegrees(getRandomNumber());
    const rotationAxis: Vector3d = Vector3d.create(getRandomNumber(), getRandomNumber(), getRandomNumber());
    if (!rotationAxis.magnitude()) {
      rotationMatrix = Matrix3d.identity;
    } else {
      rotationMatrix = Matrix3d.createRotationAroundVector(rotationAxis, angle)!;
    }
    const rotationTransform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0), rotationMatrix);

    origin = Point3d.create(3, 3, -5);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 10, 0, 0, 2, 10, 0);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2])!;
    expectedIntersectionPoint = Point3d.create(3, 3, 0);
    if (ck.testDefined(intersectionPoint)) {
      ck.testPoint3d(intersectionPoint, expectedIntersectionPoint, "ray intersects triangle at a point");
    }
    ray.cloneTransformed(rotationTransform, rotatedRay);
    triangle.cloneTransformed(rotationTransform, rotatedTriangle);
    rotatedIntersectionPoint = rotatedRay.intersectionWithTriangle(
      rotatedTriangle.points[0], rotatedTriangle.points[1], rotatedTriangle.points[2],
    );
    rotatedOriginalIntersectionPoint = rotationMatrix.multiplyPoint(intersectionPoint);
    if (ck.testDefined(rotatedIntersectionPoint)) {
      ck.testPoint3d(
        rotatedOriginalIntersectionPoint,
        rotatedIntersectionPoint,
        "rotating original intersection points gives rotated intersection points",
      );
    }
    captureRay(allGeometry, ray, rotatedRay);
    captureTriangle(allGeometry, triangle, rotatedTriangle);

    origin = Point3d.create(2, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2])!;
    expectedIntersectionPoint = Point3d.create(2, 0, 0);
    if (ck.testDefined(intersectionPoint)) {
      ck.testPoint3d(intersectionPoint, expectedIntersectionPoint, "ray intersects triangle at a triangle vertex");
    }
    ray.cloneTransformed(rotationTransform, rotatedRay);
    triangle.cloneTransformed(rotationTransform, rotatedTriangle);
    rotatedIntersectionPoint = rotatedRay.intersectionWithTriangle(
      rotatedTriangle.points[0], rotatedTriangle.points[1], rotatedTriangle.points[2],
    );
    rotatedOriginalIntersectionPoint = rotationMatrix.multiplyPoint(intersectionPoint);
    if (ck.testDefined(rotatedIntersectionPoint)) {
      ck.testPoint3d(
        rotatedOriginalIntersectionPoint,
        rotatedIntersectionPoint,
        "rotating original intersection points gives rotated intersection points",
      );
    }
    captureRay(allGeometry, ray, rotatedRay);
    captureTriangle(allGeometry, triangle, rotatedTriangle);

    origin = Point3d.create(5, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2])!;
    expectedIntersectionPoint = Point3d.create(5, 0, 0);
    if (ck.testDefined(intersectionPoint)) {
      ck.testPoint3d(
        intersectionPoint, expectedIntersectionPoint, "ray intersects triangle on a triangle edge",
      );
    }
    ray.cloneTransformed(rotationTransform, rotatedRay);
    triangle.cloneTransformed(rotationTransform, rotatedTriangle);
    rotatedIntersectionPoint = rotatedRay.intersectionWithTriangle(
      rotatedTriangle.points[0], rotatedTriangle.points[1], rotatedTriangle.points[2],
    );
    rotatedOriginalIntersectionPoint = rotationMatrix.multiplyPoint(intersectionPoint);
    if (ck.testDefined(rotatedIntersectionPoint)) {
      ck.testPoint3d(
        rotatedOriginalIntersectionPoint,
        rotatedIntersectionPoint,
        "rotating original intersection points gives rotated intersection points",
      );
    }
    captureRay(allGeometry, ray, rotatedRay);

    origin = Point3d.create(5, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 2, 0, 0, 2, 10, 0);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(
      intersectionPoint,
      "expect no intersection when we have a degenerate triangle with two equal vertexes",
    );

    origin = Point3d.create(5, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 2, 0, 0, 2, 0, 0);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(
      intersectionPoint,
      "expect no intersection when we have a degenerate triangle with three equal vertexes",
    );

    origin = Point3d.create(0, 0, 0);
    direction = Vector3d.create(1, 1, 0);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 10, 0, 0, 2, 10, 0);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(intersectionPoint, "expect no intersection when ray and triangle are co-planer");
    captureRay(allGeometry, ray, rotatedRay);

    origin = Point3d.create(0, 0, 1);
    direction = Vector3d.create(1, 1, 0);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(intersectionPoint, "expect no intersection when ray and triangle are parallel");
    captureRay(allGeometry, ray, rotatedRay);

    origin = Point3d.create(0, 0, 0);
    direction = Vector3d.create(0, 0, 0);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(intersectionPoint, "expect no intersection when ray direction is (0,0,0)");

    origin = Point3d.create(10, 0, 0);
    direction = Vector3d.create(1, 1, 1);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(intersectionPoint, "expect no intersection when ray intersects triangle at ray origin");
    captureRay(allGeometry, ray, rotatedRay);

    origin = Point3d.create(5, 5, 5);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = ray.intersectionWithTriangle(triangle.points[0], triangle.points[1], triangle.points[2]);
    ck.testUndefined(intersectionPoint, "ray intersects triangle behind the ray origin");
    captureRay(allGeometry, ray, rotatedRay);

    GeometryCoreTestIO.saveGeometry(allGeometry, "Ray3d", "IntersectionWithTriangleAccuracy");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("Ray3d.IntersectionWithTriangleAccuracyAndPerformanceTests", () => {
    if (!GeometryCoreTestIO.enableLongTests) {
      return;
    }
    const ck = new Checker();

    const N = 50; // N*N is the number of rays and the number of triangles
    const origins: Point3d[] = [];
    const directions: Vector3d[] = [];
    for (let i = 0; i < N; i++) {
      origins.push(Point3d.create(getRandomNumber(), getRandomNumber(), getRandomNumber()));
      directions.push(Vector3d.create(getRandomNumber(), getRandomNumber(), getRandomNumber()));
    }
    // create N*N rays
    const rays: Ray3d[] = [];
    for (const origin of origins) {
      for (const direction of directions) {
        rays.push(Ray3d.create(origin, direction));
      }
    }
    // create N*N triangles
    const triangles: BarycentricTriangle[] = [];
    for (let i = 0; i < N * N; i++) {
      triangles.push(
        BarycentricTriangle.createXYZXYZXYZ(
          getRandomNumber(), getRandomNumber(), getRandomNumber(),
          getRandomNumber(), getRandomNumber(), getRandomNumber(),
          getRandomNumber(), getRandomNumber(), getRandomNumber(),
        ),
      );
    }
    const intersectionPoints1: Point3d[] = [];
    const intersectionPoints2: Point3d[] = [];
    let intersectionPoint1: Point3d | undefined;
    let intersectionPoint2: TriangleLocationDetail | undefined;
    let timeByRay3d: number = 0;
    let timeByBarycentricTriangle: number = 0;
    let startTime: number;
    let endTime: number;

    for (const ray of rays) {
      for (const triangle of triangles) {
        // shoot ray at triangle using Ray3d class
        startTime = performance.now();
        intersectionPoint1 = ray.intersectionWithTriangle(
          triangle.points[0], triangle.points[1], triangle.points[2],
        );
        endTime = performance.now();
        timeByRay3d = timeByRay3d + endTime - startTime;
        if (intersectionPoint1 !== undefined) {
          intersectionPoints1.push(intersectionPoint1);
        }
        // shoot ray at triangle using BarycentricTriangle class
        startTime = performance.now();
        intersectionPoint2 = triangle.intersectRay3d(ray);
        endTime = performance.now();
        timeByBarycentricTriangle = timeByBarycentricTriangle + endTime - startTime;
        if (intersectionPoint2.isInsideOrOn && intersectionPoint2.a >= 0) { // ray intersection not just line intersection
          intersectionPoints2.push(intersectionPoint2.world);
        }
      }
    }
    if (!ck.testExactNumber(
      intersectionPoints1.length,
      intersectionPoints2.length,
      "Ray3d and BarycentricTriangle classes return same number of intersection points",
    )) {
      expect(ck.getNumErrors()).toBe(0);
    }
    GeometryCoreTestIO.consoleLog(
      `${intersectionPoints1.length} intersection happened out of ${rays.length * triangles.length} shoots`,
    );
    for (let i = 0; i < intersectionPoints1.length; i++) {
      if (!ck.testPoint3d(
        intersectionPoints1[i],
        intersectionPoints2[i],
        "intersection points calculated by Ray3d and BarycentricTriangle classes are equal",
      )) {
        expect(ck.getNumErrors()).toBe(0);
      }
    }
    GeometryCoreTestIO.consoleLog(`Calls to Ray3d.intersectionWithTriangle (fast method) took ${timeByRay3d} milliseconds`);
    GeometryCoreTestIO.consoleLog(`Calls to BarycentricTriangle.intersectRay3d (slow method) took ${timeByBarycentricTriangle} milliseconds`);

    // intersection under rotation
    const rotatedRay = Ray3d.createZero();
    const rotatedTriangle = BarycentricTriangle.create(new Point3d(0, 0, 0), new Point3d(0, 0, 0), new Point3d(0, 0, 0));
    const rotatedIntersectionPoints: Point3d[] = [];
    let rotatedIntersectionPoint: Point3d | undefined; // rotate ray and triangle and then find intersection
    let rotatedOriginalIntersectionPoint = Point3d.createZero(); // find intersection and then rotate the intersection
    let rotationMatrix: Matrix3d;
    const angle: Angle = Angle.createDegrees(getRandomNumber());
    const rotationAxis: Vector3d = Vector3d.create(getRandomNumber(), getRandomNumber(), getRandomNumber());
    if (!rotationAxis.magnitude()) {
      rotationMatrix = Matrix3d.identity;
    } else {
      rotationMatrix = Matrix3d.createRotationAroundVector(rotationAxis, angle)!;
    }
    const rotationTransform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0), rotationMatrix);

    for (const ray of rays) {
      for (const triangle of triangles) {
        ray.cloneTransformed(rotationTransform, rotatedRay);
        triangle.cloneTransformed(rotationTransform, rotatedTriangle);
        // shoot rotated ray at rotated triangle
        rotatedIntersectionPoint = rotatedRay.intersectionWithTriangle(
          rotatedTriangle.points[0], rotatedTriangle.points[1], rotatedTriangle.points[2],
        );
        if (rotatedIntersectionPoint !== undefined) {
          rotatedIntersectionPoints.push(rotatedIntersectionPoint);
        }
      }
    }
    if (!ck.testExactNumber(
      intersectionPoints1.length,
      rotatedIntersectionPoints.length,
      "original and rotated shots return same number of intersection points",
    )) {
      expect(ck.getNumErrors()).toBe(0);
    }
    for (let i = 0; i < intersectionPoints1.length; i++) {
      rotatedOriginalIntersectionPoint = rotationMatrix.multiplyPoint(intersectionPoints1[i]);
      if (!ck.testPoint3d(
        rotatedOriginalIntersectionPoint,
        rotatedIntersectionPoints[i],
        "rotating original intersection points gives rotated intersection points",
      )) {
        expect(ck.getNumErrors()).toBe(0);
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });
});
