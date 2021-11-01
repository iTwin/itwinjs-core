/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { join } from "path";
import { DbResult, IModelStatus } from "@itwin/core-bentley";
import { IModelError, StorageValue } from "@itwin/core-common";
import { ECDb, ECDbOpenMode } from "./ECDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { NativeHost } from "./NativeHost";

// cspell:ignore ecdb

/**
 * A local file stored in the [[NativeHost.appSettingsCacheDir]] for storing key/value pairs.
 * @public
 */
export class NativeAppStorage {
  private static readonly _ext = ".settings-db";
  private static _storages = new Map<string, NativeAppStorage>();
  private static _init: boolean = false;
  private constructor(private _ecdb: ECDb, public readonly id: string) { }

  /** Set the value for a key */
  public setData(key: string, value: StorageValue): void {
    const rc = this._ecdb.withPreparedSqliteStatement("INSERT INTO app_setting(key,type,val)VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET type=excluded.type,val=excluded.val", (stmt) => {
      let valType = (value === undefined || value === null) ? "null" : typeof value;
      if (valType === "object" && (value instanceof Uint8Array))
        valType = "Uint8Array";

      switch (valType) {
        case "null":
        case "number":
        case "string":
        case "boolean":
        case "Uint8Array":
          break;
        default:
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unsupported type ${valType} for value for key='${key}`);
      }

      stmt.bindValue(1, key);
      stmt.bindValue(2, valType);
      stmt.bindValue(3, value);
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE)
      throw new IModelError(rc, "SQLite error");

    this._ecdb.saveChanges();
  }

  /** Get the value for a key from this Storage. If key is not present or is null, return undefined. */
  public getData(key: string): StorageValue {
    return this._ecdb.withPreparedSqliteStatement("SELECT type,val FROM app_setting WHERE key=?", (stmt) => {
      stmt.bindValue(1, key);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        return undefined;
      const valType = stmt.getValueString(0);
      switch (valType) {
        case "number":
          return stmt.getValueDouble(1);
        case "string":
          return stmt.getValueString(1);
        case "boolean":
          return Boolean(stmt.getValueInteger(1));
        case "Uint8Array":
          return stmt.getValueBlob(1);
        case "null":
          return undefined;
      }
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unsupported type in cache ${valType}`);
    });
  }

  /** return the type of the value for a key, or undefined if not present. */
  public getValueType(key: string): "number" | "string" | "boolean" | "Uint8Array" | "null" | undefined {
    return this._ecdb.withSqliteStatement("SELECT type FROM app_setting WHERE key=?", (stmt) => {
      stmt.bindValue(1, key);
      return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValueString(0) as any : undefined;
    });
  }

  /** return `true` if the key is present, but has a null value. */
  public hasNullValue(key: string): boolean {
    return this.getValueType(key) === "null";
  }

  /** Get the value for a key as a string. If it is not present, or not of type string, return undefined */
  public getString(key: string): string | undefined {
    const val = this.getData(key);
    return typeof val === "string" ? val : undefined;
  }

  /** Get the value for a key as a number. If it is not present, or not of type number, return undefined */
  public getNumber(key: string): number | undefined {
    const val = this.getData(key);
    return typeof val === "number" ? val : undefined;
  }

  /** Get the value for a key as a boolean. If it is not present, or not of type boolean, return undefined */
  public getBoolean(key: string): boolean | undefined {
    const val = this.getData(key);
    return typeof val === "boolean" ? val : undefined;
  }

  /** Get the value for a key as a Uint8Array. If it is not present, or not of type Uint8Array, return undefined */
  public getUint8Array(key: string): Uint8Array | undefined {
    const val = this.getData(key);
    return val instanceof Uint8Array ? val : undefined;
  }

  /** Get all key names in this Storage */
  public getKeys(): string[] {
    const keys = new Array<string>();
    this._ecdb.withPreparedSqliteStatement("SELECT key FROM app_setting", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        keys.push(stmt.getValueString(0));
      }
    });
    return keys;
  }

  /** Remove a key/value pair from this Storage */
  public removeData(key: string) {
    const rc = this._ecdb.withPreparedSqliteStatement("DELETE FROM app_setting WHERE key=?", (stmt) => {
      stmt.bindValue(1, key);
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    }
  }

  /** Remove all key/value pairs */
  public removeAll() {
    const rc = this._ecdb.withPreparedSqliteStatement("DELETE FROM app_setting", (stmt) => {
      return stmt.step();
    });
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new IModelError(rc, "SQLite error");
    }
  }

  /** Close this Storage. */
  public close(deleteFile: boolean = false) {
    const storageFile = join(NativeHost.appSettingsCacheDir, this.id);
    this._ecdb.saveChanges();
    this._ecdb.closeDb();
    (this._ecdb as any) = undefined;
    if (deleteFile)
      IModelJsFs.removeSync(storageFile);
    NativeAppStorage._storages.delete(this.id);
  }

  private static init(ecdb: ECDb): DbResult {
    return ecdb.withPreparedSqliteStatement("CREATE TABLE app_setting(key PRIMARY KEY,type,val);", (stmt) => {
      return stmt.step();
    });
  }

  /** find and open storage by its name. */
  public static find(name: string): NativeAppStorage {
    const storage = this._storages.get(name);
    if (undefined === storage)
      throw new IModelError(IModelStatus.FileNotFound, `Storage ${name} not open`);
    return storage;
  }

  /** Close all opened Storages.
   * @internal
   */
  public static closeAll() {
    this._storages.forEach((value) => value.close());
    this._storages.clear();
  }

  /** @internal */
  public static getStorageNames(): string[] {
    return IModelJsFs.readdirSync(NativeHost.appSettingsCacheDir).filter((name) => name.endsWith(this._ext));
  }

  /** Open or find a Storage by name. */
  public static open(name: string): NativeAppStorage {
    if (!this._init) {
      IModelHost.onBeforeShutdown.addOnce(() => this.closeAll());
      this._init = true;
    }
    const fileName = name + this._ext;
    if (!IModelJsFs.existsSync(NativeHost.appSettingsCacheDir))
      IModelJsFs.recursiveMkDirSync(NativeHost.appSettingsCacheDir);

    const storageFile = join(NativeHost.appSettingsCacheDir, fileName);
    try {
      return this.find(fileName); // see if it's already open
    } catch (err) {
      const ecdb = new ECDb();
      if (IModelJsFs.existsSync(storageFile)) {
        ecdb.openDb(storageFile, ECDbOpenMode.ReadWrite);
      } else {
        ecdb.createDb(storageFile);
        const rc = this.init(ecdb);
        if (rc !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(rc, "SQLite error");
        ecdb.saveChanges();
      }
      const storage = new NativeAppStorage(ecdb, fileName);
      this._storages.set(fileName, storage);
      return storage;
    }
  }
}
