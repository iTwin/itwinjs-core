/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { Dictionary, DuplicatePolicy, SortedArray } from "@itwin/core-bentley";
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
import { Range3d } from "../geometry3d/Range";
import { XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { SmallSystem } from "../numerics/SmallSystem";
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
  private _inputGraph: Readonly<HalfEdgeGraph>; // either Delaunay or colinear
  private _inputGraphIsTriangulation;
  private _inputGraphRange: Range3d;
  private _idToIndexMap: Map<number, number>;
  private _circumcenterMap: Map<number, Point3d>;
  private _circumcenterRange: Range3d;
  // Construct an empty Voronoi diagram and minimally validate input (use `isValid` to check)
  private constructor(inputGraph: Readonly<HalfEdgeGraph>, isColinear = false) {
    this._voronoiGraph = new HalfEdgeGraph();
    this._inputGraph = inputGraph;
    this._inputGraphIsTriangulation = false;
    this._inputGraphRange = HalfEdgeGraphOps.graphRange(inputGraph);
    this._idToIndexMap = this.populateIdToIndexMap();
    this._circumcenterMap = new Map<number, Point3d>();
    if (!isColinear)
      this._inputGraphIsTriangulation = this.populateCircumcenters(this._circumcenterMap);
    this._circumcenterRange = Range3d.create(...Array.from(this._circumcenterMap.values()));
  }
  public get getVoronoiGraph(): HalfEdgeGraph {
    return this._voronoiGraph;
  }
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
  // return the smallest HalfEdge id in the (triangular) face
  private getTriangleId(face: HalfEdge): number {
    return Math.min(face.id, face.faceSuccessor.id, face.faceSuccessor.faceSuccessor.id);
  }
  // populate a mapping from a Delaunay triangle's id to its circumcircle
  private populateCircumcenters(circumcenterMap: Map<number, Point3d>): boolean {
    circumcenterMap.clear();
    let isValid = true;
    const p0 = Point3d.createZero();
    const p1 = Point3d.createZero();
    const p2 = Point3d.createZero();
    this._inputGraph.announceFaceLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        if (seed.isMaskSet(HalfEdgeMask.EXTERIOR))
          return true; // skip exterior faces
        if (seed.countEdgesAroundFace() !== 3)
          return isValid = false;
        // find circumcenter of the triangle formed by this face
        seed.getPoint3d(p0);
        seed.faceSuccessor.getPoint3d(p1);
        seed.faceSuccessor.faceSuccessor.getPoint3d(p2);
        p0.z = p1.z = p2.z = 0;
        const circumcircle = Arc3d.createCircularStartMiddleEnd(p0, p1, p2);
        if (circumcircle instanceof LineString3d)
          return isValid = false;
        const circumcenter = circumcircle.center
        const triangleId = this.getTriangleId(seed);
        circumcenterMap.set(triangleId, circumcenter);
        return true;
      },
    );
    if (!isValid)
      circumcenterMap.clear();
    return isValid;
  }
  // create a map from a Delaunay HalfEdge's id to the smallest index of the HalfEdges in its vertex loop
  private populateIdToIndexMap(): Map<number, number> {
    const idToIndexMap = new Map<number, number>();
    this._inputGraph.allHalfEdges.forEach((node, index) => {
      idToIndexMap.set(node.id, index);
    });
    this._inputGraph.announceVertexLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const nodesAroundVertex = seed.collectAroundVertex();
        let minIndex = Number.MAX_SAFE_INTEGER;
        for (const node of nodesAroundVertex) {
          const index = idToIndexMap.get(node.id);
          if (index !== undefined) { // always defined
            if (index < minIndex)
              minIndex = index;
          }
        }
        for (const node of nodesAroundVertex)
          idToIndexMap.set(node.id, minIndex);
        return true;
      },
    );
    return idToIndexMap;
  }
  // generate bisector of each edge in the Delaunay triangulation and limit it to the voronoi boundary
  private getBisector(
    vertex: HalfEdge, circumcenter: Point3d, voronoiBoundary: VoronoiBoundary,
  ): Segment2d | undefined {
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
    const bisector: Segment2d = { start: bisectorStart, end: bisectorEnd };
    const intersection = voronoiBoundary.intersect(bisector);
    if (!intersection || intersection.length === 0)
      return undefined; // bisector is outside the voronoi boundary for skinny triangles; skip it
    if (voronoiBoundary.contains(circumcenter))
      return { start: bisectorStart, end: intersection[0] }; // bisector is inside the voronoi boundary
    else
      return { start: intersection[0], end: intersection[1] }; // bisector is outside the voronoi boundary
  }
  private handleBoundaryEdge(
    seed: HalfEdge,
    voronoiBoundary: VoronoiBoundary,
    seedIsExterior: boolean,
  ): boolean {
    let vertex = seed;
    if (seedIsExterior)
      vertex = seed.edgeMate;
    const triangleId = this.getTriangleId(vertex);
    const circumcenter = this._circumcenterMap.get(triangleId);
    if (!circumcenter)
      return false; // no circumcenter found for the face containing this edge
    const bisector = this.getBisector(vertex, circumcenter, voronoiBoundary);
    if (!bisector)
      return true; // bisector is outside the voronoi boundary for skinny triangles; skip it
    this._voronoiGraph.addEdgeXY(
      bisector.start.x, bisector.start.y,
      bisector.end.x, bisector.end.y,
      this._idToIndexMap.get(vertex.edgeMate.id), this._idToIndexMap.get(vertex.id),
    );
    return true;
  }
  private handleInteriorEdge(
    seed: HalfEdge,
    voronoiBoundary: VoronoiBoundary,
    tol: number,
  ): boolean {
    const triangleId0 = this.getTriangleId(seed);
    const triangleId1 = this.getTriangleId(seed.edgeMate);
    const circumcenter0 = this._circumcenterMap.get(triangleId0);
    const circumcenter1 = this._circumcenterMap.get(triangleId1);
    if (!circumcenter0 || !circumcenter1)
      return false; // no circumcenter found for the face containing this edge
    if (circumcenter0.isAlmostEqual(circumcenter1, tol))
      return true; // circumcenters are the same, skip this edge
    const center0IsInsideVoronoiBoundary = voronoiBoundary.contains(circumcenter0);
    const center1IsInsideVoronoiBoundary = voronoiBoundary.contains(circumcenter1);
    const line: Segment2d = { start: circumcenter0, end: circumcenter1 }; // line segment between circumcenters
    const intersection = voronoiBoundary.intersect(line);
    if (intersection && intersection.length > 0) { // line intersects the voronoi boundary
      let limitedLine: Segment2d;
      if (!center0IsInsideVoronoiBoundary && !center1IsInsideVoronoiBoundary) {
        limitedLine = { start: intersection[0], end: intersection[1] }; // limit line to the voronoi boundary
      } else {
        const center = center0IsInsideVoronoiBoundary ? circumcenter0 : circumcenter1;
        limitedLine = { start: intersection[0], end: center }; // limit line to the voronoi boundary
      }
      this._voronoiGraph.addEdgeXY(
        limitedLine.start.x, limitedLine.start.y,
        limitedLine.end.x, limitedLine.end.y,
        this._idToIndexMap.get(seed.edgeMate.id), this._idToIndexMap.get(seed.id),
      );
    } else {
      if (!center0IsInsideVoronoiBoundary && !center1IsInsideVoronoiBoundary)
        return true; // both circumcenters are outside the voronoi boundary and line does not intersect the boundary; skip this edge
      this._voronoiGraph.addEdgeXY(
        line.start.x, line.start.y,
        line.end.x, line.end.y,
        this._idToIndexMap.get(seed.edgeMate.id), this._idToIndexMap.get(seed.id),
      );
    }
    return true;
  }
  private addVoronoiBoundary(voronoiBoundary: VoronoiBoundary) {
    this._voronoiGraph.addEdgeXY(
      voronoiBoundary.p0.x, voronoiBoundary.p0.y, voronoiBoundary.p1.x, voronoiBoundary.p1.y,
    );
    this._voronoiGraph.addEdgeXY(
      voronoiBoundary.p1.x, voronoiBoundary.p1.y, voronoiBoundary.p2.x, voronoiBoundary.p2.y,
    );
    this._voronoiGraph.addEdgeXY(
      voronoiBoundary.p2.x, voronoiBoundary.p2.y, voronoiBoundary.p3.x, voronoiBoundary.p3.y,
    );
    this._voronoiGraph.addEdgeXY(
      voronoiBoundary.p3.x, voronoiBoundary.p3.y, voronoiBoundary.p0.x, voronoiBoundary.p0.y,
    );
  }
  // populate EXTERIOR and BOUNDARY_EDGE masks and remaining face tags
  private populateMasksAndFaceTags(): void {
    this._voronoiGraph.announceFaceLoops(
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
   *    * the boundary and exterior edges should be masked with `HalfEdgeMask.BOUNDARY_EDGE` and `HalfEdgeMask.EXTERIOR`, respectively,
   *    * the graph boundary should be convex.
   * @param delaunayGraph A HalfEdgeGraph representing a Delaunay triangulated graph; xy-only (z-coordinate is ignored).
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid. Each voronoi face
   * corresponds to a vertex in the input graph and we store the index of the vertex (in graph.allHalfEdges) in the
   * edgeTag of all nodes in that voronoi face.
   */
  public static createFromDelaunayGraph(
    delaunayGraph: HalfEdgeGraph, tol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const voronoi = new Voronoi(delaunayGraph);
    if (!voronoi.isValid)
      return undefined;
    let isValidVoronoi = true;
    const voronoiBoundary = new VoronoiBoundary(voronoi._inputGraphRange, voronoi._circumcenterRange);
    // go over all edges in the Delaunay graph and add bisectors for boundary edges
    // and add line between circumcenters for interior edges
    // if a circumcenter is outside the voronoi boundary, limit the bisector or line to the voronoi boundary
    voronoi._inputGraph.announceEdges(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const seedIsExterior = seed.isMaskSet(HalfEdgeMask.EXTERIOR);
        const seedIsBoundary = seed.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE);
        if (seedIsExterior || seedIsBoundary) {
          isValidVoronoi = voronoi.handleBoundaryEdge(
            seed, voronoiBoundary, seedIsExterior,
          );
          return isValidVoronoi;
        } else {
          isValidVoronoi = voronoi.handleInteriorEdge(seed, voronoiBoundary, tol);
          return isValidVoronoi;
        }
      },
    );
    if (!isValidVoronoi)
      return undefined;
    voronoi.addVoronoiBoundary(voronoiBoundary);
    HalfEdgeGraphMerge.splitIntersectingEdges(voronoi._voronoiGraph);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoi._voronoiGraph);
    voronoi.populateMasksAndFaceTags();
    return voronoi;
  }
  // create a graph for the colinear points; optional Dictionary supplies edgeTag (value) for the HalfEdges at each vertex (key)
  private static createColinearXYGraph(points: XAndY[] | Dictionary<Point3d, number>): HalfEdgeGraph {
    const colinearGraph = new HalfEdgeGraph();
    let indices: number[] | undefined;
    if (!Array.isArray(points)) {
      indices = Array.from(points.values());
      points = Array.from(points.keys());
    }
    if (points.length < 2)
      return colinearGraph; // empty
    const addSegmentWithEdgeTags = (p0: XAndY, p1: XAndY, i0: number, i1: number): HalfEdge => {
      const newEdge = colinearGraph.addEdgeXY(p0.x, p0.y, p1.x, p1.y);
      newEdge.edgeTag = i0;
      newEdge.edgeMate.edgeTag = i1;
      return newEdge;
    }
    let prevNode = addSegmentWithEdgeTags(points[0], points[1], indices ? indices[0] : 0, indices ? indices[1] : 0,)
    for (let i = 1; i < points.length - 1; i++) {
      const nextNode = addSegmentWithEdgeTags(points[i], points[i + 1], indices ? indices[i] : 0, indices ? indices[i + 1] : 0);
      HalfEdge.pinch(prevNode.faceSuccessor, nextNode);
      prevNode = nextNode;
    }
    colinearGraph.setMask(HalfEdgeMask.EXTERIOR);
    return colinearGraph;
  }
  // find the bisector of a line segment defined by two points p0 and p1 and limit it to the voronoi boundary
  private static getLineBisector(p0: Point3d, p1: Point3d, voronoiBoundary: VoronoiBoundary): Segment2d | undefined {
    p0.z = p1.z = 0; // ignore z-coordinate
    const midPoint = Point3d.createAdd2Scaled(p0, 0.5, p1, 0.5);
    const perp = Vector3d.create(p0.y - p1.y, p1.x - p0.x);
    const scale = 10000;
    const bisectorStart = Point3d.createAdd2Scaled(midPoint, 1, perp, -scale);
    const bisectorEnd = Point3d.createAdd2Scaled(midPoint, 1, perp, scale);
    const bisector: Segment2d = { start: bisectorStart, end: bisectorEnd };
    const intersections = voronoiBoundary.intersect(bisector);
    if (!intersections || intersections.length <= 1)
      return undefined;
    // remove duplicate intersections
    const uniqueIntersections = Array.from(new Set(intersections.map(p => `${p.x},${p.y}`)))
      .map(p => p.split(',').map(Number))
      .map(p => Point3d.create(p[0], p[1]));
    return { start: uniqueIntersections[0], end: uniqueIntersections[1] }; // limit bisector to the voronoi boundary
  }
  // create a Voronoi diagram for a (non-Delaunay) graph with colinear points
  private static createFromColinearGraph(colinearGraph: HalfEdgeGraph): Voronoi | undefined {
    const voronoi = new Voronoi(colinearGraph, true);
    if (!voronoi.isValid)
      return undefined;
    const voronoiBoundary = new VoronoiBoundary(voronoi._inputGraphRange, voronoi._circumcenterRange);
    let isValidVoronoi = true;
    colinearGraph.announceEdges(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const bisector = Voronoi.getLineBisector(seed.getPoint3d(), seed.edgeMate.getPoint3d(), voronoiBoundary);
        if (!bisector) {
          isValidVoronoi = false;
          return false;
        }
        voronoi._voronoiGraph.addEdgeXY(
          bisector.start.x, bisector.start.y,
          bisector.end.x, bisector.end.y,
          voronoi._idToIndexMap.get(seed.id), voronoi._idToIndexMap.get(seed.edgeMate.id),
        );
        return true;
      },
    );
    if (!isValidVoronoi)
      return undefined;
    voronoi.addVoronoiBoundary(voronoiBoundary);
    HalfEdgeGraphMerge.splitIntersectingEdges(voronoi._voronoiGraph);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoi._voronoiGraph);
    voronoi.populateMasksAndFaceTags();
    return voronoi;
  }
  /**
   * Creates a Voronoi diagram from a set of points.
   * @param points An array of points; xy-only (z-coordinate is ignored). Points can be colinear.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is Geometry.smallMetricDistance.
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid.
   */
  public static createFromPoints(
    points: Point3d[], distanceTol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const sortedPoints = new SortedArray<Point3d>(Geometry.compareXYZ(distanceTol, true), DuplicatePolicy.Retain, Geometry.clonePoint3d());
    points.forEach((pt: Point3d) => sortedPoints.insert(pt));
    const uniquePoints = sortedPoints.extractArray();
    if (uniquePoints.length < 2)
      return undefined;
    if (PolylineOps.isColinear(uniquePoints, distanceTol, true)) {
      const colinearGraph = Voronoi.createColinearXYGraph(uniquePoints);
      return colinearGraph ? Voronoi.createFromColinearGraph(colinearGraph) : undefined;
    } else {
      const delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(uniquePoints);
      return delaunayGraph ? Voronoi.createFromDelaunayGraph(delaunayGraph) : undefined;
    }
  }
  // stroke child curve from start and end to get sample points; skip the first and last points on the child curve
  private static pushPointsWithIndices(
    child: CurvePrimitive, childIndex: number, pointsWithIndices: Dictionary<Point3d, number>, strokeOptions?: StrokeOptions,
  ): boolean {
    // split curve in half to get symmetric 2nd/penultimate points
    const halfChild0 = child.clonePartialCurve(0, 0.5);
    const halfChild1 = child.clonePartialCurve(1, 0.5); // reversed
    if (halfChild0 === undefined || halfChild1 === undefined)
      return false;
    const segment = LineString3d.create();
    const pt = Point3d.createZero();
    halfChild0.emitStrokes(segment, strokeOptions);
    for (let i = 1; i < segment.numPoints(); ++i) { // skip start point
      if (segment.pointAt(i, pt))
        pointsWithIndices.insert(pt, childIndex);
    }
    segment.clear();
    halfChild1.emitStrokes(segment, strokeOptions);
    for (let i = 1; i < segment.numPoints(); ++i) { // skip end point
      if (segment.pointAt(i, pt))
        pointsWithIndices.insert(pt, childIndex);
    }
    return true;
  }
  // create stroke points from the curve chain and add curve child indices to the points
  private static createStrokePointsWithIndices(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, distanceTolerance: number = Geometry.smallMetricDistance
  ): Dictionary<Point3d, number> | undefined {
    const children = curveChain.children;
    if (!children)
      return undefined;
    const numChildren = children.length;
    if (children.length < 2)
      return undefined;
    const startPoint = curveChain.startPoint();
    const endPoint = curveChain.endPoint();
    const skipChainStartEnd = !startPoint || !endPoint || curveChain.isPhysicallyClosedCurve(distanceTolerance, true);
    // use a tolerance since midpoint of each child may be added twice by pushPointsWithIndices
    const pointToIndex = new Dictionary<Point3d, number>(Geometry.compareXYZ(distanceTolerance, true), Geometry.clonePoint3d());
    const segment = LineSegment3d.createXYXY(0, 0, 0, 0);
    if (!skipChainStartEnd)
      pointToIndex.insert(startPoint, 0);
    for (let i = 0; i < numChildren; i++) {
      const child = children[i];
      if (child instanceof LineString3d) {
        if (child.numPoints() < 2)
          continue;
        for (let j = 0; j < child.numEdges(); j++) {
          child.getIndexedSegment(j, segment);
          if (!Voronoi.pushPointsWithIndices(segment, i, pointToIndex, strokeOptions))
            return undefined;
        }
      } else {
        if (!Voronoi.pushPointsWithIndices(child, i, pointToIndex, strokeOptions))
          return undefined;
      }
    }
    if (!skipChainStartEnd)
      pointToIndex.insert(endPoint, numChildren - 1);
    const addIntersectionPoint = (circle: Arc3d, childIndex: number, atStart: boolean) => {
      const intersections = CurveCurve.intersectionProjectedXYPairs(undefined, children[childIndex], false, circle, false);
      if (intersections.length === 0)
        return false;
      if (intersections.length > 1) {
        if (atStart)
          intersections.sort((a, b) => a.detailA.fraction - b.detailA.fraction); // first intersection is closest to child start
        else
          intersections.sort((a, b) => b.detailA.fraction - a.detailA.fraction); // first intersection is closest to child end
      }
      pointToIndex.insert(intersections[0].detailA.point, childIndex);
      return true;
    };
    // the closest stroke points on adjacent children should be equidistant from their join point
    for (let k = 1; k < numChildren; k++) {
      const length0 = children[k - 1].curveLength();
      const length1 = children[k].curveLength();
      let radius = Math.min(length0, length1) / 100; // HEURISTIC
      if (strokeOptions && strokeOptions.maxEdgeLength && radius > strokeOptions.maxEdgeLength)
        radius = strokeOptions.maxEdgeLength / 2;
      const circle = Arc3d.createCenterNormalRadius(children[k].startPoint(), Vector3d.create(0, 0, 1), radius);
      if (!addIntersectionPoint(circle, k - 1, false))
        return undefined;
      if (!addIntersectionPoint(circle, k, true))
        return undefined;
    }
    return pointToIndex;
  }
  private static createGraphFromPointsWithIndices(
    pointToIndex: Dictionary<Point3d, number>, distanceTol: number,
  ): {graph: HalfEdgeGraph, isDelaunay: boolean} | undefined {
    if (pointToIndex.size < 2)
      return undefined;
    let graph: HalfEdgeGraph | undefined;
    let isDelaunay = false;
    const point = Point3d.createZero();
    const points = Array.from(pointToIndex.keys());
    if (PolylineOps.isColinear(points, distanceTol, true)) {
      graph = Voronoi.createColinearXYGraph(pointToIndex);
    } else if (graph = Triangulator.createTriangulatedGraphFromPoints(points)) {
      isDelaunay = true;
      let index: number | undefined;
      // decorate every edge of the Delaunay graph with the index associated to its start vertex
      graph.announceVertexLoops(
        (_g, vertex: HalfEdge): boolean => {
          if (vertex.getPoint3d(point) && undefined !== (index = pointToIndex.get(point)))
            vertex.announceEdgesAroundVertex((edge: HalfEdge) => { edge.edgeTag = index; });
          return true;
        }
      );
    }
    return graph ? {graph, isDelaunay} : undefined;
  }
  /**
   * Creates clippers for regions closest to the children of a curve chain.
   * @param curveChain A curve chain; xy-only (z-coordinate is ignored). Must have at least 2 children.
   * @param strokeOptions Optional stroke options to control the sampling of the curve chain.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is [[Geometry.smallMetricDistance]].
   * @returns An array of UnionOfConvexClipPlaneSets where each member representing a union of convex regions closest to
   * the children of a curve chain, or undefined if the input is invalid.
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
    if (result.isDelaunay)
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
 * A class to represent the boundary for a Voronoi diagram.
 * * Voronoi diagram is unbounded, so we create a large rectangle around the diagram to limit it. The rectangle is
 * large enough to contain the circumcenters of the Delaunay triangles.
 */
class VoronoiBoundary {
  /** Bottom-left corner of the boundary. */
  public p0: XAndY;
  /** Bottom-right corner of the boundary. */
  public p1: XAndY;
  /** Top-right corner of the boundary. */
  public p2: XAndY;
  /** Top-left corner of the boundary. */
  public p3: XAndY;
  /**
   * Constructor
   * @param delaunayGraphRange Range of the HalfEdgeGraph representing a Delaunay triangulated graph; xy-only (z-coordinate is ignored).
   * @param circumcenterRange Range of the circumcenters of the triangles in the Delaunay triangulation.
   */
  constructor(delaunayGraphRange: Range3d, circumcenterRange: Range3d) {
    const minPadding = 2;  // smallest padding
    const maxPadding = 10; // do not let padding grow too large
    const ratio = 0.05;    // 5% relative padding
    const padX = Math.min(Math.max(delaunayGraphRange.xLength() * ratio, minPadding), maxPadding) + circumcenterRange.xLength();
    const padY = Math.min(Math.max(delaunayGraphRange.yLength() * ratio, minPadding), maxPadding) + circumcenterRange.yLength();
    this.p0 = Point2d.create(delaunayGraphRange.low.x - padX, delaunayGraphRange.low.y - padY);
    this.p1 = Point2d.create(delaunayGraphRange.high.x + padX, delaunayGraphRange.low.y - padY);
    this.p2 = Point2d.create(delaunayGraphRange.high.x + padX, delaunayGraphRange.high.y + padY);
    this.p3 = Point2d.create(delaunayGraphRange.low.x - padX, delaunayGraphRange.high.y + padY);
  }
  /** Checks if a point is contained within the boundary. */
  public contains(point: XAndY): boolean {
    return this.p0.x <= point.x && point.x <= this.p1.x &&
      this.p1.y <= point.y && point.y <= this.p2.y;
  }
  /** Checks if the line intersects the boundary and returns the intersections. */
  public intersect(line: Segment2d): Point3d[] {
    const intersections: Point3d[] = [];
    const fractions: Vector2d = Vector2d.createZero();
    for (const pair of [[this.p0, this.p1], [this.p1, this.p2], [this.p2, this.p3], [this.p3, this.p0]]) {
      const intersectionFound = SmallSystem.lineSegment2dXYTransverseIntersectionUnbounded(
        line.start, line.end, pair[0], pair[1], fractions,
      );
      if (!intersectionFound)
        continue;
      const lineFraction = fractions.x;
      const pairFraction = fractions.y;
      if (lineFraction >= 0 && lineFraction <= 1 && pairFraction >= 0 && pairFraction <= 1) {
        const direction = Vector2d.createStartEnd(line.start, line.end);
        const a = { x: line.start.x, y: line.start.y, z: 0 };
        const b = { x: direction.x, y: direction.y, z: 0 };
        intersections.push(Point3d.createAdd2Scaled(a, 1, b, lineFraction));
      }
    }
    return intersections;
  }
}
