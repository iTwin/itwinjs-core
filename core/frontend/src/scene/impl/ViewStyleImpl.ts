/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String, OrderedId64Iterable, assert } from "@itwin/core-bentley";
import {
  FeatureAppearance, PlanProjectionSettings, PlanarClipMaskSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlagsProperties,
} from "@itwin/core-common";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../../DisplayStyleState";
import { IViewStyle, View2dStyle, View3dStyle, ViewStyleFlags } from "../ViewStyle";

class ViewDisplayStyle implements IViewStyle {
  protected readonly _style: DisplayStyleState;

  protected constructor(style: DisplayStyleState) {
    this._style = style;
  }

  get viewFlags(): ViewStyleFlags { return this._style.viewFlags; }
  set viewFlags(flags: ViewStyleFlags) { this._style.viewFlags = flags; }

  get planarClipMasks(): Map<Id64String, PlanarClipMaskSettings> { return this._style.settings.planarClipMasks; }
  get subCategoryOverrides() { return this._style.settings.subCategoryOverrides; }
  get modelAppearanceOverrides() { return this._style.settings.modelAppearanceOverrides; }

  getRealityModelDisplaySettings(modelId: Id64String) {
    return this._style.settings.getRealityModelDisplaySettings(modelId);
  }

  setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined) {
    this._style.settings.setRealityModelDisplaySettings(modelId, settings);
  }

  get excludedElementIds() { return this._style.settings.excludedElementIds; }
  addExcludedElements(id: Id64String | Iterable<Id64String>) { this._style.settings.addExcludedElements(id); }
  dropExcludedElement(id: Id64String) { this._style.settings.dropExcludedElement(id); }
  dropExcludedElements(id: Id64String | Iterable<Id64String>) { this._style.settings.dropExcludedElements(id); }
  clearExcludedElements() { this._style.settings.clearExcludedElements; }
}

class View2dDisplayStyle extends ViewDisplayStyle {
  public readonly is2d = true;

  public constructor(style: DisplayStyle2dState) {
    super(style);
  }
}

class View3dDisplayStyle extends ViewDisplayStyle {
  public readonly is3d = true;

  private get _style3d(): DisplayStyle3dState { return this._style as DisplayStyle3dState; }

  public constructor(style: DisplayStyle3dState) {
    super(style);
    assert(style instanceof DisplayStyle3dState);
  }

  get planProjectionSettings(): Iterable<[Id64String, PlanProjectionSettings]> | undefined {
    return this._style3d.settings.planProjectionSettings;
   }

  getPlanProjectionSettings(modelId: Id64String) {
    return this._style3d.settings.getPlanProjectionSettings(modelId);
  }

  setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined) {
    this._style3d.settings.setPlanProjectionSettings(modelId, settings);
  }
}

export function view2dStyleFromDisplayStyle2dState(style: DisplayStyle2dState): View2dStyle {
  return new View2dDisplayStyle(style);
}

export function view3dStyleFromDisplayStyle3dState(style: DisplayStyle3dState): View3dStyle {
  return new View3dDisplayStyle(style);
}
