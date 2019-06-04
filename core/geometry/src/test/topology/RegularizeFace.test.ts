/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";
import { HalfEdgeGraph, HalfEdge } from "../../topology/Graph";

import { Sample } from "../../serialization/GeometrySamples";
import { RegularizationContext } from "../../topology/RegularizeFace";
import { Triangulator } from "../../topology/Triangulation";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineString3d } from "../../curve/LineString3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point3dArray } from "../../geometry3d/PointHelpers";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Angle } from "../../geometry3d/Angle";
import { HalfEdgeGraphOps } from "../../topology/Merging";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Range3d } from "../../geometry3d/Range";
import { Geometry } from "../../Geometry";

/** Treat each xy as (r, radians) */
function mapThetaR(points: Point3d[], scaleX: number, scaleY: number): Point3d[] {
  const outPoints = [];
  for (const rTheta of points) {
    const r = rTheta.y;
    const radians = rTheta.x;
    const z = rTheta.z;
    outPoints.push(Point3d.create(scaleX * r * Math.cos(radians), scaleY * r * Math.sin(radians), z));
  }
  return outPoints;
}

/** Treat each xy as (r + pitch * radians/2PI, radians) */
function mapThetaRWithPitch(points: Point3d[], scaleX: number, scaleY: number, pitch: number): Point3d[] {
  const outPoints = [];
  for (const rTheta of points) {
    const radians = rTheta.x;
    const r = rTheta.y + radians * pitch / (2 * Math.PI);
    const z = rTheta.z;
    outPoints.push(Point3d.create(scaleX * r * Math.cos(radians), scaleY * r * Math.sin(radians), z));
  }
  return outPoints;
}

class VerticalStaggerData {
  public points: Point3d[];
  public numUpEdge: number;
  public numDownEdge: number;
  public numTopPeaks: number;
  public numBottomPeaks: number;
  public numUpChain: number;
  public numDownChain: number;
  constructor(points: Point3d[],
    numUpEdge: number,
    numDownEdge: number,
    numTopPeaks: number,
    numBottomPeaks: number,
    numUpChain: number,
    numDownChain: number) {
    this.points = points;
    this.numUpEdge = numUpEdge;
    this.numDownEdge = numDownEdge;
    this.numTopPeaks = numTopPeaks;
    this.numBottomPeaks = numBottomPeaks;
    this.numUpChain = numUpChain;
    this.numDownChain = numDownChain;
  }
  public validateCounts(ck: Checker, context: RegularizationContext) {
    ck.testExactNumber(this.numUpEdge, context.upEdges.length, "up edge");
    ck.testExactNumber(this.numDownEdge, context.downEdges.length, "down edge");
    ck.testExactNumber(this.numUpChain, context.localMin.length, "up chain");
    ck.testExactNumber(this.numDownChain, context.localMax.length, "down chain");
    ck.testExactNumber(this.numTopPeaks, context.topPeaks.length, "top peaks");
    ck.testExactNumber(this.numBottomPeaks, context.bottomPeaks.length, "bottom peaks");
  }
}
describe("Regularize", () => {
  it("CountUpAndDown", () => {
    const ck = new Checker();
    const ax = 6;
    const ay = 10;
    for (const data of [
      new VerticalStaggerData(Sample.creatVerticalStaggerPolygon(-1, -2, -2, - 1, ax, ay, 0, 0),
        3, 3, 0, 0, 1, 1),
      new VerticalStaggerData(Sample.creatVerticalStaggerPolygon(-1, 0, -2, - 1, ax, ay, 0, 0),
        4, 2, 0, 0, 1, 1),
      new VerticalStaggerData(Sample.creatVerticalStaggerPolygon(1, 0, -2, - 1, ax, ay, 0, 0),
        4, 2, 1, 0, 2, 1),
      new VerticalStaggerData(Sample.creatVerticalStaggerPolygon(1, 0, 2, - 1, ax, ay, 0, 0),
        3, 3, 1, 1, 2, 2),
      new VerticalStaggerData(Sample.creatVerticalStaggerPolygon(1, 0, 0, 1, ax, ay, 0, 0),
        3, 3, 1, 0, 2, 1)]) {
      const graph = new HalfEdgeGraph();
      const seed = Triangulator.createFaceLoopFromCoordinates(graph, data.points, true, false);
      const context = new RegularizationContext(graph);
      context.collectVerticalEventsAroundFace(seed!);
      data.validateCounts(ck, context);

    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("RegularizeA", () => {
    const ck = new Checker();
    const ax = 6;
    const ay = 10;
    let outputX0 = 0;
    let outputY0 = 0;
    const outputStepX = 30.0;
    const outputStepY = 15.0;
    const allGeometry: GeometryQuery[] = [];
    for (const maxEdgeLength of [4.0, 2.0, 1.2, 20.0]) {
      for (const basePoints of [
        Sample.creatVerticalStaggerPolygon(1, 0, 0, -2, ax, ay, 0, 0),
        Sample.creatVerticalStaggerPolygon(-1, -2, -2, - 1, ax, ay, 0, 0),
        Sample.creatVerticalStaggerPolygon(-1, -2, 0, - 1, ax, ay, 0, 0),
        Sample.creatVerticalStaggerPolygon(-1, -2, 0, -3, ax, ay, 0, 0),
        Sample.creatVerticalStaggerPolygon(1, 0, 0, -2, ax, ay, 0, 0)]) {
        const points = Point3dArray.cloneWithMaxEdgeLength(basePoints, maxEdgeLength);
        const graph = new HalfEdgeGraph();
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), outputX0, outputY0 += outputStepY);
        const seed = Triangulator.createFaceLoopFromCoordinates(graph, points, true, false)!;
        const context = new RegularizationContext(graph);
        context.regularizeFace(seed);
        const mesh = PolyfaceBuilder.graphToPolyface(graph);
        GeometryCoreTestIO.captureGeometry(allGeometry, mesh, outputX0, outputY0 += outputStepY);
        outputX0 += outputStepX;
        outputY0 = 0.0;
      }
      outputX0 += outputStepX;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "RegularizeA");
    expect(ck.getNumErrors()).equals(0);
  });
  it("RegularizeB", () => {
    const ck = new Checker();

    let outputX0 = 0;
    let outputY0 = 0;
    const outputStepX = 30.0;
    const outputStepY = 15.0;
    const bigStepY = 100.0;
    let outputY1 = 0.0;
    const transform = Transform.createFixedPointAndMatrix(Point3d.create(2, 0, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(145)));
    const allGeometry: GeometryQuery[] = [];
    for (const numPhase of [2, 4]) {
      for (const maxEdgeLength of [4.0, 2.0, 1.2, 20.0]) {
        for (const basePoints of [
          Sample.createSquareWave(Point3d.create(0, 0, 0), 1, 0.5, 2, numPhase, 1)]) {
          const points = Point3dArray.cloneWithMaxEdgeLength(basePoints, maxEdgeLength);
          transform.multiplyPoint3dArray(points, points);
          const graph = new HalfEdgeGraph();
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), outputX0, outputY0 += outputStepY);
          const seed = Triangulator.createFaceLoopFromCoordinates(graph, points, true, false)!;
          const context = new RegularizationContext(graph);
          context.regularizeFace(seed);
          const mesh = PolyfaceBuilder.graphToPolyface(graph);
          GeometryCoreTestIO.captureGeometry(allGeometry, mesh, outputX0, outputY0 += outputStepY);
          outputX0 += outputStepX;
          outputY0 = outputY1;
        }
        outputX0 = 0;
        outputY1 += bigStepY;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "RegularizeB");
    expect(ck.getNumErrors()).equals(0);
  });
  /**
   * Lots of regularization tests ..
   * Each starts with a rectilinear square wave and return, with varying wave counts and sizes
   * The basic shape is varied by
   * * simple rotation
   * * polar mapping that turns it into "circular" saw.
   *
   * The primary rectilinear wave is probably the hardest one to regularize -- horizontal edges are always a special problem.
   */
  it("RegularizeC", () => {
    const ck = new Checker();

    let outputX0 = 0;
    let outputY0 = 100;
    const outputStepX = 100.0;
    const outputStepY = 20.0;
    const bigStepY = 800.0;
    const bigStepX = 400.0;
    let outputX1 = 0.0;
    let outputY1 = 0.0;

    const dx0Wave = -0.30;
    const dx1Wave = -0.25;
    const dx2Wave = -0.10;
    const dyB = 0.5;
    const hardLoopXStep = outputStepX * 0.25;
    const transformA = Transform.createFixedPointAndMatrix(Point3d.create(2, 4, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(14.23423)));
    const allGeometry: GeometryQuery[] = [];
    const hardLoops: GeometryQuery[] = [];
    for (const numPhase of [2, 4, 6]) {   // [2,4, 6] !!
      for (const radians0 of [0, -2, -4]) { // [0, -2] !
        outputX0 = outputX1;
        outputY0 = outputY1;
        for (const maxEdgeLength of [0.25]) {   // [0.25, 0.35]
          for (const s of [1, -1]) { // [1,-1]
            for (const basePoints of [
              // Sample.createSquareWave(Point3d.create(radians0, 4, 0), 2 * dx0Wave, 0.5, 2 * dx1Wave, numPhase, 1),
              Sample.createSquareWave(Point3d.create(radians0, 4, 0), dx0Wave, 0.5, dx1Wave, numPhase, 1),
              Sample.createBidirectionalSawtooth(Point3d.create(radians0, 4, 0),
                dx0Wave, dx2Wave, dyB, dx1Wave, 2, 3.0, dx0Wave, dx2Wave, dyB, 0),
              Sample.createBidirectionalSawtooth(Point3d.create(radians0, 4, 0),
                dx0Wave, dx2Wave, dyB, dx1Wave, 2, 2.0, dx0Wave, dx2Wave, -dyB, 0)]) {
              const pointsRTheta = Point3dArray.cloneWithMaxEdgeLength(basePoints, maxEdgeLength);
              GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointsRTheta), outputX0, outputY0 += outputStepY);
              const points = mapThetaR(pointsRTheta, s, s);

              if (testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, true)) {
                outputY0 += 2 * outputStepY;
              } else {
                GeometryCoreTestIO.captureGeometry(hardLoops, LineString3d.create(pointsRTheta), outputX0 - hardLoopXStep, outputY0);
                testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, false);
                testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, false, true);
              }

              for (let i = 0; i < 3; i++) {
                transformA.multiplyPoint3dArrayInPlace(pointsRTheta);
                if (testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, true)) {
                  outputY0 += 2 * outputStepY;
                } else {
                  GeometryCoreTestIO.captureGeometry(hardLoops, LineString3d.create(pointsRTheta), outputX0 - hardLoopXStep, outputY0);
                  testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, false);
                  testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, false, true);
                }
              }

              GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), outputX0, outputY0 += outputStepY);

              if (testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, points, true, true)) {
                outputY0 += 2 * outputStepY;
              } else {
                GeometryCoreTestIO.captureGeometry(hardLoops, LineString3d.create(points), outputX0 - hardLoopXStep, outputY0);
                testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, points, true, false);
                testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, points, false, true);
              }

              outputY0 = outputY1;
              outputX0 += outputStepX;
            }
            outputX0 += bigStepX;
            outputY0 = outputY1;
          }
          outputX0 += bigStepX;
          outputY0 = outputY1;
        }
        outputX1 = 0.0;
        outputY1 += bigStepY;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "RegularizeC");
    ck.testExactNumber(0, hardLoops.length, "See RegularizationC.HardLoops for " + hardLoops.length + "regularization failure cases ");
    GeometryCoreTestIO.saveGeometry(hardLoops, "Graph", "RegularizeC.HardLoops");
    expect(ck.getNumErrors()).equals(0);
  });
  /**
   * This test is used to do finer debugging of a single failing case from that fail RegularizeC.
   */
  it("RegularizeD", () => {
    const ck = new Checker();
    const outputX0 = 0.0;
    let outputY0 = 100;
    const outputStepX = 100.0;
    const outputStepY = 20.0;

    const dx0Wave = -0.30;
    const dx1Wave = -0.25;
    const dyWave = -0.5;
    const hardLoopXStep = outputStepX * 0.25;
    const allGeometry: GeometryQuery[] = [];
    const hardLoops: GeometryQuery[] = [];
    const maxEdgeLength = 19;
    const numPhase = 4;
    const basePoints = Sample.createSquareWave(Point3d.create(0, 0, 0), dx0Wave, dyWave, dx1Wave, numPhase, 2 * dyWave);

    const pointsRTheta = Point3dArray.cloneWithMaxEdgeLength(basePoints, maxEdgeLength);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointsRTheta), outputX0, outputY0 += outputStepY);

    if (testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, true)) {
      outputY0 += 2 * outputStepY;
    } else {
      GeometryCoreTestIO.captureGeometry(hardLoops, LineString3d.create(pointsRTheta), outputX0 - hardLoopXStep, outputY0);
      testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, false);
      testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, false, true);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "RegularizeD");
    // GeometryCoreTestIO.saveGeometry(hardLoops, "Graph", "RegularizeD.HardLoops");
    expect(ck.getNumErrors()).equals(0);
  });

  /**
   * This test is used to do finer debugging of a single failing case from that fail RegularizeC.
   */
  it("RegularizeFractals", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0.0;
    let dy = 0.0;
    for (const numRecursion of [1, 2, 3]) {
      dy = 0.0;
      let axMax = 0.0;
      for (const perpendicularFactor of [0.85, -1.0, -0.5]) {
        for (const generatorFunction of [
          Sample.createFractalSquareReversingPattern,
          Sample.createFractalDiamondConvexPattern,
          Sample.createFractalLReversingPattern,
          Sample.createFractalHatReversingPattern,
          Sample.createFractalLMildConcavePatter]) {
          for (const degrees of [0, 10, 79]) {
            const points = generatorFunction(numRecursion, perpendicularFactor);
            const transform0 = Transform.createFixedPointAndMatrix(points[0], Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
            transform0.multiplyPoint3dArrayInPlace(points);
            const range = Range3d.createArray(points);
            axMax = Geometry.maxXY(axMax, range.xLength());
            testRegularize(ck, allGeometry, dx, dy, points, true, true);
            dy += 4.0 * range.yLength();
          }
        }
        dy += 20.0;
      }
      dx += 10 * axMax;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "RegularizeFractals");
    expect(ck.getNumErrors()).equals(0);
  });
});

/**
 * Return true if this combination of sweeps produces a regularized graph.
 */
function testRegularize(
  _ck: Checker,
  allGeometry: GeometryQuery[],
  dx: number,
  dy: number,
  points: Point3d[],
  sweepUp: boolean,
  sweepDown: boolean): boolean {
  const graph = new HalfEdgeGraph();
  const seed = Triangulator.createFaceLoopFromCoordinates(graph, points, true, false)!;
  const context = new RegularizationContext(graph);
  context.regularizeFace(seed, sweepUp, sweepDown);
  const range = HalfEdgeGraphOps.graphRange(graph);
  const ax = 2.5 * range.xLength();
  const bx = 4.0 * range.xLength();
  let dumpEdges = false;
  const mesh = PolyfaceBuilder.graphToPolyface(graph);
  GeometryCoreTestIO.captureGeometry(allGeometry, mesh, dx, dy);
  const monotoneFaces: HalfEdge[] = [];
  const nonMonotoneFaces: HalfEdge[] = [];
  RegularizationContext.collectMappedFaceRepresentatives(graph, true, RegularizationContext.isMonotoneFace, monotoneFaces, nonMonotoneFaces);
  if (monotoneFaces.length !== 0) {
    const mesh1 = PolyfaceBuilder.graphFacesToPolyface(graph, monotoneFaces);
    if (sweepUp && sweepDown) { // With both sweeps it SHOULD be a complete facet set ...
      const ex = 0.2 * range.xLength();
      const ey = 0.2 * range.yLength();
      const ls1 = Sample.createRectangleXY(range.low.x - ex, range.low.y - ey, range.xLength() + 2 * ex, range.yLength() + 2 * ey)!;
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(ls1), dx + ax, dy, 0.0);
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, mesh1, dx + ax, dy, 0.0);
  }
  const r0 = -0.25;
  const r1 = 1.25;    // fractions for non-monotone face annotation line.
  if (nonMonotoneFaces.length !== 0) {
    const mesh1 = PolyfaceBuilder.graphFacesToPolyface(graph, nonMonotoneFaces);

    if (sweepUp && sweepDown) { // With both sweeps this should be empty ...
      let numBad = 0;
      for (const f of nonMonotoneFaces) {
        if (!RegularizationContext.isMonotoneFace(f))
          numBad++;
      }
      console.log(" nonMonotone faces " + numBad + " of " + nonMonotoneFaces.length);
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(range.fractionToPoint(r0, r0, 0), range.fractionToPoint(r1, r1, 0)), dx + bx, dy, 0.0);
      dumpEdges = true;
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, mesh1, dx + bx, dy, 0.0);
  }
  if (dumpEdges)
    for (const edge of graph.allHalfEdges) {
      if (edge.id < edge.edgeMate.id)
        GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYZXYZ(
          edge.x, edge.y, 0, edge.faceSuccessor.x, edge.faceSuccessor.y, 0), dx + ax + bx, dy, 0.0);
    }
  return monotoneFaces.length > 0 && nonMonotoneFaces.length === 0;
}

/**
 * Lots of regularization tests ..
 * Each starts with a rectilinear square wave and and wraps it in a spiral (multiple loops)
 */
it("RegularizeSpiralBand", () => {
  const ck = new Checker();

  let outputX0 = 0;
  let outputY0 = 100;
  const outputStepX = 100.0;
  const outputStepY = 20.0;
  const bigStepY = 800.0;
  const bigStepX = 400.0;
  let outputX1 = 0.0;
  let outputY1 = 0.0;

  const dx0Wave = 0.30;
  const dx1Wave = 0.25;
  const dx2Wave = 0.10;
  const dyB = 0.25;
  const hardLoopXStep = outputStepX * 0.25;
  const allGeometry: GeometryQuery[] = [];
  const hardLoops: GeometryQuery[] = [];
  for (const numPhase of [5, 12]) {
    for (const radians0 of [0, 2, 4]) { // [0, -2] !
      outputX0 = outputX1;
      outputY0 = outputY1;
      for (const maxEdgeLength of [0.25]) {   // [0.25, 0.35]
        const s = 1.0;
        for (const basePoints of [
          Sample.createSquareWave(Point3d.create(radians0, 4, 0), dx0Wave, 0.5, dx1Wave, numPhase, 1),
          Sample.createBidirectionalSawtooth(Point3d.create(radians0, 4, 0),
            dx0Wave, dx2Wave, dyB, dx1Wave, numPhase, 1.2, dx0Wave, dx2Wave, dyB, 0)]) {
          const pointsRTheta = Point3dArray.cloneWithMaxEdgeLength(basePoints, maxEdgeLength);
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(pointsRTheta), outputX0, outputY0 += outputStepY);
          const points = mapThetaRWithPitch(pointsRTheta, s, s, 4.0);

          if (testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, points, true, true)) {
            outputY0 += 2 * outputStepY;
          } else {
            GeometryCoreTestIO.captureGeometry(hardLoops, LineString3d.create(points), outputX0 - hardLoopXStep, outputY0);
            testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, true, false);
            testRegularize(ck, allGeometry, outputX0, outputY0 += outputStepY, pointsRTheta, false, true);
          }
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), outputX0 - hardLoopXStep, outputY0);

          outputY0 = outputY1;
          outputX0 += outputStepX;
        }
        outputX0 += bigStepX;
        outputY0 = outputY1;
      }
      outputX1 = 0.0;
      outputY1 += bigStepY;
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "Graph", "RegularizeSpiralBand");
  ck.testExactNumber(0, hardLoops.length, "See RegularizationSpiralBand.HardLoops for " + hardLoops.length + "regularization failure cases ");
  GeometryCoreTestIO.saveGeometry(hardLoops, "Graph", "RegularizeC.HardLoops");
  expect(ck.getNumErrors()).equals(0);
});
