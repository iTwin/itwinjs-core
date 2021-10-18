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
});
