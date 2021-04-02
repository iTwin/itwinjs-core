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

  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Unit> {
    const findLabel = unitLabel.toLowerCase();
    const findSchema = schemaName ? schemaName.toLowerCase() : undefined;
    const findPhenomenon = phenomenon ? phenomenon.toLowerCase() : undefined;
    const findUnitSystem = unitSystem ? unitSystem.toLowerCase() : undefined;
    let foundUnit: Unit | undefined = undefined;

    try {
      try {
        foundUnit = await this.findUnitByDisplayLabel(findLabel, findSchema, findPhenomenon, findUnitSystem);
      } catch (err) {
        foundUnit = await this.findUnitByAltDisplayLabel(findLabel, findSchema, findPhenomenon, findUnitSystem);
      }
    } catch (err) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find unit with label", () => {
        return { unitLabel };
      });
    }

    return foundUnit;
  }

  private async findUnitByDisplayLabel(displayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Unit> {
    if (schemaName) {
      const schemaKey = new SchemaKey(schemaName);
      const schema = await this._context.getSchema(schemaKey);

      if (!schema)
        throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for display label", () => {
          return { schema: schemaName };
        });

      const schemaItems = schema.getItems();
      for (const schemaItem of schemaItems) {
        if (schemaItem.schemaItemType === SchemaItemType.Unit && schemaItem.label?.toLowerCase() === displayLabel) {
          // Check if unit's phenomenon and unitSystem matches params
          if (!phenomenon || schemaItem.phenomenon?.fullName.toLowerCase() === phenomenon) {
            if (!unitSystem || schemaItem.unitSystem?.fullName.toLowerCase() === unitSystem) {
              return schemaItem
            }
          }
        }
      }
    } else {
      let foundUnit: Unit | undefined = undefined;
      this._context.iterateSchemaItems((schemaItem) => {
        if (schemaItem.schemaItemType === SchemaItemType.Unit && schemaItem.label?.toLowerCase() === displayLabel) {
          // console.log(schemaItem.fullName, (schemaItem as Unit).phenomenon?.fullName);
          // Check if unit's phenomenon and unitSystem matches params
          if (!phenomenon || (schemaItem as Unit).phenomenon?.fullName.toLowerCase() === phenomenon) {
            if (!unitSystem || (schemaItem as Unit).unitSystem?.fullName.toLowerCase() === unitSystem) {
              foundUnit = schemaItem as Unit;
            }
          }
        }
      });
      if (foundUnit)
        return foundUnit;
    }

    throw new BentleyError(BentleyStatus.ERROR, "Cannot find unit with display label", () => {
      return { displayLabel };
    });
  }

  /**
   *
   * @param unitLabel
   * @param phenomenon
   * @param unitSystem
   */
  private async findUnitByAltDisplayLabel(altDisplayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Unit> {
    for (const entry of UNIT_DATA) {
      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref) => ref.toLowerCase() === altDisplayLabel) !== -1) {
          // Found altDisplayLabel that matches label to find
          const unit = await this.findUnitByName(entry.name);
          // Check if unit's schemaName, phenomenon and unitSystem matches params
          if (schemaName && unit.schema.name.toLowerCase() !== schemaName)
            continue;

          if (phenomenon && unit.phenomenon?.fullName.toLowerCase() !== phenomenon)
            continue;

          if (unitSystem && unit.unitSystem?.fullName.toLowerCase() !== unitSystem)
            continue;

          return unit;
        }
      }
    }

    throw new BentleyError(BentleyStatus.ERROR, "Cannot find unit with alternate display label", () => {
      return { altDisplayLabel };
    });
  }
}