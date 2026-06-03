import { BeEvent, DbResult, Guid, Id64String, IModelStatus, StopWatch } from "@itwin/core-bentley";
import { Code, ElementProps, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, IModelError, RelatedElement } from "@itwin/core-common";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SpatialCategory } from "../Category";
import { ClassRegistry } from "../ClassRegistry";
import { GeometricElement3d, OnElementDependencyArg, PhysicalPartition } from "../Element";
import { IModelDb, StandaloneDb } from "../IModelDb";
import { PhysicalModel } from "../Model";
import { SubjectOwnsPartitionElements } from "../NavigationRelationship";
import { ElementDrivesElement, ElementDrivesElementProps, OnDependencyArg } from "../Relationship";
import { Schema, Schemas } from "../Schema";
import { EditTxn } from "../EditTxn";
import { IModelTestUtils } from "./IModelTestUtils";
chai.use(chaiAsPromised);

function startTestTxn(iModelDb: IModelDb): EditTxn {
  const txn = new EditTxn(iModelDb, "element drives element test");
  txn.start();
  return txn;
}
/**
  1. What is Change Propagation?**
    In engineering, models often consist of many interdependent components (e.g., parts, assemblies, constraints). When you modify one component (say, changing a dimension), that change can affect other components.
    **Change propagation** is the process of updating all dependent components so the design remains consistent.

  2. Why Use Topological Sort?**
    The dependencies between components can be represented as a **Directed Acyclic Graph (DAG)**:
    - **Nodes** = components or features.
    - **Edges** = dependency relationships (e.g., "Feature B depends on Feature A").

    To propagate changes correctly:
    - You must update components **in dependency order** (parents before children).
    - This is where **topological sorting** comes in—it gives a linear order of nodes such that every dependency comes before the dependent.

  3. How It Works**
    **Steps:**
    1. **Build the dependency graph**:
      - For each feature/component, list what it depends on.
    2. **Perform topological sort**:
      - Use algorithms like **Kahn’s Algorithm** or **DFS-based sort**.
    3. **Propagate changes in sorted order**:
      - Start from nodes with no dependencies (roots).
      - Update each node, then move to its dependents.


  4. Example**
    Imagine a CAD model:
    - **Sketch → Extrude → Fillet → Hole**
    - If you change the **Sketch**, the **Extrude**, **Fillet**, and **Hole** must update in that order.

    Graph:
      Sketch → Extrude → Fillet → Hole
    Topological sort result:
      [Sketch, Extrude, Fillet, Hole]
    Update in this order to maintain consistency.

  5. Benefits**
  - Prevents circular updates (since DAG ensures no cycles).
  - Ensures deterministic and efficient update propagation.
  - Scales well for complex assemblies.
 */

enum Color {
  White, // unvisited
  Gray,  // visiting
  Black, // visited
}

export class Graph<T> {
  private _nodes: T[] = [];
  private _edges = new Map<T, T[]>();
  public constructor() {
  }

  public addNode(node: T): void {
    if (!this._nodes.includes(node))
      this._nodes.push(node);
  }

  public *nodes(): IterableIterator<T> {
    yield* this._nodes;
  }

  public *edges(): IterableIterator<{ from: T, to: T }> {
    for (const [from, toList] of this._edges.entries()) {
      for (const to of toList) {
        yield { from, to };
      }
    }
  }

  public addEdge(from: T, to: T | T[]): void {
    this.addNode(from);
    if (!this._edges.has(from)) {
      this._edges.set(from, []);
    }
    if (Array.isArray(to)) {
      to.forEach(t => this.addNode(t));
      this._edges.get(from)!.push(...to);
    } else {
      this.addNode(to);
      this._edges.get(from)!.push(to);
    }
  }
  public getEdges(node: T): T[] {
    if (!this._edges.has(node))
      return [];
    return this._edges.get(node)!;
  }
  public clone(): Graph<T> {
    const newGraph = new Graph<T>();
    for (const node of this._nodes) {
      newGraph.addNode(node);
    }
    for (const [from, toList] of this._edges.entries()) {
      newGraph.addEdge(from, toList);
    }
    return newGraph;
  }
  public toGraphvis(accessor: NodeAccessor<T>): string {
    // Implementation for converting the graph to Graphviz DOT format
    let dot = "digraph G {\n";
    for (const node of this._nodes) {
      dot += `  "${accessor.getId(node)}" [label="${accessor.getLabel(node)}"];\n`;
    }
    for (const [from, toList] of this._edges.entries()) {
      for (const to of toList) {
        dot += `  "${accessor.getId(from)}" -> "${accessor.getId(to)}";\n`;
      }
    }
    dot += "}\n";
    return dot;
  }
}
export interface NodeAccessor<T> {
  getLabel: (node: T) => string;
  getId: (node: T) => string;
}
export class TopologicalSorter {
  private static visit<T>(graph: Graph<T>, node: T, colors: Map<T, Color>, sorted: T[], failOnCycles: boolean): void {
    if (colors.get(node) === Color.Gray) {
      if (failOnCycles)
        throw new Error("Graph has a cycle");
      else {
        return;
      }
    }

    if (colors.get(node) === Color.White) {
      colors.set(node, Color.Gray);
      const neighbors = graph.getEdges(node);
      for (const neighbor of neighbors) {
        this.visit(graph, neighbor, colors, sorted, failOnCycles);
      }
      colors.set(node, Color.Black);
      sorted.push(node);
    }
  }

  public static sortDepthFirst<T>(graph: Graph<T>, updated?: T[], failOnCycles = true): T[] {
    const sorted: T[] = [];
    const colors = new Map(Array.from(graph.nodes()).map((node) => [node, Color.White]));
    if (updated) {
      // remove duplicate
      let filteredUpdated = Array.from(new Set(updated));
      filteredUpdated = filteredUpdated.filter(node => colors.get(node) === Color.White);
      if (filteredUpdated.length !== updated.length) {
        throw new Error("Updated list contains nodes that are not in the graph or have duplicates");
      }
      if (filteredUpdated.length === 0)
        updated = undefined;
      else
        updated = filteredUpdated;
    }
    for (const node of updated ?? Array.from(graph.nodes())) {
      if (colors.get(node) === Color.White) {
        this.visit(graph, node, colors, sorted, failOnCycles);
      }
    }

    return sorted.reverse();
  }
  public static sortBreadthFirst<T>(graph: Graph<T>, updated?: T[], failOnCycles = true): T[] {
    const sorted: T[] = [];
    const queue: T[] = [];
    // Vector to store indegree of each vertex
    const inDegree = new Map<T, number>();
    for (const node of graph.nodes()) {
      inDegree.set(node, 0);
    }
    for (const edge of graph.edges()) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    if (updated) {
      // remove duplicate
      const filteredUpdated = Array.from(new Set(updated));
      if (filteredUpdated.length !== updated.length) {
        throw new Error("Updated list contains nodes that are not in the graph or have duplicates");
      }
      if (filteredUpdated.length === 0)
        updated = undefined;
      else
        updated = filteredUpdated;
    }
    const startNodes = updated ?? Array.from(graph.nodes());
    for (const node of startNodes) {
      if (inDegree.get(node) === 0) {
        queue.push(node);
      }
    }
    if (startNodes.length === 0) {
      throw new Error("Graph has at least one cycle");
    }

    if (startNodes)
      while (queue.length > 0) {
        const current = queue.shift()!;
        sorted.push(current);

        for (const neighbor of graph.getEdges(current)) {
          inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
          if (inDegree.get(neighbor) === 0) {
            queue.push(neighbor);
          }
        }
      }
    if (failOnCycles && sorted.length !== Array.from(graph.nodes()).length)
      throw new Error("Graph has at least one cycle");

    return sorted;
  }
  public static validate<T>(graph: Graph<T>, sorted: T[]): boolean {
    if (sorted.length !== Array.from(graph.nodes()).length) {
      return false;
    }

    const position = new Map<T, number>();
    for (let i = 0; i < sorted.length; i++) {
      position.set(sorted[i], i);
    }

    for (const { from, to } of graph.edges()) {
      if (position.get(from)! > position.get(to)!) {
        return false;
      }
    }
    return true;
  }
}

class ElementDrivesElementEventMonitor {
  public readonly onRootChanged: [string, string][] = [];
  public readonly onAllInputsHandled: string[] = [];
  public readonly onBeforeOutputsHandled: string[] = [];
  public readonly onDeletedDependency: [string, string][] = [];
  constructor(public iModelDb: IModelDb) {
    InputDrivesOutput.events.onDeletedDependency.addListener((arg: OnDependencyArg) => this.onDeletedDependency.push([this.iModelDb.elements.tryGetElement<NodeElement>(arg.props.sourceId)?.userLabel as string, this.iModelDb.elements.tryGetElement<NodeElement>(arg.props.targetId)?.userLabel as string]));
    InputDrivesOutput.events.onRootChanged.addListener((arg: OnDependencyArg) => this.onRootChanged.push([this.iModelDb.elements.tryGetElement<NodeElement>(arg.props.sourceId)?.userLabel as string, this.iModelDb.elements.tryGetElement<NodeElement>(arg.props.targetId)?.userLabel as string]));
    NodeElement.events.onAllInputsHandled.addListener((arg: OnElementDependencyArg) => this.onAllInputsHandled.push(this.iModelDb.elements.tryGetElement<NodeElement>(arg.elId)?.userLabel as string));
    NodeElement.events.onBeforeOutputsHandled.addListener((arg: OnElementDependencyArg) => this.onBeforeOutputsHandled.push(this.iModelDb.elements.tryGetElement<NodeElement>(arg.elId)?.userLabel as string));
  }
  public clear() {
    this.onRootChanged.length = 0;
    this.onAllInputsHandled.length = 0;
    this.onBeforeOutputsHandled.length = 0;
    this.onDeletedDependency.length = 0;
  }
}
export interface InputDrivesOutputProps extends ElementDrivesElementProps {
  prop: number;
}

export interface NodeElementProps extends GeometricElement3dProps {
  op: string;
  val: number;
}

export class InputDrivesOutput extends ElementDrivesElement {
  public static readonly events = {
    onRootChanged: new BeEvent<(arg: OnDependencyArg) => void>(),
    onDeletedDependency: new BeEvent<(arg: OnDependencyArg) => void>(),
  };
  public static override get className(): string { return "InputDrivesOutput"; }
  protected constructor(props: InputDrivesOutputProps, iModel: IModelDb) {
    super(props, iModel);
  }
  public static override onRootChangedArg(arg: OnDependencyArg): void {
    this.events.onRootChanged.raiseEvent(arg);
  }
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    this.events.onDeletedDependency.raiseEvent(arg);
  }
}
export class NodeElement extends GeometricElement3d {
  public op: string;
  public val: number;
  public static readonly events = {
    onAllInputsHandled: new BeEvent<(arg: OnElementDependencyArg) => void>(),
    onBeforeOutputsHandled: new BeEvent<(arg: OnElementDependencyArg) => void>(),
  };

  public static override get className(): string { return "Node"; }
  protected constructor(props: NodeElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.op = props.op;
    this.val = props.val;
  }
  public override toJSON(): GeometricElement3dProps {
    const val = super.toJSON() as NodeElementProps;
    val.op = this.op;
    val.val = this.val;
    return val;
  }
  protected static override onAllInputsHandledArg(arg: OnElementDependencyArg): void {
    this.events.onAllInputsHandled.raiseEvent(arg);
  }
  protected static override onBeforeOutputsHandledArg(arg: OnElementDependencyArg): void {
    this.events.onBeforeOutputsHandled.raiseEvent(arg);
  }
  public static generateGeometry(radius: number): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();
    const p1 = Point3d.createZero();
    const p2 = Point3d.createFrom({ x: radius, y: 0.0, z: 0.0 });
    const circle = LineSegment3d.create(p1, p2);
    builder.appendGeometry(circle);
    return builder.geometryStream;
  }
  public static getCategory(iModelDb: IModelDb) {
    const categoryId = SpatialCategory.queryCategoryIdByName(iModelDb, IModelDb.dictionaryId, this.classFullName);
    if (categoryId === undefined)
      throw new IModelError(IModelStatus.NotFound, "Category not found");
    return iModelDb.elements.getElement(categoryId);
  }
}

export class NetworkSchema extends Schema {
  public static override get schemaName(): string { return "Network"; }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(NetworkSchema.schemaName)) {
      Schemas.registerSchema(this);
      ClassRegistry.register(NodeElement, this);
      ClassRegistry.register(InputDrivesOutput, this);
    }
  }

  public static async importSchema(iModel: IModelDb): Promise<void> {
    if (iModel.querySchemaVersion("Network"))
      return;

    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="Network" alias="net" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECEntityClass typeName="Node">
                <BaseClass>bis:GraphicalElement3d</BaseClass>
                <ECProperty propertyName="op" typeName="string" />
                <ECProperty propertyName="val" typeName="double" />
            </ECEntityClass>
            <ECRelationshipClass typeName="InputDrivesOutput" modifier="None" strength="referencing">
                <BaseClass>bis:ElementDrivesElement</BaseClass>
                <Source multiplicity="(0..1)" roleLabel="drives" polymorphic="true">
                    <Class class="Node"/>
                </Source>
                <Target multiplicity="(0..*)" roleLabel="is driven by" polymorphic="false">
                    <Class class="Node"/>
                </Target>
                <ECProperty propertyName="prop" typeName="double" />
            </ECRelationshipClass>
        </ECSchema>`;
    await iModel.importSchemaStrings([schema1]);
  }
}

export class Engine {
  public static async createGraph(txn: EditTxn, modelId: Id64String, graph: Graph<string>): Promise<Graph<{ id: Id64String, name: string }>> {
    const nodes = new Map<string, { id: Id64String, name: string }>();
    const outGraph = new Graph<{ id: Id64String, name: string }>();
    for (const node of graph.nodes()) {
      const id = await this.insertNode(txn, modelId, node, "", 0, new Point3d(0, 0, 0));
      nodes.set(node, { id, name: node });
    }
    for (const edge of graph.edges()) {
      const fromId = nodes.get(edge.from)!.id;
      const toId = nodes.get(edge.to)!.id;
      await this.insertEdge(txn, fromId, toId, 0);
      outGraph.addEdge(nodes.get(edge.from)!, nodes.get(edge.to)!);
    }
    return outGraph;
  }
  public static countNodes(iModelDb: IModelDb): number {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return iModelDb.withPreparedStatement("SELECT COUNT(*) FROM Network.Node", (stmt) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return stmt.getValue(0).getInteger();
      }
      return 0;
    });
  }
  public static countEdges(iModelDb: IModelDb): number {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return iModelDb.withPreparedStatement("SELECT COUNT(*) FROM [Network].[InputDrivesOutput]", (stmt) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return stmt.getValue(0).getInteger();
      }
      return 0;
    });
  }
  public static queryEdgesForSource(iModelDb: IModelDb, sourceId: Id64String): InputDrivesOutputProps[] {
    const edges: InputDrivesOutputProps[] = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModelDb.withPreparedStatement("SELECT [ECInstanceId], [SourceECInstanceId], [TargetECInstanceId], [prop], [Status], [Priority] FROM [Network].[InputDrivesOutput] WHERE [SourceECInstanceId] = ?", (stmt) => {
      stmt.bindId(1, sourceId);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        edges.push({
          id: stmt.getValue(0).getId(),
          classFullName: InputDrivesOutput.classFullName,
          sourceId: stmt.getValue(1).getId(),
          targetId: stmt.getValue(2).getId(),
          prop: stmt.getValue(3).getDouble(),
          status: stmt.getValue(4).getInteger(),
          priority: stmt.getValue(5).getInteger(),
        });
      }
    });
    return edges;
  }
  public static queryEdgesForTarget(iModelDb: IModelDb, targetId: Id64String): InputDrivesOutputProps[] {
    const edges: InputDrivesOutputProps[] = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModelDb.withPreparedStatement("SELECT [ECInstanceId], [SourceECInstanceId], [TargetECInstanceId], [prop], [Status], [Priority] FROM [Network].[InputDrivesOutput] WHERE [TargetECInstanceId] = ?", (stmt) => {
      stmt.bindId(1, targetId);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        edges.push({
          id: stmt.getValue(0).getId(),
          classFullName: InputDrivesOutput.classFullName,
          sourceId: stmt.getValue(1).getId(),
          targetId: stmt.getValue(2).getId(),
          prop: stmt.getValue(3).getDouble(),
          status: stmt.getValue(4).getInteger(),
          priority: stmt.getValue(5).getInteger(),
        });
      }
    });
    return edges;
  }
  private static async createPartition(txn: EditTxn): Promise<Id64String> {
    const iModelDb = txn.iModel;
    const parentId = new SubjectOwnsPartitionElements(IModel.rootSubjectId);
    const modelId = IModel.repositoryModelId;
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent: parentId,
      model: modelId,
      code: Code.createEmpty(),
      userLabel: "NetworkPhysicalPartition"
    };
    const modeledElement = iModelDb.elements.createElement(modeledElementProps);
    await iModelDb.locks.acquireLocks({ shared: modelId });
    return txn.insertElement(modeledElement.toJSON());
  }
  private static async createModel(txn: EditTxn): Promise<Id64String> {
    const iModelDb = txn.iModel;
    const partitionId = await this.createPartition(txn);
    const modeledElementRef = new RelatedElement({ id: partitionId });
    const newModel = iModelDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName });
    const newModelId = txn.insertModel(newModel.toJSON());
    return newModelId;
  }
  private static async createNodeCategory(txn: EditTxn) {
    const iModelDb = txn.iModel;
    const category = SpatialCategory.create(iModelDb, IModelDb.dictionaryId, NodeElement.classFullName);
    return txn.insertElement(category.toJSON());
  }
  public static async initialize(txn: EditTxn) {
    await NetworkSchema.importSchema(txn.iModel);
    NetworkSchema.registerSchema();
    const modelId = await this.createModel(txn);
    const categoryId = await this.createNodeCategory(txn);
    return {
      modelId,
      categoryId,
    };
  }
  public static async insertNode(txn: EditTxn, modelId: Id64String, name: string, op: string, val: number, location: Point3d, radius: number = 0.1) {
    const iModelDb = txn.iModel;
    const props: NodeElementProps = {
      classFullName: NodeElement.classFullName,
      model: modelId,
      code: Code.createEmpty(),
      userLabel: name,
      category: NodeElement.getCategory(iModelDb).id,
      placement: { origin: location, angles: new YawPitchRollAngles() },
      geom: NodeElement.generateGeometry(radius),
      op,
      val,
    };
    await iModelDb.locks.acquireLocks({ shared: modelId });
    return txn.insertElement(props);
  }
  public static async deleteNode(txn: EditTxn, nodeId: Id64String) {
    const iModelDb = txn.iModel;
    await iModelDb.locks.acquireLocks({ exclusive: nodeId });
    return txn.deleteElement(nodeId);
  }
  public static async updateNodeProps(txn: EditTxn, props: Partial<NodeElementProps>) {
    const iModelDb = txn.iModel;
    await iModelDb.locks.acquireLocks({ exclusive: props.id });
    return txn.updateElement(props);
  }
  public static async updateNode(txn: EditTxn, userLabel: string) {
    const iModelDb = txn.iModel;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const id = iModelDb.withPreparedStatement("SELECT [ECInstanceId] FROM [Network].[Node] WHERE [UserLabel] = ?", (stmt) => {
      stmt.bindString(1, userLabel);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        return stmt.getValue(0).getId();
      return undefined;
    });
    if (!id) {
      throw new Error(`Node with userLabel ${userLabel} not found`);
    }
    await this.updateNodeProps(txn, { id });
  }
  public static async deleteEdge(txn: EditTxn, from: string, to: string) {
    const iModelDb = txn.iModel;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const edge = iModelDb.withPreparedStatement(`
      SELECT [IDo].[ECInstanceId], [IDo].[SourceECInstanceId], [IDo].[TargetECInstanceId]
      FROM [Network].[InputDrivesOutput] [IDo]
      JOIN [Network].[Node] [Src] ON [Src].[ECInstanceId] = [IDo].[SourceECInstanceId]
      JOIN [Network].[Node] [Tgt] ON [Tgt].[ECInstanceId] = [IDo].[TargetECInstanceId]
      WHERE [Src].[UserLabel] = ? AND [Tgt].[UserLabel] = ?`, (stmt) => {
      stmt.bindString(1, from);
      stmt.bindString(2, to);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        return {
          id: stmt.getValue(0).getId(),
          classFullName: InputDrivesOutput.classFullName,
          sourceId: stmt.getValue(1).getId(),
          targetId: stmt.getValue(2).getId(),
        };
      return undefined;
    });
    if (!edge) {
      throw new Error(`Edge from ${from} to ${to} not found`);
    }
    txn.deleteRelationship(edge);
  }
  public static async insertEdge(txn: EditTxn, sourceId: Id64String, targetId: Id64String, prop: number) {
    const props: InputDrivesOutputProps = {
      classFullName: InputDrivesOutput.classFullName,
      sourceId,
      targetId,
      prop,
      status: 0,
      priority: 0
    };
    return txn.insertRelationship(props);
  }
}

describe("ElementDrivesElement Tests", () => {
  const iModels: StandaloneDb[] = [];
  let testTxn: EditTxn | undefined;
  async function openIModel(): Promise<StandaloneDb> {
    const iModelDb = StandaloneDb.createEmpty(
      IModelTestUtils.prepareOutputFile("ElementDrivesElement", `${Guid.createValue()}.bim`),
      { rootSubject: { name: "ElementDrivesElementTest" }, enableTransactions: true }
    );
    const txn = new EditTxn(iModelDb, "open iModel initialization");
    txn.start();
    txn.end();
    iModels.push(iModelDb);
    return iModelDb;
  }
  afterEach(async () => {
    NodeElement.events.onAllInputsHandled.clear();
    NodeElement.events.onBeforeOutputsHandled.clear();
    InputDrivesOutput.events.onRootChanged.clear();
    InputDrivesOutput.events.onDeletedDependency.clear();
    if (testTxn?.isActive)
      testTxn.end("abandon");

    testTxn = undefined;
    for (const iModel of iModels)
      iModel.close();

    iModels.length = 0;
  });
  it("local: topological sort", async () => {
    const graph = new Graph<string>();

    graph.addEdge("1", ["2", "3"]);
    graph.addEdge("2", ["5", "4"]);
    graph.addEdge("3", ["4"]);
    graph.addEdge("4", ["5"]);
    const df = TopologicalSorter.sortDepthFirst(graph);
    chai.expect(TopologicalSorter.validate(graph, df)).to.be.true;
    chai.expect(df).to.deep.equal(["1", "3", "2", "4", "5"]);

    const bf = TopologicalSorter.sortBreadthFirst(graph);
    chai.expect(TopologicalSorter.validate(graph, bf)).to.be.true;
    chai.expect(bf).to.deep.equal(["1", "2", "3", "4", "5"]);
  });

  it("local: cycle detection (suppress cycles)", async () => {
    const graph = new Graph<string>();
    // Graph structure:
    // 1 --> 2 <-- 3
    // ^           |
    // |-----------|
    graph.addEdge("1", ["2"]);
    graph.addEdge("2", ["3"]);
    graph.addEdge("3", ["1"]);

    const df = TopologicalSorter.sortDepthFirst(graph, [], false);
    chai.expect(TopologicalSorter.validate(graph, df)).to.be.false;
    chai.expect(df).to.deep.equal(["1", "2", "3"]);
  });
  it("local: cycle detection (throw)", async () => {
    const graph = new Graph<string>();
    // Graph structure:
    // 1 --> 2 --> 3
    // ^           |
    // |-----------|
    graph.addEdge("1", ["2"]);
    graph.addEdge("2", ["3"]);
    graph.addEdge("3", ["1"]);

    chai.expect(() => TopologicalSorter.sortDepthFirst(graph)).to.throw(
      "Graph has a cycle"
    );
  });
  it("EDE/local: build system dependencies", async () => {
    const graph = new Graph<string>();
    /*
      Example: Build system dependencies

      - Compile main.c and util.c to main.o and util.o
      - Link main.o and util.o to produce app.exe
      - app.exe depends on config.json
      - test.exe depends on main.o, util.o, and test.c

      Graph:
        main.c   util.c   test.c   config.json
          |        |        |           |
          v        v        |           |
        main.o   util.o     |           |
          \      /          |           |
            \  /            |           |
           app.exe        test.exe      |
             |                |         |
             +----------------+---------+
    */

    graph.addEdge("main.c", ["main.o"]);
    graph.addEdge("util.c", ["util.o"]);
    graph.addEdge("test.c", ["test.exe"]);
    graph.addEdge("main.o", ["app.exe", "test.exe"]);
    graph.addEdge("util.o", ["app.exe", "test.exe"]);
    graph.addEdge("config.json", ["app.exe", "test.exe"]);


    // create graph
    const b1 = await openIModel();
    const txn = testTxn = startTestTxn(b1);
    const { modelId, } = await Engine.initialize(txn);
    const monitor = new ElementDrivesElementEventMonitor(b1);
    await Engine.createGraph(txn, modelId, graph);
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([
      ["main.c", "main.o"],
      ["main.o", "test.exe"],
      ["main.o", "app.exe"],
      ["util.c", "util.o"],
      ["util.o", "test.exe"],
      ["util.o", "app.exe"],
      ["test.c", "test.exe"],
      ["config.json", "test.exe"],
      ["config.json", "app.exe"],
    ]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["main.o", "util.o", "test.exe", "app.exe"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal(["main.c", "util.c", "test.c", "config.json"]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);

    // update main.c
    monitor.clear();
    await Engine.updateNode(txn, "main.c");
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([
      ["main.c", "main.o"],
      ["main.o", "test.exe"],
      ["main.o", "app.exe"],
    ]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["main.o", "test.exe", "app.exe"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal(["main.c"]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);

    // Topological sort (depth-first)
    const df = TopologicalSorter.sortDepthFirst(graph);
    chai.expect(TopologicalSorter.validate(graph, df)).to.be.true;

    // Topological sort (breadth-first)
    const bf = TopologicalSorter.sortBreadthFirst(graph);
    chai.expect(TopologicalSorter.validate(graph, bf)).to.be.true;
    chai.expect(df).to.deep.equal(["config.json", "test.c", "util.c", "util.o", "main.c", "main.o", "test.exe", "app.exe"]);
    chai.expect(bf).to.deep.equal(["main.c", "util.c", "test.c", "config.json", "main.o", "util.o", "app.exe", "test.exe"]);
  });
  it("EDE/local: complex, subset", async () => {
    const graph = new Graph<string>();
    /*
    Graph shows what must be put on before other items:
    - Socks before Shoes
    - Underwear before Shoes and Pants
    - Pants before Belt and Shoes
    - Shirt before Belt and Tie
    - Tie before Jacket
    - Belt before Jacket
    - Watch has no dependencies
    */

    graph.addEdge("Socks", ["Shoes"]);
    graph.addEdge("Underwear", ["Shoes", "Pants"]);
    graph.addEdge("Pants", ["Belt", "Shoes"]);
    graph.addEdge("Shirt", ["Belt", "Tie"]);
    graph.addEdge("Tie", ["Jacket"]);
    graph.addEdge("Belt", ["Jacket"]);
    graph.addNode("Watch");

    // Test using EDE
    const b1 = await openIModel();
    const txn = testTxn = startTestTxn(b1);
    const { modelId, } = await Engine.initialize(txn);
    const monitor = new ElementDrivesElementEventMonitor(b1);
    await Engine.createGraph(txn, modelId, graph);
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([
      ["Socks", "Shoes"],
      ["Underwear", "Shoes"],
      ["Underwear", "Pants"],
      ["Pants", "Shoes"],
      ["Pants", "Belt"],
      ["Shirt", "Belt"],
      ["Belt", "Jacket"],
      ["Shirt", "Tie"],
      ["Tie", "Jacket"]
    ]);

    // Watch is missing as it is not connected to any other node.
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["Pants", "Shoes", "Belt", "Tie", "Jacket"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal(["Socks", "Underwear", "Shirt"]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);

    monitor.clear();
    await Engine.updateNode(txn, "Socks");
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([["Socks", "Shoes"]]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["Shoes"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal(["Socks"]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);

    const sorted = TopologicalSorter.sortDepthFirst(graph);
    chai.expect(TopologicalSorter.validate(graph, sorted)).to.be.true;
    chai.expect(sorted).to.deep.equal(["Watch", "Shirt", "Tie", "Underwear", "Pants", "Belt", "Jacket", "Socks", "Shoes"]);

    // Test sorting with a subset of nodes
    const sorted1 = TopologicalSorter.sortDepthFirst(graph, ["Underwear"]);
    chai.expect(sorted1).to.deep.equal(["Underwear", "Pants", "Belt", "Jacket", "Shoes"]);

    const sorted2 = TopologicalSorter.sortDepthFirst(graph, ["Belt"]);
    chai.expect(sorted2).to.deep.equal(["Belt", "Jacket"]);

    const sorted3 = TopologicalSorter.sortDepthFirst(graph, ["Shoes"]);
    chai.expect(sorted3).to.deep.equal(["Shoes"]);

    const sorted4 = TopologicalSorter.sortDepthFirst(graph, ["Socks"]);
    chai.expect(sorted4).to.deep.equal(["Socks", "Shoes"]);

    const sorted5 = TopologicalSorter.sortDepthFirst(graph, ["Tie"]);
    chai.expect(sorted5).to.deep.equal(["Tie", "Jacket"]);

    const sorted6 = TopologicalSorter.sortDepthFirst(graph, ["Jacket"]);
    chai.expect(sorted6).to.deep.equal(["Jacket"]);

    const sorted7 = TopologicalSorter.sortDepthFirst(graph, ["Shirt"]);
    chai.expect(sorted7).to.deep.equal(["Shirt", "Tie", "Belt", "Jacket"]);

    const sorted8 = TopologicalSorter.sortDepthFirst(graph, ["Watch"]);
    chai.expect(sorted8).to.deep.equal(["Watch"]);
  });

  it("EDE: basic graph operations", async () => {
    const b1 = await openIModel();
    const txn = testTxn = startTestTxn(b1);
    const { modelId, } = await Engine.initialize(txn);
    const graph = new Graph<string>();

    // Graph structure:
    //   A
    //  / \
    // B   C
    // |\  /
    // | \/
    // E--D
    graph.addEdge("A", ["B", "C"]);
    graph.addEdge("B", ["E", "D"]);
    graph.addEdge("C", ["D"]);
    graph.addEdge("D", ["E"]);
    const monitor = new ElementDrivesElementEventMonitor(b1);

    // create a network
    await Engine.createGraph(txn, modelId, graph);
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([
      ["A", "B"],
      ["A", "C"],
      ["B", "E"],
      ["B", "D"],
      ["C", "D"],
      ["D", "E"]]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["B", "C", "D", "E"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal(["A"]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);
    monitor.clear();

    // update a node in network
    await Engine.updateNode(txn, "B");
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([
      ["B", "E"],
      ["B", "D"],
      ["D", "E"]]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["D", "E"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal(["B"]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);
    monitor.clear();

    // delete edge in network
    await Engine.deleteEdge(txn, "B", "E");
    txn.saveChanges();
    chai.expect(monitor.onRootChanged).to.deep.equal([]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal([]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal([]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([["B", "E"]]);
  });
  it("EDE: cyclical throw exception", async () => {
    const b1 = await openIModel();
    const txn = testTxn = startTestTxn(b1);
    const { modelId, } = await Engine.initialize(txn);
    const graph = new Graph<string>();
    // Graph structure with a cycle:
    //   A
    //  / \
    // B - C

    graph.addEdge("A", ["B"]);
    graph.addEdge("B", ["C"]);
    graph.addEdge("C", ["A"]);

    const monitor = new ElementDrivesElementEventMonitor(b1);
    // create a network
    await Engine.createGraph(txn, modelId, graph);
    chai.expect(() => txn.saveChanges()).to.throw("Could not save changes due to propagation failure.");
    txn.end("abandon");
    chai.expect(monitor.onRootChanged).to.deep.equal([["B", "C"], ["C", "A"], ["A", "B"]]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["C", "A", "B"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal([]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);
    monitor.clear();
  });
  it("EDE: cyclical graph can start propagation with no clear starting element", async () => {
    const b1 = await openIModel();
    const txn = testTxn = startTestTxn(b1);
    const { modelId, } = await Engine.initialize(txn);
    const graph = new Graph<string>();
    // Graph structure with a cycle:
    //   A
    //  / \
    // B - C

    // order of insertion effect graph with cycles.
    graph.addNode("B");
    graph.addNode("A");
    graph.addNode("C");

    graph.addEdge("A", ["B"]);
    graph.addEdge("B", ["C"]);
    graph.addEdge("C", ["A"]);

    const monitor = new ElementDrivesElementEventMonitor(b1);
    // create a network
    await Engine.createGraph(txn, modelId, graph);
    chai.expect(() => txn.saveChanges()).to.throw("Could not save changes due to propagation failure.");
    txn.end("abandon");
    chai.expect(monitor.onRootChanged).to.deep.equal([["C", "A"], ["A", "B"], ["B", "C"]]);
    chai.expect(monitor.onAllInputsHandled).to.deep.equal(["A", "B", "C"]);
    chai.expect(monitor.onBeforeOutputsHandled).to.deep.equal([]);
    chai.expect(monitor.onDeletedDependency).to.deep.equal([]);
    monitor.clear();
  });
  it.skip("EDE: performance", async () => {
    const b1 = await openIModel();
    const txn = testTxn = startTestTxn(b1);
    const { modelId, } = await Engine.initialize(txn);
    const graph = new Graph<string>();

    const createTree = (depth: number, breadth: number, prefix: string) => {
      if (depth === 0)
        return;
      for (let i = 0; i < breadth; i++) {
        const node = `${prefix}${i}`;
        graph.addNode(node);
        if (depth > 1) {
          for (let j = 0; j < breadth; j++) {
            const child = `${prefix}${i}${j}`;
            graph.addEdge(node, [child]);
            createTree(depth - 1, breadth, `${prefix}${i}${j}`);
          }
        }
      }
    };

    const stopWatch0 = new StopWatch("create graph", true);
    createTree(5, 3, "N");
    await Engine.createGraph(txn, modelId, graph);
    stopWatch0.stop();
    const createGraphTime = stopWatch0.elapsed.seconds;

    let onRootChangedCount = 0;
    let onDeletedDependencyCount = 0;
    let onAllInputsHandledCount = 0;
    let onBeforeOutputsHandledCount = 0;
    InputDrivesOutput.events.onRootChanged.addListener(() => { onRootChangedCount++; });
    InputDrivesOutput.events.onDeletedDependency.addListener(() => { onDeletedDependencyCount++; });
    NodeElement.events.onAllInputsHandled.addListener(() => { onAllInputsHandledCount++; });
    NodeElement.events.onBeforeOutputsHandled.addListener(() => { onBeforeOutputsHandledCount++; });

    const stopWatch1 = new StopWatch("save changes", true);
    txn.saveChanges();
    stopWatch1.stop();
    const saveChangesTime = stopWatch1.elapsed.seconds;
    chai.expect(onRootChangedCount).to.be.equals(7380);
    chai.expect(onDeletedDependencyCount).to.equal(0);
    chai.expect(onAllInputsHandledCount).to.be.equals(7380);
    chai.expect(onBeforeOutputsHandledCount).to.equal(2460);
    chai.expect(createGraphTime).to.be.lessThan(3);
    chai.expect(saveChangesTime).to.be.lessThan(3);
  });
});
