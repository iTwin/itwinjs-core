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
   * @param maxAppDataPerLeaf maximum point indices per leaf node (default 4)
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
  /** Search the range tree for the closest linestring point to spacePoint */
  public searchForClosestPoint(spacePoint: Point3d): CurveLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnLineString3d(spacePoint, this);
    this.numSearch++;
    // seed the search with a few segments -- this reduces early trips deep into ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(this.lineString.numPoints() / 20), 2, 7);
    const testStep = Math.floor(this.lineString.numPoints() / numTest);
    handler.processAppData(0);
    handler.processAppData(this.lineString.numPoints() - 2);
    for (let i = testStep; i + 1 < this.lineString.numPoints(); i += testStep)
      handler.processAppData(i);
    this._rangeTreeRoot.searchTopDown(handler);
    return handler.searchState.itemAtMinValue;
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
}

/**
 * Helper class for searching for the closest point in a linestring.
 * @internal
 */
class SingleTreeSearchHandlerForClosestPointOnLineString3d extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: LineString3dRangeTreeContext;
  /** Evolving search state */
  public searchState: MinimumValueTester<CurveLocationDetail>;
  /** Space point for closest point search */
  public spacePoint: Point3d;

  /**
   * Constructor
   * @param spacePoint cloned
   * @param context captured
   */
  public constructor(spacePoint: Point3d, context: LineString3dRangeTreeContext) {
    super();
    this.context = context;
    this.searchState = MinimumValueTester.create<CurveLocationDetail>();
    this.spacePoint = spacePoint.clone();
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
      cld.fraction = this.context.lineString.segmentIndexAndLocalFractionToGlobalFraction(candidateIndex, cld.fraction);
      cld.curve = undefined;
      const d = this.spacePoint.distance(cld.point);
      this.context.numPointTest++;
      this.searchState.testAndSave(cld, d);
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
    const cld = LineSegment3d.closestApproach(segA, false, segB, false);
    if (cld !== undefined && this.searchState.isNewMinOrTrigger(cld.detailA.a)) {
      cld.detailA.fraction = this.contextA.lineString.segmentIndexAndLocalFractionToGlobalFraction(indexA, cld.detailA.fraction);
      cld.detailB.fraction = this.contextB.lineString.segmentIndexAndLocalFractionToGlobalFraction(indexB, cld.detailB.fraction);
      cld.detailA.curve = cld.detailB.curve = undefined;
      this.searchState.testAndSave(cld, cld.detailA.a);
    }
  }
}
