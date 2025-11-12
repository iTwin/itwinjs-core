import { assert, expect } from "chai";
import { _nativeDb, ClassRegistry, Element, IModelDb, IModelHost, IModelJsFs, KnownLocations, PhysicalModel, PhysicalPartition, Schemas, SpatialCategory, StandaloneDb, SubjectOwnsPartitionElements } from "@itwin/core-backend";
import { join } from "path";
import { InteractivePolygonEditor, InteractivePythagorasCommand, PythagorasCommand, SquareCommand } from "./TestEditCommands";
import { CreateElementCommand, DeleteElementCommand, TestEditCommandSchema, TestElement, UpdateElementCommand } from "./ElementEditCommands";
import * as path from "path"
import { Code, CodeProps, ElementProps, IModel, RelatedElement, SubCategoryAppearance } from "@itwin/core-common";
import { Id64, Id64String, OpenMode } from "@itwin/core-bentley";

describe("IModelEditCommand", () => {
  const outputDir = join(KnownLocations.tmpdir, "output");
  let iModelDb: IModelDb;
  let iModelPath: string;
  let modelId: Id64String;
  let categoryId: Id64String | undefined;

  before(async () => {
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
  })

  beforeEach(async () => {
    await IModelHost.startup();
    iModelDb = StandaloneDb.createEmpty(join(KnownLocations.tmpdir, "output", "IModelEditCommandTest.bim"), {
      rootSubject: { name: "IModelEditCommandTest", description: "Test of the IModelEditCommand class." },
    });
    iModelPath = iModelDb.pathName;
  });

  afterEach(async () => {
    iModelDb.close();
    IModelJsFs.unlinkSync(iModelPath);
    await IModelHost.shutdown();
  });

  describe("ImmediateCommand Tests", () => {
    it("Square a number using an immediate command", async () => {
      const squareCommand = new SquareCommand(iModelDb);

      const squaredResult = await squareCommand.performSquareOperation({ value: 2 });
      expect(squaredResult).to.equal(4);
    });

    it("Calculate the hypotenuse using an immediate command", async () => {
      const pythagorasCommand = new PythagorasCommand(iModelDb);

      const hypotenuse = await pythagorasCommand.calcHypotenuse({ sideA: 3, sideB: 4 });
      expect(hypotenuse).to.equal(5);
    });

    it("Calculate the hypotenuse using a nested SquareCommand - Sync", async () => {
      const pythagorasCommand = new PythagorasCommand(iModelDb);

      const hypotenuse = await pythagorasCommand.calcHypotenuseWithCommandsSync({ sideA: 3, sideB: 4 })
      expect(hypotenuse).to.equal(5);
    });

    it("Calculate the hypotenuse using a nested SquareCommand - Async", async () => {
      const pythagorasCommand = new PythagorasCommand(iModelDb);

      const hypotenuse = await pythagorasCommand.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 })
      expect(hypotenuse).to.equal(5);
    });

    it("Call multiple commands concurrently (race condition)", async () => {
      const pythagorasCommand1 = new PythagorasCommand(iModelDb);
      const pythagorasCommand2 = new PythagorasCommand(iModelDb);
      const pythagorasCommand3 = new PythagorasCommand(iModelDb);
      const pythagorasCommand4 = new PythagorasCommand(iModelDb);
      const [hypotenuse1, hypotenuse2, hypotenuse3, hypotenuse4] = await Promise.all([
        pythagorasCommand1.calcHypotenuseWithCommandsAsync({ sideA: 5, sideB: 12 }),
        pythagorasCommand2.calcHypotenuseWithCommandsAsync({ sideA: 8, sideB: 15 }),
        pythagorasCommand3.calcHypotenuseWithCommandsAsync({ sideA: 7, sideB: 24 }),
        pythagorasCommand4.calcHypotenuseWithCommandsAsync({ sideA: 9, sideB: 40 }),
      ]);
      expect(hypotenuse1).to.equal(13);
      expect(hypotenuse2).to.equal(17);
      expect(hypotenuse3).to.equal(25);
      expect(hypotenuse4).to.equal(41);
    });

    it("High concurrency with many commands", async () => {
      const commandCount = 20;
      const commands = Array.from({ length: commandCount }, () => new SquareCommand(iModelDb));

      const results = await Promise.all(
        commands.map(async (cmd, i) => cmd.performSquareOperation({ value: i + 1 }))
      );

      // Verify all results are correct
      results.forEach((result, i) => {
        expect(result).to.equal((i + 1) * (i + 1));
      });
    });

    it("Alternating external commands with nested commands", async () => {
      const pythagorasCommand1 = new PythagorasCommand(iModelDb);
      const pythagorasCommand2 = new PythagorasCommand(iModelDb);
      const square = new SquareCommand(iModelDb);

      const [result1, result2, result3] = await Promise.all([
        pythagorasCommand1.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 }),
        square.performSquareOperation({ value: 7 }),
        pythagorasCommand2.calcHypotenuseWithCommandsAsync({ sideA: 5, sideB: 12 }),
      ]);

      expect(result1).to.equal(5);
      expect(result2).to.equal(49);
      expect(result3).to.equal(13);
    });

    it("Commands with different execution times", async () => {
      const fastCommand = new SquareCommand(iModelDb);
      const slowCommand = new PythagorasCommand(iModelDb);
      const anotherFastCommand = new SquareCommand(iModelDb);

      // Start all at once - slow one should not block the queue unfairly
      const [fast1, slow, fast2] = await Promise.all([
        fastCommand.performSquareOperation({ value: 2 }),
        (async () => {
          // Simulate slow operation
          await new Promise(resolve => setTimeout(resolve, 10000));
          return slowCommand.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 });
        })(),
        anotherFastCommand.performSquareOperation({ value: 3 }),
      ]);

      expect(fast1).to.equal(4);
      expect(slow).to.equal(5);
      expect(fast2).to.equal(9);
    });

    it("Calculate the hypotenuse using multiple nested SquareCommands - Async", async () => {
      const pythagorasCommand = new PythagorasCommand(iModelDb);

      const hypotenuse = await pythagorasCommand.calcHypotenuseWithMultipleNestedCommands({ sideA: 3, sideB: 4 });
      expect(hypotenuse).to.equal(5);
    });
  });

  describe("InteractiveCommand Tests", () => {
    it("Simple interactive command - calculate hypotenuse", async () => {
      const interactivePythagoras = new InteractivePythagorasCommand(iModelDb);

      const hypotenuse = await interactivePythagoras.calcHypotenuse({ sideA: 6, sideB: 8 });
      expect(hypotenuse).to.equal(10);
    });

    it("Interactive command with nested immediate commands", async () => {
      const interactivePythagoras = new InteractivePythagorasCommand(iModelDb);

      const hypotenuse = await interactivePythagoras.calcHypotenuseWithNestedCommands({ sideA: 5, sideB: 12 });
      expect(hypotenuse).to.equal(13);
    });

    // TODO Rohit: If a command throws, the command scope is not handled/ended properly - fix this
    it("Multiple concurrent interactive commands", async () => {
      const command1 = new InteractivePythagorasCommand(iModelDb);

      // Should throw when trying to start a second interactive command concurrently
      expect(() => new InteractivePythagorasCommand(iModelDb)).to.throw("Cannot start an Interactive EditCommand from while another Interactive EditCommand is active.");

      // command1 should still work
      expect(await command1.calcHypotenuse({ sideA: 3, sideB: 4 })).to.equal(5);
      await command1.endCommandScope();

      // After ending, a new interactive command should not throw
      expect(async () => {
        const command2 = new InteractivePythagorasCommand(iModelDb);
        await command2.endCommandScope();
      }).to.not.throw();
    });

    it("Mix of immediate and interactive commands (which have nested immediate commands)", async () => {
      const immediateCmd = new SquareCommand(iModelDb);
      const interactiveCmd = new InteractivePythagorasCommand(iModelDb);
      const anotherImmediateCmd = new PythagorasCommand(iModelDb);

      const [immediate1, interactive, immediate2] = await Promise.all([
        immediateCmd.performSquareOperation({ value: 7 }),
        interactiveCmd.calcHypotenuseWithNestedCommands({ sideA: 6, sideB: 8 }),
        anotherImmediateCmd.calcHypotenuse({ sideA: 9, sideB: 12 }),
      ]);

      expect(immediate1).to.equal(49);
      expect(interactive).to.equal(10);
      expect(immediate2).to.equal(15);
    });

    it("Polygon editor - add and remove vertices", async () => {
      const polygonEditor = new InteractivePolygonEditor(iModelDb);

      await polygonEditor.startCommandScope();

      await polygonEditor.addVertex(0, 0);
      await polygonEditor.addVertex(10, 0);
      await polygonEditor.addVertex(10, 10);
      await polygonEditor.addVertex(0, 10);

      const count = await polygonEditor.getVertexCount();
      expect(count).to.equal(4);

      await polygonEditor.removeLastVertex();
      const countAfterRemove = await polygonEditor.getVertexCount();
      expect(countAfterRemove).to.equal(3);

      const description = await polygonEditor.getPolygonDescription();
      expect(description).to.include("3 vertices");

      await polygonEditor.endCommandScope();
    });

    it("Polygon editor - move vertices", async () => {
      const polygonEditor = new InteractivePolygonEditor(iModelDb);

      await polygonEditor.startCommandScope();

      await polygonEditor.addVertex(0, 0);
      await polygonEditor.addVertex(5, 5);
      await polygonEditor.addVertex(10, 0);

      // Move the middle vertex
      await polygonEditor.moveVertex(1, 5, 10);

      const description = await polygonEditor.getPolygonDescription();
      expect(description).to.include('"x":5,"y":10');

      await polygonEditor.endCommandScope();
    });
  });

  describe("Element API  with edit commands", () => {
    let templateTestElementProps: any;

    before(async () => {
      // Register the test schema
      if (!Schemas.getRegisteredSchema(TestEditCommandSchema.schemaName)) {
        Schemas.registerSchema(TestEditCommandSchema);
        ClassRegistry.register(TestElement, TestEditCommandSchema);
      }
    });

    beforeEach(async () => {
      // Import the test schema
      await iModelDb.importSchemas([path.join(__dirname, "assets", "BisCore.01.00.25.ecschema.xml")]);
      await iModelDb.importSchemaStrings([TestEditCommandSchema.schemaXml])

      const [, newModelId] = createAndInsertPhysicalPartitionAndModel(iModelDb, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(iModelDb, IModel.dictionaryId, "TestCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
      modelId = newModelId;
      categoryId = spatialCategoryId;

      assert.isTrue(Id64.isValidId64(modelId));
      assert.isTrue(Id64.isValidId64(categoryId));

      iModelDb.saveChanges("Import TestEditCommand schema");

      templateTestElementProps = {
        userLabel: "TestElement-Insert",
        testElementProps: {
          classFullName: TestElement.fullClassName,
          model: modelId,
          category: categoryId!,
          code: Code.createEmpty(),
          intProperty: 42,
          stringProperty: "TestStringProperty",
          doubleProperty: 3.14,
        },
      };
    });

    /**
     * Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
     * @return [modeledElementId, modelId]
     */
    function createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false): Id64String[] {
      const model = IModel.repositoryModelId;
      const parent = new SubjectOwnsPartitionElements(IModel.rootSubjectId);

      const modeledElementProps: ElementProps = {
        classFullName: PhysicalPartition.classFullName,
        parent,
        model,
        code: newModelCode,
      };
      const modeledElement: Element = testImodel.elements.createElement(modeledElementProps);
      const eid = testImodel.elements.insertElement(modeledElement.toJSON());

      const modeledElementRef = new RelatedElement({ id: eid });
      const newModel = testImodel.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
      const newModelId = newModel.id = testImodel.models.insertModel(newModel.toJSON());
      assert.isTrue(Id64.isValidId64(newModelId));
      assert.isTrue(Id64.isValidId64(newModel.id));
      assert.deepEqual(newModelId, newModel.id);
      return [eid, newModelId];
    }

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

    it("Create element and verify save", async () => {
      const createElementCmd = new CreateElementCommand(iModelDb);
      // Insert the element using the command
      const elementId = await createElementCmd.createElement(templateTestElementProps);

      assert.isTrue(Id64.isValidId64(elementId));

      // Close and reopen the iModel to verify changes were saved
      closeAndReopen(iModelDb, OpenMode.ReadWrite, iModelPath);
      assert.isTrue(iModelDb.isOpen);
      // Verify element was saved
      const element = iModelDb.elements.tryGetElement<TestElement>(elementId);
      expect(element).to.not.be.undefined;
      expect(element?.userLabel).to.equal("TestElement-Insert");
      expect(element?.intProperty).to.equal(42);
      expect(element?.stringProperty).to.equal("TestStringProperty");
      expect(element?.doubleProperty).to.equal(3.14);
    });

    it("Update element and verify changes are saved", async () => {
      // First create an element
      const createElementCmd = new CreateElementCommand(iModelDb);

      // Insert the element using the command
      const elementId = await createElementCmd.createElement(templateTestElementProps);
      assert.isTrue(Id64.isValidId64(elementId));

      // Update the element
      const updateCmd = new UpdateElementCommand(iModelDb);
      await updateCmd.updateElement({
        elementId,
        intProperty: 20,
        stringProperty: "Updated-StringProperty",
        // leave doubleProperty unchanged
      });

      // Close and reopen the iModel to verify changes were saved
      closeAndReopen(iModelDb, OpenMode.ReadWrite, iModelPath);
      assert.isTrue(iModelDb.isOpen);

      // Verify update was saved
      const element = iModelDb.elements.tryGetElement<TestElement>(elementId);
      expect(element).to.not.be.undefined;
      expect(element?.intProperty).to.equal(20);
      expect(element?.stringProperty).to.equal("Updated-StringProperty");
      expect(element?.doubleProperty).to.equal(3.14);  // Property unchanged
    });

    it("Delete element and verify it's gone", async () => {
      // First create an element
      const createElementCmd = new CreateElementCommand(iModelDb);

      // Insert the element using the command
      const elementId = await createElementCmd.createElement(templateTestElementProps);
      assert.isTrue(Id64.isValidId64(elementId));

      // Delete it
      const deleteCmd = new DeleteElementCommand(iModelDb);
      await deleteCmd.deleteElement({ elementId });

      // Verify it's deleted
      expect(() => iModelDb.elements.getElement(elementId)).to.throw();
    });

    it("should throw if abandonChanges is called externally during an active command", async () => {
      const createElementCmd = new CreateElementCommand(iModelDb);
      const elementId = await createElementCmd.createElement(templateTestElementProps);
      assert.isTrue(Id64.isValidId64(elementId));

      const updateCmd = new UpdateElementCommand(iModelDb);

      // Start the update but do not await it yet
      const updatePromise = updateCmd.updateElement({
        elementId,
        intProperty: 20,
        stringProperty: "Updated-StringProperty",
      });

      // Wait a bit to ensure the command is active
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try to call abandonChanges while the command is active
      expect(() => iModelDb.abandonChanges()).to.throw("Cannot call abandonChanges while an EditCommand is active");

      // Now await the update to finish
      await updatePromise;

      // After the command completes, abandonChanges should work (though there may be no changes to abandon)
      expect(() => iModelDb.abandonChanges()).to.not.throw();
    });

    it("should throw if saveChanges is called externally during an active command", async () => {
      const createElementCmd = new CreateElementCommand(iModelDb);
      const elementId = await createElementCmd.createElement(templateTestElementProps);
      assert.isTrue(Id64.isValidId64(elementId));

      const updateCmd = new UpdateElementCommand(iModelDb);

      // Start the update but do not await it yet
      const updatePromise = updateCmd.updateElement({
        elementId,
        intProperty: 30,
        stringProperty: "Another-Update",
      });

      // Wait a bit to ensure the command is active
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try to call saveChanges while the command is active
      expect(() => iModelDb.saveChanges("External save attempt")).to.throw("Cannot call saveChanges while an EditCommand is active");

      // Now await the update to finish
      await updatePromise;

      // After the command completes, saveChanges should work
      expect(() => iModelDb.saveChanges("Save after command completes")).to.not.throw();
    });

    // TODO Rohit: Just like saveChanges and abandonChanges, there are other iModel APIs that should not be allowed during an active command
    // viz discardChanges, reverseTxns, reinstateTxns, pullChanges, pushChanges, revertAndPushChanges, et cetera.
    // These functions need to be updated and tests must be added for those as well.

    // TODO Rohit: Review locking behavior during active edit commands
  });
});
