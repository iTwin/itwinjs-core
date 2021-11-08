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
import { NativeLibrary } from "@bentley/imodeljs-native";
import { AccessToken, BeEvent, DbResult, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";
import { Settings, SettingsPriority } from "./Settings";

/** The names of Settings used by Workspace
 * @beta
 */
enum WorkspaceSetting {
  ContainerAlias = "workspace/container/alias",
}

const containerFileExt = "itwin-workspace-container";

/**
 * The name of a workspace container. This is the user-supplied name of a container, used to specify its *purpose* within a workspace.
 * WorkspaceNames can be "aliased" by `WorkspaceSetting.ContainerAlias` settings so that "resolved" [[WorkspaceContainerId]] that supplies
 * the actual container for a WorkspaceContainerName may vary. Also note that more than one WorkspaceContainerName may resolve to the same
 * WorkspaceContainerId, if multiple purposes are served by the same container.
 * @note there are no constraints on the contents or length of `WorkspaceContainerName`s, although short descriptive names are recommended.
 * However, when no alias exists in WorkspaceSetting.ContainerAlias for a WorkspaceContainerName, then the WorkspaceContainerName becomes
 * the WorkspaceContainerId, and the constraints on WorkspaceContainerId apply.
 * @beta
 */
export type WorkspaceContainerName = string;

/**
 * The unique identifier of a WorkspaceContainer. This becomes the base name for the local file holding the WorkspaceContainer, and is also the
 * name of its cloud-storage-container. `WorkspaceContainerName` are resolved to WorkspaceContainerId through `WorkspaceSetting.ContainerAlias` settings,
 * so users may not recognize the actual WorkspaceContainerId supplying resources for a WorkspaceContainerName.
 *
 * `WorkspaceContainerId`s may not:
 *  - be blank or start or end with a space
 *  - be longer than 255 characters
 *  - contain any characters with Unicode values less than 0x20
 *  - contain characters reserved for filename, device, wildcard, or url syntax (e.g. "#\.<>:"/\\"`'|?*")
 * @beta
 */
export type WorkspaceContainerId = string;

/**
 * The name for identifying WorkspaceResources in a [[WorkspaceContainer]].
 * * `WorkspaceResourceName`s may not:
 *  - be blank or start or end with a space
 *  - be longer than 1024 characters
 * @note a single WorkspaceContainer may hold WorkspaceResources of type 'blob', 'string' and 'file', all with the same WorkspaceResourceName.
 * @beta
 */
export type WorkspaceResourceName = string;

/**
 * Properties that specify a WorkspaceContainer. This can either be a WorkspaceContainerName or an
 * object with a member named `id` that holds a WorkspaceContainerId. If WorkspaceContainerId is supplied,
 * it is used directly. Otherwise the name must be resolved via [[Workspace.resolveContainerId]].
 * @beta
 */
export type WorkspaceContainerProps = WorkspaceContainerName | { id: WorkspaceContainerId };

/** Properties that specify a WorkspaceResource within a WorkspaceContainer.
 * @beta
 */
export interface WorkspaceResourceProps {
  /** the properties of the WorkspaceContainer holding the resource. */
  container: WorkspaceContainerProps;
  /** the name of the resource within [[container]] */
  rscName: WorkspaceResourceName;
}

/**
 * A container of workspace resources. `WorkspaceContainer`s may just be local [[WorkspaceFile]]s, or they may be  stored and
 * synchronized with cloud blob-store containers. WorkspaceContainers hold WorkspaceResources, each identified by a [[WorkspaceResourceName]].
 * Resources of type `string` and `blob` may be loaded directly from the `WorkspaceContainer`. Resources of type `file` are
 * copied from the container into a temporary local file so they can be accessed directly.
 * @beta
 */
export interface WorkspaceContainer {
  /** The WorkspaceContainerId of this container. */
  readonly containerId: WorkspaceContainerId;
  /** The Workspace that opened this WorkspaceContainer */
  readonly workspace: Workspace;
  /** the directory for extracting file resources. */
  readonly containerFilesDir: LocalDirName;
  /** event raised when the container is closed. */
  readonly onContainerClosed: BeEvent<() => void>;
  /** Get a string resource from this container, if present. */
  getString(rscName: WorkspaceResourceName): string | undefined;

  /** Get a blob resource from this container, if present. */
  getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined;

  /** Extract a local copy of a file resource from this container, if present.
   * @param rscName The name of the file resource in the WorkspaceContainer
   * @param targetFileName optional name for extracted file. Some applications require files in specific locations or filenames. If
   * you know the full path to use for the extracted file, you can supply it. Generally, it is best to *not* supply the filename and
   * keep the extracted files in the [[containerFilesDir]].
   * @returns the full path to a file on the local filesystem.
   * @note The file is copied from the container into the local filesystem so it may be accessed directly. This happens only
   * as necessary, if the local file doesn't exist, or if it is out-of-date because it was updated in the container.
   * For this reason, you should not save the local file name, and instead call this method every time you access it, so its
   * content is always holds the correct version.
   * @note The filename will be a hash value, not the resource name.
   * @note Workspace resource files are set readonly as they are copied from the container.
   * To edit them, you must first copy them to another location.
   */
  getFile(rscName: WorkspaceResourceName, targetFileName?: LocalFileName): LocalFileName | undefined;
}

/**
 * Options for constructing a [[Workspace]].
 * @beta
 */
export interface WorkspaceOpts {
  /** The local directory for the WorkspaceContainer files. The [[Workspace]] will (only) look in this directory
   * for files named `${this.containerId}.itwin-workspace-container`.
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
  /** The local directory for the WorkspaceContainer files with the name `${containerId}.itwin-workspace-container`. */
  readonly containerDir: LocalDirName;
  /** the local directory where this Workspace will store temporary files extracted for file-resources. */
  readonly filesDir: LocalDirName;
  /** The [[Settings]] for this Workspace */
  readonly settings: Settings;
  /**
   * Resolve a WorkspaceContainerProps to a WorkspaceContainerId. If props is an object with an `id` member, that value is returned unchanged.
   * If it is a string, then the highest priority [[WorkspaceSetting.ContainerAlias]] setting with an entry for the WorkspaceContainerName
   * is used. If no WorkspaceSetting.ContainerAlias entry for the WorkspaceContainerName can be found, the name is returned as the id.
   */
  resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId;
  /**
   * Get an open [[WorkspaceContainer]]. If the container is present but not open, it is opened first.
   * If it is not  present or not up-to-date, it is downloaded first.
   * @returns a Promise that is resolved when the container is local, opened, and available for access.
   */
  getContainer(props: WorkspaceContainerProps): Promise<WorkspaceContainer>;
  /** Load a WorkspaceResource of type string, parse it, and add it to the current Settings for this Workspace.
   * @note settingsRsc must specify a resource holding a stringified JSON representation of a [[SettingDictionary]]
   * @returns a Promise that is resolved when the settings resource has been loaded.
   */
  loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority): Promise<void>;
  /** Close and remove a currently opened [[WorkspaceContainer]] from this Workspace. */
  dropContainer(container: WorkspaceContainer): void;
  /** Close this Workspace. All currently opened WorkspaceContainers are dropped. */
  close(): void;
}

/** @internal */
export class ITwinWorkspace implements Workspace {
  private _containers = new Map<WorkspaceContainerId, WorkspaceFile>();
  public readonly filesDir: LocalDirName;
  public readonly containerDir: LocalDirName;
  public readonly settings: Settings;

  public constructor(settings: Settings, opts?: WorkspaceOpts) {
    this.settings = settings;
    this.containerDir = opts?.containerDir ?? join(NativeLibrary.defaultLocalDir, "iTwin", "Workspace");
    this.filesDir = opts?.filesDir ?? join(this.containerDir, "Files");
  }

  public async getContainer(props: WorkspaceContainerProps): Promise<WorkspaceContainer> {
    const id = this.resolveContainerId(props);
    if (undefined === id)
      throw new Error(`can't resolve container name [${props}]`);
    let container = this._containers.get(id);
    if (container)
      return container;

    container = new WorkspaceFile(id, this);
    container.open();
    this._containers.set(id, container);
    return container;
  }

  public async loadSettingsDictionary(settingRsc: WorkspaceResourceProps, priority: SettingsPriority) {
    const container = await this.getContainer(settingRsc.container);
    const setting = container.getString(settingRsc.rscName);
    if (undefined === setting)
      throw new Error(`could not load setting resource ${settingRsc.rscName}`);

    this.settings.addJson(`${container.containerId}/${settingRsc.rscName}`, priority, setting);
  }

  public close() {
    this.settings.close();
    for (const [_id, container] of this._containers)
      container.close();
    this._containers.clear();
  }

  public dropContainer(toDrop: WorkspaceContainer) {
    const id = toDrop.containerId;
    const container = this._containers.get(id);
    if (container !== toDrop)
      throw new Error(`container ${id} not open`);
    container.close();
    this._containers.delete(id);
  }

  public resolveContainerId(props: WorkspaceContainerProps): WorkspaceContainerId {
    if (typeof props === "object")
      return props.id;
    const id = this.settings.resolveSetting(WorkspaceSetting.ContainerAlias, (val) => {
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
 * A local file holding a WorkspaceContainer.
 * @beta
 */
export class WorkspaceFile implements WorkspaceContainer {
  protected readonly db = new SQLiteDb(); // eslint-disable-line @typescript-eslint/naming-convention
  public readonly workspace: Workspace;
  public readonly containerId: WorkspaceContainerId;
  public readonly localDbName: LocalDirName;
  public readonly onContainerClosed = new BeEvent<() => void>();

  public get containerFilesDir() { return join(this.workspace.filesDir, this.containerId); }
  public get isOpen() { return this.db.isOpen; }

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
    if (id === "" || id.length > 255 || /[#\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(id) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(id))
      throw new Error(`invalid containerId: [${id}]`);
    this.noLeadingOrTrailingSpaces(id, "containerId");
  }

  public constructor(containerId: WorkspaceContainerId, workspace: Workspace) {
    WorkspaceFile.validateContainerId(containerId);
    this.workspace = workspace;
    this.containerId = containerId;
    this.localDbName = join(workspace.containerDir, `${this.containerId}.${containerFileExt}`);
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
    if (this.isOpen) {
      this.onContainerClosed.raiseEvent();
      this.db.closeDb();
    }
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

    this.db.nativeDb.extractEmbeddedFile({ name: rscName, localFileName });
    const date = new Date(info.date);
    fs.utimesSync(localFileName, date, date); // set the last-modified date of the file to match date in container
    fs.chmodSync(localFileName, "0444"); // set file readonly
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

  public async lockContainer() {
    this.db.openDb(this.localDbName, OpenMode.ReadWrite);
  }

  private getFileModifiedTime(localFileName: LocalFileName): number {
    return Math.round(fs.statSync(localFileName).mtimeMs);
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

  /** Create a new, empty, EditableWorkspaceFile for importing Workspace resources. */
  public create() {
    IModelJsFs.recursiveMkDirSync(dirname(this.localDbName));
    this.db.createDb(this.localDbName);
    this.db.executeSQL("CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT)");
    this.db.executeSQL("CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB)");
    this.db.saveChanges();
  }

  /** Add a new string resource to this WorkspaceFile.
   * @param rscName The name of the string resource.
   * @param val The string to save.
   */
  public addString(rscName: WorkspaceResourceName, val: string): void {
    EditableWorkspaceFile.validateResourceName(rscName);
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

  /** Add a new blob resource to this WorkspaceFile.
   * @param rscName The name of the blob resource.
   * @param val The blob to save.
   */
  public addBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    EditableWorkspaceFile.validateResourceName(rscName);
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

  /** Remove a blob resource. */
  public removeBlob(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM blobs WHERE id=?");
  }

  /** Copy the contents of an existing local file into this WorkspaceFile as a file resource.
   * @param rscName The name of the file resource.
   * @param localFileName The name of a local file to be read.
   * @param fileExt The extension (do not include the leading ".") to be appended to the generated fileName
   * when this file is extracted from the WorkspaceContainer. By default the characters after the last "." in `localFileName`
   * are used. Pass this argument to override that.
   */
  public addFile(rscName: WorkspaceResourceName, localFileName: LocalFileName, fileExt?: string): void {
    EditableWorkspaceFile.validateResourceName(rscName);
    fileExt = fileExt ?? extname(localFileName);
    if (fileExt?.[0] === ".")
      fileExt = fileExt.slice(1);
    this.db.nativeDb.embedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName), fileExt });
  }

  /** Replace an existing file resource with the contents of a local file.
   * @param rscName The name of the file resource.
   * @param localFileName The name of a local file to be read.
   * @throws if rscName does not exist
   */
  public updateFile(rscName: WorkspaceResourceName, localFileName: LocalFileName): void {
    this.queryFileResource(rscName); // throws if not present
    this.db.nativeDb.replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }

  /** Remove a file resource. */
  public removeFile(rscName: WorkspaceResourceName): void {
    const file = this.queryFileResource(rscName);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.db.nativeDb.removeEmbeddedFile(rscName);
  }
}

