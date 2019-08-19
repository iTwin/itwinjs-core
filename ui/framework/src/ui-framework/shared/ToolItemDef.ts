/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";
import { ToolItemProps } from "./ItemProps";
import { ActionButtonItemDef } from "./ActionButtonItemDef";

/** An Item that starts the execution of a Tool.
 * @public
 */
export class ToolItemDef extends ActionButtonItemDef {
  public toolId: string = "";

  constructor(toolItemProps: ToolItemProps) {
    super(toolItemProps);

    if (toolItemProps.execute) {
      this._commandHandler = { execute: toolItemProps.execute, parameters: toolItemProps.parameters, getCommandArgs: toolItemProps.getCommandArgs };
    }

    this.toolId = toolItemProps.toolId;
  }

  public get id(): string {
    return this.toolId;
  }

  /** Create a ToolItemDef that will run a registered tool. */
  public static getItemDefForTool(tool: typeof Tool, iconSpec?: string, args?: any[]): ToolItemDef {
    return new ToolItemDef({
      toolId: tool.toolId,
      iconSpec: iconSpec ? iconSpec : (tool.iconSpec && tool.iconSpec.length > 0) ? tool.iconSpec : "icon-placeholder",
      label: () => tool.flyover,
      tooltip: () => tool.description,
      execute: () => { IModelApp.tools.run(tool.toolId, args); },
    });
  }
}
