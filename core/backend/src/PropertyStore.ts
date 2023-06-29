/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module SQLiteDb
 */

import { CloudSqlite } from "./CloudSqlite";
import { VersionedSqliteDb } from "./SQLiteDb";
import { SettingObject } from "./workspace/Settings";

/** @beta */
export namespace PropertyStore {

  /** The set of valid types for properties in a PropertyStore. */
  export type PropertyType = string | number | boolean | Uint8Array | SettingObject;
  /** The case-sensitive name of a Property. May not have leading or trailing spaces, and must be between 3 and 2048 characters long. */
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
   * A SQLite database for storing PropertyName/PropertyValue pairs.
   */
  export class PropertyDb extends VersionedSqliteDb {
    public override readonly myVersion = "3.0.0";

    protected override createDDL() {
      this.createTable({ tableName: "properties", columns: "name TEXT NOT NULL PRIMARY KEY,type,value", addTimestamp: true });
    }

    /** get the value of a Property by name.
     * @returns the property's value if it exists, `undefined` otherwise.
     */
    public getProperty(name: PropertyName): PropertyType | undefined {
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
    /** Get the value of a string property by name.
    * @returns the property's value if it exists and is a string, `undefined` otherwise.
    */
    public getString(name: PropertyName, defaultValue: string): string;
    /** Get the value of a string property by name.
    * @returns the property's value if it exists and is a string, otherwise the supplied default value.
    */
    public getString(name: PropertyName): string | undefined;
    public getString(name: PropertyName, defaultValue?: string): string | undefined {
      const out = this.getProperty(name);
      return typeof out === "string" ? out : defaultValue;
    }
    /** Get the value of a boolean property by name.
    * @returns the property's value if it exists and is a boolean, `undefined` otherwise.
    */
    public getBoolean(name: PropertyName): boolean | undefined;
    /** Get the value of a boolean property by name.
    * @returns the property's value if it exists and is a boolean, otherwise the supplied default value.
    */
    public getBoolean(name: PropertyName, defaultValue: boolean): boolean;
    public getBoolean(name: PropertyName, defaultValue?: boolean): boolean | undefined {
      const out = this.getProperty(name);
      return typeof out === "boolean" ? out : defaultValue;
    }
    /** Get the value of a number property by name.
    * @returns the property's value if it exists and is a number, `undefined` otherwise.
    */
    public getNumber(name: PropertyName): number | undefined;
    /** Get the value of a number property by name.
    * @returns the property's value if it exists and is a number, otherwise the supplied default value.
    */
    public getNumber(name: PropertyName, defaultValue: number): number;
    public getNumber(name: PropertyName, defaultValue?: number): number | undefined {
      const out = this.getProperty(name);
      return typeof out === "number" ? out : defaultValue;
    }
    /** Get the value of a blob property by name.
    * @returns the property's value if it exists and is a blob, `undefined` otherwise.
    */
    public getBlob(name: PropertyName): Uint8Array | undefined;
    /** Get the value of a blob property by name.
    * @returns the property's value if it exists and is a blob, otherwise the supplied default value.
    */
    public getBlob(name: PropertyName, defaultValue: Uint8Array): Uint8Array;
    public getBlob(name: PropertyName, defaultValue?: Uint8Array): Uint8Array | undefined {
      const out = this.getProperty(name);
      return out instanceof Uint8Array ? out : defaultValue;
    }
    /** Get the value of an object property by name.
    * @returns the property's value if it exists and is an object, `undefined` otherwise.
    */
    public getObject(name: PropertyName): SettingObject | undefined;
    /** Get the value of an object property by name.
    * @returns the property's value if it exists and is an object, otherwise the supplied default value.
    */
    public getObject(name: PropertyName, defaultValue: SettingObject): SettingObject;
    public getObject(name: PropertyName, defaultValue?: SettingObject): SettingObject | undefined {
      const out = this.getProperty(name);
      return typeof out === "object" ? out as SettingObject : defaultValue;
    }

    /** call an iteration function for each property, optionally applying a filter */
    public forAllProperties(iter: PropertyIteration, filter?: PropertyFilter) {
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

    /** Delete a single property from this PropertyDb. If the value does not exist, this method does nothing.
     * @note the database must be opened for write
     */
    public async deleteProperty(propName: PropertyName) {
      this.withSqliteStatement("DELETE from properties WHERE name=?", (stmt) => {
        stmt.bindString(1, propName);
        stmt.stepForWrite();
      });
    }
    /** Delete an array of properties from this PropertyDb. Any value that does not exist is ignored.
     * @note the database must be opened for write
     */
    public async deleteProperties(propNames: PropertyName[]) {
      propNames.forEach(async (name) => this.deleteProperty(name));
    }

    private validateName(name: PropertyName) {
      if (typeof name !== "string" || name.trim() !== name || name.length > 2 * 1024 || name.length < 2)
        throw new Error(`illegal property name[${name}]`);
    }

    /** Save a single property in this PropertyDb. If the property already exists, its value is overwritten.
     * @note the database must be opened for write
     */
    public async saveProperty(name: PropertyName, value: PropertyType) {
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

        stmt.stepForWrite();
      });
    }

    /** Save an array of properties in this PropertyDb. If a property already exists, its value is overwritten.
     * @note the database must be opened for write
     */
    public async saveProperties(props: PropertyArray) {
      for (const prop of props)
        await this.saveProperty(prop.name, prop.value);
    }
  }

  const defaultDbName = "PropertyDb" as const;

  /**
   * Provides access to a cloud-based `PropertyDb` to hold a set of values of type `PropertyType`, each with a unique `PropertyName`.
   * `PropertyStore.PropertyDb`s that are stored in cloud containers require an access token that grants permission to read and/or write them.
   * All write operations will fail without an access token that grants write permission.
   *
   * The database is cached on a local drive so reads are fast and inexpensive, and may even be done offline after a prefetch.
   * However, that means that callers are responsible for synchronizing the local cache to ensure it includes changes
   * made by others, as appropriate (see [[synchronizeWithCloud]]).
   */
  export class CloudAccess extends CloudSqlite.DbAccess<PropertyDb> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: PropertyDb, props, dbName: defaultDbName });
    }

    /**
     * Initialize a cloud container for use as a PropertyStore. The container must first be created via its storage supplier api (e.g. Azure, or AWS).
     * A valid sasToken that grants write access must be supplied. This function creates and uploads an empty PropertyDb into the container.
     * @note this deletes any existing content in the container.
     */
    public static async initializeDb(args: { props: CloudSqlite.ContainerAccessProps }) {
      return super._initializeDb({ ...args, dbType: PropertyDb, dbName: defaultDbName });
    }
  }
}
