/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Clipper, ClipPlaneContainment, ClipStatus, ClipUtilities } from "../../clipping/ClipUtils";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "../../clipping/UnionOfConvexClipPlaneSets";
import { Arc3d } from "../../curve/Arc3d";
import { AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { HalfEdgeGraph } from "../../topology/Graph";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d, XYZ } from "../../geometry3d/Point3dVector3d";
import { IndexedXYZCollectionPolygonOps, Point3dArrayPolygonOps, PolygonOps } from "../../geometry3d/PolygonOps";
import { Range1d, Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { Box } from "../../solid/Box";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { ClippedPolyfaceBuilders, PolyfaceClip } from "../../polyface/PolyfaceClip";
import { LinearSweep } from "../../solid/LinearSweep";
import { Cone } from "../../solid/Cone";
import { GrowableXYZArrayCache } from "../../geometry3d/ReusableObjectCache";

/* eslint-disable no-console, no-trailing-spaces */

Checker.noisy.clipPlane = false;
/**
 * Verify that a (convex) polygon (a) is within a range (b) tight to the range.
 * @param ck checker
 * @param range range
 * @param xyz post-clip polygon
 */
function testPolygonClippedToRange(ck: Checker, range: Range3d, polygon: GrowableXYZArray): boolean {
  const expandedRange = range.clone();
  const convexXYZ = polygon.getPoint3dArray();
  expandedRange.expandInPlace(Geometry.smallMetricDistance);
  // every point must be in . . .
  for (const xyz of convexXYZ) {
    {
      if (!ck.testTrue(expandedRange.containsPoint(xyz)))
        return false;
    }
  }
  // extension of every interior edge is out.  (But only test a subset . ..l.)
  for (let i = 0; i < XYZ.length; i++) {
    const i1 = (i + 1) % XYZ.length;
    if (convexXYZ[i].isAlmostEqual(convexXYZ[i1])) continue;
    if (!ck.testFalse(range.containsPoint(convexXYZ[i].interpolate(1.1, convexXYZ[i + 1]))))
      return false;
    if (!ck.testFalse(range.containsPoint(convexXYZ[i1].interpolate(-0.1, convexXYZ[i + 1]))))
      return false;
  }
  return true;
}

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
    Point3dArrayPolygonOps.convexPolygonClipInPlace(clip0, xyz0, work);
    Point3dArrayPolygonOps.convexPolygonClipInPlace(clip1, xyz1, work);
    const normal0: Vector3d = PolygonOps.areaNormal(xyz0);
    const normal1: Vector3d = PolygonOps.areaNormal(xyz1);
    const area0 = normal0.magnitude();
    const area1 = normal1.magnitude();
    ck.testCoordinate(area, area0 + area1);
  }
}

describe("ClipPlane", () => {

  // ---------------------------------------------------------------------------------------------------

  it("BoundedSegmentIntersection", () => {
    const ck = new Checker();
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
    const ck = new Checker();
    // XY plane with upward (+z) facing normal
    const clip = ClipPlane.createNormalAndPoint(Vector3d.create(0, 0, 1),
      Point3d.create(0, 0, 0), false, false)!;
    const h0 = 5.0;
    const testPoint = Point3d.create(2, 3, h0);
    ck.testCoordinate(h0, clip.dotProductPlaneNormalPoint(testPoint));
    ck.testCoordinate(h0, clip.altitude(testPoint), "clip plane through origin");
    const dh = 1.5;
    clip.offsetDistance(dh);
    ck.testCoordinate(h0, clip.dotProductPlaneNormalPoint(testPoint));
    ck.testCoordinate(h0 - dh, clip.altitude(testPoint), "evaluate shifted plane");

    ck.checkpoint("Offset");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------

  it("LineClip", () => {
    const ck = new Checker();
    const origin = Point3d.create(1, 2, 3);
    const inwardNormal = Vector3d.create(1, 2, 12); // "mostly" z direction
    inwardNormal.normalizeInPlace();
    const plane = Plane3dByOriginAndUnitNormal.create(origin, inwardNormal)!;
    const pointA = Point3d.create(4, 3, 100);
    const pointB = Point3d.create(2, 0, -57);
    const clipPlane = ClipPlane.createPlane(plane);
    ck.testCoordinate(clipPlane.altitude(pointA), plane.altitude(pointA));
    ck.testCoordinate(clipPlane.altitude(pointB), plane.altitude(pointB));
    // announced fractions are strictly increasing pair within what we send as start end fractions, so relation to ends is known ...
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
    const ck = new Checker();
    const point0 = Point3d.create(1, 2, 3);
    const inwardNormal = Vector3d.create(1, 2, 12); // "mostly" z direction
    inwardNormal.normalizeInPlace();
    const plane = Plane3dByOriginAndUnitNormal.create(point0, inwardNormal)!;
    const clipPlane = ClipPlane.createPlane(plane);
    const json1 = clipPlane.toJSON();
    const clipPlane1 = ClipPlane.fromJSON(json1);
    ck.testTrue(clipPlane1 !== undefined && clipPlane.isAlmostEqual(clipPlane1));
    clipPlane.setInvisible(true);
    const json2 = clipPlane.toJSON();
    const clipPlane2 = ClipPlane.fromJSON(json2);
    ck.testTrue(clipPlane2 !== undefined && clipPlane.isAlmostEqual(clipPlane2));
    const clipPlane3 = ClipPlane.fromJSON({});
    ck.testDefined(clipPlane3);
    ck.testUndefined(ClipPlane.createEdgeXY(point0, point0));
    const tiltPlane = ClipPlane.createEdgeAndUpVector(
      Point3d.create(0, 0, 0),
      Point3d.create(0, 1, 0),
      Vector3d.create(0, 0, 1),
      Angle.createDegrees(45))!;
    ck.testTrue(tiltPlane.isPointInside(Point3d.create(1, 0, 0)));
    ck.testFalse(tiltPlane.isPointInside(Point3d.create(1, 0, 10)));
    expect(ck.getNumErrors()).equals(0);
  });
  // ---------------------------------------------------------------------------------------------------

  it("PolygonInOutCross", () => {
    const ck = new Checker();
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
        Point3dArrayPolygonOps.polygonPlaneCrossings(clip, array, crossings);
        // Point3dArrayPolygonOps.polygonPlaneCrossings(clip, array, crossings);
        if (Checker.noisy.clipPlane) {
          console.log("Points:");
          console.log(array);
          console.log({ "expected crossings: ": numExpectedCrossings });
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
          Point3dArrayPolygonOps.polygonPlaneCrossings(clip, subArray, crossings);
          ck.testCoordinate(crossings.length, 0, "Last two points did not cross plane");
        }

        if (toReduce) { numExpectedCrossings--; }
      }
    }
    const triangleThrough11 = [Point3d.create(0, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 2, 0)];
    const plane = Plane3dByOriginAndUnitNormal.createXYZUVW(0, 1, 0, 0, 1, 0)!;
    Point3dArrayPolygonOps.polygonPlaneCrossings(plane, triangleThrough11, crossings);
    ck.testExactNumber(2, crossings.length, "2 crossings for plane with exact hit");
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
        const xAlignedRay = Ray3d.create(Point3d.create(xyMiddleOfCube, xyMiddleOfCube, i), Vector3d.create(Math.cos(theta), 0, Math.sin(theta)));
        const yAlignedRay = Ray3d.create(Point3d.create(xyMiddleOfCube, xyMiddleOfCube, i), Vector3d.create(0, Math.cos(theta), Math.sin(theta)));
        const xAlignedRange = Range1d.createNull();
        const yAlignedRange = Range1d.createNull();
        set.hasIntersectionWithRay(xAlignedRay, xAlignedRange);
        set.hasIntersectionWithRay(yAlignedRay, yAlignedRange);

        if (xAlignedRange.isNull || yAlignedRange.isNull) {
          ck.testFalse(set.hasIntersectionWithRay(xAlignedRay));
          ck.testFalse(set.hasIntersectionWithRay(yAlignedRay));
          continue;
        }

        ck.testBoolean(set.hasIntersectionWithRay(xAlignedRay), !xAlignedRange.isNull);
        ck.testBoolean(set.hasIntersectionWithRay(yAlignedRay), !yAlignedRange.isNull);

        if (i > -0.5 && i < 1) {
          // Ray began inside the region
          ck.testFalse(xAlignedRange.isNull, "known containment");
          ck.testTrue(xAlignedRange.containsX(0));
          continue;
        }
      }
    }

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
    const triangleWithDuplicate = [triangle[0], triangle[1], triangle[1], triangle[2]];
    const convexSetA1 = convexSetA.clone();
    convexSetA1.reloadSweptPolygon(triangleWithDuplicate, sweepDirection, 1);
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
    convexSetA.reloadSweptPolygon([], sweepDirection, 1);
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
  it("AnnounceClippedIntervals", () => {
    const ck = new Checker();
    const emptySet = ConvexClipPlaneSet.createEmpty();
    // line outside and parallel for coverage
    const pointA = Point3d.create(-1, 1, 0);
    const pointB = Point3d.create(-1, 2, 0);
    // ?? empty set accepts all. (product of many initializes to 1 and stays?)
    ck.testTrue(emptySet.announceClippedSegmentIntervals(0, 1, pointA, pointB));
    const convexSet = ConvexClipPlaneSet.createXYBox(0, 0, 4, 4);
    ck.testFalse(convexSet.announceClippedSegmentIntervals(0, 4, pointA, pointB));
    ck.testFalse(convexSet.announceClippedSegmentIntervals(1, 0, pointA, pointB));
    expect(ck.getNumErrors()).equals(0);
  });
  it("SweptPolyline", () => {
    const ck = new Checker();
    const pointA = Point3d.create(1, 0, 0);
    const pointB = Point3d.create(1, 1, 0);
    const pointC = Point3d.create(0, 2, 0);
    const triangleCCW = [pointA, pointB, pointC, pointA];
    const triangleCW = [pointA, pointC, pointB, pointA];
    const unitZ = Vector3d.create(0, 0, 1);
    const setA = ConvexClipPlaneSet.createSweptPolyline(triangleCCW, unitZ);
    const setB = ConvexClipPlaneSet.createSweptPolyline(triangleCW, unitZ);
    ck.testDefined(setA);
    ck.testDefined(setB);
    // This function quits early on duplicate point ...
    const failCCW = ConvexClipPlaneSet.createSweptPolyline([pointA, pointB, pointC, pointC, pointA], unitZ);
    const failCC = ConvexClipPlaneSet.createSweptPolyline([pointA, pointC, pointB, pointB, pointA], unitZ);
    ck.testUndefined(failCCW);
    ck.testUndefined(failCC);
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
    const clipLine: Point3d[] = Sample.createRectangle(-2, -1, 2, 1, 0, true);
    const clipper: Clipper = ConvexClipPlaneSet.createXYPolyLineInsideLeft(clipLine);

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
        ck.testTrue(activeClipper.isPointOnOrInside(point1), "interval midpoint is IN");
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
    Point3dArrayPolygonOps.convexPolygonSplitInsideOutsidePlane(plane, rectangle0, splitA, splitB, altitudeRange);
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
    const bx = 4;
    const by = 5;
    const range = Range3d.createXYZXYZ(ax, ay, -1, bx + 1, by + 1, 4);
    const convexA = ConvexClipPlaneSet.createRange3dPlanes(range, true, false, true, false, false)!;
    const rectangle0 = [
      Point3d.create(-1, -1, 0),
      Point3d.create(bx, - 1, 0),
      Point3d.create(bx, by, 0),
      Point3d.create(-1, by, 0)];

    // const area0 = PolygonOps.sumTriangleAreas(rectangle0);
    const splitA = new GrowableXYZArray();
    const work = new GrowableXYZArray();
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
      const splitA = new GrowableXYZArray();
      const work = new GrowableXYZArray();
      clipper.polygonClip(rectangle0, splitA, work);
      const areaA = PolygonOps.sumTriangleAreas(splitA);
      ck.testCoordinate(area0, areaA);
    }

    ck.checkpoint("SweptPolygon");
    expect(ck.getNumErrors()).equals(0);
  });

  it("QuickClipStatus", () => {
    const ck = new Checker();
    const convexSetA = ConvexClipPlaneSet.createXYBox(0, 0, 4, 4);
    const convexSetB = ConvexClipPlaneSet.createXYBox(6, 6, 11, 10);
    const clipAB = UnionOfConvexClipPlaneSets.createConvexSets([convexSetA, convexSetB]);

    // These are all contained in convexSetA.
    const pointsInA = GrowableXYZArray.create([Point3d.create(1, 1), Point3d.create(2, 2), Point3d.create(2, 3)]);
    const pointsInB = GrowableXYZArray.create([Point3d.create(7, 8), Point3d.create(8, 8), Point3d.create(8, 9)]);

    ck.testExactNumber(ClipStatus.TrivialAccept, ClipUtilities.pointSetSingleClipStatus(pointsInA, clipAB, 0.0));
    ck.testExactNumber(ClipStatus.TrivialAccept, ClipUtilities.pointSetSingleClipStatus(pointsInB, clipAB, 0.0));

    const boundaryA = GrowableXYZArray.create([Point3d.create(1, 1), Point3d.create(1, -1)]);
    const boundaryB = GrowableXYZArray.create([Point3d.create(7, 7), Point3d.create(7, 5)]);
    ck.testExactNumber(ClipStatus.ClipRequired, ClipUtilities.pointSetSingleClipStatus(boundaryA, clipAB, 0.0));
    ck.testExactNumber(ClipStatus.ClipRequired, ClipUtilities.pointSetSingleClipStatus(boundaryB, clipAB, 0.0));

    const spreadQ = GrowableXYZArray.create(
      [Point3d.create(1, 8), Point3d.create(2, 8)]);
    ck.testExactNumber(ClipStatus.TrivialReject, ClipUtilities.pointSetSingleClipStatus(spreadQ, clipAB, 0.0));
    ck.testExactNumber(ClipStatus.TrivialAccept, ClipUtilities.pointSetSingleClipStatus(spreadQ,
      UnionOfConvexClipPlaneSets.createConvexSets([]), 0.0));
    ck.checkpoint("QuickClipStatus");
    expect(ck.getNumErrors()).equals(0);
  });

  it("createPlaneVariants", () => {
    const ck = new Checker();
    ck.testUndefined(ClipPlane.createNormalAndPointXYZXYZ(0, 0, 0, 0, 0, 0), "null normal should fail clip plane");
    const clipPlaneA = ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, 0, 0, 0);
    const unitB = Vector3d.create(1, 5, 2);
    unitB.normalizeInPlace();
    const planeByNormalB = Plane3dByOriginAndUnitNormal.create(Point3d.create(1, 2, 3), unitB)!;
    const clipPlaneB0 = ClipPlane.createPlane(planeByNormalB);
    const clipPlaneB1 = ClipPlane.createPlane(planeByNormalB, false, false, clipPlaneA);
    ck.testTrue(clipPlaneB0.isAlmostEqual(clipPlaneB1));
    ck.checkpoint("QuickClipStatus");
    expect(ck.getNumErrors()).equals(0);
  });

  it("createNormalAndDistanceVariants", () => {
    const ck = new Checker();
    const clipPlaneA = ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, 0, 0, 0);
    const unitB = Vector3d.create(1, 5, 2);
    unitB.normalizeInPlace();
    const distance = -12.0;
    const clipPlaneB0 = ClipPlane.createNormalAndDistance(unitB, distance, false, true)!;
    const clipPlaneB1 = ClipPlane.createNormalAndDistance(unitB, distance, false, true, clipPlaneA)!;
    ck.testTrue(clipPlaneB0.isAlmostEqual(clipPlaneB1));

    ck.testUndefined(ClipPlane.createNormalAndDistance(Vector3d.createZero(), distance));
    ck.checkpoint("QuickClipStatus");
    expect(ck.getNumErrors()).equals(0);
  });

  it("createNormalAndPointVariants", () => {
    const ck = new Checker();
    const clipPlaneA = ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, 0, 0, 0);
    const unitB = Vector3d.create(1, 5, 2);
    unitB.normalizeInPlace();
    const pointOnPlane = Point3d.create(3, 2, 9);
    const clipPlaneB0 = ClipPlane.createNormalAndPoint(unitB, pointOnPlane, false, true)!;
    const clipPlaneB1 = ClipPlane.createNormalAndPoint(unitB, pointOnPlane, false, true, clipPlaneA)!;
    ck.testTrue(clipPlaneB0.isAlmostEqual(clipPlaneB1));

    ck.testUndefined(ClipPlane.createNormalAndPoint(Vector3d.createZero(), pointOnPlane));
    ck.checkpoint("QuickClipStatus");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ClipToRange", () => {
    const ck = new Checker();
    const range = Range3d.createXYZXYZ(-2, -1, -3, 4, 5, 2);
    const allGeometry: GeometryQuery[] = [];
    let dy = 0.0;
    // obviously inside ...
    for (const clipPlane of [
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, 0.1)!,
      ClipPlane.createNormalAndPointXYZXYZ(-2, 4, 1, 0.3, 0.2, 1.1)!,
      ClipPlane.createNormalAndPointXYZXYZ(1, 1, 1.1, 0.3, 0.2, 1.1)!,
      ClipPlane.createNormalAndPointXYZXYZ(-2, 6, 3, 0.3, 0.2, 1.1)!,
      ClipPlane.createNormalAndPointXYZXYZ(0.2, 0, 1, 0, 0, 0)!]) {
      const clipped = clipPlane.intersectRange(range, true);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, dy, 0);
      if (ck.testPointer(clipped)) {
        testPolygonClippedToRange(ck, range, clipped);
        GeometryCoreTestIO.captureGeometry(allGeometry, Loop.create(LineString3d.create(clipped)), 0, dy, 0);
      }
      dy += 10.0;
    }
    // obviously outside
    const big = 20.0;
    for (const clipPlane of [
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, big)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 1, 0, 0, big, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, big, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(1, 1, 1, big, big, big)!]) {
      const clipped = clipPlane.intersectRange(range, true);
      ck.testUndefined(clipped, prettyPrint(clipPlane), prettyPrint(range));
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipPlane", "ClipToRange");
    expect(ck.getNumErrors()).equals(0);
  });
  it("RangeFaces", () => {
    const ck = new Checker();
    const range = Range3d.createXYZXYZ(-2, -1, -3, 4, 5, 2);
    const allGeometry: GeometryQuery[] = [];
    const corners = range.corners();
    for (let i = 0; i < 6; i++) {
      const indices = Range3d.faceCornerIndices(i);
      const lineString = LineString3d.createIndexedPoints(corners, indices);
      testPolygonClippedToRange(ck, range, lineString.packedPoints);
      GeometryCoreTestIO.captureGeometry(allGeometry, Loop.create(lineString), 0, 0, 0);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipPlane", "RangeFaces");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClipConvexSetToRange", () => {
    const ck = new Checker();
    const range = Range3d.createXYZXYZ(-2, -1, -3, 4, 5, 4.5);
    const rangeB = Range3d.createXYZXYZ(0, 0, 0, 6, 2, 3);
    const allGeometry: GeometryQuery[] = [];
    let dy = 0.0;
    // obviously inside ...
    const transforms = Sample.createInvertibleTransforms();
    transforms.reverse();
    for (const transform of transforms) {
      const matrix = Matrix4d.createTransform(transform);
      const cornerB = rangeB.corners();
      transform.multiplyPoint3dArrayInPlace(cornerB);
      const convexSetB = ConvexClipPlaneSet.createRange3dPlanes(rangeB);
      convexSetB.multiplyPlanesByMatrix4d(matrix, true, true);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, dy, 0);
      // We happen to know that the convexSet planes are in rangeB faces.
      // So we can clip the faces directly.
      for (let i = 0; i < 6; i++) {
        const indices = Range3d.faceCornerIndices(i);
        const linestring = LineString3d.createIndexedPoints(cornerB, indices, true);
        GeometryCoreTestIO.captureGeometry(allGeometry, linestring.clone(), 0, dy, 0);
        const clippedPoints = linestring.packedPoints.clone();
        clippedPoints.pop(); // get rid of closure
        IndexedXYZCollectionPolygonOps.intersectRangeConvexPolygonInPlace(range, clippedPoints);
        if (clippedPoints && clippedPoints.length > 0)
          GeometryCoreTestIO.captureGeometry(allGeometry, Loop.createPolygon(clippedPoints), 0, dy, 0);
      }

      // Now we forget about rangeB.  We just know that convexSetB is there.
      // Remove planes to make it unbounded
      // Clip each of its planes to the range (which is bounded and hence produces bounded clip)
      // then clip to the clip plane set.  (which is not bounded)
      let xB = 30.0;

      for (const hide of [-1, 0, 2, 3, 4]) {
        if (hide > 0 && hide < convexSetB.planes.length)
          convexSetB.planes[hide].setInvisible(true);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, range, xB, dy, 0);
        let intersectionFaces = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(convexSetB, range, true, true, true);
        if (hide < 0) {
          // ensure that the intersection range for the full plane set matches the range of loops.
          const rangeA = ClipUtilities.rangeOfConvexClipPlaneSetIntersectionWithRange(convexSetB, range);
          if (intersectionFaces !== undefined && !rangeA.isNull) {
            const rangeC = Range3d.createNull();
            for (const f of intersectionFaces) {
              f.extendRange(rangeC);
            }
            ck.testRange3d(rangeA, rangeC);
          }
        }
        GeometryCoreTestIO.captureGeometry(allGeometry, intersectionFaces, xB, dy, 0);
        xB += 20.0;
        GeometryCoreTestIO.captureRangeEdges(allGeometry, range, xB, dy, 0);
        intersectionFaces = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(convexSetB, range, true, false, true);
        GeometryCoreTestIO.captureGeometry(allGeometry, intersectionFaces, xB, dy, 0);
        xB += 20.0;
        GeometryCoreTestIO.captureRangeEdges(allGeometry, range, xB, dy, 0);
        intersectionFaces = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(convexSetB, range, false, true, true);
        GeometryCoreTestIO.captureGeometry(allGeometry, intersectionFaces, xB, dy, 0);
        xB += 40;
      }
      dy += 20.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipPlane", "ClipConvexSetToRange");
    expect(ck.getNumErrors()).equals(0);

  });

  it("ClipConvexPolygonToRangeCoverage", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // a largish range . .
    const range = Range3d.createXYZXYZ(-20, -10, -30, 40, 50, 45);
    // fractional positions to left, inside, and right of 01 interval . ..
    const fractions = [-0.5, 0.5, 1.5];
    // a smallish polygon ...
    const polygon = GrowableXYZArray.create([[0, 0, 0], [1, 0, 1], [0.5, 1, 0]]);
    const area0 = PolygonOps.sumTriangleAreas(polygon);
    for (const u of fractions) {
      for (const v of fractions) {
        for (const w of fractions) {
          // place the polygon.
          // all except the 000 position are OUT, and all the exit branches of the clipper get hit
          const center = range.fractionToPoint(u, v, w);
          const transform = Transform.createTranslation(center);
          const polygon1 = polygon.clone();
          polygon1.multiplyTransformInPlace(transform);
          const clip = IndexedXYZCollectionPolygonOps.intersectRangeConvexPolygonInPlace(range, polygon1);
          if (!range.containsPoint(center))
            ck.testUndefined(clip);
          else {
            ck.testTrue(clip === polygon1, "clip happens in place");
            ck.testCoordinate(area0, PolygonOps.sumTriangleAreas(clip!), "internal polygon not clipped");
          }
        }
      }
    }
    // empty range quick out . . .
    ck.testUndefined(IndexedXYZCollectionPolygonOps.intersectRangeConvexPolygonInPlace(Range3d.createNull(), polygon), "null range clips to nothing");
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipPlane", "ClipConvexPolygonToRangeCoverage");
    expect(ck.getNumErrors()).equals(0);

  });
  it("StairwellClipViaSweptPolyline", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0.0;
    const x1 = 5.0;
    const x2 = 10.0;
    const y0 = 0.0;

    // Outline a rectangle in xz plane at the bottom of the stairwell
    const a = 1.0;  // stair clearance width.
    const b = 2.5;  // stair clearance height
    const baseRectangle = [Point3d.create(0, 0), Point3d.create(a, 0), Point3d.create(a, 0, b), Point3d.create(0, 0, b), Point3d.create(0, 0)];
    const sweepVector = Vector3d.create(0, 1, 0.8);
    // create uncapped sweep
    const clipper = ConvexClipPlaneSet.createSweptPolyline(baseRectangle, sweepVector)!;

    // make a mesh box for something to punch ..
    const box = Box.createRange(Range3d.createXYZXYZ(-1, 1, 0, 3, 2, 5), true)!;
    const builder = PolyfaceBuilder.create();
    builder.addBox(box);
    const target = builder.claimPolyface();
    const clipBuilders = ClippedPolyfaceBuilders.create(true, true, true);
    PolyfaceClip.clipPolyfaceInsideOutside(target, clipper, clipBuilders);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, target, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, baseRectangle, x0, y0);
    GeometryCoreTestIO.captureGeometry(allGeometry,
      LineSegment3d.create(baseRectangle[0], baseRectangle[0].plusScaled(sweepVector, 5.0)), x0, y0);
    const clip0 = clipBuilders.claimPolyface(0, false);
    const clip1 = clipBuilders.claimPolyface(1, true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, clip0, x1, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, clip1, x2, y0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "clipping", "StairwellClip");
    expect(ck.getNumErrors()).equals(0);

  });
  it("StairwellClipViaLinearSweep", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0.0;
    const x0A = 10.0;
    const x1 = 20.0;
    const x2 = 30.0;
    let y0 = 0.0;

    // Outline a rectangle in xz plane at the bottom of the stairwell
    const a = 1.0;  // stair clearance width.
    const b = 2.0;  // stair clearance height
    const baseRectangle = [Point3d.create(0, 0), Point3d.create(a, 0), Point3d.create(a, 0, b), Point3d.create(0, 0, b), Point3d.create(0, 0)];
    const sweepVector = Vector3d.create(0, 3, 2.4);
    for (const capped of [false, true]) {
      const sweptSolid = LinearSweep.create(Loop.create(LineString3d.create(baseRectangle)), sweepVector, true)!;
      // create uncapped sweep
      const contour = sweptSolid.getSweepContourRef();
      const clipper = contour.sweepToUnionOfConvexClipPlaneSets(sweepVector, capped, capped)!;

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, sweptSolid, x0A, y0);
      const builder = PolyfaceBuilder.create();
      // make a mesh box for something to punch ..
      /*
      const box = Box.createRange(Range3d.createXYZXYZ(-1, 1, 0, 3, 5, 4), true)!;
      builder.addBox(box);
      */
      const cone = Cone.createAxisPoints(Point3d.create(0, 4, 0), Point3d.create(0, 3, 4), 3, 2, true)!;
      builder.addCone(cone);
      const target = builder.claimPolyface();
      const clipBuilders = ClippedPolyfaceBuilders.create(true, true, true);
      PolyfaceClip.clipPolyfaceInsideOutside(target, clipper, clipBuilders);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, target, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, baseRectangle, x0, y0);
      GeometryCoreTestIO.captureGeometry(allGeometry,
        LineSegment3d.create(baseRectangle[0], baseRectangle[0].plusScaled(sweepVector, 5.0)), x0, y0);
      const clip0 = clipBuilders.claimPolyface(0, false);
      const clip1 = clipBuilders.claimPolyface(1, true);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clip0, x1, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clip1, x2, y0);
      y0 += 15.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "clipping", "StairwellClipViaLinearSweep");
    expect(ck.getNumErrors()).equals(0);

  });

});

/* Tests for various levels of appendPolygonClip implementation */
describe("PolygonClipper", () => {
  it("Singletons", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // L-shaped polygon ...
    const polygon = GrowableXYZArray.create([[0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3], [0, 0]]);
    const pointA = Point3d.create(2, -1);
    const pointB = Point3d.create(1, 4);
    // make a plane, wrap it as a singleton in a ConvexClipPlaneSet, and wrap that as a singleton UnionOfConvexClipPlaneSets
    const planeAB = ClipPlane.createEdgeXY(pointA, pointB)!;
    const planeBA = ClipPlane.createEdgeXY(pointB, pointA)!;
    const convexSetAB = ConvexClipPlaneSet.createPlanes([planeAB]);
    const convexSetBA = ConvexClipPlaneSet.createPlanes([planeBA]);
    const unionAB = UnionOfConvexClipPlaneSets.createConvexSets([convexSetAB]);
    const unionBoth = UnionOfConvexClipPlaneSets.createConvexSets([convexSetAB, convexSetBA]);
    let x0 = 0;
    const y0 = 0;
    const dx = 10.0;
    const dy = 10.0;
    GeometryCoreTestIO.createAndCaptureLoops(allGeometry, polygon, x0, y0);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA, pointB));
    x0 += dx;
    for (const clipper of [unionBoth, planeAB, planeBA, convexSetAB, convexSetBA, unionAB, unionBoth]) {

      const insideFragments: GrowableXYZArray[] = [];
      const outsideFragments: GrowableXYZArray[] = [];
      const cache = new GrowableXYZArrayCache();
      clipper.appendPolygonClip(polygon, insideFragments, outsideFragments, cache);
      GeometryCoreTestIO.createAndCaptureLoops(allGeometry, insideFragments, x0, y0);
      GeometryCoreTestIO.createAndCaptureLoops(allGeometry, outsideFragments, x0, y0 + dy);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonClipper", "Singletons");
    expect(ck.getNumErrors()).equals(0);
  });
});
/**
 * Context for GeometryCoreTestIO calls.
 * * Hold origin references x0,y0,z0
 * * emit geometry in drawXXXX calls.
 */
export class OutputManager {
  public x0: number = 0;
  public y0: number = 0;
  public z0: number = 0;
  public allGeometry: GeometryQuery[] = [];
  public drawArrow(pointA: Point3d, vector: Vector3d, headLengthFraction: number = 0.10, headWidthFraction: number = 0.05) {
    const pointB = pointA.plus(vector);
    const pointC = pointA.interpolatePerpendicularXY(1.0 - headLengthFraction, pointB, headWidthFraction);
    const pointD = pointA.interpolatePerpendicularXY(1.0 - headLengthFraction, pointB, -headWidthFraction);
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, [pointA, pointB, pointC, pointD, pointB], this.x0, this.y0, this.z0);
  }

  public drawPerpendicular(pointA: Point3d, vector: Vector3d, fractionAlong: number, leftFraction: number = -1.0, rightFraction: number = 1.0) {
    if (!Geometry.isSameCoordinate (leftFraction, rightFraction)){
      const pointB = pointA.plus(vector);
      const pointC = pointA.interpolatePerpendicularXY(fractionAlong, pointB, leftFraction);
      const pointD = pointA.interpolatePerpendicularXY(fractionAlong, pointB, rightFraction);
      GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, [pointC, pointD], this.x0, this.y0, this.z0);
}
  }

  public drawPolygon(points: GrowableXYZArray | Point3d[], forceClosure: boolean = false) {
    if (points instanceof GrowableXYZArray){
    if (forceClosure)
      points.forceClosure();
      GeometryCoreTestIO.createAndCaptureLoop(this.allGeometry, points, this.x0, this.y0, this.z0);
    } else {
      if (forceClosure)
        points.push(points[0]);
      GeometryCoreTestIO.createAndCaptureLoop(this.allGeometry, points, this.x0, this.y0, this.z0);
      }
  }
  public drawAxes(r: number = 10, arrowLength: number = 1, originX: number = 0, originY: number = 0) {
    const f = 0.5 * arrowLength / r;
    this.drawArrow(Point3d.create(originX - r, 0, 0), Vector3d.create(2 * r, 0, 0), f, 0.5 * f);
    this.drawArrow(Point3d.create(0, originY - r, 0), Vector3d.create(0, 2 * r, 0), f, 0.5 * f);
  }

  public drawMinus(xyz: Point3d, radius: number = 0.1) {
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry,
      [xyz.plusXYZ(-radius, 0, 0), xyz.plusXYZ(radius, 0, 0)],
      this.x0, this.y0, this.z0);
  }

  public drawPlus(xyz: Point3d, radius: number = 0.1) {
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry,
      [xyz.plusXYZ(-radius, 0, 0), xyz.plusXYZ(radius, 0, 0)],
      this.x0, this.y0, this.z0);
      GeometryCoreTestIO.captureCloneGeometry(this.allGeometry,
        [xyz.plusXYZ(0, -radius, 0), xyz.plusXYZ(0, radius, 0)],
        this.x0, this.y0, this.z0);
  }
  public drawLines(xyz: Point3d[]){
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, xyz,
      this.x0, this.y0, this.z0);
  }

  public drawCircle(xyz: Point3d, radius: number = 0.1) {
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry,
      Arc3d.createXY(xyz, radius));
  }

  public captureClone(data: GeometryQuery | undefined) {
    GeometryCoreTestIO.captureCloneGeometry(this.allGeometry, data, this.x0, this.y0, this.z0);
  }

  public saveToFile(directoryName: string, fileName: string) {
    GeometryCoreTestIO.saveGeometry(this.allGeometry, directoryName, fileName);
    this.allGeometry = [];
  }
  /**
   * Move the origin by dx,dy
   */
  public shift(dx: number, dy: number) {
    this.x0 += dx;
    this.y0 += dy;
  }
  public setX0(x0: number): number { const a = this.x0; this.x0 = x0; return a;}
  public setY0(y0: number): number { const a = this.y0; this.y0 = y0; return a; }
  public setZ0(z0: number): number { const a = this.z0; this.z0 = z0; return a; }
  public drawGraph(graph: HalfEdgeGraph | undefined) {
    if (graph)
      GeometryCoreTestIO.captureGeometry(this.allGeometry, PolyfaceBuilder.graphToPolyface(graph),
        this.x0, this.y0, 0);
  }

}
/**
 * Create planes with (inward) normal computed as cross product of sweepVector edge vectors.
 * Apply invisibleBits of respective edges
 * closure edge is added.
 */
function createSweptConvexClipperForPolygon(points: Point3d[], invisibleBits: boolean[], sweepVector: Vector3d): ConvexClipPlaneSet | undefined {
  if (points.length > 2){
    let pointA = points[points.length - 1];
    const clipper = ConvexClipPlaneSet.createEmpty();
    for (let i = 0; i < points.length; i++) {
      const pointB = points[i];
      const inwardNormal = sweepVector.crossProductStartEnd(pointA, pointB);
      const bit = invisibleBits[i];
      const plane = ClipPlane.createNormalAndPoint(inwardNormal, pointA, bit, bit);
      if (plane)
        clipper.addPlaneToConvexSet(plane);
      pointA = pointB;
    }
    if (clipper.planes.length > 0)
      return clipper;
  }
  return undefined;
}
/**
 * Create a UnionOfConvexClipPlaneSets by "tiling" between two linestrings with the same number of points.
 * * Each quad between corresponding edge is checked to see if it is convex and can be done as a single ConvexClipPlaneSets (or must be reduced to two triangles)
 * * If point counts are different, use the smaller count.
 * * "interior" edges are marked
 */
function createUnionOfConvexClipPlaneSetsBetweenCompatibleLineStringSweeps(pointA: Point3d[], pointB: Point3d[], sweepVector: Vector3d, hideInteriorPlanes: boolean): UnionOfConvexClipPlaneSets{
  const n = Math.min(pointA.length, pointB.length);
  const allClippers = UnionOfConvexClipPlaneSets.createEmpty();
  for (let i = 0; i + 1 < n; i++){
    const hide0 = (i !== 0);
    const hide1 = (i + 1 !== n);
    const pA0 = pointA[i];
    const pA1 = pointA[i + 1];
    const pB0 = pointB[i];
    const pB1 = pointB[i + 1];
    const cross0 = pA0.crossProductToPoints(pA1, pB0);
    const cross1 = pA1.crossProductToPoints(pB1, pB0);
    const a0 = cross0.dotProduct(sweepVector);
    const a1 = cross1.dotProduct(sweepVector);
    if (a0 * a1 < 0 || !hideInteriorPlanes) {
      if (a0 > 0)
        allClippers.addConvexSet(createSweptConvexClipperForPolygon([pA0, pA1, pB0], [false, hideInteriorPlanes, hide0], sweepVector));
      else
        allClippers.addConvexSet(createSweptConvexClipperForPolygon([pA0, pB0, pA1], [hide0, hideInteriorPlanes, false], sweepVector));

      if (a1 > 0)
        allClippers.addConvexSet(createSweptConvexClipperForPolygon([pA1, pB1, pB0], [hide1, false, hideInteriorPlanes], sweepVector));
      else
        allClippers.addConvexSet(createSweptConvexClipperForPolygon([pB1, pA1, pB0], [hide1, hideInteriorPlanes, false], sweepVector));
    } else {
      const loopPoints = [pA0, pA1, pB1, pB0];
      if (a0 < 0)
        loopPoints.reverse();   // reversal preserves 01 sequencing used in visibility check
        allClippers.addConvexSet(createSweptConvexClipperForPolygon(loopPoints, [false, hide1, false, hide0], sweepVector));
      }
  }
  return allClippers;
  }

describe("ClipPlaneDocs", () => {
  it("Quadrants", () => {
    const ck = new Checker();
    const out = new OutputManager();
    const a = 5.0;  // clipped polygon extent
    const b = 7.0 * a; // step between origins of successive snips
    const c = 3.0;    // length of arrows for planes
    const c1 = c / 10.0;
    const axisLength = 2.0 * a;
    const axisArrowLength = 1.0;
    const work = new GrowableXYZArray();

    // If the normal is nonzero, add a plane to the clipper.
    // Draw its placement arrow -- negate it for display if placementCoordinate is negative.
    const applyConditionalPlane1 = (clipper: ConvexClipPlaneSet, plane: Plane3dByOriginAndUnitNormal | undefined) => {
      if (plane !== undefined){
        out.drawArrow(plane.getOriginRef(), plane.getNormalRef().scale (3.0), 0.15, 0.10);
        out.drawPerpendicular(plane.getOriginRef(), plane.getNormalRef(), 0.0, -6.0, 6.0);
        clipper.addPlaneToConvexSet(ClipPlane.createPlane (plane));
      }
    };

    for (const xSign of [-1, 0, 1]) {
      out.setY0(0);
      for (const ySign of [-1, 0, 1]) {
        const ay = 2 * Geometry.split3WaySign(ySign, -c, c, c);
        const cy = Geometry.split3WaySign(ySign, -c1, c1, c1);
          out.drawAxes(axisLength, axisArrowLength);
        const ax = 2 * Geometry.split3WaySign(xSign, -c, c, c);
        const cx = Geometry.split3WaySign(xSign, -c1, c1, c1);
        const xPlane = Plane3dByOriginAndUnitNormal.createXYZUVW(cx, ay, 0, xSign, 0, 0);    // undefined is expected in 0 case!
        const yPlane = Plane3dByOriginAndUnitNormal.createXYZUVW(ax, cy, 0, 0, ySign, 0);    // undefined is expected in 0 case!
        const clipper = ConvexClipPlaneSet.createEmpty();
        applyConditionalPlane1(clipper, xPlane);
        applyConditionalPlane1(clipper, yPlane);
        const polygonToClip = GrowableXYZArray.create(Sample.createArcStrokes(3, Point3d.create(0, 0), a, Angle.createDegrees(15),
          Angle.createDegrees(375), true, -0.04));
        clipper.clipConvexPolygonInPlace(polygonToClip, work);
        out.drawPolygon(polygonToClip, true);
        out.shift(0, b);
      }
      out.shift(b, 0);
    }
    out.saveToFile("ClipPlaneDocs", "Quadrants");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SinglePlaneWithGridTests", () => {
    const out = new OutputManager();
    const ck = new Checker();
    const grid = Sample.createXYGrid(15, 13, 1, 1);
    const insideSize = 0.2;
    const outsideSize = 0.1;

    const showClipPlaneEffects = (myPlanes: Plane3dByOriginAndUnitNormal[], points: Point3d[]) => {
      const convexSet = ConvexClipPlaneSet.createPlanes(myPlanes);
      for (const plane of myPlanes) {
        out.drawArrow(plane.getOriginRef(), plane.getNormalRef(), 0.3, 0.1);
        out.drawPerpendicular(plane.getOriginRef(), plane.getNormalRef(), 0, -10, 10);
      }

      for (const xyz of points) {
        const in1 = convexSet.isPointInside(xyz);
        if (in1)
          out.drawPlus(xyz, insideSize);
        else
          out.drawMinus(xyz, outsideSize);
      }
    };
    const planes = [
      Plane3dByOriginAndUnitNormal.createXYZUVW(8, 9,  0, -1, -3, 0)!,
      Plane3dByOriginAndUnitNormal.createXYZUVW(5, 8, 0, 4, 1.5, 0)!,
      Plane3dByOriginAndUnitNormal.createXYZUVW(9, 4, 0, -4, 1.5, 0)!];

    for (const plane of planes) {
      const clipPlane = ClipPlane.createPlane(plane);
      out.drawArrow(plane.getOriginRef(), plane.getNormalRef(), 0.3, 0.1);
      out.drawPerpendicular(plane.getOriginRef(), plane.getNormalRef(), 0, -10, 10);
      for (const xyz of grid) {
        const in1 = clipPlane.isPointInside(xyz);
        if (in1)
          out.drawPlus(xyz, insideSize);
        else
          out.drawMinus(xyz, outsideSize);
      }
      out.shift(30, 0);
    }

    out.setX0(0);
    out.setY0(60);
    // Test again with growing convexSet ...
    const activePlanes = [];
    for (const plane of planes) {
      activePlanes.push(plane);
      showClipPlaneEffects(activePlanes, grid);
      out.shift(30, 0);
    }

    const planesForUnboundedConvexSet = [
      Plane3dByOriginAndUnitNormal.createXYZUVW(4.1, 2.1, 0, 1, 3, 0)!,
      Plane3dByOriginAndUnitNormal.createXYZUVW(2.5, 6.5, 0, 1, 0, 0)!,
      Plane3dByOriginAndUnitNormal.createXYZUVW(4.1, 12.1, 0, 1, -2, 0)!];

    showClipPlaneEffects(planesForUnboundedConvexSet, grid);
    out.shift(30, 0);

    out.saveToFile("ClipPlaneDocs", "SinglePlaneWithGridTests");
  expect(ck.getNumErrors()).equals(0);
  });
  it("UnionOfConvexClipPlaneSets", () => {
    const ck = new Checker();
    const out = new OutputManager();
    const pointsA0 = [Point3d.create(-1, -1), Point3d.create(1, -1), Point3d.create(3, -2), Point3d.create(4, 0)];
    const pointsA1 = [Point3d.create(-1, 2), Point3d.create(1, 0), Point3d.create(2, 1), Point3d.create(4, 1)];
    const pointsA2 = [Point3d.create(-1, 2), Point3d.create(1, -2), Point3d.create(2, 1), Point3d.create(4, 1)];
    const polygonA = [...pointsA0, ...(pointsA1.slice().reverse())];
    const polygonB = polygonA;
    // this shows the construction function aggressively forcing positive clips with bad ata.
    const polygonC = [...pointsA0, ...(pointsA2.slice().reverse())];
    const clipperA = createUnionOfConvexClipPlaneSetsBetweenCompatibleLineStringSweeps(pointsA0, pointsA1, Vector3d.unitZ(), false);

    const clipperB = createUnionOfConvexClipPlaneSetsBetweenCompatibleLineStringSweeps(pointsA0, pointsA1, Vector3d.unitZ(), true);
    const clipperC = createUnionOfConvexClipPlaneSetsBetweenCompatibleLineStringSweeps(pointsA0, pointsA2, Vector3d.unitZ(), true);

    const polygonQ = Sample.createArcStrokes(3, Point3d.create(1, 0, 0), 4, Angle.createDegrees(0), Angle.createDegrees(360), true, -0.01);

    for (const clipData of [{ clipper: clipperA, polygon: polygonA, doPolyface: true },
      { clipper: clipperB, polygon: polygonB, doPolyface: true },
      { clipper: clipperC, polygon: polygonC, doPolyface: false }]) {
      for (const polygon of [polygonQ]) {
        out.drawPolygon(clipData.polygon, true);
        out.drawPolygon(polygon, false);
        const clippedPolygon: GrowableXYZArray[] = [];
        clipData.clipper.polygonClip(polygon, clippedPolygon);
        out.shift(0, 10);
        for (const clip of clippedPolygon)
          out.drawPolygon(clip, false);
        if (clipData.doPolyface) {
          const polyfaceQ = PolyfaceBuilder.pointsToTriangulatedPolyface(polygonQ);
          if (polyfaceQ) {
            out.shift(0, 15);
            out.captureClone(polyfaceQ);
            const builders = ClippedPolyfaceBuilders.create(true, true);
            PolyfaceClip.clipPolyfaceUnionOfConvexClipPlaneSetsToBuilders(polyfaceQ, clipData.clipper, builders, 0);
            out.shift(0, 10);
            out.captureClone(builders.claimPolyface(0, true));
            out.shift(0, 10);
            out.captureClone(builders.claimPolyface(1, true));
          }
       }
      }
      out.shift(12, 0);
      out.setY0(0);
      }
    out.saveToFile("ClipPlaneDocs", "UnionOfConvexClipPlaneSets");
    expect(ck.getNumErrors()).equals(0);
  });

});
