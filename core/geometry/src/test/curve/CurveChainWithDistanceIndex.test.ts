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
});

