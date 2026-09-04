/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ModelClipGroups, ViewFlags } from "@itwin/core-common";
import { _attachToViewport, _backingView, _detachFromViewport, _excludedElements, _getModelClip, _guid, _implementationProhibited, _scheduleScriptReference, _treeRefs } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { AttachToViewportArgs, ModelDisplayTransformProvider, ViewState, ViewState2d } from "../ViewState";
import { BeEvent, Guid, Id64String, ObservableSet } from "@itwin/core-bentley";
import { SpatialViewState } from "../SpatialViewState";
import { FeatureOverrideProvider } from "../FeatureOverrideProvider";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { IModelDisplayReferences, IModelDisplayReferences2d, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "../IModelDisplayOverrides";
import { createIModelDisplayOverrides, createSpatialIModelDisplayOverrides } from "./IModelDisplayOverridesImpl";
import { SpatialTileTreeReferences } from "./cross-package";
import { TileTreeReference } from "../tile/internal";
import { Transform } from "@itwin/core-geometry";

abstract class PrimaryIModelRef implements IModelDisplayReference {
  readonly [_implementationProhibited] = undefined;

  #alwaysDrawnExclusive = false;
  #resolvedViewFlags: ViewFlags;

  protected readonly _ovrs: IModelDisplayOverrides;

  protected abstract get _view(): ViewState;

  public abstract readonly parent: IModelDisplayReferences;
  public abstract readonly overrides: IModelDisplayOverrides;

  public readonly [_guid]: string;
  public readonly linearTransformToParent = Transform.identity;

  public get [_excludedElements]() { return this._view.displayStyle.settings.excludedElementIds; }

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly featureOverrideProviders = new ObservableSet<FeatureOverrideProvider>();

  public readonly onViewFlagOverridesChanged = new BeEvent<() => void>;
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>;
  public readonly onModelDisplayTransformProviderChanged = new BeEvent<() => void>;
  public readonly onClipStyleChanged = new BeEvent<() => void>;
  public readonly onActiveViewFlagsChanged = new BeEvent<() => void>();
  public readonly onActiveClipStyleChanged = new BeEvent<() => void>();

  public constructor(refs: IModelDisplayReferences, ovrs: IModelDisplayOverrides) {
    this._ovrs = ovrs;
    this[_guid] = Guid.createValue();

    const view = refs[_backingView];

    this.#resolvedViewFlags = view.viewFlags.override(ovrs.viewFlags);

    this.perModelCategoryVisibility = PerModelCategoryVisibility.Overrides.create({
      iModel: view.iModel,
      queue: refs.subcategories,
    });

    const updateViewFlags = () => {
      this.#resolvedViewFlags = this._view.viewFlags.override(this.overrides.viewFlags);
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
      if (undefined === this.overrides.clipStyle) {
        this.onActiveClipStyleChanged.raiseEvent();
      }
    });

    ovrs.onClipStyleChanged.addListener(() => this.onActiveClipStyleChanged.raiseEvent());

    view.onModelDisplayTransformProviderChanged.addListener(() => this.onModelDisplayTransformProviderChanged.raiseEvent());
  }

  public get iModel() { return this._view.iModel; }
  public get viewedCategories() { return this._view.categorySelector.observableCategories; }

  public isSpatial(): this is SpatialIModelDisplayReference { return false; }
  public is2d(): this is IModelDisplayReference2d { return false }

  public get isLoadingComplete() { return this._view.areAllTileTreesLoaded; }
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

  [_attachToViewport](_args: AttachToViewportArgs): void { }
  [_detachFromViewport](): void { }
}

class PrimaryIModelRef2d extends PrimaryIModelRef implements IModelDisplayReference2d {
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
  }

  public override is2d(): this is IModelDisplayReference2d {
    return true;
  }

  public override get tileTreeRefs() {
    return []; // ###TODO
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

  public constructor(refs: SpatialIModelDisplayReferences) {
    super(refs, createSpatialIModelDisplayOverrides());
    this.parent = refs;

    this[_treeRefs] = SpatialTileTreeReferences.create(this);

    this._view.details.onModelClipGroupsChanged.addListener(
      () => this.onModelClipGroupsChanged.raiseEvent()
    );

    this.overrides.onHiddenLineSettingsChanged.addListener(() => this.onActiveHiddenLineSettingsChanged.raiseEvent());

    this._view.displayStyle.settings.onHiddenLineSettingsChanged.addListener(() => {
      this.onActiveHiddenLineSettingsChanged.raiseEvent();
    });
  }

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
    // ###TODO
    return this._view.displayStyle.settings.planProjectionSettings as unknown as any;
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

  public get activeHiddenLineSettings() {
    return this.overrides.hiddenLineSettings ?? this._view.displayStyle.settings.hiddenLineSettings;
  }

  public override [_attachToViewport](args: AttachToViewportArgs): void {
    super[_attachToViewport](args);
    this[_treeRefs].attachToViewport(args);
  }

  public override [_detachFromViewport](): void {
    this[_treeRefs].detachFromViewport();
    super[_detachFromViewport]();
  }
}

export function createPrimaryIModelDisplayReference2d(refs: IModelDisplayReferences2d): IModelDisplayReference2d {
  return new PrimaryIModelRef2d(refs);
}

export function createPrimarySpatialIModelDisplayReference(refs: SpatialIModelDisplayReferences): SpatialIModelDisplayReference {
  return new PrimarySpatialIModelRef(refs);
}
