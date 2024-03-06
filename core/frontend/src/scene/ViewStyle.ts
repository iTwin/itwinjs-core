/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import {
  FeatureAppearance, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlags,
} from "@itwin/core-common";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../DisplayStyleState";

/** ###TODO optional properties have no effect. shadows, clipVolume, lighting, and thematicDisplay can't be enabled if they are globally disabled, I think.
 */
export type ViewStyleFlags = ViewFlags; // Optional<ViewFlagsProperties, "acsTriad" | "grid" | "backgroundMap" | "ambientOcclusion">;

export interface IViewStyle {
  viewFlags: ViewStyleFlags;

  // Clip masks applied to persistent reality models.
  readonly planarClipMasks: Map<Id64String, PlanarClipMaskSettings>;

  // ###TODO renderTimeline Id and scheduleScriptProps

  readonly subCategoryOverrides: ReadonlyMap<Id64String, Readonly<SubCategoryOverride>>;
  readonly modelAppearanceOverrides: ReadonlyMap<Id64String, Readonly<FeatureAppearance>>;

  // For persistent reality models only.
  // ###TODO consolidate these into a Map a la subCategoryOverrides
  getRealityModelDisplaySettings(modelId: Id64String): RealityModelDisplaySettings | undefined;
  setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined): void;

  // ###TOOD consolidate these into a single object
  readonly excludedElementIds: OrderedId64Iterable;
  addExcludedElements(id: Id64String | Iterable<Id64String>): void;
  dropExcludedElement(id: Id64String): void;
  dropExcludedElements(id: Id64String | Iterable<Id64String>): void;
  clearExcludedElements(): void;
}

export interface View3dStyle extends IViewStyle {
  readonly is3d: true;
  readonly is2d?: never;

  // ###TODO permit Scene's HiddenLine.Settings to be overridden/replaced?

  getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
  setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined): void;
  readonly planProjectionSettings: Iterable<[Id64String, PlanProjectionSettings]> | undefined;
}

export interface View2dStyle extends IViewStyle {
  readonly is2d: true;
  readonly is3d?: never;
}

export type ViewStyle = View2dStyle | View3dStyle;

