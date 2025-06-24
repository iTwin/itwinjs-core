/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ISchemaLocater, SchemaContext } from "../Context";
import { SchemaMatchType } from "../ECObjects";
import { SchemaInfo } from "../Interfaces";
import { Schema } from "../Metadata/Schema";
import { SchemaKey } from "../SchemaKey";
import type { IncrementalSchemaLoader } from "./IncrementalSchemaLoader";

type LoadSchemaInfoHandler = (context: SchemaContext) => Promise<Iterable<SchemaInfo>>;

/**
 * A [[ISchemaLocater]]($ecschema-metadata) implementation for locating and retrieving EC [[Schema]]($ecschema-metadata)
 * objects incrementally instead of the full schema and it's references at once. This is useful for large schemas that
 * take a long time to load, but clients need a rough skeleton of the schema as fast as possible.
 *
 * The IncrementalSchemaLocater is a locater around the [[IncrementalSchemaLoader]] to be used in a
 * [[SchemaContext]]($ecschema-metadata).
 * @beta
 */
export class IncrementalSchemaLocater implements ISchemaLocater {
  private readonly _schemaLoader: IncrementalSchemaLoader;
  private readonly _schemaInfoCache: SchemaInfoCache;

  /**
   * Initializes a new instance of the IncrementalSchemaLocater class.
   * @param schemaLoader  The schema loader instance that gets called to gather Schema Props.
   */
  constructor(schemaLoader: IncrementalSchemaLoader) {
    this._schemaLoader = schemaLoader;
    this._schemaInfoCache = new SchemaInfoCache(async (context) => {
      return schemaLoader.loadSchemaInfos(context);
    });
  }

  /**
   * Gets the readonly SchemaInfoCache of the locater.
   */
  public get schemaInfoCache() {
    return this._schemaInfoCache;
  }

  /**
   * Gets the [[SchemaInfo]]($ecschema-metadata) which matches the provided SchemaKey.  The SchemaInfo may be returned
   * before the schema is fully loaded. May return the entire Schema so long as it is completely loaded as it satisfies
   * the SchemaInfo interface.
   * @param schemaKey   The [[SchemaKey]]($ecschema-metadata) to look up.
   * @param matchType   The [[SchemaMatchType]]($ecschema-metadata) to use against candidate schemas.
   * @param context     The [[SchemaContext]]($ecschema-metadata) for loading schema references.
   */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    return this._schemaInfoCache.lookup(schemaKey, matchType, context);
  }

  /**
   * Attempts to get a [[Schema]]($ecschema-metadata) from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey   The [[SchemaKey]]($ecschema-metadata) to look up.
   * @param matchType   The [[SchemaMatchType]]($ecschema-metadata) to use against candidate schemas.
   * @param context     The [[SchemaContext]]($ecschema-metadata) for loading schema references.
   */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined> {
    const schemaInfo = await this.getSchemaInfo(schemaKey, matchType, context);
    return schemaInfo
      ? this._schemaLoader.loadSchema(schemaInfo, context)
      : undefined;
  }

  /**
   * Attempts to get a [[Schema]]($ecschema-metadata) from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * NOT IMPLEMENTED IN THIS LOCATER - ALWAYS RETURNS UNDEFINED.
   * @param schemaKey   The [[SchemaKey]]($ecschema-metadata) to look up.
   * @param matchType   The [[SchemaMatchType]]($ecschema-metadata) to use against candidate schemas.
   * @param context     The [[SchemaContext]]($ecschema-metadata) for loading schema references.
   * @returns           Incremental schema loading does not work synchronously, this will always return undefined.
   */
  public getSchemaSync(_schemaKey: Readonly<SchemaKey>, _matchType: SchemaMatchType, _context: SchemaContext): Schema | undefined {
    return undefined;
  }
}

/**
 * Helper class to manage schema infos for a schema context.
 */
export class SchemaInfoCache {
  private readonly _schemaInfoCache: WeakMap<SchemaContext, Array<SchemaInfo>>;
  private readonly _schemaInfoLoader: LoadSchemaInfoHandler;

  constructor(schemaInfoLoader: LoadSchemaInfoHandler) {
    this._schemaInfoCache = new WeakMap<SchemaContext, Array<SchemaInfo>>();
    this._schemaInfoLoader = schemaInfoLoader;
  }

  public async getSchemasByContext(context: SchemaContext): Promise<SchemaInfo[] | undefined> {
    if (!this._schemaInfoCache.has(context)) {
      const schemaInfos = await this._schemaInfoLoader(context);
      this._schemaInfoCache.set(context, Array.from(schemaInfos));
    }
    return this._schemaInfoCache.get(context);
  }

  public async lookup(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    const contextSchemaInfos = await this.getSchemasByContext(context);
    return contextSchemaInfos
      ? contextSchemaInfos.find((schemaInfo) => schemaInfo.schemaKey.matches(schemaKey, matchType))
      : undefined;
  }

  public remove(schemaKey: SchemaKey, context: SchemaContext): void {
    const contextSchemaInfos = this._schemaInfoCache.get(context);
    if (!contextSchemaInfos)
      return;

    const index = contextSchemaInfos.findIndex((schemaInfo) => schemaInfo.schemaKey.name === schemaKey.name);
    if (index !== -1) {
      contextSchemaInfos.splice(index, 1);
    }
  }
}
