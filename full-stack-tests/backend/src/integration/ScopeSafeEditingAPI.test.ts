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
  public isFinished = false;
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

  public override async requestFinish(): Promise<string> {
    if (!this.isFinished) {
      return "Long running operation still in progress";
    }
    this.isFinished = true;
    await this.iModel.locks.releaseAllLocks();
    return "done";
  }

  public async performLongOperation() {
    const initialCount = this.createdElements.length;
    for (let i = 0; i < 3; i++) {
      // Create element properties
      const elemProps: PhysicalElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: this.modelId,
        category: this.categoryId,
        code: Code.createEmpty(),
      };

      // Simulate operation taking time
      await BeDuration.fromSeconds(this.operationDelay).wait();

      // Insert the element
      const elementId = this.iModel.elements.insertElement(elemProps);
      assert.isDefined(elementId, "Element should have been created");
      this.createdElements.push(elementId);

      await BeDuration.fromSeconds(this.operationDelay).wait();
    }

    assert.equal(this.createdElements.length, initialCount + 3, "Should have created 3 elements");
  }

  public finishOperation(): void {
    this.isFinished = true;
  }

  public getCreatedElements(): string[] {
    return [...this.createdElements];
  }
}

describe.only("Scope-Safe Editing API", () => {
  let imodel: StandaloneDb;
  let testFileName: string;
  let physicalModelId: string;
  let spatialCategoryId: string;

  before(async () => {
    const socket = {
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
    testFileName = IModelTestUtils.prepareOutputFile("ScopeSafeEditingAPI", `EditCommand.bim`);
    imodel = StandaloneDb.createEmpty(testFileName, { rootSubject: { name: "TestSubject" } });

    [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance());
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
      const element = imodel.elements.tryGetElement(elementId);
      if (element) {
        existingCount++;
      }
    }
    return existingCount;
  }

  it.only("abandonChanges during active edit command", async () => {
    // Start a long-running edit command
    const longCommand = new AsyncEditCommand(imodel, physicalModelId, spatialCategoryId);
    assert.equal(getElementCount(longCommand), 0);

    const startPromise = EditCommandAdmin.runCommand(longCommand);
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();
    assert.equal(getElementCount(longCommand), 0);

    // Start the first long operation and let it complete
    await longCommand.performLongOperation();
    expect(getElementCount(longCommand)).to.equal(3, "Should have created 3 elements");

    // Start the second long operation asynchronously - this will create more elements
    const longOperationPromise = longCommand.performLongOperation();

    // Give the second operation time to start creating elements
    await BeDuration.fromSeconds(longCommand.operationDelay).wait();

    // Simulate a race condition: Abandon changes while the second operation is actively creating elements
    imodel.abandonChanges();

    // Wait for the second long operation to complete
    await longOperationPromise;

    // Final checkpoint
    expect(getElementCount(longCommand)).to.equal(0, "All elements should be abandoned");

    // Clean up
    await longCommand.requestFinish();
    await startPromise;
  });
});
