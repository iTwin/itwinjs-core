/* eslint-disable no-console */
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
import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { Geometry } from "../../Geometry";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
/**
 * class to host a point array and associated RangeTree for multiple search calls.
 * @public
 */
export class LineString3dRangeTreeContext {
  /** evolving search state during searches */
  public searchState: MinimumValueTester<CurveLocationDetail>;
  /** polyline points */
  public linestring: LineString3d;
  /** space point for closest point search */
  public spacePoint: Point3d;
  /** diagnostic: number of range tests that have returned true */
  public numRangeTestTrue: number;
  /** diagnostic: number of range tests that have returned false */
  public numRangeTestFalse: number;
  /** diagnostic: number of points tested */
  public numPointTest: number;
  /** diagnostic: number of searches. */
  public numSearch: number;

  private _rangeTreeRoot: RangeTreeNode<number>;

  private constructor(rangeTreeRoot: RangeTreeNode<number>, points: LineString3d) {
    this.spacePoint = Point3d.create(0, 0, 0);
    this.searchState = MinimumValueTester.create<CurveLocationDetail>();
    this.linestring = points;
    this._rangeTreeRoot = rangeTreeRoot;
    this.numRangeTestTrue = 0;
    this.numRangeTestFalse = 0;
    this.numPointTest = 0;
    this.numSearch = 0;

    /** Return the closest point from the search context. */
  }
  public get closestPoint(): CurveLocationDetail | undefined {
    return this.searchState.itemAtMinValue;
  }
  /** return the closet point distance from the search state. */
  public get closestDistance(): number | undefined { return this.searchState.minValue; }

  /**
   * Create a range tree for the polyline points.
   *
   * @param linestring
   * @returns Polyline3dClosestPointSearchContext with a range tree and the point array.
   */
  public static createCapture(points: Point3d[] | LineString3d, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): LineString3dRangeTreeContext | undefined {
    const linestring = points instanceof LineString3d ? points : LineString3d.createPoints(points);
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => {
        return Range3d.create(linestring.pointAt(index)!, linestring.pointAt(index + 1)!);
      }),
      ((index: number): number => { return index; }),
      linestring.numPoints() - 1,
      maxChildPerNode, maxAppDataPerLeaf,
    );
    return rangeTreeRoot !== undefined ? new LineString3dRangeTreeContext(rangeTreeRoot, linestring) : undefined;
  }

  public searchForClosestPoint(spacePoint: Point3d): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnPolyline(this);
    this.numSearch++;
    this.spacePoint = spacePoint.clone();
    this.searchState.resetMinValueAndItem();
    // seed the search with a few points -- this reduces early trips deep into early ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(this.linestring.numPoints() / 20), 2, 7);
    const testStep = Math.floor(this.linestring.numPoints() / numTest);
    handler.processAppData(0);
    handler.processAppData(this.linestring.numPoints() - 2);

    for (let i = testStep; i + 1 < this.linestring.numPoints(); i += testStep) {
      handler.processAppData(i);
    }
    this._rangeTreeRoot.searchTopDown(handler);
    return this.searchState.itemAtMinValue;
  }
  /**
   * Find a pair of points, one on the polyline in contextA, the other in contextB, which is the closet approach between the facets.
   * @param contextA
   * @param contextB
   * @returns pair of CurveLocationDetails
   */
  public static searchForClosestApproach(
    contextA: LineString3dRangeTreeContext,
    contextB: LineString3dRangeTreeContext,
  ): CurveLocationDetailPair | undefined {
    const handler = new TwoTreeSearchHandlerPolylinePolylineCloseApproach(contextA, contextB);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.getResult();
  }

  private static _workSegmentA?: LineSegment3d;
  private static _workSegmentB?: LineSegment3d;
  /** Compute closest approach between segments of polylines accessed by index in contextA, contextB.
   * * If distance is of interest to the searchState, save the result.
   */
  public static updateClosestApproachBetweenIndexedSegments(
    contextA: LineString3dRangeTreeContext, indexA: number,
    contextB: LineString3dRangeTreeContext, indexB: number,
    searchState: MinimumValueTester<CurveLocationDetailPair>) {
    contextA.numPointTest++;
    // capture point references ...
    this._workSegmentA = contextA.linestring.getIndexedSegment(indexA, this._workSegmentA)!;
    this._workSegmentB = contextB.linestring.getIndexedSegment(indexB, this._workSegmentB)!;
    const cld = LineSegment3d.closestApproach(this._workSegmentA, false, this._workSegmentB, false);
    if (cld !== undefined && searchState.isNewMinOrTrigger(cld.detailA.a)) {
      // annotate the details with polyline fractions instead of segment fractions.
      const polylineFractionA = (indexA + cld.detailA.fraction) / (contextA.linestring.numPoints() - 1);
      const polylineFractionB = (indexB + cld.detailB.fraction) / (contextB.linestring.numPoints() - 1);

      cld.detailA.fraction = polylineFractionA;
      cld.detailB.fraction = polylineFractionB;
      cld.detailA.curve = undefined;
      cld.detailB.curve = undefined;
      searchState.testAndSave(cld, cld.detailA.a);
    }
  }

}

/**
 * Helper class containing methods in SingleTreeSearchHandler, and a reference to a Polyline3dClosestPointSearcherContext.
 */
class SingleTreeSearchHandlerForClosestPointOnPolyline extends SingleTreeSearchHandler<number> {
  /** calling context */
  public context: LineString3dRangeTreeContext;
  /**
   * CONSTRUCTOR: Capture calling context
   */
  public constructor(context: LineString3dRangeTreeContext) {
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
  private _workSegment?: LineSegment3d;
  /** Test a point (stored in the range tree) as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    this._workSegment = this.context.linestring.getIndexedSegment(candidateIndex, this._workSegment)!;
    const cld = this._workSegment.closestPoint(this.context.spacePoint, false);
    cld.fraction = this.context.linestring.segmentIndexAndLocalFractionToGlobalFraction(candidateIndex, cld.fraction);
    // const cld = PolylineOps.projectPointToUncheckedIndexedSegment(this.context.spacePoint, this.context.linestring, candidateIndex, false, false);
    const d = this.context.spacePoint.distance(cld.point);
    this.context.numPointTest++;
    this.context.searchState.testAndSave(cld, d);
  }
}

/**
 * internal class to receive pairs of facets during search for closest approach.
 * @internal
 */
export class TwoTreeSearchHandlerPolylinePolylineCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** context for first polyline */
  public contextA: LineString3dRangeTreeContext;
  /** context for second polyline */
  public contextB: LineString3dRangeTreeContext;
  /** visitor for first polyline */
  /** search state with current min distance and facet pair */
  public searchState: MinimumValueTester<CurveLocationDetailPair>;
  /** constructor
   * * CAPTURE both contexts
   * * create search state
   * * CAPTURE visitors accessed in contexts
   */
  public constructor(contextA: LineString3dRangeTreeContext, contextB: LineString3dRangeTreeContext) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    this.searchState = MinimumValueTester.create<CurveLocationDetailPair>();
  }
  /** Return the PolygonLocationDetail pair */
  public getResult(): CurveLocationDetailPair | undefined {
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
    LineString3dRangeTreeContext.updateClosestApproachBetweenIndexedSegments(this.contextA, tagA, this.contextB, tagB, this.searchState);
  }
}
