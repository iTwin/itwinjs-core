/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import {
  FeatureAppearance, PlanarClipMaskSettings, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlags,
} from "@itwin/core-common";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../../DisplayStyleState";
import { BaseViewStyle, View2dStyle, View3dStyle } from "../ViewStyle";
import { ViewState, ViewState2d, ViewState3d } from "../../ViewState";

export abstract class ViewStyleImpl implements BaseViewStyle {
  protected _style: DisplayStyleState;

  protected constructor(view: ViewState) {
    this._style = view.displayStyle;

    view.onDisplayStyleChanged.addListener((style) => this._style = style);
  }

  get viewFlags() { return this._style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this._style.viewFlags = flags; }

  get planarClipMasks() { return this._style.settings.planarClipMasks; }
  get subCategoryOverrides() { return this._style.settings.subCategoryOverrides; }
  get modelAppearanceOverrides() { return this._style.settings.modelAppearanceOverrides; }

  getRealityModelDisplaySettings(modelId: Id64String) { return this._style.settings.getRealityModelDisplaySettings(modelId); }
  setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined) {
    this._style.settings.setRealityModelDisplaySettings(modelId, settings);
  }

  get excludedElementIds() { return this._style.settings.excludedElementIds; }
  addExcludedElements(id: Id64String | Iterable<Id64String>) { this._style.settings.addExcludedElements(id); }
  dropExcludedElement(id: Id64String) { this._style.settings.dropExcludedElement(id); }
  dropExcludedElements(id: Id64String | Iterable<Id64String>) { this._style.settings.dropExcludedElements(id); }
  clearExcludedElements() { this._style.settings.clearExcludedElements(); }
}

export class View2dStyleImpl extends ViewStyleImpl implements View2dStyle {
  readonly is2d: true = true;

  constructor(view: ViewState2d) {
    super(view);
  }
}

export class View3dStyleImpl extends ViewStyleImpl implements View3dStyle {
  readonly is3d: true = true;

  private get _style3d() { return this._style as DisplayStyle3dState; }

  constructor(view: ViewState3d) {
    super(view);
  }

  get planProjectionSettings() { return this._style3d.settings.planProjectionSettings; }
  getPlanProjectionSettings(modelId: Id64String) { return this._style3d.settings.getPlanProjectionSettings(modelId); }

  setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined) {
    this._style3d.settings.setPlanProjectionSettings(modelId, settings);
  }
}
