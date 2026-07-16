/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module SQLiteDb
 */

import * as semver from "semver";
import { CloudSqlite } from "./CloudSqlite";
import { SQLiteDb, VersionedSqliteDb } from "./SQLiteDb";
import { BriefcaseDb, IModelDb } from "./IModelDb";
import { DbResult, Guid, GuidString, Id64, Id64String, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, Code, CodeProps, DefinitionError, FilePropertyProps, IModelError, LocalFileName, SchemaImportReservationError } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelNative } from "./internal/NativePlatform";
import { _implicitTxn, _nativeDb } from "./internal/Symbols";
import { SchemaImportIdentity } from "./SharedSchemaReservations";

/** @internal */
export namespace SchemaSync {
  const lockParams: CloudSqlite.ObtainLockParams = { retryDelayMs: 1000, nRetries: 30 };
  const definitionElementsTableName = "definition_elements";
  const schemaReservationsTableName = "schema_reservations";
  const schemaReservationRangesTableName = "schema_reservation_ranges";
  const maxLocalIdExclusive = 0x10000000000; // 2^40
  const idSequenceProp: FilePropertyProps = { namespace: "schemasync", name: "nextDefinitionLocalId" };
  const lastReservedIdNamespace = "schemasync";

  /** Identifies a DefinitionElement to be reserved in a `SchemaSyncDb`. @internal */
  export interface ProposedDefinition {
    /** When omitted, the reservation is resolved (or created) by Code instead. */
    readonly federationGuid?: GuidString;
    readonly ecClassId: Id64String;
    readonly code: Code;
    readonly isCategory?: boolean;
  }
  interface ProposedDefinitionWithFedGuid extends ProposedDefinition {
    readonly federationGuid: GuidString;
  }

  /** A DefinitionElement reservation that has been persisted in a `SchemaSyncDb`. @internal */
  interface ReservedDefinition extends ProposedDefinitionWithFedGuid {
    readonly elementId: Id64String;
  }

  /** A reserved id range for one `ec_*` table. @internal */
  export interface SchemaIdRange {
    readonly startId: number;
    readonly count: number;
  }

  /** A persisted schema-import reservation. @internal */
  export interface SchemaReservation {
    readonly baseFingerprint: string;
    /** Reserved id ranges, keyed by `ec_*` table name (e.g. `"ec_Class"`). */
    readonly ranges: Map<string, SchemaIdRange>;
  }

  export interface ReadMethods {
    /**
     * Look up an existing DefinitionElement reservation by federationGuid or Code.
     * When a `Code` is supplied, returns `undefined` for empty `codeValue`s (they are not unique).
     */
    findReservedDefinition(key: GuidString | CodeProps): ReservedDefinition | undefined;
    /** Look up a schema-import reservation by identity. Returns `undefined` if not found. */
    findSchemaReservation(identity: SchemaImportIdentity): SchemaReservation | undefined;
  }

  export interface WriteMethods {
    /** Reserve the specified DefinitionElements in the `SchemaSyncDb`.  Throws if any of the requested reservations conflict with existing reservations. */
    reserveDefinitionElements(identities: ProposedDefinition[]): Promise<void>;
    /**
     * Reserve id ranges for importing a specific schema version.
     * Idempotent: if a matching reservation already exists, returns the stored ranges.
     * @throws [[SchemaImportReservationError]] on conflict (same identity, different counts) or counter exhaustion.
     */
    reserveSchemaImport(identity: SchemaImportIdentity, perTableCounts: Record<string, number>, baseFingerprint: string): Promise<void>;
  }

  /** A CloudSqlite database for synchronizing schema changes across briefcases.  */
  export class SchemaSyncDb extends VersionedSqliteDb implements ReadMethods, WriteMethods {
    private _supportsDefinitions?: boolean;
    private _supportsSchemaReservations?: boolean;
    public override readonly myVersion = "4.2.0";
    protected override createDDL() {
      this.ensureDefinitionElementsTable();
      this.ensureSchemaReservationTables();
    }

    public override openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: CloudSqlite.CloudContainer) {
      super.openDb(dbName, openMode, container);
      const minRequiredVersion = semver.minVersion(this.getRequiredVersions().readVersion) ?? "0.0.0";
      this._supportsDefinitions = semver.lte(this.myVersion, minRequiredVersion);
      this._supportsSchemaReservations = semver.lte(this.myVersion, minRequiredVersion);
    }

    private ensureDefinitionElementsTable(): void {
      if (this._supportsDefinitions)
        return;

      this.executeSQL(`
        CREATE TABLE IF NOT EXISTS ${definitionElementsTableName} (
          federationGuid BLOB    PRIMARY KEY,
          elementId      INTEGER NOT NULL UNIQUE,
          ecClassId      INTEGER NOT NULL,
          codeSpecId     INTEGER NOT NULL,
          codeScope      TEXT NOT NULL,
          codeValue      TEXT COLLATE NOCASE
        )`);
      this.executeSQL(`CREATE UNIQUE INDEX IF NOT EXISTS idx_def_elem_code  ON ${definitionElementsTableName}(codeSpecId, codeScope, codeValue)`);
      const minVersion = `^${this.myVersion}`;
      this.setRequiredVersions({ readVersion: minVersion, writeVersion: minVersion });
      this._supportsDefinitions = true;
    }

    public findReservedDefinition(key: GuidString | CodeProps): ReservedDefinition | undefined {
      if (!this._supportsDefinitions)
        return undefined;

      return (typeof key === "string") ? this._findByGuid(key) : this._findByCode(key);
    }

    private _findByGuid(federationGuid: GuidString): ReservedDefinition | undefined {
      return this.withPreparedSqliteStatement(
        `SELECT elementId, ecClassId, codeSpecId, codeScope, codeValue FROM ${definitionElementsTableName} WHERE federationGuid=?`,
        (stmt) => {
          stmt.bindGuid(1, federationGuid);
          if (!stmt.nextRow())
            return undefined;

          return {
            federationGuid,
            elementId: stmt.getValueId(0),
            ecClassId: stmt.getValueId(1),
            code: new Code({
              spec: stmt.getValueId(2),
              scope: stmt.getValueString(3),
              value: stmt.getValueStringMaybe(4),
            }),
          };
        },
      );
    }

    private _findByCode(code: CodeProps): ReservedDefinition | undefined {
      if (!code.value)
        return undefined;

      return this.withPreparedSqliteStatement(
        `SELECT federationGuid, elementId, ecClassId FROM ${definitionElementsTableName} WHERE codeSpecId=? AND codeScope=? AND codeValue=?`,
        (stmt) => {
          stmt.bindId(1, code.spec);
          stmt.bindString(2, code.scope);
          stmt.bindString(3, code.value ?? "");
          if (!stmt.nextRow())
            return undefined;

          return {
            federationGuid: stmt.getValueGuid(0),
            elementId: stmt.getValueId(1),
            ecClassId: stmt.getValueId(2),
            code: new Code(code),
          };
        },
      );
    }

    private insertReservedDefinition(id: ProposedDefinitionWithFedGuid, elementId: Id64String): void {
      this.withPreparedSqliteStatement(
        `INSERT INTO ${definitionElementsTableName} (federationGuid, elementId, ecClassId, codeSpecId, codeScope, codeValue) VALUES (?, ?, ?, ?, ?, ?)`,
        (stmt) => {
          stmt.bindGuid(1, id.federationGuid);
          stmt.bindId(2, elementId);
          stmt.bindId(3, id.ecClassId);
          stmt.bindId(4, id.code.spec);
          stmt.bindString(5, id.code.scope);
          if (id.code.value === "")
            stmt.bindNull(6);
          else
            stmt.bindString(6, id.code.value);
          stmt.stepForWrite();
        },
      );
    }

    public async reserveDefinitionElements(elements: ProposedDefinition[]): Promise<void> {
      this.ensureDefinitionElementsTable();

      // Insert new reservations as we go, so later entries in `elements` can dedupe against earlier ones
      // through the shared (still-uncommitted) transaction. The caller commits on success and abandons on error.
      let nextLocalId = this.getNextDefinitionLocalId();
      const firstLocalId = nextLocalId;

      for (const def of elements) {
        // Find a matching reservation: by guid when supplied, otherwise by code. If found, it must match.
        const existing = this.findReservedDefinition(def.federationGuid ?? def.code);
        if (existing) {
          if (!this.existingMatches(existing, { ...def, federationGuid: existing.federationGuid })) {
            DefinitionError.throwError("reservation-conflict", {
              message: `SchemaSync DefinitionElement reservation conflict for federationGuid ${existing.federationGuid}: existing row does not match requested class/code`,
              federationGuid: existing.federationGuid,
            });
          }
          continue;
        }

        if (!def.federationGuid && !def.code.value) {
          DefinitionError.throwError("invalid-definition", {
            message: "SchemaSync DefinitionElement reservation requires either a federationGuid or a non-empty code value",
          });
        }

        const elementId = Id64.fromLocalAndBriefcaseIds(nextLocalId, BriefcaseIdValue.SchemaSyncDefinitionReserved);
        this.insertReservedDefinition({ ...def, federationGuid: def.federationGuid ?? Guid.createValue() }, elementId);
        // skip a local id for each reserved category because category inserts always trigger a second insert for default subcategory
        nextLocalId += def.isCategory ? 2 : 1;
        if (nextLocalId >= maxLocalIdExclusive) {
          this.abandonChanges();
          DefinitionError.throwError("id-sequence-exhausted", { message: `SchemaSync DefinitionElement local-id sequence exhausted` });
        }
      }

      if (nextLocalId !== firstLocalId)
        this.setNextDefinitionLocalId(nextLocalId);
    }

    private existingMatches(existing: SchemaSync.ProposedDefinition, id: SchemaSync.ProposedDefinition): boolean {
      return existing.federationGuid === id.federationGuid
        && existing.ecClassId === id.ecClassId
        && existing.code.equals(id.code);
    }

    private getNextDefinitionLocalId(): number {
      const stored = this[_nativeDb].queryFileProperty(idSequenceProp, true) as string | undefined;
      const current = stored ? Number(stored) : 1;
      if (!Number.isInteger(current) || current < 1)
        DefinitionError.throwError("corrupt-reservation-data", { message: `Corrupt SchemaSync DefinitionElement local-id counter: '${stored}'` });

      return current;
    }

    private setNextDefinitionLocalId(next: number): void {
      this[_nativeDb].saveFileProperty(idSequenceProp, String(next));
    }

    // ---- Schema-import reservation methods ----

    private ensureSchemaReservationTables(): void {
      if (this._supportsSchemaReservations)
        return;

      this.executeSQL(`
        CREATE TABLE IF NOT EXISTS ${schemaReservationsTableName} (
          schemaName    TEXT    NOT NULL COLLATE NOCASE,
          versionMajor  INTEGER NOT NULL,
          versionMinor  INTEGER NOT NULL,
          versionPatch  INTEGER NOT NULL,
          baseFingerprint TEXT NOT NULL,
          PRIMARY KEY (schemaName, versionMajor, versionMinor, versionPatch)
        )`);

      this.executeSQL(`
        CREATE TABLE IF NOT EXISTS ${schemaReservationRangesTableName} (
          schemaName    TEXT    NOT NULL COLLATE NOCASE,
          versionMajor  INTEGER NOT NULL,
          versionMinor  INTEGER NOT NULL,
          versionPatch  INTEGER NOT NULL,
          tableName     TEXT    NOT NULL,
          startId       INTEGER NOT NULL,
          count         INTEGER NOT NULL,
          PRIMARY KEY (schemaName, versionMajor, versionMinor, versionPatch, tableName),
          FOREIGN KEY (schemaName, versionMajor, versionMinor, versionPatch)
            REFERENCES ${schemaReservationsTableName}(schemaName, versionMajor, versionMinor, versionPatch)
        )`);

      const minVersion = `^${this.myVersion}`;
      this.setRequiredVersions({ readVersion: minVersion, writeVersion: minVersion });
      this._supportsSchemaReservations = true;
    }

    public findSchemaReservation(identity: SchemaImportIdentity): SchemaReservation | undefined {
      if (!this._supportsSchemaReservations)
        return undefined;

      const header = this.withPreparedSqliteStatement(
        `SELECT baseFingerprint FROM ${schemaReservationsTableName} WHERE schemaName=? AND versionMajor=? AND versionMinor=? AND versionPatch=?`,
        (stmt) => {
          stmt.bindString(1, identity.schemaName);
          stmt.bindInteger(2, identity.versionMajor);
          stmt.bindInteger(3, identity.versionMinor);
          stmt.bindInteger(4, identity.versionPatch);
          if (!stmt.nextRow())
            return undefined;
          return { baseFingerprint: stmt.getValueString(0) };
        },
      );

      if (!header)
        return undefined;

      const ranges = new Map<string, SchemaIdRange>();
      this.withPreparedSqliteStatement(
        `SELECT tableName, startId, count FROM ${schemaReservationRangesTableName} WHERE schemaName=? AND versionMajor=? AND versionMinor=? AND versionPatch=?`,
        (stmt) => {
          stmt.bindString(1, identity.schemaName);
          stmt.bindInteger(2, identity.versionMajor);
          stmt.bindInteger(3, identity.versionMinor);
          stmt.bindInteger(4, identity.versionPatch);
          while (stmt.nextRow())
            ranges.set(stmt.getValueString(0), { startId: stmt.getValueDouble(1), count: stmt.getValueDouble(2) });
        },
      );

      return { baseFingerprint: header.baseFingerprint, ranges };
    }

    public async reserveSchemaImport(identity: SchemaImportIdentity, perTableCounts: Record<string, number>, baseFingerprint: string): Promise<void> {
      this.ensureSchemaReservationTables();

      const existing = this.findSchemaReservation(identity);
      if (existing) {
        // Idempotency: same counts → return stored ranges unchanged.
        const existingCounts: Record<string, number> = {};
        for (const [tbl, range] of existing.ranges)
          existingCounts[tbl] = range.count;

        const allMatch = Object.keys(perTableCounts).every((tbl) => (existingCounts[tbl] ?? 0) === perTableCounts[tbl])
          && Object.keys(existingCounts).every((tbl) => (perTableCounts[tbl] ?? 0) === existingCounts[tbl]);

        if (allMatch)
          return; // idempotent: already reserved with the same ranges

        SchemaImportReservationError.throwError("reservation-conflict", {
          message: `SchemaSync schema-import reservation conflict for '${identity.schemaName}' v${identity.versionMajor}.${identity.versionMinor}.${identity.versionPatch}: existing reservation has different per-table id counts`,
        });
      }

      // Insert header row
      this.withPreparedSqliteStatement(
        `INSERT INTO ${schemaReservationsTableName} (schemaName, versionMajor, versionMinor, versionPatch, baseFingerprint) VALUES (?, ?, ?, ?, ?)`,
        (stmt) => {
          stmt.bindString(1, identity.schemaName);
          stmt.bindInteger(2, identity.versionMajor);
          stmt.bindInteger(3, identity.versionMinor);
          stmt.bindInteger(4, identity.versionPatch);
          stmt.bindString(5, baseFingerprint);
          stmt.stepForWrite();
        },
      );

      // Allocate and insert per-table ranges
      for (const [tableName, count] of Object.entries(perTableCounts)) {
        if (count <= 0)
          continue;

        const lastId = this.getLastReservedId(tableName);
        const startId = lastId + 1;
        this.withPreparedSqliteStatement(
          `INSERT INTO ${schemaReservationRangesTableName} (schemaName, versionMajor, versionMinor, versionPatch, tableName, startId, count) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          (stmt) => {
            stmt.bindString(1, identity.schemaName);
            stmt.bindInteger(2, identity.versionMajor);
            stmt.bindInteger(3, identity.versionMinor);
            stmt.bindInteger(4, identity.versionPatch);
            stmt.bindString(5, tableName);
            stmt.bindDouble(6, startId);
            stmt.bindDouble(7, count);
            stmt.stepForWrite();
          },
        );
        this.setLastReservedId(tableName, lastId + count);
      }
    }

    private getLastReservedId(tableName: string): number {
      const prop: FilePropertyProps = { namespace: lastReservedIdNamespace, name: `lastReservedId.${tableName}` };
      const stored = this[_nativeDb].queryFileProperty(prop, true) as string | undefined;
      return stored ? Number(stored) : 0;
    }

    private setLastReservedId(tableName: string, id: number): void {
      const prop: FilePropertyProps = { namespace: lastReservedIdNamespace, name: `lastReservedId.${tableName}` };
      this[_nativeDb].saveFileProperty(prop, String(id));
    }
  }

  const syncProperty = { namespace: "itwinjs", name: "SchemaSync" };
  const defaultDbName = "SchemaSyncDb";
  const testSyncCachePropKey = "test.schema_sync.cache_name";
  // for tests only
  export const setTestCache = (iModel: IModelDb, cacheName?: string) => {
    if (cacheName)
      iModel[_nativeDb].saveLocalValue(testSyncCachePropKey, cacheName);
    else
      iModel[_nativeDb].deleteLocalValue(testSyncCachePropKey);
  };

  const sharedAccessByIModel = new Map<string, CloudAccess>();
  export const getCloudAccess = async (arg: IModelDb | { readonly fileName: LocalFileName }) => {
    let nativeDb: IModelJsNative.DgnDb | undefined;
    const argIsIModelDb = arg instanceof IModelDb;
    if (argIsIModelDb) {
      nativeDb = arg[_nativeDb];
    } else {
      nativeDb = new IModelNative.platform.DgnDb();
      nativeDb.openIModel(arg.fileName, OpenMode.Readonly);
    }

    const testSyncCache = nativeDb.queryLocalValue(testSyncCachePropKey);
    const propsString = nativeDb.queryFileProperty(syncProperty, true) as string | undefined;
    if (!propsString)
      throw new Error("iModel does not have a SchemaSyncDb");

    // Reuse the existing access for this container so there is only ever one CloudAccess per container (per cache).
    const sharedAccessKey = propsString + (testSyncCache ?? "");
    const cached = sharedAccessByIModel.get(sharedAccessKey);
    if (cached)
      return cached;

    try {
      const props = JSON.parse(propsString) as CloudSqlite.ContainerProps;
      const accessToken = await CloudSqlite.requestToken(props);
      const access = new CloudAccess({ ...props, accessToken });
      Object.assign(access.lockParams, lockParams);
      if (testSyncCache)
        access.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: testSyncCache }));
      sharedAccessByIModel.set(sharedAccessKey, access);
      return access;
    } finally {
      if (!argIsIModelDb) {
        nativeDb.closeFile();
      }
    }
  };

  export const withLockedAccess = async (iModel: IModelDb | { readonly fileName: LocalFileName }, args: { operationName: string, openMode?: OpenMode, user?: string }, operation: (access: CloudAccess) => Promise<void>): Promise<void> => {
    const access = await getCloudAccess(iModel);
    try {
      await access.withLockedDb(args, async () => operation(access));
    } finally {
      access.close();
    }
  };

  export const withReadonlyAccess = async (iModel: IModelDb | { readonly fileName: LocalFileName }, operation: (access: CloudAccess) => Promise<void>): Promise<void> => {
    const access = await getCloudAccess(iModel);
    access.synchronizeWithCloud();
    access.openForRead();
    try {
      await operation(access);
    } finally {
      access.close();
    }
  };

  export const isEnabled = (iModel: IModelDb) => {
    return iModel[_nativeDb].schemaSyncEnabled();
  };

  /** Synchronize local briefcase schemas with cloud container */
  export const pull = async (iModel: IModelDb) => {
    if (iModel[_nativeDb].schemaSyncEnabled() && !iModel.isReadonly) {
      await SchemaSync.withReadonlyAccess(iModel, async (syncAccess) => {
        const schemaSyncDbUri = syncAccess.getUri();
        iModel.clearCaches();
        iModel[_nativeDb].schemaSyncPull(schemaSyncDbUri);
        iModel[_implicitTxn].saveChanges("schema synchronized with cloud container");
      });
    }
  };

  export const initializeForIModel = async (arg: { iModel: IModelDb, containerProps: CloudSqlite.ContainerProps, overrideContainer?: boolean }) => {
    const props = { baseUri: arg.containerProps.baseUri, containerId: arg.containerProps.containerId, storageType: arg.containerProps.storageType }; // sanitize to only known properties
    const iModel = arg.iModel;
    const briefcase = iModel instanceof BriefcaseDb ? iModel : undefined;
    await iModel.acquireSchemaLock();
    if (briefcase) {
      if (briefcase.txns.hasLocalChanges) {
        throw new IModelError(DbResult.BE_SQLITE_ERROR, "Enabling SchemaSync for iModel failed. There are unsaved or un-pushed local changes.");
      }
      await briefcase.pullChanges();
    }
    try {
      iModel[_implicitTxn].saveFileProperty(syncProperty, JSON.stringify(props));
      await withLockedAccess(arg.iModel, { operationName: "initialize schemaSync", openMode: OpenMode.Readonly }, async (syncAccess) => {
        iModel[_nativeDb].schemaSyncInit(syncAccess.getUri(), props.containerId, arg.overrideContainer ?? false);
        iModel[_implicitTxn].saveChanges(`Enable SchemaSync  (container id: ${props.containerId})`);
      });
    } catch (err) {
      throw err;
    } finally {
      iModel[_implicitTxn].abandonChanges();
    }

    if (briefcase) {
      if (arg.overrideContainer)
        await briefcase.pushChanges({ description: `Overriding SchemaSync for iModel with container-id: ${props.containerId}` });
      else
        await briefcase.pushChanges({ description: `Enable SchemaSync for iModel with container-id: ${props.containerId}` });
    }

    await iModel.initializeSharedDefinitionReservations();
    await iModel.initializeSharedSchemaReservations();
  };

  /** Provides access to a cloud-based `SchemaSyncDb` to hold ECSchemas.  */
  export class CloudAccess extends CloudSqlite.DbAccess<SchemaSyncDb, ReadMethods, WriteMethods> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: SchemaSyncDb, props, dbName: defaultDbName });
    }

    public getUri() {
      return `${this.getCloudDb()[_nativeDb].getFilePath()}?vfs=${this.container.cache?.name}&writable=${this.container.isWriteable ? 1 : 0}`;
    }
    /**
   * Initialize a cloud container for use as a SchemaSync. The container must first be created via its storage supplier api (e.g. Azure, or AWS).
   * A valid sasToken that grants write access must be supplied. This function creates and uploads an empty ChannelDb into the container.
   * @note this deletes any existing content in the container.
   */
    public static async initializeDb(props: CloudSqlite.ContainerProps) {
      return super._initializeDb({ props, dbType: SchemaSyncDb, dbName: defaultDbName });
    }
  }
}
