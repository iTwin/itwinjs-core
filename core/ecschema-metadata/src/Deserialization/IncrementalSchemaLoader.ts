/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ECSchemaNamespaceUris } from "../Constants";
import { SchemaContext } from "../Context";
import { SchemaItemType, SchemaMatchType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { SchemaInfo } from "../Interfaces";
import { ECClass } from "../Metadata/Class";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { SchemaKey } from "../SchemaKey";
import { SchemaLoadingController } from "../utils/SchemaLoadingController";
import { SchemaReadHelper } from "./Helper";
import { JsonParser } from "./JsonParser";
import { SchemaProps } from "./JsonProps";
import { SchemaGraphUtil } from "./SchemaGraphUtil";


/**
 * Defines the SchemaLoader Options which determine how each schema is to be loaded.
 * All options are optional.
 * @beta
 */
export interface SchemaLoaderOptions {
  /** Only load partial schemas. Full schema information will not be retrieved. Defaults to false. */
  readonly loadPartialSchemaOnly?: boolean;
}

/**
 * The IncrementalSchemaLoader is a base class to load EC Schemas incrementally.
 * This is useful for large schemas that take a long time to load, but clients
 * need a rough idea what's in the schemas as fast as possible.
 * @beta
 */
export abstract class IncrementalSchemaLoader {
  private readonly _options: SchemaLoaderOptions;

  /** Gets the options how the schema loader load the schemas. */
  protected get options(): SchemaLoaderOptions {
    return this._options;
  }

  /**
   * Initializes a new instance of the IncrementalSchemaLoader class.
   * @param options The schema loaders options.
   */
  constructor(options?: SchemaLoaderOptions) {
    this._options = options || {};
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
  public abstract loadSchemaInfos(context: SchemaContext): Promise<Iterable<SchemaInfo>>;

  /**
   * Checks if the context contains teh right schemas to support incremental schema loading.
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
  public async loadSchema(schemaInfo: SchemaInfo, schemaContext: SchemaContext): Promise<Schema> {
    // If the meta schema is an earlier version than 4.0.3, we can't use the ECSql query interface to get the schema
    // information required to load the schema entirely. In this case, we fallback to use the ECSchema RPC interface
    // to fetch the whole schema json.
    if (!await this.supportPartialSchemaLoading(schemaContext)) {
      const schemaJson = await this.getSchemaJson(schemaInfo.schemaKey, schemaContext);
      return Schema.fromJson(schemaJson!, schemaContext);
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

  private async startLoadingPartialSchema(schemaProps: SchemaProps, schemaContext: SchemaContext): Promise<void> {
    if (schemaContext.schemaExists(SchemaKey.parseString(`${schemaProps.name}.${schemaProps.version}`))) {
      return;
    }

    const controller = new SchemaLoadingController();
    const schemaReader = new IncrementalSchemaReader(schemaContext, true);
    const schema = new Schema(schemaContext);
    schema.loadingController = controller;

    await schemaReader.readSchema(schema, schemaProps);

    if (!this._options.loadPartialSchemaOnly)
      controller.start(this.startLoadingFullSchema(schema));
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

    const loadSchema = async () => {
      const fullSchemaProps = await this.getSchemaJson(schema.schemaKey, schema.context)
      const reader = new IncrementalSchemaReader(schema.context, false);
      await reader.readSchema(schema, fullSchemaProps, false);
    };

    return schema.loadingController.start(loadSchema());
  }

  /**
   * Creates a SchemaProps object by loading the Schema information from the given SchemaContext.
   * @param schemaKey The SchemaKey of the Schema whose props are to be retrieved.
   * @param schemaContext The SchemaContext holding the Schema.
   * @returns The SchemaProps object.
   */
  protected async createSchemaProps(schemaKey: SchemaKey, schemaContext: SchemaContext): Promise<SchemaProps> {
    const schemaInfo = await schemaContext.getSchemaInfo(schemaKey, SchemaMatchType.Latest);
    if (!schemaInfo)
      throw new Error(`Schema ${schemaKey.name} could not be found.`);
    const schemaProps: SchemaProps = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      alias: schemaInfo.alias,
      version: schemaInfo.schemaKey.version.toString(),
      references: [],
      items: {}
    };

    if (!schemaProps.references)
      throw new Error(`Schema references is undefined for the Schema ${schemaInfo.schemaKey.name}`);

    schemaInfo.references.forEach((ref) => {
      schemaProps.references!.push({ name: ref.schemaKey.name, version: ref.schemaKey.version.toString() });
    });

    return schemaProps;
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
 * Internal helper class to read schema information incrementally. It's based on the SchemaReadHelper
 * but overrides a few methods to support the incremental schema loading case.
 * @internal
 */
class IncrementalSchemaReader extends SchemaReadHelper {
  private readonly _incremental: boolean;

  /**
   * Initializes a new [[IncrementalSchemaReader]] instance.
   * @param schemaContext The [[SchemaContext]]($ecschema-metadata) used to load the schemas.
   * @param incremental Indicates that the Schema should be read incrementally.
   * Pass false to load the full schema without an incremental/partial load.
   */
  constructor(schemaContext: SchemaContext, incremental: boolean) {
    super(JsonParser, schemaContext);
    this._incremental = incremental;
  }

  /**
   * Indicates that a given [[SchemaItem]]($ecschema-metadata) has been fully loaded.
   * @param schemaItem The SchemaItem to check.
   * @returns True if the item has been loaded, false if still in progress.
   */
  protected override schemaItemLoaded(schemaItem: SchemaItem | undefined): boolean {
    return schemaItem !== undefined
      && schemaItem.loadingController !== undefined
      && schemaItem.loadingController.isComplete;
  }

  /**
   * Starts loading the [[SchemaItem]]($ecschema-metadata) identified by the given name and itemType.
   * @param schema The [[Schema]]($ecschema-metadata) that contains the SchemaItem.
   * @param name The name of the SchemaItem to load.
   * @param itemType The SchemaItem type name of the item to load.
   * @param schemaItemObject The object accepting the SchemaItem data.
   * @returns A promise that resolves to the loaded SchemaItem instance. Can be undefined.
   */
  public override async loadSchemaItem(schema: Schema, name: string, itemType: string, schemaItemObject: Readonly<unknown>): Promise<SchemaItem | undefined> {
    const schemaItem = await super.loadSchemaItem(schema, name, itemType, this._incremental ? undefined : schemaItemObject);

    // In incremental mode, we only load the stubs of the classes. These include the modifier and base classes.
    // The fromJSON method of the actual class instances may complain about missing properties in the props, so
    // calling the fromJSON on the ECClass ensures only the bare minimum is loaded.
    if (this._incremental && schemaItemObject && schemaItem) {
      if (schemaItem.schemaItemType === SchemaItemType.KindOfQuantity) {
        SchemaItem.prototype.fromJSONSync.call(schemaItem, schemaItemObject);
      } else {
        schemaItem.fromJSONSync(schemaItemObject);
      }
    }

    this.schemaItemLoading(schemaItem);
    return schemaItem;
  }

  private schemaItemLoading(schemaItem: SchemaItem | undefined) {
    if (schemaItem === undefined)
      return;

    if (schemaItem.loadingController === undefined) {
      const controller = new SchemaLoadingController();
      schemaItem.loadingController = controller;
    }

    if (ECClass.isECClass(schemaItem)
      || schemaItem.schemaItemType === SchemaItemType.KindOfQuantity
      || schemaItem.schemaItemType === SchemaItemType.Format)
      schemaItem.loadingController.isComplete = !this._incremental;
    else
      schemaItem.loadingController.isComplete = true;
  }
}

