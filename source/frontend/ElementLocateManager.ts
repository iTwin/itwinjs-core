/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { HitSource, HitDetail, HitList, SnapMode, SnapDetail, SubSelectionMode } from "./AccuSnap";
import { ToolAdmin } from "./tools/ToolAdmin";

// tslint:disable:no-empty
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
  LOCATE_FAILURE_None = 0,
  LOCATE_FAILURE_NoElements = 1,
  LOCATE_FAILURE_LockedElem = 2,
  LOCATE_FAILURE_ByApp = 3,
  LOCATE_FAILURE_ByCommand = 4,
  LOCATE_FAILURE_ByType = 5,
  LOCATE_FAILURE_ByProperties = 6,
  LOCATE_FAILURE_Transient = 7,
  LOCATE_FAILURE_ModelNotAllowed = 8,
  LOCATE_FAILURE_NotSnappable = 9,
  LOCATE_FAILURE_RejectedByElement = 10,
}

export class LocateOptions {
  public m_disableDgnDbFilter = false;
  public m_allowTransients = false;
  public m_maxHits = 20;
  public m_hitSource = HitSource.DataPoint;
}

export class LocateResponse {
  public reason = LocateFailureValue.LOCATE_FAILURE_None;
  public explanation = "";
}

export class ElementLocateManager {
  public static instance = new ElementLocateManager();
  public m_hitList?: HitList;
  public m_currHit?: HitDetail;
  public readonly m_options = new LocateOptions();

  public getApertureInches() { return 0.11; }
  public synchSnapMode() { }
  public onFlashHit(_detail: SnapDetail) { }
  public setChosenSnapMode(_snapType: SnapType, _snapMode: SnapMode) { }

  public readonly locateMessages = new Map<LocateFailureValue, string>([
    [LocateFailureValue.LOCATE_FAILURE_NoElements, "No elements found"],
    [LocateFailureValue.LOCATE_FAILURE_LockedElem, "Element is locked"],
    [LocateFailureValue.LOCATE_FAILURE_ByApp, "Element not valid for current tool"],
    [LocateFailureValue.LOCATE_FAILURE_ByCommand, "Element rejected by tool"],
    [LocateFailureValue.LOCATE_FAILURE_ByType, "Element type not valid for this tool"],
    [LocateFailureValue.LOCATE_FAILURE_ByProperties, "Element properties not valid for this tool"],
    [LocateFailureValue.LOCATE_FAILURE_Transient, "Element is a transient element"],
    [LocateFailureValue.LOCATE_FAILURE_ModelNotAllowed, "Element is in a model that is not allowed by this tool"],
    [LocateFailureValue.LOCATE_FAILURE_NotSnappable, "Element is not snappable"],
    [LocateFailureValue.LOCATE_FAILURE_RejectedByElement, "Element does not allow this operation"],
  ]);

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

  public filterHit(hit: HitDetail, mode: SubSelectionMode, _action: LocateAction, out?: LocateResponse): boolean {
    // Tools must opt-in to locate of transient geometry as it requires special treatment.
    if (!hit.m_elementId.isValid() && !this.m_options.m_allowTransients) {
      if (out) out.reason = LocateFailureValue.LOCATE_FAILURE_Transient;
      return true;
    }

    hit.m_subSelectionMode = mode; // Set mode for flashing segments/entire element...

    const tool = ToolAdmin.instance.activeTool;
    if (!tool)
      return false;

    const retVal = !tool.onPostLocate(hit, out);
    if (retVal && out)
      out.reason = LocateFailureValue.LOCATE_FAILURE_ByCommand;

    return retVal;
  }

}
