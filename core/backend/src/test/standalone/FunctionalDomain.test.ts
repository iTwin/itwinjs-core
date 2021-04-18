/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { join } from "path";
import * as sinon from "sinon";
import { Guid, Id64 } from "@bentley/bentleyjs-core";
import { CodeScopeSpec, CodeSpec, IModel, IModelError } from "@bentley/imodeljs-common";
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

  public static onSubModelInsert(arg: OnSubModelPropsArg): void {
    super.onSubModelInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.subModelProps.classFullName, TestFuncModel.classFullName);
  }
  public static onSubModelInserted(arg: OnSubModelIdArg): void {
    super.onSubModelInserted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onSubModelDelete(arg: OnSubModelIdArg): void {
    super.onSubModelDelete(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onSubModelDeleted(arg: OnSubModelIdArg): void {
    super.onSubModelDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
}

/** for testing `Model.onXxx` methods */
class TestFuncModel extends FunctionalModel {
  public static get className() { return "TestFuncModel"; }
  public static dontDelete = "";

  public static onInsert(arg: OnModelPropsArg): void {
    super.onInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.props.classFullName, this.classFullName);
  }
  public static onInserted(arg: OnModelIdArg): void {
    super.onInserted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onUpdate(arg: OnModelPropsArg): void {
    super.onUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onUpdated(arg: OnModelIdArg): void {
    super.onUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onDelete(arg: OnModelIdArg): void {
    super.onDelete(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onDeleted(arg: OnModelIdArg): void {
    super.onDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onInsertElement(arg: OnElementInModelPropsArg): void {
    super.onInsertElement(arg);
    assert.equal(arg.iModel, iModelDb);
    if (arg.elementProps.code.value === "badval")
      throw new IModelError(100, "bad element");
  }
  public static onInsertedElement(arg: OnElementInModelIdArg): void {
    super.onInsertedElement(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onUpdateElement(arg: OnElementInModelPropsArg): void {
    super.onUpdateElement(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onUpdatedElement(arg: OnElementInModelIdArg): void {
    super.onUpdatedElement(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onDeleteElement(arg: OnElementInModelIdArg): void {
    super.onDeleteElement(arg);
    assert.equal(arg.iModel, iModelDb);
    if (arg.elementId === this.dontDelete)
      throw new Error("dont delete my element");
  }
  public static onDeletedElement(arg: OnElementInModelIdArg): void {
    super.onDeletedElement(arg);
    assert.equal(arg.iModel, iModelDb);
  }
}

/** for testing `Element.onXxx` methods */
class Breakdown extends FunctionalBreakdownElement {
  public static get className() { return "Breakdown"; }
  public static dontDeleteChild = "";

  public static onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.props.classFullName, this.classFullName);
  }
  public static onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal(arg.props.classFullName, this.classFullName);
  }
  public static onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onDeleted(arg: OnElementIdArg): void {
    super.onDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildDelete(arg: OnChildElementIdArg): void {
    super.onChildDelete(arg);
    assert.equal(arg.iModel, iModelDb);
    if (arg.childId === this.dontDeleteChild)
      throw new Error("dont delete my child");
  }
  public static onChildDeleted(arg: OnChildElementIdArg): void {
    super.onChildDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildInsert(arg: OnChildElementPropsArg): void {
    super.onChildInsert(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildInserted(arg: OnChildElementIdArg): void {
    super.onChildInserted(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildUpdate(arg: OnChildElementPropsArg): void {
    super.onChildUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildUpdated(arg: OnChildElementIdArg): void {
    super.onChildUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildAdd(arg: OnChildElementPropsArg): void {
    super.onChildAdd(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildAdded(arg: OnChildElementIdArg): void {
    super.onChildAdded(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildDrop(arg: OnChildElementIdArg): void {
    super.onChildDrop(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onChildDropped(arg: OnChildElementIdArg): void {
    super.onChildDropped(arg);
    assert.equal(arg.iModel, iModelDb);
  }
}

/** for testing `ElementAspect.onXxx` methods */
class TestFuncAspect extends ElementUniqueAspect {
  public static get className() { return "TestFuncAspect"; }
  public static expectedVal = "";

  public static onInsert(arg: OnAspectPropsArg): void {
    super.onInsert(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
  }
  public static onInserted(arg: OnAspectPropsArg): void {
    super.onInserted(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
  }
  public static onUpdate(arg: OnAspectPropsArg): void {
    super.onUpdate(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
  }
  public static onUpdated(arg: OnAspectPropsArg): void {
    super.onUpdated(arg);
    assert.equal(arg.iModel, iModelDb);
    assert.equal((arg.props as any).strProp, this.expectedVal);
  }
  public static onDelete(arg: OnAspectIdArg): void {
    super.onDelete(arg);
    assert.equal(arg.iModel, iModelDb);
  }
  public static onDeleted(arg: OnAspectIdArg): void {
    super.onDeleted(arg);
    assert.equal(arg.iModel, iModelDb);
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

    const modelSpy = {
      onInsert: sinon.spy(TestFuncModel, "onInsert"),
      onInserted: sinon.spy(TestFuncModel, "onInserted"),
      onUpdate: sinon.spy(TestFuncModel, "onUpdate"),
      onUpdated: sinon.spy(TestFuncModel, "onUpdated"),
      onDelete: sinon.spy(TestFuncModel, "onDelete"),
      onDeleted: sinon.spy(TestFuncModel, "onDeleted"),
      onInsertElement: sinon.spy(TestFuncModel, "onInsertElement"),
      onInsertedElement: sinon.spy(TestFuncModel, "onInsertedElement"),
      onUpdateElement: sinon.spy(TestFuncModel, "onUpdateElement"),
      onUpdatedElement: sinon.spy(TestFuncModel, "onUpdatedElement"),
      onDeleteElement: sinon.spy(TestFuncModel, "onDeleteElement"),
      onDeletedElement: sinon.spy(TestFuncModel, "onDeletedElement"),
    };

    const partitionSpy = {
      onSubModelInsert: sinon.spy(TestFuncPartition, "onSubModelInsert"),
      onSubModelInserted: sinon.spy(TestFuncPartition, "onSubModelInserted"),
      onSubModelDelete: sinon.spy(TestFuncPartition, "onSubModelDelete"),
      onSubModelDeleted: sinon.spy(TestFuncPartition, "onSubModelDeleted"),
    };

    const breakdownSpy = {
      onInsert: sinon.spy(Breakdown, "onInsert"),
      onInserted: sinon.spy(Breakdown, "onInserted"),
      onUpdate: sinon.spy(Breakdown, "onUpdate"),
      onUpdated: sinon.spy(Breakdown, "onUpdated"),
      onDelete: sinon.spy(Breakdown, "onDelete"),
      onDeleted: sinon.spy(Breakdown, "onDeleted"),
      onChildDelete: sinon.spy(Breakdown, "onChildDelete"),
      onChildDeleted: sinon.spy(Breakdown, "onChildDeleted"),
      onChildInsert: sinon.spy(Breakdown, "onChildInsert"),
      onChildInserted: sinon.spy(Breakdown, "onChildInserted"),
      onChildUpdate: sinon.spy(Breakdown, "onChildUpdate"),
      onChildUpdated: sinon.spy(Breakdown, "onChildUpdated"),
      onChildAdd: sinon.spy(Breakdown, "onChildAdd"),
      onChildAdded: sinon.spy(Breakdown, "onChildAdded"),
      onChildDrop: sinon.spy(Breakdown, "onChildDrop"),
      onChildDropped: sinon.spy(Breakdown, "onChildDropped"),
    };

    const aspectSpy = {
      onInsert: sinon.spy(TestFuncAspect, "onInsert"),
      onInserted: sinon.spy(TestFuncAspect, "onInserted"),
      onUpdate: sinon.spy(TestFuncAspect, "onUpdate"),
      onUpdated: sinon.spy(TestFuncAspect, "onUpdated"),
      onDelete: sinon.spy(TestFuncAspect, "onDelete"),
      onDeleted: sinon.spy(TestFuncAspect, "onDeleted"),
    };

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
    assert.isTrue(modelSpy.onInsert.calledOnce);
    assert.isTrue(modelSpy.onInserted.calledOnce);
    assert.equal(modelSpy.onInserted.getCall(0).args[0].id, modelId);
    assert.isFalse(modelSpy.onUpdate.called, "model insert should not call onUpdate");
    assert.isFalse(modelSpy.onUpdated.called, "model insert should not call onUpdated");

    assert.isTrue(partitionSpy.onSubModelInsert.calledOnce);
    assert.isTrue(partitionSpy.onSubModelInserted.calledOnce);
    assert.equal(partitionSpy.onSubModelInserted.getCall(0).args[0].subModelId, modelId, "Element.onSubModelInserted should have correct subModelId");

    partitionProps.code.value = "Test Func 2";
    partitionId = iModelDb.elements.insertElement(partitionProps);
    const modelId2 = iModelDb.models.insertModel({ classFullName: TestFuncModel.classFullName, modeledElement: { id: partitionId } });
    assert.isTrue(Id64.isValidId64(modelId2));
    assert.equal(modelSpy.onInserted.getCall(1).args[0].id, modelId2, "second insert should set new id");
    assert.equal(modelSpy.onInsert.callCount, 2);
    assert.equal(modelSpy.onInserted.callCount, 2);
    assert.equal(partitionSpy.onSubModelInserted.getCall(1).args[0].subModelId, modelId2, "Element.onSubModelInserted should have correct subModelId");

    const model2 = iModelDb.models.getModel(modelId2);
    model2.update();
    assert.equal(modelSpy.onUpdated.getCall(0).args[0].id, modelId2);
    assert.equal(modelSpy.onUpdate.callCount, 1);
    assert.equal(modelSpy.onUpdated.callCount, 1);

    model2.delete();
    assert.isTrue(modelSpy.onDelete.calledOnce);
    assert.isTrue(modelSpy.onDeleted.calledOnce);
    assert.equal(modelSpy.onDeleted.getCall(0).args[0].id, modelId2);
    assert.isTrue(partitionSpy.onSubModelDelete.calledOnce);
    assert.isTrue(partitionSpy.onSubModelDeleted.calledOnce);
    assert.equal(partitionSpy.onSubModelDeleted.getCall(0).args[0].subModelId, modelId2);

    const breakdownProps = { classFullName: Breakdown.classFullName, model: modelId, code: { spec: codeSpec.id, scope: modelId, value: "Breakdown1" } };
    const breakdownId = elements.insertElement(breakdownProps);
    assert.isTrue(Id64.isValidId64(breakdownId));
    assert.isTrue(modelSpy.onInsertElement.calledOnce);
    assert.isTrue(modelSpy.onInsertedElement.calledOnce);
    assert.equal(modelSpy.onInsertedElement.getCall(0).args[0].elementId, breakdownId);

    assert.isTrue(breakdownSpy.onInsert.calledOnce);
    assert.isTrue(breakdownSpy.onInserted.calledOnce);
    assert.equal(breakdownSpy.onInserted.getCall(0).args[0].id, breakdownId);
    assert.equal(breakdownSpy.onInsert.getCall(0).args[0].props, breakdownProps);

    const breakdown2Props = { classFullName: Breakdown.classFullName, model: modelId, code: { spec: codeSpec.id, scope: modelId, value: "badval" } };
    // TestFuncModel.onInsertElement throws for this code.value
    expect(() => elements.insertElement(breakdown2Props)).to.throw("bad element");

    breakdown2Props.code.value = "Breakdown2";
    const bd2 = elements.insertElement(breakdown2Props);

    const aspect = { classFullName: TestFuncAspect.classFullName, element: new ElementOwnsUniqueAspect(bd2), strProp: "prop 1" };

    TestFuncAspect.expectedVal = aspect.strProp;
    elements.insertAspect(aspect);
    assert.isTrue(aspectSpy.onInsert.calledOnce);
    assert.isTrue(aspectSpy.onInserted.calledOnce);
    assert.isFalse(aspectSpy.onUpdate.called);
    assert.isFalse(aspectSpy.onUpdated.called);
    assert.equal(aspectSpy.onInserted.getCall(0).args[0].props.element.id, bd2, "elemId from ElementAspect.onInserted");

    aspect.strProp = "prop 2";
    TestFuncAspect.expectedVal = aspect.strProp;
    elements.updateAspect(aspect);
    assert.equal(aspectSpy.onInsert.callCount, 1, "ElementAspect.onInsert should not be called on update");
    assert.equal(aspectSpy.onInsert.callCount, 1, "ElementAspect.onInserted should should not be called on update");
    assert.equal(aspectSpy.onUpdate.callCount, 1);
    assert.equal(aspectSpy.onUpdated.callCount, 1);
    assert.equal(aspectSpy.onUpdated.getCall(0).args[0].props.element.id, bd2, "from ElementAspect.onUpdated");
    const aspects = elements.getAspects(bd2, TestFuncAspect.classFullName);
    assert.equal(aspects.length, 1);
    elements.deleteAspect(aspects[0].id);
    assert.equal(aspectSpy.onDelete.callCount, 1);
    assert.equal(aspectSpy.onDeleted.callCount, 1);
    assert.equal(aspectSpy.onDelete.getCall(0).args[0].aspectId, aspects[0].id);
    assert.equal(aspectSpy.onDeleted.getCall(0).args[0].aspectId, aspects[0].id);

    const bd2el = elements.getElement(bd2);
    breakdownSpy.onUpdate.resetHistory();
    breakdownSpy.onUpdated.resetHistory();
    bd2el.update();
    assert.equal(breakdownSpy.onUpdate.callCount, 1);
    assert.equal(breakdownSpy.onUpdated.callCount, 1);
    assert.equal(breakdownSpy.onUpdate.getCall(0).args[0].props.id, bd2);
    assert.equal(breakdownSpy.onUpdated.getCall(0).args[0].id, bd2);

    bd2el.delete();
    assert.equal(breakdownSpy.onDelete.callCount, 1);
    assert.equal(breakdownSpy.onDeleted.callCount, 1);
    assert.equal(breakdownSpy.onDelete.getCall(0).args[0].id, bd2);
    assert.equal(breakdownSpy.onDeleted.getCall(0).args[0].id, bd2);

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
    assert.equal(breakdownSpy.onChildInserted.callCount, 1);
    assert.equal(breakdownSpy.onChildInserted.getCall(0).args[0].childId, componentId);

    // test model and element callbacks for updateElement
    modelSpy.onUpdateElement.resetHistory();
    modelSpy.onUpdatedElement.resetHistory();
    const compponent1 = elements.getElement(componentId);
    compponent1.update();
    assert.equal(modelSpy.onUpdateElement.callCount, 1);
    assert.equal(modelSpy.onUpdatedElement.callCount, 1);
    assert.equal(modelSpy.onUpdatedElement.getCall(0).args[0].elementId, componentId);
    assert.equal(breakdownSpy.onChildUpdate.callCount, 1);
    assert.equal(breakdownSpy.onChildUpdated.callCount, 1);
    assert.equal(breakdownSpy.onChildUpdate.getCall(0).args[0].parentId, breakdownId);
    assert.equal(breakdownSpy.onChildUpdated.getCall(0).args[0].childId, componentId);

    componentProps.code.value = "comp2";
    const comp2 = elements.insertElement(componentProps);
    assert.equal(breakdownSpy.onChildInserted.callCount, 2);
    assert.equal(breakdownSpy.onChildInserted.getCall(1).args[0].childId, comp2);
    const el2 = elements.getElement(comp2);

    modelSpy.onDeleteElement.resetHistory();
    modelSpy.onDeletedElement.resetHistory();
    TestFuncModel.dontDelete = comp2; // block deletion through model
    expect(() => el2.delete()).to.throw("dont delete my element");
    TestFuncModel.dontDelete = ""; // allow deletion through model
    Breakdown.dontDeleteChild = comp2; // but block through parent
    expect(() => el2.delete()).to.throw("dont delete my child"); // nope
    assert.equal(modelSpy.onDeleteElement.callCount, 2, "Model.onElementDelete gets called even though element is not really deleted");
    assert.equal(modelSpy.onDeletedElement.callCount, 0, "make sure Model.onElementDeleted did not get called");
    Breakdown.dontDeleteChild = ""; // now fully allow delete
    el2.delete();
    assert.equal(modelSpy.onDeleteElement.callCount, 3, "Model.onElementDelete should be called again");
    assert.equal(modelSpy.onDeletedElement.callCount, 1);
    assert.equal(modelSpy.onDeletedElement.getCall(0).args[0].elementId, comp2);
    assert.equal(breakdownSpy.onChildDeleted.callCount, 1);
    assert.equal(breakdownSpy.onChildDeleted.getCall(0).args[0].childId, comp2);

    // next we make sure that changing the parent of an element calls the "onChildAdd/Drop/Added/Dropped" callbacks.
    // To do this we switch a component's parent from "breakDownId" to "bc3"
    componentProps.parent.id = bd3;
    const comp3 = elements.insertElement(componentProps);
    const compEl3 = elements.getElementProps(comp3);
    compEl3.parent!.id = breakdownId;
    elements.updateElement(compEl3);

    assert.equal(breakdownSpy.onChildAdd.callCount, 1);
    assert.equal(breakdownSpy.onChildAdd.getCall(0).args[0].parentId, breakdownId);
    assert.equal(breakdownSpy.onChildAdd.getCall(0).args[0].childProps.id, comp3);
    assert.equal(breakdownSpy.onChildDrop.callCount, 1);
    assert.equal(breakdownSpy.onChildDrop.getCall(0).args[0].parentId, bd3);
    assert.equal(breakdownSpy.onChildDrop.getCall(0).args[0].childId, comp3);
    assert.equal(breakdownSpy.onChildAdded.callCount, 1);
    assert.equal(breakdownSpy.onChildAdded.getCall(0).args[0].parentId, breakdownId);
    assert.equal(breakdownSpy.onChildAdded.getCall(0).args[0].childId, comp3);
    assert.equal(breakdownSpy.onChildDropped.callCount, 1);
    assert.equal(breakdownSpy.onChildDropped.getCall(0).args[0].parentId, bd3);
    assert.equal(breakdownSpy.onChildDropped.getCall(0).args[0].childId, comp3);

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
