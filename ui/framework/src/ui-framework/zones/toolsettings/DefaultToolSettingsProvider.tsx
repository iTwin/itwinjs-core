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
  DialogItem, DialogPropertySyncItem, DialogItemsManager,
} from "@bentley/ui-abstract";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { ToolUiManager } from "../toolsettings/ToolUiManager";

import { FrameworkVersionSwitch } from "../../hooks/useFrameworkVersion";
import { WidgetPanelsDefaultToolSettings } from "../../widget-panels/DefaultToolSettings";
import { DefaultReactDisplay } from "../../uiprovider/DefaultReactDisplay";

/** Responsive Layout Mode */

/** @internal */

/** DataProvider that keep underlying data in sync with UI display */
class ToolSettingsDataProvider extends DialogItemsManager {

  private _toolSettingsNode?: DefaultReactDisplay;
  constructor() {
    super();
  }
  // istanbul ignore next
  public get toolSettingsNode(): DefaultReactDisplay | undefined { return this._toolSettingsNode; }
  // istanbul ignore next
  public set toolSettingsNode(r: DefaultReactDisplay | undefined) { this._toolSettingsNode = r; }

  public isToolSettingsManager = (): boolean => {
    return true;
  }
}
/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool.
 * @internal
 */
export class DefaultToolSettingsProvider extends ToolUiProvider {
  public valueMap = new Map<string, DialogItem>();  // allows easy lookup of record given the property name
  public toolSettingsDP: ToolSettingsDataProvider;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsDP = new ToolSettingsDataProvider();
    this.toolSettingsDP.applyUiPropertyChange = this.applyUiPropertyChange;
    this.toolSettingsDP.items = ToolUiManager.toolSettingsProperties;

    // istanbul ignore else
    if ((this.toolSettingsDP as DialogItemsManager).layoutDialogRows())
      this.toolSettingsNode = (
        <FrameworkVersionSwitch
          v1={<DefaultReactDisplay itemsManager={this.toolSettingsDP} key={Date.now()} />}
          v2={<WidgetPanelsDefaultToolSettings itemsManager={this.toolSettingsDP} />}
        />
      );
    else
      this.toolSettingsNode = null;
    this.toolSettingsDP.toolSettingsNode = this.toolSettingsNode as DefaultReactDisplay;
  }

  public applyUiPropertyChange(syncItem: DialogPropertySyncItem): void {
    const activeTool = IModelApp.toolAdmin.activeTool;
    // istanbul ignore else
    if (!activeTool)
      return;

    activeTool.applyToolSettingPropertyChange(syncItem);
  }
  public onInitialize(): void {
    // istanbul ignore else
    if ((this.toolSettingsDP as DialogItemsManager).layoutDialogRows())
      // the date is used as a key to ensure that React sees the node as "new" and in need of rendering every time it's updated
      this.toolSettingsNode = (
        <FrameworkVersionSwitch
          v1={<DefaultReactDisplay itemsManager={this.toolSettingsDP} key={Date.now()} />}
          v2={<WidgetPanelsDefaultToolSettings itemsManager={this.toolSettingsDP} />}
        />
      );
    else
      this.toolSettingsNode = null;
  }
}

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
