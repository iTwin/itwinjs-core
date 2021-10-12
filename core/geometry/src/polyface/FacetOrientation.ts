/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */
import { IndexedEdgeMatcher, SortableEdge } from "./IndexedEdgeMatcher";
import { IndexedPolyface, PolyfaceVisitor } from "./Polyface";
import { PolyfaceQuery } from "./PolyfaceQuery";

class OrientedComponentData {
  public numPositive: number;
  public numNegative: number;
  public firstEdgeIndex: number;
  public constructor(firstEdgeIndex: number) {
    this.numPositive = this.numNegative = 0;
    this.firstEdgeIndex = firstEdgeIndex;
  }
  // announce a new facet orientation.
  public recordOrientation(orientation: number) {
    if (orientation > 0)
      this.numPositive++;
    else if (orientation < 0)
      this.numNegative++;
  }
}
export class FacetOrientationFixup {
  private _edges: IndexedEdgeMatcher;
  private _edgeToPartnerEdge: number[];
  private _edgeToEdgeInComponent: number[];
  private _facetToFirstEdgeInComponent: number[];
  private _facetOrientation: number[];
  private _components: OrientedComponentData[];
  private _visitor: PolyfaceVisitor;
  private _mesh: IndexedPolyface;
  private constructor(mesh: IndexedPolyface) {
    this._visitor = mesh.createVisitor(1);
    this._edges = PolyfaceQuery.createIndexedEdges(this._visitor);
    this._edgeToPartnerEdge = [];
    this._edgeToEdgeInComponent = [];
    this._facetToFirstEdgeInComponent = [];
    this._facetOrientation = [];
    this._components = [];
    this._mesh = mesh;
  }

  private edgeIdToFacetOrientation(edgeId: number): number {
    const facetIndex = this._edges.edges[edgeId].facetIndex;
    return this._facetOrientation[facetIndex];
  }
  /**
   * RETURN FALSE IF ANY EDGE HAS 3 ORE MORE FACETS
   */
  private setupUnoriented(): boolean {
    this._edges.sort();
    const edgeArray = this._edges.edges;
    // make each edge a singleton with itself as successor . .
    let maxFacetIndex = -1;
    const numEdges = this._edges.edges.length;
    for (let i = 0; i < numEdges; i++) {
      const facetIndex = this._edges.edges[i].facetIndex;
      if (facetIndex > maxFacetIndex)
        maxFacetIndex = facetIndex;
      this._edgeToEdgeInComponent.push(i);
      this._edgeToPartnerEdge.push(i);
    }
    for (let i = 0; i <= maxFacetIndex; i++) {
      this._facetToFirstEdgeInComponent.push(-1);
      this._facetOrientation.push(0);
    }
    // make each edge part of a component for only its own facet
    // (This component exists only ephemerally -- it is not referenced by true component)
    // (swapping entries in the cyclic loops merges loops.)
    for (let i = 0; i < numEdges; i++) {
      const facetIndex = this._edges.edges[i].facetIndex;
      const j = this._facetToFirstEdgeInComponent[facetIndex];
      if (j === -1)
        this._facetToFirstEdgeInComponent[facetIndex] = i;
      else {
        FacetOrientationFixup.swapEntries(this._edgeToEdgeInComponent, i, j);
      }
    }
    // make contiguous partner edges cycles in edgeToPartnerEdge.
    // edge i is initially always a singleton.
    for (let edgeIndex0 = 0; edgeIndex0 < numEdges; edgeIndex0++) {
      let edgeIndex1 = edgeIndex0 + 1;
      while (edgeIndex1 < numEdges && SortableEdge.areUndirectedPartners(edgeArray[edgeIndex0], edgeArray[edgeIndex1])) {
        // splice the loops ...
        FacetOrientationFixup.swapEntries(this._edgeToPartnerEdge, edgeIndex0, edgeIndex1);
        edgeIndex1++;
      }
      // BUT .. everything else will fail if more than 2 anywhere .....
      if (edgeIndex1 > edgeIndex0 + 2)
        return false;
    }
    return true;
  }
  private recordFacetInComponent(facetIndex: number, orientation: number) {
    const componentData = this._components[this._components.length - 1];
    this._facetOrientation[facetIndex] = orientation;
    componentData.recordOrientation(orientation);
  }

  private initializeComponent(edgeIndex: number) {
    const facetIndex = this._edges.edges[edgeIndex].facetIndex;
    this._components.push(new OrientedComponentData(edgeIndex));
    this.recordFacetInComponent(facetIndex, 1);
  }
  private _workArray: number[] = [];

  private pushFacetEdgesOnStack(seedEdge: number, stack: number[]) {
    FacetOrientationFixup.extractCyclicIndices(this._edgeToEdgeInComponent, seedEdge, this._workArray);
    for (const edgeIndex of this._workArray) {
      stack.push(edgeIndex);
    }
  }
  /**
   * * Run flood search from every possible seed, assigning positive and negative orientations
   * * Halt and return false if flood detects Klein bottle effects.
   * @return true if flood
   */
  private doFlood(): boolean {
    // Finally time for flood search.
    const edgeStack: number[] = [];
    const edgeArray = this._edges.edges;
    const numEdges = edgeArray.length;
    const neighborEdges: number[] = [];
    for (let seedEdgeIndex = 0; seedEdgeIndex < numEdges; seedEdgeIndex++) {
      if (this.edgeIdToFacetOrientation(seedEdgeIndex) === 0) {
        edgeStack.length = 0;
        this.initializeComponent(seedEdgeIndex);
        this.pushFacetEdgesOnStack(seedEdgeIndex, edgeStack);
        // An edge on the stack is part of the current component.
        // Its partners may or may not have been visited.
        let baseEdgeIndex: number | undefined;
        while (undefined !== (baseEdgeIndex = edgeStack.pop())) {
          const baseFacet = edgeArray[baseEdgeIndex].facetIndex;
          const baseOrientation = this._facetOrientation[baseFacet];
          FacetOrientationFixup.extractCyclicIndices(this._edgeToPartnerEdge, baseEdgeIndex, neighborEdges);
          for (const neighborEdgeIndex of neighborEdges) {
            if (neighborEdgeIndex !== baseEdgeIndex) {
              const neighborFacet = edgeArray[neighborEdgeIndex].facetIndex;
              const neighborOrientation = this._facetOrientation[neighborFacet];
              if (neighborOrientation === 0) {
                // first visit to this facet !
                // orientations of baseEdge and neighborEdge tell us how to orient it.
                const newOrientation = SortableEdge.areDirectedPartners(edgeArray[baseEdgeIndex], edgeArray[neighborEdgeIndex]) ? baseOrientation : -baseOrientation;
                this.recordFacetInComponent(neighborFacet, newOrientation);
                this.pushFacetEdgesOnStack(neighborEdgeIndex, edgeStack);
                FacetOrientationFixup.swapEntries(this._edgeToEdgeInComponent, baseEdgeIndex, neighborEdgeIndex);
              } else {
                // looking across to an already-visited facet ..
                const edgeOrientation = SortableEdge.relativeOrientation(edgeArray[baseEdgeIndex], edgeArray[neighborEdgeIndex]);
                if (edgeOrientation * baseOrientation * neighborOrientation > 0)
                  return false;
              }
            }
          }
        }
      }
    }
    // fall through when floods have completed in all components, with no Klein bottle effects
    return true;
  }
  private doFacetReversals(): number {
    let numReverse = 0;
    for (this._visitor.reset(); this._visitor.moveToNextFacet();) {
      const facetIndex = this._visitor.currentReadIndex();
      if (this._facetOrientation[facetIndex] < 0) {
        numReverse++;
        this._mesh.reverseSingleFacet(facetIndex);
      }
    }
    return numReverse;
  }
  public static doFixup(mesh: IndexedPolyface): boolean {
    const context = new FacetOrientationFixup(mesh);
    if (!context.setupUnoriented())
      return false;
    const ok = context.doFlood();
    if (ok)
      context.doFacetReversals();
    return ok;
  }
  /** swap entries at indices in a number array.
   * * indices are not checked for validity.
   */
  private static swapEntries(data: number[], i: number, j: number) {
    const q = data[i];
    data[i] = data[j];
    data[j] = q;
  }
  /**
   *
   * @param data an array of cyclically linked loops.
   */
  private static extractCyclicIndices(data: number[], index0: number, loopIndices: number[]) {
    loopIndices.length = 0;
    let i = index0;
    do {
      loopIndices.push(i);
      i = data[i];
    } while (i !== index0);
  }
}
