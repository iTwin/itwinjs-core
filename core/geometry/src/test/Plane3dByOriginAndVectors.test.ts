/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Vector3d, Vector2d } from "../PointVector";
import { Plane3dByOriginAndVectors } from "../AnalyticGeometry";
import { Checker } from "./Checker";
import { expect } from "chai";

describe("Plane3dByOriginAndVectors", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const pointA = Point3d.create(3, 2, 9);
    const vectorU = Vector3d.create(5, 2, 1);
    const vectorV = Vector3d.create(-3, 4, 1);
    const planeAUV = Plane3dByOriginAndVectors.createOriginAndVectors(pointA, vectorU, vectorV);
    const planeAUVR = Plane3dByOriginAndVectors.createOriginAndVectors(pointA, vectorU, vectorV,
      Plane3dByOriginAndVectors.createXYPlane());
    ck.testTrue(planeAUV.isAlmostEqual(planeAUVR), "default create");

    const planeX = Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      pointA.x, pointA.y, pointA.z,
      vectorU.x, vectorU.y, vectorU.z,
      vectorV.x, vectorV.y, vectorV.z);
    const planeXR = Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      pointA.x, pointA.y, pointA.z,
      vectorU.x, vectorU.y, vectorU.z,
      vectorV.x, vectorV.y, vectorV.z,
      Plane3dByOriginAndVectors.createXYPlane());
    const planeF64 = Plane3dByOriginAndVectors.createOriginAndVectorsArrays(
      pointA.toFloat64Array(), vectorU.toFloat64Array(), vectorV.toFloat64Array());
    const planeF64R = Plane3dByOriginAndVectors.createOriginAndVectorsArrays(
      pointA.toFloat64Array(), vectorU.toFloat64Array(), vectorV.toFloat64Array(),
      Plane3dByOriginAndVectors.createXYPlane());

    const planeY = Plane3dByOriginAndVectors.createXYPlane();
    planeY.setOriginAndVectors(pointA, vectorU, vectorV);
    ck.testTrue(planeX.isAlmostEqual(planeY));

    const planeT = Plane3dByOriginAndVectors.createOriginAndTargets(pointA,
      pointA.plus(vectorU), pointA.plus(vectorV));
    ck.testTrue(planeX.isAlmostEqual(planeT));

    const planeCR = Plane3dByOriginAndVectors.createCapture(pointA.clone(), vectorU.clone(), vectorV.clone(),
      Plane3dByOriginAndVectors.createXYPlane());
    ck.testTrue(planeX.isAlmostEqual(planeCR), "createCapture to result");
    ck.testTrue(planeAUV.isAlmostEqual(planeX), "default create");
    ck.testTrue(planeX.isAlmostEqual(planeXR));
    ck.testTrue(planeAUV.isAlmostEqual(planeF64), "default create");
    ck.testTrue(planeX.isAlmostEqual(planeF64R));

    const uv0 = Vector2d.create(1, 2);
    const uv1 = Vector2d.create(5, 2);
    const delta = Vector2d.create(uv1.x - uv0.x, uv1.y - uv0.y);

    const xyz0 = planeX.fractionToPoint(uv0.x, uv0.y);
    const xyz1 = planeX.fractionToPoint(uv1.x, uv1.y);
    const dxyz = planeX.fractionToVector(delta.x, delta.y);
    ck.testVector3d(dxyz, Vector3d.createStartEnd(xyz0, xyz1));

    const jsonForm = planeX.toJSON();
    const planeFromJson = Plane3dByOriginAndVectors.fromJSON(jsonForm);
    ck.testTrue(planeX.isAlmostEqual(planeFromJson));
    // exercise error branches and supplied result ..
    const errorPlane = Plane3dByOriginAndVectors.fromJSON();
    ck.testPointer(errorPlane);

    const errorPlane1 = Plane3dByOriginAndVectors.createOriginAndVectorsWeightedArrays(
      new Float64Array([1, 1, 1, 0]),  // weight 0 at origin fails !!!
      new Float64Array([2, 1, 3, 0]),
      new Float64Array([4, 9, 1, 1]));
    ck.testTrue (errorPlane1.isAlmostEqual (Plane3dByOriginAndVectors.createXYPlane ()));
    ck.checkpoint("Plane3dByOriginAndVectors.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
