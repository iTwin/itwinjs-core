/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { UiError } from "@itwin/appui-abstract";
import { ConfigurableUiControlType } from "../../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { UiFramework } from "../../UiFramework";
import { ToolSettingsManager } from "./ToolSettingsManager";
import { ToolUiProvider } from "./ToolUiProvider";

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
      let provider: ToolUiProvider | undefined;

      if (ConfigurableUiManager.isControlRegistered(this.toolId)) {
        provider = ConfigurableUiManager.createControl(this.toolId, this.toolId) as ToolUiProvider;
      } else {
        if (ToolSettingsManager.useDefaultToolSettingsProvider && this.toolId === ToolSettingsManager.toolIdForToolSettings)
          provider = ConfigurableUiManager.createControl("DefaultToolSettings", this.toolId) as ToolUiProvider;
      }
      // istanbul ignore else
      if (provider) {
        if (provider.getType() !== ConfigurableUiControlType.ToolUiProvider) {
          throw new UiError(UiFramework.loggerCategory(this), `toolUiProvider: toolId '${this.toolId}' is registered to a control that is NOT a ToolUiProvider`);
        }

        this._toolUiProvider = provider;
      }
    }

    return this._toolUiProvider;
  }
}
