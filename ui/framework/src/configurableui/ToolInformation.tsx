/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { ConfigurableUiManager } from "./ConfigurableUiManager";
import { ConfigurableUiControlType } from "./ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";

/** Provides information about a tool with a given id, including the ToolUiProvider. */
export class ToolInformation {
  private _toolUiProvider: ToolUiProvider | undefined;

  constructor(public toolId: string) {
  }

  /** Get the ToolUiProvider registered for this tool */
  public get toolUiProvider(): ToolUiProvider | undefined {
    if (!this._toolUiProvider && ConfigurableUiManager.isControlRegistered(this.toolId)) {
      const toolUiProvider = ConfigurableUiManager.createControl(this.toolId, this.toolId) as ToolUiProvider;
      if (toolUiProvider) {
        if (toolUiProvider.getType() !== ConfigurableUiControlType.ToolUiProvider) {
          throw Error("ToolInformation.toolUiProvider error: toolId '" + this.toolId + "' is registered to a control that is NOT a ToolUiProvider");
        }

        this._toolUiProvider = toolUiProvider;
      }
    }

    return this._toolUiProvider;
  }
}
