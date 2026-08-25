/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { FeatureAppearance, HiddenLine, ModelClipGroups, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlagOverrides } from "@itwin/core-common";
import { _implementationProhibited } from "./common/internal/Symbols";
import { BeEvent, Id64String, ObservableMap } from "@itwin/core-bentley";

export interface IModelDisplaySettings {
  readonly [_implementationProhibited]: unknown;

  readonly is3d: () => this is IModelDisplaySettings3d;

  viewFlagOverrides: ViewFlagOverrides;
  ignoreClipStyle: boolean;

  readonly subCategoryOverrides: ObservableMap<Id64String, SubCategoryOverride>;
  readonly modelAppearanceOverrides: ObservableMap<Id64String, FeatureAppearance>;

  // renderTimeLine, scheduleScriptProps

  readonly onIgnoreClipStyleChanged: BeEvent<() => void>;
  readonly onViewFlagOverridesChanged: BeEvent<() => void>;
}

export interface IModelDisplaySettings3d extends IModelDisplaySettings {
  readonly planarClipMasks: ObservableMap<Id64String, PlanarClipMaskSettings>;
  readonly realityModelDisplaySettings: ObservableMap<Id64String, RealityModelDisplaySettings>;

  hiddenLineSettings: HiddenLine.Settings | undefined;
  readonly planProjectionSettings: ObservableMap<Id64String, PlanProjectionSettings>;
  modelClipGroups: ModelClipGroups;

  // contours

  readonly onHiddenLineSettingsChanged: BeEvent<() => void>;
  readonly onModelClipGroupsChanged: BeEvent<() => void>;
}
