/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { assert, DbResult, Id64, Id64String, OpenMode } from "@itwin/core-bentley";
import { Base64EncodedString, ECJsNames } from "@itwin/core-common";
import { SchemaView, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";
import { ChangeInstance, ChangeSource } from "../ChangesetReaderTypes";
import type { ECSqlRow } from "../Entity";
import { SQLiteDb } from "../SQLiteDb";
import type { AnyDb } from "../SqliteChangesetReader";
import { SqliteStatement } from "../SqliteStatement";
import { _nativeDb } from "./Symbols";

/** The operation a [[RebaseInstanceChange]] represents, inferred from which of `old`/`new` were captured. */
export type RebaseInstanceOperation = "Insert" | "Update" | "Delete";

/** The kinds of instance that can be an embedding owner. A Model shares its id with its modeled Element,
 * so an owner is only identified unambiguously by its kind and id together - see [[rebaseOwnerKey]].
 * @internal
 */
export type RebaseOwnerKind = "element" | "model";

/** A reference to one of an instance's embedding owners.
 * @internal
 */
export interface RebaseOwnerRef {
  kind: RebaseOwnerKind;
  id: Id64String;
}

/** A key that uniquely identifies an embedding owner, even when a Model and its modeled Element share an id.
 * @internal
 */
export function rebaseOwnerKey(kind: RebaseOwnerKind, id: Id64String): string {
  return `${kind}:${id}`;
}

/** The old (pre-local-change) and new (post-local-change) snapshots of a single EC instance, as
 * captured by [[RebaseInstanceStore]].
 * @internal
 */
export interface RebaseInstanceChange {
  /**
   * The unique key identifying the EC instance.
   */
  instanceKey: string;

  /**
   * The JS-cased names of the properties that were part of the actual changeset Update captured for
   * `change` (across however many tables it spans), or `undefined` for an Insert/Delete (whose raw rows
   * always carry every column already, so there's nothing to narrow down).
   */
  changedProperties?: string[];

  /**
   * The old (pre-local-change) snapshot of the EC instance. Undefined for an Insert.
   */
  old?: ChangeInstance;

  /**
   * The new (post-local-change) snapshot of the EC instance. Undefined for a Delete.
   */
  new?: ChangeInstance;
}

const tableName = "[InstanceChanges]";

/** One schema-declared UNIQUE constraint applicable to a class, as discovered by
 * [[RebaseInstanceStore.getIdentityGroups]] - not exported; [[RebaseInstanceMetadata.identityValues]] is
 * the per-instance result derived from this.
 */
interface IdentityConstraintGroup {
  /** Stable identifier for this group - see [[RebaseIdentityValue.key]]. */
  key: string;
  /** The props access string (see [[Entity.toPropsAccessString]]) of each property in the group, in the
   * same order the composite value is joined in. */
  propsAccessStrings: string[];
  /** See [[RebaseIdentityValue.accessString]]. */
  deferAccessString: string;
  /** See [[RebaseIdentityValue.placeholderKind]]. */
  deferKind: "guid" | "string";
}

/** The metadata classified for a captured instance, without its (potentially large) `old`/`new`
 * snapshots - see [[RebaseInstanceStore.allMetadata]].
 * @internal
 */
export interface RebaseInstanceMetadata {
  instanceKey: string;
  id: Id64String;
  classFullName: string;
  operation: RebaseInstanceOperation;
  isIndirect: boolean;
  /** Every embedding owner this instance references, e.g. an Element's parent Element and its Model. */
  owners: RebaseOwnerRef[];
  /** The kind of embedding owner this instance can itself be, or undefined if it is neither an Element nor a Model. */
  ownerKind: RebaseOwnerKind | undefined;
  /** One entry per schema-declared UNIQUE constraint applicable to `classFullName` (single-property or
   * composite, declared on the class itself or any base class) that has a defined `old` and/or `new`
   * composite value - see [[RebaseInstanceStore.set]]. */
  identityValues?: RebaseIdentityValue[];
  /** One entry per navigation property declared on `classFullName` (undefined for a relationship
   * class, or a class with no navigation properties) - see [[RebaseInstanceStore.set]]. */
  navigationRefs?: RebaseNavigationRef[];
}

/** A single navigation property's old/new referenced id, as extracted at capture time - see
 * [[RebaseInstanceMetadata.navigationRefs]].
 * @internal
 */
export interface RebaseNavigationRef {
  jsName: string;
  /** Whether the relationship's *other*-side constraint allows this property to be null - see
   * [[RebaseInstanceStore.getNavigationProperties]]. */
  nullable: boolean;
  /** Whether the referenced instance is an Element or a Model, if the relationship's constraint says so -
   * needed to tell a Model apart from its modeled Element, which shares its id. */
  targetKind?: RebaseOwnerKind;
  oldId?: Id64String;
  newId?: Id64String;
}

/** A single schema-declared UNIQUE constraint's old/new composite value, as extracted at capture time -
 * see [[RebaseInstanceMetadata.identityValues]].
 * @internal
 */
export interface RebaseIdentityValue {
  /** A stable identifier for this constraint's group of properties (its sorted EC access-string list),
   * shared by every instance of `classFullName` (and its subclasses) - used to key freed/claimed
   * identity-value edges generically in [[InteractiveRebase.orderNodes]]. */
  key: string;
  /** The composite value (each property's value joined by `"|"`) `old` held, or undefined if any
   * property in the group was unset - SQLite does not consider a `NULL`-containing row to collide with
   * another under a UNIQUE index, so neither does this. */
  old?: string;
  /** Same as `old`, but for `new`. */
  new?: string;
  /** The props access string (e.g. `federationGuid`, `code.value`) of the one property within this
   * group that [[InteractiveRebase.breakCycle]] substitutes a placeholder for when deferring this
   * group as part of breaking a self-contained ordering cycle - changing any single property of a
   * composite UNIQUE constraint is enough to break its collision, so only one need be deferred. */
  accessString: string;
  /** The placeholder kind to substitute in for `accessString` - see
   * [[InteractiveRebase.createPlaceholderValue]]. */
  placeholderKind: "guid" | "string";
}

/**
 * Durable, on-disk store of the EC instances changed by a single Txn, captured while that Txn is
 * reversed in preparation for an interactive rebase (see [[InteractiveRebase.onBeforeReverseLocalTxn]])
 * and later replayed as instance patches instead of a raw SQLite changeset.
 *
 * Unlike [[PartialChangeUnifier]] - which merges partial per-table rows into complete instances
 * keyed by instanceKey *and* stage, requiring old/new snapshots to be paired up after the fact -
 * this store keys rows by instanceKey alone and holds the old and new snapshots in separate
 * columns of the same row, so no further coalescing is needed once capture is complete.
 * @internal
 */
export class RebaseInstanceStore implements Disposable {
  private readonly _db = new SQLiteDb();
  private readonly _writable: boolean;
  /** The db that changes are being captured from. Only set (and needed) on stores created via [[createNew]],
   * to seed an update's instance snapshots with their unchanged properties (see [[merge]]). */
  private readonly _sourceDb?: AnyDb;

  /** The `SchemaView` used to classify embedding ownership (`owners`/`ownerKind`) as changes are
   * appended. Only set on stores created via [[createNew]]; a store opened via [[openExisting]] never
   * writes, so it has no need for one.
   */
  private readonly _schemaView?: SchemaView;

  /** classFullName -> its embedding-owner nav properties (access string + kind of owner each points to). */
  private _embeddingOwnerProperties = new Map<string, { jsName: string, kind: RebaseOwnerKind }[]>();

  /** mixin classFullName -> the kind of entity it applies to - see [[getMixinOwnerKind]]. */
  private _mixinOwnerKinds = new Map<string, RebaseOwnerKind | undefined>();

  /** classFullName -> its navigation properties (jsName + nullability), or an empty array for a
   * relationship class - see [[getNavigationProperties]]. Cached the same way as
   * [[_embeddingOwnerProperties]], since [[set]] otherwise re-resolves the same schema lookups once per
   * instance of the same class.
   */
  private _navigationPropertiesByClass = new Map<string, { jsName: string, nullable: boolean, targetKind?: RebaseOwnerKind }[]>();

  /** classFullName -> its schema-declared UNIQUE constraint groups (one entry per constraint, single-
   * property or composite, declared on the class itself or any base class) - see [[getIdentityGroups]].
   * Cached the same way as [[_embeddingOwnerProperties]]/[[_navigationPropertiesByClass]], since a single
   * ECSQL discovery per class is far cheaper than repeating it once per instance.
   */
  private _identityGroupsByClass = new Map<string, IdentityConstraintGroup[]>();

  private constructor(writable: boolean, sourceDb?: AnyDb, schemaView?: SchemaView) {
    this._writable = writable;
    this._sourceDb = sourceDb;
    this._schemaView = schemaView;
  }

  /** Creates a new, empty store at `path`, overwriting any existing file. Used while capturing a Txn's
   * changes. `db` is the db those changes are being captured from; `schemaView` classifies each captured
   * instance's embedding ownership (see [[getOwners]]/[[getOwnerKind]]).
   */
  public static createNew(path: string, db: AnyDb, schemaView: SchemaView): RebaseInstanceStore {
    const store = new RebaseInstanceStore(true, db, schemaView);
    store._db.createDb(path, undefined, { skipFileCheck: true, rawSQLite: true });
    store._db.executeSQL(`CREATE TABLE ${tableName} (
      [instanceKey] TEXT PRIMARY KEY,
      [old] TEXT,
      [new] TEXT,
      [changedProperties] TEXT,
      [instanceId] TEXT NOT NULL,
      [classFullName] TEXT NOT NULL,
      [operation] TEXT NOT NULL,
      [isIndirect] INTEGER NOT NULL,
      [owners] TEXT,
      [ownerKind] TEXT,
      [identityValues] TEXT,
      [navigationRefs] TEXT
    )`);
    return store;
  }

  /** Opens an existing store at `path` for reading. Used to replay a Txn's previously-captured changes. */
  public static openExisting(path: string): RebaseInstanceStore {
    const store = new RebaseInstanceStore(false);
    store._db.openDb(path, { openMode: OpenMode.Readonly, skipFileCheck: true, rawSQLite: true });
    return store;
  }

  /** Opens an existing store at `path` for reading *and* writing. Used by [[InteractiveRebase]] - unlike
   * the automatic "semantic rebase" replay via [[openExisting]], it needs to load a node's captured
   * `old`/`new` change on demand well after replay itself has finished (interactive conflict resolution
   * can happen an arbitrary amount of time later), so the store is kept open for that whole lifetime
   * rather than just for the initial replay.
   */
  public static openForReplay(path: string): RebaseInstanceStore {
    const store = new RebaseInstanceStore(true);
    store._db.openDb(path, { openMode: OpenMode.ReadWrite, skipFileCheck: true, rawSQLite: true });
    return store;
  }

  /** Persists writes (when created via [[createNew]]) before closing; readonly stores are simply closed. */
  public [Symbol.dispose](): void {
    this._db.closeDb(this._writable);
  }

  /** Merges a single row from a [ChangesetReader]($backend) - possibly one of several tables mapped
   * to the same EC instance - into that instance's old and/or new snapshot.
   */
  public appendChange(source: ChangeSource): void {
    const instanceKey = source.inserted?.$meta?.instanceKey ?? source.deleted?.$meta?.instanceKey;
    assert(instanceKey !== undefined, "$meta.instanceKey must be defined.");
    assert(source.inserted?.$meta?.instanceKey === undefined || source.deleted?.$meta?.instanceKey === undefined || source.inserted?.$meta?.instanceKey === source.deleted?.$meta?.instanceKey, "Instance keys must match if both inserted and deleted instances are defined.");

    const change = this.get(instanceKey) ?? { instanceKey };

    if (source.op === "Updated") {
      assert(source.inserted !== undefined, "Inserted instance must be defined for an update operation.");
      assert(source.deleted !== undefined, "Deleted instance must be defined for an update operation.");

      this.seedBaselineIfNeeded(source, change);
      assert(change.new !== undefined, "seedBaselineIfNeeded should set the `new` instance.");
      assert(change.old !== undefined, "seedBaselineIfNeeded should set the `old` instance.");
      change.new = RebaseInstanceStore.combine(change.new, source.inserted);
      change.old = RebaseInstanceStore.combine(change.old, source.deleted);

      const priorChanged = change.changedProperties ?? [];
      const changedNow = Object.keys(source.inserted).filter((prop) => prop !== "$meta");
      change.changedProperties = [...new Set([...priorChanged, ...changedNow])];
    } else if (source.op === "Inserted") {
      assert(source.inserted !== undefined, "Inserted instance must be defined for an insert operation.");
      assert(source.deleted === undefined, "Deleted instance must not be defined for an insert operation.");
      change.new = change.new ? RebaseInstanceStore.combine(change.new, source.inserted) : { ...source.inserted };
    } else if (source.op === "Deleted") {
      assert(source.deleted !== undefined, "Deleted instance must be defined for a delete operation.");
      assert(source.inserted === undefined, "Inserted instance must not be defined for a delete operation.");
      change.old = change.old ? RebaseInstanceStore.combine(change.old, source.deleted) : { ...source.deleted };
    }

    this.set(change);
  }

  public get(instanceKey: string): RebaseInstanceChange | undefined {
    return this._db.withPreparedSqliteStatement(
      `SELECT [old], [new], [changedProperties] FROM ${tableName} WHERE [instanceKey]=?`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, instanceKey);
        if (stmt.step() === DbResult.BE_SQLITE_ROW) {
          return {
            instanceKey,
            old: stmt.isValueNull(0) ? undefined : JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangeInstance,
            new: stmt.isValueNull(1) ? undefined : JSON.parse(stmt.getValueString(1), Base64EncodedString.reviver) as ChangeInstance,
            changedProperties: stmt.isValueNull(2) ? undefined : JSON.parse(stmt.getValueString(2)) as string[],
          };
        }
        return undefined;
      },
    );
  }

  public set(change: RebaseInstanceChange): void {
    // `id`/`classFullName` are identical on `old` and `new` (both snapshot the same instance), so either
    // suffices; `new ?? old` covers every operation (Insert has no `old`, Delete has no `new`).
    const props = change.new ?? change.old;
    assert(props !== undefined, "a RebaseInstanceChange must have at least one of old/new");
    const operation: RebaseInstanceOperation = change.new === undefined ? "Delete" : change.old === undefined ? "Insert" : "Update";
    const isIndirect = change.new?.$meta.isIndirectChange === true || change.old?.$meta.isIndirectChange === true;

    assert(this._schemaView !== undefined, "set() requires a store created via createNew");
    // Ownership is taken from `new` when present (Insert/Update), falling back to `old` only for a pure
    // Delete - this is what makes reparenting correct (see [[InteractiveRebase.buildDependencyForest]]).
    const ownerKind = this.getOwnerKind(this._schemaView, props.classFullName);
    // A model can be its own parent model (e.g. the RepositoryModel).
    const owners = this.getOwners(this._schemaView, props.classFullName, props).filter((owner) => owner.kind !== ownerKind || owner.id !== props.id);

    // Computed fully from the final merged `old`/`new` (not recomputed incrementally per partial-table
    // merge), matching how `owners`/`ownerKind` are already handled above - see
    // [[InteractiveRebase.orderNodes]] for how these are consumed.
    const identityValues = this.extractIdentityValues(props.classFullName, change.old, change.new);
    const navigationRefs = this.getNavigationRefs(this._schemaView, props.classFullName, change.old, change.new);

    this._db.withPreparedSqliteStatement(
      `INSERT INTO ${tableName} ([instanceKey], [old], [new], [changedProperties], [instanceId], [classFullName], [operation], [isIndirect], [owners], [ownerKind], [identityValues], [navigationRefs])
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT ([instanceKey])
       DO UPDATE SET
         [old] = [excluded].[old], [new] = [excluded].[new], [changedProperties] = [excluded].[changedProperties],
         [instanceId] = [excluded].[instanceId], [classFullName] = [excluded].[classFullName], [operation] = [excluded].[operation],
         [isIndirect] = [excluded].[isIndirect], [owners] = [excluded].[owners], [ownerKind] = [excluded].[ownerKind],
         [identityValues] = [excluded].[identityValues], [navigationRefs] = [excluded].[navigationRefs]`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, change.instanceKey);
        stmt.maybeBindString(2, change.old ? JSON.stringify(change.old, Base64EncodedString.replacer) : undefined);
        stmt.maybeBindString(3, change.new ? JSON.stringify(change.new, Base64EncodedString.replacer) : undefined);
        stmt.maybeBindString(4, change.changedProperties ? JSON.stringify(change.changedProperties) : undefined);
        stmt.bindString(5, props.id);
        stmt.bindString(6, props.classFullName);
        stmt.bindString(7, operation);
        stmt.bindInteger(8, isIndirect ? 1 : 0);
        stmt.maybeBindString(9, owners.length > 0 ? JSON.stringify(owners) : undefined);
        stmt.maybeBindString(10, ownerKind);
        stmt.maybeBindString(11, identityValues ? JSON.stringify(identityValues) : undefined);
        stmt.maybeBindString(12, navigationRefs ? JSON.stringify(navigationRefs) : undefined);
        stmt.step();
      },
    );
  }

  /** The kind of embedding owner an instance of `classFullName` can be, or undefined if it is neither an Element nor a Model. */
  private getOwnerKind(schemaView: SchemaView, classFullName: string): RebaseOwnerKind | undefined {
    const schemaClass = schemaView.findClass(classFullName);
    if (schemaClass?.is("BisCore:Element"))
      return "element";
    if (schemaClass?.is("BisCore:Model"))
      return "model";
    if (schemaClass?.isMixin())
      return this.getMixinOwnerKind(schemaView, schemaClass.fullName);
    return undefined;
  }

  /** A mixin (e.g. `BisCore:ISubModeledElement`) doesn't derive from the class it applies to, and SchemaView doesn't
   * expose its `AppliesToEntityClass`, so infer its kind from the entity classes that apply it. */
  private getMixinOwnerKind(schemaView: SchemaView, mixinFullName: string): RebaseOwnerKind | undefined {
    if (this._mixinOwnerKinds.has(mixinFullName))
      return this._mixinOwnerKinds.get(mixinFullName);

    let kind: RebaseOwnerKind | undefined;
    for (const schema of schemaView.getSchemas()) {
      for (const schemaClass of schema.getClasses()) {
        if (!schemaClass.isEntity() || !schemaClass.is(mixinFullName))
          continue;
        kind = schemaClass.is("BisCore:Element") ? "element" : schemaClass.is("BisCore:Model") ? "model" : undefined;
        break;
      }
      if (kind !== undefined)
        break;
    }
    this._mixinOwnerKinds.set(mixinFullName, kind);
    return kind;
  }

  /**
   * Given a classFullName, gets the class's navigation properties that point to an embedding owner, along with
   * the kind of owner each points to. For example, an aspect has `"element"`; an Element has `"parent"` (an
   * Element) and `"model"` (a Model); and a Model has `"parentModel"` (a Model) and `"modeledElement"` (an
   * Element, via the `strengthDirection="Backward"` `ModelModelsElement`).
   */
  private getEmbeddingOwnerProperties(schemaView: SchemaView, classFullName: string): { jsName: string, kind: RebaseOwnerKind }[] {
    const cached = this._embeddingOwnerProperties.get(classFullName);
    if (cached !== undefined)
      return cached;

    const ownerProps: { jsName: string, kind: RebaseOwnerKind }[] = [];
    for (const prop of schemaView.findClass(classFullName)?.getProperties() ?? []) {
      if (!prop.isNavigation())
        continue;
      const relationship = prop.relationshipClass;
      if (relationship.strength !== StrengthType.Embedding)
        continue;
      // The property points at the owner only when it points against the relationship's strength direction.
      if (prop.direction === relationship.strengthDirection)
        continue;
      const ownerConstraint = prop.direction === StrengthDirection.Backward ? relationship.source : relationship.target;
      const ownerConstraintClass = ownerConstraint?.abstractConstraint?.fullName ?? ownerConstraint?.constraintClasses[0]?.fullName;
      const kind = ownerConstraintClass === undefined ? undefined : this.getOwnerKind(schemaView, ownerConstraintClass);
      if (kind !== undefined)
        ownerProps.push({ jsName: ECJsNames.toJsName(prop.name), kind });
    }
    this._embeddingOwnerProperties.set(classFullName, ownerProps);
    return ownerProps;
  }

  /** Extracts every embedding owner referenced by `props` (see [[getEmbeddingOwnerProperties]]). */
  private getOwners(schemaView: SchemaView, classFullName: string, props: ChangeInstance): RebaseOwnerRef[] {
    const owners: RebaseOwnerRef[] = [];
    for (const { jsName, kind } of this.getEmbeddingOwnerProperties(schemaView, classFullName)) {
      const navValue = props[jsName];
      const navId = typeof navValue === "string" ? navValue : (typeof navValue?.id === "string" ? navValue.id : Id64.invalid);
      if (Id64.isValidId64(navId))
        owners.push({ kind, id: navId });
    }
    return owners;
  }

  /** The composite old/new value of every schema-declared UNIQUE constraint applicable to
   * `classFullName` (see [[getIdentityGroups]]) - values are omitted for a group where `old`/`new`
   * doesn't set every one of the group's properties, since SQLite does not consider a `NULL`-containing
   * row to collide with another under a UNIQUE index (confirmed via `DbIndexList`'s
   * `"Where":"IndexedColumnsAreNotNull"`). Returns undefined if `classFullName` has no UNIQUE
   * constraints, or none of them have a defined `old`/`new` value.
   */
  private extractIdentityValues(classFullName: string, old: ChangeInstance | undefined, newInstance: ChangeInstance | undefined): RebaseIdentityValue[] | undefined {
    const groups = this.getIdentityGroups(classFullName);
    if (groups.length === 0)
      return undefined;

    const values: RebaseIdentityValue[] = [];
    for (const group of groups) {
      const oldValue = this.computeCompositeValue(group.propsAccessStrings, old);
      const newValue = this.computeCompositeValue(group.propsAccessStrings, newInstance);
      if (oldValue === undefined && newValue === undefined)
        continue;
      values.push({ key: group.key, old: oldValue, new: newValue, accessString: group.deferAccessString, placeholderKind: group.deferKind });
    }
    return values.length > 0 ? values : undefined;
  }

  /** Joins each of `propsAccessStrings`' values (read from `props`) with `"|"`, or undefined if `props`
   * is undefined or any of them is unset (see [[extractIdentityValues]]).
   */
  private computeCompositeValue(propsAccessStrings: string[], props: ChangeInstance | undefined): string | undefined {
    if (props === undefined)
      return undefined;
    const values: string[] = [];
    for (const accessString of propsAccessStrings) {
      const value = RebaseInstanceStore.getPropertyValue(props, accessString);
      if (value === undefined || value === null || value === "")
        return undefined;
      values.push(String(value));
    }
    return values.join("|");
  }

  /** Reads the value identified by a (possibly dotted) access string, e.g. `code.value`. */
  private static getPropertyValue(props: ChangeInstance, accessString: string): any {
    let value: any = props;
    for (const token of accessString.split(".")) {
      if (value === undefined || value === null)
        return undefined;
      value = value[token];
    }
    return value;
  }

  /** Discovers every schema-declared UNIQUE constraint applicable to `classFullName` - declared either
   * directly on it or on any base class - combining single-property (`ECDbMap:PropertyMap.IsUnique`) and
   * composite (`ECDbMap:DbIndexList` entries with `IsUnique === true` - `DbIndexList.Indexes` also holds
   * ordinary, non-unique indexes, which are filtered out here) declarations via ECSQL queries against the
   * built-in `ECDbMeta` schema's `PropertyCustomAttribute`/`ClassCustomAttribute` view classes - see the
   * `orderroots-topological-redesign` design notes for the queries this was verified against. Results are
   * deduplicated by normalized (sorted) access-string set, since BisCore declares `FederationGuid`'s
   * uniqueness via BOTH mechanisms simultaneously (its own `PropertyMap` AND a single-property entry in
   * `Element`'s `DbIndexList`), which would otherwise produce two identical groups for the same
   * constraint. Self-declared constraints are always found (an explicit `= classId` check, independent of
   * whether `ClassHasAllBaseClasses` itself includes a self-row), in addition to every base class's.
   * Queried once per class and cached.
   */
  private getIdentityGroups(classFullName: string): IdentityConstraintGroup[] {
    const cached = this._identityGroupsByClass.get(classFullName);
    if (cached !== undefined)
      return cached;

    assert(this._sourceDb !== undefined, "getIdentityGroups requires a store created via createNew");
    const [schemaName, className] = classFullName.split(":");

    const rawGroups: string[][] = [];
    const seenKeys = new Set<string>();
    const addRawGroup = (accessStrings: string[]): void => {
      const key = [...accessStrings].sort().join(",");
      if (seenKeys.has(key))
        return;
      seenKeys.add(key);
      rawGroups.push(accessStrings);
    };

    const classIdSubquery = `SELECT c.ECInstanceId FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON c.Schema.Id = s.ECInstanceId WHERE c.Name = ? AND s.Name = ?`;
    const baseClassIdsSubquery = `SELECT base.TargetECInstanceId FROM meta.ECClassDef derived JOIN meta.ECSchemaDef derivedSchema ON derived.Schema.Id = derivedSchema.ECInstanceId JOIN meta.ClassHasAllBaseClasses base ON base.SourceECInstanceId = derived.ECInstanceId WHERE derived.Name = ? AND derivedSchema.Name = ?`;

    this._sourceDb.withPreparedStatement(
      `SELECT p.Name propName, ca.Instance instanceJson FROM meta.PropertyCustomAttribute ca
         JOIN meta.ECPropertyDef p ON ca.Property.Id = p.ECInstanceId
         JOIN meta.ECClassDef caClass ON ca.CustomAttributeClass.Id = caClass.ECInstanceId
       WHERE caClass.Name = 'PropertyMap' AND (p.Class.Id = (${classIdSubquery}) OR p.Class.Id IN (${baseClassIdsSubquery}))`,
      (stmt) => {
        stmt.bindString(1, className);
        stmt.bindString(2, schemaName);
        stmt.bindString(3, className);
        stmt.bindString(4, schemaName);
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const row = stmt.getRow();
          if (JSON.parse(row.instanceJson).PropertyMap?.IsUnique === true)
            addRawGroup([row.propName]);
        }
      },
    );

    this._sourceDb.withPreparedStatement(
      `SELECT ca.Instance instanceJson FROM meta.ClassCustomAttribute ca
         JOIN meta.ECClassDef caClass ON ca.CustomAttributeClass.Id = caClass.ECInstanceId
       WHERE caClass.Name = 'DbIndexList' AND (ca.Class.Id = (${classIdSubquery}) OR ca.Class.Id IN (${baseClassIdsSubquery}))`,
      (stmt) => {
        stmt.bindString(1, className);
        stmt.bindString(2, schemaName);
        stmt.bindString(3, className);
        stmt.bindString(4, schemaName);
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const row = stmt.getRow();
          const indexes = JSON.parse(row.instanceJson).DbIndexList?.Indexes ?? [];
          for (const index of indexes) {
            if (index.IsUnique === true && Array.isArray(index.Properties) && index.Properties.length > 0)
              addRawGroup(index.Properties);
          }
        }
      },
    );

    const groups = rawGroups.map((accessStrings) => this.buildIdentityConstraintGroup(classFullName, accessStrings));
    this._identityGroupsByClass.set(classFullName, groups);
    return groups;
  }

  /** Converts one discovered raw group of EC access strings (e.g. `["CodeSpec.Id", "CodeScope.Id",
   * "CodeValue"]`) into an [[IdentityConstraintGroup]]: its stable `key`, each member's props access
   * string, and which single member [[breakCycle]] should defer if this group participates in an
   * ordering cycle - preferring a GUID-typed property (a fresh `Guid.createValue()` is always safe),
   * falling back to the group's last property otherwise (matching the pre-generalization convention of
   * deferring `code.value`, the last of the Code triple's three properties).
   */
  private buildIdentityConstraintGroup(classFullName: string, ecAccessStrings: string[]): IdentityConstraintGroup {
    const key = [...ecAccessStrings].sort().join(",");
    const propsAccessStrings = ecAccessStrings.map((accessString) => this.getPropsAccessString(classFullName, accessString));

    let deferIndex = ecAccessStrings.length - 1;
    let deferKind: "guid" | "string" = "string";
    for (let i = 0; i < ecAccessStrings.length; i++) {
      if (this.isGuidProperty(classFullName, ecAccessStrings[i])) {
        deferIndex = i;
        deferKind = "guid";
        break;
      }
    }

    return { key, propsAccessStrings, deferAccessString: propsAccessStrings[deferIndex], deferKind };
  }

  /** True if the schema property named by the first segment of `ecAccessString` (e.g. `FederationGuid`
   * for `"FederationGuid"`, or `CodeSpec` for `"CodeSpec.Id"`) is a GUID-typed primitive
   * (`ExtendedTypeName === "BeGuid"`) - used to pick a safe placeholder kind for [[breakCycle]].
   */
  private isGuidProperty(classFullName: string, ecAccessString: string): boolean {
    const propName = ecAccessString.split(".")[0];
    const prop = this._schemaView?.findClass(classFullName)?.getProperty(propName);
    return prop !== undefined && prop.isPrimitive() && prop.extendedTypeName?.toLowerCase() === "beguid";
  }

  /** Translates a raw EC access string declared by a UNIQUE constraint (e.g. `"CodeSpec.Id"`, a
   * composite index's literal reference to a navigation property's `Id` column, or plain property names
   * like `"FederationGuid"`/`"CodeValue"`) into the access string identifying the same value in the
   * `ChangeInstance`/props shape (e.g. `"code.spec"`, `"federationGuid"`, `"code.value"`) - via
   * `ECJsNames.toJsName` (schema name -> ECSql instance access string) followed by
   * [[Entity.toPropsAccessString]] (instance access string -> props access string), the same two-step
   * translation [[InteractiveRebase.findBrokenRelationships]] already performs for navigation properties.
   * A `<NavProperty>.Id` reference collapses to just the navigation property's own (lowered) name -
   * that's how a navigation property's id is actually read off a `ChangeInstance`/props object (never
   * nested under a `.id` member at this level), matching how `CodeSpec`/`CodeScope` (themselves
   * navigation properties, not struct members of some `Code` struct) are handled elsewhere in this file.
   */
  private getPropsAccessString(classFullName: string, ecAccessString: string): string {
    const tokens = ecAccessString.split(".");
    let instanceAccessString: string;
    if (tokens.length === 2 && tokens[1] === "Id" && this._schemaView?.findClass(classFullName)?.getProperty(tokens[0])?.isNavigation())
      instanceAccessString = ECJsNames.toJsName(tokens[0]);
    else
      instanceAccessString = ECJsNames.toJsName(ecAccessString);

    // Only an IModelDb (not a plain ECDb) has registered `Entity` subclasses to consult for a relocated
    // props access string - an ECDb-backed store (never used in production, only conceivably in tests)
    // falls back to the identity mapping, which is correct for any class with no such relocation anyway.
    const sourceDb = this._sourceDb as { getJsClass?: (classFullName: string) => { toPropsAccessString(accessString: string): string } };
    if (typeof sourceDb?.getJsClass !== "function")
      return instanceAccessString;
    try {
      return sourceDb.getJsClass(classFullName).toPropsAccessString(instanceAccessString);
    } catch {
      return instanceAccessString;
    }
  }

  /** Reads the id a navigation property (`jsName`) refers to, or undefined if unset/invalid - matching
   * [[InteractiveRebase.findBrokenRelationships]]'s own navigation-value parsing.
   */
  private getReferencedId(props: ChangeInstance, jsName: string): Id64String | undefined {
    const navValue = props[jsName];
    const navId = typeof navValue === "string" ? navValue : (typeof navValue?.id === "string" ? navValue.id : undefined);
    return typeof navId === "string" && Id64.isValidId64(navId) ? navId : undefined;
  }

  /** The navigation properties declared by `classFullName` (the same enumeration
   * [[InteractiveRebase.findBrokenRelationships]] uses), as the `jsName` each is read/written by plus
   * whether it's nullable - i.e. whether the relationship's constraint on the *other* side (the side
   * [[InteractiveRebase.findBrokenRelationships]] queries for existence) has a multiplicity lower bound
   * of 0. Empty for a relationship (link-table) class - BIS deliberately gives those no real foreign key
   * into `bis_Element`, so no existence edge could ever be needed for one. Cached per class since [[set]]
   * would otherwise re-resolve the same schema lookups once per instance of the same class.
   */
  private getNavigationProperties(schemaView: SchemaView, classFullName: string): { jsName: string, nullable: boolean, targetKind?: RebaseOwnerKind }[] {
    const cached = this._navigationPropertiesByClass.get(classFullName);
    if (cached !== undefined)
      return cached;

    const navProperties: { jsName: string, nullable: boolean, targetKind?: RebaseOwnerKind }[] = [];
    const schemaClassDef = schemaView.findClass(classFullName);
    if (schemaClassDef !== undefined && !schemaClassDef.isRelationship()) {
      for (const prop of schemaClassDef.getProperties()) {
        if (!prop.isNavigation())
          continue;
        const jsName = ECJsNames.toJsName(prop.name);
        const relConstraint = prop.direction === StrengthDirection.Backward ? prop.relationshipClass.source : prop.relationshipClass.target;
        const targetClass = relConstraint?.abstractConstraint?.fullName ?? relConstraint?.constraintClasses[0]?.fullName;
        const targetKind = targetClass === undefined ? undefined : this.getOwnerKind(schemaView, targetClass);
        navProperties.push({ jsName, nullable: relConstraint === undefined || relConstraint.multiplicityLower === 0, targetKind });
      }
    }
    this._navigationPropertiesByClass.set(classFullName, navProperties);
    return navProperties;
  }

  /** One entry per navigation property declared on `classFullName` (see [[getNavigationProperties]]),
   * with the id each of `old`/`new` references (if any) - or undefined if `classFullName` has no
   * navigation properties (including every relationship class) - see
   * [[RebaseInstanceMetadata.navigationRefs]].
   */
  private getNavigationRefs(schemaView: SchemaView, classFullName: string, old: ChangeInstance | undefined, newInstance: ChangeInstance | undefined): RebaseNavigationRef[] | undefined {
    const navProperties = this.getNavigationProperties(schemaView, classFullName);
    if (navProperties.length === 0)
      return undefined;

    return navProperties.map(({ jsName, nullable, targetKind }) => ({
      jsName,
      nullable,
      targetKind,
      oldId: old !== undefined ? this.getReferencedId(old, jsName) : undefined,
      newId: newInstance !== undefined ? this.getReferencedId(newInstance, jsName) : undefined,
    }));
  }

  /** Iterate over every captured instance's old/new snapshot pair. */
  public *all(): IterableIterator<RebaseInstanceChange> {
    using stmt = this._db.prepareSqliteStatement(`SELECT [instanceKey], [old], [new], [changedProperties] FROM ${tableName} ORDER BY [instanceKey]`);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      yield {
        instanceKey: stmt.getValueString(0),
        old: stmt.isValueNull(1) ? undefined : JSON.parse(stmt.getValueString(1), Base64EncodedString.reviver) as ChangeInstance,
        new: stmt.isValueNull(2) ? undefined : JSON.parse(stmt.getValueString(2), Base64EncodedString.reviver) as ChangeInstance,
        changedProperties: stmt.isValueNull(3) ? undefined : JSON.parse(stmt.getValueString(3)) as string[],
      };
    }
  }

  /**
   * Iterate over every captured instance's metadata (id, class, operation, ownership) without parsing
   * its `old`/`new` snapshots, which can be quite large compared to the metadata.
   */
  public *allMetadata(): IterableIterator<RebaseInstanceMetadata> {
    using stmt = this._db.prepareSqliteStatement(
      `SELECT [instanceKey], [instanceId], [classFullName], [operation], [isIndirect], [owners], [ownerKind], [identityValues], [navigationRefs] FROM ${tableName} ORDER BY [instanceKey]`);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      yield {
        instanceKey: stmt.getValueString(0),
        id: stmt.getValueString(1),
        classFullName: stmt.getValueString(2),
        operation: stmt.getValueString(3) as RebaseInstanceOperation,
        isIndirect: stmt.getValueBoolean(4),
        owners: stmt.isValueNull(5) ? [] : JSON.parse(stmt.getValueString(5)) as RebaseOwnerRef[],
        ownerKind: stmt.getValueStringMaybe(6) as RebaseOwnerKind | undefined,
        identityValues: stmt.isValueNull(7) ? undefined : JSON.parse(stmt.getValueString(7)) as RebaseIdentityValue[],
        navigationRefs: stmt.isValueNull(8) ? undefined : JSON.parse(stmt.getValueString(8)) as RebaseNavigationRef[],
      };
    }
  }

  /**
   * Unlike inserts and deletes - which always carry every column - a changeset update only carries the
   * columns that actually changed. The first time we see a given instance, seed its old *and* new
   * snapshot with the instance's complete current row, so that merging in just the columns a changeset
   * update actually carries - from however many tables the instance spans - still leaves a complete
   * instance once every table's contribution has been merged in. Later tables' merges then only ever
   * overlay their own changed columns on top, so an already-corrected column is never clobbered by a
   * stale baseline value from a table that hasn't merged yet.
   */
  private seedBaselineIfNeeded(source: ChangeSource, change: RebaseInstanceChange): void {
    if (change.old !== undefined || change.new !== undefined)
      return;

    assert(undefined !== this._sourceDb, "appendChange requires a store created via createNew");
    assert(source.inserted !== undefined, "seedBaselineIfNeeded only applies to Updates, which should have an inserted instance");
    assert(source.deleted !== undefined, "seedBaselineIfNeeded only applies to Updates, which should have a deleted instance");

    const baseline = this._sourceDb[_nativeDb].readInstance({ id: source.inserted.id, classFullName: source.inserted.classFullName }, { useJsNames: true }) as ECSqlRow;
    change.old = { ...baseline, $meta: { ...source.deleted.$meta } };
    change.new = { ...baseline, $meta: { ...source.inserted.$meta } };
  }

  /**
   * Merge partial per-table properties for the same instance/stage into a single snapshot.
   * Mirrors `PartialChangeUnifier`'s private `combine`, but operates on one old/new snapshot rather
   * than a generic keyed cache.
   */
  private static combine(lhs: ChangeInstance, rhs: ChangeInstance): ChangeInstance {
    assert(lhs.$meta.instanceKey === rhs.$meta.instanceKey);

    const { $meta: _rhsMeta, ...rhsData } = rhs;
    Object.assign(lhs, rhsData);
    lhs.$meta.tables.push(...rhs.$meta.tables);
    lhs.$meta.changeIndexes.push(...rhs.$meta.changeIndexes);
    lhs.$meta.isIndirectChange = lhs.$meta.isIndirectChange && rhs.$meta.isIndirectChange;
    for (const propName of rhs.$meta.changeFetchedPropNames) {
      if (!lhs.$meta.changeFetchedPropNames.includes(propName))
        lhs.$meta.changeFetchedPropNames.push(propName);
    }
    return lhs;
  }
}
