/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { CloneFunction, Dictionary, OrderedComparator } from "@itwin/core-bentley";
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
  private _voronoiGraph: HalfEdgeGraph;
  private _delaunayGraph: HalfEdgeGraph;
  private _delaunayGraphIsValid = true;
  private _circumcenterMap: Map<number, Point3d> = new Map();
  private _idToIndexMap: Map<number, number> = new Map();
  private _delaunayGraphRange: Range3d = Range3d.createNull();
  private _circumcenterRange: Range3d = Range3d.createNull();
  private constructor(delaunayGraph: HalfEdgeGraph, isColinear = false) {
    this._delaunayGraph = delaunayGraph;
    this._voronoiGraph = new HalfEdgeGraph();
    if (!isColinear)
      this.populateCircumcenters();
    this.populateIdToIndexMap();
    this._delaunayGraphRange = HalfEdgeGraphOps.graphRange(delaunayGraph);
  }
  public getVoronoiGraph(): HalfEdgeGraph {
    return this._voronoiGraph;
  }
  public getDelaunayGraph(): HalfEdgeGraph {
    return this._delaunayGraph;
  }
  // find min id of the triangular face containing this vertex
  private findFaceMinId(vertex: HalfEdge): number {
    return Math.min(vertex.id, vertex.faceSuccessor.id, vertex.faceSuccessor.faceSuccessor.id);
  }
  // collect all centers of circumcircles formed by triangles in the Delaunay triangulation
  // and store them in a map with the minimum ID of face nodes as key
  private populateCircumcenters(): void {
    this._delaunayGraph.announceFaceLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        if (seed.isMaskSet(HalfEdgeMask.EXTERIOR))
          return true; // skip exterior faces
        if (seed.countEdgesAroundFace() !== 3) {
          this._delaunayGraphIsValid = false;
          return false;
        }
        // find circumcenter of the triangle formed by this face
        const p0 = seed.getPoint3d();
        const p1 = seed.faceSuccessor.getPoint3d();
        const p2 = seed.faceSuccessor.faceSuccessor.getPoint3d();
        p0.z = p1.z = p2.z = 0; // ignore z-coordinate
        const circumcircle = Arc3d.createCircularStartMiddleEnd(p0, p1, p2);
        if (!circumcircle || circumcircle instanceof LineString3d) {
          this._delaunayGraphIsValid = false;
          return false;
        }
        const circumcenter = circumcircle.center
        const minId = this.findFaceMinId(seed);
        this._circumcenterMap.set(minId, circumcenter);
        return true;
      },
    );
    this._circumcenterRange = Range3d.create(...Array.from(this._circumcenterMap.values()));
  }
  // go over all the nodes in the Delaunay graph and create a map of node IDs in a vertex loop to
  // min index of that vertex loop in graph.allHalfEdges
  private populateIdToIndexMap(): void {
    this._delaunayGraph.allHalfEdges.forEach((node, index) => {
      this._idToIndexMap.set(node.id, index);
    });
    this._delaunayGraph.announceVertexLoops(
      (_g: HalfEdgeGraph, seed: HalfEdge) => {
        const nodesAroundVertex = seed.collectAroundVertex();
        let minIndex = Number.MAX_SAFE_INTEGER;
        for (const node of nodesAroundVertex) {
          const index = this._idToIndexMap.get(node.id);
          if (index === undefined) {
            this._delaunayGraphIsValid = false;
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
  private getBisector(
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
  private handleBoundaryEdge(
    seed: HalfEdge,
    voronoiBoundary: VoronoiBoundary,
    seedIsExterior: boolean,
  ): boolean {
    let vertex = seed;
    if (seedIsExterior)
      vertex = seed.edgeMate;
    const minId = this.findFaceMinId(vertex);
    const circumcenter = this._circumcenterMap.get(minId);
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
    const minId0 = this.findFaceMinId(seed);
    const minId1 = this.findFaceMinId(seed.edgeMate);
    const circumcenter0 = this._circumcenterMap.get(minId0);
    const circumcenter1 = this._circumcenterMap.get(minId1);
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
   *    * the boundary and exterior edges should have correct masks,
   *    * the graph boundary should be convex.
   * @param delaunayGraph A HalfEdgeGraph representing a Delaunay triangulated graph; xy-only (z-coordinate is ignored).
   * @returns A HalfEdgeGraph representing the Voronoi diagram, or undefined if the input is invalid. Each voronoi face
   * corresponds to a vertex in the input graph and we store the index of the vertex (in graph.allHalfEdges) in the
   * edgeTag of all nodes in that voronoi face.
   */
  public static createFromDelaunay(
    delaunayGraph: HalfEdgeGraph, tol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const voronoi = new Voronoi(delaunayGraph);
    const graphLength = voronoi.getDelaunayGraph().allHalfEdges.length;
    if (delaunayGraph === undefined || graphLength < 3)
      return undefined;
    let isValidVoronoi = true;
    if (!voronoi._delaunayGraphIsValid)
      return undefined;
    const voronoiBoundary = new VoronoiBoundary(voronoi._delaunayGraphRange, voronoi._circumcenterRange);
    // go over all edges in the Delaunay graph and add bisectors for boundary edges
    // and add line between circumcenters for interior edges
    // if a circumcenter is outside the voronoi boundary, limit the bisector or line to the voronoi boundary
    voronoi.getDelaunayGraph().announceEdges(
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
      return undefined; // invalid voronoi graph
    voronoi.addVoronoiBoundary(voronoiBoundary);
    HalfEdgeGraphMerge.splitIntersectingEdges(voronoi._voronoiGraph);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(voronoi._voronoiGraph);
    voronoi.populateMasksAndFaceTags();
    return voronoi;
  }
  // create a half-edge graph for the colinear points; index is assigned to the edgeTag of each graph node
  private static createColinearXYGraph(pointsWithIndices: [Point3d, number][]): HalfEdgeGraph {
    const colinearGraph = new HalfEdgeGraph();
    let point0 = pointsWithIndices[0][0];
    let point1 = pointsWithIndices[1][0];
    let index0 = pointsWithIndices[0][1];
    let index1 = pointsWithIndices[1][1];
    let prevNode = colinearGraph.addEdgeXY(point0.x, point0.y, point1.x, point1.y);
    prevNode.edgeTag = index0;
    prevNode.edgeMate.edgeTag = index1;
    for (let i = 1; i < pointsWithIndices.length - 1; i++) {
      point0 = pointsWithIndices[i][0];
      point1 = pointsWithIndices[i + 1][0];
      index0 = pointsWithIndices[i][1];
      index1 = pointsWithIndices[i + 1][1];
      const nextNode = colinearGraph.addEdgeXY(point0.x, point0.y, point1.x, point1.y);
      nextNode.edgeTag = index0;
      nextNode.edgeMate.edgeTag = index1;
      HalfEdge.pinch(prevNode.faceSuccessor, nextNode);
      prevNode = nextNode;
    }
    return colinearGraph;
  }
  // find the bisector of a line segment defined by two points p0 and p1 and limit it to the voronoi boundary
  private static getLineBisector(p0: Point3d, p1: Point3d, voronoiBoundary: VoronoiBoundary): Line | undefined {
    p0.z = p1.z = 0; // ignore z-coordinate
    const midPoint = Point3d.createAdd2Scaled(p0, 0.5, p1, 0.5);
    const perp = Vector3d.create(p0.y - p1.y, p1.x - p0.x);
    const scale = 10000;
    const bisectorStart = Point3d.createAdd2Scaled(midPoint, 1, perp, -scale);
    const bisectorEnd = Point3d.createAdd2Scaled(midPoint, 1, perp, scale);
    const bisector: Line = { start: bisectorStart, end: bisectorEnd };
    const intersections = voronoiBoundary.intersect(bisector);
    if (!intersections || intersections.length <= 1)
      return undefined;
    // remove duplicate intersections
    const uniqueIntersections = Array.from(new Set(intersections.map(p => `${p.x},${p.y}`)))
      .map(p => p.split(',').map(Number))
      .map(p => Point3d.create(p[0], p[1]));
    return { start: uniqueIntersections[0], end: uniqueIntersections[1] }; // limit bisector to the voronoi boundary
  }
  // create a Voronoi diagram for a graph with colinear points
  private static createFromColinearGraph(colinearGraph: HalfEdgeGraph): Voronoi | undefined {
    const voronoi = new Voronoi(colinearGraph, true);
    if (!voronoi._delaunayGraphIsValid)
      return undefined;
    const voronoiBoundary = new VoronoiBoundary(voronoi._delaunayGraphRange, voronoi._circumcenterRange);
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
    if (!points || points.length < 2)
      return undefined;
    // remove duplicates
    const uniquePoints = Array.from(new Set(points.map(p => `${p.x},${p.y}`)))
      .map(p => p.split(',').map(Number))
      .map(p => Point3d.create(p[0], p[1]));
    if (PolylineOps.isColinear(uniquePoints, distanceTol, true)) {
      const sortedPoints = uniquePoints.slice().sort((a, b) => a.x - b.x || a.y - b.y); // sort points by x, then y
      const colinearGraph = Voronoi.createColinearXYGraph(sortedPoints.map(point => [point, 0]));
      return colinearGraph ? Voronoi.createFromColinearGraph(colinearGraph) : undefined;
    } else {
      const delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(uniquePoints);
      return delaunayGraph ? Voronoi.createFromDelaunay(delaunayGraph) : undefined;
    }
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
  // create stroke points from the curve chain and add curve child indices to the points
  private static createStrokePointsWithIndices(
    curveChain: CurveChain, strokeOptions?: StrokeOptions
  ): [Point3d, number][] | undefined {
    const children = curveChain.children;
    if (!children || children.length <= 1)
      return undefined;
    if (strokeOptions === undefined)
      strokeOptions = new StrokeOptions();
    // add start and end points to the pointsWithIndices array to ensure that
    // the curve chain will be inside the Voronoi boundary rectangle
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
    // add 2 equidistance points from children intersections
    // distance should be small enough so no other points exist between the 2 points
    let radius = 0.001;
    if (strokeOptions.maxEdgeLength && radius > strokeOptions.maxEdgeLength)
      radius = strokeOptions.maxEdgeLength / 2;
    const addIntersectionPoints = (circle: Arc3d, child: CurvePrimitive, childIndex: number) => {
      const intersections = CurveCurve.intersectionProjectedXYPairs(undefined, circle, false, child, false);
      if (intersections.length === 0)
        return false;
      if (intersections.length > 1)
        intersections.sort((a, b) => a.detailA.fraction - b.detailA.fraction);
      pointsWithIndices.push([intersections[0].detailA.point, childIndex]);
      return true;
    };
    for (let i = 1; i < numChildren; i++) {
      const length = children[i].curveLength();
      if (length < radius)
        radius = length / 2;
      const circle = Arc3d.createCenterNormalRadius(children[i].startPoint(), Vector3d.create(0, 0, 1), radius);
      if (!addIntersectionPoints(circle, children[i - 1], i - 1))
        return undefined;
      if (!addIntersectionPoints(circle, children[i], i))
        return undefined;
    }
    return pointsWithIndices;
  }
  private static createDelaunayGraphFromPointsWithIndices(
    pointsWithIndices: [Point3d, number][], distanceTol: number,
  ): [delaunayGraph: HalfEdgeGraph, pointsAreColinear: boolean] | undefined {
    if (!pointsWithIndices || pointsWithIndices.length < 2)
      return undefined;
    const comparePoints: OrderedComparator<Point3d> = (p0: Point3d, p1: Point3d) => {
      if (p0.isAlmostEqual(p1, distanceTol))
        return 0;
      if (!Geometry.isAlmostEqualNumber(p0.x, p1.x, distanceTol)) {
        if (p0.x < p1.x)
          return -1;
        if (p0.x > p1.x)
          return 1;
      }
      if (!Geometry.isAlmostEqualNumber(p0.y, p1.y, distanceTol)) {
        if (p0.y < p1.y)
          return -1;
        if (p0.y > p1.y)
          return 1;
      }
      if (!Geometry.isAlmostEqualNumber(p0.z, p1.z, distanceTol)) {
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
    // generate initial voronoi diagram
    let delaunayGraph: HalfEdgeGraph | undefined;
    const pointsAreColinear = PolylineOps.isColinear(Array.from(pointToIndexDic.keys()), distanceTol, true);
    if (pointsAreColinear) {
      const sortedPoints = pointToIndexDic.extractPairs().slice().sort((a, b) => a.key.x - b.key.x || a.key.y - b.key.y); // sort points by x, then y
      delaunayGraph = Voronoi.createColinearXYGraph(sortedPoints.map(item => [item.key, item.value]));
      if (!delaunayGraph)
        return undefined;
    } else {
      delaunayGraph = Triangulator.createTriangulatedGraphFromPoints(Array.from(pointToIndexDic.keys()));
      if (!delaunayGraph)
        return undefined;
      delaunayGraph.announceVertexLoops(
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
    }
    return [delaunayGraph, pointsAreColinear];
  }
  /**
   * Creates clippers for regions closest to the children of a curve chain.
   * @param curveChain A curve chain; xy-only (z-coordinate is ignored). Must have at least 2 children.
   * @param strokeOptions Optional stroke options to control the sampling of the curve chain.
   * @param distanceTol Optional distance tolerance to use when comparing points; default is Geometry.smallMetricDistance.
   * @returns An array of UnionOfConvexClipPlaneSets where each member representing a union of convex regions closest to
   * the children of a curve chain, or undefined if the input is invalid.
   */
  public static createFromCurveChain(
    curveChain: CurveChain, strokeOptions?: StrokeOptions, distanceTol: number = Geometry.smallMetricDistance,
  ): Voronoi | undefined {
    const pointsWithIndices = Voronoi.createStrokePointsWithIndices(curveChain, strokeOptions);
    if (!pointsWithIndices)
      return undefined; // no points created from the curve chain
    const result = Voronoi.createDelaunayGraphFromPointsWithIndices(pointsWithIndices, distanceTol);
    if (!result)
      return undefined; // no delaunay graph created from the points
    const [delaunayGraph, pointsAreColinear] = result;
    if (pointsAreColinear) {
      return Voronoi.createFromColinearGraph(delaunayGraph);
    } else {
      return Voronoi.createFromDelaunay(delaunayGraph, distanceTol);
    }
  }
  private findSuperFaceStart(superFaceEdgeMask: HalfEdgeMask): HalfEdge | undefined {
    let start: HalfEdge | undefined;
    this._voronoiGraph.announceEdges((_voronoi: HalfEdgeGraph, seed: HalfEdge) => {
      if (seed.isMaskSet(HalfEdgeMask.EXTERIOR) || seed.isMaskSet(superFaceEdgeMask))
        return true; // skip exterior faces or previously visited super face edges
      if (seed.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR) ||
        this._delaunayGraph.allHalfEdges[seed.faceTag].edgeTag !== this._delaunayGraph.allHalfEdges[seed.edgeMate.faceTag].edgeTag) {
        start = seed;
        return false;
      }
      return true;
    });
    return start;
  }
  private findSuperFace(start: HalfEdge, superFaceEdgeMask: HalfEdgeMask): HalfEdge[] {
    const superFace: HalfEdge[] = [];
    const childIndex = this._delaunayGraph.allHalfEdges[start.faceTag].edgeTag
    start.announceEdgesInSuperFace(
      (node: HalfEdge) => {
        if (node.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR) ||
          (this._delaunayGraph.allHalfEdges[node.faceTag].edgeTag === childIndex &&
            this._delaunayGraph.allHalfEdges[node.edgeMate.faceTag].edgeTag !== childIndex)) {
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
  // set super face masks to the voronoi diagram and return the super faces
  public getSuperFaces(numChildren: number, superFaceEdgeMask: HalfEdgeMask): HalfEdge[][] | undefined {
    const superFaces: HalfEdge[][] = [];
    for (let i = 0; i < numChildren; i++) {
      const start = this.findSuperFaceStart(superFaceEdgeMask);
      if (!start)
        return undefined;
      superFaces.push(this.findSuperFace(start, superFaceEdgeMask));
    }
    return superFaces;
  }
  // modify voronoi graph such that each super face only has convex faces
  public convexifySuperFaces(superFaceEdgeMask: HalfEdgeMask) {
    const success = Triangulator.triangulateAllInteriorFaces(this._voronoiGraph);
    console.log(`success: ${success}`);
    HalfEdgeGraphOps.expandConvexFaces(this._voronoiGraph, superFaceEdgeMask);
  }
  // generate clippers from super faces
  public generateClippersFromSuperFaces(
    superFaces: HalfEdge[][], superFaceEdgeMask: HalfEdgeMask, superFaceOutsideMask: HalfEdgeMask,
  ): UnionOfConvexClipPlaneSets[] | undefined {
    const allClippers: UnionOfConvexClipPlaneSets[] = [];
    for (const superFace of superFaces) {
      superFace[0].announceEdgesInSuperFace(
        (node: HalfEdge) => {
          if (!node.isMaskSet(superFaceEdgeMask))
            return true;
          return false;
        },
        (node: HalfEdge) => { node.edgeMate.setMask(superFaceOutsideMask); }
      );
      const convexFacesInSuperFace: HalfEdge[] = [];
      HalfEdgeGraphSearch.exploreComponent(
        superFace[0], HalfEdgeMask.VISITED, superFaceOutsideMask, undefined, convexFacesInSuperFace,
      );
      superFace[0].announceEdgesInSuperFace(
        (node: HalfEdge) => {
          if (!node.isMaskSet(superFaceEdgeMask))
            return true;
          return false;
        },
        (node: HalfEdge) => { node.edgeMate.clearMask(superFaceOutsideMask); }
      );
      const clippersOfSuperFace: ConvexClipPlaneSet[] = [];
      for (const face of convexFacesInSuperFace) {
        const clipPlanesOfConvexFace: ClipPlane[] = [];
        const clipperOfConvexFace: ConvexClipPlaneSet = ConvexClipPlaneSet.createEmpty();
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
            return undefined; // failed to create clip plane
          }
          clipPlanesOfConvexFace.push(clipPlane);
          edge = nextEdge;
          nextEdge = nextEdge.faceSuccessor;
        } while (edge !== face)
        ConvexClipPlaneSet.createPlanes(clipPlanesOfConvexFace, clipperOfConvexFace);
        clippersOfSuperFace.push(clipperOfConvexFace);
      }
      allClippers.push(UnionOfConvexClipPlaneSets.createConvexSets(clippersOfSuperFace));
    }
    return allClippers;
  }
  // Creates a Polyface from the Voronoi diagram super faces.
  public createPolyface(): IndexedPolyface {
    return PolyfaceBuilder.graphToPolyface(
      this._voronoiGraph,
      undefined,
      undefined,
      (node: HalfEdge) => { node.isMaskSet(this._superFaceEdgeMask) }
    );
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


