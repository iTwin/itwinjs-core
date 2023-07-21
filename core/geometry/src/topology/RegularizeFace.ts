/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgeGraphOps } from "./Merging";

/**
 * * Context for regularizing single faces.
 * @internal
 */
export class RegularizationContext {
  // For debugging use ... "almost always" undefined.
  // If defined, it is called with each inserted node pair.
  // scale will be either plus or minus one.
  // when it is negative, the node coordinates (both x and y) have been negated.
  // The call is made after full insertion into vertex loop.
  public static announceEdge?: (graph: HalfEdgeGraph, nodeA: HalfEdge, nodeB: HalfEdge, scale: number) => void;
  public constructor(graph: HalfEdgeGraph) {
    this.graph = graph;
    this.upEdges = [];
    this.downEdges = [];
    this.bottomPeaks = [];
    this.topPeaks = [];
    this.localMin = [];
    this.localMax = [];
  }

  /**
   * These are public only for testing.
   */
  public graph: HalfEdgeGraph;
  /** array of edges directed upward.  Turn can be left or right, but is not large enough to be a min or max */
  public upEdges: HalfEdge[];
  /** array of edges directed downward, Turn can be left or right, but is not large enough to be a min or max */
  public downEdges: HalfEdge[];
  /** Array of edges whose start is an upward peak (right turn, inbound up, outbound down) */
  public topPeaks: HalfEdge[];
  /** Array of edges whose start is an downward peak (right turn, inbound down, outbound up) */
  public bottomPeaks: HalfEdge[];

  /** Array of edges at local minima (left turn, inbound down, outbound up).  Ensuing chain is up */
  public localMin: HalfEdge[];
  /** Array of edges at local maxima (left turn, inbound up, outbound down).  Ensuing chain is down */
  public localMax: HalfEdge[];
  /**
   * Collect (and classify) all the edges around a single face.
   * * The various arrays are collected: upEdges, downEdges, topPeaks, bottomPeaks, upChains, downChains
   * @param faceSeed face to examine
   */
  public collectVerticalEventsAroundFace(faceSeed: HalfEdge) {
    let nodeA = faceSeed;
    let nodeB;
    let nodeC;
    let abUp;
    let bcUp;
    this.upEdges.length = 0;
    this.downEdges.length = 0;
    this.topPeaks.length = 0;
    this.bottomPeaks.length = 0;
    this.localMin.length = 0;
    this.localMax.length = 0;
    do {
      nodeB = nodeA.faceSuccessor;
      nodeC = nodeB.faceSuccessor;
      abUp = HalfEdgeGraphOps.compareNodesYXUp(nodeA, nodeB) < 0;
      bcUp = HalfEdgeGraphOps.compareNodesYXUp(nodeB, nodeC) < 0;
      if (abUp) {
        this.upEdges.push(nodeA);
        if (!bcUp) {
          if (HalfEdgeGraphOps.crossProductToTargets(nodeB, nodeA, nodeC) < 0)
            this.localMax.push(nodeB);
          else
            this.topPeaks.push(nodeB);
        }

      } else { // ab is DOWN
        this.downEdges.push(nodeA);
        if (bcUp) {
          if (HalfEdgeGraphOps.crossProductToTargets(nodeB, nodeA, nodeC) > 0)
            this.bottomPeaks.push(nodeB);
          else
            this.localMin.push(nodeB);
        }
      }
      nodeA = nodeB;
    } while (nodeA !== faceSeed);
  }

  /**
   * Collect (and classify) all the edges in an array.
   * * The various arrays are collected: upEdges, downEdges, topPeaks, bottomPeaks, upChains, downChains
   * @param candidateEdges array of edges.
   */
  public collectVerticalEventFromEdgesInAndArray(candidateEdges: HalfEdge[]) {
    let nodeA;
    let nodeB;
    let nodeC;
    let abUp;
    let bcUp;
    this.upEdges.length = 0;
    this.downEdges.length = 0;
    this.topPeaks.length = 0;
    this.bottomPeaks.length = 0;
    this.localMin.length = 0;
    this.localMax.length = 0;
    for (nodeA of candidateEdges) {
      nodeB = nodeA.faceSuccessor;
      nodeC = nodeB.faceSuccessor;
      abUp = HalfEdgeGraphOps.compareNodesYXUp(nodeA, nodeB) < 0;
      bcUp = HalfEdgeGraphOps.compareNodesYXUp(nodeB, nodeC) < 0;
      if (abUp) {
        this.upEdges.push(nodeA);
        if (!bcUp) {
          if (HalfEdgeGraphOps.crossProductToTargets(nodeB, nodeA, nodeC) < 0)
            this.localMax.push(nodeB);
          else
            this.topPeaks.push(nodeB);
        }

      } else { // ab is DOWN
        this.downEdges.push(nodeA);
        if (bcUp) {
          if (HalfEdgeGraphOps.crossProductToTargets(nodeB, nodeA, nodeC) > 0)
            this.bottomPeaks.push(nodeB);
          else
            this.localMin.push(nodeB);
        }
      }
    }
  }

  private swapArrays() {
    let save = this.downEdges; this.downEdges = this.upEdges; this.upEdges = save;
    save = this.localMax; this.localMax = this.localMin; this.localMin = save;
    save = this.topPeaks; this.topPeaks = this.bottomPeaks; this.bottomPeaks = save;
  }

  /**
   * Find the edge (among candidates) which is first struck by a "rightward" scan from node
   * * comparisonFunction determines scan sense
   *   * HalfEdge.compareNodeYXTheta is an upward scan.
   *   * HalfEdge.compareNodeYXThetaDownward is a downward scan.
   * @param node
   * @param candidates Array of nodes to search
   * @param nodeComparisonFunction function for lexical comparison.
   */
  private findTopVisibleEdge(node: HalfEdge, candidates: HalfEdge[],
    directionSign: number) {
    const y0 = node.y;
    const x0 = node.x;
    let dx;
    let distanceRight = Number.MAX_SAFE_INTEGER;
    let result: HalfEdge | undefined;
    for (const rightBase of candidates) {
      const rightTop = rightBase.faceSuccessor;
      if (rightBase === node || rightTop === node)
        continue;
      // for horizontal edge cases -- require edges ends to have strict sign change (no zeros!!)
      const cRight = HalfEdgeGraphOps.compareNodesYXUp(node, rightBase);
      const cTop = HalfEdgeGraphOps.compareNodesYXUp(node, rightTop);
      // GeometryCoreTestIO.consoleLog(node.id, rightBase.id, rightTop.id, cRight, cTop);
      if (cRight * cTop >= 0)
        continue;
      const fraction = HalfEdge.horizontalScanFraction01(rightBase, y0);
      if (fraction !== undefined) {
        dx = directionSign * (rightBase.fractionToX(fraction) - x0);
        if (dx > 0 && dx < distanceRight) {
          result = rightBase;
          distanceRight = dx;
        }
      }
    }
    return result;
  }
  /**
   *
   * @param downPeak a "bottom" node where the interior CCW loop has a local min
   * @param downEdgeStart (optional) node at the start (heading downwards!) of an edge that brackets downPeak on the left.
   * @param upEdgeStart  (optional) node at the start (heading up!) of the edge that brackets downPeak on the right.
   */
  private highestUpPeakConnection(downPeak: HalfEdge, downEdgeStart: HalfEdge | undefined, upEdgeStart: HalfEdge | undefined): HalfEdge | undefined {
    let highestPeak;

    for (const upPeak of this.topPeaks) {
      const y0 = upPeak.y;
      const x0 = upPeak.x;
      // is upPeak higher than prior upPeak?
      if (highestPeak !== undefined && HalfEdgeGraphOps.compareNodesYXUp(upPeak, highestPeak) < 0)
        continue;
      // is upPeak BELOW downPeak, ABOVE both limit edges lower node, and between limit edge interiors.
      if (HalfEdgeGraphOps.compareNodesYXUp(upPeak, downPeak) < 0) {
        if (downEdgeStart) {
          const fraction = HalfEdge.horizontalScanFraction01(downEdgeStart, y0);
          if (fraction === undefined)
            continue;
          if (x0 <= downEdgeStart.fractionToX(fraction))
            continue;
        }
        if (upEdgeStart) {
          const fraction = HalfEdge.horizontalScanFraction01(upEdgeStart, y0);
          if (fraction === undefined)
            continue;
          if (upEdgeStart.fractionToX(fraction) <= x0)
            continue;
        }
        highestPeak = upPeak;
      }
    }
    return highestPeak;
  }

  private updateMaxNode(maxNode: HalfEdge | undefined, candidate: HalfEdge | undefined, compare: (a: HalfEdge, b: HalfEdge) => number): HalfEdge | undefined {
    if (!maxNode)
      return candidate;
    if (!candidate)
      return maxNode;
    // both are defined .. look for positive compare ...
    if (compare(maxNode, candidate) < 0)
      return candidate;
    return maxNode;
  }
  private negateXY() {
    for (const node of this.graph.allHalfEdges) {
      node.x *= -1;
      node.y *= -1;
    }
  }
  private downwardConnectionFromBottomPeak(node: HalfEdge): HalfEdge | undefined {
    let connectTo;
    const upFunction = (a: HalfEdge, b: HalfEdge) => HalfEdgeGraphOps.compareNodesYXUp(a, b);
    const upEdgeBase = this.findTopVisibleEdge(node, this.upEdges, 1.0)!;
    const downEdgeBase = this.findTopVisibleEdge(node, this.downEdges, -1.0)!;
    connectTo = this.updateMaxNode(connectTo, upEdgeBase, upFunction);
    if (downEdgeBase)
      connectTo = this.updateMaxNode(connectTo, downEdgeBase.faceSuccessor, upFunction);
    const upPeakConnection = this.highestUpPeakConnection(node, downEdgeBase, upEdgeBase);
    if (upPeakConnection !== undefined)
      connectTo = this.updateMaxNode(connectTo, upPeakConnection, upFunction);
    return connectTo;
  }
  /** Search around the vertex of nodeA for a nodeA1 such that nodeB is visible in the sector at nodeA1 */
  private findVisibleSector(nodeA: HalfEdge, nodeB: HalfEdge): HalfEdge | undefined {
    let nodeA1 = nodeA;
    do {
      if (HalfEdge.isNodeVisibleInSector(nodeB, nodeA1))
        return nodeA1;
      nodeA1 = nodeA1.vertexSuccessor;
    } while (nodeA1 !== nodeA);
    return undefined;
  }
  /**
   * Create an edge from (some node around the vertex of) nodeA to (some node around the vertex of) nodeB.
   * * looking around the vertex for alternate insertion corrects cusp insertion errors.
   * @param nodeA
   * @param nodeB
   */
  private joinNodes(nodeA: HalfEdge, nodeB: HalfEdge, direction: number): HalfEdge | undefined {
    const nodeC = this.graph.createEdgeXYZXYZ(nodeA.x, nodeA.y, nodeA.z, 0, nodeB.x, nodeB.y, nodeB.z, 0);
    const nodeA1 = this.findVisibleSector(nodeA, nodeB);
    const nodeB1 = this.findVisibleSector(nodeB, nodeA);
    if (nodeA1 !== undefined && nodeB1 !== undefined) {
      HalfEdge.pinch(nodeA1, nodeC);
      HalfEdge.pinch(nodeB1, nodeC.edgeMate);
      if (RegularizationContext.announceEdge)
        RegularizationContext.announceEdge(this.graph, nodeA, nodeB, direction);
      return nodeC;
    }
    return undefined;
  }
  /**
   * Regularize a single face.
   * * Insert edge from any downward interior vertex to something lower
   * * Insert an edge from each upward interior vertex to something higher.
   * * The face is split into smaller faces
   * * Each final face has at most one "min" and one "max", and is easy to triangulate with a bottom to top sweep.
   * * Normal usage is to sweep in both directions, i.e. use the default (true,true) for the upSweep and downSweep parameters.
   * @param faceSeed any representative half edge on the face
   * @param upSweep true to do the upward sweep.
   * @param downSweep true to do the downward sweep.
   */
  private runRegularization(upSweep: boolean = true, downSweep: boolean = true) {
    if (upSweep) {
      this.bottomPeaks.sort((a, b) => HalfEdgeGraphOps.compareNodesYXUp(a, b));
      for (const bottomPeak of this.bottomPeaks) {
        // GeometryCoreTestIO.consoleLog("SEARCH", bottomPeak.id, [bottomPeak.x, bottomPeak.y]);
        if (!HalfEdgeGraphOps.isDownPeak(bottomPeak))
          continue;
        const target = this.downwardConnectionFromBottomPeak(bottomPeak);
        if (target !== undefined) {
          // GeometryCoreTestIO.consoleLog("join", bottomPeak.id, [bottomPeak.x, bottomPeak.y], target.id, [target.x, target.y]);
          this.joinNodes(bottomPeak, target, 1);
        }
      }
    }
    if (downSweep) {
      // flip the whole graph (ouch)
      this.negateXY();
      // swap the various p and down seeds ....
      this.swapArrays();
      this.bottomPeaks.sort((a, b) => HalfEdgeGraphOps.compareNodesYXUp(a, b));
      for (const bottomPeak of this.bottomPeaks) {
        if (!HalfEdgeGraphOps.isDownPeak(bottomPeak))
          continue;
        const target = this.downwardConnectionFromBottomPeak(bottomPeak);
        if (target !== undefined) {
          this.joinNodes(bottomPeak, target, -1);
        }
      }
      this.negateXY();
      this.swapArrays();
    }
  }

  /**
   * Regularize a single face.
   * * Insert edge from any downward interior vertex to something lower
   * * Insert an edge from each upward interior vertex to something higher.
   * * The face is split into smaller faces
   * * Each final face has at most one "min" and one "max", and is easy to triangulate with a bottom to top sweep.
   * * Normal usage is to sweep in both directions, i.e. use the default (true,true) for the upSweep and downSweep parameters.
   * @param faceSeed any representative half edge on the face
   * @param upSweep true to do the upward sweep.
   * @param downSweep true to do the downward sweep.
   */
  public regularizeFace(faceSeed: HalfEdge, upSweep: boolean = true, downSweep: boolean = true) {
    this.collectVerticalEventsAroundFace(faceSeed);
    this.runRegularization(upSweep, downSweep);
  }

  public regularizeGraph(upSweep: boolean = true, downSweep: boolean = true) {
    this.collectVerticalEventFromEdgesInAndArray(this.graph.allHalfEdges);
    this.runRegularization(upSweep, downSweep);
  }

  /** test if a single face is monotone;  if so, return its (single) min */
  public static isMonotoneFace(seed: HalfEdge): HalfEdge | undefined {
    let numMin = 0;
    let numMax = 0;
    let nodeMin: HalfEdge | undefined;
    let nodeA = seed;
    do {
      const nodeB = nodeA.faceSuccessor;
      const nodeC = nodeB.faceSuccessor;
      const ab = HalfEdgeGraphOps.compareNodesYXUp(nodeA, nodeB);
      const bc = HalfEdgeGraphOps.compareNodesYXUp(nodeB, nodeC);
      if (ab * bc <= 0) {
        if (ab > 0) {
          numMin++;
          nodeMin = nodeB;
        }
        if (bc > 0) {
          numMax++;
        }
      }
    } while ((nodeA = nodeA.faceSuccessor) !== seed);
    return numMin === 1 && numMax === 1 ? nodeMin : undefined;
  }
  /** Return faces filtered by area and test function.
   * * find one arbitrary representative of each face
   * * offer the candidate to the mutate function.
   * * collect results
   * @param mappedSeeds when filter returns a HalfEdge, collect it here
   * @param unmappedSeeds when filter does not return a half edge, collect the candidate.
   */
  public static collectMappedFaceRepresentatives(
    graph: HalfEdgeGraph,
    positiveAreaOnly: boolean,
    mutate: (seed: HalfEdge) => HalfEdge | undefined,
    mappedEdges: HalfEdge[] | undefined,
    unMappedSeeds: HalfEdge[] | undefined) {
    if (mappedEdges)
      mappedEdges.length = 0;
    if (unMappedSeeds)
      unMappedSeeds.length = 0;
    const mask = HalfEdgeMask.VISITED;
    graph.clearMask(mask);
    for (const seed of graph.allHalfEdges) {
      if (!seed.getMask(mask)) {
        seed.setMaskAroundFace(mask);
        if (!positiveAreaOnly || seed.signedFaceArea() > 0) {
          const edge = mutate(seed);
          if (edge) {
            if (mappedEdges)
              mappedEdges.push(edge);
          } else {
            if (unMappedSeeds)
              unMappedSeeds.push(seed);
          }
        }
      }
    }
  }

}
