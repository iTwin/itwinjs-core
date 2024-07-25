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
import * as semver from "semver";
import { AccessToken, assert, BeEvent, DbResult, Mutable, OpenMode } from "@itwin/core-bentley";
import { FilePropertyProps, IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { CloudSqlite } from "../../CloudSqlite";
import { IModelHost, KnownLocations } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { SQLiteDb } from "../../SQLiteDb";
import { SqliteStatement } from "../../SqliteStatement";
import { SettingName, Settings, SettingsContainer, SettingsDictionaryProps, SettingsPriority } from "../../workspace/Settings";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import {
  GetWorkspaceContainerArgs, Workspace, WorkspaceContainer, WorkspaceContainerId, WorkspaceContainerProps, WorkspaceDb, WorkspaceDbCloudProps,
  WorkspaceDbFullName, WorkspaceDbLoadError, WorkspaceDbLoadErrors, WorkspaceDbManifest, WorkspaceDbName, WorkspaceDbNameAndVersion, WorkspaceDbProps,
  WorkspaceDbQueryResourcesArgs, WorkspaceDbSettingsProps, WorkspaceDbVersion, WorkspaceOpts, WorkspaceResourceName, WorkspaceSettingNames,
} from "../../workspace/Workspace";
import { CreateNewWorkspaceContainerArgs, CreateNewWorkspaceDbVersionArgs, EditableWorkspaceContainer, EditableWorkspaceDb, WorkspaceEditor } from "../../workspace/WorkspaceEditor";
import { WorkspaceSqliteDb } from "./WorkspaceSqliteDb";
import { SettingsImpl } from "./SettingsImpl";
import { _implementationProhibited, _nativeDb } from "../Symbols";

function workspaceDbNameWithDefault(dbName?: WorkspaceDbName): WorkspaceDbName {
  return dbName ?? "workspace-db";
}

/** file extension for local WorkspaceDbs */
export const workspaceDbFileExt = "itwin-workspace";

interface WorkspaceCloudContainer extends CloudSqlite.CloudContainer {
  connectCount: number;
  sharedConnect(): boolean;
  sharedDisconnect(): void;
}

interface WorkspaceCloudCache extends CloudSqlite.CloudCache {
  workspaceContainers: Map<string, WorkspaceCloudContainer>;
}

function makeWorkspaceCloudCache(arg: CloudSqlite.CreateCloudCacheArg): WorkspaceCloudCache {
  const cache = CloudSqlite.CloudCaches.getCache(arg) as WorkspaceCloudCache;
  if (undefined === cache.workspaceContainers) // if we just created this container, add the map.
    cache.workspaceContainers = new Map<string, WorkspaceCloudContainer>();
  return cache;
}

function getContainerFullId(props: WorkspaceContainerProps) {
  return `${props.baseUri}/${props.containerId}`;
}

function getWorkspaceCloudContainer(props: CloudSqlite.ContainerAccessProps, cache: WorkspaceCloudCache) {
  const id = getContainerFullId(props);
  let cloudContainer = cache.workspaceContainers.get(id);
  if (undefined !== cloudContainer)
    return cloudContainer;

  cloudContainer = CloudSqlite.createCloudContainer(props) as WorkspaceCloudContainer;
  cache.workspaceContainers.set(id, cloudContainer);
  cloudContainer.connectCount = 0;
  cloudContainer.sharedConnect = function (this: WorkspaceCloudContainer) {
    if (this.connectCount++ === 0) {
      this.connect(cache);
      return true;
    }

    return false;
  };

  cloudContainer.sharedDisconnect = function (this: WorkspaceCloudContainer) {
    if (--this.connectCount <= 0) {
      this.disconnect();
      cache.workspaceContainers.delete(id);
      this.connectCount = 0;
    }
  };

  return cloudContainer;
}

class WorkspaceContainerImpl implements WorkspaceContainer {
  public readonly [_implementationProhibited] = undefined;
  public readonly workspace: WorkspaceImpl;
  public readonly filesDir: LocalDirName;
  public readonly id: WorkspaceContainerId;
  public readonly fromProps: WorkspaceContainerProps;
  private readonly _cloudContainer?: WorkspaceCloudContainer | undefined;

  public get cloudContainer(): WorkspaceCloudContainer | undefined {
    return this._cloudContainer;
  }

  protected _wsDbs = new Map<WorkspaceDbName, WorkspaceDb>();
  public get dirName() { return join(this.workspace.containerDir, this.id); }

  public constructor(workspace: WorkspaceImpl, props: WorkspaceContainerProps & { accessToken: AccessToken }) {
    validateWorkspaceContainerId(props.containerId);
    this.workspace = workspace;
    this.id = props.containerId;
    this.fromProps = props;

    if (props.baseUri !== "")
      this._cloudContainer = getWorkspaceCloudContainer(props, this.workspace.getCloudCache());

    workspace.addContainer(this);
    this.filesDir = join(this.dirName, "Files");

    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return;

    // sharedConnect returns true if we just connected (if the container is shared, it may have already been connected)
    if (cloudContainer.sharedConnect() && false !== props.syncOnConnect) {
      try {
        cloudContainer.checkForChanges();
      } catch (e: unknown) {
        // must be offline
      }
    }
  }

  public resolveDbFileName(props: WorkspaceDbProps): WorkspaceDbFullName {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return join(this.dirName, `${props.dbName}.${workspaceDbFileExt}`); // local file, versions not allowed

    const dbName = workspaceDbNameWithDefault(props.dbName);
    const dbs = cloudContainer.queryDatabases(`${dbName}*`); // get all databases that start with dbName

    const versions = [];
    for (const db of dbs) {
      const thisDb = parseWorkspaceDbFileName(db);
      if (thisDb.dbName === dbName && "string" === typeof thisDb.version && thisDb.version.length > 0)
        versions.push(thisDb.version);
    }

    if (versions.length === 0)
      versions[0] = "0.0.0";

    const range = props.version ?? "*";
    try {
      const version = semver.maxSatisfying(versions, range, { loose: true, includePrerelease: props.includePrerelease });
      if (version)
        return `${dbName}:${version}`;
    } catch (e: unknown) {
    }
    throwWorkspaceDbLoadError(`No version of '${dbName}' available for "${range}"`, props);
  }

  public addWorkspaceDb(toAdd: WorkspaceDb) {
    if (undefined !== this._wsDbs.get(toAdd.dbName))
      throw new Error(`workspaceDb '${toAdd.dbName}' already exists in workspace`);
    this._wsDbs.set(toAdd.dbName, toAdd);
  }

  public getWorkspaceDb(props?: WorkspaceDbProps): WorkspaceDb {
    return this._wsDbs.get(workspaceDbNameWithDefault(props?.dbName)) ?? new WorkspaceDbImpl(props ?? {}, this);
  }

  public closeWorkspaceDb(toDrop: WorkspaceDb) {
    const name = toDrop.dbName;
    const wsDb = this._wsDbs.get(name);
    if (wsDb === toDrop) {
      this._wsDbs.delete(name);
      wsDb.close();
    }
  }

  public close() {
    for (const [_name, db] of this._wsDbs)
      db.close();
    this._wsDbs.clear();
    this.cloudContainer?.sharedDisconnect();
  }
}

/** Implementation of WorkspaceDb */
class WorkspaceDbImpl implements WorkspaceDb {
  public readonly [_implementationProhibited] = undefined;
  public readonly sqliteDb = new WorkspaceSqliteDb();
  public readonly dbName: WorkspaceDbName;
  protected readonly _container: WorkspaceContainer;
  public readonly onClose = new BeEvent<() => void>();
  public readonly dbFileName: string;
  protected _manifest?: WorkspaceDbManifest;

  /** true if this WorkspaceDb is currently open */
  public get isOpen() { return this.sqliteDb.isOpen; }
  public get container(): WorkspaceContainer { return this._container; }
  public queryFileResource(rscName: WorkspaceResourceName): { localFileName: LocalFileName, info: IModelJsNative.EmbedFileQuery } | undefined {
    const info = this.sqliteDb[_nativeDb].queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this._container.filesDir, createHash("sha1").update(this.dbFileName).update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  public constructor(props: WorkspaceDbProps, container: WorkspaceContainer) {
    this.dbName = workspaceDbNameWithDefault(props.dbName);
    validateWorkspaceDbName(this.dbName);
    this._container = container;
    this.dbFileName = container.resolveDbFileName(props);
    container.addWorkspaceDb(this);
    if (true === props.prefetch)
      this.prefetch();
  }

  public open() {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.Readonly, this._container.cloudContainer);
  }

  public close() {
    if (this.isOpen) {
      this.onClose.raiseEvent();
      this.sqliteDb.closeDb();
      this._container.closeWorkspaceDb(this);
    }
  }
  public get version() {
    return parseWorkspaceDbFileName(this.dbFileName).version;
  }

  public get manifest(): WorkspaceDbManifest {
    return this._manifest ??= this.withOpenDb((db) => {
      const manifestJson = db[_nativeDb].queryFileProperty(workspaceManifestProperty, true) as string | undefined;
      return manifestJson ? JSON.parse(manifestJson) : { workspaceName: this.dbName };
    });
  }

  private withOpenDb<T>(operation: (db: WorkspaceSqliteDb) => T): T {
    const done = this.isOpen ? () => { } : (this.open(), () => this.close());
    try {
      return operation(this.sqliteDb);
    } finally {
      done();
    }
  }

  public getString(rscName: WorkspaceResourceName): string | undefined {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT value from strings WHERE id=?", (stmt) => {
        stmt.bindString(1, rscName);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueString(0) : undefined;
      });
    });
  }

  public getBlobReader(rscName: WorkspaceResourceName): SQLiteDb.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobReader = SQLiteDb.createBlobIO();
      blobReader.open(this.sqliteDb[_nativeDb], { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0) });
      return blobReader;
    });
  }

  public getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT value from blobs WHERE id=?", (stmt) => {
        stmt.bindString(1, rscName);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueBlob(0) : undefined;
      });
    });
  }

  public getFile(rscName: WorkspaceResourceName, targetFileName?: LocalFileName): LocalFileName | undefined {
    return this.withOpenDb((db) => {
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

      db[_nativeDb].extractEmbeddedFile({ name: rscName, localFileName });
      const date = new Date(info.date);
      fs.utimesSync(localFileName, date, date); // set the last-modified date of the file to match date in container
      fs.chmodSync(localFileName, "0444"); // set file readonly
      return localFileName;
    });
  }

  public prefetch(opts?: CloudSqlite.PrefetchProps): CloudSqlite.CloudPrefetch {
    const cloudContainer = this._container.cloudContainer;
    if (cloudContainer === undefined)
      throw new Error("no cloud container to prefetch");
    return CloudSqlite.startCloudPrefetch(cloudContainer, this.dbFileName, opts);
  }

  public queryResources(args: WorkspaceDbQueryResourcesArgs): void {
    const table = "blob" !== args.type ? "strings" : "blobs";
    this.withOpenDb((db) => {
      const where = undefined !== args.namePattern ? ` WHERE id ${args.nameCompare ?? "="} ?` : "";
      db.withSqliteStatement(`SELECT id from ${table}${where}`, (stmt) => {
        function* makeIterable() {
          while (DbResult.BE_SQLITE_ROW === stmt.step()) {
            yield stmt.getValueString(0);
          }
        }

        if (undefined !== args.namePattern) {
          stmt.bindString(1, args.namePattern);
        }

        args.callback(makeIterable());
      });
    });
  }
}

/** Implementation of Workspace */
class WorkspaceImpl implements Workspace {
  public readonly [_implementationProhibited] = undefined;
  private _containers = new Map<WorkspaceContainerId, WorkspaceContainerImpl>();
  public readonly containerDir: LocalDirName;
  public readonly settings: Settings;
  protected _cloudCache?: WorkspaceCloudCache;
  public getCloudCache(): WorkspaceCloudCache {
    return this._cloudCache ??= makeWorkspaceCloudCache({ cacheName: workspaceEditorName, cacheSize: "20G" });
  }

  public constructor(settings: Settings, opts?: WorkspaceOpts) {
    this.settings = settings;
    this.containerDir = opts?.containerDir ?? join(IModelHost.cacheDir, workspaceEditorName);
    let settingsFiles = opts?.settingsFiles;
    if (settingsFiles) {
      if (typeof settingsFiles === "string")
        settingsFiles = [settingsFiles];
      settingsFiles.forEach((file) => settings.addFile(file, SettingsPriority.application));
    }
  }

  public addContainer(toAdd: WorkspaceContainerImpl) {
    if (undefined !== this._containers.get(toAdd.id))
      throw new Error("container already exists in workspace");
    this._containers.set(toAdd.id, toAdd);
  }

  public findContainer(containerId: WorkspaceContainerId) {
    return this._containers.get(containerId);
  }

  public getContainer(props: GetWorkspaceContainerArgs): WorkspaceContainer {
    return this.findContainer(props.containerId) ?? new WorkspaceContainerImpl(this, props);
  }

  public async getContainerAsync(props: WorkspaceContainerProps): Promise<WorkspaceContainer> {
    const accessToken = props.accessToken ?? ((props.baseUri === "") || props.isPublic) ? "" : await CloudSqlite.requestToken({ ...props, accessLevel: "read" });
    return this.getContainer({ ...props, accessToken });
  }

  public async getWorkspaceDb(props: WorkspaceDbCloudProps): Promise<WorkspaceDb> {
    let container: WorkspaceContainer | undefined = this.findContainer(props.containerId);
    if (undefined === container) {
      const accessToken = props.isPublic ? "" : await CloudSqlite.requestToken({ accessLevel: "read", ...props });
      container = new WorkspaceContainerImpl(this, { ...props, accessToken });
    }
    return container.getWorkspaceDb(props);
  }

  public async loadSettingsDictionary(props: WorkspaceDbSettingsProps | WorkspaceDbSettingsProps[], problems?: WorkspaceDbLoadError[]) {
    if (!Array.isArray(props))
      props = [props];

    for (const prop of props) {
      const db = await this.getWorkspaceDb(prop);
      db.open();
      try {
        const manifest = db.manifest;
        const dictProps: SettingsDictionaryProps = { name: prop.resourceName, workspaceDb: db, priority: prop.priority };
        // don't load if we already have this dictionary. Happens if the same WorkspaceDb is in more than one list
        if (undefined === this.settings.getDictionary(dictProps)) {
          const settingsJson = db.getString(prop.resourceName);
          if (undefined === settingsJson)
            throwWorkspaceDbLoadError(`could not load setting dictionary resource '${prop.resourceName}' from: '${manifest.workspaceName}'`, prop, db);

          db.close(); // don't leave this db open in case we're going to find another dictionary in it recursively.

          this.settings.addJson(dictProps, settingsJson);
          const dict = this.settings.getDictionary(dictProps);
          if (dict) {
            Workspace.onSettingsDictionaryLoadedFn({ dict, from: db });
            // if the dictionary we just loaded has a "settingsWorkspaces" entry, load them too, recursively
            const nested = dict.getSetting<WorkspaceDbSettingsProps[]>(WorkspaceSettingNames.settingsWorkspaces);
            if (nested !== undefined) {
              IModelHost.settingsSchemas.validateSetting<WorkspaceDbSettingsProps[]>(nested, WorkspaceSettingNames.settingsWorkspaces);
              await this.loadSettingsDictionary(nested, problems);
            }
          }
        }
      } catch (e) {
        db.close();
        problems?.push(e as WorkspaceDbLoadError);
      }
    }
  }

  public close() {
    this.settings.close();
    for (const [_id, container] of this._containers)
      container.close();
    this._containers.clear();
  }

  public resolveWorkspaceDbSetting(settingName: SettingName, filter?: Workspace.DbListFilter): WorkspaceDbCloudProps[] {
    const settingDef = IModelHost.settingsSchemas.settingDefs.get(settingName);
    const combine = settingDef?.combineArray === true;
    filter = filter ?? (() => true);
    const result: WorkspaceDbCloudProps[] = [];
    for (const entry of this.settings.getSettingEntries<WorkspaceDbCloudProps[]>(settingName)) {
      for (const dbProp of entry.value) {
        if (filter(dbProp, entry.dictionary)) {
          result.push(dbProp);
        }
      }

      if (!combine) {
        break;
      }
    }

    return result;
  }

  public async getWorkspaceDbs(args: Workspace.DbListOrSettingName & { filter?: Workspace.DbListFilter, problems?: WorkspaceDbLoadError[] }): Promise<WorkspaceDb[]> {
    const dbList = (args.settingName !== undefined) ? this.resolveWorkspaceDbSetting(args.settingName, args.filter) : args.dbs;
    const result: WorkspaceDb[] = [];
    const pushUnique = (wsDb: WorkspaceDb) => {
      for (const db of result) {
        // if we already have this db, skip it. The test below also has to consider that we create a separate WorkspaceDb object for the same
        // database from more than one Workspace (though then they must use a "shared" CloudContainer).
        if (db === wsDb || ((db.container.cloudContainer === wsDb.container.cloudContainer) && (db.dbFileName === wsDb.dbFileName)))
          return; // this db is redundant
      }
      result.push(wsDb);
    };

    for (const dbProps of dbList) {
      try {
        pushUnique(await this.getWorkspaceDb(dbProps));
      } catch (e) {
        const loadErr = e as WorkspaceDbLoadError;
        loadErr.wsDbProps = dbProps;
        args.problems?.push(loadErr);
      }
    }
    return result;
  }
}

const workspaceEditorName = "WorkspaceEditor"; // name of the cache for the editor workspace
class EditorWorkspaceImpl extends WorkspaceImpl {
  public override getCloudCache(): WorkspaceCloudCache {
    return this._cloudCache ??= makeWorkspaceCloudCache({ cacheName: workspaceEditorName, cacheSize: "20G" });
  }
}

class EditorImpl implements WorkspaceEditor {
  public readonly [_implementationProhibited] = undefined;
  public workspace = new EditorWorkspaceImpl(new SettingsImpl(), { containerDir: join(IModelHost.cacheDir, workspaceEditorName) });

  public async initializeContainer(args: CreateNewWorkspaceContainerArgs) {
    class CloudAccess extends CloudSqlite.DbAccess<WorkspaceSqliteDb> {
      protected static override _cacheName = workspaceEditorName;
      public static async initializeWorkspace(args: CreateNewWorkspaceContainerArgs) {
        const props = await this.createBlobContainer({ scope: args.scope, metadata: { ...args.metadata, containerType: "workspace" } });
        const dbFullName = makeWorkspaceDbFileName(workspaceDbNameWithDefault(args.dbName), "0.0.0");
        await super._initializeDb({ ...args, props, dbName: dbFullName, dbType: WorkspaceSqliteDb, blockSize: "4M" });
        return props;
      }
    }
    return CloudAccess.initializeWorkspace(args);
  }

  public async createNewCloudContainer(args: CreateNewWorkspaceContainerArgs): Promise<EditableWorkspaceContainer> {
    const cloudContainer = await this.initializeContainer(args);
    const userToken = await IModelHost.authorizationClient?.getAccessToken();
    const accessToken = await CloudSqlite.requestToken({ ...cloudContainer, accessLevel: "write", userToken });
    return this.getContainer({ accessToken, ...cloudContainer, writeable: true, description: args.metadata.description });
  }

  public getContainer(props: GetWorkspaceContainerArgs): EditableWorkspaceContainer {
    return this.workspace.findContainer(props.containerId) as EditableWorkspaceContainer | undefined ?? new EditorContainerImpl(this.workspace, props);
  }
  public async getContainerAsync(props: WorkspaceContainerProps): Promise<EditableWorkspaceContainer> {
    const accessToken = props.accessToken ?? (props.baseUri === "") ? "" : await CloudSqlite.requestToken({ ...props, accessLevel: "write" });
    return this.getContainer({ ...props, accessToken });
  }

  public close() {
    this.workspace.close();
  }
}

interface EditCloudContainer extends WorkspaceCloudContainer {
  writeLockHeldBy?: string;  // added by acquireWriteLock
}

class EditorContainerImpl extends WorkspaceContainerImpl implements EditableWorkspaceContainer {
  public override get cloudContainer(): EditCloudContainer | undefined {
    return super.cloudContainer as EditCloudContainer | undefined;
  }

  public get cloudProps(): WorkspaceContainerProps | undefined {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return undefined;
    return {
      baseUri: cloudContainer.baseUri,
      containerId: cloudContainer.containerId,
      storageType: cloudContainer.storageType as "azure" | "google",
      isPublic: cloudContainer.isPublic,
    };
  }
  public async createNewWorkspaceDbVersion(args: CreateNewWorkspaceDbVersionArgs): Promise<{ oldDb: WorkspaceDbNameAndVersion, newDb: WorkspaceDbNameAndVersion }> {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      throw new Error("versions require cloud containers");

    const oldName = this.resolveDbFileName(args.fromProps ?? {});
    const oldDb = parseWorkspaceDbFileName(oldName);
    const newVersion = semver.inc(oldDb.version, args.versionType, args.identifier);
    if (!newVersion)
      throwWorkspaceDbLoadError("invalid version", args.fromProps ?? {});

    const newName = makeWorkspaceDbFileName(oldDb.dbName, newVersion);
    await cloudContainer.copyDatabase(oldName, newName);
    // return the old and new db names and versions
    return { oldDb, newDb: { dbName: oldDb.dbName, version: newVersion } };
  }

  public override getWorkspaceDb(props: WorkspaceDbProps): EditableWorkspaceDb {
    return this.getEditableDb(props);
  }
  public getEditableDb(props: WorkspaceDbProps): EditableWorkspaceDb {
    const db = this._wsDbs.get(workspaceDbNameWithDefault(props.dbName)) as EditableDbImpl | undefined ?? new EditableDbImpl(props, this);
    const isPrerelease = semver.major(db.version) === 0 || semver.prerelease(db.version);

    if (!isPrerelease && this.cloudContainer && this.cloudContainer.queryDatabase(db.dbFileName)?.state !== "copied")
      throw new Error(`${db.dbFileName} has been published and is not editable. Make a new version first.`);

    return db;
  }

  public acquireWriteLock(user: string): void {
    if (this.cloudContainer) {
      this.cloudContainer.acquireWriteLock(user);
      this.cloudContainer.writeLockHeldBy = user;
    }
  }
  public releaseWriteLock() {
    if (this.cloudContainer) {
      this.cloudContainer.releaseWriteLock();
      this.cloudContainer.writeLockHeldBy = undefined;
    }
  }

  public abandonChanges() {
    if (this.cloudContainer) {
      this.cloudContainer.abandonChanges();
      this.cloudContainer.writeLockHeldBy = undefined;
    }
  }

  public async createDb(args: { dbName?: string, version?: string, manifest: WorkspaceDbManifest }): Promise<EditableWorkspaceDb> {
    if (!this.cloudContainer) {
      WorkspaceEditor.createEmptyDb({ localFileName: this.resolveDbFileName(args), manifest: args.manifest });
    } else {
      // currently the only way to create a workspaceDb in a cloud container is to create a temporary workspaceDb and upload it.
      const tempDbFile = join(KnownLocations.tmpdir, `empty.${workspaceDbFileExt}`);
      if (fs.existsSync(tempDbFile))
        IModelJsFs.removeSync(tempDbFile);

      WorkspaceEditor.createEmptyDb({ localFileName: tempDbFile, manifest: args.manifest });
      await CloudSqlite.uploadDb(this.cloudContainer, { localFileName: tempDbFile, dbName: makeWorkspaceDbFileName(workspaceDbNameWithDefault(args.dbName), args.version) });
      IModelJsFs.removeSync(tempDbFile);
    }

    return this.getWorkspaceDb(args);
  }
}

class EditableDbImpl extends WorkspaceDbImpl implements EditableWorkspaceDb {
  public override get container(): EditableWorkspaceContainer {
    assert(this._container instanceof EditorContainerImpl);
    return this._container;
  }

  private static validateResourceName(name: WorkspaceResourceName) {
    if (name.trim() !== name) {
      throw new Error("resource name may not have leading or trailing spaces");
    }

    if (name.length > 1024) {
      throw new Error("resource name too long");
    }
  }

  private validateResourceSize(val: Uint8Array | string) {
    const len = typeof val === "string" ? val.length : val.byteLength;
    if (len > (1024 * 1024 * 1024)) // one gigabyte
      throw new Error("value is too large");
  }
  public get cloudProps(): WorkspaceDbCloudProps | undefined {
    const props = (this._container as EditorContainerImpl).cloudProps as Mutable<WorkspaceDbCloudProps>;
    if (props === undefined)
      return undefined;

    const parsed = parseWorkspaceDbFileName(this.dbFileName);
    return { ...props, dbName: parsed.dbName, version: parsed.version };
  }

  public override open() {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.ReadWrite, this._container.cloudContainer);
  }

  public override close() {
    if (this.isOpen) {
      // whenever we close an EditableDb, update the name of the last editor in the manifest
      const lastEditedBy = (this._container.cloudContainer as any)?.writeLockHeldBy;
      if (lastEditedBy !== undefined)
        this.updateManifest({ ...this.manifest, lastEditedBy });

      // make sure all changes were saved before we close
      this.sqliteDb.saveChanges();
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
      if (DbResult.BE_SQLITE_DONE !== rc) {
        if (DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY === rc)
          throw new IModelError(rc, `resource "${rscName}" already exists`);

        throw new IModelError(rc, `workspace [${sql}]`);
      }
    });
    this.sqliteDb.saveChanges();
  }

  public updateManifest(manifest: WorkspaceDbManifest) {
    this.sqliteDb[_nativeDb].saveFileProperty(workspaceManifestProperty, JSON.stringify(manifest));
    this._manifest = undefined;
  }
  public updateSettingsResource(settings: SettingsContainer, rscName?: string) {
    this.updateString(rscName ?? "settingsDictionary", JSON.stringify(settings));
  }
  public addString(rscName: WorkspaceResourceName, val: string): void {
    EditableDbImpl.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => stmt.bindString(2, val));
  }
  public updateString(rscName: WorkspaceResourceName, val: string): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE value!=excluded.value", (stmt) => stmt.bindString(2, val));
  }
  public removeString(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM strings WHERE id=?");
  }
  public addBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    EditableDbImpl.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?)", (stmt) => stmt.bindBlob(2, val));
  }
  public updateBlob(rscName: WorkspaceResourceName, val: Uint8Array): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE value!=excluded.value", (stmt) => stmt.bindBlob(2, val));
  }
  public getBlobWriter(rscName: WorkspaceResourceName): SQLiteDb.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobWriter = SQLiteDb.createBlobIO();
      blobWriter.open(this.sqliteDb[_nativeDb], { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0), writeable: true });
      return blobWriter;
    });
  }
  public removeBlob(rscName: WorkspaceResourceName): void {
    this.performWriteSql(rscName, "DELETE FROM blobs WHERE id=?");
  }
  public addFile(rscName: WorkspaceResourceName, localFileName: LocalFileName, fileExt?: string): void {
    EditableDbImpl.validateResourceName(rscName);
    fileExt = fileExt ?? extname(localFileName);
    if (fileExt?.[0] === ".")
      fileExt = fileExt.slice(1);
    this.sqliteDb[_nativeDb].embedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName), fileExt });
  }
  public updateFile(rscName: WorkspaceResourceName, localFileName: LocalFileName): void {
    this.queryFileResource(rscName); // throws if not present
    this.sqliteDb[_nativeDb].replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }
  public removeFile(rscName: WorkspaceResourceName): void {
    const file = this.queryFileResource(rscName);
    if (undefined === file)
      throw new Error(`file resource "${rscName}" does not exist`);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.sqliteDb[_nativeDb].removeEmbeddedFile(rscName);
  }
}

export function constructWorkspaceDb(props: WorkspaceDbProps, container: WorkspaceContainer): WorkspaceDb {
  return new WorkspaceDbImpl(props, container);
}

export function constructWorkspace(settings: Settings, opts?: WorkspaceOpts): OwnedWorkspace {
  return new WorkspaceImpl(settings, opts);
}

export function constructWorkspaceEditor(): WorkspaceEditor {
  return new EditorImpl();
}

export function noLeadingOrTrailingSpaces(name: string, msg: string) {
  if (name.trim() !== name)
    throw new Error(`${msg} [${name}] may not have leading or trailing spaces`);
}

export function validateWorkspaceDbName(dbName: WorkspaceDbName) {
  if (dbName === "" || dbName.length > 255 || /[#\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(dbName) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(dbName))
    throw new Error(`invalid dbName: [${dbName}]`);

  noLeadingOrTrailingSpaces(dbName, "dbName");
}

/**
 * Validate that a WorkspaceContainer.Id is valid.
 * The rules for ContainerIds (from Azure, see https://docs.microsoft.com/en-us/rest/api/storageservices/naming-and-referencing-containers--blobs--and-metadata):
 *  - may only contain lower case letters, numbers or dashes
 *  - may not start or end with with a dash nor have more than one dash in a row
 *  - may not be shorter than 3 or longer than 63 characters
 */
export function validateWorkspaceContainerId(id: WorkspaceContainerId) {
  if (!/^(?=.{3,63}$)[a-z0-9]+(-[a-z0-9]+)*$/g.test(id))
    throw new Error(`invalid containerId: [${id}]`);
}

export function validateWorkspaceDbVersion(version?: WorkspaceDbVersion) {
  version = version ?? "0.0.0";
  const opts = { loose: true, includePrerelease: true };
  // clean allows prerelease, so try it first. If that fails attempt to coerce it (coerce strips prerelease even if you say not to.)
  const semVersion = semver.clean(version, opts) ?? semver.coerce(version, opts)?.version;
  if (!semVersion)
    throw new Error("invalid version specification");
  version = semVersion;
  return version;
}

/**
 * Parse the name stored in a WorkspaceContainer into the dbName and version number. A single WorkspaceContainer may hold
 * many versions of the same WorkspaceDb. The name of the Db in the WorkspaceContainer is in the format "name:version". This
 * function splits them into separate strings.
 */
export function parseWorkspaceDbFileName(dbFileName: WorkspaceDbFullName): { dbName: WorkspaceDbName, version: WorkspaceDbVersion } {
  const parts = dbFileName.split(":");
  return { dbName: parts[0], version: parts[1] };
}

/** Create a dbName for a WorkspaceDb from its base name and version. This will be in the format "name:version" */
export function makeWorkspaceDbFileName(dbName: WorkspaceDbName, version?: WorkspaceDbVersion): WorkspaceDbName {
  return `${dbName}:${validateWorkspaceDbVersion(version)}`;
}

export const workspaceManifestProperty: FilePropertyProps = { namespace: "workspace", name: "manifest" };

function throwWorkspaceDbLoadError(msg: string, wsDbProps: WorkspaceDbProps | WorkspaceDbCloudProps, db?: WorkspaceDb): never {
  const error = new Error(msg) as WorkspaceDbLoadError;
  error.wsDbProps = wsDbProps;
  error.wsDb = db;
  throw error;
}

export function throwWorkspaceDbLoadErrors(msg: string, errors: WorkspaceDbLoadError[]): never {
  const error = new Error(msg) as WorkspaceDbLoadErrors;
  error.wsLoadErrors = errors;
  throw error;
}

export interface OwnedWorkspace extends Workspace {
  /** Only the owner of a Workspace may close it. */
  close(): void;
}
