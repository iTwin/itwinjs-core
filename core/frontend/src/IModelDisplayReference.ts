/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, compareStrings, GuidString, Id64, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { _attachToViewport, _detachFromViewport, _excludedElements, _getModelClip, _guid, _implementationProhibited, _scheduleScriptReference, _treeRefs } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { TileTreeReference } from "./tile/internal";
import { ClipStyle, FeatureAppearance, GeometryClass, HiddenLine, ModelClipGroups, ModelFeature, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, RenderSchedule, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "./PerModelCategoryVisibility";
import { FeatureOverrideProvider } from "./FeatureOverrideProvider";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "./IModelDisplayOverrides";
import { ModelDisplayTransformProvider } from "./ViewState";
import { AttachToViewportArgs, RenderClipVolume, SpatialTileTreeReferences } from "./core-frontend";
import { IModelDisplayReferences, IModelDisplayReferences2d, SpatialIModelDisplayReferences } from "./IModelDisplayReferences";
import { Transform } from "@itwin/core-geometry";

/** Describes a [Feature]($common) within the context of a specific iModel.
 * @beta
 */
export interface IModelFeature extends ModelFeature {
  iModelRef: IModelDisplayReference;
}

export namespace IModelFeature {
  export function compare(lhs: IModelFeature, rhs: IModelFeature): number {
    return ModelFeature.compare(lhs, rhs) || compareStrings(lhs.iModelRef[_guid], rhs.iModelRef[_guid]);
  }

  export function create(iModelRef: IModelDisplayReference): IModelFeature {
    return {
      modelId: Id64.invalid,
      elementId: Id64.invalid,
      subCategoryId: Id64.invalid,
      geometryClass: GeometryClass.Primary,
      iModelRef,
    };
  }
}

/** A reference to an [[IModelConnection]] for display and interaction within a [[Viewport]].
 * The reference describes what subset of the contents of the iModel to display and how to style
 * them.
 * @see [[IModelDisplayReferences]] to inspect and modify the iModels associated with a view.
 * @beta
 */
export interface IModelDisplayReference {
  readonly [_implementationProhibited]: unknown;

  // Chiefly used for sorting.
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

  // Elements permanently hidden when displaying this reference.
  // Kinda redundant with neverDrawnElements, but can't be changed after instantiation.
  // (See DisplayStyleSettings.excludedElementIds).
  readonly [_excludedElements]?: Iterable<Id64String>;
  readonly neverDrawnElements: ObservableSet<Id64String>;
  readonly alwaysDrawnElements: ObservableSet<Id64String>;
  isAlwaysDrawnExclusive: boolean;
  readonly onIsAlwaysDrawnExclusiveChanged: BeEvent<() => void>;

  // App-supplied providers that apply symbology overrides when displaying this reference.
  readonly featureOverrideProviders: ObservableSet<FeatureOverrideProvider>;

  modelDisplayTransformProvider: ModelDisplayTransformProvider | undefined;
  readonly onModelDisplayTransformProviderChanged: BeEvent<() => void>;

  // ###TODO get/set scheduleScript with changed event
  // People may have schedule scripts they want to apply to multiple iModels in the view,
  // but I expect they'll have to break them down per-iModel.
  // There should only be a single time point for the entire view though.
  readonly [_scheduleScriptReference]: RenderSchedule.ScriptReference | undefined;

  /** Overrides aspects of the view's display style when displaying this reference. */
  readonly overrides: IModelDisplayOverrides;

  /** Returns the clip style that applies to this reference, which may differ from that applied to the
   * view as a whole if overridden by [[overrides]].
   */
  readonly activeClipStyle: ClipStyle;
  readonly onActiveClipStyleChanged: BeEvent<() => void>;

  /** Returns the view flags that apply to this reference, which may differ from those applied to the
   * view as a whole if overridden by [[overrides]].
   */
  readonly activeViewFlags: ViewFlags;
  readonly onActiveViewFlagsChanged: BeEvent<() => void>;

  readonly [_attachToViewport]: (args: AttachToViewportArgs) => void;
  readonly [_detachFromViewport]: () => void;
}

/** A reference to a drawing or sheet.
 * Not fully fleshed out yet. Use cases for linked drawings/sheets TBD - but we need it for the primary iModel reference anyway.
 * @beta
 */
export interface IModelDisplayReference2d extends IModelDisplayReference {
  readonly parent: IModelDisplayReferences2d;

  readonly viewedModel: Id64String;
}

/** A reference to any number of spatial models within an iModel.
 * @beta
 */
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

