/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolygonLocationDetail, PolygonOps } from "../../geometry3d/PolygonOps";
import { Range3d } from "../../geometry3d/Range";
import { ConvexFacetLocationDetail, FacetLocationDetail, FacetLocationDetailPair, NonConvexFacetLocationDetail } from "../FacetLocationDetail";
import { Polyface, PolyfaceVisitor } from "../Polyface";
import { PolyfaceQuery } from "../PolyfaceQuery";
import { MinimumValueTester } from "./MinimumValueTester";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";

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
   * @param maxAppDataPerLeaf maximum point indices per leaf node (default 4)
   * @param convexFacets whether all facets are known to be convex (cf. [[PolyfaceQuery.areFacetsConvex]]) (default false)
   */
  public static createCapture(visitor: Polyface | PolyfaceVisitor, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4, convexFacets: boolean = false): PolyfaceRangeTreeContext | undefined {
    if (visitor instanceof Polyface)
      return this.createCapture(visitor.createVisitor(0), maxChildPerNode, maxAppDataPerLeaf);
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

/**
 * Helper class for searching for the closest point in a polyface.
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointOnPolyface extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: PolyfaceRangeTreeContext;
  /** Evolving search state */
  public searchState: MinimumValueTester<FacetLocationDetail>;
  /** Space point for the search */
  public spacePoint: Point3d;
  /** Whether to include facet interior in search */
  public searchFacetInterior: boolean;

  /**
   * Constructor
   * @param spacePoint cloned
   * @param context captured
   * @param maxDist collect points at no more than this distance from spacePoint
   * @param searchFacetInterior true: search facet interior + boundary; false: just boundary
   */
  public constructor(spacePoint: Point3d, context: PolyfaceRangeTreeContext, maxDist?: number, searchFacetInterior: boolean = false) {
    super();
    this.context = context;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<FacetLocationDetail>(maxDist);
    this.spacePoint = spacePoint.clone();
    this.searchFacetInterior = searchFacetInterior;
  }
  /** Return the current closest point */
  public getResult(): FacetLocationDetail | undefined {
    if (this.searchState.minValue !== undefined && this.searchState.itemAtMinValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  /** Return the collected closest points (if collecting) */
  public getSavedItems(): FacetLocationDetail[] | undefined {
    if (this.searchState.savedItems.length > 0) {
      return this.searchState.savedItems;
    }
    return undefined;
  }
  /**
   * Return true if appData within the range should be offered to `processAppData`.
   * @param range range containing items to be tested.
   * @returns true if the spacePoint is within the range or close enough that a point in the range could be the closest.
   */
  public override isRangeActive(range: Range3d): boolean {
    const dMin = range.distanceToPoint(this.spacePoint);
    if (this.searchState.isNewMinValue(dMin)) {
      this.context.numRangeTestTrue++;
      return true;
    }
    this.context.numRangeTestFalse++;
    return false;
  }
  /** Test a facet indexed in the range tree as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    this.context.visitor.setNumWrap(0); // so edgeCount === pointCount; closure point unnecessary for closestPoint[OnBoundary]
    if (this.context.visitor.moveToReadIndex(candidateIndex)) {
      let pld: PolygonLocationDetail | undefined;
      if (this.searchFacetInterior)
        pld = PolygonOps.closestPoint(this.context.visitor.point, this.spacePoint);
      else
        pld = PolygonOps.closestPointOnBoundary(this.context.visitor.point, this.spacePoint);
      this.context.numFacetTest++;
      if (pld && this.searchState.isNewMinOrTrigger(pld.a)) {
        const edgeCount = this.context.visitor.pointCount;
        const fld = this.context.convexFacets
          ? ConvexFacetLocationDetail.createCapture(this.context.visitor.currentReadIndex(), edgeCount, pld)
          : NonConvexFacetLocationDetail.createCapture(this.context.visitor.currentReadIndex(), edgeCount, pld);
        this.searchState.testAndSave(fld, pld.a);
      }
    }
  }
}
/**
 * Helper class for searching for the closest approach between polyfaces.
 * @internal
 */
export class TwoTreeSearchHandlerForFacetFacetCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** Context for first polyface */
  public contextA: PolyfaceRangeTreeContext;
  /** Context for second polyface */
  public contextB: PolyfaceRangeTreeContext;
  /** Search state with current min distance and facet pair */
  public searchState: MinimumValueTester<FacetLocationDetailPair>;
  /** Whether to include facet interior in search */
  public searchFacetInterior: boolean;

  /** Constructor
   * @param contextA captured
   * @param contextB captured
   * @param maxDist collect points at no more than this separation distance
   * @param searchFacetInterior true: search facet interior + boundary; false: just boundary
  */
  public constructor(contextA: PolyfaceRangeTreeContext, contextB: PolyfaceRangeTreeContext, maxDist?: number, searchFacetInterior: boolean = false) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<FacetLocationDetailPair>(maxDist);
    this.searchFacetInterior = searchFacetInterior && contextA.convexFacets && contextB.convexFacets;
  }
  /** Return the facets with closest approach */
  public getResult(): FacetLocationDetailPair | undefined {
    if (this.searchState.minValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  /** Return the collected close approaches (if collecting) */
  public getSavedItems(): FacetLocationDetailPair[] | undefined {
    if (this.searchState.savedItems.length > 0) {
      return this.searchState.savedItems;
    }
    return undefined;
  }
  /** Get current min distance */
  public override getCurrentDistance(): number {
    const d = this.searchState.minValue;
    return d === undefined ? Number.MAX_VALUE : d;
  }
  /** Compute and test the closest approach between two facets, given their indices. */
  public override processAppDataPair(indexA: number, indexB: number): void {
    this.contextA.visitor.setNumWrap(1);  // closed polygons are more efficient for PolygonOps.closestApproach
    this.contextB.visitor.setNumWrap(1);
    if (this.contextA.visitor.moveToReadIndex(indexA) && this.contextB.visitor.moveToReadIndex(indexB)) {
      const pldPair = PolygonOps.closestApproach(this.contextA.visitor.point, this.contextB.visitor.point, undefined, this.searchFacetInterior);
      this.contextA.numFacetTest++;
      if (pldPair && this.searchState.isNewMinOrTrigger(pldPair.dataA.a)) {
        const edgeCountA = this.contextA.visitor.pointCount - 1;
        const edgeCountB = this.contextB.visitor.pointCount - 1;
        const fldPair = FacetLocationDetailPair.create(
          this.contextA.convexFacets ? ConvexFacetLocationDetail.createCapture(indexA, edgeCountA, pldPair.dataA) : NonConvexFacetLocationDetail.createCapture(indexA, edgeCountA, pldPair.dataA),
          this.contextB.convexFacets ? ConvexFacetLocationDetail.createCapture(indexB, edgeCountB, pldPair.dataB) : NonConvexFacetLocationDetail.createCapture(indexB, edgeCountB, pldPair.dataB),
        );
        this.searchState.testAndSave(fldPair, fldPair.detailA.a);
      }
    }
  }
}

