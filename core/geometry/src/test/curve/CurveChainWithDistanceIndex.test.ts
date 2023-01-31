/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Checker } from "../Checker";
import * as fs from "fs";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Path } from "../../curve/Path";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Sample } from "../../serialization/GeometrySamples";
import { Arc3d } from "../../curve/Arc3d";

/* eslint-disable no-console */
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

          for (const xStep of [0, -2.0, -4.0, 2.0, 4.0, 6.0, 8.0, 10.0]){
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, hzAlignment, x0, y0);
            const markerRadius = 1.0;
            const pt1HighPrecision = Point3d.create(508700.76964477333 + xStep, 6645776.623467738, 2.617678667126464);
            const pt1LowPrecision = Point3d.create(508700.77 + xStep, 6645776.62, 2.62);
            const d1 = pt1HighPrecision.distance (pt1LowPrecision);
            GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, -4, pt1HighPrecision, markerRadius, x0, y0);
            GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 0, pt1LowPrecision, markerRadius, x0, y0);
            const pt2HighPrecision = Point3d.create(508416.72699257644 + xStep, 6645655.675718992, 4.476972730828219);
            const pt2LowPrecision = Point3d.create(508416.726 + xStep, 6645655.675, 4.476);
            const d2 = pt2HighPrecision.distance (pt2LowPrecision);
            GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, -4, pt2HighPrecision, markerRadius, x0, y0);
            GeometryCoreTestIO.createAndCaptureXYMarker (allGeometry, 0, pt2LowPrecision, markerRadius, x0, y0);

            const getDistanceAlongFromStart = (pt: Point3d): number | undefined => {
              const detail = hzAlignment.closestPoint(pt, false);
              if (detail)
                GeometryCoreTestIO.captureCloneGeometry (allGeometry, [pt, detail.point], x0, y0);
              return detail ? detail.fraction * hzAlignment.curveLength() : undefined;
            };

            const distAlong1High = getDistanceAlongFromStart(pt1HighPrecision);
            const distAlong1Low = getDistanceAlongFromStart(pt1LowPrecision);

            const distAlong2High = getDistanceAlongFromStart(pt2HighPrecision);
            const distAlong2Low = getDistanceAlongFromStart(pt2LowPrecision);
            if (distAlong1High !== undefined && distAlong1Low !== undefined)
                ck.testLE (Math.abs (distAlong1High - distAlong1Low), 3.0 * d1);
            if (distAlong2High !== undefined && distAlong2Low !== undefined)
                ck.testLE (Math.abs (distAlong2High - distAlong2Low), 3.0 * d2);
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
    const radius = 100.0;
    const arc = Arc3d.createXY(Point3d.createZero(), radius);
    let curvature = arc.fractionToCurvature(0.0)!;
    ck.testCoordinate(curvature, 1.0 / radius);

    const path = new Path();
    path.children.push(arc);

    const indexed = CurveChainWithDistanceIndex.createCapture(path);
    curvature = indexed.fractionToCurvature(0.0)!;
    ck.testCoordinate(curvature, 1.0 / radius);

    expect(ck.getNumErrors()).equals(0);
  });
});

