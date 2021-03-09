/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import {
  SchemaContext,
  SchemaItemKey,
  SchemaItemType,
  Unit,
} from "../ecschema-metadata";
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
   */
  constructor(private readonly _context: SchemaContext) {
    this._uGraph = new UnitGraph(this._context);
  }

  /**
   * Process source and target units.
   * @param from item key of source unit
   * @param to item key of target unit
   * @returns convertor function to convert source unit value to target unit
   */
  public async processSchemaItem(
    from: SchemaItemKey,
    to: SchemaItemKey
  ): Promise<UnitConversion> {
    const fromItem = await this._context.getSchemaItem(from);
    if (
      fromItem?.schemaItemType !== SchemaItemType.Unit &&
      fromItem?.schemaItemType !== SchemaItemType.Constant
    )
      throw new BentleyError(
        BentleyStatus.ERROR,
        "Schema item is not a unit or a constant",
        () => {
          return { schemaItem: from };
        }
      );
    const toItem = await this._context.getSchemaItem(to);
    if (
      toItem?.schemaItemType !== SchemaItemType.Unit &&
      toItem?.schemaItemType !== SchemaItemType.Constant
    )
      throw new BentleyError(
        BentleyStatus.ERROR,
        "Schema item is not a unit or a constant",
        () => {
          return { schemaItem: to };
        }
      );

    return this.processUnits(fromItem as Unit, toItem as Unit);
  }

  public async processUnits(from: Unit, to: Unit): Promise<UnitConversion> {
    if (from.key.matches(to.key)) return UnitConversion.identity;

    const fromPhenomenon = await from.phenomenon;
    const toPhenomenon = await to.phenomenon;

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

    await this._uGraph.addUnit(from);
    await this._uGraph.addUnit(to);

    const fromMapStore = this._uGraph.reduce(from, new Set<string>());
    const toMapStore = this._uGraph.reduce(to, new Set<string>());

    const fromMap =
      fromMapStore.get(from.key.fullName) || UnitConversion.identity;
    const toMap = toMapStore.get(to.key.fullName) || UnitConversion.identity;
    const fromInverse = fromMap.inverse();
    return fromInverse.compose(toMap);
  }
}
