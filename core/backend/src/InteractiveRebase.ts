/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { BriefcaseDb, IModelDb } from "./IModelDb";
import { EditTxn } from "./EditTxn";
import { assert, DbResult, Guid, Id64, Id64String, IModelStatus, ITwinError } from "@itwin/core-bentley";
import { ElementProps, IModelError, TxnProps } from "@itwin/core-common";
import { SchemaView, SchemaViewPrimitiveType } from "@itwin/ecschema-metadata";
import { _nativeDb } from "./internal/Symbols";
import { BriefcaseManager } from "./BriefcaseManager";
import { getChangedProperties, RebaseInstanceChange, RebaseInstanceStore } from "./internal/RebaseInstanceStore";
import { Element } from "./Element";

/** Errors originating from the server-based implementation of the [LockControl]($backend) interface.
 * @beta
 */
export namespace InteractiveRebaseError {
  /** the ITwinError scope for `InteractiveRebaseError`s. */
  export const scope = "itwin-InteractiveRebase";

  /** Keys that identify `InteractiveRebaseError`s */
  export type Key =
    /** The specified Txn indices are invalid */
    "invalid-txn-indices" |
    /** The specified property is not a conflicting property */
    "not-conflicting-property" |
    /** The rebase process is already complete */
    "rebase-complete" |
    /** The rebase process has already moved past the last group */
    "already-past-last-group" |
    /** The rebase process has already moved past the first group */
    "already-past-first-group";

  /** Instantiate and throw an InteractiveRebaseError */
  export function throwError(key: Key, message: string): never {
    ITwinError.throwError<ITwinError>({ iTwinErrorId: { scope, key }, message });
  }
  /** Determine whether an error object is an InteractiveRebaseError */
  export function isError(error: unknown, key?: Key): error is ITwinError {
    return ITwinError.isError<ITwinError>(error, scope, key);
  }
}

export interface RebaseConflict {
  kind: string;
  id: Id64String;
  classFullName: string;
}

/**
 * The properties involved in a rebase conflict, in the same form as the [EntityProps]($common) produced by
 * [Entity.deserialize]($backend). Properties are therefore identified by access strings like `code.value`,
 * not by the names under which they are stored (`codeValue`).
 */
export interface RebaseConflictProperties {
  [propertyName: string]: any;
}

/**
 * Both the incoming (their) and the local (our) changes modified the same properties
 * on the same instance.
 */
export interface UpdateRebaseConflict extends RebaseConflict {
  kind: "Update";

  /**
   * The original values of the instance. These were the values that were in place just before
   * we originally made our local changes.
   *
   * This will usually not include every property of the instance. Only the following properties
   * are included:
   * 1. The primary key(s) (usually `id`) and the `classFullName` if the table has one.
   * 2. Any properties that were modified by our local changes.
   */
  original: RebaseConflictProperties;

  /**
   * The new instance values after applying the incoming (their) changes. These are the new
   * values set by the upstream changes.
   *
   * This will usually not include every property of the instance. See {@link original} for
   * details on which properties are included.
   */
  theirs: RebaseConflictProperties;

  /**
   * Our new values for the instance, as set by our local changes.
   *
   * This will usually not include every property of the instance. See {@link original} for
   * details on which properties are included.
   */
  ours: RebaseConflictProperties;

  /**
   * The properties that are in conflict between the incoming (their) changes and the local (our) changes.
   * Specifically, these are the properties where the "original" value is different from "their" value,
   * meaning that the value has changed from when we originally modified it. A property is reported
   * as a conflict even if both "theirs" and "ours" are the same.
   *
   * Each entry is an access string into {@link original}, {@link theirs}, and {@link ours}, e.g. `code.value`.
   */
  conflictingProperties: string[];

  /**
   * Accepts the local (our) changes for some or all of the conflicting properties, and applies
   * them to the instance in the iModel.
   *
   * @param rebase The in-progress interactive rebase operation.
   * @param properties The conflicting properties for which to accept "our" value. If not specified, or if
   * the array is empty, then the "our" value of all conflicting properties will be accepted. Properties
   * that are not accepted are left unmodified.
   */
  acceptOurs(rebase: InteractiveRebase, properties?: string[]): void;

  /**
   * Accepts the upstream (their) changes for some or all of the conflicting properties, and applies
   * them to the instance in the iModel.
   *
   * @param rebase The in-progress interactive rebase operation.
   * @param properties The conflicting properties for which to accept "their" value. If not specified, or if
   * the array is empty, then the "their" value of all conflicting properties will be accepted. Properties
   * that are not accepted are left unmodified.
   */
  acceptTheirs(rebase: InteractiveRebase, properties?: string[]): void;
}

/**
 * The incoming (their) changes modified properties on an instance that was deleted by the
 * local (our) changes.
 */
export interface TheirUpdateOurDeleteRebaseConflict extends RebaseConflict {
  kind: "TheirUpdateOurDelete";

  /**
   * The original property values that were in place just before we deleted the instance.
   *
   * This will usually not include every property of the instance. Only the following properties
   * are included:
   * 1. The primary key(s) (usually `id`) and the `classFullName` if the table has one.
   * 2. Any properties that were modified by the incoming (their) changes.
   * 3. All properties that share an underlying table with the properties in (2).
   */
  original: RebaseConflictProperties;

  /**
   * The new instance values after applying the incoming (their) changes. These are the new
   * values set by the upstream changes.
   *
   * This will usually not include every property of the instance. See {@link original} for
   * details on which properties are included.
   */
  theirs: RebaseConflictProperties;

  /**
   * The properties that were modified by the incoming (their) changes, as access strings into
   * {@link original} and {@link theirs}, e.g. `code.value`.
   */
  updatedProperties: string[];
}

/**
 * The incoming (their) changes deleted an instance that was modified by the
 * local (our) changes.
 */
export interface TheirDeleteOurUpdateRebaseConflict extends RebaseConflict {
  kind: "TheirDeleteOurUpdate";

  /**
   * The original property values that were in place just before we modified the instance.
   *
   * This will usually not include every property of the instance. Only the following properties
   * are included:
   * 1. The primary key(s) (usually `id`) and the `classFullName` if the table has one.
   * 2. Any properties that were modified by our local changes.
   */
  original: RebaseConflictProperties;

  /**
   * Our new values for the instance, as set by our local changes.
   *
   * This will usually not include every property of the instance. See {@link original} for
   * details on which properties are included.
   */
  ours: RebaseConflictProperties;

  /**
   * The properties that were modified by the local (our) changes, as access strings into
   * {@link original} and {@link ours}, e.g. `code.value`.
   */
  updatedProperties: string[];
}

/**
 * Both the incoming (their) changes and the local (our) changes inserted an instance
 * with the same primary key (ECInstanceId).
 */
export interface InsertRebaseConflict extends RebaseConflict {
  kind: "Insert";

  /**
   * The new instance values after applying the incoming (their) changes.
   */
  theirs: RebaseConflictProperties;

  /**
   * The new instance values from the local (our) changes.
   */
  ours: RebaseConflictProperties;

  /**
   * The properties that are different (in conflict) between the incoming (their) changes and the local (our) changes.
   * This may be empty if identical instances were inserted by both the incoming and local changes.
   *
   * Each entry is an access string into {@link theirs} and {@link ours}, e.g. `code.value`.
   */
  conflictingProperties: string[];

  /**
   * Accepts the local (our) changes for some or all of the conflicting properties, and applies
   * them to the instance in the iModel.
   *
   * @param rebase The in-progress interactive rebase operation.
   * @param properties The conflicting properties for which to accept "our" value. If not specified, or if
   * the array is empty, then the "our" value of all conflicting properties will be accepted. Properties
   * that are not accepted are left unmodified.
   */
  acceptOurs(rebase: InteractiveRebase, properties?: string[]): void;

  /**
   * Accepts the upstream (their) changes for some or all of the conflicting properties, and applies
   * them to the instance in the iModel.
   *
   * @param rebase The in-progress interactive rebase operation.
   * @param properties The conflicting properties for which to accept "their" value. If not specified, or if
   * the array is empty, then the "their" value of all conflicting properties will be accepted. Properties
   * that are not accepted are left unmodified.
   */
  acceptTheirs(rebase: InteractiveRebase, properties?: string[]): void;
}

export interface UniqueConstraintViolation {
  /**
   * The properties that are part of the UNIQUE constraint that is violated, as access strings into
   * {@link conflictingRow}, e.g. `code.value`.
   */
  uniqueConstraintProperties: string[];

  /**
   * The instance that is causing the UNIQUE constraint violation. This is the instance that was
   * inserted or updated by the incoming (their) changes, which conflicts with the local (our) changes.
   */
  conflictingRow: RebaseConflictProperties;
}

export interface UniqueConstraintRebaseConflict extends RebaseConflict {
  kind: "UniqueConstraint";

  /**
   * The original row that our change modified. If our change is an insertion, this will be undefined.
   */
  original?: RebaseConflictProperties;

  /**
   * Our change's properties.
   */
  ours: RebaseConflictProperties;

  /**
   * The UNIQUE constraints that are violated after our change.
   */
  uniqueConstraintViolations: UniqueConstraintViolation[];
}

export interface ForeignKeyConstraintRebaseConflict extends RebaseConflict {
  kind: "ForeignKeyConstraint";
  numberOfConflictingRows: number;
}

/** The `conflictDetail` that native attaches to the error thrown by `insertInstance`/`updateInstance` when the
 * write failed with a UNIQUE constraint violation. SQLite only reports the first index it found to be violated,
 * so a single failed write describes at most one constraint.
 */
interface UniqueConstraintConflictDetail {
  kind: "UniqueConstraint";
  uniqueConstraintProperties: string[];
  conflictingRow?: RebaseConflictProperties;
}

export interface TxnRebaseGroup {
  txns: TxnProps[];
}

const INTERACTIVE_REBASE_CONFLICT_HANDLER_ID = "InteractiveRebaseConflictHandler";
const MAX_UNIQUE_CONSTRAINT_FIX_ATTEMPTS = 10;

export class InteractiveRebase {
  private _db: BriefcaseDb;
  private _schemaView: SchemaView;
  private _editTxn: EditTxn | undefined;
  private _txns: TxnProps[];
  private _groups: TxnRebaseGroup[];
  private _currentGroupIndex: number = -1;
  private _conflicts: RebaseConflict[] = [];

  constructor(db: BriefcaseDb, txns: TxnProps[], schemaView: SchemaView) {
    this._db = db;
    this._schemaView = schemaView;
    this._txns = txns;
    this._groups = this._txns.map(txn => ({ txns: [txn] }));
  }

  public [Symbol.dispose](): void {
    if (this._editTxn) {
      this._editTxn.end("abandon");
    }
    this._db.txns.rebaser.removeConflictHandler(INTERACTIVE_REBASE_CONFLICT_HANDLER_ID);
  }

  /**
   * Gets the EditTxn for making arbitrary edits to the iModel during the rebase process for the current group.
   *
   * @throws InteractiveRebaseError if the rebase process is already complete.
   */
  public get editTxn(): EditTxn {
    if (!this._editTxn) {
      if (this.isComplete) {
        InteractiveRebaseError.throwError("rebase-complete", "The rebase process is already complete");
      }
      this._editTxn = new EditTxn(this._db, "Interactive Rebase");
      this._editTxn.start();
    }
    return this._editTxn;
  }

  /**
   * Gets the iModel being rebased.
   */
  public get iModel(): IModelDb {
    return this._db;
  }

  /**
   * Gets the local Txns that are being rebased.
   */
  public get txns(): ReadonlyArray<Readonly<TxnProps>> {
    return this._txns;
  }

  /**
   * Gets the groups of Txns that are being rebased. Each group is rebased as a unit, and conflicts are
   * resolved for the group as a whole.
   *
   * Initially, each Txn is in its own group. Use {@link groupTxns} or {@link groupAllTxns} to group
   * Txns together, or {@link ungroupAllTxns} to ungroup all Txns.
   */
  public get groups(): ReadonlyArray<Readonly<TxnRebaseGroup>> {
    return this._groups;
  }

  /**
   * Gets the group that is currently being rebased.
   */
  public get currentGroup(): Readonly<TxnRebaseGroup> | undefined {
    return this._currentGroupIndex >= 0 && this._currentGroupIndex < this._groups.length
      ? this._groups[this._currentGroupIndex]
      : undefined;
  }

  /**
   * Gets whether the rebase process is complete. The rebase is complete when all groups have been rebased.
   */
  public get isComplete(): boolean {
    return this._currentGroupIndex >= this._groups.length;
  }

  /**
   * Gets the conflicts that have been detected in the current group of Txns being rebased.
   */
  public get conflicts(): ReadonlyArray<RebaseConflict> {
    return this._conflicts;
  }

  /**
   * Groups all Txns together. All Txns will be rebased as a single unit, and conflicts
   * will be resolved for the entire set of Txns.
   */
  public groupAllTxns(): void {
    this._groups = [{ txns: this._txns }];
  }

  /**
   * Ungroups all Txns. Each Txn will be rebased individually, and conflicts
   * will be resolved for each Txn separately.
   */
  public ungroupAllTxns(): void {
    this._groups = this._txns.map(txn => ({ txns: [txn] }));
  }

  /**
   * Group the given Txns together. Grouped Txns are rebased as one unit, and
   * conflicts are resolved for the group as a whole.
   *
   * If any of the given Txns are already in a group, they are removed from it.
   *
   * @param firstIndex The index in {@link txns} of the first Txn in the group (inclusive).
   * @param lastIndex The index in {@link txns} of the last Txn in the group (inclusive).
   */
  public groupTxns(firstIndex: number, lastIndex: number): void {
    if (firstIndex < 0 || lastIndex >= this._txns.length || firstIndex > lastIndex) {
      InteractiveRebaseError.throwError("invalid-txn-indices", "Invalid indices for grouping Txns");
    }

    const newGroup = {
      txns: this._txns.slice(firstIndex, lastIndex + 1),
    };

    // Remove these txns from any existing groups, and remove any now-empty groups
    this._groups = this._groups.map(group => ({
      txns: group.txns.filter(txn => !newGroup.txns.includes(txn)),
    })).filter(group => group.txns.length > 0);

    // Add the new group in the proper order
    if (lastIndex === this._txns.length - 1) {
      this._groups.push(newGroup);
    } else {
      const nextTxn = this._txns[lastIndex + 1];
      const nextGroupIndex = this._groups.findIndex(group => group.txns[0] === nextTxn);
      this._groups.splice(nextGroupIndex, 0, newGroup);
    }
  }

  /**
   * Save the current Txn group and move to the next group.
   *
   * @returns True if there is another group to rebase, false if the rebase process is complete.
   */
  public nextGroup(): boolean {
    if (this._currentGroupIndex >= this._groups.length) {
      InteractiveRebaseError.throwError("already-past-last-group", "The rebase process has already moved past the last group");
    }

    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }

    this._editTxn = new EditTxn(this._db, "Interactive Rebase");
    this._editTxn.start();

    // TODO: revert already committed changes, too.

    ++this._currentGroupIndex;
    const group = this.currentGroup;
    if (group === undefined) {
      return false;
    }

    const nativeDb = this._db[_nativeDb];
    const txnId = nativeDb.pullMergeRebaseNext();
    assert(txnId === group.txns[0].id, "Unexpected txn id");

    this._conflicts = [];

    // TODO: refuse to do an interactive rebase for anything other than Data txns.
    assert(group.txns[0].type === "Data", "Interactive rebase only supports Data txns");
    this.reinstateDataTxn(group.txns[0]);

    return this._currentGroupIndex < this._groups.length - 1;
  }

  /**
   * Applies the given Data txn's previously-captured instance changes (see [[RebaseInstanceStore]]),
   * detecting and recording conflicts by comparing the captured "old" (pre-local-change) baseline
   * against the current row (which already reflects the incoming "their" changes) instead of relying
   * on the native changeset-apply conflict callback.
   */
  private reinstateDataTxn(txnProps: TxnProps): void {
    if (!BriefcaseManager.semanticRebaseDataFolderExists(this._db, txnProps.id)) {
      throw new IModelError(IModelStatus.BadRequest, `Local folder does not exist for transaction ${txnProps.id}`);
    }

    const dbPath = BriefcaseManager.createAndGetTxnChangedInstancePath(this._db, txnProps.id);
    using store = RebaseInstanceStore.openExisting(dbPath);
    for (const change of store.all()) {
      if (change.new?.$meta.isIndirectChange || change.old?.$meta.isIndirectChange) {
        // Indirect changes are derived side effects (e.g. a Model's GeometryGuid updated as a side
        // effect of a GeometricElement change) rather than deliberate edits, so they are force-applied
        // without conflict detection, matching the automatic semantic-rebase path's `applyInstanceChange`.
        this._db.txns.withIndirectTxnMode(() => {
          this.applyDirectInstanceChange(change);
        });
        continue;
      }
      this.applyInteractiveInstanceChange(change);
    }
    // Note: unlike the automatic "semantic rebase" replay, the captured data folder is intentionally
    // left in place here - `previousGroup`/`restartGroup`/`restartAll` are expected to eventually need
    // it to revert already-reinstated txns (currently unimplemented, see the TODOs below).
  }

  /** Applies a single instance's captured old/new snapshot pair directly (Insert/Update/Delete inferred
   * from which of "old"/"new" were captured), without any conflict detection. Used for indirect/derived
   * changes, which should not participate in user-facing conflict resolution.
   */
  private applyDirectInstanceChange(change: RebaseInstanceChange): void {
    const nativeDb = this._db[_nativeDb];
    if (change.new) {
      const { $meta: _newMeta, ...newProps } = change.new;
      if (change.old) {
        nativeDb.updateInstance(newProps, { useJsNames: true });
      } else {
        nativeDb.insertInstance(newProps, { forceUseId: true, useJsNames: true });
      }
    } else if (change.old) {
      const { $meta: _oldMeta, ...oldProps } = change.old;
      nativeDb.deleteInstance({ id: oldProps.id, classFullName: oldProps.classFullName }, { useJsNames: true });
    }
  }

  /** Applies a single instance's captured old/new snapshot pair, inferring Insert/Update/Delete from
   * which of "old"/"new" were captured, and detecting conflicts against the current row.
   */
  private applyInteractiveInstanceChange(change: RebaseInstanceChange): void {
    if (change.new) {
      const { $meta: _newMeta, ...newProps } = change.new;
      if (change.old) {
        const { $meta: _oldMeta, ...oldProps } = change.old;
        this.applyInteractiveUpdate(oldProps, newProps, getChangedProperties(change));
      } else {
        this.applyInteractiveInsert(newProps);
      }
    } else if (change.old) {
      const { $meta: _oldMeta, ...oldProps } = change.old;
      this.applyInteractiveDelete(oldProps);
    }
  }

  private applyInteractiveUpdate(oldProps: RebaseConflictProperties, newProps: RebaseConflictProperties, changedProperties: string[] | undefined): void {
    const nativeDb = this._db[_nativeDb];
    const expectedOldValues = pickProperties(withoutIdentityProperties(oldProps), changedProperties);
    // Native always applies `updateInstance` incrementally (properties omitted from the write are left
    // as-is), so restricting the write to just the touched properties avoids clobbering any upstream
    // change to a property our local change never touched.
    const propsToWrite = changedProperties === undefined
      ? newProps
      : { id: newProps.id, classFullName: newProps.classFullName, ...pickProperties(newProps, changedProperties) };
    const result = this.applyOrRecordConstraintConflict(propsToWrite.id, propsToWrite.classFullName, oldProps, newProps, () =>
      nativeDb.updateInstance(propsToWrite, { useJsNames: true, expectedOldValues }) as { updated: boolean, conflictingProperties: string[] });
    if (result === undefined) {
      // A constraint conflict occurred and was already recorded.
      return;
    }
    if (result.updated) {
      return;
    }

    // Does the updated instance exist at all?
    const theirs = this.tryReadCurrentInstance(oldProps.id, oldProps.classFullName);
    if (theirs === undefined) {
      // The incoming changes deleted the instance that our local change updated. Their delete stands.
      TheirDeleteOurUpdateRebaseConflictImpl.record(this, this._conflicts, oldProps, newProps, result.conflictingProperties);
    } else {
      // The row still exists, but at least one property we touched (result.conflictingProperties) no
      // longer matches our captured baseline, meaning the incoming changes also modified it.
      UpdateRebaseConflictImpl.record(this, this._conflicts, oldProps, theirs, newProps, result.conflictingProperties);
      this.applyOrRecordConstraintConflict(propsToWrite.id, propsToWrite.classFullName, oldProps, newProps, () => nativeDb.updateInstance(propsToWrite, { useJsNames: true }));
    }
  }

  private applyInteractiveDelete(oldProps: RebaseConflictProperties): void {
    const nativeDb = this._db[_nativeDb];
    const key = { id: oldProps.id, classFullName: oldProps.classFullName };
    const result = this.applyOrRecordConstraintConflict(oldProps.id, oldProps.classFullName, oldProps, undefined, () =>
      nativeDb.deleteInstance(key, { useJsNames: true, expectedOldValues: withoutIdentityProperties(oldProps) }) as { deleted: boolean, conflictingProperties: string[] });
    if (result === undefined || result.deleted) {
      // Either a constraint conflict was already recorded, or we deleted it - nothing more to do.
      return;
    }

    // Native reports `conflictingProperties` populated with every checked property when the row itself no
    // longer exists, so existence (not `conflictingProperties.length`) is what distinguishes the two cases.
    const theirs = this.tryReadCurrentInstance(oldProps.id, oldProps.classFullName);
    if (theirs === undefined) {
      // The incoming changes already deleted it - nothing more to do.
      return;
    }

    // The row still exists but no longer matches our captured baseline (result.conflictingProperties),
    // meaning the incoming changes modified it. Report the conflict, but proceed with the delete (matching
    // the native changeset-conflict model for a Deleted opcode with a "Data" conflict cause).
    TheirUpdateOurDeleteRebaseConflictImpl.record(this, this._conflicts, oldProps, theirs, result.conflictingProperties);
    nativeDb.deleteInstance(key, { useJsNames: true });
  }

  private applyInteractiveInsert(newProps: RebaseConflictProperties): void {
    const nativeDb = this._db[_nativeDb];
    this.applyOrRecordConstraintConflict(newProps.id, newProps.classFullName, undefined, newProps, () => {
      const id = nativeDb.insertInstance(newProps, { forceUseId: true, useJsNames: true });
      if (!Id64.isValidId64(id)) {
        throw new IModelError(IModelStatus.BadRequest, `Failed to insert instance with id ${newProps.id}`);
      }
    });
  }

  /**
   * Runs `apply`, and on a UNIQUE/PRIMARYKEY or FOREIGNKEY constraint failure, records the appropriate
   * conflict instead of letting the exception propagate, returning `undefined` in that case. When
   * oldProps is undefined (indicating
   * that this is an Insert operation), a UNIQUE/PRIMARYKEY failure is first checked against whether it's
   * an id collision with an existing row (an [[InsertRebaseConflict]], which also retries the write via
   * `acceptOurs`) before falling back to a [[UniqueConstraintRebaseConflict]] built from the error's
   * [[UniqueConstraintConflictDetail]]; for updates/deletes the row already exists by definition, so
   * id-collision detection doesn't apply and the write is not retried (it would just fail again).
   */
  private applyOrRecordConstraintConflict<T>(id: Id64String, classFullName: string, oldProps: RebaseConflictProperties | undefined, newProps: RebaseConflictProperties | undefined, apply: () => T, attempt: number = 0): T | undefined {
    // PRINCIPLE: The application of "our" change must succeed in the end, because that increases the chances
    // that future changes and txns apply successfully. Explicit interactive resolution can restore "their" changes
    // if desired.
    //
    // To that end:
    // 1. An Insert that fails due to a primary key collision is treated as an Update to the colliding row. Our change wins.
    // 2. On a UNIQUE constraint violation, we methodically change the value of one of the columns involved in the constraint
    //   until we find a value that doesn't collide, then apply our change. Our change wins. For example, if the constraint
    //   is on `code.value` and our change is trying to set it to "A", but "A" already exists, we try "A_1", "A_2", etc.
    //   until we find a value that doesn't exist, then apply our change with that new value.
    //
    // Either of these forced applications can trigger further conflicts. For example, in (1), applying "our" values to the
    // existing row could trigger a UNIQUE constraint violation on another column. In (2), we'll choose a value for that
    // UNIQUE constraint that doesn't collide with any other existing row, but fixing that first violation could reveal
    // a second violation of a different constraint. We report all such conflicts, and automatically resolve them in
    // the same manner.
    //
    // However, when they delete something we modified, there's no great way for our change to win. We have to allow
    // the delete to win, and anything fancier than that will probably have to be done manually. This can't lead to
    // further conflicts, though. Our local changes might also reference this modified instance, but that can be true
    // whether we modified the instance or not.
    //
    // When we reference something that they deleted - a foreign key constraint - we can't realistically reverse the delete
    // for the benefit of our changes. Instead, if the foreign key property can be NULL, we should set it as such.
    // If not, we should effectively cascade the delete to our changes as well. The only other option would be to restore
    // a version of the referenced instance as a "tombstone", but that's probably tricky enough that we should only
    // do it if we can see a clear benefit.
    try {
      return apply();
    } catch (err: any) {
      if (err.errorNumber === DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY) {
        // TODO: report a ForeignKeyConstraintRebaseConflict once native exposes conflict-row counts for
        // direct instance writes (see interactive-rebase-instance-conflict-native-spec.md, "Change 2").
        return undefined;
      }
      if (err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_UNIQUE && err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY) {
        throw err;
      }

      const isInsert = oldProps === undefined;
      const theirs = isInsert ? this.tryReadCurrentInstance(id, classFullName) : undefined;
      if (theirs !== undefined) {
        // Both local and incoming changes wrote an instance with the same id.
        InsertRebaseConflictImpl.record(this, this._conflicts, newProps!, theirs);

        // Attempt to apply "our" change to the existing row, which may trigger further conflicts (e.g. UNIQUE constraint violations).
        this.applyOrRecordConstraintConflict(id, classFullName, theirs, newProps, () => this._db[_nativeDb].updateInstance(newProps!, { useJsNames: true }), attempt + 1);
      } else {
        // Some other UNIQUE index (not the primary key) was violated.
        const conflictDetail = err.conflictDetail as UniqueConstraintConflictDetail | undefined;
        UniqueConstraintRebaseConflictImpl.record(this, this._conflicts, oldProps, newProps!, conflictDetail);

        // Fix this UNIQUE constraint violation by changing the value of one of the properties involved in the constraint until we
        // find a value that doesn't collide.
        const fixedProps = attempt < MAX_UNIQUE_CONSTRAINT_FIX_ATTEMPTS
          ? this.fixUniqueConstraintViolation(newProps!, conflictDetail?.uniqueConstraintProperties, attempt)
          : undefined;

        // Apply the updated row, which may trigger further conflicts (e.g. UNIQUE constraint violations).
        if (fixedProps !== undefined) {
          this.applyOrRecordConstraintConflict(id, classFullName, oldProps, fixedProps, () => {
            if (oldProps === undefined) {
              this._db[_nativeDb].insertInstance(fixedProps, { forceUseId: true, useJsNames: true });
            } else {
              this._db[_nativeDb].updateInstance(fixedProps, { useJsNames: true });
            }
          }, attempt + 1);
        }
      }
      return undefined;
    }
  }

  private fixUniqueConstraintViolation(props: RebaseConflictProperties, uniqueConstraintProperties: string[] | undefined, attempt: number): RebaseConflictProperties | undefined {
    if (uniqueConstraintProperties === undefined || uniqueConstraintProperties.length === 0)
      return undefined;

    const classFullName = props.classFullName;
    if (typeof classFullName !== "string")
      return undefined;

    const fixedProps = { ...props };
    for (const accessString of uniqueConstraintProperties) {
      const property = resolveSchemaViewProperty(this._schemaView, classFullName, accessString);
      if (property === undefined || property.isArray() || property.isNavigation() || !property.isPrimitive())
        continue;

      const currentValue = getPropertyValue(props, accessString);
      let replacement: string | undefined;
      if (property.primitiveType === SchemaViewPrimitiveType.Binary && property.extendedTypeName === "BeGuid") {
        replacement = Guid.createValue();
      } else if (property.primitiveType === SchemaViewPrimitiveType.String && typeof currentValue === "string" && currentValue.length > 0) {
        const baseValue = currentValue.replace(/\(Conflict(?:-\d+)?\)$/, "").trimEnd();
        replacement = `${baseValue}${attempt === 0 ? " (Conflict)" : ` (Conflict-${attempt})`}`;
      }

      if (replacement !== undefined) {
        setPropertyValue(fixedProps, accessString, replacement);
        return fixedProps;
      }
    }

    return undefined;
  }

  private readCurrentInstance(id: Id64String, classFullName: string): RebaseConflictProperties {
    return this._db[_nativeDb].readInstance({ id, classFullName }, { useJsNames: true }) as RebaseConflictProperties;
  }

  private tryReadCurrentInstance(id: Id64String, classFullName: string): RebaseConflictProperties | undefined {
    try {
      return this.readCurrentInstance(id, classFullName);
    } catch {
      return undefined;
    }
  }

  /**
   * Applies a resolved conflict's properties directly to the iModel via the native instance writer.
   * Used by conflict resolution methods (`acceptOurs`/`acceptTheirs`) once native reinstatement of the
   * txn is no longer in progress, so there is no changeset-apply conflict callback to defer to.
   * @internal
   */
  public applyConflictResolution(props: RebaseConflictProperties): void {
    this._db[_nativeDb].updateInstance(props, { useJsNames: true });

    // TODO: too heavy-handed?
    this._db.clearCaches();
  }

  /**
   * Abandon all conflict resolutions and edits in the current Txn group and move back to the previous one.
   */
  public previousGroup(): void {
    if (this._currentGroupIndex < 0) {
      InteractiveRebaseError.throwError("already-past-first-group", "The rebase process has already moved past the first group");
    }

    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }

    // TODO: revert already committed changes, too.

    --this._currentGroupIndex;
  }

  /**
   * Abandon all edits in the current Txn group and restart the group's rebase process from the beginning.
   */
  public restartGroup(): void {
    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }
  }

  /**
   * Completely abandons the current rebase process and restarts it from the beginning.
   */
  public restartAll(): void {
    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }

    // TODO: revert previous txn changes, too.

    this._currentGroupIndex = -1;
  }

  // List of local txns to be rebased
  // Grouping of those txns
  // Current txn/group being rebased
  // Conflicts in current txn/group being rebased
  // Option to resolve those conflicts in prescriptive ways
  // EditTxn for making additional arbitrary changes
  // Finalize current txn/group, move to the next
  // Abort current txn/group (reverting all conflict resolutions and edits), move back to the previous

}

/** Computes which of `baseline`'s properties (excluding identity properties) differ in `compare`.
 * Used by the JS-driven (Data txn) conflict-detection path; the native changeset-conflict path
 * gets this list directly from `ecConflict.dataConflictProperties` instead.
 */
function computeChangedProperties(baseline: RebaseConflictProperties, compare: RebaseConflictProperties): string[] {
  const valuesDiffer = (a: any, b: any): boolean => {
    if ((a === undefined || a === null) && (b === undefined || b === null))
      return false;
    return typeof a === "object" || typeof b === "object"
      ? JSON.stringify(a) !== JSON.stringify(b)
      : a !== b;
  }

  return Object.keys(baseline).filter((prop) => prop !== "id" && prop !== "classFullName" && valuesDiffer(baseline[prop], compare[prop]));
}

/** Strips the identity properties (`id`/`classFullName`) from a captured instance snapshot, since they aren't
 * regular properties and can't be used for `CompareBeforeUpdate`/`CompareBeforeDelete`. The class's
 * TimeStampProperty (e.g. `lastMod`), if any, is left in: native excludes it from the optimistic-concurrency
 * check itself (it always changes on any write) while still reporting it via `conflictingProperties`.
 */
function withoutIdentityProperties(props: RebaseConflictProperties): RebaseConflictProperties {
  const { id: _id, classFullName: _classFullName, ...rest } = props;
  return rest;
}

/** Restricts `props` down to just `keys` (a plain key filter - no value comparison), or returns `props`
 * unchanged when `keys` is `undefined` (nothing to narrow down, e.g. an Insert/Delete's raw changeset
 * row already carries every column).
 */
function pickProperties(props: RebaseConflictProperties, keys: string[] | undefined): RebaseConflictProperties {
  if (keys === undefined)
    return props;

  const result: RebaseConflictProperties = {};
  for (const key of keys) {
    if (key in props)
      result[key] = props[key];
  }
  return result;
}

/** Reads the value identified by a (possibly dotted) access string, e.g. `code.value`. */
function getPropertyValue(props: RebaseConflictProperties, accessString: string): any {
  let value: any = props;
  for (const token of accessString.split(".")) {
    if (value === undefined || value === null)
      return undefined;
    value = value[token];
  }
  return value;
}

function resolveSchemaViewProperty(schemaView: SchemaView, classFullName: string, accessString: string): SchemaView.Property | undefined {
  let classDef: SchemaView.Class | undefined = schemaView.findClass(classFullName);
  if (classDef === undefined)
    return undefined;

  const tokens = accessString.split(".");
  for (let index = 0; index < tokens.length; index++) {
    const property: SchemaView.Property | undefined = classDef.getProperty(tokens[index]);
    if (property === undefined)
      return undefined;

    if (index === tokens.length - 1 || !property.isStruct())
      return property;

    classDef = property.structClass;
  }

  return undefined;
}

/** Writes the value identified by a (possibly dotted) access string, shallow-copying each object along the
 * way so that objects shared with the conflict's own snapshots are never mutated.
 */
function setPropertyValue(props: RebaseConflictProperties, accessString: string, value: any): void {
  const tokens = accessString.split(".");
  let target = props;
  for (const token of tokens.slice(0, -1)) {
    target[token] = { ...target[token] };
    target = target[token];
  }
  target[tokens[tokens.length - 1]] = value;
}

/** Appends the properties reported by native, translated from ECSql instance access strings (e.g. `codeSpec.id`)
 * to the access strings by which the same values are identified in the deserialized props (e.g. `code.spec`).
 * Several instance properties can map onto a single props property, so duplicates are discarded.
 */
function addPropsAccessStrings(target: string[], classDef: typeof Element, instanceAccessStrings: string[]): void {
  for (const instanceAccessString of instanceAccessStrings) {
    const propsAccessString = classDef.toPropsAccessString(instanceAccessString);
    if (!target.includes(propsAccessString))
      target.push(propsAccessString);
  }
}

/** Resolves a conflict by writing the values of `properties` (props access strings, defaulting to all of the
 * conflict's conflicting properties) taken from `source` onto the instance, leaving its other properties as
 * they are. The values are round-tripped through [[Entity.serialize]], which is what knows how a props value
 * is represented in an ECSql instance (e.g. props `placement.origin` `[x, y]` is instance `origin` `{x, y}`).
 */
function applyResolution(rebase: InteractiveRebase, conflict: { id: Id64String, classFullName: string, ours: RebaseConflictProperties, conflictingProperties: string[] }, source: RebaseConflictProperties, properties?: string[]): void {
  const accepted = properties && properties.length > 0 ? properties : conflict.conflictingProperties;

  const resolved: RebaseConflictProperties = { ...conflict.ours };
  for (const prop of accepted) {
    if (accepted !== conflict.conflictingProperties && !conflict.conflictingProperties.includes(prop)) {
      InteractiveRebaseError.throwError("not-conflicting-property", `Property ${prop} is not a conflicting property for instance ${conflict.id}`);
    }
    setPropertyValue(resolved, prop, getPropertyValue(source, prop));
  }

  const classDef = rebase.iModel.getJsClass<typeof Element>(conflict.classFullName);
  const instance = classDef.serialize(resolved as ElementProps, rebase.iModel);

  const updateProps: RebaseConflictProperties = { id: conflict.id, classFullName: conflict.classFullName };
  for (const prop of accepted) {
    const instanceAccessString = classDef.toInstanceAccessString(prop);
    setPropertyValue(updateProps, instanceAccessString, getPropertyValue(instance, instanceAccessString));
  }

  rebase.applyConflictResolution(updateProps);
}

class UpdateRebaseConflictImpl implements UpdateRebaseConflict {
  public readonly kind: "Update" = "Update";

  public readonly id: Id64String;
  public readonly classFullName: string;
  public readonly original: RebaseConflictProperties = {};
  public readonly theirs: RebaseConflictProperties = {};
  public readonly ours: RebaseConflictProperties = {};
  public readonly conflictingProperties: string[] = [];

  public static record(interactive: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties, theirs: RebaseConflictProperties, ours: RebaseConflictProperties, conflictingProperties: string[]): void {
    const instanceId = original.id;

    let instanceConflict = conflicts.find(c => c.id === instanceId && c.kind === "Update") as UpdateRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new UpdateRebaseConflictImpl(instanceId, original.classFullName);
      conflicts.push(instanceConflict);
    }

    const classDef = interactive.iModel.getJsClass<typeof Element>(original.classFullName);

    addPropsAccessStrings(instanceConflict.conflictingProperties, classDef, conflictingProperties);

    instanceConflict.original = classDef.deserialize({
      row: original,
      iModel: interactive.iModel
    });
    instanceConflict.theirs = classDef.deserialize({
      row: theirs,
      iModel: interactive.iModel
    });
    instanceConflict.ours = classDef.deserialize({
      row: ours,
      iModel: interactive.iModel
    });
  }

  public constructor(id: Id64String, classFullName: string) {
    this.id = id;
    this.classFullName = classFullName;
  }

  public acceptOurs(rebase: InteractiveRebase, properties?: string[]): void {
    applyResolution(rebase, this, this.ours, properties);
  }
  public acceptTheirs(rebase: InteractiveRebase, properties?: string[]): void {
    applyResolution(rebase, this, this.theirs, properties);
  }
}

class TheirUpdateOurDeleteRebaseConflictImpl implements TheirUpdateOurDeleteRebaseConflict {
  public readonly kind: "TheirUpdateOurDelete" = "TheirUpdateOurDelete";

  public readonly id: Id64String;
  public readonly classFullName: string;
  public readonly original: RebaseConflictProperties = {};
  public readonly theirs: RebaseConflictProperties = {};
  public readonly updatedProperties: string[] = [];

  public static record(interactive: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties, theirs: RebaseConflictProperties, updatedProperties: string[]): void {
    const instanceId = original.id;

    let instanceConflict = conflicts.find(c => c.id === instanceId && c.kind === "TheirUpdateOurDelete") as TheirUpdateOurDeleteRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new TheirUpdateOurDeleteRebaseConflictImpl(instanceId, original.classFullName);
      conflicts.push(instanceConflict);
    }

    const classDef = interactive.iModel.getJsClass<typeof Element>(original.classFullName);

    addPropsAccessStrings(instanceConflict.updatedProperties, classDef, updatedProperties);

    instanceConflict.original = classDef.deserialize({
      row: original,
      iModel: interactive.iModel
    });
    instanceConflict.theirs = classDef.deserialize({
      row: theirs,
      iModel: interactive.iModel
    });
  }

  public constructor(id: Id64String, classFullName: string) {
    this.id = id;
    this.classFullName = classFullName;
  }
}

class TheirDeleteOurUpdateRebaseConflictImpl implements TheirDeleteOurUpdateRebaseConflict {
  public readonly kind: "TheirDeleteOurUpdate" = "TheirDeleteOurUpdate";

  public readonly id: Id64String;
  public readonly classFullName: string;
  public readonly original: RebaseConflictProperties = {};
  public readonly ours: RebaseConflictProperties = {};
  public readonly updatedProperties: string[] = [];

  public static record(interactive: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties, ours: RebaseConflictProperties, conflictingProperties: string[]): void {
    const instanceId = original.id;

    let instanceConflict = conflicts.find(c => c.id === instanceId && c.kind === "TheirDeleteOurUpdate") as TheirDeleteOurUpdateRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new TheirDeleteOurUpdateRebaseConflictImpl(instanceId, original.classFullName);
      conflicts.push(instanceConflict);
    }

    const classDef = interactive.iModel.getJsClass<typeof Element>(original.classFullName);

    addPropsAccessStrings(instanceConflict.updatedProperties, classDef, conflictingProperties);

    instanceConflict.original = classDef.deserialize({
      row: original,
      iModel: interactive.iModel
    });
    instanceConflict.ours = classDef.deserialize({
      row: ours,
      iModel: interactive.iModel
    });
  }

  public constructor(id: Id64String, classFullName: string) {
    this.id = id;
    this.classFullName = classFullName;
  }
}

class InsertRebaseConflictImpl implements InsertRebaseConflict {
  public readonly kind: "Insert" = "Insert";

  public readonly id: Id64String;
  public readonly classFullName: string;
  public readonly theirs: RebaseConflictProperties = {};
  public readonly ours: RebaseConflictProperties = {};
  public readonly conflictingProperties: string[] = [];

  public static record(rebase: InteractiveRebase, conflicts: RebaseConflict[], ours: RebaseConflictProperties, theirs: RebaseConflictProperties): void {
    const instanceId = ours.id;

    let instanceConflict = conflicts.find(c => c.id === instanceId && c.kind === "Insert") as InsertRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new InsertRebaseConflictImpl(instanceId, ours.classFullName);
      conflicts.push(instanceConflict);
    }

    const classDef = rebase.iModel.getJsClass<typeof Element>(ours.classFullName);

    addPropsAccessStrings(instanceConflict.conflictingProperties, classDef, computeChangedProperties(ours, theirs));
    instanceConflict.theirs = classDef.deserialize({
      row: theirs,
      iModel: rebase.iModel
    });
    instanceConflict.ours = classDef.deserialize({
      row: ours,
      iModel: rebase.iModel
    });
  }

  public constructor(id: Id64String, classFullName: string) {
    this.id = id;
    this.classFullName = classFullName;
  }

  public acceptOurs(rebase: InteractiveRebase, properties?: string[]): void {
    applyResolution(rebase, this, this.ours, properties);
  }

  public acceptTheirs(rebase: InteractiveRebase, properties?: string[]): void {
    applyResolution(rebase, this, this.theirs, properties);
  }
}

class UniqueConstraintRebaseConflictImpl implements UniqueConstraintRebaseConflict {
  public readonly kind: "UniqueConstraint" = "UniqueConstraint";

  public readonly id: Id64String;
  public readonly classFullName: string;
  public readonly original: RebaseConflictProperties | undefined = undefined;
  public readonly ours: RebaseConflictProperties = {};
  public readonly uniqueConstraintViolations: UniqueConstraintViolation[] = [];

  public static record(interactive: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties | undefined, ours: RebaseConflictProperties, detail?: UniqueConstraintConflictDetail): void {
    const instanceId = ours.id ?? original?.id;
    const classFullName = ours.classFullName ?? original?.classFullName;

    let instanceConflict = conflicts.find(c => c.id === instanceId && c.kind === "UniqueConstraint") as UniqueConstraintRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new UniqueConstraintRebaseConflictImpl(instanceId, classFullName);
      conflicts.push(instanceConflict);
    }

    const classDef = interactive.iModel.getJsClass<typeof Element>(ours.classFullName);

    if (original !== undefined) {
      instanceConflict.original = classDef.deserialize({
        row: original,
        iModel: interactive.iModel
      });
    }
    instanceConflict.ours = classDef.deserialize({
      row: ours,
      iModel: interactive.iModel
    });

    if (detail === undefined) {
      // Native could not map the violated index back to EC properties. Still surface the conflict.
      if (instanceConflict.uniqueConstraintViolations.length === 0) {
        instanceConflict.uniqueConstraintViolations.push({ uniqueConstraintProperties: [], conflictingRow: {} });
      }
      return;
    }

    const uniqueConstraintProperties: string[] = [];
    addPropsAccessStrings(uniqueConstraintProperties, classDef, detail.uniqueConstraintProperties);

    const isSameIndex = (other: UniqueConstraintViolation) =>
      other.uniqueConstraintProperties.length === uniqueConstraintProperties.length &&
      other.uniqueConstraintProperties.every((prop, i) => prop === uniqueConstraintProperties[i]);
    if (!instanceConflict.uniqueConstraintViolations.some(isSameIndex)) {
      instanceConflict.uniqueConstraintViolations.push({
        uniqueConstraintProperties,
        conflictingRow: classDef.deserialize({
          row: detail.conflictingRow ?? {},
          iModel: interactive.iModel
        }),
      });
    }
  }

  public constructor(id: Id64String, classFullName: string) {
    this.id = id;
    this.classFullName = classFullName;
  }
}
