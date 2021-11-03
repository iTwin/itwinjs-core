/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ToolType } from "../tools/Tool";
import { IModelApp } from "../IModelApp";
import { CommonToolbarItem, StageUsage, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider } from "@itwin/appui-abstract";

export interface ToolGroupButton {
  tools: ToolType[];
  groupButtonId: string;
  icon: string;
  label: string;
}

class ToolProvider implements UiItemsProvider {
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

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    const toolbarItem = ToolbarItemUtilities.createActionButton(this._toolId, 0, this._toolIcon, this._toolLabel, async () => { await IModelApp.tools.run(this._toolId); });
    return stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Vertical ? [toolbarItem] : [];
  }
}

class ToolGroupProvider implements UiItemsProvider {
  public readonly id;
  private _groupButtonId = "";
  private _tools: ToolType[];
  private _icon: string;
  private _label: string;

  public constructor({ tools, groupButtonId, icon, label }: ToolGroupButton) {
    this.id = `ToolGroupProvider:${groupButtonId}`;
    this._tools = tools;
    this._groupButtonId = groupButtonId;
    this._icon = icon;
    this._label = label;
  }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ): CommonToolbarItem[] {
    const toolItems = this._tools.map((tool, index) => {
      return ToolbarItemUtilities.createActionButton(
        tool.toolId,
        index,
        tool.iconSpec,
        tool.description,
        async () => {
          await IModelApp.tools.run(tool.toolId);
        }
      );
    });

    const toolbarGroup = ToolbarItemUtilities.createGroupButton(
      this._groupButtonId,
      1,
      this._icon,
      this._label,
      toolItems
    );

    return stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Vertical
      ? [toolbarGroup]
      : [];
  }
}

export class ExtensionImpl {
  constructor(private _id: string) {}

  public async registerTool(tool: ToolType): Promise<void> {
    try {
      IModelApp.tools.register(tool);
      UiItemsManager.register(new ToolProvider(tool));
    } catch (e: any) {
      console.log(`Error registering tool: ${e}`); // eslint-disable-line
    }
  }

  public async registerToolOnly(tool: ToolType ): Promise<void> {
    try {
      IModelApp.tools.register(tool);
    } catch (e: any) {
      console.log(`Error registering tool: ${e}`); // eslint-disable-line
    }
  }

  public async registerToolGroup({ tools, groupButtonId, icon, label }: ToolGroupButton): Promise<void> {
    try {
      for (const tool of tools) {
        IModelApp.tools.register(tool);
      }
      UiItemsManager.register(new ToolGroupProvider({ tools, groupButtonId, icon, label }));
    } catch (e: any) {
      console.log(`Error registering tool group: ${e}`); // eslint-disable-line
    }
  }
}
