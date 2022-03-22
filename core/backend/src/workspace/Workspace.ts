/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { createHash } from "crypto";
import * as fs from "fs-extra";
import { dirname, extname, join } from "path";
import { CloudSqlite, IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { BeEvent, DbResult, OpenMode, Optional } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";
import { Settings, SettingsPriority } from "./Settings";
import { IModelHost, KnownLocations } from "../IModelHost";
import { existsSync, rmSync } from "fs-extra";
import * as semver from "semver";

// cspell:ignore rowid primarykey

/** The names of Settings used by Workspace
 * @beta
 */
enum WorkspaceSetting {
  ContainerAlias = "workspace/container/alias",
}

const workspaceDbFileExt = "itwin-workspace";

export namespace WorkspaceContainer {
  /**
   * The name of a WorkspaceContainer. This is the user-supplied name of a WorkspaceContainer, used to specify its *purpose* within a workspace.
   * WorkspaceContainer.Name can be "aliased" by `WorkspaceSetting.containerAlias` settings so that the resolved [[WorkspaceContainer.Id]] that supplies
   * the actual container  may vary. Also note that more than one WorkspaceContainer.Name may resolve to the same
   * WorkspaceContainer.Id, if multiple purposes are served by the same WorkspaceContainer.
   * @note there are no constraints on the contents or length of `WorkspaceContainer.Name`s, although short descriptive names are recommended.
   * However, when no alias exists in WorkspaceSetting.containerAlias for a WorkspaceContainer.Name, then the WorkspaceContainer.Name becomes
   * the WorkspaceContainer.Id, and the constraints on WorkspaceContainer.Id apply.
   * @beta
   */
  export type Name = string;

  /**
   * The unique identifier of a WorkspaceContainer. This becomes the base name for the local directory holding the WorkspaceDbs from a WorkspaceContainer.
   * `WorkspaceContainer.Name`s are resolved to WorkspaceContainer.Id through `WorkspaceSetting.containerAlias` settings,
   * so users may not recognize the actual WorkspaceContainer.Id supplying resources for a WorkspaceDb.Name.
   *
   * `WorkspaceContainer.Id`s :
   *  - may only contain lower case letters, numbers or dashes
   *  - may not start or end with with a dash
   *  - be shorter than 3 or longer than 63 characters
   * @beta
   */
  export type Id = string;

  /**
 * Properties that specify a WorkspaceContainer.
 * @beta
 */
  export type Props = Optional<CloudSqlite.ContainerAccessProps, "accountName" | "storageType" | "sasToken">;
}

export namespace WorkspaceDb {
  /** The name of a WorkspaceDb within a WorkspaceContainer.
   * @beta
   */
  export type Name = string;

  /**
   * The version name for a WorkspaceDb. More than one version of a WorkspaceDb may be stored in the same WorkspaceContainer. This
   * string identifies a specific version or a range of acceptable versions according to [semver Range format](https://github.com/npm/node-semver)
   * @beta
   */

  export type Version = string;

  /** Properties of a WorkspaceDb
   * @beta
   */
  export interface Props extends CloudSqlite.DbNameProp { version?: WorkspaceDb.Version, includePrerelease?: boolean }

  /** Type of version to increment.
   * @see semver.ReleaseType
   */
  export type VersionIncrement = "major" | "minor" | "patch";
}

export namespace WorkspaceResource {
  /**
   * The name for identifying WorkspaceResources in a [[WorkspaceDb]].
   * * `WorkspaceResource.Name`s may not:
   *  - be blank or start or end with a space
   *  - be longer than 1024 characters
   * @note a single WorkspaceDb may hold WorkspaceResources of type 'blob', 'string' and 'file', all with the same WorkspaceResource.Name.
   * @beta
   */
  export type Name = string;

  /** Properties that specify a WorkspaceResource within a WorkspaceDb.
   * @beta
   */
  export type Props = WorkspaceDb.Props & {
    /** the name of the resource within [[db]] */
    rscName: Name;
  };
}

/**
 * A WorkspaceDb holds workspace resources. `WorkspaceDb`s may just be local files, or they may be  stored and
 * synchronized in WorkspaceContainers. Each `WorkspaceResource` in a WorkspaceDb is  identified by a [[WorkspaceResource.Name]].
 * Resources of type `string` and `blob` may be loaded directly from the `WorkspaceDb`. Resources of type `file` are
 * copied from the WorkspaceDb into a temporary local file so they can be accessed directly.
 * @beta
 */
export interface WorkspaceDb {
  readonly container: WorkspaceContainer;
  /** The base name of this WorkspaceDb, without version */
  readonly dbName: WorkspaceDb.Name;
  /** event raised before this WorkspaceDb is closed. */
  readonly onClose: BeEvent<() => void>;
  /** either a local file name or the name of a file in a cloud container */
  readonly dbFileName: string;
  /** Get a string resource from this WorkspaceDb, if present. */
  getString(rscName: WorkspaceResource.Name): string | undefined;

  /** Get a blob resource from this WorkspaceDb, if present. */
  getBlob(rscName: WorkspaceResource.Name): Uint8Array | undefined;
  /** @internal */
  getBlobReader(rscName: WorkspaceResource.Name): IModelJsNative.BlobIO;

  /** Extract a local copy of a file resource from this WorkspaceDb, if present.
   * @param rscName The name of the file resource in the WorkspaceDb
   * @param targetFileName optional name for extracted file. Some applications require files in specific locations or filenames. If
   * you know the full path to use for the extracted file, you can supply it. Generally, it is best to *not* supply the filename and
   * keep the extracted files in the  container filesDir.
   * @returns the full path to a file on the local filesystem.
   * @note The file is copied from the file into the local filesystem so it may be accessed directly. This happens only
   * as necessary, if the local file doesn't exist, or if it is out-of-date because it was updated in the file.
   * For this reason, you should not save the local file name, and instead call this method every time you access it, so its
   * content is always holds the correct version.
   * @note The filename will be a hash value, not the resource name.
   * @note Workspace resource files are set readonly as they are copied from the file.
   * To edit them, you must first copy them to another location.
   */
  getFile(rscName: WorkspaceResource.Name, targetFileName?: LocalFileName): LocalFileName | undefined;

  /**
   * Ensure that the contents of a `WorkspaceDb` are downloaded into the local cache so that it may be accessed offline.
   * Until the promise is resolved, the `WorkspaceDb` is not fully downloaded, but it may be safely accessed while the download is pending.
   * To determine the progress of the download, use the `localBlocks` and `totalBlocks` values returned by `CloudContainer.queryDatabase`.
   */
  prefetch(): Promise<void>;
}

export interface WorkspaceCloudCacheProps extends Optional<CloudSqlite.CacheProps, "name" | "rootDir"> {
  /** if true, empty the cache before using it. */
  clearContents?: boolean;
}

/**
 * Options for constructing a [[Workspace]].
 * @beta
 */
export interface WorkspaceOpts {
  /** The local directory for the WorkspaceDb files. The [[Workspace]] will look in this directory
   * for files named `${this.containerId}/${this.dbId}.itwin-workspace`.
   * @note if not supplied, defaults to `iTwin/Workspace` in the user-local folder.
   */
  containerDir?: LocalDirName;

  /** Properties for the cloud cache for the `WorkspaceContainers` of the Workspace. */
  cloudCache?: WorkspaceCloudCacheProps;
}

/**
 * Settings and resources that customize an application for the current session.
 * See [Workspaces]($docs/learning/backend/Workspace)
 * @beta
 */
export interface Workspace {
  /** The local directory for the WorkspaceDb files with the name `${containerId}.itwin-workspace`. */
  readonly containerDir: LocalDirName;
  /** The [[Settings]] for this Workspace */
  readonly settings: Settings;
  readonly cloudCache?: IModelJsNative.CloudCache;

  getContainer(props: WorkspaceContainer.Props): WorkspaceContainer;

  /**
   * Resolve a WorkspaceContainer.Name to a WorkspaceContainer.Id.
   * The highest priority [[WorkspaceSetting.containerAlias]] setting with an entry for the WorkspaceContainer.Name
   * is used. If no WorkspaceSetting.containerAlias entry for the WorkspaceContainer.Name can be found, the name is returned as the id.
   */
  resolveContainerName(containerName: WorkspaceContainer.Name): WorkspaceContainer.Id;

  /**
   * Get an open [[WorkspaceDb]]. If the WorkspaceDb is present but not open, it is opened first.
   * If `cloudProps` are supplied, and if container is not  present or not up-to-date, it is downloaded first.
   * @returns a Promise that is resolved when the container is local, opened, and available for access.
   */
  getWorkspaceDb(props: WorkspaceDb.Props & WorkspaceContainer.Props): Promise<WorkspaceDb>;

  /** Load a WorkspaceResource of type string, parse it, and add it to the current Settings for this Workspace.
   * @note settingsRsc must specify a resource holding a stringified JSON representation of a [[SettingDictionary]]
   * @returns a Promise that is resolved when the settings resource has been loaded.
   */
  loadSettingsDictionary(settingRsc: WorkspaceResource.Props, priority: SettingsPriority): Promise<void>;

  /** Close this Workspace. All WorkspaceContainers are dropped. */
  close(): void;
}

/**
 * A WorkspaceContainer holds WorkspaceDbs.
 * Access rights are administered per WorkspaceContainer. That is, if a user has rights to access a WorkspaceContainer, that right
 * applies to all WorkspaceDbs in the WorkspaceContainer.
 * @beta
 */
export interface WorkspaceContainer {
  readonly dirName: LocalDirName;
  /** the local directory where this WorkspaceContainer will store temporary files extracted for file-resources. */
  readonly filesDir: LocalDirName;
  /** The unique identifier for a WorkspaceContainer a cloud storage account. */
  readonly id: WorkspaceContainer.Id;
  /** Workspace holding this WorkspaceContainer. */
  readonly workspace: Workspace;
  /** CloudContainer for this WorkspaceContainer (`undefined` if this is a local WorkspaceContainer.) */
  readonly cloudContainer?: IModelJsNative.CloudContainer;

  /** @internal */
  addWorkspaceDb(toAdd: ITwinWorkspaceDb): void;
  /** @internal */
  resolveFileName(props: WorkspaceDb.Props): string;

  /** find or open a WorkspaceDb from this WorkspaceContainer. */
  getWorkspaceDb(props: WorkspaceDb.Props): Promise<WorkspaceDb>;
  /** Close and remove a currently opened [[WorkspaceDb]] from this Workspace. */
  dropWorkspaceDb(container: WorkspaceDb): void;
  /** Close this WorkspaceContainer. All currently opened WorkspaceDbs are dropped. */
  close(): void;
}

/** @internal */
export class ITwinWorkspace implements Workspace {
  private _containers = new Map<WorkspaceContainer.Id, ITwinWorkspaceContainer>();
  public readonly containerDir: LocalDirName;
  public readonly settings: Settings;

  private _cloudCacheProps?: WorkspaceCloudCacheProps;
  private _cloudCache?: IModelJsNative.CloudCache;
  public get cloudCache(): IModelJsNative.CloudCache {
    if (undefined === this._cloudCache) {
      const cacheProps = {
        ...this._cloudCacheProps,
        rootDir: this._cloudCacheProps?.rootDir ?? join(this.containerDir, "cloud"),
        cacheSize: this._cloudCacheProps?.cacheSize ?? "20G",
        name: this._cloudCacheProps?.name ?? "workspace",
      };
      IModelJsFs.recursiveMkDirSync(cacheProps.rootDir);
      if (cacheProps.clearContents)
        fs.emptyDirSync(cacheProps.rootDir);
      this._cloudCache = new IModelHost.platform.CloudCache(cacheProps);
    }
    return this._cloudCache;
  }

  public constructor(settings: Settings, opts?: WorkspaceOpts) {
    this.settings = settings;
    this.containerDir = opts?.containerDir ?? join(NativeLibrary.defaultLocalDir, "iTwin", "Workspace");
    this._cloudCacheProps = opts?.cloudCache;
  }

  public addContainer(toAdd: ITwinWorkspaceContainer) {
    if (undefined !== this._containers.get(toAdd.id))
      throw new Error("container already exists in workspace");
    this._containers.set(toAdd.id, toAdd);
  }
  public getContainer(props: WorkspaceContainer.Props): WorkspaceContainer {
    return this._containers.get(props.containerId) ?? new ITwinWorkspaceContainer(this, props);
  }

  public async getWorkspaceDb(props: WorkspaceDb.Props & WorkspaceContainer.Props): Promise<WorkspaceDb> {
    return this.getContainer(props).getWorkspaceDb(props);
  }

  public async loadSettingsDictionary(settingRsc: WorkspaceResource.Props & WorkspaceContainer.Props, priority: SettingsPriority) {
    const db = await this.getWorkspaceDb(settingRsc);
    const setting = db.getString(settingRsc.rscName);
    if (undefined === setting)
      throw new Error(`could not load setting resource ${settingRsc.rscName}`);

    this.settings.addJson(`${db.container.id}/${db.dbName}/${settingRsc.rscName}`, priority, setting);
  }

  public close() {
    this.settings.close();
    for (const [_id, container] of this._containers)
      container.close();
    this._containers.clear();
  }

  public resolveContainerName(containerName: WorkspaceContainer.Name): WorkspaceContainer.Id {
    return this.settings.resolveSetting(WorkspaceSetting.ContainerAlias, (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "object" && entry.name === containerName && typeof entry.id === "string")
            return entry.id;
        }
      }
      return undefined; // keep going through all settings dictionaries
    }, containerName);
  }
}

/** @internal */
export class ITwinWorkspaceContainer implements WorkspaceContainer {
  public readonly workspace: ITwinWorkspace;
  public readonly filesDir: LocalDirName;
  public readonly id: WorkspaceContainer.Id;

  public readonly cloudContainer?: IModelJsNative.CloudContainer | undefined;
  private _wsDbs = new Map<WorkspaceDb.Name, ITwinWorkspaceDb>();
  public get dirName() { return join(this.workspace.containerDir, this.id); }

  public static noLeadingOrTrailingSpaces(name: string, msg: string) {
    if (name.trim() !== name)
      throw new Error(`${msg} [${name}] may not have leading or tailing spaces`);
  }

  /** rules for ContainerIds (from Azure, see https://docs.microsoft.com/en-us/rest/api/storageservices/naming-and-referencing-containers--blobs--and-metadata)
   *  - may only contain lower case letters, numbers or dashes
   *  - may not start or end with with a dash nor have more than one dash in a row
   *  - may not be shorter than 3 or longer than 63 characters
   */
  private static validateContainerId(id: WorkspaceContainer.Id) {
    if (!/^(?=.{3,63}$)[a-z0-9]+(-[a-z0-9]+)*$/g.test(id))
      throw new Error(`invalid containerId: [${id}]`);
  }

  public static validateDbName(dbName: WorkspaceDb.Name) {
    if (dbName === "" || dbName.length > 255 || /[#\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(dbName) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(dbName))
      throw new Error(`invalid dbName: [${dbName}]`);
    this.noLeadingOrTrailingSpaces(dbName, "dbName");
  }

  public constructor(workspace: ITwinWorkspace, props: WorkspaceContainer.Props) {
    ITwinWorkspaceContainer.validateContainerId(props.containerId);
    this.workspace = workspace;
    this.id = props.containerId;

    if (undefined !== props.storageType && undefined !== props.accountName)
      this.cloudContainer = new IModelHost.platform.CloudContainer(props as CloudSqlite.ContainerAccessProps);

    workspace.addContainer(this);
    this.filesDir = join(this.dirName, "Files");
    this.cloudContainer?.attach(this.workspace.cloudCache);
  }

  public static validateVersion(version?: string) {
    version = version ?? "1.0.0";
    if (version) {
      const opts = { loose: true, includePrerelease: true };
      // clean allows prerelease, so try it first. If that fails attempt to coerce it (coerce strips prerelease even if you say not to.)
      const semVersion = semver.clean(version, opts) ?? semver.coerce(version, opts)?.version;
      if (!semVersion)
        throw new Error("invalid version specification");
      version = semVersion;
    }
    return version;
  }

  public static parseDbFileName(dbFileName: string): { dbName: string, version: string } {
    const parts = dbFileName.split(":");
    return { dbName: parts[0], version: parts[1] };
  }

  public static makeDbFileName(dbName: string, version?: string): string {
    return `${dbName}:${this.validateVersion(version)}`;
  }

  public static resolveCloudFileName(cloudContainer: IModelJsNative.CloudContainer, props: WorkspaceDb.Props) {
    const dbName = props.dbName;
    const dbs = cloudContainer.queryDatabases(`${dbName}%`); // get all databases that start with dbName

    const versions = [];
    for (const db of dbs) {
      const thisDb = ITwinWorkspaceContainer.parseDbFileName(db);
      if (thisDb.dbName === dbName && "string" === typeof thisDb.version && thisDb.version.length > 0)
        versions.push(thisDb.version);
    }

    if (versions.length === 0)
      throw new Error(`WorkspaceDb ${dbName} not found`);

    const range = props.version ?? "*";
    try {
      const version = semver.maxSatisfying(versions, range, { loose: true, includePrerelease: props.includePrerelease });
      if (version)
        return `${dbName}:${version}`;
    } catch (e: unknown) {
    }
    throw new Error(`No version of [${dbName}] available for "${range}"`);
  }

  /** Create a copy of an existing WorkspaceDb with a new version number. */
  public static async makeNewVersion(cloudContainer: IModelJsNative.CloudContainer, fromProps: WorkspaceDb.Props, versionType: WorkspaceDb.VersionIncrement) {
    const oldName = this.resolveCloudFileName(cloudContainer, fromProps);
    const oldVersion = this.parseDbFileName(oldName);
    const newVersion = semver.inc(oldVersion.version, versionType);
    if (!newVersion)
      throw new Error("invalid version");

    const newName = this.makeDbFileName(oldVersion.dbName, newVersion);
    await cloudContainer.copyDatabase(oldName, newName);
    return { oldName, newName };
  }

  public resolveFileName(props: WorkspaceDb.Props): string {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return join(this.dirName, `${props.dbName}.${workspaceDbFileExt}`); // local file, versions not allowed

    return ITwinWorkspaceContainer.resolveCloudFileName(cloudContainer, props);
  }

  public addWorkspaceDb(toAdd: ITwinWorkspaceDb) {
    if (undefined !== this._wsDbs.get(toAdd.dbName))
      throw new Error(`workspaceDb ${toAdd.dbName} already exists in workspace`);
    this._wsDbs.set(toAdd.dbName, toAdd);
  }

  public async getWorkspaceDb(props: WorkspaceDb.Props): Promise<WorkspaceDb> {
    const db = this._wsDbs.get(props.dbName) ?? new ITwinWorkspaceDb(props, this);
    if (!db.isOpen)
      db.open();
    return db;
  }

  public dropWorkspaceDb(toDrop: WorkspaceDb): void {
    const name = toDrop.dbName;
    const wsDb = this._wsDbs.get(name);
    if (wsDb === toDrop) {
      wsDb.close();
      this._wsDbs.delete(name);
    }
  }

  public close() {
    for (const [_name, db] of this._wsDbs)
      db.close();
    this._wsDbs.clear();
  }

  public purgeContainerFiles() {
    IModelJsFs.purgeDirSync(this.filesDir);
  }
}

/**
 * Implementation of WorkspaceDb
 * @beta
 */
export class ITwinWorkspaceDb implements WorkspaceDb {
  /** the SQLiteDb for this WorkspaceDb*/
  public readonly sqliteDb = new SQLiteDb();
  /** the base WorkspaceDb name, without directory, extension, or version information. */
  public readonly dbName: WorkspaceDb.Name;
  /** The WorkspaceContainer holding this WorkspaceDb */
  public readonly container: WorkspaceContainer;
  /** called before db is closed */
  public readonly onClose = new BeEvent<() => void>();
  /** either a local file name or the name of the file in a cloud container, including version identifier */
  public dbFileName: string;

  /** true if this WorkspaceDb is currently open */
  public get isOpen() { return this.sqliteDb.isOpen; }
  public queryFileResource(rscName: WorkspaceResource.Name) {
    const info = this.sqliteDb.nativeDb.queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this.container.filesDir, createHash("sha1").update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  public constructor(props: WorkspaceDb.Props, container: WorkspaceContainer) {
    ITwinWorkspaceContainer.validateDbName(props.dbName);
    this.dbName = props.dbName;
    this.container = container;
    this.dbFileName = container.resolveFileName(props);
    container.addWorkspaceDb(this);
  }

  public open() {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.Readonly, this.container.cloudContainer);
  }

  public close(): void {
    if (this.isOpen) {
      this.onClose.raiseEvent();
      this.sqliteDb.closeDb();
      this.container.dropWorkspaceDb(this);
    }
  }

  public getString(rscName: WorkspaceResource.Name): string | undefined {
    return this.sqliteDb.withSqliteStatement("SELECT value from strings WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueString(0) : undefined;
    });
  }

  /** Get a BlobIO reader for a blob WorkspaceResource.
   * @note when finished, caller must call `close` on the BlobIO.
   */
  public getBlobReader(rscName: WorkspaceResource.Name): IModelJsNative.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobReader = new IModelJsNative.BlobIO();
      blobReader.open(this.sqliteDb.nativeDb, { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0) });
      return blobReader;
    });
  }

  public getBlob(rscName: WorkspaceResource.Name): Uint8Array | undefined {
    return this.sqliteDb.withSqliteStatement("SELECT value from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueBlob(0) : undefined;
    });
  }

  public getFile(rscName: WorkspaceResource.Name, targetFileName?: LocalFileName): LocalFileName | undefined {
    const file = this.queryFileResource(rscName);
    if (!file)
      return undefined;

    const info = file.info;
    const localFileName = targetFileName ?? file.localFileName;

    // check whether the file is already up to date.
    const stat = fs.existsSync(localFileName) && fs.statSync(localFileName);
    if (stat && Math.round(stat.mtimeMs) === info.date && stat.size === info.size)
      return localFileName; // yes, we're done

    // extractEmbeddedFile fails if the file exists or if the directory does not exist
    if (stat)
      fs.removeSync(localFileName);
    else
      IModelJsFs.recursiveMkDirSync(dirname(localFileName));

    this.sqliteDb.nativeDb.extractEmbeddedFile({ name: rscName, localFileName });
    const date = new Date(info.date);
    fs.utimesSync(localFileName, date, date); // set the last-modified date of the file to match date in container
    fs.chmodSync(localFileName, "0444"); // set file readonly
    return localFileName;
  }

  public async prefetch(): Promise<void> {
    const cloudContainer = this.container.cloudContainer;
    if (cloudContainer !== undefined)
      return CloudSqlite.prefetch(cloudContainer, this.dbName);
  }
}

/**
 * An editable [[WorkspaceDb]]. This is used by administrators for creating and modifying `WorkspaceDb`s.
 * For cloud-backed containers, the write token must be obtained before this class may be used. Only one user at at time
 * may be editing.
 * @beta
 */
export class EditableWorkspaceDb extends ITwinWorkspaceDb {
  private static validateResourceName(name: WorkspaceResource.Name) {
    ITwinWorkspaceContainer.noLeadingOrTrailingSpaces(name, "resource name");
    if (name.length > 1024)
      throw new Error("resource name too long");
  }

  private validateResourceSize(val: Uint8Array | string) {
    const len = typeof val === "string" ? val.length : val.byteLength;
    if (len > (1024 * 1024 * 1024)) // one gigabyte
      throw new Error("value is too large");
  }

  public override open() {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.ReadWrite, this.container.cloudContainer);
  }

  private getFileModifiedTime(localFileName: LocalFileName): number {
    return Math.round(fs.statSync(localFileName).mtimeMs);
  }

  private performWriteSql(rscName: WorkspaceResource.Name, sql: string, bind?: (stmt: SqliteStatement) => void) {
    this.sqliteDb.withSqliteStatement(sql, (stmt) => {
      stmt.bindString(1, rscName);
      bind?.(stmt);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc) {
        if (DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY === rc)
          throw new IModelError(rc, `resource "${rscName}" already exists`);

        throw new IModelError(rc, `workspace [${sql}]`);
      }
    });
    this.sqliteDb.saveChanges();
  }

  public async createDb(version?: string) {
    if (!this.container.cloudContainer) {
      EditableWorkspaceDb.createEmpty(this.dbFileName);
    } else {
      // currently the only way to create a workspaceDb in a cloud container is to create a temporary workspaceDb and upload it.
      const tempDbFile = join(KnownLocations.tmpdir, `empty.${workspaceDbFileExt}`);
      if (existsSync(tempDbFile))
        rmSync(tempDbFile);
      EditableWorkspaceDb.createEmpty(tempDbFile);
      this.dbFileName = ITwinWorkspaceContainer.makeDbFileName(this.dbName, version);
      await CloudSqlite.uploadDb(this.container.cloudContainer, { localFileName: tempDbFile, dbName: this.dbFileName });
      rmSync(tempDbFile);
    }
    this.open();
  }

  /** Create a new, empty, EditableWorkspaceDb for importing Workspace resources. */
  public static createEmpty(fileName: LocalFileName) {
    const db = new SQLiteDb();
    IModelJsFs.recursiveMkDirSync(dirname(fileName));
    db.createDb(fileName);
    db.executeSQL("CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT)");
    db.executeSQL("CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB)");
    db.saveChanges();
    db.closeDb();
  }

  public async upload(args: CloudSqlite.TransferDbProps) {
    if (this.container.cloudContainer)
      return CloudSqlite.uploadDb(this.container.cloudContainer, args);
  }

  /** Add a new string resource to this WorkspaceDb.
   * @param rscName The name of the string resource.
   * @param val The string to save.
   */
  public addString(rscName: WorkspaceResource.Name, val: string): void {
    EditableWorkspaceDb.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => stmt.bindString(2, val));
  }

  /** Update an existing string resource with a new value.
   * @param rscName The name of the string resource.
   * @param val The new value.
   * @throws if rscName does not exist
   */
  public updateString(rscName: WorkspaceResource.Name, val: string): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "UPDATE strings SET value=?2 WHERE id=?1", (stmt) => stmt.bindString(2, val));
  }

  /** Remove a string resource. */
  public removeString(rscName: WorkspaceResource.Name): void {
    this.performWriteSql(rscName, "DELETE FROM strings WHERE id=?");
  }

  /** Add a new blob resource to this WorkspaceDb.
   * @param rscName The name of the blob resource.
   * @param val The blob to save.
   */
  public addBlob(rscName: WorkspaceResource.Name, val: Uint8Array): void {
    EditableWorkspaceDb.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?)", (stmt) => stmt.bindBlob(2, val));
  }

  /** Update an existing blob resource with a new value.
   * @param rscName The name of the blob resource.
   * @param val The new value.
   * @throws if rscName does not exist
   */
  public updateBlob(rscName: WorkspaceResource.Name, val: Uint8Array): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "UPDATE blobs SET value=?2 WHERE id=?1", (stmt) => stmt.bindBlob(2, val));
  }

  /** Get a BlobIO writer for a previously-added blob WorkspaceResource.
   * @note after writing is complete, caller must call `close` on the BlobIO and must call `saveChanges` on the `db`.
   */
  public getBlobWriter(rscName: WorkspaceResource.Name): IModelJsNative.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobWriter = new IModelJsNative.BlobIO();
      blobWriter.open(this.sqliteDb.nativeDb, { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0), writeable: true });
      return blobWriter;
    });
  }

  /** Remove a blob resource. */
  public removeBlob(rscName: WorkspaceResource.Name): void {
    this.performWriteSql(rscName, "DELETE FROM blobs WHERE id=?");
  }

  /** Copy the contents of an existing local file into this WorkspaceDb as a file resource.
   * @param rscName The name of the file resource.
   * @param localFileName The name of a local file to be read.
   * @param fileExt The extension (do not include the leading ".") to be appended to the generated fileName
   * when this WorkspaceDb is extracted from the WorkspaceDb. By default the characters after the last "." in `localFileName`
   * are used. Pass this argument to override that.
   */
  public addFile(rscName: WorkspaceResource.Name, localFileName: LocalFileName, fileExt?: string): void {
    EditableWorkspaceDb.validateResourceName(rscName);
    fileExt = fileExt ?? extname(localFileName);
    if (fileExt?.[0] === ".")
      fileExt = fileExt.slice(1);
    this.sqliteDb.nativeDb.embedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName), fileExt });
  }

  /** Replace an existing file resource with the contents of a local file.
   * @param rscName The name of the file resource.
   * @param localFileName The name of a local file to be read.
   * @throws if rscName does not exist
   */
  public updateFile(rscName: WorkspaceResource.Name, localFileName: LocalFileName): void {
    this.queryFileResource(rscName); // throws if not present
    this.sqliteDb.nativeDb.replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }

  /** Remove a file resource. */
  public removeFile(rscName: WorkspaceResource.Name): void {
    const file = this.queryFileResource(rscName);
    if (undefined === file)
      throw new Error(`file resource "${rscName}" does not exist`);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.sqliteDb.nativeDb.removeEmbeddedFile(rscName);
  }
}
