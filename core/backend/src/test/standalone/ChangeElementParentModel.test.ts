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

    it("invalidates cached descendant props after the subtree move", () => {
      // Reading descendant props before the move populates the element cache with the source model.
      // Since the entire subtree is relocated, those cached entries become stale and must be invalidated;
      // otherwise a subsequent read returns the old model. This regresses the bug where only the moved
      // root's cache was invalidated.
      const root = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: root });
      const grandchild = insertElement(modelAId, { parentId: child });

      // Prime the cache while the subtree is still in ModelA.
      assert.equal(iModelDb.elements.getElementProps(child).model, modelAId, "child starts in ModelA");
      assert.equal(iModelDb.elements.getElementProps(grandchild).model, modelAId, "grandchild starts in ModelA");

      txn.changeElementModel({ id: root, modelId: modelBId });
      txn.saveChanges();

      // Reads after the move must reflect the new model, not the stale cached value.
      assert.equal(iModelDb.elements.getElementProps(root).model, modelBId, "root cache must reflect ModelB");
      assert.equal(iModelDb.elements.getElementProps(child).model, modelBId, "child cache must be invalidated and reflect ModelB");
      assert.equal(iModelDb.elements.getElementProps(grandchild).model, modelBId, "grandchild cache must be invalidated and reflect ModelB");
    });

    it("recursively moves a multi-level subtree with multiple children at each level", () => {
      // A subtree is more than a single chain: a node can have several children, each with their own
      // descendants. The recursive move must relocate every node in the tree, not just one branch.
      //   root
      //    ├── childA
      //    │     ├── grandchildA1
      //    │     └── grandchildA2
      //    └── childB
      //          └── grandchildB1
      const root = insertElement(modelAId);
      const childA = insertElement(modelAId, { parentId: root });
      const childB = insertElement(modelAId, { parentId: root });
      const grandchildA1 = insertElement(modelAId, { parentId: childA });
      const grandchildA2 = insertElement(modelAId, { parentId: childA });
      const grandchildB1 = insertElement(modelAId, { parentId: childB });

      txn.changeElementModel({ id: root, modelId: modelBId });
      txn.saveChanges();

      // Every node in the tree must be relocated to the target model.
      for (const id of [root, childA, childB, grandchildA1, grandchildA2, grandchildB1])
        assert.equal(iModelDb.elements.getElementProps(id).model, modelBId, `element ${id} must move to ModelB`);

      // The parent-child hierarchy must be preserved across the move.
      assert.isUndefined(iModelDb.elements.getElementProps(root).parent, "root stays a root in ModelB");
      assert.equal(iModelDb.elements.getElementProps(childA).parent?.id, root, "childA still parented to root");
      assert.equal(iModelDb.elements.getElementProps(childB).parent?.id, root, "childB still parented to root");
      assert.equal(iModelDb.elements.getElementProps(grandchildA1).parent?.id, childA, "grandchildA1 still parented to childA");
      assert.equal(iModelDb.elements.getElementProps(grandchildA2).parent?.id, childA, "grandchildA2 still parented to childA");
      assert.equal(iModelDb.elements.getElementProps(grandchildB1).parent?.id, childB, "grandchildB1 still parented to childB");
    });

    it("blocks an element with a Model-scoped code", () => {
      const elem = insertElement(modelAId, {
        codeSpec: modelScopedCodeSpecId,
        codeScope: modelAId,
        codeValue: "ModelScopedCode",
      });

      expect(() => txn.changeElementModel({ id: elem, modelId: modelBId })).to.throw();
    });

    it("blocks the subtree move when a descendant has a Model-scoped code, leaving the whole subtree untouched", () => {
      // A Model-scoped code cannot survive a model change. Because the entire subtree is validated before
      // anything moves, a Model-scoped code anywhere in the subtree (here on a grandchild) rejects the whole
      // operation — and nothing is moved. This exercises the validate-first atomicity of the recursive move.
      const root = insertElement(modelAId);
      const child = insertElement(modelAId, { parentId: root });
      const grandchild = insertElement(modelAId, {
        parentId: child,
        codeSpec: modelScopedCodeSpecId,
        codeScope: modelAId,
        codeValue: "DescendantModelScoped",
      });

      expect(() => txn.changeElementModel({ id: root, modelId: modelBId })).to.throw();

      // Atomicity: the rejected move must leave the entire subtree in the source model.
      assert.equal(iModelDb.elements.getElementProps(root).model, modelAId, "root must stay in ModelA");
      assert.equal(iModelDb.elements.getElementProps(child).model, modelAId, "child must stay in ModelA");
      assert.equal(iModelDb.elements.getElementProps(grandchild).model, modelAId, "grandchild must stay in ModelA");
    });

    it("allows the subtree move when a descendant has a ParentElement-scoped code (its parent moves with it)", () => {
      // A ParentElement-scoped code is anchored to the element's parent. When the subtree moves, a descendant
      // keeps its parent (the parent moves too), so the code stays valid and the move is allowed. This is the
      // descendant counterpart to the blocked root case below, exercising the isRoot distinction in the addon.
      const root = insertElement(modelAId);
      const child = insertElement(modelAId, {
        parentId: root,
        codeSpec: parentElementCodeSpecId,
        codeScope: root,
        codeValue: "DescendantParentScoped",
      });
      const grandchild = insertElement(modelAId, {
        parentId: child,
        codeSpec: parentElementCodeSpecId,
        codeScope: child,
        codeValue: "DeeperParentScoped",
      });

      txn.changeElementModel({ id: root, modelId: modelBId });
      txn.saveChanges();

      assert.equal(iModelDb.elements.getElementProps(root).model, modelBId, "root moves to ModelB");
      const movedChild = iModelDb.elements.getElementProps(child);
      assert.equal(movedChild.model, modelBId, "child with parent-scoped code moves with the subtree");
      assert.equal(movedChild.parent?.id, root, "child remains parented to root");
      const movedGrandchild = iModelDb.elements.getElementProps(grandchild);
      assert.equal(movedGrandchild.model, modelBId, "grandchild with parent-scoped code moves with the subtree");
      assert.equal(movedGrandchild.parent?.id, child, "grandchild remains parented to child");
    });

    it("blocks moving a root element that has a ParentElement-scoped code", () => {
      // The moved root has no parent to anchor a ParentElement-scoped code, so the move is blocked
      // (use delete+insert instead). Contrast with the descendant case above, which is allowed.
      const scopeElem = insertElement(modelAId);
      const root = insertElement(modelAId, {
        codeSpec: parentElementCodeSpecId,
        codeScope: scopeElem,
        codeValue: "RootParentScoped",
      });

      expect(() => txn.changeElementModel({ id: root, modelId: modelBId })).to.throw();
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
