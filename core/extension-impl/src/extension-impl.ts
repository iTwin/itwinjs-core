/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// import type { Tool } from "@itwin/core-frontend";
import { IModelApp, ToolType } from "@itwin/core-frontend";
import { UiItemsManager, UiItemsProvider } from "@itwin/appui-abstract";

export class ExtensionHost {
  public static async registerUiProvider(uiItemsProvider: UiItemsProvider): Promise<void> {
    UiItemsManager.register(uiItemsProvider);
  }

  public static async registerTool(tool: ToolType): Promise<void> {
    IModelApp.tools.register(tool);
  }
}
