/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, BentleyError, DbResult } from "@itwin/core-bentley";
import { CloudSqlite } from "./CloudSqlite";
import { SettingObject } from "./workspace/Settings";
import { VersionedSqliteDb } from "./SQLiteDb";

/**
 * A cloud-based storage for a set of values of type `PropertyType`, each with a unique `PropertyName`.
 * `CloudPropertyStore`s are stored in cloud containers, and require an access token that grants permission to read and/or write them.
 * All write operations will fail without an access token that grants write permission.
 * A `CloudPropertyStore` is cached on a local drive so reads are fast and inexpensive, and may even be done offline after a prefetch.
 * However, that means that callers are responsible for synchronizing the local cache to ensure it includes changes
 * made by others, as appropriate (see [[synchronizeWithCloud]]).
 * @beta
 */
export interface CloudPropertyStore {

  /** The collection of property values in the PropertyStore as of the last time it was synchronized. */
  readonly values: PropertyStore.ReadValues;

  /** Parameters for obtaining the write lock on the container for a PropertyStore.*/
  readonly lockParams: CloudSqlite.ObtainLockParams;

  /**
   * The token that grants access to the cloud container for this PropertyStore. If it does not grant write permissions, all
   * write operations will fail. It should be refreshed (via a timer) before it expires.
   */
  sasToken: AccessToken;

  /**
   * Synchronize the local values in this PropertyStore with any changes by made by others.
   * @note This is called automatically whenever any write operation is performed on the PropertyStore. It is only necessary to
   * call this directly if you have not changed the PropertyStore recently, but wish to perform a readonly operation and want to
   * ensure it is up-to-date as of now.
   * @note There is no guarantee that the Values are up-to-date even immediately after calling this method, since others
   * may be modifying them at any time.
   */
  synchronizeWithCloud(): void;

  /** initiate a prefetch operation on this PropertyStore
   * @internal
   */
  startPrefetch(): CloudSqlite.CloudPrefetch;

  /** Save a single property in this PropertyStore. If the property already exists, its value is overwritten.
   * @note This will obtain the write lock, save the value, and then release the write lock.
   */
  saveProperty(name: PropertyStore.PropertyName, value: PropertyStore.PropertyType): Promise<void>;
  /** Save an array of properties in this PropertyStore. If a property already exists, its value is overwritten.
   * @note This will obtain the write lock, save the values, and then release the write lock.
   */
  saveProperties(props: PropertyStore.PropertyArray): Promise<void>;
  /** Delete a single property from this PropertyStore. If the value does not exist, this method does nothing.
   * @note This will obtain the write lock, delete the value, and then release the write lock.
   */
  deleteProperty(propName: PropertyStore.PropertyName): Promise<void>;
  /** Delete an array of properties from this PropertyStore. Any value that does not exist is ignored.
   * @note This will obtain the write lock, delete the values, and then release the write lock.
   */
  deleteProperties(propNames: PropertyStore.PropertyName[]): Promise<void>;
}

/** @beta */
export namespace PropertyStore {
  /** @internal */
  export let openCloudPropertyStore: ((props: CloudSqlite.ContainerAccessProps) => CloudPropertyStore) | undefined;

  /** The set of valid types for properties in a PropertyStore. */
  export type PropertyType = string | number | boolean | Uint8Array | SettingObject;
  /** The name of a Property. May not have leading or trailing spaces, and must be between 3 and 2048 characters long. */
  export type PropertyName = string;
  /** An array of PropertyName/PropertyType pairs to be stored in a PropertyStore. */
  export type PropertyArray = { name: PropertyName, value: PropertyType }[];
  /** The return status of an iteration function. The value "stop" causes the iteration to terminate. */
  export type IterationReturn = void | "stop";
  /** An iteration function over Properties in a PropertyStore. It is called with the name of a each Property. */
  export type PropertyIteration = (name: string) => IterationReturn;

  /** A filter used to limit and/or sort the values returned by an iteration. */
  export interface PropertyFilter {
    /** A value filter. May include wild cards when used with `GLOB` or `LIKE` */
    readonly value?: string;
    /** The comparison operator for `value`. Default is `=` */
    readonly valueCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "!=" | "<" | ">";
    /** Order results ascending or descending. If not supplied, the results are unordered (random). */
    readonly orderBy?: "ASC" | "DESC";
    /** An SQL expression to further filter results. This string is appended to the `WHERE` clause with an `AND` (that should not be part of the sqlExpression) */
    readonly sqlExpression?: string;
  }

  /**
   * Read the values of Properties in a PropertyStore.
   * @beta
   */
  export interface ReadValues {
    /** get the value of a Property by name.
     * @returns the property's value if it exists, `undefined` otherwise.
     */
    getProperty(name: PropertyName): PropertyType | undefined;
    /** Get the value of a string property by name.
    * @returns the property's value if it exists and is a string, `undefined` otherwise.
    */
    getString(name: PropertyName): string | undefined;
    /** Get the value of a string property by name.
    * @returns the property's value if it exists and is a string, otherwise the supplied default value.
    */
    getString(name: PropertyName, defaultValue: string): string;
    /** Get the value of a boolean property by name.
    * @returns the property's value if it exists and is a boolean, `undefined` otherwise.
    */
    getBoolean(name: PropertyName): boolean | undefined;
    /** Get the value of a boolean property by name.
    * @returns the property's value if it exists and is a boolean, otherwise the supplied default value.
    */
    getBoolean(name: PropertyName, defaultValue: boolean): boolean;
    /** Get the value of a number property by name.
    * @returns the property's value if it exists and is a number, `undefined` otherwise.
    */
    getNumber(name: PropertyName): number | undefined;
    /** Get the value of a number property by name.
    * @returns the property's value if it exists and is a number, otherwise the supplied default value.
    */
    getNumber(name: PropertyName, defaultValue: number): number;
    /** Get the value of a blob property by name.
    * @returns the property's value if it exists and is a blob, `undefined` otherwise.
    */
    getBlob(name: PropertyName): Uint8Array | undefined;
    /** Get the value of a blob property by name.
    * @returns the property's value if it exists and is a blob, otherwise the supplied default value.
    */
    getBlob(name: PropertyName, defaultValue: Uint8Array): Uint8Array;
    /** Get the value of an object property by name.
    * @returns the property's value if it exists and is an object, `undefined` otherwise.
    */
    getObject<T extends SettingObject>(name: PropertyName): T | undefined;
    /** Get the value of an object property by name.
    * @returns the property's value if it exists and is an object, otherwise the supplied default value.
    */
    getObject<T extends SettingObject>(name: PropertyName, defaultValue: T): T;

    /** call an iteration function for each property, optionally applying a filter */
    forAllProperties(iter: PropertyIteration, filter?: PropertyFilter): void;
  }

  /**
   * A `VersionedSqliteDb` database for storing name/value pairs. The names are case-sensitive strings, and the values can be of type
   * string, boolean, number, blob (Uint8Array), or Object.
   * @beta
   */
  export class PropertyDb extends VersionedSqliteDb implements PropertyStore.ReadValues {
    public readonly myVersion = "3.0.0";

    protected createDDL() {
      this.createTable({ tableName: "properties", columns: "name TEXT NOT NULL PRIMARY KEY,type,value", addTimestamp: true });
    }

    public getProperty(name: PropertyStore.PropertyName): PropertyStore.PropertyType | undefined {
      return this.withPreparedSqliteStatement("SELECT type,value from properties WHERE name=?", (stmt) => {
        stmt.bindString(1, name);
        if (!stmt.nextRow())
          return undefined;
        switch (stmt.getValueString(0)) {
          case "string":
            return stmt.getValueString(1);
          case "boolean":
            return stmt.getValueInteger(1) !== 0;
          case "blob":
            return stmt.getValueBlob(1);
          case "number":
            return stmt.getValueDouble(1);
          case "object":
            return JSON.parse(stmt.getValueString(1)) as SettingObject;
        }
        return undefined;
      });
    }

    public getString(name: PropertyStore.PropertyName, defaultValue: string): string;
    public getString(name: PropertyStore.PropertyName): string | undefined;
    public getString(name: PropertyStore.PropertyName, defaultValue?: string): string | undefined {
      const out = this.getProperty(name);
      return typeof out === "string" ? out : defaultValue;
    }
    public getBoolean(name: PropertyStore.PropertyName, defaultValue: boolean): boolean;
    public getBoolean(name: PropertyStore.PropertyName): boolean | undefined;
    public getBoolean(name: PropertyStore.PropertyName, defaultValue?: boolean): boolean | undefined {
      const out = this.getProperty(name);
      return typeof out === "boolean" ? out : defaultValue;
    }
    public getNumber(name: PropertyStore.PropertyName, defaultValue: number): number;
    public getNumber(name: PropertyStore.PropertyName): number | undefined;
    public getNumber(name: PropertyStore.PropertyName, defaultValue?: number): number | undefined {
      const out = this.getProperty(name);
      return typeof out === "number" ? out : defaultValue;
    }
    public getBlob(name: PropertyStore.PropertyName, defaultValue: Uint8Array): Uint8Array;
    public getBlob(name: PropertyStore.PropertyName): Uint8Array | undefined;
    public getBlob(name: PropertyStore.PropertyName, defaultValue?: Uint8Array): Uint8Array | undefined {
      const out = this.getProperty(name);
      return out instanceof Uint8Array ? out : defaultValue;
    }
    public getObject<T extends SettingObject>(name: PropertyStore.PropertyName, defaultValue: T): T;
    public getObject<T extends SettingObject>(name: PropertyStore.PropertyName): T | undefined;
    public getObject<T extends SettingObject>(name: PropertyStore.PropertyName, defaultValue?: T): T | undefined {
      const out = this.getProperty(name);
      return typeof out === "object" ? out as T : defaultValue;
    }
    public forAllProperties(iter: PropertyStore.PropertyIteration, filter?: PropertyStore.PropertyFilter) {
      let sql = "SELECT name FROM properties WHERE name IS NOT NULL";
      if (filter?.sqlExpression)
        sql += ` AND ${filter.sqlExpression} `;
      if (filter?.value)
        sql += ` AND name ${filter.valueCompare ?? "="} @val`;
      if (filter?.orderBy)
        sql += ` ORDER BY name ${filter.orderBy} `;

      this.withSqliteStatement(sql, (stmt) => {
        if (filter?.value)
          stmt.bindString("@val", filter.value);

        while (stmt.nextRow()) {
          if (iter(stmt.getValueString(0)) === "stop")
            return;
        }
      });
    }

    /** Delete a single property from this PropertyDb. If the value does not exist, this method does nothing. */
    public deleteProperty(propName: PropertyStore.PropertyName) {
      this.withSqliteStatement("DELETE from properties WHERE name=?", (stmt) => {
        stmt.bindString(1, propName);
        stmt.step();
      });
    }
    /** Delete an array of properties from this PropertyDb. Any value that does not exist is ignored. */
    public deleteProperties(propNames: PropertyStore.PropertyName[]) {
      propNames.forEach((name) => this.deleteProperty(name));
    }

    private validateName(name: PropertyStore.PropertyName) {
      if (typeof name !== "string" || name.trim() !== name || name.length > 2 * 1024 || name.length < 2)
        throw new Error(`illegal property name[${name}]`);
    }

    /** Save a single property in this PropertyDb. If the property already exists, its value is overwritten. */
    public saveProperty(name: PropertyStore.PropertyName, value: PropertyStore.PropertyType) {
      this.validateName(name);
      this.withSqliteStatement("INSERT OR REPLACE INTO properties(name,type,value) VALUES (?,?,?)", (stmt) => {
        stmt.bindString(1, name);
        switch (typeof value) {
          case "string":
            stmt.bindString(2, "string");
            stmt.bindString(3, value);
            break;
          case "boolean":
            stmt.bindString(2, "boolean");
            stmt.bindInteger(3, value ? 1 : 0);
            break;
          case "number":
            stmt.bindString(2, "number");
            stmt.bindDouble(3, value);
            break;
          case "object":
            if (value instanceof Uint8Array) {
              stmt.bindString(2, "blob");
              stmt.bindBlob(3, value);
            } else {
              stmt.bindString(2, "object");
              stmt.bindString(3, JSON.stringify(value));
            }
            break;
          default:
            throw new Error("illegal property value type");
        }

        const rc = stmt.step();
        if (rc !== DbResult.BE_SQLITE_DONE)
          throw new BentleyError(rc, "error saving property");
      });
    }

    /** Save an array of properties in this PropertyDb. If a property already exists, its value is overwritten. */
    public saveProperties(props: PropertyStore.PropertyArray) {
      props.forEach((prop) => this.saveProperty(prop.name, prop.value));
    }
  }
}
