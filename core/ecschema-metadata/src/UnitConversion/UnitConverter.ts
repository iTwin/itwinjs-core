/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { Constant, SchemaContext, SchemaItem, SchemaKey, Unit } from "../ecschema-metadata";
import { UnitConversion } from "./UnitConversion";
import { UnitGraph } from "./UnitTree";

/**
 * Converter context is used to process unit conversion
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
   * @param fromFullName SchemaItem full name of source unit
   * @param toFullName SchemaItem full name of target unit
   * @returns UnitConversion converting fromFullName -> toFullName with a factor and an offset
   * @throws Error if from and to Units' SchemaItem is not found in Schema or Schema prefix is not found in SchemaContext
   * @throws Error if from and to Units do not belong to the same phenomenon
   * @throws Error if definitions' SchemaItems cannot be found in its own or referenced Schemas
   */
  public async calculateConversion(fromFullName: string, toFullName: string): Promise<UnitConversion> {
    const [fromSchemaName, fromSchemaItemName] = SchemaItem.parseFullName(fromFullName);
    const [toSchemaName, toSchemaItemName] = SchemaItem.parseFullName(toFullName);
    const fromSchemaKey = new SchemaKey(fromSchemaName);
    const toSchemaKey = new SchemaKey(toSchemaName);

    const fromSchema = await this._context.getSchema(fromSchemaKey);
    const toSchema = await this._context.getSchema(toSchemaKey);

    if (!fromSchema || !toSchema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find from's and/or to's schema", () => {
        return { from: fromFullName, fromSchema: fromSchemaName, to: toFullName, toSchema: toSchemaName };
      });
    }

    const fromUnit = await this._uGraph.resolveUnit(fromSchemaItemName, fromSchema);
    const toUnit = await this._uGraph.resolveUnit(toSchemaItemName, toSchema);

    return this.processUnits(fromUnit, toUnit);
  }

  /**
   * @param from Source unit converted from
   * @param to Target unit converted to
   * @internal
   */
  private async processUnits(from: Unit | Constant, to: Unit | Constant): Promise<UnitConversion> {
    if (from.key.matches(to.key)) return UnitConversion.identity;

    const areCompatiblePhenomenons = await Unit.areCompatiblePhenomenons(from as Unit, to as Unit);
    if (!areCompatiblePhenomenons)
      throw new BentleyError(BentleyStatus.ERROR, `Source and target units do not belong to same phenomenon`, ()  => {
        return { from, to };
      });

    // Add nodes and subsequent children to graph
    await this._uGraph.addUnit(from);
    await this._uGraph.addUnit(to);

    // Calculate map of UnitConversions to get between from -> base
    const fromMapStore = this._uGraph.reduce(from, new Set<string>());
    // Calculate map of UnitConversions to get between base -> to
    const toMapStore = this._uGraph.reduce(to, new Set<string>());

    // Final calculations to get singular UnitConversion between from -> to
    const fromMap = fromMapStore.get(from.key.fullName) || UnitConversion.identity;
    const toMap = toMapStore.get(to.key.fullName) || UnitConversion.identity;
    const fromInverse = fromMap.inverse();
    return fromInverse.compose(toMap);
  }
}
