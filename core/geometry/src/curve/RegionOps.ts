/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { AnyRegion } from "./CurveChain";
import { MomentData } from "../geometry4d/MomentData";
import { RegionMomentsXY } from "./RegionMomentsXY";
import { HalfEdgeGraph, HalfEdge, HalfEdgeMask } from "../topology/Graph";
import { Triangulator, MultiLineStringDataVariant, LineStringDataVariant } from "../topology/Triangulation";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { RegularizationContext } from "../topology/RegularizeFace";
import { HalfEdgeGraphMerge } from "../topology/Merging";
import { HalfEdgeGraphSearch } from "../topology/HalfEdgeGraphSearch";
import { Polyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";

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
 */
abstract class RegionOpsFaceToFaceSearchCallbacks {
  /** Announce a representative node on the outer face of a component */
  public startComponent(_node: HalfEdge): boolean { return true; }
  /** Announce return to outer face */
  public finishComponent(_node: HalfEdge): boolean { return true; }
  /** Announce face entry */
  public enterFace(_facePathStack: HalfEdge[], _newFaceNode: HalfEdge): boolean { return true; }
  /** Announce face exit */
  public leaveFace(_facePathStack: HalfEdge[], _newFaceNode: HalfEdge): boolean { return true; }
}
/** Function signature to test if a pair of boolean states is to be accepted by area booleans (during face-to-face sweeps) */
type BinaryBooleanAcceptFunction = (stateA: boolean, stateB: boolean) => boolean;
/**
 * Implementations of `RegionOpsFaceToFaceSearchCallbacks` for binary boolean sweep.
 * * This assumes the each node in the graph has edgeTag set to:
 *   * `edgeTag === undefined` if the edge crossing the edge does not change classification.
 *     * for example, an edge added by regularization
 *   * `edgeTag === 1` if this is a boundary for the first of the boolean input regions
 *   * `edgeTag === 2` if this is a boundary for the first of the boolean input regions
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
 */
class RegionOpsBooleanSweepCallbacks extends RegionOpsFaceToFaceSearchCallbacks {
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
  public startComponent(node: HalfEdge): boolean { node.setMaskAroundFace(this._exteriorMask); return true; }
  /**
   * * If necessary, toggle a term state.
   * * if indicated, mark this face exterior.
   */
  public enterFace(_facePathStack: HalfEdge[], node: HalfEdge): boolean {
    const thisFaceIndex = node.edgeTag;
    if (node.edgeTag === 1 || node.edgeTag === 2) this._inComponent[thisFaceIndex] = !this._inComponent[thisFaceIndex];
    if (!this._faceSelectFunction(this._inComponent[1], this._inComponent[2]))
      node.setMaskAroundFace(this._exteriorMask);

    return true;
  }
  /**
   * * If necessary, toggle a term state.
   */
  public leaveFace(_facePathStack: HalfEdge[], node: HalfEdge): boolean {
    const thisFaceIndex = node.edgeTag;
    if (node.edgeTag === 1 || node.edgeTag === 2) this._inComponent[thisFaceIndex] = !this._inComponent[thisFaceIndex];
    return true;
  }
}

/**
 * run a DFS with face-to-face step announcements.
 * * false return from any function terminates search immediately.
 * @param graph containing graph.
 */
function faceToFaceSearchFromOuterLoop(_graph: HalfEdgeGraph,
  seed: HalfEdge,
  faceHasBeenVisited: HalfEdgeMask,
  callbacks: RegionOpsFaceToFaceSearchCallbacks) {
  if (seed.isMaskSet(faceHasBeenVisited))
    return;
  if (!callbacks.startComponent(seed))
    return;

  const facePathStack = [];
  seed.setMaskAroundFace(faceHasBeenVisited);
  let faceWalker = seed;
  do {
    let entryNode = seed;
    let mate = faceWalker.edgeMate;
    if (!mate.isMaskSet(faceHasBeenVisited)) {

      // the faceWalker seed is always on the base of the stack.
      // the stack then contains even-odd pairs of (entryNode, currentNode)
      // * entryNode is the node where a face was entered.
      // * faceNode is another node around that face.

      facePathStack.push(faceWalker);
      facePathStack.push(mate);
      let faceNode = mate.faceSuccessor;
      mate.setMaskAroundFace(faceHasBeenVisited);
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
        }
      }
    }
    // continue at outermost level .....
    faceWalker = faceWalker.faceSuccessor;
  }
  while (faceWalker !== seed);

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
function doPolygonBoolean(loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant, faceSelectFunction: (inA: boolean, inB: boolean) => boolean): Polyface | undefined {
  const graph = new HalfEdgeGraph();
  const baseMask = HalfEdgeMask.BOUNDARY_EDGE | HalfEdgeMask.PRIMARY_EDGE;
  const seedA = RegionOps.addLoopsWithEdgeTagToGraph(graph, loopsA, baseMask, 1);
  const seedB = RegionOps.addLoopsWithEdgeTagToGraph(graph, loopsB, baseMask, 2);
  if (seedA && seedB) {
    // split edges where they cross . . .
    HalfEdgeGraphMerge.splitIntersectingEdges(graph);
    // sort radially around vertices.
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
    // add edges to connect various components  (e.g. holes!!!)
    const context = new RegularizationContext(graph);
    context.regularizeGraph(true, true);
    const exteriorHalfEdge = HalfEdgeGraphSearch.findMinimumAreaFace(graph);
    const exteriorMask = HalfEdgeMask.EXTERIOR;
    const visitMask = HalfEdgeMask.VISITED;
    const exteriorVisitMask = exteriorMask | visitMask;
    graph.clearMask(exteriorVisitMask);
    const callbacks = new RegionOpsBooleanSweepCallbacks(faceSelectFunction, exteriorMask);
    faceToFaceSearchFromOuterLoop(graph,
      exteriorHalfEdge,
      visitMask,
      callbacks);
    return PolyfaceBuilder.graphToPolyface(graph);
  }
  return undefined;
}

/**
 * class `RegionOps` has static members for calculations on regions (areas).
 * * Regions are represented by these `CurveCollection` subclasses:
 * * `Loop` -- a single loop
 * * `ParityRegion` -- a collection of loops, interpreted by parity rules.
 *    * The common "One outer loop and many Inner loops" is a parity region.
 * * `UnionRegion` -- a collection of `Loop` and `ParityRegion` objects understood as a (probably disjoint) union.
 * @alpha
 */
export class RegionOps {
  /**
   * Return moment data for a loop, parity region, or union region.
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
   * * create loops in the graph.
   * @internal
   */
  public static addLoopsToGraph(graph: HalfEdgeGraph, data: MultiLineStringDataVariant, announceIsolatedLoop: (graph: HalfEdgeGraph, seed: HalfEdge) => void) {
    if (data instanceof IndexedXYZCollection) {
      const loopSeed = Triangulator.directCreateFaceLoopFromCoordinates(graph, data as IndexedXYZCollection);
      if (loopSeed !== undefined)
        announceIsolatedLoop(graph, loopSeed);
    } else if (Array.isArray(data)) {
      if (data.length > 0) {
        if (Point3d.isXAndY(data[0])) {
          const loopSeed = Triangulator.directCreateFaceLoopFromCoordinates(graph, data as LineStringDataVariant);
          if (loopSeed !== undefined)
            announceIsolatedLoop(graph, loopSeed);

        } else if (data[0] instanceof IndexedXYZCollection) {
          for (const loop of data) {
            const loopSeed = Triangulator.directCreateFaceLoopFromCoordinates(graph, loop as IndexedXYZCollection);
            if (loopSeed !== undefined)
              announceIsolatedLoop(graph, loopSeed);
          }
        }
      }
    }
  }
  /** Add multiple loops to a graph.
   * * Apply edgeTag and mask to each edge.
   * @internal
   */
  public static addLoopsWithEdgeTagToGraph(graph: HalfEdgeGraph, data: MultiLineStringDataVariant, mask: HalfEdgeMask, edgeTag: any): HalfEdge[] | undefined {
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
   * return a polyface containing the area union of two XY regions.
   * * Within each region, in and out is determined by parity rules.
   *   * Any face that is an odd number of crossings from the far outside is IN
   *   * Any face that is an even number of crossings from the far outside is OUT
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   */
  public static polygonXYAreaIntersectLoopsToPolyface(loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant): Polyface | undefined {
    return doPolygonBoolean(loopsA, loopsB,
      (inA: boolean, inB: boolean) => (inA && inB));
  }

  /**
   * return a polyface containing the area intersection of two XY regions.
   * * Within each region, in and out is determined by parity rules.
   *   * Any face that is an odd number of crossings from the far outside is IN
   *   * Any face that is an even number of crossings from the far outside is OUT
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   */
  public static polygonXYAreaUnionLoopsToPolyface(loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant): Polyface | undefined {
    return doPolygonBoolean(loopsA, loopsB,
      (inA: boolean, inB: boolean) => (inA || inB));
  }
  /**
   * return a polyface containing the area difference of two XY regions.
   * * Within each region, in and out is determined by parity rules.
   *   * Any face that is an odd number of crossings from the far outside is IN
   *   * Any face that is an even number of crossings from the far outside is OUT
   * @param loopsA first set of loops
   * @param loopsB second set of loops
   */
  public static polygonXYAreaDifferenceLoopsToPolyface(loopsA: MultiLineStringDataVariant, loopsB: MultiLineStringDataVariant): Polyface | undefined {
    return doPolygonBoolean(loopsA, loopsB,
      (inA: boolean, inB: boolean) => (inA && !inB));
  }

}
