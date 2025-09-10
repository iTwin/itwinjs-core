import * as fs from "fs";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { InterpolationCurve3d, InterpolationCurve3dOptions } from "../../bspline/InterpolationCurve3d";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { Arc3d } from "../../curve/Arc3d";
import { CurveChain, CurveCollection } from "../../curve/CurveCollection";
import { CurveOps } from "../../curve/CurveOps";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { AnyCurve } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { RegionOps } from "../../curve/RegionOps";
import { IntegratedSpiral3d } from "../../curve/spiral/IntegratedSpiral3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range2d } from "../../geometry3d/Range";
import { LowAndHighXY, XAndY } from "../../geometry3d/XYZProps";
import { IndexedPolyface } from "../../polyface/Polyface";
import { HalfEdgeGraphSearch, PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask, HalfEdgeToBooleanFunction } from "../../topology/Graph";
import { HalfEdgeGraphOps } from "../../topology/Merging";
import { Triangulator } from "../../topology/Triangulation";
import { Voronoi } from "../../topology/Voronoi";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { getRandomNumberScaled } from "../testFunctions";

/**
 * Construct facets from the faces of a Voronoi graph.
 * * Not included in Voronoi class to avoid dependence on polyface code in topology code.
 */
function constructPolyfaceFromVoronoiGraph(voronoi: Voronoi, showSuperFacesOnly: boolean = false): IndexedPolyface {
  let isEdgeVisible: HalfEdgeToBooleanFunction = () => true;
  if (showSuperFacesOnly && voronoi.isCurveBased && voronoi.getSuperFaceMask !== HalfEdgeMask.NULL_MASK)
    isEdgeVisible = (e: HalfEdge) => e.isMaskSet(voronoi.getSuperFaceMask);
  return PolyfaceBuilder.graphToPolyface(voronoi.getVoronoiGraph, undefined, undefined, isEdgeVisible);
}

/** Capture all the edges of a graph */
function visualizeGraphEdges(allGeometry: GeometryQuery[], graph: HalfEdgeGraph, dx?: number, dy?: number): void {
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, graph.collectSegments(), dx, dy);
}

/**
 * Capture the curve-based Voronoi diagram as a mesh.
 * * The only visible edges are edges of super face loops.
 * @param showDelaunay whether to visualize the Delaunay triangulation.
 * @param showClippers whether to visualize the curve-based Voronoi super faces as UnionRegions derived from the clippers instead.
 */
function visualizeVoronoiDiagram(ck: Checker, allGeometry: GeometryQuery[], path: CurveChain, strokeOptions?: StrokeOptions, distanceTol?: number, bbox?: LowAndHighXY, showDelaunay?: boolean, showClippers?: boolean): void {
  const voronoi = Voronoi.createFromCurveChain(path, strokeOptions, distanceTol, bbox);
  if (ck.testDefined(voronoi, "created Voronoi instance")) {
    ck.testTrue(voronoi.isCurveBased, "Voronoi instance is curve-based");
    if (showDelaunay)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(voronoi.getInputGraph, undefined, undefined, () => true));
    const superFaces = voronoi.computeVoronoiSuperFaces(path.children.length);
    if (ck.testDefined(superFaces, "computed Voronoi super faces")) {
      if (showClippers) {
        const clippers = voronoi.generateClippersFromVoronoiSuperFaces(superFaces);
        if (ck.testDefined(clippers, "generated clippers from Voronoi super faces")) {
          const range = HalfEdgeGraphOps.graphRangeXY(voronoi.getVoronoiGraph);
          const polygon: Point3d[] = [
            Point3d.create(range.low.x, range.low.y),
            Point3d.create(range.high.x, range.low.y),
            Point3d.create(range.high.x, range.high.y),
            Point3d.create(range.low.x, range.high.y),
          ];
          const work = new GrowableXYZArray();
          for (const clipper of clippers) {
            const clippedPolygons: GrowableXYZArray[] = [];
            clipper.polygonClip(polygon, clippedPolygons, work);
            const signedLoops = RegionOps.constructAllXYRegionLoops(clippedPolygons.map((clippedPolygon: GrowableXYZArray) => Loop.createPolygon(clippedPolygon)));
            if (ck.testExactNumber(signedLoops.length, 1, "one component in super face"))
              if (ck.testExactNumber(signedLoops[0].negativeAreaLoops.length, 1, "no holes in super face"))
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, signedLoops[0].negativeAreaLoops[0]);
          }
        }
      } else
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, constructPolyfaceFromVoronoiGraph(voronoi, true));
    }
  }
}

/** Verify the faces of the Voronoi graph consist of points closest to the expected Delaunay vertex. */
function verifyVoronoiTopology(_ck: Checker, _v: Voronoi): void {

  // const face = HalfEdgeGraphSearch.findContainingFaceXY(voronoi.getVoronoiGraph, testPoint);

  /* TODO: rewrite Voronoi verification test:
  * Use HalfEdgeGraphSearch.findContainingFaceXY of a random point P to find a HalfEdge fe in the containing Voronoi face.
  * Use Point3dArrayRangeTreeContext to find closest Delaunay vertex ve (a HalfEdge!!) to P:
          const vertices = graph.collectVertexLoops();
          const searcher = Point3dArrayRangeTreeContext.createCapture(vertices, undefined, undefined, true);
          if (!searcher)
            return undefined;
          let cld = searcher.searchForClosestPoint(testPoint);
          if (!cld)
            return undefined;
          if (Array.isArray(cld))
            cld = cld[0]; // don't expect multiple results
          const ve = vertices[cld.fraction];
  * Confirm that Delaunay.allHalfEdges[fe.faceTag] and ve are in the same Delaunay vertex loop.
  */

  // const voronoiPoints = voronoi.allHalfEdges.map((he) => he.getPoint3d());
  // const delaunayPoints = delaunay.allHalfEdges.map((he) => he.getPoint3d());
  // const delaunayUniquePoints = Array.from(new Set(delaunayPoints.map(p => `${p.x},${p.y}`)))
  //   .map(p => p.split(',').map(Number))
  //   .map(p => Point3d.create(p[0], p[1]));
  // const voronoiSearcher = Point3dArrayRangeTreeContext.createCapture(voronoiPoints);
  // const delaunaySearcher = Point3dArrayRangeTreeContext.createCapture(delaunayUniquePoints);
  // const range = HalfEdgeGraphOps.graphRange(voronoi);
  // if (voronoiSearcher && delaunaySearcher) {
  //   for (let i = 0; i < 10; i++) {
  //     const spacePoint = Point3d.create(getRandomNumber(range.xLow, range.xHigh), getRandomNumber(range.yLow, range.yHigh));
  //     const closestVoronoiPoint = voronoiSearcher.searchForClosestPoint(spacePoint);
  //     if (closestVoronoiPoint === undefined || Array.isArray(closestVoronoiPoint)) {
  //       ck.announceError("one point should be found");
  //     } else {
  //       let closestVoronoiVertex: HalfEdge | undefined;
  //       let closestVoronoiHalfEdge: HalfEdge | undefined;
  //       for (const he of voronoi.allHalfEdges) {
  //         if (he.getPoint3d().isExactEqual(closestVoronoiPoint.point)) {
  //           closestVoronoiVertex = he;
  //           break;
  //         }
  //       }
  //       const spaceNode = new HalfEdge();
  //       spaceNode.x = spacePoint.x;
  //       spaceNode.y = spacePoint.y;
  //       closestVoronoiVertex?.collectAroundVertex(
  //         (node) => {
  //           if (HalfEdge.isNodeVisibleInSector(spaceNode, node) && !node.isMaskSet(HalfEdgeMask.EXTERIOR))
  //             closestVoronoiHalfEdge = node;
  //         }
  //       );
  //       const closestDelaunayPoint = delaunaySearcher.searchForClosestPoint(spacePoint);
  //       if (closestDelaunayPoint === undefined || Array.isArray(closestDelaunayPoint)) {
  //         ck.announceError("one point should be found");
  //       } else {
  //         let expectedFaceTag = Number.MAX_VALUE;
  //         const closestDelaunayPointXY = closestDelaunayPoint.point;
  //         closestDelaunayPointXY.setAt(2, 0); // set z = 0
  //         for (let j = 0; j < delaunay.allHalfEdges.length; j++) {
  //           const he = delaunay.allHalfEdges[j];
  //           const heXY = he.getPoint3d();
  //           heXY.setAt(2, 0); // set z = 0
  //           if (heXY.isExactEqual(closestDelaunayPointXY)) {
  //             expectedFaceTag = j;
  //             break;
  //           }
  //         }
  //         ck.testExactNumber(
  //           closestVoronoiHalfEdge?.faceTag,
  //           expectedFaceTag,
  //           `point ("${spacePoint.x}", "${spacePoint.y}") belongs to the face with faceTag "${expectedFaceTag}"`,
  //         );
  //       }
  //     }
  //   }
  // }
}

// compare the lengths and centroids of the path children to the clipped curves
function comparePathToClippedCurves(
  allGeometry: GeometryQuery[], ck: Checker, chain: CurveChain, clippedCurves: AnyCurve[][], dy: number = 0,
): void {
  ck.testExactNumber(clippedCurves.length, chain.children.length, "number of clipped curves matches number of chain children");
  const clippedCurvesLengths: number[] = [];
  const clippedCurvesCentroids: Point3d[] = [];
  for (let i = 0; i < clippedCurves.length; i++) {
    let clippedPath: AnyCurve | undefined = CurveOps.collectChains(clippedCurves[i]);
    if (ck.testDefined(clippedPath, `clippedCurves[${i}] successfully assembled into a chain`)) {
      if (clippedPath instanceof CurveCollection) {
        RegionOps.consolidateAdjacentPrimitives(clippedPath);
        if (clippedPath.children.length === 1 && clippedPath.children[0] instanceof CurvePrimitive)
          clippedPath = clippedPath.children[0];
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPath, 0, dy);
      ck.testTrue(clippedPath instanceof CurvePrimitive, `clippedCurves[${i}] should be a CurvePrimitive`);
      const momentData = RegionOps.computeXYZWireMomentSums(clippedPath);
      if (ck.testDefined(momentData)) {
        const length = momentData.quantitySum;
        clippedCurvesLengths.push(length);
        const centroid = momentData.origin;
        clippedCurvesCentroids.push(centroid);
      }
    }
  }
  const childrenLengths: number[] = [];
  const childrenCentroids: Point3d[] = [];
  for (const child of chain.children) {
    const momentData = RegionOps.computeXYZWireMomentSums(child);
    if (ck.testDefined(momentData)) {
      const length = momentData.quantitySum;
      childrenLengths.push(length);
      const centroid = momentData.origin;
      childrenCentroids.push(centroid);
    }
  }
  ck.testNumberArray(clippedCurvesLengths, childrenLengths, "clipped chain yields expected lengths");
  ck.testPoint3dArray(clippedCurvesCentroids, childrenCentroids, "clipped chain yields expected centroids");
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
    ck.testUndefined(Voronoi.createFromDelaunayGraph(graph), "expect undefined for a graph with a non-triangle face");

    expect(ck.getNumErrors()).toBe(0);
  });

  it("ColinearPoints", () => {
    const ck = new Checker();
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 5, "voronoiGraph should have 5 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 3, "voronoiGraph should have 3 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 7, "voronoiGraph should have 7 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph should have 4 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph should have 10 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph should have 4 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph should have 10 edges");
      verifyVoronoiTopology(ck, voronoi);
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
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, dx);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph should have 13 edges");
      verifyVoronoiTopology(ck, voronoi);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "ColinearPoints");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith1Triangle", () => {
    const ck = new Checker();
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

    let voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph should have 4 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph should have 10 edges");
      verifyVoronoiTopology(ck, voronoi);
    }

    const dy = 8;
    let points = [[-3, 0], [0, -1], [0, 1]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), 0, dy);
    const voronoiPts = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      voronoiGraph = voronoiPts.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, 0, dy);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph from points should have 4 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph from points should have 10 edges");
    }

    let dx = 8;
    points = [[-3, 0], [0, 1.5], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph from points should have 4 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph from points should have 10 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // 3d triangle
    dx += 11;
    points = [[-3, 0, 1], [0, 1.5, 0], [3, 0, -2]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph  for 3d should have 4 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph  for 3d should have 10 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // skinny triangle
    dx += 11;
    points = [[-3, 0], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 4, "voronoiGraph from points should have 4 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 10, "voronoiGraph from points should have 10 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith1Triangle");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith2Triangles", () => {
    const ck = new Checker();
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

    let voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
    if (ck.testDefined(voronoi)) {
      voronoiGraph = voronoi.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph should have 13 edges");
      verifyVoronoiTopology(ck, voronoi);
    }

    const dy = 11;
    let points = [[-3, 0], [0, -1], [0, 1], [3, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), 0, dy);
    const voronoiPts = Voronoi.createFromPoints(pts);
    if (ck.testDefined(voronoiPts)) {
      voronoiGraph = voronoiPts.getVoronoiGraph;
      visualizeGraphEdges(allGeometry, voronoiGraph, 0, dy);
      ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph from points should have 5 faces");
      ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph from points should have 13 edges");
    }

    let dx = 11;
    points = [[0, 0], [3, 4], [4, 4], [6, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph should have 13 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    dx += 11;
    points = [[0, 0], [3, 4], [4, 4], [7, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph should have 5 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 12, "voronoiGraph should have 12 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // 3d triangle
    dx += 12;
    points = [[0, 0, -2], [3, 4, 0], [4, 4, 1], [7, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph for 3d should have 5 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 12, "voronoiGraph for 3d should have 12 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // skinny triangles
    dx += 18;
    points = [[-3, 0], [0, -0.1], [0, 0.1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph from points should have 5 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph from points should have 13 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // includes skinny triangle
    dx += 17;
    points = [[-3, 0], [0, -0.1], [0, 1], [3, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 5, "voronoiGraph from points should have 5 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 13, "voronoiGraph from points should have 13 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith2Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith3Triangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;
    let voronoi: Voronoi | undefined;

    let points = [[-3, -2], [-1, 1], [0, -3], [4, -1], [4, 3]];
    let pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // 3d triangle
    let dx = 18;
    points = [[-3, -2, 2], [-1, 1, 1], [0, -3, 5], [4, -1, -3], [4, 3, -1]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph for 3d should have 6 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph for 3d should have 16 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // includes skinny triangle
    dx += 62;
    points = [[-3, -2], [0, 0], [0, -3], [4, -1], [4, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith3Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWith4Triangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;
    let voronoi: Voronoi | undefined;

    let points = [[-2, 0], [0, 0], [0, -3], [0, -1], [5, 0]];
    let pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // 3d triangle
    let dx = 21;
    points = [[-2, 0, 0], [0, 0, 1], [0, -3, 5], [0, -1, -3], [5, 0, 3]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph for 3d should have 6 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph for 3d should have 16 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    // includes skinny triangle
    dx += 21;
    points = [[-2, 0], [0, 0], [0, -3], [0, -0.1], [5, 0]];
    pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph), dx);
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 6, "voronoiGraph should have 6 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 16, "voronoiGraph should have 16 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "GraphWith4Triangles");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("GraphWithManyTriangles", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let voronoiGraph: HalfEdgeGraph | undefined;
    let delaunayGraph: HalfEdgeGraph | undefined;
    let voronoi: Voronoi | undefined;

    let points = [[-10, 8], [4, 3], [-2, 3], [-1, 2], [2, 0], [-1, -3], [3, -2], [-2, -7], [6, -7], [7, -6]];
    let pts = IModelJson.Reader.parsePointArray(points);
    delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(pts);
    if (ck.testDefined(delaunayGraph)) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(delaunayGraph));
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 11, "voronoiGraph should have 11 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 31, "voronoiGraph should have 31 edges");
        verifyVoronoiTopology(ck, voronoi);
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
      voronoi = Voronoi.createFromDelaunayGraph(delaunayGraph);
      if (ck.testDefined(voronoi)) {
        voronoiGraph = voronoi.getVoronoiGraph;
        visualizeGraphEdges(allGeometry, voronoiGraph, dx);
        ck.testExactNumber(voronoiGraph.collectFaceLoops().length, 11, "voronoiGraph for 3d should have 11 faces");
        ck.testExactNumber(voronoiGraph.allHalfEdges.length / 2, 31, "voronoiGraph for 3d should have 31 edges");
        verifyVoronoiTopology(ck, voronoi);
      }
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
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions);
    visualizeVoronoiDiagram(ck, allGeometry, path, strokeOptions, undefined, undefined, false, true);
    if (ck.testDefined(clippers)) {
      ck.testExactNumber(clippers.length, path.children.length, "Voronoi should have 3 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipper of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipper));
      comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "ColinearCurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CurveChain", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const lineSegment0 = LineSegment3d.createXYXY(-3, 0, 0, 0);
    const lineSegment1 = LineSegment3d.createXYXY(0, 0, 2, 2);
    const arc0 = Arc3d.createCircularStartMiddleEnd(Point3d.create(2, 2), Point3d.create(3, 3), Point3d.create(4, 2));
    const lineString = LineString3d.create([4, 2], [7, 2], [9, 5], [12, 5]);
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(12, 5), Point3d.create(13, 4), Point3d.create(12, 3));
    const path = Path.create(lineSegment0, lineSegment1, arc0, lineString, arc1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testExactNumber(path.children.length, 5, "path should have 5 children");
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.1;
    const bbox = path.range();
    bbox.expandInPlace(10);
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions, undefined, bbox);
    visualizeVoronoiDiagram(ck, allGeometry, path, strokeOptions, undefined, bbox, false, true);
    if (ck.testDefined(clippers, "Clippers should be defined")) {
      ck.testExactNumber(clippers.length, path.children.length, "Voronoi should have 5 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipper of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipper));
      comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "CurveChain");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("PathFromJson0", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_line_segment.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testExactNumber(path.children.length, 7, "path should have 7 children");
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 20;
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path, strokeOptions);
    visualizeVoronoiDiagram(ck, allGeometry, path, strokeOptions, undefined, undefined, false, true);
    if (ck.testDefined(clippers, "Clippers should be defined")) {
      ck.testExactNumber(clippers.length, path.children.length, "Voronoi should have 7 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipper of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipper));
      comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson0");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("LoopFromJson0", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let path = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_line_segment.imjs", "utf8"))) as Path;
    ck.testExactNumber(path.children.length, 7, "path should have 7 children");
    // plug the path gap to make a loop
    const loop = Loop.create(...path.children);
    const startTangent = path.children[0].fractionToPointAndDerivative(0);
    const endTangent = path.children[path.children.length - 1].fractionToPointAndDerivative(1);
    const fitOptions = InterpolationCurve3dOptions.create({ fitPoints: [endTangent.origin, startTangent.origin], startTangent: endTangent.direction, endTangent: startTangent.direction.scaleInPlace(-1) });
    const gapCurve = InterpolationCurve3d.createCapture(fitOptions);
    if (ck.testDefined(gapCurve, "gap curve created"))
      loop.children.push(gapCurve);
    ck.testTrue(loop.isPhysicallyClosedCurve(), "loop is closed");
    ck.testExactNumber(loop.children.length, 8, "loop should have 8 children");
    path = Path.create(...loop.children);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path); // draw path so not conflated with Voronoi super faces
    const strokeOptions = StrokeOptions.createForCurves();
    strokeOptions.maxEdgeLength = 20;
    const distanceTol = undefined;
    const bbox = Range2d.createXYXY(70250, 1209900, 70950, 1210500);
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(loop, strokeOptions, distanceTol, bbox);
    visualizeVoronoiDiagram(ck, allGeometry, loop, strokeOptions, distanceTol, bbox, false, true);
    if (ck.testDefined(clippers, "Clippers should be defined")) {
      ck.testExactNumber(clippers.length, loop.children.length, "Voronoi should have 8 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipper of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipper)); // use path to avoid region clip logic

      // TODO: Restore this line after backlog issue 1580 is addressed.
      // comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "LoopFromJson0");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("PathFromJson1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const path = IModelJson.Reader.parse(
      JSON.parse(fs.readFileSync("./src/test/data/curve/voronoi/path_with_arc_and_line_string.imjs", "utf8")),
    ) as Path;
    if (ck.testDefined(path, "path successfully parsed"))
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path);
    ck.testExactNumber(path.children.length, 18, "path should have 18 children");
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(path);
    visualizeVoronoiDiagram(ck, allGeometry, path, undefined, undefined, undefined, false, true);
    if (ck.testDefined(clippers, "Clippers should be defined")) {
      ck.testExactNumber(clippers.length, path.children.length, "Voronoi should have 18 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipper of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(path, clipper));
      comparePathToClippedCurves(allGeometry, ck, path, clippedCurves);
    }
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
    ck.testExactNumber(path.children.length, 9, "path should have 9 children");

    // TODO: remove approximation logic after backlog issue 1574 is fixed.
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
    const strokeOptions = StrokeOptions.createForCurves();
    const distanceTol = undefined;
    const bbox = Range2d.createXYXY(2500, 4400, 15000, 8400);
    const clippers = ClipUtilities.createClippersForRegionsClosestToCurvePrimitivesXY(approximatedPath, strokeOptions, distanceTol, bbox);
    visualizeVoronoiDiagram(ck, allGeometry, approximatedPath, strokeOptions, distanceTol, bbox, false, true);
    if (ck.testDefined(clippers, "Clippers should be defined")) {
      ck.testExactNumber(clippers.length, approximatedPath.children.length, "Voronoi should have 9 faces");
      const clippedCurves: AnyCurve[][] = [];
      for (const clipper of clippers)
        clippedCurves.push(ClipUtilities.clipAnyCurve(approximatedPath, clipper));

      // TODO: Restore this line after backlog issues 1574 and 1580 are addressed.
      // comparePathToClippedCurves(allGeometry, ck, approximatedPath, clippedCurves);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "PathFromJson2");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("findContainingFaceXY", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const side = 20; // mesh/graph is non-horizontal square with this side length.
    const mesh = Sample.createTriangularUnitGridPolyface(Point3d.createZero(), Vector3d.create(1), Vector3d.create(0, 1, 1), side + 1, side + 1, false, false, false, false);
    if (ck.testDefined(mesh, "Sample mesh created")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh);
      const graph = PolyfaceQuery.convertToHalfEdgeGraph(mesh);
      const testPoints: Point3d[] = [];
      for (let i = 0; i < 100; i++) // sample some interior points
        testPoints.push(Point3d.create(getRandomNumberScaled(side, 1/side), getRandomNumberScaled(side, 1/side)));
      testPoints.push(Point3d.create(-1, -1)); // and one exterior point
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, testPoints, 0.1);
      const containingFaces = HalfEdgeGraphSearch.findContainingFaceXY(graph, testPoints) as (HalfEdge | undefined)[] | undefined;
      if (ck.testDefined(containingFaces, "findContainingFaceXY succeeded")) {
        ck.testExactNumber(containingFaces.length, testPoints.length, "findContainingFaceXY returned one entry per point");
        for (let i = 0; i < containingFaces.length - 1; i++) {
          const containingFace = containingFaces[i];
          if (ck.testDefined(containingFace, "interior point containing face found")) {
            const quadRange = Range2d.createArray(containingFace.collectAroundFace() as XAndY[]);
            ck.testTrue(quadRange.containsPoint(testPoints[i]), "range of containing face contains test point");
          }
        }
        ck.testUndefined(containingFaces[containingFaces.length - 1], "exterior point has no containing face");
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Voronoi", "findContainingFaceXY");
    expect(ck.getNumErrors()).toBe(0);
  });
});
