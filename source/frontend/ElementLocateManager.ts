/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { HitSource, HitDetail, HitList, SnapMode, SnapDetail, SubSelectionMode } from "./HitDetail";
import { ToolAdmin } from "./tools/ToolAdmin";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "./Viewport";
import { TentativePoint } from "./TentativePoint";
import { BeButtonEvent } from "./tools/Tool";
import { AccuSnap } from "./AccuSnap";

// tslint:disable:variable-name

/** The possible actions for which a locate filter can be called. */
export const enum LocateAction {
  Identify = 0,
  AutoLocate = 1,
}

/**
 * Values to return from a locate filter.
 * @note It would be rare and extreme for a locate filter to ever return Accept.
 * <p>Usually, filters will return Reject to indicate the element is unacceptable, or Neutral to
 * indicate that the element is acceptable <i>as far as this filter is concerned.</i> By returning Accept, a
 * single filter can cause the element to be accepted, <b>without calling other filters</b> that might otherwise reject the element.
 * Indicates the reason an element was rejected by a filter.
 */
export const enum LocateFilterStatus {
  Reject = 0,
  Neutral = 1,
  Accept = 2,
}

export const enum SnapType {
  Points = 1,
  Constraints = 2,
}

export const enum SnapStatus {
  Success = 0,
  Aborted = 1,
  NoElements = 2,
  Disabled = 100,
  NoSnapPossible = 200,
  NotSnappable = 300,
  ModelNotSnappable = 301,
  FilteredByCategory = 400,
  FilteredByUser = 500,
  FilteredByApp = 600,
  FilteredByAppQuietly = 700,
}

export const enum TestHitStatus {
  NotOn = 0,
  IsOn = 1,
  Aborted = 2,
}

/** Indicates the reason an element was rejected by a filter. */
export const enum LocateFailureValue {
  None = 0,
  NoElements = 1,
  LockedElem = 2,
  ByApp = 3,
  ByCommand = 4,
  ByType = 5,
  ByProperties = 6,
  Transient = 7,
  ModelNotAllowed = 8,
  NotSnappable = 9,
  RejectedByElement = 10,
}

export class LocateOptions {
  public disableIModelFilter = false;
  public allowTransients = false;
  public maxHits = 20;
  public hitSource = HitSource.DataPoint;
  public clone(): LocateOptions {
    const other = new LocateOptions();
    other.disableIModelFilter = this.disableIModelFilter;
    other.allowTransients = this.allowTransients;
    other.hitSource = this.hitSource;
    other.maxHits = this.maxHits;
    return other;
  }
}

export class LocateResponse {
  public snapStatus = SnapStatus.Success;
  public reason = LocateFailureValue.None;
  public explanation = "";
}

export interface HitListHolder {
  setHitList(list: HitList | undefined): void;
}

export class ElementPicker {
  public viewport?: Viewport;
  public readonly pickPointWorld = new Point3d();
  public hitList?: HitList;
  public lastPickAborted = false;

  public empty() {
    this.pickPointWorld.setZero();
    this.viewport = undefined;
    this.lastPickAborted = true;
    if (this.hitList)
      this.hitList.empty();
    else
      this.hitList = new HitList();
  }

  /** return the HitList for the last Pick performed. Optionally allows the caller to take ownership of the list. */
  public getHitList(takeOwnership: boolean): HitList {
    const list = this.hitList!;
    if (takeOwnership)
      this.hitList = undefined;
    return list;
  }

  public getNextHit(): HitDetail | undefined {
    const list = this.hitList;
    return list ? list.getNextHit() : undefined;
  }

  /** return a particular hit from the list of hits from the last time pickElements was called. */
  public getHit(i: number): HitDetail | undefined {
    const list = this.hitList;
    return list ? list.getHit(i) : undefined;
  }

  public resetCurrentHit(): void {
    const list = this.hitList;
    if (list) list.resetCurrentHit();
  }

  /** generate a list of elements that are close to a datapoint. */
  public doPick(vp: Viewport, pickPointWorld: Point3d, _pickApertureScreen: number, _options: LocateOptions): number {
    if (this.hitList && this.hitList.size() > 0 && !this.lastPickAborted && (vp === this.viewport) && pickPointWorld.isAlmostEqual(this.pickPointWorld)) {
      this.hitList.resetCurrentHit();
      return this.hitList.size();
    }

    this.empty(); // empty the hit list
    this.viewport = vp;
    this.pickPointWorld.setFrom(pickPointWorld);

    // NEEDS_WORK
    // PickContext pickContext(options, stopTest);
    // m_lastPickAborted = pickContext.PickElements(vp, pickPointWorld, pickApertureScreen, m_hitList);

    return this.hitList!.size();
  }

  /**
   * test a (previously generated) hit against a new datapoint (presumes same view)
   * @return true if the point is on the element
   */
  public testHit(_hit: HitDetail, hitList: HitList | undefined, _vp: Viewport, _pickPointWorld: Point3d, _pickApertureScreen: number, _options: LocateOptions): TestHitStatus {
    // if they didn't supply a hit list, and we don't have one, create one.
    if (!hitList && !this.hitList)
      this.empty();

    // NEEDS_WORK
    // PickContext pickContext(options, stopTest);
    // return pickContext.TestHit(hit, vp, pickPointWorld, pickApertureScreen, !hitList ? this.hitList : hitList);
    return TestHitStatus.NotOn;
  }
}

export class ElementLocateManager {
  public static instance = new ElementLocateManager();
  public m_hitList?: HitList;
  public m_currHit?: HitDetail;
  public readonly m_options = new LocateOptions();
  public readonly m_picker = new ElementPicker();

  public getApertureInches() { return 0.11; }
  public getKeypointDivisor() { return 2; }
  public synchSnapMode() { }
  public onFlashHit(_detail: SnapDetail) { }
  public onAccuSnapMotion(_detail: SnapDetail | undefined, _wasHot: boolean, _ev: BeButtonEvent) { }
  public getElementPicker() { return this.m_picker; }
  public getLocateOptions() { return this.m_options; }
  public setChosenSnapMode(_snapType: SnapType, _snapMode: SnapMode) { }
  public isConstraintSnapActive(): boolean { return false; }
  public performConstraintSnap(_detail: SnapDetail, _hotDistance: number, _snapSource: HitSource) { return SnapStatus.Success; }

  public readonly locateMessages = new Map<LocateFailureValue, string>([
    [LocateFailureValue.NoElements, "No elements found"],
    [LocateFailureValue.LockedElem, "Element is locked"],
    [LocateFailureValue.ByApp, "Element not valid for current tool"],
    [LocateFailureValue.ByCommand, "Element rejected by tool"],
    [LocateFailureValue.ByType, "Element type not valid for this tool"],
    [LocateFailureValue.ByProperties, "Element properties not valid for this tool"],
    [LocateFailureValue.Transient, "Element is a transient element"],
    [LocateFailureValue.ModelNotAllowed, "Element is in a model that is not allowed by this tool"],
    [LocateFailureValue.NotSnappable, "Element is not snappable"],
    [LocateFailureValue.RejectedByElement, "Element does not allow this operation"],
  ]);

  public clear(): void { this.setCurrHit(undefined); }
  public setHitList(list?: HitList) { this.m_hitList = list; }
  public setCurrHit(hit?: HitDetail): void { this.m_currHit = hit; }
  public getNextHit(): HitDetail | undefined {
    const list = this.m_hitList;
    return list ? list.getNextHit() : undefined;
  }

  /** return the current path from either the snapping logic or the pre-locating systems. */
  public getPreLocatedHit(): HitDetail | undefined {
    // NOTE: Check AccuSnap first as Tentative is used to build intersect snap. For normal snaps when a Tentative is active there should be no AccuSnap.
    let preLocated = AccuSnap.instance.getHitAndList(this);

    if (!preLocated && !!(preLocated = TentativePoint.instance.getHitAndList(this))) {
      const vp = preLocated.m_viewport!;
      this.m_picker.empty(); // Get new hit list at hit point; want reset to cycle hits using adjusted point location...
      this.m_picker.doPick(vp, preLocated.getHitPoint(), (vp.pixelsFromInches(this.getApertureInches()) / 2.0) + 1.5, this.m_options);
      this.setHitList(this.m_picker.getHitList(true));
    }

    if (this.m_hitList)
      this.m_hitList.resetCurrentHit();

    return preLocated;
  }

  public getLocateError(reason: number): string {
    const val = this.locateMessages.get(reason);
    const msg = val ? val : "Locate error";
    return msg;
  }

  public getPreferredPointSnapModes(source: HitSource): SnapMode[] {
    const snaps: SnapMode[] = [];

    // The user's finger is likely to create unwanted AccuSnaps
    if (HitSource.AccuSnap === source && !ToolAdmin.instance.isCurrentInputSourceMouse())
      return snaps;

    // We need a snap mode UI!!! Removed center and intersection they were just obnoxious. -BB 06/2015
    snaps.push(SnapMode.NearestKeypoint);
    snaps.push(SnapMode.Nearest);
    return snaps;
  }

  public filterHit(hit: HitDetail, mode: SubSelectionMode, _action: LocateAction, out: LocateResponse): boolean {
    // Tools must opt-in to locate of transient geometry as it requires special treatment.
    if (!hit.m_elementId && !this.m_options.allowTransients) {
      out.reason = LocateFailureValue.Transient;
      return true;
    }

    hit.m_subSelectionMode = mode; // Set mode for flashing segments/entire element...

    const tool = ToolAdmin.instance.activeTool;
    if (!tool)
      return false;

    const retVal = !tool.onPostLocate(hit, out);
    if (retVal)
      out.reason = LocateFailureValue.ByCommand;

    return retVal;
  }
}
