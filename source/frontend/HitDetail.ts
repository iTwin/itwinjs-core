/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
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
// tslint:disable:no-conditional-assignment

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

  //   //! Return GeometrySource to handle requests related to transient geometry (like locate) where we don't have an DgnElement.
  //   toGeometrySource(): GeometrySource;
  // //! Return IEditManipulator for interacting with transient geometry.
  // //! @note Implementor is expected to check hit.GetDgnDb().IsReadonly().
  // virtual IEditManipulatorPtr _GetTransientManipulator(HitDetailCR) const { return nullptr;}
}

export class GeomDetail {
  public m_primitive?: CurvePrimitive;         // curve primitive for hit (world coordinates).
  public readonly m_closePoint = new Point3d(); // the closest point on geometry (world coordinates).
  public readonly m_normal = new Vector3d();  // surface hit normal (world coordinates).
  public m_parentType = HitParentGeomType.None;     // type of parent geometry.
  public m_geomType = HitGeomType.None;             // type of hit geometry (edge or interior).
  public m_detailSource = HitDetailSource.None;     // mask of HitDetailSource values.
  public m_hitPriority = HitPriority.Highest;          // Relative priority of hit.
  public m_nonSnappable = false;             // non-snappable detail, ex. pattern or line style.
  public m_viewDist = 0;                  // xy distance to hit (view coordinates).
  public m_viewZ = 0;                     // z distance to hit (view coordinates).
  public m_geomId?: Id64;                      // id of geometric primitive that generated this hit

  public clone(): GeomDetail {
    const other = new GeomDetail();
    other.setFrom(this);
    return other;
  }
  public setFrom(other: GeomDetail): void {
    other.m_primitive = this.m_primitive;
    other.m_closePoint.setFrom(this.m_closePoint);
    other.m_normal.setFrom(this.m_normal);
    other.m_parentType = this.m_parentType;
    other.m_geomType = this.m_geomType;
    other.m_detailSource = this.m_detailSource;
    other.m_hitPriority = this.m_hitPriority;
    other.m_nonSnappable = this.m_nonSnappable;
    other.m_viewDist = this.m_viewDist;
    other.m_viewZ = this.m_viewZ;
    other.m_geomId = this.m_geomId;
  }
  public isValidSurfaceHit(): boolean { return (HitGeomType.Surface === this.m_geomType && 0.0 !== this.m_normal.magnitude()); }
  public isValidEdgeHit(): boolean {
    switch (this.m_geomType) {
      case HitGeomType.Segment:
      case HitGeomType.Curve:
      case HitGeomType.Arc:
        return true;
    }
    return false;
  }
}

export const enum HitDetailType {
  Hit = 1,
  Snap = 2,
  Intersection = 3,
}

export class HitDetail {
  public m_elemTopo?: ElemTopology; // details about the topology of the element.
  public m_hitDescription: string;
  public m_subSelectionMode = SubSelectionMode.None; // segment hilite/flash mode.
  public constructor(public m_viewport: Viewport, public m_sheetViewport: Viewport | undefined, public m_elementId: Id64 | undefined, public m_testPoint: Point3d, public m_locateSource: HitSource, public m_geomDetail: GeomDetail) { }

  public isSnapDetail(): this is SnapDetail { return false; }
  public getHitType(): HitDetailType { return HitDetailType.Hit; }
  public isSameHit(otherHit?: HitDetail): boolean {
    if (!otherHit || Id64.areEqual(this.m_elementId, otherHit.m_elementId)) return false;
    if (!this.m_elemTopo && !otherHit.m_elemTopo) return true;
    if (this.m_elemTopo && !otherHit.m_elemTopo) return false;
    return this.m_elemTopo!.isEqual(otherHit.m_elemTopo!);
  }
  public draw(context: DecorateContext): void { context.drawHit(this); }
  public getHitPoint(): Point3d { return this.m_geomDetail.m_closePoint; }
}

export class SnapDetail extends HitDetail {
  public m_heat = SnapHeat.None;
  public readonly m_screenPt = new Point2d();
  public m_divisor: number;
  public m_sprite?: Sprite;
  public m_snapMode: SnapMode;            // snap mode currently associated with this snap
  public m_originalSnapMode: SnapMode;    // snap mode used when snap was created, before constraint override was applied
  public m_minScreenDist: number;         // minimum distance to element in screen coordinates.
  public readonly m_snapPoint: Point3d;   // hitpoint adjusted by snap
  public readonly m_adjustedPt: Point3d;  // sometimes accusnap adjusts the point after the snap.
  public m_customKeypointSize = 0;
  public m_customKeypointData?: any;
  public m_allowAssociations = true;

  public constructor(from: HitDetail) {
    super(from.m_viewport, from.m_sheetViewport, from.m_elementId, from.m_testPoint, from.m_locateSource, from.m_geomDetail);
    this.m_snapPoint = this.m_geomDetail.m_closePoint.clone();
    this.m_adjustedPt = this.m_snapPoint.clone();
    this.m_snapMode = this.m_originalSnapMode = SnapMode.First;

    if (from.isSnapDetail()) {
      this.m_minScreenDist = from.m_minScreenDist;
    } else {
      this.m_minScreenDist = this.m_geomDetail.m_viewDist;
      this.m_geomDetail.m_viewDist = 0.0;
    }
  }

  public isSnapDetail(): this is SnapDetail { return true; }
  public getAdjustedPoint() { return this.m_adjustedPt; }
  public isHot(): boolean { return this.m_heat !== SnapHeat.None; }
  public isPointOnCurve(): boolean { return this.m_heat === SnapHeat.InRange; }
  public getHitType(): HitDetailType { return HitDetailType.Snap; }
  public getHitPoint(): Point3d { return this.isHot() ? this.m_snapPoint : super.getHitPoint(); }
}

export class IntersectDetail extends SnapDetail {
  public secondHit?: HitDetail;
}

/**
 * The result of a "locate" is a sorted list of objects that satisfied the search criteria (a HitList). Earlier hits in the list
 *  are somehow "better" than those later on.
 */
export class HitList {
  public hits: HitDetail[];
  public m_currHit: number;
  public size(): number { return this.hits.length; }
  public clear(): void { this.hits.length = 0; }
  public empty(): void { this.clear(); this.resetCurrentHit(); }
  public resetCurrentHit(): void { this.m_currHit = -1; }

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

  public getCurrentHit(): HitDetail | undefined { return -1 === this.m_currHit ? undefined : this.getHit(this.m_currHit); }
  public getNextHit(): HitDetail | undefined { this.m_currHit++; return this.getCurrentHit(); }

  /** remove a hit in the list. */
  public removeHit(hitNum: number) {
    if (hitNum < 0)                     // *** NEEDS WORK: The old ObjectArray used to support -1 == END
      hitNum = this.size() - 1;

    if (hitNum >= this.m_currHit)
      this.m_currHit = -1;

    if (hitNum >= this.size())        // Locate calls GetNextHit, which increments m_currHit, until it goes beyond the end of size of the array.
      return;                         // Then Reset call RemoteCurrentHit, which passes in m_currHit. When it's out of range, we do nothing.

    this.hits.splice(hitNum, 1);
  }

  /** search through list and remove any hits that contain a specified element id. */
  public removeHitsFrom(element: Id64): boolean {
    let removedOne = false;

    // walk backwards through list so we don't have to worry about what happens on remove
    for (let i = this.size() - 1; i >= 0; i--) {
      const thisHit = this.hits[i];
      if (thisHit && element.equals(thisHit.m_elementId))
        removedOne = true;
      this.removeHit(i);
    }
    return removedOne;
  }

  private static s_tooCloseTolerance = 1.0e-10;
  private static doZCompareOfSurfaceAndEdge(oHitSurf: HitDetail, oHitEdge: HitDetail): number {
    const origin = oHitSurf.m_geomDetail.m_closePoint;
    const normal = oHitSurf.m_geomDetail.m_normal;
    const homogeneousPlane = Point4d.createFromPointAndWeight(normal, -normal.dotProduct(origin));
    const worldToViewMap = oHitSurf.m_viewport.rootToView;
    const eyePointWorld = worldToViewMap.transform1Ref().columnZ();
    const testPointWorld = oHitEdge.m_geomDetail.m_closePoint;
    const a0 = homogeneousPlane.dotProduct(eyePointWorld);
    const a1 = homogeneousPlane.dotProductXYZW(testPointWorld.x, testPointWorld.y, testPointWorld.z, 1.0);
    const tol = HitList.s_tooCloseTolerance * (1.0 + Math.abs(a0) + Math.abs(a1) + Math.abs(homogeneousPlane.w));
    return (Math.abs(a1) < tol) ? 0 : ((a0 * a1 > 0) ? 1 : -1);
  }

  private static doZCompare(oHit1: HitDetail, oHit2: HitDetail): number {
    const z1 = oHit1.m_geomDetail.m_viewZ;
    const z2 = oHit2.m_geomDetail.m_viewZ;

    // For 2d hits z reflects display priority which should be checked before locate priority, etc. when a fill/surface hit is involved...
    if (!oHit1.m_viewport.view.is3d()) {
      // screen z values are sorted descending
      if (z2 < z1) return -1;
      if (z2 > z1) return 1;
      return 0;
    }

    // Point clouds already output only a single best z for a screen location...only compare using screen distance, not z...
    if (HitDetailSource.PointCloud === oHit1.m_geomDetail.m_detailSource && HitDetailSource.PointCloud === oHit2.m_geomDetail.m_detailSource)
      return 0;

    // Always prioritize sprites (ex. HUD markers) over surface hits...
    if (HitDetailSource.Sprite === oHit1.m_geomDetail.m_detailSource || HitDetailSource.Sprite === oHit2.m_geomDetail.m_detailSource)
      return 0;

    const normal1 = oHit1.m_geomDetail.m_normal;
    const normal2 = oHit2.m_geomDetail.m_normal;

    // NOTE: Only surfaces display hidden edges...NEEDSWORK: Nothing is hidden by transparent display style (RenderMode::SmoothShade)...
    const flags1 = oHit1.m_viewport.view.displayStyle.viewFlags;
    const flags2 = oHit2.m_viewport.view.displayStyle.viewFlags;
    const hiddenEdgesVisible = flags1.hiddenEdgesVisible();
    const isObscurableWireHit1 = (RenderMode.Wireframe !== flags1.renderMode && HitParentGeomType.Wire === oHit1.m_geomDetail.m_parentType);
    const isObscurableWireHit2 = (RenderMode.Wireframe !== flags2.renderMode && HitParentGeomType.Wire === oHit2.m_geomDetail.m_parentType);

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
      const p1 = oHit1.m_geomDetail.m_hitPriority;
      const p2 = oHit2.m_geomDetail.m_hitPriority;
      if (p2 < p1) return -1;
      if (p2 > p1) return 1;
    }

    const dist1 = HitList.tenthOfPixel(oHit1.m_geomDetail.m_viewDist);
    const dist2 = HitList.tenthOfPixel(oHit2.m_geomDetail.m_viewDist);
    if (dist2 < dist1) return -1;
    if (dist2 > dist1) return 1;

    // Linestyle/pattern/thickness hits have lower priority...
    const source1 = oHit1.m_geomDetail.m_detailSource;
    const source2 = oHit2.m_geomDetail.m_detailSource;
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

  public removeCurrentHit() { this.removeHit(this.m_currHit); }
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
