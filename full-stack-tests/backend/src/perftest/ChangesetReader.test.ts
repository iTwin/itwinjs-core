/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ChangesetReader, ChangeUnifierCache, ChannelControl, DrawingCategory, IModelHost, PartialChangeUnifier } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils, withEditTxn } from "@itwin/core-backend/lib/cjs/test/index";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/KnownTestLocations";
import { GuidString, Id64, StopWatch } from "@itwin/core-bentley";
import { Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { assert } from "chai";
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

    HubMock.shutdown();
    await IModelHost.shutdown();
  });

  it("Large Changeset Performance", async () => {
    const adminToken = "super manager token";
    const iModelName = "LargeChangesetTest";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);

    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

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

    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = withEditTxn(rwIModel, (txn) => IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true));
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = withEditTxn(rwIModel, (txn) => DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance()));

    await rwIModel.pushChanges({ description: "Initial Test Data Setup", accessToken: adminToken });

    const testCases = [
      { testCaseNum: 1, numElements: 1000 },
      { testCaseNum: 2, numElements: 10000 },
    ];

    const elementPropsTemplate = {
      classFullName: "TestDomain:TestElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
    };

    for (const testCase of testCases) {
      await rwIModel.locks.acquireLocks({ shared: drawingModelId });
      withEditTxn(rwIModel, (txn) => {
        for (let i = 0; i < testCase.numElements; i++) {
          const elementProps = { ...elementPropsTemplate, name: `Element_${testCase.numElements}_${i}` };
          assert.isTrue(Id64.isValidId64(txn.insertElement(elementProps)), `Failed to insert element ${elementProps.name}`);
        }
      });
      await rwIModel.pushChanges({ description: `Changeset with ${testCase.numElements} inserts`, accessToken: adminToken });
    }

    const targetDir = path.join(KnownTestLocations.outputDir, rwIModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir });

    const cacheConfigs = [
      { label: "Unifier-InMemoryCache", createCache: () => ChangeUnifierCache.createInMemoryCache() },
      { label: "Unifier-SqliteBackedCache", createCache: () => ChangeUnifierCache.createSqliteBackedCache() },
    ];

    for (const cacheConfig of cacheConfigs) {
      for (const testCase of testCases) {
        using reader = ChangesetReader.openFile({ db: rwIModel, fileName: changesets[testCase.testCaseNum].pathname });
        using cache = cacheConfig.createCache();
        using pcu = new PartialChangeUnifier(cache);
        reader.setOpCodeFilters(new Set(["Inserted"]));
        assert.equal(pcu.instanceCount, 0, "Unifier should be empty before any changes are applied");

        const watch = new StopWatch();
        watch.start();

        while (reader.step())
          pcu.appendFrom(reader);

        watch.stop();

        assert.equal(pcu.instanceCount, testCase.numElements, "Number of instances should match the number of inserted elements");
        reporter.addEntry("ChangesetReaderAPI", cacheConfig.label, "Execution time (seconds)", watch.elapsedSeconds, { iModelId: rwIModelId, changesetId: changesets[testCase.testCaseNum].id, changesetInserts: testCase.numElements });
      }
    }

    rwIModel.close();
  });
});
