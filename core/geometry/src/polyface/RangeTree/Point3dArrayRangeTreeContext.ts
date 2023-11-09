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
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";
import { TaggedDataPair } from "../../geometry3d/TaggedDataPair";

/**
 * Handler class to search a range tree containing only Point3d data, always returning the single closest point and optionally gathering an array of
 * all points with a search distance.
 * @public
 */
export class Point3dArrayRangeTreeContext {
  /** array of points being searched.
   * * The AppDataType for the range tree is number, which is an index into the points.
   */
  public points: Point3d[];
  /** Evolving search state */
  public searchState: MinimumValueTester<number>;
  /** space point for search  */
  public spacePoint: Point3d;
  /** for diagnostic:: number of range tests returned true. */
  public numRangeTestTrue: number;
  /** for diagnostic:: number of range tests returned false */
  public numRangeTestFalse: number;
  /** for diagnostic:: number of point distance tests */
  public numPointTest: number;
  /** for diagnostic:: number of searches. */
  public numSearch: number;

  private _rangeTreeRoot: RangeTreeNode<number>;
  /** PRIVATE constructor:
   * * capture the rangeTreeRoot and points.
   * * initialize debug counters.
   */
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
   * Create a range tree context with given points.
   */
  public static createCapture(points: Point3d[], maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): Point3dArrayRangeTreeContext | undefined {
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => { return Range3d.create(points[index]); }),
      ((index: number): number => { return index; }),
      points.length,
      maxChildPerNode, maxAppDataPerLeaf,
    );
    return rangeTreeRoot !== undefined ? new Point3dArrayRangeTreeContext(rangeTreeRoot, points) : undefined;
  }
  /** Search the range tree for closest point to spacePoint */
  public searchForClosestPoint(spacePoint: Point3d, resetAsNewSearch: boolean = true): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointInArray(this);
    this.numSearch++;
    this.spacePoint = spacePoint.clone();
    if (resetAsNewSearch)
      this.searchState.resetMinValueAndItem();
    this._rangeTreeRoot.searchTopDown(handler);
    return this.getCurveLocationDetail();
  }
  private getCurveLocationDetail(): CurveLocationDetail | undefined {
    if (this.searchState.itemAtMinValue === undefined)
      return undefined;
    return CurveLocationDetail.createCurveFractionPoint(undefined, 0, this.points[this.searchState.itemAtMinValue, this.searchState.itemAtMinValue]);
  }

  /**
   * Find a pair of points, one from each of contextA and contextB with smallest distance between.
   * @param contextA
   * @param contextB
   * @returns TaggedDataPair with the two points and their indices in the original arrays.
   */
  public static searchForClosestApproach(
    contextA: Point3dArrayRangeTreeContext,
    contextB: Point3dArrayRangeTreeContext,
  ): TaggedDataPair<Point3d, Point3d, number> | undefined {
    const handler = new TwoTreeSearchHandlerPoint3dArrayPoint3dArrayCloseApproach(contextA, contextB);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.getResult();
  }

}
/**
 * Helper class containing methods in SingleTreeSearchHandler, and a reference to a Polyline3dClosestPointSearcherContext.
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointInArray extends SingleTreeSearchHandler<number> {
  public context: Point3dArrayRangeTreeContext;
  /** constructor --called by calling context */
  public constructor(context: Point3dArrayRangeTreeContext) {
    super();
    this.context = context;
  }
  /**
   *
   * @param range range containing items to be tested.
   * @returns true if the spacePoint is within the range or close enough that a point in the range could be the closest.
   */
  public isRangeActive(range: Range3d): boolean {
    const dMin = range.distanceToPoint(this.context.spacePoint);
    if (this.context.searchState.isNewMinValue(dMin)) {
      this.context.numRangeTestTrue++;
      return true;
    }
    this.context.numRangeTestFalse++;
    return false;
  }
  /** Test a point (stored in the range tree) as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    const d = this.context.spacePoint.distance(this.context.points[candidateIndex]);
    this.context.numPointTest++;
    this.context.searchState.testAndSave(candidateIndex, d);
  }
}

/**
 * internal class to receive pairs of facets during search for closest approach.
 * @internal
 */
export class TwoTreeSearchHandlerPoint3dArrayPoint3dArrayCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** context for first polyline */
  public contextA: Point3dArrayRangeTreeContext;
  /** context for second polyline */
  public contextB: Point3dArrayRangeTreeContext;
  /** visitor for first polyline */
  /** search state with current min distance and facet pair */
  public searchState: MinimumValueTester<TaggedDataPair<Point3d, Point3d, number>>;
  /** constructor
   * * CAPTURE both contexts
   * * create search state
   * * CAPTURE visitors accessed in contexts
   */
  public constructor(contextA: Point3dArrayRangeTreeContext, contextB: Point3dArrayRangeTreeContext) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    this.searchState = MinimumValueTester.create<TaggedDataPair<Point3d, Point3d, number>>();
  }
  /** Return the PolygonLocationDetail pair */
  public getResult(): TaggedDataPair<Point3d, Point3d, number> | undefined {
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
    const pointA = this.contextA.points[tagA];
    const pointB = this.contextB.points[tagB];
    const d = pointA.distance(pointB);
    if (this.searchState.isNewMinValue(d)) {
      this.searchState.minValue = d;
      if (this.searchState.itemAtMinValue) {
        this.searchState.itemAtMinValue.setAll(pointA.clone(), pointB.clone(), tagA, tagB);
      } else {
        this.searchState.itemAtMinValue = new TaggedDataPair<Point3d, Point3d, number>(pointA.clone(), pointB.clone(), tagA, tagB);
      }
    }
  }
}
