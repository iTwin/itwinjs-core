/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */
import { Range3d } from "../../geometry3d/Range";
import { MinimumValueTester } from "./MinimumValueTester";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Geometry } from "../../Geometry";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";
import { FacetLocationDetail, NonConvexFacetLocationDetail } from "../FacetLocationDetail";
import { PolyfaceVisitor } from "../Polyface";
import { PolygonLocationDetailPair, PolygonOps } from "../../geometry3d/PolygonOps";
/**
 * class to host a Polyface and associated RangeTree for a variety of search calls.
 * * Usage pattern:
 *   * Create with
 *          myContext = PolyfaceRangeTreeContext.createCapture (polyface)
 *          or other method which creates a compatible tree structure of RangeTreeNode
 *  * search (many times) with
 *       myContext.searchForClosestPoint(spacePoint)
 *  * or with other PolyfaceRangeTreeContext with
 *       PolyfaceRangeTreeContext.closestApproach(contextA, contextB)
 * @public
 */
export class PolyfaceRangeTreeContext {
  /** visitor for the polyface being searched */
  public visitor: PolyfaceVisitor;
  /** diagnostic: number of range tests that have returned true. */
  public numRangeTestTrue: number;
  /** diagnostic: number of range tests that have been returned false */
  public numRangeTestFalse: number;
  /** diagnostic: number of facet tests. */
  public numFacetTest: number;
  /** diagnostic: number of searches performed. */
  public numSearch: number;

  private _rangeTreeRoot: RangeTreeNode<number>;
  /** Constructor is called only internally . . . */
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
  public static createCapture(visitor: PolyfaceVisitor, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): PolyfaceRangeTreeContext | undefined {
    const numFacet = visitor.clientPolyface()!.facetCount!;
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
    const handler = new TwoTreeSearchHandlerFacetFacetCloseApproach(contextA, contextB);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.getResult();
  }
}

/**
 * Helper class containing methods in SingleTreeSearchHandler, and a reference to a Polyface3dClosestPointSearcherContext.
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
 * internal class to receive pairs of facets during search for closest approach.
 * @internal
 */
export class TwoTreeSearchHandlerFacetFacetCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
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

