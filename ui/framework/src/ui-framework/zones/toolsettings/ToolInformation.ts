/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { ConfigurableUiControlType } from "../../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";
import { ToolUiManager } from "./ToolUiManager";

/** Provides information about a tool with a given id, including the ToolUiProvider.
 * @public
 */
export class ToolInformation {
  private _toolUiProvider: ToolUiProvider | undefined;

  constructor(public toolId: string) {
  }

  /** Get the ToolUiProvider registered for this tool */
  public get toolUiProvider(): ToolUiProvider | undefined {
    if (!this._toolUiProvider) {
      let toolUiProvider: ToolUiProvider | undefined;

      if (ConfigurableUiManager.isControlRegistered(this.toolId)) {
        toolUiProvider = ConfigurableUiManager.createControl(this.toolId, this.toolId) as ToolUiProvider;
      } else {
        if (ToolUiManager.useDefaultToolSettingsProvider)
          toolUiProvider = ConfigurableUiManager.createControl("DefaultToolSettings", this.toolId) as ToolUiProvider;
      }
      // istanbul ignore else
      if (toolUiProvider) {
        if (toolUiProvider.getType() !== ConfigurableUiControlType.ToolUiProvider) {
          throw Error("ToolInformation.toolUiProvider error: toolId '" + this.toolId + "' is registered to a control that is NOT a ToolUiProvider");
        }

        toolUiProvider.initialize();
        this._toolUiProvider = toolUiProvider;
      }
    } else {
      // if the tool settings are coming from tool, reinitialize provider so latest properties published from tool are displayed in UI
      if (ToolUiManager.useDefaultToolSettingsProvider && this._toolUiProvider)
        this._toolUiProvider.initialize();
    }
    return this._toolUiProvider;
  }
}
