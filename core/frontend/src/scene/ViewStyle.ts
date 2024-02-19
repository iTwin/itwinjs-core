/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String, OrderedId64Iterable, assert } from "@itwin/core-bentley";
import {
  FeatureAppearance, PlanProjectionSettings, PlanarClipMaskSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlags,
} from "@itwin/core-common";
import { view2dStyleFromDisplayStyle2dState, view3dStyleFromDisplayStyle3dState } from "./impl/ViewStyleImpl";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../DisplayStyleState";

/** ###TODO optional properties have no effect. shadows, clipVolume, lighting, and thematicDisplay can't be enabled if they are globally disabled, I think.
 */
export type ViewStyleFlags = ViewFlags; // Optional<ViewFlagsProperties, "acsTriad" | "grid" | "backgroundMap" | "ambientOcclusion">;

export interface IViewStyle {
  viewFlags: ViewStyleFlags;

  readonly planarClipMasks: Map<Id64String, PlanarClipMaskSettings>;

  // ###TODO renderTimeline Id and scheduleScriptProps

  readonly subCategoryOverrides: ReadonlyMap<Id64String, Readonly<SubCategoryOverride>>;  
  readonly modelAppearanceOverrides: ReadonlyMap<Id64String, Readonly<FeatureAppearance>>;  

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

export namespace ViewStyle {
  export function fromDisplayStyle2dState(style: DisplayStyle2dState): View2dStyle {
    return view2dStyleFromDisplayStyle2dState(style);
  }

  export function fromDisplayStyle3dState(style: DisplayStyle3dState): View3dStyle {
    return view3dStyleFromDisplayStyle3dState(style);
  }

  export function fromDisplayStyleState(style: DisplayStyleState): ViewStyle {
    if (style.is3d())
      return fromDisplayStyle3dState(style);

    assert(style instanceof DisplayStyle2dState);
    return fromDisplayStyle2dState(style);
  }
}
