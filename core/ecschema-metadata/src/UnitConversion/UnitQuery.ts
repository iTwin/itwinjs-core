/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { Constant, Phenomenon, SchemaContext, SchemaItem, SchemaItemKey, SchemaKey, Unit } from "../ecschema-metadata";
import { SchemaItemType } from "../ECObjects";

export class UnitQuery {

  /**
   *
   * @param _context
   */
  constructor(private readonly _context: SchemaContext) {}

  /**
   *
   * @param unitName
   */
  async findUnitByName(unitName: string): Promise<Unit> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(unitName);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);

    if (!schema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for unit", () => {
        return { schema: schemaName, unit: unitName };
      });
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const item = await this._context.getSchemaItem(itemKey);
    if (!item)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item", () => {
        return { item: schemaItemName, schema: schemaName };
      });

    if (item.schemaItemType === SchemaItemType.Unit)
      return item as Unit;

    throw new BentleyError(BentleyStatus.ERROR, "Item is not a unit", () => {
      return { itemType: item.key.fullName };
    });
  }

  /**
   *
   * @param phenomenon
   */
  async findUnitByPhenomenon(phenomenon: string) {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(phenomenon);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);

    if (!schema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for phenomenon", () => {
        return { phenomenon, schema: schemaName };
      });
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const item = await this._context.getSchemaItem(itemKey);
    if (!item)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item", () => {
        return { item: schemaItemName, schema: schemaName };
      });

    if (item.schemaItemType !== SchemaItemType.Phenomenon)
      throw new BentleyError(BentleyStatus.ERROR, "Item is not a phenomenon", () => {
        return { itemType: item.key.fullName };
      });


  }
}