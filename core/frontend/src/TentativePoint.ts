/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module LocatingElements */

import { Point3d } from "@bentley/geometry-core";
import { ScreenViewport } from "./Viewport";
import { BeButtonEvent, BeButton } from "./tools/Tool";
import { HitList, SnapDetail, SnapHeat, HitDetail, HitSource, SnapMode } from "./HitDetail";
import { DecorateContext } from "./ViewContext";
import { HitListHolder } from "./ElementLocateManager";
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

  public decorate(context: DecorateContext): void {
    const viewport = context.viewport;
    if (!this.isActive || !viewport)
      return;

    const tpSize = Math.floor(viewport.pixelsPerInch * 0.4) + 0.5;
    const toSizeOutline = tpSize + 1;
    const position = context.viewport.worldToView(this._point); position.x = Math.floor(position.x) + 0.5; position.y = Math.floor(position.y) + 0.5;
    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 3;
      ctx.moveTo(-toSizeOutline, 0);
      ctx.lineTo(toSizeOutline, 0);
      ctx.moveTo(0, -toSizeOutline);
      ctx.lineTo(0, toSizeOutline);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      if (!this.isSnapped) ctx.setLineDash([4, 1]);
      ctx.shadowColor = "black";
      ctx.shadowBlur = 5;
      ctx.moveTo(-tpSize, 0);
      ctx.lineTo(tpSize, 0);
      ctx.moveTo(0, -tpSize);
      ctx.lineTo(0, tpSize);
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration });
  }

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
