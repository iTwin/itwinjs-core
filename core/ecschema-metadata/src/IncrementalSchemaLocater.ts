/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { SchemaInfo } from "./Interfaces";
import type { ISchemaLocater, SchemaContext } from "./Context";
import type { IncrementalSchemaLoader } from "./IncrementalSchemaLoader";
import type { Schema } from "./Metadata/Schema";
import type { SchemaKey } from "./SchemaKey";
import type { SchemaMatchType } from "./ECObjects";

type LoadSchemaInfoHandler = (context: SchemaContext) => Promise<Iterable<SchemaInfo>>;

/**
 * A ISchemaLocater implementation for locating and retrieving EC Schema objects incrementially instead
 * of all of the schema and it's references at once. This is useful for large schemas that take a long
 * time to load, but clients need a rough scelleton of the schema as fast as possible.
 *
 * The IncrementalSchemaLocater is a locater around the IncrementalSchemaLoader to be used in a
 * SchemaContext.
 * @beta
 */
export class IncrementalSchemaLocater implements ISchemaLocater {
  private readonly _schemaLoader: IncrementalSchemaLoader;
  private readonly _schemaInfoCache: SchemaInfoCache;

  /**
   * Initializes a new instance of the IncrementalSchemaLocater class.
   * @param schemaLoader  The schema loader instance that gets called to gather Schema Props.
   * @param options       The options to specify what shall be loaded initially.
   */
  constructor(schemaLoader: IncrementalSchemaLoader) {
    this._schemaLoader = schemaLoader;
    this._schemaInfoCache = new SchemaInfoCache(async (context) => {
      return schemaLoader.loadSchemaInfos(context);
    });
  }

  /**
   * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
   * May return the entire Schema so long as it is completely loaded as it satisfies the SchemaInfo interface.
   * @param schemaKey   The SchemaKey to look up in the schema to get from the cache.
   * @param matchType   The match type to match key against candidate schemas.
   * @param context     The schema context for loading schema references.
   */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    return this._schemaInfoCache.lookup(schemaKey, matchType, context);
  }

  /**
   * Attempts to get a schema from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey   The SchemaKey to look up.
   * @param matchType   The match type to match key against candidate schemas.
   * @param context     The schema context for loading schema references.
   */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined> {
    const schemaInfo = await this.getSchemaInfo(schemaKey, matchType, context);
    return schemaInfo
      ? this._schemaLoader.loadSchema(schemaInfo, context)
      : undefined;
  }

  /**
   * Attempts to get a schema from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * NOT IMPLEMENTED IN THIS LOCATER.
   * @param schemaKey   The SchemaKey to look up
   * @param matchType   The match type to match key against candidate schemas.
   * @param context     The schema context for loading schema references,
   */
  public getSchemaSync(_schemaKey: Readonly<SchemaKey>, _matchType: SchemaMatchType, _context: SchemaContext): Schema | undefined {
    // Incremental Schema loading does not support synchronous loading, return undefined.
    return undefined;
  }
}

/**
 * Helper class to manage schema infos for a schema context.
 */
class SchemaInfoCache {
  private readonly _schemaInfoCache: WeakMap<SchemaContext, Array<SchemaInfo>>;
  private readonly _schemaInfoLoader: LoadSchemaInfoHandler;

  constructor(schemaInfoLoader: LoadSchemaInfoHandler) {
    this._schemaInfoCache = new WeakMap<SchemaContext, Array<SchemaInfo>>();
    this._schemaInfoLoader = schemaInfoLoader;
  }

  public async lookup(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    if (!this._schemaInfoCache.has(context)) {
      const schemaInfos = await this._schemaInfoLoader(context);
      this._schemaInfoCache.set(context, Array.from(schemaInfos));
    }

    const contextSchemaInfos = this._schemaInfoCache.get(context);
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
