/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */



import { CloudSqlite } from "./CloudSqlite";
import { IModelHost } from "./IModelHost";
import { type CatalogIModelTypes, CloudSqliteError, IModelConnectionProps } from "@itwin/core-common";
import { IpcHandler } from "./IpcHost";
import { StandaloneDb } from "./IModelDb";
import { OpenMode } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";

interface CatalogCloudCache extends CloudSqlite.CloudCache {
  writeable: boolean;
  catalogContainers: Map<string, CloudSqlite.CloudContainer>;
}

let readonlyCloudCache: CatalogCloudCache | undefined;
let writeableCloudCache: CatalogCloudCache | undefined;

const makeCloudCache = (arg: CloudSqlite.CreateCloudCacheArg, writeable: boolean) => {
  const cache = CloudSqlite.CloudCaches.getCache(arg) as CatalogCloudCache;
  // if the cache was just created, add the "catalog" members as hidden
  if (undefined === cache.catalogContainers) {
    CloudSqlite.addHiddenProperty(cache, "catalogContainers", new Map<string, CloudSqlite.CloudContainer>());
    CloudSqlite.addHiddenProperty(cache, "writeable", writeable);
  }

  return cache;
}

// find an existing CloudContainer for accessing a CatalogIModel, or make a new one and connect it
const getCatalogContainerObj = async (cache: CatalogCloudCache, containerId: string) => {
  const cloudContainer = cache.catalogContainers.get(containerId);
  if (undefined !== cloudContainer)
    return cloudContainer;

  const accessLevel = cache.writeable ? "write" : "read";
  const tokenProps = await CloudSqlite.getBlobService().requestToken({ containerId, accessLevel, userToken: await IModelHost.getAccessToken() });
  const container = CloudSqlite.createCloudContainer({
    accessLevel,
    baseUri: tokenProps.baseUri,
    containerId,
    storageType: tokenProps.provider,
    writeable: cache.writeable,
    accessToken: tokenProps.token
  });
  cache.catalogContainers.set(containerId, container);
  container.connect(cache);
  return container;
}

const getReadonlyCloudCache = () => readonlyCloudCache ??= makeCloudCache({ cacheName: "catalogs", cacheSize: "10G" }, false);
const getWritableCloudCache = () => writeableCloudCache ??= makeCloudCache({ cacheName: "writeableCatalogs", cacheSize: "10G" }, true);
const getReadonlyContainer = async (containerId: string) => getCatalogContainerObj(getReadonlyCloudCache(), containerId);
const getWriteableContainer = async (containerId: string) => getCatalogContainerObj(getWritableCloudCache(), containerId);

// Throw an error if the write lock is not held for the supplied container
const ensureLocked = (container: CloudSqlite.CloudContainer, reason: string) => {
  if (!container.hasWriteLock)
    CloudSqliteError.throwError("write-lock-not-held", { message: `Write lock must be held to ${reason}` });

}

export class CatalogDb extends StandaloneDb {
  public static async openCatalog(args: CatalogIModelTypes.OpenReadonlyArgs) {
    if (undefined === args.containerId) // local file?
      return super.openFile(args.dbName, OpenMode.Readonly, args);

    const container = await getReadonlyContainer(args.containerId);
    const fileName = CloudSqlite.makeSemverName(args.dbName, args.version);

    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, fileName);

    return super.open({ ...args, fileName, container, readonly: true });
  }
}

export class EditableCatalog extends StandaloneDb {
  public static async createNewContainer(args: CatalogIModelTypes.CreateNewContainerArgs): Promise<CatalogIModelTypes.NewContainerProps> {
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
    container.connect(getWritableCloudCache());
    await CloudSqlite.withWriteLock({ user: "initialize", container }, async () => {
      await CloudSqlite.uploadDb(container, { ...args, localFileName: args.iModelFile });
    });
    container.disconnect({ detach: true });
    return cloudContainerProps;
  }

  public static async acquireWriteLock(args: { username: string } & CatalogIModelTypes.ContainerArg) {
    const container = await getWriteableContainer(args.containerId);
    container.acquireWriteLock(args.username);
  }

  public static async releaseWriteLock(args: CatalogIModelTypes.ContainerArg & { abandon?: true }) {
    const container = await getWriteableContainer(args.containerId);
    if (args.abandon)
      container.abandonChanges();
    container.releaseWriteLock();
  }

  public static async openEditable(args: CatalogIModelTypes.OpenEditableArgs) {
    if (undefined === args.containerId) // local file?
      return super.openFile(args.dbFullName, OpenMode.ReadWrite, args);

    const container = await getWriteableContainer(args.containerId);
    ensureLocked(container, "open a Catalog for editing");
    if (!CloudSqlite.isSemverEditable(args.dbFullName, container))
      CloudSqliteError.throwError("already-published", { message: "Catalog has already been published and is not editable. Make a new version first.", ...args })

    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, args.dbFullName);

    return super.open({ ...args, fileName: args.dbFullName, container, readonly: false });
  }

  public override beforeClose(): void {
    // when saved, CatalogIModels should never have any Txns. If we wanted to create a changeset, we'd have to do it here.
    this[_nativeDb].deleteAllTxns();
    // might also want to vacuum here?
    super.beforeClose();
  }

  public static async createNewVersion(args: CatalogIModelTypes.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModelTypes.NameAndVersion, newDb: CatalogIModelTypes.NameAndVersion }> {
    const container = await getWriteableContainer(args.containerId);
    ensureLocked(container, "create a new version");
    return CloudSqlite.createNewDbVersion(container, args);
  }
}

export class CatalogIModelHandler extends IpcHandler implements CatalogIModelTypes.IpcMethods {
  public get channelName(): CatalogIModelTypes.IpcChannel { return "catalogIModel/ipc"; }

  public async createNewContainer(args: CatalogIModelTypes.CreateNewContainerArgs): Promise<CatalogIModelTypes.NewContainerProps> {
    return EditableCatalog.createNewContainer(args);
  }
  public async acquireWriteLock(args: CatalogIModelTypes.ContainerArg & { username: string; }): Promise<void> {
    return EditableCatalog.acquireWriteLock(args);
  }
  public async releaseWriteLock(args: CatalogIModelTypes.ContainerArg & { abandon?: true; }): Promise<void> {
    return EditableCatalog.releaseWriteLock(args);
  }
  public async openReadonly(args: CatalogIModelTypes.OpenReadonlyArgs): Promise<IModelConnectionProps> {
    return CatalogDb.openCatalog(args);
  }
  public async openEditable(args: CatalogIModelTypes.OpenEditableArgs): Promise<IModelConnectionProps> {
    return EditableCatalog.openEditable(args);
  }
  public async createNewVersion(args: CatalogIModelTypes.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModelTypes.NameAndVersion; newDb: CatalogIModelTypes.NameAndVersion; }> {
    return EditableCatalog.createNewVersion(args);
  }
}
