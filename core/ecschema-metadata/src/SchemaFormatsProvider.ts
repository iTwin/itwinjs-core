import { ISchemaLocater, SchemaContext } from "./Context";
import { FormatsProvider } from "./Interfaces";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";
import { SchemaItem } from "./Metadata/SchemaItem";
import { Format } from "./Metadata/Format";
import { SchemaItemFormatProps } from "./Deserialization/JsonProps";

/**
 * @beta
 */
export class SchemaFormatsProvider implements FormatsProvider {
  private _context: SchemaContext;

  /**
   *
   * @param contextOrLocater The SchemaContext or a different ISchemaLocater implementation used to retrieve the schema. The SchemaContext
   * class implements the ISchemaLocater interface. If the provided locater is not a SchemaContext instance a new SchemaContext will be
   * created and the locater will be added.
   * @param _unitExtraData Additional data like alternate display label not found in Units Schema to match with Units; Defaults to empty array.
   */
  constructor(contextOrLocater: ISchemaLocater) {
    if (contextOrLocater instanceof SchemaContext) {
      this._context = contextOrLocater;
    } else {
      this._context = new SchemaContext();
      this._context.addLocater(contextOrLocater);
    }
  }

  /**
   *
   * @param id The full name of the Format.
   * @returns
   */
  public async getFormat(id: string): Promise<SchemaItemFormatProps | undefined> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(id);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);
    if (!schema) {
      return undefined;
    }
    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const format = await this._context.getSchemaItem(itemKey, Format);
    if (!format) {
      return undefined;
    }
    return format.toJSON(true);
  }

  public async getFormats(ids?: string[]): Promise<SchemaItemFormatProps[]> {
    if (!ids) {
      return []; // Should we try to query for all formats instead?
    }
    const formats: SchemaItemFormatProps[] = [];
    for (const id of ids) {
      const format = await this.getFormat(id);
      if (format) {
        formats.push(format);
      }
    }
    return formats;
  }
}
