/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";

import { Sample } from "../../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";

import { RegionOps } from "../../curve/RegionOps";
import { Point3d } from "../../geometry3d/Point3dVector3d";

import { Range3d } from "../../geometry3d/Range";
import { PolygonWireOffsetContext } from "../../curve/PolygonOffsetContext";
import { PolylineOps } from "../../geometry3d/PolylineOps";
import { HalfEdgeGraph } from "../../topology/Graph";
import { GraphChecker } from "./Graph.test";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Angle } from "../../geometry3d/Angle";
import { prettyPrint } from "../testFunctions";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";

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

          if (!this.ck.testExactNumber(2, euler, boolOp + "Expected euler characteristic " + name)) {
            console.log("outerRectangle" + prettyPrint(boundary0));
            console.log("innerRectangle" + prettyPrint(boundary1));
            GraphChecker.dumpGraph(graph);
          }
        }

      });
    range.extendArray(boundary1);
    const yStep = 2.0 * range.yLength();
    this.y0 = 0.0;
    GeometryCoreTestIO.captureGeometry(this.allGeometry, LineString3d.create(boundary0), this.x0, this.y0);
    GeometryCoreTestIO.captureGeometry(this.allGeometry, LineString3d.create(boundary1), this.x0, this.y0);
    this.y0 += yStep; dx1 = 0.0;
    boolOp = "Union";
    let unionArea;
    let differenceAreaBOnly;
    let differenceAreaAOnly;
    let intersectionArea;
    const unionRegion = RegionOps.polygonXYAreaUnionLoopsToPolyface(boundary0, boundary1);
    if (this.ck.testPointer(unionRegion) && unionRegion) {
      unionArea = PolyfaceQuery.sumFacetAreas(unionRegion);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, unionRegion, this.x0, this.y0);
    }
    this.y0 += yStep; dx1 = 0.0;

    boolOp = "Intersection";
    const intersectionRegion = RegionOps.polygonXYAreaIntersectLoopsToPolyface(boundary0, boundary1);
    if (this.ck.testPointer(intersectionRegion) && intersectionRegion) {
      intersectionArea = PolyfaceQuery.sumFacetAreas(intersectionRegion);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, intersectionRegion, this.x0, this.y0);
    }
    this.y0 += yStep; dx1 = 0.0;

    boolOp = "Difference";
    const differenceRegionAOnly = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(boundary0, boundary1);
    if (this.ck.testPointer(differenceRegionAOnly) && differenceRegionAOnly) {
      differenceAreaAOnly = PolyfaceQuery.sumFacetAreas(differenceRegionAOnly);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, differenceRegionAOnly, this.x0, this.y0);
    }
    this.y0 += yStep; dx1 = 0.0;

    boolOp = "Difference";
    const differenceRegionBOnly = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(boundary1, boundary0);
    if (this.ck.testPointer(differenceRegionBOnly) && differenceRegionBOnly) {
      differenceAreaBOnly = PolyfaceQuery.sumFacetAreas(differenceRegionBOnly);
      GeometryCoreTestIO.captureGeometry(this.allGeometry, differenceRegionBOnly, this.x0, this.y0);
    }

    if (unionArea !== undefined && intersectionArea !== undefined && differenceAreaAOnly !== undefined && differenceAreaBOnly !== undefined) {
      this.ck.testCoordinate(unionArea, differenceAreaAOnly + differenceAreaBOnly + intersectionArea);
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
    expect(context.getNumErrors()).equals(0);
  });

  it.skip("BooleanFractalAB", () => {
    // EDL July 15 2019 This triggers euler problem
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const fractalA = Sample.createFractalLMildConcavePatter(2, 1.0);
    const fractalB = Sample.createFractalHatReversingPattern(1, 0.7);
    context.testBooleans(fractalA, fractalB);
    context.saveAndReset("RegionOps", "BooleanFractalAB");
    expect(context.getNumErrors()).equals(0);
  });

  it.skip("BooleanFractalABRotated", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const fractalA = Sample.createFractalLMildConcavePatter(2, 1.0);
    const fractalB = Sample.createFractalHatReversingPattern(1, 0.7);
    const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(0.123213213218937891722)));
    const fractalA1 = transform.multiplyInversePoint3dArray(fractalA)!;
    const fractalB1 = transform.multiplyInversePoint3dArray(fractalB)!;
    context.testBooleans(fractalA1, fractalB1);
    context.saveAndReset("RegionOps", "BooleanFractalABRotated");
    expect(context.getNumErrors()).equals(0);
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
    expect(context.getNumErrors()).equals(0);
  });

  it("CleanupSawTooth", () => {
    const context = new PolygonBooleanTests();
    context.setDebugControls(10, 1);
    const ax = 1.0;
    const ay = 0.0;
    const bx = 10.0;
    const by = 5.0;
    // create the rectangle as Point2d to exercise Point3dArray.streamXYZ and Point3dArray.streamXYZXYZ
    const rectangle = [Point2d.create(ax, ay), Point2d.create(bx, ay), Point2d.create(bx, by), Point2d.create(ax, by), Point2d.create(ax, ay)];
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
      const range = Range3d.createFromVariantData (data);
      const dx = range.xLength() * 2.0;
      const dy = range.yLength() * 2.0;
      y0 = 0.0;
      const graph = HalfEdgeGraphMerge.formGraphFromChains(data, true)!;
      GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0);
      y0 += dy;
      const polyface = PolyfaceBuilder.graphToPolyface(graph!);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "CleanupSawTooth");
    expect(context.getNumErrors()).equals(0);
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
    expect(context.getNumErrors()).equals(0);
  });

});
/**
 * Exercise PolygonWireOffset and output to a file.
 * @param polygons polygons to offset
 * @param caseName name to use for output file
 * @param distances offset distances
 * @param distanceFactor factor to apply to distances.
 */
function testPolygonOffset(polygons: Point3d[][],
  caseName: string,
  distances: number[],
  distanceFactor: number) {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0;
  let y0 = 0;

  const context = new PolygonWireOffsetContext();
  for (const points of polygons) {
    const range = Range3d.createArray(points);
    const yStep = 2.0 * range.yLength();
    y0 = 0.0;
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
    y0 += yStep;
    for (const closed of [false, true]) {
      if (closed && !points[0].isAlmostEqualMetric(points[points.length - 1]))
        continue;
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
      for (const offsetDistance of distances) {
        const stickA = context.constructPolygonWireXYOffset(points, closed, offsetDistance * distanceFactor);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA!, x0, y0, 0);
      }
      y0 += yStep;
    }
    x0 += yStep;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", caseName);
  expect(ck.getNumErrors()).equals(0);
}

/**
 * Exercise PolygonWireOffset and output to a file.
 * @param polygons polygons to offset
 * @param caseName name to use for output file
 * @param distances offset distances
 * @param distanceFactor factor to apply to distances.
 */
function testFilteredPolygonOffset(polygons: Point3d[][],
  caseName: string,
  distances: number[],
  filterFactor: number[]) {
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
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA0!, x0, y0, 0);
      const stickB0 = context.constructPolygonWireXYOffset(points, closed, -offsetDistance);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickB0!, x0, y0, 0);
      y0 += yStep;
      for (const factor of filterFactor) {
        const pointsA = PolylineOps.compressByChordError(points, factor * offsetDistance);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, points[0], factor * offsetDistance, x0, y0, 0.0);
        // overlay original, filter, and offset ...
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pointsA), x0, y0, 0);
        const stickA = context.constructPolygonWireXYOffset(pointsA, closed, offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA!, x0, y0, 0);
        const stickB = context.constructPolygonWireXYOffset(pointsA, closed, -offsetDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickB!, x0, y0, 0);
        y0 += yStep;
      }
      x0 += xStep;
    }
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", caseName);
  expect(ck.getNumErrors()).equals(0);
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
    testPolygonOffset([pointsA, points], "SpikeInside", offsetDistances, -1);
    testPolygonOffset([pointsA, points], "SpikeOutside", offsetDistances, 1);
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
    testFilteredPolygonOffset([pointsA, pointsB], "filteredFractals", offsetDistances, filterFactors);

  });

});
