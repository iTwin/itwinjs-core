/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { HiddenLine, ModelClipGroups, PlanProjectionSettings, ViewFlagOverrides } from "@itwin/core-common";
import { IModelDisplaySettings, IModelDisplaySettings3d } from "../IModelDisplaySettings";
import { ViewState, ViewState3d } from "../ViewState";
import { _implementationProhibited } from "./cross-package";
import { BeEvent, Id64String, ObservableMap } from "@itwin/core-bentley";

class IModelDisplaySettingsImpl implements IModelDisplaySettings {
  public readonly [_implementationProhibited] = undefined;

  #viewFlagOverrides: ViewFlagOverrides = { }

  public readonly onViewFlagOverridesChanged = new BeEvent<() => void>();

  protected readonly _view: ViewState;

  public constructor(view: ViewState) {
    this._view = view;
  }

  public is3d(): this is IModelDisplaySettings3d {
    return false;
  }

  public get viewFlagOverrides() {
    return this.#viewFlagOverrides;
  }

  public set viewFlagOverrides(ovrs: ViewFlagOverrides) {
    this.#viewFlagOverrides = ovrs;
    // Synchronize display style
    this.onViewFlagOverridesChanged.raiseEvent();
  }

  public get subCategoryOverrides() {
    return this._view.displayStyle.settings.subCategoryOverrides;
  }

  public get modelAppearanceOverrides() {
    return this._view.displayStyle.settings.modelAppearanceOverrides;
  }
}

class IModelDisplaySettings3dImpl extends IModelDisplaySettingsImpl implements IModelDisplaySettings3d {
  #hiddenLine?: HiddenLine.Settings;

  public readonly onHiddenLineSettingsChanged = new BeEvent<() => void>();
  public readonly onModelClipGroupsChanged = new BeEvent<() => void>();

  private get _view3d(): ViewState3d {
    return this._view as ViewState3d;
  }

  public constructor(view: ViewState3d) {
    super(view);

    view.details.onModelClipGroupsChanged.addListener(
      () => this.onModelClipGroupsChanged.raiseEvent()
    );
  }

  public override is3d(): this is IModelDisplaySettings3d {
    return true;
  }

  public get planarClipMasks() {
    return this._view3d.displayStyle.settings.planarClipMasks;
  }

  public get realityModelDisplaySettings() {
    return this._view3d.displayStyle.settings.realityModelDisplaySettings;
  }

  public get hiddenLineSettings() {
    return this.#hiddenLine;
  }

  public set hiddenLineSettings(hline: HiddenLine.Settings | undefined) {
    this.#hiddenLine = hline;
    // synchronize display style
    this.onHiddenLineSettingsChanged.raiseEvent();
  }

  public get planProjectionSettings() {
    // ###TODO return this._view3d.displayStyle.settings.planProjectionSettings;
    return new ObservableMap<Id64String, PlanProjectionSettings>();
  }

  public get modelClipGroups() {
    return this._view3d.details.modelClipGroups;
  }

  public set modelClipGroups(groups: ModelClipGroups) {
    this._view3d.details.modelClipGroups = groups;
  }
}
