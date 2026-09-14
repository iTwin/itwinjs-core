/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, compareStrings, GuidString, Id64, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { _attachToViewport, _detachFromViewport, _excludedElements, _getModelClip, _implementationProhibited, _scheduleScriptReference, _treeRefs } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { SpatialTileTreeReferences, TileTreeReference } from "./tile/internal";
import { ClipStyle, FeatureAppearance, GeometryClass, HiddenLine, ModelClipGroups, ModelFeature, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, RenderSchedule, SubCategoryAppearance, SubCategoryOverride, ViewFlags } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "./PerModelCategoryVisibility";
import { FeatureSymbologyOverrider } from "./FeatureOverrideProvider";
import { IModelDisplayOverrides, SpatialIModelDisplayOverrides } from "./IModelDisplayOverrides";
import { AttachToViewportArgs, ModelDisplayTransformProvider } from "./ViewState";
import { IModelDisplayReferences, IModelDisplayReferences2d, SpatialIModelDisplayReferences } from "./IModelDisplayReferences";
import { Transform } from "@itwin/core-geometry";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { RenderClipVolume } from "./render/RenderClipVolume";

/** Describes a [Feature]($common) within the context of a specific iModel.
 * @beta
 */
export interface IModelDisplayFeature extends ModelFeature {
  /** The iModel reference through which this feature was drawn. */
  iModelRef: IModelDisplayReference;
}

export namespace IModelDisplayFeature {
  /** Serves as an [OrderedComparator]($bentley) for a pair of [[IModelDiplayFeature]]s. */
  export function compare(lhs: IModelDisplayFeature, rhs: IModelDisplayFeature): number {
    return ModelFeature.compare(lhs, rhs) || compareStrings(lhs.iModelRef.guid, rhs.iModelRef.guid);
  }

  /** Create an `IModelDisplayFeature` of [GeometryClass.Primary]($common) belonging to `iModelRef` with all invalid Ids.
   * This is primarily useful for creating a reusable `IModelDisplayFeature` object.
   */
  export function create(iModelRef: IModelDisplayReference): IModelDisplayFeature {
    return {
      modelId: Id64.invalid,
      elementId: Id64.invalid,
      subCategoryId: Id64.invalid,
      geometryClass: GeometryClass.Primary,
      iModelRef,
    };
  }
}

/** Arguments supplied to [[IModelDisplayReference.changeCategoryDisplay]].
 * @beta
 */
export interface ChangeCategoryDisplayArgs {
  /** The set of categories whose visibility is to be changed. */
  categories: Iterable<Id64String>
  /** Whether the [[categories]] should be visible or hidden. */
  display: boolean;
  /** If both this and [[display]] are `true`, every [SubCategory]($backend) belonging to any [Category]($backend) in [[categories]]
   * will also be made visible.
   */
  enableAllSubCategories?: boolean;
  /** @internal */
  noBatchNotify?: boolean;
}

/** A reference to an [[IModelConnection]] for display and interaction within a [[Viewport]].
 * The reference describes what subset of the contents of the iModel to display and how to style
 * them.
 * @see [[IModelDisplayReferences]] to inspect and modify the iModels associated with a view.
 * @beta
 */
export interface IModelDisplayReference {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** A unique identifier automatically assigned upon construction. Chiefly useful for sorting collections. */
  readonly guid: GuidString;
  /** The iModel displayed by this reference. */
  readonly iModel: IModelConnection;
  /** The collection of iModel references to which this reference belongs. */
  readonly parent: IModelDisplayReferences;
  /** A transform from the coordinate system of this [[iModel]] to that of the view's primary iModel. */
  readonly linearTransformToParent: Transform;
  /** The set of categories that are visible when displaying this reference. */
  readonly viewedCategories: ObservableSet<Id64String>;
  /** Event dispatched when any asynchronous loading of categories initiated by a change to [[viewedCategories]] completes. */
  readonly onViewedCategoriesLoaded: BeEvent<() => void>;

  /** Permits applications to distinguish between spatial and 2d references. */
  readonly isSpatial: () => this is SpatialIModelDisplayReference;
  /** Permits applications to distinguish between spatial and 2d references. */
  readonly is2d: () => this is IModelDisplayReference2d;

  /** Returns true if all of the data (e.g., [[TileTree]]s) needed to display this reference has been loaded. */
  readonly isLoadingComplete: boolean;
  /** The set of tile trees displayed through this reference. */
  readonly tileTreeRefs: Iterable<TileTreeReference>;

  /** Overrides the appearance of specific subcategories. */
  readonly subCategoryOverrides: ObservableMap<Id64String, SubCategoryOverride>;
  /** Overrides the appearance of specific models. */
  readonly modelAppearanceOverrides: ObservableMap<Id64String, FeatureAppearance>;

  /** Allows visibility of categories within this viewport to be overridden on a per-model basis. */
  readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;

  /* Elements permanently hidden when displaying this reference.
   * Kinda redundant with neverDrawnElements, but can't be changed after instantiation.
   * (See DisplayStyleSettings.excludedElementIds).
   * @internal
   */
  readonly [_excludedElements]?: Iterable<Id64String>;

  readonly neverDrawnElements: ObservableSet<Id64String>;
  /** Elements which should always be rendered by this reference, regardless of category and subcategory visibility.
   * If [[isAlwaysDrawnExclusive]] is set to `true` then **only** those elements in this set will be drawn.
   * @note The [[neverDrawnElements]] set takes precedence - if an element is present in both sets, it is never drawn.
   */
  readonly alwaysDrawnElements: ObservableSet<Id64String>;

  /** If `true`, the elements in [[alwaysDrawnElements]] are the **only** elements displayed by this reference. */
  isAlwaysDrawnExclusive: boolean;
  /** Event dispatched when the value of [[isAlwaysDrawnExclusive]] changes. */
  readonly onIsAlwaysDrawnExclusiveChanged: BeEvent<() => void>;

  /* App-supplied providers that apply symbology overrides when displaying this reference.
   * Whenever the state of your provider changes such that the symbology overrides need to be recalculated,
   * invoke [[invalidateSymbologyOverrides]].
   */
  readonly featureOverrideProviders: ObservableSet<FeatureSymbologyOverrider>;
  /** @internal don't think anybody outside core-frontend should need to access this. */
  getSymbologyOverrides(): FeatureSymbology.Overrides;
  /** Marks this reference's symbology overrides as out of date so that they can be recalculated from its
   * [[featureOverrideProviders]] next time it is drawn.
   */
  invalidateSymbologyOverrides(): void;
  /** Event dispatched by [[invalidateSymbologyOverrides]]. */
  readonly onSymbologyOverridesInvalidated: BeEvent<() => void>;

  /** Applies a [[ModelDisplayTransform]] to model(s) displayed by this reference. */
  modelDisplayTransformProvider: ModelDisplayTransformProvider | undefined;
  /** Event dispatched immediately after assignment to [[modelDisplayTransformProvider]]. */
  readonly onModelDisplayTransformProviderChanged: BeEvent<() => void>;

  // ###TODO get/set scheduleScript with changed event
  // People may have schedule scripts they want to apply to multiple iModels in the view,
  // but I expect they'll have to break them down per-iModel.
  // There should only be a single time point for the entire view though.
  /** @internal */
  readonly [_scheduleScriptReference]: RenderSchedule.ScriptReference | undefined;

  /** Overrides aspects of the view's display style when displaying this reference. */
  readonly overrides: IModelDisplayOverrides;

  /** Returns the clip style that applies to this reference, which may differ from that applied to the
   * view as a whole if overridden by [[overrides]].
   */
  readonly activeClipStyle: ClipStyle;
  /** Event dispatched just after [[activeClipStyle]] changes. */
  readonly onActiveClipStyleChanged: BeEvent<() => void>;

  /** Returns the view flags that apply to this reference, which may differ from those applied to the
   * view as a whole if overridden by [[overrides]].
   */
  readonly activeViewFlags: ViewFlags;
  /** Event dispatched just after [[activeViewFlags]] changes. */
  readonly onActiveViewFlagsChanged: BeEvent<() => void>;

  /** @internal */
  readonly [_attachToViewport]: (args: AttachToViewportArgs) => void;
  /** @internal */
  readonly [_detachFromViewport]: () => void;

  /** Modify the visibility of categories displayed by this reference. */
  changeCategoryDisplay(args: ChangeCategoryDisplayArgs): void;
  /** Returns true if geometry belonging to the specified [SubCategory]($backend) is visible when displaying this reference. */
  isSubCategoryVisible(id: Id64String): boolean;
  /** Changes the visibility of geometry belonging to the specified [SubCategory]($backend). */
  changeSubCategoryDisplay(id: Id64String, visible: boolean): void;
  /** Returns a description of how geometry belonging to the specified [SubCategory]($backend) appears when displayed through this reference. */
  getSubCategoryAppearance(id: Id64String): SubCategoryAppearance;
}

/** A reference to a drawing or sheet model.
 * @beta
 */
export interface IModelDisplayReference2d extends IModelDisplayReference {
  /** The collection of iModel references to which this reference belongs. */
  readonly parent: IModelDisplayReferences2d;

  /** The Id of the [GeometricModel2d]($backend) displayed by this reference. */
  readonly viewedModel: Id64String;
}

/** A reference to any number of spatial models within an iModel.
 * @beta
 */
export interface SpatialIModelDisplayReference extends IModelDisplayReference {
  /** The collection of iModel references to which this reference belongs. */
  readonly parent: SpatialIModelDisplayReferences;

  /** The set of models that are visible when displayed through this reference. */
  readonly viewedModels: ObservableSet<Id64String>;
  /** Event dispatched after any asynchronous loading of models initiated by a change to [[viewedModels]] completes. */
  readonly onViewedModelsLoaded: BeEvent<() => void>;

  /** Planar clip masks applied to persistent reality models (@see [[SpatialModelState.isRealityModel]]) when
   * displayed through this reference.
   * The key for each entry is the Id of the model to which the mask settings apply.
   */
  readonly planarClipMasks: ObservableMap<Id64String, PlanarClipMaskSettings>;
  /** Specifies how persistent reality models (@see [[SpatialModelState.isRealityModel]]) are styled when
   * displayed through this reference.
   * The key for each entry is the Id of the model to which the settings apply.
   */
  readonly realityModelDisplaySettings: ObservableMap<Id64String, RealityModelDisplaySettings>;

  // ###TODO contour settings - they refer to elements by Id.

  /** Maps the Ids of plan projection models within this reference to a description of how they should be displayed. */
  readonly planProjectionSettings: ObservableMap<Id64String, PlanProjectionSettings>;

  /** Clip volumes to be applied to groups of models when displayed through the linked [[SpatialIModelDisplayReference]]. */
  modelClipGroups: ModelClipGroups;
  /** Event dispatched just after assignment to [[modelClipGroups]]. */
  readonly onModelClipGroupsChanged: BeEvent<() => void>;
  /** @internal */
  [_getModelClip](modelId: Id64String): RenderClipVolume | undefined;

  /** Overrides aspects of the view's display style when displaying this reference. */
  readonly overrides: SpatialIModelDisplayOverrides;

  /** @internal */
  readonly [_treeRefs]: SpatialTileTreeReferences;

  /** Returns the hidden line settings that apply to this reference, which may differ from that applied to the
   * view as a whole if overridden by [[overrides]].
   */
  readonly activeHiddenLineSettings: HiddenLine.Settings;
  /** Event dispatched just after [[activeHiddenLineSettings]] changes. */
  readonly onActiveHiddenLineSettingsChanged: BeEvent<() => void>;

  /** Adds the specified models to [[viewedModels]] and returns a promise that resolves
   * once the models have been fully loaded.
   */
  addAndLoadViewedModels(modelIds: Iterable<Id64String>): Promise<void>;
}

