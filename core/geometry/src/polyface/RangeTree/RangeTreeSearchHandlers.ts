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
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolygonLocationDetail, PolygonOps } from "../../geometry3d/PolygonOps";
import { Range3d } from "../../geometry3d/Range";
import { ConvexFacetLocationDetail, FacetLocationDetail, FacetLocationDetailPair, NonConvexFacetLocationDetail } from "../FacetLocationDetail";
import { LineString3dRangeTreeContext } from "./LineString3dRangeTreeContext";
import { MinimumValueTester } from "./MinimumValueTester";
import { Point3dArrayRangeTreeContext } from "./Point3dArrayRangeTreeContext";
import { PolyfaceRangeTreeContext } from "./PolyfaceRangeTreeContext";
import { SingleTreeSearchHandler, TwoTreeDistanceMinimizationSearchHandler } from "./RangeTreeNode";

/**
 * Helper class for searching for the closest point in a set of points.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring CurveLocationDetail).
 * @internal
 */
export class SingleTreeSearchHandlerForClosestPointInArray extends SingleTreeSearchHandler<number> {
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

/**
 * Helper class for searching for the closest point in a linestring.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring CurveLocationDetail).
 * @internal
 */
export class SingleTreeSearchHandlerForClosestPointOnLineString3d extends SingleTreeSearchHandler<number> {
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

/**
 * Helper class for searching for the closest point in a polyface.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring FacetLocationDetail).
 * @internal
 */
export class SingleTreeSearchHandlerForClosestPointOnPolyface extends SingleTreeSearchHandler<number> {
  /** The calling context */
  public context: PolyfaceRangeTreeContext;
  /** Evolving search state */
  public searchState: MinimumValueTester<FacetLocationDetail>;
  /** Space point for the search */
  public spacePoint: Point3d;
  /** Whether to include facet interior in search */
  public searchFacetInterior: boolean;

  /**
   * Constructor
   * @param spacePoint cloned
   * @param context captured
   * @param maxDist collect points at no more than this distance from spacePoint
   * @param searchFacetInterior true: search facet interior + boundary; false: just boundary
   */
  public constructor(spacePoint: Point3d, context: PolyfaceRangeTreeContext, maxDist?: number, searchFacetInterior: boolean = false) {
    super();
    this.context = context;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<FacetLocationDetail>(maxDist);
    this.spacePoint = spacePoint.clone();
    this.searchFacetInterior = searchFacetInterior;
  }
  /** Return the current closest point */
  public getResult(): FacetLocationDetail | undefined {
    if (this.searchState.minValue !== undefined && this.searchState.itemAtMinValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  /** Return the collected closest points (if collecting) */
  public getSavedItems(): FacetLocationDetail[] | undefined {
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
  /** Test a facet indexed in the range tree as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    this.context.visitor.setNumWrap(0); // so edgeCount === pointCount; closure point unnecessary for closestPoint[OnBoundary]
    if (this.context.visitor.moveToReadIndex(candidateIndex)) {
      let pld: PolygonLocationDetail | undefined;
      if (this.searchFacetInterior)
        pld = PolygonOps.closestPoint(this.context.visitor.point, this.spacePoint);
      else
        pld = PolygonOps.closestPointOnBoundary(this.context.visitor.point, this.spacePoint);
      this.context.numFacetTest++;
      if (pld && this.searchState.isNewMinOrTrigger(pld.a)) {
        const edgeCount = this.context.visitor.pointCount;
        const fld = this.context.convexFacets
          ? ConvexFacetLocationDetail.createCapture(this.context.visitor.currentReadIndex(), edgeCount, pld)
          : NonConvexFacetLocationDetail.createCapture(this.context.visitor.currentReadIndex(), edgeCount, pld);
        this.searchState.testAndSave(fld, pld.a);
      }
    }
  }
}
/**
 * Helper class for searching for the closest approach between polyfaces.
 * * Future optimization: avoid sqrt by using squared distance throughout (would require refactoring FacetLocationDetail).
 * @internal
 */
export class TwoTreeSearchHandlerForFacetFacetCloseApproach extends TwoTreeDistanceMinimizationSearchHandler<number> {
  /** Context for first polyface */
  public contextA: PolyfaceRangeTreeContext;
  /** Context for second polyface */
  public contextB: PolyfaceRangeTreeContext;
  /** Search state with current min distance and facet pair */
  public searchState: MinimumValueTester<FacetLocationDetailPair>;
  /** Whether to include facet interior in search */
  public searchFacetInterior: boolean;

  /** Constructor
   * @param contextA captured
   * @param contextB captured
   * @param maxDist collect points at no more than this separation distance
   * @param searchFacetInterior true: search facet interior + boundary; false: just boundary
  */
  public constructor(contextA: PolyfaceRangeTreeContext, contextB: PolyfaceRangeTreeContext, maxDist?: number, searchFacetInterior: boolean = false) {
    super();
    this.contextA = contextA;
    this.contextB = contextB;
    if (maxDist !== undefined && maxDist < 0)
      maxDist = undefined;
    this.searchState = MinimumValueTester.create<FacetLocationDetailPair>(maxDist);
    this.searchFacetInterior = searchFacetInterior && contextA.convexFacets && contextB.convexFacets;
  }
  /** Return the facets with closest approach */
  public getResult(): FacetLocationDetailPair | undefined {
    if (this.searchState.minValue !== undefined) {
      return this.searchState.itemAtMinValue;
    }
    return undefined;
  }
  /** Return the collected close approaches (if collecting) */
  public getSavedItems(): FacetLocationDetailPair[] | undefined {
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
  /** Compute and test the closest approach between two facets, given their indices. */
  public override processAppDataPair(indexA: number, indexB: number): void {
    this.contextA.visitor.setNumWrap(1);  // closed polygons are more efficient for PolygonOps.closestApproach
    this.contextB.visitor.setNumWrap(1);
    if (this.contextA.visitor.moveToReadIndex(indexA) && this.contextB.visitor.moveToReadIndex(indexB)) {
      // ASSUME: not worth sending in maxDist here...
      const pldPair = PolygonOps.closestApproach(this.contextA.visitor.point, this.contextB.visitor.point, undefined, this.searchFacetInterior);
      this.contextA.numFacetTest++;
      if (pldPair && this.searchState.isNewMinOrTrigger(pldPair.detailA.a)) {
        const edgeCountA = this.contextA.visitor.pointCount - 1;
        const edgeCountB = this.contextB.visitor.pointCount - 1;
        const fldPair = FacetLocationDetailPair.create(
          this.contextA.convexFacets ? ConvexFacetLocationDetail.createCapture(indexA, edgeCountA, pldPair.detailA) : NonConvexFacetLocationDetail.createCapture(indexA, edgeCountA, pldPair.detailA),
          this.contextB.convexFacets ? ConvexFacetLocationDetail.createCapture(indexB, edgeCountB, pldPair.detailB) : NonConvexFacetLocationDetail.createCapture(indexB, edgeCountB, pldPair.detailB),
        );
        this.searchState.testAndSave(fldPair, fldPair.detailA.a);
      }
    }
  }
}

