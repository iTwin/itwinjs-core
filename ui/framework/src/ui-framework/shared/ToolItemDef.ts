/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

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
}
