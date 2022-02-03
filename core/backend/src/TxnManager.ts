/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import type { Id64Array, Id64String, IModelStatus} from "@itwin/core-bentley";
import {
  assert, BeEvent, BentleyError, compareStrings, CompressedId64Set, DbResult, IndexMap, Logger, OrderedId64Array,
} from "@itwin/core-bentley";
import type { ChangedEntities, EntityIdAndClassIdIterable, ModelGeometryChangesProps, ModelIdAndGeometryGuid } from "@itwin/core-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import type { BriefcaseDb, StandaloneDb } from "./IModelDb";
import { IpcHost } from "./IpcHost";
import type { Relationship, RelationshipProps } from "./Relationship";
import type { SqliteStatement } from "./SqliteStatement";

/** A string that identifies a Txn.
 * @public
 */
export type TxnIdString = string;

/** An error generated during dependency validation.
 * @see [[TxnManager.validationErrors]].
 * @public
 */
export interface ValidationError {
  /** If true, txn is aborted. */
  fatal: boolean;
  /** The type of error. */
  errorType: string;
  /** Optional description of what went wrong. */
  message?: string;
}

/** Describes a set of [[Element]]s or [[Model]]s that changed as part of a transaction.
 * @see [[TxnManager.onElementsChanged]] and [[TxnManager.onModelsChanged]].
 * @public
 */
export interface TxnChangedEntities {
  /** The entities that were inserted by the transaction. */
  readonly inserts: EntityIdAndClassIdIterable;
  /** The entities that were deleted by the transaction. */
  readonly deletes: EntityIdAndClassIdIterable;
  /** The entities that were modified by the transaction, including any [[Element]]s for which one of their [[ElementAspect]]s was changed. */
  readonly updates: EntityIdAndClassIdIterable;
}

type EntitiesChangedEvent = BeEvent<(changes: TxnChangedEntities) => void>;

/** Strictly for tests. @internal */
export function setMaxEntitiesPerEvent(max: number): number {
  const prevMax = ChangedEntitiesProc.maxPerEvent;
  ChangedEntitiesProc.maxPerEvent = max;
  return prevMax;
}

/** Maintains an ordered array of entity Ids and a parallel array containing the index of the corresponding entity's class Id. */
class ChangedEntitiesArray {
  public readonly entityIds = new OrderedId64Array();
  private readonly _classIndices: number[] = [];
  private readonly _classIds: IndexMap<Id64String>;

  public constructor(classIds: IndexMap<Id64String>) {
    this._classIds = classIds;
  }

  public insert(entityId: Id64String, classId: Id64String): void {
    const entityIndex = this.entityIds.insert(entityId);
    const classIndex = this._classIds.insert(classId);
    assert(classIndex >= 0);
    if (this.entityIds.length !== this._classIndices.length) {
      // New entity - insert corresponding class index entry.
      this._classIndices.splice(entityIndex, 0, classIndex);
    } else {
      // Existing entity - update corresponding class index.
      // (We do this because apparently connectors can (very rarely) change the class Id of an existing element).
      this._classIndices[entityIndex] = classIndex;
    }

    assert(this.entityIds.length === this._classIndices.length);
  }

  public clear(): void {
    this.entityIds.clear();
    this._classIndices.length = 0;
  }

  public addToChangedEntities(entities: ChangedEntities, type: "deleted" | "inserted" | "updated"): void {
    if (this.entityIds.length > 0)
      entities[type] = CompressedId64Set.compressIds(this.entityIds);
  }

  public iterable(classIds: Id64Array): EntityIdAndClassIdIterable {
    function* iterator(entityIds: ReadonlyArray<Id64String>, classIndices: number[]) {
      const entity = { id: "", classId: "" };
      for (let i = 0; i < entityIds.length; i++) {
        entity.id = entityIds[i];
        entity.classId = classIds[classIndices[i]];
        yield entity;
      }
    }

    return {
      [Symbol.iterator]: () => iterator(this.entityIds.array, this._classIndices),
    };
  }
}

class ChangedEntitiesProc {
  private readonly _classIds = new IndexMap<Id64String>((lhs, rhs) => compareStrings(lhs, rhs));
  private readonly _inserted = new ChangedEntitiesArray(this._classIds);
  private readonly _deleted = new ChangedEntitiesArray(this._classIds);
  private readonly _updated = new ChangedEntitiesArray(this._classIds);
  private _currSize = 0;

  public static maxPerEvent = 1000;

  public static process(iModel: BriefcaseDb | StandaloneDb, mgr: TxnManager): void {
    if (mgr.isDisposed) {
      // The iModel is being closed. Do not prepare new sqlite statements.
      return;
    }

    this.processChanges(iModel, mgr.onElementsChanged, "notifyElementsChanged");
    this.processChanges(iModel, mgr.onModelsChanged, "notifyModelsChanged");
  }

  private sendEvent(iModel: BriefcaseDb | StandaloneDb, evt: EntitiesChangedEvent, evtName: "notifyElementsChanged" | "notifyModelsChanged") {
    if (this._currSize === 0)
      return;

    const classIds = this._classIds.toArray();

    // Notify backend listeners.
    const txnEntities: TxnChangedEntities = {
      inserts: this._inserted.iterable(classIds),
      deletes: this._deleted.iterable(classIds),
      updates: this._updated.iterable(classIds),
    };
    evt.raiseEvent(txnEntities);

    // Notify frontend listeners.
    const entities: ChangedEntities = {};
    this._inserted.addToChangedEntities(entities, "inserted");
    this._deleted.addToChangedEntities(entities, "deleted");
    this._updated.addToChangedEntities(entities, "updated");
    IpcHost.notifyTxns(iModel, evtName, entities);

    // Reset state.
    this._inserted.clear();
    this._deleted.clear();
    this._updated.clear();
    this._classIds.clear();
    this._currSize = 0;
  }

  private static processChanges(iModel: BriefcaseDb | StandaloneDb, changedEvent: EntitiesChangedEvent, evtName: "notifyElementsChanged" | "notifyModelsChanged") {
    try {
      const maxSize = this.maxPerEvent;
      const changes = new ChangedEntitiesProc();
      const select = "notifyElementsChanged" === evtName
        ? "SELECT ElementId, ChangeType, ECClassId FROM temp.txn_Elements"
        : "SELECT ModelId, ChangeType, ECClassId FROM temp.txn_Models";
      iModel.withPreparedSqliteStatement(select, (sql: SqliteStatement) => {
        const stmt = sql.stmt!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        while (sql.step() === DbResult.BE_SQLITE_ROW) {
          const id = stmt.getValueId(0);
          const classId = stmt.getValueId(2);
          switch (stmt.getValueInteger(1)) {
            case 0:
              changes._inserted.insert(id, classId);
              break;
            case 1:
              changes._updated.insert(id, classId);
              break;
            case 2:
              changes._deleted.insert(id, classId);
              break;
          }

          if (++changes._currSize >= maxSize)
            changes.sendEvent(iModel, changedEvent, evtName);
        }
      });

      changes.sendEvent(iModel, changedEvent, evtName);
    } catch (err) {
      Logger.logError(BackendLoggerCategory.IModelDb, BentleyError.getErrorMessage(err));
    }
  }
}

/** Manages local changes to a [[BriefcaseDb]] or [[StandaloneDb]] via [Txns]($docs/learning/InteractiveEditing.md)
 * @public
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
    // TODO: if (this.validationErrors.length !== 0) throw new IModelError(validation ...)
  }

  /** @internal */
  protected _onGeometryChanged(modelProps: ModelGeometryChangesProps[]) {
    this.onGeometryChanged.raiseEvent(modelProps);
    IpcHost.notifyEditingScope(this._iModel, "notifyGeometryChanged", modelProps); // send to frontend
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
    IpcHost.notifyTxns(this._iModel, "notifyCommitted", this.hasPendingTxns, Date.now());
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

  /**
   * Restart the current TxnManager session. This causes all Txns in the current session to no longer be undoable (as if the file was closed
   * and reopened.)
   * @note This can be quite disconcerting to the user expecting to be able to undo previously made changes. It should only be used
   * under extreme circumstances where damage to the file or session could happen if the currently committed are reversed. Use sparingly and with care.
   * Probably a good idea to alert the user it happened.
   */
  public restartSession() {
    this._nativeDb.restartTxnSession();
  }

  /** Determine whether current txn is propagating indirect changes or not. */
  public get isIndirectChanges(): boolean { return this._nativeDb.isIndirectChanges(); }

  /** Determine if there are currently any reversible (undoable) changes from this editing session. */
  public get isUndoPossible(): boolean { return this._nativeDb.isUndoPossible(); }

  /** Determine if there are currently any reinstatable (redoable) changes */
  public get isRedoPossible(): boolean { return this._nativeDb.isRedoPossible(); }

  /** Get the description of the operation that would be reversed by calling reverseTxns(1).
   * This is useful for showing the operation that would be undone, for example in a menu.
   */
  public getUndoString(): string { return this._nativeDb.getUndoString(); }

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
   * @note If there are any outstanding uncommitted changes, they are reversed.
   * @note The term "operation" is used rather than Txn, since multiple Txns can be grouped together via [[beginMultiTxnOperation]]. So,
   * even if numOperations is 1, multiple Txns may be reversed if they were grouped together when they were made.
   * @note If numOperations is too large only the operations are reversible are reversed.
   */
  public reverseTxns(numOperations: number): IModelStatus {
    return this._iModel.reverseTxns(numOperations);
  }

  /** Reverse the most recent operation. */
  public reverseSingleTxn(): IModelStatus { return this.reverseTxns(1); }

  /** Reverse all changes back to the beginning of the session. */
  public reverseAll(): IModelStatus { return this._nativeDb.reverseAll(); }

  /** Reverse all changes back to a previously saved TxnId.
   * @param txnId a TxnId obtained from a previous call to GetCurrentTxnId.
   * @returns Success if the transactions were reversed, error status otherwise.
   * @see  [[getCurrentTxnId]] [[cancelTo]]
   */
  public reverseTo(txnId: TxnIdString): IModelStatus { return this._nativeDb.reverseTo(txnId); }

  /** Reverse and then cancel (make non-reinstatable) all changes back to a previous TxnId.
   * @param txnId a TxnId obtained from a previous call to [[getCurrentTxnId]]
   * @returns Success if the transactions were reversed and cleared, error status otherwise.
   */
  public cancelTo(txnId: TxnIdString): IModelStatus { return this._nativeDb.cancelTo(txnId); }

  /** Reinstate the most recently reversed transaction. Since at any time multiple transactions can be reversed, it
   * may take multiple calls to this method to reinstate all reversed operations.
   * @returns Success if a reversed transaction was reinstated, error status otherwise.
   * @note If there are any outstanding uncommitted changes, they are canceled before the Txn is reinstated.
   */
  public reinstateTxn(): IModelStatus { return this._iModel.reinstateTxn(); }

  /** Get the Id of the first transaction, if any.
   */
  public queryFirstTxnId(): TxnIdString { return this._nativeDb.queryFirstTxnId(); }

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
