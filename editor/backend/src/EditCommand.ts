/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { isElectronMain } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { CommandMethodProps, CommandResult, editCommandApi, PingResult, StartCommandProps } from "@bentley/imodeljs-editor-common";

/** @alpha */
export type EditCommandType = typeof EditCommand;

/**
 * An EditCommand that performs an editing action on the backend. EditCommands are usually paired with and driven by EditTools on the frontend.
 * EditCommands have a *commandId* that uniquely identifies them, so they can be found via a lookup in the [[EditCommandAdmin]].
 * Every time an EditCommand runs, a new instance of (a subclass of) this class is created
 * @alpha
 */
export class EditCommand {
  /** The unique string that identifies this EditCommand class. This must be overridden in every subclass. */
  public static commandId = "";
  public static version = "1.0.0";

  /** The iModel this EditCommand may modify. */
  public readonly iModel: IModelDb;

  public constructor(iModel: IModelDb, _arg?: any) {
    this.iModel = iModel;
  }
  public get ctor(): EditCommandType { return this.constructor as EditCommandType; }

  public onStart(): CommandResult<any> { return {}; }

  public onPing(): CommandResult<PingResult> {
    return { result: { version: this.ctor.version, commandId: this.ctor.commandId } };
  }
  public onCleanup(): void { }

  public onFinish(): void { }
}

/** EditCommandAdmin holds a mapping between commandIds and their corresponding [[EditCommand]] class. This provides the mechanism to
 * run EditCommands by commandId.
 * It also keeps track of the currently active EditCommand. When a new EditCommand starts, the active EditCommand is terminated.
 * @alpha
 */
export class EditCommandAdmin {
  public static readonly commands = new Map<string, EditCommandType>();

  private static _activeCommand?: EditCommand;
  private static _isInitialized = false;

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
    if (!this._isInitialized) {
      this._isInitialized = true;
      if (!isElectronMain)
        throw new Error("Edit Commands only allowed in Electron");

      const ipcMain = require("electron").ipcMain;
      ipcMain.handle(editCommandApi.start, async (_event: any, arg: any) => EditCommandAdmin.startCommand(arg));
      ipcMain.handle(editCommandApi.call, async (_event: any, arg: any) => EditCommandAdmin.callMethod(arg));
    }
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
    return cmd ? cmd.onStart() : { error: "NoActiveCommand" };
  }

  public static startCommand(props: StartCommandProps<any>): CommandResult<any> {
    const commandClass = this.commands.get(props.commandId);
    try {
      return commandClass ? this.runCommand(new commandClass(IModelDb.findByKey(props.iModelKey), props.args)) : { error: "CommandNotFound", details: props.commandId };
    } catch (e) {
      return { error: "Exception", details: e };
    }
  }

  public static callMethod(method: CommandMethodProps<any>): CommandResult<any> {
    if (!this._activeCommand)
      return { error: "NoActiveCommand" };

    const func = (this._activeCommand as any)[method.name];
    if (typeof func !== "function")
      return { error: "MethodNotFound" };

    try {
      return func.call(this._activeCommand, method.args);
    } catch (e) {
      return { error: "Exception", details: e };
    }
  }
};
