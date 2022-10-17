/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { ToolType } from "../tools/Tool";
import { IModelApp } from "../IModelApp";
import {
  CommonToolbarItem,
  StageUsage,
  ToolbarItemUtilities,
  ToolbarOrientation,
  ToolbarUsage,
  UiItemsManager,
  UiItemsProvider,
} from "@itwin/appui-abstract";

/** @alpha */
export class ToolProvider implements UiItemsProvider {
  public readonly id;
  private _toolId = "";
  private _toolIcon;
  private _toolLabel;

  public constructor(tool: ToolType) {
    this.id = `ToolProvider:${tool.toolId}`;
    this._toolId = tool.toolId;
    this._toolIcon = tool.iconSpec;
    this._toolLabel = tool.description;
  }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ): CommonToolbarItem[] {
    const toolbarItem = ToolbarItemUtilities.createActionButton(this._toolId, 0, this._toolIcon, this._toolLabel, async () => {
      await IModelApp.tools.run(this._toolId);
    });

    return stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Vertical
      ? [toolbarItem]
      : [];
  }
}

/** @alpha */
export class ExtensionImpl {
  constructor(private _id: string) {}

  public async registerTool(tool: ToolType, onRegistered?: () => any): Promise<void> {
    try {
      IModelApp.tools.register(tool);
      UiItemsManager.register(new ToolProvider(tool));
      onRegistered?.();
    } catch (e: any) {
      console.log(`Error registering tool: ${e}`); // eslint-disable-line
    }
  }
}
