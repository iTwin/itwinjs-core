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
import { BeEvent, DbResult, OpenMode } from "@itwin/core-bentley";
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
  FileAlias = "workspace/file/alias",
}

const workspaceDbFileExt = "itwin-workspace";

/**
 * The name of a WorkspaceDb. This is the user-supplied name of a WorkspaceDb, used to specify its *purpose* within a workspace.
 * WorkspaceDbNames can be "aliased" by `WorkspaceSetting.dbAlias` settings so that "resolved" [[WorkspaceDbId]] that supplies
 * the actual WorkspaceDb for a WorkspaceDbName may vary. Also note that more than one WorkspaceDbName may resolve to the same
 * WorkspaceDbId, if multiple purposes are served by the same WorkspaceDb.
 * @note there are no constraints on the contents or length of `WorkspaceDbName`s, although short descriptive names are recommended.
 * However, when no alias exists in WorkspaceSetting.dbAlias for a WorkspaceDbName, then the WorkspaceDbName becomes
 * the WorkspaceDbId, and the constraints on WorkspaceDbId apply.
 * @beta
 */
export type WorkspaceDbName = string;

/**
 * The unique identifier of a WorkspaceDb. This becomes the base name for the local file holding the WorkspaceDb.
 * `WorkspaceDbName`s are resolved to WorkspaceDbId through `WorkspaceSetting.dbAlias` settings,
 * so users may not recognize the actual WorkspaceDbId supplying resources for a WorkspaceDbName.
 *
 * `WorkspaceDbId`s may not:
 *  - be blank or start or end with a space
 *  - be longer than 255 characters
 *  - contain any characters with Unicode values less than 0x20
 *  - contain characters reserved for filename, device, wildcard, or url syntax (e.g. "#\.<>:"/\\"`'|?*")
 * @beta
 */
export type WorkspaceDbId = string;

/**
 * The version name for a WorkspaceDb. More than one version of a WorkspaceDb may be stored in the same [[CloudSqlite]] container. This
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

/**
 * Properties that specify a WorkspaceDb. This can either be a WorkspaceDbName or an
 * object with a member named `id` that holds a WorkspaceDbId. If WorkspaceDbId is supplied,
 * it is used directly. Otherwise the name must be resolved via [[Workspace.resolveContainerId]].
 * @beta
 */
export type WorkspaceDbProps = WorkspaceDbName | { id: WorkspaceDbId };

/** Properties that specify a WorkspaceResource within a WorkspaceDb.
 * @beta
 */
export interface WorkspaceResourceProps {
  /** the properties of the WorkspaceDb holding the resource. */
  db: WorkspaceDbProps;
  /** the name of the resource within [[db]] */
  rscName: WorkspaceResourceName;
}

/**
 * A WorkspaceDb holds workspace resources. `WorkspaceDb`s may just be local files, or they may be  stored and
 * synchronized in cloud blob-store containers. Each `WorkspaceResource` in a WorkspaceDb is  identified by a [[WorkspaceResourceName]].
 * Resources of type `string` and `blob` may be loaded directly from the `WorkspaceDb`. Resources of type `file` are
 * copied from the WorkspaceDb into a temporary local file so they can be accessed directly.
 * @beta
 */
export interface WorkspaceDb {
  /** The WorkspaceDbId of this WorkspaceDb. */
  readonly dbId: WorkspaceDbId;
  /** The version alias for this WorkspaceDb. */
  readonly dbAlias: WorkspaceDbVersion;
  /** The Workspace that opened this WorkspaceDb */
  readonly workspace: Workspace;
  /** the directory for extracting file resources. */
  readonly filesDir: LocalDirName;
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
   * keep the extracted files in the [[fileFilesDir]].
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
  /** A local directory to store temporary files extracted for file-resources.
   * @note if not supplied, defaults to `a folder named "Files" inside [[containerDir]]
   */
  filesDir?: LocalDirName;
}

/**
 * Settings and resources that customize an application for the current session.
 * See [Workspaces]($docs/learning/backend/Workspace)
 * @beta
 */
export interface Workspace {
  /** The local directory for the WorkspaceDb files with the name `${containerId}.itwin-workspace`. */
  readonly containerDir: LocalDirName;
  /** the local directory where this Workspace will store temporary files extracted for file-resources. */
  readonly filesDir: LocalDirName;
  /** The [[Settings]] for this Workspace */
  readonly settings: Settings;
  /**
   * Resolve a WorkspaceDbProps to a WorkspaceDbId. If props is an object with an `id` member, that value is returned unchanged.
   * If it is a string, then the highest priority [[WorkspaceSetting.dbAlias]] setting with an entry for the WorkspaceDbName
   * is used. If no WorkspaceSetting.dbAlias entry for the WorkspaceDbName can be found, the name is returned as the id.
   */
  resolveWorkspaceDbId(props: WorkspaceDbProps): WorkspaceDbId;
  /**
   * Get an open [[WorkspaceDb]]. If the container is present but not open, it is opened first.
   * If `cloudProps` are supplied, and if container is not  present or not up-to-date, it is downloaded first.
   * @returns a Promise that is resolved when the container is local, opened, and available for access.
   */
  getWorkspaceDb(props: WorkspaceDbProps, cloudProps?: CloudSqlite.ContainerAccessProps): Promise<WorkspaceDb>;
  /** Load a WorkspaceResource of type string, parse it, and add it to the current Settings for this Workspace.
   * @note settingsRsc must specify a resource holding a stringified JSON representation of a [[SettingDictionary]]
   * @returns a Promise that is resolved when the settings resource has been loaded.
   */
  loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority): Promise<void>;
  /** @internal */
  addWorkspaceDb(container: ITwinWorkspaceDb): void;
  /** Close and remove a currently opened [[WorkspaceDb]] from this Workspace. */
  dropWorkspaceDb(container: WorkspaceDb): void;
  /** Close this Workspace. All currently opened WorkspaceDbs are dropped. */
  close(): void;
}

/** @internal */
export class ITwinWorkspace implements Workspace {
  private _wsDbs = new Map<WorkspaceDbId, ITwinWorkspaceDb>();
  public readonly filesDir: LocalDirName;
  public readonly containerDir: LocalDirName;
  public readonly settings: Settings;

  public constructor(settings: Settings, opts?: WorkspaceOpts) {
    this.settings = settings;
    this.containerDir = opts?.containerDir ?? join(NativeLibrary.defaultLocalDir, "iTwin", "Workspace");
    this.filesDir = opts?.filesDir ?? join(this.containerDir, "Files");
  }
  public addWorkspaceDb(wsDb: ITwinWorkspaceDb) {
    if (undefined !== this._wsDbs.get(wsDb.dbId))
      throw new Error("dbId already exists in workspace");

    this._wsDbs.set(wsDb.dbId, wsDb);
  }

  public async getWorkspaceDb(props: WorkspaceDbProps, cloudProps?: CloudSqlite.DownloadProps): Promise<WorkspaceDb> {
    const id = this.resolveWorkspaceDbId(props);
    if (undefined === id)
      throw new Error(`can't resolve workspaceDb name [${props}]`);

    const db = this._wsDbs.get(id) ?? new ITwinWorkspaceDb(id, this);
    if (!db.isOpen) {
      if (cloudProps)
        await CloudSqlite.downloadDb(db, cloudProps);
      db.open();
    }

    return db;
  }

  public async loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority) {
    const container = await this.getWorkspaceDb(settingRsc.db);
    const setting = container.getString(settingRsc.rscName);
    if (undefined === setting)
      throw new Error(`could not load setting resource ${settingRsc.rscName}`);

    this.settings.addJson(`${container.dbId}/${settingRsc.rscName}`, priority, setting);
  }

  public close() {
    this.settings.close();
    for (const [_id, container] of this._wsDbs)
      container.close();
    this._wsDbs.clear();
  }

  public dropWorkspaceDb(toDrop: WorkspaceDb) {
    const id = toDrop.dbId;
    const wsDb = this._wsDbs.get(id);
    if (wsDb === toDrop) {
      wsDb.close();
      this._wsDbs.delete(id);
    }
  }

  public resolveWorkspaceDbId(props: WorkspaceDbProps): WorkspaceDbId {
    if (typeof props === "object")
      return props.id;
    const id = this.settings.resolveSetting(WorkspaceSetting.FileAlias, (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "object" && entry.name === props && typeof entry.id === "string")
            return entry.id;
        }
      }
      return undefined; // keep going through all settings dictionaries
    }, props);
    if (undefined === id)
      throw new Error("Unable to resolve container id.");
    return id;

  }
}

/**
 * A local file holding a WorkspaceDb.
 * @beta
 */
export class ITwinWorkspaceDb implements WorkspaceDb {
  public readonly sqliteDb = new SQLiteDb(); // eslint-disable-line @typescript-eslint/naming-convention
  public readonly workspace: Workspace;
  public readonly dbId: WorkspaceDbId;
  public localFile: LocalFileName;
  public dbAlias: WorkspaceDbVersion;
  public readonly onClosed = new BeEvent<() => void>();

  public get filesDir() { return join(this.workspace.filesDir, this.dbId); }
  public get isOpen() { return this.sqliteDb.isOpen; }
  public queryFileResource(rscName: WorkspaceResourceName) {
    const info = this.sqliteDb.nativeDb.queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this.filesDir, createHash("sha1").update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  protected static noLeadingOrTrailingSpaces(name: string, msg: string) {
    if (name.trim() !== name)
      throw new Error(`${msg} [${name}] may not have leading or tailing spaces`);
  }

  private static validateContainerId(id: WorkspaceDbId) {
    if (id === "" || id.length > 255 || /[#\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(id) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(id))
      throw new Error(`invalid containerId: [${id}]`);
    this.noLeadingOrTrailingSpaces(id, "containerId");
  }

  public constructor(containerId: WorkspaceDbId, workspace: Workspace) {
    [containerId, this.dbAlias] = containerId.split("#", 2);
    ITwinWorkspaceDb.validateContainerId(containerId);
    this.workspace = workspace;
    this.dbId = containerId;
    this.dbAlias = this.dbAlias ?? "v0";
    this.localFile = join(workspace.containerDir, `${this.dbId}.${workspaceDbFileExt}`);
    workspace.addWorkspaceDb(this);
  }

  public purgeContainerFiles() {
    IModelJsFs.purgeDirSync(this.filesDir);
  }

  public open(): void {
    this.sqliteDb.openDb(this.localFile, OpenMode.Readonly);
  }

  public close(): void {
    if (this.isOpen) {
      this.onClosed.raiseEvent();
      this.sqliteDb.closeDb();
      this.workspace.dropWorkspaceDb(this);
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
    this.localFile = await CloudSqlite.attach(this.dbAlias, props);
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

  public async upload(cloudProps: CloudSqlite.ContainerAccessProps) {
    return CloudSqlite.uploadDb(this, cloudProps);
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

