/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { HitSource, HitDetail, HitList, SnapMode, SnapDetail } from "./AccuSnap";

// tslint:disable:no-empty
// tslint:disable:variable-name

/** The possible actions for which a locate filter can be called. */
export const enum LocateAction {
  Identify = 0,
  AutoLocate = 1
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
  Accept = 2
}

export const enum SnapType {
  Points = 1,
  Constraints = 2
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
  Aborted = 2
}

/** Indicates the reason an element was rejected by a filter. */
export const enum LocateFailureValue {
  LOCATE_FAILURE_None = 0,
  LOCATE_FAILURE_NoElements = 1,
  LOCATE_FAILURE_LockedFile = 2,
  LOCATE_FAILURE_LevelLock = 3,
  LOCATE_FAILURE_LockedElem = 4,
  LOCATE_FAILURE_LockedLevel = 5,
  LOCATE_FAILURE_ViewOnly = 6,
  LOCATE_FAILURE_ByApp = 7,
  LOCATE_FAILURE_ByCommand = 8,
  LOCATE_FAILURE_ByType = 9,
  LOCATE_FAILURE_ByProperties = 10,
  LOCATE_FAILURE_Transient = 11,
  LOCATE_FAILURE_FileNotAllowed = 12,
  LOCATE_FAILURE_FileReadOnly = 13,
  LOCATE_FAILURE_NotSnappable = 15,
  LOCATE_FAILURE_ParentNoLocate = 17,
  LOCATE_FAILURE_LockedComponent = 20,
  LOCATE_FAILURE_RejectedByElement = 22,
}

export class LocateOptions {
  public m_disableDgnDbFilter = false;
  public m_allowTransients = false;
  public m_maxHits = 20;
  public m_hitSource = HitSource.DataPoint;
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
}
