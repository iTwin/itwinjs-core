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

  constructor(commandItemProps: ToolItemProps) {
    super(commandItemProps);

    if (commandItemProps.execute) {
      this._commandHandler = { execute: commandItemProps.execute, parameters: commandItemProps.parameters, getCommandArgs: commandItemProps.getCommandArgs };
    }

    this.toolId = commandItemProps.toolId;
  }

  public get id(): string {
    return this.toolId;
  }
}
