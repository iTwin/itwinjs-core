import { _nativeDb, ChannelControl, ClassRegistry, ElementOwnsChildElements, ElementOwnsUniqueAspect, ElementUniqueAspect, FunctionalBreakdownElement, FunctionalComponentElement, FunctionalModel, FunctionalPartition, FunctionalSchema, IModelHost, InformationPartitionElement, OnAspectIdArg, OnAspectPropsArg, OnChildElementIdArg, OnChildElementPropsArg, OnElementIdArg, OnElementInModelIdArg, OnElementInModelPropsArg, OnElementPropsArg, OnModelIdArg, OnModelPropsArg, OnSubModelIdArg, OnSubModelPropsArg, Schemas, StandaloneDb, SubjectOwnsPartitionElements } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

import { assert, expect } from "chai";
import sinon = require("sinon"); // eslint-disable-line @typescript-eslint/no-require-imports
import { spy as sinonSpy } from "sinon";
import { Guid, Id64, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import { join } from "node:path";
import { Code, CodeScopeSpec, CodeSpec, ElementProps, IModel } from "@itwin/core-common";

Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Trace);

const elementDomainHandlerOrder = [];
const modelDomainHandlerOrder = [];
const aspectDomainHandlerOrder = [];

/** test schema for supplying element/model/aspect classes */
class TestSchema extends FunctionalSchema {
  public static override get schemaName() { return "TestHandlers"; }
}

/** for testing `Element.onXxx` methods */
class TestElementHandlers extends FunctionalBreakdownElement {
  public static override get className() { return "TestElementHandlers"; }
  public static dontDeleteChild = "";

  public static override onInsert(arg: OnElementPropsArg): void {
    arg.props.userLabel = "inserted label";
    super.onInsert(arg);
    elementDomainHandlerOrder.push("Element: onInsert");
  }
  public static override onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    elementDomainHandlerOrder.push("Element: onInserted");
  }
  public static override onUpdate(arg: OnElementPropsArg): void {
    arg.props.userLabel = "updated label";
    super.onUpdate(arg);
    elementDomainHandlerOrder.push("Element: onUpdate");
  }
  public static override onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    elementDomainHandlerOrder.push("Element: onUpdated");
  }
  public static override onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    elementDomainHandlerOrder.push("Element: onDelete");
  }
  public static override onDeleted(arg: OnElementIdArg): void {
    super.onDeleted(arg);
    elementDomainHandlerOrder.push("Element: onDeleted");
  }
  public static override onChildDelete(arg: OnChildElementIdArg): void {
    super.onChildDelete(arg);
    if (arg.childId === this.dontDeleteChild)
      throw new Error("dont delete my child");
    elementDomainHandlerOrder.push("Element: onChildDelete");
  }
  public static override onChildDeleted(arg: OnChildElementIdArg): void {
    super.onChildDeleted(arg);
    elementDomainHandlerOrder.push("Element: onChildDeleted");
  }
  public static override onChildInsert(arg: OnChildElementPropsArg): void {
    super.onChildInsert(arg);
    elementDomainHandlerOrder.push("Element: onChildInsert");
  }
  public static override onChildInserted(arg: OnChildElementIdArg): void {
    super.onChildInserted(arg);
    elementDomainHandlerOrder.push("Element: onChildInserted");
  }
  public static override onChildUpdate(arg: OnChildElementPropsArg): void {
    super.onChildUpdate(arg);
    elementDomainHandlerOrder.push("Element: onChildUpdate");
  }
  public static override onChildUpdated(arg: OnChildElementIdArg): void {
    super.onChildUpdated(arg);
    elementDomainHandlerOrder.push("Element: onChildUpdated");
  }
  public static override onChildAdd(arg: OnChildElementPropsArg): void {
    super.onChildAdd(arg);
    elementDomainHandlerOrder.push("Element: onChildAdd");
  }
  public static override onChildAdded(arg: OnChildElementIdArg): void {
    super.onChildAdded(arg);
    elementDomainHandlerOrder.push("Element: onChildAdded");
  }
  public static override onChildDrop(arg: OnChildElementIdArg): void {
    super.onChildDrop(arg);
    elementDomainHandlerOrder.push("Element: onChildDrop");
  }
  public static override onChildDropped(arg: OnChildElementIdArg): void {
    super.onChildDropped(arg);
    elementDomainHandlerOrder.push("Element: onChildDropped");
  }
}

/** partition element for testing `Element.onSubModelXxx` methods */
class TestPartitionHandlers extends InformationPartitionElement {
  public static override get className() { return "TestPartitionHandlers"; }

  public static override onSubModelInsert(arg: OnSubModelPropsArg): void {
    super.onSubModelInsert(arg);
    elementDomainHandlerOrder.push("SubModel Element: onSubModelInsert");
  }
  public static override onSubModelInserted(arg: OnSubModelIdArg): void {
    super.onSubModelInserted(arg);
    elementDomainHandlerOrder.push("SubModel Element: onSubModelInserted");
  }
  public static override onSubModelDelete(arg: OnSubModelIdArg): void {
    super.onSubModelDelete(arg);
    elementDomainHandlerOrder.push("SubModel Element: onSubModelDelete");
  }
  public static override onSubModelDeleted(arg: OnSubModelIdArg): void {
    super.onSubModelDeleted(arg);
    elementDomainHandlerOrder.push("SubModel Element: onSubModelDeleted");
  }
}

/** for testing `Model.onXxx` methods */
class TestModelHandlers extends FunctionalModel {
  public static override get className() { return "TestModelHandlers"; }
  public static dontDelete = "";

  public static override onInsert(arg: OnModelPropsArg): void {
    super.onInsert(arg);
    modelDomainHandlerOrder.push("Model: onInsert");
  }
  public static override onInserted(arg: OnModelIdArg): void {
    super.onInserted(arg);
    modelDomainHandlerOrder.push("Model: onInserted");
  }
  public static override onUpdate(arg: OnModelPropsArg): void {
    super.onUpdate(arg);
    modelDomainHandlerOrder.push("Model: onUpdate");
  }
  public static override onUpdated(arg: OnModelIdArg): void {
    super.onUpdated(arg);
    modelDomainHandlerOrder.push("Model: onUpdated");
  }
  public static override onDelete(arg: OnModelIdArg): void {
    super.onDelete(arg);
    modelDomainHandlerOrder.push("Model: onDelete");
  }
  public static override onDeleted(arg: OnModelIdArg): void {
    super.onDeleted(arg);
    modelDomainHandlerOrder.push("Model: onDeleted");
  }
  public static override onInsertElement(arg: OnElementInModelPropsArg): void {
    super.onInsertElement(arg);
    modelDomainHandlerOrder.push("Model: onInsertElement");
  }
  public static override onInsertedElement(arg: OnElementInModelIdArg): void {
    super.onInsertedElement(arg);
    modelDomainHandlerOrder.push("Model: onInsertedElement");
  }
  public static override onUpdateElement(arg: OnElementInModelPropsArg): void {
    super.onUpdateElement(arg);
    modelDomainHandlerOrder.push("Model: onUpdateElement");
  }
  public static override onUpdatedElement(arg: OnElementInModelIdArg): void {
    super.onUpdatedElement(arg);
    modelDomainHandlerOrder.push("Model: onUpdatedElement");
  }
  public static override onDeleteElement(arg: OnElementInModelIdArg): void {
    super.onDeleteElement(arg);
    if (arg.elementId === this.dontDelete)
      throw new Error("dont delete my element");
    modelDomainHandlerOrder.push("Model: onDeleteElement");
  }
  public static override onDeletedElement(arg: OnElementInModelIdArg): void {
    super.onDeletedElement(arg);
    modelDomainHandlerOrder.push("Model: onDeletedElement");
  }
}

/** for testing `ElementAspect.onXxx` methods */
class TestAspectHandlers extends ElementUniqueAspect {
  public static override get className() { return "TestAspectHandlers"; }

  public static override onInsert(arg: OnAspectPropsArg): void {
    super.onInsert(arg);
    aspectDomainHandlerOrder.push("Aspect: onInsert");
  }
  public static override onInserted(arg: OnAspectPropsArg): void {
    super.onInserted(arg);
    aspectDomainHandlerOrder.push("Aspect: onInserted");
  }
  public static override onUpdate(arg: OnAspectPropsArg): void {
    super.onUpdate(arg);
    aspectDomainHandlerOrder.push("Aspect: onUpdate");
  }
  public static override onUpdated(arg: OnAspectPropsArg): void {
    super.onUpdated(arg);
    aspectDomainHandlerOrder.push("Aspect: onUpdated");
  }
  public static override onDelete(arg: OnAspectIdArg): void {
    super.onDelete(arg);
    aspectDomainHandlerOrder.push("Aspect: onDelete");
  }
  public static override onDeleted(arg: OnAspectIdArg): void {
    super.onDeleted(arg);
    aspectDomainHandlerOrder.push("Aspect: onDeleted");
  }
}

class Component extends FunctionalComponentElement {
  public static override get className() { return "Component"; }
}

describe.only("Domain Handlers", () => {

  let iModelDb: StandaloneDb;
  let modelId: Id64String;

  let codeSpec: CodeSpec;
  let subjectId: Id64String;
  let partitionCode: Code;
  const testChannelKey1 = "channel 1 for tests";
  const testChannelKey2 = "channel 2 for tests";
  const testChannelKey3 = "channel 3 for tests";
  const testChannelKey4 = "channel 4 for tests";

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

  before(async () => {
    // await IModelHost.startup();

    // Create iModel
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


    iModelDb.saveChanges("Import Functional schema");
    IModelTestUtils.flushTxns(iModelDb);
    await iModelDb.importSchemas([join(KnownTestLocations.assetsDir, "TestHandlers.ecschema.xml")]);
    iModelDb.saveChanges("Import TestHandlers schema");

    assert.equal(iModelDb.channels.queryChannelRoot(ChannelControl.sharedChannelName), IModel.rootSubjectId);
  });

  after(async () => {
    // await IModelHost.shutdown();
    sinon.restore();
  });

  beforeEach(async () => {

  });

  afterEach(() => {

  });

  it("should call all handler functions for an inserted model", async () => {
    codeSpec = CodeSpec.create(iModelDb, "Test Model Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));
    assert.isUndefined(iModelDb.channels.queryChannelRoot(testChannelKey1));
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Model Domain Handlers", channelKey: testChannelKey1 });
    assert.equal(iModelDb.channels.queryChannelRoot(testChannelKey1), subjectId);

    partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Functional Model");

    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };
    iModelDb.channels.addAllowedChannel(testChannelKey1);
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    modelId = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });

    const elementProps: ElementProps = {
      classFullName: TestElementHandlers.classFullName,
      model: modelId,
      code: {
        spec: codeSpec.id,
        scope: modelId,
        value: "Breakdown1"
      }
    };
    const elementId = iModelDb.elements.insertElement(elementProps);
    const model = iModelDb.models.getModel(modelId);
    model.update();
    const element = iModelDb.elements.getElement(elementId);
    element.update();
    model.delete();

    // Check that all model handler functions were called
    assert.isTrue(spy.model.onInsert.called);
    assert.isTrue(spy.model.onInserted.called);
    assert.isTrue(spy.model.onInsertElement.called);
    assert.isTrue(spy.model.onInsertedElement.called);
    assert.isTrue(spy.model.onUpdate.called);
    assert.isTrue(spy.model.onUpdated.called);
    assert.isTrue(spy.model.onUpdateElement.called);
    assert.isTrue(spy.model.onUpdatedElement.called);
    assert.isTrue(spy.model.onDelete.called);
    assert.isTrue(spy.model.onDeleted.called);
    assert.isTrue(spy.model.onDeleteElement.called);
    assert.isTrue(spy.model.onDeletedElement.called);

    // Check that all sub model handler functions were called
    assert.isTrue(spy.partition.onSubModelInsert.called);
    assert.isTrue(spy.partition.onSubModelInserted.called);
    assert.isTrue(spy.partition.onSubModelDelete.called);
    assert.isTrue(spy.partition.onSubModelDeleted.called);
  });

  it("should call all handler functions for an inserted aspect", async () => {
    codeSpec = CodeSpec.create(iModelDb, "Test Aspect Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));
    assert.isUndefined(iModelDb.channels.queryChannelRoot(testChannelKey2));
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Aspect Domain Handlers", channelKey: testChannelKey2 });
    assert.equal(iModelDb.channels.queryChannelRoot(testChannelKey2), subjectId);

    partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Functional Model");

    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };
    iModelDb.channels.addAllowedChannel(testChannelKey2);
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    modelId = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });

    const elementProps: ElementProps = {
      classFullName: TestElementHandlers.classFullName,
      model: modelId,
      code: {
        spec: codeSpec.id,
        scope: modelId,
        value: "Breakdown2"
      }
    };

    const elementId = iModelDb.elements.insertElement(elementProps);

    const aspectProps = {
      classFullName: TestAspectHandlers.classFullName,
      element: new ElementOwnsUniqueAspect(elementId),
      strProp: "prop 1"
    };

    iModelDb.elements.insertAspect(aspectProps);
    aspectProps.strProp = "prop 2";
    iModelDb.elements.updateAspect(aspectProps);
    const aspect = iModelDb.elements.getAspects(elementId, TestAspectHandlers.classFullName);
    iModelDb.elements.deleteAspect(aspect[0].id);

    // Check that all aspect handler functions were called
    assert.isTrue(spy.aspect.onInsert.called);
    assert.isTrue(spy.aspect.onInserted.called);
    assert.isTrue(spy.aspect.onUpdate.called);
    assert.isTrue(spy.aspect.onUpdated.called);
    assert.isTrue(spy.aspect.onDelete.called);
    assert.isTrue(spy.aspect.onDeleted.called);

    const model = iModelDb.models.getModel(modelId);
    model.delete();
  });

  it("should call all handler functions for an inserted element", async () => {
    codeSpec = CodeSpec.create(iModelDb, "Test Element Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));
    assert.isUndefined(iModelDb.channels.queryChannelRoot(testChannelKey3));
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Element Domain Handlers", channelKey: testChannelKey3 });
    assert.equal(iModelDb.channels.queryChannelRoot(testChannelKey3), subjectId);

    partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Functional Model");

    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };
    iModelDb.channels.addAllowedChannel(testChannelKey3);
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    modelId = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });

    const elementProps: ElementProps = {
      classFullName: TestElementHandlers.classFullName,
      model: modelId,
      code: {
        spec: codeSpec.id,
        scope: modelId,
        value: "Breakdown3"
      }
    };
    const elementId = iModelDb.elements.insertElement(elementProps);

    codeSpec = CodeSpec.create(iModelDb, "Test Element Domain Handlers 2", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));
    assert.isUndefined(iModelDb.channels.queryChannelRoot(testChannelKey4));
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Element Domain Handlers 2", channelKey: testChannelKey4 });
    assert.equal(iModelDb.channels.queryChannelRoot(testChannelKey4), subjectId);

    partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Functional Model");

    const elementProps2: ElementProps = {
      classFullName: TestElementHandlers.classFullName,
      model: modelId,
      code: {
        spec: codeSpec.id,
        scope: modelId,
        value: "Breakdown4"
      }
    };
    const elementId2 = iModelDb.elements.insertElement(elementProps2);


    const componentProps = {
      classFullName: Component.classFullName,
      model: modelId,
      parent: { id: elementId, relClassName: ElementOwnsChildElements.classFullName },
      code: { spec: codeSpec.id, scope: modelId, value: "Component1" },
    };

    const componentId = iModelDb.elements.insertElement(componentProps);
    const component1 = iModelDb.elements.getElement(componentId);
    component1.update();

    componentProps.code.value = "comp2";
    const componentId2 = iModelDb.elements.insertElement(componentProps);
    const component2 = iModelDb.elements.getElement(componentId2);

    spy.model.onDeleteElement.resetHistory();
    spy.model.onDeletedElement.resetHistory();
    TestModelHandlers.dontDelete = componentId2; // block deletion through model
    expect(() => component2.delete()).to.throw("dont delete my element");
    TestModelHandlers.dontDelete = ""; // allow deletion through model
    TestElementHandlers.dontDeleteChild = componentId2; // but block through parent
    expect(() => component2.delete()).to.throw("dont delete my child");
    assert.equal(spy.model.onDeleteElement.callCount, 2, "Model.onElementDelete gets called even though element is not really deleted");
    assert.equal(spy.model.onDeletedElement.callCount, 0, "make sure Model.onElementDeleted did not get called");
    TestElementHandlers.dontDeleteChild = ""; // now fully allow delete
    component2.delete();

    componentProps.parent.id = elementId;
    const componentId3 = iModelDb.elements.insertElement(componentProps);
    const component3Props = iModelDb.elements.getElementProps(componentId3);
    component3Props.parent!.id = elementId2;

    iModelDb.elements.updateElement(component3Props);

    // Check that all aspect handler functions were called
    assert.isTrue(spy.breakdown.onInsert.called);
    assert.isTrue(spy.breakdown.onInserted.called);
    assert.isTrue(spy.breakdown.onUpdate.called);
    assert.isTrue(spy.breakdown.onUpdated.called);
    assert.isTrue(spy.breakdown.onDelete.called);
    assert.isTrue(spy.breakdown.onDeleted.called);
    assert.isTrue(spy.breakdown.onChildDelete.called);
    assert.isTrue(spy.breakdown.onChildDeleted.called);
    assert.isTrue(spy.breakdown.onChildInsert.called);
    assert.isTrue(spy.breakdown.onChildInserted.called);
    assert.isTrue(spy.breakdown.onChildUpdate.called);
    assert.isTrue(spy.breakdown.onChildUpdated.called);
    assert.isTrue(spy.breakdown.onChildAdd.called);
    assert.isTrue(spy.breakdown.onChildAdded.called);
    assert.isTrue(spy.breakdown.onChildDrop.called);
    assert.isTrue(spy.breakdown.onChildDropped.called);

    const model = iModelDb.models.getModel(modelId);
    model.delete();
  });
});
