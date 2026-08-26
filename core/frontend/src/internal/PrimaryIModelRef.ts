/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ClipStyle, HiddenLine, ModelClipGroups, ViewFlagOverrides } from "@itwin/core-common";
import { _implementationProhibited } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { ViewState, ViewState2d } from "../ViewState";
import { BeEvent, Id64String, ObservableSet } from "@itwin/core-bentley";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { SpatialViewState } from "../SpatialViewState";
import { FeatureOverrideProvider } from "../FeatureOverrideProvider";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";

abstract class PrimaryIModelRef implements IModelDisplayReference {
  readonly [_implementationProhibited] = undefined;

  #viewFlagOverrides: ViewFlagOverrides = { };
  #alwaysDrawnExclusive = false;
  #clipStyle?: ClipStyle;

  protected abstract get _view(): ViewState;
  protected readonly _subcategories = new SubCategoriesCache.Queue();

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly featureOverrideProviders = new ObservableSet<FeatureOverrideProvider>();

  public readonly onViewFlagOverridesChanged = new BeEvent<() => void>;
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>;
  public readonly onClipStyleChanged = new BeEvent<() => void>;

  public constructor(view: ViewState) {
    this.perModelCategoryVisibility = PerModelCategoryVisibility.createOverrides({
      iModel: view.iModel,
      queue: this._subcategories, // ###TODO should have one queue for all references?
    });
  }

  public get iModel() { return this._view.iModel; }
  public get viewedCategories() { return this._view.categorySelector.observableCategories; }

  public isSpatial(): this is SpatialIModelDisplayReference { return false; }
  public is2d(): this is IModelDisplayReference2d { return false }

  public get isLoadingComplete() { return this._view.areAllTileTreesLoaded; }
  public get tileTreeRefs() { return this._view.getTileTreeRefs(); }

  public get viewFlagOverrides() {
    return this.#viewFlagOverrides;
  }

  public set viewFlagOverrides(ovrs: ViewFlagOverrides) {
    this.#viewFlagOverrides = { ...ovrs };
    this.onViewFlagOverridesChanged.raiseEvent();
  }

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
  
  public get clipStyle() {
    return this.#clipStyle;
  }

  public set clipStyle(style: ClipStyle | undefined) {
    this.#clipStyle = style;
    this.onClipStyleChanged.raiseEvent();
  }
}

class PrimaryIModelRef2d extends PrimaryIModelRef implements IModelDisplayReference2d {
  #view: ViewState2d;

  protected override get _view(): ViewState2d {
    return this.#view;
  }

  public constructor(view: ViewState2d) {
    super(view);
    this.#view = view;
  }

  public override is2d(): this is IModelDisplayReference2d {
    return true;
  }

  public get viewedModel() {
    return this._view.baseModelId;
  }
}

class PrimarySpatialIModelRef extends PrimaryIModelRef implements SpatialIModelDisplayReference {
  #view: SpatialViewState;
  #hiddenLineSettings?: HiddenLine.Settings;

  protected override get _view(): SpatialViewState {
    return this.#view;
  }

  public readonly onHiddenLineSettingsChanged = new BeEvent<() => void>();
  public readonly onModelClipGroupsChanged = new BeEvent<() => void>();

  public constructor(view: SpatialViewState) {
    super(view);
    this.#view = view;

    view.details.onModelClipGroupsChanged.addListener(
      () => this.onModelClipGroupsChanged.raiseEvent()
    );
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

  public get hiddenLineSettings() {
    return this.#hiddenLineSettings;
  }

  public set hiddenLineSettings(hline: HiddenLine.Settings | undefined) {
    if (hline !== this.#hiddenLineSettings) {
      this.#hiddenLineSettings = hline;
      this.onHiddenLineSettingsChanged.raiseEvent();
    }
  }

  public get planProjectionSettings() {
    // ###TODO
    return this._view.displayStyle.settings.planProjectionSettings as unknown as any;
  }

  public get modelClipGroups() {
    return this._view.details.modelClipGroups;
  }

  public set modelClipGroups(groups: ModelClipGroups) {
    this._view.details.modelClipGroups = groups;
  }
}

export function createPrimaryIModelDisplayReference(view: ViewState2d | SpatialViewState): IModelDisplayReference {
  return view.is2d() ? new PrimaryIModelRef2d(view) : new PrimarySpatialIModelRef(view);
}
