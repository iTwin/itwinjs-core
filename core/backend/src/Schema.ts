/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ECVersion, SchemaKey } from "@itwin/ecschema-metadata";
import { ClassRegistry } from "./ClassRegistry.js";

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

  /** Unique identifier for this schema, typed variant of [[schemaName]].
   * @internal
   */
  public static get schemaKey(): SchemaKey {
    // We cannot cache this here because the schemaName may be overridden without this being overridden
    return new SchemaKey(this.schemaName, ECVersion.NO_VERSION); // backend cares little for versions right now, as only one version can exist in an imodel
  }

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

/**
 * Holds a map of registered schemas.
 * @public
 */
export class SchemaMap {
  private readonly _schemas = new Map<string, typeof Schema>();

    /** @internal */
    public get(schemaName: string): typeof Schema | undefined {
      return this._schemas.get(schemaName.toLowerCase());
    }

    /** @internal */
    public set(schemaName: string, schema: typeof Schema): void {
      this._schemas.set(schemaName.toLowerCase(), schema);
    }

    /** @internal */
    public delete(schemaName: string): boolean {
      return this._schemas.delete(schemaName.toLowerCase());
    }

  /** Register a schema prior to using it.
   * @throws [[IModelError]] if a schema of the same name is already registered.
   * @public
   */
  public registerSchema(schema: typeof Schema) {
    const key = schema.schemaName.toLowerCase();
    if (this.get(key))
      throw new IModelError(IModelStatus.DuplicateName, `Schema "${schema.schemaName}" is already registered`);
    this.set(key, schema);
  }
}

/** Manages registered schemas
 * @public
 */
export class Schemas {
  private static readonly _globalSchemas = new SchemaMap();
  private constructor() { } // this is a singleton

  /** Register a schema prior to using it.
   * This method registers the schema globally, to register a schema within the scope of a single iModel, use `IModelDb.schemaMap`.
   * @throws [[IModelError]] if a schema of the same name is already registered.
   */
  public static registerSchema(schema: typeof Schema) {
    this._globalSchemas.registerSchema(schema);
  }

  /** Unregister a schema, by name, if one is already registered.
   * This function is not normally needed, but is useful for cases where a generated *proxy* schema needs to be replaced by the *real* schema.
   * @param schemaName Name of the schema to unregister
   * @return true if the schema was unregistered
   */
  public static unregisterSchema(schemaName: string): boolean {
    const schema = this.getRegisteredSchema(schemaName);
    if (undefined !== schema)
      ClassRegistry.unregisterClassesFrom(schema);

    return this._globalSchemas.delete(schemaName.toLowerCase());
  }

  /** Look up a previously registered schema
   * @param schemaName The name of the schema
   * @returns the previously registered schema or undefined if not registered.
   */
  public static getRegisteredSchema(schemaName: string): typeof Schema | undefined { return this._globalSchemas.get(schemaName.toLowerCase()); }
}
