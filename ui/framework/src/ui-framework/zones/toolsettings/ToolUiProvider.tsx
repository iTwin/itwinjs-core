/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import { UiDataProvider } from "@bentley/ui-abstract";
import { ConfigurableCreateInfo, ConfigurableUiControl, ConfigurableUiControlType } from "../../configurableui/ConfigurableUiControl";
import { ToolSettingsEntry } from "../../widget-panels/ToolSettings";
import { SyncToolSettingsPropertiesEventArgs } from "./ToolSettingsManager";

/**
 * ToolUiProvider provides the Tool Settings and/or Tool Assistance UI for a tool.
 * The ToolUiProvider is registered for the tool id via ConfigurableUiManager.registerControl.
 * @public
 */
export class ToolUiProvider extends ConfigurableUiControl {
  private _toolSettingsNode: React.ReactNode;
  private _horizontalToolSettingNodes: ToolSettingsEntry[] | undefined;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** A React node that holds tool settings when shown in a rectangular area (i.e. not in Horizontal area at top of application window.) */
  public get toolSettingsNode(): React.ReactNode { return this._toolSettingsNode; }
  public set toolSettingsNode(r: React.ReactNode) { this._toolSettingsNode = r; }

  /** An array of entries to load into the horizontal tool settings
   * @beta
   */
  public get horizontalToolSettingNodes(): ToolSettingsEntry[] | undefined { return this._horizontalToolSettingNodes; }
  public set horizontalToolSettingNodes(r: ToolSettingsEntry[] | undefined) { this._horizontalToolSettingNodes = r; }

  /** The UiDataProvider class
   *  @deprecated no longer participates in Tool Settings
   */
  // istanbul ignore next
  public get dataProvider(): UiDataProvider | undefined { return undefined; }
  // istanbul ignore next
  public set dataProvider(_d: UiDataProvider | undefined) { }

  /** Gets the type of ConfigurableUiControl, which is 'ToolUiProvider' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.ToolUiProvider; }

  public syncToolSettingsProperties(_args: SyncToolSettingsPropertiesEventArgs): void { }
  public reloadPropertiesFromTool(): void { }
}
