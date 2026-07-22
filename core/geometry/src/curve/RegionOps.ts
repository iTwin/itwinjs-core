/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert } from "@itwin/core-bentley";
import { Geometry } from "../Geometry";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import {
  IndexedReadWriteXYZCollection, IndexedXYZCollection, LineStringDataVariant, MultiLineStringDataVariant,
} from "../geometry3d/IndexedXYZCollection";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { PolylineCompressionContext } from "../geometry3d/PolylineCompressionByEdgeOffset";
import { Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { SortablePolygon } from "../geometry3d/SortablePolygon";
import { Transform } from "../geometry3d/Transform";
import { XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { MomentData } from "../geometry4d/MomentData";
import { IndexedPolyface, Polyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask, HalfEdgeToBooleanFunction, HalfEdgeToNumberFunction } from "../topology/Graph";
import { HalfEdgeGraphSearch } from "../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphOps } from "../topology/Merging";
import { Triangulator } from "../topology/Triangulation";
import { BagOfCurves, CurveChain, CurveCollection } from "./CurveCollection";
import { CurveCurve } from "./CurveCurve";
import { CurveLocationDetail } from "./CurveLocationDetail";
import { CurveOps } from "./CurveOps";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyChain, AnyCurve, AnyRegion } from "./CurveTypes";
import { CurveWireMomentsXYZ } from "./CurveWireMomentsXYZ";
import { GeometryQuery } from "./GeometryQuery";
import { ChainCollectorContext } from "./internalContexts/ChainCollectorContext";
import { PolygonWireOffsetContext } from "./internalContexts/PolygonOffsetContext";
import { TransferWithSplitArcs } from "./internalContexts/TransferWithSplitArcs";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
import { Loop, SignedLoops } from "./Loop";
import { JointOptions, OffsetOptions } from "./OffsetOptions";
import { ParityRegion } from "./ParityRegion";
import { Path } from "./Path";
import { ConsolidateAdjacentCurvePrimitivesContext } from "./Query/ConsolidateAdjacentPrimitivesContext";
import { CurveSplitContext } from "./Query/CurveSplitContext";
import { PointInOnOutContext } from "./Query/InOutTests";
import { PlanarSubdivision } from "./Query/PlanarSubdivision";
import { RegionMomentsXY } from "./RegionMomentsXY";
import { RegionBooleanContext, RegionGroupMember, RegionGroupOpType, RegionOpsFaceToFaceSearch } from "./RegionOpsClassificationSweeps";
import { StrokeOptions } from "./StrokeOptions";
import { UnionRegion } from "./UnionRegion";

/**
 * * `properties` is a string with special characters indicating
 *   * "U" -- contains unmerged stick data
 *   * "M" -- merged
 *   * "R" -- regularized
 *   * "X" -- has exterior markup
 * @internal
 */
export type GraphCheckPointFunction = (name: string, graph: HalfEdgeGraph, properties: string, extraData?: any) => any;

/**
 * * Options to control method [[RegionOps.consolidateAdjacentPrimitives]].
 * @public
 */
export class ConsolidateAdjacentCurvePrimitivesOptions {
  /** True to consolidate adjacent linear geometry into a single LineString3d. */
  public consolidateLinearGeometry: boolean = true;
  /** True to consolidate contiguous compatible arcs into a single Arc3d. */
  public consolidateCompatibleArcs: boolean = true;
  /**
   * True to attempt consolidation of the first and last primitives of a [[Loop]] or physically closed linestring data,
   * allowing location of the seam to change.
   */
  public consolidateLoopSeam?: boolean = false;
  /** Disable LineSegment3d and LineString3d point compression. */
  public disableLinearCompression?: boolean = false;
  /** Tolerance for detecting identical points. */
  public duplicatePointTolerance: number = Geometry.smallMetricDistance;
  /** Tolerance for removing interior colinear points (if `!disableLinearCompression`). */
  public colinearPointTolerance: number = Geometry.smallMetricDistance;
}

/**
 * Enumeration of the binary operation types for Boolean operations.
 * @see [[RegionOps.regionBooleanXY]], [[RegionOps.polygonBooleanXYToLoops]], [[RegionOps.polygonBooleanXYToPolyface]].
 * @public
 */
export enum RegionBinaryOpType {
  Union = 0,
  Parity = 1,
  Intersection = 2,
  AMinusB = 3,
  BMinusA = 4,
}

/**
 * Options bundle for use in [[RegionOps.regionBooleanXY]].
 * @public
 */
export interface RegionBooleanXYOptions {
  /** Absolute distance tolerance for merging loops. Default is [[Geometry.smallMetricDistance]]. */
  mergeTolerance?: number;
  /**
   * Whether to post-process the Boolean result to remove extraneous interior edges and return a simpler region.
   * * Default value is `false`, to return the raw Boolean result, which may be, e.g., a [[UnionRegion]] of adjacent [[Loop]]s.
   */
  simplifyUnion?: boolean;
  /** Operation to apply to the regions of the first argument. Default/unsupported is union. Subtraction operations are not supported. */
  operationGroupA?: RegionBinaryOpType;
  /** Operation to apply to the regions of the second argument. Default/unsupported is union. Subtraction operations are not supported. */
  operationGroupB?: RegionBinaryOpType;
}

/**
 * Class `RegionOps` has static members for calculations on regions (areas).
 * * Regions are represented by these [[CurveCollection]] subclasses:
 *   * [[Loop]] -- a single loop
 *   * [[ParityRegion]] -- a collection of loops, interpreted by parity rules.
 * The common "One outer loop and many inner loops" is a parity region.
 *   * [[UnionRegion]] -- a collection of `Loop` and `ParityRegion` objects understood as a (probably disjoint) union.
 * * Most of the methods in this class:
 *   * Ignore z-coordinates, so callers should ensure that input geometry has been rotated parallel to the xy-plane.
 *   * Assume consistent Loop orientation: "solid" Loops are counterclockwise; "hole" Loops are clockwise.
 * @public
 */
export class RegionOps {
  /**
   * Return moment sums for a loop, parity region, or union region.
   * * The input region should lie in a plane parallel to the xy-plane, as z-coords are ignored (assumed to be zero).
   * * The caller can convert the return value `rawMomentData` to principal axes and moments with
   * `principalMomentData = MomentData.inertiaProductsToPrincipalAxes(rawMomentData.origin, rawMomentData.sums);`
   * * `rawMomentData.origin` is the centroid of `region`.
   * * `rawMomentData.sums.weight()` is the signed area of `region`.
   * @param region any [[Loop]], [[ParityRegion]], or [[UnionRegion]].
   */
  public static computeXYAreaMoments(region: AnyRegion): MomentData | undefined {
    const handler = new RegionMomentsXY();
    const result = region.dispatchToGeometryHandler(handler);
    if (result instanceof MomentData) {
      result.shiftOriginAndSumsToCentroidOfSums();
      return result;
    }
    return undefined;
  }
  /**
   * Return an area tolerance for a given xy-range and distance tolerance.
   * @param range range of planar region to tolerance.
   * @param distanceTolerance optional absolute distance tolerance. Default is [[Geometry.smallMetricDistance]].
   * @see [[computeMinimumArea]] for an area tolerance unscaled by geometry size, which is more widely applicable for degeneracy testing.
   */
  public static computeXYAreaTolerance(range: Range3d, distanceTolerance: number = Geometry.smallMetricDistance): number {
    // ensure the result is nonzero: we never want to report a zero-area loop as a signed-area loop
    if (distanceTolerance === 0)
      return Geometry.smallFloatingPoint * 10; // observed area 2e-15 computed for a zero-area loop
    // If A = bh and e is distance tolerance, let A' be the region with b and h extended by half the tolerance.
    // Then A' := (b+e/2)(h+e/2) = A + e/2(b+h+e/2), which motivates our area tol = A'-A = e/2(b+h+e/2).
    const halfDistTol = 0.5 * Math.abs(distanceTolerance);
    return halfDistTol * (range.xLength() + range.yLength() + halfDistTol);
  }
  /**
   * Return an area tolerance for a given distance tolerance.
   * * The result can be used to determine whether a region's area is small enough to be considered degenerate.
   * @param distanceTolerance optional minimum absolute distance between unique points. Default is [[Geometry.smallMetricDistance]].
   */
  public static computeMinimumArea(distanceTolerance: number = Geometry.smallMetricDistance): number {
    const areaTol = Math.PI * distanceTolerance * distanceTolerance;
    const minAreaTol = Geometry.smallFloatingPoint * 10; // observed area 2e-15 computed for a degenerate loop
    return areaTol < minAreaTol ? minAreaTol : areaTol;
  }

  /**
   * Return a (signed) xy area for a region.
   * * The input region should lie in a plane parallel to the xy-plane, as z-coords will be ignored.
   * * For a non-self-intersecting Loop, the returned area is negative if and only if the Loop is oriented clockwise
   * with respect to the positive z-axis.
   * @param region any [[Loop]], [[ParityRegion]], or [[UnionRegion]].
   */
  public static computeXYArea(region: AnyRegion): number | undefined {
    const handler = new RegionMomentsXY();
    const result = region.dispatchToGeometryHandler(handler);
    if (result instanceof MomentData) {
      return result.quantitySum;
    }
    return undefined;
  }
  /**
   * Return MomentData with the sums of wire moments.
   * * The caller can convert the return value `rawMomentData` to principal axes and moments with
   * `principalMomentData = MomentData.inertiaProductsToPrincipalAxes(rawMomentData.origin, rawMomentData.sums);`
   * * `rawMomentData.origin` is the wire centroid of `curve`.
   * * `rawMomentData.sums.weight()` is the signed length of `curve`.
   * @param curve any [[CurveCollection]] or [[CurvePrimitive]].
   */
  public static computeXYZWireMomentSums(curve: AnyCurve): MomentData | undefined {
    const handler = new CurveWireMomentsXYZ();
    handler.visitLeaves(curve);
    const result = handler.momentData;
    result.shiftOriginAndSumsToCentroidOfSums();
    return result;
  }
  /**
   * Return a [[Ray3d]] with:
   * * `origin` is the centroid of the region,
   * * `direction` is a unit vector perpendicular to the region plane,
   * * `a` is the region area.
   * @param region the region to process. Can lie in any plane.
   * @param result optional pre-allocated result to populate and return.
   */
  public static centroidAreaNormal(region: AnyRegion, result?: Ray3d): Ray3d | undefined {
    const localToWorld = FrameBuilder.createRightHandedFrame(undefined, region);
    if (!localToWorld)
      return undefined;
    const normal = localToWorld.matrix.columnZ(result?.direction);
    const regionIsXY = normal.isParallelTo(Vector3d.unitZ(), true);
    let regionXY: AnyRegion | undefined = region;
    if (!regionIsXY) { // rotate the region to be parallel to the xy-plane
      const worldToLocal = localToWorld.inverse();
      assert(worldToLocal !== undefined, "FrameBuilder's transform is invertible");
      regionXY = region.cloneTransformed(worldToLocal) as AnyRegion | undefined;
      if (!regionXY)
        return undefined;
    }
    const momentData = RegionOps.computeXYAreaMoments(regionXY);
    if (!momentData)
      return undefined;
    const centroid = momentData.origin.clone(result?.origin);
    if (!regionIsXY) // rotate centroid back (area is unchanged)
      localToWorld.multiplyPoint3d(centroid, centroid);
    else if (localToWorld.origin.z !== 0) // horizontal region needs vertical shift
      centroid.z += localToWorld.origin.z;

    let area = momentData.sums.weight();
    if (area < 0.0) {
      area = -area;
      normal.scale(-1.0, normal);
    }
    if (!result)
      result = Ray3d.createCapture(centroid, normal);
    result.a = area;
    return result;
  }
  /**
   * Create loops in the graph.
   * @internal
   */
  public static addLoopsToGraph(
    graph: HalfEdgeGraph,
    data: MultiLineStringDataVariant,
    announceIsolatedLoop: (graph: HalfEdgeGraph, seed: HalfEdge) => void,
  ): void {
    if (data instanceof Loop) {
      const points = data.getPackedStrokes();
      if (points)
        this.addLoopsToGraph(graph, points, announceIsolatedLoop);
    } else if (data instanceof ParityRegion) {
      for (const child of data.children) {
        const points = child.getPackedStrokes();
        if (points)
          this.addLoopsToGraph(graph, points, announceIsolatedLoop);
      }
    } else if (data instanceof IndexedXYZCollection) {
      const loopSeed = Triangulator.directCreateFaceLoopFromCoordinates(graph, data);
      if (loopSeed !== undefined)
        announceIsolatedLoop(graph, loopSeed);
    } else if (Array.isArray(data)) {
      if (data.length > 0) {
        if (Point3d.isAnyImmediatePointType(data[0])) {
          const loopSeed = Triangulator.directCreateFaceLoopFromCoordinates(graph, data as LineStringDataVariant);
          if (loopSeed !== undefined)
            announceIsolatedLoop(graph, loopSeed);

        } else if (data[0] instanceof IndexedXYZCollection) {
          for (const loop of data) {
            const loopSeed = Triangulator.directCreateFaceLoopFromCoordinates(graph, loop as IndexedXYZCollection);
            if (loopSeed !== undefined)
              announceIsolatedLoop(graph, loopSeed);
          }
        } else {
          for (const child of data) {
            if (Array.isArray(child))
              this.addLoopsToGraph(graph, child as MultiLineStringDataVariant, announceIsolatedLoop);
          }
        }
      }
    }
  }
  /**
   * Add multiple loops to a graph.
   * * Apply edgeTag and mask to each edge.
   * @internal
   */
  public static addLoopsWithEdgeTagToGraph(
    graph: HalfEdgeGraph, data: MultiLineStringDataVariant, mask: HalfEdgeMask, edgeTag: any,
  ): HalfEdge[] | undefined {
    const loopSeeds: HalfEdge[] = [];
    this.addLoopsToGraph(graph, data, (_graph: HalfEdgeGraph, seed: HalfEdge) => {
      if (seed) {
        loopSeeds.push(seed);
        seed.setMaskAndEdgeTagAroundFace(mask, edgeTag, true);
      }
    });
    if (loopSeeds.length > 0)
      return loopSeeds;
    return undefined;
  }
  /**
   * Given a graph just produced by booleans, convert to a polyface
   * * "just produced" implies exterior face markup.
   * @param graph
   * @param triangulate
   */
  private static finishGraphToPolyface(graph: HalfEdgeGraph | undefined, triangulate: boolean): Polyface | undefined {
    if (graph) {
      if (triangulate) {
        Triangulator.triangulateAllPositiveAreaFaces(graph);
        Triangulator.flipTriangles(graph);
      }
      return PolyfaceBuilder.graphToPolyface(graph);
    }
    return undefined;
  }
  /**
   * Return a polyface containing the area intersection of two XY regions.
   * * Within each region, in and out is determined by parity rules.
   *   * Any face that is an odd number of crossings from the far outside is IN
   *   * Any face that is an even number of crossings from the far outside is OUT
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   * @param triangulate whether to triangulate the result
   */
  public static polygonXYAreaIntersectLoopsToPolyface(
    loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant, triangulate: boolean = false,
  ): Polyface | undefined {
    const graph = RegionOpsFaceToFaceSearch.doPolygonBoolean(
      loopsA,
      loopsB,
      (inA: boolean, inB: boolean) => (inA && inB),
      this._graphCheckPointFunction,
    );
    return this.finishGraphToPolyface(graph, triangulate);
  }
  /**
   * Return a polyface containing the area union of two XY regions.
   * * Within each region, in and out is determined by parity rules.
   *   * Any face that is an odd number of crossings from the far outside is IN
   *   * Any face that is an even number of crossings from the far outside is OUT
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   * @param triangulate whether to triangulate the result
   */
  public static polygonXYAreaUnionLoopsToPolyface(
    loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant, triangulate: boolean = false,
  ): Polyface | undefined {
    const graph = RegionOpsFaceToFaceSearch.doPolygonBoolean(
      loopsA,
      loopsB,
      (inA: boolean, inB: boolean) => (inA || inB),
      this._graphCheckPointFunction,
    );
    return this.finishGraphToPolyface(graph, triangulate);
  }
  /**
   * Return a polyface containing the area difference of two XY regions.
   * * Within each region, in and out is determined by parity rules.
   *   * Any face that is an odd number of crossings from the far outside is IN
   *   * Any face that is an even number of crossings from the far outside is OUT
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   * @param triangulate whether to triangulate the result
   */
  public static polygonXYAreaDifferenceLoopsToPolyface(
    loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant, triangulate: boolean = false,
  ): Polyface | undefined {
    const graph = RegionOpsFaceToFaceSearch.doPolygonBoolean(
      loopsA,
      loopsB,
      (inA: boolean, inB: boolean) => (inA && !inB),
      this._graphCheckPointFunction,
    );
    return this.finishGraphToPolyface(graph, triangulate);
  }
  /**
   * Return the region's simplest representation by stripping redundant parent(s).
   * * No Boolean operations are performed.
   * @param region input region (unchanged). Assumed to have at least one child.
   * @returns
   * * For a [[UnionRegion]] with exactly one child, return the child if it is a [[Loop]],
   * or if it is a [[ParityRegion]] with multiple children; otherwise return the `ParityRegion`'s `Loop`.
   * * For a `ParityRegion` with exactly one child, return the `Loop`.
   * * All other inputs returned unchanged.
   * @see [[simplifyRegion]]
   */
  public static simplifyRegionType(region: AnyRegion): AnyRegion {
    if (region instanceof UnionRegion) {
      if (region.children.length === 1)
        return this.simplifyRegionType(region.children[0]);
    } else if (region instanceof ParityRegion) {
      if (region.children.length === 1)
        return region.children[0];
    }
    return region;
  }
  /**
   * Simplify the region's parent/child hierarchy in place:
   * * Regions with exactly one child are simplified as per [[simplifyRegionType]].
   * * Regions without children are removed.
   * * No Boolean operations are performed.
   * @param region region to simplify in place
   * @returns reference to the updated input region, or `undefined` if no children.
   * @see [[simplifyRegionType]]
   */
  public static simplifyRegion(region: AnyRegion): AnyRegion | undefined {
    if (region instanceof Loop)
      return region.children.length > 0 ? region : undefined;
    // remove childless Parity/UnionRegion
    for (let i = 0; i < region.children.length; ++i) {
      const child = region.children[i];
      const newChild = this.simplifyRegion(child);
      if (!newChild) {
        region.children.splice(i--, 1);
      } else if (newChild !== child) {
        assert(!(newChild instanceof UnionRegion));
        region.children.splice(i--, 1, newChild);
      }
    }
    if (region.children.length === 0)
      return undefined;
    // remove redundant Parity/UnionRegion parent
    if (region.children.length === 1)
      return region.children.splice(0, 1)[0];
    return region;
  }
  /**
   * Helper method to sample a z-coordinate from the input region(s).
   * * The assumption is that the input is horizontal.
   */
  private static getZCoordinate(xyRegion: AnyRegion | AnyRegion[] | undefined): number {
    const localToWorld = FrameBuilder.createRightHandedFrame(undefined, xyRegion);
    return localToWorld ? localToWorld.origin.z : 0;
  }
  /** Convert overlapping enums, from public to internal. */
  private static convertToRegionGroupOpType(op?: RegionBinaryOpType): RegionGroupOpType {
    if (RegionBinaryOpType.Parity === op)
      return RegionGroupOpType.Parity;
    if (RegionBinaryOpType.Intersection === op)
      return RegionGroupOpType.Intersection;
    return RegionGroupOpType.Union;
  }

  /**
   * Return areas defined by a boolean operation.
   * @note For best results, input regions should have correctly oriented loops. See [[sortOuterAndHoleLoopsXY]].
   * @note A common use case of this method is to split (a region with) overlapping loops into a `UnionRegion` with
   * adjacent `Loop`s: `regionOut = RegionOps.regionBooleanXY(regionIn, undefined, RegionBinaryOpType.Union)`.
   * Such a union can be further simplified by passing the option `RegionBooleanXYOptions.simplifyUnion = true`.
   * @note By default, this method does not discover holes implicitly formed by input loops. For example, the union of
   * the four trapezoids that comprise a picture frame is not returned as a [[ParityRegion]] unless the option
   * `simplifyUnion = true`.
   * @param loopsA first set of loops (treated as a union)
   * @param loopsB second set of loops (treated as a union)
   * @param operation indicates Union, Intersection, Parity, AMinusB, or BMinusA
   * @param mergeToleranceOrOptions absolute distance tolerance for merging loops, or multiple options settings. Default value is [[Geometry.smallMetricDistance]].
   * @returns a region resulting from merging input loops and the boolean operation.
   */
  public static regionBooleanXY(
    loopsA: AnyRegion | AnyRegion[] | undefined,
    loopsB: AnyRegion | AnyRegion[] | undefined,
    operation: RegionBinaryOpType,
    mergeToleranceOrOptions: number | RegionBooleanXYOptions = Geometry.smallMetricDistance,
  ): AnyRegion | undefined {
    const optionIsNumber = typeof mergeToleranceOrOptions === "number";
    const mergeTolerance = optionIsNumber ? mergeToleranceOrOptions : mergeToleranceOrOptions.mergeTolerance ?? Geometry.smallMetricDistance;
    const simplifyUnion = optionIsNumber ? false : mergeToleranceOrOptions.simplifyUnion ?? false;
    const operationGroupA = optionIsNumber ? RegionGroupOpType.Union : RegionOps.convertToRegionGroupOpType(mergeToleranceOrOptions.operationGroupA);
    const operationGroupB = optionIsNumber ? RegionGroupOpType.Union : RegionOps.convertToRegionGroupOpType(mergeToleranceOrOptions.operationGroupB);
    let result: AnyRegion | undefined;
    const context = RegionBooleanContext.create(operationGroupA, operationGroupB);
    context.addMembers(loopsA, loopsB);
    context.annotateAndMergeCurvesInGraph(mergeTolerance);
    const bridgeMask = HalfEdgeMask.BRIDGE_EDGE;
    const visitMask = context.graph.grabMask(false);
    // use our own outMask: we cannot use EXTERIOR as sweep clears it before processing each component
    const outMask = simplifyUnion ? context.graph.grabMask(false) : HalfEdgeMask.NULL_MASK;
    const outSeeds: HalfEdge[] | undefined = simplifyUnion ? [] : undefined;
    context.graph.clearMask(visitMask | outMask);
    const areaTol = this.computeMinimumArea(mergeTolerance);
    const z = RegionOps.getZCoordinate(operation === RegionBinaryOpType.BMinusA ? loopsB : loopsA);
    const options: PlanarSubdivision.CreateRegionInFaceOptions = { compress: true, closureTol: mergeTolerance, bridgeMask, visitMask, z };
    let numFacesIn = 0;
    context.runClassificationSweep(
      operation,
      (_graph, face: HalfEdge, faceType: -1 | 0 | 1, area: number) => {
        // ignore danglers and null faces, but not 2-edge "banana" faces with nonzero area
        if (face.countEdgesAroundFace() < 2)
          return;
        if (Math.abs(area) < areaTol)
          return;
        if (simplifyUnion) { // process the outer/negative faces later
          if (faceType === 1) {
            numFacesIn++;
          } else {
            face.setMaskAroundFace(outMask);
            outSeeds?.push(face);
          }
        } else if (faceType === 1) { // collect the inner faces now
          const loopOrParityRegion = PlanarSubdivision.createLoopOrParityRegionInFace(face, options);
          if (loopOrParityRegion) {
            if (!result)
              result = UnionRegion.create();
            if (result.tryAddChild(loopOrParityRegion))
              numFacesIn++;
          }
        }
      },
    );
    // the outer faces are marked; now we collect their boundary super face loops and sort them
    if (simplifyUnion && numFacesIn > 0 && outSeeds && outSeeds.length > 0) {
      context.graph.clearMask(visitMask);
      const outLoops: Loop[] = [];
      for (const outSeed of outSeeds) {
        const superFace: HalfEdge[] = [];
        const skipEdge = (he: HalfEdge) => he.isMaskSet(visitMask) || !he.isMaskSet(outMask) || he.edgeMate.isMaskSet(outMask);
        const announceEdge = (he: HalfEdge) => superFace.push(he);
        if (outSeed.announceEdgesInSuperFace(skipEdge, announceEdge)) {
          superFace.forEach((he: HalfEdge) => he.setMask(visitMask));
          const outLoop = PlanarSubdivision.createLoopInFace(superFace, options);
          if (outLoop)
            outLoops.push(outLoop);
        }
      }
      result = this.sortOuterAndHoleLoopsXY(outLoops);
    }
    context.graph.dropMask(visitMask | outMask);
    return result ? this.simplifyRegion(result) : undefined;
  }
  /**
   * Return a polyface whose facets are a boolean operation between the input regions.
   * * Each of the two inputs is an array of multiple loops or parity regions.
   *   * Within each of these input arrays, the various entries (loop or set of loops) are interpreted as a union.
   * * In each "array of loops and parity regions", each entry inputA[i] or inputB[i] is one of:
   *    * A simple loop, e.g. array of Point3d.
   *    * Several simple loops, each of which is an array of Point3d.
   * @param inputA first set of loops
   * @param operation indicates Union, Intersection, Parity, AMinusB, or BMinusA
   * @param inputB second set of loops
   * @param triangulate whether to triangulate the result
   */
  public static polygonBooleanXYToPolyface(
    inputA: MultiLineStringDataVariant[],
    operation: RegionBinaryOpType,
    inputB: MultiLineStringDataVariant[],
    triangulate: boolean = false,
  ): Polyface | undefined {
    const graph = RegionOpsFaceToFaceSearch.doBinaryBooleanBetweenMultiLoopInputs(
      inputA, RegionGroupOpType.Union,
      operation,
      inputB, RegionGroupOpType.Union,
      true,
    );
    return this.finishGraphToPolyface(graph, triangulate);
  }
  /**
   * Return loops of linestrings around areas of a boolean operation between the input regions.
   * * Each of the two inputs is an array of multiple loops or parity regions.
   *   * Within each of these input arrays, the various entries (loop or set of loops) are interpreted as a union.
   * * In each "array of loops and parity regions", each entry inputA[i] or inputB[i] is one of:
   *    * A simple loop, e.g. array of Point3d.
   *    * Several simple loops, each of which is an array of Point3d.
   * @param inputA first set of loops
   * @param operation indicates Union, Intersection, Parity, AMinusB, or BMinusA
   * @param inputB second set of loops
   */
  public static polygonBooleanXYToLoops(
    inputA: MultiLineStringDataVariant[],
    operation: RegionBinaryOpType,
    inputB: MultiLineStringDataVariant[],
  ): AnyRegion | undefined {
    const graph = RegionOpsFaceToFaceSearch.doBinaryBooleanBetweenMultiLoopInputs(
      inputA,
      RegionGroupOpType.Union,
      operation,
      inputB,
      RegionGroupOpType.Union,
      true,
    );
    if (!graph)
      return undefined;
    const loopEdges = HalfEdgeGraphSearch.collectExtendedBoundaryLoopsInGraph(graph, HalfEdgeMask.EXTERIOR);
    const allLoops: Loop[] = [];
    for (const graphLoop of loopEdges) {
      const points = new GrowableXYZArray();
      for (const edge of graphLoop)
        points.pushXYZ(edge.x, edge.y, edge.z);
      points.pushWrap(1);
      const loop = Loop.create();
      loop.tryAddChild(LineString3d.createCapture(points));
      allLoops.push(loop);
    }
    return RegionOps.sortOuterAndHoleLoopsXY(allLoops);
  }
  /**
   * Construct a wire that is offset from the given polyline or polygon.
   * * This is a simple wire offset, not an area offset.
   * * Since z-coordinates are ignored, for best results the input points should lie in (a plane parallel to)
   * the xy-plane.
   * * The construction algorithm attempts to eliminate some self-intersections within the offsets, but does not
   * guarantee a simple area offset.
   * @param points a single loop or path
   * @param wrap true to include wraparound
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or JointOptions
   * object.
   */
  public static constructPolygonWireXYOffset(
    points: Point3d[], wrap: boolean, offsetDistanceOrOptions: number | JointOptions,
  ): CurveChain | undefined {
    const context = new PolygonWireOffsetContext();
    return context.constructPolygonWireXYOffset(points, wrap, offsetDistanceOrOptions);
  }
  /**
   * Construct curves that are offset from a Path or Loop as viewed in xy-plane (ignoring z).
   * * The construction will remove "some" local effects of features smaller than the offset distance, but will
   * not detect self intersection among widely separated edges.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/Offset
   * @param curves base curves.
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object.
   */
  public static constructCurveXYOffset(
    curves: Path | Loop, offsetDistanceOrOptions: number | JointOptions | OffsetOptions,
  ): CurveCollection | undefined {
    const offsetOptions = OffsetOptions.create(offsetDistanceOrOptions);
    return CurveOps.constructCurveXYOffset(curves, offsetOptions);
  }
  /**
   * Test if point (x,y) is IN, OUT or ON a region.
   * @return (1) for in, (-1) for OUT, (0) for ON
   * @param curves input region
   * @param x x coordinate of point to test
   * @param y y coordinate of point to test
   */
  public static testPointInOnOutRegionXY(curves: AnyRegion, x: number, y: number): number {
    return PointInOnOutContext.testPointInOnOutRegionXY(curves, x, y);
  }
  /**
   * Create curve collection of subtype determined by gaps between the input curves.
   * * If (a) wrap is requested and (b) all curves connect head-to-tail (including wraparound), assemble as a `loop`.
   * * If all curves connect head-to-tail except for closure, return a `Path`.
   * * If there are internal gaps, return a `BagOfCurves`
   * * If input array has zero length, return undefined.
   * @param curves input curves
   * @param wrap whether to create a Loop (true) or Path (false) if maximum gap is minimal
   * @param consolidateAdjacentPrimitives whether to simplify the result by calling [[consolidateAdjacentPrimitives]]
   */
  public static createLoopPathOrBagOfCurves(
    curves: CurvePrimitive[], wrap: boolean = true, consolidateAdjacentPrimitives: boolean = false,
  ): CurveCollection | undefined {
    const n = curves.length;
    if (n === 0)
      return undefined;
    let maxGap = 0.0;
    let isPath = false;
    if (wrap)
      maxGap = Geometry.maxXY(maxGap, curves[0].startPoint().distance(curves[n - 1].endPoint()));
    for (let i = 0; i + 1 < n; i++)
      maxGap = Geometry.maxXY(maxGap, curves[i].endPoint().distance(curves[i + 1].startPoint()));
    let collection: Loop | Path | BagOfCurves;
    if (Geometry.isSmallMetricDistance(maxGap)) {
      collection = wrap ? Loop.create() : Path.create();
      isPath = true;
    } else {
      collection = BagOfCurves.create();
    }
    for (const c of curves)
      collection.tryAddChild(c);
    if (isPath && consolidateAdjacentPrimitives)
      RegionOps.consolidateAdjacentPrimitives(collection);
    return collection;
  }
  private static _graphCheckPointFunction?: GraphCheckPointFunction;
  /**
   * Announce Checkpoint function for use during booleans
   * @internal
   */
  public static setCheckPointFunction(f?: GraphCheckPointFunction) {
    this._graphCheckPointFunction = f;
  }
  /**
   * Find all intersections among curves in `curvesToCut` and `cutterCurves` and return fragments of `curvesToCut`.
   * * For a `Loop`, `ParityRegion`, or `UnionRegion` in `curvesToCut`:
   *    * if it is never cut by any `cutter` curve, it will be left unchanged.
   *    * if cut, the input is downgraded to a set of `Path` curves joining at the cut points.
   * * All cutting is "as viewed in the xy plane"
   * @param curvesToCut input curves to be fragmented at intersections with `cutterCurves`
   * @param cutterCurves input curves to intersect with `curvesToCut`
   */
  public static cloneCurvesWithXYSplits(
    curvesToCut: AnyCurve | undefined, cutterCurves: CurveCollection,
  ): AnyCurve | undefined {
    return CurveSplitContext.cloneCurvesWithXYSplits(curvesToCut, cutterCurves);
  }
  /**
   * Create paths assembled from many curves.
   * * Assemble paths from consecutive curves NOT separated by either gaps or the split markup set by
   * [[cloneCurvesWithXYSplits]].
   * * Return simplest form -- single primitive, single path, or bag of curves.
   */
  public static splitToPathsBetweenBreaks(source: AnyCurve | undefined, makeClones: boolean): AnyChain | undefined {
    if (source === undefined)
      return undefined;
    if (source instanceof CurvePrimitive)
      return source;
    // source is a collection .  ..
    const primitives = source.collectCurvePrimitives();
    const chainCollector = new ChainCollectorContext(makeClones);
    for (const primitive of primitives) {
      chainCollector.announceCurvePrimitive(primitive);
    }
    return chainCollector.grabResult();
  }
  /**
   * Restructure curve fragments as Paths and Loops, and construct xy-offsets of the chains.
   * * If the inputs do not form Loop(s), the classification of offsets is suspect.
   * * For best offset results, the inputs should be parallel to the xy-plane.
   * @param fragments fragments to be chained and offset
   * @param offsetDistance offset distance, applied to both sides of each fragment to produce inside and outside xy-offset curves.
   * @param gapTolerance distance to be treated as "effectively zero" when assembling fragments head-to-tail
   * @returns object with named chains, insideOffsets, outsideOffsets
   */
  public static collectInsideAndOutsideOffsets(
    fragments: AnyCurve[], offsetDistance: number, gapTolerance: number,
  ): { insideOffsets: AnyCurve[], outsideOffsets: AnyCurve[], chains?: AnyChain } {
    return CurveOps.collectInsideAndOutsideXYOffsets(fragments, offsetDistance, gapTolerance);
  }
  /**
   * Restructure curve fragments as Paths and Loops.
   * @param fragments fragments to be chained
   * @param gapTolerance distance to be treated as "effectively zero" when assembling fragments head-to-tail
   * @returns chains, possibly wrapped in a [[BagOfCurves]].
   */
  public static collectChains(fragments: AnyCurve[], gapTolerance: number = Geometry.smallMetricDistance): AnyChain | undefined {
    return CurveOps.collectChains(fragments, gapTolerance);
  }
  /**
   * Find all intersections among curves in `curvesToCut` against the boundaries of `region` and return fragments
   * of `curvesToCut`.
   * * Break `curvesToCut` into parts inside, outside, and coincident.
   * @returns output object with all fragments split among `insideParts`, `outsideParts`, and `coincidentParts`
   */
  public static splitPathsByRegionInOnOutXY(
    curvesToCut: AnyCurve | undefined, region: AnyRegion,
  ): { insideParts: AnyCurve[], outsideParts: AnyCurve[], coincidentParts: AnyCurve[] } {
    const result = { insideParts: [], outsideParts: [], coincidentParts: [] };
    const pathWithIntersectionMarkup = RegionOps.cloneCurvesWithXYSplits(curvesToCut, region);
    const splitPaths = RegionOps.splitToPathsBetweenBreaks(pathWithIntersectionMarkup, true);
    if (splitPaths instanceof CurveCollection) {
      for (const child of splitPaths.children) {
        const pointOnChild = CurveCollection.createCurveLocationDetailOnAnyCurvePrimitive(child);
        if (pointOnChild) {
          const inOnOut = RegionOps.testPointInOnOutRegionXY(region, pointOnChild.point.x, pointOnChild.point.y);
          pushToInOnOutArrays(child, inOnOut, result.outsideParts, result.coincidentParts, result.insideParts);
        }
      }
    } else if (splitPaths instanceof CurvePrimitive) {
      const pointOnChild = CurveCollection.createCurveLocationDetailOnAnyCurvePrimitive(splitPaths);
      if (pointOnChild) {
        const inOnOut = RegionOps.testPointInOnOutRegionXY(region, pointOnChild.point.x, pointOnChild.point.y);
        pushToInOnOutArrays(splitPaths, inOnOut, result.outsideParts, result.coincidentParts, result.insideParts);
      }
    }
    return result;
  }
  /**
   * If `data` is one of several forms of a rectangle, return its edge Transform.
   * * Points are considered a rectangle if, within the first 4 points:
   *     * vectors from 0 to 1 and 0 to 3 are perpendicular and have a non-zero cross product
   *     * vectors from 0 to 3 and 1 to 2 are the same
   * @param data points in one of several formats:
   *   * LineString
   *   * Loop containing rectangle content
   *   * Path containing rectangle content
   *   * Array of Point3d[]
   *   * IndexedXYZCollection
   * @param requireClosurePoint whether to require a 5th point equal to the 1st point.
   * @returns Transform with origin at one corner, x and y columns extending along two adjacent sides, and unit
   * normal in z column. If not a rectangle, return undefined.
   */
  public static rectangleEdgeTransform(
    data: AnyCurve | Point3d[] | IndexedXYZCollection, requireClosurePoint: boolean = true,
  ): Transform | undefined {
    if (data instanceof LineString3d) {
      return this.rectangleEdgeTransform(data.packedPoints);
    } else if (data instanceof IndexedXYZCollection) {
      let dataToUse;
      if (requireClosurePoint && data.length === 5) {
        if (!data.almostEqualUncheckedIndexIndex(0, 4))
          return undefined;
        dataToUse = data;
      } else if (!requireClosurePoint && data.length === 4) {
        dataToUse = data;
      } else if (data.length < (requireClosurePoint ? 5 : 4)) {
        return undefined;
      } else {
        dataToUse = GrowableXYZArray.create(data);
        PolylineCompressionContext.compressInPlaceByShortEdgeLength(dataToUse, Geometry.smallMetricDistance);
        if (dataToUse.length < (requireClosurePoint ? 5 : 4))
          return undefined;
      }
      assert(dataToUse.length >= 4, "expect at least 4 points in dataToUse");
      const vector01 = dataToUse.vectorUncheckedIndexIndex(0, 1);
      const vector03 = dataToUse.vectorUncheckedIndexIndex(0, 3);
      const vector12 = dataToUse.vectorUncheckedIndexIndex(1, 2);
      const normalVector = vector01.crossProduct(vector03);
      if (normalVector.normalizeInPlace()
        && vector12.isAlmostEqual(vector03)
        && vector01.isPerpendicularTo(vector03)) {
        return Transform.createOriginAndMatrixColumns(
          dataToUse.getPoint3dAtUncheckedPointIndex(0), vector01, vector03, normalVector,
        );
      }
    } else if (Array.isArray(data)) {
      return this.rectangleEdgeTransform(new Point3dArrayCarrier(data), requireClosurePoint);
    } else if (data instanceof Loop && data.children.length === 1 && data.children[0] instanceof LineString3d) {
      return this.rectangleEdgeTransform(data.children[0].packedPoints, true);
    } else if (data instanceof Path && data.children.length === 1 && data.children[0] instanceof LineString3d) {
      return this.rectangleEdgeTransform(data.children[0].packedPoints, requireClosurePoint);
    } else if (data instanceof CurveChain) {
      if (!data.checkForNonLinearPrimitives()) {
        // const linestring = LineString3d.create();
        const strokes = data.getPackedStrokes();
        if (strokes) {
          return this.rectangleEdgeTransform(strokes);
        }
      }
    }
    return undefined;
  }
  /**
   * Look for and simplify:
   * * Contiguous [[LineSegment3d]] and [[LineString3d]] objects:
   *   * collect all points
   *   * eliminate duplicated points
   *   * eliminate points colinear with surrounding points
   * * Contiguous concentric circular or elliptic [[Arc3d]] objects:
   *   * combine angular ranges
   * * This function can be used to compress adjacent [[LineSegment3d]]s into a [[LineString3d]].
   * @param curves Path or loop (or larger collection containing paths and loops) to be simplified
   * @param options options for tolerance and selective simplification.
   */
  public static consolidateAdjacentPrimitives(curves: CurveCollection, options?: ConsolidateAdjacentCurvePrimitivesOptions): void {
    const context = new ConsolidateAdjacentCurvePrimitivesContext(options);
    curves.dispatchToGeometryHandler(context);
  }
  /**
   * Reverse and reorder loops in the xy-plane for consistent orientation and containment.
   * @param loops multiple loops in any order and orientation, z-coordinates ignored.
   * * For best results, all overlaps should be containments, i.e., loop boundaries can touch, but should not cross.
   * @returns a region that captures the input pointers. This region is a:
   * * [[Loop]] if there is exactly one input loop. It is oriented counterclockwise.
   * * [[ParityRegion]] if input consists of exactly one outer loop with at least one hole loop.
   * Its first child is an outer loop oriented counterclockwise; all subsequent children are holes oriented
   * clockwise.
   * * [[UnionRegion]] if any other input configuration. Its children are individually ordered/oriented as in
   * the above cases.
   * @see [[PolygonOps.sortOuterAndHoleLoopsXY]]
   */
  public static sortOuterAndHoleLoopsXY(loops: Array<Loop | IndexedXYZCollection>): AnyRegion {
    const loopAndArea: SortablePolygon[] = [];
    for (const candidate of loops) {
      if (candidate instanceof Loop)
        SortablePolygon.pushLoop(loopAndArea, candidate);
      else if (candidate instanceof IndexedXYZCollection) {
        const loop = Loop.createPolygon(candidate);
        SortablePolygon.pushLoop(loopAndArea, loop);
      }
    }
    return SortablePolygon.sortAsAnyRegion(loopAndArea);
  }

  /**
   * Compare two edges' geometry from CurveLocationDetail edge tags.
   * @returns an object with following properties:
   * * sameCurves: whether the edges' curve definitions are equivalent.
   * * reversedCurves: whether the edges' curve definitions are equivalent after reversing one of them.
   * * senseEdge0/1: whether the topological edge is oriented in the same direction as the curve geometry, or the opposite direction.
   */
  private static getEdgeGeometry(edge0: HalfEdge, edge1: HalfEdge): { sameCurves: boolean, reversedCurves: boolean, senseEdge0: boolean, senseEdge1: boolean } {
    let sameCurves = false;
    let reversedCurves = false;
    let senseEdge0 = false;
    let senseEdge1 = false;
    if (edge0.edgeTag instanceof CurveLocationDetail && edge0.edgeTag.curve !== undefined && edge0.edgeTag.isInterval() && edge0.sortData &&
      edge1.edgeTag instanceof CurveLocationDetail && edge1.edgeTag.curve !== undefined && edge1.edgeTag.isInterval() && edge1.sortData
    ) {
      sameCurves = edge0.edgeTag.curve === edge1.edgeTag.curve || edge0.edgeTag.curve.isAlmostEqual(edge1.edgeTag.curve);
      reversedCurves = !sameCurves && edge0.edgeTag.curve.isAlmostEqual(edge1.edgeTag.curve.clone().reverse());
      senseEdge0 = edge0.sortData > 0;
      senseEdge1 = edge1.sortData > 0;
    }
    return { sameCurves, reversedCurves, senseEdge0, senseEdge1 };
  }

  /**
   * Compare two edges' orientations. They do not have to be adjacent.
   * * Requires CurveLocationDetail edge tags.
   * @returns an object with following properties:
   * * diametric: whether edges have same/reversed curves and are oriented diametrically opposite each other.
   * * reversedCurves: whether the underlying curve definitions are reversed.
   * * senseEdge0/1: whether the topological edge is oriented in the same direction as the curve geometry, or the opposite direction.
   */
  private static areEdgesDiametric(edge0: HalfEdge, edge1: HalfEdge): { diametric: boolean, reversedCurves: boolean, senseEdge0: boolean, senseEdge1: boolean } {
    let diametric = false;
    let reversedCurves = false;
    let senseEdge0 = false;
    let senseEdge1 = false;
    if (edge0 !== edge1) {
      const data = RegionOps.getEdgeGeometry(edge0, edge1);
      reversedCurves = data.reversedCurves;
      senseEdge0 = data.senseEdge0;
      senseEdge1 = data.senseEdge1;
      diametric = (data.sameCurves && (senseEdge0 !== senseEdge1)) || (reversedCurves && (senseEdge0 === senseEdge1));
    }
    return { diametric, reversedCurves, senseEdge0, senseEdge1 };
  }

  /**
   * Determine if the edges at a vertex were created by splitting an edge or null face.
   * * Requires CurveLocationDetail edge tags.
   * @param he an edge created by the split operation.
   * @param vs another edge at the same vertex. If undefined, use `vs = he.vertexSuccessor` and check for a
   * degree-2 vertex (e.g., split edge); otherwise, ignore the degree check (e.g., inputs are a null face pair).
   */
  private static isHealableEdgeOrNullFace(he: HalfEdge, vs?: HalfEdge): boolean {
    if (vs) {
      if (!he.findAroundVertex(vs))
        return false;
    } else {
      vs = he.vertexSuccessor;
      if (vs.vertexSuccessor !== he)
        return false; // not a split edge
    }
    const directionData = RegionOps.areEdgesDiametric(he, vs);
    if (!directionData.diametric)
      return false;
    const heVertexFraction = directionData.senseEdge0 ? he.edgeTag.fraction : he.edgeTag.fraction1;
    let vsVertexFraction = directionData.senseEdge1 ? vs.edgeTag.fraction : vs.edgeTag.fraction1;
    if (directionData.reversedCurves)
      vsVertexFraction = 1.0 - vsVertexFraction;
    return Geometry.isSmallRelative(heVertexFraction - vsVertexFraction); // unrelated vertex fractions are not healable
  }

  /**
   * Determine if the vertex loop resulted from splitting a null face into two null faces (and thus can be healed).
   * * Requires CurveLocationDetail edge tags.
   * * If there are multiple null faces at the vertex (a null face bundle), they must be adjacent and positioned in
   * diametrically opposite pairs, each of which resulted from splitting a null face. This implies there are exactly
   * two non-null faces opposite each other in the vertex loop.
   * @returns an object with properties:
   * * isHealable: whether the input is a healable vertex loop in a null face bundle
   * * nullFacePairs: if `isHealable` is true, an array of the matching null face pairs around the vertex.
   */
  private static isHealableNullFaceBundle(vertex: HalfEdge): { isHealable: boolean, nullFacePairs?: [HalfEdge, HalfEdge][] } {
    const nonNullFaceIndex: number[] = [];
    const vertexLoop: HalfEdge[] = [];
    // lambda: null face detector, with curve check to rule out banana faces
    const isNullFace = (face: HalfEdge): boolean => {
      const fSucc = face.faceSuccessor;
      return (fSucc.faceSuccessor === face) && RegionOps.areEdgesDiametric(face, fSucc).diametric;
    };
    vertex.announceEdgesAroundVertex((e: HalfEdge) => {
      if (!isNullFace(e))
        nonNullFaceIndex.push(vertexLoop.length);
      vertexLoop.push(e);
    });
    const degree = vertexLoop.length;
    if (degree < 4 || nonNullFaceIndex.length !== 2 || Geometry.modulo(degree, 2) > 0)
      return { isHealable: false };
    const iNonNull0 = nonNullFaceIndex[0];
    if (nonNullFaceIndex[1] - iNonNull0 !== degree / 2)
      return { isHealable: false };
    const nullFacePairs: [HalfEdge, HalfEdge][] = [];
    for (let i = 1; i < degree / 2; i++) {
      const iNullFace = Geometry.modulo(iNonNull0 + i, degree);
      const iMatchingNullFace = Geometry.modulo(2 * iNonNull0 - iNullFace, degree);
      if (!RegionOps.isHealableEdgeOrNullFace(vertexLoop[iNullFace], vertexLoop[iMatchingNullFace]))
        return { isHealable: false };
      nullFacePairs.push([vertexLoop[iNullFace], vertexLoop[iMatchingNullFace]]);
    }
    return { isHealable: true, nullFacePairs };
  }

  /** Heal a split edge by removing the redundant vertex loop and extending the surviving curve details. */
  private static healSplitEdgeAndCurve(v: HalfEdge): void {
    const vs = v.vertexSuccessor;
    const fPred = HalfEdge.healEdge(v, false);
    if (!fPred)
      return;
    // lambda to extend the surviving node's curve interval. Inputs are on the same side of the healed edge.
    const extendDetailInterval = (doomed: HalfEdge, survivor: HalfEdge): void => {
      const doomedData = RegionOps.getEdgeGeometry(doomed, survivor);
      assert(doomedData.sameCurves || doomedData.reversedCurves, "expect related curves");
      let newEndFraction = doomedData.senseEdge0 ? doomed.edgeTag.fraction1 : doomed.edgeTag.fraction;
      if (doomedData.reversedCurves)
        newEndFraction = 1.0 - newEndFraction;
      const newEndPoint = doomedData.senseEdge0 ? doomed.edgeTag.point1 : doomed.edgeTag.point;
      if (doomedData.senseEdge1)
        survivor.edgeTag.captureFraction1Point1(newEndFraction, newEndPoint);
      else
        survivor.edgeTag.captureFractionPoint(newEndFraction, newEndPoint);
    };
    extendDetailInterval(v, fPred);
    extendDetailInterval(vs, fPred.edgeMate);
  }

  /**
   * Disconnect extraneous bridge edges, which remain in the graph as isolated edges.
   * @param graph half edges to process.
   * @param isBridgeEdge optional callback to identify a bridge edge.
   * @param faceToArea optional callback to compute face area.
   * @returns array of surviving vertices formerly adjacent to the isolated bridge edges (e.g., for the caller to heal).
   */
  private static isolateExtraneousBridgeEdges(graph: HalfEdgeGraph, isBridgeEdge: HalfEdgeToBooleanFunction, faceToArea: HalfEdgeToNumberFunction): HalfEdge[] {
    const toHeal: HalfEdge[] = [];
    const interiorBridges: HalfEdge[] = [];
    const isolateBridgeEdge = (edge: HalfEdge): void => {
      if (!edge.isDangling)
        toHeal.push(edge.vertexSuccessor);
      if (!edge.edgeMate.isDangling)
        toHeal.push(edge.edgeMate.vertexSuccessor);
      edge.isolateEdge();
    };
    // isolate dangling bridges, bridges separating different faces, and "exterior" bridges in the negative area face
    graph.announceEdges((_g: HalfEdgeGraph, node: HalfEdge): boolean => {
      if (isBridgeEdge(node)) {
        if (node.isDangling || node.edgeMate.isDangling || !node.findAroundFace(node.edgeMate) || faceToArea(node) < 0.0)
          isolateBridgeEdge(node);
        else
          interiorBridges.push(node);
      }
      return true;
    });
    // lambda: check if a non-isolated interior bridge edge is extraneous, relying solely on face loop orientation (not HalfEdgeMasks!)
    const isBridgeEdgeExtraneous = (node: HalfEdge): boolean => {
      if (node.isIsolatedEdge)
        return false; // already extraneous
      if (faceToArea(node) < 0.0)
        return true; // exterior face
      if (node.findAroundFace(node.edgeMate))
        return false; // interior washer face
      return faceToArea(node.edgeMate) < 0.0; // adjacent to exterior face
    };
    // All bridges in the negative area face were isolated, but this may have caused surviving bridges to become extraneous
    // (e.g., by swelling the negative area face around them). Keep isolating these bridge edges until none remain.
    let numIsolatedThisPass: number;
    do {
      numIsolatedThisPass = 0;
      for (const node of interiorBridges) {
        if (isBridgeEdgeExtraneous(node)) {
          isolateBridgeEdge(node);
          numIsolatedThisPass++;
        }
      }
    } while (numIsolatedThisPass > 0);
    return toHeal.filter((edge: HalfEdge) => !edge.isIsolatedEdge);
  }
  /**
   * Simplify the graph by removing bridge edges that do not serve to connect inner and outer loops.
   * * If edgeTags are `CurveLocationDetail`s, e.g., as set by `PlanarSubdivision.assembleHalfEdgeGraph`, attempt to heal edges split by removed bridge edges.
   * @param graph half edges to process.
   * @param isBridgeEdge optional callback to identify a bridge edge. Default looks for `HalfEdgeMask.BRIDGE_EDGE`.
   * @param faceToArea optional callback to compute face area. Default is `HalfEdgeGraphSearch.signedFaceArea`.
   * @returns the number of extraneous bridge edges removed from the graph.
   * @internal
   */
  public static removeExtraneousBridgeEdges(graph: HalfEdgeGraph, isBridgeEdge?: HalfEdgeToBooleanFunction, faceToArea?: HalfEdgeToNumberFunction): number {
    if (!faceToArea)
      faceToArea = (node: HalfEdge) => HalfEdgeGraphSearch.signedFaceArea(node);
    if (!isBridgeEdge)
      isBridgeEdge = (node: HalfEdge): boolean => node.isMaskSet(HalfEdgeMask.BRIDGE_EDGE);
    const toHeal = RegionOps.isolateExtraneousBridgeEdges(graph, isBridgeEdge, faceToArea);
    // clean up the isolated bridge edges' original vertex loops, if possible
    for (const vertex of toHeal) {
      if (vertex.isDangling || vertex.isIsolatedEdge)
        continue;
      if (RegionOps.isHealableEdgeOrNullFace(vertex)) {
        RegionOps.healSplitEdgeAndCurve(vertex);
        continue;
      }
      const bundleData = RegionOps.isHealableNullFaceBundle(vertex);
      if (bundleData.isHealable && bundleData.nullFacePairs) {
        for (const [f0, f1] of bundleData.nullFacePairs)
          HalfEdge.pinch(f0, f1); // merge the null face pair into a single null face (with 2 split edges)
        for (const [e0, e1] of bundleData.nullFacePairs) {
          RegionOps.healSplitEdgeAndCurve(e0);
          RegionOps.healSplitEdgeAndCurve(e1);
        }
      }
    }
    return graph.deleteIsolatedEdges();
  }
  /**
   * Collect inputs that are nominally closed: regions, and physically closed curves.
   * * Physically closed input curves are each returned wrapped in a Loop to facilitate xy-algorithms,
   * but outside this limited context, these Loops only makes sense if they are planar.
   * @param curves inputs
   * @param openCurves optional array to receive open input curves that were not returned as regions.
   * @param tolerance optional distance tolerance for determining physical closure. Default is [[Geometry.smallMetricDistance]].
  */
  private static collectRegionsAndClosedPrimitives(curves: AnyCurve | AnyCurve[], openCurves?: AnyCurve[], tolerance: number = Geometry.smallMetricDistance): AnyRegion[] {
    const regions: AnyRegion[] = [];
    if (!Array.isArray(curves))
      curves = [curves];
    for (const curve of curves) {
      if (curve instanceof Loop || curve instanceof ParityRegion || curve instanceof UnionRegion)
        regions.push(curve);
      else if (curve instanceof Path && curve.isPhysicallyClosedCurve(tolerance))
        regions.push(Loop.create(...curve.children));
      else if (curve instanceof CurvePrimitive && curve.isPhysicallyClosedCurve(tolerance))
        regions.push(Loop.create(curve));
      else if (openCurves)
        openCurves.push(curve);
    }
    return regions;
  }
  /**
   * Find all xy-areas bounded by the unstructured, possibly intersecting curves.
   * * For best results, input curves should be parallel to the xy-plane, as z-coordinates are ignored.
   * * "Holes" implied/bounded by inputs are _not_ preserved/discovered in output; in particular [[ParityRegion]]
   * hole loops are treated like any other positive area loops.
   * * A common use case of this method is to assemble the bounding negative-area "exterior" loop for each connected
   * component of input curves. Passing addBridges = true adds "bridge" segments to connect unconnected input [[Loops]]s
   * and thereby increases the likelihood that a single connected component is returned. (This is why the default value
   * for addBridges is true.)
   * @param curvesAndRegions Any collection of curves. Each [[AnyRegion]] contributes its children _stripped of
   * parity context_.
   * @param tolerance optional distance tolerance for coincidence. Default is [[Geometry.smallMetricDistance]].
   * @param addBridges whether to add line segments to connect nested input [[Loop]]s (default is `true`). When `false`,
   * no line segments are added to the input curves, but the number of output components may be greater than expected.
   * @returns array of [[SignedLoops]], each entry of which describes the areas bounded by a single connected component:
   *    * `positiveAreaLoops` contains "interior" loops, _including holes in ParityRegion input_. These loops have
   * positive area and counterclockwise orientation.
   *    * `negativeAreaLoops` contains (probably just one) "exterior" loop which is ordered clockwise.
   *    * `slivers` contains sliver loops that have zero area, such as appear between coincident curves.
   *    * `edges` contains a [[LoopCurveLoopCurve]] object for each component edge, collecting both loops adjacent
   * to the edge and a constituent curve in each.
   */
  public static constructAllXYRegionLoops(
    curvesAndRegions: AnyCurve | AnyCurve[],
    tolerance: number = Geometry.smallMetricDistance,
    addBridges: boolean = true,
  ): SignedLoops[] {
    let primitives = RegionOps.collectCurvePrimitives(curvesAndRegions, undefined, true, true);
    primitives = TransferWithSplitArcs.clone(BagOfCurves.create(...primitives)).children as CurvePrimitive[];
    let hasOpenCurve = false;
    if (addBridges) { // generate a temp graph from ONLY the closed inputs to extract its bridge edges
      const context = RegionBooleanContext.create(RegionGroupOpType.Union, RegionGroupOpType.Union);
      const openCurves: AnyCurve[] = [];
      const regions = this.collectRegionsAndClosedPrimitives(curvesAndRegions, openCurves, tolerance);
      hasOpenCurve = openCurves.length > 0;
      if (regions.length > 0) {
        context.addMembers(regions, undefined);
        context.annotateAndMergeCurvesInGraph(tolerance);
        context.graph.announceEdges((_graph, edge: HalfEdge) => {
          if (edge.isMaskSet(HalfEdgeMask.BRIDGE_EDGE)) {
            // ensure the bridge edge roundtrips thru assembleHalfEdgeGraph so that we can filter it later if necessary
            const bridgeSegment = LineSegment3d.create(edge.getPoint3d(), edge.faceSuccessor.getPoint3d());
            bridgeSegment.parent = new RegionGroupMember(bridgeSegment, context.extraGeometry);
            primitives.push(bridgeSegment);
          }
          return true;
        });
      }
    }
    const intersections = CurveCurve.allIntersectionsAmongPrimitivesXY(primitives, tolerance);
    const graph = PlanarSubdivision.assembleHalfEdgeGraph(primitives, intersections, tolerance);
    if (addBridges && hasOpenCurve)
      RegionOps.removeExtraneousBridgeEdges(graph);
    const areaTol = this.computeMinimumArea(tolerance);
    return PlanarSubdivision.collectSignedLoopSetsInHalfEdgeGraph(graph, areaTol);
  }
  /**
   * Collect all `CurvePrimitives` in loosely typed input.
   * * Always recurses into primitives within explicit collections (Path, Loop, ParityRegion, UnionRegion).
   * * Optionally recurses into hidden primitives if `smallestPossiblePrimitives` is true.
   * @param candidates input curves
   * @param collectorArray optional pre-defined output array. If defined, it is NOT cleared: primitives are appended.
   * @param smallestPossiblePrimitives if true, recurse into the children of a [[CurveChainWithDistanceIndex]]. If
   * false, push the [[CurveChainWithDistanceIndex]] instead.
   * @param explodeLinestrings if true, push a [[LineSegment3d]] for each segment of a [[LineString3d]]. If false,
   * push the [[LineString3d]] instead.
   */
  public static collectCurvePrimitives(
    candidates: AnyCurve | AnyCurve[],
    collectorArray?: CurvePrimitive[],
    smallestPossiblePrimitives: boolean = false,
    explodeLinestrings: boolean = false,
  ): CurvePrimitive[] {
    const results: CurvePrimitive[] = collectorArray === undefined ? [] : collectorArray;
    if (candidates instanceof CurvePrimitive) {
      candidates.collectCurvePrimitives(results, smallestPossiblePrimitives, explodeLinestrings);
    } else if (candidates instanceof CurveCollection) {
      candidates.collectCurvePrimitives(results, smallestPossiblePrimitives, explodeLinestrings);
    } else if (Array.isArray(candidates)) {
      for (const c of candidates) {
        this.collectCurvePrimitives(c, results, smallestPossiblePrimitives, explodeLinestrings);
      }
    }
    return results;
  }
  /**
   * Copy primitive pointers from candidates to result array, replacing each [[LineString3d]] by newly constructed
   * instances of [[LineSegment3d]].
   * @param candidates input curves
   * @return copied (captured) inputs except for the linestrings, which are exploded
   */
  public static expandLineStrings(candidates: CurvePrimitive[]): CurvePrimitive[] {
    const result: CurvePrimitive[] = [];
    for (const c of candidates) {
      if (c instanceof LineString3d) {
        for (let i = 0; i + 1 < c.packedPoints.length; i++) {
          const q = c.getIndexedSegment(i);
          if (q !== undefined)
            result.push(q);
        }
      } else {
        result.push(c);
      }
    }
    return result;
  }
  /**
   * Return the overall range of given curves.
   * @param data candidate curves
   * @param worldToLocal transform to apply to data before computing its range
   */
  public static curveArrayRange(data: any, worldToLocal?: Transform): Range3d {
    const range = Range3d.create();
    if (data instanceof GeometryQuery)
      data.extendRange(range, worldToLocal);
    else if (Array.isArray(data)) {
      for (const c of data) {
        if (c instanceof GeometryQuery)
          c.extendRange(range, worldToLocal);
        else if (c instanceof Point3d)
          range.extendPoint(c, worldToLocal);
        else if (c instanceof GrowableXYZArray)
          range.extendRange(c.getRange(worldToLocal));
        else if (Array.isArray(c))
          range.extendRange(this.curveArrayRange(c, worldToLocal));
      }
    }
    return range;
  }
  /**
   * Triangulate a stroked Loop or ParityRegion and return the graph.
   * @param polygons polygons obtained by stroking a Loop or ParityRegion, z-coordinates ignored.
   * @returns triangulated graph
   */
  private static triangulateStrokedRegionComponent(polygons: MultiLineStringDataVariant): HalfEdgeGraph | undefined {
    let graph: HalfEdgeGraph | undefined;
    if (Array.isArray(polygons)) {
      if (polygons.length === 0)
        return undefined;
      const firstEntry = polygons[0];
      if (Point3d.isAnyImmediatePointType(firstEntry)) {
        graph = Triangulator.createTriangulatedGraphFromSingleLoop(polygons as XYAndZ[] | XAndY[] | number[][]);
      } else if (polygons.length > 1) {
        let writablePolygons: IndexedReadWriteXYZCollection[];
        if (firstEntry instanceof IndexedReadWriteXYZCollection) {
          writablePolygons = polygons as IndexedReadWriteXYZCollection[];
        } else {
          writablePolygons = [];
          for (const polygon of polygons as LineStringDataVariant[])
            writablePolygons.push(GrowableXYZArray.create(polygon));
        }
        const sortedPolygons = PolygonOps.sortOuterAndHoleLoopsXY(writablePolygons);
        if (sortedPolygons.length === 1) { // below requires exactly one outer loop!
          if (graph = Triangulator.createTriangulatedGraphFromLoops(sortedPolygons[0]))
            Triangulator.flipTriangles(graph);
        }
      } else {
        graph = Triangulator.createTriangulatedGraphFromSingleLoop(firstEntry);
      }
    } else {
      graph = Triangulator.createTriangulatedGraphFromSingleLoop(polygons);
    }
    if (!graph) {
      // Last resort: try full merge. Conveniently, multiple polygons are processed with parity logic.
      if (graph = RegionOpsFaceToFaceSearch.doPolygonBoolean(polygons, [], (inA, _inB) => inA)) {
        if (Triangulator.triangulateAllPositiveAreaFaces(graph))
          Triangulator.flipTriangles(graph);
      }
    }
    return graph;
  }
  /** Stroke a Loop or ParityRegion */
  private static strokeRegionComponent(component: Loop | ParityRegion, options?: StrokeOptions): GrowableXYZArray[] {
    const strokedComponent = component.cloneStroked(options);
    // package the stroked region as polygons
    const polygons: GrowableXYZArray[] = [];
    if (strokedComponent instanceof Loop) {
      if (strokedComponent.children.length > 0 && strokedComponent.children[0] instanceof LineString3d)
        polygons.push(strokedComponent.children[0].packedPoints); // expect only 1
    } else if (strokedComponent instanceof ParityRegion) {
      for (const strokedLoop of strokedComponent.children) {
        if (strokedLoop.children.length > 0 && strokedLoop.children[0] instanceof LineString3d)
          polygons.push(strokedLoop.children[0].packedPoints); // expect only 1
      }
    }
    return polygons;
  }
  /**
   * Triangulate a Loop or ParityRegion and return the graph.
   * @param component region, z-coordinates ignored
   * @param options how to stroke loops
   * @returns triangulated graph
   */
  private static triangulateRegionComponent(component: Loop | ParityRegion, options?: StrokeOptions): HalfEdgeGraph | undefined {
    const polygons = this.strokeRegionComponent(component, options);
    return this.triangulateStrokedRegionComponent(polygons);
  }
  /**
   * Facet the region according to stroke options.
   * @note For best results, [[UnionRegion]] input should consist of non-overlapping children. See [[regionBooleanXY]].
   * @note For best results, [[ParityRegion]] input should be correctly oriented. See [[sortOuterAndHoleLoopsXY]].
   * @param region a closed xy-planar region, possibly with holes.
   * * The z-coordinates of the region are ignored. Caller is responsible for rotating the region into plane local coordinates beforehand, and reversing the rotation afterwards.
   * @param options primarily how to stroke the region boundary, but also how to facet the region interior.
   * * By default, a triangulation is returned, but if `options.maximizeConvexFacets === true`, edges between coplanar triangles are removed to return maximally convex facets.
   * @returns facets for the region, or undefined if facetting failed
   */
  public static facetRegionXY(region: AnyRegion, options?: StrokeOptions): IndexedPolyface | undefined {
    let graph: HalfEdgeGraph | undefined;
    if (region instanceof UnionRegion) {
      for (const child of region.children) {
        const childGraph = RegionOps.triangulateRegionComponent(child, options);
        if (childGraph) {
          if (!graph) {
            graph = childGraph;
          } else {
            // Graph concatenation without edge splits, clustering, and merge. We assume disjoint children so that at worst,
            // components will have unshared adjacent exterior edges that remain after expandConvexFaces. Note that calling
            // clusterAndMergeXYTheta here can create non-manifold topology!
            graph.allHalfEdges.push(...childGraph.allHalfEdges);
          }
        }
      }
    } else {
      graph = this.triangulateRegionComponent(region, options);
    }
    if (!graph)
      return undefined;
    if (options?.maximizeConvexFacets)
      HalfEdgeGraphOps.expandConvexFaces(graph);
    return PolyfaceBuilder.graphToPolyface(graph, options);
  }
  /**
   * Decompose a polygon with optional holes into an array of convex polygons.
   * @param polygon polygon and hole loops, e.g., as returned by [[CurveCollection.cloneStroked]] on a Loop or ParityRegion. All z-coordinates are ignored.
   * @param maximize whether to return maximally convex polygons. If false, triangles are returned.
   * @returns array of convex polygons, or undefined if triangulation failed
  */
  public static convexDecomposePolygonXY(polygon: MultiLineStringDataVariant, maximize: boolean = true): GrowableXYZArray[] | undefined {
    const graph = RegionOps.triangulateStrokedRegionComponent(polygon);
    if (!graph)
      return undefined;
    if (maximize)
      HalfEdgeGraphOps.expandConvexFaces(graph);
    const convexPolygons: GrowableXYZArray[] = [];
    graph.announceFaceLoops((_graph, seed) => {
      if (!seed.isMaskSet(HalfEdgeMask.EXTERIOR))
        convexPolygons.push(GrowableXYZArray.create(seed.collectAroundFace((node) => { return node.getPoint3d(); })));
      return true;
    });
    return convexPolygons;
  }
}
/** @internal */
function pushToInOnOutArrays(
  curve: AnyCurve, select: number, arrayNegative: AnyCurve[], array0: AnyCurve[], arrayPositive: AnyCurve[],
): void {
  if (select > 0)
    arrayPositive.push(curve);
  else if (select < 0)
    arrayNegative.push(curve);
  else
    array0.push(curve);
}
