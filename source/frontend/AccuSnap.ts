/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d, XAndY } from "@bentley/geometry-core/lib/PointVector";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Viewport } from "./Viewport";
import { ViewManager } from "./ViewManager";
import { BeButtonEvent } from "./tools/Tool";
import { TentativePoint } from "./TentativePoint";
import { ElementLocateManager, LocateFailureValue, SnapStatus, LocateAction, LocateResponse, HitListHolder, TestHitStatus, SnapType } from "./ElementLocateManager";
import { SpriteLocation, Sprite } from "./Sprites";
import { ToolAdmin } from "./tools/ToolAdmin";
import { DecorateContext } from "./ViewContext";
import { HitDetail, HitList, SnapMode, SnapDetail, SubSelectionMode, HitSource, HitDetailType, HitPriority } from "./HitDetail";

// tslint:disable:variable-name
// tslint:disable:no-conditional-assignment
// tslint:disable:no-empty

const s_unfocused: any = {};
const s_focused: any = {};
const s_notSnappable: any = {};
const s_appFiltered: any = {};

class AccuSnapToolState {
  public m_enabled = false;
  public m_locate = false;
  public m_suspended = 0;
  public m_subSelectionMode = 0;
}

class SnapElemIgnore {
  public text = true;
  public curve = true;
  public dimensions = true;
  public meshes = false;
  public fillInterior = false;
}

class AccuSnapSettings {
  public hotDistanceFactor = 1.2;
  public stickyFactor = 1.0;
  public searchDistance = 2.0;
  public enableForFenceCreate = false;
  public showIcon = true;
  public showHint = true;
  public fixedPtPerpTan = true;
  public playSound = false;
  public coordUpdate = false;
  public hiliteColdHits = true;
  public popupInfo = true;
  public popupMode = false;
  public enableFlag = true;
  public readonly ignore = new SnapElemIgnore();
  public popupDelay = 5; // delay before info balloon pops up - in 10th of a second
}

export class AccuSnap {
  public static instance = new AccuSnap();
  public currHit?: HitDetail;                            // currently active hit
  public aSnapHits?: HitList;                            // current list of hits.
  public readonly retestList = new HitList();
  public readonly needFlash = new Set<Viewport>();       // views that need to be flashed
  public readonly areFlashed = new Set<Viewport>();      // views that are already flashed
  public readonly cross = new SpriteLocation();          // the "+" that indicates where the snap point is
  public readonly icon = new SpriteLocation();           // the icon that indicates what type of snap is active
  public readonly errorIcon = new SpriteLocation();      // the icon that indicates an error
  public errorReason: LocateFailureValue;                // reason code for last error
  public explanation?: string;                           // why last error was generated.
  private candidateSnapMode = SnapMode.First;            // during snap creation: the snap to try
  private suppressed = 0;                                // number of times "suppress" has been called -- unlike m_suspend this is not automatically cleared by tools
  private wasAborted = false;                            // was the search for elements from last motion event aborted?
  private noMotionCount = 0;                             // number of times "noMotion" has been called since last motion
  private readonly infoPt = new Point3d();               // anchor point for infoWindow. window is cleared when cursor moves away from this point.
  private readonly lastCursorPos = new Point2d();        // Location of cursor when we last checked for motion
  private totalMotionSq = 0;                             // Accumulated distance (squared) the mouse has moved since we started checking for motion
  private motionToleranceSq = 0;                         // How much mouse movement constitutes a "move" (squared)
  private readonly toolState = new AccuSnapToolState();
  private readonly defaultSettings = new AccuSnapSettings();
  private settings = this.defaultSettings;

  private wantShowIcon() { return this.settings.showIcon; }
  private wantShowHint() { return this.settings.showHint; }
  private wantInfoBalloon() { return this.settings.popupInfo; }
  private wantAutoInfoBalloon() { return this.settings.popupInfo && !this.settings.popupMode; }
  private wantIgnoreFill() { return this.settings.ignore.fillInterior; }   // 1 means ignore
  private wantHiliteColdHits() { return this.settings.hiliteColdHits; }
  private getStickyFactor() { return this.settings.stickyFactor; }
  private doLocateTesting() { return this.isLocateEnabled(); }
  private getSearchDistance() { return this.doLocateTesting() ? 1.0 : this.settings.searchDistance; }
  private getPopupDelay() { return this.settings.popupDelay; }
  private getHotDistanceInches() { return elementLocateManager.getApertureInches() * this.settings.hotDistanceFactor; }
  public isLocateEnabled() { return this.toolState.m_locate; }
  private isFlashed(view: Viewport): boolean { return (this.areFlashed.has(view)); }
  private needsFlash(view: Viewport): boolean { return (this.needFlash.has(view)); }
  private setNeedsFlash(view: Viewport) { this.needFlash.add(view); this.clearIsFlashed(view); view.invalidateDecorations(); }
  private setIsFlashed(view: Viewport) { this.areFlashed.add(view); }
  private clearIsFlashed(view: Viewport) { this.areFlashed.delete(view); }
  private isSnapEnabled(): boolean { return this.toolState.m_enabled; }
  private getUserEnabled(): boolean { return this.settings.enableFlag; }
  private userWantsSnaps(): boolean { return this.getUserEnabled(); }
  private static toSnapDetail(hit?: HitDetail): SnapDetail | undefined { return (hit && hit.isSnapDetail()) ? hit : undefined; }
  public getCurrSnapDetail(): SnapDetail | undefined { return AccuSnap.toSnapDetail(this.currHit); }
  public isHot(): boolean { const currSnap = this.getCurrSnapDetail(); return !currSnap ? false : currSnap.isHot(); }

  public destroy(): void {
    this.currHit = undefined;
    this.aSnapHits = undefined;
    this.retestList.empty();
  }
  private doSnapping(): boolean { return this.isSnapEnabled() && this.userWantsSnaps() && !this.isSnapSuspended(); }
  private isSnapSuspended(): boolean { return (0 !== this.suppressed || 0 !== this.toolState.m_suspended); }
  public getSnapMode(): SnapMode { return this.candidateSnapMode !== SnapMode.First ? this.candidateSnapMode : SnapMode.Nearest; }
  public setSubSelectionMode(newMode: SubSelectionMode) { this.toolState.m_subSelectionMode = newMode; }

  private isActivePointSnap(snapModeToFind: SnapMode): boolean {
    const snaps = elementLocateManager.getPreferredPointSnapModes(HitSource.AccuSnap);
    for (const snap of snaps) { if (snap === snapModeToFind) return true; }
    return false;
  }

  /**
   * Check to see whether its appropriate to generate an AccuSnap point, given the current user
   * and command settings, and whether a tentative point is currently active.
   */
  public isActive(): boolean {
    // Unless we're snapping in intersect mode (to find extended intersections), skip if tentative point active...
    if (tentativePoint.isActive)
      return this.isActivePointSnap(SnapMode.Intersection) && this.doSnapping();

    return this.doSnapping() || this.doLocateTesting();
  }

  private initializeForCheckMotion(): void {
    this.lastCursorPos.setFrom(toolAdmin.currentInputState.lastMotion);
    this.totalMotionSq = 0;
    this.motionToleranceSq = toolAdmin.isCurrentInputSourceMouse() ? 1 : 20;
  }

  public checkStopLocate(): boolean {
    const curPos = toolAdmin.currentInputState.lastMotion; //  Get the current cursor pos and compute the distance moved since last check.
    const dx = curPos.x - this.lastCursorPos.x;
    const dy = curPos.y - this.lastCursorPos.y;
    if (0 === dx && 0 === dy) // quick negative test
      return false;

    this.lastCursorPos.setFrom(curPos); //  Remember the new pos

    //  See if distance moved since we started checking is over the "move" threshold
    const dsq = dx * dx + dy * dy;
    this.totalMotionSq += dsq;
    return this.totalMotionSq > this.motionToleranceSq;
  }

  /** clear any AccuSnap info on the screen and release any hit path references */
  public clear(): void { this.setCurrHit(undefined); }
  public setCurrHit(newHit?: HitDetail): void {
    const newSnap = AccuSnap.toSnapDetail(newHit);
    const currSnap = this.getCurrSnapDetail();
    const sameElem = (newHit && newHit.isSameHit(this.currHit));
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
      this.currHit = newHit;
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
    this.currHit = undefined;

    // if we didn't get a new hit, we're done
    if (!newHit)
      return;

    // draw sprites for this hit
    this.showSnapSprite();
  }

  /**  flash a hit in a single view. */
  private flashHitInView(hit: HitDetail, context: DecorateContext) {
    const viewport = context.viewport;
    if (!this.hitShouldBeHilited(hit) || !this.needsFlash(viewport))
      return;

    hit.draw(context);
    viewport.setFlashed(hit.m_elementId, 0.25);
    this.setIsFlashed(viewport);
  }

  private setNeedsFlashView(view: Viewport) {
    if (this.isFlashed(view) || this.needsFlash(view))
      return;
    this.setNeedsFlash(view);
  }

  /** flash a hit in its view. */
  private setFlashHit(hit?: HitDetail): void {
    if (!hit || !this.hitShouldBeHilited(hit))
      return;
    this.setNeedsFlashView(hit.m_viewport!);
    const snap = AccuSnap.toSnapDetail(hit);
    if (snap && snap.isHot())
      elementLocateManager.onFlashHit(snap);
  }

  public erase(): void {
    this.clearInfoBalloon(undefined); // make sure there's no info balloon up.
    this.clearSprites(); // remove all sprites from the screen
  }

  public showElemInfo(viewPt: Point3d, vp: Viewport, hit: HitDetail): void {
    if (viewManager.doesHostHaveFocus())
      this.showLocateMessage(viewPt, vp, toolAdmin.getInfoString(hit, "\n"));
  }

  private showLocateMessage(viewPt: Point3d, vp: Viewport, msg: string) {
    if (viewManager.doesHostHaveFocus())
      viewManager.showInfoWindow(viewPt, vp, msg);
  }

  public displayInfoBalloon(viewPt: Point3d, vp: Viewport, uorPt?: Point3d): void {
    // if the info balloon is already displayed, or if he doesn't want it, quit.
    if (viewManager.isInfoWindowUp() || !this.wantInfoBalloon())
      return;

    const accuSnapHit = this.currHit;
    const tpHit = tentativePoint.getCurrSnap();

    // if we don't have either an AccuSnap or a tentative point hit, quit.
    if (!accuSnapHit && !tpHit && !this.errorIcon.isActive())
      return;

    let timeout = this.getPopupDelay();
    let theHit: HitDetail | undefined;

    // determine which type of hit and how long to wait, and the detail level
    if (tpHit) {
      // when the tentative button is first pressed, we pass nullptr for uorPt so that we show the info window immediately
      if (uorPt) {
        const aperture = (this.getStickyFactor() * vp.pixelsFromInches(elementLocateManager.getApertureInches()) / 2.0) + 1.5;

        // see if he came back somewhere near the currently snapped element
        if (TestHitStatus.IsOn !== elementLocateManager.getElementPicker().testHit(tpHit, undefined, vp, uorPt, aperture, elementLocateManager.m_options))
          return;

        timeout = 3;
      } else {
        // if uorPt is nullptr, that means that we want to display the infoWindow immediately.
        timeout = 0;
      }

      theHit = tpHit;
    } else {
      if (!this.wantAutoInfoBalloon())
        return;

      theHit = accuSnapHit;
    }

    // have we waited long enough to show the balloon?
    if (this.noMotionCount < timeout) {
      return;
    }

    this.infoPt.setFrom(viewPt);

    // if we're currently showing an error, get the error message...otherwise display hit info...
    if (!this.errorIcon.isActive() && theHit) {
      this.showElemInfo(viewPt, vp, theHit);
      return;
    }

    // If we have an error explanation...use it as is!
    if (this.explanation) {
      this.showLocateMessage(viewPt, vp, this.explanation);
      return;
    }

    // if we don't have an explanation yet, translate the error code.
    if (LocateFailureValue.None === this.errorReason)
      return;

    this.explanation = elementLocateManager.getLocateError(this.errorReason);
    if (!this.explanation)
      return;

    // Get the "best" rejected hit to augment the error explanation with the hit info...
    if (!theHit)
      theHit = this.aSnapHits ? this.aSnapHits.hits[0] : undefined;

    if (!theHit) {
      this.showLocateMessage(viewPt, vp, this.explanation);
      return;
    }

    const msgStr = this.explanation + "\n" + theHit.m_hitDescription;
    this.showLocateMessage(viewPt, vp, msgStr);
  }

  public clearInfoBalloon(ev?: BeButtonEvent): void {
    this.noMotionCount = 0;

    if (!viewManager.isInfoWindowUp())
      return;

    if (ev && (5 > ev.viewPoint.distanceXY(this.infoPt)))
      return;

    viewManager.clearInfoWindow();
  }

  /** For a given snap path, display the sprites to indicate its position on the screen and what snap mode it represents. */
  private showSnapSprite(): void {
    const snap = this.getCurrSnapDetail();
    if (!snap)
      return;

    const crossPt = snap.m_snapPoint;
    const crossSprite = snap.isHot() ? s_focused : s_unfocused;
    const viewport = snap.m_viewport!;

    if (!snap.isHot() && !this.wantShowHint())
      return;

    this.cross.activate(crossSprite, viewport, crossPt, 0);

    // user can say to skip display of the icon
    if (!this.wantShowIcon())
      return;

    const snapSprite = snap.m_sprite;
    if (snapSprite)
      this.icon.activate(snapSprite, viewport, crossPt, 0);
  }

  private static adjustIconLocation(vp: Viewport, input: Point3d, iconSize: XAndY): Point3d {
    const out = vp.worldToView(input);
    out.x += (iconSize.x / 3.0);
    out.y -= (iconSize.y * 1.3);
    return vp.viewToWorld(out, out);
  }

  /** try to indicate what's wrong with the current point (why we're not snapping). */
  private showSnapError(status: SnapStatus, ev: BeButtonEvent) {
    this.errorIcon.deactivate();

    let errorSprite: Sprite | undefined;
    switch (status) {
      case SnapStatus.FilteredByUser:
      case SnapStatus.FilteredByApp:
        errorSprite = s_appFiltered;
        break;

      case SnapStatus.FilteredByAppQuietly:
        this.errorReason = LocateFailureValue.None;
        break;

      case SnapStatus.NotSnappable:
        errorSprite = s_notSnappable;
        this.errorReason = LocateFailureValue.NotSnappable;
        break;

      case SnapStatus.ModelNotSnappable:
        errorSprite = s_notSnappable;
        this.errorReason = LocateFailureValue.ModelNotAllowed;
        break;
    }

    if (!errorSprite)
      return;

    const vp = ev.viewport!;
    const spriteSize = errorSprite.getSize();
    const pt = AccuSnap.adjustIconLocation(vp, ev.rawPoint, spriteSize);

    if (this.wantShowIcon())
      this.errorIcon.activate(errorSprite, vp, pt, 0);
  }

  private clearSprites() {
    this.errorIcon.deactivate();
    this.cross.deactivate();
    this.icon.deactivate();
  }

  /** determine whether a hit should be hilited or not. */
  private hitShouldBeHilited(hit: HitDetail | undefined): boolean {
    if (!hit)
      return false;

    const snap = AccuSnap.toSnapDetail(hit);
    return !snap || snap.isHot() || this.wantHiliteColdHits();
  }

  private unFlashViews() {
    this.needFlash.clear();
    this.areFlashed.forEach((vp) => {
      // m_eventHandlers.CallAllHandlers(UnFlashCaller(vp.get()));
      vp.setFlashed(undefined, 0.0);
    });
    this.areFlashed.clear();
  }

  public adjustPointIfHot(pt: Point3d, view: Viewport): void {
    const currSnap = this.getCurrSnapDetail();

    if (!currSnap || !currSnap.isHot() || view !== currSnap.m_viewport)
      return;

    pt.setFrom(currSnap.getAdjustedPoint());
  }

  private onEnabledStateChange(isEnabled: boolean, wasEnabled: boolean) {
    if (isEnabled === wasEnabled) {
      toolAdmin.onAccuSnapSyncUI(); // still need to sync AccuSnap global setting even if we are not changing the actual state for the current tool.
      return;
    }

    if (isEnabled)
      toolAdmin.onAccuSnapEnabled();
    else
      toolAdmin.onAccuSnapDisabled();
  }

  public getHitAndList(holder: HitListHolder): HitDetail | undefined {
    const hit = this.currHit;
    if (hit) {
      holder.setHitList(this.aSnapHits);
      this.aSnapHits = undefined;
    }
    return hit;
  }

  private initCmdState() { this.toolState.m_suspended = 0; }

  public suspend(doSuspend: boolean) {
    const previousDoSnapping = this.doSnapping();
    if (doSuspend)
      this.toolState.m_suspended++;
    else if (this.toolState.m_suspended > 0)
      this.toolState.m_suspended--;

    this.onEnabledStateChange(this.doSnapping(), previousDoSnapping);
  }

  public suppress(doSuppress: boolean): number {
    const previousDoSnapping = this.doSnapping();
    if (doSuppress)
      this.suppressed++;
    else if (this.suppressed > 0)
      this.suppressed--;

    this.onEnabledStateChange(this.doSnapping(), previousDoSnapping);
    return this.suppressed;
  }

  private enableSnap(yesNo: boolean) {
    const previousDoSnapping = this.doSnapping();
    this.toolState.m_enabled = yesNo;
    if (!yesNo) this.clear();
    this.onEnabledStateChange(this.doSnapping(), previousDoSnapping);
  }

  private getNextAccuSnappable(hitList: HitList): HitDetail | undefined {
    const thisPath = hitList.getNextHit();
    if (thisPath)
      this.explanation = "";
    return thisPath;
  }

  private hitToSnap(_hit: HitDetail, _out: LocateResponse): SnapDetail | undefined {
    // NEEDS_WORK
    // return m_snapContext.SnapToPath(out, hit, GetSnapMode(), elementLocateManager.getKeypointDivisor(), hit -> GetViewport().PixelsFromInches(GetHotDistanceInches()));
    return undefined;
  }

  private getAccuSnapDetail(hitList: HitList, out: LocateResponse): SnapDetail | undefined {
    let bestDist = 1e200;
    let bestSnap: SnapDetail | undefined;
    let bestHit: HitDetail | undefined;
    const ignore = new LocateResponse();
    for (let thisHit; undefined !== (thisHit = this.getNextAccuSnappable(hitList)); out = ignore) {
      // if there are multiple hits at the same dist, then find the best snap from all of them. Otherwise, the snap
      // from the first one is the one we want.
      if (bestHit && 0 !== hitList.compare(thisHit, bestHit, true, true))
        break;

      const thisSnap = this.hitToSnap(thisHit, out);
      if (!thisSnap)
        continue;

      // Pass the snap path instead of the hit path in case a filter modifies the path contents.
      let filtered = false;
      if (this.doLocateTesting())
        filtered = elementLocateManager.filterHit(thisSnap, this.toolState.m_subSelectionMode, LocateAction.AutoLocate, out);

      const thisDist = thisSnap.m_geomDetail.m_viewDist;
      if (!filtered && !(bestSnap && (thisDist >= bestDist))) {
        bestHit = thisHit;
        bestSnap = thisSnap;
        bestDist = thisDist;
      } else if (filtered)
        out.snapStatus = SnapStatus.FilteredByApp;
    }

    if (bestHit) {
      hitList.setCurrentHit(bestHit);
      return bestSnap;
    }

    return undefined;
  }

  /** remove any  hits in the m_aSnapHits list that the user said he wants to ignore. */
  private removeIgnoredHits(): void {
    const aSnapHits = this.aSnapHits;
    // NOTE: AccuSnap pref only applies to snapping...interior locates controlled by locate pref.
    if (!aSnapHits || this.doLocateTesting())
      return;

    for (let i = aSnapHits.size() - 1; i >= 0; --i) { // work backwards through list
      const thisHit = aSnapHits.getHit(i);
      if (!thisHit)
        continue;

      if (this.wantIgnoreFill() && (HitPriority.Interior === thisHit.m_geomDetail.m_hitPriority))
        aSnapHits.removeHit(i);
    }
  }

  private findHits(ev: BeButtonEvent, force: boolean = false): SnapStatus {
    // When using AccuSnap to locate elements, we have to start with the datapoint adjusted
    // for locks and not the raw point. Otherwise, when grid/unit lock are on, we locate elements by
    // points not on the grid. This causes them to be "pulled" off the grid when they are accepted. On
    // the other hand, when NOT locating, we need to use the raw point so we can snap to elements
    // away from the grid.

    const testPoint = this.isLocateEnabled() ? ev.point : ev.rawPoint;
    const vp = ev.viewport!;
    const picker = elementLocateManager.getElementPicker();
    const options = elementLocateManager.getLocateOptions().clone(); // Copy to avoid changing out from under active Tool...

    // NOTE: Since TestHit will use the same HitSource as the input hit we only need to sets this for DoPick...
    options.hitSource = this.isSnapEnabled() ? HitSource.AccuSnap : HitSource.MotionLocate;

    let keepCurrentHit = false;
    const canBeSticky = !force && this.currHit && (this.currHit.getHitType() !== HitDetailType.Intersection) && !this.currHit.m_geomDetail.isValidSurfaceHit();
    let aperture = (vp.pixelsFromInches(elementLocateManager.getApertureInches()) / 2.0) + 1.5;

    // see if we should keep the current hit
    if (canBeSticky) {
      const status = picker.testHit(this.currHit!, this.retestList, vp, testPoint, this.getStickyFactor() * aperture, options);

      if (status === TestHitStatus.Aborted) {
        this.wasAborted = true;
        return SnapStatus.Aborted;
      }

      if (status === TestHitStatus.IsOn)
        keepCurrentHit = true;
    }

    this.initializeForCheckMotion();

    aperture *= this.getSearchDistance();

    if (0 === picker.doPick(vp, testPoint, aperture, options)) {
      this.wasAborted = picker.lastPickAborted;
      if (!this.wasAborted)
        this.aSnapHits = undefined; // Clear any previous hit list so reset won't cycle through hits cursor is no longer over, etc.

      return this.wasAborted ? SnapStatus.Aborted : SnapStatus.NoElements;
    }

    this.aSnapHits = picker.getHitList(true); // take ownership of the pickElem hit list.

    // if "stickiness" causes us to keep the current hit, remove any other hits in the current HitList that pertain to
    // that element, and then insert the retested hit at the front of the list. This is so if/when the user presses reset,
    // they'll get the next most reasonable hit.
    if (keepCurrentHit) {
      const theHit = this.retestList.getHit(0);
      if (theHit) {
        this.aSnapHits.removeHitsFrom(theHit.m_elementId);
        this.aSnapHits.insert(0, theHit);
      }
      this.retestList.empty();
    }

    this.removeIgnoredHits(); // remove any hits the user said he isn't interested in seeing (e.g. interior of filled shapes)
    return SnapStatus.Success;
  }

  /**
   * If AccuSnap is active, search under cursor for new hits and generate the best AccuSnap point from that list, if any.
   * @return the best hit.
   */
  private getNewSnapDetail(out: LocateResponse, ev: BeButtonEvent): SnapDetail | undefined {
    out.snapStatus = this.findHits(ev);
    return (SnapStatus.Success !== out.snapStatus) ? undefined : this.getAccuSnapDetail(this.aSnapHits!, out);
  }

  private findLocatablePath(ev: BeButtonEvent, newSearch: boolean, out: LocateResponse): SnapDetail | undefined {
    out.snapStatus = SnapStatus.NoElements;

    if (newSearch) {
      this.aSnapHits = undefined;
      // search for new hits, but if the cursor is still close to the current hit, don't throw away list.
      if (SnapStatus.Success !== (out.snapStatus = this.findHits(ev)))
        return undefined;
    } else {
      if (!this.aSnapHits) {
        out.snapStatus = SnapStatus.NoElements;
        return undefined;
      }
    }

    const thisList = this.aSnapHits!;
    let thisHit: SnapDetail | undefined;
    const ignore = new LocateResponse();
    // keep looking through hits until we find one that is accu-snappable.
    while (!!(thisHit = thisList.getNextHit() as SnapDetail)) {
      if (!elementLocateManager.filterHit(thisHit, this.toolState.m_subSelectionMode, LocateAction.AutoLocate, out))
        return thisHit;

      // we only care about the status of the first hit.
      out = ignore;
    }

    // Reset current hit index to go back to first hit on next AccuSnap reset event...
    thisList.resetCurrentHit();
    return undefined;
  }

  /** when in auto-locate mode, advance to the next hit without searching again. */
  public resetButton(): SnapStatus {
    let snap: SnapDetail | undefined;
    const out = new LocateResponse();
    out.snapStatus = SnapStatus.Disabled;

    this.clearInfoBalloon(undefined);

    const ev = new BeButtonEvent();
    toolAdmin.fillEventFromCursorLocation(ev);

    if (this.doSnapping()) {
      // if we don't have any more candidate hits, get a new list at the current location
      if (!this.aSnapHits || (0 === this.aSnapHits.size())) {
        snap = this.getNewSnapDetail(out, ev);
      } else {
        // drop the current hit from the list and then retest the list (without the dropped hit) to find the new "best" snap
        this.aSnapHits.removeCurrentHit();
        snap = this.getAccuSnapDetail(this.aSnapHits, out);
      }
    } else if (this.doLocateTesting()) {
      // get next AccuSnap path (or nullptr)
      snap = this.findLocatablePath(ev, false, out);
    }

    // set the current hit
    if (snap || this.currHit)
      this.setCurrHit(snap);

    // indicate errors
    this.showSnapError(out.snapStatus, ev);
    return out.snapStatus;
  }

  private doIntersectSnap(_ev: BeButtonEvent, _usingMultipleSnaps: boolean, _out: LocateResponse): SnapDetail | undefined {
    // const hitList = thevis.aSnapHits;
    // const testHits: HitDetail[] = [];
    // const testPoint = this.isLocateEnabled() ? ev.point : ev.rawPoint;
    // let count = 0;

    // // if there's a tentative point, use it
    // const tpHit = tentativePoint.getCurrSnap();
    // if (tpHit) {
    //   testHits[count++] = tpHit;

    //   // if the tentative snap is already an intersection, use both elements
    //   if (HitDetailType.Intersection === tpHit.getHitType() && (HitSource.TentativeSnap === tpHit.m_locateSource))
    //     testHits[count++] = ((IntersectDetail *) tpHit) -> GetSecondHit();
    // }

    // if (count < 2) {
    //   // multiple snaps: must repeat the locate logic each time, in case previous locate was done
    //   //                  by a non-intersection snap at a location far from here
    //   if (SnapStatus:: Success != FindHits(& hitList, ev, usingMultipleSnaps))
    //   return SnapStatus:: NoElements;

    //   hitList -> ResetCurrentHit();
    //   testHits[count++] = GetNextIntersectable(& status, hitList);
    // }

    // if (nullptr == testHits[0])
    //   return SnapStatus:: NoElements;

    // if (nullptr == testHits[1])
    //   testHits[1] = GetNextIntersectable(& status, hitList);

    // // test all possible intersections, finding the "best" one
    // HitList intsctList;
    // for (; testHits[1]; testHits[1] = GetNextIntersectable(& status, hitList)) {
    //   SnapDetailP thisIntsct = nullptr;
    //   if (SnapStatus:: Success == m_snapContext.IntersectDetails(& thisIntsct, testHits[0], testHits[1], testPoint, TentativePoint:: GetInstance().IsSnapped()))
    //   {
    //     intsctList.AddHit(thisIntsct, false, false);
    //     thisIntsct -> Release(); // ref count was incremented when we added to list
    //   }
    // }

    // * intsctPath = (SnapDetailP) intsctList.GetHit(0);
    // if (nullptr != * intsctPath) {
    //   (* intsctPath) -> AddRef();
    //   return SnapStatus:: Success;
    // }

    // return SnapStatus:: NoSnapPossible;
    return undefined;
  }

  /* Choose one snap from the set of all active snaps. If the snapOverride is a simple
    snap like keypoint, then the set will contain a single snap and this choosing
    process just returns it. If the snapOverride is a multi-snap, then the set contains
    all of the point snaps that it represents. If the snapOverride is a constraint snap,
    then the set contains all of the point snaps that underlie it.

    Just consider the snaps in the set in the order given by the user and pick the
    first hot one. If none are hot, pick the one that's closest to the cursor.

    Exception: If snap point is not on the curve, then we ignore its hot-ness.

    Depending on element type, the center (centroid) and origin snap locations may not lie
    on on the target element. For lineString, shape, bspline, etc. center snap may not even be
    on a keypoint. To make them choose-able, AccuSnap makes them hot all of the time. As a result,
    if these snaps are first in the list, they may take precedence over all others. To combat
    this problem, we apply this exception.

    Note: Sometimes keypoint and intersection snaps can be crowded close together.
    There's nothing we can do about this here. The user may be able to choose one over the
    other by sneaking up from right or left. Otherwise, the first one in the list is chosen.
*/
  private getPreferredPointSnap(ev: BeButtonEvent, out: LocateResponse): SnapDetail | undefined {
    elementLocateManager.setChosenSnapMode(SnapType.Points, SnapMode.Invalid);
    elementLocateManager.setChosenSnapMode(SnapType.Constraints, SnapMode.Invalid);

    // Get the list of point snap modes to consider
    let snapModes: SnapMode[];

    //  Special case: If tentative point is active, then we can only do intersections.
    if (tentativePoint.isActive) {
      snapModes = [];
      snapModes.push(SnapMode.Intersection);
    } else {
      snapModes = elementLocateManager.getPreferredPointSnapModes(HitSource.AccuSnap);
    }

    // Consider each point snap mode and find the preferred one.
    let preferred: SnapDetail | undefined;
    let preferredDistance = 1.0e200;

    // out.snapStat = SnapStatus.NoElements;
    for (const snapMode of snapModes) {
      // Try to generate a snap for this snap mode and compare it with the others.
      this.candidateSnapMode = snapMode;

      const snap = (this.candidateSnapMode !== SnapMode.Intersection) ? this.getNewSnapDetail(out, ev) : this.doIntersectSnap(ev, snapModes.length > 1, out);
      if (SnapStatus.Aborted === out.snapStatus)
        return undefined;

      if ((SnapStatus.Success === out.snapStatus) && snap) {
        if (snap.isHot() && ((SnapMode.Center) === this.candidateSnapMode || snap.isPointOnCurve())) {
          preferred = snap;
          break;
        } else if (snap.m_geomDetail.m_viewDist < preferredDistance) {
          // Snap is not hot, but it's the closest we've seen so far => prefer it and keep searching for a closer one or a hot one.
          preferred = snap;
          preferredDistance = snap.m_geomDetail.m_viewDist;
        }
      }
    }

    if (!preferred) //  No snap could be generated?
      return undefined;

    // Report which of the multiple active modes we used
    elementLocateManager.setChosenSnapMode(SnapType.Points, preferred.m_snapMode);
    return preferred;
  }

  /** find the best snap point according to the current cursor location */
  public onMotion(ev: BeButtonEvent): void {
    const out = new LocateResponse();
    out.snapStatus = SnapStatus.Disabled;
    const wasHot = this.isHot();

    this.wasAborted = false;
    this.clearInfoBalloon(ev);

    let snap: SnapDetail | undefined;
    if (this.isActive()) {
      if (this.doSnapping()) {
        snap = this.getPreferredPointSnap(ev, out);

        if (snap)
          out.snapStatus = elementLocateManager.performConstraintSnap(snap, ev.viewport!.pixelsFromInches(this.getHotDistanceInches()), HitSource.AccuSnap);
      } else if (this.doLocateTesting()) {
        snap = this.findLocatablePath(ev, true, out);
      }
    }

    // Don't change current hit based on incomplete hit list...
    if (this.wasAborted)
      return;

    // set the current hit and display the sprite (based on snap's KeypointType)
    if (snap || this.currHit) {
      this.setCurrHit(snap);
    }

    // indicate errors
    this.showSnapError(out.snapStatus, ev);
    elementLocateManager.onAccuSnapMotion(snap, wasHot, ev);
  }

  public onMotionStopped(_ev: BeButtonEvent): void { }
  public onNoMotion(ev: BeButtonEvent): void {
    if (this.wasAborted)
      this.onMotion(ev);

    this.noMotionCount++;

    // if (1 === this.m_noMotionCount)
    //   this.flashInOtherViews();

    this.displayInfoBalloon(ev.viewPoint, ev.viewport!, ev.rawPoint);
  }

  private flashElements(context: DecorateContext): void {
    const viewport = context.viewport;
    if (this.currHit) {
      if (this.needsFlash(viewport))
        this.flashHitInView(this.currHit, context);
      return;
    }

    const hit = tentativePoint.getCurrSnap();
    if (hit)
      hit.draw(context);
  }

  public decorateViewport(context: DecorateContext): void {
    this.flashElements(context);

    if (this.cross.isActive()) {
      this.cross.decorateViewport(context);

      // we have to adjust the world pt for the icon every time we draw it because the view may have changed size since we snapped
      const iconSize = this.icon.sprite!.getSize();
      const viewport = context.viewport;
      this.icon.location.setFrom(AccuSnap.adjustIconLocation(viewport, this.cross.location, iconSize));
      this.icon.decorateViewport(context);
    }

    this.errorIcon.decorateViewport(context);
  }

  private clearElemFromHitList(element: Id64) {
    if (this.aSnapHits && element.isValid())
      this.aSnapHits.removeHitsFrom(element);
  }

  public clearIfElement(element: Id64): void {
    this.clearElemFromHitList(element);

    const hit = this.currHit;
    if (hit && Id64.areEqual(hit.m_elementId, element)) {
      this.destroy();
    }
  }

  private enableLocate(yesNo: boolean) {
    this.toolState.m_locate = yesNo;
    this.toolState.m_subSelectionMode = SubSelectionMode.None;
  }

  public onStartTool(): void {
    this.initCmdState();
    this.enableSnap(false);
    this.enableLocate(false);
    tentativePoint.clear(true);
  }

  /**
   * AccuSnap to reevaluate the snap at the current cursor location.
   * This is useful of an application changes the snap mode and wants AccuSnap to choose it immediately, without
   * requiring the user to move the mouse.
   */
  public reEvaluate() {
    if (this.getCurrSnapDetail()) {
      const ev = new BeButtonEvent();
      toolAdmin.fillEventFromCursorLocation(ev);
      this.onMotion(ev);
    }
  }
}

export class TentativeOrAccuSnap {
  public static isHot(): boolean { return accuSnap.isHot() || tentativePoint.isSnapped(); }

  public static getCurrentSnap(checkIsHot: boolean = true): SnapDetail | undefined {
    // Checking for a hot AccuSnap hit before checking tentative is probably necessary for extended intersections?
    if (accuSnap.isHot())
      return accuSnap.getCurrSnapDetail();

    if (tentativePoint.isSnapped())
      return tentativePoint.currSnap;

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
    return snap ? snap.m_viewport : tentativePoint.viewport;
  }
}

const toolAdmin = ToolAdmin.instance;
const accuSnap = AccuSnap.instance;
const tentativePoint = TentativePoint.instance;
const viewManager = ViewManager.instance;
const elementLocateManager = ElementLocateManager.instance;
