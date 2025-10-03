/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ChangesetECAdaptor, ChannelControl, DrawingCategory, ECChangeUnifierCache, IModelHost, PartialECChangeUnifier, SqliteChangesetReader } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils } from "@itwin/core-backend/lib/cjs/test/index";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/KnownTestLocations";
import { GuidString, Id64, StopWatch } from "@itwin/core-bentley";
import { Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { assert, expect } from "chai";
import * as path from "node:path";

describe("ChangesetReaderAPI", async () => {
  let iTwinId: GuidString;
  const reporter = new Reporter();

  before(async () => {
    await IModelHost.startup();
    HubMock.startup("ChangesetReaderTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });
  after(async () => {
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResultsChangesetReader.csv");
    // eslint-disable-next-line no-console
    console.log(`Performance results are stored in ${csvPath}`);
    reporter.exportCSV(csvPath);

    HubMock.shutdown()
    await IModelHost.shutdown();
  });

  it("Large Changeset Performance - InMemoryCache", async () => {
    const adminToken = "super manager token";
    const iModelName = "LargeChangesetTest";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);

    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    // Import schema
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="TestElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="name" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());

    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "Initial Test Data Setup", accessToken: adminToken });

    // Create changesets with different number of inserts
    const testCases = [
      { testCaseNum: 1, numElements: 1000 },
      { testCaseNum: 2, numElements: 10000 },
      { testCaseNum: 3, numElements: 100000 },
      // { testCaseNum: 4, numElements: 1000000 },
      // { testCaseNum: 5, numElements: 10000000 },
    ];

    const elementPropsTemplate = {
      classFullName: "TestDomain:TestElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
    };

    for (const testCase of testCases) {
      await rwIModel.locks.acquireLocks({ shared: drawingModelId });
      for (let i = 0; i < testCase.numElements; i++) {
        const elementProps = {
          ...elementPropsTemplate,
          name: `Element_${testCase.numElements}_${i}`,
        };
        assert.isTrue(Id64.isValidId64(rwIModel.elements.insertElement(elementProps)), `Failed to insert element ${elementProps.name}`);
      }
      rwIModel.saveChanges();
      await rwIModel.pushChanges({ description: `Changeset with ${testCase.numElements} inserts`, accessToken: adminToken });
    }

    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir }); // Get all changesets

    for (const testCase of testCases) {
      // Open the changesets one by one and read the changes
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[testCase.testCaseNum].pathname, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ChangesetECAdaptor(reader);
      const unifier = new PartialECChangeUnifier(reader.db, ECChangeUnifierCache.createInMemoryCache());
      adaptor.acceptOp("Inserted");
      assert.equal(unifier.getInstanceCount(), 0, "Unifier should be empty before any changes are applied");

      const watch = new StopWatch();
      watch.start();

      while (adaptor.step())
        unifier.appendFrom(adaptor);

      watch.stop();

      assert.equal(unifier.getInstanceCount(), testCase.numElements, "Number of instances should match the number of inserted elements til now");
      reporter.addEntry("ChangesetReaderAPI", "Unifier-InMemoryCache", "Execution time (seconds)", watch.elapsedSeconds, { iModelId: rwIModelId, changesetId: changesets[testCase.testCaseNum].id, changesetInserts: testCase.numElements });
    }
    rwIModel.close();
  });

  it("Large Changeset Performance - SqliteBackedCache", async () => {
    const adminToken = "super manager token";
    const iModelName = "LargeChangesetTest";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);

    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    // Import schema
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="TestElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="name" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());

    rwIModel.saveChanges();
    await rwIModel.pushChanges({ description: "Initial Test Data Setup", accessToken: adminToken });

    // Create changesets with different number of inserts
    const testCases = [
      { testCaseNum: 1, numElements: 1000 },
      { testCaseNum: 2, numElements: 10000 },
      { testCaseNum: 3, numElements: 100000 },
      // { testCaseNum: 4, numElements: 1000000 },
      // { testCaseNum: 5, numElements: 10000000 },
    ];

    const elementPropsTemplate = {
      classFullName: "TestDomain:TestElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
    };

    for (const testCase of testCases) {
      await rwIModel.locks.acquireLocks({ shared: drawingModelId });
      for (let i = 0; i < testCase.numElements; i++) {
        const elementProps = {
          ...elementPropsTemplate,
          name: `Element_${testCase.numElements}_${i}`,
        };
        assert.isTrue(Id64.isValidId64(rwIModel.elements.insertElement(elementProps)), `Failed to insert element ${elementProps.name}`);
      }
      rwIModel.saveChanges();
      await rwIModel.pushChanges({ description: `Changeset with ${testCase.numElements} inserts`, accessToken: adminToken });
    }

    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir }); // Get all changesets

    for (const testCase of testCases) {
      // Open the changesets one by one and read the changes
      const reader = SqliteChangesetReader.openFile({ fileName: changesets[testCase.testCaseNum].pathname, db: rwIModel, disableSchemaCheck: true });
      const adaptor = new ChangesetECAdaptor(reader);
      const unifier = new PartialECChangeUnifier(reader.db, ECChangeUnifierCache.createSqliteBackedCache(reader.db));
      adaptor.acceptOp("Inserted");
      assert.equal(unifier.getInstanceCount(), 0, "Unifier should be empty before any changes are applied");

      const watch = new StopWatch();
      watch.start();

      while (adaptor.step())
        unifier.appendFrom(adaptor);

      watch.stop();

      assert.equal(unifier.getInstanceCount(), testCase.numElements, "Number of instances should match the number of inserted elements til now");
      reporter.addEntry("ChangesetReaderAPI", "Unifier-SqliteBackedCache", "Execution time (seconds)", watch.elapsedSeconds, { iModelId: rwIModelId, changesetId: changesets[testCase.testCaseNum].id, changesetInserts: testCase.numElements });
    }
    rwIModel.close();
  });

  it("Track changeset health stats", async () => {
    const adminToken = "super manager token";
    const iModelName = "LargeChangesetPullTest";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);

    // Open two briefcases for the same iModel
    const [firstBriefcase, secondBriefcase] = await Promise.all([
      HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken }),
      HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken })
    ]);

    // Import schema
    await firstBriefcase.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
          <ECEntityClass typeName="TestElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
          </ECEntityClass>
      </ECSchema>`]);
    firstBriefcase.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await firstBriefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(firstBriefcase, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(firstBriefcase, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(firstBriefcase, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());

    firstBriefcase.saveChanges();

    await Promise.all([firstBriefcase.enableChangesetStatTracking(), secondBriefcase.enableChangesetStatTracking()]);

    await firstBriefcase.pushChanges({ description: "Initial Test Data Setup", accessToken: adminToken });

    // Insert a large number of elements and push as a single changeset
    const numElements = 100000;
    const elementPropsTemplate = {
      classFullName: "TestSchema:TestElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
    };
    await firstBriefcase.locks.acquireLocks({ shared: drawingModelId });
    for (let i = 0; i < numElements; i++) {
      const elementProps = {
        ...elementPropsTemplate,
        name: `Element_${i}`,
      };
      assert.isTrue(Id64.isValidId64(firstBriefcase.elements.insertElement(elementProps)));
    }
    firstBriefcase.saveChanges();
    await firstBriefcase.pushChanges({ description: `Large changeset with ${numElements} inserts`, accessToken: adminToken });
    await secondBriefcase.pullChanges({ accessToken: adminToken });

    const firstBriefcaseChangesets = await firstBriefcase.getAllChangesetHealthData();
    assert.equal(firstBriefcaseChangesets.length, 0); // No new changes to be pulled
    const secondBriefcaseChangesets = await secondBriefcase.getAllChangesetHealthData();
    assert.equal(secondBriefcaseChangesets.length, 2); // Schema import followed by element insert

    const secondBriefcaseChangeset2 = secondBriefcaseChangesets[1];
    expect(secondBriefcaseChangeset2.insertedRows).to.be.eql(numElements * 2); // 100k in bis_Element + 100k in bis_GeometricElement2d
    expect(secondBriefcaseChangeset2.updatedRows).to.be.eql(2);
    expect(secondBriefcaseChangeset2.totalElapsedMs).to.be.greaterThan(0); // Ensure it took some time
    expect(secondBriefcaseChangeset2.perStatementStats.length).to.be.eql(4);

    reporter.addEntry("ChangesetReaderAPI", "ChangesetHealthStats", "Execution time (ms)", secondBriefcaseChangeset2.totalElapsedMs, { changesetId: secondBriefcaseChangeset2.changesetId, statementsExecuted: secondBriefcaseChangeset2.perStatementStats.length });

    // Cleanup
    await Promise.all([firstBriefcase.close(), secondBriefcase.close()]);
  });
});
