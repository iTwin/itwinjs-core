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
import { Setting, SettingsContainer, SettingsDictionary, SettingsDictionaryProps, SettingsPriority } from "../../workspace/Settings";
import { WorkspaceContainer } from "../../workspace/Workspace";
import { SettingsDb, SettingsDbManifest, SettingsDbProps } from "../../workspace/SettingsDb";
import { WorkspaceSqliteDb } from "./WorkspaceSqliteDb";
import { _implementationProhibited, _nativeDb } from "../Symbols";

/** FileProperty key used to store the [[SettingsDbManifest]] inside the SQLite database. */
export const settingsManifestProperty: FilePropertyProps = { namespace: "settings", name: "manifest" };

/** A lightweight SettingsDictionary backed by a parsed JSON settings container. */
class SettingsDbDictionary implements SettingsDictionary {
  public readonly [_implementationProhibited] = undefined;
  public readonly props: SettingsDictionaryProps;
  private readonly _settings: SettingsContainer;

  public constructor(props: SettingsDictionaryProps, settings: SettingsContainer) {
    this.props = { ...props };
    this._settings = settings;
  }

  public getSetting<T extends Setting>(settingName: string): T | undefined {
    const value = this._settings[settingName] as T | undefined;
    return undefined !== value ? Setting.clone(value) : undefined;
  }
}

/** Internal implementation of [[SettingsDb]]. Wraps a [[WorkspaceSqliteDb]] to provide a
 * settings-only read interface over the `strings` table.
 */
export class SettingsDbImpl implements SettingsDb {
  public readonly [_implementationProhibited] = undefined;
  public readonly sqliteDb = new WorkspaceSqliteDb();
  public readonly dbName: string;
  public readonly dbFileName: string;
  protected readonly _container: WorkspaceContainer;
  public readonly priority: SettingsPriority;
  protected _manifest?: SettingsDbManifest;

  public constructor(props: SettingsDbProps, container: WorkspaceContainer, priority: SettingsPriority) {
    this.dbName = props.dbName;
    CloudSqlite.validateDbName(this.dbName);
    this._container = container;
    this.dbFileName = container.resolveDbFileName(props);
    this.priority = priority;
  }

  public get container(): WorkspaceContainer { return this._container; }
  public get isOpen() { return this.sqliteDb.isOpen; }

  public get version(): string {
    const cloudContainer = this.container.cloudContainer;
    if (undefined === cloudContainer)
      return "1.0.0";
    return CloudSqlite.parseDbFileName(this.dbFileName).version;
  }

  public get manifest(): SettingsDbManifest {
    return this._manifest ??= this.withOpenDb((db) => {
      const manifestJson = db[_nativeDb].queryFileProperty(settingsManifestProperty, true) as string | undefined;
      return manifestJson ? JSON.parse(manifestJson) : { settingsName: this.dbName };
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

  public open(): void {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.Readonly, this._container.cloudContainer);
  }

  public close(): void {
    if (this.isOpen)
      this.sqliteDb.closeDb();
  }

  private makeDictionary(name: string, settingsJson: string): SettingsDictionary {
    const settings: SettingsContainer = JSON.parse(settingsJson);
    return new SettingsDbDictionary({ name, priority: this.priority }, settings);
  }

  public getDictionaries(): SettingsDictionary[] {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT id, value FROM strings", (stmt) => {
        const result: SettingsDictionary[] = [];
        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
          const name = stmt.getValueString(0);
          const value = stmt.getValueString(1);
          result.push(this.makeDictionary(name, value));
        }
        return result;
      });
    });
  }

  public getDictionary(name: string): SettingsDictionary | undefined {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT value FROM strings WHERE id=?", (stmt) => {
        stmt.bindString(1, name);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          return undefined;
        return this.makeDictionary(name, stmt.getValueString(0));
      });
    });
  }
}
