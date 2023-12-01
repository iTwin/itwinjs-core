/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { MinimumValueTester } from "./MinimumValueTester";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";

/**
 * Handler class for searching a range tree containing unordered Point3d data.
 * * Facilitates multiple searches for closest point and close approach calculations.
 * @public
 */
export class Point3dArrayRangeTreeContext {
  /** Array of points being searched, indexed by the range tree */
  public points: Point3d[];

  /** Diagnostic: number of range tests returned true */
  public numRangeTestTrue: number;
  /** Diagnostic: number of range tests returned false */
  public numRangeTestFalse: number;
  /** Diagnostic: number of point distance tests */
  public numPointTest: number;
  /** Diagnostic: number of searches */
  public numSearch: number;

  /** range tree, whose appData are indices into the points array */
  private _rangeTreeRoot: RangeTreeNode<number>;

  /** Constructor: capture inputs, initialize debug counters */
  private constructor(rangeTreeRoot: RangeTreeNode<number>, points: Point3d[]) {
    this.points = points;
    this._rangeTreeRoot = rangeTreeRoot;
    this.numRangeTestTrue = 0;
    this.numRangeTestFalse = 0;
    this.numPointTest = 0;
    this.numSearch = 0;
  }
  /**
   * Create a range tree context with given points:
   * * initialize with single-point ranges
   * * appData are point indices
   * @param points captured
   * @param maxChildPerNode maximum children per range tree node (default 4)
   * @param maxAppDataPerLeaf maximum point indices per leaf node (default 4)
   */
  public static createCapture(points: Point3d[], maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): Point3dArrayRangeTreeContext | undefined {
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => { return Range3d.create(points[index]); }),
      ((index: number): number => { return index; }),
      points.length,
      maxChildPerNode,
      maxAppDataPerLeaf,
    );
    return rangeTreeRoot ? new Point3dArrayRangeTreeContext(rangeTreeRoot, points) : undefined;
  }
  /**
   * Search the range tree for closest point(s) to spacePoint.
   * @param spacePoint point to test
   * @param maxDist collect points at no more than this distance from spacePoint. If undefined, return only the closest point.
   * @return closest point detail(s) with following fields set:
   * * detail.point = the closest point
   * * detail.fraction = the index of the closest point in the points array
   * * detail.a = distance from spacePoint to closest point
   */
  public searchForClosestPoint(spacePoint: Point3d, maxDist?: number): CurveLocationDetail | CurveLocationDetail[] | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointInArray(spacePoint, this, maxDist);
    this.numSearch++;
    this._rangeTreeRoot.searchTopDown(handler);
    return handler.searchState.savedItems.length <= 1 ? handler.getResult() : handler.getSavedItems();
  }
  /**
   * Search the range trees for closest approach(es) between the point arrays.
   * @param contextA first point array context
   * @param contextB second point array context
   * @param maxDist collect close approaches separated by no more than this distance. If undefined, return only the closest approach.
   * @return closest approach detail pair(s), one per context, each with the following fields set:
   * * detail.point = the point at closest approach
   * * detail.fraction = the index of detail.point in the points array
   * * detail.a = the closest approach distance
  */
  public static searchForClosestApproach(contextA: Point3dArrayRangeTreeContext, contextB: Point3dArrayRangeTreeContext, maxDist?: number): CurveLocationDetailPair | CurveLocationDetailPair[] | undefined {
    const handler = new TwoTreeSearchHandlerForPoint3dArrayPoint3dArrayCloseApproach(contextA, contextB, maxDist);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.searchState.savedItems.length <= 1 ? handler.getResult() : handler.getSavedItems();
  }
}

/**
 * Helper class for searching for the closest point in a set of points.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring CurveLocationDetail).
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointInArray extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: Point3dArrayRangeTreeContext;
  /** Evolving search state */
  public searchState: MinimumValueTester<number>;
  /** Space point for the search  */
  public spacePoint: Point3d;

  /**
   * Constructor
   * @param spacePoint cloned
   * @param context captured
   * @param maxDist collect points at no more than this distance from spacePoint
   */
  public constructor(spacePoint: Point3d, context: Point3dArrayRangeTreeContext, maxDist?: number) {
    super();
    this.context = context;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<number>(maxDist);
    this.spacePoint = spacePoint.clone();
  }
  /** Return the current closest point */
  public getResult(): CurveLocationDetail | undefined {
    if (this.searchState.minValue !== undefined && this.searchState.itemAtMinValue !== undefined) {
      const iPoint = this.searchState.itemAtMinValue;
      const cld = CurveLocationDetail.createCurveFractionPoint(undefined, iPoint, this.context.points[iPoint]);
      cld.a = this.searchState.minValue;
      return cld;
    }
    return undefined;
  }
  /** Return the collected closest points (if collecting) */
  public getSavedItems(): CurveLocationDetail[] | undefined {
    if (this.searchState.savedItems.length === 0)
      return undefined;
    const cldArray: CurveLocationDetail[] = [];
    for (let i = 0; i < this.searchState.savedItems.length; ++i) {
      const iPoint = this.searchState.savedItems[i];
      const cld = CurveLocationDetail.createCurveFractionPoint(undefined, iPoint, this.context.points[iPoint]);
      cld.a = this.searchState.savedValues[i];
      cldArray.push(cld);
    }
    return cldArray;
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
  /** Test a point indexed in the range tree as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    const d = this.spacePoint.distance(this.context.points[candidateIndex]);
    this.context.numPointTest++;
    this.searchState.testAndSave(candidateIndex, d);
  }
}

/**
 * Helper class for searching for the closest approach between sets of points.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring CurveLocationDetail).
 * @internal
 */
export class TwoTreeSearchHandlerForPoint3dArrayPoint3dArrayCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** Context for first set of points */
  public contextA: Point3dArrayRangeTreeContext;
  /** Context for second set of points */
  public contextB: Point3dArrayRangeTreeContext;
  /** Search state with current min distance point pair */
  public searchState: MinimumValueTester<CurveLocationDetailPair>;

  /**
   * Constructor
   * @param contextA captured
   * @param contextB captured
   * @param maxDist collect points at no more than this separation distance
   */
  public constructor(contextA: Point3dArrayRangeTreeContext, contextB: Point3dArrayRangeTreeContext, maxDist?: number) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<CurveLocationDetailPair>(maxDist);
  }
  /** Return the current closest approach */
  public getResult(): CurveLocationDetailPair | undefined {
    if (this.searchState.minValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  /** Return the collected close approaches (if collecting) */
  public getSavedItems(): CurveLocationDetailPair[] | undefined {
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
  /** Compute and test the distance between two points, given their indices. */
  public override processAppDataPair(indexA: number, indexB: number): void {
    this.contextA.numPointTest++;
    const pointA = this.contextA.points[indexA];
    const pointB = this.contextB.points[indexB];
    const d = pointA.distance(pointB);
    if (this.searchState.isNewMinOrTrigger(d)) {
      const cldPair = CurveLocationDetailPair.createCapture(
        CurveLocationDetail.createCurveFractionPoint(undefined, indexA, pointA),
        CurveLocationDetail.createCurveFractionPoint(undefined, indexB, pointB),
      );
      cldPair.detailA.a = cldPair.detailB.a = d;
      this.searchState.testAndSave(cldPair, d);
    }
  }
}
