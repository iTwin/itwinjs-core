/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { DbResult } from "@bentley/bentleyjs-core";
import { IModelError, StorageValue } from "@bentley/imodeljs-common";
import { ECDb, ECDbOpenMode } from "./ECDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { NativeHost } from "./NativeHost";

/**
 * Native app storage allow key value pair to be persisted in a sqlite db in app cache.
 * This is exposed to frontend through [[NativeApp]]
 * @internal
 */
export class NativeAppStorage {
  private static readonly _version = 1;
  private static readonly _ext = `.v${NativeAppStorage._version}.ecdb`;
  private static _storages = new Map<string, NativeAppStorage>();
  private static _init: boolean = false;
  private constructor(private _ecdb: ECDb, public readonly id: string) { }
  public setData(key: string, value: StorageValue): void {
    if (!this._ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    const rc = this._ecdb.withPreparedSqliteStatement("INSERT INTO [app_cache]([key],[type],[val])VALUES(?,?,?) ON CONFLICT([key]) DO UPDATE SET [type]=excluded.[type], [val]=excluded.[val]", (stmt) => {
      let type: string | undefined = value === null ? "null" : typeof value;
      if (type === "object") {
        if (value instanceof Uint8Array) {
          type = "Uint8Array";
        } else {
          type = undefined;
        }
      }
      if (!type) {
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unsupported type for value for key='${key}'`);
      }
      stmt.bindValue(1, key);
      stmt.bindValue(2, type);
      stmt.bindValue(3, value);
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    } else {
      this._ecdb.saveChanges();
    }
  }

  public getData(key: string): StorageValue | undefined {
    if (!this._ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    return this._ecdb.withPreparedSqliteStatement("SELECT [type],[val] FROM [app_cache] WHERE [key] = ?", (stmt) => {
      stmt.bindValue(1, key);
      const rc = stmt.step();
      if (rc === DbResult.BE_SQLITE_ROW) {
        const type = stmt.getValue(0).getString();
        if (type === "number") {
          return stmt.getValue(1).getDouble();
        } else if (type === "string") {
          return stmt.getValue(1).getString();
        } else if (type === "boolean") {
          return Boolean(stmt.getValue(1).getInteger());
        } else if (type === "Uint8Array") {
          return stmt.getValue(1).getBlob();
        } else if (type === "null") {
          return null;
        } else {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, "Unsupported value type in cache");
        }
      }
      return undefined;
    });
  }
  public getKeys(): string[] {
    if (!this._ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    const keys = new Array<string>();
    this._ecdb.withPreparedSqliteStatement("SELECT [key] FROM [app_cache]", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        keys.push(stmt.getValue(0).getString());
      }
    });
    return keys;
  }
  public removeData(key: string) {
    if (!this._ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    const rc = this._ecdb.withPreparedSqliteStatement("DELETE FROM [app_cache] WHERE [key] = ?", (stmt) => {
      stmt.bindValue(1, key);
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    }
  }
  public removeAll() {
    if (!this._ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    const rc = this._ecdb.withPreparedSqliteStatement("DELETE FROM [app_cache]", (stmt) => {
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    }
  }
  public close(deleteFile: boolean = false) {
    if (!this._ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    const storageFile = path.join(NativeHost.appSettingsCacheDir, this.id);
    this._ecdb.saveChanges();
    this._ecdb.closeDb();
    if (deleteFile) {
      IModelJsFs.removeSync(storageFile);
    }
    NativeAppStorage._storages.delete(this.id);
  }
  private static init(ecdb: ECDb): DbResult {
    if (!ecdb.isOpen) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cache is not open or disposed");
    }
    return ecdb.withPreparedSqliteStatement("CREATE TABLE [app_cache]([key] PRIMARY KEY, [type], [val]);", (stmt) => {
      return stmt.step();
    });
  }
  public static find(name: string): NativeAppStorage | undefined {
    return this._storages.get(name);
  }
  public static closeAll() {
    this._storages.forEach((value) => {
      value.close();
    });
    this._storages.clear();
  }
  public static getStorageNames(): string[] {
    return IModelJsFs.readdirSync(NativeHost.appSettingsCacheDir).filter((_) => _.endsWith(this._ext));
  }
  public static open(name: string): NativeAppStorage {
    if (!this._init) {
      IModelHost.onBeforeShutdown.addOnce(() => {
        this.closeAll();
      });
      this._init = true;
    }
    const fileName = name + this._ext;
    if (!IModelJsFs.existsSync(NativeHost.appSettingsCacheDir)) {
      IModelJsFs.recursiveMkDirSync(NativeHost.appSettingsCacheDir);
    }
    const storageFile = path.join(NativeHost.appSettingsCacheDir, fileName);
    let storage = this.find(fileName);
    if (!storage) {
      const ecdb: ECDb = new ECDb();
      if (IModelJsFs.existsSync(storageFile)) {
        ecdb.openDb(storageFile, ECDbOpenMode.ReadWrite);
      } else {
        ecdb.createDb(storageFile);
        const rc = this.init(ecdb);
        if (rc !== DbResult.BE_SQLITE_DONE) {
          throw new IModelError(rc, "SQLite error");
        } else {
          ecdb.saveChanges();
        }
      }
      storage = new NativeAppStorage(ecdb, fileName);
      this._storages.set(fileName, storage);
    }
    return storage;
  }
}
