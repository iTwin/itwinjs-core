/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgeGraphOps } from "./Merging";

/**
 * interface containing various options appropriate to merging lines segments into chains.
 * @internal
 */
export interface ChainMergeContextOptions {
  /**
   * Tolerance for declaring points equal
   * * Default is `Geometry.smallMetricDistance`
   */
  tolerance?: number;
  /**
   * Direction for primary sort.
   * * Default is `Vector3d.create(0.294234298, 0.72391399, 0.45234328798)`
   * * this vector should NOT be along a principal x,y,z direction.
   * * The internal form will be normalized.
   */
  primarySortDirection?: Vector3d;
}
/** Internal form of ChainMergeContextOptions -- same field names, but required to have contents. */
class ChainMergeContextValidatedOptions {
  /**
   * Tolerance for declaring points equal.
   */
  public tolerance: number;
  /** UNNORMALIZED base vector for sorting.
   * * Actual vector hoisted into an instance is normalized.
   */
  private static readonly _defaultPrimarySortDirection = Vector3d.create(0.294234298, 0.72391399, 0.45234328798);
  /**
   * Direction for primary sort.  This is normalized !!!
   */
  public primarySortDirection: Vector3d;
  /** return a unit vector aligned with optional direction.
   * * Default return is into the first quadrant at a quirky angle so any perpendicular plane is unlikely to hit many points
   */
  public static createPrimarySortVector(vector?: Vector3d): Vector3d {
    if (vector === undefined) {
      vector = this._defaultPrimarySortDirection.clone();
    }
    return vector.normalizeWithDefault(
      ChainMergeContextValidatedOptions._defaultPrimarySortDirection.x,
      ChainMergeContextValidatedOptions._defaultPrimarySortDirection.y,
      ChainMergeContextValidatedOptions._defaultPrimarySortDirection.z);
  }
  /**
   * PRIVATE constructor -- assumes all inputs are validated in public create method !!!!
   * @param tolerance
   * @param unitVectorForPrimarySort
   */
  private constructor(tolerance: number, unitVectorForPrimarySort: Vector3d) {
    this.tolerance = tolerance;
    this.primarySortDirection = unitVectorForPrimarySort;
  }
  /** return the default option set. */
  public static createFromUnValidated(options?: ChainMergeContextOptions): ChainMergeContextValidatedOptions {
    const result = new ChainMergeContextValidatedOptions(Geometry.smallMetricDistance, ChainMergeContextValidatedOptions.createPrimarySortVector());
    if (options !== undefined) {
      if (options.tolerance !== undefined)
        result.tolerance = options.tolerance;
      if (options.primarySortDirection !== undefined)
        result.primarySortDirection = ChainMergeContextValidatedOptions.createPrimarySortVector();
    }
    return result;
  }
  /** Clone this context. */
  public clone(): ChainMergeContextValidatedOptions {
    return new ChainMergeContextValidatedOptions(this.tolerance, this.primarySortDirection);
  }
}
/**
 * * Context for assembling line segments into chains.
 * * Use the context in phases:
 *   * Create the context:   `context = ChainMergeContext.create ()`
 *   * Add line with any combination of:
 *      * `context.addSegment(pointA, pointB)`
 *      * `context.addLineSegment3dArray (segments)`
 *   * Scan all coordinate data for common coordinates.  Twist nodes together to form chains:
 *      * `context.clusterAndMergeVerticesXYZ ()`
 *   * Collect the chains:
 *      * myLinestringArray = context.collectMaximalChains();
 * * The context carries an optional plane which is used by addSegmentsOnPlane
 *
 * @internal
 */
export class ChainMergeContext {

  private _graph: HalfEdgeGraph;
  private _options: ChainMergeContextValidatedOptions;
  private _plane?: PlaneAltitudeEvaluator;
  private _convexClipper?: ConvexClipPlaneSet;
  private constructor(options: ChainMergeContextValidatedOptions) {
    this._graph = new HalfEdgeGraph();
    this._options = options;
  }
  /** Save a reference plane for later use, e.g. in addSegmentsOnPlane */
  public set plane(value: PlaneAltitudeEvaluator | undefined) { this._plane = value; }
  /** Property access for the reference plane. */
  public get plane(): PlaneAltitudeEvaluator | undefined { return this._plane; }

  /** Save a reference plane for later use, e.g. in addSegmentsOnPlane */
  public set convexClipper(value: ConvexClipPlaneSet | undefined) { this._convexClipper = value; }
  /** Property access for the reference plane. */
  public get convexClipper(): ConvexClipPlaneSet | undefined { return this._convexClipper; }

  /**
   * * Construct an empty chain merge graph.
   * * The options parameter may contain any combination of the options values.
   *   * tolerance = absolute tolerance for declaring points equal.
   *     * Default is `Geometry.smallMetricDistance`
   *   * primarySortDirection = direction for first sort.
   *     * To minimize clash among points on primary sort, this should NOT be perpendicular to any principal plane.
   *     * The default points into the first octant with non-obvious components.
   */
  public static create(options?: ChainMergeContextOptions): ChainMergeContext {
    const validatedOptions = ChainMergeContextValidatedOptions.createFromUnValidated(options);
    return new ChainMergeContext(validatedOptions);
  }
  /** Add a segment to the evolving graph. */
  public addSegment(pointA: Point3d, pointB: Point3d) {
    this._graph.createEdgeXYZXYZ(pointA.x, pointA.y, pointA.z, 0, pointB.x, pointB.y, pointB.z, 0);
  }
  /** Add all segments from an array to the graph. */
  public addLineSegment3dArray(data: LineSegment3d[]) {
    for (const segment of data) {
      this.addSegment(segment.point0Ref, segment.point1Ref);
    }
  }
  /** Add edges for all segments that are "on" the plane.
   * * No action if `this.plane` is undefined.
   */
  public addSegmentsOnPlane(points: GrowableXYZArray, addClosure: boolean = false) {
    if (!this._plane)
      return;
    const plane = this._plane;
    let i0 = addClosure ? points.length - 1 : 0;
    let a0 = points.evaluateUncheckedIndexPlaneAltitude(i0, plane);
    let i1 = addClosure ? 0 : 1;
    let a1;
    for (; i1 < points.length; i0 = i1++ , a0 = a1) {
      a1 = points.evaluateUncheckedIndexPlaneAltitude(i1, plane);
      if (Geometry.isSmallMetricDistance(a0) && Geometry.isSmallMetricDistance(a1))
        this._graph.createEdgeXYZXYZ(
          points.getXAtUncheckedPointIndex(i0), points.getYAtUncheckedPointIndex(i0), points.getZAtUncheckedPointIndex(i0), 0,
          points.getXAtUncheckedPointIndex(i1), points.getYAtUncheckedPointIndex(i1), points.getZAtUncheckedPointIndex(i1), 0);
    }
  }
  /**
   * Return a numeric value to be used for sorting, with little chance widely separated nodes will have identical key.
   * * Any single x,y,z component is a poor choice because horizontal and vertical alignment is common.
   * * Hence take dot product of x,y,z with non-trivial fraction values.
   * @param node node with x,y,z coordinates
   */
  private primarySortKey(node: HalfEdge): number {
    return this._options.primarySortDirection.dotProductXYZ(node.x, node.y, node.z);
  }
  /** Return difference of sortData members as sort comparison */
  private static nodeCompareSortData(nodeA: HalfEdge, nodeB: HalfEdge): number {
    return nodeA.sortData! - nodeB.sortData!;
  }
  /** test if nodeA is a dangling edge end (i.e. edges around vertex equal 1, but detect it without walking all the way around. */
  private static isIsolatedEnd(nodeA: HalfEdge): boolean {
    return nodeA.vertexSuccessor === nodeA;
  }

  /** test if nodeA is at a vertex with exactly 2 edges (i.e. edges around vertex equal w, but detect it without walking all the way around. */
  private static isChainInteriorVertex(nodeA: HalfEdge): boolean {
    const nodeB = nodeA.vertexSuccessor;
    return nodeB !== nodeA && nodeB.vertexSuccessor === nodeA;
  }

  /**
   * * isolate all edge ends.
   * * perform cluster analysis to determine nearly coincident points.
   * * pinch all edges together at each vertex.
   */
  public clusterAndMergeVerticesXYZ() {
    HalfEdgeGraphOps.isolateAllEdges(this._graph);
    for (const p of this._graph.allHalfEdges) {
      p.sortData = this.primarySortKey(p);
    }
    const sortArray = this._graph.allHalfEdges.slice();
    sortArray.sort(ChainMergeContext.nodeCompareSortData);
    const xyzTolerance = this._options.tolerance;
    // A node is unvisited if it is its own vertex successor !!!
    // otherwise the node has already been twisted into a base vertex.
    const n = sortArray.length;
    for (let i0 = 0; i0 < n; i0++) {
      const node0 = sortArray[i0];
      const qMin = node0.sortData!;
      const qMax = qMin + xyzTolerance;
      if (ChainMergeContext.isIsolatedEnd(node0)) {
        for (let i1 = i0 + 1; i1 < n; i1++) {
          const node1 = sortArray[i1];
          if (ChainMergeContext.isIsolatedEnd(node1)) {
            if (node1.sortData! > qMax)
              break;
            if (node0.distanceXYZ(node1) <= xyzTolerance) {
              HalfEdge.pinch(node0, node1);
              node1.setXYZFrom(node0);    // force true equal coordinates.
            }
          }
        }
      }
    }
  }
  /**
   * If node0 is not visited, creating a linestring with that starting edge and all successive edges along a chain.
   * @param chains growing array of chains.
   * @param node0 start node for search.
   */
  private collectMaximalLineString3dFromStartNode(chains: LineString3d[], node0: HalfEdge, visitMask: HalfEdgeMask) {
    if (!node0.isMaskSet(visitMask)) {
      const ls = LineString3d.create();
      ls.addPointXYZ(node0.x, node0.y, node0.z);
      for (; ;) {
        node0.setMask(visitMask);
        node0.edgeMate.setMask(visitMask);
        node0 = node0.faceSuccessor;
        ls.addPointXYZ(node0.x, node0.y, node0.z);
        if (node0.isMaskSet(visitMask) || !ChainMergeContext.isChainInteriorVertex(node0))
          break;
      }
      chains.push(ls);
    }
  }
  /**
   * If node0 is not visited, creating a linestring with that starting edge and all successive edges along a chain.
   * @param chains growing array of chains.
   * @param node0 start node for search.
   */
  private collectMaximalGrowableXYXArrayFromStartNode(result: GrowableXYZArray[], node0: HalfEdge, visitMask: HalfEdgeMask) {
    if (!node0.isMaskSet(visitMask)) {
      const points = new GrowableXYZArray();
      points.pushXYZ(node0.x, node0.y, node0.z);
      for (; ;) {
        node0.setMask(visitMask);
        node0.edgeMate.setMask(visitMask);
        node0 = node0.faceSuccessor;
        points.pushXYZ(node0.x, node0.y, node0.z);
        if (node0.isMaskSet(visitMask) || !ChainMergeContext.isChainInteriorVertex(node0))
          break;
      }
      if (points.length > 0)
        result.push(points);
    }
  }

  /**
   * * find edges with start, end in same vertex loop.
   * * pinch them away from the loop
   * * set mask on both sides.
   * * Return the number of excisions.
   */
  private exciseAndMarkSlingEdges(mask: HalfEdgeMask): number {
    let n = 0;
    for (const p of this._graph.allHalfEdges) {
      if (p.distanceXYZ(p.edgeMate) < this._options.tolerance
        && !p.isMaskSet(mask)) {
        const q = p.edgeMate;
        HalfEdge.pinch(p, p.vertexPredecessor);
        HalfEdge.pinch(q, q.vertexPredecessor);
        p.setMask(mask);
        q.setMask(mask);
        n++;
      }
    }
    return n;
  }
  /** Collect chains which have maximum edge count, broken at an vertex with other than 2 edges.
   * * This is assumed to be preceded by a call to a vertex-cluster step such as `clusterAndMergeVerticesYXZ`
   */
  public collectMaximalChains(): LineString3d[] {
    const result: LineString3d[] = [];
    const visitMask = HalfEdgeMask.VISITED;
    // Pass 0: excise and mark zero-length edges.
    this.exciseAndMarkSlingEdges(visitMask);
    this._graph.clearMask(visitMask);
    // Pass 1: only start at non-interior edges -- vertices with one edge or more than 2 edges.
    // (Note that collectMaximalChain checks the visit mask.)
    for (const node0 of this._graph.allHalfEdges) {
      if (!ChainMergeContext.isChainInteriorVertex(node0)) {
        this.collectMaximalLineString3dFromStartNode(result, node0, visitMask);
      }
    }
    // Pass 2: start anywhere in an unvisited loop.
    for (const node0 of this._graph.allHalfEdges) {
      this.collectMaximalLineString3dFromStartNode(result, node0, visitMask);
    }
    return result;
  }
  public collectMaximalGrowableXYZArrays(): GrowableXYZArray[] {
    const result: GrowableXYZArray[] = [];
    const visitMask = HalfEdgeMask.VISITED;
    // Pass 0: excise and mark zero-length edges.
    this.exciseAndMarkSlingEdges(visitMask);
    this._graph.clearMask(visitMask);
    // Pass 1: only start at non-interior edges -- vertices with one edge or more than 2 edges.
    // (Note that collectMaximalChain checks the visit mask.)
    for (const node0 of this._graph.allHalfEdges) {
      if (!ChainMergeContext.isChainInteriorVertex(node0)) {
        this.collectMaximalGrowableXYXArrayFromStartNode(result, node0, visitMask);
      }
    }
    // Pass 2: start anywhere in an unvisited loop.
    for (const node0 of this._graph.allHalfEdges) {
      this.collectMaximalGrowableXYXArrayFromStartNode(result, node0, visitMask);
    }
    return result;
  }
}
