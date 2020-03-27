/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";

// cSpell:Ignore configurableui

import {
  DialogItem, DialogPropertySyncItem, DialogItemsManager, SyncPropertiesChangeEventArgs,
} from "@bentley/ui-abstract";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { ToolUiManager, SyncToolSettingsPropertiesEventArgs } from "../toolsettings/ToolUiManager";

import { FrameworkVersionSwitch } from "../../hooks/useFrameworkVersion";
import { WidgetPanelsDefaultToolSettings } from "../../widget-panels/DefaultToolSettings";
import { DefaultDialogGridContainer } from "../../uiprovider/DefaultDialogGridContainer";
import { ComponentGenerator } from "../../uiprovider/ComponentGenerator";

/** Responsive Layout Mode */

/** @internal */

/** DataProvider that keeps underlying data in sync with UI display */
class ToolSettingsDataProvider extends DialogItemsManager {
  private static _thisInstance?: ToolSettingsDataProvider;

  constructor() {
    super();

    if (!ToolSettingsDataProvider._thisInstance) {
      ToolSettingsDataProvider._thisInstance = this;
    }
  }

  // pass on SyncToolSettingsPropertiesEvent from ToolAdmin so they are treated as DialogItemSync events
  private static _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    const syncArgs: SyncPropertiesChangeEventArgs = { properties: args.syncProperties };

    if (ToolSettingsDataProvider._thisInstance)
      ToolSettingsDataProvider._thisInstance.onSyncPropertiesChangeEvent.emit(syncArgs);
  }

  public static get instance() {
    if (!ToolSettingsDataProvider._thisInstance) {
      ToolSettingsDataProvider._thisInstance = new ToolSettingsDataProvider();
      ToolUiManager.onSyncToolSettingsProperties.addListener(ToolSettingsDataProvider._handleSyncToolSettingsPropertiesEvent);
    }
    return ToolSettingsDataProvider._thisInstance;
  }

  public isToolSettingsManager = (): boolean => {
    return true;
  }

  public applyUiPropertyChange = (syncItem: DialogPropertySyncItem) => {
    const activeTool = IModelApp.toolAdmin.activeTool;
    // istanbul ignore else
    if (!activeTool)
      return;

    activeTool.applyToolSettingPropertyChange(syncItem);
  }
}

/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool.
 * @internal
 */
export class DefaultToolSettingsProvider extends ToolUiProvider {
  public valueMap = new Map<string, DialogItem>();  // allows easy lookup of record given the property name
  public toolSettingsDP = ToolSettingsDataProvider.instance;
  private _componentGenerator = new ComponentGenerator(this.toolSettingsDP);

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsDP.items = ToolUiManager.toolSettingsProperties;
  }

  public applyUiPropertyChange(syncItem: DialogPropertySyncItem) {
    this.toolSettingsDP.applyUiPropertyChange(syncItem);
  }

  public updateToolSettingsNodes(): void {
    // istanbul ignore else
    if ((this.toolSettingsDP as DialogItemsManager).layoutDialogRows()) {
      this.toolSettingsNode = (
        <FrameworkVersionSwitch
          v1={<DefaultDialogGridContainer itemsManager={this.toolSettingsDP} componentGenerator={this._componentGenerator} isToolSettings={true} key={Date.now()} />}
          v2={<WidgetPanelsDefaultToolSettings itemsManager={this.toolSettingsDP} />}
        />
      );
      this.horizontalToolSettingNodes = this._componentGenerator.getToolSettingsEntries();
    } else {
      this.toolSettingsNode = null;
      this.horizontalToolSettingNodes = [];
    }
  }
  public onInitialize(): void {
    // update the items to be from the active tool
    this.toolSettingsDP.items = ToolUiManager.toolSettingsProperties;
    this.updateToolSettingsNodes();
  }
}

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
