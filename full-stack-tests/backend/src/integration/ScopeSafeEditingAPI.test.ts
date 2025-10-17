/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BeDuration, Guid, Id64String } from "@itwin/core-bentley";
import { IModelDb, IModelHost, IModelJsFs, IpcHost, SnapshotDb, SpatialCategory, StandaloneDb } from "@itwin/core-backend";
import { EditCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { HubWrappers, IModelTestUtils, TestPhysicalObject, TestPhysicalObjectProps } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { IpcSocketBackend } from "@itwin/core-common/lib/cjs/ipc/IpcSocket";
import { Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import * as sinon from "sinon";

class AsyncEditCommand extends EditCommand {
  public static override commandId = "Test.AsyncEditCommand";

  private modelId: string;
  private categoryId: string;
  private createdElements: Id64String[] = [];
  public operationDelay = 1;  // 1 second

  public constructor(iModel: IModelDb, modelId: string, categoryId: string) {
    super(iModel);
    this.modelId = modelId;
    this.categoryId = categoryId;
  }

  public get createdElementIds(): Id64String[] {
    return this.createdElements;
  }

  public set createdElementIds(elementIds: Id64String[]) {
    this.createdElements = elementIds;
  }

  public override async onStart(): Promise<any> {
    await BeDuration.fromSeconds(this.operationDelay).wait();
  }

  public override async requestFinish(): Promise<string> {
    return "done";
  }

  private async performInsertOperation(elementProps: TestPhysicalObjectProps) {
    for (let i = 0; i < 3; i++) {
      // Insert the element
      elementProps.intProperty += 1;
      const elementId = this.iModel.elements.insertElement(elementProps);
      assert.isDefined(elementId, "Element should have been created");
      this.createdElements.push(elementId);

      await BeDuration.fromSeconds(this.operationDelay).wait();
    }
  }

  public async performElementInsertOperation(elementProps: TestPhysicalObjectProps) {
    await this.performInsertOperation(elementProps);
    this.iModel.saveChanges();
  }

  public async performInsertAbandonOperation(elementProps: TestPhysicalObjectProps) {
    await this.performInsertOperation(elementProps);
    this.iModel.abandonChanges();
  }

  public async performElementDeleteOperation(elementIds: Id64String[]) {
    for (const elementId of elementIds) {
      this.iModel.elements.deleteElement(elementId);
      this.createdElements = this.createdElements.filter(item => item !== elementId);
    }
    this.iModel.saveChanges();
  }
}

describe.only("Scope-Safe Editing API", () => {
  let imodel: StandaloneDb;
  let testFileName: string;
  let physicalModelId: string;
  let spatialCategoryId: string;
  const physicalElementProps: TestPhysicalObjectProps = {
    classFullName: "TestBim:TestPhysicalObject",
    model: "",
    category: "",
    code: Code.createEmpty(),
    intProperty: 0,
  };

  before(async () => {
    const socket: sinon.SinonStubbedInstance<IpcSocketBackend> = {
      send: sinon.stub(),
      addListener: sinon.stub(),
      removeListener: sinon.stub(),
      handle: sinon.stub(),
    };

    await IpcHost.startup({ ipcHost: { socket } });
    await IModelHost.startup();

    // Register test command
    EditCommandAdmin.register(AsyncEditCommand);
  });

  beforeEach(async () => {
    testFileName = IModelTestUtils.prepareOutputFile("ScopeSafeEditingAPI", `ScopeSafeEditingAPI.bim`);
    imodel = StandaloneDb.createEmpty(testFileName, { rootSubject: { name: "TestSubject" } });

    await imodel.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestBim" alias="testbim" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>

        <ECEntityClass typeName="TestPhysicalObject" >
          <BaseClass>bis:PhysicalElement</BaseClass>
          <ECProperty propertyName="intProperty" typeName="int" displayLabel="an int32 value" />
        </ECEntityClass>
      </ECSchema>
    `]);

    [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance());
    physicalElementProps.model = physicalModelId;
    physicalElementProps.category = spatialCategoryId;
    physicalElementProps.intProperty = 0;
    imodel.saveChanges();
  });

  after(async () => {
    EditCommandAdmin.unRegister(AsyncEditCommand.commandId);

    await IModelHost.shutdown();
    await IpcHost.shutdown();
  });

  afterEach(() => {
    imodel.close();
    IModelJsFs.removeSync(testFileName);
  });

  function getElementCount(longCommand: AsyncEditCommand) {
    let existingCount = 0;
    for (const elementId of longCommand.createdElementIds) {
      if (imodel.elements.tryGetElement(elementId) !== undefined) {
        existingCount++;
      }
    }
    return existingCount;
  }

  it("sync abandonChanges during active edit command", async () => {
    // Start a long-running edit command
    const longCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);

    const startPromise = EditCommandAdmin.runCommand(longCommand);
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();
    expect(getElementCount(longCommand)).to.equal(0, "No elements should exist yet");

    // Start the long operation asynchronously - this will create more elements
    const longOperationPromise = longCommand.performElementInsertOperation(physicalElementProps);

    // Give the operation time to start creating elements
    await BeDuration.fromSeconds(longCommand.operationDelay * 0.5).wait();

    // Simulate a race condition: Abandon changes while the operation is actively creating elements
    expect(getElementCount(longCommand)).to.be.greaterThan(0, "Some elements should have been created");
    const abandonChangesProimise = imodel.abandonChanges();
    longCommand.createdElementIds = [];
    expect(getElementCount(longCommand)).to.equal(0, "Elements deleted");

    await Promise.all([
      abandonChangesProimise,
      longOperationPromise,
      startPromise,
    ]);

    // Race condition:
    // The edit command tried to insert 3 element.
    // But the abandonChanges got in before the async operation could complete.
    // So a few of the elements went through.
    expect(getElementCount(longCommand)).to.eql(2);
    let element = imodel.elements.tryGetElement<TestPhysicalObject>(longCommand.createdElementIds[0]);
    expect(element).to.not.be.undefined;
    expect(element!.intProperty).to.eql(2);

    element = imodel.elements.tryGetElement<TestPhysicalObject>(longCommand.createdElementIds[1]);
    expect(element).to.not.be.undefined;
    expect(element!.intProperty).to.eql(3);
  });

  it("async discardChanges during active edit command", async () => {
    // Start a long-running edit command
    const longCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);

    const startPromise = EditCommandAdmin.runCommand(longCommand);
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();
    expect(getElementCount(longCommand)).to.equal(0, "No elements should exist yet");

    // Start the long operation asynchronously - this will create more elements
    const longOperationPromise = longCommand.performElementInsertOperation(physicalElementProps);

    // Give the operation time to start creating elements
    await BeDuration.fromSeconds(longCommand.operationDelay * 0.5).wait();

    // Simulate a race condition: Discard changes while the operation is actively creating elements
    expect(getElementCount(longCommand)).to.be.greaterThan(0, "Some elements should have been created");
    const discardChangesProimise = imodel.discardChanges();
    longCommand.createdElementIds = [];
    expect(getElementCount(longCommand)).to.equal(0, "Elements deleted");

    await Promise.all([
      discardChangesProimise,
      longOperationPromise,
      startPromise,
    ]);

    // Race condition:
    // The edit command tried to insert 3 element.
    // But the discardChanges got in before the async operation could complete.
    // So a few of the elements went through.
    expect(getElementCount(longCommand)).to.eql(2);
    let element = imodel.elements.tryGetElement<TestPhysicalObject>(longCommand.createdElementIds[0]);
    expect(element).to.not.be.undefined;
    expect(element!.intProperty).to.eql(2);

    element = imodel.elements.tryGetElement<TestPhysicalObject>(longCommand.createdElementIds[1]);
    expect(element).to.not.be.undefined;
    expect(element!.intProperty).to.eql(3);
  });

  it("sync saveChanges during active edit command", async () => {
    // Start a long-running edit command
    const longCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);

    const startPromise = EditCommandAdmin.runCommand(longCommand);
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();

    // Start the long operation asynchronously
    const longOperationPromise = longCommand.performInsertAbandonOperation(physicalElementProps);

    // Simulate a race condition: Save changes while the operation is actively creating elements and abandoning them
    imodel.saveChanges();

    await Promise.all([
      longOperationPromise,
      startPromise,
    ]);

    // Race condition:
    // The edit command tried to insert 3 element and then abandon them.
    // But the saveChanges got in before the abandonChanges.
    // So a few of the elements went through.
    expect(getElementCount(longCommand)).to.eql(1);
    const element = imodel.elements.tryGetElement<TestPhysicalObject>(longCommand.createdElementIds[0]);
    expect(element).to.not.be.undefined;
    expect(element!.intProperty).to.eql(1);
  });

  it("should demonstrate concurrent edit commands causing issues", async () => {
    const insertCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);
    const promise1 = EditCommandAdmin.runCommand(insertCommand);
    const insertCommandPromise = insertCommand.performElementInsertOperation(physicalElementProps);
    await BeDuration.fromSeconds(1.5).wait();

    const deleteCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);
    const promise2 = EditCommandAdmin.runCommand(deleteCommand);
    const deleteCommandPromise = deleteCommand.performElementDeleteOperation(insertCommand.createdElementIds);

    await Promise.all([insertCommandPromise, promise1, deleteCommandPromise, promise2]);

    // Race condition:
    // The async insert command tried to insert 3 elements.
    // But the async delete command got in before the insert command could complete.
    // So a the number of element at the end is non-deterministic.
    expect(getElementCount(insertCommand)).to.equal(1);
    const element = imodel.elements.tryGetElement<TestPhysicalObject>(insertCommand.createdElementIds[2]);
    expect(element).to.not.be.undefined;
    expect(element!.intProperty).to.eql(3);
  });

  it("pullChanges during active edit command", async () => {
    const iTwinId = Guid.createValue();
    const accessToken = "token 1";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "dropschemas" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken, iTwinId, iModelName: "ScopeSafeEditingAPI", noLocks: true });

    const [firstBriefcase, secondBriefcase] = await Promise.all([
      HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken }),
      HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken })
    ]);

    assert.isDefined(firstBriefcase);
    assert.isDefined(secondBriefcase);

    // Setup: Create elements in both briefcases to have something to merge
    const [testModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(firstBriefcase, Code.createEmpty(), true);
    const testCategoryId = SpatialCategory.insert(firstBriefcase, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());

    // Create initial elements in first briefcase and push
    const firstElementProps: TestPhysicalObjectProps = {
      classFullName: "Generic:PhysicalObject",
      model: testModelId,
      category: testCategoryId,
      code: Code.createEmpty(),
      intProperty: 0,
    };

    const element1 = firstBriefcase.elements.insertElement(firstElementProps);
    const element2 = firstBriefcase.elements.insertElement(firstElementProps);
    firstBriefcase.saveChanges();
    await firstBriefcase.pushChanges({ description: "Two elements inserted from first briefcase" });
    await secondBriefcase.pullChanges();

    secondBriefcase.elements.deleteElement(element1);
    secondBriefcase.elements.deleteElement(element2);
    secondBriefcase.saveChanges();
    await secondBriefcase.pushChanges({ description: "Element inserted from second briefcase" });

    // Now start a long-running EditCommand in the first briefcase
    const longCommand = new AsyncEditCommand(firstBriefcase, testModelId, testCategoryId);

    // Start the EditCommand asynchronously - don't await it yet
    const commandPromise = EditCommandAdmin.runCommand(longCommand);
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();

    // Start a long operation within the EditCommand
    const elementOperationPromise = longCommand.performElementInsertOperation(firstElementProps);
    await BeDuration.fromSeconds(longCommand.operationDelay * 0.5).wait();

    try {
      await firstBriefcase.pullChanges({ accessToken });
      assert.fail("Pull should have failed due to unsaved changes from active EditCommand");
    } catch (error: any) {
      expect(error.message).to.contain("unsaved changes");
    }

    await Promise.all([
      elementOperationPromise,
      commandPromise,
    ]);

    firstBriefcase.close();
    secondBriefcase.close();
    HubMock.shutdown();
  });

  it("simulate frontend async vs backend sync mismatch", async () => {
    // Insert two elements to establish initial state
    physicalElementProps.intProperty += 1;
    const element1 = imodel.elements.insertElement(physicalElementProps);
    imodel.saveChanges();

    physicalElementProps.intProperty += 1;
    const element2 = imodel.elements.insertElement(physicalElementProps);

    // Simulate multiple async operations from frontend hitting backend
    const operations = [
      // Operation 1: Long-running EditCommand that modifies and creates elements
      async () => {
        const cmd = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);

        // Start the command but don't await it immediately
        const commandPromise = EditCommandAdmin.runCommand(cmd);

        // Create new elements slowly
        await cmd.performElementInsertOperation(physicalElementProps);

        await commandPromise;

        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element1)).to.be.undefined;  // Deleted by other async op
        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element2)?.intProperty).greaterThan(2);  // New element will be created with the same elementID due to the other async ops
      },

      // Operation 2: Concurrent abandon changes (interferes with EditCommand)
      async () => {
        imodel.abandonChanges();

        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element2)?.intProperty).to.be.eql(1);  //  This element insert was saved
        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element1)).to.be.undefined;  // Unsaved change, hence abandoned
      },

      // Operation 3: Concurrent undo operations (conflicts with EditCommand changes)
      async () => {
        // Try to undo recent transactions
        imodel.txns.reverseSingleTxn();
        imodel.saveChanges("After undo");

        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element2)?.intProperty).to.be.eql(1);  //  This element insert was saved
        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element1)).to.be.undefined;  // Unsaved change, hence abandoned
      },

      // Operation 4: Concurrent element deletion (direct conflict)
      async () => {
        // Try to delete the same elements EditCommand might be modifying
        imodel.elements.deleteElement(element1);
        imodel.elements.deleteElement(element2);
        imodel.saveChanges("Deleted elements");

        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element1)).to.be.undefined;  // Direct deletes in this op
        expect(imodel.elements.tryGetElement<TestPhysicalObject>(element2)).to.be.undefined;  // Direct deletes in this op
      }
    ];

    // Execute all operations truly concurrently
    await Promise.allSettled(operations.map(async op => op()));

    // The 4th operation deleted both elements.
    // However, the edit command created new elements with the same elementIDs, but with different intProperty values (which are our real ids in this case)
    // Which is why we end up with element1 being deleted, but a new element2 with the same elementID but different intProperty value
    // This simulates a proper race condition. Moving the delay command in the 4th operation to a different async operation will completely change the outcome of this test.
    expect(imodel.elements.tryGetElement<TestPhysicalObject>(element1)).to.be.undefined
    expect(imodel.elements.tryGetElement<TestPhysicalObject>(element2)?.intProperty).to.be.greaterThan(2);
  });
});
