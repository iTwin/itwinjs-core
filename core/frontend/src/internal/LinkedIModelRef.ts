/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ClipStyle, FeatureAppearance, HiddenLine, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlagOverrides } from "@itwin/core-common";
import { _implementationProhibited } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { BeEvent, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { FeatureOverrideProvider } from "../FeatureOverrideProvider";
import { IModelDisplayReferences, IModelDisplayReferences2d, LinkIModel2dArgs, LinkIModelArgs, LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";

class LinkedIModelRef implements IModelDisplayReference {
  readonly [_implementationProhibited] = undefined;

  #viewFlagOverrides: ViewFlagOverrides;
  #alwaysDrawnExclusive = false;
  #clipStyle?: ClipStyle;
  readonly #excludedElements: Set<Id64String>;

  protected readonly _refs: IModelDisplayReferences;

  protected readonly _subcategories = new SubCategoriesCache.Queue();

  public readonly iModel;
  public readonly viewedCategories = new ObservableSet<Id64String>();

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly featureOverrideProviders = new ObservableSet<FeatureOverrideProvider>();

  public readonly subCategoryOverrides = new ObservableMap<Id64String, SubCategoryOverride>;
  public readonly modelAppearanceOverrides = new ObservableMap<Id64String, FeatureAppearance>;

  public readonly onViewFlagOverridesChanged = new BeEvent<() => void>;
  public readonly onPerModelCategoryVisibilityChanged = new BeEvent<() => void>;
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>;
  public readonly onClipStyleChanged = new BeEvent<() => void>;

  protected constructor(args: LinkIModelArgs, refs: IModelDisplayReferences) {
    this.iModel = args.iModel;
    this._refs = refs;
    this.perModelCategoryVisibility = PerModelCategoryVisibility.createOverrides({
      iModel: args.iModel,
      queue: this._refs.subcategories,
    });

    this.viewedCategories.addAll(args.viewedCategories ?? []);
    this.#excludedElements = new Set<Id64String>(args.excludedElements ?? []);
    this.#viewFlagOverrides = { ...args.viewFlagOverrides };
    this.#clipStyle = args.clipStyle;
  }

  public isSpatial(): this is SpatialIModelDisplayReference { return false; }
  public is2d(): this is IModelDisplayReference2d { return false; }

  public get isLoadingComplete() {
    return false; // ###TODO
  }

  public get tileTreeRefs() {
    return []; // ###TODO
  }

  public get viewFlagOverrides() {
    return this.#viewFlagOverrides;
  }

  public set viewFlagOverrides(ovrs: ViewFlagOverrides) {
    this.#viewFlagOverrides = ovrs;
    this.onViewFlagOverridesChanged.raiseEvent();
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
    if (style !== this.#clipStyle) {
      this.#clipStyle = style;
      this.onClipStyleChanged.raiseEvent();
    }
  }
}

class LinkedIModelRef2d extends LinkedIModelRef implements IModelDisplayReference2d {
  public readonly viewedModel: Id64String;

  public constructor(args: LinkIModel2dArgs, refs: IModelDisplayReferences2d) {
    super(args, refs);
    this.viewedModel = args.viewedModel;
  }
}

class LinkedSpatialIModelRef extends LinkedIModelRef implements SpatialIModelDisplayReference {
  #hline?: HiddenLine.Settings;
  #modelClipGroups: ModelClipGroups;

  public readonly viewedModels = new ObservableSet<Id64String>();
  public readonly planarClipMasks = new ObservableMap<Id64String, PlanarClipMaskSettings>();
  public readonly realityModelDisplaySettings = new ObservableMap<Id64String, RealityModelDisplaySettings>();
  public readonly planProjectionSettings = new ObservableMap<Id64String, PlanProjectionSettings>();

  public readonly onHiddenLineSettingsChanged = new BeEvent<() => void>();
  public readonly onModelClipGroupsChanged = new BeEvent<() => void>();

  public constructor(args: LinkSpatialIModelArgs, refs: SpatialIModelDisplayReferences) {
    super(args, refs);
    this.#hline = args.hiddenLineSettings;
    this.#modelClipGroups = args.modelClipGroups ?? new ModelClipGroups();

    this.viewedModels.addAll(args.viewedModels ?? []);
  }

  public get hiddenLineSettings() {
    return this.#hline;
  }

  public set hiddenLineSettings(hline: HiddenLine.Settings | undefined) {
    if (hline !== this.#hline) {
      this.#hline = hline;
      this.onHiddenLineSettingsChanged.raiseEvent();
    }
  }

  public get modelClipGroups() {
    return this.#modelClipGroups;
  }

  public set modelClipGroups(groups: ModelClipGroups) {
    this.#modelClipGroups = groups;
    this.onModelClipGroupsChanged.raiseEvent();
  }
}

export function createLinkedIModelDisplayReference2d(refs: IModelDisplayReferences2d, args: LinkIModel2dArgs): IModelDisplayReference2d {
  return new LinkedIModelRef2d(args, refs);
}

export function createLinkedSpatialIModelDisplayReference(refs: SpatialIModelDisplayReferences, args: LinkSpatialIModelArgs): SpatialIModelDisplayReference {
  return new LinkedSpatialIModelRef(args, refs);
}
