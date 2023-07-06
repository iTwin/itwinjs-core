/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import { BSplineSurface3d, BSplineSurface3dH, BSplineSurface3dQuery, UVSelect, WeightStyle } from "../../bspline/BSplineSurface";
import { BSplineWrapMode } from "../../bspline/KnotVector";
import { Geometry } from "../../Geometry";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { testGeometryQueryRoundTrip } from "../serialization/FlatBuffer.test";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { NumberArray, Point3dArray, Point4dArray } from "../../geometry3d/PointHelpers";
import { Point4d } from "../../geometry4d/Point4d";

function testBasisValues(ck: Checker, data: Float64Array, expectedValue: number = 1) {
  let s = 0.0; for (const a of data) s += a;
  ck.testCoordinate(expectedValue, s, "basis sum");
}
function testBSplineSurface(ck: Checker, surfaceA: BSplineSurface3dQuery) {
  const u0 = 0.25;
  const v0 = 0.30;
  const u1 = 0.5;
  const v1 = 0.8;
  const scaleFactor = 2.0;
  const pointA0 = surfaceA.fractionToPoint(u0, v0);
  const pointA1 = surfaceA.fractionToPoint(u1, v1);
  const transform = Transform.createScaleAboutPoint(pointA0, scaleFactor);
  const surfaceB = surfaceA.cloneTransformed(transform);
  ck.testFalse(surfaceA.isAlmostEqual(surfaceB), "scale changes surface");
  ck.testFalse(surfaceA.isAlmostEqual(0), "isAlmostEqual with nonbspline");
  ck.testTrue(surfaceB.isSameGeometryClass(surfaceA));
  const pointB0 = surfaceB.fractionToPoint(u0, v0);
  const pointB1 = surfaceB.fractionToPoint(u1, v1);
  const frameA0 = surfaceA.fractionToRigidFrame(u0, v0);
  const frameB0 = surfaceB.fractionToRigidFrame(u0, v0);
  if (ck.testPointer(frameA0)
    && ck.testPointer(frameB0)
    && frameA0
    && frameB0) {
    ck.testTransform(frameA0, frameB0);
    const frameA0Inverse = frameA0.inverse();
    if (ck.testPointer(frameA0Inverse)) {
      const rangeA2 = Range3d.create();
      surfaceA.extendRange(rangeA2, frameA0Inverse);
      const planeA2 = Plane3dByOriginAndUnitNormal.create(
        Point3d.createFrom(frameA0.origin),
        frameA0.matrix.columnZ());
      ck.testBoolean(surfaceA.isInPlane(planeA2!),
        Geometry.isSmallMetricDistance(rangeA2.zLength()),
        "Surface planarity test versus range in frame");
    }
  }

  ck.testPoint3d(pointA0, pointB0, "bspline surface scales about point");
  const pointX1 = pointA0.interpolate(scaleFactor, pointA1);
  ck.testPoint3d(pointB1, pointX1, "ScaleAboutPoint effect");

  surfaceA.reverseInPlace(0);
  const pointA0U = surfaceA.fractionToPoint(1.0 - u0, v0);
  ck.testPoint3d(pointA0, pointA0U, " evaluate after u reversal");
  surfaceA.reverseInPlace(1);
  const pointA0UV = surfaceA.fractionToPoint(1.0 - u0, 1.0 - v0);
  ck.testPoint3d(pointA0, pointA0UV, " evaluate after double reversal");

  const rangeA = Range3d.create();
  const rangeB = Range3d.create();
  surfaceA.extendRange(rangeA);
  surfaceB.extendRange(rangeB);
  const rangeA1 = Range3d.create();
  surfaceA.extendRange(rangeA1, transform);
  ck.testRange3d(rangeA1, rangeB, "extendRange applies transform");
  ck.testCoordinate(scaleFactor * rangeA.xLength(), rangeB.xLength());
  ck.testCoordinate(scaleFactor * rangeA.yLength(), rangeB.yLength());
  ck.testCoordinate(scaleFactor * rangeA.zLength(), rangeB.zLength());

  // verify degree, order, and pole layouts in expected "u-major" pole construction
  ck.testExactNumber(1, surfaceA.poleStepUV(0), "u-major u step");
  ck.testExactNumber(surfaceA.numPolesUV(0), surfaceA.poleStepUV(1), "v-major v step");
  ck.testExactNumber(surfaceA.numPolesTotal(), surfaceA.numPolesUV(0) * surfaceA.numPolesUV(1), "pole count is rectangular grid");
  for (const value of [0, 1]) {
    const select = surfaceA.numberToUVSelect(value);
    ck.testExactNumber(surfaceA.numPolesUV(select), surfaceA.numSpanUV(select) + surfaceA.degreeUV(select));
  }

  if (surfaceA instanceof BSplineSurface3dH) {
    const weightedPoles = surfaceA.copyPoints4d();
    const numU = surfaceA.numPolesUV(0);
    const numV = surfaceA.numPolesUV(1);
    for (let i = 0; i < numU; i++) {
      for (let j = 0; j < numV; j++) {
        const pole0 = surfaceA.getPole(i, j)!;
        const pole1 = weightedPoles[i + j * numU].realPointDefault000();
        ck.testPoint3d(pole0, pole1);
      }
    }
    const uKnots = surfaceA.knots[0];
    const vKnots = surfaceA.knots[1];
    const uBasis = uKnots.createBasisArray();
    const vBasis = vKnots.createBasisArray();
    const duBasis = uKnots.createBasisArray();
    const dvBasis = vKnots.createBasisArray();
    const numUSpan = surfaceA.numSpanUV(0);
    const numVSpan = surfaceA.numSpanUV(1);
    for (let i = 0; i < numUSpan; i++) {
      for (let j = 0; j < numVSpan; j++) {
        for (const f of [0.0, 0.3, 0.9]) {
          const uknot = surfaceA.spanFractionToKnot(0, i, f);
          const vknot = surfaceA.spanFractionToKnot(1, j, f);
          const knotPoint4d = surfaceA.knotToPoint4d(uknot, vknot);
          const point3d = surfaceA.knotToPoint(uknot, vknot);
          const uFraction = uKnots.spanFractionToFraction(i, f);
          const vFraction = vKnots.spanFractionToFraction(j, f);
          const fractionPoint = surfaceA.fractionToPoint(uFraction, vFraction);
          const fractionPoint4d = surfaceA.fractionToPoint4d(uFraction, vFraction);
          const fractionPoint4dto3d = fractionPoint4d.realPointDefault000();
          const knotPoint4dto3d = knotPoint4d.realPointDefault000();
          ck.testPoint3d(knotPoint4dto3d, fractionPoint);
          ck.testPoint3d(fractionPoint4dto3d, fractionPoint);
          ck.testPoint3d(point3d, knotPoint4dto3d);
          surfaceA.spanFractionsToBasisFunctions(0, i, f, uBasis, duBasis);
          testBasisValues(ck, uBasis, 1.0);
          testBasisValues(ck, duBasis, 0.0);
          surfaceA.spanFractionsToBasisFunctions(1, j, f, vBasis, dvBasis);
          testBasisValues(ck, vBasis, 1.0);
          testBasisValues(ck, dvBasis, 0.0);
        }
      }
    }

  }
}

describe("BSplineSurface", () => {
  it("BSplineSurface.Hello", () => {
    const ck = new Checker();
    const surfaceA = Sample.createXYGridBsplineSurface(4, 3, 3, 2); // an open surface
    if (ck.testPointer(surfaceA)) {
      // test that bogus closure setups get rejected . .
      surfaceA.setWrappable(UVSelect.uDirection, BSplineWrapMode.OpenByAddingControlPoints);
      surfaceA.setWrappable(UVSelect.vDirection, BSplineWrapMode.OpenByRemovingKnots);
      testBSplineSurface(ck, surfaceA);
      ck.testFalse(surfaceA.isClosable(UVSelect.uDirection));
      ck.testFalse(surfaceA.isClosable(UVSelect.vDirection));
    }
    // A rational surface with unit weigths ... This is just a plane
    const surfaceAH1 = Sample.createWeightedXYGridBsplineSurface(4, 3, 3, 2);
    if (ck.testPointer(surfaceAH1))
      testBSplineSurface(ck, surfaceAH1);
    // A rational surface with mild bilinear-patch weight variation.  This is NOT planar ...
    const surfaceAHw = Sample.createWeightedXYGridBsplineSurface(4, 3, 3, 2, 1.0, 1.1, 0.9, 1.0);
    if (ck.testPointer(surfaceAHw))
      testBSplineSurface(ck, surfaceAHw);

    ck.checkpoint("BSplineSurface.Hello");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Wrapped", () => {
    const ck = new Checker();
    const allGeometry = [];
    let dx = 0.0;
    let dy = 0.0;
    for (const orderU of [2, 3, 4, 5]) {
      dy = 0.0;
      for (const orderV of [2, 3, 4, 5]) {
        const bsurf = Sample.createPseudoTorusBsplineSurface(
          4.0, 1.0, // radii
          Math.max(12, orderU + 1), Math.max(6, orderV + 1),    // grid edges
          orderU, orderV);
        if (ck.testPointer(bsurf)) {
          if (ck.testTrue(bsurf.isClosable(UVSelect.uDirection)))
            ck.testExactNumber(BSplineWrapMode.OpenByAddingControlPoints, bsurf.isClosableSurface(UVSelect.uDirection));
          if (ck.testTrue(bsurf.isClosable(UVSelect.vDirection)))
            ck.testExactNumber(BSplineWrapMode.OpenByAddingControlPoints, bsurf.isClosableSurface(UVSelect.vDirection));
          bsurf.tryTranslateInPlace(dx, dy);
          allGeometry.push(bsurf);
        }
        dy += 20.0;
      }
      dx += 20.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BSplineSurface", "Wrapped");
    ck.checkpoint("BSplineSurface.Wrapped");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PseudoTorusExample", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const surfaceA = Sample.createPseudoTorusBsplineSurface(
      4.0, 1.0, // radii
      12, 6, 4, 4)!;  // bicubic
    const surfaceB = Sample.createPseudoTorusBsplineSurface(
      4.0, 1.0, // radii
      12, 6, 5, 3)!;
    surfaceB.tryTranslateInPlace(10, 0, 0);

    const options = StrokeOptions.createForFacets();
    options.needNormals = options.needParams = options.shouldTriangulate = true;
    for (const surf of [surfaceA, surfaceB]) {
      const builder = PolyfaceBuilder.create(options);
      builder.addUVGridBody(surf, 20, 20);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [surf, builder.claimPolyface()]);
    }

    for (const uvDir of [UVSelect.uDirection, UVSelect.vDirection]) {
      for (const surf of [surfaceA, surfaceB]) {
        const mode = surf.isClosableSurface(uvDir);
        ck.testExactNumber(mode, surf.getWrappable(uvDir), "WrapMode is as expected");
        ck.testExactNumber(mode, BSplineWrapMode.OpenByAddingControlPoints, "WrapMode is OpenByAddingControlPoints");
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "BSplineSurface", "PseudoTorusExample");
    ck.checkpoint("BSplineSurface.Wrapped");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Cones", () => {
    const ck = new Checker();
    const allGeometry = [];
    let dx = 0.0;
    const dy = 0.0;
    for (const bsurf of [Sample.createConeBsplineSurface(
      Point3d.create(0, 0, 0),
      Point3d.create(0, 0, 1),
      4.0, 1.0, 2),
    Sample.createConeBsplineSurface(
      Point3d.create(0, 0, 0),
      Point3d.create(1, 3, 1),
      4.0, 1.0,
      3)]) {
      if (ck.testPointer(bsurf)) {
        bsurf.tryTranslateInPlace(dx, dy);
        allGeometry.push(bsurf);
        dx += 10.0;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BSplineSurface", "createCone");
    ck.checkpoint("BSplineSurface.Wrapped");
    expect(ck.getNumErrors()).equals(0);
  });

  function roundTripBSplineSurface(ck: Checker, surface: BSplineSurface3d | BSplineSurface3dH) {
    for (const uvDir of [UVSelect.uDirection, UVSelect.vDirection]) {
      const mode = surface.isClosableSurface(uvDir);
      ck.testExactNumber(mode, surface.getWrappable(uvDir), "WrapMode is as expected");
    }
    testGeometryQueryRoundTrip(ck, surface);
    // test a surface with the opposite rationality
    let surface2: BSplineSurface3d | BSplineSurface3dH | undefined;
    if (surface instanceof BSplineSurface3dH) {
      const poles = surface.copyXYZToFloat64Array(true);
      surface2 = BSplineSurface3d.create(poles, surface.numPolesUV(UVSelect.uDirection), surface.orderUV(UVSelect.uDirection), surface.knots[UVSelect.uDirection].knots,
                                                surface.numPolesUV(UVSelect.vDirection), surface.orderUV(UVSelect.vDirection), surface.knots[UVSelect.vDirection].knots);
    } else {
      surface2 = BSplineSurface3dH.create(surface.coffs, undefined, surface.numPolesUV(UVSelect.uDirection), surface.orderUV(UVSelect.uDirection), surface.knots[UVSelect.uDirection].knots,
                                                                    surface.numPolesUV(UVSelect.vDirection), surface.orderUV(UVSelect.vDirection), surface.knots[UVSelect.vDirection].knots); // unit weights
    }
    if (ck.testDefined(surface2, "surface has valid pole dimension"))
      testGeometryQueryRoundTrip(ck, surface2);
  }

  it("LegacyClosureRoundTrip", () => {
    const ck = new Checker();
    const options = StrokeOptions.createForFacets();
    options.needNormals = options.needParams = options.shouldTriangulate = true;
    const allGeometry: GeometryQuery[] = [];
    for (const filename of ["./src/test/testInputs/BSplineSurface/torus3_open_closed.imjs",
                            "./src/test/testInputs/BSplineSurface/torus6_open_closed.imjs",
                            "./src/test/testInputs/BSplineSurface/nonrational_toroid_open.imjs",
                            "./src/test/testInputs/BSplineSurface/nonrational_toroid_legacy_closed.imjs"]) {
      const json = fs.readFileSync(filename, "utf8");
      const inputs = IModelJson.Reader.parse(JSON.parse(json));
      if (ck.testDefined(inputs)) {
        if (ck.testTrue(Array.isArray(inputs)) && Array.isArray(inputs) && inputs.length > 0) {
          if (ck.testTrue(inputs[0] instanceof GeometryQuery)) {
            for (const input of inputs) {
              if (input instanceof BSplineSurface3d || input instanceof BSplineSurface3dH) {
                const builder = PolyfaceBuilder.create(options);
                builder.addUVGridBody(input, 20, 20);
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, [input, builder.claimPolyface()]);
                roundTripBSplineSurface(ck, input);
              }
            }
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BSplineSurface", "LegacyClosureRoundTrip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BSplineSurface3dCoverage", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // valid data for a 2x3 Bezier patch
    const polesFlat = [[[0,0,0],[1,0,0]],[[0,1,1],[1,1,-1]],[[0,2,0],[1,2,0]]];
    const poles = NumberArray.pack(polesFlat);
    const polesPoint3d = Point3dArray.unpackNumbersToPoint3dArray(poles);
    const uNumPoles = 2;
    const vNumPoles = 3;
    const uOrder = 2;
    const vOrder = 3;
    const bsurf = BSplineSurface3d.create(poles, uNumPoles, uOrder, undefined, vNumPoles, vOrder, undefined);
    if (ck.testType(bsurf, BSplineSurface3d, "create returns expected type")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, bsurf);
      const pole = bsurf.getPole(0,1);
      if (ck.testType(pole, Point3d, "getPole returns defined"))
        ck.testPoint3d(polesPoint3d[2], pole, "getPole returns expected pole");
      const polesArray2d = bsurf.getPointArray(true);
      const polesArray3d = bsurf.getPointArray(false);
      ck.testTrue(NumberArray.isExactEqual(NumberArray.pack(polesArray2d), poles), "getPointArray (2d) returns expected points");
      ck.testTrue(NumberArray.isExactEqual(NumberArray.pack(polesArray3d), poles), "getPointArray (3d) returns expected points");
      const polesGrid = bsurf.getPointGridJSON();
      ck.testTrue(NumberArray.isExactEqual(NumberArray.pack(polesGrid.points), poles), "getPointGridJSON returns expected points");
      ck.testExactNumber(polesGrid.weightStyle!, WeightStyle.UnWeighted, "getPointGridJSON returns expected weightStyle");
      ck.testExactNumber(polesGrid.numCartesianDimensions, 3, "getPointGridJSON returns expected dim");
      ck.testTrue(NumberArray.isExactEqual(bsurf.copyPointsFloat64Array(), poles), "copyPointsFloat64Array returns expected points");
      ck.testTrue(NumberArray.isExactEqual(bsurf.knots[UVSelect.uDirection].knots, bsurf.copyKnots(UVSelect.uDirection, false)), "copyKnots returns expected uKnots");
      ck.testTrue(NumberArray.isExactEqual(bsurf.knots[UVSelect.vDirection].knots, bsurf.copyKnots(UVSelect.vDirection, false)), "copyKnots returns expected vKnots");
      ck.testFalse(bsurf.testClosableGrid(UVSelect.uDirection), "testClosableGrid returns false with undefined mode in u-direction on open surface");
      ck.testFalse(bsurf.testClosableGrid(UVSelect.vDirection, BSplineWrapMode.None), "testClosableGrid returns false with mode None in v-direction on open surface");
      ck.testPoint3d(bsurf.uvFractionToPoint(1,1), bsurf.getPole(uNumPoles - 1, vNumPoles - 1)!, "uvFractionToPoint returns expected point");
    }
    ck.testUndefined(BSplineSurface3d.create(poles, uNumPoles, 1, undefined, vNumPoles, vOrder, undefined), "create with uOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3d.create(poles, uNumPoles, uNumPoles + 1, undefined, vNumPoles, vOrder, undefined), "create with uOrder too large yields undefined surface");
    ck.testUndefined(BSplineSurface3d.create(poles, uNumPoles, uOrder, undefined, vNumPoles, 1, undefined), "create with vOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3d.create(poles, uNumPoles, uOrder, undefined, vNumPoles, vNumPoles + 1, undefined), "create with vOrder too large yields undefined surface");
    ck.testUndefined(BSplineSurface3d.create(poles, uNumPoles + 1, uOrder, undefined, vNumPoles, vOrder, undefined), "create with invalid uPole count yields undefined surface");
    ck.testUndefined(BSplineSurface3d.create(poles, uNumPoles, uOrder, undefined, vNumPoles + 1, vOrder, undefined), "create with invalid vPole count yields undefined surface");
    ck.testUndefined(BSplineSurface3d.createGrid([[[]]], uOrder, undefined, vOrder, undefined), "createGrid with invalid poles inner dimension yields undefined surface");
    ck.testUndefined(BSplineSurface3d.createGrid(polesFlat, 1, undefined, vOrder, undefined), "createGrid with uOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3d.createGrid(polesFlat, uNumPoles + 1, undefined, vOrder, undefined), "createGrid with uOrder too large yields undefined surface");
    ck.testUndefined(BSplineSurface3d.createGrid(polesFlat, uOrder, undefined, 1, undefined), "createGrid with vOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3d.createGrid(polesFlat, uOrder, undefined, vNumPoles + 1, undefined), "createGrid with vOrder too large yields undefined surface");

    GeometryCoreTestIO.saveGeometry(allGeometry, "BSplineSurface", "BSplineSurface3dCoverage");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BSplineSurface3dHCoverage", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // valid data for a 2x3 homogeneous Bezier patch
    const polesFlat = [[[0,0,0,1],[1,0,0,1]],[[0,0.5,0.5,0.5],[0.5,0.5,-0.5,0.5]],[[0,2,0,1],[1,2,0,1]]]; // [wx,wy,wz,w]
    const polesFlatUnweighted = NumberArray.copy3d(polesFlat);
    for (const row of polesFlatUnweighted)
      for (const point of row)
        for (let k = 0; k < 3; ++k)
          point[k] /= point[3];
    const poles = NumberArray.pack(polesFlat);
    const polesPoint3d: Point3d[] = []; // weighted
    const weights: number[] = [];
    Point4dArray.unpackFloat64ArrayToPointsAndWeights(poles, polesPoint3d, weights);
    const polesPoint4d = Point4dArray.unpackToPoint4dArray(poles);
    const uNumPoles = 2;
    const vNumPoles = 3;
    const uOrder = 2;
    const vOrder = 3;
    const bsurf = BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles, uOrder, undefined, vNumPoles, vOrder, undefined);
    if (ck.testType(bsurf, BSplineSurface3dH, "create returns expected type")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, bsurf);
      const pole = bsurf.getPoint4dPole(0,1);
      if (ck.testType(pole, Point4d, "getPoint4dPole returns defined"))
        ck.testPoint4d(polesPoint4d[2], pole, "getPoint4dPole returns expected pole");
      const polesGrid = bsurf.getPointGridJSON();
      ck.testTrue(NumberArray.isExactEqual(NumberArray.pack(polesGrid.points), poles), "getPointGridJSON returns expected points");
      ck.testExactNumber(polesGrid.weightStyle!, WeightStyle.WeightsAlreadyAppliedToCoordinates, "getPointGridJSON returns expected weightStyle");
      ck.testExactNumber(polesGrid.numCartesianDimensions, 3, "getPointGridJSON returns expected dim");
      const myPoles: Point3d[] = [];
      const myWeights: number[] = [];
      bsurf.copyPointsAndWeights(myPoles, myWeights);
      ck.testTrue(Point3dArray.isAlmostEqual(myPoles, polesPoint3d), "copyPointsAndWeights returns expected points");
      ck.testTrue(NumberArray.isExactEqual(myWeights, weights), "copyPointsAndWeights returns expected weights");
      ck.testTrue(NumberArray.isExactEqual(bsurf.knots[UVSelect.uDirection].knots, bsurf.copyKnots(UVSelect.uDirection, false)), "copyKnots returns expected uKnots");
      ck.testTrue(NumberArray.isExactEqual(bsurf.knots[UVSelect.vDirection].knots, bsurf.copyKnots(UVSelect.vDirection, false)), "copyKnots returns expected vKnots");
      ck.testFalse(bsurf.testClosableGrid(UVSelect.uDirection), "testClosableGrid returns false with undefined mode in u-direction on open surface");
      ck.testFalse(bsurf.testClosableGrid(UVSelect.vDirection, BSplineWrapMode.None), "testClosableGrid returns false with mode None in v-direction on open surface");
      ck.testPoint3d(bsurf.uvFractionToPoint(1,1), bsurf.getPole(uNumPoles - 1, vNumPoles - 1)!, "uvFractionToPoint returns expected point");
      let bsurfGrid = BSplineSurface3dH.createGrid(polesFlatUnweighted, WeightStyle.WeightsSeparateFromCoordinates, uOrder, undefined, vOrder, undefined);
      if (ck.testType(bsurfGrid, BSplineSurface3dH, "createGrid returns expected type"))
        ck.testNumberArray(bsurfGrid.coffs, bsurf.coffs, "createGrid with separate weights input yields expected poles");
      bsurfGrid = BSplineSurface3dH.createGrid(polesFlatUnweighted, WeightStyle.UnWeighted, uOrder, undefined, vOrder, undefined);
      if (ck.testType(bsurfGrid, BSplineSurface3dH, "createGrid returns expected type"))
        ck.testNumberArray(bsurfGrid.copyXYZToFloat64Array(false), bsurf.copyXYZToFloat64Array(true), "createGrid with unweighted input yields expected poles");
    }
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles, 1, undefined, vNumPoles, vOrder, undefined), "create with uOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles, uNumPoles + 1, undefined, vNumPoles, vOrder, undefined), "create with uOrder too large yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles, uOrder, undefined, vNumPoles, 1, undefined), "create with vOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles, uOrder, undefined, vNumPoles, vNumPoles + 1, undefined), "create with vOrder too large yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles + 1, uOrder, undefined, vNumPoles, vOrder, undefined), "create with invalid uPole count yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, weights, uNumPoles, uOrder, undefined, vNumPoles + 1, vOrder, undefined), "create with invalid vPole count yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.create(polesPoint3d, [1,1], uNumPoles, uOrder, undefined, vNumPoles, vOrder, undefined), "create with different counts for poles and weights yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.createGrid([[[]]], WeightStyle.WeightsAlreadyAppliedToCoordinates, uOrder, undefined, vOrder, undefined), "createGrid with invalid poles inner dimension yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.createGrid(polesFlat, WeightStyle.WeightsAlreadyAppliedToCoordinates, 1, undefined, vOrder, undefined), "createGrid with uOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.createGrid(polesFlat, WeightStyle.WeightsAlreadyAppliedToCoordinates, uNumPoles + 1, undefined, vOrder, undefined), "createGrid with uOrder too large yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.createGrid(polesFlat, WeightStyle.WeightsAlreadyAppliedToCoordinates, uOrder, undefined, 1, undefined), "createGrid with vOrder too small yields undefined surface");
    ck.testUndefined(BSplineSurface3dH.createGrid(polesFlat, WeightStyle.WeightsAlreadyAppliedToCoordinates, uOrder, undefined, vNumPoles + 1, undefined), "createGrid with vOrder too large yields undefined surface");

    GeometryCoreTestIO.saveGeometry(allGeometry, "BSplineSurface", "BSplineSurface3dHCoverage");
    expect(ck.getNumErrors()).equals(0);
  });
});
