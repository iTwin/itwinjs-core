import { ECSqlQueryOptions, ECSqlSchemaLocater, ECSqlSchemaLocaterOptions, SchemaContext, SchemaKey, SchemaProps } from "@itwin/ecschema-metadata";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelDb } from "../../../IModelDb";

export class TestSqlSchemaLocater extends ECSqlSchemaLocater {
  private _iModel: IModelDb;

  public constructor(iModel: IModelDb, queryOptions?: ECSqlSchemaLocaterOptions) {
    super(queryOptions);
    this._iModel = iModel;
  }

  protected async executeQuery<TRow>(query: string, options?: ECSqlQueryOptions): Promise<ReadonlyArray<TRow>> {
    const queryParameters = options && options.parameters ? QueryBinder.from(options.parameters) : undefined;

    return this._iModel.createQueryReader(query, queryParameters, {
      rowFormat: QueryRowFormat.UseECSqlPropertyNames
    })
      .toArray();
  }
  protected async getSchemaProps(_schemaKey: SchemaKey): Promise<SchemaProps | undefined> {
    throw new Error("Method not implemented.");
  }

  // All of the following methods are protected. Through the override in this test locater, the methods can
  // be exposed public and used in tests for granular testing.
  public override async getSchemaJson(schemaKey: SchemaKey, context: SchemaContext) {
    return super.getSchemaJson(schemaKey, context);
  }
  public override async getConstants(schema: string, context: SchemaContext) {
    return super.getConstants(schema, context);
  }
  public override async getCustomAttributeClasses(schema: string, context: SchemaContext, queryOverride?: string) {
    return super.getCustomAttributeClasses(schema, context, queryOverride);
  }
  public override async getEntities(schema: string, context: SchemaContext, queryOverride?: string) {
    return super.getEntities(schema, context, queryOverride);
  }
  public override async getEnumerations(schema: string, context: SchemaContext) {
    return super.getEnumerations(schema, context);
  }
  public override async getFormats(schema: string, context: SchemaContext) {
    return super.getFormats(schema, context);
  }
  public override async getInvertedUnits(schema: string, context: SchemaContext) {
    return super.getInvertedUnits(schema, context);
  }
  public override async getKindOfQuantities(schema: string, context: SchemaContext) {
    return super.getKindOfQuantities(schema, context);
  }
  public override async getMixins(schema: string, context: SchemaContext, queryOverride?: string){
    return super.getMixins(schema, context, queryOverride);
  }
  public override async getPhenomenon(schema: string, context: SchemaContext) {
    return super.getPhenomenon(schema, context);
  }
  public override async getPropertyCategories(schema: string, context: SchemaContext) {
    return super.getPropertyCategories(schema, context);
  }
  public override async getRelationships(schema: string, context: SchemaContext) {
    return super.getRelationships(schema, context);
  }
  public override async getStructs(schema: string, context: SchemaContext) {
    return super.getStructs(schema, context);
  }
  public override async getUnits(schema: string, context: SchemaContext) {
    return super.getUnits(schema, context);
  }
  public override async getUnitSystems(schema: string, context: SchemaContext) {
    return super.getUnitSystems(schema, context);
  }
}
