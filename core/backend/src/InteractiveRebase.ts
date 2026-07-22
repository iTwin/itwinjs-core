/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { BriefcaseDb } from "./IModelDb";
import { EditTxn } from "./EditTxn";
import { assert, DbConflictResolution, Id64String, ITwinError } from "@itwin/core-bentley";
import { TxnProps } from "@itwin/core-common";
import { _nativeDb } from "./internal/Symbols";
import { RebaseChangesetConflictArgs } from "./internal/ChangesetConflictArgs";

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
  classId: Id64String;
}

/**
 * The properties involved in a rebase conflict.
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
  original: RebaseConflictProperties;
  theirs: RebaseConflictProperties;
  ours: RebaseConflictProperties;

  acceptOurs(rebase: InteractiveRebase, properties?: string[]): void;
  acceptTheirs(rebase: InteractiveRebase, properties?: string[]): void;
}

/**
 * The incoming (their) changes modified properties on an instance that was deleted by the
 * local (our) changes.
 */
export interface TheirUpdateOurDeleteRebaseConflict extends RebaseConflict {
  kind: "TheirUpdateOurDelete";
  original: RebaseConflictProperties;
  theirs: RebaseConflictProperties;
}

/**
 * The incoming (their) changes deleted an instance that was modified by the
 * local (our) changes.
 */
export interface TheirDeleteOurUpdateRebaseConflict extends RebaseConflict {
  kind: "TheirDeleteOurUpdate";
  original: RebaseConflictProperties;
  ours: RebaseConflictProperties;
}

/**
 * Both the incoming (their) changes and the local (our) changes inserted an instance
 * with the same primary key (ECInstanceId).
 */
export interface InsertRebaseConflict extends RebaseConflict {
  kind: "Insert";
  theirs: RebaseConflictProperties;
  ours: RebaseConflictProperties;
}

export interface ForeignKeyConstraintRebaseConflict extends RebaseConflict {
  kind: "ForeignKeyConstraint";
  numberOfConflictingRows: number;
}

export interface UniqueConstraintViolation {
  /**
   * The properties that are part of the UNIQUE constraint that is violated.
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

export interface TxnRebaseGroup {
  txns: TxnProps[];
}

const INTERACTIVE_REBASE_CONFLICT_HANDLER_ID = "InteractiveRebaseConflictHandler";

export class InteractiveRebase {
  private _db: BriefcaseDb;
  private _editTxn: EditTxn | undefined;
  private _txns: TxnProps[];
  private _groups: TxnRebaseGroup[];
  private _currentGroupIndex: number = -1;
  private _conflicts: RebaseConflict[] = [];

  constructor(db: BriefcaseDb, txns: TxnProps[]) {
    this._db = db;
    this._txns = txns;
    this._groups = this._txns.map(txn => ({ txns: [txn] }));

    if (this._groups.length > 0) {
      db.txns.rebaser.addConflictHandler({
        id: INTERACTIVE_REBASE_CONFLICT_HANDLER_ID,
        handler: this.handleRebaseConflict.bind(this),
      });
    }
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

    nativeDb.pullMergeRebaseReinstateTxn();

    return this._currentGroupIndex < this._groups.length - 1;
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

  private handleRebaseConflict(conflict: RebaseChangesetConflictArgs): DbConflictResolution | undefined {
    if (conflict.opcode === "Deleted") {
      if (conflict.cause === "NotFound") {
        // Our txn is trying to delete a row that has already been deleted by the new upstream changesets.
        // We can safely ignore this.
        return DbConflictResolution.Skip;
      } else if (conflict.cause === "Data") {
        // Our txn is trying to delete a row that has been modified by the new upstream changesets.
        // Proceed with the delete but report the conflicting update.
        return TheirUpdateOurDeleteRebaseConflictImpl.handle(this._conflicts, conflict);
      }
      assert(false, `Conflicts during a Deleted change should only have NotFound or Data as the conflict cause. Unexpected cause: ${conflict.cause}`);
    } else if (conflict.opcode === "Inserted") {
      if (conflict.cause === "Constraint") {
        // Because this change was valid when it was created, and the schema has not changed,
        // this can _only_ be a UNIQUE constraint violation.
        // We must SKIP, because REPLACE is not allowed. But report the new column values for conflict resolution.
        return UniqueConstraintRebaseConflictImpl.handle(this._conflicts, conflict);
      } else if (conflict.cause === "Conflict") {
        // The primary key already exists, which means local and upstream both inserted this instance.
        // Leave the existing intact, but report the new column values for conflict resolution.
        // --> InsertRebaseConflict
        // TODO
        return DbConflictResolution.Skip;
      }
      assert(false, `Conflicts during an Inserted change should only have Constraint or Conflict as the conflict cause. Unexpected cause: ${conflict.cause}`);
    } else if (conflict.opcode === "Updated") {
      if (conflict.cause === "NotFound") {
        // Our txn is trying to update a row that has been deleted by the new upstream changesets.
        // Let the delete stand, but report the conflict.
        return TheirDeleteOurUpdateRebaseConflictImpl.handle(this._conflicts, conflict);
      } else if (conflict.cause === "Constraint") {
        // Because this change was valid when it was created, and the schema has not changed,
        // this can _only_ be a UNIQUE constraint violation.
        // We must SKIP - REPLACE is not allowed. But report the new column values for conflict resolution.
        return UniqueConstraintRebaseConflictImpl.handle(this._conflicts, conflict);
      } else if (conflict.cause === "Data") {
        // Our txn is changing the values in an existing row, and the new upstream changesets
        // have also changed one or more values in that row.
        return UpdateRebaseConflictImpl.handle(this._conflicts, conflict);
      }
      assert(false, `Conflicts during an Updated change should only have NotFound, Constraint, or Data as the conflict cause. Unexpected cause: ${conflict.cause}`);
    } else if (conflict.opcode === undefined) {
      if (conflict.cause === "ForeignKey") {
        // TODO
        return DbConflictResolution.Skip;
      }
      assert(false, `Conflicts without an opcode should only have ForeignKey as the conflict cause. Unexpected cause: ${conflict.cause}`);
    }

    return undefined;
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

class UpdateRebaseConflictImpl implements UpdateRebaseConflict {
  public readonly kind: "Update" = "Update";

  public readonly id: Id64String;
  public readonly classId: Id64String;
  public readonly original: RebaseConflictProperties = {};
  public readonly theirs: RebaseConflictProperties = {};
  public readonly ours: RebaseConflictProperties = {};

  public static handle(conflicts: RebaseConflict[], conflict: RebaseChangesetConflictArgs): DbConflictResolution {
    const ecConflict = conflict.ecConflict;
    const instanceId = ecConflict.original.ECInstanceId;

    let instanceConflict = conflicts.find(conflict => conflict.id === instanceId && conflict.kind === "Update") as UpdateRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new UpdateRebaseConflictImpl(instanceId, ecConflict.original.ECClassId);
      conflicts.push(instanceConflict);
    }

    for (const conflict of ecConflict.dataConflictProperties) {
      instanceConflict.original[conflict] = ecConflict.original[conflict];
      instanceConflict.theirs[conflict] = ecConflict.theirs[conflict];
      instanceConflict.ours[conflict] = ecConflict.ours[conflict];
    }

    // Always accept "our" changes at this stage. That minimizes the chances of further
    // conflicts in subsequent txns.
    return DbConflictResolution.Replace;
  }

  public constructor(id: Id64String, classId: Id64String) {
    this.id = id;
    this.classId = classId;
  }

  public acceptOurs(rebase: InteractiveRebase, properties?: string[]): void {
    const updateProps: RebaseConflictProperties = { id: this.id };
    if (!properties || properties.length === 0) {
      Object.assign(updateProps, this.ours);
    } else {
      for (const prop of properties) {
        updateProps[prop] = this.ours[prop];
      }
    }

    rebase.editTxn.updateElement(updateProps);
  }

  public acceptTheirs(rebase: InteractiveRebase, properties?: string[]): void {
    const updateProps: RebaseConflictProperties = { id: this.id };
    if (!properties || properties.length === 0) {
      Object.assign(updateProps, this.theirs);
    } else {
      for (const prop of properties) {
        updateProps[prop] = this.theirs[prop];
      }
    }

    rebase.editTxn.updateElement(updateProps);
  }
}

class TheirDeleteOurUpdateRebaseConflictImpl implements TheirDeleteOurUpdateRebaseConflict {
  public readonly kind: "TheirDeleteOurUpdate" = "TheirDeleteOurUpdate";

  public readonly id: Id64String;
  public readonly classId: Id64String;
  public readonly original: RebaseConflictProperties = {};
  public readonly ours: RebaseConflictProperties = {};

  public static handle(conflicts: RebaseConflict[], conflict: RebaseChangesetConflictArgs): DbConflictResolution {
    const ecConflict = conflict.ecConflict;
    const instanceId = ecConflict.original.ECInstanceId;

    let instanceConflict = conflicts.find(conflict => conflict.id === instanceId && conflict.kind === "TheirDeleteOurUpdate") as TheirDeleteOurUpdateRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new TheirDeleteOurUpdateRebaseConflictImpl(instanceId, ecConflict.original.ECClassId);
      conflicts.push(instanceConflict);
    }

    for (const conflict of ecConflict.dataConflictProperties) {
      instanceConflict.original[conflict] = ecConflict.original[conflict];
      instanceConflict.ours[conflict] = ecConflict.ours[conflict];
    }

    return DbConflictResolution.Skip;
  }

  public constructor(id: Id64String, classId: Id64String) {
    this.id = id;
    this.classId = classId;
  }
}

class UniqueConstraintRebaseConflictImpl implements UniqueConstraintRebaseConflict {
  public readonly kind: "UniqueConstraint" = "UniqueConstraint";

  public readonly id: Id64String;
  public readonly classId: Id64String;
  public readonly original: RebaseConflictProperties | undefined = undefined;
  public readonly theirs: RebaseConflictProperties = {};
  public readonly ours: RebaseConflictProperties = {};
  public readonly uniqueConstraintViolations: UniqueConstraintViolation[] = [];

  public static handle(conflicts: RebaseConflict[], conflict: RebaseChangesetConflictArgs): DbConflictResolution {
    const ecConflict = conflict.ecConflict;

    const instanceId = ecConflict.ours.ECInstanceId ?? ecConflict.original.ECInstanceId;
    const classId = ecConflict.ours.ECClassId ?? ecConflict.original.ECClassId;

    let instanceConflict = conflicts.find(c => c.id === instanceId && c.kind === "UniqueConstraint") as UniqueConstraintRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = new UniqueConstraintRebaseConflictImpl(instanceId, classId);
      conflicts.push(instanceConflict);
    }

    for (const prop of Object.keys(ecConflict.ours)) {
      instanceConflict.ours[prop] = ecConflict.ours[prop];
    }

    if (ecConflict.original) {
      if (instanceConflict.original === undefined) {
        instanceConflict.original = {};
      }
      for (const prop of Object.keys(ecConflict.original)) {
        instanceConflict.original[prop] = ecConflict.original[prop];
      }
    }

    instanceConflict.uniqueConstraintViolations = ecConflict.uniqueConstraintViolations;

    return DbConflictResolution.Skip;
  }

  public constructor(id: Id64String, classId: Id64String) {
    this.id = id;
    this.classId = classId;
  }
}

class TheirUpdateOurDeleteRebaseConflictImpl implements TheirUpdateOurDeleteRebaseConflict {
  public readonly kind: "TheirUpdateOurDelete" = "TheirUpdateOurDelete";

  public readonly id: Id64String;
  public readonly classId: Id64String;
  public readonly original: RebaseConflictProperties = {};
  public readonly theirs: RebaseConflictProperties = {};

  public static handle(conflicts: RebaseConflict[], conflict: RebaseChangesetConflictArgs): DbConflictResolution {
    const ecConflict = conflict.ecConflict;
    const instanceId = ecConflict.original.ECInstanceId;

    let instanceConflict = conflicts.find(conflict => conflict.id === instanceId && conflict.kind === "TheirUpdateOurDelete") as TheirUpdateOurDeleteRebaseConflict | undefined;
    if (instanceConflict === undefined) {
      instanceConflict = {
        kind: "TheirUpdateOurDelete",
        id: instanceId,
        classId: ecConflict.original.ECClassId,
        original: {},
        theirs: {}
      };
      conflicts.push(instanceConflict);
    }

    for (const conflict of ecConflict.dataConflictProperties) {
      instanceConflict.original[conflict] = ecConflict.original[conflict];
      instanceConflict.theirs[conflict] = ecConflict.theirs[conflict];
    }

    return DbConflictResolution.Replace;
  }

  public constructor(id: Id64String, classId: Id64String) {
    this.id = id;
    this.classId = classId;
  }
}
