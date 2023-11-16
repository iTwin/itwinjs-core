/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { CurveLocationDetail } from "../../core-geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { TaggedDataPair } from "../../geometry3d/TaggedDataPair";
import { MinimumValueTester } from "./MinimumValueTester";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";

/**
 * Carrier structure for a pair of points, each with optional numeric tag.
 * @public
 */
export class TaggedPoint3dPair extends TaggedDataPair<Point3d, Point3d, number> {
  /** Constructor, inputs captured */
  public constructor(pointA: Point3d, pointB: Point3d, tagA?: number, tagB?: number) {
    super(pointA, pointB, tagA, tagB);
  }
}

/**
 * Handler class for searching a range tree containing unordered Point3d data.
 * * Facilitates multiple searches for closest point and close approach calculations.
 * @public
 */
export class Point3dArrayRangeTreeContext {
  /** Array of points being searched, indexed by the range tree */
  public points: Point3d[];
  /** Evolving search state */
  public searchState: MinimumValueTester<number>;
  /** Space point for closest point search  */
  public spacePoint: Point3d;

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
    this.spacePoint = Point3d.create(0, 0, 0);
    this.searchState = MinimumValueTester.create<number>();
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
  /** Search the range tree for closest point to spacePoint */
  public searchForClosestPoint(spacePoint: Point3d, resetAsNewSearch: boolean = true): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointInArray(this);
    this.numSearch++;
    this.spacePoint = spacePoint.clone();
    if (resetAsNewSearch)
      this.searchState.resetMinValueAndItem();
    this._rangeTreeRoot.searchTopDown(handler);
    if (this.searchState.itemAtMinValue !== undefined && this.searchState.minValue !== undefined) {
      const cld = CurveLocationDetail.createCurveFractionPoint(undefined, 0, this.points[this.searchState.itemAtMinValue]);
      cld.a = this.searchState.minValue;
      return cld;
    }
    return undefined;
  }
  /**
   * Find a pair of points, one from each of contextA and contextB, with the smallest distance between.
   * @param contextA range tree context for first point set
   * @param contextB range tree context for second point set
   * @returns the two points of closest approach, and their indices in the original arrays.
   */
  public static searchForClosestApproach(
    contextA: Point3dArrayRangeTreeContext,
    contextB: Point3dArrayRangeTreeContext,
  ): TaggedPoint3dPair | undefined {
    const handler = new TwoTreeSearchHandlerForPoint3dArrayPoint3dArrayCloseApproach(contextA, contextB);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.getResult();
  }
  /**
   * * Compute the distance between the indexed points of contextA and contextB.
   * * If this distance is of interest to the searchState, update it with the points.
   */
  public static updateClosestApproachBetweenIndexedPoints(
    contextA: Point3dArrayRangeTreeContext,
    indexA: number,
    contextB: Point3dArrayRangeTreeContext,
    indexB: number,
    searchState: MinimumValueTester<TaggedPoint3dPair>,
  ) {
    contextA.numPointTest++;
    const pointA = contextA.points[indexA];
    const pointB = contextB.points[indexB];
    const d = pointA.distance(pointB);
    if (searchState.isNewMinOrTrigger(d))
      searchState.testAndSave(new TaggedPoint3dPair(pointA.clone(), pointB.clone(), indexA, indexB), d);
  }
}

/**
 * Helper class for searching for the closest point in a set of points.
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointInArray extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: Point3dArrayRangeTreeContext;
  /** Constructor, captures context */
  public constructor(context: Point3dArrayRangeTreeContext) {
    super();
    this.context = context;
  }
  /**
   * Return true if appData within the range should be offered to `processAppData`.
   * @param range range containing items to be tested.
   * @returns true if the spacePoint is within the range or close enough that a point in the range could be the closest.
   */
  public override isRangeActive(range: Range3d): boolean {
    const dMin = range.distanceToPoint(this.context.spacePoint);
    if (this.context.searchState.isNewMinValue(dMin)) {
      this.context.numRangeTestTrue++;
      return true;
    }
    this.context.numRangeTestFalse++;
    return false;
  }
  /** Test a point indexed in the range tree as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    const d = this.context.spacePoint.distance(this.context.points[candidateIndex]);
    this.context.numPointTest++;
    this.context.searchState.testAndSave(candidateIndex, d);
  }
}

/**
 * Helper class for searching for close approach(es) between sets of points.
 * @internal
 */
export class TwoTreeSearchHandlerForPoint3dArrayPoint3dArrayCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** Context for first set of points */
  public contextA: Point3dArrayRangeTreeContext;
  /** Context for second set of points */
  public contextB: Point3dArrayRangeTreeContext;
  /** Search state with current min distance point pair */
  public searchState: MinimumValueTester<TaggedDataPair<Point3d, Point3d, number>>;
  /** constructor, all inputs captured */
  public constructor(contextA: Point3dArrayRangeTreeContext, contextB: Point3dArrayRangeTreeContext) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    this.searchState = MinimumValueTester.create<TaggedDataPair<Point3d, Point3d, number>>();
  }
  /** Return the indexed Point3d pair */
  public getResult(): TaggedDataPair<Point3d, Point3d, number> | undefined {
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
  /** Compute and test the distance between two points, given their indices. */
  public override processAppDataPair(tagA: number, tagB: number): void {
    Point3dArrayRangeTreeContext.updateClosestApproachBetweenIndexedPoints(this.contextA, tagA, this.contextB, tagB, this.searchState);
  }
}
