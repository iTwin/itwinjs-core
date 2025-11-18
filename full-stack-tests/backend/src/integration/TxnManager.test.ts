import { assert, expect } from "chai";
import { _nativeDb, BriefcaseDb, ChannelControl, DrawingCategory, IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { ChangesetIndexAndId, Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { GuidString, Id64, Id64String } from "@itwin/core-bentley";

describe("Discarding local txns test", async () => {
  let briefcases: BriefcaseDb[];
  const adminToken = "super manager token";
  let elementPropsTemplate: any;
  let drawingModelId: GuidString;

  before(async () => {
    await IModelHost.startup();
    HubMock.startup("discardLocalTxnsTest", KnownTestLocations.outputDir);
  });

  after(async () => {
    HubMock.shutdown();
    await IModelHost.shutdown();
  });

  afterEach(() => {
    briefcases.forEach(briefcase => { briefcase.close(); });
  });

  // Helper to setup schema/model/category without XML string
  async function setupTestSchemaAndModel() {
    const iModelName = "LargeChangesetPullTest";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);

    // Open two briefcases for the same iModel
    briefcases = await Promise.all([
      HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken }),
      HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken })
    ]);

    const [firstBriefcase, secondBriefcase] = briefcases;

    await firstBriefcase.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>

        <ECEntityClass typeName="TestElement">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <ECProperty propertyName="ElementName" typeName="string" />
          <ECProperty propertyName="ElementState" typeName="string" />
        </ECEntityClass>

        <ECRelationshipClass typeName="ElementConnectsToElement" strength="referencing" modifier="Sealed">
          <BaseClass>bis:ElementRefersToElements</BaseClass>
          <Source multiplicity="(0..1)" roleLabel="connects to" polymorphic="false">
            <Class class="TestElement"/>
          </Source>
          <Target multiplicity="(0..*)" roleLabel="is connected to" polymorphic="false">
            <Class class="TestElement"/>
          </Target>
        </ECRelationshipClass>
      </ECSchema>`]);
    firstBriefcase.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await firstBriefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, createdDrawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(firstBriefcase, codeProps, true);
    drawingModelId = createdDrawingModelId;
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(firstBriefcase, IModel.dictionaryId, "MyDrawingCategory");
    if (!drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(firstBriefcase, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());
    firstBriefcase.saveChanges();
    await firstBriefcase.pushChanges({ description: "Initial Test Data Setup", accessToken: adminToken });
    await secondBriefcase.pullChanges();

    elementPropsTemplate = {
      classFullName: "TestSchema:TestElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
    };
  }

  async function insertElement(briefcase: BriefcaseDb, name: string) {
    await briefcase.locks.acquireLocks({ shared: drawingModelId });
    const elementId = briefcase.elements.insertElement({
      ...elementPropsTemplate,
      elementName: name,
      elementState: "Inserted",
    });
    assert.isTrue(Id64.isValidId64(elementId));
    briefcase.saveChanges();

    testElement(briefcase, elementId, "Inserted");
    return elementId;
  };

  async function updateElementState(briefcase: BriefcaseDb, id: Id64String, state: string, expectedToFail: boolean = false) {
    await briefcase.locks.acquireLocks({ exclusive: id });
    const props = briefcase.elements.tryGetElementProps({ id });
    if (expectedToFail) {
      assert.isUndefined(props);
      return;
    }
    assert.isDefined(props);
    (props as any).elementState = state;
    briefcase.elements.updateElement(props as any);
    briefcase.saveChanges();

    testElement(briefcase, id, state);
  }

  async function deleteElement(briefcase: BriefcaseDb, id: Id64String) {
    await briefcase.locks.acquireLocks({ exclusive: id });
    briefcase.elements.deleteElement(id);
    briefcase.saveChanges();

    testElement(briefcase, id);
  }

  function testElement(briefcase: BriefcaseDb, id: Id64String, expectedState?: string) {
    const el = briefcase.elements.tryGetElement(id);
    if (expectedState) {
      assert.isDefined(el);
      expect((el as any).elementState).to.equal(expectedState);
    } else {
      assert.isUndefined(el);
    }
  }

  describe("discardChanges", () => {
    it("discardChanges should revert local changes", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      const el1Id = await insertElement(firstBriefcase, "FirstElement");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
      await secondBriefcase.pullChanges({ accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      // Insert 2 more elements
      const [el2Id, el3Id] = await Promise.all([
        insertElement(firstBriefcase, "SecondElement"),
        insertElement(firstBriefcase, "ThirdElement")
      ]);

      // Finally, update the first element
      await updateElementState(firstBriefcase, el1Id, "Updated");

      testElement(firstBriefcase, el1Id, "Updated");
      testElement(firstBriefcase, el2Id, "Inserted");

      testElement(secondBriefcase, el1Id, "Inserted");
      testElement(secondBriefcase, el2Id);
      testElement(secondBriefcase, el3Id);

      // Discard all transactions and verify rollback
      await firstBriefcase.discardChanges();

      testElement(firstBriefcase, el1Id, "Inserted");
      testElement(secondBriefcase, el1Id, "Inserted");

      testElement(firstBriefcase, el2Id);
      testElement(secondBriefcase, el2Id);
      testElement(firstBriefcase, el3Id);
      testElement(secondBriefcase, el3Id);

      // Release locks in firstBriefcase before deleting in secondBriefcase
      await firstBriefcase.locks.releaseAllLocks();

      // Now delete the element from the second briefcase
      await deleteElement(secondBriefcase, el1Id);

      // Assert element deletion
      testElement(firstBriefcase, el1Id, "Inserted");
      testElement(secondBriefcase, el1Id);

      await secondBriefcase.discardChanges();

      testElement(firstBriefcase, el1Id, "Inserted");
      testElement(secondBriefcase, el1Id, "Inserted");
    });

    it("Should only push changes made after local changes are discarded", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      const el1Id = await insertElement(firstBriefcase, "FirstElement");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
      await secondBriefcase.pullChanges({ accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      await updateElementState(secondBriefcase, el1Id, "First Update");

      await secondBriefcase.discardChanges();

      await updateElementState(secondBriefcase, el1Id, "Another Update");

      await secondBriefcase.pushChanges({ description: "Update Element", accessToken: adminToken });
      await firstBriefcase.pullChanges({ accessToken: adminToken });
      await secondBriefcase.locks.releaseAllLocks();

      testElement(firstBriefcase, el1Id, "Another Update");
      testElement(secondBriefcase, el1Id, "Another Update");
    });

    it("With conflicting changes", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      const el1Id = await insertElement(firstBriefcase, "FirstElement");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
      await secondBriefcase.pullChanges({ accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      await deleteElement(secondBriefcase, el1Id);

      await secondBriefcase.discardChanges();

      await updateElementState(secondBriefcase, el1Id, "First Update");

      await secondBriefcase.pushChanges({ description: "Update Element", accessToken: adminToken });
      await firstBriefcase.pullChanges({ accessToken: adminToken });
      await secondBriefcase.locks.releaseAllLocks();

      testElement(firstBriefcase, el1Id, "First Update");
      testElement(secondBriefcase, el1Id, "First Update");
    });

    it("With conflicting changes with a relationships", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const briefcase = briefcases[0];

      const [el1Id, el2Id] = await Promise.all([
        insertElement(briefcase, "FirstElement"),
        insertElement(briefcase, "SecondElement")
      ]);

      [el1Id, el2Id].forEach(id => { assert.isDefined(briefcase.elements.getElement(id)); });

      await briefcase.discardChanges();

      // Insert a relationship between the two elements
      const relProps = {
        classFullName: "TestSchema:ElementConnectsToElement",
        sourceId: el1Id,
        targetId: el2Id,
      };
      const relId = briefcase.relationships.insertInstance(relProps);
      assert.isTrue(Id64.isValidId64(relId));

      assert.isUndefined(briefcase.relationships.tryGetInstance("TestSchema:ElementConnectsToElement", relId));
    });

    it("Only the changes since the last push should be reversed", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      // Insert 2 elements in the first briefcase
      const [el1Id, el2Id] = await Promise.all([
        insertElement(firstBriefcase, "FirstElement"),
        insertElement(firstBriefcase, "SecondElement")
      ]);

      await firstBriefcase.pushChanges({ description: "Insert two Elements", accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      // Update the first element
      await updateElementState(firstBriefcase, el1Id, "Updated");

      testElement(firstBriefcase, el1Id, "Updated");
      testElement(firstBriefcase, el2Id, "Inserted");

      await firstBriefcase.pushChanges({ description: "Update first Element", accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      // Insert a third element
      const el3Id = await insertElement(firstBriefcase, "ThirdElement");
      testElement(firstBriefcase, el3Id, "Inserted");

      // Also update the second element
      await updateElementState(firstBriefcase, el2Id, "Temporary Update");

      // Change of plans !
      // Discard all the changes made since the last push
      await firstBriefcase.discardChanges();

      // Update the second element with it's final value
      await updateElementState(firstBriefcase, el2Id, "Final Update");
      testElement(firstBriefcase, el2Id, "Final Update");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Update second Element", accessToken: adminToken });
      await secondBriefcase.pullChanges();
      await firstBriefcase.locks.releaseAllLocks();

      // Check if all the values are as expected in the first briefcase
      testElement(firstBriefcase, el1Id, "Updated");
      testElement(firstBriefcase, el2Id, "Final Update");
      testElement(firstBriefcase, el3Id);

      // Check if the second briefcase has the same values after the pull
      testElement(secondBriefcase, el1Id, "Updated");
      testElement(secondBriefcase, el2Id, "Final Update");

      // If TxnManager.DeleteAllTxns() is called, the third element would be present in the first briefcase.
      // But since the txn which inserted was cleared, it would not get pushed to the second briefcase.
      // And both briefcases would have been out-of-sync.
      // Since discardChanges() reverses the changes made, the third element would not exist in both briefcases.
      testElement(secondBriefcase, el3Id);
    });

    it("Already reversed txns should be handled correctly", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const firstBriefcase = briefcases[0];

      const el1Id = await insertElement(firstBriefcase, "FirstElement");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      // Update the first element twice
      await updateElementState(firstBriefcase, el1Id, "First Update");
      await updateElementState(firstBriefcase, el1Id, "Second Update");

      // Insert a second element
      let el2Id = await insertElement(firstBriefcase, "SecondElement");

      // Reverse 2 transactions
      firstBriefcase.txns.reverseTxns(2);

      testElement(firstBriefcase, el1Id, "First Update");
      testElement(firstBriefcase, el2Id);

      // Re-Insert the second element
      el2Id = await insertElement(firstBriefcase, "SecondElement");
      await updateElementState(firstBriefcase, el1Id, "Another Update");

      // Reverse all the changes made since the last push
      await firstBriefcase.discardChanges();

      testElement(firstBriefcase, el1Id, "Inserted");
      testElement(firstBriefcase, el2Id);
    });
  });

  describe("DeleteAllTxns", () => {
    it("DeleteAllTxns will not revert local changes", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      const el1Id = await insertElement(firstBriefcase, "FirstElement");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
      await secondBriefcase.pullChanges({ accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      // Insert 2 more elements
      const el2Id = await insertElement(firstBriefcase, "SecondElement");
      const el3Id = await insertElement(firstBriefcase, "ThirdElement");

      // Finally, update the first element
      await updateElementState(firstBriefcase, el1Id, "Updated");

      testElement(firstBriefcase, el1Id, "Updated");
      testElement(firstBriefcase, el2Id, "Inserted");

      testElement(secondBriefcase, el1Id, "Inserted");
      testElement(secondBriefcase, el2Id);
      testElement(secondBriefcase, el3Id);

      // Clear the Txns table
      firstBriefcase[_nativeDb].deleteAllTxns();

      // The local changes should not be reverted
      testElement(firstBriefcase, el1Id, "Updated");
      testElement(firstBriefcase, el2Id, "Inserted");

      testElement(secondBriefcase, el1Id, "Inserted");
      testElement(secondBriefcase, el2Id);
      testElement(secondBriefcase, el3Id);
    });

    it("With conflicting changes", async () => {
      // Basic data setup where both briefcases have a single element inserted
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      const el1Id = await insertElement(firstBriefcase, "FirstElement");

      // Sync both briefcases
      await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
      await secondBriefcase.pullChanges({ accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      // Delete element from the second briefcase
      await deleteElement(secondBriefcase, el1Id);

      // Clear the Txns table
      secondBriefcase[_nativeDb].deleteAllTxns();

      // Update should throw as the element was deleted and won't be found
      await updateElementState(secondBriefcase, el1Id, "", true);

      // Nothing will be pushed as all transactions were cleared
      await secondBriefcase.pushChanges({ description: "Deleted Element", accessToken: adminToken });
      await firstBriefcase.pullChanges({ accessToken: adminToken });
      await secondBriefcase.locks.releaseAllLocks();

      // This essentially ends with both briefcases out of sync with no direct means to resync as all record of txns were cleared !!
      testElement(firstBriefcase, el1Id, "Inserted"); // Element will still be present in the first briefcase
      testElement(secondBriefcase, el1Id);  // Element will be absent from the second briefcase
    });
  });

  describe("TxnManager events for push/pull", () => {
    it("should raise onChangesPushed event when changes are pushed", async () => {
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase] = briefcases;

      const pushedChangesets: ChangesetIndexAndId[] = [];

      // Listen to the onChangesPushed event
      const removePushListener = firstBriefcase.txns.onChangesPushed.addListener((changeset: ChangesetIndexAndId) => {
        pushedChangesets.push(changeset);
      });

      let pullEventFired = false;
      // Listen to the onChangesPulled event
      const removePullListener = firstBriefcase.txns.onChangesPulled.addListener((_changeset: ChangesetIndexAndId) => {
        pullEventFired = true;
      });

      try {
        // Insert an element
        await insertElement(firstBriefcase, "TestElement");

        // Push changes
        await firstBriefcase.pushChanges({ description: "Test push event", accessToken: adminToken });

        await insertElement(firstBriefcase, "TestElement");

        // Push another set of changes
        await firstBriefcase.pushChanges({ description: "Test push event", accessToken: adminToken });

        // Verify that both push events were fired
        assert.equal(pushedChangesets.length, 2, "onChangesPushed event should have been fired twice");
        const [firstChangeset, secondChangeset] = pushedChangesets;

        assert.isDefined(firstChangeset, "Changeset should be defined");
        assert.isDefined(firstChangeset.id, "Changeset id should be defined");
        assert.isDefined(firstChangeset.index, "Changeset index should be defined");

        assert.isDefined(secondChangeset, "Changeset should be defined");
        assert.isDefined(secondChangeset.id, "Changeset id should be defined");
        assert.isDefined(secondChangeset.index, "Changeset index should be defined");

        assert.isTrue(secondChangeset.index > firstChangeset.index, "Second changeset index should be greater than first");

        // Make sure no pull event was fired
        assert.isFalse(pullEventFired);
      } finally {
        removePushListener();
        removePullListener();
        await firstBriefcase.locks.releaseAllLocks();
      }
    });

    it("should raise onChangesPulled event when changes are pulled", async () => {
      await setupTestSchemaAndModel();
      assert.equal(briefcases.length, 2, "Two briefcases should be opened");

      const [firstBriefcase, secondBriefcase] = briefcases;

      // Insert an element in first briefcase and push
      await insertElement(firstBriefcase, "FirstElement");
      await firstBriefcase.pushChanges({ description: "Insert element", accessToken: adminToken });
      await firstBriefcase.locks.releaseAllLocks();

      let pulledChangesets: ChangesetIndexAndId[] = [];

      // Listen to the onChangesPulled event in second briefcase
      const removeListener = secondBriefcase.txns.onChangesPulled.addListener((changeset: ChangesetIndexAndId) => {
        pulledChangesets.push(changeset);
      });

      try {
        // Pull changes
        await secondBriefcase.pullChanges({ accessToken: adminToken });

        await insertElement(firstBriefcase, "TestElement");

        // Push another set of changes from the first briefcase
        await firstBriefcase.pushChanges({ description: "Test push event", accessToken: adminToken });

        // Pull changes
        await secondBriefcase.pullChanges({ accessToken: adminToken });

        // Verify event was fired
        assert.equal(pulledChangesets.length, 2, "onChangesPulled event should have been fired twice");
        const [firstChangeset, secondChangeset] = pulledChangesets;

        assert.isDefined(firstChangeset, "Changeset should be defined");
        assert.isDefined(firstChangeset.id, "Changeset id should be defined");
        assert.isDefined(firstChangeset.index, "Changeset index should be defined");

        assert.isDefined(secondChangeset, "Changeset should be defined");
        assert.isDefined(secondChangeset.id, "Changeset id should be defined");
        assert.isDefined(secondChangeset.index, "Changeset index should be defined");

        assert.isTrue(secondChangeset.index > firstChangeset.index, "Second changeset index should be greater than first");
      } finally {
        removeListener();
      }
    });
  });
});
