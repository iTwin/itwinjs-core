/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { BackstageItem } from "./backstage/BackstageItem";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "./toolbars/ToolbarItem";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection } from "./widget/StagePanel";
import { StageUsage } from "./items/StageUsage";
import { UiItemsProvider } from "./UiItemsProvider";
import { UiItemsManager } from "./UiItemsManager";

/** Base implementation of a UiItemsProvider. The base class allows the user to pass in a function that is used to determine if the
 * active stage should be provided items. Derived provider classes should override the `xxxInternal` methods to provide items.
 * @deprecated in 3.6. Use [BaseUiItemsProvider]($appui-react) instead.
 * @public
 */
export class BaseUiItemsProvider implements UiItemsProvider {
  /*
   * @param providerId - unique identifier for this instance of the provider. This is required in case separate packages want
   * to set up custom stage with their own subset of standard tools.
   * @param isSupportedStage - optional function that will be called to determine if tools should be added to current stage. If not set and
   * the current stage's `usage` is set to `StageUsage.General` then the provider will add items to frontstage.
   */
  constructor(protected _providerId: string, public isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any, provider?: UiItemsProvider) => boolean) { }

  public get id(): string { return this._providerId; }
  public onUnregister(): void { }

  public unregister() {
    UiItemsManager.unregister(this._providerId);
  }

  /** Backstage items are not stage specific so no callback is used */
  public provideBackstageItems(): BackstageItem[] {
    return [];
  }

  public provideToolbarButtonItemsInternal(_stageId: string, _stageUsage: string, _toolbarUsage: ToolbarUsage, _toolbarOrientation: ToolbarOrientation, _stageAppData?: any): CommonToolbarItem[] {
    return [];
  }
  public provideToolbarButtonItems(stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any): CommonToolbarItem[] {
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData, this);
    } else {
      provideToStage = (stageUsage === StageUsage.General.valueOf());
    }

    return provideToStage ? this.provideToolbarButtonItemsInternal(stageId, stageUsage, toolbarUsage, toolbarOrientation, stageAppData) : [];
  }

  public provideStatusBarItemsInternal(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    return [];
  }
  public provideStatusBarItems(stageId: string, stageUsage: string, stageAppData?: any): CommonStatusBarItem[] {
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData, this);
    } else {
      provideToStage = (stageUsage === StageUsage.General.valueOf());
    }

    return provideToStage ? this.provideStatusBarItemsInternal(stageId, stageUsage, stageAppData) : [];
  }

  public provideWidgetsInternal(_stageId: string, _stageUsage: string, _location: StagePanelLocation, _section?: StagePanelSection, _zoneLocation?: AbstractZoneLocation, _stageAppData?: any): AbstractWidgetProps[] {
    return [];
  }

  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection,
    _zoneLocation?: AbstractZoneLocation, stageAppData?: any): ReadonlyArray<AbstractWidgetProps> {
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData, this);
    } else {
      provideToStage = (stageUsage === StageUsage.General.valueOf());
    }

    return provideToStage ? this.provideWidgetsInternal(stageId, stageUsage, location, section, _zoneLocation, stageAppData) : [];
  }
}
