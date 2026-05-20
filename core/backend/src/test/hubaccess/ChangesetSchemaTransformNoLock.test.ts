/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Multi-user tests for TxnManager concurrent schema import (useConcurrentSchemaImport).
 *
 * These tests verify that when two briefcase users (far and local) operate concurrently
 * without pessimistic locking, schema changes and data changes interleave correctly under
 * the native concurrent-schema-import rebase mode.
 *
 * useConcurrentSchemaImport uses nativeDb.setAllowConcurrentSchemaImport(true) before
 * rebaser.resume(), which calls pullMergeRebaseReinstateTxn() for every local txn.
 * Schema txns are reinstated by replaying the binary DDL changeset with concurrent-import
 * enabled (the native layer can re-import schemas even if a newer schema already exists).
 * Data txns are reinstated by replaying the binary changeset unchanged.
 *
 * IMPORTANT CONSTRAINT: column-swap (transforming) schemas cannot be used in local pending
 * changes with this mode — the binary DATA replay does not remap column positions after a
 * column swap.  That requires useSemanticRebase.  These tests therefore use ADDITIVE-only
 * schemas (add new properties, no column remapping) for all pending-local-change scenarios.
 *
 * Scenarios covered:
 *   1. Additive schema pushed by far while local has a pending UPDATE — value preserved.
 *   2. Two sequential additive schemas pushed by far while local has pending UPDATEs
 *      for both C and D — all values preserved after pull.
 *   3. TxnManager squash (SaveSchemaAndDataTxns) — a transforming schema import
 *      (column swap) squashes DDL + data-migration into a single Schema-type txn.
 *      No rebase involved; tests the import-time squash only.
 *   4. Additive schema change without local data — incoming additive schema applied,
 *      local INSERTs unaffected (no transform needed).
 *   5. Local additive schema change reinstated over incoming data — local imports
 *      v01.00.02 (additive), far pushes a data change, after pull the local schema
 *      is reinstated at v01.00.02 and far's data is accessible.
 *
 * All briefcases are opened with noLock: true so no lock-acquisition calls are made.
 * Requires useConcurrentSchemaImport: true (backend restarted in before/after hooks).
 */

import * as chai from "chai";
import { Guid, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import { Code, ElementProps, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { _nativeDb, BriefcaseDb, ChannelControl, DrawingCategory } from "../../core-backend";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { HubMock } from "../../internal/HubMock";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { TestUtils } from "../TestUtils";

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------
const schemas = {
  /**
   * Base schema v01.00.00.
   * Class hierarchy (all mapped TablePerHierarchy by BisCore default):
   *   A (PropA)
   *   └─ C (PropC)
   *   └─ D (PropD)
   */
  v01x00x00: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.00"
              xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /**
   * v01.00.01 — additive change: adds PropC2 to class C.
   * No column remapping; PropC stays in the same physical column.
   */
  v01x00x01AddPropC2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01"
              xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /**
   * v01.00.02 — additive change: adds PropD2 to class D (builds on v01.00.01).
   * No column remapping; existing PropC / PropD columns are unaffected.
   * Used in tests 2 and 5 to provide a second additive schema layer.
   */
  v01x00x02AddPropD2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02"
              xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /**
   * v01.00.02 — TRANSFORMING change: moves PropC from class C up to base class A.
   * Used ONLY in test 3 (schema-squash check) where no rebase is involved.
   * Applies on top of v01.00.01AddPropC2 (PropC2 stays on C).
   */
  v01x00x02MovePropCToA: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02"
              xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,
};

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

/** Helper: insert a drawing element of the given EC class with extra properties. */
function insertElement(
  txn: EditTxn,
  className: string,
  drawingModelId: Id64String,
  drawingCategoryId: Id64String,
  properties: Record<string, unknown>
): Id64String {
  const elementProps: GeometricElementProps = {
    classFullName: className,
    model: drawingModelId,
    category: drawingCategoryId,
    code: Code.createEmpty(),
    ...properties,
  };
  const element = (txn.iModel as BriefcaseDb).elements.createElement(elementProps);
  return txn.insertElement(element.toJSON());
}

/** Helper: update properties on an existing element within an active EditTxn. */
function updateElement(txn: EditTxn, db: BriefcaseDb, elementId: Id64String, properties: Record<string, unknown>): void {
  const current = db.elements.getElementProps(elementId);
  txn.updateElement({ ...current, ...properties } as ElementProps);
}

/** Helper: read a named property value from an element via getElementProps. */
function getElementProp(db: BriefcaseDb, elementId: Id64String, propName: string): unknown {
  return (db.elements.getElementProps(elementId) as unknown as Record<string, unknown>)[propName];
}

/** Helper: assert that an element exists and has the expected property value. */
function assertElementProp(
  db: BriefcaseDb,
  elementId: Id64String,
  propName: string,
  expected: unknown,
  message?: string
): void {
  const el = db.elements.tryGetElement(elementId);
  chai.assert.isDefined(el, `element ${elementId} should exist`);
  const actual = getElementProp(db, elementId, propName);
  chai.expect(actual).to.equal(
    expected,
    message ?? `${propName} on element ${elementId} should equal "${String(expected)}"`
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.only("TxnManager — concurrent schema import, two briefcases, no lock", function () {
  // Schema changes + rebase can be slow in debug builds.
  this.timeout(120_000);

  // State shared within each test (re-created per test via beforeEach / afterEach).
  let far: BriefcaseDb;
  let local: BriefcaseDb;
  let iModelId: string;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;

  before(async () => {
    // Start HubMock once for the suite; a unique folder keeps tests isolated.
    HubMock.startup("ChangesetSchemaTransformNoLock", KnownTestLocations.outputDir);
    // useConcurrentSchemaImport enables the native-level concurrent schema import mode
    // so that schema transactions are reinstated via nativeDb.pullMergeRebaseReinstateTxn()
    // with setAllowConcurrentSchemaImport(true), rather than the semantic-rebase folder mechanism.
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useConcurrentSchemaImport: true });
  });

  after(async () => {
    HubMock.shutdown();
    await TestUtils.shutdownBackend();
    // Restore the normal backend so later test suites in the same run are unaffected.
    await TestUtils.startBackend();
  });

  /**
   * Per-test setup: create a fresh iModel, import the base schema, create a
   * drawing model and category, push everything, then open a second (local)
   * briefcase that is fully synced.  Both briefcases use noLock: true.
   */
  beforeEach(async () => {
    iModelId = await HubWrappers.createIModel("far-user", HubMock.iTwinId, `SchemaTransform-${Guid.createValue()}`);

    // Open far briefcase (no pessimistic locking).
    far = await HubWrappers.downloadAndOpenBriefcase({
      accessToken: "far-user",
      iTwinId: HubMock.iTwinId,
      iModelId,
      noLock: true,
    });
    far.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Import base schema and bootstrap model + category from the far briefcase.
    await far.importSchemaStrings([schemas.v01x00x00]);

    [drawingModelId, drawingCategoryId] = withEditTxn(far, "create model and category", (txn) => {
      const modelCode = IModelTestUtils.getUniqueModelCode(far, "DrawingModel");
      const [, newDrawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
      const newDrawingCategoryId = DrawingCategory.insert(
        txn,
        IModel.dictionaryId,
        "DrawingCategory",
        new SubCategoryAppearance()
      );
      return [newDrawingModelId, newDrawingCategoryId] as const;
    });

    await far.pushChanges({ description: "base schema + model + category", accessToken: "far-user" });

    // Open local briefcase (no pessimistic locking) — already synced.
    local = await HubWrappers.downloadAndOpenBriefcase({
      accessToken: "local-user",
      iTwinId: HubMock.iTwinId,
      iModelId,
      noLock: true,
    });
    local.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  afterEach(async () => {
    if (local?.isOpen) {
      // Abandon any unsaved changes left by a failing test before close.
      // (ImplicitWriteTxn.onClose() would otherwise try to save them and throw
      //  because implicitWriteEnforcement is set to "throw".)
      local[_nativeDb].abandonChanges();
      local.close();
    }
    if (far?.isOpen) {
      far[_nativeDb].abandonChanges();
      far.close();
    }
    if (iModelId) {
      await HubMock.deleteIModel({ accessToken: "far-user", iTwinId: HubMock.iTwinId, iModelId });
      iModelId = "";
    }
  });

  // -------------------------------------------------------------------------
  // Test 1 — Additive schema arrives while local UPDATE is pending
  //
  // useConcurrentSchemaImport uses pullMergeRebaseReinstateTxn() for data txns,
  // which replays the binary changeset unchanged.  For ADDITIVE schemas (no column
  // remapping) the binary correctly applies in the new schema state because the
  // physical column positions are unchanged.
  //
  // Workflow:
  //   far  : inserts a C element (propC="initial_c") → pushes
  //   both : sync
  //   local: updates propC = "local_c_value" (pending, not pushed)
  //   far  : imports v01.00.01AddPropC2 (additive) → pushes
  //   local: pulls → rebase: reverse UPDATE, apply schema, reinstate UPDATE
  //   Both : verify propC = "local_c_value"; schema = v01.00.01
  // -------------------------------------------------------------------------
  it("additive schema arrives while local update pending: value preserved after pull", async () => {
    // Far: seed the iModel with a C element so local can issue an UPDATE.
    const elementId = withEditTxn(far, "insert C element", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "initial_a",
        propC: "initial_c",
      })
    );
    await far.pushChanges({ description: "far: seed C element", accessToken: "far-user" });
    await local.pullChanges({ accessToken: "local-user" });

    // Local: update propC (pending, not pushed).
    withEditTxn(local, "update propC", (txn) =>
      updateElement(txn, local, elementId, { propC: "local_c_value" })
    );
    local.clearCaches();
    assertElementProp(local, elementId, "propC", "local_c_value",
      "propC should be readable locally before the incoming schema");

    // Far: push additive schema (adds PropC2 — no column remapping).
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    await far.pushChanges({ description: "schema v01.00.01 — add PropC2", accessToken: "far-user" });

    // Local: pull — binary replay of the UPDATE changeset should correctly set propC
    // in the same physical column (unchanged by the additive schema).
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    chai.expect(local.getSchemaProps("TestDomain").version).to.equal("01.00.01",
      "local schema should be updated to v01.00.01 after pull");
    assertElementProp(local, elementId, "propC", "local_c_value",
      "propC value must survive the additive-schema rebase");

    // Local: push the rebased changeset so far can verify it.
    await local.pushChanges({ description: "local update after rebase", accessToken: "local-user" });
    await far.pullChanges({ accessToken: "far-user" });
    far.clearCaches();
    assertElementProp(far, elementId, "propC", "local_c_value",
      "far briefcase should read the same propC value after pulling the rebased changeset");
  });

  // -------------------------------------------------------------------------
  // Test 2 — Two sequential additive schemas pushed while local UPDATEs pending
  //
  // Far pushes two separate additive schema changesets (v01.00.01 and v01.00.02)
  // while local has unpushed UPDATEs to PropC and PropD.  No column remapping
  // occurs, so the binary replay reinstates both UPDATEs correctly.
  //
  // Workflow:
  //   far  : inserts C element (propC) and D element (propD) → pushes
  //   both : sync
  //   local: updates C.propC and D.propD locally (pending)
  //   far  : imports v01.00.01AddPropC2 → pushes
  //   far  : imports v01.00.02AddPropD2 → pushes
  //   local: pulls → two additive schemas applied, both UPDATEs reinstated
  //   Both : verify propC and propD values preserved
  // -------------------------------------------------------------------------
  it("two sequential additive schemas: both pending updates preserved after pull", async () => {
    // Far: seed C and D elements.
    const cId = withEditTxn(far, "insert C", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "c_a_initial",
        propC: "c_initial",
      })
    );
    const dId = withEditTxn(far, "insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "d_a_initial",
        propD: "d_initial",
      })
    );
    await far.pushChanges({ description: "far: seed C and D elements", accessToken: "far-user" });
    await local.pullChanges({ accessToken: "local-user" });

    // Local: update both properties (pending, not pushed).
    withEditTxn(local, "update C propC", (txn) =>
      updateElement(txn, local, cId, { propC: "c_prop_value" })
    );
    withEditTxn(local, "update D propD", (txn) =>
      updateElement(txn, local, dId, { propD: "d_prop_value" })
    );
    assertElementProp(local, cId, "propC", "c_prop_value");
    assertElementProp(local, dId, "propD", "d_prop_value");

    // Far: push two sequential additive schemas.
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    await far.pushChanges({ description: "schema v01.00.01 — add PropC2", accessToken: "far-user" });
    await far.importSchemaStrings([schemas.v01x00x02AddPropD2]);
    await far.pushChanges({ description: "schema v01.00.02 — add PropD2", accessToken: "far-user" });

    // Local: pull — both additive schemas applied, then UPDATEs reinstated.
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    chai.expect(local.getSchemaProps("TestDomain").version).to.equal("01.00.02",
      "schema should be updated to v01.00.02 after pull");
    assertElementProp(local, cId, "propC", "c_prop_value",
      "propC should survive two sequential additive schema changes");
    assertElementProp(local, dId, "propD", "d_prop_value",
      "propD should survive two sequential additive schema changes");
  });

  // -------------------------------------------------------------------------
  // Test 3 — TxnManager squash: SaveSchemaAndDataTxns
  //
  // When a schema import also causes a data-migration transaction (because the
  // RemapManager moves existing data to new column positions), the native
  // SaveSchemaAndDataTxns method squashes both transactions into a single
  // Schema-type txn.  This is the key change in TxnManager.cpp from commit
  // 1e051a9a6b (Semantic rebase support).
  //
  // We verify the squash observable via getTxnProps / getLastSavedTxnProps.
  // -------------------------------------------------------------------------
  it("schema import with data migration is squashed into a single Schema txn by TxnManager", async () => {
    // Insert some data so the subsequent schema change has rows to migrate.
    withEditTxn(far, "pre-migration data", (txn) => {
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "migrate_a",
        propC: "migrate_c",
      });
    });

    // Import the additive schema first (so we have PropC2 on C).
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);

    // Import the transforming schema (moves PropC → A; triggers data migration).
    await far.importSchemaStrings([schemas.v01x00x02MovePropCToA]);

    // After the transforming import, the last saved txn must be of type "Schema".
    // TxnManager.SaveSchemaAndDataTxns squashes the DDL schema txn and the data
    // migration txn into one Schema-type entry in the txns table.
    const lastTxnProps = far.txns.getLastSavedTxnProps();
    chai.assert.isDefined(lastTxnProps,
      "there should be a saved txn after the transforming schema import");
    chai.assert.strictEqual(lastTxnProps?.type, "Schema",
      "schema + data-migration changes must be squashed into a single Schema txn");
  });

  // -------------------------------------------------------------------------
  // Test 4 — Additive schema change (no transform needed)
  //
  // When far pushes a purely additive schema change (new property added, no
  // column remapping), local's pending changesets should not need transformation.
  // Data must be unaffected after the pull.
  // -------------------------------------------------------------------------
  it("additive schema change (no transform): local data unaffected after pull", async () => {
    // Local inserts C and D elements.
    const cId = withEditTxn(local, "insert C", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "a_val",
        propC: "c_val",
      })
    );
    const dId = withEditTxn(local, "insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "a2_val",
        propD: "d_val",
      })
    );

    // Far pushes a purely additive schema (adds PropC2 — no column swap).
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    await far.pushChanges({ description: "additive schema: add PropC2", accessToken: "far-user" });

    // Local pulls — no transformation should be needed.
    await local.pullChanges({ accessToken: "local-user" });

    chai.expect(local.getSchemaProps("TestDomain").version).to.equal("01.00.01",
      "local schema should update to v01.00.01");

    // Values must be unaffected.
    assertElementProp(local, cId, "propC", "c_val",
      "propC unchanged after additive schema pull");
    assertElementProp(local, dId, "propD", "d_val",
      "propD unchanged after additive schema pull");
  });

  // -------------------------------------------------------------------------
  // Test 5 — Local additive schema change reinstated over incoming remote data
  //
  // With useConcurrentSchemaImport, pullMergeRebaseReinstateTxn() can re-import
  // an ADDITIVE schema txn (DDL binary replay just adds a column; no column-swap
  // migration needed).  This verifies the full local-schema reinstatement path.
  //
  // Workflow:
  //   far  : imports v01.00.01AddPropC2 → inserts C element (propC="far_c1") → pushes
  //   both : sync to v01.00.01
  //   far  : inserts a second C element (propC="far_c2_data") → pushes (data only)
  //   local: imports v01.00.02AddPropD2 locally (additive, NOT pushed)
  //   local: pulls far's data → rebase: reverse v01.00.02, apply far's data,
  //            reinstate v01.00.02 via concurrent import
  //   Both : verify schema = v01.00.02, far's elements have correct propC
  // -------------------------------------------------------------------------
  it("local additive schema reinstated over incoming remote data: schema version preserved", async () => {
    // Far: import v01.00.01, insert first C element, push.
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    const farId1 = withEditTxn(far, "far insert 1", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a1",
        propC: "far_c1",
        propC2: "far_c2_1",
      })
    );
    await far.pushChanges({ description: "far: v01.00.01 + first element", accessToken: "far-user" });

    // Both sync to v01.00.01.
    await local.pullChanges({ accessToken: "local-user" });

    // Far: insert a second element while local is about to import a local schema.
    const farId2 = withEditTxn(far, "far insert 2", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a2",
        propC: "far_c2_data",
        propC2: "far_c2_2",
      })
    );
    await far.pushChanges({ description: "far: second C element", accessToken: "far-user" });

    // Local: import v01.00.02AddPropD2 (additive — adds PropD2 to D).
    // With useConcurrentSchemaImport, this schema txn will be reinstated via
    // pullMergeRebaseReinstateTxn() after far's data changeset is applied.
    await local.importSchemaStrings([schemas.v01x00x02AddPropD2]);

    const localSchemaTxn = local.txns.getLastSavedTxnProps();
    chai.assert.isDefined(localSchemaTxn, "local should have a schema txn after import");
    chai.assert.strictEqual(localSchemaTxn?.type, "Schema",
      "local schema import should produce a Schema txn");

    // Local: pull far's second INSERT (data changeset recorded against v01.00.01).
    // The rebase reverses the local schema import, applies far's data, then
    // reinstates the schema import via concurrent import (adds PropD2 back to D).
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    chai.expect(local.getSchemaProps("TestDomain").version).to.equal("01.00.02",
      "local schema should be v01.00.02 after pull (local schema txn reinstated)");

    // Far's elements should be readable with correct propC (column unchanged).
    assertElementProp(local, farId1, "propC", "far_c1",
      "far element 1 propC must be readable after local schema reinstatement");
    assertElementProp(local, farId2, "propC", "far_c2_data",
      "far element 2 propC must be readable after reinstatement");
  });

  // -------------------------------------------------------------------------
  // Test 6 — Pure data merge: far pushes data, local has pending data inserts
  //
  // No schema changes involved.  Both users work at the same base schema
  // version.  Far inserts and pushes an element; local has a pending insert
  // (not pushed).  After local pulls, both elements should exist.
  //
  // Workflow:
  //   far  : inserts C element (propC="far_c") → pushes
  //   local: inserts D element (propD="local_d") — pending, not pushed
  //   local: pulls → rebase: reverse local INSERT, apply far INSERT,
  //            reinstate local INSERT
  //   Both : verify both elements exist with correct property values
  // -------------------------------------------------------------------------
  it("pure data merge: far pushes data, local pending inserts preserved after pull", async () => {
    // Far: insert and push a C element.
    const farCId = withEditTxn(far, "far insert C", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a",
        propC: "far_c",
      })
    );
    await far.pushChanges({ description: "far: insert C element", accessToken: "far-user" });

    // Local: insert a D element (pending, not pushed).
    const localDId = withEditTxn(local, "local insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a",
        propD: "local_d",
      })
    );

    // Local: pull far's changeset — rebase reinstates the local INSERT.
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    assertElementProp(local, farCId, "propC", "far_c",
      "far C element should be visible on local after pull");
    assertElementProp(local, localDId, "propD", "local_d",
      "local D element should survive rebase after pull");

    // Local: push the rebased changeset and verify on far.
    await local.pushChanges({ description: "local insert after rebase", accessToken: "local-user" });
    await far.pullChanges({ accessToken: "far-user" });
    far.clearCaches();

    assertElementProp(far, farCId, "propC", "far_c",
      "far C element intact after round-trip");
    assertElementProp(far, localDId, "propD", "local_d",
      "local D element visible on far after round-trip");
  });

  // -------------------------------------------------------------------------
  // Test 7 — Far pushes data updates, local has pending updates on different
  // elements
  //
  // Both users sync to a baseline with two elements (C and D).  Far updates
  // the C element and pushes.  Local updates the D element (pending).  After
  // local pulls, both updates should be visible.
  //
  // Workflow:
  //   far  : inserts C and D elements → pushes
  //   both : sync
  //   far  : updates C.propC = "far_updated_c" → pushes
  //   local: updates D.propD = "local_updated_d" — pending
  //   local: pulls → rebase reinstates the local UPDATE on D
  //   Both : verify C.propC="far_updated_c", D.propD="local_updated_d"
  // -------------------------------------------------------------------------
  it("far pushes data updates, local has pending updates on different elements", async () => {
    // Far: seed both C and D elements.
    const cId = withEditTxn(far, "insert C", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "c_a_initial",
        propC: "c_initial",
      })
    );
    const dId = withEditTxn(far, "insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "d_a_initial",
        propD: "d_initial",
      })
    );
    await far.pushChanges({ description: "far: seed C and D", accessToken: "far-user" });
    await local.pullChanges({ accessToken: "local-user" });

    // Far: update C and push.
    withEditTxn(far, "far update C", (txn) =>
      updateElement(txn, far, cId, { propC: "far_updated_c" })
    );
    await far.pushChanges({ description: "far: update C.propC", accessToken: "far-user" });

    // Local: update D (pending, not pushed).
    withEditTxn(local, "local update D", (txn) =>
      updateElement(txn, local, dId, { propD: "local_updated_d" })
    );

    // Local: pull — far's C update applied, local D update reinstated.
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    assertElementProp(local, cId, "propC", "far_updated_c",
      "far update to C.propC should be visible on local");
    assertElementProp(local, dId, "propD", "local_updated_d",
      "local update to D.propD should survive rebase");

    // Round-trip: local pushes, far pulls and verifies.
    await local.pushChanges({ description: "local update after rebase", accessToken: "local-user" });
    await far.pullChanges({ accessToken: "far-user" });
    far.clearCaches();

    assertElementProp(far, cId, "propC", "far_updated_c",
      "far C.propC intact after round-trip");
    assertElementProp(far, dId, "propD", "local_updated_d",
      "local D.propD visible on far after round-trip");
  });

  // -------------------------------------------------------------------------
  // Test 8 — Far pushes schema + data in same push, local has pending inserts
  //
  // Far imports an additive schema AND inserts a new element using the new
  // schema property, all in a single push.  Meanwhile local has a pending
  // INSERT using only base-schema properties.  After pull, local should see
  // the new schema, far's element, and local's element.
  //
  // Workflow:
  //   local: inserts D element (propD="local_d") — pending, not pushed
  //   far  : imports v01.00.01 + inserts C with PropC2="far_c2" → pushes
  //   local: pulls → schema applied, far's data applied, local INSERT reinstated
  //   Both : verify schema=v01.00.01, far's C.propC2="far_c2", local D.propD="local_d"
  // -------------------------------------------------------------------------
  it("far pushes schema + data together: local pending inserts preserved", async () => {
    // Local: pending INSERT (base schema only).
    const localDId = withEditTxn(local, "local insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a",
        propD: "local_d",
      })
    );

    // Far: import additive schema + insert element using new prop, then push.
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    const farCId = withEditTxn(far, "far insert C with PropC2", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a",
        propC: "far_c",
        propC2: "far_c2",
      })
    );
    await far.pushChanges({ description: "far: schema v01.00.01 + C element", accessToken: "far-user" });

    // Local: pull — additive schema applied, far data applied, local INSERT reinstated.
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    chai.expect(local.getSchemaProps("TestDomain").version).to.equal("01.00.01",
      "local schema should be v01.00.01 after pull");
    assertElementProp(local, farCId, "propC2", "far_c2",
      "far C element with new schema prop should be visible on local");
    assertElementProp(local, localDId, "propD", "local_d",
      "local D element should survive rebase with schema + data from far");
  });

  // -------------------------------------------------------------------------
  // Test 9 — Far pushes multiple data changesets while local has pending changes
  //
  // Far pushes three sequential data changesets.  Local has a pending INSERT.
  // After pull, local should see all far elements and its own pending INSERT.
  //
  // Workflow:
  //   far  : inserts C1 → pushes; inserts C2 → pushes; inserts C3 → pushes
  //   local: inserts D1 — pending
  //   local: pulls all 3 changesets → rebase reinstates local INSERT
  //   Both : verify all 4 elements exist with correct values
  // -------------------------------------------------------------------------
  it("far pushes multiple data changesets: local pending insert preserved after multi-pull", async () => {
    // Local: pending insert.
    const localDId = withEditTxn(local, "local insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a",
        propD: "local_d",
      })
    );

    // Far: push three sequential data changesets.
    const farCId1 = withEditTxn(far, "far insert C1", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a1",
        propC: "far_c1",
      })
    );
    await far.pushChanges({ description: "far: insert C1", accessToken: "far-user" });

    const farCId2 = withEditTxn(far, "far insert C2", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a2",
        propC: "far_c2",
      })
    );
    await far.pushChanges({ description: "far: insert C2", accessToken: "far-user" });

    const farCId3 = withEditTxn(far, "far insert C3", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a3",
        propC: "far_c3",
      })
    );
    await far.pushChanges({ description: "far: insert C3", accessToken: "far-user" });

    // Local: pull all three changesets at once — rebase reinstates local INSERT.
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    assertElementProp(local, farCId1, "propC", "far_c1",
      "far C1 should be visible on local");
    assertElementProp(local, farCId2, "propC", "far_c2",
      "far C2 should be visible on local");
    assertElementProp(local, farCId3, "propC", "far_c3",
      "far C3 should be visible on local");
    assertElementProp(local, localDId, "propD", "local_d",
      "local D should survive rebase across 3 far changesets");
  });

  // -------------------------------------------------------------------------
  // Test 10 — Multiple local pending txns rebased against multiple remote changesets
  //
  // Local has two separate pending data txns (two elements inserted in
  // separate saveChanges calls).  Far pushes two sequential data changesets.
  // After local pushes (triggering rebase), all four elements must exist.
  //
  // Workflow:
  //   far  : inserts C1 → pushes
  //   local: inserts D1 → saveChanges (txn 1); inserts D2 → saveChanges (txn 2)
  //   far  : inserts C2 → pushes (second changeset)
  //   local: pushes → rebase: reverse txn 2, reverse txn 1, apply far C1, apply far C2,
  //            reinstate txn 1, reinstate txn 2
  //   Both : verify all 4 elements
  // -------------------------------------------------------------------------
  it("multiple local pending txns rebased against multiple remote changesets", async () => {
    // Far: push first changeset.
    const farC1Id = withEditTxn(far, "far insert C1", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a1",
        propC: "far_c1",
      })
    );
    await far.pushChanges({ description: "far: insert C1", accessToken: "far-user" });

    // Local: two pending txns (inserted as separate saveChanges calls).
    const localD1Id = withEditTxn(local, "local insert D1", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a1",
        propD: "local_d1",
      })
    );
    const localD2Id = withEditTxn(local, "local insert D2", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a2",
        propD: "local_d2",
      })
    );

    // Far: push second changeset.
    const farC2Id = withEditTxn(far, "far insert C2", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a2",
        propC: "far_c2",
      })
    );
    await far.pushChanges({ description: "far: insert C2", accessToken: "far-user" });

    // Local: push — triggers rebase against both far changesets.
    await local.pushChanges({ description: "local: D1 + D2 after rebase", accessToken: "local-user" });
    local.clearCaches();

    assertElementProp(local, farC1Id, "propC", "far_c1",
      "far C1 should be visible on local after rebase");
    assertElementProp(local, farC2Id, "propC", "far_c2",
      "far C2 should be visible on local after rebase");
    assertElementProp(local, localD1Id, "propD", "local_d1",
      "local D1 should survive rebase (first pending txn)");
    assertElementProp(local, localD2Id, "propD", "local_d2",
      "local D2 should survive rebase (second pending txn)");

    // Far: pull and verify all 4 elements.
    await far.pullChanges({ accessToken: "far-user" });
    far.clearCaches();

    assertElementProp(far, farC1Id, "propC", "far_c1",
      "far C1 intact after round-trip");
    assertElementProp(far, farC2Id, "propC", "far_c2",
      "far C2 intact after round-trip");
    assertElementProp(far, localD1Id, "propD", "local_d1",
      "local D1 visible on far after round-trip");
    assertElementProp(far, localD2Id, "propD", "local_d2",
      "local D2 visible on far after round-trip");
  });

  // -------------------------------------------------------------------------
  // Test 11 — Far pushes additive schema, local has both pending INSERT and UPDATE
  //
  // Both users sync to a baseline with one C element.  Far pushes an additive
  // schema.  Local has BOTH a pending UPDATE on the existing element AND a
  // pending INSERT of a new element.  Both pending changes should survive the
  // additive-schema rebase.
  //
  // Workflow:
  //   far  : inserts C element (propC="initial_c") → pushes
  //   both : sync
  //   local: updates C.propC = "updated_c" + inserts D element — both pending
  //   far  : imports v01.00.01 additive → pushes
  //   local: pulls → rebase reinstates both the UPDATE and the INSERT
  //   Both : verify schema=v01.00.01; C.propC="updated_c"; D exists
  // -------------------------------------------------------------------------
  it("far pushes additive schema, local has both pending insert and update: all preserved", async () => {
    // Far: seed a C element.
    const cId = withEditTxn(far, "insert C", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "initial_a",
        propC: "initial_c",
      })
    );
    await far.pushChanges({ description: "far: seed C element", accessToken: "far-user" });
    await local.pullChanges({ accessToken: "local-user" });

    // Local: update existing C element AND insert a new D element (both pending).
    withEditTxn(local, "local update C", (txn) =>
      updateElement(txn, local, cId, { propC: "updated_c" })
    );
    const localDId = withEditTxn(local, "local insert D", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a",
        propD: "local_d",
      })
    );

    // Far: push additive schema (adds PropC2 — no column remapping).
    await far.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    await far.pushChanges({ description: "schema v01.00.01 — add PropC2", accessToken: "far-user" });

    // Local: pull — rebase reinstates both the UPDATE and the INSERT.
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    chai.expect(local.getSchemaProps("TestDomain").version).to.equal("01.00.01",
      "local schema should update to v01.00.01");
    assertElementProp(local, cId, "propC", "updated_c",
      "pending UPDATE to C.propC should survive additive-schema rebase");
    assertElementProp(local, localDId, "propD", "local_d",
      "pending INSERT of D should survive additive-schema rebase");
  });

  // -------------------------------------------------------------------------
  // Test 12 — Multi-round concurrent editing: both users push sequentially
  //
  // Full round-trip to verify repeated push/pull cycles work correctly with
  // two briefcases and no locks.  Each user takes turns inserting and pushing,
  // and the other pulls.  At the end, all elements are visible on both.
  //
  // Workflow:
  //   round 1: far inserts C1 → pushes; local inserts D1 → pushes (triggers rebase)
  //   round 2: far inserts C2 → pushes; local pulls
  //   round 3: local inserts D2 → pushes; far pulls
  //   verify : all 4 elements visible on both briefcases
  // -------------------------------------------------------------------------
  it("multi-round concurrent editing: all elements visible after repeated push/pull", async () => {
    // Round 1: both users insert, far pushes first, local pushes second (triggers rebase).
    const farC1Id = withEditTxn(far, "far insert C1", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a1",
        propC: "far_c1",
      })
    );
    await far.pushChanges({ description: "far: round 1 — C1", accessToken: "far-user" });

    const localD1Id = withEditTxn(local, "local insert D1", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a1",
        propD: "local_d1",
      })
    );
    await local.pushChanges({ description: "local: round 1 — D1", accessToken: "local-user" });

    // Round 2: far inserts and pushes, local pulls.
    const farC2Id = withEditTxn(far, "far insert C2", (txn) =>
      insertElement(txn, "TestDomain:C", drawingModelId, drawingCategoryId, {
        propA: "far_a2",
        propC: "far_c2",
      })
    );
    await far.pushChanges({ description: "far: round 2 — C2", accessToken: "far-user" });
    await local.pullChanges({ accessToken: "local-user" });
    local.clearCaches();

    // Round 3: local inserts and pushes, far pulls.
    const localD2Id = withEditTxn(local, "local insert D2", (txn) =>
      insertElement(txn, "TestDomain:D", drawingModelId, drawingCategoryId, {
        propA: "local_a2",
        propD: "local_d2",
      })
    );
    await local.pushChanges({ description: "local: round 3 — D2", accessToken: "local-user" });
    await far.pullChanges({ accessToken: "far-user" });
    far.clearCaches();

    // Verify all 4 elements on both briefcases.
    for (const [label, db] of [["far", far], ["local", local]] as const) {
      (db as BriefcaseDb).clearCaches();
      assertElementProp(db as BriefcaseDb, farC1Id, "propC", "far_c1",
        `${label}: far C1 should exist`);
      assertElementProp(db as BriefcaseDb, localD1Id, "propD", "local_d1",
        `${label}: local D1 should exist`);
      assertElementProp(db as BriefcaseDb, farC2Id, "propC", "far_c2",
        `${label}: far C2 should exist`);
      assertElementProp(db as BriefcaseDb, localD2Id, "propD", "local_d2",
        `${label}: local D2 should exist`);
    }
  });
});
