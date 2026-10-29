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
import { ECJsNames, IModelError, QueryBinder, RelatedElementProps, TxnProps } from "@itwin/core-common";
import { SchemaView, SchemaViewPrimitiveType, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";
import { _activeTxn, _nativeDb } from "./internal/Symbols";
import { BriefcaseManager } from "./BriefcaseManager";
import { RebaseIdentityValue, RebaseInstanceChange, RebaseInstanceOperation, RebaseInstanceStore, RebaseNavigationRef, RebaseOwnerKind } from "./internal/RebaseInstanceStore";
import { Element } from "./Element";
import { ChangesetReader } from "./ChangesetReader";
import { TxnIdString } from "./TxnManager";

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
  instanceKey: string;

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
   * because it was deleted or because it never existed. {@link acceptTheirs} does not restore or delete
   * an instance when one side has no instance.
   */
  theirs: RebaseConflictProperties | undefined;

  /**
   * The instance after applying our local changes. This is the state of the instance that we are
   * trying to apply to the database.
   *
   * This property will be undefined if our change deleted the instance. {@link acceptOurs} does not
   * restore or delete an instance when one side has no instance.
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

  /** Unexpected referential actions currently applied by deleting this instance. */
  deletionEffects: ReadonlyArray<DeletionEffect>;

  /** @deprecated Owner conflict linking has been removed. Always empty; retained until the test refactoring is complete. */
  ownerConflicts: ReadonlyArray<RebaseConflict>;

  /** @deprecated Dependent conflict linking has been removed. Always empty; retained until the test refactoring is complete. */
  dependentConflicts: ReadonlyArray<RebaseConflict>;

  // TODO: I think we need an explicit property indicating whether "ours" was applied (with caveats
  // described in uniqueConstraintViolations and brokenRelationships), or whether it couldn't be
  // applied at all (for instance, it's an insert with a non-nullable, broken navigation property).
  // Can also indicate whether acceptOurs or acceptTheirs was last called.

  /**
   * Accepts the local (our) values of the properties that conflict, without restoring or deleting the instance.
   * @param properties A subset of {@link conflictingProperties} (or {@link differentProperties} for an insert).
   * If omitted or empty, all of those properties are accepted. Other properties are ignored.
   */
  acceptOurs(properties?: string[]): void;

  /**
   * Accepts the upstream (their) values of the properties that conflict, without restoring or deleting the instance.
   * @param properties A subset of {@link conflictingProperties} (or {@link differentProperties} for an insert).
   * If omitted or empty, all of those properties are accepted. Other properties are ignored.
   */
  acceptTheirs(properties?: string[]): void;

  /**
   * Resolves a broken relationship by supplying a new value for the navigation property.
   *
   * If this entity already exists in the iModel, its navigation property will be updated with the
   * supplied new value. If the update succeeds, the [[BrokenRelationship]]'s
   * [[BrokenRelationship.appliedValue]] will be set to the new value and
   * [[BrokenRelationship.stagedValue]] will be set to undefined. If it fails, the
   * [[BrokenRelationship.appliedValue]] will be set to the current value in the iModel, and
   * [[BrokenRelationship.stagedValue]] will be set to the new value.
   *
   * If this entity does not exist in the iModel, i.e., because it couldn't be inserted due to a
   * broken non-nullable navigation property, then the insert will be attempted again with the
   * newly-supplied navigation property value. If the insert succeeds, [BrokenRelationship.appliedValue]]
   * will be set to the new value and [BrokenRelationship.stagedValue]] will be set to undefined.
   * If it fails, whether because the supplied navigation property value is invalid, because some
   * _other_ non-nullable navigation property is also broken, or for any other reason, then
   * the [[BrokenRelationship.stagedValue]] will be set to the new value, and
   * [[BrokenRelationship.appliedValue]] will be set to undefined.
   *
   * You can call this method multiple times to fix multiple broken navigation properties.
   *
   * @param brokenRelationship The broken relationship to resolve. The relationship can be specified either
   * as an entry in [[brokenRelationships]] or as the access string for the navigation property, e.g., `"model"`.
   * @param value The new value to assign to the navigation property.
   */
  resolveBrokenRelationship(brokenRelationship: BrokenRelationship | string, value: Id64String): void;
}

/**
 * The properties involved in a rebase conflict, in the same form as the [EntityProps]($common) produced by
 * [Entity.deserialize]($backend). Properties are therefore identified by access strings like `code.value`,
 * not by the names under which they are stored (`codeValue`).
 */
export interface RebaseConflictProperties {
  [propertyName: string]: any;
}

/** A referential action on another instance caused by a conflicting deletion, with the data
 * needed to reverse the action in EntityProps form.
 * @beta
 */
export type DeletionEffect = DeletionEffectDetails & (
  | {
    readonly action: "set-null";
    /** The referenced entity's id before the navigation property was cleared. */
    readonly previousValue: Id64String;
  }
  | {
    readonly action: "cascade";
    /** The entity removed by the referential action. */
    readonly deletedInstance: RebaseConflictProperties;
  }
);

/** The entity and relationship affected by a conflicting deletion.
 * @beta
 */
export interface DeletionEffectDetails {
  readonly relationshipClass: SchemaView.RelationshipClass;
  /** Access string on the affected entity, in EntityProps form, e.g. `typeDefinition`. */
  readonly navigationProperty: string;
  readonly affectedInstanceKey: string;
  readonly affectedId: Id64String;
  readonly affectedClassFullName: string;
  /** A genuine conflict on the affected entity, if one was independently detected. */
  readonly affectedConflict: RebaseConflict | undefined;
}

/** A substitution automatically applied so a conflicting change can be written. */
export interface AppliedFix {
  /** The property whose value was substituted, as an access string into the affected instance. */
  property: string;
  /** The value assigned to {@link property} in place of the conflicting value. */
  value: any;
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
  appliedFix?: AppliedFix;
}

/**
 * The details of a relationship that is broken due to a rebase conflict.
 *
 * An instance of this interface is created and added to [[RebaseConflict.brokenRelationships]] when the
 * value that [[InteractiveRebase]] is attempting to set for a particular navigation property is not valid.
 * Usually this happens because the target of the navigation property has been deleted from the iModel.
 *
 * Despite the broken relationship, [[InteractiveRebase]] will make a best-effort attempt to apply the
 * change anyway, without violating any database constraints, by using a different value for the navigation
 * property. The [[appliedValue]] property records the value that was used.
 */
export interface BrokenRelationship {
  /**
   * The class of the relationship that is broken.
   */
  relationshipClass: SchemaView.RelationshipClass;

  /**
   * The navigation property on the instance that is broken, as an access string into {@link ours}, e.g., `parent`.
   */
  navigationProperty: string;

  /**
   * The value that was applied to the broken navigation property so that the change could be applied.
   *
   * If the entity already exists in the iModel, this will simply by the entity's pre-existing value for
   * the navigation property.
   *
   * If the entity doesn't exist yet in the iModel (i.e., this change is an INSERT), and the navigation property
   * is nullable, then this will be set to `null`.
   *
   * If the property is not nullable, then this will be undefined, indicating that this broken relationship
   * prevented the change from being applied at all. Use [[RebaseConflict.resolveBrokenRelationship]] to supply
   * a new value for the navigation property and reattempt to apply the change.
   *
   * After a successful call to [[RebaseConflict.resolveBrokenRelationship]], this property will reflect the
   * newly-applied value. If the call was not successful, this property will remain unchanged, and the
   * supplied value will be stored in [[stagedValue]] instead.
   */
  appliedValue?: any;

  /**
   * The value for this navigation property that was supplied to [[RebaseConflict.resolveBrokenRelationship]]
   * but that has not yet become the [[appliedValue]]. A value will be staged and not applied if it is invalid
   * (i.e., it violates a database constraint) or if it is valid but the entity cannot be created in the iModel
   * yet due to _other_ broken relationships.
   */
  stagedValue?: any;
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

interface BrokenRelationshipDetail extends BrokenRelationship {
  jsName: string;
  nullable: boolean;
}

export interface TxnRebaseGroup {
  txns: TxnProps[];
}

const MAX_UNIQUE_CONSTRAINT_FIX_ATTEMPTS = 10;

/** A deferred write that [[breakCycle]] substitutes with a placeholder value and corrects later via
 * [[applyDeferredCorrections]] when breaking a self-contained ordering cycle.
 */
interface DeferredWrite {
  accessString: string;
  placeholderKind: "guid" | "string" | "navigation";
  realValue: any;
}

/** An edge in the per-Txn dependency graph built by [[orderNodes]], representing a constraint between
 * two nodes that determines replay order.
 */
interface ReplayEdge {
  from: DependencyNode;
  to: DependencyNode;
  /** Present only when this edge can be broken by deferring a specific write on `to` - see
   * [[breakCycle]]. Absent for an edge whose `to` is a Delete (nothing on a delete to defer), or a
   * non-nullable navigation-property requirement.
   */
  deferrable?: DeferredWrite;
}

/** A node in the per-Txn dependency graph built by [[InteractiveRebase.buildDependencyForest]].
 * Carries only lightweight metadata (never the potentially large `old`/`new` snapshots) - see
 * [[InteractiveRebase.getChange]] for loading a captured node's change on demand.
 */
interface DependencyNode {
  instanceKey: string;
  id: Id64String;
  classFullName: string;
  /** The operation its captured change represents. */
  operation: RebaseInstanceOperation;
  /** The kind of embedding owner this instance can itself be, if any. */
  ownerKind: RebaseOwnerKind | undefined;
  /** This node's schema-declared UNIQUE-constraint values and navigation-property references, extracted
   * at capture time by [[RebaseInstanceStore.set]] - consumed directly by [[orderNodes]], which never
   * needs to load this node's `old`/`new` snapshot (see [[getChange]]) just to compute its own edges. */
  identityValues?: RebaseIdentityValue[];
  navigationRefs?: RebaseNavigationRef[];
}

interface OnDeleteReference {
  referencingClassFullName: string;
  navigationProperty: string;
  navigationPropertyJsName: string;
  relationshipClass: SchemaView.RelationshipClass;
  action: "CASCADE" | "SET NULL";
}

interface AffectedOnDeleteInstance {
  instanceKey: string;
  id: Id64String;
  classFullName: string;
  theirs: RebaseConflictProperties;
  reference: OnDeleteReference;
}

export class InteractiveRebase {
  private _db: BriefcaseDb;
  private _schemaView: SchemaView;
  private _editTxn: EditTxn | undefined;
  private _txns: TxnProps[];
  private _groups: TxnRebaseGroup[];
  private _currentGroupIndex: number = -1;
  private _conflicts: RebaseConflict[] = [];

  /** The store backing the current group's replay. Disposed when moving to a new group's store, or when
   * this `InteractiveRebase` itself is disposed.
   */
  private _store: RebaseInstanceStore | undefined;

  /** Every directly captured node of the current group's dependency forest, keyed by `instanceKey`. */
  private _dependencyNodesByInstanceKey = new Map<string, DependencyNode>();

  /** Captured nodes that reference each provider through a navigation property, keyed by provider instance key. */
  private _referenceDependents = new Map<string, DependencyNode[]>();

  /** Schema-declared CASCADE/SET NULL navigation properties indexed by each concrete target class. */
  private _onDeleteReferencesByTargetClass = new Map<string, OnDeleteReference[]>();

  /** A placeholder value [[orderNodes]] is substituting in for a node's real value of one of its own
   * properties, keyed by `instanceKey` - see the design doc's cycle-breaking section. Consulted by
   * [[getChange]] so that the substitution is transparent to the rest of replay, and drained by
   * [[applyDeferredCorrections]] once the whole forest has been replayed.
   */
  private _pendingSubstitutions = new Map<string, { accessString: string, placeholderValue: any }[]>();

  /** The real values [[orderNodes]] deferred while breaking a self-contained ordering cycle, to be
   * applied for real by [[applyDeferredCorrections]] after the whole forest has been replayed.
   */
  private _deferredCorrections: { node: DependencyNode, accessString: string, realValue: any }[] = [];

  constructor(db: BriefcaseDb, txns: TxnProps[], schemaView: SchemaView) {
    this._db = db;
    this._schemaView = schemaView;
    this._txns = [];
    this._groups = [];
    this.buildOnDeleteReferenceIndex();
    this.initializeTxns(txns);
  }

  /** Builds a reusable reverse index for the small set of FK navigation properties that have
   * non-blocking ON DELETE actions. SchemaView supplies EC navigation/constraint metadata; one
   * ECDbMeta query supplies the excluded ECDbMap:ForeignKeyConstraint custom attributes. */
  private buildOnDeleteReferenceIndex(): void {
    const actionByPropertyId = new Map<string, string>();
    this._db.withQueryReader(
      `SELECT p.ECInstanceId, ca.Instance
       FROM meta.PropertyCustomAttribute ca
       JOIN meta.ECPropertyDef p ON ca.Property.Id = p.ECInstanceId
       JOIN meta.ECClassDef caClass ON ca.CustomAttributeClass.Id = caClass.ECInstanceId
       WHERE caClass.Name = 'ForeignKeyConstraint'`,
      (reader) => {
        for (const row of reader) {
          const customAttribute = JSON.parse(row[1] as string).ForeignKeyConstraint;
          const action = typeof customAttribute?.OnDeleteAction === "string"
            ? customAttribute.OnDeleteAction.toUpperCase().replace(/[^A-Z]/g, "")
            : "";
          actionByPropertyId.set(String(Id64.getLocalId(row[0] as Id64String)), action);
        }
      },
    );

    if (actionByPropertyId.size === 0)
      return;

    const classes = [...this._schemaView.getSchemas()].flatMap((schema) => [...schema.getClasses()]);
    for (const schemaClass of classes) {
      for (const property of schemaClass.getOwnProperties()) {
        if (!property.isNavigation())
          continue;
        const configuredAction = actionByPropertyId.get(String(property.ecInstanceId));
        if (configuredAction === undefined)
          continue;

        const relationship = property.relationshipClass;
        const action: OnDeleteReference["action"] | undefined = configuredAction === "CASCADE"
          ? "CASCADE"
          : configuredAction === "SETNULL"
            ? "SET NULL"
            : configuredAction.length === 0 && relationship.strength === StrengthType.Embedding
              ? "CASCADE"
              : configuredAction.length === 0
                ? "SET NULL"
                : undefined;
        if (action === undefined)
          continue;
        const constraint = property.direction === StrengthDirection.Backward ? relationship.source : relationship.target;
        if (constraint === undefined)
          continue;
        const constraintClasses = [
          ...(constraint.abstractConstraint === undefined ? [] : [constraint.abstractConstraint]),
          ...constraint.constraintClasses,
        ];
        for (const targetClass of classes) {
          if (!constraintClasses.some((constraintClass) => targetClass.fullName === constraintClass.fullName || (constraint.polymorphic && targetClass.is(constraintClass))))
            continue;

          let references = this._onDeleteReferencesByTargetClass.get(targetClass.fullName);
          if (references === undefined)
            this._onDeleteReferencesByTargetClass.set(targetClass.fullName, references = []);
          references.push({
            referencingClassFullName: schemaClass.fullName,
            navigationProperty: property.name,
            navigationPropertyJsName: ECJsNames.toJsName(property.name),
            relationshipClass: relationship,
            action,
          });
        }
      }
    }
  }

  /** @internal */
  public initializeTxns(txns: TxnProps[]): void {
    this._txns = txns;
    this._groups = txns.map(txn => ({ txns: [txn] }));
  }

  /** Called by native before reversing each local data Txn to capture the instance changes for replay. @internal */
  public onBeforeReverseLocalTxn(id: TxnIdString): void {
    if (BriefcaseManager.semanticRebaseDataFolderExists(this._db, id))
      return;

    // Do not use strict mode. A later schema Txn can add columns that remain present while an earlier
    // data Txn is captured, so its stored changeset can legitimately have fewer columns than the table.
    using reader = ChangesetReader.openTxn({
      db: this._db,
      txnId: id,
      rowOptions: {
        useJsNames: true,
        abbreviateBlobs: false,
        includeNulls: true,
        useClassFullNameInsteadofClassName: true,
      },
    });

    const dbPath = BriefcaseManager.createAndGetTxnChangedInstancePath(this._db, id);
    using store = RebaseInstanceStore.createNew(dbPath, this._db, this._schemaView);
    while (reader.step())
      store.appendChange(reader);
  }

  public [Symbol.dispose](): void {
    if (this._editTxn) {
      this._editTxn.end("abandon");
    }
    this._store?.[Symbol.dispose]();
    this._store = undefined;
  }

  /**
   * Commits the current group's [[EditTxn]] by folding its changes back into the local Txn being
   * rebased, using the same native primitive ([[TxnManager.resume]]/`resumeSemantic`) the
   * non-interactive rebase paths use. A plain `EditTxn.end("save")` is rejected by native code
   * ("Saving changes are not allowed when rebasing local changes") because a native pull-merge rebase
   * is in progress for the whole lifetime of this `InteractiveRebase`, not just while replay is running.
   */
  private commitEditTxn(): void {
    assert(this._editTxn !== undefined && this._editTxn.isActive, "commitEditTxn requires an active EditTxn");
    this._db[_nativeDb].pullMergeRebaseUpdateTxn();
    this._db[_activeTxn] = undefined;
    this._editTxn = undefined;
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

  /** @internal */
  /** Gets conflicts for captured nodes that reference the supplied provider through a navigation property. */
  public getReferenceDependentConflicts(providerInstanceKey: string): RebaseConflict[] {
    const dependents = this._referenceDependents.get(providerInstanceKey) ?? [];
    return dependents
      .map((node) => this._conflicts.find((conflict) => conflict.instanceKey === node.instanceKey))
      .filter((conflict): conflict is RebaseConflict => conflict !== undefined);
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
   * @returns True if a group was found and reinstated. False once every group has already been
   * processed, meaning the rebase process is now complete - see {@link isComplete}.
   */
  public nextGroup(): boolean {
    if (this._currentGroupIndex >= this._groups.length) {
      InteractiveRebaseError.throwError("already-past-last-group", "The rebase process has already moved past the last group");
    }

    if (this._editTxn) {
      this.commitEditTxn();
    }

    this._editTxn = new EditTxn(this._db, "Interactive Rebase");
    this._editTxn.start();

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

    return true;
  }

  /**
   * Abandon all conflict resolutions and edits in the current Txn group and move back to the previous one,
   * reverting the previous group's committed changes and redoing its replay from scratch.
   */
  public previousGroup(): void {
    if (this._currentGroupIndex < 0) {
      InteractiveRebaseError.throwError("already-past-first-group", "The rebase process has already moved past the first group");
    }

    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }

    --this._currentGroupIndex;
    const group = this.currentGroup;
    if (group === undefined) {
      return;
    }

    // Reverses the previous group's already-committed Txn at the native/row level (see
    // TxnManager::PullMergeRebasePrevious) instead of trying to reconstruct its conflicts from anything
    // kept in memory - a large changeset makes an in-memory record of every group's conflicts unaffordable.
    const nativeDb = this._db[_nativeDb];
    const txnId = nativeDb.pullMergeRebasePrevious();
    assert(txnId === group.txns[0].id, "Unexpected txn id");

    this._editTxn = new EditTxn(this._db, "Interactive Rebase");
    this._editTxn.start();

    this._conflicts = [];
    this.reinstateDataTxn(group.txns[0]);
  }

  /**
   * Abandon all edits in the current Txn group and restart the group's rebase process from the beginning.
   */
  public restartGroup(): void {
    if (this.currentGroup === undefined) {
      if (this._currentGroupIndex >= this.groups.length)
        InteractiveRebaseError.throwError("already-past-last-group", "There is no current group to restart because the rebase process has already moved past the last group");
      else
        InteractiveRebaseError.throwError("already-past-first-group", "There is no current group to restart because the rebase process has not yet begun the first group");
    }

    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }

    this._editTxn = new EditTxn(this._db, "Interactive Rebase");
    this._editTxn.start();

    this._conflicts = [];
    this.reinstateDataTxn(this.currentGroup.txns[0]);
  }

  /**
   * Completely abandons the current rebase process and restarts it from the beginning.
   * After this call, the [[currentGroup]] will be undefined because the cursor will be before the
   * first group. Call [[nextGroup]] to begin rebasing the first group.
   */
  public restartAll(): void {
    if (this._editTxn) {
      this._editTxn.end("abandon");
      this._editTxn = undefined;
    }

    const nativeDb = this._db[_nativeDb];
    while (this._currentGroupIndex >= 0) {
      nativeDb.pullMergeRebasePrevious();
      --this._currentGroupIndex;
    }
    this._currentGroupIndex = -1;
  }

  /**
   * Applies the given Data txn's previously-captured instance changes (see [[RebaseInstanceStore]]),
   * detecting and recording conflicts by comparing the captured "old" (pre-local-change) baseline
   * against the current row (which already reflects the incoming "their" changes) instead of relying
   * on the native changeset-apply conflict callback.
   *
   * Replay is ordered by [[orderNodes]]'s topological sort over the directly captured changes.
   */
  private reinstateDataTxn(txnProps: TxnProps): void {
    if (!BriefcaseManager.semanticRebaseDataFolderExists(this._db, txnProps.id)) {
      throw new IModelError(IModelStatus.BadRequest, `Local folder does not exist for transaction ${txnProps.id}`);
    }

    this._store?.[Symbol.dispose]();
    const dbPath = BriefcaseManager.createAndGetTxnChangedInstancePath(this._db, txnProps.id);
    this._store = RebaseInstanceStore.openForReplay(dbPath);
    this.buildDependencyForest(this._store);
    this.replayNodes();
    this.applyDeferredCorrections();
    this._db.clearCaches({ instanceCachesOnly: true });
  }

  /** Loads a node's change from the [[RebaseInstanceStore]].
   *
   * If [[orderNodes]] deferred one of `node`'s own properties as part of breaking a self-contained
   * ordering cycle (see [[_pendingSubstitutions]]), the returned change's `new` side carries the
   * placeholder value in place of the real one - transparently, so every other caller (including replay
   * itself) just sees the value it's supposed to write right now. [[applyDeferredCorrections]] writes the
   * real value once the whole forest has been replayed.
   */
  private getChange(node: DependencyNode): RebaseInstanceChange {
    assert(this._store !== undefined, "getChange requires an active replay (see reinstateDataTxn)");
    const change = this._store.get(node.instanceKey);
    assert(change !== undefined, "a captured node must have a row in the store");

    const substitutions = this._pendingSubstitutions.get(node.instanceKey);
    if (substitutions === undefined || change.new === undefined)
      return change;

    const substitutedNew = { ...change.new };
    for (const { accessString, placeholderValue } of substitutions)
      setPropertyValue(substitutedNew, accessString, placeholderValue);
    return { ...change, new: substitutedNew };
  }

  /** Builds the current group's dependency graph from directly captured changes. Indirect changes are
   * shared with the automatic semantic-rebase path, so they are excluded here rather than at capture time.
   */
  private buildDependencyForest(store: RebaseInstanceStore): void {
    this._store = store;
    this._dependencyNodesByInstanceKey.clear();
    for (const meta of store.allMetadata()) {
      if (meta.isIndirect)
        continue;
      const node: DependencyNode = {
        instanceKey: meta.instanceKey,
        id: meta.id,
        classFullName: meta.classFullName,
        operation: meta.operation,
        ownerKind: meta.ownerKind,
        identityValues: meta.identityValues,
        navigationRefs: meta.navigationRefs,
      };
      this._dependencyNodesByInstanceKey.set(node.instanceKey, node);
    }
  }

  /** Replays the directly captured changes in the order [[orderNodes]] computes. */
  private replayNodes(): void {
    for (const node of this.orderNodes([...this._dependencyNodesByInstanceKey.values()]))
      this.applyNode(node);
  }

  /**
   * Orders every node of the current group's dependency forest (see [[buildDependencyForest]]) for replay by
   * a topological sort over three kinds of real dependency edges between them - there is no other
   * justification for preferring one node's replay order over another's, so nodes with no edges between
   * them keep their original (stable) input order. Every edge is built directly from each node's own
   * lightweight fields (identity values and `navigationRefs`) - all extracted once at capture
   * time by [[RebaseInstanceStore.set]] - so this never needs [[getChange]] to load a node's `old`/`new`
   * snapshot, nor any schema/[[SchemaView]] lookup, just to compute its edges:
   *
   * - An identity-value edge: any node that frees up a `federationGuid` or `code` (by deleting the
   *   instance, or updating it away) must be replayed before any other node that claims that same value
   *   (by inserting it, or updating into it), or the claim would collide with the not-yet-removed row.
   * - A navigation-property existence edge: any node that starts existing as a result of this replay (an
   *   Insert) must be replayed before any other node whose write references it by a navigation property
   *   (Parent, TypeDefinition, an aspect's owning Element property, etc. - the same navigation-property
   *   enumeration [[findBrokenRelationships]] uses, extracted per instance into `navigationRefs` by
   *   [[RebaseInstanceStore.set]]), and any node that stops referencing a value (an Update that changes a
   *   navigation property away, or a Delete) must be replayed before any other node whose write removes
   *   that value (a Delete), or the reference/removal would hit a FOREIGNKEY violation against a row
   *   that (respectively) doesn't exist yet, or still has something pointing at it. This is also what
   *   gives owner/dependent pairs their correct relative order for free - an owning navigation property
   *   (Element.Parent, an aspect's Element property, etc.) is an ordinary FK-backed navigation property
   *   like any other, so a captured dependent's edge to/from its owner falls out of this same scan with
   *   no extra logic. Relationship (link-table) instances need no special-casing here - BIS deliberately
   *   gives them no real foreign key into `bis_Element`, so [[RebaseInstanceStore.set]] never populates
   *   their `navigationRefs` in the first place.
   * Every schema-declared UNIQUE constraint (single-property or composite, declared on the class itself
   * or any base class) is discovered and extracted at capture time - see
   * [[RebaseInstanceStore.getIdentityGroups]] - so this is not limited to `federationGuid`/`code` the way
   * it once was; only a custom schema's own UNIQUE index that isn't declared through the standard
   * `ECDbMap:PropertyMap`/`ECDbMap:DbIndexList` custom attributes could still escape this and surface
   * instead as a (harmlessly auto-fixed) UNIQUE constraint violation - see [[fixUniqueConstraintViolation]].
   *
   * When Kahn's algorithm stalls, the stalled nodes form a *self-contained* cycle - by construction,
   * every edge among them is satisfied by another stalled node, never by anything external to this
   * batch - so it's always safe to break automatically, with no reported conflict: [[breakCycle]] defers
   * one stalled node's specific claimed/required property (writing a safe placeholder now instead),
   * which [[applyDeferredCorrections]] corrects to the real value once the whole forest has been
   * replayed. A navigation property can only be deferred this way if it's nullable; if breaking the
   * cycle would require deferring a non-nullable one, that edge is simply left unresolved and the write
   * proceeds anyway, falling through to the existing (already safe) FOREIGNKEY-conflict path - a cycle
   * of non-nullable references could never have been created in the first place, so this is not a bug to
   * chase.
   */
  private orderNodes(nodes: DependencyNode[]): DependencyNode[] {
    this._pendingSubstitutions = new Map();
    this._deferredCorrections = [];
    this._referenceDependents = new Map();

    const inputIndex = new Map<DependencyNode, number>(nodes.map((node, i) => [node, i]));

    const edges: ReplayEdge[] = [];

    // "group key|value" -> every node that frees/claims it, computed directly from each node's own
    // capture-time-extracted `identityValues` (no store access needed). `identityValues` already carries
    // which single property to defer (and with what kind of placeholder) if this group participates in a
    // cycle - see [[RebaseInstanceStore.buildIdentityConstraintGroup]].
    type IdentityEntry = { node: DependencyNode, identity: RebaseIdentityValue };
    const freedByValue = new Map<string, IdentityEntry[]>();
    const claimedByValue = new Map<string, IdentityEntry[]>();
    const addIdentityValue = (map: Map<string, IdentityEntry[]>, identityKey: string, node: DependencyNode, identity: RebaseIdentityValue): void => {
      const entries = map.get(identityKey);
      if (entries === undefined)
        map.set(identityKey, [{ node, identity }]);
      else
        entries.push({ node, identity });
    };
    for (const node of nodes) {
      if (node.identityValues === undefined)
        continue;
      for (const identity of node.identityValues) {
        if (identity.old === identity.new)
          continue;
        if (identity.old !== undefined)
          addIdentityValue(freedByValue, `${identity.key}|${identity.old}`, node, identity);
        if (identity.new !== undefined)
          addIdentityValue(claimedByValue, `${identity.key}|${identity.new}`, node, identity);
      }
    }
    for (const [valueKey, freerEntries] of freedByValue) {
      const claimerEntries = claimedByValue.get(valueKey);
      if (claimerEntries === undefined)
        continue;
      for (const { node: freer } of freerEntries) {
        for (const { node: claimer, identity } of claimerEntries) {
          if (claimer === freer)
            continue;
          // The claimer's own entry for this group - not the freer's, or any other node's - since it's
          // specifically the claimer's write that would need its real value deferred if this edge is
          // part of a cycle (see [[breakCycle]]).
          edges.push({
            from: freer, to: claimer,
            deferrable: { accessString: identity.accessString, placeholderKind: identity.placeholderKind, realValue: identity.new },
          });
        }
      }
    }

    // Navigation-property existence edges: an Insert "provides" its own id, a Delete "removes" its own
    // id, and each captured node's `navigationRefs` "require" (`newId`) or "free" (`oldId`, no longer
    // `newId`) whatever ids they reference - but only ids that belong to another node in this same batch
    // (an id already existing untouched, or belonging to something outside this batch, needs no edge -
    // ordering can't help or hurt it).
    // NOTE: These maps are keyed by ECInstanceId, which a Model shares with its modeled Element (and arbitrary
    // element IDs may collide with arbitrary aspect IDs), so a reference only matches the nodes of the kind its
    // relationship constraint names, when it names one.
    const providesById = new Map<Id64String, DependencyNode[]>();
    const removesById = new Map<Id64String, DependencyNode[]>();
    for (const node of nodes) {
      const map = node.operation === "Insert" ? providesById : node.operation === "Delete" ? removesById : undefined;
      if (map === undefined)
        continue;
      const entries = map.get(node.id);
      if (entries === undefined)
        map.set(node.id, [node]);
      else
        entries.push(node);
    }
    const findReferenced = (map: Map<Id64String, DependencyNode[]>, id: Id64String, targetKind: RebaseOwnerKind | undefined): DependencyNode[] =>
      (map.get(id) ?? []).filter((candidate) => targetKind === undefined || candidate.ownerKind === targetKind);

    for (const node of nodes) {
      if (node.navigationRefs === undefined)
        continue;
      for (const { jsName, nullable, targetKind, oldId, newId } of node.navigationRefs) {
        if (newId !== undefined) {
          for (const provider of findReferenced(providesById, newId, targetKind)) {
            if (provider === node)
              continue;
            edges.push({
              from: provider, to: node,
              deferrable: nullable ? { accessString: jsName, placeholderKind: "navigation", realValue: newId } : undefined,
            });
            let dependents = this._referenceDependents.get(provider.instanceKey);
            if (dependents === undefined)
              this._referenceDependents.set(provider.instanceKey, dependents = []);
            if (!dependents.includes(node))
              dependents.push(node);
          }
        }
        if (oldId !== undefined && oldId !== newId) {
          for (const remover of findReferenced(removesById, oldId, targetKind)) {
            if (remover !== node)
              edges.push({ from: node, to: remover }); // Nothing to defer - a Delete has no property to null.
          }
        }
      }
    }

    // Kahn's algorithm, breaking ties (including nodes with no edges at all) by stable input order.
    const mustFollow = new Map<DependencyNode, DependencyNode[]>();
    const incomingEdges = new Map<DependencyNode, ReplayEdge[]>();
    const inDegree = new Map<DependencyNode, number>(nodes.map((node) => [node, 0]));
    for (const edge of edges) {
      let followers = mustFollow.get(edge.from);
      if (followers === undefined)
        mustFollow.set(edge.from, followers = []);
      followers.push(edge.to);
      inDegree.set(edge.to, inDegree.get(edge.to)! + 1);

      let incoming = incomingEdges.get(edge.to);
      if (incoming === undefined)
        incomingEdges.set(edge.to, incoming = []);
      incoming.push(edge);
    }

    const ordered: DependencyNode[] = [];
    const remaining = new Set(nodes);
    // Nodes freed by the batch currently being placed; they become ready only once it is fully placed,
    // so a node never jumps ahead of an already-ready node with a later input index.
    let nextLevel: DependencyNode[] = [];
    const place = (node: DependencyNode): void => {
      ordered.push(node);
      remaining.delete(node);
      for (const follower of mustFollow.get(node) ?? []) {
        inDegree.set(follower, inDegree.get(follower)! - 1);
        if (inDegree.get(follower) === 0 && remaining.has(follower))
          nextLevel.push(follower);
      }
    };

    let currentLevel = nodes.filter((node) => inDegree.get(node) === 0);
    while (remaining.size > 0) {
      if (currentLevel.length === 0) {
        // Every remaining root is stalled on some other stalled root - a self-contained cycle. Break it
        // by forcing one root through regardless of its unmet incoming edges (see [[breakCycle]]).
        place(this.breakCycle(remaining, incomingEdges, inputIndex));
      } else {
        currentLevel.sort((a, b) => inputIndex.get(a)! - inputIndex.get(b)!);
        for (const node of currentLevel)
          place(node);
      }
      currentLevel = nextLevel;
      nextLevel = [];
    }
    return ordered;
  }

  /** Forces one node out of a stalled (self-contained cycle of) `remaining` nodes through, deferring
   * whichever of its own claimed/required properties are the reason it's stalled - see [[orderNodes]]'s
   * cycle-breaking design and [[applyDeferredCorrections]]. Prefers (in stable input order) a node that
   * has at least one deferrable incoming edge, so the cycle is actually broken open rather than merely
   * papered over; if none exists (every stalled edge is either a non-deferrable navigation requirement
   * or a Delete waiting on a free), the first node in stable order is forced through unresolved instead,
   * leaving its write to fall through to the existing conflict-recording path if it genuinely fails.
   */
  private breakCycle(remaining: Set<DependencyNode>, incomingEdges: Map<DependencyNode, ReplayEdge[]>, inputIndex: Map<DependencyNode, number>): DependencyNode {
    const stalled = [...remaining].sort((a, b) => inputIndex.get(a)! - inputIndex.get(b)!);

    let chosen = stalled[0];
    let deferrableIncoming: { deferrable: DeferredWrite }[] = [];
    for (const node of stalled) {
      const incoming = (incomingEdges.get(node) ?? [])
        .filter((edge): edge is typeof edge & { deferrable: NonNullable<typeof edge.deferrable> } => remaining.has(edge.from) && edge.deferrable !== undefined);
      if (incoming.length > 0) {
        chosen = node;
        deferrableIncoming = incoming;
        break;
      }
    }

    for (const { deferrable } of deferrableIncoming) {
      let substitutions = this._pendingSubstitutions.get(chosen.instanceKey);
      if (substitutions === undefined)
        this._pendingSubstitutions.set(chosen.instanceKey, substitutions = []);
      substitutions.push({ accessString: deferrable.accessString, placeholderValue: this.createPlaceholderValue(deferrable.placeholderKind) });
      this._deferredCorrections.push({ node: chosen, accessString: deferrable.accessString, realValue: deferrable.realValue });
    }
    return chosen;
  }

  /** A safe temporary value to substitute in for a deferred property (see [[breakCycle]]) - one that is
   * (virtually) guaranteed not to collide with any other row while the real value's own conflicting
   * write is pending replay.
   */
  private createPlaceholderValue(kind: DeferredWrite["placeholderKind"]): any {
    switch (kind) {
      case "guid": return Guid.createValue();
      case "string": return `RebasePlaceholder-${Guid.createValue()}`;
      case "navigation": return null;
    }
  }

  /** After [[replayNodes]] finishes, applies each identity-value/navigation-property write that
   * [[orderNodes]] deferred as a safe placeholder while breaking a self-contained ordering cycle. Grouped
   * per node, so a cycle involving several deferred properties on the same node produces a single
   * additional write. This should never collide - whatever the placeholder stood in for has, by
   * construction, already been freed by the time this runs - but if it somehow still does (a genuine
   * external conflict, independent of the cycle that was broken), it is reported and merged into this
   * instance's existing conflict entry (if any) via the normal [[applyOrRecordConstraintConflict]] path,
   * rather than inventing a new conflict shape for it.
   */
  private applyDeferredCorrections(): void {
    if (this._deferredCorrections.length === 0)
      return;

    const byInstanceKey = new Map<string, { node: DependencyNode, accessString: string, realValue: any }[]>();
    for (const correction of this._deferredCorrections) {
      let corrections = byInstanceKey.get(correction.node.instanceKey);
      if (corrections === undefined)
        byInstanceKey.set(correction.node.instanceKey, corrections = []);
      corrections.push(correction);
    }
    this._deferredCorrections = [];
    this._pendingSubstitutions = new Map();

    const nativeDb = this._db[_nativeDb];
    for (const [instanceKey, corrections] of byInstanceKey) {
      const node = corrections[0].node;
      const change = this._store!.get(instanceKey);
      if (change?.new === undefined)
        continue; // The node that owned this deferral was always captured with a "new" side.
      const { $meta: _meta, ...newProps } = change.new;

      const propsToWrite: RebaseConflictProperties = { id: node.id, classFullName: node.classFullName };
      for (const correction of corrections)
        setPropertyValue(propsToWrite, correction.accessString, correction.realValue);

      // Not an Insert (the placeholder-substituted row was already written during replay) - pass a
      // defined `oldProps` so a UNIQUE violation isn't misclassified as a colliding primary-key insert.
      const oldProps = change.old ?? { id: node.id, classFullName: node.classFullName };
      this.applyOrRecordConstraintConflict(instanceKey, node.id, node.classFullName, oldProps, newProps, () =>
        nativeDb.updateInstance(propsToWrite, { useJsNames: true }));
    }
  }

  /** Applies a single node's change in the order computed by [[orderNodes]]. */
  private applyNode(node: DependencyNode): void {
    const change = this.getChange(node);
    this.applyInteractiveInstanceChange(change);
  }

  /** Applies a single instance's captured old/new snapshot pair, inferring Insert/Update/Delete from
   * which of "old"/"new" were captured, and detecting conflicts against the current row.
   */
  private applyInteractiveInstanceChange(change: RebaseInstanceChange): void {
    if (change.new) {
      const { $meta: _newMeta, ...newProps } = change.new;
      if (change.old) {
        const { $meta: _oldMeta, ...oldProps } = change.old;
        this.applyInteractiveUpdate(change.instanceKey, oldProps, newProps, change.changedProperties);
      } else {
        this.applyInteractiveInsert(change.instanceKey, newProps);
      }
    } else if (change.old) {
      const { $meta: _oldMeta, ...oldProps } = change.old;
      this.applyInteractiveDelete(change.instanceKey, oldProps);
    }
  }

  private applyInteractiveUpdate(instanceKey: string, oldProps: RebaseConflictProperties, newProps: RebaseConflictProperties, changedProperties: string[] | undefined): void {
    const nativeDb = this._db[_nativeDb];
    const expectedOldValues = pickProperties(withoutIdentityProperties(withMissingAsNull(oldProps, newProps)), changedProperties);
    // Native always applies `updateInstance` incrementally (properties omitted from the write are left
    // as-is), so restricting the write to just the touched properties avoids clobbering any upstream
    // change to a property our local change never touched.
    const propsToWrite = changedProperties === undefined
      ? newProps
      : { id: newProps.id, classFullName: newProps.classFullName, ...pickProperties(newProps, changedProperties) };
    const result = this.applyOrRecordConstraintConflict(instanceKey, propsToWrite.id, propsToWrite.classFullName, oldProps, newProps, () =>
      nativeDb.updateInstance(propsToWrite, { useJsNames: true, expectedOldValues }) as { updated: boolean, conflictingProperties: string[] });
    if (result === undefined) {
      // A constraint conflict occurred and was already recorded.
      return;
    }
    if (result.updated) {
      return;
    }

    // Does the updated instance exist at all? A live read here is exactly this instance's pre-replay
    // "theirs" state: our own write above is the first (and only) thing this replay ever does to this
    // row, so nothing has changed it since `pullMergeRebaseNext()` merged in the incoming changes.
    const theirs = this.tryReadCurrentInstance(oldProps.id, oldProps.classFullName);
    if (theirs === undefined) {
      // The incoming changes deleted the instance that our local change updated. Their delete stands.
      RebaseConflictImpl.recordTheirDeleteOurUpdate(this, this._conflicts, instanceKey, oldProps, newProps, result.conflictingProperties);
    } else {
      // The row still exists, but at least one property we touched (result.conflictingProperties) no
      // longer matches our captured baseline, meaning the incoming changes also modified it.
      RebaseConflictImpl.recordUpdate(this, this._conflicts, instanceKey, oldProps, theirs, newProps, result.conflictingProperties);
      this.applyOrRecordConstraintConflict(instanceKey, propsToWrite.id, propsToWrite.classFullName, oldProps, newProps, () => nativeDb.updateInstance(propsToWrite, { useJsNames: true }));
    }
  }

  private applyInteractiveDelete(instanceKey: string, oldProps: RebaseConflictProperties): void {
    const nativeDb = this._db[_nativeDb];
    const key = { id: oldProps.id, classFullName: oldProps.classFullName };
    // A live read here is exactly this instance's pre-replay "theirs" state - see the analogous comment in
    // [[applyInteractiveUpdate]].
    const theirs = this.tryReadCurrentInstance(oldProps.id, oldProps.classFullName);
    if (theirs === undefined) {
      // The incoming changes already deleted it - nothing more to do.
      return;
    }

    // The captured baseline omits null properties, so add them explicitly or their upstream change goes unchecked.
    const expectedOldValues = withoutIdentityProperties(withMissingAsNull(oldProps, theirs));
    const result = this.applyOrRecordConstraintConflict(instanceKey, oldProps.id, oldProps.classFullName, oldProps, undefined, () =>
      this.deleteWithReferentialActionTracking(key, () =>
        nativeDb.deleteInstance(key, { useJsNames: true, expectedOldValues }) as { deleted: boolean, conflictingProperties: string[] }));
    if (result === undefined || result.deleted) {
      // Either a constraint conflict was already recorded, or we deleted it - nothing more to do.
      return;
    }

    // The row still exists but no longer matches our captured baseline (result.conflictingProperties),
    // meaning the incoming changes modified it. Report the conflict, but proceed with the delete (matching
    // the native changeset-conflict model for a Deleted opcode with a "Data" conflict cause).
    RebaseConflictImpl.recordTheirUpdateOurDelete(this, this._conflicts, instanceKey, oldProps, theirs, result.conflictingProperties);
    this.deleteWithReferentialActionTracking(key, () => nativeDb.deleteInstance(key, { useJsNames: true }));
  }

  private deleteWithReferentialActionTracking<T>(key: { id: Id64String, classFullName: string }, deleteInstance: () => T): T {
    const affected = this.findOnDeleteAffectedInstances(key.id, key.classFullName);
    const result = deleteInstance();
    const deleted = typeof result !== "object" || result === null || !("deleted" in result) || Boolean((result as { deleted: boolean }).deleted);
    const conflict = deleted
      ? this._conflicts.find((candidate) => candidate.id === key.id && candidate.classFullName === key.classFullName) as RebaseConflictImpl | undefined
      : undefined;
    if (conflict !== undefined) {
      for (const entry of affected)
        conflict.recordDeletionEffect(entry);
    }
    return result;
  }

  private getDeletionReferences(targetClassFullName: string): OnDeleteReference[] {
    const references = [...(this._onDeleteReferencesByTargetClass.get(targetClassFullName) ?? [])];
    // Embedding relationships whose FK is NoAction because the Element/Model APIs implement the cascade themselves.
    const targetClass = this._schemaView.findClass(targetClassFullName);
    const implicitCascades = targetClass?.is("BisCore:Element") ? [["BisCore:Element", "Parent"], ["BisCore:Model", "ModeledElement"]]
      : targetClass?.is("BisCore:Model") ? [["BisCore:Element", "Model"], ["BisCore:Model", "ParentModel"]] : [];
    for (const [referencingClassFullName, navigationProperty] of implicitCascades) {
      if (references.some((reference) => reference.navigationProperty === navigationProperty))
        continue;
      const property = resolveSchemaViewProperty(this._schemaView, referencingClassFullName, navigationProperty);
      if (property?.isNavigation()) {
        references.push({
          referencingClassFullName, navigationProperty, navigationPropertyJsName: ECJsNames.toJsName(navigationProperty),
          relationshipClass: property.relationshipClass, action: "CASCADE",
        });
      }
    }
    return references;
  }

  /** Finds live rows that reference `targetId` through the cached set of FK navigation properties
   * with ON DELETE CASCADE or SET NULL. The dependency graph has already replayed known removals. */
  private findOnDeleteAffectedInstances(targetId: Id64String, targetClassFullName: string, visited = new Set<string>()): AffectedOnDeleteInstance[] {
    const key = `${targetId}|${targetClassFullName}`;
    if (visited.has(key))
      return [];
    visited.add(key);
    const references = this.getDeletionReferences(targetClassFullName);

    const knownInstances = new Set([...this._dependencyNodesByInstanceKey.values()].map((node) => `${node.id}|${node.classFullName}`));
    const affected: AffectedOnDeleteInstance[] = [];
    for (const reference of references) {
      const binder = new QueryBinder().bindId(1, targetId);
      this._db.withQueryReader(
        `SELECT ECInstanceId, ECClassId, ec_classname(ECClassId, 's:c')
         FROM ${reference.referencingClassFullName}
         WHERE [${reference.navigationProperty}].[Id] = ?`,
        (reader) => {
          for (const row of reader) {
            const id = row[0] as Id64String;
            const classFullName = row[2] as string;
            if (reference.action === "CASCADE")
              affected.push(...this.findOnDeleteAffectedInstances(id, classFullName, visited));
            if (knownInstances.has(`${id}|${classFullName}`) &&
              !this._conflicts.some((conflict) => conflict.id === id && conflict.classFullName === classFullName))
              continue;
            const theirs = this.tryReadCurrentInstance(id, classFullName);
            if (theirs !== undefined) {
              affected.push({
                instanceKey: `${id}-${row[1]}`,
                id,
                classFullName,
                theirs,
                reference,
              });
            }
          }
        },
        binder,
      );
    }
    return affected;
  }

  private applyInteractiveInsert(instanceKey: string, newProps: RebaseConflictProperties): void {
    const nativeDb = this._db[_nativeDb];
    this.applyOrRecordConstraintConflict(instanceKey, newProps.id, newProps.classFullName, undefined, newProps, () => {
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
  private applyOrRecordConstraintConflict<T>(instanceKey: string, id: Id64String, classFullName: string, oldProps: RebaseConflictProperties | undefined, newProps: RebaseConflictProperties | undefined, apply: () => T): T | undefined {
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
        const conflict = RebaseConflictImpl.recordForeignKeyConstraint(this, this._conflicts, instanceKey, oldProps, newProps, theirRow, brokenRelationships);

        const fallbackProps = newProps === undefined ? undefined : this.fixBrokenNavigationProperties(newProps, brokenRelationships, theirRow);
        if (fallbackProps !== undefined) {
          let fallbackApplied = false;
          this.applyOrRecordConstraintConflict(instanceKey, id, classFullName, oldProps, fallbackProps, () => {
            this.writeConstraintRetry(oldProps, fallbackProps);
            fallbackApplied = true;
          });
          if (fallbackApplied)
            conflict.recordBrokenRelationshipFix(brokenRelationships, fallbackProps);
        }
        return undefined;
      }
      if (err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_UNIQUE && err.errorNumber !== DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY) {
        throw err;
      }

      const isInsert = oldProps === undefined;
      const theirs = isInsert ? this.tryReadCurrentInstance(id, classFullName) : undefined;
      if (theirs !== undefined) {
        // Both local and incoming changes wrote an instance with the same id.
        RebaseConflictImpl.recordInsert(this, this._conflicts, instanceKey, newProps!, theirs);

        // Attempt to apply "our" change to the existing row, which may trigger further conflicts (e.g. UNIQUE constraint violations).
        this.applyOrRecordConstraintConflict(instanceKey, id, classFullName, theirs, newProps, () => this._db[_nativeDb].updateInstance(newProps!, { useJsNames: true }));
      } else {
        // Some other UNIQUE index (not the primary key) was violated.
        const conflictDetail = err.conflictDetail as UniqueConstraintConflictDetail | undefined;
        // The write failed, so the row as it currently stands is still "their" version of it. For an insert
        // there is no such row - they have no version of this instance at all - so `theirs` stays undefined.
        const theirRow = isInsert ? undefined : this.tryReadCurrentInstance(id, classFullName);
        const violation = RebaseConflictImpl.recordUniqueConstraint(this, this._conflicts, instanceKey, oldProps, newProps!, theirRow, conflictDetail);

        // Fix this UNIQUE constraint violation by changing the value of one of the properties involved in the constraint until we
        // find a value that doesn't collide.
        const fix = this.fixUniqueConstraintViolation(newProps!, conflictDetail?.uniqueConstraintProperties, oldProps?.id);

        // Apply the updated row, which may trigger further conflicts (e.g. UNIQUE constraint violations).
        if (fix !== undefined) {
          violation.appliedFix = {
            property: this._db.getJsClass<typeof Element>(classFullName).toPropsAccessString(fix.property),
            value: fix.value,
          };
          this.applyOrRecordConstraintConflict(instanceKey, id, classFullName, oldProps, fix.props, () => {
            this.writeConstraintRetry(oldProps, fix.props);
          });
        }
      }
      return undefined;
    }
  }

  /** Writes a constraint-retry row using the operation represented by its captured old side. */
  private writeConstraintRetry(oldProps: RebaseConflictProperties | undefined, props: RebaseConflictProperties): void {
    if (oldProps === undefined)
      this._db[_nativeDb].insertInstance(props, { forceUseId: true, useJsNames: true });
    else
      this._db[_nativeDb].updateInstance(props, { useJsNames: true });
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

  private findBrokenRelationships(props: RebaseConflictProperties): BrokenRelationshipDetail[] {
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

    const broken: BrokenRelationshipDetail[] = [];
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
          jsName,
          nullable: relConstraint === undefined || relConstraint.multiplicityLower === 0,
        });
      }
    }
    return broken;
  }

  private fixBrokenNavigationProperties(props: RebaseConflictProperties, brokenRelationships: BrokenRelationshipDetail[], currentProps: RebaseConflictProperties | undefined): RebaseConflictProperties | undefined {
    const fixableRelationships = currentProps === undefined
      ? brokenRelationships.filter((relationship) => relationship.nullable)
      : brokenRelationships;
    if (fixableRelationships.length === 0)
      return undefined;

    const fallbackProps = { ...props };
    for (const relationship of fixableRelationships) {
      const value = currentProps === undefined ? null : getPropertyValue(currentProps, relationship.jsName);
      setPropertyValue(fallbackProps, relationship.jsName, value);
    }

    return fallbackProps;
  }

  /** Applies a conflict resolution to the selected properties of an existing instance.
   * @internal
   */
  public applyConflictResolution(conflict: RebaseConflict, props: RebaseConflictProperties, properties: string[]): void {
    const conflictImpl = conflict as RebaseConflictImpl;
    conflictImpl.clearSupersededConstraintFixes(properties);
    this.writeConflictResolution(conflictImpl, props, 0);
    this._db.clearCaches({ instanceCachesOnly: true });
  }

  /** Writes a resolved conflict's properties, resolving any UNIQUE constraint violation the write provokes the
   * same way the initial replay does: record the violation on the conflict, pick a non-colliding value for one
   * of the constrained properties, and retry. Re-applying "our" values necessarily reintroduces whatever
   * violation they caused in the first place, so this must not escape as an exception.
   */
  private writeConflictResolution(conflict: RebaseConflictImpl, props: RebaseConflictProperties, attempt: number): void {
    try {
      const result = this._db[_nativeDb].updateInstance(props, { useJsNames: true, useIncrementalUpdate: true });
      if (result === false || result !== true && !result.updated) {
        return;
      }
    } catch (err: any) {
      if (err.errorNumber === DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY) {
        const brokenRelationships = this.findBrokenRelationships(props);
        if (brokenRelationships.length === 0)
          throw err;
        conflict.addBrokenRelationships(brokenRelationships);
        const current = this.tryReadCurrentInstance(conflict.id, conflict.classFullName);
        // A broken non-nullable relationship on an instance that doesn't exist leaves it unapplied, as during replay.
        if (current === undefined && brokenRelationships.some((relationship) => !relationship.nullable))
          return;
        const fallbackProps = this.fixBrokenNavigationProperties(props, brokenRelationships, current)!;
        this.writeConflictResolution(conflict, fallbackProps, attempt);
        conflict.recordBrokenRelationshipFix(brokenRelationships, fallbackProps);
        return;
      }
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
      this.writeConflictResolution(conflict, fix.props, attempt + 1);
    }
  }
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

/** Returns a copy of `props` with an explicit `null` for each (non-array) property of `other` that `props` lacks. */
function withMissingAsNull(props: RebaseConflictProperties, other: RebaseConflictProperties): RebaseConflictProperties {
  const result = { ...props };
  for (const [key, value] of Object.entries(other)) {
    if (!(key in result) && !Array.isArray(value))
      result[key] = null;
  }
  return result;
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

/** Resolves conflicting properties from one side, using the native row shape stored by
 * [[RebaseConflictImpl.getRaw]] to avoid a deserialize-then-reserialize round-trip.
 */
function applyResolution(
  rebase: InteractiveRebase,
  conflict: RebaseConflictImpl,
  side: "ours" | "theirs",
  requestedProperties?: string[],
): void {
  const source = conflict.getRaw(side);
  const conflictingProperties = conflict.original === undefined ? conflict.differentProperties : conflict.conflictingProperties;
  const properties = requestedProperties !== undefined && requestedProperties.length > 0
    ? conflictingProperties.filter((property) => requestedProperties.includes(property))
    : conflictingProperties;
  if (source === undefined || properties.length === 0)
    return;

  const classDef = rebase.iModel.getJsClass<typeof Element>(conflict.classFullName);
  const updateProps: RebaseConflictProperties = { id: conflict.id, classFullName: conflict.classFullName };
  for (const prop of properties) {
    const instanceAccessString = classDef.toInstanceAccessString(prop);
    const value = getPropertyValue(source, instanceAccessString);
    setPropertyValue(updateProps, instanceAccessString, value === undefined ? null : value);
  }
  rebase.applyConflictResolution(conflict, updateProps, properties);
}

abstract class DeletionEffectImpl implements DeletionEffectDetails {
  public readonly reference: OnDeleteReference;
  public readonly affectedInstanceKey: string;
  public readonly affectedId: Id64String;
  public readonly affectedClassFullName: string;

  public constructor(protected readonly _rebase: InteractiveRebase, entry: AffectedOnDeleteInstance) {
    this.reference = entry.reference;
    this.affectedInstanceKey = entry.instanceKey;
    this.affectedId = entry.id;
    this.affectedClassFullName = entry.classFullName;
  }

  public get relationshipClass(): SchemaView.RelationshipClass { return this.reference.relationshipClass; }
  public get navigationProperty(): string { return this._rebase.iModel.getJsClass<typeof Element>(this.affectedClassFullName).toPropsAccessString(this.reference.navigationPropertyJsName); }
  public get affectedConflict(): RebaseConflict | undefined { return this._rebase.conflicts.find((conflict) => conflict.instanceKey === this.affectedInstanceKey); }

  protected deserialize(raw: RebaseConflictProperties): RebaseConflictProperties {
    return this._rebase.iModel.getJsClass<typeof Element>(this.affectedClassFullName).deserialize({ row: raw, iModel: this._rebase.iModel });
  }
}

class SetNullDeletionEffectImpl extends DeletionEffectImpl {
  public readonly action = "set-null";
  public readonly rawPreviousValue: RelatedElementProps;

  public constructor(rebase: InteractiveRebase, entry: AffectedOnDeleteInstance) {
    super(rebase, entry);
    this.rawPreviousValue = getPropertyValue(entry.theirs, entry.reference.navigationPropertyJsName);
  }

  public get previousValue(): Id64String { return this.rawPreviousValue.id; }
}

class CascadeDeletionEffectImpl extends DeletionEffectImpl {
  public readonly action = "cascade";
  public readonly rawDeletedInstance: RebaseConflictProperties;

  public constructor(rebase: InteractiveRebase, entry: AffectedOnDeleteInstance) {
    super(rebase, entry);
    this.rawDeletedInstance = entry.theirs;
  }

  public get deletedInstance(): RebaseConflictProperties { return this.deserialize(this.rawDeletedInstance); }
}

/** Implements {@link RebaseConflict}, merging detections for the same instance into a single entry. */
class RebaseConflictImpl implements RebaseConflict {
  public readonly instanceKey: string;
  public readonly id: Id64String;
  public readonly classFullName: string;

  /** Raw (native, not yet deserialized) `original`/`theirs`/`ours` rows - see the public getters below. */
  private _original: RebaseConflictProperties | undefined = undefined;
  private _theirs: RebaseConflictProperties | undefined = undefined;
  private _ours: RebaseConflictProperties | undefined = undefined;

  /** Deserializes {@link _original}/{@link _theirs}/{@link _ours} into the public {@link RebaseConflictProperties}
   * shape on every access rather than at record time, so a conflict nobody inspects never pays for it, and a
   * conflict that is inspected doesn't retain both the raw and deserialized forms for the group's whole lifetime.
   */
  public get original(): RebaseConflictProperties | undefined { return this.deserialize(this._original); }
  public get theirs(): RebaseConflictProperties | undefined { return this.deserialize(this._theirs); }
  public get ours(): RebaseConflictProperties | undefined { return this.deserialize(this._ours); }

  public readonly theirModifiedProperties: string[] = [];
  public readonly ourModifiedProperties: string[] = [];
  public readonly conflictingProperties: string[] = [];
  public readonly differentProperties: string[] = [];
  public readonly uniqueConstraintViolations: UniqueConstraintViolation[] = [];
  public readonly brokenRelationships: BrokenRelationship[] = [];
  public readonly deletionEffects: (SetNullDeletionEffectImpl | CascadeDeletionEffectImpl)[] = [];
  /** @deprecated Owner conflict linking has been removed. Always empty; retained until the test refactoring is complete. */
  public readonly ownerConflicts: ReadonlyArray<RebaseConflict> = [];
  /** @deprecated Dependent conflict linking has been removed. Always empty; retained until the test refactoring is complete. */
  public readonly dependentConflicts: ReadonlyArray<RebaseConflict> = [];

  private constructor(private readonly _rebase: InteractiveRebase, instanceKey: string, id: Id64String, classFullName: string) {
    this.instanceKey = instanceKey;
    this.id = id;
    this.classFullName = classFullName;
  }

  private static getOrCreate(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, id: Id64String, classFullName: string): RebaseConflictImpl {
    let conflict = conflicts.find((c) => c.instanceKey === instanceKey) as RebaseConflictImpl | undefined;
    if (conflict === undefined) {
      conflict = new RebaseConflictImpl(rebase, instanceKey, id, classFullName);
      conflicts.push(conflict);
    }
    return conflict;
  }

  /** Deserializes a raw row (one of {@link _original}/{@link _theirs}/{@link _ours}) into the public
   * {@link RebaseConflictProperties} shape, or undefined if `raw` is undefined.
   */
  private deserialize(raw: RebaseConflictProperties | undefined): RebaseConflictProperties | undefined {
    if (raw === undefined)
      return undefined;
    return this._rebase.iModel.getJsClass<typeof Element>(this.classFullName).deserialize({ row: raw, iModel: this._rebase.iModel });
  }

  /** The raw (native, not yet deserialized) form of `side`, for internal write-back paths that would
   * otherwise read the deserialized {@link ours}/{@link theirs} only to immediately reserialize it back
   * to this same raw shape.
   * @internal
   */
  public getRaw(side: "ours" | "theirs"): RebaseConflictProperties | undefined {
    return side === "ours" ? this._ours : this._theirs;
  }

  /** Both the incoming (their) changes and the local (our) changes modified the same instance. */
  public static recordUpdate(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, original: RebaseConflictProperties, theirs: RebaseConflictProperties, ours: RebaseConflictProperties, conflictingProperties: string[]): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(original.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, instanceKey, original.id, original.classFullName);

    addPropsAccessStrings(conflict.conflictingProperties, classDef, conflictingProperties);
    addPropsAccessStrings(conflict.theirModifiedProperties, classDef, computeChangedProperties(original, theirs));
    addPropsAccessStrings(conflict.ourModifiedProperties, classDef, computeChangedProperties(original, ours));
    addPropsAccessStrings(conflict.differentProperties, classDef, computeChangedProperties(theirs, ours));

    conflict._original = original;
    conflict._theirs = theirs;
    conflict._ours = ours;
  }

  /** The incoming (their) changes modified properties on an instance that was deleted by the local (our) changes. */
  public static recordTheirUpdateOurDelete(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, original: RebaseConflictProperties, theirs: RebaseConflictProperties, updatedProperties: string[]): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(original.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, instanceKey, original.id, original.classFullName);

    addPropsAccessStrings(conflict.theirModifiedProperties, classDef, updatedProperties);

    conflict._original = original;
    conflict._theirs = theirs;
  }

  /** The incoming (their) changes deleted an instance that was modified by the local (our) changes. */
  public static recordTheirDeleteOurUpdate(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, original: RebaseConflictProperties, ours: RebaseConflictProperties, updatedProperties: string[]): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(original.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, instanceKey, original.id, original.classFullName);

    addPropsAccessStrings(conflict.ourModifiedProperties, classDef, updatedProperties);

    conflict._original = original;
    conflict._ours = ours;
  }

  /** Both the incoming (their) changes and the local (our) changes inserted an instance with the same id. */
  public static recordInsert(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, ours: RebaseConflictProperties, theirs: RebaseConflictProperties): void {
    const classDef = rebase.iModel.getJsClass<typeof Element>(ours.classFullName);
    const conflict = this.getOrCreate(rebase, conflicts, instanceKey, ours.id, ours.classFullName);

    addPropsAccessStrings(conflict.differentProperties, classDef, computeChangedProperties(ours, theirs));

    conflict._theirs = theirs;
    conflict._ours = ours;
  }

  public recordDeletionEffect(entry: AffectedOnDeleteInstance): void {
    if (!this.deletionEffects.some((effect) => effect.affectedInstanceKey === entry.instanceKey && effect.reference.navigationProperty === entry.reference.navigationProperty))
      this.deletionEffects.push(entry.reference.action === "SET NULL"
        ? new SetNullDeletionEffectImpl(this._rebase, entry) : new CascadeDeletionEffectImpl(this._rebase, entry));
  }

  /** Our change (insert or update) violated a UNIQUE constraint against some other, unrelated instance. */
  public static recordUniqueConstraint(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, original: RebaseConflictProperties | undefined, ours: RebaseConflictProperties, theirs: RebaseConflictProperties | undefined, detail?: UniqueConstraintConflictDetail): UniqueConstraintViolation {
    const instanceId = ours.id ?? original?.id;
    const classFullName = ours.classFullName ?? original?.classFullName;
    const conflict = this.getOrCreate(rebase, conflicts, instanceKey, instanceId, classFullName);

    if (original !== undefined) {
      conflict._original = original;
    }
    if (theirs !== undefined && conflict._theirs === undefined) {
      conflict._theirs = theirs;
    }
    conflict._ours = ours;

    return conflict.upsertUniqueConstraintViolation(detail);
  }

  /** Our change (insert or update) violated a FOREIGN KEY constraint, e.g. referencing a deleted instance. */
  public static recordForeignKeyConstraint(rebase: InteractiveRebase, conflicts: RebaseConflict[], instanceKey: string, original: RebaseConflictProperties | undefined, ours: RebaseConflictProperties | undefined, theirs: RebaseConflictProperties | undefined, brokenRelationships: BrokenRelationship[]): RebaseConflictImpl {
    const instanceId = ours?.id ?? original?.id ?? theirs?.id;
    const classFullName = ours?.classFullName ?? original?.classFullName ?? theirs?.classFullName;
    const conflict = this.getOrCreate(rebase, conflicts, instanceKey, instanceId!, classFullName!);

    if (original !== undefined) {
      conflict._original = original;
    }
    if (theirs !== undefined && conflict._theirs === undefined) {
      conflict._theirs = theirs;
    }
    if (ours !== undefined) {
      conflict._ours = ours;
    }

    conflict.addBrokenRelationships(brokenRelationships);
    return conflict;
  }

  public addBrokenRelationships(brokenRelationships: BrokenRelationship[]): void {
    for (const broken of brokenRelationships) {
      if (!this.brokenRelationships.some((b) => b.navigationProperty === broken.navigationProperty && b.relationshipClass === broken.relationshipClass)) {
        this.brokenRelationships.push({
          navigationProperty: broken.navigationProperty,
          relationshipClass: broken.relationshipClass,
        });
      }
    }
  }

  /** Records the navigation substitutions that were successfully written while replaying this conflict. */
  public recordBrokenRelationshipFix(brokenRelationships: BrokenRelationshipDetail[], appliedProps: RebaseConflictProperties): void {
    for (const broken of brokenRelationships) {
      const relationship = this.brokenRelationships.find((candidate) =>
        candidate.navigationProperty === broken.navigationProperty && candidate.relationshipClass === broken.relationshipClass);
      if (relationship !== undefined) {
        const value = getPropertyValue(appliedProps, broken.jsName);
        relationship.appliedValue = typeof value === "object" && value !== null ? value.id : value;
      }
    }
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
      other.uniqueConstraintProperties.every((prop, i) => prop === uniqueConstraintProperties[i])) as UniqueConstraintViolationImpl | undefined;

    const conflictingInstanceRaw = detail?.conflictingInstance ?? {};
    if (existing !== undefined) {
      existing.setRaw(conflictingInstanceRaw);
      existing.appliedFix = undefined;
      return existing;
    }

    const violation = new UniqueConstraintViolationImpl(this._rebase, this.classFullName, uniqueConstraintProperties, conflictingInstanceRaw);
    this.uniqueConstraintViolations.push(violation);
    return violation;
  }

  public clearSupersededConstraintFixes(properties: string[]): void {
    for (let i = this.uniqueConstraintViolations.length - 1; i >= 0; --i) {
      const violation = this.uniqueConstraintViolations[i];
      const overwritten = violation.appliedFix !== undefined
        ? properties.includes(violation.appliedFix.property)
        : violation.uniqueConstraintProperties.some((property) => properties.includes(property));
      if (overwritten)
        this.uniqueConstraintViolations.splice(i, 1);
    }
    for (let i = this.brokenRelationships.length - 1; i >= 0; --i) {
      if (properties.includes(this.brokenRelationships[i].navigationProperty))
        this.brokenRelationships.splice(i, 1);
    }
  }

  public acceptOurs(properties?: string[]): void {
    applyResolution(this._rebase, this, "ours", properties);
  }

  public acceptTheirs(properties?: string[]): void {
    applyResolution(this._rebase, this, "theirs", properties);
  }

  public resolveBrokenRelationship(brokenRelationship: BrokenRelationship | string, value: Id64String): void {
    const relationship = typeof brokenRelationship === "string"
      ? this.brokenRelationships.find((candidate) => candidate.navigationProperty === brokenRelationship)
      : this.brokenRelationships.find((candidate) => candidate === brokenRelationship);
    if (relationship === undefined) {
      InteractiveRebaseError.throwError(
        "not-conflicting-property",
        `The navigation property ${typeof brokenRelationship === "string" ? brokenRelationship : brokenRelationship.navigationProperty} is not a broken relationship for this conflict`);
    }

    const classDef = this._rebase.iModel.getJsClass<typeof Element>(this.classFullName);
    const instanceAccessString = classDef.toInstanceAccessString(relationship.navigationProperty);
    let current: RebaseConflictProperties | undefined;
    try {
      current = this._rebase.iModel[_nativeDb].readInstance({ id: this.id, classFullName: this.classFullName }, { useJsNames: true }) as RebaseConflictProperties;
    } catch {
      current = undefined;
    }
    const writeProps: RebaseConflictProperties = current === undefined
      ? { ...(this._ours ?? {}) }
      : { id: this.id, classFullName: this.classFullName };

    if (current === undefined) {
      for (const candidate of this.brokenRelationships) {
        const candidateInstanceAccessString = classDef.toInstanceAccessString(candidate.navigationProperty);
        if (candidate.stagedValue !== undefined)
          setPropertyValue(writeProps, candidateInstanceAccessString, candidate.stagedValue);
        else if (candidate.appliedValue !== undefined)
          setPropertyValue(writeProps, candidateInstanceAccessString, candidate.appliedValue);
      }
    }
    setPropertyValue(writeProps, instanceAccessString, value);

    let inserted = false;
    try {
      if (current === undefined) {
        this._rebase.iModel[_nativeDb].insertInstance(writeProps, { forceUseId: true, useJsNames: true });
        for (const candidate of this.brokenRelationships) {
          const candidateInstanceAccessString = classDef.toInstanceAccessString(candidate.navigationProperty);
          candidate.appliedValue = getPropertyValue(writeProps, candidateInstanceAccessString);
          candidate.stagedValue = undefined;
        }
        inserted = true;
      } else {
        const result = this._rebase.iModel[_nativeDb].updateInstance(writeProps, { useJsNames: true });
        if (result === false || result !== true && !result.updated)
          throw new IModelError(IModelStatus.BadRequest, "Failed to update instance while resolving a broken relationship");
        relationship.appliedValue = value;
        relationship.stagedValue = undefined;
      }
    } catch {
      if (current === undefined) {
        relationship.appliedValue = undefined;
        relationship.stagedValue = value;
      } else {
        relationship.appliedValue = getPropertyValue(current, instanceAccessString);
        relationship.stagedValue = value;
      }
    }

    if (inserted)
      this.restoreResolvedDependentRelationships();

    this._rebase.iModel.clearCaches({ instanceCachesOnly: true });
  }

  private restoreResolvedDependentRelationships(): void {
    for (const dependent of this._rebase.getReferenceDependentConflicts(this.instanceKey)) {
      for (const relationship of dependent.brokenRelationships) {
        const dependentProps = dependent.ours;
        if (dependentProps === undefined)
          continue;

        const dependentRelationship = getPropertyValue(dependentProps, relationship.navigationProperty);
        const dependentRelationshipId = typeof dependentRelationship === "string"
          ? dependentRelationship
          : dependentRelationship?.id;
        if (dependentRelationshipId !== this.id)
          continue;
        if (dependentRelationshipId === relationship.appliedValue)
          continue;

        dependent.resolveBrokenRelationship(relationship, this.id);
      }
    }
  }
}

/** Implements {@link UniqueConstraintViolation}, deserializing {@link conflictingInstance} on access
 * rather than at record time - see [[RebaseConflictImpl.deserialize]] for why.
 */
class UniqueConstraintViolationImpl implements UniqueConstraintViolation {
  public readonly uniqueConstraintProperties: string[];
  public appliedFix?: AppliedFix;
  private _conflictingInstance: RebaseConflictProperties;

  public constructor(private readonly _rebase: InteractiveRebase, private readonly _classFullName: string, uniqueConstraintProperties: string[], conflictingInstance: RebaseConflictProperties) {
    this.uniqueConstraintProperties = uniqueConstraintProperties;
    this._conflictingInstance = conflictingInstance;
  }

  public get conflictingInstance(): RebaseConflictProperties {
    return this._rebase.iModel.getJsClass<typeof Element>(this._classFullName).deserialize({ row: this._conflictingInstance, iModel: this._rebase.iModel });
  }

  /** Updates the raw conflicting-instance row when this same constraint is re-violated (see
   * [[RebaseConflictImpl.upsertUniqueConstraintViolation]]).
   * @internal
   */
  public setRaw(conflictingInstance: RebaseConflictProperties): void {
    this._conflictingInstance = conflictingInstance;
  }
}
