/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as React from "react";
import { ConfigurableUiControl, ConfigurableCreateInfo, ConfigurableUiControlType } from "../../configurableui/ConfigurableUiControl";

/**
 * ToolUiProvider provides the Tool Settings and/or Tool Assistance UI for a tool.
 * The ToolUiProvider is registered for the tool id via ConfigurableUiManager.registerControl.
 * @public
 */
export class ToolUiProvider extends ConfigurableUiControl {
  private _toolSettingsNode: React.ReactNode;
  private _toolAssistanceNode: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Gets the Tool Settings React node */
  public get toolSettingsNode(): React.ReactNode { return this._toolSettingsNode; }
  /** Sets the Tool Settings React node */
  public set toolSettingsNode(r: React.ReactNode) { this._toolSettingsNode = r; }

  /** Gets the Tool Assistance React node */
  public get toolAssistanceNode(): React.ReactNode { return this._toolAssistanceNode; }
  /** Sets the Tool Assistance React node */
  public set toolAssistanceNode(r: React.ReactNode) { this._toolAssistanceNode = r; }

  /** Gets the type of ConfigurableUiControl, which is 'ToolUiProvider' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.ToolUiProvider; }
}
