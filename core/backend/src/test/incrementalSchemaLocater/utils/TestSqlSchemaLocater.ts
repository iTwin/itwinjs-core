import { ECSqlQueryOptions, ECSqlSchemaLocater, ECSqlSchemaLocaterOptions, SchemaKey, SchemaProps } from "@itwin/ecschema-metadata";
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
}