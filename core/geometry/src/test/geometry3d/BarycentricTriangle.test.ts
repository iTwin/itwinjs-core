/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry, PolygonLocation } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { BarycentricTriangle, TriangleLocationDetail } from "../../geometry3d/BarycentricTriangle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// cspell:word subtriangle
function verifyTriangle(ck: Checker, triangle: BarycentricTriangle) {
  const centroid = triangle.centroid();
  const centroid1 = triangle.fractionToPoint(1 / 3, 1 / 3, 1 / 3);
  ck.testPoint3d(centroid, centroid1, "Variant centroid evaluations");
  ck.testPoint3d(triangle.points[0], triangle.fractionToPoint(1, 0, 0));
  ck.testPoint3d(triangle.points[1], triangle.fractionToPoint(0, 1, 0));
  ck.testPoint3d(triangle.points[2], triangle.fractionToPoint(0, 0, 1));
  const subTriangle0 = BarycentricTriangle.create(centroid, triangle.points[1], triangle.points[2]);
  const subTriangle1 = BarycentricTriangle.create(centroid, triangle.points[2], triangle.points[0]);
  const subTriangle2 = BarycentricTriangle.create(centroid, triangle.points[0], triangle.points[1]);
  ck.testTrue(subTriangle0.aspectRatio < triangle.aspectRatio, "subtriangle aspect ratio smaller than full");
  ck.testCoordinate(
    triangle.area,
    subTriangle0.area + subTriangle1.area + subTriangle2.area,
    "subtriangle areas add to total",
  );

  const cloneA = triangle.clone();
  const cloneB = BarycentricTriangle.create(triangle.points[0], triangle.points[1], triangle.points[2]);
  const cloneC = cloneB.clone();
  const transform = Transform.createFixedPointAndMatrix(
    Point3d.create(-1, 0.4, 0.2),
    Matrix3d.createRotationAroundVector(Vector3d.create(0.2, 3.1, -0.3),
      Angle.createDegrees(22))!,
  );
  transform.multiplyPoint3dArray(cloneB.points, cloneB.points);

  cloneC.setFrom(cloneB);
  ck.testTrue(cloneC.isAlmostEqual(cloneB));

  ck.testTrue(cloneA.isAlmostEqual(triangle), "clone equal");
  ck.testFalse(cloneB.isAlmostEqual(triangle), "clone equal");
  BarycentricTriangle.create(cloneA.points[0], cloneA.points[1], cloneA.points[2], cloneB);
  ck.testTrue(cloneB.isAlmostEqual(triangle), "set equal");

  const a = 2.0;
  const x0 = 1.0;
  const y0 = 1;
  const z = 2.0;
  const cloneC1 = BarycentricTriangle.createXYZXYZXYZ(
    x0, y0, z,
    x0 + 2 * a, y0, z,
    x0 + a, y0 + a, z, cloneC);
  ck.testCoordinate(a * a, cloneC1.area);
  ck.testTrue(cloneC === cloneC1, "create into result");
  // clone with reversed
  const cloneC1Reverse = BarycentricTriangle.create(cloneC1.points[0], cloneC1.points[2], cloneC1.points[1]);
  const dotSelf = cloneC1Reverse.dotProductOfCrossProductsFromOrigin(cloneC1Reverse);
  const dotReverse = cloneC1.dotProductOfCrossProductsFromOrigin(cloneC1Reverse);
  ck.testCoordinate(dotSelf, -dotReverse, "reversed triangle dots.");

}

describe("BarycentricTriangle", () => {
  it("BarycentricTriangle.Create", () => {
    const ck = new Checker();
    verifyTriangle(ck, BarycentricTriangle.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0));
    verifyTriangle(ck, BarycentricTriangle.createXYZXYZXYZ(1, 4, 2, 7, -2, 1.5, 2.2, 9.0, 10));
    ck.checkpoint("BarycentricTriangle.Create");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BarycentricTriangle.ClosestPoint", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const vertices: Point3d[] = [Point3d.create(-3, 0, 0), Point3d.create(6, 0, 0), Point3d.create(0, 2, 0)];
    const triangle = BarycentricTriangle.create(vertices[0], vertices[1], vertices[2]);

    // coverage for triangle intrinsic queries
    const incenter = triangle.incenter();
    ck.testTrue(PolygonOps.isConvex(vertices), "triangle returns true for isConvex");
    ck.testTrue(PolygonOps.isConvex([...vertices, vertices[0]]), "triangle with closure point returns true for isConvex");
    ck.testFalse(PolygonOps.isConvex([vertices[0], vertices[1]]), "isConvex returns false for degenerate triangle");
    ck.testFalse(
      PolygonOps.isConvex([vertices[0], vertices[1], vertices[1]]), "isConvex returns false for degenerate triangle",
    );
    ck.testFalse(PolygonOps.isConvex([...vertices, incenter]), "isConvex returns false on chevron");
    ck.testCoordinate(Math.sqrt(13) + Math.sqrt(40) + 9, triangle.perimeter, "perimeter as expected");
    ck.testCoordinate(9, triangle.area, "area as expected");
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(...vertices, vertices[0]));

    // intersectSegment coverage
    const centroid = triangle.centroid();
    const loc1 = triangle.intersectSegment(
      Point3d.create(centroid.x, centroid.y, -10), Point3d.create(centroid.x, centroid.y, 10),
    );
    ck.testTrue(loc1.isValid, "found intersection of segment");
    ck.testPoint3d(centroid, loc1.world, "expected world coords of intersection");
    ck.testPoint3d(Point3d.create(1 / 3, 1 / 3, 1 / 3), loc1.local, "expected barycentric coords of intersection");
    ck.testCoordinate(0.5, loc1.a, "expected segment parameter of intersection");
    ck.testFalse(
      triangle.intersectSegment(
        centroid,
        Point3d.create(centroid.x + 10, centroid.y, centroid.z),
      ).isValid,
      "parallel segment intersection is invalid",
    );

    // degenerate input coverage
    ck.testFalse(
      BarycentricTriangle.create(
        vertices[0], vertices[1], vertices[1],
      ).pointToFraction(incenter).isValid,
      "invert pt on degenerate triangle",
    );
    ck.testFalse(PolygonOps.closestPointOnBoundary([], incenter).isValid, "0-pt 'polygon' closest point is invalid");
    let loc0 = PolygonOps.closestPointOnBoundary([vertices[0]], incenter);
    ck.testTrue(
      loc0.isValid &&
      loc0.point.isAlmostEqualMetric(vertices[0]) &&
      loc0.code === PolygonLocation.OnPolygonVertex &&
      loc0.closestEdgeIndex === 0 &&
      loc0.closestEdgeParam === 0.0,
      "1-pt 'polygon' closest point is valid",
    );
    ck.testTrue(
      PolygonOps.closestPointOnBoundary([vertices[0], vertices[1]], incenter).isValid,
      "2-pt 'polygon' closest point is invalid",
    );
    loc0 = PolygonOps.closestPointOnBoundary([vertices[0], vertices[1], vertices[1], vertices[2], vertices[2]], incenter);
    ck.testTrue(loc0.isValid, "closest point with degenerate edge");

    // some special barycentric triples
    const specialPoints: Point3d[] = [];
    const barycentricInsideOn: [TriangleLocationDetail, boolean][] = [
      [triangle.pointToFraction(centroid)!, true],
      [triangle.pointToFraction(incenter)!, true],
      [triangle.pointToFraction(triangle.circumcenter())!, false],
    ];
    for (const specialPt of barycentricInsideOn) {
      ck.testBoolean(specialPt[0].isInsideOrOn, specialPt[1], "special point containment");
      ck.testExactNumber(
        specialPt[0].classify, specialPt[1] ?
        PolygonLocation.InsidePolygonProjectsToEdgeInterior :
        PolygonLocation.OutsidePolygonProjectsToEdgeInterior,
        "special point classification",
      );
      ck.testPoint3d(
        specialPt[0].world,
        triangle.fractionToPoint(specialPt[0].local.x, specialPt[0].local.y, specialPt[0].local.z),
        "recover special pt from barycentric",
      );
      ck.testPoint3d(
        specialPt[0].local,
        triangle.pointToFraction(specialPt[0].world).local,
        "recover barycentric from special pt",
      );
      specialPoints.push(specialPt[0].local);
    }

    // create a circle at origin of points surrounding the triangle
    const circlePoints: Point3d[] = [];
    const numCirclePoints = 200;
    const angleDelta = 2 * Math.PI / numCirclePoints;
    const diag = Range3d.create(...vertices, Point3d.createZero()).diagonal().magnitude();
    for (let i = 0; i < numCirclePoints; ++i) {
      const angle = i * angleDelta;
      const xyz = Point3d.create(diag * Math.cos(angle), diag * Math.sin(angle));
      const loc = triangle.pointToFraction(xyz);
      if (
        ck.testPoint3d(xyz, loc.world, "circle pt is in plane") &&
        ck.testPoint3d(
          xyz, triangle.fractionToPoint(loc.local.x, loc.local.y, loc.local.z), "recover circle pt from barycentric",
        )
      )
        circlePoints.push(loc.local);
    }

    // test closest point to triangle from some barycentric locations
    for (const b of [
      Point3d.create(0.2, 0.5, 0.3), Point3d.create(0.5, 0.1, 0.4),  // inside triangle
      Point3d.create(1, 0, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 1), // at vertices
      Point3d.create(0, 0.4, 0.6), Point3d.create(0.2, 0, 0.8), Point3d.create(0.3, 0.7, 0), // inside edges
      Point3d.create(0, -4, 5), Point3d.create(0, -0.5, 1.5), Point3d.create(0, 1.5, -0.5), Point3d.create(0, 5, -4), // on extended edge 0
      Point3d.create(-4, 0, 5), Point3d.create(-0.5, 0, 1.5), Point3d.create(1.5, 0, -0.5), Point3d.create(5, 0, -4), // on extended edge 1
      Point3d.create(-4, 5, 0), Point3d.create(-0.5, 1.5, 0), Point3d.create(1.5, -0.5, 0), Point3d.create(5, -4, 0), // on extended edge 2
      ...specialPoints,
      ...circlePoints,
    ]) {
      const pt = triangle.fractionToPoint(b.x, b.y, b.z);
      const data = triangle.closestPoint(b.x, b.y, b.z);
      ck.testTrue(data.closestEdgeIndex >= 0, "found projection");
      const proj = vertices[data.closestEdgeIndex].interpolate(
        data.closestEdgeParam, vertices[Geometry.cyclic3dAxis(data.closestEdgeIndex + 1)],
      );
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pt, proj));
      // verify that the projection of a point already on a bounded edge or
      // vertex of T preserves its barycentric coordinates
      for (let i = 0; i < 3; ++i) {
        if (b.at(i) === 0) {
          const j = Geometry.cyclic3dAxis(i + 1);
          if (b.at(j) === 0) { // at vertex
            ck.testExactNumber(triangle.pointToFraction(pt).classify, PolygonLocation.OnPolygonVertex, "vertex classify");
            const k = Geometry.cyclic3dAxis(j + 1);
            ck.testExactNumber(k, data.closestEdgeIndex, "vertex hit has expected edge index");
            ck.testExactNumber(0.0, data.closestEdgeParam, "vertex hit has expected edge param");
          } else if (b.at(j) > 0.0 && b.at(j) < 1.0) { // inside edge
            ck.testExactNumber(
              triangle.pointToFraction(pt).classify, PolygonLocation.OnPolygonEdgeInterior, "edge classify",
            );
            ck.testExactNumber(j, data.closestEdgeIndex, "edge hit has expected edge index");
            ck.testExactNumber(1 - b.at(j), data.closestEdgeParam, "edge hit has expected edge param");
          }
        }
      }
      // compare PolygonOps v. BarycentricTriangle closest point
      const loc = PolygonOps.closestPointOnBoundary(vertices, pt);
      if (!triangle.incenter().isAlmostEqual(pt)) { // incenter is equidistant from edges, so it may project to any edge!
        ck.testExactNumber(data.closestEdgeIndex, loc.closestEdgeIndex, "closest edge index same in both algorithms");
        ck.testCoordinate(data.closestEdgeParam, loc.closestEdgeParam, "closest edge param same in both algorithms");
      }
      // compare PolygonOps v. BarycentricTriangle barycentric coords
      const b2 = PolygonOps.convexBarycentricCoordinates(vertices, pt);
      ck.testBoolean(
        undefined !== b2, BarycentricTriangle.isInsideOrOnTriangle(b.x, b.y, b.z),
        "found convex barycentric coords iff point inside triangle",
      );
      if (undefined !== b2) {
        ck.testCoordinate(b.x, b2[0], "convex barycentric x equals BarycentricTriangle x");
        ck.testCoordinate(b.y, b2[1], "convex barycentric x equals BarycentricTriangle x");
        ck.testCoordinate(b.z, b2[2], "convex barycentric x equals BarycentricTriangle x");
        ck.testCoordinateWithToleranceFactor(
          1.0, b.x + b.y + b.z, Geometry.smallFraction, "test barycentric coords sum to 1",
        );
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BarycentricTriangle", "closestPoint");
    expect(ck.getNumErrors()).equals(0);
  });
});

/** Return a random number between -100 and 100 */
function getRandomNumber() {
  return 200 * Math.random() - 100;
}

describe("BarycentricTriangle.intersectRay3d", () => {
  it("BarycentricTriangle.intersectRay3d", () => {
    const ck = new Checker();
    let origin: Point3d;
    let direction: Vector3d;
    let ray: Ray3d;
    let triangle: BarycentricTriangle;
    let intersectionPoint: TriangleLocationDetail;
    let expectedIntersectionPoint: Point3d | undefined;

    const rotatedRay = Ray3d.createZero();
    const rotatedTriangle = BarycentricTriangle.create(new Point3d(0, 0, 0), new Point3d(0, 0, 0), new Point3d(0, 0, 0));
    let rotatedIntersectionPoint: TriangleLocationDetail; // rotate ray and triangle and then find intersection
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

    origin = Point3d.create(2, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 10, 0, 0, 2, 10, 0);
    intersectionPoint = triangle.intersectRay3d(ray);
    expectedIntersectionPoint = Point3d.create(2, 0, 0);
    if (ck.testBoolean(intersectionPoint.isValid, true)) {
      ck.testPoint3d(
        intersectionPoint.world, expectedIntersectionPoint, "ray intersects triangle at a triangle vertex",
      );
    }
    ray.cloneTransformed(rotationTransform, rotatedRay);
    triangle.cloneTransformed(rotationTransform, rotatedTriangle);
    rotatedIntersectionPoint = rotatedTriangle.intersectRay3d(rotatedRay);
    rotatedOriginalIntersectionPoint = rotationMatrix.multiplyPoint(intersectionPoint.world);
    if (ck.testBoolean(rotatedIntersectionPoint.isValid, true)) {
      ck.testPoint3d(
        rotatedOriginalIntersectionPoint,
        rotatedIntersectionPoint.world,
        "rotating original intersection points gives rotated intersection points",
      );
    }

    origin = Point3d.create(5, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = triangle.intersectRay3d(ray);
    expectedIntersectionPoint = Point3d.create(5, 0, 0);
    if (ck.testBoolean(intersectionPoint.isValid, true)) {
      ck.testPoint3d(
        intersectionPoint.world, expectedIntersectionPoint, "ray intersects triangle on a triangle edge",
      );
    }
    ray.cloneTransformed(rotationTransform, rotatedRay);
    triangle.cloneTransformed(rotationTransform, rotatedTriangle);
    rotatedIntersectionPoint = rotatedTriangle.intersectRay3d(rotatedRay);
    rotatedOriginalIntersectionPoint = rotationMatrix.multiplyPoint(intersectionPoint.world);
    if (ck.testBoolean(rotatedIntersectionPoint.isValid, true)) {
      ck.testPoint3d(
        rotatedOriginalIntersectionPoint,
        rotatedIntersectionPoint.world,
        "rotating original intersection points gives rotated intersection points",
      );
    }

    origin = Point3d.create(5, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 2, 0, 0, 2, 10, 0);
    intersectionPoint = triangle.intersectRay3d(ray);
    expectedIntersectionPoint = Point3d.create(5, 0, 0);
    ck.testBoolean(
      intersectionPoint.isValid,
      false,
      "expect no intersection when we have a degenerate triangle with two equal vertexes",
    );

    origin = Point3d.create(5, 0, -2);
    direction = Vector3d.create(0, 0, 1);
    ray = Ray3d.create(origin, direction);
    triangle = BarycentricTriangle.createXYZXYZXYZ(2, 0, 0, 2, 0, 0, 2, 0, 0);
    intersectionPoint = triangle.intersectRay3d(ray);
    expectedIntersectionPoint = Point3d.create(5, 0, 0);
    ck.testBoolean(
      intersectionPoint.isValid,
      false,
      "expect no intersection when we have a degenerate triangle with three equal vertexes",
    );

    origin = Point3d.create(0, 0, 0);
    direction = Vector3d.create(1, 1, 0);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = triangle.intersectRay3d(ray);
    ck.testBoolean(intersectionPoint.isValid, false, "expect no intersection when ray and triangle are co-planer");

    origin = Point3d.create(0, 0, 1);
    direction = Vector3d.create(1, 1, 0);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = triangle.intersectRay3d(ray);
    ck.testBoolean(intersectionPoint.isValid, false, "expect no intersection when ray and triangle are parallel");

    origin = Point3d.create(0, 0, 0);
    direction = Vector3d.create(0, 0, 0);
    ray = Ray3d.create(origin, direction);
    intersectionPoint = triangle.intersectRay3d(ray);
    ck.testBoolean(intersectionPoint.isValid, false, "expect no intersection when ray direction is (0,0,0)");

    expect(ck.getNumErrors()).equals(0);
  });
});
