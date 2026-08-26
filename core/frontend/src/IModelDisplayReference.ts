/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { _implementationProhibited } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { TileTreeReference } from "./tile/internal";
import { ClipStyle, FeatureAppearance, HiddenLine, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "./PerModelCategoryVisibility";
import { FeatureOverrideProvider } from "./FeatureOverrideProvider";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "./IModelDisplayOverrides";

export interface IModelDisplayReference {
  readonly [_implementationProhibited]: unknown;

  readonly iModel: IModelConnection;
  readonly viewedCategories: ObservableSet<Id64String>;

  readonly isSpatial: () => this is SpatialIModelDisplayReference;
  readonly is2d: () => this is IModelDisplayReference2d;

  readonly isLoadingComplete: boolean;
  readonly tileTreeRefs: Iterable<TileTreeReference>;

  // ###TODO renderTimeline, scheduleScriptProps

  readonly subCategoryOverrides: ObservableMap<Id64String, SubCategoryOverride>;
  readonly modelAppearanceOverrides: ObservableMap<Id64String, FeatureAppearance>;

  readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;

  readonly neverDrawnElements: ObservableSet<Id64String>;
  readonly alwaysDrawnElements: ObservableSet<Id64String>;
  isAlwaysDrawnExclusive: boolean;
  readonly onIsAlwaysDrawnExclusiveChanged: BeEvent<() => void>;

  readonly featureOverrideProviders: ObservableSet<FeatureOverrideProvider>;

  readonly overrides: IModelDisplayOverrides;

  readonly activeClipStyle: ClipStyle;
  readonly onActiveClipStyleChanged: BeEvent<() => void>;

  readonly activeViewFlags: ViewFlags;
  readonly onActiveViewFlagsChanged: BeEvent<() => void>;
}

export interface IModelDisplayReference2d extends IModelDisplayReference {
  readonly viewedModel: Id64String;
}

export interface SpatialIModelDisplayReference extends IModelDisplayReference {
  readonly viewedModels: ObservableSet<Id64String>;

  readonly planarClipMasks: ObservableMap<Id64String, PlanarClipMaskSettings>;
  readonly realityModelDisplaySettings: ObservableMap<Id64String, RealityModelDisplaySettings>;

  // ###TODO contour settings - they refer to elements by Id.

  readonly planProjectionSettings: ObservableMap<Id64String, PlanProjectionSettings>;

  modelClipGroups: ModelClipGroups;
  readonly onModelClipGroupsChanged: BeEvent<() => void>;

  readonly overrides: SpatialIModelDisplayOverrides;

  readonly activeHiddenLineSettings: HiddenLine.Settings;
  readonly onActiveHiddenLineSettingsChanged: BeEvent<() => void>;
}

