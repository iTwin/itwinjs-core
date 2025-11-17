import { assert, expect } from "chai";
import { _nativeDb, ClassRegistry, Element, IModelDb, IModelHost, IModelJsFs, KnownLocations, PhysicalModel, PhysicalPartition, Schemas, SpatialCategory, StandaloneDb, SubjectOwnsPartitionElements } from "@itwin/core-backend";
import { join } from "path";
import { InteractivePolygonEditor, InteractivePythagorasCommand, PythagorasCommand, SquareCommand } from "./TestEditCommands";
import { CreateElementCommand, DeleteElementCommand, InteractiveElementAPI, TestEditCommandSchema, TestElement, UpdateElementCommand } from "./ElementEditCommands";
import * as path from "path"
import { Code, CodeProps, ElementProps, IModel, RelatedElement, SubCategoryAppearance } from "@itwin/core-common";
import { Id64, Id64String, OpenMode } from "@itwin/core-bentley";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

/* eslint-disable @typescript-eslint/no-non-null-assertion */

describe("IModelEditCommand", () => {
  const outputDir = join(KnownLocations.tmpdir, "output");
  let iModelDb: StandaloneDb;
  let iModelPath: string;
  let modelId: Id64String;
  let categoryId: Id64String | undefined;

  before(async () => {
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
  });

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

      const squaredResult = await squareCommand.execute({ value: 2, description: "Square number 2" });
      expect(squaredResult).to.equal(4);
    });

    it("Calculate the hypotenuse using an immediate command", async () => {
      const pythagorasCommand = new PythagorasCommand(iModelDb);

      const hypotenuse = await pythagorasCommand.execute({ sideA: 3, sideB: 4, description: "Calculate hypotenuse" });
      expect(hypotenuse).to.equal(5);
    });

    it("Call multiple commands concurrently (race condition)", async () => {
      const pythagorasCommand1 = new PythagorasCommand(iModelDb);
      const pythagorasCommand2 = new PythagorasCommand(iModelDb);
      const pythagorasCommand3 = new PythagorasCommand(iModelDb);
      const pythagorasCommand4 = new PythagorasCommand(iModelDb);
      const [hypotenuse1, hypotenuse2, hypotenuse3, hypotenuse4] = await Promise.all([
        pythagorasCommand1.execute({ sideA: 5, sideB: 12, description: "Calculate hypotenuse cmd1" }),
        pythagorasCommand2.execute({ sideA: 8, sideB: 15, description: "Calculate hypotenuse cmd2" }),
        pythagorasCommand3.execute({ sideA: 7, sideB: 24, description: "Calculate hypotenuse cmd3" }),
        pythagorasCommand4.execute({ sideA: 9, sideB: 40, description: "Calculate hypotenuse cmd4" }),
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
        commands.map(async (cmd, i) => cmd.execute({ value: i + 1, description: `Square number ${i + 1}` }))
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
        pythagorasCommand1.execute({ sideA: 3, sideB: 4, description: "Calculate hypotenuse cmd1" }),
        square.execute({ value: 7, description: "Square number 7" }),
        pythagorasCommand2.execute({ sideA: 5, sideB: 12, description: "Calculate hypotenuse cmd2" }),
      ]);

      expect(result1).to.equal(5);
      expect(result2).to.equal(49);
      expect(result3).to.equal(13);
    });

    it("Commands with different execution times", async () => {
      const fastCommand = new SquareCommand(iModelDb);
      const slowCommand = new PythagorasCommand(iModelDb);
      const anotherFastCommand = new SquareCommand(iModelDb);

      const [fast1, slow, fast2] = await Promise.all([
        fastCommand.execute({ value: 2, description: "Square number 2" }),
        (async () => {
          // Simulate slow operation
          await new Promise(resolve => setTimeout(resolve, 10000));
          return slowCommand.execute({ sideA: 3, sideB: 4, description: "Calculate hypotenuse" });
        })(),
        anotherFastCommand.execute({ value: 3, description: "Square number 3" }),
      ]);

      expect(fast1).to.equal(4);
      expect(slow).to.equal(5);
      expect(fast2).to.equal(9);
    });
  });

  describe("InteractiveCommand Tests", () => {
    it("Simple interactive command - calculate hypotenuse", async () => {
      const interactivePythagoras = new InteractivePythagorasCommand(iModelDb);

      await interactivePythagoras.startCommandScope();
      const hypotenuse = await interactivePythagoras.calcHypotenuse({ sideA: 6, sideB: 8 });
      await interactivePythagoras.endCommandScope();
      expect(hypotenuse).to.equal(10);
    });

    it("Interactive command with nested immediate commands", async () => {
      const interactivePythagoras = new InteractivePythagorasCommand(iModelDb);

      await interactivePythagoras.startCommandScope();
      const hypotenuse = await interactivePythagoras.calcHypotenuseWithNestedCommands({ sideA: 5, sideB: 12 });
      await interactivePythagoras.endCommandScope();
      expect(hypotenuse).to.equal(13);
    });

    // TODO Rohit: If a command throws, the command scope is not handled/ended properly - fix this
    it("Mix of immediate and interactive commands (which have nested immediate commands)", async () => {
      const immediateCmd = new SquareCommand(iModelDb);
      const interactiveCmd = new InteractivePythagorasCommand(iModelDb);
      const anotherImmediateCmd = new PythagorasCommand(iModelDb);

      // Run immediate command before starting interactive scope
      const immediate1 = await immediateCmd.execute({ value: 7, description: "Square number 7" });

      await interactiveCmd.startCommandScope();
      const interactive = await interactiveCmd.calcHypotenuseWithNestedCommands({ sideA: 6, sideB: 8, description: "Interactive hypotenuse" });
      await interactiveCmd.endCommandScope();

      // Run another immediate command after ending interactive scope
      const immediate2 = await anotherImmediateCmd.execute({ sideA: 9, sideB: 12, description: "Calculate hypotenuse" });

      expect(immediate1).to.equal(49);
      expect(interactive).to.equal(10);
      expect(immediate2).to.equal(15);
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
            category: categoryId,
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

      function closeAndReopen(openMode: OpenMode, fileName: string) {
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
        const elementId = await createElementCmd.execute(templateTestElementProps);

        assert.isTrue(Id64.isValidId64(elementId));

        // Close and reopen the iModel to verify changes were saved
        closeAndReopen(OpenMode.ReadWrite, iModelPath);
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
        const elementId = await createElementCmd.execute(templateTestElementProps);
        assert.isTrue(Id64.isValidId64(elementId));

        // Update the element
        const updateCmd = new UpdateElementCommand(iModelDb);
        await updateCmd.execute({
          elementId,
          intProperty: 20,
          stringProperty: "Updated-StringProperty",
          // leave doubleProperty unchanged
        });

        // Close and reopen the iModel to verify changes were saved
        closeAndReopen(OpenMode.ReadWrite, iModelPath);
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
        const elementId = await createElementCmd.execute(templateTestElementProps);
        assert.isTrue(Id64.isValidId64(elementId));

        // Delete it
        const deleteCmd = new DeleteElementCommand(iModelDb);
        await deleteCmd.execute({ elementId });

        // Verify it's deleted
        expect(() => iModelDb.elements.getElement(elementId)).to.throw();
      });

      it("should throw if abandonChanges is called externally during an active command", async () => {
        const createElementCmd = new CreateElementCommand(iModelDb);
        const elementId = await createElementCmd.execute(templateTestElementProps);
        assert.isTrue(Id64.isValidId64(elementId));

        const updateCmd = new UpdateElementCommand(iModelDb);

        // Start the update but do not await it yet
        const updatePromise = updateCmd.execute({
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
        const elementId = await createElementCmd.execute(templateTestElementProps);
        assert.isTrue(Id64.isValidId64(elementId));

        const updateCmd = new UpdateElementCommand(iModelDb);

        // Start the update but do not await it yet
        const updatePromise = updateCmd.execute({
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

      it("Interactive command with element API operations", async () => {
        const interactiveCommand = new InteractiveElementAPI(iModelDb);

        await interactiveCommand.startCommandScope();

        const elementId = await interactiveCommand.createElementAndUpdateProperties(modelId, categoryId!);
        await interactiveCommand.updateElement(elementId, 53, "ThirdValue", 73.85);

        await interactiveCommand.endCommandScope();

        const element2 = iModelDb.elements.tryGetElement<TestElement>(elementId);
        expect(element2).to.not.be.undefined;
        expect(element2?.intProperty).to.equal(53);
        expect(element2?.stringProperty).to.equal("ThirdValue");
        expect(element2?.doubleProperty).to.equal(73.85);
      });

      it("InteractiveCommand negative tests", async () => {
        // Test 1: Calling a function without activating an edit scope first
        const interactiveCommand = new InteractiveElementAPI(iModelDb);
        await expect(interactiveCommand.createElementAndUpdateProperties(modelId, categoryId!)).to.eventually.be.rejectedWith(Error, "EditCommand has no scope.");

        // Insert an element
        await interactiveCommand.startCommandScope();
        const elementId = await interactiveCommand.createElementAndUpdateProperties(modelId, categoryId!);

        // Test 2: Starting a new edit scope while one is already active
        await expect(interactiveCommand.startCommandScope()).to.eventually.be.rejectedWith(Error, "Cannot start an Interactive EditCommand from while another Interactive EditCommand is active.");
        await interactiveCommand.endCommandScope();

        // Test 3: Calling a function after ending the edit scope
        await expect(interactiveCommand.endCommandScope()).to.eventually.be.rejectedWith(Error, "EditCommand has no scope.");

        // Test 4: Calling a function after ending the edit scope
        await expect(interactiveCommand.updateElement(elementId, 21, "UpdateAgain", 73.85)).to.eventually.be.rejectedWith(Error, "EditCommand has no scope.");

        // Test 5: Save/abandon changes should work when no edit scope is active
        expect(() => iModelDb.saveChanges("Save with no active command")).to.not.throw(Error, "Cannot call saveChanges while an EditCommand is active.");
        expect(() => iModelDb.abandonChanges()).to.not.throw(Error, "Cannot call abandonChanges while an EditCommand is active.");

        // Test 6: Save/abandon changes while an edit scope is active
        await interactiveCommand.startCommandScope();
        expect(() => iModelDb.saveChanges("Save with no active command")).to.throw(Error, "Cannot call saveChanges while an EditCommand is active.");
        expect(() => iModelDb.abandonChanges()).to.throw(Error, "Cannot call abandonChanges while an EditCommand is active.");
        await interactiveCommand.endCommandScope();
      });

      it("Polygon editor - add and remove vertices", async () => {
        const polygonEditor = new InteractivePolygonEditor(iModelDb);

        await polygonEditor.startCommandScope();
        await polygonEditor.initialize(modelId, categoryId!);

        // Add vertices - each creates an element in the database
        await polygonEditor.addVertices([
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ]);

        const count = await polygonEditor.getVertexCount();
        expect(count).to.equal(4);

        // Verify elements were created
        const elementIds = await polygonEditor.getVertexElementIds();
        expect(elementIds.length).to.equal(4);
        elementIds.forEach((id) => {
          const element = iModelDb.elements.tryGetElement(id);
          expect(element).to.not.be.undefined;
        });

        // Remove last vertex
        await polygonEditor.removeLastVertex();
        const countAfterRemove = await polygonEditor.getVertexCount();
        expect(countAfterRemove).to.equal(3);

        await polygonEditor.endCommandScope();

        // Verify elements still exist after saving
        const remainingIds = await polygonEditor.getVertexElementIds();
        remainingIds.forEach((id) => {
          const element = iModelDb.elements.tryGetElement(id);
          expect(element).to.not.be.undefined;
        });
      });

      it("Polygon editor - move vertices", async () => {
        const polygonEditor = new InteractivePolygonEditor(iModelDb);

        await polygonEditor.startCommandScope();
        await polygonEditor.initialize(modelId, categoryId!);

        await polygonEditor.addVertices([
          { x: 0, y: 0 },
          { x: 5, y: 5 },
          { x: 10, y: 0 },
        ]);

        // Move the middle vertex using nested UpdateElementCommand
        const movedElementId = await polygonEditor.moveVertex(1, 5, 10);

        // Verify the element was updated in the database
        const element = iModelDb.elements.getElement(movedElementId);
        expect(element.asAny.stringProperty).to.equal("(5, 10)");

        await polygonEditor.endCommandScope();
      });

      it("Polygon editor - update multiple vertices concurrently", async () => {
        const polygonEditor = new InteractivePolygonEditor(iModelDb);

        await polygonEditor.startCommandScope();
        await polygonEditor.initialize(modelId, categoryId!);

        // Add initial vertices
        await polygonEditor.addVertices([
          { x: 0, y: 0 },
          { x: 5, y: 5 },
          { x: 10, y: 0 },
        ]);

        // Update multiple vertices concurrently
        const updates = [
          { index: 0, x: 1, y: 1 },
          { index: 1, x: 6, y: 6 },
          { index: 2, x: 11, y: 1 },
        ];

        const updatedIds = await polygonEditor.updateMultipleVertices(updates);
        expect(updatedIds.length).to.equal(3);

        // Verify all updates were applied
        updatedIds.forEach((id, index) => {
          const element = iModelDb.elements.getElement(id);
          expect(element.asAny.stringProperty).to.equal(`(${updates[index].x}, ${updates[index].y})`);
        });

        await polygonEditor.endCommandScope();
      });
    });

    // TODO Rohit: The code is set up to not queue nested commands and allow the user to run them async.
    // My idea was to give the onus to the user to ensure they are running their logic correctly and not executing nested commands in a way that might trigger a race condition.
    // However, this contradicts the original need to have an edit scope and to bring the responsibilty back into itwinjs-core.
    // Will have to update the nested command behavior. Serializing all is not optimal and the user might have unrelated commands that are safe to execute in parallel.
    // Maybe give user different API calls that serialize or parallelize nested commands for the parent command ?
    // Food for thought as of right now...

    // TODO Rohit: Just like saveChanges and abandonChanges, there are other iModel APIs that should not be allowed during an active command
    // viz discardChanges, reverseTxns, reinstateTxns, pullChanges, pushChanges, revertAndPushChanges, et cetera.
    // These functions need to be updated and tests must be added for those as well.

    // TODO Rohit: Review locking behavior during active edit commands
  });
});