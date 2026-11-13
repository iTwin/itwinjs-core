/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent } from "@itwin/core-bentley";
import { _attachToViewport, _backingView, _detachFromViewport, _implementationProhibited } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { GenericIModelDisplayReferences, IModelDisplayReferences2d, LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { SpatialViewState } from "../SpatialViewState";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { ViewState, ViewState2d } from "../ViewState";
import { createLinkedSpatialIModelDisplayReference } from "./LinkedSpatialIModelRef";
import { createGenericPrimaryIModelDisplayReference, createPrimaryIModelDisplayReference2d, createPrimarySpatialIModelDisplayReference } from "./PrimaryIModelRef";
import { DisplayStyleSettings, FeatureAppearance } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";

abstract class DisplayRefsImpl<R extends IModelDisplayReference, V extends ViewState> {
  public readonly [_implementationProhibited] = undefined;

  public readonly [_backingView]: V;

  protected abstract createPrimaryRef(view: V): R;

  public readonly primary: R;
  public readonly subcategories = new SubCategoriesCache.Queue();
  public readonly onTimePointChanged = new BeEvent<() => void>();
  public readonly onDefaultFeatureAppearanceChanged = new BeEvent<() => void>();
  #defaultFeatureAppearance = FeatureAppearance.defaults;

  // The view's display style can be replaced wholesale, and - because a style's settings can outlive this view (e.g.,
  // a style shared by several views) - the time-point listener is registered on the settings only while the view is
  // attached to a viewport. Time-point notifications are keyed on the last-notified value so that changes occurring
  // while detached (or carried by a replacement style) are raised on reattachment.
  #boundStyleSettings: DisplayStyleSettings;
  #removeTimePointListener?: VoidFunction;
  #lastTimePoint: number | undefined;

  protected constructor(view: V) {
    this[_backingView] = view;
    this.primary = this.createPrimaryRef(view);

    this.#boundStyleSettings = view.displayStyle.settings;
    this.#lastTimePoint = this.#boundStyleSettings.timePoint;

    // Note: raised just before the view's displayStyle property is reassigned - bind to the replacement supplied by the
    // event. This event is owned by the view itself (not the style), so subscribing for the lifetime of this collection
    // cannot cause the view to be retained by another object.
    view.onDisplayStyleChanged.addListener((newStyle) => this.#styleSettingsReplaced(newStyle.settings));
  }

  #bindTimePointListener(settings: DisplayStyleSettings): VoidFunction {
    return settings.onAfterTimePointChanged.addListener(() => this.#notifyTimePoint(settings.timePoint));
  }

  #notifyTimePoint(timePoint: number | undefined): void {
    if (timePoint !== this.#lastTimePoint) {
      this.#lastTimePoint = timePoint;
      this.onTimePointChanged.raiseEvent();
    }
  }

  #styleSettingsReplaced(newSettings: DisplayStyleSettings): void {
    if (this.#removeTimePointListener) {
      this.#removeTimePointListener();
      this.#removeTimePointListener = this.#bindTimePointListener(newSettings);
    }

    this.#boundStyleSettings = newSettings;
    this.#notifyTimePoint(newSettings.timePoint);
  }

  /** The display style may have been replaced - or its time point changed - while the view was detached, in which case
   * no events were raised; bind to the current settings and catch up now.
   */
  public [_attachToViewport](): void {
    const settings = this[_backingView].displayStyle.settings;
    this.#boundStyleSettings = settings;
    this.#removeTimePointListener ??= this.#bindTimePointListener(settings);
    this.#notifyTimePoint(settings.timePoint);
  }

  /** Remove the subscriptions on the display style's settings - the settings may outlive this view, and must not retain it. */
  public [_detachFromViewport](): void {
    this.#removeTimePointListener?.();
    this.#removeTimePointListener = undefined;
  }

  public abstract [Symbol.iterator](): Iterator<R>;

  public get timePoint(): number | undefined {
    return this[_backingView].displayStyle.settings.timePoint;
  }

  public set timePoint(timePoint: number | undefined) {
    this[_backingView].displayStyle.settings.timePoint = timePoint;
  }

  public get defaultFeatureAppearance(): FeatureAppearance {
    return this.#defaultFeatureAppearance;
  }

  public set defaultFeatureAppearance(appearance: FeatureAppearance) {
    if (appearance !== this.#defaultFeatureAppearance) {
      this.#defaultFeatureAppearance = appearance;
      this.onDefaultFeatureAppearanceChanged.raiseEvent();
    }
  }
}

class DisplayRefs2dImpl extends DisplayRefsImpl<IModelDisplayReference2d, ViewState2d> implements IModelDisplayReferences2d {
  protected override createPrimaryRef(): IModelDisplayReference2d {
    return createPrimaryIModelDisplayReference2d(this)
  }

  public readonly is2d = true;

  public constructor(view: ViewState2d) {
    super(view);
  }

  public *[Symbol.iterator](): Iterator<IModelDisplayReference2d> {
    yield this.primary;
  }

  public get iModels(): Iterable<IModelConnection> {
    return [this.primary.iModel];
  }
}

class SpatialDisplayRefsImpl extends DisplayRefsImpl<SpatialIModelDisplayReference, SpatialViewState> implements SpatialIModelDisplayReferences {
  readonly #iModels = new Set<IModelConnection>();

  // A Set (rather than an array) so that iteration remains well-defined while entries are removed - e.g., an app
  // unlinking every reference while iterating [[linked]].
  readonly #linked = new Set<SpatialIModelDisplayReference>();

  public get linked(): Iterable<SpatialIModelDisplayReference> {
    return this.#linked;
  }

  protected override createPrimaryRef(): SpatialIModelDisplayReference {
    return createPrimarySpatialIModelDisplayReference(this);
  }

  public readonly isSpatial = true;

  public readonly onLinked = new BeEvent<(ref: SpatialIModelDisplayReference) => void>;
  public readonly onUnlinked = new BeEvent<(ref: SpatialIModelDisplayReference) => void>;

  public constructor(view: SpatialViewState) {
    super(view);
    this.#iModels.add(this.primary.iModel);
  }

  public *[Symbol.iterator](): Iterator<SpatialIModelDisplayReference> {
    yield this.primary;
    for (const linked of this.#linked)
      yield linked;
  }

  public get iModels(): Iterable<IModelConnection> {
    return this.#iModels;
  }

  public link(args: LinkSpatialIModelArgs): SpatialIModelDisplayReference {
    for (const existingRef of this)
      if (existingRef.iModel === args.iModel)
        throw new Error("IModelDisplayReference.link does not support linking the same iModel multiple times");

    const ref = createLinkedSpatialIModelDisplayReference(this, args);
    this.#linked.add(ref);
    this.#iModels.add(ref.iModel);
    this.onLinked.raiseEvent(ref);
    return ref;
  }

  public unlink(refToRemove: SpatialIModelDisplayReference): void {
    if (this.#linked.delete(refToRemove)) {
      let removeIModel = true;
      for (const remainingRef of this) {
        if (remainingRef.iModel === refToRemove.iModel) {
          removeIModel = false;
          break;
        }
      }

      if (removeIModel)
        this.#iModels.delete(refToRemove.iModel);

      this.onUnlinked.raiseEvent(refToRemove);

      // The periodic purge only reclaims tile trees of iModels currently associated with a TileUser - once unlinked from
      // every view, nothing else would free this iModel's unused trees while the connection remains open.
      if (removeIModel)
        IModelApp.tileAdmin.purgeUnusedTreesForIModel(refToRemove.iModel);
    }
  }

}

/** The default iModel references for a view that is neither spatial nor 2d - i.e., a direct subclass of ViewState or
 * ViewState3d that does not supply its own specialized implementation. It supports only the primary iModel.
 */
class GenericDisplayRefsImpl extends DisplayRefsImpl<IModelDisplayReference, ViewState> implements GenericIModelDisplayReferences {
  protected override createPrimaryRef(): IModelDisplayReference {
    return createGenericPrimaryIModelDisplayReference(this);
  }

  public constructor(view: ViewState) {
    super(view);
  }

  public *[Symbol.iterator](): Iterator<IModelDisplayReference> {
    yield this.primary;
  }

  public get iModels(): Iterable<IModelConnection> {
    return [this.primary.iModel];
  }
}

/** @internal */
export function createIModelDisplayReferences2d(view: ViewState2d): IModelDisplayReferences2d {
  return new DisplayRefs2dImpl(view);
}

/** @internal */
export function createSpatialIModelDisplayReferences(view: SpatialViewState): SpatialIModelDisplayReferences {
  return new SpatialDisplayRefsImpl(view);
}

/** @internal */
export function createGenericIModelDisplayReferences(view: ViewState): GenericIModelDisplayReferences {
  return new GenericDisplayRefsImpl(view);
}
