/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { SchemaContext } from "../Context";
import { SchemaItemType } from "../ECObjects";
import { Unit } from "../Metadata/Unit";
import { SchemaItemKey } from "../SchemaKey";
import { LinearMap } from "./linear-map";
import { UnitGraph } from "./unit-tree";

/**
 * Convertor function type. Given a unit magnitude in a source unit, return the converted magnitude of the target unit.
 */
export type ConvertorFunction = (from: number) => number;

/**
 * Convertor context is used to process unit conversion
 */
export class UnitConvertorContext {
  static identity: (x: number) => number = (x) => x;

  private _uGraph: UnitGraph;

  /**
   * Create convertor context
   * @param context SchemaContext with contexts added to it.
   */
  constructor(private readonly context: SchemaContext) {
    this._uGraph = new UnitGraph(this.context);
  }

  /**
   * Process source and target units.
   * @param from item key of source unit
   * @param to item key of target unit
   * @returns convertor function to convert source unit value to target unit
   */
  async processSchemaItem(
    from: SchemaItemKey,
    to: SchemaItemKey
  ): Promise<LinearMap> {
    const fromItem = await this.context.getSchemaItem(from);
    if (fromItem?.schemaItemType !== SchemaItemType.Unit)
      throw new BentleyError(
        BentleyStatus.ERROR,
        "Schema item is not a unit",
        () => {
          return { schemaItem: from };
        }
      );
    const toItem = await this.context.getSchemaItem(to);
    if (toItem?.schemaItemType !== SchemaItemType.Unit)
      throw new BentleyError(
        BentleyStatus.ERROR,
        "Schema item is not a unit",
        () => {
          return { schemaItem: to };
        }
      );

    return this.processUnits(fromItem as Unit, toItem as Unit);
  }

  async processUnits(from: Unit, to: Unit): Promise<LinearMap> {
    if (from.key.matches(to.key)) return LinearMap.Identity;

    const fromPhenomenon = await from.phenomenon;
    const toPhenomenon = await to.phenomenon;

    if (
      !fromPhenomenon ||
      !toPhenomenon ||
      !fromPhenomenon.key.matches(toPhenomenon.key)
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
    // Collect all the units reachable from to unit
    // const { fromUnits, toUnits } = ConvertorContext.commonDescendants(this._uGraph, to, from);

    const fromMapStore = this._uGraph.reduce(from, new Set<string>());
    const toMapStore = this._uGraph.reduce(to, new Set<string>());

    const fromMap = fromMapStore.get(from.key.fullName) || LinearMap.Identity;
    const toMap = toMapStore.get(to.key.fullName) || LinearMap.Identity;
    const fromInverse = fromMap.inverse();
    return fromInverse.compose(toMap);
  }

  // Find common descendants for both units in the graph
  // public static commonDescendants(
  //   uGraph: UnitGraph,
  //   to: Unit,
  //   from: Unit
  // ): { fromUnits: Set<string>; toUnits: Set<string> } {
  //   const toAllUnits = uGraph.bfsReduce(
  //     to,
  //     (p, c) => {
  //       p.add(c.key.fullName);
  //       return [p, true];
  //     },
  //     new Set<string>()
  //   );

  //   // Stop whenever we reach any unit reachable by to unit
  //   const fromUnits = uGraph.bfsReduce(
  //     from,
  //     (p, c) => {
  //       if (toAllUnits.has(c.key.fullName)) {
  //         p.add(c.key.fullName);
  //         return [p, false];
  //       }

  //       return [p, true];
  //     },
  //     new Set<string>()
  //   );

  //   // Now units in target that stops at the fromUnits
  //   const toUnits = uGraph.bfsReduce(
  //     from,
  //     (p, c) => {
  //       if (fromUnits.has(c.key.fullName)) {
  //         p.add(c.key.fullName);
  //         return [p, false];
  //       }
  //       return [p, true];
  //     },
  //     new Set<string>()
  //   );
  //   return { fromUnits, toUnits };
  // }
}
