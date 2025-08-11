import * as fs from "fs";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ClipUtilities, PolygonClipper } from "../../clipping/ClipUtils";
import { Arc3d } from "../../curve/Arc3d";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurveOps } from "../../curve/CurveOps";
import { AnyCurve } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop, SignedLoops } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { RegionOps } from "../../curve/RegionOps";
import { IntegratedSpiral3d } from "../../curve/spiral/IntegratedSpiral3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3dArrayCarrier } from "../../geometry3d/Point3dArrayCarrier";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { GrowableXYZArrayCache } from "../../geometry3d/ReusableObjectCache";
import { MomentData } from "../../geometry4d/MomentData";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Point3dArrayRangeTreeContext } from "../../polyface/RangeTree/Point3dArrayRangeTreeContext";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphOps } from "../../topology/Merging";
import { Triangulator } from "../../topology/Triangulation";
import { Voronoi } from "../../topology/Voronoi";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { getRandomNumber } from "../testFunctions";

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

// verify the voronoi graph follows the expected topology by checking 10 random points
// and making sure the point belongs to the voronoi face with the expected faceTag
function verifyVoronoi(ck: Checker, graph: HalfEdgeGraph, voronoi: HalfEdgeGraph): void {
  const voronoiPts: Point3d[] = [];
  voronoi.allHalfEdges.forEach((he) => { voronoiPts.push(he.getPoint3d()); });
  const voronoiSearcher = Point3dArrayRangeTreeContext.createCapture(voronoiPts);
  const graphPoints = graph.allHalfEdges.map((he) => he.getPoint3d());
  const graphUniquePoints = Array.from(new Set(graphPoints.map(p => `${p.x},${p.y}`)))
    .map(p => p.split(',').map(Number))
    .map(p => Point3d.create(p[0], p[1]));
  const graphSearcher = Point3dArrayRangeTreeContext.createCapture(graphUniquePoints);
  const range = HalfEdgeGraphOps.graphRange(voronoi);
  if (voronoiSearcher && graphSearcher) {
    for (let i = 0; i < 10; i++) {
      const spacePoint = Point3d.create(getRandomNumber(range.xLow, range.xHigh), getRandomNumber(range.yLow, range.yHigh));
      const closestVoronoiPoint = voronoiSearcher.searchForClosestPoint(spacePoint);
      if (closestVoronoiPoint === undefined || Array.isArray(closestVoronoiPoint)) {
        ck.announceError("one point should be found");
      } else {
        let closestVoronoiVertex: HalfEdge | undefined;
        let closestVoronoiHalfEdge: HalfEdge | undefined;
        for (const he of voronoi.allHalfEdges) {
          if (he.getPoint3d().isExactEqual(closestVoronoiPoint.point)) {
            closestVoronoiVertex = he;
            break;
          }
        }
        const spaceNode = new HalfEdge();
        spaceNode.x = spacePoint.x;
        spaceNode.y = spacePoint.y;
        closestVoronoiVertex?.collectAroundVertex(
          (node) => {
            if (HalfEdge.isNodeVisibleInSector(spaceNode, node) && !node.isMaskSet(HalfEdgeMask.EXTERIOR))
              closestVoronoiHalfEdge = node;
          }
        );
        const closestGraphPoint = graphSearcher.searchForClosestPoint(spacePoint);
        if (closestGraphPoint === undefined || Array.isArray(closestGraphPoint)) {
          ck.announceError("one point should be found");
        } else {
          let expectedFaceTag = Number.MAX_VALUE;
          const closestGraphPointXY = closestGraphPoint.point;
          closestGraphPointXY.setAt(2, 0); // set z = 0
          for (let j = 0; j < graph.allHalfEdges.length; j++) {
            const he = graph.allHalfEdges[j];
            const heXY = he.getPoint3d();
            heXY.setAt(2, 0); // set z = 0
            if (heXY.isExactEqual(closestGraphPointXY)) {
              expectedFaceTag = j;
              break;
            }
          }
          ck.testCoordinate(
            closestVoronoiHalfEdge?.faceTag,
            expectedFaceTag,
            "point (" + spacePoint.x + ", " + spacePoint.y + ") belongs to the face with faceTag " + expectedFaceTag,
          );
        }
      }
    }
  }
}

// compare the lengths and centroids of the path children to the clipped curves
function comparePathToClippedCurves(
  allGeometry: GeometryQuery[], ck: Checker, path: Path, clippedCurves: AnyCurve[][], dz = 100,
): void {
  const clippedCurvesLengths: number[] = [];
  const clippedCurvesCentroids: Point3d[] = [];
  const clippedCurvesMoments: MomentData[] = [];
  for (const clippedCurve of clippedCurves) {
    const clippedPath = CurveOps.collectChains(clippedCurve);
    if (ck.testType(clippedPath, Path, "clipped curves successfully assembled into a Path")) {
      RegionOps.consolidateAdjacentPrimitives(clippedPath);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPath, 0, 0, dz);
      const momentData = RegionOps.computeXYZWireMomentSums(clippedPath);
      if (ck.testDefined(momentData)) {
        const length = momentData.quantitySum;
        clippedCurvesLengths.push(length);
        const centroid = momentData.origin;
        clippedCurvesCentroids.push(centroid);
        clippedCurvesMoments.push(momentData);
      }
    }
  }
  const childrenLengths: number[] = [];
  const childrenCentroids: Point3d[] = [];
  const childrenMoments: MomentData[] = [];
  for (const child of path.children) {
    const momentData = RegionOps.computeXYZWireMomentSums(child);
    if (ck.testDefined(momentData)) {
      const length = momentData.quantitySum;
      childrenLengths.push(length);
      const centroid = momentData.origin;
      childrenCentroids.push(centroid);
      childrenMoments.push(momentData);
    }
  }
  ck.testNumberArray(clippedCurvesLengths, childrenLengths, "clipped chain yields expected lengths");
  ck.testPoint3dArray(clippedCurvesCentroids, childrenCentroids, "clipped chain yields expected centroids");
}

function captureClippers(allGeometry: GeometryQuery[], ck: Checker, clippers: PolygonClipper[], range: Range3d): void {
  const xyPolygon = range.rectangleXY(0, true, true);
  if (xyPolygon) {
    const cache = new GrowableXYZArrayCache();
    const inside: GrowableXYZArray[] = [];
    const outside: GrowableXYZArray[] = [];
    const xyPolygonCarrier = new Point3dArrayCarrier(xyPolygon);
    for (const clipper of clippers) {
      clipper.appendPolygonClip(xyPolygonCarrier, inside, outside, cache);
      const loops: Loop[] = [];
      for (const polygon of inside)
        loops.push(Loop.createPolygon(polygon));
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops, 0, 0, 100);
      const components = RegionOps.constructAllXYRegionLoops(loops);
      // don't count components with just sliver faces
      const numNegativeAreaFaces = components.reduce((count: number, component: SignedLoops) => count + component.negativeAreaLoops.length, 0);
      ck.testExactNumber(1, numNegativeAreaFaces, "clipper is a single swept xy-region with no holes");
      for (const component of components)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, component.negativeAreaLoops);
      cache.dropAllToCache(inside);
      cache.dropAllToCache(outside);
    }
  }
}

describe("Voronoi", () => {
  it("InvalidGraph", () => {
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

  it("ColinearPoints", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let points = [[0, 0], [2, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    let graph = new HalfEdgeGraph();
    graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]));
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1);

    let voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    let dx = 6;
    points = [[1, -1], [1, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    dx += 5;
    points = [[1, 0], [2, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 5, "Voronoi should have 5 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    dx += 6;
    points = [[1, 1], [5, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    // 3d single edge graph
    dx += 9;
    points = [[1, 1, 1], [5, -1, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 3, "Voronoi should have 3 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 7, "Voronoi should have 7 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    dx += 9;
    points = [[1, 1], [2, 1], [5, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    let node0 = graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    let node1 = graph.addEdgeXY(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    HalfEdge.pinch(node0.faceSuccessor, node1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi should have 10 edges");
      verifyVoronoi(ck, graph, voronoi);
    }
    dx += 11;
    points = [[-1, -1], [1, 1], [4, 4]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    node0 = graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    node1 = graph.addEdgeXY(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    HalfEdge.pinch(node0.faceSuccessor, node1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi should have 10 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    dx += 9;
    points = [[0, 0], [3, 1], [6, 2], [9, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = new HalfEdgeGraph();
    node0 = graph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    node1 = graph.addEdgeXY(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    const node2 = graph.addEdgeXY(pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    HalfEdge.pinch(node0.faceSuccessor, node1);
    HalfEdge.pinch(node1.faceSuccessor, node2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi should have 13 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "ColinearPoints");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith1Triangle", () => {
    const ck = new Checker();
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
      verifyVoronoi(ck, graph, voronoi);
    }

    const dy = 8;
    let points = [[-3, 0], [0, -1], [0, 1]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), 0, dy);
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
      verifyVoronoi(ck, graph, voronoi);
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
      verifyVoronoi(ck, graph, voronoi);
    }

    // skinny triangle
    dx += 11;
    points = [[-3, 0], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 4, "Voronoi from points should have 4 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 10, "Voronoi from points should have 10 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith1Triangle");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith2Triangles", () => {
    const ck = new Checker();
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
      verifyVoronoi(ck, graph, voronoi);
    }

    const dy = 11;
    let points = [[-3, 0], [0, -1], [0, 1], [3, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), 0, dy);
    const voronoiPts = Voronoi.createVoronoiFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiPts), 0, dy);
      ck.testCoordinate(voronoiPts.collectFaceLoops().length, 5, "Voronoi from points should have 5 faces");
      ck.testCoordinate(voronoiPts.allHalfEdges.length / 2, 13, "Voronoi from points should have 13 edges");
    }

    let dx = 11;
    points = [[0, 0], [3, 4], [4, 4], [6, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi should have 13 edges");
      verifyVoronoi(ck, graph, voronoi);
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
      verifyVoronoi(ck, graph, voronoi);
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
      verifyVoronoi(ck, graph, voronoi);
    }

    // skinny triangles
    dx += 18;
    points = [[-3, 0], [0, -0.1], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi from points should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi from points should have 13 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    // includes skinny triangle
    dx += 17;
    points = [[-3, 0], [0, -0.1], [0, 1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 5, "Voronoi from points should have 5 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 13, "Voronoi from points should have 13 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith2Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith3Triangles", () => {
    const ck = new Checker();
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
      verifyVoronoi(ck, graph, voronoi);
    }

    // 3d triangle
    let dx = 18;
    points = [[-3, -2, 2], [-1, 1, 1], [0, -3, 5], [4, -1, -3], [4, 3, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi for 3d should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi for 3d should have 16 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    // includes skinny triangle
    dx += 62;
    points = [[-3, -2], [0, 0], [0, -3], [4, -1], [4, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi should have 16 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith3Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith4Triangles", () => {
    const ck = new Checker();
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
      verifyVoronoi(ck, graph, voronoi);
    }

    // 3d triangle
    let dx = 21;
    points = [[-2, 0, 0], [0, 0, 1], [0, -3, 5], [0, -1, -3], [5, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi for 3d should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi for 3d should have 16 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    // includes skinny triangle
    dx += 21;
    points = [[-2, 0], [0, 0], [0, -3], [0, -0.1], [5, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph), dx);
    voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi), dx);
      ck.testCoordinate(voronoi.collectFaceLoops().length, 6, "Voronoi should have 6 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 16, "Voronoi should have 16 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith4Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWithManyTriangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let points = [[-10, 8], [4, 3], [-2, 3], [-1, 2], [2, 0], [-1, -3], [3, -2], [-2, -7], [6, -7], [7, -6]];
    let pts = IModelJson.Reader.parsePointArray(points);
    let graph = Triangulator.createTriangulatedGraphFromPoints(pts)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(graph));
    let voronoi = Voronoi.createVoronoi(graph);
    if (ck.testDefined(voronoi)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoi));
      ck.testCoordinate(voronoi.collectFaceLoops().length, 11, "Voronoi should have 11 faces");
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 31, "Voronoi should have 31 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    // 3d triangle
    const dx = 62;
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
      ck.testCoordinate(voronoi.allHalfEdges.length / 2, 31, "Voronoi for 3d should have 31 edges");
      verifyVoronoi(ck, graph, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWithManyTriangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("ColinearCurveChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const lineSegment0 = LineSegment3d.createXYXY(-2, 0, 0, 0);
    const lineSegment1 = LineSegment3d.createXYXY(0, 0, 4, 0);
    const lineSegment2 = LineSegment3d.createXYXY(4, 0, 5, 0);
    const path = Path.create(lineSegment0, lineSegment1, lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.5;
    const clippers = Voronoi.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions)!;
    if (ck.testDefined(clippers))
      ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 3 faces");
    const clippedCurves: AnyCurve[][] = [];
    for (const clipperUnions of clippers)
      clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
    comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "ColinearCurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CurveChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lineSegment0 = LineSegment3d.createXYXY(-3, 0, 0, 0);
    const lineSegment1 = LineSegment3d.createXYXY(0, 0, 2, 2);
    const arc0 = Arc3d.createCircularStartMiddleEnd(Point3d.create(2, 2), Point3d.create(3, 3), Point3d.create(4, 2));
    const lineString = LineString3d.create([4, 2], [7, 2], [9, 5]);
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(9, 5), Point3d.create(7, 7), Point3d.create(9, 8));
    const path = Path.create(lineSegment0, lineSegment1, arc0, lineString, arc1);
    for (const child of path.children)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, child);
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.5;
    const clippers = Voronoi.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions)!;
    ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 5 faces");
    captureClippers(allGeometry, ck, clippers, path.range());
    const clippedCurves: AnyCurve[][] = [];
    for (const clipperUnions of clippers)
      clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
    comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "CurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("PathFromJson0", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_linesegment.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testCoordinate(path.children.length, 7, "path should have 7 children");
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 20;
    const clippers = Voronoi.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions)!;
    ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 7 faces");
    captureClippers(allGeometry, ck, clippers, path.range());
    const clippedCurves: AnyCurve[][] = [];
    for (const clipperUnions of clippers)
      clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
    comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson0");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("PathFromJson1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_linestring.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testCoordinate(path.children.length, 18, "path should have 18 children");
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 200;
    const clippers = Voronoi.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions)!;
    ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 18 faces");
    const clippedCurves: AnyCurve[][] = [];
    for (const clipperUnions of clippers)
      clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
    comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson1");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("PathFromJson2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_spirals.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testCoordinate(path.children.length, 9, "path should have 9 children");
    // Temp Code: approximate spirals. Remove this after backlog issue 1574 is fixed.
    const approximatedPath: Path = Path.create();
    for (const child of path.children) {
      if (child instanceof IntegratedSpiral3d) {
        approximatedPath.children.push(child.constructOffsetXY(0.0)!);
      } else {
        approximatedPath.children.push(child);
      }
    }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, approximatedPath);
    // Temp Code end
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 200;
    const clippers = Voronoi.createClippersForRegionsClosestToCurvePrimitivesXY(approximatedPath, strokeOptions)!;
    ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 9 faces");
    captureClippers(allGeometry, ck, clippers, path.range());
    const clippedCurves: AnyCurve[][] = [];
    for (const clipperUnions of clippers)
      clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
    comparePathToClippedCurves(allGeometry, ck, path, clippedCurves, 50);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson2");
    expect(ck.getNumErrors()).toBe(0);
  });
});
