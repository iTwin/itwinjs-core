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
import { RangeTreeNode, RangeTreeOps } from "./RangeTreeNode";
import {
  SingleTreeSearchHandlerForClosestPointInArray, TwoTreeSearchHandlerForPoint3dArrayPoint3dArrayCloseApproach,
} from "./RangeTreeSearchHandlers";

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

