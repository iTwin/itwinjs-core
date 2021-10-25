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
import { AccessToken, DbResult, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";
import { SettingsPriority } from "./Settings";
import { IModelDb } from "../IModelDb";

export type WorkspaceContainerAlias = string;
export type WorkspaceContainerId = string;
export type WorkspaceResourceName = string;
export type WorkspaceResourceType = "string" | "blob" | "file";

/** either a WorkspaceContainerId or a WorkspaceContainerAlias, or both. */
export type WorkspaceContainerProps =
  { alias: WorkspaceContainerAlias, id?: WorkspaceContainerId } |
  { alias?: WorkspaceContainerAlias, id: WorkspaceContainerId };

export interface WorkspaceResourceProps {
  container: WorkspaceContainerProps;
  name: WorkspaceResourceName;
  type?: WorkspaceResourceType; // defaults to "string"
}

/**
 * A container of workspace resources. `WorkspaceContainer`s may just be local files, or they may be
 * stored and synchronized with cloud blob-store containers.
 * WorkspaceContainers hold WorkspaceResources, each identified by a [[WorkspaceResourceName]] and a [[WorkspaceResourceType]].
 * Resources of type `string` and `blob` may be loaded directly from a `WorkspaceContainer`. Resources of type `file` are
 * copied from the container into a temporary local file so they can be accessed directly.
 */
export interface WorkspaceContainer {
  /** The id of this container.
   * @note This identifies the container in cloud storage. If this is a local container, it may just be a local filename.
   */
  readonly containerId: WorkspaceContainerId;

  /** Get a string resource from this container, if present. */
  getString: (rscName: WorkspaceResourceName) => string | undefined;

  /** Get a blob resource from this container, if present. */
  getBlob: (rscName: WorkspaceResourceName) => Uint8Array | undefined;

  /** Get a local copy of a file resource from this container, if present.
   * @returns the full path to a file on the local filesystem.
   * @note The file is copied from the container into the local filesystem so it may be accessed directly. This happens only
   * as necessary, if the local file doesn't exist, or if it is out-of-date because it was updated in the container.
   * For this reason, you should not save the local file name, and instead call this method every time you open it, so its
   * content is always holds the correct version.
   * @note The filename will be a hash value, not the resource name.
   * @note Workspace resource files are set readonly after they are copied from the container.
   * To edit them, you must first copy them to another location.
   */
  getFile: (rscName: WorkspaceResourceName) => LocalFileName | undefined;
}

/**
 * An editable [[WorkspaceContainer]]. This interface is used by administrators for creating and modifying `WorkspaceContainer`s.
 * For cloud-backed containers, the write token must be obtained before this interface may be used. Only one user at at time
 * may be editing.
 */
export interface EditableWorkspaceContainer extends WorkspaceContainer {
  addString: (rscName: WorkspaceResourceName, val: string) => void;
  updateString: (rscName: WorkspaceResourceName, val: string) => void;
  removeString: (rscName: WorkspaceResourceName) => void;

  addBlob: (rscName: WorkspaceResourceName, val: Uint8Array) => void;
  updateBlob: (rscName: WorkspaceResourceName, val: Uint8Array) => void;
  removeBlob: (rscName: WorkspaceResourceName) => void;

  addFile: (rscName: WorkspaceResourceName, localFileName: LocalFileName) => void;
  updateFile: (rscName: WorkspaceResourceName, localFileName: LocalFileName) => void;
  removeFile: (rscName: WorkspaceResourceName) => void;
}

export interface WorkspaceContainerOpts {
  containerAlias?: WorkspaceContainerAlias;
  forIModel?: IModelDb;
  accessToken?: AccessToken;
  openMode?: OpenMode;
  rootDir?: LocalDirName;
}

export interface Workspace {
  readonly rootDir: LocalDirName;
  resolveContainerId: (url: WorkspaceContainerProps) => WorkspaceContainerId | undefined;
  getContainer: (props: WorkspaceContainerProps, opts?: WorkspaceContainerOpts) => WorkspaceContainer;
  addSettings: (settingRsc: WorkspaceResourceProps, priority: SettingsPriority) => void;
  dropAll: () => void;
  dropForIModel: (iModel: IModelDb) => void;
  dropContainer: (id: WorkspaceContainerId) => void;
}

export class WorkspaceFile implements EditableWorkspaceContainer {
  private readonly db = new SQLiteDb(); // eslint-disable-line @typescript-eslint/naming-convention
  public readonly filesDir: LocalDirName;
  public readonly localDbName: LocalFileName;
  public readonly containerId: WorkspaceContainerId;
  public readonly containerAlias?: WorkspaceContainerAlias;
  public readonly iModelOwner?: IModelDb;

  public get containerFilesDir() { return join(this.filesDir, this.containerId); }
  public get isOpen() { return this.db.isOpen; }
  public get isOpenForWrite() { return this.isOpen && !this.db.nativeDb.isReadonly(); }

  private queryFileResource(rscName: WorkspaceResourceName) {
    const info = this.db.nativeDb.queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this.containerFilesDir, createHash("sha1").update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  private mustBeWriteable() {
    if (!this.isOpenForWrite)
      throw new Error("workspace not open for write");
  }

  private getFileModifiedTime(localFileName: LocalFileName): number {
    return fs.statSync(localFileName).mtimeMs;
  }

  private static noLeadingOrTrailingSpaces(name: string, msg: string) {
    if (name.trim() !== name)
      throw new Error(`${msg} [${name}] may not have leading or tailing spaces`);
  }

  private static validateContainerId(id: WorkspaceContainerId) {
    if (id === "" || id.length > 255 || /[\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(id) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(id))
      throw new Error(`invalid containerId: [${id}]`);
    this.noLeadingOrTrailingSpaces(id, "containerId");
  }

  private static validateResourceName(name: WorkspaceResourceName) {
    if (name.trim() === "" || name.length > 1024)
      throw new Error(`invalid resource name`);
  }

  private validateResourceSize(val: Uint8Array | string) {
    const len = typeof val === "string" ? val.length : val.byteLength;
    if (len > (1024 * 1024 * 1024)) // one gigabyte
      throw new Error("value is too large");
  }

  public constructor(containerId: WorkspaceContainerId, opts?: WorkspaceContainerOpts) {
    WorkspaceFile.validateContainerId(containerId);
    const rootDir = opts?.rootDir ?? IModelHost.workspace.rootDir;
    this.containerId = containerId;
    this.containerAlias = opts?.containerAlias;
    this.iModelOwner = opts?.forIModel;
    this.filesDir = join(rootDir, "Files");
    this.localDbName = join(rootDir, `${this.containerId}.itwin-workspace-container`);
  }

  public async attach(_token: AccessToken) {
  }

  public async download() {
  }

  public async upload() {
  }

  public purgeContainerFiles() {
    IModelJsFs.purgeDirSync(this.containerFilesDir);
  }
  public create() {
    IModelJsFs.recursiveMkDirSync(dirname(this.localDbName));
    this.db.createDb(this.localDbName);
    this.db.executeSQL("CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT)");
    this.db.executeSQL("CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB)");
    this.db.saveChanges();
  }

  public open(args?: { accessToken?: AccessToken, openMode?: OpenMode }): void {
    this.db.openDb(this.localDbName, args?.openMode ?? OpenMode.Readonly);
  }

  public close(): void {
    if (this.isOpen)
      this.db.closeDb();
  }

  public getString(rscName: WorkspaceResourceName): string | undefined {
    return this.db.withSqliteStatement("SELECT value from strings WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueString(0) : undefined;
    });
  }

  public getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined {
    return this.db.withSqliteStatement("SELECT value from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueBlob(0) : undefined;
    });
  }

  public getFile(rscName: WorkspaceResourceName): LocalFileName | undefined {
    const file = this.queryFileResource(rscName);
    if (!file)
      return undefined;

    const { localFileName, info } = file;
    const stat = fs.existsSync(localFileName) && fs.statSync(localFileName);
    if (stat && Math.trunc(stat.mtimeMs) === info.date && stat.size === info.size)
      return localFileName;

    // check whether the file is already up to date.
    if (stat)
      fs.removeSync(localFileName);
    else
      IModelJsFs.recursiveMkDirSync(dirname(localFileName));

    this.db.nativeDb.extractEmbeddedFile({ name: rscName, localFileName });
    const date = new Date(info.date);
    fs.utimesSync(localFileName, date, date); // set the last-modified date of the file
    fs.chmodSync(localFileName, 4); // set file readonly
    return localFileName;
  }

  private performWriteSql(rscName: WorkspaceResourceName, sql: string, bind?: (stmt: SqliteStatement) => void) {
    this.mustBeWriteable();
    this.db.withSqliteStatement(sql, (stmt) => {
      stmt.bindString(1, rscName);
      bind?.(stmt);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "workspace write error");
    });
    this.db.saveChanges();

  }
  public addString(rscName: WorkspaceResourceName, val: string): void {
    WorkspaceFile.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => stmt.bindString(2, val));
  }

  public updateString(rscName: WorkspaceResourceName, val: string): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "UPDATE strings SET value=?2 WHERE id=?1", (stmt) => stmt.bindString(2, val));
  }

  public removeString(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM strings WHERE id=?");
  }

  public addBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    WorkspaceFile.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?)", (stmt) => stmt.bindBlob(2, val));
  }

  public updateBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "UPDATE blobs SET value=?2 WHERE id=?1", (stmt) => stmt.bindBlob(2, val));
  }

  public removeBlob(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM blobs WHERE id=?");
  }

  public addFile(rscName: WorkspaceResourceName, localFileName: LocalFileName, fileExt?: string): void {
    WorkspaceFile.validateResourceName(rscName);
    this.mustBeWriteable();
    fileExt = fileExt ?? extname(localFileName);
    if (fileExt?.[0] === ".")
      fileExt = fileExt.slice(1);
    this.db.nativeDb.embedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName), fileExt });
  }

  public updateFile(rscName: WorkspaceResourceName, localFileName: LocalFileName): void {
    this.mustBeWriteable();
    this.queryFileResource(rscName); // throws if not present
    this.db.nativeDb.replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }

  public removeFile(rscName: WorkspaceResourceName): void {
    this.mustBeWriteable();
    const file = this.queryFileResource(rscName);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.db.nativeDb.removeEmbeddedFile(rscName);
  }
}

export class ITwinWorkspace implements Workspace {
  private _workspaces = new Map<WorkspaceContainerId, WorkspaceFile>();
  public readonly rootDir: LocalDirName;

  public constructor(workspaceRoot: LocalDirName) {
    this.rootDir = workspaceRoot;
  }

  public getContainer(props: WorkspaceContainerProps, opts?: WorkspaceContainerOpts): WorkspaceContainer {
    const id = this.resolveContainerId(props);
    if (undefined === id)
      throw new Error(`can't resolve container alias [${props.alias}]`);
    let container = this._workspaces.get(id);
    if (container)
      return container;

    container = new WorkspaceFile(id, opts);
    container.open(opts);
    this._workspaces.set(id, container);
    if (opts?.forIModel) {
      const iModel = opts.forIModel;
      opts.forIModel.onBeforeClose.addOnce(() => this.dropForIModel(iModel));
    }
    return container;
  }

  public addSettings(settingRsc: WorkspaceResourceProps, priority: SettingsPriority) {
    const container = this.getContainer(settingRsc.container);
    const setting = container.getString(settingRsc.name);
    if (undefined === setting)
      throw new Error(`could not load setting resource ${settingRsc.name}`);

    IModelHost.settings.addJson(`${container.containerId}/${settingRsc.name}`, priority, setting);
  }

  public dropAll() {
    for (const [_id, container] of this._workspaces)
      container.close();
    this._workspaces.clear();
  }

  public dropForIModel(iModel: IModelDb) {
    for (const [id, container] of this._workspaces) {
      if (container.iModelOwner === iModel) {
        container.close();
        this._workspaces.delete(id);
      }
    }
  }

  public dropContainer(id: WorkspaceContainerId) {
    const container = this._workspaces.get(id);
    if (container === undefined)
      throw new Error(`container ${id} not open`);
    container.close();
    this._workspaces.delete(id);
  }

  public resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId | undefined {
    const id = props.id ?? IModelHost.settings.resolveSetting("workspace-alias", (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "object" && entry.alias === props.alias && typeof entry.id === "string")
            return entry.id;
        }
      }
      return undefined; // keep going through all settings dictionaries
    });

    return id;
  }
}
