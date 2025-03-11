import { _nativeDb, ClassRegistry, ElementOwnsChildElements, ElementOwnsUniqueAspect, ElementUniqueAspect, FunctionalBreakdownElement, FunctionalComponentElement,
  FunctionalModel, FunctionalPartition, FunctionalSchema, InformationPartitionElement, OnAspectIdArg, OnAspectPropsArg, OnChildElementIdArg, OnChildElementPropsArg,
  OnElementIdArg, OnElementInModelIdArg, OnElementInModelPropsArg, OnElementPropsArg, OnModelIdArg, OnModelPropsArg, OnSubModelIdArg, OnSubModelPropsArg, Schemas,
  StandaloneDb, SubjectOwnsPartitionElements } from "../../core-backend";
import { Guid, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec, ElementProps, IModel } from "@itwin/core-common";
import { join } from "node:path";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { assert, expect } from "chai";
import sinon = require("sinon"); // eslint-disable-line @typescript-eslint/no-require-imports

Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Trace);

let elementDomainHandlerOrder = [];
let modelDomainHandlerOrder = [];
let aspectDomainHandlerOrder = [];

/** test schema for supplying element/model/aspect classes */
class TestSchema extends FunctionalSchema {
  public static override get schemaName() { return "TestHandlers"; }
}
/** test schema for supplying element/model/aspect classes */
class TestSchema2 extends FunctionalSchema {
  public static override get schemaName() { return "TestHandlers2"; }
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


const spies = {
  model: {
    onInsert: sinon.spy(TestModelHandlers, "onInsert"),
    onInserted: sinon.spy(TestModelHandlers, "onInserted"),
    onUpdate: sinon.spy(TestModelHandlers, "onUpdate"),
    onUpdated: sinon.spy(TestModelHandlers, "onUpdated"),
    onDelete: sinon.spy(TestModelHandlers, "onDelete"),
    onDeleted: sinon.spy(TestModelHandlers, "onDeleted"),
    onInsertElement: sinon.spy(TestModelHandlers, "onInsertElement"),
    onInsertedElement: sinon.spy(TestModelHandlers, "onInsertedElement"),
    onUpdateElement: sinon.spy(TestModelHandlers, "onUpdateElement"),
    onUpdatedElement: sinon.spy(TestModelHandlers, "onUpdatedElement"),
    onDeleteElement: sinon.spy(TestModelHandlers, "onDeleteElement"),
    onDeletedElement: sinon.spy(TestModelHandlers, "onDeletedElement"),
  },
  sub: {
    onSubModelInsert: sinon.spy(TestPartitionHandlers, "onSubModelInsert"),
    onSubModelInserted: sinon.spy(TestPartitionHandlers, "onSubModelInserted"),
    onSubModelDelete: sinon.spy(TestPartitionHandlers, "onSubModelDelete"),
    onSubModelDeleted: sinon.spy(TestPartitionHandlers, "onSubModelDeleted"),
  },
  element: {
    onInsert: sinon.spy(TestElementHandlers, "onInsert"),
    onInserted: sinon.spy(TestElementHandlers, "onInserted"),
    onUpdate: sinon.spy(TestElementHandlers, "onUpdate"),
    onUpdated: sinon.spy(TestElementHandlers, "onUpdated"),
    onDelete: sinon.spy(TestElementHandlers, "onDelete"),
    onDeleted: sinon.spy(TestElementHandlers, "onDeleted"),
    onChildDelete: sinon.spy(TestElementHandlers, "onChildDelete"),
    onChildDeleted: sinon.spy(TestElementHandlers, "onChildDeleted"),
    onChildInsert: sinon.spy(TestElementHandlers, "onChildInsert"),
    onChildInserted: sinon.spy(TestElementHandlers, "onChildInserted"),
    onChildUpdate: sinon.spy(TestElementHandlers, "onChildUpdate"),
    onChildUpdated: sinon.spy(TestElementHandlers, "onChildUpdated"),
    onChildAdd: sinon.spy(TestElementHandlers, "onChildAdd"),
    onChildAdded: sinon.spy(TestElementHandlers, "onChildAdded"),
    onChildDrop: sinon.spy(TestElementHandlers, "onChildDrop"),
    onChildDropped: sinon.spy(TestElementHandlers, "onChildDropped"),
  },
  aspect: {
    onInsert: sinon.spy(TestAspectHandlers, "onInsert"),
    onInserted: sinon.spy(TestAspectHandlers, "onInserted"),
    onUpdate: sinon.spy(TestAspectHandlers, "onUpdate"),
    onUpdated: sinon.spy(TestAspectHandlers, "onUpdated"),
    onDelete: sinon.spy(TestAspectHandlers, "onDelete"),
    onDeleted: sinon.spy(TestAspectHandlers, "onDeleted"),
  },
};

describe("Domain Handlers - Old", () => {

  let iModelDb: StandaloneDb;

  const testChannelKey = "channel 1 for tests";
  let codeSpec: CodeSpec;
  let subjectId: Id64String;
  let modelId: Id64String;

  before(async () => {
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

    // Import Schemas
    iModelDb.saveChanges("Import Functional schema");
    IModelTestUtils.flushTxns(iModelDb);
    await iModelDb.importSchemas([join(KnownTestLocations.assetsDir, "TestHandlers.ecschema.xml")]);
    iModelDb.saveChanges("Import TestHandlers schema");

    // Create Code
    codeSpec = CodeSpec.create(iModelDb, "Test Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Model Domain Handlers", channelKey: testChannelKey });
    iModelDb.channels.addAllowedChannel(testChannelKey);
  });

  after(async () => {
    iModelDb.close();
    Schemas.unregisterSchema(TestSchema.schemaName);
  });

  afterEach(() => {
    // Clear the call history of all spies
    // Model
    modelDomainHandlerOrder = [];
    for (const method in spies.model) {
      if (spies.model.hasOwnProperty(method)) {
        (spies.model[method as keyof typeof spies.model]).resetHistory();
      }
    }
    // SubModel
    for (const method in spies.sub) {
      if (spies.sub.hasOwnProperty(method)) {
        (spies.sub[method as keyof typeof spies.sub]).resetHistory();
      }
    }
    // Aspect
    aspectDomainHandlerOrder = [];
    for (const method in spies.aspect) {
      if (spies.aspect.hasOwnProperty(method)) {
        (spies.aspect[method as keyof typeof spies.aspect]).resetHistory();
      }
    }
    // Element
    elementDomainHandlerOrder = [];
    for (const method in spies.element) {
      if (spies.element.hasOwnProperty(method)) {
        (spies.element[method as keyof typeof spies.element]).resetHistory();
      }
    }
  });

  it("should call all handler functions for an inserted model", async () => {
    const partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Model Handlers");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    // New Element and a sub Model
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    modelId = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });

    // Insert Element into that sub Model
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
    model.update(); // Update the model as a whole
    const element = iModelDb.elements.getElement(elementId);
    element.update(); // Update the element
    model.delete(); // delete the model

    // Check that all model handler functions were called
    assert.isTrue(spies.model.onInsert.called);
    assert.isTrue(spies.model.onInserted.called);
    assert.isTrue(spies.model.onInsertElement.called);
    assert.isTrue(spies.model.onInsertedElement.called);
    assert.isTrue(spies.model.onUpdate.called);
    assert.isTrue(spies.model.onUpdated.called);
    assert.isTrue(spies.model.onUpdateElement.called);
    assert.isTrue(spies.model.onUpdatedElement.called);
    assert.isTrue(spies.model.onDelete.called);
    assert.isTrue(spies.model.onDeleted.called);
    assert.isTrue(spies.model.onDeleteElement.called);
    assert.isTrue(spies.model.onDeletedElement.called);

    // Check that all sub model handler functions were called
    assert.isTrue(spies.sub.onSubModelInsert.called);
    assert.isTrue(spies.sub.onSubModelInserted.called);
    assert.isTrue(spies.sub.onSubModelDelete.called);
    assert.isTrue(spies.sub.onSubModelDeleted.called);
  });

  it("should call all handler functions for an inserted aspect", async () => {
    const partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Aspect Handlers");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    // New Element and a Model
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
    // Insert Element into that Model
    const elementId = iModelDb.elements.insertElement(elementProps);

    const aspectProps = {
      classFullName: TestAspectHandlers.classFullName,
      element: new ElementOwnsUniqueAspect(elementId),
      strProp: "prop 1"
    };
    // Insert Aspect into that Element
    iModelDb.elements.insertAspect(aspectProps);
    aspectProps.strProp = "prop 2";
    iModelDb.elements.updateAspect(aspectProps); // Update the aspect
    const aspect = iModelDb.elements.getAspects(elementId, TestAspectHandlers.classFullName);
    iModelDb.elements.deleteAspect(aspect[0].id); // delete the aspect

    // Check that all aspect handler functions were called
    assert.isTrue(spies.aspect.onInsert.called);
    assert.isTrue(spies.aspect.onInserted.called);
    assert.isTrue(spies.aspect.onUpdate.called);
    assert.isTrue(spies.aspect.onUpdated.called);
    assert.isTrue(spies.aspect.onDelete.called);
    assert.isTrue(spies.aspect.onDeleted.called);

    const model = iModelDb.models.getModel(modelId); // cleanup Model
    model.delete();
  });

  it("should call all handler functions for an inserted element", async () => {
    const partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Element Handlers");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    // New Element and a Model
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
    const element = iModelDb.elements.getElement(elementId);

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

    spies.model.onDeleteElement.resetHistory();
    spies.model.onDeletedElement.resetHistory();
    TestModelHandlers.dontDelete = componentId2; // block deletion through model
    expect(() => component2.delete()).to.throw("dont delete my element");
    TestModelHandlers.dontDelete = ""; // allow deletion through model
    TestElementHandlers.dontDeleteChild = componentId2; // but block through parent
    expect(() => component2.delete()).to.throw("dont delete my child");
    assert.equal(spies.model.onDeleteElement.callCount, 2, "Model.onElementDelete gets called even though element is not really deleted");
    assert.equal(spies.model.onDeletedElement.callCount, 0, "make sure Model.onElementDeleted did not get called");
    TestElementHandlers.dontDeleteChild = ""; // now fully allow delete
    component2.delete();

    componentProps.parent.id = elementId;
    const componentId3 = iModelDb.elements.insertElement(componentProps);
    const component3Props = iModelDb.elements.getElementProps(componentId3);
    component3Props.parent!.id = elementId2;

    iModelDb.elements.updateElement(component3Props);
    element.update(); // Update the element (the above updates and deletes don't count since they aren't the same element type that we are spying on)
    element.delete(); // delete the element

    // Check that all aspect handler functions were called
    assert.isTrue(spies.element.onInsert.called);
    assert.isTrue(spies.element.onInserted.called);
    assert.isTrue(spies.element.onUpdate.called);
    assert.isTrue(spies.element.onUpdated.called);
    assert.isTrue(spies.element.onDelete.called);
    assert.isTrue(spies.element.onDeleted.called);
    assert.isTrue(spies.element.onChildDelete.called);
    assert.isTrue(spies.element.onChildDeleted.called);
    assert.isTrue(spies.element.onChildInsert.called);
    assert.isTrue(spies.element.onChildInserted.called);
    assert.isTrue(spies.element.onChildUpdate.called);
    assert.isTrue(spies.element.onChildUpdated.called);
    assert.isTrue(spies.element.onChildAdd.called);
    assert.isTrue(spies.element.onChildAdded.called);
    assert.isTrue(spies.element.onChildDrop.called);
    assert.isTrue(spies.element.onChildDropped.called);

    const model = iModelDb.models.getModel(modelId);
    model.delete();
  });
});


describe("Domain Handlers - New", () => {

  let iModelDb: StandaloneDb;

  const testChannelKey = "channel 2 for tests";
  let codeSpec: CodeSpec;
  let subjectId: Id64String;
  let modelId: Id64String;

  before(async () => {
    // Create iModel
    iModelDb = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DomainHandlers", "DomainHandlers2.bim"), {
      rootSubject: { name: "HandlerTest2", description: "Test of New Domain Handlers." },
      client: "Functional",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    assert.isTrue(iModelDb !== undefined);
    iModelDb[_nativeDb].resetBriefcaseId(100);

    // Register the schema and classes
    FunctionalSchema.registerSchema();
    Schemas.registerSchema(TestSchema2);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ClassRegistry.registerModule({ TestElementHandlers, TestPartitionHandlers, TestModelHandlers, TestAspectHandlers, Component }, TestSchema2);
    await FunctionalSchema.importSchema(iModelDb);

    // Import Schemas
    iModelDb.saveChanges("Import Functional schema");
    IModelTestUtils.flushTxns(iModelDb);
    await iModelDb.importSchemas([join(KnownTestLocations.assetsDir, "TestHandlers2.ecschema.xml")]);
    iModelDb.saveChanges("Import TestHandlers schema");

    // Create Code
    codeSpec = CodeSpec.create(iModelDb, "Test Domain Handlers", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    subjectId = iModelDb.channels.insertChannelSubject({ subjectName: "Test Model Domain Handlers", channelKey: testChannelKey });
    iModelDb.channels.addAllowedChannel(testChannelKey);
  });

  after(async () => {
    iModelDb.close();
    Schemas.unregisterSchema(TestSchema2.schemaName);
  });

  afterEach(() => {
    // Clear the call history of all spies
    // Model
    modelDomainHandlerOrder = [];
    for (const method in spies.model) {
      if (spies.model.hasOwnProperty(method)) {
        (spies.model[method as keyof typeof spies.model]).resetHistory();
      }
    }
    // SubModel
    for (const method in spies.sub) {
      if (spies.sub.hasOwnProperty(method)) {
        (spies.sub[method as keyof typeof spies.sub]).resetHistory();
      }
    }
    // Aspect
    aspectDomainHandlerOrder = [];
    for (const method in spies.aspect) {
      if (spies.aspect.hasOwnProperty(method)) {
        (spies.aspect[method as keyof typeof spies.aspect]).resetHistory();
      }
    }
    // Element
    elementDomainHandlerOrder = [];
    for (const method in spies.element) {
      if (spies.element.hasOwnProperty(method)) {
        (spies.element[method as keyof typeof spies.element]).resetHistory();
      }
    }
  });

  it("should call all handler functions for an inserted model", async () => {
    const partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Model Handlers");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    // New Element and a sub Model
    const partitionId = iModelDb.elements.insertElement2(partitionProps, {useJsNames: true});
    modelId = iModelDb.models.insertModel({ classFullName: TestModelHandlers.classFullName, modeledElement: { id: partitionId } });

    // Insert Element into that sub Model
    const elementProps: ElementProps = {
      classFullName: TestElementHandlers.classFullName,
      model: modelId,
      code: {
        spec: codeSpec.id,
        scope: modelId,
        value: "Breakdown1"
      }
    };
    const elementId = iModelDb.elements.insertElement2(elementProps, {useJsNames: true});
    const model = iModelDb.models.getModel(modelId);
    model.update(); // Update the model as a whole
    const element = iModelDb.elements.getElement(elementId);
    element.update(); // Update the element
    model.delete(); // delete the model

    // Check that all model handler functions were called
    assert.isTrue(spies.model.onInsert.called);
    assert.isTrue(spies.model.onInserted.called);
    assert.isTrue(spies.model.onInsertElement.called);
    assert.isTrue(spies.model.onInsertedElement.called);
    assert.isTrue(spies.model.onUpdate.called);
    assert.isTrue(spies.model.onUpdated.called);
    assert.isTrue(spies.model.onUpdateElement.called);
    assert.isTrue(spies.model.onUpdatedElement.called);
    assert.isTrue(spies.model.onDelete.called);
    assert.isTrue(spies.model.onDeleted.called);
    assert.isTrue(spies.model.onDeleteElement.called);
    assert.isTrue(spies.model.onDeletedElement.called);

    // Check that all sub model handler functions were called
    assert.isTrue(spies.sub.onSubModelInsert.called);
    assert.isTrue(spies.sub.onSubModelInserted.called);
    assert.isTrue(spies.sub.onSubModelDelete.called);
    assert.isTrue(spies.sub.onSubModelDeleted.called);
  });

  it("should call all handler functions for an inserted aspect", async () => {
    const partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Aspect Handlers");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    // New Element and a Model
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
    // Insert Element into that Model
    const elementId = iModelDb.elements.insertElement(elementProps);

    const aspectProps = {
      classFullName: TestAspectHandlers.classFullName,
      element: new ElementOwnsUniqueAspect(elementId),
      strProp: "prop 1"
    };
    // Insert Aspect into that Element
    iModelDb.elements.insertAspect(aspectProps);
    aspectProps.strProp = "prop 2";
    iModelDb.elements.updateAspect(aspectProps); // Update the aspect
    const aspect = iModelDb.elements.getAspects(elementId, TestAspectHandlers.classFullName);
    iModelDb.elements.deleteAspect(aspect[0].id); // delete the aspect

    // Check that all aspect handler functions were called
    assert.isTrue(spies.aspect.onInsert.called);
    assert.isTrue(spies.aspect.onInserted.called);
    assert.isTrue(spies.aspect.onUpdate.called);
    assert.isTrue(spies.aspect.onUpdated.called);
    assert.isTrue(spies.aspect.onDelete.called);
    assert.isTrue(spies.aspect.onDeleted.called);

    const model = iModelDb.models.getModel(modelId); // cleanup Model
    model.delete();
  });

  it("should call all handler functions for an inserted element", async () => {
    const partitionCode = FunctionalPartition.createCode(iModelDb, subjectId, "Test Element Handlers");
    const partitionProps = {
      classFullName: TestPartitionHandlers.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(subjectId),
      code: partitionCode,
    };

    // New Element and a Model
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
    const element = iModelDb.elements.getElement(elementId);

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

    spies.model.onDeleteElement.resetHistory();
    spies.model.onDeletedElement.resetHistory();
    TestModelHandlers.dontDelete = componentId2; // block deletion through model
    expect(() => component2.delete()).to.throw("dont delete my element");
    TestModelHandlers.dontDelete = ""; // allow deletion through model
    TestElementHandlers.dontDeleteChild = componentId2; // but block through parent
    expect(() => component2.delete()).to.throw("dont delete my child");
    assert.equal(spies.model.onDeleteElement.callCount, 2, "Model.onElementDelete gets called even though element is not really deleted");
    assert.equal(spies.model.onDeletedElement.callCount, 0, "make sure Model.onElementDeleted did not get called");
    TestElementHandlers.dontDeleteChild = ""; // now fully allow delete
    component2.delete();

    componentProps.parent.id = elementId;
    const componentId3 = iModelDb.elements.insertElement(componentProps);
    const component3Props = iModelDb.elements.getElementProps(componentId3);
    component3Props.parent!.id = elementId2;

    iModelDb.elements.updateElement(component3Props);
    element.update(); // Update the element (the above updates and deletes don't count since they aren't the same element type that we are spying on)
    element.delete(); // delete the element

    // Check that all aspect handler functions were called
    assert.isTrue(spies.element.onInsert.called);
    assert.isTrue(spies.element.onInserted.called);
    assert.isTrue(spies.element.onUpdate.called);
    assert.isTrue(spies.element.onUpdated.called);
    assert.isTrue(spies.element.onDelete.called);
    assert.isTrue(spies.element.onDeleted.called);
    assert.isTrue(spies.element.onChildDelete.called);
    assert.isTrue(spies.element.onChildDeleted.called);
    assert.isTrue(spies.element.onChildInsert.called);
    assert.isTrue(spies.element.onChildInserted.called);
    assert.isTrue(spies.element.onChildUpdate.called);
    assert.isTrue(spies.element.onChildUpdated.called);
    assert.isTrue(spies.element.onChildAdd.called);
    assert.isTrue(spies.element.onChildAdded.called);
    assert.isTrue(spies.element.onChildDrop.called);
    assert.isTrue(spies.element.onChildDropped.called);

    const model = iModelDb.models.getModel(modelId);
    model.delete();
  });
});

after(async () => {
  sinon.restore();
});