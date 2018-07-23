/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module LocatingElements */

import { HitSource, HitDetail, HitList, HitPriority } from "./HitDetail";
import { Point3d, Point2d } from "@bentley/geometry-core";
import { Viewport, ViewRect } from "./Viewport";
import { IModelApp } from "./IModelApp";
import { Pixel } from "./rendering";
import { PrimitiveTool } from "./tools/PrimitiveTool";

/** The possible actions for which a locate filter can be called. */
export const enum LocateAction {
  Identify = 0,
  AutoLocate = 1,
}

/**
 * Values to return from a locate filter.
 *
 * @note It would be rare and extreme for a locate filter to ever return Accept.
 *
 * Usually, filters will return Reject to indicate the element is unacceptable, or Neutral to
 * indicate that the element is acceptable <i>as far as this filter is concerned.</i> By returning Accept, a
 * single filter can cause the element to be accepted, *without calling other filters* that might otherwise reject the element.
 * Indicates the reason an element was rejected by a filter.
 */
export const enum LocateFilterStatus {
  Reject = 0,
  Neutral = 1,
  Accept = 2,
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

/** Options that customize the way element location (i.e. *picking*) works. */
export class LocateOptions {
  /** If true, also test graphics from view decorations. */
  public allowDecorations = false;
  /** Maximum number of hits to return. */
  public maxHits = 20;
  /** The [[HitSource]] identifying the caller. */
  public hitSource = HitSource.DataPoint;
  /** Make a copy of this LocateOptions. */
  public clone(): LocateOptions {
    const other = new LocateOptions();
    other.allowDecorations = this.allowDecorations;
    other.maxHits = this.maxHits;
    other.hitSource = this.hitSource;
    return other;
  }
  public init() { this.allowDecorations = false; this.maxHits = 20; this.hitSource = HitSource.DataPoint; }
}

export class LocateResponse {
  public snapStatus = SnapStatus.Success;
  public reason?: string;
  public explanation = "";
}

export interface HitListHolder {
  setHitList(list: HitList<HitDetail> | undefined): void;
}

export class ElementPicker {
  public viewport?: Viewport;
  public readonly pickPointWorld = new Point3d();
  public hitList?: HitList<HitDetail>;

  public empty() {
    this.pickPointWorld.setZero();
    this.viewport = undefined;
    if (this.hitList)
      this.hitList.empty();
    else
      this.hitList = new HitList<HitDetail>();
  }

  /** return the HitList for the last Pick performed. Optionally allows the caller to take ownership of the list. */
  public getHitList(takeOwnership: boolean): HitList<HitDetail> {
    const list = this.hitList!;
    if (takeOwnership)
      this.hitList = undefined;
    return list;
  }

  public getNextHit(): HitDetail | undefined { return this.hitList ? this.hitList.getNextHit() : undefined; }

  /** Return a hit from the list of hits created the last time pickElements was called. */
  public getHit(i: number): HitDetail | undefined { return this.hitList ? this.hitList.getHit(i) : undefined; }

  public resetCurrentHit(): void { if (this.hitList) this.hitList.resetCurrentHit(); }

  private getPixelPriority(pixel: Pixel.Data) {
    switch (pixel.type) {
      case Pixel.GeometryType.Surface:
        return Pixel.Planarity.Planar === pixel.planarity ? HitPriority.PlanarSurface : HitPriority.NonPlanarSurface;
      case Pixel.GeometryType.Linear:
        return HitPriority.WireEdge;
      case Pixel.GeometryType.Edge:
        return Pixel.Planarity.Planar === pixel.planarity ? HitPriority.PlanarEdge : HitPriority.NonPlanarEdge;
      case Pixel.GeometryType.Silhouette:
        return HitPriority.SilhouetteEdge;
      default:
        return HitPriority.Unknown;
    }
  }

  private comparePixel(pixel1: Pixel.Data, pixel2: Pixel.Data, distXY1: number, distXY2: number) {
    const priority1 = this.getPixelPriority(pixel1);
    const priority2 = this.getPixelPriority(pixel2);
    if (priority1 < priority2) return -1;
    if (priority1 > priority2) return 1;
    if (distXY1 < distXY2) return -1;
    if (distXY1 > distXY2) return 1;
    if (pixel1.distanceFraction > pixel2.distanceFraction) return -1;
    if (pixel1.distanceFraction < pixel2.distanceFraction) return 1;
    return 0;
  }

  /** Generate a list of elements that are close to a given point.
   * @returns The number of hits in the hitList of this object.
   */
  public doPick(vp: Viewport, pickPointWorld: Point3d, pickRadiusView: number, options: LocateOptions): number {
    if (this.hitList && this.hitList.length > 0 && vp === this.viewport && pickPointWorld.isAlmostEqual(this.pickPointWorld)) {
      this.hitList.resetCurrentHit();
      return this.hitList.length;
    }

    this.empty(); // empty the hit list
    this.viewport = vp;
    this.pickPointWorld.setFrom(pickPointWorld);

    const pickPointView = vp.worldToView(pickPointWorld);
    const testPointView = new Point2d(Math.floor(pickPointView.x + 0.5), Math.floor(pickPointView.y + 0.5));
    const pixelRadius = Math.floor(pickRadiusView + 0.5);
    const rect = new ViewRect(testPointView.x - pixelRadius, testPointView.y - pixelRadius, testPointView.x + pixelRadius, testPointView.y + pixelRadius);
    const pixels = vp.readPixels(rect, Pixel.Selector.All);
    if (undefined === pixels)
      return 0;

    const elmHits = new Map<string, Point2d>();
    const testPoint = Point2d.createZero();
    for (testPoint.x = testPointView.x - pixelRadius; testPoint.x <= testPointView.x + pixelRadius; ++testPoint.x) {
      for (testPoint.y = testPointView.y - pixelRadius; testPoint.y <= testPointView.y + pixelRadius; ++testPoint.y) {
        const pixel = pixels.getPixel(testPoint.x, testPoint.y);
        if (undefined === pixel || undefined === pixel.elementId || !pixel.elementId.isValid())
          continue; // no geometry at this location...
        const distXY = testPointView.distance(testPoint);
        if (distXY > pixelRadius)
          continue; // ignore corners. it's a locate circle not square...
        const oldPoint = elmHits.get(pixel.elementId.toString());
        if (undefined !== oldPoint) {
          if (this.comparePixel(pixel, pixels.getPixel(oldPoint.x, oldPoint.y), distXY, testPointView.distance(oldPoint)) < 0)
            oldPoint.setFrom(testPoint); // new hit is better, update location...
        } else {
          elmHits.set(pixel.elementId.toString(), testPoint.clone());
        }
      }
    }
    if (0 === elmHits.size)
      return 0;

    for (const elmPoint of elmHits.values()) {
      const pixel = pixels.getPixel(elmPoint.x, elmPoint.y);
      if (undefined === pixel || undefined === pixel.elementId)
        continue;
      const hitPointWorld = vp.getPixelDataWorldPoint(pixels, elmPoint.x, elmPoint.y);
      if (undefined === hitPointWorld)
        continue;
      const hit = new HitDetail(pickPointWorld, vp, options.hitSource, hitPointWorld, pixel.elementId.toString(), this.getPixelPriority(pixel), testPointView.distance(elmPoint), pixel.distanceFraction);
      this.hitList!.addHit(hit);
      if (this.hitList!.hits.length > options.maxHits)
        this.hitList!.hits.length = options.maxHits; // truncate array...
    }
    return this.hitList!.length;
  }

  public testHit(hit: HitDetail, vp: Viewport, pickPointWorld: Point3d, pickRadiusView: number, options: LocateOptions): boolean {
    if (0 === this.doPick(vp, pickPointWorld, pickRadiusView, options))
      return false;
    for (let iHit = 0; iHit < this.hitList!.length; ++iHit) {
      const thisHit = this.hitList!.getHit(iHit);
      if (hit.isSameHit(thisHit))
        return true;
    }
    return false;
  }
}

export class ElementLocateManager {
  public hitList?: HitList<HitDetail>;
  public currHit?: HitDetail;
  public readonly options = new LocateOptions();
  public readonly picker = new ElementPicker();

  /** get the full message key for a locate failure  */
  public static getFailureMessageKey(key: string) { return "LocateFailure." + key; }
  public onInitialized() { }
  public get apertureInches() { return 0.11; }

  public clear(): void { this.setCurrHit(undefined); }
  public setHitList(list?: HitList<HitDetail>) { this.hitList = list; }
  public setCurrHit(hit?: HitDetail): void { this.currHit = hit; }
  public getNextHit(): HitDetail | undefined { return this.hitList ? this.hitList.getNextHit() : undefined; }

  /** return the current path from either the snapping logic or the pre-locating systems. */
  public getPreLocatedHit(): HitDetail | undefined {
    // NOTE: Check AccuSnap first as Tentative is used to build intersect snap. For normal snaps when a Tentative is active there should be no AccuSnap.
    let preLocated = IModelApp.accuSnap.getHitAndList(this);

    if (!preLocated && !!(preLocated = IModelApp.tentativePoint.getHitAndList(this))) {
      const vp = preLocated.viewport!;
      this.picker.empty(); // Get new hit list at hit point; want reset to cycle hits using adjusted point location...
      this.picker.doPick(vp, preLocated.getPoint(), (vp.pixelsFromInches(this.apertureInches) / 2.0) + 1.5, this.options);
      this.setHitList(this.picker.getHitList(true));
    }

    if (this.hitList)
      this.hitList.resetCurrentHit();

    return preLocated;
  }

  public filterHit(hit: HitDetail, _action: LocateAction, out: LocateResponse): boolean {
    // Tools must opt-in to locate of transient geometry as it requires special treatment.
    if (!hit.isElementHit() && !this.options.allowDecorations) {
      out.reason = ElementLocateManager.getFailureMessageKey("Transient");
      return true;
    }

    const tool = IModelApp.toolAdmin.activeTool;
    if (!(tool && tool instanceof PrimitiveTool))
      return false;

    const retVal = !tool.onPostLocate(hit, out);
    if (retVal)
      out.reason = ElementLocateManager.getFailureMessageKey("ByCommand");

    return retVal;
  }

  public initLocateOptions() { this.options.init(); }
  public initToolLocate() {
    this.initLocateOptions();
    this.clear();
    this.picker.empty();
    IModelApp.tentativePoint.clear(true);
  }

  private _doLocate(response: LocateResponse, newSearch: boolean, testPoint: Point3d, vp: Viewport | undefined, filterHits: boolean): HitDetail | undefined {
    if (!vp)
      return;

    // the "newSearch" flag indicates whether the caller wants us to conduct a new search at the testPoint, or just continue returning paths from the previous search.
    if (newSearch) {
      const hit = this.getPreLocatedHit();

      // if we're snapped to something, that path has the highest priority and becomes the active hit.
      if (hit) {
        if (!filterHits || !this.filterHit(hit, LocateAction.Identify, response))
          return hit;

        response = new LocateResponse(); // we have the reason and explanation we want.
      }

      this.picker.empty();
      this.picker.doPick(vp, testPoint, (vp.pixelsFromInches(this.apertureInches) / 2.0) + 1.5, this.options);

      const hitList = this.picker.getHitList(true);
      this.setHitList(hitList);
    }

    let newHit: HitDetail | undefined;
    while (undefined !== (newHit = this.getNextHit())) {
      if (!filterHits || !this.filterHit(newHit, LocateAction.Identify, response))
        return newHit;
      response = new LocateResponse(); // we have the reason and explanation we want.
    }

    return undefined;
  }

  public doLocate(response: LocateResponse, newSearch: boolean, testPoint: Point3d, view: Viewport | undefined, filterHits = true): HitDetail | undefined {
    response.reason = ElementLocateManager.getFailureMessageKey("NoElements");
    response.explanation = "";

    const hit = this._doLocate(response, newSearch, testPoint, view, filterHits);
    this.setCurrHit(hit);

    // if we found a hit, remove it from the list of remaining hits near the current search point.
    if (hit && this.hitList)
      this.hitList.removeHitsFrom(hit.sourceId);
    return hit;
  }
}
