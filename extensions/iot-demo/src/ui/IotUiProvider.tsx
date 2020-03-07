/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { UiItemsProvider, StageUsage, ToolbarUsage, ToolbarOrientation, ToolbarItemUtilities, CommonToolbarItem, ToolSettingsPropertyItem, ToolSettingsValue, UiDataProvider, PropertyChangeStatus, PropertyChangeResult } from "@bentley/ui-abstract";
import { ModelessDialogManager } from "@bentley/ui-framework";

import { IotSettingsDialog } from "./IotSettingsDialog";
import iotButtonSvg from "./iot-button.svg";
import { AnimationType, AnimationTypeName } from "../IoTDefinitions";
import { IoTDemoExtension } from "../iotDemo";

export class IotUiProvider extends UiDataProvider implements UiItemsProvider {
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

  public readonly id = "IotExtensionUiProvider";

  public constructor(public extension: IoTDemoExtension) {
    super();
  }

  public showIotDialog = () => {
    if (!ModelessDialogManager.getDialogInfo(IotSettingsDialog.id))
      ModelessDialogManager.openDialog(<IotSettingsDialog dataProvider={this} />, IotSettingsDialog.id);
  }

  /** Method called by applications that support extensions provided tool buttons */
  public provideToolbarButtonItems(_stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("iotExtension:openDialog", 1000, `svg:${iotButtonSvg}`, "Show IoT Dialog", this.showIotDialog);
      return [simpleActionSpec];
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
      this.extension.runMonitor(this.currentAnimationType);
      return { status: PropertyChangeStatus.Success };
    } else {
      // get duration in minutes.
      let duration: number = (this.endTime.getTime() - this.startTime.getTime()) / (60.0 * 1000.0);
      if (duration < 10)
        duration = 10;
      this.extension.runAnimation(this.currentAnimationType, duration, this.startTime.getTime());
      return { status: PropertyChangeStatus.Success };
    }
  }
}
