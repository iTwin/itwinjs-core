/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module LocatingElements */

import { Point3d, Point2d, XAndY, Transform, Vector3d } from "@bentley/geometry-core";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { Viewport } from "./Viewport";
import { BeButtonEvent } from "./tools/Tool";
import { SnapStatus, LocateAction, LocateResponse, HitListHolder, ElementLocateManager } from "./ElementLocateManager";
import { SpriteLocation, Sprite, IconSprites } from "./Sprites";
import { DecorateContext } from "./ViewContext";
import { HitDetail, HitList, SnapMode, SnapDetail, HitSource, HitDetailType, SnapHeat, HitPriority } from "./HitDetail";
import { IModelApp } from "./IModelApp";

/** @hidden */
export class AccuSnapToolState {
  public enabled = false;
  public locate = false;
  public suspended = 0;
  public setFrom(other: AccuSnapToolState): void {
    this.enabled = other.enabled;
    this.locate = other.locate;
    this.suspended = other.suspended;
  }
  public clone(): AccuSnapToolState { const val = new AccuSnapToolState(); val.setFrom(this); return val; }
}

class AccuSnapSettings {
  public hotDistanceFactor = 1.2;
  public stickyFactor = 1.0;
  public searchDistance = 2.0;
  public showIcon = true;
  public showHint = true;
  public coordUpdate = false;
  public hiliteColdHits = true;
  public popupInfo = true;
  public popupMode = false;
  public enableFlag = true;
  public popupDelay = 5; // delay before info balloon pops up - in 10th of a second
}

/** AccuSnap is an aide for snapping to interesting points on elements as the cursor moves over them. */
export class AccuSnap {
  /** Currently active hit */
  public currHit?: HitDetail;
  /** Current list of hits. */
  public aSnapHits?: HitList<HitDetail>;
  /** Views that need to be flashed */
  public readonly needFlash = new Set<Viewport>();
  /** Views that are already flashed */
  public readonly areFlashed = new Set<Viewport>();
  /** The "+" that indicates where the snap point is */
  public readonly cross = new SpriteLocation();
  /** The icon that indicates what type of snap is active */
  public readonly icon = new SpriteLocation();
  /** The icon that indicates an error */
  public readonly errorIcon = new SpriteLocation();
  /** Reason key for last error */
  public errorKey?: string;
  /** localized message explaining why last error was generated. */
  public explanation?: string;
  /** During snap creation: the snap to try */
  private candidateSnapMode = SnapMode.Nearest;
  /** Number of times "suppress" has been called -- unlike suspend this is not automatically cleared by tools */
  private suppressed = 0;
  /** Number of times "noMotion" has been called since last motion */
  private noMotionCount = 0;
  /** Anchor point for infoWindow. window is cleared when cursor moves away from this point. */
  private readonly infoPt = new Point3d();
  /** Location of cursor when we last checked for motion */
  private readonly lastCursorPos = new Point2d();
  /** Accumulated distance (squared) the mouse has moved since we started checking for motion */
  private totalMotionSq = 0;
  /** How much mouse movement constitutes a "move" (squared) */
  private motionToleranceSq = 0;
  public readonly toolState = new AccuSnapToolState();
  private readonly defaultSettings = new AccuSnapSettings();
  private settings = this.defaultSettings;

  public onInitialized() { }
  private wantShowIcon() { return this.settings.showIcon; }
  private wantShowHint() { return this.settings.showHint; }
  private wantInfoBalloon() { return this.settings.popupInfo; }
  private wantAutoInfoBalloon() { return this.settings.popupInfo && !this.settings.popupMode; }
  private wantHiliteColdHits() { return this.settings.hiliteColdHits; }
  private getStickyFactor() { return this.settings.stickyFactor; }
  private doLocateTesting() { return this.isLocateEnabled(); }
  private getSearchDistance() { return this.doLocateTesting() ? 1.0 : this.settings.searchDistance; }
  private getHotDistanceInches() { return IModelApp.locateManager.getApertureInches() * this.settings.hotDistanceFactor; }
  public isLocateEnabled() { return this.toolState.locate; }
  private isFlashed(view: Viewport): boolean { return (this.areFlashed.has(view)); }
  private needsFlash(view: Viewport): boolean { return (this.needFlash.has(view)); }
  private setNeedsFlash(view: Viewport) { this.needFlash.add(view); this.clearIsFlashed(view); view.invalidateDecorations(); }
  private setIsFlashed(view: Viewport) { this.areFlashed.add(view); }
  private clearIsFlashed(view: Viewport) { this.areFlashed.delete(view); }
  public isSnapEnabled(): boolean { return this.toolState.enabled; }
  private getUserEnabled(): boolean { return this.settings.enableFlag; }
  public userWantsSnaps(): boolean { return this.getUserEnabled(); }
  private static toSnapDetail(hit?: HitDetail): SnapDetail | undefined { return (hit && hit.isSnapDetail()) ? hit : undefined; }
  public getCurrSnapDetail(): SnapDetail | undefined { return AccuSnap.toSnapDetail(this.currHit); }
  public isHot(): boolean { const currSnap = this.getCurrSnapDetail(); return !currSnap ? false : currSnap.isHot(); }

  public destroy(): void {
    this.currHit = undefined;
    this.aSnapHits = undefined;
  }
  private doSnapping(): boolean { return this.isSnapEnabled() && this.userWantsSnaps() && !this.isSnapSuspended(); }
  private isSnapSuspended(): boolean { return (0 !== this.suppressed || 0 !== this.toolState.suspended); }

  /**
   * Get the SnapMode that was used to generate the SnapDetail. Since getActiveSnapModes can return multiple SnapMode values, candidateSnapMode holds
   * the SnapMode that was chosen.
   */
  public getSnapMode(): SnapMode { return this.candidateSnapMode; }

  /** Get the current snap divisor to use to use for SnapMode.NearestKeypoint.
   * A subclass of IModelApp can implement onStartup to return a subclass of AccuSnap that implements this method to provide a snap divisor ui component.
   */
  public getKeypointDivisor() { return 2; }

  /** Get the current active SnapModes. SnapMode position determines priority, with the first entry being the highest. The SnapDetail will be returned for the first SnapMode that produces a hot snap.
   * A subclass of IModelApp can implement onStartup to return a subclass of AccuSnap that implements this method to provide a SnapMode ui component.
   */
  public getActiveSnapModes(): SnapMode[] {
    const snaps: SnapMode[] = [];
    snaps.push(SnapMode.NearestKeypoint);
    return snaps;
  }

  /** Can be used by a subclass of AccuSnap to implement a SnapMode override that applies only to the next point.
   * This method will be called whenever a new tool is installed and on a button event.
   */
  public synchSnapMode(): void { }

  /**
   * Check to see whether its appropriate to generate an AccuSnap point, given the current user
   * and command settings, and whether a tentative point is currently active.
   */
  public isActive(): boolean {
    // Unless we're snapping in intersect mode (to find extended intersections), skip if tentative point active...
    if (IModelApp.tentativePoint.isActive) {
      if (!this.doSnapping())
        return false;
      const snaps = this.getActiveSnapModes();
      for (const snap of snaps) { if (snap === SnapMode.Intersection) return true; }
      return false;
    }

    return this.doSnapping() || this.doLocateTesting();
  }

  private initializeForCheckMotion(): void {
    this.lastCursorPos.setFrom(IModelApp.toolAdmin.currentInputState.lastMotion);
    this.totalMotionSq = 0;
    this.motionToleranceSq = IModelApp.toolAdmin.isCurrentInputSourceMouse() ? 1 : 20;
  }

  public checkStopLocate(): boolean {
    const curPos = IModelApp.toolAdmin.currentInputState.lastMotion; //  Get the current cursor pos and compute the distance moved since last check.
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

  /** Clear any AccuSnap info on the screen and release any hit path references */
  public clear(): void { this.setCurrHit(undefined); }
  public setCurrHit(newHit?: HitDetail): void {
    const newSnap = AccuSnap.toSnapDetail(newHit);
    const currSnap = this.getCurrSnapDetail();
    const sameElem = (newHit && newHit.isSameHit(this.currHit));
    const sameHit = (sameElem && !newSnap);
    const sameSnap = (sameElem && newSnap && currSnap);
    const samePt = (sameHit || (sameSnap && newSnap!.snapPoint.isAlmostEqual(currSnap!.snapPoint)));
    const sameHot = (sameHit || (sameSnap && (this.isHot() === newSnap!.isHot())));
    const sameBaseSnapMode = (!newSnap || !currSnap || newSnap.snapMode === currSnap.snapMode);
    const sameType = (sameHot && (!currSnap || (currSnap.getHitType() === newHit!.getHitType())));

    // see if it is the same point on the same element, the hot flags are the same multiple snaps, and the snap modes are the same
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

    // if we didn't get a new hit, we're done
    if (undefined === (this.currHit = newHit))
      return;

    // draw sprites for this hit
    this.showSnapSprite();
  }

  /**  flash a hit in a single view. */
  private flashHitInView(hit: HitDetail, context: DecorateContext) {
    const viewport = context.viewport;
    if (!viewport || !this.hitShouldBeHilited(hit) || !this.needsFlash(viewport))
      return;

    hit.draw(context);
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
    this.setNeedsFlashView(hit.viewport!);
  }

  public erase(): void {
    this.clearInfoBalloon(undefined); // make sure there's no info balloon up.
    this.clearSprites(); // remove all sprites from the screen
  }

  public showElemInfo(viewPt: Point3d, vp: Viewport, hit: HitDetail): void {
    if (IModelApp.viewManager.doesHostHaveFocus())
      this.showLocateMessage(viewPt, vp, IModelApp.toolAdmin.getInfoString(hit, "\n"));
  }

  private showLocateMessage(viewPt: Point3d, vp: Viewport, msg: string) {
    if (IModelApp.viewManager.doesHostHaveFocus())
      IModelApp.viewManager.showInfoWindow(viewPt, vp, msg);
  }

  public displayInfoBalloon(viewPt: Point3d, vp: Viewport, uorPt?: Point3d): void {
    // if the info balloon is already displayed, or if he doesn't want it, quit.
    if (IModelApp.viewManager.isInfoWindowUp() || !this.wantInfoBalloon())
      return;

    const accuSnapHit = this.currHit;
    const tpHit = IModelApp.tentativePoint.getCurrSnap();

    // if we don't have either an AccuSnap or a tentative point hit, quit.
    if (!accuSnapHit && !tpHit && !this.errorIcon.isActive)
      return;

    let timeout = this.settings.popupDelay;
    let theHit: HitDetail | undefined;

    // determine which type of hit and how long to wait, and the detail level
    if (tpHit) {
      // when the tentative button is first pressed, we pass nullptr for uorPt so that we show the info window immediately
      if (uorPt) {
        const aperture = (this.getStickyFactor() * vp.pixelsFromInches(IModelApp.locateManager.getApertureInches()) / 2.0) + 1.5;

        // see if he came back somewhere near the currently snapped element
        if (!IModelApp.locateManager.getElementPicker().testHit(tpHit, vp, uorPt, aperture, IModelApp.locateManager.options))
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
    if (!this.errorIcon.isActive && theHit) {
      this.showElemInfo(viewPt, vp, theHit);
      return;
    }

    // If we have an error explanation...use it as is!
    if (this.explanation) {
      this.showLocateMessage(viewPt, vp, this.explanation);
      return;
    }

    // if we don't have an explanation yet, translate the error code.
    if (!this.errorKey)
      return;

    this.explanation = IModelApp.i18n.translate(this.errorKey);
    if (!this.explanation)
      return;

    // Get the "best" rejected hit to augment the error explanation with the hit info...
    if (!theHit)
      theHit = this.aSnapHits ? this.aSnapHits.hits[0] : undefined;

    this.showLocateMessage(viewPt, vp, this.explanation);
  }

  public clearInfoBalloon(ev?: BeButtonEvent): void {
    this.noMotionCount = 0;

    if (!IModelApp.viewManager.isInfoWindowUp())
      return;

    if (ev && (5 > ev.viewPoint.distanceXY(this.infoPt)))
      return;

    IModelApp.viewManager.clearInfoWindow();
  }

  /** For a given snap path, display the sprites to indicate its position on the screen and what snap mode it represents. */
  private showSnapSprite(): void {
    const snap = this.getCurrSnapDetail();
    if (!snap)
      return;

    const crossPt = snap.snapPoint;
    const viewport = snap.viewport!;
    const crossSprite = IconSprites.getSprite(snap.isHot() ? "SnapCross" : "SnapUnfocused", viewport);

    if (!snap.isHot() && !this.wantShowHint())
      return;

    this.cross.activate(crossSprite, viewport, crossPt, 0);

    // user can say to skip display of the icon
    if (!this.wantShowIcon())
      return;

    const snapSprite = snap.sprite;
    if (snapSprite)
      this.icon.activate(snapSprite, viewport, AccuSnap.adjustIconLocation(viewport, crossPt, snapSprite.size), 0);
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

    const vp = ev.viewport!;
    let errorSprite: Sprite | undefined;
    switch (status) {
      case SnapStatus.FilteredByUser:
      case SnapStatus.FilteredByApp:
        errorSprite = IconSprites.getSprite("SnapAppFiltered", vp);
        break;

      case SnapStatus.FilteredByAppQuietly:
        this.errorKey = undefined;
        break;

      case SnapStatus.NotSnappable:
        errorSprite = IconSprites.getSprite("SnapNotSnappable", vp);
        this.errorKey = ElementLocateManager.getFailureMessageKey("NotSnappable");
        break;

      case SnapStatus.ModelNotSnappable:
        errorSprite = IconSprites.getSprite("SnapNotSnappable", vp);
        this.errorKey = ElementLocateManager.getFailureMessageKey("ModelNotAllowed");
        break;
    }

    if (!errorSprite)
      return;

    const spriteSize = errorSprite.size;
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
      // eventHandlers.CallAllHandlers(UnFlashCaller(vp.get()));
      vp.setFlashed(undefined, 0.0);
    });
    this.areFlashed.clear();
  }

  public adjustPointIfHot(pt: Point3d, view: Viewport): void {
    const currSnap = this.getCurrSnapDetail();

    if (!currSnap || !currSnap.isHot() || view !== currSnap.viewport)
      return;

    pt.setFrom(currSnap.adjustedPoint);
  }

  private onEnabledStateChange(isEnabled: boolean, wasEnabled: boolean) {
    if (isEnabled === wasEnabled) {
      IModelApp.toolAdmin.onAccuSnapSyncUI(); // still need to sync AccuSnap global setting even if we are not changing the actual state for the current tool.
      return;
    }

    if (isEnabled)
      IModelApp.toolAdmin.onAccuSnapEnabled();
    else
      IModelApp.toolAdmin.onAccuSnapDisabled();
  }

  public getHitAndList(holder: HitListHolder): HitDetail | undefined {
    const hit = this.currHit;
    if (hit) {
      holder.setHitList(this.aSnapHits);
      this.aSnapHits = undefined;
    }
    return hit;
  }

  private initCmdState() { this.toolState.suspended = 0; }

  public suspend(doSuspend: boolean) {
    const previousDoSnapping = this.doSnapping();
    if (doSuspend)
      this.toolState.suspended++;
    else if (this.toolState.suspended > 0)
      this.toolState.suspended--;

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

  public enableSnap(yesNo: boolean) {
    const previousDoSnapping = this.doSnapping();
    this.toolState.enabled = yesNo;
    if (!yesNo) this.clear();
    this.onEnabledStateChange(this.doSnapping(), previousDoSnapping);
  }

  private getNextAccuSnappable(hitList: HitList<HitDetail>): HitDetail | undefined {
    const thisHit = hitList.getNextHit();
    if (thisHit)
      this.explanation = "";
    return thisHit;
  }

  public async requestSnap(thisHit: HitDetail, snapMode: SnapMode, hotDistanceInches: number, out?: LocateResponse): Promise<SnapDetail | undefined> {
    const result = await thisHit.viewport.iModel.requestSnap(
      {
        id: thisHit.sourceId,
        closePoint: thisHit.hitPoint,
        worldToView: thisHit.viewport.worldToViewMap.transform0.toJSON(),
        viewFlags: thisHit.viewport.viewFlags,
        snapMode,
        snapAperture: thisHit.viewport.pixelsFromInches(hotDistanceInches),
        snapDivisor: this.getKeypointDivisor(),
      }); // ### TODO offSubCategories...

    if (out) out.snapStatus = result.status;
    if (result.status !== SnapStatus.Success)
      return undefined;

    const snap = new SnapDetail(thisHit, snapMode, result.heat!, result.snapPoint!);
    snap.setCurvePrimitive(undefined !== result.curve ? GeomJson.Reader.parse(result.curve) : undefined, undefined !== result.localToWorld ? Transform.fromJSON(result.localToWorld) : undefined, result.geomType);
    if (undefined !== result.normal)
      snap.normal = Vector3d.fromJSON(result.normal);

    IModelApp.accuDraw.onSnap(snap); // AccuDraw can adjust nearest snap to intersection of circle (polar distance lock) or line (axis lock) with snapped to curve...
    return snap;
  }

  private async getAccuSnapDetail(hitList: HitList<HitDetail>, out: LocateResponse): Promise<SnapDetail | undefined> {
    let bestDist = 1e200;
    let bestSnap: SnapDetail | undefined;
    let bestHit: HitDetail | undefined;
    const ignore = new LocateResponse();
    for (let thisHit; undefined !== (thisHit = this.getNextAccuSnappable(hitList)); out = ignore) {
      // if there are multiple hits at the same dist, then find the best snap from all of them. Otherwise, the snap
      // from the first one is the one we want.
      if (bestHit && 0 !== hitList.compare(thisHit, bestHit))
        break;

      const thisSnap = await this.requestSnap(thisHit, this.getSnapMode(), this.getHotDistanceInches(), out);
      if (undefined === thisSnap)
        continue;

      // Pass the snap path instead of the hit path in case a filter modifies the path contents.
      let filtered = false;
      if (this.doLocateTesting())
        filtered = IModelApp.locateManager.filterHit(thisSnap, LocateAction.AutoLocate, out);

      const thisDist = thisSnap.hitPoint.distance(thisSnap.snapPoint);
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

  private findHits(ev: BeButtonEvent, force: boolean = false): SnapStatus {
    // When using AccuSnap to locate elements, we have to start with the datapoint adjusted
    // for locks and not the raw point. Otherwise, when grid/unit lock are on, we locate elements by
    // points not on the grid. This causes them to be "pulled" off the grid when they are accepted. On
    // the other hand, when NOT locating, we need to use the raw point so we can snap to elements
    // away from the grid.

    const testPoint = this.isLocateEnabled() ? ev.point : ev.rawPoint;
    const vp = ev.viewport!;
    const picker = IModelApp.locateManager.getElementPicker();
    const options = IModelApp.locateManager.options.clone(); // Copy to avoid changing out from under active Tool...

    // NOTE: Since TestHit will use the same HitSource as the input hit we only need to sets this for DoPick...
    options.hitSource = this.isSnapEnabled() ? HitSource.AccuSnap : HitSource.MotionLocate;

    let aperture = (vp.pixelsFromInches(IModelApp.locateManager.getApertureInches()) / 2.0) + 1.5;
    this.initializeForCheckMotion();
    aperture *= this.getSearchDistance();

    if (0 === picker.doPick(vp, testPoint, aperture, options)) {
      this.aSnapHits = undefined; // Clear any previous hit list so reset won't cycle through hits cursor is no longer over, etc.
      return SnapStatus.NoElements;
    }

    this.aSnapHits = picker.getHitList(true); // take ownership of the pickElem hit list.

    // see if we should keep the current hit
    const canBeSticky = !force && this.aSnapHits.length > 1 && this.currHit && (HitDetailType.Intersection !== this.currHit.getHitType() && this.currHit.priority < HitPriority.PlanarSurface);
    if (canBeSticky) {
      for (let iHit = 1; iHit < this.aSnapHits.length; ++iHit) {
        const thisHit = this.aSnapHits.hits[iHit];
        if (!thisHit.isSameHit(this.currHit))
          continue;
        this.aSnapHits.removeHit(iHit);
        this.aSnapHits.insertHit(0, thisHit);
        break;
      }
    }

    return SnapStatus.Success;
  }

  /**
   * If AccuSnap is active, search under cursor for new hits and generate the best AccuSnap point from that list, if any.
   * @return the best hit.
   */
  private async getNewSnapDetail(out: LocateResponse, ev: BeButtonEvent): Promise<SnapDetail | undefined> {
    out.snapStatus = this.findHits(ev);
    return (SnapStatus.Success !== out.snapStatus) ? undefined : this.getAccuSnapDetail(this.aSnapHits!, out);
  }

  private findLocatableHit(ev: BeButtonEvent, newSearch: boolean, out: LocateResponse): HitDetail | undefined {
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
    let thisHit: HitDetail | undefined;
    const ignore = new LocateResponse();
    // keep looking through hits until we find one that is accu-snappable.
    while (undefined !== (thisHit = thisList.getNextHit())) {
      if (!IModelApp.locateManager.filterHit(thisHit, LocateAction.AutoLocate, out))
        return thisHit;

      // we only care about the status of the first hit.
      out = ignore;
    }

    // Reset current hit index to go back to first hit on next AccuSnap reset event...
    thisList.resetCurrentHit();
    return undefined;
  }

  /** When in auto-locate mode, advance to the next hit without searching again. */
  public async resetButton(): Promise<SnapStatus> {
    let hit: HitDetail | undefined;
    const out = new LocateResponse();
    out.snapStatus = SnapStatus.Disabled;

    this.clearInfoBalloon(undefined);

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);

    if (this.doSnapping()) {
      // if we don't have any more candidate hits, get a new list at the current location
      if (!this.aSnapHits || (0 === this.aSnapHits.length)) {
        hit = await this.getNewSnapDetail(out, ev);
      } else {
        // drop the current hit from the list and then retest the list (without the dropped hit) to find the new "best" snap
        this.aSnapHits.removeCurrentHit();
        hit = await this.getAccuSnapDetail(this.aSnapHits, out);
      }
    } else if (this.doLocateTesting()) {
      hit = this.findLocatableHit(ev, false, out); // get next AccuSnap path (or undefined)
    }

    // set the current hit
    if (hit || this.currHit)
      this.setCurrHit(hit);

    // indicate errors
    this.showSnapError(out.snapStatus, ev);
    return out.snapStatus;
  }

  private doIntersectSnap(_ev: BeButtonEvent, _usingMultipleSnaps: boolean, _out: LocateResponse): SnapDetail | undefined {
    // const hitList = this.aSnapHits;
    // const testHits: HitDetail[] = [];
    // const testPoint = this.isLocateEnabled() ? ev.point : ev.rawPoint;
    // let count = 0;

    // // if there's a tentative point, use it
    // const tpHit = Application.tentativePoint.getCurrSnap();
    // if (tpHit) {
    //   testHits[count++] = tpHit;

    //   // if the tentative snap is already an intersection, use both elements
    //   if (HitDetailType.Intersection === tpHit.getHitType() && (HitSource.TentativeSnap === tpHit.locateSource))
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
    //   if (SnapStatus:: Success == snapContext.IntersectDetails(& thisIntsct, testHits[0], testHits[1], testPoint, TentativePoint:: GetInstance().IsSnapped()))
    //   {
    //     intsctList.AddHit(thisIntsct, false, false);
    //     thisIntsct -> Release(); // ref count was incremented when we added to list
    //   }
    // }

    // * intsctSnap = (SnapDetailP) intsctList.GetHit(0);
    // if (nullptr != * intsctSnap) {
    //   (* intsctSnap) -> AddRef();
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
  private async getPreferredSnap(ev: BeButtonEvent, out: LocateResponse): Promise<SnapDetail | undefined> {
    // Get the list of point snap modes to consider
    let snapModes: SnapMode[];

    // Special case: If tentative point is active, then we can only do intersections.
    if (IModelApp.tentativePoint.isActive) {
      snapModes = [];
      snapModes.push(SnapMode.Intersection);
    } else {
      // The user's finger is likely to create unwanted AccuSnaps, so don't snap unless source is a mouse.
      if (IModelApp.toolAdmin.isCurrentInputSourceMouse())
        snapModes = this.getActiveSnapModes();
      else
        snapModes = [];
    }

    // Consider each point snap mode and find the preferred one.
    let preferred: SnapDetail | undefined;
    let preferredDistance = 1.0e200;

    for (const snapMode of snapModes) {
      // Try to generate a snap for this snap mode and compare it with the others.
      this.candidateSnapMode = snapMode;

      const snap = (this.candidateSnapMode !== SnapMode.Intersection) ? await this.getNewSnapDetail(out, ev) : await this.doIntersectSnap(ev, snapModes.length > 1, out);
      if (SnapStatus.Aborted === out.snapStatus)
        return undefined;

      if ((SnapStatus.Success === out.snapStatus) && snap) {
        if (snap.isHot() && (SnapMode.Center === this.candidateSnapMode || SnapHeat.InRange === snap.heat)) {
          preferred = snap;
          break;
        } else {
          const dist = snap.hitPoint.distance(snap.snapPoint);
          if (dist < preferredDistance) {
            // Snap is not hot, but it is the closest we've seen so far => prefer it and keep searching for a closer one or a hot one.
            preferred = snap;
            preferredDistance = dist;
          }
        }
      }
    }

    if (!preferred) { //  No snap could be generated?
      out.snapStatus = SnapStatus.NoElements;
      return undefined;
    }

    return preferred;
  }

  /** Find the best snap point according to the current cursor location */
  public async onMotion(ev: BeButtonEvent): Promise<void> {

    await ev.viewport!.iModel.cancelSnap(); // if there is an outstanding snap, cancel it.

    const out = new LocateResponse();
    out.snapStatus = SnapStatus.Disabled;

    this.clearInfoBalloon(ev);

    let hit: HitDetail | undefined;
    if (this.isActive()) {
      if (this.doSnapping())
        hit = await this.getPreferredSnap(ev, out);
      else if (this.doLocateTesting())
        hit = this.findLocatableHit(ev, true, out);
    }

    // set the current hit and display the sprite (based on snap's KeypointType)
    if (hit || this.currHit)
      this.setCurrHit(hit);

    // indicate errors
    this.showSnapError(out.snapStatus, ev);
  }

  public onMotionStopped(_ev: BeButtonEvent): void { }
  public onNoMotion(ev: BeButtonEvent): void {
    this.noMotionCount++;
    // if (1 === this.noMotionCount)
    //   this.flashInOtherViews();
    this.displayInfoBalloon(ev.viewPoint, ev.viewport!, ev.rawPoint);
  }

  private flashElements(context: DecorateContext): void {
    const viewport = context.viewport!;
    if (this.currHit) {
      if (this.needsFlash(viewport))
        this.flashHitInView(this.currHit, context);
      return;
    }

    const hit = IModelApp.tentativePoint.getCurrSnap();
    if (hit)
      hit.draw(context);
  }

  public decorate(context: DecorateContext): void {
    this.flashElements(context);

    if (this.cross.isActive) {
      this.cross.decorate(context);
      this.icon.decorate(context);
    }

    this.errorIcon.decorate(context);
  }

  private clearElemFromHitList(element: string) {
    if (this.aSnapHits)
      this.aSnapHits.removeHitsFrom(element);
  }

  public clearIfElement(sourceId: string): void {
    this.clearElemFromHitList(sourceId);

    const hit = this.currHit;
    if (hit && hit.sourceId === sourceId) {
      this.destroy();
    }
  }

  /** Enable locating elements. */
  public enableLocate(yesNo: boolean) { this.toolState.locate = yesNo; }

  /** Called whenever a new [[Tool]] is started. */
  public onStartTool(): void {
    this.initCmdState();
    this.enableSnap(false);
    this.enableLocate(false);
    IModelApp.tentativePoint.clear(true);
  }

  /**
   * Force AccuSnap to reevaluate the snap at the current cursor location.
   * This is useful of an application changes the snap mode and wants AccuSnap to choose it immediately, without
   * requiring the user to move the mouse.
   */
  public reEvaluate() {
    if (this.getCurrSnapDetail()) {
      const ev = new BeButtonEvent();
      IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
      this.onMotion(ev);
    }
  }
}

export class TentativeOrAccuSnap {
  public static isHot(): boolean { return IModelApp.accuSnap.isHot() || IModelApp.tentativePoint.isSnapped(); }

  public static getCurrentSnap(checkIsHot: boolean = true): SnapDetail | undefined {
    // Checking for a hot AccuSnap hit before checking tentative is probably necessary for extended intersections?
    if (IModelApp.accuSnap.isHot())
      return IModelApp.accuSnap.getCurrSnapDetail();

    if (IModelApp.tentativePoint.isSnapped())
      return IModelApp.tentativePoint.currSnap;

    return (checkIsHot ? undefined : IModelApp.accuSnap.getCurrSnapDetail());
  }

  public static getCurrentPoint(): Point3d {
    if (IModelApp.accuSnap.isHot()) {
      const pathP = IModelApp.accuSnap.getCurrSnapDetail();
      if (pathP)
        return pathP.adjustedPoint;
    }

    return IModelApp.tentativePoint.getPoint();
  }

  public static getCurrentView(): Viewport | undefined {
    const snap = IModelApp.accuSnap.getCurrSnapDetail();
    return snap ? snap.viewport : IModelApp.tentativePoint.viewport;
  }
}
