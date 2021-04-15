/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { join } from "path";
import { Guid, Id64, Id64String } from "@bentley/bentleyjs-core";
import { CodeScopeSpec, CodeSpec, ElementProps, IModel, IModelError } from "@bentley/imodeljs-common";
import { ClassRegistry } from "../../ClassRegistry";
import { ElementUniqueAspect, OnAspectIdArg, OnAspectPropsArg } from "../../ElementAspect";
import {
  BackendRequestContext, FunctionalBreakdownElement, FunctionalComponentElement, FunctionalModel, FunctionalPartition, FunctionalSchema,
  InformationPartitionElement, OnChildElementIdArg, OnChildElementPropsArg, OnElementIdArg, OnElementInModelIdArg, OnElementInModelPropsArg,
  OnElementPropsArg, OnModelIdArg, OnModelPropsArg, OnSubModelIdArg, OnSubModelPropsArg, Schemas, StandaloneDb,
} from "../../imodeljs-backend";
import { ElementOwnsChildElements, ElementOwnsUniqueAspect, SubjectOwnsPartitionElements } from "../../NavigationRelationship";
import { IModelTestUtils } from "../IModelTestUtils";

let iModelDb: StandaloneDb;

/** test schema for supplying element/model/aspect classes */
class TestSchema extends FunctionalSchema {
  public static get schemaName() { return "TestFunctional"; }
}

/** partition element for testing `Element.onSubModelXxx` methods */
class TestFuncPartition extends InformationPartitionElement {
  public static get className() { return "TestFuncPartition"; }

  public static modelId: Id64String;
  public static nInsert = 0;
  public static nInserted = 0;
  public static nDelete = 0;
  public static nDeleted = 0;

  protected static onSubModelInsert(arg: OnSubModelPropsArg): void {
    super.onSubModelInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.subModelProps.classFullName, TestFuncModel.classFullName);
    this.nInsert++;
  }
  protected static onSubModelInserted(arg: OnSubModelIdArg): void {
    super.onSubModelInserted(arg);
    assert.equal(arg.iModel, iModelDb);
    this.modelId = arg.subModelId;
    this.nInserted++;
  }
  protected static onSubModelDelete(arg: OnSubModelIdArg): void {
    super.onSubModelDelete(arg);
    assert.equal(arg.iModel, iModelDb);
    this.modelId = arg.subModelId;
    this.nDelete++;
  }
  protected static onSubModelDeleted(arg: OnSubModelIdArg): void {
    super.onSubModelDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(this.modelId, arg.subModelId);
    this.nDeleted++;
  }
}

/** for testing `Model.onXxx` methods */
class TestFuncModel extends FunctionalModel {
  public static get className() { return "TestFuncModel"; }
  public static insertModelId: Id64String;
  public static updateModelId: Id64String;
  public static deleteModelId: Id64String;
  public static insertedId: Id64String;
  public static updatedId: Id64String;
  public static deletedId: Id64String;
  public static dontDelete = "";
  public static nModelInsert = 0;
  public static nModelUpdate = 0;
  public static nModelUpdated = 0;
  public static nModelDelete = 0;
  public static nModelDeleted = 0;
  public static nElemInsert = 0;
  public static nElemUpdate = 0;
  public static nElemDelete = 0;
  protected static onInsert(arg: OnModelPropsArg): void {
    super.onInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.props.classFullName, this.classFullName);
    this.nModelInsert++;
  }
  protected static onInserted(arg: OnModelIdArg): void {
    super.onInserted(arg);
    assert.equal(arg.iModel, iModelDb);
    this.insertModelId = arg.id;
  }
  protected static onUpdate(arg: OnModelPropsArg): void {
    super.onUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
    this.nModelUpdate++;
  }
  protected static onUpdated(arg: OnModelIdArg): void {
    super.onUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
    this.updateModelId = arg.id;
    this.nModelUpdated++;
  }
  protected static onDelete(arg: OnModelIdArg): void {
    super.onDelete(arg);
    assert.equal(arg.iModel, iModelDb);
    this.nModelDelete++;
  }
  protected static onDeleted(arg: OnModelIdArg): void {
    super.onDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
    this.deleteModelId = arg.id;
    this.nModelDeleted++;
  }
  protected static onInsertElement(arg: OnElementInModelPropsArg): void {
    super.onInsertElement(arg);
    assert.equal(arg.iModel, iModelDb);
    if (arg.elementProps.code.value === "badval")
      throw new IModelError(100, "bad element");
  }
  protected static onInsertedElement(arg: OnElementInModelIdArg): void {
    super.onInsertedElement(arg);
    assert.equal(arg.iModel, iModelDb);
    this.insertedId = arg.elementId;
  }
  protected static onUpdateElement(arg: OnElementInModelPropsArg): void {
    super.onUpdateElement(arg);
    assert.equal(arg.iModel, iModelDb);
    this.nElemUpdate++;
  }
  protected static onUpdatedElement(arg: OnElementInModelIdArg): void {
    super.onUpdatedElement(arg);
    assert.equal(arg.iModel, iModelDb);
    this.updatedId = arg.elementId;
  }
  protected static onDeleteElement(arg: OnElementInModelIdArg): void {
    super.onDeleteElement(arg);
    assert.equal(arg.iModel, iModelDb);
    if (arg.elementId === this.dontDelete)
      throw new Error("dont delete my element");

    this.nElemDelete++;
  }
  protected static onDeletedElement(arg: OnElementInModelIdArg): void {
    super.onDeletedElement(arg);
    assert.equal(arg.iModel, iModelDb);
    this.deletedId = arg.elementId;
  }
}

/** for testing `Element.onXxx` methods */
class Breakdown extends FunctionalBreakdownElement {
  public static get className() { return "Breakdown"; }
  public static elemId: Id64String;
  public static parentId: Id64String;
  public static childId: Id64String;
  public static childAdd?: Id64String;
  public static childDrop?: Id64String;
  public static dropParent?: Id64String;
  public static addParent?: Id64String;
  public static childAdded?: Id64String;
  public static childDropped?: Id64String;
  public static droppedParent?: Id64String;
  public static addedParent?: Id64String;
  public static props?: Readonly<ElementProps>;
  public static dontDeleteChild = "";
  public static nUpdate = 0;
  public static nUpdated = 0;
  public static nDelete = 0;
  public static nDeleted = 0;

  protected static onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.props.classFullName, this.classFullName);
    this.props = arg.props;
  }
  protected static onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    assert.equal(arg.iModel, iModelDb);
    this.elemId = arg.id;
  }
  protected static onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.props.classFullName, this.classFullName);
    this.nUpdate++;
  }
  protected static onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
    this.nUpdated++;
  }
  protected static onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    assert.equal(arg.iModel, iModelDb);
    this.nDelete++;
  }
  protected static onDeleted(arg: OnElementIdArg): void {
    super.onDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
    this.elemId = arg.id;
    this.nDeleted++;
  }
  protected static onChildDelete(arg: OnChildElementIdArg): void {
    super.onChildDelete(arg);
    assert.equal(arg.iModel, iModelDb);
    if (arg.childId === this.dontDeleteChild)
      throw new Error("dont delete my child");
    this.childId = this.childId;
    this.parentId = arg.parentId;
  }
  protected static onChildDeleted(arg: OnChildElementIdArg): void {
    super.onChildDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(this.childId, arg.childId);
    assert.equal(arg.parentId, this.parentId);
  }
  protected static onChildInsert(arg: OnChildElementPropsArg): void {
    super.onChildInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    this.parentId = arg.parentId;
  }
  protected static onChildInserted(arg: OnChildElementIdArg): void {
    super.onChildInserted(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.parentId, this.parentId);
    this.childId = arg.childId;
  }
  protected static onChildUpdate(arg: OnChildElementPropsArg): void {
    super.onChildUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
    this.parentId = arg.parentId;
  }
  protected static onChildUpdated(arg: OnChildElementIdArg): void {
    super.onChildUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.parentId, this.parentId);
    this.childId = arg.childId;
  }
  protected static onChildAdd(arg: OnChildElementPropsArg): void {
    super.onChildAdd(arg);
    assert.equal(arg.iModel, iModelDb);
    this.childAdd = arg.childProps.id;
    this.addParent = arg.parentId;
  }
  protected static onChildAdded(arg: OnChildElementIdArg): void {
    super.onChildAdded(arg);
    assert.equal(arg.iModel, iModelDb);
    this.childAdded = arg.childId;
    this.addedParent = arg.parentId;
  }
  protected static onChildDrop(arg: OnChildElementIdArg): void {
    super.onChildDrop(arg);
    assert.equal(arg.iModel, iModelDb);
    this.childDrop = arg.childId;
    this.dropParent = arg.parentId;
  }
  protected static onChildDropped(arg: OnChildElementIdArg): void {
    super.onChildDropped(arg);
    assert.equal(arg.iModel, iModelDb);
    this.childDropped = arg.childId;
    this.droppedParent = arg.parentId;
  }
}

/** for testing `ElementAspect.onXxx` methods */
class TestFuncAspect extends ElementUniqueAspect {
  public static get className() { return "TestFuncAspect"; }
  public static expectedVal = "";
  public static elemId: Id64String;
  public static aspectId: Id64String;
  public static nInsert = 0;
  public static nInserted = 0;
  public static nUpdate = 0;
  public static nUpdated = 0;
  public static nDelete = 0;
  public static nDeleted = 0;

  protected static onInsert(arg: OnAspectPropsArg): void {
    super.onInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
    this.elemId = arg.props.element.id;
    this.nInsert++;
  }
  protected static onInserted(arg: OnAspectPropsArg): void {
    super.onInserted(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
    assert.equal(this.elemId, arg.props.element.id);
    this.nInserted++;
  }
  protected static onUpdate(arg: OnAspectPropsArg): void {
    super.onUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
    this.elemId = arg.props.element.id;
    this.nUpdate++;
  }
  protected static onUpdated(arg: OnAspectPropsArg): void {
    super.onUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
    assert.equal(this.elemId, arg.props.element.id);
    this.nUpdated++;
  }
  protected static onDelete(arg: OnAspectIdArg): void {
    super.onDelete(arg);
    assert.equal(arg.iModel, iModelDb);
    this.aspectId = arg.aspectId;
    this.nDelete++;
  }
  protected static onDeleted(arg: OnAspectIdArg): void {
    super.onDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.aspectId, this.aspectId);
    this.nDeleted++;
  }
}

class Component extends FunctionalComponentElement {
  public static get className() { return "Component"; }

}

describe("Functional Domain", () => {
  const requestContext = new BackendRequestContext();

  it("should populate FunctionalModel and test Element, Model, and ElementAspect callbacks", async () => {
    iModelDb = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("FunctionalDomain", "FunctionalTest.bim"), {
      rootSubject: { name: "FunctionalTest", description: "Test of the Functional domain schema." },
      client: "Functional",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    iModelDb.nativeDb.resetBriefcaseId(100);

    // Import the Functional schema
    FunctionalSchema.registerSchema();
    Schemas.registerSchema(TestSchema);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    ClassRegistry.registerModule({ TestFuncPartition, TestFuncModel, Breakdown, Component, TestFuncAspect }, TestSchema);

    await FunctionalSchema.importSchema(requestContext, iModelDb); // eslint-disable-line deprecation/deprecation

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

    IModelTestUtils.flushTxns(iModelDb); // importSchema below will fail if this is not called to flush local changes

    await iModelDb.importSchemas(requestContext, [join(__dirname, "../assets/TestFunctional.ecschema.xml")]);

    iModelDb.saveChanges("Import TestFunctional schema");
    assert.equal(commits, 1);
    assert.equal(committed, 1);

    const codeSpec = CodeSpec.create(iModelDb, "Test Functional Elements", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));

    const partitionCode = FunctionalPartition.createCode(iModelDb, IModel.rootSubjectId, "Test Functional Model");
    const partitionProps = {
      classFullName: TestFuncPartition.classFullName, model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId), code: partitionCode,
    };

    let partitionId = iModelDb.elements.insertElement(partitionProps);
    const modelId = iModelDb.models.insertModel({ classFullName: TestFuncModel.classFullName, modeledElement: { id: partitionId } });

    assert.isTrue(Id64.isValidId64(modelId));
    assert.equal(TestFuncModel.insertModelId, modelId, "from Model.onInsert");
    assert.equal(TestFuncModel.nModelInsert, 1, "Model.onInsert should be called once");
    assert.equal(TestFuncModel.nModelUpdate, 0, "model insert should not call onUpdate");
    assert.equal(TestFuncModel.nModelUpdated, 0, "model insert should not call onUpdated");
    assert.equal(TestFuncPartition.nInsert, 1, "model insert should call Element.onSubModelInsert");
    assert.equal(TestFuncPartition.nInserted, 1, "model insert should call Element.onSubModelInserted");
    assert.equal(TestFuncPartition.modelId, modelId, "Element.onSubModelInserted should have correct subModelId");

    partitionProps.code.value = "Test Func 2";
    partitionId = iModelDb.elements.insertElement(partitionProps);
    const modelId2 = iModelDb.models.insertModel({ classFullName: TestFuncModel.classFullName, modeledElement: { id: partitionId } });
    assert.isTrue(Id64.isValidId64(modelId2));
    assert.equal(TestFuncModel.insertModelId, modelId2, "second insert should set new id");
    assert.equal(TestFuncModel.nModelInsert, 2, "Model.onInsert should now be called twice");
    assert.equal(TestFuncPartition.nInsert, 2, "model insert should call Element.onSubModelInsert again");
    assert.equal(TestFuncPartition.nInserted, 2, "model insert should call Element.onSubModelInserted again");
    assert.equal(TestFuncPartition.modelId, modelId2, "Element.onSubModelInserted should have correct subModelId again");

    const model2 = iModelDb.models.getModel(modelId2);
    model2.update();
    assert.equal(TestFuncModel.updateModelId, modelId2, "from Model.onUpdate");
    assert.equal(TestFuncModel.nModelUpdate, 1, "Model.onUpdate should be called once");
    assert.equal(TestFuncModel.nModelUpdated, 1, "Model.onUpdated should be called once");

    TestFuncPartition.modelId = ""; // so we can check that delete gets it right
    model2.delete();
    assert.equal(TestFuncModel.deleteModelId, modelId2);
    assert.equal(TestFuncModel.nModelDelete, 1, "Model.onDelete should be called once");
    assert.equal(TestFuncModel.nModelDeleted, 1, "Model.onDeleted should be called once");
    assert.equal(TestFuncPartition.nDelete, 1, "model delete should call Element.onSubModelDelete");
    assert.equal(TestFuncPartition.nDeleted, 1, "model delete should call Element.onSubModelDeleted");
    assert.equal(TestFuncPartition.modelId, modelId2, "Element.onSubModelDeleted should have correct subModelId");

    const breakdownProps = { classFullName: Breakdown.classFullName, model: modelId, code: { spec: codeSpec.id, scope: modelId, value: "Breakdown1" } };
    const breakdownId = elements.insertElement(breakdownProps);
    assert.isTrue(Id64.isValidId64(breakdownId));
    assert.equal(TestFuncModel.insertedId, breakdownId, "from Model.onElementInserted");
    assert.equal(Breakdown.elemId, breakdownId, "from Element.onInserted");
    assert.equal(Breakdown.props, breakdownProps, "from Element.onInsert");

    const breakdown2Props = { classFullName: Breakdown.classFullName, model: modelId, code: { spec: codeSpec.id, scope: modelId, value: "badval" } };
    // TestFuncModel.onInsertElement throws for this code.value
    expect(() => elements.insertElement(breakdown2Props)).to.throw("bad element");

    breakdown2Props.code.value = "Breakdown2";
    Breakdown.props = undefined;
    const bd2 = elements.insertElement(breakdown2Props);

    const aspect = { classFullName: TestFuncAspect.classFullName, element: new ElementOwnsUniqueAspect(bd2), strProp: "prop 1" };

    TestFuncAspect.expectedVal = aspect.strProp;
    elements.insertAspect(aspect);
    assert.equal(TestFuncAspect.elemId, bd2, "elemId from ElementAspect.onInserted");
    assert.equal(TestFuncAspect.nInsert, 1, "ElementAspect.onInsert should be called once");
    assert.equal(TestFuncAspect.nInserted, 1, "ElementAspect.onInserted should be called once");

    aspect.strProp = "prop 2";
    TestFuncAspect.expectedVal = aspect.strProp;
    elements.updateAspect(aspect);
    assert.equal(TestFuncAspect.elemId, bd2, "from ElementAspect.onUpdated");
    assert.equal(TestFuncAspect.nInsert, 1, "ElementAspect.onInsert should not be called on update");
    assert.equal(TestFuncAspect.nInserted, 1, "ElementAspect.onInserted should should not be called on update");
    assert.equal(TestFuncAspect.nUpdate, 1, "ElementAspect.onUpdate should be called");
    assert.equal(TestFuncAspect.nUpdated, 1, "ElementAspect.onUpdated should should be called");
    const aspects = elements.getAspects(bd2, TestFuncAspect.classFullName);
    assert.equal(aspects.length, 1);
    elements.deleteAspect(aspects[0].id);
    assert.equal(TestFuncAspect.aspectId, aspects[0].id);
    assert.equal(TestFuncAspect.nDelete, 1, "ElementAspect.onDelete should be called");
    assert.equal(TestFuncAspect.nDeleted, 1, "ElementAspect.onDeleted should be called");

    const bd2el = elements.getElement(bd2);
    Breakdown.nUpdated = 0;
    bd2el.update();
    assert.equal(Breakdown.nUpdate, 1, "Element.onUpdate should be called once");
    assert.equal(Breakdown.nUpdated, 1, "Element.onUpdated should be called once");

    bd2el.delete();
    assert.equal(Breakdown.elemId, bd2, "from onDelete");
    assert.equal(Breakdown.nDelete, 1, "Element.onDelete should be called once");
    assert.equal(Breakdown.nDeleted, 1, "Element.onDeleted should be called once");

    const breakdown3Props = {
      classFullName: Breakdown.classFullName,
      model: modelId,
      code: { spec: codeSpec.id, scope: modelId, value: "bd3" },
    };
    const bd3 = elements.insertElement(breakdown3Props);

    const componentProps = {
      classFullName: Component.classFullName,
      model: modelId,
      parent: { id: breakdownId, relClassName: ElementOwnsChildElements.classFullName },
      code: { spec: codeSpec.id, scope: modelId, value: "Component1" },
    };
    const componentId = elements.insertElement(componentProps);
    assert.isTrue(Id64.isValidId64(componentId));
    assert.equal(Breakdown.childId, componentId, "Element.onChildInserted should set childId");

    // test model and element callbacks for updateElement
    Breakdown.childId = "";
    Breakdown.elemId = "";
    TestFuncModel.nElemUpdate = 0;
    const compponent1 = elements.getElement(componentId);
    compponent1.update();
    assert.equal(TestFuncModel.nElemUpdate, 1, "Model.onUpdateElement should be called");
    assert.equal(TestFuncModel.updatedId, componentId, "from Model.onUpdatedElement");
    assert.equal(Breakdown.parentId, breakdownId, "from Element.onChildUpdate");
    assert.equal(Breakdown.childId, componentId, "from Element.onChildUpdated");

    componentProps.code.value = "comp2";
    const comp2 = elements.insertElement(componentProps);
    assert.equal(Breakdown.childId, comp2, "from Element.onChildInserted");
    const el2 = elements.getElement(comp2);

    TestFuncModel.nElemDelete = 0;
    TestFuncModel.deletedId = "";
    TestFuncModel.dontDelete = comp2; // block deletion through model
    expect(() => el2.delete()).to.throw("dont delete my element");
    TestFuncModel.dontDelete = ""; // allow deletion through model
    Breakdown.dontDeleteChild = comp2; // but block through parent
    expect(() => el2.delete()).to.throw("dont delete my child"); // nope
    assert.equal(TestFuncModel.nElemDelete, 1, "Model.onElementDelete gets called even though element is not really deleted");
    assert.equal(TestFuncModel.deletedId, "", "make sure Model.onElementDeleted did not get called");
    Breakdown.dontDeleteChild = ""; // now fully allow delete
    el2.delete();
    assert.equal(TestFuncModel.nElemDelete, 2, "Model.onElementDelete should be called again");
    assert.equal(TestFuncModel.deletedId, comp2, "from Model.onElementDeleted");
    assert.equal(Breakdown.childId, comp2, "from Element.onChildDeleted");

    // next we make sure that changing the parent of an element calls the "onChildAdd/Drop/Added/Dropped" callbacks.
    // To do this we switch a component's parent from "breakDownId" to "bc3"
    componentProps.parent.id = bd3;
    const comp3 = elements.insertElement(componentProps);
    const compEl3 = elements.getElementProps(comp3);
    compEl3.parent!.id = breakdownId;
    elements.updateElement(compEl3);
    assert.equal(Breakdown.addParent, breakdownId, "get parent from Element.onChildAdd");
    assert.equal(Breakdown.dropParent, bd3, "get parent from Element.onChildDrop");
    assert.equal(Breakdown.childAdd, comp3, "get child from Element.onChildAdd");
    assert.equal(Breakdown.childDrop, comp3, "get child from Element.onChildDrop");
    assert.equal(Breakdown.addedParent, breakdownId, "get parent from Element.onChildAdded");
    assert.equal(Breakdown.droppedParent, bd3, "get parent from Element.onChildDropped");
    assert.equal(Breakdown.childAdded, comp3, "get child from Element.onChildAdded");
    assert.equal(Breakdown.childDropped, comp3, "get child from Element.onChildDropped");

    iModelDb.saveChanges("Insert Functional elements");

    // unregister test schema to make sure it will throw exceptions if it is not present (since it has the "SchemaHasBehavior" custom attribute)
    Schemas.unregisterSchema(TestSchema.schemaName);
    const errMsg = "Schema [TestFunctional] not registered, but is marked with SchemaHasBehavior";
    expect(() => elements.deleteElement(breakdownId)).to.throw(errMsg);
    assert.isDefined(elements.getElement(breakdownId), "should not have been deleted");
    expect(() => elements.updateElement(breakdownProps)).to.throw(errMsg);
    breakdownProps.code.value = "Breakdown 2";
    expect(() => elements.insertElement(breakdownProps)).to.throw(errMsg);

    iModelDb.close();
  });
});
