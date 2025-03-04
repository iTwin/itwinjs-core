import { _nativeDb, ChannelControl, ChannelKey, ClassRegistry, ElementUniqueAspect, FunctionalBreakdownElement, FunctionalComponentElement, FunctionalModel, FunctionalPartition, FunctionalSchema, IModelHost, InformationPartitionElement, OnAspectIdArg, OnAspectPropsArg, OnChildElementIdArg, OnChildElementPropsArg, OnElementIdArg, OnElementInModelIdArg, OnElementInModelPropsArg, OnElementPropsArg, OnModelIdArg, OnModelPropsArg, OnSubModelIdArg, OnSubModelPropsArg, Schemas, StandaloneDb, SubjectOwnsPartitionElements } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

import { assert, expect } from "chai";
import sinon = require("sinon"); // eslint-disable-line @typescript-eslint/no-require-imports
import { restore as sinonRestore, spy as sinonSpy } from "sinon";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { join } from "node:path";
import { Code, CodeScopeSpec, CodeSpec, IModel } from "@itwin/core-common";

const domainHandlerOrder = [];

/** test schema for supplying element/model/aspect classes */
class TestSchema extends FunctionalSchema {
  public static override get schemaName() { return "TestHandlers"; }
}

/** for testing `Element.onXxx` methods */
class TestElementHandlers extends FunctionalBreakdownElement {
  public static override get className() { return "TestElementHandlers"; }
  public static dontDeleteChild = "";

  public static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    domainHandlerOrder.push("onInsert");
  }
  public static override onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    domainHandlerOrder.push("onInserted");
  }
  public static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    domainHandlerOrder.push("onUpdate");
  }
  public static override onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    domainHandlerOrder.push("onUpdated");
  }
  public static override onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    domainHandlerOrder.push("onDelete");
  }
  public static override onDeleted(arg: OnElementIdArg): void {
    super.onDeleted(arg);
    domainHandlerOrder.push("onDeleted");
  }
  public static override onChildDelete(arg: OnChildElementIdArg): void {
    super.onChildDelete(arg);
    domainHandlerOrder.push("onChildDelete");
  }
  public static override onChildDeleted(arg: OnChildElementIdArg): void {
    super.onChildDeleted(arg);
    domainHandlerOrder.push("onChildDeleted");
  }
  public static override onChildInsert(arg: OnChildElementPropsArg): void {
    super.onChildInsert(arg);
    domainHandlerOrder.push("onChildInsert");
  }
  public static override onChildInserted(arg: OnChildElementIdArg): void {
    super.onChildInserted(arg);
    domainHandlerOrder.push("onChildInserted");
  }
  public static override onChildUpdate(arg: OnChildElementPropsArg): void {
    super.onChildUpdate(arg);
    domainHandlerOrder.push("onChildUpdate");
  }
  public static override onChildUpdated(arg: OnChildElementIdArg): void {
    super.onChildUpdated(arg);
    domainHandlerOrder.push("onChildUpdated");
  }
  public static override onChildAdd(arg: OnChildElementPropsArg): void {
    super.onChildAdd(arg);
    domainHandlerOrder.push("onChildAdd");
  }
  public static override onChildAdded(arg: OnChildElementIdArg): void {
    super.onChildAdded(arg);
    domainHandlerOrder.push("onChildAdded");
  }
  public static override onChildDrop(arg: OnChildElementIdArg): void {
    super.onChildDrop(arg);
    domainHandlerOrder.push("onChildDrop");
  }
  public static override onChildDropped(arg: OnChildElementIdArg): void {
    super.onChildDropped(arg);
    domainHandlerOrder.push("onChildDropped");
  }
}

/** partition element for testing `Element.onSubModelXxx` methods */
class TestPartitionHandlers extends InformationPartitionElement {
  public static override get className() { return "TestPartitionHandlers"; }

  public static override onSubModelInsert(arg: OnSubModelPropsArg): void {
    super.onSubModelInsert(arg);
    domainHandlerOrder.push("onSubModelInsert");
  }
  public static override onSubModelInserted(arg: OnSubModelIdArg): void {
    super.onSubModelInserted(arg);
    domainHandlerOrder.push("onSubModelInserted");
  }
  public static override onSubModelDelete(arg: OnSubModelIdArg): void {
    super.onSubModelDelete(arg);
    domainHandlerOrder.push("onSubModelDelete");
  }
  public static override onSubModelDeleted(arg: OnSubModelIdArg): void {
    super.onSubModelDeleted(arg);
    domainHandlerOrder.push("onSubModelDeleted");
  }
}

/** for testing `Model.onXxx` methods */
class TestModelHandlers extends FunctionalModel {
  public static override get className() { return "TestModelHandlers"; }
  public static dontDelete = "";

  public static override onInsert(arg: OnModelPropsArg): void {
    super.onInsert(arg);
    domainHandlerOrder.push("onInsert");
  }
  public static override onInserted(arg: OnModelIdArg): void {
    super.onInserted(arg);
    domainHandlerOrder.push("onInserted");
  }
  public static override onUpdate(arg: OnModelPropsArg): void {
    super.onUpdate(arg);
    domainHandlerOrder.push("onUpdate");
  }
  public static override onUpdated(arg: OnModelIdArg): void {
    super.onUpdated(arg);
    domainHandlerOrder.push("onUpdated");
  }
  public static override onDelete(arg: OnModelIdArg): void {
    super.onDelete(arg);
    domainHandlerOrder.push("onDelete");
  }
  public static override onDeleted(arg: OnModelIdArg): void {
    super.onDeleted(arg);
    domainHandlerOrder.push("onDeleted");
  }
  public static override onInsertElement(arg: OnElementInModelPropsArg): void {
    super.onInsertElement(arg);
    domainHandlerOrder.push("onInsertElement");
  }
  public static override onInsertedElement(arg: OnElementInModelIdArg): void {
    super.onInsertedElement(arg);
    domainHandlerOrder.push("onInsertedElement");
  }
  public static override onUpdateElement(arg: OnElementInModelPropsArg): void {
    super.onUpdateElement(arg);
    domainHandlerOrder.push("onUpdateElement");
  }
  public static override onUpdatedElement(arg: OnElementInModelIdArg): void {
    super.onUpdatedElement(arg);
    domainHandlerOrder.push("onUpdatedElement");
  }
  public static override onDeleteElement(arg: OnElementInModelIdArg): void {
    super.onDeleteElement(arg);
    domainHandlerOrder.push("onDeleteElement");
  }
  public static override onDeletedElement(arg: OnElementInModelIdArg): void {
    super.onDeletedElement(arg);
    domainHandlerOrder.push("onDeletedElement");
  }
}

/** for testing `ElementAspect.onXxx` methods */
class TestAspectHandlers extends ElementUniqueAspect {
  public static override get className() { return "TestFuncAspect"; }
  public static expectedVal = "";

  public static override onInsert(arg: OnAspectPropsArg): void {
    super.onInsert(arg);
    domainHandlerOrder.push("onInsert");
  }
  public static override onInserted(arg: OnAspectPropsArg): void {
    super.onInserted(arg);
    domainHandlerOrder.push("onInserted");
  }
  public static override onUpdate(arg: OnAspectPropsArg): void {
    super.onUpdate(arg);
    domainHandlerOrder.push("onUpdate");
  }
  public static override onUpdated(arg: OnAspectPropsArg): void {
    super.onUpdated(arg);
    domainHandlerOrder.push("onUpdated");
  }
  public static override onDelete(arg: OnAspectIdArg): void {
    super.onDelete(arg);
    domainHandlerOrder.push("onDelete");
  }
  public static override onDeleted(arg: OnAspectIdArg): void {
    super.onDeleted(arg);
    domainHandlerOrder.push("onDeleted");
  }
}

class Component extends FunctionalComponentElement {
  public static override get className() { return "Component"; }
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

  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call all handler functions for an inserted element", async () => {
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
    ClassRegistry.registerModule({ TestElementHandlers, TestPartitionHandlers, TestModelHandlers, TestAspectHandlers, Component }, TestSchema);
    await FunctionalSchema.importSchema(iModelDb);

    let commits = 0;
    let committed = 0;
    const elements = iModelDb.elements;
    const dropCommit = iModelDb.txns.onCommit.addListener(() => commits++);
    const dropCommitted = iModelDb.txns.onCommitted.addListener(() => committed++);
    iModelDb.saveChanges("Import Functional schema");

    assert.equal(commits, 1);
    assert.equal(committed, 1);
    dropCommit();
    dropCommitted();
    IModelTestUtils.flushTxns(iModelDb);

    await iModelDb.importSchemas([join(KnownTestLocations.assetsDir, "TestHandlers.ecschema.xml")]);
    iModelDb.saveChanges("Import TestHandlers schema");
    assert.equal(commits, 1);
    assert.equal(committed, 1);

    // Set up test channel
    function testChannel<T>(channelKey: ChannelKey, fn: () => T, spies: sinon.SinonSpy[]) {
      iModelDb.channels.removeAllowedChannel(channelKey);
      expect(fn).throws("not allowed");
      iModelDb.channels.addAllowedChannel(channelKey);
      spies.forEach((s) => s.resetHistory());
      return fn();
    }

    const spy = {
      model: {
        onInsert: sinonSpy(TestModelHandlers, "onInsert"),
        onInserted: sinonSpy(TestModelHandlers, "onInserted"),
        onUpdate: sinonSpy(TestModelHandlers, "onUpdate"),
        onUpdated: sinonSpy(TestModelHandlers, "onUpdated"),
        onDelete: sinonSpy(TestModelHandlers, "onDelete"),
        onDeleted: sinonSpy(TestModelHandlers, "onDeleted"),
        onInsertElement: sinonSpy(TestModelHandlers, "onInsertElement"),
        onInsertedElement: sinonSpy(TestModelHandlers, "onInsertedElement"),
        onUpdateElement: sinonSpy(TestModelHandlers, "onUpdateElement"),
        onUpdatedElement: sinonSpy(TestModelHandlers, "onUpdatedElement"),
        onDeleteElement: sinonSpy(TestModelHandlers, "onDeleteElement"),
        onDeletedElement: sinonSpy(TestModelHandlers, "onDeletedElement"),
      },
      partition: {
        onSubModelInsert: sinonSpy(TestPartitionHandlers, "onSubModelInsert"),
        onSubModelInserted: sinonSpy(TestPartitionHandlers, "onSubModelInserted"),
        onSubModelDelete: sinonSpy(TestPartitionHandlers, "onSubModelDelete"),
        onSubModelDeleted: sinonSpy(TestPartitionHandlers, "onSubModelDeleted"),
      },
      breakdown: {
        onInsert: sinonSpy(TestElementHandlers, "onInsert"),
        onInserted: sinonSpy(TestElementHandlers, "onInserted"),
        onUpdate: sinonSpy(TestElementHandlers, "onUpdate"),
        onUpdated: sinonSpy(TestElementHandlers, "onUpdated"),
        onDelete: sinonSpy(TestElementHandlers, "onDelete"),
        onDeleted: sinonSpy(TestElementHandlers, "onDeleted"),
        onChildDelete: sinonSpy(TestElementHandlers, "onChildDelete"),
        onChildDeleted: sinonSpy(TestElementHandlers, "onChildDeleted"),
        onChildInsert: sinonSpy(TestElementHandlers, "onChildInsert"),
        onChildInserted: sinonSpy(TestElementHandlers, "onChildInserted"),
        onChildUpdate: sinonSpy(TestElementHandlers, "onChildUpdate"),
        onChildUpdated: sinonSpy(TestElementHandlers, "onChildUpdated"),
        onChildAdd: sinonSpy(TestElementHandlers, "onChildAdd"),
        onChildAdded: sinonSpy(TestElementHandlers, "onChildAdded"),
        onChildDrop: sinonSpy(TestElementHandlers, "onChildDrop"),
        onChildDropped: sinonSpy(TestElementHandlers, "onChildDropped"),
      },
      aspect: {
        onInsert: sinonSpy(TestAspectHandlers, "onInsert"),
        onInserted: sinonSpy(TestAspectHandlers, "onInserted"),
        onUpdate: sinonSpy(TestAspectHandlers, "onUpdate"),
        onUpdated: sinonSpy(TestAspectHandlers, "onUpdated"),
        onDelete: sinonSpy(TestAspectHandlers, "onDelete"),
        onDeleted: sinonSpy(TestAspectHandlers, "onDeleted"),
      },
    };

    assert.equal(iModelDb.channels.queryChannelRoot(ChannelControl.sharedChannelName), IModel.rootSubjectId);

    codeSpec = CodeSpec.create(iModelDb, "Test Element Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));

    assert.isUndefined(iModelDb.channels.queryChannelRoot(testChannelKey1));
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Subject Domain Handlers", channelKey: testChannelKey1 });
    assert.equal(iModelDb.channels.queryChannelRoot(testChannelKey1), subjectId);

    partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Functional Model");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    iModelDb.channels.addAllowedChannel(testChannelKey1);
    let partitionId = iModelDb.elements.insertElement(partitionProps);

    // Test Model Handlers
    const modelId = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });
    const model = iModelDb.models.getModel(modelId);
    model.update();
    model.delete();

    partitionProps.code.value = "Test Func 2";
    partitionProps.parent = new SubjectOwnsPartitionElements(subjectId);
    partitionId = iModelDb.elements.insertElement(partitionProps);

    const modelId2 = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });

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
