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
import { ECJsNames, ElementProps, IModelError, QueryBinder, TxnProps } from "@itwin/core-common";
import { SchemaView, SchemaViewPrimitiveType, StrengthDirection } from "@itwin/ecschema-metadata";
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
  id: Id64String;
  classFullName: string;

  /**
   * The instance that was in place just before we originally modified the instance. This is the common
   * baseline between {@link theirs} and {@link ours}.
   *
   * This will be undefined if this instance is newly-inserted.
   */
  original: RebaseConflictProperties | undefined;

  /**
   * The instance after applying the incoming (their) changes and any earlier rebase groups.
   * This is the state of the instance in the database just before applying our local changes.
   *
   * This property will be undefined if the instance does not exist prior to our changes, either
   * because it was deleted or because it never existed. In both cases {@link acceptTheirs} deletes
   * the instance, since "their" version of it is that it does not exist.
   */
  theirs: RebaseConflictProperties | undefined;

  /**
   * The instance after applying our local changes. This is the state of the instance that we are
   * trying to apply to the database.
   *
   * This property will be undefined if our change deleted the instance.
   */
  ours: RebaseConflictProperties | undefined;

  /**
   * The properties that were modified by {@link theirs} changes, relative to the {@link original} baseline.
   *
   * Each entry is an access string into {@link original}, {@link theirs}, and {@link ours}, e.g. `code.value`.
   */
  theirModifiedProperties: string[];

  /**
   * The properties that were modified by {@link ours} changes, relative to the {@link original} baseline.
   *
   * Each entry is an access string into {@link original}, {@link theirs}, and {@link ours}, e.g. `code.value`.
   */
  ourModifiedProperties: string[];

  /**
   * The properties that are in conflict between the incoming (their) changes and the local (our) changes.
   * Specifically, these are the properties where the "original" value is different from "their" value,
   * meaning that the value has changed from when we originally modified it. A property is reported
   * as a conflict even if both "theirs" and "ours" are the same.
   *
   * If one side or the other deleted the instance, this array will be empty. Look at
   * {@link theirModifiedProperties} or {@link ourModifiedProperties} to see which properties were
   * modified by the side that did not delete the instance.
   *
   * Each entry is an access string into {@link original}, {@link theirs}, and {@link ours}, e.g. `code.value`.
   */
  conflictingProperties: string[];

  /**
   * The properties that are different between the {@link theirs} and {@link ours} instances.
   *
   * Don't confuse this with {@link conflictingProperties}. If both "theirs" and "ours" changed a property to the
   * same value, that property will appear in {@link conflictingProperties} but not in {@link differentProperties}.
   * If either "theirs" or "ours" changed a property while the other did not, that property will appear in
   * {@link differentProperties} but not in {@link conflictingProperties}.
   *
   * Each entry is an access string into {@link original}, {@link theirs}, and {@link ours}, e.g. `code.value`.
   */
  differentProperties: string[];

  /**
   * The UNIQUE constraints that our change violated, along with the substitution that was automatically applied
   * to each so that our change could be applied anyway.
   *
   * This describes the instance's current state rather than a history: calling {@link acceptOurs} or
   * {@link acceptTheirs} discards the entries whose substituted property the resolution overwrites, and records
   * whatever violations the resolution provokes in their place. Entries obtained before such a call must not be
   * held onto across it.
   */
  uniqueConstraintViolations: UniqueConstraintViolation[];

  /**
   * The relationships that are broken by our change. A relationship is broken if the instance that it points to
   * does not exist, either because it was deleted by the incoming (their) changes or because it never existed.
   */
  brokenRelationships: BrokenRelationship[];

  /**
   * Accepts the local (our) vesion of the instance.
   *
   * @param properties The properties for which to accept "our" value. If not specified, or if
   * the array is empty, then the "our" value of all properties will be accepted. Properties
   * that are not accepted are left unmodified. Unknown properties are ignored.
   */
  acceptOurs(properties?: string[]): void;

  /**
   * Accepts the upstream (their) vesion of the instance.
   *
   * @param properties The properties for which to accept "their" value. If not specified, or if
   * the array is empty, then the "their" value of all properties will be accepted. Properties
   * that are not accepted are left unmodified. Unknown properties are ignored.
   */
  acceptTheirs(properties?: string[]): void;
}

/**
 * The properties involved in a rebase conflict, in the same form as the [EntityProps]($common) produced by
 * [Entity.deserialize]($backend). Properties are therefore identified by access strings like `code.value`,
 * not by the names under which they are stored (`codeValue`).
 */
export interface RebaseConflictProperties {
  [propertyName: string]: any;
}

export interface UniqueConstraintViolation {
  /**
   * The properties that are part of the UNIQUE constraint that is violated, as access strings into
   * {@link conflictingInstance}, e.g. `code.value`.
   */
  uniqueConstraintProperties: string[];

  /**
   * The instance that is causing the UNIQUE constraint violation. This is the instance that was
   * inserted or updated by the incoming (their) changes, which conflicts with the local (our) changes.
   */
  conflictingInstance: RebaseConflictProperties;

  /**
   * The substitution that was automatically applied to one of the {@link uniqueConstraintProperties} so that
   * our change could be applied without violating the constraint.
   *
   * This is `undefined` if no substitution could be found, in which case our change was not applied at all.
   */
  appliedFix?: {
    /** The property whose value was substituted, as an access string into {@link conflictingInstance}, e.g. `code.value`. */
    property: string;
    /** The value assigned to {@link property} in place of the value that collided. */
    value: string;
  };
}

export interface BrokenRelationship {
  /**
   * The class of the relationship that is broken.
   */
  relationshipClass: SchemaView.RelationshipClass;

  /**
   * The navigation property on the instance that is broken, as an access string into {@link ours}, e.g., `parent`.
   */
  navigationProperty: string;
}

/** The `conflictDetail` that native attaches to the error thrown by `insertInstance`/`updateInstance` when the
 * write failed with a UNIQUE constraint violation. SQLite only reports the first index it found to be violated,
 * so a single failed write describes at most one constraint.
 */
interface UniqueConstraintConflictDetail {
  kind: "UniqueConstraint";
  uniqueConstraintProperties: string[];
  conflictingInstance?: RebaseConflictProperties;
}

/** The result of [[InteractiveRebase.fixUniqueConstraintViolation]]: the properties to write, plus which property
 * it substituted and the value it chose. `property` is an ECSql instance access string, not a props access string.
 */
interface UniqueConstraintFix {
  props: RebaseConflictProperties;
  property: string;
  value: string;
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
      RebaseConflictImpl.recordTheirDeleteOurUpdate(this, this._conflicts, oldProps, newProps, result.conflictingProperties);
    } else {
      // The row still exists, but at least one property we touched (result.conflictingProperties) no
      // longer matches our captured baseline, meaning the incoming changes also modified it.
      RebaseConflictImpl.recordUpdate(this, this._conflicts, oldProps, theirs, newProps, result.conflictingProperties);
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
    RebaseConflictImpl.recordTheirUpdateOurDelete(this, this._conflicts, oldProps, theirs, result.conflictingProperties);
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
   * an id collision with an existing row (recorded via [[RebaseConflictImpl.recordInsert]], which also
   * retries the write via `acceptOurs`) before falling back to a UNIQUE constraint violation recorded via
   * [[RebaseConflictImpl.recordUniqueConstraint]] built from the error's [[UniqueConstraintConflictDetail]];
   * for updates/deletes the row already exists by definition, so id-collision detection doesn't apply and
   * the write is not retried (it would just fail again).
   */
  private applyOrRecordConstraintConflict<T>(id: Id64String, classFullName: string, oldProps: RebaseConflictProperties | undefined, newProps: RebaseConflictProperties | undefined, apply: () => T): T | undefined {
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
        const targetProps = newProps ?? oldProps;
        const brokenRelationships = targetProps !== undefined ? this.findBrokenRelationships(targetProps) : [];
        const isInsert = oldProps === undefined;
        const theirRow = isInsert ? undefined : this.tryReadCurrentInstance(id, classFullName);
        RebaseConflictImpl.recordForeignKeyConstraint(this, this._conflicts, oldProps, newProps, theirRow, brokenRelationships);
        return undefined;
      }
      if (err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_UNIQUE && err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY) {
        throw err;
      }

      const isInsert = oldProps === undefined;
      const theirs = isInsert ? this.tryReadCurrentInstance(id, classFullName) : undefined;
      if (theirs !== undefined) {
        // Both local and incoming changes wrote an instance with the same id.
        RebaseConflictImpl.recordInsert(this, this._conflicts, newProps!, theirs);

        // Attempt to apply "our" change to the existing row, which may trigger further conflicts (e.g. UNIQUE constraint violations).
        this.applyOrRecordConstraintConflict(id, classFullName, theirs, newProps, () => this._db[_nativeDb].updateInstance(newProps!, { useJsNames: true }));
      } else {
        // Some other UNIQUE index (not the primary key) was violated.
        const conflictDetail = err.conflictDetail as UniqueConstraintConflictDetail | undefined;
        // The write failed, so the row as it currently stands is still "their" version of it. For an insert
        // there is no such row - they have no version of this instance at all - so `theirs` stays undefined.
        const theirRow = isInsert ? undefined : this.tryReadCurrentInstance(id, classFullName);
        const violation = RebaseConflictImpl.recordUniqueConstraint(this, this._conflicts, oldProps, newProps!, theirRow, conflictDetail);

        // Fix this UNIQUE constraint violation by changing the value of one of the properties involved in the constraint until we
        // find a value that doesn't collide.
        const fix = this.fixUniqueConstraintViolation(newProps!, conflictDetail?.uniqueConstraintProperties, oldProps?.id);

        // Apply the updated row, which may trigger further conflicts (e.g. UNIQUE constraint violations).
        if (fix !== undefined) {
          violation.appliedFix = {
            property: this._db.getJsClass<typeof Element>(classFullName).toPropsAccessString(fix.property),
            value: fix.value,
          };
          this.applyOrRecordConstraintConflict(id, classFullName, oldProps, fix.props, () => {
            if (oldProps === undefined) {
              this._db[_nativeDb].insertInstance(fix.props, { forceUseId: true, useJsNames: true });
            } else {
              this._db[_nativeDb].updateInstance(fix.props, { useJsNames: true });
            }
          });
        }
      }
      return undefined;
    }
  }

  /** Finds a value for one of `uniqueConstraintProperties` that doesn't collide with any existing row, returning
   * `props` with that substitution applied plus a description of the substitution itself (in ECSql instance
   * access strings, as `uniqueConstraintProperties` are). Returns `undefined` if no such value could be found.
   */
  private fixUniqueConstraintViolation(props: RebaseConflictProperties, uniqueConstraintProperties: string[] | undefined, excludeId?: Id64String): UniqueConstraintFix | undefined {
    if (uniqueConstraintProperties === undefined || uniqueConstraintProperties.length === 0)
      return undefined;

    const classFullName = props.classFullName;
    if (typeof classFullName !== "string")
      return undefined;

    const supportedProperties = uniqueConstraintProperties.filter((accessString) => {
      const property = resolveSchemaViewProperty(this._schemaView, classFullName, accessString);
      return property !== undefined && !property.isArray();
    });
    if (supportedProperties.length !== uniqueConstraintProperties.length)
      return undefined;

    const stringProperty = supportedProperties.find((accessString) => {
      const property = resolveSchemaViewProperty(this._schemaView, classFullName, accessString);
      return property?.isPrimitive() === true && property.primitiveType === SchemaViewPrimitiveType.String;
    });
    const guidProperty = supportedProperties.find((accessString) => {
      const property = resolveSchemaViewProperty(this._schemaView, classFullName, accessString);
      return property?.isPrimitive() === true && property.primitiveType === SchemaViewPrimitiveType.Binary && property.extendedTypeName === "BeGuid";
    });
    if (stringProperty === undefined && guidProperty === undefined)
      return undefined;

    const currentValue = stringProperty === undefined ? undefined : getPropertyValue(props, stringProperty);
    const baseValue = typeof currentValue === "string" && currentValue.length > 0
      ? currentValue.replace(/\(Conflict(?:-\d+)?\)$/, "").trimEnd()
      : undefined;

    for (let attempt = 0; attempt <= MAX_UNIQUE_CONSTRAINT_FIX_ATTEMPTS; attempt++) {
      const fixedProps = { ...props };
      const accessString = stringProperty ?? guidProperty!;
      const property = resolveSchemaViewProperty(this._schemaView, classFullName, accessString);
      if (property === undefined || !property.isPrimitive())
        return undefined;

      const replacement = property.primitiveType === SchemaViewPrimitiveType.Binary && property.extendedTypeName === "BeGuid"
        ? Guid.createValue()
        : baseValue === undefined
          ? undefined
          : `${baseValue}${attempt === 0 ? " (Conflict)" : ` (Conflict-${attempt})`}`;
      if (replacement === undefined)
        return undefined;

      setPropertyValue(fixedProps, accessString, replacement);
      const hasConflict = this.hasUniqueConstraintConflict(fixedProps, uniqueConstraintProperties, excludeId);
      if (!hasConflict)
        return { props: fixedProps, property: accessString, value: replacement };
    }

    return undefined;
  }

  private hasUniqueConstraintConflict(props: RebaseConflictProperties, uniqueConstraintProperties: string[], excludeId?: Id64String): boolean {
    const classFullName = props.classFullName;
    if (typeof classFullName !== "string")
      return true;

    const predicates: string[] = [];
    const binder = new QueryBinder();
    let parameterIndex = 0;
    for (const accessString of uniqueConstraintProperties) {
      const property = resolveSchemaViewProperty(this._schemaView, classFullName, accessString);
      if (property === undefined || property.isArray())
        return true;

      const instanceAccessString = accessString;
      const value = property.isNavigation() ? getPropertyValue(props, `${accessString}.id`) : getPropertyValue(props, accessString);
      if (value === undefined || value === null) {
        predicates.push(`${instanceAccessString} IS NULL`);
      } else {
        predicates.push(`${instanceAccessString} = ?`);
        ++parameterIndex;
        if (property.isNavigation()) {
          binder.bindId(parameterIndex, value);
          continue;
        }
        if (!property.isPrimitive())
          return true;
        if (property.primitiveType === SchemaViewPrimitiveType.Binary && property.extendedTypeName === "BeGuid")
          binder.bindString(parameterIndex, value);
        else if (property.primitiveType === SchemaViewPrimitiveType.String || property.primitiveType === SchemaViewPrimitiveType.DateTime)
          binder.bindString(parameterIndex, value);
        else if (property.primitiveType === SchemaViewPrimitiveType.Integer)
          binder.bindInt(parameterIndex, value);
        else if (property.primitiveType === SchemaViewPrimitiveType.Long)
          binder.bindLong(parameterIndex, value);
        else if (property.primitiveType === SchemaViewPrimitiveType.Double)
          binder.bindDouble(parameterIndex, value);
        else if (property.primitiveType === SchemaViewPrimitiveType.Boolean)
          binder.bindBoolean(parameterIndex, value);
        else
          return true;
      }
    }

    if (excludeId !== undefined) {
      predicates.push("ECInstanceId <> ?");
      binder.bindId(++parameterIndex, excludeId);
    }

    return this._db.withQueryReader(`SELECT ECInstanceId FROM ${classFullName} WHERE ${predicates.join(" AND ")} LIMIT 1`, (reader) => reader.step(), binder);
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

  private findBrokenRelationships(props: RebaseConflictProperties): BrokenRelationship[] {
    const classFullName = props.classFullName;
    if (typeof classFullName !== "string")
      return [];

    const schemaClassDef = this._schemaView.findClass(classFullName);
    if (schemaClassDef === undefined)
      return [];

    let jsClassDef: typeof Element | undefined;
    try {
      jsClassDef = this._db.getJsClass<typeof Element>(classFullName);
    } catch {
      // Ignore if class is not registered in JS
    }

    const broken: BrokenRelationship[] = [];
    for (const prop of schemaClassDef.getProperties()) {
      if (!prop.isNavigation())
        continue;

      // 1. Convert the ECProperty name (e.g. "Parent") to the JS property name used on `props` (e.g. "parent")
      // using standard `ECJsNames.toJsName`.
      const jsName = ECJsNames.toJsName(prop.name);
      const navValue = getPropertyValue(props, jsName);
      const navId = typeof navValue === "string" ? navValue : (typeof navValue?.id === "string" ? navValue.id : undefined);
      if (typeof navId !== "string" || !Id64.isValidId64(navId))
        continue;

      // 2. Translate `jsName` (instance access string) to the access string into `ours` (deserialized props).
      const propsAccessString = jsClassDef ? jsClassDef.toPropsAccessString(jsName) : jsName;

      // 3. Determine the targeted constraint based on the navigation property's relationship direction:
      // - Forward direction points to the relationship's target constraint.
      // - Backward direction points to the relationship's source constraint.
      const relConstraint = prop.direction === StrengthDirection.Backward
        ? prop.relationshipClass.source
        : prop.relationshipClass.target;
      const targetClass = relConstraint?.abstractConstraint?.fullName
        ?? relConstraint?.constraintClasses[0]?.fullName
        ?? "BisCore:Element";

      // 4. Query whether the target instance exists. We attempt the query against the resolved constraint class first.
      // If that query throws an exception (e.g. if the constraint class cannot be directly queried in ECSQL),
      // we attempt a fallback check against "BisCore:Element" before concluding the relationship is broken.
      let exists = false;
      try {
        const binder = new QueryBinder().bindId(1, navId);
        exists = this._db.withQueryReader(`SELECT 1 FROM ${targetClass} WHERE ECInstanceId = ? LIMIT 1`, (reader) => reader.step(), binder);
      } catch {
        try {
          const binder = new QueryBinder().bindId(1, navId);
          exists = this._db.withQueryReader(`SELECT 1 FROM BisCore:Element WHERE ECInstanceId = ? LIMIT 1`, (reader) => reader.step(), binder);
        } catch {
          exists = false;
        }
      }

      if (!exists) {
        broken.push({
          relationshipClass: prop.relationshipClass,
          navigationProperty: propsAccessString,
        });
      }
    }
    return broken;
  }

  /**
   * Applies a resolved conflict's properties directly to the iModel via the native instance writer.
   * Used by conflict resolution methods (`acceptOurs`/`acceptTheirs`) once native reinstatement of the
   * txn is no longer in progress, so there is no changeset-apply conflict callback to defer to.
   *
   * @param fullReplace When true, properties absent from `props` are cleared instead of left as-is, so
   * that `props` fully replaces the instance rather than incrementally updating it.
   * @internal
   */
  public applyConflictResolution(conflict: RebaseConflict, props: RebaseConflictProperties | undefined, fullReplace: boolean = false, properties?: string[]): void {
    const conflictImpl = conflict as RebaseConflictImpl;
    if (props === undefined) {
      const key = { id: conflict.id, classFullName: conflict.classFullName };
      this._db[_nativeDb].deleteInstance(key, { useJsNames: true });
      conflictImpl.clearSupersededUniqueConstraintViolations(undefined);
      this._db.clearCaches();
      return;
    }

    conflictImpl.clearSupersededUniqueConstraintViolations(properties);
    this.writeConflictResolution(conflictImpl, props, fullReplace, 0);

    // TODO: too heavy-handed?
    this._db.clearCaches();
  }

  /** Writes a resolved conflict's properties, resolving any UNIQUE constraint violation the write provokes the
   * same way the initial replay does: record the violation on the conflict, pick a non-colliding value for one
   * of the constrained properties, and retry. Re-applying "our" values necessarily reintroduces whatever
   * violation they caused in the first place, so this must not escape as an exception.
   */
  private writeConflictResolution(conflict: RebaseConflictImpl, props: RebaseConflictProperties, fullReplace: boolean, attempt: number): void {
    try {
      try {
        this._db[_nativeDb].updateInstance(props, { useJsNames: true, useIncrementalUpdate: !fullReplace });
      } catch (err: any) {
        if (err.errorNumber !== DbResult.BE_SQLITE_NOTFOUND)
          throw err;
        // Row does not exist - try inserting it.
        this._db[_nativeDb].insertInstance(props, { forceUseId: true, useJsNames: true });
      }
    } catch (err: any) {
      if (err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_UNIQUE && err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY)
        throw err;
      if (attempt >= MAX_UNIQUE_CONSTRAINT_FIX_ATTEMPTS)
        throw err;

      const conflictDetail = err.conflictDetail as UniqueConstraintConflictDetail | undefined;
      const violation = conflict.upsertUniqueConstraintViolation(conflictDetail);

      const fix = this.fixUniqueConstraintViolation(props, conflictDetail?.uniqueConstraintProperties, conflict.id);
      if (fix === undefined)
        throw err;

      violation.appliedFix = {
        property: this._db.getJsClass<typeof Element>(conflict.classFullName).toPropsAccessString(fix.property),
        value: fix.value,
      };
      this.writeConflictResolution(conflict, fix.props, fullReplace, attempt + 1);
    }
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

  return [...new Set([...Object.keys(baseline), ...Object.keys(compare)])].filter((prop) => prop !== "id" && prop !== "classFullName" && valuesDiffer(baseline[prop], compare[prop]));
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

/** Resolves a conflict by writing `properties` (props access strings) taken from `source` onto the instance,
 * leaving its other properties as they are. If `properties` is not specified, or is empty, every property of
 * `source` is written instead, fully replacing the instance with `source`'s version. The values are
 * round-tripped through [[Entity.serialize]], which is what knows how a props value is represented in an
 * ECSql instance (e.g. props `placement.origin` `[x, y]` is instance `origin` `{x, y}`).
 */
function applyResolution(
  rebase: InteractiveRebase,
  conflict: RebaseConflict,
  source: RebaseConflictProperties | undefined,
  properties?: string[]
): void {
  let fullReplace = true;
  let updateProps: RebaseConflictProperties | undefined = undefined;;

  if (source !== undefined) {
    const classDef = rebase.iModel.getJsClass<typeof Element>(conflict.classFullName);
    const instance = classDef.serialize(source as ElementProps, rebase.iModel);

    updateProps = instance;

    if (properties !== undefined && properties.length > 0) {
      // Explicitly requested properties must be set even when their value is `undefined` (e.g. reverting a
      // property that a previous acceptTheirs() set, back to a value ours never had) - a native update leaves
      // any property it isn't given untouched, so an `undefined` here must become an explicit `null` rather
      // than being omitted, or it would silently keep whatever value is currently in the iModel.
      fullReplace = false;
      updateProps = { id: conflict.id, classFullName: conflict.classFullName };
      for (const prop of properties) {
        const instanceAccessString = classDef.toInstanceAccessString(prop);
        const value = getPropertyValue(instance, instanceAccessString);
        setPropertyValue(updateProps, instanceAccessString, value === undefined ? null : value);
      }
    }
  }

  rebase.applyConflictResolution(conflict, updateProps, fullReplace, properties);
}

/** Implements {@link RebaseConflict} and provides the `record*` helpers used to build up a conflict for a
 * given instance as it is discovered. Detections for the same instance id are merged into a single entry
 * (e.g. an Update conflict followed by a UNIQUE constraint violation while retrying the write), since
 * {@link RebaseConflict} reports at most one entry per instance.
 */
class RebaseConflictImpl implements RebaseConflict {
  public readonly id: Id64String;
  public readonly classFullName: string;
  public original: RebaseConflictProperties | undefined = undefined;
  public theirs: RebaseConflictProperties | undefined = undefined;
  public ours: RebaseConflictProperties | undefined = undefined;
  public readonly theirModifiedProperties: string[] = [];
  public readonly ourModifiedProperties: string[] = [];
  public readonly conflictingProperties: string[] = [];
  public readonly differentProperties: string[] = [];
  public readonly uniqueConstraintViolations: UniqueConstraintViolation[] = [];
  public readonly brokenRelationships: BrokenRelationship[] = [];

  private constructor(private readonly _rebase: InteractiveRebase, id: Id64String, classFullName: string) {
    this.id = id;
    this.classFullName = classFullName;
  }

  private static getOrCreate(rebase: InteractiveRebase, conflicts: RebaseConflict[], id: Id64String, classFullName: string): RebaseConflictImpl {
    let conflict = conflicts.find((c) => c.id === id) as RebaseConflictImpl | undefined;
    if (conflict === undefined) {
      conflict = new RebaseConflictImpl(rebase, id, classFullName);
      conflicts.push(conflict);
    }
    return conflict;
  }

  /** Both the incoming (their) changes and the local (our) changes modified the same instance. */
  public static recordUpdate(rebase: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties, theirs: RebaseConflictProperties, ours: RebaseConflictProperties, conflictingProperties: string[]): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(original.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, original.id, original.classFullName);

    addPropsAccessStrings(conflict.conflictingProperties, classDef, conflictingProperties);
    addPropsAccessStrings(conflict.theirModifiedProperties, classDef, computeChangedProperties(original, theirs));
    addPropsAccessStrings(conflict.ourModifiedProperties, classDef, computeChangedProperties(original, ours));
    addPropsAccessStrings(conflict.differentProperties, classDef, computeChangedProperties(theirs, ours));

    conflict.original = classDef.deserialize({ row: original, iModel: rebase.iModel });
    conflict.theirs = classDef.deserialize({ row: theirs, iModel: rebase.iModel });
    conflict.ours = classDef.deserialize({ row: ours, iModel: rebase.iModel });
  }

  /** The incoming (their) changes modified properties on an instance that was deleted by the local (our) changes. */
  public static recordTheirUpdateOurDelete(rebase: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties, theirs: RebaseConflictProperties, updatedProperties: string[]): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(original.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, original.id, original.classFullName);

    addPropsAccessStrings(conflict.theirModifiedProperties, classDef, updatedProperties);

    conflict.original = classDef.deserialize({ row: original, iModel: rebase.iModel });
    conflict.theirs = classDef.deserialize({ row: theirs, iModel: rebase.iModel });
  }

  /** The incoming (their) changes deleted an instance that was modified by the local (our) changes. */
  public static recordTheirDeleteOurUpdate(rebase: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties, ours: RebaseConflictProperties, updatedProperties: string[]): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(original.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, original.id, original.classFullName);

    addPropsAccessStrings(conflict.ourModifiedProperties, classDef, updatedProperties);

    conflict.original = classDef.deserialize({ row: original, iModel: rebase.iModel });
    conflict.ours = classDef.deserialize({ row: ours, iModel: rebase.iModel });
  }

  /** Both the incoming (their) changes and the local (our) changes inserted an instance with the same id. */
  public static recordInsert(rebase: InteractiveRebase, conflicts: RebaseConflict[], ours: RebaseConflictProperties, theirs: RebaseConflictProperties): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(ours.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, ours.id, ours.classFullName);

    addPropsAccessStrings(conflict.differentProperties, classDef, computeChangedProperties(ours, theirs));

    conflict.theirs = classDef.deserialize({ row: theirs, iModel: rebase.iModel });
    conflict.ours = classDef.deserialize({ row: ours, iModel: rebase.iModel });
  }

  /** Our change (insert or update) violated a UNIQUE constraint against some other, unrelated instance. */
  public static recordUniqueConstraint(rebase: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties | undefined, ours: RebaseConflictProperties, theirs: RebaseConflictProperties | undefined, detail?: UniqueConstraintConflictDetail): UniqueConstraintViolation {
    const instanceId = ours.id ?? original?.id;
    const classFullName = ours.classFullName ?? original?.classFullName;
    const conflict = this.getOrCreate(rebase, conflicts, instanceId, classFullName);

    const classDef = rebase.iModel.getJsClass<typeof Element>(ours.classFullName);

    if (original !== undefined) {
      conflict.original = classDef.deserialize({ row: original, iModel: rebase.iModel });
    }
    if (theirs !== undefined && conflict.theirs === undefined) {
      conflict.theirs = classDef.deserialize({ row: theirs, iModel: rebase.iModel });
    }
    conflict.ours = classDef.deserialize({ row: ours, iModel: rebase.iModel });

    return conflict.upsertUniqueConstraintViolation(detail);
  }

  /** Our change (insert or update) violated a FOREIGN KEY constraint, e.g. referencing a deleted instance. */
  public static recordForeignKeyConstraint(rebase: InteractiveRebase, conflicts: RebaseConflict[], original: RebaseConflictProperties | undefined, ours: RebaseConflictProperties | undefined, theirs: RebaseConflictProperties | undefined, brokenRelationships: BrokenRelationship[]): RebaseConflictImpl {
    const instanceId = ours?.id ?? original?.id ?? theirs?.id;
    const classFullName = ours?.classFullName ?? original?.classFullName ?? theirs?.classFullName;
    const conflict = this.getOrCreate(rebase, conflicts, instanceId!, classFullName!);

    const classDef = rebase.iModel.getJsClass<typeof Element>(conflict.classFullName);

    if (original !== undefined) {
      conflict.original = classDef.deserialize({ row: original, iModel: rebase.iModel });
    }
    if (theirs !== undefined && conflict.theirs === undefined) {
      conflict.theirs = classDef.deserialize({ row: theirs, iModel: rebase.iModel });
    }
    if (ours !== undefined) {
      conflict.ours = classDef.deserialize({ row: ours, iModel: rebase.iModel });
    }

    for (const broken of brokenRelationships) {
      if (!conflict.brokenRelationships.some((b) => b.navigationProperty === broken.navigationProperty && b.relationshipClass === broken.relationshipClass)) {
        conflict.brokenRelationships.push(broken);
      }
    }

    return conflict;
  }

  /** Returns the entry describing `detail`'s constraint, creating it if this is the first time that constraint has
   * been violated for this instance. Re-violating an already-recorded constraint refreshes the existing entry
   * rather than appending, since {@link uniqueConstraintViolations} describes the instance's current state.
   */
  public upsertUniqueConstraintViolation(detail: UniqueConstraintConflictDetail | undefined): UniqueConstraintViolation {
    const classDef = this._rebase.iModel.getJsClass<typeof Element>(this.classFullName);

    const uniqueConstraintProperties: string[] = [];
    if (detail !== undefined) {
      addPropsAccessStrings(uniqueConstraintProperties, classDef, detail.uniqueConstraintProperties);
    }
    // An empty list means native could not map the violated index back to EC properties. Surface the conflict anyway.

    const existing = this.uniqueConstraintViolations.find((other) =>
      other.uniqueConstraintProperties.length === uniqueConstraintProperties.length &&
      other.uniqueConstraintProperties.every((prop, i) => prop === uniqueConstraintProperties[i]));

    const conflictingInstance = classDef.deserialize({ row: detail?.conflictingInstance ?? {}, iModel: this._rebase.iModel });
    if (existing !== undefined) {
      existing.conflictingInstance = conflictingInstance;
      existing.appliedFix = undefined;
      return existing;
    }

    const violation: UniqueConstraintViolation = { uniqueConstraintProperties, conflictingInstance: conflictingInstance };
    this.uniqueConstraintViolations.push(violation);
    return violation;
  }

  /** Discards the violations that `properties` (all of them, when it is undefined or empty) is about to overwrite,
   * so that {@link uniqueConstraintViolations} keeps describing the substitutions currently in effect. A violation
   * whose substituted property is left untouched still holds, and one that was never fixed describes a write that
   * was abandoned, so it is dropped and re-reported if it recurs.
   */
  public clearSupersededUniqueConstraintViolations(properties: string[] | undefined): void {
    const survives = (violation: UniqueConstraintViolation) =>
      violation.appliedFix !== undefined && properties !== undefined && properties.length > 0 && !properties.includes(violation.appliedFix.property);

    for (let i = this.uniqueConstraintViolations.length - 1; i >= 0; --i) {
      if (!survives(this.uniqueConstraintViolations[i]))
        this.uniqueConstraintViolations.splice(i, 1);
    }
  }

  public acceptOurs(properties?: string[]): void {
    applyResolution(this._rebase, this, this.ours, properties);
  }

  public acceptTheirs(properties?: string[]): void {
    applyResolution(this._rebase, this, this.theirs, properties);
  }
}
