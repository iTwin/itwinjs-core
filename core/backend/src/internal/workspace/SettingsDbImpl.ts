/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { DbResult, OpenMode } from "@itwin/core-bentley";
import { FilePropertyProps } from "@itwin/core-common";
import { CloudSqlite } from "../../CloudSqlite";
import { Setting, SettingName, SettingsContainer, SettingsPriority } from "../../workspace/Settings";
import { CloudSqliteContainer, WorkspaceDbName } from "../../workspace/Workspace";
import { SettingsDb, SettingsDbManifest, SettingsDbProps, settingsResourceName } from "../../workspace/SettingsDb";
import { WorkspaceSqliteDb } from "./WorkspaceSqliteDb";
import { _implementationProhibited, _nativeDb } from "../Symbols";

export const settingsDbDefaultName: WorkspaceDbName = "settings-db";

export const settingsManifestProperty: FilePropertyProps = { namespace: "settings", name: "manifest" };

/** Internal implementation of [[SettingsDb]]. Wraps a [[WorkspaceSqliteDb]] to provide a
 * settings-only read interface over the `strings` table.
 */
export class SettingsDbImpl implements SettingsDb {
  public readonly [_implementationProhibited] = undefined;
  public readonly sqliteDb = new WorkspaceSqliteDb();
  public readonly dbName: string;
  public readonly dbFileName: string;
  protected readonly _container: CloudSqliteContainer;
  public readonly priority: SettingsPriority;
  protected _manifest?: SettingsDbManifest;

  public constructor(props: SettingsDbProps, container: CloudSqliteContainer, priority: SettingsPriority) {
    this.dbName = props.dbName ?? settingsDbDefaultName;
    CloudSqlite.validateDbName(this.dbName);
    this._container = container;
    this.dbFileName = container.resolveDbFileName(props);
    this.priority = priority;
  }

  public get container(): CloudSqliteContainer { return this._container; }
  public get isOpen() { return this.sqliteDb.isOpen; }

  public get version(): string {
    const cloudContainer = this.container.cloudContainer;
    if (undefined === cloudContainer)
      return "0.0.0";
    return CloudSqlite.parseDbFileName(this.dbFileName).version;
  }

  public get manifest(): SettingsDbManifest {
    return this._manifest ??= this.withOpenDb((db) => {
      const manifestJson = db[_nativeDb].queryFileProperty(settingsManifestProperty, true) as string | undefined;
      if (!manifestJson)
        return { settingsName: this.dbName };
      try {
        return JSON.parse(manifestJson);
      } catch (e) {
        throw new Error(`Failed to parse manifest in SettingsDb "${this.dbName}": ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  /** Check whether the underlying database has a settings manifest property.
   * Used to validate that a container actually holds a SettingsDb rather than a WorkspaceDb.
   */
  public get hasSettingsManifestProperty(): boolean {
    return this.withOpenDb((db) => {
      const manifestJson = db[_nativeDb].queryFileProperty(settingsManifestProperty, true) as string | undefined;
      return manifestJson !== undefined;
    });
  }

  protected withOpenDb<T>(operation: (db: WorkspaceSqliteDb) => T): T {
    const done = this.isOpen ? () => { } : (this.open(), () => this.close());
    try {
      return operation(this.sqliteDb);
    } finally {
      done();
    }
  }

  public open(): void {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.Readonly, this._container.cloudContainer);
  }

  public close(): void {
    if (this.isOpen)
      this.sqliteDb.closeDb();
  }

  public getSettings(): SettingsContainer {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT value FROM strings WHERE id=?", (stmt) => {
        stmt.bindString(1, settingsResourceName);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          return {};
        try {
          // JSON.parse already returns a fresh object tree — no explicit clone needed.
          return JSON.parse(stmt.getValueString(0));
        } catch (e) {
          throw new Error(`Failed to parse settings in SettingsDb "${this.dbName}": ${e instanceof Error ? e.message : String(e)}`);
        }
      });
    });
  }

  public getSetting<T extends Setting>(settingName: SettingName): T | undefined {
    const settings = this.getSettings();
    if (!Object.hasOwn(settings, settingName))
      return undefined;
    const value = settings[settingName] as T | undefined;
    return value !== undefined ? Setting.clone(value) : undefined;
  }
}
