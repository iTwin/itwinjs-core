import * as fs from "fs";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { Arc3d, LineSegment3d, LineString3d, StrokeOptions } from "../../core-geometry";
import { BagOfCurves } from "../../curve/CurveCollection";
import { AnyCurve } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Path } from "../../curve/Path";
import { RegionOps } from "../../curve/RegionOps";
import { IntegratedSpiral3d } from "../../curve/spiral/IntegratedSpiral3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
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
function verifyVoronoiTopology(ck: Checker, delaunay: HalfEdgeGraph, voronoi: HalfEdgeGraph): void {
  const voronoiPts: Point3d[] = [];
  voronoi.allHalfEdges.forEach((he) => { voronoiPts.push(he.getPoint3d()); });
  const voronoiSearcher = Point3dArrayRangeTreeContext.createCapture(voronoiPts);
  const delaunayPoints = delaunay.allHalfEdges.map((he) => he.getPoint3d());
  const delaunayUniquePoints = Array.from(new Set(delaunayPoints.map(p => `${p.x},${p.y}`)))
    .map(p => p.split(',').map(Number))
    .map(p => Point3d.create(p[0], p[1]));
  const delaunaySearcher = Point3dArrayRangeTreeContext.createCapture(delaunayUniquePoints);
  const range = HalfEdgeGraphOps.graphRange(voronoi);
  if (voronoiSearcher && delaunaySearcher) {
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
        const closestDelaunayPoint = delaunaySearcher.searchForClosestPoint(spacePoint);
        if (closestDelaunayPoint === undefined || Array.isArray(closestDelaunayPoint)) {
          ck.announceError("one point should be found");
        } else {
          let expectedFaceTag = Number.MAX_VALUE;
          const closestDelaunayPointXY = closestDelaunayPoint.point;
          closestDelaunayPointXY.setAt(2, 0); // set z = 0
          for (let j = 0; j < delaunay.allHalfEdges.length; j++) {
            const he = delaunay.allHalfEdges[j];
            const heXY = he.getPoint3d();
            heXY.setAt(2, 0); // set z = 0
            if (heXY.isExactEqual(closestDelaunayPointXY)) {
              expectedFaceTag = j;
              break;
            }
          }
          ck.testCoordinate(
            closestVoronoiHalfEdge?.faceTag,
            expectedFaceTag,
            `point ("${spacePoint.x}", "${spacePoint.y}") belongs to the face with faceTag "${expectedFaceTag}"`,
          );
        }
      }
    }
  }
}

// compare the lengths and centroids of the path children to the clipped curves
function comparePathToClippedCurves(
  allGeometry: GeometryQuery[], ck: Checker, path: Path, clippedCurves: AnyCurve[][], dx: number,
): void {
  const clippedCurvesLengths: number[] = [];
  const clippedCurvesCentroids: Point3d[] = [];
  for (const clippedCurve of clippedCurves) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedCurve, dx);
    const curve = Path.create();
    for (const c of clippedCurve)
      curve.tryAddChild(c);
    const momentData = RegionOps.computeXYZWireMomentSums(curve);
    if (ck.testDefined(momentData)) {
      const length = momentData.quantitySum;
      clippedCurvesLengths.push(parseFloat(length.toFixed(6)));
      const centroid = momentData.origin;
      clippedCurvesCentroids.push(centroid);
    }
  }
  const childrenLengths: number[] = [];
  const childrenCentroids: Point3d[] = [];
  for (const child of path.children) {
    const momentData = RegionOps.computeXYZWireMomentSums(child);
    if (ck.testDefined(momentData)) {
      const length = momentData.quantitySum;
      childrenLengths.push(parseFloat(length.toFixed(6)));
      const centroid = momentData.origin;
      childrenCentroids.push(centroid);
    }
  }
  ck.testTrue(clippedCurvesLengths.every((val, index) => val === childrenLengths[index]));
  ck.testTrue(clippedCurvesCentroids.every((val, index) => val.isAlmostEqual(childrenCentroids[index])));
  // KEEP console.logs FOR DEBUGGING
  // for (let i = 0; i < clippedCurvesLengths.length; i++)
  //   console.log(`${i} clippedLength: ${clippedCurvesLengths[i]} | childLength: ${childrenLengths[i]}`);
  // for (let i = 0; i < clippedCurvesCentroids.length; i++)
  //   console.log(
  //     `${i} clippedCentroid: ${clippedCurvesCentroids[i].x},${clippedCurvesCentroids[i].y}` +
  //     ` | childCentroid: ${childrenCentroids[i].x},${childrenCentroids[i].y}`
  //   );
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
    ck.testUndefined(Voronoi.createFromDelaunay(graph), "expect undefined for a graph with a non-triangle face");

    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("ColinearPoints", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;

    let points = [[0, 0], [2, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    let colinearGraph = new HalfEdgeGraph();
    colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]));
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1);

    let voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph));
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    let dx = 6;
    points = [[1, -1], [1, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    dx += 5;
    points = [[1, 0], [2, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 5, "voronoiGraph should have 5 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    dx += 6;
    points = [[1, 1], [5, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    // 3d single edge graph
    dx += 9;
    points = [[1, 1, 1], [5, -1, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pts[0], pts[1]), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    dx += 9;
    points = [[1, 1], [2, 1], [5, 1]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    let node0 = colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    let node1 = colinearGraph.addEdgeXY(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    HalfEdge.pinch(node0.faceSuccessor, node1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph should have 4 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph should have 10 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }
    dx += 11;
    points = [[-1, -1], [1, 1], [4, 4]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    node0 = colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    node1 = colinearGraph.addEdgeXY(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    HalfEdge.pinch(node0.faceSuccessor, node1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph should have 4 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph should have 10 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    dx += 9;
    points = [[0, 0], [3, 1], [6, 2], [9, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    colinearGraph = new HalfEdgeGraph();
    node0 = colinearGraph.addEdgeXY(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    node1 = colinearGraph.addEdgeXY(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    const node2 = colinearGraph.addEdgeXY(pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    HalfEdge.pinch(node0.faceSuccessor, node1);
    HalfEdge.pinch(node1.faceSuccessor, node2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(pts), dx);
    for (const pt of pts)
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pt, 0.1, dx);
    voronoi = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph should have 13 edges");
      verifyVoronoiTopology(ck, colinearGraph, voronoiGraph);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "ColinearPoints");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith1Triangle", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;

    delaunayGraph = new HalfEdgeGraph();
    const node0 = delaunayGraph.addEdgeXY(-3, 0, 0, -1);
    const node1 = node0.faceSuccessor;
    const node2 = delaunayGraph.addEdgeXY(0, -1, 0, 1);
    const node3 = node2.faceSuccessor;
    const node4 = delaunayGraph.addEdgeXY(0, 1, -3, 0);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    delaunayGraph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node1.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));

    let voronoi = Voronoi.createFromDelaunay(delaunayGraph);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph));
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph should have 4 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph should have 10 edges");
      verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
    }

    const dy = 8;
    let points = [[-3, 0], [0, -1], [0, 1]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), 0, dy);
    const voronoiPts = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      voronoiGraph = voronoiPts.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), 0, dy);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph from points should have 4 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph from points should have 10 edges");
    }

    let dx = 8;
    points = [[-3, 0], [0, 1.5], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph from points should have 4 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph from points should have 10 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // 3d triangle
    dx += 11;
    points = [[-3, 0, 1], [0, 1.5, 0], [3, 0, -2]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph  for 3d should have 4 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph  for 3d should have 10 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // skinny triangle
    dx += 11;
    points = [[-3, 0], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph from points should have 4 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph from points should have 10 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith1Triangle");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith2Triangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;

    delaunayGraph = new HalfEdgeGraph();
    const node0 = delaunayGraph.addEdgeXY(-3, 0, 0, -1);
    const node1 = node0.faceSuccessor;
    const node2 = delaunayGraph.addEdgeXY(0, -1, 0, 1);
    const node3 = node2.faceSuccessor;
    const node4 = delaunayGraph.addEdgeXY(0, 1, -3, 0);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    const node6 = delaunayGraph.addEdgeXY(0, -1, 3, 0);
    const node7 = node6.faceSuccessor;
    const node8 = delaunayGraph.addEdgeXY(3, 0, 0, 1);
    const node9 = node8.faceSuccessor;
    HalfEdge.pinch(node7, node8);
    HalfEdge.pinch(node3, node9);
    HalfEdge.pinch(node1, node6);
    delaunayGraph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node2.clearMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE);
    node1.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));

    let voronoi = Voronoi.createFromDelaunay(delaunayGraph);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph));
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph should have 13 edges");
      verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
    }

    const dy = 11;
    let points = [[-3, 0], [0, -1], [0, 1], [3, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), 0, dy);
    const voronoiPts = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      voronoiGraph = voronoiPts.getVoronoiGraph();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), 0, dy);
      ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph from points should have 5 faces");
      ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph from points should have 13 edges");
    }

    let dx = 11;
    points = [[0, 0], [3, 4], [4, 4], [6, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph should have 13 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    dx += 11;
    points = [[0, 0], [3, 4], [4, 4], [7, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 12, "voronoiGraph should have 12 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // 3d triangle
    dx += 12;
    points = [[0, 0, -2], [3, 4, 0], [4, 4, 1], [7, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph for 3d should have 5 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 12, "voronoiGraph for 3d should have 12 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // skinny triangles
    dx += 18;
    points = [[-3, 0], [0, -0.1], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph from points should have 5 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph from points should have 13 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // includes skinny triangle
    dx += 17;
    points = [[-3, 0], [0, -0.1], [0, 1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph from points should have 5 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph from points should have 13 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith2Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith3Triangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;
    let voronoi: Voronoi | undefined;

    let points = [[-3, -2], [-1, 1], [0, -3], [4, -1], [4, 3]];
    let pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph));
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // 3d triangle
    let dx = 18;
    points = [[-3, -2, 2], [-1, 1, 1], [0, -3, 5], [4, -1, -3], [4, 3, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph for 3d should have 6 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph for 3d should have 16 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // includes skinny triangle
    dx += 62;
    points = [[-3, -2], [0, 0], [0, -3], [4, -1], [4, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith3Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWith4Triangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;
    let voronoi: Voronoi | undefined;

    let points = [[-2, 0], [0, 0], [0, -3], [0, -1], [5, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph));
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // 3d triangle
    let dx = 21;
    points = [[-2, 0, 0], [0, 0, 1], [0, -3, 5], [0, -1, -3], [5, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph for 3d should have 6 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph for 3d should have 16 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // includes skinny triangle
    dx += 21;
    points = [[-2, 0], [0, 0], [0, -3], [0, -0.1], [5, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith4Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("GraphWithManyTriangles", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;
    let voronoi: Voronoi | undefined;

    let points = [[-10, 8], [4, 3], [-2, 3], [-1, 2], [2, 0], [-1, -3], [3, -2], [-2, -7], [6, -7], [7, -6]];
    let pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph));
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 11, "voronoiGraph should have 11 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 31, "voronoiGraph should have 31 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
    }

    // 3d triangle
    const dx = 62;
    points = [
      [-10, 8, -2], [4, 3, -1], [-2, 3, 3], [-1, 2, -3], [2, 0, 0],
      [-1, -3, 4], [3, -2, 1], [-2, -7, -1], [6, -7, 3], [7, -6, -2],
    ];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunay(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createBagOfCurves(voronoiGraph), dx);
        ck.testCoordinate(voronoiGraph.collectFaceLoops().length, 11, "voronoiGraph for 3d should have 11 faces");
        ck.testCoordinate(voronoiGraph.allHalfEdges.length / 2, 31, "voronoiGraph for 3d should have 31 edges");
        verifyVoronoiTopology(ck, delaunayGraph, voronoiGraph);
      }
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
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions);
    if (ck.testDefined(clippers)) {
      ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 3 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipperUnions of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
      comparePathToClippedCurves(allGeometry, ck, path, clippedCurves, 5);
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
    const lineString = LineString3d.create([4, 2], [7, 2], [9, 5], [12, 5]);
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(12, 5), Point3d.create(13, 4), Point3d.create(12, 3));
    const path = Path.create(lineSegment0, lineSegment1, arc0, lineString, arc1);
    for (const child of path.children)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, child);
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.5;
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions);

    if (ck.testDefined(clippers, "Clippers should be defined")) {
      ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 5 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipperUnions of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
      comparePathToClippedCurves(allGeometry, ck, path, clippedCurves, 20);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "CurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("PathFromJson0", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_linesegment.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      for (const child of path.children)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, child);
    ck.testCoordinate(path.children.length, 7, "path should have 7 children");
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 20;
    // const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions);

    const voronoi = Voronoi.createFromCurveChain(path, strokeOptions);
    if (ck.testDefined(voronoi)) {
      const voronoiGraph = voronoi.getVoronoiGraph();
      const SUPER_FACE_EDGE_MASK = voronoiGraph.grabMask();
      const SUPER_FACE_OUTSIDE_MASK = voronoiGraph.grabMask();
      voronoiGraph.clearMask(SUPER_FACE_EDGE_MASK);
      const superFaces = voronoi.getSuperFaces(path.children.length, SUPER_FACE_EDGE_MASK);
      if (ck.testDefined(superFaces)) {
        voronoi.convexifySuperFaces(SUPER_FACE_EDGE_MASK);
        voronoiGraph.clearMask(HalfEdgeMask.VISITED);
        const clippers = voronoi.generateClippersFromSuperFaces(superFaces, SUPER_FACE_EDGE_MASK, SUPER_FACE_OUTSIDE_MASK);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, voronoi.createPolyface(SUPER_FACE_EDGE_MASK));
        voronoiGraph.dropMask(SUPER_FACE_EDGE_MASK);
        voronoiGraph.dropMask(SUPER_FACE_OUTSIDE_MASK);

        if (ck.testDefined(clippers, "Clippers should be defined")) {
          ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 7 faces");
          const clippedCurves: AnyCurve[][] = [];
          for (const clipperUnions of clippers)
            clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
          comparePathToClippedCurves(allGeometry, ck, path, clippedCurves, 1000);
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson0");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("PathFromJson1", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_linestring.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      for (const child of path.children)
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, child);
    ck.testCoordinate(path.children.length, 18, "path should have 18 children");

    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 200;
    // const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions);

    const voronoi = Voronoi.createFromCurveChain(path, strokeOptions);
    if (ck.testDefined(voronoi)) {
      const voronoiGraph = voronoi.getVoronoiGraph();
      const SUPER_FACE_EDGE_MASK = voronoiGraph.grabMask();
      const SUPER_FACE_OUTSIDE_MASK = voronoiGraph.grabMask();
      voronoiGraph.clearMask(SUPER_FACE_EDGE_MASK);
      const superFaces = voronoi.getSuperFaces(path.children.length, SUPER_FACE_EDGE_MASK);
      if (ck.testDefined(superFaces)) {
        voronoi.convexifySuperFaces(SUPER_FACE_EDGE_MASK);
        voronoiGraph.clearMask(HalfEdgeMask.VISITED);
        const clippers = voronoi.generateClippersFromSuperFaces(superFaces, SUPER_FACE_EDGE_MASK, SUPER_FACE_OUTSIDE_MASK);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, voronoi.createPolyface(SUPER_FACE_EDGE_MASK));
        voronoiGraph.dropMask(SUPER_FACE_EDGE_MASK);
        voronoiGraph.dropMask(SUPER_FACE_OUTSIDE_MASK);

        if (ck.testDefined(clippers, "Clippers should be defined")) {
          ck.testCoordinate(clippers.length, path.children.length, "Voronoi should have 18 faces");
          const clippedCurves: AnyCurve[][] = [];
          for (const clipperUnions of clippers)
            clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipperUnions));
          comparePathToClippedCurves(allGeometry, ck, path, clippedCurves, 5000);
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson1");
    expect(ck.getNumErrors()).toBe(0);
  });

  it.only("PathFromJson2", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];

    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_spirals.imjs", "utf8")),
    ) as Path;
    ck.testDefined(path, "path successfully parsed");
    ck.testCoordinate(path.children.length, 9, "path should have 9 children");
    const approximatedPath: Path = Path.create();
    for (const child of path.children) {
      if (child instanceof IntegratedSpiral3d) {
        const bspline = child.constructOffsetXY(0.0);
        if (ck.testDefined(bspline, "bspline should be defined"))
          approximatedPath.children.push(bspline);
      } else {
        approximatedPath.children.push(child);
      }
    }
    for (const child of approximatedPath.children)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, child);

    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 200;
    // const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(approximatedPath, strokeOptions);

    const voronoi = Voronoi.createFromCurveChain(approximatedPath, strokeOptions);
    if (ck.testDefined(voronoi)) {
      const voronoiGraph = voronoi.getVoronoiGraph();
      const SUPER_FACE_EDGE_MASK = voronoiGraph.grabMask();
      const SUPER_FACE_OUTSIDE_MASK = voronoiGraph.grabMask();
      voronoiGraph.clearMask(SUPER_FACE_EDGE_MASK);
      const superFaces = voronoi.getSuperFaces(approximatedPath.children.length, SUPER_FACE_EDGE_MASK);
      if (ck.testDefined(superFaces)) {
        voronoi.convexifySuperFaces(SUPER_FACE_EDGE_MASK);
        voronoiGraph.clearMask(HalfEdgeMask.VISITED);
        const clippers = voronoi.generateClippersFromSuperFaces(superFaces, SUPER_FACE_EDGE_MASK, SUPER_FACE_OUTSIDE_MASK);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, voronoi.createPolyface(SUPER_FACE_EDGE_MASK));
        voronoiGraph.dropMask(SUPER_FACE_EDGE_MASK);
        voronoiGraph.dropMask(SUPER_FACE_OUTSIDE_MASK);

        if (ck.testDefined(clippers, "Clippers should be defined")) {
          ck.testCoordinate(clippers.length, approximatedPath.children.length, "Voronoi should have 9 faces");
          const clippedCurves: AnyCurve[][] = [];
          for (const clipperUnions of clippers)
            clippedCurves.push(ClipUtilities.clipAnyCurve(approximatedPath, clipperUnions));
          comparePathToClippedCurves(allGeometry, ck, approximatedPath, clippedCurves, 1000);
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson2");
    expect(ck.getNumErrors()).toBe(0);
  });
});
