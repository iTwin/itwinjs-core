/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ipcMain } from "electron";
import { isElectronMain } from "@bentley/bentleyjs-core";
import { CallMethodProps, CommandResult, editIpcPrefix, PingResult, StartCommandProps } from "@bentley/imodeljs-editor-common";

/** @public */
export type EditCommandType = typeof EditCommand;

/** An EditCommand that performs an editing action. It has a *commandId* that uniquely identifies it, so it can be found via a lookup in the [[EditCommandAdmin]].
 * Every time an EditCommand run, a new instance of (a subclass of) this class is created
 * @public
 */
export class EditCommand {
  /** The unique string that identifies this EditCommand class. This must be overridden in every subclass. */
  public static commandId = "";
  public static version = "1.0.0";

  public constructor(_arg: any) { }
  public get ctor() { return this.constructor as EditCommandType; }

  public onStart(): CommandResult<any> { return { status: "Success" }; }

  public onPing(): PingResult {
    return { status: "Success", version: this.ctor.version, commandId: this.ctor.commandId };
  }
  public onCleanup(): void { }

  public onFinish(): void { }
}

/** EditCommandAdmin holds a mapping between commandIds and their corresponding [[EditCommand]] class. This provides the mechanism to
 * run EditCommands by their commandId.
 * It also keeps track of the currently active EditCommand. When a new EditCommand starts, the active EditCommand is terminated.
 * @public
 */
export class EditCommandAdmin {
  public static readonly commands = new Map<string, EditCommandType>();

  private static _activeCommand?: EditCommand;

  /**
   * Un-register a previously registered EditCommand class.
   * @param commandId the commandId of a previously registered EditCommand to unRegister.
   */
  public static unRegister(commandId: string) { this.commands.delete(commandId); }

  /**
   * Register an EditCommand class. This establishes a connection between the commandId of the class and the class itself.
   * @param commandType the subclass of Tool to register.
   */
  public static register(commandType: EditCommandType) {
    if (commandType.commandId.length !== 0)
      this.commands.set(commandType.commandId, commandType);
  }

  /**
   * Register all the EditCommand classes found in a module.
   * @param modelObj the module to search for subclasses of EditCommand.
   */
  public static registerModule(moduleObj: any) {
    for (const thisMember in moduleObj) {  // eslint-disable-line guard-for-in
      const thisCmd = moduleObj[thisMember];
      if (thisCmd.prototype instanceof EditCommand) {
        this.register(thisCmd);
      }
    }
  }

  public static runCommand(cmd?: EditCommand): CommandResult<any> {
    if (this._activeCommand)
      this._activeCommand.onFinish();
    this._activeCommand = cmd;
    return cmd ? cmd.onStart() : { status: "NoActiveCommand" };
  }

  public static startCommand(props: StartCommandProps) {
    const commandClass = this.commands.get(props.commandId);
    return commandClass ? this.runCommand(new commandClass(props.args)) : { status: "CommandNotFound" };
  }

  public static callMethod(method: CallMethodProps): CommandResult<any> {
    if (!this._activeCommand)
      return { status: "NoActiveCommand" };

    const func = (this._activeCommand as any)[method.name];
    if (typeof func !== "function")
      return { status: "MethodNotFound" };

    return func.apply(this._activeCommand, method.args);
  }

};

const editCommandMain = () => {
  if (!isElectronMain)
    throw new Error("Editing only supported in Electron");

  ipcMain.handle(`${editIpcPrefix}startCommand`, async (_event, arg) => EditCommandAdmin.startCommand(arg));
  ipcMain.handle(`${editIpcPrefix}callMethod`, async (_event, arg) => EditCommandAdmin.callMethod(arg));
};

editCommandMain();
