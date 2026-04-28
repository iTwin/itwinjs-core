import { assert } from "chai";
import { DbResult, Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { BulkDeleteElementsResult, BulkDeleteElementsStatus, ChannelControl, EditTxn, IModelJsFs, PhysicalModel, SnapshotDb, SpatialCategory, Subject } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { withEditTxn } from "../TestEditTxn";

describe("deleteElements (native bulk delete API)", () => {
  let seedDb: SnapshotDb;
  let iModelDb: SnapshotDb;
  let modelId: Id64String;
  let categoryId: Id64String;
  let codeSpecId: Id64String;
  let txn: EditTxn;

  before(async () => {
    IModelJsFs.recursiveMkDirSync(KnownTestLocations.outputDir);
    const seedFile = IModelTestUtils.prepareOutputFile("DeleteElements", "seed.bim");
    seedDb = SnapshotDb.createEmpty(seedFile, { rootSubject: { name: "DeleteElements" } });

    await withEditTxn(seedDb, "create elements", async (editTxn) => {
      modelId = PhysicalModel.insert(editTxn, IModel.rootSubjectId, "TestModel");
      categoryId = SpatialCategory.insert(editTxn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
      codeSpecId = seedDb.codeSpecs.insert(editTxn, "TestScopeSpec", CodeScopeSpec.Type.RelatedElement);
      assert.isNotEmpty(modelId, "Expected a valid PhysicalModel id");
      assert.isNotEmpty(categoryId, "Expected a valid SpatialCategory id");
      assert.isNotEmpty(codeSpecId, "Expected a valid CodeSpec id");
    });
  });

  beforeEach(() => {
    iModelDb = SnapshotDb.createFrom(seedDb, IModelTestUtils.prepareOutputFile("DeleteElements", "DeleteElements.bim"));
    assert.isTrue(iModelDb.isOpen);
    txn = new EditTxn(iModelDb, "delete elements");
    txn.start();
    iModelDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  afterEach(() => {
    txn.end("abandon");
    if (iModelDb.isOpen) {
      iModelDb.close();
    }
  });

  after(() => {
    if (seedDb.isOpen)
      seedDb.close();
  });

  const insertElement = (opts: { parentId?: Id64String; codeScope?: Id64String; codeValue?: string } = {}): Id64String => {
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

  /** Assert that the element with the given id exists or has been deleted. */
  const assertExists = (id: Id64String, msg: string) => assert.isDefined(iModelDb.elements.tryGetElement(id), msg);
  const assertDeleted = (id: Id64String, msg: string) => assert.isUndefined(iModelDb.elements.tryGetElement(id), msg);

  // Run deleteElements, then verify the returned failed set, check each id in `deleted` is gone and each id in `retained` is still present.
  const executeTestCase = (label: string, idsToDelete: Id64Array, deleted: Id64Array, retained: Id64Array, expectedFailed: Id64Array = []) => {
    const resultStatus: BulkDeleteElementsResult = txn.deleteElements(idsToDelete);
    if (expectedFailed.length === 0)
      assert.equal(resultStatus.status, BulkDeleteElementsStatus.Success);
    else
      assert.equal(resultStatus.status, (expectedFailed.length === idsToDelete.length) ? BulkDeleteElementsStatus.DeletionFailed : BulkDeleteElementsStatus.PartialSuccess);

    assert.sameMembers(Array.from(resultStatus.failedIds), expectedFailed, `[${label}] failed set mismatch`);

    for (const id of deleted)
      assertDeleted(id, `[${label}] ${id} should have been deleted`);

    for (const id of retained)
      assertExists(id, `[${label}] ${id} should have been retained`);

    txn.abandonChanges();
  };

  /**
   * Shared hierarchy used throughout the parent-child tests:
   *
   *   parentA                    parentB              standalone
   *     ├─ childA1                 ├─ childB1            └─ childS1
   *     │    └─ grandchildA1       └─ childB2
   *     ├─ childA2
   *     │    └─ grandchildA2
   *     └─ childA3
   */
  describe("basic tests", () => {
    let parentA: Id64String, childA1: Id64String, grandchildA1: Id64String;
    let childA2: Id64String, grandchildA2: Id64String, childA3: Id64String;
    let parentB: Id64String, childB1: Id64String, childB2: Id64String;
    let standalone: Id64String, childS1: Id64String;
    let all: Id64Array;

    beforeEach(() => {
      parentA = insertElement();
      childA1 = insertElement({ parentId: parentA });
      grandchildA1 = insertElement({ parentId: childA1 });
      childA2 = insertElement({ parentId: parentA });
      grandchildA2 = insertElement({ parentId: childA2 });
      childA3 = insertElement({ parentId: parentA });
      parentB = insertElement();
      childB1 = insertElement({ parentId: parentB });
      childB2 = insertElement({ parentId: parentB });
      standalone = insertElement();
      childS1 = insertElement({ parentId: standalone });
      all = [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3,
        parentB, childB1, childB2, standalone, childS1];
    });

    it("delete a root element", () => {
      executeTestCase("root cascades",
        [parentA],
        [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3],
        [parentB, childB1, childB2, standalone, childS1]);
    });

    it("explicitly delete the whole tree", () => {
      executeTestCase("redundant descendants in input",
        [parentA, childA1, grandchildA1, childA2],
        [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3],
        [parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting all roots removes every element", () => {
      executeTestCase("delete all roots",
        [parentA, parentB, standalone],
        all,
        []);
    });

    it("empty input set is a no-op", () => {
      executeTestCase("empty set",
        [],
        [],
        all);
    });

    it("duplicate IDs should be handled", () => {
      const rootA = insertElement();
      const rootB = insertElement();

      // rootA appears twice - should not throw and should be deleted exactly once.
      assert.equal(txn.deleteElements([rootA, rootA, rootB]).status, BulkDeleteElementsStatus.Success);
      assertDeleted(rootA, "rootA should be deleted");
      assertDeleted(rootB, "rootB should be deleted");
    });

    it("invalid IDs in the input throw an exception", () => {
      const rootA = insertElement();

      assert.throws(() => txn.deleteElements([Id64.invalid, rootA]), `Invalid element ids: 0`);
      assert.throws(() => txn.deleteElements(["not-an-id", rootA]), `Invalid element ids: not-an-id`);

      assertExists(rootA, "rootA should not have been deleted after a throw");
    });

    it("deleting a child removes its subtree but leaves the parent", () => {
      executeTestCase("delete depth-1 child",
        [childA1],
        [childA1, grandchildA1],
        [parentA, childA2, grandchildA2, childA3, parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting two mid-tree siblings leaves their parent and unrelated siblings", () => {
      executeTestCase("delete two depth-1 siblings",
        [childA1, childA2],
        [childA1, grandchildA1, childA2, grandchildA2],
        [parentA, childA3, parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting a child from one tree and a child from another tree", () => {
      executeTestCase("cross-tree mid-tree delete",
        [childA1, childB2],
        [childA1, grandchildA1, childB2],
        [parentA, childA2, grandchildA2, childA3, parentB, childB1, standalone, childS1]);
    });

    it("deleting mid-tree nodes mixed with a root", () => {
      executeTestCase("mid-tree + roots mixed",
        [childA1, childA3, parentB, standalone],
        [childA1, grandchildA1, childA3, parentB, childB1, childB2, standalone, childS1],
        [parentA, childA2, grandchildA2]);
    });

    it("deleting only grandchildren leaves all ancestors", () => {
      executeTestCase("delete leaves only",
        [grandchildA1, grandchildA2],
        [grandchildA1, grandchildA2],
        [parentA, childA1, childA2, childA3, parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting leaves from different subtrees simultaneously", () => {
      executeTestCase("leaves from multiple subtrees",
        [grandchildA1, childB1, childS1],
        [grandchildA1, childB1, childS1],
        [parentA, childA1, childA2, grandchildA2, childA3, parentB, childB2, standalone]);
    });

    it("deleting root, mid-tree and leaf", () => {
      executeTestCase("root + child + grandchild + leaf",
        [childA1, grandchildA2, parentB, childS1],
        [childA1, grandchildA1, grandchildA2, parentB, childB1, childB2, childS1],
        [parentA, childA2, childA3, standalone]);
    });

    it("parent and its grandchild", () => {
      executeTestCase("parent + grandchild redundant",
        [parentA, grandchildA1],
        [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3],
        [parentB, childB1, childB2, standalone, childS1]);
    });
  });

  describe("intra-set code scope dependency", () => {
    it("child element is the code scope for an unrelated element", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA, codeValue: "rootB-code" });
      executeTestCase("depth-1 child scopes unrelated root - delete child+root directly",
        [childA, rootB],
        [childA, rootB],
        [rootA]);

      executeTestCase("depth-1 child scopes unrelated root - delete child only",
        [childA],
        [],
        [rootA, childA, rootB],
        [childA]);

      executeTestCase("depth-1 child scopes unrelated root - delete root only",
        [rootB],
        [rootB],
        [rootA, childA]);
    });

    it("grandchild is the code scope for an unrelated root", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement({ codeScope: grandchildA, codeValue: "rootB-code" });
      executeTestCase("depth-2 grandchild scopes unrelated root - delete both roots",
        [rootA, rootB],
        [rootA, childA, grandchildA, rootB],
        []);

      executeTestCase("depth-2 grandchild scopes unrelated root - delete grandchild+root directly",
        [grandchildA, rootB],
        [grandchildA, rootB],
        [rootA, childA]);
    });

    it("root element scopes a child in another subtree", () => {
      const rootA = insertElement();
      const rootB = insertElement();
      const childB = insertElement({ parentId: rootB, codeScope: rootA, codeValue: "childB-code" });
      executeTestCase("root scopes depth-1 child in sibling tree",
        [rootA, rootB],
        [rootA, rootB, childB],
        []);
    });

    it("scope chains", () => {
      // C -> B -> A
      // Test all combinations of inputs
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      executeTestCase("scope chain single A", [rootA], [], [rootA, rootB, rootC], [rootA]);
      executeTestCase("scope chain single B", [rootB], [], [rootA, rootB, rootC], [rootB]);
      executeTestCase("scope chain single C", [rootC], [rootC], [rootA, rootB]);

      executeTestCase("scope chain forward", [rootA, rootB, rootC], [rootA, rootB, rootC], []);
      executeTestCase("scope chain reversed", [rootC, rootB, rootA], [rootA, rootB, rootC], []);
      executeTestCase("scope chain middle-first", [rootB, rootA, rootC], [rootA, rootB, rootC], []);
    });

    it("scope chain A -> B -> C -> D where only A and D are in the delete set", () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      const rootD = insertElement({ codeScope: rootC, codeValue: "rootD-code" });

      // Only A and D in the delete set. B is external -> A ignored. D's scope (C) is not being deleted -> D is safe.
      executeTestCase("deep gap chain: A ignored, D deleted",
        [rootA, rootD],
        [rootD],
        [rootA, rootB, rootC],
        [rootA]);
    });

    it("scope chain delete with skipping constraint validation should fail", () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      const rootD = insertElement({ codeScope: rootC, codeValue: "rootD-code" });

      const resultStatus: BulkDeleteElementsResult = txn.deleteElements([rootA, rootD], { skipFKConstraintValidations: true });
      assert.equal(resultStatus.status, BulkDeleteElementsStatus.DeletionFailed);
      assert.equal(resultStatus.sqlDeleteStatus, DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY);
    });

    it("two elements using the same scope", () => {
      // A is the code scope for both B and C independently.
      //     A
      //    / \
      //   B   C  (code scope, not parent-child)
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootA, codeValue: "rootC-code" });
      executeTestCase("delete all three",
        [rootA, rootB, rootC],
        [rootA, rootB, rootC],
        []);

      executeTestCase("delete only B and C",
        [rootB, rootC],
        [rootB, rootC],
        [rootA]);
    });

    it("parent is also the code scope of its own child", () => {
      const rootP = insertElement();
      const childC = insertElement({ parentId: rootP, codeScope: rootP, codeValue: "childC-code" });
      executeTestCase("parent is code scope of child - delete parent",
        [rootP],
        [rootP, childC],
        []);
    });

    it("sibling scopes it's own sibling", () => {
      // parent
      //  ├─ childA  (code scope for childB)
      //  └─ childB  (scoped by childA)
      const parent = insertElement();
      const childA = insertElement({ parentId: parent });
      const childB = insertElement({ parentId: parent, codeScope: childA, codeValue: "childB-code" });

      // Delete via parent cascade - sibling scope must not block deletion.
      executeTestCase("sibling scope - delete via parent",
        [parent],
        [parent, childA, childB],
        []);

      // Delete both siblings directly - intra-set scope, no external violation.
      executeTestCase("sibling scope - delete both directly",
        [childA, childB],
        [childA, childB],
        [parent]);

      // Delete only the scoped child - its scope (childA) is not being deleted, safe to delete.
      executeTestCase("sibling scope - delete only scoped child",
        [childB],
        [childB],
        [parent, childA]);

      // Delete only the scope element - childB is external -> childA ignored.
      executeTestCase("sibling scope - delete only scope element, ignored due to external childB",
        [childA],
        [],
        [parent, childA, childB],
        [childA]);
    });
  });

  describe("Code scope violations to test delete set element pruning", () => {
    it("root is code scope for an external element", () => {
      const rootA = insertElement();
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      const rootB = insertElement();
      executeTestCase("external scopes root",
        [rootA, rootB],
        [rootB],
        [rootA, external],
        [rootA]);
    });

    it("depth-1 child is code scope for external", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      executeTestCase("external scopes depth-1 child - parent subtree ignored",
        [rootA, rootB],
        [rootB],
        [rootA, childA, external],
        [rootA]);
    });

    it("depth-2 grandchild is code scope for external", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      const rootB = insertElement();
      executeTestCase("external scopes depth-2 grandchild - grandparent subtree ignored",
        [rootA, rootB],
        [rootB],
        [rootA, childA, grandchildA, external],
        [rootA]);
    });

    it("only the child is passed for deletion", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      executeTestCase("external scopes requested child",
        [childA],
        [],
        [rootA, childA, external],
        [childA]);
    });

    it("root has both an external scope dependent AND an intra-set scope dependent", () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      executeTestCase("root ignored due to external; sibling still deleted",
        [rootA, rootB],
        [rootB],
        [rootA, external],
        [rootA]);
    });

    it("two independent external scope violations", () => {
      const rootA = insertElement();
      const rootB = insertElement();
      const extX = insertElement({ codeScope: rootA, codeValue: "extX" });
      const extY = insertElement({ codeScope: rootB, codeValue: "extY" });
      const rootC = insertElement();
      executeTestCase("two independent violations",
        [rootA, rootB, rootC],
        [rootC],
        [rootA, rootB, extX, extY],
        [rootA, rootB]);
    });
  });

  describe("mixed element hierarchy and code scope violations", () => {
    it("root scopes another root - delete both roots, all descendants removed", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const childA2 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      executeTestCase("root scopes root - delete both roots",
        [rootA, rootB],
        [rootA, childA1, childA2, rootB, childB1],
        []);
    });

    it("depth-1 child scopes an unrelated root", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      executeTestCase("depth-1 child scopes root - delete both via parents",
        [rootA, rootB],
        [rootA, childA1, rootB, childB1],
        []);
      // Reverse input order - result must be identical
      executeTestCase("depth-1 child scopes root - reverse input order",
        [rootB, rootA],
        [rootA, childA1, rootB, childB1],
        []);
    });

    it("depth-1 child scopes an unrelated root - delete child and root directly (parent survives)", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      // Only childA1 and rootB - rootA is NOT in the delete set.
      executeTestCase("depth-1 child scopes root - delete child + scoped root directly",
        [childA1, rootB],
        [childA1, rootB, childB1],
        [rootA]);
    });

    it("depth-1 child scopes an unrelated root - deleting only the child cascades into the scoped root's subtree", () => {
      // childA1 is the code scope of rootB. When childA1 is deleted, rootB loses its scope
      // element -> rootB (and its children) must also be deleted.
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      executeTestCase("delete child only - scoped root also removed",
        [childA1],
        [],
        [rootA, childA1, rootB, childB1],
        [childA1]);
    });

    it("root scopes a depth-1 child in sibling tree - delete both roots, all descendants removed", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB, codeScope: rootA, codeValue: "childB1-code" });
      executeTestCase("root scopes depth-1 child - delete both roots",
        [rootA, rootB],
        [rootA, childA1, rootB, childB1],
        []);
    });

    it("depth-1 child scopes a depth-1 child in sibling tree - delete both children directly (parents survive)", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB, codeScope: childA1, codeValue: "childB1-code" });
      const childB2 = insertElement({ parentId: rootB });
      executeTestCase("sibling-child scope - delete both children directly",
        [childA1, childB1],
        [childA1, childB1],
        [rootA, rootB, childB2]);
    });

    it("depth-2 grandchild scopes an unrelated root - delete grandparent + scoped root", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement({ codeScope: grandchildA, codeValue: "rootB-code" });
      const childB = insertElement({ parentId: rootB });
      executeTestCase("depth-2 grandchild scopes root - delete both roots",
        [rootA, rootB],
        [rootA, childA, grandchildA, rootB, childB],
        []);

      // Delete grandchild and scoped root directly (rootA and childA survive)
      executeTestCase("depth-2 grandchild scopes root - delete grandchild + root directly",
        [grandchildA, rootB],
        [grandchildA, rootB, childB],
        [rootA, childA]);
    });

    it("external element scopes a depth-2 grandchild, mixed with an unrelated deletion", () => {
      // Unique case: grandchild has an external scope violation, but an unrelated element from
      // another tree (childB) is also requested and has no violation - it should be deleted.
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement();
      const childB = insertElement({ parentId: rootB });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      executeTestCase("external scopes depth-2 grandchild, unrelated childB deleted",
        [grandchildA, rootA, childB],
        [childB],
        [rootA, childA, grandchildA, rootB, external],
        [rootA, grandchildA]);
    });

    it("two trees: one has external scope violation, other is deleted cleanly", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const gcA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB });
      const childB2 = insertElement({ parentId: rootB });
      const gcB = insertElement({ parentId: childB1 });
      executeTestCase("one tree ignored, other fully deleted",
        [rootA, rootB],
        [rootB, childB1, childB2, gcB],
        [rootA, childA, gcA, external],
        [rootA]);
    });
  });

  describe("sub-model hierarchy", () => {
    let partitionCounter = 0;

    const insertSubModel = (): Id64String => {
      const name = `SubModelPartition-${++partitionCounter}`;
      return PhysicalModel.insert(txn, IModel.rootSubjectId, name);
    };

    const insertElementInModel = (subModelId: Id64String, opts: { parentId?: Id64String } = {}): Id64String => {
      const props: PhysicalElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: subModelId,
        category: categoryId,
        code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
        ...(opts.parentId ? { parent: { id: opts.parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
      };
      const id = txn.insertElement(props);
      assert.isNotEmpty(id, "insertElementInModel must return a valid ID");
      txn.saveChanges();
      return id;
    };

    /** Assert that the sub-model has been deleted. */
    const assertModelDeleted = (id: Id64String, msg: string) =>
      assert.isUndefined(iModelDb.models.tryGetModelProps(id), msg);

    /** Assert that the sub-model still exists. */
    const assertModelExists = (id: Id64String, msg: string) =>
      assert.isDefined(iModelDb.models.tryGetModelProps(id), msg);

    it("delete a modeled element cascades into its sub-model", () => {
      const partitionId = insertSubModel();
      const elem1 = insertElementInModel(partitionId);
      const elem2 = insertElementInModel(partitionId);
      const unrelated = insertElement();

      const result = txn.deleteElements([partitionId]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assert.isEmpty(result.failedIds);
      assertDeleted(partitionId, "partition element should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(elem1, "elem1 inside sub-model should be deleted");
      assertDeleted(elem2, "elem2 inside sub-model should be deleted");
      assertExists(unrelated, "unrelated element should be retained");
    });

    /**
     * Scenario: Subject -> partition (parent-child) -> modeled-element.
     *
     *   subjectA
     *     └─ [P:childPartition]
     *          [M:childPartition] -> elem1
     *   unrelated
     */
    it("delete a parent whose child is a modeled element cascades into the sub-model", () => {
      const subjectA = Subject.insert(txn, IModel.rootSubjectId, `SubjectA-${++partitionCounter}`);
      const childPartitionId = PhysicalModel.insert(txn, subjectA, `ChildPartition-${partitionCounter}`);
      const elem1 = insertElementInModel(childPartitionId);
      const unrelated = insertElement();

      // Deleting subjectA cascades (parent-child) to childPartitionId, which then cascades (modeled-element) into elem1.
      const result = txn.deleteElements([subjectA]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertDeleted(subjectA, "subject should be deleted");
      assertDeleted(childPartitionId, "child partition element should be deleted");
      assertModelDeleted(childPartitionId, "child partition sub-model should be deleted");
      assertDeleted(elem1, "elem1 inside child partition sub-model should be deleted");
      assertExists(unrelated, "unrelated element should be retained");
    });

    /**
     * Scenario: sub-model elements have their own children; all should be removed transitively.
     *
     *   [P:partition]
     *   [M:partition] -> elem1
     *                     └─ childOfElem1
     *                           └─ grandchildOfElem1
     *                   elem2
     *   unrelated element
     */
    it("delete a modeled element whose sub-model elements have children", () => {
      const partitionId = insertSubModel();
      const elem1 = insertElementInModel(partitionId);
      const childOfElem1 = insertElementInModel(partitionId, { parentId: elem1 });
      const grandchildOfElem1 = insertElementInModel(partitionId, { parentId: childOfElem1 });
      const elem2 = insertElementInModel(partitionId);
      const unrelated = insertElement();

      const result = txn.deleteElements([partitionId]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(elem1, "elem1 should be deleted");
      assertDeleted(childOfElem1, "child of elem1 should be deleted");
      assertDeleted(grandchildOfElem1, "grandchild of elem1 should be deleted");
      assertDeleted(elem2, "elem2 should be deleted");
      assertExists(unrelated, "unrelated should be retained");
    });

    /**
     * Scenario: element inside a sub-model is a code scope for an element outside the delete set. The whole partition subtree must be ignored from the delete set.
     *
     *   [P:partition]
     *   [M:partition] -> scopingElem  <- code scope for `external`
     *                   otherElem
     *   external (not in delete set)
     *   unrelated
     */
    it("partition ignored when a sub-model element is a code scope for an external element", () => {
      const partitionId = insertSubModel();
      const scopingElem = insertElementInModel(partitionId);
      const otherElem = insertElementInModel(partitionId);
      const external = insertElement({ codeScope: scopingElem, codeValue: "ext-code" });
      const unrelated = insertElement();

      // `external` is NOT in the delete set and uses scopingElem as its code scope -> the
      // entire partition subtree (including the sub-model) must be ignored from the delete set.
      const result = txn.deleteElements([partitionId, unrelated]);
      assert.equal(result.status, BulkDeleteElementsStatus.PartialSuccess);
      assertExists(partitionId, "partition should be ignored (retained)");
      assertModelExists(partitionId, "sub-model should be retained");
      assertExists(scopingElem, "scopingElem should be retained");
      assertExists(otherElem, "otherElem should be retained");
      assertExists(external, "external should be retained");
      assertDeleted(unrelated, "unrelated should still be deleted");
    });

    /**
     * Scenario: the sub-model element of one partition is used as a code scope for an element
     * inside a *different* partition's sub-model that is also in the delete set.
     * Both partitions and all contents should be deleted.
     *
     *   [P:p1]  [M:p1] -> scopingElem
     *   [P:p2]  [M:p2] -> dependentElem  (codeScope = scopingElem)
     */
    it("cross-sub-model intra-set code scope dependency: both partitions deleted cleanly", () => {
      const p1 = insertSubModel();
      const scopingElem = insertElementInModel(p1);
      const p2 = insertSubModel();
      const dependentElem = insertElementInModel(p2, {});
      // Manually assign the code scope after insertion is not possible through insertElementInModel,
      // so use a dedicated insert call.
      const dependentId = txn.insertElement({
        classFullName: "Generic:PhysicalObject",
        model: p2,
        category: categoryId,
        code: { spec: codeSpecId, scope: scopingElem, value: "dep-code" },
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);

      const result = txn.deleteElements([p1, p2]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertDeleted(p1, "p1 should be deleted");
      assertModelDeleted(p1, "sub-model of p1 should be deleted");
      assertDeleted(scopingElem, "scopingElem should be deleted");
      assertDeleted(p2, "p2 should be deleted");
      assertModelDeleted(p2, "sub-model of p2 should be deleted");
      assertDeleted(dependentElem, "dependentElem should be deleted");
      assertDeleted(dependentId, "dependentId should be deleted");
    });

    /**
     * Scenario: three-level Subject cascade: deleting a grandparent Subject removes a child
     * Subject, which removes a partition (parent-child), which cascades into the sub-model.
     *
     *   grandparentSubject
     *     └─ childSubject
     *          └─ [P:grandchildPartition]
     *               [M:grandchildPartition] -> innerElem1, innerElem2
     *   unrelated
     */
    it("deep cascade: grandparent Subject -> child Subject -> partition -> sub-model elements", () => {
      const grandparentSubjectId = Subject.insert(txn, IModel.rootSubjectId, `GrandparentSubject-${++partitionCounter}`);
      const childSubjectId = Subject.insert(txn, grandparentSubjectId, `ChildSubject-${partitionCounter}`);
      const grandchildPartitionId = PhysicalModel.insert(txn, childSubjectId, `GrandchildPartition-${partitionCounter}`);
      const innerElem1 = insertElementInModel(grandchildPartitionId);
      const innerElem2 = insertElementInModel(grandchildPartitionId);
      const unrelated = insertElement();

      const result = txn.deleteElements([grandparentSubjectId]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertDeleted(grandparentSubjectId, "grandparent subject should be deleted");
      assertDeleted(childSubjectId, "child subject should be deleted");
      assertDeleted(grandchildPartitionId, "grandchild partition should be deleted");
      assertModelDeleted(grandchildPartitionId, "grandchild sub-model should be deleted");
      assertDeleted(innerElem1, "innerElem1 should be deleted");
      assertDeleted(innerElem2, "innerElem2 should be deleted");
      assertExists(unrelated, "unrelated should be retained");
    });

    /**
     * Scenario: empty sub-model: partition with no elements in its sub-model.
     *
     *   [P:partition]  [M:partition]  (empty)
     *   unrelated
     */
    it("delete a modeled element whose sub-model is empty", () => {
      const partitionId = insertSubModel();
      const unrelated = insertElement();

      const result = txn.deleteElements([partitionId]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "empty sub-model should be deleted");
      assertExists(unrelated, "unrelated should be retained");
    });

    /**
     * Scenario: a regular element has two children, one of which is a partition with a
     * sub-model, while the other is an ordinary element.  Deleting the regular parent
     * removes both children and all sub-model contents.
     *
     *   regularParent  (lives in modelId)
     *     ├─ ordinaryChild
     *     └─ [P:partitionChild]
     *          [M:partitionChild] -> subElem1, subElem2
     *   unrelated
     */
    it("deleting a regular element with a mix of ordinary and partition children cascades correctly", () => {
      const subjectA = Subject.insert(txn, IModel.rootSubjectId, `MixedChildSubject-${++partitionCounter}`);
      const partitionChild = PhysicalModel.insert(txn, subjectA, `MixedChildPartition-${partitionCounter}`);
      const subElem1 = insertElementInModel(partitionChild);
      const subElem2 = insertElementInModel(partitionChild);
      const unrelated = insertElement();

      const result = txn.deleteElements([subjectA]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertDeleted(subjectA, "subjectA should be deleted");
      assertDeleted(partitionChild, "partition child should be deleted");
      assertModelDeleted(partitionChild, "sub-model of partition child should be deleted");
      assertDeleted(subElem1, "subElem1 should be deleted");
      assertDeleted(subElem2, "subElem2 should be deleted");
      assertExists(unrelated, "unrelated should be retained");
    });

    /**
     * Scenario: a regular element's grandchild is a partition.  Passing the partition's
     * direct parent (not the grandparent root) for deletion cascades into the sub-model while
     * the grandparent survives.
     *
     *   grandparent  (lives in modelId)
     *     └─ parent           <- passed for deletion
     *          └─ [P:partition]
     *               [M:partition] -> subElem1, subElem2
     */
    it("deleting a mid-tree regular element whose child is a partition cascades into the sub-model; grandparent survives", () => {
      const subjectGP = Subject.insert(txn, IModel.rootSubjectId, `MidTreeGP-${++partitionCounter}`);
      const subjectP = Subject.insert(txn, subjectGP, `MidTreeP-${partitionCounter}`);
      const partitionId = PhysicalModel.insert(txn, subjectP, `MidTreePartition-${partitionCounter}`);
      const subElem1 = insertElementInModel(partitionId);
      const subElem2 = insertElementInModel(partitionId);

      // Only pass subjectP - grandparent must survive, everything below subjectP must go.
      const result = txn.deleteElements([subjectP]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertExists(subjectGP, "grandparent should survive");
      assertDeleted(subjectP, "parent should be deleted");
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(subElem1, "subElem1 should be deleted");
      assertDeleted(subElem2, "subElem2 should be deleted");
    });

    it("deleting a partition element directly (not via its regular parent) cascades into the sub-model; parent survives", () => {
      const subjectA = Subject.insert(txn, IModel.rootSubjectId, `DirectPartSubject-${++partitionCounter}`);
      const partitionId = PhysicalModel.insert(txn, subjectA, `DirectPartPartition-${partitionCounter}`);
      const subElem1 = insertElementInModel(partitionId);
      const subElem2 = insertElementInModel(partitionId);

      const result = txn.deleteElements([partitionId]);
      assert.equal(result.status, BulkDeleteElementsStatus.Success);
      assertExists(subjectA, "subject (regular parent) should survive");
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(subElem1, "subElem1 should be deleted");
      assertDeleted(subElem2, "subElem2 should be deleted");
    });
  });
});