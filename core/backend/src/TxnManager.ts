/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import * as touch from "touch";
import {
  assert, BeEvent, BentleyError, compareStrings, CompressedId64Set, DbConflictResolution, DbResult, Id64Array, Id64String, IModelStatus, IndexMap, Logger, OrderedId64Array
} from "@itwin/core-bentley";
import { EntityIdAndClassIdIterable, IModelError, ModelGeometryChangesProps, ModelIdAndGeometryGuid, NotifyEntitiesChangedArgs, NotifyEntitiesChangedMetadata } from "@itwin/core-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseDb, StandaloneDb } from "./IModelDb";
import { IpcHost } from "./IpcHost";
import { Relationship, RelationshipProps } from "./Relationship";
import { SqliteStatement } from "./SqliteStatement";
import { _nativeDb } from "./internal/Symbols";
import { DbRebaseChangesetConflictArgs, RebaseChangesetConflictArgs, TxnArgs } from "./internal/ChangesetConflictArgs";

/** A string that identifies a Txn.
 * @public @preview
 */
export type TxnIdString = string;

/** An error generated during dependency validation.
 * @see [[TxnManager.validationErrors]].
 * @public @preview
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
 * @public @preview
 */
export interface TxnChangedEntities {
  /** The entities that were inserted by the transaction. */
  readonly inserts: EntityIdAndClassIdIterable;
  /** The entities that were deleted by the transaction. */
  readonly deletes: EntityIdAndClassIdIterable;
  /** The entities that were modified by the transaction, including any [[Element]]s for which one of their [[ElementAspect]]s was changed. */
  readonly updates: EntityIdAndClassIdIterable;
}

/** Arguments supplied to [[TxnManager.queryLocalChanges]].
 * @beta
 */
export interface QueryLocalChangesArgs {
  /** If supplied and non-empty, restricts the results to include only EC instances belonging to the specified classes or subclasses thereof. */
  readonly includedClasses?: string[];
  /** If `true`, include changes that have not yet been saved. */
  readonly includeUnsavedChanges?: boolean;
}

/** Represents a change (insertion, deletion, or modification) to a single EC instance made in a local [[BriefcaseDb]].
 * @see [[TxnManager.queryLocalChanges]] to iterate all of the changed instances.
* @beta
*/
export interface ChangeInstanceKey {
  /** ECInstanceId of the instance. */
  id: Id64String;
  /** Fully-qualified class name of the instance. */
  classFullName: string;
  /** The type of change. */
  changeType: "inserted" | "updated" | "deleted";
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

  public addToChangedEntities(entities: NotifyEntitiesChangedArgs, type: "deleted" | "inserted" | "updated"): void {
    if (this.entityIds.length > 0)
      entities[type] = CompressedId64Set.compressIds(this.entityIds);

    entities[`${type}Meta`] = this._classIndices;
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

  private populateMetadata(db: BriefcaseDb | StandaloneDb, classIds: Id64Array): NotifyEntitiesChangedMetadata[] {
    // Ensure metadata for all class Ids is loaded. Loading metadata for a derived class loads metadata for all of its superclasses.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const classIdsToLoad = classIds.filter((x) => undefined === db.classMetaDataRegistry.findByClassId(x));
    if (classIdsToLoad.length > 0) {
      const classIdsStr = classIdsToLoad.join(",");
      const sql = `SELECT ec_class.Name, ec_class.Id, ec_schema.Name FROM ec_class JOIN ec_schema WHERE ec_schema.Id = ec_class.SchemaId AND ec_class.Id IN (${classIdsStr})`;
      db.withPreparedSqliteStatement(sql, (stmt) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const classFullName = `${stmt.getValueString(2)}:${stmt.getValueString(0)}`;
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          db.tryGetMetaData(classFullName);
        }
      });
    }

    // Define array indices for the metadata array entries correlating to the class Ids in the input list.
    const nameToIndex = new Map<string, number>();
    for (const classId of classIds) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const meta = db.classMetaDataRegistry.findByClassId(classId);
      nameToIndex.set(meta?.ecclass ?? "", nameToIndex.size);
    }

    const result: NotifyEntitiesChangedMetadata[] = [];

    function addMetadata(name: string, index: number): void {
      const bases: number[] = [];
      result[index] = { name, bases };

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const meta = db.tryGetMetaData(name);
      if (!meta) {
        return;
      }

      for (const baseClassName of meta.baseClasses) {
        let baseClassIndex = nameToIndex.get(baseClassName);
        if (undefined === baseClassIndex) {
          baseClassIndex = nameToIndex.size;
          nameToIndex.set(baseClassName, baseClassIndex);
          addMetadata(baseClassName, baseClassIndex);
        }

        bases.push(baseClassIndex);
      }
    }

    for (const [name, index] of nameToIndex) {
      if (index >= classIds.length) {
        // Entries beyond this are base classes for the classes in `classIds` - don't reprocess them.
        break;
      }

      addMetadata(name, index);
    }

    return result;
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
    const entities: NotifyEntitiesChangedArgs = {
      insertedMeta: [],
      updatedMeta: [],
      deletedMeta: [],
      meta: this.populateMetadata(iModel, classIds),
    };

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
        const stmt = sql.stmt;
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

/** @internal */
interface IConflictHandler {
  handler: (arg: RebaseChangesetConflictArgs) => DbConflictResolution | undefined;
  next: IConflictHandler | undefined;
  id: string;
}

/**
 * @internal
 * Manages conflict resolution during a merge operation.
*/
export class ChangeMergeManager {
  private _conflictHandlers?: IConflictHandler;
  public constructor(private _iModel: BriefcaseDb | StandaloneDb) { }
  public resume() {
    this._iModel[_nativeDb].pullMergeResume();
  }
  public inProgress() {
    return this._iModel[_nativeDb].pullMergeInProgress();
  }
  public onConflict(args: RebaseChangesetConflictArgs): DbConflictResolution | undefined {
    let curr = this._conflictHandlers;
    while (curr) {
      const resolution = curr.handler(args);
      if (resolution !== undefined) {
        Logger.logTrace(BackendLoggerCategory.IModelDb, `Conflict handler ${curr.id} resolved conflict`);
        return resolution;
      }
      curr = curr.next;
    }
    return undefined
  }
  public addConflictHandler(args: { id: string, handler: (args: RebaseChangesetConflictArgs) => DbConflictResolution | undefined }) {
    const idExists = (id: string) => {
      let curr = this._conflictHandlers;
      while (curr) {
        if (curr.id === id)
          return true;
        curr = curr.next;
      }
      return false;
    }
    if (idExists(args.id))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Conflict handler with id ${args.id} already exists`);
    this._conflictHandlers = { ...args, next: this._conflictHandlers };
  }
  public removeConflictHandler(id: string) {
    if (!this._conflictHandlers)
      return;

    if (this._conflictHandlers?.id === id) {
      this._conflictHandlers = this._conflictHandlers.next;
      return;
    }

    let prev = this._conflictHandlers;
    let curr = this._conflictHandlers?.next;
    while (curr) {
      if (curr.id === id) {
        prev.next = curr.next;
        return;
      }
      prev = curr;
      curr = curr.next;
    }
  }
}

/** Manages local changes to a [[BriefcaseDb]] or [[StandaloneDb]] via [Txns]($docs/learning/InteractiveEditing.md)
 * @public @preview
 */
export class TxnManager {
  /** @internal */
  private _isDisposed = false;

  /** @internal */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /** @internal */
  public readonly changeMergeManager: ChangeMergeManager;

  /** @internal */
  constructor(private _iModel: BriefcaseDb | StandaloneDb) {
    this.changeMergeManager = new ChangeMergeManager(_iModel);
    _iModel.onBeforeClose.addOnce(() => {
      this._isDisposed = true;
    });
  }

  /** Array of errors from dependency propagation */
  public readonly validationErrors: ValidationError[] = [];

  private get _nativeDb() { return this._iModel[_nativeDb]; }
  private _getElementClass(elClassName: string): typeof Element {
    return this._iModel.getJsClass(elClassName) as unknown as typeof Element;
  }
  private _getRelationshipClass(relClassName: string): typeof Relationship {
    return this._iModel.getJsClass<typeof Relationship>(relClassName);
  }

  /** If a -watch file exists for this iModel, update its timestamp so watching processes can be
   * notified that we've modified the briefcase.
   * @internal Used by IModelDb on push/pull.
   */
  public touchWatchFile(): void {
    // This is an async call. We don't have any reason to await it.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    touch(this._iModel.watchFilePathName, { nocreate: true });
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
    this.touchWatchFile();
    this.onCommitted.raiseEvent();
    IpcHost.notifyTxns(this._iModel, "notifyCommitted", this.hasPendingTxns, Date.now());
  }

  /** @internal */
  protected _onReplayExternalTxns() {
    this.onReplayExternalTxns.raiseEvent();
    IpcHost.notifyTxns(this._iModel, "notifyReplayExternalTxns");
  }

  /** @internal */
  protected _onReplayedExternalTxns() {
    this.onReplayedExternalTxns.raiseEvent();
    IpcHost.notifyTxns(this._iModel, "notifyReplayedExternalTxns");
  }

  /** @internal */
  protected _onChangesApplied() {
    this._iModel.clearCaches();
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
    this.touchWatchFile();
    this.onAfterUndoRedo.raiseEvent(isUndo);
    IpcHost.notifyTxns(this._iModel, "notifyAfterUndoRedo", isUndo);
  }

  private _onRebaseTxnBegin(txn: TxnArgs) {
    this.onRebaseTxnBegin.raiseEvent(txn);
  }

  private _onRebaseTxnEnd(txn: TxnArgs) {
    this.onRebaseTxnEnd.raiseEvent(txn);
  }

  private _onRebaseLocalTxnConflict(internalArg: DbRebaseChangesetConflictArgs): DbConflictResolution {
    const args = new RebaseChangesetConflictArgs(internalArg, this._iModel);

    const getChangeMetaData = () => {
      return {
        parent: this._iModel.changeset,
        txn: args.txn,
        table: args.tableName,
        op: args.opcode,
        cause: args.cause,
        indirect: args.indirect,
        primarykey: args.getPrimaryKeyValues(),
        fkConflictCount: args.cause === "ForeignKey" ? args.getForeignKeyConflicts() : undefined,
      };
    }

    // Default conflict resolution for which custom handler is never called.
    if (args.cause === "Data" && !args.indirect) {
      if (args.tableName === "be_Prop") {
        if (args.getValueText(0, "Old") === "ec_Db" && args.getValueText(1, "Old") === "localDbInfo") {
          return DbConflictResolution.Skip;
        }
      }
      if (args.tableName.startsWith("ec_")) {
        return DbConflictResolution.Skip;
      }
    }

    if (args.cause === "Conflict") {
      if (args.tableName.startsWith("ec_")) {
        return DbConflictResolution.Skip;
      }
    }

    try {
      const resolution = this.changeMergeManager.onConflict(args);
      if (resolution !== undefined)
        return resolution;
    } catch (err) {
      const msg = `Rebase failed. Custom conflict handler should not throw exception. Aborting txn. ${BentleyError.getErrorMessage(err)}`;
      Logger.logError(BackendLoggerCategory.IModelDb, msg, getChangeMetaData());
      args.setLastError(msg);
      return DbConflictResolution.Abort;
    }

    if (args.cause === "Data" && !args.indirect) {
      Logger.logInfo(BackendLoggerCategory.IModelDb, "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered. Local change will replace existing.", getChangeMetaData());
      return DbConflictResolution.Replace;
    }

    if (args.cause === "Conflict") {
      const msg = "PRIMARY KEY insert conflict. Aborting rebase.";
      Logger.logError(BackendLoggerCategory.IModelDb, msg, getChangeMetaData());
      args.setLastError(msg);
      return DbConflictResolution.Abort;
    }

    if (args.cause === "ForeignKey") {
      const msg = `Foreign key conflicts in ChangeSet. Aborting rebase.`;
      Logger.logInfo(BackendLoggerCategory.IModelDb, msg, getChangeMetaData());
      args.setLastError(msg);
      return DbConflictResolution.Abort;
    }

    if (args.cause === "NotFound") {
      Logger.logInfo(BackendLoggerCategory.IModelDb, "PRIMARY KEY not found. Skipping local change.", getChangeMetaData());
      return DbConflictResolution.Skip;
    }

    if (args.cause === "Constraint") {
      Logger.logInfo(BackendLoggerCategory.IModelDb, "Constraint voilation detected. Generally caused by db constraints like UNIQUE index. Skipping local change.", getChangeMetaData());
      return DbConflictResolution.Skip;
    }

    return DbConflictResolution.Replace;
  }

  /** Dependency handlers may call method this to report a validation error.
   * @param error The error. If error.fatal === true, the transaction will cancel rather than commit.
   */
  public reportError(error: ValidationError) {
    this.validationErrors.push(error);
    this._nativeDb.logTxnError(error.fatal);
  }

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
  /** Event raised for a read-only briefcase that was opened with the `watchForChanges` flag enabled when changes made by another connection are applied to the briefcase.
   * @see [[onReplayedExternalTxns]] for the event raised after all such changes have been applied.
   */
  public readonly onReplayExternalTxns = new BeEvent<() => void>();
  /** Event raised for a read-only briefcase that was opened with the `watchForChanges` flag enabled when changes made by another connection are applied to the briefcase.
   * @see [[onReplayExternalTxns]] for the event raised before the changes are applied.
   */
  public readonly onReplayedExternalTxns = new BeEvent<() => void>();

  /** @internal */
  public readonly onRebaseTxnBegin = new BeEvent<(txn: TxnArgs) => void>();
  /** @internal */
  public readonly onRebaseTxnEnd = new BeEvent<(txn: TxnArgs) => void>();
  /**
   * if handler is set and it does not return undefiend then default handler will not be called
   * @internal
   * */
  public appCustomConflictHandler?: (args: DbRebaseChangesetConflictArgs) => DbConflictResolution | undefined;

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
    return this._nativeDb.reverseTxns(numOperations);
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

  /** Query if there are any pending Txns in this IModelDb that are waiting to be pushed.
   * @see [[IModelDb.pushChanges]]
   */
  public get hasPendingTxns(): boolean { return this._nativeDb.hasPendingTxns(); }

  /**
   * Query if there are any changes in memory that have yet to be saved to the IModelDb.
   * @see [[IModelDb.saveChanges]]
   */
  public get hasUnsavedChanges(): boolean { return this._nativeDb.hasUnsavedChanges(); }

  /**
   * Query if there are changes in memory that have not been saved to the iModelDb or if there are Txns that are waiting to be pushed.
   * @see [[IModelDb.saveChanges]]
   * @see [[IModelDb.pushChanges]]
   */
  public get hasLocalChanges(): boolean { return this.hasUnsavedChanges || this.hasPendingTxns; }

  /** Destroy the record of all local changes that have yet to be saved and/or pushed.
   * This permanently eradicates your changes - use with caution!
   * Typically, callers will want to subsequently use [[LockControl.releaseAllLocks]].
   * After calling this function, [[hasLocalChanges]], [[hasPendingTxns]], and [[hasUnsavedChanges]] will all be `false`.
   */
  public deleteAllTxns(): void {
    this._nativeDb.deleteAllTxns();
  }

  /** Obtain a list of the EC instances that have been changed locally by the [[BriefcaseDb]] associated with this `TxnManager` and have not yet been pushed to the iModel.
   * @beta
  */
  public queryLocalChanges(args?: QueryLocalChangesArgs): Iterable<ChangeInstanceKey> {
    if (!args) {
      args = { includedClasses: [], includeUnsavedChanges: false };
    }
    return this._nativeDb.getLocalChanges(args.includedClasses ?? [], args.includeUnsavedChanges ?? false);
  }

  /** Query the number of bytes of memory currently allocated by SQLite to keep track of
   * changes to the iModel, for debugging/diagnostic purposes, as reported by [sqlite3session_memory_used](https://www.sqlite.org/session/sqlite3session_memory_used.html).
   */
  public getChangeTrackingMemoryUsed(): number {
    return this._iModel[_nativeDb].getChangeTrackingMemoryUsed();
  }
}

