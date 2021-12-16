/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { SchemaContext } from "../Context";
import { Constant } from "../Metadata/Constant";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Unit } from "../Metadata/Unit";
import { SchemaKey } from "../SchemaKey";
import { UnitConversion } from "./UnitConversion";
import { UnitGraph } from "./UnitTree";

/**
 * Class constructed with SchemaContext and used to calculate [[UnitConversion]] between Units
 * @alpha
 */
export class UnitConverter {
  private _uGraph: UnitGraph;

  /**
   * Create Converter context
   * @param _context SchemaContext with contexts added to it.
   */
  constructor(private readonly _context: SchemaContext) {
    this._uGraph = new UnitGraph(this._context);
  }

  /**
   * Find conversion between from and to units, formatted {schemaName}.{schemaItemName} or {schemaName}:{schemaItemName}
   * @param fromUnit SchemaItem full name of source unit
   * @param toUnit SchemaItem full name of target unit
   * @returns [[UnitConversion]] converting fromUnit -> toUnit with a factor and an offset
   * @throws Error if from and to Units' SchemaItem is not found in Schema or Schema prefix is not found in SchemaContext
   * @throws Error if from and to Units do not belong to the same phenomenon
   * @throws Error if definitions' SchemaItems cannot be found in its own or referenced Schemas
   * @throws Error if base units of source and target unit do not match
   */
  public async calculateConversion(fromUnit: string, toUnit: string): Promise<UnitConversion> {
    const [fromSchemaName, fromSchemaItemName] = SchemaItem.parseFullName(fromUnit);
    const [toSchemaName, toSchemaItemName] = SchemaItem.parseFullName(toUnit);
    const fromSchemaKey = new SchemaKey(fromSchemaName);
    const toSchemaKey = new SchemaKey(toSchemaName);

    const fromSchema = await this._context.getSchema(fromSchemaKey);
    const toSchema = await this._context.getSchema(toSchemaKey);

    if (!fromSchema || !toSchema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find from's and/or to's schema", () => {
        return { from: fromUnit, fromSchema: fromSchemaName, to: toUnit, toSchema: toSchemaName };
      });
    }

    const from = await this._uGraph.resolveUnit(fromSchemaItemName, fromSchema);
    const to = await this._uGraph.resolveUnit(toSchemaItemName, toSchema);

    return this.processUnits(from, to);
  }

  /**
   * @param from Source unit converted from
   * @param to Target unit converted to
   * @internal
   */
  private async processUnits(from: Unit | Constant, to: Unit | Constant): Promise<UnitConversion> {
    if (from.key.matches(to.key)) return UnitConversion.identity;

    const areCompatible = await Unit.areCompatible(from as Unit, to as Unit);
    if (!areCompatible)
      throw new BentleyError(BentleyStatus.ERROR, `Source and target units do not belong to same phenomenon`, () => {
        return { from, to };
      });

    // Add nodes and subsequent children to graph
    await this._uGraph.addUnit(from);
    await this._uGraph.addUnit(to);

    const fromBaseUnits = new Map<string, number>();
    const toBaseUnits = new Map<string, number>();
    // Calculate map of UnitConversions to get between from -> base
    const fromMapStore = this._uGraph.reduce(from, fromBaseUnits);
    // Calculate map of UnitConversions to get between base -> to
    const toMapStore = this._uGraph.reduce(to, toBaseUnits);

    if (!this.checkBaseUnitsMatch(fromBaseUnits, toBaseUnits))
      throw new BentleyError(BentleyStatus.ERROR, `Source and target units do not have matching base units`, () => {
        return { from, to };
      });

    // Final calculations to get singular UnitConversion between from -> to
    const fromMap = fromMapStore.get(from.key.fullName) || UnitConversion.identity;
    const toMap = toMapStore.get(to.key.fullName) || UnitConversion.identity;
    const fromInverse = fromMap.inverse();
    return fromInverse.compose(toMap);
  }

  /**
   * Check if fromBaseUnits's base units and exponents matches toBaseUnits's
   * @param fromBaseUnits Map of base units for source unit
   * @param toBaseUnits Map of base units for target unit
   * @internal
   */
  private checkBaseUnitsMatch(fromBaseUnits: Map<string, number>, toBaseUnits: Map<string, number>): boolean {
    // Trim maps of "One" and value that equal zero as they do not affect the base units and calculations
    for (const [key, value] of fromBaseUnits.entries()) {
      const [, schemaItemName] = SchemaItem.parseFullName(key);
      if (schemaItemName === "ONE" || value === 0) {
        fromBaseUnits.delete(key);
      }
    }

    for (const [key, value] of toBaseUnits.entries()) {
      const [, schemaItemName] = SchemaItem.parseFullName(key);
      if (schemaItemName === "ONE" || value === 0) {
        toBaseUnits.delete(key);
      }
    }

    if (fromBaseUnits.size !== toBaseUnits.size)
      return false;

    for (const key of fromBaseUnits.keys()) {
      if (!toBaseUnits.has(key) || fromBaseUnits.get(key) !== toBaseUnits.get(key)) {
        // Mismatching key or value
        return false;
      }
    }

    return true;
  }
}
