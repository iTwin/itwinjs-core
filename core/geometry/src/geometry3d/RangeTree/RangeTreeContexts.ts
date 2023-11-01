/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Range3d } from "../Range";
import { MinimumValueTester } from "../BestYet";
import { Point3d } from "../Point3dVector3d";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { PolylineOps } from "../PolylineOps";
import { Geometry } from "../../Geometry";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler } from "./RangeTree";

/**
 * Handler class to search a range tree containing only Point3d data, always returning the single closest point and optionally gathering an array of
 * all points with a search distance.
 */
export class Point3dArrayClosestPointSearchContext {
  public points: Point3d[];
  public searchState: MinimumValueTester<number>;
  public spacePoint: Point3d;
  public numRangeTestTrue: number;
  public numRangeTestFalse: number;
  public numPointTest: number;
  public numSearch: number;

  private _rangeTreeRoot: RangeTreeNode<number>;

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

  public static createCapture(points: Point3d[], maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): Point3dArrayClosestPointSearchContext | undefined {
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => { return Range3d.create(points[index]); }),
      ((index: number): number => { return index; }),
      points.length,
      maxChildPerNode, maxAppDataPerLeaf,
    );
    return rangeTreeRoot !== undefined ? new Point3dArrayClosestPointSearchContext(rangeTreeRoot, points) : undefined;
  }

  public searchForClosestPoint(spacePoint: Point3d, resetAsNewSearch: boolean = true): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointInArray(this);
    this.numSearch++;
    this.spacePoint = spacePoint.clone();
    if (resetAsNewSearch)
      this.searchState.resetTriggerForMinimization();
    this._rangeTreeRoot.searchTopDown(handler);
    return this.getCurveLocationDetail();
  }
  private getCurveLocationDetail(): CurveLocationDetail | undefined {
    if (this.searchState.item === undefined)
      return undefined;
    return CurveLocationDetail.createCurveFractionPoint(undefined, 0, this.points[this.searchState.item, this.searchState.item]);
  }
}
/**
 * Helper class containing methods in SingleTreeSearchHandler, and a reference to a Polyline3dClosestPointSearcherContext.
 */
class SingleTreeSearchHandlerForClosestPointInArray extends SingleTreeSearchHandler<number> {
  public context: Point3dArrayClosestPointSearchContext;

  public constructor(context: Point3dArrayClosestPointSearchContext) {
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
 * Helper class containing methods in SingleTreeSearchHandler, and a reference to a Polyline3dClosestPointSearcherContext.
 */
class SingleTreeSearchHandlerForClosestPointOnPolyline extends SingleTreeSearchHandler<number> {
  public context: Polyline3dClosestPointSearchContext;

  public constructor(context: Polyline3dClosestPointSearchContext) {
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
    const cld = PolylineOps.projectPointToUncheckedIndexedSegment(this.context.spacePoint, this.context.points, candidateIndex, false, false);
    const d = this.context.spacePoint.distance(cld.point);
    this.context.numPointTest++;
    this.context.searchState.testAndSave(cld, d);
  }
}

/**
 * class to host a point array and associated RangeTree for multiple search calls.
 */
export class Polyline3dClosestPointSearchContext {
  public searchState: MinimumValueTester<CurveLocationDetail>;
  public points: Point3d[];
  public spacePoint: Point3d;
  public numRangeTestTrue: number;
  public numRangeTestFalse: number;
  public numPointTest: number;
  public numSearch: number;

  private _rangeTreeRoot: RangeTreeNode<number>;

  private constructor(rangeTreeRoot: RangeTreeNode<number>, points: Point3d[]) {
    this.spacePoint = Point3d.create(0, 0, 0);
    this.searchState = MinimumValueTester.create<CurveLocationDetail>();
    this.points = points;
    this._rangeTreeRoot = rangeTreeRoot;
    this.numRangeTestTrue = 0;
    this.numRangeTestFalse = 0;
    this.numPointTest = 0;
    this.numSearch = 0;
  }
  public get closestPoint(): CurveLocationDetail | undefined {
    return this.searchState.item;
  }
  public get closestDistance(): number | undefined { return this.searchState.triggerForMinimization; }

  /**
   * Create a range tree for the polyline points.
   *
   * @param points polyline points.  THIS ARRAY POINTER IS CAPTURED.
   * @returns Polyline3dClosestPointSearchContext with a range tree and the point array.
   */
  public static createCapture(points: Point3d[], maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): Polyline3dClosestPointSearchContext | undefined {
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => { return Range3d.create(points[index]); }),
      ((index: number): number => { return index; }),
      points.length - 1,
      maxChildPerNode, maxAppDataPerLeaf,
    );
    return rangeTreeRoot !== undefined ? new Polyline3dClosestPointSearchContext(rangeTreeRoot, points) : undefined;
  }

  public searchForClosestPoint(spacePoint: Point3d): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnPolyline(this);
    this.numSearch++;
    this.spacePoint = spacePoint.clone();
    this.searchState.resetTriggerForMinimization();
    // seed the search with a few points -- this reduces early trips deep into early ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(this.points.length / 20), 2, 7);
    const testStep = Math.floor(this.points.length / numTest);
    handler.processAppData(0);
    handler.processAppData(this.points.length - 2);

    for (let i = testStep; i + 1 < this.points.length; i += testStep) {
      handler.processAppData(i);
    }
    this._rangeTreeRoot.searchTopDown(handler);
    return this.searchState.item;
  }
}
