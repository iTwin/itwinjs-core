/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, GeometryPartProps, GeometryStreamBuilder, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { BulkDeleteElementsStatus, ChannelControl, EditTxn, GeometryPart, IModelHost, IModelJsFs, SpatialCategory, StandaloneDb, withEditTxn } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { Reporter } from "@itwin/perf-tools";
import { Point3d } from "@itwin/core-geometry";

describe("PerformanceTest: Bulk Element Deletion", () => {
  const outDir = `${KnownTestLocations.outputDir}/DeleteElements`;
  const reporter = new Reporter();

  const elementCounts = [25, 50, 250, 1000, 10000, 100000];

  const includeLargeElementCounts = process.env.ITWIN_INCLUDE_LARGE_DELETE_ELEMENTS_PERFTESTS === "1" || process.env.ITWIN_INCLUDE_LARGE_DELETE_ELEMENTS_PERFTESTS?.toLowerCase() === "true";
  if (includeLargeElementCounts) {
    elementCounts.push(1000000);
    elementCounts.push(1700000);
  }

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
    usedPartIds: Id64Array;
    unusedPartIds: Id64Array;
    externallyBlockedPartIds: Set<Id64String>;
  } {
    const db = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "DeleteDefinitionElementsPerfTest" } });
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    const usedPartIds: Id64Array = [];
    const unusedPartIds: Id64Array = [];
    let categoryId = "";

    withEditTxn(db, "create definition elements", (editTxn) => {
      const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(editTxn, Code.createEmpty(), true);

      let cat = SpatialCategory.queryCategoryIdByName(db, IModel.dictionaryId, "TestCategory");
      if (undefined === cat)
        cat = SpatialCategory.insert(editTxn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
      categoryId = cat;

      for (let i = 0; i < count; i++) {
        const partId = editTxn.insertElement({
          classFullName: GeometryPart.classFullName,
          model: IModel.dictionaryId,
          code: GeometryPart.createCode(db, IModel.dictionaryId, `Part_${i}`),
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        } as GeometryPartProps);

        if (i % 2 === 0) {
          const builder = new GeometryStreamBuilder();
          builder.appendGeometryPart3d(partId);
          editTxn.insertElement({
            classFullName: "Generic:PhysicalObject",
            model: modelId,
            category: cat,
            code: Code.createEmpty(),
            geom: builder.geometryStream,
          } as GeometricElementProps);
          usedPartIds.push(partId);
        } else {
          unusedPartIds.push(partId);
        }
      }
    });

    const externallyBlockedPartIds = new Set(unusedPartIds.slice(0, Math.max(1, Math.floor(unusedPartIds.length / 10))));
    withEditTxn(db, "add external geometry-stream references", (editTxn) => {
      const [, externalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(editTxn, Code.createEmpty(), true);
      for (const partId of externallyBlockedPartIds) {
        const builder = new GeometryStreamBuilder();
        builder.appendGeometryPart3d(partId);
        editTxn.insertElement({
          classFullName: "Generic:PhysicalObject",
          model: externalModelId,
          category: categoryId,
          code: Code.createEmpty(),
          geom: builder.geometryStream,
        } as GeometricElementProps);
      }
    });

    return { db, usedPartIds, unusedPartIds, externallyBlockedPartIds };
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
        const deletionResult = txn.deleteElements(ids, { skipFKConstraintValidations: true });
        const elapsed = performance.now() - startTime;

        assert.equal(deletionResult.status, BulkDeleteElementsStatus.Success);

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
        const { db, usedPartIds, unusedPartIds, externallyBlockedPartIds } = createIModelWithDefinitionElements(fileName, count);
        const allIds: Id64Array = [...unusedPartIds, ...usedPartIds];

        const txn = new EditTxn(db, "deleteDefinitionElements perf test");
        txn.start();

        const startTime = performance.now();
        const failedToDelete = txn.deleteDefinitionElements(allIds);
        const elapsed = performance.now() - startTime;

        txn.saveChanges();

        const expectedFailed = usedPartIds.length + externallyBlockedPartIds.size;
        assert.equal(failedToDelete.size, expectedFailed, "in-use and externally-blocked parts should fail to delete");
        for (const id of unusedPartIds) {
          if (externallyBlockedPartIds.has(id))
            assert.isDefined(db.elements.tryGetElement(id), `externally-blocked part ${id} should be retained`);
          else
            assert.isUndefined(db.elements.tryGetElement(id), `unused part ${id} should be deleted`);
        }
        for (const id of usedPartIds)
          assert.isDefined(db.elements.tryGetElement(id), `in-use part ${id} should be retained`);

        txn.end();
        db.close();
        IModelJsFs.unlinkSync(fileName);

        reporter.addEntry("DeleteElementsPerfTest", `deleteDefinitionElements for ${count} elements`, "Execution time(ms)", elapsed);
      }

      {
        const fileName = IModelTestUtils.prepareOutputFile("DeleteElements", `deleteElements_${count}.bim`);
        const { db, usedPartIds, unusedPartIds, externallyBlockedPartIds } = createIModelWithDefinitionElements(fileName, count);
        const allIds: Id64Array = [...unusedPartIds, ...usedPartIds];

        const txn = new EditTxn(db, "deleteElements perf test");
        txn.start();

        const startTime = performance.now();
        const deletionResult = txn.deleteElements(allIds);
        const elapsed = performance.now() - startTime;

        assert.equal(deletionResult.status, BulkDeleteElementsStatus.PartialSuccess, "Some in-use definition elements should have been pruned");

        txn.saveChanges();

        const expectedFailedCount = usedPartIds.length + externallyBlockedPartIds.size;
        assert.equal(deletionResult.failedIds.size, expectedFailedCount, "in-use and externally-blocked parts should fail to delete");
        for (const id of unusedPartIds) {
          if (externallyBlockedPartIds.has(id))
            assert.isDefined(db.elements.tryGetElement(id), `externally-blocked part ${id} should be retained`);
          else
            assert.isUndefined(db.elements.tryGetElement(id), `unused part ${id} should be deleted`);
        }
        for (const id of usedPartIds)
          assert.isDefined(db.elements.tryGetElement(id), `in-use part ${id} should be retained`);

        txn.end();
        db.close();
        IModelJsFs.unlinkSync(fileName);

        reporter.addEntry("DeleteElementsPerfTest", `deleteElements for ${count} elements`, "Execution time(ms)", elapsed);
      }
    }
  });
});
