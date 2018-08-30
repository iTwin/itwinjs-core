/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "./Checker";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { Angle, AngleSweep, Geometry } from "../Geometry";
import { Segment1d, Point3d, Vector3d } from "../PointVector";
import { Range1d } from "../Range";
import { Range3d } from "../Range";
import { Matrix3d } from "../Transform";
import { Transform } from "../Transform";
import { PolygonOps } from "../PointHelpers";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Arc3d } from "../curve/Arc3d";
import { LineString3d } from "../curve/LineString3d";
import { CurvePrimitive, GeometryQuery, AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { ClipPlaneContainment, Clipper, ClipUtilities } from "../clipping/ClipUtils";
import { ClipPlane } from "../clipping/ClipPlane";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "../clipping/UnionOfConvexClipPlaneSets";
import { Sample } from "../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "./IModelJson.test";
/* tslint:disable:no-console no-trailing-whitespace */

Checker.noisy.clipPlane = false;

function testConvexClipXY(x0: number, y0: number, ux: number, uy: number, xyz: Point3d[], ck: Checker) {
  const plane0 = Plane3dByOriginAndUnitNormal.create(Point3d.create(x0, y0, 0.0), Vector3d.create(ux, uy, 0.0));
  const plane1 = Plane3dByOriginAndUnitNormal.create(Point3d.create(x0, y0, 0.0), Vector3d.create(-ux, -uy, 0.0));
  const clip0 = ClipPlane.createPlane(plane0!);
  const clip1 = ClipPlane.createPlane(plane1!);
  if (clip0 && clip1) {   // Since constructor could return undefined
    const xyz0: Point3d[] = xyz.slice(0);
    const xyz1: Point3d[] = xyz.slice(0);
    const normal: Vector3d = PolygonOps.areaNormal(xyz);
    const area = normal.magnitude();
    const work: Point3d[] = [];
    clip0.convexPolygonClipInPlace(xyz0, work);
    clip1.convexPolygonClipInPlace(xyz1, work);
    const normal0: Vector3d = PolygonOps.areaNormal(xyz0);
    const normal1: Vector3d = PolygonOps.areaNormal(xyz1);
    const area0 = normal0.magnitude();
    const area1 = normal1.magnitude();
    ck.testCoordinate(area, area0 + area1);
  }
}

describe("ClipPlane", () => {
  const ck = new Checker();

  // ---------------------------------------------------------------------------------------------------

  it("BoundedSegmentIntersection", () => {
    // XY plane with upward (+z) facing normal
    const clip = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, 1),
      Point3d.create(0, 0, 0), false, false);

    if (clip) { // Should never fail
      // Move segment through plane, testing fractional value each time
      for (let i = -6; i <= 10; i += 1) {
        const z0 = i;
        const z1 = i - 6;
        const retVal = clip.getBoundedSegmentSimpleIntersection(Point3d.create(0, 0, z0), Point3d.create(0, 0, z1));

        if (z0 * z1 <= 0 && retVal !== undefined) {
          // Test fraction
          if (Math.abs(z1) > Math.abs(z0)) {
            ck.testTrue(retVal < 0.5, "Fraction is before half-way point on segment");
          } else if (Math.abs(z0) > Math.abs(z1)) {
            ck.testTrue(retVal > 0.5, "Fraction is after half-way point on segment");
          } else {
            ck.testCoordinate(retVal, 0.5, "Fraction falls at center point of segment");
          }
        } else {
          ck.testUndefined(retVal, "bounded segment along normal does not pass through");
        }
      }
    }
    ck.checkpoint("BoundedSegmentIntersection");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("Offset", () => {
    // XY plane with upward (+z) facing normal
    const clip = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, 1),
      Point3d.create(0, 0, 0), false, false)!;
    const h0 = 5.0;
    const testPoint = Point3d.create(2, 3, h0);
    ck.testCoordinate(h0, clip.dotProductPlaneNormalPoint(testPoint));
    ck.testCoordinate(h0, clip.evaluatePoint(testPoint), "clip plane through origin");
    const dh = 1.5;
    clip.offsetDistance(dh);
    ck.testCoordinate(h0, clip.dotProductPlaneNormalPoint(testPoint));
    ck.testCoordinate(h0 - dh, clip.evaluatePoint(testPoint), "evaluate shifted plane");

    ck.checkpoint("Offset");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("LineClip", () => {
    const origin = Point3d.create(1, 2, 3);
    const inwardNormal = Vector3d.create(1, 2, 12); // "mostly" z direction
    inwardNormal.normalizeInPlace();
    const plane = Plane3dByOriginAndUnitNormal.create(origin, inwardNormal)!;
    const pointA = Point3d.create(4, 3, 100);
    const pointB = Point3d.create(2, 0, -57);
    const clipPlane = ClipPlane.createPlane(plane);
    ck.testCoordinate(clipPlane.evaluatePoint(pointA), plane.altitude(pointA));
    ck.testCoordinate(clipPlane.evaluatePoint(pointB), plane.altitude(pointB));
    // announced fractions are stricly increasing pair within what we send as start end fractions, so relation to ends is known ...
    clipPlane.announceClippedSegmentIntervals(0.2, 0.9, pointA, pointB,
      (f0: number, f1: number) => {
        const segmentPoint = pointA.interpolate((f0 + f1) * 0.5, pointB);
        ck.testTrue(clipPlane.isPointInside(segmentPoint));
        const point0 = pointA.interpolate(f0, pointB);
        const point1 = pointA.interpolate(f1, pointB);
        ck.testBoolean(clipPlane.isPointInside(pointA), clipPlane.isPointInside(pointA.interpolate(0.5, point0)));
        ck.testBoolean(clipPlane.isPointInside(pointB), clipPlane.isPointInside(point1.interpolate(0.5, pointB)));
      });

    ck.checkpoint("Offset");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("toFromJSON", () => {
    const point0 = Point3d.create(1, 2, 3);
    const inwardNormal = Vector3d.create(1, 2, 12); // "mostly" z direction
    inwardNormal.normalizeInPlace();
    const plane = Plane3dByOriginAndUnitNormal.create(point0, inwardNormal)!;
    const clipPlane = ClipPlane.createPlane(plane);
    const json = clipPlane.toJSON();
    const clipPlane1 = ClipPlane.fromJSON(json);
    ck.testTrue(clipPlane1 !== undefined && clipPlane.isAlmostEqual(clipPlane1));
    ck.checkpoint("Offset");
    expect(ck.getNumErrors()).equals(0);
  });
  // ---------------------------------------------------------------------------------------------------

  it("PolygonInOutCross", () => {
    let numExpectedCrossings = 0;
    let lastSign = -1;
    const array: Point3d[] = [
      Point3d.create(0, 0, -1),
    ];
    const clip = ClipPlane.createNormalAndDistance(Vector3d.create(0, 0, 1), 0, false, false);
    const crossings: Point3d[] = [];

    if (clip) { // Should never fail

      for (let i = 2; i < 15; i++) {
        let z: number;
        const rand = Math.random();
        const x = i * (5 + rand);
        let didCross = false;
        let toReduce = false;
        if (rand >= .5) { z = i; } else { z = -i; }
        if (z * lastSign < 0) { numExpectedCrossings++; didCross = true; }
        if (z * array[0].z < 0) { numExpectedCrossings++; toReduce = true; }

        lastSign = z;
        array.push(Point3d.create(x, 0, z));
        clip.polygonCrossings(array, crossings);
        if (Checker.noisy.clipPlane) {
          console.log("Points:");
          console.log(array);
          console.log("Expected crossings: " + numExpectedCrossings);
          console.log("Crossings:");
          console.log(crossings);
        }
        ck.testCoordinate(crossings.length, numExpectedCrossings, "Number of expected crossings and crossings array length match");

        if (didCross) {
          const m = (z - array[array.length - 2].z) / (x - array[array.length - 2].x);
          const b = z - m * x;
          const xCross = - b / m;
          ck.testCoordinate(xCross, crossings[crossings.length - 1].x, "Expected and actual x location of crossing match");
        } else {
          const subArray: Point3d[] = array.slice(array.length - 2);
          clip.polygonCrossings(subArray, crossings);
          ck.testCoordinate(crossings.length, 0, "Last two points did not cross plane");
        }

        if (toReduce) { numExpectedCrossings--; }
      }
    }
    ck.checkpoint("PolygonInOutCross");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("ConvexClipPlaneSet", () => {
  const ck = new Checker();

  it("ConvexPolygonClip", () => {
    const array: Point3d[][] = [
      [
        Point3d.create(0, 0, 0),
        Point3d.create(1, 0, 0),
        Point3d.create(1, 1, 0),
        Point3d.create(0, 1, 0),
      ],
      [
        Point3d.create(0.2, 0, 0),
        Point3d.create(1, -0.3, 0),
        Point3d.create(1, 1.2, 0),
      ],
    ];

    for (const polygon of array) {
      testConvexClipXY(0, 0.5, 0, 1, polygon, ck);
      testConvexClipXY(1, 0.5, 0, 1, polygon, ck);
      testConvexClipXY(0, 0.5, 1, 0, polygon, ck);
      testConvexClipXY(1, 0.5, 1, 0, polygon, ck);
      testConvexClipXY(0.5, 0.6, 0.3, 0.2, polygon, ck);
      testConvexClipXY(0, 2, 0, 1, polygon, ck);
      testConvexClipXY(0, -3, 0, 1, polygon, ck);

      testConvexClipXY(1, 1, 1, 1, polygon, ck);
      testConvexClipXY(1, 1, -1, 2, polygon, ck);
    }

    ck.checkpoint("ConvexClipPlaneSet");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("ClipPointsOnOrInside", () => {
    for (let i = -50; i < 50; i += 15) {
      const clip1 = ClipPlane.createPlane(Plane3dByOriginAndUnitNormal.create(Point3d.create(0, 0, 0), Vector3d.create(i, -i, i))!);
      const clip2 = ClipPlane.createPlane(Plane3dByOriginAndUnitNormal.create(Point3d.create(0, 0, 0), Vector3d.create(-i, i, -i))!);
      if (clip1 && clip2) {
        const set = ConvexClipPlaneSet.createPlanes([clip1, clip2]);
        // On, Inside, Outside, in that order
        const testPoints: Point3d[] = [Point3d.create(0, 0, 0), Point3d.create(1, 2, 1), Point3d.create(1, 1, 1)];
        const inOn: Point3d[] = [];
        const outside: Point3d[] = [];
        set.clipPointsOnOrInside(testPoints, inOn, outside);
        ck.testExactNumber(inOn.length, 2, "Two points were inside or on");
        // Check points by checking distinctive x value
        ck.testCoordinate(inOn[0].y, 0, "Origin lies on plane");
        ck.testCoordinate(inOn[1].y, 2, "Point lies inside");
        ck.testCoordinate(outside[0].y, 1, "Point lies outside");
      }
    }

    ck.checkpoint("IsPointOn&IsPointOnOrInside");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("ClipPlaneSet", () => {

  it("GetRayIntersections", () => {
    const ck = new Checker();
    const sideLength = 1;

    const convexSet0 = ConvexClipPlaneSet.createXYBox(0, 0, sideLength, sideLength);
    const clipZ0 = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, -sideLength), Point3d.create(0, 0, sideLength), false, false);
    const clipZ1 = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, sideLength), Point3d.create(0, 0, 0), false, false);
    if (clipZ0 && clipZ1) { // Should never fail
      convexSet0.addPlaneToConvexSet(clipZ0);
      convexSet0.addPlaneToConvexSet(clipZ1);
    }

    const set = UnionOfConvexClipPlaneSets.createConvexSets([convexSet0]);
    const json0 = convexSet0.toJSON();
    const convexSet1 = ConvexClipPlaneSet.fromJSON(json0);
    const convexSet2 = convexSet1.clone();
    ck.testTrue(convexSet1 !== undefined && convexSet0.isAlmostEqual(convexSet1), "ConvexClipPlaneSet json R/T");
    ck.testTrue(convexSet2 !== undefined && convexSet0.isAlmostEqual(convexSet2), "ConvexClipPlaneSet clone");

    const json1 = set.toJSON();
    const set1 = UnionOfConvexClipPlaneSets.fromJSON(json1);
    const set2 = set1.clone();
    ck.testTrue(set1 !== undefined && set.isAlmostEqual(set1), "ClipPlaneSet json R/T");
    ck.testTrue(set2 !== undefined && set.isAlmostEqual(set2), "ClipPlaneSet clone");

    const xyMiddleOfCube = sideLength / 2;

    // Ray origins below box, inside, and above box
    for (let i = -0.5; i < 2; i++) {
      // Rotate rays 360 degrees around x and y axis
      for (let theta = 0; theta < 2 * Math.PI; theta += (Math.PI / 4)) {
        const xAlignedOrigin = Point3d.create(xyMiddleOfCube, xyMiddleOfCube, i);
        const xAlignedDirection = Vector3d.create(Math.cos(theta), 0, Math.sin(theta));
        const yAlignedOrigin = Point3d.create(xyMiddleOfCube, xyMiddleOfCube, i);
        const yAlignedDirection = Vector3d.create(0, Math.cos(theta), Math.sin(theta));

        const xAlignedResult = set.getRayIntersection(xAlignedOrigin, xAlignedDirection);
        const yAlignedResult = set.getRayIntersection(yAlignedOrigin, yAlignedDirection);

        if (Checker.noisy.clipPlane === true) {
          console.log("Theta: " + (theta * 180 / Math.PI) + " degrees");
          console.log("X Aligned Ray intersects at: " + xAlignedResult);
          console.log("Y Aligned Ray intersects at: " + yAlignedResult);
        }

        if (xAlignedResult === undefined || yAlignedResult === undefined) {
          ck.testUndefined(yAlignedResult, "Ray intersections are undefined");
          ck.testFalse(set.testRayIntersect(xAlignedOrigin, xAlignedDirection));
          ck.testFalse(set.testRayIntersect(yAlignedOrigin, yAlignedDirection));
          continue;
        }

        ck.testCoordinate(xAlignedResult, yAlignedResult, "Intersections are equal for similar rays");
        ck.testTrue(set.testRayIntersect(xAlignedOrigin, xAlignedDirection));
        ck.testTrue(set.testRayIntersect(yAlignedOrigin, yAlignedDirection));

        if (i > -0.5 && i < 1) {
          // Ray began inside the region
          ck.testCoordinate(xAlignedResult, 0, "Distance is zero");
          continue;
        }

        // Check distances
        if (theta % (Math.PI / 2) !== 0) {
          // Dealing with an angle multiple of 45 degrees
          ck.testCoordinate(Math.abs(xAlignedResult), Math.sqrt(2 * xyMiddleOfCube * xyMiddleOfCube), "Distance of ray origin to intersection");
        } else {
          // Dealing with angle parallel to z-axis.. if negative, ensure you account for ray direction, which would have it intersect
          // the OPPOSITE side of the box
          if (xAlignedResult < 0)
            ck.testCoordinate(xAlignedResult, (sideLength + xyMiddleOfCube) * -1, "Distance of ray origin to intersection");
          else
            ck.testCoordinate(xAlignedResult, xyMiddleOfCube, "Distance of ray origin to intersection");
        }
      }
    }

    ck.checkpoint("GetRayIntersections");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("SweptPolygon", () => {
    const ck = new Checker();
    const convexSetA = ConvexClipPlaneSet.createEmpty();
    const convexSetB = ConvexClipPlaneSet.createEmpty();
    const convexSet0 = ConvexClipPlaneSet.createEmpty();
    const triangle: Point3d[] = [Point3d.create(1, 1, 1), Point3d.create(3, 1, 1), Point3d.create(2, 2, 1)];

    const edgePoint01 = triangle[0].interpolate(0.4, triangle[1]);
    const edgePoint12 = triangle[1].interpolate(0.4, triangle[2]);
    const linePointA = edgePoint01.interpolate(0.1, edgePoint12);  // a little inside along edge01
    const linePointB = edgePoint01.interpolate(0.5, edgePoint12);  // a little inside along edge01

    const sweepDirection = Vector3d.create(0, 0, 1);
    convexSetA.reloadSweptPolygon(triangle, sweepDirection, 1);
    convexSetB.reloadSweptPolygon(triangle, sweepDirection, -1);
    convexSet0.reloadSweptPolygon(triangle, sweepDirection, 0);
    convexSetA.clipUnboundedSegment(linePointA, linePointB,
      (fA: number, fB: number) => {
        ck.testPoint3d(edgePoint01, linePointA.interpolate(fA, linePointB), fA, "unboundedLine clip pointA");
        ck.testPoint3d(edgePoint12, linePointA.interpolate(fB, linePointB), fB, "unboundedLine clip pointB");
      });
    const tolerance = 1.0e-10;
    const values: number[] = [-0.5, 0.3, 0.5, 0.8, 1.1];
    for (const u of values) {
      for (const v of values) {
        const w = 1.0 - u - v;
        const inside = Geometry.isIn01(u) && Geometry.isIn01(v) && Geometry.isIn01(w);
        const planePoint = Point3d.create(
          // Written out rather than making combination of function calls
          triangle[0].x * u + triangle[1].x * v + triangle[2].x * w,
          triangle[0].y * u + triangle[1].y * v + triangle[2].y * w,
          triangle[0].z * u + triangle[1].z * v + triangle[2].z * w,
        );
        const abovePoint = planePoint.plus(sweepDirection);
        const belowPoint = planePoint.minus(sweepDirection);

        ck.testBoolean(inside, convexSetA.isPointOnOrInside(abovePoint, tolerance));
        ck.testFalse(convexSetA.isPointOnOrInside(belowPoint, tolerance));
        ck.testBoolean(inside, convexSetA.isPointOnOrInside(planePoint, tolerance));

        ck.testBoolean(inside, convexSetB.isPointOnOrInside(belowPoint, tolerance));
        ck.testFalse(convexSetB.isPointOnOrInside(abovePoint, tolerance));
        ck.testBoolean(inside, convexSetB.isPointOnOrInside(planePoint, tolerance));

        ck.testBoolean(inside, convexSet0.isPointOnOrInside(abovePoint, tolerance));
        ck.testBoolean(inside, convexSet0.isPointOnOrInside(belowPoint, tolerance));
        ck.testBoolean(inside, convexSet0.isPointOnOrInside(planePoint, tolerance));
      }
    }

    ck.checkpoint("SweptPolygon");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("SphereInside", () => {
    const ck = new Checker();
    const convexSet = ConvexClipPlaneSet.createXYBox(0, 0, 1, 1);
    const clipZ0 = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, 1), Point3d.create(0, 0, 0), false, false);
    const clipZ1 = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, -1), Point3d.create(0, 0, 1), false, false);
    if (clipZ0 && clipZ1) {  // Should never fail
      convexSet.addPlaneToConvexSet(clipZ0);
      convexSet.addPlaneToConvexSet(clipZ1);
    }
    const set = UnionOfConvexClipPlaneSets.createConvexSets([convexSet]);

    let origin0 = Point3d.create(0, 0, 2);
    const origin1 = Point3d.create(0.5, 0.5, 0.5);

    ck.testFalse(set.isSphereInside(origin0, 0.5));
    ck.testTrue(set.isSphereInside(origin0, 1));
    ck.testTrue(set.isSphereInside(origin0, 1.5));
    ck.testTrue(set.isSphereInside(origin1, 0.25));

    origin0 = Point3d.create(1500, 1500, 1500);
    const distanceToPlanes = origin0.x - 1;

    ck.testTrue(set.isSphereInside(origin0, distanceToPlanes));
    ck.testTrue(set.isSphereInside(origin0, distanceToPlanes + .0001));
    // NOTE: Originally was testing diagonally away from corner, but opposite of what
    // may be intuition, will still pass as long as sphere edge makes it passed planes
    // one at a time (part of sphere does not have to lie inside of the cube)
    ck.testFalse(set.isSphereInside(origin0, distanceToPlanes - .0001));

    ck.checkpoint("SphereInside");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("IntervalsFromSegment", () => {
    const ck = new Checker();
    const convexSet = ConvexClipPlaneSet.createXYBox(0, 0, 1, 1);
    const convexSet2 = ConvexClipPlaneSet.createXYBox(2, 0, 3, 1);
    const set = UnionOfConvexClipPlaneSets.createConvexSets([convexSet]);

    const intervals: Segment1d[] = [];

    // Edge cases
    set.appendIntervalsFromSegment(LineSegment3d.create(Point3d.create(0.5, -1, 0.5), Point3d.create(0.5, 0, 0.5)), intervals);
    ck.testExactNumber(intervals.length, 1, "Interval array length (edge case)");
    // In and out parts of segment should be the same, since the segment ends on the edge of the plane
    ck.testExactNumber(1, intervals[0].x0, "Interval edge case");
    intervals.length = 0;

    set.appendIntervalsFromSegment(LineSegment3d.create(Point3d.create(0.5, 1, 0.5), Point3d.create(0.5, 2, 0.5)), intervals);
    ck.testExactNumber(intervals.length, 1, "Interval array length (edge case)");
    // In and out parts of segment should be the same, since the segment ends on the edge of the plane
    ck.testExactNumber(0, intervals[0].x0, "Interval edge case");
    intervals.length = 0;

    // Pass through cases (Segment of length one crossing through the 1x1x1 box at increments of 0.1)
    for (let i = 0.0; i <= 2.0; i += 0.1) {
      set.appendIntervalsFromSegment(LineSegment3d.create(Point3d.create(0.5, i - 1, 0.5), Point3d.create(0.5, i, 0.5)), intervals);
      ck.testExactNumber(1, intervals.length, "Interval array length (pass through case)");
      ck.testCoordinate(1, intervals[0].x0 * 1 + (1 - intervals[0].x0) * 1, "Parts outside plus parts inside equal segment length");
      intervals.length = 0;
    }

    // Check segment that passes through two regions
    set.addConvexSet(convexSet2);
    set.appendIntervalsFromSegment(LineSegment3d.create(Point3d.create(0, 0.5, 0.5), Point3d.create(4, 0.5, 0.5)), intervals);
    ck.testExactNumber(2, intervals.length, "Segment should pass through 2 regions");
    ck.testCoordinate(0, intervals[0].x0, "Start interval of first region");
    ck.testCoordinate(.25, intervals[0].x1, "End interval of first region");
    ck.testCoordinate(.50, intervals[1].x0, "Start interval of second region");
    ck.testCoordinate(.75, intervals[1].x1, "End interval of second region");

    ck.checkpoint("IntervalsFromSegment");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("ClassifyPointContainment", () => {
    const ck = new Checker();
    const convexSet1 = ConvexClipPlaneSet.createXYBox(0, 0, 1, 1);
    const clipZ0 = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, 1), Point3d.create(0, 0, 0), false, true);
    const clipZ1 = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, -1), Point3d.create(0, 0, 1), false, true);
    if (clipZ0 && clipZ1) {  // Should never fail
      convexSet1.addPlaneToConvexSet(clipZ0);
      convexSet1.addPlaneToConvexSet(clipZ1);
    }
    const set = UnionOfConvexClipPlaneSets.createConvexSets([convexSet1]);

    // Simple check of a variety of point collections in R^3 space
    // 1.) One Region
    let array: Point3d[] = [
      Point3d.create(0.5, 0.5, 0.5),
      Point3d.create(0.75, 0.11, 0.43),
    ];

    ck.testExactNumber(set.classifyPointContainment(array, false), ClipPlaneContainment.StronglyInside, "All points inside one region");
    ck.testExactNumber(set.classifyPointContainment(array, true), ClipPlaneContainment.StronglyInside, "All points inside one region");
    array.push(Point3d.create(0, 0, 0));
    ck.testExactNumber(set.classifyPointContainment(array, true), ClipPlaneContainment.Ambiguous, "All points inside one region with exception of one on border");
    ck.testExactNumber(set.classifyPointContainment(array, false), ClipPlaneContainment.Ambiguous, "All points inside one region with exception of one on border");
    array.pop();
    array.push(Point3d.create(0.0000001, 0.0000001, 0.0000001));
    ck.testExactNumber(set.classifyPointContainment(array, true), ClipPlaneContainment.StronglyInside, "All points inside one region");

    // 2.) Completely Outside (one on border)
    array = [
      Point3d.create(0, -5, 10),
      Point3d.create(-1, -1, -1),
      Point3d.create(0, 0, 0),
    ];

    ck.testExactNumber(set.classifyPointContainment(array, false), ClipPlaneContainment.StronglyOutside, "All points outside except for one on border (not counting)");
    ck.testExactNumber(set.classifyPointContainment(array, true), ClipPlaneContainment.StronglyOutside, "All points outside except for one on border (not counting)");

    ck.checkpoint("ClassifyPointContainment");
    expect(ck.getNumErrors()).equals(0);
  });
});

function clipMovingCurve(
  clipper: Clipper,
  curve: CurvePrimitive,
  traceCurve: CurvePrimitive,
  numTrace: number,
  announceCurve: AnnounceNumberNumberCurvePrimitive) {
  for (let i = 0; i + 1 < numTrace; i++) {
    const shift = traceCurve.fractionToPoint(i / numTrace);
    const curve1 = curve.cloneTransformed(Transform.createTranslation(shift)) as CurvePrimitive;
    announceCurve(0, 0, curve1);
    const clip = ClipUtilities.collectClippedCurves(curve1, clipper);
    for (const curve2 of clip) announceCurve(1, i, curve2);
  }
}
describe("ClipPlaneUtilities", () => {
  it("announceNNC", () => {
    const ck = new Checker();
    let sum = 0.0;
    const intervals = new Array<Range1d>();
    const intervalSize = 3.0;
    for (const low of [1, 4, 9])
      intervals.push(Range1d.createXX(low, low + intervalSize));
    const cp = LineSegment3d.create(Point3d.create(1, 1, 2), Point3d.create(4, 2, 1));
    ClipUtilities.announceNNC(intervals, cp,
      (a: number, b: number, _cp: CurvePrimitive) => { sum += b - a; });

    ck.testExactNumber(intervalSize * intervals.length, sum, "summed data from announceNNC");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("CurveClips", () => {
  it("CurvePrimitiveClips", () => {
    const ck = new Checker(); expect(ck.getNumErrors()).equals(0);
    const traceCurve = Arc3d.createXY(Point3d.create(0, 0.2, 0), 1.0);
    const curves = Sample.createSmoothCurvePrimitives(2.0);
    const output: GeometryQuery[] = [];
    const outputShiftX = 10.0;
    const outputShiftY = 10.0;

    let xCount = 0;
    let clipper: Clipper;
    let clipLine: Point3d[];
    clipLine = Sample.createRectangle(-2, -1, 2, 1, 0, true);
    clipper = ConvexClipPlaneSet.createXYPolyLineInsideLeft(clipLine);

    for (const curve of curves) {
      const transform0 = Transform.createTranslationXYZ(xCount * outputShiftX, 0, 0);
      const transform1 = Transform.createTranslationXYZ(xCount * outputShiftX, outputShiftY, 0);
      xCount++;
      const clipGeometry = LineString3d.create(clipLine);
      clipGeometry.addClosurePoint();
      output.push(clipGeometry);
      output.push(clipGeometry.cloneTransformed(transform0)!);
      output.push(clipGeometry.cloneTransformed(transform1)!);
      clipMovingCurve(clipper, curve, traceCurve, 5,
        (group: number, _index: number, cp: CurvePrimitive) => {
          output.push(cp.cloneTransformed(group === 0 ? transform0 : transform1)!);
        });
    }
    GeometryCoreTestIO.saveGeometry(output, "ClipPlane", "CurvePrimitiveClips");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PlaneArcClips", () => {
    const ck = new Checker(); expect(ck.getNumErrors()).equals(0);
    const arc = Arc3d.createXY(Point3d.create(0, 0.2, 0), 2.0, AngleSweep.createStartEndDegrees(0, 270.0));

    const plane = ClipPlane.createEdgeXY(Point3d.create(3, 1, 0), Point3d.create(3, -10, 0))!;
    plane.announceClippedArcIntervals(arc,
      (fraction0: number, fraction1: number, _cp: CurvePrimitive) => {
        const point0 = arc.fractionToPoint(fraction0);
        const point1 = arc.fractionToPoint(Geometry.interpolate(fraction0, 0.5, fraction1));
        const point2 = arc.fractionToPoint(fraction1);

        ck.testTrue(plane.isPointOn(point0), "interval start point is ON");
        ck.testFalse(plane.isPointOn(point1), "interval midpoint is not ON");
        ck.testTrue(plane.isPointOnOrInside(point1), "interval midpoint is IN");
        ck.testTrue(plane.isPointOn(point2), "interval end point is ON");
      });
    ck.checkpoint("PlaneArcClips");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PlaneSetArcClips", () => {
    const ck = new Checker(); expect(ck.getNumErrors()).equals(0);
    const arc = Arc3d.createXYEllipse(Point3d.create(0, 0.2, 0), 3.0, 0.5, AngleSweep.createStartEndDegrees(0, 270.0));
    const pointA = Point3d.create(-1.5, 1);
    const pointB = Point3d.create(2, -0.5);
    const fractionAB0 = -0.2;
    const fractionAB1 = 0.68;
    const clippers = Sample.createClipPlaneSets();

    const transform = Transform.createFixedPointAndMatrix(
      Point3d.create(1, 0.5),
      Matrix3d.createRotationAroundVector(Vector3d.create(1, 1, 9), Angle.createDegrees(60))!);
    const arc1 = arc.clone();
    arc1.tryTransformInPlace(transform);
    for (const clipper of clippers) {

      const clipper1 = clipper.clone();
      clipper1.transformInPlace(transform);
      let activeClipper = clipper;

      const curvePrimitiveAnnouncer = (fraction0: number, fraction1: number, cp: CurvePrimitive) => {
        const point1 = cp.fractionToPoint(Geometry.interpolate(fraction0, 0.5, fraction1));
        ck.testTrue(activeClipper.isPointInside(point1), "interval midpoint is IN");
      };

      const segmentAnnouncer = (fraction0: number, fraction1: number) => {
        const fraction = Geometry.interpolate(fraction0, 0.3, fraction1);
        const point1 = pointA.interpolate(fraction, pointB);
        ck.testTrue(activeClipper.isPointInside(point1), "interval midpoint is IN");
      };

      clipper.announceClippedArcIntervals(arc, curvePrimitiveAnnouncer);
      clipper.announceClippedSegmentIntervals(fractionAB0, fractionAB1, pointA, pointB, segmentAnnouncer);

      activeClipper = clipper1;

      clipper1.announceClippedArcIntervals(arc1, curvePrimitiveAnnouncer);
      clipper1.announceClippedSegmentIntervals(fractionAB0, fractionAB1, pointA, pointB, segmentAnnouncer);
    }
    ck.checkpoint("PlaneSetArcClips");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PlaneSetConstructions", () => {
    const ck = new Checker();
    const rangeA = Range3d.createXYZXYZ(0, 0, 0, 4, 4, 4);
    const rangeB = Range3d.createXYZXYZ(5, 5, 5, 10, 10, 10);
    const convexA = ConvexClipPlaneSet.createRange3dPlanes(rangeA, false, true, false, true, false, true);
    ck.testTrue(convexA.isPointInside(rangeA.diagonalFractionToPoint(0.5)));
    ck.testTrue(convexA.isPointInside(rangeA.diagonalFractionToPoint(-0.5)));
    ck.testFalse(convexA.isPointInside(rangeA.diagonalFractionToPoint(1.5)));

    const convexB = ConvexClipPlaneSet.createRange3dPlanes(rangeB, true, false, true, false, true, false);
    ck.testTrue(convexB.isPointInside(rangeB.diagonalFractionToPoint(0.5)));
    ck.testFalse(convexB.isPointInside(rangeB.diagonalFractionToPoint(-0.5)));
    ck.testTrue(convexB.isPointInside(rangeB.diagonalFractionToPoint(1.5)));

    const disjoint = UnionOfConvexClipPlaneSets.createConvexSets([convexA, convexB]);
    ck.testTrue(disjoint.isPointInside(rangeA.diagonalFractionToPoint(0.5)));
    ck.testTrue(disjoint.isPointInside(rangeA.diagonalFractionToPoint(-0.5)));
    ck.testTrue(disjoint.isPointInside(rangeA.diagonalFractionToPoint(0.5)));
    ck.testTrue(disjoint.isPointInside(rangeA.diagonalFractionToPoint(1.5)));
    ck.testFalse(disjoint.isPointInside(rangeA.high.interpolate(0.5, rangeB.low)));
    ck.testFalse(disjoint.isPointInside(rangeA.high.interpolate(0.5, rangeB.low)));

    const positiveOctant = ConvexClipPlaneSet.createRange3dPlanes(rangeA, true, false, true, false, true, false);
    const negativeOctant = positiveOctant.clone();
    negativeOctant.negateAllPlanes();
    for (const data of [
      [1, 1, 1, true, false],
      [-1, -1, -1, false, true],
      [-1, 1, 1, false, false],
      [1, -1, 1, false, false],
      [-1, 1, -1, false, false],
      [-1, -1, 1, false, false],
      [-1, 1, -1, false, false],
      [-1, 1, -1, false, false]]) {
      const point = Point3d.create(data[0] as number, data[1] as number, data[2] as number);
      ck.testBoolean(data[3] as boolean, positiveOctant.isPointInside(point), "unbounded clip planes A");
      ck.testBoolean(data[4] as boolean, negativeOctant.isPointInside(point), "unbounded clip planes B");
    }

    ck.checkpoint("PlaneSetArcClips");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Negation", () => {
    const ck = new Checker();
    const origin = Point3d.create(2, 3, 4);
    const planeA = ClipPlane.createNormalAndPoint(Vector3d.unitX(), origin)!;
    const planeB = planeA.cloneNegated();
    ck.testTrue(planeA.isPointOn(origin), "origin on plane");
    ck.testTrue(planeB.isPointOn(origin), "origin on negated plane");
    for (const x of [-10.0, 10.0]) {  // These x values are big enough to be sure we get points far from origin.
      const point = Point3d.create(x, 5, 3);
      ck.testBoolean(planeA.isPointInside(point), !planeB.isPointInside(point), "negated plane isPointInside");
      ck.testFalse(planeA.isPointOn(point), "off-plane point test");
      ck.testFalse(planeB.isPointOn(point), "off-plane point test");
    }

    // touch setFlags ...
    planeA.setFlags(true, false);
    ck.checkpoint("Negation");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SinglePlaneCLip", () => {
    const ck = new Checker();
    const plane = ClipPlane.createNormalAndPoint(Vector3d.create(1, 0, 0), Point3d.create(1, 1, 0))!;
    const rectangle0 = [
      Point3d.create(-1, -1, 0),
      Point3d.create(10, - 1, 0),
      Point3d.create(10, 2, 0),
      Point3d.create(-1, 2, 0)];
    const splitA: Point3d[] = [];
    const splitB: Point3d[] = [];
    const altitudeRange = Range1d.createNull();
    plane.convexPolygonSplitInsideOutside(rectangle0, splitA, splitB, altitudeRange);
    const area0 = PolygonOps.sumTriangleAreas(rectangle0);
    const areaA = PolygonOps.sumTriangleAreas(splitA);
    const areaB = PolygonOps.sumTriangleAreas(splitB);
    ck.testCoordinate(area0, areaA + areaB);
    ck.checkpoint("SinglePlaneCLip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ConvexSetPolygonClip", () => {
    const ck = new Checker();
    const ax = 1;
    const ay = 2;
    const range = Range3d.createXYZXYZ(ax, ay, 3, 6, 7, 4);
    const convexA = ConvexClipPlaneSet.createRange3dPlanes(range, true, false, true, false, false)!;
    const bx = 4;
    const by = 8;
    const rectangle0 = [
      Point3d.create(-1, -1, 0),
      Point3d.create(bx, - 1, 0),
      Point3d.create(bx, by, 0),
      Point3d.create(-1, by, 0)];

    // const area0 = PolygonOps.sumTriangleAreas(rectangle0);
    const splitA: Point3d[] = [];
    const work: Point3d[] = [];
    convexA.polygonClip(rectangle0, splitA, work);
    const areaA = PolygonOps.sumTriangleAreas(splitA);

    ck.testCoordinate(areaA, (bx - ax) * (by - ay));
    ck.checkpoint("ConvexSetPolygonClip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SweptPolygon", () => {
    const ck = new Checker();
    const triangle0 = [
      Point3d.create(0, 0, 0),
      Point3d.create(1, 0, 0),
      Point3d.create(0, 1, 0),
      Point3d.create(0, 0, 0)];
    const area0 = PolygonOps.sumTriangleAreas(triangle0);
    const rectangle0 = Sample.createRectangle(-2, -1, 2, 2, 0, false);
    // const rectangle1 = Sample.createRectangle(-2, -1, 2, 2, 1, false);
    const upVector = Vector3d.unitZ();
    const tiltAngle = Angle.createDegrees(0);
    const clipper = ConvexClipPlaneSet.createSweptPolyline(triangle0, upVector, tiltAngle);
    if (ck.testPointer(clipper, "createSweptPolygon") && clipper) {
      // const area0 = PolygonOps.sumTriangleAreas(rectangle0);
      const splitA: Point3d[] = [];
      const work: Point3d[] = [];
      clipper.polygonClip(rectangle0, splitA, work);
      const areaA = PolygonOps.sumTriangleAreas(splitA);
      ck.testCoordinate(area0, areaA);
    }

    ck.checkpoint("SweptPolygon");
    expect(ck.getNumErrors()).equals(0);
  });
});
