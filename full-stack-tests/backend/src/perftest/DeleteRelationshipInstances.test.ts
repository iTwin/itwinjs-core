/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, QueryBinder, RelationshipProps, SubCategoryAppearance } from "@itwin/core-common";
import { IModelDb, IModelHost, IModelJsFs, SpatialCategory, StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { Reporter } from "@itwin/perf-tools";

describe("PerformanceTest: Delete Multiple Relationship Instances", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "deleteInstances");
  const reporter = new Reporter();
  let iModel1: StandaloneDb;
  let iModel2: StandaloneDb;

  // Test with different relationship counts to analyze scalability
  const relCounts = [200, 500, 1000, 10000, 100000];
  const relationshipClasses = [
    "BisCore:ElementGroupsMembers",
    "BisCore:ElementDrivesElement",
    "BisCore:ElementRefersToDocuments"
  ];

  function createElementProps(modelId: Id64String, categoryId: Id64String): GeometricElementProps {
    const elementProps: GeometricElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
    };
    return elementProps;
  }

  async function getRelationshipCount(iModel: IModelDb, relationshipClass: string): Promise<number> {
    const reader = iModel.createQueryReader(`SELECT COUNT(*) AS [count] FROM ${relationshipClass}`);
    await reader.step();
    return reader.current.count;
  }

  function setupTestData(iModel: IModelDb, count: number, multiClass: boolean = false): RelationshipProps[] {
    // Create physical model
    const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModel, Code.createEmpty(), true);

    // Create spatial category
    let categoryId = SpatialCategory.queryCategoryIdByName(iModel, IModel.dictionaryId, "TestCategory");
    if (undefined === categoryId) {
      categoryId = SpatialCategory.insert(iModel, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
    }

    // Create relationships
    const relationships: RelationshipProps[] = [];

    for (let i = 0; i < count; ++i) {
      const sourceProps = createElementProps(modelId, categoryId);
      const sourceId = iModel.elements.insertElement(sourceProps);

      const targetProps = createElementProps(modelId, categoryId);
      const targetId = iModel.elements.insertElement(targetProps);

      let relationshipClass = "BisCore:ElementGroupsMembers";
      if (multiClass)
        relationshipClass = relationshipClasses[i % relationshipClasses.length];

      const relationshipProps: RelationshipProps = {
        classFullName: relationshipClass,
        sourceId,
        targetId,
      };

      const relationshipId = iModel.relationships.insertInstance(relationshipProps);
      relationshipProps.id = relationshipId;
      relationships.push(relationshipProps);
    }

    iModel.saveChanges();
    return relationships;
  }

  before(async () => {
    await IModelHost.startup();

    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
  });

  after(async () => {
    await IModelHost.shutdown();

    // Export detailed CSV report
    const csvPath = path.join(outDir, "RelationshipDeletionPerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });

  beforeEach(() => {
    iModel1 = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("deleteInstances", "test_deleteInstance.bim"), { rootSubject: { name: "DeleteInstanceTest" } });
    iModel2 = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("deleteInstances", "test_deleteInstances.bim"), { rootSubject: { name: "DeleteInstancesTest" } });
  });

  afterEach(() => {
    const iModel1Pathname = iModel1.pathName;
    if (iModel1.isOpen)
      iModel1.close();
    IModelJsFs.unlinkSync(iModel1Pathname);

    const iModel2Pathname = iModel2.pathName;
    if (iModel2.isOpen)
      iModel2.close();
    IModelJsFs.unlinkSync(iModel2Pathname);
  });

  it("Edge Case: Delete empty array", async () => {
    const relationships = setupTestData(iModel1, 1);
    assert.equal(1, relationships.length);
    assert.equal(1, await getRelationshipCount(iModel1, "BisCore.ElementGroupsMembers"));

    iModel1.relationships.deleteInstances([]);
    assert.equal(1, await getRelationshipCount(iModel1, "BisCore.ElementGroupsMembers"));
  });

  it("Edge Case: Delete single relationship using deleteInstances", async () => {
    const relCount = 10;

    const relationships = setupTestData(iModel1, relCount);
    assert.equal(relCount, relationships.length);

    // Delete just one relationship using deleteInstances method
    const singleRelationship = [relationships[0]];
    iModel1.relationships.deleteInstances(singleRelationship);
    iModel1.saveChanges();

    const remainingCount = await getRelationshipCount(iModel1, "BisCore.ElementGroupsMembers");
    assert.equal(remainingCount, relationships.length - 1, "Should delete exactly one relationship");
  });

  it("Delete relationships from different relationship classes", async () => {
    const relationshipCount = 500;
    const relationships = setupTestData(iModel1, relationshipCount, true);

    // Verify relationships were created across different classes
    assert.isTrue(await getRelationshipCount(iModel1, "BisCore.ElementGroupsMembers") >= Math.floor(relationshipCount / 3));
    assert.isTrue(await getRelationshipCount(iModel1, "BisCore.ElementDrivesElement") >= Math.floor(relationshipCount / 3));
    assert.isTrue(await getRelationshipCount(iModel1, "BisCore.ElementRefersToDocuments") >= Math.floor(relationshipCount / 3));

    // Test deleteInstances with mixed relationship classes
    const startTime = process.hrtime.bigint();

    iModel1.relationships.deleteInstances(relationships);

    const endTime = process.hrtime.bigint();

    iModel1.saveChanges();

    // Verify all relationships were deleted regardless of their class
    assert.equal(0, await getRelationshipCount(iModel1, "BisCore.ElementGroupsMembers"), "All ElementGroupsMembers relationships should be deleted");
    assert.equal(0, await getRelationshipCount(iModel1, "BisCore.ElementDrivesElement"), "All ElementDrivesElement relationships should be deleted");
    assert.equal(0, await getRelationshipCount(iModel1, "BisCore.ElementRefersToDocuments"), "All ElementRefersToDocuments relationships should be deleted");

    // Record performance for mixed relationship classes
    reporter.addEntry("RelDelPerfTest", `deleteInstances() for different ${relationshipCount} instances`, "Execution time(ms)", Number(endTime - startTime));
  });

  it("Performance Test: deleteInstance() vs deleteInstances() for random instances", async () => {
    let deleteInstanceResult: number;
    let deleteInstancesResult: number;
    const relCount = 1000;

    // Test 1: Individual deleteInstance() calls (baseline)
    {
      const relationships = setupTestData(iModel1, relCount, true);

      // Verify relationships exist before deletion
      assert.isTrue(await getRelationshipCount(iModel1, "BisCore.ElementGroupsMembers") >= Math.floor(relCount / 3));
      assert.isTrue(await getRelationshipCount(iModel1, "BisCore.ElementDrivesElement") >= Math.floor(relCount / 3));
      assert.isTrue(await getRelationshipCount(iModel1, "BisCore.ElementRefersToDocuments") >= Math.floor(relCount / 3));

      // Create a subset of random relationship entries to delete
      const relationshipsToDelete: RelationshipProps[] = [];
      for (let i = 0; i < 250; ++i) {
        relationshipsToDelete.push(relationships[Math.floor(Math.random() * (relCount + 1))]);
      }

      // Measure performance of individual deleteInstance() calls
      const startTime = process.hrtime.bigint();

      relationshipsToDelete.forEach((relationship) => {
        iModel1.relationships.deleteInstance(relationship);
      });

      const endTime = process.hrtime.bigint();
      deleteInstanceResult = Number(endTime - startTime);

      iModel1.saveChanges();

      // Verify all relationships were deleted
      for (const relClass of relationshipsToDelete) {
        const reader = iModel1.createQueryReader(`SELECT ECInstanceId FROM ${relClass.classFullName} WHERE SourceECInstanceId=? AND TargetECInstanceId=?`, new QueryBinder().bindId(1, relClass.sourceId).bindId(2, relClass.targetId));
        assert.isFalse(await reader.step(), `Relationship ${relClass.id} should be deleted`); // No row should be returned
      }
    }

    // Test 2: deleteInstances() call
    {
      const relationships = setupTestData(iModel2, relCount, true);

      // Verify relationships exist before deletion
      assert.isTrue(await getRelationshipCount(iModel2, "BisCore.ElementGroupsMembers") >= Math.floor(relCount / 3));
      assert.isTrue(await getRelationshipCount(iModel2, "BisCore.ElementDrivesElement") >= Math.floor(relCount / 3));
      assert.isTrue(await getRelationshipCount(iModel2, "BisCore.ElementRefersToDocuments") >= Math.floor(relCount / 3));

      // Create a subset of random relationship entries to delete
      const relationshipsToDelete: RelationshipProps[] = [];
      for (let i = 0; i < 250; ++i) {
        relationshipsToDelete.push(relationships[Math.floor(Math.random() * (relCount + 1))]);
      }

      // Measure performance of bulk deleteInstances() call
      const startTime = process.hrtime.bigint();

      iModel2.relationships.deleteInstances(relationshipsToDelete);

      const endTime = process.hrtime.bigint();
      deleteInstancesResult = Number(endTime - startTime);

      iModel2.saveChanges();

      // Verify all relationships were deleted
      for (const relClass of relationshipsToDelete) {
        const reader = iModel2.createQueryReader(`SELECT ECInstanceId FROM ${relClass.classFullName} WHERE SourceECInstanceId=? AND TargetECInstanceId=?`, new QueryBinder().bindId(1, relClass.sourceId).bindId(2, relClass.targetId));
        assert.isFalse(await reader.step(), `Relationship ${relClass.id} should be deleted`); // No row should be returned
      }
    }

    assert.isTrue(deleteInstancesResult < deleteInstanceResult, `deleteInstances() deletion should be faster than multiple deleteInstance() calls for ${relCount} relationships.`);

    // Performance analysis
    const improvementPercent = Math.floor((deleteInstanceResult / deleteInstancesResult) * 100);

    // Record results for reporting
    reporter.addEntry("RelDelPerfTest", `deleteInstance() for ${relCount} random instances`, "Execution time(ms)", deleteInstanceResult);
    reporter.addEntry("RelDelPerfTest", `deleteInstances() for ${relCount} random instances`, "Execution time(ms)", deleteInstancesResult);
    reporter.addEntry("RelDelPerfTest", `PerformanceImprovement for ${relCount} random instances`, "Performance Improvement (%)", improvementPercent);
  });

  describe("Performance Test: Varying Relationship Counts", () => {
    it("Performance Test: deleteInstance() vs deleteInstances()", async () => {
      for (const relCount of relCounts) {
        let deleteInstanceResult: number;
        let deleteInstancesResult: number;

        // Test 1: Individual deleteInstance() calls
        {
          const testFileName1 = IModelTestUtils.prepareOutputFile("deleteInstances", "iModel1.bim");
          const deleteInstanceiModel = StandaloneDb.createEmpty(testFileName1, { rootSubject: { name: "Delete Instance Test" } });

          const relationships = setupTestData(deleteInstanceiModel, relCount);

          // Verify relationships exist before deletion
          assert.equal(relCount, await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementGroupsMembers"));

          // Measure performance of individual deleteInstance() calls
          const startTime = process.hrtime.bigint();

          relationships.forEach((relationship) => {
            deleteInstanceiModel.relationships.deleteInstance(relationship);
          });

          const endTime = process.hrtime.bigint();
          deleteInstanceResult = Number(endTime - startTime);

          deleteInstanceiModel.saveChanges();

          // Verify all relationships were deleted
          assert.equal(0, await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementGroupsMembers"), "All relationships should be deleted");

          deleteInstanceiModel.close();
          IModelJsFs.unlinkSync(testFileName1);
        }

        // Test 2: Single deleteInstances() call
        {
          const testFileName2 = IModelTestUtils.prepareOutputFile("deleteInstances", "iModel2.bim");
          const deleteInstancesiModel = StandaloneDb.createEmpty(testFileName2, { rootSubject: { name: "Delete Instances Test" } });

          const relationships = setupTestData(deleteInstancesiModel, relCount);

          // Verify relationships exist before deletion
          assert.equal(relCount, await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementGroupsMembers"));

          // Measure performance of deleteInstances() call
          const startTime = process.hrtime.bigint();

          deleteInstancesiModel.relationships.deleteInstances(relationships);

          const endTime = process.hrtime.bigint();
          deleteInstancesResult = Number(endTime - startTime);

          deleteInstancesiModel.saveChanges();

          // Verify all relationships were deleted
          assert.equal(0, await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementGroupsMembers"), "All relationships should be deleted");

          deleteInstancesiModel.close();
          IModelJsFs.unlinkSync(testFileName2);
        }

        assert.isTrue(deleteInstancesResult < deleteInstanceResult, `deleteInstances() should be faster than individual deleteInstance() calls for ${relCount} relationships.`);

        // Performance analysis
        const improvementPercent = Math.floor((deleteInstanceResult / deleteInstancesResult) * 100);

        // Record results for reporting
        reporter.addEntry("RelDelPerfTest", `deleteInstance() for ${relCount} instances`, "Execution time(ms)", deleteInstanceResult);
        reporter.addEntry("RelDelPerfTest", `deleteInstances() for ${relCount} instances`, "Execution time(ms)", deleteInstancesResult);
        reporter.addEntry("RelDelPerfTest", `PerformanceImprovement for ${relCount} instances`, "Performance Improvement (%)", improvementPercent);
      }
    });

    it("Performance Test: deleteInstance() vs deleteInstances() for multiple relationship classes", async () => {
      for (const relCount of relCounts) {
        let deleteInstanceResult: number;
        let deleteInstancesResult: number;

        // Test 1: Individual deleteInstance() calls
        {
          const testFileName1 = IModelTestUtils.prepareOutputFile("deleteInstances()", "iModel1.bim");
          const deleteInstanceiModel = StandaloneDb.createEmpty(testFileName1, { rootSubject: { name: "Delete Instance Test" } });

          const relationships = setupTestData(deleteInstanceiModel, relCount, true);

          // Verify relationships exist before deletion
          assert.isTrue(await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementGroupsMembers") >= Math.floor(relCount / 3));
          assert.isTrue(await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementDrivesElement") >= Math.floor(relCount / 3));
          assert.isTrue(await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementRefersToDocuments") >= Math.floor(relCount / 3));

          // Measure performance of individual deleteInstance() calls
          const startTime = process.hrtime.bigint();
          relationships.forEach((relationship) => {
            deleteInstanceiModel.relationships.deleteInstance(relationship);
          });

          const endTime = process.hrtime.bigint();
          deleteInstanceResult = Number(endTime - startTime);

          deleteInstanceiModel.saveChanges();

          // Verify all relationships were deleted
          assert.equal(0, await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementGroupsMembers"), "All ElementGroupsMembers relationships should be deleted");
          assert.equal(0, await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementDrivesElement"), "All ElementDrivesElement relationships should be deleted");
          assert.equal(0, await getRelationshipCount(deleteInstanceiModel, "BisCore.ElementRefersToDocuments"), "All ElementRefersToDocuments relationships should be deleted");

          deleteInstanceiModel.close();
          IModelJsFs.unlinkSync(testFileName1);
        }

        // Test 2: deleteInstances() call
        {
          const testFileName2 = IModelTestUtils.prepareOutputFile("deleteInstances()", "iModel2.bim");
          const deleteInstancesiModel = StandaloneDb.createEmpty(testFileName2, { rootSubject: { name: "Delete Instances Test" } });

          const relationships = setupTestData(deleteInstancesiModel, relCount, true);

          // Verify relationships exist before deletion
          assert.isTrue(await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementGroupsMembers") >= Math.floor(relCount / 3));
          assert.isTrue(await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementDrivesElement") >= Math.floor(relCount / 3));
          assert.isTrue(await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementRefersToDocuments") >= Math.floor(relCount / 3));

          // Measure performance of deleteInstances() call
          const startTime = process.hrtime.bigint();

          deleteInstancesiModel.relationships.deleteInstances(relationships);

          const endTime = process.hrtime.bigint();
          deleteInstancesResult = Number(endTime - startTime);

          deleteInstancesiModel.saveChanges();

          // Verify all relationships were deleted
          assert.equal(0, await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementGroupsMembers"), "All ElementGroupsMembers relationships should be deleted");
          assert.equal(0, await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementDrivesElement"), "All ElementDrivesElement relationships should be deleted");
          assert.equal(0, await getRelationshipCount(deleteInstancesiModel, "BisCore.ElementRefersToDocuments"), "All ElementRefersToDocuments relationships should be deleted");

          deleteInstancesiModel.close();
          IModelJsFs.unlinkSync(testFileName2);
        }

        assert.isTrue(deleteInstancesResult < deleteInstanceResult, `deleteInstancesResult deletion should be faster than individual deleteInstanceResult calls for ${relCount} relationships.`);

        // Performance analysis
        const improvementPercent = Math.floor((deleteInstanceResult / deleteInstancesResult) * 100);

        // Record results for reporting
        reporter.addEntry("RelDelPerfTest", `deleteInstance() for ${relCount} instances`, "Execution time(ms)", deleteInstanceResult);
        reporter.addEntry("RelDelPerfTest", `deleteInstances() for ${relCount} instances`, "Execution time(ms)", deleteInstancesResult);
        reporter.addEntry("RelDelPerfTest", `PerformanceImprovement for ${relCount} instances`, "Performance Improvement (%)", improvementPercent);
      }
    });
  });
});
