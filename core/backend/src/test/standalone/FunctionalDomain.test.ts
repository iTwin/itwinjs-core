/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import { Guid, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Code, CodeScopeSpec, CodeSpec, ElementProps, FunctionalElementProps, IModel, IModelError } from "@bentley/imodeljs-common";
import { BackendRequestContext, FunctionalBreakdownElement, FunctionalComponentElement, FunctionalModel, FunctionalSchema, OnChildElementIdArg, OnChildElementPropsArg, OnElementIdArg, OnElementInModelIdArg, OnElementInModelPropsArg, OnElementPropsArg, OnModelIdArg, OnModelPropsArg, Schemas, StandaloneDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { ClassRegistry } from "../../ClassRegistry";
import { ElementOwnsChildElements } from "../../NavigationRelationship";

class TestSchema extends FunctionalSchema {
  public static get schemaName(): string { return "TestFunctional"; }
}

let iModelDb: StandaloneDb;

class TestFuncModel extends FunctionalModel {
  public static get className(): string { return "TestFuncModel"; }
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
  protected static onInsert(_arg: OnModelPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    assert.equal(_arg.props.classFullName, this.classFullName);
    this.nModelInsert++;
  }
  protected static onInserted(_arg: OnModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.insertModelId = _arg.id;
  }
  protected static onUpdate(_arg: OnModelPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.nModelUpdate++;
  }
  protected static onUpdated(_arg: OnModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.updateModelId = _arg.id;
    this.nModelUpdated++;
  }
  protected static onDelete(_arg: OnModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.nModelDelete++;
  }
  protected static onDeleted(_arg: OnModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.deleteModelId = _arg.id;
    this.nModelDeleted++;
  }
  protected static onInsertElement(_arg: OnElementInModelPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    if (_arg.elementProps.code.value === "badval")
      throw new IModelError(100, "bad element");
  }
  protected static onInsertedElement(_arg: OnElementInModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.insertedId = _arg.elementId;
  }
  protected static onUpdateElement(_arg: OnElementInModelPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.nElemUpdate++;
  }
  protected static onUpdatedElement(_arg: OnElementInModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.updatedId = _arg.elementId;
  }
  protected static onDeleteElement(_arg: OnElementInModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    if (_arg.elementId === this.dontDelete)
      throw new Error("dont delete my element");

    this.nElemDelete++;
  }
  protected static onDeletedElement(_arg: OnElementInModelIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.deletedId = _arg.elementId;
  }
}

class Breakdown extends FunctionalBreakdownElement {
  public static get className(): string { return "Breakdown"; }
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

  protected static onInsert(_arg: OnElementPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    assert.equal(_arg.props.classFullName, this.classFullName);
    this.props = _arg.props;
  }
  protected static onInserted(_arg: OnElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.elemId = _arg.id;
  }
  protected static onUpdate(_arg: OnElementPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    assert.equal(_arg.props.classFullName, this.classFullName);
    this.nUpdate++;
  }
  protected static onUpdated(_arg: OnElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.nUpdated++;
  }
  protected static onDelete(_arg: OnElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.nDelete++;
  }
  protected static onDeleted(_arg: OnElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.elemId = _arg.id;
    this.nDeleted++;
  }
  protected static onChildDelete(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    if (_arg.childId === this.dontDeleteChild)
      throw new Error("dont delete my child");
    this.childId = this.childId;
    this.parentId = _arg.parentId;
  }
  protected static onChildDeleted(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    assert.equal(this.childId, _arg.childId);
    assert.equal(_arg.parentId, this.parentId);
  }
  protected static onChildInsert(_arg: OnChildElementPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.parentId = _arg.parentId;
  }
  protected static onChildInserted(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    assert.equal(_arg.parentId, this.parentId);
    this.childId = _arg.childId;
  }
  protected static onChildUpdate(_arg: OnChildElementPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.parentId = _arg.parentId;
  }
  protected static onChildUpdated(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    assert.equal(_arg.parentId, this.parentId);
    this.childId = _arg.childId;
  }
  protected static onChildAdd(_arg: OnChildElementPropsArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.childAdd = _arg.childProps.id;
    this.addParent = _arg.parentId;
  }
  protected static onChildAdded(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.childAdded = _arg.childId;
    this.addedParent = _arg.parentId;
  }
  protected static onChildDrop(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.childDrop = _arg.childId;
    this.dropParent = _arg.parentId;
  }
  protected static onChildDropped(_arg: OnChildElementIdArg): void {
    assert.equal(_arg.iModel, iModelDb);
    this.childDropped = _arg.childId;
    this.droppedParent = _arg.parentId;
  }
}

class Component extends FunctionalComponentElement {
  public static get className(): string { return "Component"; }

}

describe("Functional Domain", () => {
  const requestContext = new BackendRequestContext();

  it("should populate FunctionalModel and test element and model callbacks", async () => {
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
    ClassRegistry.registerModule({ TestFuncModel, Breakdown, Component }, TestSchema);

    await FunctionalSchema.importSchema(requestContext, iModelDb); // eslint-disable-line deprecation/deprecation

    let commits = 0;
    let committed = 0;
    const dropCommit = iModelDb.txns.onCommit.addListener(() => commits++);
    const dropCommitted = iModelDb.txns.onCommitted.addListener(() => committed++);
    iModelDb.saveChanges("Import Functional schema");

    assert.equal(commits, 1);
    assert.equal(committed, 1);
    dropCommit();
    dropCommitted();

    IModelTestUtils.flushTxns(iModelDb); // importSchema below will fail if this is not called to flush local changes

    await iModelDb.importSchemas(requestContext, [path.join(__dirname, "../assets/TestFunctional.ecschema.xml")]);

    iModelDb.saveChanges("Import TestFunctional schema");
    assert.equal(commits, 1);
    assert.equal(committed, 1);

    const codeSpec = CodeSpec.create(iModelDb, "Test Functional Elements", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));

    const modelId = TestFuncModel.insert(iModelDb, IModel.rootSubjectId, "Test Functional Model");
    assert.isTrue(Id64.isValidId64(modelId));
    assert.equal(TestFuncModel.insertModelId, modelId, "from Model.onInsert");
    assert.equal(TestFuncModel.nModelInsert, 1, "Model.onInsert should be called once");
    assert.equal(TestFuncModel.nModelUpdate, 0, "model insert should not call onUpdate");
    assert.equal(TestFuncModel.nModelUpdated, 0, "model insert should not call onUpdated");
    const modelId2 = TestFuncModel.insert(iModelDb, IModel.rootSubjectId, "Test Functional Model 2");
    assert.isTrue(Id64.isValidId64(modelId2));
    assert.equal(TestFuncModel.insertModelId, modelId2, "second insert should set new id");
    assert.equal(TestFuncModel.nModelInsert, 2, "Model.onInsert should now be called twice");

    const model2 = iModelDb.models.getModel(modelId2);
    model2.update();
    assert.equal(TestFuncModel.updateModelId, modelId2, "from Model.onUpdate");
    assert.equal(TestFuncModel.nModelUpdate, 1, "Model.onUpdate should be called once");
    assert.equal(TestFuncModel.nModelUpdated, 1, "Model.onUpdated should be called once");
    model2.delete();
    assert.equal(TestFuncModel.deleteModelId, modelId2);
    assert.equal(TestFuncModel.nModelDelete, 1, "Model.onDelete should be called once");
    assert.equal(TestFuncModel.nModelDeleted, 1, "Model.onDeleted should be called once");

    const breakdownProps: FunctionalElementProps = {
      classFullName: Breakdown.classFullName,
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Breakdown1" }),
    };
    const breakdownId = iModelDb.elements.insertElement(breakdownProps);
    assert.isTrue(Id64.isValidId64(breakdownId));
    assert.equal(TestFuncModel.insertedId, breakdownId, "from Model.onElementInserted");
    assert.equal(Breakdown.elemId, breakdownId, "from Element.onInserted");
    assert.equal(Breakdown.props, breakdownProps, "from Element.onInsert");

    const breakdown2Props: FunctionalElementProps = {
      classFullName: Breakdown.classFullName,
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "badval" }),
    };
    // TestFuncModel.onInsertElement throws for this code.value
    expect(() => iModelDb.elements.insertElement(breakdown2Props)).to.throw("bad element");

    breakdown2Props.code.value = "Breakdown2";
    Breakdown.props = undefined;
    const bd2 = iModelDb.elements.insertElement(breakdown2Props);
    const bd2el = iModelDb.elements.getElement(bd2);
    bd2el.update();
    assert.equal(Breakdown.nUpdate, 1, "Element.onUpdate should be called once");
    assert.equal(Breakdown.nUpdated, 1, "Element.onUpdated should be called once");

    bd2el.delete();
    assert.equal(Breakdown.elemId, bd2, "from onDelete");
    assert.equal(Breakdown.nDelete, 1, "Element.onDelete should be called once");
    assert.equal(Breakdown.nDeleted, 1, "Element.onDeleted should be called once");

    const breakdown3Props: FunctionalElementProps = {
      classFullName: Breakdown.classFullName,
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "bd3" }),
    };
    const bd3 = iModelDb.elements.insertElement(breakdown3Props);

    const componentProps: FunctionalElementProps = {
      classFullName: Component.classFullName,
      model: modelId,
      parent: { id: breakdownId, relClassName: ElementOwnsChildElements.classFullName },
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Component1" }),
    };
    const componentId = iModelDb.elements.insertElement(componentProps);
    assert.isTrue(Id64.isValidId64(componentId));
    assert.equal(Breakdown.childId, componentId, "Element.onChildInserted should set childId");

    // test model and element callbacks for updateElement
    Breakdown.childId = "";
    Breakdown.elemId = "";
    TestFuncModel.nElemUpdate = 0;
    const compponent1 = iModelDb.elements.getElement(componentId);
    compponent1.update();
    assert.equal(TestFuncModel.nElemUpdate, 1, "Model.onUpdateElement should be called");
    assert.equal(TestFuncModel.updatedId, componentId, "from Model.onUpdatedElement");
    assert.equal(Breakdown.parentId, breakdownId, "from Element.onChildUpdate");
    assert.equal(Breakdown.childId, componentId, "from Element.onChildUpdated");

    componentProps.code.value = "comp2";
    const comp2 = iModelDb.elements.insertElement(componentProps);
    assert.equal(Breakdown.childId, comp2, "from Element.onChildInserted");
    const el2 = iModelDb.elements.getElement(comp2);

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
    componentProps.parent!.id = bd3;
    const comp3 = iModelDb.elements.insertElement(componentProps);
    const compEl3 = iModelDb.elements.getElementProps(comp3);
    compEl3.parent!.id = breakdownId;
    iModelDb.elements.updateElement(compEl3);
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
    expect(() => iModelDb.elements.deleteElement(breakdownId)).to.throw(errMsg);
    assert.isDefined(iModelDb.elements.getElement(breakdownId), "should not have been deleted");
    expect(() => iModelDb.elements.updateElement(breakdownProps)).to.throw(errMsg);
    breakdownProps.code.value = "Breakdown 2";
    expect(() => iModelDb.elements.insertElement(breakdownProps)).to.throw(errMsg);

    iModelDb.close();
  });
});
