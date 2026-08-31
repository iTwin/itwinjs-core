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
import { SchemaView, SchemaViewPrimitiveType, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";
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
   * The conflict recorded for this instance's embedding owner (e.g. an aspect's element, or a child element's
   * parent), if the owner also has a conflict recorded for it. Undefined if this instance has no embedding
   * owner, or if its owner does but nothing about the owner conflicted.
   */
  ownerConflict: RebaseConflict | undefined;

  /**
   * The conflicts recorded for this instance's embedded dependents (aspects, child elements), if this instance
   * is itself an embedding owner. Empty if this instance owns no dependents, or none of them have conflicts.
   */
  dependentConflicts: ReadonlyArray<RebaseConflict>;

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

/** A node in the per-Txn embedding-ownership forest built by [[InteractiveRebase.buildDependencyForest]].
 * `change` is undefined for a node discovered live (section 6 of the design) - a dependent upstream
 * inserted or otherwise left behind that our own local Txn never captured a change for.
 */
interface DependencyNode {
  id: Id64String;
  classFullName: string;
  change: RebaseInstanceChange | undefined;
  /** Owner's ECInstanceId, or undefined if this instance has no embedding owner (or its owner wasn't
   * captured by this Txn - see [[InteractiveRebase.getOwnerId]]). */
  ownerId: Id64String | undefined;
  dependents: DependencyNode[];
}

/** Composite key used by [[InteractiveRebase._dependencyNodesById]] and [[InteractiveRebase._theirsSnapshot]],
 * both of which can hold a mix of Element and non-Element (e.g. aspect) instances that draw their
 * ECInstanceIds from independent sequences and so can share a numeric id (see the design doc section 5)
 * - a plain `id` key would risk conflating them. */
function makeInstanceKey(id: Id64String, classFullName: string): string {
  return `${id}|${classFullName}`;
}

export class InteractiveRebase {
  private _db: BriefcaseDb;
  private _schemaView: SchemaView;
  private _editTxn: EditTxn | undefined;
  private _txns: TxnProps[];
  private _groups: TxnRebaseGroup[];
  private _currentGroupIndex: number = -1;
  private _conflicts: RebaseConflict[] = [];

  /** classFullName -> access string of its embedding-owner nav property, or undefined if it has none. */
  private _embeddingOwnerProperty = new Map<string, string | undefined>();

  /** Pre-replay ("theirs") snapshot of every instance involved in the current group's Txn, captured
   * immediately after `pullMergeRebaseNext()` and before any local replay writes anything. Retained for
   * the lifetime of the group's conflicts - resolution (restoring an owner's closure) needs it. Keyed by
   * [[makeInstanceKey]].
   */
  private _theirsSnapshot = new Map<string, RebaseConflictProperties | undefined>();

  /** Every node of the current group's dependency forest (section 5 of the design), keyed by
   * [[makeInstanceKey]]. Includes both captured changes and any live-discovered dependents (section 6).
   */
  private _dependencyNodesById = new Map<string, DependencyNode>();

  /** The subset of [[_dependencyNodesById]] whose class is `BisCore:Element` or a subclass, keyed by plain
   * `id` - safe because two Elements can never share an id (see the design doc section 5). Every embedding
   * relationship's owner side is an Element, so this is what `ownerId`s are resolved against.
   */
  private _ownersById = new Map<Id64String, DependencyNode>();

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
   *
   * Replay is ordered by the per-Txn embedding-ownership forest (an owner is always applied before its
   * dependents - see [[buildDependencyForest]]) and conflict detection reads "theirs" from a snapshot
   * taken before any of this replay writes anything (see [[captureTheirsSnapshot]]), rather than from
   * a live read - both are necessary so a cascade-removed dependent's evidence survives long enough to
   * be compared against, and so a dependent's insert/update never precedes its owner's.
   */
  private reinstateDataTxn(txnProps: TxnProps): void {
    if (!BriefcaseManager.semanticRebaseDataFolderExists(this._db, txnProps.id)) {
      throw new IModelError(IModelStatus.BadRequest, `Local folder does not exist for transaction ${txnProps.id}`);
    }

    const dbPath = BriefcaseManager.createAndGetTxnChangedInstancePath(this._db, txnProps.id);
    using store = RebaseInstanceStore.openExisting(dbPath);
    const roots = this.buildDependencyForest(store);
    this.captureTheirsSnapshot();
    this.replayForest(roots);
    this.linkConflictOwnership();
    // Note: unlike the automatic "semantic rebase" replay, the captured data folder is intentionally
    // left in place here - `previousGroup`/`restartGroup`/`restartAll` are expected to eventually need
    // it to revert already-reinstated txns (currently unimplemented, see the TODOs below).
  }

  /** classFullName -> access string of its embedding-owner nav property, or undefined if it has none.
   * Modeled on the existing nav-property walk in [[findBrokenRelationships]].
   */
  private getEmbeddingOwnerProperty(classFullName: string): string | undefined {
    if (this._embeddingOwnerProperty.has(classFullName))
      return this._embeddingOwnerProperty.get(classFullName);

    const schemaClassDef = this._schemaView.findClass(classFullName);
    let ownerProp: string | undefined;
    if (schemaClassDef !== undefined) {
      for (const prop of schemaClassDef.getProperties()) {
        if (!prop.isNavigation())
          continue;
        if (prop.relationshipClass.strength !== StrengthType.Embedding)
          continue;
        // Backward references the relationship's source, which is the owning end. A Forward embedding
        // nav property points at the owned instance and would invert the tree.
        if (prop.direction !== StrengthDirection.Backward)
          continue;
        // An `Element` also has an Embedding+Backward `Model` nav property (`ModelContainsElements`),
        // which is not the aspect/child-element ownership this design is about - a Model's deletion
        // does not (and should not) cascade through this mechanism. Restrict to relationships whose
        // owning (source) side is itself `BisCore:Element` or a subclass, which excludes `Model` (not
        // an Element) while still matching `ElementOwnsUniqueAspect`/`MultiAspect`/`ChildElements`.
        const sourceConstraintClass = prop.relationshipClass.source?.abstractConstraint?.fullName
          ?? prop.relationshipClass.source?.constraintClasses[0]?.fullName;
        if (sourceConstraintClass === undefined || !this.isElementOrSubclass(sourceConstraintClass))
          continue;
        ownerProp = ECJsNames.toJsName(prop.name);
        break;
      }
    }
    this._embeddingOwnerProperty.set(classFullName, ownerProp);
    return ownerProp;
  }

  /** True for a captured Delete (no `new` snapshot) on an instance whose class has an embedding
   * owner - an aspect or child element removed as a side effect of its owner's deletion. Scoped to
   * deletes only; other indirect changes (including an `ON DELETE SET NULL` side effect) are
   * unaffected and keep force-applying.
   */
  private isCascadedDependentDelete(change: RebaseInstanceChange): boolean {
    if (change.new !== undefined || change.old === undefined)
      return false;
    return this.getEmbeddingOwnerProperty(change.old.classFullName) !== undefined;
  }

  /** True if `classFullName` is `BisCore:Element` or a subclass of it - the owning (source) constraint
   * class of every embedding relationship relevant here.
   */
  private isElementOrSubclass(classFullName: string): boolean {
    return this._schemaView.findClass(classFullName)?.is("BisCore:Element") ?? false;
  }

  /** Extracts the embedding-owner id from `props` (a captured instance's `new` snapshot when one exists,
   * else its `old` snapshot - see [[buildDependencyForest]]), or undefined if `classFullName` has no
   * embedding owner or the nav property has no value.
   */
  private getOwnerId(classFullName: string, props: RebaseConflictProperties): Id64String | undefined {
    const ownerProp = this.getEmbeddingOwnerProperty(classFullName);
    if (ownerProp === undefined)
      return undefined;
    const navValue = getPropertyValue(props, ownerProp);
    const navId = typeof navValue === "string" ? navValue : (typeof navValue?.id === "string" ? navValue.id : undefined);
    return typeof navId === "string" && Id64.isValidId64(navId) ? navId : undefined;
  }

  /**
   * Builds the current group's per-Txn embedding-ownership forest (design doc section 5) from `changes`,
   * populating [[_dependencyNodesById]] and [[_ownersById]], and returns its root nodes (instances whose
   * embedding owner either doesn't exist or wasn't captured by this Txn).
   *
   * A node's `ownerId` is taken from its `new` snapshot when one exists (Insert/Update), falling back to
   * `old` only for a pure Delete - this is what makes reparenting correct, since a child moved from `A`
   * to `B` in the same edit set must link to `B`, not be dragged into an unrelated deletion of `A`.
   *
   * Also performs the design doc section 6 live discovery: for every captured pure-Delete on an Element
   * (or subclass) instance, queries the live DB for dependents our Txn never touched (e.g. an aspect
   * upstream inserted after our local edit), recursively, and adds them to the forest and to
   * [[_dependencyNodesById]] with `change: undefined` so they can still be reported and cascaded away.
   */
  private buildDependencyForest(store: RebaseInstanceStore): DependencyNode[] {
    this._dependencyNodesById = new Map();
    this._ownersById = new Map();

    for (const change of store.all()) {
      const props = change.new ?? change.old;
      if (props === undefined)
        continue;
      const node: DependencyNode = {
        id: props.id,
        classFullName: props.classFullName,
        change,
        ownerId: undefined,
        dependents: []
      };
      this._dependencyNodesById.set(makeInstanceKey(node.id, node.classFullName), node);
      if (this.isElementOrSubclass(node.classFullName))
        this._ownersById.set(node.id, node);
    }

    const roots: DependencyNode[] = [];
    for (const node of this._dependencyNodesById.values()) {
      const change = node.change!;
      node.ownerId = this.getOwnerId(node.classFullName, change.new ?? change.old!);
      const owner = node.ownerId !== undefined ? this._ownersById.get(node.ownerId) : undefined;
      if (owner !== undefined)
        owner.dependents.push(node);
      else
        roots.push(node);
    }

    for (const node of this._dependencyNodesById.values()) {
      if (node.change?.old !== undefined && node.change?.new === undefined && this.isElementOrSubclass(node.classFullName))
        this.discoverUpstreamDependents(node);
    }

    return roots;
  }

  /** Design doc section 6: queries the live DB for `ownerNode`'s current aspects and child elements,
   * adding any not already known to this Txn (i.e. upstream-inserted, or otherwise never captured by
   * our local edits) to the forest as a dependent of `ownerNode`, recursively.
   */
  private discoverUpstreamDependents(ownerNode: DependencyNode): void {
    const discovered: { id: Id64String, classFullName: string }[] = [];
    // `Element` is declared separately on ElementUniqueAspect (via ElementOwnsUniqueAspect) and
    // ElementMultiAspect (via ElementOwnsMultiAspects), not on the abstract ElementAspect base -
    // querying the base class directly fails with "No property or enumeration found for
    // expression 'Element.Id'". `Parent` is declared directly on Element, so no such split is needed there.
    const queries = [
      "SELECT ECInstanceId, ec_classname(ECClassId, 's:c') FROM BisCore:ElementUniqueAspect WHERE Element.Id = ?",
      "SELECT ECInstanceId, ec_classname(ECClassId, 's:c') FROM BisCore:ElementMultiAspect WHERE Element.Id = ?",
      "SELECT ECInstanceId, ec_classname(ECClassId, 's:c') FROM BisCore:Element WHERE Parent.Id = ?",
    ];
    for (const sql of queries) {
      const binder = new QueryBinder().bindId(1, ownerNode.id);
      this._db.withQueryReader(sql, (reader) => {
        for (const row of reader)
          discovered.push({ id: row[0], classFullName: row[1] });
        return true;
      }, binder);
    }

    for (const { id, classFullName } of discovered) {
      if (this._dependencyNodesById.has(makeInstanceKey(id, classFullName)))
        continue;

      const node: DependencyNode = { id, classFullName, change: undefined, ownerId: ownerNode.id, dependents: [] };
      this._dependencyNodesById.set(makeInstanceKey(id, classFullName), node);
      if (this.isElementOrSubclass(classFullName))
        this._ownersById.set(id, node);
      ownerNode.dependents.push(node);

      this.discoverUpstreamDependents(node);
    }
  }

  /** Design doc section 7: captures the pre-replay ("theirs") state of every instance in the current
   * group's dependency forest. Must be called after `pullMergeRebaseNext()` and before any local replay
   * writes anything.
   */
  private captureTheirsSnapshot(): void {
    this._theirsSnapshot = new Map();
    for (const node of this._dependencyNodesById.values())
      this._theirsSnapshot.set(makeInstanceKey(node.id, node.classFullName), this.tryReadCurrentInstance(node.id, node.classFullName));
  }

  /** Design doc section 8: replays the forest depth-first. Owners are applied before dependents for
   * Insert/Update (a dependent's write must never precede its owner's), but dependents are applied
   * before their owner for Delete - unlike aspects (a real SQL `ON DELETE CASCADE`), a child element's
   * cascade-on-parent-delete is implemented by the Element API rather than a declared FK action (see
   * the investigation notes), so a raw instance delete of the owner does not remove it, and would
   * leave a dangling `ParentId` that violates the FK if the owner is deleted first.
   *
   * Two *independent* roots (neither linked to the other via `ownerId`, e.g. because one's resolved
   * owner was never itself captured by this Txn - a reparent target that already existed, say) have no
   * inherent ordering between them either, so [[orderRoots]] decides one for them.
   */
  private replayForest(roots: DependencyNode[]): void {
    for (const root of this.orderRoots(roots))
      this.replayNode(root);
  }

  /**
   * Orders independent roots (see [[replayForest]]) for replay by combining two heuristics:
   *
   * - A stable base order - Update, then Delete, then Insert - so a reparent-away Update on one root
   *   clears a stale reference before some other, unrelated root's Delete is attempted, avoiding a
   *   spurious FOREIGNKEY failure.
   * - An identity-value override: any root that frees up a `federationGuid` or `code` (by deleting the
   *   instance, or updating it away - see [[getFreedIdentityValues]]) is always replayed before any
   *   other root that claims that same value (by inserting it, or updating into it - see
   *   [[getClaimedIdentityValues]]), regardless of the base order, so reusing a value freed elsewhere in
   *   the same Txn - whether the reuse comes from an Insert *or* an Update to some unrelated, pre-existing
   *   instance - never spuriously collides with the not-yet-removed row.
   *
   * Only `federationGuid` and the `Code` triple are considered, since (unlike a genuine UNIQUE
   * constraint violation) there's no way to discover an arbitrary custom schema's own UNIQUE index short
   * of actually attempting the write; such a case can still surface as a (harmlessly auto-fixed) UNIQUE
   * constraint violation - see [[fixUniqueConstraintViolation]]. Similarly, if the two heuristics disagree
   * in a way that can't be satisfied together (a genuine cycle), the identity-value edges lose and the
   * base order applies instead, again leaving the UNIQUE constraint machinery to handle the fallout.
   */
  private orderRoots(roots: DependencyNode[]): DependencyNode[] {
    const category = (node: DependencyNode): number => {
      if (node.change === undefined || (node.change.new === undefined && node.change.old !== undefined))
        return 1; // Delete
      return node.change.old === undefined ? 2 : 0; // Insert : Update
    };
    const baseIndex = new Map<DependencyNode, number>();
    roots.forEach((node, i) => baseIndex.set(node, category(node) * roots.length + i));

    // from -> every root that must be replayed after `from`, because `from` frees a value that root claims.
    const mustFollow = new Map<DependencyNode, Set<DependencyNode>>();
    for (const freer of roots) {
      const freed = this.getFreedIdentityValues(freer);
      if (freed.size === 0)
        continue;
      for (const claimer of roots) {
        if (claimer === freer)
          continue;
        const claimed = this.getClaimedIdentityValues(claimer);
        for (const [key, value] of freed) {
          if (claimed.get(key) === value) {
            let followers = mustFollow.get(freer);
            if (followers === undefined)
              mustFollow.set(freer, followers = new Set());
            followers.add(claimer);
          }
        }
      }
    }

    // Kahn's algorithm, breaking ties (including nodes with no edges at all) by `baseIndex`.
    const inDegree = new Map<DependencyNode, number>(roots.map((node) => [node, 0]));
    for (const followers of mustFollow.values())
      for (const follower of followers)
        inDegree.set(follower, inDegree.get(follower)! + 1);

    const ordered: DependencyNode[] = [];
    const remaining = new Set(roots);
    while (remaining.size > 0) {
      const ready = [...remaining].filter((node) => inDegree.get(node) === 0);
      if (ready.length === 0) {
        // A cycle between the identity-value edges - fall back to the base order for whatever's left.
        ordered.push(...[...remaining].sort((a, b) => baseIndex.get(a)! - baseIndex.get(b)!));
        break;
      }
      ready.sort((a, b) => baseIndex.get(a)! - baseIndex.get(b)!);
      for (const node of ready) {
        ordered.push(node);
        remaining.delete(node);
        for (const follower of mustFollow.get(node) ?? [])
          inDegree.set(follower, inDegree.get(follower)! - 1);
      }
    }
    return ordered;
  }

  /** The identity-like values of `props` that participate in a BisCore-declared UNIQUE constraint:
   * `federationGuid`, and the `Code` triple (as a single composite value, since all three columns
   * together form the one UNIQUE index). Empty/unset values are omitted, since SQLite does not consider
   * `NULL` columns to collide with one another under a UNIQUE index.
   */
  private getUniqueIdentityValues(props: RebaseConflictProperties | undefined): Map<string, string> {
    const values = new Map<string, string>();
    if (props === undefined)
      return values;
    const federationGuid = getPropertyValue(props, "federationGuid");
    if (typeof federationGuid === "string" && federationGuid.length > 0)
      values.set("federationGuid", federationGuid);
    const codeValue = getPropertyValue(props, "code.value");
    if (typeof codeValue === "string" && codeValue.length > 0) {
      const codeScope = getPropertyValue(props, "code.scope");
      const codeSpec = getPropertyValue(props, "code.spec");
      values.set("code", `${typeof codeSpec === "string" ? codeSpec : ""}|${typeof codeScope === "string" ? codeScope : ""}|${codeValue}`);
    }
    return values;
  }

  /** The subset of `node`'s old identity values (see [[getUniqueIdentityValues]]) that this replay is
   * about to free up, because `node` is a Delete, or an Update that changes the value away from it.
   */
  private getFreedIdentityValues(node: DependencyNode): Map<string, string> {
    if (node.change === undefined)
      return new Map();
    const oldValues = this.getUniqueIdentityValues(node.change.old);
    const newValues = this.getUniqueIdentityValues(node.change.new);
    const freed = new Map<string, string>();
    for (const [key, value] of oldValues) {
      if (newValues.get(key) !== value)
        freed.set(key, value);
    }
    return freed;
  }

  /** The subset of `node`'s new identity values (see [[getUniqueIdentityValues]]) that this replay is
   * about to claim, because `node` is an Insert, or an Update that changes the value to it.
   */
  private getClaimedIdentityValues(node: DependencyNode): Map<string, string> {
    if (node.change === undefined)
      return new Map();
    const oldValues = this.getUniqueIdentityValues(node.change.old);
    const newValues = this.getUniqueIdentityValues(node.change.new);
    const claimed = new Map<string, string>();
    for (const [key, value] of newValues) {
      if (oldValues.get(key) !== value)
        claimed.set(key, value);
    }
    return claimed;
  }

  private replayNode(node: DependencyNode): void {
    const isDelete = node.change === undefined || (node.change.new === undefined && node.change.old !== undefined);

    if (isDelete) {
      for (const dependent of node.dependents)
        this.replayNode(dependent);
    }

    if (node.change === undefined) {
      // Discovered live (section 6) - our Txn never captured a change for it, so nothing in `store.all()`
      // will ever apply or report it, yet replaying our own owner's delete cascades it away regardless.
      this.applyUpstreamDependentDelete(node);
    } else {
      const change = node.change;
      const isIndirect = change.new?.$meta.isIndirectChange === true || change.old?.$meta.isIndirectChange === true;
      if (isIndirect && !this.isCascadedDependentDelete(change)) {
        // Indirect changes are derived side effects (e.g. a Model's GeometryGuid updated as a side
        // effect of a GeometricElement change) rather than deliberate edits, so they are force-applied
        // without conflict detection, matching the automatic semantic-rebase path's `applyInstanceChange`.
        this._db.txns.withIndirectTxnMode(() => {
          this.applyDirectInstanceChange(change);
        });
      } else {
        this.applyInteractiveInstanceChange(change);
      }
    }

    if (!isDelete) {
      for (const dependent of node.dependents)
        this.replayNode(dependent);
    }
  }

  /** Reports (and then removes) a dependent discovered via [[discoverUpstreamDependents]] - an instance
   * our local Txn never touched that would otherwise be silently cascaded away by our owner's delete.
   */
  private applyUpstreamDependentDelete(node: DependencyNode): void {
    const theirs = this._theirsSnapshot.get(makeInstanceKey(node.id, node.classFullName));
    if (theirs === undefined) {
      // Already gone by the time we discovered it (e.g. a real ON DELETE CASCADE already removed an
      // aspect earlier in this same replay) - nothing to report or remove.
      return;
    }

    RebaseConflictImpl.recordUpstreamDependent(this, this._conflicts, theirs);
    this._db[_nativeDb].deleteInstance({ id: node.id, classFullName: node.classFullName }, { useJsNames: true });
  }

  /** Design doc section 10: populates `ownerConflict`/`dependentConflicts` for every pair of recorded
   * conflicts where one instance is the other's `ownerId`, once every conflict for this group is known.
   */
  private linkConflictOwnership(): void {
    for (const node of this._dependencyNodesById.values()) {
      if (node.ownerId === undefined)
        continue;
      const dependentConflict = this._conflicts.find((c) => c.id === node.id) as RebaseConflictImpl | undefined;
      const ownerConflict = this._conflicts.find((c) => c.id === node.ownerId) as RebaseConflictImpl | undefined;
      if (dependentConflict !== undefined && ownerConflict !== undefined) {
        dependentConflict.ownerConflict = ownerConflict;
        ownerConflict.dependentConflicts.push(dependentConflict);
      }
    }
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
    const theirs = this._theirsSnapshot.get(makeInstanceKey(oldProps.id, oldProps.classFullName));
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
    const theirs = this._theirsSnapshot.get(makeInstanceKey(oldProps.id, oldProps.classFullName));
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
   * A dependent's embedding owner is resurrected first if it doesn't currently exist (see
   * [[ensureOwnerExists]]), and - for a full resolution (`properties` unspecified/empty) - this
   * instance's own embedded dependents are cascaded afterward (deleted if `props` is undefined,
   * otherwise restored per the design doc section 10.1 - see [[cascadeDeleteToDependents]] and
   * [[restoreDependentClosure]]).
   *
   * @param fullReplace When true, properties absent from `props` are cleared instead of left as-is, so
   * that `props` fully replaces the instance rather than incrementally updating it.
   * @param side Which side of `conflict` is being applied - "ours" unless a caller resolves to "theirs".
   * Determines which side of an as-yet-unresolved owner or dependent conflict is restored alongside
   * this one.
   * @internal
   */
  public applyConflictResolution(conflict: RebaseConflict, props: RebaseConflictProperties | undefined, fullReplace: boolean = false, properties?: string[], side: "ours" | "theirs" = "ours"): void {
    const conflictImpl = conflict as RebaseConflictImpl;
    const isFullResolution = properties === undefined || properties.length === 0;

    if (props === undefined) {
      const key = { id: conflict.id, classFullName: conflict.classFullName };
      // Dependents must be removed before the owner itself - see [[replayNode]]'s comment on why a
      // child element's cascade cannot be left to the DB the way an aspect's real FK cascade can.
      if (isFullResolution)
        this.cascadeDeleteToDependents(conflictImpl);
      this._db[_nativeDb].deleteInstance(key, { useJsNames: true });
      conflictImpl.clearSupersededUniqueConstraintViolations(undefined);
      this._db.clearCaches();
      return;
    }

    if (isFullResolution)
      this.ensureOwnerExists(conflictImpl, side);

    conflictImpl.clearSupersededUniqueConstraintViolations(properties);
    this.writeConflictResolution(conflictImpl, props, fullReplace, 0);

    if (isFullResolution)
      this.restoreDependentClosure(conflictImpl, side);

    // TODO: too heavy-handed?
    this._db.clearCaches();
  }

  /**
   * A dependent's embedding owner is not necessarily restorable on its own (e.g. an untouched aspect
   * has no captured data of its own), so restoring a dependent must first ensure its owner chain
   * exists. Walks upward from `conflict`'s forest node (recursing into the owner's own owner first),
   * and for the first missing owner found:
   * - if it has its own recorded conflict, writes whichever of its `ours`/`theirs` matches `side` (the
   *   same side just chosen for the dependent that triggered this), via [[writeConflictResolution]] so
   *   any UNIQUE constraint the write provokes is handled the same way as any other resolution;
   * - otherwise, restores it verbatim from [[_theirsSnapshot]] - its pre-replay state, untouched by
   *   either side, which is the only data available for an owner neither side ever recorded a
   *   conflict for (design doc section 10.1's "closure" reasoning applied upward instead of down).
   *
   * Does not otherwise touch the resurrected owner's *other* dependents/siblings - out of scope here,
   * see [[restoreDependentClosure]] for the (downward) case that does.
   */
  private ensureOwnerExists(conflict: RebaseConflictImpl, side: "ours" | "theirs"): void {
    const node = this._dependencyNodesById.get(makeInstanceKey(conflict.id, conflict.classFullName));
    if (node?.ownerId === undefined)
      return;
    const ownerNode = this._ownersById.get(node.ownerId);
    if (ownerNode === undefined)
      return;
    if (this.tryReadCurrentInstance(ownerNode.id, ownerNode.classFullName) !== undefined)
      return;

    const ownerConflict = this._conflicts.find((c) => c.id === ownerNode.id) as RebaseConflictImpl | undefined;
    if (ownerConflict !== undefined)
      this.ensureOwnerExists(ownerConflict, side);

    const ownerProps = ownerConflict !== undefined
      ? this.serializeConflictSide(ownerNode.classFullName, side === "ours" ? ownerConflict.ours : ownerConflict.theirs)
      : this._theirsSnapshot.get(makeInstanceKey(ownerNode.id, ownerNode.classFullName));
    if (ownerProps === undefined)
      return;

    if (ownerConflict !== undefined) {
      ownerConflict._selectedSide ??= side;
      this.writeConflictResolution(ownerConflict, ownerProps, true, 0);
    } else {
      this.writeRestoredInstance(ownerProps);
    }
  }

  /** Design doc section 10: resolving an owner conflict to "deleted" cascades that same resolution to
   * every member of its closure, recursively, automatically and silently - a dependent cannot survive
   * its owner's deletion.
   */
  private cascadeDeleteToDependents(conflict: RebaseConflictImpl): void {
    const node = this._dependencyNodesById.get(makeInstanceKey(conflict.id, conflict.classFullName));
    if (node === undefined)
      return;
    for (const dependent of node.dependents)
      this.cascadeDeleteDependentNode(dependent);
  }

  private cascadeDeleteDependentNode(node: DependencyNode): void {
    for (const child of node.dependents)
      this.cascadeDeleteDependentNode(child);
    this._db[_nativeDb].deleteInstance({ id: node.id, classFullName: node.classFullName }, { useJsNames: true });
    const conflict = this._conflicts.find((c) => c.id === node.id) as RebaseConflictImpl | undefined;
    conflict?.clearSupersededUniqueConstraintViolations(undefined);
  }

  /**
   * Design doc section 10.1: resolving an owner conflict to "restored" restores its whole closure, not
   * just the owner itself, because a cascade removes dependents whether or not they conflicted:
   * - a dependent with its own recorded conflict restores whichever side it currently has selected
   *   (`_selectedSide`, set only by an explicit, direct `acceptOurs`/`acceptTheirs` call on that
   *   dependent) so an explicit user choice is preserved, falling back to `side` - the side just chosen
   *   for `conflict` - otherwise;
   * - a dependent with no recorded conflict restores verbatim from [[_theirsSnapshot]], its pre-replay
   *   state, unmodified by either side.
   */
  private restoreDependentClosure(conflict: RebaseConflictImpl, side: "ours" | "theirs"): void {
    const node = this._dependencyNodesById.get(makeInstanceKey(conflict.id, conflict.classFullName));
    if (node === undefined)
      return;
    for (const dependent of node.dependents)
      this.restoreClosureNode(dependent, side);
  }

  private restoreClosureNode(node: DependencyNode, inheritedSide: "ours" | "theirs"): void {
    const conflict = this._conflicts.find((c) => c.id === node.id) as RebaseConflictImpl | undefined;
    const side = conflict?._selectedSide ?? inheritedSide;
    const props = conflict !== undefined
      ? this.serializeConflictSide(node.classFullName, side === "ours" ? conflict.ours : conflict.theirs)
      : this._theirsSnapshot.get(makeInstanceKey(node.id, node.classFullName));

    if (props === undefined) {
      this._db[_nativeDb].deleteInstance({ id: node.id, classFullName: node.classFullName }, { useJsNames: true });
    } else if (conflict !== undefined) {
      conflict.clearSupersededUniqueConstraintViolations(undefined);
      this.writeConflictResolution(conflict, props, true, 0);
    } else {
      this.writeRestoredInstance(props);
    }

    for (const child of node.dependents)
      this.restoreClosureNode(child, side);
  }

  /** Writes an instance with no [[RebaseConflict]] of its own (an untouched dependent being restored
   * from [[_theirsSnapshot]] as part of its owner's closure), without the UNIQUE-constraint retry
   * machinery [[writeConflictResolution]] provides for a real conflict.
   */
  private writeRestoredInstance(props: RebaseConflictProperties): void {
    try {
      this._db[_nativeDb].updateInstance(props, { useJsNames: true });
    } catch (err: any) {
      if (err.errorNumber !== DbResult.BE_SQLITE_NOTFOUND)
        throw err;
      this._db[_nativeDb].insertInstance(props, { forceUseId: true, useJsNames: true });
    }
  }

  /** `conflict.ours`/`conflict.theirs` are deserialized into the public [[RebaseConflictProperties]]
   * shape (e.g. a nested `code: { value, spec, scope }`) for consumers, not the raw/native shape
   * `writeConflictResolution`/`writeRestoredInstance` need to write - mirrors the `classDef.serialize`
   * step [[applyResolution]] performs for a top-level `acceptOurs`/`acceptTheirs` call. Props already
   * sourced from [[_theirsSnapshot]] (a live native read) are already in the raw shape and must not be
   * passed through this again.
   */
  private serializeConflictSide(classFullName: string, props: RebaseConflictProperties | undefined): RebaseConflictProperties | undefined {
    if (props === undefined)
      return undefined;
    const classDef = this.iModel.getJsClass<typeof Element>(classFullName);
    return classDef.serialize(props as ElementProps, this.iModel);
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
  side: "ours" | "theirs",
  properties?: string[]
): void {
  const source = side === "ours" ? conflict.ours : conflict.theirs;
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

  rebase.applyConflictResolution(conflict, updateProps, fullReplace, properties, side);
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
  public ownerConflict: RebaseConflict | undefined = undefined;
  public readonly dependentConflicts: RebaseConflict[] = [];

  /** Which side this conflict was last explicitly (directly) resolved to, or undefined if it never has
   * been. Set only by a direct, full (no `properties` filter) `acceptOurs`/`acceptTheirs` call on this
   * conflict itself - not by a cascade propagating a resolution down from an owner - so that an explicit
   * user choice for a dependent survives a later resolution of its owner (design doc section 10.1).
   * @internal
   */
  public _selectedSide: "ours" | "theirs" | undefined = undefined;

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

  /** An embedded dependent (aspect or child element) that our local Txn never touched, discovered live
   * (design doc section 6) only because its owner is about to be deleted - without this, our own
   * cascade would silently discard it with nothing reported. Has no `original` or `ours`: our Txn has
   * no knowledge of it at all, only `theirs`.
   */
  public static recordUpstreamDependent(rebase: InteractiveRebase, conflicts: RebaseConflict[], theirs: RebaseConflictProperties): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(theirs.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, theirs.id, theirs.classFullName);
    conflict.theirs = classDef.deserialize({ row: theirs, iModel: rebase.iModel });
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
    if (properties === undefined || properties.length === 0)
      this._selectedSide = "ours";
    applyResolution(this._rebase, this, "ours", properties);
  }

  public acceptTheirs(properties?: string[]): void {
    if (properties === undefined || properties.length === 0)
      this._selectedSide = "theirs";
    applyResolution(this._rebase, this, "theirs", properties);
  }
}
