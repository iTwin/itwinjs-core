import { BeEvent, DbResult, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Code, ElementProps, EntityProps, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, IModelError, RelatedElement, RelationshipProps } from "@itwin/core-common";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SpatialCategory } from "../Category";
import { ChannelControl } from "../ChannelControl";
import { ClassRegistry } from "../ClassRegistry";
import { GeometricElement3d, PhysicalPartition } from "../Element";
import { BriefcaseDb, IModelDb } from "../IModelDb";
import { HubMock } from "../internal/HubMock";
import { PhysicalModel } from "../Model";
import { SubjectOwnsPartitionElements } from "../NavigationRelationship";
import { ElementDrivesElement, ElementDrivesElementProps } from "../Relationship";
import { Schema, Schemas } from "../Schema";
import { HubWrappers } from "./IModelTestUtils";
import { KnownTestLocations } from "./KnownTestLocations";
import { on } from "node:events";
chai.use(chaiAsPromised);
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
    for (const { from, to } of graph.edges()) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
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


export interface InputDrivesOutputProps extends ElementDrivesElementProps {
  prop: string
}

export interface NodeElementProps extends GeometricElement3dProps {
  op: string;
  val: number;
}

export class InputDrivesOutput extends ElementDrivesElement {
  public static readonly events = {
    onRootChanged: new BeEvent<(props: RelationshipProps, iModel: IModelDb) => void>(),
    onDeletedDependency: new BeEvent<(props: RelationshipProps, iModel: IModelDb) => void>(),
  };
  public static override get className(): string { return "InputDrivesOutput"; }
  protected constructor(props: InputDrivesOutputProps, iModel: IModelDb) {
    super(props, iModel);
  }
  public static override onRootChanged(props: RelationshipProps, iModel: IModelDb): void {
    this.events.onRootChanged.raiseEvent(props, iModel);
  }
  public static override onDeletedDependency(props: RelationshipProps, iModel: IModelDb): void {
    this.events.onDeletedDependency.raiseEvent(props, iModel);
  }
}
export class NodeElement extends GeometricElement3d {
  public op: string;
  public val: number;
  public static readonly events = {
    onAllInputsHandled: new BeEvent<(id: Id64String, iModel: IModelDb) => void>(),
    onBeforeOutputsHandled: new BeEvent<(id: Id64String, iModel: IModelDb) => void>(),
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
  protected static override onAllInputsHandled(id: Id64String, iModel: IModelDb): void {
    this.events.onAllInputsHandled.raiseEvent(id, iModel);
  }
  protected static override onBeforeOutputsHandled(id: Id64String, iModel: IModelDb): void {
    this.events.onBeforeOutputsHandled.raiseEvent(id, iModel);
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
  public static async createGraph(iModelDb: IModelDb, modelId: Id64String, graph: Graph<string>): Promise<Graph<{ id: Id64String, name: string }>> {
    const nodes = new Map<string, { id: Id64String, name: string }>();
    const outGraph = new Graph<{ id: Id64String, name: string }>();
    for (const node of graph.nodes()) {
      const id = await this.insertNode(iModelDb, modelId, node, "", 0, new Point3d(0, 0, 0));
      nodes.set(node, { id, name: node });
    }
    for (const edge of graph.edges()) {
      const fromId = nodes.get(edge.from)!.id;
      const toId = nodes.get(edge.to)!.id;
      await this.insertEdge(iModelDb, fromId, toId, "");
      outGraph.addEdge(nodes.get(edge.from)!, nodes.get(edge.to)!);
    }
    return outGraph;
  }
  public static countNodes(iModelDb: IModelDb): number {
    return iModelDb.withPreparedStatement("SELECT COUNT(*) FROM Network.Node", (stmt) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return stmt.getValue(0).getInteger();
      }
      return 0;
    });
  }
  public static countEdges(iModelDb: IModelDb): number {
    return iModelDb.withPreparedStatement("SELECT COUNT(*) FROM Network.InputDrivesOutput", (stmt) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return stmt.getValue(0).getInteger();
      }
      return 0;
    });
  }
  public static queryEdgesForSource(iModelDb: IModelDb, sourceId: Id64String): InputDrivesOutputProps[] {
    const edges: InputDrivesOutputProps[] = [];
    iModelDb.withPreparedStatement("SELECT [ECInstanceId], [SourceECInstanceId], [TargetECInstanceId], [prop], [Status], [Priority] FROM [Network].[InputDrivesOutput] WHERE [SourceECInstanceId] = ?", (stmt) => {
      stmt.bindId(1, sourceId);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        edges.push({
          id: stmt.getValue(0).getId(),
          classFullName: InputDrivesOutput.classFullName,
          sourceId: stmt.getValue(1).getId(),
          targetId: stmt.getValue(2).getId(),
          prop: stmt.getValue(3).getString(),
          status: stmt.getValue(4).getInteger(),
          priority: stmt.getValue(5).getInteger(),
        });
      }
    });
    return edges;
  }
  public static queryEdgesForTarget(iModelDb: IModelDb, targetId: Id64String): InputDrivesOutputProps[] {
    const edges: InputDrivesOutputProps[] = [];
    iModelDb.withPreparedStatement("SELECT [ECInstanceId], [SourceECInstanceId], [TargetECInstanceId], [prop], [Status], [Priority] FROM [Network].[InputDrivesOutput] WHERE [TargetECInstanceId] = ?", (stmt) => {
      stmt.bindId(1, targetId);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        edges.push({
          id: stmt.getValue(0).getId(),
          classFullName: InputDrivesOutput.classFullName,
          sourceId: stmt.getValue(1).getId(),
          targetId: stmt.getValue(2).getId(),
          prop: stmt.getValue(3).getString(),
          status: stmt.getValue(4).getInteger(),
          priority: stmt.getValue(5).getInteger(),
        });
      }
    });
    return edges;
  }
  private static async createPartition(iModelDb: IModelDb): Promise<Id64String> {
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
    return iModelDb.elements.insertElement(modeledElement.toJSON());
  }
  private static async createModel(iModelDb: IModelDb): Promise<Id64String> {
    const partitionId = await this.createPartition(iModelDb);
    const modeledElementRef = new RelatedElement({ id: partitionId });
    const newModel = iModelDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName });
    const newModelId = newModel.insert();
    return newModelId;
  }
  private static async createNodeCategory(iModelDb: IModelDb) {
    const category = SpatialCategory.create(iModelDb, IModelDb.dictionaryId, NodeElement.classFullName);
    return category.insert();
  }
  public static async initialize(iModelDb: IModelDb) {
    await NetworkSchema.importSchema(iModelDb);
    NetworkSchema.registerSchema();
    const modelId = await this.createModel(iModelDb);
    const categoryId = await this.createNodeCategory(iModelDb);
    return {
      modelId,
      categoryId,
    };
  }
  public static async insertNode(iModelDb: IModelDb, modelId: Id64String, name: string, op: string, val: number, location: Point3d, radius: number = 0.1) {
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
    return iModelDb.elements.insertElement(props);
  }
  public static async deleteNode(iModelDb: IModelDb, nodeId: Id64String) {
    await iModelDb.locks.acquireLocks({ exclusive: nodeId });
    return iModelDb.elements.deleteElement(nodeId);
  }
  public static async updateNode(iModelDb: IModelDb, props: Partial<NodeElementProps>) {
    await iModelDb.locks.acquireLocks({ exclusive: props.id });
    return iModelDb.elements.updateElement(props);
  }
  public static async updateNodeWithName(iModelDb: IModelDb, userLabel: string) {
    const id = iModelDb.withPreparedStatement("SELECT [ECInstanceId] FROM [Network].[Node] WHERE [UserLabel] = ?", (stmt) => {
      stmt.bindString(1, userLabel);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        return stmt.getValue(0).getId();
      return undefined;
    });
    if (!id) {
      throw new Error(`Node with userLabel ${userLabel} not found`);
    }
    await this.updateNode(iModelDb, { id });
  }
  public static async insertEdge(iModelDb: IModelDb, sourceId: Id64String, targetId: Id64String, prop: string) {
    const props: InputDrivesOutputProps = {
      classFullName: InputDrivesOutput.classFullName,
      sourceId,
      targetId,
      prop,
      status: 0,
      priority: 0
    };
    return iModelDb.relationships.insertInstance(props);
  }
  public static async deleteEdge(iModelDb: IModelDb, edgeId: Id64String) {
    const edge = iModelDb.relationships.getInstanceProps(InputDrivesOutput.classFullName, edgeId);
    return iModelDb.relationships.deleteInstance(edge);
  }
}

describe.only("EDE Tests", () => {
  const briefcases: BriefcaseDb[] = [];
  let iModelId: string;
  async function openBriefcase(): Promise<BriefcaseDb> {
    const iModelDb = await HubWrappers.downloadAndOpenBriefcase({ iTwinId: HubMock.iTwinId, iModelId });
    iModelDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    iModelDb.saveChanges();
    briefcases.push(iModelDb);
    return iModelDb;
  }
  beforeEach(async () => {
    HubMock.startup("TestIModel", KnownTestLocations.outputDir);
    iModelId = await HubMock.createNewIModel({ iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject" });
  });
  afterEach(async () => {
    NodeElement.events.onAllInputsHandled.clear();
    NodeElement.events.onBeforeOutputsHandled.clear();
    InputDrivesOutput.events.onRootChanged.clear();
    InputDrivesOutput.events.onDeletedDependency.clear();
    for (const briefcase of briefcases) {
      briefcase.close();
    }
    HubMock.shutdown();
  });
  it("local: topological sort", async () => {
    const graph = new Graph<string>();
    // Graph structure:
    //   1
    //  / \
    // 2   3
    // |\   \
    // | \   \
    // 4  5   4
    //  \     /
    //   \   /
    //     5

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
    // 1 --> 2 --> 3
    // ^           |
    // |-----------|
    graph.addEdge("1", ["2"]);
    graph.addEdge("2", ["3"]);
    graph.addEdge("3", ["1"]);

    const df = TopologicalSorter.sortDepthFirst(graph, [], false);
    chai.expect(TopologicalSorter.validate(graph, df)).to.be.false;
    chai.expect(df).to.deep.equal(["1", "2", "3"]);

    // const bf = TopologicalSorter.sortBreadthFirst(graph, [], false);
    // chai.expect(TopologicalSorter.validate(graph, bf)).to.be.false;
    // chai.expect(bf).to.deep.equal(["1", "2", "3"]);
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
  it("local: complex, subset", async () => {
    const graph = new Graph<string>();

    graph.addEdge("Socks", ["Shoes"]);
    graph.addEdge("Underwear", ["Shoes", "Pants"]);
    graph.addEdge("Pants", ["Belt", "Shoes"]);
    graph.addEdge("Shirt", ["Belt", "Tie"]);
    graph.addEdge("Tie", ["Jacket"]);
    graph.addEdge("Belt", ["Jacket"]);
    graph.addNode("Watch");

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

  it.only("EDE: basic graph operations", async () => {
    const b1 = await openBriefcase();
    const { modelId, } = await Engine.initialize(b1);
    const graph = new Graph<string>();

    graph.addEdge("1", ["2", "3"]);
    graph.addEdge("2", ["5", "4"]);
    graph.addEdge("3", ["4"]);
    graph.addEdge("4", ["5"]);

    await Engine.createGraph(b1, modelId, graph);
    const onRootChanged: [string, string][] = [];
    const onAllInputsHandled: string[] = [];
    const onBeforeOutputsHandled: string[] = [];
    const onDeletedDependency: [string, string][] = [];

    InputDrivesOutput.events.onDeletedDependency.addListener((props: RelationshipProps) => onDeletedDependency.push([b1.elements.tryGetElement<NodeElement>(props.sourceId)?.userLabel as string, b1.elements.tryGetElement<NodeElement>(props.targetId)?.userLabel as string]));
    InputDrivesOutput.events.onRootChanged.addListener((props: RelationshipProps) => onRootChanged.push([b1.elements.tryGetElement<NodeElement>(props.sourceId)?.userLabel as string, b1.elements.tryGetElement<NodeElement>(props.targetId)?.userLabel as string]));
    NodeElement.events.onAllInputsHandled.addListener((id: Id64String) => onAllInputsHandled.push(b1.elements.tryGetElement<NodeElement>(id)?.userLabel as string));
    NodeElement.events.onBeforeOutputsHandled.addListener((id: Id64String) => onBeforeOutputsHandled.push(b1.elements.tryGetElement<NodeElement>(id)?.userLabel as string));

    b1.saveChanges();
    chai.expect(onRootChanged).to.deep.equal([
      ["1", "2"],
      ["1", "3"],
      ["2", "5"],
      ["2", "4"],
      ["3", "4"],
      ["4", "5"]]);
    chai.expect(onAllInputsHandled).to.deep.equal(["2", "3", "4", "5"]);
    chai.expect(onBeforeOutputsHandled).to.deep.equal(["1"]);
    chai.expect(onDeletedDependency).to.deep.equal([]);

    onRootChanged.length = 0;
    onAllInputsHandled.length = 0;
    onBeforeOutputsHandled.length = 0;
    onDeletedDependency.length = 0;

    await Engine.updateNodeWithName(b1, "2");
    b1.saveChanges();

    chai.expect(onRootChanged).to.deep.equal([
      ["2", "5"],
      ["2", "4"],
      ["4", "5"]]);
    chai.expect(onAllInputsHandled).to.deep.equal(["4", "5"]);
    chai.expect(onBeforeOutputsHandled).to.deep.equal(["2"]);
    chai.expect(onDeletedDependency).to.deep.equal([]);

  });
});


