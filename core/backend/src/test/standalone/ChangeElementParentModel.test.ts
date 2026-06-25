/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, DefinitionElementProps, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { ChannelControl, DefinitionModel, EditTxn, IModelJsFs, PhysicalModel, SnapshotDb, SpatialCategory } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { withEditTxn } from "../TestEditTxn";

describe("changeElementParent and changeElementModel", () => {
  let seedDb: SnapshotDb;
  let iModelDb: SnapshotDb;
  let modelAId: Id64String;
  let modelBId: Id64String;
  let defModelAId: Id64String;
  let defModelBId: Id64String;
  let categoryId: Id64String;
  let relatedElementCodeSpecId: Id64String;
  let modelScopedCodeSpecId: Id64String;
  let parentElementCodeSpecId: Id64String;
  let repositoryCodeSpecId: Id64String;
  let txn: EditTxn;

  before(async () => {
    IModelJsFs.recursiveMkDirSync(KnownTestLocations.outputDir);
    const seedFile = IModelTestUtils.prepareOutputFile("ChangeElementParentModel", "seed.bim");
    seedDb = SnapshotDb.createEmpty(seedFile, { rootSubject: { name: "ChangeElementParentModel" } });

    await withEditTxn(seedDb, "setup seed", async (editTxn) => {
      modelAId = PhysicalModel.insert(editTxn, IModel.rootSubjectId, "ModelA");
      modelBId = PhysicalModel.insert(editTxn, IModel.rootSubjectId, "ModelB");
      defModelAId = DefinitionModel.insert(editTxn, IModel.rootSubjectId, "DefinitionModelA");
      defModelBId = DefinitionModel.insert(editTxn, IModel.rootSubjectId, "DefinitionModelB");
      categoryId = SpatialCategory.insert(editTxn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
      relatedElementCodeSpecId = seedDb.codeSpecs.insert(editTxn, "RelatedElementCodeSpec", CodeScopeSpec.Type.RelatedElement);
      modelScopedCodeSpecId = seedDb.codeSpecs.insert(editTxn, "ModelScopedCodeSpec", CodeScopeSpec.Type.Model);
      parentElementCodeSpecId = seedDb.codeSpecs.insert(editTxn, "ParentElementCodeSpec", CodeScopeSpec.Type.ParentElement);
      repositoryCodeSpecId = seedDb.codeSpecs.insert(editTxn, "RepositoryCodeSpec", CodeScopeSpec.Type.Repository);
      assert.isNotEmpty(modelAId, "Expected a valid PhysicalModel id for ModelA");
      assert.isNotEmpty(modelBId, "Expected a valid PhysicalModel id for ModelB");
      assert.isNotEmpty(defModelAId, "Expected a valid DefinitionModel id for DefinitionModelA");
      assert.isNotEmpty(defModelBId, "Expected a valid DefinitionModel id for DefinitionModelB");
      assert.isNotEmpty(categoryId, "Expected a valid SpatialCategory id");
      assert.isNotEmpty(relatedElementCodeSpecId, "Expected a valid RelatedElement CodeSpec id");
      assert.isNotEmpty(modelScopedCodeSpecId, "Expected a valid Model CodeSpec id");
      assert.isNotEmpty(parentElementCodeSpecId, "Expected a valid ParentElement CodeSpec id");
      assert.isNotEmpty(repositoryCodeSpecId, "Expected a valid Repository CodeSpec id");
    });
  });

  beforeEach(() => {
    iModelDb = SnapshotDb.createFrom(seedDb, IModelTestUtils.prepareOutputFile("ChangeElementParentModel", "ChangeElementParentModel.bim"));
    assert.isTrue(iModelDb.isOpen);
    txn = new EditTxn(iModelDb, "change element parent/model");
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

  const insertElement = (modelId: Id64String, opts: { parentId?: Id64String; codeSpec?: Id64String; codeScope?: Id64String; codeValue?: string } = {}): Id64String => {
    const { parentId, codeSpec, codeScope, codeValue } = opts;
    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: codeSpec && codeScope && codeValue ? { spec: codeSpec, scope: codeScope, value: codeValue } : Code.createEmpty(),
      placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
    };
    const id = txn.insertElement(props);
    assert.isNotEmpty(id, "insertElement must return a valid ID");
    txn.saveChanges();
    return id;
  };

  describe("changeElementParent", () => {
    it("changes parent of a leaf element in the same model", () => {
      const parentA = insertElement(modelAId);
      const leaf = insertElement(modelAId, { parentId: parentA });
      const parentB = insertElement(modelAId);

      txn.changeElementParent({ id: leaf, parentId: parentB });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(leaf);
      assert.equal(moved.model, modelAId, "model should remain the same");
      assert.equal(moved.parent?.id, parentB, "parent should be updated to parentB");
    });

    it("leaves children attached and in the same model when reparenting within the same model", () => {
      const parent = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: parent });
      const newParent = insertElement(modelAId);

      txn.changeElementParent({ id: parent, parentId: newParent });
      txn.saveChanges();

      const movedParent = iModelDb.elements.getElementProps(parent);
      assert.equal(movedParent.model, modelAId, "model stays the same");
      assert.equal(movedParent.parent?.id, newParent, "parent updated");

      const movedChild = iModelDb.elements.getElementProps(child);
      assert.equal(movedChild.model, modelAId, "child model stays the same");
      assert.equal(movedChild.parent?.id, parent, "child still parented to the moved element");
    });

    it("allows an element with a RelatedElement-scoped code", () => {
      const parentA = insertElement(modelAId);
      const leaf = insertElement(modelAId, {
        parentId: parentA,
        codeSpec: relatedElementCodeSpecId,
        codeScope: parentA,
        codeValue: "RelatedCode",
      });
      const parentB = insertElement(modelAId);

      txn.changeElementParent({ id: leaf, parentId: parentB });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(leaf);
      assert.equal(moved.parent?.id, parentB, "parent should be updated");
    });

    it("allows an element with a Model-scoped code (the model does not change)", () => {
      const parentA = insertElement(modelAId);
      const leaf = insertElement(modelAId, {
        parentId: parentA,
        codeSpec: modelScopedCodeSpecId,
        codeScope: modelAId,
        codeValue: "ModelScopedSameModel",
      });
      const parentB = insertElement(modelAId);

      txn.changeElementParent({ id: leaf, parentId: parentB });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(leaf);
      assert.equal(moved.parent?.id, parentB, "parent should be updated within same model");
    });

    it("blocks an element with a ParentElement-scoped code", () => {
      const parentA = insertElement(modelAId);
      const leaf = insertElement(modelAId, {
        parentId: parentA,
        codeSpec: parentElementCodeSpecId,
        codeScope: parentA,
        codeValue: "ParentScopedCode",
      });
      const parentB = insertElement(modelAId);

      expect(() => txn.changeElementParent({ id: leaf, parentId: parentB })).to.throw();
    });

    it("rejects reparenting to a parent in a different model", () => {
      const parentInA = insertElement(modelAId);
      const leaf = insertElement(modelAId, { parentId: parentInA });
      const targetInB = insertElement(modelBId);

      expect(() => txn.changeElementParent({ id: leaf, parentId: targetInB })).to.throw("different model");

      // A rejected reparent must leave the element untouched.
      const unchanged = iModelDb.elements.getElementProps(leaf);
      assert.equal(unchanged.model, modelAId, "model should remain ModelA");
      assert.equal(unchanged.parent?.id, parentInA, "parent should remain unchanged");
    });
  });

  describe("changeElementModel", () => {
    it("changes model of a leaf element (becomes root in new model)", () => {
      const elem = insertElement(modelAId);

      txn.changeElementModel({ id: elem, modelId: modelBId });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(elem);
      assert.equal(moved.model, modelBId, "model should change to ModelB");
      assert.isUndefined(moved.parent, "element should have no parent (root in ModelB)");
    });

    it("blocks moving an element that has a parent", () => {
      const parent = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: parent });

      // Only root elements (no parent) can be moved between models. Reparent first if needed.
      expect(() => txn.changeElementModel({ id: child, modelId: modelBId })).to.throw();
    });

    it("moves the whole subtree when changing the model of a root element with children", () => {
      // A root element (no parent) may itself have children. BIS requires a parent and all of its
      // children to reside in the same model (see element-fundamentals: "Both the parent and the
      // children must live in the same Model"). Moving such a root must therefore move its entire
      // subtree, never leave the children orphaned in the source model.
      const root = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: root });
      const grandchild = insertElement(modelAId, { parentId: child });

      txn.changeElementModel({ id: root, modelId: modelBId });
      txn.saveChanges();

      const movedRoot = iModelDb.elements.getElementProps(root);
      const movedChild = iModelDb.elements.getElementProps(child);
      const movedGrandchild = iModelDb.elements.getElementProps(grandchild);

      // The root moves to the target model.
      assert.equal(movedRoot.model, modelBId, "root should move to ModelB");
      // The descendants must move with it - otherwise the assembly spans two models (BIS-invalid).
      assert.equal(movedChild.model, modelBId, "child must move with its parent (same-model invariant)");
      assert.equal(movedGrandchild.model, modelBId, "grandchild must move with the subtree");
      // The hierarchy itself must be preserved.
      assert.equal(movedChild.parent?.id, root, "child still parented to root");
      assert.equal(movedGrandchild.parent?.id, child, "grandchild still parented to child");
    });

    it("blocks an element with a Model-scoped code", () => {
      const elem = insertElement(modelAId, {
        codeSpec: modelScopedCodeSpecId,
        codeScope: modelAId,
        codeValue: "ModelScopedCode",
      });

      expect(() => txn.changeElementModel({ id: elem, modelId: modelBId })).to.throw();
    });

    it("allows an element with a RelatedElement-scoped code", () => {
      const scopeElem = insertElement(modelAId);
      const elem = insertElement(modelAId, {
        codeSpec: relatedElementCodeSpecId,
        codeScope: scopeElem,
        codeValue: "RelatedCode",
      });

      txn.changeElementModel({ id: elem, modelId: modelBId });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(elem);
      assert.equal(moved.model, modelBId, "model should change to ModelB");
    });

    it("rejects a model change when the model types differ", () => {
      const physElem = insertElement(modelAId);

      expect(() => txn.changeElementModel({ id: physElem, modelId: defModelAId })).to.throw("cannot move element from model of type");
    });

    it("throws when attempting to change the model of a partition element", () => {
      expect(() => txn.changeElementModel({ id: modelAId, modelId: modelBId })).to.throw();
    });
  });

  describe("definition models", () => {
    const insertDefinitionElement = (modelId: Id64String, name: string, opts: { parentId?: Id64String } = {}): Id64String => {
      const props: DefinitionElementProps = {
        classFullName: "Generic:PhysicalType",
        model: modelId,
        code: { spec: relatedElementCodeSpecId, scope: modelId, value: name },
        ...(opts.parentId ? { parent: { id: opts.parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
      };
      const id = txn.insertElement(props);
      assert.isNotEmpty(id, "insertDefinitionElement must return a valid ID");
      txn.saveChanges();
      return id;
    };

    it("moves a definition element to another definition model via changeElementModel", () => {
      const defElem = insertDefinitionElement(defModelAId, "MovableCategoryA");

      txn.changeElementModel({ id: defElem, modelId: defModelBId });
      txn.saveChanges();

      const moved = iModelDb.elements.getElementProps(defElem);
      assert.equal(moved.model, defModelBId, "model should change to DefinitionModelB");
      assert.isUndefined(moved.parent, "element should be a root in DefinitionModelB");
    });

    it("rejects reparenting a definition element across definition models", () => {
      const defElem = insertDefinitionElement(defModelAId, "MovableCategoryB");
      const targetElem = insertDefinitionElement(defModelBId, "TargetInDefB");

      expect(() => txn.changeElementParent({ id: defElem, parentId: targetElem })).to.throw("different model");
    });

    it("rejects changing the parent of a physical element to a parent in a definition model", () => {
      const physElem = insertElement(modelAId);
      const defTarget = insertDefinitionElement(defModelAId, "DefTargetForPhys");

      expect(() => txn.changeElementParent({ id: physElem, parentId: defTarget })).to.throw("different model");
    });

    it("rejects changing a physical element to a definition model", () => {
      const physElem = insertElement(modelAId);

      expect(() => txn.changeElementModel({ id: physElem, modelId: defModelAId })).to.throw("cannot move element from model of type");
    });

    it("rejects changing a definition element into a physical model", () => {
      const defElem = insertDefinitionElement(defModelAId, "DefElemToMoveToPhys");

      expect(() => txn.changeElementModel({ id: defElem, modelId: modelAId })).to.throw("cannot move element from model of type");
    });
  });

});
