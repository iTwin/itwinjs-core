import { expect } from "chai";
import { IModelDb, IModelHost, IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { join } from "path";
import { InteractivePolygonEditor, InteractivePythagorasCommand, PythagorasCommand, SquareCommand } from "./TestAssets";

describe("IModelEditCommand", () => {
  const outputDir = join(KnownLocations.tmpdir, "output");
  let iModelDb: IModelDb;
  let iModelPath: string;

  before(() => {
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

    // Real-world scenario: Alternating external and nested commands
    it("Alternating external commands with nested commands", async () => {
      const pyth1 = new PythagorasCommand(iModelDb);
      const pyth2 = new PythagorasCommand(iModelDb);
      const square = new SquareCommand(iModelDb);

      const [result1, result2, result3] = await Promise.all([
        pyth1.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 }),
        square.performSquareOperation({ value: 7 }),
        pyth2.calcHypotenuseWithCommandsAsync({ sideA: 5, sideB: 12 }),
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

    // TODO Rohit: Fix this
    // Need to sort out how multiple nested command execution will work with edit scopes
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
});
