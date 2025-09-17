/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { describe, expect, it } from "vitest";
import { compareNumbers, SortedArray } from "@itwin/core-bentley";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Arc3d } from "../../curve/Arc3d";
import { BagOfCurves, CurveChain, CurveCollection } from "../../curve/CurveCollection";
import { CurveFactory } from "../../curve/CurveFactory";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { RecursiveCurveProcessor } from "../../curve/CurveProcessor";
import { AnyCurve, AnyRegion } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ChainCollectorContext } from "../../curve/internalContexts/ChainCollectorContext";
import { PolygonWireOffsetContext } from "../../curve/internalContexts/PolygonOffsetContext";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop, SignedLoops } from "../../curve/Loop";
import { JointOptions, OffsetOptions } from "../../curve/OffsetOptions";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { UnionRegion } from "../../curve/UnionRegion";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point3dArray } from "../../geometry3d/PointHelpers";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { PolylineOps } from "../../geometry3d/PolylineOps";
import { Range2d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { HalfEdgeGraph } from "../../topology/Graph";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { GraphChecker } from "./Graph.test";

const diegoPathA = [
  {
    lineSegment: [[9.475113484165819, -13.519605207518564, 0], [13.203035410431951, -14.269123503051588, 0]],
  }, {
    arc: {
      center: [13.005924613981659, -15.249504721722534, 0],
      vectorX: [0.1971107964502951, 0.9803812186709463, 0],
      vectorY: [0.9803812186709463, -0.1971107964502951, 0],
      sweepStartEnd:
        [0, 72.830637847867],
    },
  }, { lineSegment: [[14.000803020390693, -15.148425760207218, 0], [14.34957401104505, -18.58123435046298, 0]] }, {
    lineSegment: [[14.34957401104505, -18.58123435046298, 0], [12.673764076933416, -20.859772802822125, 0]],
  }, {
    arc: {
      center: [11.868182928857742, -20.2672873482622, 0],
      vectorX: [0.8055811480756748, -0.5924854545599226, 0],
      vectorY: [-0.5924854545599226, -0.8055811480756748, 0],
      sweepStartEnd: [0, 71.45442290504732],
    },
  }, {
    lineSegment: [
      [11.562686951204984, -21.21948071498872, 0],
      [8.527182927305319, -20.245587909330848, 0]],
  }, {
    lineSegment: [[8.527182927305319, -20.245587909330848, 0], [7.111360097008944, -16.594638869216595, 0]],
  }, {
    arc: {
      center: [8.043708604295633, -16.2330780016434, 0],
      vectorX: [-0.9323485072866892, -0.3615608675731971, 0],
      vectorY: [-0.3615608675731971, 0.9323485072866892, 0],
      sweepStartEnd: [0, 68.03218413297601],
    },
  },
  {
    lineSegment: [[7.359620917079077, -15.503678223607576, 0], [9.47511348416582, -13.519605207518566, 0]],
  }];

class PolygonBooleanTests {
  public allGeometry: GeometryQuery[] = [];
  public x0 = 0;
  public y0 = 0;
  public ck = new Checker();
  /**
   * * 0==> no output
   * * 1==> output for single call
   * * 2==> output one call
   */
  public debugPersistence = 0;
  public noisy = 0;
  public setDebugControls(noisy: number, persistence: number) {
    this.noisy = noisy;
    this.debugPersistence = persistence;
  }
  public getNoisy(): number { return this.debugPersistence > 0 ? this.noisy : 0; }
  public endDebugMethod() {
    if (this.debugPersistence === 1) {
      RegionOps.setCheckPointFunction(undefined);
    }

  }
  public getNumErrors() { return this.ck.getNumErrors(); }

  public captureAnnotatedGraph(graph: HalfEdgeGraph, dx: number, dy: number) {
    GraphChecker.captureAnnotatedGraph(this.allGeometry, graph, this.x0 + dx, this.y0 + dy);
  }
  public testBooleans(boundary0: Point3d[], boundary1: Point3d[]) {
    const range = Range3d.createArray(boundary0);
    const noisyDeltaX = range.xLength() * 1.25;
    let dx1 = noisyDeltaX;
    const dx1Start = 2 * noisyDeltaX;
    let boolOp = "";
    const noisy = this.getNoisy();
    if (noisy !== 0)
      RegionOps.setCheckPointFunction((name: string, graph: HalfEdgeGraph, properties: string, _extraData?: any) => {
        if (name === "After clusterAndMergeXYTheta"
          || noisy > 5) {
          this.captureAnnotatedGraph(graph, dx1, 0);
          dx1 += noisyDeltaX;
        }
        if (properties.indexOf("R") >= 0 && properties.indexOf("M") >= 0) {
          const euler = graph.countVertexLoops() - graph.countNodes() / 2.0 + graph.countFaceLoops();

          if (!this.ck.testExactNumber(2, euler, `${boolOp} Expected euler characteristic ${name}`)) {
            GeometryCoreTestIO.consoleLog(`outerRectangle  ${prettyPrint(boundary0)}`);
            GeometryCoreTestIO.consoleLog(`innerRectangle  ${prettyPrint(boundary1)}`);
            GraphChecker.dumpGraph(graph);
          }
        }

      });
    range.extendArray(boundary1);
    const yStep = 2.0 * range.yLength();
    this.y0 = 0.0;
    GeometryCoreTestIO.captureGeometry(this.allGeometry, LineString3d.create(boundary0), this.x0, this.y0);
    GeometryCoreTestIO.captureGeometry(this.allGeometry, LineString3d.create(boundary1), this.x0, this.y0);
    this.y0 += yStep; dx1 = dx1Start;
    boolOp = "Union";
    let unionArea;
    let differenceAreaBOnly;
    let differenceAreaAOnly;
    let intersectionArea;
    const unionRegion = RegionOps.polygonXYAreaUnionLoopsToPolyface(boundary0, boundary1);
    if (this.ck.testPointer(unionRegion)) {
      unionArea = PolyfaceQuery.sumFacetAreas(unionRegion);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, unionRegion, this.x0, this.y0);
    }
    this.y0 += yStep; dx1 = dx1Start;

    boolOp = "Intersection";
    const intersectionRegion = RegionOps.polygonXYAreaIntersectLoopsToPolyface(boundary0, boundary1);
    if (this.ck.testPointer(intersectionRegion)) {
      intersectionArea = PolyfaceQuery.sumFacetAreas(intersectionRegion);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, intersectionRegion, this.x0, this.y0);
    }
    this.y0 += yStep; dx1 = dx1Start;

    boolOp = "Difference";
    const differenceRegionAOnly = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(boundary0, boundary1);
    if (this.ck.testPointer(differenceRegionAOnly)) {
      differenceAreaAOnly = PolyfaceQuery.sumFacetAreas(differenceRegionAOnly);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, differenceRegionAOnly, this.x0, this.y0);
    }
    this.y0 += yStep; dx1 = dx1Start;

    boolOp = "Difference";
    const differenceRegionBOnly = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(boundary1, boundary0);
    if (this.ck.testPointer(differenceRegionBOnly)) {
      differenceAreaBOnly = PolyfaceQuery.sumFacetAreas(differenceRegionBOnly);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, differenceRegionBOnly, this.x0, this.y0);
    }

    if (
      unionArea !== undefined && intersectionArea !== undefined &&
      differenceAreaAOnly !== undefined && differenceAreaBOnly !== undefined
    ) {
      this.ck.testCoordinate(
        unionArea, differenceAreaAOnly + differenceAreaBOnly + intersectionArea, "union = A1 + intersection + B1",
      );
    }
    this.x0 += 2.0 * range.xLength() + dx1;
    this.y0 = 0.0;
    this.endDebugMethod();
  }

  public saveAndReset(directoryName: string, fileName: string) {
    GeometryCoreTestIO.saveGeometry(this.allGeometry, directoryName, fileName);
    this.allGeometry = [];
    this.x0 = 0;
    this.y0 = 0;
  }
}
describe("RegionOps", () => {

  it("BooleanRectangles", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    context.testBooleans(Sample.createRectangleXY(0, 0, 5, 2), Sample.createRectangleXY(1, 1, 2, 3));
    context.saveAndReset("RegionOps", "BooleanRectangles");
    expect(context.getNumErrors()).toBe(0);
  });

  it("BooleanDisjointRectangles", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    context.testBooleans(Sample.createRectangleXY(0, 0, 5, 2), Sample.createRectangleXY(1, 4, 2, 3));
    context.saveAndReset("RegionOps", "BooleanDisjointRectangles");
    expect(context.getNumErrors()).toBe(0);
  });

  it("BooleanFractalAB", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const fractalA = Sample.createFractalLMildConcavePatter(2, 1.0);
    const fractalB = Sample.createFractalHatReversingPattern(1, 0.7);
    context.testBooleans(fractalA, fractalB);
    context.saveAndReset("RegionOps", "BooleanFractalAB");
    expect(context.getNumErrors()).toBe(0);
  });

  it("BooleanFractalABRotated", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const fractalA = Sample.createFractalLMildConcavePatter(2, 1.0);
    const fractalB = Sample.createFractalHatReversingPattern(1, 0.7);
    const transform = Transform.createFixedPointAndMatrix(
      Point3d.create(0, 0, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(0.1232132132189379)),
    );
    const fractalA1 = transform.multiplyInversePoint3dArray(fractalA)!;
    const fractalB1 = transform.multiplyInversePoint3dArray(fractalB)!;
    context.testBooleans(fractalA1, fractalB1);
    context.saveAndReset("RegionOps", "BooleanFractalABRotated");
    expect(context.getNumErrors()).toBe(0);
  });

  it("BooleanFlat", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const rectangle = Sample.createRectangleXY(0, 0, 10, 6);
    const splat = [
      Point3d.create(2, 1),
      Point3d.create(7, 1),
      Point3d.create(8, 3),
      Point3d.create(7, 4),
      Point3d.create(6, 4),
      Point3d.create(5, 3),
      Point3d.create(3, 3),
      Point3d.create(2, 4),
      Point3d.create(1, 3),
      Point3d.create(2, 1)];
    context.testBooleans(rectangle, splat);
    context.saveAndReset("RegionOps", "BooleanSplat");
    expect(context.getNumErrors()).toBe(0);
  });

  it("CleanupSawTooth", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const ax = 1.0;
    const ay = 0.0;
    const bx = 10.0;
    const by = 5.0;
    // create the rectangle as Point2d to exercise Point3dArray.streamXYZ and Point3dArray.streamXYZXYZ
    const rectangle = [
      Point2d.create(ax, ay),
      Point2d.create(bx, ay),
      Point2d.create(bx, by),
      Point2d.create(ax, by),
      Point2d.create(ax, ay),
    ];
    // and create more stuff as Growable array . . .
    const diamond = new GrowableXYZArray();
    for (let i = 0; i < rectangle.length; i++) {
      diamond.push(Point3d.createFrom(rectangle[i].interpolate(0.5, rectangle[(i + 1) % rectangle.length])));
    }
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    let y0 = 0.0;
    for (const splat of [
      Sample.appendSawTooth([], 1, 0.5, 3, 1, 5),
      Sample.appendSawTooth([], 1, 0.5, 1, 1, 3)]) {
      const growableSplat = GrowableXYZArray.create(splat);
      const data = [growableSplat, rectangle];
      const range = Range3d.createFromVariantData(data);
      const dx = range.xLength() * 2.0;
      const dy = range.yLength() * 2.0;
      y0 = 0.0;
      const graph = HalfEdgeGraphMerge.formGraphFromChains(data, true)!;
      GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0);
      y0 += dy;
      const polyface = PolyfaceBuilder.graphToPolyface(graph);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "CleanupSawTooth");
    expect(context.getNumErrors()).toBe(0);
  });

  it("BooleanNullFaces", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const outerRectangle = Sample.createRectangleXY(0, 0, 10, 6);
    for (const innerRectangle of [
      Sample.createRectangleXY(2, 4, -2, 2),
      Sample.createRectangleXY(2, 0, 3, 2),
      Sample.createRectangleXY(8, 0, 2, 2),
      Sample.createRectangleXY(3, 4, 2, 2),
      Sample.createRectangleXY(0, 0, 3, 6)]) {
      context.testBooleans(outerRectangle, innerRectangle);
      context.saveAndReset("RegionOps", "BooleanSplat");
    }
    expect(context.getNumErrors()).toBe(0);
  });

  it("centroidAreaNormal", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0;
    let dy = 0;
    let loop: Loop | undefined;
    const rotationMatrix = Matrix3d.createRotationAroundVector(Vector3d.create(0, 1, 0), Angle.createDegrees(45))!;
    const rotationTransform = Transform.createFixedPointAndMatrix(Point3d.create(), rotationMatrix);

    // square
    let expectedCentroid = Point3d.create(1.5, 1.5);
    let expectedNormal = Vector3d.create(0, 0, 1);
    let expectedArea = 1;
    let lineString = LineString3d.create([1, 1], [2, 1], [2, 2], [1, 2], [1, 1]);
    loop = Loop.create(lineString);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    const ray = RegionOps.centroidAreaNormal(loop);
    let centroid: Point3d;
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for square");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for square");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for square");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for square");
    }
    // square in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1.5, 1.5));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 1;
    lineString = LineString3d.create([1, 1], [2, 1], [2, 2], [1, 2], [1, 1]);
    loop = Loop.create(lineString).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for square in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for square in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for square in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for square in 3d");
    }
    // rectangle
    dx += 2;
    expectedCentroid = Point3d.create(2, 1.5);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 2;
    lineString = LineString3d.create([1, 1], [3, 1], [3, 2], [1, 2], [1, 1]);
    loop = Loop.create(lineString);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for rectangle");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for rectangle");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for rectangle");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for rectangle");
    }
    // rectangle in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(2, 1.5));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 2;
    lineString = LineString3d.create([1, 1], [3, 1], [3, 2], [1, 2], [1, 1]);
    loop = Loop.create(lineString).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for rectangle in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for rectangle in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for rectangle in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for rectangle in 3d");
    }

    // dart
    dx += 4;
    expectedCentroid = Point3d.create(2 / 3, 2 / 3);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 0.5;
    lineString = LineString3d.create([0, 0], [2, 1], [0.5, 0.5], [1, 2], [0, 0]);
    loop = Loop.create(lineString);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for dart");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for dart");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for dart");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for dart");
    }
    // dart in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(2 / 3, 2 / 3));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 0.5;
    lineString = LineString3d.create([0, 0], [2, 1], [0.5, 0.5], [1, 2], [0, 0]);
    loop = Loop.create(lineString).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for dart in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for dart in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for dart in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for dart in 3d");
    }
    // circle
    dx += 3;
    expectedCentroid = Point3d.create(1, 2);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = Math.PI;
    let arc = Arc3d.createXY(expectedCentroid, 1.0);
    loop = Loop.create(arc);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for circle");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for circle");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for circle");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for circle");
    }
    // circle in 3d
    let center = Point3d.create(1, 2);
    expectedCentroid = rotationTransform.multiplyPoint3d(center);
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = Math.PI;
    arc = Arc3d.createXY(center, 1.0);
    loop = Loop.create(arc).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for circle in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for circle in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for circle in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for circle in 3d");
    }
    // ellipse
    dx += 5;
    expectedCentroid = Point3d.create(0, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 4 * Math.PI;
    arc = Arc3d.create(
      expectedCentroid, Vector3d.create(2, 2), Vector3d.create(-1, 1), AngleSweep.createStartEndDegrees(360, 0),
    );
    loop = Loop.create(arc);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for arc");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for arc");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for arc");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for arc");
    }
    // ellipse in 3d
    center = Point3d.create(0, 1);
    expectedCentroid = rotationTransform.multiplyPoint3d(center);
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, -1)));
    expectedArea = 4 * Math.PI;
    arc = Arc3d.create(center, Vector3d.create(2, 2), Vector3d.create(-1, 1), AngleSweep.createStartEndDegrees(360, 0));
    loop = Loop.create(arc).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy);
    RegionOps.centroidAreaNormal(loop, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for arc in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for arc in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for arc in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for arc in 3d");
    }
    // bspline0
    dx += 5;
    expectedCentroid = Point3d.create(-0.002899711646546525, 1.6846557155837842);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 4.817806468040612;
    const degree = 3;
    const closedPoleArray0 = [
      Point3d.create(0, 0),
      Point3d.create(-1, 1),
      Point3d.create(-2, 3),
      Point3d.create(2, 3),
      Point3d.create(1, 1),
      Point3d.create(0, 0),
    ];
    const knotArray0 = [0, 0, 0, 0.33, 0.66, 1, 1, 1];
    const bspline0 = BSplineCurve3d.create(closedPoleArray0, knotArray0, degree + 1)!;
    let loop0 = Loop.create(bspline0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop0, dx, dy);
    RegionOps.centroidAreaNormal(loop0, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for bspline0");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for bspline0");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for bspline0");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for bspline0");
    }
    // bspline0 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(-0.002899711646546525, 1.6846557155837842));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, -1)));
    expectedArea = 4.817806468040612;
    loop0 = Loop.create(bspline0).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop0, dx, dy);
    RegionOps.centroidAreaNormal(loop0, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for bspline0 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for bspline0 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for bspline0 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for bspline0 in 3d");
    }
    // bspline1
    dx += 2;
    expectedCentroid = Point3d.create(1.238143022179664, 1.2381197066333935);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 2.9971577457816796;
    const closedPoleArray1 = [
      Point3d.create(0, 0),
      Point3d.create(1, 3),
      Point3d.create(2, 2),
      Point3d.create(3, 1),
      Point3d.create(0, 0),
    ];
    const knotArray1 = [0, 0, 0, 0.5, 1, 1, 1];
    const bspline1 = BSplineCurve3d.create(closedPoleArray1, knotArray1, degree + 1)!;
    let loop1 = Loop.create(bspline1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop1, dx, dy);
    RegionOps.centroidAreaNormal(loop1, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for bspline1");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for bspline1");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for bspline1");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for bspline1");
    }
    // bspline1 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1.238143022179664, 1.2381197066333935));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, -1)));
    expectedArea = 2.9971577457816796;
    loop1 = Loop.create(bspline1).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop1, dx, dy);
    RegionOps.centroidAreaNormal(loop1, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for bspline1 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for bspline1 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for bspline1 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for bspline1 in 3d");
    }
    // loop0 with multiple children
    dx = 0;
    dy += 5;
    expectedCentroid = Point3d.create(1, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 2 + Math.PI / 2;
    let arc0 = Arc3d.create(
      expectedCentroid, Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 90),
    );
    let linestring0 = LineString3d.create([1, 2], [0, 2], [0, 1]);
    let arc1 = Arc3d.create(
      expectedCentroid, Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 270),
    );
    const linestring1 = LineString3d.create([1, 0], [2, 0], [2, 1]);
    loop0 = Loop.create(arc0, linestring0, arc1, linestring1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop0, dx, dy);
    RegionOps.centroidAreaNormal(loop0, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for loop0");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for loop0");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for loop0");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for loop0");
    }
    // loop0 with multiple children in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1, 1));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 2 + Math.PI / 2;
    loop0 = Loop.create(arc0, linestring0, arc1, linestring1).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop0, dx, dy);
    RegionOps.centroidAreaNormal(loop0, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for loop0 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for loop0 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for loop0 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for loop0 in 3d");
    }
    // loop1 with multiple children
    dx += 4;
    expectedCentroid = Point3d.create(1, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 4 + 2 * Math.PI;
    arc0 = Arc3d.create(
      Point3d.create(1, 0), Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(180, 360),
    );
    arc1 = Arc3d.create(
      Point3d.create(2, 1), Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-90, 90),
    );
    const arc2 = Arc3d.create(
      Point3d.create(1, 2), Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 180),
    );
    const arc3 = Arc3d.create(
      Point3d.create(0, 1), Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(90, 270),
    );
    loop1 = Loop.create(arc0, arc1, arc2, arc3);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop1, dx, dy);
    RegionOps.centroidAreaNormal(loop1, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for loop1");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for loop1");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for loop1");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for loop1");
    }
    // loop1 with multiple children in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1, 1));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 4 + 2 * Math.PI;
    loop1 = Loop.create(arc0, arc1, arc2, arc3).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop1, dx, dy);
    RegionOps.centroidAreaNormal(loop1, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for loop1 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for loop1 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for loop1 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for loop1 in 3d");
    }
    // loop2 with multiple children
    dx += 5;
    expectedCentroid = Point3d.create(0.9510277451111325, -0.02140759703854831);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 7 + Math.PI / 4;
    arc0 = Arc3d.create(
      Point3d.create(2, 0), Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(0, 90),
    );
    linestring0 = LineString3d.create([2, 1], [-1, 1], [-1, -1], [3, -1], [3, 0]);
    let loop2 = Loop.create(arc0, linestring0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop2, dx, dy);
    RegionOps.centroidAreaNormal(loop2, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for loop2");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for loop2");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for loop2");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for loop2");
    }
    // loop2 with multiple children in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(0.9510277451111325, -0.02140759703854831));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 7 + Math.PI / 4;
    loop2 = Loop.create(arc0, linestring0).cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop2, dx, dy);
    RegionOps.centroidAreaNormal(loop2, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for loop2 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for loop2 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for loop2 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for loop2 in 3d");
    }
    // union region 1
    dx = 0;
    dy += 5;
    expectedCentroid = Point3d.create(0.5, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    let overlapArea = 2 * Math.PI / 3 - Math.sqrt(3) / 2;
    expectedArea = 2 * Math.PI - overlapArea;
    loop0 = Loop.create(Arc3d.createXY(Point3d.create(0, 1), 1));
    loop1 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1));
    loop2 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1));
    let unionRegion = UnionRegion.create(loop0, loop1, loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionRegion, dx, dy);
    RegionOps.centroidAreaNormal(unionRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for union region 1");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for union region 1");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for union region 1");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for union region 1");
    }
    // union region 1 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(0.5, 1));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 2 * Math.PI - overlapArea;
    let rotatedUnionRegion = unionRegion.cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedUnionRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedUnionRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for union region 1 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for union region 1 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for union region 1 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for union region 1 in 3d");
    }
    // union region 2
    dx += 4;
    expectedCentroid = Point3d.create(1, 2);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 2 * Math.PI;
    loop0 = Loop.create(Arc3d.createXY(Point3d.create(0, 1), 1));
    loop1 = Loop.create(Arc3d.createXY(Point3d.create(2, 3), 1));
    unionRegion = UnionRegion.create(loop0, loop1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionRegion, dx, dy);
    RegionOps.centroidAreaNormal(unionRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for union region 2");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for union region 2");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for union region 2");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for union region 2");
    }
    // union region 2 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1, 2));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 2 * Math.PI;
    rotatedUnionRegion = unionRegion.cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedUnionRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedUnionRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for union region 2 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for union region 2 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for union region 2 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for union region 2 in 3d");
    }
    // union region 3
    dx += 5;
    expectedCentroid = Point3d.create(2.4399541531178177, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 19.251373275327744;
    loop0 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 2));
    loop1 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1));
    let parityRegion = ParityRegion.create(loop0, loop1);
    loop = Loop.create(Arc3d.createXY(Point3d.create(3.5, 1), 2));
    unionRegion = UnionRegion.create(parityRegion, loop);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionRegion, dx, dy);
    RegionOps.centroidAreaNormal(unionRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for union region 3");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for union region 3");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for union region 3");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for union region 3");
    }
    // union region 3 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(2.4399541531178177, 1));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 19.251373275327744;
    rotatedUnionRegion = unionRegion.cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedUnionRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedUnionRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for union region 3 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for union region 3 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for union region 3 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for union region 3 in 3d");
    }
    // parity region 1
    dx = 0;
    dy += 5;
    expectedCentroid = Point3d.create(0.5, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    overlapArea = 2 * Math.PI / 3 - Math.sqrt(3) / 2;
    expectedArea = 2 * Math.PI - 2 * overlapArea;
    loop0 = Loop.create(Arc3d.createXY(Point3d.create(0, 1), 1));
    loop1 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1));
    parityRegion = ParityRegion.create(loop0, loop1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, parityRegion, dx, dy);
    RegionOps.centroidAreaNormal(parityRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for parity region 1");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 1");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 1");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 1");
    }
    // parity region 1 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(0.5, 1));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 2 * Math.PI - 2 * overlapArea;
    let rotatedParityRegion = parityRegion.cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedParityRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedParityRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for parity region 1 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 1 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 1 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 1 in 3d");
    }
    // parity region 2
    dx += 4;
    expectedCentroid = Point3d.create(1, 2);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 2 * Math.PI;
    loop0 = Loop.create(Arc3d.createXY(Point3d.create(0, 1), 1));
    loop1 = Loop.create(Arc3d.createXY(Point3d.create(2, 3), 1));
    parityRegion = ParityRegion.create(loop0, loop1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, parityRegion, dx, dy);
    RegionOps.centroidAreaNormal(parityRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for parity region 2");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 2");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 2");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 2");
    }
    // parity region 2 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1, 2));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 2 * Math.PI;
    rotatedParityRegion = parityRegion.cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedParityRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedParityRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for parity region 2 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 2 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 2 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 2 in 3d");
    }
    // parity region 3
    dx += 5;
    expectedCentroid = Point3d.create(1, 1);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 3 * Math.PI - 4 * overlapArea;
    loop0 = Loop.create(Arc3d.createXY(Point3d.create(0, 1), 1));
    loop1 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1));
    loop2 = Loop.create(Arc3d.createXY(Point3d.create(2, 1), 1));
    parityRegion = ParityRegion.create(loop0, loop1, loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, parityRegion, dx, dy);
    RegionOps.centroidAreaNormal(parityRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for parity region 3");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 3");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 3");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 3");
    }
    // parity region 3 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(1, 1));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 3 * Math.PI - 4 * overlapArea;
    rotatedParityRegion = parityRegion.cloneTransformed(rotationTransform) as Loop;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedParityRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedParityRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for parity region 3 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 3 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 3 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 3 in 3d");
    }
    // parity region 4
    dx += 4;
    expectedCentroid = Point3d.create(5, 3.8136483127358547);
    expectedNormal = Vector3d.create(0, 0, 1);
    expectedArea = 80 - 4 * Math.PI;
    const rectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    const circle = Loop.create(Arc3d.createXY(Point3d.create(5, 5), 2));
    const region = RegionOps.regionBooleanXY(rectangle, circle, RegionBinaryOpType.AMinusB)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, dx, dy);
    RegionOps.centroidAreaNormal(region, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, centroid, 0.1, dx, dy);
      ck.testDefined(ray, "ray defined for parity region 4");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 4");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 4");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 4");
    }
    // parity region 4 in 3d
    expectedCentroid = rotationTransform.multiplyPoint3d(Point3d.create(5, 3.8136483127358547));
    expectedNormal = Vector3d.createFrom(rotationTransform.multiplyPoint3d(Point3d.create(0, 0, 1)));
    expectedArea = 80 - 4 * Math.PI;
    const rotatedRegion = region.cloneTransformed(rotationTransform) as AnyRegion;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rotatedRegion, dx, dy);
    RegionOps.centroidAreaNormal(rotatedRegion, ray);
    if (ck.testDefined(ray, "computed centroid and normal") && ck.testDefined(ray.a, "computed area")) {
      centroid = ray.origin;
      ck.testDefined(ray, "ray defined for parity region 4 in 3d");
      ck.testPoint3d(centroid, expectedCentroid, "ray origin matches centroid for parity region 4 in 3d");
      ck.testVector3d(ray.direction, expectedNormal, "ray direction matches Z axis for parity region 4 in 3d");
      ck.testCoordinate(ray.a, expectedArea, "ray.a matches area for parity region 4 in 3d");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "centroidAreaNormal");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("MergeRegionArea", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0;
    let mergedArea, holeArea, expectedArea;
    const rectangleArea = 80;

    // region with circle hole
    const rectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    let hole = Loop.create(
      Arc3d.create(
        Point3d.create(5, 5), Vector3d.create(2, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(-60, 300),
      ),
    );
    let region = RegionOps.regionBooleanXY(rectangle, hole, RegionBinaryOpType.AMinusB)!;
    let regionArea = RegionOps.computeXYArea(region)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, region);

    let merged = RegionOps.regionBooleanXY(region, undefined, RegionBinaryOpType.Union)
    if (ck.testDefined(merged, "merge operation succeeded")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, merged, 0, 10);
      mergedArea = RegionOps.computeXYArea(merged);
      if (ck.testDefined(mergedArea, "area computed for merged region")) {
        holeArea = Math.PI * 4;
        expectedArea = rectangleArea - holeArea;
        ck.testCoordinate(regionArea, expectedArea, "area before merge");
        ck.testCoordinate(mergedArea, expectedArea, "area after merge");
      }
    }

    // region with large B-Spline hole
    dx += 15;
    const degree = 2;
    let poles = [
      Point3d.create(3, 3),
      Point3d.create(7, 3),
      Point3d.create(3, 7),
      Point3d.create(3, 3),
    ];
    let bspline = BSplineCurve3d.createPeriodicUniformKnots(poles, degree + 1)!;
    hole = Loop.create(bspline);
    region = RegionOps.regionBooleanXY(rectangle, hole, RegionBinaryOpType.AMinusB)!;
    regionArea = RegionOps.computeXYArea(region)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, dx);

    merged = RegionOps.regionBooleanXY(region, undefined, RegionBinaryOpType.Union)!;
    if (ck.testDefined(merged, "merge operation succeeded")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, merged, dx, 10);
      mergedArea = RegionOps.computeXYArea(merged);
      if (ck.testDefined(mergedArea, "area computed for merged region")) {
        holeArea = 5.98546797013559;
        expectedArea = rectangleArea - holeArea;
        ck.testCoordinate(regionArea, expectedArea, "area before merge");
        ck.testCoordinate(mergedArea, expectedArea, "area after merge");
      }
    }

    // region with small B-Spline hole
    dx += 15;
    poles = [
      Point3d.create(1, 0.5),
      Point3d.create(2, 1),
      Point3d.create(1.5, 1.5),
      Point3d.create(1, 0.5),
    ];
    bspline = BSplineCurve3d.createPeriodicUniformKnots(poles, degree + 1)!;
    hole = Loop.create(bspline);
    region = RegionOps.regionBooleanXY(rectangle, hole, RegionBinaryOpType.AMinusB)!;
    regionArea = RegionOps.computeXYArea(region)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, dx);

    merged = RegionOps.regionBooleanXY(region, undefined, RegionBinaryOpType.Union)!;
    if (ck.testDefined(merged, "merge operation succeeded")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, merged, dx, 10);
      mergedArea = RegionOps.computeXYArea(merged);
      if (ck.testDefined(mergedArea, "area computed for merged region")) {
        holeArea = 0.28065082813693;
        expectedArea = rectangleArea - holeArea;
        ck.testCoordinate(regionArea, expectedArea, "area before merge");
        ck.testCoordinate(mergedArea, expectedArea, "area after merge");
      }
    }

    // parity region with loop and parity region islands (disjoint loops)
    dx += 15;
    const rect1x1 = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 1, 1, 0, true)));
    const rect3x3 = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 3, 3, 0, true)));
    const rect7x6 = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 7, 6, 0, true)));
    const rect11x9 = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 11, 9, 0, true)));
    const parityRegion = ParityRegion.create(
      rect11x9.clone() as Loop, // outer
      rect1x1.cloneTransformed(Transform.createTranslationXYZ(1, 7)) as Loop, // hole in outer
      rect7x6.cloneTransformed(Transform.createTranslationXYZ(3, 1)) as Loop, // large hole in outer
      rect1x1.cloneTransformed(Transform.createTranslationXYZ(4, 5)) as Loop, // small island in large hole
      rect3x3.cloneTransformed(Transform.createTranslationXYZ(6, 2)) as Loop, // large island in large hole
      rect1x1.cloneTransformed(Transform.createTranslationXYZ(7, 3)) as Loop, // hole in large island
    );
    regionArea = RegionOps.computeXYArea(parityRegion)!;
    ck.testCoordinate(regionArea, 65, "parity region area as expected");
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, parityRegion, dx);
    // check how sorter organizes the children
    const sortedParityRegionChildren = RegionOps.sortOuterAndHoleLoopsXY(parityRegion.children);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, sortedParityRegionChildren, dx, 10);
    if (ck.testType(sortedParityRegionChildren, UnionRegion, "sortOuterAndHoleLoopsXY returns a UnionRegion")) {
      if (ck.testExactNumber(3, sortedParityRegionChildren.children.length, "sortOuterAndHoleLoopsXY sorts into 3 regions")) {
        sortedParityRegionChildren.children.sort((a, b) => RegionOps.computeXYArea(a)! - RegionOps.computeXYArea(b)!);
        let child = sortedParityRegionChildren.children[0];
        ck.testType(child, Loop, "small region is a loop");
        ck.testCoordinate(RegionOps.computeXYArea(child)!, 1, "small region area as expected");
        child = sortedParityRegionChildren.children[1];
        ck.testType(child, ParityRegion, "medium region is a parity region");
        ck.testCoordinate(RegionOps.computeXYArea(child)!, 8, "medium region area as expected");
        child = sortedParityRegionChildren.children[2];
        ck.testType(child, ParityRegion, "large region is a parity region");
        ck.testCoordinate(RegionOps.computeXYArea(child)!, 56, "large region area as expected");
      }
    }

    // disjoint union of two copies of the previous parity region
    dx += 15;
    const unionRegion = UnionRegion.create(parityRegion.clone(), parityRegion.cloneTransformed(Transform.createTranslationXYZ(0, 10)) as ParityRegion);
    regionArea = RegionOps.computeXYArea(unionRegion)!;
    ck.testCoordinate(regionArea, 130, "union region area as expected");
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionRegion, dx);

    // venn-diagram parity region (intersecting loops)
    dx += 20;
    const dy = 5;
    const circle = Loop.create(Arc3d.createXY(Point3d.createZero(), 2.5));
    const venn0 = circle.cloneTransformed(Transform.createTranslationXYZ(Math.sqrt(3), 1)) as Loop;
    const venn1 = circle.cloneTransformed(Transform.createTranslationXYZ(-Math.sqrt(3), 1)) as Loop;
    const venn2 = circle.cloneTransformed(Transform.createTranslationXYZ(0, -2)) as Loop;
    const vennRegion = ParityRegion.create(venn0, venn1, venn2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, vennRegion, dx, dy);
    ck.testCoordinate(RegionOps.computeXYArea(vennRegion)!, 40.41956377576274, "venn region area as expected");
    // check how merge operation converts this parity region
    merged = RegionOps.regionBooleanXY(vennRegion, undefined, RegionBinaryOpType.Union);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, merged, dx, dy + 10);
    if (ck.testType(merged, UnionRegion, "merge returns a UnionRegion")) {
      if (ck.testExactNumber(4, merged.children.length, "merge splits intersecting circles into 4 regions")) {
        merged.children.sort((a, b) => RegionOps.computeXYArea(a)! - RegionOps.computeXYArea(b)!);
        let child = merged.children[0];
        ck.testType(child, Loop, "small region is a loop");
        ck.testCoordinate(RegionOps.computeXYArea(child)!, 1.1124940184117313, "small region area as expected");
        for (let i = 1; i < 4; i++) {
          child = merged.children[i];
          ck.testType(child, Loop, "larger regions are parity regions");
          ck.testCoordinate(RegionOps.computeXYArea(child)!, 13.102356585783673, "larger region areas as expected");
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "MergeRegionArea");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("constructAllXYRegionLoops", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const deltaX = 5;
    const deltaY = 3;
    const deltaZ = 2;
    let x0 = -deltaX;
    let y0 = -deltaY;
    const compareLoops = (loops0: Loop[], loops1: Loop[], testName: string): void => {
      if (ck.testExactNumber(loops0.length, loops1.length, `${testName}: loop count`)) {
        const lengths0 = new SortedArray<number>(compareNumbers);
        const lengths1 = new SortedArray<number>(compareNumbers);
        for (let i = 0; i < loops0.length; i++) {
          lengths0.insert(loops0[i].sumLengths());
          lengths1.insert(loops1[i].sumLengths());
        }
        ck.testNumberArrayWithTol(lengths0.extractArray(), lengths1.extractArray(), Geometry.smallMetricDistance, `${testName}: loop lengths`);
      }
    };
    const compareSignedLoops = (signedLoops0: SignedLoops[], signedLoops1: SignedLoops[], testName: string): void => {
      if (ck.testExactNumber(signedLoops0.length, signedLoops1.length, `${testName}: component count`)) {
        for (let i = 0; i < signedLoops0.length; i++) {
          compareLoops(signedLoops0[i].positiveAreaLoops, signedLoops1[i].positiveAreaLoops, `${testName}[component${i} positive loops]`);
          compareLoops(signedLoops0[i].negativeAreaLoops, signedLoops1[i].negativeAreaLoops, `${testName}[component${i} negative loops]`);
          ck.testExactNumber(signedLoops0[i].slivers.length, signedLoops1[i].slivers.length, `${testName}[component${i}]: sliver edge count`);
        }
      }
    };
    // expected count arrays: #component, #posLoop, #negLoop
    const testSignedLoopsSingle = (curves: AnyCurve | AnyCurve[], addBridges: boolean, expectedCounts: number[], testName: string): SignedLoops[] => {
      let numPosLoops = 0;
      let numNegLoops = 0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, curves, x0, y0 += deltaY);
      const signedLoops = RegionOps.constructAllXYRegionLoops(curves, undefined, addBridges);
      for (const signedLoop of signedLoops) {
        y0 += deltaY;
        let z0 = -deltaZ;
        for (const posLoop of signedLoop.positiveAreaLoops)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, posLoop, x0, y0, z0 += deltaZ);
        y0 += deltaY;
        z0 = -deltaZ;
        for (const negLoop of signedLoop.negativeAreaLoops)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, negLoop, x0, y0, z0 += deltaZ);
        numPosLoops += signedLoop.positiveAreaLoops.length;
        numNegLoops += signedLoop.negativeAreaLoops.length;
      }
      ck.testExactNumber(signedLoops.length, expectedCounts[0], `${testName}${addBridges ? " [bridges]" : ""}: number of components`);
      ck.testExactNumber(numPosLoops, expectedCounts[1], `${testName}${addBridges ? " [bridges]" : ""}: total number of positive loops`);
      ck.testExactNumber(numNegLoops, expectedCounts[2], `${testName}${addBridges ? " [bridges]" : ""}: total number of negative loops`);
      return signedLoops;
    };
    const testSignedLoops = (curves: AnyCurve | AnyCurve[], expectedCountsNoBridges: number[], expectedCountsWithBridges: number[], testName: string): { noBridges: SignedLoops[], withBridges: SignedLoops[] } => {
      x0 += deltaX;
      y0 = -deltaY;
      const noBridges = testSignedLoopsSingle(curves, false, expectedCountsNoBridges, testName);
      const withBridges = testSignedLoopsSingle(curves, true, expectedCountsWithBridges, testName);
      return { noBridges, withBridges };
    }

    const loop0 = Loop.create(Arc3d.createXY(Point3d.create(0, 1), 1.0));
    const loop1 = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1.0));
    let unionRegion = UnionRegion.create(loop0, loop1);
    let unionData = testSignedLoops(unionRegion, [1, 3, 1], [1, 3, 1], "UnionRegionIntersectingLoops");
    let parityRegion = ParityRegion.create(loop0, loop1);
    let parityData = testSignedLoops(parityRegion, [1, 3, 1], [1, 3, 1], "ParityRegionIntersectingLoops");
    compareSignedLoops(unionData.noBridges, parityData.noBridges, "UnionAndParityIntersectingLoopsNoBridges");
    compareSignedLoops(unionData.withBridges, parityData.withBridges, "UnionAndParityIntersectingLoopsBridges");

    const rectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 3, 2, 0, true)));
    const hole = Loop.create(Arc3d.create(Point3d.create(1.5, 1), Vector3d.create(0.5), Vector3d.create(0, 0.5), AngleSweep.createStartEndDegrees(-90, 270)));
    unionRegion = UnionRegion.create(rectangle, hole);
    unionData = testSignedLoops(unionRegion, [2, 2, 2], [1, 2, 1], "UnionRegionDisjointLoops");
    parityRegion = ParityRegion.create(rectangle, hole);
    parityData = testSignedLoops(parityRegion, [2, 2, 2], [1, 2, 1], "ParityRegionDisjointLoops");
    compareSignedLoops(unionData.noBridges, parityData.noBridges, "UnionAndParityDisjointLoopsNoBridges");
    compareSignedLoops(unionData.withBridges, parityData.withBridges, "UnionAndParityDisjointLoopsBridges");
    const parityRegion2 = RegionOps.regionBooleanXY(rectangle, hole, RegionBinaryOpType.AMinusB)!;
    const parityData2 = testSignedLoops(parityRegion2, [2, 2, 2], [1, 2, 1], "ParityRegionFromBooleanSubtract");
    compareSignedLoops(parityData.withBridges, parityData2.withBridges, "ParityRegionsWithBridges");

    const poles0 = [Point3d.createZero(), Point3d.create(3), Point3d.create(3, 2), Point3d.create(1.5, 1.5)];
    const hole0 = Loop.create(BSplineCurve3d.createPeriodicUniformKnots(poles0, 4)!);
    const poles1 = [Point3d.create(1, 0.5), Point3d.create(2, 1), Point3d.create(1.5, 1.5)];
    const hole1 = Loop.create(BSplineCurve3d.createPeriodicUniformKnots(poles1, 3)!);
    const holes = [hole0, hole1];
    for (let i = 0; i < holes.length; ++i) {
      const region0 = ParityRegion.create(rectangle, holes[i]);
      const parityData0 = testSignedLoops(region0, [2, 2, 2], [1, 2, 1], `ParityRegionBSplineHole${i}`);
      const region1 = RegionOps.regionBooleanXY(rectangle, holes[i], RegionBinaryOpType.AMinusB)!;
      const parityData1 = testSignedLoops(region1, [2, 2, 2], [1, 2, 1], `ParityRegionBSplineHole${i}FromBooleanSubtract`);
      compareSignedLoops(parityData0.withBridges, parityData1.withBridges, "ParityRegionsBSplineHoleWithBridges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "constructAllXYRegionLoops");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("RegionBooleanMerge", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let isArray = false, hasLoopEntries = false;
    const arrayConsistsOfLoops = (a: Array<any>) => a.every((value: any) => value instanceof Loop);
    const regions = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/data/curve/areaBoolean/unionRegionWithOverlappingLoops.imjs", "utf8")));
    if (ck.testDefined(regions, "read regions from file")) {
      if ((isArray = Array.isArray(regions)) && ck.testTrue(isArray, "regions is an array")) {
        if (ck.testExactNumber(3, regions.length, "regions has 3 entries")) {
          if ((hasLoopEntries = arrayConsistsOfLoops(regions)) && ck.testTrue(hasLoopEntries, "region entries are Loops")) {
            const merged = RegionOps.regionBooleanXY(regions, undefined, RegionBinaryOpType.Union);
            if (ck.testDefined(merged, "merge operation succeeded")) {
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, merged);
              if (ck.testType(merged, UnionRegion, "merge operation results in a UnionRegion")) {
                if (ck.testExactNumber(3, merged.children.length, "merged region has 3 children")) {
                  if ((hasLoopEntries = arrayConsistsOfLoops(merged.children)) && ck.testTrue(hasLoopEntries, "merged region children are Loops")) {
                    let totalMergedArea = 0;
                    for (const loop of merged.children) {
                      const area = RegionOps.computeXYArea(loop);
                      if (ck.testDefined(area, "area computed for loop")) {
                        totalMergedArea += area;
                        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, 0, 0, 50);
                      }
                    }
                    const loopData = RegionOps.constructAllXYRegionLoops(merged);
                    let totalPosLoopArea = 0;
                    let totalNegLoopArea = 0;
                    for (const component of loopData) {
                      for (const loop of component.positiveAreaLoops) {
                        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, 0, 0, 100);
                        const area = RegionOps.computeXYArea(loop);
                        if (ck.testDefined(area, "area computed for interior loop"))
                          totalPosLoopArea += area;
                      }
                      for (const loop of component.negativeAreaLoops) {
                        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, 0, 0, 150);
                        const area = RegionOps.computeXYArea(loop);
                        if (ck.testDefined(area, "area computed for exterior loop"))
                          totalNegLoopArea += area;
                      }
                    }
                    if (ck.testExactNumber(1, loopData.length, "constructAllXYRegionLoops found one component")) {
                      ck.testExactNumber(3, loopData[0].positiveAreaLoops.length, "constructAllXYRegionLoops found 3 positive area loops");
                      ck.testExactNumber(1, loopData[0].negativeAreaLoops.length, "constructAllXYRegionLoops found 1 negative area loop");
                      ck.testExactNumber(4, loopData[0].slivers.length, "constructAllXYRegionLoops found 4 sliver faces");
                      if (ck.testDefined(loopData[0].edges, "constructAllXYRegionLoops computed edges"))
                        ck.testExactNumber(24, loopData[0].edges.length, "constructAllXYRegionLoops found 24 edges");
                    }
                    ck.testCoordinate(totalPosLoopArea, Math.abs(totalNegLoopArea), "interior and boundary loop areas match");
                    ck.testCoordinate(totalMergedArea, Math.abs(totalNegLoopArea), "merged region area matches boundary area");
                  }
                }
              }
            }
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "RegionBooleanMerge");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SimplifyRegionType", () => {
    const ck = new Checker();
    let loop0: AnyRegion = Loop.create(Arc3d.createUnitCircle());
    const loop1: AnyRegion = Loop.create(Arc3d.createXY(Point3d.create(1, 1), 1));
    let parity1: AnyRegion = ParityRegion.create(loop0.clone() as Loop);
    let parity2: AnyRegion = ParityRegion.create(loop0.clone() as Loop, loop1.clone() as Loop);
    let union1A: AnyRegion = UnionRegion.create(loop0.clone() as Loop);
    let union1B: AnyRegion = UnionRegion.create(parity1.clone());
    let union1C: AnyRegion = UnionRegion.create(parity2.clone());
    const union2: AnyRegion = UnionRegion.create(loop0.clone() as Loop, parity1.clone());

    ck.testType(RegionOps.simplifyRegionType(loop0), Loop, "simplifying a Loop returns a Loop");
    ck.testType(RegionOps.simplifyRegionType(parity1), Loop, "simplifying a ParityRegion with one Loop returns a Loop");
    ck.testType(RegionOps.simplifyRegionType(parity2), ParityRegion, "simplifying a ParityRegion with two Loops returns a ParityRegion");
    ck.testType(RegionOps.simplifyRegionType(union1A), Loop, "simplifying a UnionRegion with one Loop returns a Loop");
    ck.testType(RegionOps.simplifyRegionType(union1B), Loop, "simplifying a UnionRegion with one ParityRegion with one Loop returns a Loop");
    ck.testType(RegionOps.simplifyRegionType(union1C), ParityRegion, "simplifying a UnionRegion with one ParityRegion with multiple Loops returns a ParityRegion");
    ck.testType(RegionOps.simplifyRegionType(union2), UnionRegion, "simplifying a UnionRegion with multiple children returns a UnionRegion");

    const testValidate = (inputRegion: AnyRegion, expectedResult: AnyRegion | CurvePrimitive | undefined, msg: string): AnyRegion => {
      const saveInput = inputRegion.clone() as AnyRegion;
      const expectedChildCount = expectedResult?.children?.length ?? 0;
      const result = RegionOps.simplifyRegion(inputRegion); // mutates inputRegion
      ck.testTrue(result === expectedResult, msg);
      ck.testExactNumber(expectedChildCount, result?.children.length ?? 0, `${msg} (with expected child count)`);
      return saveInput; // so caller can restore inputRegion
    }

    loop0 = testValidate(loop0, loop0, "validating a Loop returns the Loop");
    parity1 = testValidate(parity1, parity1.getChild(0), "validating a ParityRegion with one Loop returns the Loop");
    parity2 = testValidate(parity2, parity2, "validating a ParityRegion with two Loops returns the ParityRegion");
    union1A = testValidate(union1A, union1A.getChild(0), "validating a UnionRegion with one Loop returns the Loop");
    union1B = testValidate(union1B, union1B.getChild(0)?.getChild(0), "validating a UnionRegion with one ParityRegion with one Loop returns the Loop");
    union1C = testValidate(union1C, union1C.getChild(0), "validating a UnionRegion with one ParityRegion with multiple Loops returns the ParityRegion");

    const union2Loop0 = union2.getChild(0);
    const union2Loop1 = union2.getChild(1)?.getChild(0);
    testValidate(union2, union2, "validating a UnionRegion with multiple children returns the UnionRegion");
    ck.testTrue(union2.getChild(0) === union2Loop0 && union2.getChild(1) === union2Loop1, "validating a UnionRegion with a Loop and a ParityRegion with one Loop returns the UnionRegion with the two Loops");
    testValidate(union2, union2, "validation is idempotent");

    testValidate(loop1.cloneEmptyPeer(), undefined, "validating an empty Loop returns undefined");
    testValidate(parity1.cloneEmptyPeer(), undefined, "validating an empty ParityRegion returns undefined");
    testValidate(union1A.cloneEmptyPeer(), undefined, "validating an empty UnionRegion returns undefined");

    const union3: AnyRegion = UnionRegion.create(loop1.cloneEmptyPeer(), parity1.clone() as ParityRegion, loop1.cloneEmptyPeer());
    testValidate(union3, union3.getChild(1)?.getChild(0), "validating a UnionRegion with a ParityRegion with one Loop and some empty Loops returns the ParityRegion's Loop");

    expect(ck.getNumErrors()).toBe(0);
  });
});

/**
 * Exercise PolygonWireOffset and output to a file.
 * @param polygons polygons to offset
 * @param caseName name to use for output file
 * @param distances offset distances
 * @param distanceFactor factor to apply to distances.
 */
function testPolygonOffset(
  polygons: Point3d[][], caseName: string, distances: number[], distanceFactor: number,
) {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0;
  let y0 = 0;

  for (const points of polygons) {
    const range = Range3d.createArray(points);
    const yStep = 2.0 * range.yLength() + 10;
    y0 = 0.0;
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
    y0 += yStep;
    for (const closed of [false, true]) {
      if (closed && !points[0].isAlmostEqualMetric(points[points.length - 1]))
        continue;
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
      for (const offsetDistance of distances) {
        const stickA = RegionOps.constructPolygonWireXYOffset(points, closed, offsetDistance * distanceFactor);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA, x0, y0, 0);
      }
      y0 += yStep;
    }
    x0 += yStep;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", caseName);
  expect(ck.getNumErrors()).toBe(0);
}

/**
 * Exercise PolygonWireOffset and output to a file.
 * @param polygons polygons to offset
 * @param caseName name to use for output file
 * @param distances offset distances
 * @param distanceFactor factor to apply to distances.
 */
function testFilteredPolygonOffset(
  polygons: Point3d[][], caseName: string, distances: number[], filterFactor: number[],
) {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0;
  let y0 = 0;

  const context = new PolygonWireOffsetContext();
  for (const points of polygons) {
    const range = Range3d.createArray(points);
    const yStep = 2.0 * range.yLength();
    const xStep = 2.0 * range.xLength();
    y0 = 0.0;
    const closed = points[0].isAlmostEqual(points[points.length - 1]);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);

    x0 += xStep;
    for (const offsetDistance of distances) {
      y0 = 0.0;
      // unfiltered offset
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
      const stickA0 = context.constructPolygonWireXYOffset(points, closed, offsetDistance);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA0, x0, y0, 0);
      const stickB0 = context.constructPolygonWireXYOffset(points, closed, -offsetDistance);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickB0, x0, y0, 0);
      y0 += yStep;
      for (const factor of filterFactor) {
        const pointsA = PolylineOps.compressByChordError(points, factor * offsetDistance);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, points[0], factor * offsetDistance, x0, y0, 0.0);
        // overlay original, filter, and offset ...
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pointsA), x0, y0, 0);
        const stickA = context.constructPolygonWireXYOffset(pointsA, closed, offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA, x0, y0, 0);
        const stickB = context.constructPolygonWireXYOffset(pointsA, closed, -offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickB, x0, y0, 0);
        y0 += yStep;
      }
      x0 += xStep;
    }
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", caseName);
  expect(ck.getNumErrors()).toBe(0);
}

describe("PolygonOffset", () => {
  it("TestA", () => {
    // const yStep = 10.0;
    const rectangle0 = Sample.createRectangleXY(0, 0, 5, 6);
    const wPoints = [
      Point3d.create(0, 5),
      Point3d.create(2, 0),
      Point3d.create(3.0),
      Point3d.create(4, 5),
      Point3d.create(5, 5),
      Point3d.create(5.5, 0),
      Point3d.create(6, 0),
      Point3d.create(6.6, 1)];
    const star1 = Sample.createStar(1, 1, 0, 4, 3, 3, true);
    const star2 = Sample.createStar(1, 1, 0, 5, 2, 5, true);
    testPolygonOffset([rectangle0, star1, star2, wPoints], "TestA", [-0.5, 0.5, 1.0, -1.0, -2.0], 1.0);
  });

  it("TestSplitLine", () => {
    const allPoints = [];
    for (const upperCount of [2, 1, 2, 3, 8]) {
      const points = Sample.createInterpolatedPoints(
        Point3d.create(0, 1), Point3d.create(2, 3), upperCount, undefined, 0, upperCount,
      );
      allPoints.push(points);
    }
    testPolygonOffset(allPoints, "TestSplitLine", [-0.5, 0.5, 1.0, -1.0, -2.0], 1.0);
  });

  it("TestColinear", () => {
    const allPoints = [];
    for (const delta of [0, 0.01, 0.4]) {
      const points: Point3d[] = [];
      const corners = Sample.createRectangleXY(0, 0, 5, 6);
      corners[1].x += delta;
      corners[2].x += 0.2 * delta;
      corners[2].y += delta;
      corners[3].x -= delta * 2;
      Sample.createInterpolatedPoints(corners[0], corners[1], 3, points, 0, 2);
      Sample.createInterpolatedPoints(corners[1], corners[2], 3, points, 0, 2);
      Sample.createInterpolatedPoints(corners[2], corners[3], 4, points, 0, 3);
      Sample.createInterpolatedPoints(corners[3], corners[0], 3, points, 0, 3);
      allPoints.push(points);
    }
    testPolygonOffset(allPoints, "TestColinear", [-0.5, 0.5, 1.0, -1.0, -2.0], 1.0);
  });

  it("TestSpikes", () => {
    const points = [];
    const dxA = 2.0;
    const dxB = 0.5;
    const dyC = 1.0;
    const dyD = 0.1;
    let x = 0.0;
    points.push(Point3d.create(0, 0, 0));
    for (let i = 2; i < 7; i++) {
      points.push(Point3d.create(x += dxA, 0));
      points.push(Point3d.create(x += dxB, dyC * i));
      points.push(Point3d.create(x += dxB, dyD));
    }
    // A problem part of mild fractal
    const pointsA = [];
    pointsA.push(Point3d.create(1432.1250000000005, 4889.2499999999964, 0.0));
    pointsA.push(Point3d.create(433.8750, 4720.50, 0.0));
    pointsA.push(Point3d.create(-442.8750, 5226.750, 0.0));
    pointsA.push(Point3d.create(-1350.0, 5564.250, 0.0));
    pointsA.push(Point3d.create(-675.0, 3750.0, 0.0));
    pointsA.push(Point3d.create(337.50, 1996.50, 0.0));
    // pointsA.push(Point3d.create(0.0, 0.0, 0.0));

    for (const p of pointsA) {
      p.scaleInPlace(0.001);
    }

    const offsetDistances = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0, 2.5];
    //     const offsetDistances = [0.7];
    testPolygonOffset([pointsA, points], "SpikeRight", offsetDistances, -1);
    testPolygonOffset([pointsA, points], "SpikeLeft", offsetDistances, 1);
  });

  it("TestGouge", () => {
    const points = [];
    points.push(Point3d.create(0, 0, 0));
    points.push(Point3d.create(0, 1, 0));
    points.push(Point3d.create(2, 5, 0));
    points.push(Point3d.create(2.5, 5.0));
    points.push(Point3d.create(3, 1, 0));
    points.push(Point3d.create(3, -2, 0));
    const offsetDistances = [0.7];
    // testPolygonOffset([points], "SpikeOutside", offsetDistances, 1);
    testPolygonOffset([points], "TestGouge", offsetDistances, -1);

  });

  it("TestFractals", () => {
    const pointsA = Sample.createFractalLMildConcavePatter(2, 0.9);
    let r = Range3d.createArray(pointsA);
    let a = r.xLength() * 0.02;
    let offsetDistances = [2 * a, a, -a, -2 * a];
    testPolygonOffset([pointsA], "MildConcaveFractal", offsetDistances, 1.0);
    const pointsB = Sample.createFractalHatReversingPattern(2, 0.9);
    r = Range3d.createArray(pointsA);
    a = r.xLength() * 0.005;
    offsetDistances = [a, 2 * a, 4 * a];
    testPolygonOffset([pointsB], "FractalHatReverse", offsetDistances, 1);

    const filterFactors = [0.5, 1.0, 1.5, 2.0];
    testFilteredPolygonOffset([pointsA, pointsB], "FilteredFractals", offsetDistances, filterFactors);
  });
});

describe("RegionInOut", () => {
  it("EasyRectangleInOut", () => {
    const ck = new Checker();
    const range = Range2d.createXYXY(-2, 1, 4, 3);
    const rectangle = Sample.createRectangleInRange2d(range, 0, true);
    const loop = Loop.create(LineString3d.create(rectangle));
    const loopWithSegments = loop.cloneWithExpandedLineStrings() as Loop;
    for (const geometry of [loop, loopWithSegments]) {
      /** pure rectangle interior hits */
      for (const u of [-1, 0.5, 2]) {
        for (const v of [-0.4, 0.6, 3]) {
          const xy = range.fractionToPoint(u, v);
          ck.testBoolean(
            Geometry.isIn01(u) && Geometry.isIn01(v),
            RegionOps.testPointInOnOutRegionXY(geometry, xy.x, xy.y) > 0,
            { case: "SimpleInOut", uu: u, vv: v },
          );
        }
      }
      // rectangle edge hits
      // q01 is always on an extended edge
      for (const q01 of [0, 1]) {
        // qe is somewhere "along" the edge
        for (const qe of [-0.4, 0.0, 0.3, 1.0, 1.6]) {
          for (const uv of [Point2d.create(q01, qe), Point2d.create(qe, q01)]) {
            const xy = range.fractionToPoint(uv.x, uv.y);
            ck.testExactNumber(Geometry.isIn01(qe) ? 0 : -1,
              RegionOps.testPointInOnOutRegionXY(geometry, xy.x, xy.y), { case: "InOutEdge", uu: uv.x, vv: uv.y });
          }
        }
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CircleInOut", () => {
    const ck = new Checker();
    const arc0 = Arc3d.createXYEllipse(Point3d.create(0, 0, 0), 3, 2);
    const arc1 = arc0.cloneInRotatedBasis(Angle.createDegrees(15)); Loop;
    for (const arc of [arc0, arc1]) {
      for (const fraction of [0.0, 0.25, 0.4, 0.5, 0.88, 1.0]) {
        for (const radialFraction of [0.4, 1.0, 1.2]) {
          const xy = arc.fractionAndRadialFractionToPoint(fraction, radialFraction);
          const region = Loop.create(arc);
          const classify = RegionOps.testPointInOnOutRegionXY(region, xy.x, xy.y);
          const expectedClassify = Geometry.split3WaySign(radialFraction - 1.0, 1.0, 0.0, -1.0);
          if (
            !ck.testExactNumber(
              expectedClassify, classify, { arcInOut: arc, fractionAlong: fraction, fractionRadial: radialFraction },
            )
          )
            RegionOps.testPointInOnOutRegionXY(region, xy.x, xy.y);
        }
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("MixedInOut", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const unitZ = Vector3d.unitZ();
    const smallDistance = 0.001;
    const testPoint = Point3d.create();
    const testBasis = Plane3dByOriginAndVectors.createXYPlane();
    let x0 = 0.0;
    const y0 = 0.0;
    const z1 = 0.01;
    const errorVector = Vector3d.create(-1, 1, 0);
    const parityRegions = Sample.createSimpleParityRegions(true) as AnyRegion[];
    const unionRegions = Sample.createSimpleUnions() as AnyRegion[];
    for (const loop of parityRegions.concat(unionRegions)) {
      const range = loop.range();
      const primitives = loop.collectCurvePrimitives();
      // arbitrarily test various points on a line.
      const bigMarkerSize = 0.1;
      for (const fy of [0.4, 0.5, 0.6]) {
        for (const fx of [-0.05, 0.0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0, 1.05]) {
          range.fractionToPoint(fx, fy, 0, testPoint);
          const classify = RegionOps.testPointInOnOutRegionXY(loop, testPoint.x, testPoint.y);
          let marker = 0;
          if (classify < 0) marker = -4;
          if (classify > 0) marker = 4;
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, marker, testPoint, bigMarkerSize, x0, y0, z1);
        }
      }
      // We trust
      // 1) primitives have usual CCW outside, CW holes
      // 2) points close to primitives are in to left, out to right -- other primitives are not nearby
      // 3) frenet frame is well defined
      for (const cp of primitives) {
        for (const fraction of [0.359823, 0.5623112321]) {
          const basis = cp.fractionToPointAnd2Derivatives(fraction, testBasis);
          if (basis !== undefined) {
            basis.vectorU.normalizeInPlace();
            const perp = unitZ.crossProduct(basis.vectorU); // This should be an inward perpendicular !
            for (const q of [1, 0, -1]) {
              basis.origin.plusScaled(perp, q * smallDistance, testPoint);
              const classify = RegionOps.testPointInOnOutRegionXY(loop, testPoint.x, testPoint.y);
              ck.testExactNumber(q, classify, "InOut", { primitive: cp, f: fraction, point: testPoint });
              let marker = 0;
              if (q < 0) marker = -4;
              if (q > 0) marker = 4;
              GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, marker, testPoint, smallDistance, x0, y0, z1);
              if (q !== classify) {
                RegionOps.testPointInOnOutRegionXY(loop, testPoint.x, testPoint.y);
                GeometryCoreTestIO.captureGeometry(
                  allGeometry, LineSegment3d.create(testPoint, testPoint.plus(errorVector)), x0, y0,
                );
              }
            }
          }
        }
      }
      GeometryCoreTestIO.captureGeometry(allGeometry, loop, x0, y0);
      x0 += 20.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "MixedInOut");
    expect(ck.getNumErrors()).toBe(0);
  });

});

function curveLength(source: AnyCurve): number {
  if (source instanceof CurvePrimitive)
    return source.curveLength();
  if (source instanceof CurveCollection)
    return source.sumLengths();
  return 0.0;
}

class HasEllipticalArcProcessor extends RecursiveCurveProcessor {
  private _hasEllipticalArc: boolean;
  public constructor() { super(); this._hasEllipticalArc = false; }
  public override announceCurvePrimitive(data: CurvePrimitive, _indexInParent = -1): void {
    if (data instanceof Arc3d && !data.isCircular)
      this._hasEllipticalArc = true;
  }
  public claimResult(): boolean { return this._hasEllipticalArc; }
}

class HasStrokablePrimitiveProcessor extends RecursiveCurveProcessor {
  private _hasStrokablePrimitive: boolean;
  private _preserveEllipticalArcs: boolean;
  public constructor(preserveEllipticalArcs: boolean = false) {
    super();
    this._hasStrokablePrimitive = false;
    this._preserveEllipticalArcs = preserveEllipticalArcs;
  }
  public override announceCurvePrimitive(data: CurvePrimitive, _indexInParent = -1): void {
    if (
      data instanceof LineSegment3d || data instanceof LineString3d ||
      (data instanceof Arc3d && (data.isCircular || this._preserveEllipticalArcs))
    )
      return; // not strokable
    this._hasStrokablePrimitive = true;
  }
  public claimResult(): boolean {
    return this._hasStrokablePrimitive;
  }
}

// for best geometry capture, baseCurve should be centered at origin
function testOffsetSingle(
  ck: Checker, allGeometry: GeometryQuery[], delta: Point2d, baseCurve: Path | Loop, options: OffsetOptions,
): void {
  const offsetCurve = RegionOps.constructCurveXYOffset(baseCurve, options);
  if (ck.testDefined(offsetCurve, "Offset computed")) {
    // spot-check some curve-curve distances from baseCurve to offsetCurve
    if (!options.preserveEllipticalArcs) {
      const tolFactor = 1000 * (options.strokeOptions.hasAngleTol ? options.strokeOptions.angleTol!.degrees : 1);
      for (const cp of baseCurve.children) {
        for (let u = 0.0738; u < 1.0; u += 0.0467) {
          const basePt = cp.fractionToPoint(u);
          const offsetDetail = offsetCurve.closestPoint(basePt);
          if (ck.testDefined(offsetDetail, "Closest point to offset computed")) {
            let projectsToVertex = offsetDetail.fraction === 0 || offsetDetail.fraction === 1;
            if (!projectsToVertex && offsetDetail.curve instanceof LineString3d) {
              const scaledParam = offsetDetail.fraction * (offsetDetail.curve.numPoints() - 1);
              projectsToVertex = Geometry.isAlmostEqualNumber(scaledParam, Math.trunc(scaledParam));
              projectsToVertex = projectsToVertex ||
                Geometry.isAlmostEqualNumber(scaledParam, 1 + Math.trunc(scaledParam));  // e.g., true for scaledParam === 4.9999999
            }
            if (!projectsToVertex) {  // avoid measuring projections to linestring vertices as they usually exceed offset distance
              if (
                !ck.testCoordinateWithToleranceFactor(
                  offsetDetail.point.distance(basePt), Math.abs(options.leftOffsetDistance), tolFactor,
                )
              ) {
                GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, basePt, 0.05, delta.x, delta.y);
                GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, offsetDetail.point, 0.05, delta.x, delta.y);
              }
            }
          }
        }
      }
    }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetCurve, delta.x, delta.y);
  }
}

function testOffsetBothSides(
  ck: Checker, allGeometry: GeometryQuery[], delta: Point2d, baseCurve: Path | Loop, options: OffsetOptions,
): void {
  const rangeY = baseCurve.range().yLength();
  delta.y += rangeY;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, baseCurve, delta.x, delta.y);

  testOffsetSingle(ck, allGeometry, delta, baseCurve, options);   // offset on given offset
  options.leftOffsetDistance *= -1;
  testOffsetSingle(ck, allGeometry, delta, baseCurve, options);   // offset on other side
  options.leftOffsetDistance *= -1;  // undo

  delta.y += rangeY;
}

function testOffset(
  ck: Checker, allGeometry: GeometryQuery[], delta: Point2d, baseCurve: Path | Loop, options: OffsetOptions,
): void {
  testOffsetBothSides(ck, allGeometry, delta, baseCurve, options);
  // toggle ellipse preservation
  if (true) {
    const processor = new HasEllipticalArcProcessor();
    baseCurve.announceToCurveProcessor(processor);
    if (processor.claimResult()) {
      options.preserveEllipticalArcs = !options.preserveEllipticalArcs;
      testOffsetBothSides(ck, allGeometry, delta, baseCurve, options);
      options.preserveEllipticalArcs = !options.preserveEllipticalArcs; // undo
    }
  }
  // test tightened strokes
  if (
    options.strokeOptions.hasAngleTol ||
    options.strokeOptions.hasChordTol ||
    options.strokeOptions.hasMaxEdgeLength
  ) {
    const processor = new HasStrokablePrimitiveProcessor(options.preserveEllipticalArcs);
    baseCurve.announceToCurveProcessor(processor);
    if (processor.claimResult()) {
      const opts = options.clone();
      opts.preserveEllipticalArcs = false;
      opts.strokeOptions.angleTol?.setDegrees(opts.strokeOptions.angleTol?.degrees / 2);
      if (opts.strokeOptions.hasChordTol)
        opts.strokeOptions.chordTol! /= 2;
      if (opts.strokeOptions.hasMaxEdgeLength)
        opts.strokeOptions.maxEdgeLength! /= 2;
      testOffsetBothSides(ck, allGeometry, delta, baseCurve, opts);
    }
  }
  // test arc joins
  if (true) {
    const opts = options.clone();
    opts.jointOptions.minArcDegrees = opts.jointOptions.minArcDegrees > 0 ? 0 : 180;
    testOffsetBothSides(ck, allGeometry, delta, baseCurve, opts);
  }
}

function testOffsetWrapper(
  ck: Checker, allGeometry: GeometryQuery[], delta: Point2d, baseCurve: Path | Loop, options: OffsetOptions,
): void {
  const rangeX = options.leftOffsetDistance + baseCurve.range().xLength();
  delta.x += rangeX;
  testOffset(ck, allGeometry, delta, baseCurve, options);
  delta.x += rangeX;
  delta.y = 0;
}

describe("CloneSplitCurves", () => {
  it("PathSplits", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    let x0 = 0;
    const y0 = 0;
    const yStep = 5.0;
    const y1 = 0.1;
    const y2 = 0.5;
    const line010 = LineSegment3d.createCapture(Point3d.create(0, 0, 0), Point3d.create(10, 0, 0));
    const arc010 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(0, 0), Point3d.create(5, -y1), Point3d.create(10, 0),
    );
    // const line1 = LineSegment3d.createCapture(Point3d.create(1, -1, 0), Point3d.create(1, 1, 0));
    // const lineString234 = LineString3d.create([2, -1], [3, 1], [4, -1]);
    const arc5 = Arc3d.createXY(Point3d.create(5, 0, 0), 1);
    const linestring10 = LineString3d.create([10, 0], [11, y1], [10, y1]);
    // Assemble the cutters out of order to stress the sort logic.
    // const cutters = BagOfCurves.create(line1, arc5, lineString234);
    const cutters = BagOfCurves.create(arc5);
    const pathsToCut: AnyCurve[] = [
      line010,    // just a line
      arc010,     // just an arc
      LineString3d.create([0, 0], [10, 0], [10, y2], [0, y2]), // just a linestring
      Path.create(
        LineSegment3d.create(Point3d.create(0, y2), Point3d.create(0, 0)), line010.clone(),
      ),   // two lines that will rejoin in output
      Path.create(
        line010.clone(), LineSegment3d.create(line010.endPoint(), Point3d.create(0, y2)),
      ),   // two lines that will rejoin in output
      Path.create(
        line010.clone(),
        linestring10,
        Arc3d.createCircularStartMiddleEnd(linestring10.endPoint(), Point3d.create(5, y1), Point3d.create(0, 2 * y1)),
      ),
    ];
    for (const source of pathsToCut) {
      const cut = RegionOps.cloneCurvesWithXYSplits(source, cutters) as CurveCollection;
      ck.testCoordinate(cut.sumLengths(), curveLength(source), "split curve markup preserves length");

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [source, cutters], x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cut, x0, y0 + yStep);
      const splits = RegionOps.splitToPathsBetweenBreaks(cut, true);
      if (splits)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutters, x0, y0 + 2 * yStep);
      if (splits instanceof BagOfCurves)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, splits.children, x0, y0 + 2 * yStep);
      else
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, splits, x0, y0 + 2 * yStep);
      x0 += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "PathSplits");

    expect(ck.getNumErrors()).toBe(0);
  });

  it("ChainCollector", () => {
    const ck = new Checker();
    const chainCollector = new ChainCollectorContext(true);
    const segment1 = LineSegment3d.createXYZXYZ(1, 2, 3, 4, 2, 1);
    const segment2 = LineSegment3d.createXYZXYZ(4, 2, 1, 5, 2, 6);
    segment2.startCut = CurveLocationDetail.createCurveFractionPoint(segment1, 1, segment1.endPoint());
    ck.testUndefined(chainCollector.grabResult());
    chainCollector.announceCurvePrimitive(segment1);
    const singleton = chainCollector.grabResult();
    chainCollector.announceCurvePrimitive(segment1);
    chainCollector.announceCurvePrimitive(segment2);
    ck.testTrue(singleton instanceof LineSegment3d);

    expect(ck.getNumErrors()).toBe(0);
  });
  it("ChainCollectorBreaks", () => {
    const ck = new Checker();
    const pointA0 = Point3d.create(0, 0, 0);
    const pointB0 = Point3d.create(1, 0, 0);
    const pointB1 = Point3d.create(1, 0, 1);
    const pointC1 = Point3d.create(2, 0, 1);

    const segmentA0B0 = LineSegment3d.create(pointA0, pointB0);
    const segmentB0C1 = LineSegment3d.create(pointB0, pointC1);
    const segmentB1C1 = LineSegment3d.create(pointB1, pointC1);
    ck.testFalse(ChainCollectorContext.needBreakBetweenPrimitives(segmentA0B0, segmentB0C1), "A0B0..B0C1");
    ck.testTrue(ChainCollectorContext.needBreakBetweenPrimitives(undefined, segmentB0C1), "undefined..B0C1");
    ck.testTrue(ChainCollectorContext.needBreakBetweenPrimitives(segmentA0B0, undefined), "A0B0..undefined");
    ck.testTrue(ChainCollectorContext.needBreakBetweenPrimitives(segmentA0B0, segmentB1C1), "A0B0..B1C1");
    ck.testFalse(ChainCollectorContext.needBreakBetweenPrimitives(segmentA0B0, segmentB1C1, true), "A0B0..B0C1XY");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("GeneralChainA", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const segments = [
      LineSegment3d.create(
        Point3d.createFrom({ x: 22.213935902760078, y: 6.72335636194596, z: 0 }),
        Point3d.createFrom({ x: 19.126382295715867, y: 7.030119101735917, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 18.480825764734846, y: 3.237105594599584, z: 0 }),
        Point3d.createFrom({ x: 22.213935902760074, y: 6.72335636194596, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 16.68697627970194, y: 5.084431827079689, z: 0 }),
        Point3d.createFrom({ x: 18.48082576473485, y: 3.2371055945995857, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 13.954141275010276, y: 6.64077838793302, z: 0 }),
        Point3d.createFrom({ x: 16.68697627970194, y: 5.0844318270796895, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 15.253988532688888, y: 8.496059229639044, z: 0 }),
        Point3d.createFrom({ x: 13.954141275010276, y: 6.64077838793302, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 15.253988532688888, y: 8.496059229639043, z: 0 }),
        Point3d.createFrom({ x: 17.707917522590943, y: 9.036828096780024, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 19.126382295715864, y: 7.030119101735919, z: 0 }),
        Point3d.createFrom({ x: 17.70791752259094, y: 9.03682809678002, z: 0 })),
    ];
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, segments, 0, 0, 0);
    const collector = new ChainCollectorContext(false);
    for (const s of segments) {
      collector.announceCurvePrimitive(s, true);
    }
    const chains = collector.grabResult(true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chains, 20, 0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "GeneralChainA");

    expect(ck.getNumErrors()).toBe(0);

  });
  it("GeneralChainB", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const segments = [
      LineSegment3d.create(
        Point3d.createFrom({ x: 22.213935902760078, y: 6.72335636194596, z: 0 }),
        Point3d.createFrom({ x: 19.126382295715867, y: 7.030119101735917, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 18.480825764734846, y: 3.237105594599584, z: 0 }),
        Point3d.createFrom({ x: 22.213935902760074, y: 6.72335636194596, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 16.68697627970194, y: 5.084431827079689, z: 0 }),
        Point3d.createFrom({ x: 18.48082576473485, y: 3.2371055945995857, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 13.954141275010276, y: 6.64077838793302, z: 0 }),
        Point3d.createFrom({ x: 16.68697627970194, y: 5.0844318270796895, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 15.253988532688888, y: 8.496059229639044, z: 0 }),
        Point3d.createFrom({ x: 13.954141275010276, y: 6.64077838793302, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 17.707917522590943, y: 9.036828096780024, z: 0 }),
        Point3d.createFrom({ x: 15.253988532688888, y: 8.496059229639043, z: 0 })),
      LineSegment3d.create(
        Point3d.createFrom({ x: 19.126382295715864, y: 7.030119101735919, z: 0 }),
        Point3d.createFrom({ x: 17.70791752259094, y: 9.03682809678002, z: 0 })),
    ];
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, segments, 0, 0, 0);
    const collector = new ChainCollectorContext(false);
    for (const s of segments) {
      collector.announceCurvePrimitive(s, true);
    }
    const chains = collector.grabResult(true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chains, 20, 0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "GeneralChainB");

    expect(ck.getNumErrors()).toBe(0);
  });

  it("GeneralPathC", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const pathA = IModelJson.Reader.parse(diegoPathA);
    if (ck.testDefined(pathA, "Parsed geometry") && (pathA instanceof CurveChain || Array.isArray(pathA))) {
      const collector = new ChainCollectorContext(false);
      if (Array.isArray(pathA)) {
        for (const s of pathA) {
          collector.announceCurvePrimitive(s, true);
        }
      } else {
        for (const s of pathA.children) {
          collector.announceCurvePrimitive(s, true);
        }
      }
      const loopA = collector.grabResult(true);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, pathA, 0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopA, 0, 20);
      if (loopA instanceof Loop) {
        const loopAOffset = RegionOps.constructCurveXYOffset(loopA, 0.2);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopA, 0, 40);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopAOffset, 0, 40, -0.1);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "ChainAndOffset");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("OffsetCurves", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const delta = Point2d.createZero();
    const offsetDistance = 0.5;
    const options = new OffsetOptions(offsetDistance);

    // sample chains
    const inputs = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/offsetCurve.imjs", "utf8")),
    ) as CurveChain[];
    for (const chain of inputs)
      if (chain instanceof Path || chain instanceof Loop)
        testOffsetWrapper(ck, allGeometry, delta, chain, options);

    // Bezier splines
    const poles: Point3d[] = [
      Point3d.createZero(),
      Point3d.create(1, 1),
      Point3d.create(2, -1),
      Point3d.create(3, 2),
      Point3d.create(4, -2),
      Point3d.create(5, 3),
    ];
    const mirrorPoles: Point3d[] = [];
    poles.forEach((pt) => { mirrorPoles.push(Point3d.create(-pt.x, pt.y)); });
    mirrorPoles.reverse();
    const rotatedPoles: Point3d[] = [];
    mirrorPoles.forEach((pt) => { rotatedPoles.push(Point3d.create(pt.x, -pt.y)); });
    testOffsetWrapper(
      ck, allGeometry, delta, Path.create(BezierCurve3d.create(mirrorPoles)!, BezierCurve3d.create(poles)!), options,
    );
    testOffsetWrapper(
      ck, allGeometry, delta, Path.create(BezierCurve3d.create(rotatedPoles)!, BezierCurve3d.create(poles)!), options,
    );

    // unclamped splines
    const knots: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
    const curve = BSplineCurve3dH.create(poles, knots, 4)!;
    const mirrorCurve = BSplineCurve3dH.create(mirrorPoles, knots, 4)!;
    const rotatedCurve = BSplineCurve3dH.create(rotatedPoles, knots, 4)!;
    const scaleUp = Transform.createScaleAboutPoint(Point3d.createZero(), 5);
    curve.tryTransformInPlace(scaleUp);
    mirrorCurve.tryTransformInPlace(scaleUp);
    rotatedCurve.tryTransformInPlace(scaleUp);
    testOffsetWrapper(
      ck,
      allGeometry,
      delta,
      Path.create(mirrorCurve, LineSegment3d.create(mirrorCurve.endPoint(), curve.startPoint()), curve),
      options,
    );
    testOffsetWrapper(
      ck,
      allGeometry,
      delta,
      Path.create(rotatedCurve, LineSegment3d.create(rotatedCurve.endPoint(), curve.startPoint()), curve),
      options,
    );
    // save unclamped, clamped, control polygon, start point, end point
    GeometryCoreTestIO.saveGeometry(
      [
        curve, curve.clonePartialCurve(0, 1),
        LineString3d.create(curve.copyXYZFloat64Array(true)),
        Arc3d.createXY(curve.startPoint(), 0.5),
        Arc3d.createXY(curve.endPoint(), 0.5),
      ],
      "BSplineCurve",
      "Unclamped",
    );

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "OffsetCurves");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("InOutSplits", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    let x0 = 10;
    const y0 = 0;
    const yStep = 12;
    const xStep = 20;
    // Make a loop with multiple boundary curves . . .
    const segmentA = LineSegment3d.createXYXY(0, 0, 10, 0);
    const arcA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(10, 0), Point3d.create(12, 5, 0), Point3d.create(10, 10, 0),
    );
    const stringA = LineString3d.create([10, 10], [0, 10], [0, 0]);
    const loop = Loop.create(segmentA, arcA, stringA);

    const path0 = CurveFactory.createFilletsInLineString(
      [
        Point3d.create(1, 1),
        Point3d.create(5, 1),
        Point3d.create(8, 3),
        Point3d.create(13, 5),
        Point3d.create(12, 8),
        Point3d.create(5, 8),
      ],
      0.5,
    );

    const path1 = CurveFactory.createFilletsInLineString(
      [
        Point3d.create(1, 1),
        Point3d.create(5, 1),
        Point3d.create(14, 3),
        Point3d.create(14, 11),
        Point3d.create(5, 11),
        Point3d.create(-1, 1),
      ],
      3.5,
    );
    for (const path of [path0, path1]) {
      // output raw geometry
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);

      const splitParts = RegionOps.splitPathsByRegionInOnOutXY(path, loop);
      let yOut = y0;
      for (const outputArray of [splitParts.insideParts, splitParts.outsideParts]) {
        yOut += yStep;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, x0, yOut);
        for (const fragment of outputArray) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragment, x0, yOut);
        }
      }
      x0 += xStep;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "InOutSplits");

    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("RectangleRecognizer", () => {
  it("rectangleEdgeTransform", () => {
    const ck = new Checker();
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    for (const degrees of [0, 25.6]) {
      const points = Sample.createRegularPolygon(0, 0, 0, Angle.createDegrees(degrees), 2, 4, true);
      for (const requireClosure of [true, false]) {
        for (const data of [points,
          GrowableXYZArray.create(points),
          LineString3d.create(points),
          Path.create(LineString3d.create(points)),
          Loop.createPolygon(points),
          makeSticks(points)]) {
          const transform = RegionOps.rectangleEdgeTransform(data, requireClosure);
          ck.testDefined(transform);
          if (transform) {
            for (let i = 0; i < points.length; i++) {
              ck.testPoint3d(points[i], transform.multiplyXYZ(uv[i][0], uv[i][1]), `rectangle transform point ${i}`);
            }
          }
        }
      }
      ck.testUndefined(RegionOps.rectangleEdgeTransform(points.slice(0, 3), false), "short array should fail");
      const transform4 = RegionOps.rectangleEdgeTransform(points.slice(0, 4), false);
      const transform5 = RegionOps.rectangleEdgeTransform(points, true);
      if (ck.testDefined(transform4) && ck.testDefined(transform5))
        ck.testTransform(transform4, transform5);
      ck.testUndefined(RegionOps.rectangleEdgeTransform(points.slice(0, 3), false), "short array should fail");

      for (let i = 0; i < 4; i++) {
        const points1 = Point3dArray.clonePoint3dArray(points);
        points1[i].z += 0.01;
        ck.testUndefined(RegionOps.rectangleEdgeTransform(points1), `non planar should fail ${i}`);
        const points2 = Point3dArray.clonePoint3dArray(points);
        points2[i].x += 0.01;
        ck.testUndefined(RegionOps.rectangleEdgeTransform(points2), `skew should fail ${i}`);
      }
    }
    ck.testUndefined(RegionOps.rectangleEdgeTransform(LineSegment3d.createXYZXYZ(1, 2, 3, 4, 5, 2)));
    ck.testUndefined(RegionOps.rectangleEdgeTransform(Path.create(Arc3d.createUnitCircle())));
    ck.testUndefined(RegionOps.rectangleEdgeTransform(BagOfCurves.create()));
    expect(ck.getNumErrors()).toBe(0);
  });
  it("3PointTurnChecks", () => {
    // const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const road = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/data/intersections/WilsonShapes/roadShape.imjs", "utf8")));
    const badShape = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/data/intersections/WilsonShapes/3pointTurnShape_overlaps.imjs", "utf8")));
    const goodShape = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/data/intersections/WilsonShapes/3pointTurnShape_fits.imjs", "utf8")));

    if (road instanceof Loop) {
      const roadRange = road.range();

      let x0 = -roadRange.low.x;
      const xStep = 2.0 * roadRange.xLength();
      const yStep = 1.2 * roadRange.yLength();

      for (const shape of [badShape, goodShape]) {
        if (shape instanceof Loop) {
          let y0 = -roadRange.low.y;
          const splitParts = RegionOps.splitPathsByRegionInOnOutXY(shape, road);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, road, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, shape, x0, y0);
          const dz = 0.1;
          for (const outputArray of [splitParts.insideParts, splitParts.outsideParts]) {
            y0 += yStep;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, road, x0, y0);
            for (const fragment of outputArray) {
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragment, x0, y0, dz);
            }
          }
        }
        x0 += xStep;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "3PointTurnChecks");
  });

});

function makeSticks(points: Point3d[]): Path {
  const path = Path.create();
  for (let i = 0; i + 1 < points.length; i++) {
    path.tryAddChild(LineSegment3d.create(points[i], points[i + 1]));
  }
  return path;
}

describe("RegionOps2", () => {
  it("TriangulateSortedLoops", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x = 0;
    let y = 0;
    const testCases = [
      "./src/test/data/curve/arcGisLoops.imjs",
      "./src/test/data/curve/loopWithHole.imjs", // aka, split washer polygon
      "./src/test/data/curve/michelLoops.imjs",  // has a small island in a hole
      "./src/test/data/curve/michelLoops2.imjs", // 339 loops
    ];
    const options = new StrokeOptions();
    options.maximizeConvexFacets = true;
    for (const testCase of testCases) {
      const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(testCase, "utf8"))) as Loop[];
      if (ck.testDefined(inputs, "inputs successfully parsed")) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs, x, y);
        // generate a region from loops
        const region = RegionOps.sortOuterAndHoleLoopsXY(inputs);
        if (ck.testTrue(region.isClosedPath || region.children.length > 0, "region created")) {
          const range = region.range();
          const xDelta = 1.5 * range.xLength();
          const yDelta = 1.5 * range.yLength();
          x += xDelta;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x, y);
          // facet the region
          let builder = PolyfaceBuilder.create();
          builder.addGeometryQuery(region);
          let mesh = builder.claimPolyface();
          if (ck.testFalse(mesh.isEmpty, "triangulated mesh not empty")) {
            x += xDelta;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x, y);
            // verify triangulation with no degenerate triangles
            const visitor = mesh.createVisitor();
            for (; visitor.moveToNextFacet();) {
              ck.testExactNumber(3, visitor.numEdgesThisFacet, "facet is triangular");
              ck.testFalse(visitor.pointIndex[0] === visitor.pointIndex[1], "first two point indices are different");
              ck.testFalse(visitor.pointIndex[0] === visitor.pointIndex[2], "first and last point indices are different");
              ck.testFalse(visitor.pointIndex[1] === visitor.pointIndex[2], "last two point indices are different");
            }
          }
          // again, with maximal convex facets
          builder = PolyfaceBuilder.create(options);
          builder.addGeometryQuery(region);
          mesh = builder.claimPolyface();
          if (ck.testFalse(mesh.isEmpty, "maximal-facet mesh not empty")) {
            x += xDelta;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x, y);
            for (const visitor = mesh.createVisitor(); visitor.moveToNextFacet();) {
              if (!ck.testTrue(PolygonOps.isConvex(visitor.point), `facet is convex in ${testCase}`))
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, visitor.point, x, y, 400);
            }
          }
          y += yDelta;
        }
      }
      x = 0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps2", "TriangulateSortedLoops");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("MaximallyConvexFacets", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x = 0;
    const testCases: { filename: string, numTriangles: number, numFacets: number }[] = [
      { filename: "./src/test/data/curve/convexPentagon.imjs", numTriangles: 3, numFacets: 1 },
      { filename: "./src/test/data/curve/nonConvexPentagon.imjs", numTriangles: 3, numFacets: 2 },
      { filename: "./src/test/data/curve/adjacentQuads.imjs", numTriangles: 6, numFacets: 3 },
    ];
    const options = new StrokeOptions();
    options.maximizeConvexFacets = true;
    for (const testCase of testCases) {
      const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(testCase.filename, "utf8"))) as Loop[];
      if (ck.testDefined(inputs, "inputs successfully parsed")) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs, x);
        const region = RegionOps.sortOuterAndHoleLoopsXY(inputs);
        const area = RegionOps.computeXYArea(region)!;
        const range = region.range();
        const xDelta = 1.5 * range.xLength();
        x += xDelta;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x);
        // triangulate
        let builder = PolyfaceBuilder.create();
        builder.addGeometryQuery(region);
        let mesh = builder.claimPolyface();
        if (ck.testFalse(mesh.isEmpty, "triangulated mesh not empty")) {
          x += xDelta;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x);
          ck.testExactNumber(testCase.numTriangles, mesh.facetCount, "mesh has expected number of triangles");
        }
        // maximal convex facets
        builder = PolyfaceBuilder.create(options);
        builder.addGeometryQuery(region);
        mesh = builder.claimPolyface();
        if (ck.testFalse(mesh.isEmpty, "maximal-facet mesh not empty")) {
          x += xDelta;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x);
          ck.testExactNumber(testCase.numFacets, mesh.facetCount, "mesh has expected number of maximally convex facets");
        }
        // test polygon decomposition
        if (region instanceof Loop) {
          const convexPolygons = RegionOps.convexDecomposePolygonXY(region.getPackedStrokes()!, true);
          if (ck.testDefined(convexPolygons, "decomposition succeeded")) {
            ck.testExactNumber(testCase.numFacets, convexPolygons.length, "decomposition has expected number of polygons");
            const convexPolygonsPoint3dArrays = Point3dArray.cloneDeepXYZPoint3dArrays(convexPolygons);
            const polygonArea = PolygonOps.sumAreaXY(convexPolygonsPoint3dArrays);
            ck.testCoordinateWithToleranceFactor(area, polygonArea, range.maxAbs(), "region and decomposed areas are same");
            for (const convexPolygon of convexPolygons)
              ck.testTrue(PolygonOps.isConvex(convexPolygon), "decomposed polygon is convex");
          }
        }
      }
      x = 0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps2", "MaximallyConvexFacets");
    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("RegionOps.constructPolygonWireXYOffset", () => {
  it("constructPolygonWireXYOffsetWrapTrue", () => {
    const wrap: boolean = true;
    const allGeometry: GeometryQuery[] = [];
    const lineStrings: Point3d[][] = [
      [Point3d.create(-2, -1), Point3d.create(-2, 0), Point3d.create(-3, -1)],
      [Point3d.create(-1, -1), Point3d.create(-1, 0), Point3d.create(-1.5, 1)],
      [Point3d.create(1, -1), Point3d.create(1, 0), Point3d.create(1.5, 1)],
      [Point3d.create(2, -1), Point3d.create(2, 0), Point3d.create(3, -1)],
      [Point3d.create(-1, 2), Point3d.create(2, 2), Point3d.create(1, 3), Point3d.create(-2, 3), Point3d.create(-1, 2)],
      [
        Point3d.create(-1, -2), Point3d.create(1, -2), Point3d.create(0.1, -3), Point3d.create(1, -4),
        Point3d.create(-1, -4), Point3d.create(-0.1, -3), Point3d.create(-1, -2),
      ],
    ];
    const offsetDistances: number[] = [-0.3, -0.1, -0.05, 0.05, 0.1, 0.3];

    for (const lineString of lineStrings) {
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(lineString));
      for (const offsetDistance of offsetDistances) {
        const curveCollection = RegionOps.constructPolygonWireXYOffset(lineString, wrap, offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", "PolygonWireXYOffsetWrapTrue");
  });

  it("constructPolygonWireXYOffsetWrapFalse", () => {
    const wrap: boolean = false;
    const allGeometry: GeometryQuery[] = [];
    const lineStrings: Point3d[][] = [
      [Point3d.create(-2, -1), Point3d.create(-2, 0), Point3d.create(-3, -1)],
      [Point3d.create(-1, -1), Point3d.create(-1, 0), Point3d.create(-1.5, 1)],
      [Point3d.create(1, -1), Point3d.create(1, 0), Point3d.create(1.5, 1)],
      [Point3d.create(2, -1), Point3d.create(2, 0), Point3d.create(3, -1)],
      [Point3d.create(-1, 2), Point3d.create(2, 2), Point3d.create(1, 3), Point3d.create(-2, 3), Point3d.create(-1, 2)],
      [
        Point3d.create(-1, -2), Point3d.create(1, -2), Point3d.create(0.1, -3), Point3d.create(1, -4),
        Point3d.create(-1, -4), Point3d.create(-0.1, -3), Point3d.create(-1, -2),
      ],
    ];
    const offsetDistances: number[] = [-0.3, -0.1, -0.05, 0.05, 0.1, 0.3];

    for (const lineString of lineStrings) {
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(lineString));
      for (const offsetDistance of offsetDistances) {
        const curveCollection = RegionOps.constructPolygonWireXYOffset(lineString, wrap, offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", "PolygonWireXYOffsetWrapFalse");
  });

  it("PolygonWireXYOffsetCustomOption", () => {
    const wrap: boolean = true;
    const allGeometry: GeometryQuery[] = [];
    const lineStrings: Point3d[][] = [
      [Point3d.create(-2, -1), Point3d.create(-2, 0), Point3d.create(-3, -1)],
      [Point3d.create(-1, -1), Point3d.create(-1, 0), Point3d.create(-1.5, 1)],
      [Point3d.create(1, -1), Point3d.create(1, 0), Point3d.create(1.5, 1)],
      [Point3d.create(2, -1), Point3d.create(2, 0), Point3d.create(3, -1)],
      [Point3d.create(-1, 2), Point3d.create(2, 2), Point3d.create(1, 3), Point3d.create(-2, 3), Point3d.create(-1, 2)],
      [
        Point3d.create(-1, -2), Point3d.create(1, -2), Point3d.create(0.1, -3), Point3d.create(1, -4),
        Point3d.create(-1, -4), Point3d.create(-0.1, -3), Point3d.create(-1, -2),
      ],
    ];
    const offsetDistances: number[] = [-0.3, -0.1, -0.05, 0.05, 0.1, 0.3];
    const jointOptions: JointOptions[] = [];
    // no arcs, no chamfers, only sharp corners
    const minArcDegrees = 180;
    const maxChamferDegrees = 180;
    const preserveEllipticalArcs = false;
    const allowSharpestCorners = true;
    for (let i = 0; i < offsetDistances.length; i++) {
      jointOptions[i] = new JointOptions(
        offsetDistances[i], minArcDegrees, maxChamferDegrees, preserveEllipticalArcs, allowSharpestCorners,
      );
    }

    for (const lineString of lineStrings) {
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(lineString));
      for (const jointOption of jointOptions) {
        const curveCollection = RegionOps.constructPolygonWireXYOffset(lineString, wrap, jointOption);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", "PolygonWireXYOffsetCustomOption");
  });
});

describe("RegionOps.constructCurveXYOffset", () => {
  it("defaultOptions", () => {
    const allGeometry: GeometryQuery[] = [];
    const lineStrings: CurveChain[] = [
      Path.create([Point3d.create(-2, -1), Point3d.create(-2, 0), Point3d.create(-3, -1)]),
      Path.create([Point3d.create(-1, -1), Point3d.create(-1, 0), Point3d.create(-1.5, 1)]),
      Path.create([Point3d.create(1, -1), Point3d.create(1, 0), Point3d.create(1.5, 1)]),
      Path.create([Point3d.create(2, -1), Point3d.create(2, 0), Point3d.create(3, -1)]),
      Path.create([
        Point3d.create(-1, 2), Point3d.create(2, 2), Point3d.create(1, 3), Point3d.create(-2, 3), Point3d.create(-1, 2),
      ]),
      Loop.create(
        LineString3d.create([
          Point3d.create(-1, 4), Point3d.create(2, 4), Point3d.create(1, 5), Point3d.create(-2, 5), Point3d.create(-1, 4),
        ]),
      ),
      Path.create([
        Point3d.create(-1, -2), Point3d.create(1, -2), Point3d.create(0.1, -3), Point3d.create(1, -4),
        Point3d.create(-1, -4), Point3d.create(-0.1, -3), Point3d.create(-1, -2),
      ]),
    ];
    const offsetDistances: number[] = [-0.3, -0.1, -0.05, 0.05, 0.1, 0.3];

    for (const lineString of lineStrings) {
      GeometryCoreTestIO.captureGeometry(allGeometry, lineString);
      for (const offsetDistance of offsetDistances) {
        const curveCollection = RegionOps.constructCurveXYOffset(lineString as Path | Loop, offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps.constructCurveXYOffset", "defaultOptions");
  });

  it("customOptions", () => {
    const allGeometry: GeometryQuery[] = [];
    const lineStrings: CurveChain[] = [
      Path.create([Point3d.create(-2, -1), Point3d.create(-2, 0), Point3d.create(-3, -1)]),
      Path.create([Point3d.create(-1, -1), Point3d.create(-1, 0), Point3d.create(-1.5, 1)]),
      Path.create([Point3d.create(1, -1), Point3d.create(1, 0), Point3d.create(1.5, 1)]),
      Path.create([Point3d.create(2, -1), Point3d.create(2, 0), Point3d.create(3, -1)]),
      Path.create([
        Point3d.create(-1, 2), Point3d.create(2, 2), Point3d.create(1, 3), Point3d.create(-2, 3), Point3d.create(-1, 2),
      ]),
      Loop.create(
        LineString3d.create([
          Point3d.create(-1, 4), Point3d.create(2, 4), Point3d.create(1, 5), Point3d.create(-2, 5), Point3d.create(-1, 4),
        ]),
      ),
      Path.create([
        Point3d.create(-1, -2), Point3d.create(1, -2), Point3d.create(0.1, -3), Point3d.create(1, -4),
        Point3d.create(-1, -4), Point3d.create(-0.1, -3), Point3d.create(-1, -2),
      ]),
    ];
    const offsetDistances: number[] = [-0.3, -0.1, -0.05, 0.05, 0.1, 0.3];
    const jointOptions: JointOptions[] = [];
    const minArcDegrees = 100;
    const maxChamferDegrees = 50;
    for (let i = 0; i < offsetDistances.length; i++) {
      jointOptions[i] = new JointOptions(offsetDistances[i], minArcDegrees, maxChamferDegrees);
    }

    for (const lineString of lineStrings) {
      GeometryCoreTestIO.captureGeometry(allGeometry, lineString);
      for (const jointOption of jointOptions) {
        const curveCollection = RegionOps.constructCurveXYOffset(lineString as Path | Loop, jointOption);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps.constructCurveXYOffset", "customOptions");
  });

  it("preserveEllipticalArcsTrue", () => {
    const allGeometry: GeometryQuery[] = [];
    const origin = Point3d.create(0, 0, 0);
    const vector0 = Vector3d.create(5, 0, 0);
    const vector90 = Vector3d.create(0, 2, 0);
    const loop = Loop.create(
      Arc3d.create(origin, vector0, vector90, AngleSweep.createStartEndDegrees(-180, 180)),
    );
    const offsetDistances: number[] = [-5, -3, -1, 1, 3, 5];
    const jointOptions: JointOptions[] = [];
    const minArcDegrees = 180;
    const maxChamferDegrees = 90;
    const preserveEllipticalArcs = true;
    for (let i = 0; i < offsetDistances.length; i++) {
      jointOptions[i] = new JointOptions(offsetDistances[i], minArcDegrees, maxChamferDegrees, preserveEllipticalArcs);
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, loop);
    for (const jointOption of jointOptions) {
      const curveCollection = RegionOps.constructCurveXYOffset(loop, jointOption);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps.constructCurveXYOffset", "preserveEllipticalArcsTrue");
  });

  it("preserveEllipticalArcsFalse", () => {
    const allGeometry: GeometryQuery[] = [];
    const origin = Point3d.create(0, 0, 0);
    const vector0 = Vector3d.create(5, 0, 0);
    const vector90 = Vector3d.create(0, 2, 0);
    const loop = Loop.create(
      Arc3d.create(origin, vector0, vector90, AngleSweep.createStartEndDegrees(-180, 180)),
    );
    const offsetDistances: number[] = [-5, -3, -1, 1, 3, 5];
    const jointOptions: JointOptions[] = [];
    const minArcDegrees = 180;
    const maxChamferDegrees = 90;
    const preserveEllipticalArcs = false;
    for (let i = 0; i < offsetDistances.length; i++) {
      jointOptions[i] = new JointOptions(offsetDistances[i], minArcDegrees, maxChamferDegrees, preserveEllipticalArcs);
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, loop);
    for (const jointOption of jointOptions) {
      const curveCollection = RegionOps.constructCurveXYOffset(loop, jointOption);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps.constructCurveXYOffset", "preserveEllipticalArcsFalse");
  });

  it("maxChamferDegree", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const origin = Point3d.create(0, 0, 0);
    const circleSize: number = 4;
    const loop = Loop.create(
      Arc3d.createXY(origin, circleSize, AngleSweep.createStartEndDegrees(0, 180)),
      LineString3d.create([Point3d.create(-circleSize, 0), Point3d.create(circleSize, 0)]),
    );
    let dx = 0;
    const offsetDistance = -2;
    const minArcDegree = 180;
    const maxChamferDegrees: number[] = [89, 90, 91];
    const preserveEllipticalArc = false;
    const expectedNumPoints0: number[] = [4, 3, 3];
    const expectedNumPoints1: number[] = [4, 3, 3];
    for (let i = 0; i <= 2; i++) {
      const jointOption = new JointOptions(offsetDistance, minArcDegree, maxChamferDegrees[i], preserveEllipticalArc);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx);
      const curveCollection = RegionOps.constructCurveXYOffset(loop, jointOption)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, curveCollection, dx);
      const lineString0 = curveCollection.getChild(0) as LineString3d;
      const lineString1 = curveCollection.getChild(2) as LineString3d;
      ck.testCoordinate(lineString0.numPoints(), expectedNumPoints0[i], "Number of points in offset first child");
      ck.testCoordinate(lineString1.numPoints(), expectedNumPoints1[i], "Number of points in offset last child");
      dx += 15;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps.constructCurveXYOffset", "maxChamferDegree");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("swallowsSegmentAtSeam", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const jointOptions = new JointOptions(-0.3109, 180, 360, true, true);
    const loop = Loop.create(
      LineString3d.create([[93089.5657959348, 272528.15824223746, 0], [93100.03808225933, 272531.43445330666, 0], [93101.22876909783, 272527.6284672965, 0]]),
      Arc3d.create(Point3d.create(93099.77428488612, 272527.17343798134, 0), Vector3d.create(1.488251776014865, 0.32815034802058346, 0), Vector3d.create(0.3281503480205824, -1.4882517760148655, 0), AngleSweep.fromJSON([-4.937670015113557, 4.937670015113557])),
      LineString3d.create([93101.28525819005, 272527.3722737793, 0]), // singleton line strings may be problematic elsewhere, but not for offset
      Arc3d.create(Point3d.create(93099.77428488623, 272527.17343798134, 0), Vector3d.create(1.5226584933015492, 0.06393052644921698, 0), Vector3d.create(0.06393052644921829, -1.522658493301549, 0), AngleSweep.fromJSON([-5.092518821342509, 5.092518821342509])),
      LineString3d.create([93101.29660767947, 272527.1019585258, 0]),
      Arc3d.create(Point3d.create(93099.77428488602, 272527.1734379813, 0), Vector3d.create(1.510520957673389, -0.20224350780197875, 0), Vector3d.create(-0.20224350780197886, -1.5105209576733885, 0), AngleSweep.fromJSON([-4.937670013019398, 4.937670013019398])),
      LineString3d.create([93101.2617926862, 272526.841931504, 0]),
      Arc3d.create(Point3d.create(93099.77428488611, 272527.1734379812, 0), Vector3d.create(1.4168797543015519, -0.561273339465388, 0), Vector3d.create(-0.5612733394653889, -1.4168797543015517, 0), AngleSweep.fromJSON([-9.04652736096125, 9.04652736096125])),
      LineString3d.create([93101.08528740756, 272526.39636115846, 0]),
      Arc3d.create(Point3d.create(93099.77428488612, 272527.1734379812, 0), Vector3d.create(1.1534997964345772, -0.9959991060709421, 0), Vector3d.create(-0.9959991060709413, -1.1534997964345777, 0), AngleSweep.fromJSON([-10.152545440293755, 10.152545440293755])),
      LineString3d.create([93100.73415881662, 272525.9897074218, 0]),
      Arc3d.create(Point3d.create(93099.77428488611, 272527.1734379812, 0), Vector3d.create(0.7618084247839977, -1.319933302722175, 0), Vector3d.create(-1.3199333027221751, -0.7618084247839976, 0), AngleSweep.fromJSON([-9.046527362119292, 9.046527362119292])),
      LineString3d.create([93100.31907550692, 272525.7501392848, 0]),
      Arc3d.create(Point3d.create(93099.77428488618, 272527.1734379807, 0), Vector3d.create(0.4202627410270718, -1.4649079242989695, 0), Vector3d.create(-1.4649079242989695, -0.420262741027071, 0), AngleSweep.fromJSON([-4.937670014773152, 4.937670014773152])),
      LineString3d.create([93100.06690049211, 272525.67779360275, 0]),
      Arc3d.create(Point3d.create(93099.7742848862, 272527.1734379802, 0), Vector3d.create(0.15870081460091126, -1.5157143688814274, 0), Vector3d.create(-1.5157143688814272, -0.15870081460091198, 0), AngleSweep.fromJSON([-5.092518816611678, 5.092518816611678])),
      LineString3d.create([93099.79781801868, 272525.64961968776, 0]),
      Arc3d.create(Point3d.create(93099.77428488608, 272527.1734379793, 0), Vector3d.create(-0.10771223944506644, -1.5201888262126835, 0), Vector3d.create(-1.5201888262126835, 0.1077122394450671, 0), AngleSweep.fromJSON([-4.937670017137359, 4.937670017137359])),
      LineString3d.create([[93099.53612673173, 272525.6681616965, 0], [93090.80016320662, 272527.050327199, 0]]),
      Arc3d.create(Point3d.create(93091.03832136128, 272528.55560348375, 0), Vector3d.create(-0.4976031275002508, -1.4404746188394117, 0), Vector3d.create(-1.440474618839412, 0.49760312750025065, 0), AngleSweep.fromJSON([-10.066596761922968, 10.066596761922968])),
      LineString3d.create([93090.29659421161, 272527.22428202163, 0]),
      Arc3d.create(Point3d.create(93091.03832136106, 272528.5556034833, 0), Vector3d.create(-0.8299089173113726, -1.278212497007433, 0), Vector3d.create(-1.2782124970074327, 0.8299089173113732, 0), AngleSweep.fromJSON([-3.870822439014021, 3.870822439014021])),
      LineString3d.create([93090.12401707575, 272527.33633170376, 0]),
      Arc3d.create(Point3d.create(93091.03832136084, 272528.55560348294, 0), Vector3d.create(-0.9959991057076077, -1.1534997957220827, 0), Vector3d.create(-1.153499795722083, 0.9959991057076072, 0), AngleSweep.fromJSON([-3.9438437437170264, 3.9438437437170264])),
      LineString3d.create([93089.9653446053, 272527.47333878366, 0]),
      Arc3d.create(Point3d.create(93091.03832136112, 272528.55560348375, 0), Vector3d.create(-1.1435897437288622, -1.00736214820259, 0), Vector3d.create(-1.00736214820259, 1.1435897437288622, 0), AngleSweep.fromJSON([-3.87082243002207, 3.87082243002207])),
      LineString3d.create([93089.82933617584, 272527.6277399047, 0]),
      Arc3d.create(Point3d.create(93091.03832136087, 272528.55560348363, 0), Vector3d.create(-1.3525569735883416, -0.702257525417748, 0), Vector3d.create(-0.7022575254177474, 1.3525569735883416, 0), AngleSweep.fromJSON([-10.066596764821469, 10.066596764821469])),
      LineString3d.create([[93089.58383714946, 272528.1005741686, 0], [93089.5657959348, 272528.15824223746, 0]]), // this last segment should be absent in the offset
    );
    const loopForDisplay = Loop.create(...loop.children.filter((c) => c.quickLength() > Geometry.smallFloatingPoint));  // can't import singleton linestrings in DGN!
    GeometryCoreTestIO.captureGeometry(allGeometry, loopForDisplay);
    const offset = RegionOps.constructCurveXYOffset(loop, jointOptions);
    GeometryCoreTestIO.captureGeometry(allGeometry, offset);
    if (ck.testDefined(offset, "RegionOps.constructCurveXYOffset succeeded")) {
      if (ck.testType(offset, Loop, "RegionOps.constructCurveXYOffset returned a Loop")) {
        ck.testExactNumber(offset.children.length, 4, "RegionOps.constructCurveXYOffset returned a Loop with 4 children");
        const area = RegionOps.computeXYArea(offset);
        if (ck.testDefined(area, "RegionOps.computeXYArea succeeded")) {
          ck.testCoordinate(-30.77708229, area, "RegionOps.constructCurveXYOffset returned a Loop with expected area");
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps.constructCurveXYOffset", "swallowsSegmentAtSeam");
    expect(ck.getNumErrors()).toBe(0);
  });
});


