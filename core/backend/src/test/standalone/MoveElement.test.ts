/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, DefinitionElementProps, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { ChannelControl, DefinitionModel, DefinitionPartition, EditTxn, IModelJsFs, PhysicalModel, SnapshotDb, SpatialCategory } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { withEditTxn } from "../TestEditTxn";

describe("moveElement", () => {
  let seedDb: SnapshotDb;
  let iModelDb: SnapshotDb;
  let modelAId: Id64String;
  let modelBId: Id64String;
  let defModelAId: Id64String;
  let defModelBId: Id64String;
  let categoryId: Id64String;
  let codeSpecId: Id64String;
  let txn: EditTxn;

  before(async () => {
    IModelJsFs.recursiveMkDirSync(KnownTestLocations.outputDir);
    const seedFile = IModelTestUtils.prepareOutputFile("MoveElement", "seed.bim");
    seedDb = SnapshotDb.createEmpty(seedFile, { rootSubject: { name: "MoveElement" } });

    await withEditTxn(seedDb, "setup seed", async (editTxn) => {
      modelAId = PhysicalModel.insert(editTxn, IModel.rootSubjectId, "ModelA");
      modelBId = PhysicalModel.insert(editTxn, IModel.rootSubjectId, "ModelB");
      defModelAId = DefinitionModel.insert(editTxn, IModel.rootSubjectId, "DefinitionModelA");
      defModelBId = DefinitionModel.insert(editTxn, IModel.rootSubjectId, "DefinitionModelB");
      categoryId = SpatialCategory.insert(editTxn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
      codeSpecId = seedDb.codeSpecs.insert(editTxn, "TestCodeSpec", CodeScopeSpec.Type.RelatedElement);
      assert.isNotEmpty(modelAId, "Expected a valid PhysicalModel id for ModelA");
      assert.isNotEmpty(modelBId, "Expected a valid PhysicalModel id for ModelB");
      assert.isNotEmpty(defModelAId, "Expected a valid DefinitionModel id for DefinitionModelA");
      assert.isNotEmpty(defModelBId, "Expected a valid DefinitionModel id for DefinitionModelB");
      assert.isNotEmpty(categoryId, "Expected a valid SpatialCategory id");
      assert.isNotEmpty(codeSpecId, "Expected a valid CodeSpec id");
    });
  });

  beforeEach(() => {
    iModelDb = SnapshotDb.createFrom(seedDb, IModelTestUtils.prepareOutputFile("MoveElement", "MoveElement.bim"));
    assert.isTrue(iModelDb.isOpen);
    txn = new EditTxn(iModelDb, "move elements");
    txn.start();
    iModelDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  afterEach(() => {
    if (txn.isActive)
      txn.end("abandon");
    if (iModelDb.isOpen)
      iModelDb.close();
  });

  after(() => {
    if (seedDb.isOpen)
      seedDb.close();
  });

  const insertElement = (modelId: Id64String, opts: { parentId?: Id64String; codeScope?: Id64String; codeValue?: string } = {}): Id64String => {
    const { parentId, codeScope, codeValue } = opts;
    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: codeScope && codeValue ? { spec: codeSpecId, scope: codeScope, value: codeValue } : Code.createEmpty(),
      placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
    };
    const id = txn.insertElement(props);
    assert.isNotEmpty(id, "insertElement must return a valid ID");
    txn.saveChanges();
    return id;
  };

  it("moves a leaf element to a new parent in the same model", () => {
    const parentA = insertElement(modelAId);
    const leaf = insertElement(modelAId, { parentId: parentA });
    const parentB = insertElement(modelAId);

    txn.moveElement({ id: leaf, targetElementId: parentB });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(leaf);
    assert.equal(moved.model, modelAId, "model should remain the same");
    assert.equal(moved.parent?.id, parentB, "parent should be updated to parentB");
  });

  it("moves a leaf element to a different model", () => {
    const parentInA = insertElement(modelAId);
    const leaf = insertElement(modelAId, { parentId: parentInA });
    const targetInB = insertElement(modelBId);

    txn.moveElement({ id: leaf, targetElementId: targetInB });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(leaf);
    assert.equal(moved.model, modelBId, "model should change to ModelB");
    assert.equal(moved.parent?.id, targetInB, "parent should be updated to target in ModelB");
  });

  it("throws when attempting to move an element that has children", () => {
    const parent = insertElement(modelAId);
    insertElement(modelAId, { parentId: parent }); // child
    const target = insertElement(modelBId);

    expect(() => txn.moveElement({ id: parent, targetElementId: target })).to.throw();
  });

  it("moves an element with a new code", () => {
    const leaf = insertElement(modelAId);
    const target = insertElement(modelBId);
    const newCode = { spec: codeSpecId, scope: target, value: "MovedElementCode" };

    txn.moveElement({ id: leaf, targetElementId: target, code: newCode });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(leaf);
    assert.equal(moved.model, modelBId, "model should change to ModelB");
    assert.equal(moved.code.value, "MovedElementCode", "code value should be updated");
  });

  it("moves a root element (no parent) to a different model via target parent", () => {
    const rootElem = insertElement(modelAId);
    const targetParent = insertElement(modelBId);

    txn.moveElement({ id: rootElem, targetElementId: targetParent });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(rootElem);
    assert.equal(moved.model, modelBId, "model should change to ModelB");
    assert.equal(moved.parent?.id, targetParent, "parent should be set to targetParent");
  });

  it("moves an element to a different model as root using targetModelId only", () => {
    const leaf = insertElement(modelAId);

    txn.moveElement({ id: leaf, targetModelId: modelBId });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(leaf);
    assert.equal(moved.model, modelBId, "model should change to ModelB");
    assert.isUndefined(moved.parent, "element should have no parent (root in ModelB)");
  });

  it("moves a child element to a different model as root (clears parent)", () => {
    const parent = insertElement(modelAId);
    const child = insertElement(modelAId, { parentId: parent });

    txn.moveElement({ id: child, targetModelId: modelBId });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(child);
    assert.equal(moved.model, modelBId, "model should change to ModelB");
    assert.isUndefined(moved.parent, "parent should be cleared (root in ModelB)");
  });

  it("moves an element to a model with a specific parent using both targetModelId and targetElementId", () => {
    const leaf = insertElement(modelAId);
    const targetParent = insertElement(modelBId);

    txn.moveElement({ id: leaf, targetModelId: modelBId, targetElementId: targetParent });
    txn.saveChanges();

    const moved = iModelDb.elements.getElementProps(leaf);
    assert.equal(moved.model, modelBId, "model should change to ModelB");
    assert.equal(moved.parent?.id, targetParent, "parent should be set to targetParent");
  });

  it("throws when neither targetModelId nor targetElementId is specified", () => {
    const leaf = insertElement(modelAId);
    expect(() => txn.moveElement({ id: leaf })).to.throw(/at least one/);
  });

  describe("definition models", () => {
    const insertDefinitionElement = (modelId: Id64String, name: string, opts: { parentId?: Id64String } = {}): Id64String => {
      const props: DefinitionElementProps = {
        classFullName: "Generic:PhysicalType",
        model: modelId,
        code: { spec: codeSpecId, scope: modelId, value: name },
        ...(opts.parentId ? { parent: { id: opts.parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
      };
      const id = txn.insertElement(props);
      assert.isNotEmpty(id, "insertDefinitionElement must return a valid ID");
      txn.saveChanges();
      return id;
    };

    it("moves a definition element between definition models", () => {
      const defElem = insertDefinitionElement(defModelAId, "MovableCategoryA");
      const targetElem = insertDefinitionElement(defModelBId, "TargetInDefB");

      txn.moveElement({ id: defElem, targetElementId: targetElem });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(defElem);
      assert.equal(moved.model, defModelBId, "model should change to DefinitionModelB");
      assert.equal(moved.parent?.id, targetElem, "parent should be set to target in DefinitionModelB");
    });

    it("moves a definition element to a different definition model as root element via modeled element", () => {
      const defElem = insertDefinitionElement(defModelAId, "MovableCategoryB");

      // Target the modeled element (partition) of defModelB — element becomes root in that model
      const defModelBPartitionId = iModelDb.elements.queryElementIdByCode(
        DefinitionPartition.createCode(iModelDb, IModel.rootSubjectId, "DefinitionModelB"),
      )!;
      assert.isNotEmpty(defModelBPartitionId, "Expected to find DefinitionModelB partition element");

      txn.moveElement({ id: defElem, targetElementId: defModelBPartitionId });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(defElem);
      assert.equal(moved.model, defModelBId, "model should change to DefinitionModelB");
    });

    it("rejects moving a physical element into a definition model", () => {
      const physElem = insertElement(modelAId);
      const defTarget = insertDefinitionElement(defModelAId, "DefTargetForPhys");

      expect(() => txn.moveElement({ id: physElem, targetElementId: defTarget })).to.throw();
    });
  });
});
