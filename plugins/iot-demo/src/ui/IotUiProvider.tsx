/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { PluginUiProvider, UiItemNode, ActionItemInsertSpec, ToolbarItemInsertSpec, ToolbarItemType, ToolSettingsPropertyItem, ToolSettingsValue } from "@bentley/imodeljs-frontend";
import { ModelessDialogManager, UiDataProvider, PropertyChangeStatus, PropertyChangeResult } from "@bentley/ui-framework";

import { IotSettingsDialog } from "./IotSettingsDialog";
import iotButtonSvg from "./iot-button.svg";
import { AnimationType, AnimationTypeName } from "../IoTDefinitions";
import { IoTDemoPlugin } from "../iotDemo";

export class IotUiProvider extends UiDataProvider implements PluginUiProvider {
  public monitorMode = false;
  public readonly monitorModePropertyName = "monitorMode";

  public startTime = new Date();
  public readonly startTimePropertyName = "startTime";

  public endTime = new Date();
  public readonly endTimePropertyName = "endTime";

  public monitorTime = new Date();
  public readonly monitorTimePropertyName = "monitorTime";

  public minDate = new Date();
  public readonly minDatePropertyName = "minDate";

  public maxDate = new Date();
  public readonly maxDatePropertyName = "maxDate";

  public currentAnimationType = AnimationType.Temperature;
  public readonly currentAnimationTypePropertyName = "AnimationType";

  public alarmText = "";
  public readonly alarmTextPropertyName = "alarmText";

  public readonly id = "IotPluginUiProvider";

  public constructor(public plugin: IoTDemoPlugin) {
    super();
  }

  public showIotDialog = () => {
    if (!ModelessDialogManager.getDialogInfo(IotSettingsDialog.id))
      ModelessDialogManager.openDialog(<IotSettingsDialog dataProvider={this} />, IotSettingsDialog.id);
  }
  /** Method called by applications that support plugins provided tool buttons. All nine-zone based apps will supports PluginUiProviders */
  public provideToolbarItems(toolBarId: string, _itemIds: UiItemNode): ToolbarItemInsertSpec[] {
    // For 9-zone apps the toolbarId will be in form -[stageName]ToolWidget|NavigationWidget-horizontal|vertical
    // examples:"[ViewsFrontstage]ToolWidget-horizontal" "[ViewsFrontstage]NavigationWidget-vertical"
    if (toolBarId.includes("ToolWidget-horizontal")) {
      const lastActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        insertBefore: false,
        itemId: "iotPlugin:openDialog",
        execute: this.showIotDialog,
        icon: `svg:${iotButtonSvg}`,
        label: "Show IoT Dialog",
      };
      return [lastActionSpec];
    }
    return [];
  }

  public getAnimationTypeFromString(animationType: string): AnimationType {
    switch (animationType) {
      case (AnimationTypeName.Temperature):
        return AnimationType.Temperature;
      case (AnimationTypeName.Co2):
        return AnimationType.Co2;
      case (AnimationTypeName.Smoke):
        return AnimationType.Smoke;
      case (AnimationTypeName.Fire):
        return AnimationType.Fire;
      case (AnimationTypeName.Occupancy):
        return AnimationType.Occupancy;
      case (AnimationTypeName.HeatingCooling):
        return AnimationType.HeatingCooling;
      default:
        return AnimationType.Temperature;
    }
  }

  private getAnimationType(deviceId: number): AnimationType {
    switch (deviceId) {
      case (AnimationType.Temperature as number):
        return AnimationType.Temperature;
      case (AnimationType.Co2 as number):
        return AnimationType.Co2;
      case (AnimationType.Smoke as number):
        return AnimationType.Smoke;
      case (AnimationType.Fire as number):
        return AnimationType.Fire;
      case (AnimationType.Occupancy as number):
        return AnimationType.Occupancy;
      case (AnimationType.HeatingCooling as number):
        return AnimationType.HeatingCooling;
      default:
        return AnimationType.HeatingCooling;
    }
  }

  /** Called by UI to request available properties */
  public supplyAvailableProperties(): ToolSettingsPropertyItem[] {
    return [
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.currentAnimationType as number), this.currentAnimationTypePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.monitorMode), this.monitorModePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.startTime), this.startTimePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.endTime), this.endTimePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.monitorTime), this.monitorTimePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.minDate), this.minDatePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.maxDate), this.maxDatePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.alarmText), this.alarmTextPropertyName),
    ];
  }

  public syncCurrentDateInUi(monitorTime: Date): void {
    this.monitorTime = monitorTime;
    const properties = [
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.monitorTime), this.monitorTimePropertyName),
    ];

    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  public syncAlarmUi(monitorTime: Date, alarmText?: string): void {
    this.monitorTime = monitorTime;
    const properties = [];
    properties.push(new ToolSettingsPropertyItem(new ToolSettingsValue(this.monitorTime), this.monitorTimePropertyName));
    if (alarmText) {
      this.alarmText = alarmText;
      properties.push(new ToolSettingsPropertyItem(new ToolSettingsValue(this.alarmText), this.alarmTextPropertyName));
    }

    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  /** Called by UI to inform data provider of changes */
  public processChangesInUi(properties: ToolSettingsPropertyItem[]): PropertyChangeResult {
    if (properties.length > 0) {
      for (const prop of properties) {
        if (prop.propertyName === this.currentAnimationTypePropertyName) {
          this.currentAnimationType = this.getAnimationType(prop.value.value! as number);
          continue;
        }
        if (prop.propertyName === this.monitorModePropertyName) {
          this.monitorMode = prop.value.value! as boolean;
          continue;
        }
        if (prop.propertyName === this.startTimePropertyName) {
          this.startTime = (prop.value.value! as Date);
          continue;
        }
        if (prop.propertyName === this.endTimePropertyName) {
          this.endTime = (prop.value.value! as Date);
          continue;
        }
      }
    }

    if (this.monitorMode) {
      this.plugin.runMonitor(this.currentAnimationType);
      return { status: PropertyChangeStatus.Success };
    } else {
      // get duration in minutes.
      let duration: number = (this.endTime.getTime() - this.startTime.getTime()) / (60.0 * 1000.0);
      if (duration < 10)
        duration = 10;
      this.plugin.runAnimation(this.currentAnimationType, duration, this.startTime.getTime());
      return { status: PropertyChangeStatus.Success };
    }
  }
}
