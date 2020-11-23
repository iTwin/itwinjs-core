/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BeEvent } from "@bentley/bentleyjs-core";

/** @public */
export type EditCommandType = typeof EditCommand;

/** An EditCommand that performs an editing action. It has a *commandId* that uniquely identifies it, so it can be found via a lookup in the [[EditCommandAdmin]].
 * Every time an EditCommand run, a new instance of (a subclass of) this class is created
 * @public
 */
export class EditCommand {
  /** The unique string that identifies this EditCommand. This must be overridden in every subclass. */
  public static commandId = "";

  public constructor(..._args: any[]) { }

  public onStart(): boolean { return true; }

  public onCleanup(): void { }

  public onFinish(): void { }
}

/** EditCommandAdmin holds a mapping between commandIds and their corresponding [[EditCommand]] class. This provides the mechanism to
 * run EditCommands by their commandId.
 * It also keeps track of the currently active EditCommand. When a new EditCommand starts, the active EditCommand is terminated.
 * @public
 */
export class EditCommandAdmin {
  public readonly commands = new Map<string, EditCommandType>();
  public readonly onEditCommandFinish = new BeEvent<(cmd: EditCommand) => void>();
  public readonly onEditCommandStart = new BeEvent<(cmd: EditCommand) => void>();

  private _activeCommand?: EditCommand;

  /**
   * Un-register a previously registered EditCommand class.
   * @param commandId the commandId of a previously registered EditCommand to unRegister.
   */
  public unRegister(commandId: string) { this.commands.delete(commandId); }

  /**
   * Register an EditCommand class. This establishes a connection between the commandId of the class and the class itself.
   * @param commandType the subclass of Tool to register.
   */
  public register(commandType: EditCommandType) {
    if (commandType.commandId.length !== 0)
      this.commands.set(commandType.commandId, commandType);
  }

  /**
   * Register all the EditCommand classes found in a module.
   * @param modelObj the module to search for subclasses of EditCommand.
   */
  public registerModule(moduleObj: any) {
    for (const thisMember in moduleObj) {  // eslint-disable-line guard-for-in
      const thisTool = moduleObj[thisMember];
      if (thisTool.prototype instanceof EditCommand) {
        this.register(thisTool);
      }
    }
  }

  public startCommand(cmd?: EditCommand) {
    if (this._activeCommand) {
      this.onEditCommandFinish.raiseEvent(this._activeCommand);
      this._activeCommand.onFinish();
    }

    this._activeCommand = cmd;

    if (cmd) {
      cmd.onStart();
      this.onEditCommandStart.raiseEvent(cmd);
    }
  }

  public runCommand(commandId: string, ...args: any[]): EditCommand | undefined {
    const commandClass = this.commands.get(commandId);
    if (undefined === commandClass)
      return undefined;

    this.startCommand(new commandClass(...args));
    return this._activeCommand;
  }

};
