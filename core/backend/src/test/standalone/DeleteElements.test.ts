/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { DbResult, Guid, Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { BriefcaseDb, BulkDeleteElementsResult, BulkDeleteElementsStatus, ChannelControl, EditTxn, IModelJsFs, PhysicalModel, SpatialCategory, Subject } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { HubWrappers } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

chai.use(chaiAsPromised);
const assert = chai.assert;
const expect = chai.expect;

/**
 * Tests for the native bulk delete API, exercised against a [[BriefcaseDb]].
 *
 * Each scenario runs through [[executeTestCase]], which asserts three things against the same starting state:
 *  1. `EditTxn.deleteElements` throws when the caller does not hold the required exclusive locks, and changes nothing.
 *  2. `EditTxn.deleteElementsWithLocks` acquires those locks and produces the expected result.
 *  3. The deprecated `IModelDb.Elements.deleteElements` produces the identical result once the locks are held.
 */
describe("deleteElements (native bulk delete API)", () => {
  const accessToken = "user1";
  let briefcase: BriefcaseDb;
  let iModelId: string;
  let modelId: Id64String;
  let categoryId: Id64String;
  let codeSpecId: Id64String;
  let txn: EditTxn;

  before(async () => {
    IModelJsFs.recursiveMkDirSync(KnownTestLocations.outputDir);
    HubMock.startup("DeleteElements", KnownTestLocations.outputDir);

    iModelId = await HubMock.createNewIModel({
      accessToken,
      iTwinId: HubMock.iTwinId,
      iModelName: `DeleteElements-${Guid.createValue()}`,
      description: "DeleteElements",
    });

    briefcase = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId: HubMock.iTwinId, iModelId });
    briefcase.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await briefcase.locks.acquireLocks({ shared: [IModel.rootSubjectId, IModel.dictionaryId] });
    startTxn("create model/category");
    modelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "TestModel");
    categoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
    codeSpecId = briefcase.codeSpecs.insert(txn, "TestScopeSpec", CodeScopeSpec.Type.RelatedElement);
    endTxn("save");

    assert.isNotEmpty(modelId, "Expected a valid PhysicalModel id");
    assert.isNotEmpty(categoryId, "Expected a valid SpatialCategory id");
    assert.isNotEmpty(codeSpecId, "Expected a valid CodeSpec id");

    await briefcase.pushChanges({ accessToken, description: "seed" });
  });

  beforeEach(async () => {
    // Shared locks are required to insert each test's fixture elements.
    await briefcase.locks.acquireLocks({ shared: [IModel.rootSubjectId, IModel.dictionaryId, modelId] });
    startTxn("test");
  });

  afterEach(async () => {
    endTxn("abandon");
    await releaseLocks();
  });

  after(async () => {
    if (briefcase?.isOpen) {
      endTxn("abandon");
      await briefcase.locks.releaseAllLocks().catch(() => { });
      briefcase.close();
    }
    HubMock.shutdown();
  });

  /** Start the shared [[EditTxn]] through which every write in this suite is routed. */
  const startTxn = (description: string) => {
    txn = new EditTxn(briefcase, description);
    txn.start();
  };

  /** End the shared [[EditTxn]], if it is active. */
  const endTxn = (mode: "save" | "abandon") => {
    if (txn?.isActive)
      txn.end(mode);
  };

  /** Discard pending changes while keeping the shared [[EditTxn]] active. */
  const abandonChanges = () => txn.abandonChanges();

  /**
   * Return the briefcase to a "holds no locks" state. Locks cannot be released while local changes exist, so the
   * shared transaction is saved and its changes pushed first, which also releases the locks. The shared transaction
   * is restarted afterwards so callers can keep writing through it.
   */
  const releaseLocks = async () => {
    const wasActive = txn?.isActive === true;
    const description = txn?.description ?? "test";
    if (wasActive)
      txn.end("save");

    if (briefcase.txns.hasPendingTxns)
      await briefcase.pushChanges({ accessToken, description: "setup" });
    else
      await briefcase.locks.releaseAllLocks();

    assert.isFalse(briefcase.locks.holdsExclusiveLock(modelId), "no exclusive locks may remain");

    if (wasActive)
      startTxn(description);
  };

  /** Run `fn` on the shared [[EditTxn]] and always abandon its changes, so each scenario leaves the briefcase as it found it. */
  const withAbandonedTxn = async <T>(description: string, fn: (editTxn: EditTxn) => Promise<T>): Promise<T> => {
    txn.description = description;
    try {
      return await fn(txn);
    } finally {
      abandonChanges();
    }
  };

  const insertElement = (opts: { parentId?: Id64String; modelId?: Id64String; codeScope?: Id64String; codeValue?: string } = {}): Id64String => {
    const { parentId, codeScope, codeValue } = opts;
    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: opts.modelId ?? modelId,
      category: categoryId,
      code: codeScope && codeValue ? { spec: codeSpecId, scope: codeScope, value: codeValue } : Code.createEmpty(),
      placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
    };
    const id = txn.insertElement(props);
    assert.isNotEmpty(id, "insertElement must return a valid ID");
    return id;
  };

  /** Assert that the element with the given id exists or has been deleted. */
  const assertExists = (id: Id64String, msg: string) => assert.isDefined(briefcase.elements.tryGetElement(id), msg);
  const assertDeleted = (id: Id64String, msg: string) => assert.isUndefined(briefcase.elements.tryGetElement(id), msg);
  /** Assert that the sub-model with the given id exists or has been deleted. */
  const assertModelExists = (id: Id64String, msg: string) => assert.isDefined(briefcase.models.tryGetModelProps(id), msg);
  const assertModelDeleted = (id: Id64String, msg: string) => assert.isUndefined(briefcase.models.tryGetModelProps(id), msg);

  const assertResult = (label: string, result: BulkDeleteElementsResult, idsToDelete: Id64Array, deleted: Id64Array, retained: Id64Array, expectedFailed: Id64Array) => {
    if (expectedFailed.length === 0)
      assert.equal(result.status, BulkDeleteElementsStatus.Success, `[${label}] expected success`);
    else
      assert.equal(result.status, (expectedFailed.length === idsToDelete.length) ? BulkDeleteElementsStatus.DeletionFailed : BulkDeleteElementsStatus.PartialSuccess, `[${label}] unexpected status`);

    assert.sameMembers(Array.from(result.failedIds), expectedFailed, `[${label}] failed set mismatch`);

    for (const id of deleted)
      assertDeleted(id, `[${label}] ${id} should have been deleted`);

    for (const id of retained)
      assertExists(id, `[${label}] ${id} should have been retained`);
  };

  /**
   * Run a single scenario three times against the same starting state:
   *  1. `deleteElements` while holding no locks - must throw and change nothing.
   *  2. `deleteElementsWithLocks` - must acquire the exclusive locks and produce the expected result.
   *  3. the deprecated `IModelDb.Elements.deleteElements` - must produce the identical result now that the locks are held.
   */
  const executeTestCase = async (label: string, idsToDelete: Id64Array, deleted: Id64Array, retained: Id64Array, expectedFailed: Id64Array = [], expectThrow = true) => {
    await releaseLocks();

    // 1. Without locks the synchronous API must refuse: Element.onDelete calls checkExclusiveLock.
    for (const id of idsToDelete) {
      assert.isFalse(briefcase.locks.holdsExclusiveLock(id));
    }

    if (idsToDelete.length > 0) {
      await withAbandonedTxn("delete without locks", async (txn) => {
        try {
          txn.deleteElements(idsToDelete)
          if (expectThrow)
            assert.fail(`[${label}] deleteElements must throw without locks`);
        } catch (err: any) {
          if (expectThrow)
            assert.match(err.message, /exclusive lock/, `[${label}] deleteElements must throw without locks`);
          else
            throw err;
        }
      });

      for (const id of [...deleted, ...retained])
        assertExists(id, `[${label}] ${id} must survive a delete that failed the lock check`);
    }

    // 2. deleteElementsWithLocks acquires the exclusive locks first, so the same call now succeeds.
    await withAbandonedTxn("delete with locks", async (txn) => {
      const result = await txn.deleteElementsWithLocks(idsToDelete);
      assertResult(label, result, idsToDelete, deleted, retained, expectedFailed);

      for (const id of idsToDelete)
        assert.isTrue(briefcase.locks.holdsExclusiveLock(id), `[${label}] exclusive lock should have been acquired for ${id}`);
    });

    // 3. The deprecated API must behave identically. The locks acquired above are still held.
    executeTestCaseDeprecated(label, idsToDelete, deleted, retained, expectedFailed);
  };

  const executeTestCaseDeprecated = (label: string, idsToDelete: Id64Array, deleted: Id64Array, retained: Id64Array, expectedFailed: Id64Array) => {
    // The deprecated API always routes through the iModel's implicit transaction (never the active EditTxn),
    // so implicit-write enforcement must be relaxed here regardless of the shared txn's state.
    const previousEnforcement = EditTxn.implicitWriteEnforcement;
    EditTxn.implicitWriteEnforcement = "allow";
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const result: BulkDeleteElementsResult = briefcase.elements.deleteElements(idsToDelete);
      assertResult(`${label} (deprecated API)`, result, idsToDelete, deleted, retained, expectedFailed);
    } finally {
      abandonChanges();
      EditTxn.implicitWriteEnforcement = previousEnforcement;
    }
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

    before(async () => {
      await briefcase.locks.acquireLocks({ shared: [IModel.rootSubjectId, IModel.dictionaryId, modelId] });
      startTxn("basic tests fixture");
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
      all = [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3, parentB, childB1, childB2, standalone, childS1];

      endTxn("save");
      await releaseLocks();
    });

    it("delete a root element", async () => {
      await executeTestCase("root cascades",
        [parentA],
        [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3],
        [parentB, childB1, childB2, standalone, childS1]);
    });

    it("Second call to deleteElement fails if a read cursor on a temp table is open", async () => {
      // Create a temp table on the same SQLite connection that the native bulk-delete will use to simulate a shared temp table lock
      briefcase.withSqliteStatement("CREATE TABLE IF NOT EXISTS temp.temp_table (x INTEGER)", (s) => s.step());
      briefcase.withSqliteStatement("INSERT INTO temp.temp_table VALUES (1)", (s) => s.step());

      const lockStmt = briefcase.prepareSqliteStatement("SELECT x FROM temp.temp_table");
      assert.equal(lockStmt.step(), DbResult.BE_SQLITE_ROW);

      const el1 = insertElement();
      const el2 = insertElement();
      await releaseLocks();

      await withAbandonedTxn("delete elements", async (txn) => {
        const result1 = await txn.deleteElementsWithLocks([el1]);
        const result2 = await txn.deleteElementsWithLocks([el2]);

        for (const result of [result1, result2]) {
          assert.equal(result.failedIds.size, 0);
          assert.equal(result.status, BulkDeleteElementsStatus.Success, "deleteElements call must succeed");
          assert.equal(result.sqlDeleteStatus, DbResult.BE_SQLITE_OK);
        }

        // Would have been the case if "DROP TABLE IF EXISTS..." was used (bug)
        assert.notEqual(result2.status, BulkDeleteElementsStatus.DeletionFailed);
        assert.notEqual(result2.sqlDeleteStatus, DbResult.BE_SQLITE_LOCKED);
      });

      lockStmt[Symbol.dispose](); // release the simulated read-lock
    });

    it("explicitly delete the whole tree", async () => {
      await executeTestCase("redundant descendants in input",
        [parentA, childA1, grandchildA1, childA2],
        [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3],
        [parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting all roots removes every element", async () => {
      await executeTestCase("delete all roots",
        [parentA, parentB, standalone],
        all,
        []);
    });

    it("empty input set is a no-op", async () => {
      await executeTestCase("empty set",
        [],
        [],
        all);
    });

    it("duplicate IDs should be handled", async () => {
      await releaseLocks();

      await withAbandonedTxn("delete duplicates", async (txn) => {
        // parentB appears twice - it must be locked and deleted exactly once.
        const result = await txn.deleteElementsWithLocks([parentB, parentB, standalone]);
        assert.equal(result.status, BulkDeleteElementsStatus.Success);
        assertDeleted(parentB, "parentB should be deleted");
        assertDeleted(standalone, "standalone should be deleted");
      });
    });

    it("invalid IDs in the input throw an exception", async () => {
      await releaseLocks();

      await withAbandonedTxn("delete invalid ids", async (txn) => {
        // The synchronous API validates the ids up front, before any lock check.
        assert.throws(() => txn.deleteElements([Id64.invalid, parentA]), `Invalid element ids: 0`);
        assert.throws(() => txn.deleteElements(["not-an-id", parentA]), `Invalid element ids: not-an-id`);

        // deleteElementsWithLocks must also reject, and must not delete anything.
        await expect(txn.deleteElementsWithLocks([Id64.invalid, parentA])).to.eventually.be.rejected;
        await expect(txn.deleteElementsWithLocks(["not-an-id", parentA])).to.eventually.be.rejected;

        assertExists(parentA, "parentA should not have been deleted after a throw");
      });
    });

    it("deleting a child removes its subtree but leaves the parent", async () => {
      await executeTestCase("delete depth-1 child",
        [childA1],
        [childA1, grandchildA1],
        [parentA, childA2, grandchildA2, childA3, parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting two mid-tree siblings leaves their parent and unrelated siblings", async () => {
      await executeTestCase("delete two depth-1 siblings",
        [childA1, childA2],
        [childA1, grandchildA1, childA2, grandchildA2],
        [parentA, childA3, parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting a child from one tree and a child from another tree", async () => {
      await executeTestCase("cross-tree mid-tree delete",
        [childA1, childB2],
        [childA1, grandchildA1, childB2],
        [parentA, childA2, grandchildA2, childA3, parentB, childB1, standalone, childS1]);
    });

    it("deleting mid-tree nodes mixed with a root", async () => {
      await executeTestCase("mid-tree + roots mixed",
        [childA1, childA3, parentB, standalone],
        [childA1, grandchildA1, childA3, parentB, childB1, childB2, standalone, childS1],
        [parentA, childA2, grandchildA2]);
    });

    it("deleting only grandchildren leaves all ancestors", async () => {
      await executeTestCase("delete leaves only",
        [grandchildA1, grandchildA2],
        [grandchildA1, grandchildA2],
        [parentA, childA1, childA2, childA3, parentB, childB1, childB2, standalone, childS1]);
    });

    it("deleting leaves from different subtrees simultaneously", async () => {
      await executeTestCase("leaves from multiple subtrees",
        [grandchildA1, childB1, childS1],
        [grandchildA1, childB1, childS1],
        [parentA, childA1, childA2, grandchildA2, childA3, parentB, childB2, standalone]);
    });

    it("deleting root, mid-tree and leaf", async () => {
      await executeTestCase("root + child + grandchild + leaf",
        [childA1, grandchildA2, parentB, childS1],
        [childA1, grandchildA1, grandchildA2, parentB, childB1, childB2, childS1],
        [parentA, childA2, childA3, standalone]);
    });

    it("parent and its grandchild", async () => {
      await executeTestCase("parent + grandchild redundant",
        [parentA, grandchildA1],
        [parentA, childA1, grandchildA1, childA2, grandchildA2, childA3],
        [parentB, childB1, childB2, standalone, childS1]);
    });
  });

  describe("intra-set code scope dependency", () => {
    it("child element is the code scope for an unrelated element", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA, codeValue: "rootB-code" });
      await executeTestCase("depth-1 child scopes unrelated root - delete child+root directly",
        [childA, rootB],
        [childA, rootB],
        [rootA]);

      await executeTestCase("depth-1 child scopes unrelated root - delete child only",
        [childA],
        [],
        [rootA, childA, rootB],
        [childA],
        false);

      await executeTestCase("depth-1 child scopes unrelated root - delete root only",
        [rootB],
        [rootB],
        [rootA, childA]);
    });

    it("grandchild is the code scope for an unrelated root", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement({ codeScope: grandchildA, codeValue: "rootB-code" });
      await executeTestCase("depth-2 grandchild scopes unrelated root - delete both roots",
        [rootA, rootB],
        [rootA, childA, grandchildA, rootB],
        []);

      await executeTestCase("depth-2 grandchild scopes unrelated root - delete grandchild+root directly",
        [grandchildA, rootB],
        [grandchildA, rootB],
        [rootA, childA]);
    });

    it("root element scopes a child in another subtree", async () => {
      const rootA = insertElement();
      const rootB = insertElement();
      const childB = insertElement({ parentId: rootB, codeScope: rootA, codeValue: "childB-code" });
      await executeTestCase("root scopes depth-1 child in sibling tree",
        [rootA, rootB],
        [rootA, rootB, childB],
        []);
    });

    it("scope chains", async () => {
      // C -> B -> A
      // Test all combinations of inputs
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      await executeTestCase("scope chain single A", [rootA], [], [rootA, rootB, rootC], [rootA], false);
      await executeTestCase("scope chain single B", [rootB], [], [rootA, rootB, rootC], [rootB], false);
      await executeTestCase("scope chain single C", [rootC], [rootC], [rootA, rootB]);

      await executeTestCase("scope chain forward", [rootA, rootB, rootC], [rootA, rootB, rootC], []);
      await executeTestCase("scope chain reversed", [rootC, rootB, rootA], [rootA, rootB, rootC], []);
      await executeTestCase("scope chain middle-first", [rootB, rootA, rootC], [rootA, rootB, rootC], []);
    });

    it("scope chain A -> B -> C -> D where only A and D are in the delete set", async () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      const rootD = insertElement({ codeScope: rootC, codeValue: "rootD-code" });

      // Only A and D in the delete set. B is external -> A ignored. D's scope (C) is not being deleted -> D is safe.
      await executeTestCase("deep gap chain: A ignored, D deleted",
        [rootA, rootD],
        [rootD],
        [rootA, rootB, rootC],
        [rootA]);
    });

    it("scope chain delete with skipping constraint validation should fail", async () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      const rootD = insertElement({ codeScope: rootC, codeValue: "rootD-code" });
      await releaseLocks();

      await withAbandonedTxn("delete skipping FK validation", async (txn) => {
        const result = await txn.deleteElementsWithLocks([rootA, rootD], { skipFKConstraintValidations: true });
        assert.equal(result.status, BulkDeleteElementsStatus.DeletionFailed);
        assert.equal(result.sqlDeleteStatus, DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY);
        // The locks were still acquired, even though the delete failed.
        assert.isTrue(briefcase.locks.holdsExclusiveLock(rootA));
        assert.isTrue(briefcase.locks.holdsExclusiveLock(rootD));
        assertExists(rootB, "rootB should be retained");
        assertExists(rootC, "rootC should be retained");
      });
    });

    it("two elements using the same scope", async () => {
      // A is the code scope for both B and C independently.
      //     A
      //    / \
      //   B   C  (code scope, not parent-child)
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootA, codeValue: "rootC-code" });
      await executeTestCase("delete all three",
        [rootA, rootB, rootC],
        [rootA, rootB, rootC],
        []);

      await executeTestCase("delete only B and C",
        [rootB, rootC],
        [rootB, rootC],
        [rootA]);
    });

    it("parent is also the code scope of its own child", async () => {
      const rootP = insertElement();
      const childC = insertElement({ parentId: rootP, codeScope: rootP, codeValue: "childC-code" });
      await executeTestCase("parent is code scope of child - delete parent",
        [rootP],
        [rootP, childC],
        []);
    });

    it("sibling scopes it's own sibling", async () => {
      // parent
      //  ├─ childA  (code scope for childB)
      //  └─ childB  (scoped by childA)
      const parent = insertElement();
      const childA = insertElement({ parentId: parent });
      const childB = insertElement({ parentId: parent, codeScope: childA, codeValue: "childB-code" });

      // Delete via parent cascade - sibling scope must not block deletion.
      await executeTestCase("sibling scope - delete via parent",
        [parent],
        [parent, childA, childB],
        []);

      // Delete both siblings directly - intra-set scope, no external violation.
      await executeTestCase("sibling scope - delete both directly",
        [childA, childB],
        [childA, childB],
        [parent]);

      // Delete only the scoped child - its scope (childA) is not being deleted, safe to delete.
      await executeTestCase("sibling scope - delete only scoped child",
        [childB],
        [childB],
        [parent, childA]);

      // Delete only the scope element - childB is external -> childA ignored.
      await executeTestCase("sibling scope - delete only scope element, ignored due to external childB",
        [childA],
        [],
        [parent, childA, childB],
        [childA],
        false);
    });
  });

  describe("Code scope violations to test delete set element pruning", () => {
    it("root is code scope for an external element", async () => {
      const rootA = insertElement();
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      const rootB = insertElement();
      await executeTestCase("external scopes root",
        [rootA, rootB],
        [rootB],
        [rootA, external],
        [rootA]);
    });

    it("depth-1 child is code scope for external", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      await executeTestCase("external scopes depth-1 child - parent subtree ignored",
        [rootA, rootB],
        [rootB],
        [rootA, childA, external],
        [rootA]);
    });

    it("depth-2 grandchild is code scope for external", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      const rootB = insertElement();
      await executeTestCase("external scopes depth-2 grandchild - grandparent subtree ignored",
        [rootA, rootB],
        [rootB],
        [rootA, childA, grandchildA, external],
        [rootA]);
    });

    it("only the child is passed for deletion", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      await executeTestCase("external scopes requested child",
        [childA],
        [],
        [rootA, childA, external],
        [childA],
        false);
    });

    it("root has both an external scope dependent AND an intra-set scope dependent", async () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      await executeTestCase("root ignored due to external; sibling still deleted",
        [rootA, rootB],
        [rootB],
        [rootA, external],
        [rootA]);
    });

    it("two independent external scope violations", async () => {
      const rootA = insertElement();
      const rootB = insertElement();
      const extX = insertElement({ codeScope: rootA, codeValue: "extX" });
      const extY = insertElement({ codeScope: rootB, codeValue: "extY" });
      const rootC = insertElement();
      await executeTestCase("two independent violations",
        [rootA, rootB, rootC],
        [rootC],
        [rootA, rootB, extX, extY],
        [rootA, rootB]);
    });
  });

  describe("mixed element hierarchy and code scope violations", () => {
    it("root scopes another root - delete both roots, all descendants removed", async () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const childA2 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      await executeTestCase("root scopes root - delete both roots",
        [rootA, rootB],
        [rootA, childA1, childA2, rootB, childB1],
        []);
    });

    it("depth-1 child scopes an unrelated root", async () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      await executeTestCase("depth-1 child scopes root - delete both via parents",
        [rootA, rootB],
        [rootA, childA1, rootB, childB1],
        []);
      // Reverse input order - result must be identical
      await executeTestCase("depth-1 child scopes root - reverse input order",
        [rootB, rootA],
        [rootA, childA1, rootB, childB1],
        []);
    });

    it("depth-1 child scopes an unrelated root - delete child and root directly (parent survives)", async () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      // Only childA1 and rootB - rootA is NOT in the delete set.
      await executeTestCase("depth-1 child scopes root - delete child + scoped root directly",
        [childA1, rootB],
        [childA1, rootB, childB1],
        [rootA]);
    });

    it("depth-1 child scopes an unrelated root - deleting only the child is pruned from the delete set", async () => {
      // childA1 is the code scope of rootB, and rootB is not in the delete set, so childA1 is pruned.
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      await executeTestCase("delete child only - pruned",
        [childA1],
        [],
        [rootA, childA1, rootB, childB1],
        [childA1],
        false);
    });

    it("root scopes a depth-1 child in sibling tree - delete both roots, all descendants removed", async () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB, codeScope: rootA, codeValue: "childB1-code" });
      await executeTestCase("root scopes depth-1 child - delete both roots",
        [rootA, rootB],
        [rootA, childA1, rootB, childB1],
        []);
    });

    it("depth-1 child scopes a depth-1 child in sibling tree - delete both children directly (parents survive)", async () => {
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB, codeScope: childA1, codeValue: "childB1-code" });
      const childB2 = insertElement({ parentId: rootB });
      await executeTestCase("sibling-child scope - delete both children directly",
        [childA1, childB1],
        [childA1, childB1],
        [rootA, rootB, childB2]);
    });

    it("depth-2 grandchild scopes an unrelated root - delete grandparent + scoped root", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement({ codeScope: grandchildA, codeValue: "rootB-code" });
      const childB = insertElement({ parentId: rootB });
      await executeTestCase("depth-2 grandchild scopes root - delete both roots",
        [rootA, rootB],
        [rootA, childA, grandchildA, rootB, childB],
        []);

      // Delete grandchild and scoped root directly (rootA and childA survive)
      await executeTestCase("depth-2 grandchild scopes root - delete grandchild + root directly",
        [grandchildA, rootB],
        [grandchildA, rootB, childB],
        [rootA, childA]);
    });

    it("external element scopes a depth-2 grandchild, mixed with an unrelated deletion", async () => {
      // Unique case: grandchild has an external scope violation, but an unrelated element from
      // another tree (childB) is also requested and has no violation - it should be deleted.
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement();
      const childB = insertElement({ parentId: rootB });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      await executeTestCase("external scopes depth-2 grandchild, unrelated childB deleted",
        [grandchildA, rootA, childB],
        [childB],
        [rootA, childA, grandchildA, rootB, external],
        [rootA, grandchildA]);
    });

    it("two trees: one has external scope violation, other is deleted cleanly", async () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const gcA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB });
      const childB2 = insertElement({ parentId: rootB });
      const gcB = insertElement({ parentId: childB1 });
      await executeTestCase("one tree ignored, other fully deleted",
        [rootA, rootB],
        [rootB, childB1, childB2, gcB],
        [rootA, childA, gcA, external],
        [rootA]);
    });
  });

  describe("sub-model hierarchy", () => {
    let partitionCounter = 0;

    /** Insert a PhysicalPartition (and its sub-model) and acquire the shared lock needed to insert into it. */
    const insertSubModel = async (parentId: Id64String = IModel.rootSubjectId): Promise<Id64String> => {
      const name = `SubModelPartition-${++partitionCounter}-${Guid.createValue()}`;
      const id = PhysicalModel.insert(txn, parentId, name);
      await briefcase.locks.acquireLocks({ shared: id });
      return id;
    };

    const insertSubject = (parentId: Id64String): Id64String =>
      Subject.insert(txn, parentId, `Subject-${++partitionCounter}-${Guid.createValue()}`);

    const insertElementInModel = (subModelId: Id64String, opts: { parentId?: Id64String } = {}): Id64String =>
      insertElement({ modelId: subModelId, parentId: opts.parentId });

    it("delete a modeled element cascades into its sub-model", async () => {
      const partitionId = await insertSubModel();
      const elem1 = insertElementInModel(partitionId);
      const elem2 = insertElementInModel(partitionId);
      const unrelated = insertElement();

      await executeTestCase("delete partition",
        [partitionId],
        [partitionId, elem1, elem2],
        [unrelated]);

      // Every scenario is abandoned, so the sub-model must be back.
      assertModelExists(partitionId, "sub-model should be restored after abandoning the delete");
    });

    /**
     * Scenario: Subject -> partition (parent-child) -> modeled-element.
     *
     *   subjectA
     *     └─ [P:childPartition]
     *          [M:childPartition] -> elem1
     *   unrelated
     */
    it("delete a parent whose child is a modeled element cascades into the sub-model", async () => {
      const subjectA = insertSubject(IModel.rootSubjectId);
      const childPartitionId = await insertSubModel(subjectA);
      const elem1 = insertElementInModel(childPartitionId);
      const unrelated = insertElement();

      // Deleting subjectA cascades (parent-child) to childPartitionId, which then cascades (modeled-element) into elem1.
      await executeTestCase("delete subject cascading into sub-model",
        [subjectA],
        [subjectA, childPartitionId, elem1],
        [unrelated]);
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
    it("delete a modeled element whose sub-model elements have children", async () => {
      const partitionId = await insertSubModel();
      const elem1 = insertElementInModel(partitionId);
      const childOfElem1 = insertElementInModel(partitionId, { parentId: elem1 });
      const grandchildOfElem1 = insertElementInModel(partitionId, { parentId: childOfElem1 });
      const elem2 = insertElementInModel(partitionId);
      const unrelated = insertElement();

      await executeTestCase("delete partition with nested children",
        [partitionId],
        [partitionId, elem1, childOfElem1, grandchildOfElem1, elem2],
        [unrelated]);
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
    it("partition ignored when a sub-model element is a code scope for an external element", async () => {
      const partitionId = await insertSubModel();
      const scopingElem = insertElementInModel(partitionId);
      const otherElem = insertElementInModel(partitionId);
      const external = insertElement({ codeScope: scopingElem, codeValue: "ext-code" });
      const unrelated = insertElement();

      // `external` is NOT in the delete set and uses scopingElem as its code scope -> the
      // entire partition subtree (including the sub-model) must be ignored from the delete set.
      await executeTestCase("partition ignored due to external code scope",
        [partitionId, unrelated],
        [unrelated],
        [partitionId, scopingElem, otherElem, external],
        [partitionId]);

      assertModelExists(partitionId, "sub-model should be retained");
    });

    /**
     * Scenario: the sub-model element of one partition is used as a code scope for an element
     * inside a *different* partition's sub-model that is also in the delete set.
     * Both partitions and all contents should be deleted.
     *
     *   [P:p1]  [M:p1] -> scopingElem
     *   [P:p2]  [M:p2] -> dependentElem  (codeScope = scopingElem)
     */
    it("cross-sub-model intra-set code scope dependency: both partitions deleted cleanly", async () => {
      const p1 = await insertSubModel();
      const scopingElem = insertElementInModel(p1);
      const p2 = await insertSubModel();
      const dependentElem = insertElementInModel(p2);
      const dependentId = insertElement({ modelId: p2, codeScope: scopingElem, codeValue: "dep-code" });

      await executeTestCase("cross sub-model scope",
        [p1, p2],
        [p1, scopingElem, p2, dependentElem, dependentId],
        []);
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
    it("deep cascade: grandparent Subject -> child Subject -> partition -> sub-model elements", async () => {
      const grandparentSubjectId = insertSubject(IModel.rootSubjectId);
      const childSubjectId = insertSubject(grandparentSubjectId);
      const grandchildPartitionId = await insertSubModel(childSubjectId);
      const innerElem1 = insertElementInModel(grandchildPartitionId);
      const innerElem2 = insertElementInModel(grandchildPartitionId);
      const unrelated = insertElement();

      await executeTestCase("deep cascade",
        [grandparentSubjectId],
        [grandparentSubjectId, childSubjectId, grandchildPartitionId, innerElem1, innerElem2],
        [unrelated]);
    });

    /**
     * Scenario: empty sub-model: partition with no elements in its sub-model.
     *
     *   [P:partition]  [M:partition]  (empty)
     *   unrelated
     */
    it("delete a modeled element whose sub-model is empty", async () => {
      const partitionId = await insertSubModel();
      const unrelated = insertElement();

      await executeTestCase("delete empty partition",
        [partitionId],
        [partitionId],
        [unrelated]);
    });

    /**
     * Scenario: a Subject has a partition child with a sub-model. Deleting the Subject removes the
     * partition and all sub-model contents.
     */
    it("deleting a regular element with a partition child cascades correctly", async () => {
      const subjectA = insertSubject(IModel.rootSubjectId);
      const partitionChild = await insertSubModel(subjectA);
      const subElem1 = insertElementInModel(partitionChild);
      const subElem2 = insertElementInModel(partitionChild);
      const unrelated = insertElement();

      await executeTestCase("subject with partition child",
        [subjectA],
        [subjectA, partitionChild, subElem1, subElem2],
        [unrelated]);
    });

    /**
     * Scenario: a regular element's grandchild is a partition.  Passing the partition's
     * direct parent (not the grandparent root) for deletion cascades into the sub-model while
     * the grandparent survives.
     *
     *   grandparent
     *     └─ parent           <- passed for deletion
     *          └─ [P:partition]
     *               [M:partition] -> subElem1, subElem2
     */
    it("deleting a mid-tree regular element whose child is a partition cascades into the sub-model; grandparent survives", async () => {
      const subjectGP = insertSubject(IModel.rootSubjectId);
      const subjectP = insertSubject(subjectGP);
      const partitionId = await insertSubModel(subjectP);
      const subElem1 = insertElementInModel(partitionId);
      const subElem2 = insertElementInModel(partitionId);

      // Only pass subjectP - grandparent must survive, everything below subjectP must go.
      await executeTestCase("mid-tree subject with partition descendant",
        [subjectP],
        [subjectP, partitionId, subElem1, subElem2],
        [subjectGP]);
    });

    it("deleting a partition element directly (not via its regular parent) cascades into the sub-model; parent survives", async () => {
      const subjectA = insertSubject(IModel.rootSubjectId);
      const partitionId = await insertSubModel(subjectA);
      const subElem1 = insertElementInModel(partitionId);
      const subElem2 = insertElementInModel(partitionId);

      await executeTestCase("partition deleted directly",
        [partitionId],
        [partitionId, subElem1, subElem2],
        [subjectA]);
    });
  });

  describe("lock-specific behavior", () => {
    it("throws if the EditTxn is not active, without acquiring any locks", async () => {
      const elementId = insertElement();
      await releaseLocks();

      const inactiveTxn = new EditTxn(briefcase, "inactive");
      await expect(inactiveTxn.deleteElementsWithLocks([elementId])).to.eventually.be.rejected;
      assert.isFalse(briefcase.locks.holdsExclusiveLock(elementId), "no locks may be acquired when the txn is not active");
      assertExists(elementId, "element must survive");
    });

    it("fails when another briefcase holds the exclusive lock", async () => {
      const elementId = insertElement();
      await releaseLocks();

      const other = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
      try {
        other.channels.addAllowedChannel(ChannelControl.sharedChannelName);
        await other.locks.acquireLocks({ exclusive: elementId });

        await withAbandonedTxn("delete while other holds lock", async (txn) => {
          await expect(txn.deleteElementsWithLocks([elementId])).to.eventually.be.rejected;
        });

        assertExists(elementId, "element must survive when the lock cannot be acquired");
      } finally {
        await other.locks.releaseAllLocks().catch(() => { });
        other.close();
      }
    });

    it("is a no-op re-acquisition when the exclusive lock is already held", async () => {
      const elementId = insertElement();
      await releaseLocks();
      await briefcase.locks.acquireLocks({ exclusive: elementId });
      assert.isTrue(briefcase.locks.holdsExclusiveLock(elementId));

      await withAbandonedTxn("delete with lock already held", async (txn) => {
        const result = await txn.deleteElementsWithLocks([elementId]);
        assert.equal(result.status, BulkDeleteElementsStatus.Success);
        assertDeleted(elementId, "element should be deleted");
      });
    });

    it("deleting a sub-model's contents also requires and acquires their locks", async () => {
      const partitionId = PhysicalModel.insert(txn, IModel.rootSubjectId, `LockPartition-${Guid.createValue()}`);
      await briefcase.locks.acquireLocks({ shared: partitionId });
      const inner = insertElement({ modelId: partitionId });
      await releaseLocks();

      // The lock check runs for every cascaded element too, so the un-requested `inner` must also be covered.
      await withAbandonedTxn("delete partition without locks", async (txn) => {
        assert.throws(() => txn.deleteElements([partitionId]), /exclusive lock/);
      });

      await withAbandonedTxn("delete partition with locks", async (txn) => {
        const result = await txn.deleteElementsWithLocks([partitionId]);
        assert.equal(result.status, BulkDeleteElementsStatus.Success);
        assertDeleted(inner, "sub-model element should be deleted");
        assertModelDeleted(partitionId, "sub-model should be deleted");
      });
    });
  });
});
