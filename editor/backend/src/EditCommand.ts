/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { IModelStatus } from "@itwin/core-bentley";
import { IModelDb, IpcHandler, IpcHost } from "@itwin/core-backend";
import { IModelError } from "@itwin/core-common";
import { EditCommandIpc, editorChannel, EditorIpc } from "@itwin/editor-common";

/** @alpha */
export type EditCommandType = typeof EditCommand;

/**
 * An EditCommand performs an editing action on the backend. EditCommands are usually paired with and driven by EditTools on the frontend.
 * EditCommands have a *commandId* that uniquely identifies them, so they can be found via a lookup in the [[EditCommandAdmin]].
 * Every time an EditCommand runs, a new instance of (a subclass of) this class is created.
 * @alpha
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
  public get ctor(): EditCommandType { return this.constructor as EditCommandType; }

  public async onStart(): Promise<any> { }

  public async ping(): Promise<{ commandId: string, version: string, [propName: string]: any }> {
    return { version: this.ctor.version, commandId: this.ctor.commandId };
  }

  public onCleanup(): void { }

  public onFinish(): void { }
}

class EditorAppHandler extends IpcHandler implements EditorIpc {
  public get channelName() { return editorChannel; }

  public async startCommand(commandId: string, iModelKey: string, ...args: any[]) {
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

/** EditCommandAdmin holds a mapping between commandIds and their corresponding [[EditCommand]] class. This provides the mechanism to
 * run EditCommands by commandId.
 * It also keeps track of the currently active EditCommand. When a new EditCommand starts, the active EditCommand is terminated.
 * @alpha
 */
export class EditCommandAdmin {
  public static readonly commands = new Map<string, EditCommandType>();

  private static _activeCommand?: EditCommand;
  private static _isInitialized = false;
  public static get activeCommand() { return this._activeCommand; }

  public static runCommand(cmd?: EditCommand) {
    if (this._activeCommand)
      this._activeCommand.onFinish();
    this._activeCommand = cmd;
    return cmd ? cmd.onStart() : undefined;
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
