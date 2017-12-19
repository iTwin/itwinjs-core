/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { CurvePrimitive } from "@bentley/geometry-core/lib/curve/CurvePrimitive";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Viewport } from "./Viewport";
import { ViewManager } from "./ViewManager";
import { BeButtonEvent } from "./tools/Tool";
import { TentativePoint } from "./TentativePoint";

// tslint:disable:variable-name

class AccuSnapToolState {
  public m_enabled: boolean;
  public m_locate: boolean;
  public m_suspended: number;
  public m_subSelectionMode: number;
}

class SnapElemIgnore {
  public text: boolean;
  public curves: boolean;
  public dimensions: boolean;
  public meshes: boolean;
  public fillInterior: boolean;
}

class AccuSnapSettings {
  public hotDistanceFactor: number;
  public stickyFactor: number;
  public searchDistance: number;
  public enableForFenceCreate: boolean;
  public showIcon: boolean;
  public showHint: boolean;
  public fixedPtPerpTan: boolean;
  public playSound: boolean;
  public coordUpdate: boolean;
  public hiliteColdHits: boolean;
  public popupInfo: boolean;
  public popupMode: boolean;
  public enableFlag: boolean;
  public readonly ignore = new SnapElemIgnore();
  public popupDelay: number; // delay before info balloon pops up - in 10th of a second
}

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
  SNAP_HEAT_None = 0,
  SNAP_HEAT_NotInRange = 1,   // "of interest", but out of range
  SNAP_HEAT_InRange = 2,
}

export const enum KeypointType {
  KEYPOINT_TYPE_Nearest = 0,
  KEYPOINT_TYPE_Keypoint = 1,
  KEYPOINT_TYPE_Midpoint = 2,
  KEYPOINT_TYPE_Center = 3,
  KEYPOINT_TYPE_Origin = 4,
  KEYPOINT_TYPE_Bisector = 5,
  KEYPOINT_TYPE_Intersection = 6,
  KEYPOINT_TYPE_Tangent = 7,
  KEYPOINT_TYPE_Tangentpoint = 8,
  KEYPOINT_TYPE_Perpendicular = 9,
  KEYPOINT_TYPE_Perpendicularpt = 10,
  KEYPOINT_TYPE_Parallel = 11,
  KEYPOINT_TYPE_Point = 12,
  KEYPOINT_TYPE_PointOn = 13,
  KEYPOINT_TYPE_Unknown = 14,
  KEYPOINT_TYPE_Custom = 15,
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
  public m_primitive: CurvePrimitive;         // curve primitive for hit (world coordinates).
  public readonly m_normal = new Vector3d();  // surface hit normal (world coordinates).
  public m_parentType: HitParentGeomType;     // type of parent geometry.
  public m_geomType: HitGeomType;             // type of hit geometry (edge or interior).
  public m_detailSource: HitDetailSource;     // mask of HitDetailSource values.
  public m_hitPriority: HitPriority;          // Relative priority of hit.
  public m_nonSnappable: boolean;             // non-snappable detail, ex. pattern or line style.
  public m_viewDist: number;                  // xy distance to hit (view coordinates).
  public m_viewZ: number;                     // z distance to hit (view coordinates).
  public m_geomId: Id64;                      // id of geometric primitive that generated this hit
}

export const enum HitDetailType {
  Hit = 1,
  Snap = 2,
  Intersection = 3,
}

export class HitDetail {
  public m_viewport?: Viewport;
  public m_elementId: Id64;
  public m_locateSource: HitSource;  // Operation that generated the hit.
  public readonly m_testPoint = new Point3d();      // the point that was used to search (world coordinates).
  public m_geomDetail: GeomDetail;   // element specific hit details.
  public m_elemTopo?: ElemTopology; // details about the topology of the element.
  public m_hitDescription?: string;
  public m_subSelectionMode: SubSelectionMode; // segment hilite/flash mode.
  public isSnapDetail(): this is SnapDetail { return false; }
  public getHitType(): HitDetailType { return HitDetailType.Hit; }

  public isSameHit(otherHit?: HitDetail): boolean {
    if (!otherHit || this.m_elementId.equals(otherHit.m_elementId))
      return false;

    if (!this.m_elemTopo && !otherHit.m_elemTopo)
      return true;

    if (this.m_elemTopo && !otherHit.m_elemTopo)
      return false;

    return this.m_elemTopo!.isEqual(otherHit.m_elemTopo!);
  }
}

export class SnapDetail extends HitDetail {
  public m_heat: SnapHeat;
  public readonly m_screenPt = new Point2d();
  public m_divisor: number;
  public m_snapMode: SnapMode;                   // snap mode currently associated with this snap
  public m_originalSnapMode: SnapMode;           // snap mode used when snap was created, before constraint override was applied
  public m_minScreenDist: number;                // minimum distance to element in screen coordinates.
  public readonly m_snapPoint = new Point3d();   // hitpoint adjusted by snap
  public readonly m_adjustedPt = new Point3d();  // sometimes accusnap adjusts the point after the snap.
  public m_customKeypointSize: number;
  public m_customKeypointData?: any;
  public m_allowAssociations: boolean;

  public isSnapDetail(): this is SnapDetail { return true; }
  public getAdjustedPoint() { return this.m_adjustedPt; }
  public isHot(): boolean { return this.m_heat !== SnapHeat.SNAP_HEAT_None; }
  public getHitType(): HitDetailType { return HitDetailType.Snap; }
}

/**
 * The result of a "locate" is a sorted list of objects that satisfied the search criteria (a HitList). Earlier hits in the list
 *  are somehow "better" than those later on.
 */
export class HitList {
  public hits: HitDetail[];
  public m_currHit: number;

  public clear(): void { this.hits.length = 0; }
  public empty(): void {
    this.clear();
    this.m_currHit = -1; // we don't have a current hit.
  }
}

export class AccuSnap {
  public static instance = new AccuSnap();
  public m_currHit?: HitDetail;                  // currently active hit
  public m_aSnapHits?: HitList;                  // current list of hits.
  public readonly m_retestList = new HitList();
  public readonly m_needFlash = new Set<Viewport>();    // views that need to be flashed
  public readonly m_areFlashed = new Set<Viewport>();   // views that are already flashed
  // LocateFailureValue  m_errorReason;      // reason code for last error
  // Utf8String          m_explanation;      // why last error was generated.
  // SnapMode            m_candidateSnapMode;// during snap creation: the snap to try
  // int                 m_suppressed;       // number of times "suppress" has been called -- unlike m_suspend this is not automatically cleared by tools
  // bool                m_wasAborted;       // was the search for elements from last motion event aborted?
  private m_waitingForTimeout = false;
  // bool                m_changedCurrentHit;
  private m_noMotionCount = 0;   // number of times "noMotion" has been called since last motion
  private readonly m_infoPt = new Point3d();           // anchor point for infoWindow. window is cleared when cursor moves away from this point.
  // Point2d             m_lastCursorPos;    // Location of cursor when we last checked for motion
  // int                 m_totalMotionSq;    // Accumulated distance (squared) the mouse has moved since we started checking for motion
  // int                 m_motionToleranceSq;// How much mouse movement constitutes a "move" (squared)
  private readonly m_toolstate = new AccuSnapToolState();
  private readonly m_defaultSettings = new AccuSnapSettings();
  private m_settings = this.m_defaultSettings;

  private wantShowIcon() { return this.m_settings.showIcon; }
  private wantShowHint() { return this.m_settings.showHint; }
  private wantInfoBalloon() { return this.m_settings.popupInfo; }
  private wantAutoInfoBalloon() { return this.m_settings.popupInfo && !this.m_settings.popupMode; }
  private wantHiliteColdHits() { return this.m_settings.hiliteColdHits; }
  private wantIgnoreText() { return !this.m_settings.ignore.text; }          // 0 means ignore
  private wantIgnoreDimensions() { return !this.m_settings.ignore.dimensions; }    // 0 means ignore
  private wantIgnoreCurves() { return !this.m_settings.ignore.curves; }        // 0 means ignore
  private wantIgnoreMeshes() { return this.m_settings.ignore.meshes; }         // 1 means ignore
  private wantIgnoreFill() { return this.m_settings.ignore.fillInterior; }   // 1 means ignore
  private getStickyFactor() { return this.m_settings.stickyFactor; }
  private doLocateTesting() { return this.isLocateEnabled(); }
  private getSearchDistance() { return this.doLocateTesting() ? 1.0 : this.m_settings.searchDistance; }
  private getPopupDelay() { return this.m_settings.popupDelay; }
  private getHotDistanceInches() { return ElementLocateManager:: GetManager().GetApertureInches() * this.m_settings.hotDistanceFactor; }
  public isLocateEnabled() { return this.m_toolstate.m_locate; }

  private static toSnapDetail(hit?: HitDetail): SnapDetail | undefined { return (hit && hit.isSnapDetail()) ? hit : undefined; }
  public getCurrSnapDetail(): SnapDetail | undefined { return AccuSnap.toSnapDetail(this.m_currHit); }
  public isHot(): boolean {
    const currSnap = this.getCurrSnapDetail(); return !currSnap ? false : currSnap.isHot();
  }
  public destroy(): void {
    this.m_currHit = undefined;
    this.m_aSnapHits = undefined;
    this.m_retestList.empty();
  }

  /** clear any AccuSnap info on the screen and release any hit path references */
  public clear(): void { this.setCurrHit(undefined); }

  public setCurrHit(newHit?: HitDetail): void {
    const newSnap = AccuSnap.toSnapDetail(newHit);
    const currSnap = this.getCurrSnapDetail();
    const sameElem = (newHit && newHit.isSameHit(this.m_currHit));
    const sameHit = (sameElem && !newSnap);
    const sameSnap = (sameElem && newSnap && currSnap);
    const samePt = (sameHit || (sameSnap && newSnap!.m_screenPt.isExactEqual(currSnap!.m_screenPt)));
    const sameHot = (sameHit || (sameSnap && (this.isHot() === newSnap!.isHot())));
    const sameBaseSnapMode = (!newSnap || !currSnap || newSnap.m_originalSnapMode === currSnap.m_originalSnapMode);
    const sameType = (sameHot && (!currSnap || (currSnap.getHitType() === newHit!.getHitType())));

    // NOTE: When snapping and not also locating, flash component instead of cursor index 
    //       Component mode when locating is handled by FilterHit.
    //       For intersect snap, always show only the segments that intersect.
    if (newSnap) {
      if (HitDetailType.Intersection === newSnap.getHitType() || !this.doLocateTesting())
        newSnap.m_subSelectionMode = SubSelectionMode.Segment;
    }

    // see if it's the same point on the same element, the hot flags are the same multiple snaps, and the snap modes are the same
    if (samePt && sameType && sameBaseSnapMode) {
      // we know that nothing about the screen could change, just save the new hit and return to avoid screen flash
      this.m_currHit = newHit;
      return;
    }

    this.erase();

    // if we hit the same element with the same "hotness" as last time, we don't need to erase it
    //  multiple snaps: but only if the old and new snap modes are the same
    if (!sameHot || !sameBaseSnapMode) {
      this.unFlashViews();
      this.setFlashHit(newHit);
    }

    // we already have a hit. Release our reference to it (leave element hilited though).
    this.m_currHit = undefined;

    // if we didn't get a new hit, we're done
    if (!newHit)
      return;

    // draw sprites for this hit
    this.showSnapSprite();
  }

  public erase(): void {
    this.clearInfoBalloon(undefined); // make sure there's no info balloon up.
    this.clearSprites(); // remove all sprites from the screen
  }

  public clearInfoBalloon(ev?: BeButtonEvent): void {
    this.m_noMotionCount = 0;
    this.m_waitingForTimeout = false;     // necessary in case we exit the view

    if (!viewManager.isInfoWindowUp())
      return;

    if (ev && (5 > ev.viewPoint.distanceXY(this.m_infoPt)))
      return;

    // if (nullptr != t_viewHost -> GetViewManager().GetInfoWindowOwner())
    //   return;
    // // notify any event handlers
    // m_eventHandlers.CallAllHandlers(RemoveInfoCaller());
    // viewManager.clearInfoWindow();
  }

  private clearSprites() {
    // erase both sprites from the screen
    // m_errorIcon.deactivate();
    // m_cross.deactivate();
    // m_icon.deactivate();
  }

  private unFlashViews() {
    this.m_needFlash.clear();

    for (const vp of this.m_areFlashed) {
      // m_eventHandlers.CallAllHandlers(UnFlashCaller(vp.get()));
      vp.setFlashed(undefined, 0.0);
    }
    this.m_areFlashed.clear();
  }

}

export class TentativeOrAccuSnap {
  public static isHot(): boolean { return accuSnap.isHot() || tentativePoint.isSnapped(); }

  public static getCurrentSnap(checkIsHot: boolean = true): SnapDetail | undefined {
    // Checking for a hot AccuSnap hit before checking tentative is probably necessary for extended intersections?
    if (accuSnap.isHot())
      return accuSnap.getCurrSnapDetail();

    if (tentativePoint.isSnapped())
      return tentativePoint.m_currSnap;

    return (checkIsHot ? undefined : accuSnap.getCurrSnapDetail());
  }

  public static getCurrentPoint(): Point3d {
    if (accuSnap.isHot()) {
      const pathP = accuSnap.getCurrSnapDetail();
      if (pathP)
        return pathP.getAdjustedPoint();
    }

    return tentativePoint.getPoint();
  }

  public static getCurrentView(): Viewport | undefined {
    const snap = accuSnap.getCurrSnapDetail();
    return snap ? snap.m_viewport : tentativePoint.m_viewport;
  }
}

const accuSnap = AccuSnap.instance;
const tentativePoint = TentativePoint.instance;
const viewManager = ViewManager.instance;
