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
import { DialogItem, DialogPropertySyncItem, SyncPropertiesChangeEventArgs, UiLayoutDataProvider } from "@bentley/ui-abstract";
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { ComponentGenerator } from "../../uiprovider/ComponentGenerator";
import { DefaultDialogGridContainer } from "../../uiprovider/DefaultDialogGridContainer";
import { SyncToolSettingsPropertiesEventArgs, ToolSettingsManager } from "./ToolSettingsManager";
import { ToolUiProvider } from "./ToolUiProvider";

/** @internal */

/** ToolSettingsUiDataProvider keeps tool data in sync with UI display */
class ToolSettingsUiDataProvider extends UiLayoutDataProvider {
  // istanbul ignore next
  public isToolSettingsManager = (): boolean => {
    return true;
  };

  public supplyDialogItems(): DialogItem[] | undefined {
    return ToolSettingsManager.toolSettingsProperties;
  }

  // send property changes from UI back to tool
  public applyUiPropertyChange = (syncItem: DialogPropertySyncItem) => {
    // istanbul ignore next
    IModelApp.toolAdmin.activeTool && IModelApp.toolAdmin.activeTool.applyToolSettingPropertyChange(syncItem);
  };
}

/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool.
 * @internal
 */
export class DefaultToolSettingsProvider extends ToolUiProvider {
  public uiDataProvider = new ToolSettingsUiDataProvider();

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public updateToolSettingsNodes(): void {
    // istanbul ignore else
    if (this.uiDataProvider.layoutDialogRows()) {
      const componentGenerator = new ComponentGenerator(this.uiDataProvider);

      this.toolSettingsNode = (
        <DefaultDialogGridContainer componentGenerator={componentGenerator} isToolSettings={true} />
      );
      this.horizontalToolSettingNodes = componentGenerator.getToolSettingsEntries();
    } else {
      this.toolSettingsNode = null;
      this.horizontalToolSettingNodes = [];
    }
  }

  public reloadPropertiesFromTool(): void {
    // trigger the items to be reloaded from the active tool
    this.uiDataProvider.reloadDialogItems(false);
    this.updateToolSettingsNodes();
    // NOTE: UI components will typically listen for FrontstageManager.onToolSettingsReloadEvent which is
    // emitted after this method is called.
  }

  // called when tool is activated to repopulate tool settings.
  public onInitialize(): void {
    this.reloadPropertiesFromTool();
  }

  // called to process ToolSettingsManager.onSyncToolSettingsProperties event
  public syncToolSettingsProperties(args: SyncToolSettingsPropertiesEventArgs): void {
    const syncArgs: SyncPropertiesChangeEventArgs = { properties: args.syncProperties };
    this.uiDataProvider.onSyncPropertiesChangeEvent.emit(syncArgs);
  }
}

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
