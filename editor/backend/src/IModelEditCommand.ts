import { IModelDb, _nativeDb } from "@itwin/core-backend";
import { BeDuration, Guid, IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { AsyncLocalStorage } from "async_hooks";

/**
 * Represents a transactional scope that can be saved or abandoned.
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
 */
export enum EditCommandState {
  /** Command has been constructed but not started */
  NotStarted = "NotStarted",

  /** Command is starting (onStart executing) */
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

export interface EditCommandArgs {
  description?: string;
}

const commandExecutionContext = new AsyncLocalStorage<string>();

/**
 * EditScope implementation for iModel transactions to prevent concurrent modifications/saves/abandons.
 */
export class EditScope implements IEditScope {
  public readonly scopeId: string;
  public readonly commandId: string;
  public readonly iModel: IModelDb;
  private _startTxnId?: string;
  public readonly parentScopeId?: string;

  private constructor(iModel: IModelDb, commandId: string, parentScopeId?: string) {
    this.scopeId = Guid.createValue();
    this.iModel = iModel;
    this.commandId = commandId;
    this.parentScopeId = parentScopeId;

    // Capture starting transaction ID
    if (iModel.isBriefcaseDb()) {
      this._startTxnId = iModel.txns.getCurrentTxnId();
    }
  }

  public static start(iModel: IModelDb, commandId: string): EditScope {
    iModel[_nativeDb].beginMultiTxnOperation();

    // Check if this command is being called from within another command's execution
    const executingCommandId = commandExecutionContext.getStore();
    const activeScope = IModelDb.activeEditScope();
    const isNested = executingCommandId !== undefined && activeScope?.commandId === executingCommandId;

    if (isNested) {
      const scope = new EditScope(iModel, commandId, activeScope?.scopeId);
      // Enqueue to front of queue (stack behavior for nested calls)
      IModelDb.enqueueNestedEditScope({ scopeId: scope.scopeId, commandId: scope.commandId } as any);
      console.log(`Created nested scope ${scope.scopeId} (${commandId}) from executing command ${executingCommandId}`);
      return scope;
    }

    // External command - enqueue normally
    const scope = new EditScope(iModel, commandId);
    IModelDb.enqueueEditScope({ scopeId: scope.scopeId, commandId: scope.commandId } as any);
    console.log(`Created top-level scope ${scope.scopeId} (${commandId})`);
    return scope;
  }

  private end(): void {
    if (IModelDb.activeEditScope()?.scopeId !== this.scopeId) {
      throw new IModelError(IModelStatus.BadRequest, "What the hell went wrong ?!?! How is this not the active scope ? How did we even get here !?");
    }
    this.iModel[_nativeDb].endMultiTxnOperation();
    IModelDb.dequeueEditScope();
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.isActive) {
      throw new Error("Cannot run operation - scope is not active");
    }

    console.log(`Running operation from edit scope for ${this.scopeId} : ${this.commandId}`)
    return await operation();
  }

  public get isActive(): boolean {
    const activeScope = IModelDb.activeEditScope();
    return activeScope !== undefined && activeScope.scopeId === this.scopeId && activeScope.commandId === this.commandId;
  }

  public async saveChanges(description: string): Promise<void> {
    // For nested scopes, don't actually save - just mark as completed
    // The parent scope will handle the actual save
    if (this.parentScopeId) {
      console.log(`Nested scope ${this.scopeId} skipping save, parent will handle it`);
      this.end();
      return;
    }

    if (!this.isActive) {
      throw new Error("Cannot save - scope is not active");
    }

    let errorCaught: any = undefined;
    try {
      this.iModel.saveChanges(description);
    } catch (error) {
      errorCaught = error;
    } finally {
      this.end();

      if (errorCaught) {
        throw errorCaught;
      }
    }
  }

  public async abandonChanges(): Promise<void> {
    // For nested scopes, don't actually abandon - just unwind
    // The parent scope will handle the actual abandon
    if (this.parentScopeId) {
      console.log(`Nested scope ${this.scopeId} skipping abandon, parent will handle it`);
      this.end();
      return;
    }

    if (!this.isActive)
      throw new Error("Cannot abandon - scope is not active");

    try {
      this.iModel.abandonChanges();

      // Roll back to starting transaction if needed
      if (this.iModel.isBriefcaseDb() && this._startTxnId) {
        const currentTxnId = this.iModel.txns.getCurrentTxnId();
        if (this._startTxnId !== currentTxnId) {
          this.iModel.txns.cancelTo(this._startTxnId);
        }
      }
    } finally {
      this.end();
    }
  }
}

export abstract class ImmediateCommand<TArgs extends EditCommandArgs = EditCommandArgs, TResult = void> {
  protected _commandId: string;
  protected _iModel: IModelDb;
  private _state = EditCommandState.NotStarted;

  private _editScope?: EditScope;

  constructor(iModel: IModelDb) {
    this._iModel = iModel;
    this._commandId = Guid.createValue();
  }

  public get iModel(): IModelDb {
    return this._iModel;
  }

  public get state(): EditCommandState {
    return this._state;
  }

  public get editScope(): EditScope | undefined {
    return this._editScope;
  }

  /**
   * Override to perform work before saving.
   * Called automatically during saveChanges().
   */
  protected async onBeforeSave(): Promise<void> {
    // Default: no-op
  }

  /**
   * Override to perform work after saving.
   * Called automatically after scope.saveChanges().
   */
  protected async onAfterSave(): Promise<void> {
    // Default: no-op
  }

  /**
   * Override to perform work before abandoning.
   * Called automatically during abandonChanges().
   */
  protected async onBeforeAbandon(): Promise<void> {
    // Default: no-op
  }

  /**
   * Override to perform work after abandoning.
   * Called automatically after scope.abandon().
   */
  protected async onAfterAbandon(): Promise<void> {
    // Default: no-op
  }

  /**
   * Override of EditCommand.onStart().
   * DO NOT OVERRIDE.
   */
  // TODO Rohit: This is a bit too generic. OS+ is using Zod to validate the arguments supplied. Right now, any args will do and anything goes. Maybe look into that ?
  public async execute(
    args: TArgs,
    fn: (args: TArgs) => Promise<TResult>
  ): Promise<TResult> {
    if (this._state !== EditCommandState.NotStarted) {
      throw new Error(`Cannot start EditCommand in state ${this._state}`);
    }

    this._state = EditCommandState.Starting;

    try {
      // Create the scope
      console.log("\nHere 1: ")
      IModelDb.printQueue();
      this._editScope = EditScope.start(this._iModel, this._commandId);
      console.log("\nHere 2: ")
      IModelDb.printQueue();

      const isNestedCommand = !!this._editScope.parentScopeId;

      // TODO Rohit: Review/replace this polling logic. This race condition is inherent what we have right ?
      // Block until the our edit scope is ready for execution
      let retries = 10;
      while (true) {
        if (this._editScope.isActive)
          break;
        await BeDuration.fromMilliseconds(1000).wait();
        if (--retries === 0) {
          throw new Error("EditScope did not become active");
        }
      }

      // Execute within the command's context
      const result = await commandExecutionContext.run(this._commandId, async () => {
        return await this.editScope?.execute(() => fn(args));
      });

      this._state = EditCommandState.Active;

      if (result === undefined) {
        throw new Error("EditScope execution did not return a result.");
      }

      // Only save if this is a top-level command
      // Nested commands just return their result and let parent handle saving
      if (!isNestedCommand) {
        await this.saveChanges(args.description ?? `Saved ${this._commandId} changes`);
      } else {
        console.log(`Nested command ${this._editScope.scopeId} completing without save`);
        this._state = EditCommandState.Completed;
        // Clean up the nested scope from the queue
        if (this._editScope) {
          await this._editScope.saveChanges(args.description ?? `Nested command completed`);
        }
      }

      return result;
    } catch (error) {
      this._state = EditCommandState.Failed;

      await this.abandonChanges();

      throw error;
    }
  }

  /**
   * Save all changes made by this command.
   */
  public async saveChanges(description: string): Promise<void> {
    if (this._state !== EditCommandState.Active) {
      throw new Error(`Cannot save EditCommand in state ${this._state}`);
    }

    if (!this._editScope) {
      throw new Error("EditCommand has no scope - was onStart() called?");
    }

    this._state = EditCommandState.Saving;

    try {
      await this.onBeforeSave();
      await this._editScope?.saveChanges(description);
      await this.onAfterSave();

      this._state = EditCommandState.Completed;
    } catch (error) {
      this._state = EditCommandState.Failed;

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
    // Allow abandon from Active or Failed states
    if (this._state !== EditCommandState.Active && this._state !== EditCommandState.Failed) {
      throw new Error(`Cannot abandon EditCommand in state ${this._state}`);
    }

    if (!this._editScope) {
      throw new Error("EditCommand has no scope - was onStart() called?");
    }

    this._state = EditCommandState.Abandoning;

    try {
      await this.onBeforeAbandon();
      await this._editScope?.abandonChanges();
      await this.onAfterAbandon();

      this._state = EditCommandState.Abandoned;
    } catch (error) {
      this._state = EditCommandState.Failed;
      throw error;
    }
  }
}