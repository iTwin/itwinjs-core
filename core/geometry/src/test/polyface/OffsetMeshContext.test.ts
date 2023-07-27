/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { expect } from "chai";
import { LineString3d } from "../../curve/LineString3d";
import { Arc3d } from "../../curve/Arc3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { IndexedPolyface } from "../../polyface/Polyface";
import { RFunctions } from "./DrapeLinestring.test";
import { Sample } from "../../serialization/GeometrySamples";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { GraphChecker } from "../topology/Graph.test";
import { OffsetMeshOptions, PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { OffsetMeshContext } from "../../polyface/multiclip/OffsetMeshContext";
import { LinearSweep } from "../../solid/LinearSweep";
import { SolidPrimitive } from "../../solid/SolidPrimitive";

const globalSeparateFaceEdgeAndVertexOutputs = false;
function cleanupZero(a: number, tol: number = 1.0e-12): number {
  return Math.abs(a) > tol ? a : 0.0;
}

function _offsetDebugFunction(message: string, graph: HalfEdgeGraph,
  breakMaskA: HalfEdgeMask,
  breakMaskB: HalfEdgeMask) {
  if (Checker.noisy.offsetMesh) {
    GeometryCoreTestIO.consoleLog((""));
    GeometryCoreTestIO.consoleLog(` DebugGraph ${message}`);
    GraphChecker.dumpGraph(graph,
      (node: HalfEdge) => {
        const xx = node.isMaskSet(HalfEdgeMask.EXTERIOR) ? "X" : " ";
        const breakA = node.isMaskSet(breakMaskA) ? "A" : " ";
        const breakB = node.isMaskSet(breakMaskB) ? "B" : " ";
        const s = `${node.id.toString()}+${xx}${breakA}${breakB}[${cleanupZero(node.x)},${cleanupZero(node.y)}]`;
        return s;
      },
      (node: HalfEdge) => {
        const xx = node.isMaskSet(HalfEdgeMask.EXTERIOR) ? "X" : " ";
        const breakA = node.isMaskSet(breakMaskA) ? "A" : " ";
        const breakB = node.isMaskSet(breakMaskB) ? "B" : " ";
        const s = `[${node.id.toString()}+${xx}${breakA}${breakB}]`;
        return s;
      });
  }
}
// import { GraphChecker } from "../topology/Graph.test";
describe("OffsetMeshContext", () => {

  it("OffsetPyramids", () => {
    const ck = new Checker();

    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const radius = 2.0;
    let x0 = 0;
    const signs: number[] = [1.0, -1.0];
    // OffsetMeshContext.graphDebugFunction = _offsetDebugFunction;
    // Checker.noisy.offsetMesh = true;
    if (Checker.noisy.offsetMesh)
      OffsetMeshContext.stringDebugFunction = (message: string) => { GeometryCoreTestIO.consoleLog(message); };

    for (const xScale of [2.0]) {
      for (const height of [2.0, 0.05, 2.0, 1.0, 3.0, 10.0]) {
        for (const numEdge of [3]) {
          const builder = PolyfaceBuilder.create(options);
          const strokes = LineString3d.create();
          for (let i = 0; i < numEdge; i++) {
            const theta = Angle.createDegrees(i * 360 / numEdge);
            const zz = i === 0.0 ? height : 0.0;  // make the base non-planar!
            strokes.addPointXYZ(xScale * radius * theta.cos(), radius * theta.sin(), zz);
          }
          strokes.addClosurePoint();
          const apex = Point3d.create(0, 0, height);
          // upward cone
          builder.addTriangleFan(apex, strokes, false);
          const polyface = builder.claimPolyface();
          // GeometryCoreTestIO.consoleLog({ height, numEdge });
          x0 = testOffsets(ck, allGeometry, polyface, [0.10], signs, x0, globalSeparateFaceEdgeAndVertexOutputs);
        }
      }
    }
    OffsetMeshContext.stringDebugFunction = undefined;
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetPyramids");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OffsetsFromFan", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const builder = PolyfaceBuilder.create(options);
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(4, 0, 0), Point3d.create(3, 3, 0), Point3d.create(0, 4, 0))!;
    const strokes = LineString3d.create();
    arc.emitStrokes(strokes, options);
    const coneA = Point3d.create(0, 0, 5);
    const coneB = Point3d.create(0, 0, 0);
    // upward cone
    builder.addTriangleFan(coneA, strokes, false);
    builder.addTriangleFan(coneB, strokes, true);
    const polyface = builder.claimPolyface();
    /*
    const baseGraph = OffsetMeshContext.buildBaseGraph (polyface);
    GraphChecker.dumpGraph (baseGraph);
    */
    testOffsets(ck, allGeometry, polyface, [0.5, 0.5, 1.0], [1.0, -1.0], 0.0, globalSeparateFaceEdgeAndVertexOutputs);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetsFromFan");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OffsetsFanToLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    let x0 = 0;
    for (const apexHeight of [5.0, 2.5, 1.5, 1.0]) {
      for (const pointCount of [2, 4]) {
        const builder = PolyfaceBuilder.create(options);
        const strokes = LineString3d.create();
        for (let i = 0; i <= pointCount; i++) {
          strokes.addPointXYZ(2, Geometry.interpolate(-2, i / pointCount, 2), 2);
        }
        const coneA = Point3d.create(0, 0, apexHeight);
        const coneB = Point3d.create(0, 0, 0);
        // upward cone
        builder.addTriangleFan(coneA, strokes, false);
        builder.addTriangleFan(coneB, strokes, true);
        const polyface = builder.claimPolyface();
        /*
        const baseGraph = OffsetMeshContext.buildBaseGraph (polyface);
        GraphChecker.dumpGraph (baseGraph);
        */
        x0 = testOffsets(ck, allGeometry, polyface, [0.5, 1.0], [1.0, -1.0], x0, globalSeparateFaceEdgeAndVertexOutputs);
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetsFanToLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OffsetsWithConeApron", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    let x0 = 0.0;
    const xA = 3.0; // point A (xA,0,0) is on x axis to right.  This is the tip of the strong chamfer
    const yB = 1.0; // point B (0, yB, 0) is on Y axis above, with image at (0,-yB,0).  These are start and end of ellipse apron
    const xC = -3.0; // point C (xC, 0, zC) is an extreme point of the ellipse apron.
    const zC = 0.0;
    // OffsetMeshContext.stringDebugFunction = (message: string) => { GeometryCoreTestIO.consoleLog(message); };

    for (const zCone of [2.0, 0.5, -0.5, 2.0, -2.0, 4.0, -4.0, 10.0]) {  // height of cone point.
      for (const numApronEdges of [8, 2, 4]) {
        const builder = PolyfaceBuilder.create(options);
        const arc = Arc3d.createXYZXYZXYZ(0, 0, 0, 0, yB, 0, xC, 0, zC, AngleSweep.createStartEndDegrees(0, 180));
        const strokes = LineString3d.create();
        const conePoint = Point3d.create(0, 0, zCone);
        strokes.addPointXYZ(xA, 0, 0);
        for (let i = 0; i <= numApronEdges; i++) {
          strokes.addPoint(arc.fractionToPoint(i / numApronEdges));
        }
        strokes.addClosurePoint();
        builder.addTriangleFan(conePoint, strokes, false);
        const polyface = builder.claimPolyface();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, strokes, x0, -8.0);
        x0 = testOffsets(ck, allGeometry, polyface, [0.5], [1.0], x0, globalSeparateFaceEdgeAndVertexOutputs);
        OffsetMeshContext.stringDebugFunction = undefined;
      }
      x0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetsWithConeApron");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OffsetDTM", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    let numTest = 0;
    const numX0 = 3;
    const numY0 = 5;
    const ax = 4.0;
    const ay = 3.0;
    const az = 1.0;

    /*
    OffsetMeshContext.stringDebugFunction =
      (message: string) => { GeometryCoreTestIO.consoleLog(message); };
    */
    for (const densityMultiplier of [1, 2, 4, 8]) {
      const numX = numX0 * densityMultiplier;
      const numY = numY0 * densityMultiplier;
      numTest++;
      const dx = ax / numX;
      const dy = ay / numY;
      const _dZdX = az / numX;
      const _dZdY = az / numY;
      const mesh = Sample.createTriangularUnitGridPolyface(
        Point3d.create(0, 0, 0), Vector3d.create(dx, 0, _dZdX), Vector3d.create(0, dy, _dZdY), numX, numY);
      if (numTest > 0)
        mesh.data.point.mapComponent(2,
          (x: number, y: number, _z: number) => {
            return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
          });
      if (densityMultiplier < 1)
        OffsetMeshContext.stringDebugFunction = (message: string) => { GeometryCoreTestIO.consoleLog(message); };
      x0 = testOffsets(ck, allGeometry, mesh, [0.10], [1.0], x0, globalSeparateFaceEdgeAndVertexOutputs);
      OffsetMeshContext.stringDebugFunction = undefined;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetDTM");
    expect(ck.getNumErrors()).equals(0);
  });
  it("OffsetSampler", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const closedSweeps = Sample.createClosedSolidSampler(true);
    const facetOptions = StrokeOptions.createForCurves();
    facetOptions.shouldTriangulate = true;
    // Checker.noisy.offsetMesh = true;
    if (Checker.noisy.offsetMesh)
      OffsetMeshContext.stringDebugFunction = (message: string) => { GeometryCoreTestIO.consoleLog(message); };

    for (const s of closedSweeps) {
      const builder = PolyfaceBuilder.create(facetOptions);
      builder.addGeometryQuery(s);
      const mesh = builder.claimPolyface();
      const range = mesh.range();

      x0 = testOffsets(ck, allGeometry, mesh, [0.05 * range.xLength()], [1.0, -1.0], x0, globalSeparateFaceEdgeAndVertexOutputs);
    }
    OffsetMeshContext.stringDebugFunction = undefined;

    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetSampler");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OffsetOptionsSampler", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const closedSweeps = Sample.createClosedSolidSampler(true, Angle.createDegrees(-90));
    const openSweeps = Sample.createClosedSolidSampler(false, Angle.createDegrees(-90));
    const allSweeps = closedSweeps.concat(openSweeps);
    const facetOptions = StrokeOptions.createForCurves();
    facetOptions.shouldTriangulate = true;
    // Checker.noisy.offsetMesh = true;
    if (Checker.noisy.offsetMesh)
      OffsetMeshContext.stringDebugFunction = (message: string) => { GeometryCoreTestIO.consoleLog(message); };
    const optionsA = OffsetMeshOptions.create();
    optionsA.chamferAngleBetweenNormals = Angle.createDegrees(150);
    const optionsB = OffsetMeshOptions.create();
    optionsB.chamferAngleBetweenNormals = Angle.createDegrees(85);
    for (const s of allSweeps) {
      const builder = PolyfaceBuilder.create(facetOptions);
      builder.addGeometryQuery(s);
      const mesh = builder.claimPolyface();
      const range = mesh.range();
      x0 = displayOffsetsWithOptionExamples(ck, allGeometry, mesh, 0.05 * range.xLength(), [optionsA, optionsB], x0, !s.capped);
    }
    OffsetMeshContext.stringDebugFunction = undefined;

    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetOptionsSampler");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ChamferExample", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const allSweeps: SolidPrimitive[] = [];
    const a = 5.0;
    const capped = false;
    // make triangles with various angles at the origin.
    for (const degreesBetweenNormals of [30, 45, 70, 85, 110, 140]) {
      const point0 = Point3d.createZero();
      const theta = Angle.createDegrees(180 - degreesBetweenNormals);
      const point1 = Point3d.create(a, 0, 0);
      const point2 = Point3d.create(a * theta.cos(), theta.sin(), 0);
      const solid = LinearSweep.createZSweep([point2, point0, point1], 0, 3, capped)!;
      allSweeps.push(solid);
    }

    // make arcs with various stroking.
    const facetOptions = StrokeOptions.createForCurves();
    facetOptions.shouldTriangulate = true;
    // Checker.noisy.offsetMesh = true;
    if (Checker.noisy.offsetMesh)
      OffsetMeshContext.stringDebugFunction = (message: string) => { GeometryCoreTestIO.consoleLog(message); };
    const optionsA = OffsetMeshOptions.create();
    optionsA.chamferAngleBetweenNormals = Angle.createDegrees(150);
    const optionsB = OffsetMeshOptions.create();
    optionsB.chamferAngleBetweenNormals = Angle.createDegrees(85);
    for (const s of allSweeps) {
      const builder = PolyfaceBuilder.create(facetOptions);
      builder.addGeometryQuery(s);
      const mesh = builder.claimPolyface();
      const range = mesh.range();
      x0 = displayOffsetsWithOptionExamples(ck, allGeometry, mesh, 0.05 * range.xLength(), [optionsA, optionsB], x0, !s.capped);
    }
    OffsetMeshContext.stringDebugFunction = undefined;

    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "ChamferExample");
    expect(ck.getNumErrors()).equals(0);
  });

});

function testOffsets(_ck: Checker, allGeometry: GeometryQuery[], polyface: IndexedPolyface,
  offsets: number[],
  signs: number[],
  xStart: number,
  separateFaceEdgeAndVertexOutputs: boolean = false,
) {
  let y0 = 0;
  let x0 = xStart;
  const range = polyface.data.point.getRange();
  const xStep = Math.max(20.0, 3.0 * range.xLength());
  const yStepA = Math.max(range.yLength(), 10.0);
  const yStepB = separateFaceEdgeAndVertexOutputs ? 10 * yStepA : 3.0 * yStepA;
  const yStepC = yStepA;
  const offsetOptions = OffsetMeshOptions.create();

  for (const offsetSign of signs) {
    x0 = xStart;
    for (const offset of offsets) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
      /*
            const offsetMesh = PolyfaceQuery.cloneOffset(polyface, offsetSign * offset, offsetOptions);
            y0 += yStepC;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetMesh, x0, y0);
      */
      const offsetMeshB = PolyfaceQuery.cloneOffset(polyface, offsetSign * offset, offsetOptions);
      // y0 += 2 * yStepC;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetMeshB, x0, y0);
      // y0 += yStepC;
      if (separateFaceEdgeAndVertexOutputs) {
        for (const outputSelect of
          [
            { outputOffsetsFromFacesBeforeChamfers: true },
            { outputOffsetsFromFaces: true },
            { outputOffsetsFromEdges: true },
            { outputOffsetsFromVertices: true },
            { outputOffsetsFromVerticesBeforeChamfers: true },
            undefined,
          ]) {
          y0 += yStepC;
          offsetOptions.outputSelector = outputSelect;
          const offsetMeshA = PolyfaceQuery.cloneOffset(polyface, offsetSign * offset, offsetOptions);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetMeshA, x0, y0);
        }
      }
      x0 += xStep;
    }
    y0 += yStepB;
  }
  return x0;
}
/**
 * @param originalWithOffsets if true, output the original in situ with each offset.  if false, only output the original at start.
 */
function displayOffsetsWithOptionExamples(_ck: Checker, allGeometry: GeometryQuery[], polyface: IndexedPolyface,
  offset: number,
  optionsArray: OffsetMeshOptions[],
  xStart: number,
  originalWithOffsets: boolean,
) {
  let x0 = xStart;
  const range = polyface.data.point.getRange();
  const xStep = Math.max(range.xLength(), 10.0);
  const yStepA = Math.max(range.yLength(), 10.0);

  let y0 = 0;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
  y0 += yStepA;
  for (const offsetOptions of optionsArray) {
    /*
          const offsetMesh = PolyfaceQuery.cloneOffset(polyface, offsetSign * offset, offsetOptions);
          y0 += yStepC;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetMesh, x0, y0);
    */
    const offsetMeshB = PolyfaceQuery.cloneOffset(polyface, offset, offsetOptions);
    if (originalWithOffsets)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, offsetMeshB, x0, y0);
    y0 += yStepA;
  }
  x0 += xStep;
  return x0;
}
