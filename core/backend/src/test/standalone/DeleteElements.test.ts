import { assert } from "chai";
import { Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { ChannelControl, IModelJsFs, PhysicalModel, SnapshotDb, SpatialCategory } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Bulk Element Deletion", () => {
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
      executeTestCase("scope chain middle-only", [rootB], [rootB], [rootA, rootC]);
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

  describe("external code scope violation - pruning", () => {
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

  describe("mixed parent-child hierarchy and code scope", () => {
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
});