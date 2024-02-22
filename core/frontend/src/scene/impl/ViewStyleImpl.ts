/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String, OrderedId64Iterable, assert } from "@itwin/core-bentley";
import {
  FeatureAppearance, PlanProjectionSettings, PlanarClipMaskSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlags,
} from "@itwin/core-common";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../../DisplayStyleState";
import { IViewStyle, View2dStyle, View3dStyle } from "../ViewStyle";

export abstract class ViewStyleImpl implements IViewStyle {
  protected constructor(protected readonly _style: DisplayStyleState) { }

  get viewFlags() { return this._style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this._style.viewFlags = flags; }

  get planarClipMasks() { return this._style.planarClipMasks; }
  get subCategoryOverrides() { return this._style.subCategoryOverrides; }
  get modelAppearanceOverrides() { return this._style.modelAppearanceOverrides; }

  getRealityModelDisplaySettings(modelId: Id64String) { return this._style.getRealityModelDisplaySettings(modelId); }
  setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined) {
    this._style.setRealityModelDisplaySettings(modelId, settings);
  }

  get excludedElementIds() { return this._style.excludedElementIds; }
  addExcludedElements(id: Id64String | Iterable<Id64String>) { this._style.addExcludedElements(id); }
  dropExcludedElement(id: Id64String) { this._style.dropExcludedElement(id); }
  dropExcludedElements(id: Id64String | Iterable<Id64String>) { this._style.dropExcludedElements(id); }
  clearExcludedElements() { this._style.clearExcludedElements(); }
}

export class View2dStyleImpl extends ViewStyleImpl implements View2dStyle {
  readonly is2dStyle: true = true;

  constructor(style: DisplayStyle2dState) {
    super(style);
  }
}

export class View3dStyleImpl extends ViewStyleImpl implements View3dStyle {
  readonly is3dStyle: true = true;

  private get _style3d() { return this._style as DisplayStyle3dState; }

  constructor(style: DisplayStyle3dState) {
    super(style);
  }

  get planProjectionSettings() { return this._style3d.planProjectionSettings; }
  getPlanProjectionSettings(modelId: Id64String) { return this._style3d.getPlanProjectionSettings(modelId); }

  setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined) {
    this._style3d.setPlanProjectionSettings(modelId, settings);
  }
}
