/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { FacetLocationDetail, FacetLocationDetailPair } from "../FacetLocationDetail";
import { Polyface, PolyfaceVisitor } from "../Polyface";
import { PolyfaceQuery } from "../PolyfaceQuery";
import { RangeTreeNode, RangeTreeOps } from "./RangeTreeNode";
import { SingleTreeSearchHandlerForClosestPointOnPolyface, TwoTreeSearchHandlerForFacetFacetCloseApproach } from "./RangeTreeSearchHandlers";

/**
 * Handler class for searching a range tree containing the facets of a polyface.
 * * Facilitates multiple searches for closest point and close approach calculations.
 * @public
 */
export class PolyfaceRangeTreeContext {
  /** Visitor for the polyface being searched */
  public visitor: PolyfaceVisitor;
  /** Whether all facets to visit are known to be convex. */
  public convexFacets: boolean;

  /** Diagnostic: number of range tests that have returned true. */
  public numRangeTestTrue: number;
  /** Diagnostic: number of range tests that have been returned false */
  public numRangeTestFalse: number;
  /** Diagnostic: number of facet tests. */
  public numFacetTest: number;
  /** Diagnostic: number of searches performed. */
  public numSearch: number;

  /** Range tree, whose appData are facet (read) indices */
  private _rangeTreeRoot: RangeTreeNode<number>;

  /** Constructor: capture inputs, initialize debug counters */
  private constructor(rangeTreeRoot: RangeTreeNode<number>, visitor: PolyfaceVisitor, convexFacets: boolean = false) {
    this.visitor = visitor;
    this.convexFacets = convexFacets;
    this._rangeTreeRoot = rangeTreeRoot;
    this.numRangeTestTrue = 0;
    this.numRangeTestFalse = 0;
    this.numFacetTest = 0;
    this.numSearch = 0;
  }
  /**
   * Create a range tree context for the Polyface facets.
   * * This is a very simple construction that splits "right and left parts" of the facet sequence.
   * * Facets with any recognizable "left to right" or "top to bottom" sequencing will have very effective search structures.
   * @param visitor access to facets, captured if PolyfaceVisitor
   * @param maxChildPerNode maximum children per range tree node (default 4)
   * @param maxAppDataPerLeaf maximum facet indices per leaf node (default 4)
   * @param convexFacets whether all facets are known to be convex (cf. [[PolyfaceQuery.areFacetsConvex]]) (default false)
   */
  public static createCapture(visitor: Polyface | PolyfaceVisitor, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4, convexFacets: boolean = false): PolyfaceRangeTreeContext | undefined {
    if (visitor instanceof Polyface)
      return this.createCapture(visitor.createVisitor(0), maxChildPerNode, maxAppDataPerLeaf, convexFacets);
    const numFacet = PolyfaceQuery.visitorClientFacetCount(visitor);
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      (index: number): Range3d => { visitor.moveToReadIndex(index); return visitor.range(); },
      (index: number): number => { return index; },
      numFacet,
      maxChildPerNode,
      maxAppDataPerLeaf,
    );
    return rangeTreeRoot ? new PolyfaceRangeTreeContext(rangeTreeRoot, visitor, convexFacets) : undefined;
  }
  /**
   * Search the range tree for closest facet(s) to spacePoint.
   * @param spacePoint point to test
   * @param maxDist collect points at no more than this distance from spacePoint. If undefined, return only the closest point.
   * @param searchFacetInterior whether to include facet interiors in search. Default is false: just consider facet boundaries.
   * @return closest point detail(s) with detail.a set to the distance from spacePoint to detail.point
   */
  public searchForClosestPoint(spacePoint: Point3d, maxDist?: number, searchFacetInterior: boolean = false): FacetLocationDetail | FacetLocationDetail[] | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnPolyface(spacePoint, this, maxDist, searchFacetInterior);
    this.numSearch++;
    const numFacet = PolyfaceQuery.visitorClientFacetCount(this.visitor);
    // seed the search with a few points -- this reduces early trips deep into early ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(numFacet / 20), 2, 7);
    const testStep = Math.floor(numFacet / numTest);
    handler.processAppData(0);
    handler.processAppData(numFacet - 1);
    for (let i = testStep; i + 1 < numFacet; i += testStep)
      handler.processAppData(i);
    this._rangeTreeRoot.searchTopDown(handler);
    return handler.searchState.savedItems.length <= 1 ? handler.getResult() : handler.getSavedItems();
  }
  /**
   * Search the range trees for closest approach(es) between the polyfaces.
   * @param contextA first polyface context
   * @param contextB second polyface context
   * @param maxDist collect close approaches separated by no more than this distance. If undefined, return only the closest approach.
   * @param searchFacetInterior whether to include facet interiors in search (`context.convexFacets` must be true for both contexts). Default is false: just consider facet boundaries.
   * @return closest approach detail pair(s), one per context, with detail.a set to the approach distance
  */
  public static searchForClosestApproach(contextA: PolyfaceRangeTreeContext, contextB: PolyfaceRangeTreeContext, maxDist?: number, searchFacetInterior: boolean = false): FacetLocationDetailPair | FacetLocationDetailPair[] | undefined {
    const handler = new TwoTreeSearchHandlerForFacetFacetCloseApproach(contextA, contextB, maxDist, searchFacetInterior);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.searchState.savedItems.length <= 1 ? handler.getResult() : handler.getSavedItems();
  }
}
