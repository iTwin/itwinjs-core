/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Logger } from "@itwin/core-bentley";
import { SchemaContext } from "../Context";
import { ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationProps, InvertedUnitProps, KindOfQuantityProps, MixinProps,
  PhenomenonProps, PropertyCategoryProps, RelationshipClassProps, SchemaItemFormatProps, SchemaItemProps, SchemaItemUnitProps, SchemaProps,
  StructClassProps, UnitSystemProps } from "../Deserialization/JsonProps";
import { SchemaItemType, SchemaMatchType } from "../ECObjects";
import { SchemaInfo, WithSchemaKey } from "../Interfaces";
import { SchemaKey } from "../SchemaKey";
import { FullSchemaQueries } from "./FullSchemaQueries";
import { IncrementalSchemaLocater, SchemaLocaterOptions } from "./IncrementalSchemaLocater";
import { SchemaItemQueries } from "./SchemaItemQueries";
import { SchemaParser } from "./SchemaParser";
import { ecsqlQueries } from "./SchemaStubQueries";

interface SchemaItemInfo {
  readonly name: string;
  readonly schemaItemType: SchemaItemType;
}

interface SchemaInfoRow {
  readonly name: string;
  readonly version: string;
  readonly alias: string;
  readonly label: string;
  readonly description: string;  
  readonly references: string;
}

interface SchemaStubRow {
  readonly item: string;
}

interface BaseClassStubRow {
  readonly schema: string;
  readonly name: string;
  readonly schemaItemType: string;
  readonly modifier: number;
}

interface SchemaItemStubRow {
  readonly name: string;
  readonly schemaItemType: string;
  readonly modifier?: number;
  readonly baseClasses?: Array<BaseClassStubRow>;
  readonly mixins?: Array<{
    readonly schema: string,
    readonly name: string;
    readonly schemaItemType: string;
    readonly modifier: number;
    readonly baseClasses?: Array<BaseClassStubRow>
  }>;
}

interface SchemaRow {
  ecSpecMajorVersion: number,
  ecSpecMinorVersion: number,
  customAttributes: string,
  items: string,
}

interface SchemaItemRow {
  item: string | SchemaItemProps;
}

type AddSchemaItemHandler = <T extends SchemaItemInfo>(schemaName: string, itemStub: T) => Promise<void>;

type MutableSchemaProps = {
  -readonly [K in keyof SchemaProps]: SchemaProps[K];
};

interface QueryParameters {
  [parameterName: string]: string | number;
}

const LOGGER_CATEGORY = "IncrementalSchemaLoading.Performance";

/**
 * Query options used by the ECSqlSchemaLocater.
 * @internal
 */
export interface ECSqlQueryOptions {
  parameters?: QueryParameters;
  limit?: number;
}

/**
 * Defines the [[ECSqlSchemaLocater]] options which determine how each
 * schema is to be loaded. All options are optional.
 * @internal
 */
export interface ECSqlSchemaLocaterOptions extends SchemaLocaterOptions {
  /** Query for Schemas using multiple queries. Defaults to false. */
  readonly useMultipleQueries?: boolean;
}

/**
 * An abstract [[IncrementalSchemaLocater]] implementation for loading
 * EC [Schema] instances from an iModelDb using ECSql queries.
 * @internal
 */
export abstract class ECSqlSchemaLocater extends IncrementalSchemaLocater {
  /**
   * Gets the [[ECSqlSchemaLocaterOptions]] used by this locater.
   */
  protected override get options(): ECSqlSchemaLocaterOptions {
    return super.options as ECSqlSchemaLocaterOptions;
  }

  /**
   * Initializes a new ECSqlSchemaLocater instance.
   * @param options The options used by this Schema locater.
   */
  constructor(options?: ECSqlSchemaLocaterOptions) {
    super(options);
  }

  /**
   * Executes the given ECSql query and returns the resulting rows.
   * @param query   The ECSql query to execute.
   * @param options Optional arguments to control the query result.
   * @returns       A promise that resolves to the resulting rows.
   */
  protected abstract executeQuery<TRow>(query: string, options?: ECSqlQueryOptions): Promise<ReadonlyArray<TRow>>;

  /**
   * Gets the [[SchemaProps]] for the given schema key.
   * @param schemaKey The schema key of the schema to be resolved.
   */
  protected abstract getSchemaProps(schemaKey: SchemaKey): Promise<SchemaProps | undefined>

  /**
   * Gets the [[SchemaProps]] for the given schema key. This is the full schema json with all elements that are defined
   * in the schema. The schema locater calls this after the stub has been loaded to fully load the schema in the background.
   * @param schemaKey   The [[SchemaKey]] of the schema to be resolved.
   * @param context     The [[SchemaContext]] to use for resolving references.
   * @internal
   */
  protected async getSchemaJson(schemaKey: SchemaKey, context: SchemaContext): Promise<SchemaProps | undefined> {
    // If the meta schema is an earlier version than 4.0.3, we can't use the ECSql query interface to get the schema
    // information required to load the schema entirely. In this case, we fallback to use the ECSchema RPC interface
    // to fetch the whole schema json.
    if (!await this.supportPartialSchemaLoading(context))
      return this.getSchemaProps(schemaKey);

    const queryStart = Date.now();
    const schemaProps = this.options.useMultipleQueries
      ? await this.getFullSchemaMultipleQueries(schemaKey, context)
      : await this.getFullSchema(schemaKey, context);

    const queryDuration = Date.now() - queryStart;
    Logger.logTrace(LOGGER_CATEGORY, `Recieved SchemaProps for ${schemaKey.name} in ${queryDuration}ms`, {
      schemaName: schemaKey.name,
      queryMode: this.options.useMultipleQueries ? "parallel" : "single",
      duration: queryDuration,
    });

    return schemaProps;
  };

  /**
   * Gets the [[SchemaProps]] without schemaItems for the given schema name.
   * @param schemaKey The key of the Schema.
   * @param context The [[SchemaContext]] to use for resolving references.
   * @returns
   * @internal
   */
  private async getSchemaNoItems(schemaKey: SchemaKey, context: SchemaContext): Promise<SchemaProps | undefined> {
    const schemaRows = await this.executeQuery<SchemaRow>(FullSchemaQueries.schemaNoItemsQuery, { parameters: { schemaName: schemaKey.name } });
    const schemaRow = schemaRows[0];
    if (schemaRow === undefined)
      return undefined;

    const schema = {
      ... await this.createSchemaProps(schemaKey, context),
      ecSpecMajorVersion: schemaRow.ecSpecMajorVersion,
      ecSpecMinorVersion: schemaRow.ecSpecMinorVersion,
      customAttributes: JSON.parse(schemaRow.customAttributes),
    };
    
    const schemaInfos = await this._schemaInfoCache.getSchemasByContext(context) ?? [];
    return SchemaParser.parse(schema, schemaInfos);
  }

  /**
   * Checks if the [[SchemaContext]] has the right Meta Schema version to support the incremental schema loading.
   * @param context   The schema context to lookup the meta schema.
   * @returns         true if the context has a supported meta schema version, false otherwise.
   */
  protected async supportPartialSchemaLoading(context: SchemaContext): Promise<boolean> {
    const metaSchemaKey = new SchemaKey("ECDbMeta", 4, 0, 3);
    const metaSchemaInfo = await context.getSchemaInfo(metaSchemaKey, SchemaMatchType.LatestWriteCompatible);
    return metaSchemaInfo !== undefined;
  };

  /**
   * Gets all the Schema's Entity classes as [[EntityClassProps]] JSON objects.
   * @param schemaName The name of the Schema.
   * @param context The [[SchemaContext]] to which the schema belongs.
   * @returns A promise that resolves to a EntityClassProps array. Maybe empty of no entities are found.
   * @internal
   */
  protected async getEntities(schema: string, context: SchemaContext, queryOverride?: string): Promise<EntityClassProps[]> {
    const query = queryOverride ?? FullSchemaQueries.entityQuery;
    return this.querySchemaItem<EntityClassProps>(context, schema, query, "EntityClass");
  }

  /**
   * Gets all the Schema's Mixin classes as [[MixinProps]] JSON objects.
   * @param schemaName The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a MixinProps array. Maybe empty of no entities are found.
   * @internal
   */
  protected async getMixins(schema: string, context: SchemaContext, queryOverride?: string): Promise<MixinProps[]> {
    const query = queryOverride ?? FullSchemaQueries.mixinQuery;
    return this.querySchemaItem<MixinProps>(context, schema, query, "Mixin");
  }

  /**
   * Gets all the Schema's Relationship classes as [[RelationshipClassProps]] JSON objects.
   * @param schemaName The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a RelationshipClassProps array. Maybe empty if no items are found.
   * @internal
   */
  protected async getRelationships(schema: string, context: SchemaContext, queryOverride?: string): Promise<RelationshipClassProps[]> {
    const query = queryOverride ?? FullSchemaQueries.relationshipClassQuery;
    return this.querySchemaItem<RelationshipClassProps>(context, schema, query, "RelationshipClass");
  }

  /**
   * Gets all the Schema's CustomAttributeClass items as [[CustomAttributeClassProps]] JSON objects.
   * @param schemaName The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a CustomAttributeClassProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getCustomAttributeClasses(schema: string, context: SchemaContext, queryOverride?: string): Promise<CustomAttributeClassProps[]> {
    const query = queryOverride ?? FullSchemaQueries.customAttributeQuery;
    return this.querySchemaItem<CustomAttributeClassProps>(context, schema, query, "CustomAttributeClass");
  }


  /**
   * Gets all the Schema's StructClass items as [[StructClassProps]] JSON objects.
   * @param schemaName The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a StructClassProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getStructs(schema: string, context: SchemaContext, queryOverride?: string): Promise<StructClassProps[]> {
    const query = queryOverride ?? FullSchemaQueries.structQuery;
    return this.querySchemaItem<StructClassProps>(context, schema, query, "StructClass");
  }

  /**
   * Gets all the Schema's KindOfQuantity items as [[KindOfQuantityProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a KindOfQuantityProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getKindOfQuantities(schema: string, context: SchemaContext): Promise<KindOfQuantityProps[]> {
    return this.querySchemaItem<KindOfQuantityProps>(context, schema, SchemaItemQueries.kindOfQuantity(true), "KindOfQuantity");
  }

  /**
   * Gets all the Schema's PropertyCategory items as [[PropertyCategoryProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a PropertyCategoryProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getPropertyCategories(schema: string, context: SchemaContext): Promise<PropertyCategoryProps[]> {
    return this.querySchemaItem<PropertyCategoryProps>(context, schema, SchemaItemQueries.propertyCategory(true), "PropertyCategory");
  }

  /**
   * Gets all the Schema's Enumeration items as [[EnumerationProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a EnumerationProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getEnumerations(schema: string, context: SchemaContext): Promise<EnumerationProps[]> {
    return this.querySchemaItem<EnumerationProps>(context, schema, SchemaItemQueries.enumeration(true), "Enumeration");
  }

  /**
   * Gets all the Schema's Unit items as [[SchemaItemUnitProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a SchemaItemUnitProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getUnits(schema: string, context: SchemaContext): Promise<SchemaItemUnitProps[]> {
    return this.querySchemaItem<SchemaItemUnitProps>(context, schema, SchemaItemQueries.unit(true), "Unit");
  }

  /**
   * Gets all the Schema's InvertedUnit items as [[InvertedUnitProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a InvertedUnitProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getInvertedUnits(schema: string, context: SchemaContext): Promise<InvertedUnitProps[]> {
    return this.querySchemaItem<InvertedUnitProps>(context, schema, SchemaItemQueries.invertedUnit(true), "InvertedUnit");
  }

  /**
   * Gets all the Schema's Constant items as [[ConstantProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a ConstantProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getConstants(schema: string, context: SchemaContext): Promise<ConstantProps[]> {
    return this.querySchemaItem<ConstantProps>(context, schema, SchemaItemQueries.constant(true), "Constant");
  }

  /**
   * Gets all the Schema's UnitSystem items as [[UnitSystemProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a UnitSystemProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getUnitSystems(schema: string, context: SchemaContext): Promise<UnitSystemProps[]> {
    return this.querySchemaItem<UnitSystemProps>(context, schema, SchemaItemQueries.unitSystem(true), "UnitSystem");
  }

  /**
   * Gets all the Schema's Phenomenon items as [[PhenomenonProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a PhenomenonProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getPhenomenon(schema: string, context: SchemaContext): Promise<PhenomenonProps[]> {
    return this.querySchemaItem<PhenomenonProps>(context, schema, SchemaItemQueries.phenomenon(true), "Phenomenon");
  }

  /**
   * Gets all the Schema's Format items as [[SchemaItemFormatProps]] JSON objects.
   * @param schema The name of the Schema.
   * @param context The SchemaContext to which the schema belongs.
   * @returns A promise that resolves to a SchemaItemFormatProps array. Maybe empty if not items are found.
   * @internal
   */
  protected async getFormats(schema: string, context: SchemaContext): Promise<SchemaItemFormatProps[]> {
    return this.querySchemaItem<SchemaItemFormatProps>(context, schema, SchemaItemQueries.format(true), "Format");
  }

  /**
   * Gets [[SchemaInfo]] objects for all schemas including their direct schema references.
   * @internal
   */
  protected async loadSchemaInfos(): Promise<ReadonlyArray<SchemaInfo>> {
    const schemaRows = await this.executeQuery<SchemaInfoRow>(ecsqlQueries.schemaInfoQuery);
    return schemaRows.map((schemaRow) => (
      {
        alias: schemaRow.alias,
        description: schemaRow.description,
        label: schemaRow.label,
        schemaKey: SchemaKey.parseString(`${schemaRow.name}.${schemaRow.version}`),
        references: Array.from(JSON.parse(schemaRow.references), parseSchemaReference),
      }
    ));
  }

  /**
   * Gets the [[SchemaProps]] to create the basic schema skeleton. Depending on which options are set, the schema items or class hierarchy
   * can be included in the initial fetch.
   * @param schemaKey The [[SchemaKey]] of the schema to be resolved.
   * @returns A promise that resolves to the schema partials, which is an array of [[SchemaProps]].
   * @internal
   */
  protected async getSchemaPartials(schemaKey: SchemaKey, context: SchemaContext): Promise<ReadonlyArray<SchemaProps> | undefined> {
    const queryStart = Date.now();
    const itemRows = await this.executeQuery<SchemaStubRow>(ecsqlQueries.schemaStubQuery, {
       parameters: { schemaName: schemaKey.name }
    });

    const queryDuration = Date.now() - queryStart;
    Logger.logTrace(LOGGER_CATEGORY, `Recieved PartialSchema for ${schemaKey.name} in ${queryDuration}ms`, {
      schemaName: schemaKey.name,
      itemCount: itemRows.length,
      duration: queryDuration,
    });

    if (itemRows.length === 0)
      return undefined;

    const schemaPartials: Array<SchemaProps> = [];
    const addSchema = async (key: SchemaKey) => {
      const stub = await this.createSchemaProps(key, context);
      schemaPartials.push(stub);

      if (stub.references) {
        for (const referenceProps of stub.references) {
          if (!schemaPartials.some((schema) => schema.name === referenceProps.name)) {
            await addSchema(SchemaKey.parseString(`${referenceProps.name}.${referenceProps.version}`));
          }
        }
      }

      return stub;
    };

    const addItems = async (schemaName: string, itemInfo: SchemaItemInfo) => {
      let schemaStub = schemaPartials.find((schema) => schema.name === schemaName);
      if (!schemaStub) {
        schemaStub = await addSchema(SchemaKey.parseString(`${schemaName}.0.0.0`));
      }

      let items = schemaStub.items;
      if (!items) {
        Object.assign(schemaStub, items = { items: {} });
      }

      const existingItem = items[itemInfo.name] || {};
      Object.assign(items, { [itemInfo.name]: Object.assign(existingItem, itemInfo) });
    };

    const reviver = (_key: string, value: any) => {
      return value === null ? undefined : value;
    };

    await addSchema(schemaKey);

    const schemaInfos = await this._schemaInfoCache.getSchemasByContext(context) ?? [];
    const stubItems = itemRows.map((itemRow) => {
      return JSON.parse(itemRow.item, reviver) as SchemaItemStubRow;
    });
    await parseSchemaItemStubs(schemaKey.name, stubItems, addItems, schemaInfos);

    return schemaPartials;
  }

  private async querySchemaItem<TRow extends SchemaItemProps>(context: SchemaContext, schemaName: string, query: string, schemaType: string): Promise<Array<TRow>> {
    const start = Date.now();
    const itemRows = await this.executeQuery<SchemaItemRow>(query, { parameters: { schemaName } });

    const queryDuration = Date.now() - start;
    Logger.logTrace(LOGGER_CATEGORY, `Recieved rows of ${schemaType} items for ${schemaName} in ${queryDuration}ms`, {
      schemaName,
      itemCount: itemRows.length,
      itemType: schemaType,
      duration: queryDuration,
    });

    if (itemRows.length === 0)
      return [];

    const items = itemRows.map((itemRow: SchemaItemRow) => {
      return "string" === typeof itemRow.item ? JSON.parse(itemRow.item) : itemRow.item;
    });

    const schemaInfos = await this._schemaInfoCache.getSchemasByContext(context) ?? [];
    return await SchemaParser.parseSchemaItems(items, schemaName, schemaInfos) as Array<TRow> ?? []
  }

  private async getFullSchema(schemaKey: SchemaKey, context: SchemaContext): Promise<SchemaProps | undefined> {
    const schemaRows = await this.executeQuery<SchemaRow>(FullSchemaQueries.schemaQuery, { parameters: { schemaName: schemaKey.name } });
    const schemaRow = schemaRows[0];
    if (schemaRow === undefined)
      return undefined;

    const schema = {
      ... await this.createSchemaProps(schemaKey, context),
      ecSpecMajorVersion: schemaRow.ecSpecMajorVersion,
      ecSpecMinorVersion: schemaRow.ecSpecMinorVersion,
      customAttributes: JSON.parse(schemaRow.customAttributes),
      items: JSON.parse(schemaRow.items),
    };

    const schemaInfos = await this._schemaInfoCache.getSchemasByContext(context) ?? [];
    return SchemaParser.parse(schema, schemaInfos);
  }

  private async getFullSchemaMultipleQueries(schemaKey: SchemaKey, context: SchemaContext): Promise<SchemaProps | undefined> {
    const schema = await this.getSchemaNoItems(schemaKey, context) as MutableSchemaProps;
    if (!schema)
      return undefined;

    const items = schema.items || (schema.items = {});
    await Promise.all([
      this.getEntities(schemaKey.name, context),
      this.getMixins(schemaKey.name, context),
      this.getStructs(schemaKey.name, context),
      this.getRelationships(schemaKey.name, context),
      this.getCustomAttributeClasses(schemaKey.name, context),
      this.getKindOfQuantities(schemaKey.name, context),
      this.getPropertyCategories(schemaKey.name, context),
      this.getEnumerations(schemaKey.name, context),
      this.getUnits(schemaKey.name, context),
      this.getInvertedUnits(schemaKey.name, context),
      this.getUnitSystems(schemaKey.name, context),
      this.getConstants(schemaKey.name, context),
      this.getPhenomenon(schemaKey.name, context),
      this.getFormats(schemaKey.name, context)
    ]).then((itemResults) => {
      const flatItemList = itemResults.reduce((acc, result) => acc.concat(result));
      flatItemList.forEach((schemaItem) => {
        if(!schemaItem.name) {
          // This should never be happen, as we query the schema items by name from the database, but since the SchemaProps
          // have name optional, we need the check here to make the compiler happy.
          throw new Error(`SchemaItem with no name encountered in schema ${schemaKey.name}`);
        }
        items[schemaItem.name] = schemaItem;
      });
    });

    return schema;
  }
}

function parseSchemaReference(referenceName: string): WithSchemaKey {
  return { schemaKey: SchemaKey.parseString(referenceName) };
}

async function parseSchemaItemStubs(schemaName: string, itemRows: Array<SchemaItemStubRow>, addItemsHandler: AddSchemaItemHandler, schemaInfos: Iterable<SchemaInfo>) {
  if (!itemRows || itemRows.length === 0) {
    return;
  }

  const parseBaseClasses = async (baseClasses: Array<BaseClassStubRow> | undefined) => {
    if (!baseClasses || baseClasses.length < 2)
      return;

    for (let index = baseClasses.length - 1; index >= 0;) {
      const currentItem = baseClasses[index--];
      const baseClassItem = baseClasses[index];
      const baseClassName = baseClassItem ? `${baseClassItem.schema}.${baseClassItem.name}` : undefined;

      const schemaItem = await SchemaParser.parseItem(currentItem, currentItem.schema, schemaInfos);
      await addItemsHandler(currentItem.schema, {
        ...schemaItem,
        name: schemaItem.name,
        schemaItemType: schemaItem.schemaItemType,
        baseClass: baseClassName,
      });
    }
  };

  for (const itemRow of itemRows) {
    const schemaItem = await SchemaParser.parseItem(itemRow, schemaName, schemaInfos);
    await addItemsHandler(schemaName, {
      ...schemaItem,
      name: schemaItem.name,
      schemaItemType: schemaItem.schemaItemType,
      mixins: itemRow.mixins
        ? itemRow.mixins.map(mixin => { return `${mixin.schema}.${mixin.name}`; })
        : undefined,
    });

    await parseBaseClasses(itemRow.baseClasses);

    for (const mixinRow of itemRow.mixins || []) {
      const mixinItem = await SchemaParser.parseItem(mixinRow, mixinRow.schema, schemaInfos);
      await addItemsHandler(mixinRow.schema, {
        ...mixinItem,
        name: mixinItem.name,
        schemaItemType: mixinItem.schemaItemType,
      });
      await parseBaseClasses(mixinRow.baseClasses);
    }
  }
}
