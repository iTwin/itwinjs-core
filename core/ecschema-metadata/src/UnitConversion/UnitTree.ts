/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { SchemaContext } from "../Context";
import { Constant } from "../Metadata/Constant";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Unit } from "../Metadata/Unit";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { SchemaItemType } from "../ECObjects";
import { UnitConversion } from "./UnitConversion";
import { DefinitionFragment, parseDefinition } from "./Parser";
import { Graph } from "./Graph";

/** @internal */
export class GraphUtils {
  /**
   * DFS traversal - Post order
   * @param _graph Graph to traverse
   * @param start Starting node
   * @param keyFrom Get key from label
   * @param op Reducing function
   * @param initial Initial label
   */
  public static dfsReduce<T>(_graph: Graph<Unit | Constant>, key: string, op: (previous: T, current: string) => T, initial: T, baseUnitsMap: Map<string, number>, accumulatedExponent: number): T {
    const outEdges = _graph.outEdges(key);
    let t = initial;
    if (outEdges.length > 0) {
      t = outEdges.reduce<T>(
        (p, edge) => {
          const { v, w } = edge;
          const edgeExponent = _graph.edge(v, w).exponent;
          return GraphUtils.dfsReduce(_graph, edge.w, op, p, baseUnitsMap, accumulatedExponent * edgeExponent);
        },
        t,
      );
    } else {
      if (baseUnitsMap.has(key)) {
        const oldExponent = baseUnitsMap.get(key)!;
        baseUnitsMap.set(key, oldExponent + accumulatedExponent);
      } else {
        baseUnitsMap.set(key, accumulatedExponent);
      }
    }

    return op(t, key);
  }
}

/** @internal */
export class UnitGraph {
  private _graph = new Graph<Unit | Constant>();
  private _unitsInProgress = new Map<string, Promise<void>>();

  constructor(private _context: SchemaContext) {
    this._graph.setGraph("Unit tree processor");
  }

  /**
   * Tries to find the unit/constant given by name in currentSchema
   * @param name SchemaItem name or parsed definition to find unit of; Could be {schemaName}:{schemaItemName} or {alias}:{schemaItemName} or {schemaItemName}
   * @param currentSchema schema to find name in; name could also be in a referenced schema of current schema
   */
  public async resolveUnit(name: string, currentSchema: Schema): Promise<Unit | Constant> {
    let [schemaName] = SchemaItem.parseFullName(name);
    const [, schemaItemName] = SchemaItem.parseFullName(name);

    if (schemaName !== "") {
      // Check if schemaName is schemaName or alias
      const ref = currentSchema.getReferenceSync(schemaName);
      const refName = currentSchema.getReferenceNameByAlias(schemaName);
      if (ref) {
        // Got schema by schemaName
        schemaName = ref.name;
      } else if (refName) {
        // Got schema by alias
        schemaName = refName;
      } else {
        // Didn't match any referenced schema, check if it is current schemaName or alias
        if (schemaName === currentSchema.name || schemaName === currentSchema.alias)
          schemaName = currentSchema.name;
      }

      // Create schema key with schema name
      const schemaKey = new SchemaKey(schemaName);
      // Get schema with schema key
      const schema = await this._context.getSchema(schemaKey);
      if (!schema) {
        throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema", () => {
          return { schema: schemaName };
        });
      } else {
        // Set currentSchema to look up schemaItem to be whatever is prefixed in name
        currentSchema = schema;
      }
      // Update name to not have prefix
      name = schemaItemName;
    }

    // Create schema item key with name and schema
    const itemKey = new SchemaItemKey(name, currentSchema.schemaKey);
    // Get schema item with schema item key
    const item = await this._context.getSchemaItem(itemKey);
    if (!item)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item", () => {
        return { item: name };
      });

    if (item.schemaItemType === SchemaItemType.Unit || item.schemaItemType === SchemaItemType.Constant)
      return item as Unit | Constant;

    throw new BentleyError(BentleyStatus.ERROR, "Item is neither a unit or a constant", () => {
      return { itemType: item.key.fullName };
    });
  }

  /**
   * Adds unit and corresponding children to graph as well as edges between units
   * @param unit Current unit to be added to graph
   */
  public async addUnit(unit: Unit | Constant): Promise<void> {
    if(this._unitsInProgress.has(unit.key.fullName))
      return this._unitsInProgress.get(unit.key.fullName);

    if (this._graph.hasNode(unit.key.fullName))
      return;

    this._graph.setNode(unit.key.fullName, unit);
    if (this.isIdentity(unit))
      return;

    const promise = this.addUnitToGraph(unit);
    this._unitsInProgress.set(unit.key.fullName, promise);

    await promise
      .finally(() => this._unitsInProgress.delete(unit.key.fullName));
  }

  private async addUnitToGraph(unit: Unit | Constant) {
    const umap = parseDefinition(unit.definition);

    const promiseArray: Promise<[Unit | Constant, DefinitionFragment]>[] = [];
    for (const [key, value] of umap) {
      promiseArray.push(
        this.resolveUnit(key, unit.schema).then((u) => [u, value]),
      );
    }
    const resolved = await Promise.all<[Unit | Constant, DefinitionFragment]>(
      promiseArray,
    );

    const children = resolved.map(async ([u, def]) => {
      await this.addUnit(u);
      this._graph.setEdge(unit.key.fullName, u.key.fullName, {
        exponent: def.exponent,
      });
    });

    await Promise.all(children);
  }

  private isIdentity(unit: Unit | Constant) {
    return unit.definition === unit.name;
  }

  /**
   * Reduce the tree to produce a single map
   * @param unit Unit to be processed
   * @param stopNodes The tree exploration should stop here
   */
  public reduce(unit: Unit | Constant, baseUnitsMap: Map<string, number>): Map<string, UnitConversion> {
    const unitFullName = unit.key.fullName;
    const innerMapStore = new Map<string, UnitConversion>();
    const outerMapStore = GraphUtils.dfsReduce(this._graph, unitFullName, (p, c) => this.reducingFunction(p, c), innerMapStore, baseUnitsMap, 1);
    return outerMapStore;
  }

  private reducingFunction(innermapStore: Map<string, UnitConversion>, unitFullName: string) {
    const outEdges = this._graph.outEdges(unitFullName);
    if (outEdges) {
      const cmap = outEdges.reduce<UnitConversion | undefined>((pm, e) => {
        const { exponent } = this._graph.edge(e.v, e.w);
        const stored = innermapStore.get(e.w);
        const map = stored ? stored : UnitConversion.identity;
        const emap = map.raise(exponent);
        return pm ? pm.multiply(emap) : emap;
      }, undefined);
      const thisMap = this._graph.node(unitFullName) ? UnitConversion.from(this._graph.node(unitFullName)) : UnitConversion.identity;
      const other = cmap || UnitConversion.identity;
      const result = other.compose(thisMap);
      innermapStore.set(unitFullName, result);
    } else {
      innermapStore.set(unitFullName, UnitConversion.identity);
    }
    return innermapStore;
  }
}
