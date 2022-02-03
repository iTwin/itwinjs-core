/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelStatus } from "@itwin/core-bentley";
import type { ISchemaLocater} from "@itwin/ecschema-metadata";
import { ECVersion, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { IModelError } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import type { IModelDb } from "./IModelDb";

/**
 * A utility class for retrieving EC Schema objects from an iModel. Loaded schemas are held in memory within
 * a schema context managed by IModelSchemaLoader. The IModelSchemaLoader object should be held in memory if
 * multiple calls to [[getSchema]] or [[tryGetSchema]] is a possibility, thereby avoiding unnecessary schema
 * retrievals from an iModel.
 * @alpha
 */
export class IModelSchemaLoader {
  private _context: SchemaContext;

  /** @internal */
  public constructor(private _iModel: IModelDb) {
    this._context = new SchemaContext();
    const locater = new IModelSchemaLocater(this._iModel);
    this._context.addLocater(locater);
  }

  /** Get a schema by name
   * @param schemaName a string with the name of the schema to load.
   * @throws [IModelError]($common) if the schema is not found or cannot be loaded.
   */
  public getSchema<T extends Schema>(schemaName: string): T {
    const schema = this.tryGetSchema(schemaName);
    if (!schema)
      throw new IModelError(IModelStatus.NotFound, `reading schema=${schemaName}`);

    return schema as T;
  }

  /** Attempts to get a schema by name
   * @param schemaName a string with the name of the schema to load.
   * @throws [IModelError]($common) if the schema exists, but cannot be loaded.
   */
  public tryGetSchema<T extends Schema>(schemaName: string): T | undefined {
    // SchemaKey version is not used when locating schema in an iModel, so the version is arbitrary.
    const key = new SchemaKey(schemaName, new ECVersion(1, 0, 0));
    const schema = this._context.getSchemaSync(key, SchemaMatchType.Latest);
    return schema as T;
  }
}

/**
 * A private ISchemaLocater implementation for locating and retrieving EC Schema objects from an iModel
 * @alpha
 */
class IModelSchemaLocater implements ISchemaLocater {
  /** @internal */
  public constructor(private _iModel: IModelDb) { }

  /** Get a schema by [SchemaKey]
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [IModelError]($common) if the schema exists, but cannot be loaded.
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext | undefined): Promise<T | undefined> {
    return this.getSchemaSync(schemaKey, matchType, context) as T;
  }

  /** Get a schema by [SchemaKey] synchronously.
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [IModelError]($common) if the schema exists, but cannot be loaded.
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, _matchType: SchemaMatchType, context?: SchemaContext | undefined): T | undefined {
    const schemaProps = this.getSchemaString(schemaKey.name);
    if (!schemaProps)
      return undefined;

    context = context ? context : new SchemaContext();
    return Schema.fromJsonSync(schemaProps, context) as T;
  }

  /** Read schema data from the iModel as JSON string
   * @param schemaName A string with the name of the schema to load.
   * @returns A string with the JSON for the schema or `undefined` if the schema is not found.
   * @throws [IModelError]($common) if the schema exists, but cannot be loaded.
   */
  private getSchemaString(schemaName: string): string | undefined {
    const val: IModelJsNative.ErrorStatusOrResult<any, any> = this._iModel.nativeDb.getSchema(schemaName);
    if (undefined !== val.error) {
      if (IModelStatus.NotFound === val.error.status) {
        return undefined;
      }
      throw new IModelError(val.error.status, `reading schema=${schemaName}`);
    }
    return val.result;
  }
}
