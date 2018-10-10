/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
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
   */
  public static findMinimumAreaFace(nodes: HalfEdge[]): HalfEdge {
    let mostNegativeAreaNode: HalfEdge = nodes[0];
    let mostNegArea = Number.MAX_VALUE;

    for (const node of nodes) {
      const area = node.signedFaceArea();
      if (area < 0 && area < mostNegArea) {
        mostNegArea = area;
        mostNegativeAreaNode = node;
      }
    }
    return mostNegativeAreaNode;
  }

  /**
   *
   * @param seedEdge first edge to search.
   * @param visitMask mask applied to all faces as visited.
   * @param parityMask mask to apply (a) to first face, (b) to faces with alternating parity during the search.
   */
  private static parityFloodFromSeed(seedEdge: HalfEdge, visitMask: HalfEdgeMask, parityMask: HalfEdgeMask): HalfEdge[] {
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
        const mateState = !p.isMaskSet(parityMask);
        HalfEdgeGraphSearch.pushAndMaskAllNodesInFace(mate, mateState ? allMasks : visitMask, stack, faces);
      }
    }
    return faces;
  }
  /**
   * * Search the given faces for the one with the minimum area.
   * * If the mask in that face is OFF, toggle it on (all half edges of) all the faces.
   * * In a properly merged planar subdivision there should be only one true negative area face per compnent.
   * @param graph parent graph
   * @param parityMask mask which was previously set with alternating parity, but with an arbitrary start face.
   * @param faces array of faces to search.
   */
  private static correctParityInSingleComponent(_graph: HalfEdgeGraph, mask: HalfEdgeMask, faces: HalfEdge[]) {
    const exteriorHalfEdge = HalfEdgeGraphSearch.findMinimumAreaFace(faces);
    if (exteriorHalfEdge.isMaskSet(mask)) {
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
    if (mask === 0)
      return;
    for (const facesInComponent of components)
      HalfEdgeGraphSearch.correctParityInSingleComponent(graph, mask, facesInComponent);
  }
  /**
   * Collect arrays gathering faces by connected component.
   * @param graph graph to inspect
   * @param parityMask (optional) mask to apply indicating parity.  If this is Mask.NULL_MASK, there is no record of parity.
   */
  public static collectConnectedComponents(graph: HalfEdgeGraph, parityMask: HalfEdgeMask = HalfEdgeMask.NULL_MASK): HalfEdge[][] {
    const components = [];
    const visitMask = HalfEdgeMask.VISITED;
    const allMasks = parityMask | visitMask;
    graph.clearMask(allMasks);
    for (const faceSeed of graph.allHalfEdges) {
      if (!faceSeed.isMaskSet(HalfEdgeMask.VISITED)) {
        const newFaces = HalfEdgeGraphSearch.parityFloodFromSeed(faceSeed, visitMask, parityMask);
        components.push(newFaces);
      }
    }
    HalfEdgeGraphSearch.correctParityInComponentArrays(graph, parityMask, components);
    return components;
  }
}
