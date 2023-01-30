/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { BarycentricTriangle } from "../../geometry3d/BarycentricTriangle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */
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
  ck.testCoordinate(triangle.area, subTriangle0.area + subTriangle1.area + subTriangle2.area, "subtriangle areas add to total");

  const cloneA = triangle.clone();
  const cloneB = BarycentricTriangle.create(triangle.points[0], triangle.points[1], triangle.points[2]);
  const cloneC = cloneB.clone();
  const transform = Transform.createFixedPointAndMatrix(Point3d.create(-1, 0.4, 0.2), Matrix3d.createRotationAroundVector(Vector3d.create(0.2, 3.1, -0.3), Angle.createDegrees(22))!);
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
  it("Create", () => {
    const ck = new Checker();
    verifyTriangle(ck, BarycentricTriangle.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0));
    verifyTriangle(ck, BarycentricTriangle.createXYZXYZXYZ(1, 4, 2, 7, -2, 1.5, 2.2, 9.0, 10));
    ck.checkpoint("BarycentricTriangle.Create");
    expect(ck.getNumErrors()).equals(0);
  });

  it("closestPoint", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const vertices: Point3d[] = [Point3d.create(-3,0,0), Point3d.create(6,0,0), Point3d.create(0,2,0)];
    const triangle = BarycentricTriangle.create(vertices[0], vertices[1], vertices[2]);
    ck.testCoordinate(Math.sqrt(13) + Math.sqrt(40) + 9, triangle.perimeter, "perimeter as expected");
    ck.testCoordinate(9, triangle.area, "area as expected");
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(...vertices, vertices[0]));

    // some special barycentric triples
    const specialPoints: Point3d[] = [triangle.pointToFraction(triangle.centroid()).local,
                                      triangle.pointToFraction(triangle.incenter()).local,
                                      triangle.pointToFraction(triangle.circumcenter()).local];
    // create a circle at origin of points surrounding the triangle
    const circlePoints: Point3d[] = [];
    const numCirclePoints = 200;
    const angleDelta = 2 * Math.PI / numCirclePoints;
    const diag = Range3d.create(...vertices, Point3d.createZero()).diagonal().magnitude();
    for (let i = 0; i < numCirclePoints; ++i) {
      const angle = i * angleDelta;
      const xyz = Point3d.create(diag * Math.cos(angle), diag * Math.sin(angle));
      circlePoints.push(triangle.pointToFraction(xyz).local);
    }
    for (const b of [Point3d.create(0.2,0.5,0.3), Point3d.create(0.5,0.1,0.4),  // inside triangle
                     Point3d.create(1,0,0), Point3d.create(0,1,0), Point3d.create(0,0,1), // at vertices
                     Point3d.create(0,0.4,0.6), Point3d.create(0.2,0,0.8), Point3d.create(0.3,0.7,0), // inside edges
                     Point3d.create(0,-4,5), Point3d.create(0,-0.5,1.5), Point3d.create(0,1.5,-0.5), Point3d.create(0,5,-4), // on extended edge 0
                     Point3d.create(-4,0,5), Point3d.create(-0.5,0,1.5), Point3d.create(1.5,0,-0.5), Point3d.create(5,0,-4), // on extended edge 1
                     Point3d.create(-4,5,0), Point3d.create(-0.5,1.5,0), Point3d.create(1.5,-0.5,0), Point3d.create(5,-4,0), // on extended edge 2
                     ...specialPoints,
                     ...circlePoints,
                    ]) {
      const data = triangle.closestPoint(b.x, b.y, b.z);
      if (ck.testTrue(data.closestEdgeIndex >= 0, "found projection")) {
        const pt = triangle.fractionToPoint(b.x, b.y, b.z);
        const proj = vertices[data.closestEdgeIndex].interpolate(data.closestEdgeParam, vertices[Geometry.cyclic3dAxis(data.closestEdgeIndex + 1)]);
        if (!pt.isAlmostEqualMetric(proj))
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pt, proj));
        // verify that the projection of a point already on a bounded edge or vertex of T preserves its barycentric coordinates
        for (let i = 0; i < 3; ++i) {
          if (b.at(i) === 0) {
            const j = Geometry.cyclic3dAxis(i + 1);
            if (b.at(j) === 0) { // at vertex
              const k = Geometry.cyclic3dAxis(j + 1);
              ck.testExactNumber(k, data.closestEdgeIndex);
              ck.testExactNumber(0.0, data.closestEdgeParam);
            } else if (b.at(j) > 0.0 && b.at(j) < 1.0 ) { // inside edge
              ck.testExactNumber(j, data.closestEdgeIndex);
              ck.testExactNumber(1 - b.at(j), data.closestEdgeParam);
            }
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BarycentricTriangle", "closestPoint");
    expect(ck.getNumErrors()).equals(0);
  });
});
