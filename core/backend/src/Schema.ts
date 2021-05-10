/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ClassRegistry } from "./ClassRegistry";

/** Base class for all schema classes - see [working with schemas and elements in TypeScript]($docs/learning/backend/SchemasAndElementsInTypeScript.md).
 * @public
 */
export class Schema {
  /** The name of the BIS schema handled by this Schema.
   * @note Every subclass of Schema ** MUST ** override this method to identify its BIS schema.
   * Failure to do so will ordinarily result in an error when the schema is registered, since there may only
   * be one JavaScript class for a given BIS schema (usually the errant schema will collide with its superclass.)
   */
  public static get schemaName(): string { throw new Error(`you must override static schemaName in ${this.name}`); }

  /** if true, this Schema is a proxy for a missing Domain marked with the `BisCore.SchemaHasBehavior` customAttribute.
   * Classes generated for this Schema will disallow protected operations.
   * @internal
   */
  public static get missingRequiredBehavior(): boolean { return false; }

  /** Get a semver-compatible string from a padded version string.
   * works on unpadded version strings as well
   * if there is no write version, it will be added
   * @example Schema.toSemverString("1.02.03") === "1.2.3"
   * @example Schema.toSemverString("1.01") === "1.0.1" // write version was added
   * @beta
   */
  public static toSemverString(paddedVersion: string): string {
    const tuple = paddedVersion.split(".").map(Number);
    const noWriteVersion = tuple.length === 2;
    if (noWriteVersion)
      tuple.splice(1, 0, 0); // insert 0 before the second element
    return tuple.join(".");
  }

  /** Schemas may not be instantiated. The method is not private only because that precludes subclassing. It throws an
   * error if it is ever called.
   * @internal
   */
  protected constructor() { throw new Error(`cannot create an instance of a Schema ${this.constructor.name}`); }
}

/** Manages registered schemas
 * @public
 */
export class Schemas {
  private static readonly _registeredSchemas = new Map<string, typeof Schema>();
  private constructor() { } // this is a singleton

  /** Register a schema prior to using it.
   * @throws [[IModelError]] if a schema of the same name is already registered.
   */
  public static registerSchema(schema: typeof Schema) {
    const key = schema.schemaName.toLowerCase();
    if (this.getRegisteredSchema(key))
      throw new IModelError(IModelStatus.DuplicateName, `Schema "${schema.schemaName}" is already registered`, Logger.logWarning, BackendLoggerCategory.Schemas);
    this._registeredSchemas.set(key, schema);
  }

  /** Unregister a schema, by name, if one is already registered.
   * This function is not normally needed, but is useful for cases where a generated *proxy* schema needs to be replaced by the *real* schema.
   * @param schemaName Name of the schema to unregister
   * @return true if the schema was unregistered
   * @internal
   */
  public static unregisterSchema(schemaName: string): boolean {
    const schema = this.getRegisteredSchema(schemaName);
    if (undefined !== schema)
      ClassRegistry.unregisterClassesFrom(schema);

    return this._registeredSchemas.delete(schemaName.toLowerCase());
  }

  /** Look up a previously registered schema
   * @param schemaName The name of the schema
   * @returns the previously registered schema or undefined if not registered.
   */
  public static getRegisteredSchema(schemaName: string): typeof Schema | undefined { return this._registeredSchemas.get(schemaName.toLowerCase()); }
}
