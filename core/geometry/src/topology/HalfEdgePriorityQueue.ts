/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */
import { OrderedComparator, PriorityQueue } from "@itwin/core-bentley";
import { HalfEdge } from "./Graph";
import { HalfEdgeGraphOps } from "./Merging";

/**
 * * Combination of a priority queue of HalfEdges with
 * * Additional "active" array to carry edges that have been removed from the queue but are still to be
 *    inspected (possibly many times)
 * * The priority queue default sort is Y-then-X lexical sort.
 * * Caller has direct access to the queue and array.
 * * Methods are added here only to do things that involve both the queue and the array.
 * @internal
 */
export class HalfEdgePriorityQueueWithPartnerArray {
  public priorityQueue: PriorityQueue<HalfEdge>;
  public activeEdges: HalfEdge[];
  public constructor(
    compare: OrderedComparator<HalfEdge> = HalfEdgeGraphOps.compareNodesYXUp) {
    this.priorityQueue = new PriorityQueue(compare);
    this.activeEdges = [];
  }
  /** Read a member from the queue and transfer to the active array. */
  public popQueueToArray(): HalfEdge | undefined {
    if (this.priorityQueue.isEmpty)
      return undefined;
    const x = this.priorityQueue.pop()!;
    this.activeEdges.push(x);
    return x;
  }
  /** Pop the last entry and put it back as replacement for current entry at index i.
   * * Effectively remove active member at index i
   * * The array order is changed.
   * * constant time.
   */
  public popArrayToArrayIndex(i: number) {
    const n = this.activeEdges.length;
    if (i < n) {
      const x = this.activeEdges.pop()!;
      this.activeEdges[i] = x;
    }
  }
  /**
   * * Scan the active array.
   * * remove edges whose top y is below y
   * * (pack all remaining ones back towards the beginning)
   */
  public removeArrayMembersWithY1Below(y: number) {
    let numKeep = 0;
    const n = this.activeEdges.length;
    for (let i = 0; i < n; i++) {
      const q = this.activeEdges[i];
      const yB = q.faceSuccessor.y;
      if (yB >= y) {
        // copy [i] forward to [target]
        if (numKeep < i)
          this.activeEdges[numKeep] = q;
        numKeep++;
      } else {
        // let it go by !!!
      }
    }
    this.activeEdges.length = numKeep;
  }
}
