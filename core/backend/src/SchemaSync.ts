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
import { DbResult, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalFileName } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelNative } from "./internal/NativePlatform";
import { _nativeDb } from "./internal/Symbols";

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
  const testSyncCachePropKey = "test.schema_sync.cache_name";
  // for tests only
  export const setTestCache = (iModel: IModelDb, cacheName?: string) => {
    if (cacheName)
      iModel[_nativeDb].saveLocalValue(testSyncCachePropKey, cacheName);
    else
      iModel[_nativeDb].deleteLocalValue(testSyncCachePropKey);
  };

  const getCloudAccess = async (arg: IModelDb | { readonly fileName: LocalFileName }) => {
    let nativeDb: IModelJsNative.DgnDb | undefined;
    const argIsIModelDb = arg instanceof IModelDb;
    if (argIsIModelDb) {
      nativeDb = arg[_nativeDb];
    } else {
      nativeDb = new IModelNative.platform.DgnDb();
      nativeDb.openIModel(arg.fileName, OpenMode.Readonly);
    }

    const propsString = nativeDb.queryFileProperty(syncProperty, true) as string | undefined;
    if (!propsString)
      throw new Error("iModel does not have a SchemaSyncDb");
    try {
      const props = JSON.parse(propsString) as CloudSqlite.ContainerProps;
      const accessToken = await CloudSqlite.requestToken(props);
      const access = new CloudAccess({ ...props, accessToken });
      Object.assign(access.lockParams, lockParams);
      const testSyncCache = nativeDb.queryLocalValue(testSyncCachePropKey);
      if (testSyncCache)
        access.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: testSyncCache }));
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
        iModel.saveChanges("schema synchronized with cloud container");
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
      iModel.saveFileProperty(syncProperty, JSON.stringify(props));
      await withLockedAccess(arg.iModel, { operationName: "initialize schemaSync", openMode: OpenMode.Readonly }, async (syncAccess) => {
        iModel[_nativeDb].schemaSyncInit(syncAccess.getUri(), props.containerId, arg.overrideContainer ?? false);
        iModel.saveChanges(`Enable SchemaSync  (container id: ${props.containerId})`);
      });
    } catch (err) {
      throw err;
    } finally {
      iModel.abandonChanges();
    }

    if (briefcase) {
      if (arg.overrideContainer)
        await briefcase.pushChanges({ description: `Overriding SchemaSync for iModel with container-id: ${props.containerId}` });
      else
        await briefcase.pushChanges({ description: `Enable SchemaSync for iModel with container-id: ${props.containerId}` });
    }
  };

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
  }
}

