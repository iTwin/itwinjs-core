/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BeDuration, BeEvent, Guid, Id64, IModelStatus, OpenMode } from "@itwin/core-bentley";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  Code, ColorByName, DomainOptions, EntityIdAndClassId, EntityIdAndClassIdIterable, GeometryStreamBuilder, IModel, IModelError, SubCategoryAppearance, TxnAction, UpgradeOptions,
} from "@itwin/core-common";
import {
  _nativeDb,
  ChangeInstanceKey,
  ChannelControl,
  IModelJsFs, PhysicalModel, setMaxEntitiesPerEvent, SpatialCategory, StandaloneDb, TxnChangedEntities, TxnManager,
} from "../../core-backend";
import { IModelTestUtils, TestElementDrivesElement, TestPhysicalObject, TestPhysicalObjectProps } from "../IModelTestUtils";
import { IModelNative } from "../../internal/NativePlatform";
import { EntityClass, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";

/// cspell:ignore accum

describe("TxnManager", () => {
  let imodel: StandaloneDb;
  let roImodel: StandaloneDb;
  let props: TestPhysicalObjectProps;
  let testFileName: string;

  const performUpgrade = (pathname: string) => {
    const nativeDb = new IModelNative.platform.DgnDb();
    const upgradeOptions: UpgradeOptions = {
      domain: DomainOptions.Upgrade,
      schemaLockHeld: true,
    };
    nativeDb.openIModel(pathname, OpenMode.ReadWrite, upgradeOptions);
    nativeDb.deleteAllTxns();
    nativeDb.closeFile();
  };

  beforeEach(async () => {
    IModelTestUtils.registerTestBimSchema();
    // make a unique name for the output file so this test can be run in parallel
    testFileName = IModelTestUtils.prepareOutputFile("TxnManager", `${Guid.createValue()}.bim`);
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const schemaFileName = IModelTestUtils.resolveAssetFile("TestBim.ecschema.xml");
    IModelJsFs.copySync(seedFileName, testFileName);
    performUpgrade(testFileName);
    imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    await imodel.importSchemas([schemaFileName]); // will throw an exception if import fails
    imodel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

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
    imodel[_nativeDb].deleteAllTxns();
    roImodel = StandaloneDb.openFile(testFileName, OpenMode.Readonly);
  });

  afterEach(() => {
    roImodel.close();
    imodel.close();
    IModelJsFs.removeSync(testFileName);
  });

  function makeEntity(id: string, classFullName: string): EntityIdAndClassId {
    const classId = imodel[_nativeDb].classNameToId(classFullName);
    expect(Id64.isValid(classId)).to.be.true;
    return { id, classId };
  }

  function physicalModelEntity(id: string) {
    return makeEntity(id, "BisCore:PhysicalModel");
  }
  function physicalObjectEntity(id: string) {
    return makeEntity(id, "TestBim:TestPhysicalObject");
  }
  function spatialCategoryEntity(id: string) {
    return makeEntity(id, "BisCore:SpatialCategory");
  }
  function subCategoryEntity(categoryId: string) {
    return makeEntity(IModel.getDefaultSubCategoryId(categoryId), "BisCore:SubCategory");
  }

  it("TxnManager", async () => {
    const models = imodel.models;
    const elements = imodel.elements;
    const modelId = props.model;
    const cleanup: Array<() => void> = [];

    let model = models.getModel<PhysicalModel>(modelId);
    assert.isUndefined(model.geometryGuid, "geometryGuid starts undefined");

    assert.isDefined(await imodel.schemaContext.getSchemaItem(new SchemaItemKey("TestPhysicalObject", new SchemaKey("TestBim", 1, 0, 0)), EntityClass), "TestPhysicalObject is present");

    const txns = imodel.txns;
    assert.isFalse(txns.hasPendingTxns);

    const change1Msg = "change 1";
    const change2Msg = "change 2";
    let beforeUndo = 0;
    let afterUndo = 0;
    let undoAction = TxnAction.None;

    cleanup.push(txns.onBeforeUndoRedo.addListener(() => beforeUndo++));
    cleanup.push(txns.onAfterUndoRedo.addListener((isUndo) => {
      afterUndo++;
      undoAction = isUndo ? TxnAction.Reverse : TxnAction.Reinstate;
    }));

    let elementId = elements.insertElement(props);
    assert.isFalse(txns.isRedoPossible);
    assert.isFalse(txns.isUndoPossible);
    assert.isTrue(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);

    imodel.saveChanges(change1Msg);
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isTrue(txns.hasPendingTxns);
    assert.isTrue(txns.hasLocalChanges);

    expect(imodel[_nativeDb].getCurrentTxnId()).not.equal(roImodel[_nativeDb].getCurrentTxnId());
    roImodel[_nativeDb].restartDefaultTxn();
    expect(imodel[_nativeDb].getCurrentTxnId()).equal(roImodel[_nativeDb].getCurrentTxnId());

    const classId = imodel[_nativeDb].classNameToId(props.classFullName);
    assert.isTrue(Id64.isValid(classId));
    const class2 = imodel[_nativeDb].classIdToName(classId);
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

    assert.throws(() => elements.getElementProps(elementId), IModelError, "element not found");
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

    const lastMod = models.queryLastModifiedTime(modelId);
    await BeDuration.wait(300); // we update the lastMod below, make sure it will be different by waiting .3 seconds
    const guid3 = model.geometryGuid;
    models.updateGeometryGuid(modelId);
    model = models.getModel(modelId);
    assert.notEqual(guid3, model.geometryGuid, "update model should change guid");
    const lastMod2 = models.queryLastModifiedTime(modelId);
    assert.notEqual(lastMod, lastMod2);
    // imodel.saveChanges("update geometry guid");

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

    // test restarting the session, which should truncate undo history
    txns.restartSession();

    assert.isFalse(txns.isUndoPossible);
    assert.equal("", txns.getUndoString());

    assert.isFalse(txns.isRedoPossible);
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isTrue(txns.hasPendingTxns); // these are from the previous session
    cleanup.forEach((drop) => drop());
  });

  class EventAccumulator {
    public readonly inserted: EntityIdAndClassId[] = [];
    public readonly updated: EntityIdAndClassId[] = [];
    public readonly deleted: EntityIdAndClassId[] = [];
    public numValidates = 0;
    public numApplyChanges = 0;
    private _numBeforeUndo = 0;
    private _numAfterUndo = 0;
    private readonly _cleanup: Array<() => void> = [];

    public constructor(mgr: TxnManager) {
      this._cleanup.push(mgr.onEndValidation.addListener(() => {
        ++this.numValidates;
      }));

      this._cleanup.push(mgr.onCommit.addListener(() => {
        this.clearChanges();
      }));

      this._cleanup.push(mgr.onChangesApplied.addListener(() => {
        ++this.numApplyChanges;
      }));

      this._cleanup.push(mgr.onBeforeUndoRedo.addListener(() => {
        expect(this._numBeforeUndo).to.equal(this._numAfterUndo);
        ++this._numBeforeUndo;
      }));

      this._cleanup.push(mgr.onAfterUndoRedo.addListener(() => {
        ++this._numAfterUndo;
        expect(this._numAfterUndo).to.equal(this._numBeforeUndo);
      }));
    }

    public [Symbol.dispose](): void {
      for (const cleanup of this._cleanup)
        cleanup();

      this._cleanup.length = 0;
    }

    public static test(txns: TxnManager, event: BeEvent<(changes: TxnChangedEntities) => void>, func: (accum: EventAccumulator) => void): void {
      using accum = new EventAccumulator(txns);
      accum.listen(event);
      func(accum);
    }

    public static testElements(iModel: StandaloneDb, func: (accum: EventAccumulator) => void): void {
      this.test(iModel.txns, iModel.txns.onElementsChanged, func);
    }

    public static testModels(iModel: StandaloneDb, func: (accum: EventAccumulator) => void): void {
      this.test(iModel.txns, iModel.txns.onModelsChanged, func);
    }

    public listen(evt: BeEvent<(changes: TxnChangedEntities) => void>): void {
      this._cleanup.push(evt.addListener((changes) => {
        this.copyArray(changes, "inserted");
        this.copyArray(changes, "updated");
        this.copyArray(changes, "deleted");
      }));
    }

    private copyArray(changes: TxnChangedEntities, propName: "inserted" | "updated" | "deleted"): void {
      const iterNames = { inserted: "inserts", updated: "updates", deleted: "deletes" } as const;
      const iterName = iterNames[propName];
      const entities = changes[iterName];

      const dest = this[propName];
      for (const entity of entities)
        dest.push({ ...entity });
    }

    public expectNumValidations(expected: number) {
      expect(this.numValidates).to.equal(expected);
    }

    public expectNumApplyChanges(expected: number) {
      expect(this.numApplyChanges).to.equal(expected);
    }

    public expectNumUndoRedo(expected: number) {
      expect(this._numBeforeUndo).to.equal(this._numAfterUndo);
      expect(this._numBeforeUndo).to.equal(expected);
    }

    public expectChanges(expected: { inserted?: EntityIdAndClassId[], updated?: EntityIdAndClassId[], deleted?: EntityIdAndClassId[] }): void {
      this.expect(expected.inserted, "inserted");
      this.expect(expected.updated, "updated");
      this.expect(expected.deleted, "deleted");
    }

    private expect(expected: EntityIdAndClassId[] | undefined, propName: "inserted" | "updated" | "deleted"): void {
      expect(this[propName]).to.deep.equal(expected ?? []);
    }

    public clearChanges(): void {
      this.inserted.length = 0;
      this.updated.length = 0;
      this.deleted.length = 0;
    }
  }

  it("dispatches events when elements change", async () => {
    const elements = imodel.elements;
    let id1: string;
    let id2: string;

    EventAccumulator.testElements(imodel, (accum) => {
      id1 = elements.insertElement(props);
      id2 = elements.insertElement(props);
      imodel.saveChanges("2 inserts");
      accum.expectNumValidations(1);
      accum.expectChanges({ inserted: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    await BeDuration.wait(10); // we rely on updating the lastMod of the newly inserted element, make sure it will be different

    let elem1: TestPhysicalObject;
    let elem2: TestPhysicalObject;
    EventAccumulator.testElements(imodel, (accum) => {
      elem1 = elements.getElement<TestPhysicalObject>(id1);
      elem2 = elements.getElement<TestPhysicalObject>(id2);
      elem1.intProperty = 200;
      elem1.update();
      elem2.intProperty = 200;
      elem2.update();
      imodel.saveChanges("2 updates");
      accum.expectNumValidations(1);
      accum.expectChanges({ updated: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    EventAccumulator.testElements(imodel, (accum) => {
      elem1.delete();
      elem2.delete();
      imodel.saveChanges("2 deletes");
      accum.expectNumValidations(1);
      accum.expectChanges({ deleted: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    // Undo
    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectChanges({ inserted: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
      accum.expectNumApplyChanges(1);
      accum.expectNumValidations(0);
    });

    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectChanges({ updated: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectChanges({ deleted: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    // Redo
    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reinstateTxn();
      accum.expectNumUndoRedo(1);
      accum.expectChanges({ inserted: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reinstateTxn();
      accum.expectNumUndoRedo(1);
      accum.expectChanges({ updated: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
    });

    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reinstateTxn();
      accum.expectNumUndoRedo(1);
      accum.expectChanges({ deleted: [physicalObjectEntity(id1), physicalObjectEntity(id2)] });
      accum.expectNumApplyChanges(1);
      accum.expectNumValidations(0);
    });

    // Undo all
    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reverseTxns(3);
      accum.expectNumValidations(0);
      accum.expectNumUndoRedo(1);
      accum.expectNumApplyChanges(3);

      // We received 3 separate "elements changed" events - one for each txn - and just concatenated the lists.
      accum.expectChanges({
        inserted: [physicalObjectEntity(id1), physicalObjectEntity(id2)],
        updated: [physicalObjectEntity(id1), physicalObjectEntity(id2)],
        deleted: [physicalObjectEntity(id1), physicalObjectEntity(id2)],
      });
    });

    // Redo all
    EventAccumulator.testElements(imodel, (accum) => {
      imodel.txns.reinstateTxn();
      accum.expectNumValidations(0);
      accum.expectNumUndoRedo(1);
      accum.expectNumApplyChanges(3);

      // We received 3 separate "elements changed" events - one for each txn - and just concatenated the lists.
      accum.expectChanges({
        inserted: [physicalObjectEntity(id1), physicalObjectEntity(id2)],
        updated: [physicalObjectEntity(id1), physicalObjectEntity(id2)],
        deleted: [physicalObjectEntity(id1), physicalObjectEntity(id2)],
      });
    });

    EventAccumulator.testElements(imodel, (accum) => {
      const elemId1 = imodel.elements.insertElement(props);
      const catId = SpatialCategory.insert(imodel, IModel.dictionaryId, Guid.createValue(), new SubCategoryAppearance({ color: ColorByName.green }));
      const elemId2 = imodel.elements.insertElement(props);
      imodel.saveChanges("2 physical elems and 1 spatial category");
      accum.expectNumValidations(1);
      accum.expectChanges({
        inserted: [
          physicalObjectEntity(elemId1),
          spatialCategoryEntity(catId),
          subCategoryEntity(catId),
          physicalObjectEntity(elemId2),
        ],
      });
    });
  });

  it("dispatches events when models change", async () => {
    const existingModelId = props.model;

    let newModelId: string;
    EventAccumulator.testModels(imodel, (accum) => {
      newModelId = PhysicalModel.insert(imodel, IModel.rootSubjectId, Guid.createValue());
      imodel.saveChanges("1 insert");
      accum.expectNumValidations(1);
      accum.expectChanges({ inserted: [physicalModelEntity(newModelId)] });
    });

    EventAccumulator.testModels(roImodel, (accum) => {
      roImodel[_nativeDb].restartDefaultTxn();
      accum.expectChanges({ inserted: [physicalModelEntity(newModelId)] });
    });

    await BeDuration.wait(10); // we rely on updating the lastMod of the newly inserted element, make sure it will be different

    // NB: Updates to existing models never produce events. I don't think I want to change that as part of this PR.
    let newModel: PhysicalModel;
    EventAccumulator.testModels(imodel, (accum) => {
      newModel = imodel.models.getModel<PhysicalModel>(newModelId);
      const newModelProps = newModel.toJSON();
      newModelProps.isNotSpatiallyLocated = newModel.isSpatiallyLocated;
      imodel.models.updateModel(newModelProps);
      imodel.models.updateGeometryGuid(existingModelId);
      imodel.saveChanges("1 update");
      accum.expectNumValidations(1);
      accum.expectChanges({});
    });

    EventAccumulator.testModels(imodel, (accum) => {
      imodel.elements.insertElement(props);
      imodel.saveChanges("insert 1 geometric element");
      accum.expectNumValidations(1);
      accum.expectChanges({});
    });

    EventAccumulator.testModels(imodel, (accum) => {
      newModel.delete();
      imodel.saveChanges("1 delete");
      accum.expectNumValidations(1);
      accum.expectChanges({ deleted: [physicalModelEntity(newModelId)] });

      accum.expectNumApplyChanges(0);
    });

    EventAccumulator.testModels(roImodel, (accum) => {
      roImodel[_nativeDb].restartDefaultTxn();
      accum.expectChanges({ deleted: [physicalModelEntity(newModelId)] });
    });

    // Undo
    EventAccumulator.testModels(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectNumApplyChanges(1);
      accum.expectChanges({ inserted: [physicalModelEntity(newModelId)] });
    });

    EventAccumulator.testModels(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectNumApplyChanges(1);
      accum.expectChanges({});
    });

    EventAccumulator.testModels(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectNumApplyChanges(1);
      accum.expectChanges({});
    });

    EventAccumulator.testModels(imodel, (accum) => {
      imodel.txns.reverseSingleTxn();
      accum.expectNumUndoRedo(1);
      accum.expectNumApplyChanges(1);
      accum.expectChanges({ deleted: [physicalModelEntity(newModelId)] });
    });

    // Redo
    EventAccumulator.testModels(imodel, (accum) => {
      for (let i = 0; i < 4; i++)
        imodel.txns.reinstateTxn();

      accum.expectNumUndoRedo(4);
      accum.expectNumApplyChanges(4);
      accum.expectChanges({ inserted: [physicalModelEntity(newModelId)], deleted: [physicalModelEntity(newModelId)] });
    });
  });

  it("dispatches events when geometry guids change", () => {
    const modelId = props.model;
    const test = (func: (model: PhysicalModel) => boolean) => {
      const model = imodel.models.getModel<PhysicalModel>(modelId);
      const prevGuid = model.geometryGuid;
      let newGuid: string | undefined;
      let numEvents = 0;
      let dropListener = imodel.txns.onModelGeometryChanged.addListener((changes) => {
        expect(numEvents).to.equal(0);
        ++numEvents;
        expect(changes.length).to.equal(1);
        expect(changes[0].id).to.equal(modelId);
        newGuid = changes[0].guid;
        expect(newGuid).not.to.equal(prevGuid);
      });

      const expectEvent = func(model);

      imodel.saveChanges("");
      expect(numEvents).to.equal(expectEvent ? 1 : 0);

      dropListener();
      if (!expectEvent)
        return;

      dropListener = imodel.txns.onModelGeometryChanged.addListener((changes) => {
        ++numEvents;
        expect(changes.length).to.equal(1);
        expect(changes[0].id).to.equal(modelId);
        expect(changes[0].guid).to.equal(prevGuid);
      });

      imodel.txns.reverseSingleTxn();
      expect(numEvents).to.equal(2);
      dropListener();

      dropListener = imodel.txns.onModelGeometryChanged.addListener((changes) => {
        ++numEvents;
        expect(changes.length).to.equal(1);
        expect(changes[0].id).to.equal(modelId);
        expect(changes[0].guid).to.equal(newGuid);
      });

      imodel.txns.reinstateTxn();
      expect(numEvents).to.equal(3);
      dropListener();
    };

    test(() => {
      imodel.models.updateGeometryGuid(modelId);
      return true;
    });

    test((model) => {
      model.geometryGuid = Guid.createValue();
      model.update();
      return false;
    });

    let newElemId: string;
    test(() => {
      newElemId = imodel.elements.insertElement(props);
      return true;
    });

    test(() => {
      const elem = imodel.elements.getElement<TestPhysicalObject>(newElemId);
      elem.userLabel = "not a geometric change";
      elem.intProperty = 42;
      elem.update();
      return false;
    });

    test(() => {
      const elem = imodel.elements.getElement<TestPhysicalObject>(newElemId);
      elem.placement.origin.x += 10;
      elem.update();
      return true;
    });

    test(() => {
      imodel.elements.deleteElement(newElemId);
      return true;
    });

    imodel.saveChanges();

    // now test that all the changes we just made are seen by the readonly connection when we call `restartDefaultTxn`
    let numRoEvents = 0;
    const guid1 = imodel.models.getModel<PhysicalModel>(modelId).geometryGuid;

    const dropper = roImodel.txns.onModelGeometryChanged.addListener((changes) => {
      ++numRoEvents;
      expect(changes.length).to.equal(1);
      expect(changes[0].id).to.equal(modelId);
      expect(changes[0].guid).to.equal(guid1);
    });
    roImodel[_nativeDb].restartDefaultTxn();
    expect(numRoEvents).equal(4);
    dropper();
  });

  it("dispatches events in batches", async () => {
    function entityCount(entities: EntityIdAndClassIdIterable): number {
      let count = 0;
      for (const _entity of entities)
        ++count;

      return count;
    }

    const test = (numChangesExpected: number, func: () => void) => {
      const numChanged: number[] = [];
      const prevMax = setMaxEntitiesPerEvent(2);
      const dropListener = imodel.txns.onElementsChanged.addListener((changes) => {
        const numEntities = entityCount(changes.inserts) + entityCount(changes.updates) + entityCount(changes.deletes);
        numChanged.push(numEntities);
        expect(numEntities).least(1);
        expect(numEntities <= 2).to.be.true;
      });

      func();
      imodel.saveChanges("");

      dropListener();
      setMaxEntitiesPerEvent(prevMax);

      expect(numChanged.length).to.equal(Math.ceil(numChangesExpected / 2));
      for (let i = 0; i < numChanged.length - 1; i++)
        expect(numChanged[i]).to.equal(2);

      if (numChangesExpected > 0)
        expect(numChanged[numChanged.length - 1]).to.equal(0 === numChangesExpected % 2 ? 2 : 1);
    };

    let elemId1: string;
    test(1, () => {
      elemId1 = imodel.elements.insertElement(props);
    });

    let elemId2: string;
    test(2, () => {
      elemId2 = imodel.elements.insertElement(props);
      imodel.elements.deleteElement(elemId1);
    });
    await BeDuration.wait(10); // we rely on updating the lastMod of the newly inserted element, make sure it will be different

    let elemId3: string;
    test(3, () => {
      elemId1 = imodel.elements.insertElement(props);
      elemId3 = imodel.elements.insertElement(props);
      const elem2 = imodel.elements.getElement<TestPhysicalObject>(elemId2);
      elem2.intProperty = 321;
      elem2.update();
    });

    test(4, () => {
      imodel.elements.deleteElement(elemId1);
      imodel.elements.deleteElement(elemId2);
      imodel.elements.deleteElement(elemId3);
      imodel.elements.insertElement(props);
    });
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
    await BeDuration.wait(10); // we rely on updating the lastMod of the newly inserted element, make sure it will be different

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

  // This bug occurred in one of the authoring apps. This test reproduced the problem, and now serves as a regression test.
  it("doesn't crash when reversing a single txn that inserts a model and a contained element while geometric model tracking is enabled", () => {
    imodel[_nativeDb].setGeometricModelTrackingEnabled(true);

    const model = PhysicalModel.insert(imodel, IModel.rootSubjectId, Guid.createValue());
    expect(Id64.isValidId64(model)).to.be.true;
    const elem = imodel.elements.insertElement({ ...props, model });
    expect(Id64.isValidId64(elem)).to.be.true;

    imodel.saveChanges("insert model and element");
    imodel.txns.reverseSingleTxn();

    imodel[_nativeDb].setGeometricModelTrackingEnabled(false);
  });
  it("get local changes", async () => {
    const elements = imodel.elements;
    const txns = imodel.txns;

    const el1 = elements.insertElement(props);
    elements.insertElement(props);

    // Should not return any changes
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: false })), []);

    // Should return change that are not saved yet
    const e0: ChangeInstanceKey[] = [
      {
        changeType: "inserted",
        classFullName: "TestBim:TestPhysicalObject",
        id: "0x40",
      },
      {
        changeType: "inserted",
        classFullName: "TestBim:TestPhysicalObject",
        id: "0x3f",
      },
    ];
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: true })), e0);

    // Saved changes cause change propagation
    imodel.saveChanges("2 inserts");
    const e1: ChangeInstanceKey[] = [
      {
        changeType: "inserted",
        classFullName: "TestBim:TestPhysicalObject",
        id: "0x40",
      },
      {
        changeType: "inserted",
        classFullName: "TestBim:TestPhysicalObject",
        id: "0x3f",
      },
      {
        changeType: "updated",
        classFullName: "BisCore:PhysicalModel",
        id: "0x3c",
      },
    ];
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: false })), e1);
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: true })), e1);

    // delete the element.
    elements.deleteElement(el1);

    // Delete element (0x40) should never show up as it was inserted/deleted locally
    const e3 = [
      {
        changeType: "inserted",
        classFullName: "TestBim:TestPhysicalObject",
        id: "0x40",
      },
      {
        changeType: "updated",
        classFullName: "BisCore:PhysicalModel",
        id: "0x3c",
      },
    ];
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: true })), e3);

    // Saved changes
    imodel.saveChanges("1 deleted");
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: false })), e3);
    assert.deepEqual(Array.from(txns.queryLocalChanges({ includeUnsavedChanges: true })), e3);
  });

  describe("deleteAllTxns", () => {
    it("deletes pending and/or unsaved changes", () => {
      expect(imodel.txns.hasLocalChanges).to.be.false;
      expect(imodel.txns.hasPendingTxns).to.be.false;
      expect(imodel.txns.hasUnsavedChanges).to.be.false;

      imodel.elements.insertElement(props);
      expect(imodel.txns.hasLocalChanges).to.be.true;
      expect(imodel.txns.hasPendingTxns).to.be.false;
      expect(imodel.txns.hasUnsavedChanges).to.be.true;

      imodel.txns.deleteAllTxns();
      expect(imodel.txns.hasLocalChanges).to.be.false;

      imodel.elements.insertElement(props);
      imodel.saveChanges();
      expect(imodel.txns.hasLocalChanges).to.be.true;
      expect(imodel.txns.hasPendingTxns).to.be.true;
      expect(imodel.txns.hasUnsavedChanges).to.be.false;

      imodel.txns.deleteAllTxns();
      expect(imodel.txns.hasLocalChanges).to.be.false;

      imodel.elements.insertElement(props);
      imodel.saveChanges();
      imodel.elements.insertElement(props);
      expect(imodel.txns.hasLocalChanges).to.be.true;
      expect(imodel.txns.hasPendingTxns).to.be.true;
      expect(imodel.txns.hasUnsavedChanges).to.be.true;

      imodel.txns.deleteAllTxns();
      expect(imodel.txns.hasLocalChanges).to.be.false;
    });

    it("clears undo/redo history", () => {
      expect(imodel.txns.isRedoPossible).to.be.false;
      expect(imodel.txns.isUndoPossible).to.be.false;

      imodel.elements.insertElement(props);
      imodel.saveChanges();
      expect(imodel.txns.isUndoPossible).to.be.true;

      imodel.txns.deleteAllTxns();
      expect(imodel.txns.isUndoPossible).to.be.false;

      imodel.elements.insertElement(props);
      imodel.saveChanges();
      imodel.txns.reverseSingleTxn();
      expect(imodel.txns.isRedoPossible).to.be.true;

      imodel.txns.deleteAllTxns();
      expect(imodel.txns.isRedoPossible).to.be.false;
    });
  });
});
