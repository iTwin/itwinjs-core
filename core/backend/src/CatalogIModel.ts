/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import { CloudSqlite } from "./CloudSqlite";
import { IModelHost } from "./IModelHost";
import { type CatalogIModelTypes, CloudSqliteError } from "@itwin/core-common";
import { IpcHandler } from "./IpcHost";
import { StandaloneDb } from "./IModelDb";
import { OpenMode } from "@itwin/core-bentley";

interface CatalogCloudCache extends CloudSqlite.CloudCache {
  catalogContainers: Map<string, CloudSqlite.CloudContainer>;
}

let catalogCloudCache: CatalogCloudCache | undefined;

// cloud cache for all CatalogDb containers
const getCloudCache = () => {
  return catalogCloudCache ??= makeCloudCache({ cacheName: "standaloneDbs", cacheSize: "10G" });
}

const makeCloudCache = (arg: CloudSqlite.CreateCloudCacheArg) => {
  const cache = CloudSqlite.CloudCaches.getCache(arg) as CatalogCloudCache;
  if (undefined === cache.catalogContainers) // if we just created this container, add the map but make it non-enumerable
    Object.defineProperty(cache, "catalogContainers", { enumerable: false, writable: true, value: new Map<string, CloudSqlite.CloudContainer>() });
  return cache;
}

// make and connect a CloudSqlite.CloudContainer for accessing a cloud CatalogDb
const getCatalogContainerObj = async (containerId: string, writeable?: boolean) => {
  const cache = getCloudCache();
  const cloudContainer = cache.catalogContainers.get(containerId);
  if (undefined !== cloudContainer)
    return cloudContainer;

  const accessLevel = writeable ? "write" : "read";
  const tokenProps = await CloudSqlite.getBlobService().requestToken({ containerId, accessLevel, userToken: await IModelHost.getAccessToken() });
  const container = CloudSqlite.createCloudContainer({
    accessLevel,
    baseUri: tokenProps.baseUri,
    containerId,
    storageType: tokenProps.provider,
    writeable: true,
    accessToken: tokenProps.token
  });
  cache.catalogContainers.set(containerId, container);
  container.connect(getCloudCache());
  return container;
}

const ensureLocked = (container: CloudSqlite.CloudContainer, reason: string) => {
  if (!container.hasWriteLock)
    CloudSqliteError.throwError("write-lock-not-held", { message: `Write lock must be held to ${reason}` });

}
export class CatalogDb extends StandaloneDb {

  public async createNewContainer(args: CatalogIModelTypes.CreateNewContainerArgs): Promise<CatalogIModelTypes.NewContainerProps> {
    const userToken = await IModelHost.getAccessToken();
    const cloudContainerProps = await CloudSqlite.getBlobService().create({ scope: { iTwinId: args.iTwinId }, metadata: { containerType: "standaloneDb", ...args.metadata }, userToken });

    const container = CloudSqlite.createCloudContainer({
      accessLevel: "admin",
      baseUri: cloudContainerProps.baseUri,
      containerId: cloudContainerProps.containerId,
      storageType: cloudContainerProps.provider,
      writeable: true,
      accessToken: await CloudSqlite.requestToken(cloudContainerProps)
    });

    container.initializeContainer({ blockSize: 4 * 1024 * 1024 });
    container.connect(getCloudCache());
    await CloudSqlite.withWriteLock({ user: "initialize", container }, async () => {
      await CloudSqlite.uploadDb(container, { ...args, localFileName: args.iModelFile });
    });
    container.disconnect({ detach: true });
    return cloudContainerProps;
  }


  public static async acquireWriteLock(args: { username: string } & CatalogIModelTypes.ContainerArg) {
    const container = await getCatalogContainerObj(args.containerId, true);
    container.acquireWriteLock(args.username);
  }

  public static async releaseWriteLock(args: CatalogIModelTypes.ContainerArg & { abandon?: true }) {
    const container = await getCatalogContainerObj(args.containerId, true);
    if (args.abandon)
      container.abandonChanges();
    container.releaseWriteLock();
  }

  public static async openCatalog(args: CatalogIModelTypes.OpenArgs) {
    if (undefined === args.containerId) // local file?
      return super.openFile(args.dbName, args.writeable ? OpenMode.ReadWrite : OpenMode.Readonly, args);

    const container = await getCatalogContainerObj(args.containerId);
    const fileName = CloudSqlite.makeSemverName(args.dbName, args.version);

    if (args.writeable) {
      ensureLocked(container, "open a CatalogIModel for write");
      CloudSqlite.isSemverEditable({ container, dbFullName })
    }
    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, fileName);

    return super.open({ ...args, fileName, container, readonly: !args.writeable });
  }


  public static async createNewVersion(args: CreateNewWorkspaceDbVersionArgs): Promise<{ oldDb: WorkspaceDbNameAndVersion, newDb: WorkspaceDbNameAndVersion }> {
    requireWriteLock();
    const container = this.cloudContainer;

    const fromDb = this.resolveDbFileName(args.fromProps ?? {});
    return CloudSqlite.createNewDbVersion({ ...args, container, fromDb });
  }
}

export class CatalogDbIpc extends IpcHandler implements CatalogIModelTypes.IpcMethods {
  public get channelName(): CatalogIModelTypes.IpcChannel { return "catalogIModel/ipc"; }
}
