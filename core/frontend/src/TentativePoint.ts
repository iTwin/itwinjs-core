/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module LocatingElements */

import { Point3d, Point2d } from "@bentley/geometry-core";
import { ScreenViewport } from "./Viewport";
import { BeButtonEvent, BeButton } from "./tools/Tool";
import { HitList, SnapDetail, SnapHeat, HitDetail, HitSource, SnapMode } from "./HitDetail";
import { DecorateContext } from "./ViewContext";
import { HitListHolder } from "./ElementLocateManager";
import { LinePixels, ColorDef } from "@bentley/imodeljs-common";
import { GraphicBuilder, GraphicType } from "./render/GraphicBuilder";
import { IModelApp } from "./IModelApp";
import { AccuSnap } from "./AccuSnap";

export class TentativePoint {
  public isActive = false;
  public currSnap?: SnapDetail;
  public tpHits?: HitList<HitDetail>;
  private get _hotDistanceInches(): number { return 0.21; }
  private readonly _point: Point3d = new Point3d();
  private readonly _rawPoint: Point3d = new Point3d();
  private readonly _viewPoint: Point3d = new Point3d();
  public viewport?: ScreenViewport;

  public onInitialized() { }
  public setHitList(list?: HitList<HitDetail>) { this.tpHits = list; }

  /** @return true if the tentative point is currently active and snapped to an element. */
  public get isSnapped(): boolean { return undefined !== this.currSnap; }

  /** @return The current snap path when TentativePoint.isSnapped or undefined. */
  public getCurrSnap(): SnapDetail | undefined { return this.currSnap; }

  public getPoint(): Point3d {
    const snap = this.currSnap;
    return !snap ? this._point : snap.adjustedPoint;
  }

  public setPoint(point: Point3d): void {
    this.setCurrSnap(undefined);
    this.tpHits = undefined;
    this._point.setFrom(point);
  }

  public clear(doErase: boolean): void {
    if (doErase) {
      this.removeTentative();
      IModelApp.accuSnap.synchSnapMode();
    }
    IModelApp.accuSnap.destroy();
    this.isActive = false;
    this.setCurrSnap(undefined);
    this.tpHits = undefined;
  }

  public removeTentative(): void {
    if (!this.isActive)
      return;

    IModelApp.accuSnap.erase();

    if (this.getCurrSnap())
      IModelApp.viewManager.invalidateDecorationsAllViews();
    else
      this.viewport!.invalidateDecorations();

    this.isActive = false;
  }

  public setCurrSnap(newSnap?: SnapDetail): void {
    if (newSnap)
      newSnap.setSnapPoint(newSnap.snapPoint, SnapHeat.InRange); // Reset adjustedPoint from pre-located snap and set SnapHeat...
    this.currSnap = newSnap;
  }

  public showTentative(): void {
    if (this.isSnapped) {
      IModelApp.viewManager.invalidateDecorationsAllViews();
      IModelApp.accuSnap.displayToolTip(this._viewPoint, this.viewport!, undefined);
    } else {
      this.viewport!.invalidateDecorations();
    }
    this.isActive = true;
  }

  public getHitAndList(holder: HitListHolder): SnapDetail | undefined {
    const hit = this.currSnap;
    if (hit) {
      holder.setHitList(this.tpHits);
      this.tpHits = undefined;
    }
    return hit;
  }

  public onButtonEvent(ev: BeButtonEvent): void {
    switch (ev.button) {
      case BeButton.Data:
        if (!ev.isDown)
          return; // cleared on down...
        break;
      case BeButton.Reset:
        if (ev.isDown)
          return; // cleared on up...
        break;
      case BeButton.Middle:
        return;
    }

    this.removeTentative();
    IModelApp.accuSnap.synchSnapMode();
    this.setCurrSnap(undefined);
    this.tpHits = undefined;
  }

  /** draw the cross as 4 lines rather than 2, so that there's no hole in the middle when drawn in dashed symbology */
  private drawTpCross(graphic: GraphicBuilder, tpSize: number, x: number, y: number): void {
    const tpCross: Point2d[] = [new Point2d(x, y), new Point2d(x + tpSize, y)];
    graphic.addLineString2d(tpCross, 0.0);

    tpCross[1].x = x - tpSize;
    graphic.addLineString2d(tpCross, 0.0);

    tpCross[1].x = x;
    tpCross[1].y = y + tpSize;
    graphic.addLineString2d(tpCross, 0.0);

    tpCross[1].y = y - tpSize;
    graphic.addLineString2d(tpCross, 0.0);
  }

  public decorate(context: DecorateContext): void {
    const viewport = context.viewport;
    if (!this.isActive || !viewport)
      return;

    const tpSize = viewport.pixelsPerInch / 2.0;  // about a 1/2 inch
    const center = viewport.worldToView(this._point);

    // draw a "background shadow" line: wide, black, mostly transparent
    const builder = context.createGraphicBuilder(GraphicType.ViewOverlay);
    const color = ColorDef.from(0, 0, 0, 225);
    builder.setSymbology(color, color, 7);
    this.drawTpCross(builder, tpSize + 2, center.x + 1, center.y + 1);

    // draw a background line: narrow, black, slightly transparent (this is in case we're not snapped and showing a dotted line)
    ColorDef.from(0, 0, 0, 10, color);
    builder.setSymbology(color, color, 3);
    this.drawTpCross(builder, tpSize + 1, center.x, center.y);

    // off-white (don't want white/black reversal), slightly transparent
    ColorDef.from(0xfe, 0xff, 0xff, 10, color);
    builder.setSymbology(color, color, 1, this.isSnapped ? LinePixels.Solid : LinePixels.Code2);

    this.drawTpCross(builder, tpSize, center.x, center.y);
    context.addDecorationFromBuilder(builder);
  }

  /** find an intersection between the current snap path and one of the other paths in the current hitList. */
  //  private doTPIntersectSnap(_inHit: HitDetail | undefined, changeFirst: boolean): SnapDetail | undefined {

  // use the current snapped path as the first path for the intersection
  //    const currSnap = this.getCurrSnap()!;
  //    const firstHit = currSnap;

  // // if we're already showing an intersection, use the "second" path as the new first path
  // if (changeFirst && (HitDetailType.Intersection === firstHit.getHitType()))
  //   firstHit = ((IntersectDetail *) firstHit) -> GetSecondHit();

  // // keep searching hits for an acceptable intersection
  // HitList intsctList;
  // for (secondHit = inHit; secondHit; secondHit = ElementLocateManager:: GetManager().GetElementPicker().GetNextHit())
  // {
  //   SnapDetailP thisIntsct = nullptr;
  //   if (SnapStatus:: Success == intsctCtx.IntersectDetails(& thisIntsct, firstHit, secondHit, & point, true))
  //   {
  //     intsctList.AddHit(thisIntsct, false, false);
  //     thisIntsct -> Release(); // ref count was incremented when we added to list
  //   }
  // }

  // intsctSnap = (SnapDetail *) intsctList.GetHit(0);
  // if (nullptr != intsctSnap) {
  //   intsctSnap -> AddRef();
  //   intsctSnap -> SetSnapMode(SnapMode.Intersection);
  //   ElementLocateManager:: GetManager()._SetChosenSnapMode(SnapType:: Points, SnapMode.Intersection);
  //   return intsctSnap;
  // }

  // We couldn't find an intersection, so now we have to decide what to show. If we were previously
  // showing an intersection, and the mouse moved to a new location (that's what "changeFirst" means), then
  // that probably means that s/he was trying to find a new element, but missed. In that case, we re-activate the
  // previous hit as the new snap, but of course we don't show it as an intersection. If we were not previously
  // snapped to an intersection, then s/he just missed, start the TP over and return a nullptr.
  //    return (changeFirst && (currSnap !== firstHit)) ? firstHit : undefined;
  //  }

  /*  We're looking for the second path for an intersection.
  *   currHit already points to the first path.
  *   nextHit is the next snap after currHit in snapList.
  * Multiple snaps:
  *   Because snapList can contain snaps of different types and because
  *   this list is sorted by proximity to the cursor, the
  *   SnapMode::Intersection candidate snaps may not be contiguous in the list.
  * This function returns the next snap in the snap list that is
  *   a SnapMode::Intersection candidate snap. This might be nextHit, or
  *   it might be a snap farther along.
  */
  /*   private findNextIntersectionCandidate(nextHit: SnapDetail | undefined): SnapDetail | undefined {
      if (!nextHit)
        return undefined;

      if (SnapMode.Intersection === nextHit.snapMode && HitDetailType.Intersection !== nextHit.getHitType()) // A SnapDetail (not IntersectionDetail) with SnapMode.Intersection denotes an intersection candidate...
        return nextHit;

      if (this.snapList.currHit === -1)
        return undefined; // There is no current hit?! This happens when we TP twice to the same element.

      // Now search for the NEXT intersection target
      // currHit already points to the item in the list that follows nextHit
      for (let iSnapDetail = this.snapList.currHit; iSnapDetail < this.snapList.length; ++iSnapDetail) {
        const snap = this.snapList.hits[iSnapDetail];
        if (SnapMode.Intersection === snap.snapMode && HitDetailType.Intersection !== snap.getHitType())
          return snap;
      }

      return undefined;
    } */

  private async getSnap(newSearch: boolean): Promise<SnapDetail | undefined> {
    // Use next hit from previous search when using tentative to cycle through hits...
    let thisHit = (!newSearch && undefined !== this.tpHits ? this.tpHits.getNextHit() : undefined);

    // Use existing AccuSnap hit list if one exists...
    if (undefined === thisHit) {
      this.tpHits = undefined;
      thisHit = IModelApp.accuSnap.getHitAndList(this);
    }

    if (undefined === thisHit) {
      // search for elements around the current raw point (search should not be affected by locks!)
      const aperture = (2.0 * this.viewport!.pixelsFromInches(IModelApp.locateManager.apertureInches) / 2.0) + 1.5;
      const options = IModelApp.locateManager.options.clone(); // Copy to avoid changing out from under active Tool...
      const picker = IModelApp.locateManager.picker;

      options.hitSource = HitSource.TentativeSnap;
      if (0 === picker.doPick(this.viewport!, this._rawPoint, aperture, options))
        return undefined;

      this.tpHits = picker.getHitList(true);
      thisHit = (undefined !== this.tpHits ? this.tpHits.getNextHit() : undefined);
    } else if (thisHit instanceof SnapDetail) {
      // Make the current AccuSnap the TentativePoint snap...
      return thisHit;
    }

    if (undefined === thisHit)
      return undefined;

    const snapModes = IModelApp.accuSnap.getActiveSnapModes(); // Get the list of point snap modes to consider
    if (1 === snapModes.length && SnapMode.Intersection === snapModes[0])
      snapModes.push(SnapMode.Nearest); // Add nearest when doing intersection by itself to support finding extended intersections...

    const thisSnap = await AccuSnap.requestSnap(thisHit, snapModes, this._hotDistanceInches, IModelApp.accuSnap.keypointDivisor, this.tpHits);

    if (undefined !== thisSnap)
      IModelApp.accuDraw.onSnap(thisSnap); // AccuDraw can adjust nearest snap to intersection of circle (polar distance lock) or line (axis lock) with snapped to curve...

    return thisSnap;
  }

  private static arePointsCloseEnough(pt1: Point3d, pt2: Point3d, pixelDistance: number): boolean { return pt1.distance(pt2) < (pixelDistance + 1.5); }
  public async process(ev: BeButtonEvent): Promise<void> {
    const wasActive = this.isActive;
    this.removeTentative(); // remove the TP cross if it is already on the screen
    const lastPtView = this._viewPoint.clone();

    this.viewport = ev.viewport!;
    this._point.setFrom(ev.point);
    this._rawPoint.setFrom(ev.rawPoint);
    this._viewPoint.setFrom(ev.viewPoint);

    const newSearch = (!this.isSnapped || !TentativePoint.arePointsCloseEnough(lastPtView, this._viewPoint, this.viewport!.pixelsFromInches(IModelApp.locateManager.apertureInches)));
    const snap = await this.getSnap(newSearch);

    this.setCurrSnap(snap); // Adopt the snap as current
    IModelApp.accuSnap.clear(); // make sure there's no AccuSnap active after a tentative point (otherwise we continually snap to it).

    if (this.isSnapped)
      this._point.setFrom(this.currSnap!.snapPoint);
    else if (wasActive && newSearch)
      this._point.setFrom(ev.rawPoint);

    this.showTentative(); // show the TP cross
  }
}
