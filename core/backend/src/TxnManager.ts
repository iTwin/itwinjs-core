/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { BeEvent, CompressedId64Set, DbResult, Id64String, IModelStatus, OrderedId64Array } from "@bentley/bentleyjs-core";
import { ChangedEntities, ModelGeometryChangesProps, ModelIdAndGeometryGuid } from "@bentley/imodeljs-common";
import { BriefcaseDb, StandaloneDb } from "./IModelDb";
import { IpcHost } from "./IpcHost";
import { Relationship, RelationshipProps } from "./Relationship";
import { SqliteStatement } from "./SqliteStatement";

/** A string that identifies a Txn.
 * @public
 */
export type TxnIdString = string;

/** An error generated during dependency validation.
 * @beta
 */
export interface ValidationError {
  /** If true, txn is aborted. */
  fatal: boolean;
  /** The type of error. */
  errorType: string;
  /** Optional description of what went wrong. */
  message?: string;
}

/**
 * @beta
 */
export interface TxnChangedEntities {
  inserted: OrderedId64Array;
  deleted: OrderedId64Array;
  updated: OrderedId64Array;
}

type EntitiesChangedEvent = BeEvent<(changes: TxnChangedEntities) => void>;

/** Strictly for tests. @internal */
export function setMaxEntitiesPerEvent(max: number): number {
  const prevMax = ChangedEntitiesProc.maxPerEvent;
  ChangedEntitiesProc.maxPerEvent = max;
  return prevMax;
}

class ChangedEntitiesProc implements TxnChangedEntities {
  public static maxPerEvent = 1000;

  public inserted = new OrderedId64Array();
  public deleted = new OrderedId64Array();
  public updated = new OrderedId64Array();
  private _currSize = 0;

  private compressIds(): ChangedEntities {
    const toCompressedIds = (idArray: OrderedId64Array) => idArray.isEmpty ? undefined : CompressedId64Set.compressIds(idArray);
    return { inserted: toCompressedIds(this.inserted), deleted: toCompressedIds(this.deleted), updated: toCompressedIds(this.updated) };
  }

  private sendEvent(iModel: BriefcaseDb | StandaloneDb, evt: EntitiesChangedEvent, evtName: "notifyElementsChanged" | "notifyModelsChanged") {
    if (this._currSize > 0) {
      evt.raiseEvent(this); // send to backend listeners
      IpcHost.notifyTxns(iModel, evtName, this.compressIds()); // now notify frontend listeners
      this.inserted.clear();
      this.deleted.clear();
      this.updated.clear();
      this._currSize = 0;
    }
  }

  public static process(iModel: BriefcaseDb | StandaloneDb, mgr: TxnManager): void {
    if (mgr.isDisposed) {
      // The iModel is being closed. Do not prepare new sqlite statements.
      return;
    }

    this.processChanges(iModel, mgr.onElementsChanged, "notifyElementsChanged");
    this.processChanges(iModel, mgr.onModelsChanged, "notifyModelsChanged");
  }

  private static processChanges(iModel: BriefcaseDb | StandaloneDb, changedEvent: EntitiesChangedEvent, evtName: "notifyElementsChanged" | "notifyModelsChanged") {
    try {
      const maxSize = this.maxPerEvent;
      const changes = new ChangedEntitiesProc();
      const select = "notifyElementsChanged" === evtName
        ? "SELECT ElementId, ChangeType FROM temp.txn_Elements"
        : "SELECT ModelId, ChangeType FROM temp.txn_Models";
      iModel.withPreparedSqliteStatement(select, (sql: SqliteStatement) => {
        const stmt = sql.stmt!;
        while (sql.step() === DbResult.BE_SQLITE_ROW) {
          const id = stmt.getValueId(0);
          switch (stmt.getValueInteger(1)) {
            case 0:
              changes.inserted.insert(id);
              break;
            case 1:
              changes.updated.insert(id);
              break;
            case 2:
              changes.deleted.insert(id);
              break;
          }

          if (++changes._currSize >= maxSize)
            changes.sendEvent(iModel, changedEvent, evtName);
        }
      });

      changes.sendEvent(iModel, changedEvent, evtName);
    } catch (_) {
      // Presumably, the temp txn tables don't exist, because the native TxnManager is not tracking changes.
      // This occurs when the application is using a "pull-only" briefcase - they open the briefcase as read-write temporarily,
      // apply some pulled changesets, and then reopen in read-only mode.
      // During the read-write phase, we're not tracking changes, and the application isn't interested in the events we'd otherwise generate here.
    }
  }
}

/**
 * Manages local changes to an iModel via [Txns]($docs/learning/InteractiveEditing.md)
 * @beta
 */
export class TxnManager {
  /** @internal */
  private _isDisposed = false;

  /** @internal */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /** @internal */
  constructor(private _iModel: BriefcaseDb | StandaloneDb) {
    _iModel.onBeforeClose.addOnce(() => {
      this._isDisposed = true;
    });
  }

  /** Array of errors from dependency propagation */
  public readonly validationErrors: ValidationError[] = [];

  private get _nativeDb() { return this._iModel.nativeDb; }
  private _getElementClass(elClassName: string): typeof Element {
    return this._iModel.getJsClass(elClassName) as unknown as typeof Element;
  }
  private _getRelationshipClass(relClassName: string): typeof Relationship {
    return this._iModel.getJsClass<typeof Relationship>(relClassName);
  }
  /** @internal */
  protected _onBeforeOutputsHandled(elClassName: string, elId: Id64String): void {
    (this._getElementClass(elClassName) as any).onBeforeOutputsHandled(elId, this._iModel);
  }
  /** @internal */
  protected _onAllInputsHandled(elClassName: string, elId: Id64String): void {
    (this._getElementClass(elClassName) as any).onAllInputsHandled(elId, this._iModel);
  }
  /** @internal */
  protected _onRootChanged(props: RelationshipProps): void {
    this._getRelationshipClass(props.classFullName).onRootChanged(props, this._iModel);
  }
  /** @internal */
  protected _onValidateOutput(props: RelationshipProps): void {
    this._getRelationshipClass(props.classFullName).onValidateOutput(props, this._iModel);
  }
  /** @internal */
  protected _onDeletedDependency(props: RelationshipProps): void {
    this._getRelationshipClass(props.classFullName).onDeletedDependency(props, this._iModel);
  }
  /** @internal */
  protected _onBeginValidate() { this.validationErrors.length = 0; }

  /** called from native code after validation of a Txn, either from saveChanges or apply changeset.
   * @internal
   */
  protected _onEndValidate() {
    ChangedEntitiesProc.process(this._iModel, this);
    this.onEndValidation.raiseEvent();
  }

  /** @internal */
  protected _onGeometryChanged(modelProps: ModelGeometryChangesProps[]) {
    this.onGeometryChanged.raiseEvent(modelProps);
    IpcHost.notifyEditingSession(this._iModel, "notifyGeometryChanged", modelProps); // send to frontend
  }

  /** @internal */
  protected _onGeometryGuidsChanged(changes: ModelIdAndGeometryGuid[]): void {
    this.onModelGeometryChanged.raiseEvent(changes);
    IpcHost.notifyTxns(this._iModel, "notifyGeometryGuidsChanged", changes);
  }

  /** @internal */
  protected _onCommit() {
    this.onCommit.raiseEvent();
    IpcHost.notifyTxns(this._iModel, "notifyCommit");
  }

  /** @internal */
  protected _onCommitted() {
    this.onCommitted.raiseEvent();
    IpcHost.notifyTxns(this._iModel, "notifyCommitted");
  }

  /** @internal */
  protected _onChangesApplied() {
    ChangedEntitiesProc.process(this._iModel, this);
    this.onChangesApplied.raiseEvent();
    IpcHost.notifyTxns(this._iModel, "notifyChangesApplied");
  }

  /** @internal */
  protected _onBeforeUndoRedo(isUndo: boolean) {
    this.onBeforeUndoRedo.raiseEvent(isUndo);
    IpcHost.notifyTxns(this._iModel, "notifyBeforeUndoRedo", isUndo);
  }

  /** @internal */
  protected _onAfterUndoRedo(isUndo: boolean) {
    this.onAfterUndoRedo.raiseEvent(isUndo);
    IpcHost.notifyTxns(this._iModel, "notifyAfterUndoRedo", isUndo);
  }

  /** Dependency handlers may call method this to report a validation error.
   * @param error The error. If error.fatal === true, the transaction will cancel rather than commit.
   */
  public reportError(error: ValidationError) { this.validationErrors.push(error); this._nativeDb.logTxnError(error.fatal); }

  /** Determine whether any fatal validation errors have occurred during dependency propagation.  */
  public get hasFatalError(): boolean { return this._nativeDb.hasFatalTxnError(); }

  /** @internal */
  public readonly onEndValidation = new BeEvent<() => void>();

  /** Called after validation completes from [[IModelDb.saveChanges]].
   * The argument to the event holds the list of elements that were inserted, updated, and deleted.
   * @note If there are many changed elements in a single Txn, the notifications are sent in batches so this event *may be called multiple times* per Txn.
   */
  public readonly onElementsChanged = new BeEvent<(changes: TxnChangedEntities) => void>();

  /** Called after validation completes from [[IModelDb.saveChanges]].
   * The argument to the event holds the list of models that were inserted, updated, and deleted.
   * @note If there are many changed models in a single Txn, the notifications are sent in batches so this event *may be called multiple times* per Txn.
   */
  public readonly onModelsChanged = new BeEvent<(changes: TxnChangedEntities) => void>();

  /** Event raised after the geometry within one or more [[GeometricModel]]s is modified by applying a changeset or validation of a transaction.
   * A model's geometry can change as a result of:
   *  - Insertion or deletion of a geometric element within the model; or
   *  - Modification of an existing element's geometric properties; or
   *  - An explicit request to flag it as changed via [[IModelDb.Models.updateModel]].
   */
  public readonly onModelGeometryChanged = new BeEvent<(changes: ReadonlyArray<ModelIdAndGeometryGuid>) => void>();

  public readonly onGeometryChanged = new BeEvent<(models: ModelGeometryChangesProps[]) => void>();
  /** Event raised before a commit operation is performed. Initiated by a call to [[IModelDb.saveChanges]], unless there are no changes to save. */
  public readonly onCommit = new BeEvent<() => void>();
  /** Event raised after a commit operation has been performed. Initiated by a call to [[IModelDb.saveChanges]], even if there were no changes to save. */
  public readonly onCommitted = new BeEvent<() => void>();
  /** Event raised after a ChangeSet has been applied to this briefcase */
  public readonly onChangesApplied = new BeEvent<() => void>();
  /** Event raised before an undo/redo operation is performed. */
  public readonly onBeforeUndoRedo = new BeEvent<(isUndo: boolean) => void>();
  /** Event raised after an undo/redo operation has been performed.
   * @param _action The action that was performed.
   */
  public readonly onAfterUndoRedo = new BeEvent<(isUndo: boolean) => void>();

  /** Determine whether undo is possible, optionally permitting undoing txns from previous sessions.
   * @param allowCrossSessions if true, allow undoing from previous sessions.
   */
  public checkUndoPossible(allowCrossSessions?: boolean) { return this._nativeDb.isUndoPossible(allowCrossSessions); }

  /** Determine if there are currently any reversible (undoable) changes from this editing session. */
  public get isUndoPossible(): boolean { return this._nativeDb.isUndoPossible(); }

  /** Determine if there are currently any reinstatable (redoable) changes */
  public get isRedoPossible(): boolean { return this._nativeDb.isRedoPossible(); }

  /** Get the description of the operation that would be reversed by calling reverseTxns(1).
   * This is useful for showing the operation that would be undone, for example in a menu.
   * @param allowCrossSessions if true, allow undo from previous sessions.
   */
  public getUndoString(allowCrossSessions?: boolean): string { return this._nativeDb.getUndoString(allowCrossSessions); }

  /** Get a description of the operation that would be reinstated by calling reinstateTxn.
   * This is useful for showing the operation that would be redone, in a pull-down menu for example.
   */
  public getRedoString(): string { return this._nativeDb.getRedoString(); }

  /** Begin a new multi-Txn operation. This can be used to cause a series of Txns that would normally
   * be considered separate actions for undo to be grouped into a single undoable operation. This means that when reverseTxns(1) is called,
   * the entire group of changes are undone together. Multi-Txn operations can be nested and until the outermost operation is closed
   * all changes constitute a single operation.
   * @note This method must always be paired with a call to endMultiTxnAction.
   */
  public beginMultiTxnOperation(): DbResult { return this._nativeDb.beginMultiTxnOperation(); }

  /** End a multi-Txn operation */
  public endMultiTxnOperation(): DbResult { return this._nativeDb.endMultiTxnOperation(); }

  /** Return the depth of the multi-Txn stack. Generally for diagnostic use only. */
  public getMultiTxnOperationDepth(): number { return this._nativeDb.getMultiTxnOperationDepth(); }

  /** Reverse (undo) the most recent operation(s) to this IModelDb.
   * @param numOperations the number of operations to reverse. If this is greater than 1, the entire set of operations will
   *  be reinstated together when/if ReinstateTxn is called.
   * @param allowCrossSessions if true, allow undo from previous sessions.
   * @note If there are any outstanding uncommitted changes, they are reversed.
   * @note The term "operation" is used rather than Txn, since multiple Txns can be grouped together via [[beginMultiTxnOperation]]. So,
   * even if numOperations is 1, multiple Txns may be reversed if they were grouped together when they were made.
   * @note If numOperations is too large only the operations are reversible are reversed.
   */
  public reverseTxns(numOperations: number, allowCrossSessions?: boolean): IModelStatus {
    return this._iModel.reverseTxns(numOperations, allowCrossSessions);
  }

  /** Reverse the most recent operation. */
  public reverseSingleTxn(): IModelStatus { return this.reverseTxns(1); }

  /** Reverse all changes back to the beginning of the session. */
  public reverseAll(): IModelStatus { return this._nativeDb.reverseAll(); }

  /** Reverse all changes back to a previously saved TxnId.
   * @param txnId a TxnId obtained from a previous call to GetCurrentTxnId.
   * @param allowCrossSessions if true, allow undo from previous sessions.
   * @returns Success if the transactions were reversed, error status otherwise.
   * @see  [[getCurrentTxnId]] [[cancelTo]]
   */
  public reverseTo(txnId: TxnIdString, allowCrossSessions?: boolean): IModelStatus { return this._nativeDb.reverseTo(txnId, allowCrossSessions); }

  /** Reverse and then cancel (make non-reinstatable) all changes back to a previous TxnId.
   * @param txnId a TxnId obtained from a previous call to [[getCurrentTxnId]]
   * @param allowCrossSessions if true, allow undo from previous sessions.
   * @returns Success if the transactions were reversed and cleared, error status otherwise.
   */
  public cancelTo(txnId: TxnIdString, allowCrossSessions?: boolean): IModelStatus { return this._nativeDb.cancelTo(txnId, allowCrossSessions); }

  /** Reinstate the most recently reversed transaction. Since at any time multiple transactions can be reversed, it
   * may take multiple calls to this method to reinstate all reversed operations.
   * @returns Success if a reversed transaction was reinstated, error status otherwise.
   * @note If there are any outstanding uncommitted changes, they are canceled before the Txn is reinstated.
   */
  public reinstateTxn(): IModelStatus { return this._iModel.reinstateTxn(); }

  /** Get the Id of the first transaction, if any.
   * @param allowCrossSessions if true, allow undo from previous sessions.
   */
  public queryFirstTxnId(allowCrossSessions?: boolean): TxnIdString { return this._nativeDb.queryFirstTxnId(allowCrossSessions); }

  /** Get the successor of the specified TxnId */
  public queryNextTxnId(txnId: TxnIdString): TxnIdString { return this._nativeDb.queryNextTxnId(txnId); }

  /** Get the predecessor of the specified TxnId */
  public queryPreviousTxnId(txnId: TxnIdString): TxnIdString { return this._nativeDb.queryPreviousTxnId(txnId); }

  /** Get the Id of the current (tip) transaction.  */
  public getCurrentTxnId(): TxnIdString { return this._nativeDb.getCurrentTxnId(); }

  /** Get the description that was supplied when the specified transaction was saved. */
  public getTxnDescription(txnId: TxnIdString): string { return this._nativeDb.getTxnDescription(txnId); }

  /** Test if a TxnId is valid */
  public isTxnIdValid(txnId: TxnIdString): boolean { return this._nativeDb.isTxnIdValid(txnId); }

  /** Query if there are any pending Txns in this IModelDb that are waiting to be pushed.  */
  public get hasPendingTxns(): boolean { return this._nativeDb.hasPendingTxns(); }

  /** Query if there are any changes in memory that have yet to be saved to the IModelDb. */
  public get hasUnsavedChanges(): boolean { return this._nativeDb.hasUnsavedChanges(); }

  /** Query if there are un-saved or un-pushed local changes. */
  public get hasLocalChanges(): boolean { return this.hasUnsavedChanges || this.hasPendingTxns; }

}
