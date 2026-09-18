/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { FeatureAppearance, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryAppearance, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { _attachToViewport, _backingView, _detachFromViewport, _excludedElements, _getModelClip, _implementationProhibited, _scheduleScriptReference, _treeRefs } from "../common/internal/Symbols";
import { ChangeCategoryDisplayArgs, IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { BeEvent, Guid, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { FeatureSymbologyOverrider } from "../FeatureOverrideProvider";
import { LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { SpatialIModelDisplayOverrides } from "../IModelDisplayOverrides";
import { AttachToViewportArgs, ModelDisplayTransformProvider } from "../ViewState";
import { createSpatialIModelDisplayOverrides } from "./IModelDisplayOverridesImpl";
import { SpatialViewState } from "../SpatialViewState";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { SpatialTileTreeReferences, TileTreeReference } from "../tile/internal";
import { Transform } from "@itwin/core-geometry";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { IModelApp } from "../IModelApp";
import { addAndLoadViewedModels, changeCategoryDisplay, changeSubCategoryDisplay, getSubCategoryAppearance, isLoadingComplete, isSubCategoryVisible, listenForSubCategoryChanges, loadViewedCategories, loadViewedModels } from "./IModelDisplayReferenceImpl";

class LinkedSpatialIModelRef implements SpatialIModelDisplayReference {
  readonly [_implementationProhibited] = undefined;

  readonly #disposalFunctions: Array<() => void> = [];
  readonly #modelClips: Array<RenderClipVolume | undefined> = [];

  #alwaysDrawnExclusive = false;
  #resolvedViewFlags: ViewFlags;
  #modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  #symbologyOverrides?: FeatureSymbology.Overrides;
  #modelClipGroups: ModelClipGroups;

  get #spatialView() {
    return this.parent[_backingView];
  }

  public readonly parent: SpatialIModelDisplayReferences;
  public readonly [_treeRefs]: SpatialTileTreeReferences;
  public get tileTreeRefs(): Iterable<TileTreeReference> { return this[_treeRefs]; }

  public readonly guid: string;
  public readonly iModel;
  public readonly linearTransformToParent: Transform;
  public readonly viewedCategories = new ObservableSet<Id64String>();

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  public readonly [_excludedElements]?: Iterable<Id64String>;
  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly featureOverrideProviders = new ObservableSet<FeatureSymbologyOverrider>();

  public readonly subCategoryOverrides = new ObservableMap<Id64String, SubCategoryOverride>;
  public readonly modelAppearanceOverrides = new ObservableMap<Id64String, FeatureAppearance>;

  public readonly [_scheduleScriptReference] = undefined; // ###TODO

  public readonly onPerModelCategoryVisibilityChanged = new BeEvent<() => void>;
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>;
  public readonly onModelDisplayTransformProviderChanged = new BeEvent<() => void>;
  public readonly onActiveViewFlagsChanged = new BeEvent<() => void>();
  public readonly onActiveClipStyleChanged = new BeEvent<() => void>();
  public readonly onViewedCategoriesLoaded = new BeEvent<() => void>();

  public readonly overrides: SpatialIModelDisplayOverrides;

  public readonly viewedModels = new ObservableSet<Id64String>();
  public readonly planarClipMasks = new ObservableMap<Id64String, PlanarClipMaskSettings>();
  public readonly realityModelDisplaySettings = new ObservableMap<Id64String, RealityModelDisplaySettings>();
  public readonly planProjectionSettings = new ObservableMap<Id64String, PlanProjectionSettings>();

  public readonly onActiveHiddenLineSettingsChanged = new BeEvent<() => void>();
  public readonly onModelClipGroupsChanged = new BeEvent<() => void>();
  public readonly onViewedModelsLoaded = new BeEvent<() => void>();

  public constructor(args: LinkSpatialIModelArgs, refs: SpatialIModelDisplayReferences) {
    this.iModel = args.iModel;
    this.overrides = createSpatialIModelDisplayOverrides(args.overrides);
    this.guid = Guid.createValue();

    const view = refs[_backingView];
    this.#resolvedViewFlags = view.viewFlags.override(this.overrides.viewFlags);
    if (args.excludedElements)
      this[_excludedElements] = new Set<Id64String>(args.excludedElements);

    let linearTf;
    if (this.iModel.ecefLocation?.isValid && refs.primary.iModel.ecefLocation?.isValid) {
      const toEcef = this.iModel.ecefLocation.getTransform();
      const parentTf = refs.primary.iModel.getEcefTransform().inverse();
      if (parentTf)
        linearTf = parentTf.multiplyTransformTransform(toEcef);
    }

    this.linearTransformToParent = linearTf ?? Transform.identity;

    this.perModelCategoryVisibility = PerModelCategoryVisibility.Overrides.create({
      iModel: args.iModel,
      queue: refs.subcategories,
    });

    this.perModelCategoryVisibility.onChanged.addListener(() => {
      this.invalidateSymbologyOverrides();
      this.onViewedCategoriesLoaded.raiseEvent();
    });

    this.viewedCategories.addAll(args.viewedCategories ?? []);
    loadViewedCategories(this);
    this.viewedCategories.onChanged.addListener(async () => {
      this.invalidateSymbologyOverrides();
      loadViewedCategories(this);
    });

    const updateViewFlags = () => {
      this.#resolvedViewFlags = view.viewFlags.override(this.overrides.viewFlags);
      this.onActiveViewFlagsChanged.raiseEvent();
    };

    // ###TODO handle event listener cleanup...
    view.displayStyle.settings.onAfterViewFlagsChanged.addListener(() => updateViewFlags());

    this.overrides.onViewFlagsChanged.addListener(() => updateViewFlags);

    view.displayStyle.settings.onAfterClipStyleChanged.addListener(() => {
      if (undefined === this.overrides.clipStyle) {
        this.onActiveClipStyleChanged.raiseEvent();
      }
    });

    this.overrides.onClipStyleChanged.addListener(() => this.onActiveClipStyleChanged.raiseEvent());

    this.featureOverrideProviders.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    // ###TODO when viewed models/categories change.

    this.#disposalFunctions.push(listenForSubCategoryChanges(this));

    refs.onUnlinked.addOnce((ref: IModelDisplayReference) => {
      if (ref === this) {
        this.#dispose();
      }
    });

    this.parent = refs;
    this[_treeRefs] = SpatialTileTreeReferences.create(this);

    this.#modelClipGroups = args.modelClipGroups ?? new ModelClipGroups();

    this.viewedModels.addAll(args.viewedModels ?? []);
    loadViewedModels(this);
    this.viewedModels.onChanged.addListener(async () => loadViewedModels(this));

    this.overrides.onHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent());

    refs[_backingView].displayStyle.settings.onAfterHiddenLineSettingsChanged.addListener(() => {
      this.onActiveHiddenLineSettingsChanged.raiseEvent();
    });

    this.#updateModelClips();
  }

  #dispose(): void {
    for (const disposalFunction of this.#disposalFunctions)
      disposalFunction();

    this.#disposalFunctions.length = 0;

    this.onPerModelCategoryVisibilityChanged.clear();
    this.onIsAlwaysDrawnExclusiveChanged.clear();
    this.onModelDisplayTransformProviderChanged.clear();
    this.onActiveViewFlagsChanged.clear();
    this.onActiveClipStyleChanged.clear();
    this.onViewedCategoriesLoaded.clear();
    this.onSymbologyOverridesInvalidated.clear();

    this.viewedCategories.clearEventListeners();
    this.perModelCategoryVisibility.onChanged.clear();
    this.neverDrawnElements.onChanged.clear();
    this.alwaysDrawnElements.onChanged.clear();
    this.featureOverrideProviders.clearEventListeners();
    this.subCategoryOverrides.onChanged.clear();
    this.modelAppearanceOverrides.onChanged.clear();

    this.overrides.onViewFlagsChanged.clear();
    this.overrides.onClipStyleChanged.clear();

    this.onActiveClipStyleChanged.clear();
    this.onModelClipGroupsChanged.clear();
    this.onViewedModelsLoaded.clear();

    this.viewedModels.clearEventListeners();
    this.planarClipMasks.onChanged.clear();
    this.realityModelDisplaySettings.clear();
    this.planProjectionSettings.clear();

    this.overrides.onHiddenLineSettingsChanged.clear();
  }

  public isSpatial(): this is SpatialIModelDisplayReference { return true; }
  public is2d(): this is IModelDisplayReference2d { return false; }

  public get isLoadingComplete(): boolean {
    return isLoadingComplete(this);
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
    return this.overrides.clipStyle ?? this.parent[_backingView].displayStyle.settings.clipStyle;
  }

  public get activeViewFlags() {
    return this.#resolvedViewFlags;
  }

  public getSymbologyOverrides(): FeatureSymbology.Overrides {
    if (!this.#symbologyOverrides) {
      this.#symbologyOverrides = new FeatureSymbology.Overrides();
      this.#symbologyOverrides.initFromIModelDisplayReference(this);
    }

    return this.#symbologyOverrides;
  }

  public readonly onSymbologyOverridesInvalidated = new BeEvent<() => void>();

  public invalidateSymbologyOverrides(): void {
    this.#symbologyOverrides = undefined;
    this.onSymbologyOverridesInvalidated.raiseEvent();
  }

  public changeCategoryDisplay(args: ChangeCategoryDisplayArgs): void {
    changeCategoryDisplay(this, args);
  }

  public isSubCategoryVisible(id: Id64String): boolean {
    return isSubCategoryVisible(this, id);
  }

  public changeSubCategoryDisplay(id: Id64String, visible: boolean): boolean {
    return changeSubCategoryDisplay(this, id, visible);
  }

  public getSubCategoryAppearance(id: Id64String): SubCategoryAppearance {
    return getSubCategoryAppearance(this, id);
  }

  public get modelClipGroups() {
    return this.#modelClipGroups;
  }

  public set modelClipGroups(groups: ModelClipGroups) {
    this.#modelClipGroups = groups;
    this.onModelClipGroupsChanged.raiseEvent();
  }

  #updateModelClips(): void {
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
    return this.overrides.hiddenLineSettings ?? this.#spatialView.displayStyle.settings.hiddenLineSettings;
  }

  public [_attachToViewport](args: AttachToViewportArgs): void {
    this[_treeRefs].attachToViewport(args);
  }

  public [_detachFromViewport](): void {
    this[_treeRefs].detachFromViewport();
  }

  public async addAndLoadViewedModels(modelIds: Iterable<Id64String>): Promise<void> {
    return addAndLoadViewedModels(this, modelIds);
  }
}

export function createLinkedSpatialIModelDisplayReference(refs: SpatialIModelDisplayReferences, args: LinkSpatialIModelArgs): SpatialIModelDisplayReference {
  return new LinkedSpatialIModelRef(args, refs);
}
