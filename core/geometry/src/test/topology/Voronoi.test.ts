import * as fs from "fs";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Arc3d, LineSegment3d, LineString3d, StrokeOptions } from "../../core-geometry";
import { BagOfCurves } from "../../curve/CurveCollection";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { Triangulator } from "../../topology/Triangulation";
import { Voronoi } from "../../topology/Voronoi";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

function createBagOfCurves(graph: HalfEdgeGraph): BagOfCurves {
  const bag = BagOfCurves.create();
  graph.announceEdges(
    (_g: HalfEdgeGraph, seed: HalfEdge) => {
      bag.children.push(LineSegment3d.create(seed.getPoint3d(), seed.edgeMate.getPoint3d()));
      return true;
    }
  );
  return bag;
}

describe("Voronoi", () => {
  it.only("InvalidGraph", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(-1, -1, 1, -1);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(1, -1, 1, 1);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(1, 1, -1, 1);
    const node5 = node4.faceSuccessor;
    const node6 = graph.addEdgeXY(-1, 1, -1, -1);
    const node7 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node6);
    HalfEdge.pinch(node7, node0);
    ck.testUndefined(Voronoi.createVoronoi(graph), "expect undefined for a graph with a non-triangle face");

    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("CollinearPoints", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    let points = [[0, 0], [2, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]));
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1);
    let voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
    }

    let dx = 6;
    points = [[1, -1], [1, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
    }

    dx += 5;
    points = [[1, 0], [2, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 5, "Voronoi should have 5 edges");
    }

    dx += 6;
    points = [[1, 1], [5, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
    }

    // 3d single edge graph
    dx += 9;
    points = [[1, 1, 1], [5, -1, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
    }

    dx += 9;
    points = [[1, 1], [2, 1], [5, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi should have 10 edges");
    }
    dx += 11;
    points = [[1, 1], [4, 4], [-1, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi should have 10 edges");
    }

    dx += 9;
    points = [[0, 0], [3, 1], [9, 3], [6, 2]];
    pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi should have 13 edges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "CollinearPoints");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith1Triangle", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    let graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(-3, 0, 0, -1);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(0, -1, 0, 1);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(0, 1, -3, 0);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    graph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node1.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph));

    let voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi should have 10 edges");
    }

    const dy = 8;
    let points = [[-3, 0], [0, -1], [0, 1]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, Loop.create(LineString3d.create(pts)), 0, dy);
    const voronoiPts = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiPts), 0, dy);
      ck.testCoordinate(voronoiPts.collectFaceLoops().length, 4, "Voronoi from points should have 4 faces");
      ck.testCoordinate(voronoiPts.allHalfEdges.length / 2, 10, "Voronoi from points should have 10 edges");
    }

    let dx = 8;
    points = [[-3, 0], [0, 1.5], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi from points should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi from points should have 10 edges");
    }

    // 3d triangle
    dx += 11;
    points = [[-3, 0, 1], [0, 1.5, 0], [3, 0, -2]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi  for 3d should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi  for 3d should have 10 edges");
    }

    // skinny triangle
    dx += 14;
    points = [[-3, 0], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    const pad = { x: 5, y: 3 };
    voronoi = Voronoi.createVoronoi(graph, pad);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi from points should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi from points should have 10 edges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith1Triangle");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith2Triangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    let graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(-3, 0, 0, -1);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(0, -1, 0, 1);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(0, 1, -3, 0);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    const node6 = graph.addEdgeXY(0, -1, 3, 0);
    const node7 = node6.faceSuccessor;
    const node8 = graph.addEdgeXY(3, 0, 0, 1);
    const node9 = node8.faceSuccessor;
    HalfEdge.pinch(node7, node8);
    HalfEdge.pinch(node3, node9);
    HalfEdge.pinch(node1, node6);
    graph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node2.clearMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE);
    node1.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph));

    let voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi should have 13 edges");
    }

    const dy = 8;
    let points = [[-3, 0], [0, -1], [0, 1], [3, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    const voronoiPts = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiPts), 0, dy);
      ck.testCoordinate(voronoiPts.collectFaceLoops().length, 5, "Voronoi from points should have 5 faces");
      ck.testCoordinate(voronoiPts.allHalfEdges.length / 2, 13, "Voronoi from points should have 13 edges");
    }

    let dx = 8;
    points = [[0, 0], [3, 4], [4, 4], [6, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi should have 13 edges");
    }

    dx += 11;
    points = [[0, 0], [3, 4], [4, 4], [7, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 12, "Voronoi should have 12 edges");
    }

    // 3d triangle
    dx += 12;
    points = [[0, 0, -2], [3, 4, 0], [4, 4, 1], [7, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi for 3d should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 12, "Voronoi for 3d should have 12 edges");
    }

    // skinny triangles
    dx += 15;
    points = [[-3, 0], [0, -0.1], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi from points should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi from points should have 13 edges");
    }

    // includes skinny triangle
    dx += 11;
    points = [[-3, 0], [0, -0.1], [0, 1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi from points should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi from points should have 13 edges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith2Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith3Triangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    let points = [[-3, -2], [-1, 1], [0, -3], [4, -1], [4, 3]];
    let pts = IModelJson.Reader.parsePointArray(points);
    let graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph));
    let voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi should have 16 edges");
    }

    // 3d triangle
    let dx = 12;
    points = [[-3, -2, 2], [-1, 1, 1], [0, -3, 5], [4, -1, -3], [4, 3, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi for 3d should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi for 3d should have 16 edges");
    }

    // includes skinny triangle
    dx += 12;
    points = [[-3, -2], [0, 0], [0, -3], [4, -1], [4, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi should have 16 edges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith3Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith4Triangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    let points = [[-2, 0], [0, 0], [0, -3], [0, -1], [5, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    let graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph));
    let voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi should have 16 edges");
    }

    // 3d triangle
    let dx = 12;
    points = [[-2, 0, 0], [0, 0, 1], [0, -3, 5], [0, -1, -3], [5, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi for 3d should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi for 3d should have 16 edges");
    }

    // includes skinny triangle
    dx += 12;
    points = [[-2, 0], [0, 0], [0, -3], [0, -0.1], [5, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi should have 16 edges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith4Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWithManyTriangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    let points = [[-10, 8], [4, 3], [-2, 3], [-1, 2], [2, 0], [-1, -3], [3, -2], [-2, -7], [6, -7], [7, -6]];
    let pts = IModelJson.Reader.parsePointArray(points);
    let graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph));
    let voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 11, "Voronoi should have 11 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 30, "Voronoi should have 30 edges");
    }

    // 3d triangle
    const dx = 22;
    points = [
      [-10, 8, -2], [4, 3, -1], [-2, 3, 3], [-1, 2, -3], [2, 0, 0],
      [-1, -3, 4], [3, -2, 1], [-2, -7, -1], [6, -7, 3], [7, -6, -2],
    ];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 11, "Voronoi for 3d should have 11 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 30, "Voronoi for 3d should have 30 edges");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWithManyTriangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("ColinearCurveChain", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const lineSegment0 = LineSegment3d.createXYXY(-2, 0, 0, 0);
    const lineSegment1 = LineSegment3d.createXYXY(0, 0, 4, 0);
    const lineSegment2 = LineSegment3d.createXYXY(4, 0, 5, 0);

    const path = Path.create(lineSegment0, lineSegment1, lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.5;
    const voronoi = Voronoi.createVoronoiFromCurveChain(path, strokeOptions);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, voronoi);
      ck.testCoordinate(voronoi.length, 3, "Voronoi should have 3 faces");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "ColinearCurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("CurveChain", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const lineSegment0 = LineSegment3d.createXYXY(-3, 0, 0, 0);
    const lineSegment1 = LineSegment3d.createXYXY(0, 0, 2, 2);
    const arc0 = Arc3d.createCircularStartMiddleEnd(Point3d.create(2, 2), Point3d.create(3, 3), Point3d.create(4, 2));
    const lineString = LineString3d.create([4, 2], [7, 2], [9, 5]);
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(9, 5), Point3d.create(7, 7), Point3d.create(9, 8));
    const path = Path.create(lineSegment0, lineSegment1, arc0, lineString, arc1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.2;
    const pad = { x: 2, y: 5 };
    const voronoi = Voronoi.createVoronoiFromCurveChainTMP(path, strokeOptions, pad);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      // ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "CurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("PathFromJson1", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_linesegment.json", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testCoordinate(path.children.length, 7, "path should have 7 children");

    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 20;
    let strokePoints: Point3d[] = [];
    const voronoi = Voronoi.createVoronoiFromCurveChainTMP(path, strokeOptions, undefined, strokePoints);
    if (ck.testDefined(voronoi)) {
      for (const pt of strokePoints)
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 4);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      // ck.testCoordinate(voronoi.collectFaceLoops().length, path.children.length, "Voronoi should have 7 faces");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson1");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("PathFromJson2", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_linestring.json", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testCoordinate(path.children.length, 18, "path should have 18 children");

    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 40;
    let strokePoints: Point3d[] = [];
    const voronoi = Voronoi.createVoronoiFromCurveChainTMP(path, strokeOptions, undefined, strokePoints);
    if (ck.testDefined(voronoi)) {
      for (const pt of strokePoints)
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 4);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      // ck.testCoordinate(voronoi.collectFaceLoops().length, path.children.length, "Voronoi should have 18 faces");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson2");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("PathFromJson3", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_spirals.json", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testCoordinate(path.children.length, 9, "path should have 9 children");

    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 200;
    let strokePoints: Point3d[] = [];
    const voronoi = Voronoi.createVoronoiFromCurveChainTMP(path, strokeOptions, undefined, strokePoints);
    if (ck.testDefined(voronoi)) {
      for (const pt of strokePoints)
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 4);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      // ck.testCoordinate(voronoi.collectFaceLoops().length, path.children.length, "Voronoi should have 9 faces");
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson3");
    expect(ck.getNumErrors()).toBe(0);
  });
});