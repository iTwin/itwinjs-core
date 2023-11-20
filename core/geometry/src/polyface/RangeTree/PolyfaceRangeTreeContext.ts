/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolygonLocationDetail, PolygonLocationDetailPair, PolygonOps } from "../../geometry3d/PolygonOps";
import { Range3d } from "../../geometry3d/Range";
import { FacetLocationDetail, NonConvexFacetLocationDetail } from "../FacetLocationDetail";
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
  private constructor(rangeTreeRoot: RangeTreeNode<number>, visitor: PolyfaceVisitor) {
    this.visitor = visitor;
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
   */
  public static createCapture(visitor: Polyface | PolyfaceVisitor, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): PolyfaceRangeTreeContext | undefined {
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
    return rangeTreeRoot ? new PolyfaceRangeTreeContext(rangeTreeRoot, visitor) : undefined;
  }
  /**
   * Search the range tree for the facet closest to spacePoint
   * @param spacePoint point from which to compute distances
   * @param searchFacetInterior whether to include facet interior in search (default is false: just consider facet boundary)
  */
  public searchForClosestPoint(spacePoint: Point3d, searchFacetInterior: boolean = false): FacetLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnPolyface(spacePoint, this, searchFacetInterior);
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
    return handler.searchState.itemAtMinValue;
  }
  /** Find a pair of points, one from each polyface in contextA and contextB, with the smallest distance between. */
  public static searchForClosestApproach(contextA: PolyfaceRangeTreeContext, contextB: PolyfaceRangeTreeContext): PolygonLocationDetailPair<number> | undefined {
    const handler = new TwoTreeSearchHandlerForFacetFacetCloseApproach(contextA, contextB);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.getResult();
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
   * @param searchFacetInterior true: search facet interior + boundary; false: just boundary
   */
  public constructor(spacePoint: Point3d, context: PolyfaceRangeTreeContext, searchFacetInterior: boolean = false) {
    super();
    this.context = context;
    this.searchState = MinimumValueTester.create();
    this.spacePoint = spacePoint.clone();
    this.searchFacetInterior = searchFacetInterior;
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
    this.context.visitor.setNumWrap(0); // so edgeCount === pointCount
    if (this.context.visitor.moveToReadIndex(candidateIndex)) {
      let pld: PolygonLocationDetail | undefined;
      if (this.searchFacetInterior)
        pld = PolygonOps.closestPoint(this.context.visitor.point, this.spacePoint);
      else
        pld = PolygonOps.closestPointOnBoundary(this.context.visitor.point, this.spacePoint);
      if (pld) {
        const d = this.spacePoint.distance(pld.point);
        this.context.numFacetTest++;
        if (this.searchState.isNewMinValue(d)) {
          const edgeCount = this.context.visitor.pointCount;
          const fld = NonConvexFacetLocationDetail.create(this.context.visitor.currentReadIndex(), edgeCount, pld);
          this.searchState.testAndSave(fld, d);
        }
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
  public searchState: MinimumValueTester<PolygonLocationDetailPair>;

  /** Constructor, all inputs captured */
  public constructor(contextA: PolyfaceRangeTreeContext, contextB: PolyfaceRangeTreeContext) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    this.contextA.visitor.setNumWrap(1);  // so that polygons are closed for PolygonOps.closestApproach
    this.contextB.visitor.setNumWrap(1);
    this.searchState = MinimumValueTester.create<PolygonLocationDetailPair>();
  }
  /** Return the PolygonLocationDetail pair */
  public getResult(): PolygonLocationDetailPair | undefined {
    if (this.searchState.minValue !== undefined) {
      return this.searchState.itemAtMinValue;
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
    if (this.contextA.visitor.moveToReadIndex(indexA) && this.contextB.visitor.moveToReadIndex(indexB)) {
      const detail = PolygonOps.closestApproach(this.contextA.visitor.point, this.contextB.visitor.point);
      this.contextA.numFacetTest++;
      if (detail !== undefined) {
        detail.tagA = indexA;
        detail.tagB = indexB;
        this.searchState.testAndSave(detail, detail.dataA.a);
      }
    }
  }
}

