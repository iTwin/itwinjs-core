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

  it("throws when attempting to move a model element (element id equals model id)", () => {
    // modelAId is also the partition element id — moving it would break the model relationship
    expect(() => txn.moveElement({ id: modelAId, targetModelId: modelBId })).to.throw();
  });

  describe("code scope conflicts", () => {
    it("moves an element with a model-scoped code to a different model (no conflict)", () => {
      const elem = insertElement(modelAId, { codeScope: modelAId, codeValue: "UniqueInA" });

      txn.moveElement({ id: elem, targetModelId: modelBId, code: { spec: codeSpecId, scope: modelBId, value: "UniqueInA" } });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(elem);
      assert.equal(moved.model, modelBId, "model should change to ModelB");
      assert.equal(moved.code.value, "UniqueInA", "code value should remain");
      assert.equal(moved.code.scope, modelBId, "code scope should be updated to target model");
    });

    it("throws when moving an element to a model that already has the same code (unique constraint)", () => {
      // Insert two elements with the same code value but scoped to different models
      const elemInA = insertElement(modelAId, { codeScope: modelAId, codeValue: "DuplicateCode" });
      insertElement(modelBId, { codeScope: modelBId, codeValue: "DuplicateCode" });

      // Moving elemInA to modelB without remapping the code should fail due to unique constraint
      expect(() => txn.moveElement({ id: elemInA, targetModelId: modelBId, code: { spec: codeSpecId, scope: modelBId, value: "DuplicateCode" } })).to.throw();
    });

    it("resolves unique constraint conflict by assigning a new code value during move", () => {
      // Both models have an element with the same code value in their respective scope
      const elemInA = insertElement(modelAId, { codeScope: modelAId, codeValue: "ConflictCode" });
      insertElement(modelBId, { codeScope: modelBId, codeValue: "ConflictCode" });

      // Fix: assign a new unique code value when moving to avoid the constraint violation
      txn.moveElement({ id: elemInA, targetModelId: modelBId, code: { spec: codeSpecId, scope: modelBId, value: "ConflictCode_Remapped" } });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(elemInA);
      assert.equal(moved.model, modelBId, "model should change to ModelB");
      assert.equal(moved.code.value, "ConflictCode_Remapped", "code value should be remapped to avoid conflict");
      assert.equal(moved.code.scope, modelBId, "code scope should be updated to target model");
    });

    it("moves element with parent-scoped code to a new parent (scope changes)", () => {
      const parentA = insertElement(modelAId);
      const elem = insertElement(modelAId, { parentId: parentA, codeScope: parentA, codeValue: "ChildCode" });
      const parentB = insertElement(modelAId);

      // Move to a new parent — provide code with updated scope
      txn.moveElement({ id: elem, targetElementId: parentB, code: { spec: codeSpecId, scope: parentB, value: "ChildCode" } });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(elem);
      assert.equal(moved.parent?.id, parentB, "parent should be parentB");
      assert.equal(moved.code.value, "ChildCode", "code value preserved");
      assert.equal(moved.code.scope, parentB, "code scope should be new parent");
    });

    it("throws when moving element to new parent that already has child with same code", () => {
      const parentA = insertElement(modelAId);
      const elem = insertElement(modelAId, { parentId: parentA, codeScope: parentA, codeValue: "SharedChildCode" });
      const parentB = insertElement(modelAId);
      // Insert a child under parentB with the same code
      insertElement(modelAId, { parentId: parentB, codeScope: parentB, codeValue: "SharedChildCode" });

      // Moving elem to parentB with the same code value should fail
      expect(() => txn.moveElement({ id: elem, targetElementId: parentB, code: { spec: codeSpecId, scope: parentB, value: "SharedChildCode" } })).to.throw();
    });
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

  describe("moveElementTree", () => {
    it("moves an element with direct children to a new model", () => {
      const parent = insertElement(modelAId);
      const child1 = insertElement(modelAId, { parentId: parent });
      const child2 = insertElement(modelAId, { parentId: parent });

      txn.moveElementTree({ id: parent, targetModelId: modelBId });
      txn.saveChanges();

      const movedParent = iModelDb.elements.getElementProps(parent);
      const movedChild1 = iModelDb.elements.getElementProps(child1);
      const movedChild2 = iModelDb.elements.getElementProps(child2);

      assert.equal(movedParent.model, modelBId, "parent should be in ModelB");
      assert.equal(movedChild1.model, modelBId, "child1 should be in ModelB");
      assert.equal(movedChild2.model, modelBId, "child2 should be in ModelB");
      assert.equal(movedChild1.parent?.id, parent, "child1 should still be parented to the moved parent");
      assert.equal(movedChild2.parent?.id, parent, "child2 should still be parented to the moved parent");
    });

    it("moves an element with nested children (depth 2) to a new model", () => {
      const root = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: root });
      const grandchild = insertElement(modelAId, { parentId: child });

      txn.moveElementTree({ id: root, targetModelId: modelBId });
      txn.saveChanges();

      const movedRoot = iModelDb.elements.getElementProps(root);
      const movedChild = iModelDb.elements.getElementProps(child);
      const movedGrandchild = iModelDb.elements.getElementProps(grandchild);

      assert.equal(movedRoot.model, modelBId, "root should be in ModelB");
      assert.equal(movedChild.model, modelBId, "child should be in ModelB");
      assert.equal(movedGrandchild.model, modelBId, "grandchild should be in ModelB");
      assert.equal(movedChild.parent?.id, root, "child parent preserved");
      assert.equal(movedGrandchild.parent?.id, child, "grandchild parent preserved");
    });

    it("invokes onMoveChild callback and applies returned code", () => {
      const parent = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: parent });

      const newChildCode = { spec: codeSpecId, scope: modelBId, value: "OverriddenCode" };

      txn.moveElementTree({
        id: parent,
        targetModelId: modelBId,
        onMoveChild: (_childProps) => newChildCode,
      });
      txn.saveChanges();

      const movedChild = iModelDb.elements.getElementProps(child);
      assert.equal(movedChild.model, modelBId, "child should be in ModelB");
      assert.equal(movedChild.code.value, "OverriddenCode", "child code should be overridden by callback");
    });

    it("moves subtree without callback when codes are not model-scoped", () => {
      const parent = insertElement(modelAId);
      const child1 = insertElement(modelAId, { parentId: parent });
      const child2 = insertElement(modelAId, { parentId: parent });

      // No callback — all elements have empty codes (not model-scoped)
      txn.moveElementTree({ id: parent, targetModelId: modelBId });
      txn.saveChanges();

      const movedChild1 = iModelDb.elements.getElementProps(child1);
      const movedChild2 = iModelDb.elements.getElementProps(child2);
      assert.equal(movedChild1.model, modelBId);
      assert.equal(movedChild2.model, modelBId);
    });
  });
});
