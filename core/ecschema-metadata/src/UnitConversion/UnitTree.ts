/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import {
  Constant,
  Schema,
  SchemaContext,
  SchemaItem,
  SchemaItemKey,
  SchemaKey,
  Unit,
} from "../ecschema-metadata";
import { SchemaItemType } from "../ECObjects";
import { LinearMap } from "./LinearMap";
import { DefinitionFragment, parseDefinition } from "./Parser";
import { Graph } from "./Graph";

export class GraphUtils {
  /**
   * DFS traversal - Post order
   * @param _graph Graph to traverse
   * @param start Starting node
   * @param keyFrom Get key from label
   * @param op Reducing function
   * @param initial Initial label
   */
  public static dfsReduce<T>(
    _graph: Graph<Unit | Constant>,
    key: string,
    op: (previous: T, current: string) => T,
    visitChildren: (key: string) => boolean,
    initial: T
  ): T {
    const outEdges = _graph.outEdges(key);
    let t = initial;
    if (outEdges && visitChildren(key)) {
      t = outEdges.reduce<T>(
        (p, edge) => GraphUtils.dfsReduce(_graph, edge.w, op, visitChildren, p),
        t
      );
    }

    return op(t, key);
  }
}
export class UnitGraph {
  private _graph = new Graph<Unit | Constant>();

  constructor(private _context: SchemaContext) {
    this._graph.setGraph("Unit tree processor");
  }

  public get length(): number {
    return this._graph.nodeCount();
  }

  public async resolveUnit(
    name: string,
    defaultSchema: Schema
  ): Promise<Unit | Constant> {
    const nameArr = SchemaItem.parseFullName(name);
    if (nameArr[0] !== "") {
      // Check if it is alias or schemaName
      const ref = defaultSchema.getReferenceSync(nameArr[0]);
      const refName = defaultSchema.getReferenceNameByAlias(nameArr[0]);
      if (ref) {
        // Got schema by schemaName
        nameArr[0] = ref.name;
      } else if (refName) {
        // Got schema by alias
        nameArr[0] = refName;
      } else {
        // Didn't match any referenced schema, check if it is current schemaName or alias
        if (
          nameArr[0] === defaultSchema.name ||
          nameArr[0] === defaultSchema.alias
        )
          nameArr[0] = defaultSchema.name;
      }

      // Create schema key with schema name
      const schemaKey = new SchemaKey(nameArr[0]);
      // Get schema with schema key
      const schema = await this._context.getSchema(schemaKey);
      if (!schema) {
        throw new BentleyError(
          BentleyStatus.ERROR,
          "Cannot find schema",
          () => {
            return { schema: nameArr[0] };
          }
        );
      } else {
        defaultSchema = schema;
      }
      name = nameArr[1];
    }

    // Create schema item key with name and schema
    const itemKey = new SchemaItemKey(name, defaultSchema.schemaKey);
    // Get schema item with schema item key
    const item = await this._context.getSchemaItem(itemKey);
    if (!item)
      throw new BentleyError(
        BentleyStatus.ERROR,
        "Cannot find schema item",
        () => {
          return { item: name };
        }
      );
    if (
      item.schemaItemType === SchemaItemType.Unit ||
      item.schemaItemType === SchemaItemType.Constant
    )
      return item as Unit | Constant;

    throw new BentleyError(
      BentleyStatus.ERROR,
      "Item is neither a unit or a constant",
      () => {
        return { itemType: item.key.fullName };
      }
    );
  }

  public async addUnit(unit: Unit | Constant): Promise<void> {
    if (this._graph.hasNode(unit.key.fullName)) return;

    this._graph.setNode(unit.key.fullName, unit);
    if (this.isIdentity(unit)) return;

    const umap = parseDefinition(unit.definition);

    const promiseArray: Promise<[Unit | Constant, DefinitionFragment]>[] = [];
    for (const [key, value] of umap) {
      promiseArray.push(
        this.resolveUnit(key, unit.schema).then((u) => [u, value])
      );
    }
    const resolved = await Promise.all<[Unit | Constant, DefinitionFragment]>(
      promiseArray
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
  public reduce(
    unit: Unit | Constant,
    stopNodes: Set<string>
  ): Map<string, LinearMap> {
    const unitFullName = unit.key.fullName;
    const innerMapStore = new Map<string, LinearMap>();
    const outerMapStore = GraphUtils.dfsReduce(
      this._graph,
      unitFullName,
      (p, c) => this.reducingFunction(stopNodes, p, c),
      (c) => !stopNodes.has(c),
      innerMapStore
    );
    return outerMapStore;
  }

  private reducingFunction(
    stopNodes: Set<string>,
    innermapStore: Map<string, LinearMap>,
    unitFullName: string
  ) {
    if (stopNodes.has(unitFullName)) {
      innermapStore.set(unitFullName, LinearMap.identity);
      return innermapStore;
    }
    const outEdges = this._graph.outEdges(unitFullName);
    if (outEdges) {
      const cmap = outEdges.reduce<LinearMap | undefined>((pm, e) => {
        const { exponent } = this._graph.edge(e.v, e.w);
        const exp = exponent ? exponent : 1;
        const stored = innermapStore.get(e.w);
        const map = stored ? stored : LinearMap.identity;
        const emap = map.raise(exp);
        return pm ? pm.multiply(emap) : emap;
      }, undefined);
      const thisMap = this._graph.node(unitFullName)
        ? LinearMap.from(this._graph.node(unitFullName))
        : LinearMap.identity;
      const other = cmap || LinearMap.identity;
      const result = other.compose(thisMap);
      innermapStore.set(unitFullName, result);
    } else {
      innermapStore.set(unitFullName, LinearMap.identity);
    }
    return innermapStore;
  }
}
