/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import * as fs from "fs-extra";
import { join } from "path";
import { DbResult, Guid, OpenMode } from "@itwin/core-bentley";
import { CloudSqliteError, WorkspaceError } from "@itwin/core-common";
import { CloudSqlite } from "../../CloudSqlite";
import { IModelHost, KnownLocations } from "../../IModelHost";
import { SettingName, SettingsContainer, SettingsPriority } from "../../workspace/Settings";
import { CloudSqliteContainer, GetWorkspaceContainerArgs, Workspace, WorkspaceContainerProps, WorkspaceDbProps,
} from "../../workspace/Workspace";
import { SettingsDbManifest, SettingsDbProps, settingsResourceName } from "../../workspace/SettingsDb";
import {
  type CreateNewSettingsContainerArgs, type CreateNewSettingsDbVersionArgs, type CreateSettingsDbArgs, type EditableSettingsCloudContainer, type EditableSettingsDb,
  type SettingsDbVersionResult, type SettingsEditor, SettingsEditor as SettingsEditorNs,
  type UpdateSettingArgs,
} from "../../workspace/SettingsEditor";
import { BlobContainer } from "../../BlobContainerService";
import { settingsDbDefaultName, SettingsDbImpl, settingsManifestProperty } from "./SettingsDbImpl";
import { SettingsSqliteDb } from "./SettingsSqliteDb";
import { constructSettingsEditorWorkspace, OwnedWorkspace } from "./WorkspaceImpl";
import { _implementationProhibited, _nativeDb } from "../Symbols";
import { SettingsImpl } from "./SettingsImpl";
import { IModelJsFs } from "../../IModelJsFs";

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
    this._workspace = constructSettingsEditorWorkspace(new SettingsImpl(), { containerDir: join(IModelHost.cacheDir, settingsEditorName) });
  }

  public get workspace(): Workspace { return this._workspace; }

  private async initializeContainer(args: CreateNewSettingsContainerArgs) {
    class CloudAccess extends CloudSqlite.DbAccess<SettingsSqliteDb> {
      protected static override _cacheName = settingsEditorName;
      public static async initializeSettings(initArgs: CreateNewSettingsContainerArgs) {
        const props = await this.createBlobContainer({ scope: initArgs.scope, metadata: { ...initArgs.metadata, containerType: "settings" } });
        const dbFullName = CloudSqlite.makeSemverName(initArgs.dbName ?? settingsDbDefaultName, "0.0.0");
        await super._initializeDb({ ...initArgs, props, dbName: dbFullName, dbType: SettingsSqliteDb, blockSize: "4M" });
        return props;
      }
    }
    return CloudAccess.initializeSettings(args);
  }

  public async createNewCloudContainer(args: CreateNewSettingsContainerArgs): Promise<EditableSettingsCloudContainer> {
    const cloudContainer = await this.initializeContainer(args);
    const userToken = await IModelHost.authorizationClient?.getAccessToken();
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
    let accessToken = props.accessToken;
    if (undefined === accessToken && props.baseUri !== "")
      accessToken = await CloudSqlite.requestToken({ ...props, accessLevel: "write" });

    return this.getContainer({ ...props, accessToken: accessToken ?? "" });
  }

  public async findContainers(args: SettingsEditorNs.QuerySettingsContainersArgs): Promise<EditableSettingsCloudContainer[]> {
    const containers = await SettingsEditorNs.queryContainers(args);
    const userToken = await IModelHost.getAccessToken();
    const results: EditableSettingsCloudContainer[] = [];
    for (const containerMeta of containers) {
      // queryContainers already validates that BlobContainer.service is defined, so the non-null assertion is safe here.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const tokenProps = await BlobContainer.service!.requestToken({ containerId: containerMeta.containerId, userToken, accessLevel: "write" });
      results.push(this.getContainer({
        containerId: containerMeta.containerId,
        baseUri: tokenProps.baseUri,
        storageType: tokenProps.provider,
        accessToken: tokenProps.token,
        writeable: true,
      }));
    }
    return results;
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
    const resolvedProps = props ?? { dbName: settingsDbDefaultName };
    const dbFileName = this.resolveDbFileName(resolvedProps);
    let db = this._settingsDbs.get(dbFileName);
    if (undefined === db) {
      db = new EditableSettingsDbImpl(resolvedProps, this);
      this._settingsDbs.set(dbFileName, db);
    }

    if (this.cloudContainer && !CloudSqlite.isSemverEditable(db.dbFileName, this.cloudContainer)) {
      this._settingsDbs.delete(dbFileName);
      CloudSqliteError.throwError("already-published", { message: `${db.dbFileName} has been published and is not editable. Make a new version first.` });
    }

    return db;
  }

  public async createNewSettingsDbVersion(args: CreateNewSettingsDbVersionArgs): Promise<SettingsDbVersionResult> {
    const container = this.cloudContainer;
    if (undefined === container)
      WorkspaceError.throwError("no-cloud-container", { message: "versions require cloud containers" });

    const fromDb = { ...args.fromProps, dbName: args.fromProps?.dbName ?? settingsDbDefaultName };
    return CloudSqlite.createNewDbVersion(container, { ...args, fromDb });
  }

  public async createDb(args: CreateSettingsDbArgs): Promise<EditableSettingsDb> {
    const dbName = args.dbName ?? settingsDbDefaultName;
    const version = args.version ?? "0.0.0";
    if (!this.cloudContainer) {
      SettingsSqliteDb.createNewDb(this.resolveDbFileName({ dbName }), { manifest: args.manifest });
    } else {
      const tempDbFile = join(KnownLocations.tmpdir, `empty-${Guid.createValue()}.itwin-settings`);
      try {
        SettingsSqliteDb.createNewDb(tempDbFile, { manifest: args.manifest });
        await CloudSqlite.uploadDb(this.cloudContainer, { localFileName: tempDbFile, dbName: CloudSqlite.makeSemverName(dbName, version) });
      } finally {
        if (fs.existsSync(tempDbFile))
          IModelJsFs.removeSync(tempDbFile);
      }
    }

    return this.getEditableDb({ dbName, version });
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

  public updateSettings(settings: SettingsContainer): void {
    const val = JSON.stringify(settings);
    this.sqliteDb.withSqliteStatement(
      "INSERT INTO strings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE value!=excluded.value",
      (stmt) => {
        stmt.bindString(1, settingsResourceName);
        stmt.bindString(2, val);
        const rc = stmt.step();
        if (DbResult.BE_SQLITE_DONE !== rc)
          WorkspaceError.throwError("write-error", { message: `settings [updateSettings], rc=${rc}` });
      },
    );
    this.sqliteDb.saveChanges();
  }

  public updateSetting(args: UpdateSettingArgs): void {
    this.withOpenDb(() => {
      const container = this.getSettings();
      container[args.settingName] = args.value;
      this.updateSettings(container);
    });
  }

  public removeSetting(settingName: SettingName): void {
    this.withOpenDb(() => {
      const container = this.getSettings();
      delete container[settingName];
      this.updateSettings(container);
    });
  }
}
