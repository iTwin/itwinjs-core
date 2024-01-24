/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */
import { Range1d } from "../geometry3d/Range";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask, HalfEdgeToBooleanFunction, NodeFunction, NodeToNumberFunction } from "./Graph";
import { SignedDataSummary } from "./SignedDataSummary";
import { XYParitySearchContext } from "./XYParitySearchContext";

// cspell:word internaldocs

/**
 * Interface for an object that executes boolean tests on edges.
 * @internal
 */
export interface HalfEdgeTestObject {
  testEdge(h: HalfEdge): boolean;
}
/**
 * Class to test match of half edge mask.
 * @internal
 */
export class HalfEdgeMaskTester {
  private _targetMask: HalfEdgeMask;
  private _targetValue: boolean;
  /**
   * Constructor
   * @param mask mask to test in `testEdge` function
   * @param targetValue value to match for true return
   */
  public constructor(mask: HalfEdgeMask, targetValue: boolean = true) {
    this._targetMask = mask;
    this._targetValue = targetValue;
  }
  /** Return true if the value of the targetMask matches the targetValue. */
  public testEdge(edge: HalfEdge): boolean {
    return edge.isMaskSet(this._targetMask) === this._targetValue;
  }
}
/**
 * Class for different types of searches for HalfEdgeGraph.
 *  @internal
 */
export class HalfEdgeGraphSearch {
  /**
   * Static method for face area computation -- useful as function parameter in `collectFaceAreaSummary`.
   * * This simply calls `node.signedFaceArea()`
   * @param node instance for signedFaceArea call.
   */
  public static signedFaceArea(node: HalfEdge): number {
    return node.signedFaceArea();
  }
  /**
   * Return a summary of face data (e.g., area) as computed by the callback on the faces of the graph.
   * * Callers with curved edge graphs must supply their own area function.
   * @param source graph or array of nodes to examine.
   * @param collectAllNodes flag to pass to the `SignedDataSummary` constructor to control collection of nodes.
   * @param areaFunction function to obtain area (or other numeric value). Default computes polygonal face area.
   */
  public static collectFaceAreaSummary(
    source: HalfEdgeGraph | HalfEdge[],
    collectAllNodes: boolean = false,
    areaFunction: NodeToNumberFunction = (node) => HalfEdgeGraphSearch.signedFaceArea(node),
  ): SignedDataSummary<HalfEdge> {
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
   * Search the graph for the face with the most negative area.
   * @param oneCandidateNodePerFace graph or an array containing one node from each face to be considered.
   * @returns node on the negative area face with largest absolute area, or `undefined` if no negative area face.
   */
  public static findMinimumAreaFace(
    oneCandidateNodePerFace: HalfEdgeGraph | HalfEdge[], faceAreaFunction?: NodeToNumberFunction,
  ): HalfEdge | undefined {
    const summary = HalfEdgeGraphSearch.collectFaceAreaSummary(oneCandidateNodePerFace, false, faceAreaFunction);
    return summary.largestNegativeItem;
  }
  /**
   * Test if the graph is triangulated.
   * * Return `false` if:
   *   * number of positive area faces with more than 3 edges is larger than `numPositiveExceptionsAllowed`.
   *   * graph has more than 1 negative area face when `allowMultipleNegativeAreaFaces` is `false`.
   * * 2-edge faces are ignored.
   */
  public static isTriangulatedCCW(
    source: HalfEdgeGraph | HalfEdge[],
    allowMultipleNegativeAreaFaces: boolean = true,
    numPositiveExceptionsAllowed: number = 0,
  ): boolean {
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
   * Process a face during graph traversal.
   * @param faceSeed a node in the face.
   * @param mask mask to set on each node of the face.
   * @param allNodeStack array appended with each node of the face.
   * @param onePerFaceStack array appended with `faceSeed`.
   */
  private static pushAndMaskAllNodesInFace(
    faceSeed: HalfEdge, mask: number, allNodeStack: HalfEdge[], onePerFaceStack: HalfEdge[],
  ): void {
    onePerFaceStack.push(faceSeed);
    faceSeed.collectAroundFace((node: HalfEdge) => {
      node.setMask(mask);
      allNodeStack.push(node);
    });
  }
  /**
   * Traverse (via Depth First Search) to all accessible faces from the given seed.
   * @param faceSeed first node to start the traverse.
   * @param visitMask mask applied to all faces as visited.
   * @param parityEdgeTester function to test if an edge is adjacent to two faces of opposite parity, e.g., a boundary
   * edge that separates an "interior" face and an "exterior" face. If `parityEdgeTester` is not supplied and `parityMask`
   * is supplied, the default parity rule is to alternate parity state in a "bullseye" pattern starting at the seed face,
   * with each successive concentric ring of faces at constant topological distance from the seed face receiving the
   * opposite parity state of the previous ring.
   * @param parityMask mask to apply to the first face and faces that share the same parity as the first face, as
   * determined by the parity rule. If this is `NULL_MASK`, there is no record of parity. If (non-null) parity mask
   * is given, on return it is entirely set or entirely clear around each face.
   * @returns an array that contains one representative node in each face of the connected component.
   */
  private static parityFloodFromSeed(
    faceSeed: HalfEdge,
    visitMask: HalfEdgeMask,
    parityEdgeTester: HalfEdgeTestObject | undefined,
    parityMask: HalfEdgeMask,
  ): HalfEdge[] {
    const faces: HalfEdge[] = [];
    if (faceSeed.isMaskSet(visitMask))
      return faces; // empty array
    const allMasks = parityMask | visitMask;
    const stack: HalfEdge[] = [];
    // the seed face is arbitrarily assigned the parity mask
    HalfEdgeGraphSearch.pushAndMaskAllNodesInFace(faceSeed, allMasks, stack, faces);
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
   * * Correct the parity mask in the faces of a component.
   * * It is assumed that the parity mask is applied _consistently_ throughout the supplied faces, but maybe
   * not _correctly_.
   * * A consistently applied parity mask is "correct" if it is set on the negative area ("exterior") face of
   * a connected component.
   * * This method finds a face with negative area and toggles the mask throughout the input faces if this face
   * lacks the parity mask.
   * * In a properly merged planar subdivision there should be only one true negative area face per component.
   */
  private static correctParityInSingleComponent(parityMask: HalfEdgeMask, faces: HalfEdge[]): void {
    const exteriorHalfEdge = HalfEdgeGraphSearch.findMinimumAreaFace(faces);
    if (!exteriorHalfEdge) {
      // graph has all degenerate faces; do nothing
    } else if (exteriorHalfEdge.isMaskSet(parityMask)) {
      // all should be well; nothing to do
    } else {
      for (const faceSeed of faces) {
        if (faceSeed.isMaskSet(parityMask)) {
          faceSeed.clearMaskAroundFace(parityMask);
        } else {
          faceSeed.setMaskAroundFace(parityMask);
        }
      }
    }
  }
  /** Apply `correctParityInSingleComponent` to each array in components (quick exit if `parityMask` is `NULL_MASK`). */
  private static correctParityInComponentArrays(parityMask: HalfEdgeMask, components: HalfEdge[][]): void {
    if (parityMask === HalfEdgeMask.NULL_MASK)
      return;
    for (const facesInComponent of components)
      HalfEdgeGraphSearch.correctParityInSingleComponent(parityMask, facesInComponent);
  }
  /**
   * Collect connected components of the graph (via Depth First Search).
   * @param graph graph to inspect.
   * @param parityEdgeTester (optional) function to test if an edge is adjacent to two faces of opposite parity,
   * e.g., a boundary edge that separates an "interior" face and an "exterior" face. If `parityEdgeTester` is not
   * supplied and `parityMask` is supplied, the default parity rule is to alternate parity state in a "bullseye"
   * pattern starting at the seed face, with each successive concentric ring of faces at constant topological
   * distance from the seed face receiving the opposite parity state of the previous ring.
   * @param parityMask (optional) mask to apply to the first face and faces that share the same parity as the
   * first face, as determined by the parity rule. If this is `NULL_MASK`, there is no record of parity. If
   * (non-null) parity mask is given, on return it is entirely set or entirely clear around each face.
   * @returns the components of the graph, each component represented by an array of nodes, one node per face
   * of the component. In other words, entry [i][j] is a HalfEdge in the j_th face loop of the i_th component.
   */
  public static collectConnectedComponentsWithExteriorParityMasks(
    graph: HalfEdgeGraph,
    parityEdgeTester: HalfEdgeTestObject | undefined,
    parityMask: HalfEdgeMask = HalfEdgeMask.NULL_MASK,
  ): HalfEdge[][] {
    // Illustration of the algorithm can be found at geometry/internaldocs/Graph.md
    const components = [];
    const visitMask = HalfEdgeMask.VISITED;
    const allMasks = parityMask | visitMask;
    graph.clearMask(allMasks);
    for (const faceSeed of graph.allHalfEdges) {
      if (!faceSeed.isMaskSet(visitMask)) {
        const newFaces = HalfEdgeGraphSearch.parityFloodFromSeed(faceSeed, visitMask, parityEdgeTester, parityMask);
        // parityFloodFromSeed does not return an empty array because it is called on an unvisited faceSeed
        components.push(newFaces);
      }
    }
    HalfEdgeGraphSearch.correctParityInComponentArrays(parityMask, components);
    return components;
  }
  /**
   * Breadth First Search through connected component of a graph.
   * @param component vector of nodes, one per face.
   * @param seed seed node in component.
   * @param visitMask mask to apply to visited nodes. Assumed cleared throughout component.
   * @param ignoreMask (optional) mask preset on faces to ignore. Default value is `HalfEdgeMask.EXTERIOR` to
   * ignore exterior faces. Pass `HalfEdgeMask.NULL_MASK` to process all faces.
   * @param maxFaceCount (optional) maximum number of faces in the component. Should be positive; otherwise
   * `Infinity` is used.
   * @returns node at which to start next component if maximum face count exceeded, or undefined.
   */
  private static exploreComponent(
    component: HalfEdge[],
    seed: HalfEdge,
    visitMask: HalfEdgeMask,
    ignoreMask: HalfEdgeMask = HalfEdgeMask.EXTERIOR,
    maxFaceCount: number = Infinity,
  ): HalfEdge | undefined {
    if (maxFaceCount <= 0)
      maxFaceCount = Infinity;
    const boundaryMask: HalfEdgeMask = visitMask | ignoreMask;
    let numFaces = 0;
    const candidates: HalfEdge[] = []; // the queue
    candidates.push(seed);
    while (candidates.length !== 0 && numFaces < maxFaceCount) {
      // shift is O(n) and may be inefficient for large queues; if needed, we can replace
      // queue by circular array or implement the queue using 2 stacks; both are O(1)
      const node = candidates.shift()!;
      if (node.isMaskSet(boundaryMask))
        continue;
      component.push(node);
      ++numFaces;
      const enqueueNeighboringFaces: NodeFunction = (heNode: HalfEdge) => {
        heNode.setMask(visitMask);
        const neighbor = heNode.vertexSuccessor;
        if (!neighbor.isMaskSet(boundaryMask))
          candidates.push(neighbor);
      };
      node.collectAroundFace(enqueueNeighboringFaces);
    }
    if (candidates.length === 0)
      return undefined;
    else {
      const front = candidates[0];
      while (candidates.length !== 0) {
        // try to find a node at the boundary of both the geometry and previous component
        const node = candidates.shift()!; // shift may be inefficient for large queues
        if (node.vertexSuccessor.isMaskSet(ignoreMask))
          return node;
        if (node.edgeMate.isMaskSet(ignoreMask))
          return node;
      }
      return front;
    }
  }
  /**
   * Collect connected components of the graph (via Breadth First Search).
   * @param graph graph to inspect.
   * @param maxFaceCount (optional) maximum number of faces in each component. Should be positive; otherwise
   * `Infinity` is used.
   * @param ignoreMask (optional) mask preset on faces to ignore. Default value is `HalfEdgeMask.EXTERIOR` to ignore
   * exterior faces. Pass `HalfEdgeMask.NULL_MASK` to process all faces.
   * @returns the components of the graph, each component represented by an array of nodes, one node per face
   * of the component. In other words, entry [i][j] is a HalfEdge in the j_th face loop of the i_th component.
   */
  public static collectConnectedComponents(
    graph: HalfEdgeGraph,
    maxFaceCount: number = Infinity,
    ignoreMask: HalfEdgeMask = HalfEdgeMask.EXTERIOR,
  ): HalfEdge[][] {
    const components: HalfEdge[][] = [];
    if (graph.countMask(ignoreMask) === 0)
      ignoreMask = HalfEdgeMask.NULL_MASK;
    const visitMask = HalfEdgeMask.VISITED;
    const boundaryMask: HalfEdgeMask = visitMask | ignoreMask;
    // Starting with the input node, look ahead for a boundary face. Failing that, return the input node.
    // Starting all floods at the boundary reduces the chance of ending up with a ring-shaped component at the boundary.
    const findNextFloodSeed = (index: number) => {
      for (let i = index; i < graph.countNodes(); ++i) {
        if (!graph.allHalfEdges[i].isMaskSet(boundaryMask)
          && graph.allHalfEdges[i].edgeMate.isMaskSet(boundaryMask)) {
          index = i;
          break;
        }
      }
      return index;
    };
    for (let i = 0; i < graph.countNodes(); ++i) {
      if (graph.allHalfEdges[i].isMaskSet(boundaryMask))
        continue;
      const i0 = findNextFloodSeed(i);
      let seed: HalfEdge | undefined = graph.allHalfEdges[i0];
      do { // flood this component
        const component: HalfEdge[] = [];
        seed = HalfEdgeGraphSearch.exploreComponent(component, seed, visitMask, ignoreMask, maxFaceCount);
        if (component.length !== 0)
          components.push(component);
      } while (seed !== undefined);
      if (!graph.allHalfEdges[i].isMaskSet(visitMask))
        --i; // reprocess this node
    }
    return components;
  }
  /**
   * Test if test point (xTest,yTest) is inside/outside a face or on an edge.
   * @param seedNode any node on the face loop.
   * @param xTest x coordinate of the test point.
   * @param yTest y coordinate of the test point.
   * @returns 0 if ON, 1 if IN, -1 if OUT.
   */
  public static pointInOrOnFaceXY(seedNode: HalfEdge, xTest: number, yTest: number): number | undefined {
    const context = new XYParitySearchContext(xTest, yTest);
    // walk around looking for an accepted node to start the search (seedNode is usually ok)
    let nodeA = seedNode;
    let nodeB = seedNode.faceSuccessor;
    for (; ; nodeA = nodeB) {
      if (context.tryStartEdge(nodeA.x, nodeA.y, nodeB.x, nodeB.y))
        break;
      if (nodeB === seedNode) {
        // the test point and the face are all on line "y = yTest"
        const range = Range1d.createXX(nodeB.x, nodeB.faceSuccessor.x);
        return range.containsX(xTest) ? 0 : -1;
      }
      nodeB = nodeA.faceSuccessor;
    }
    // nodeB is the real start node for search, so stop when we revisit it. For each edge, accumulate parity and hits
    let nodeC = nodeB.faceSuccessor;
    for (; ;) {
      if (!context.advance(nodeC.x, nodeC.y)) {
        return context.classifyCounts();
      }
      if (nodeC === nodeB)
        break;
      nodeC = nodeC.faceSuccessor;
    }
    return context.classifyCounts();
  }
  /**
   * Collect boundary edges starting from `seed`.
   * * If `seed` is not a boundary node or is already visited, the function exists early.
   * @param seed start node.
   * @param visitMask mask to set on processed nodes.
   * @param isBoundaryEdge function to test if an edge in a boundary edge.
   * @param announceEdgeInBoundary callback invoked on each edge in the boundary loop in order. The counter is zero
   * for the first edge, and incremented with each successive edge.
   */
  public static collectExtendedBoundaryLoopFromSeed(
    seed: HalfEdge,
    visitMask: HalfEdgeMask,
    isBoundaryEdge: HalfEdgeToBooleanFunction,
    announceEdgeInBoundary: (edge: HalfEdge, counter: number) => void,
  ): void {
    let counter = 0;
    while (!seed.getMask(visitMask) && isBoundaryEdge(seed)) {
      announceEdgeInBoundary(seed, counter++);
      seed.setMask(visitMask);
      const vertexBase = seed.faceSuccessor;
      let candidateAroundVertex = vertexBase;
      for (; ;) {
        if (candidateAroundVertex.getMask(visitMask)) // end of boundary loop
          return;
        if (isBoundaryEdge(candidateAroundVertex)) {
          seed = candidateAroundVertex;
          break;
        }
        candidateAroundVertex = candidateAroundVertex.vertexPredecessor;
        if (candidateAroundVertex === vertexBase)
          break; // prevent infinite loop in case exteriorMask is not set on the edge mate of the boundary edge
      }
    }
  }
  /**
   * Collect boundary edges in the graph.
   * * A boundary edge is defined by `exteriorMask` being set on only its "exterior" edge mate.
   * * Each boundary edge is identified in the output by its edge mate that lacks `exteriorMask`.
   * * Each inner array is ordered in the output so that its boundary edges form a connected path. If `exteriorMask`
   * is preset consistently around each "exterior" face, these paths are loops.
   * @param graph the graph to query
   * @param exteriorMask mask preset on exactly one side of boundary edges
   * @returns array of boundary loops, each loop an array of the unmasked mates of boundary edges
   */
  public static collectExtendedBoundaryLoopsInGraph(graph: HalfEdgeGraph, exteriorMask: HalfEdgeMask): HalfEdge[][] {
    // Illustration of the algorithm can be found at geometry/internaldocs/Graph.md
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
