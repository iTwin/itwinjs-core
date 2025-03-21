/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { SchemaInfo } from "./Interfaces";
import type { SchemaProps } from "./Deserialization/JsonProps";
import type { SchemaContext } from "./Context";
import type { SchemaItem } from "./Metadata/SchemaItem";
import { BeEvent } from "@itwin/core-bentley";
import { Schema } from "./Metadata/Schema";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";
import { SchemaReadHelper } from "./Deserialization/Helper";
import { SchemaMatchType } from "./ECObjects";
import { JsonParser } from "./Deserialization/JsonParser";
import { ECClass } from "./Metadata/Class";
import { ECObjectsError, ECObjectsStatus } from "./Exception";

type ReadonlyBeEvent<T extends (...args: any[]) => any> = Pick<BeEvent<T>, "addListener" | "addOnce" | "removeListener">;

type SchemaCompleteHandler = (schema: Schema) => void;
type SchemaErrorHandler = (schema: Schema, error: Error) => void;

/**
 * Defines the SchemaLoader Options which informat shall initially be loaded
 * for each incrementally loaded schema.
 * @beta
 */
export interface SchemaLoaderOptions {
  /** Loads stubs (name, type, description, label) for all items in the schema */
  readonly includeItems?: boolean;
  /** Loads only class stubs, including their base classes. */
  readonly includeClasses?: boolean;
}

/**
 * The IncrementalSchemaLoader is a base class to load EC Schemas incrementally.
 * This is useful for large schemas that take a long time to load, but clients
 * need a rough idea what's in the schamas as fast as possible.
 * @beta
 */
export abstract class IncrementalSchemaLoader {
  private readonly _resolvingSchemas: Map<string, Promise<Schema | undefined>>;
  private readonly _unresolvedSchemas: Set<string>;
  private readonly _onSchemaComplete = new BeEvent<SchemaCompleteHandler>();
  private readonly _onSchemaError = new BeEvent<SchemaErrorHandler>();
  private readonly _options: SchemaLoaderOptions;

  /** Gets the options how the schema loader load the schemas. */
  protected get options(): SchemaLoaderOptions {
    return this._options;
  }

  /**
   * Initializes a new instance of the IncrementalSchemaLoader class.
   * @param options   The schema loaders options.
   */
  constructor(options?: SchemaLoaderOptions) {
    this._options = options || {};
    this._resolvingSchemas = new Map<string, Promise<Schema>>();
    this._unresolvedSchemas = new Set<string>();
  }

  /** Event that gets fired when a schema has been loaded completely. */
  public get onSchemaComplete(): ReadonlyBeEvent<SchemaCompleteHandler> {
    return this._onSchemaComplete;
  }

  /** Event that gets fired when a schema error occured during loading it. */
  public get onSchemaError(): ReadonlyBeEvent<SchemaErrorHandler> {
    return this._onSchemaError;
  }

  /**
   * Gets the schema partials for the given schema key. The first item in the array is the
   * actual schema props of the schema to load, the following items are partial schema props
   * of referenced schemas.
   * @param schemaKey   The schema key of the requested schema.
   * @param context     The schema context.
   */
  protected abstract getSchemaPartials(schemaKey: SchemaKey, context: SchemaContext): Promise<ReadonlyArray<Partial<SchemaProps>> | undefined>;

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
   * Start loading the schema for the given schema info incrementally. The schema is returned
   * as soon as the schema stub is loaded while the schema fully resolves in the background.
   * @param schemaInfo    The schema info of the schema to load.
   * @param schemaContext The schema context to load the schema into.
   */
  public async loadSchema(schemaInfo: SchemaInfo, schemaContext: SchemaContext): Promise<Schema | undefined> {
    const schemaReader = new IncrementalSchemaReader(schemaContext, true);

    // Fetches the schema partials for the given schema key. The first item in the array is the
    // actual schema props of the schema to load, the following items are schema props of referenced
    // schema items that are needed to resolve the schema properly.
    const schemaPartials = await this.getSchemaPartials(schemaInfo.schemaKey, schemaContext);
    if(schemaPartials === undefined)
      return undefined;

    // Override the get schema method. While the schema reader method always look up in the
    // schema context, we inject here to create a schema stub if the schema is not yet loaded.
    schemaReader.getSchema = async (schemaKey, matchType) => {
      const lookupSchemaInfo = await schemaContext.getSchemaInfo(schemaKey, matchType);
      if(lookupSchemaInfo === undefined) {
        return undefined;
      }

      if(schemaContext.schemaExists(lookupSchemaInfo.schemaKey)) {
        return schemaContext.getSchema(lookupSchemaInfo.schemaKey);
      }

      const schemaStub = new Schema(schemaContext, lookupSchemaInfo.schemaKey, lookupSchemaInfo.alias);
      await schemaContext.addSchema(schemaStub);

      this._unresolvedSchemas.add(lookupSchemaInfo.schemaKey.name);
      return schemaStub;
    };

    const schema = await schemaReader.getSchema(schemaInfo.schemaKey, SchemaMatchType.Exact);
    if(schema === undefined)
      return undefined;

    // Start the actual schema stub loading.
    const [schemaProps, ...referencedSchemaProps] = schemaPartials;
    await schemaReader.readSchema(schema, schemaProps);
    await schemaReader.loadSchema(schemaInfo, schema);

    // Add the related items first that baseclasses can be resolved properly.
    await this.loadReferencedSchemas(referencedSchemaProps, schemaReader);

    // Resolves the schema stack to get fully loaded. All the schemas in the stack are loaded in parallel
    // while the schema stub is already returned to the caller. This way the caller can start working with
    // the schema while it is still loading. The resolver method also takes care to not load the same schema
    // multiple times (eg if it referenced by other schemas).
    void this.startResolveFullSchema(schema)
      .then((completeSchema) => completeSchema && this._onSchemaComplete.raiseEvent(completeSchema))
      .catch((error) => this._onSchemaError.raiseEvent(schema, error));

    return schema;
  }

  private async loadReferencedSchemas(schemaPartials: Partial<SchemaProps>[], schemaReader: IncrementalSchemaReader) {
    for(const schemaPartial of schemaPartials) {
      const schema = await schemaReader.getSchema(SchemaKey.parseString(`${schemaPartial.name}.0.0.0`), SchemaMatchType.Latest);
      if(schema === undefined || schemaPartial.items === undefined)
        return;

      for(const itemProps of Object.values(schemaPartial.items)) {
        if(!itemProps.name || !itemProps.schemaItemType || await schema.getItem(itemProps.name) !== undefined)
          continue;

        await schemaReader.loadSchemaItem(schema, itemProps.name, itemProps.schemaItemType, itemProps);
      }
    }
  }

  private async startResolveFullSchema(schema: Schema): Promise<Schema | undefined> {
    // If the schema is already resolved, return it directly.
    if(!this._unresolvedSchemas.has(schema.schemaKey.name)) {
      return schema;
    }

    // Since the schema relys on it's references, they get triggered to be resolved
    // first by resursivly calling this method. After all references has been resolved
    // the schema itself gets resolved.
    await Promise.all(schema.references.map(async (referenceSchema) => {
      return this.startResolveFullSchema(referenceSchema);
    }));

    // If resolving the requested schemas is already in progress, return the promise.
    const existingResolvingPromise = this._resolvingSchemas.get(schema.schemaKey.name);
    if(existingResolvingPromise !== undefined) {
      return existingResolvingPromise;
    }

    const resolvingPromise = this.getSchemaJson(schema.schemaKey, schema.context)
      .then(async (schemaProps) => this.resolveSchemaFromProps(schema, schemaProps));

    this._resolvingSchemas.set(schema.schemaKey.name, resolvingPromise);
    void resolvingPromise.finally(() => this._resolvingSchemas.delete(schema.schemaKey.name));

    return resolvingPromise;
  }

  private async resolveSchemaFromProps(schema: Schema, schemaProps?: SchemaProps): Promise<Schema | undefined> {
    if(!schemaProps || !schemaProps.items)
      return undefined;

    const reader = new IncrementalSchemaReader( schema.context, false);
    await reader.readSchema(schema, schemaProps);
    await reader.loadSchema(schema, schema);

    this._unresolvedSchemas.delete(schema.schemaKey.name);

    return schema;
  }
}

/**
 * Internal helper class to read schema information incrementally. It's based of the SchemaReadHelper
 * but overrides a few methods to support the incremental schema loading case.
 * @internal
 */
class IncrementalSchemaReader extends SchemaReadHelper {
  private readonly _incremental: boolean;

  constructor(schemaContext: SchemaContext, incremental: boolean) {
    super(JsonParser, schemaContext);
    this._incremental = incremental;
  }

  /** Override to make this method accessible in the schema loader */
  public override async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType): Promise<Schema | undefined> {
    return super.getSchema(schemaKey, matchType);
  }

  /** Override to make this method accessible in the schema loader */
  public override async getSchemaItem(schemaItemKey: SchemaItemKey): Promise<SchemaItem | undefined> {
    return super.getSchemaItem(schemaItemKey);
  }

  /** Override to make this method accessible in the schema loader */
  public override async loadSchema(schemaInfo: SchemaInfo, targetSchema: Schema): Promise<Schema> {
    return super.loadSchema(schemaInfo, targetSchema);
  }

  protected override async loadSchemaReference(schema: Schema, refKey: SchemaKey): Promise<Schema> {
    const existingReference = await schema.getReference(refKey.name);
    if(existingReference)
      return existingReference;

    const lookupSchemaInfo = await this.context.getSchemaInfo(refKey, SchemaMatchType.Exact);
    if(lookupSchemaInfo === undefined)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the referenced schema, ${refKey.name}.${refKey.version.toString()}, of ${schema.schemaKey.name}`);

    const referencedSchema = await super.loadSchemaReference(schema, refKey);

    // Also load the references of the referenced schema.
    for(const ref of lookupSchemaInfo.references) {
      await this.loadSchemaReference(referencedSchema, ref.schemaKey);
    }

    return referencedSchema;
  }

  public override async loadSchemaItem(schema: Schema, name: string, itemType: string, schemaItemObject: Readonly<unknown>): Promise<SchemaItem | undefined> {
    const schemaItem = await super.loadSchemaItem(schema, name, itemType, this._incremental ? undefined : schemaItemObject);

    // In incremental mode, we only load the stubs of the classes. These include the modifier and base classes.
    // The fromJSON method of the actual class instances may complain about missing properties in the props, so
    // calling the fromJSON on the ECClass ensures only the bare minimum is loaded.
    if(this._incremental && schemaItemObject && schemaItem && ECClass.isECClass(schemaItem)) {
      ECClass.prototype.fromJSONSync.call(schemaItem, schemaItemObject);
    }

    return schemaItem;
  }

  protected override skipSchemaItem(schemaItem: SchemaItem | undefined): boolean {
    return !this._incremental && schemaItem !== undefined;
  }
}