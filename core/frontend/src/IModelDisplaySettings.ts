/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { FeatureAppearance, HiddenLine, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlagOverrides } from "@itwin/core-common";
import { _implementationProhibited } from "./common/internal/Symbols";
import { Id64String, ObservableMap } from "@itwin/core-bentley";
import { ClipVector } from "@itwin/core-geometry";

export interface IModelDisplaySettings {
  readonly [_implementationProhibited]: unknown;

  readonly is3d: () => this is IModelDisplaySettings3d;

  viewFlagOverrides: ViewFlagOverrides;
  ignoreClipStyle: boolean;

  clipVector: ClipVector | undefined;

  readonly subCategoryOverrides: ObservableMap<Id64String, SubCategoryOverride>;
  readonly modelAppearanceOverrides: ObservableMap<Id64String, FeatureAppearance>;

  // renderTimeLine, scheduleScriptProps
  // set/commitScheduleEditing?

  // changed events
}

export interface IModelDisplaySettings3d extends IModelDisplaySettings {
  readonly planarClipMasks: ObservableMap<Id64String, PlanarClipMaskSettings>;
  readonly realityModelDisplaySettings: ObservableMap<Id64String, RealityModelDisplaySettings>;

  hiddenLineSettings: HiddenLine.Settings | undefined;
  readonly planProjectionSettings: ObservableMap<Id64String, PlanProjectionSettings>;
  readonly modelClipGroups: ModelClipGroups;

  // contours
  // changed events
}
