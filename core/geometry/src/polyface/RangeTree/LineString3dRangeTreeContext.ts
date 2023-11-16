/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { MinimumValueTester } from "./MinimumValueTester";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";

/**
 * Handler class for searching a range tree containing the segments of a linestring.
 * * Facilitates multiple searches for closest point and close approach calculations.
 * @public
 */
export class LineString3dRangeTreeContext {
  /** Polyline points being searched, indexed by the range tree */
  public lineString: LineString3d;
  /** Evolving search state */
  public searchState: MinimumValueTester<CurveLocationDetail>;
  /** Space point for closest point search */
  public spacePoint: Point3d;

  /** Diagnostic: number of range tests that have returned true */
  public numRangeTestTrue: number;
  /** Diagnostic: number of range tests that have returned false */
  public numRangeTestFalse: number;
  /** Diagnostic: number of points tested */
  public numPointTest: number;
  /** Diagnostic: number of searches. */
  public numSearch: number;

  /** Range tree, whose appData are indices into the linestring points array */
  private _rangeTreeRoot: RangeTreeNode<number>;

  /** Constructor: capture inputs, initialize debug counters */
  private constructor(rangeTreeRoot: RangeTreeNode<number>, points: LineString3d) {
    this.lineString = points;
    this.spacePoint = Point3d.create(0, 0, 0);
    this.searchState = MinimumValueTester.create<CurveLocationDetail>();
    this._rangeTreeRoot = rangeTreeRoot;
    this.numRangeTestTrue = 0;
    this.numRangeTestFalse = 0;
    this.numPointTest = 0;
    this.numSearch = 0;
  }
  /**
   * Create a range tree context for the polyline points:
   * * initialize with segment ranges
   * * appData are segment indices
   * @param linestring captured if LineString3d, otherwise copied
   * @param maxChildPerNode maximum children per range tree node (default 4)
   * @param maxAppDataPerLeaf maximum point indices per leaf node (default 4)
   */
  public static createCapture(points: Point3d[] | LineString3d, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): LineString3dRangeTreeContext | undefined {
    const linestring = points instanceof LineString3d ? points : LineString3d.createPoints(points);
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => { return Range3d.create(linestring.pointAt(index)!, linestring.pointAt(index + 1)!); }),
      ((index: number): number => { return index; }),
      linestring.numPoints() - 1,
      maxChildPerNode,
      maxAppDataPerLeaf,
    );
    return rangeTreeRoot ? new LineString3dRangeTreeContext(rangeTreeRoot, linestring) : undefined;
  }
  /** Search the range tree for the closest linestring point to spacePoint */
  public searchForClosestPoint(spacePoint: Point3d, resetAsNewSearch: boolean = true): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnLineString3d(this);
    this.numSearch++;
    this.spacePoint = spacePoint.clone();
    if (resetAsNewSearch)
      this.searchState.resetMinValueAndItem();
    // seed the search with a few segments -- this reduces early trips deep into ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(this.lineString.numPoints() / 20), 2, 7);
    const testStep = Math.floor(this.lineString.numPoints() / numTest);
    handler.processAppData(0);
    handler.processAppData(this.lineString.numPoints() - 2);
    for (let i = testStep; i + 1 < this.lineString.numPoints(); i += testStep) {
      handler.processAppData(i);
    }
    this._rangeTreeRoot.searchTopDown(handler);
    return this.searchState.itemAtMinValue;
  }
  /**
   * Find a pair of points, one from each polyline in contextA and contextB, with the smallest distance between.
   * @param contextA range tree context for first polyline
   * @param contextB range tree context for second polyline
   * @returns pair of CurveLocationDetails for the closest approach
   */
  public static searchForClosestApproach(
    contextA: LineString3dRangeTreeContext,
    contextB: LineString3dRangeTreeContext,
  ): CurveLocationDetailPair | undefined {
    const handler = new TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach(contextA, contextB);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.getResult();
  }

  private static _workSegmentA?: LineSegment3d;
  private static _workSegmentB?: LineSegment3d;
  /**
   * * Compute closest approach between segments of polylines accessed by segment index in contextA, contextB.
   * * If this close approach distance is of interest to the searchState, update it with the close approach.
   */
  public static updateClosestApproachBetweenIndexedSegments(
    contextA: LineString3dRangeTreeContext,
    indexA: number,
    contextB: LineString3dRangeTreeContext,
    indexB: number,
    searchState: MinimumValueTester<CurveLocationDetailPair>,
  ) {
    contextA.numPointTest++;
    this._workSegmentA = contextA.lineString.getIndexedSegment(indexA, this._workSegmentA)!;
    this._workSegmentB = contextB.lineString.getIndexedSegment(indexB, this._workSegmentB)!;
    const cld = LineSegment3d.closestApproach(this._workSegmentA, false, this._workSegmentB, false);
    if (cld !== undefined && searchState.isNewMinOrTrigger(cld.detailA.a)) {
      cld.detailA.fraction = contextA.lineString.segmentIndexAndLocalFractionToGlobalFraction(indexA, cld.detailA.fraction);
      cld.detailB.fraction = contextB.lineString.segmentIndexAndLocalFractionToGlobalFraction(indexB, cld.detailB.fraction);
      cld.detailA.curve = cld.detailB.curve = undefined;
      searchState.testAndSave(cld, cld.detailA.a);
    }
  }
}

/**
 * Helper class for searching for the closest point in a linestring.
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointOnLineString3d extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: LineString3dRangeTreeContext;
  /** Constructor, captures context */
  public constructor(context: LineString3dRangeTreeContext) {
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
  private _workSegment?: LineSegment3d;
  /** Test a segment indexed in the range tree as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    const segment = this._workSegment = this.context.lineString.getIndexedSegment(candidateIndex, this._workSegment)!;
    if (segment) {
      const cld = segment.closestPoint(this.context.spacePoint, false);
      cld.fraction = this.context.lineString.segmentIndexAndLocalFractionToGlobalFraction(candidateIndex, cld.fraction);
      cld.curve = undefined;
      const d = this.context.spacePoint.distance(cld.point);
      this.context.numPointTest++;
      this.context.searchState.testAndSave(cld, d);
    }
  }
}

/**
 * Helper class for searching for close approach(es) between linestrings.
 * @internal
 */
export class TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** Context for first polyline */
  public contextA: LineString3dRangeTreeContext;
  /** Context for second polyline */
  public contextB: LineString3dRangeTreeContext;
  /** Search state with current min distance point pair */
  public searchState: MinimumValueTester<CurveLocationDetailPair>;
  /** Constructor, all inputs captured */
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
  /** Get current min distance */
  public getCurrentDistance(): number {
    const d = this.searchState.minValue;
    return d === undefined ? Number.MAX_VALUE : d;
  }
  /** Compute and test the closest approach between two segments, given their indices. */
  public processAppDataPair(tagA: number, tagB: number): void {
    LineString3dRangeTreeContext.updateClosestApproachBetweenIndexedSegments(this.contextA, tagA, this.contextB, tagB, this.searchState);
  }
}
