/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { IModelStatus } from "@itwin/core-bentley";
import { IModelDb, IpcHandler, IpcHost } from "@itwin/core-backend";
import { BackendError, IModelError } from "@itwin/core-common";
import { EditCommandIpc, EditorIpc, editorIpcStrings } from "@itwin/editor-common";

/** @beta */
export type EditCommandType = typeof EditCommand;

/**
 * An EditCommand performs an editing action on the backend. EditCommands are usually paired with and driven by EditTools on the frontend.
 * EditCommands have a *commandId* that uniquely identifies them, so they can be found via a lookup in the [[EditCommandAdmin]].
 * Each EditCommand must be registered in the [[EditCommandAdmin]] with [[EditCommandAdmin.register]] or [[EditCommandAdmin.registerModule]].
 * Every time an EditCommand runs, a new instance of (a subclass of) this class is created.
 * @beta
 */
export class EditCommand implements EditCommandIpc {
  /** The unique string that identifies this EditCommand class. This must be overridden in every subclass. */
  public static commandId = "";
  public static version = "1.0.0";

  /** The iModel this EditCommand may modify. */
  public readonly iModel: IModelDb;

  public constructor(iModel: IModelDb, ..._args: any[]) {
    this.iModel = iModel;
  }
  public get ctor(): EditCommandType {
    return this.constructor as EditCommandType;
  }

  public async onStart(): Promise<any> { }

  public async ping(): Promise<{ commandId: string, version: string, [propName: string]: any }> {
    return { version: this.ctor.version, commandId: this.ctor.commandId };
  }

  // This is only temporary to find subclasses that used to implement this method. It was made async and renamed `requestFinish`.
  private onFinish() { }

  /**
   * Called when another EditCommand wishes to become the active EditCommand.
   * Subclasses should complete and save their work as soon as possible and then return "done".
   * If it is not currently possible to finish, return any string other than "done" and the other EditCommand will have to wait and retry,
   * potentially showing the returned string to the user.
   */
  public async requestFinish(): Promise<"done" | string> {
    this.onFinish(); // TODO: temporary, remove
    return "done";
  }
}

class EditorAppHandler extends IpcHandler implements EditorIpc {
  public get channelName() { return editorIpcStrings.channel; }

  public async startCommand(commandId: string, iModelKey: string, ...args: any[]) {
    await EditCommandAdmin.finishCommand();
    if (commandId === "") // just kill active command, don't start another
      return;

    const commandClass = EditCommandAdmin.commands.get(commandId);
    if (undefined === commandClass)
      throw new IModelError(IModelStatus.NotRegistered, `Command not registered [${commandId}]`);

    return EditCommandAdmin.runCommand(new commandClass(IModelDb.findByKey(iModelKey), ...args));
  }

  public async callMethod(methodName: string, ...args: any[]) {
    const cmd = EditCommandAdmin.activeCommand;
    if (!cmd)
      throw new IModelError(IModelStatus.NoActiveCommand, `No active command`);

    const func = (cmd as any)[methodName];
    if (typeof func !== "function")
      throw new IModelError(IModelStatus.FunctionNotFound, `Method ${methodName} not found on ${cmd.ctor.commandId}`);

    return func.call(cmd, ...args);
  }
}

/**
 * EditCommandAdmin holds a mapping between commandIds and their corresponding [[EditCommand]] class. This provides the mechanism to
 * run EditCommands by commandId.
 * It also keeps track of the currently active EditCommand. When a new EditCommand attempts to start, the active EditCommand
 * is requested to finish, and the new EditCommand cannot start until it does.
 * @beta
 */
export class EditCommandAdmin {
  public static readonly commands = new Map<string, EditCommandType>();

  private static _activeCommand?: EditCommand;
  private static _isInitialized = false;
  public static get activeCommand() { return this._activeCommand; }

  /** If any command is currently active, wait for it to finish.
   * Afterward, no command will be active.
   * This method is invoked by [[runCommand]] before starting a new command.
   * @throws BackendError if the command fails to finish.
   */
  public static async finishCommand() {
    if (this._activeCommand) {
      const finished = await this._activeCommand.requestFinish();
      if ("done" !== finished)
        throw new BackendError(IModelStatus.ServerTimeout, editorIpcStrings.commandBusy, finished);
    }
    this._activeCommand = undefined;
  }

  /** Start running the specified command.
   * The new command will not begin running until the currently-active command (if any) finishes.
   * Afterward, the new command becomes the active command.
   * @throws BackendError if the currently-active command fails to finish.
   */
  public static async runCommand(cmd: EditCommand): Promise<any> {
    await this.finishCommand();
    this._activeCommand = cmd;
    return cmd.onStart();
  }

  /**
   * Un-register a previously registered EditCommand class.
   * @param commandId the commandId of a previously registered EditCommand to unRegister.
   */
  public static unRegister(commandId: string) {
    this.commands.delete(commandId);
  }

  /**
   * Register an EditCommand class. This establishes a connection between the commandId of the class and the class itself.
   * @param commandType the subclass of Tool to register.
   */
  public static register(commandType: EditCommandType) {
    if (!this._isInitialized) {
      this._isInitialized = true;
      if (!IpcHost.isValid)
        throw new Error("Edit Commands require IpcHost");
      EditorAppHandler.register();
    }
    if (commandType.commandId.length !== 0)
      this.commands.set(commandType.commandId, commandType);
  }

  /**
   * Register all the EditCommand classes found in a module.
   * @param modelObj the module to search for subclasses of EditCommand.
   */
  public static registerModule(moduleObj: any) {
    let foundOne = false;
    for (const thisMember in moduleObj) {  // eslint-disable-line guard-for-in
      const thisCmd = moduleObj[thisMember];
      if (thisCmd.prototype instanceof EditCommand) {
        foundOne = true;
        this.register(thisCmd);
      }
    }
    if (!foundOne)
      throw new Error(`no EditCommands found - are you sure this is a module? Maybe you meant to call "register"?`);
  }
}
