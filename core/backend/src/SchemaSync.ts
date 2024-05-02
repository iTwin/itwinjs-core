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
import { IModelError } from "@itwin/core-common";

type TestCacheIModel = IModelDb & { testSyncCache?: string };

/** @internal */
export namespace SchemaSync {

  /** A CloudSqlite database for synchronizing schema changes across briefcases.  */
  export class SchemaSyncDb extends VersionedSqliteDb {
    public override readonly myVersion = "4.0.0";
    protected override createDDL() { }
  }

  const syncProperty = { namespace: "itwinjs", name: "SchemaSync" };
  const defaultDbName = "SchemaSyncDb" as const;
  // for tests only
  export const setTestCache = (iModel: IModelDb, cacheName: string) => {
    (iModel as TestCacheIModel).testSyncCache = cacheName;
  };

  export const withLockedAccess = async (iModel: TestCacheIModel, args: { operationName: string, openMode?: OpenMode, user?: string }, operation: (access: CloudAccess) => Promise<void>): Promise<void> => {
    const propsString = iModel.queryFilePropertyString(syncProperty);
    if (!propsString)
      throw new Error("iModel does not have a SchemaSyncDb");

    const props = JSON.parse(propsString) as CloudSqlite.ContainerProps;
    const accessToken = await CloudSqlite.requestToken(props);
    const access = new CloudAccess({ ...props, accessToken });
    if (iModel.testSyncCache)
      access.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: iModel.testSyncCache }));
    try {
      await access.withLockedDb(args, async () => operation(access));
    } finally {
      access.close();
    }
  };

  /** Synchronize local briefcase schemas with cloud container */
  export const pull = async (iModel: TestCacheIModel) => {
    if (iModel.nativeDb.schemaSyncEnabled()) {
      await SchemaSync.withLockedAccess(iModel, { openMode: OpenMode.Readonly, operationName: "schema sync" }, async (syncAccess) => {
        const schemaSyncDbUri = syncAccess.getUri();
        syncAccess.synchronizeWithCloud();
        iModel.nativeDb.schemaSyncPull(schemaSyncDbUri);
        iModel.clearCaches();
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

    iModel.saveFileProperty(syncProperty, JSON.stringify(props));
    iModel.saveChanges();

    await withLockedAccess(arg.iModel, { operationName: "initialize schemaSync", openMode: OpenMode.Readonly }, async (syncAccess) => {
      iModel.nativeDb.schemaSyncInit(syncAccess.getUri(), props.containerId, arg.overrideContainer ?? false);
      iModel.saveChanges(`Enable SchemaSync  (container id: ${props.containerId})`);
    });

    if (briefcase) {
      if (arg.overrideContainer)
        await briefcase.pushChanges({ description: `Enable SchemaSync for iModel with container-id: ${props.containerId}` });
      else
        await briefcase.pushChanges({ description: `Overriding SchemaSync for iModel with container-id: ${props.containerId}` });
    }
  };

  /** Provides access to a cloud-based `SchemaSyncDb` to hold ECSchemas.  */
  export class CloudAccess extends CloudSqlite.DbAccess<SchemaSyncDb> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: SchemaSyncDb, props, dbName: defaultDbName });
    }

    public getUri() {
      return `${this.getCloudDb().nativeDb.getFilePath()}?vfs=${this.container.cache?.name}&writable=${this.container.isWriteable ? 1 : 0}`;
    }
    /**
   * Initialize a cloud container for use as a SchemaSync. The container must first be created via its storage supplier api (e.g. Azure, or AWS).
   * A valid sasToken that grants write access must be supplied. This function creates and uploads an empty ChannelDb into the container.
   * @note this deletes any existing content in the container.
   */
    public static async initializeDb(props: CloudSqlite.ContainerAccessProps) {
      return super._initializeDb({ props, dbType: SchemaSyncDb, dbName: defaultDbName });
    }
  }
}

