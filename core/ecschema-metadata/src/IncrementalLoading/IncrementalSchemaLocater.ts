/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ECSchemaNamespaceUris } from "../Constants";
import { ISchemaLocater, SchemaContext } from "../Context";
import { SchemaProps, SchemaReferenceProps } from "../Deserialization/JsonProps";
import { SchemaGraphUtil } from "../Deserialization/SchemaGraphUtil";
import { SchemaMatchType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { SchemaInfo } from "../Interfaces";
import { Schema } from "../Metadata/Schema";
import { SchemaKey } from "../SchemaKey";
import { SchemaLoadingController } from "../utils/SchemaLoadingController";
import { IncrementalSchemaReader } from "./IncrementalSchemaReader";

export interface IncrementalSchemaInfo extends SchemaInfo {
  readonly description?: string;
  readonly label?: string;
  readonly ecSpecMajorVersion?: number;
  readonly ecSpecMinorVersion?: number;
}

type LoadSchemaInfoHandler = (context: SchemaContext) => Promise<Iterable<SchemaInfo>>;

/**
 * Defines the SchemaLocater Options which determine how each schema is to be loaded.
 * All options are optional.
 * @beta
 */
export interface SchemaLocaterOptions {
  /** Only load partial schemas. Full schema information will not be retrieved. Defaults to false. */
  readonly loadPartialSchemaOnly?: boolean;
}

/**
 * A [[ISchemaLocater]] implementation for locating and retrieving EC [[Schema]]
 * objects incrementally instead of the full schema and it's references at once. This is useful for large schemas that
 * take a long time to load, but clients need a rough skeleton of the schema as fast as possible.
 *
 * The IncrementalSchemaLocater is a locater around the [[IncrementalSchemaLocater]] to be used in a
 * [[SchemaContext]].
 * @internal
 */
export abstract class IncrementalSchemaLocater implements ISchemaLocater {
  private readonly _options: SchemaLocaterOptions;
  protected readonly _schemaInfoCache: SchemaInfoCache;

  /**
   * Initializes a new instance of the IncrementalSchemaLocater class.
   * @param options  The [[SchemaLocaterOptions]] that control the loading of the schema.
   */
  constructor(options?: SchemaLocaterOptions) {
    this._options = options || {};

    this._schemaInfoCache = new SchemaInfoCache(async (context) => {
      return this.loadSchemaInfos(context);
    });
  }

  /** Gets the options how the schema locater load the schemas. */
  protected get options(): SchemaLocaterOptions {
    return this._options;
  }

  /**
   * Gets the [[SchemaInfo]] which matches the provided SchemaKey.  The SchemaInfo may be returned
   * before the schema is fully loaded. May return the entire Schema so long as it is completely loaded as it satisfies
   * the SchemaInfo interface.
   * @param schemaKey   The [[SchemaKey]] to look up.
   * @param matchType   The [[SchemaMatchType]] to use against candidate schemas.
   * @param context     The [[SchemaContext]] for loading schema references.
   */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    return this._schemaInfoCache.lookup(schemaKey, matchType, context);
  }

  /**
   * Attempts to get a [[Schema]] from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey   The [[SchemaKey]] to look up.
   * @param matchType   The [[SchemaMatchType]] to use against candidate schemas.
   * @param context     The [[SchemaContext]] for loading schema references.
   */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined> {
    const schemaInfo = await this.getSchemaInfo(schemaKey, matchType, context);
    return schemaInfo
      ? this.loadSchema(schemaInfo, context)
      : undefined;
  }

  /**
   * Attempts to get a [[Schema]] from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * NOT IMPLEMENTED IN THIS LOCATER - ALWAYS RETURNS UNDEFINED.
   * @param schemaKey   The [[SchemaKey]] to look up.
   * @param matchType   The [[SchemaMatchType]] to use against candidate schemas.
   * @param context     The [[SchemaContext]] for loading schema references.
   * @returns           Incremental schema loading does not work synchronously, this will always return undefined.
   */
  public getSchemaSync(_schemaKey: Readonly<SchemaKey>, _matchType: SchemaMatchType, _context: SchemaContext): Schema | undefined {
    return undefined;
  }

  /**
   * Gets the schema partials for the given schema key. The first item in the array is the
   * actual schema props of the schema to load, the following items are partial schema props
   * of referenced schemas.
   * @param schemaKey   The schema key of the requested schema.
   * @param context     The schema context.
   */
  protected abstract getSchemaPartials(schemaKey: SchemaKey, context: SchemaContext): Promise<ReadonlyArray<SchemaProps> | undefined>;

  /**
   * Gets the full schema json for the requested schema key.
   * @param schemaKey   The schema key of the requested schema.
   * @param context     The schema context.
   */
  protected abstract getSchemaJson(schemaKey: SchemaKey, context: SchemaContext): Promise<SchemaProps | undefined>;

  /**
   * Loads the schema info objects for the given context.
   * @param context   The schema context to load the schema infos for.
   * @returns         A promise that resolves to an iterable of schema infos.
   */
  protected abstract loadSchemaInfos(context: SchemaContext): Promise<Iterable<SchemaInfo>>;

  /**
   * Checks if the context contains the right schemas to support incremental schema loading.
   * @param context   The schema context to check.
   * @returns         true if incremental schema loading is supported, false otherwise.
   */
  protected abstract supportPartialSchemaLoading(context: SchemaContext): Promise<boolean>;

  /**
   * Start loading the schema for the given schema info incrementally. The schema is returned
   * as soon as the schema stub is loaded while the schema fully resolves in the background. It should
   * only be called by the IncrementalSchemaLocater if a schema has not been loaded or started to
   * load yet.
   * @param schemaInfo    The schema info of the schema to load.
   * @param schemaContext The schema context to load the schema into.
   */
  protected async loadSchema(schemaInfo: SchemaInfo, schemaContext: SchemaContext): Promise<Schema> {
    // If the meta schema is an earlier version than 4.0.3, we can't use the ECSql query interface to get the schema
    // information required to load the schema entirely. In this case, we fallback to use the ECSchema RPC interface
    // to fetch the whole schema json.
    if (!await this.supportPartialSchemaLoading(schemaContext)) {
      const schemaJson = await this.getSchemaJson(schemaInfo.schemaKey, schemaContext);
      if(schemaJson === undefined)
        throw new ECSchemaError(ECSchemaStatus.UnableToLocateSchema, `Could not locate the schema, ${schemaInfo.schemaKey.name}.${schemaInfo.schemaKey.version.toString()}`);

      return Schema.fromJson(schemaJson, schemaContext);
    }

    // Fetches the schema partials for the given schema key. The first item in the array is the
    // actual schema props of the schema to load, the following items are schema props of referenced
    // schema items that are needed to resolve the schema properly.
    const schemaPartials = await this.getSchemaPartials(schemaInfo.schemaKey, schemaContext);
    if (schemaPartials === undefined)
      throw new ECSchemaError(ECSchemaStatus.UnableToLocateSchema, `Could not locate the schema, ${schemaInfo.schemaKey.name}.${schemaInfo.schemaKey.version.toString()}`);

    // Sort the partials in dependency order to ensure referenced schemas exist in the schema context
    // when they get requested. Otherwise the context would call this method again and for referenced
    // schemas, we would not want to request the whole schema props.
    const sortedPartials = await this.sortSchemaPartials(schemaPartials, schemaContext);
    for (const schemaProps of sortedPartials) {
      await this.startLoadingPartialSchema(schemaProps, schemaContext);
    }

    const schema = await schemaContext.getCachedSchema(schemaInfo.schemaKey);
    if (!schema)
      throw new Error(`Schema ${schemaInfo.schemaKey.name} could not be found.`);

    return schema;
  }

  /**
   * Creates a SchemaProps object by loading the Schema information from the given SchemaContext.
   * @param schemaKey The SchemaKey of the Schema whose props are to be retrieved.
   * @param schemaContext The SchemaContext holding the Schema.
   * @returns The SchemaProps object.
   */
  protected async createSchemaProps(schemaKey: SchemaKey, schemaContext: SchemaContext): Promise<SchemaProps> {
    const schemaInfo = await schemaContext.getSchemaInfo(schemaKey, SchemaMatchType.Latest) as IncrementalSchemaInfo | undefined;
    if (!schemaInfo)
      throw new Error(`Schema ${schemaKey.name} could not be found.`);

    const schemaReferences: Array<SchemaReferenceProps> = [];
    const schemaProps: SchemaProps = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      alias: schemaInfo.alias,
      version: schemaInfo.schemaKey.version.toString(),
      description: schemaInfo.description,
      label: schemaInfo.label,
      ecSpecMajorVersion: schemaInfo.ecSpecMajorVersion,
      ecSpecMinorVersion: schemaInfo.ecSpecMinorVersion,
      references: schemaReferences,
      items: undefined,
    };

    schemaInfo.references.forEach((ref) => {
      schemaReferences.push({ name: ref.schemaKey.name, version: ref.schemaKey.version.toString() });
    });

    return schemaProps;
  }

  private async startLoadingPartialSchema(schemaProps: SchemaProps, schemaContext: SchemaContext): Promise<void> {
    if (schemaContext.schemaExists(SchemaKey.parseString(`${schemaProps.name}.${schemaProps.version}`))) {
      return;
    }

    const controller = new SchemaLoadingController();
    const schemaReader = new IncrementalSchemaReader(schemaContext, true);
    const schema = new Schema(schemaContext);
    schema.setLoadingController(controller);

    await schemaReader.readSchema(schema, schemaProps);

    if (!this._options.loadPartialSchemaOnly)
      controller.start(this.startLoadingFullSchema(schema));
  }

  private async loadFullSchema(schema: Schema): Promise<void> {
    const fullSchemaProps = await this.getSchemaJson(schema.schemaKey, schema.context)
    const reader = new IncrementalSchemaReader(schema.context, false);
    await reader.readSchema(schema, fullSchemaProps, false);
  }

  private async startLoadingFullSchema(schema: Schema): Promise<void> {
    if (!schema.loadingController)
      return;

    // If the schema is already resolved, return it directly.
    if (schema.loadingController.isComplete || schema.loadingController.inProgress) {
      return;
    }

    // Since the schema relies on it's references, they get triggered to be resolved
    // first by recursively calling this method. After all references has been resolved
    // the schema itself gets resolved.
    await Promise.all(schema.references.map(async (referenceSchema) => {
      if (referenceSchema.loadingController && referenceSchema.loadingController.inProgress)
        return referenceSchema.loadingController.wait();
      else
        return this.startLoadingFullSchema(referenceSchema);
    }));

    return this.loadFullSchema(schema);
  }

  private async sortSchemaPartials(schemaPartials: ReadonlyArray<SchemaProps>, schemaContext: SchemaContext): Promise<ReadonlyArray<SchemaProps>> {
    const schemaInfos: Array<SchemaInfo & { props: SchemaProps }> = [];
    for (const schemaProps of schemaPartials) {
      const schemaKey = SchemaKey.parseString(`${schemaProps.name}.${schemaProps.version}`);
      const schemaInfo = await schemaContext.getSchemaInfo(schemaKey, SchemaMatchType.Latest);
      if (!schemaInfo)
        throw new Error(`Schema ${schemaKey.name} could not be found.`);

      schemaInfos.push({ ...schemaInfo, props: schemaProps });
    }

    const orderedSchemaInfos = SchemaGraphUtil.buildDependencyOrderedSchemaInfoList(schemaInfos) as Array<SchemaInfo & { props: SchemaProps }>;
    return orderedSchemaInfos.map((schemaInfo) => schemaInfo.props);
  }
}

/**
 * Helper class to manage schema infos for a schema context.
 */
class SchemaInfoCache {
  private readonly _schemaInfoCache: WeakMap<SchemaContext, Array<IncrementalSchemaInfo>>;
  private readonly _schemaInfoLoader: LoadSchemaInfoHandler;

  constructor(schemaInfoLoader: LoadSchemaInfoHandler) {
    this._schemaInfoCache = new WeakMap<SchemaContext, Array<IncrementalSchemaInfo>>();
    this._schemaInfoLoader = schemaInfoLoader;
  }

  public async getSchemasByContext(context: SchemaContext): Promise<IncrementalSchemaInfo[] | undefined> {
    if (!this._schemaInfoCache.has(context)) {
      const schemaInfos = await this._schemaInfoLoader(context);
      this._schemaInfoCache.set(context, Array.from(schemaInfos));
    }
    return this._schemaInfoCache.get(context);
  }

  public async lookup(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<IncrementalSchemaInfo | undefined> {
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
