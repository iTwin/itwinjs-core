/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { InterpolationCurve3d, InterpolationCurve3dOptions } from "../../bspline/InterpolationCurve3d";
import { Arc3d } from "../../curve/Arc3d";
import { AnyCurve, AnyRegion } from "../../curve/CurveTypes";
import { CurveCollection } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveFactory } from "../../curve/CurveFactory";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { PlaneAltitudeRangeContext } from "../../curve/internalContexts/PlaneAltitudeRangeContext";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop, SignedLoops } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { UnionRegion } from "../../curve/UnionRegion";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PointStreamXYZHandlerBase, VariantPointDataStream } from "../../geometry3d/PointStreaming";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { PolylineOps } from "../../geometry3d/PolylineOps";
import { Range1d, Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { PolyfaceVisitor } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { DuplicateFacetClusterSelector, PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { LinearSweep } from "../../solid/LinearSweep";
import { HalfEdgeGraph } from "../../topology/Graph";
import { HalfEdgeGraphMerge, VertexNeighborhoodSortData } from "../../topology/Merging";
import { MultiLineStringDataVariant } from "../../topology/Triangulation";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GraphChecker } from "../topology/Graph.test";

describe("RegionBoolean", () => {
  it("SimpleSplits", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const candidates: CurvePrimitive[] = [];
    let x0 = 0;
    let y0 = 0;
    candidates.push(LineSegment3d.createXYXY(0, 0, 1, 0));
    candidates.push(LineSegment3d.createXYXY(1, 0, 1, 1));
    candidates.push(Arc3d.createCircularStartMiddleEnd(Point3d.create(0.1, -0.1), Point3d.create(0.5, 0.6), Point3d.create(1.1, 0.8))!);
    for (const c of candidates)
      GeometryCoreTestIO.consoleLog(" geometry: ", IModelJson.Writer.toIModelJson(c));
    const linestringStartY = 0.5;   // making this 0.5 creates partial overlap -- problem?
    for (const stepData of [
      { geometry: LineSegment3d.createXYXY(0, 0.5, 1, 0.5), expectedFaces: 3 },
      { geometry: LineSegment3d.createXYXY(0.8, -0.1, 1.1, 0.2), expectedFaces: 4 },
      { geometry: LineSegment3d.createXYXY(0.5, 0, 0.4, -0.2), expectedFaces: 4 },
      { geometry: LineSegment3d.createXYXY(0.4, 0.0, 0.4, -0.2), expectedFaces: 5 },
      { geometry: LineSegment3d.createXYXY(0.4, 0.0, 1.6, 1), expectedFaces: 6 },
      { geometry: LineString3d.create([0, linestringStartY], [0.2, 0.5], [0.8, 0.3], [1.2, 0.4]), expectedFaces: -1, expectedIntersections: -1 },
    ]) {
      candidates.push(stepData.geometry);
      GeometryCoreTestIO.consoleLog(" add geometry: ", IModelJson.Writer.toIModelJson(stepData.geometry));
      for (const c of candidates)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, c, x0, y0);
      const loops = RegionOps.constructAllXYRegionLoops(candidates);
      y0 += 0.75;
      saveShiftedLoops(allGeometry, loops, x0, y0, 1.0);
      if (stepData.expectedFaces >= 0 && loops.length === 1)
        ck.testExactNumber(stepData.expectedFaces, loops[0].positiveAreaLoops.length + loops[0].negativeAreaLoops.length + loops[0].slivers.length, "Face loop count");
      x0 += 5.0;
      y0 = 0.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "SimpleSplits");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Holes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const delta = 15.0;
    let y0 = 0;
    for (const filletRadius of [undefined, 0.5]) {
      for (const numHole of [1, 3]) {
        const candidates: AnyCurve[] = [];
        const holeStep = 0.5;
        candidates.push(CurveFactory.createRectangleXY(0, 0, 10, 10, 0, filletRadius));
        candidates.push(CurveFactory.createRectangleXY(5, 8, 12, 12, 0, filletRadius));
        candidates.push(LineSegment3d.createXYXY(6, 5, 10, 11));
        for (let holeIndex = 0; holeIndex < numHole; holeIndex++) {
          const ex = holeIndex * holeStep;
          const ey = holeIndex * holeStep * 0.5;
          candidates.push(CurveFactory.createRectangleXY(1 + ex, 1 + ey, 2 + ex, 2 + ey, 0));
        }
        for (const c of candidates)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, c, x0, y0);
        const loops = RegionOps.constructAllXYRegionLoops(candidates);
        y0 += delta;
        saveShiftedLoops(allGeometry, loops, x0, y0, delta);
        if (loops.length > 1) {
          const negativeAreas = [];
          for (const loopSet of loops) {
            for (const loop of loopSet.negativeAreaLoops)
              negativeAreas.push(loop);
          }
          const regions = RegionOps.sortOuterAndHoleLoopsXY(negativeAreas);
          x0 += delta;
          y0 = 0;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, regions, x0, y0);
        }
        x0 += delta * (loops.length + 1);
        y0 = 0.0;
      }
      x0 += 4 * delta;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "Holes");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Overlaps", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const badGeometry: GeometryQuery[] = [];
    const xMax = 10.0;
    const da = 1.0;
    let x0 = 0.0;
    let y0 = 0;
    const c = 1.0;
    const c1 = 2.5;
    for (const degrees of [0, 180, 0.012123389324234, 42.123213]) {
      const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0),
        Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(degrees)));
      x0 = 0.0;
      for (const ab of [0.6 /* , 1.1, 3.1 */]) {
        for (const numCut of [1, 4, 7, 9]) {
          const candidates: AnyCurve[] = [];
          candidates.push(Loop.createPolygon([
            Point3d.create(0, 0),
            Point3d.create(xMax, 0),
            Point3d.create(xMax, 2),
            Point3d.create(0, 2),
            Point3d.create(0, 0)]));

          const a0 = 0.5;
          const b0 = a0 + ab;
          for (let i = 0; i < numCut; i++) {
            const a = a0 + i * da;
            const b = b0 + i * da;
            // alternate direction of overlap bits ... maybe it will cause problems in graph sort . .
            if ((i & 0x01) === 0)
              candidates.push(LineSegment3d.createXYXY(a, 0, b, 0));
            else
              candidates.push(LineSegment3d.createXYXY(a, 0, b, 0));
            candidates.push(LineSegment3d.createXYXY(a, 0, a, c));
            candidates.push(LineSegment3d.createXYXY(b, 0, b, c));
            candidates.push(LineSegment3d.createXYXY(a, c, b, c));
            // spread around some X geometry  . . .
            if ((i & 0x02) !== 0 && ab > 2.0) {
              candidates.push(LineSegment3d.createXYXY(a, c, b, c1));
              candidates.push(LineSegment3d.createXYXY(a, c1, b, c));
            }
          }
          let testIndex = 0;
          for (const candidate of candidates) {
            (candidate as any).testIndex = testIndex++;
            candidate.tryTransformInPlace(transform);
          }
          const loops = RegionOps.constructAllXYRegionLoops(candidates);
          const dy = 3.0;
          saveShiftedLoops(allGeometry, loops, x0, y0 + dy, dy);
          const stepData = { rotateDegrees: degrees, numCutout: numCut, cutoutStep: ab };
          if (!ck.testExactNumber(1, loops.length, stepData)
            || !ck.testExactNumber(1, loops[0].negativeAreaLoops.length, stepData)) {
            saveShiftedLoops(badGeometry, loops, x0, y0 + dy, dy);
          }

          GeometryCoreTestIO.captureCloneGeometry(allGeometry, candidates, x0, y0);
          x0 += 2 * xMax;
        }
        x0 += 4 * xMax;
      }
      y0 += 100.0;
    }
    GeometryCoreTestIO.saveGeometry(badGeometry, "RegionBoolean", "Overlaps.BAD");
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "Overlaps");
    expect(ck.getNumErrors()).equals(0);

  });
  it("ParityRegionWithCoincidentEdges", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let xBase = 0.0;
    const yBase = 0;
    for (const q of [0, 1, -1]) {
      const a0 = -q;
      const a1 = 12 + q;
      const b0 = 4 - q;
      const b1 = 8 + q;
      for (const q1 of [0, -1, 1]) {
        const pointArrayA = [[8, +q1], [4, 0], [a0, a0], [0, 4], [0, 8], [a0, 12],
        [4, 11], [8, 11], [a1, 12], [12, 8], [12, 4], [a1, a0], [8, 0]];
        const pointArrayB = [[8, 0], [4, 0], [b0, 4], [4, 8], [8, 8], [b1, 4], [8, 0]];
        // loopB.reverseChildrenInPlace();
        runRegionTest(allGeometry, pointArrayA, pointArrayB, xBase, yBase);
        xBase += 100;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Solids", "ParityRegionWithCoincidentEdges");
    expect(ck.getNumErrors()).equals(0);
  });

  interface CreateXYRegionsProps {
    ck: Checker;
    allGeometry: GeometryQuery[];
    x0?: number;
    y0?: number;
    z0?: number;
    delta?: number;
  }

  interface SignedLoopCounts {
    numPositiveAreaLoops: number;
    numNegativeAreaLoops: number;
    numSlivers: number;
    numEdges?: number;
  }

  function createXYRegions(curvesAndRegions: AnyCurve | AnyCurve[], props: CreateXYRegionsProps, expected?: SignedLoopCounts[]): SignedLoops[] {
    const ck = props.ck;
    const allGeometry = props.allGeometry;
    let x0 = props.x0 ?? 0;
    let y0 = props.y0 ?? 0;
    let z0 = props.z0 ?? 0;
    const delta = props.delta ?? 0;

    if (Array.isArray(curvesAndRegions))
      for (const geom of curvesAndRegions) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, geom, x0, y0, z0);
        y0 += delta;
      }
    else
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, curvesAndRegions, x0, y0, z0);

    const outLoops = RegionOps.constructAllXYRegionLoops(curvesAndRegions);
    if (undefined !== expected) {
      if (ck.testExactNumber(outLoops.length, expected.length, "created expected number of SignedRegions")) {
        for (let i = 0; i < outLoops.length; ++i) {
          ck.testExactNumber(outLoops[i].positiveAreaLoops.length, expected[i].numPositiveAreaLoops);
          ck.testExactNumber(outLoops[i].negativeAreaLoops.length, expected[i].numNegativeAreaLoops);
          ck.testExactNumber(outLoops[i].slivers.length, expected[i].numSlivers);
          ck.testExactNumber(outLoops[i].edges?.length ?? 0, expected[i].numEdges ?? 0);
        }
      }
    }

    x0 += delta;
    y0 = 0;
    for (const signedLoop of outLoops) {
      for (const outerLoop of signedLoop.negativeAreaLoops) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, outerLoop, x0, y0, z0);
        y0 += delta;
      }

      x0 += delta;
      y0 = 0;
      for (const innerLoop of signedLoop.positiveAreaLoops) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, innerLoop, x0, y0, z0);
        y0 += delta;
      }

      x0 += delta;
      y0 = 0;
      for (const sliver of signedLoop.slivers) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, sliver, x0, y0, z0);
        y0 += delta;
      }

      x0 = delta;
      y0 = 0;
      z0 += delta;
    }

    return outLoops;
  }

  it("ParityRegionWithCoincidentBoundary", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const delta = 10;
    const deltaFactorToNextTest = 5;
    let variant = 0;

    // original input: ccw outer, ccw inner with downward normal arc
    const outsideLoop = Loop.create(
      LineSegment3d.createXYXY(0, 0, 0, 5),
      LineSegment3d.createXYXY(0, 5, -5, 5),
      LineSegment3d.createXYXY(-5, 5, -5, 0),
      LineSegment3d.createXYXY(-5, 0, 0, 0),
    );
    let insideLoop = Loop.create(
      LineSegment3d.createXYXY(0, 0, 0, 2),
      LineSegment3d.createXYXY(0, 2, -2, 2),
      Arc3d.create(
        Point3d.create(-2, 1),
        Vector3d.create(0, 1),
        Vector3d.create(1, 0),
        AngleSweep.createStartEndDegrees(0, 180),
      ),
      LineSegment3d.createXYXY(-2, 0, 0, 0),
    );
    const expected: SignedLoopCounts[] = [{ numPositiveAreaLoops: 2, numNegativeAreaLoops: 1, numSlivers: 2, numEdges: 8 }];

    createXYRegions([outsideLoop, insideLoop], { ck, allGeometry, x0, y0, z0, delta }, expected);

    // variant input #1: parity region from original input
    ++variant;
    const region = ParityRegion.create();
    region.tryAddChild(outsideLoop);
    region.tryAddChild(insideLoop);
    x0 = variant * deltaFactorToNextTest * delta;
    createXYRegions(region, { ck, allGeometry, x0, y0, z0, delta }, expected);

    // variant input #2: ccw inner with upward normal arc
    ++variant;
    insideLoop = Loop.create(
      LineSegment3d.createXYXY(0, 0, 0, 2),
      LineSegment3d.createXYXY(0, 2, -2, 2),
      Arc3d.create(
        Point3d.create(-2, 1),
        Vector3d.create(1, 0),
        Vector3d.create(0, 1),
        AngleSweep.createStartEndDegrees(90, -90),
      ),
      LineSegment3d.createXYXY(-2, 0, 0, 0),
    );
    x0 = variant * deltaFactorToNextTest * delta;
    createXYRegions([outsideLoop, insideLoop], { ck, allGeometry, x0, y0, z0, delta }, expected);

    // variant input #3: parity region from variant #2
    ++variant;
    x0 = variant * deltaFactorToNextTest * delta;
    createXYRegions(region, { ck, allGeometry, x0, y0, z0, delta }, expected);

    // variant input #4: cw inner with upward normal arc
    ++variant;
    insideLoop = Loop.create(
      LineSegment3d.createXYXY(0, 0, -2, 0),
      Arc3d.create(
        Point3d.create(-2, 1),
        Vector3d.create(1, 0),
        Vector3d.create(0, 1),
        AngleSweep.createStartEndDegrees(-90, 90),
      ),
      LineSegment3d.createXYXY(-2, 2, 0, 2),
      LineSegment3d.createXYXY(0, 2, 0, 0),
    );
    x0 = variant * deltaFactorToNextTest * delta;
    createXYRegions([outsideLoop, insideLoop], { ck, allGeometry, x0, y0, z0, delta }, expected);

    // variant input #5: parity region from variant #4
    ++variant;
    x0 = variant * deltaFactorToNextTest * delta;
    createXYRegions(region, { ck, allGeometry, x0, y0, z0, delta }, expected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "ParityRegionWithCoincidentBoundary");
    expect(ck.getNumErrors()).equals(0);
  });

  // a 2-edge face that is NOT null
  it("BananaRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const banana = Loop.create(
      Arc3d.create(Point3d.create(1, 0), Vector3d.create(1, 0), Vector3d.create(0, 1), AngleSweep.createStartEndDegrees(-180, -360)),
      Arc3d.create(Point3d.create(1, 0), Vector3d.create(1, 0), Vector3d.create(0, 2), AngleSweep.createStartEndDegrees(0, 180)),
    );
    const expected: SignedLoopCounts[] = [{ numPositiveAreaLoops: 1, numNegativeAreaLoops: 1, numSlivers: 0, numEdges: 2 }];

    createXYRegions(banana, { ck, allGeometry }, expected);

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "BananaRegion");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ParityRegionWithBadBoundary", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let xBase = 0.0;
    let yBase = 0.0;
    // q is an offset applied to corners to affect whether contiguous segments are colinear.
    //  q=0 makes lots of colinear edges.
    //  q=1 spreads corners to make all angles nonzero.
    // q1,q2 is an offset applied to a single point of the interior shape to change it from
    //   0,0 full edge touch
    //   1,0 single point touch from inside.
    //   1,1 full hole
    // -1,-1 partly out.
    for (const skewFactor of [0, 0.01, 0.072312]) {
      for (const q1q2 of [[-1, -1], [0, 0], [0, 1], [1, 1], [-1, -1]]) {
        for (const q of [1, 0]) {
          const a0 = -q;
          const a1 = 12 + q;
          const b0 = 4 - q;
          const b1 = 8 + q;
          const q1 = q1q2[0];
          const q2 = q1q2[1];
          const pointArrayA = [[8, 0], [4, 0], [a0, a0], [0, 4], [0, 8], [a0, 12],
          [4, 11], [8, 11], [a1, 12], [12, 8], [12, 4], [a1, a0], [8, 0]];
          const pointArrayB = [[8, q2], [4, q1], [b0, 4], [4, 7], [8, 7], [b1, 4], [8, q2]];
          for (const data of [pointArrayA, pointArrayB]) {
            for (const xy of data) {
              xy[1] += skewFactor * xy[0];
            }
          }
          runRegionTest(allGeometry, pointArrayA, pointArrayB, xBase, yBase);
          xBase += 100;
        }
        xBase += 200;
      }
      xBase = 0;
      yBase += 100;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Solids", "ParityRegionWithBadBoundary");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SectioningExample", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let xOut = 0.0;
    const yOut0 = 0.0;
    const allLines: CurvePrimitive[] = [];
    const ax = 10.0;
    const ax1 = ax + 1; // for mirror
    const ay1 = 1.0;
    const dy = 1.0;
    const ay2 = ay1 + dy;
    const by = 0.2;
    allLines.push(LineString3d.create([[0, 0], [ax, ay1], [ax, ay2], [0, ay1]]));
    for (const fraction of [0.0, 0.25, 0.5, 0.9]) {
      const x = fraction * ax;
      const y = fraction * ay1;   // "on" the lower line
      allLines.push(LineSegment3d.createXYXY(x, y - by, x, y + dy + by));
    }
    {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, allLines, xOut, yOut0);
      const regions = RegionOps.constructAllXYRegionLoops(allLines);
      saveShiftedLoops(allGeometry, regions, xOut, yOut0, 1.5 * dy);
    }

    xOut += 3 * ax;
    {
      // repeat with a mirrored set of polygons
      const n = allLines.length;
      const transform = Transform.createFixedPointAndMatrix(Point3d.create(ax1, 0, 0),
        Matrix3d.createScale(-1, 1.4, 1));
      for (let i = 0; i < n; i++)
        allLines.push(allLines[i].cloneTransformed(transform) as CurvePrimitive);

      const regions = RegionOps.constructAllXYRegionLoops(allLines);
      saveShiftedLoops(allGeometry, regions, xOut, yOut0, 10.5 * dy);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, allLines, xOut, yOut0);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "SectioningExample");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SectioningExampleFile", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    let y0 = 0.0;
    const dy = 2.0;
    const positiveLoopOffset = 0.005;
    // for (const baseName of ["sectionA", "sectionB", "sectionC", "sectionD", "sectionE", "sectionF"]) {
    // sectionA has half a bridge pier
    // sectionF is a mess of diagonals.
    for (const baseName of ["sectionA", "sectionB", "sectionC", "sectionD", "sectionE", "sectionF"]) {
      GeometryCoreTestIO.consoleLog({ baseName });
      const stringA = fs.readFileSync(`./src/test/testInputs/ChainCollector/sectionData00/${baseName}.imjs`, "utf8");
      const jsonA = JSON.parse(stringA);
      const section = IModelJson.Reader.parse(jsonA) as GeometryQuery[];
      const closedAreas: LineString3d[] = [];
      for (const g of section) {
        if (g instanceof LineString3d) {
          if (g.packedPoints.front()?.isAlmostEqualMetric(g.packedPoints.back()!)) {
            closedAreas.push(g);
            const centroid = PolygonOps.centroidAreaNormal(g.packedPoints);
            if (ck.testType(centroid, Ray3d) && Number.isFinite(centroid.a!)) {
              const areaNormal = PolygonOps.areaNormal(g.points);
              ck.testCoordinate(centroid.a!, areaNormal.magnitude(), "compare area methods");
            }
          }
        }

      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y0);
      const regions = RegionOps.constructAllXYRegionLoops(section as AnyRegion[]);
      saveShiftedLoops(allGeometry, regions, x0, y0 + dy, dy, positiveLoopOffset, false);
      x0 += 300.0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, closedAreas, x0, y0);
      const regionsB = RegionOps.constructAllXYRegionLoops((closedAreas as unknown) as AnyRegion[]);
      saveShiftedLoops(allGeometry, regionsB, x0, y0 + dy, dy, positiveLoopOffset, false);
      x0 = 0;
      y0 += 100.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "SectioningExampleFile");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SectioningLineStringApproach", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    let y0 = 0.0;
    const dy = 3.0;
    const minSearchDistance = 3.0;
    const distanceDisplayFactor = 1.25;
    // for (const baseName of ["sectionA", "sectionB", "sectionC", "sectionD", "sectionE", "sectionF"]) {
    for (const baseName of ["sectionC"]) {
      GeometryCoreTestIO.consoleLog({ baseName });
      const stringA = fs.readFileSync(`./src/test/testInputs/ChainCollector/sectionData00/${baseName}.imjs`, "utf8");
      const jsonA = JSON.parse(stringA);
      const section = IModelJson.Reader.parse(jsonA) as GeometryQuery[];
      const closedAreas: LineString3d[] = [];
      for (const g of section) {
        if (g instanceof LineString3d) {
          if (g.packedPoints.front()?.isAlmostEqualMetric(g.packedPoints.back()!)) {
            closedAreas.push(g);
          }
        }
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y0);
      y0 += dy;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, closedAreas, x0, y0);
      y0 += dy;
      for (let i = 0; i < closedAreas.length; i++) {
        for (let j = i + 1; j < closedAreas.length; j++) {
          const pairs = CurveCurve.closeApproachProjectedXYPairs(closedAreas[i], closedAreas[j], minSearchDistance);
          y0 += dy;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, closedAreas[i], x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, closedAreas[j], x0, y0);
          let numPoint = 0;
          let shortestPair: CurveLocationDetailPair | undefined;
          let shortestDistance = Number.MAX_VALUE;
          let numOverlap = 0;
          for (const p of pairs) {
            if (p.detailA.fraction1 !== undefined)
              numOverlap++;
            if (p.detailA.point.isAlmostEqual(p.detailB.point)) {
              GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, p.detailA.point, 0.05, x0, y0);
              numPoint++;
            } else {
              const d = p.detailA.point.distance(p.detailB.point);
              if (d < shortestDistance) {
                shortestDistance = d;
                shortestPair = p;
              }
            }
          }
          if (numOverlap > 0)
            GeometryCoreTestIO.consoleLog({ numOverlap, i, j });
          if (shortestPair && numPoint === 0)
            for (const p of pairs) {
              if (p.detailA.point.isAlmostEqual(p.detailB.point)) {
              } else {
                const d = p.detailA.point.distance(p.detailB.point);
                if (d < distanceDisplayFactor * shortestDistance) {
                  const arc = constructEllipseAroundSegment(p.detailA.point, p.detailB.point, 1.2, 0.2);
                  GeometryCoreTestIO.captureGeometry(allGeometry, arc, x0, y0);
                  GeometryCoreTestIO.captureCloneGeometry(allGeometry, [p.detailA.point, p.detailB.point], x0, y0);
                }
              }
            }
        }
      }
      x0 += 100.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "SectioningLineStringApproach");
    expect(ck.getNumErrors()).equals(0);
  });

  // In the input directories ...
  //  * MadhavInput.json is the whole input set for 5 sections.
  //  * sectionA..sectionE are splits of the separate sections.
  // Note that the corresponding .imjs files are reduced to linestrings and are accessed in other tests.
  // This is an example of custom data (linestring) parsing, and is included here for additional code coverage.
  it("SectioningJson", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    // cspell:word Madhav
    for (const baseName of ["sectionA", "sectionB", "sectionC", "sectionD", "sectionE", "MadhavInput"]) {
      GeometryCoreTestIO.consoleLog({ baseName });
      const stringA = fs.readFileSync(`./src/test/testInputs/ChainCollector/sectionData00/${baseName}.json`, "utf8");
      const jsonA = JSON.parse(stringA);
      const parser = new SectionDataParser();
      parser.parseAny(jsonA);
      GeometryCoreTestIO.consoleLog({ baseName, linestringCount: parser.allChains.length });
      let numOpen = 0;
      let numClosed = 0;
      for (const chain of parser.allChains) {
        if (chain.length > 0) {
          if (chain[0].isAlmostEqual(chain[chain.length - 1]))
            numClosed++;
          else
            numOpen++;
        }
      }
      GeometryCoreTestIO.consoleLog({ numOpen, numClosed });
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "SectioningLineStringApproach");
    expect(ck.getNumErrors()).equals(0);
  });

  it("NearTangencyUnion", () => {
    testSelectedTangencySubsets(true, 0, [-1], [], "Base");
    testSelectedTangencySubsets(false, 0, [],
      [
        [0, 13],
        [7, 20],
        [8, 21],
      ], "ArcSubsetsA");
    testSelectedTangencySubsets(false, 0, [],
      [
        [11, 12],
        [12, 13],
        [11, 13],
        [11, 15],
        [11, 16],
        [11, 17],
      ], "ArcSubsets");
    const allShuffles = [];
    const n = 13;
    for (let i0 = 0; i0 < n; i0 += 1) {
      allShuffles.push([i0, i0 + n]);
    }
    testSelectedTangencySubsets(false, 0, [], allShuffles, "ArcShuffle");
    testSelectedTangencySubsets(true, 0, [2, 3, 4, 7, 8], [], "FullPolygon");
    testSelectedTangencySubsets(true, [1, 2, 3, 4, 1], [2, 3, 4, 7, 8], [], "UpperSymmetricQuad");
    testSelectedTangencySubsets(false, [4, 5, 6, 7, 4], [-1], [], "LowerRightLobeQuadA");
    testSelectedTangencySubsets(false, [3, 5, 6, 8, 3], [-1], [], "LowerRightLobeQuadB");
  });

  // cspell:word laurynas
  it("BridgeEdgesAndDegenerateLoops", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    let xDelta = 0;
    let yDelta = 0;
    interface TestInput {
      jsonFilePath: string;
      expectedNumComponents: number;
      tolerance?: number;
      skipBoolean?: boolean;
    }
    // try various combinations of loops:
    // * null faces
    // * duplicate geometry
    // * multiple connected components
    // * almost-equal vertices
    // * holes
    // * polygons with vertices of degree > 2
    // * nearly-intersecting edges larger than default tol
    // * island-in-hole
    const testCases: TestInput[] = [
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion0.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion1.imjs", expectedNumComponents: 1 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion2.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion3.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion4.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion5.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion6.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion7.imjs", expectedNumComponents: 3 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion8.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasRegion9.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/disconnectedRegions.imjs", expectedNumComponents: 2 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoops.imjs", expectedNumComponents: 1 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoops.imjs", expectedNumComponents: 1, tolerance: 0.0001 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoopsSimplified.imjs", expectedNumComponents: 1 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoopsSimplified.imjs", expectedNumComponents: 1, tolerance: 0.0001 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoopsInRectangle.imjs", expectedNumComponents: 1 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoopsWithDanglers.imjs", expectedNumComponents: 1 },   // has doglegs of length 0.0001
      { jsonFilePath: "./src/test/testInputs/curve/laurynasLoopsWithoutDanglers.imjs", expectedNumComponents: 1 },
      { jsonFilePath: "./src/test/testInputs/curve/michelParityRegion.imjs", expectedNumComponents: 2 },  // has a small island in a hole!
      { jsonFilePath: "./src/test/testInputs/curve/laurynasCircularHole.imjs", expectedNumComponents: 1 },
      { jsonFilePath: "./src/test/testInputs/curve/laurynasCircularHole2.imjs", expectedNumComponents: 4, skipBoolean: true },  // without merge, 4 separate loops
    ];
    if (GeometryCoreTestIO.enableLongTests) {
      testCases.push({ jsonFilePath: "./src/test/testInputs/curve/michelLoops2.imjs", expectedNumComponents: 206 });                    // 2 minutes
      testCases.push({ jsonFilePath: "./src/test/testInputs/curve/michelLoops2.imjs", expectedNumComponents: 338, skipBoolean: true }); // 10 seconds
    }
    for (const testCase of testCases) {
      const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(testCase.jsonFilePath, "utf8"))) as Loop[];
      if (ck.testDefined(inputs, "inputs successfully parsed") && inputs) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs, x0, y0);
        const range: Range3d = Range3d.createFromVariantData(inputs.map((loop: Loop) => { return [loop.range().low, loop.range().high]; }));
        xDelta = 1.5 * range.xLength();
        yDelta = 1.5 * range.yLength();
        let merged: Loop[] | AnyRegion | undefined = inputs;
        if (!testCase.skipBoolean) {
          // Do a Boolean union of the inputs. This means holes will be lost! But that's OK, as we're only interested in the outer loop.
          // It is hard to use RegionOps.regionBooleanXY to discover holes: you have to know a priori how to separate the loops into arrays
          //    of solids and holes because both arrays undergo a hole-destroying Boolean union before the main (RegionBinaryOpType.Parity) operation.
          // RegionOps.sortOuterAndHoleLoopsXY can produce a Union/ParityRegion from loops, after which you know which loops are "holes".
          //    But if a hole loop intersects any other loop, you don't know its parity-rule-defined subregions because intersections aren't computed.
          merged = RegionOps.regionBooleanXY(inputs, undefined, RegionBinaryOpType.Union, testCase.tolerance);
          if (ck.testDefined(merged, "regionBooleanXY succeeded") && merged) {
            x0 += xDelta;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, merged, x0, y0);
            ck.testType(merged, UnionRegion, "regionBooleanXY produced a UnionRegion"); // note that merged preserves the constituents of the union!
          }
        }
        if (merged) {
          const signedLoops = RegionOps.constructAllXYRegionLoops(merged);
          ck.testExactNumber(testCase.expectedNumComponents, signedLoops.length, `UnionRegion has expected number of connected components: ${testCase.jsonFilePath}`);
          x0 += xDelta;
          for (const signedLoop of signedLoops) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, signedLoop.negativeAreaLoops, x0, y0);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, signedLoop.positiveAreaLoops, x0, y0, xDelta);
            ck.testExactNumber(1, signedLoop.negativeAreaLoops.length, `SignedLoop has one outer loop: ${testCase.jsonFilePath}`);
          }
        }
      }
      x0 = 0;
      y0 += yDelta;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "BridgeEdgesAndDegenerateLoops");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OverlappingArcs", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const delta = 12;

    // data for creating pairs of concentric arcs that intersect
    const center = Point3d.createZero();
    const vector0 = Vector3d.create(5, 2);
    const vector90 = Vector3d.create(2, -5);
    const testCases = [ // numOverlap is number of non-trivial coincident intervals
      { sweepStartA: 90, sweepEndA: 0, sweepStartB: 90, sweepEndB: 360, reverseB: false, numLoop: 1, numOverlap: 0 },
      { sweepStartA: 0, sweepEndA: 90, sweepStartB: 90, sweepEndB: 360, reverseB: false, numLoop: 1, numOverlap: 0 },
      { sweepStartA: 0, sweepEndA: 90, sweepStartB: 0, sweepEndB: -270, reverseB: false, numLoop: 1, numOverlap: 0 },
      { sweepStartA: 90, sweepEndA: 0, sweepStartB: 0, sweepEndB: -270, reverseB: false, numLoop: 1, numOverlap: 0 },
      { sweepStartA: 180, sweepEndA: 0, sweepStartB: 0, sweepEndB: 180, reverseB: true, numLoop: 1, numOverlap: 0 },  // Laurynas' original 2-arc circle
      { sweepStartA: 190, sweepEndA: -10, sweepStartB: 0, sweepEndB: 180, reverseB: true, numLoop: 1, numOverlap: 2 },
      { sweepStartA: 180, sweepEndA: 0, sweepStartB: -10, sweepEndB: 190, reverseB: true, numLoop: 1, numOverlap: 2 },
      { sweepStartA: 190, sweepEndA: 0, sweepStartB: 0, sweepEndB: 180, reverseB: true, numLoop: 1, numOverlap: 1 },
      { sweepStartA: 180, sweepEndA: 0, sweepStartB: -10, sweepEndB: 180, reverseB: true, numLoop: 1, numOverlap: 1 },
      { sweepStartA: 180, sweepEndA: 10, sweepStartB: 0, sweepEndB: 180, reverseB: true, numLoop: 0, numOverlap: 0 },
      { sweepStartA: 180, sweepEndA: 0, sweepStartB: 0, sweepEndB: 170, reverseB: true, numLoop: 0, numOverlap: 0 },
      { sweepStartA: 190, sweepEndA: 10, sweepStartB: 0, sweepEndB: 180, reverseB: true, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 180, sweepEndA: 0, sweepStartB: -10, sweepEndB: 170, reverseB: true, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 180, sweepStartB: 0, sweepEndB: 170, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 180, sweepStartB: 170, sweepEndB: 0, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 180, sweepStartB: 170, sweepEndB: 10, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 180, sweepStartB: 10, sweepEndB: 170, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 180, sweepStartB: 10, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 180, sweepStartB: 180, sweepEndB: 10, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 0, sweepEndA: 170, sweepStartB: 0, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 170, sweepEndA: 0, sweepStartB: 0, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 170, sweepEndA: 10, sweepStartB: 0, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 10, sweepEndA: 170, sweepStartB: 0, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 10, sweepEndA: 180, sweepStartB: 0, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
      { sweepStartA: 180, sweepEndA: 10, sweepStartB: 0, sweepEndB: 180, reverseB: false, numLoop: 0, numOverlap: 1 },
    ];
    for (const testCase of testCases) {
      const arcPair: Arc3d[] = [];
      const vector90B = testCase.reverseB ? vector90.negate() : vector90;
      arcPair.push(Arc3d.create(center, vector0, vector90, AngleSweep.createStartEndDegrees(testCase.sweepStartA, testCase.sweepEndA)));
      arcPair.push(Arc3d.create(center, vector0, vector90B, AngleSweep.createStartEndDegrees(testCase.sweepStartB, testCase.sweepEndB)));
      x0 = 0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcPair, x0, y0);
      const signedLoops = RegionOps.constructAllXYRegionLoops(arcPair);
      if (ck.testExactNumber(1, signedLoops.length, "Overlapping arcs yield one connected component.")) {
        ck.testExactNumber(testCase.numLoop, signedLoops[0].positiveAreaLoops.length, "SignedLoop has expected number of inner loops.");
        ck.testExactNumber(testCase.numLoop, signedLoops[0].negativeAreaLoops.length, "SignedLoop has expected number of outer loops.");
        for (const outerLoop of signedLoops[0].negativeAreaLoops)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, outerLoop, x0 += delta, y0);
        let expectedNumSliver = testCase.numOverlap;
        if (testCase.numLoop === 0)
          ++expectedNumSliver;
        ck.testExactNumber(expectedNumSliver, signedLoops[0].slivers.length, "SignedLoop has expected number of sliver faces.");
        for (const sliverLoop of signedLoops[0].slivers) {
          x0 += delta;
          for (const prim of sliverLoop.children)
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, prim, x0, y0);
        }
      }
      y0 += delta;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", "OverlappingArcs");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("PlaneAltitudeRangeContext", () => {
  it("OneAltitude", () => {
    const ck = new Checker();
    const linestring = LineString3d.createRectangleXY(Point3d.create(-2, -1), 5, 4, true);
    const opts = new InterpolationCurve3dOptions(linestring.points);
    opts.closed = true;
    opts.isChordLenKnots = 1;
    const fitCurve = InterpolationCurve3d.create(opts);
    const lsLoop = Loop.create(linestring);
    let lowHigh: Range1d | undefined;
    interface RayParam {
      ray: Vector3d | Ray3d;  // defines 0-altitude plane
      param: number;          // expected fractional projection parameter (for xy-plane geometry)
    }
    const rayParams: RayParam[] = [
      { ray: Vector3d.unitZ(), param: 0.0 },
      { ray: Ray3d.create(Point3d.create(0, 0, 5), Vector3d.unitZ()), param: -5.0 },
      { ray: Ray3d.create(Point3d.create(0, 0, -1), Vector3d.unitZ(3.0)), param: 1 / 3 },
    ];
    for (const geom of [lsLoop, linestring, lsLoop.getPackedStrokes(), linestring.points, fitCurve]) {
      for (const rayParam of rayParams) {
        if (geom instanceof CurveCollection)
          lowHigh = geom.projectedParameterRange(rayParam.ray, lowHigh);
        else if (geom instanceof CurvePrimitive)
          lowHigh = geom.projectedParameterRange(rayParam.ray, lowHigh);
        else if (undefined !== geom)
          lowHigh = PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(geom, rayParam.ray, lowHigh);
        if (ck.testDefined(lowHigh) && lowHigh) {
          ck.testFalse(lowHigh.isNull, "projection range computed");
          ck.testTrue(lowHigh.isSinglePoint, "projection range is single point");
          ck.testCoordinate(rayParam.param, lowHigh.low, "low projection as expected");
          ck.testCoordinate(rayParam.param, lowHigh.high, "high projection as expected");
        }
      }
    }
    const zero = Vector3d.createZero();
    ck.testUndefined(lsLoop.projectedParameterRange(zero), "CurveCollection projection range is undefined for undefined plane");
    ck.testUndefined(linestring.projectedParameterRange(zero), "CurvePrimitive projection range is undefined for undefined plane");
    ck.testUndefined(PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(linestring.points, zero), "points projection range is undefined for undefined plane");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClosedCurve", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const linestring = LineString3d.createRectangleXY(Point3d.create(-2, -1), 5, 4, true);
    const opts = new InterpolationCurve3dOptions(linestring.points);
    opts.closed = true;
    opts.isChordLenKnots = 1;
    const fitCurve = InterpolationCurve3d.create(opts);
    const fitCurveLoop = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/testInputs/curve/interpolationCurveLoop.imjs", "utf8"))) as Loop;
    const bCurve = BSplineCurve3d.createPeriodicUniformKnots(linestring.points, 3);
    const bCurveLoop = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/testInputs/curve/bsplineCurveLoop.imjs", "utf8"))) as Loop;
    const lsLoop = Loop.create(linestring);
    const circle = Arc3d.createCenterNormalRadius(Point3d.createZero(), Vector3d.unitZ(), 1.0);
    const diag = Vector3d.create(1, 1, 0).normalize()!;
    const minusDiag = diag.negate();
    const xyRay = Ray3d.create(Point3d.createZero(), diag);
    let lowHigh: Range1d | undefined;
    let x0 = 0;
    interface TestParams {
      geom: GeometryQuery;
      ray: Ray3d;
      minParam: number;
      maxParam: number;
      label: string;
    }
    const params: TestParams[] = [
      { geom: fitCurve!, ray: xyRay, minParam: -2.1249383598895526, maxParam: 4.246258703449196, label: "fitCurve" },
      { geom: fitCurveLoop, ray: xyRay, minParam: -2.7265388486929107, maxParam: 4.6879835021011536, label: "fitCurveLoop" },
      { geom: bCurve!, ray: xyRay, minParam: -1.3355667912298879, maxParam: 3.4568871347895316, label: "bCurve" },
      { geom: bCurveLoop, ray: xyRay, minParam: -3.5945409474105596, maxParam: 3.5804340252875075, label: "bCurveLoop" },
      { geom: lsLoop, ray: xyRay, minParam: - 1.5 * Math.sqrt(2), maxParam: 3 * Math.sqrt(2), label: "rectangle" },
      { geom: circle, ray: xyRay, minParam: -1, maxParam: 1, label: "circle-xy" },
      { geom: circle, ray: Ray3d.create(Point3d.create(2, 0), minusDiag), minParam: Math.sqrt(2) - 1, maxParam: Math.sqrt(2) + 1, label: "circle-xy2" },
      { geom: circle, ray: Ray3d.create(Point3d.create(1, -1), minusDiag), minParam: -1, maxParam: 1, label: "circle-xy3" },
      { geom: circle, ray: Ray3d.create(Point3d.create(0.5, -0.5), minusDiag), minParam: -1, maxParam: 1, label: "circle-xy4" },
      { geom: circle, ray: Ray3d.create(Point3d.createZero(), Vector3d.unitY()), minParam: -1, maxParam: 1, label: "circle-y" },
      { geom: circle, ray: Ray3d.create(Point3d.create(0.9, 0), Vector3d.unitX(-1)), minParam: -0.1, maxParam: 1.9, label: "circle-x" },
    ];
    for (const param of params) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [param.geom, LineSegment3d.create(param.ray.origin, param.ray.fractionToPoint(1.0))], x0);
      x0 += 10;
      lowHigh = undefined;
      if (param.geom instanceof CurveCollection)
        lowHigh = param.geom.projectedParameterRange(param.ray, lowHigh);
      else if (param.geom instanceof CurvePrimitive)
        lowHigh = param.geom.projectedParameterRange(param.ray, lowHigh);
      if (ck.testDefined(lowHigh) && lowHigh) {
        ck.testFalse(lowHigh.isNull, `${param.label} projection range computed`);
        ck.testCoordinate(param.minParam, lowHigh.low, `${param.label} low projection as expected`);
        ck.testCoordinate(param.maxParam, lowHigh.high, `${param.label} high projection as expected`);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Curves", "ClosedCurveProjectionToRay");
    expect(ck.getNumErrors()).equals(0);
  });
});

function testSelectedTangencySubsets(
  doImmediateFullBoolean: boolean,
  linestringSimplification: number | number[],
  arcSimplificationIndices: number[],
  arcCyclicIndexRanges: number[][], // POSITIVE indices for (k = first; k < last; k++) loop.   Will be modulo'ed into range for access
  outputFileSuffix: string) {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/testInputs/curve/areaBoolean/AreaBoolean.716145.Inputs.imjs", "utf8"))) as AnyRegion[];
  // const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/testInputs/curve/areaBoolean/AreaBoolean.716145.RemoveShortSegment.imjs", "utf8"))) as AnyRegion[];
  let x0 = 0;
  let y0 = 0;
  const delta = 150;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs, x0, y0);
  x0 += 3 * delta;
  if (inputs[0] instanceof Loop && inputs[0].children[0] instanceof LineString3d) {
    inputs[0].children[0] = simplifyLineString(inputs[0].children[0], linestringSimplification);
  }
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs, x0, y0);
  captureShiftedClones(allGeometry, inputs, x0, y0, delta, 0);
  if (doImmediateFullBoolean) {
    exerciseAreaBooleans([inputs[0]], [inputs[1]], ck, allGeometry, 0, 0, false);
  }
  x0 += 4 * delta;
  // Extract each arc (with closure chord) as an independent parameter..
  const loop = inputs[1];
  //    const indicesToTest = [2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  const ex = 0.01;
  const ey = 0.0;
  if (loop instanceof Loop) {
    for (const index of arcSimplificationIndices) {
      y0 = 0;
      x0 += 5 * delta;
      if (index < 0) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs, x0, y0);
        const result = RegionOps.regionBooleanXY(inputs[0], inputs[1], RegionBinaryOpType.Union);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, result, x0, y0 + delta);
        continue;
      }
      const child = loop.children[index];
      if (child instanceof Arc3d && !child.sweep.isFullCircle) {
        y0 += delta * 2;
        const segment1 = LineSegment3d.create(child.endPoint(), child.startPoint());
        const arc1 = child.clone();
        const loop1 = Loop.create(arc1, segment1);
        captureShiftedClones(allGeometry, [inputs[0], loop1], x0, y0, delta, 0);
        y0 += delta;
        const result1 = RegionOps.regionBooleanXY(inputs[0], loop1, RegionBinaryOpType.Union);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, result1, x0, y0);
        const tryShifted = false;
        if (tryShifted) {
          loop1.tryTranslateInPlace(ex, ey);
          const result2 = RegionOps.regionBooleanXY(inputs[0], loop1, RegionBinaryOpType.Union);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, result2, x0 + delta, y0);
        }
      } else if (child instanceof LineSegment3d) {
        const a = child.curveLength();
        GeometryCoreTestIO.consoleLog({ segment: IModelJson.Writer.toIModelJson(child), a });
      }
    }
  }
  if (arcCyclicIndexRanges.length > 0) {
    x0 += 5 * delta;
    y0 = 0;
    const circleRadius = 1.0;
    // Extract each arc (with closure chord) as an independent parameter..
    if (loop instanceof Loop) {
      const n = loop.children.length;
      for (const indexRange of arcCyclicIndexRanges) {
        const subsetLoop = new Loop();
        if (indexRange[0] + n < indexRange[1]) {
          GeometryCoreTestIO.consoleLog(`Ignoring index range ${indexRange}`);
          continue;
        }
        for (let k = indexRange[0]; k < indexRange[1]; k++) {
          const i = k % n;
          const child = loop.children[i];
          subsetLoop.children.push(child);
        }
        const n1 = subsetLoop.children.length;
        const pointA = subsetLoop.children[n1 - 1].fractionToPoint(1.0);
        const pointB = subsetLoop.children[0].startPoint();
        const pointC = pointA.plusXYZ(-40, 0, 0);
        const pointD = pointA.plusXYZ(0, -40, 0);
        const segment1 = LineSegment3d.create(pointA, pointB);
        subsetLoop.children.push(segment1);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointD, pointA, pointC], x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, subsetLoop, x0, y0, 0);
        y0 += delta;
        captureShiftedClones(allGeometry, [inputs[0], subsetLoop], x0, y0, delta, 0);
        y0 += delta;
        const result1 = RegionOps.regionBooleanXY(inputs[0], subsetLoop, RegionBinaryOpType.Union);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, result1, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, -8, pointA, circleRadius, x0, y0, 0);
        y0 += 2 * delta;
      }
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "RegionBoolean", `NearTangencyUnion${outputFileSuffix}`);
  expect(ck.getNumErrors()).equals(0);
}

/**
*
* @param allGeometry array to receive (cloned) geometry
* @param components geometry to output
* @param x0 x shift for positive area loops
* @param y0 y shift for positive area loops
* @param dy additional y shift for (1 step) negative loops, (2 steps) non-loop geometry, (3 step) inward offsets of positive area geometry.
* @param y1 y shift for negative loops and stray geometry
*/
function saveShiftedLoops(allGeometry: GeometryQuery[], components: SignedLoops | SignedLoops[], x0: number, y0: number, dy: number, positiveLoopOffset: number = 0.02,
  doTriangulation: boolean = true) {
  if (Array.isArray(components)) {
    const allNegativeAreaLoops: Loop[] = [];
    for (const member of components) {
      saveShiftedLoops(allGeometry, member, x0, y0, dy, positiveLoopOffset);
      allNegativeAreaLoops.push(...member.negativeAreaLoops);
    }
    if (doTriangulation && allNegativeAreaLoops.length > 1) {
      const yOut = y0 + dy;
      // form a triangulation of a larger area -- interior edges will be interesting relationships
      const range = Range3d.createNull();
      for (const loop of allNegativeAreaLoops)
        range.extendRange(loop.range());
      const maxSide = Math.max(range.xLength(), range.yLength());
      const expansionDistance = 0.25 * maxSide;
      const range1 = range.clone();
      range.expandInPlace(expansionDistance);
      range1.expandInPlace(0.9 * expansionDistance);
      // triangulate all the way to the expanded range.
      const outerLoop = Loop.createPolygon(range.rectangleXY(0.0)!);
      const regionLoops = [outerLoop, ...allNegativeAreaLoops];
      const region = ParityRegion.createLoops(regionLoops);
      const builder = PolyfaceBuilder.create();
      builder.addTriangulatedRegion(region);
      const polyface = builder.claimPolyface();
      // any triangle with a point outside range1 is extraneous
      const isInteriorFacet = (visitor: PolyfaceVisitor): boolean => {
        const facetRange = visitor.point.getRange();
        return range1.containsRange(facetRange);
      };
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceQuery.cloneFiltered(polyface, isInteriorFacet), x0, yOut);
    }
  } else {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, components.positiveAreaLoops, x0, y0 + 2 * dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, components.negativeAreaLoops, x0, y0 + 3 * dy);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, components.slivers, x0, y0 + 4 * dy);
    if (positiveLoopOffset !== 0.0) {
      const yy = y0 + dy;
      const zz = 0.01;    // raise the tic marks above the faces
      for (const loop of components.positiveAreaLoops) {
        const offsetLoop = RegionOps.constructCurveXYOffset(loop, positiveLoopOffset);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetLoop, x0, yy);
      }
      // draw a tic mark: midpoint to fractional position along an edge then leading "to the left" of the edge.
      const drawEdgeTic = (curve: CurvePrimitive | undefined, loop: Loop | undefined, fraction: number) => {
        if (curve) {
          const curveLength = curve.quickLength();
          let ticMultiplier = 3.0;
          if (loop !== undefined
            && (loop as any).computedAreaInPlanarSubdivision !== undefined
            && (loop as any).computedAreaInPlanarSubdivision < 0.0)
            ticMultiplier = 6.0;
          const ticLength = Math.min(0.2 * curveLength, ticMultiplier * positiveLoopOffset);
          const tangentRayAtTicMark = curve.fractionToPointAndUnitTangent(fraction);
          const midPoint = curve.fractionToPoint(0.5);
          const perp = tangentRayAtTicMark.direction.unitPerpendicularXY();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry,
            [midPoint, tangentRayAtTicMark.origin, tangentRayAtTicMark.origin.plusScaled(perp, ticLength)],
            x0, yy, zz,
          );
        }
      };
      if (components.edges) {
        for (const e of components.edges) {
          drawEdgeTic(e.curveA, e.loopA, 0.48);
          drawEdgeTic(e.curveB, e.loopB, 0.48);
        }
      }
    }
  }
}

function runRegionTest(allGeometry: GeometryQuery[], pointArrayA: number[][], pointArrayB: number[][], xBase: number, yBase: number) {
  let x0 = xBase;
  let y0 = yBase;
  const loopA = Loop.createPolygon(GrowableXYZArray.create(pointArrayA));
  // loopA.reverseChildrenInPlace();
  const loopB = Loop.createPolygon(GrowableXYZArray.create(pointArrayB));
  // loopB.reverseChildrenInPlace();
  const region = ParityRegion.create();
  region.tryAddChild(loopA);
  region.tryAddChild(loopB);
  // Output geometry:
  //                    polygonXYAreaDifferenceLoopsToPolyface OffsetsOfPositives
  //    Mesh            polygonXYAreaUnionLoopsToPolyface      SliverAreas
  //    SweptSolid                                             NegativeAreas
  //    ParityRegionA   ParityRegionB                          PositiveAreas      <repeat stack per connected component>
  // Where ParityRegionA is by direct assembly of loops, let downstream sort.
  //       ParityRegionB is assembled by sortOuterAndHoleLoopsXY
  //
  const solid = LinearSweep.create(region, Vector3d.create(0, 0, 1), true)!;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0, y0);
  y0 += 15;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, solid, x0, y0);
  const builder = PolyfaceBuilder.create();
  builder.addLinearSweep(solid);
  const mesh = builder.claimPolyface();
  const mesh1 = PolyfaceQuery.cloneByFacetDuplication(mesh, true, DuplicateFacetClusterSelector.SelectOneByParity);
  y0 += 15;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);
  y0 += 15;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, x0, y0);

  const sortedLoops = RegionOps.sortOuterAndHoleLoopsXY([loopA, loopB]);
  x0 += 20;
  y0 = yBase;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, sortedLoops, x0, y0);
  y0 += 40;
  let y1 = y0 + 100;
  if (Checker.noisy.parityRegionAnalysis) {
    RegionOps.setCheckPointFunction(
      (name: string, graph: HalfEdgeGraph, _properties: string, _extraData?: any) => {
        GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y1 += 15);
        const euler = graph.countVertexLoops() - graph.countNodes() / 2.0 + graph.countFaceLoops();
        GeometryCoreTestIO.consoleLog(` Checkpoint ${name}.${_properties}`,
          { v: graph.countVertexLoops(), e: graph.countNodes(), f: graph.countFaceLoops(), eulerCharacteristic: euler });
        GraphChecker.dumpGraph(graph);
      });
  }
  const unionRegion = RegionOps.polygonXYAreaUnionLoopsToPolyface(pointArrayA, pointArrayB);
  RegionOps.setCheckPointFunction();
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionRegion, x0, y0);
  y0 += 20;
  const diffRegion = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(pointArrayA, pointArrayB);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, diffRegion, x0, y0);

  x0 += 15;
  y0 = yBase;
  const fixedRegions = RegionOps.constructAllXYRegionLoops(region);
  saveShiftedLoops(allGeometry, fixedRegions, x0, y0, 15.0);
}
/**
 * Intersect a plane with each primitive of a loop.
 * If any intersection is coincident, or at an endpoint, return undefined.
 * Otherwise (the good case!) return the intersection sorted as in-out pairs.
function findSimpleLoopPlaneCuts(loop: Loop, plane: Plane3dByOriginAndUnitNormal, fractionTol: number = 0.001): CurveLocationDetail[] | undefined {
  const cuts: CurveLocationDetail[] = [];
  let farDetail: CurveLocationDetail | undefined;
  const origin = plane.getOriginRef();
  for (const p of loop.children) {
    const num0 = cuts.length;
    p.appendPlaneIntersectionPoints(plane, cuts);
    for (let i = num0; i < cuts.length; i++) {
      const f = cuts[i].fraction;
      if (f < fractionTol || f + fractionTol > 1.0)
        return undefined;
      const tangentRay = cuts[i].curve?.fractionToPointAndDerivative(f)!;
      if (plane.getNormalRef().isPerpendicularTo(tangentRay.direction))
        return undefined;
      cuts[i].a = origin.distance(cuts[i].point);
      if (farDetail === undefined || cuts[i].a > farDetail.a)
        farDetail = cuts[i];
    }
  }
  if (cuts.length >= 2 && !Geometry.isOdd(cuts.length) && farDetail) {
    const sortVector = Vector3d.createStartEnd(plane.getOriginRef(), farDetail.point);
    for (const cut of cuts)
      cut.a = sortVector.dotProductStartEnd(origin, cut.point);
    cuts.sort((cutA: CurveLocationDetail, cutB: CurveLocationDetail) => (cutB.a - cutA.a));
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      if (Geometry.isSameCoordinate(cuts[i].a, cuts[i + 1].a))
        return undefined;
    }
    // ah, the cuts have been poked an prodded and appear to be simple pairs . .
    return cuts;
  }
  return undefined;
}
*/
/**
 * * Construct (by some unspecified means) a point that is inside the loop.
 * * Pass that point to the `accept` function.
 * * If the function returns a value (other than undefined) return that value.
 * * If the function returns undefined, try further points.
 * * The point selection process is unspecified.   For instance,
 * @param loop
 * @param accept
function classifyLoopByAnyInternalPoint<T>(loop: Loop, accept: (loop: Loop, testPoint: Point3d) => T | undefined): T | undefined {
  const testFractions = [0.321345, 0.921341276, 0.5, 0.25];
  for (const f of testFractions) {
    for (let primitiveIndex = 0; primitiveIndex < loop.children.length; primitiveIndex++) {
      const detail = loop.primitiveIndexAndFractionToCurveLocationDetailPointAndDerivative(primitiveIndex, f, false);
      if (detail) {
        const cutPlane = Plane3dByOriginAndUnitNormal.create(detail.point, detail.vectorInCurveLocationDetail!);
        if (cutPlane) {
          const cuts = findSimpleLoopPlaneCuts(loop, cutPlane);
          if (cuts && cuts.length >= 2) {
            const q = accept(loop, cuts[0].point.interpolate(0.5, cuts[1].point));
            if (q !== undefined)
              return q;
          }
        }
      }
    }
  }
  return undefined;
}
/*
function classifyAreasByAnyInternalPoint(candidates: Loop[], accept: (loop: Loop, testPoint: Point3d) => boolean): Loop[] {
  const acceptedLoops: Loop[] = [];
  const testFractions = [0.321345, 0.921341276, 0.5, 0.25];
  for (const loop of candidates) {
    if (classifyLoopByAnyInternalPoint(loop, accept) !== undefined)
      acceptedLoops.push(loop);
  }
  return acceptedLoops;
}
*/
describe("GeneralSweepBooleans", () => {
  it("Rectangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 5, 7, 0, true)));
    const rectangle1B = Loop.create(LineString3d.create(Sample.createRectangle(-2, -2, 8, 7, 0, true)));
    const rectangle2 = Loop.create(LineString3d.create(Sample.createRectangle(1, 1, 6, 2, 0, true)));
    const area3 = Loop.create(
      LineSegment3d.createXYXY(2, 1.5, 5, 2.5), LineSegment3d.createXYXY(5, 2.5, 5, 3),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(5, 3, 0), Point3d.create(4, 4, 0), Point3d.create(2, 3, 0))!,
      LineSegment3d.createXYXY(2, 3, 2, 1.5));
    const area4 = Loop.create(
      LineSegment3d.createXYXY(-1, -1, -1, 9),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(-1, 9), Point3d.create(4, 4, 0), Point3d.create(-1, -1))!);
    const area5 = Loop.create(
      LineSegment3d.createXYXY(-1, 1, -1, 6),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(-1, 6), Point3d.create(1, 3.5), Point3d.create(-1, 1))!);
    const xStep = 20.0;
    let y0 = 0;
    for (const rectangle1 of [rectangle1B, rectangle1A, rectangle1B]) {
      let x0 = -xStep;
      exerciseAreaBooleans([rectangle1], [area5], ck, allGeometry, x0 += xStep, y0, false);
      exerciseAreaBooleans([rectangle1], [area5], ck, allGeometry, x0 += xStep, y0, false);
      exerciseAreaBooleans([rectangle1], [area5], ck, allGeometry, x0 += xStep, y0, false);
      exerciseAreaBooleans([rectangle1], [rectangle2], ck, allGeometry, x0 += xStep, y0, false);
      exerciseAreaBooleans([rectangle1], [rectangle2, area3], ck, allGeometry, x0 += xStep, y0, false);
      exerciseAreaBooleans([rectangle1], [area4], ck, allGeometry, x0 += xStep, y0, false);
      y0 += 100;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "Rectangles");
    expect(ck.getNumErrors()).equals(0);
  });
  it("HighParityRectangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const outerLoop = [[0, 0, 1], [0, 4, 1], [0, 4, 1], [0, 8, 1], [0, 8, 1], [0, 12, 1], [0, 12, 1], [0, 16, 1], [0, 16, 1], [0, 20, 1], [0, 20, 1], [0, 24, 1], [0, 24, 1], [4, 24, 1], [4, 24, 1], [4, 20, 1], [4, 20, 1], [4, 16, 1], [4, 16, 1], [4, 12, 1], [4, 12, 1], [4, 8, 1], [4, 8, 1], [4, 4, 1], [4, 4, 1], [4, 0, 1], [4, 0, 1], [0, 0, 1]];
    const inner1 = [[0, 4, 1], [4, 4, 1], [4, 4, 1], [4, 8, 1], [4, 8, 1], [4, 12, 1], [4, 12, 1], [4, 16, 1], [4, 16, 1], [4, 20, 1], [4, 20, 1], [0, 20, 1], [0, 20, 1], [0, 16, 1], [0, 16, 1], [0, 12, 1], [0, 12, 1], [0, 8, 1], [0, 8, 1], [0, 4, 1]];
    const inner2 = [[0, 8, 1], [4, 8, 1], [4, 8, 1], [4, 12, 1], [4, 12, 1], [0, 12, 1], [0, 12, 1], [0, 8, 1]];
    //   const inner3 = [[0, 12, 1], [4, 12, 1], [4, 12, 1], [4, 16, 1], [4, 16, 1], [0, 16, 1], [0, 16, 1], [0, 12, 1]];
    const inner3 = [[0, 12, 1], [3, 12, 1], [3, 12, 1], [3, 16, 1], [3, 16, 1], [0, 16, 1], [0, 16, 1], [0, 12, 1]];
    let x0 = 0;
    for (const innerLoops of [[inner1], [inner2], [inner3], [inner1, inner2], [inner1, inner3], [inner1, inner2, inner3]]) {
      const x1 = x0 + 10;
      const x2 = x0 + 20;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(outerLoop), x0, 0);
      for (const inner of innerLoops)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(inner), x0, 0);

      const regionDiff = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(outerLoop, innerLoops);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, regionDiff, x1, 0);
      const regionParity = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(outerLoop, innerLoops);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, regionParity, x2, 0);
      x0 += 50;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "HighParityRectangles");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Disjoints", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lowRectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 3, 1, 0, true)));
    const highRectangle = Loop.create(LineString3d.create(Sample.createRectangle(0, 3, 2, 4, 0, true)));
    const tallRectangleA = Loop.create(LineString3d.create(Sample.createRectangle(1, -1, 2, 5, 0, true)));
    const tallRectangleB = Loop.create(LineString3d.create(Sample.createRectangle(1, -1, 1.5, 5, 0, true)));
    exerciseAreaBooleans([lowRectangle], [highRectangle], ck, allGeometry, 0, 0, false);
    exerciseAreaBooleans([tallRectangleA], [lowRectangle, highRectangle], ck, allGeometry, 10, 0, false);
    exerciseAreaBooleans([tallRectangleB], [lowRectangle, highRectangle], ck, allGeometry, 20, 0, false);
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "Disjoints");
    expect(ck.getNumErrors()).equals(0);
  });

  it("MBDisjointCover", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const outer = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/outer.imjs", "utf8"))) as AnyRegion[];
    const inner = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/inner.imjs", "utf8"))) as AnyRegion[];
    let x0 = 0;
    const dy = 50;
    // for (const entry of outer) {
    //   RegionOps.consolidateAdjacentPrimitives(entry);
    // }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, outer, x0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, inner, x0, 50);
    const dx = 100.0;
    exerciseAreaBooleans(outer, inner, ck, allGeometry, (x0 += dx), -dy, false);
    for (const a of outer) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, a, x0 += 2 * dx, 0);
      for (const b of inner) {
        exerciseAreaBooleans([a], [b], ck, allGeometry, x0 += dx, 0, false);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "MBDisjointCover");
    expect(ck.getNumErrors()).equals(0);
  });
  it("HoleInA", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    const rectangle1B = Loop.create(LineString3d.create(Sample.createRectangle(1, 1, 9, 7, 0, true)));
    const region = ParityRegion.create(rectangle1A, rectangle1B);
    const dx = 20.0;
    let x0 = 0;
    for (const yB of [-0.5, 0.5, 6.5, 7.5, 3.0]) {
      const rectangle2 = Loop.create(LineString3d.create(Sample.createRectangle(5, yB, 6, yB + 1, 0, true)));
      exerciseAreaBooleans([region], [rectangle2], ck, allGeometry, x0 += dx, 0, false);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "HoleInA");
    expect(ck.getNumErrors()).equals(0);
  });
  it("FullCircle", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;

    {
      const circleA = Loop.create(Arc3d.createXY(Point3d.create(0, 0), 5));
      const circleB = Loop.create(Arc3d.createXY(Point3d.create(4, 0), 5));
      exerciseAreaBooleans([circleB], [circleA], ck, allGeometry, x0, 0, false);
      x0 += 20;
    }
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    for (const cx of [1, 5]) {
      const loopB = Loop.create(Arc3d.createXY(Point3d.create(cx, 5), 2));
      exerciseAreaBooleans([rectangle1A], [loopB], ck, allGeometry, x0, 0, false);
      x0 += 20;
    }
    for (const startDegrees of [0, 90]) {
      for (const cx of [1, 5]) {
        const arc0 = Arc3d.createXY(Point3d.create(cx, 5), 2, AngleSweep.createStartEndDegrees(startDegrees, 180));
        const arc1 = Arc3d.createXY(Point3d.create(cx, 5), 2, AngleSweep.createStartEndDegrees(180, 360));
        if (startDegrees === 0) {
          const loopB = Loop.create(arc0, arc1);
          exerciseAreaBooleans([rectangle1A], [loopB], ck, allGeometry, x0, 0, false);
        } else {
          const closureSegment = LineSegment3d.create(arc1.endPoint(), arc0.startPoint());
          const loopB = Loop.create(closureSegment, arc0, arc1);
          exerciseAreaBooleans([rectangle1A], [loopB], ck, allGeometry, x0, 0, false);
        }
        x0 += 20;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "FullCircle");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SharedEdgeElimination", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let y0 = 0;
    let x0 = 0;
    const rectangle1A = Loop.create(LineString3d.create(Sample.createRectangle(0, 0, 10, 8, 0, true)));
    const rectangle1B = Loop.create(LineString3d.create(Sample.createRectangle(10, 0, 15, 8, 0, true)));
    const rectangle1C = Loop.create(LineString3d.create(Sample.createRectangle(5, 5, 12, 10, 0, true)));

    y0 = 0;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1A, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1B, x0, y0);
    y0 += 10;
    const rectangleArray = [rectangle1A.getPackedStrokes()!, rectangle1B.getPackedStrokes()!];
    const fixup2 = RegionOps.polygonBooleanXYToLoops(rectangleArray, RegionBinaryOpType.Union, []);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixup2, x0, y0, 0);

    x0 += 30;
    y0 = 0;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1A, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1B, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangle1C, x0, y0);
    y0 += 15;
    rectangleArray.push(rectangle1C.getPackedStrokes()!);
    const fixup3 = RegionOps.polygonBooleanXYToLoops(rectangleArray, RegionBinaryOpType.Union, []);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixup3, x0, y0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "SharedEdgeElimination");
    expect(ck.getNumErrors()).equals(0);
  });

  it("DocDemo", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const filletedRectangle = CurveFactory.createRectangleXY(0, 0, 5, 4, 0, 1);
    const splitter = CurveFactory.createRectangleXY(1, -1, 6, 2);
    const union = RegionOps.regionBooleanXY(filletedRectangle, splitter, RegionBinaryOpType.Union);
    const intersection = RegionOps.regionBooleanXY(filletedRectangle, splitter, RegionBinaryOpType.Intersection);
    const diff = RegionOps.regionBooleanXY(filletedRectangle, splitter, RegionBinaryOpType.AMinusB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, filletedRectangle, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, splitter, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, union, 0, 10);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, intersection, 0, 20);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, diff, 0, 30);

    const manyRoundedRectangles = [];
    for (let a = 0; a < 5; a += 1) {
      manyRoundedRectangles.push(CurveFactory.createRectangleXY(a, a, a + 4, a + 1.75, 0, 0.5));
    }
    const splitterB0 = CurveFactory.createRectangleXY(0.5, 0.4, 6, 2.1, 0, 0);
    const splitterB1 = splitterB0.cloneTransformed(Transform.createFixedPointAndMatrix({ x: 1, y: 2, z: 0 }, Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(40)))) as Loop;
    const splitterB = [splitterB0, splitterB1];
    const unionB = RegionOps.regionBooleanXY(manyRoundedRectangles, splitterB, RegionBinaryOpType.Union);
    const intersectionB = RegionOps.regionBooleanXY(manyRoundedRectangles, splitterB, RegionBinaryOpType.Intersection);
    const diffB = RegionOps.regionBooleanXY(manyRoundedRectangles, splitterB, RegionBinaryOpType.AMinusB);
    const xB = 10;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, manyRoundedRectangles, xB, -20);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, splitterB, xB, -10);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, manyRoundedRectangles, xB, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, splitterB, xB, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, unionB, xB, 10);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, intersectionB, xB, 20);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, diffB, xB, 30);

    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "DocDemo");
    expect(ck.getNumErrors()).equals(0);
  });
  it("FacetPasting", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const loopA = GrowableXYZArray.create([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]);  // Missing closure !!!
    const loopB = GrowableXYZArray.create([[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]]);  // Missing closure !!!
    const loop = RegionOps.polygonBooleanXYToLoops([loopA, loopB], RegionBinaryOpType.Union, []);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopA, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopB, 0, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, 4, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "sweepBooleans", "FacetPasting");
    expect(ck.getNumErrors()).equals(0);
  });
});

function exerciseAreaBooleans(dataA: AnyRegion[], dataB: AnyRegion[],
  ck: Checker, allGeometry: GeometryQuery[], x0: number, y0Start: number, showVertexNeighborhoods: boolean) {
  const areas = [];
  const range = RegionOps.curveArrayRange(dataA.concat(dataB));
  const yStep = Math.max(15.0, 2.0 * range.yLength());
  let y0 = y0Start;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, dataA, x0, y0);
  y0 += yStep;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, dataB, x0, y0);
  const vertexNeighborhoodFunction = (edgeData: VertexNeighborhoodSortData[]) => {
    GeometryCoreTestIO.consoleLog({ nodeCount: edgeData.length });
    for (const data of edgeData) {
      GeometryCoreTestIO.consoleLog(` id: ${data.node.id}  x: ${data.node.x}, y: ${data.node.y}, theta: ${data.radians}, curvature: ${data.radiusOfCurvature} `);
    }
  };
  for (const opType of [RegionBinaryOpType.Union, RegionBinaryOpType.Intersection, RegionBinaryOpType.AMinusB, RegionBinaryOpType.BMinusA]) {
    y0 += yStep;
    if (showVertexNeighborhoods && opType === RegionBinaryOpType.Union)
      HalfEdgeGraphMerge.announceVertexNeighborhoodFunction = vertexNeighborhoodFunction;
    const result = RegionOps.regionBooleanXY(dataA, dataB, opType);
    if (showVertexNeighborhoods)
      HalfEdgeGraphMerge.announceVertexNeighborhoodFunction = undefined;
    areas.push(RegionOps.computeXYArea(result!)!);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, result, x0, y0);
  }
  const area0 = areas[0]; // union
  const area123 = areas[1] + areas[2] + areas[3];
  ck.testCoordinate(area0, area123, " UnionArea = sum of parts");
}
/**
 * Return an ellipse the loops around a segment.
 * @param fractionAlong = axis length in AB direction, as a multiple of distance from center to pointA
 * @param fractionPerp = axis length perpendicular to AB direction, as as multiple of distance from center to pointA
 */
function constructEllipseAroundSegment(pointA: Point3d, pointB: Point3d, fractionAlong: number, fractionPerp: number) {
  const center = pointA.interpolate(0.5, pointB);
  const vector0 = Vector3d.createStartEnd(center, pointA);
  const vector90 = vector0.rotate90CCWXY();
  vector0.scaleInPlace(fractionAlong);
  vector90.scaleInPlace(fractionPerp);
  return Arc3d.create(center, vector0, vector90);
}

class SectionDataParser extends PointStreamXYZHandlerBase {

  public allChains: Point3d[][] = [];
  private _currentChain?: Point3d[];
  public override startChain(_chainData: MultiLineStringDataVariant, _isLeaf: boolean): void {
    this._currentChain = [];
  }
  public override handleXYZ(x: number, y: number, z: number): void {
    this._currentChain!.push(Point3d.create(x, y, z));
  }
  public override endChain(_chainData: MultiLineStringDataVariant, _isLeaf: boolean): void {
    if (this._currentChain !== undefined && this._currentChain.length > 0)
      this.allChains.push(this._currentChain);
    this._currentChain = undefined;
  }

  public parseGeometries(data: any[]) {
    if (Array.isArray(data)) {
      VariantPointDataStream.streamXYZ(data, this);
    }
  }
  public parseElements(elements: any[]) {
    for (const e of elements)
      if (Array.isArray(e.geometries)) {
        this.parseGeometries(e.geometries);
      }
  }
  public parseAny(data: any, depth: number = 0) {
    if (Array.isArray(data)) {
      GeometryCoreTestIO.consoleLog({ sectionDataArrayLength: data.length, depth });
      for (const d of data)
        this.parseAny(d, depth + 1);
    } else if (data instanceof Object) {
      if (Number.isFinite(data.distanceAlong)) {
        if (Array.isArray(data.elements))
          GeometryCoreTestIO.consoleLog({
            distanceAlong: data.distanceAlong, direction: data.direction,
            numElements: data.elements.length,
          });
        this.parseElements(data.elements);

      }
    }
  }
}

function captureShiftedClones(allGeometry: GeometryQuery[], newGeometry: GeometryQuery[], x0: number, y0: number, dx: number, dy: number) {
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, newGeometry, x0, y0);
  for (const g of newGeometry) {
    x0 += dx;
    y0 += dy;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, g, x0, y0);
  }

}
function simplifyLineString(ls: LineString3d, select: number | number[]): LineString3d {
  if (Array.isArray(select)) {
    const points = [];
    for (const index of select)
      points.push(ls.pointAt(index));
    return LineString3d.create(points);
  } else if (select === 1) {
    // Return a quad that includes a critical vertex for tangency problems
    const smallLineString = LineString3d.create(ls.pointAt(0), ls.pointAt(5), ls.pointAt(7), ls.pointAt(8), ls.pointAt(0));
    return smallLineString;
  } else if (select === 2) {
    return LineString3d.create(PolylineOps.compressByChordError(ls.points, Geometry.smallMetricDistance));
  }
  return ls;
}
