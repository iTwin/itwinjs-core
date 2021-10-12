/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import * as fs from "fs";
import { Checker } from "../Checker";
import { HalfEdgeGraphSpineContext } from "../../topology/HalfEdgeGraphSpineContext";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Angle } from "../../geometry3d/Angle";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { MultiLineStringDataVariant } from "../../topology/Triangulation";
import { RegularizationContext } from "../../topology/RegularizeFace";
import { HalfEdge, HalfEdgeGraph } from "../../topology/Graph";
import { LineSegment3d } from "../../curve/LineSegment3d";

function loadSpineGraph(context: HalfEdgeGraphSpineContext, data: any) {
  if (Array.isArray(data) && data[0] instanceof Point3d) {
    context.insertEdges(data, true);
  } else if (data instanceof GrowableXYZArray) {
    context.insertEdges(data.getPoint3dArray(), true);
  } else if (data instanceof Loop) {
    const packedPoints = data.getPackedStrokes();
    if (packedPoints)
      context.insertEdges(packedPoints.getPoint3dArray(), true);
  } else if (data instanceof ParityRegion) {
    for (const loop of data.children) {
      loadSpineGraph(context, loop);
    }
  } else if (Array.isArray(data)) {
    for (const child of data) {
      loadSpineGraph(context, child);
    }
  }

}
function testSpineLoop(allGeometry: GeometryQuery[], loopPoints: any, x0: number, y0: number) {
  const range = RegionOps.curveArrayRange(loopPoints);
  const zSpine = 0.04;
  const yStep = Math.floor(range.yLength()) + 2;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, loopPoints, x0, y0, 0);
  RegularizationContext.announceEdge = (_graph: HalfEdgeGraph, nodeA: HalfEdge, nodeB: HalfEdge, scale: number) => {
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYXY(nodeA.x * scale, nodeA.y * scale, nodeB.x * scale, nodeB.y * scale), x0, y0);
  };
  const context = new HalfEdgeGraphSpineContext();
  loadSpineGraph(context, loopPoints);
  context.triangulateForSpine();
  RegularizationContext.announceEdge = undefined;

  GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(context.graph), x0, y0 += yStep, 0);
  context.consolidateTrianglesToQuads(true);
  for (const includeSpokes of [false, true]) {
    const edges = context.getSpineEdges(true, true, includeSpokes);
    GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(context.graph), x0, y0 += yStep, 0);
    for (const e of edges)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, e, x0, y0, zSpine);
  }

  context.teardown();
}

describe("HalfEdgeGraphSpineContext", () => {

  it("SmallGraph", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const xStep = 20.0;
    let x0 = 0;
    const ax = 8;
    const ay = 4;
    const bx = 4;
    testSpineLoop(allGeometry,
      [Point3d.create(0, 0), Point3d.create(ax, 0), Point3d.create(ax, ay), Point3d.create(0, ay), Point3d.create(0, 0)],
      x0, 0);
    x0 += ax + 2;
    testSpineLoop(allGeometry,
      [Point3d.create(0, 0), Point3d.create(ax, 0), Point3d.create(bx, ay), Point3d.create(0, 0)],
      x0, 0);
    x0 += ax + 2;

    for (const cornerY of [0, 1, 0.2]) {
      const loopPoints = [Point3d.create(0, 0), Point3d.create(10, cornerY), Point3d.create(10, 5)];
      loopPoints.push(Point3d.create(15, 5), Point3d.create(15, 6), Point3d.create(2, 6), Point3d.create(2, 5 - cornerY));
      loopPoints.push(Point3d.create(9, 5, 0), Point3d.create(9, 1 + cornerY));
      loopPoints.push(Point3d.create(0, 1), Point3d.create(0, 0));
      testSpineLoop(allGeometry, loopPoints, x0, 0);
      x0 += xStep;
    }
    x0 += xStep;
    const skewTransform = Transform.createFixedPointAndMatrix(undefined, Matrix3d.createScale(1, 0.8, 1));
    for (const numStarPoints of [4, 3, 7]) {
      const starLoop = Sample.createStar(5, 5, 0, 2, 5, numStarPoints, true, Angle.createDegrees(15));
      testSpineLoop(allGeometry, starLoop, x0, 0);
      x0 += xStep;
      // Compress the star and observe variation in routing through the convex core
      for (let skewCount = 0; skewCount < 3; skewCount++) {
        skewTransform.multiplyPoint3dArrayInPlace(starLoop);
        testSpineLoop(allGeometry, starLoop, x0, 0);
        x0 += xStep;
      }
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "HalfEdgeGraphSpineContext", "SmallGraph");
  });
  it("XYBoundaryFiles", () => {
    // const ck = new Checker();
    // const y0 = 0;
    let x0 = 0.0;
    const allGeometry: GeometryQuery[] = [];
    const inner = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/inner.imjs", "utf8")));
    const innerA = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/innerSimplifiedA.imjs", "utf8")));
    const innerB = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/innerSimplifiedB.imjs", "utf8")));
    const innerC = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/innerSimplifiedC.imjs", "utf8")));
    const innerD = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/innerSimplifiedD.imjs", "utf8")));
    const outer = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(
      "./src/test/testInputs/intersections/MBContainmentBoolean/outer.imjs", "utf8")));
    for (const data of [innerD, innerC, innerB, inner, outer, innerA, innerB]) {
      // testSpineLoop(allGeometry, data, x0, 0);
      const flatData = flattenRegions(data as any[]);
      const singleRegion = RegionOps.polygonBooleanXYToLoops(flatData, RegionBinaryOpType.Union, []);
      testSpineLoop(allGeometry, singleRegion, x0, 500);
      x0 += 100;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "HalfEdgeGraphSpineContext", "XYBoundaryFiles");
  });

});

function flattenRegions(data: any[]): MultiLineStringDataVariant[] {
  const polygons: MultiLineStringDataVariant[] = [];
  for (const g of data) {
    if (g instanceof Loop) {
      polygons.push(g.getPackedStrokes()!.getPoint3dArray());
    } else if (g instanceof ParityRegion) {
      const q = [];
      for (const c of g.children) {
        q.push(c.getPackedStrokes()!.getPoint3dArray());
      }
      polygons.push(q);
    }
  }
  return polygons;
}
