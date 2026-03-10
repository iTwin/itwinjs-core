/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import * as fs from "fs-extra";
import { parse } from "json5";
import { extname, join } from "path";
import { BeEvent, DbResult, OpenMode } from "@itwin/core-bentley";
import { CloudSqliteError, LocalDirName, LocalFileName, WorkspaceError } from "@itwin/core-common";
import { CloudSqlite } from "../../CloudSqlite";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelHost, KnownLocations } from "../../IModelHost";
import { Setting, SettingName, Settings, SettingsContainer, SettingsDictionary, SettingsDictionaryProps, SettingsDictionarySource, SettingsPriority } from "../../workspace/Settings";
import { CloudSqliteContainer, GetWorkspaceContainerArgs, Workspace, WorkspaceContainerProps, WorkspaceDbName, WorkspaceDbProps,
} from "../../workspace/Workspace";
import { SettingsDbManifest, SettingsDbProps } from "../../workspace/SettingsDb";
import type {
  CreateNewSettingsContainerArgs, CreateNewSettingsDbVersionArgs, CreateSettingsDbArgs, EditableSettingsCloudContainer, EditableSettingsDb,
  SettingsDbVersionResult, SettingsEditor,
} from "../../workspace/SettingsEditor";
import { SettingsDbImpl, settingsManifestProperty } from "./SettingsDbImpl";
import { SettingsSqliteDb } from "./SettingsSqliteDb";
import { constructWorkspace, OwnedWorkspace } from "./WorkspaceImpl";
import { _implementationProhibited, _nativeDb } from "../Symbols";

const dictionaryMatches = (d1: SettingsDictionarySource, d2: SettingsDictionarySource): boolean => {
  return (d1.workspaceDb === d2.workspaceDb) && (d1.name === d2.name);
};

class SettingsDictionaryImpl implements SettingsDictionary {
  public readonly [_implementationProhibited] = undefined;
  public readonly props: SettingsDictionaryProps;
  public readonly settings: SettingsContainer;

  public constructor(props: SettingsDictionaryProps, settings: SettingsContainer) {
    this.props = { ...props }; // make a copy so it can't be changed by caller
    this.settings = settings;
  }

  public getSetting<T extends Setting>(settingName: string): T | undefined {
    const value = this.settings[settingName] as T | undefined;
    return undefined !== value ? Setting.clone(value) : undefined;
  }
}

/**
 * Internal implementation of Settings interface.
 * @internal
 */
export class SettingsImpl implements Settings {
  public readonly [_implementationProhibited] = undefined;
  public dictionaries: SettingsDictionary[] = [];
  protected verifyPriority(_priority: SettingsPriority) { }
  public close() { }
  public readonly onSettingsChanged = new BeEvent<() => void>();

  public addFile(fileName: LocalFileName, priority: SettingsPriority) {
    this.addJson({ name: fileName, priority }, fs.readFileSync(fileName, "utf-8"));
  }

  public addDirectory(dirName: LocalDirName, priority: SettingsPriority) {
    for (const fileName of IModelJsFs.readdirSync(dirName)) {
      const ext = extname(fileName);
      if (ext === ".json5" || ext === ".json")
        this.addFile(join(dirName, fileName), priority);
    }
  }

  public addJson(props: SettingsDictionaryProps, settingsJson: string) {
    this.addDictionary(props, parse(settingsJson));
  }

  public addDictionary(props: SettingsDictionaryProps, settings: SettingsContainer) {
    this.verifyPriority(props.priority);
    this.dropDictionary(props, false); // make sure we don't have the same dictionary twice
    const dict = new SettingsDictionaryImpl(props, settings);
    const doAdd = () => {
      for (let i = 0; i < this.dictionaries.length; ++i) {
        if (this.dictionaries[i].props.priority <= dict.props.priority) {
          this.dictionaries.splice(i, 0, dict);
          return;
        }
      }
      this.dictionaries.push(dict);
    };
    doAdd();
    this.onSettingsChanged.raiseEvent();
  }

  public getDictionary(source: SettingsDictionarySource): SettingsDictionary | undefined {
    for (const dictionary of this.dictionaries) {
      if (dictionaryMatches(dictionary.props, source))
        return dictionary;
    }
    return undefined;
  }

  public dropDictionary(source: SettingsDictionarySource, raiseEvent = true) {
    for (let i = 0; i < this.dictionaries.length; ++i) {
      if (dictionaryMatches(this.dictionaries[i].props, source)) {
        this.dictionaries.splice(i, 1);
        if (raiseEvent)
          this.onSettingsChanged.raiseEvent();
        return true;
      }
    }
    return false;
  }

  public * getSettingEntries<T extends Setting>(settingName: SettingName): Iterable<{ value: T, dictionary: SettingsDictionary}> {
    for (const dictionary of this.dictionaries) {
      const value = dictionary.getSetting<T>(settingName);
      if (undefined !== value) {
        yield { value, dictionary };
      }
    }
  }

  public * getSettingValues<T extends Setting>(settingName: SettingName): Iterable<T> {
    for (const entry of this.getSettingEntries<T>(settingName)) {
      yield entry.value;
    }
  }

  public getSetting<T extends Setting>(settingName: SettingName, defaultValue?: T): T | undefined {
    for (const value of this.getSettingValues<T>(settingName)) {
      return value;
    }

    return defaultValue;
  }

  // get the setting and verify the result is either undefined or the correct type. If so, return it. Otherwise throw an exception.
  private getResult<T extends Setting>(name: SettingName, expectedType: string) {
    const out = this.getSetting<T>(name);
    if (out === undefined || typeof out === expectedType)
      return out;
    throw new Error(`setting "${name}" is not a ${expectedType}: ${typeof out}`);
  }
  public getString(name: SettingName, defaultValue: string): string;
  public getString(name: SettingName): string | undefined;
  public getString(name: SettingName, defaultValue?: string): string | undefined {
    return this.getResult<string>(name, "string") ?? defaultValue;
  }
  public getBoolean(name: SettingName, defaultValue: boolean): boolean;
  public getBoolean(name: SettingName): boolean | undefined;
  public getBoolean(name: SettingName, defaultValue?: boolean): boolean | undefined {
    return this.getResult<boolean>(name, "boolean") ?? defaultValue;
  }
  public getNumber(name: SettingName, defaultValue: number): number;
  public getNumber(name: SettingName): number | undefined;
  public getNumber(name: SettingName, defaultValue?: number): number | undefined {
    return this.getResult<number>(name, "number") ?? defaultValue;
  }
  public getObject<T extends object>(name: SettingName, defaultValue: T): T;
  public getObject<T extends object>(name: SettingName): T | undefined;
  public getObject<T extends object>(name: SettingName, defaultValue?: T): T | undefined {
    const out = this.getResult<T>(name, "object");
    return out ? IModelHost.settingsSchemas.validateSetting(out, name) : defaultValue;
  }
  public getArray<T extends Setting>(name: SettingName, defaultValue: T[]): T[];
  public getArray<T extends Setting>(name: SettingName): T[] | undefined;
  public getArray<T extends Setting>(name: SettingName, defaultValue?: T[]): T[] | undefined {
    if (IModelHost.settingsSchemas.settingDefs.get(name)?.combineArray) {
      return this.getCombinedArray<T>(name, defaultValue);
    }

    const out = this.getSetting<T[]>(name);
    if (out === undefined)
      return defaultValue;
    if (!Array.isArray(out))
      throw new Error(`setting ${name} is not an array: ${String(out)}`);
    return IModelHost.settingsSchemas.validateSetting(out, name);
  }

  private getCombinedArray<T extends Setting>(name: SettingName, defaultValue?: T[]): T[] | undefined {
    let foundSetting = false;
    const out: T[] = [];
    for (const array of this.getSettingValues<T[]>(name)) {
      foundSetting = true;

      IModelHost.settingsSchemas.validateSetting(array, name);
      for (const value of array) {
        if (undefined === out.find((x) => Setting.areEqual(x, value))) {
          out.push(value);
        }
      }
    }

    return foundSetting ? out : defaultValue;
  }
}

// ==================== SettingsEditor implementation ====================

function settingsDbNameWithDefault(dbName?: WorkspaceDbName): WorkspaceDbName {
  return dbName ?? "settings-db";
}

const settingsEditorName = "SettingsEditor";

/** Construct a new [[SettingsEditor]]. Called by the [[SettingsEditor]] namespace. */
export function constructSettingsEditor(): SettingsEditor {
  return new SettingsEditorImpl();
}

class SettingsEditorImpl implements SettingsEditor {
  public readonly [_implementationProhibited] = undefined;
  private readonly _workspace: OwnedWorkspace;
  private _containers = new Map<string, EditableSettingsContainerImpl>();

  public constructor() {
    this._workspace = constructWorkspace(new SettingsImpl(), { containerDir: join(IModelHost.cacheDir, settingsEditorName) });
  }

  public get workspace(): Workspace { return this._workspace; }

  private async initializeContainer(args: CreateNewSettingsContainerArgs) {
    class CloudAccess extends CloudSqlite.DbAccess<SettingsSqliteDb> {
      protected static override _cacheName = settingsEditorName;
      public static async initializeSettings(initArgs: CreateNewSettingsContainerArgs) {
        const props = await this.createBlobContainer({ scope: initArgs.scope, metadata: { ...initArgs.metadata, containerType: "settings" } });
        const dbFullName = CloudSqlite.makeSemverName(settingsDbNameWithDefault(initArgs.dbName), "0.0.0");
        await super._initializeDb({ ...initArgs, props, dbName: dbFullName, dbType: SettingsSqliteDb, blockSize: "4M" });
        return props;
      }
    }
    return CloudAccess.initializeSettings(args);
  }

  public async createNewCloudContainer(args: CreateNewSettingsContainerArgs): Promise<EditableSettingsCloudContainer> {
    const cloudContainer = await this.initializeContainer(args);
    if (!IModelHost.authorizationClient)
      throw new Error("IModelHost.authorizationClient must be configured to create cloud settings containers");
    const userToken = await IModelHost.authorizationClient.getAccessToken();
    const accessToken = await CloudSqlite.requestToken({ ...cloudContainer, accessLevel: "write", userToken });
    return this.getContainer({ accessToken, ...cloudContainer, writeable: true, description: args.metadata.description });
  }

  public getContainer(args: GetWorkspaceContainerArgs): EditableSettingsCloudContainer {
    const existing = this._containers.get(args.containerId);
    if (existing)
      return existing;
    const baseContainer = this._workspace.getContainer(args);
    const editable = new EditableSettingsContainerImpl(baseContainer);
    this._containers.set(args.containerId, editable);
    return editable;
  }

  public async getContainerAsync(props: WorkspaceContainerProps): Promise<EditableSettingsCloudContainer> {
    const accessToken = props.accessToken ?? ((props.baseUri === "") ? "" : await CloudSqlite.requestToken({ ...props, accessLevel: "write" }));
    return this.getContainer({ ...props, accessToken });
  }

  public close() {
    const errors: unknown[] = [];
    for (const [_, container] of this._containers) {
      try {
        container.cleanup();
      } catch (e) {
        errors.push(e);
      }
    }
    this._containers.clear();
    try {
      this._workspace.close();
    } catch (e) {
      errors.push(e);
    }
    if (errors.length === 1)
      throw errors[0];
    if (errors.length > 1)
      throw new Error(`SettingsEditor.close() encountered ${errors.length} errors: ${errors.map((e) => e instanceof Error ? e.message : String(e)).join("; ")}`);
  }
}

class EditableSettingsContainerImpl implements EditableSettingsCloudContainer {
  public readonly [_implementationProhibited] = undefined;
  private readonly _inner: CloudSqliteContainer;
  private _settingsDbs = new Map<string, EditableSettingsDbImpl>();
  public writeLockHeldBy?: string;

  public constructor(inner: CloudSqliteContainer) {
    this._inner = inner;
  }

  // CloudSqliteContainer delegation
  public get workspace() { return this._inner.workspace; }
  public get filesDir() { return this._inner.filesDir; }
  public get cloudContainer() { return this._inner.cloudContainer; }
  public get fromProps() { return this._inner.fromProps; }
  public resolveDbFileName(props: WorkspaceDbProps) { return this._inner.resolveDbFileName(props); }

  public get cloudProps(): WorkspaceContainerProps | undefined {
    const cc = this.cloudContainer;
    if (undefined === cc)
      return undefined;
    return {
      baseUri: cc.baseUri,
      containerId: cc.containerId,
      storageType: cc.storageType as "azure" | "google",
      isPublic: cc.isPublic,
    };
  }

  public getEditableDb(props?: SettingsDbProps): EditableSettingsDb {
    const dbName = settingsDbNameWithDefault(props?.dbName);
    let db = this._settingsDbs.get(dbName);
    if (undefined === db) {
      db = new EditableSettingsDbImpl(props ?? { dbName }, this);
      this._settingsDbs.set(dbName, db);
    }

    if (this.cloudContainer && !CloudSqlite.isSemverEditable(db.dbFileName, this.cloudContainer)) {
      this._settingsDbs.delete(dbName);
      CloudSqliteError.throwError("already-published", { message: `${db.dbFileName} has been published and is not editable. Make a new version first.` });
    }

    return db;
  }

  public async createNewSettingsDbVersion(args: CreateNewSettingsDbVersionArgs): Promise<SettingsDbVersionResult> {
    const container = this.cloudContainer;
    if (undefined === container)
      WorkspaceError.throwError("no-cloud-container", { message: "versions require cloud containers" });

    const fromDb = { ...args.fromProps, dbName: settingsDbNameWithDefault(args.fromProps?.dbName) };
    return CloudSqlite.createNewDbVersion(container, { ...args, fromDb });
  }

  public async createDb(args: CreateSettingsDbArgs): Promise<EditableSettingsDb> {
    const dbName = settingsDbNameWithDefault(args.dbName);
    if (!this.cloudContainer) {
      SettingsSqliteDb.createNewDb(this.resolveDbFileName({ dbName }), { manifest: args.manifest });
    } else {
      const tempDbFile = join(KnownLocations.tmpdir, "empty.itwin-settings");
      try {
        if (fs.existsSync(tempDbFile))
          IModelJsFs.removeSync(tempDbFile);

        SettingsSqliteDb.createNewDb(tempDbFile, { manifest: args.manifest });
        await CloudSqlite.uploadDb(this.cloudContainer, { localFileName: tempDbFile, dbName: CloudSqlite.makeSemverName(dbName, args.version) });
      } finally {
        if (fs.existsSync(tempDbFile))
          IModelJsFs.removeSync(tempDbFile);
      }
    }

    return this.getEditableDb({ dbName });
  }

  public acquireWriteLock(user: string): void {
    if (this.cloudContainer) {
      this.cloudContainer.acquireWriteLock(user);
      this.writeLockHeldBy = user;
    }
  }

  public releaseWriteLock(): void {
    if (this.cloudContainer) {
      this.cloudContainer.releaseWriteLock();
      this.writeLockHeldBy = undefined;
    }
  }

  public abandonChanges(): void {
    if (this.cloudContainer) {
      this.cloudContainer.abandonChanges();
      this.writeLockHeldBy = undefined;
    }
  }

  /** Close all editable settings dbs tracked by this container. */
  public cleanup(): void {
    for (const [_, db] of this._settingsDbs)
      db.close();
    this._settingsDbs.clear();
  }
}

class EditableSettingsDbImpl extends SettingsDbImpl implements EditableSettingsDb {
  public override get container(): EditableSettingsCloudContainer {
    return this._container as EditableSettingsCloudContainer;
  }

  public constructor(props: SettingsDbProps, container: EditableSettingsContainerImpl) {
    super(props, container, SettingsPriority.application);
  }

  public override open(): void {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.ReadWrite, this._container.cloudContainer);
  }

  public override close(): void {
    let error: unknown;
    try {
      if (this.isOpen) {
        const lastEditedBy = (this._container as EditableSettingsContainerImpl).writeLockHeldBy;
        if (lastEditedBy !== undefined)
          this.updateManifest({ ...this.manifest, lastEditedBy });
        this.sqliteDb.saveChanges();
      }
    } catch (e) {
      error = e;
    } finally {
      super.close();
    }
    if (error) {
      if (error instanceof Error)
        throw error;
      throw new Error(`EditableSettingsDb.close() failed`);
    }
  }

  public updateManifest(manifest: SettingsDbManifest): void {
    this.sqliteDb[_nativeDb].saveFileProperty(settingsManifestProperty, JSON.stringify(manifest));
    this._manifest = undefined;
  }

  public updateSettingsDictionary(name: string, settings: SettingsContainer): void {
    const val = JSON.stringify(settings);
    this.sqliteDb.withSqliteStatement(
      "INSERT INTO strings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE value!=excluded.value",
      (stmt) => {
        stmt.bindString(1, name);
        stmt.bindString(2, val);
        const rc = stmt.step();
        if (DbResult.BE_SQLITE_DONE !== rc)
          WorkspaceError.throwError("write-error", { message: `settings [updateSettingsDictionary], rc=${rc}` });
      },
    );
    this.sqliteDb.saveChanges();
  }

  public removeSettingsDictionary(name: string): void {
    this.sqliteDb.withSqliteStatement("DELETE FROM strings WHERE id=?", (stmt) => {
      stmt.bindString(1, name);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        WorkspaceError.throwError("write-error", { message: `settings [removeSettingsDictionary], rc=${rc}` });
    });
    this.sqliteDb.saveChanges();
  }
}
