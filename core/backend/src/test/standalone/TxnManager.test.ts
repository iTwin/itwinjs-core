/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ActivityLoggingContext, IModelStatus } from "@bentley/bentleyjs-core";
import { assert } from "chai";
import * as path from "path";
import { IModelTestUtils, TestElementDrivesElement, TestPhysicalObject, TestPhysicalObjectProps } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelDb, SpatialCategory, TxnAction, PhysicalModel } from "../../backend";
import { Code, IModel, SubCategoryAppearance, ColorByName, IModelError } from "@bentley/imodeljs-common";

describe("TxnManager", () => {
  let imodel: IModelDb;
  let props: TestPhysicalObjectProps;

  const actx = new ActivityLoggingContext("");

  before(async () => {
    imodel = IModelTestUtils.openIModel("test.bim");
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel.importSchema(actx, schemaPathname); // will throw an exception if import fails

    props = {
      classFullName: "TestBim:TestPhysicalObject",
      model: PhysicalModel.insert(imodel, IModel.rootSubjectId, "TestModel"),
      category: SpatialCategory.insert(imodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed })),
      code: Code.createEmpty(),
      intProperty: 100,
    };
    imodel.saveChanges("schema change");
    imodel.nativeDb.enableTxnTesting();
  });
  after(() => IModelTestUtils.closeIModel(imodel));

  it("Undo/Redo", () => {
    assert.isDefined(imodel.getMetaData("TestBim:TestPhysicalObject"), "TestPhysicalObject is present");

    const txns = imodel.txns;
    assert.isFalse(txns.hasPendingTxns);

    const change1Msg = "change 1";
    const change2Msg = "change 2";
    let beforeUndo = 0;
    let afterUndo = 0;
    let undoAction = TxnAction.None;

    txns.onBeforeUndoRedo.addListener(() => afterUndo++);
    txns.onAfterUndoRedo.addListener((action) => { beforeUndo++; undoAction = action; });

    let elementId = imodel.elements.insertElement(props);
    assert.isFalse(txns.isRedoPossible);
    assert.isFalse(txns.isUndoPossible);
    assert.isTrue(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);

    imodel.saveChanges(change1Msg);
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isTrue(txns.hasPendingTxns);
    assert.isTrue(txns.hasLocalChanges);

    let element = imodel.elements.getElement<TestPhysicalObject>(elementId);
    assert.equal(element.intProperty, 100, "int property should be 100");

    assert.isTrue(txns.isUndoPossible);  // we have an undoable Txn, but nothing undone.
    assert.equal(change1Msg, txns.getUndoString());
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.isTrue(txns.isRedoPossible);
    assert.equal(change1Msg, txns.getRedoString());
    assert.equal(beforeUndo, 1);
    assert.equal(afterUndo, 1);
    assert.equal(undoAction, TxnAction.Reverse);

    assert.throws(() => imodel.elements.getElement(elementId), IModelError);
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.isTrue(txns.isUndoPossible);
    assert.isFalse(txns.isRedoPossible);
    assert.equal(beforeUndo, 2);
    assert.equal(afterUndo, 2);
    assert.equal(undoAction, TxnAction.Reinstate);

    element = imodel.elements.getElement(elementId);
    element.intProperty = 200;
    element.update();

    imodel.saveChanges(change2Msg);
    element = imodel.elements.getElement(elementId);
    assert.equal(element.intProperty, 200, "int property should be 200");
    assert.equal(txns.getTxnDescription(txns.queryPreviousTxnId(txns.getCurrentTxnId())), change2Msg);

    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    element = imodel.elements.getElement(elementId);
    assert.equal(element.intProperty, 100, "int property should be 100");

    // make sure abandon changes works.
    element.delete();
    assert.throws(() => imodel.elements.getElement(elementId), IModelError);
    imodel.abandonChanges(); //
    element = imodel.elements.getElement(elementId); // should be back now.
    imodel.elements.insertElement(props); // create a new element
    imodel.saveChanges(change2Msg);

    elementId = imodel.elements.insertElement(props); // create a new element
    assert.isTrue(txns.hasUnsavedChanges);
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.isFalse(txns.hasUnsavedChanges);
    assert.throws(() => imodel.elements.getElement(elementId), IModelError); // reversing a txn with pending uncommitted changes should abandon them.
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.throws(() => imodel.elements.getElement(elementId), IModelError); // doesn't come back, wasn't committed

    // verify multi-txn operations are undone/redone together
    const el1 = imodel.elements.insertElement(props);
    imodel.saveChanges("step 1");
    txns.beginMultiTxnOperation();
    assert.equal(1, txns.getMultiTxnOperationDepth());
    const el2 = imodel.elements.insertElement(props);
    imodel.saveChanges("step 2");
    const el3 = imodel.elements.insertElement(props);
    imodel.saveChanges("step 3");
    txns.endMultiTxnOperation();
    assert.equal(0, txns.getMultiTxnOperationDepth());
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.throws(() => imodel.elements.getElement(el2), IModelError);
    assert.throws(() => imodel.elements.getElement(el3), IModelError);
    imodel.elements.getElement(el1);
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.throws(() => imodel.elements.getElement(el1), IModelError);
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.throws(() => imodel.elements.getElement(el2), IModelError);
    assert.throws(() => imodel.elements.getElement(el3), IModelError);
    imodel.elements.getElement(el1);
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    imodel.elements.getElement(el1);
    imodel.elements.getElement(el2);
    imodel.elements.getElement(el3);

    assert.equal(IModelStatus.Success, txns.cancelTo(txns.queryFirstTxnId()));
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);
    assert.isFalse(txns.hasLocalChanges);
  });

  it("Element drives element events", () => {
    const el1 = imodel.elements.insertElement(props);
    const el2 = imodel.elements.insertElement(props);
    const ede = TestElementDrivesElement.create<TestElementDrivesElement>(imodel, el1, el2);
    ede.property1 = "test ede";
    ede.insert();
    const removals: VoidFunction[] = [];
    let beforeOutputsHandled = 0;
    let allInputsHandled = 0;
    let rootChanged = 0;
    let validateOutput = 0;
    let deletedDependency = 0;
    removals.push(TestElementDrivesElement.deletedDependency.addListener((evProps) => {
      assert.equal(evProps.sourceId, el1);
      assert.equal(evProps.targetId, el2);
      ++deletedDependency;
    }));
    removals.push(TestElementDrivesElement.rootChanged.addListener((evProps, im) => {
      const ede2 = im.relationships.getInstance<TestElementDrivesElement>(evProps.classFullName, evProps.id!);
      assert.equal(ede2.property1, ede.property1);
      assert.equal(evProps.sourceId, el1);
      assert.equal(evProps.targetId, el2);
      ++rootChanged;
    }));
    removals.push(TestElementDrivesElement.validateOutput.addListener((_props) => ++validateOutput));
    removals.push(TestPhysicalObject.beforeOutputsHandled.addListener((id, im) => {
      const e1 = im.elements.getElement<TestPhysicalObject>(id);
      assert.equal(e1.intProperty, props.intProperty);
      assert.equal(id, el1);
      ++beforeOutputsHandled;
    }));
    removals.push(TestPhysicalObject.allInputsHandled.addListener((id, im) => {
      const e2 = im.elements.getElement<TestPhysicalObject>(id);
      assert.equal(e2.intProperty, props.intProperty);
      assert.equal(id, el2);
      ++allInputsHandled;
    }));

    imodel.saveChanges("step 1");
    assert.equal(1, beforeOutputsHandled);
    assert.equal(1, allInputsHandled);
    assert.equal(1, rootChanged);
    assert.equal(0, validateOutput);
    assert.equal(0, deletedDependency);

    const element2 = imodel.elements.getElement<TestPhysicalObject>(el2);
    element2.update();
    imodel.saveChanges("step 2");
    assert.equal(2, beforeOutputsHandled);
    assert.equal(2, allInputsHandled);
    assert.equal(2, rootChanged);
    assert.equal(0, validateOutput);
    assert.equal(0, deletedDependency);
    removals.forEach((drop) => drop());
  });

});
