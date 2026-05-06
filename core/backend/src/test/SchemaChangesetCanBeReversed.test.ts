/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Guid, Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, IModelVersion, SubCategoryAppearance } from "@itwin/core-common";
import { assert } from "chai";
import { DrawingCategory } from "../Category";
import { BriefcaseDb, IModelDb } from "../IModelDb";
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
function hasECProperty(db: IModelDb, schemaName: string, className: string, propertyName: string): boolean {
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
   * Builds a timeline with interleaved schema and data changesets:
   *
   *   CS1 – setup (model, category) + import schema v01.00.00
   *   CS2 – insert two elements of class C  (data)
   *   CS3 – import schema v01.00.01 adding PropC2 to C  (schema)
   *   CS4 – insert two elements of class C with PropC2  (data)
   *   CS5 – import schema v01.00.02 adding PropD2 to D  (schema)
   *   CS6 – insert two elements of class D with PropD2  (data)
   *
   * After all six changesets are pushed a single V1 checkpoint is built at the tip
   * (CS6) via [[HubMock.createTipCheckpoint]].  The test then calls
   * [[HubWrappers.downloadAndOpenCheckpoint]] at three older versions (CS5, CS3, CS1).
   *
   * For each request [[V2CheckpointManager]] (mock path) copies the tip checkpoint — the
   * *nearest* available checkpoint — to the local target file.  [[CheckpointManager.updateToRequestedVersion]]
   * detects that the downloaded file is at a newer changeset than requested and calls
   * [[BriefcaseManager.pullAndApplyChangesets]] with `toIndex < currentIndex`, which reverses
   * the needed changesets in order.  The opened snapshot is therefore at the exact requested
   * version and its EC schema metadata reflects the pre-reversal state.
   */
  it("should open checkpoint at older schema version by reversing from the tip checkpoint", async () => {
    // ── CS1: model/category setup + base schema ──────────────────────────────
    await imodel.importSchemaStrings([schemas.v01x00x00]);
    await imodel.pushChanges({ description: "CS1: setup and import base schema v01.00.00" });
    const cs1Id = imodel.changeset.id;

    // ── CS2: insert C elements (data only) ───────────────────────────────────
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    withEditTxn(imodel, (txn) => {
      insertElement(txn, "TestDomain:C", { propC: "c_val_1" });
      insertElement(txn, "TestDomain:C", { propC: "c_val_2" });
    });
    await imodel.pushChanges({ description: "CS2: insert C elements" });

    // ── CS3: schema v01.00.01 – adds PropC2 to C ─────────────────────────────
    await imodel.importSchemaStrings([schemas.v01x00x01AddPropC2]);
    await imodel.pushChanges({ description: "CS3: import schema v01.00.01 (adds PropC2)" });
    const cs3Id = imodel.changeset.id;

    // ── CS4: insert more C elements using PropC2 (data only) ─────────────────
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    withEditTxn(imodel, (txn) => {
      insertElement(txn, "TestDomain:C", { propC: "c_val_3", propC2: "c2_val_3" });
      insertElement(txn, "TestDomain:C", { propC: "c_val_4", propC2: "c2_val_4" });
    });
    await imodel.pushChanges({ description: "CS4: insert C elements with PropC2" });

    // ── CS5: schema v01.00.02 – adds PropD2 to D ─────────────────────────────
    await imodel.importSchemaStrings([schemas.v01x00x02AddPropD2]);
    await imodel.pushChanges({ description: "CS5: import schema v01.00.02 (adds PropD2)" });
    const cs5Id = imodel.changeset.id;

    // ── CS6: insert D elements using PropD2 (data only) ──────────────────────
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    withEditTxn(imodel, (txn) => {
      insertElement(txn, "TestDomain:D", { propD: "d_val_5", propD2: "d2_val_5" });
      insertElement(txn, "TestDomain:D", { propD: "d_val_6", propD2: "d2_val_6" });
    });
    await imodel.pushChanges({ description: "CS6: insert D elements with PropD2" });

    // ── Build a single V1 checkpoint at the tip (CS6) ────────────────────────
    // All three verify steps below will download this tip checkpoint and reverse
    // it to the requested version via BriefcaseManager.pullAndApplyChangesets.
    await HubMock.createTipCheckpoint(iModelId);

    // ── Open at CS5 (schema v01.00.02): reverses CS6 (data) ──────────────────
    {
      const snap = await HubWrappers.downloadAndOpenCheckpoint({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelId,
        asOf: IModelVersion.asOfChangeSet(cs5Id).toJSON(),
      });
      assert.equal(snap.querySchemaVersion("TestDomain"), "1.0.2", "schema is v01.00.02 at CS5");
      assert.isTrue(hasECProperty(snap, "TestDomain", "C", "PropC2"), "PropC2 present at CS5");
      assert.isTrue(hasECProperty(snap, "TestDomain", "D", "PropD2"), "PropD2 present at CS5");
      snap.close();
    }

    // ── Open at CS3 (schema v01.00.01): reverses CS4 (data) + CS5 (schema) + CS6 (data) ──
    {
      const snap = await HubWrappers.downloadAndOpenCheckpoint({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelId,
        asOf: IModelVersion.asOfChangeSet(cs3Id).toJSON(),
      });
      assert.equal(snap.querySchemaVersion("TestDomain"), "1.0.1", "schema is v01.00.01 at CS3");
      assert.isTrue(hasECProperty(snap, "TestDomain", "C", "PropC2"), "PropC2 present at CS3");
      assert.isFalse(hasECProperty(snap, "TestDomain", "D", "PropD2"), "PropD2 absent at CS3 (CS5 schema reverted)");
      snap.close();
    }

    // ── Open at CS1 (schema v01.00.00): reverses CS2 through CS6 ─────────────
    {
      const snap = await HubWrappers.downloadAndOpenCheckpoint({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelId,
        asOf: IModelVersion.asOfChangeSet(cs1Id).toJSON(),
      });
      assert.equal(snap.querySchemaVersion("TestDomain"), "1.0.0", "schema is v01.00.00 at CS1");
      assert.isFalse(hasECProperty(snap, "TestDomain", "C", "PropC2"), "PropC2 absent at CS1 (CS3 schema reverted)");
      assert.isFalse(hasECProperty(snap, "TestDomain", "D", "PropD2"), "PropD2 absent at CS1");
      snap.close();
    }
  });
});
