/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { FeatureAppearance, PlanProjectionSettings, PlanarClipMaskSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlagsProperties } from "@itwin/core-common";

/** ###TODO optional properties have no effect. shadows, clipVolume, lighting, and thematicDisplay can't be enabled if they are globally disabled, I think.
 */
export type ViewStyleFlags = ViewFlagsProperties; // Optional<ViewFlagsProperties, "acsTriad" | "grid" | "backgroundMap" | "ambientOcclusion">;

export interface IViewStyle {
  viewFlags: ViewStyleFlags;

  planarClipMasks: Map<Id64String, PlanarClipMaskSettings>;

  // ###TODO renderTimeline Id and scheduleScriptProps

  overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void;  
  dropSubCategoryOverride(id: Id64String): void;  
  readonly subCategoryOverrides: ReadonlyMap<Id64String, Readonly<SubCategoryOverride>>;  
  getSubCategoryOverride(id: Id64String): Readonly<SubCategoryOverride> | undefined;  
  hasSubCategoryOverride(): boolean;

  overrideModelAppearance(id: Id64String, ovr: FeatureAppearance): void;  
  dropModelAppearanceOverride(id: Id64String): void;  
  readonly modelAppearanceOverrides: ReadonlyMap<Id64String, Readonly<FeatureAppearance>>;  
  getModelAppearanceOverride(id: Id64String): Readonly<FeatureAppearance> | undefined;  
  hasModelAppearanceOverride(): boolean;

  // For persistent reality models only.
  getRealityModelDisplaySettings(modelId: Id64String): RealityModelDisplaySettings | undefined;
  setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined): void;

  readonly excludedElementIds: OrderedId64Iterable;
  addExcludedElements(id: Id64String | Iterable<Id64String>): void;
  dropExcludedElement(id: Id64String): void;
  dropExcludedElements(id: Id64String | Iterable<Id64String>): void;
  clearExcludedElements(): void;
}

export interface View3dStyle extends IViewStyle {
  readonly is3d: true;
  is2d?: never;
  
  // ###TODO permit Scene's HiddenLine.Settings to be overridden/replaced?

  getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
  setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined): void;
  readonly planProjectionSettings: Iterable<[Id64String, PlanProjectionSettings]> | undefined;
}

export interface View2dStyle extends IViewStyle {
  readonly is2d: true;
  is3d?: never;
}

export type ViewStyle = View2dStyle | View3dStyle;
