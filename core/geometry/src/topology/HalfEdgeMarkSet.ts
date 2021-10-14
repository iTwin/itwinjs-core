/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";

/** @packageDocumentation
 * @module Topology
 */
/**
 * A class to manage a set of edges as both (a) an array of possible members and (b) mask bits.
 * * A half edge is "in the MarkSet" if its mask is set.
 * * The MarkSet array is a superset of the half edges in the set.
 * * Entry of a HalfEdge into the set is indicated by both
 *    * adding the HalfEdge to the array
 *    * setting the mask on the half edge, edge, face, or vertex
 * * Half edges can "go out of the MarkSet" if the mask is cleared.
 *   * This clearing can happen independently of the array management.
 *   * Hence the array can contain half edges that are no longer in the MarkSet
 *   * the "remove" methods monitor this.
 * * Derived classes expand this concept for edge, vertex, or face MarkSets.
 *   * a single representative of an edge, vertex, or face is entered to the array
 *   * all edges around the edge, vertex, or face are marked with the mask
 *   * Hence the array contains one or more representatives of the edge, face, or vertex
 * * This allows quick query for both:
 *   * Testing the mask gives constant time test of whether a HalfEdge is in the set
 *   * access through the array gives direct access to the HalfEdge pointers
 * @internal
 */
export abstract class AbstractHalfEdgeGraphMarkSet {
  private _graph: HalfEdgeGraph;
  private _candidates: HalfEdge[];
  protected _mask: HalfEdgeMask;

  protected constructor(graph: HalfEdgeGraph, mask: HalfEdgeMask) {
    this._graph = graph;
    this._candidates = [];
    this._mask = mask;
    this._graph.clearMask(mask);
  }
  /** remove all nodes from the set.
   * * This pops from the array, clearing masks as the pop.
   * * Note that it does NOT walk the entire graph to clear masks.
   */
  public clear() {
    for (; undefined !== this.chooseAndRemoveAny();) {
    }
  }

  /**
   * count the number of active members.
   * * This is the number of HalfEdges which are (a) in the array and (b) masked.
   */
  public getLength(): number {
    let n = 0;
    for (const candidate of this._candidates) {
      if (candidate.isMaskSet(this._mask)) n++;
    }
    return n;
  }
  /**
   * Return the number of candidates.
   * * This may be more than `getLength ()`
   * * This will typically only be called by the iterator.
   */
  public getNumCandidates(): number {
    return this._candidates.length;
  }
  /** Read property accessor: return the graph */
  public get graph(): HalfEdgeGraph { return this._graph; }

  /** return borrowed assets (the mask!) to the graph. */
  public teardown() {
    this._graph.dropMask(this._mask);
    this._candidates.length = 0;
    // this._graph = undefined;
  }
  /** (Read property) return the mask used to mark members of the set. */
  public get mask(): HalfEdgeMask { return this._mask; }

  /** pop and return the last node out of the array, without testing if it is still marked. */
  protected popAndReturn(): HalfEdge | undefined {
    const n = this._candidates.length;
    if (n === 0)
      return undefined;
    const node = this._candidates[n - 1];
    this._candidates.pop();
    return node;
  }

  /**
   * * read at an index in the candidates array.
   * * if that candidate has the mask, return it.
   * * otherwise return undefined.
   * * REMARK: This is only to be called by the iterator.
   */
  public getAtIndex(index: number): HalfEdge | undefined {
    if (index >= 0 && index < this._candidates.length) {
      const candidate = this._candidates[index];
      if (candidate.isMaskSet(this._mask))
        return candidate;
    }
    return undefined;
  }

  /** Add a node to the set.  This means
   * * Set the mask
   * * push the node on the array
   * * (BUT!) If the node already has the mask, do nothing.
   * * This base class method affects only the single given HalfEdge.
   * * Derived classes for edge, face, and vertex will override this method and also set the mask around the larger structures.
   * @returns true if the HalfEdge is a new member of the set, false if it was already in the set.
   */
  public addToSet(candidate: HalfEdge) {
    if (candidate.isMaskSet(this._mask))
      return false;
    this._candidates.push(candidate);
    this.setMaskInScope(candidate);
    return true;
  }
  /** Test if `candidate` is already in the set.
   * * This examines only the mask.
   */
  public isCandidateInSet(candidate: HalfEdge): boolean {
    return candidate.isMaskSet(this._mask);
  }
  /**
   * * If the candidate is not marked as a member of the MarkSet, do nothing.
   * * If the candidate is marked:
   *   * clear the mask
   *   * but do NOT search the array.
   *   * As the array is searched, the candidate will appear and be ignored because the mask is not set.
   * @param candidate
   * @return true if the candidate was a member (an hence removed), false if the candidate was not masked.
   */
  public removeFromSet(candidate: HalfEdge): boolean {
    if (!candidate.isMaskSet(this._mask))
      return false;
    this.clearMaskInScope(candidate);
    return true;
  }
  /**
   *  * Search the array to find any current set member
   *  * If found, clear its mask and return it.
   *  * If unmasked HalfEdges are found in the array, they are removed from the array.
   */
  public chooseAndRemoveAny(): HalfEdge | undefined {
    for (; ;) {
      const candidate = this.popAndReturn();
      if (!candidate)
        return undefined;
      if (this.removeFromSet(candidate))
        return candidate;
    }
  }
  /** Set mask on candidate -- i.e. edge, face, vertex, or single half edge as required.
   * * Base class only changes the candidate mask.
   * * Derived classes change more masks around edge, face, or vertex.
   */
  protected abstract setMaskInScope(candidate: HalfEdge | undefined): void;

  /** Clear mask on candidate -- i.e. edge, face, vertex, or single half edge as required.
   * * Base class only changes the candidate mask.
   * * Derived classes change more masks around edge, face, or vertex.
   */
  protected abstract clearMaskInScope(candidate: HalfEdge | undefined): void;
  /**
   * Return the number of half edges that would be set/cleared when dealing with this candidate.
   * * This is always 1 for HalfEdgeMarkSet
   * @param candidate
   */
  public abstract countHalfEdgesAroundCandidate(candidate: HalfEdge | undefined): number;
  /** Create an iterator over member HalfEdges */
  public [Symbol.iterator](): IterableIterator<HalfEdge> { return new IterableHalfEdgeMarkSetIterator(this); }
  /**
   * * visit all half edges around face.
   * * Add each to mark set.
   */
  public addAroundFace(seed: HalfEdge): void {
    let p = seed;
    do {
      this.addToSet(p);
      p = p.faceSuccessor;
    } while (p !== seed);
  }

  /**
   * * visit all half edges around vertex.
   * * Add each to mark set.
   */
  public addAroundVertex(seed: HalfEdge): void {
    let p = seed;
    do {
      this.addToSet(p);
      p = p.vertexSuccessor;
    } while (p !== seed);
  }
}

/**
 * AbstractHalfEdgeGraphMarkSet specialized to manage the masks on individual half edges
 * @internal
 */
export class MarkedHalfEdgeSt extends AbstractHalfEdgeGraphMarkSet {
  constructor(graph: HalfEdgeGraph, mask: HalfEdgeMask) {
    super(graph, mask);
  }
  /** Create a new 'HalfEdgeMarkSet', operating on half edges with only themselves as scope.
   * * Returns undefined if unable to get a mask for the graph.
   * * Undefined return can only happen if the caller is failing to return grabbed masks.
   */
  public static create(graph: HalfEdgeGraph): MarkedHalfEdgeSt | undefined {
    const mask = graph.grabMask();
    if (mask === HalfEdgeMask.NULL_MASK)
      return undefined;
    return new MarkedHalfEdgeSt(graph, mask);
  }

  /**
   * * Set mask on candidate's edge.
   * * This overrides the base class implementation.
   */
  protected setMaskInScope(candidate: HalfEdge) {
    candidate.setMask(this._mask);
  }

  /**
   * * Clear mask on candidate's edge.
   * * This overrides the base class implementation.
   */
  protected clearMaskInScope(candidate: HalfEdge) {
    candidate.clearMask(this._mask);
  }
  /**
   * Return the number of half edges that would be set/cleared when dealing with this candidate.
   * * This is always 1 for EdgeMarkSet
   * * return 0 for undefined candidate
   * @param candidate
   */
  public countHalfEdgesAroundCandidate(candidate: HalfEdge | undefined): number {
    if (!candidate)
      return 0;
    return 1;
  }
}

/**
 * AbstractHalfEdgeGraphMarkSet specialized to manage the mask on both sides of edges.
 * @internal
 */
export class MarkedEdgeSet extends AbstractHalfEdgeGraphMarkSet {
  constructor(graph: HalfEdgeGraph, mask: HalfEdgeMask) {
    super(graph, mask);
  }
  /** Create a new 'HalfEdgeMarkSet', operating on half edges with only themselves as scope.
   * * Returns undefined if unable to get a mask for the graph.
   * * Undefined return can only happen if the caller is failing to return grabbed masks.
   */
  public static create(graph: HalfEdgeGraph): MarkedEdgeSet | undefined {
    const mask = graph.grabMask();
    if (mask === HalfEdgeMask.NULL_MASK)
      return undefined;
    return new MarkedEdgeSet(graph, mask);
  }

  /**
   * * Set mask on candidate's edge.
   * * This overrides the base class implementation.
   */
  protected setMaskInScope(candidate: HalfEdge) {
    candidate.setMaskAroundEdge(this._mask);
  }

  /**
   * * Clear mask on candidate's edge.
   * * This overrides the base class implementation.
   */
  protected clearMaskInScope(candidate: HalfEdge) {
    candidate.clearMaskAroundEdge(this._mask);
  }
  /**
   * Return the number of half edges that would be set/cleared when dealing with this candidate.
   * * This is always 2 for EdgeMarkSet
   * @param candidate
   */
  public countHalfEdgesAroundCandidate(candidate: HalfEdge | undefined): number {
    if (!candidate)
      return 0;
    return 2;
  }
}

/**
 * AbstractHalfEdgeGraphMarkSet specialized to manage the mask around faces
 * @internal
 */
export class MarkedFaceSet extends AbstractHalfEdgeGraphMarkSet {
  constructor(graph: HalfEdgeGraph, mask: HalfEdgeMask) {
    super(graph, mask);
  }
  /** Create a new 'HalfEdgeMarkSet', operating on half edges with only themselves as scope.
   * * Returns undefined if unable to get a mask for the graph.
   * * Undefined return can only happen if the caller is failing to return grabbed masks.
   */
  public static create(graph: HalfEdgeGraph): MarkedFaceSet | undefined {
    const mask = graph.grabMask();
    if (mask === HalfEdgeMask.NULL_MASK)
      return undefined;
    return new MarkedFaceSet(graph, mask);
  }

  /**
   * * Set mask on (all nodes around) candidate's face
   * * This overrides the base class implementation.
   */
  protected setMaskInScope(candidate: HalfEdge) {
    candidate.setMaskAroundFace(this._mask);
  }

  /**
   * * Clear mask on (all nodes around) candidate's face.
   * * This overrides the base class implementation.
   */
  protected clearMaskInScope(candidate: HalfEdge) {
    candidate.clearMaskAroundFace(this._mask);
  }
  /**
   * Return the number of half edges that would be set/cleared when dealing with this candidate.
   * * This is the "aroundFace" count.
   * @param candidate
   */
  public countHalfEdgesAroundCandidate(candidate: HalfEdge | undefined): number {
    if (!candidate)
      return 0;
    return candidate.countEdgesAroundFace();
  }
}
/**
 * AbstractHalfEdgeGraphMarkSet specialized to manage the mask around faces
 * @internal
 */
export class MarkedVertexSet extends AbstractHalfEdgeGraphMarkSet {
  constructor(graph: HalfEdgeGraph, mask: HalfEdgeMask) {
    super(graph, mask);
  }
  /** Create a new 'HalfEdgeMarkSet', operating on half edges with only themselves as scope.
   * * Returns undefined if unable to get a mask for the graph.
   * * Undefined return can only happen if the caller is failing to return grabbed masks.
   */
  public static create(graph: HalfEdgeGraph): MarkedVertexSet | undefined {
    const mask = graph.grabMask();
    if (mask === HalfEdgeMask.NULL_MASK)
      return undefined;
    return new MarkedVertexSet(graph, mask);
  }

  /**
   * * Set mask on (all nodes around) candidate's face
   * * This overrides the base class implementation.
   */
  protected setMaskInScope(candidate: HalfEdge) {
    candidate.setMaskAroundVertex(this._mask);
  }

  /**
   * * Clear mask on (all nodes around) candidate's face.
   * * This overrides the base class implementation.
   */
  protected clearMaskInScope(candidate: HalfEdge) {
    candidate.clearMaskAroundVertex(this._mask);
  }
  /**
   * Return the number of half edges that would be set/cleared when dealing with this candidate.
   * * This is the "aroundVertex" count.
   * @param candidate
   */
  public countHalfEdgesAroundCandidate(candidate: HalfEdge | undefined): number {
    if (!candidate)
      return 0;
    return candidate.countEdgesAroundVertex();
  }
}

/**
 * Class to act as an iterator over points in a markSet.
 * * Internal data is:
 *   * pointer to the parent markSet
 *   * index of index of the next point to read.
 * * the parent markSet class
 */
class IterableHalfEdgeMarkSetIterator implements Iterator<HalfEdge> {
  private _markSet: AbstractHalfEdgeGraphMarkSet;
  private _nextReadIndex: number;
  public constructor(markSet: AbstractHalfEdgeGraphMarkSet) {
    this._markSet = markSet;
    this._nextReadIndex = 0;
  }
  public next(): IteratorResult<HalfEdge> {
    const n = this._markSet.getNumCandidates();
    // Walk over candidates that have been quietly de-masked
    while (this._nextReadIndex < n) {
      const p = this._markSet.getAtIndex(this._nextReadIndex++);
      if (p !== undefined)
        return { done: false, value: p };
    }
    return { done: true, value: undefined } as any as IteratorResult<HalfEdge>;
  }

  public [Symbol.iterator](): IterableIterator<HalfEdge> { return this; }
}
