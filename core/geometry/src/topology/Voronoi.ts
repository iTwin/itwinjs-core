/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { Arc3d } from "../curve/Arc3d";
import { CurveChain } from "../curve/CurveCollection";
import { CurveCurve } from "../curve/CurveCurve";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { XAndY } from "../geometry3d/XYZProps";
import { AnyRegion } from "../curve/CurveTypes";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgeGraphMerge, HalfEdgeGraphOps } from "./Merging";
import { Triangulator } from "./Triangulation";
import { RegionBinaryOpType, RegionOps } from "../curve/RegionOps";
import { Loop } from "../curve/Loop";

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
  private constructor(graph: HalfEdgeGraph, isColinear = false) {
    if (!isColinear)
      this.populateCircumcenters(graph);
    this.populateIdToIndexMap(graph);
  }
  // find min id of the face containing this vertex
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
        // find center of circumcircle of the triangle formed by this face
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
  }
  // go over all the nodes in the graph and create a map of node IDs in a vertex loop to
  // min index (in graph.allHalfEdges) of that vertex loop
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
    vertex: HalfEdge, circumcenter: Point3d, voronoiBoundaryData: VoronoiBoundaryData
  ): LineSegment3d | undefined {
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
    const scale = 100; // had to pick a large scale to ensure the bisector is long enough to intersect the voronoi boundary
    const bisectorStart = circumcenter;
    const bisectorEnd = Point3d.createAdd2Scaled(bisectorStart, 1, direction, scale);
    const bisector = LineSegment3d.create(bisectorStart, bisectorEnd);
    const intersection = CurveCurve.intersectionXYPairs(bisector, false, voronoiBoundaryData.boundary, false);
    if (!intersection || intersection.length === 0)
      return undefined; // bisector is outside the voronoi boundary for skinny triangles; skip it
    if (voronoiBoundaryData.boundaryRange.containsPoint(circumcenter))
      return LineSegment3d.create(bisectorStart, intersection[0].detailA.point);
    else
      return LineSegment3d.create(intersection[0].detailA.point, intersection[1].detailA.point);
  }
  private static handleBoundaryEdge(
    seed: HalfEdge,
    voronoi: Voronoi,
    voronoiBoundaryData: VoronoiBoundaryData,
    voronoiDiagram: HalfEdgeGraph,
    seedIsExterior: boolean,
  ): boolean {
    let vertex = seed;
    if (seedIsExterior)
      vertex = seed.edgeMate;
    const minId = Voronoi.findFaceMinId(vertex);
    const circumcenter = voronoi._circumcenterMap.get(minId);
    if (!circumcenter)
      return false; // no circumcenter found for this edge
    const bisector = Voronoi.getBisector(vertex, circumcenter, voronoiBoundaryData);
    if (!bisector)
      return true; // bisector is outside the voronoi boundary for skinny triangles; skip it
    voronoiDiagram.addLineSegmentXY(
      bisector, voronoi._idToIndexMap.get(seed.id), voronoi._idToIndexMap.get(seed.edgeMate.id),
    );
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
    return true;
  }
  private static handleInteriorEdge(
    seed: HalfEdge,
    voronoi: Voronoi,
    voronoiBoundaryData: VoronoiBoundaryData,
    voronoiDiagram: HalfEdgeGraph,
  ): boolean {
    const minId0 = Voronoi.findFaceMinId(seed);
    const minId1 = Voronoi.findFaceMinId(seed.edgeMate);
    const circumcenter0 = voronoi._circumcenterMap.get(minId0);
    const circumcenter1 = voronoi._circumcenterMap.get(minId1);
    if (!circumcenter0 || !circumcenter1)
      return false; // no circumcenter found for this edge
    if (circumcenter0.isAlmostEqual(circumcenter1))
      return true; // circumcenters are the same, skip this edge
    const voronoiBoundaryRange = voronoiBoundaryData.boundaryRange;
    const center0IsInsideVoronoiBoundary = voronoiBoundaryRange.containsPoint(circumcenter0);
    const center1IsInsideVoronoiBoundary = voronoiBoundaryRange.containsPoint(circumcenter1);
    if (!center0IsInsideVoronoiBoundary && !center1IsInsideVoronoiBoundary)
      return true; // both circumcenters are outside the voronoi boundary, skip this edge
    const ls = LineSegment3d.create(circumcenter0, circumcenter1);
    const intersection = CurveCurve.intersectionXYPairs(ls, false, voronoiBoundaryData.boundary, false);
    if (intersection && intersection.length > 0) { // circumcenter is outside the voronoi boundary for skinny triangles
      const center = center0IsInsideVoronoiBoundary ? circumcenter0 : circumcenter1;
      const limitedLs = LineSegment3d.create(center, intersection[0].detailA.point); // limit ls to the voronoi boundary
      voronoiDiagram.addLineSegmentXY(
        limitedLs, voronoi._idToIndexMap.get(seed.id), voronoi._idToIndexMap.get(seed.edgeMate.id),
      );
    } else {
      voronoiDiagram.addLineSegmentXY(
        ls, voronoi._idToIndexMap.get(seed.id), voronoi._idToIndexMap.get(seed.edgeMate.id),
      );
    }
    HalfEdgeGraphMerge.splitIntersectingEdges(voronoiDiagram);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
    return true;
  }
  private static addVoronoiBoundary(voronoiDiagram: HalfEdgeGraph, voronoiBoundaryData: VoronoiBoundaryData) {
    voronoiDiagram.addLineSegmentXY(voronoiBoundaryData.lineSegment0);
    voronoiDiagram.addLineSegmentXY(voronoiBoundaryData.lineSegment1);
    voronoiDiagram.addLineSegmentXY(voronoiBoundaryData.lineSegment2);
    voronoiDiagram.addLineSegmentXY(voronoiBoundaryData.lineSegment3);
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
   * @param pad Optional padding in x and y directions to expand the graph range to create the Voronoi boundary rectangle.
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid. Each voronoi face
   * corresponds to a vertex in the input graph and we store the index of the vertex (in graph.allHalfEdges) in the
   * edgeTag of all nodes in that voronoi face.
   */
  public static createVoronoi(graph: HalfEdgeGraph, pad?: XAndY): HalfEdgeGraph | undefined {
    const graphLength = graph.allHalfEdges.length;
    if (graph === undefined || graphLength < 3)
      return undefined;
    let isValidVoronoi = true;
    const voronoi = new Voronoi(graph);
    if (!voronoi._inputGraphIsValid)
      return undefined;
    const voronoiBoundaryData = new VoronoiBoundaryData(graph, pad);
    const voronoiDiagram = new HalfEdgeGraph();
    // handle special case when mesh is a single skinny triangle
    let circumcenterIsInsideVoronoiBoundary = false;
    const numTriangles = voronoi._circumcenterMap.size;
    if (numTriangles === 1) {
      const circumcenter = voronoi._circumcenterMap.entries().next().value?.[1];
      if (circumcenter)
        circumcenterIsInsideVoronoiBoundary = voronoiBoundaryData.boundaryRange.containsPoint(circumcenter);
    }
    if (isValidVoronoi && numTriangles === 1 && !circumcenterIsInsideVoronoiBoundary) {
      graph.announceEdges(
        (_g: HalfEdgeGraph, seed: HalfEdge) => {
          isValidVoronoi = Voronoi.handleBoundaryEdge(
            seed, voronoi, voronoiBoundaryData, voronoiDiagram, seed.isMaskSet(HalfEdgeMask.EXTERIOR),
          );
          return isValidVoronoi;
        },
      );
    } else {
      // go over all edges in the graph and add bisectors for boundary edges
      // and add line between circumcenters for interior edges
      if (isValidVoronoi) {
        graph.announceEdges(
          (_g: HalfEdgeGraph, seed: HalfEdge) => {
            const seedIsExterior = seed.isMaskSet(HalfEdgeMask.EXTERIOR);
            const seedIsBoundary = seed.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE);
            if (seedIsExterior || seedIsBoundary) {
              isValidVoronoi = Voronoi.handleBoundaryEdge(
                seed, voronoi, voronoiBoundaryData, voronoiDiagram, seedIsExterior,
              );
              return isValidVoronoi;
            } else {
              isValidVoronoi = Voronoi.handleInteriorEdge(seed, voronoi, voronoiBoundaryData, voronoiDiagram);
              return isValidVoronoi;
            }
          },
        );
      }
    }
    if (!isValidVoronoi)
      return undefined; // invalid graph
    Voronoi.addVoronoiBoundary(voronoiDiagram, voronoiBoundaryData);
    Voronoi.populateMasksAndFaceTags(voronoiDiagram);
    return voronoiDiagram;
  }
  // checks if all points are colinear
  private static pointsAreColinear(points: Point3d[]): boolean {
    if (points.length < 3)
      return true;
    const p0 = points[0];
    const vectorA = Vector3d.createStartEnd(p0, points[1]);
    for (let i = 2; i < points.length; i++) {
      const vectorB = Vector3d.createStartEnd(p0, points[i]);
      if (vectorA.crossProduct(vectorB).magnitude() > Geometry.smallMetricDistanceSquared)
        return false;
    }
    return true;
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
  private static getLineBisector(p0: Point3d, p1: Point3d, voronoiBoundary: LineString3d): LineSegment3d | undefined {
    p0.z = p1.z = 0; // ignore z-coordinate
    const midPoint = Point3d.createAdd2Scaled(p0, 0.5, p1, 0.5);
    const perp = Vector3d.create(p0.y - p1.y, p1.x - p0.x);
    const bisectorStart = midPoint;
    const bisectorEnd = Point3d.createAdd2Scaled(bisectorStart, 1, perp, 1);
    const bisector = LineSegment3d.create(bisectorStart, bisectorEnd);
    const intersection = CurveCurve.intersectionXYPairs(bisector, true, voronoiBoundary, false);
    if (!intersection || intersection.length === 0)
      return undefined;
    return LineSegment3d.create(intersection[0].detailA.point, intersection[1].detailA.point); // limit bisector to the voronoi boundary
  }
  private static createVoronoiForColinearPoints(graph: HalfEdgeGraph, pad?: XAndY): HalfEdgeGraph | undefined {
    const voronoi = new Voronoi(graph, true);
    if (!voronoi._inputGraphIsValid)
      return undefined;
    const voronoiBoundaryData = new VoronoiBoundaryData(graph, pad);
    const voronoiDiagram = new HalfEdgeGraph();
    let isValidVoronoi = true;
    graph.announceEdges(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const bisector = Voronoi.getLineBisector(
          seed.getPoint3d(), seed.edgeMate.getPoint3d(), voronoiBoundaryData.boundary,
        );
        if (!bisector) {
          isValidVoronoi = false;
          return false;
        }
        voronoiDiagram.addLineSegmentXY(
          bisector, voronoi._idToIndexMap.get(seed.id), voronoi._idToIndexMap.get(seed.edgeMate.id),
        );
        HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoiDiagram);
        return true;
      },
    );
    if (!isValidVoronoi)
      return undefined;
    Voronoi.addVoronoiBoundary(voronoiDiagram, voronoiBoundaryData);
    Voronoi.populateMasksAndFaceTags(voronoiDiagram);
    return voronoiDiagram;
  }
  /**
   * Creates a Voronoi diagram from a set of points.
   * @param points An array of points; xy-only (z-coordinate is ignored). Points can be colinear.
   * @param pad Optional padding in x and y directions to expand the graph range to create the Voronoi boundary rectangle.
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid.
   */
  public static createVoronoiFromPoints(points: Point3d[], pad?: XAndY): HalfEdgeGraph | undefined {
    if (!points || points.length < 2)
      return undefined;
    // remove duplicates
    const uniquePoints = Array.from(new Set(points.map(p => `${p.x},${p.y}`)))
      .map(p => p.split(',').map(Number))
      .map(p => Point3d.create(p[0], p[1]));
    if (Voronoi.pointsAreColinear(uniquePoints)) {
      const sortedPoints = uniquePoints.slice().sort((a, b) => a.x - b.x || a.y - b.y); // sort points by x, then y
      const graph = Voronoi.createLinearGraph(sortedPoints.map(point => [point, 0]));
      return graph ? Voronoi.createVoronoiForColinearPoints(graph, pad) : undefined;
    } else {
      const graph = Triangulator.createTriangulatedGraphFromPoints(uniquePoints);
      return graph ? Voronoi.createVoronoi(graph, pad) : undefined;
    }
  }
  // find the Voronoi diagram for a set of points with child indices and
  // then combine Voronoi faces for each child index into a single region
  private static createVoronoiFromPointsWithIndices(
    pointsWithIndices: [Point3d, number][], numChildren: number, pad?: XAndY,
  ): AnyRegion[] | undefined {
    if (!pointsWithIndices || pointsWithIndices.length < 2)
      return undefined;
    // remove duplicates
    const uniquePointsWithIndices = Array.from(
      new Map(
        pointsWithIndices.map(([point, num]) => [
          `${point.x},${point.y},${point.z},${num}`,
          [point, num] as [Point3d, number],
        ])
      ).values()
    );
    let voronoiDiagram: HalfEdgeGraph | undefined;
    let graph: HalfEdgeGraph | undefined;
    if (Voronoi.pointsAreColinear(uniquePointsWithIndices.map(([point]) => point))) {
      const sortedPoints = uniquePointsWithIndices.slice().sort((a, b) => a[0].x - b[0].x || a[0].y - b[0].y); // sort points by x, then y
      graph = Voronoi.createLinearGraph(sortedPoints);
      voronoiDiagram = graph ? Voronoi.createVoronoiForColinearPoints(graph, pad) : undefined;
    } else {
      // TODO: implement Triangulator.createTriangulatedGraphFromPointsWithIndices
      // const graph = Triangulator.createTriangulatedGraphFromPointsWithIndices(uniquePointsWithIndices);
      graph = Triangulator.createTriangulatedGraphFromPoints(uniquePointsWithIndices.map(([point]) => point));
      voronoiDiagram = graph ? Voronoi.createVoronoi(graph, pad) : undefined;
    }
    if (!voronoiDiagram || !graph)
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
      // @dave: not sure below line is correct but works fine for colinear case
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
   * @param pad Optional padding in x and y directions to expand the graph range to create the Voronoi boundary rectangle.
   * @returns An array of AnyRegion where each region representing a face of Voronoi diagram corresponding a child of curve
   * chain, or undefined if the input is invalid.
   */
  public static createVoronoiFromCurveChain(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, pad?: XAndY,
  ): AnyRegion[] | undefined {
    if (strokeOptions === undefined)
      strokeOptions = new StrokeOptions();
    const children = curveChain.children;
    if (!children)
      return undefined;
    const numChildren = children.length;
    const pointsWithIndices: [Point3d, number][] = [];
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
    return Voronoi.createVoronoiFromPointsWithIndices(pointsWithIndices, numChildren, pad);
  }

  /////////////// This method is temporary and will be removed. NO NEED TO REVIEW.  /////////////////
  /////////////// Just for debugging purposes. This method is called by last 4 tests. /////////////////
  public static createVoronoiFromCurveChainTMP(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, pad?: XAndY,
  ): HalfEdgeGraph | undefined {
    if (strokeOptions === undefined)
      strokeOptions = new StrokeOptions();
    const children = curveChain.children;
    if (!children)
      return undefined;
    const numChildren = children.length;
    const pointsWithIndices: [Point3d, number][] = [];
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
    const graph = Triangulator.createTriangulatedGraphFromPoints(pointsWithIndices.map(([point]) => point));
    return graph ? Voronoi.createVoronoi(graph, pad) : undefined;
  }
}

/**
 * A class to represent the boundary data for a Voronoi diagram.
 * * Voronoi diagram is unbounded, so we create a large rectangle around the diagram to limit it.
 * */
class VoronoiBoundaryData {
  private _p0: Point3d;
  private _p1: Point3d;
  private _p2: Point3d;
  private _p3: Point3d;
  public lineSegment0: LineSegment3d;
  public lineSegment1: LineSegment3d;
  public lineSegment2: LineSegment3d;
  public lineSegment3: LineSegment3d;
  public boundary: LineString3d;
  public boundaryRange: Range3d;

  /**
   * Constructor
   * @param graph A HalfEdgeGraph representing a Delaunay triangulated graph; xy-only (z-coordinate is ignored).
   * @param pad Optional padding in x and y directions to expand the graph range to create the Voronoi boundary rectangle.
   */
  constructor(graph: HalfEdgeGraph, pad?: XAndY) {
    const graphRange = HalfEdgeGraphOps.graphRange(graph);
    let padX = 0;
    let padY = 0;
    if (pad === undefined) {
      const minPadding = 2; // smallest padding
      const maxPadding = 10; // don't let padding grow too large
      const ratio = 0.05; // 5% relative padding
      padX = Math.min(Math.max(graphRange.xLength() * ratio, minPadding), maxPadding);
      padY = Math.min(Math.max(graphRange.yLength() * ratio, minPadding), maxPadding);
    } else {
      padX = pad.x;
      padY = pad.y;
    }
    this._p0 = Point3d.create(graphRange.low.x - padX, graphRange.low.y - padY);
    this._p1 = Point3d.create(graphRange.high.x + padX, graphRange.low.y - padY);
    this._p2 = Point3d.create(graphRange.high.x + padX, graphRange.high.y + padY);
    this._p3 = Point3d.create(graphRange.low.x - padX, graphRange.high.y + padY);
    this.lineSegment0 = LineSegment3d.create(this._p0, this._p1);
    this.lineSegment1 = LineSegment3d.create(this._p1, this._p2);
    this.lineSegment2 = LineSegment3d.create(this._p2, this._p3);
    this.lineSegment3 = LineSegment3d.create(this._p3, this._p0);
    this.boundary = LineString3d.create(this._p0, this._p1, this._p2, this._p3, this._p0);
    this.boundaryRange = Range3d.createArray(this.boundary.points);
  }
}
