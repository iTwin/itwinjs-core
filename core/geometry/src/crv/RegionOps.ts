/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import {
  IndexedReadWriteXYZCollection, IndexedXYZCollection, LineStringDataVariant, MultiLineStringDataVariant,
} from "../geometry3d/IndexedXYZCollection";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { PolylineCompressionContext } from "../geometry3d/PolylineCompressionByEdgeOffset";
import { Range3d } from "../geometry3d/Range";
import { SortablePolygon } from "../geometry3d/SortablePolygon";
import { Transform } from "../geometry3d/Transform";
import { XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { MomentData } from "../geometry4d/MomentData";
import { IndexedPolyface, Polyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../topology/Graph";
import { HalfEdgeGraphSearch } from "../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphOps } from "../topology/Merging";
import { Triangulator } from "../topology/Triangulation";
import { BagOfCurves, CurveChain, CurveCollection } from "./CurveCollection";
import { CurveCurve } from "./CurveCurve";
import { CurveOps } from "./CurveOps";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyChain, AnyCurve, AnyRegion } from "./CurveTypes";
import { CurveWireMomentsXYZ } from "./CurveWireMomentsXYZ";
import { GeometryQuery } from "./GeometryQuery";
import { ChainCollectorContext } from "./internalContexts/ChainCollectorContext";
import { PolygonWireOffsetContext } from "./internalContexts/PolygonOffsetContext";
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
import { RegionBooleanContext, RegionGroupOpType, RegionOpsFaceToFaceSearch } from "./RegionOpsClassificationSweeps";
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
 * Enumeration of the binary operation types for a booleans among regions
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
 * Class `RegionOps` has static members for calculations on regions (areas).
 * * Regions are represented by these `CurveCollection` subclasses:
 *   * `Loop` -- a single loop
 *   * `ParityRegion` -- a collection of loops, interpreted by parity rules.
 * The common "One outer loop and many Inner loops" is a parity region.
 *   * `UnionRegion` -- a collection of `Loop` and `ParityRegion` objects understood as a (probably disjoint) union.
 * * **NOTE:** Most of the methods in this class ignore z-coordinates, so callers should ensure that input geometry has
 * been rotated parallel to the xy-plane.
 * @public
 */
export class RegionOps {
  /**
   * Return moment sums for a loop, parity region, or union region.
   * * If `rawMomentData` is the MomentData returned by computeXYAreaMoments, convert to principal axes and moments with
   *    call `principalMomentData = MomentData.inertiaProductsToPrincipalAxes (rawMomentData.origin, rawMomentData.sums);`
   * @param root any Loop, ParityRegion, or UnionRegion.
   */
  public static computeXYAreaMoments(root: AnyRegion): MomentData | undefined {
    const handler = new RegionMomentsXY();
    const result = root.dispatchToGeometryHandler(handler);
    if (result instanceof MomentData) {
      result.shiftOriginAndSumsToCentroidOfSums();
      return result;
    }
    return undefined;
  }
  /**
   * Return an area tolerance for a given xy-range and optional distance tolerance.
   * @param range range of planar region to tolerance
   * @param distanceTolerance optional absolute distance tolerance
  */
  public static computeXYAreaTolerance(range: Range3d, distanceTolerance: number = Geometry.smallMetricDistance): number {
    // if A = bh and e is distance tolerance, then A' := (b+e/2)(h+e/2) = A + e/2(b+h+e/2), so A'-A = e/2(b+h+e/2).
    const halfDistTol = 0.5 * distanceTolerance;
    return halfDistTol * (range.xLength() + range.yLength() + halfDistTol);
  }
  /**
   * Return a (signed) xy area for a region.
   * * The area is negative if and only if the region is oriented clockwise with respect to the positive z-axis.
   * @param root any Loop, ParityRegion, or UnionRegion.
   */
  public static computeXYArea(root: AnyRegion): number | undefined {
    const handler = new RegionMomentsXY();
    const result = root.dispatchToGeometryHandler(handler);
    if (result instanceof MomentData) {
      return result.quantitySum;
    }
    return undefined;
  }
  /**
   * Return MomentData with the sums of wire moments.
   * * If `rawMomentData` is the MomentData returned by computeXYAreaMoments, convert to principal axes and moments with
   *    call `principalMomentData = MomentData.inertiaProductsToPrincipalAxes (rawMomentData.origin, rawMomentData.sums);`
   * @param root any CurveCollection or CurvePrimitive.
   */
  public static computeXYZWireMomentSums(root: AnyCurve): MomentData | undefined {
    const handler = new CurveWireMomentsXYZ();
    handler.visitLeaves(root);
    const result = handler.momentData;
    result.shiftOriginAndSumsToCentroidOfSums();
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
   * Return areas defined by a boolean operation.
   * * If there are multiple regions in loopsA, they are treated as a union.
   * * If there are multiple regions in loopsB, they are treated as a union.
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   * @param operation indicates Union, Intersection, Parity, AMinusB, or BMinusA
   * @param mergeTolerance absolute distance tolerance for merging loops
   * @returns a region resulting from merging input loops and the boolean operation. May contain bridge edges added
   * to connect interior loops to exterior loops.
   */
  public static regionBooleanXY(
    loopsA: AnyRegion | AnyRegion[] | undefined,
    loopsB: AnyRegion | AnyRegion[] | undefined,
    operation: RegionBinaryOpType,
    mergeTolerance: number = Geometry.smallMetricDistance,
  ): AnyRegion | undefined {
    // Always return UnionRegion for now. But keep return type as AnyRegion:
    // in the future, we might return the *simplest* region type.
    const result = UnionRegion.create();
    const context = RegionBooleanContext.create(RegionGroupOpType.Union, RegionGroupOpType.Union);
    context.addMembers(loopsA, loopsB);
    context.annotateAndMergeCurvesInGraph(mergeTolerance);
    const range = context.groupA.range().union(context.groupB.range());
    const areaTol = this.computeXYAreaTolerance(range, mergeTolerance);
    context.runClassificationSweep(
      operation,
      (_graph: HalfEdgeGraph, face: HalfEdge, faceType: -1 | 0 | 1, area: number) => {
        // ignore danglers and null faces, but not 2-edge "banana" faces with nonzero area
        if (face.countEdgesAroundFace() < 2)
          return;
        if (Math.abs(area) < areaTol)
          return;
        if (faceType === 1) {
          const loop = PlanarSubdivision.createLoopInFace(face);
          if (loop)
            result.tryAddChild(loop);
        }
      },
    );
    return result;
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
        if (!Geometry.isSmallMetricDistance(data.distanceIndexIndex(0, 4)!))
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
      const vector01 = dataToUse.vectorIndexIndex(0, 1)!;
      const vector03 = dataToUse.vectorIndexIndex(0, 3)!;
      const vector12 = dataToUse.vectorIndexIndex(1, 2)!;
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
   * * Contiguous `LineSegment3d` and `LineString3d` objects.
   *   * collect all points
   *   * eliminate duplicated points
   *   * eliminate points colinear with surrounding points
   *   * contiguous concentric circular or elliptic arcs
   *   * combine angular ranges
   * * This function can be used to compress adjacent LineSegment3ds into a LineString3d
   * @param curves Path or loop (or larger collection containing paths and loops) to be simplified
   * @param options options for tolerance and selective simplification.
   */
  public static consolidateAdjacentPrimitives(
    curves: CurveCollection, options?: ConsolidateAdjacentCurvePrimitivesOptions,
  ): void {
    const context = new ConsolidateAdjacentCurvePrimitivesContext(options);
    curves.dispatchToGeometryHandler(context);
  }
  /**
   * Reverse and reorder loops in the xy-plane for consistency and containment.
   * @param loops multiple loops in any order and orientation, z-coordinates ignored
   * @returns a region that captures the input pointers. This region is a:
   * * `Loop` if there is exactly one input loop. It is oriented counterclockwise.
   * * `ParityRegion` if input consists of exactly one outer loop with at least one hole loop.
   * Its first child is an outer loop oriented counterclockwise; all subsequent children are holes oriented
   * clockwise.
   * * `UnionRegion` if any other input configuration. Its children are individually ordered/oriented as in
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
   * Find all areas bounded by the unstructured, possibly intersecting curves.
   * * A common use case of this method is to assemble the bounding "exterior" loop (or loops) containing the
   * input curves.
   * * This method does not add bridge edges to connect outer loops to inner loops. Each disconnected loop,
   * regardless of its containment, is returned as its own SignedLoops object. Pre-process with [[regionBooleanXY]]
   * to add bridge edges so that [[constructAllXYRegionLoops]] will return outer and inner loops in the same
   * SignedLoops object.
   * @param curvesAndRegions Any collection of curves. Each Loop/ParityRegion/UnionRegion contributes its curve
   * primitives.
   * @param tolerance optional distance tolerance for coincidence
   * @returns array of [[SignedLoops]], each entry of which describes the faces in a single connected component:
   *    * `positiveAreaLoops` contains "interior" loops, _including holes in ParityRegion input_. These loops have
   * positive area and counterclockwise orientation.
   *    * `negativeAreaLoops` contains (probably just one) "exterior" loop which is ordered clockwise.
   *    * `slivers` contains sliver loops that have zero area, such as appear between coincident curves.
   *    * `edges` contains a [[LoopCurveLoopCurve]] object for each component edge, collecting both loops adjacent
   * to the edge and a constituent curve in each.
   */
  public static constructAllXYRegionLoops(
    curvesAndRegions: AnyCurve | AnyCurve[], tolerance: number = Geometry.smallMetricDistance,
  ): SignedLoops[] {
    const primitives = RegionOps.collectCurvePrimitives(curvesAndRegions, undefined, true, true);
    const range = this.curveArrayRange(primitives);
    const areaTol = this.computeXYAreaTolerance(range, tolerance);
    const intersections = CurveCurve.allIntersectionsAmongPrimitivesXY(primitives, tolerance);
    const graph = PlanarSubdivision.assembleHalfEdgeGraph(primitives, intersections, tolerance);
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
   * @param region a closed xy-planar region, possibly with holes.
   * * The z-coordinates of the region are ignored. Caller is responsible for rotating the region into plane local coordinates beforehand, and reversing the rotation afterwards.
   * * For best results, `UnionRegion` input should consist of non-overlapping children.
   * Caller can ensure this by passing in `region = RegionOps.regionBooleanXY(unionRegion, undefined, RegionBinaryOpType.Union)`.
   * * For best results, `ParityRegion` input should be correctly oriented (holes have opposite orientation to their containing loop).
   * Caller can ensure this for non-intersecting loops by passing in `region = RegionOps.sortOuterAndHoleLoopsXY(loops)`.
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

/**
 * * Options to control method `RegionOps.consolidateAdjacentPrimitives`
 * @public
 */
export class ConsolidateAdjacentCurvePrimitivesOptions {
  /** True to consolidated linear geometry   (e.g. separate LineSegment3d and LineString3d) into LineString3d */
  public consolidateLinearGeometry: boolean = true;
  /** True to consolidate contiguous arcs */
  public consolidateCompatibleArcs: boolean = true;
  /** Tolerance for collapsing identical points */
  public duplicatePointTolerance = Geometry.smallMetricDistance;
  /** Tolerance for removing interior colinear points. */
  public colinearPointTolerance = Geometry.smallMetricDistance;
}
