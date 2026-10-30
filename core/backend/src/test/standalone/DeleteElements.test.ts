import { assert } from "chai";
import { DbResult, Id64, Id64Array, Id64Set, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { Code, CodeScopeSpec, ExternalSourceAspectProps, GeometryPartProps, IModel, PhysicalElementProps, QueryBinder, SubCategoryAppearance } from "@itwin/core-common";
import {
  _nativeDb, BulkDeleteElementsResult, BulkDeleteElementsStatus, BulkDeleteFailureReason, ChannelControl, DefinitionModel, EditTxn, ElementDrivesElement, ElementDrivesElementProps, ElementGroupsMembers, ExternalSourceAspect,
  GeometryPart, Group, GroupInformationPartition, GroupModel, IModelDb, IModelJsFs, PhysicalModel, RenderMaterialElement, SnapshotDb, SpatialCategory, StandaloneDb, SubCategory, Subject, SubjectOwnsPartitionElements,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { withEditTxn } from "../TestEditTxn";

/**
 * Expected failure entry. Omit `reason` to only require that the element is reported (regardless of why).
 * `detail` may be a literal string or a RegExp matched against the reported `table.column`.
 */
interface ExpectedFailure {
  elementId: Id64String;
  reason?: BulkDeleteFailureReason;
  detail?: string | RegExp;
}

/** Expected shape of a [[BulkDeleteElementsResult]]. `sqlDeleteStatus` defaults to `BE_SQLITE_OK`. */
interface ExpectedResult {
  status: BulkDeleteElementsStatus;
  sqlDeleteStatus?: DbResult;
  failures: ExpectedFailure[];
  failedIds?: Id64Set;
}

const success: ExpectedResult = { status: BulkDeleteElementsStatus.Success, sqlDeleteStatus: DbResult.BE_SQLITE_OK, failures: [], failedIds: new Set() };
/**
 * Nothing is deleted; `failures` lists the *direct* violators only. The bulk delete validates the expanded delete set exactly
 * once (no pruning fixpoint), so an element that would only become a violator after another violator is excluded is NOT reported.
 */
const constraintViolation = (failedIds: Id64Set, ...failures: ExpectedFailure[]): ExpectedResult => ({ status: BulkDeleteElementsStatus.ConstraintViolation, sqlDeleteStatus: DbResult.BE_SQLITE_OK, failures, failedIds });

/** The element itself is referenced from outside the delete set via its Code scope. */
const codeScopeViolator = (elementId: Id64String): ExpectedFailure => ({ elementId, reason: BulkDeleteFailureReason.ReferencedByForeignKey, detail: `bis_Element.CodeScopeId` });
/** A Category still assigned to a GeometricElement3d outside the delete set (hard FK, so not `DefinitionInUse`). */
const categoryInUse3d = (elementId: Id64String): ExpectedFailure => ({ elementId, reason: BulkDeleteFailureReason.ReferencedByForeignKey, detail: `bis_GeometricElement3d.CategoryId` });
/** A DefinitionElement still used (e.g. via a GeometryStream) by elements outside the delete set. No SQLite foreign key is involved. */
const definitionInUse = (elementId: Id64String): ExpectedFailure => ({ elementId, reason: BulkDeleteFailureReason.DefinitionInUse });

const assertNoFkViolations = (db: IModelDb) => {
  const rows = db.withSqliteStatement("PRAGMA foreign_key_check", (stmt) => {
    const out: string[] = [];
    while (stmt.step() === DbResult.BE_SQLITE_ROW)
      out.push(`${stmt.getValueString(0)} rowid=${stmt.getValueInteger(1)} -> ${stmt.getValueString(2)} fk#${stmt.getValueInteger(3)}`);
    return out;
  });
  assert.isEmpty(rows, `PRAGMA foreign_key_check reported violations after bulk delete: ${rows.join("; ")}`);
};

/**
 * Minimal domain schema with a navigation property on an Element subclass. Navigation properties declared in domain
 * schemas are NOT backed by a SQLite foreign key (only BisCore can declare FK-enforced nav props), so the bulk delete
 * has to detect and NULL them itself rather than relying on `PRAGMA foreign_key_list`.
 */
const navTestSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="DeleteElementsNavTest" alias="dent" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
  <ECEntityClass typeName="NavObject">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECNavigationProperty propertyName="Target" relationshipName="NavObjectRefersToElement" direction="Forward"/>
  </ECEntityClass>
  <ECRelationshipClass typeName="NavObjectRefersToElement" strength="referencing" modifier="Sealed">
    <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true">
      <Class class="NavObject"/>
    </Source>
    <Target multiplicity="(0..1)" roleLabel="is referred to by" polymorphic="true">
      <Class class="bis:Element"/>
    </Target>
  </ECRelationshipClass>
</ECSchema>`;

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
    await seedDb.importSchemaStrings([navTestSchemaXml]);

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
  const assertExists = (id: Id64String, msg?: string) => assert.isDefined(iModelDb.elements.tryGetElement(id), msg);
  const assertDeleted = (id: Id64String, msg?: string) => assert.isUndefined(iModelDb.elements.tryGetElement(id), msg);

  /** Assert the result matches `expected` and that elements in the delete set are the only ones reported; then check which elements were deleted / retained. */
  const assertResult = (result: BulkDeleteElementsResult, expected: ExpectedResult, deletedIds: Id64Array, retainedIds: Id64Array) => {
    assert.equal(result.status, expected.status, `Bulk element deletion status is ${BulkDeleteElementsStatus[result.status]}; Expected: ${BulkDeleteElementsStatus[expected.status]}. Actual failures: ${JSON.stringify(result.failures)}`);
    assert.equal(result.sqlDeleteStatus, expected.sqlDeleteStatus ?? DbResult.BE_SQLITE_OK, `Bulk element deletion internal sql status is ${result.sqlDeleteStatus}; Expected: ${expected.sqlDeleteStatus ?? DbResult.BE_SQLITE_OK}`);

    assert.equal(result.failures.length, expected.failures.length, `Actual failures don't match the expected. Actual: ${JSON.stringify(result.failures)}; Expected: ${JSON.stringify(expected.failures)}`);
    assert.deepEqualInAnyOrder(result.failures, expected.failures);

    for (const retainedId of retainedIds)
      assertExists(retainedId);

    for (const deletedId of deletedIds)
      assertDeleted(deletedId);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(result.failedIds, expected.failedIds ?? new Set());

    assertNoFkViolations(iModelDb);
  };

  // Run deleteElements, compare the returned result object against `expected`, then check each id in `deleted` is gone and each id in `retained` is still present.
  const executeTestCase = (_label: string, idsToDelete: Id64Array, deletedIds: Id64Array, retainedIds: Id64Array, expected: ExpectedResult = success) => {
    const result = txn.deleteElements(idsToDelete);
    assertResult(result, expected, deletedIds, retainedIds);
    txn.abandonChanges();
  };

  /**
   * Run a delete that must be rejected with `ConstraintViolation`: nothing is deleted, so every id in `retained` must still exist,
   * and `failures` / `failedIds` must list exactly the given direct violators. Changes are rolled back afterwards.
   */
  const expectRejected = (label: string, idsToDelete: Id64Array, retained: Id64Array, failedIds: Id64Set, ...failures: ExpectedFailure[]) =>
    executeTestCase(label, idsToDelete, [], retained, constraintViolation(failedIds, ...failures));

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
        [parentB, childB1, childB2, standalone, childS1]
      );
    });

    it("Second call to deleteElement fails if a read cursor on a temp table is open", () => {
      // Create a temp table on the same SQLite connection that the native bulk-delete will use to simulate a shared temp table lock
      iModelDb.withSqliteStatement("CREATE TABLE IF NOT EXISTS temp.temp_table (x INTEGER)", (s) => s.step());
      iModelDb.withSqliteStatement("INSERT INTO temp.temp_table VALUES (1)", (s) => s.step());

      const lockStmt = iModelDb.prepareSqliteStatement("SELECT x FROM temp.temp_table");
      assert.equal(lockStmt.step(), DbResult.BE_SQLITE_ROW);

      const el1 = insertElement();
      const el2 = insertElement();

      const result1 = txn.deleteElements([el1]);
      const result2 = txn.deleteElements([el2]);

      for (const result of [result1, result2]) {
        assert.isEmpty(result.failures);
        assert.equal(result.status, BulkDeleteElementsStatus.Success, "deleteElements call must succeed");
        assert.equal(result.sqlDeleteStatus, DbResult.BE_SQLITE_OK);
      }

      // Would have been the case if "DROP TABLE IF EXISTS..." was used (bug)
      assert.notEqual(result2.status, BulkDeleteElementsStatus.DeletionFailed);
      assert.notEqual(result2.sqlDeleteStatus, DbResult.BE_SQLITE_LOCKED);

      lockStmt[Symbol.dispose](); // release the simulated read-lock

      txn.abandonChanges();
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
        constraintViolation(new Set([childA]), codeScopeViolator(childA)));

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
      executeTestCase("scope chain single A", [rootA], [], [rootA, rootB, rootC], constraintViolation(new Set([rootA]), codeScopeViolator(rootA)));
      executeTestCase("scope chain single B", [rootB], [], [rootA, rootB, rootC], constraintViolation(new Set([rootB]), codeScopeViolator(rootB)));
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

      // Only A and D in the delete set. B is external -> A is a violator, which rejects the whole call even though D itself is safe.
      executeTestCase("deep gap chain: A violates, nothing deleted",
        [rootA, rootD],
        [],
        [rootA, rootB, rootC, rootD],
        constraintViolation(new Set([rootA]), codeScopeViolator(rootA)));
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

      // Delete only the scope element - childB is external -> childA is a violator.
      executeTestCase("sibling scope - delete only scope element, rejected due to external childB",
        [childA],
        [],
        [parent, childA, childB],
        constraintViolation(new Set([childA]), codeScopeViolator(childA)));
    });
  });

  describe("all-or-nothing semantics and validation rounds", () => {
    /** A -> B -> C -> D code-scope chain (each element is the code scope of the next). */
    const insertScopeChain = () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const rootC = insertElement({ codeScope: rootB, codeValue: "rootC-code" });
      const rootD = insertElement({ codeScope: rootC, codeValue: "rootD-code" });
      return { rootA, rootB, rootC, rootD };
    };

    it("reports each FK violator with the referencing table.column and deletes nothing", () => {
      const { rootA, rootB, rootC, rootD } = insertScopeChain();
      const all = [rootA, rootB, rootC, rootD];

      // A is scoped by B (external) -> violator. D is safe, but the call is all-or-nothing.
      executeTestCase("Delete A and D", [rootA, rootD], [], all, constraintViolation(new Set([rootA]), codeScopeViolator(rootA)));

      // Only the *direct* violators are reported: A is scoped by B which is in the set, so only B (scoped by external C) is reported.
      executeTestCase("Delete A and B", [rootA, rootB], [], all, constraintViolation(new Set([rootB]), codeScopeViolator(rootB)));
      executeTestCase("Delete B and C", [rootB, rootC], [], all, constraintViolation(new Set([rootC]), codeScopeViolator(rootC)));
      executeTestCase("Delete A, B and D", [rootA, rootB, rootD], [], all, constraintViolation(new Set([rootB]), codeScopeViolator(rootB)));

      // Tail of the chain has no external dependents.
      executeTestCase("Delete C and D", [rootC, rootD], [rootC, rootD], [rootA, rootB], success);
      executeTestCase("Delete all the roots", all, all, [], success);
    });

    it("succeeds when the whole chain is in the delete set, regardless of input order", () => {
      const { rootA, rootB, rootC, rootD } = insertScopeChain();
      executeTestCase("forward", [rootA, rootB, rootC, rootD], [rootA, rootB, rootC, rootD], []);
      executeTestCase("reversed", [rootD, rootC, rootB, rootA], [rootA, rootB, rootC, rootD], []);
    });

    it("an unrelated deletable element does not rescue a call that contains a violator", () => {
      const { rootA, rootB, rootC, rootD } = insertScopeChain();
      const unrelated = insertElement();
      expectRejected("violator + unrelated", [rootA, rootD, unrelated], [rootA, rootB, rootC, rootD, unrelated],
        new Set([rootA]), codeScopeViolator(rootA));
    });

    it("reports only first-round violators (no pruning fixpoint) - known limitation", () => {
      // Chain A <- B <- C <- D; delete [A, B, D]. C is external and scopes B, so B is a violator. A is scoped by B, which is
      // *in* the set, so A is not a violator in the single validation round that runs. If the caller drops B from the input and
      // retries, A will then be reported. Pinned here so a change in the native validation strategy is deliberate.
      const { rootA, rootB, rootC, rootD } = insertScopeChain();

      const result = txn.deleteElements([rootA, rootB, rootD]);
      assertResult(result, constraintViolation(new Set([rootB]), codeScopeViolator(rootB)), [], [rootA, rootB, rootC, rootD]);
      assert.isFalse(result.failures.some((f) => f.elementId === rootA), "transitive violators (A) are not reported; update this test if the native fixpoint changes");

      txn.abandonChanges();
      const retry = txn.deleteElements([rootA, rootD]);
      assertResult(retry, constraintViolation(new Set([rootA]), codeScopeViolator(rootA)), [], [rootA, rootB, rootC, rootD]);
    });

    it("a rejected delete does not evict anything from the element cache", () => {
      const { rootA, rootD } = insertScopeChain();
      // Prime the cache.
      const before = iModelDb.elements.getElement(rootA);

      expectRejected("rejected delete keeps cache", [rootA, rootD], [rootA, rootD], new Set([rootA]), codeScopeViolator(rootA));

      const after = iModelDb.elements.getElement(rootA);
      assert.strictEqual(after.id, before.id);
      assertExists(rootD, "rootD must still exist");
    });

    it("ConstraintViolation leaves no side effects behind (aspects, subclass rows, sub-models)", async () => {
      // Validation runs before anything is modified, so unlike DeletionFailed nothing needs to be abandoned.
      const { rootA, rootB, rootC, rootD } = insertScopeChain();
      const aspectId = txn.insertAspect({
        classFullName: ExternalSourceAspect.classFullName,
        element: { id: rootD },
        scope: { id: IModel.rootSubjectId },
        identifier: "src-rootD",
        kind: "Element",
      } as ExternalSourceAspectProps);
      const partitionId = PhysicalModel.insert(txn, IModel.rootSubjectId, "NoSideEffects");
      txn.saveChanges();
      const aspectExists = async (): Promise<boolean> => {
        const reader = iModelDb.createQueryReader("SELECT 1 FROM bis.ElementMultiAspect WHERE ECInstanceId=?", new QueryBinder().bindId(1, aspectId));
        return reader.step();
      };
      const geomRowExists = (id: Id64String) => iModelDb.withPreparedSqliteStatement("SELECT 1 FROM bis_GeometricElement3d WHERE ElementId=?", (stmt) => { stmt.bindId(1, id); return stmt.step() === DbResult.BE_SQLITE_ROW; });

      const result = txn.deleteElements([rootA, rootD, partitionId]);
      assertResult(result, constraintViolation(new Set([rootA]), codeScopeViolator(rootA)), [], [rootA, rootB, rootC, rootD, partitionId]);
      assert.isTrue(await aspectExists(), "aspect must not be touched");
      assert.isTrue(geomRowExists(rootD), "subclass rows must not be touched");
      assert.isDefined(iModelDb.models.tryGetModelProps(partitionId), "sub-model must not be touched");
      assert.isFalse(iModelDb[_nativeDb].hasUnsavedChanges(), "a rejected delete must not dirty the txn");
    });

    it("deprecated skipFKConstraintValidations flag is ignored (either value)", () => {
      const { rootA, rootB, rootC, rootD } = insertScopeChain();

      for (const skipFKConstraintValidations of [true, false]) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const result = txn.deleteElements([rootA, rootD], { skipFKConstraintValidations });
        assertResult(result, constraintViolation(new Set([rootA]), codeScopeViolator(rootA)), [], [rootA, rootB, rootC, rootD]);

        // ...and succeeds when nothing is referenced from outside the set.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const ok = txn.deleteElements([rootA, rootB, rootC, rootD], { skipFKConstraintValidations });
        assertResult(ok, success, [rootA, rootB, rootC, rootD], []);
        txn.abandonChanges();
      }
    });
  });

  describe("Code scope violations from outside the delete set", () => {
    it("root is code scope for an external element", () => {
      const rootA = insertElement();
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      const rootB = insertElement();
      expectRejected("external scopes root", [rootA, rootB], [rootA, rootB, external],
        new Set([rootA]), codeScopeViolator(rootA));
    });

    it("depth-1 child is code scope for external", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      // The cascaded child is the violator; the requested parent is not itself reported.
      expectRejected("external scopes depth-1 child", [rootA, rootB], [rootA, childA, external, rootB],
        new Set([childA]), codeScopeViolator(childA));
    });

    it("depth-2 grandchild is code scope for external", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      const rootB = insertElement();
      expectRejected("external scopes depth-2 grandchild", [rootA, rootB], [rootA, childA, grandchildA, external, rootB],
        new Set([grandchildA]), codeScopeViolator(grandchildA));
    });

    it("only the child is passed for deletion", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      expectRejected("external scopes requested child", [childA], [rootA, childA, external],
        new Set([childA]), codeScopeViolator(childA));
    });

    it("root has both an external scope dependent AND an intra-set scope dependent", () => {
      const rootA = insertElement();
      const rootB = insertElement({ codeScope: rootA, codeValue: "rootB-code" });
      const external = insertElement({ codeScope: rootA, codeValue: "ext-code" });
      expectRejected("root rejected due to external", [rootA, rootB], [rootA, rootB, external],
        new Set([rootA]), codeScopeViolator(rootA));
    });

    it("two independent external scope violations are both reported", () => {
      const rootA = insertElement();
      const rootB = insertElement();
      const extX = insertElement({ codeScope: rootA, codeValue: "extX" });
      const extY = insertElement({ codeScope: rootB, codeValue: "extY" });
      const rootC = insertElement();
      expectRejected("two independent violations", [rootA, rootB, rootC], [rootA, rootB, rootC, extX, extY],
        new Set([rootA, rootB]), codeScopeViolator(rootA), codeScopeViolator(rootB));
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

    it("depth-1 child scopes an unrelated root - deleting only the child is rejected because the scoped root is outside the set", () => {
      // childA1 is the code scope of rootB. rootB is not in the delete set, so childA1 is still referenced and the call is rejected.
      const rootA = insertElement();
      const childA1 = insertElement({ parentId: rootA });
      const rootB = insertElement({ codeScope: childA1, codeValue: "rootB-code" });
      const childB1 = insertElement({ parentId: rootB });
      expectRejected("delete child only - scoped root is external", [childA1], [rootA, childA1, rootB, childB1],
        new Set([childA1]), codeScopeViolator(childA1));
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
      // The grandchild has an external scope violation. An unrelated element from another tree (childB) is also requested and
      // has no violation, but the call is all-or-nothing so it survives as well.
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const grandchildA = insertElement({ parentId: childA });
      const rootB = insertElement();
      const childB = insertElement({ parentId: rootB });
      const external = insertElement({ codeScope: grandchildA, codeValue: "ext-code" });
      expectRejected("external scopes depth-2 grandchild, unrelated childB retained",
        [grandchildA, rootA, childB],
        [rootA, childA, grandchildA, rootB, childB, external],
        new Set([grandchildA]), codeScopeViolator(grandchildA));
    });

    it("two trees: one has external scope violation, neither is deleted", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const gcA = insertElement({ parentId: childA });
      const external = insertElement({ codeScope: childA, codeValue: "ext-code" });
      const rootB = insertElement();
      const childB1 = insertElement({ parentId: rootB });
      const childB2 = insertElement({ parentId: rootB });
      const gcB = insertElement({ parentId: childB1 });
      expectRejected("one tree violates, both retained",
        [rootA, rootB],
        [rootA, childA, gcA, external, rootB, childB1, childB2, gcB],
        new Set([childA]), codeScopeViolator(childA));
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
      assert.isEmpty(result.failures);
      assertDeleted(partitionId, "partition element should be deleted");
      assertModelDeleted(partitionId, "sub-model should be deleted");
      assertDeleted(elem1, "elem1 inside sub-model should be deleted");
      assertDeleted(elem2, "elem2 inside sub-model should be deleted");
      assertExists(unrelated, "unrelated element should be retained");
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
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
    it("partition rejected when a sub-model element is a code scope for an external element", () => {
      const partitionId = insertSubModel();
      const scopingElem = insertElementInModel(partitionId);
      const otherElem = insertElementInModel(partitionId);
      const external = insertElement({ codeScope: scopingElem, codeValue: "ext-code" });
      const unrelated = insertElement();

      // `external` is NOT in the delete set and uses scopingElem as its code scope -> the cascaded sub-model member is a
      // violator and the whole call is rejected, including the unrelated element.
      const result = txn.deleteElements([partitionId, unrelated]);
      assertResult(result, constraintViolation(new Set([scopingElem]), codeScopeViolator(scopingElem)), [], [partitionId, scopingElem, otherElem, external, unrelated]);
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
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
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
      assertNoFkViolations(iModelDb);
    });
  });

  /**
   * Members of a sub-model that are *also* listed explicitly in the input. Native expands the delete set from the element itself
   * (children + sub-model contents), so a violator inside the sub-model must reject the call regardless of whether it was
   * requested or cascaded, and a rejected call must never delete the model row out from under explicitly-requested members.
   *
   *   [P:defPartition]  [M:defPartition] -> catA (used by wall1, outside the set), catB (unused)
   *   wall1 (in modelId, category = catA)
   */
  describe("explicit sub-model members", () => {
    let defPartition: Id64String;
    let catA: Id64String, catB: Id64String;
    let subA: Id64String, subB: Id64String;
    let wall1: Id64String;

    beforeEach(() => {
      defPartition = DefinitionModel.insert(txn, IModel.rootSubjectId, "DefPartition");
      catA = SpatialCategory.insert(txn, defPartition, "CatA", new SubCategoryAppearance());
      catB = SpatialCategory.insert(txn, defPartition, "CatB", new SubCategoryAppearance());
      subA = IModel.getDefaultSubCategoryId(catA);
      subB = IModel.getDefaultSubCategoryId(catB);
      wall1 = txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: modelId, category: catA, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      txn.saveChanges();
    });

    const assertPartitionIntact = () => {
      assert.isDefined(iModelDb.models.tryGetModelProps(defPartition), "sub-model row must survive when the call is rejected");
      assert.equal(iModelDb.elements.getElement(catA).model, defPartition, "catA must still live in the sub-model");
    };

    it("Only the modeled element requested: violator inside rejects it, nothing deleted", () => {
      expectRejected("partition only", [defPartition], [defPartition, catA, subA, catB, subB, wall1],
        new Set([catA]), categoryInUse3d(catA));
      assertPartitionIntact();
    });

    it("Modeled element + members requested explicitly: nothing deleted, only the direct violator is reported", () => {
      // The reviewer's case: pre-fix native treated catB as a root (it was requested) and deleted it together with the model row
      // while catA survived, leaving catA pointing at a model that no longer existed.
      expectRejected("partition + members", [defPartition, catA, catB], [defPartition, catA, subA, catB, subB, wall1],
        new Set([catA]), categoryInUse3d(catA));
      assertPartitionIntact();
    });

    it("Only members requested (modeled element not listed): the in-use one rejects the call, the model survives", () => {
      expectRejected("members only", [catA, catB], [defPartition, catA, subA, catB, subB, wall1],
        new Set([catA]), categoryInUse3d(catA));
      assertPartitionIntact();
    });

    it("Only the unused member requested: deleted, the model survives", () => {
      executeTestCase("unused member only", [catB], [catB, subB], [defPartition, catA, subA, wall1]);
      assertPartitionIntact();
    });

    it("Once the external user is gone, modeled element + members delete cleanly", () => {
      txn.deleteElement(wall1);
      txn.saveChanges();
      const result = txn.deleteElements([defPartition, catA, catB]);
      assertResult(result, success, [defPartition, catA, subA, catB, subB], []);
      assert.isUndefined(iModelDb.models.tryGetModelProps(defPartition), "sub-model row must be deleted with its modeled element");
    });

    it("Requested member deep in a parent chain inside the sub-model rejects the call", () => {
      const partition = PhysicalModel.insert(txn, IModel.rootSubjectId, "ChainPartition");
      const insertIn = (parentId?: Id64String) => txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: partition, category: categoryId, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
        ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
      } as PhysicalElementProps);
      const p = insertIn();
      const c = insertIn(p);
      const g = insertIn(c);
      txn.saveChanges();
      const external = insertElement({ codeScope: g, codeValue: "ext-g" });

      // g is requested *and* a cascaded grandchild of a sub-model member; it is a violator either way.
      expectRejected("partition + deep member", [partition, g], [partition, p, c, g, external],
        new Set([g]), codeScopeViolator(g));
      assert.isDefined(iModelDb.models.tryGetModelProps(partition));
    });
  });

  /**
   * `DefinitionInUse` is reported for definitions referenced from geometry streams or other non-FK usages. Every category test
   * elsewhere in this file is caught by the `CategoryId` *foreign key* path first, so these are the only tests that reach
   * `DefinitionElementUsageInfo`. The RenderMaterial / GeometryPart cases force a full geometry-stream scan natively; fine on
   * a tiny db, do not copy this pattern into a performance test.
   *
   *   [M:defModel] -> cat (-> sub, non-default), mat, part
   *   elem (in modelId, category = cat): geometry uses sub, mat and part
   */
  describe("DefinitionInUse via geometry streams", () => {
    let defModel: Id64String;
    let cat: Id64String, sub: Id64String, defaultSub: Id64String, mat: Id64String, part: Id64String;
    let elem: Id64String;

    beforeEach(() => {
      defModel = DefinitionModel.insert(txn, IModel.rootSubjectId, "Defs");
      cat = SpatialCategory.insert(txn, defModel, "Cat", new SubCategoryAppearance());
      defaultSub = IModel.getDefaultSubCategoryId(cat);
      sub = SubCategory.insert(txn, cat, "Sub", new SubCategoryAppearance());
      mat = RenderMaterialElement.insert(txn, defModel, "Mat", { paletteName: "p" });
      part = txn.insertElement({
        classFullName: GeometryPart.classFullName, model: defModel, code: GeometryPart.createCode(iModelDb, defModel, "Part"),
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      } as GeometryPartProps);
      elem = txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: modelId, category: cat, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), cat, sub, mat, part),
      } as PhysicalElementProps);
      txn.saveChanges();
    });

    it("A non-default SubCategory referenced from a geometry stream is DefinitionInUse", () => {
      expectRejected("sub-category in geometry", [sub], [cat, defaultSub, sub, elem], new Set([sub]), definitionInUse(sub));
    });

    it("A in-use Category rejects the call that also requests its SubCategory (nothing deleted)", () => {
      // Pre-fix native pruned only *upwards* from the violator: `sub` was deleted while `cat` survived. With all-or-nothing
      // semantics the sub-category must survive together with its category.
      const elem2 = txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: modelId, category: cat, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      txn.saveChanges();
      // Remove the geometry-stream user so the only thing keeping `cat` alive is the CategoryId FK from elem2.
      txn.deleteElement(elem);
      txn.saveChanges();

      expectRejected("category + sub-category", [cat, sub], [cat, defaultSub, sub, elem2], new Set([cat]), categoryInUse3d(cat));
    });

    it("A RenderMaterial referenced from a geometry stream is DefinitionInUse", () => {
      expectRejected("material in geometry", [mat], [mat, elem], new Set([mat]), definitionInUse(mat));
    });

    it("A GeometryPart referenced from a geometry stream is DefinitionInUse", () => {
      expectRejected("part in geometry", [part], [part, elem], new Set([part]), definitionInUse(part));
    });

    it("Definitions whose only user is in the delete set are deleted with it", () => {
      executeTestCase("definitions + their user", [mat, part, sub, elem], [mat, part, sub, elem], [cat, defaultSub]);
    });
  });

  describe("input validation and txn state", () => {
    it("throws when the EditTxn is not active", () => {
      const el = insertElement();
      txn.end("abandon");
      assert.throws(() => txn.deleteElements([el]), "EditTxn is not active");

      // Re-activate so afterEach can end it.
      txn = new EditTxn(iModelDb, "delete elements");
      txn.start();
      assertExists(el, "nothing may be deleted by an inactive txn");
    });

    it("throws before touching the iModel when any id is invalid, even if other ids are deletable", () => {
      const rootA = insertElement();
      const rootB = insertElement();
      assert.throws(() => txn.deleteElements([rootA, "0x", rootB]));
      assert.throws(() => txn.deleteElements([rootA, "", rootB]));
      assertExists(rootA);
      assertExists(rootB);
    });

    it("well-formed ids that do not exist are ignored", () => {
      const rootA = insertElement();
      const missing = "0xffffffffffff";
      assert.isUndefined(iModelDb.elements.tryGetElement(missing));
      executeTestCase("missing id", [rootA, missing], [rootA], [], success);
    });

    it("second deletion of an already-deleted element is a no-op", () => {
      const rootA = insertElement();
      const rootB = insertElement();
      assert.equal(txn.deleteElements([rootA]).status, BulkDeleteElementsStatus.Success);
      assertDeleted(rootA);

      // rootA no longer exists; the call must still succeed and delete rootB.
      const result = txn.deleteElements([rootA, rootB]);
      assertResult(result, success, [rootA, rootB], []);
    });

    it("does not auto-save: abandonChanges restores every deleted element", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const result = txn.deleteElements([rootA]);
      assertResult(result, success, [rootA, childA], []);

      txn.abandonChanges();
      assertExists(rootA, "abandon must restore rootA");
      assertExists(childA, "abandon must restore childA");
    });

    it("an element referenced through several foreign keys is reported exactly once", () => {
      // A fresh category referenced from outside the delete set via two distinct NO ACTION foreign keys:
      //   - bis_GeometricElement3d.CategoryId (a PhysicalObject assigned to it)
      //   - bis_Element.CodeScopeId          (another element using it as code scope)
      const multiRefCategory = SpatialCategory.insert(txn, IModel.dictionaryId, "MultiRefCategory", new SubCategoryAppearance());
      const usesAsCategoryProps: PhysicalElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: modelId,
        category: multiRefCategory,
        code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      };
      const usesAsCategory = txn.insertElement(usesAsCategoryProps);
      const usesAsCodeScope = insertElement({ codeScope: multiRefCategory, codeValue: "scoped-by-category" });
      txn.saveChanges();

      const fkDetails = ["bis_GeometricElement3d.CategoryId", "bis_Element.CodeScopeId"];
      const result = txn.deleteElements([multiRefCategory]);
      assert.equal(result.status, BulkDeleteElementsStatus.ConstraintViolation);
      assert.equal(result.failures.length, 1, `expected a single failure, got ${JSON.stringify(result.failures)}`);
      const [failure] = result.failures;
      assert.equal(failure.elementId, multiRefCategory);
      assert.equal(failure.reason, BulkDeleteFailureReason.ReferencedByForeignKey);
      assert.include(fkDetails, failure.detail, "detail must name one of the referencing foreign keys");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      assert.deepEqual(result.failedIds, new Set([multiRefCategory]));
      for (const id of [multiRefCategory, usesAsCategory, usesAsCodeScope])
        assertExists(id);

      // Once both referencing elements are in the delete set the category is no longer a violator.
      const retry = txn.deleteElements([multiRefCategory, usesAsCategory, usesAsCodeScope]);
      assertResult(retry, success, [multiRefCategory, usesAsCategory, usesAsCodeScope], []);
    });
  });

  describe("cache coherence", () => {
    /** Load an element (or model) so that it is held in the in-memory cache. */
    const prime = (ids: Id64Array) => {
      for (const id of ids)
        assert.isDefined(iModelDb.elements.getElement(id));
    };

    it("cascaded descendants that were cached are no longer readable after their ancestor is deleted", () => {
      const parent = insertElement();
      const child = insertElement({ parentId: parent });
      const grandchild = insertElement({ parentId: child });
      prime([parent, child, grandchild]);

      const result = txn.deleteElements([parent]);
      assertResult(result, success, [parent, child, grandchild], []);
      assert.isUndefined(iModelDb.elements.tryGetElementProps(child), "cached child props must not be served after deletion");
      assert.isUndefined(iModelDb.elements.tryGetElementProps(grandchild), "cached grandchild props must not be served after deletion");
      assert.throws(() => iModelDb.elements.getElement(child));
    });

    it("cached sub-model contents and the model itself are no longer readable after the modeled element is deleted", () => {
      const partitionId = PhysicalModel.insert(txn, IModel.rootSubjectId, "CachedSubModelPartition");
      const inner = txn.insertElement({
        classFullName: "Generic:PhysicalObject",
        model: partitionId,
        category: categoryId,
        code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      txn.saveChanges();
      prime([partitionId, inner]);
      assert.isDefined(iModelDb.models.getModelProps(partitionId));
      assert.isDefined(iModelDb.models.getModel(partitionId));

      const result = txn.deleteElements([partitionId]);
      assertResult(result, success, [partitionId, inner], []);
      assert.isUndefined(iModelDb.models.tryGetModelProps(partitionId), "cached model props must not be served after deletion");
      assert.isUndefined(iModelDb.models.tryGetModel(partitionId), "cached model must not be served after deletion");
      assert.isUndefined(iModelDb.elements.tryGetElementProps(inner), "cached sub-model element must not be served after deletion");
    });

    it("on ConstraintViolation, every cached element stays readable", () => {
      const rootA = insertElement();
      const external = insertElement({ codeScope: rootA, codeValue: "ext" });
      const rootB = insertElement();
      const childB = insertElement({ parentId: rootB });
      prime([rootA, external, rootB, childB]);

      const result = txn.deleteElements([rootA, rootB]);
      assertResult(result, constraintViolation(new Set([rootA]), codeScopeViolator(rootA)), [], [rootA, external, rootB, childB]);
      for (const id of [rootA, external, rootB, childB])
        assert.strictEqual(iModelDb.elements.getElement(id).id, id);
    });

    it("a cached parent reflects the removal of its children", () => {
      const parent = insertElement();
      const child = insertElement({ parentId: parent });
      prime([parent, child]);
      assert.deepEqual(iModelDb.elements.queryChildren(parent), [child]);

      const result = txn.deleteElements([child]);
      assertResult(result, success, [child], [parent]);
      assert.isEmpty(iModelDb.elements.queryChildren(parent));
      assert.strictEqual(iModelDb.elements.getElement(parent).id, parent);
    });
  });

  describe("related data cleanup", () => {
    const countAspects = async (elementId: Id64String): Promise<number> => {
      const reader = iModelDb.createQueryReader("SELECT COUNT(*) FROM bis.ElementMultiAspect WHERE Element.Id=?", new QueryBinder().bindId(1, elementId), { usePrimaryConn: true });
      assert.isTrue(await reader.step());
      return reader.current.toArray()[0];
    };

    const insertAspect = (elementId: Id64String, scopeId: Id64String = IModel.rootSubjectId): Id64String =>
      txn.insertAspect({
        classFullName: ExternalSourceAspect.classFullName,
        element: { id: elementId },
        scope: { id: scopeId },
        identifier: `src-${elementId}`,
        kind: "Element",
      } as ExternalSourceAspectProps);

    it("aspects owned by deleted elements (including cascaded descendants) are removed", async () => {
      const parent = insertElement();
      const child = insertElement({ parentId: parent });
      const survivor = insertElement();
      insertAspect(parent);
      insertAspect(child);
      insertAspect(child);
      const survivorAspect = insertAspect(survivor);
      assert.equal(await countAspects(parent), 1);
      assert.equal(await countAspects(child), 2);

      const result = txn.deleteElements([parent]);
      assertResult(result, success, [parent, child], [survivor]);
      assert.equal(await countAspects(parent), 0, "aspects of the deleted parent must be removed");
      assert.equal(await countAspects(child), 0, "aspects of the cascaded child must be removed");
      assert.equal(await countAspects(survivor), 1, "aspects of unrelated elements must be untouched");
      assert.isDefined(iModelDb.elements.getAspect(survivorAspect));
    });

    it("an element used as the Scope of another element's ExternalSourceAspect", () => {
      const scopeElem = insertElement();
      const owner = insertElement();
      const aspectId = insertAspect(owner, scopeElem);

      // Deleting both the scope element and the aspect owner is fine: the aspect goes away with its owner.
      const result = txn.deleteElements([scopeElem, owner]);
      assertResult(result, success, [scopeElem, owner], []);
      assert.throws(() => iModelDb.elements.getAspect(aspectId));
    });

    it("Aspects owned by cascaded sub-model members are removed", async () => {
      // Existing aspect tests only cover parent/child cascades; sub-model members reach the delete set through a different path.
      const partitionId = PhysicalModel.insert(txn, IModel.rootSubjectId, "AspectPartition");
      const insertMember = () => txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: partitionId, category: categoryId, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      const member1 = insertMember();
      const member2 = insertMember();
      insertAspect(member1);
      insertAspect(member2);
      insertAspect(member2);
      txn.saveChanges();
      assert.equal(await countAspects(member1), 1);
      assert.equal(await countAspects(member2), 2);

      const result = txn.deleteElements([partitionId]);
      assertResult(result, success, [partitionId, member1, member2], []);
      assert.equal(await countAspects(member1), 0, "aspects of cascaded sub-model member must be removed");
      assert.equal(await countAspects(member2), 0, "aspects of cascaded sub-model member must be removed");
    });

    describe("domain-schema navigation properties (no FK constraint)", () => {
      const navObjectClass = "DeleteElementsNavTest:NavObject";
      const navRelClass = "DeleteElementsNavTest:NavObjectRefersToElement";

      /** Insert a `NavObject` that optionally points at `targetId` through its (non-FK) `Target` navigation property. */
      const insertNavObject = (targetId?: Id64String, parentId?: Id64String): Id64String => {
        const id = txn.insertElement({
          classFullName: navObjectClass, model: modelId, category: categoryId, code: Code.createEmpty(),
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
          ...(targetId ? { target: { id: targetId, relClassName: navRelClass } } : {}),
          ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
        } as PhysicalElementProps);
        assert.isNotEmpty(id);
        txn.saveChanges();
        return id;
      };

      /** Returns the raw `Target.Id` stored for `navObjectId`, or `undefined` if the column is NULL. */
      const queryTargetId = async (navObjectId: Id64String): Promise<Id64String | undefined> => {
        const reader = iModelDb.createQueryReader("SELECT Target.Id FROM dent.NavObject WHERE ECInstanceId=?", new QueryBinder().bindId(1, navObjectId), { usePrimaryConn: true });
        assert.isTrue(await reader.step(), `NavObject ${navObjectId} must still exist`);
        const value = reader.current.toArray()[0];
        return value === undefined || value === null ? undefined : value;
      };

      it("the nav property is not FK-enforced, so the reference alone must not block the delete", async () => {
        const target = insertElement();
        const referrer = insertNavObject(target);
        assert.equal(await queryTargetId(referrer), target);

        // Sanity check the premise of this test suite: the domain nav property has no SQLite FK behind it.
        const fkColumns = iModelDb.withSqliteStatement("PRAGMA foreign_key_list(dent_NavObject)", (stmt) => {
          const cols: string[] = [];
          while (stmt.step() === DbResult.BE_SQLITE_ROW)
            cols.push(stmt.getValueString(3));
          return cols;
        });
        assert.notInclude(fkColumns, "TargetId", "domain-schema nav props must not be FK-enforced; otherwise this test exercises the wrong code path");

        const result = txn.deleteElements([target]);
        assertResult(result, success, [target], [referrer]);
      });

      it("nav property on a surviving element is set to NULL when its target is deleted", async () => {
        const target = insertElement();
        const referrer = insertNavObject(target);
        const unrelatedTarget = insertElement();
        const unrelatedReferrer = insertNavObject(unrelatedTarget);

        const result = txn.deleteElements([target]);
        assertResult(result, success, [target], [referrer, unrelatedTarget, unrelatedReferrer]);
        assert.isUndefined(await queryTargetId(referrer), "the dangling Target reference must be NULLed, not left pointing at a deleted element");
        assert.equal(await queryTargetId(unrelatedReferrer), unrelatedTarget, "references to elements outside the delete set must be untouched");

        // The surviving referrer must still be readable through the element API with the nav prop cleared.
        const props = iModelDb.elements.getElementProps<PhysicalElementProps & { target?: { id: Id64String } }>(referrer);
        assert.isTrue(props.target === undefined || props.target.id === undefined || !Id64.isValid(props.target.id), `expected cleared nav prop, got ${JSON.stringify(props.target)}`);
      });

      it("nav property pointing at a cascaded descendant is NULLed too", async () => {
        const parent = insertElement();
        const child = insertElement({ parentId: parent });
        const referrer = insertNavObject(child);

        const result = txn.deleteElements([parent]);
        assertResult(result, success, [parent, child], [referrer]);
        assert.isUndefined(await queryTargetId(referrer), "a reference to a cascaded child must be NULLed");
      });

      it("multiple referrers of the same target are all NULLed", async () => {
        const target = insertElement();
        const referrers = [insertNavObject(target), insertNavObject(target), insertNavObject(target)];

        const result = txn.deleteElements([target]);
        assertResult(result, success, [target], referrers);
        for (const referrer of referrers)
          assert.isUndefined(await queryTargetId(referrer));
      });

      it("referrer inside the delete set is simply deleted along with its target", async () => {
        const target = insertElement();
        const referrer = insertNavObject(target);
        const childReferrer = insertNavObject(target, target); // child of target, so cascaded into the set

        const result = txn.deleteElements([target, referrer]);
        assertResult(result, success, [target, referrer, childReferrer], []);
      });

      it("NULLing is rolled back when the txn is abandoned", async () => {
        const target = insertElement();
        const referrer = insertNavObject(target);

        const result = txn.deleteElements([target]);
        assertResult(result, success, [target], [referrer]);
        assert.isUndefined(await queryTargetId(referrer));

        txn.abandonChanges();
        assertExists(target);
        assert.equal(await queryTargetId(referrer), target, "abandoning the txn must restore the nav property");
      });
    });

    describe("ElementDrivesElement link table", () => {
      const countDrives = async (): Promise<number> => {
        const reader = iModelDb.createQueryReader("SELECT COUNT(*) FROM bis.ElementDrivesElement", undefined, { usePrimaryConn: true });
        assert.isTrue(await reader.step());
        return reader.current.toArray()[0];
      };

      const insertDrives = (sourceId: Id64String, targetId: Id64String): Id64String =>
        txn.insertRelationship({ classFullName: ElementDrivesElement.classFullName, sourceId, targetId, status: 0, priority: 0 } as ElementDrivesElementProps);

      it("deleting the source removes the row; the target survives", async () => {
        const a = insertElement();
        const b = insertElement();
        insertDrives(a, b);
        txn.saveChanges();
        assert.equal(await countDrives(), 1);

        const result = txn.deleteElements([a]);
        assertResult(result, success, [a], [b]);
        assert.equal(await countDrives(), 0, "ElementDrivesElement row referencing the deleted source must be removed");
      });

      it("deleting the target removes the row; the source survives", async () => {
        const a = insertElement();
        const b = insertElement();
        insertDrives(a, b);
        txn.saveChanges();
        assert.equal(await countDrives(), 1);

        const result = txn.deleteElements([b]);
        assertResult(result, success, [b], [a]);
        assert.equal(await countDrives(), 0, "ElementDrivesElement row referencing the deleted target must be removed");
      });
    });

    describe("ElementRefersToElements link table", () => {
      let groupModelId: Id64String;
      let groupCounter = 0;

      beforeEach(() => {
        const partitionId = txn.insertElement({
          classFullName: GroupInformationPartition.classFullName,
          model: IModel.repositoryModelId,
          parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
          code: GroupInformationPartition.createCode(iModelDb, IModel.rootSubjectId, `GroupPartition-${++groupCounter}`),
        });
        groupModelId = txn.insertModel({ classFullName: GroupModel.classFullName, modeledElement: { id: partitionId } });
        txn.saveChanges();
      });

      const insertGroup = (): Id64String => txn.insertElement({ classFullName: Group.classFullName, model: groupModelId, code: Code.createEmpty() });

      const countMemberships = async (groupId: Id64String): Promise<number> => {
        const reader = iModelDb.createQueryReader("SELECT COUNT(*) FROM bis.ElementGroupsMembers WHERE SourceECInstanceId=?", new QueryBinder().bindId(1, groupId), { usePrimaryConn: true });
        assert.isTrue(await reader.step());
        return reader.current.toArray()[0];
      };

      it("deleting a member removes only its membership row; the group and other members survive", async () => {
        const group = insertGroup();
        const member1 = insertElement();
        const member2 = insertElement();
        const rel1 = txn.insertRelationship(ElementGroupsMembers.create(iModelDb, group, member1, 0).toJSON());
        const rel2 = txn.insertRelationship(ElementGroupsMembers.create(iModelDb, group, member2, 1).toJSON());
        txn.saveChanges();
        assert.equal(await countMemberships(group), 2);

        const result = txn.deleteElements([member1]);
        assertResult(result, success, [member1], [group, member2]);
        assert.equal(await countMemberships(group), 1);
        assert.isUndefined(iModelDb.relationships.tryGetInstanceProps(ElementGroupsMembers.classFullName, rel1));
        assert.isDefined(iModelDb.relationships.tryGetInstanceProps(ElementGroupsMembers.classFullName, rel2));
      });

      it("deleting the group removes all of its membership rows; the members survive", async () => {
        const group = insertGroup();
        const member1 = insertElement();
        const member2 = insertElement();
        txn.insertRelationship(ElementGroupsMembers.create(iModelDb, group, member1, 0).toJSON());
        txn.insertRelationship(ElementGroupsMembers.create(iModelDb, group, member2, 1).toJSON());
        txn.saveChanges();

        const result = txn.deleteElements([group]);
        assertResult(result, success, [group], [member1, member2]);
        assert.equal(await countMemberships(group), 0);
      });

      it("deleting a parent whose cascaded child is a group member removes the membership row", () => {
        const group = insertGroup();
        const parent = insertElement();
        const child = insertElement({ parentId: parent });
        const rel = txn.insertRelationship(ElementGroupsMembers.create(iModelDb, group, child, 0).toJSON());
        txn.saveChanges();

        const result = txn.deleteElements([parent]);
        assertResult(result, success, [parent, child], [group]);
        assert.isUndefined(iModelDb.relationships.tryGetInstanceProps(ElementGroupsMembers.classFullName, rel));
      });
    });
  });

  describe("rejection with hierarchy", () => {
    it("reports the cascaded child violator (not the requested ancestor) and deletes nothing", () => {
      const rootA = insertElement();
      const childA = insertElement({ parentId: rootA });
      const external = insertElement({ codeScope: childA, codeValue: "ext" });
      const unrelated = insertElement();

      expectRejected("violator is a cascaded child", [rootA, unrelated], [rootA, childA, external, unrelated],
        new Set([childA]), codeScopeViolator(childA));
    });

    it("sub-model partition rejected by an element inside its sub-model", () => {
      const partitionId = PhysicalModel.insert(txn, IModel.rootSubjectId, "RejectedPartition");
      const inner = txn.insertElement({
        classFullName: "Generic:PhysicalObject",
        model: partitionId,
        category: categoryId,
        code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      txn.saveChanges();
      const external = insertElement({ codeScope: inner, codeValue: "ext" });

      expectRejected("violator is inside the sub-model", [partitionId], [partitionId, inner, external],
        new Set([inner]), codeScopeViolator(inner));
      assert.isDefined(iModelDb.models.tryGetModelProps(partitionId), "sub-model must survive a rejection");
    });
  });

  describe("undo / redo (StandaloneDb)", () => {
    let sdb: StandaloneDb;
    let sModelId: Id64String;
    let sCategoryId: Id64String;

    before(() => {
      sdb = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DeleteElements", "UndoRedo.bim"), {
        rootSubject: { name: "DeleteElementsUndo" },
        enableTransactions: true,
      });
      sdb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      withEditTxn(sdb, "setup", (t) => {
        sModelId = PhysicalModel.insert(t, IModel.rootSubjectId, "UndoModel");
        sCategoryId = SpatialCategory.insert(t, IModel.dictionaryId, "UndoCategory", new SubCategoryAppearance());
      });
    });

    after(() => {
      if (sdb?.isOpen)
        sdb.close();
    });

    const insertInStandalone = (t: EditTxn, parentId?: Id64String): Id64String => t.insertElement({
      classFullName: "Generic:PhysicalObject",
      model: sModelId,
      category: sCategoryId,
      code: Code.createEmpty(),
      placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      ...(parentId ? { parent: { id: parentId, relClassName: "BisCore:ElementOwnsChildElements" } } : {}),
    } as PhysicalElementProps);

    it("a bulk delete is recorded as a single undoable txn and can be reversed and reinstated", () => {
      const { parent, child, partition, inner, survivor } = withEditTxn(sdb, "insert", (t) => {
        const p = insertInStandalone(t);
        const c = insertInStandalone(t, p);
        const part = PhysicalModel.insert(t, IModel.rootSubjectId, "UndoPartition");
        const i = t.insertElement({
          classFullName: "Generic:PhysicalObject", model: part, category: sCategoryId, code: Code.createEmpty(),
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
        } as PhysicalElementProps);
        return { parent: p, child: c, partition: part, inner: i, survivor: insertInStandalone(t) };
      });

      withEditTxn(sdb, "bulk delete", (t) => {
        const result = t.deleteElements([parent, partition]);
        assert.equal(result.status, BulkDeleteElementsStatus.Success);
        assert.isEmpty(result.failures);
      });
      assertNoFkViolations(sdb);
      for (const id of [parent, child, partition, inner])
        assert.isUndefined(sdb.elements.tryGetElement(id));
      assert.isUndefined(sdb.models.tryGetModelProps(partition));
      assert.isDefined(sdb.elements.tryGetElement(survivor));

      // Undo: everything the bulk delete removed (requested, cascaded children, sub-model + contents) comes back in one step.
      assert.isTrue(sdb.txns.isUndoPossible);
      assert.equal(sdb.txns.reverseSingleTxn(), IModelStatus.Success);
      for (const id of [parent, child, partition, inner, survivor])
        assert.isDefined(sdb.elements.tryGetElement(id), `${id} must be restored by undo`);
      assert.isDefined(sdb.models.tryGetModelProps(partition), "sub-model must be restored by undo");
      assertNoFkViolations(sdb);

      // Redo: deleted again.
      assert.isTrue(sdb.txns.isRedoPossible);
      assert.equal(sdb.txns.reinstateTxn(), IModelStatus.Success);
      for (const id of [parent, child, partition, inner])
        assert.isUndefined(sdb.elements.tryGetElement(id), `${id} must be deleted again by redo`);
      assert.isUndefined(sdb.models.tryGetModelProps(partition));
      assert.isDefined(sdb.elements.tryGetElement(survivor));
      assertNoFkViolations(sdb);
    });

    it("a rejected (ConstraintViolation) delete records nothing to undo", () => {
      const { rootA, external, rootB } = withEditTxn(sdb, "insert", (t) => {
        const a = insertInStandalone(t);
        const specId = sdb.codeSpecs.insert(t, "UndoScopeSpec", CodeScopeSpec.Type.RelatedElement);
        const ext = t.insertElement({
          classFullName: "Generic:PhysicalObject", model: sModelId, category: sCategoryId,
          code: { spec: specId, scope: a, value: "ext" },
          placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
        } as PhysicalElementProps);
        return { rootA: a, external: ext, rootB: insertInStandalone(t) };
      });

      withEditTxn(sdb, "rejected delete", (t) => {
        const result = t.deleteElements([rootA, rootB]);
        assert.equal(result.status, BulkDeleteElementsStatus.ConstraintViolation);
        assert.isFalse(sdb[_nativeDb].hasUnsavedChanges(), "a rejected delete must not dirty the txn");
      });
      for (const id of [rootA, external, rootB])
        assert.isDefined(sdb.elements.tryGetElement(id));
      assertNoFkViolations(sdb);

      // The only undoable txn is the insert above; undoing it must remove all three, proving the rejected delete left no txn behind.
      assert.isTrue(sdb.txns.isUndoPossible);
      assert.equal(sdb.txns.reverseSingleTxn(), IModelStatus.Success);
      for (const id of [rootA, external, rootB])
        assert.isUndefined(sdb.elements.tryGetElement(id), `${id} must be removed by undoing the insert txn`);

      assert.equal(sdb.txns.reinstateTxn(), IModelStatus.Success);
      for (const id of [rootA, external, rootB])
        assert.isDefined(sdb.elements.tryGetElement(id));
    });
  });

  describe("robustness / negative path tests", () => {
    it("deleting the root Subject does not delete anything", () => {
      // The root Subject is the modeled element of the RepositoryModel, which in turn contains the root Subject: a cycle in
      // the expansion graph. The call must terminate; it must never remove the root of the iModel.
      const sentinel = insertElement();
      const result = txn.deleteElements([IModel.rootSubjectId]);
      assert.notEqual(result.status, BulkDeleteElementsStatus.Success, "root Subject must not be deletable");
      assert.notEqual(result.status, BulkDeleteElementsStatus.DeletionFailed, "root Subject delete must be rejected by validation, not by a SQLite error");
      assertExists(IModel.rootSubjectId, "root Subject must survive");
      assert.isDefined(iModelDb.models.tryGetModelProps(IModel.repositoryModelId), "RepositoryModel must survive");
      assert.isDefined(iModelDb.models.tryGetModelProps(IModel.dictionaryId), "DictionaryModel must survive");
      assertExists(modelId, "seed partition must survive");
      assertExists(categoryId, "seed category must survive");
      assertExists(sentinel, "unrelated element must survive");
      assertNoFkViolations(iModelDb);
    });

    it("plain element, parent tree, partition, in-use category and unused material in one call", () => {
      const plainElem = insertElement();
      const parent = insertElement();
      const child1 = insertElement({ parentId: parent });
      const child2 = insertElement({ parentId: parent });
      const partition = PhysicalModel.insert(txn, IModel.rootSubjectId, "TestPartition");
      const inner = txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: partition, category: categoryId, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      const violatorCat = SpatialCategory.insert(txn, IModel.dictionaryId, "TestCategory2", new SubCategoryAppearance());
      const violatorSub = IModel.getDefaultSubCategoryId(violatorCat);
      const externalUser = txn.insertElement({
        classFullName: "Generic:PhysicalObject", model: modelId, category: violatorCat, code: Code.createEmpty(),
        placement: { origin: [0, 0, 0], angles: { yaw: 0, pitch: 0, roll: 0 } },
      } as PhysicalElementProps);
      const unusedMat = RenderMaterialElement.insert(txn, IModel.dictionaryId, "TestMaterial", { paletteName: "p" });
      txn.saveChanges();

      // One in-use category rejects the whole call: the plain element, the tree, the partition and the unused material all survive.
      expectRejected("test rejection with FK violators",
        [plainElem, parent, partition, violatorCat, unusedMat],
        [plainElem, parent, child1, child2, partition, inner, unusedMat, violatorCat, violatorSub, externalUser],
        new Set([violatorCat]), categoryInUse3d(violatorCat));
      assert.isDefined(iModelDb.models.tryGetModelProps(partition), "partition sub-model must be untouched");

      // Without the violator everything else goes in one call.
      executeTestCase("success without violators",
        [plainElem, parent, partition, unusedMat],
        [plainElem, parent, child1, child2, partition, inner, unusedMat],
        [violatorCat, violatorSub, externalUser]);
    });
  });
});