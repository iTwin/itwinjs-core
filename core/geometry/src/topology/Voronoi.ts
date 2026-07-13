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
import { CurveOps } from "../curve/CurveOps";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { PolylineOps } from "../geometry3d/PolylineOps";
import { Range2d } from "../geometry3d/Range";
import { Ray2d } from "../geometry3d/Ray2d";
import { Ray3d } from "../geometry3d/Ray3d";
import { LowAndHighXY, XAndY } from "../geometry3d/XYZProps";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgeGraphSearch } from "./HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge, HalfEdgeGraphOps } from "./Merging";
import { Triangulator } from "./Triangulation";

/**
 * A class to represent a Voronoi diagram in the xy-plane.
 * * A Voronoi diagram is a partitioning of the plane into regions of points closest to a given generating point or curve.
 * * It is constructed from the circumcenters of its dual Delaunay triangulation.
 * * Static construction methods take Delaunay, points, and CurveChain input.
 * * More info can be found here: https://en.wikipedia.org/wiki/Voronoi_diagram and
 * https://en.wikipedia.org/wiki/Delaunay_triangulation
 * @internal
 */
export class Voronoi {
  private _voronoiGraph: HalfEdgeGraph;
  private _inputGraph: HalfEdgeGraph;
  private _inputGraphIsTriangulation;
  private _inputGraphRange: Range2d;
  private _idToIndexMap: Map<number, number>;
  private _circumcenterMap: Map<number, XAndY>;
  private _circumcenterRange: Range2d;
  private _isCurveBased: boolean;
  private _superFaceMask: HalfEdgeMask;
  private static _workXY0 = Point2d.createZero();
  private static _workXY1 = Point2d.createZero();
  private static _workRay = Ray2d.createZero();
  private static _workArc = Arc3d.createUnitCircle();
  /** Construct an empty Voronoi graph and minimally validate input (use [[isValid]] to check). */
  private constructor(inputGraph: HalfEdgeGraph, isColinear = false) {
    this._voronoiGraph = new HalfEdgeGraph();
    this._inputGraph = inputGraph;
    this._inputGraphRange = HalfEdgeGraphOps.graphRangeXY(inputGraph);
    this._idToIndexMap = inputGraph.constructIdToVertexIndexMap();
    this._circumcenterMap = new Map<number, XAndY>();
    this._inputGraphIsTriangulation = isColinear ? false : this.populateCircumcenters(this._circumcenterMap);
    this._circumcenterRange = Range2d.createArray(Array.from(this._circumcenterMap.values()));
    this._isCurveBased = false;
    this._superFaceMask = HalfEdgeMask.NULL_MASK;
  }
  /**
   * Accessor for the graph passed into the private constructor.
   * * It is either a triangulation (assumed Delaunay) or a graph with no interior faces (assumed colinear path).
   */
  public get getInputGraph(): HalfEdgeGraph {
    return this._inputGraph;
  }
  /** Accessor for the input graph's range */
  public get getInputGraphRange(): Range2d {
    return this._inputGraphRange;
  }
  /**
   * Accessor for the Voronoi graph constructed from the input graph.
   * * The Voronoi graph is typically constructed by static createFromXXX methods.
   */
  public get getVoronoiGraph(): HalfEdgeGraph {
    return this._voronoiGraph;
  }
  /** Whether or not this instance represents a curve-based Voronoi diagram. */
  public get isCurveBased(): boolean {
    return this._isCurveBased;
  }
  /** Accessor for the super face mask used for constructing a curve-based Voronoi diagram. */
  public get getSuperFaceMask(): HalfEdgeMask {
    return this._superFaceMask;
  }
  /** Whether the constructor has created a minimally valid instance. */
  protected get isValid(): boolean {
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
        face.getPoint3d(p0);
        face.faceSuccessor.getPoint3d(p1);
        face.facePredecessor.getPoint3d(p2);
        p0.z = p1.z = p2.z = 0;
        const circumcircle = Arc3d.createCircularStartMiddleEnd(p0, p1, p2, Voronoi._workArc);
        if (circumcircle instanceof Arc3d) // ignore a degenerate triangle
          circumcenterMap.set(this.getTriangleId(face), circumcircle.center); // getter clones center
        return true;
      },
    );
    if (!isValid)
      circumcenterMap.clear();
    return isValid;
  }
  /**
   * Return a segment along the bisector of the given triangle edge with the following properties:
   * * start point is the triangle's circumcenter
   * * end point is on the Voronoi boundary
   * * direction vector has positive dot product with the vector from triangle centroid to edge midpoint
   * @returns bisector segment, or undefined if the triangle circumcenter lies outside the Voronoi boundary
   */
  private getTriangleEdgeBisector(edge: HalfEdge, circumcenter: XAndY, box: VoronoiBoundary): Voronoi.Segment2d | undefined {
    const v0 = edge;
    const v1 = edge.faceSuccessor;
    const v2 = edge.facePredecessor;
    const oneThird = 1.0 / 3.0;
    const midPoint = Point2d.createAdd2ScaledXY(v0.x, v0.y, 0.5, v1.x, v1.y, 0.5);
    const centroid = Point2d.createAdd3ScaledXY(v0.x, v0.y, oneThird, v1.x, v1.y, oneThird, v2.x, v2.y, oneThird);
    const direction = Vector2d.createStartEnd(circumcenter, midPoint);
    if (midPoint.dotVectorsToTargets(circumcenter, centroid) < 0)
      direction.negate(direction); // ensure direction points away from triangle
    const bisector = Ray2d.createOriginAndDirectionCapture(Point2d.createFrom(circumcenter), direction, Voronoi._workRay);
    const fractions = box.intersect(bisector);
    const haveTwoIntersections = undefined !== fractions && fractions.length === 2;
    if (!haveTwoIntersections || (fractions[0] <= 0 && fractions[1] <= 0) || (fractions[0] >= 1 && fractions[1] >= 1))
      return undefined; // bisector ray lies outside box
    const start = bisector.fractionToPoint(Geometry.clamp(fractions[0], 0, 1), Voronoi._workXY0);
    const end = bisector.fractionToPoint(fractions[1], Voronoi._workXY1);
    return {start, end};
  }
  /** Add the edge of an unbounded Voronoi region that corresponds to a Delaunay boundary edge; clip it at the boundary. */
  private addVoronoiEdgeForDelaunayBoundaryEdge(edge: HalfEdge, box: VoronoiBoundary): boolean {
    const triangleId = this.getTriangleId(edge);
    if (triangleId < 0)
      return false; // invalid graph (not a triangulation)
    const circumcenter = this._circumcenterMap.get(triangleId);
    if (!circumcenter)
      return true; // skip Delaunay edge (degenerate boundary triangle)
    const bisector = this.getTriangleEdgeBisector(edge, circumcenter, box);
    if (!bisector)
      return true; // skip Delaunay edge (bisector ray outside box)
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
    if (!circumcenter0 && !circumcenter1)
      return true; // skip Delaunay edge between degenerate triangles
    if (!circumcenter0 || !circumcenter1) {
      // only one triangle is degenerate; if it is a boundary triangle, treat the opposite edge as a boundary
      if (!circumcenter0 && edge.findMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE))
        return this.addVoronoiEdgeForDelaunayBoundaryEdge(edge.edgeMate, box);
      if (!circumcenter1 && edge.edgeMate.findMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE))
        return this.addVoronoiEdgeForDelaunayBoundaryEdge(edge, box);
      return false; // invalid graph (interior degenerate triangle)
    }
    if (XAndY.almostEqual(circumcenter0, circumcenter1, distanceTol))
      return true; // skip trivial Voronoi edge (it will collapse during clustering)
    const segment = Ray2d.createOriginAndTarget(circumcenter0, circumcenter1, Voronoi._workRay);
    const fractions = box.intersect(segment);
    const haveTwoIntersections = undefined !== fractions && fractions.length === 2;
    if (!haveTwoIntersections || (fractions[0] <= 0 && fractions[1] <= 0) || (fractions[0] >= 1 && fractions[1] >= 1))
      return true; // skip Delaunay edge whose Voronoi segment is outside box
    const pt0 = segment.fractionToPoint(Geometry.clamp(fractions[0], 0, 1), Voronoi._workXY0);
    const pt1 = segment.fractionToPoint(Geometry.clamp(fractions[1], 0, 1), Voronoi._workXY1);
    const faceTag0 = this._idToIndexMap.get(edge.edgeMate.id);
    const faceTag1 = this._idToIndexMap.get(edge.id);
    Voronoi.addEdgeWithFaceTags(this._voronoiGraph, pt0, pt1, faceTag0, faceTag1);
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
   * @param boundingBox Optional nominal xy-bounding box for the Voronoi diagram. Default uses the Delaunay circumcenter range so
   * that interior Voronoi regions are maximal.
   * @returns a new instance containing the Voronoi diagram derived from the input graph, or `undefined` if invalid input.
   */
  public static createFromDelaunayGraph(
    delaunayGraph: HalfEdgeGraph,
    distanceTol: number = Geometry.smallMetricDistance,
    boundingBox?: LowAndHighXY,
  ): Voronoi | undefined {
    const instance = new Voronoi(delaunayGraph);
    if (!instance.isValid)
      return undefined;
    let isValidVoronoi = true;
    const box = new VoronoiBoundary(instance._inputGraphRange, boundingBox ? boundingBox : instance._circumcenterRange);
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
  private static getEdgeBisector(edge: HalfEdge, box: VoronoiBoundary): Voronoi.Segment2d | undefined {
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
    boundingBox?: LowAndHighXY,
  ): Voronoi | undefined {
    const instance = new Voronoi(colinearGraph, true);
    if (!instance.isValid)
      return undefined;
    let isValidVoronoi = true;
    const box = new VoronoiBoundary(instance._inputGraphRange, boundingBox);
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
   * @param boundingBox Optional nominal xy-bounding box for the Voronoi diagram. If unspecified, interior Voronoi cells are maximal.
   * @returns a new instance containing the Voronoi diagram derived from the input points, or `undefined` if invalid input.
   */
  public static createFromPoints(
    points: Point3d[],
    distanceTol: number = Geometry.smallMetricDistance,
    boundingBox?: LowAndHighXY,
  ): Voronoi | undefined {
    const sortedPoints = new SortedArray<Point3d>(Geometry.compareXY(distanceTol), DuplicatePolicy.Retain, (p: Point3d) => p.clone());
    points.forEach((pt: Point3d) => sortedPoints.insert(pt));
    const uniquePoints = sortedPoints.extractArray();
    if (uniquePoints.length < 2)
      return undefined;
    if (PolylineOps.isColinear(uniquePoints, distanceTol, true)) {
      const colinearGraph = Voronoi.createColinearXYGraph(uniquePoints);
      return colinearGraph ? Voronoi.createFromColinearGraph(colinearGraph, distanceTol, boundingBox) : undefined;
    } else {
      const delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(uniquePoints, undefined, distanceTol);
      return delaunayGraph ? Voronoi.createFromDelaunayGraph(delaunayGraph, distanceTol, boundingBox) : undefined;
    }
  }
  /** Stroke the curve interior, and associate the stroke points to the given index. Return first and last point. */
  private static pushInteriorStrokePoints(pointToIndex: Dictionary<Point3d, number>, curve: CurvePrimitive, index: number, strokeOptions?: StrokeOptions, workPoint?: Point3d): Voronoi.Stroke01 {
    const strokes = LineString3d.create();
    curve.emitStrokes(strokes, strokeOptions);
    let pt: Point3d | undefined;
    const n = strokes.numPoints();
    for (let i = 1; i < n - 1; ++i) { // skip first and last point
      if (pt = strokes.pointAt(i, workPoint))
        pointToIndex.insert(pt, index);
    }
    assert(() => n > 2, "Expect at least 1 interior stroke point");
    const p0 = (n > 2 ? strokes.pointAt(1) : undefined) ?? curve.fractionToPoint(0.5);
    const p1 = (n > 2 ? strokes.pointAt(n - 2) : undefined) ?? p0;
    return {p0, p1};
  }
  /** Intersect the circle with the curve and return the intersection closest to the desired curve endpoint. */
  private static computeCircleIntersection(circle: Arc3d, curve: CurvePrimitive, atCurveStart: boolean, distanceTol?: number): Point3d | undefined {
    const intersections = CurveCurve.intersectionProjectedXYPairs(undefined, circle, false, curve, false, distanceTol);
    if (!intersections.length)
      return undefined;
    if (intersections.length > 1) { // detailB has the info for curve
      if (atCurveStart)
        intersections.sort((a, b) => a.detailB.fraction - b.detailB.fraction); // first intersection is closest to curve start
      else
        intersections.sort((a, b) => b.detailB.fraction - a.detailB.fraction); // first intersection is closest to curve end
    }
    return intersections[0].detailB.point;
  };
  /** Intersect two consecutive curves with a tiny circle centered at their joint, and associate the intersection on each curve with its respective index. */
  private static pushSymmetricPointPairAtJoint = (pointToIndex: Dictionary<Point3d, number>, prevStroke: Voronoi.StrokeData, nextStroke: Voronoi.StrokeData, distanceTol?: number, workArc?: Arc3d): boolean => {
    const circle = Arc3d.createUnitCircle(workArc);
    const joint = nextStroke.cp.startPoint(circle.centerRef);
    // ensure the symmetric pair we add will be the last/first stroke points on prev/next curve
    const radius = 0.5 * Math.min(prevStroke.pt.distance(joint), nextStroke.pt.distance(joint));
    circle.matrixRef.setAt(0, 0, radius);
    circle.matrixRef.setAt(1, 1, radius);
    const prevPt = this.computeCircleIntersection(circle, prevStroke.cp, false, distanceTol);
    const nextPt = this.computeCircleIntersection(circle, nextStroke.cp, true, distanceTol);
    if (!prevPt || !nextPt) {
      assert(() => false, "Failed to add symmetric strokes at joint");
      return false;
    }
    pointToIndex.set(prevPt, prevStroke.i);
    pointToIndex.set(nextPt, nextStroke.i);
    return true;
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
    strokeOptions = strokeOptions?.clone() ?? StrokeOptions.createForCurves();
    if (!strokeOptions.minStrokesPerPrimitive || strokeOptions.minStrokesPerPrimitive < 2)
      strokeOptions.minStrokesPerPrimitive = 2; // ensure at least one interior point per primitive
    const workPoint = Point3d.createZero();
    const workCircle = Arc3d.createUnitCircle(Voronoi._workArc);
    const workSegment0 = LineSegment3d.createXYXY(0, 0, 0, 0);
    const workRay = Ray3d.createZero();
    let stroke0: Voronoi.StrokeData | undefined;
    let prevStroke: Voronoi.StrokeData | undefined;
    let firstLastStroke: Voronoi.Stroke01;
    // lambda for iterating the chain, splitting a linestring primitive into segments
    const getNextCurve = (cp: CurvePrimitive, index: number): CurvePrimitive | undefined => cp instanceof LineString3d ? cp.getIndexedSegment(index, workSegment0) : index ? undefined : cp;
    const pointToIndex = new Dictionary<Point3d, number>(Geometry.compareXY(distanceTol), (p: Point3d) => p.clone());
    // Step 1: add open chain start/end point
    const isClosedChain = curveChain.isPhysicallyClosedCurve(distanceTol, true);
    if (!isClosedChain) {
      if (curveChain.startPoint(workPoint))
        pointToIndex.insert(workPoint, 0);
      if (curveChain.endPoint(workPoint))
        pointToIndex.insert(workPoint, numChildren - 1);
    }
    // Step 2: add interior stroke points for each chain primitive
    // To ensure Voronoi edges exactly hit the chain joints, the joints themselves are omitted from the strokes
    for (let i = 0; i < numChildren; i++) {
      let child = children[i];
      if (CurveOps.isColinear(child, { colinearRay: workRay, xyColinear: true, maxDeviation: distanceTol }))
        child = LineSegment3d.createCapture(child.startPoint(), child.endPoint());
      let j = 0;
      for (let currCurve: CurvePrimitive | undefined; currCurve = getNextCurve(child, j); j++) {
        firstLastStroke = this.pushInteriorStrokePoints(pointToIndex, currCurve, i, strokeOptions, workPoint);
        const currStroke = { pt: firstLastStroke.p0, cp: currCurve, i };
        if (prevStroke)
          this.pushSymmetricPointPairAtJoint(pointToIndex, prevStroke, currStroke, distanceTol, workCircle);
        stroke0 = (isClosedChain && i === 0 && j === 0) ? currStroke : stroke0;
        prevStroke = { pt: firstLastStroke.p1, cp: currCurve, i };
      }
    }
    // Step 3: handle the seam if necessary
    if (prevStroke && stroke0)
      this.pushSymmetricPointPairAtJoint(pointToIndex, prevStroke, stroke0, distanceTol, workCircle);
    return pointToIndex;
  }
  /** Construct a graph from unique xy points. */
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
      isTriangulation = false;
    } else {
      // tighter triangulation tolerance to reduce vertex consolidation that might result in dictionary misses
      graph = Triangulator.createTriangulatedGraphFromPoints(points, undefined, 0.1 * distanceTol);
      if (isTriangulation = (graph !== undefined)) {
        // tag every edge of the Delaunay graph with the index associated to its start vertex
        graph.announceVertexLoops(
          (_g, vertex: HalfEdge): boolean => {
            const index = pointToIndex.get(vertex.getPoint3d(workPoint));
            assert(index !== undefined, "Delaunay vertex must know its generating curve");
            if (index !== undefined)
              vertex.announceEdgesAroundVertex((edge: HalfEdge) => edge.edgeTag = index);
            return true;
          }
        );
      }
    }
    return graph ? { graph, isTriangulation } : undefined;
  }
  /**
   * Create a Voronoi instance from a curve chain.
   * * This is the curve-based analog for point-based Voronoi cells.
   * * Each curve in the chain is sampled and a Voronoi diagram is generated from the Delaunay triangulation of all samples.
   * * The union of Voronoi cells generated by a single curve's samples is:
   *   * an approximation to the xy-region of points closest to the curve
   *   * represented in the Voronoi graph by a _super face_, a loop of edges from multiple adjacent faces
   *   * not necessarily convex
   * * The generating curve with chain index `i` for the returned Voronoi super face `R` is encoded thusly:
   *   * Each Voronoi edge has `faceTag` set as per [[createFromDelaunayGraph]], referring to its generating Delaunay vertex.
   *   * Each Delaunay edge has `edgeTag` set to the index in `curveChain` of its generating curve.
   *   * For each [[HalfEdge]] `e` in the super face loop of `R`, `delaunayGraph.allHalfEdges[e.faceTag].edgeTag === i`.
   * @param curveChain A curve chain consisting of at least two [[CurvePrimitive]]s. Z-coordinates are ignored.
   * The length of each child should exceed `distanceTol`.
   * @param strokeOptions Optional stroke options to control the sampling of the curve chain.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is [[Geometry.smallMetricDistance]].
   * @param boundingBox Optional nominal xy-bounding box for the Voronoi diagram. If unspecified, interior Voronoi cells are maximal.
   * @returns a new instance, or `undefined` for invalid input.
   */
  public static createFromCurveChain(
    curveChain: CurveChain,
    strokeOptions?: StrokeOptions,
    distanceTol: number = Geometry.smallMetricDistance,
    boundingBox?: LowAndHighXY,
  ): Voronoi | undefined {
    const pointsWithIndices = Voronoi.createStrokePointsWithIndices(curveChain, strokeOptions);
    if (!pointsWithIndices)
      return undefined; // no points created from the curve chain
    const inputGraph = Voronoi.createGraphFromPointsWithIndices(pointsWithIndices, distanceTol);
    if (!inputGraph)
      return undefined; // no graph created from points
    const instance = inputGraph.isTriangulation ?
      Voronoi.createFromDelaunayGraph(inputGraph.graph, distanceTol, boundingBox) :
      Voronoi.createFromColinearGraph(inputGraph.graph, distanceTol, boundingBox);
    if (instance)
      instance._isCurveBased = true;
    return instance;
  }
  /**
   * Test whether the edge is part of a curve-based Voronoi graph super face.
   * @param curveIndex optional test for a _specific_ super face associated with the curve with the given index.
   */
  private isEdgeInVoronoiSuperFace(edge: HalfEdge, curveIndex?: number): boolean {
    if (!this._isCurveBased || edge.faceTag === undefined)
      return false;
    const edgeIndex = this._inputGraph.allHalfEdges[edge.faceTag].edgeTag;
    if (edge.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR)) // edge is part of an unbounded Voronoi super face clipped by the bounding box
      return curveIndex === undefined ? true : curveIndex === edgeIndex;
    if (edge.edgeMate.faceTag === undefined)
      return false;
    const mateIndex = this._inputGraph.allHalfEdges[edge.edgeMate.faceTag].edgeTag;
    if (curveIndex !== undefined)
      return edgeIndex === curveIndex && mateIndex !== curveIndex; // edge is in a specific super face
    return edgeIndex !== mateIndex; // edge is part of a bounded Voronoi super face
  }
  /** Examine all edges in the curve-based Voronoi graph and return the first edge in an unvisited Voronoi super face. */
  private findNextVoronoiSuperFaceStart(): HalfEdge | undefined {
    if (!this._isCurveBased)
      return undefined;
    let start: HalfEdge | undefined;
    this._voronoiGraph.announceEdges((_g, edge: HalfEdge) => {
      if (edge.isMaskSet(HalfEdgeMask.EXTERIOR))
        return true; // skip exterior face
      if (edge.isMaskSet(this._superFaceMask))
        return true; // skip previously visited super face
      if (!this.isEdgeInVoronoiSuperFace(edge))
        return true; // skip edge; keep searching
      assert(() => edge.faceTag !== undefined, "Voronoi edge must know its generating Delaunay vertex");
      assert(() => this._inputGraph.allHalfEdges[edge.faceTag].edgeTag !== undefined, "Delaunay vertex must know its generating curve");
      start = edge;
      return false; // stop search; we found an unvisited super face
    });
    return start;
  }
  /**
   * Traverse the curve-based Voronoi graph and collect the edges comprising the Voronoi super face that starts with
   * the given seed edge.
   */
  private collectVoronoiSuperFace(seed: HalfEdge): HalfEdge[] | undefined {
    if (!this._isCurveBased || seed.faceTag === undefined)
      return undefined;
    const superFace: HalfEdge[] = [];
    const curveIndex = this._inputGraph.allHalfEdges[seed.faceTag].edgeTag;
    const foundSuperFace = seed.announceEdgesInSuperFace(
      (e: HalfEdge) => !this.isEdgeInVoronoiSuperFace(e, curveIndex), // skipEdge
      (e: HalfEdge) => { superFace.push(e); e.setMask(this._superFaceMask); }, // announceEdge
    );
    return (foundSuperFace && superFace.length > 2) ? superFace : undefined;
  }
  /**
   * Compute super faces of a curve-based Voronoi diagram.
   * * The instance must have been constructed with [[createFromCurveChain]].
   * * Each super face corresponds to the planar region of points closer to one curve in the generating chain than to any other.
   * * Each returned edge is masked for querying by subsequent methods.
   * @param numSuperFaces maximum number of super faces to return.
   * @returns up to `numSuperFaces` Voronoi super faces, sorted by curve index, or `undefined` if invalid input.
   * Each super face is an array of HalfEdges that form a loop.
   */
  public computeVoronoiSuperFaces(numSuperFaces: number): HalfEdge[][] | undefined {
    if (!this._isCurveBased || numSuperFaces < 1)
      return undefined;
    const superFaces: HalfEdge[][] = [];
    if (this._superFaceMask === HalfEdgeMask.NULL_MASK)
      this._superFaceMask = this._voronoiGraph.grabMask(false);
    this._voronoiGraph.clearMask(this._superFaceMask);
    for (let i = 0; i < numSuperFaces; i++) {
      const start = this.findNextVoronoiSuperFaceStart();
      if (!start)
        break; // no more super faces to find
      const superFace = this.collectVoronoiSuperFace(start);
      if (!superFace)
        return undefined; // invalid Voronoi graph
      superFaces.push(superFace);
    }
    superFaces.sort((a, b) => {
      const tagA = this._inputGraph.allHalfEdges[a[0].faceTag].edgeTag;
      const tagB = this._inputGraph.allHalfEdges[b[0].faceTag].edgeTag;
      return tagA - tagB;
    });
    return (superFaces.length > 0) ? superFaces : undefined;
  }
  /**
   * Construct a clipper for each curve-based Voronoi super face in the input array.
   * @param superFaces array returned by [[collectVoronoiSuperFaces]].
   * @returns array of clippers; the i_th clipper corresponds to the i_th input super face.
   * Returns `undefined` if input is invalid, or if a clipper construction failed.
   */
  public generateClippersFromVoronoiSuperFaces(superFaces: HalfEdge[][]): UnionOfConvexClipPlaneSets[] | undefined {
    if (!this._isCurveBased || this._superFaceMask === HalfEdgeMask.NULL_MASK)
      return undefined;
    const allClippers: UnionOfConvexClipPlaneSets[] = [];
    const superFaceOutsideMask = this._voronoiGraph.grabMask();
    const visitedMask = this._voronoiGraph.grabMask();
    const maskOutsideOfSuperFace = (startEdge: HalfEdge, clearMask: boolean): boolean => {
      return startEdge.announceEdgesInSuperFace(
        (e: HalfEdge) => !e.isMaskSet(this._superFaceMask),
        (e: HalfEdge) => e.edgeMate.applyMask(superFaceOutsideMask, clearMask),
      );
    };
    // Step 0: split each super face into convex faces (clipper prerequisite)
    // Disable triangle-flipping; we don't care about aspect ratio here.
    Triangulator.triangulateAllInteriorFaces(this._voronoiGraph, false, true);
    HalfEdgeGraphOps.expandConvexFaces(this._voronoiGraph, this._superFaceMask);
    for (const superFace of superFaces) {
      if (superFace.length < 3) {
        allClippers.length = 0;
        break; // invalid Voronoi graph
      }
      // Step 1: collect the convex faces for this super face
      const convexFaces: HalfEdge[] = [];
      if (!maskOutsideOfSuperFace(superFace[0], false)) {
        allClippers.length = 0;
        break; // invalid Voronoi graph
      }
      HalfEdgeGraphSearch.exploreComponent(superFace[0], visitedMask, superFaceOutsideMask, undefined, convexFaces);
      maskOutsideOfSuperFace(superFace[0], true);
      // Step 2: generate a clipper for each convex face
      const clippers: ConvexClipPlaneSet[] = [];
      for (const face of convexFaces) {
        const clipPlanes: ClipPlane[] = [];
        face.announceEdgesInFace((edge: HalfEdge) => {
          if (!edge.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE)) {
            const clipPlane = ClipPlane.createMidPointEdgeXY(edge, edge.faceSuccessor);
            if (clipPlane)
              clipPlanes.push(clipPlane);
          }
        });
        if (clipPlanes.length === face.countMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE, false))
          clippers.push(ConvexClipPlaneSet.createPlanes(clipPlanes));
      }
      // Step 3: assemble the clippers for this super face
      if (clippers.length === convexFaces.length)
        allClippers.push(UnionOfConvexClipPlaneSets.createConvexSets(clippers));
    }
    this._voronoiGraph.dropMask(visitedMask);
    this._voronoiGraph.dropMask(superFaceOutsideMask);
    return allClippers.length === superFaces.length ? allClippers : undefined;
  }
}

/**
 * Interfaces used by the Voronoi class.
 * @internal
 */
export namespace Voronoi {
  /** An interface to represent a 2D line segment */
  export interface Segment2d { start: XAndY; end: XAndY };
  /** An interface to represent a single stroke point with an associated index. */
  export interface StrokeData { pt: Point3d, cp: CurvePrimitive, i: number };
  /** An interface to represent two stroke points, e.g., first and last. */
  export interface Stroke01 { p0: Point3d, p1: Point3d };
}

/**
 * A class to represent a bounding box for a Voronoi diagram.
 * * A Voronoi diagram is unbounded, so we create a large rectangle around the diagram to limit it.
 * * To avoid clipping bounded Voronoi cells, this boundary should be large enough to contain the
 * circumcenters of the Delaunay triangles.
 * @internal
 */
class VoronoiBoundary {
  public bbox: Range2d;
  /**
   * Constructor that takes up to two ranges to union and expand by a margin.
   * * For example, Delaunay graph range and circumcenter range.
   */
  public constructor(r0: LowAndHighXY, r1?: LowAndHighXY) {
    this.bbox = Range2d.createFrom(r0);
    if (r1)
      this.bbox.union(r1, this.bbox);
    if (!this.bbox.isNull && !this.bbox.isSinglePoint) {
      const pad = 0.02473 * (this.bbox.xLength() + this.bbox.yLength()); // ~5% of average side length
      this.bbox.expandInPlace(pad);
    }
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
