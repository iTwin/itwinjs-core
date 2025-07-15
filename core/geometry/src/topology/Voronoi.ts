/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { CloneFunction, Dictionary, OrderedComparator } from "@itwin/core-bentley";
import { Arc3d } from "../curve/Arc3d";
import { CurveChain } from "../curve/CurveCollection";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { AnyRegion } from "../curve/CurveTypes";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { RegionBinaryOpType, RegionOps } from "../curve/RegionOps";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PolylineOps } from "../geometry3d/PolylineOps";
import { Range3d } from "../geometry3d/Range";
import { XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { SmallSystem } from "../numerics/SmallSystem";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgeGraphMerge, HalfEdgeGraphOps } from "./Merging";
import { Triangulator } from "./Triangulation";

interface Line {
  start: XAndY;
  end: XAndY;
}

/**
 * A class to represent a Voronoi diagram.
 * * A Voronoi diagram is a partitioning of a plane into regions based on the distance to a specific set of points.
 * We construct the Voronoi diagram using Delaunay triangulation via the circumcircle algorithm.
 * * More info can be found here: https://en.wikipedia.org/wiki/Voronoi_diagram and
 * https://en.wikipedia.org/wiki/Delaunay_triangulation
 * @internal
*/
export class Voronoi {
  private _inputGraphIsValid = true;
  private _circumcenterMap: Map<number, Point3d> = new Map();
  private _idToIndexMap: Map<number, number> = new Map();
  private _graphRange: Range3d = Range3d.createNull();
  private _circumcenterRange: Range3d = Range3d.createNull();
  private constructor(graph: HalfEdgeGraph, isColinear = false) {
    if (!isColinear)
      this.populateCircumcenters(graph);
    this.populateIdToIndexMap(graph);
    this._graphRange = HalfEdgeGraphOps.graphRange(graph);
  }
  // find min id of the triangular face containing this vertex
  private static findFaceMinId(vertex: HalfEdge): number {
    return Math.min(vertex.id, vertex.faceSuccessor.id, vertex.faceSuccessor.faceSuccessor.id);
  }
  // collect all centers of circumcircles formed by triangles in the Delaunay triangulation
  // and store them in a map with the minimum ID of face nodes as key
  private populateCircumcenters(graph: HalfEdgeGraph): void {
    graph.announceFaceLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        if (seed.isMaskSet(HalfEdgeMask.EXTERIOR))
          return true; // skip exterior faces
        if (seed.countEdgesAroundFace() !== 3) {
          this._inputGraphIsValid = false;
          return false;
        }
        // find circumcenter of the triangle formed by this face
        const p0 = seed.getPoint3d();
        const p1 = seed.faceSuccessor.getPoint3d();
        const p2 = seed.faceSuccessor.faceSuccessor.getPoint3d();
        p0.z = p1.z = p2.z = 0; // ignore z-coordinate
        const circumcircle = Arc3d.createCircularStartMiddleEnd(p0, p1, p2);
        if (!circumcircle || circumcircle instanceof LineString3d) {
          this._inputGraphIsValid = false;
          return false;
        }
        const circumcenter = circumcircle.center
        const minId = Voronoi.findFaceMinId(seed);
        this._circumcenterMap.set(minId, circumcenter);
        return true;
      },
    );
    this._circumcenterRange = Range3d.create(...Array.from(this._circumcenterMap.values()));
  }
  // go over all the nodes in the graph and create a map of node IDs in a vertex loop to
  // min index of that vertex loop in graph.allHalfEdges
  private populateIdToIndexMap(graph: HalfEdgeGraph): void {
    graph.allHalfEdges.forEach((node, index) => {
      this._idToIndexMap.set(node.id, index);
    });
    graph.announceVertexLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const nodesAroundVertex = seed.collectAroundVertex();
        let minIndex = Number.MAX_SAFE_INTEGER;
        for (const node of nodesAroundVertex) {
          const index = this._idToIndexMap.get(node.id);
          if (index === undefined) {
            this._inputGraphIsValid = false;
            return false;
          }
          if (index < minIndex)
            minIndex = index;
        }
        for (const node of nodesAroundVertex)
          this._idToIndexMap.set(node.id, minIndex);
        return true;
      },
    );
  }
  // generate bisector of each edge in the Delaunay triangulation and limit it to the voronoi boundary
  private static getBisector(
    vertex: HalfEdge, circumcenter: Point3d, voronoiBoundary: VoronoiBoundary,
  ): Line | undefined {
    const p0 = vertex.getPoint3d();
    const p1 = vertex.faceSuccessor.getPoint3d();
    const p2 = vertex.faceSuccessor.faceSuccessor.getPoint3d();
    p0.z = p1.z = p2.z = 0; // ignore z-coordinate
    const midPoint = Point3d.createAdd2Scaled(p0, 0.5, p1, 0.5);
    const centroid = Point3d.createAdd3Scaled(p0, 1 / 3, p1, 1 / 3, p2, 1 / 3);
    const centroidToMidPoint = Vector3d.createStartEnd(centroid, midPoint);
    const centerToMidPoint = Vector3d.createStartEnd(circumcenter, midPoint);
    let direction: Vector3d;
    if (centroidToMidPoint.dotProduct(centerToMidPoint) > 0)
      direction = Vector3d.createStartEnd(circumcenter, midPoint);
    else
      direction = Vector3d.createStartEnd(midPoint, circumcenter);
    const scale = 100000; // had to pick a large scale to ensure the bisector is long enough to intersect the voronoi boundary
    const bisectorStart = circumcenter;
    const bisectorEnd = Point3d.createAdd2Scaled(bisectorStart, 1, direction, scale);
    const bisector: Line = { start: bisectorStart, end: bisectorEnd };
    const intersection = voronoiBoundary.intersect(bisector);
    if (!intersection || intersection.length === 0)
      return undefined; // bisector is outside the voronoi boundary for skinny triangles; skip it
    if (voronoiBoundary.contains(circumcenter))
      return { start: bisectorStart, end: intersection[0] }; // bisector is inside the voronoi boundary
    else
      return { start: intersection[0], end: intersection[1] }; // bisector is outside the voronoi boundary
  }
  private static handleBoundaryEdge(
    seed: HalfEdge,
    voronoi: Voronoi,
    voronoiBoundary: VoronoiBoundary,
    voronoiDiagram: HalfEdgeGraph,
    seedIsExterior: boolean,
  ): boolean {
    let vertex = seed;
    if (seedIsExterior)
      vertex = seed.edgeMate;
    const minId = Voronoi.findFaceMinId(vertex);
    const circumcenter = voronoi._circumcenterMap.get(minId);
    if (!circumcenter)
      return false; // no circumcenter found for the face containing this edge
    const bisector = Voronoi.getBisector(vertex, circumcenter, voronoiBoundary);
    if (!bisector)
      return true; // bisector is outside the voronoi boundary for skinny triangles; skip it
    voronoiDiagram.addEdgeXY(
      bisector.start.x, bisector.start.y,
      bisector.end.x, bisector.end.y,
      voronoi._idToIndexMap.get(vertex.edgeMate.id), voronoi._idToIndexMap.get(vertex.id),
    );
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
    return true;
  }
  private static handleInteriorEdge(
    seed: HalfEdge,
    voronoi: Voronoi,
    voronoiBoundary: VoronoiBoundary,
    voronoiDiagram: HalfEdgeGraph,
    tol: number,
  ): boolean {
    const minId0 = Voronoi.findFaceMinId(seed);
    const minId1 = Voronoi.findFaceMinId(seed.edgeMate);
    const circumcenter0 = voronoi._circumcenterMap.get(minId0);
    const circumcenter1 = voronoi._circumcenterMap.get(minId1);
    if (!circumcenter0 || !circumcenter1)
      return false; // no circumcenter found for the face containing this edge
    if (circumcenter0.isAlmostEqual(circumcenter1, tol))
      return true; // circumcenters are the same, skip this edge
    const center0IsInsideVoronoiBoundary = voronoiBoundary.contains(circumcenter0);
    const center1IsInsideVoronoiBoundary = voronoiBoundary.contains(circumcenter1);
    const line: Line = { start: circumcenter0, end: circumcenter1 }; // line segment between circumcenters
    const intersection = voronoiBoundary.intersect(line);
    if (intersection && intersection.length > 0) { // line intersects the voronoi boundary
      let limitedLine: Line;
      if (!center0IsInsideVoronoiBoundary && !center1IsInsideVoronoiBoundary) {
        limitedLine = { start: intersection[0], end: intersection[1] }; // limit line to the voronoi boundary
      } else {
        const center = center0IsInsideVoronoiBoundary ? circumcenter0 : circumcenter1;
        limitedLine = { start: intersection[0], end: center }; // limit line to the voronoi boundary
      }
      voronoiDiagram.addEdgeXY(
        limitedLine.start.x, limitedLine.start.y,
        limitedLine.end.x, limitedLine.end.y,
        voronoi._idToIndexMap.get(seed.edgeMate.id), voronoi._idToIndexMap.get(seed.id),
      );
    } else {
      if (!center0IsInsideVoronoiBoundary && !center1IsInsideVoronoiBoundary)
        return true; // both circumcenters are outside the voronoi boundary and line does not intersect the boundary; skip this edge
      voronoiDiagram.addEdgeXY(
        line.start.x, line.start.y,
        line.end.x, line.end.y,
        voronoi._idToIndexMap.get(seed.edgeMate.id), voronoi._idToIndexMap.get(seed.id),
      );
    }
    HalfEdgeGraphMerge.splitIntersectingEdges(voronoiDiagram);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
    return true;
  }
  private static addVoronoiBoundary(voronoiDiagram: HalfEdgeGraph, voronoiBoundary: VoronoiBoundary) {
    voronoiDiagram.addEdgeXY(
      voronoiBoundary.p0.x, voronoiBoundary.p0.y, voronoiBoundary.p1.x, voronoiBoundary.p1.y,
    );
    voronoiDiagram.addEdgeXY(
      voronoiBoundary.p1.x, voronoiBoundary.p1.y, voronoiBoundary.p2.x, voronoiBoundary.p2.y,
    );
    voronoiDiagram.addEdgeXY(
      voronoiBoundary.p2.x, voronoiBoundary.p2.y, voronoiBoundary.p3.x, voronoiBoundary.p3.y,
    );
    voronoiDiagram.addEdgeXY(
      voronoiBoundary.p3.x, voronoiBoundary.p3.y, voronoiBoundary.p0.x, voronoiBoundary.p0.y,
    );
    HalfEdgeGraphMerge.splitIntersectingEdges(voronoiDiagram);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
  }
  // populate EXTERIOR and BOUNDARY_EDGE masks and remaining face tags
  public static populateMasksAndFaceTags(voronoiDiagram: HalfEdgeGraph): void {
    voronoiDiagram.announceFaceLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        let hasFaceTag = false;
        let faceTag: number | undefined;
        const nodesAroundFace = seed.collectAroundFace() as HalfEdge[];
        for (const node of nodesAroundFace) {
          if (node.faceTag !== undefined) {
            hasFaceTag = true;
            faceTag = node.faceTag;
            break;
          }
        }
        if (!hasFaceTag) // if none of face nodes have faceTag, that face is exterior
          for (const node of nodesAroundFace) {
            node.setMask(HalfEdgeMask.EXTERIOR);
            node.edgeMate.setMask(HalfEdgeMask.BOUNDARY_EDGE);
          }
        else // if at least one face node has faceTag, set faceTag of all face nodes to that faceTag
          for (const node of nodesAroundFace)
            node.faceTag = faceTag;
        return true;
      },
    );
  }
  /**
   * Creates a Voronoi diagram from a HalfEdgeGraph.
   * * For best results:
   *    * the input graph should be a Delaunay triangulated graph,
   *    * the boundary and exterior edges should have correct masks,
   *    * the graph boundary should be convex.
   * @param graph A HalfEdgeGraph representing a Delaunay triangulated graph; xy-only (z-coordinate is ignored).
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid. Each voronoi face
   * corresponds to a vertex in the input graph and we store the index of the vertex (in graph.allHalfEdges) in the
   * edgeTag of all nodes in that voronoi face.
   */
  public static createVoronoi(graph: HalfEdgeGraph, tol: number = Geometry.smallMetricDistance): HalfEdgeGraph | undefined {
    const graphLength = graph.allHalfEdges.length;
    if (graph === undefined || graphLength < 3)
      return undefined;
    let isValidVoronoi = true;
    const voronoi = new Voronoi(graph);
    if (!voronoi._inputGraphIsValid)
      return undefined;
    const voronoiBoundary = new VoronoiBoundary(voronoi._graphRange, voronoi._circumcenterRange);
    const voronoiDiagram = new HalfEdgeGraph();
    // go over all edges in the graph and add bisectors for boundary edges
    // and add line between circumcenters for interior edges
    // if a circumcenter is outside the voronoi boundary, limit the bisector or line to the voronoi boundary
    graph.announceEdges(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const seedIsExterior = seed.isMaskSet(HalfEdgeMask.EXTERIOR);
        const seedIsBoundary = seed.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE);
        if (seedIsExterior || seedIsBoundary) {
          isValidVoronoi = Voronoi.handleBoundaryEdge(
            seed, voronoi, voronoiBoundary, voronoiDiagram, seedIsExterior,
          );
          return isValidVoronoi;
        } else {
          isValidVoronoi = Voronoi.handleInteriorEdge(seed, voronoi, voronoiBoundary, voronoiDiagram, tol);
          return isValidVoronoi;
        }
      },
    );
    if (!isValidVoronoi)
      return undefined; // invalid graph
    Voronoi.addVoronoiBoundary(voronoiDiagram, voronoiBoundary);
    Voronoi.populateMasksAndFaceTags(voronoiDiagram);
    return voronoiDiagram;
  }
  // create a half-edge graph for the colinear points; index is assigned to the edgeTag of each graph node
  private static createLinearGraph(pointsWithIndices: [Point3d, number][]): HalfEdgeGraph {
    const graph = new HalfEdgeGraph();
    let point0 = pointsWithIndices[0][0];
    let point1 = pointsWithIndices[1][0];
    let index0 = pointsWithIndices[0][1];
    let index1 = pointsWithIndices[1][1];
    let prevNode = graph.addEdgeXY(point0.x, point0.y, point1.x, point1.y);
    prevNode.edgeTag = index0;
    prevNode.edgeMate.edgeTag = index1;
    for (let i = 1; i < pointsWithIndices.length - 1; i++) {
      point0 = pointsWithIndices[i][0];
      point1 = pointsWithIndices[i + 1][0];
      index0 = pointsWithIndices[i][1];
      index1 = pointsWithIndices[i + 1][1];
      const nextNode = graph.addEdgeXY(point0.x, point0.y, point1.x, point1.y);
      nextNode.edgeTag = index0;
      nextNode.edgeMate.edgeTag = index1;
      HalfEdge.pinch(prevNode.faceSuccessor, nextNode);
      prevNode = nextNode;
    }
    return graph;
  }
  // find the bisector of a line segment defined by two points p0 and p1 and limit it to the voronoi boundary
  private static getLineBisector(p0: Point3d, p1: Point3d, voronoiBoundary: VoronoiBoundary): Line | undefined {
    p0.z = p1.z = 0; // ignore z-coordinate
    const midPoint = Point3d.createAdd2Scaled(p0, 0.5, p1, 0.5);
    const perp = Vector3d.create(p0.y - p1.y, p1.x - p0.x);
    const scale = 10;
    const bisectorStart = Point3d.createAdd2Scaled(midPoint, 1, perp, -scale);
    const bisectorEnd = Point3d.createAdd2Scaled(midPoint, 1, perp, scale);
    const bisector: Line = { start: bisectorStart, end: bisectorEnd };
    const intersection = voronoiBoundary.intersect(bisector);
    if (!intersection || intersection.length <= 1)
      return undefined;
    return { start: intersection[0], end: intersection[1] }; // limit bisector to the voronoi boundary
  }
  // create a Voronoi diagram for a graph with colinear points
  private static createVoronoiForColinearPoints(graph: HalfEdgeGraph): HalfEdgeGraph | undefined {
    const voronoi = new Voronoi(graph, true);
    if (!voronoi._inputGraphIsValid)
      return undefined;
    const voronoiBoundary = new VoronoiBoundary(voronoi._graphRange, voronoi._circumcenterRange);
    const voronoiDiagram = new HalfEdgeGraph();
    let isValidVoronoi = true;
    graph.announceEdges(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const bisector = Voronoi.getLineBisector(seed.getPoint3d(), seed.edgeMate.getPoint3d(), voronoiBoundary);
        if (!bisector) {
          isValidVoronoi = false;
          return false;
        }
        voronoiDiagram.addEdgeXY(
          bisector.start.x, bisector.start.y,
          bisector.end.x, bisector.end.y,
          voronoi._idToIndexMap.get(seed.id), voronoi._idToIndexMap.get(seed.edgeMate.id),
        );
        HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
        return true;
      },
    );
    if (!isValidVoronoi)
      return undefined;
    Voronoi.addVoronoiBoundary(voronoiDiagram, voronoiBoundary);
    Voronoi.populateMasksAndFaceTags(voronoiDiagram);
    return voronoiDiagram;
  }
  /**
   * Creates a Voronoi diagram from a set of points.
   * @param points An array of points; xy-only (z-coordinate is ignored). Points can be colinear.
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid.
   */
  public static createVoronoiFromPoints(points: Point3d[]): HalfEdgeGraph | undefined {
    if (!points || points.length < 2)
      return undefined;
    // remove duplicates
    const uniquePoints = Array.from(new Set(points.map(p => `${p.x},${p.y}`)))
      .map(p => p.split(',').map(Number))
      .map(p => Point3d.create(p[0], p[1]));
    if (PolylineOps.isColinear(uniquePoints)) {
      const sortedPoints = uniquePoints.slice().sort((a, b) => a.x - b.x || a.y - b.y); // sort points by x, then y
      const graph = Voronoi.createLinearGraph(sortedPoints.map(point => [point, 0]));
      return graph ? Voronoi.createVoronoiForColinearPoints(graph) : undefined;
    } else {
      const graph = Triangulator.createTriangulatedGraphFromPoints(uniquePoints);
      return graph ? Voronoi.createVoronoi(graph) : undefined;
    }
  }
  // find the Voronoi diagram for a set of points with child indices and
  // then combine Voronoi faces for each child index into a single region
  private static createVoronoiFromPointsWithIndices(
    pointsWithIndices: [Point3d, number][], numChildren: number, tol: number,
  ): AnyRegion[] | undefined {
    if (!pointsWithIndices || pointsWithIndices.length < 2)
      return undefined;
    const comparePoints: OrderedComparator<Point3d> = (p0: Point3d, p1: Point3d) => {
      if (p0.isAlmostEqual(p1, tol))
        return 0;
      if (!Geometry.isAlmostEqualNumber(p0.x, p1.x, tol)) {
        if (p0.x < p1.x)
          return -1;
        if (p0.x > p1.x)
          return 1;
      }
      if (!Geometry.isAlmostEqualNumber(p0.y, p1.y, tol)) {
        if (p0.y < p1.y)
          return -1;
        if (p0.y > p1.y)
          return 1;
      }
      if (!Geometry.isAlmostEqualNumber(p0.z, p1.z, tol)) {
        if (p0.z < p1.z)
          return -1;
        if (p0.z > p1.z)
          return 1;
      }
      return 0;
    };
    const clonePoint: CloneFunction<Point3d> = (p: Point3d) => {
      return p.clone();
    };
    const pointToIndexDic = new Dictionary<Point3d, number>(comparePoints, clonePoint);
    for (const [point, index] of pointsWithIndices)
      pointToIndexDic.insert(point, index);
    let voronoiDiagram: HalfEdgeGraph | undefined;
    let graph: HalfEdgeGraph | undefined;
    if (PolylineOps.isColinear(Array.from(pointToIndexDic.keys()))) {
      const sortedPoints = pointToIndexDic.extractPairs().slice().sort((a, b) => a.key.x - b.key.x || a.key.y - b.key.y); // sort points by x, then y
      graph = Voronoi.createLinearGraph(sortedPoints.map(item => [item.key, item.value]));
      voronoiDiagram = graph ? Voronoi.createVoronoiForColinearPoints(graph) : undefined;
    } else {
      graph = Triangulator.createTriangulatedGraphFromPoints(Array.from(pointToIndexDic.keys()));
      if (!graph)
        return undefined;
      graph.announceVertexLoops(
        (_g: HalfEdgeGraph, seed: HalfEdge) => {
          const nodesAroundVertex = seed.collectAroundVertex();
          for (const node of nodesAroundVertex) {
            const index = pointToIndexDic.get(node.getPoint3d());
            if (index !== undefined)
              node.edgeTag = index; // set edgeTag to the child index
          }
          return true;
        }
      );
      voronoiDiagram = graph ? Voronoi.createVoronoi(graph, tol) : undefined;
    }
    if (!voronoiDiagram)
      return undefined;
    // a 2D array where row index is equal child index (stored in edgeTags of graph nodes) and each row stores loops;
    // all loops in a row represent all faces of the Voronoi diagram that have "faceTag = row index = child index"
    const loops: Loop[][] = new Array(numChildren).fill(null).map(() => []);
    const allFaces = voronoiDiagram.collectFaceLoops();
    for (const face of allFaces) {
      if (face.isMaskSet(HalfEdgeMask.EXTERIOR))
        continue; // skip exterior face
      const childIndex = graph.allHalfEdges[face.faceTag as number].edgeTag;
      const points = face.collectAroundFace().map((node) => node.getPoint3d()) as Point3d[];
      loops[childIndex].push(Loop.createPolygon(points));
    }
    // combine loops for each child index into a single region
    const combinedRegions: AnyRegion[] = [];
    for (let childIndex = 0; childIndex < numChildren; childIndex++) {
      let loopOut: AnyRegion | undefined;
      for (const loop of loops[childIndex])
        loopOut = RegionOps.regionBooleanXY(loop, loopOut, RegionBinaryOpType.Union);
      if (loopOut === undefined)
        return undefined; // failed to create a region for this child index
      const signedLoops = RegionOps.constructAllXYRegionLoops(loopOut);
      if (signedLoops.length === 0)
        return undefined; // failed to create signed loops for this child index
      // @dave: not sure below line is correct but works fine
      combinedRegions.push(signedLoops[0].negativeAreaLoops[0]);
    }
    return combinedRegions;
  }
  // stoke child curve from start and end to get sample points; skip the first and last points on the child curve
  // each sample point is a tuple of [Point3d, childIndex]
  private static pushPointsWithIndices(
    child: CurvePrimitive, childIndex: number, pointsWithIndices: [Point3d, number][], strokeOptions: StrokeOptions,
  ): boolean {
    const halfChild0 = child.clonePartialCurve(0, 0.5);
    const halfChild1 = child.clonePartialCurve(0.5, 1);
    if (halfChild0 === undefined || halfChild1 === undefined)
      return false;
    halfChild1.reverseInPlace();
    const dest0: LineString3d = LineString3d.create();
    halfChild0.emitStrokes(dest0, strokeOptions);
    const pointsWithIndices0 = dest0.points.map((point): [Point3d, number] => [point, childIndex])
    pointsWithIndices.push(...pointsWithIndices0.slice(1)); // skip the first point on the child curve
    const dest1: LineString3d = LineString3d.create();
    halfChild1.emitStrokes(dest1, strokeOptions);
    const pointsWithIndices1 = dest1.points.map((point): [Point3d, number] => [point, childIndex])
    pointsWithIndices.push(...pointsWithIndices1.slice(1)); // skip the last point on the child curve
    return true;
  }
  /**
   * Creates a Voronoi diagram from a curve chain.
   * @param curveChain A curve chain; xy-only (z-coordinate is ignored).
   * @param strokeOptions Optional stroke options to control the sampling of the curve chain.
   * @returns An array of AnyRegion where each region representing a face of Voronoi diagram corresponding a child of curve
   * chain, or undefined if the input is invalid.
   */
  public static createVoronoiFromCurveChain(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, tol: number = Geometry.smallMetricDistance // strokePoints?: Point3d[],
  ): AnyRegion[] | undefined {
    if (strokeOptions === undefined)
      strokeOptions = new StrokeOptions();
    const children = curveChain.children;
    // we should add start and end points to the pointsWithIndices array to
    // ensure that the curve chain will be inside the Voronoi boundary rectangle
    const startPoint = curveChain.startPoint();
    const endPoint = curveChain.endPoint();
    if (!children || !startPoint || !endPoint)
      return undefined;
    const numChildren = children.length;
    const pointsWithIndices: [Point3d, number][] = [];
    pointsWithIndices.push([startPoint, 0]);
    for (let i = 0; i < numChildren; i++) {
      const child = children[i];
      if (child instanceof LineString3d) {
        const points = child.points;
        if (points.length < 2)
          continue; // skip empty or single-point line strings
        for (let j = 0; j < points.length - 1; j++) {
          const segment = LineSegment3d.create(points[j], points[j + 1]);
          if (!Voronoi.pushPointsWithIndices(segment, i, pointsWithIndices, strokeOptions))
            return undefined;
        }
      } else {
        if (!Voronoi.pushPointsWithIndices(child, i, pointsWithIndices, strokeOptions))
          return undefined;
      }
    }
    pointsWithIndices.push([endPoint, numChildren - 1]);
    return Voronoi.createVoronoiFromPointsWithIndices(pointsWithIndices, numChildren, tol);
  }
}

/**
 * A class to represent the boundary for a Voronoi diagram.
 * * Voronoi diagram is unbounded, so we create a large rectangle around the diagram to limit it. The rectangle is
 * large enough to contain the circumcenters of the Delaunay triangles.
 */
class VoronoiBoundary {
  public p0: XAndY;
  public p1: XAndY;
  public p2: XAndY;
  public p3: XAndY;
  /**
   * Constructor
   * @param graphRange Range of the HalfEdgeGraph representing a Delaunay triangulated graph; xy-only (z-coordinate is ignored).
   * @param circumcenterRange Range of the circumcenters of the triangles in the Delaunay triangulation.
   */
  constructor(graphRange: Range3d, circumcenterRange: Range3d) {
    const minPadding = 2;  // smallest padding
    const maxPadding = 10; // do not let padding grow too large
    const ratio = 0.05;    // 5% relative padding
    const padX = Math.min(Math.max(graphRange.xLength() * ratio, minPadding), maxPadding) + circumcenterRange.xLength();
    const padY = Math.min(Math.max(graphRange.yLength() * ratio, minPadding), maxPadding) + circumcenterRange.yLength();
    this.p0 = Point2d.create(graphRange.low.x - padX, graphRange.low.y - padY);
    this.p1 = Point2d.create(graphRange.high.x + padX, graphRange.low.y - padY);
    this.p2 = Point2d.create(graphRange.high.x + padX, graphRange.high.y + padY);
    this.p3 = Point2d.create(graphRange.low.x - padX, graphRange.high.y + padY);
  }
  public contains(point: Point3d): boolean {
    return this.p0.x <= point.x && point.x <= this.p1.x &&
      this.p1.y <= point.y && point.y <= this.p2.y;
  }
  public intersect(line: Line): Point3d[] {
    const intersections: Point3d[] = [];
    const fractions: Vector2d = Vector2d.createZero();
    for (const pair of [[this.p0, this.p1], [this.p1, this.p2], [this.p2, this.p3], [this.p3, this.p0]]) {
      const intersectionFound = SmallSystem.lineSegment2dXYTransverseIntersectionUnbounded(
        line.start as Point2d, line.end as Point2d, pair[0] as Point2d, pair[1] as Point2d, fractions,
      );
      if (!intersectionFound)
        continue; // no intersection found
      const lineFraction = fractions.x;
      const pairFraction = fractions.y;
      if (lineFraction >= 0 && lineFraction <= 1 && pairFraction >= 0 && pairFraction <= 1) {
        const direction = Vector2d.createStartEnd(line.start, line.end);
        const d: XYAndZ = { x: direction.x, y: direction.y, z: 0 };
        intersections.push(Point3d.createAdd2Scaled(line.start as XYAndZ, 1, d, lineFraction));
      }
    }
    return intersections;
  }
}
