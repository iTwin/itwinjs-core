/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { DisplayStyleSettings, FeatureAppearance, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryAppearance, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { _attachToViewport, _backingView, _detachFromViewport, _excludedElements, _getModelClip, _getPlanarClipMaskState, _implementationProhibited, _scheduleScriptReference, _treeRefs } from "../common/internal/Symbols";
import { ChangeCategoryDisplayArgs, IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { BeEvent, Guid, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { IModelDisplayReferenceFeatureOverrideProvider } from "../FeatureOverrideProvider";
import { LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { SpatialIModelDisplayOverrides } from "../IModelDisplayOverrides";
import { AttachToViewportArgs, ModelDisplayTransformProvider } from "../ViewState";
import { createSpatialIModelDisplayOverrides } from "./IModelDisplayOverridesImpl";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { PlanarClipMaskState } from "../PlanarClipMaskState";
import { SpatialTileTreeReferences, TileTreeReference } from "../tile/internal";
import { Transform } from "@itwin/core-geometry";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { IModelApp } from "../IModelApp";
import type { DisplayStyleState } from "../DisplayStyleState";
import { addAndLoadViewedModels, changeCategoryDisplay, changeSubCategoryDisplay, getSubCategoryAppearance, isLoadingComplete, isSubCategoryVisible, listenForSubCategoryChanges, loadViewedCategories, loadViewedModels } from "./IModelDisplayReferenceImpl";

class LinkedSpatialIModelRef implements SpatialIModelDisplayReference {
  public readonly [_implementationProhibited] = undefined;

  readonly #disposalFunctions: Array<() => void> = [];
  readonly #modelClips: Array<RenderClipVolume | undefined> = [];

  #alwaysDrawnExclusive = false;
  #resolvedViewFlags: ViewFlags;
  #modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  #symbologyOverrides?: FeatureSymbology.Overrides;
  #modelClipGroups: ModelClipGroups;
  #removeSubCategoryChangesListener?: () => void;
  readonly #planarClipMaskStates = new Map<Id64String, { settings: PlanarClipMaskSettings, state: PlanarClipMaskState }>();

  // The view's display style can be replaced wholesale. Listeners registered on its settings are tracked so they can be
  // rebound to the replacement.
  #boundStyleSettings: DisplayStyleSettings;
  readonly #styleListenerRemovals: VoidFunction[] = [];

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
  public readonly featureOverrideProviders = new ObservableSet<IModelDisplayReferenceFeatureOverrideProvider>();

  public readonly subCategoryOverrides = new ObservableMap<Id64String, SubCategoryOverride>;
  public readonly modelAppearanceOverrides = new ObservableMap<Id64String, FeatureAppearance>;

  // ###TODO When linked references support schedule scripts, Viewport's scheduleChanged handler must invalidate the cached
  // symbology overrides of every reference that has a script when the time point changes - today it invalidates only the primary's.
  public readonly [_scheduleScriptReference] = undefined;

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
  public readonly onActiveContoursChanged = new BeEvent<() => void>();
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
    void loadViewedCategories(this);
    this.viewedCategories.onChanged.addListener(() => {
      this.invalidateSymbologyOverrides();
      void loadViewedCategories(this);
    });

    this.#boundStyleSettings = view.displayStyle.settings;
    this.#bindStyleListeners(this.#boundStyleSettings);
    this.#disposalFunctions.push(view.onDisplayStyleChanged.addListener((newStyle) => this.#displayStyleReplaced(newStyle)));

    this.#disposalFunctions.push(this.overrides.onViewFlagsChanged.addListener(() => this.#updateViewFlags()));

    this.#disposalFunctions.push(this.overrides.onClipStyleChanged.addListener(() => this.onActiveClipStyleChanged.raiseEvent()));

    this.featureOverrideProviders.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.neverDrawnElements.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.alwaysDrawnElements.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.onIsAlwaysDrawnExclusiveChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.subCategoryOverrides.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.modelAppearanceOverrides.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    // Cached symbology overrides bake in plan-projection transparency.
    this.planProjectionSettings.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.#disposalFunctions.push(this.overrides.onDefaultFeatureAppearanceChanged.addListener(() => this.invalidateSymbologyOverrides()));
    this.#disposalFunctions.push(refs.onDefaultFeatureAppearanceChanged.addListener(() => {
      if (undefined === this.overrides.defaultFeatureAppearance)
        this.invalidateSymbologyOverrides();
    }));

    // Note: addOnce would remove the listener on the first unlink event even if it was raised for a *different* reference,
    // leaving this reference's subscriptions leaked - remove the listener only when this reference itself is unlinked.
    const removeUnlinkListener = refs.onUnlinked.addListener((ref: IModelDisplayReference) => {
      if (ref === this) {
        removeUnlinkListener();
        this.#dispose();
      }
    });

    this.parent = refs;

    // Initialize the state read by tile-tree reference collections before creating them - creation can be synchronous,
    // e.g., when a batched tileset spec for this iModel is already cached.
    this.#modelClipGroups = args.modelClipGroups ?? new ModelClipGroups();
    this.#updateModelClips();
    this.viewedModels.addAll(args.viewedModels ?? []);

    this[_treeRefs] = SpatialTileTreeReferences.create(this);

    void loadViewedModels(this);
    this.viewedModels.onChanged.addListener(() => {
      // Refresh the owning tile-reference collection - e.g., batched tile sets copy the viewed model Ids into the set
      // used for visibility and fit ranges - mirroring SpatialViewState.markModelSelectorChanged for the primary reference.
      this[_treeRefs].update();
      void loadViewedModels(this);
    });

    this.overrides.onHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent());
    this.#disposalFunctions.push(this.overrides.onContoursChanged.addListener(() => this.onActiveContoursChanged.raiseEvent()));
  }

  #updateViewFlags(): void {
    this.#resolvedViewFlags = this.#spatialView.viewFlags.override(this.overrides.viewFlags);
    // Cached symbology overrides bake in geometry-class visibility and line weights from the active view flags.
    this.invalidateSymbologyOverrides();
    this.onActiveViewFlagsChanged.raiseEvent();
  }

  /** Registers listeners on the supplied display style settings and records them as the currently-bound settings. */
  #bindStyleListeners(settings: DisplayStyleSettings): void {
    this.#boundStyleSettings = settings;
    this.#styleListenerRemovals.push(
      settings.onAfterViewFlagsChanged.addListener(() => this.#updateViewFlags()),
      settings.onAfterClipStyleChanged.addListener(() => {
        if (undefined === this.overrides.clipStyle)
          this.onActiveClipStyleChanged.raiseEvent();
      }),
      settings.onAfterHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent()),
      settings.onContoursChanged.addListener(() => this.onActiveContoursChanged.raiseEvent()),
    );
  }

  #unbindStyleListeners(): void {
    for (const removeListener of this.#styleListenerRemovals)
      removeListener();

    this.#styleListenerRemovals.length = 0;
  }

  /** Rebinds style listeners to the replacement style and refreshes state derived from it. */
  #displayStyleReplaced(newStyle: DisplayStyleState): void {
    this.#unbindStyleListeners();
    this.#bindStyleListeners(newStyle.settings);

    // Note: onDisplayStyleChanged is raised before the view's displayStyle property is reassigned - read flags from newStyle.
    this.#resolvedViewFlags = newStyle.viewFlags.override(this.overrides.viewFlags);
    this.invalidateSymbologyOverrides();
    this.onActiveViewFlagsChanged.raiseEvent();
    if (undefined === this.overrides.clipStyle)
      this.onActiveClipStyleChanged.raiseEvent();

    this.onActiveHiddenLineSettingsChanged.raiseEvent();
    this.onActiveContoursChanged.raiseEvent();
  }

  #dispose(): void {
    this.#removeSubCategoryChangesListener?.();
    this.#removeSubCategoryChangesListener = undefined;
    this.#planarClipMaskStates.clear();

    this.#unbindStyleListeners();

    for (const disposalFunction of this.#disposalFunctions)
      disposalFunction();

    this.#disposalFunctions.length = 0;

    this.onPerModelCategoryVisibilityChanged.clear();
    this.onIsAlwaysDrawnExclusiveChanged.clear();
    this.onModelDisplayTransformProviderChanged.clear();
    this.onActiveViewFlagsChanged.clear();
    this.onActiveClipStyleChanged.clear();
    this.onActiveContoursChanged.clear();
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
    this.overrides.onDefaultFeatureAppearanceChanged.clear();

    this.onActiveClipStyleChanged.clear();
    this.onModelClipGroupsChanged.clear();
    this.onViewedModelsLoaded.clear();

    this.viewedModels.clearEventListeners();
    this.planarClipMasks.onChanged.clear();
    this.realityModelDisplaySettings.clear();
    this.planProjectionSettings.onChanged.clear();

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
    // Rebuild the cached clip volumes before notifying listeners - _getModelClip indexes into #modelClips using the new groups.
    // Replaced RenderClipVolumes hold no unmanaged resources and are simply released, as in ViewState3d.updateModelClips.
    this.#updateModelClips();
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
    const index = this.modelClipGroups.findGroupIndex(modelId);
    return -1 !== index ? this.#modelClips[index] : undefined;
  }

  public [_getPlanarClipMaskState](modelId: Id64String): PlanarClipMaskState | undefined {
    const model = this.iModel.models.getLoaded(modelId)?.asSpatialModel;
    const settings = this.planarClipMasks.get(modelId);
    if (!model?.isRealityModel || !settings) {
      this.#planarClipMaskStates.delete(modelId);
      return undefined;
    }

    const cached = this.#planarClipMaskStates.get(modelId);
    if (cached?.settings === settings)
      return cached.state;

    const state = PlanarClipMaskState.create(settings);
    this.#planarClipMaskStates.set(modelId, { settings, state });
    return state;
  }

  public get activeHiddenLineSettings() {
    return this.overrides.hiddenLineSettings ?? this.#spatialView.displayStyle.settings.hiddenLineSettings;
  }

  public get activeContours() {
    return this.overrides.contours ?? this.#spatialView.displayStyle.settings.contours;
  }

  public [_attachToViewport](args: AttachToViewportArgs): void {
    this.#removeSubCategoryChangesListener ??= listenForSubCategoryChanges(this);

    // The display style may have been replaced while the view was detached, in which case no events were raised - rebind now.
    const style = this.#spatialView.displayStyle;
    if (style.settings !== this.#boundStyleSettings)
      this.#displayStyleReplaced(style);

    this[_treeRefs].attachToViewport(args);
  }

  public [_detachFromViewport](): void {
    this[_treeRefs].detachFromViewport();
    this.#removeSubCategoryChangesListener?.();
    this.#removeSubCategoryChangesListener = undefined;
  }

  public async addAndLoadViewedModels(modelIds: Iterable<Id64String>): Promise<void> {
    return addAndLoadViewedModels(this, modelIds);
  }
}

export function createLinkedSpatialIModelDisplayReference(refs: SpatialIModelDisplayReferences, args: LinkSpatialIModelArgs): SpatialIModelDisplayReference {
  return new LinkedSpatialIModelRef(args, refs);
}
