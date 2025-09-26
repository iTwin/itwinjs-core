/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphSearch } from "../../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { Arc3d } from "../Arc3d";
import { CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { AnyRegion } from "../CurveTypes";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop, LoopCurveLoopCurve, SignedLoops } from "../Loop";
import { ParityRegion } from "../ParityRegion";
import { ConsolidateAdjacentCurvePrimitivesOptions, RegionOps } from "../RegionOps";
import { RegionGroupMember, RegionGroupOpType } from "../RegionOpsClassificationSweeps";

/** @packageDocumentation
 * @module Curve
 */

function sortAngle(curve: CurvePrimitive, fraction: number, reverse: boolean): number {
  const ray = curve.fractionToPointAndDerivative(fraction);
  const s = reverse ? -1.0 : 1.0;
  return Math.atan2(s * ray.direction.y, s * ray.direction.x);
}
function getFractionOnCurve(pair: CurveLocationDetailPair, curve: CurvePrimitive): number | undefined {
  if (pair.detailA.curve === curve)
    return pair.detailA.fraction;
  if (pair.detailB.curve === curve)
    return pair.detailB.fraction;
  return undefined;
}
function getDetailOnCurve(pair: CurveLocationDetailPair, curve: CurvePrimitive): CurveLocationDetail | undefined {
  if (pair.detailA.curve === curve)
    return pair.detailA;
  if (pair.detailB.curve === curve)
    return pair.detailB;
  return undefined;
}

class MapCurvePrimitiveToCurveLocationDetailPairArray {
  public primitiveToPair = new Map<CurvePrimitive, CurveLocationDetailPair[]>();
  // index assigned to this primitive (for debugging)
  public primitiveToIndex = new Map<CurvePrimitive, number>();
  private _numIndexedPrimitives: number = 0;
  public assignPrimitiveIndex(primitive: CurvePrimitive | undefined) {
    if (primitive !== undefined) {
      const index = this.primitiveToIndex.get(primitive);
      if (index === undefined) {
        this.primitiveToIndex.set(primitive, this._numIndexedPrimitives++);
      }
    }
  }
  public insertPrimitiveToPair(primitive: CurvePrimitive | undefined, pair: CurveLocationDetailPair) {
    if (primitive) {
      const priorPairs = this.primitiveToPair.get(primitive);
      this.assignPrimitiveIndex(primitive);
      if (!priorPairs) {
        this.primitiveToPair.set(primitive, [pair]);
      } else {
        priorPairs.push(pair);
      }
    }
  }
  public insertPair(pair: CurveLocationDetailPair) {
    const primitiveA = pair.detailA.curve;
    if (primitiveA)
      this.insertPrimitiveToPair(primitiveA, pair);
    const primitiveB = pair.detailB.curve;
    if (primitiveB)
      this.insertPrimitiveToPair(primitiveB, pair);
  }
  /**
   * Split closed missing primitives in half and add new intersection pairs.
   * * When bridge edges aren't included in the primitives array, a closed primitive with no intersections will not be
   * added to the graph because it isn't in the `primitiveToPair` map. By splitting such a missing primitive in two, we
   * introduce two intersections for each half, which allows the primitive to be represented in the map.
   */
  public splitAndAppendMissingClosedPrimitives(
    primitives: CurvePrimitive[], tolerance: number = Geometry.smallMetricDistance,
  ): void {
    for (const p of primitives) {
      let closedCurveSplitCandidate = false;
      if (p instanceof Arc3d)
        closedCurveSplitCandidate = p.sweep.isFullCircle;
      else if (!(p instanceof LineSegment3d) && !(p instanceof LineString3d)) // TODO: probably should do this for all types. Lots of spline-type primitives can be closed.
        closedCurveSplitCandidate = p.startPoint().isAlmostEqualXY(p.endPoint(), tolerance);
      if (closedCurveSplitCandidate && !this.primitiveToPair.has(p)) {
        const p0 = p.clonePartialCurve(0.0, 0.5);
        const p1 = p.clonePartialCurve(0.5, 1.0);
        if (p0 && p1) {
          this.insertPair(CurveLocationDetailPair.createCapture(
            CurveLocationDetail.createCurveEvaluatedFraction(p0, 0.0),
            CurveLocationDetail.createCurveEvaluatedFraction(p1, 1.0),
          ));
          this.insertPair(CurveLocationDetailPair.createCapture(
            CurveLocationDetail.createCurveEvaluatedFraction(p0, 1.0),
            CurveLocationDetail.createCurveEvaluatedFraction(p1, 0.0),
          ));
        }
      }
    }
  }
}

/**
 * @internal
 */
export class PlanarSubdivision {
  /**
   * Create a graph from curves and precomputed intersections.
   * * Z-coordinates are ignored.
   * @param primitives input curves
   * @param allPairs array of curve-curve xy-intersections
   * @param mergeTolerance optional distance tolerance for clustering vertices. Default value is [[Geometry.smallMetricDistance]].
   */
  public static assembleHalfEdgeGraph(
    primitives: CurvePrimitive[],
    allPairs: CurveLocationDetailPair[],
    mergeTolerance: number = Geometry.smallMetricDistance,
  ): HalfEdgeGraph {
    // map from key CurvePrimitive to CurveLocationDetailPair
    const detailByPrimitive = new MapCurvePrimitiveToCurveLocationDetailPairArray();
    for (const pair of allPairs)
      detailByPrimitive.insertPair(pair);
    if (primitives.length > detailByPrimitive.primitiveToPair.size) {
      // otherwise, these single-primitive loops are missing from the graph
      detailByPrimitive.splitAndAppendMissingClosedPrimitives(primitives, mergeTolerance);
    }
    const graph = new HalfEdgeGraph();
    for (const entry of detailByPrimitive.primitiveToPair.entries()) {
      const p = entry[0];
      // convert each interval intersection into two isolated intersections
      const details = entry[1].reduce((accumulator: CurveLocationDetailPair[], detailPair) => {
        if (!detailPair.detailA.hasFraction1)
          return [...accumulator, detailPair];
        const detail = getDetailOnCurve(detailPair, p)!;
        const detail0 = CurveLocationDetail.createCurveFractionPoint(p, detail.fraction, detail.point);
        const detail1 = CurveLocationDetail.createCurveFractionPoint(p, detail.fraction1!, detail.point1!);
        return [
          ...accumulator,
          CurveLocationDetailPair.createCapture(detail0, detail0),
          CurveLocationDetailPair.createCapture(detail1, detail1),
        ];
      }, []);
      // lexical sort on p intersection fraction
      details.sort((pairA: CurveLocationDetailPair, pairB: CurveLocationDetailPair) => {
        const fractionA = getFractionOnCurve(pairA, p)!;
        const fractionB = getFractionOnCurve(pairB, p)!;
        return fractionA - fractionB;
      });
      let last = { point: p.startPoint(), fraction: 0.0 };
      for (const detailPair of details) {
        const detail = getDetailOnCurve(detailPair, p)!;
        const detailFraction = Geometry.restrictToInterval(detail.fraction, 0, 1); // truncate fraction, but don't snap point; clustering happens later
        last = this.addHalfEdge(graph, p, last.point, last.fraction, detail.point, detailFraction, mergeTolerance);
      }
      this.addHalfEdge(graph, p, last.point, last.fraction, p.endPoint(), 1.0, mergeTolerance);
    }
    // every edge got its sortAngle defined by addHalfEdge
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph, (he: HalfEdge) => he.sortAngle ?? 0, mergeTolerance);
    return graph;
  }
  /**
   * Create a pair of mated half edges referencing an interval of a primitive.
   * * no action if start and end points are identical.
   * @param graph containing graph
   * @param p the curve
   * @param point0 start point
   * @param fraction0 starting fraction
   * @param point1 end point
   * @param fraction1 end fraction
   * @returns end point and fraction, or start point and fraction if no action
   */
  private static addHalfEdge(
    graph: HalfEdgeGraph,
    p: CurvePrimitive,
    point0: Point3d,
    fraction0: number,
    point1: Point3d,
    fraction1: number,
    mergeTolerance: number = Geometry.smallMetricDistance,
  ): { point: Point3d, fraction: number } {
    if (point0.isAlmostEqualXY(point1, mergeTolerance))
      return { point: point0, fraction: fraction0 };
    const halfEdge = graph.createEdgeXYAndZ(point0, 0, point1, 0);
    if (p.parent && p.parent instanceof RegionGroupMember && p.parent.parentGroup.groupOpType === RegionGroupOpType.NonBounding)
      halfEdge.setMaskAroundEdge(HalfEdgeMask.BRIDGE_EDGE);
    const detail01 = CurveLocationDetail.createCurveEvaluatedFractionFraction(p, fraction0, fraction1);
    const mate = halfEdge.edgeMate;
    halfEdge.edgeTag = detail01;
    halfEdge.sortData = 1.0;
    mate.edgeTag = detail01;
    mate.sortData = -1.0;
    halfEdge.sortAngle = sortAngle(p, fraction0, false);
    mate.sortAngle = sortAngle(p, fraction1, true);
    return { point: point1, fraction: fraction1 };
  }
  /**
   * Based on computed (and toleranced) area, push the loop (pointer) onto the appropriate array of positive, negative,
   * or sliver loops.
   * @param zeroAreaTolerance absolute area tolerance for sliver face detection
   * @param isSliverFace whether the loop is known a priori (e.g., via topology) to have zero area
   * @returns the area (forced to zero if within tolerance)
   */
  public static collectSignedLoop(
    loop: Loop, outLoops: SignedLoops, zeroAreaTolerance: number = 1.0e-10, isSliverFace?: boolean,
  ): number {
    let area = isSliverFace ? 0.0 : RegionOps.computeXYArea(loop);
    if (area === undefined)
      area = 0;
    if (Math.abs(area) < zeroAreaTolerance)
      area = 0.0;
    (loop as any).computedAreaInPlanarSubdivision = area;
    if (area > 0)
      outLoops.positiveAreaLoops.push(loop);
    else if (area < 0)
      outLoops.negativeAreaLoops.push(loop);
    else
      outLoops.slivers.push(loop);
    return area;
  }
  /** Extract geometric info from a topological edge. */
  private static extractGeometryFromEdge(edge: HalfEdge): { detail: CurveLocationDetail, reversed: boolean } | undefined {
    if (edge.sortData !== undefined && edge.edgeTag && edge.edgeTag instanceof CurveLocationDetail) {
      const detail = edge.edgeTag;
      if (detail.curve && detail.fraction1 !== undefined) {
        const reversed = edge.sortData < 0;
        return { detail, reversed };
      }
    }
    return undefined;
  }
  /** Create the geometry for a topological edge. */
  private static createCurveInEdge(edge: HalfEdge, z?: number): CurvePrimitive | undefined {
    let result: CurvePrimitive | undefined;
    const info = this.extractGeometryFromEdge(edge);
    if (info && info.detail.curve && info.detail.fraction1) {
      const f0 = info.reversed ? info.detail.fraction1 : info.detail.fraction;
      const f1 = info.reversed ? info.detail.fraction : info.detail.fraction1;
      result = info.detail.curve.clonePartialCurve(f0, f1);
      if (result && z !== undefined)
        result.tryTransformInPlace(Transform.createRowValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, z));
    }
    return result;
  }
  /**
   * Create a [[Loop]] for the given face or super face.
   * @param face a node in the face loop, or an array of HalfEdges that comprise a loop (e.g., a super face).
   * @param options bundle of options.
   * @returns the Loop, or `undefined` if it is not closed within xy-tolerance.
   */
  public static createLoopInFace(face: HalfEdge | HalfEdge[], options?: PlanarSubdivision.CreateRegionInFaceOptions): Loop | undefined {
    const consolidate = options?.announceEdge ? false : options?.compress ?? false; // can't compress if announcing
    const loop = Loop.create();
    const addEdgeCurve = (edge: HalfEdge): void => {
      const curve = this.createCurveInEdge(edge, options?.z);
      if (curve) {
        options?.announceEdge?.(edge, curve, loop);
        loop.tryAddChild(curve);
      }
    };
    if (Array.isArray(face))
      face.forEach(addEdgeCurve);
    else
      face.announceEdgesInFace(addEdgeCurve);
    if (consolidate) {
      const consolidateOptions = new ConsolidateAdjacentCurvePrimitivesOptions();
      consolidateOptions.consolidateLoopSeam = true;
      RegionOps.consolidateAdjacentPrimitives(loop, consolidateOptions);
    }
    if (loop.isPhysicallyClosedCurve(options?.closureTol, true))
      return loop;
    assert(() => false, "face is not physically closed");
    return undefined;
  }
  /**
   * Create a [[Loop]] or [[ParityRegion]] for the given face.
   * * A ParityRegion is created for a split-washer type face by removing bridge edges.
   * @param face a node in the face loop.
   * @param options bundle of options.
   * @returns the Loop or ParityRegion, or `undefined` if one could not be computed.
   */
  public static createLoopOrParityRegionInFace(face: HalfEdge, options?: PlanarSubdivision.CreateRegionInFaceOptions): Loop | ParityRegion | undefined {
    let region: AnyRegion | undefined;
    const visitMask = options?.visitMask ?? HalfEdgeMask.VISITED;
    const bridgeMask = options?.bridgeMask ?? HalfEdgeMask.BRIDGE_EDGE;
    let startBridgeEdge: HalfEdge | undefined;
    // is it a split-washer face?
    if (face.isSplitWasherFace(bridgeMask) && (startBridgeEdge = face.findMaskAroundFace(bridgeMask, true))) {
      const loops: Loop[] = [];
      const loopEdges: HalfEdge[] = [];
      const bridgeStack: HalfEdge[] = [startBridgeEdge];
      const announceEdge = (he: HalfEdge) => { he.setMask(visitMask); loopEdges.push(he); };
      const announceBridge = (he: HalfEdge) => { if (!he.isMaskSet(visitMask)) bridgeStack.push(he); };
      face.clearMaskAroundFace(visitMask);
      let bridge: HalfEdge | undefined;
      while (undefined !== (bridge = bridgeStack.pop())) {
        bridge.setMask(visitMask);
        const loopSeed = bridge.findMaskAroundFace(bridgeMask, false); // advance to next loop
        if (loopSeed) {
          if (loopSeed.isMaskSet(visitMask))
            continue;
          loopEdges.length = 0;
          if (loopSeed.announceEdgesInSuperFace(bridgeMask, announceEdge, announceBridge)) {
            const loop = this.createLoopInFace(loopEdges, options);
            if (loop) {
              loops.push(loop);
              continue;
            }
          }
        }
      }
      region = RegionOps.sortOuterAndHoleLoopsXY(loops);
      region = RegionOps.simplifyRegion(region);
    } else {
      region = this.createLoopInFace(face, options);
    }
    return (region && (region instanceof Loop || region instanceof ParityRegion)) ? region : undefined;
  }
  /** Return true if there are only two edges in the face loop, and their start curvatures are the same. */
  private static isNullFace(he: HalfEdge): boolean {
    const faceHasTwoEdges = (he.faceSuccessor.faceSuccessor === he);
    let faceIsBanana = false;
    if (faceHasTwoEdges) {
      const c0 = HalfEdgeGraphMerge.curvatureSortKey(he);
      const c1 = HalfEdgeGraphMerge.curvatureSortKey(he.faceSuccessor.edgeMate);
      if (!Geometry.isSameCoordinate(c0, c1)) // default tol!
        faceIsBanana = true;  // heuristic: we could also check end curvatures, and/or higher derivatives...
    }
    return faceHasTwoEdges && !faceIsBanana;
  }
  /** Look across edge mates (possibly several) for a non-null mate face. */
  private static getNonNullEdgeMate(_graph: HalfEdgeGraph, e: HalfEdge): HalfEdge | undefined {
    if (this.isNullFace(e))
      return undefined;
    let e1 = e.edgeMate;
    while (this.isNullFace(e1)) {
      e1 = e1.faceSuccessor.edgeMate;
      if (e1 === e)
        return undefined;
    }
    return e1;
  }
  public static collectSignedLoopSetsInHalfEdgeGraph(graph: HalfEdgeGraph, zeroAreaTolerance: number = 1.0e-10): SignedLoops[] {
    const q = HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(graph, undefined);
    const result: SignedLoops[] = [];
    const edgeMap = new Map<HalfEdge, LoopCurveLoopCurve>();
    for (const faceSeeds of q) {
      const componentAreas: SignedLoops = { positiveAreaLoops: [], negativeAreaLoops: [], slivers: [] };
      const edges: LoopCurveLoopCurve[] = [];
      for (const faceSeed of faceSeeds) {
        const isNullFace = this.isNullFace(faceSeed);
        const announceEdge = isNullFace ? () => {} : (he: HalfEdge, curveC: CurvePrimitive, loopC: Loop) => {
          const mate = this.getNonNullEdgeMate(graph, he);
          if (mate !== undefined) {
            const e = edgeMap.get(mate);
            if (e === undefined) {
              // Record this as loopA,edgeA of a shared edge to be completed later from the other side of the edge
              const e1 = new LoopCurveLoopCurve(loopC, curveC, undefined, undefined);
              edgeMap.set(he, e1);
            } else if (e instanceof LoopCurveLoopCurve) {
              e.setB(loopC, curveC);
              edges.push(e);
              edgeMap.delete(mate);
            }
          }
        };
        const loop = this.createLoopInFace(faceSeed, { announceEdge });
        if (loop)
          this.collectSignedLoop(loop, componentAreas, zeroAreaTolerance, isNullFace);
      }
      componentAreas.edges = edges;
      result.push(componentAreas);
      edgeMap.clear();
    }
    return result;
  }
}

/**
 * @internal
*/
export namespace PlanarSubdivision {
  /** Options bundle for [[PlanarSubdivision.createLoopInFace]] and [[PlanarSubdivision.createLoopOrParityRegionInFace]]. */
  export interface CreateRegionInFaceOptions {
    /**
     * Optional callback invoked on each `edge` before its `curve` is added to `loop`.
     * * Note that if a [[ParityRegion]] is being constructed, `curve` and `loop` may subsequently be reversed.
     */
    announceEdge?: (edge: HalfEdge, curve: CurvePrimitive, loop: Loop) => void;
    /**
     * Whether to consolidate adjacent curves in an output [[Loop]]. Default value is `false`.
     * * If `announce` is defined, no compression is performed, as edges and curves would no longer be in 1-1 correspondence.
     */
    compress?: boolean;
    /** Absolute xy-distance for confirming a returned Loop is closed. Default value is [[Geometry.smallMetricDistance]]. */
    closureTol?: number;
    /**
     * Mask preset on bridge edges. Default value is `HalfEdgeMask.BRIDGE_EDGE`.
     * * This mask is used to distinguish a split-washer type face, which can result in a [[ParityRegion]].
     */
    bridgeMask?: HalfEdgeMask;
    /** Mask to use for visiting edges when creating a [[ParityRegion]] from a split-washer type face. Default value is `HalfEdgeMask.VISITED`. */
    visitMask?: HalfEdgeMask;
    /**
     * Optional z-coordinate for the result region.
     * * If undefined, graph z-coordinates are used, but this may result in a non-planar region if the graph is not planar!
     */
    z?: number;
  }
}