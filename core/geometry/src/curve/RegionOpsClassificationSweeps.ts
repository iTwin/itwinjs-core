/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { MultiLineStringDataVariant } from "../geometry3d/IndexedXYZCollection";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range2d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { XAndY } from "../geometry3d/XYZProps";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask, NodeToNumberFunction } from "../topology/Graph";
import { HalfEdgeGraphSearch } from "../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge } from "../topology/Merging";
import { RegularizationContext } from "../topology/RegularizeFace";
import { Arc3d } from "./Arc3d";
import { CurveCurve } from "./CurveCurve";
import { CurveLocationDetail } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyRegion } from "./CurveTypes";
import { GeometryQuery } from "./GeometryQuery";
import { PlaneAltitudeRangeContext } from "./internalContexts/PlaneAltitudeRangeContext";
import { TransferWithSplitArcs } from "./internalContexts/TransferWithSplitArcs";
import { LineSegment3d } from "./LineSegment3d";
import { Loop } from "./Loop";
import { ParityRegion } from "./ParityRegion";
import { PlanarSubdivision } from "./Query/PlanarSubdivision";
import { GraphCheckPointFunction, RegionBinaryOpType, RegionOps } from "./RegionOps";
import { UnionRegion } from "./UnionRegion";

/**
 * base class for callbacks during region sweeps.
 * * At start of a component, `startComponent(node)` is called announcing a representative node on the outermost face.
 *   * A Component in this usage is a component that is edge connected when ignoring "exterior bridge edges".
 * * As each face is entered, `enterFace(facePathStack, newFaceNode)` is called
 *   * facePathStack[0] is the outermost node of the path from the outer face.
 *   * facePathStack[1] is its inside mate.
 *   * facePathStack[2k] is the outside node at crossing to face at depth k.
 *   * facePathStack[2k+1] is the node where face at depth k was entered.
 *   * newFaceNode is the entry node (redundant of stack tip)
 *  * On retreat from a face, `leaveFace(facePathStack, faceNode)` is called.
 *  * At end of component, `finishComponent (node)` is called.
 * * The base class is fully implemented to do nothing during the sweep.
 * @internal
 */
abstract class RegionOpsFaceToFaceSearchCallbacks {
  /** Announce a representative node on the outer face of a component. */
  public startComponent(_node: HalfEdge): boolean {
    return true;
  }
  /** Announce return to outer face. */
  public finishComponent(_node: HalfEdge): boolean {
    return true;
  }
  /** Announce face entry. */
  public enterFace(_facePathStack: HalfEdge[], _newFaceNode: HalfEdge): boolean {
    return true;
  }
  /** Announce face exit. */
  public leaveFace(_facePathStack: HalfEdge[], _newFaceNode: HalfEdge): boolean {
    return true;
  }
}
/** Function signature to test if a pair of boolean states is to be accepted by area booleans (during face-to-face sweeps)
 * @internal
 */
type BinaryBooleanAcceptFunction = (stateA: boolean, stateB: boolean) => boolean;
/** Function signature ot announce classification of a face.
 * The `faceType` parameters are
 * * -1 for a fully exterior face.  This is a negative area face.
 * * 0 for a positive area face classified as "out" for the boolean.
 * * 1 for a positive area face classified as "in" for the boolean.
 */
type AnnounceClassifiedFace = (graph: HalfEdgeGraph, faceSeed: HalfEdge, faceType: -1 | 0 | 1, area: number) => void;
/**
 * Implementation of `RegionOpsFaceToFaceSearchCallbacks` for binary boolean sweep with polygonal regions.
 * * For this linear-boundary case the boundary geometry is carried entirely from the coordinates in the half edges.
 * * This assumes the each node in the graph has edgeTag set to:
 *   * `edgeTag === undefined` if the edge crossing does not change classification.
 *     * for example, an edge added by regularization
 *   * `edgeTag === 1` if this is a boundary for the first of the boolean input regions
 *   * `edgeTag === 2` if this is a boundary for the second of the boolean input regions
 * * constructor
 *    * takes caller-supplied function to decide whether to accept a face given its state relative to the two boolean terms.
 *    * sets the in/out status of both terms to false.
 * * `startComponent` marks the entire outer face as `EXTERIOR`
 * * `enterFace`
 *    * if this is a bounding edge (according to `node.faceTag`) toggle the in/out status if this boolean term.
 *    * ask the faceAcceptFunction if the current term states combine to in/out for the result
 *    * if out, set the `EXTERIOR` mask around the face.
 * * `leaveFace`
 *    * if this is a bounding edge (according to `node.faceTag`) toggle the in/out status if this boolean term.
 * * `finishComponent` is not reimplemented.
 * @internal
 */
class RegionOpsBinaryBooleanSweepCallbacks extends RegionOpsFaceToFaceSearchCallbacks {
  private _faceSelectFunction: BinaryBooleanAcceptFunction;
  private _inComponent: boolean[];
  private _exteriorMask: HalfEdgeMask;
  public constructor(acceptFaceFunction: BinaryBooleanAcceptFunction, exteriorMask: HalfEdgeMask) {
    super();
    this._inComponent = [false, false, false]; // entry 0 is never reused.
    this._exteriorMask = exteriorMask;
    this._faceSelectFunction = acceptFaceFunction;
  }
  /** Mark this face as exterior */
  public override startComponent(node: HalfEdge): boolean { node.setMaskAroundFace(this._exteriorMask); return true; }
  /**
   * * If necessary, toggle a term state.
   * * if indicated, mark this face exterior.
   */
  public override enterFace(_facePathStack: HalfEdge[], node: HalfEdge): boolean {
    const thisFaceIndex = node.edgeTag;
    if (node.edgeTag === 1 || node.edgeTag === 2)
      this._inComponent[thisFaceIndex] = !this._inComponent[thisFaceIndex];
    if (!this._faceSelectFunction(this._inComponent[1], this._inComponent[2]))
      node.setMaskAroundFace(this._exteriorMask);
    return true;
  }
  /**
   * * If necessary, toggle a term state.
   */
  public override leaveFace(_facePathStack: HalfEdge[], node: HalfEdge): boolean {
    const thisFaceIndex = node.edgeTag;
    if (node.edgeTag === 1 || node.edgeTag === 2)
      this._inComponent[thisFaceIndex] = !this._inComponent[thisFaceIndex];
    return true;
  }
}
/**
 * Low level graph search for face classification.
 * @internal
 */
export class RegionOpsFaceToFaceSearch {
  /**
   * Run a DFS with face-to-face step announcements.
   * * false return from any function terminates search immediately.
   * * all reachable nodes assumed to have both visit masks clear.
   * @param graph containing graph.
   * @param seed first node to visit.
   * @param faceHasBeenVisited mask marking faces that have been seen.
   * @param nodeHasBeenVisited mask marking node-to-node step around face.
   * @param callbacks callbacks.
   */
  public static faceToFaceSearchFromOuterLoop(
    _graph: HalfEdgeGraph,
    seed: HalfEdge,
    faceHasBeenVisited: HalfEdgeMask,
    nodeHasBeenVisited: HalfEdgeMask,
    callbacks: RegionOpsFaceToFaceSearchCallbacks,
  ): void {
    if (seed.isMaskSet(faceHasBeenVisited))
      return;
    if (!callbacks.startComponent(seed))
      return;
    const facePathStack = [];
    seed.setMaskAroundFace(faceHasBeenVisited);
    let faceWalker = seed;
    do {
      let entryNode = faceWalker;
      let mate = faceWalker.edgeMate;
      if (!mate.isMaskSet(faceHasBeenVisited)) {
        // The faceWalker seed is always on the base of the stack.
        // The stack then contains even-odd pairs of (entryNode, faceNode).
        // entryNode is the node where a face was entered.
        // faceNode is another node around that face.
        facePathStack.push(faceWalker);
        facePathStack.push(mate);
        let faceNode = mate.faceSuccessor;
        mate.setMaskAroundFace(faceHasBeenVisited);
        entryNode = mate;
        if (callbacks.enterFace(facePathStack, mate)) {
          for (; ;) {
            mate = faceNode.edgeMate;
            if (!mate.isMaskSet(faceHasBeenVisited)) {
              mate.setMaskAroundFace(faceHasBeenVisited);
              if (!callbacks.enterFace(facePathStack, mate))
                return;
              facePathStack.push(faceNode);
              facePathStack.push(mate);
              faceNode = mate;
              entryNode = mate;
            }
            faceNode.setMask(nodeHasBeenVisited);
            faceNode = faceNode.faceSuccessor;
            if (faceNode === entryNode) {
              callbacks.leaveFace(facePathStack, faceNode);
              if (facePathStack.length <= 2) {
                break;
              }
              facePathStack.pop();
              faceNode = facePathStack[facePathStack.length - 1];
              facePathStack.pop();
              entryNode = facePathStack[facePathStack.length - 1];
            }
            if (faceNode.isMaskSet(nodeHasBeenVisited)) {
              // this is disaster
              return;
            }
          }
        }
      }
      // continue at outermost level
      faceWalker = faceWalker.faceSuccessor;
    } while (faceWalker !== seed);
    callbacks.finishComponent(seed);
  }
  /** Complete multi-step process for polygon binary booleans starting with arrays of coordinates.
   * * Each of the binary input terms is a collection of loops
   *   * Within the binary term, in/out is determined by edge-crossing parity rules.
   * * Processing steps are
   *   * Build the loops for each set.
   *      * Each edge labeled with 1 or 2 as binary term identifier.
   *   * find crossings among the edges.
   *      * Edges are split as needed, but split preserves the edgeTag
   *   * sort edges around vertices
   *   * add regularization edges so holes are connected to their parent.
   */
  public static doPolygonBoolean(loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant, faceSelectFunction: (inA: boolean, inB: boolean) => boolean, graphCheckPoint?: GraphCheckPointFunction): HalfEdgeGraph | undefined {
    const graph = new HalfEdgeGraph();
    const baseMask = HalfEdgeMask.BOUNDARY_EDGE | HalfEdgeMask.PRIMARY_EDGE;
    const seedA = RegionOps.addLoopsWithEdgeTagToGraph(graph, loopsA, baseMask, 1);
    const seedB = RegionOps.addLoopsWithEdgeTagToGraph(graph, loopsB, baseMask, 2);
    if (graphCheckPoint)
      graphCheckPoint("unmerged loops", graph, "U");
    if (seedA || seedB) {
      // split edges where they cross . . .
      HalfEdgeGraphMerge.splitIntersectingEdges(graph);
      if (graphCheckPoint)
        graphCheckPoint("After splitIntersectingEdges", graph, "S");
      // sort radially around vertices.
      HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
      if (graphCheckPoint)
        graphCheckPoint("After clusterAndMergeXYTheta", graph, "M");
      // add edges to connect various components  (e.g. holes!!!)
      const context = new RegularizationContext(graph);
      context.regularizeGraph(true, true);
      if (graphCheckPoint)
        graphCheckPoint("After regularize", graph, "MR");
      const exteriorHalfEdge = HalfEdgeGraphSearch.findMinimumAreaFace(graph);
      if (exteriorHalfEdge === undefined)
        return undefined;
      const exteriorMask = HalfEdgeMask.EXTERIOR;
      const faceVisitedMask = graph.grabMask();
      const nodeVisitedMask = graph.grabMask();
      const allMasksToClear = exteriorMask | faceVisitedMask | nodeVisitedMask;
      graph.clearMask(allMasksToClear);
      const callbacks = new RegionOpsBinaryBooleanSweepCallbacks(faceSelectFunction, exteriorMask);
      this.faceToFaceSearchFromOuterLoop(graph, exteriorHalfEdge, faceVisitedMask, nodeVisitedMask, callbacks);
      if (graphCheckPoint)
        graphCheckPoint("After faceToFaceSearchFromOuterLoop", graph, "MRX");
      graph.dropMask(faceVisitedMask);
      graph.dropMask(nodeVisitedMask);
      return graph;
    }
    return undefined;
  }
  /** Complete multi-step process for polygon binary booleans starting with arrays of coordinates.
   * * the manyLoopsAndParitySets input is an array.
   * * Each entry is one or more loops.
   * * An entry that is "just points" is a simple loop.
   * * An entry that is itself an array of arrays of points is a set of loops with "parity" -- relation:
   *    * typically the first is an outer loop an others are holes.
   *    * but if there is self intersection or multiple outer loops, parity rules are applied to decide inner and outer.
   * * Processing steps are
   *   * Build the loops for each set.
   *      * Each edge labeled with index to the outer array.
   *   * find crossings among the edges.
   *      * Edges are split as needed, but split preserves the edgeTag
   *   * sort edges around vertices
   *   * add regularization edges so holes are connected to their parent.
   *   * assign inside/outside by parity within each set and overall union.
   */
  public static doBinaryBooleanBetweenMultiLoopInputs(
    dataA: MultiLineStringDataVariant[],
    opA: RegionGroupOpType,
    binaryOp: RegionBinaryOpType,
    dataB: MultiLineStringDataVariant[],
    opB: RegionGroupOpType,
    purgeSliverExteriorFaces: boolean,
  ): HalfEdgeGraph | undefined {
    const graph = new HalfEdgeGraph();
    const baseMask = HalfEdgeMask.BOUNDARY_EDGE | HalfEdgeMask.PRIMARY_EDGE;
    const callbacks = RegionBooleanContext.create(opA, opB);
    callbacks.graph = graph;
    callbacks.faceAreaFunction = (node) => HalfEdgeGraphSearch.signedFaceArea(node);

    // Add all the members in groupA ..
    for (const data of dataA) {
      if (data.length > 2) {
        const member = new RegionGroupMember(data, callbacks.groupA);
        RegionOps.addLoopsWithEdgeTagToGraph(graph, data, baseMask, member);
      }
    }
    for (const data of dataB) {
      if (data.length > 2) {
        const member = new RegionGroupMember(data, callbacks.groupB);
        RegionOps.addLoopsWithEdgeTagToGraph(graph, data, baseMask, member);
      }
    }
    // split edges where they cross . . .
    HalfEdgeGraphMerge.splitIntersectingEdges(graph);
    // sort radially around vertices.
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
    // add edges to connect various components  (e.g. holes!!!)
    const context = new RegularizationContext(graph);
    context.regularizeGraph(true, true);
    callbacks.runClassificationSweep(binaryOp);
    if (purgeSliverExteriorFaces)
      callbacks.unmaskMaskedNullFaces(HalfEdgeMask.EXTERIOR);
    return graph;
  }
}

/**
 * Enumeration of operation types "within a group operand" for a `RegionBooleanContext`.
 * @internal
 */
export enum RegionGroupOpType {
  Union = 0,
  Parity = 1,
  Intersection = 2,
  NonBounding = -1,
}

/**
 * Each loop or parity region in a `RegionBooleanContext` is recorded as a `RegionGroupMember`, which carries
 * * the Loop or parityRegion object
 * * a numeric indication of the sweep state (parity) during the classification search.
 * * a reference to the parent group (which in turn leads back to the `RegionBooleanContext`)
 * @internal
 */
export class RegionGroupMember {
  public region: Loop | ParityRegion | CurvePrimitive | MultiLineStringDataVariant;
  public sweepState: number;
  public parentGroup: RegionGroup;
  public constructor(region: Loop | ParityRegion | CurvePrimitive | MultiLineStringDataVariant, parentGroup: RegionGroup) {
    this.region = region;
    this.parentGroup = parentGroup;
    this.sweepState = 0;
  }
  public clearState() {
    this.sweepState = 0;
  }
}

/**
 * A `RegionGroup` is
 * * An array of `RegionGroupMembers`, carrying the regions of the Ai or Bi part of the boolean expression.
 * * The `RegionGroupOpType` to be applied among those members.
 * * Pointer to the containing context
 * * The count of number of regions known to be "in" as the search progresses.
 * @internal
 */
export class RegionGroup {
  public members: RegionGroupMember[];
  public groupOpType: RegionGroupOpType;
  public parent: RegionBooleanContext;
  private _numIn: number;
  public constructor(parent: RegionBooleanContext, groupOpType: RegionGroupOpType) {
    this.members = [];
    this.parent = parent;
    this.groupOpType = groupOpType;
    this._numIn = 0;
  }
  /** deep clear of state data -- group header plus all members */
  public clearState() {
    for (const member of this.members)
      member.clearState();
    this._numIn = 0;
  }
  public range(): Range3d {
    const range = Range3d.createNull();
    for (const m of this.members) {
      if (m.region instanceof GeometryQuery)
        m.region.extendRange(range);
      else {
        const range1 = Range3d.createFromVariantData(m.region);
        range.extendRange(range1);
      }
    }
    return range;
  }
  /** Ask if the current _numIn count qualifies as an "in" for this operation type. */
  public getInOut(): boolean {
    // UNION is true if one or more members are IN
    if (this.groupOpType === RegionGroupOpType.Union)
      return this._numIn > 0;
    // PARITY is true if an odd number of regions are IN
    if (this.groupOpType === RegionGroupOpType.Parity)
      return Geometry.isOdd(this._numIn);
    // INTERSECTION is true if ALL the regions are IN
    if (this.groupOpType === RegionGroupOpType.Intersection)
      return this._numIn === this.members.length;
    return false;
  }
  // push new members into the group.
  public addMember(data: AnyRegion | AnyRegion[] | LineSegment3d | undefined, allowLineSegment: boolean = false) {
    if (data instanceof Loop || data instanceof ParityRegion) {
      let cleanerData = data.clone() as (ParityRegion | Loop);
      RegionOps.consolidateAdjacentPrimitives(cleanerData);
      cleanerData = TransferWithSplitArcs.clone(cleanerData) as (ParityRegion | Loop);
      this.members.push(new RegionGroupMember(cleanerData, this));
    } else if (data instanceof UnionRegion) {
      for (const child of data.children) {
        this.addMember(child);
      }
    } else if (Array.isArray(data)) {
      for (const item of data) {
        this.addMember(item);
      }
    } else if (allowLineSegment && data instanceof LineSegment3d) {
      this.members.push(new RegionGroupMember(data, this));
    }
  }
  // update the "in" count _numIn according to old and new states (parity counts) for some member region.
  public recordMemberStateChange(oldState: number, newState: number) {
    const oldIn = Geometry.isOdd(oldState);
    const newIn = Geometry.isOdd(newState);
    if (!oldIn && newIn)
      this._numIn++;
    else if (oldIn && !newIn)
      this._numIn--;
  }
}
/**
 * A `RegionBooleanContext` carries structure and operations for binary operations between two sets of regions.
 * * In the binary operation OP (union, intersection, parity, difference), the left and right operands
 * are each a composite union, difference, or parity among multiple inputs, i.e.,
 *   * (operationA among Ai) OP (operationB among Bi)
 *   * where the Ai are one set of regions, being combined by operationA
 *   * and the Bi are the another set of regions, being combined by operationB.
 * * Each group of Ai and Bi is a `RegionGroup`.
 * * This is an extremely delicate structure.
 * * Members are public because of the unique variety of queries, but should only be used for queries.
 * * The graph and curves in the booleans are connected by an extended pointer chain:
 *    * (HalfEdge in Graph).edgeTag points to a CurveLocationDetail.
 *    * (CurveLocationDetail).curve points to a curve.
 *    * (Curve).parent points to RegionGroupMember.
 *    * (RegionGroupMember) points to RegionGroup.
 *    * (RegionGroup) points to RegionBooleanBinaryContext.
 * * So when a graph sweep crosses an edge
 *    * the chain leads to a parity count in the RegionGroupMember.
 *    * that can change the number of members active in the RegionGroup.
 *    * which can change the state of the context.
 * @internal
 */
export class RegionBooleanContext implements RegionOpsFaceToFaceSearchCallbacks {
  public groupA!: RegionGroup;
  public groupB!: RegionGroup;
  /** bridge edges */
  public extraGeometry!: RegionGroup;
  public graph!: HalfEdgeGraph;
  public faceAreaFunction!: NodeToNumberFunction;
  public binaryOp: RegionBinaryOpType;
  private constructor(groupTypeA: RegionGroupOpType, groupTypeB: RegionGroupOpType) {
    this.groupA = new RegionGroup(this, groupTypeA);
    this.groupB = new RegionGroup(this, groupTypeB);
    this.extraGeometry = new RegionGroup(this, RegionGroupOpType.NonBounding);
    this.binaryOp = RegionBinaryOpType.Union; // revised in runClassificationSweep
  }
  /**
   * Create a context with both A and B groups empty.
   * * Caller follows up by calls to `context.groupA.addMember (loopOrParityRegion)` or `context.groupB.addMember (loopOrParityRegion)`
   * @param groupTypeA
   * @param groupTypeB
   */
  public static create(groupTypeA: RegionGroupOpType, groupTypeB: RegionGroupOpType): RegionBooleanContext {
    return new RegionBooleanContext(groupTypeA, groupTypeB);
  }
  public addMembers(dataA: AnyRegion | AnyRegion[] | undefined, dataB: AnyRegion | AnyRegion[] | undefined) {
    this.groupA.addMember(dataA);
    this.groupB.addMember(dataB);
    this.addConnectives();
  }
  private _workSegment?: LineSegment3d;
  private static _bridgeDirection = Vector3d.createNormalized(1.0, -0.12328974132467)!; // magic unit direction to minimize vertex hits
  /**
   * The sweep operations require access to all geometry by edge crossings and face walk.
   * If input loops are non-overlapping, there may be disconnected islands not reachable.
   * This method:
   * * finds the total range
   * * creates parallel rays from the extreme point of each loop and extending beyond the overall range
   * * places those lines in the extraGeometry group
   */
  public addConnectives() {
    const rangeA = this.groupA.range();
    const rangeB = this.groupB.range();
    const rangeAB = rangeA.union(rangeB);
    const areaTol = RegionOps.computeXYAreaTolerance(rangeAB);
    let margin = 0.1;
    this._workSegment = PlaneAltitudeRangeContext.findExtremePointsInDirection(rangeAB.corners(), RegionBooleanContext._bridgeDirection, this._workSegment);
    if (this._workSegment)
      margin *= this._workSegment.point0Ref.distanceXY(this._workSegment.point1Ref);  // how much further to extend each bridge ray
    const maxPoints: Point3d[] = [];
    const findExtremePointsInLoop = (region: Loop) => {
      const area = RegionOps.computeXYArea(region);
      if (area === undefined || Math.abs(area) < areaTol)
        return;   // avoid bridging trivial faces
      this._workSegment = PlaneAltitudeRangeContext.findExtremePointsInDirection(region, RegionBooleanContext._bridgeDirection, this._workSegment);
      if (this._workSegment)
        maxPoints.push(this._workSegment.point1Ref);
    };
    for (const groupMembers of [this.groupA.members, this.groupB.members]) {
      for (const m of groupMembers) {
        if (m.region instanceof Loop) {
          findExtremePointsInLoop(m.region);
        } else if (m.region instanceof ParityRegion) {
          for (const loop of m.region.children)
            findExtremePointsInLoop(loop);
        }
      }
    }
    const ray = Ray3d.createZero();
    for (const p of maxPoints) {
      // Make a line from
      //    1) exactly the max point of the loops to
      //    2) a point clearly outside the big range
      // If p came from some inner loop this will
      //    1) create a bridge from the inner loop through any containing loops (always)
      //    2) avoid crossing any containing loop at a vertex. (with high probability, but not absolutely always)
      const bridgeLength = margin + Ray3d.create(p, RegionBooleanContext._bridgeDirection, ray).intersectionWithRange3d(rangeAB).high;
      const outside = Point3d.createAdd2Scaled(p, 1.0, RegionBooleanContext._bridgeDirection, bridgeLength);
      const bridgeLine = LineSegment3d.createXYXY(p.x, p.y, outside.x, outside.y);
      this.extraGeometry.addMember(bridgeLine, true);
    }
  }
  /**
   * Simplify the graph by removing bridge edges that do not serve to connect inner and outer loops, i.e.:
   * * the bridge edge is dangling
   * * the bridge edge is adjacent to multiple faces
   * * the bridge edge is adjacent to a negative area face
   * @returns the number of extraneous bridge edges removed from the graph.
   */
  private removeExtraneousBridgeEdges(): number {
    const toHeal: HalfEdge[] = [];
    const interiorBridges: HalfEdge[] = [];

    // lambda test for boundary edge. Relies only on face loop orientation. Doesn't use HalfEdgeMasks!
    const isExteriorEdge = (node: HalfEdge): boolean => {
      if (this.faceAreaFunction(node) < 0.0)
        return true;
      if (!node.findAroundFace(node.edgeMate))
        return this.faceAreaFunction(node.edgeMate) < 0.0;
      return false;
    };

    // isolate dangling bridges, bridges separating different faces, and "exterior" bridges in the negative area face
    this.graph.announceEdges((_graph: HalfEdgeGraph, node: HalfEdge): boolean => {
      if (node.edgeTag !== undefined) {
        if (node.edgeTag instanceof CurveLocationDetail) {
          if (node.edgeTag.curve) {
            if (node.edgeTag.curve.parent instanceof RegionGroupMember) {
              if (node.edgeTag.curve.parent.parentGroup === this.extraGeometry) {
                if (node.isDangling || node.edgeMate.isDangling || !node.findAroundFace(node.edgeMate) || this.faceAreaFunction(node) < 0.0) {
                  toHeal.push(node.vertexSuccessor);
                  toHeal.push(node.edgeMate.vertexSuccessor);
                  node.isolateEdge();
                } else {
                  interiorBridges.push(node);
                }
              }
            }
          }
        }
      }
      return true;
    });

    // At this point, all bridges that were exterior are isolated, but this may have caused formerly
    // interior bridges to become exterior. Now we successively isolate exterior bridges until none remain.
    let numIsolatedThisPass: number;
    do {
      numIsolatedThisPass = 0;
      for (const node of interiorBridges) {
        if (!node.isIsolatedEdge && isExteriorEdge(node)) {
          toHeal.push(node.vertexSuccessor);
          toHeal.push(node.edgeMate.vertexSuccessor);
          node.isolateEdge();
          numIsolatedThisPass++;
        }
      }
    } while (numIsolatedThisPass > 0);

    // lambda to extend the detail interval on a side of a healed edge
    const mergeDetails = (he: HalfEdge | undefined, newFraction?: number, newPoint?: Point3d): void => {
        if (he && he.edgeTag instanceof CurveLocationDetail && he.sortData !== undefined && newFraction !== undefined && newPoint) {
          if (he.sortData > 0)
            he.edgeTag.captureFraction1Point1(newFraction, newPoint);
          else
            he.edgeTag.captureFractionPoint(newFraction, newPoint);
        }
      };

    // At this point all removable bridges are isolated. Clean up their original vertex loops, if possible.
    for (const doomedA of toHeal) {
      const doomedB = doomedA.vertexSuccessor;
      if ( // are the geometries mergeable?
        doomedA !== doomedB &&
        doomedA.edgeTag instanceof CurveLocationDetail && doomedA.sortData !== undefined &&
        doomedB.edgeTag instanceof CurveLocationDetail && doomedB.sortData !== undefined &&
        doomedA.edgeTag.curve === doomedB.edgeTag.curve &&
        doomedA.edgeTag.hasFraction1 && doomedB.edgeTag.hasFraction1 &&
        doomedA.sortData * doomedB.sortData < 0 &&
        ((doomedA.sortData > 0 && Geometry.isSmallRelative(doomedA.edgeTag.fraction - doomedB.edgeTag.fraction1!)) ||
         (doomedA.sortData < 0 && Geometry.isSmallRelative(doomedA.edgeTag.fraction1! - doomedB.edgeTag.fraction)))
      ) {
        const survivorA = HalfEdge.healEdge(doomedA, false);
        if (survivorA) {
          const endFractionA = (doomedA.sortData > 0) ? doomedA.edgeTag.fraction1 : doomedA.edgeTag.fraction;
          const endPointA = (doomedA.sortData > 0) ? doomedA.edgeTag.point1 : doomedA.edgeTag.point;
          mergeDetails(survivorA, endFractionA, endPointA);
          const endFractionB = (doomedB.sortData > 0) ? doomedB.edgeTag.fraction1 : doomedB.edgeTag.fraction;
          const endPointB = (doomedB.sortData > 0) ? doomedB.edgeTag.point1 : doomedB.edgeTag.point;
          mergeDetails(survivorA.edgeMate, endFractionB, endPointB);
        }
      }
    }
    return this.graph.deleteIsolatedEdges();
  }
  /**
   * Markup and assembly steps for geometry in the RegionGroups.
   * * Annotate connection from group to curves.
   *    * groups with point data but no curves get no further annotation.
   * * compute intersections.
   * * assemble and merge the HalfEdgeGraph.
   * @param mergeTolerance absolute distance tolerance for merging loops
   */
  public annotateAndMergeCurvesInGraph(mergeTolerance: number = Geometry.smallMetricDistance) {
    const allPrimitives: CurvePrimitive[] = [];
    // ASSUME loops have fine-grained types (no linestrings)
    for (const group of [this.groupA, this.groupB, this.extraGeometry]) {
      for (const member of group.members) {
        let k = allPrimitives.length;
        if (member.region instanceof GeometryQuery) {
          RegionOps.collectCurvePrimitives(member.region, allPrimitives, true, true);
          for (; k < allPrimitives.length; k++)
            allPrimitives[k].parent = member;
        }
      }
    }
    const intersections = CurveCurve.allIntersectionsAmongPrimitivesXY(allPrimitives, mergeTolerance);
    const graph = PlanarSubdivision.assembleHalfEdgeGraph(allPrimitives, intersections, mergeTolerance);
    this.graph = graph;
    this.faceAreaFunction = faceAreaFromCurvedEdgeData;
    this.removeExtraneousBridgeEdges();
  }
  private _announceFaceFunction?: AnnounceClassifiedFace;
  /**
   * Sweep through the graph to assign in/out classifications to all faces.
   * * the classification is announced in two ways:
   *   * the EXTERNAL mask is set on all half edges that are NOT interior faces.
   *   * the announceFaceFunction is called once for each face.
   * @param binaryOp
   * @param announceFaceFunction
   */
  public runClassificationSweep(binaryOp: RegionBinaryOpType, announceFaceFunction?: AnnounceClassifiedFace): void {
    this._announceFaceFunction = announceFaceFunction;
    this.binaryOp = binaryOp;
    this.graph.clearMask(HalfEdgeMask.EXTERIOR);
    for (const group of [this.groupA, this.groupB])
      group.clearState();
    const faceHasBeenVisitedMask = this.graph.grabMask();
    const nodeHasBeenVisitedMask = this.graph.grabMask();
    const componentArray = GraphComponentArray.create(this.graph);
    for (const component of componentArray.components) {
      const exteriorHalfEdge = HalfEdgeGraphSearch.findMinimumAreaFace(component.faces, this.faceAreaFunction);
      if (exteriorHalfEdge) {
        const exteriorMask = HalfEdgeMask.EXTERIOR;
        const allMasksToClear = exteriorMask | faceHasBeenVisitedMask | nodeHasBeenVisitedMask;
        this.graph.clearMask(allMasksToClear);
        RegionOpsFaceToFaceSearch.faceToFaceSearchFromOuterLoop(
          this.graph, exteriorHalfEdge, faceHasBeenVisitedMask, nodeHasBeenVisitedMask, this,
        );
      }
    }
    this.graph.dropMask(faceHasBeenVisitedMask);
    this.graph.dropMask(nodeHasBeenVisitedMask);
  }
  // search the graph for faces with
  // .. exactly 2 edges
  // .. both with given mask
  // .. at least one mate is not exterior.
  // .. clear that mark
  public unmaskMaskedNullFaces(mask: number) {
    for (const nodeA of this.graph.allHalfEdges) {
      const nodeB = nodeA.faceSuccessor;
      if (nodeB.faceSuccessor === nodeA) {
        if (nodeA.getMask(mask) && nodeB.getMask(mask)) {
          if (!nodeA.edgeMate.getMask(mask) || !nodeB.edgeMate.getMask(mask)) {
            nodeA.clearMask(mask);
            nodeB.clearMask(mask);
          }
        }
      }
    }
  }
  private getInOut(): boolean {
    if (this.binaryOp === RegionBinaryOpType.Union)
      return this.groupA.getInOut() || this.groupB.getInOut();
    if (this.binaryOp === RegionBinaryOpType.Intersection)
      return this.groupA.getInOut() && this.groupB.getInOut();
    if (this.binaryOp === RegionBinaryOpType.AMinusB)
      return this.groupA.getInOut() && !this.groupB.getInOut();
    if (this.binaryOp === RegionBinaryOpType.BMinusA)
      return !this.groupA.getInOut() && this.groupB.getInOut();
    if (this.binaryOp === RegionBinaryOpType.Parity)
      return this.groupA.getInOut() !== this.groupB.getInOut();
    return false;
  }
  /**
   * Record transition across an edge as entry or exit from a RegionGroup.
   * * Work backward from the node to a RegionGroup.  This path can be:
   *   * If the node points to a CurveLocationDetail of a (possibly partial) curve, the path is (take a deep breath)
   *      * node points to CurveLocation Detail
   *      * CurveLocationDetail points to curve
   *      * curve points to RegionGroupMember
   *  * If the node points directly to a RegionGroup, it's ready to go!!!
   * @param node
   * @param delta
   */
  private recordTransitionAcrossEdge(node: HalfEdge, delta: number): RegionGroupMember | undefined {
    const updateRegionGroupMemberState = (member: RegionGroupMember): RegionGroupMember => {
      if (member.parentGroup.groupOpType === RegionGroupOpType.NonBounding)
        return member;  // no transition across a bridge edge
      if (delta !== 0) {
        const oldSweepState = member.sweepState;
        member.sweepState += delta;
        member.parentGroup.recordMemberStateChange(oldSweepState, member.sweepState);
      }
      return member;
    };

    const data = node.edgeTag;
    if (data instanceof RegionGroupMember)
      return updateRegionGroupMemberState(data);

    if (data instanceof CurveLocationDetail) {
      // We trust that the caller has linked from the graph node to a curve which has a RegionGroupMember as its parent.
      const member = data.curve!.parent;
      if (member instanceof RegionGroupMember)
        return updateRegionGroupMemberState(member);
    }
    return undefined;
  }
  // obligations to act as sweep callback ...
  /** Announce a representative node on the outer face of a component. */
  public startComponent(outerFaceNode: HalfEdge): boolean {
    outerFaceNode.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    if (this._announceFaceFunction)
      this._announceFaceFunction(this.graph, outerFaceNode, -1, faceAreaFromCurvedEdgeData(outerFaceNode));
    return true;
  }
  /** Announce return to outer face. */
  public finishComponent(_node: HalfEdge): boolean {
    return true;
  }
  /**
   * Announce entry to a graph face.
   * * Both both sides of a graph edge are from the same RegionGroupMember.
   * * Hence "crossing that edge" changes the parity count for the RegionGroupMember that owns that edge by 1.
   * * The parity count for other RegionGroupMembers are never affected by this crossing.
   * * Crossing a bridge edge does not change the parity count.
   */
  public enterFace(_facePathStack: HalfEdge[], newFaceNode: HalfEdge): boolean {
    this.recordTransitionAcrossEdge(newFaceNode, 1);
    const state = this.getInOut();
    if (!state)
      newFaceNode.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    if (this._announceFaceFunction)
      this._announceFaceFunction(this.graph, newFaceNode, state ? 1 : 0, faceAreaFromCurvedEdgeData(newFaceNode));
    return true;
  }
  /** Announce face exit */
  public leaveFace(_facePathStack: HalfEdge[], oldFaceNode: HalfEdge): boolean {
    this.recordTransitionAcrossEdge(oldFaceNode, -1);
    return true;
  }
}
/**
 * Return xy area between (part of) a curve and the x axis through a reference point.
 * If detail is undefined or does not have both start and end fractions, just do trapezoid area.
 */
function areaUnderPartialCurveXY(
  detail: CurveLocationDetail | undefined, xyStart: XAndY, xyEnd: XAndY, referencePoint: XAndY,
): number {
  // area between trapezoid and axis
  let trapezoidArea;
  if (detail && detail.point1) {
    trapezoidArea = -(detail.point1.x - detail.point.x) * (0.5 * (detail.point.y + detail.point1.y) - referencePoint.y);
  } else {
    trapezoidArea = -(xyEnd.x - xyStart.x) * (0.5 * (xyStart.y + xyEnd.y) - referencePoint.y);
  }
  let areaToChord = 0.0;
  if (detail && detail.curve && detail.hasFraction1) {
    if (detail.curve instanceof LineSegment3d) {
      // nothing to do for a line segment
    } else if (detail.curve instanceof Arc3d) {
      areaToChord = detail.curve.areaToChordXY(detail.fraction, detail.fraction1!);
    } else {
      const partial = detail.curve.clonePartialCurve(detail.fraction, detail.fraction1!);
      areaToChord = partial ?
        RegionOps.computeXYArea(Loop.create(partial, LineSegment3d.create(detail.point1!, detail.point))) ?? 0
        : 0;
    }
  }
  return trapezoidArea + areaToChord;
}
/** Compute face area for a face whose edges are decorated with CurveLocationDetail for their (partial) curves. */
function faceAreaFromCurvedEdgeData(faceSeed: HalfEdge): number {
  let area = 0.0;
  let edge = faceSeed;
  do {
    area += (edge.sortData as number) * areaUnderPartialCurveXY((edge.edgeTag as CurveLocationDetail), edge, edge.faceSuccessor, faceSeed);
  } while ((edge = edge.faceSuccessor) !== faceSeed);
  return area;
}

/**
 * Function to accumulate area under edges.
 * Array of nodes representing faces in a subset of a graph.
 * @internal
 */
export type NodeAndRangeFunction = (edge: HalfEdge, range: Range2d) => void;
/**
 * Array of nodes representing faces in a subset of a graph.
 * @internal
 */
export class GraphComponent {
  public faces: HalfEdge[];
  public faceAreas: number[];
  public range: Range2d;
  public constructor(faces: HalfEdge[]) {
    this.faces = faces;
    this.range = Range2d.createNull();
    this.faceAreas = [];
  }
  /**
   * Visit all vertices and edges in the component to build face area array and composite range.
   * @param extendRangeForEdge optional function to compute edge range.  If undefined, linear edge is assumed.
   * @param faceAreaFunction optional function to compute face area.  If undefined, linear edges are assumed.
   */
  public buildFaceData(extendRangeForEdge: NodeAndRangeFunction | undefined, faceAreaFunction: NodeToNumberFunction | undefined) {
    const vertexFunction = (node: HalfEdge) => {
      if (extendRangeForEdge)
        extendRangeForEdge(node, this.range);
      else
        this.range.extendXY(node.x, node.y);
      return 0;
    };
    this.range.setNull();
    for (const f of this.faces) {
      f.sumAroundFace(vertexFunction);
    }
    this.faceAreas.length = 0;
    if (!faceAreaFunction)
      faceAreaFunction = (node) => HalfEdgeGraphSearch.signedFaceArea(node);
    for (const f of this.faces) {
      this.faceAreas.push(faceAreaFunction(f));
    }
  }
}
/**
 * Build and hold an array of component data for a HalfEdgeGraph.
 * @internal
 */
export class GraphComponentArray {
  public components: GraphComponent[];
  public graph: HalfEdgeGraph;
  private constructor(graph: HalfEdgeGraph) {
    this.graph = graph;
    this.components = [];
  }
  public static create(
    graph: HalfEdgeGraph, extendRangeForEdge?: (edge: HalfEdge, range: Range2d) => void,
  ): GraphComponentArray {
    const result = new GraphComponentArray(graph);
    const componentArrays = HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(graph, undefined);
    for (const componentFaces of componentArrays) {
      const component = new GraphComponent(componentFaces);
      component.buildFaceData(extendRangeForEdge, faceAreaFromCurvedEdgeData);
      result.components.push(component);
    }
    return result;
  }
}
