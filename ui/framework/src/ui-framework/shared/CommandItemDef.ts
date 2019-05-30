/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { CommandItemProps } from "./ItemProps";
import { ActionButtonItemDef } from "./ActionButtonItemDef";

/** An Item that executes a Command.
 * @public
 */
export class CommandItemDef extends ActionButtonItemDef {
  private static _sId = 0;
  public static commandIdPrefix = "Command-";
  public commandId: string = "";

  constructor(commandItemProps: CommandItemProps) {
    super(commandItemProps);

    if (commandItemProps.execute) {
      this._commandHandler = { execute: commandItemProps.execute, parameters: commandItemProps.parameters, getCommandArgs: commandItemProps.getCommandArgs };
    }

    if (commandItemProps.commandId)
      this.commandId = commandItemProps.commandId;
    else {
      CommandItemDef._sId++;
      this.commandId = CommandItemDef.commandIdPrefix + CommandItemDef._sId;
    }
  }

  public get id(): string {
    return this.commandId;
  }
}
