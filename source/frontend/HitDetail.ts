/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { CurvePrimitive } from "@bentley/geometry-core/lib/curve/CurvePrimitive";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Viewport } from "./Viewport";
import { DecorateContext } from "./ViewContext";
import { RenderMode } from "../common/Render";
import { Geometry } from "@bentley/geometry-core/lib/Geometry";
import { Point4d } from "@bentley/geometry-core/lib/numerics/Geometry4d";
import { Sprite } from "./Sprites";

// tslint:disable:variable-name

export const enum SnapMode {
  Invalid = -1,
  First = 0,
  None = 0,
  Nearest = 1,
  NearestKeypoint = 1 << 1,
  MidPoint = 1 << 2,
  Center = 1 << 3,
  Origin = 1 << 4,
  Bisector = 1 << 5,
  Intersection = 1 << 6,
  Tangency = 1 << 7,
  TangentPoint = 1 << 8,
  Perpendicular = 1 << 9,
  PerpendicularPoint = 1 << 10,
  Parallel = 1 << 11,
  Multi3 = 1 << 12,
  PointOn = 1 << 13,
  Multi1 = 1 << 14,
  Multi2 = 1 << 15,
  MultiSnaps = (Multi1 | Multi2 | Multi3),
  AllOrdinary = (Nearest | NearestKeypoint | MidPoint | Center | Origin | Bisector | Intersection | MultiSnaps),
  AllConstraint = (Tangency | TangentPoint | Perpendicular | PerpendicularPoint | Parallel | PointOn),
  IntersectionCandidate = (Intersection | Nearest),
  NumSnapModes = 16,
}

export const enum SnapHeat {
  None = 0,
  NotInRange = 1,   // "of interest", but out of range
  InRange = 2,
}

export const enum KeypointType {
  Nearest = 0,
  Keypoint = 1,
  Midpoint = 2,
  Center = 3,
  Origin = 4,
  Bisector = 5,
  Intersection = 6,
  Tangent = 7,
  TangentPoint = 8,
  Perpendicular = 9,
  PerpendicularPoint = 10,
  Parallel = 11,
  Point = 12,
  PointOn = 13,
  Unknown = 14,
  Custom = 15,
}

export const enum SubSelectionMode {
  /** Select entire element - No sub-selection */
  None = 0,
  /** Select single DgnGeometryPart */
  Part = 1,
  /** Select single GeometricPrimitive */
  Primitive = 2,
  /** Select single ICurvePrimitive/line string segment of open paths, and planar regions. */
  Segment = 3,
}

/*  Lower numbers are "better" (more important) Hits than ones with higher numbers. */
export const enum HitPriority {
  Highest = 0,
  Vertex = 300,
  Origin = 400,
  Edge = 400,
  TextBox = 500,
  Region = 550,
  Interior = 600,
}

/** The procedure that generated this Hit. */
export const enum HitSource {
  None = 0,
  FromUser = 1,
  MotionLocate = 2,
  AccuSnap = 3,
  TentativeSnap = 4,
  DataPoint = 5,
  Application = 6,
  EditAction = 7,
  EditActionSS = 8,
}

/**
 * What was being tested to generate this hit. This is not the element or
 * GeometricPrimitive that generated the Hit, it's an indication of whether it's an
 * edge or interior hit.
 */
export const enum HitGeomType {
  None = 0,
  Point = 1,
  Segment = 2,
  Curve = 3,
  Arc = 4,
  Surface = 5,
}

/** Indicates whether the GeometricPrimitive that generated the hit was a wire, surface, or solid. */
export const enum HitParentGeomType {
  None = 0,
  Wire = 1,
  Sheet = 2,
  Solid = 3,
  Mesh = 4,
  Text = 5,
}

/** Hit detail source can be used to tell what display operation generated the geometry */
export const enum HitDetailSource {
  None = 0,
  LineStyle = 1,
  Pattern = 1 << 1,
  Thickness = 1 << 2,
  PointCloud = 1 << 3,
  Sprite = 1 << 4,
}

export interface ElemTopology {
  /** Create a deep copy of this object. */
  clone(): ElemTopology;

  /** Compare objects and return true if they should be considered the same. */
  isEqual(other: ElemTopology): boolean;
}

export class GeomDetail {
  public primitive?: CurvePrimitive;         // curve primitive for hit (world coordinates).
  public readonly closePoint = new Point3d(); // the closest point on geometry (world coordinates).
  public readonly normal = new Vector3d();  // surface hit normal (world coordinates).
  public parentType = HitParentGeomType.None;     // type of parent geometry.
  public geomType = HitGeomType.None;             // type of hit geometry (edge or interior).
  public detailSource = HitDetailSource.None;     // mask of HitDetailSource values.
  public hitPriority = HitPriority.Highest;          // Relative priority of hit.
  public nonSnappable = false;             // non-snappable detail, ex. pattern or line style.
  public viewDist = 0;                  // xy distance to hit (view coordinates).
  public viewZ = 0;                     // z distance to hit (view coordinates).
  public geomId?: Id64;                      // id of geometric primitive that generated this hit

  public clone(): GeomDetail {
    const other = new GeomDetail();
    other.setFrom(this);
    return other;
  }
  public setFrom(other: GeomDetail): void {
    other.primitive = this.primitive;
    other.closePoint.setFrom(this.closePoint);
    other.normal.setFrom(this.normal);
    other.parentType = this.parentType;
    other.geomType = this.geomType;
    other.detailSource = this.detailSource;
    other.hitPriority = this.hitPriority;
    other.nonSnappable = this.nonSnappable;
    other.viewDist = this.viewDist;
    other.viewZ = this.viewZ;
    other.geomId = this.geomId;
  }
  public isValidSurfaceHit(): boolean { return (HitGeomType.Surface === this.geomType && 0.0 !== this.normal.magnitude()); }
  public isValidEdgeHit(): boolean {
    switch (this.geomType) {
      case HitGeomType.Segment:
      case HitGeomType.Curve:
      case HitGeomType.Arc:
        return true;
    }
    return false;
  }
  public setClosestPoint(pt: Point3d) { this.closePoint.setFrom(pt); }
}

export const enum HitDetailType {
  Hit = 1,
  Snap = 2,
  Intersection = 3,
}

export class HitDetail {
  public elemTopo?: ElemTopology; // details about the topology of the element.
  public hitDescription?: string;
  public subSelectionMode = SubSelectionMode.None; // segment hilite/flash mode.
  public constructor(public viewport: Viewport, public sheetViewport: Viewport | undefined, public elementId: string | undefined, public readonly testPoint: Point3d, public locateSource: HitSource, public readonly geomDetail: GeomDetail) { }

  public isSnapDetail(): this is SnapDetail { return false; }
  public getHitType(): HitDetailType { return HitDetailType.Hit; }
  public isSameHit(otherHit?: HitDetail): boolean {
    if (!otherHit || this.elementId === otherHit.elementId) return false;
    if (!this.elemTopo && !otherHit.elemTopo) return true;
    if (this.elemTopo && !otherHit.elemTopo) return false;
    return this.elemTopo!.isEqual(otherHit.elemTopo!);
  }
  public draw(context: DecorateContext): void { context.drawHit(this); }
  public getHitPoint(): Point3d { return this.geomDetail.closePoint; }
  public setHitPoint(pt: Point3d) { this.geomDetail.setClosestPoint(pt); }
  public setTestPoint(pt: Point3d) { this.testPoint.setFrom(pt); }
  public setFrom(other: HitDetail) {
    this.elemTopo = other.elemTopo;
    this.hitDescription = other.hitDescription;
    this.subSelectionMode = other.subSelectionMode;
    this.viewport = other.viewport;
    this.sheetViewport = other.sheetViewport;
    this.elementId = other.elementId;
    this.testPoint.setFrom(other.testPoint);
    this.locateSource = other.locateSource;
    this.geomDetail.setFrom(other.geomDetail);
  }
  public clone(): HitDetail { const val = new HitDetail(this.viewport, this.sheetViewport, this.elementId, this.testPoint, this.locateSource, this.geomDetail.clone()); val.setFrom(this); return val; }
}

export class SnapDetail extends HitDetail {
  public heat = SnapHeat.None;
  public readonly screenPt = new Point2d();
  public divisor?: number;
  public sprite?: Sprite;
  public snapMode: SnapMode;            // snap mode currently associated with this snap
  public originalSnapMode: SnapMode;    // snap mode used when snap was created, before constraint override was applied
  public minScreenDist: number;         // minimum distance to element in screen coordinates.
  public readonly snapPoint: Point3d;   // hitPoint adjusted by snap
  public readonly adjustedPt: Point3d;  // sometimes accuSnap adjusts the point after the snap.
  public customKeypointSize = 0;
  public customKeypointData?: any;
  public allowAssociations = true;

  public constructor(from: HitDetail) {
    super(from.viewport, from.sheetViewport, from.elementId, from.testPoint, from.locateSource, from.geomDetail);
    this.snapPoint = this.geomDetail.closePoint.clone();
    this.adjustedPt = this.snapPoint.clone();
    this.snapMode = this.originalSnapMode = SnapMode.First;

    if (from.isSnapDetail()) {
      this.minScreenDist = from.minScreenDist;
    } else {
      this.minScreenDist = this.geomDetail.viewDist;
      this.geomDetail.viewDist = 0.0;
    }
  }

  public setFrom(other: SnapDetail) {
    super.setFrom(other);
    this.heat = other.heat;
    this.hitDescription = other.hitDescription;
    this.screenPt.setFrom(other.screenPt);
    this.divisor = other.divisor;
    this.sprite = other.sprite;
    this.snapMode = other.snapMode;
    this.originalSnapMode = other.originalSnapMode;
    this.minScreenDist = other.minScreenDist;
    this.snapPoint.setFrom(other.snapPoint);
    this.adjustedPt.setFrom(other.adjustedPt);
    this.customKeypointSize = other.customKeypointSize;
    this.customKeypointData = other.customKeypointData;
    this.allowAssociations = other.allowAssociations;
  }

  public clone(): SnapDetail { const val = new SnapDetail(this); val.setFrom(this); return val; }
  public isSnapDetail(): this is SnapDetail { return true; }
  public getAdjustedPoint() { return this.adjustedPt; }
  public isHot(): boolean { return this.heat !== SnapHeat.None; }
  public isPointOnCurve(): boolean { return this.heat === SnapHeat.InRange; }
  public getHitType(): HitDetailType { return HitDetailType.Snap; }
  public getHitPoint(): Point3d { return this.isHot() ? this.snapPoint : super.getHitPoint(); }
  public setHitPoint(hitPoint: Point3d) { this.snapPoint.setFrom(hitPoint); this.adjustedPt.setFrom(hitPoint); }
}

export class IntersectDetail extends SnapDetail {
  public secondHit?: HitDetail;
}

/**
 * The result of a "locate" is a sorted list of objects that satisfied the search criteria (a HitList). Earlier hits in the list
 *  are somehow "better" than those later on.
 */
export class HitList {
  public hits: HitDetail[] = [];
  public currHit = 0;
  public size(): number { return this.hits.length; }
  public clear(): void { this.hits.length = 0; }
  public empty(): void { this.clear(); this.resetCurrentHit(); }
  public resetCurrentHit(): void { this.currHit = -1; }

  /**
   * get a hit from a particular index into a HitList
   * return       the requested hit from the HitList or undefined
   */
  public getHit(hitNum: number): HitDetail | undefined {
    if (hitNum < 0) hitNum = this.size() - 1;
    return (hitNum >= this.size()) ? undefined : this.hits[hitNum];
  }
  public setHit(i: number, p: HitDetail | undefined): void {
    if (i < 0 || i >= this.size())
      return;
    this.hits[i] = p!;
  }

  public dropNulls(): void {
    const hits = this.hits;
    this.hits = [];
    for (const hit of hits)
      this.hits.push(hit);
  }

  public getCurrentHit(): HitDetail | undefined { return -1 === this.currHit ? undefined : this.getHit(this.currHit); }
  public getNextHit(): HitDetail | undefined { this.currHit++; return this.getCurrentHit(); }

  /** remove a hit in the list. */
  public removeHit(hitNum: number) {
    if (hitNum < 0)                     // *** NEEDS WORK: The old ObjectArray used to support -1 == END
      hitNum = this.size() - 1;

    if (hitNum >= this.currHit)
      this.currHit = -1;

    if (hitNum >= this.size())        // Locate calls GetNextHit, which increments currHit, until it goes beyond the end of size of the array.
      return;                         // Then Reset call RemoteCurrentHit, which passes in currHit. When it's out of range, we do nothing.

    this.hits.splice(hitNum, 1);
  }

  /** search through list and remove any hits that contain a specified element id. */
  public removeHitsFrom(element: string): boolean {
    let removedOne = false;

    // walk backwards through list so we don't have to worry about what happens on remove
    for (let i = this.size() - 1; i >= 0; i--) {
      const thisHit = this.hits[i];
      if (thisHit && element === thisHit.elementId)
        removedOne = true;
      this.removeHit(i);
    }
    return removedOne;
  }

  private static s_tooCloseTolerance = 1.0e-10;
  private static doZCompareOfSurfaceAndEdge(oHitSurf: HitDetail, oHitEdge: HitDetail): number {
    const origin = oHitSurf.geomDetail.closePoint;
    const normal = oHitSurf.geomDetail.normal;
    const homogeneousPlane = Point4d.createFromPointAndWeight(normal, -normal.dotProduct(origin));
    const worldToViewMap = oHitSurf.viewport.rootToView;
    const eyePointWorld = worldToViewMap.transform1.columnZ();
    const testPointWorld = oHitEdge.geomDetail.closePoint;
    const a0 = homogeneousPlane.dotProduct(eyePointWorld);
    const a1 = homogeneousPlane.dotProductXYZW(testPointWorld.x, testPointWorld.y, testPointWorld.z, 1.0);
    const tol = HitList.s_tooCloseTolerance * (1.0 + Math.abs(a0) + Math.abs(a1) + Math.abs(homogeneousPlane.w));
    return (Math.abs(a1) < tol) ? 0 : ((a0 * a1 > 0) ? 1 : -1);
  }

  private static doZCompare(oHit1: HitDetail, oHit2: HitDetail): number {
    const z1 = oHit1.geomDetail.viewZ;
    const z2 = oHit2.geomDetail.viewZ;

    // For 2d hits z reflects display priority which should be checked before locate priority, etc. when a fill/surface hit is involved...
    if (!oHit1.viewport.view.is3d()) {
      // screen z values are sorted descending
      if (z2 < z1) return -1;
      if (z2 > z1) return 1;
      return 0;
    }

    // Point clouds already output only a single best z for a screen location...only compare using screen distance, not z...
    if (HitDetailSource.PointCloud === oHit1.geomDetail.detailSource && HitDetailSource.PointCloud === oHit2.geomDetail.detailSource)
      return 0;

    // Always prioritize sprites (ex. HUD markers) over surface hits...
    if (HitDetailSource.Sprite === oHit1.geomDetail.detailSource || HitDetailSource.Sprite === oHit2.geomDetail.detailSource)
      return 0;

    const normal1 = oHit1.geomDetail.normal;
    const normal2 = oHit2.geomDetail.normal;

    // NOTE: Only surfaces display hidden edges...NEEDS_WORK: Nothing is hidden by transparent display style (RenderMode::SmoothShade)...
    const flags1 = oHit1.viewport.view.displayStyle.viewFlags;
    const flags2 = oHit2.viewport.view.displayStyle.viewFlags;
    const hiddenEdgesVisible = flags1.hiddenEdgesVisible();
    const isObscurableWireHit1 = (RenderMode.Wireframe !== flags1.renderMode && HitParentGeomType.Wire === oHit1.geomDetail.parentType);
    const isObscurableWireHit2 = (RenderMode.Wireframe !== flags2.renderMode && HitParentGeomType.Wire === oHit2.geomDetail.parentType);

    const mag1 = normal1.magnitude();
    const mag2 = normal2.magnitude();
    if (0.0 !== mag1 && 0.0 !== mag2) {
      // Both surface hits...if close let other criteria determine order...
      if (Geometry.isDistanceWithinTol(z1 - z2, HitList.s_tooCloseTolerance))
        return 0;
    } else if (0.0 !== mag1) {
      // 1st is surface hit...project 2nd hit into plane defined by surface normal...
      const compareResult = (hiddenEdgesVisible && !isObscurableWireHit2) ? 1 : HitList.doZCompareOfSurfaceAndEdge(oHit1, oHit2);
      return (0 === compareResult ? 0 : compareResult);
    }
    if (0.0 !== mag2) {
      // 2nd is surface hit...project 1st hit into plane defined by surface normal...
      const compareResult = (hiddenEdgesVisible && !isObscurableWireHit1) ? 1 : HitList.doZCompareOfSurfaceAndEdge(oHit2, oHit1);
      return (0 === compareResult ? 0 : -compareResult);
    }
    // else {
    //   // NOTE: I don't believe this case currently exists...silhouette hits are only created for cones/spheres and always have a curve primitive...
    //   bool isSilhouetteHit1 = (HitGeomType:: Surface == oHit1.GetGeomDetail().GetGeomType() && NULL == oHit1.GetGeomDetail().GetCurvePrimitive());
    //   bool isSilhouetteHit2 = (HitGeomType:: Surface == oHit2.GetGeomDetail().GetGeomType() && NULL == oHit2.GetGeomDetail().GetCurvePrimitive());

    //   // NOTE: Likely silhouette hit, make sure it always loses to a real edge hit...
    //   if (isSilhouetteHit1 && !isSilhouetteHit2)
    //     return 1;
    //   if (isSilhouetteHit2 && !isSilhouetteHit1)
    //     return -1;
    //   if (DoubleOps:: WithinTolerance(z1, z2, s_tooCloseTolerance))
    //   return 0; // Both silhouette or real edge hits...if close let other criteria determine order...
    // }

    // screen z values are sorted descending
    return (z2 < z1) ? -1 : (z2 > z1) ? 1 : 0;
  }

  private static tenthOfPixel(inValue: number): number { return Math.floor((inValue * 10.0) + 0.5) / 10.0; }
  /**
   * compare two hits for insertion into list. Hits are compared by calling getLocatePriority() and then getLocateDistance() on each.
   */
  public compare(oHit1: HitDetail | undefined, oHit2: HitDetail | undefined, comparePriority: boolean, compareZ: boolean): number {
    if (!oHit1 || !oHit2)
      return 0;

    if (compareZ) {
      const zCompareValue = HitList.doZCompare(oHit1, oHit2);
      if (0 !== zCompareValue)
        return zCompareValue;
    }

    if (comparePriority) {
      const p1 = oHit1.geomDetail.hitPriority;
      const p2 = oHit2.geomDetail.hitPriority;
      if (p2 < p1) return -1;
      if (p2 > p1) return 1;
    }

    const dist1 = HitList.tenthOfPixel(oHit1.geomDetail.viewDist);
    const dist2 = HitList.tenthOfPixel(oHit2.geomDetail.viewDist);
    if (dist2 < dist1) return -1;
    if (dist2 > dist1) return 1;

    // Linestyle/pattern/thickness hits have lower priority...
    const source1 = oHit1.geomDetail.detailSource;
    const source2 = oHit2.geomDetail.detailSource;
    return (source2 < source1) ? -1 : (source2 > source1) ? 1 : 0;
  }

  /**
   * Add a new hit to the list. Hits are sorted according to their priority and distance.
   */
  public addHit(newHit: HitDetail, _allowDuplicates: boolean, comparePriority: boolean): number {
    if (this.size() === 0) {
      this.hits.push(newHit);
      return 0;
    }

    // NOTE: Starting from the end ensures that all edge hits will get compared against surface hits to properly
    //       determine their visibility. With a forward iterator, an edge hit could end up being chosen that is obscured
    //       if it is closer to the eye than an un-obscured edge hit.
    let index = this.size() - 1;
    for (; index >= 0; --index) {
      const comparison = this.compare(this.hits[index], newHit, comparePriority, true);
      if (comparison >= 0)
        continue;
      break;
    }

    this.hits.splice(index, 0, newHit);
    return index;
  }

  public removeCurrentHit() { this.removeHit(this.currHit); }
  public setCurrentHit(hit: HitDetail): void {
    this.resetCurrentHit();
    for (let thisHit; undefined !== (thisHit = this.getNextHit());) {
      if (thisHit === hit)
        return;
    }
  }
  public insert(i: number, hit: HitDetail): void {
    if (i < 0 || i >= this.size())
      this.hits.push(hit);
    else
      this.hits.splice(i, 0, hit);
  }
}
