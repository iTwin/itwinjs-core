import { DbResult, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Code, ElementProps, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, IModelError, RelatedElement, RelationshipProps } from "@itwin/core-common";
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
chai.use(chaiAsPromised);

export interface InputDrivesOutputProps extends ElementDrivesElementProps {
  prop: string
}

export interface NodeElementProps extends GeometricElement3dProps {
  op: string;
  val: number;
}

export class InputDrivesOutput extends ElementDrivesElement {
  public static override get className(): string { return "InputDrivesOutput"; }
  protected constructor(props: InputDrivesOutputProps, iModel: IModelDb) {
    super(props, iModel);
  }
  public static override onRootChanged(_props: RelationshipProps, _iModel: IModelDb): void { }
  public static override onDeletedDependency(_props: RelationshipProps, _iModel: IModelDb): void { }
}

export class NodeElement extends GeometricElement3d {
  public op: string;
  public val: number;
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
  protected static override onAllInputsHandled(_id: Id64String, _iModel: IModelDb): void { }
  protected static override onBeforeOutputsHandled(_id: Id64String, _iModel: IModelDb): void { }
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
  public static countNodes(iModelDb: IModelDb): number {
    return iModelDb.withSqliteStatement("SELECT COUNT(*) FROM Network.Node", (stmt) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return stmt.getValue(0).getInteger();
      }
      return 0;
    });
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
    for (const briefcase of briefcases) {
      briefcase.close();
    }
    HubMock.shutdown();
  });

  it("should insert and count nodes", async () => {
    const b1 = await openBriefcase();
    const { modelId, categoryId } = await Engine.initialize(b1);

    chai.expect(modelId).to.equals("0x20000000001");
    chai.expect(categoryId).to.equals("0x20000000002");

    b1.saveChanges();
    await b1.pullChanges();

    //   Node1 ---[1-2]---> Node2 ---[2-3]---> Node3
    //     ^                             |
    //     |---------[3-1]---------------|

    const node1Id = await Engine.insertNode(b1, modelId, "Node1", "op1", 1, new Point3d(0, 0, 0));
    const node2Id = await Engine.insertNode(b1, modelId, "Node2", "op2", 2, new Point3d(1, 1, 1));
    const node3Id = await Engine.insertNode(b1, modelId, "Node3", "op3", 3, new Point3d(2, 2, 2));

    const node12 = await Engine.insertEdge(b1, node1Id, node2Id, "1-2");
    const node23 = await Engine.insertEdge(b1, node2Id, node3Id, "2-3");
    const node31 = await Engine.insertEdge(b1, node3Id, node1Id, "3-1");

    chai.expect(node1Id).to.be.equals("0x20000000004");
    chai.expect(node2Id).to.be.equals("0x20000000005");
    chai.expect(node3Id).to.be.equals("0x20000000006");
    chai.expect(node12).to.be.equals("0x20000000001");
    chai.expect(node23).to.be.equals("0x20000000002");
    chai.expect(node31).to.be.equals("0x20000000003");

    b1.saveChanges();
  });
});