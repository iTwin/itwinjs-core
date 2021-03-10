/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { Constant, SchemaContext, SchemaKey, Unit } from "../ecschema-metadata";
import { UnitConversion } from "./UnitConversion";
import { UnitGraph } from "./UnitTree";

/**
 * Convertor function type. Given a unit magnitude in a source unit, return the converted magnitude of the target unit.
 */
export type ConvertorFunction = (from: number) => number;

/**
 * Convertor context is used to process unit conversion
 */
export class UnitConvertorContext {
  public static identity: (x: number) => number = (x) => x;

  private _uGraph: UnitGraph;

  /**
   * Create convertor context
   * @param _context SchemaContext with contexts added to it.
   * @alpha
   */
  constructor(private readonly _context: SchemaContext) {
    this._uGraph = new UnitGraph(this._context);
  }

  /**
   * Find conversion between from and to units/constants
   * @param from schema item name of source unit/constant
   * @param to schema item name of target unit/constant
   * @param fromSchema schema name which from belongs
   * @param toSchema schema name which to belongs
   * @alpha
   */
  public async findConversion(
    from: string,
    to: string,
    fromSchemaName: string,
    toSchemaName: string
  ): Promise<UnitConversion> {
    const fromSchemaKey = new SchemaKey(fromSchemaName);
    const toSchemaKey = new SchemaKey(toSchemaName);

    const fromSchema = await this._context.getSchema(fromSchemaKey);
    const toSchema = await this._context.getSchema(toSchemaKey);

    if (!fromSchema || !toSchema) {
      throw new BentleyError(
        BentleyStatus.ERROR,
        "Cannot find from's and/or to's schema",
        () => {
          return { fromSchema: fromSchemaName, toSchema: toSchemaName };
        }
      );
    }

    // Check if from and to are units or constants in the respective schemas
    const fromUnit = await this._uGraph.resolveUnit(from, fromSchema);
    const toUnit = await this._uGraph.resolveUnit(to, toSchema);

    return this.processUnits(fromUnit, toUnit);
  }

  /**
   * @param from source unit/constant converted from
   * @param to target unit/constant converted to
   * @return UnitConversion converting from -> to with a factor and an offset
   * @internal
   */
  private async processUnits(
    from: Unit | Constant,
    to: Unit | Constant
  ): Promise<UnitConversion> {
    if (from.key.matches(to.key)) return UnitConversion.identity;

    const fromPhenomenon = await from.phenomenon;
    const toPhenomenon = await to.phenomenon;

    // Check if their phenomenons have the same names
    if (
      !fromPhenomenon ||
      !toPhenomenon ||
      fromPhenomenon.key.name !== toPhenomenon.key.name
    )
      throw new BentleyError(
        BentleyStatus.ERROR,
        `Source and target units do not belong to same phenomenon`,
        () => {
          return { from, to };
        }
      );

    // Add nodes and subsequent children to graph
    await this._uGraph.addUnit(from);
    await this._uGraph.addUnit(to);

    // Calculate map of UnitConversions to get between from -> base
    const fromMapStore = this._uGraph.reduce(from, new Set<string>());
    // Calculate map of UnitConversions to get between base -> to
    const toMapStore = this._uGraph.reduce(to, new Set<string>());

    // Final calculations to get singular UnitConversion between from -> to
    const fromMap =
      fromMapStore.get(from.key.fullName) || UnitConversion.identity;
    const toMap = toMapStore.get(to.key.fullName) || UnitConversion.identity;
    const fromInverse = fromMap.inverse();
    return fromInverse.compose(toMap);
  }
}
