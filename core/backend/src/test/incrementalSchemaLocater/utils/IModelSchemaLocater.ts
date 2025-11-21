import { ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaInfo } from "@itwin/ecschema-metadata/lib/cjs/Interfaces";
import { IModelDb } from "../../../IModelDb";

export class IModelSchemaLocater implements ISchemaLocater  {
  private _iModel: IModelDb;

  public constructor(iModel: IModelDb) {
    this._iModel = iModel;
  }

  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
    await this.getSchemaInfo(schemaKey, matchType, context);

    const schema = await context.getCachedSchema(schemaKey, matchType);
    return schema as T;
  }

  public async getSchemaInfo(schemaKey: SchemaKey, _matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    try {
      const schemaJson = this._iModel.getSchemaProps(schemaKey.name);
      return await Schema.startLoadingFromJson(schemaJson, context);
    } catch(e: any){
      if (e.errorNumber === 65574)
        return undefined;
      throw e;
    }
  }

  public getSchemaSync(schemaKey: SchemaKey, _matchType: SchemaMatchType, context: SchemaContext): Schema | undefined {
    try {
      const schemaJson = this._iModel.getSchemaProps(schemaKey.name);
      const schema = Schema.fromJsonSync(schemaJson, context);
      return schema;
    } catch(e: any){
      if (e.errorNumber === 65574)
        return undefined;
      throw e;
    }
  }
}