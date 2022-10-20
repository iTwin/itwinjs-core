/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@itwin/core-bentley";
import { CloudSqlite } from "./CloudSqlite";
import { SettingObject } from "./workspace/Settings";

/**
 * A persistent storage for a set of values of type `PropertyType`, each with a unique `PropertyName`.
 * `PropertyStore`s are stored in cloud containers, and require an access token that grants permission to read and/or write them.
 * All write operations will fail without an access token that grants write permission.
 * A `PropertyStore` is cached on a local drive so reads are fast and inexpensive, and may even be done offline after a prefetch.
 * However, that means that callers are responsible for synchronizing the local cache to ensure it includes changes
 * made by others, as appropriate (see [[synchronizeWithCloud]]).
 * @alpha */
export interface PropertyStore {

  /** The collection of property values in the PropertyStore as of the last time it was synchronized. */
  readonly values: PropertyStore.Values;

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

/** @alpha */
export namespace PropertyStore {
  /** @internal */
  export let openPropertyStore: ((props: CloudSqlite.ContainerAccessProps) => PropertyStore) | undefined;

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
    readonly valueCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
    /** Order results ascending or descending. If not supplied, the results are unordered (random). */
    readonly orderBy?: "ASC" | "DESC";
    /** An SQL expression to further filter results. This string is appended to the `WHERE` clause with an `AND` (that should not be part of the sqlExpression) */
    readonly sqlExpression?: string;
  }

  /**
   * A readonly set of Property values in a PropertyStore.
   * @alpha
   */
  export interface Values {
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
}
