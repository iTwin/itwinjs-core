/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import * as chai from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, ChannelControl, DrawingCategory } from "@itwin/core-backend";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";

/**
 * Test infrastructure for semantic rebase performance tests.
 * Manages two briefcases (far and local) for testing rebase operations.
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

    /** v01.00.01 adds PropC2 to class C */
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
  };

  /**
   * Create and initialize a new test iModel with far and local briefcases.
   * @param testName Unique name for this test (passed to HubMock.startup)
   * @returns Fully initialized TestIModel with both briefcases open
   */
  public static async initialize(testName: string): Promise<TestIModel> {
    HubMock.startup(testName, KnownTestLocations.outputDir);

    const iModelId = await HubMock.createNewIModel({
      iTwinId: HubMock.iTwinId,
      iModelName: testName,
      description: `Semantic rebase performance tests: ${testName}`,
    });

    // Open far briefcase and use it for initialization
    const far = await HubWrappers.downloadAndOpenBriefcase({
      iTwinId: HubMock.iTwinId,
      iModelId,
      accessToken: "far-user",
    });
    far.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    far.saveChanges();

    // Initialize with base schema
    await far.importSchemaStrings([TestIModel.schemas.v01x00x00]);
    far.saveChanges("import base schema");
    await far.pushChanges({ description: "import base schema" });

    // Create model and category
    const modelCode = IModelTestUtils.getUniqueModelCode(far, "DrawingModel");
    await far.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(far, modelCode);
    const drawingCategoryId = DrawingCategory.insert(
      far,
      IModel.dictionaryId,
      "DrawingCategory",
      new SubCategoryAppearance()
    );
    far.saveChanges();
    await far.pushChanges({ description: "create model and category" });

    // Open local briefcase
    const local = await HubWrappers.downloadAndOpenBriefcase({
      iTwinId: HubMock.iTwinId,
      iModelId,
      accessToken: "local-user",
    });
    local.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    local.saveChanges();

    return new TestIModel(iModelId, drawingModelId, drawingCategoryId, far, local);
  }

  public insertElement(
    briefcase: BriefcaseDb,
    className: string,
    properties: Record<string, any>
  ): Id64String {
    const elementProps: GeometricElementProps = {
      classFullName: className,
      model: this.drawingModelId,
      category: this.drawingCategoryId,
      code: Code.createEmpty(),
      ...properties,
    };
    const element = briefcase.elements.createElement(elementProps);
    return briefcase.elements.insertElement(element.toJSON());
  }

  public shutdown(): void {
    this.far.close();
    this.local.close();
    HubMock.shutdown();
  }
}

/**
 * Test suite for performance tests related to rebase logic with schema changes that require data transformations.
 *
 * These tests are skipped by default (.skip) and are intended to be run manually when measuring performance.
 * They test scenarios with and without high-level merge operations to compare rebase performance.
 */
describe("Semantic Rebase performance tests", function (this: Suite) {
  this.timeout(60000); // operations can be slow
  let t: TestIModel | undefined;

  before(async () => {
    // Note: In core/backend tests, we call TestUtils.shutdownBackend() and TestUtils.startBackend({ useSemanticRebase: true })
    // For full-stack-tests, IModelHost is already started with appropriate configuration via StartupShutdown.ts
    // If semantic rebase needs to be enabled, it should be configured in the test environment setup
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    // IModelHost shutdown is handled by the test environment
  });

  // PERFORMANCE TESTS. These are not intended to be run as part of regular CI - they are here to allow easy manual execution and measurement as needed.
  it.skip("performance: rebase 10k local insertions without high-level merge (no incoming schema change)", async () => {
    t = await TestIModel.initialize("PerfTestNoHighLevelMerge");

    // Far creates a data change (single element)
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    t.insertElement(t.far, "TestDomain:D", {
      propA: "far_value_a",
      propD: "far_value_d",
    });
    t.far.saveChanges("far creates element");
    await t.far.pushChanges({ description: "far creates element" });

    // Local imports schema change (v01.00.01 - adds PropC2)
    await t.local.importSchemaStrings([TestIModel.schemas.v01x00x01AddPropC2]);
    t.local.saveChanges("local schema update");

    // Local creates 10k elements - measure time
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const insertCount = 10_000;
    // eslint-disable-next-line no-console
    console.log(`Inserting ${insertCount.toLocaleString()} elements locally...`);

    const insertStartTime = Date.now();
    for (let i = 0; i < insertCount; i++) {
      t.insertElement(t.local, "TestDomain:C", {
        propA: `value_a_${i}`,
        propC: `value_c_${i}`,
      });
    }
    t.local.saveChanges("final batch insert");
    const insertEndTime = Date.now();
    const insertDuration = (insertEndTime - insertStartTime) / 1000;
    // eslint-disable-next-line no-console
    console.log(`Insert and save completed in ${insertDuration.toFixed(2)} seconds`);

    // Measure rebase time (pull changes with no incoming schema change)
    // eslint-disable-next-line no-console
    console.log("Starting rebase (pull)...");
    const rebaseStartTime = Date.now();
    await t.local.pullChanges();
    const rebaseEndTime = Date.now();
    const rebaseDuration = (rebaseEndTime - rebaseStartTime) / 1000;
    // eslint-disable-next-line no-console
    console.log(`Rebase completed in ${rebaseDuration.toFixed(2)} seconds`);

    // Verify final instance count
    let actualCount = 0;
    for await (const row of t.local.createQueryReader("SELECT COUNT(*) as [count] FROM td.A")) {
      actualCount = row.count;
    }
    const expectedCount = insertCount + 1; // 10K local + 1 far element
    chai.expect(actualCount).to.equal(expectedCount, `Should have ${expectedCount.toLocaleString()} total elements`);

    // eslint-disable-next-line no-console
    console.log(`Performance summary (no high-level merge):`);
    // eslint-disable-next-line no-console
    console.log(`  - Insert/save time: ${insertDuration.toFixed(2)}s`);
    // eslint-disable-next-line no-console
    console.log(`  - Rebase time: ${rebaseDuration.toFixed(2)}s`);
  });

  it.skip("performance: rebase 10k local insertions with high-level merge (incoming schema change)", async () => {
    t = await TestIModel.initialize("PerfTestWithHighLevelMerge");

    await t.far.importSchemaStrings([TestIModel.schemas.v01x00x01AddPropC2]);
    t.far.saveChanges("far schema update");
    await t.far.pushChanges({ description: "far schema update to v01.00.01" });

    // Far creates a data change (single element)
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    t.insertElement(t.far, "TestDomain:D", {
      propA: "far_value_a",
      propD: "far_value_d",
    });
    t.far.saveChanges("far creates element");
    await t.far.pushChanges({ description: "far creates element" });

    await t.local.importSchemaStrings([TestIModel.schemas.v01x00x01AddPropC2]);
    t.local.saveChanges("local schema update");

    // Local creates 10k elements - measure time
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const insertCount = 10_000;
    // eslint-disable-next-line no-console
    console.log(`Inserting ${insertCount.toLocaleString()} elements locally...`);

    const insertStartTime = Date.now();
    for (let i = 0; i < insertCount; i++) {
      t.insertElement(t.local, "TestDomain:C", {
        propA: `value_a_${i}`,
        propC: `value_c_${i}`,
      });
    }
    t.local.saveChanges("final batch insert");
    const insertEndTime = Date.now();
    const insertDuration = (insertEndTime - insertStartTime) / 1000;
    // eslint-disable-next-line no-console
    console.log(`Insert and save completed in ${insertDuration.toFixed(2)} seconds`);

    // Measure rebase time (pull changes WITH incoming schema change - triggers high-level merge)
    // eslint-disable-next-line no-console
    console.log("Starting rebase with high-level merge (pull)...");
    const rebaseStartTime = Date.now();
    await t.local.pullChanges();
    const rebaseEndTime = Date.now();
    const rebaseDuration = (rebaseEndTime - rebaseStartTime) / 1000;
    // eslint-disable-next-line no-console
    console.log(`Rebase with high-level merge completed in ${rebaseDuration.toFixed(2)} seconds`);

    // Verify final instance count
    let actualCount = 0;
    for await (const row of t.local.createQueryReader("SELECT COUNT(*) as [count] FROM td.A")) {
      actualCount = row.count;
    }
    const expectedCount = insertCount + 1; // 10k local + 1 far element
    chai.expect(actualCount).to.equal(expectedCount, `Should have ${expectedCount.toLocaleString()} total elements`);

    // eslint-disable-next-line no-console
    console.log(`Performance summary (with high-level merge):`);
    // eslint-disable-next-line no-console
    console.log(`  - Insert/save time: ${insertDuration.toFixed(2)}s`);
    // eslint-disable-next-line no-console
    console.log(`  - Rebase time: ${rebaseDuration.toFixed(2)}s`);
  });

});
