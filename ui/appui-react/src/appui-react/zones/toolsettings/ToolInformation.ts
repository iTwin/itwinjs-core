/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { UiError } from "@itwin/appui-abstract";
import { ConfigurableUiControlType } from "../../configurableui/ConfigurableUiControl";
import { UiFramework } from "../../UiFramework";
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

      if (UiFramework.controls.isRegistered(this.toolId)) {
        provider = UiFramework.controls.create(this.toolId, this.toolId) as ToolUiProvider;
      } else {
        if (UiFramework.toolSettings.useDefaultToolSettingsProvider && this.toolId === UiFramework.toolSettings.toolIdForToolSettings)
          provider = UiFramework.controls.create("DefaultToolSettings", this.toolId) as ToolUiProvider;
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
