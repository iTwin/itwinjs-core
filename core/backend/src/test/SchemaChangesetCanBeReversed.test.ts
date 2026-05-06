/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Guid, Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { assert } from "chai";
import * as path from "node:path";
import { DrawingCategory } from "../Category";
import { _nativeDb } from "../core-backend";
import { BriefcaseDb } from "../IModelDb";
import { HubMock } from "../internal/HubMock";
import { HubWrappers, IModelTestUtils } from "./IModelTestUtils";
import { KnownTestLocations } from "./KnownTestLocations";
import { TestUtils } from "./TestUtils";
import { EditTxn, withEditTxn } from "../EditTxn";
import { ChannelControl } from "../ChannelControl";

/**
 * Schemas used to build a timeline with interleaved schema and data changes.
 *
 * v01.00.00 – base schema: classes A (base), C (extends A), D (extends A)
 * v01.00.01 – adds PropC2 to class C  (additive EC schema change)
 * v01.00.02 – adds PropD2 to class D  (additive EC schema change, on top of v01.00.01)
 */
const schemas = {
  v01x00x00: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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

  v01x00x01AddPropC2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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

  v01x00x02AddPropD2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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
};

/**
 * Query whether a property exists on the given class via EC metadata (not DDL).
 * Because schema-changeset reversal only rolls back EC-level mapping (not the backing SQLite columns),
 * this is the correct layer to verify after a reversal.
 */
function hasECProperty(db: BriefcaseDb, schemaName: string, className: string, propertyName: string): boolean {
  let found = false;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  db.withPreparedStatement(
    `SELECT p.Name FROM ECDbMeta.ECPropertyDef p
     JOIN ECDbMeta.ECClassDef c ON p.Class.Id = c.ECInstanceId
     JOIN ECDbMeta.ECSchemaDef s ON c.Schema.Id = s.ECInstanceId
     WHERE s.Name=:schema AND c.Name=:class AND p.Name=:prop`,
    (stmt) => {
      stmt.bindString("schema", schemaName);
      stmt.bindString("class", className);
      stmt.bindString("prop", propertyName);
      found = stmt.step() === DbResult.BE_SQLITE_ROW;
    }
  );
  return found;
}

describe.only("SchemaChangesetCanBeReversed", () => {
  let imodel: BriefcaseDb;
  let iModelId: string;
  let drawingModelId: string;
  let drawingCategoryId: string;

  const createModelAndCategory = async (db: BriefcaseDb) => {
    const modelCode = IModelTestUtils.getUniqueModelCode(db, "DrawingModel");
    await db.locks.acquireLocks({ shared: IModel.dictionaryId });
    return withEditTxn(db, (txn) => {
      const [, newModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
      const newCategoryId = DrawingCategory.insert(txn, IModel.dictionaryId, "DrawingCategory", new SubCategoryAppearance());
      return [newModelId, newCategoryId] as const;
    });
  };

  const insertElement = (txn: EditTxn, className: string, properties: Record<string, unknown>): Id64String => {
    const elementProps: GeometricElementProps = {
      classFullName: className,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      ...properties,
    };
    const element = txn.iModel.elements.createElement(elementProps);
    return txn.insertElement(element.toJSON());
  };

  before(async () => {
    HubMock.startup("SchemaChangesetCanBeReversed", KnownTestLocations.outputDir);
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  beforeEach(async () => {
    iModelId = await HubWrappers.createIModel("user1", HubMock.iTwinId, `Test-${Guid.createValue()}`);
    imodel = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    imodel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    [drawingModelId, drawingCategoryId] = await createModelAndCategory(imodel);
  });

  afterEach(async () => {
    imodel.close();
    await HubMock.deleteIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
  });

  after(async () => {
    HubMock.shutdown();
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  /**
   * Builds a changeset timeline where schema imports and data inserts are interleaved:
   *
   *   CS1 – setup (model, category) + import schema v01.00.00
   *   CS2 – insert two elements of class C  (data)
   *   CS3 – import schema v01.00.01 adding PropC2 to C  (schema)
   *   CS4 – insert two elements of class C with PropC2  (data)
   *   CS5 – import schema v01.00.02 adding PropD2 to D  (schema)
   *   CS6 – insert two elements of class D with PropD2  (data)
   *
   * Starting from the tip (CS6), each changeset is reversed one at a time by
   * downloading the changeset the imodel currently points to and calling
   * `applyChangeset`.  The native side detects that the supplied changeset's id
   * equals the current parent id and automatically calls `TxnManager::ReverseChangeset`,
   * which rolls back EC-level mapping and saves internally — no manual save needed.
   *
   * After every schema reversal the EC metadata is verified; after every data
   * reversal the element roster is verified.  None of the reversals should throw.
   */
  it("should reverse interleaved schema and data changesets from tip, verifying EC schema at each step", async () => {
    const targetDir = path.join(KnownTestLocations.outputDir, iModelId, "changesets");

    /** Download the changeset the imodel currently sits on and reverse it via applyChangeset. */
    const reverseCurrentChangeset = async () => {
      assert.isFalse(imodel.txns.hasUnsavedChanges, "no unsaved changes before reversal");
      assert.isFalse(imodel.txns.hasPendingTxns, "no pending txns before reversal");

      // Download the changeset whose id equals imodel.changeset.id.
      // applyChangeset detects this and routes to TxnManager::ReverseChangeset.
      const cs = await HubMock.downloadChangeset({ iModelId, changeset: { id: imodel.changeset.id }, targetDir });
      assert.doesNotThrow(() => imodel[_nativeDb].applyChangeset(cs, /* fastForward */ false));

      // Sync JS-side changeset metadata and clear all caches so the next queries
      // reflect the reverted EC state.
      imodel.changeset = imodel[_nativeDb].getCurrentChangeset();
      imodel.clearCaches();
    };

    // ── CS1: model/category setup + base schema ───────────────────────────────
    await imodel.importSchemaStrings([schemas.v01x00x00]);
    await imodel.pushChanges({ description: "CS1: setup and import base schema v01.00.00" });

    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.0");
    assert.isTrue(imodel.containsClass("TestDomain:C"));
    assert.isTrue(imodel.containsClass("TestDomain:D"));

    // ── CS2: insert C elements (data only) ────────────────────────────────────
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    const [el1Id, el2Id] = withEditTxn(imodel, (txn) => {
      const e1 = insertElement(txn, "TestDomain:C", { propC: "c_val_1" });
      const e2 = insertElement(txn, "TestDomain:C", { propC: "c_val_2" });
      return [e1, e2];
    });
    await imodel.pushChanges({ description: "CS2: insert C elements" });

    assert.isDefined(imodel.elements.tryGetElement(el1Id), "el1 exists after CS2");
    assert.isDefined(imodel.elements.tryGetElement(el2Id), "el2 exists after CS2");

    // ── CS3: schema v01.00.01 – adds PropC2 to C ─────────────────────────────
    await imodel.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    await imodel.pushChanges({ description: "CS3: import schema v01.00.01 (adds PropC2)" });

    imodel.clearCaches();
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.1");
    assert.isTrue(hasECProperty(imodel, "TestDomain", "C", "PropC2"), "PropC2 present after CS3");

    // ── CS4: insert more C elements using PropC2 (data only) ──────────────────
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    const [el3Id, el4Id] = withEditTxn(imodel, (txn) => {
      const e3 = insertElement(txn, "TestDomain:C", { propC: "c_val_3", propC2: "c2_val_3" });
      const e4 = insertElement(txn, "TestDomain:C", { propC: "c_val_4", propC2: "c2_val_4" });
      return [e3, e4];
    });
    await imodel.pushChanges({ description: "CS4: insert C elements with PropC2" });

    assert.isDefined(imodel.elements.tryGetElement(el3Id), "el3 exists after CS4");
    assert.isDefined(imodel.elements.tryGetElement(el4Id), "el4 exists after CS4");

    // ── CS5: schema v01.00.02 – adds PropD2 to D ─────────────────────────────
    await imodel.importSchemaStrings([schemas.v01x00x02AddPropD2]);
    await imodel.pushChanges({ description: "CS5: import schema v01.00.02 (adds PropD2)" });

    imodel.clearCaches();
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.2");
    assert.isTrue(hasECProperty(imodel, "TestDomain", "D", "PropD2"), "PropD2 present after CS5");

    // ── CS6: insert D elements using PropD2 (data only) ───────────────────────
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    const [el5Id, el6Id] = withEditTxn(imodel, (txn) => {
      const e5 = insertElement(txn, "TestDomain:D", { propD: "d_val_5", propD2: "d2_val_5" });
      const e6 = insertElement(txn, "TestDomain:D", { propD: "d_val_6", propD2: "d2_val_6" });
      return [e5, e6];
    });
    await imodel.pushChanges({ description: "CS6: insert D elements with PropD2" });

    assert.isDefined(imodel.elements.tryGetElement(el5Id), "el5 exists after CS6");
    assert.isDefined(imodel.elements.tryGetElement(el6Id), "el6 exists after CS6");

    // ── Reverse CS6 (data: D elements with PropD2) ───────────────────────────
    await reverseCurrentChangeset();
    assert.isUndefined(imodel.elements.tryGetElement(el5Id), "el5 gone after reversing CS6");
    assert.isUndefined(imodel.elements.tryGetElement(el6Id), "el6 gone after reversing CS6");
    // Schema must be unchanged (still v01.00.02)
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.2", "schema still v01.00.02 after data-only reversal");
    assert.isTrue(hasECProperty(imodel, "TestDomain", "D", "PropD2"), "PropD2 still present after data-only reversal of CS6");

    // ── Reverse CS5 (schema: added PropD2 to D) ───────────────────────────────
    await reverseCurrentChangeset();
    // EC-level: PropD2 mapping gone; class D itself stays; schema version rolls back.
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.1", "schema back to v01.00.01 after reversing CS5");
    assert.isTrue(imodel.containsClass("TestDomain:D"), "class D still present in EC after reversing CS5");
    assert.isFalse(hasECProperty(imodel, "TestDomain", "D", "PropD2"), "PropD2 absent at EC level after reversing CS5");
    assert.isTrue(hasECProperty(imodel, "TestDomain", "C", "PropC2"), "PropC2 unaffected; CS3 not yet reversed");

    // ── Reverse CS4 (data: C elements with PropC2) ───────────────────────────
    await reverseCurrentChangeset();
    assert.isUndefined(imodel.elements.tryGetElement(el3Id), "el3 gone after reversing CS4");
    assert.isUndefined(imodel.elements.tryGetElement(el4Id), "el4 gone after reversing CS4");
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.1", "schema still v01.00.01 after data-only reversal of CS4");
    assert.isTrue(hasECProperty(imodel, "TestDomain", "C", "PropC2"), "PropC2 still present after data-only reversal of CS4");

    // ── Reverse CS3 (schema: added PropC2 to C) ───────────────────────────────
    await reverseCurrentChangeset();
    // EC-level: PropC2 mapping gone; class C itself stays; schema version rolls back.
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.0", "schema back to v01.00.00 after reversing CS3");
    assert.isTrue(imodel.containsClass("TestDomain:C"), "class C still present in EC after reversing CS3");
    assert.isFalse(hasECProperty(imodel, "TestDomain", "C", "PropC2"), "PropC2 absent at EC level after reversing CS3");
    assert.isFalse(hasECProperty(imodel, "TestDomain", "D", "PropD2"), "PropD2 still absent");

    // ── Reverse CS2 (data: original C elements) ──────────────────────────────
    await reverseCurrentChangeset();
    assert.isUndefined(imodel.elements.tryGetElement(el1Id), "el1 gone after reversing CS2");
    assert.isUndefined(imodel.elements.tryGetElement(el2Id), "el2 gone after reversing CS2");
    assert.equal(imodel.querySchemaVersion("TestDomain"), "1.0.0", "schema still v01.00.00 after reversing CS2");
    assert.isTrue(imodel.containsClass("TestDomain:C"), "class C still in EC after all reversals");
    assert.isTrue(imodel.containsClass("TestDomain:D"), "class D still in EC after all reversals");
  });
});
