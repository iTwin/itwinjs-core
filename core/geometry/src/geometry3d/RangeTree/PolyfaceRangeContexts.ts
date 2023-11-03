/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Range3d } from "../Range";
import { MinimumValueTester } from "./MinimumValueTester";
import { Point3d } from "../Point3dVector3d";
import { Geometry } from "../../Geometry";
import { RangeTreeNode, RangeTreeOps, SingleTreeSearchHandler } from "./RangeTree";
import { FacetLocationDetail, NonConvexFacetLocationDetail } from "../../polyface/FacetLocationDetail";
import { PolyfaceVisitor } from "../../polyface/Polyface";
import { PolygonOps } from "../PolygonOps";
/**
 * class to host a point array and associated RangeTree for multiple search calls.
 */
export class PolyfaceRangeSearchContext {
  public visitor: PolyfaceVisitor;

  public numRangeTestTrue: number;
  public numRangeTestFalse: number;
  public numPointTest: number;
  public numSearch: number;

  private _rangeTreeRoot: RangeTreeNode<number>;

  private constructor(rangeTreeRoot: RangeTreeNode<number>, visitor: PolyfaceVisitor) {
    this.visitor = visitor;
    this._rangeTreeRoot = rangeTreeRoot;
    this.numRangeTestTrue = 0;
    this.numRangeTestFalse = 0;
    this.numPointTest = 0;
    this.numSearch = 0;
  }

  /**
   * Create a range tree for the Polyface points.
   *
   * @param points Polyface points.  THIS ARRAY POINTER IS CAPTURED.
   * @returns Polyface3dClosestPointSearchContext with a range tree and the point array.
   */
  public static createCapture(visitor: PolyfaceVisitor, maxChildPerNode: number = 4, maxAppDataPerLeaf: number = 4): PolyfaceRangeSearchContext | undefined {
    const numFacet = visitor.clientPolyface()!.facetCount!;
    const rangeTreeRoot = RangeTreeOps.createByIndexSplits<number>(
      ((index: number): Range3d => {
        visitor.moveToReadIndex(index);
        return visitor.range();
      }),
      ((index: number): number => { return index; }),
      numFacet,
      maxChildPerNode, maxAppDataPerLeaf,
    );
    return rangeTreeRoot !== undefined ? new PolyfaceRangeSearchContext(rangeTreeRoot, visitor) : undefined;
  }

  public searchForClosestPoint(spacePoint: Point3d): FacetLocationDetail | undefined {
    const handler = new SingleTreeSearchHandlerForClosestPointOnPolyface(spacePoint, this);
    this.numSearch++;
    const numFacet = this.visitor.clientPolyface()!.facetCount!;
    // seed the search with a few points -- this reduces early trips deep into early ranges that are far from spacePoint.
    const numTest = Geometry.clamp(Math.floor(numFacet / 20), 2, 7);
    const testStep = Math.floor(numFacet / numTest);
    handler.processAppData(0);
    handler.processAppData(numFacet - 1);

    for (let i = testStep; i + 1 < numFacet; i += testStep) {
      handler.processAppData(i);
    }
    this._rangeTreeRoot.searchTopDown(handler);
    return handler.searchState.itemAtMinValue;
  }
}

/**
 * Helper class containing methods in SingleTreeSearchHandler, and a reference to a Polyface3dClosestPointSearcherContext.
 */
class SingleTreeSearchHandlerForClosestPointOnPolyface extends SingleTreeSearchHandler<number> {
  public visitor: PolyfaceVisitor;
  public context: PolyfaceRangeSearchContext;
  public searchState: MinimumValueTester<FacetLocationDetail>;
  public spacePoint: Point3d;
  public constructor(spacePoint: Point3d, context: PolyfaceRangeSearchContext) {
    super();
    this.context = context;
    this.visitor = context.visitor;
    this.searchState = MinimumValueTester.create();
    this.spacePoint = spacePoint.clone();
  }
  /**
   *
   * @param range range containing items to be tested.
   * @returns true if the spacePoint is within the range or close enough that a point in the range could be the closest.
   */
  public isRangeActive(range: Range3d): boolean {
    const dMin = range.distanceToPoint(this.spacePoint);
    if (this.searchState.isNewMinValue(dMin)) {
      this.context.numRangeTestTrue++;
      return true;
    }
    this.context.numRangeTestFalse++;
    return false;
  }
  /** Test a point (stored in the range tree) as candidate for "closest" */
  public override processAppData(candidateIndex: number): void {
    if (this.visitor.moveToReadIndex(candidateIndex)) {
      const polygonLocationDetail = PolygonOps.closestPointOnBoundary(this.visitor.point, this.spacePoint, candidateIndex, undefined);
      if (undefined !== polygonLocationDetail) {
        const d = this.spacePoint.distance(polygonLocationDetail.point);
        this.context.numPointTest++;
        if (this.searchState.isNewMinValue(d)) {
          const fld = NonConvexFacetLocationDetail.create(this.visitor.currentReadIndex(), this.visitor.point.length, polygonLocationDetail);
          this.searchState.testAndSave(fld, d);
        }
      }
    }
  }
}
