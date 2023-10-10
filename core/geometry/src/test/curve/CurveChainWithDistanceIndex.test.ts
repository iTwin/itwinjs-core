/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import { Arc3d } from "../../curve/Arc3d";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// cspell:word XYAB, XYBA

const closestPointProblemFileFile = "./src/test/testInputs/CurveChainWithDistanceIndex/ClosestPointProblem.imjs";

describe("CurveChainWithDistanceIndex", () => {
  it("ClosestPointProblem", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const stringData = fs.readFileSync(closestPointProblemFileFile, "utf8");
    if (stringData) {
      const pathObject = IModelJson.Reader.parse(JSON.parse(stringData));
      if (pathObject) {
        if (ck.testType(pathObject, Path, "Expect a single path in input file")) {
          const pathAsPrimitive = CurveChainWithDistanceIndex.createCapture(pathObject)!;
          const origin = pathAsPrimitive.fractionToPoint(0);
          const x0 = -origin.x;
          const y0 = -origin.y;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, pathObject, x0, y0);
          const spacePoint = Point3d.create(643320.1669690917, 525619.9030407232, 71.80756000141672);
          const closestPointDetail = pathAsPrimitive.closestPoint(spacePoint, false);
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, spacePoint, 0.1, x0, y0);
          if (ck.testType(closestPointDetail, CurveLocationDetail)) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [spacePoint, closestPointDetail.point], x0, y0);
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "ClosestPointProblem");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PathWithBsplineLength", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const stringData = fs.readFileSync("./src/test/testInputs/CurveChainWithDistanceIndex/WoodfieldPath/pathWithBsplines.imjs", "utf8");
    if (ck.testDefined(stringData, "read file to json")) {
      const pathObject = IModelJson.Reader.parse(JSON.parse(stringData));
      if (ck.testDefined(pathObject, "parse json string")) {
        if (ck.testType(pathObject, Path, "Expect a single path in input file")) {
          const hzAlignment = CurveChainWithDistanceIndex.createCapture(pathObject)!;
          // const hzAlignment = pathObject.children [1];
          const origin = pathObject.children[0].fractionToPoint(0);
          const x0 = -origin.x;
          const y0 = -origin.y;

          for (const xStep of [0, -2.0, -4.0, 2.0, 4.0, 6.0, 8.0, 10.0]) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, hzAlignment, x0, y0);
            const markerRadius = 1.0;
            const pt1HighPrecision = Point3d.create(508700.76964477333 + xStep, 6645776.623467738, 2.617678667126464);
            const pt1LowPrecision = Point3d.create(508700.77 + xStep, 6645776.62, 2.62);
            const d1 = pt1HighPrecision.distance(pt1LowPrecision);
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, -4, pt1HighPrecision, markerRadius, x0, y0);
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pt1LowPrecision, markerRadius, x0, y0);
            const pt2HighPrecision = Point3d.create(508416.72699257644 + xStep, 6645655.675718992, 4.476972730828219);
            const pt2LowPrecision = Point3d.create(508416.726 + xStep, 6645655.675, 4.476);
            const d2 = pt2HighPrecision.distance(pt2LowPrecision);
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, -4, pt2HighPrecision, markerRadius, x0, y0);
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pt2LowPrecision, markerRadius, x0, y0);

            const getDistanceAlongFromStart = (pt: Point3d): number | undefined => {
              const detail = hzAlignment.closestPoint(pt, false);
              if (detail)
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pt, detail.point], x0, y0);
              return detail ? detail.fraction * hzAlignment.curveLength() : undefined;
            };

            const distAlong1High = getDistanceAlongFromStart(pt1HighPrecision);
            const distAlong1Low = getDistanceAlongFromStart(pt1LowPrecision);

            const distAlong2High = getDistanceAlongFromStart(pt2HighPrecision);
            const distAlong2Low = getDistanceAlongFromStart(pt2LowPrecision);
            if (distAlong1High !== undefined && distAlong1Low !== undefined)
              ck.testLE(Math.abs(distAlong1High - distAlong1Low), 3.0 * d1);
            if (distAlong2High !== undefined && distAlong2Low !== undefined)
              ck.testLE(Math.abs(distAlong2High - distAlong2Low), 3.0 * d2);
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "PathWithBsplineLength");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClonePartialFromExtendedClosestPointDetailFraction", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const paths = Sample.createCurveChainWithDistanceIndex();
    let x0 = 0;

    const offsetDist = 1;
    for (const path of paths) {
      const ray0 = path.fractionToPointAndUnitTangent(0);
      const ray1 = path.fractionToPointAndUnitTangent(1);
      ray0.direction.scaleInPlace(-offsetDist);
      ray1.direction.scaleInPlace(offsetDist);
      const detail0 = path.closestPoint(ray0.fractionToPoint(1), true)!;
      const detail1 = path.closestPoint(ray1.fractionToPoint(1), true)!;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, [detail0.point, detail1.point], 0.1, x0);

      const path0 = path.clonePartialCurve(detail0.fraction, 1)!;
      const path1 = path.clonePartialCurve(0, detail1.fraction)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [path, path0, path1], x0);

      ck.testLE(detail0.fraction, 1, "Point off path start has projection fraction <= 0");
      ck.testLE(1, detail1.fraction, "Point off path end has projection fraction >= 1");
      ck.testPoint3d(detail0.point, path0.startPoint(), "Point projected off path start equals start of clonedPartialCurve at projection fraction");
      ck.testPoint3d(detail0.point, path.fractionToPoint(detail0.fraction), "Point projected off path start equals fractionToPoint at projection fraction");
      ck.testPoint3d(detail1.point, path1.endPoint(), "Point projected off path end equals end of clonedPartialCurve at projection fraction");
      ck.testPoint3d(detail1.point, path.fractionToPoint(detail1.fraction), "Point projected off path end equals fractionToPoint at projection fraction");

      x0 += path.range().xLength() + 1;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "ClonePartialFromExtendedClosestPointDetailFraction");
    expect(ck.getNumErrors()).equals(0);
  });

  it("fractionToCurvature", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const frac = 0.3;

    const radius = 100.0;
    const expectedCurvature = 1 / radius;
    const arc = Arc3d.createXY(Point3d.createZero(), radius, AngleSweep.createStartEndRadians(0, Math.PI));
    const curvature = arc.fractionToCurvature(frac)!;
    const distanceAlongArc = arc.curveLengthBetweenFractions(0, frac);
    ck.testCoordinate(curvature, expectedCurvature, "expected circle curvature");

    const path = new Path();
    path.children.push(arc);
    const indexed = CurveChainWithDistanceIndex.createCapture(path);
    const pathFrac = indexed.chainDistanceToChainFraction(distanceAlongArc);
    ck.testCoordinate(pathFrac, frac, "arc and path consisting of arc have same (arc length) parameterization");
    const pathCurvature = indexed.fractionToCurvature(pathFrac)!;
    ck.testCoordinate(pathCurvature, expectedCurvature, "expected curvature of path consisting of a circle");

    const radiusB = 37.0;
    const arcB = Arc3d.createXYEllipse(Point3d.createZero(), radius, radiusB, AngleSweep.createStartEndRadians(Math.PI, 2 * Math.PI));
    const curvatureB = arcB.fractionToCurvature(frac)!;
    const distanceAlongArcB = arcB.curveLengthBetweenFractions(0, frac);

    const pathB = new Path();
    pathB.children.push(arc);
    pathB.children.push(arcB);
    const indexedB = CurveChainWithDistanceIndex.createCapture(pathB);
    const pathFracB = indexedB.chainDistanceToChainFraction(arc.curveLength() + distanceAlongArcB);
    const pathCurvatureB = indexedB.fractionToCurvature(pathFracB)!;
    ck.testCoordinate(curvatureB, pathCurvatureB, "curvature of arc equals curvature of path containing arc at same point");

    const arcC = arcB.clone();
    const distanceAlongArcC = distanceAlongArcB;
    const planeC = arcC.fractionToPointAnd2Derivatives(frac);
    const arcDerivC = LineSegment3d.create(planeC.origin, Point3d.createAdd2Scaled(planeC.origin, 1, planeC.vectorU, 1));
    const arcDeriv2C = LineSegment3d.create(planeC.origin, Point3d.createAdd2Scaled(planeC.origin, 1, planeC.vectorV, 1));
    const pathC = new Path();
    pathC.children.push(arcC);  // ellipse, not arc length parameterized
    const indexedC = CurveChainWithDistanceIndex.createCapture(pathC);
    const pathFracC = indexedC.chainDistanceToChainFraction(distanceAlongArcC);
    const pathPlaneC = indexedC.fractionToPointAnd2Derivatives(pathFracC)!;
    const pathDerivC = LineSegment3d.create(pathPlaneC.origin, Point3d.createAdd2Scaled(pathPlaneC.origin, 1, pathPlaneC.vectorU, 1));
    const pathDeriv2C = LineSegment3d.create(pathPlaneC.origin, Point3d.createAdd2Scaled(pathPlaneC.origin, 1, pathPlaneC.vectorV, 1));
    ck.testPoint3d(planeC.origin, pathPlaneC?.origin, "comparing same points along arc and path containing the arc");
    ck.testAngleNoShift(Angle.createRadians(0), planeC.vectorU.angleTo(pathPlaneC.vectorU), "arc and path containing the arc have same 1st derivative direction");
    ck.testFalse(planeC.vectorV.angleTo(pathPlaneC.vectorV).isAlmostZero, "arc and path containing the arc have different 2nd derivative directions");

    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcC, arcDerivC, arcDeriv2C]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [indexedC, pathDerivC, pathDeriv2C], 0, 0, 10);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "fractionToCurvature");
    expect(ck.getNumErrors()).equals(0);
  });
  it("closestApproachChainSegment", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = CurveChainWithDistanceIndex.createCapture(
      Path.create(LineString3d.create([-1, -1], [0, 0], [-4, 4])),
    );
    const geometryB = LineSegment3d.createXYXY(2, 0, 5, 2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test closest approach global fractions
    const closestApproachAB = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    const closestApproachBA = CurveCurve.closestApproachProjectedXYPair(geometryB, geometryA);
    // AB
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentAB = LineSegment3d.create(
      closestApproachAB!.detailA.point, closestApproachAB!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentAB);
    ck.testCoordinate(closestApproachAB!.detailA.fraction, 0.2, "AB detailA");
    ck.testCoordinate(closestApproachAB!.detailB.fraction, 0, "AB detailB");
    // BA
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentBA = LineSegment3d.create(
      closestApproachBA!.detailA.point, closestApproachBA!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentBA);
    ck.testCoordinate(closestApproachBA!.detailA.fraction, 0, "BA detailA");
    ck.testCoordinate(closestApproachBA!.detailB.fraction, 0.2, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "closestApproachChainSegment");
    expect(ck.getNumErrors()).equals(0);
  });

  it("closestApproachChainString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = CurveChainWithDistanceIndex.createCapture(
      Path.create(LineString3d.create([-2, -2], [0, 0], [-4, 4])),
    );
    const geometryB = LineString3d.create([2, -2], [2, 0], [8, 0], [8, -2], [6, -2]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test closest approach global fractions
    const closestApproachAB = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    const closestApproachBA = CurveCurve.closestApproachProjectedXYPair(geometryB, geometryA);
    // AB
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentAB = LineSegment3d.create(
      closestApproachAB!.detailA.point, closestApproachAB!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentAB);
    ck.testCoordinate(closestApproachAB!.detailA.fraction, 1 / 3, "AB detailA");
    ck.testCoordinate(closestApproachAB!.detailB.fraction, 1 / 4, "AB detailB");
    // BA
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentBA = LineSegment3d.create(
      closestApproachBA!.detailA.point, closestApproachBA!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentBA);
    ck.testCoordinate(closestApproachBA!.detailA.fraction, 1 / 4, "BA detailA");
    ck.testCoordinate(closestApproachBA!.detailB.fraction, 1 / 3, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "closestApproachChainString");
    expect(ck.getNumErrors()).equals(0);
  });

  it("closestApproachChainArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lineSegment = LineSegment3d.createXYXY(0, 5, 5, 5);
    const lineString1 = LineString3d.create([5, 5], [5, 3], [6, 3], [6, 5]);
    const lineString2 = LineString3d.create([6, 5], [11, 5], [11, 0]);
    const path = Path.create();
    path.tryAddChild(lineSegment);
    path.tryAddChild(lineString1);
    path.tryAddChild(lineString2);
    const geometryA = CurveChainWithDistanceIndex.createCapture(path);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(4, 0), Point3d.create(6, 2), Point3d.create(8, 0),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test closest approach global fractions
    const closestApproachAB = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    const closestApproachBA = CurveCurve.closestApproachProjectedXYPair(geometryB, geometryA);
    // AB
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentAB = LineSegment3d.create(
      closestApproachAB!.detailA.point, closestApproachAB!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentAB);
    ck.testCoordinate(closestApproachAB!.detailA.fraction, 0.4, "AB detailA");
    ck.testCoordinate(closestApproachAB!.detailB.fraction, 0.5, "AB detailB");
    // BA
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentBA = LineSegment3d.create(
      closestApproachBA!.detailA.point, closestApproachBA!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentBA);
    ck.testCoordinate(closestApproachBA!.detailA.fraction, 0.5, "BA detailA");
    ck.testCoordinate(closestApproachBA!.detailB.fraction, 0.4, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "closestApproachChainArc");
    expect(ck.getNumErrors()).equals(0);
  });

  it("closestApproachChainChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // first CurveChainWithDistanceIndex
    const lineSegment1 = LineSegment3d.createXYXY(-1, 5, 5, 5);
    const lineString1 = LineString3d.create([5, 5], [5, 3], [6, 3], [6, 5]);
    const lineString2 = LineString3d.create([6, 5], [10, 5], [10, 0]);
    const path1 = Path.create();
    path1.tryAddChild(lineSegment1);
    path1.tryAddChild(lineString1);
    path1.tryAddChild(lineString2);
    const geometryA = CurveChainWithDistanceIndex.createCapture(path1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // second CurveChainWithDistanceIndex
    const lineSegment2 = LineSegment3d.createXYXY(-1, 0, 3, 0);
    const lineString3 = LineString3d.create([3, 0], [5, 0], [5, -3], [12, -3]);
    const lineSegment3 = LineSegment3d.createXYXY(12, -3, 14, -3);
    const path2 = Path.create();
    path2.tryAddChild(lineSegment2);
    path2.tryAddChild(lineString3);
    path2.tryAddChild(lineSegment3);
    const geometryB = CurveChainWithDistanceIndex.createCapture(path2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test closest approach global fractions
    const closestApproachAB = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    const closestApproachBA = CurveCurve.closestApproachProjectedXYPair(geometryB, geometryA);
    // AB
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentAB = LineSegment3d.create(
      closestApproachAB!.detailA.point, closestApproachAB!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentAB);
    ck.testCoordinate(closestApproachAB!.detailA.fraction, 0.4, "AB detailA");
    ck.testCoordinate(closestApproachAB!.detailB.fraction, 1 / 3, "AB detailB");
    // BA
    ck.testDefined(closestApproachAB);
    const closestApproachSegmentBA = LineSegment3d.create(
      closestApproachBA!.detailA.point, closestApproachBA!.detailB.point,
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, closestApproachSegmentBA);
    ck.testCoordinate(closestApproachBA!.detailA.fraction, 1 / 3, "BA detailA");
    ck.testCoordinate(closestApproachBA!.detailB.fraction, 0.4, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "closestApproachChainChain");
    expect(ck.getNumErrors()).equals(0);
  });

  it("closestApproachChainLoops", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const semicircleCW = Arc3d.createXY(Point3d.createZero(), 3, AngleSweep.createStartEndDegrees(-45, -225));
    const diameter = LineSegment3d.createCapture(semicircleCW.endPoint(), semicircleCW.startPoint());
    const chainA = CurveChainWithDistanceIndex.createCapture(Loop.createArray([semicircleCW, diameter]));
    const lowestPolygonPoint = Point3d.create(-4, -4, 2);
    const skewPlanePolygon = [Point3d.create(4, 4, 8), Point3d.create(-4, 4, 5), lowestPolygonPoint, Point3d.create(4, -4, 5)];
    const chainB = CurveChainWithDistanceIndex.createCapture(Loop.createPolygon(skewPlanePolygon));
    const pairs = CurveCurve.closeApproachProjectedXYPairs(chainA, chainB, 1.5);
    // known fractions of xy close approaches
    const arcFractionOfChain = semicircleCW.curveLength() / chainA.curveLength();
    const xyApproachFractionA0 = 0.25 * arcFractionOfChain;
    const xyApproachFractionA1 = 3 * xyApproachFractionA0;
    const xyApproachFractionB0 = 0.625;
    const xyApproachFractionB1 = 0.375;
    if (ck.testExactNumber(pairs.length, 2, "found two close approaches")) {
      const xyApproachDistance0 = pairs[0].detailA.point.distanceXY(pairs[0].detailB.point);
      const xyApproachDistance1 = pairs[1].detailA.point.distanceXY(pairs[1].detailB.point);
      ck.testCoordinate(xyApproachDistance0, xyApproachDistance1, "close approaches are the same distance");
      const xyApproachDistance3D = pairs[0].detailA.point.distance(pairs[0].detailB.point);
      const xyzApproachDistance = chainA.closestPoint(lowestPolygonPoint, false);
      if (ck.testType(xyzApproachDistance, CurveLocationDetail, "found 3D closest approach between chains"))
        ck.testLT(xyzApproachDistance.a, xyApproachDistance3D, "3D closest approach is actually closer");
      for (const pair of pairs) {
        if (Geometry.isSmallRelative(pair.detailA.fraction - xyApproachFractionA0))
          ck.testTrue(Geometry.isSmallRelative(pair.detailB.fraction - xyApproachFractionB0), "has expected close approach 0");
        else if (Geometry.isSmallRelative(pair.detailA.fraction - xyApproachFractionA1))
          ck.testTrue(Geometry.isSmallRelative(pair.detailB.fraction - xyApproachFractionB1), "has expected close approach 1");
        else
          ck.announceError("unexpected close approach");
      }
      GeometryCoreTestIO.captureGeometry(allGeometry, [chainA, chainB, LineSegment3d.create(pairs[0].detailA.point, pairs[0].detailB.point), LineSegment3d.create(pairs[1].detailA.point, pairs[1].detailB.point)]);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "closestApproachChainLoops");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYChainSegment", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = CurveChainWithDistanceIndex.createCapture(
      Path.create(LineString3d.create([-1, -1], [0, 0], [-4, 4])),
    );
    const geometryB = LineSegment3d.createXYXY(-2, 0, 2, 4);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(-1, 1));
    // AB
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 0.4, "AB detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 0.25, "AB detailB");
    // BA
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 0.25, "BA detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 0.4, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYChainSegment");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYChainString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = CurveChainWithDistanceIndex.createCapture(
      Path.create(LineString3d.create([-1, -2], [1, 0], [-3, 4])),
    );
    const geometryB = LineString3d.create([-3, -2], [-3, 0], [2, 0], [2, -2], [0, -2]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(1, 0));
    // AB
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 1 / 3, "AB detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 0.45, "AB detailB");
    // BA
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 0.45, "BA detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 1 / 3, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYChainString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYChainArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lineSegment = LineSegment3d.createXYXY(6, 0, 6, 3);
    const lineString1 = LineString3d.create([6, 3], [5, 3], [5, 5], [8, 5]);
    const lineString2 = LineString3d.create([8, 5], [8, 4], [11, 4], [11, 1]);
    const path = Path.create();
    path.tryAddChild(lineSegment);
    path.tryAddChild(lineString1);
    path.tryAddChild(lineString2);
    const geometryA = CurveChainWithDistanceIndex.createCapture(path);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(4, 0), Point3d.create(6, 2), Point3d.create(8, 0),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(6, 2));
    // AB
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 1 / 8, "AB detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 0.5, "AB detailB");
    // BA
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 0.5, "BA detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 1 / 8, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYChainArc");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYChainChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // first CurveChainWithDistanceIndex
    const lineSegment1 = LineSegment3d.createXYXY(-5, 1, 2, 1);
    const lineString1 = LineString3d.create([2, 1], [2, -1], [3, -1], [3, 1]);
    const lineString2 = LineString3d.create([3, 1], [7, 1], [7, -2]);
    const path1 = Path.create();
    path1.tryAddChild(lineSegment1);
    path1.tryAddChild(lineString1);
    path1.tryAddChild(lineString2);
    const geometryA = CurveChainWithDistanceIndex.createCapture(path1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // second CurveChainWithDistanceIndex
    const lineSegment2 = LineSegment3d.createXYXY(-1, 0, 3, 0);
    const lineString3 = LineString3d.create([3, 0], [5, 0], [5, -3], [12, -3]);
    const lineSegment3 = LineSegment3d.createXYXY(12, -3, 14, -3);
    const path2 = Path.create();
    path2.tryAddChild(lineSegment2);
    path2.tryAddChild(lineString3);
    path2.tryAddChild(lineSegment3);
    const geometryB = CurveChainWithDistanceIndex.createCapture(path2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersectionXYAB.length);
    // intersection 1
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(2, 0));
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 8 / 19, "AB0 detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 3 / 18, "AB0 detailB");
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 3 / 18, "BA0 detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 8 / 19, "BA0 detailB");
    // intersection 2
    ck.testPoint3d(intersectionXYAB[1].detailA.point, intersectionXYBA[1].detailA.point);
    ck.testPoint3d(intersectionXYAB[1].detailA.point, Point3d.create(3, 0));
    ck.testCoordinate(intersectionXYAB[1].detailA.fraction, 11 / 19, "AB1 detailA");
    ck.testCoordinate(intersectionXYAB[1].detailB.fraction, 4 / 18, "AB1 detailB");
    ck.testCoordinate(intersectionXYBA[1].detailA.fraction, 4 / 18, "BA1 detailA");
    ck.testCoordinate(intersectionXYBA[1].detailB.fraction, 11 / 19, "BA1 detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYChainChain");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYZChainSegment", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = CurveChainWithDistanceIndex.createCapture(
      Path.create(LineString3d.create([-1, -1, 1], [0, 0, 1], [-4, 4, 1])),
    );
    const geometryB = LineSegment3d.createXYZXYZ(-1, 1, -1, -1, 1, 3);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYZPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(-1, 1, 1));
    // AB
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 0.4, "AB detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 0.5, "AB detailB");
    // BA
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 0.5, "BA detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 0.4, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYZChainSegment");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYZChainString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = CurveChainWithDistanceIndex.createCapture(
      Path.create(LineString3d.create([-1, -2, 1], [1, 0, 1], [-3, 4, 1])),
    );
    const geometryB = LineString3d.create([-3, 0, -1], [-3, 0, 1], [2, 0, 1], [2, 0, -1], [2, -2, -1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYZPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(1, 0, 1));
    // AB
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 1 / 3, "AB detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 0.45, "AB detailB");
    // BA
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 0.45, "BA detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 1 / 3, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYZChainString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYZChainArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lineSegment = LineSegment3d.createXYZXYZ(6, 0, -1, 6, 3, -1);
    const lineString1 = LineString3d.create([6, 3, -1], [5, 3, -1], [5, 5, -1], [8, 5, -1]);
    const lineString2 = LineString3d.create([8, 5, -1], [8, 4, -1], [11, 4, -1], [11, 4, 2]);
    const path = Path.create();
    path.tryAddChild(lineSegment);
    path.tryAddChild(lineString1);
    path.tryAddChild(lineString2);
    const geometryA = CurveChainWithDistanceIndex.createCapture(path);
    const geometryB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(4, 2, 1), Point3d.create(6, 2, -1), Point3d.create(8, 2, 1),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYZPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(6, 2, -1));
    // AB
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 1 / 8, "AB detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 0.5, "AB detailB");
    // BA
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 0.5, "BA detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 1 / 8, "BA detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYZChainArc");
    expect(ck.getNumErrors()).equals(0);
  });
  it("intersectXYZChainChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // first CurveChainWithDistanceIndex
    const lineSegment1 = LineSegment3d.createXYZXYZ(2, 1, 8, 2, 1, 1);
    const lineString1 = LineString3d.create([2, 1, 1], [2, -1, 1], [3, -1, 1], [3, 1, 1]);
    const lineString2 = LineString3d.create([3, 1, 1], [7, 1, 1], [7, 1, -2]);
    const path1 = Path.create();
    path1.tryAddChild(lineSegment1);
    path1.tryAddChild(lineString1);
    path1.tryAddChild(lineString2);
    const geometryA = CurveChainWithDistanceIndex.createCapture(path1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // second CurveChainWithDistanceIndex
    const lineSegment2 = LineSegment3d.createXYZXYZ(-1, 0, 1, 3, 0, 1);
    const lineString3 = LineString3d.create([3, 0, 1], [5, 0, 1], [5, -3, 1], [12, -3, 1]);
    const lineSegment3 = LineSegment3d.createXYZXYZ(12, -3, 1, 12, -3, 3);
    const path2 = Path.create();
    path2.tryAddChild(lineSegment2);
    path2.tryAddChild(lineString3);
    path2.tryAddChild(lineSegment3);
    const geometryB = CurveChainWithDistanceIndex.createCapture(path2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // test intersectionXY global fractions
    const intersectionXYAB = CurveCurve.intersectionXYZPairs(geometryA, false, geometryB, false);
    const intersectionXYBA = CurveCurve.intersectionXYZPairs(geometryB, false, geometryA, false);
    GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, intersectionXYAB, 0.05);
    ck.testDefined(intersectionXYAB);
    ck.testDefined(intersectionXYBA);
    const numExpected = 2;
    ck.testExactNumber(numExpected, intersectionXYAB.length);
    // intersection 1
    ck.testPoint3d(intersectionXYAB[0].detailA.point, intersectionXYBA[0].detailA.point);
    ck.testPoint3d(intersectionXYAB[0].detailA.point, Point3d.create(2, 0, 1));
    ck.testCoordinate(intersectionXYAB[0].detailA.fraction, 8 / 19, "AB0 detailA");
    ck.testCoordinate(intersectionXYAB[0].detailB.fraction, 3 / 18, "AB0 detailB");
    ck.testCoordinate(intersectionXYBA[0].detailA.fraction, 3 / 18, "BA0 detailA");
    ck.testCoordinate(intersectionXYBA[0].detailB.fraction, 8 / 19, "BA0 detailB");
    // intersection 2
    ck.testPoint3d(intersectionXYAB[1].detailA.point, intersectionXYBA[1].detailA.point);
    ck.testPoint3d(intersectionXYAB[1].detailA.point, Point3d.create(3, 0, 1));
    ck.testCoordinate(intersectionXYAB[1].detailA.fraction, 11 / 19, "AB1 detailA");
    ck.testCoordinate(intersectionXYAB[1].detailB.fraction, 4 / 18, "AB1 detailB");
    ck.testCoordinate(intersectionXYBA[1].detailA.fraction, 4 / 18, "BA1 detailA");
    ck.testCoordinate(intersectionXYBA[1].detailB.fraction, 11 / 19, "BA1 detailB");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveChainWithDistanceIndex", "intersectXYZChainChain");
    expect(ck.getNumErrors()).equals(0);
  });
  it("recursionAvoidance", () => {
    const ck = new Checker();
    const pts: Point3d[] = Array(7).fill(null).map((_v: Point3d, i: number) => { return Point3d.create(i, i, i); });
    const childChain0 = CurveChainWithDistanceIndex.createCapture(Path.create([pts[1], pts[2], pts[3]]));
    const childChain1 = CurveChainWithDistanceIndex.createCapture(Path.create([pts[4], pts[5], pts[6]]));
    const path = Path.create(LineSegment3d.create(pts[0], pts[1]), childChain0, LineSegment3d.create(pts[3], pts[4]), childChain1);
    const chain = CurveChainWithDistanceIndex.createCapture(path);
    for (const child of chain.path.children)
      ck.testFalse(child instanceof CurveChainWithDistanceIndex, "no embedded chains");
    expect(ck.getNumErrors()).equals(0);
  });
});
