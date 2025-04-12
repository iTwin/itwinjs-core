/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import * as fs from "fs";
import { join } from "path";
import { CloudSqlite } from "./CloudSqlite";
import { IModelHost, KnownLocations } from "./IModelHost";
import { BriefcaseIdValue, CatalogError, type CatalogIModelTypes, CloudSqliteError, IModelConnectionProps } from "@itwin/core-common";
import { IpcHandler } from "./IpcHost";
import { StandaloneDb } from "./IModelDb";
import { Guid, OpenMode } from "@itwin/core-bentley";
import { _nativeDb } from "./internal/Symbols";
import { IModelNative } from "./internal/NativePlatform";
import { IModelJsNative } from "@bentley/imodeljs-native";

interface CatalogCloudCache extends CloudSqlite.CloudCache {
  writeable: boolean;
  catalogContainers: Map<string, CloudSqlite.CloudContainer>;
}

let readonlyCloudCache: CatalogCloudCache | undefined;
let writeableCloudCache: CatalogCloudCache | undefined;
const catalogManifestName = "CatalogManifest";

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
function ensureLocked(container: CloudSqlite.CloudContainer, reason: string) {
  if (!container.hasWriteLock)
    CloudSqliteError.throwError("write-lock-not-held", { message: `Write lock must be held to ${reason}` });
}

function updateManifest(nativeDb: IModelJsNative.DgnDb, manifest: CatalogIModelTypes.CatalogManifest) {
  nativeDb.saveLocalValue(catalogManifestName, JSON.stringify(manifest));
  nativeDb.saveChanges("update manifest");
}
function catalogDbNameWithDefault(dbName?: string): string {
  return dbName ?? "catalog-db";
}

class CatalogDb extends StandaloneDb implements ReadCatalog {
  public getManifest(): CatalogIModelTypes.CatalogManifest {
    const manifestString = this[_nativeDb].queryLocalValue(catalogManifestName);
    if (undefined === manifestString)
      CatalogError.throwError("manifest-missing", { message: "Manifest is missing from Catalog" });
    return JSON.parse(manifestString) as CatalogIModelTypes.CatalogManifest;
  }

  public getVersion(): string {
    return CloudSqlite.parseDbFileName(this[_nativeDb].getFilePath()).version;
  }

  public getInfo() {
    return { manifest: this.getManifest(), version: this.getVersion() };
  }
}

class EditableCatalogDb extends CatalogDb implements EditCatalog {
  public updateCatalogManifest(manifest: CatalogIModelTypes.CatalogManifest): void {
    updateManifest(this[_nativeDb], manifest);
  }

  public override beforeClose(): void {
    const nativeDb = this[_nativeDb];
    const manifest = this.getManifest();
    const container = nativeDb.cloudContainer;
    if (container && manifest) {
      manifest.lastEditedBy = CloudSqlite.getWriteLockHeldBy(container);
      updateManifest(nativeDb, manifest);
    }

    // when saved, CatalogIModels should never have any Txns. If we wanted to create a changeset, we'd have to do it here.
    nativeDb.deleteAllTxns();

    // might also want to vacuum here?
    super.beforeClose();
  }
}

function findCatalogByKey(key: string): CatalogDb & EditCatalog {
  return CatalogDb.findByKey(key) as CatalogDb & EditCatalog;
}

/**
 * Methods for reading from an open CatalogIModel
 * @beta
 */
export interface ReadCatalog {
  getManifest(): CatalogIModelTypes.CatalogManifest;
  getVersion(): string;
  getInfo(): { manifest: CatalogIModelTypes.CatalogManifest, version: string };
}

/**
 * Methods for reading and modifying a CatalogIModel that was opened by [[CatalogImodel.openEditable]]
 * @beta
 */
export interface EditCatalog extends ReadCatalog {
  updateCatalogManifest(manifest: CatalogIModelTypes.CatalogManifest): void;
}

/** Functions for accessing CatalogIModels either from a local disk or from a cloud container.
 * @beta
 */
export namespace CatalogIModel {
  export async function createNewContainer(args: CatalogIModelTypes.CreateNewContainerArgs): Promise<CatalogIModelTypes.NewContainerProps> {
    const dbName = catalogDbNameWithDefault(args.dbName);
    CloudSqlite.validateDbName(dbName);
    CloudSqlite.validateDbVersion(args.version);

    const tmpName = join(KnownLocations.tmpdir, `temp-${dbName}`);
    try {
      fs.copyFileSync(args.localCatalogFile, tmpName);
      const nativeDb = new IModelNative.platform.DgnDb();
      nativeDb.openIModel(tmpName, OpenMode.ReadWrite);
      nativeDb.setITwinId(Guid.empty);
      nativeDb.setIModelId(Guid.createValue()); // make sure it's unique
      updateManifest(nativeDb, args.manifest);
      nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned); // catalogs should always be unassigned
      nativeDb.saveChanges(); // save change to briefcaseId
      nativeDb.vacuum();
      nativeDb.closeFile();
    } catch (e: unknown) {
      CatalogError.throwError("invalid-seed-catalog", { message: "Illegal seed catalog", ...args, cause: e });
    }

    const userToken = await IModelHost.getAccessToken();
    const cloudContainerProps = await CloudSqlite.getBlobService().create({ scope: { iTwinId: args.iTwinId }, metadata: { ...args.metadata, containerType: "CatalogIModel" }, userToken });

    const container = CloudSqlite.createCloudContainer({
      accessToken: await CloudSqlite.requestToken(cloudContainerProps),
      accessLevel: "admin",
      writeable: true,
      baseUri: cloudContainerProps.baseUri,
      containerId: cloudContainerProps.containerId,
      storageType: cloudContainerProps.provider,
    });

    // initialize the container for use by CloudSqlite
    container.initializeContainer({ blockSize: 4 * 1024 * 1024 });
    container.connect(getWritableCloudCache());

    // upload the initial version of the catalog
    await CloudSqlite.withWriteLock({ user: "initialize", container }, async () => {
      await CloudSqlite.uploadDb(container, { dbName: CloudSqlite.makeSemverName(dbName, args.version), localFileName: tmpName });
      fs.unlinkSync(tmpName); // delete temporary copy of catalog
    });
    container.disconnect({ detach: true });
    return cloudContainerProps;
  }

  export async function acquireWriteLock(args: { containerId: string, username: string; }): Promise<void> {
    const container = await getWriteableContainer(args.containerId);
    return CloudSqlite.acquireWriteLock({ container, user: args.username });
  }
  export async function releaseWriteLock(args: { containerId: string, abandon?: true; }): Promise<void> {
    const container = await getWriteableContainer(args.containerId);
    if (args.abandon)
      container.abandonChanges();
    CloudSqlite.releaseWriteLock(container);
  }

  export async function openEditable(args: CatalogIModelTypes.OpenArgs): Promise<StandaloneDb & EditCatalog> {
    const dbName = catalogDbNameWithDefault(args.dbName);
    if (undefined === args.containerId) // local file?
      return EditableCatalogDb.openFile(dbName, OpenMode.ReadWrite, args) as EditableCatalogDb;

    const container = await getWriteableContainer(args.containerId);
    ensureLocked(container, "open a Catalog for editing");

    const dbFullName = CloudSqlite.querySemverMatch({ container, dbName, version: args.version ?? "*" });
    if (!CloudSqlite.isSemverEditable(dbFullName, container))
      CloudSqliteError.throwError("already-published", { message: "Catalog has already been published and is not editable. Make a new version first.", ...args })

    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, dbFullName);

    return EditableCatalogDb.openFile(dbFullName, OpenMode.ReadWrite, { container, ...args }) as EditableCatalogDb;
  }
  export async function openReadonly(args: CatalogIModelTypes.OpenArgs): Promise<StandaloneDb & ReadCatalog> {
    const dbName = catalogDbNameWithDefault(args.dbName);
    if (undefined === args.containerId) // local file?
      return CatalogDb.openFile(dbName, OpenMode.Readonly, args) as CatalogDb;

    const container = await getReadonlyContainer(args.containerId);
    if (args.syncWithCloud)
      container.checkForChanges();

    const dbFullName = CloudSqlite.querySemverMatch({ container, ...args, dbName });
    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, dbFullName);

    return CatalogDb.openFile(dbFullName, OpenMode.Readonly, { container, ...args }) as CatalogDb;
  }

  export async function createNewVersion(args: CatalogIModelTypes.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModelTypes.NameAndVersion; newDb: CatalogIModelTypes.NameAndVersion; }> {
    const container = await getWriteableContainer(args.containerId);
    ensureLocked(container, "create a new version");
    return CloudSqlite.createNewDbVersion(container, { ...args, fromDb: { ...args.fromDb, dbName: catalogDbNameWithDefault(args.fromDb.dbName) } });
  }
}

/**
 * Handler for Ipc access to CatalogIModels. Registered by NativeHost.
 * @internal
 */
export class CatalogIModelHandler extends IpcHandler implements CatalogIModelTypes.IpcMethods {
  public get channelName(): CatalogIModelTypes.IpcChannel { return "catalogIModel/ipc"; }

  public async createNewContainer(args: CatalogIModelTypes.CreateNewContainerArgs): Promise<CatalogIModelTypes.NewContainerProps> {
    return CatalogIModel.createNewContainer(args);
  }
  public async acquireWriteLock(args: { containerId: string, username: string; }): Promise<void> {
    return CatalogIModel.acquireWriteLock(args);
  }
  public async releaseWriteLock(args: { containerId: string, abandon?: true; }): Promise<void> {
    return CatalogIModel.releaseWriteLock(args);
  }
  public async openReadonly(args: CatalogIModelTypes.OpenArgs): Promise<IModelConnectionProps> {
    return ((await CatalogIModel.openReadonly(args)).getConnectionProps());
  }
  public async openEditable(args: CatalogIModelTypes.OpenArgs): Promise<IModelConnectionProps> {
    return (await CatalogIModel.openEditable(args)).getConnectionProps();
  }
  public async createNewVersion(args: CatalogIModelTypes.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModelTypes.NameAndVersion; newDb: CatalogIModelTypes.NameAndVersion; }> {
    return CatalogIModel.createNewVersion(args);
  }
  public async getInfo(key: string): Promise<{ manifest: CatalogIModelTypes.CatalogManifest, version: string }> {
    return findCatalogByKey(key).getInfo();
  }
  public async updateCatalogManifest(key: string, manifest: CatalogIModelTypes.CatalogManifest): Promise<void> {
    findCatalogByKey(key).updateCatalogManifest(manifest);
  }
}
