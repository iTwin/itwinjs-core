/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import type { OnItemExecutedFunc } from "@itwin/appui-abstract";
import { ActionButtonItemDef } from "./ActionButtonItemDef";
import type { CommandItemProps } from "./ItemProps";

/** An Item that executes a Command.
 * @public
 */
export class CommandItemDef extends ActionButtonItemDef {
  private static _sId = 0;
  public static commandIdPrefix = "Command-";
  public commandId: string = "";

  constructor(commandItemProps: CommandItemProps, onItemExecuted?: OnItemExecutedFunc) {
    super(commandItemProps, onItemExecuted);

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
