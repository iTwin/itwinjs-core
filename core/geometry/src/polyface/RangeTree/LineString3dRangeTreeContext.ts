/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry } from "../../Geometry";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { RangeTreeNode, RangeTreeOps } from "./RangeTreeNode";
import {
  SingleTreeSearchHandlerForClosestPointOnLineString3d, TwoTreeSearchHandlerForLineString3dLineString3dCloseApproach,
} from "./RangeTreeSearchHandlers";

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
