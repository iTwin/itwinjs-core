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
import { IModelHost } from "./IModelHost";
import { DbResult, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalFileName } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelNative } from "./internal/NativePlatform";
import { _implicitTxn, _nativeDb } from "./internal/Symbols";

/** @internal */
export namespace SchemaSync {
  const lockParams: CloudSqlite.ObtainLockParams = { retryDelayMs: 1000, nRetries: 30 };

  /** A CloudSqlite database for synchronizing schema changes across briefcases.  */
  export class SchemaSyncDb extends VersionedSqliteDb {
    /** 5.x is the orchestration poc: the container holds the log of schema import calls instead of a copy of the `ec_` tables.
     * It is deliberately incompatible with the 4.x layout in both directions.
     */
    public override readonly myVersion = "5.0.0";
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

  /** One recorded `importSchemas` call in the schema sync import log.
   * @internal
   */
  export type PendingImport = IModelJsNative.SchemaSyncImportRecord;

  /** What a briefcase does about the imports other briefcases recorded but did not push yet.
   *  - `cancel`: stop, import nothing.
   *  - `reject`: mark the pending imports rejected and run the local import anyway.
   *  - `applyPending`: run the pending imports locally first, then the local import.
   * @internal
   */
  export type PendingImportAction = "cancel" | "reject" | "applyPending";

  /** Decides what to do about pending imports. Called while the schema sync container write lock is held.
   * @internal
   */
  export type PendingImportResolver = (arg: { iModel: IModelDb, pending: PendingImport[] }) => Promise<PendingImportAction> | PendingImportAction;

  const defaultPendingImportResolver: PendingImportResolver = () => "applyPending";
  let pendingImportResolver = defaultPendingImportResolver;

  /** Replaces the callback that decides what to do about pending imports. Pass `undefined` to go back to the default, which applies them.
   * @internal
   */
  export const setPendingImportResolver = (resolver?: PendingImportResolver) => {
    pendingImportResolver = resolver ?? defaultPendingImportResolver;
  };

  /** Reads the pending imports and asks the resolver what to do about them.
   * @internal
   */
  export const resolvePendingImports = async (iModel: IModelDb, syncDbUri: string): Promise<{ action: PendingImportAction, pending: PendingImport[] }> => {
    const pending = iModel[_nativeDb].schemaSyncQueryPendingImports(syncDbUri);
    if (pending.length === 0)
      return { action: "applyPending", pending };

    return { action: await pendingImportResolver({ iModel, pending }), pending };
  };

  /** Runs the given recorded imports locally, in log order, through the real importer.
   * Native records nothing for these calls, it only notes that this briefcase caught up with them.
   * @internal
   */
  export const replayImports = (iModel: IModelDb, syncDbUri: string, records: PendingImport[]) => {
    for (const record of records) {
      const schemaXml = iModel[_nativeDb].schemaSyncQueryImportSchemas(syncDbUri, record.id);
      iModel[_nativeDb].importXmlSchemas(schemaXml, {
        schemaLockHeld: false,
        schemaSyncDbUri: syncDbUri,
        schemaSyncReplayOfImportId: record.id,
        user: IModelHost.userMoniker,
      });
      iModel[_implicitTxn].saveChanges(`applied pending schema import #${record.id}`);
    }
  };

  /** Bring the local briefcase up to date with every schema import recorded in the container.
   * Replaying writes nothing to the container, so this only needs read access.
   */
  export const pull = async (iModel: IModelDb) => {
    if (!iModel[_nativeDb].schemaSyncEnabled() || iModel.isReadonly)
      return;

    await SchemaSync.withReadonlyAccess(iModel, async (syncAccess) => {
      const syncDbUri = syncAccess.getUri();
      const pending = iModel[_nativeDb].schemaSyncQueryPendingImports(syncDbUri);
      if (pending.length === 0)
        return;

      iModel.clearCaches();
      replayImports(iModel, syncDbUri, pending);
    });
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

