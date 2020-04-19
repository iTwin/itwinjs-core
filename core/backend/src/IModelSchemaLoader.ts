/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelError } from "@bentley/imodeljs-common";
import { Logger, IModelStatus } from "@bentley/bentleyjs-core";
import { IModelJsNative, BackendLoggerCategory } from "./imodeljs-backend";
import { IModelDb } from "./IModelDb";
import { BinaryPropertyTypeConverter } from "./BinaryPropertyTypeConverter";
import { ISchemaLocater, Schema, SchemaKey, SchemaMatchType, SchemaContext, SchemaProps, ECVersion } from "@bentley/ecschema-metadata";

const loggerCategory: string = BackendLoggerCategory.IModelSchemaLoader;

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
      throw new IModelError(IModelStatus.NotFound, "reading schema=" + schemaName, Logger.logWarning, loggerCategory);

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
    const schemaProps = this.getSchemaJson(schemaKey.name);
    if (!schemaProps)
      return undefined;

    context = context ? context : new SchemaContext();
    return Schema.fromJsonSync(schemaProps, context) as T;
  }

  /** Read schema data from the iModel as JSON
   * @param schemaName A string with the name of the schema to load.
   * @returns The JSON properties of the schema or `undefined` if the schema is not found.
   * @throws [IModelError]($common) if the schema exists, but cannot be loaded.
   */
  private getSchemaJson<T extends SchemaProps>(schemaName: string): T | undefined {
    const val: IModelJsNative.ErrorStatusOrResult<any, any> = this._iModel.nativeDb.getSchema(schemaName);
    if (undefined !== val.error) {
      if (IModelStatus.NotFound === val.error.status) {
        return undefined;
      }
      throw new IModelError(val.error.status, "reading schema=" + schemaName, Logger.logWarning, loggerCategory);
    }
    return BinaryPropertyTypeConverter.decodeBinaryProps(val.result)! as T;
  }
}
