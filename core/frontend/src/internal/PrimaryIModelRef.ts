/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { DisplayStyleSettings, ModelClipGroups, SubCategoryAppearance, ViewFlags } from "@itwin/core-common";
import { _attachToViewport, _backingView, _detachFromViewport, _excludedElements, _getModelClip, _getPlanarClipMaskState, _implementationProhibited, _invalidateTileTreeRef, _scheduleScriptReference, _treeRefs } from "../common/internal/Symbols";
import { ChangeCategoryDisplayArgs, IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { AttachToViewportArgs, ModelDisplayTransformProvider, ViewState, ViewState2d } from "../ViewState";
import { BeEvent, Guid, Id64String, ObservableSet } from "@itwin/core-bentley";
import { SpatialViewState } from "../SpatialViewState";
import { IModelDisplayReferenceFeatureOverrideProvider } from "../FeatureOverrideProvider";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { IModelDisplayReferences, IModelDisplayReferences2d, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "../IModelDisplayOverrides";
import { createIModelDisplayOverrides, createSpatialIModelDisplayOverrides } from "./IModelDisplayOverridesImpl";
import { SpatialTileTreeReferences, TileTreeReference } from "../tile/internal";
import { Transform } from "@itwin/core-geometry";
import { FeatureSymbology } from "../render/FeatureSymbology";
import type { DisplayStyleState } from "../DisplayStyleState";
import { addAndLoadViewedModels, changeCategoryDisplay, changeSubCategoryDisplay, getSubCategoryAppearance, isLoadingComplete, isSubCategoryVisible, listenForSubCategoryChanges, loadViewedCategories, loadViewedModels } from "./IModelDisplayReferenceImpl";

abstract class PrimaryIModelRef implements IModelDisplayReference {
  public readonly [_implementationProhibited] = undefined;

  #alwaysDrawnExclusive = false;
  #resolvedViewFlags: ViewFlags;
  #symbologyOverrides?: FeatureSymbology.Overrides;
  #removeSubCategoryChangesListener?: () => void;

  // The view's display style and category selector can be replaced wholesale. Listeners registered on those objects (or
  // objects they own) are tracked so they can be rebound to the replacement.
  #boundStyleSettings: DisplayStyleSettings;
  readonly #styleListenerRemovals: VoidFunction[] = [];
  readonly #styleListenerBinders: Array<(settings: DisplayStyleSettings) => VoidFunction[]> = [];
  #boundViewedCategories: ObservableSet<Id64String>;
  #removeViewedCategoriesListener: VoidFunction;
  readonly #viewedCategoriesChanged = () => {
    this.invalidateSymbologyOverrides();
    void loadViewedCategories(this);
  };

  protected readonly _ovrs: IModelDisplayOverrides;

  protected abstract get _view(): ViewState;

  public abstract readonly parent: IModelDisplayReferences;
  public abstract readonly overrides: IModelDisplayOverrides;

  public readonly guid: string;
  public readonly linearTransformToParent = Transform.identity;

  public get [_excludedElements]() { return this._view.displayStyle.settings.excludedElementIds; }

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly featureOverrideProviders = new ObservableSet<IModelDisplayReferenceFeatureOverrideProvider>();

  public readonly onViewFlagOverridesChanged = new BeEvent<() => void>;
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>;
  public readonly onModelDisplayTransformProviderChanged = new BeEvent<() => void>;
  public readonly onClipStyleChanged = new BeEvent<() => void>;
  public readonly onActiveViewFlagsChanged = new BeEvent<() => void>();
  public readonly onActiveClipStyleChanged = new BeEvent<() => void>();
  public readonly onViewedCategoriesLoaded = new BeEvent<() => void>();

  public constructor(refs: IModelDisplayReferences, ovrs: IModelDisplayOverrides) {
    this._ovrs = ovrs;
    this.guid = Guid.createValue();

    const view = refs[_backingView];

    this.#resolvedViewFlags = view.viewFlags.override(ovrs.viewFlags);

    this.perModelCategoryVisibility = PerModelCategoryVisibility.Overrides.create({
      iModel: view.iModel,
      queue: refs.subcategories,
    });

    this.perModelCategoryVisibility.onChanged.addListener(() => {
      this.invalidateSymbologyOverrides();
    });

    const updateViewFlags = () => {
      this.#resolvedViewFlags = this._view.viewFlags.override(this.overrides.viewFlags);
      // Cached symbology overrides bake in geometry-class visibility and line weights from the active view flags.
      this.invalidateSymbologyOverrides();
      this.onActiveViewFlagsChanged.raiseEvent();
    };

    this.#boundStyleSettings = view.displayStyle.settings;
    this._addStyleListenerBinder((settings) => [
      settings.onAfterViewFlagsChanged.addListener(() => updateViewFlags()),
      settings.onAfterClipStyleChanged.addListener(() => {
        if (undefined === this.overrides.clipStyle) {
          this.onActiveClipStyleChanged.raiseEvent();
        }
      }),
    ]);

    view.onDisplayStyleChanged.addListener((newStyle) => this.#displayStyleReplaced(newStyle));

    this.#boundViewedCategories = view.categorySelector.observableCategories;
    this.#removeViewedCategoriesListener = this.#boundViewedCategories.onChanged.addListener(this.#viewedCategoriesChanged);
    view.onViewedCategoriesChanged.addListener(() => this.#syncViewedCategoriesBinding());

    ovrs.onViewFlagsChanged.addListener(updateViewFlags);

    ovrs.onClipStyleChanged.addListener(() => this.onActiveClipStyleChanged.raiseEvent());

    view.onAfterModelDisplayTransformProviderChanged.addListener(() => this.onModelDisplayTransformProviderChanged.raiseEvent());

    this.featureOverrideProviders.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.neverDrawnElements.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.alwaysDrawnElements.onChanged.addListener(() => this.invalidateSymbologyOverrides());
    this.onIsAlwaysDrawnExclusiveChanged.addListener(() => this.invalidateSymbologyOverrides());
    this._ovrs.onDefaultFeatureAppearanceChanged.addListener(() => this.invalidateSymbologyOverrides());
    refs.onDefaultFeatureAppearanceChanged.addListener(() => {
      if (undefined === this._ovrs.defaultFeatureAppearance)
        this.invalidateSymbologyOverrides();
    });
  }

  /** Registers listeners on the view's current display style settings, re-registering them whenever the style is replaced. */
  protected _addStyleListenerBinder(binder: (settings: DisplayStyleSettings) => VoidFunction[]): void {
    this.#styleListenerBinders.push(binder);
    this.#styleListenerRemovals.push(...binder(this.#boundStyleSettings));
  }

  #displayStyleReplaced(newStyle: DisplayStyleState): void {
    this.#boundStyleSettings = newStyle.settings;
    for (const removeListener of this.#styleListenerRemovals)
      removeListener();

    this.#styleListenerRemovals.length = 0;
    for (const binder of this.#styleListenerBinders)
      this.#styleListenerRemovals.push(...binder(newStyle.settings));

    this._onDisplayStyleReplaced(newStyle);
  }

  /** Refreshes state derived from the display style after the style is replaced. Subclasses must call super. */
  protected _onDisplayStyleReplaced(newStyle: DisplayStyleState): void {
    this.#resolvedViewFlags = newStyle.viewFlags.override(this.overrides.viewFlags);
    this.onActiveViewFlagsChanged.raiseEvent();
    if (undefined === this.overrides.clipStyle)
      this.onActiveClipStyleChanged.raiseEvent();

    this.invalidateSymbologyOverrides();
  }

  #syncViewedCategoriesBinding(): void {
    const current = this._view.categorySelector.observableCategories;
    if (current === this.#boundViewedCategories)
      return;

    this.#removeViewedCategoriesListener();
    this.#boundViewedCategories = current;
    this.#removeViewedCategoriesListener = current.onChanged.addListener(this.#viewedCategoriesChanged);
    this.#viewedCategoriesChanged();
  }

  public get iModel() { return this._view.iModel; }
  public get viewedCategories() { return this._view.categorySelector.observableCategories; }

  public isSpatial(): this is SpatialIModelDisplayReference { return false; }
  public is2d(): this is IModelDisplayReference2d { return false }

  public get isLoadingComplete(): boolean {
    return isLoadingComplete(this);
  }

  public abstract get tileTreeRefs(): Iterable<TileTreeReference>;

  public get subCategoryOverrides() {
    return this._view.displayStyle.settings.subCategoryOverrides;
  }

  public get modelAppearanceOverrides() {
    return this._view.displayStyle.settings.modelAppearanceOverrides;
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

  public get [_scheduleScriptReference]() {
    return this._view[_scheduleScriptReference];
  }

  public get modelDisplayTransformProvider() {
    return this._view.modelDisplayTransformProvider;
  }

  public set modelDisplayTransformProvider(provider: ModelDisplayTransformProvider | undefined) {
    this._view.modelDisplayTransformProvider = provider;
  }

  public get activeClipStyle() {
    return this.overrides.clipStyle ?? this._view.displayStyle.settings.clipStyle;
  }

  public get activeViewFlags() {
    return this.#resolvedViewFlags;
  }

  public [_attachToViewport](_args: AttachToViewportArgs): void {
    this.#removeSubCategoryChangesListener ??= listenForSubCategoryChanges(this);

    // The display style or category selector may have been replaced while the view was detached, in which case no events
    // were raised - rebind now.
    const style = this._view.displayStyle;
    if (style.settings !== this.#boundStyleSettings)
      this.#displayStyleReplaced(style);

    this.#syncViewedCategoriesBinding();
  }
  public [_detachFromViewport](): void {
    this.#removeSubCategoryChangesListener?.();
    this.#removeSubCategoryChangesListener = undefined;
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
}

class PrimaryIModelRef2d extends PrimaryIModelRef implements IModelDisplayReference2d {
  private _treeRef?: TileTreeReference;

  protected override get _view(): ViewState2d {
    return this.parent[_backingView];
  }

  public readonly parent: IModelDisplayReferences2d;
  public override get overrides() {
    return this._ovrs;
  }

  public constructor(refs: IModelDisplayReferences2d) {
    super(refs, createIModelDisplayOverrides());
    this.parent = refs;

    this.overrides.onClipStyleChanged.addListener(() => this.onActiveClipStyleChanged.raiseEvent());

    void loadViewedCategories(this);
  }

  public override is2d(): this is IModelDisplayReference2d {
    return true;
  }

  public override get tileTreeRefs() {
    if (undefined === this._treeRef) {
      const model = this._view.getViewedModel();
      if (undefined !== model)
        this._treeRef = model.createTileTreeReference(this);
    }

    return undefined !== this._treeRef ? [this._treeRef] : [];
  }

  public [_invalidateTileTreeRef](): void {
    this._treeRef = undefined;
  }

  public get viewedModel() {
    return this._view.baseModelId;
  }
}

class PrimarySpatialIModelRef extends PrimaryIModelRef implements SpatialIModelDisplayReference {
  protected override get _view(): SpatialViewState {
    return this.parent[_backingView];
  }

  public readonly parent: SpatialIModelDisplayReferences;

  public readonly [_treeRefs]: SpatialTileTreeReferences;

  public override get overrides() {
    return this._ovrs as SpatialIModelDisplayOverrides;
  }

  public readonly onModelClipGroupsChanged = new BeEvent<() => void>();
  public readonly onActiveHiddenLineSettingsChanged = new BeEvent<() => void>();
  public readonly onActiveContoursChanged = new BeEvent<() => void>();
  public readonly onViewedModelsLoaded = new BeEvent<() => void>();

  #boundViewedModels?: ObservableSet<Id64String>;
  #removeViewedModelsListener?: VoidFunction;
  readonly #viewedModelsChanged = () => {
    void loadViewedModels(this);
  };

  public constructor(refs: SpatialIModelDisplayReferences) {
    super(refs, createSpatialIModelDisplayOverrides());
    this.parent = refs;

    this[_treeRefs] = SpatialTileTreeReferences.create(this);

    this._view.details.onAfterModelClipGroupsChanged.addListener(
      () => this.onModelClipGroupsChanged.raiseEvent()
    );

    this.overrides.onHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent());
    this.overrides.onContoursChanged.addListener(() => this.onActiveContoursChanged.raiseEvent());

    this._addStyleListenerBinder((settings) => {
      const removals = [
        settings.onAfterHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent()),
        settings.onContoursChanged.addListener(() => this.onActiveContoursChanged.raiseEvent()),
        // Cached symbology overrides bake in plan-projection transparency. The map's onChanged covers direct map
        // mutations, which do not raise onPlanProjectionSettingsChanged; the latter covers setPlanProjectionSettings.
        settings.onPlanProjectionSettingsChanged.addListener(() => this.invalidateSymbologyOverrides()),
      ];

      if (settings.is3d())
        removals.push(settings.planProjectionSettings.onChanged.addListener(() => this.invalidateSymbologyOverrides()));

      return removals;
    });

    void loadViewedCategories(this);

    void loadViewedModels(this);
    this.#boundViewedModels = this.viewedModels;
    this.#removeViewedModelsListener = this.#boundViewedModels.onChanged.addListener(this.#viewedModelsChanged);
    this._view.onViewedModelsChanged.addListener(() => this.#syncViewedModelsBinding());
  }

  protected override _onDisplayStyleReplaced(newStyle: DisplayStyleState): void {
    super._onDisplayStyleReplaced(newStyle);
    this.onActiveHiddenLineSettingsChanged.raiseEvent();
    this.onActiveContoursChanged.raiseEvent();
  }

  #syncViewedModelsBinding(): void {
    const current = this.viewedModels;
    if (current === this.#boundViewedModels)
      return;

    this.#removeViewedModelsListener?.();
    this.#boundViewedModels = current;
    this.#removeViewedModelsListener = current.onChanged.addListener(this.#viewedModelsChanged);
    this.#viewedModelsChanged();
  }

  public override [_attachToViewport](args: AttachToViewportArgs): void {
    super[_attachToViewport](args);

    // The model selector may have been replaced while the view was detached, in which case no events were raised - rebind now.
    this.#syncViewedModelsBinding();

    this[_treeRefs].attachToViewport(args);
  }

  public override isSpatial(): this is SpatialIModelDisplayReference { return true; }

  public override get tileTreeRefs(): Iterable<TileTreeReference> {
    return this[_treeRefs];
  }

  public get viewedModels() {
    return this._view.modelSelector.observableModels;
  }

  public get planarClipMasks() {
    return this._view.displayStyle.settings.planarClipMasks;
  }

  public get realityModelDisplaySettings() {
    return this._view.displayStyle.settings.realityModelDisplaySettings;
  }

  public get planProjectionSettings() {
    return this._view.displayStyle.settings.planProjectionSettings;
  }

  public get modelClipGroups() {
    return this._view.details.modelClipGroups;
  }

  public set modelClipGroups(groups: ModelClipGroups) {
    this._view.details.modelClipGroups = groups;
  }

  public [_getModelClip](modelId: Id64String) {
    return this._view.getModelClip(modelId);
  }

  public [_getPlanarClipMaskState](modelId: Id64String) {
    return this._view.displayStyle.getPlanarClipMaskState(modelId);
  }

  public get activeHiddenLineSettings() {
    return this.overrides.hiddenLineSettings ?? this._view.displayStyle.settings.hiddenLineSettings;
  }

  public get activeContours() {
    return this.overrides.contours ?? this._view.displayStyle.settings.contours;
  }

  public override[_detachFromViewport](): void {
    this[_treeRefs].detachFromViewport();
    super[_detachFromViewport]();
  }

  public async addAndLoadViewedModels(modelIds: Iterable<Id64String>): Promise<void> {
    return addAndLoadViewedModels(this, modelIds);
  }
}

export function createPrimaryIModelDisplayReference2d(refs: IModelDisplayReferences2d): IModelDisplayReference2d {
  return new PrimaryIModelRef2d(refs);
}

export function createPrimarySpatialIModelDisplayReference(refs: SpatialIModelDisplayReferences): SpatialIModelDisplayReference {
  return new PrimarySpatialIModelRef(refs);
}
