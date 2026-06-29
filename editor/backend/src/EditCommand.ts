/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { IModelStatus } from "@itwin/core-bentley";
import { EditTxn, IModelDb, IpcHandler, IpcHost } from "@itwin/core-backend";
import { BackendError, IModelError, SaveChangesArgs } from "@itwin/core-common";
import { EditCommandIpc, EditorIpc, editorIpcStrings } from "@itwin/editor-common";

/** @beta */
export type EditCommandType = typeof EditCommand;

/**
 * An EditCommand performs an editing action on the backend.
 * Any writes to the iModel in an editing session should be done from an EditCommand:
 * - All changes to an iModel are made within a transaction (Txn).
 * - Calling SaveChanges ends the current Txn and starts a new one.
 * - Using EditCommand ensures all of the changes in a Txn are from the same source, as only one EditCommand may be active at a time.
 * - Because there is currently no way to enforce this, it is important that all applications follow this rule.
 * EditCommands are usually paired with and driven by EditTools on the frontend that can either be interactive tools or immediate tools.
 * Interactive EditTools:
 * - Can be a [PrimitiveTool]($frontend).
 * - Can be an [InputCollector]($frontend) in special cases such as [EditManipulator.HandleTool]($frontend).
 * - Should not be a [ViewTool]($frontend), these should never write changes to the iModel.
 * Immediate EditTools:
 * - As direct subclasses of [Tool]($frontend) that perform their function without further input or becoming the active tool,
 * they potentially leave the current [PrimitiveTool]($frontend) in an invalid state.
 * - To avoid issues, immediate tools that start an EditCommand must call [ToolAdmin.restartPrimitiveTool]($frontend) when they complete.
 * EditCommands have a *commandId* that uniquely identifies them, so they can be found via a lookup in the [[EditCommandAdmin]].
 * Each EditCommand must be registered in the [[EditCommandAdmin]] with [[EditCommandAdmin.register]] or [[EditCommandAdmin.registerModule]].
 * Every time an EditCommand runs, a new instance of (a subclass of) this class is created.
 * @see [[BasicManipulationCommand]] for an example EditCommand.
 * @beta
 */

export class EditCommand implements EditCommandIpc {
  /** The unique string that identifies this EditCommand class. This must be overridden in every subclass. */
  public static commandId = "";
  public static version = "1.0.0";

  /** The iModel this EditCommand may modify. */
  public readonly iModel: IModelDb;

  /** The explicit editing transaction for this command. Subclasses use this to perform writes to the iModel. */
  protected readonly txn: EditTxn;

  /** Application-specific data included when this command commits its EditTxn. */
  protected appData?: SaveChangesArgs["appData"];

  public constructor(iModel: IModelDb, ..._args: any[]) {
    this.iModel = iModel;
    this.txn = new EditTxn(iModel, this.ctor.name);
  }
  public get ctor(): EditCommandType {
    return this.constructor as EditCommandType;
  }

  public async onStart(): Promise<any> { }

  /** Start this command's transaction if it has not already started. */
  protected beginEditing(): void {
    if (!this.txn.isActive)
      this.txn.start();
  }

  /** Returns true if this command's transaction is currently active. */
  public get isTxnActive(): boolean {
    return this.txn.isActive;
  }

  /** Abandon any pending changes and end this command's EditTxn */
  public async abandonEdits(): Promise<void> {
    if (this.txn.isActive)
      this.txn.end("abandon");
  }

  /** Save all pending edits and end this command's EditTxn */
  public async endEdits(description?: string): Promise<void> {
    if (this.txn.isActive)
      this.txn.end("save", this.resolveSaveChangesArg(description));
  }

  public async ping(): Promise<{ commandId: string, version: string, [propName: string]: any }> {
    return { version: this.ctor.version, commandId: this.ctor.commandId, iModelKey: this.iModel.key };
  }

  /** Save any pending changes on this command's EditTxn. Leaves the EditTxn active for further edits.
   * @param description Optional description saved with the changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    if (this.txn.isActive)
      this.txn.saveChanges(this.resolveSaveChangesArg(description));
  }

  /** Abandon any pending changes on this command's EditTxn. Leaves the EditTxn active for further edits. */
  public async abandonChanges(): Promise<void> {
    if (this.txn.isActive)
      this.txn.abandonChanges();
  }

  /**
   * Called when another EditCommand wishes to become the active EditCommand.
   * The default implementation abandons pending edits (does not save changes) and returns "done".
   * Subclasses should complete and call end their work as soon as possible before returning "done".
   * If it is not currently possible to finish, return any string other than "done" and the other EditCommand will have to wait and retry,
   * potentially showing the returned string to the user.
   */
  public async requestFinish(): Promise<"done" | string> {  // eslint-disable-line @typescript-eslint/no-redundant-type-constituents
    await this.abandonEdits(); // by default, don't save changes. Subclasses must determine whether they are valid and save them themselves
    return "done";
  }

  private resolveSaveChangesArg(description?: string): SaveChangesArgs {
    return { description: description ?? this.ctor.name, source: this.ctor.commandId, appData: this.appData };
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
      throw new IModelError(IModelStatus.NoActiveCommand, `No active command`, { methodName });

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
