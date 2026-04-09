/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64Array } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { ChannelControl, EditTxn, IModelHost, IModelJsFs, SpatialCategory, StandaloneDb, withEditTxn } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { Reporter } from "@itwin/perf-tools";

describe("PerformanceTest: Bulk Element Deletion", () => {
  const outDir = `${KnownTestLocations.outputDir}/DeleteElements`;
  const reporter = new Reporter();

  const elementCounts = [1, 5, 10, 50, 100, 1000, 10000, 100000];

  before(async () => {
    await IModelHost.startup();

    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
  });

  after(async () => {
    const csvPath = `${outDir}/DeleteElementsPerformanceResults.csv`;
    reporter.exportCSV(csvPath);
    await IModelHost.shutdown();
  });

  function createIModelWithElements(fileName: string, count: number): { db: StandaloneDb; ids: Id64Array } {
    const db = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "DeleteElementsPerfTest" } });
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    const ids: Id64Array = [];

    withEditTxn(db, "create elements", (editTxn) => {
      const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(editTxn, Code.createEmpty(), true);
      let categoryId = SpatialCategory.queryCategoryIdByName(db, IModel.dictionaryId, "TestCategory");
      if (undefined === categoryId)
        categoryId = SpatialCategory.insert(editTxn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());

      for (let i = 0; i < count; i++) {
        const props: GeometricElementProps = {
          classFullName: "Generic:PhysicalObject",
          model: modelId,
          category: categoryId,
          code: Code.createEmpty(),
        };

        ids.push(editTxn.insertElement(props));
      }
    });

    return { db, ids };
  }

  function createIModelWithDefinitionElements(fileName: string, count: number): {
    db: StandaloneDb;
    usedCategoryIds: Id64Array;
    unusedCategoryIds: Id64Array;
  } {
    const db = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "DeleteDefinitionElementsPerfTest" } });
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    const usedCategoryIds: Id64Array = [];
    const unusedCategoryIds: Id64Array = [];

    withEditTxn(db, "create definition elements", (editTxn) => {
      const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(editTxn, Code.createEmpty(), true);

      for (let i = 0; i < count; i++) {
        const categoryId = SpatialCategory.insert(editTxn, IModel.dictionaryId, `Category_${i}`, new SubCategoryAppearance());
        if (i % 2 === 0) {
          // Mark as "used" by inserting a PhysicalObject that references it.
          const props: GeometricElementProps = {
            classFullName: "Generic:PhysicalObject",
            model: modelId,
            category: categoryId,
            code: Code.createEmpty(),
          };
          editTxn.insertElement(props);
          usedCategoryIds.push(categoryId);
        } else {
          unusedCategoryIds.push(categoryId);
        }
      }
    });
    return { db, usedCategoryIds, unusedCategoryIds };
  }

  it("deleteElement (loop) vs deleteElements (bulk)", () => {
    for (const count of elementCounts) {
      {
        const fileName = IModelTestUtils.prepareOutputFile("DeleteElements", `deleteElement_loop_${count}.bim`);
        const { db, ids } = createIModelWithElements(fileName, count);
        const txn = new EditTxn(db, "deleteElement perf test");
        txn.start();

        const startTime = performance.now();
        txn.deleteElement(ids);
        const elapsed = performance.now() - startTime;

        txn.saveChanges();
        for (const id of ids) {
          assert.equal(db.elements.tryGetElement(id), undefined, "all elements should be deleted");
        }

        txn.end();
        db.close();
        IModelJsFs.unlinkSync(fileName);

        reporter.addEntry("DeleteElementsPerfTest", `deleteElement for ${count} elements`, "Execution time(ms)", elapsed);
      }

      {
        const fileName = IModelTestUtils.prepareOutputFile("DeleteElements", `deleteElements_bulk_${count}.bim`);
        const { db, ids } = createIModelWithElements(fileName, count);
        const txn = new EditTxn(db, "deleteElements perf test");
        txn.start();

        const startTime = performance.now();
        txn.deleteElements(ids);
        const elapsed = performance.now() - startTime;

        txn.saveChanges();
        for (const id of ids) {
          assert.equal(db.elements.tryGetElement(id), undefined, "all elements should be deleted");
        }

        txn.end();
        db.close();
        IModelJsFs.unlinkSync(fileName);

        reporter.addEntry("DeleteElementsPerfTest", `deleteElements for ${count} elements`, "Execution time(ms)", elapsed);
      }
    }
  });

  it("deleteDefinitionElements vs deleteElements", () => {
    for (const count of elementCounts) {
      {
        const fileName = IModelTestUtils.prepareOutputFile("DeleteElements", `deleteDefinitionElements_${count}.bim`);
        const { db, unusedCategoryIds, usedCategoryIds } = createIModelWithDefinitionElements(fileName, count);
        const allIds: Id64Array = [...unusedCategoryIds, ...usedCategoryIds];
        const txn = new EditTxn(db, "deleteDefinitionElements perf test");
        txn.start();

        const startTime = performance.now();
        const failedToDelete = txn.deleteDefinitionElements(allIds);
        const elapsed = performance.now() - startTime;

        txn.saveChanges();

        // Unused categories must have been deleted; used ones must remain.
        assert.equal(failedToDelete.size, usedCategoryIds.length, "only in-use categories should fail to delete");
        for (const id of unusedCategoryIds)
          assert.isUndefined(db.elements.tryGetElement(id), `unused category ${id} should be deleted`);
        for (const id of usedCategoryIds)
          assert.isDefined(db.elements.tryGetElement(id), `used category ${id} should be retained`);

        txn.end();
        db.close();
        IModelJsFs.unlinkSync(fileName);

        reporter.addEntry("DeleteElementsPerfTest", `deleteDefinitionElements for ${count} elements`, "Execution time(ms)", elapsed);
      }

      {
        const fileName = IModelTestUtils.prepareOutputFile("DeleteElements", `deleteElements_${count}.bim`);
        const { db, unusedCategoryIds, usedCategoryIds } = createIModelWithDefinitionElements(fileName, count);
        const allIds: Id64Array = [...unusedCategoryIds, ...usedCategoryIds];
        const txn = new EditTxn(db, "deleteElements perf test");
        txn.start();

        const startTime = performance.now();
        const failedToDelete = txn.deleteElements(allIds);
        const elapsed = performance.now() - startTime;

        txn.saveChanges();

        assert.equal(failedToDelete.size, usedCategoryIds.length, "only in-use categories should fail to delete");
        for (const id of unusedCategoryIds)
          assert.isUndefined(db.elements.tryGetElement(id), `unused category ${id} should be deleted`);
        for (const id of usedCategoryIds)
          assert.isDefined(db.elements.tryGetElement(id), `used category ${id} should be retained`);

        txn.end();
        db.close();
        IModelJsFs.unlinkSync(fileName);

        reporter.addEntry("DeleteElementsPerfTest", `deleteElements for ${count} elements`, "Execution time(ms)", elapsed);
      }
    }
  });
});
