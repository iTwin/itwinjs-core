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
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";
import { ITwinSettings, Settings, SettingsPriority } from "./Settings";
import { IModelDb } from "../IModelDb";

export type WorkspaceContainerName = string;
export type WorkspaceContainerId = string;
export type WorkspaceResourceName = string;
export type WorkspaceResourceType = "string" | "blob" | "file";

/** either a WorkspaceContainerName or a WorkspaceContainerId. */
export type WorkspaceContainerProps = WorkspaceContainerName | { id: WorkspaceContainerId };

export interface WorkspaceResourceProps {
  container: WorkspaceContainerProps;
  rscName: WorkspaceResourceName;
  type?: WorkspaceResourceType; // defaults to "string"
}

export interface WorkspaceContainerAlias {
  name: WorkspaceContainerName;
  id: WorkspaceContainerId;
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
  getString(rscName: WorkspaceResourceName): string | undefined;

  /** Get a blob resource from this container, if present. */
  getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined;

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
  getFile(rscName: WorkspaceResourceName): LocalFileName | undefined;
}

export interface WorkspaceContainerOpts {
  forIModel?: IModelDb;
  accessToken?: AccessToken;
  openMode?: OpenMode;
  workspaceRoot?: LocalDirName;
  filesDir?: LocalDirName;
}

export interface Workspace {
  readonly rootDir: LocalDirName;
  readonly filesDir: LocalDirName;
  readonly settings: Settings;
  resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId | undefined;
  obtainContainer(props: WorkspaceContainerProps, opts?: WorkspaceContainerOpts): Promise<WorkspaceContainer>;
  getContainer(props: WorkspaceContainerProps, opts?: WorkspaceContainerOpts): WorkspaceContainer;
  loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority): void;
  dropContainer(container: WorkspaceContainer): void;
  close(): void;
}

/** @internal */
export class WorkspaceFile implements WorkspaceContainer {
  protected readonly db = new SQLiteDb(); // eslint-disable-line @typescript-eslint/naming-convention
  public readonly workspace: Workspace;
  public readonly containerId: WorkspaceContainerId;
  public readonly localDbName: LocalDirName;
  public readonly iModelOwner?: IModelDb;

  public get containerFilesDir() { return join(this.workspace.filesDir, this.containerId); }
  public get isOpen() { return this.db.isOpen; }
  public get isOpenForWrite() { return this.isOpen && !this.db.nativeDb.isReadonly(); }

  protected queryFileResource(rscName: WorkspaceResourceName) {
    const info = this.db.nativeDb.queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this.containerFilesDir, createHash("sha1").update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  protected static noLeadingOrTrailingSpaces(name: string, msg: string) {
    if (name.trim() !== name)
      throw new Error(`${msg} [${name}] may not have leading or tailing spaces`);
  }

  private static validateContainerId(id: WorkspaceContainerId) {
    if (id === "" || id.length > 255 || /[\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(id) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(id))
      throw new Error(`invalid containerId: [${id}]`);
    this.noLeadingOrTrailingSpaces(id, "containerId");
  }

  public constructor(containerId: WorkspaceContainerId, workspace: Workspace, opts?: WorkspaceContainerOpts) {
    WorkspaceFile.validateContainerId(containerId);
    this.workspace = workspace;
    this.containerId = containerId;
    this.localDbName = join(workspace.rootDir, `${this.containerId}.itwin-workspace-container`);
    this.iModelOwner = opts?.forIModel;
  }

  public async attach(_token: AccessToken) {
  }

  public async download() {
  }

  public purgeContainerFiles() {
    IModelJsFs.purgeDirSync(this.containerFilesDir);
  }

  public open(): void {
    this.db.openDb(this.localDbName, OpenMode.Readonly);
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
    // check whether the file is already up to date.
    const stat = fs.existsSync(localFileName) && fs.statSync(localFileName);
    if (stat && Math.trunc(stat.mtimeMs) === info.date && stat.size === info.size)
      return localFileName; // yes, we're done

    // extractEmbeddedFile fails if the file exists or if the directory does not exist
    if (stat)
      fs.removeSync(localFileName);
    else
      IModelJsFs.recursiveMkDirSync(dirname(localFileName));

    this.db.nativeDb.extractEmbeddedFile({ name: rscName, localFileName });
    const date = new Date(info.date);
    fs.utimesSync(localFileName, date, date); // set the last-modified date of the file to match date in container
    fs.chmodSync(localFileName, 4); // set file readonly
    return localFileName;
  }
}

/**
 * An editable [[WorkspaceFile]]. This is used by administrators for creating and modifying `WorkspaceContainer`s.
 * For cloud-backed containers, the write token must be obtained before this class may be used. Only one user at at time
 * may be editing.
 * @beta
 */
export class EditableWorkspaceFile extends WorkspaceFile {
  private static validateResourceName(name: WorkspaceResourceName) {
    WorkspaceFile.noLeadingOrTrailingSpaces(name, "resource name");
    if (name.length > 1024)
      throw new Error("resource name too long");
  }

  private validateResourceSize(val: Uint8Array | string) {
    const len = typeof val === "string" ? val.length : val.byteLength;
    if (len > (1024 * 1024 * 1024)) // one gigabyte
      throw new Error("value is too large");
  }

  public async upload() {
  }

  public override open(): void {
    this.db.openDb(this.localDbName, OpenMode.ReadWrite);
  }

  private getFileModifiedTime(localFileName: LocalFileName): number {
    return fs.statSync(localFileName).mtimeMs;
  }

  private performWriteSql(rscName: WorkspaceResourceName, sql: string, bind?: (stmt: SqliteStatement) => void) {
    this.db.withSqliteStatement(sql, (stmt) => {
      stmt.bindString(1, rscName);
      bind?.(stmt);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "workspace write error");
    });
    this.db.saveChanges();
  }

  public create() {
    IModelJsFs.recursiveMkDirSync(dirname(this.localDbName));
    this.db.createDb(this.localDbName);
    this.db.executeSQL("CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT)");
    this.db.executeSQL("CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB)");
    this.db.saveChanges();
  }

  public addString(rscName: WorkspaceResourceName, val: string): void {
    EditableWorkspaceFile.validateResourceName(rscName);
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
    EditableWorkspaceFile.validateResourceName(rscName);
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
    EditableWorkspaceFile.validateResourceName(rscName);
    fileExt = fileExt ?? extname(localFileName);
    if (fileExt?.[0] === ".")
      fileExt = fileExt.slice(1);
    this.db.nativeDb.embedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName), fileExt });
  }

  public updateFile(rscName: WorkspaceResourceName, localFileName: LocalFileName): void {
    this.queryFileResource(rscName); // throws if not present
    this.db.nativeDb.replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }

  public removeFile(rscName: WorkspaceResourceName): void {
    const file = this.queryFileResource(rscName);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.db.nativeDb.removeEmbeddedFile(rscName);
  }

}

/** @internal */
export class ITwinWorkspace implements Workspace {
  private _workspaces = new Map<WorkspaceContainerId, WorkspaceFile>();
  public readonly filesDir: LocalDirName;
  public readonly rootDir: LocalDirName;
  public readonly settings: Settings;
  public constructor(rootDir: LocalDirName, filesDir?: LocalDirName) {
    this.settings = new ITwinSettings();
    this.rootDir = rootDir;
    this.filesDir = filesDir ?? join(rootDir, "Files");
  }

  public async obtainContainer(props: WorkspaceContainerProps, opts?: WorkspaceContainerOpts): Promise<WorkspaceContainer> {
    // NEEDS_WORK - download or attach
    return this.getContainer(props, opts);
  }

  public getContainer(props: WorkspaceContainerProps, opts?: WorkspaceContainerOpts): WorkspaceContainer {
    const id = this.resolveContainerId(props);
    if (undefined === id)
      throw new Error(`can't resolve container name [${props}]`);
    let container = this._workspaces.get(id);
    if (container)
      return container;

    container = new WorkspaceFile(id, this, opts);
    container.open();
    this._workspaces.set(id, container);
    if (opts?.forIModel)
      opts.forIModel.onBeforeClose.addOnce(() => this.dropContainer(container!));
    return container;
  }

  public loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority) {
    const container = this.getContainer(settingRsc.container);
    const setting = container.getString(settingRsc.rscName);
    if (undefined === setting)
      throw new Error(`could not load setting resource ${settingRsc.rscName}`);

    this.settings.addJson(`${container.containerId}/${settingRsc.rscName}`, priority, setting);
  }

  public close() {
    for (const [_id, container] of this._workspaces)
      container.close();
    this._workspaces.clear();
  }

  public dropContainer(toDrop: WorkspaceContainer) {
    const id = toDrop.containerId;
    const container = this._workspaces.get(id);
    if (container !== toDrop)
      throw new Error(`container ${id} not open`);
    container.close();
    this._workspaces.delete(id);
  }

  public resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId | undefined {
    if (typeof props === "object")
      return props.id;
    return this.settings.resolveSetting("workspace/container/alias", (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "object" && entry.name === props && typeof entry.id === "string")
            return entry.id;
        }
      }
      return undefined; // keep going through all settings dictionaries
    }, props);

  }
}
