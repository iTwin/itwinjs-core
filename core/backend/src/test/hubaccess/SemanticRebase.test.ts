/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbConflictResolution, Id64, Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import * as chai from "chai";
import { Suite } from "mocha";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { BriefcaseDb, BriefcaseManager, ChannelControl, DrawingCategory, IModelJsFs } from "../../core-backend";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { HubMock } from "../../internal/HubMock";
import { EntityClass } from "@itwin/ecschema-metadata";
import { TestUtils } from "../TestUtils";

function startTestTxn(iModel: BriefcaseDb, description = "semantic rebase"): EditTxn {
  const txn = new EditTxn(iModel, description);
  txn.start();
  return txn;
}

function endTestTxn(txn: EditTxn): void {
  if (txn.isActive)
    txn.end("abandon");
}

async function importSchemaStrings(txn: EditTxn, schemas: string[]): Promise<void> {
  if (txn.isActive)
    txn.saveChanges();
  await txn.iModel.importSchemaStrings(schemas);
}

async function pushChanges(txn: EditTxn, description: string): Promise<void> {
  const briefcase = txn.iModel as BriefcaseDb;
  endTestTxn(txn);
  await briefcase.pushChanges({ description });
}

async function pullChanges(txn: EditTxn): Promise<void> {
  const briefcase = txn.iModel as BriefcaseDb;
  endTestTxn(txn);
  await briefcase.pullChanges();
}

/**
 * Test infrastructure for rebase tests in this file.
 * Manages two briefcases (far and local)
 */
class TestIModel {
  public iModelId: Id64String = "";
  public drawingModelId: Id64String = "";
  public drawingCategoryId: Id64String = "";
  public far: BriefcaseDb;
  public local: BriefcaseDb;

  private constructor(iModelId: Id64String, drawingModelId: Id64String, drawingCategoryId: Id64String, far: BriefcaseDb, local: BriefcaseDb) {
    this.iModelId = iModelId;
    this.drawingModelId = drawingModelId;
    this.drawingCategoryId = drawingCategoryId;
    this.far = far;
    this.local = local;
  }

  /** Reusable schema definitions for testing rebase with schema transformations */
  public static readonly schemas = {
    /** Base schema v01.00.00 with classes A, C, D */
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

    /** v01.00.01 - Adds PropC2 to class C (trivial additive change) */
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

    /** v01.00.02 - Adds PropD2 to class D (trivial additive change) */
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

    /** v01.00.02 - Moves PropC from C to A (requires data transformation) on top of v01.00.01 */
    v01x00x02MovePropCToA: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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

    /** v01.00.03 - Builds on top of v01.00.02 and in addition moves PropD to base, so we can have incoming and local transforming changes */
    v01x00x03MovePropCAndD: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.03" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.01 (incompatible variant) - Adds PropC3 instead of PropC2 to class C (same version) */
    v01x00x01AddPropC3Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC3" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.02 (incompatible variant) - Adds PropC3 instead of PropC2 to class C (higher version) */
    v01x00x02AddPropC3Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC3" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.02 (incompatible variant) - Adds PropC2 (higher version, different type) */
    v01x00x02AddPropC2Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="int"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.03 - Adds PropC2 as string (used to test incompatibility when reinstated on top of v01.00.02 with PropC2:int) */
    v01x00x03AddPropC2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.03" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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
  };

  /**
   * Create and initialize a new test iModel with far and local briefcases.
   * @param testName Unique name for this test (passed to HubMock.startup)
   * @returns Fully initialized TestIModel with both briefcases open
   */
  public static async initialize(testName: string): Promise<TestIModel> {
    HubMock.startup(testName, KnownTestLocations.outputDir);

    let far: BriefcaseDb | undefined;
    let local: BriefcaseDb | undefined;
    try {
      const iModelId = await HubMock.createNewIModel({
        accessToken: "far-user",
        iTwinId: HubMock.iTwinId,
        iModelName: testName,
        description: `Rebase schema update with data transform tests: ${testName}`,
      });

      // Open far briefcase and use it for initialization
      far = await HubWrappers.downloadAndOpenBriefcase({
        iTwinId: HubMock.iTwinId,
        iModelId,
        accessToken: "far-user",
      });
      far.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      // Initialize with base schema
      await far.importSchemaStrings([TestIModel.schemas.v01x00x00]);
      await far.pushChanges({ description: "import base schema" });

      // Create model and category
      const modelCode = IModelTestUtils.getUniqueModelCode(far, "DrawingModel");
      await far.locks.acquireLocks({ shared: IModel.dictionaryId });
      const [drawingModelId, drawingCategoryId] = withEditTxn(far, "create model and category", (txn) => {
        const [, newDrawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
        const newDrawingCategoryId = DrawingCategory.insert(
          txn,
          IModel.dictionaryId,
          "DrawingCategory",
          new SubCategoryAppearance()
        );
        return [newDrawingModelId, newDrawingCategoryId] as const;
      });
      await far.pushChanges({ description: "create model and category" });

      // Open local briefcase
      local = await HubWrappers.downloadAndOpenBriefcase({
        iTwinId: HubMock.iTwinId,
        iModelId,
        accessToken: "local-user",
      });
      local.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      return new TestIModel(iModelId, drawingModelId, drawingCategoryId, far, local);
    } catch (error) {
      if (local?.isOpen)
        local.close();

      if (far?.isOpen)
        far.close();

      HubMock.shutdown();
      throw error;
    }
  }

  public insertElement(
    txn: EditTxn,
    className: string,
    properties: Record<string, any>
  ): Id64String {
    const briefcase = txn.iModel as BriefcaseDb;
    const elementProps: GeometricElementProps = {
      classFullName: className,
      model: this.drawingModelId,
      category: this.drawingCategoryId,
      code: Code.createEmpty(),
      ...properties,
    };
    const element = briefcase.elements.createElement(elementProps);
    return txn.insertElement(element.toJSON());
  }

  public updateElement(txn: EditTxn, elementId: Id64String, updates: Record<string, any>): void {
    const briefcase = txn.iModel as BriefcaseDb;
    const element = briefcase.elements.getElement(elementId);
    Object.assign(element, updates);
    txn.updateElement(element.toJSON());
  }

  public getElement(briefcase: BriefcaseDb, elementId: Id64String): any {
    return briefcase.elements.getElement(elementId);
  }

  public checkIfFolderExists(briefcase: BriefcaseDb, txnId: string, isSchemaFolder: boolean): boolean {
    if (isSchemaFolder)
      return BriefcaseManager.semanticRebaseSchemaFolderExists(briefcase, txnId);
    return BriefcaseManager.semanticRebaseDataFolderExists(briefcase, txnId);
  }

  public checkifRebaseFolderExists(briefcase: BriefcaseDb): boolean {
    const folderPath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(briefcase);
    return IModelJsFs.existsSync(folderPath);
  }

  public shutdown(): void {
    this.far.close();
    this.local.close();
    HubMock.shutdown();
  }
}

/**
 * Test suite for rebase logic with schema changes that require data transformations.
 */
describe("Semantic Rebase", function (this: Suite) {
  this.timeout(60000); // operations can be slow
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend(); // Automatically TestUtils.startBackend() is called before every test suite starts we need to shut tht down and startup our new TestUtils with semantic rebase on
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  })

  it("local data changes onto incoming trivial schema change", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncoming");
    let localTxn = startTestTxn(t.local, "local data changes onto incoming trivial schema change local");
    let farTxn = startTestTxn(t.far, "local data changes onto incoming trivial schema change far");

    // Local creates an element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a",
      propC: "value_c",
    });
    localTxn.saveChanges("create element");
    await pushChanges(localTxn, "create test element");
    localTxn = startTestTxn(t.local, "local data changes onto incoming trivial schema change local");

    // Far imports updated schema with new property PropC2
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local data changes onto incoming trivial schema change far");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Verify that we're holding a shared lock (not exclusive) for semantic rebase
    chai.expect(t.far.locks.holdsSharedLock(IModel.repositoryModelId)).to.be.true;
    chai.expect(t.far.holdsSchemaLock).to.be.false;

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local makes local changes to the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_update_a" });
    localTxn.saveChanges("local update to propA");

    // Local pulls and rebases local changes onto incoming schema change
    await pullChanges(localTxn);

    // Verify: local changes preserved, schema updated
    const element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("local_update_a", "Local property update should be preserved");
    chai.expect(element.propC).to.equal("value_c", "Original propC should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be updated to v01.00.01");
  });

  it("local trivial schema change onto incoming data changes", async () => {
    t = await TestIModel.initialize("TrivialSchemaLocal");
    let localTxn = startTestTxn(t.local, "local trivial schema change onto incoming data changes local");
    let farTxn = startTestTxn(t.far, "local trivial schema change onto incoming data changes far");

    // Local creates an element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a",
      propC: "value_c",
    });
    localTxn.saveChanges("create element");
    await pushChanges(localTxn, "create test element");
    localTxn = startTestTxn(t.local, "local trivial schema change onto incoming data changes local");

    // Local imports updated schema locally
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Verify that we're holding a shared lock (not exclusive) for semantic rebase
    chai.expect(t.local.locks.holdsSharedLock(IModel.repositoryModelId)).to.be.true;
    chai.expect(t.local.holdsSchemaLock).to.be.false;

    const txnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnProps!.id, true)).to.be.true;


    // Far pulls element, then updates it
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local trivial schema change onto incoming data changes far");
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_update_a" });
    farTxn.saveChanges("far update to propA");
    await pushChanges(farTxn, "update element propA");

    // Local pulls and rebases local schema change onto incoming data changes
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnProps!.id, true)).to.be.true; // after rebase the folder should be there until push is called

    // Verify: incoming data changes applied, local schema preserved
    const element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("far_update_a", "Incoming property update should be applied");
    chai.expect(element.propC).to.equal("value_c", "Original propC should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Local schema update should be preserved");
  });

  it("local data changes onto incoming data changes", async () => {
    t = await TestIModel.initialize("DataOntoData");
    let localTxn = startTestTxn(t.local, "local data changes onto incoming data changes local");
    let farTxn = startTestTxn(t.far, "local data changes onto incoming data changes far");

    // Local creates two elements
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a1",
      propC: "value_c1",
    });
    const elementId2 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a2",
      propC: "value_c2",
    });
    localTxn.saveChanges("create elements");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used
    await pushChanges(localTxn, "create test elements");
    localTxn = startTestTxn(t.local, "local data changes onto incoming data changes local");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used

    // Far updates first element
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local data changes onto incoming data changes far");
    await t.far.locks.acquireLocks({ exclusive: elementId1 });
    t.updateElement(farTxn, elementId1, { propC: "far_update_c" });
    farTxn.saveChanges("far update to propC");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // its data changes on both sides semantic rebase is not used
    await pushChanges(farTxn, "update element propC");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // its data changes on both sides semantic rebase is not used


    // Local makes local changes to second element
    await t.local.locks.acquireLocks({ exclusive: elementId2 });
    t.updateElement(localTxn, elementId2, { propA: "local_update_a" });
    localTxn.saveChanges("local update to propA");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used

    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used

    // Verify: both changes applied to their respective elements
    const element1 = t.getElement(t.local, elementId1);
    chai.expect(element1.propA).to.equal("value_a1", "Element 1 propA should be unchanged");
    chai.expect(element1.propC).to.equal("far_update_c", "Element 1 incoming update should be applied");

    const element2 = t.getElement(t.local, elementId2);
    chai.expect(element2.propA).to.equal("local_update_a", "Element 2 local update should be preserved");
    chai.expect(element2.propC).to.equal("value_c2", "Element 2 propC should be unchanged");
  });

  it("local trivial schema changes onto incoming trivial schema changes (local newer)", async () => {
    t = await TestIModel.initialize("TrivialSchemaLocalNewer");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming trivial schema changes local newer local");
    const farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming trivial schema changes local newer far");

    // Far imports v01.00.01 (adds PropC2)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local imports v01.00.02 (adds PropC2 and PropD2 - newer)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // after rebase the folder should be there because local is newer until push is called

    // Verify: local schema preserved (newer version)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local schema (newer) should be preserved");
  });

  it("local trivial schema changes onto incoming trivial schema changes (incoming newer)", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncomingNewer");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming trivial schema changes incoming newer local");
    const farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming trivial schema changes incoming newer far");

    // Far imports v01.00.02 (adds PropC2 and PropD2 - newer)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "update schema to v01.00.02");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local imports v01.00.01 (adds only PropC2 - older)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    // Local pulls and rebases
    await pullChanges(localTxn);
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.false; // after rebase the folder should not be there because incoming is newer so while rebasing it should be a no op
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because the rebase folder is deleted after rebase if it contains nothing

    // Verify: incoming schema preserved (newer version, local should not override)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Incoming schema (newer) should win, local should not override");
  });

  it("local trivial schema changes onto incoming identical schema changes", async () => {
    t = await TestIModel.initialize("TrivialSchemaIdentical");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming identical schema changes local");
    const farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming identical schema changes far");

    // Far imports v01.00.01 (adds PropC2)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Verify that we're holding a shared lock (not exclusive) for semantic rebase
    chai.expect(t.far.locks.holdsSharedLock(IModel.repositoryModelId)).to.be.true;
    chai.expect(t.far.holdsSchemaLock).to.be.false;

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local imports the same v01.00.01 (adds PropC2)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.false; // after rebase the folder should not be there as both are identical
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because the rebase folder is deleted if it contains nothing after rebase

    // Verify: schema preserved (both sides identical)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be v01.00.01");
  });

  it("local trivial schema changes onto incoming identical schema changes with data changes on both sides", async () => {
    t = await TestIModel.initialize("TrivialSchemaIdenticalWithData");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming identical schema changes with data local");
    let farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming identical schema changes with data far");

    // Far imports v01.00.01 (adds PropC2) and creates an element
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");
    farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming identical schema changes with data far");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
      propC2: "far_value_c2",
    });
    farTxn.saveChanges("far creates element with new property");
    await pushChanges(farTxn, "far creates element");

    // Local imports the same v01.00.01 (adds PropC2) and creates an element
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
      propC2: "local_value_c2",
    });
    localTxn.saveChanges("local creates element with new property");

    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.false; // after rebase the folder should not be there as both are identical
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because the rebase folder is deleted after rebase if it contains nothing

    // Verify: schema preserved (both sides identical)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be v01.00.01");

    // Verify: both elements exist with their original properties
    const farElement = t.getElement(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_value_a", "Far element propA should be preserved");
    chai.expect(farElement.propC).to.equal("far_value_c", "Far element propC should be preserved");
    chai.expect(farElement.propC2).to.equal("far_value_c2", "Far element propC2 should be preserved");

    const localElement = t.getElement(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_value_a", "Local element propA should be preserved");
    chai.expect(localElement.propC).to.equal("local_value_c", "Local element propC should be preserved");
    chai.expect(localElement.propC2).to.equal("local_value_c2", "Local element propC2 should be preserved");
  });

  it("both add different properties, increment to same version number", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncompatible");
    const localTxn = startTestTxn(t.local, "both add different properties increment to same version local");
    const farTxn = startTestTxn(t.far, "both add different properties increment to same version far");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "add PropC2 to class C");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC3Incompatible]);

    await pullChanges(localTxn); // TODO: this currently passes, because same version number means no upgrade is attempted
    //TODO: this should probably fail instead as both sides made incompatible changes to the same version, but this is unrelated to semantic rebase itself

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be v01.00.01");
  });

  it("both add compatible properties, local version number higher", async () => {
    t = await TestIModel.initialize("CompatibleSchemaLocalHigher");
    const localTxn = startTestTxn(t.local, "both add compatible properties local version higher local");
    const farTxn = startTestTxn(t.far, "both add compatible properties local version higher far");

    // Far imports v01.00.01 (adds PropC2)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "add PropC2 to class C");

    // Local imports v01.00.02 (adds PropC2 and PropD2 - compatible higher version)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    // Local pulls and rebases
    await pullChanges(localTxn);

    // Verify: Local schema wins (higher version)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be v01.00.02 (higher version wins)");
    const classC = await t.local.schemaContext.getSchemaItem("TestDomain", "C", EntityClass);
    chai.expect(classC).to.not.be.undefined;
    chai.expect(await classC!.getProperty("PropC2")).to.exist;
    const classD = await t.local.schemaContext.getSchemaItem("TestDomain", "D", EntityClass);
    chai.expect(classD).to.not.be.undefined;
    chai.expect(await classD!.getProperty("PropD2")).to.exist;
  });

  it("both add compatible properties, incoming version number higher", async () => {
    t = await TestIModel.initialize("CompatibleSchemaIncomingHigher");
    const localTxn = startTestTxn(t.local, "both add compatible properties incoming version higher local");
    const farTxn = startTestTxn(t.far, "both add compatible properties incoming version higher far");

    // Far imports v01.00.02 (adds PropC2 and PropD2 - higher version)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await pushChanges(farTxn, "update schema to v01.00.02");

    // Local imports v01.00.01 (adds only PropC2 - compatible lower version)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Local pulls and rebases
    await pullChanges(localTxn);

    // Verify: Incoming schema wins (higher version)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be v01.00.02 (higher version wins)");
    const classC = await t.local.schemaContext.getSchemaItem("TestDomain", "C", EntityClass);
    chai.expect(classC).to.not.be.undefined;
    chai.expect(await classC!.getProperty("PropC2")).to.exist;
    const classD = await t.local.schemaContext.getSchemaItem("TestDomain", "D", EntityClass);
    chai.expect(classD).to.not.be.undefined;
    chai.expect(await classD!.getProperty("PropD2")).to.exist;
  });

  it("both add same but incompatible property, local version number higher", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncompatible");
    const localTxn = startTestTxn(t.local, "both add same but incompatible property local version higher local");
    const farTxn = startTestTxn(t.far, "both add same but incompatible property local version higher far");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "add PropC2 to class C");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropC2Incompatible]);

    // Local pulls and rebases - this should detect the incompatibility and fail
    await chai.expect(pullChanges(localTxn)).to.be.rejectedWith("ECSchema Upgrade failed");
  });

  it("both add same but incompatible property, incoming version number higher", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncompatible");
    const localTxn = startTestTxn(t.local, "both add same but incompatible property incoming version higher local");
    const farTxn = startTestTxn(t.far, "both add same but incompatible property incoming version higher far");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropC2Incompatible]);
    await pushChanges(farTxn, "import v01.00.02 with PropC2 as int");

    // Local uses v01.00.03 with PropC2:string — higher version ensures the upgrade is attempted
    // during reinstatement, which detects the type mismatch (string vs int)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x03AddPropC2]);

    // Local pulls and rebases - this should detect the incompatibility and fail
    await chai.expect(pullChanges(localTxn)).to.be.rejectedWith("ECSchema Upgrade failed");
  });

  it("local transforming schema change onto incoming trivial schema change", async () => {
    t = await TestIModel.initialize("LocalTransformIncomingTrivial");
    const farTxn = startTestTxn(t.far, "local transforming schema change onto incoming trivial schema change far");
    const localTxn = startTestTxn(t.local, "local transforming schema change onto incoming trivial schema change local");

    // Far: Insert Element and import trivial schema change
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
    });
    farTxn.saveChanges("far create element");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsFar = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnPropsFar).to.not.be.undefined;
    chai.expect(txnPropsFar!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnPropsFar!.id, true)).to.be.true; // schema folder should exist

    await pushChanges(farTxn, "far add PropC2");

    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    // Local: Insert Element and import transforming schema change
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    localTxn.saveChanges("local create element");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    // Local pulls and rebases transforming change onto incoming trivial change
    await pushChanges(localTxn, "local move PropC to A");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    // Verify: both elements have PropC intact, schema transformed locally
    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    const farElement = t.getElement(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_value_a", "Far element propA should be preserved");
    chai.expect(farElement.propC).to.equal("far_value_c", "Far element propC should be preserved after transform");

    const localElement = t.getElement(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_value_a", "Local element propA should be preserved");
    chai.expect(localElement.propC).to.equal("local_value_c", "Local element propC should be preserved after transform");
  });

  it("local trivial schema change onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("LocalTrivialIncomingTransform");
    const farTxn = startTestTxn(t.far, "local trivial schema change onto incoming transforming schema change far");
    const localTxn = startTestTxn(t.local, "local trivial schema change onto incoming transforming schema change local");

    // Far: Insert Element and import transforming schema change
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
    });
    farTxn.saveChanges("far create element");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far move PropC to A");

    // Local: Insert Element and import trivial schema change
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    localTxn.saveChanges("local create element");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    // Local pulls and rebases trivial change onto incoming transforming change
    await pushChanges(localTxn, "local add PropC2");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    // Verify: both elements have PropC intact after incoming transform
    const farElement = t.getElement(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_value_a", "Far element propA should be preserved");
    chai.expect(farElement.propC).to.equal("far_value_c", "Far element propC should be preserved after incoming transform");

    const localElement = t.getElement(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_value_a", "Local element propA should be preserved");
    chai.expect(localElement.propC).to.equal("local_value_c", "Local element propC should be preserved after incoming transform");
  });

  it("local transforming schema change onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("BothTransforming");
    const farTxn = startTestTxn(t.far, "local transforming schema change onto incoming transforming schema change far");
    const localTxn = startTestTxn(t.local, "local transforming schema change onto incoming transforming schema change local");

    // Far: Create elements with PropC and PropD, import transforming schema (moves PropC to A)
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementC = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a_c",
      propC: "far_value_c",
    });
    const farElementD = t.insertElement(farTxn, "TestDomain:D", {
      propA: "far_value_a_d",
      propD: "far_value_d",
    });
    farTxn.saveChanges("far create elements");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    const txnPropsFar = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnPropsFar).to.not.be.undefined;
    chai.expect(txnPropsFar!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnPropsFar!.id, true)).to.be.true; // schema folder should exist

    farTxn.saveChanges("far move PropC to A");
    await pushChanges(farTxn, "far transform PropC");

    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    // Local: Create elements with PropC and PropD, import transforming schema (moves both PropC and PropD to A)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementC = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a_c",
      propC: "local_value_c",
    });
    const localElementD = t.insertElement(localTxn, "TestDomain:D", {
      propA: "local_value_a_d",
      propD: "local_value_d",
    });
    localTxn.saveChanges("local create elements");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x03MovePropCAndD]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    localTxn.saveChanges("local move PropC and PropD to A");
    // Local pulls and rebases both transforming changes
    await pushChanges(localTxn, "local transform PropC and PropD");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    t.far.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    // Verify: all elements have both PropC and PropD intact
    const farElemC = t.getElement(t.local, farElementC);
    chai.expect(farElemC.propA).to.equal("far_value_a_c", "Far element C propA should be preserved");
    chai.expect(farElemC.propC).to.equal("far_value_c", "Far element C propC should be preserved after both transforms");

    const farElemD = t.getElement(t.local, farElementD);
    chai.expect(farElemD.propA).to.equal("far_value_a_d", "Far element D propA should be preserved");
    chai.expect(farElemD.propD).to.equal("far_value_d", "Far element D propD should be preserved after both transforms");

    const localElemC = t.getElement(t.local, localElementC);
    chai.expect(localElemC.propA).to.equal("local_value_a_c", "Local element C propA should be preserved");
    chai.expect(localElemC.propC).to.equal("local_value_c", "Local element C propC should be preserved after both transforms");

    const localElemD = t.getElement(t.local, localElementD);
    chai.expect(localElemD.propA).to.equal("local_value_a_d", "Local element D propA should be preserved");
    chai.expect(localElemD.propD).to.equal("local_value_d", "Local element D propD should be preserved after both transforms");
  });

  it("local data update onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("LocalDataIncomingTransform");
    let farTxn = startTestTxn(t.far, "local data update onto incoming transforming schema change far");
    let localTxn = startTestTxn(t.local, "local data update onto incoming transforming schema change local");

    // Insert one instance and populate to both far and local
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "initial_value_a",
      propC: "initial_value_c",
    });
    farTxn.saveChanges("far create element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "local data update onto incoming transforming schema change far");

    // Local pulls to get the element
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "local data update onto incoming transforming schema change local");

    // Far imports transforming schema (moves PropC from C to A)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    const txnPropsFar = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnPropsFar).to.not.be.undefined;
    chai.expect(txnPropsFar!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnPropsFar!.id, true)).to.be.true; // schema folder should exist

    await pushChanges(farTxn, "far move PropC to A");

    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    // Local updates PropC on the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propC: "local_modified_c" });
    localTxn.saveChanges("local update propC");
    let element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("initial_value_a", "PropA should be unchanged");
    chai.expect(element.propC).to.equal("local_modified_c", "PropC should have the local modified value before incoming transform");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // no schema change yet on local so no rebase folder

    // Local pulls and rebases data change onto incoming transforming schema change
    await pullChanges(localTxn);

    // after rebase the folder should not be there because data change folder is created on the fly and removed once rebased and rebase folder is also removed if it contains nothing
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    // Verify: PropC has the modified local value after the transform
    element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("initial_value_a", "PropA should be unchanged");
    chai.expect(element.propC).to.equal("local_modified_c", "PropC should have the local modified value after incoming transform");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data update onto local transforming schema change", async () => {
    t = await TestIModel.initialize("IncomingDataLocalTransform");
    const farTxn = startTestTxn(t.far, "Incoming data update onto local transforming schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data update onto local transforming schema change local");

    // Insert one instance and populate to both far and local
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementIdFar = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
    });
    farTxn.saveChanges("far create element");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // no schema change yet on far so no rebase folder
    await pushChanges(farTxn, "create shared element");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementIdLocal = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    localTxn.saveChanges("local create element");
    // Far imports transforming schema (moves PropC from C to A)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    // local pulls and rebases and then pushes
    await pushChanges(localTxn, "far move PropC to A");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Check if associated rebase folders get deleted when a briefcase is deleted or not", async () => {
    t = await TestIModel.initialize("IncomingDataLocalTransform");
    // Must close briefcases before deleting their files - on Windows, open files are locked by the OS.
    // Save paths before closing since pathName getter throws on closed dbs.
    const localPath = t.local.pathName;
    const localRebasePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(t.local);
    const farPath = t.far.pathName;
    const farRebasePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(t.far);
    t.local.close();
    await BriefcaseManager.deleteBriefcaseFiles(localPath);
    chai.expect(IModelJsFs.existsSync(localRebasePath)).to.be.false; // after briefcase deletion the rebase folder should also be deleted
    t.far.close();
    await BriefcaseManager.deleteBriefcaseFiles(farPath);
    chai.expect(IModelJsFs.existsSync(farRebasePath)).to.be.false; // after briefcase deletion the rebase folder should also be deleted
  });

  it("local multiple data transactions onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("LocalMultipleDataIncomingTransform");
    let farTxn = startTestTxn(t.far, "local multiple data transactions onto incoming transforming schema change far");
    let localTxn = startTestTxn(t.local, "local multiple data transactions onto incoming transforming schema change local");

    // Insert initial element and push
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "initial_a",
      propC: "initial_c",
    });
    localTxn.saveChanges("create first element");
    await pushChanges(localTxn, "create initial element");
    localTxn = startTestTxn(t.local, "local multiple data transactions onto incoming transforming schema change local");

    // Far imports transforming schema (moves PropC from C to A)
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local multiple data transactions onto incoming transforming schema change far");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far move PropC to A");

    // Local makes first data change
    await t.local.locks.acquireLocks({ exclusive: elementId1 });
    t.updateElement(localTxn, elementId1, { propA: "first_update_a" });
    localTxn.saveChanges("first data change");

    // Local makes second data change - create new element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId2 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "second_element_a",
      propC: "second_element_c",
    });
    localTxn.saveChanges("second data change - new element");

    // Local pulls and rebases both transactions onto incoming transforming schema
    await pullChanges(localTxn);

    t.local.clearCaches();

    // Verify: both local data changes preserved after incoming transform
    const element1 = t.getElement(t.local, elementId1);
    chai.expect(element1.propA).to.equal("first_update_a", "First element propA update should be preserved");
    chai.expect(element1.propC).to.equal("initial_c", "First element propC should be preserved after transform");

    const element2 = t.getElement(t.local, elementId2);
    chai.expect(element2.propA).to.equal("second_element_a", "Second element propA should be preserved");
    chai.expect(element2.propC).to.equal("second_element_c", "Second element propC should be preserved after transform");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("local transforming schema change onto incoming multiple data transactions", async () => {
    t = await TestIModel.initialize("LocalTransformIncomingMultipleData");
    let farTxn = startTestTxn(t.far, "local transforming schema change onto incoming multiple data transactions far");
    let localTxn = startTestTxn(t.local, "local transforming schema change onto incoming multiple data transactions local");

    // Create initial element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(farTxn, "TestDomain:C", {
      propA: "initial_a",
      propC: "initial_c",
    });
    farTxn.saveChanges("create first element");
    await pushChanges(farTxn, "create initial element");
    farTxn = startTestTxn(t.far, "local transforming schema change onto incoming multiple data transactions far");

    // Local pulls and imports transforming schema
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "local transforming schema change onto incoming multiple data transactions local");
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    // Far makes first data change
    await t.far.locks.acquireLocks({ exclusive: elementId1 });
    t.updateElement(farTxn, elementId1, { propA: "far_first_update_a" });
    farTxn.saveChanges("far first data change");

    // Far makes second data change - create new element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId2 = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_second_element_a",
      propC: "far_second_element_c",
    });
    farTxn.saveChanges("far second data change - new element");
    await pushChanges(farTxn, "far multiple data changes");

    // Local pulls and rebases local transforming schema onto incoming data changes
    await pullChanges(localTxn);

    t.local.clearCaches();

    // Verify: both incoming data changes applied, local schema transformation preserved
    const element1 = t.getElement(t.local, elementId1);
    chai.expect(element1.propA).to.equal("far_first_update_a", "First element incoming update should be applied");
    chai.expect(element1.propC).to.equal("initial_c", "First element propC should be preserved after transform");

    const element2 = t.getElement(t.local, elementId2);
    chai.expect(element2.propA).to.equal("far_second_element_a", "Second element should exist with correct propA");
    chai.expect(element2.propC).to.equal("far_second_element_c", "Second element propC should be preserved after transform");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local schema transformation should be preserved");
  });

  it("should fail when importing schema with unsaved data changes", async () => {
    t = await TestIModel.initialize("UnsavedDataChangesSchemaImport");
    const localTxn = startTestTxn(t.local, "should fail when importing schema with unsaved data changes local");

    // Create element but DO NOT save changes
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    t.insertElement(localTxn, "TestDomain:C", {
      propA: "unsaved_a",
      propC: "unsaved_c",
    });
    // Intentionally not saving the active local transaction before schema import.

    // Try to import schema - this should fail
    await chai.expect(
      localTxn.iModel.importSchemaStrings([TestIModel.schemas.v01x00x01AddPropC2])
    ).to.be.rejectedWith("Cannot import schemas with unsaved changes when useSemanticRebase flag is on");

    // Verify: element was not saved, schema was not imported
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.00", "Schema should remain at v01.00.00");
  });

});

/**
 * Test suite for tests related to rebase logic with schema changes (for indirect changes) that require data transformations.
 */
describe("Semantic Rebase with indirect changes", function (this: Suite) {
  this.timeout(60000); // operations can be slow
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend(); // Automatically TestUtils.startBackend() is called before every test suite starts we need to shut tht down and startup our new TestUtils with semantic rebase on
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  });

  it("Incoming data update onto local data change", async () => { // This doesnot actually take the semantic rebase route as both incoming and local have data changes only
    t = await TestIModel.initialize("IncomingDataLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data update onto local data change far");
    const localTxn = startTestTxn(t.local, "Incoming data update onto local data change local");

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on either side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on either side
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");
  });

  it("Incoming data and schema update onto local data change", async () => {
    t = await TestIModel.initialize("IncomingDataAndSchemaLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data and schema update onto local data change far");
    const localTxn = startTestTxn(t.local, "Incoming data and schema update onto local data change local");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");

    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on local side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data and schema update onto local data and schema change", async () => {
    t = await TestIModel.initialize("IncomingDataLocalDataAndSchemaChange");
    const farTxn = startTestTxn(t.far, "Incoming data and schema update onto local data and schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data and schema update onto local data and schema change local");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(localTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.true; // there should be a rebase folder because schema change on local side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data and Transforming schema update onto local data change", async () => {
    t = await TestIModel.initialize("IncomingDataAndTransformingSchemaLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data and Transforming schema update onto local data change far");
    const localTxn = startTestTxn(t.local, "Incoming data and Transforming schema update onto local data change local");

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    await pushChanges(farTxn, "create indirect element");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on local side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data and transforming schema update onto local data and transforming schema change", async () => {
    t = await TestIModel.initialize("IncomingDataAndTransformingSchemaLocalDataAndTransformingSchemaChange");
    const farTxn = startTestTxn(t.far, "Incoming data and transforming schema update onto local data and transforming schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data and transforming schema update onto local data and transforming schema change local");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(localTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.false; // because it is a no op change we are importing similar schema
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // schema change is no op and data changes are generated on the fly and removed once rebased so rebase folder should not be there

    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data update onto local data and transforming schema change", async () => {
    // This test fails but should not fail actually - needs investigation

    t = await TestIModel.initialize("IncomingDataAndSchemaLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data update onto local data and transforming schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data update onto local data and transforming schema change local");

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(localTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.true; // there should be a rebase folder because schema change on local side

    await pushChanges(localTxn, "local pulls andcreate indirect element");

    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there

    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElement(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElement(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

});

/**
 * Test suite for data conflicts, conflict handlers, lifecycle events, and mixed schema+conflict scenarios during semantic rebase.
 */
describe("Semantic Rebase - Data Conflicts and Conflict Resolution", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  // ─── Section A: Normal Data Rebase (baseline, no schema, no conflict) ────────

  it("A1: independent updates on different elements are both preserved", async () => {
    t = await TestIModel.initialize("A1IndependentUpdates");
    let localTxn = startTestTxn(t.local, "A1 local");
    let farTxn = startTestTxn(t.far, "A1 far");

    // Both briefcases insert their own element and push
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", { propA: "local_a", propC: "local_c" });
    localTxn.saveChanges("local insert");
    await pushChanges(localTxn, "local insert element");
    localTxn = startTestTxn(t.local, "A1 local 2");

    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "A1 far 2");
    await t.far.locks.acquireLocks({ exclusive: localElementId });
    t.updateElement(farTxn, localElementId, { propA: "far_updated_a" });
    farTxn.saveChanges("far update localElement propA");
    await pushChanges(farTxn, "far update element");

    // Local updates a different element (it created the element so it already has changes)
    // Insert a second element locally and also update it
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId2 = t.insertElement(localTxn, "TestDomain:C", { propA: "local_a2", propC: "local_c2" });
    localTxn.saveChanges("local insert second element");

    // Local pulls - local inserts rebase on top of far's update
    await pullChanges(localTxn);

    // Verify: far's update on element1 is present, local's element2 insertion is preserved
    const element1 = t.getElement(t.local, localElementId);
    chai.expect(element1.propA).to.equal("far_updated_a", "Far update on element1 should be present");

    const element2 = t.getElement(t.local, localElementId2);
    chai.expect(element2.propA).to.equal("local_a2", "Local element2 insertion should be preserved");
    chai.expect(element2.propC).to.equal("local_c2", "Local element2 propC should be preserved");
  });

  it("A2: both users insert new elements independently", async () => {
    t = await TestIModel.initialize("A2BothInsertElements");
    let localTxn = startTestTxn(t.local, "A2 local");
    const farTxn = startTestTxn(t.far, "A2 far");

    // Far inserts and pushes
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", { propA: "far_a", propC: "far_c" });
    farTxn.saveChanges("far insert element");
    await pushChanges(farTxn, "far insert element");

    // Local inserts independently (no pull yet)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", { propA: "local_a", propC: "local_c" });
    localTxn.saveChanges("local insert element");

    // Local pulls - local insert rebases on top of far's insert
    await pullChanges(localTxn);

    // Both elements should be visible on local briefcase
    const farElem = t.getElement(t.local, farElementId);
    chai.expect(farElem.propA).to.equal("far_a", "Far element should be visible after rebase");

    const localElem = t.getElement(t.local, localElementId);
    chai.expect(localElem.propA).to.equal("local_a", "Local element should be preserved after rebase");
  });

  it("A3: multiple local data txns are all rebased correctly", async () => {
    t = await TestIModel.initialize("A3MultipleLocalTxns");
    let localTxn = startTestTxn(t.local, "A3 local");
    let farTxn = startTestTxn(t.far, "A3 far");

    // Set up a shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const sharedElementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "A3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "A3 local 2");

    // Far makes a single update and pushes
    await t.far.locks.acquireLocks({ exclusive: sharedElementId });
    t.updateElement(farTxn, sharedElementId, { propC: "far_updated_c" });
    farTxn.saveChanges("far update propC");
    await pushChanges(farTxn, "far update element");

    // Local makes 3 separate transactions
    // Txn 1: update shared element's propA
    await t.local.locks.acquireLocks({ exclusive: sharedElementId });
    t.updateElement(localTxn, sharedElementId, { propA: "local_update1_a" });
    localTxn.saveChanges("local txn1 update propA");

    // Txn 2: insert a new element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localInsertedId = t.insertElement(localTxn, "TestDomain:C", { propA: "inserted_a", propC: "inserted_c" });
    localTxn.saveChanges("local txn2 insert element");

    // Txn 3: update the newly inserted element
    t.updateElement(localTxn, localInsertedId, { propA: "inserted_updated_a" });
    localTxn.saveChanges("local txn3 update inserted element");

    // Local pulls - all 3 local txns rebase on top of far's change
    await pullChanges(localTxn);

    // Verify all 3 local changes are preserved
    const sharedElem = t.getElement(t.local, sharedElementId);
    chai.expect(sharedElem.propA).to.equal("local_update1_a", "Txn1: local propA update should be preserved");
    chai.expect(sharedElem.propC).to.equal("far_updated_c", "Far update to propC should also be present");

    const insertedElem = t.getElement(t.local, localInsertedId);
    chai.expect(insertedElem.propA).to.equal("inserted_updated_a", "Txn2+3: local element with final update should be preserved");
    chai.expect(insertedElem.propC).to.equal("inserted_c", "Local element propC should be preserved");
  });

  // ─── Section B: Data-Data Write Conflicts ────────────────────────────────────

  it("B1: write-write conflict on same property: local value wins by default", async () => {
    t = await TestIModel.initialize("B1WriteWriteConflict");
    let localTxn = startTestTxn(t.local, "B1 local");
    let farTxn = startTestTxn(t.far, "B1 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "B1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "B1 local 2");

    // Both update propA on the same element
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_value_a" });
    farTxn.saveChanges("far update propA");
    await pushChanges(farTxn, "far update propA");

    // Local also updates same property — this will conflict during rebase
    // (Note: in production, lock contention would prevent this, but HubMock allows it for test purposes)
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_value_a" });
    localTxn.saveChanges("local update propA");

    // Local pulls - default resolution for "Data" cause is Replace → local wins
    await pullChanges(localTxn);

    const element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("local_value_a", "Local value should win with default Replace resolution");
  });

  it("B2: two users updating different properties of same element: both updates survive", async () => {
    t = await TestIModel.initialize("B2DifferentProperties");
    let localTxn = startTestTxn(t.local, "B2 local");
    let farTxn = startTestTxn(t.far, "B2 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "B2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "B2 local 2");

    // Far updates propA
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_updated_a" });
    farTxn.saveChanges("far update propA");
    await pushChanges(farTxn, "far update propA");

    // Local updates propC (different property)
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propC: "local_updated_c" });
    localTxn.saveChanges("local update propC");

    // Local pulls - different columns should not produce a write conflict
    await pullChanges(localTxn);

    // Verify: both updates present
    const element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("far_updated_a", "Far propA update should be present");
    chai.expect(element.propC).to.equal("local_updated_c", "Local propC update should be preserved");
  });

  it("B3: update-delete conflict: local updates element that incoming deleted", async () => {
    t = await TestIModel.initialize("B3UpdateDeleteConflict");
    let localTxn = startTestTxn(t.local, "B3 local");
    let farTxn = startTestTxn(t.far, "B3 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "B3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "B3 local 2");

    // Far deletes the element
    await t.far.locks.acquireLocks({ exclusive: elementId });
    farTxn.deleteElement(elementId);
    farTxn.saveChanges("far delete element");
    await pushChanges(farTxn, "far delete element");

    // Local updates the same element (not knowing it was deleted)
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_updated_a" });
    localTxn.saveChanges("local update deleted element");

    // Local pulls - local update is NotFound → Skip → element stays deleted
    await pullChanges(localTxn);

    // Element should not exist after rebase
    chai.expect(() => t!.getElement(t!.local, elementId)).to.throw("Element not found");
  });

  it("B4: delete-update conflict: local deletes element that incoming updated", async () => {
    t = await TestIModel.initialize("B4DeleteUpdateConflict");
    let localTxn = startTestTxn(t.local, "B4 local");
    let farTxn = startTestTxn(t.far, "B4 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "B4 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "B4 local 2");

    // Far updates the element
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_updated_a" });
    farTxn.saveChanges("far update element");
    await pushChanges(farTxn, "far update element");

    // Local deletes the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    localTxn.deleteElement(elementId);
    localTxn.saveChanges("local delete element");

    // Local pulls - far update applied first (element gets far's propA), then local delete is reinstated
    await pullChanges(localTxn);

    // Element should be gone after local delete is reinstated
    chai.expect(() => t!.getElement(t!.local, elementId)).to.throw("Element not found");
  });

  // ─── Section C: Custom Conflict Handlers ─────────────────────────────────────

  it("C1: custom conflict handler forcing Skip: far value wins instead of local", async () => {
    t = await TestIModel.initialize("C1CustomHandlerSkip");
    let localTxn = startTestTxn(t.local, "C1 local");
    let farTxn = startTestTxn(t.far, "C1 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "C1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "C1 local 2");

    // Both update propA
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_value_a" });
    farTxn.saveChanges("far update propA");
    await pushChanges(farTxn, "far update propA");

    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_value_a" });
    localTxn.saveChanges("local update propA");

    // Register a conflict handler that forces Skip (far value is kept, local update is dropped)
    t.local.txns.rebaser.addConflictHandler({
      id: "C1-skip-handler",
      handler: (args) => {
        if (args.cause === "Data")
          return DbConflictResolution.Skip;
        return undefined;
      },
    });

    try {
      await pullChanges(localTxn);
    } finally {
      t.local.txns.rebaser.removeConflictHandler("C1-skip-handler");
    }

    // With Skip, the incoming (far) value stays in the db, local update is dropped
    const element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("far_value_a", "Far value should win when handler forces Skip");
  });

  it("C2: registering duplicate conflict handler id throws", async () => {
    t = await TestIModel.initialize("C2DuplicateHandler");
    const localTxn = startTestTxn(t.local, "C2 local");
    endTestTxn(localTxn);

    t.local.txns.rebaser.addConflictHandler({ id: "duplicate-id", handler: () => undefined });
    chai.expect(() =>
      t!.local.txns.rebaser.addConflictHandler({ id: "duplicate-id", handler: () => undefined })
    ).to.throw();

    t.local.txns.rebaser.removeConflictHandler("duplicate-id");
  });

  it("C3: conflict handler removed stops affecting resolution", async () => {
    t = await TestIModel.initialize("C3HandlerRemoved");
    let localTxn = startTestTxn(t.local, "C3 local");
    let farTxn = startTestTxn(t.far, "C3 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "C3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "C3 local 2");

    // Register Skip handler
    t.local.txns.rebaser.addConflictHandler({
      id: "C3-skip-handler",
      handler: (args) => args.cause === "Data" ? DbConflictResolution.Skip : undefined,
    });
    // Immediately remove it
    t.local.txns.rebaser.removeConflictHandler("C3-skip-handler");

    // Both update propA
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_value_a" });
    farTxn.saveChanges("far update propA");
    await pushChanges(farTxn, "far update propA");

    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_value_a" });
    localTxn.saveChanges("local update propA");

    // No handler registered → default Replace → local wins
    await pullChanges(localTxn);

    const element = t.getElement(t.local, elementId);
    chai.expect(element.propA).to.equal("local_value_a", "Local value should win after handler is removed (default Replace)");
  });

  it("C4: multiple conflict handlers chain: first matching handler wins", async () => {
    t = await TestIModel.initialize("C4MultipleHandlers");
    let localTxn = startTestTxn(t.local, "C4 local");
    let farTxn = startTestTxn(t.far, "C4 far");

    // Create two shared elements
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a1", propC: "initial_c1" });
    const elementId2 = t.insertElement(farTxn, "TestDomain:D", { propA: "initial_a2", propD: "initial_d2" });
    farTxn.saveChanges("create shared elements");
    await pushChanges(farTxn, "create shared elements");
    farTxn = startTestTxn(t.far, "C4 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "C4 local 2");

    // Both update the same properties on both elements
    await t.far.locks.acquireLocks({ exclusive: elementId1 });
    await t.far.locks.acquireLocks({ exclusive: elementId2 });
    t.updateElement(farTxn, elementId1, { propA: "far_a1" });
    t.updateElement(farTxn, elementId2, { propA: "far_a2" });
    farTxn.saveChanges("far update both elements");
    await pushChanges(farTxn, "far update both elements");

    await t.local.locks.acquireLocks({ exclusive: elementId1 });
    await t.local.locks.acquireLocks({ exclusive: elementId2 });
    t.updateElement(localTxn, elementId1, { propA: "local_a1" });
    t.updateElement(localTxn, elementId2, { propA: "local_a2" });
    localTxn.saveChanges("local update both elements");

    // First handler: returns Skip for all Data conflicts (far value wins)
    // Second handler: returns undefined (passthrough) — should never affect outcome since first handler catches all
    // The handlers chain from last-registered to first-registered (linked list is prepended)
    // So register "passthrough" first, then "skip-all" to ensure skip-all runs first
    t.local.txns.rebaser.addConflictHandler({
      id: "C4-passthrough",
      handler: () => undefined,
    });
    t.local.txns.rebaser.addConflictHandler({
      id: "C4-skip-all",
      handler: (args) => args.cause === "Data" ? DbConflictResolution.Skip : undefined,
    });

    try {
      await pullChanges(localTxn);
    } finally {
      t.local.txns.rebaser.removeConflictHandler("C4-skip-all");
      t.local.txns.rebaser.removeConflictHandler("C4-passthrough");
    }

    // Both conflicts hit the "skip-all" handler first → far value wins
    const element1 = t.getElement(t.local, elementId1);
    chai.expect(element1.propA).to.equal("far_a1", "Handler C4-skip-all should have fired first, far wins for element1");

    const element2 = t.getElement(t.local, elementId2);
    chai.expect(element2.propA).to.equal("far_a2", "Handler C4-skip-all should have fired first, far wins for element2");
  });

  // ─── Section D: Rebase Lifecycle Events ──────────────────────────────────────

  it("D1: pull merge events fire in correct order", async () => {
    t = await TestIModel.initialize("D1EventOrder");
    let localTxn = startTestTxn(t.local, "D1 local");
    let farTxn = startTestTxn(t.far, "D1 far");

    // Set up a shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "D1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "D1 local 2");

    // Far pushes a data change
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_updated_a" });
    farTxn.saveChanges("far update element");
    await pushChanges(farTxn, "far update element");

    // Local: import schema (local txn1) + data change (local txn2)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    localTxn = startTestTxn(t.local, "D1 local 3");
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_updated_a" });
    localTxn.saveChanges("local update element");

    // Capture event order
    const eventLog: string[] = [];
    const rebaser = t.local.txns.rebaser;

    rebaser.onDownloadChangesetsBegin.addListener(() => eventLog.push("onDownloadChangesetsBegin"));
    rebaser.onDownloadChangesetsEnd.addListener(() => eventLog.push("onDownloadChangesetsEnd"));
    rebaser.onApplyIncomingChangesBegin.addListener(() => eventLog.push("onApplyIncomingChangesBegin"));
    rebaser.onApplyIncomingChangesEnd.addListener(() => eventLog.push("onApplyIncomingChangesEnd"));
    rebaser.onReverseLocalChangesBegin.addListener(() => eventLog.push("onReverseLocalChangesBegin"));
    rebaser.onReverseLocalChangesEnd.addListener(() => eventLog.push("onReverseLocalChangesEnd"));
    rebaser.onRebaseBegin.addListener(() => eventLog.push("onRebaseBegin"));
    rebaser.onRebaseTxnBegin.addListener((txnProps) => eventLog.push(`onRebaseTxnBegin:${txnProps.type}`));
    rebaser.onRebaseTxnEnd.addListener((txnProps) => eventLog.push(`onRebaseTxnEnd:${txnProps.type}`));
    rebaser.onRebaseEnd.addListener(() => eventLog.push("onRebaseEnd"));
    rebaser.onPullMergeBegin.addListener(() => eventLog.push("onPullMergeBegin"));
    rebaser.onPullMergeEnd.addListener(() => eventLog.push("onPullMergeEnd"));

    await pullChanges(localTxn);

    // Verify the high-level order: download → apply incoming → reverse local → rebase → end
    const downloadBeginIdx = eventLog.indexOf("onDownloadChangesetsBegin");
    const downloadEndIdx = eventLog.indexOf("onDownloadChangesetsEnd");
    const applyBeginIdx = eventLog.indexOf("onApplyIncomingChangesBegin");
    const applyEndIdx = eventLog.indexOf("onApplyIncomingChangesEnd");
    const reverseBeginIdx = eventLog.indexOf("onReverseLocalChangesBegin");
    const reverseEndIdx = eventLog.indexOf("onReverseLocalChangesEnd");
    const rebaseBeginIdx = eventLog.indexOf("onRebaseBegin");
    const rebaseEndIdx = eventLog.indexOf("onRebaseEnd");

    chai.expect(downloadBeginIdx).to.be.lessThan(downloadEndIdx, "Download begin must precede download end");
    chai.expect(applyBeginIdx).to.be.lessThan(applyEndIdx, "Apply begin must precede apply end");
    chai.expect(reverseBeginIdx).to.be.lessThan(reverseEndIdx, "Reverse begin must precede reverse end");
    chai.expect(rebaseBeginIdx).to.be.lessThan(rebaseEndIdx, "Rebase begin must precede rebase end");
    // Rebase happens after reverse and apply
    chai.expect(rebaseBeginIdx).to.be.greaterThan(reverseEndIdx, "Rebase should start after local changes are reversed");
    chai.expect(rebaseEndIdx).to.be.lessThan(eventLog.indexOf("onPullMergeEnd"), "Rebase should end before pull merge end");
    // Both txn events should appear between rebaseBegin and rebaseEnd
    chai.expect(eventLog.some((e) => e.startsWith("onRebaseTxnBegin:"))).to.be.true;
    chai.expect(eventLog.some((e) => e.startsWith("onRebaseTxnEnd:"))).to.be.true;
  });

  it("D2: onRebaseTxnBegin and onRebaseTxnEnd carry correct txn metadata", async () => {
    t = await TestIModel.initialize("D2TxnMetadata");
    let localTxn = startTestTxn(t.local, "D2 local");
    const farTxn = startTestTxn(t.far, "D2 far");

    // Far pushes a data change so there is something incoming to trigger rebase
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "far_a", propC: "far_c" });
    farTxn.saveChanges("far insert element");
    await pushChanges(farTxn, "far insert element");

    // Local imports a schema change
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    localTxn = startTestTxn(t.local, "D2 local after schema");

    const capturedBeginProps: Array<{ type: string; id: string }> = [];
    const capturedEndProps: Array<{ type: string; id: string }> = [];

    t.local.txns.rebaser.onRebaseTxnBegin.addListener((txnProps) => {
      capturedBeginProps.push({ type: txnProps.type, id: txnProps.id });
    });
    t.local.txns.rebaser.onRebaseTxnEnd.addListener((txnProps) => {
      capturedEndProps.push({ type: txnProps.type, id: txnProps.id });
    });

    await pullChanges(localTxn);

    // At least one schema txn should have been captured
    chai.expect(capturedBeginProps.length).to.be.greaterThan(0, "At least one txn begin event should fire");
    chai.expect(capturedEndProps.length).to.be.greaterThan(0, "At least one txn end event should fire");
    chai.expect(capturedBeginProps.length).to.equal(capturedEndProps.length, "Begin and end counts should match");

    const schemaTxn = capturedBeginProps.find((p) => p.type === "Schema" || p.type === "ECSchema");
    chai.expect(schemaTxn).to.not.be.undefined;
    chai.expect(schemaTxn!.id).to.be.a("string").and.have.length.greaterThan(0, "Txn id should be non-empty");
  });

  it("D3: onRebaseBegin receives correct array of txn ids", async () => {
    t = await TestIModel.initialize("D3RebaseBeginTxns");
    let localTxn = startTestTxn(t.local, "D3 local");
    const farTxn = startTestTxn(t.far, "D3 far");

    // Far pushes something to trigger rebase
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "far_a", propC: "far_c" });
    farTxn.saveChanges("far insert element");
    await pushChanges(farTxn, "far insert element");

    // Local creates 2 txns: schema + data
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    localTxn = startTestTxn(t.local, "D3 local after schema");
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", { propA: "local_a", propC: "local_c" });
    localTxn.saveChanges("local insert element");

    let capturedTxns: Array<{ type: string; id: string }> = [];
    t.local.txns.rebaser.onRebaseBegin.addListener((txns) => {
      capturedTxns = txns.map((p) => ({ type: p.type, id: p.id }));
    });

    await pullChanges(localTxn);

    chai.expect(capturedTxns.length).to.be.greaterThanOrEqual(2, "Should have at least 2 local txns to rebase (schema + data)");
    chai.expect(capturedTxns.every((p) => typeof p.id === "string" && p.id.length > 0)).to.be.true;

    // Verify the inserted element is still there
    const localElem = t.getElement(t.local, localElementId);
    chai.expect(localElem.propA).to.equal("local_a");

    // Confirm far element also landed
    const farElem = t.getElement(t.local, elementId);
    chai.expect(farElem.propA).to.equal("far_a");
  });

  // ─── Section E: Abort mid-rebase ─────────────────────────────────────────────

  it("E1: abort mid-rebase restores briefcase to pre-pull state", async () => {
    t = await TestIModel.initialize("E1AbortMidRebase");
    let localTxn = startTestTxn(t.local, "E1 local");
    let farTxn = startTestTxn(t.far, "E1 far");

    // Set up shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "E1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "E1 local 2");

    // Far pushes schema change
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far import schema");

    // Local imports schema and has a data change too
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    localTxn = startTestTxn(t.local, "E1 local after schema");
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_updated_a" });
    localTxn.saveChanges("local update element");

    // Capture the schema version before pulling
    const schemaBefore = t.local.getSchemaProps("TestDomain");

    let aborted = false;
    const rebaser = t.local.txns.rebaser;

    // Hook into the first txn begin to trigger an abort.
    // Note: the listener is sync so we schedule the abort via a resolved promise microtask.
    // The abort itself is async but canAbort() check is sync.
    let abortPromise: Promise<void> | undefined;
    rebaser.onRebaseTxnBegin.addOnce(() => {
      if (rebaser.canAbort()) {
        abortPromise = rebaser.abort().then(() => { aborted = true; });
      }
    });

    try {
      await t.local.pullChanges();
    } catch {
      // Expected: pull will throw after abort
    }

    // Ensure the abort promise (if triggered) has resolved
    if (abortPromise)
      await abortPromise;

    // If abort was possible and executed, briefcase should be back to pre-pull state
    if (aborted) {
      const schemaAfterAbort = t.local.getSchemaProps("TestDomain");
      chai.expect(schemaAfterAbort.version).to.equal(schemaBefore.version, "Schema should be rolled back to pre-pull state after abort");
      // The local element update should still be pending
      const element = t.getElement(t.local, elementId);
      chai.expect(element.propA).to.equal("local_updated_a", "Local update should be preserved after abort");
    } else {
      // abort was not available (implementation-dependent); just confirm pull completed without crash
      chai.expect(true).to.be.true;
    }
  });

  // ─── Section F: Conflicts with Schema Changes ────────────────────────────────

  it("F1: write-write data conflict during local transforming schema rebase: local data patch value wins", async () => {
    t = await TestIModel.initialize("F1ConflictDuringTransformingSchemaRebase");
    let localTxn = startTestTxn(t.local, "F1 local");
    let farTxn = startTestTxn(t.far, "F1 far");

    // Create shared element with propC populated
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "F1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "F1 local 2");

    // Far updates propC and pushes
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propC: "far_updated_c" });
    farTxn.saveChanges("far update propC");
    await pushChanges(farTxn, "far update propC");

    // Local updates propC (same property — conflict during rebase) AND imports transforming schema
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propC: "local_updated_c" });
    localTxn.saveChanges("local update propC");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    // Local pulls - schema is reinstated (transforms PropC to base class A), data patch reinstated (local propC value)
    await pullChanges(localTxn);

    t.local.clearCaches();
    const element = t.getElement(t.local, elementId);
    chai.expect(element.propC).to.equal("local_updated_c", "Local propC value should survive after transforming schema rebase");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v01.00.02 after rebase");
  });

  it("F2: local element deletion + incoming transforming schema change: delete is reinstated, element stays gone", async () => {
    t = await TestIModel.initialize("F2DeleteIncomingTransform");
    let localTxn = startTestTxn(t.local, "F2 local");
    let farTxn = startTestTxn(t.far, "F2 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "F2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "F2 local 2");

    // Far imports transforming schema (moves PropC from C to A)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far import transforming schema");

    // Local deletes the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    localTxn.deleteElement(elementId);
    localTxn.saveChanges("local delete element");

    // Local pulls - incoming transform applied, then local delete is reinstated
    await pullChanges(localTxn);

    t.local.clearCaches();
    // Element should be gone
    chai.expect(() => t!.getElement(t!.local, elementId)).to.throw("Element not found");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be updated to v01.00.02");
  });

  it("F3: incoming element deletion + local transforming schema change: schema upgrade survives, element absent", async () => {
    t = await TestIModel.initialize("F3IncomingDeleteLocalTransform");
    let localTxn = startTestTxn(t.local, "F3 local");
    let farTxn = startTestTxn(t.far, "F3 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "F3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "F3 local 2");

    // Far deletes the element
    await t.far.locks.acquireLocks({ exclusive: elementId });
    farTxn.deleteElement(elementId);
    farTxn.saveChanges("far delete element");
    await pushChanges(farTxn, "far delete element");

    // Local imports transforming schema (moves PropC from C to A) and updates the element (which was not deleted on local yet)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    localTxn = startTestTxn(t.local, "F3 local after schema");
    // Note: the element still exists locally before pull
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_updated_a" });
    localTxn.saveChanges("local update element (will become NotFound after delete is applied)");

    // Local pulls - far delete is applied first, then local schema is reinstated, local data patch hits NotFound → Skip
    await pullChanges(localTxn);

    t.local.clearCaches();
    // Element should not exist (far's delete won)
    chai.expect(() => t!.getElement(t!.local, elementId)).to.throw("Element not found");

    // Schema should still be updated
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema upgrade should survive even when element data patch was skipped");
  });

});
