/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { BSplineSurface3dH, UVSelect } from "../../bspline/BSplineSurface";
import { BSplineWrapMode, KnotVector } from "../../bspline/KnotVector";
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

function createSurfaceData(surface: BSplineSurface3dH): SerializationHelpers.BSplineSurfaceData {
  const uParams: SerializationHelpers.BSplineParams = { numPoles: surface.numPolesUV(UVSelect.uDirection), order: surface.orderUV(UVSelect.uDirection), knots: surface.copyKnots(UVSelect.uDirection, false), closed: false, wrapMode: surface.getWrappable(UVSelect.uDirection) };
  const vParams: SerializationHelpers.BSplineParams = { numPoles: surface.numPolesUV(UVSelect.vDirection), order: surface.orderUV(UVSelect.vDirection), knots: surface.copyKnots(UVSelect.vDirection, false), closed: false, wrapMode: surface.getWrappable(UVSelect.vDirection) };
  return { poles: surface.copyXYZToFloat64Array(false), dim: 3, weights: NumberArray.unpack2d(surface.copyWeightsToFloat64Array(), surface.numPolesUV(UVSelect.uDirection)), uParams, vParams };
}

function unpackPoles(poles: Float64Array | number[][] | number[][][], dim: number, weights?: Float64Array | number[][] | number[]): { xyz?: Float64Array, w?: Float64Array} {
  let xyz: Float64Array | undefined;
  let w: Float64Array | undefined;
  if (dim === 3) {
    xyz = (poles instanceof Float64Array) ? poles : NumberArray.pack(poles);
    if (weights)
      w = (weights instanceof Float64Array) ? weights : NumberArray.pack(weights);
  } else if (dim === 4) {
    const myPoles: Point3d[] = [];
    const myWeights: number[] = [];
    const poles4d = (poles instanceof Float64Array) ? poles : NumberArray.pack(poles);
    Point4dArray.unpackFloat64ArrayToPointsAndWeights(poles4d, myPoles, myWeights);
    xyz = Point3dArray.packToFloat64Array(myPoles);
    w = NumberArray.pack(myWeights);
  }
  return {xyz, w};
}

function cloneSubArray(a?: Float64Array | number[] | number[][] | number[][][], numRow = 0, numCol = 0, dim = 1, iRow0 = 0, iRow1 = numRow, iCol0 = 0, iCol1 = numCol): Float64Array {
  if (!a || numRow <= 0 || numCol <= 0 || dim <= 0)
    return new Float64Array();
  if (iRow1 < 0)
    iRow1 = numRow + iRow1;
  if (iCol1 < 0)
    iCol1 = numCol + iCol1;
  if (iRow0 >= iRow1 || iCol0 >= iCol1)
    return new Float64Array();
  const aPacked = (a instanceof Float64Array) ? a : NumberArray.pack(a);
  const aSub = new Float64Array((iRow1 - iRow0) * (iCol1 - iCol0) * dim);
  let i = 0;
  for (let row = iRow0; row < iRow1; ++row)
    for  (let col = iCol0; col < iCol1; ++col)
      for (let component = 0; component < dim; ++component)
        aSub[i++] = aPacked[(row * numCol + col) * dim + component];
  return aSub;
}

function almostEqualSubArrays(a?: Float64Array | number[], b?: Float64Array | number[], ia0 = 0, ia1 = a?.length, ib0 = 0, ib1 = b?.length): boolean {
  return NumberArray.isAlmostEqual(a?.slice(ia0, ia1), b?.slice(ib0, ib1));
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
  const unpacked0 = unpackPoles(data0.poles, data0.dim, data0.weights);
  const unpacked1 = unpackPoles(data1.poles, data1.dim, data1.weights);
  // closure is allowed to differ
  const closed0 = Geometry.resolveValue<boolean>(data0.params.closed, false);
  const closed1 = Geometry.resolveValue<boolean>(data1.params.closed, false);
  if (closed0 === closed1) {
    if (!NumberArray.isAlmostEqual(unpacked0.xyz, unpacked1.xyz))
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.w, unpacked1.w))
      return false;
  } else {  // differing closure means poles/weights should have counts that differ by degree
    if (!almostEqualSubArrays(unpacked0.xyz, unpacked1.xyz, 0, -degree * 3) &&
        !almostEqualSubArrays(unpacked1.xyz, unpacked0.xyz, 0, -degree * 3))
      return false;
    if (!almostEqualSubArrays(unpacked0.w, unpacked1.w, 0, -degree) &&
        !almostEqualSubArrays(unpacked1.w, unpacked0.w, 0, -degree))
      return false;
  }
  // account for extraneous knots
  if (!NumberArray.isAlmostEqual(data0.params.knots, data1.params.knots) &&
      !almostEqualSubArrays(data0.params.knots, data1.params.knots, 1, -1) &&
      !almostEqualSubArrays(data1.params.knots, data0.params.knots, 1, -1))
    return false;
  return true;
}

// does not handle fake closure (BSplineWrapMode.OpenByRemovingKnots)
function almostEqualSurfaceData(data0: SerializationHelpers.BSplineSurfaceData, data1: SerializationHelpers.BSplineSurfaceData): boolean {
  if (data0.dim !== data1.dim)
    return false;
  if (data0.uParams.order !== data1.uParams.order)
    return false;
  if (data0.vParams.order !== data1.vParams.order)
    return false;
  const uDegree = data0.uParams.order - 1;
  const vDegree = data0.vParams.order - 1;
  if (Geometry.resolveValue<BSplineWrapMode>(data0.uParams.wrapMode, BSplineWrapMode.None) !== Geometry.resolveValue<BSplineWrapMode>(data1.uParams.wrapMode, BSplineWrapMode.None))
    return false;
  if (Geometry.resolveValue<BSplineWrapMode>(data0.vParams.wrapMode, BSplineWrapMode.None) !== Geometry.resolveValue<BSplineWrapMode>(data1.vParams.wrapMode, BSplineWrapMode.None))
    return false;
  const unpacked0 = unpackPoles(data0.poles, data0.dim, data0.weights);
  const unpacked1 = unpackPoles(data1.poles, data1.dim, data1.weights);
  // closure is allowed to differ, and if so allows extra allowable pole/weight count conditions
  const uClosed0 = Geometry.resolveValue<boolean>(data0.uParams.closed, false);
  const uClosed1 = Geometry.resolveValue<boolean>(data1.uParams.closed, false);
  const vClosed0 = Geometry.resolveValue<boolean>(data0.vParams.closed, false);
  const vClosed1 = Geometry.resolveValue<boolean>(data1.vParams.closed, false);
  if (uClosed0 === uClosed1 && vClosed0 === vClosed1) {
    if (data0.uParams.numPoles !== data1.uParams.numPoles)
      return false;
    if (data0.vParams.numPoles !== data1.vParams.numPoles)
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.xyz, unpacked1.xyz))
      return false;
    if (!NumberArray.isAlmostEqual(unpacked0.w, unpacked1.w))
      return false;
  } else if (uClosed0 !== uClosed1 && vClosed0 === vClosed1) {
    if ((data0.uParams.numPoles - uDegree !== data1.uParams.numPoles) &&
        (data0.uParams.numPoles !== data1.uParams.numPoles - uDegree))
      return false;
    if (data0.vParams.numPoles !== data1.vParams.numPoles)
      return false;
    const xyzFewerCols0 = cloneSubArray(unpacked0.xyz, data0.vParams.numPoles, data0.uParams.numPoles, 3, undefined, undefined, undefined, -uDegree);
    const xyzFewerCols1 = cloneSubArray(unpacked1.xyz, data1.vParams.numPoles, data1.uParams.numPoles, 3, undefined, undefined, undefined, -uDegree);
    if (!NumberArray.isAlmostEqual(xyzFewerCols0, unpacked1.xyz) &&
        !NumberArray.isAlmostEqual(unpacked0.xyz, xyzFewerCols1))
        return false;
    const wFewerCols0 = cloneSubArray(unpacked0.w, data0.vParams.numPoles, data0.uParams.numPoles, 1, undefined, undefined, undefined, -uDegree);
    const wFewerCols1 = cloneSubArray(unpacked1.w, data1.vParams.numPoles, data1.uParams.numPoles, 1, undefined, undefined, undefined, -uDegree);
    if (!NumberArray.isAlmostEqual(wFewerCols0, unpacked1.w) &&
        !NumberArray.isAlmostEqual(unpacked0.w, wFewerCols1))
        return false;
  } else if (uClosed0 === uClosed1 && vClosed0 !== vClosed1) {
    if (data0.uParams.numPoles !== data1.uParams.numPoles)
      return false;
    if ((data0.vParams.numPoles - vDegree !== data1.vParams.numPoles) &&
        (data0.vParams.numPoles !== data1.vParams.numPoles - vDegree))
      return false;
    const xyzFewerRows0 = cloneSubArray(unpacked0.xyz, data0.vParams.numPoles, data0.uParams.numPoles, 3, undefined, -vDegree);
    const xyzFewerRows1 = cloneSubArray(unpacked1.xyz, data1.vParams.numPoles, data1.uParams.numPoles, 3, undefined, -vDegree);
    if (!NumberArray.isAlmostEqual(xyzFewerRows0, unpacked1.xyz) &&
        !NumberArray.isAlmostEqual(unpacked0.xyz, xyzFewerRows1))
      return false;
    const wFewerRows0 = cloneSubArray(unpacked0.w, data0.vParams.numPoles, data0.uParams.numPoles, 1, undefined, -vDegree);
    const wFewerRows1 = cloneSubArray(unpacked1.w, data1.vParams.numPoles, data1.uParams.numPoles, 1, undefined, -vDegree);
    if (!NumberArray.isAlmostEqual(wFewerRows0, unpacked1.w) &&
        !NumberArray.isAlmostEqual(unpacked0.w, wFewerRows1))
      return false;
  } else {  // both closures different
    if ((data0.uParams.numPoles - uDegree !== data1.uParams.numPoles) &&
        (data0.uParams.numPoles !== data1.uParams.numPoles - uDegree))
      return false;
    if ((data0.vParams.numPoles - vDegree !== data1.vParams.numPoles) &&
        (data0.vParams.numPoles !== data1.vParams.numPoles - vDegree))
      return false;
    const xyzFewerRowsAndCols0 = cloneSubArray(unpacked0.xyz, data0.vParams.numPoles, data0.uParams.numPoles, 3, undefined, -vDegree, undefined, -uDegree);
    const xyzFewerRowsAndCols1 = cloneSubArray(unpacked1.xyz, data1.vParams.numPoles, data1.uParams.numPoles, 3, undefined, -vDegree, undefined, -uDegree);
    if (!NumberArray.isAlmostEqual(xyzFewerRowsAndCols0, unpacked1.xyz) &&
        !NumberArray.isAlmostEqual(unpacked0.xyz, xyzFewerRowsAndCols1))
      return false;
    const wFewerRowsAndCols0 = cloneSubArray(unpacked0.w, data0.vParams.numPoles, data0.uParams.numPoles, 1, undefined, -vDegree, undefined, -uDegree);
    const wFewerRowsAndCols1 = cloneSubArray(unpacked1.w, data1.vParams.numPoles, data1.uParams.numPoles, 1, undefined, -vDegree, undefined, -uDegree);
    if (!NumberArray.isAlmostEqual(wFewerRowsAndCols0, unpacked1.w) &&
        !NumberArray.isAlmostEqual(unpacked0.w, wFewerRowsAndCols1))
      return false;
  }
  // account for extraneous uKnots
  if (!NumberArray.isAlmostEqual(data0.uParams.knots, data1.uParams.knots) &&
      !almostEqualSubArrays(data0.uParams.knots, data1.uParams.knots, 1, -1) &&
      !almostEqualSubArrays(data1.uParams.knots, data0.uParams.knots, 1, -1))
    return false;
  // account for extraneous vKnots
  if (!NumberArray.isAlmostEqual(data0.vParams.knots, data1.vParams.knots) &&
      !almostEqualSubArrays(data0.vParams.knots, data1.vParams.knots, 1, -1) &&
      !almostEqualSubArrays(data1.vParams.knots, data0.vParams.knots, 1, -1))
    return false;
  return true;
}

// create a homogeneous B-spline surface that is open, a tube, or a torus
function createTestSurface(uPeriodic: boolean, vPeriodic: boolean): BSplineSurface3dH | undefined {
  // construct open 4x4 grid
  let uNumPoles = 4;
  const uDegree = 2;
  let vNumPoles = 4;
  const vDegree = 3;
  let poles3d = [
    Point3d.create(5,0,-2), Point3d.create(0,5,-2), Point3d.create(-5,0,-2), Point3d.create(0,-5,-2),
    Point3d.create(7,0,0), Point3d.create(0,7,0), Point3d.create(-7,0,0), Point3d.create(0,-7,0),
    Point3d.create(5,0,2), Point3d.create(0,5,2), Point3d.create(-5,0,2), Point3d.create(0,-5,2),
    Point3d.create(3,0,0), Point3d.create(0,3,0), Point3d.create(-3,0,0), Point3d.create(0,-3,0),
  ];
  let weights = [
    0.4, 0.6, 0.5, 0.7,
    0.6, 0.5, 0.7, 0.4,
    0.5, 0.7, 0.4, 0.6,
    0.7, 0.4, 0.6, 0.5,
  ];
  for (let i = 0; i < poles3d.length; ++i)
    poles3d[i].scaleInPlace(weights[i]);

  let uKnots = KnotVector.createUniformClamped(uNumPoles, uDegree, 0, 1);
  if (uPeriodic) {
    const uNumInterval = uNumPoles;
    uKnots = KnotVector.createUniformWrapped(uNumInterval, uDegree, 0, 1);
    const uWrappedPoles: Point3d[] = [];
    const uWrappedWeights: number[] = [];
    for (let i = 0; i < vNumPoles; ++i) {     // #rows
      const rowStart = i * uNumPoles;
      for (let j = 0; j < uNumPoles; ++j) {   // copy the row
        uWrappedPoles.push(Point3d.createFrom(poles3d[rowStart + j]));
        uWrappedWeights.push(weights[rowStart + j]);
      }
      for (let k = 0; k < uDegree; ++k) {     // append first uDegree entries to this row
        uWrappedPoles.push(Point3d.createFrom(poles3d[rowStart + k]));
        uWrappedWeights.push(weights[rowStart + k]);
      }
    }
    uNumPoles += uDegree;
    poles3d = uWrappedPoles;
    weights = uWrappedWeights;
  }

  let vKnots = KnotVector.createUniformClamped(vNumPoles, vDegree, 0, 1);
  if (vPeriodic) {
    const vNumInterval = vNumPoles;
    vKnots = KnotVector.createUniformWrapped(vNumInterval, vDegree, 0, 1);
    const vWrappedPoles = Point3dArray.clonePoint3dArray(poles3d);
    const vWrappedWeights = weights.slice();
    for (let i = 0; i < vDegree; ++i) {       // append vDegree wraparound rows
      const rowStart = i * uNumPoles;
      for (let j = 0; j < uNumPoles; ++j) {   // #cols
        vWrappedPoles.push(Point3d.createFrom(poles3d[rowStart + j]));
        vWrappedWeights.push(weights[rowStart + j]);
      }
    }
    vNumPoles += vDegree;
    poles3d = vWrappedPoles;
    weights = vWrappedWeights;
  }

  const bsurf = BSplineSurface3dH.create(poles3d, weights, uNumPoles, uDegree + 1, uKnots.knots, vNumPoles, vDegree + 1, vKnots.knots);
  if (bsurf !== undefined) {
    if (uPeriodic)
      bsurf.setWrappable(UVSelect.uDirection, BSplineWrapMode.OpenByAddingControlPoints);
    if (vPeriodic)
      bsurf.setWrappable(UVSelect.vDirection, BSplineWrapMode.OpenByAddingControlPoints);
  }
  return bsurf;
}

describe("SerializationHelpers", () => {
  // coverage for branches not hit during other serialization tests
  it("BSplineCurveCoverage", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // create valid curve data
    const unweightedPoles3d = [Point3d.create(1,-1,-1), Point3d.create(1,1,1), Point3d.create(-1,1,-1), Point3d.create(-1,-1,1)];
    const weights = [0.3, 0.5, 0.2, 0.7];
    unweightedPoles3d.push(unweightedPoles3d[0].clone()); // cover wraparound logic
    weights.push(weights[0]);
    ck.testExactNumber(unweightedPoles3d.length, weights.length);
    const poles4d: Point4d[] = [];
    for (let i = 0; i < unweightedPoles3d.length; ++i)
      poles4d.push(Point4d.create(unweightedPoles3d[i].x, unweightedPoles3d[i].y, unweightedPoles3d[i].z, 1.0).scale(weights[i]));

    // cover Point3d/4dArray.isAlmostEqual/packToFloat64Array
    let working = new Float64Array(); // wrong size
    ck.testTrue(Point3dArray.isAlmostEqual(unweightedPoles3d, Point3dArray.packToFloat64Array(unweightedPoles3d, working)), "cover Point3dArray.isAlmostEqual(points, numbers)");
    working = new Float64Array(3 * unweightedPoles3d.length); // right size
    ck.testTrue(Point3dArray.isAlmostEqual(Point3dArray.packToFloat64Array(unweightedPoles3d, working), unweightedPoles3d), "cover Point3dArray.isAlmostEqual(numbers, points)");
    working = new Float64Array(); // wrong size
    ck.testTrue(Point4dArray.isAlmostEqual(poles4d, Point4dArray.packToFloat64Array(poles4d, working)), "cover Point4dArray.isAlmostEqual(points, numbers)");
    working = new Float64Array(4 * poles4d.length); // right size
    ck.testTrue(Point4dArray.isAlmostEqual(Point4dArray.packToFloat64Array(poles4d, working), poles4d), "cover Point4dArray.isAlmostEqual(numbers, points)");

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
          const data = SerializationHelpers.cloneBSplineCurveData(exportData);
          if (ck.testTrue(SerializationHelpers.Import.prepareBSplineCurveData(data, { removeExtraKnots: true }), "Import.prepareBSplineCurveData with removeExtraKnots succeeds"))
            ck.testTrue(almostEqualCurveData(data, exportData), "Import.prepareBSplineCurveData with removeExtraKnots yields equivalent data");
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "SerializationHelpers", "BSplineCurveCoverage");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BSplineSurfaceCoverage", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // test open and (maximally continuous) periodic curves
    for (const uPeriodic of [false, true]) {
      for (const vPeriodic of [false, true]) {
        const surface = createTestSurface(uPeriodic, vPeriodic);
        if (ck.testType(surface, BSplineSurface3dH, "BSplineSurface3dH.create returned a homogeneous surface")) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, surface);
          const origData = createSurfaceData(surface);
          // test Export
          const exportData = SerializationHelpers.cloneBSplineSurfaceData(origData);
          if (ck.testTrue(SerializationHelpers.Export.prepareBSplineSurfaceData(exportData), "Export.prepareBSplineSurfaceData on valid input succeeds"))
            ck.testTrue(almostEqualSurfaceData(exportData, origData), "Export.prepareBSplineSurfaceData on valid input yields equivalent data");
          if (true) {
            let data = SerializationHelpers.cloneBSplineSurfaceData(origData);
            if (surface.isClosable(UVSelect.uDirection) || surface.isClosable(UVSelect.vDirection)) {
              data.dim = 0;
              ck.testFalse(SerializationHelpers.Export.prepareBSplineSurfaceData(data), "Export.prepareBSplineSurfaceData with invalid dim fails");
              data = SerializationHelpers.cloneBSplineSurfaceData(origData);
              if (surface.isClosable(UVSelect.uDirection)) {
                data.uParams.numPoles = 0;
                ck.testFalse(SerializationHelpers.Export.prepareBSplineSurfaceData(data), "Export.prepareBSplineSurfaceData with invalid uNumPoles fails");
                data = SerializationHelpers.cloneBSplineSurfaceData(origData);
              } else if (surface.isClosable(UVSelect.vDirection)) {
                data.vParams.numPoles = 0;
                ck.testFalse(SerializationHelpers.Export.prepareBSplineSurfaceData(data), "Export.prepareBSplineSurfaceData with invalid vNumPoles fails");
                data = SerializationHelpers.cloneBSplineSurfaceData(origData);
              }
            }
            data.weights = surface.copyWeightsToFloat64Array();
            if (ck.testTrue(SerializationHelpers.Export.prepareBSplineSurfaceData(data, { jsonPoles: true }), "Export.prepareBSplineSurfaceData with jsonPoles and Float64Array weights succeeds"))
              ck.testTrue(almostEqualSurfaceData(data, origData), "Export.prepareBSplineSurfaceData with jsonPoles and Float64Array weights yields equivalent data");
            data = SerializationHelpers.cloneBSplineSurfaceData(origData);
            data.uParams.knots = surface.knots[UVSelect.uDirection].knots;
            data.vParams.knots = surface.knots[UVSelect.vDirection].knots;
            if (ck.testTrue(SerializationHelpers.Export.prepareBSplineSurfaceData(data, { jsonKnots: true }), "Export.prepareBSplineSurfaceData with jsonKnots and Float64Array uKnots and vKnots succeeds"))
              ck.testTrue(almostEqualSurfaceData(data, origData), "Export.prepareBSplineSurfaceData with jsonKnots and Float64Array uKnots and vKnots yields equivalent data");
            data = SerializationHelpers.cloneBSplineSurfaceData(origData);
            if (ck.testTrue(SerializationHelpers.Export.prepareBSplineSurfaceData(data, { jsonKnots: false }), "Export.prepareBSplineSurfaceData with !jsonKnots and number[] uKnots and vKnots succeeds"))
              ck.testTrue(almostEqualSurfaceData(data, origData), "Export.prepareBSplineSurfaceData with !jsonKnots and number[] uKnots and vKnots yields equivalent data");
            }
          // test Import
          const importData = SerializationHelpers.cloneBSplineSurfaceData(exportData);
          if (ck.testTrue(SerializationHelpers.Import.prepareBSplineSurfaceData(importData), "Import.prepareBSplineSurfaceData on valid input succeeds"))
            ck.testTrue(almostEqualSurfaceData(importData, origData), "Import.prepareBSplineSurfaceData on valid input yields equivalent data");
          if (true) {
            const data = SerializationHelpers.cloneBSplineSurfaceData(exportData);
            if (ck.testTrue(SerializationHelpers.Import.prepareBSplineSurfaceData(data, { removeExtraKnots: true }), "Import.prepareBSplineSurfaceData with removeExtraKnots succeeds"))
              ck.testTrue(almostEqualSurfaceData(data, exportData), "Import.prepareBSplineSurfaceData with removeExtraKnots yields equivalent data");
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "SerializationHelpers", "BSplineSurfaceCoverage");
    expect(ck.getNumErrors()).equals(0);
  });
});
