/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent } from "@itwin/core-bentley";
import { _attachToViewport, _backingView, _implementationProhibited } from "../common/internal/Symbols";
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

  // The view's display style can be replaced wholesale. The time-point listener is tracked so it can be rebound to the
  // replacement style's settings.
  #boundStyleSettings: DisplayStyleSettings;
  #removeTimePointListener: VoidFunction;

  protected constructor(view: V) {
    this[_backingView] = view;
    this.primary = this.createPrimaryRef(view);

    this.#boundStyleSettings = view.displayStyle.settings;
    this.#removeTimePointListener = this.#bindTimePointListener(this.#boundStyleSettings);

    // Note: raised just before the view's displayStyle property is reassigned - bind to the replacement supplied by the event.
    view.onDisplayStyleChanged.addListener((newStyle) => this.#styleSettingsReplaced(newStyle.settings));
  }

  #bindTimePointListener(settings: DisplayStyleSettings): VoidFunction {
    return settings.onAfterTimePointChanged.addListener(() => this.onTimePointChanged.raiseEvent());
  }

  #styleSettingsReplaced(newSettings: DisplayStyleSettings): void {
    const oldTimePoint = this.#boundStyleSettings.timePoint;
    this.#removeTimePointListener();
    this.#boundStyleSettings = newSettings;
    this.#removeTimePointListener = this.#bindTimePointListener(newSettings);

    if (newSettings.timePoint !== oldTimePoint)
      this.onTimePointChanged.raiseEvent();
  }

  /** The display style may have been replaced while the view was detached, in which case no events were raised - rebind now. */
  public [_attachToViewport](): void {
    const settings = this[_backingView].displayStyle.settings;
    if (settings !== this.#boundStyleSettings)
      this.#styleSettingsReplaced(settings);
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

  public readonly linked: SpatialIModelDisplayReference[] = [];

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
    for (const linked of this.linked)
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
    this.linked.push(ref);
    this.#iModels.add(ref.iModel);
    this.onLinked.raiseEvent(ref);
    return ref;
  }

  public unlink(refToRemove: SpatialIModelDisplayReference): void {
    const index = this.linked.indexOf(refToRemove);
    if (index !== -1) {
      this.linked.splice(index, 1);
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
