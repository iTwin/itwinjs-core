/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { SchemaContext, SchemaItem, SchemaItemKey, SchemaKey, Unit } from "../ecschema-metadata";
import { SchemaItemType } from "../ECObjects";
import { UNIT_DATA } from "./UnitsData";

export class UnitQuery {
  /**
   *
   * @param _context
   */
  constructor(private readonly _context: SchemaContext) {}

  /**
   * Find unit in a schema that has unitName
   * @param unitName Full name of unit
   * @returns Unit whose full name matches unitName
   */
  public async findUnitByName(unitName: string): Promise<Unit> {
    // Check if schema exists and unit exists in schema
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
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item/unit", () => {
        return { item: schemaItemName, schema: schemaName };
      });

    if (item.schemaItemType === SchemaItemType.Unit)
      return item as Unit;

    throw new BentleyError(BentleyStatus.ERROR, "Item is not a unit", () => {
      return { itemType: item.key.fullName };
    });
  }

  /**
   * Find all units in context that belongs to given phenomenon
   * @param phenomenon Full name of phenomenon
   * @returns Array of units whose full name matches phenomenon param
   */
  public async findUnitsByPhenomenon(phenomenon: string): Promise<Array<Unit>> {
    // Check if schema exists and phenomenon exists in schema
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(phenomenon);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);

    if (!schema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for phenomenon", () => {
        return { phenomenon, schema: schemaName };
      });
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const phenom = await this._context.getSchemaItem(itemKey);
    if (!phenom)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item/phenomenon", () => {
        return { item: schemaItemName, schema: schemaName };
      });

    if (phenom.schemaItemType !== SchemaItemType.Phenomenon)
      throw new BentleyError(BentleyStatus.ERROR, "Item is not a phenomenon", () => {
        return { itemType: phenom.key.fullName };
      });

    // Filter out schema items to find units' full name that match given phenomenon param
    const filteredUnits: Array<Unit> = [];
    this._context.iterateSchemaItems((schemaItem) => {
      if (schemaItem.schemaItemType === SchemaItemType.Unit && (schemaItem as Unit).phenomenon?.fullName === phenomenon) {
        filteredUnits.push(schemaItem as Unit);
      }
    });

    return filteredUnits;
  }

  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Array<Unit>> {
    const labelToFind = unitLabel.toLowerCase();
    const unitPhenomToFind = phenomenon ? phenomenon.toLowerCase() : undefined;
    const unitSystemToFind = unitSystem ? unitSystem.toLowerCase() : undefined;

    const foundUnitsAltDisplayLabel = await this.findUnitsByAltDisplayLabel(labelToFind, unitPhenomToFind, unitSystemToFind);
    const foundUnitsDisplayLabel = await this.findUnitsByDisplayLabel(labelToFind, schemaName, unitPhenomToFind, unitSystemToFind);

    return foundUnitsAltDisplayLabel.concat(foundUnitsDisplayLabel);
  }

  public async findUnitsByDisplayLabel(displayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Array<Unit>> {
    const labelToFind = displayLabel.toLowerCase();
    const unitPhenomToFind = phenomenon ? phenomenon.toLowerCase() : undefined;
    const unitSystemToFind = unitSystem ? unitSystem.toLowerCase() : undefined;
    const foundUnits: Array<Unit> = [];

    if (schemaName) {
      const schemaKey = new SchemaKey(schemaName);
      const schema = await this._context.getSchema(schemaKey);

      if (!schema)
        throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for display label", () => {
          return { schema: schemaName };
        });

      const schemaItems = schema.getItems();
      for (const schemaItem of schemaItems) {
        if (schemaItem.schemaItemType === SchemaItemType.Unit && schemaItem.label?.toLowerCase() === labelToFind) {
          // Check if unit's phenomenon and unitSystem matches params
          if (!unitPhenomToFind || schemaItem.phenomenon?.fullName.toLowerCase() === unitPhenomToFind) {
            if (!unitSystemToFind || schemaItem.unitSystem?.fullName.toLowerCase() === unitSystemToFind) {
              console.log(schemaItem.fullName);
              foundUnits.push(schemaItem);
            }
          }
        }
      }
    } else {
      this._context.iterateSchemaItems((schemaItem) => {
        if (schemaItem.schemaItemType === SchemaItemType.Unit && schemaItem.label?.toLowerCase() === labelToFind) {
          // Check if unit's phenomenon and unitSystem matches params
          if (!unitPhenomToFind || (schemaItem as Unit).phenomenon?.fullName.toLowerCase() === unitPhenomToFind) {
            if (!unitSystemToFind || (schemaItem as Unit).unitSystem?.fullName.toLowerCase() === unitSystemToFind) {
              console.log(schemaItem.fullName);
              foundUnits.push(schemaItem as Unit);
            }
          }
        }
      });
    }
    return foundUnits;
  }

  /**
   *
   * @param unitLabel
   * @param phenomenon
   * @param unitSystem
   */
  public async findUnitsByAltDisplayLabel(altDisplayLabel: string, phenomenon?: string, unitSystem?: string): Promise<Array<Unit>> {
    const labelToFind = altDisplayLabel.toLowerCase();
    const unitPhenomToFind = phenomenon ? phenomenon.toLowerCase() : undefined;
    const unitSystemToFind = unitSystem ? unitSystem.toLowerCase() : undefined;
    const foundUnits: Array<Unit> = [];

    for (const entry of UNIT_DATA) {
      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref) => ref.toLowerCase() === labelToFind) !== -1) {
          // Found altDisplayLabel that matches label to find
          const unit = await this.findUnitByName(entry.name);
          // Check if unit's phenomenon and unitSystem matches params
          if (unitPhenomToFind && unit.phenomenon?.fullName.toLowerCase() !== unitPhenomToFind)
            continue;

          if (unitSystemToFind && unit.unitSystem?.fullName.toLowerCase() !== unitSystemToFind)
            continue;

          // console.log(unit.fullName)
          foundUnits.push(unit);
        }
      }
    }

    return foundUnits;
  }

}