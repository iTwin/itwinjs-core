/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import {
  Constant,
  Schema,
  SchemaContext,
  SchemaItemKey,
  SchemaKey,
  Unit,
} from "../ecschema-metadata";
import { isConstant, isUnit } from "./Helper";
import { LinearMap } from "./LinearMap";
import { Definition, parseDefinition } from "./Parser";
import { Graph } from "./Graph";

export class GraphUtils {
  /**
   * Traverse the _graph breadth first.
   * @param _graph Graph to be traversed
   * @param start start label to traverse from
   * @param keyFrom Get key from label, assuming that key can be constructed from the label itself.
   * @param op Reducing oepration on each label visited.
   * @param initial Initial value for the reduction purpose
   */
  public static bfsReduce<L, T>(
    _graph: Graph<L>,
    start: L,
    keyFrom: (label: L) => string,
    op: (previous: T, current: L) => [T, boolean],
    initial: T
  ): T {
    const key = keyFrom(start);
    // The node does not exist, return theinitial value
    if (!_graph.hasNode(key)) return initial;

    // Seed the queue with given node as root node
    const label = _graph.node(key) as L | undefined;
    if (undefined === label)
      throw new Error(
        "The node must have label stored, this should not happen"
      );

    let q = [label];
    let nq: L[] = [];
    let t = initial;
    while (q.length > 0) {
      // Visit each item in the queue.
      // In the process
      q.forEach((u) => {
        const [t1, b] = op(t, u);
        t = t1;
        if (!b) return;
        const k = keyFrom(u);
        const outs = _graph.outEdges(k);
        if (outs && outs.length > 0) {
          outs.forEach((kout) => {
            const l = _graph.node(kout.w);
            if (undefined === l)
              throw new Error(
                "The node must have label stored, this should not happen"
              );
            nq.push(l);
          });
        }
      });

      q = nq;
      nq = [];
    }
    return t;
  }

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

interface Label {
  label: string;
}
export class UnitGraph {
  private _graph = new Graph<Unit | Constant>();

  constructor(private _context: SchemaContext) {
    this._graph.setGraph("Unit tree processor");
  }

  public get length(): number {
    return this._graph.nodeCount();
  }

  public get cloneGraph() {
    const copy = new Graph<Label>();
    copy.setGraph(this._graph.graph());
    this._graph.nodes().forEach((n) => {
      const label = this._graph.node(n);
      if (label && (isConstant(label) || isUnit(label))) {
        const smap = LinearMap.from(label).toString();
        const slabel = `${label.fullName}\n${smap}`;
        copy.setNode(n, { label: slabel });
      }
    });
    this._graph.edges().forEach((e) => {
      const { exponent } = this._graph.edge(e.v, e.w);
      copy.setEdge(e.v, e.w, { exponent: exponent || 1 });
    });
    return copy;
  }

  public annotatedGraph(
    mpStore: Map<string, LinearMap>,
    tmpStore: Map<string, LinearMap>,
    fromStops: Set<string>,
    toStops: Set<string>
  ) {
    const clone = this.cloneGraph;
    mpStore.forEach((v, k) => {
      const { label } = clone.node(k);
      const fprefix = fromStops.has(k) ? "f" : "";
      const tprefix = toStops.has(k) ? "t" : "";
      const prefix = `*${fprefix}${tprefix}`;
      clone.setNode(k, { label: `${prefix} ${label}\nF${v.toString()}` });
    });
    tmpStore.forEach((v, k) => {
      const { label } = clone.node(k);
      clone.setNode(k, { label: `${label}\nT${v.toString()}` });
    });
    return clone;
  }

  public async resolveUnit(
    name: string,
    defaultSchema: Schema
  ): Promise<Unit | Constant> {
    const nameArr = name.split(":")
    if (nameArr.length > 1) {
      // Create schema key with schema name
      const schemaKey = new SchemaKey(nameArr[0])
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
        defaultSchema = schema
      }
      name = nameArr[1];
    }
    console.log(nameArr, defaultSchema.fullName)

    // Create schema item key with name and schema
    const itemKey = this.createSchemaItemKey(name, defaultSchema);  // Maybe use getSchemaItemKey in schema instead?
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
    if (isUnit(item) || isConstant(item)) return item;

    throw new BentleyError(
      BentleyStatus.ERROR,
      "Item is neither a unit or a constant",
      () => {
        return { itemType: item.key.fullName };
      }
    );
  }

  private createSchemaItemKey(name: string, defaultSchema: Schema) {
    if (name.includes(".")) {
      const [schemaName, unitName] = name.split(".");
      return new SchemaItemKey(unitName, new SchemaKey(schemaName));
    }
    return new SchemaItemKey(name, defaultSchema.schemaKey);
  }

  public async addUnit(unit: Unit | Constant): Promise<void> {
    if (this._graph.hasNode(unit.key.fullName)) return;

    this._graph.setNode(unit.key.fullName, unit);
    if (this.isIdentity(unit)) return;

    const umap = parseDefinition(unit.definition);

    const promiseArray: Promise<[Unit | Constant, Definition]>[] = [];
    for (const [key, value] of umap) {
      promiseArray.push(
        this.resolveUnit(key, unit.schema).then((u) => [u, value])
      );
    }
    const resolved = await Promise.all<[Unit | Constant, Definition]>(
      promiseArray
    );

    const children = resolved.map(async ([u, def]) => {
      await this.addUnit(u);
      // console.log(def);
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
   * Reduction via breadth first search
   * @param unit Unit or constant under observation
   * @param op   Operation that will be performed on each stored unit/constant, should work with previous value
   * @param initial Initial value.
   */
  public bfsReduce<T>(
    unit: Unit | Constant,
    op: (previous: T, current: Unit | Constant) => [T, boolean],
    initial: T
  ): T {
    return GraphUtils.bfsReduce(
      this._graph,
      unit,
      (c) => c.key.fullName,
      op,
      initial
    );
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
    const key = unit.key.fullName;
    const mpStore = new Map<string, LinearMap>();
    const mpStore1 = GraphUtils.dfsReduce(
      this._graph,
      key,
      (p, c) => {
        if (stopNodes.has(c)) {
          p.set(c, LinearMap.identity);
          return p;
        }
        const outEdges = this._graph.outEdges(c);
        if (outEdges) {
          const cmap = outEdges.reduce<LinearMap | undefined>((pm, e) => {
            const { exponent } = this._graph.edge(e.v, e.w);
            const exp = exponent ? exponent : 1;
            const stored = p.get(e.w);
            const map = stored ? stored : LinearMap.identity;
            const emap = map.raise(exp);
            return pm ? pm.multiply(emap) : emap;
          }, undefined);
          const thisMap = this._graph.node(c)
            ? LinearMap.from(this._graph.node(c))
            : LinearMap.identity;
          const other = cmap || LinearMap.identity;
          const result = other.compose(thisMap);
          p.set(c, result);
        } else {
          p.set(c, LinearMap.identity);
        }
        return p;
      },
      (c) => !stopNodes.has(c),
      mpStore
    );
    return mpStore1;
  }
}
