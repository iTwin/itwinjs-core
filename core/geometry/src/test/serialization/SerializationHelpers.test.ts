/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { BSplineWrapMode } from "../../core-geometry";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { NumberArray, Point3dArray, Point4dArray } from "../../geometry3d/PointHelpers";
import { Point4d } from "../../geometry4d/Point4d";
import { SerializationHelpers } from "../../serialization/SerializationHelpers";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

function createCurveData(curve: BSplineCurve3dH): SerializationHelpers.BSplineCurveData {
  const params: SerializationHelpers.BSplineParams = { numPoles: curve.numPoles, order: curve.order, knots: curve.copyKnots(false), closed: false, wrapMode: curve.getWrappable() };
  return { poles: curve.copyXYZFloat64Array(false), dim: 3, weights: NumberArray.create(curve.copyWeightsFloat64Array()), params };
}

function unpackPoles(poles: Float64Array | number[][], dim: number, weights?: Float64Array | number[]): { xyz?: Float64Array, w?: Float64Array} {
  let xyz: Float64Array | undefined;
  let w: Float64Array | undefined;
  if (dim === 3) {
    xyz = (poles instanceof Float64Array) ? poles : NumberArray.pack(poles);
    if (weights)
      w = (weights instanceof Float64Array) ? weights : NumberArray.pack(weights);
  } else if (dim === 4) {
    const myPoles: Point3d[] = [];
    const myWeights: number[] = [];
    let poles4d = (poles instanceof Float64Array) ? poles : NumberArray.pack(poles);
    Point4dArray.unpackFloat64ArrayToPointsAndWeights(poles4d, myPoles, myWeights);
    xyz = Point3dArray.packToFloat64Array(myPoles);
    w = NumberArray.pack(myWeights);
  }
  return {xyz, w};
}

// does not handle fake closure (BSplineWrapMode.OpenByRemovingKnots)
function almostEqualCurveData(data0: SerializationHelpers.BSplineCurveData, data1: SerializationHelpers.BSplineCurveData): boolean {
  if (data0.dim !== data1.dim)
    return false;
  if (data0.params.order !== data1.params.order)
    return false;
  const degree = data0.params.order - 1;
  if (Geometry.resolveValue<BSplineWrapMode>(data0.params.wrapMode, BSplineWrapMode.None) !== Geometry.resolveValue<BSplineWrapMode>(data1.params.wrapMode, BSplineWrapMode.None))
    return false;
  // closure is allowed to differ, and if so, adds admissible pole/weight count differences
  const closed0 = Geometry.resolveValue<boolean>(data0.params.closed, false);
  const closed1 = Geometry.resolveValue<boolean>(data1.params.closed, false);
  const unpacked0 = unpackPoles(data0.poles, data0.dim, data0.weights);
  const unpacked1 = unpackPoles(data1.poles, data1.dim, data1.weights);
  if (closed0 === closed1) {
    if (data0.params.numPoles !== data1.params.numPoles)
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.xyz, unpacked1.xyz))
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.w, unpacked1.w))
      return false;
  } else {  // differing closure means poles & weights have different counts
    if ((data0.params.numPoles - degree !== data1.params.numPoles) &&
        (data0.params.numPoles !== data1.params.numPoles - degree))
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.xyz?.slice(0, -degree * 3), unpacked1.xyz) &&
        !NumberArray.isAlmostEqual(unpacked0.xyz, unpacked1.xyz?.slice(0, -degree * 3)))
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.w?.slice(0, -degree), unpacked1.w) &&
        !NumberArray.isAlmostEqual(unpacked0.w, unpacked1.w?.slice(0, -degree)))
      return false;
  }
  // account for extraneous knots
  if (!NumberArray.isAlmostEqual(data0.params.knots, data1.params.knots) &&
      !NumberArray.isAlmostEqual(data0.params.knots.slice(1, -1), data1.params.knots) &&
      !NumberArray.isAlmostEqual(data0.params.knots, data1.params.knots.slice(1, -1)))
    return false;
  return true;
}

describe("SerializationHelpers", () => {
  // coverage for branches not hit during other serialization tests
  it.only("CurveCoverage", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const unweightedPoles3d = [Point3d.create(1,-1,-1), Point3d.create(1,1,1), Point3d.create(-1,1,-1), Point3d.create(-1,-1,1)];
    const weights = [0.3, 0.5, 0.2, 0.7];
    unweightedPoles3d.push(unweightedPoles3d[0].clone()); // cover wraparound logic
    weights.push(weights[0]);
    ck.testExactNumber(unweightedPoles3d.length, weights.length);
    const poles4d: Point4d[] = [];
    for (let i = 0; i < unweightedPoles3d.length; ++i)
      poles4d.push(Point4d.create(unweightedPoles3d[i].x, unweightedPoles3d[i].y, unweightedPoles3d[i].z, 1.0).scale(weights[i]));
    // test open and (maximally continuous) periodic curves
    const openCurve = BSplineCurve3dH.createUniformKnots(poles4d, 4);
    const closedCurve = BSplineCurve3dH.createPeriodicUniformKnots(poles4d, 3);
    if (ck.testType(openCurve, BSplineCurve3dH, "BSplineCurve3dH.createUniformKnots returned a homogeneous curve") &&
        ck.testType(closedCurve, BSplineCurve3dH, "BSplineCurve3dH.createPeriodicUniformKnots returned a periodic homogeneous curve")) {
      for (const curve of [openCurve, closedCurve]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve);
        const origData = createCurveData(curve);
        // test Export
        const exportData = SerializationHelpers.cloneBSplineCurveData(origData);
        if (ck.testTrue(SerializationHelpers.Export.prepareBSplineCurveData(exportData), "Export.prepareBSplineCurveData on valid input succeeds"))
          ck.testTrue(almostEqualCurveData(exportData, origData), "Export.prepareBSplineCurveData on valid input yields equivalent data");
        if (true) {
          let data = SerializationHelpers.cloneBSplineCurveData(origData);
          if (curve.isClosable) {
            data.dim = 0;
            ck.testFalse(SerializationHelpers.Export.prepareBSplineCurveData(data), "Export.prepareBSplineCurveData with invalid input fails");
            data = SerializationHelpers.cloneBSplineCurveData(origData);
            data.params.numPoles = 0;
            ck.testFalse(SerializationHelpers.Export.prepareBSplineCurveData(data), "Export.prepareBSplineCurveData with invalid input fails");
            data = SerializationHelpers.cloneBSplineCurveData(origData);
          }
          data.weights = curve.copyWeightsFloat64Array();
          if (ck.testTrue(SerializationHelpers.Export.prepareBSplineCurveData(data, { jsonPoles: true }), "Export.prepareBSplineCurveData with jsonPoles and Float64Array weights succeeds"))
            ck.testTrue(almostEqualCurveData(data, origData), "Export.prepareBSplineCurveData with jsonPoles and Float64Array weights yields equivalent data");
          data = SerializationHelpers.cloneBSplineCurveData(origData);
          data.params.knots = curve.knotsRef;
          if (ck.testTrue(SerializationHelpers.Export.prepareBSplineCurveData(data, { jsonKnots: true }), "Export.prepareBSplineCurveData with jsonKnots and Float64Array knots succeeds"))
            ck.testTrue(almostEqualCurveData(data, origData), "Export.prepareBSplineCurveData with jsonKnots and Float64Array knots yields equivalent data");
          data = SerializationHelpers.cloneBSplineCurveData(origData);
          if (ck.testTrue(SerializationHelpers.Export.prepareBSplineCurveData(data, { jsonKnots: false }), "Export.prepareBSplineCurveData with !jsonKnots and number[] knots succeeds"))
            ck.testTrue(almostEqualCurveData(data, origData), "Export.prepareBSplineCurveData with !jsonKnots and number[] knots yields equivalent data");
        }
        // test Import
        const importData = SerializationHelpers.cloneBSplineCurveData(exportData);
        if (ck.testTrue(SerializationHelpers.Import.prepareBSplineCurveData(importData), "Import.prepareBSplineCurveData on valid input succeeds"))
          ck.testTrue(almostEqualCurveData(importData, origData), "Import.prepareBSplineCurveData on valid input yields equivalent data");
        if (true) {
          let data = SerializationHelpers.cloneBSplineCurveData(exportData);
          if (ck.testTrue(SerializationHelpers.Import.prepareBSplineCurveData(data, { removeExtraKnots: true }), "Import.prepareBSplineCurveData with removeExtraKnots succeeds"))
            ck.testTrue(almostEqualCurveData(data, exportData), "Import.prepareBSplineCurveData with removeExtraKnots yields equivalent data");
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "SerializationHelpers", "CurveCoverage");
    expect(ck.getNumErrors()).equals(0);
  });
});
