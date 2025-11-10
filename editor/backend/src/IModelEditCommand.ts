import { _nativeDb, IModelDb } from "@itwin/core-backend";
import { BeDuration, Guid } from "@itwin/core-bentley";
import { AsyncLocalStorage } from "async_hooks";

// This rule was deprecated in ESLint v8.46.0.
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Represents a transactional scope that can be saved or abandoned.
 * @alpha
 */
export interface IEditScope {
  /** Unique identifier for this scope */
  readonly scopeId: string;

  /** Whether this scope is currently active */
  readonly isActive: boolean;

  /** Save all changes made within this scope. Throws on error.*/
  saveChanges(description: string): Promise<void>;

  /** Abandon all changes made within this scope. Throws on error.*/
  abandonChanges(): Promise<void>;
}

/**
 * Lifecycle states for an EditCommand.
 * @alpha
 */
export enum EditCommandState {
  /** Command has been constructed but not started */
  NotStarted = "NotStarted",

  /** Command is starting */
  Starting = "Starting",

  /** Command is active and ready for operations */
  Active = "Active",

  /** Command is saving changes */
  Saving = "Saving",

  /** Command is abandoning changes */
  Abandoning = "Abandoning",

  /** Command completed successfully */
  Completed = "Completed",

  /** Command was abandoned */
  Abandoned = "Abandoned",

  /** Command failed with an error */
  Failed = "Failed",
}

/**
 * Types of EditCommands.
 * @alpha
 */
export enum CommandType {
  Immediate = "Immediate",
  Interactive = "Interactive",
}

/**
 * Arguments for the command to use
 * @alpha
 */
export interface EditCommandArgs {
  description?: string;
}

/**
 * EditScope implementation for iModel transactions to prevent concurrent modifications/saves/abandons.
 * @alpha
 */
export class EditScope implements IEditScope {
  public readonly scopeId: string;
  private readonly iModel: IModelDb;
  public readonly parentScopeId?: string;
  private readonly startTxnId?: string;
  private readonly commandType: CommandType;

  private _state = EditCommandState.NotStarted;

  // TODO Rohit: Review access modifier
  public static commandExecutionContext = new AsyncLocalStorage<string[]>();

  private constructor(iModel: IModelDb, commandType: CommandType, parentScopeId?: string) {
    this.scopeId = Guid.createValue();
    this.iModel = iModel;
    this.parentScopeId = parentScopeId;
    this.commandType = commandType;

    // Capture starting transaction ID
    if (iModel.isBriefcaseDb()) {
      this.startTxnId = iModel.txns.getCurrentTxnId();
    }
  }

  public get state(): EditCommandState {
    return this._state;
  }

  public set state(newState: EditCommandState) {
    this._state = newState;
  }

  public get isActive(): boolean {
    const activeScope = IModelDb.activeEditScope();

    if (activeScope === undefined) {
      return false;
    }

    // For a scope to be considered active, it should satisfy either of the following:
    // 1. The scope's id should match the currently active scope's id exactly.
    // 2. The scope is a nested command AND its parent's scope id matches the currently active scope's id.

    // Direct match - this scope is the active scope
    if (activeScope.scopeId === this.scopeId) {
      return true;
    }

    // Nested command check - this command's parent is the active scope
    // AND we're being called from within that parent's execution context
    if (this.parentScopeId !== undefined && activeScope.scopeId === this.parentScopeId) {
      const executingScopeIds = EditScope.commandExecutionContext.getStore();
      // Check if we're within the execution context of the parent scope as we might be multiple nested levels deep
      return executingScopeIds !== undefined && executingScopeIds.includes(activeScope.scopeId);
    }

    return false;
  }

  public static start(iModel: IModelDb, commandType: CommandType): EditScope {
    // Check if this command is being called from within another command's execution context
    const activeScope = IModelDb.activeEditScope();

    if (activeScope !== undefined && activeScope.commandType === CommandType.Interactive && commandType === CommandType.Interactive) {
      throw new Error("Cannot start an Interactive EditCommand from within another Interactive EditCommand.");
    }

    const executingScopeIds = EditScope.commandExecutionContext.getStore();
    const isNested = executingScopeIds !== undefined && activeScope !== undefined && executingScopeIds.includes(activeScope.scopeId);
    if (isNested) {
      // Create a new scope that has a parent scope id set
      const nestedScope = new EditScope(iModel, commandType, activeScope.scopeId);
      IModelDb.enqueueNestedEditScope({ scopeId: nestedScope.scopeId, parentScopeId: nestedScope.parentScopeId } as any);
      return nestedScope;
    }

    // External command - enqueue normally
    const scope = new EditScope(iModel, commandType);
    IModelDb.enqueueEditScope({ scopeId: scope.scopeId } as any);
    return scope;
  }

  public end(): void {
    if (this.parentScopeId) {
      IModelDb.dequeueNestedEditScope();
    } else {
      this.iModel[_nativeDb].endMultiTxnOperation();
      IModelDb.dequeueEditScope();
    }
  }

  // TODO Rohit: Review/Remove: Polling ? Really ??
  // Look into a bit more efficient way to figure out when this scope is active
  public async waitForActivation(): Promise<void> {
    // Wait until this scope becomes active before proceeding
    // For nested commands, they should become active immediately if called from parent
    // For external commands, they must wait their turn in the queue
    let retries = 30;
    while (!this.isActive) {
      await BeDuration.fromMilliseconds(1000).wait();
      if (--retries === 0) {
        throw new Error(`EditScope ${this.scopeId} did not become active after waiting`);
      }
    }
  }

  // TODO Rohit: Command Description basically does nothing right now. See how we can extract it from the callback arguments.
  public async execute<T>(operation: (args?: any) => Promise<T>, commandDescription?: string): Promise<T> {
    await this.waitForActivation();

    this._state = EditCommandState.Starting;

    // Begin multi-txn operation for root commands only
    if (this.parentScopeId === undefined) {
      this.iModel[_nativeDb].beginMultiTxnOperation();
    }

    try {
      this._state = EditCommandState.Active;

      // Execute within the command's context
      const result = await operation();

      if (result === undefined) {
        throw new Error("Command execution did not return a result.");
      }

      this._state = EditCommandState.Saving;
      await this.saveChanges(commandDescription ?? `Saved changes`);

      return result;
    } catch (error: any) {
      this._state = EditCommandState.Abandoning;

      await this.abandonChanges();
      this._state = EditCommandState.Failed;

      throw error;
    }
  }

  public async saveChanges(description: string): Promise<void> {
    if (this._state !== EditCommandState.Active && this._state !== EditCommandState.Saving) {
      throw new Error(`Cannot save EditCommand in state ${this._state}`);
    }
    // For nested scopes, don't actually save - just mark as completed
    // The parent scope will handle the actual save
    if (this.parentScopeId) {
      this.end();
      this._state = EditCommandState.Completed;
      return;
    }

    if (!this.isActive) {
      throw new Error("Cannot save - scope is not active");
    }

    try {
      this.iModel.saveChanges(description);
      this._state = EditCommandState.Completed;
    } finally {
      this.end();
    }
  }

  // TODO Rohit: It was straightforward with saves, the parent can call save on the whole lot.
  // But what about abandon?
  // If a nested command fails, do we abandon just the changes made by the command ?
  // I think the all or none approach would be better. The parent can abandon the whole command's work.
  // But what if this command failed, but another nested command succeeded?
  // Maybe have a way to signal to the calling command to fail right away ?
  public async abandonChanges(): Promise<void> {
    if (this._state !== EditCommandState.Active && this._state !== EditCommandState.Failed) {
      throw new Error(`Cannot abandon EditCommand in state ${this._state}`);
    }

    // For nested scopes, don't actually abandon
    // The parent scope will handle the actual abandon
    if (this.parentScopeId) {
      this.end();
      this._state = EditCommandState.Completed;
      return;
    }

    if (!this.isActive)
      throw new Error("Cannot abandon - scope is not active");

    try {
      this.iModel.abandonChanges();

      // Roll back to starting transaction if needed
      if (this.iModel.isBriefcaseDb() && this.startTxnId) {
        const currentTxnId = this.iModel.txns.getCurrentTxnId();
        if (this.startTxnId !== currentTxnId) {
          this.iModel.txns.cancelTo(this.startTxnId);
        }
      }
    } finally {
      this.end();
      this._state = EditCommandState.Abandoned;
    }
  }
}

/**
 * @alpha
 */
export abstract class EditCommandBase<_TArgs extends EditCommandArgs = EditCommandArgs, _TResult = void> {
  protected _iModel: IModelDb;
  protected _editScope?: EditScope;

  constructor(iModel: IModelDb) {
    this._iModel = iModel;
  }

  protected async onBeforeSave(): Promise<void> { }
  protected async onBeforeAbandon(): Promise<void> { }

  // Shared save/abandon methods
  /**
   * Save all changes made by this command.
   */
  public async saveChanges(description: string): Promise<void> {
    if (this._editScope?.state !== EditCommandState.Active) {
      throw new Error(`Cannot save EditCommand in state ${this._editScope?.state}`);
    }

    if (!this._editScope) {
      throw new Error("EditCommand has no scope.");
    }

    try {
      await this.onBeforeSave();
      await this._editScope?.saveChanges(description);
    } catch (error) {
      // Try to abandon
      if (this._editScope?.isActive) {
        await this._editScope.abandonChanges();
      }

      throw error;
    }
  }

  /**
   * Abandon all changes made by this command.
   */
  public async abandonChanges(): Promise<void> {
    if (!this._editScope) {
      throw new Error("EditCommand has no scope.");
    }

    try {
      await this.onBeforeAbandon();
      await this._editScope?.abandonChanges();
    } catch (error) {
      throw error;
    }
  }
}

/**
 * @alpha
 */
export abstract class ImmediateCommand<TArgs extends EditCommandArgs = EditCommandArgs, TResult = void> extends EditCommandBase<TArgs, TResult> {
  /**
   * Execute a command operation within a transactional scope.
   * @param args - Arguments for the command execution (includes optional description)
   * @param fn - Callback function to execute. Args are available in the closure.
   * @returns The result of the callback function
   */
  public async execute(
    fn: (args?: TArgs) => Promise<TResult>
  ): Promise<TResult> {
    // Create the scope
    this._editScope = EditScope.start(this._iModel, CommandType.Immediate);

    if (this._editScope === undefined) {
      throw new Error("Failed to create EditScope for command.");
    }

    return await EditScope.commandExecutionContext.run([...EditScope.commandExecutionContext.getStore() ?? [], this._editScope.scopeId], async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return await this._editScope!.execute(async (args) => {
        return await fn(args);
      });
    });
  }
}

/**
 * @alpha
 */
export abstract class InteractiveCommand<TArgs extends EditCommandArgs = EditCommandArgs, TResult = void> extends EditCommandBase<TArgs, TResult> {

  constructor(iModel: IModelDb) {
    super(iModel);
    this._editScope = EditScope.start(this._iModel, CommandType.Interactive);
  }

  // DO NOT OVERRIDE
  public async startCommandScope(): Promise<void> {
    if (!this._editScope) {
      throw new Error("EditCommand has no scope.");
    }

    try {
      await this._editScope.waitForActivation();
    } catch (error) {
      console.log("Error waiting for activation:", error);
      throw error;
    }
  }

  // DO NOT OVERRIDE
  public async endCommandScope(): Promise<void> {
    if (!this._editScope) {
      throw new Error("EditCommand has no scope.");
    }
    this._editScope.end();
  }

  // DO NOT OVERRIDE
  protected async executeOperation<T>(operation: (args?: TArgs) => Promise<T>): Promise<T> {
    if (!this._editScope) {
      throw new Error("EditCommand has no scope.");
    }

    if (!this._editScope.isActive) {
      throw new Error("EditScope is not active.");
    }

    this._editScope.state = EditCommandState.Active;

    return await EditScope.commandExecutionContext.run([...EditScope.commandExecutionContext.getStore() ?? [], this._editScope.scopeId], async () => {
      return await operation();
    });
  }
}