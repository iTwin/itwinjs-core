/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClipPrimitive } from "../../clipping/ClipPrimitive";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { ClipVector } from "../../clipping/ClipVector";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "../../clipping/UnionOfConvexClipPlaneSets";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { AnyRegion, Arc3d, BagOfCurves, GeometryQuery, LineSegment3d, LineString3d, Loop, ParityRegion, Path, RegionOps, UnionRegion } from "../../curves";

describe("ParityRegionSweep", () => {
  it("TriangleClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pointA = Point3d.create(-10, 4);
    const pointB = Point3d.create(6, 1);
    const pointC = Point3d.create(2, 5);
    const vector01 = Vector3d.create(1, 7);
    const dxA = 1.5;
    const intervals = [
      Range1d.createXX(0, 1), Range1d.createXX(0.3, 1.0),
      Range1d.createXX(0.6, 1.0), Range1d.createXX(0, 0.5),
      Range1d.createXX(0.5, 1.0), Range1d.createXX(0.2, 0.8)];
    const xOut = 0;
    const yOut0 = 0;
    const yOut1 = 10.0;
    const yOut2 = 20.0;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], xOut, yOut0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], xOut, yOut1);
    for (let x0 = -3; x0 <= 5.0; x0 += dxA) {
      const segment0 = Point3d.create(x0, 0, 0);
      const segment1 = segment0.plus(vector01);
      let dx = 0.0;
      for (const interval of intervals) {
        segment0.x += dx;
        segment1.x += dx;
        dx += 0.02;
        const segment2 = segment0.interpolate(interval.low, segment1);
        const segment3 = segment0.interpolate(interval.high, segment1);
        const resultABC = Range1d.createXX(0, 1);
        ClipUtilities.clipSegmentToCCWTriangleXY(pointA, pointB, pointC, segment2, segment3, resultABC);
        const resultBCA = Range1d.createXX(0, 1);
        ClipUtilities.clipSegmentToCCWTriangleXY(pointB, pointC, pointA, segment2, segment3, resultBCA);
        ck.testTightNumber(resultABC.length(), resultBCA.length(), "clip fraction length with rotated triangle order");
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [segment2, segment3], xOut, yOut0);
        if (!resultABC.isNull) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry,
            [segment2.interpolate(resultABC.low, segment3), segment2.interpolate(resultABC.high, segment3)],
            xOut, yOut1);
        }
        if (!resultBCA.isNull) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry,
            [segment2.interpolate(resultABC.low, segment3), segment2.interpolate(resultABC.high, segment3)],
            xOut, yOut2);
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "TriangleClip");
    expect(ck.getNumErrors()).equals(0);
  });

});

describe("ClipUtilities", () => {
  it("ConvexClipPlaneSetComplement", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const unitRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
    const a = 0.2;
    const b = 0.6;
    const c = 0.4;
    const rangeA = Range3d.createXYZXYZ(a, a, a, b, b, c);
    const a1 = a + 0.1;
    const b1 = b + 0.1;
    const c1 = c - 0.05;
    const d1 = 1.8;
    const rangeB = Range3d.createXYZXYZ(b, a1, a1, d1, b1, c1);
    const xy0 = Point2d.create(0, 0);
    const a3 = 1.5;
    const b3 = 3.0;
    const outerRange = Range3d.createXYZXYZ(a3, a3, a3, b3, b3, b3);
    const clipperA = ConvexClipPlaneSet.createRange3dPlanes(rangeA);
    const clipperB = ConvexClipPlaneSet.createRange3dPlanes(rangeB);
    ck.testTrue(ClipUtilities.doesClipperIntersectRange(clipperA, unitRange));
    ck.testFalse(ClipUtilities.doesClipperIntersectRange(clipperB, outerRange));
    const unionClip = UnionOfConvexClipPlaneSets.createEmpty();
    for (const range of [rangeA, rangeB]) {
      xy0.y = 0;
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range, true, true, true, true, true, true);
      unionClip.addConvexSet(clipper);
      exerciseClipper(ck, allGeometry, unitRange, clipper, xy0);
      const rotation = Transform.createFixedPointAndMatrix(range.fractionToPoint(0.5, 0.5, 0.5),
        Matrix3d.createRotationAroundVector(Vector3d.create(1, 0.4, 0.3), Angle.createDegrees(20))!);
      clipper.transformInPlace(rotation);
      xy0.x += 5.0;
      xy0.y = 0.0;
      exerciseClipper(ck, allGeometry, unitRange, clipper, xy0);
      xy0.x += 5.0;

      // chop off a corner
      const chop0 = range.fractionToPoint(1, 0, 0.2);
      const chop1 = range.fractionToPoint(1, 1, 0.6);
      const chop2 = range.fractionToPoint(0.2, 0, 1);
      rotation.multiplyPoint3d(chop0, chop0);
      rotation.multiplyPoint3d(chop1, chop1);
      rotation.multiplyPoint3d(chop2, chop2);
      const chopNormal = Vector3d.createCrossProductToPoints(chop0, chop2, chop1);
      const chopPlane = Plane3dByOriginAndUnitNormal.create(chop0, chopNormal);
      clipper.addPlaneToConvexSet(chopPlane);
      xy0.y = 0.0;
      exerciseClipper(ck, allGeometry, unitRange, clipper, xy0);
      xy0.x += 5.0;
    }
    xy0.x += 5.0;
    const clipperLoopsA = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(unionClip, unitRange, true, false, true);
    const rangeLoopsA = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(unionClip, unitRange, false, true, true);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, xy0.x, xy0.y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipperLoopsA, xy0.x, xy0.y);
    xy0.x += 5.0;
    GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, xy0.x, xy0.y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rangeLoopsA, xy0.x, xy0.y);

    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ConvexClipPlaneSetComplement");
    expect(ck.getNumErrors()).equals(0);
  });
});

function rangeOfGeometry(geometry: GeometryQuery[]): Range3d {
  const range = Range3d.createNull();
  for (const g of geometry)
    range.extendRange(g.range());
  return range;
}

function exerciseClipper(ck: Checker, allGeometry: GeometryQuery[], outerRange: Range3d, clipper: ConvexClipPlaneSet,
  xy0: Point2d) {
  const clipperLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(clipper, outerRange, true, false, true);
  const rangeLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(clipper, outerRange, false, true, true);

  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  xy0.y += 2;
  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipperLoops, xy0.x, xy0.y);
  xy0.y += 2;
  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, rangeLoops, xy0.x, xy0.y);

  const range100 = ClipUtilities.rangeOfClipperIntersectionWithRange(clipper, outerRange, false);
  const range101 = rangeOfGeometry(clipperLoops.concat(rangeLoops));
  ck.testRange3d(range100, range101);
  xy0.y += 3;
  const outerClipSet = ClipUtilities.createComplementaryClips(clipper);
  const outerLoops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(outerClipSet, outerRange, true, false);
  GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, outerLoops, xy0.x, xy0.y);
  xy0.y += 3;
  for (const cell of outerClipSet.convexSets) {
    const loops = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(cell, outerRange, true, false);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, outerRange, xy0.x, xy0.y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops, xy0.x, xy0.y);
    xy0.y += 1.5;
  }
  // to get coverage .. we expect that outer clip set to be the full range . . .
  const range102 = ClipUtilities.rangeOfClipperIntersectionWithRange(outerClipSet, outerRange, false);
  ck.testRange3d(range102, outerRange, "complement set range is full range");
  ck.testTrue(ClipUtilities.doesClipperIntersectRange(outerClipSet, outerRange));

  const innerPrimitive = ClipPrimitive.createCapture(clipper);
  const range103 = ClipUtilities.rangeOfClipperIntersectionWithRange(innerPrimitive, outerRange, false);
  ck.testRange3d(range103, range100, "clipper buried in ClipPrimitive");
  ck.testTrue(ClipUtilities.doesClipperIntersectRange(innerPrimitive, outerRange));

  const innerVector = ClipVector.create([innerPrimitive]);
  const range104 = ClipUtilities.rangeOfClipperIntersectionWithRange(innerVector, outerRange, false);
  ck.testRange3d(range104, range100, "clipper buried in ClipVector");
  ck.testTrue(ClipUtilities.doesClipperIntersectRange(innerVector, outerRange));
}

describe("ClipUtilities", () => {
  it("ClipLineSegment", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 30;
    // primitive curve
    const curve = LineSegment3d.create(Point3d.create(-10, -10, -5), Point3d.create(10, 10, 5));
    GeometryCoreTestIO.captureGeometry(allGeometry, curve);
    // clipper
    const range = Range3d.createXYZXYZ(-5, -10, -3, 10, 5, 3);
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
    // perform clip
    const clippedCurve = ClipUtilities.clipAnyCurve(curve, clipper);
    GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
    // test XY length of clipped curve
    const expectedXYLengthSqr = 200;
    const start = (clippedCurve[0] as LineSegment3d).startPoint();
    const end = (clippedCurve[0] as LineSegment3d).endPoint();
    const len = start.distanceSquaredXY(end);
    ck.testCoordinate(len, expectedXYLengthSqr);
    // save all geometries
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipLineSegment");
    expect(ck.getNumErrors()).equals(0);
  }),
    it("ClipLineString", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // primitive curve
      const curve = LineString3d.create([[-8, 0, 1], [2, 10, 0], [16, -2, 0], [2, -16, -1], [-8, 0, 1]]);
      GeometryCoreTestIO.captureGeometry(allGeometry, curve);
      // clipper
      const range = Range3d.createXYZXYZ(-5, -10, -3, 10, 5, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(curve, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // test XY length of clipped curve elements
      const expectedXYLengthSqr = 8;
      let start = (clippedCurve[0] as LineSegment3d).startPoint();
      let end = (clippedCurve[0] as LineSegment3d).endPoint();
      let len = start.distanceSquaredXY(end);
      ck.testCoordinate(len, expectedXYLengthSqr);
      start = (clippedCurve[2] as LineSegment3d).startPoint();
      end = (clippedCurve[2] as LineSegment3d).endPoint();
      len = start.distanceSquaredXY(end);
      ck.testCoordinate(len, expectedXYLengthSqr);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipLineString");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("ClipArc", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // primitive curve
      const curve = Arc3d.createXYEllipse(Point3d.create(3, -3), 10, 5);
      GeometryCoreTestIO.captureGeometry(allGeometry, curve);
      // clipper
      const range = Range3d.createXYZXYZ(-5, -10, -3, 10, 5, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(curve, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipArc");
      expect(ck.getNumErrors()).equals(0);
    });
});

describe("ClipUtilities", () => {
  it("ClipPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 30;
    // path
    const arc = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-141, 141));
    const lineString1 = LineString3d.create([[-0.2, 5], [-1, 10], [-2, 5], [-3, 10], [-4, 5]]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(-4, 5), Point3d.create(-10, 0));
    const lineSegment2 = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-4, -5));
    const lineString2 = LineString3d.create([[-4, -5], [-3, -10], [-2, -5], [-1, -10], [-0.2, -5]]);
    const path = Path.create();
    path.tryAddChild(arc);
    path.tryAddChild(lineString1);
    path.tryAddChild(lineSegment1);
    path.tryAddChild(lineSegment2);
    path.tryAddChild(lineString2);
    GeometryCoreTestIO.captureGeometry(allGeometry, path);
    // clipper
    const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
    // perform clip
    const clippedCurve = ClipUtilities.clipAnyCurve(path, clipper);
    GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
    // save all geometries
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipPath");
    expect(ck.getNumErrors()).equals(0);
  }),
    it("ClipLoop1", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // loop
      const arc = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-141, 141));
      const lineString1 = LineString3d.create([[-0.2, 5], [-1, 10], [-2, 5], [-3, 10], [-4, 5]]);
      const lineSegment1 = LineSegment3d.create(Point3d.create(-4, 5), Point3d.create(-10, 0));
      const lineSegment2 = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-4, -5));
      const lineString2 = LineString3d.create([[-4, -5], [-3, -10], [-2, -5], [-1, -10], [-0.2, -5]]);
      const loop = Loop.create();
      loop.tryAddChild(arc);
      loop.tryAddChild(lineString1);
      loop.tryAddChild(lineSegment1);
      loop.tryAddChild(lineSegment2);
      loop.tryAddChild(lineString2);
      GeometryCoreTestIO.captureGeometry(allGeometry, loop);
      // clipper
      const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(loop, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipLoop1");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("ClipLoop2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // loop
      const arc = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-90, 90));
      const lineSegment1 = LineSegment3d.create(Point3d.create(6, 8), Point3d.create(-6, 8));
      const lineSegment2 = LineSegment3d.create(Point3d.create(-6, 8), Point3d.create(-6, -8));
      const lineSegment3 = LineSegment3d.create(Point3d.create(-6, -8), Point3d.create(6, -8));
      const loop = Loop.create();
      loop.tryAddChild(arc);
      loop.tryAddChild(lineSegment1);
      loop.tryAddChild(lineSegment2);
      loop.tryAddChild(lineSegment3);
      GeometryCoreTestIO.captureGeometry(allGeometry, loop);
      // clipper
      const range = Range3d.createXYZXYZ(0, -10, -3, 15, 10, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(loop, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // sanity tests
      expect(clippedCurve.length).equals(1);
      const area = RegionOps.computeXYArea((clippedCurve[0] as AnyRegion))!;
      const expectedArea = (6 * 16) + (8 * 8 * Math.PI / 2);
      ck.testCoordinate(area, expectedArea);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipLoop2");
      expect(ck.getNumErrors()).equals(0);
    });
  it("ClipUtilities.LocalRangesIntersect", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    interface TestCase {
      data: { localRange: Range3d, localToWorld: Transform, worldClashRange?: Range3d }[];
      expectedClash: boolean; // each entry is a set of mutually clashing or mutually non-clashing local ranges
      clashRange?: (undefined | Range3d)[][];  // clashRange[i][j] is world range of intersection of data[i] and data[j], defined only for i < j
    }
    const testCases: TestCase[] = [ // from user iModel
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(-0.023434012896785816, -5.00413553129377, -9.650393591767262, 20.02343401289663, 5.03613553129378, 9.68239359176722),
            localToWorld: Transform.createRefs(Point3d.create(-108.12092516312605, 80.97820829881688, 67.15651552186583), YawPitchRollAngles.createDegrees(-47.95656913000159, 15.000000000006024, 90).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.024019658687571166, -0.020559836132079568, -0.047579717945438915, 0.10484869637410554, 0.09055983613204432, 0.0975797179454645),
            localToWorld: Transform.createRefs(Point3d.create(-95.29966304738043, 66.6762028551563, 72.28348554781851), YawPitchRollAngles.createDegrees(42.04343086998508, -4.9775680764904035e-11, 74.99999999999397).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.041116288886769325, -0.04342022062438389, -0.21911795212515983, 0.3411162888867949, 0.3434202206242212, 0.22911795212515074),
            localToWorld: Transform.createRefs(Point3d.create(-95.14478995681672, 66.78879158941069, 72.16981588733208), YawPitchRollAngles.createDegrees(132.0434308699035, 75.00000000001432, 8.799644912641437e-11).toMatrix3d()),
          },
        ],
        expectedClash: true,
        clashRange: [
          [
            undefined,
            Range3d.createXYZXYZ(-95.36397573926465, 66.58616814357191, 72.25131173394928, -95.15511302989337, 66.79795624308294, 72.396215121783),
            Range3d.createXYZXYZ(-95.60069397863792, 66.44083908685087, 72.07338870288137, -95.00616526632447, 67.04061581909228, 72.53902056524058),
          ],
          [
            undefined,
            undefined,
            Range3d.createXYZXYZ(-95.36397573926463, 66.58616814357194, 72.25131173394928, -95.15511302989336, 66.79795624308295, 72.39621512178302),
          ],
        ],
      },
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(1.1546319456101628e-14, -1.4328815911568427e-14, -5.1535165024318985e-14, 11.999999999999943, 0.03199999999999116, 0.031999999999948535),
            localToWorld: Transform.createRefs(Point3d.create(-119.10528623043024, 43.39951280844136, 68.47662261522927), YawPitchRollAngles.createDegrees(-6.448039711171915, 15.000000000002194, 1.6754791257296069).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(0, 0, -1.4210854715202004e-14, 11.999999999999986, 0, -1.4210854715202004e-14),
            localToWorld: Transform.createRefs(Point3d.create(-107.5899903512084, 42.11371219204531, 71.59835123713896), YawPitchRollAngles.createDegrees(173.55196028882585, -14.99999999999978, 2.0579703138818464e-16).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.02213513258379224, -0.018579865396888717, -0.19678412188787828, 0.5721351325838432, 0.5685798653970273, 0.22178412188785057),
            localToWorld: Transform.createRefs(Point3d.create(-107.61315829094143, 42.393081259141205, 71.29907515904608), YawPitchRollAngles.createDegrees(173.5519602888134, 74.99999999996545, 5.981534282323202e-12).toMatrix3d()),
          },
        ],
        expectedClash: true,
        clashRange: [
          [
            undefined,
            Range3d.createXYZXYZ(-119.10777616425821, 42.11371219204531, 68.4925226959081, -107.5899903512084, 43.415418394376765, 71.59835123713894),
            Range3d.createXYZXYZ(-107.90948424949468, 42.09780660611036, 71.4978732020779, -107.5841489131751, 42.16506585450406, 71.61425131781793),
          ],
          [
            undefined,
            undefined,
            Range3d.createXYZXYZ(-107.90364281146148, 42.11371219204531, 71.513773282757, -107.5899903512084, 42.149160268569325, 71.59835123713894),
          ],
        ],
      },
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(-5, -5, -5, 5, 5, 5),
            localToWorld: Transform.createOriginAndMatrix(Point3d.create(-3, -6, -9), Matrix3d.createRotationAroundVector(Vector3d.create(1, 1, 1), Angle.createDegrees(33))),
          },
          {
            localRange: Range3d.createXYZXYZ(-2, -2, -2, 2, 2, 2),
            localToWorld: Transform.createOriginAndMatrix(Point3d.create(5, 5, 5), Matrix3d.createRotationAroundVector(Vector3d.create(-1, 1, -1), Angle.createDegrees(-115))),
          },
          {
            localRange: Range3d.createXYZXYZ(-1, -1, -1, 1, 1, 1),
            localToWorld: Transform.createOriginAndMatrix(Point3d.create(-10, 4, 3), Matrix3d.createRotationAroundVector(Vector3d.create(0, 1, -1), Angle.createDegrees(245))),
          },
        ],
        expectedClash: false,
      },
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(7.993605777301127e-15, 1.1483869410966463e-15, -8.895661984809067e-15, 11.999999999999961, 0.03200000000001247, 0.03200000000001958),
            localToWorld: Transform.createRefs(Point3d.create(-118.75022305842617, 45.954529463039, 68.47641991136159), YawPitchRollAngles.createDegrees(-9.408029798593397, 15.000000000007361, 2.455595252575587).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.03474118660066772, -3.3591167872492598, -1.714177531529474, 11.744741186600766, 3.4591167872486275, 1.8141775315289306),
            localToWorld: Transform.createRefs(Point3d.create(-118.82046236854137, 46.0485514387863, 68.44465610136753), YawPitchRollAngles.createDegrees(-9.40802979863332, 15.000000000003949, 113.91380925648686).toMatrix3d()),
          },
        ],
        expectedClash: true,
        clashRange: [
          [
            undefined,
            Range3d.createXYZXYZ(-118.75861047954066, 44.11431206598608, 68.47641991136157, -107.63915480739682, 45.9861280555703, 71.52509446528897),
          ],
        ],
      },
    ];
    let z = 0;
    for (const testCase of testCases) {
      const maxRange = Point3d.createZero();
      for (const datum of testCase.data)
        maxRange.set(Math.max(maxRange.x, datum.localRange.xLength()), Math.max(maxRange.y, datum.localRange.yLength()), Math.max(maxRange.z, datum.localRange.zLength()));
      const delta = maxRange.maxAbs();
      const delta10 = 10 * delta;
      let x = 0;
      for (let i = 0; i < testCase.data.length; ++i) {
        for (let j = i + 1; j < testCase.data.length; ++j) {
          let y = 0;
          // lambda to exercise local range clash methods
          const clashDetect = (index0: number, index1: number, captureLocal: boolean = false, captureWorld: boolean = true, captureIntersection: boolean = true): boolean => {
            if (captureLocal) {
              // doLocalRangesIntersect converts range0 to a polyface transformed into range1's local coordinates
              GeometryCoreTestIO.captureTransformedRangeEdges(allGeometry, testCase.data[index0].localRange, testCase.data[index1].localToWorld.inverse()?.multiplyTransformTransform(testCase.data[index0].localToWorld), x, y, z);
              GeometryCoreTestIO.captureRangeEdges(allGeometry, testCase.data[index1].localRange, x, y, z);
            }
            if (captureWorld) {
              GeometryCoreTestIO.captureTransformedRangeEdges(allGeometry, testCase.data[index0].localRange, testCase.data[index0].localToWorld, x, y, z);
              GeometryCoreTestIO.captureTransformedRangeEdges(allGeometry, testCase.data[index1].localRange, testCase.data[index1].localToWorld, x, y, z);
            }
            const isClash = ClipUtilities.doLocalRangesIntersect(testCase.data[index0].localRange, testCase.data[index0].localToWorld, testCase.data[index1].localRange, testCase.data[index1].localToWorld);
            ck.testBoolean(isClash, testCase.expectedClash, `ranges clash as expected: i=${index0} j=${index1}`);
            const clashRange = ClipUtilities.rangeOfIntersectionOfLocalRanges(testCase.data[index0].localRange, testCase.data[index0].localToWorld, testCase.data[index1].localRange, testCase.data[index1].localToWorld);
            if (captureIntersection)
              GeometryCoreTestIO.captureRangeEdges(allGeometry, clashRange, x, y, z);
            if (ck.testTrue(isClash === !clashRange.isNull, "intersection range is non-null iff ranges clash") && isClash)
              ck.testRange3d(clashRange, testCase.clashRange![Math.min(index0, index1)][Math.max(index0, index1)]!, "intersection has expected world range");
            return isClash;
          };

          const clashIJ = clashDetect(i, j);
          y += delta10;
          const clashJI = clashDetect(j, i);
          ck.testBoolean(clashIJ, clashJI, `symmetric arguments: i=${i} j=${j}`);

          // cover the margin case, no output or test
          ClipUtilities.doLocalRangesIntersect(testCase.data[i].localRange, testCase.data[i].localToWorld, testCase.data[j].localRange, testCase.data[j].localToWorld, 1.0);
          x += delta10;
        }
      }
      z += delta10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "LocalRangesIntersect");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("ClipUtilities", () => {
  it("ClipUnionRegion1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 30;
    // union region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const unionRegion = UnionRegion.create();
    unionRegion.tryAddChild(loop1);
    unionRegion.tryAddChild(loop2);
    GeometryCoreTestIO.captureGeometry(allGeometry, unionRegion);
    // clipper
    const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
    // perform clip
    const clippedCurve = ClipUtilities.clipAnyCurve(unionRegion, clipper);
    GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
    // save all geometries
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipUnionRegion1");
    expect(ck.getNumErrors()).equals(0);
  }),
    it("ClipUnionRegion2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // union region
      const lineString1 = LineString3d.create([[-1, -2], [3, -2], [3, -5], [10, -5], [10, 5], [3, 5], [3, 2], [-1, 2], [-1, -2]]);
      const loop1 = Loop.create();
      loop1.tryAddChild(lineString1);
      const lineString2 = LineString3d.create([[1, -2], [-3, -2], [-3, -5], [-10, -5], [-10, 5], [-3, 5], [-3, 2], [1, 2], [1, -2]]);
      const loop2 = Loop.create();
      loop2.tryAddChild(lineString2);
      const unionRegion = UnionRegion.create();
      unionRegion.tryAddChild(loop1);
      unionRegion.tryAddChild(loop2);
      GeometryCoreTestIO.captureGeometry(allGeometry, unionRegion);
      // clipper
      const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(unionRegion, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // sanity tests
      expect(clippedCurve.length).equals(1);
      const area = RegionOps.computeXYArea((clippedCurve[0] as AnyRegion))!;
      const expectedArea = (4 * 10) + (6 * 4) + (4 * 10);
      ck.testCoordinate(area, expectedArea);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipUnionRegion2");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("ClipParityRegion1", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // parity region
      const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
      const loop1 = Loop.create();
      loop1.tryAddChild(arc1);
      const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
      const loop2 = Loop.create();
      loop2.tryAddChild(arc2);
      const parityRegion = ParityRegion.create();
      parityRegion.tryAddChild(loop1);
      parityRegion.tryAddChild(loop2);
      GeometryCoreTestIO.captureGeometry(allGeometry, parityRegion);
      // clipper
      const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(parityRegion, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipParityRegion1");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("ClipParityRegion2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // parity region
      const lineString1 = LineString3d.create([[-1, -2], [-3, -2], [-3, -5], [10, -5], [10, 5], [3, 5], [3, 2], [-1, 2], [-1, -2]]);
      const loop1 = Loop.create();
      loop1.tryAddChild(lineString1);
      const lineString2 = LineString3d.create([[1, 2], [3, 2], [3, 5], [-10, 5], [-10, -5], [-3, -5], [-3, -2], [1, -2], [1, 2]]);
      const loop2 = Loop.create();
      loop2.tryAddChild(lineString2);
      const parityRegion = ParityRegion.create();
      parityRegion.tryAddChild(loop1);
      parityRegion.tryAddChild(loop2);
      GeometryCoreTestIO.captureGeometry(allGeometry, parityRegion);
      // clipper
      const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(parityRegion, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // sanity tests
      expect(clippedCurve.length).equals(1);
      const area = RegionOps.computeXYArea((clippedCurve[0] as AnyRegion))!;
      const expectedArea = (14 * 10) - 8;
      ck.testCoordinate(area, expectedArea);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipParityRegion2");
      expect(ck.getNumErrors()).equals(0);
    });
});

describe("ClipUtilities", () => {
  it("ClipBagOfCurves1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 30;
    // curve primitive
    const arc = Arc3d.createXY(Point3d.create(6, 0), 4, AngleSweep.createStartEndDegrees(-180, 180));
    // curve collection
    const lineString1 = LineString3d.create([[0, 5], [-1, 10], [-2, 5], [-3, 10], [-4, 5]]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(-4, 5), Point3d.create(-10, 0));
    const lineSegment2 = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-4, -5));
    const lineString2 = LineString3d.create([[-4, -5], [-3, -10], [-2, -5], [-1, -10], [0, -5]]);
    const lineSegment3 = LineSegment3d.create(Point3d.create(0, -5), Point3d.create(0, 5));
    const loop = Loop.create();
    loop.tryAddChild(lineString1);
    loop.tryAddChild(lineSegment1);
    loop.tryAddChild(lineSegment2);
    loop.tryAddChild(lineString2);
    loop.tryAddChild(lineSegment3);
    // bag of curves
    const bag = BagOfCurves.create(loop, arc);
    GeometryCoreTestIO.captureGeometry(allGeometry, bag);
    // clipper
    const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
    // perform clip
    const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
    GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
    // save all geometries
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipBagOfCurves1");
    expect(ck.getNumErrors()).equals(0);
  }),
    it("ClipBagOfCurves2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // curve primitive
      const lineSegment = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-1, 0));
      // curve collection
      const lineString1 = LineString3d.create([[0, 0], [7, 7], [14, 0], [7, -7], [0, 0]]);
      const loop = Loop.create();
      loop.tryAddChild(lineString1);
      // bag of curves
      const bag = BagOfCurves.create(lineSegment, loop);
      GeometryCoreTestIO.captureGeometry(allGeometry, bag);
      // clipper
      const range = Range3d.createXYZXYZ(-7, -7, -3, 7, 7, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // sanity tests
      expect(clippedCurve.length).equals(2);
      const area = RegionOps.computeXYArea((clippedCurve[1] as AnyRegion))!;
      const expectedArea = (14 * 7 / 2);
      ck.testCoordinate(area, expectedArea);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipBagOfCurves2");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("BagOfCurvesInsideClip1", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // curve primitive
      const arc = Arc3d.createXY(Point3d.create(6, 0), 4, AngleSweep.createStartEndDegrees(-180, 180));
      // curve collection
      const lineString1 = LineString3d.create([[0, 5], [-1, 10], [-2, 5], [-3, 10], [-4, 5]]);
      const lineSegment1 = LineSegment3d.create(Point3d.create(-4, 5), Point3d.create(-10, 0));
      const lineSegment2 = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-4, -5));
      const lineString2 = LineString3d.create([[-4, -5], [-3, -10], [-2, -5], [-1, -10], [0, -5]]);
      const lineSegment3 = LineSegment3d.create(Point3d.create(0, -5), Point3d.create(0, 5));
      const loop = Loop.create();
      loop.tryAddChild(lineString1);
      loop.tryAddChild(lineSegment1);
      loop.tryAddChild(lineSegment2);
      loop.tryAddChild(lineString2);
      loop.tryAddChild(lineSegment3);
      // bag of curves
      const bag = BagOfCurves.create(loop, arc);
      GeometryCoreTestIO.captureGeometry(allGeometry, bag);
      // clipper
      const range = Range3d.createXYZXYZ(-12, -12, -3, 12, 12, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "BagOfCurvesInsideClip1");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("BagOfCurvesInsideClip2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 35;
      // curve primitive
      const lineSegment = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-1, 0));
      // curve collection
      const lineString1 = LineString3d.create([[0, 0], [7, 7], [14, 0], [7, -7], [0, 0]]);
      const loop = Loop.create();
      loop.tryAddChild(lineString1);
      // bag of curves
      const bag = BagOfCurves.create(lineSegment, loop);
      GeometryCoreTestIO.captureGeometry(allGeometry, bag);
      // clipper
      const range = Range3d.createXYZXYZ(-15, -15, -3, 15, 15, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // sanity tests
      expect(clippedCurve.length).equals(2);
      const area = RegionOps.computeXYArea((clippedCurve[1] as AnyRegion))!;
      const expectedArea = 14 * 7;
      ck.testCoordinate(area, expectedArea);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "BagOfCurvesInsideClip2");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("BagOfCurvesOutsideClip1", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 50;
      // curve primitive
      const arc = Arc3d.createXY(Point3d.create(6, 0), 4, AngleSweep.createStartEndDegrees(-180, 180));
      // curve collection
      const lineString1 = LineString3d.create([[0, 5], [-1, 10], [-2, 5], [-3, 10], [-4, 5]]);
      const lineSegment1 = LineSegment3d.create(Point3d.create(-4, 5), Point3d.create(-10, 0));
      const lineSegment2 = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-4, -5));
      const lineString2 = LineString3d.create([
        Point3d.create(-4, -5),
        Point3d.create(-3, -10),
        Point3d.create(-2, -5),
        Point3d.create(-1, -10),
        Point3d.create(0, -5),
      ]);
      const lineSegment3 = LineSegment3d.create(Point3d.create(0, -5), Point3d.create(0, 5));
      const loop = Loop.create();
      loop.tryAddChild(lineString1);
      loop.tryAddChild(lineSegment1);
      loop.tryAddChild(lineSegment2);
      loop.tryAddChild(lineString2);
      loop.tryAddChild(lineSegment3);
      // bag of curves
      const bag = BagOfCurves.create(loop, arc);
      GeometryCoreTestIO.captureGeometry(allGeometry, bag);
      // clipper
      const range = Range3d.createXYZXYZ(-20, -15, -3, -11, 7, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "BagOfCurvesOutsideClip1");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("BagOfCurvesOutsideClip2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // curve primitive
      const lineSegment = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-1, 0));
      // curve collection
      const lineString1 = LineString3d.create([[0, 0], [7, 7], [14, 0], [7, -7], [0, 0]]);
      const loop = Loop.create();
      loop.tryAddChild(lineString1);
      // bag of curves
      const bag = BagOfCurves.create(lineSegment, loop);
      GeometryCoreTestIO.captureGeometry(allGeometry, bag);
      // clipper
      const range = Range3d.createXYZXYZ(-15, 3, -3, 0, 15, 3);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, shift);
      // sanity tests
      expect(clippedCurve.length).equals(1);
      expect(clippedCurve[0].children?.length).equals(0);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "BagOfCurvesOutsideClip2");
      expect(ck.getNumErrors()).equals(0);
    });
});

describe("ClipUtilities", () => {
  it("ClipUnionForBagOfCurves1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 30;
    // curve primitive
    const arc = Arc3d.createXY(Point3d.create(6, 0), 4, AngleSweep.createStartEndDegrees(-180, 180));
    // curve collection
    const lineString1 = LineString3d.create([[0, 5], [-1, 10], [-2, 5], [-3, 10], [-4, 5]]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(-4, 5), Point3d.create(-10, 0));
    const lineSegment2 = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-4, -5));
    const lineString2 = LineString3d.create([[-4, -5], [-3, -10], [-2, -5], [-1, -10], [0, -5]]);
    const lineSegment3 = LineSegment3d.create(Point3d.create(0, -5), Point3d.create(0, 5));
    const loop = Loop.create();
    loop.tryAddChild(lineString1);
    loop.tryAddChild(lineSegment1);
    loop.tryAddChild(lineSegment2);
    loop.tryAddChild(lineString2);
    loop.tryAddChild(lineSegment3);
    // bag of curves
    const bag = BagOfCurves.create(loop, arc);
    GeometryCoreTestIO.captureGeometry(allGeometry, bag);
    // clipper (clip union)
    const range1 = Range3d.createXYZXYZ(-8, -7, -3, -3, 8, 3);
    const clipper1 = ConvexClipPlaneSet.createRange3dPlanes(range1);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range1);
    const range2 = Range3d.createXYZXYZ(-2, -6, -3, 7, 6, 3);
    const clipper2 = ConvexClipPlaneSet.createRange3dPlanes(range2);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range2);
    const clipper = UnionOfConvexClipPlaneSets.createConvexSets([clipper1, clipper2]);
    // perform clip
    const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
    GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range1, shift);
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range2, shift);
    // save all geometries
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipUnionForBagOfCurves1");
    expect(ck.getNumErrors()).equals(0);
  }),
    it("ClipUnionForBagOfCurves2", () => {
      const ck = new Checker();
      const allGeometry: GeometryQuery[] = [];
      const shift = 30;
      // curve primitive
      const lineSegment = LineSegment3d.create(Point3d.create(-10, 0), Point3d.create(-5, 0));
      // curve collection
      const lineString = LineString3d.create([[0, 5], [10, 5], [10, -5], [0, -5], [0, 5]]);
      const loop = Loop.create();
      loop.tryAddChild(lineString);
      // bag of curves
      const bag = BagOfCurves.create(loop, lineSegment);
      GeometryCoreTestIO.captureGeometry(allGeometry, bag);
      // clipper (clip union)
      const range1 = Range3d.createXYZXYZ(-12, -10, -3, 2, 10, 3);
      const clipper1 = ConvexClipPlaneSet.createRange3dPlanes(range1);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range1);
      const range2 = Range3d.createXYZXYZ(4, -10, -3, 12, 10, 3);
      const clipper2 = ConvexClipPlaneSet.createRange3dPlanes(range2);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range2);
      const clipper = UnionOfConvexClipPlaneSets.createConvexSets([clipper1, clipper2]);
      // perform clip
      const clippedCurve = ClipUtilities.clipAnyCurve(bag, clipper);
      GeometryCoreTestIO.captureGeometry(allGeometry, clippedCurve, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range1, shift);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range2, shift);
      // sanity tests
      expect(clippedCurve.length).equals(2);
      const area = RegionOps.computeXYArea((clippedCurve[0] as AnyRegion))!;
      const expectedArea = (2 * 10) + (6 * 10);
      ck.testCoordinate(area, expectedArea);
      // save all geometries
      GeometryCoreTestIO.saveGeometry(allGeometry, "ClipUtilities", "ClipUnionForBagOfCurves2");
      expect(ck.getNumErrors()).equals(0);
    });
});
