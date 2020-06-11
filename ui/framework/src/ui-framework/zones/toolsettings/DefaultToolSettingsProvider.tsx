/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
// cSpell:Ignore configurableui
import { DialogItem, DialogItemsManager, DialogPropertySyncItem, SyncPropertiesChangeEventArgs } from "@bentley/ui-abstract";
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { ComponentGenerator } from "../../uiprovider/ComponentGenerator";
import { DefaultDialogGridContainer } from "../../uiprovider/DefaultDialogGridContainer";
import { SyncToolSettingsPropertiesEventArgs, ToolUiManager } from "../toolsettings/ToolUiManager";
import { ToolUiProvider } from "./ToolUiProvider";

/** Responsive Layout Mode */

/** @internal */

/** DataProvider that keeps underlying data in sync with UI display */
class ToolSettingsDataProvider extends DialogItemsManager {
  private static _thisInstance?: ToolSettingsDataProvider;
  // istanbul ignore next
  public onUiPropertyChanged = () => { };

  constructor() {
    super();

    // istanbul ignore else
    if (!ToolSettingsDataProvider._thisInstance) {
      ToolSettingsDataProvider._thisInstance = this;
    }
  }

  // pass on SyncToolSettingsPropertiesEvent from ToolAdmin so they are treated as DialogItemSync events
  private static _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    const syncArgs: SyncPropertiesChangeEventArgs = { properties: args.syncProperties };

    // istanbul ignore else
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

  // istanbul ignore next
  public isToolSettingsManager = (): boolean => {
    return true;
  }

  public applyUiPropertyChange = (syncItem: DialogPropertySyncItem) => {
    const activeTool = IModelApp.toolAdmin.activeTool;
    // istanbul ignore else
    if (!activeTool)
      return;

    // istanbul ignore next
    activeTool.applyToolSettingPropertyChange(syncItem);
    // istanbul ignore next
    this.onUiPropertyChanged();
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
    this.toolSettingsDP.onUiPropertyChanged = this._handleUiPropertyChanged;
  }

  public applyUiPropertyChange(syncItem: DialogPropertySyncItem) {
    this.toolSettingsDP.applyUiPropertyChange(syncItem);
  }

  public updateToolSettingsNodes(): void {
    // istanbul ignore else
    if ((this.toolSettingsDP as DialogItemsManager).layoutDialogRows()) {
      this.toolSettingsNode = (
        <DefaultDialogGridContainer itemsManager={this.toolSettingsDP} componentGenerator={this._componentGenerator} isToolSettings={true} key={Date.now()} />
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

  // istanbul ignore next
  private _handleUiPropertyChanged = () => {
    this.toolSettingsDP.items = ToolUiManager.toolSettingsProperties;
    this.updateToolSettingsNodes();
  }
}

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
