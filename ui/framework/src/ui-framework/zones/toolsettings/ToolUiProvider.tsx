/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import { ConfigurableUiControl, ConfigurableCreateInfo, ConfigurableUiControlType } from "../../configurableui/ConfigurableUiControl";
import { UiDataProvider } from "@bentley/ui-abstract";

/**
 * ToolUiProvider provides the Tool Settings and/or Tool Assistance UI for a tool.
 * The ToolUiProvider is registered for the tool id via ConfigurableUiManager.registerControl.
 * @public
 */
export class ToolUiProvider extends ConfigurableUiControl {
  private _toolSettingsNode: React.ReactNode;

  private _dataProvider?: UiDataProvider;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** The Tool Settings React node */
  public get toolSettingsNode(): React.ReactNode { return this._toolSettingsNode; }
  public set toolSettingsNode(r: React.ReactNode) { this._toolSettingsNode = r; }

  /** Tool Settings Data Provider */
  public get dataProvider(): UiDataProvider | undefined { return this._dataProvider; }
  public set dataProvider(d: UiDataProvider| undefined) { this._dataProvider = d; }

  /** Gets the type of ConfigurableUiControl, which is 'ToolUiProvider' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.ToolUiProvider; }
}
