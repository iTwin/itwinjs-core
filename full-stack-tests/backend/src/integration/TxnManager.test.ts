import { assert, expect } from "chai";
import { _nativeDb, BriefcaseDb, ChannelControl, DrawingCategory, IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { KnownTestLocations, HubWrappers, IModelTestUtils } from "@itwin/core-backend/lib/cjs/test";
import { IModel, Code, SubCategoryAppearance } from "@itwin/core-common";
import { GuidString, Id64, Id64String } from "@itwin/core-bentley";

describe("deleteAllTxns test", async () => {
  let briefcases: BriefcaseDb[];
  const adminToken = "super manager token";
  let elementPropsTemplate: any;
  let drawingModelId: GuidString;

  before(async () => {
    await IModelHost.startup();
    HubMock.startup("deleteAllTxnsTest", KnownTestLocations.outputDir);
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

    const firstBriefcase = briefcases[0];

    try {
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
    } catch (error: any) {
      console.log(`Error: ${JSON.stringify(error)}`);
    }
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
    } as any);
    assert.isTrue(Id64.isValidId64(elementId));

    briefcase.saveChanges();

    testElement(briefcase, elementId, "Inserted");
    return elementId;
  };

  async function updateElementState(briefcase: BriefcaseDb, id: Id64String, state: string) {
    await briefcase.locks.acquireLocks({ exclusive: id });
    const props = briefcase.elements.getElementProps({ id }) as any;
    props.elementState = state;
    briefcase.elements.updateElement(props);

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

  it("deleteAllTxns should revert local changes", async () => {
    // Basic data setup where both briefcases have a single element inserted
    await setupTestSchemaAndModel();
    assert.equal(briefcases.length, 2, "Two briefcases should be opened");

    const [firstBriefcase, secondBriefcase] = briefcases;

    const el1Id = await insertElement(firstBriefcase, "FirstElement");

    // Sync both briefcases
    await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
    await secondBriefcase.pullChanges({ accessToken: adminToken });
    firstBriefcase.locks.releaseAllLocks();

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

    // Delete all transactions and verify rollback
    firstBriefcase[_nativeDb].deleteAllTxns();

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

    secondBriefcase[_nativeDb].deleteAllTxns();

    testElement(firstBriefcase, el1Id, "Inserted");
    testElement(secondBriefcase, el1Id, "Inserted");
  });

  it("Should only push changes made after txns are deleted", async () => {
    // Basic data setup where both briefcases have a single element inserted
    await setupTestSchemaAndModel();
    assert.equal(briefcases.length, 2, "Two briefcases should be opened");

    const [firstBriefcase, secondBriefcase] = briefcases;

    const el1Id = await insertElement(firstBriefcase, "FirstElement");

    // Sync both briefcases
    await firstBriefcase.pushChanges({ description: "Insert Element", accessToken: adminToken });
    await secondBriefcase.pullChanges({ accessToken: adminToken });
    firstBriefcase.locks.releaseAllLocks();

    await updateElementState(secondBriefcase, el1Id, "First Update");

    secondBriefcase[_nativeDb].deleteAllTxns();

    await updateElementState(secondBriefcase, el1Id, "Another Update");

    await secondBriefcase.pushChanges({ description: "Update Element", accessToken: adminToken });
    await firstBriefcase.pullChanges({ accessToken: adminToken });
    secondBriefcase.locks.releaseAllLocks();

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
    firstBriefcase.locks.releaseAllLocks();

    await deleteElement(secondBriefcase, el1Id);

    secondBriefcase[_nativeDb].deleteAllTxns();

    await updateElementState(secondBriefcase, el1Id, "First Update");

    await secondBriefcase.pushChanges({ description: "Update Element", accessToken: adminToken });
    await firstBriefcase.pullChanges({ accessToken: adminToken });
    secondBriefcase.locks.releaseAllLocks();

    testElement(firstBriefcase, el1Id, "First Update");
    testElement(secondBriefcase, el1Id, "First Update");
  });

  it("With conflicting changes with a relationships", async () => {
    // Basic data setup where both briefcases have a single element inserted
    await setupTestSchemaAndModel();
    assert.equal(briefcases.length, 2, "Two briefcases should be opened");

    const briefcase = briefcases[0];

    const el1Id = await insertElement(briefcase, "FirstElement");
    const el2Id = await insertElement(briefcase, "SecondElement");

    [el1Id, el2Id].forEach(id => { assert.isDefined(briefcase.elements.getElement(id)); });

    briefcase[_nativeDb].deleteAllTxns();

    // Insert a relationship between the two elements
    const relProps = {
      classFullName: "TestSchema:ElementConnectsToElement",
      sourceId: el1Id,
      targetId: el2Id,
    };
    const relId = briefcase.relationships.insertInstance(relProps);
    assert.isTrue(Id64.isValidId64(relId));

    expect(() => briefcase.relationships.getInstance("TestSchema:ElementConnectsToElement", relId)).to.throw();
  });

  it("Only the changes since the last push should be reversed", async () => {
    // Basic data setup where both briefcases have a single element inserted
    await setupTestSchemaAndModel();
    assert.equal(briefcases.length, 2, "Two briefcases should be opened");

    const [firstBriefcase, secondBriefcase] = briefcases;

    // Insert 2 elements in the first briefcase
    const el1Id = await insertElement(firstBriefcase, "FirstElement");
    const el2Id = await insertElement(firstBriefcase, "SecondElement");

    await firstBriefcase.pushChanges({ description: "Insert two Elements", accessToken: adminToken });
    firstBriefcase.locks.releaseAllLocks();

    // Update the first element
    await updateElementState(firstBriefcase, el1Id, "Updated");

    testElement(firstBriefcase, el1Id, "Updated");
    testElement(firstBriefcase, el2Id, "Inserted");

    await firstBriefcase.pushChanges({ description: "Update first Element", accessToken: adminToken });
    firstBriefcase.locks.releaseAllLocks();

    // Insert a third element
    const el3Id = await insertElement(firstBriefcase, "ThirdElement");
    testElement(firstBriefcase, el3Id, "Inserted");

    // Also update the second element
    await updateElementState(firstBriefcase, el2Id, "Temporary Update");

    // Change of plans !
    // Delete all txns since the last push
    firstBriefcase[_nativeDb].deleteAllTxns();

    // Update the second element with it's final value
    await updateElementState(firstBriefcase, el2Id, "Final Update");
    testElement(firstBriefcase, el2Id, "Final Update");

    // Sync both briefcases
    await firstBriefcase.pushChanges({ description: "Update second Element", accessToken: adminToken });
    await secondBriefcase.pullChanges();
    firstBriefcase.locks.releaseAllLocks();

    // Check if all the values are as expected in the first briefcase
    testElement(firstBriefcase, el1Id, "Updated");
    testElement(firstBriefcase, el2Id, "Final Update");
    testElement(firstBriefcase, el3Id);

    // Check if the second briefcase has the same values after the pull
    testElement(secondBriefcase, el1Id, "Updated");
    testElement(secondBriefcase, el2Id, "Final Update");

    // If TxnManager.ClearAllTxns() is called, the third element would be present in the first briefcase.
    // But since the txn which inserted was cleared, it would not get pushed to the second briefcase.
    // And both briefcases would have been out-of-sync.
    // Since TxnManager.DeleteAllTxns() reverses the changes made, the third element would not exist in both briefcases.
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
    firstBriefcase.locks.releaseAllLocks();

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
    firstBriefcase[_nativeDb].deleteAllTxns();

    testElement(firstBriefcase, el1Id, "Inserted");
    testElement(firstBriefcase, el2Id);
  });
});
