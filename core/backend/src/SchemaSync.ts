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
import { ChangeSetStatus, DbResult, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalFileName } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import type { BlobContainer } from "./BlobContainerService";
import { IModelNative } from "./internal/NativePlatform";
import { _implicitTxn, _nativeDb } from "./internal/Symbols";

/** @internal */
export namespace SchemaSync {
  const lockParams: CloudSqlite.ObtainLockParams = { retryDelayMs: 1000, nRetries: 30 };

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
  export const setTestCache = (iModel: IModelDb, cacheName?: string) => {
    if (cacheName)
      iModel[_nativeDb].saveLocalValue(testSyncCachePropKey, cacheName);
    else
      iModel[_nativeDb].deleteLocalValue(testSyncCachePropKey);
  };

  /** Either an open iModel or the name of a closed briefcase file. Every local read below accepts both, so
   * a caller that has only a file name does not have to open a `BriefcaseDb` to ask a question about it.
   */
  export type IModelOrFileName = IModelDb | { readonly fileName: LocalFileName };

  /** Read from an open iModel, or from a closed file opened readonly for the duration of `operation`. */
  const readFromIModel = <T>(arg: IModelOrFileName, operation: (nativeDb: IModelJsNative.DgnDb) => T): T => {
    if (arg instanceof IModelDb)
      return operation(arg[_nativeDb]);

    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.openIModel(arg.fileName, OpenMode.Readonly);
    try {
      return operation(nativeDb);
    } finally {
      nativeDb.closeFile();
    }
  };

  /** Whether this iModel's ECSchemas are governed by a `SchemaSyncDb`.
   *
   * This is the single question every schema operation branches on. It reads one `be_Prop` row written when
   * schema sync was enabled and carried to every other briefcase by that changeset - no cloud access, and it
   * works on a readonly briefcase, a checkpoint, or a closed file.
   * @note This says nothing about whether the container is reachable, or even named. Use
   * [[queryContainerProps]] for that. The two are separate on purpose: a file that says it is governed by a
   * sync db must never fall back to importing schemas on its own, whatever state the container is in.
   */
  export const isEnabled = (arg: IModelOrFileName): boolean => {
    return readFromIModel(arg, (nativeDb) => nativeDb.schemaSyncEnabled());
  };

  /** One pass over the values schema sync keeps in the file: which container holds the sync db, plus the
   * test-only cache override. Read together so a closed file is opened once.
   */
  const readLocalSyncProps = (arg: IModelOrFileName) => readFromIModel(arg, (nativeDb) => {
    const propsString = nativeDb.queryFileProperty(syncProperty, true) as string | undefined;
    return {
      containerProps: propsString ? JSON.parse(propsString) as CloudSqlite.ContainerProps : undefined,
      testCacheName: nativeDb.queryLocalValue(testSyncCachePropKey),
    };
  });

  /** The container holding this iModel's `SchemaSyncDb`, or `undefined` if schema sync was never enabled.
   *
   * Local read of the same `be_Prop` file property that [[initializeForIModel]] wrote. Requesting an access
   * token for the container is a separate, asynchronous step.
   */
  export const queryContainerProps = (arg: IModelOrFileName): CloudSqlite.ContainerProps | undefined => {
    return readLocalSyncProps(arg).containerProps;
  };

  const getCloudAccess = async (arg: IModelOrFileName) => {
    const { containerProps, testCacheName } = readLocalSyncProps(arg);
    if (undefined === containerProps)
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND, "iModel does not have a SchemaSyncDb");

    const accessToken = await CloudSqlite.requestToken(containerProps);
    const access = new CloudAccess({ ...containerProps, accessToken });
    Object.assign(access.lockParams, lockParams);
    if (testCacheName)
      access.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: testCacheName }));
    return access;
  };

  export const withLockedAccess = async (iModel: IModelOrFileName, args: { operationName: string, openMode?: OpenMode, user?: string }, operation: (access: CloudAccess) => Promise<void>): Promise<void> => {
    const access = await getCloudAccess(iModel);
    try {
      await access.withLockedDb(args, async () => operation(access));
    } finally {
      access.close();
    }
  };

  /** Build the tables and indexes the briefcase's `ec_` rows describe. A merged schema changeset carries
   * those rows but no DDL, so the physical columns are missing until this runs. Needs no cloud access.
   */
  export const updateDbSchema = (iModel: IModelDb) => {
    if (isEnabled(iModel) && !iModel.isReadonly) {
      iModel.clearCaches();
      iModel[_nativeDb].schemaSyncUpdateDbSchema();
      iModel[_implicitTxn].saveChanges("materialized db schema from ec_ tables");
    }
  };

  /** Create a cloud container to hold this iModel's `SchemaSyncDb`, and initialize it as empty.
   *
   * The container is scoped to the iModel, so the service deletes it when the iModel is deleted. Pass the
   * returned props to [[initializeForIModel]] - the two calls together are what enables schema sync on an
   * iModel that was created without it.
   * @note The current user must be authorized to create containers for the iTwin.
   */
  export const createContainerForIModel = async (arg: { iModel: IModelDb, label?: string, description?: string }): Promise<CloudSqlite.ContainerProps> => {
    const iModel = arg.iModel;
    const iTwinId = iModel.iTwinId;
    if (undefined === iTwinId)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot create a SchemaSync container for an iModel that has no iTwin");

    return CloudAccess.createNewContainer({
      scope: { iTwinId, iModelId: iModel.iModelId },
      metadata: { label: arg.label ?? `SchemaSync for ${iModel.name}`, description: arg.description },
    });
  };

  /** Enable schema sync for an iModel, seeding the container from this briefcase.
   * @note The sync db becomes a mirror of this briefcase's metadata, so the briefcase must be level with
   * the timeline: the exclusive schema lock is taken so nobody else can be holding changes, local changes
   * are refused, and the briefcase is pulled to the tip before the container is written.
   */
  export const initializeForIModel = async (arg: { iModel: IModelDb, containerProps: CloudSqlite.ContainerProps, overrideContainer?: boolean }) => {
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
  };

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

