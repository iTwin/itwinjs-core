/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BeDuration, DbResult, Id64, IModelStatus, OpenMode, OrderedId64Array } from "@bentley/bentleyjs-core";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  Code, ColorByName, DomainOptions, GeometryStreamBuilder, IModel, IModelError, SubCategoryAppearance, UpgradeOptions,
} from "@bentley/imodeljs-common";
import {
  BackendRequestContext, IModelHost, IModelJsFs, PhysicalModel, SpatialCategory, StandaloneDb, TxnAction, UpdateModelOptions,
} from "../../imodeljs-backend";
import { IModelTestUtils, TestElementDrivesElement, TestPhysicalObject, TestPhysicalObjectProps } from "../IModelTestUtils";

describe("TxnManager", () => {
  let imodel: StandaloneDb;
  let props: TestPhysicalObjectProps;
  let testFileName: string;
  const requestContext = new BackendRequestContext();

  const performUpgrade = (pathname: string): DbResult => {
    const nativeDb = new IModelHost.platform.DgnDb();
    const upgradeOptions: UpgradeOptions = {
      domain: DomainOptions.Upgrade,
    };
    const res = nativeDb.openIModel(pathname, OpenMode.ReadWrite, upgradeOptions);
    if (DbResult.BE_SQLITE_OK === res) {
      nativeDb.deleteAllTxns();
      nativeDb.closeIModel();
    }
    return res;
  };

  before(async () => {
    IModelTestUtils.registerTestBimSchema();
    testFileName = IModelTestUtils.prepareOutputFile("TxnManager", "TxnManagerTest.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const schemaFileName = IModelTestUtils.resolveAssetFile("TestBim.ecschema.xml");
    IModelJsFs.copySync(seedFileName, testFileName);
    assert.equal(performUpgrade(testFileName), 0);
    imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    await imodel.importSchemas(requestContext, [schemaFileName]); // will throw an exception if import fails

    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(5, 0, 0)));

    props = {
      classFullName: "TestBim:TestPhysicalObject",
      model: PhysicalModel.insert(imodel, IModel.rootSubjectId, "TestModel"),
      category: SpatialCategory.insert(imodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed })),
      code: Code.createEmpty(),
      intProperty: 100,
      placement: {
        origin: new Point3d(1, 2, 0),
        angles: new YawPitchRollAngles(),
      },
      geom: builder.geometryStream,
    };

    imodel.saveChanges("schema change");
    imodel.nativeDb.deleteAllTxns();
  });

  after(() => imodel.close());

  it("TxnManager", async () => {
    const models = imodel.models;
    let elements = imodel.elements;
    const modelId = props.model;

    let model = models.getModel<PhysicalModel>(modelId);
    assert.isUndefined(model.geometryGuid, "geometryGuid starts undefined");

    assert.isDefined(imodel.getMetaData("TestBim:TestPhysicalObject"), "TestPhysicalObject is present");

    let txns = imodel.txns;
    assert.isFalse(txns.hasPendingTxns);

    const change1Msg = "change 1";
    const change2Msg = "change 2";
    let beforeUndo = 0;
    let afterUndo = 0;
    let undoAction = TxnAction.None;

    txns.onBeforeUndoRedo.addListener(() => beforeUndo++);
    txns.onAfterUndoRedo.addListener((action) => { afterUndo++; undoAction = action; });

    let elementId = elements.insertElement(props);
    assert.isFalse(txns.isRedoPossible);
    assert.isFalse(txns.isUndoPossible);
    assert.isTrue(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);

    imodel.saveChanges(change1Msg);
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isTrue(txns.hasPendingTxns);
    assert.isTrue(txns.hasLocalChanges);

    const classId = imodel.nativeDb.classNameToId(props.classFullName);
    assert.isTrue(Id64.isValid(classId));
    const class2 = imodel.nativeDb.classIdToName(classId);
    assert.equal(class2, props.classFullName);
    model = models.getModel(modelId);
    assert.isDefined(model.geometryGuid);

    txns.reverseSingleTxn();
    assert.isFalse(txns.hasPendingTxns, "should not have pending txns if they all are reversed");
    assert.isFalse(txns.hasLocalChanges);
    txns.reinstateTxn();
    assert.isTrue(txns.hasPendingTxns, "now there should be pending txns again");
    assert.isTrue(txns.hasLocalChanges);
    beforeUndo = afterUndo = 0; // reset this for tests below

    model = models.getModel(modelId);
    assert.isDefined(model.geometryGuid);
    const guid1 = model.geometryGuid;

    let element = elements.getElement<TestPhysicalObject>(elementId);
    assert.equal(element.intProperty, 100, "int property should be 100");

    assert.isTrue(txns.isUndoPossible);  // we have an undoable Txn, but nothing undone.
    assert.equal(change1Msg, txns.getUndoString());
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());

    model = models.getModel(modelId);
    assert.isUndefined(model.geometryGuid, "geometryGuid undefined after undo");

    assert.isTrue(txns.isRedoPossible);
    assert.equal(change1Msg, txns.getRedoString());
    assert.equal(beforeUndo, 1);
    assert.equal(afterUndo, 1);
    assert.equal(undoAction, TxnAction.Reverse);

    assert.throws(() => elements.getElement(elementId), IModelError);
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    model = models.getModel(modelId);
    assert.equal(model.geometryGuid, guid1, "geometryGuid should return redo");

    assert.isTrue(txns.isUndoPossible);
    assert.isFalse(txns.isRedoPossible);
    assert.equal(beforeUndo, 2);
    assert.equal(afterUndo, 2);
    assert.equal(undoAction, TxnAction.Reinstate);

    element = elements.getElement(elementId);
    element.intProperty = 200;
    element.update();

    imodel.saveChanges(change2Msg);

    model = models.getModel(modelId);
    assert.equal(model.geometryGuid, guid1, "geometryGuid should not update with no geometry changes");

    element = elements.getElement(elementId);
    assert.equal(element.intProperty, 200, "int property should be 200");
    assert.equal(txns.getTxnDescription(txns.queryPreviousTxnId(txns.getCurrentTxnId())), change2Msg);

    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    element = elements.getElement(elementId);
    assert.equal(element.intProperty, 100, "int property should be 100");

    // make sure abandon changes works.
    element.delete();
    assert.throws(() => elements.getElement(elementId), IModelError);
    imodel.abandonChanges(); //
    element = elements.getElement(elementId); // should be back now.
    elements.insertElement(props); // create a new element
    imodel.saveChanges(change2Msg);

    model = models.getModel(modelId);
    assert.isDefined(model.geometryGuid);
    assert.notEqual(model.geometryGuid, guid1, "geometryGuid should update with adds");

    elementId = elements.insertElement(props); // create a new element
    assert.isTrue(txns.hasUnsavedChanges);
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.isFalse(txns.hasUnsavedChanges);
    assert.throws(() => elements.getElement(elementId), IModelError); // reversing a txn with pending uncommitted changes should abandon them.
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.throws(() => elements.getElement(elementId), IModelError); // doesn't come back, wasn't committed

    // verify multi-txn operations are undone/redone together
    const el1 = elements.insertElement(props);
    imodel.saveChanges("step 1");
    txns.beginMultiTxnOperation();
    assert.equal(1, txns.getMultiTxnOperationDepth());
    const el2 = elements.insertElement(props);
    imodel.saveChanges("step 2");
    const el3 = elements.insertElement(props);
    imodel.saveChanges("step 3");
    txns.endMultiTxnOperation();
    assert.equal(0, txns.getMultiTxnOperationDepth());
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.throws(() => elements.getElement(el2), IModelError);
    assert.throws(() => elements.getElement(el3), IModelError);
    elements.getElement(el1);
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.throws(() => elements.getElement(el1), IModelError);
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.throws(() => elements.getElement(el2), IModelError);
    assert.throws(() => elements.getElement(el3), IModelError);
    elements.getElement(el1);
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    elements.getElement(el1);
    elements.getElement(el2);
    elements.getElement(el3);

    assert.equal(IModelStatus.Success, txns.cancelTo(txns.queryFirstTxnId()));
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);
    assert.isFalse(txns.hasLocalChanges);

    model = models.getModel(modelId);
    assert.isUndefined(model.geometryGuid, "undo all, geometryGuid goes back to undefined");

    const modifyId = elements.insertElement(props);
    imodel.saveChanges("check guid changes");

    model = models.getModel(modelId);
    const guid2 = model.geometryGuid;
    const toModify = elements.getElement<TestPhysicalObject>(modifyId);
    toModify.placement.origin.x += 1;
    toModify.placement.origin.y += 1;
    toModify.update();
    const saveUpdateMsg = "save update to modify guid";
    imodel.saveChanges(saveUpdateMsg);
    model = models.getModel(modelId);
    assert.notEqual(guid2, model.geometryGuid, "update placement should change guid");

    const guid3 = model.geometryGuid;
    const modelProps = model.toJSON() as UpdateModelOptions;
    modelProps.geometryChanged = true;
    models.updateModel(modelProps);
    model = models.getModel(modelId);
    assert.notEqual(guid3, model.geometryGuid, "update model should change guid");

    const lastMod = models.queryLastModifiedTime(modelId);
    await BeDuration.wait(300); // we're going to update the lastMod below, make sure it will be different by waiting .3 seconds
    const modelProps2 = model.toJSON() as UpdateModelOptions;
    modelProps2.updateLastMod = true;
    models.updateModel(modelProps2);
    model = models.getModel(modelId);
    const lastMod2 = models.queryLastModifiedTime(modelId);
    assert.notEqual(lastMod, lastMod2);

    // Deleting a geometric element updates model's GeometryGuid; deleting any element updates model's LastMod.
    await BeDuration.wait(300); // for lastMod...
    const guid4 = model.geometryGuid;
    toModify.delete();
    const deleteTxnMsg = "save deletion of element";
    imodel.saveChanges(deleteTxnMsg);
    assert.throws(() => elements.getElement(modifyId));
    model = models.getModel(modelId);
    expect(model.geometryGuid).not.to.equal(guid4);
    const lastMod3 = models.queryLastModifiedTime(modelId);
    expect(lastMod3).not.to.equal(lastMod2);

    assert.isTrue(txns.isUndoPossible);
    assert.isTrue(txns.checkUndoPossible(true));
    assert.isTrue(txns.checkUndoPossible(false));
    assert.isTrue(txns.checkUndoPossible());

    // test the ability to undo/redo from previous sessions
    imodel.close();
    imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    txns = imodel.txns;

    assert.isFalse(txns.isUndoPossible);
    assert.isTrue(txns.checkUndoPossible(true));
    assert.isFalse(txns.checkUndoPossible(false));
    assert.isFalse(txns.checkUndoPossible());
    assert.equal(deleteTxnMsg, txns.getUndoString(true));
    assert.equal("", txns.getUndoString());

    assert.equal(IModelStatus.Success, txns.reverseTxns(1, true), "reverse from previous session");
    assert.equal(saveUpdateMsg, txns.getUndoString(true));
    assert.equal(deleteTxnMsg, txns.getRedoString());
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.equal(IModelStatus.Success, txns.cancelTo(txns.queryFirstTxnId(true), true), "cancel all committed txns");
    assert.isFalse(txns.checkUndoPossible(true));
    assert.isFalse(txns.isRedoPossible);
    assert.isFalse(txns.isUndoPossible);
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);

    // tests for onElementsChanged events
    const changes = {
      inserted: new OrderedId64Array(),
      deleted: new OrderedId64Array(),
      updated: new OrderedId64Array(),
    };
    let nValidates = 0;
    elements = imodel.elements;
    txns.onCommit.addListener(() => { changes.inserted.clear(); changes.deleted.clear(); changes.updated.clear(); });
    txns.onEndValidation.addListener(() => ++nValidates);
    const copyArray = (output: OrderedId64Array, input: OrderedId64Array) => { input.forEach((el) => output.insert(el)); };
    txns.onElementsChanged.addListener((ch) => {
      copyArray(changes.inserted, ch.inserted);
      copyArray(changes.deleted, ch.deleted);
      copyArray(changes.updated, ch.updated);
    });

    const elementId1 = elements.insertElement(props);
    const elementId2 = elements.insertElement(props);
    imodel.saveChanges("2 inserts");
    assert.equal(nValidates, 1);
    assert.equal(changes.inserted.length, 2);
    assert.isTrue(changes.inserted.contains(elementId1));
    assert.isTrue(changes.inserted.contains(elementId2));
    assert.equal(changes.deleted.length, 0);
    assert.equal(changes.updated.length, 0);

    const element1 = elements.getElement<TestPhysicalObject>(elementId1);
    const element2 = elements.getElement<TestPhysicalObject>(elementId2);
    element1.intProperty = 200;
    element1.update();
    element2.intProperty = 200;
    element2.update();
    imodel.saveChanges("2 updates");
    assert.equal(nValidates, 2);
    assert.equal(changes.inserted.length, 0);
    assert.equal(changes.deleted.length, 0);
    assert.equal(changes.updated.length, 2);
    assert.isTrue(changes.updated.contains(elementId1));
    assert.isTrue(changes.updated.contains(elementId2));

    element1.delete();
    element2.delete();
    imodel.saveChanges("2 deletes");
    assert.equal(nValidates, 3);
    assert.equal(changes.inserted.length, 0);
    assert.equal(changes.updated.length, 0);
    assert.equal(changes.deleted.length, 2);
    assert.isTrue(changes.deleted.contains(elementId1));
    assert.isTrue(changes.deleted.contains(elementId2));
  });

  it("Element drives element events", async () => {
    assert.isDefined(imodel.getMetaData("TestBim:TestPhysicalObject"), "TestPhysicalObject is present");

    const elements = imodel.elements;
    const el1 = elements.insertElement(props);
    const el2 = elements.insertElement(props);
    const ede = TestElementDrivesElement.create<TestElementDrivesElement>(imodel, el1, el2);
    ede.property1 = "test ede";
    ede.insert();

    const removals: VoidFunction[] = [];
    let beforeOutputsHandled = 0;
    let allInputsHandled = 0;
    let rootChanged = 0;
    let validateOutput = 0;
    let deletedDependency = 0;
    let commits = 0;
    let committed = 0;
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
    removals.push(TestPhysicalObject.beforeOutputsHandled.addListener((id) => {
      assert.equal(id, el1);
      ++beforeOutputsHandled;
    }));
    removals.push(TestPhysicalObject.allInputsHandled.addListener((id) => {
      assert.equal(id, el2);
      ++allInputsHandled;
    }));

    removals.push(imodel.txns.onCommit.addListener(() => commits++));
    removals.push(imodel.txns.onCommitted.addListener(() => committed++));

    imodel.saveChanges("step 1");
    assert.equal(commits, 1);
    assert.equal(committed, 1);
    assert.equal(beforeOutputsHandled, 1);
    assert.equal(allInputsHandled, 1);
    assert.equal(rootChanged, 1);
    assert.equal(validateOutput, 0);
    assert.equal(deletedDependency, 0);

    const element2 = elements.getElement<TestPhysicalObject>(el2);
    // make sure we actually change something in the element table. Otherwise update does nothing unless we wait long enough for last-mod-time to be updated.
    element2.userLabel = "new value";
    element2.update();
    imodel.saveChanges("step 2");
    assert.equal(commits, 2);
    assert.equal(committed, 2);

    assert.equal(allInputsHandled, 2, "allInputsHandled not called for update");
    assert.equal(beforeOutputsHandled, 2, "beforeOutputsHandled not called for update");
    assert.equal(rootChanged, 2, "rootChanged not called for update");
    assert.equal(validateOutput, 0, "validateOutput shouldn't be called for update");
    assert.equal(deletedDependency, 0, "deleteDependency shouldn't be called for update");
    removals.forEach((drop) => drop());
  });

  it("change propagation should leave txn empty", async () => {
    const elements = imodel.elements;

    // Insert elements root, child and dependency between them
    const rootProps = { ...props, intProperty: 0 };
    const rootId = elements.insertElement(rootProps);
    const childProps = { ...props, intProperty: 10 };
    const childId = elements.insertElement(childProps);
    const relationship = TestElementDrivesElement.create<TestElementDrivesElement>(imodel, rootId, childId);
    relationship.property1 = "Root drives child";
    relationship.insert();
    imodel.saveChanges("Inserted root, child element and dependency");

    // Setup dependency handler to update childElement
    let handlerCalled = false;
    const dropListener = TestPhysicalObject.allInputsHandled.addListener((id) => {
      handlerCalled = true;
      assert.equal(id, childId);
      const childEl = elements.getElement<TestPhysicalObject>(childId);
      assert.equal(childEl.intProperty, 10, "int property should be 10");
      childEl.intProperty += 10;
      childEl.update();
    });

    // Validate state
    const txns = imodel.txns;
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isTrue(txns.hasPendingTxns);
    assert.isTrue(txns.hasLocalChanges);

    // Update rootElement and saveChanges
    const rootEl = elements.getElement<TestPhysicalObject>(rootId);
    rootEl.intProperty += 10;
    rootEl.update();
    imodel.saveChanges("Updated root");

    // Validate state
    assert.isTrue(handlerCalled);
    assert.isFalse(txns.hasUnsavedChanges, "should not have unsaved changes");
    assert.isTrue(txns.hasPendingTxns);
    assert.isTrue(txns.hasLocalChanges);

    // Cleanup
    dropListener();
  });

});
