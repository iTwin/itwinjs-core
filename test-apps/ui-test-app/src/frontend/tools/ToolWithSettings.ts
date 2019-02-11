/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp, PrimitiveTool,
  BeButtonEvent, EventHandled,
  ToolSettingsPropertyRecord, PropertyDescription, PrimitiveValue, ToolSettingsValue, ToolSettingsPropertySyncItem,
} from "@bentley/imodeljs-frontend";

import { Point3d } from "@bentley/geometry-core";

const enum ToolOptions {
  Red,
  White,
  Blue,
  Yellow,
}

export class ToolWithSettings extends PrimitiveTool {
  public static toolId = "ToolWithSettings";
  public readonly points: Point3d[] = [];

  // Tool Setting Properties
  // ------------- Enum based picklist ---------------
  private static enumAsPicklistMessage(str: string) { return IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Options." + str); }
  private static _optionsName = "enumAsPicklist";
  private static _getEnumAsPicklistDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._optionsName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Options"),
      typename: "enum",
      enum: {
        choices: [
          { label: ToolWithSettings.enumAsPicklistMessage("Red"), value: ToolOptions.Red },
          { label: ToolWithSettings.enumAsPicklistMessage("White"), value: ToolOptions.White },
          { label: ToolWithSettings.enumAsPicklistMessage("Blue"), value: ToolOptions.Blue },
          { label: ToolWithSettings.enumAsPicklistMessage("Yellow"), value: ToolOptions.Yellow },
        ],
      },
    };
  }

  private _optionsValue = new ToolSettingsValue(ToolOptions.Blue);

  public get option(): ToolOptions {
    return this._optionsValue.value as ToolOptions;
  }

  public set option(option: ToolOptions) {
    this._optionsValue.value = option;
  }

  // ------------- boolean based toggle button ---------------
  private static _lockToggleName = "lockToggle";
  private static _getLockToggleDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._lockToggleName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Lock"),
      typename: "boolean",
    };
  }

  private _lockValue = new ToolSettingsValue(true);

  public get lock(): boolean {
    return this._lockValue.value as boolean;
  }

  public set lock(option: boolean) {
    this._lockValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _cityName = "city";
  private static _getCityDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._cityName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.City"),
      typename: "string",
    };
  }

  private _cityValue = new ToolSettingsValue("Exton");

  public get city(): string {
    return this._cityValue.value as string;
  }

  public set city(option: string) {
    this._cityValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _stateName = "state";
  private static _getStateDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._stateName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.State"),
      typename: "string",
    };
  }

  private _stateValue = new ToolSettingsValue("Pennsylvania");

  public get state(): string {
    return this._stateValue.value as string;
  }

  public set state(option: string) {
    this._stateValue.value = option;
  }

  // -------- end of ToolSettings ----------

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.notifications.outputPromptByKey("SampleApp:tools.ToolWithSettings.Prompts.GetPoint");
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    IModelApp.toolAdmin.startDefaultTool();
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new ToolWithSettings();
    if (!tool.run())
      this.exitTool();
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._optionsValue.clone() as PrimitiveValue, ToolWithSettings._getEnumAsPicklistDescription(), { rowPriority: 0, columnPriority: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._lockValue.clone() as PrimitiveValue, ToolWithSettings._getLockToggleDescription(), { rowPriority: 5, columnPriority: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._cityValue.clone() as PrimitiveValue, ToolWithSettings._getCityDescription(), { rowPriority: 10, columnPriority: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._stateValue.clone() as PrimitiveValue, ToolWithSettings._getStateDescription(), { rowPriority: 10, columnPriority: 5 }));
    return toolSettings;
  }

  /** Used to send changes from UI back to Tool */
  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    if (updatedValue.propertyName === ToolWithSettings._optionsName) {
      if (this._optionsValue.value !== updatedValue.value.value)
        this.option = updatedValue.value.value as ToolOptions;
    } else if (updatedValue.propertyName === ToolWithSettings._lockToggleName) {
      this.lock = updatedValue.value.value as boolean;
    } else if (updatedValue.propertyName === ToolWithSettings._cityName) {
      this.city = updatedValue.value.value as string;
    } else if (updatedValue.propertyName === ToolWithSettings._stateName) {
      this.state = updatedValue.value.value as string;
    }
    // return true is change is valid
    return true;
  }

}
