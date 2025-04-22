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
import { BriefcaseIdValue, CatalogError, type CatalogIModel, CloudSqliteError, IModelConnectionProps } from "@itwin/core-common";
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

// we make a readonly CloudCache and a writeable CloudCache. That way the access token authorizations are distinct.
function makeCloudCache(arg: CloudSqlite.CreateCloudCacheArg, writeable: boolean) {
  const cache = CloudSqlite.CloudCaches.getCache(arg) as CatalogCloudCache;
  // if the cache was just created, add the "catalog" members as hidden
  if (undefined === cache.catalogContainers) {
    CloudSqlite.addHiddenProperty(cache, "catalogContainers", new Map<string, CloudSqlite.CloudContainer>());
    CloudSqlite.addHiddenProperty(cache, "writeable", writeable);
  }
  return cache;
}

// find an existing CloudContainer for accessing a CatalogIModel, or make a new one and connect it
async function getCatalogContainerObj(cache: CatalogCloudCache, containerId: string): Promise<CloudSqlite.CloudContainer> {
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
  cache.catalogContainers.set(containerId, container); // save the container in the map of ContainerIds so we can reuse them
  container.connect(cache);
  return container;
}

function getReadonlyCloudCache() { return readonlyCloudCache ??= makeCloudCache({ cacheName: "catalogs", cacheSize: "10G" }, false) };
function getWritableCloudCache() { return writeableCloudCache ??= makeCloudCache({ cacheName: "writeableCatalogs", cacheSize: "10G" }, true) };
async function getReadonlyContainer(containerId: string) { return getCatalogContainerObj(getReadonlyCloudCache(), containerId) };
async function getWriteableContainer(containerId: string) { return getCatalogContainerObj(getWritableCloudCache(), containerId) };

/** Throw an error if the write lock is not held for the supplied container */
function ensureLocked(container: CloudSqlite.CloudContainer, reason: string) {
  if (!container.hasWriteLock)
    CloudSqliteError.throwError("write-lock-not-held", { message: `Write lock must be held to ${reason}` });
}
/** update the manifest in a CatalogIModel (calls `saveChanges`) */
function updateManifest(nativeDb: IModelJsNative.DgnDb, manifest: CatalogIModel.Manifest) {
  nativeDb.saveLocalValue(catalogManifestName, JSON.stringify(manifest));
  nativeDb.saveChanges("update manifest");
}
function catalogDbNameWithDefault(dbName?: string): string {
  return dbName ?? "catalog-db";
}

/** A [[StandaloneDb]] that provides read-only access to the contents of a [CatalogIModel]($common).
 * @see [[CatalogDb.openReadonly]] to instantiate this type.
 * @beta
 */
export interface CatalogDb extends StandaloneDb {
  /** Get the catalog's manifest. */
  getManifest(): CatalogIModel.Manifest | undefined;
  /** Get the catalog's version information. */
  getVersion(): string;
  /** Get the catalog's manifest and version. */
  getInfo(): { manifest?: CatalogIModel.Manifest, version: string };
  /** Returns true if the catalog was opened in read-write mode. */
  isEditable(): this is EditableCatalogDb;
}

/** A writable [[CatalogDb]].
 * @see [[CatalogDb.openEditable]] to instantiate this type.
 * @beta
 */
export interface EditableCatalogDb extends CatalogDb {
  /** Update the contents of the catalog manifest.  */
  updateCatalogManifest(manifest: CatalogIModel.Manifest): void;
}

/** A StandaloneDb that holds a CatalogIModel */
class CatalogDbImpl extends StandaloneDb implements CatalogDb {
  public isEditable(): this is EditableCatalogDb {
    return false;
  }

  public getManifest(): CatalogIModel.Manifest | undefined {
    const manifestString = this[_nativeDb].queryLocalValue(catalogManifestName);
    if (undefined === manifestString)
      return undefined;
    return JSON.parse(manifestString) as CatalogIModel.Manifest;
  }

  public getVersion(): string {
    return CloudSqlite.parseDbFileName(this[_nativeDb].getFilePath()).version;
  }

  public getInfo() {
    return { manifest: this.getManifest(), version: this.getVersion() };
  }
}

/**
 * A CatalogDb that permits editing.
 * This class ensures that CatalogIModels never have a Txn table when they are published.
 * It also automatically updates the `lastEditedBy` field in the CatalogManifest.
 */
class EditableCatalogDbImpl extends CatalogDbImpl implements EditableCatalogDb {
  public override isEditable(): this is EditableCatalogDb {
    return true;
  }

  public updateCatalogManifest(manifest: CatalogIModel.Manifest): void {
    updateManifest(this[_nativeDb], manifest);
  }

  // Make sure the txn table is deleted and update the manifest every time we close.
  public override beforeClose(): void {
    try {
      const manifest = this.getManifest();
      const container = this.cloudContainer;
      if (container && manifest) {
        manifest.lastEditedBy = CloudSqlite.getWriteLockHeldBy(container);
        this.updateCatalogManifest(manifest);
      }

      // when saved, CatalogIModels should never have any Txns. If we wanted to create a changeset, we'd have to do it here.
      this[_nativeDb].deleteAllTxns();
    } catch { } // ignore errors attempting to update

    // might also want to vacuum here?
    super.beforeClose();
  }
}

function findCatalogByKey(key: string): CatalogDbImpl & EditableCatalogDb {
  return CatalogDbImpl.findByKey(key) as CatalogDbImpl & EditableCatalogDb;
}

/** @beta */
export namespace CatalogDb {
  /** Create a new [[BlobContainer]] to hold versions of a [[CatalogDb]].
   * @returns The properties of the newly created container.
   * @note creating new containers requires "admin" authorization.
  */
  export async function createNewContainer(args: CatalogIModel.CreateNewContainerArgs): Promise<CatalogIModel.NewContainerProps> {
    const dbName = catalogDbNameWithDefault(args.dbName);
    CloudSqlite.validateDbName(dbName);
    CloudSqlite.validateDbVersion(args.version);

    const tmpName = join(KnownLocations.tmpdir, `temp-${dbName}`);
    try {
      // make a copy of the file they supplied so we can modify its contents safely
      fs.copyFileSync(args.localCatalogFile, tmpName);
      const nativeDb = new IModelNative.platform.DgnDb();
      nativeDb.openIModel(tmpName, OpenMode.ReadWrite);
      nativeDb.setITwinId(Guid.empty); // catalogs must be a StandaloneDb
      nativeDb.setIModelId(Guid.createValue()); // make sure its iModelId is unique
      updateManifest(nativeDb, args.manifest); // store the manifest inside the Catalog
      nativeDb.deleteAllTxns(); // Catalogs should never have Txns (and, this must be empty before resetting BriefcaseId)
      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned); // catalogs should always be unassigned
      nativeDb.saveChanges(); // save change to briefcaseId
      nativeDb.vacuum();
      nativeDb.closeFile();
    } catch (e: unknown) {
      CatalogError.throwError("invalid-seed-catalog", { message: "Illegal seed catalog", ...args, cause: e });
    }

    const userToken = await IModelHost.getAccessToken();
    // create tne new container from the blob service, requires "admin" authorization
    const cloudContainerProps = await CloudSqlite.getBlobService().create({ scope: { iTwinId: args.iTwinId }, metadata: { ...args.metadata, containerType: "CatalogIModel" }, userToken });

    // now create a CloudSqlite container object to access it
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

    // upload the initial version of the Catalog
    await CloudSqlite.withWriteLock({ user: "initialize", container }, async () => {
      await CloudSqlite.uploadDb(container, { dbName: CloudSqlite.makeSemverName(dbName, args.version), localFileName: tmpName });
      fs.unlinkSync(tmpName); // delete temporary copy of catalog
    });
    container.disconnect();
    return cloudContainerProps;
  }

  /** Acquire the write lock for a [CatalogIModel]($common) container. Only one person may obtain the write lock at a time.
   * You must obtain the lock before attempting to write to the container via functions like [[CatalogDb.openEditable]] and [[CatalogDb.createNewVersion]].
   * @note This requires "write" authorization to the container
   */
  export async function acquireWriteLock(args: {
    /** The id of the container */
    containerId: string,
    /**
     * The name of the individual acquiring the lock. This will be shown to others who attempt to acquire the lock while it is held.
     * It is also stored in the "lastEditedBy" field of the manifest of any new version edited while the lock is held.
     */
    username: string;
  }): Promise<void> {
    const container = await getWriteableContainer(args.containerId);
    return CloudSqlite.acquireWriteLock({ container, user: args.username });
  }

  /** Release the write lock on a [CatalogIModel]($common) container. This uploads all changes made while the lock is held, so they become visible to other users. */
  export async function releaseWriteLock(args: {
    /** The id of the container */
    containerId: string,
    /** If true, abandon all local changes before releasing the lock */
    abandon?: true
  }): Promise<void> {
    const container = await getWriteableContainer(args.containerId);
    if (args.abandon)
      container.abandonChanges();
    CloudSqlite.releaseWriteLock(container);
  }

  /** Open an [[EditableCatalogDb]] for write access.
   * @note Once a version of a catalog iModel has been published (i.e. the write lock has been released), it is no longer editable, *unless* it is a prerelease version.
   * @note The write lock must be held for this operation to succeed
   */
  export async function openEditable(args: CatalogIModel.OpenArgs): Promise<EditableCatalogDb> {
    const dbName = catalogDbNameWithDefault(args.dbName);
    if (undefined === args.containerId) // local file?
      return EditableCatalogDbImpl.openFile(dbName, OpenMode.ReadWrite, args) as EditableCatalogDbImpl;

    const container = await getWriteableContainer(args.containerId);
    ensureLocked(container, "open a Catalog for editing"); // editing Catalogs requires the write lock

    // look up the full name with version
    const dbFullName = CloudSqlite.querySemverMatch({ container, dbName, version: args.version ?? "*" });
    if (!CloudSqlite.isSemverEditable(dbFullName, container))
      CloudSqliteError.throwError("already-published", { message: "Catalog has already been published and is not editable. Make a new version first.", ...args })

    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, dbFullName);

    return EditableCatalogDbImpl.openFile(dbFullName, OpenMode.ReadWrite, { container, ...args }) as EditableCatalogDbImpl;
  }

  /** Open a [[CatalogDb]] for read-only access. */
  export async function openReadonly(args: CatalogIModel.OpenArgs): Promise<CatalogDb> {
    const dbName = catalogDbNameWithDefault(args.dbName);
    if (undefined === args.containerId) // local file?
      return CatalogDbImpl.openFile(dbName, OpenMode.Readonly, args) as CatalogDbImpl;

    const container = await getReadonlyContainer(args.containerId);
    if (args.syncWithCloud)
      container.checkForChanges();

    const dbFullName = CloudSqlite.querySemverMatch({ container, ...args, dbName });
    if (args.prefetch)
      CloudSqlite.startCloudPrefetch(container, dbFullName);

    return CatalogDbImpl.openFile(dbFullName, OpenMode.Readonly, { container, ...args }) as CatalogDbImpl;
  }

  /**
   * Create a new version of a [CatalogIModel]($common) as a copy of an existing version. Immediately after this operation, the new version will be an exact copy
   * of the source CatalogIModel. Then, use [[CatalogDb.openEditable]] to modify the new version with new content.
   * @note The write lock must be held for this operation to succeed
   */
  export async function createNewVersion(args: CatalogIModel.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModel.NameAndVersion; newDb: CatalogIModel.NameAndVersion; }> {
    const container = await getWriteableContainer(args.containerId);
    ensureLocked(container, "create a new version");
    return CloudSqlite.createNewDbVersion(container, { ...args, fromDb: { ...args.fromDb, dbName: catalogDbNameWithDefault(args.fromDb.dbName) } });
  }
}

/**
 * Handler for Ipc access to CatalogIModels. Registered by NativeHost.
 * @internal
 */
export class CatalogIModelHandler extends IpcHandler implements CatalogIModel.IpcMethods {
  public get channelName(): CatalogIModel.IpcChannel { return "catalogIModel/ipc"; }

  public async createNewContainer(args: CatalogIModel.CreateNewContainerArgs): Promise<CatalogIModel.NewContainerProps> {
    return CatalogDb.createNewContainer(args);
  }
  public async acquireWriteLock(args: { containerId: string, username: string; }): Promise<void> {
    return CatalogDb.acquireWriteLock(args);
  }
  public async releaseWriteLock(args: { containerId: string, abandon?: true; }): Promise<void> {
    return CatalogDb.releaseWriteLock(args);
  }
  public async openReadonly(args: CatalogIModel.OpenArgs): Promise<IModelConnectionProps> {
    return ((await CatalogDb.openReadonly(args)).getConnectionProps());
  }
  public async openEditable(args: CatalogIModel.OpenArgs): Promise<IModelConnectionProps> {
    return (await CatalogDb.openEditable(args)).getConnectionProps();
  }
  public async createNewVersion(args: CatalogIModel.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModel.NameAndVersion; newDb: CatalogIModel.NameAndVersion; }> {
    return CatalogDb.createNewVersion(args);
  }
  public async getInfo(key: string): Promise<{ manifest?: CatalogIModel.Manifest, version: string }> {
    return findCatalogByKey(key).getInfo();
  }
  public async updateCatalogManifest(key: string, manifest: CatalogIModel.Manifest): Promise<void> {
    findCatalogByKey(key).updateCatalogManifest(manifest);
  }
}
