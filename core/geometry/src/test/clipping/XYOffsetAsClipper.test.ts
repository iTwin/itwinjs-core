/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";

import { Checker } from "../Checker";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Range3d } from "../../geometry3d/Range";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineString3d } from "../../curve/LineString3d";
import { UnionOfConvexClipPlaneSets } from "../../clipping/UnionOfConvexClipPlaneSets";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { CurveChain, CurveCollection } from "../../curve/CurveCollection";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { IndexedPolyface } from "../../polyface/Polyface";
import { Angle } from "../../geometry3d/Angle";
import { OffsetHelpers } from "../../curve/internalContexts/MultiChainCollector";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { Path } from "../../curve/Path";
import { ClippedPolyfaceBuilders, PolyfaceClip } from "../../polyface/PolyfaceClip";
import { JointOptions } from "../../curve/internalContexts/PolygonOffsetContext";
import { CurveFactory } from "../../curve/CurveFactory";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Arc3d } from "../../curve/Arc3d";
import { Sample } from "../../serialization/GeometrySamples";
import { SweepContour } from "../../solid/SweepContour";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3dArray } from "../../geometry3d/PointHelpers";
import { Loop } from "../../curve/Loop";

function captureClippedPolygon(allGeometry: GeometryQuery[], points: Point3d[], clipper: UnionOfConvexClipPlaneSets,
  x0: number,
  y0: number) {
  const clipShapes: GrowableXYZArray[] = [];
  clipper.polygonClip(points, clipShapes);
  for (const shape of clipShapes) {
    shape.push(shape.getPoint3dAtUncheckedPointIndex(0));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, shape, x0, y0);
    }
  }

describe("OffsetByClip", () => {
  it("LongLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const range = Range3d.createXYZXYZ(-1, -1, -1, 6, 6, 1);

    const pointsA = [Point3d.create(0, 2), Point3d.create(0, 0, 0), Point3d.create(1, 0), Point3d.create(2, 1), Point3d.create(3, 3)];
    pointsA.push(Point3d.create(5, 3));
    pointsA.push(Point3d.create(5, 0));
    pointsA.push(Point3d.create(4, 2));
    pointsA.push(Point3d.create(4, 0));
    pointsA.push(Point3d.create(4, -0.5));
    pointsA.push(Point3d.create(3, -0.5));
    pointsA.push(Point3d.create(3, 0));
    pointsA.push(Point3d.create(2, -0.5));
    const pointsC = [Point3d.create(0, 0), Point3d.create(4, 0)];
    const pointsB = [];
    pointsB.push(Point3d.create(-53.94490516785141, 46.9407384215234, -3.8955028593080985));
    pointsB.push(Point3d.create(-53.94490516785141, 6.495277504543655, -3.8955028593080985));
    pointsB.push(Point3d.create(-53.94490516785141, -37.759261578476604, -3.8955028593080985));
    pointsB.push(Point3d.create(7.83254294135434, -37.759261578476604, -3.8955028593080985));
    pointsB.push(Point3d.create(75.4280760324446, -37.759261578476604, -3.8955028593080985));
    pointsB.push(Point3d.create(75.4280760324446, 2.6861993385031404, -3.8955028593080985));
    pointsB.push(Point3d.create(75.4280760324446, 46.9407384215234, -3.8955028593080985));
    pointsB.push(Point3d.create(13.650627923238844, 46.9407384215234, -3.8955028593080985));
    pointsB.push(Point3d.create(-53.94490516785141, 46.9407384215234, -3.8955028593080985));

    let y00 = 0.0;
    for (const points of [pointsC, pointsB, pointsA]) {
      let x0 = 0.0;
      for (const leftSign of [1, 0.25, 0, -0.50, -2.0]) {
        let y0 = y00;
        for (const rightOffset of [0.2, 0.3, 0.4, 0.8, -0.2]) {
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
          const offsetClipper = ClipUtilities.createXYOffsetClipFromLineString(points, leftSign * rightOffset, rightOffset, -0.1, -0.02);
          if (ck.testType(offsetClipper, UnionOfConvexClipPlaneSets)) {
            for (const c of offsetClipper.convexSets) {
              ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(c, range,
                (loopPoints: GrowableXYZArray) => {
                  GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loopPoints, x0, y0);
                });
            }
          }
          y0 += 10.0;
        }
        x0 += 15.0;
      }
      y00 += 60.0;
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "LongLineString");
  });

  it("LongLineStringB", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const range = Range3d.createXYZXYZ(-100, -100, -10, 100, 100, 10);
    const pointsB = [];
    pointsB.push(Point3d.create(-53.94490516785141, 46.9407384215234, -3.8955028593080985));
    pointsB.push(Point3d.create(-53.94490516785141, 6.495277504543655, -3.8955028593080985));
    pointsB.push(Point3d.create(-53.94490516785141, -37.759261578476604, -3.8955028593080985));
    pointsB.push(Point3d.create(7.83254294135434, -37.759261578476604, -3.8955028593080985));
    pointsB.push(Point3d.create(75.4280760324446, -37.759261578476604, -3.8955028593080985));
    pointsB.push(Point3d.create(75.4280760324446, 2.6861993385031404, -3.8955028593080985));
    pointsB.push(Point3d.create(75.4280760324446, 46.9407384215234, -3.8955028593080985));
    pointsB.push(Point3d.create(13.650627923238844, 46.9407384215234, -3.8955028593080985));
    pointsB.push(Point3d.create(-53.94490516785141, 46.9407384215234, -3.8955028593080985));
    // make another one with no midpoints.
    const pointsA = [];
    pointsA.push(pointsB[0]);
    pointsA.push(pointsB[2]);
    pointsA.push(pointsB[4]);
    pointsA.push(pointsB[6]);
    pointsA.push(pointsB[8]);

    const pointsC = [];
    pointsC.push(pointsB[0]);
    pointsC.push(pointsB[2]);
    pointsC.push(pointsB[4]);
    let y00 = 0.0;
    for (const points of [pointsC, pointsA, pointsB]) {
      let x0 = 0.0;
      let y0 = y00;
      for (const leftOffset of [10]) {
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0);
        const offsetClipper = ClipUtilities.createXYOffsetClipFromLineString(points, leftOffset, 0, -9999, 9999);
        if (ck.testType(offsetClipper, UnionOfConvexClipPlaneSets)) {
          for (const c of offsetClipper.convexSets) {
            ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(c, range,
              (loopPoints: GrowableXYZArray) => {
                GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loopPoints, x0, y0);
              });
          }
          y0 += 30.0;
        }
        x0 += 200.0;
      }
      y00 += 100.0;
    }

    const zClipper = ClipUtilities.createXYOffsetClipFromLineString([], 1, 1, -1, -1);
    ck.testExactNumber(1, zClipper.convexSets.length);

    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "LongLineStringB");
  });

  it("Coverage", () => {
  });

  it("DiegoProblemCases", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shape1 = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/clipping/DiegoTrickyBuilding/case1.imjs", "utf8"))) as CurveCollection;
    const shape2 = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/clipping/DiegoTrickyBuilding/case2.imjs", "utf8"))) as CurveCollection;
    //    const shape3 = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
    //       "./src/test/testInputs/clipping/DiegoTrickyBuilding/case3.imjs", "utf8"))) as CurveCollection;
    let x00 = 0;
    const y00 = 0;
    const z00 = 0;
    const zShape = 0.1;
    const offsetDistance = 3.0;
    for (const shape of [shape1, shape2]) {
      const range = shape.range();
      const x0 = x00 - range.low.x;
      const y0 = y00 - range.low.y;
      const z0 = z00 - range.low.z;
      const clipRange = range.clone();
      clipRange.expandInPlace(offsetDistance);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, shape, x0, y0, z0 + zShape);
      if (shape instanceof CurveChain) {
        const points = shape.getPackedStrokes()!;
        const offsetClipper = ClipUtilities.createXYOffsetClipFromLineString(points, offsetDistance, offsetDistance, range.low.z - 0.1, range.low.z - 0.02);
        if (ck.testType(offsetClipper, UnionOfConvexClipPlaneSets)) {
          for (const c of offsetClipper.convexSets) {
            ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(c, clipRange,
              (loopPoints: GrowableXYZArray) => {
                GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loopPoints, x0, y0, z0);
              });
          }
        }
        x00 += range.xLength() * 2;
      }
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "DiegoProblemCases");
  });
// cspell:word arnoldas
  it("ArnoldasLaneClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const fullRoadMesh = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/clipping/arnoldasLaneClipper/fullRoadMesh.imjs", "utf8")));
    // const largeClipRegion = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
    //   "./src/test/testInputs/clipping/arnoldasLaneClipper/largeClipRegion.imjs", "utf8")));
    if (fullRoadMesh instanceof IndexedPolyface) {
      const meshRangeA = fullRoadMesh.range();
      fullRoadMesh.tryTranslateInPlace(-meshRangeA.low.x, -meshRangeA.low.y, -meshRangeA.low.z);
      const meshRange = fullRoadMesh.range();
      const rangeRectangle = Sample.createRectangleXY(meshRange.low.x, meshRange.low.y,
           meshRange.xLength (), meshRange.yLength(), meshRange.low.z);
      let x0 = -meshRange.low.x;
      const y0 = -meshRange.low.y;
      const dx = meshRange.xLength();
      const dy = meshRange.yLength();
      // Extract the boundary of the upward facing mesh ..
      const boundary = PolyfaceQuery.boundaryOfVisibleSubset(fullRoadMesh, 0, Vector3d.unitZ(), Angle.createDegrees(2.0));
      if (boundary){
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fullRoadMesh, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundary, x0, y0);
        const chainsA = OffsetHelpers.collectChains([boundary], 1.0e-6);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, chainsA, x0 + dx, y0);
        // ugh .. we know it's a closed Loop.   collectChains is fuzzy in its return type ..
        if (chainsA instanceof Path) {
          RegionOps.consolidateAdjacentPrimitives(chainsA);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, chainsA, x0 + 2 * dx, y0);
          // Look for the contiguous "right side" -- segments with both components going to first quadrant.
          const rightSideChains: LineString3d[] = [];
          for (const primitive of chainsA.children) {
            if (primitive instanceof LineString3d)
              filterSegments(primitive,
                (pointA: Point3d, pointB: Point3d) => { return pointB.x - pointA.x >= 0.0 && pointB.y - pointA.y >= 0.0; },
                (ls: LineString3d) => rightSideChains.push(ls));
          }
          const offsetA = 3.0;
          for (const offsetB of [0.0, -1.0]) {          // we expect only one right side chain ..
          for (const ls of rightSideChains) {
              const clipper = ClipUtilities.createXYOffsetClipFromLineString(ls.packedPoints, offsetA, offsetB, meshRange.low.z - 1, meshRange.high.z + 1);
            const builders = ClippedPolyfaceBuilders.create(true, true, true);
            // first method: clip the whole polyface at once ....
            PolyfaceClip.clipPolyfaceUnionOfConvexClipPlaneSetsToBuilders(fullRoadMesh, clipper, builders);
            const clipA = builders.builderA?.claimPolyface();
            const clipB = builders.builderB?.claimPolyface();
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipA, x0 + 3 * dx, y0);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipB, x0 + 2.8 * dx, y0);
              {
                const clipResult: GrowableXYZArray[] = [];
                clipper.polygonClip(rangeRectangle, clipResult);
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipResult, x0, y0 + dy);
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, rangeRectangle, x0, y0 + dy);
              }
            const num0 = fullRoadMesh.facetCount;
            if (ck.testDefined(clipA) && clipA
              && ck.testDefined(clipB) && clipB) {
              // hard to say what the output "should" be ... be test that counts are similar . .
              // (The motivation for this problem was that there were many, many unnecessary interior edges)
              const numA = clipA.facetCount;
              const numB = clipB.facetCount;
                ck.testLE(numA, 8 * num0);
                ck.testLE(numB, 8 * num0);
                // ck.testLE(num0, 2 * numA);
                // ck.testLE(num0, 2 * numB);
            }
              x0 += 4.0 * dx;
            // second method clip the polyface one facet at a time.
            // This indeed produces full facets !!!!
            const visitor = fullRoadMesh.createVisitor();
            for (; visitor.moveToNextFacet();){
              const clipResult: GrowableXYZArray[] = [];
              clipper.polygonClip(visitor.point.getPoint3dArray(), clipResult);
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipResult, x0, y0);
              }
            }
              x0 += 10.0 * dx;
          }
        }
      }
    }

    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "ArnoldasLaneClip");
  });
  it("ExcessEdgesAroundAnnulus", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const clipper = UnionOfConvexClipPlaneSets.createEmpty();
    const allClipPolygons = [];
    for (const annulusA of
      [
        Sample.createAnnulusPolyline(4, Point3d.create(4, 1.1, 0), 2, 2.6,
          Angle.createDegrees(100), Angle.createDegrees(170), true),
        Sample.createAnnulusPolyline(4, Point3d.create(6, 6, 0), 2, 2.6,
          Angle.createDegrees(-80), Angle.createDegrees(45), true),
      ]) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, annulusA, x0, y0);
      const contourA = SweepContour.createForPolygon(annulusA);
      const clipperA = contourA!.sweepToUnionOfConvexClipPlaneSets()!;
      clipper.takeConvexSets(clipperA);
      allClipPolygons.push(annulusA);
      const grid0 = Sample.createTriangularUnitGridPolyface(Point3d.create(1, 2, 0),
        Vector3d.create(1.0, 0, 0),
        Vector3d.create(0, 2.0, 0),
        3, 2, false, false, false, false);
      const grid0A = Sample.createTriangularUnitGridPolyface(Point3d.create(2,0, 0),
        Vector3d.create(1.0, 0, 0),
        Vector3d.create(0, 2.0, 0),
        2, 2, false, false, false, false);
      const grid1 = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0),
        Vector3d.create(1.0, 0, 0),
        Vector3d.create(0, 2.0, 0),
        11, 6, false, false, false, false);
      const grid2 = Sample.createTriangularUnitGridPolyface(Point3d.create(1, 2, 0),
        Vector3d.create(1.0, 0, 0),
        Vector3d.create(0, 2.0, 0),
        4, 3, false, false, false, false);
        const grid3 = Sample.createTriangularUnitGridPolyface(Point3d.create(7, 4, 0),
        Vector3d.create(1.0, 0, 0),
        Vector3d.create(0, 2.0, 0),
        3, 2, false, false, false, false);
      x0 += 20.0;
      for (const grid of [grid0A, grid0, grid1, grid2, grid3]) {
        y0 = 0.0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, grid, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, allClipPolygons, x0, y0);
        for (const outputSelector of [0, 1]) {
          const builders = ClippedPolyfaceBuilders.create(true, true, true);
          PolyfaceClip.clipPolyfaceUnionOfConvexClipPlaneSetsToBuilders(grid, clipper, builders, outputSelector);
          y0 += 10;
          const clipA = builders.builderA?.claimPolyface();
          const clipB = builders.builderB?.claimPolyface();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipA, x0, y0 += 10);

          GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipB, x0, y0 += 10);

          const rectangle = Sample.createRectangleXY(0, 0, 10, 12, 0);
          const clipShapes: GrowableXYZArray[] = [];
          clipper.polygonClip(rectangle, clipShapes);
          for (const shape of clipShapes) {
            shape.push(shape.getPoint3dAtUncheckedPointIndex(0));
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, shape, x0, y0);
          }
          y0 += 10;
        }
        x0 += 30;
      }
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "ExcessEdgesAroundAnnulus");
  });

  it("NonXYClip", () => {
    // Make a polyface
    // make a rectangle in xy
    // make the clip set perpendicular to the rectangle
    // rotate by various angles around x -- be sure to include 90 degrees to get completely perpendicular case
    // do the clip with reassembly
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const clipRectangle = SweepContour.createForPolygon(Sample.createRectangleXY(1, 1, 2, 3, 0));
    const rectangleClipper = clipRectangle!.sweepToUnionOfConvexClipPlaneSets()!;

    const grid0 = Sample.createTriangularUnitGridPolyface(Point3d.create(2, 0, 0),
        Vector3d.create(2.0, 0, 0),
        Vector3d.create(0, 3.0, 0),
        2, 2, false, false, false, false);
    for (const degrees of [0, 10, 20, 45, 90, 125]) {
      const rotation = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0),
        Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(degrees)));
      const grid1 = grid0.cloneTransformed(rotation);
      const clipper1 = rectangleClipper.clone();
      clipper1.transformInPlace(rotation);
        y0 = 0.0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, grid1, x0, y0);
        for (const outputSelector of [0, 1]) {
          const builders = ClippedPolyfaceBuilders.create(true, true, true);
          PolyfaceClip.clipPolyfaceUnionOfConvexClipPlaneSetsToBuilders(grid1, clipper1, builders, outputSelector);
          y0 += 5;
          const clipA = builders.builderA?.claimPolyface();
          const clipB = builders.builderB?.claimPolyface();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipA, x0, y0 += 5);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, clipB, x0, y0 += 5);

          const tiltedRectangle = Sample.createRectangleXY(0, 0, 10, 12, 0);
          rotation.multiplyPoint3dArrayInPlace(tiltedRectangle);
          captureClippedPolygon(allGeometry, tiltedRectangle, clipper1, x0, y0);
          y0 += 5;
        }
        x0 += 10;
      }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "NonXYClip");
  });

  it("InwardCornerClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const y00 = 0.0;
    const aa = 2.0;
    const bb = 8.0;
    let x0 = 0.0;
    const paths = [];
    const angles = [Angle.createDegrees(0), Angle.createDegrees(40), Angle.createDegrees(-120)];
    // Make "not quite filleted" line-arc-line paths with quirky shapes
    for (const shiftRadius of [0.0, 0.1, -0.1, -0.3, 1.0]) {
      for (const angle of angles)
        paths.push(quirkyArcPath(shiftRadius * angle.cos (), shiftRadius * angle.sin ()));
    }
    paths.push(quirkyArcPath(0, 0, 0, 1));
    paths.push(quirkyArcPath(0, 0, 0, -1));

  for (const radius0 of [1.0, 2.0]){    // nominally possible to have undefined return -- but it will get tossed later . ..
      paths.push(CurveFactory.createRectangleXY(aa, aa, bb, bb, 0, radius0));
    }

    paths.push(CurveFactory.createFilletsInLineString(LineString3d.create ([
      [0, 0, 0],
      [5, 0, 0],
      [5, 5, 0],
      [10, 5, 0],
      [10, 10, 0],
      [0,8,0],
    ]), 1.0));
    for (const path of paths){
      const y0 = y00;
      if (path){
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0, 0.01);
        for (const offsetDistance of [2.0, 3.0, 0.9, 1.0, 1.1]) {   // 7.0 makes bow ties
            const options1 = new JointOptions(offsetDistance);
          const options2 = new JointOptions(-offsetDistance);
            const offset1 = RegionOps.constructCurveXYOffset(path, options1);
            const offset2 = RegionOps.constructCurveXYOffset(path, options2);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, offset1, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, offset2, x0, y0);
          // y0 += 25.0;
        }
        x0 += 25.0;
      }
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "InwardCornerClip");
  });
  it("IncompletePaste", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const polygonsToPaste: Point3d[][] = [
      [
        Point3d.create(21.693771833736626,22.300546394411093,0.0),
        Point3d.create(22.0,22.141134101103496,0.0),
        Point3d.create(22.0,22.373898226040680,0.0),
        Point3d.create(21.693771833736626, 22.300546394411093, 0.0),
      ],
      [
         Point3d.create(21.693771833736626,22.300546394411093,0.0),
         Point3d.create(21.812339330618727,22.0,0.0),
         Point3d.create(22.0,22.0,0.0),
         Point3d.create(22.0,22.141134101103496,0.0),
          Point3d.create(21.693771833736626, 22.300546394411093, 0.0),
        ],
        [Point3d.create(21.693771833736626, 22.300546394411093, 0.0),
         Point3d.create(21.591750080167749,22.0,0.0),
         Point3d.create(21.812339330618727,22.0,0.0),
          Point3d.create(21.693771833736626, 22.300546394411093, 0.0),
        ],
        [
          Point3d.create(21.693771833736626, 22.300546394411093, 0.0),
         Point3d.create(22.0,22.373898226040680,0.0),
         Point3d.create(22.0,22.718188915620175,0.0),
          Point3d.create(21.693771833736626, 22.300546394411093, 0.0),
        ],
        [
          Point3d.create(22.161522368914980, 22.938477631085025, 0.0),
         Point3d.create(21.693771833736626,22.300546394411093,0.0),
         Point3d.create(21.693771833736626,22.300546394411093,0.0),
         Point3d.create(22.0,22.718188915620175,0.0),
          Point3d.create(22.161522368914980, 22.938477631085025, 0.0),
        ],
    ];
    let x0 = -21;
    for (const candidates of [
      [polygonsToPaste[1], polygonsToPaste[2]],
      [polygonsToPaste[0], polygonsToPaste[1]],
      [polygonsToPaste[0], polygonsToPaste[2]],
      [polygonsToPaste[0], polygonsToPaste[3]],
      [polygonsToPaste[0], polygonsToPaste[4]],
      [polygonsToPaste[1], polygonsToPaste[2]],
      [polygonsToPaste[1], polygonsToPaste[3]],
      [polygonsToPaste[1], polygonsToPaste[4]],
      [polygonsToPaste[2], polygonsToPaste[3]],
      [polygonsToPaste[2], polygonsToPaste[4]],   // 4 is a sliver !!!
      ]) {
        let y0 = -21;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, candidates, x0, y0);
        const insidePieces = RegionOps.polygonBooleanXYToLoops(candidates, RegionBinaryOpType.Union, []);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, insidePieces, x0, y0 += 1);
        x0 += 1;
        }
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "IncompletePaste");
    expect(ck.getNumErrors()).equals(0);
  });
  it("IncompletePasteWithDoublePoint", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shard0: Point3d[] = [
      Point3d.create(1, 1.0000000000000007, 0),
      Point3d.create(1.0000000000000004, 1, 0),
      Point3d.create(2, 1, 0),
      Point3d.create(2, 3, 0),
      Point3d.create(1, 3, 0),
    ];
    const shard1: Point3d[] = [
      Point3d.create(0, 1, 0),
      Point3d.create(0, 0, 0),
      Point3d.create(2, 0, 0),
      Point3d.create(2, 1, 0),
    ];
    const shard1A: Point3d[] = [
      Point3d.create(0, 0.5, 0),
      Point3d.create(0, 0, 0),
      Point3d.create(2, 0, 0),
      Point3d.create(2, 1.5, 0),
    ];

    const shard0A = Point3dArray.clonePoint3dArray(shard0);
    shard0A.shift();
    const shard0B = Point3dArray.clonePoint3dArray(shard0);
    shard0B[0].y = 1.0;
    shard0B[1].y = 1.0;
    const shard0C = Point3dArray.clonePoint3dArray(shard0);
    shard0C[0].y -= 0.5;
    shard0C[1].y -= 0.5;

    let y0 = 0;
    let x0 = 0;
    for (const candidates of [
      [shard0, shard1],
      [shard0A, shard1],
      [shard0B, shard1],
      [shard0C, shard1],
      [shard0, shard1A],
    ]) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, candidates, x0, y0);
      const insidePieces = RegionOps.polygonBooleanXYToLoops(candidates, RegionBinaryOpType.Union, []);
      ck.testType(insidePieces, Loop, "Expect single loop for pasting.");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, insidePieces, x0, y0 += 5);
      y0 = 0;
      x0 += 6.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetByClip", "IncompletePasteWithDoublePoint");
    expect(ck.getNumErrors()).equals(0);
  });

});

// Pass each segment to a test function.
// Collect sequences of accepted segments into linestrings.
function filterSegments(linestring: LineString3d,
  segmentTestFunction: (pointA: Point3d, pointB: Point3d) => boolean,
linestringAcceptFunction: (ls: LineString3d) => void): void{
  const pointA = Point3d.create();
  const pointB = Point3d.create();
  let currentLineString: LineString3d | undefined;
  for (let i = 0; i + 1 < linestring.packedPoints.length; i++){
    linestring.packedPoints.getPoint3dAtCheckedPointIndex(i, pointA);
    linestring.packedPoints.getPoint3dAtCheckedPointIndex(i + 1, pointB);
    if (segmentTestFunction(pointA, pointB)) {
      if (!currentLineString) {
        currentLineString = LineString3d.create();
        currentLineString.addPoint(pointA);
      }
      currentLineString.addPoint(pointB);
    } else {
      if (currentLineString) {
        linestringAcceptFunction(currentLineString);
        currentLineString = undefined;
      }
    }
  }
  if (currentLineString)
    linestringAcceptFunction(currentLineString);
}

// Start at 00
// base path is:
// Line segment to (9,0)
// Arc from (9,0) to (10,1), constructed by 3 points
// Line segment to (10,10)
// BUT move the three arc points by displacements
function quirkyArcPath(dx0: number, dy0: number, dx1: number = 0.0, dy1: number = 0.0, dx2: number = 0.0, dy2: number = 0.0): Path | undefined {
  const radius = 1.0;
  const a = radius * Math.cos(Math.PI * 0.25);
  const y0 = 0.0;
  const y2 = y0 + radius;
  const y1 = y2 - a;
  const x0 = 9.0;
  const x1 = x0 + a;
  const x2 = x0 + radius;

  const y3 = 10.0;
  const pointA = Point3d.create(0, 0);
  const point0 = Point3d.create(x0 + dx0, y0 + dy0);
  const point1 = Point3d.create(x1 + dx1, y1 + dy1);
  const point2 = Point3d.create(x2 + dx2, y2 + dy2);
  const pointB = Point3d.create(x2, y3);
  const arc = Arc3d.createCircularStartMiddleEnd(point0, point1, point2);
  if (arc)
    return Path.create(LineSegment3d.create(pointA, point0), arc, LineSegment3d.create(point2, pointB));
  return undefined;
}
