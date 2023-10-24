/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import { CurveCollection } from "../../curve/CurveCollection";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ParityRegion } from "../../curve/ParityRegion";
import { RegionOps } from "../../curve/RegionOps";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { MomentData } from "../../geometry4d/MomentData";
import { SortableEdgeCluster } from "../../polyface/IndexedEdgeMatcher";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { DuplicateFacetClusterSelector, PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { LinearSweep } from "../../solid/LinearSweep";
import { SweepContour } from "../../solid/SweepContour";
import { Triangulator } from "../../topology/Triangulation";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GraphChecker } from "../topology/Graph.test";

describe("ParityRegionSweep", () => {
  it("Hello", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const regionC = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionC.imjs", "utf8")));
    const regionA = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionA.imjs", "utf8")));
    let regionB = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/curve/parityRegionSweep/ParityRegionB.imjs", "utf8")));
    if (Array.isArray(regionB)) {
      const regionB1 = ParityRegion.create();
      for (const loop of regionB) {
        regionB1.tryAddChild(loop);
      }
      regionB = regionB1;
    }
    let x0 = 0;
    const y0 = 0;
    for (const region of [regionC, regionA, regionB]) {
      if (region instanceof CurveCollection) {
        const range = region.range();
        let y1 = y0 - range.low.y;
        let x1 = x0 - range.low.x;
        const diagonal = range.low.distance(range.high);

        const rawMomentData = RegionOps.computeXYZWireMomentSums(region)!;
        const principalMomentData = MomentData.inertiaProductsToPrincipalAxes(rawMomentData.origin, rawMomentData.sums)!;
        // GeometryCoreTestIO.showMomentData(allGeometry, rawMomentData, false, x1, y1);
        const zColumn = principalMomentData.localToWorldMap.matrix.columnZ();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [rawMomentData.origin, rawMomentData.origin.plusScaled(zColumn, 4.0)], x1, y1);

        GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x1, y1);
        for (const sweepDirection of [zColumn, zColumn.negate()]) {
          const sweepContour1 = SweepContour.createForLinearSweep(region, sweepDirection);
          if (sweepContour1) {
            const builder1 = PolyfaceBuilder.create();
            sweepContour1.emitFacets(builder1, false);
            const mesh1 = builder1.claimPolyface();
            const a = 0.5 * diagonal;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, sweepContour1.xyStrokes, x1 += a, y1 += a, 0);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, x1, y1 += a * 0.5, 0);
          }
        }
        if (Checker.noisy.buildFacetsFromSweptParityRegions) {
          for (const sweepDirection of [zColumn, zColumn.negate()]) {
            const slab = LinearSweep.create(region, sweepDirection, true);
            let y2 = y1 + diagonal;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, slab, x1, y2);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [rawMomentData.origin, rawMomentData.origin.plusScaled(sweepDirection, 4.0)], x1, y2);
            const builder = PolyfaceBuilder.create();
            builder.addGeometryQuery(slab!);
            const polyfaceA = builder.claimPolyface();
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x1, y2 += diagonal);
            const polyfaceB = PolyfaceQuery.cloneByFacetDuplication(polyfaceA, true, DuplicateFacetClusterSelector.SelectOneByParity);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceB, x1, y2 += diagonal);
            // GeometryCoreTestIO.consoleLog({ rawMoments: principalMomentData });
            // GeometryCoreTestIO.consoleLog({ principalMoments: principalMomentData });
            x1 += diagonal;
          }
        }
        x0 += 3.0 * diagonal;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "ParityRegionSweep");
    expect(ck.getNumErrors()).equals(0);
  });
  it("TriangulationWithEdgeIncidence2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const grid10 = [];
    const aMax = 10.0;
    const a = aMax + 4.0;
    let x0A = 0.0;
    for (let q = 0.0; q <= aMax; q += 1.0) {
      grid10.push([Point3d.create(q, -1), Point3d.create(q, 0)]);
      grid10.push([Point3d.create(q, aMax), Point3d.create(q, aMax + 1)]);
      grid10.push([Point3d.create(-1, q), Point3d.create(0, q)]);
      grid10.push([Point3d.create(aMax, q), Point3d.create(aMax + 1, q)]);
    }
    for (const dy of [0.1, 0.3]) {
      let y0 = 0.0;
      for (const transform of [
        Transform.createIdentity(),
        Transform.createFixedPointAndMatrix(Point3d.create(3.24234898, 1.9798789),
          Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(25.69898234))),
      ]) {
        let x0 = x0A;
        for (const yShifts of [[dy, dy, dy],
        [0, 0, 0], [dy, 0, 0], [0, dy, 0], [dy, dy, 0],
        [0, 0, dy], [dy, 0, dy], [0, dy, dy],
        ]) {
          const loop1 = GrowableXYZArray.create([
            [0, 0, 0],
            [10, 0, 0],
            [10, 10, 0],
            [0, 10, 0],
            [0, 0, 0],
          ]);
          const loop2 = GrowableXYZArray.create([
            [6, yShifts[0], 0],
            [7, yShifts[1], 0],
            [7, yShifts[2], 0],
            [8, 4, 0],
            [6, 4, 0],
            [6, yShifts[0], 0],
          ]);
          loop1.multiplyTransformInPlace(transform);
          loop2.multiplyTransformInPlace(transform);
          const graph = Triangulator.createTriangulatedGraphFromLoops([loop1, loop2])!;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop1, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop2, x0, y0);
          if (graph) {
            GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0 + a);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, grid10, x0, y0 + a);

            const builder = PolyfaceBuilder.create();
            builder.addGraph(graph);
            const polyfaceA = builder.claimPolyface();
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x0, y0 + 2 * a);
          }
          x0 += a;
        }
        y0 += 4 * a;
      }
      x0A += 40 * a;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "TriangulationWithEdgeIncidence2");
    expect(ck.getNumErrors()).equals(0);
  });

  it("bowTieTriangulate", () => {
    const ck = new Checker();
    const points = [Point3d.create(0, 0), Point3d.create(5, 0), Point3d.create(5, 5), Point3d.create(1, -1)];
    const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points);
    ck.testUndefined(graph, "bow tie graph should fail triangulation");
    expect(ck.getNumErrors()).equals(0);
  });

  it("simpleHoleTriangulate", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const a = 10.0;
    let x0 = 0;
    const y0 = 0;
    const outer = [Point3d.create(0, 0), Point3d.create(5, 0), Point3d.create(5, 5), Point3d.create(0, 5)];
    const inner = [Point3d.create(1, 1), Point3d.create(3, 4), Point3d.create(4, 2)];
    const outerGraph = Triangulator.createTriangulatedGraphFromSingleLoop(outer);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, outer, x0, y0);
    GraphChecker.captureAnnotatedGraph(allGeometry, outerGraph, x0, y0 + a);
    x0 += a;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, outer, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, inner, x0, y0);
    const holeGraph = Triangulator.createTriangulatedGraphFromLoops([outer, inner]);
    GraphChecker.captureAnnotatedGraph(allGeometry, holeGraph, x0, y0 + a);

    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "simpleHoleTriangulate");
    expect(ck.getNumErrors()).equals(0);
  });

  // cspell:word Karolis
  it("KarolisRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const dx = 50;
    const dy = 50;
    let shiftX = 0;
    let shiftY = 0;
    const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/testInputs/curve/parityRegionSweep/karolisParityRegionSweep.imjs", "utf8"))) as GeometryQuery[];
    ck.testDefined(inputs, "linearSweep imported");

    const boundaryEdges: SortableEdgeCluster[] = [];
    const nullEdges: SortableEdgeCluster[] = [];
    const otherClusteredEdges: SortableEdgeCluster[] = [];
    let boundaryEdgeCount = 0, nullEdgeCount = 0, otherClusteredEdgeCount = 0;
    const expectedBoundaryEdgeCount = 0, expectedNullEdgeCount = 0, expectedOtherClusteredEdgeCount = 3;  // we know there are 3 singular vertices in the parity regions

    for (const input of inputs) {
      const solid = input as LinearSweep;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, solid, shiftX, shiftY);
      shiftX += dx;

      const polyfaceBuilder = PolyfaceBuilder.create();
      polyfaceBuilder.addLinearSweep(solid);
      const facetedSolid = polyfaceBuilder.claimPolyface();
      ck.testDefined(facetedSolid, "polyface built");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, facetedSolid, shiftX, shiftY);
      shiftX += dx;

      const processedFacets = PolyfaceQuery.cloneByFacetDuplication(facetedSolid, true, DuplicateFacetClusterSelector.SelectOneByParity);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, processedFacets, shiftX, shiftY);

      PolyfaceQuery.createIndexedEdges(processedFacets).sortAndCollectClusters(undefined, boundaryEdges, nullEdges, otherClusteredEdges);
      boundaryEdgeCount += boundaryEdges.length;
      nullEdgeCount += nullEdges.length;
      otherClusteredEdgeCount += otherClusteredEdges.length;
      if (boundaryEdges.length > 0 || nullEdges.length > 0 || otherClusteredEdges.length > 0)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceQuery.boundaryEdges(processedFacets), shiftX, shiftY);

      shiftX = 0;
      shiftY += dy;
    }
    ck.testExactNumber(boundaryEdgeCount, expectedBoundaryEdgeCount, "linearSweeps have expected boundary edge count");
    ck.testExactNumber(nullEdgeCount, expectedNullEdgeCount, "linearSweeps have expected null edge count");
    ck.testExactNumber(otherClusteredEdgeCount, expectedOtherClusteredEdgeCount, "linearSweeps have expected other clustered edge count");

    GeometryCoreTestIO.saveGeometry(allGeometry, "ParityRegionSweep", "KarolisRegion");
    expect(ck.getNumErrors()).equals(0);
  });

});
