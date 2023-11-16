/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolygonLocationDetailPair, PolygonOps } from "../../geometry3d/PolygonOps";
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
   * Create a range tree for the Polyface points.
   * * This is a very simple construction that splits "right and left parts" of the facet sequence.
   * * Facets with any recognizable "left to right" or "top to bottom" sequencing will have very effective search structures.
   * @param points Polyface points.  THIS ARRAY POINTER IS CAPTURED.
   * @returns Polyface3dClosestPointSearchContext with a range tree and the point array.
   */
  public static createCapture(visitor: Polyface | PolyfaceVisitor, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): PolyfaceRangeTreeContext | undefined {
    if (visitor instanceof Polyface)
      return this.createCapture(visitor.createVisitor(0), maxChildPerNode, maxAppDataPerLeaf);
    const numFacet = PolyfaceQuery.visitorClientFacetCount(visitor);
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => {
        visitor.moveToReadIndex(index);
        return visitor.range();
      }),
      ((index: number): number => { return index; }),
      numFacet,
      maxChildPerNode, maxAppDataPerLeaf,
    );
    return rangeTreeRoot !== undefined ? new PolyfaceRangeTreeContext(rangeTreeRoot, visitor) : undefined;
  }

  /**
   * Search for the facet with closest approach to spacePoint
   * @returns details of the closest facet
   *
   */
  public searchForClosestPoint(spacePoint: Point3d): FacetLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnPolyface(spacePoint, this);
    this.numSearch++;
    const numFacet = this.visitor.clientPolyface()!.facetCount!;
    // seed the search with a few points -- this reduces early trips deep into early ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(numFacet / 20), 2, 7);
    const testStep = Math.floor(numFacet / numTest);
    handler.processAppData(0);
    handler.processAppData(numFacet - 1);

    for (let i = testStep; i + 1 < numFacet; i += testStep) {
      handler.processAppData(i);
    }
    this._rangeTreeRoot.searchTopDown(handler);
    return handler.searchState.itemAtMinValue;
  }
  /**
   * Find a pair of points, one on the polyface in contextA, the other in contextB, which is the closet approach between the facets.
   * @param contextA
   * @param contextB
   * @returns
   */
  public static searchForClosestApproach(
    contextA: PolyfaceRangeTreeContext,
    contextB: PolyfaceRangeTreeContext,
  ): PolygonLocationDetailPair<number> | undefined {
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
  /** Polyface visitor for the facets being searched */
  public visitor: PolyfaceVisitor;
  /** calling context */
  public context: PolyfaceRangeTreeContext;
  /** current min distance and facet index */
  public searchState: MinimumValueTester<FacetLocationDetail>;
  /** space point for the search */
  public spacePoint: Point3d;
  /** constructor
   * * CAPTURE space point
   * * CAPTURE context
   * * CAPTURE search state and visitor from the context.
   */
  public constructor(spacePoint: Point3d, context: PolyfaceRangeTreeContext) {
    super();
    this.context = context;
    this.visitor = context.visitor;
    this.searchState = MinimumValueTester.create();
    this.spacePoint = spacePoint.clone();
  }
  /**
   *
   * @param range range containing items to be tested.
   * @returns true if the spacePoint is within the range or close enough that a point in the range could be the closest.
   */
  public isRangeActive(range: Range3d): boolean {
    const dMin = range.distanceToPoint(this.spacePoint);
    if (this.searchState.isNewMinValue(dMin)) {
      this.context.numRangeTestTrue++;
      return true;
    }
    this.context.numRangeTestFalse++;
    return false;
  }
  /** Test a point (stored in the range tree) as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    if (this.visitor.moveToReadIndex(candidateIndex)) {
      const polygonLocationDetail = PolygonOps.closestPointOnBoundary(this.visitor.point, this.spacePoint, candidateIndex, undefined);
      if (undefined !== polygonLocationDetail) {
        const d = this.spacePoint.distance(polygonLocationDetail.point);
        this.context.numFacetTest++;
        if (this.searchState.isNewMinValue(d)) {
          const fld = NonConvexFacetLocationDetail.create(this.visitor.currentReadIndex(), this.visitor.point.length, polygonLocationDetail);
          this.searchState.testAndSave(fld, d);
        }
      }
    }
  }
}
/**
 * Helper class for searching for close approach(es) between polyfaces.
 * @internal
 */
export class TwoTreeSearchHandlerForFacetFacetCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** context for first polyface */
  public contextA: PolyfaceRangeTreeContext;
  /** context for second polyface */
  public contextB: PolyfaceRangeTreeContext;
  /** visitor for first polyface */
  public visitorA: PolyfaceVisitor;
  /** visitor for second polyface */
  public visitorB: PolyfaceVisitor;
  /** search state with current min distance and facet pair */
  public searchState: MinimumValueTester<PolygonLocationDetailPair<number>>;
  /** constructor
   * * CAPTURE both contexts
   * * create search state
   * * CAPTURE visitors accessed in contexts
   */
  public constructor(contextA: PolyfaceRangeTreeContext, contextB: PolyfaceRangeTreeContext) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    this.searchState = MinimumValueTester.create<PolygonLocationDetailPair<number>>();
    this.visitorA = contextA.visitor;
    this.visitorB = contextB.visitor;
  }
  /** Return the PolygonLocationDetail pair */
  public getResult(): PolygonLocationDetailPair<number> | undefined {
    if (this.searchState.minValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  public getCurrentDistance(): number {
    const d = this.searchState.minValue;
    return d === undefined ? Number.MAX_VALUE : d;
  }
  /** Carry out detailed calculation of closest approach between two facets.
  */
  public processAppDataPair(tagA: number, tagB: number): void {
    if (this.visitorA.moveToReadIndex(tagA) && this.visitorB.moveToReadIndex(tagB)) {
      const detail = PolygonOps.closestApproachOfPolygons<number>(this.visitorA.point, this.visitorB.point);
      this.contextA.numFacetTest++;
      if (detail !== undefined) {
        const d = detail.dataA.point.distance(detail.dataB.point);
        if (this.searchState.isNewMinOrTrigger(d)) {
          detail.tagA = tagA;
          detail.tagB = tagB;
          this.searchState.testAndSave(detail, d);
        }
      }
    }
  }
}

