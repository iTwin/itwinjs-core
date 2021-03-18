/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { join } from "path";
import { DbResult, IModelStatus } from "@bentley/bentleyjs-core";
import { IModelError, StorageValue } from "@bentley/imodeljs-common";
import { ECDb, ECDbOpenMode } from "./ECDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { NativeHost } from "./NativeHost";

/**
 * An ECDb in the app cache for storing key/value pairs.
 * @internal
 */
export class NativeAppStorage {
  private static readonly _ext = ".v1.ecdb";
  private static _storages = new Map<string, NativeAppStorage>();
  private static _init: boolean = false;
  private constructor(private _ecdb: ECDb, public readonly id: string) { }
  public setData(key: string, value: StorageValue): void {
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
    const keys = new Array<string>();
    this._ecdb.withPreparedSqliteStatement("SELECT [key] FROM [app_cache]", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        keys.push(stmt.getValue(0).getString());
      }
    });
    return keys;
  }
  public removeData(key: string) {
    const rc = this._ecdb.withPreparedSqliteStatement("DELETE FROM [app_cache] WHERE [key] = ?", (stmt) => {
      stmt.bindValue(1, key);
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    }
  }
  public removeAll() {
    const rc = this._ecdb.withPreparedSqliteStatement("DELETE FROM [app_cache]", (stmt) => {
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    }
  }
  public close(deleteFile: boolean = false) {
    const storageFile = join(NativeHost.appSettingsCacheDir, this.id);
    this._ecdb.saveChanges();
    this._ecdb.closeDb();
    if (deleteFile) {
      IModelJsFs.removeSync(storageFile);
    }
    NativeAppStorage._storages.delete(this.id);
  }
  private static init(ecdb: ECDb): DbResult {
    return ecdb.withPreparedSqliteStatement("CREATE TABLE [app_cache]([key] PRIMARY KEY, [type], [val]);", (stmt) => {
      return stmt.step();
    });
  }
  public static find(name: string): NativeAppStorage {
    const storage = this._storages.get(name);
    if (undefined === storage)
      throw new IModelError(IModelStatus.FileNotFound, `Storage ${name} not open`);
    return storage;
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
    const storageFile = join(NativeHost.appSettingsCacheDir, fileName);
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
