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
import { IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { BeEvent, DbResult, OpenMode, Optional } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";
import { CloudSqlite } from "./CloudSqlite";
import { Settings, SettingsPriority } from "./Settings";

// cspell:ignore rowid

/** The names of Settings used by Workspace
 * @beta
 */
enum WorkspaceSetting {
  ContainerAlias = "workspace/container/alias",
}

const workspaceDbFileExt = "itwin-workspace";

/**
 * The name of a WorkspaceContainer. This is the user-supplied name of a WorkspaceContainer, used to specify its *purpose* within a workspace.
 * WorkspaceContainerName can be "aliased" by `WorkspaceSetting.containerAlias` settings so that "resolved" [[WorkspaceContainerId]] that supplies
 * the actual WorkspaceContainer for a WorkspaceContainerName may vary. Also note that more than one WorkspaceContainerName may resolve to the same
 * WorkspaceContainerId, if multiple purposes are served by the same WorkspaceContainer.
 * @note there are no constraints on the contents or length of `WorkspaceContainerName`s, although short descriptive names are recommended.
 * However, when no alias exists in WorkspaceSetting.containerAlias for a WorkspaceContainerName, then the WorkspaceContainerName becomes
 * the WorkspaceContainerId, and the constraints on WorkspaceContainerId apply.
 * @beta
 */
export type WorkspaceContainerName = string;

/**
 * The unique identifier of a WorkspaceContainer. This becomes the base name for the local directory holding the WorkspaceDbs from a WorkspaceContainer.
 * `WorkspaceContainerName`s are resolved to WorkspaceContainerId through `WorkspaceSetting.containerAlias` settings,
 * so users may not recognize the actual WorkspaceContainerId supplying resources for a WorkspaceDbName.
 *
 * `WorkspaceContainerId`s :
 *  - may only contain lower case letters, numbers or dashes
 *  - may not start or end with with a dash
 *  - be shorter than 3 or longer than 63 characters
 * @beta
 */
export type WorkspaceContainerId = string;

/** The name of a WorkspaceDb within a WorkspaceContainer.
 * @beta
 */
export type WorkspaceDbName = string;

/**
 * The version name for a WorkspaceDb. More than one version of a WorkspaceDb may be stored in the same WorkspaceContainer. This
 * string identifies a specific version.
 * @beta
 */
export type WorkspaceDbVersion = string;

/**
 * The name for identifying WorkspaceResources in a [[WorkspaceDb]].
 * * `WorkspaceResourceName`s may not:
 *  - be blank or start or end with a space
 *  - be longer than 1024 characters
 * @note a single WorkspaceDb may hold WorkspaceResources of type 'blob', 'string' and 'file', all with the same WorkspaceResourceName.
 * @beta
 */
export type WorkspaceResourceName = string;

/** supply either container name of id, not both
 * @beta
 */
export type ContainerNameOrId = { containerName: WorkspaceContainerName, containerId?: never } | { containerId: WorkspaceContainerId, containerName?: never };

/**
 * Properties that specify a WorkspaceContainer.
 * This can either be a WorkspaceContainerName or a WorkspaceContainerId. If id is supplied,
 * it is used directly. Otherwise name must be resolved via [[Workspace.resolveContainerId]].
 * @beta
 */
export type WorkspaceContainerProps = ContainerNameOrId & {
  cloudProps?: CloudSqlite.TransferProps;
};

/** Properties of a WorkspaceDb
 * @beta
 */
export type WorkspaceDbProps = WorkspaceContainerProps & {
  /** the name of the WorkspaceDb */
  dbName: WorkspaceDbName;
};

/** Properties that specify a WorkspaceResource within a WorkspaceDb.
 * @beta
 */
export type WorkspaceResourceProps = WorkspaceDbProps & {
  /** the name of the resource within [[db]] */
  rscName: WorkspaceResourceName;
};

/**
 * A WorkspaceDb holds workspace resources. `WorkspaceDb`s may just be local files, or they may be  stored and
 * synchronized in WorkspaceContainers. Each `WorkspaceResource` in a WorkspaceDb is  identified by a [[WorkspaceResourceName]].
 * Resources of type `string` and `blob` may be loaded directly from the `WorkspaceDb`. Resources of type `file` are
 * copied from the WorkspaceDb into a temporary local file so they can be accessed directly.
 * @beta
 */
export interface WorkspaceDb {
  readonly container: WorkspaceContainer;
  /** The WorkspaceDbName of this WorkspaceDb. */
  readonly dbName: WorkspaceDbName;
  /** event raised when this WorkspaceDb is closed. */
  readonly onClosed: BeEvent<() => void>;
  /** The name of the local file for holding this WorkspaceDb. */
  readonly localFile: LocalDirName;
  /** Get a string resource from this WorkspaceDb, if present. */
  getString(rscName: WorkspaceResourceName): string | undefined;

  /** Get a blob resource from this WorkspaceDb, if present. */
  getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined;
  /** @internal */
  getBlobReader(rscName: WorkspaceResourceName): IModelJsNative.BlobIO;

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
  getFile(rscName: WorkspaceResourceName, targetFileName?: LocalFileName): LocalFileName | undefined;
}

/**
 * Options for constructing a [[Workspace]].
 * @beta
 */
export interface WorkspaceOpts {
  /** The local directory for the WorkspaceDb files. The [[Workspace]] will (only) look in this directory
   * for files named `${this.containerId}/${this.dbId}.itwin-workspace`.
   * @note if not supplied, defaults to `iTwin/Workspace` in the user-local folder.
   */
  containerDir?: LocalDirName;
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

  getContainer(props: WorkspaceContainerProps): WorkspaceContainer;

  /**
   * Resolve a WorkspaceContainerProps to a WorkspaceContainerId. If props is an object with an `id` member, that value is returned unchanged.
   * If it is a string, then the highest priority [[WorkspaceSetting.containerAlias]] setting with an entry for the WorkspaceContainerName
   * is used. If no WorkspaceSetting.containerAlias entry for the WorkspaceContainerName can be found, the name is returned as the id.
   */
  resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId;
  /**
   * Get an open [[WorkspaceDb]]. If the WorkspaceDb is present but not open, it is opened first.
   * If `cloudProps` are supplied, and if container is not  present or not up-to-date, it is downloaded first.
   * @returns a Promise that is resolved when the container is local, opened, and available for access.
   */
  getWorkspaceDb(props: WorkspaceDbProps): Promise<WorkspaceDb>;
  /** Load a WorkspaceResource of type string, parse it, and add it to the current Settings for this Workspace.
   * @note settingsRsc must specify a resource holding a stringified JSON representation of a [[SettingDictionary]]
   * @returns a Promise that is resolved when the settings resource has been loaded.
   */
  loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority): Promise<void>;
  /** Close this Workspace. All WorkspaceContainers are dropped. */
  close(): void;
}

/** A WorkspaceContainer holds WorkspaceDbs.
 * @beta
 */
export interface WorkspaceContainer {
  readonly dirName: LocalDirName;
  /** the local directory where this WorkspaceContainer will store temporary files extracted for file-resources. */
  readonly filesDir: LocalDirName;
  readonly id: WorkspaceContainerId;
  readonly workspace: Workspace;
  /** @internal */
  addWorkspaceDb(toAdd: ITwinWorkspaceDb): void;

  getWorkspaceDb(props: Optional<WorkspaceDbProps, "containerName">): Promise<WorkspaceDb>;
  /** Close and remove a currently opened [[WorkspaceDb]] from this Workspace. */
  dropWorkspaceDb(container: WorkspaceDb): void;
  /** Close this WorkspaceContainer. All currently opened WorkspaceDbs are dropped. */
  close(): void;
}

/** @internal */
export class ITwinWorkspace implements Workspace {
  private _containers = new Map<WorkspaceContainerId, ITwinWorkspaceContainer>();
  public readonly containerDir: LocalDirName;
  public readonly settings: Settings;

  public constructor(settings: Settings, opts?: WorkspaceOpts) {
    this.settings = settings;
    this.containerDir = opts?.containerDir ?? join(NativeLibrary.defaultLocalDir, "iTwin", "Workspace");
  }

  public addContainer(toAdd: ITwinWorkspaceContainer) {
    if (undefined !== this._containers.get(toAdd.id))
      throw new Error("container already exists in workspace");
    this._containers.set(toAdd.id, toAdd);
  }
  public getContainer(props: WorkspaceContainerProps): WorkspaceContainer {
    const id = this.resolveContainerId(props);
    if (undefined === id)
      throw new Error(`can't resolve workspace container name [${props.containerName}]`);

    return this._containers.get(id) ?? new ITwinWorkspaceContainer(this, id);
  }

  public async getWorkspaceDb(props: WorkspaceDbProps): Promise<WorkspaceDb> {
    return this.getContainer(props).getWorkspaceDb(props);
  }

  public async loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority) {
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

  public resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId {
    if (props.containerId)
      return props.containerId; // if the container id is supplied, just use it

    const id = this.settings.resolveSetting(WorkspaceSetting.ContainerAlias, (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "object" && entry.name === props.containerName && typeof entry.id === "string")
            return entry.id;
        }
      }
      return undefined; // keep going through all settings dictionaries
    }, props.containerName);
    if (undefined === id)
      throw new Error("Unable to resolve container id.");
    return id;
  }
}

/** @internal */
export class ITwinWorkspaceContainer implements WorkspaceContainer {
  public readonly workspace: ITwinWorkspace;
  public readonly filesDir: LocalDirName;
  public readonly id: WorkspaceContainerId;
  private _wsDbs = new Map<WorkspaceDbName, ITwinWorkspaceDb>();
  public get dirName() { return join(this.workspace.containerDir, this.id); }

  /** rules for ContainerIds (from Azure, see https://docs.microsoft.com/en-us/rest/api/storageservices/naming-and-referencing-containers--blobs--and-metadata)
   *  - may only contain lower case letters, numbers or dashes
   *  - may not start or end with with a dash nor have more than one dash in a row
   *  - may not be shorter than 3 or longer than 63 characters
   */
  private static validateContainerId(id: WorkspaceContainerId) {
    if (!/^(?=.{3,63}$)[a-z0-9]+(-[a-z0-9]+)*$/g.test(id))
      throw new Error(`invalid containerId: [${id}]`);
  }

  public constructor(workspace: ITwinWorkspace, id: WorkspaceContainerId) {
    ITwinWorkspaceContainer.validateContainerId(id);
    this.workspace = workspace;
    this.id = id;
    workspace.addContainer(this);
    this.filesDir = join(this.dirName, "Files");
  }

  public addWorkspaceDb(toAdd: ITwinWorkspaceDb) {
    if (undefined !== this._wsDbs.get(toAdd.dbName))
      throw new Error("dbName already exists in workspace");
    this._wsDbs.set(toAdd.dbName, toAdd);
  }

  public async getWorkspaceDb(props: Optional<WorkspaceDbProps, "containerName">): Promise<WorkspaceDb> {
    const db = this._wsDbs.get(props.dbName) ?? new ITwinWorkspaceDb(props.dbName, this);
    if (!db.isOpen) {
      if (props.cloudProps)
        await CloudSqlite.downloadDb({ ...db, ...props.cloudProps, containerId: this.id });
      db.open();
    }
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
 * A local file holding a WorkspaceDb.
 * @beta
 */
export class ITwinWorkspaceDb implements WorkspaceDb {
  public readonly sqliteDb = new SQLiteDb(); // eslint-disable-line @typescript-eslint/naming-convention
  public readonly dbName: WorkspaceDbName;
  public readonly container: WorkspaceContainer;
  public localFile: LocalFileName;
  public readonly onClosed = new BeEvent<() => void>();

  protected static noLeadingOrTrailingSpaces(name: string, msg: string) {
    if (name.trim() !== name)
      throw new Error(`${msg} [${name}] may not have leading or tailing spaces`);
  }

  private static validateDbName(dbName: WorkspaceDbName) {
    if (dbName === "" || dbName.length > 255 || /[#\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(dbName) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(dbName))
      throw new Error(`invalid dbName: [${dbName}]`);
    this.noLeadingOrTrailingSpaces(dbName, "dbName");
  }

  public get isOpen() { return this.sqliteDb.isOpen; }
  public queryFileResource(rscName: WorkspaceResourceName) {
    const info = this.sqliteDb.nativeDb.queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this.container.filesDir, createHash("sha1").update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  public constructor(dbName: WorkspaceDbName, container: WorkspaceContainer) {
    ITwinWorkspaceDb.validateDbName(dbName);
    this.dbName = dbName;
    this.container = container;
    this.localFile = join(container.dirName, `${dbName}.${workspaceDbFileExt}`);
    container.addWorkspaceDb(this);
  }

  public open(): void {
    this.sqliteDb.openDb(this.localFile, OpenMode.Readonly);
  }

  public close(): void {
    if (this.isOpen) {
      this.onClosed.raiseEvent();
      this.sqliteDb.closeDb();
      this.container.dropWorkspaceDb(this);
    }
  }

  public getString(rscName: WorkspaceResourceName): string | undefined {
    return this.sqliteDb.withSqliteStatement("SELECT value from strings WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueString(0) : undefined;
    });
  }

  /** Get a BlobIO reader for a blob WorkspaceResource.
   * @note when finished, caller must call `close` on the BlobIO.
   */
  public getBlobReader(rscName: WorkspaceResourceName): IModelJsNative.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobReader = new IModelJsNative.BlobIO();
      blobReader.open(this.sqliteDb.nativeDb, { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0) });
      return blobReader;
    });
  }

  public getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined {
    return this.sqliteDb.withSqliteStatement("SELECT value from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueBlob(0) : undefined;
    });
  }

  public getFile(rscName: WorkspaceResourceName, targetFileName?: LocalFileName): LocalFileName | undefined {
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
}

/**
 * An editable [[WorkspaceDb]]. This is used by administrators for creating and modifying `WorkspaceDb`s.
 * For cloud-backed containers, the write token must be obtained before this class may be used. Only one user at at time
 * may be editing.
 * @beta
 */
export class EditableWorkspaceDb extends ITwinWorkspaceDb {
  private _isCloudOpen = false;
  private static validateResourceName(name: WorkspaceResourceName) {
    ITwinWorkspaceDb.noLeadingOrTrailingSpaces(name, "resource name");
    if (name.length > 1024)
      throw new Error("resource name too long");
  }

  private validateResourceSize(val: Uint8Array | string) {
    const len = typeof val === "string" ? val.length : val.byteLength;
    if (len > (1024 * 1024 * 1024)) // one gigabyte
      throw new Error("value is too large");
  }

  public async openCloudDb(props: CloudSqlite.ContainerAccessProps) {
    this.localFile = await CloudSqlite.attach(this.dbName, props);
    this.sqliteDb.openDb(this.localFile, OpenMode.ReadWrite);
    this._isCloudOpen = true;
  }

  public override open() {
    this.sqliteDb.openDb(this.localFile, OpenMode.ReadWrite);
  }

  public override close() {
    if (this._isCloudOpen) {
      //  this.db.nativeDb.flushCloudUpload(); TODO: add back when available
      this._isCloudOpen = false;
    }
    super.close();
  }

  private getFileModifiedTime(localFileName: LocalFileName): number {
    return Math.round(fs.statSync(localFileName).mtimeMs);
  }

  private performWriteSql(rscName: WorkspaceResourceName, sql: string, bind?: (stmt: SqliteStatement) => void) {
    this.sqliteDb.withSqliteStatement(sql, (stmt) => {
      stmt.bindString(1, rscName);
      bind?.(stmt);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "workspace write error");
    });
    this.sqliteDb.saveChanges();
  }

  /** Create a new, empty, EditableWorkspaceDb for importing Workspace resources. */
  public create() {
    IModelJsFs.recursiveMkDirSync(dirname(this.localFile));
    this.sqliteDb.createDb(this.localFile);
    this.sqliteDb.executeSQL("CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT)");
    this.sqliteDb.executeSQL("CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB)");
    this.sqliteDb.saveChanges();
  }

  public static async cloneVersion(oldVersion: WorkspaceDbVersion, newVersion: WorkspaceDbVersion, cloudProps: CloudSqlite.ContainerAccessProps) {
    return CloudSqlite.copyDb(oldVersion, newVersion, cloudProps);
  }

  public async upload(cloudProps: CloudSqlite.TransferProps) {
    return CloudSqlite.uploadDb({ ...cloudProps, ...this });
  }

  /** Add a new string resource to this WorkspaceDb.
   * @param rscName The name of the string resource.
   * @param val The string to save.
   */
  public addString(rscName: WorkspaceResourceName, val: string): void {
    EditableWorkspaceDb.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => stmt.bindString(2, val));
  }

  /** Update an existing string resource with a new value.
   * @param rscName The name of the string resource.
   * @param val The new value.
   * @throws if rscName does not exist
   */
  public updateString(rscName: WorkspaceResourceName, val: string): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "UPDATE strings SET value=?2 WHERE id=?1", (stmt) => stmt.bindString(2, val));
  }

  /** Remove a string resource. */
  public removeString(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM strings WHERE id=?");
  }

  /** Add a new blob resource to this WorkspaceDb.
   * @param rscName The name of the blob resource.
   * @param val The blob to save.
   */
  public addBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    EditableWorkspaceDb.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?)", (stmt) => stmt.bindBlob(2, val));
  }

  /** Update an existing blob resource with a new value.
   * @param rscName The name of the blob resource.
   * @param val The new value.
   * @throws if rscName does not exist
   */
  public updateBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "UPDATE blobs SET value=?2 WHERE id=?1", (stmt) => stmt.bindBlob(2, val));
  }

  /** Get a BlobIO writer for a previously-added blob WorkspaceResource.
   * @note after writing is complete, caller must call `close` on the BlobIO and must call `saveChanges` on the `db`.
   */
  public getBlobWriter(rscName: WorkspaceResourceName): IModelJsNative.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobWriter = new IModelJsNative.BlobIO();
      blobWriter.open(this.sqliteDb.nativeDb, { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0), writeable: true });
      return blobWriter;
    });
  }

  /** Remove a blob resource. */
  public removeBlob(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM blobs WHERE id=?");
  }

  /** Copy the contents of an existing local file into this WorkspaceDb as a file resource.
   * @param rscName The name of the file resource.
   * @param localFileName The name of a local file to be read.
   * @param fileExt The extension (do not include the leading ".") to be appended to the generated fileName
   * when this WorkspaceDb is extracted from the WorkspaceDb. By default the characters after the last "." in `localFileName`
   * are used. Pass this argument to override that.
   */
  public addFile(rscName: WorkspaceResourceName, localFileName: LocalFileName, fileExt?: string): void {
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
  public updateFile(rscName: WorkspaceResourceName, localFileName: LocalFileName): void {
    this.queryFileResource(rscName); // throws if not present
    this.sqliteDb.nativeDb.replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }

  /** Remove a file resource. */
  public removeFile(rscName: WorkspaceResourceName): void {
    const file = this.queryFileResource(rscName);
    if (undefined === file)
      throw new Error(`file resource "${rscName}" does not exist`);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.sqliteDb.nativeDb.removeEmbeddedFile(rscName);
  }
}

