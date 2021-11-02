/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module LocatingElements
 */

import { Id64 } from "@itwin/core-bentley";
import { Point2d, Point3d } from "@itwin/core-geometry";
import { HitDetail, HitList, HitPriority, HitSource } from "./HitDetail";
import { IModelApp } from "./IModelApp";
import { Pixel } from "./render/Pixel";
import { InputSource, InteractiveTool } from "./tools/Tool";
import { ScreenViewport, Viewport } from "./Viewport";
import { ViewRect } from "./ViewRect";

/** The possible actions for which a locate filter can be called.
 * @public
 */
export enum LocateAction {
  Identify = 0,
  AutoLocate = 1,
}

/** Values to return from a locate filter.
 * Return `Reject` to indicate the element is unacceptable.
 * @public
 */
export enum LocateFilterStatus {
  Accept = 0,
  Reject = 1,
}

/** @public */
export enum SnapStatus {
  Success = 0,
  Aborted = 1,
  NoElements = 2,
  Disabled = 100,
  NoSnapPossible = 200,
  NotSnappable = 300,
  FilteredByApp = 600,
  FilteredByAppQuietly = 700,
}

/** Options that customize the way element location (i.e. *picking*) works.
 * @public
 */
export class LocateOptions {
  /** If true, also test graphics from view decorations. */
  public allowDecorations = false;
  /** If true, also test graphics with non-locatable flag set. */
  public allowNonLocatable = false;
  /** Maximum number of hits to return. */
  public maxHits = 20;
  /** The [[HitSource]] identifying the caller. */
  public hitSource = HitSource.DataPoint;
  /** If true, also test graphics from an IModelConnection other than the one associated with the Viewport. This can occur if, e.g., a
   * [[TiledGraphicsProvider]] is used to display graphics from a different iModel into the [[Viewport]].
   * @note If you override this, you must be prepared to properly handle [[HitDetail]]s originating from other IModelConnections.
   * @see [[HitDetail.iModel]] and [[HitDetail.isExternalIModelHit]]
   */
  public allowExternalIModels = false;
  /** If true, then the world point of a hit on a model will preserve any transforms applied to the model at display time,
   * such as those supplied by a [[ModelDisplayTransformProvider]] or [PlanProjectionSettings.elevation]($common).
   * Otherwise, the world point will be multiplied by the inverse of any such transforms to correlate it with the model's true coordinate space.
   */
  public preserveModelDisplayTransforms = false;

  /** Make a copy of this LocateOptions. */
  public clone(): LocateOptions {
    const other = new LocateOptions();
    other.allowDecorations = this.allowDecorations;
    other.allowNonLocatable = this.allowNonLocatable;
    other.maxHits = this.maxHits;
    other.hitSource = this.hitSource;
    other.allowExternalIModels = this.allowExternalIModels;
    return other;
  }
  public setFrom(other: LocateOptions): void {
    this.allowDecorations = other.allowDecorations;
    this.allowNonLocatable = other.allowNonLocatable;
    this.maxHits = other.maxHits;
    this.hitSource = other.hitSource;
    this.allowExternalIModels = other.allowExternalIModels;
  }
  public init() {
    this.allowDecorations = this.allowNonLocatable = this.allowExternalIModels = false;
    this.maxHits = 20;
    this.hitSource = HitSource.DataPoint;
  }
}

/** @public */
export class LocateResponse {
  public snapStatus = SnapStatus.Success;
  public reason?: string;
  public explanation = "";

  /** @internal */
  public clone(): LocateResponse {
    const other = new LocateResponse();
    other.snapStatus = this.snapStatus;
    other.reason = this.reason;
    other.explanation = this.explanation;
    return other;
  }

  /** @internal */
  public setFrom(other: LocateResponse): void {
    this.snapStatus = other.snapStatus;
    this.reason = other.reason;
    this.explanation = other.explanation;
  }
}

/** @public */
export interface HitListHolder {
  setHitList(list: HitList<HitDetail> | undefined): void;
}

/** @public */
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
  public doPick(vp: ScreenViewport, pickPointWorld: Point3d, pickRadiusView: number, options: LocateOptions): number {
    if (this.hitList && this.hitList.length > 0 && vp === this.viewport && pickPointWorld.isAlmostEqual(this.pickPointWorld)) {
      this.hitList.resetCurrentHit();
      return this.hitList.length;
    }

    this.empty(); // empty the hit list
    this.viewport = vp;
    this.pickPointWorld.setFrom(pickPointWorld);

    const pickPointView = vp.worldToView(pickPointWorld);
    const testPointView = new Point2d(Math.floor(pickPointView.x + 0.5), Math.floor(pickPointView.y + 0.5));
    let pixelRadius = Math.floor(pickRadiusView + 0.5);
    const rect = new ViewRect(testPointView.x - pixelRadius, testPointView.y - pixelRadius, testPointView.x + pixelRadius, testPointView.y + pixelRadius);
    let result: number = 0;
    vp.readPixels(rect, Pixel.Selector.All, (pixels) => {
      if (undefined === pixels)
        return;

      testPointView.x = vp.cssPixelsToDevicePixels(testPointView.x);
      testPointView.y = vp.cssPixelsToDevicePixels(testPointView.y);
      pixelRadius = vp.cssPixelsToDevicePixels(pixelRadius);

      const elmHits = new Map<string, Point2d>();
      const testPoint = Point2d.createZero();
      for (testPoint.x = testPointView.x - pixelRadius; testPoint.x <= testPointView.x + pixelRadius; ++testPoint.x) {
        for (testPoint.y = testPointView.y - pixelRadius; testPoint.y <= testPointView.y + pixelRadius; ++testPoint.y) {
          const pixel = pixels.getPixel(testPoint.x, testPoint.y);
          if (undefined === pixel || undefined === pixel.elementId || Id64.isInvalid(pixel.elementId))
            continue; // no geometry at this location...

          const distXY = testPointView.distance(testPoint);
          if (distXY > pixelRadius)
            continue; // ignore corners. it's a locate circle not square...

          const oldPoint = elmHits.get(pixel.elementId);
          if (undefined !== oldPoint) {
            if (this.comparePixel(pixel, pixels.getPixel(oldPoint.x, oldPoint.y), distXY, testPointView.distance(oldPoint)) < 0)
              oldPoint.setFrom(testPoint); // new hit is better, update location...
          } else {
            elmHits.set(pixel.elementId, testPoint.clone());
          }
        }
      }
      if (0 === elmHits.size)
        return;

      for (const elmPoint of elmHits.values()) {
        const pixel = pixels.getPixel(elmPoint.x, elmPoint.y);
        if (undefined === pixel || undefined === pixel.elementId)
          continue;

        const hitPointWorld = vp.getPixelDataWorldPoint({
          pixels,
          x: elmPoint.x,
          y: elmPoint.y,
          preserveModelDisplayTransforms: options.preserveModelDisplayTransforms,
        });

        if (!hitPointWorld)
          continue;

        const modelId = undefined !== pixel.featureTable ? pixel.featureTable.modelId : undefined;
        const hit = new HitDetail(pickPointWorld, vp, options.hitSource, hitPointWorld, pixel.elementId, this.getPixelPriority(pixel), testPointView.distance(elmPoint), pixel.distanceFraction, pixel.subCategoryId, pixel.geometryClass, modelId, pixel.iModel, pixel.tileId, pixel.isClassifier);
        this.hitList!.addHit(hit);

        if (this.hitList!.hits.length > options.maxHits)
          this.hitList!.hits.length = options.maxHits; // truncate array...
      }

      result = this.hitList!.length;
    }, !options.allowNonLocatable);

    return result;
  }

  public testHit(hit: HitDetail, vp: ScreenViewport, pickPointWorld: Point3d, pickRadiusView: number, options: LocateOptions): boolean {
    if (0 === this.doPick(vp, pickPointWorld, pickRadiusView, options))
      return false;

    return this.hitList!.hits.some((thisHit) => hit.isSameHit(thisHit));
  }
}

/** @public */
export class ElementLocateManager {
  public hitList?: HitList<HitDetail>;
  public currHit?: HitDetail;
  public readonly options = new LocateOptions();
  public readonly picker = new ElementPicker();

  /** get the full message key for a locate failure  */
  public static getFailureMessageKey(key: string) { return `LocateFailure.${key}`; }
  public onInitialized() { }
  public get apertureInches() { return 0.11; }
  public get touchApertureInches() { return 0.22; }

  public clear(): void { this.setCurrHit(undefined); }
  public setHitList(list?: HitList<HitDetail>) { this.hitList = list; }
  public setCurrHit(hit?: HitDetail): void { this.currHit = hit; }
  public getNextHit(): HitDetail | undefined { return this.hitList ? this.hitList.getNextHit() : undefined; }

  /** return the current path from either the snapping logic or the pre-locating systems. */
  public getPreLocatedHit(): HitDetail | undefined {
    // NOTE: Check AccuSnap first as Tentative is used to build intersect snap. For normal snaps when a Tentative is active there should be no AccuSnap.
    let preLocated = IModelApp.accuSnap.getHitAndList(this);

    if (!preLocated && !!(preLocated = IModelApp.tentativePoint.getHitAndList(this))) {
      const vp = preLocated.viewport;
      this.picker.empty(); // Get new hit list at hit point; want reset to cycle hits using adjusted point location...
      this.picker.doPick(vp, preLocated.getPoint(), (vp.pixelsFromInches(this.apertureInches) / 2.0) + 1.5, this.options);
      this.setHitList(this.picker.getHitList(true));
    }

    if (this.hitList)
      this.hitList.resetCurrentHit();

    return preLocated;
  }

  public async filterHit(hit: HitDetail, _action: LocateAction, out: LocateResponse): Promise<LocateFilterStatus> {
    // Tools must opt-in to locate of transient geometry as it requires special treatment.
    if (!this.options.allowDecorations && !hit.isElementHit) {
      if (hit.isModelHit)
        out.reason = ElementLocateManager.getFailureMessageKey("RealityModel");
      else if (hit.isMapHit)
        out.reason = ElementLocateManager.getFailureMessageKey("Map");
      else
        out.reason = ElementLocateManager.getFailureMessageKey("Transient");
      return LocateFilterStatus.Reject;
    }

    // Tools must opt-in to locate geometry from external iModels.
    if (!this.options.allowExternalIModels && hit.isExternalIModelHit) {
      out.reason = ElementLocateManager.getFailureMessageKey("ExternalIModel");
      return LocateFilterStatus.Reject;
    }

    if (undefined !== hit.subCategoryId && !hit.isExternalIModelHit) {
      const appearance = hit.viewport.getSubCategoryAppearance(hit.subCategoryId);
      if (appearance.dontLocate) {
        out.reason = ElementLocateManager.getFailureMessageKey("NotLocatableSubCategory");
        return LocateFilterStatus.Reject;
      }
    }

    const tool = IModelApp.toolAdmin.activeTool;
    if (!(tool && tool instanceof InteractiveTool))
      return LocateFilterStatus.Accept;

    const status = await tool.filterHit(hit, out);
    if (LocateFilterStatus.Reject === status)
      out.reason = ElementLocateManager.getFailureMessageKey("ByApp");

    return status;
  }

  public initLocateOptions() { this.options.init(); }
  public initToolLocate() {
    this.initLocateOptions();
    this.clear();
    this.picker.empty();
    IModelApp.tentativePoint.clear(true);
  }

  private async _doLocate(response: LocateResponse, newSearch: boolean, testPoint: Point3d, vp: ScreenViewport | undefined, source: InputSource, filterHits: boolean): Promise<HitDetail | undefined> {
    if (!vp)
      return;

    // the "newSearch" flag indicates whether the caller wants us to conduct a new search at the testPoint, or just continue returning paths from the previous search.
    if (newSearch) {
      const hit = this.getPreLocatedHit();

      // if we're snapped to something, that path has the highest priority and becomes the active hit.
      if (hit) {
        if (!filterHits || LocateFilterStatus.Accept === await this.filterHit(hit, LocateAction.Identify, response))
          return hit;

        response = new LocateResponse(); // we have the reason and explanation we want.
      }

      this.picker.empty();
      this.picker.doPick(vp, testPoint, (vp.pixelsFromInches(InputSource.Touch === source ? this.touchApertureInches : this.apertureInches) / 2.0) + 1.5, this.options);

      const hitList = this.picker.getHitList(true);
      this.setHitList(hitList);
    }

    let newHit: HitDetail | undefined;
    while (undefined !== (newHit = this.getNextHit())) {
      if (!filterHits || LocateFilterStatus.Accept === await this.filterHit(newHit, LocateAction.Identify, response))
        return newHit;
      response = new LocateResponse(); // we have the reason and explanation we want.
    }

    return undefined;
  }

  public async doLocate(response: LocateResponse, newSearch: boolean, testPoint: Point3d, view: ScreenViewport | undefined, source: InputSource, filterHits = true): Promise<HitDetail | undefined> {
    response.reason = ElementLocateManager.getFailureMessageKey("NoElements");
    response.explanation = "";

    const hit = await this._doLocate(response, newSearch, testPoint, view, source, filterHits);
    this.setCurrHit(hit);

    // if we found a hit, remove it from the list of remaining hits near the current search point.
    if (hit && this.hitList)
      this.hitList.removeHitsFrom(hit.sourceId);
    return hit;
  }
}
