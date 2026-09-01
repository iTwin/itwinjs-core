/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, compareStrings, GuidString, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { _attachToViewport, _detachFromViewport, _getModelClip, _guid, _implementationProhibited, _scheduleScriptReference, _treeRefs } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { TileTreeReference } from "./tile/internal";
import { ClipStyle, FeatureAppearance, HiddenLine, ModelClipGroups, ModelFeature, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, RenderSchedule, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "./PerModelCategoryVisibility";
import { FeatureOverrideProvider } from "./FeatureOverrideProvider";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "./IModelDisplayOverrides";
import { ModelDisplayTransformProvider } from "./ViewState";
import { AttachToViewportArgs, RenderClipVolume, SpatialTileTreeReferences } from "./core-frontend";
import { IModelDisplayReferences, IModelDisplayReferences2d, SpatialIModelDisplayReferences } from "./IModelDisplayReferences";
import { Transform } from "@itwin/core-geometry";

export interface IModelFeature extends ModelFeature {
  iModelRef: IModelDisplayReference;
}

export namespace IModelFeature {
  export function compare(lhs: IModelFeature, rhs: IModelFeature): number {
    return ModelFeature.compare(lhs, rhs) || compareStrings(lhs.iModelRef[_guid], rhs.iModelRef[_guid]);
  }
}

export interface IModelDisplayReference {
  readonly [_implementationProhibited]: unknown;

  readonly [_guid]: GuidString;
  readonly iModel: IModelConnection;
  readonly parent: IModelDisplayReferences;
  readonly linearTransformToParent: Transform;
  readonly viewedCategories: ObservableSet<Id64String>;

  readonly isSpatial: () => this is SpatialIModelDisplayReference;
  readonly is2d: () => this is IModelDisplayReference2d;

  readonly isLoadingComplete: boolean;
  readonly tileTreeRefs: Iterable<TileTreeReference>;

  readonly subCategoryOverrides: ObservableMap<Id64String, SubCategoryOverride>;
  readonly modelAppearanceOverrides: ObservableMap<Id64String, FeatureAppearance>;

  readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;

  readonly neverDrawnElements: ObservableSet<Id64String>;
  readonly alwaysDrawnElements: ObservableSet<Id64String>;
  isAlwaysDrawnExclusive: boolean;
  readonly onIsAlwaysDrawnExclusiveChanged: BeEvent<() => void>;

  readonly featureOverrideProviders: ObservableSet<FeatureOverrideProvider>;

  modelDisplayTransformProvider: ModelDisplayTransformProvider | undefined;
  readonly onModelDisplayTransformProviderChanged: BeEvent<() => void>;

  readonly [_scheduleScriptReference]: RenderSchedule.ScriptReference | undefined;
  // ###TODO get/set scheduleScript with changed event

  readonly overrides: IModelDisplayOverrides;

  readonly activeClipStyle: ClipStyle;
  readonly onActiveClipStyleChanged: BeEvent<() => void>;

  readonly activeViewFlags: ViewFlags;
  readonly onActiveViewFlagsChanged: BeEvent<() => void>;

  readonly [_attachToViewport]: (args: AttachToViewportArgs) => void;
  readonly [_detachFromViewport]: () => void;
}

export interface IModelDisplayReference2d extends IModelDisplayReference {
  readonly parent: IModelDisplayReferences2d;

  readonly viewedModel: Id64String;
}

export interface SpatialIModelDisplayReference extends IModelDisplayReference {
  readonly parent: SpatialIModelDisplayReferences;

  readonly viewedModels: ObservableSet<Id64String>;

  readonly planarClipMasks: ObservableMap<Id64String, PlanarClipMaskSettings>;
  readonly realityModelDisplaySettings: ObservableMap<Id64String, RealityModelDisplaySettings>;

  // ###TODO contour settings - they refer to elements by Id.

  readonly planProjectionSettings: ObservableMap<Id64String, PlanProjectionSettings>;

  modelClipGroups: ModelClipGroups;
  readonly onModelClipGroupsChanged: BeEvent<() => void>;
  [_getModelClip](modelId: Id64String): RenderClipVolume | undefined;

  readonly overrides: SpatialIModelDisplayOverrides;

  readonly [_treeRefs]: SpatialTileTreeReferences;

  readonly activeHiddenLineSettings: HiddenLine.Settings;
  readonly onActiveHiddenLineSettingsChanged: BeEvent<() => void>;
}

