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
   * @param maxAppDataPerLeaf maximum segment indices per leaf node (default 4)
   */
  public static createCapture(points: Point3d[] | LineString3d, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): LineString3dRangeTreeContext | undefined {
    const linestring = points instanceof LineString3d ? points : LineString3d.createPoints(points);
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => { return Range3d.create(linestring.pointAt(index)!, linestring.pointAt(index + 1)!); }),
      ((index: number): number => { return index; }),
      linestring.numPoints() - 1,   // number of segments
      maxChildPerNode,
      maxAppDataPerLeaf,
    );
    return rangeTreeRoot ? new LineString3dRangeTreeContext(rangeTreeRoot, linestring) : undefined;
  }
  /**
   * Search the range tree for closest point(s) to spacePoint.
   * @param spacePoint point to test
   * @param maxDist collect points at no more than this distance from spacePoint. If undefined, return only the closest point.
   * @return closest point detail(s) with detail.a set to the distance from spacePoint to detail.point
   */
  public searchForClosestPoint(spacePoint: Point3d, maxDist?: number): CurveLocationDetail | CurveLocationDetail[] | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnLineString3d(spacePoint, this, maxDist);
    this.numSearch++;
    // seed the search with a few segments -- this reduces early trips deep into ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(this.lineString.numPoints() / 20), 2, 7);
    const testStep = Math.floor(this.lineString.numPoints() / numTest);
    handler.processAppData(0);
    handler.processAppData(this.lineString.numPoints() - 2);
    for (let i = testStep; i + 1 < this.lineString.numPoints(); i += testStep)
      handler.processAppData(i);
    this._rangeTreeRoot.searchTopDown(handler);
    return handler.searchState.savedItems.length <= 1 ? handler.getResult() : handler.getSavedItems();
  }
  /**
   * Search the range trees for closest approach(es) between the polylines.
   * @param contextA first polyline context
   * @param contextB second polyline context
   * @param maxDist collect close approaches separated by no more than this distance. If undefined, return only the closest approach.
   * @return closest approach detail pair(s), one per context, with detail.a set to the approach distance
  */
  public static searchForClosestApproach(contextA: LineString3dRangeTreeContext, contextB: LineString3dRangeTreeContext, maxDist?: number): CurveLocationDetailPair | CurveLocationDetailPair[] | undefined {
    const handler = new TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach(contextA, contextB, maxDist);
    RangeTreeNode.searchTwoTreesTopDown(contextA._rangeTreeRoot, contextB._rangeTreeRoot, handler);
    return handler.searchState.savedItems.length <= 1 ? handler.getResult() : handler.getSavedItems();
  }
}

/**
 * Helper class for searching for the closest point in a linestring.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring CurveLocationDetail).
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointOnLineString3d extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: LineString3dRangeTreeContext;
  /** Evolving search state */
  public searchState: MinimumValueTester<CurveLocationDetail>;
  /** Space point for the search */
  public spacePoint: Point3d;

  /**
   * Constructor
   * @param spacePoint cloned
   * @param context captured
   * @param maxDist collect points at no more than this distance from spacePoint
   */
  public constructor(spacePoint: Point3d, context: LineString3dRangeTreeContext, maxDist?: number) {
    super();
    this.context = context;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<CurveLocationDetail>(maxDist);
    this.spacePoint = spacePoint.clone();
  }
  /** Return the current closest point */
  public getResult(): CurveLocationDetail | undefined {
    if (this.searchState.minValue !== undefined && this.searchState.itemAtMinValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  /** Return the collected closest points (if collecting) */
  public getSavedItems(): CurveLocationDetail[] | undefined {
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
  private _workSegment?: LineSegment3d;
  /** Test a segment indexed in the range tree as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    const segment = this._workSegment = this.context.lineString.getIndexedSegment(candidateIndex, this._workSegment)!;
    if (segment) {
      const cld = segment.closestPoint(this.spacePoint, false);
      LineString3d.convertLocalToGlobalDetail(cld, candidateIndex, this.context.lineString.numEdges(), this.context.lineString);
      this.context.numPointTest++;
      this.searchState.testAndSave(cld, cld.a);
    }
  }
}

/**
 * Helper class for searching for the closest approach between linestrings.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring CurveLocationDetail).
 * @internal
 */
export class TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** Context for first polyline */
  public contextA: LineString3dRangeTreeContext;
  /** Context for second polyline */
  public contextB: LineString3dRangeTreeContext;
  /** Search state with current min distance point pair */
  public searchState: MinimumValueTester<CurveLocationDetailPair>;

  /**
   * Constructor
   * @param contextA captured
   * @param contextB captured
   * @param maxDist collect points at no more than this separation distance
   */
  public constructor(contextA: LineString3dRangeTreeContext, contextB: LineString3dRangeTreeContext, maxDist?: number) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<CurveLocationDetailPair>(maxDist);
  }
  /**
   * Return the current closest approach.
   * * Details contain linestring *and* segment data, cf. [[LineString3d.convertLocalToGlobalDetail]]
   */
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
  private static _workSegmentA?: LineSegment3d;
  private static _workSegmentB?: LineSegment3d;
  /** Compute and test the closest approach between two segments, given their indices. */
  public override processAppDataPair(indexA: number, indexB: number): void {
    this.contextA.numPointTest++;
    const segA = TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach._workSegmentA =
      this.contextA.lineString.getIndexedSegment(indexA, TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach._workSegmentA)!;
    const segB = TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach._workSegmentB =
      this.contextB.lineString.getIndexedSegment(indexB, TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach._workSegmentB)!;
    const cldPair = LineSegment3d.closestApproach(segA, false, segB, false);
    if (cldPair && this.searchState.isNewMinOrTrigger(cldPair.detailA.a)) {
      LineString3d.convertLocalToGlobalDetail(cldPair.detailA, indexA, this.contextA.lineString.numEdges(), this.contextA.lineString);
      LineString3d.convertLocalToGlobalDetail(cldPair.detailB, indexB, this.contextB.lineString.numEdges(), this.contextB.lineString);
      this.searchState.testAndSave(cldPair, cldPair.detailA.a);
    }
  }
}
