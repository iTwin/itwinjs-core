/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { assert, Dictionary, DuplicatePolicy, SortedArray } from "@itwin/core-bentley";
import { ClipPlane } from "../clipping/ClipPlane";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "../clipping/UnionOfConvexClipPlaneSets";
import { Arc3d } from "../curve/Arc3d";
import { CurveChain } from "../curve/CurveCollection";
import { CurveCurve } from "../curve/CurveCurve";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PolylineOps } from "../geometry3d/PolylineOps";
import { Range2d } from "../geometry3d/Range";
import { Ray2d } from "../geometry3d/Ray2d";
import { XAndY } from "../geometry3d/XYZProps";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgeGraphSearch } from "./HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge, HalfEdgeGraphOps } from "./Merging";
import { Triangulator } from "./Triangulation";

interface Segment2d {
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
  private _voronoiGraph: HalfEdgeGraph;
  private _inputGraph: Readonly<HalfEdgeGraph>;
  private _inputGraphIsTriangulation;
  private _inputGraphRange: Range2d;
  private _idToIndexMap: Map<number, number>;
  private _circumcenterMap: Map<number, XAndY>;
  private _circumcenterRange: Range2d;
  private static _workArc = Arc3d.createUnitCircle();
  // Construct an empty Voronoi diagram and minimally validate input (use `isValid` to check)
  private constructor(inputGraph: Readonly<HalfEdgeGraph>, isColinear = false) {
    this._voronoiGraph = new HalfEdgeGraph();
    this._inputGraph = inputGraph;
    this._inputGraphRange = HalfEdgeGraphOps.graphRangeXY(inputGraph);
    this._idToIndexMap = this.populateIdToIndexMap();
    this._circumcenterMap = new Map<number, XAndY>();
    this._inputGraphIsTriangulation = isColinear ? false : this.populateCircumcenters(this._circumcenterMap);
    this._circumcenterRange = Range2d.createArray(Array.from(this._circumcenterMap.values()));
  }
  public get getVoronoiGraph(): HalfEdgeGraph {
    return this._voronoiGraph;
  }
  /** The input graph is either a triangulation (assumed Delaunay) or a graph with no interior faces (assumed colinear path). */
  public get getInputGraph(): Readonly<HalfEdgeGraph> {
    return this._inputGraph;
  }
  public get isValid(): boolean {
    if (this._inputGraph.allHalfEdges.length < 2)
      return false;
    if (this._idToIndexMap.size === 0)
      return false;
    if (!this._inputGraphIsTriangulation)
      return true;
    return this._circumcenterMap.size > 0;
  }
  /** Add an edge to the graph and set its edgeTags. */
  private static addEdgeWithEdgeTags(graph: HalfEdgeGraph, p0: XAndY, p1: XAndY, edgeTag0?: number, edgeTag1?: number): HalfEdge {
    return graph.addEdgeXY(p0.x, p0.y, p1.x, p1.y, edgeTag0, edgeTag1);
  }
  /** Add an edge to the graph and set its faceTags. */
  private static addEdgeWithFaceTags(graph: HalfEdgeGraph, p0: XAndY, p1: XAndY, faceTag0?: number, faceTag1?: number): HalfEdge {
    return graph.addEdgeXY(p0.x, p0.y, p1.x, p1.y, undefined, undefined, faceTag0, faceTag1);
  }
  /** Return the smallest HalfEdge id in the face, or -1 if not a triangle. */
  private getTriangleId(face: HalfEdge): number {
    if (face !== face.faceSuccessor.faceSuccessor.faceSuccessor)
      return -1;
    return Math.min(face.id, face.faceSuccessor.id, face.facePredecessor.id);
  }
  /**
   * Populate a mapping from a triangle's id to its circumcircle.
   * @returns whether the input graph is a triangulation.
   */
  private populateCircumcenters(circumcenterMap: Map<number, XAndY>): boolean {
    circumcenterMap.clear();
    let isValid = true;
    const p0 = Point3d.createZero();
    const p1 = Point3d.createZero();
    const p2 = Point3d.createZero();
    this._inputGraph.announceFaceLoops(
      (_g: HalfEdgeGraph, face: HalfEdge) => {
        if (face.isMaskSet(HalfEdgeMask.EXTERIOR))
          return true;
        if (face.countEdgesAroundFace() !== 3)
          return isValid = false;
        // find circumcenter of this triangle (ignore it if degenerate)
        face.getPoint3d(p0);
        face.faceSuccessor.getPoint3d(p1);
        face.facePredecessor.getPoint3d(p2);
        p0.z = p1.z = p2.z = 0;
        const circumcircle = Arc3d.createCircularStartMiddleEnd(p0, p1, p2, Voronoi._workArc);
        if (circumcircle instanceof Arc3d)
          circumcenterMap.set(this.getTriangleId(face), circumcircle.center);
        return true;
      },
    );
    if (!isValid)
      circumcenterMap.clear();
    return isValid;
  }
  /** Create a map from Delaunay HalfEdge id to the smallest index of the HalfEdges in its vertex loop. */
  private populateIdToIndexMap(): Map<number, number> {
    const idToIndexMap = new Map<number, number>();
    this._inputGraph.allHalfEdges.forEach((e: HalfEdge, i: number) => idToIndexMap.set(e.id, i));
    this._inputGraph.announceVertexLoops(
      (_g: HalfEdgeGraph, vertex: HalfEdge) => {
        let minIndex = Number.MAX_SAFE_INTEGER;
        vertex.announceEdgesAroundVertex(
          (e: HalfEdge) => {
            const index = idToIndexMap.get(e.id);
            if (index !== undefined && index < minIndex)
              minIndex = index;
          },
        );
        vertex.announceEdgesAroundVertex((e: HalfEdge) => idToIndexMap.set(e.id, minIndex));
        return true;
      },
    );
    return idToIndexMap;
  }
  /**
   * Return a segment along the bisector of the given triangle edge with the following properties:
   * * start point is the triangle's circumcenter
   * * end point is on the Voronoi boundary
   * * direction vector has positive dot product with the vector from triangle centroid to edge midpoint.
   */
  private getTriangleEdgeBisector(edge: HalfEdge, circumcenter: XAndY, box: VoronoiBoundary): Segment2d | undefined {
    const v0 = edge;
    const v1 = edge.faceSuccessor;
    const v2 = edge.facePredecessor;
    const oneThird = 1.0 / 3.0;
    const midPoint = Point2d.createAdd2ScaledXY(v0.x, v0.y, 0.5, v1.x, v1.y, 0.5);
    const centroid = Point2d.createAdd3ScaledXY(v0.x, v0.y, oneThird, v1.x, v1.y, oneThird, v2.x, v2.y, oneThird);
    const direction = Vector2d.createStartEnd(circumcenter, midPoint);
    if (midPoint.dotVectorsToTargets(circumcenter, centroid) < 0)
      direction.negate(direction); // ensure direction points away from triangle
    const bisector = Ray2d.createOriginAndDirectionCapture(Point2d.createFrom(circumcenter), direction);
    const fractions = box.intersect(bisector);
    const haveIntersections = undefined !== fractions && fractions.length > 1 && fractions[0] < 0 && fractions[1] > 0;
    assert(haveIntersections, "Circumcenters should be strictly inside bounding box");
    return haveIntersections ? { start: circumcenter, end: bisector.fractionToPoint(fractions[1]) } : undefined;
  }
  /** Add the edge of an unbounded Voronoi region that corresponds to a Delaunay boundary edge; clip it at the boundary. */
  private addVoronoiEdgeForDelaunayBoundaryEdge(edge: HalfEdge, box: VoronoiBoundary): boolean {
    const triangleId = this.getTriangleId(edge);
    if (triangleId < 0)
      return false; // invalid graph (not a triangulation)
    const circumcenter = this._circumcenterMap.get(triangleId);
    if (!circumcenter)
      return false; // invalid graph (degenerate boundary triangle)
    const bisector = this.getTriangleEdgeBisector(edge, circumcenter, box);
    if (!bisector)
      return false; // circumcenter outside box (shouldn't happen)
    const faceTag0 = this._idToIndexMap.get(edge.edgeMate.id);
    const faceTag1 = this._idToIndexMap.get(edge.id);
    Voronoi.addEdgeWithFaceTags(this._voronoiGraph, bisector.start, bisector.end, faceTag0, faceTag1);
    return true;
  }
  /** Add the edge of a bounded Voronoi region that corresponds to a Delaunay interior edge. */
  private addVoronoiEdgeForDelaunayInteriorEdge(edge: HalfEdge, box: VoronoiBoundary, distanceTol: number): boolean {
    const triangleId0 = this.getTriangleId(edge);
    const triangleId1 = this.getTriangleId(edge.edgeMate);
    if (triangleId0 < 0 || triangleId1 < 0)
      return false; // invalid graph (not a triangulation)
    const circumcenter0 = this._circumcenterMap.get(triangleId0);
    const circumcenter1 = this._circumcenterMap.get(triangleId1);
    if (!circumcenter0 || !circumcenter1)
      return false; // invalid graph (degenerate interior triangle)
    if (XAndY.almostEqual(circumcenter0, circumcenter1, distanceTol))
      return true; // skip edge (it will vanish during clustering)
    assert(() => box.contains(circumcenter0) && box.contains(circumcenter1), "Circumcenters are supposed to be strictly inside bounding box");
    const faceTag0 = this._idToIndexMap.get(edge.edgeMate.id);
    const faceTag1 = this._idToIndexMap.get(edge.id);
    Voronoi.addEdgeWithFaceTags(this._voronoiGraph, circumcenter0, circumcenter1, faceTag0, faceTag1);
    return true;
  }
  /** Mask the exterior face, and set missing interior face tags */
  private populateMasksAndFaceTags(): void {
    this._voronoiGraph.announceFaceLoops(
      (_g, face: HalfEdge) => {
        let faceTag: number | undefined;
        let edge = face;
        do { // look around the face for a faceTag
          faceTag = edge.faceTag;
          edge = edge.faceSuccessor;
        } while (faceTag === undefined && edge !== face);
        if (faceTag !== undefined) // ensure faceTag is set around the interior face
          face.announceEdgesInFace((e: HalfEdge) => e.faceTag = faceTag);
        else // mask the edges of the exterior face
          face.announceEdgesInFace((e: HalfEdge) => { e.setMask(HalfEdgeMask.EXTERIOR); e.setMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE); });
        return true;
      },
    );
  }
  /**
   * Construct a Voronoi instance from a Delaunay triangulation.
   * * The Delaunay generating vertex `v` for a returned Voronoi region `R` is encoded thusly:
   *   * For each [[HalfEdge]] `e` in the face loop of `R`, `delaunayGraph.allHalfEdges[e.faceTag]` is a HalfEdge in the
   * vertex loop of `v`.
   *   * The same `faceTag` is assigned to all HalfEdges in the face loop of `R`.
   * * For best results:
   *   * The input triangulation should be Delaunay and have convex boundary.
   *   * Each HalfEdge in the exterior face loop of the input graph should have `HalfEdgeMask.BOUNDARY_EDGE` set on both edge mates.
   *   * Each HalfEdge in the exterior face loop of the input graph should have `HalfEdgeMask.EXTERIOR` set.
   *   * The input graph should not contain any pair of vertices closer than `distanceTol`.
   *   * The input graph should not contain any triangle altitude smaller than `distanceTol` (this is a degenerate triangle).
   * @param delaunayGraph A HalfEdgeGraph representing a Delaunay triangulation. Z-coordinates are ignored.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is `Geometry.smallMetricDistance`.
   * @returns a new instance containing the Voronoi diagram derived from the input graph, or `undefined` if invalid input.
   */
  public static createFromDelaunayGraph(
    delaunayGraph: HalfEdgeGraph,
    distanceTol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const instance = new Voronoi(delaunayGraph);
    if (!instance.isValid)
      return undefined;
    let isValidVoronoi = true;
    const box = new VoronoiBoundary(instance._inputGraphRange, instance._circumcenterRange);
    // iterate Delaunay edges and add Voronoi edges:
    // * for each boundary edge, add a bisector separating unbounded Voronoi cells
    // * for each interior edge, add a segment joining the adjacent triangles' circumcenters
    instance._inputGraph.announceEdges(
      (_g, edge: HalfEdge) => {
        if (edge.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE)) {
          if (edge.isMaskSet(HalfEdgeMask.EXTERIOR))
            edge = edge.edgeMate;
          return isValidVoronoi = instance.addVoronoiEdgeForDelaunayBoundaryEdge(edge, box);
        }
        return isValidVoronoi = instance.addVoronoiEdgeForDelaunayInteriorEdge(edge, box, distanceTol);
      },
    );
    if (!isValidVoronoi)
      return undefined;
    box.addEdgesToGraph(instance._voronoiGraph);
    HalfEdgeGraphMerge.splitIntersectingEdges(instance._voronoiGraph, distanceTol);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(instance._voronoiGraph, undefined, distanceTol);
    instance.populateMasksAndFaceTags();
    return instance;
  }
  /** Create a graph from ordered colinear points; optional Dictionary supplies edgeTag for the HalfEdges at each vertex. */
  private static createColinearXYGraph(points: XAndY[] | Dictionary<Point3d, number>): HalfEdgeGraph {
    const colinearGraph = new HalfEdgeGraph();
    let indices: number[] | undefined;
    if (!Array.isArray(points)) {
      indices = Array.from(points.values());
      points = Array.from(points.keys());
    }
    if (points.length < 2)
      return colinearGraph; // empty
    let prevNode = this.addEdgeWithEdgeTags(colinearGraph, points[0], points[1], indices ? indices[0] : 0, indices ? indices[1] : 0,)
    for (let i = 1; i < points.length - 1; i++) {
      const nextNode = this.addEdgeWithEdgeTags(colinearGraph, points[i], points[i + 1], indices ? indices[i] : 0, indices ? indices[i + 1] : 0);
      HalfEdge.pinch(prevNode.faceSuccessor, nextNode);
      prevNode = nextNode;
    }
    colinearGraph.setMask(HalfEdgeMask.EXTERIOR | HalfEdgeMask.BOUNDARY_EDGE);
    return colinearGraph;
  }
  /** Return a segment along the bisector of the given edge. Clip the bisector to the Voronoi boundary. */
  private static getEdgeBisector(edge: HalfEdge, box: VoronoiBoundary): Segment2d | undefined {
    const v0 = edge;
    const v1 = edge.faceSuccessor;
    const midPoint = Point2d.createAdd2ScaledXY(v0.x, v0.y, 0.5, v1.x, v1.y, 0.5);
    const perpendicular = Vector2d.createStartEnd(v0, v1);
    [perpendicular.x, perpendicular.y] = [-perpendicular.y, perpendicular.x];
    const bisector = Ray2d.createOriginAndDirectionCapture(midPoint, perpendicular);
    const fractions = box.intersect(bisector);
    const haveIntersections = undefined !== fractions && fractions.length > 1 && fractions[0] < 0 && fractions[1] > 0;
    assert(haveIntersections, "Midpoints should be strictly inside bounding box");
    return haveIntersections ? { start: bisector.fractionToPoint(fractions[0]), end: bisector.fractionToPoint(fractions[1]) } : undefined;
  }
  /** Construct a Voronoi instance from a graph representing a colinear linestring. */
  private static createFromColinearGraph(
    colinearGraph: HalfEdgeGraph,
    distanceTol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const instance = new Voronoi(colinearGraph, true);
    if (!instance.isValid)
      return undefined;
    let isValidVoronoi = true;
    const box = new VoronoiBoundary(instance._inputGraphRange);
    instance._inputGraph.announceEdges(
      (_g, edge: HalfEdge) => {
        const bisector = Voronoi.getEdgeBisector(edge, box);
        if (!bisector)
          return isValidVoronoi = false; // edge midpoint outside box (shouldn't happen)
        const faceTag0 = instance._idToIndexMap.get(edge.id);
        const faceTag1 = instance._idToIndexMap.get(edge.edgeMate.id);
        this.addEdgeWithFaceTags(instance._voronoiGraph, bisector.start, bisector.end, faceTag0, faceTag1);
        return true;
      },
    );
    if (!isValidVoronoi)
      return undefined;
    box.addEdgesToGraph(instance._voronoiGraph);
    HalfEdgeGraphMerge.splitIntersectingEdges(instance._voronoiGraph, distanceTol);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(instance._voronoiGraph, undefined, distanceTol);
    instance.populateMasksAndFaceTags();
    return instance;
  }
  /**
   * Construct a Voronoi instance from a set of points.
   * @param points An array of points. Z-coordinates are ignored. Points can be colinear.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is [[Geometry.smallMetricDistance]].
   * @returns a new instance containing the Voronoi diagram derived from the input points, or `undefined` if invalid input.
   */
  public static createFromPoints(
    points: Point3d[], distanceTol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const sortedPoints = new SortedArray<Point3d>(Geometry.compareXY(distanceTol), DuplicatePolicy.Retain, Geometry.clonePoint3d());
    points.forEach((pt: Point3d) => sortedPoints.insert(pt));
    const uniquePoints = sortedPoints.extractArray();
    if (uniquePoints.length < 2)
      return undefined;
    if (PolylineOps.isColinear(uniquePoints, distanceTol, true)) {
      const colinearGraph = Voronoi.createColinearXYGraph(uniquePoints);
      return colinearGraph ? Voronoi.createFromColinearGraph(colinearGraph) : undefined;
    } else {
      const delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(uniquePoints, undefined, distanceTol);
      return delaunayGraph ? Voronoi.createFromDelaunayGraph(delaunayGraph) : undefined;
    }
  }
  /** Stroke each curve in the chain and associate each point with the index of its generating curve in the chain. */
  private static createStrokePointsWithIndices(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, distanceTol: number = Geometry.smallMetricDistance
  ): Dictionary<Point3d, number> | undefined {
    const children = curveChain.children;
    if (!children)
      return undefined;
    const numChildren = children.length;
    if (numChildren < 2)
      return undefined;
    const workPoint = Point3d.createZero();
    const workCircleXY = Arc3d.createUnitCircle(Voronoi._workArc);
    const workSegment0 = LineSegment3d.createXYXY(0, 0, 0, 0);
    const workSegment1 = LineSegment3d.createXYXY(0, 0, 0, 0);
    const pointToIndex = new Dictionary<Point3d, number>(Geometry.compareXY(distanceTol), Geometry.clonePoint3d());
    const strokeInteriorAndPush = (curve: CurvePrimitive, index: number): void => {
      const strokes = LineString3d.create();
      curve.emitStrokes(strokes, strokeOptions);
      for (let i = 1; i < strokes.numPoints() - 1; ++i) { // skip first and last point
        if (strokes.pointAt(i, workPoint))
          pointToIndex.insert(workPoint, index);
      }
    };
    const pushCircleIntersection = (circle: Arc3d, curve: CurvePrimitive, index: number, atStart: boolean) => {
      const intersections = CurveCurve.intersectionProjectedXYPairs(undefined, circle, false, curve, false);
      if (!intersections.length)
        return false;
      if (intersections.length > 1) { // detailB has the info for curve
        if (atStart)
          intersections.sort((a, b) => a.detailB.fraction - b.detailB.fraction); // first intersection is closest to child start
        else
          intersections.sort((a, b) => b.detailB.fraction - a.detailB.fraction); // first intersection is closest to child end
      }
      pointToIndex.insert(intersections[0].detailB.point, index);
      return true;
    };
    const addSymmetricPointOnAdjacentCurves = (curve0: CurvePrimitive, curve1: CurvePrimitive, index0: number, index1: number): boolean => {
      const length0 = curve0.curveLength();
      const length1 = curve1.curveLength();
      // HEURISTIC: hopefully radius is small enough to produce the last/first stroke point for curve0/1
      let radius = Math.min(length0, length1) / 100;
      if (strokeOptions && strokeOptions.maxEdgeLength && radius > strokeOptions.maxEdgeLength)
        radius = strokeOptions.maxEdgeLength / 2;
      curve1.startPoint(workCircleXY.center);
      workCircleXY.matrixRef.setAt(0, 0, radius);
      workCircleXY.matrixRef.setAt(1, 1, radius);
      return pushCircleIntersection(workCircleXY, curve0, index0, false) && pushCircleIntersection(workCircleXY, curve1, index1, true);
    }
    // Step 1: add open chain start/end point
    const isClosedChain = curveChain.isPhysicallyClosedCurve(distanceTol, true);
    if (!isClosedChain) {
      if (curveChain.startPoint(workPoint))
        pointToIndex.insert(workPoint, 0);
      if (curveChain.endPoint(workPoint))
        pointToIndex.insert(workPoint, numChildren - 1);
    }
    // Step 2: add interior stroke points for each chain primitive and linestring segment
    // * Do not add a stroke point at the chain joints and linestring vertices; otherwise they don't end up on Voronoi edges.
    for (let i = 0; i < numChildren; i++) {
      const child = children[i];
      if (child instanceof LineString3d) {
        for (let j = 0; j < child.numEdges(); j++) {
          if (child.getIndexedSegment(j, workSegment0))
            strokeInteriorAndPush(workSegment0, i); // each segment is associated to the linestring index
        }
      } else {
        strokeInteriorAndPush(child, i);
      }
    }
    // Step 3: add the stroke points nearest to each chain joint and linestring interior joint.
    // * These are required to be symmetric so that the joint lands exactly on a Voronoi diagram edge.
    // * We compute these stroke points by intersecting adjacent chain children with a common circle centered at the joint.
    // * A tiny radius is chosen at each joint to increase the odds that the intersections become the closest stroke points to the joint.
    for (let i = 0; i < numChildren; i++) {
      let child = children[i];
      if (child instanceof LineString3d) { // process open linestring interior joints (always open b/c numChildren > 1)
        for (let j = 1; j < child.numEdges(); j++) {
          if (child.getIndexedSegment(j - 1, workSegment0) && child.getIndexedSegment(j, workSegment1)) {
            if (!addSymmetricPointOnAdjacentCurves(workSegment0, workSegment1, i, i)) // associate to the linestring index
              return undefined;
          }
        }
      }
      if (i === 0 && !isClosedChain)
        continue; // no wrap-around joint to process
      const iPrev = Geometry.modulo(i - 1, numChildren);
      let prevChild = children[iPrev];
      if (prevChild instanceof LineString3d && prevChild.getIndexedSegment(prevChild.numEdges() - 1, workSegment0))
        prevChild = workSegment0; // use the last segment of the previous linestring
      if (child instanceof LineString3d && child.getIndexedSegment(0, workSegment1))
        child = workSegment1; // use the first segment of this linestring
      if (!addSymmetricPointOnAdjacentCurves(prevChild, child, iPrev, i))
        return undefined;
    }
    return pointToIndex;
  }
  /** Construct a graph from xy points. */
  private static createGraphFromPointsWithIndices(
    pointToIndex: Dictionary<Point3d, number>, distanceTol: number,
  ): { graph: HalfEdgeGraph, isTriangulation: boolean } | undefined {
    if (pointToIndex.size < 2)
      return undefined;
    let graph: HalfEdgeGraph | undefined;
    let isTriangulation = false;
    const workPoint = Point3d.createZero();
    const points = Array.from(pointToIndex.keys());
    if (PolylineOps.isColinear(points, distanceTol, true)) {
      graph = Voronoi.createColinearXYGraph(pointToIndex);
    } else if (graph = Triangulator.createTriangulatedGraphFromPoints(points, undefined, distanceTol)) {
      isTriangulation = true;
      let index: number | undefined;
      // decorate every edge of the Delaunay graph with the index associated to its start vertex
      graph.announceVertexLoops(
        (_g, vertex: HalfEdge): boolean => {
          if (vertex.getPoint3d(workPoint) && undefined !== (index = pointToIndex.get(workPoint)))
            vertex.announceEdgesAroundVertex((edge: HalfEdge) => { edge.edgeTag = index; });
          return true;
        }
      );
    }
    return graph ? { graph, isTriangulation } : undefined;
  }
  /**
   * Create a Voronoi instance from a curve chain.
   * * The cells of the resulting Voronoi diagram are the xy-plane regions of points closest to a [[CurvePrimitive]] of the chain.
   * @param curveChain A curve chain consisting of at least two [[CurvePrimitive]]s. Z-coordinates are ignored.
   * @param strokeOptions Optional stroke options to control the sampling of the curve chain.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is [[Geometry.smallMetricDistance]].
   * @returns a new instance, or `undefined` for invalid input.
   */
  public static createFromCurveChain(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, distanceTol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const pointsWithIndices = Voronoi.createStrokePointsWithIndices(curveChain, strokeOptions);
    if (!pointsWithIndices)
      return undefined; // no points created from the curve chain
    const result = Voronoi.createGraphFromPointsWithIndices(pointsWithIndices, distanceTol);
    if (!result)
      return undefined; // no graph created from points
    if (result.isTriangulation)
      return Voronoi.createFromDelaunayGraph(result.graph, distanceTol);
    return Voronoi.createFromColinearGraph(result.graph);
  }
  private findSuperFaceStart(superFaceEdgeMask: HalfEdgeMask): HalfEdge | undefined {
    let start: HalfEdge | undefined;
    this._voronoiGraph.announceEdges((_voronoi: HalfEdgeGraph, seed: HalfEdge) => {
      if (seed.isMaskSet(HalfEdgeMask.EXTERIOR) || seed.isMaskSet(superFaceEdgeMask))
        return true; // skip exterior faces or previously visited super face edges
      if (seed.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR) ||
        this._inputGraph.allHalfEdges[seed.faceTag].edgeTag !== this._inputGraph.allHalfEdges[seed.edgeMate.faceTag].edgeTag) {
        start = seed;
        return false;
      }
      return true;
    });
    return start;
  }
  private findSuperFace(start: HalfEdge, superFaceEdgeMask: HalfEdgeMask): HalfEdge[] {
    const superFace: HalfEdge[] = [];
    const childIndex = this._inputGraph.allHalfEdges[start.faceTag].edgeTag
    start.announceEdgesInSuperFace(
      (node: HalfEdge) => {
        if (node.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR) ||
          (this._inputGraph.allHalfEdges[node.faceTag].edgeTag === childIndex &&
            this._inputGraph.allHalfEdges[node.edgeMate.faceTag].edgeTag !== childIndex)) {
          return false;
        }
        return true;
      },
      (node: HalfEdge) => {
        superFace.push(node);
        node.setMask(superFaceEdgeMask);
      }
    );
    return superFace;
  }
  /** Sets super face masks to the voronoi diagram and returns the super faces. */
  public getSuperFaces(numChildren: number, superFaceEdgeMask: HalfEdgeMask): HalfEdge[][] | undefined {
    const superFaces: HalfEdge[][] = [];
    for (let i = 0; i < numChildren; i++) {
      const start = this.findSuperFaceStart(superFaceEdgeMask);
      if (!start)
        return undefined;
      superFaces.push(this.findSuperFace(start, superFaceEdgeMask));
    }
    superFaces.sort((a, b) => {
      const tagA = this._inputGraph.allHalfEdges[a[0].faceTag].edgeTag ?? 0;
      const tagB = this._inputGraph.allHalfEdges[b[0].faceTag].edgeTag ?? 0;
      return tagA - tagB;
    });

    return superFaces;
  }
  /** Modifies the voronoi graph such that each super face contains only convex faces. */
  public convexifySuperFaces(superFaceEdgeMask: HalfEdgeMask) {
    Triangulator.triangulateAllInteriorFaces(this._voronoiGraph);
    HalfEdgeGraphOps.expandConvexFaces(this._voronoiGraph, superFaceEdgeMask);
  }
  /** Generates clippers from super faces */
  public generateClippersFromSuperFaces(
    superFaces: HalfEdge[][], superFaceEdgeMask: HalfEdgeMask,
  ): (ConvexClipPlaneSet | UnionOfConvexClipPlaneSets)[] | undefined {
    const allClippers: (ConvexClipPlaneSet | UnionOfConvexClipPlaneSets)[] = [];
    const superFaceOutsideMask = this._voronoiGraph.grabMask();
    for (const superFace of superFaces) {
      superFace[0].announceEdgesInSuperFace(
        (node: HalfEdge) => !node.isMaskSet(superFaceEdgeMask),
        (node: HalfEdge) => node.edgeMate.setMask(superFaceOutsideMask),
      );
      this._voronoiGraph.clearMask(HalfEdgeMask.VISITED);
      const convexFacesInSuperFace: HalfEdge[] = [];
      HalfEdgeGraphSearch.exploreComponent(
        superFace[0], HalfEdgeMask.VISITED, superFaceOutsideMask, undefined, convexFacesInSuperFace,
      );
      superFace[0].announceEdgesInSuperFace(
        (node: HalfEdge) => !node.isMaskSet(superFaceEdgeMask),
        (node: HalfEdge) => node.edgeMate.clearMask(superFaceOutsideMask),
      );
      const clippersOfSuperFace: ConvexClipPlaneSet[] = [];
      for (const face of convexFacesInSuperFace) {
        const clipPlanesOfConvexFace: ClipPlane[] = [];
        let edge = face;
        let nextEdge = edge.faceSuccessor;
        do {
          if (edge.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE)) {
            edge = nextEdge;
            nextEdge = nextEdge.faceSuccessor;
            continue; // skip boundary edges
          }
          const edgeVector = Vector3d.createStartEnd(edge.getPoint3d(), nextEdge.getPoint3d());
          const normal = Vector3d.unitZ().crossProduct(edgeVector);
          const clipPlane = ClipPlane.createNormalAndPoint(normal, edge.getPoint3d());
          if (!clipPlane) {
            this._voronoiGraph.dropMask(superFaceOutsideMask);
            return undefined; // failed to create clip plane
          }
          clipPlanesOfConvexFace.push(clipPlane);
          edge = nextEdge;
          nextEdge = nextEdge.faceSuccessor;
        } while (edge !== face);
        const clipperOfConvexFace = ConvexClipPlaneSet.createPlanes(clipPlanesOfConvexFace);
        clippersOfSuperFace.push(clipperOfConvexFace);
      }
      if (clippersOfSuperFace.length === 1)
        allClippers.push(clippersOfSuperFace[0]);
      else
        allClippers.push(UnionOfConvexClipPlaneSets.createConvexSets(clippersOfSuperFace));
    }
    this._voronoiGraph.dropMask(superFaceOutsideMask);
    return allClippers;
  }
  /** Creates a Polyface from the Voronoi diagram super faces */
  public createPolyface(superFaceEdgeMask: HalfEdgeMask): IndexedPolyface {
    return PolyfaceBuilder.graphToPolyface(
      this._voronoiGraph,
      undefined,
      undefined,
      (node: HalfEdge) => {
        if (node.isMaskSet(superFaceEdgeMask)) {
          return true;
        }
        return false;
      }
    );
  }
}

/**
 * A class to represent a bounding box for a Voronoi diagram.
 * * A Voronoi diagram is unbounded, so we create a large rectangle around the diagram to limit it.
 * * This boundary is large enough to contain the circumcenters of the Delaunay triangles.
 */
class VoronoiBoundary {
  public bbox: Range2d;
  /**
   * Constructor that takes up to two ranges to union and expand by a margin.
   * * For example, Delaunay graph range and circumcenter range.
   */
  public constructor(r0: Range2d, r1?: Range2d) {
    this.bbox = r1 ? r0.union(r1) : r0.clone();
    if (!this.bbox.isNull && !this.bbox.isSinglePoint) {
      const pad = 0.025 * (this.bbox.xLength() + this.bbox.yLength()); // 5% of average side length
      this.bbox.expandInPlace(pad);
    }
  }
  /** Checks if a point is contained within the boundary. */
  public contains(point: XAndY): boolean {
    return this.contains(point);
  }
  /** Compute the intersection fractions of the ray and this boundary. */
  public intersect(ray: Ray2d): number[] | undefined {
    const fractionalRange = ray.intersectionWithRange2d(this.bbox);
    if (fractionalRange.isNull)
      return undefined;
    if (fractionalRange.isSinglePoint)
      return [fractionalRange.low];
    return [fractionalRange.low, fractionalRange.high];
  }
  /** Add edges of this boundary to the graph. */
  public addEdgesToGraph(graph: HalfEdgeGraph) {
    graph.addEdgeXY(this.bbox.low.x, this.bbox.low.y, this.bbox.high.x, this.bbox.low.y);
    graph.addEdgeXY(this.bbox.high.x, this.bbox.low.y, this.bbox.high.x, this.bbox.high.y);
    graph.addEdgeXY(this.bbox.high.x, this.bbox.high.y, this.bbox.low.x, this.bbox.high.y);
    graph.addEdgeXY(this.bbox.low.x, this.bbox.high.y, this.bbox.low.x, this.bbox.low.y);
  }
}
