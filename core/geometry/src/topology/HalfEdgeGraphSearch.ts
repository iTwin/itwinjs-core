/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { HalfEdge, HalfEdgeGraph, HalfEdgeMask, HalfEdgeToBooleanFunction, NodeToNumberFunction } from "./Graph";
import { SignedDataSummary } from "./SignedDataSummary";
import { XYParitySearchContext } from "./XYParitySearchContext";

/**
 * Interface for an object that executes boolean tests on edges.
 */
export interface HalfEdgeTestObject {
  testEdge(h: HalfEdge): boolean;
}
/**
 */
export class HalfEdgeMaskTester {
  private _targetMask: HalfEdgeMask;
  private _targetValue: boolean;
  /**
   *
   * @param mask mask to test in `testEdge` function
   * @param targetValue value to match for true return
   */
  public constructor(mask: HalfEdgeMask, targetValue: boolean = true) {
    this._targetMask = mask;
    this._targetValue = targetValue;
  }
  /** Return true if the value of the targetMask matches the targetValue */
  public testEdge(edge: HalfEdge): boolean {
    return edge.isMaskSet(this._targetMask) === this._targetValue;
  }

}
// Search services for HalfEdgeGraph
export class HalfEdgeGraphSearch {

  /**
   * * for each node of face, set the mask push to allNodesStack
   * * push the faceSeed on onePerFaceStack[]
   */
  private static pushAndMaskAllNodesInFace(faceSeed: HalfEdge, mask: number, allNodeStack: HalfEdge[], onePerFaceStack: HalfEdge[]) {
    onePerFaceStack.push(faceSeed);
    faceSeed.collectAroundFace((node: HalfEdge) => {
      node.setMask(mask);
      allNodeStack.push(node);
    });
  }

  /**
   * Search an array of faceSeed nodes for the face with the most negative area.
   * @param oneCandidateNodePerFace array containing one node from each face to be considered.
   */
  public static findMinimumAreaFace(oneCandidateNodePerFace: HalfEdgeGraph | HalfEdge[],
    faceAreaFunction?: NodeToNumberFunction): HalfEdge {
    const summary = HalfEdgeGraphSearch.collectFaceAreaSummary(oneCandidateNodePerFace, false, faceAreaFunction);
    return summary.largestNegativeItem!;
  }
  /**
   * static method for face area computation -- useful as function parameter in collect FaceAreaSummary.
   * * This simply calls `node.signedFaceArea ()`
   * @param node instance for signedFaceArea call.
   */
  public static signedFaceArea(node: HalfEdge): number { return node.signedFaceArea(); }
  /**
   *
   * Return a summary structure data about face (or other numeric quantity if the caller's areaFunction returns other value)
   * * The default areaFunction computes area of polygonal face.
   * * Callers with curved edge graphs must supply their own area function.
   * @param source graph or array of nodes to examine
   * @param collectAllNodes flag to pass to the SignedDataSummary constructor to control collection of nodes.
   * @param areaFunction function to all to obtain area (or other numeric value)
   */
  public static collectFaceAreaSummary(source: HalfEdgeGraph | HalfEdge[], collectAllNodes: boolean = false,
    areaFunction: NodeToNumberFunction = HalfEdgeGraphSearch.signedFaceArea): SignedDataSummary<HalfEdge> {
    const result = new SignedDataSummary<HalfEdge>(collectAllNodes);
    let allFaces: HalfEdge[];

    if (source instanceof HalfEdgeGraph)
      allFaces = source.collectFaceLoops();
    else
      allFaces = source;

    for (const node of allFaces) {
      const area = areaFunction(node);
      result.announceItem(node, area);
    }
    return result;
  }

  /**
   * * Test if the graph is triangulated.
   * * Return false if:
   *   * Positive area face with more than 3 edges
   *   * more than 1 negative area face with `allowMultipleNegativeAreaFaces` false
   * * 2-edge faces are ignored.
   */
  public static isTriangulatedCCW(source: HalfEdgeGraph | HalfEdge[], allowMultipleNegativeAreaFaces: boolean = true, numPositiveExceptionsAllowed = 0): boolean {
    let allFaces: HalfEdge[];

    if (source instanceof HalfEdgeGraph)
      allFaces = source.collectFaceLoops();
    else
      allFaces = source;
    let numNegative = 0;
    let numPositiveExceptions = 0;
    for (const node of allFaces) {
      const numEdges = node.countEdgesAroundFace();
      if (numEdges >= 3) {
        const area = node.signedFaceArea();
        if (area > 0) {
          if (numEdges > 3) {
            numPositiveExceptions++;
            if (numPositiveExceptions > numPositiveExceptionsAllowed)
              return false;
          }
        } else {
          numNegative++;
          if (numNegative > 1) {
            if (!allowMultipleNegativeAreaFaces)
              return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Search to all accessible faces from given seed.
   * * The returned array contains one representative node in each face of the connected component.
   * * If (nonnull) parity mask is given, on return:
   *    * It is entirely set or entirely clear around each face
   *    * It is entirely set on all faces that are an even number of face-to-face steps away from the seed.
   *    * It is entirely clear on all faces that are an odd number of face-to-face steps away from the seed.
   * @param seedEdge first edge to search.
   * @param visitMask mask applied to all faces as visited.
   * @param parityMask mask to apply (a) to first face, (b) to faces with alternating parity during the search.
   */
  private static parityFloodFromSeed(seedEdge: HalfEdge, visitMask: HalfEdgeMask, parityEdgeTester: HalfEdgeTestObject | undefined, parityMask: HalfEdgeMask): HalfEdge[] {
    const faces: HalfEdge[] = [];
    if (seedEdge.isMaskSet(visitMask)) return faces; // empty

    const allMasks = parityMask | visitMask;
    const stack: HalfEdge[] = [];
    // arbitrarily call the seed face exterior ... others will alternate as visited.
    HalfEdgeGraphSearch.pushAndMaskAllNodesInFace(seedEdge, allMasks, stack, faces);  // Start with exterior as mask
    while (stack.length > 0) {
      const p = stack.pop()!;
      const mate = p.edgeMate;
      if (!mate)
        continue;
      if (!mate.isMaskSet(visitMask)) {
        let newState = p.isMaskSet(parityMask);
        if (!parityEdgeTester || parityEdgeTester.testEdge(p))
          newState = !newState;
        HalfEdgeGraphSearch.pushAndMaskAllNodesInFace(mate, newState ? allMasks : visitMask, stack, faces);
      }
    }
    return faces;
  }
  /**
   * * Search the given faces for the one with the minimum area.
   * * If the mask in that face is OFF, toggle it on (all half edges of) all the faces.
   * * In a properly merged planar subdivision there should be only one true negative area face per component.
   * @param graph parent graph
   * @param parityMask mask which was previously set with alternating parity, but with an arbitrary start face.
   * @param faces array of faces to search.
   */
  private static correctParityInSingleComponent(_graph: HalfEdgeGraph, mask: HalfEdgeMask, faces: HalfEdge[]) {
    const exteriorHalfEdge = HalfEdgeGraphSearch.findMinimumAreaFace(faces);
    if (!exteriorHalfEdge) {
    } else if (exteriorHalfEdge.isMaskSet(mask)) {
      // all should be well .. nothing to do.
    } else {
      // TOGGLE around the face (assuming all are consistent with the seed)
      for (const faceSeed of faces) {
        if (faceSeed.isMaskSet(mask)) {
          faceSeed.clearMaskAroundFace(mask);
        } else {
          faceSeed.setMaskAroundFace(mask);
        }
      }
    }
  }
  /** Apply correctParityInSingleComponent to each array in components. (Quick exit if mask in NULL_MASK) */
  private static correctParityInComponentArrays(graph: HalfEdgeGraph, mask: HalfEdgeMask, components: HalfEdge[][]) {
    if (mask === HalfEdgeMask.NULL_MASK)
      return;
    for (const facesInComponent of components)
      HalfEdgeGraphSearch.correctParityInSingleComponent(graph, mask, facesInComponent);
  }
  /**
   * Collect arrays gathering faces by connected component.
   * @param graph graph to inspect
   * @param parityEdgeTester (optional) function to test of an edge is a parity change.
   * @param parityMask (optional, along with boundaryTestFunction) mask to apply indicating parity.  If this is Mask.NULL_MASK, there is no record of parity.
   */
  public static collectConnectedComponentsWithExteriorParityMasks(graph: HalfEdgeGraph, parityEdgeTester: HalfEdgeTestObject | undefined, parityMask: HalfEdgeMask = HalfEdgeMask.NULL_MASK): HalfEdge[][] {
    const components = [];
    const visitMask = HalfEdgeMask.VISITED;
    const allMasks = parityMask | visitMask;
    graph.clearMask(allMasks);
    for (const faceSeed of graph.allHalfEdges) {
      if (!faceSeed.isMaskSet(HalfEdgeMask.VISITED)) {
        const newFaces = HalfEdgeGraphSearch.parityFloodFromSeed(faceSeed, visitMask, parityEdgeTester, parityMask);
        components.push(newFaces);
      }
    }
    HalfEdgeGraphSearch.correctParityInComponentArrays(graph, parityMask, components);
    return components;
  }
  /**
   * Test if (x,y) is inside (1), on an edge (0) or outside (-1) a face.
   * @param seedNode any node on the face loop
   * @param x x coordinate of test point.
   * @param y y coordinate of test point.
   */
  public static pointInOrOnFaceXY(seedNode: HalfEdge, x: number, y: number): number | undefined {
    const context = new XYParitySearchContext(x, y);
    // walk around looking for an accepted node to start the search (seedNode is usually ok!)
    let nodeA = seedNode;
    let nodeB = seedNode.faceSuccessor;
    for (; ; nodeA = nodeB) {
      if (context.tryStartEdge(nodeA.x, nodeA.y, nodeB.x, nodeB.y))
        break;
      if (nodeB === seedNode) {
        // umm.. the face is all on the x axis?
        return context.classifyCounts();
      }
      nodeB = nodeA.faceSuccessor;
    }

    // nodeB is the real start node for search ... emit ends of each edge around the face,
    //   stopping after emitting nodeB as an edge end.
    let node = nodeB.faceSuccessor;
    for (; ;) {
      if (!context.advance(node.x, node.y)) {
        return context.classifyCounts();
      }
      if (node === nodeB)
        break;
      node = node.faceSuccessor;
    }
    return context.classifyCounts();
  }
  /**
   * Announce nodes that are "extended face boundary" by conditions (usually mask of node and mate) in test functions.
   * * After each node, the next candidate in reached by looking "around the head vertex loop" for the next boundary.
   *   * "Around the vertex" from nodeA means
   *      * First look at nodeA.faceSuccessor;
   *      * Then look at vertexPredecessor around that vertex loop.
   * * Each accepted node is passed to announceNode, and marked with the visit mask.
   * * The counter of the announceEdge function is zero for the first edge, then increases with each edge.
   * @param seed start node.
   * @param isBoundaryEdge
   * @param announceEdge
   */
  public static collectExtendedBoundaryLoopFromSeed(seed: HalfEdge, visitMask: HalfEdgeMask, isBoundaryEdge: HalfEdgeToBooleanFunction,
    announceEdge: (edge: HalfEdge, counter: number) => void) {
    let counter = 0;
    while (!seed.getMask(visitMask) && isBoundaryEdge(seed)) {
      announceEdge(seed, counter++);
      seed.setMask(visitMask);
      const vertexBase = seed.faceSuccessor;
      let candidateAroundVertex = vertexBase;
      for (; ;) {
        if (candidateAroundVertex.getMask(visitMask))
          return;
        if (isBoundaryEdge(candidateAroundVertex)) {
          seed = candidateAroundVertex;
          break;
        }
        candidateAroundVertex = candidateAroundVertex.vertexPredecessor;
        if (candidateAroundVertex === vertexBase)
          break;
      }
    }
  }
  /**
   * Collect arrays of nodes "around the boundary" of a graph with extraneous (non-boundary) edges.
   * * The "boundary" is nodes that do NOT have the exterior mask, but whose mates DO have the exterior mask.
   * * After each node, the next candidate in reached by looking "around the head vertex loop" for the next boundary.
   *   * "Around the vertex" from nodeA means
   *      * First look at nodeA.faceSuccessor;
   *      * Then look at vertexPredecessor around that vertex loop.
   * * Each accepted node is passed to announceNode, and marked with the visit mask.
   * @param seed start node.
   * @param isBoundaryNode
   * @param announceNode
   */
  public static collectExtendedBoundaryLoopsInGraph(graph: HalfEdgeGraph, exteriorMask: HalfEdgeMask): HalfEdge[][] {
    const loops: HalfEdge[][] = [];
    const visitMask = graph.grabMask(true);
    const isBoundaryEdge = (edge: HalfEdge): boolean => {
      return edge.getMask(exteriorMask) === 0 && edge.edgeMate.getMask(exteriorMask) !== 0;
    };
    const announceEdgeInBoundary = (edge: HalfEdge, counter: number) => {
      if (counter === 0)
        loops.push([]);
      loops[loops.length - 1].push(edge);
    };
    for (const seed of graph.allHalfEdges) {
      this.collectExtendedBoundaryLoopFromSeed(seed, visitMask, isBoundaryEdge, announceEdgeInBoundary);
    }
    graph.dropMask(visitMask);
    return loops;
  }
}
