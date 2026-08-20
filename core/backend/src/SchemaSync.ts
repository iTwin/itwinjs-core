/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module SQLiteDb
 */

import { CloudSqlite } from "./CloudSqlite";
import { VersionedSqliteDb } from "./SQLiteDb";
import { BriefcaseDb, IModelDb } from "./IModelDb";
import { BentleyError, ChangeSetStatus, DbResult, Logger, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalFileName } from "@itwin/core-common";
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

  /** A CloudSqlite database for synchronizing schema changes across briefcases.  */
  export class SchemaSyncDb extends VersionedSqliteDb {
    public override readonly myVersion = "4.0.0";
    protected override createDDL() { }
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

  async function getCloudAccess(arg: IModelOrFileName): Promise<CloudAccess> {
    const { containerProps, testCacheName } = readLocalSyncProps(arg);
    if (undefined === containerProps)
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND, "iModel does not have a SchemaSyncDb");

    const accessToken = await CloudSqlite.requestToken(containerProps);
    const access = new CloudAccess({ ...containerProps, accessToken });
    Object.assign(access.lockParams, lockParams);
    if (testCacheName)
      access.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: testCacheName }));
    return access;
  }

  /** Arguments for [[withLockedAccess]]. */
  export interface WithLockedAccessArgs {
    operationName: string;
    openMode?: OpenMode;
    user?: string;
  }

  export async function withLockedAccess(iModel: IModelOrFileName, args: WithLockedAccessArgs, operation: (access: CloudAccess) => Promise<void>): Promise<void> {
    const access = await getCloudAccess(iModel);
    try {
      await access.withLockedDb(args, async () => operation(access));
    } finally {
      access.close();
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
   * @alpha
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

  /** Enable schema sync for an iModel, seeding the container from this briefcase.
   * @note The sync db becomes a mirror of this briefcase's metadata, so the briefcase must be level with
   * the timeline: the exclusive schema lock is taken so nobody else can be holding changes, local changes
   * are refused, and the briefcase is pulled to the tip before the container is written.
   */
  export async function initializeForIModel(arg: InitializeForIModelArgs): Promise<void> {
    const props = { baseUri: arg.containerProps.baseUri, containerId: arg.containerProps.containerId, storageType: arg.containerProps.storageType }; // sanitize to only known properties
    const iModel = arg.iModel;
    const briefcase = iModel instanceof BriefcaseDb ? iModel : undefined;
    if (briefcase && (iModel[_nativeDb].hasUnsavedChanges() || briefcase.txns.hasLocalChanges))
      throw new IModelError(ChangeSetStatus.HasLocalChanges, "Cannot enable SchemaSync while there are local changes");

    await iModel.acquireSchemaLock();
    if (briefcase)
      await briefcase.pullChanges();

    const description = arg.overrideContainer
      ? `Overriding SchemaSync for iModel with container-id: ${props.containerId}`
      : `Enable SchemaSync for iModel with container-id: ${props.containerId}`;
    try {
      iModel[_implicitTxn].saveFileProperty(syncProperty, JSON.stringify(props));
      await withLockedAccess(iModel, { operationName: "initialize schemaSync", openMode: OpenMode.Readonly }, async (syncAccess) => {
        iModel[_nativeDb].schemaSyncInit(syncAccess.getUri(), props.containerId, arg.overrideContainer ?? false);
        iModel[_implicitTxn].saveChanges(description);
        // The container is uploaded when the write lock is released, so pushing here puts the changeset out
        // first and makes a failed push discard the container's writes with it. The reverse order can leave
        // an initialized container that no briefcase can learn about.
        await briefcase?.pushChanges({ description });
      });
    } finally {
      iModel[_implicitTxn].abandonChanges();
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
    const containerProps = arg.containerProps
      ?? await createContainerForIModel({ iModel: arg.iModel, label: arg.label, description: arg.description });
    await initializeForIModel({ iModel: arg.iModel, containerProps, overrideContainer: arg.overrideContainer });
    return containerProps;
  }

  /** Arguments for [[CloudAccess.createNewContainer]]. */
  export interface CreateNewContainerProps {
    scope: BlobContainer.Scope;
    metadata: Omit<BlobContainer.Metadata, "containerType">;
  }

  /** Provides access to a cloud-based `SchemaSyncDb` to hold ECSchemas.  */
  export class CloudAccess extends CloudSqlite.DbAccess<SchemaSyncDb> {
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

    /** Create and initialize a new BlobContainer to hold a `SchemaSyncDb`.
     * @note the current user must have administrator rights to create containers.
     */
    public static async createNewContainer(args: CreateNewContainerProps): Promise<CloudSqlite.ContainerProps> {
      const props = await this.createBlobContainer({ scope: args.scope, metadata: { ...args.metadata, containerType } });
      await this.initializeDb(props);
      return props;
    }
  }
}

