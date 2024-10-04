/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import { AnyCurve } from "../../curve/CurveTypes";
import { BagOfCurves, CurveChain, CurveCollection } from "../../curve/CurveCollection";
import { CurveOps } from "../../curve/CurveOps";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { JointOptions } from "../../curve/OffsetOptions";
import { Path } from "../../curve/Path";
import { RegionOps } from "../../curve/RegionOps";
import { Geometry } from "../../Geometry";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { PolylineOps } from "../../geometry3d/PolylineOps";
import { Range3d } from "../../geometry3d/Range";
import { Sample, SteppedIndexFunctionFactory } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { ChainMergeContext } from "../../topology/ChainMerge";
import { Vector3d } from "../../geometry3d/Point3dVector3d";

const chainCollectorInputDirectory = "./src/test/data/ChainCollector/";
const noOffset0 = "aecc_alignment";
describe("ChainCollector", () => {

  it("OffsetExamples", () => {
    const ck = new Checker();
    let xOut = 0;
    let y0 = 0;
    for (const filename of ["fillet00", "aecc_alignment", "linestring01", "boomerang.incompleteOffset", "boomerang.noOffsetsWithThisOrder",
      "boomerang", "rectangle00", "linestrings", "MBDenseCurvesToOffset"]) {
      const allGeometry: GeometryQuery[] = [];
      const stringData = fs.readFileSync(`${chainCollectorInputDirectory}${filename}.imjs`, "utf8");
      if (stringData) {
        const jsonData = JSON.parse(stringData);
        let fragments = IModelJson.Reader.parse(jsonData);
        if (fragments instanceof CurveChain)
          fragments = [fragments];
        if (Array.isArray(fragments)) {
          const range = CurveOps.extendRange(Range3d.create(), fragments);
          const x0 = xOut - range.low.x;
          y0 = -range.low.y;

          const offsetDistance = 0.1 * range.xLength();
          const yShift = 2 * range.yLength();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragments, x0, y0);

          if (filename === noOffset0) {
            y0 += yShift;
            // try multiple gaps to demonstrate effects of aggressive gap closure
            for (const gapFraction of [0.001, 0.002, 0.004, 0.008]) {
              const gapTolerance = gapFraction * range.xLength();
              for (const fragment of fragments) {
                if (fragment instanceof GeometryQuery) {
                  const anyLocation = CurveCollection.createCurveLocationDetailOnAnyCurvePrimitive(fragment, 0.0);
                  if (anyLocation) {
                    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, anyLocation.point, gapTolerance, x0, y0);
                  }
                }
              }
              const chains = RegionOps.collectChains(fragments, gapTolerance);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, chains, x0, y0);
              y0 += 0.1 * yShift;
            }
          } else {
            const offsets = RegionOps.collectInsideAndOutsideOffsets(fragments, offsetDistance, offsetDistance * 0.1);
            y0 += yShift;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.chains, x0, y0);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.insideOffsets, x0, y0, 0.01);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.outsideOffsets, x0, y0, -0.01);
          }
          GeometryCoreTestIO.consoleLog(`output to ${filename}`);
          GeometryCoreTestIO.saveGeometry(allGeometry, "ChainCollector", filename);
          xOut += 2 * range.xLength();
        }
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("OffsetCleanup", () => {
    const ck = new Checker();
    let xOut = 0;
    let y0 = 0;
    const compressionFactors = [0.1, 0.2, 0.4, 0.6, 1.0];
    const offsetFractions = [0.01, 0.02, 0.04, 0.06, 0.10];
    // expect a single loo input ...
    for (const filename of ["MBDenseCurvesToOffset"]) {
      const allGeometry: GeometryQuery[] = [];
      const stringData = fs.readFileSync(`${chainCollectorInputDirectory}${filename}.imjs`, "utf8");
      if (stringData) {
        const jsonData = JSON.parse(stringData);
        const fragments = IModelJson.Reader.parse(jsonData);
        if (fragments instanceof Loop || fragments instanceof Path) {
          const pointsA = fragments.getPackedStrokes()!;
          const areaA = PolygonOps.areaXY(pointsA);
          const offsetSign = Geometry.split3WaySign(areaA, 1, 1, -1);
          const range = CurveOps.extendRange(Range3d.create(), fragments);
          let x0 = xOut - range.low.x;
          y0 = -range.low.y;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, x0, y0, 0.01);

          const yShift = 2 * range.yLength();
          for (const offsetFraction of offsetFractions) {
            y0 = -range.low.y;
            const offsetDistance = offsetFraction * range.xLength();
            for (const compressionFactor of compressionFactors) {
              y0 += yShift;
              const compressionDistance = compressionFactor * offsetDistance;
              GeometryCoreTestIO.consoleLog({ offset: offsetDistance, compress: compressionDistance });
              const pointsB = PolylineOps.compressByChordError(pointsA.getPoint3dArray(), compressionDistance);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsB, x0, y0, 0.01);
              const loopB = Loop.createPolygon(pointsB);
              const options = new JointOptions(offsetSign * offsetDistance, 100, 135);
              const offsetCurves = RegionOps.constructCurveXYOffset(loopB, options);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetCurves, x0, y0);
            }
            y0 += 5 * range.yLength();
            // cleanup at 0.25 ... offset 25%, repeat
            const cleanupFraction = 0.2;
            const cleanupDistance = cleanupFraction * offsetDistance;
            const numOffsets = 4;
            const offsetStep = offsetSign * offsetDistance / numOffsets;
            let currentPoints = pointsA.getPoint3dArray();
            for (let i = 0; i < 4; i++) {
              const newPoints = PolylineOps.compressByChordError(currentPoints, cleanupDistance);
              const loopB = Loop.createPolygon(newPoints);
              const options = new JointOptions(offsetStep, 100, 135);
              const offsetCurves = RegionOps.constructCurveXYOffset(loopB, options) as Loop;
              currentPoints = offsetCurves.getPackedStrokes()!.getPoint3dArray();
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, x0, y0, 0.01);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopB, x0, y0, -0.01);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, currentPoints, x0, y0);
              y0 += yShift;
            }
            x0 += 2.5 * range.xLength();
          }
          GeometryCoreTestIO.consoleLog(`output to ${filename}`);
          GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetCleanup", filename);
          xOut += 2 * range.xLength();
        }
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });
  it("PrimitiveOrder", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const xShift = 20.0;
    const yShift = 20.0;
    const offsetDistance = 0.5;
    const reversePhase = [8, 5];    // reverse primitives if their index modulo anything here is reverseShift
    const reverseShift = 3;
    for (const numPrimitive of [5, 6, 30, 60]) {
      let y0 = 0;
      const shuffledPrimitives = [];
      const circlePoints = Sample.createPointsByIndexFunctions(numPrimitive,
        SteppedIndexFunctionFactory.createCosine(6.0), SteppedIndexFunctionFactory.createSine(8.0));
      // make primitives in simple order around the ellipse ..
      const sequentialPrimitives = [];
      for (let i = 0; i + 1 < circlePoints.length; i++)
        sequentialPrimitives.push(LineSegment3d.create(circlePoints[i], circlePoints[i + 1]));
      // step through the primitives at various intervals to get them out non-sequentially
      for (const step of [2, 3, 7, 5, 1]) {
        for (let i = 0; i < sequentialPrimitives.length; i += step) {
          if (sequentialPrimitives[i] !== undefined) {
            const p = sequentialPrimitives[i]!;
            for (const m of reversePhase) {
              if ((i % m) === reverseShift) {
                p.reverseInPlace();
                break;
              }
            }
            shuffledPrimitives.push(p);
            sequentialPrimitives[i] = undefined;
          }
        }
      }
      // sort them all back together
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, shuffledPrimitives, x0, y0);
      y0 += yShift;
      const offsets = RegionOps.collectInsideAndOutsideOffsets(shuffledPrimitives, offsetDistance, offsetDistance * 0.1);
      y0 += yShift;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, shuffledPrimitives, x0, y0);
      y0 += yShift;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.chains, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.insideOffsets, x0, y0, 0.1);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.outsideOffsets, x0, y0, -0.1);
      x0 += xShift;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ChainCollector", "PrimitiveOrder");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("SmallInputs", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const xShift = 20.0;
    const yShift = 20.0;
    const offsetDistance = 0.5;
    const boxA = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 3, 4, 0, true)));
    const boxB = Loop.create(LineString3d.create(Sample.createRectangle(5, 0, 9, 4, 0, true)));
    for (const primitives of [boxA, BagOfCurves.create(boxA, boxB)]) {
      let y0 = 0;
      // sort them all back together
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, primitives, x0, y0);
      y0 += yShift;
      const offsets = RegionOps.collectInsideAndOutsideOffsets([primitives], offsetDistance, offsetDistance * 0.1);
      y0 += yShift;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, primitives, x0, y0);
      y0 += yShift;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.chains, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.insideOffsets, x0, y0, 0.1);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsets.outsideOffsets, x0, y0, -0.1);
      const outsideOffsetLength = CurveOps.sumLengths(offsets.outsideOffsets);
      // skip the inside and outside ..
      const myOffsetA: AnyCurve[] = [];
      CurveOps.appendXYOffsets(primitives, -offsetDistance, myOffsetA);
      const myLengthA = CurveOps.sumLengths(myOffsetA);
      y0 += yShift;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, myOffsetA, x0, y0);

      const myOffsetB: AnyCurve[] = [];
      CurveOps.appendXYOffsets([primitives], -offsetDistance, myOffsetB);
      const myLengthB = CurveOps.sumLengths(myOffsetB);
      y0 += yShift;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, myOffsetB, x0, y0);
      ck.testCoordinate(outsideOffsetLength, myLengthA);
      ck.testCoordinate(outsideOffsetLength, myLengthB);
      x0 += xShift;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ChainCollector", "SmallInputs");
    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("ChainMerge", () => {
  it("ChainMergeVariants", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const e = 1;    // Really big blob tolerance !!!
    // line segments of a unit square with gap "e" at the beginning of each edge.
    const segments = [
      LineSegment3d.createXYXY(e, 0, 10, 0),
      LineSegment3d.createXYXY(10, e, 10, 10),
      LineSegment3d.createXYXY(10 - e, 10, 0, 10),
      LineSegment3d.createXYXY(0, 10 - e, 0, 0)];
    let dy = 20.0;
    for (const tol of [0.0001 * e, 2.0 * e]) {
      // Create the context with the worst possible sort direction -- trigger N^2 search
      const chainMergeContext = ChainMergeContext.create(
        {
          tolerance: tol,
          primarySortDirection: Vector3d.create(0, 0, 1),
        });
      chainMergeContext.addLineSegment3dArray(segments);
      chainMergeContext.clusterAndMergeVerticesXYZ();
      const chains = chainMergeContext.collectMaximalChains();
      let expectedChains = 4;
      if (tol > e)
        expectedChains = 1;
      ck.testExactNumber(chains.length, expectedChains, "Chain count with variant tolerance");
      GeometryCoreTestIO.captureGeometry(allGeometry, chains, 0, dy, 0);
      dy += 20.0;
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, segments, 0, 0, 0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "ChainMergeVariants");
    expect(ck.getNumErrors()).toBe(0);
  });
});
