import { _nativeDb, ChannelControl, ClassRegistry, ElementUniqueAspect, FunctionalBreakdownElement, FunctionalModel, FunctionalPartition, FunctionalSchema, IModelHost, InformationPartitionElement, OnAspectIdArg, OnAspectPropsArg, OnChildElementIdArg, OnChildElementPropsArg, OnElementIdArg, OnElementInModelIdArg, OnElementInModelPropsArg, OnElementPropsArg, OnModelIdArg, OnModelPropsArg, OnSubModelIdArg, OnSubModelPropsArg, Schemas, StandaloneDb, SubjectOwnsPartitionElements } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

import { assert } from "chai";
import sinon = require("sinon"); // eslint-disable-line @typescript-eslint/no-require-imports
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { join } from "node:path";
import { Code, CodeScopeSpec, CodeSpec, IModel } from "@itwin/core-common";

const domainHanderOrder = [];

/** test schema for supplying element/model/aspect classes */
class TestSchema extends FunctionalSchema {
  public static override get schemaName() { return "TestDomainHandlers"; }
}

/** for testing `Element.onXxx` methods */
class TestElementHandlers extends FunctionalBreakdownElement {
  public static override get className() { return "TestElementHandlers"; }
  public static dontDeleteChild = "";

  public static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    domainHanderOrder.push("onInsert");
  }
  public static override onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    domainHanderOrder.push("onInserted");
  }
  public static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    domainHanderOrder.push("onUpdate");
  }
  public static override onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    domainHanderOrder.push("onUpdated");
  }
  public static override onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    domainHanderOrder.push("onDelete");
  }
  public static override onDeleted(arg: OnElementIdArg): void {
    super.onDeleted(arg);
    domainHanderOrder.push("onDeleted");
  }
  public static override onChildDelete(arg: OnChildElementIdArg): void {
    super.onChildDelete(arg);
    domainHanderOrder.push("onChildDelete");
  }
  public static override onChildDeleted(arg: OnChildElementIdArg): void {
    super.onChildDeleted(arg);
    domainHanderOrder.push("onChildDeleted");
  }
  public static override onChildInsert(arg: OnChildElementPropsArg): void {
    super.onChildInsert(arg);
    domainHanderOrder.push("onChildInsert");
  }
  public static override onChildInserted(arg: OnChildElementIdArg): void {
    super.onChildInserted(arg);
    domainHanderOrder.push("onChildInserted");
  }
  public static override onChildUpdate(arg: OnChildElementPropsArg): void {
    super.onChildUpdate(arg);
    domainHanderOrder.push("onChildUpdate");
  }
  public static override onChildUpdated(arg: OnChildElementIdArg): void {
    super.onChildUpdated(arg);
    domainHanderOrder.push("onChildUpdated");
  }
  public static override onChildAdd(arg: OnChildElementPropsArg): void {
    super.onChildAdd(arg);
    domainHanderOrder.push("onChildAdd");
  }
  public static override onChildAdded(arg: OnChildElementIdArg): void {
    super.onChildAdded(arg);
    domainHanderOrder.push("onChildAdded");
  }
  public static override onChildDrop(arg: OnChildElementIdArg): void {
    super.onChildDrop(arg);
    domainHanderOrder.push("onChildDrop");
  }
  public static override onChildDropped(arg: OnChildElementIdArg): void {
    super.onChildDropped(arg);
    domainHanderOrder.push("onChildDropped");
  }
}

/** partition element for testing `Element.onSubModelXxx` methods */
class TestPartitionHandlers extends InformationPartitionElement {
  public static override get className() { return "TestPartitionHanders"; }

  public static override onSubModelInsert(arg: OnSubModelPropsArg): void {
    super.onSubModelInsert(arg);
    domainHanderOrder.push("onSubModelInsert");
  }
  public static override onSubModelInserted(arg: OnSubModelIdArg): void {
    super.onSubModelInserted(arg);
    domainHanderOrder.push("onSubModelInserted");
  }
  public static override onSubModelDelete(arg: OnSubModelIdArg): void {
    super.onSubModelDelete(arg);
    domainHanderOrder.push("onSubModelDelete");
  }
  public static override onSubModelDeleted(arg: OnSubModelIdArg): void {
    super.onSubModelDeleted(arg);
    domainHanderOrder.push("onSubModelDeleted");
  }
}

/** for testing `Model.onXxx` methods */
class TestModelHandlers extends FunctionalModel {
  public static override get className() { return "TestModelHandlers"; }
  public static dontDelete = "";

  public static override onInsert(arg: OnModelPropsArg): void {
    super.onInsert(arg);
    domainHanderOrder.push("onInsert");
  }
  public static override onInserted(arg: OnModelIdArg): void {
    super.onInserted(arg);
    domainHanderOrder.push("onInserted");
  }
  public static override onUpdate(arg: OnModelPropsArg): void {
    super.onUpdate(arg);
    domainHanderOrder.push("onUpdate");
  }
  public static override onUpdated(arg: OnModelIdArg): void {
    super.onUpdated(arg);
    domainHanderOrder.push("onUpdated");
  }
  public static override onDelete(arg: OnModelIdArg): void {
    super.onDelete(arg);
    domainHanderOrder.push("onDelete");
  }
  public static override onDeleted(arg: OnModelIdArg): void {
    super.onDeleted(arg);
    domainHanderOrder.push("onDeleted");
  }
  public static override onInsertElement(arg: OnElementInModelPropsArg): void {
    super.onInsertElement(arg);
    domainHanderOrder.push("onInsertElement");
  }
  public static override onInsertedElement(arg: OnElementInModelIdArg): void {
    super.onInsertedElement(arg);
    domainHanderOrder.push("onInsertedElement");
  }
  public static override onUpdateElement(arg: OnElementInModelPropsArg): void {
    super.onUpdateElement(arg);
    domainHanderOrder.push("onUpdateElement");
  }
  public static override onUpdatedElement(arg: OnElementInModelIdArg): void {
    super.onUpdatedElement(arg);
    domainHanderOrder.push("onUpdatedElement");
  }
  public static override onDeleteElement(arg: OnElementInModelIdArg): void {
    super.onDeleteElement(arg);
    domainHanderOrder.push("onDeleteElement");
  }
  public static override onDeletedElement(arg: OnElementInModelIdArg): void {
    super.onDeletedElement(arg);
    domainHanderOrder.push("onDeletedElement");
  }
}

/** for testing `ElementAspect.onXxx` methods */
class TestAspectHandlers extends ElementUniqueAspect {
  public static override get className() { return "TestFuncAspect"; }
  public static expectedVal = "";

  public static override onInsert(arg: OnAspectPropsArg): void {
    super.onInsert(arg);
    domainHanderOrder.push("onInsert");
  }
  public static override onInserted(arg: OnAspectPropsArg): void {
    super.onInserted(arg);
    domainHanderOrder.push("onInserted");
  }
  public static override onUpdate(arg: OnAspectPropsArg): void {
    super.onUpdate(arg);
    domainHanderOrder.push("onUpdate");
  }
  public static override onUpdated(arg: OnAspectPropsArg): void {
    super.onUpdated(arg);
    domainHanderOrder.push("onUpdated");
  }
  public static override onDelete(arg: OnAspectIdArg): void {
    super.onDelete(arg);
    domainHanderOrder.push("onDelete");
  }
  public static override onDeleted(arg: OnAspectIdArg): void {
    super.onDeleted(arg);
    domainHanderOrder.push("onDeleted");
  }
}

describe.only("Domain Handlers", () => {

  let iModelDb: StandaloneDb;
  let codeSpec: CodeSpec;
  let subjectId: Id64String;
  let partitionCode: Code;
  const testChannelKey1 = "channel 1 for tests";

  before(async () => {
    // await IModelHost.startup();
  });

  after(async () => {
    // await IModelHost.shutdown();
  });

  beforeEach(async () => {
    iModelDb = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DomainHandlers", "DomainHandlers.bim"), {
      rootSubject: { name: "HandlerTest", description: "Test of Domain Handlers." },
      client: "Functional",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    assert.isTrue(iModelDb !== undefined);
    iModelDb[_nativeDb].resetBriefcaseId(100);

    // Register the schema and classes
    FunctionalSchema.registerSchema();
    Schemas.registerSchema(TestSchema);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ClassRegistry.registerModule({ TestElementHandlers, TestPartitionHandlers, TestModelHandlers, TestAspectHandlers }, TestSchema);
    await FunctionalSchema.importSchema(iModelDb);
    iModelDb.saveChanges("Import Functional schema");
    IModelTestUtils.flushTxns(iModelDb);
    await iModelDb.importSchemas([join(KnownTestLocations.assetsDir, "TestHandlers.ecschema.xml")]);
    iModelDb.saveChanges("Import TestHandlers schema");

    // Set up test channel
    assert.equal(iModelDb.channels.queryChannelRoot(ChannelControl.sharedChannelName), IModel.rootSubjectId);
    codeSpec = CodeSpec.create(iModelDb, "Test Element Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));
    assert.isUndefined(iModelDb.channels.queryChannelRoot(testChannelKey1));
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Subject Domain Handlers", channelKey: testChannelKey1 });
    assert.equal(iModelDb.channels.queryChannelRoot(testChannelKey1), subjectId);
    partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Model Domain Handlers");
    iModelDb.channels.addAllowedChannel(testChannelKey1);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call all handler functions for an inserted element", async () => {
    const partitionProps = {
      classFullName: TestElementHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    const partitionId = iModelDb.elements.insertElement(partitionProps);

    // const briefcase = await imodelInfo.openBriefcase();

    // const codeSpec = CodeSpec.create(briefcase, "Test Domain Handler", CodeScopeSpec.Type.Model);
    // briefcase.codeSpecs.insert(codeSpec);
    // assert.isTrue(Id64.isValidId64(codeSpec.id));

    // const testChannelKey1 = "channel 1 for tests";
    // assert.isUndefined(briefcase.channels.queryChannelRoot(testChannelKey1));
    // const subject1Id = briefcase.channels.insertChannelSubject({ subjectName: "Test Domain Handler", channelKey: testChannelKey1 });
    // assert.equal(briefcase.channels.queryChannelRoot(testChannelKey1), subject1Id);

    // const partitionCode = FunctionalPartition.createCode(briefcase, subject1Id, "Test Functional Model");
    // const partitionProps = {
    //   classFullName: TestElementHanders.classFullName,
    //   model: IModel.repositoryModelId,
    //   parent: new SubjectOwnsPartitionElements(subject1Id),
    //   code: partitionCode,
    // };

    // briefcase.channels.addAllowedChannel(testChannelKey1);
    // briefcase.elements.insertElement(partitionProps);

    // await briefcase.locks.releaseAllLocks();
    // briefcase.close();
  });
});
