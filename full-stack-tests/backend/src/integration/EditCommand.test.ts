/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BeDuration, Guid, Id64String, OpenMode } from "@itwin/core-bentley";
import { _nativeDb, IModelDb, IModelHost, IModelJsFs, IpcHost, SnapshotDb, SpatialCategory, StandaloneDb } from "@itwin/core-backend";
import { EditCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { HubWrappers, IModelTestUtils, TestPhysicalObject, TestPhysicalObjectProps } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { IpcSocketBackend } from "@itwin/core-common/lib/cjs/ipc/IpcSocket";
import { Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import * as sinon from "sinon";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";

abstract class TestEditCommandBase extends EditCommand {
  protected createdElements: Id64String[] = [];
  public readonly operationDelay = 1; // 1 second

  public constructor(
    iModel: IModelDb,
    protected readonly modelId: string,
    protected readonly categoryId: string
  ) {
    super(iModel);
  }

  public get createdElementIds(): Id64String[] {
    return this.createdElements;
  }

  public async insertElements(iModel: IModelDb, elementProps: TestPhysicalObjectProps, count: number = 5): Promise<Id64String[]> {
    const elementIds: Id64String[] = [];
    for (let i = 0; i < count; i++) {
      elementProps.intProperty += 1;
      const elementId = iModel.elements.insertElement(elementProps);
      assert.isDefined(elementId, "Element should have been created");
      elementIds.push(elementId);
      this.createdElements.push(elementId);

      await BeDuration.fromSeconds(this.operationDelay).wait();
    }
    return elementIds;
  }
}

class InsertCommand extends TestEditCommandBase {
  public static override commandId = "Test.InsertCommand";

  constructor(
    iModel: IModelDb,
    modelId: string,
    categoryId: string
  ) {
    super(iModel, modelId, categoryId);
    this.iModel[_nativeDb].enableTxnTesting(); // Enable transaction testing to simulate unsaved changes
  }

  public async insertAndSave(elementProps: TestPhysicalObjectProps): Promise<Id64String[]> {
    const elementIds = await this.insertElements(this.iModel, elementProps);
    this.saveChanges();
    return elementIds;
  }

  public async insertAndAbandon(elementProps: TestPhysicalObjectProps): Promise<Id64String[]> {
    const elementIds = await this.insertElements(this.iModel, elementProps);
    this.abandonChanges();
    return elementIds;
  }
}

describe.only("Editing API", () => {
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

    // Register test commands
    EditCommandAdmin.register(InsertCommand);
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
    EditCommandAdmin.unRegister(InsertCommand.commandId);

    await IModelHost.shutdown();
    await IpcHost.shutdown();
  });

  afterEach(() => {
    imodel.close();
    IModelJsFs.removeSync(testFileName);
  });

  // Get a count of the number of elements in the IModel
  function countExistingElements(command: TestEditCommandBase): number {
    return command.createdElementIds.filter(id =>
      imodel.elements.tryGetElement<TestPhysicalObject>(id) !== undefined
    ).length;
  }

  function expectElementsDefined(iModel: IModelDb, elementIds: Id64String[]): void {
    elementIds.forEach((elementId: Id64String) => {
      const element = iModel.elements.tryGetElement<TestPhysicalObject>(elementId);
      expect(element).to.not.be.undefined;
    });
  }

  function expectElementsUndefined(iModel: IModelDb, elementIds: Id64String[]): void {
    elementIds.forEach((elementId: Id64String) => {
      const element = iModel.elements.tryGetElement<TestPhysicalObject>(elementId);
      expect(element).to.be.undefined;
    });
  }

  it("saveChanges call from the edit command", async () => {
    const command = new InsertCommand(imodel, physicalModelId, spatialCategoryId);

    await EditCommandAdmin.runCommand(command);
    expect(countExistingElements(command)).to.equal(0, "No elements should exist yet");

    const elementIds = await command.insertAndSave(physicalElementProps);

    expect(elementIds.length).to.equal(5, "Should have inserted 5 elements");
    expect(countExistingElements(command)).to.equal(5, "All elements should be persisted after saveChanges");

    await EditCommandAdmin.finishCommand();
  });

  it("abandonChanges call from the edit command", async () => {
    const command = new InsertCommand(imodel, physicalModelId, spatialCategoryId);

    await EditCommandAdmin.runCommand(command);
    expect(countExistingElements(command)).to.equal(0, "No elements should exist yet");

    const elementIds = await command.insertAndAbandon(physicalElementProps);

    expect(elementIds.length).to.equal(5, "Should have attempted to insert 5 elements");
    expect(countExistingElements(command)).to.equal(0, "All elements should be gone after abandonChanges");

    await EditCommandAdmin.finishCommand();
  });

  it("external abandonChanges during active command should throw", async () => {
    const command = new InsertCommand(imodel, physicalModelId, spatialCategoryId);

    await EditCommandAdmin.runCommand(command);
    expect(countExistingElements(command)).to.equal(0, "No elements should exist yet");

    // Start the command to insert elements
    const insertPromise = command.insertElements(command.iModel, physicalElementProps);

    // Wait for some elements to be inserted
    await BeDuration.fromSeconds(command.operationDelay * 2.5).wait();

    // External call to abandon changes - should throw
    try {
      imodel.abandonChanges();
      assert.fail("External abandonChanges should have been blocked");
    } catch (error: any) {
      expect(error.message).to.contain("Cannot abandon changes during an active edit command");
    }

    const elementIds = await insertPromise;
    expect(elementIds.length).to.equal(5);
    expectElementsDefined(command.iModel, elementIds);

    // Finish the command
    command.saveChanges();
    await EditCommandAdmin.finishCommand();

    // No active command. External call to abandon changes - should not throw
    try {
      imodel.abandonChanges();
    } catch (error: any) {
      assert.fail("External abandonChanges should not throw when no active command exists.");
    }
  });

  it("external discardChanges during active command should throw", async () => {
    const command = new InsertCommand(imodel, physicalModelId, spatialCategoryId);

    await EditCommandAdmin.runCommand(command);
    expect(countExistingElements(command)).to.equal(0, "No elements should exist yet");

    // Start the command to insert elements
    const insertPromise = command.insertElements(command.iModel, physicalElementProps);

    // Wait for partial completion
    await BeDuration.fromSeconds(command.operationDelay * 2.5).wait();

    // External call to discard changes - should throw
    try {
      await imodel.discardChanges();
      assert.fail("External discardChanges should have been blocked");
    } catch (error: any) {
      expect(error.message).to.contain("Cannot discard changes during an active edit command");
    }

    // Let the command complete
    const elementIds = await insertPromise;
    expect(elementIds.length).to.equal(5);
    expectElementsDefined(command.iModel, elementIds);

    // Finish the command
    command.saveChanges();
    await EditCommandAdmin.finishCommand();

    // No active command. External call to discard changes - should not throw
    try {
      await imodel.discardChanges();
    } catch (error: any) {
      assert.fail("External discardChanges should not throw when no active command exists.");
    }
  });

  it("external saveChanges during active command should throw", async () => {
    const command = new InsertCommand(imodel, physicalModelId, spatialCategoryId);

    await EditCommandAdmin.runCommand(command);
    expect(countExistingElements(command)).to.equal(0, "No elements should exist yet");

    // Start the command to insert elements
    const insertPromise = command.insertAndAbandon(physicalElementProps);

    // Wait for partial completion
    await BeDuration.fromSeconds(command.operationDelay * 2.5).wait();

    // External call to saveChanges - should throw
    try {
      imodel.saveChanges();
      assert.fail("External saveChanges should have been blocked");
    } catch (error: any) {
      expect(error.message).to.contain("Cannot save changes during an active edit command");
    }

    const elementIds = await insertPromise;
    expect(elementIds.length).to.equal(5);
    expectElementsUndefined(command.iModel, elementIds);

    // Finish the command
    await EditCommandAdmin.finishCommand();

    // No active command. External call to saveChanges - should not throw
    try {
      imodel.saveChanges();
    } catch (error: any) {
      assert.fail("External saveChanges should not throw when no active command exists.");
    }
  });

  it("finishCommand should throw if changes were not saved or abandoned", async () => {
    const command = new InsertCommand(imodel, physicalModelId, spatialCategoryId);

    await EditCommandAdmin.runCommand(command);
    expect(countExistingElements(command)).to.equal(0, "No elements should exist yet");

    // Insert elements but don't call saveChanges or abandonChanges
    const elementIds = await command.insertElements(command.iModel, physicalElementProps);
    expect(elementIds.length).to.equal(5, "Should have inserted 5 elements");

    // Try to finish the command without saving or abandoning - should throw
    try {
      await EditCommandAdmin.finishCommand();
      assert.fail("finishCommand should have thrown as changes were not finalized");
    } catch (error: any) {
      expect(error.message).to.contain("The edit command needs to saved/abandon the changes made before it can finish");
    }

    // Now properly abandon the changes and finish
    command.abandonChanges();
    try {
      await EditCommandAdmin.finishCommand();
    } catch (error: any) {
      assert.fail("finishCommand should not throw after changes are finalized.");
    }
  });

  it("finishCommand should not throw if command made no changes to the iModel", async () => {
    class ReadOnlyCommand extends InsertCommand {
      public static override commandId = "Test.ReadOnlyCommand";

      public async performReadOperation(): Promise<number> {
        // Just read some data, don't modify anything
        const elementCount = imodel.queryEntityIds({ from: "BisCore.Element", limit: 100 }).size;
        return elementCount;
      }
    }

    EditCommandAdmin.register(ReadOnlyCommand);

    try {
      const command = new ReadOnlyCommand(imodel, physicalModelId, spatialCategoryId);
      await EditCommandAdmin.runCommand(command);

      // Perform a read-only operation
      const elementCount = await command.performReadOperation();
      expect(elementCount).to.be.greaterThan(0, "Should have read some elements");

      // Since no changes were made, finishCommand should NOT throw
      // even though saveChanges/abandonChanges was never called
      await EditCommandAdmin.finishCommand();
    } catch (error: any) {
      assert.fail(`finishCommand should not throw for read-only commands: ${error.message}`);
    } finally {
      EditCommandAdmin.unRegister(ReadOnlyCommand.commandId);
    }
  });

  function closeAndReopen(iModelDb: IModelDb, openMode: OpenMode, fileName: string) {
    // Unclosed statements will produce BUSY error when attempting to close.
    iModelDb.clearCaches();

    // The following resets the native db's pointer to this JavaScript object.
    iModelDb[_nativeDb].closeFile();
    iModelDb[_nativeDb].openIModel(fileName, openMode);

    // Restore the native db's pointer to this JavaScript object.
    iModelDb[_nativeDb].setIModelDb(iModelDb);

    // refresh cached properties that could have been changed by another process writing to the same briefcase
    iModelDb.changeset = iModelDb[_nativeDb].getCurrentChangeset();

    // assert what should never change
    if (iModelDb.iModelId !== iModelDb[_nativeDb].getIModelId() || iModelDb.iTwinId !== iModelDb[_nativeDb].getITwinId())
      throw new Error("closeAndReopen detected change in iModelId and/or iTwinId");
  }

  // ToDo Rohit: Fix this behavior
  // Single EditCommandAdmin is a static singleton - so commands on different briefcases run sequentially
  // This test currently passes because of that - but ideally we would like to support concurrent
  // When consequtive calls are made to runCommand without awaiting, the second call overwrites the first activeCommand in EditCommandAdmin
  // Hence, the first command can go ahead and not finalize it's changes without any consequence.
  it("Edit commands on different briefcases", async () => {
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

    await firstBriefcase.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestBim" alias="testbim" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="TestPhysicalObject" >
          <BaseClass>bis:PhysicalElement</BaseClass>
          <ECProperty propertyName="intProperty" typeName="int" displayLabel="an int32 value" />
        </ECEntityClass>
      </ECSchema>
    `]);

    [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(firstBriefcase, Code.createEmpty(), true);
    spatialCategoryId = SpatialCategory.insert(firstBriefcase, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance());
    physicalElementProps.model = physicalModelId;
    physicalElementProps.category = spatialCategoryId;
    physicalElementProps.intProperty = 0;
    firstBriefcase.saveChanges();

    await firstBriefcase.pushChanges({ description: "Add schema and model", accessToken });
    await secondBriefcase.pullChanges({ accessToken });

    // Start commands on both briefcases - they will run sequentially because EditCommandAdmin is a global singleton
    const firstBriefcaseCommand = new InsertCommand(firstBriefcase, physicalModelId, spatialCategoryId);
    const secondBriefcaseCommand = new InsertCommand(secondBriefcase, physicalModelId, spatialCategoryId);

    const command1 = EditCommandAdmin.runCommand(firstBriefcaseCommand);
    const command2 = EditCommandAdmin.runCommand(secondBriefcaseCommand);

    const elementInsertResult1 = firstBriefcaseCommand.insertElements(firstBriefcaseCommand.iModel, physicalElementProps);
    const elementInsertResult2 = secondBriefcaseCommand.insertElements(secondBriefcaseCommand.iModel, physicalElementProps);

    const [_promise, _promise2, insertResult1, insertResult2] = await Promise.all([command1, command2, elementInsertResult1, elementInsertResult2]);

    // As the first command has been overwritten, the changes will never be saved to the first briefcase
    // firstBriefcaseCommand.saveChanges();
    secondBriefcaseCommand.saveChanges();

    await EditCommandAdmin.finishCommand();

    expect(insertResult1.length).to.equal(5);
    expect(insertResult2.length).to.equal(5);

    closeAndReopen(firstBriefcase, OpenMode.ReadWrite, firstBriefcase.pathName);
    closeAndReopen(secondBriefcase, OpenMode.ReadWrite, secondBriefcase.pathName);

    // First briefcase's command was overwritten - so changes should not be present
    expectElementsUndefined(firstBriefcase, insertResult1);
    expectElementsDefined(secondBriefcase, insertResult2);

    firstBriefcase.close();
    secondBriefcase.close();
    HubMock.shutdown();
  });
});