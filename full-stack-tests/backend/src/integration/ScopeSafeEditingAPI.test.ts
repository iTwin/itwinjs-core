/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { IModelDb, IModelHost, IModelJsFs, IpcHost, SpatialCategory, StandaloneDb } from "@itwin/core-backend";
import { EditCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { IpcSocketBackend } from "@itwin/core-common/lib/cjs/ipc/IpcSocket";
import { Code, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import * as sinon from "sinon";

class AsyncEditCommand extends EditCommand {
  public static override commandId = "test.longRunning";
  public operationDelay = 1; // 1 second
  public modelId: string;
  public categoryId: string;
  public createdElements: string[] = [];

  public constructor(iModel: IModelDb, modelId: string, categoryId: string) {
    super(iModel);
    this.modelId = modelId;
    this.categoryId = categoryId;
  }

  public override async onStart(): Promise<any> {
    // Acquire locks on the model for editing
    await this.iModel.locks.acquireLocks({ shared: this.modelId });

    await BeDuration.fromSeconds(this.operationDelay).wait();
  }

  public override async requestFinish(): Promise<"done" | string> {
    if (this.iModel && this.iModel.locks) {
      await this.iModel.locks.releaseAllLocks();
    }
    return "done";
  }

  public async performElementInsertOperation(elementProps: PhysicalElementProps) {
    for (let i = 0; i < 3; i++) {
      // Insert the element
      const elementId = this.iModel.elements.insertElement(elementProps);
      assert.isDefined(elementId, "Element should have been created");
      this.createdElements.push(elementId);

      await BeDuration.fromSeconds(this.operationDelay).wait();
    }
  }

  public async performInsertAbandonOperation(elementProps: PhysicalElementProps) {
    await this.performElementInsertOperation(elementProps);
    this.iModel.abandonChanges();
  }
}

describe.only("Scope-Safe Editing API", () => {
  let imodel: StandaloneDb;
  let testFileName: string;
  let physicalModelId: string;
  let spatialCategoryId: string;
  const physicalElementProps: PhysicalElementProps = {
    classFullName: "Generic:PhysicalObject",
    model: "",
    category: "",
    code: Code.createEmpty(),
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

  beforeEach(() => {
    testFileName = IModelTestUtils.prepareOutputFile("ScopeSafeEditingAPI", `ScopeSafeEditingAPI.bim`);
    imodel = StandaloneDb.createEmpty(testFileName, { rootSubject: { name: "TestSubject" } });

    [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance());
    physicalElementProps.model = physicalModelId;
    physicalElementProps.category = spatialCategoryId;
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
    for (const elementId of longCommand.createdElements) {
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
    imodel.abandonChanges();
    longCommand.createdElements = [];
    expect(getElementCount(longCommand)).to.equal(0, "Elements deleted");

    // Wait for the long operation to complete
    await longOperationPromise;

    // Wait for the command to finish - EditCommandAdmin.runCommand handles requestFinish internally
    await startPromise;

    // Race condition:
    // The edit command tried to insert 3 element.
    // But the abandonChanges got in before the async operation could complete.
    // So a few of the elements went through.
    expect(getElementCount(longCommand)).to.be.greaterThan(1);
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
    imodel.discardChanges();
    longCommand.createdElements = [];
    expect(getElementCount(longCommand)).to.equal(0, "Elements deleted");

    // Wait for the long operation to complete
    await longOperationPromise;

    // Wait for the command to finish - EditCommandAdmin.runCommand handles requestFinish internally
    await startPromise;

    // Race condition:
    // The edit command tried to insert 3 element.
    // But the discardChanges got in before the async operation could complete.
    // So a few of the elements went through.
    expect(getElementCount(longCommand)).to.be.greaterThan(1);
  });

  it("sync saveChanges during active edit command", async () => {
    // Start a long-running edit command
    const longCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);

    const startPromise = EditCommandAdmin.runCommand(longCommand);
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();

    // Start the long operation asynchronously
    const longOperationPromise = longCommand.performInsertAbandonOperation(physicalElementProps);

    // Give the operation time to start creating elements
    await BeDuration.fromSeconds(longCommand.operationDelay + 1).wait();

    // Simulate a race condition: Save changes while the operation is actively creating elements and abandoning them
    imodel.saveChanges();

    // Wait for the operation to complete
    await longOperationPromise;

    // Wait for the command to finish - EditCommandAdmin.runCommand handles requestFinish internally
    await startPromise;

    // Race condition:
    // The edit command tried to insert 3 element and then abandon them.
    // But the saveChanges got in before the abandonChanges.
    // So a few of the elements went through.
    expect(getElementCount(longCommand)).to.be.greaterThan(1);
  });
});
