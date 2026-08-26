/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { FeatureAppearance, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { _getModelClip, _implementationProhibited, _mapImagery, _scheduleScriptReference } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { BeEvent, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { FeatureOverrideProvider } from "../FeatureOverrideProvider";
import { IModelDisplayReferences, IModelDisplayReferences2d, LinkIModel2dArgs, LinkIModelArgs, LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "../IModelDisplayOverrides";
import { ModelDisplayTransformProvider, ViewState, ViewState2d } from "../ViewState";
import { createIModelDisplayOverrides, createSpatialIModelDisplayOverrides } from "./IModelDisplayOverridesImpl";
import { SpatialViewState } from "../SpatialViewState";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { IModelApp } from "../core-frontend";

abstract class LinkedIModelRef implements IModelDisplayReference {
  readonly [_implementationProhibited] = undefined;

  #alwaysDrawnExclusive = false;
  readonly #excludedElements: Set<Id64String>;
  #resolvedViewFlags: ViewFlags;
  #modelDisplayTransformProvider?: ModelDisplayTransformProvider;

  protected readonly _refs: IModelDisplayReferences;
  protected readonly _ovrs: IModelDisplayOverrides;
  protected readonly _view: ViewState;

  protected readonly _subcategories = new SubCategoriesCache.Queue();

  public readonly iModel;
  public readonly viewedCategories = new ObservableSet<Id64String>();

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly featureOverrideProviders = new ObservableSet<FeatureOverrideProvider>();

  public readonly subCategoryOverrides = new ObservableMap<Id64String, SubCategoryOverride>;
  public readonly modelAppearanceOverrides = new ObservableMap<Id64String, FeatureAppearance>;

  public readonly [_scheduleScriptReference] = undefined; // ###TODO

  public get [_mapImagery]() {
    return this._view.displayStyle.settings.mapImagery;
  }

  public readonly onPerModelCategoryVisibilityChanged = new BeEvent<() => void>;
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>;
  public readonly onModelDisplayTransformProviderChanged = new BeEvent<() => void>;
  public readonly onActiveViewFlagsChanged = new BeEvent<() => void>();
  public readonly onActiveClipStyleChanged = new BeEvent<() => void>();

  public abstract readonly overrides: IModelDisplayOverrides;

  protected constructor(args: LinkIModelArgs, refs: IModelDisplayReferences, ovrs: IModelDisplayOverrides, view: ViewState) {
    this.iModel = args.iModel;
    this._refs = refs;
    this._ovrs = ovrs;
    this._view = view;

    this.#resolvedViewFlags = view.viewFlags.override(ovrs.viewFlags);
    this.#excludedElements = new Set<Id64String>(args.excludedElements ?? []);

    this.perModelCategoryVisibility = PerModelCategoryVisibility.Overrides.create({
      iModel: args.iModel,
      queue: this._refs.subcategories,
    });

    this.viewedCategories.addAll(args.viewedCategories ?? []);

    const updateViewFlags = () => {
      this.#resolvedViewFlags = view.viewFlags.override(this._ovrs.viewFlags);
      this.onActiveViewFlagsChanged.raiseEvent();
    };

    // ###TODO handle event listener cleanup...
    view.displayStyle.settings.onViewFlagsChanged.addListener(() => updateViewFlags());

    ovrs.onViewFlagsChanged.addListener(() => updateViewFlags);

    // ###TODO we gotta handle cases where somebody does view.displayStyle = someNewStyle too...
    // Which means we also gotta clean up these listeners when that happens so we're not listening to stale events
    // e.g. if the display style gets attached to a *different* view.
    // Nobody sane will do that, but our API allows it (I guess we're not sane).
    view.displayStyle.settings.onClipStyleChanged.addListener(() => {
      if (undefined === this._ovrs.clipStyle) {
        this.onActiveClipStyleChanged.raiseEvent();
      }
    });

    ovrs.onClipStyleChanged.addListener(() => this.onActiveClipStyleChanged.raiseEvent());
  }

  public isSpatial(): this is SpatialIModelDisplayReference { return false; }
  public is2d(): this is IModelDisplayReference2d { return false; }

  public get isLoadingComplete() {
    return false; // ###TODO
  }

  public get tileTreeRefs() {
    return []; // ###TODO
  }

  public get isAlwaysDrawnExclusive() {
    return this.#alwaysDrawnExclusive;
  }

  public set isAlwaysDrawnExclusive(exclusive: boolean) {
    if (exclusive !== this.#alwaysDrawnExclusive) {
      this.#alwaysDrawnExclusive = exclusive;
      this.onIsAlwaysDrawnExclusiveChanged.raiseEvent();
    }
  }

  public get modelDisplayTransformProvider() {
    return this.#modelDisplayTransformProvider;
  }

  public set modelDisplayTransformProvider(provider: ModelDisplayTransformProvider | undefined) {
    if (provider !== this.#modelDisplayTransformProvider) {
      this.#modelDisplayTransformProvider = provider;
      this.onModelDisplayTransformProviderChanged.raiseEvent();
    }
  }

  public get activeClipStyle() {
    return this.overrides.clipStyle ?? this._view.displayStyle.settings.clipStyle;
  }

  public get activeViewFlags() {
    return this.#resolvedViewFlags;
  }
}

class LinkedIModelRef2d extends LinkedIModelRef implements IModelDisplayReference2d {
  public readonly viewedModel: Id64String;

  public override get overrides() { return this._ovrs; }

  public constructor(args: LinkIModel2dArgs, refs: IModelDisplayReferences2d, view: ViewState) {
    super(args, refs, createIModelDisplayOverrides(args.overrides), view);
    this.viewedModel = args.viewedModel;
  }
}

class LinkedSpatialIModelRef extends LinkedIModelRef implements SpatialIModelDisplayReference {
  #modelClipGroups: ModelClipGroups;
  readonly #modelClips: Array<RenderClipVolume | undefined> = [];

  private get _spatialView() {
    return this._view as SpatialViewState;
  }

  public readonly viewedModels = new ObservableSet<Id64String>();
  public readonly planarClipMasks = new ObservableMap<Id64String, PlanarClipMaskSettings>();
  public readonly realityModelDisplaySettings = new ObservableMap<Id64String, RealityModelDisplaySettings>();
  public readonly planProjectionSettings = new ObservableMap<Id64String, PlanProjectionSettings>();

  public readonly onActiveHiddenLineSettingsChanged = new BeEvent<() => void>();
  public readonly onModelClipGroupsChanged = new BeEvent<() => void>();

  public override get overrides() {
    return this._ovrs as SpatialIModelDisplayOverrides;
  }

  public constructor(args: LinkSpatialIModelArgs, refs: SpatialIModelDisplayReferences, view: SpatialViewState) {
    super(args, refs, createSpatialIModelDisplayOverrides(args.overrides), view);
    this.#modelClipGroups = args.modelClipGroups ?? new ModelClipGroups();

    this.viewedModels.addAll(args.viewedModels ?? []);

    this.overrides.onHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent());

    view.displayStyle.settings.onHiddenLineSettingsChanged.addListener(() => {
      this.onActiveHiddenLineSettingsChanged.raiseEvent();
    });

    this.updateModelClips();
  }

  public get modelClipGroups() {
    return this.#modelClipGroups;
  }

  public set modelClipGroups(groups: ModelClipGroups) {
    this.#modelClipGroups = groups;
    this.onModelClipGroupsChanged.raiseEvent();
  }

  private updateModelClips(): void {
    this.#modelClips.length = 0;
    for (const group of this.modelClipGroups.groups) {
      const clip = group.clip ? IModelApp.renderSystem.createClipVolume(group.clip) : undefined;
      this.#modelClips.push(clip);
    }
  }

  public [_getModelClip](modelId: Id64String) {
    // Comment from ViewState3d.getModelClip:
    // ###TODO: ViewFlags.clipVolume is for the *view clip* only. Some tiles will want to ignore *all* clips (i.e., section-cut tiles).
    const index = this.modelClipGroups.findGroupIndex(modelId);
    return -1 !== index ? this.#modelClips[index] : undefined;
  }

  public get activeHiddenLineSettings() {
    return this.overrides.hiddenLineSettings ?? this._spatialView.displayStyle.settings.hiddenLineSettings;
  }
}

export function createLinkedIModelDisplayReference2d(refs: IModelDisplayReferences2d, args: LinkIModel2dArgs, view: ViewState2d): IModelDisplayReference2d {
  return new LinkedIModelRef2d(args, refs, view);
}

export function createLinkedSpatialIModelDisplayReference(refs: SpatialIModelDisplayReferences, args: LinkSpatialIModelArgs, view: SpatialViewState): SpatialIModelDisplayReference {
  return new LinkedSpatialIModelRef(args, refs, view);
}
