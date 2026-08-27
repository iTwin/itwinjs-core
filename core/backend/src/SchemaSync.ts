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
import { BentleyError, ChangeSetStatus, DbResult, Guid, GuidString, Id64, Id64String, IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, Code, ElementReservationError, FilePropertyProps, IModelError, LocalFileName } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import type { BlobContainer } from "./BlobContainerService";
import { IModelNative } from "./internal/NativePlatform";
import { _implicitTxn, _nativeDb } from "./internal/Symbols";

/** @internal */
export namespace SchemaSync {
  /** How long a briefcase waits for another briefcase's schema import to finish before giving up.
   *
   * `nRetries` alone does not bound the wait: when the count runs out `CloudSqlite.withLockedDb` asks
   * `onFailure` what to do, and anything other than "stop" restarts the whole cycle. Without an
   * `onFailure` the caller waits forever with no way to give up, so this supplies one.
   */
  const lockParams: CloudSqlite.ObtainLockParams = {
    retryDelayMs: 6000,
    nRetries: 10,
    onFailure: async (lockedBy: string, expires: string) => {
      Logger.logInfo("SchemaSync", `schema sync container is held by ${lockedBy} until ${expires}; giving up`);
      return "stop";
    },
  };
  const reservedElementsTableName = "reserved_elements";
  const maxLocalIdExclusive = 0x10000000000; // 2^40
  const idSequenceProp: FilePropertyProps = { namespace: "schemasync", name: "nextReservedElementLocalId" };

  /** Identifies an element to be reserved in a `SchemaSyncDb`. @internal */
  export interface ProposedElementReservation {
    readonly federationGuid: GuidString;
    readonly ecClassId: Id64String;
    readonly code: Code;
    readonly isCategory?: boolean;
  }

  /** An element reservation that has been persisted in a `SchemaSyncDb`. @internal */
  export interface ReservedElement extends ProposedElementReservation {
    readonly elementId: Id64String;
  }

  export interface ReadMethods {
    /** Look up an existing element reservation by federationGuid. */
    findReservedElement(federationGuid: GuidString): ReservedElement | undefined;
  }

  export interface WriteMethods {
    /** Reserve the specified elements in the `SchemaSyncDb`. Throws if any requested reservation conflicts with an existing reservation. */
    reserveElements(identities: ProposedElementReservation[]): Promise<void>;
  }

  /** A CloudSqlite database for synchronizing schema changes across briefcases.  */
  export class SchemaSyncDb extends VersionedSqliteDb implements ReadMethods, WriteMethods {
    private _supportsReservations?: boolean;
    public override readonly myVersion = "5.0.0";
    protected override createDDL() {
      this.ensureReservedElementsTable();
    }

    public override openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: CloudSqlite.CloudContainer) {
      super.openDb(dbName, openMode, container);
      this._supportsReservations = semver.lte(this.myVersion, semver.minVersion(this.getRequiredVersions().readVersion) ?? "0.0.0");
    }

    private ensureReservedElementsTable(): void {
      if (this._supportsReservations)
        return;

      this.executeSQL(`
        CREATE TABLE IF NOT EXISTS ${reservedElementsTableName} (
          federationGuid BLOB    PRIMARY KEY,
          elementId      INTEGER NOT NULL UNIQUE,
          ecClassId      INTEGER NOT NULL,
          codeSpecId     INTEGER NOT NULL,
          codeScope      TEXT NOT NULL,
          codeValue      TEXT COLLATE NOCASE
        )`);
      this.executeSQL(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reserved_elem_code  ON ${reservedElementsTableName}(codeSpecId, codeScope, codeValue)`);
      const minVersion = `^${this.myVersion}`;
      this.setRequiredVersions({ readVersion: minVersion, writeVersion: minVersion });
      this._supportsReservations = true;
    }

    public findReservedElement(federationGuid: GuidString): ReservedElement | undefined {
      if (!this._supportsReservations)
        return undefined;

      return this.withPreparedSqliteStatement(
        `SELECT elementId, ecClassId, codeSpecId, codeScope, codeValue FROM ${reservedElementsTableName} WHERE federationGuid=?`,
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

    private insertReservedElement(id: ProposedElementReservation, elementId: Id64String): void {
      this.withPreparedSqliteStatement(
        `INSERT INTO ${reservedElementsTableName} (federationGuid, elementId, ecClassId, codeSpecId, codeScope, codeValue) VALUES (?, ?, ?, ?, ?, ?)`,
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

    public async reserveElements(elements: ProposedElementReservation[]): Promise<void> {
      this.ensureReservedElementsTable();

      // Insert new reservations as we go, so later entries in `elements` can dedupe against earlier ones
      // through the shared (still-uncommitted) transaction. The caller commits on success and abandons on error.
      let nextLocalId = this.getNextReservedElementLocalId();
      const firstLocalId = nextLocalId;

      for (const def of elements) {
        if (!def.federationGuid || !Guid.isGuid(def.federationGuid)) {
          ElementReservationError.throwError("invalid-reservation", {
            message: "Element reservation requires an explicit, valid federationGuid",
          });
        }

        // Identity is always the federationGuid. If a reservation already exists for it, it must match exactly.
        const existing = this.findReservedElement(def.federationGuid);
        if (existing) {
          if (!this.existingMatches(existing, def)) {
            ElementReservationError.throwError("reservation-conflict", {
              message: `Element reservation conflict for federationGuid ${existing.federationGuid}: existing row does not match requested class/code`,
              federationGuid: existing.federationGuid,
            });
          }
          continue;
        }

        const elementId = Id64.fromLocalAndBriefcaseIds(nextLocalId, BriefcaseIdValue.SchemaSyncElementReserved);
        this.insertReservedElement(def, elementId);
        // skip a local id for each reserved category because category inserts always trigger a second insert for default subcategory
        nextLocalId += def.isCategory ? 2 : 1;
        if (nextLocalId >= maxLocalIdExclusive) {
          this.abandonChanges();
          ElementReservationError.throwError("id-sequence-exhausted", { message: `SchemaSync reserved-element local-id sequence exhausted` });
        }
      }

      if (nextLocalId !== firstLocalId)
        this.setNextReservedElementLocalId(nextLocalId);
    }

    private existingMatches(existing: ProposedElementReservation, id: ProposedElementReservation): boolean {
      return existing.federationGuid === id.federationGuid
        && existing.ecClassId === id.ecClassId
        && existing.code.equals(id.code);
    }

    private getNextReservedElementLocalId(): number {
      const stored = this[_nativeDb].queryFileProperty(idSequenceProp, true) as string | undefined;
      const current = stored ? Number(stored) : 1;
      if (!Number.isInteger(current) || current < 1)
        ElementReservationError.throwError("corrupt-reservation-data", { message: `Corrupt SchemaSync reserved-element local-id counter: '${stored}'` });

      return current;
    }

    private setNextReservedElementLocalId(next: number): void {
      this[_nativeDb].saveFileProperty(idSequenceProp, String(next));
    }
  }

  const syncProperty = { namespace: "itwinjs", name: "SchemaSync" };
  const defaultDbName = "SchemaSyncDb";
  /** The `containerType` recorded on a BlobContainer that holds an iModel's `SchemaSyncDb`. */
  export const containerType = "schema-sync";
  const testSyncCachePropKey = "test.schema_sync.cache_name";
  // for tests only
  export function setTestCache(iModel: IModelDb, cacheName?: string): void {
    if (cacheName)
      iModel[_nativeDb].saveLocalValue(testSyncCachePropKey, cacheName);
    else
      iModel[_nativeDb].deleteLocalValue(testSyncCachePropKey);
  }

  /** Either an open iModel or the name of a closed briefcase file. Every local read below accepts both, so
   * a caller that has only a file name does not have to open a `BriefcaseDb` to ask a question about it.
   */
  export type IModelOrFileName = IModelDb | { readonly fileName: LocalFileName };

  /** Read from an open iModel, or from a closed file opened readonly for the duration of `operation`. */
  function readFromIModel<T>(arg: IModelOrFileName, operation: (nativeDb: IModelJsNative.DgnDb) => T): T {
    if (arg instanceof IModelDb)
      return operation(arg[_nativeDb]);

    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.openIModel(arg.fileName, OpenMode.Readonly);
    try {
      return operation(nativeDb);
    } finally {
      nativeDb.closeFile();
    }
  }

  /** Whether this iModel's ECSchemas are governed by a `SchemaSyncDb`.
   *
   * This is the single question every schema operation branches on. It reads one `be_Prop` row written when
   * schema sync was enabled and carried to every other briefcase by that changeset - no cloud access, and it
   * works on a readonly briefcase, a checkpoint, or a closed file.
   * @note This says nothing about whether the container is reachable, or even named. Use
   * [[queryContainerProps]] for that. The two are separate on purpose: a file that says it is governed by a
   * sync db must never fall back to importing schemas on its own, whatever state the container is in.
   */
  export function isEnabled(arg: IModelOrFileName): boolean {
    return readFromIModel(arg, (nativeDb) => nativeDb.schemaSyncEnabled());
  }

  /** One pass over the values schema sync keeps in the file: which container holds the sync db, plus the
   * test-only cache override. Read together so a closed file is opened once.
   */
  function readLocalSyncProps(arg: IModelOrFileName) {
    return readFromIModel(arg, (nativeDb) => {
      const propsString = nativeDb.queryFileProperty(syncProperty, true) as string | undefined;
      let containerProps: CloudSqlite.ContainerProps | undefined;
      if (propsString !== undefined) {
        try {
          containerProps = JSON.parse(propsString) as CloudSqlite.ContainerProps;
        } catch (e) {
          // Deliberately not swallowed into `undefined`: that would read as "schema sync was never
          // enabled" and let this briefcase import schemas on its own.
          throw new IModelError(DbResult.BE_SQLITE_CORRUPT, `iModel names a SchemaSyncDb container but the property cannot be read: ${BentleyError.getErrorMessage(e)}`);
        }
      }
      return {
        containerProps,
        testCacheName: nativeDb.queryLocalValue(testSyncCachePropKey),
      };
    });
  }

  /** The container holding this iModel's `SchemaSyncDb`, or `undefined` if schema sync was never enabled.
   *
   * Local read of the same `be_Prop` file property that [[initializeForIModel]] wrote. Requesting an access
   * token for the container is a separate, asynchronous step.
   */
  export function queryContainerProps(arg: IModelOrFileName): CloudSqlite.ContainerProps | undefined {
    return readLocalSyncProps(arg).containerProps;
  }

  interface SharedCloudAccess {
    access: CloudAccess;
    key: string;
    referenceCount: number;
  }

  const sharedAccessByContainer = new Map<string, SharedCloudAccess | Promise<SharedCloudAccess>>();
  const sharedAccessByInstance = new WeakMap<CloudAccess, SharedCloudAccess>();

  export async function getCloudAccess(arg: IModelOrFileName): Promise<CloudAccess> {
    const { containerProps, testCacheName } = readLocalSyncProps(arg);
    if (undefined === containerProps)
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND, "iModel does not have a SchemaSyncDb");

    const sharedAccessKey = JSON.stringify(containerProps) + (testCacheName ?? "");
    let shared = sharedAccessByContainer.get(sharedAccessKey);
    if (undefined === shared) {
      const pending = (async () => {
        const accessToken = await CloudSqlite.requestToken(containerProps);
        const access = new CloudAccess({ ...containerProps, accessToken });
        Object.assign(access.lockParams, lockParams);
        if (testCacheName)
          access.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: testCacheName }));

        const created = { access, key: sharedAccessKey, referenceCount: 0 };
        sharedAccessByInstance.set(access, created);
        return created;
      })();
      sharedAccessByContainer.set(sharedAccessKey, pending);
      try {
        shared = await pending;
        if (sharedAccessByContainer.get(sharedAccessKey) === pending)
          sharedAccessByContainer.set(sharedAccessKey, shared);
      } catch (error) {
        if (sharedAccessByContainer.get(sharedAccessKey) === pending)
          sharedAccessByContainer.delete(sharedAccessKey);
        throw error;
      }
    } else if (shared instanceof Promise) {
      shared = await shared;
    }

    ++shared.referenceCount;
    return shared.access;
  }

  /** Release an access obtained through [[getCloudAccess]]. */
  export function releaseCloudAccess(access: CloudAccess): void {
    const shared = sharedAccessByInstance.get(access);
    if (undefined === shared) {
      access.close();
      return;
    }

    if (--shared.referenceCount > 0)
      return;

    sharedAccessByInstance.delete(access);
    if (sharedAccessByContainer.get(shared.key) === shared)
      sharedAccessByContainer.delete(shared.key);
    access.close();
  }

  /** Arguments for [[withLockedAccess]]. */
  export interface WithLockedAccessArgs {
    operationName: string;
    openMode?: OpenMode;
    user?: string;
  }

  export async function withLockedAccess(iModel: IModelOrFileName, args: WithLockedAccessArgs, operation: (access: CloudAccess) => Promise<void>): Promise<void> {
    const access = await SchemaSync.getCloudAccess(iModel);
    try {
      await access.withLockedDb(args, async () => operation(access));
    } finally {
      releaseCloudAccess(access);
    }
  }

  /** Build the tables and indexes the briefcase's `ec_` rows describe. A merged schema changeset carries
   * those rows but no DDL, so the physical columns are missing until this runs. Needs no cloud access.
   */
  export function updateDbSchema(iModel: IModelDb): void {
    if (isEnabled(iModel) && !iModel.isReadonly) {
      iModel.clearCaches();
      iModel[_nativeDb].schemaSyncUpdateDbSchema();
      iModel[_implicitTxn].saveChanges("materialized db schema from ec_ tables");
    }
  }

  /** Whether a failed [[IModelDb.importSchemas]] can be retried through the upgrade path.
   *
   * The update tier refuses two kinds of change: one that has to move data between columns, and one
   * that destroys instances or property values. They arrive as different statuses because they are
   * different changes, but they mean one thing to a caller - this needs
   * [[BriefcaseDb.upgradeSchemas]], which takes the exclusive schema lock.
   *
   * The retry is the app's decision, not the platform's: taking that lock disturbs everyone else, so
   * only the app knows whether to do it now, schedule it, or tell the user.
   * ```ts
   * try {
   *   await db.importSchemas(files);
   * } catch (e) {
   *   if (!SchemaSync.requiresUpgrade(e)) throw e;
   *   await db.upgradeSchemas(files, { description: "..." });
   * }
   * ```
   * @internal
   */
  export function requiresUpgrade(error: unknown): boolean {
    const errorNumber = (error as { errorNumber?: number } | undefined)?.errorNumber;
    return errorNumber === DbResult.BE_SQLITE_ERROR_DataTransformRequired
      || errorNumber === DbResult.BE_SQLITE_ERROR_DataDeletionRequired;
  }

  /** Arguments for [[createContainerForIModel]]. */
  export interface CreateContainerForIModelArgs {
    iModel: IModelDb;
    label?: string;
    description?: string;
  }

  /** Create a cloud container to hold this iModel's `SchemaSyncDb`, and initialize it as empty.
   *
   * The container is scoped to the iModel, so the service deletes it when the iModel is deleted. Pass the
   * returned props to [[initializeForIModel]] - the two calls together are what enables schema sync on an
   * iModel that was created without it.
   * @note The current user must be authorized to create containers for the iTwin.
   */
  export async function createContainerForIModel(arg: CreateContainerForIModelArgs): Promise<CloudSqlite.ContainerProps> {
    const iModel = arg.iModel;
    const iTwinId = iModel.iTwinId;
    if (undefined === iTwinId)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot create a SchemaSync container for an iModel that has no iTwin");

    return CloudAccess.createNewContainer({
      scope: { iTwinId, iModelId: iModel.iModelId },
      metadata: { label: arg.label ?? `SchemaSync for ${iModel.name}`, description: arg.description },
    });
  }

  /** Arguments for [[initializeForIModel]]. */
  export interface InitializeForIModelArgs {
    iModel: IModelDb;
    containerProps: CloudSqlite.ContainerProps;
    /** Replace the container already recorded on this iModel instead of failing. */
    overrideContainer?: boolean;
  }

  /** Refuse initialization before a caller provisions a container, then hold the exclusive schema lock and pull to the tip. */
  async function prepareToInitializeForIModel(iModel: IModelDb, overrideContainer: boolean): Promise<BriefcaseDb | undefined> {
    const briefcase = iModel instanceof BriefcaseDb ? iModel : undefined;
    if (briefcase && (iModel[_nativeDb].hasUnsavedChanges() || briefcase.txns.hasLocalChanges))
      throw new IModelError(ChangeSetStatus.HasLocalChanges, "Cannot enable SchemaSync while there are local changes");

    const assertContainerCanBeInitialized = () => {
      const localInfo = iModel[_nativeDb].schemaSyncGetLocalDbInfo();
      if (localInfo && !overrideContainer)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `Local db already initialized to schema sync (container-id: ${localInfo.id})`);
    };

    assertContainerCanBeInitialized();
    await iModel.acquireSchemaLock();
    await briefcase?.pullChanges();
    assertContainerCanBeInitialized();
    return briefcase;
  }

  async function initializeAfterPreflight(arg: InitializeForIModelArgs, briefcase: BriefcaseDb | undefined): Promise<void> {
    const props = { baseUri: arg.containerProps.baseUri, containerId: arg.containerProps.containerId, storageType: arg.containerProps.storageType }; // sanitize to only known properties
    const iModel = arg.iModel;
    const description = arg.overrideContainer
      ? `Overriding SchemaSync for iModel with container-id: ${props.containerId}`
      : `Enable SchemaSync for iModel with container-id: ${props.containerId}`;
    const txnBeforeInit = briefcase?.txns.getCurrentTxnId();
    try {
      iModel[_implicitTxn].saveFileProperty(syncProperty, JSON.stringify(props));
      try {
        await withLockedAccess(iModel, { operationName: "initialize schemaSync", openMode: OpenMode.Readonly }, async (syncAccess) => {
          iModel[_nativeDb].schemaSyncInit(syncAccess.getUri(), props.containerId, arg.overrideContainer ?? false);
          iModel[_implicitTxn].saveChanges(description);
        });
      } catch (error) {
        iModel[_implicitTxn].abandonChanges();
        if (briefcase && txnBeforeInit !== undefined && briefcase.txns.getCurrentTxnId() !== txnBeforeInit) {
          const status = briefcase[_nativeDb].cancelTo(txnBeforeInit, true);
          if (status !== IModelStatus.Success)
            Logger.logError("SchemaSync", `Failed to roll back schema sync initialization after the container upload failed: ${IModelStatus[status] ?? status}`);
        }
        throw error;
      }

      // Upload the initialized container before publishing the property that tells every briefcase to use it.
      // If the push fails, this briefcase keeps the local txn and exclusive schema lock so the push can be retried.
      await briefcase?.pushChanges({ description });
    } finally {
      iModel[_implicitTxn].abandonChanges();
    }

    await iModel.initializeSharedElementReservations();
  }

  /** Enable schema sync for an iModel, seeding the container from this briefcase.
   * @note Takes the exclusive schema lock, refuses local changes, and pulls the briefcase to the tip before writing the container.
   */
  export async function initializeForIModel(arg: InitializeForIModelArgs): Promise<void> {
    const briefcase = await prepareToInitializeForIModel(arg.iModel, arg.overrideContainer ?? false);
    await initializeAfterPreflight(arg, briefcase);
  }

  /** The part of a SchemaSyncDb to restore from an authoritative briefcase. @alpha */
  export type RepairScope = "schemaMetadata" | "schemaMetadataAndProfile";

  const nativeRepairScope: Record<RepairScope, number> = {
    schemaMetadata: 0,
    schemaMetadataAndProfile: 1,
  };

  /** Arguments for [[repairForIModel]]. @alpha */
  export interface RepairForIModelArgs {
    /** A clean SchemaSync-enabled briefcase at the tip of the iModel timeline. */
    iModel: BriefcaseDb;
    /** Include the schema-owned EC, BeSQLite, and DgnDb profile table definitions. */
    scope?: RepairScope;
  }

  /** Restore the schema-owned portion of the SchemaSyncDb from a briefcase at the tip of the timeline.
   *
   * This operation takes the exclusive schema lock and refuses to pull or modify the briefcase. Element
   * reservations and all other target-only state in the SchemaSyncDb are preserved.
   * @alpha
   */
  export async function repairForIModel(arg: RepairForIModelArgs): Promise<void> {
    const iModel = arg.iModel;
    if (!isEnabled(iModel))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot repair SchemaSync because it is not enabled for this iModel");

    if (iModel[_nativeDb].hasUnsavedChanges() || iModel.txns.hasLocalChanges)
      throw new IModelError(ChangeSetStatus.HasLocalChanges, "Cannot repair SchemaSync while there are local changes");

    if (!iModel.locks.isServerBased)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot repair SchemaSync without server-based locking");

    if (arg.scope !== undefined && arg.scope !== "schemaMetadata" && arg.scope !== "schemaMetadataAndProfile")
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Unknown SchemaSync repair scope");

    const briefcaseManagerModule = await import("./BriefcaseManager");
    const assertBriefcaseIsAtTip = async () => {
      const latestChangeset = await briefcaseManagerModule.BriefcaseManager.getLatestChangeset({ iModelId: iModel.iModelId });
      if (latestChangeset.id !== iModel.changeset.id)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot repair SchemaSync from a briefcase that is not at the tip of the iModel timeline");
    };

    // Avoid asking Hub for an exclusive lock it cannot grant to a briefcase that first needs to pull.
    await assertBriefcaseIsAtTip();
    const schemaLockWasHeld = iModel.holdsSchemaLock;
    if (!schemaLockWasHeld)
      await iModel.acquireSchemaLock();
    try {
      // Close the race between the preflight query and acquiring the exclusive lock.
      await assertBriefcaseIsAtTip();
      const repairScope = nativeRepairScope[arg.scope ?? "schemaMetadata"];
      await withLockedAccess(iModel, { openMode: OpenMode.Readonly, operationName: "repair schema sync" }, async (syncAccess) => {
        const nativeDb = iModel[_nativeDb] as IModelJsNative.DgnDb & { schemaSyncRepair(syncDbUri: string, scope: number): void };
        nativeDb.schemaSyncRepair(syncAccess.getUri(), repairScope);
      });
      Logger.logInfo("SchemaSync", `Repaired SchemaSyncDb from changeset ${iModel.changeset.id || "0"}`);
    } finally {
      if (!schemaLockWasHeld)
        await iModel.locks.abandonAllLocks();
    }
  }

  /** Arguments for [[enableForIModel]]. */
  export interface EnableForIModelArgs {
    iModel: IModelDb;
    /** An existing container to use. When omitted one is created for this iModel. */
    containerProps?: CloudSqlite.ContainerProps;
    /** Replace the container already recorded on this iModel instead of failing. */
    overrideContainer?: boolean;
    label?: string;
    description?: string;
  }

  /** Turn schema sync on for an iModel: create the container if needed, record it, and seed it.
   *
   * The single call callers should use. [[createContainerForIModel]] and [[initializeForIModel]] have
   * to happen in this order, and an iModel left between the two is one that names a container nothing
   * has seeded.
   * @returns the container props recorded on the iModel.
   * @note Takes the exclusive schema lock and pushes, same protocol as [[BriefcaseDb.upgradeSchemas]] -
   * every operation that changes how a file is governed uses it.
   */
  export async function enableForIModel(arg: EnableForIModelArgs): Promise<CloudSqlite.ContainerProps> {
    if (undefined === arg.containerProps && undefined === arg.iModel.iTwinId)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot create a SchemaSync container for an iModel that has no iTwin");

    const briefcase = await prepareToInitializeForIModel(arg.iModel, arg.overrideContainer ?? false);
    const containerProps = arg.containerProps
      ?? await createContainerForIModel({ iModel: arg.iModel, label: arg.label, description: arg.description });
    await initializeAfterPreflight({ iModel: arg.iModel, containerProps, overrideContainer: arg.overrideContainer }, briefcase);
    return containerProps;
  }

  /** Arguments for [[CloudAccess.createNewContainer]]. */
  export interface CreateNewContainerProps {
    scope: BlobContainer.Scope;
    metadata: Omit<BlobContainer.Metadata, "containerType">;
  }

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

    /** Create and initialize a new `schema-sync` BlobContainer to hold a `SchemaSyncDb`. */
    public static async createNewContainer(args: CreateNewContainerProps): Promise<CloudSqlite.ContainerProps> {
      const props = await this.createBlobContainer({ scope: args.scope, metadata: { ...args.metadata, containerType } });
      await this.initializeDb(props);
      return props;
    }
  }
}
