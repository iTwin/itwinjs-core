import { assert } from "chai";
import { Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { ChannelControl, IModelJsFs, PhysicalModel, SnapshotDb, SpatialCategory, Subject } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe.only("deleteElements (native bulk delete API)", () => {
  let seedDb: SnapshotDb;
  let iModelDb: SnapshotDb;
  let modelId: Id64String;
  let categoryId: Id64String;
  let codeSpecId: Id64String;

  before(() => {
    IModelJsFs.recursiveMkDirSync(KnownTestLocations.outputDir);
    const seedFile = IModelTestUtils.prepareOutputFile("DeleteElements", "seed.bim");
    seedDb = SnapshotDb.createEmpty(seedFile, { rootSubject: { name: "DeleteElements" } });
    modelId = PhysicalModel.insert(seedDb, IModel.rootSubjectId, "TestModel");
    categoryId = SpatialCategory.insert(seedDb, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
    codeSpecId = seedDb.codeSpecs.insert("TestScopeSpec", CodeScopeSpec.Type.RelatedElement);
    assert.isNotEmpty(modelId, "Expected a valid PhysicalModel id");
    assert.isNotEmpty(categoryId, "Expected a valid SpatialCategory id");
    assert.isNotEmpty(codeSpecId, "Expected a valid CodeSpec id");
    seedDb.saveChanges();
  });

  beforeEach(() => {
    iModelDb = SnapshotDb.createFrom(seedDb, IModelTestUtils.prepareOutputFile("DeleteElements", "DeleteElements.bim"));
    assert.isTrue(iModelDb.isOpen);
    iModelDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  afterEach(() => {
    if (iModelDb.isOpen)
      iModelDb.close();
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
    const id = iModelDb.elements.insertElement(props);
    assert.isNotEmpty(id, "insertElement must return a valid ID");
    return id;
  };

  /** Assert that the element with the given id exists or has been deleted. */
  const assertExists = (id: Id64String, msg: string) => assert.isDefined(iModelDb.elements.tryGetElement(id), msg);
  const assertDeleted = (id: Id64String, msg: string) => assert.isUndefined(iModelDb.elements.tryGetElement(id), msg);

  // Run deleteElements, then verify each id in `deleted` is gone and each id in `retained` is still present.
  const executeTestCase = (label: string, idsToDelete: Id64Array, deleted: Id64Array, retained: Id64Array) => {
    iModelDb.elements.deleteElements(idsToDelete);

    for (const id of deleted)
      assertDeleted(id, `[${label}] ${id} should have been deleted`);

    for (const id of retained)
      assertExists(id, `[${label}] ${id} should have been retained`);

    iModelDb.abandonChanges();
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
  describe("parent-child hierarchy", () => {
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();

      // rootA appears twice - should not throw and should be deleted exactly once.
      iModelDb.elements.deleteElements([rootA, rootA, rootB]);
      assertDeleted(rootA, "rootA should be deleted");
      assertDeleted(rootB, "rootB should be deleted");

      iModelDb.abandonChanges();
    });

    it("invalid IDs in the input are ignored", () => {
      const rootA = insertElement();
      iModelDb.saveChanges();

      // Id64.invalid and a well-formed but non-existent ID should not cause a throw.
      const nonExistent = "0x7fffffff";
      iModelDb.elements.deleteElements([Id64.invalid, nonExistent, rootA]);
      assertDeleted(rootA, "rootA should be deleted despite invalid peers");

      iModelDb.abandonChanges();
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
    it("child element is the code scope for an unrelated root", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA, codeValue: "rootB-code" });
      iModelDb.saveChanges();
      executeTestCase("depth-1 child scopes unrelated root - delete child+root directly",
        [childA, rootB],
        [childA, rootB],
        [rootA]);
      executeTestCase("depth-1 child scopes unrelated root - delete child only",
        [childA],
        [],
        [rootA, childA, rootB]);
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
      executeTestCase("scope chain single A", [rootA], [], [rootA, rootB, rootC]);
      executeTestCase("scope chain single B", [rootB], [], [rootA, rootB, rootC]);
      executeTestCase("scope chain single C", [rootC], [rootC], [rootA, rootB]);

      executeTestCase("scope chain forward", [rootA, rootB, rootC], [rootA, rootB, rootC], []);
      executeTestCase("scope chain reversed", [rootC, rootB, rootA], [rootA, rootB, rootC], []);
      executeTestCase("scope chain middle-first", [rootB, rootA, rootC], [rootA, rootB, rootC], []);
    });

    it("two elements using the same scope", () => {
      // A is the code scope for both B and C independently.
      //     A
      //    / \
      //   B   C  (code scope, not parent-child)
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootA, codeValue: "rootC-code" });
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
      executeTestCase("parent is code scope of child - delete parent",
        [rootP],
        [rootP, childC],
        []);
    });

    it("siblings where one is the code scope of the other", () => {
      // parent
      //  ├─ childA  (code scope for childB)
      //  └─ childB  (scoped by childA)
      const parent = insertElement();
      const childA = insertElement({ parentId: parent });
      const childB = insertElement({ parentId: parent, codeScope: childA, codeValue: "childB-code" });
      iModelDb.saveChanges();

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
      // Delete only the scope element - childB is external -> childA pruned.
      executeTestCase("sibling scope - delete only scope element, pruned due to external childB",
        [childA],
        [],
        [parent, childA, childB]);
    });

  });

  describe("external code scope violations", () => {
    it("root is code scope for an external element", () => {
      const rootA = insertElement();
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      const rootB = insertElement();
      iModelDb.saveChanges();
      executeTestCase("external scopes root",
        [rootA, rootB],
        [rootB],
        [rootA, external]);
    });

    it("depth-1 child is code scope for external", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      iModelDb.saveChanges();
      executeTestCase("external scopes depth-1 child - parent subtree pruned",
        [rootA, rootB],
        [rootB],
        [rootA, childA, external]);
    });

    it("depth-2 grandchild is code scope for external", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      const rootB = insertElement();
      iModelDb.saveChanges();
      executeTestCase("external scopes depth-2 grandchild - grandparent subtree pruned",
        [rootA, rootB],
        [rootB],
        [rootA, childA, grandchildA, external]);
    });

    it("only the child is passed for deletion", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      iModelDb.saveChanges();
      executeTestCase("external scopes requested child",
        [childA],
        [],
        [rootA, childA, external]);
    });

    it("root has both an external scope dependent AND an intra-set scope dependent", () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      iModelDb.saveChanges();
      executeTestCase("root pruned due to external; sibling still deleted",
        [rootA, rootB],
        [rootB],
        [rootA, external]);
    });

    it("two independent external scope violations", () => {
      const rootA = insertElement();
      const rootB = insertElement();
      const extX = insertElement({ codeScope: rootA, codeValue: "extX" });
      const extY = insertElement({ codeScope: rootB, codeValue: "extY" });
      const rootC = insertElement();
      iModelDb.saveChanges();
      executeTestCase("two independent violations",
        [rootA, rootB, rootC],
        [rootC],
        [rootA, rootB, extX, extY]);
    });
  });

  describe("mixed parent-child hierarchy and code scope violations", () => {
    it("root scopes another root - delete both roots, all descendants removed", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const childA2 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
      executeTestCase("delete child only - scoped root also removed",
        [childA1],
        [],
        [rootA, childA1, rootB, childB1]);
    });

    it("root scopes a depth-1 child in sibling tree - delete both roots, all descendants removed", () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB, codeScope: rootA, codeValue: "childB1-code" });
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
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
      iModelDb.saveChanges();
      executeTestCase("external scopes depth-2 grandchild, unrelated childB deleted",
        [grandchildA, rootA, childB],
        [childB],
        [rootA, childA, grandchildA, rootB, external]);
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
      iModelDb.saveChanges();
      executeTestCase("one tree pruned, other fully deleted",
        [rootA, rootB],
        [rootB, childB1, childB2, gcB],
        [rootA, childA, gcA, external]);
    });
  });

  describe("deep scope chain propagation", () => {
    it("scope chain A -> B -> C -> D where only A and D are in the delete set", () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      const rootD = insertElement({ codeScope: rootC, codeValue: "rootD-code" });
      iModelDb.saveChanges();

      // Only A and D in the delete set. B is external -> A pruned. D's scope (C) is not being deleted -> D is safe.
      executeTestCase("deep gap chain: A pruned, D deleted",
        [rootA, rootD],
        [rootD],
        [rootA, rootB, rootC]);
    });
  });

  describe("sub-model hierarchy", () => {
    let partitionCounter = 0;

    const insertSubModel = (): Id64String => {
      const name = `SubModelPartition-${++partitionCounter}`;
      return PhysicalModel.insert(iModelDb, IModel.rootSubjectId, name);
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
      const id = iModelDb.elements.insertElement(props);
      assert.isNotEmpty(id, "insertElementInModel must return a valid ID");
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
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([partitionId]);
      assertDeleted(partitionId, "partition element should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(elem1, "elem1 inside sub-model should be deleted");
      assertDeleted(elem2, "elem2 inside sub-model should be deleted");
      assertExists(unrelated, "unrelated element should be retained");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: Subject -> partition (parent-child) -> modeled-element.
     *
     *   subjectA
     *     └─ [P:childPartition]
     *          [M:childPartition] -> elem1
     *   unrelated
     */
    it("delete a parent Subject whose child is a modeled element cascades into the sub-model", () => {
      const subjectA = Subject.insert(iModelDb, IModel.rootSubjectId, `SubjectA-${++partitionCounter}`);
      const childPartitionId = PhysicalModel.insert(iModelDb, subjectA, `ChildPartition-${partitionCounter}`);
      const elem1 = insertElementInModel(childPartitionId);
      const unrelated = insertElement();
      iModelDb.saveChanges();

      // Deleting subjectA cascades (parent-child) to childPartitionId, which then cascades (modeled-element) into elem1.
      iModelDb.elements.deleteElements([subjectA]);
      assertDeleted(subjectA, "subject should be deleted");
      assertDeleted(childPartitionId, "child partition element should be deleted");
      assertModelDeleted(childPartitionId, "child partition sub-model should be deleted");
      assertDeleted(elem1, "elem1 inside child partition sub-model should be deleted");
      assertExists(unrelated, "unrelated element should be retained");
      iModelDb.abandonChanges();
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
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([partitionId]);
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(elem1, "elem1 should be deleted");
      assertDeleted(childOfElem1, "child of elem1 should be deleted");
      assertDeleted(grandchildOfElem1, "grandchild of elem1 should be deleted");
      assertDeleted(elem2, "elem2 should be deleted");
      assertExists(unrelated, "unrelated should be retained");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: partition in delete set removes whole sub-model with model elements explicitly listed
     *
     *   [P:partition]
     *   [M:partition] -> elem1, elem2, elem3
     */
    it("partition in delete set removes whole sub-model even if only some elements are listed", () => {
      const partitionId = insertSubModel();
      const elem1 = insertElementInModel(partitionId);
      const elem2 = insertElementInModel(partitionId);
      const elem3 = insertElementInModel(partitionId);
      iModelDb.saveChanges();

      // elem1 is listed explicitly alongside the partition; elem2 and elem3 are not.
      iModelDb.elements.deleteElements([partitionId, elem1]);
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(elem1, "elem1 should be deleted");
      assertDeleted(elem2, "elem2 should be deleted even though not explicitly listed");
      assertDeleted(elem3, "elem3 should be deleted even though not explicitly listed");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: two independent partitions; deleting one leaves the other intact.
     *
     *   [P:p1]  [M:p1] -> e1, e2
     *   [P:p2]  [M:p2] -> e3, e4
     */
    it("deleting one of two independent partitions leaves the other intact", () => {
      const p1 = insertSubModel();
      const e1 = insertElementInModel(p1);
      const e2 = insertElementInModel(p1);

      const p2 = insertSubModel();
      const e3 = insertElementInModel(p2);
      const e4 = insertElementInModel(p2);
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([p1]);
      assertDeleted(p1, "partition p1 should be deleted");
      assertModelDeleted(p1, "sub-model of p1 should be deleted");
      assertDeleted(e1, "e1 should be deleted");
      assertDeleted(e2, "e2 should be deleted");
      assertExists(p2, "partition p2 should be retained");
      assertModelExists(p2, "sub-model of p2 should be retained");
      assertExists(e3, "e3 should be retained");
      assertExists(e4, "e4 should be retained");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: both partitions in delete set; both sub-models fully removed.
     *
     *   [P:p1]  [M:p1] -> e1, e2
     *   [P:p2]  [M:p2] -> e3, e4
     */
    it("deleting both independent partitions removes both sub-models", () => {
      const p1 = insertSubModel();
      const e1 = insertElementInModel(p1);
      const e2 = insertElementInModel(p1);

      const p2 = insertSubModel();
      const e3 = insertElementInModel(p2);
      const e4 = insertElementInModel(p2);
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([p1, p2]);
      assertDeleted(p1, "p1 should be deleted");
      assertModelDeleted(p1, "sub-model of p1 should be deleted");
      assertDeleted(e1, "e1 should be deleted");
      assertDeleted(e2, "e2 should be deleted");
      assertDeleted(p2, "p2 should be deleted");
      assertModelDeleted(p2, "sub-model of p2 should be deleted");
      assertDeleted(e3, "e3 should be deleted");
      assertDeleted(e4, "e4 should be deleted");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: element inside a sub-model is a code scope for an element outside the delete set. The whole partition subtree must be pruned from the delete set.
     *
     *   [P:partition]
     *   [M:partition] -> scopingElem  <- code scope for `external`
     *                   otherElem
     *   external (not in delete set)
     *   unrelated
     */
    it("partition pruned when a sub-model element is a code scope for an external element", () => {
      const partitionId = insertSubModel();
      const scopingElem = insertElementInModel(partitionId);
      const otherElem = insertElementInModel(partitionId);
      const external = insertElement({ codeScope: scopingElem, codeValue: "ext-code" });
      const unrelated = insertElement();
      iModelDb.saveChanges();

      // `external` is NOT in the delete set and uses scopingElem as its code scope -> the
      // entire partition subtree (including the sub-model) must be pruned from the delete set.
      iModelDb.elements.deleteElements([partitionId, unrelated]);
      assertExists(partitionId, "partition should be pruned (retained)");
      assertModelExists(partitionId, "sub-model should be retained");
      assertExists(scopingElem, "scopingElem should be retained");
      assertExists(otherElem, "otherElem should be retained");
      assertExists(external, "external should be retained");
      assertDeleted(unrelated, "unrelated should still be deleted");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: child of a sub-model element is a code scope for an external element.
     * The whole partition subtree is pruned.
     *
     *   [P:partition]
     *   [M:partition] -> elem1
     *                     └─ childElem  <- code scope for `external`
     *   external (not in delete set)
     */
    it("partition pruned when a child of a sub-model element is an external code scope", () => {
      const partitionId = insertSubModel();
      const elem1 = insertElementInModel(partitionId);
      const childElem = insertElementInModel(partitionId, { parentId: elem1 });
      const external = insertElement({ codeScope: childElem, codeValue: "ext-code" });
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([partitionId]);
      assertExists(partitionId, "partition should be pruned (retained)");
      assertModelExists(partitionId, "sub-model should be retained");
      assertExists(elem1, "elem1 should be retained");
      assertExists(childElem, "childElem should be retained");
      assertExists(external, "external should be retained");
      iModelDb.abandonChanges();

      iModelDb.elements.deleteElements([elem1, external]);
      assertExists(partitionId, "partition should be pruned (retained)");
      assertModelExists(partitionId, "sub-model should be retained");
      assertDeleted(elem1, "elem1 should be deleted");
      assertDeleted(childElem, "childElem should be deleted");
      assertDeleted(external, "external should be deleted");
      iModelDb.abandonChanges();
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
      const dependentId = iModelDb.elements.insertElement({
        classFullName: "Generic:PhysicalObject",
        model: p2,
        category: categoryId,
        code: { spec: codeSpecId, scope: scopingElem, value: "dep-code" },
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([p1, p2]);
      assertDeleted(p1, "p1 should be deleted");
      assertModelDeleted(p1, "sub-model of p1 should be deleted");
      assertDeleted(scopingElem, "scopingElem should be deleted");
      assertDeleted(p2, "p2 should be deleted");
      assertModelDeleted(p2, "sub-model of p2 should be deleted");
      assertDeleted(dependentElem, "dependentElem should be deleted");
      assertDeleted(dependentId, "dependentId should be deleted");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: one of two partitions has an external code-scope violation; only that partition
     * is pruned.  The other partition (no violation) is deleted cleanly.
     *
     *   [P:p1]  [M:p1] -> blockedElem  <-  code scope for `external`
     *   [P:p2]  [M:p2] -> cleanElem
     *   external (not in delete set)
     */
    it("one of two partitions pruned due to external violation; the other deleted cleanly", () => {
      const p1 = insertSubModel();
      const blockedElem = insertElementInModel(p1);
      const p2 = insertSubModel();
      const cleanElem = insertElementInModel(p2);
      const external = insertElement({ codeScope: blockedElem, codeValue: "ext-code" });
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([p1, p2]);
      assertExists(p1, "p1 should be pruned (retained)");
      assertModelExists(p1, "sub-model of p1 should be retained");
      assertExists(blockedElem, "blockedElem should be retained");
      assertExists(external, "external should be retained");
      assertDeleted(p2, "p2 should be deleted");
      assertModelDeleted(p2, "sub-model of p2 should be deleted");
      assertDeleted(cleanElem, "cleanElem should be deleted");
      iModelDb.abandonChanges();
    });

    /**
     * Scenario: cascading mixture: delete a regular parent element whose child is itself
     * a modeled element (partition) that contains further sub-model elements.
     *
     *   regularParent (in modelId)
     *     └─ [P:childPartition]  <- child of regularParent AND modeled element
     *          [M:childPartition] -> subElem1, subElem2
     *   unrelated Element
     */
    it("cascading delete: Subject -> child partition -> sub-model elements", () => {
      const subjectId = Subject.insert(iModelDb, IModel.rootSubjectId, `CascadeSubject-${++partitionCounter}`);
      const childPartitionId = PhysicalModel.insert(iModelDb, subjectId, `CascadePartition-${partitionCounter}`);
      const subElem1 = insertElementInModel(childPartitionId);
      const subElem2 = insertElementInModel(childPartitionId);
      const unrelated = insertElement();
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([subjectId]);
      assertDeleted(subjectId, "subject should be deleted");
      assertDeleted(childPartitionId, "child partition should be deleted");
      assertModelDeleted(childPartitionId, "child partition sub-model should be deleted");
      assertDeleted(subElem1, "subElem1 should be deleted");
      assertDeleted(subElem2, "subElem2 should be deleted");
      assertExists(unrelated, "unrelated should be retained");
      iModelDb.abandonChanges();
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
      const grandparentSubjectId = Subject.insert(iModelDb, IModel.rootSubjectId, `GrandparentSubject-${++partitionCounter}`);
      const childSubjectId = Subject.insert(iModelDb, grandparentSubjectId, `ChildSubject-${partitionCounter}`);
      const grandchildPartitionId = PhysicalModel.insert(iModelDb, childSubjectId, `GrandchildPartition-${partitionCounter}`);
      const innerElem1 = insertElementInModel(grandchildPartitionId);
      const innerElem2 = insertElementInModel(grandchildPartitionId);
      const unrelated = insertElement();
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([grandparentSubjectId]);
      assertDeleted(grandparentSubjectId, "grandparent subject should be deleted");
      assertDeleted(childSubjectId, "child subject should be deleted");
      assertDeleted(grandchildPartitionId, "grandchild partition should be deleted");
      assertModelDeleted(grandchildPartitionId, "grandchild sub-model should be deleted");
      assertDeleted(innerElem1, "innerElem1 should be deleted");
      assertDeleted(innerElem2, "innerElem2 should be deleted");
      assertExists(unrelated, "unrelated should be retained");
      iModelDb.abandonChanges();
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
      iModelDb.saveChanges();

      iModelDb.elements.deleteElements([partitionId]);
      assertDeleted(partitionId, "partition should be deleted");
      assertModelDeleted(partitionId, "empty sub-model should be deleted");
      assertExists(unrelated, "unrelated should be retained");
      iModelDb.abandonChanges();
    });
  });
});